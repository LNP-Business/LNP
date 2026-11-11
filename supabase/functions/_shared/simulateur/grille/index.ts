// Simulateur · l'analyse de fin d'appel (grille d'analyse) : démarrage, plafond quotidien, mise en attente, chaîne en arrière-plan,
// retour d'expérience (AAR) et son miroir, reprise des analyses en attente. Branché dans routes.ts comme `Deps.analyse`.
//
// Une seule ligne crm_sim_analyses par simulation (réutilisée). Le plafond quotidien (crm_sim_config.daily_analysis_limit, jour
// d'Europe/Paris) compte les lancements du jour, gardés dans cost.lances. Le retour d'expérience (colonne `aar`) n'est jamais
// effacé par la chaîne ; s'il arrive avant la fin de l'analyse, le miroir est calculé à la fin de la chaîne.
import type { Appelant, Db } from "../base.ts";
import { config, erreur, json } from "../routes.ts";
import { normaliserTranscriptSimulation } from "./pretraitement.ts";
import type { TypeAppel } from "./moteur/types.ts";
import { analyserGrille, calculerMiroir, redigerDrill, type CoutPrompt, type FetchModele, type ReponsesAAR } from "./pipeline.ts";
import { comparerAARvsIA, NIVEAUX, versResultat, type NiveauAppel } from "./vers-resultat.ts";

export const MESSAGE_TROP_COURT = "Conversation trop courte pour être analysée";
export const MESSAGE_QUOTA_ATTEINT = "Analyse mise en attente — plafond quotidien atteint";
export const MESSAGE_MODE_REFUSE = "Le mode Objections n'est pas analysé : seuls l'appel complet et le diagnostic le sont.";
export const MESSAGE_INTERROMPUE = "Analyse interrompue : plus de 30 minutes sans nouvelle.";
const DEFAULT_DAILY_LIMIT = 10;
const MINUTES_BLOQUEE = 30;
const LOT_REPRISE = 5;
const TABLE = "crm_sim_analyses";
const NIVEAUX_AAR: NiveauAppel[] = ["discovery", "diagnostic", "strategic", "elite"];

export type DepsAnalyse = {
  db: Db;
  anthropicKey: string;
  fetchModele?: FetchModele;
  waitUntil?: (p: Promise<unknown>) => void;
  now?: () => Date;
  /** attente entre deux essais du miroir (tests : immédiate) */
  attente?: (ms: number) => Promise<void>;
};

// Le jour d'Europe/Paris d'une date (AAAA-MM-JJ)
export function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Type d'appel de la grille selon le mode de la simulation (null : non analysé)
export function typeAppelDuMode(mode: string | null | undefined): TypeAppel | null {
  if (mode === "full") return "R1";
  if (mode === "diagnostic") return "diagnostic";
  return null;
}

const MOTIFS_REJET: Record<string, string> = {
  locuteur_unique: "Prétraitement rejeté : un seul interlocuteur dans la conversation.",
  format_non_reconnu: "Prétraitement rejeté : format de conversation non reconnu.",
};

export function creerAnalyse(deps: DepsAnalyse) {
  const db = deps.db;
  const now = deps.now || (() => new Date());
  const ctxModele = { cle: deps.anthropicKey, fetchModele: deps.fetchModele, attente: deps.attente };
  const lancer = (p: Promise<unknown>) => {
    const sur = p.catch((e) => console.error("[simulateur] analyse", e));
    if (deps.waitUntil) { deps.waitUntil(sur); return Promise.resolve(); }
    return sur;
  };

  async function limiteDuJour(): Promise<number> {
    const c = await config(db);
    const v = Number(c.daily_analysis_limit);
    return Number.isInteger(v) && v >= 0 ? v : DEFAULT_DAILY_LIMIT;
  }

  // Nombre de lancements aujourd'hui (Europe/Paris), toutes analyses confondues
  async function lanceesAujourdhui(): Promise<number> {
    const jour = jourParis(now());
    let n = 0;
    for (const status of ["processing", "completed", "failed"]) {
      const rows = await db.select(TABLE, { status }, { order: "updated_at.desc", limit: 2000, select: "id,cost" });
      for (const r of rows) for (const t of (r.cost?.lances ?? []) as string[]) if (jourParis(new Date(t)) === jour) n++;
    }
    return n;
  }

  // Réserve une place dans le plafond du jour (relu à chaque fois ; 0 = analyses coupées)
  async function reserver(): Promise<boolean> {
    const limite = await limiteDuJour();
    if (limite <= 0) return false;
    return (await lanceesAujourdhui()) < limite;
  }

  async function dureeMinutes(simulationId: number): Promise<number | null> {
    const [s] = await db.select("crm_sim_simulations", { id: simulationId }, { select: "id,duration_seconds" });
    return s?.duration_seconds != null ? Math.round(Number(s.duration_seconds) / 60) : null;
  }

  // ---------- la chaîne en arrière-plan, puis l'enregistrement ----------
  async function executer(id: string, transcript: string, typeAppel: TypeAppel, minutes: number | null): Promise<void> {
    const debut = now();
    const battement = setInterval(() => {
      db.update(TABLE, { id, status: "processing" }, { updated_at: now().toISOString() }).catch(() => {});
    }, 60_000);
    let couts: CoutPrompt[] = [];
    try {
      const r = await analyserGrille(ctxModele, { transcript, typeAppel, dureeMinutes: minutes });
      if (r.rejet) throw new Error(MOTIFS_REJET[r.motifRejet] ?? `Prétraitement rejeté : ${r.motifRejet}`);
      couts = [...r.coutDetail];
      const drill = await redigerDrill(ctxModele, r.analyse, couts).catch(() => null);
      const result = versResultat({ analyse: r.analyse, dureeAnalyseMs: r.dureeMs, nbAppelsLlm: couts.length, drill, now: now() });
      const [ligne] = await db.select(TABLE, { id });
      const aar = ligne?.aar ?? null;
      if (aar) {
        result.aar = aar;
        if (NIVEAUX.includes(aar.niveauEstime)) result.comparaison_aar = comparerAARvsIA(aar.niveauEstime, result.niveau as NiveauAppel);
      }
      const t = now().toISOString();
      await db.update(TABLE, { id }, {
        status: "completed", reason: null, result,
        raw: { p1: r.p1, collecte: r.collecte, verif: r.verif, mesures: r.mesures, analyse: r.analyse, etapes_en_echec: r.etapesEnEchec, pretraitement: r.pretraitement },
        cost: coutTotal(ligne?.cost, couts), completed_at: t, updated_at: t,
      });
      // retour d'expérience déjà donné pendant l'analyse : le miroir maintenant
      if (aar && !ligne?.miroir) {
        const m = await calculerMiroir(ctxModele, transcript, aar as ReponsesAAR, result);
        const [l2] = await db.select(TABLE, { id });
        await db.update(TABLE, { id }, { miroir: m.miroir, cost: coutTotal(l2?.cost, m.couts), updated_at: now().toISOString() });
      }
    } catch (e) {
      const message = (e as Error)?.message || String(e);
      console.error("[simulateur] analyse en échec", id, message);
      const [ligne] = await db.select(TABLE, { id });
      const t = now().toISOString();
      await db.update(TABLE, { id }, {
        status: "failed", reason: message,
        result: { _modele: "grille", _meta: { status: "failed", duree_ms: now().getTime() - debut.getTime() }, _error: message, _failedAt: t },
        cost: coutTotal(ligne?.cost, couts), updated_at: t,
      });
    } finally {
      clearInterval(battement);
    }
  }

  function coutTotal(ancien: any, couts: CoutPrompt[]) {
    const appels = [...((ancien?.appels as CoutPrompt[]) ?? []), ...couts];
    return {
      ...(ancien ?? {}), appels,
      total_usd: Math.round(appels.reduce((s, c) => s + (c.cout_usd || 0), 0) * 10000) / 10000,
    };
  }

  function lances(ancien: any): Record<string, unknown> {
    return { ...(ancien ?? {}), lances: [...((ancien?.lances as string[]) ?? []), now().toISOString()] };
  }

  function differe(day: string, apresEchec = false) {
    return { _meta: { status: "deferred" }, _modele: "grille", deferred_reason: MESSAGE_QUOTA_ATTEINT, deferred_day: day, ...(apresEchec ? { deferred_after_failure: true } : {}) };
  }

  // ---------- démarrer (fin de simulation) ----------
  async function demarrer(p: { simulation: any; messages: { role: string; content: string }[]; appelant: Appelant; offerName: string | null }): Promise<Record<string, unknown>> {
    const sim = p.simulation;
    const typeAppel = typeAppelDuMode(sim.simulation_mode);
    const transcript = normaliserTranscriptSimulation(p.messages || []);
    const [existante] = await db.select(TABLE, { simulation_id: sim.id });
    const t = now().toISOString();

    // mode non analysé : une ligne « rejected », aucun modèle appelé
    if (!typeAppel) {
      const ligne = {
        status: "rejected", reason: MESSAGE_MODE_REFUSE, type_appel: null, transcript,
        result: { _modele: "grille", _error: MESSAGE_MODE_REFUSE, _failedAt: t, grille_rejet: "type_appel_non_pris_en_charge" }, updated_at: t,
      };
      const row = existante ? (await db.update(TABLE, { id: existante.id }, ligne))[0] : await inserer({ simulation_id: sim.id, user_id: sim.user_id, ...ligne });
      return { analysisId: row.id, skippedAnalysis: true, reason: MESSAGE_MODE_REFUSE };
    }
    if (!transcript || transcript.trim().length < 100) return { analysisId: null, skippedAnalysis: true, reason: MESSAGE_TROP_COURT };

    // une analyse existe déjà pour cette simulation : réutilisée
    if (existante) {
      if (existante.status === "failed" || existante.status === "rejected") {
        if (!(await reserver())) {
          await db.update(TABLE, { id: existante.id }, { status: "deferred", reason: MESSAGE_QUOTA_ATTEINT, transcript, type_appel: typeAppel, result: differe(jourParis(now()), true), updated_at: t });
          return { analysisId: existante.id, status: "deferred", deferred: true, deferredReason: MESSAGE_QUOTA_ATTEINT };
        }
        await db.update(TABLE, { id: existante.id }, {
          status: "processing", reason: null, transcript, type_appel: typeAppel, result: { _meta: { status: "processing" }, _modele: "grille" },
          cost: lances(existante.cost), attempts: (existante.attempts ?? 0) + 1, completed_at: null, updated_at: t,
        });
        await lancer(executer(existante.id, transcript, typeAppel, await dureeMinutes(sim.id)));
        return { analysisId: existante.id, status: "processing" };
      }
      if (existante.status === "deferred") return { analysisId: existante.id, status: "deferred", deferred: true, deferredReason: MESSAGE_QUOTA_ATTEINT };
      return { analysisId: existante.id, status: "processing" };
    }

    // plafond quotidien atteint : en attente
    if (!(await reserver())) {
      const row = await inserer({ simulation_id: sim.id, user_id: sim.user_id, status: "deferred", reason: MESSAGE_QUOTA_ATTEINT, type_appel: typeAppel, transcript, result: differe(jourParis(now())), updated_at: t });
      return { analysisId: row.id, status: "deferred", deferred: true, deferredReason: MESSAGE_QUOTA_ATTEINT };
    }
    const row = await inserer({
      simulation_id: sim.id, user_id: sim.user_id, status: "processing", type_appel: typeAppel, transcript,
      result: { _meta: { status: "processing" }, _modele: "grille" }, cost: lances(null), attempts: 1, updated_at: t,
    });
    if (row.status !== "processing") {
      // une autre fin d'appel a créé la ligne entre-temps (index unique) : on la renvoie telle quelle
      return row.status === "deferred" ? { analysisId: row.id, status: "deferred", deferred: true, deferredReason: MESSAGE_QUOTA_ATTEINT } : { analysisId: row.id, status: "processing" };
    }
    const minutes = sim.duration_seconds != null ? Math.round(Number(sim.duration_seconds) / 60) : null;
    await lancer(executer(row.id, transcript, typeAppel, minutes));
    return { analysisId: row.id, status: "processing" };
  }

  // Insère une ligne ; si l'index unique (simulation_id) refuse, relit la ligne existante (création concurrente)
  async function inserer(ligne: Record<string, unknown>): Promise<any> {
    try {
      return (await db.insert(TABLE, ligne))[0];
    } catch (e) {
      const [r] = await db.select(TABLE, { simulation_id: ligne.simulation_id as number });
      if (r) return { ...r, status: r.status === "processing" ? "_concurrente" : r.status };
      throw e;
    }
  }

  // ---------- POST analyses/:id/aar : le retour d'expérience, puis le miroir ----------
  async function aar(id: string, a: Appelant, b: Record<string, unknown>): Promise<Response> {
    try {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return erreur(404, "Analyse non trouvée");
      const [row] = await db.select(TABLE, { id });
      if (!row) return erreur(404, "Analyse non trouvée");
      if (row.user_id !== a.id) return erreur(403, "Non autorisé");
      const champ = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string).trim() : "");
      const reponses = { momentBienGere: champ("momentBienGere"), momentDifficile: champ("momentDifficile"), ceQueJeReferais: champ("ceQueJeReferais") };
      const niveauEstime = b?.niveauEstime as NiveauAppel;
      if (!reponses.momentBienGere || !reponses.momentDifficile || !reponses.ceQueJeReferais || !niveauEstime) {
        return erreur(400, "Toutes les réponses du retour d'expérience sont requises.");
      }
      if (Object.values(reponses).some((v) => v.length > 2000)) return erreur(400, "Chaque réponse fait au plus 2 000 caractères.");
      if (!NIVEAUX_AAR.includes(niveauEstime)) return erreur(400, "Niveau estimé inconnu.");
      const donnees: ReponsesAAR = { ...reponses, niveauEstime };
      await db.update(TABLE, { id }, { aar: donnees, updated_at: now().toISOString() });

      let comparaison: Record<string, unknown> | null = null;
      let miroir: Record<string, unknown> | null = row.miroir ?? null;
      const result = row.result as Record<string, any> | null;
      if (row.status === "completed" && result?.dimensions && result?.niveau) {
        comparaison = comparerAARvsIA(niveauEstime, result.niveau);
        const patch: Record<string, unknown> = { result: { ...result, aar: donnees, comparaison_aar: comparaison }, updated_at: now().toISOString() };
        if (!row.miroir) {
          const m = await calculerMiroir(ctxModele, row.transcript || "", donnees, result);
          miroir = m.miroir;
          patch.miroir = m.miroir;
          const [l2] = await db.select(TABLE, { id });
          patch.cost = coutTotal(l2?.cost, m.couts);
        }
        await db.update(TABLE, { id }, patch);
      }
      return json({ success: true, comparaison, miroir });
    } catch (e) {
      console.error("[simulateur] aar", e);
      return erreur(500, "Erreur lors de l'enregistrement du retour d'expérience.");
    }
  }

  // ---------- POST analyses/reprendre (administrateurs, et la tâche planifiée) ----------
  // Ne renvoie que des nombres : jamais de nom ni de transcription.
  async function reprendre(a: Appelant): Promise<Response> {
    if (!a?.admin) return erreur(403, "Réservé aux administrateurs.");
    // 1 · les analyses bloquées (plus de 30 min sans nouvelle) passent en échec
    let echouees = 0;
    const limite = now().getTime() - MINUTES_BLOQUEE * 60_000;
    for (const r of await db.select(TABLE, { status: "processing" }, { select: "id,updated_at,created_at" })) {
      const vu = new Date(r.updated_at ?? r.created_at).getTime();
      if (!(vu < limite)) continue;
      const t = now().toISOString();
      const faites = await db.update(TABLE, { id: r.id, status: "processing" }, {
        status: "failed", reason: MESSAGE_INTERROMPUE, result: { _modele: "grille", _error: MESSAGE_INTERROMPUE, _failedAt: t }, updated_at: t,
      });
      echouees += faites.length;
    }
    // 2 · les analyses en attente, dans la limite du plafond du jour (les plus anciennes d'abord)
    let relancees = 0;
    const attente = await db.select(TABLE, { status: "deferred" }, { order: "created_at.asc", limit: LOT_REPRISE });
    for (const r of attente) {
      if (!r.transcript || !r.type_appel) continue;
      if (!(await reserver())) break;
      const t = now().toISOString();
      const faites = await db.update(TABLE, { id: r.id, status: "deferred" }, {
        status: "processing", reason: null, result: { _meta: { status: "processing" }, _modele: "grille" },
        cost: lances(r.cost), attempts: (r.attempts ?? 0) + 1, updated_at: t,
      });
      if (!faites.length) continue;
      relancees++;
      await lancer(executer(r.id, r.transcript, r.type_appel as TypeAppel, await dureeMinutes(r.simulation_id)));
    }
    const restantes = (await db.select(TABLE, { status: "deferred" }, { select: "id" })).length;
    return json({ relancees, echouees, enAttente: restantes });
  }

  return { demarrer, aar, reprendre };
}

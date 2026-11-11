// Grille d'analyse · la chaîne complète (portée telle quelle : même ordre, même parallélisme, mêmes max_tokens, mêmes échecs).
//
//   1. Prétraitement                          déterministe (rejet AVANT tout appel de modèle)
//   2. P1 segmentation                        claude-haiku-5-5, 8192   — échec BLOQUANT
//   3. P2-C, P2-L, P2-E, P2-R en parallèle    claude-haiku-5-5, 4096   — échec consigné, collecte partielle
//   4. P2-A, qui reçoit l'écart (e1) de P2-E  claude-haiku-5-5, 4096   — idem
//   5. P3 vérificateur                        claude-sonnet-5-5, 4096  — échec → aucune contestation
//   6. Moteur d'agrégation                    déterministe
//   7. P4 exercice (cible choisie par le code) claude-haiku-5-5, 2048  — échec → exercice null
//
// Les consignes vont dans le message de la personne (pas de consigne système), sans température (les modèles actuels la
// refusent), réflexion coupée (sansReflexion de llm.ts, appliquée par `appeler`). JSON : texte nettoyé des clôtures ```json,
// puis du premier « { » au dernier « } », JSON.parse ; aucune nouvelle tentative sur un JSON illisible.
import { appeler, MODELE_RAPIDE } from "../llm.ts";
import { pretraiter, ROLE_COMMERCIAL } from "./pretraitement.ts";
import { agreger } from "./moteur/moteur.ts";
import type { Collecte, MesuresDeterministes, ResultatAnalyse, SortieP1, SortieVerifieur, TypeAppel } from "./moteur/types.ts";
import {
  MIROIR_SYSTEME,
  P1_SEGMENTATION,
  P2_ALIGNEMENT,
  P2_CONNEXION,
  P2_ECOUTE,
  P2_EXPOSITION,
  P2_RESOLUTION,
  P3_VERIFICATEUR,
  P4_EXERCICE,
} from "./prompts.ts";
import { choisirCibleDrill, extraireVerbatim, LIBELLES_DIMENSIONS, LIBELLES_NIVEAU, type DrillRedige, type NiveauAppel } from "./vers-resultat.ts";

export const MODELE_COLLECTE = MODELE_RAPIDE;          // « claude-haiku-5-5 » (Haiku 4.5 à l'origine)
export const MODELE_VERIFICATEUR = "claude-sonnet-5-5"; // (Sonnet 4.5 à l'origine)

export type FetchModele = (url: string, init: RequestInit) => Promise<Response>;

// Prix en dollars par million de jetons (entrée, sortie)
const PRIX: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.10, 0.50],
  "claude-sonnet-5-5": [2.00, 10.00],
};
export function coutUsd(modele: string, entree: number, sortie: number): number {
  const [pe, ps] = PRIX[modele] ?? [0, 0];
  return (entree * pe + sortie * ps) / 1_000_000;
}

// ─── Consignes et emplacements ───────────────────────────────
const CONSIGNES = {
  p1Segmentation: P1_SEGMENTATION,
  p2Connexion: P2_CONNEXION,
  p2Ecoute: P2_ECOUTE,
  p2Exposition: P2_EXPOSITION,
  p2Alignement: P2_ALIGNEMENT,
  p2Resolution: P2_RESOLUTION,
  p3Verificateur: P3_VERIFICATEUR,
  p4Exercice: P4_EXERCICE,
};
// Garde-fous : chaque consigne porte exactement les emplacements attendus.
export const EMPLACEMENTS_ATTENDUS: Record<keyof typeof CONSIGNES, string[]> = {
  p1Segmentation: ["{{TRANSCRIPT}}"],
  p2Connexion: ["{{TRANSCRIPT}}", "{{SEGMENT_C}}", "{{MOMENTS}}"],
  p2Ecoute: ["{{TRANSCRIPT}}", "{{SEGMENT_L}}"],
  p2Exposition: ["{{TRANSCRIPT}}", "{{SEGMENT_E}}", "{{MOMENTS}}"],
  p2Alignement: ["{{TRANSCRIPT}}", "{{SEGMENTS}}", "{{MOMENTS}}", "{{GAP}}"],
  p2Resolution: ["{{TRANSCRIPT}}", "{{OBJECTIONS}}", "{{SEGMENT_R}}"],
  p3Verificateur: ["{{TRANSCRIPT}}", "{{COLLECTE}}", "{{SEGMENTATION}}"],
  p4Exercice: ["{{CIBLE}}", "{{VERBATIMS}}"],
};
for (const [cle, attendus] of Object.entries(EMPLACEMENTS_ATTENDUS)) {
  const texte = CONSIGNES[cle as keyof typeof CONSIGNES];
  for (const ph of attendus) if (!texte.includes(ph)) throw new Error(`Consigne ${cle} : emplacement ${ph} manquant`);
}

// Remplace chaque emplacement (première occurrence, dans l'ordre des clés) en exigeant sa présence. Remplaçant en fonction :
// les motifs « $& », « $' »… d'une valeur ne sont pas interprétés (écart volontaire et minime avec l'origine).
export function remplir(template: string, valeurs: Record<string, string>): string {
  let resultat = template;
  for (const [nom, valeur] of Object.entries(valeurs)) {
    const ph = `{{${nom}}}`;
    if (!resultat.includes(ph)) throw new Error(`Emplacement ${ph} absent de la consigne`);
    resultat = resultat.replace(ph, () => valeur);
  }
  return resultat;
}

// ─── Un appel de consigne : jetons comptés, JSON strict observé, jamais d'exception ──
export interface CoutPrompt {
  prompt: string;
  modele: string;
  tokens_entree: number;
  tokens_sortie: number;
  cout_usd: number;
  json_strict: boolean | null;
}

export function extraireJson(brut: string): any {
  let t = brut.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin < debut) throw new Error("Pas de JSON dans la réponse du modèle");
  return JSON.parse(t.slice(debut, fin + 1));
}

export async function appelPrompt(
  ctx: { cle: string; fetchModele?: FetchModele },
  nom: string,
  modele: string,
  promptRempli: string,
  couts: CoutPrompt[],
  maxTokens: number,
): Promise<{ ok: true; data: any } | { ok: false; erreur: string }> {
  let entree = 0, sortie = 0;
  let texte: string | undefined;
  try {
    const r = await appeler(ctx.cle, { model: modele, user: promptRempli, maxTokens }, ctx.fetchModele);
    entree = (r.usage.input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0);
    sortie = r.usage.output_tokens ?? 0;
    texte = r.text;
    const data = extraireJson(r.text);
    const brut = r.text.trim();
    couts.push({ prompt: nom, modele, tokens_entree: entree, tokens_sortie: sortie, cout_usd: coutUsd(modele, entree, sortie), json_strict: brut.startsWith("{") && brut.endsWith("}") });
    return { ok: true, data };
  } catch (err) {
    // Les jetons ont pu être consommés même si la lecture du JSON a échoué.
    couts.push({ prompt: nom, modele, tokens_entree: entree, tokens_sortie: sortie, cout_usd: coutUsd(modele, entree, sortie), json_strict: texte !== undefined ? false : null });
    return { ok: false, erreur: (err as Error).message };
  }
}

function segmentJson(p1: SortieP1, code: string): string {
  const segs = p1.segments.filter((s) => s.code === code);
  return JSON.stringify(segs.length > 0 ? segs : [{ code, present: false }]);
}

export class ErreurPipeline extends Error {
  constructor(message: string, public readonly etape: string) { super(message); }
}

export interface RejetPretraitement {
  rejet: true;
  motifRejet: "format_non_reconnu" | "locuteur_unique";
  nbToursBruts: number;
  nbPrisesParole: number;
}

export interface AnalyseComplete {
  rejet: false;
  analyse: ResultatAnalyse;
  p1: SortieP1;
  collecte: Collecte;
  verif: SortieVerifieur | null;
  mesures: MesuresDeterministes;
  etapesEnEchec: string[];
  coutDetail: CoutPrompt[];
  coutEstime: number;
  dureeMs: number;
  pretraitement: Record<string, unknown>;
}

const TYPES_APPEL: TypeAppel[] = ["R1", "R2", "R3", "setting", "diagnostic"];

/** Rejoue uniquement le moteur depuis les sorties conservées (crm_sim_analyses.raw), sans modèle. */
export function rejouerMoteur(p1: SortieP1, collecte: Collecte, verif: SortieVerifieur | null, mesures: MesuresDeterministes): ResultatAnalyse {
  return agreger(p1, collecte, mesures, verif);
}

export async function analyserGrille(
  ctx: { cle: string; fetchModele?: FetchModele },
  entree: { transcript: string; typeAppel: TypeAppel; dureeMinutes: number | null },
): Promise<RejetPretraitement | AnalyseComplete> {
  const debut = Date.now();
  // 0 · Type d'appel : rejet AVANT tout appel de modèle, pas de repli.
  if (!TYPES_APPEL.includes(entree.typeAppel)) {
    throw new ErreurPipeline(`Type d'appel invalide ou absent (« ${entree.typeAppel ?? "null"} »).`, "validation_type_appel");
  }
  // 1 · Prétraitement : le vendeur est toujours COMMERCIAL (correctif de l'inversion des rôles).
  const pre = pretraiter(entree.transcript, ROLE_COMMERCIAL);
  if (!pre.formatReconnu) {
    return { rejet: true, motifRejet: pre.motifRejet!, nbToursBruts: pre.nbToursBruts, nbPrisesParole: pre.nbPrisesParole };
  }
  const couts: CoutPrompt[] = [];
  const echecs: string[] = [];
  const transcript = pre.transcriptFormate;

  // 2 · P1 segmentation : sans P1, aucune borne de segment — l'échec est bloquant.
  const resP1 = await appelPrompt(ctx, "P1_segmentation", MODELE_COLLECTE, remplir(P1_SEGMENTATION, { TRANSCRIPT: transcript }), couts, 8192);
  if (!resP1.ok) throw new ErreurPipeline(`P1 en échec : ${resP1.erreur}`, "P1_segmentation");
  const p1 = resP1.data as SortieP1;
  const moments = JSON.stringify(p1.moments ?? {});

  // 3 · P2-C, P2-L, P2-E, P2-R en parallèle : un échec est consigné, la chaîne continue.
  const [resC, resL, resE, resR] = await Promise.all([
    appelPrompt(ctx, "P2_C_connexion", MODELE_COLLECTE, remplir(P2_CONNEXION, {
      SEGMENT_C: segmentJson(p1, "C"), MOMENTS: moments, TRANSCRIPT: transcript,
    }), couts, 4096),
    appelPrompt(ctx, "P2_L_ecoute", MODELE_COLLECTE, remplir(P2_ECOUTE, {
      SEGMENT_L: segmentJson(p1, "L"), TRANSCRIPT: transcript,
    }), couts, 4096),
    appelPrompt(ctx, "P2_E_exposition", MODELE_COLLECTE, remplir(P2_EXPOSITION, {
      SEGMENT_E: segmentJson(p1, "E"), MOMENTS: moments, TRANSCRIPT: transcript,
    }), couts, 4096),
    appelPrompt(ctx, "P2_R_resolution", MODELE_COLLECTE, remplir(P2_RESOLUTION, {
      OBJECTIONS: JSON.stringify(p1.objections ?? []), SEGMENT_R: segmentJson(p1, "R"), TRANSCRIPT: transcript,
    }), couts, 4096),
  ]);
  const collecte: Collecte = {};
  if (resC.ok) collecte.c = resC.data; else echecs.push("P2_C_connexion");
  if (resL.ok) collecte.l = resL.data; else echecs.push("P2_L_ecoute");
  if (resE.ok) collecte.e = resE.data; else echecs.push("P2_E_exposition");
  if (resR.ok) collecte.r = resR.data; else echecs.push("P2_R_resolution");

  // 4 · P2-A reçoit l'écart produit par P2-E (vide si P2-E a échoué).
  const gap = resE.ok ? JSON.stringify((resE.data as any)?.e1 ?? {}) : "{}";
  const resA = await appelPrompt(ctx, "P2_A_alignement", MODELE_COLLECTE, remplir(P2_ALIGNEMENT, {
    SEGMENTS: JSON.stringify(p1.segments), MOMENTS: moments, GAP: gap, TRANSCRIPT: transcript,
  }), couts, 4096);
  if (resA.ok) collecte.a = resA.data; else echecs.push("P2_A_alignement");

  // 5 · P3 vérificateur : un échec laisse verif à null, le moteur agrège sans contestation.
  const resP3 = await appelPrompt(ctx, "P3_verificateur", MODELE_VERIFICATEUR, remplir(P3_VERIFICATEUR, {
    SEGMENTATION: JSON.stringify(p1), COLLECTE: JSON.stringify(collecte), TRANSCRIPT: transcript,
  }), couts, 4096);
  const verif = resP3.ok ? (resP3.data as SortieVerifieur) : null;
  if (!resP3.ok) echecs.push("P3_verificateur");

  // 6 · Mesures déterministes : pas de minutage de la parole dans une simulation (L5 non évaluable).
  const mesures: MesuresDeterministes = {
    ratio_parole_global: null,
    ratio_parole_segment_l: null,
    monologues_60s: null,
    duree_secondes: entree.dureeMinutes != null ? entree.dureeMinutes * 60 : null,
    type_appel: entree.typeAppel,
    issue_commerciale: null,
  };

  // 7 · Moteur d'agrégation.
  const analyse = agreger(p1, collecte, mesures, verif);
  return {
    rejet: false, analyse, p1, collecte, verif, mesures, etapesEnEchec: echecs, coutDetail: couts,
    coutEstime: Math.round(couts.reduce((s, c) => s + c.cout_usd, 0) * 10000) / 10000,
    dureeMs: Date.now() - debut,
    pretraitement: {
      nb_tours_bruts: pre.nbToursBruts, nb_prises_parole: pre.nbPrisesParole, taux_fragmentation: pre.tauxFragmentation,
      taux_horodatage: pre.tauxHorodatage, roles: pre.roles,
    },
  };
}

// ─── P4 : l'exercice, rédigé par le modèle sur une cible choisie par le code ──
const DUREES_VALIDES = new Set(["1min", "2min", "3min"]);

export async function redigerDrill(
  ctx: { cle: string; fetchModele?: FetchModele },
  analyse: ResultatAnalyse,
  couts: CoutPrompt[],
): Promise<(DrillRedige & { type: string }) | null> {
  const cible = choisirCibleDrill(analyse);
  if (!cible) return null;
  const verbatims = analyse.etapes
    .flatMap((e) => e.items)
    .filter((i) => i.verdict !== "correct")
    .map((i) => ({ item: i.code, verbatim: extraireVerbatim(i.signaux) }))
    .filter((v) => v.verbatim !== "")
    .slice(0, 5);
  const res = await appelPrompt(ctx, "P4_exercice", MODELE_COLLECTE, remplir(P4_EXERCICE, {
    CIBLE: JSON.stringify(cible), VERBATIMS: JSON.stringify(verbatims),
  }), couts, 2048);
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  if (typeof d.titre !== "string" || typeof d.contexte !== "string" || typeof d.consigne !== "string" ||
      !DUREES_VALIDES.has(d.duree_estimee as string)) return null;
  return {
    type: cible.type,
    titre: d.titre,
    duree_estimee: d.duree_estimee as string,
    contexte: d.contexte,
    consigne: d.consigne,
    exemple_reponse: typeof d.exemple_reponse === "string" ? d.exemple_reponse : null,
  };
}

// ─── Le miroir du retour d'expérience (un appel claude-sonnet-5-5, 16384, 3 essais) ──
export type ReponsesAAR = { momentBienGere: string; momentDifficile: string; ceQueJeReferais: string; niveauEstime: NiveauAppel };

export function messageMiroir(transcript: string, aar: ReponsesAAR, result: Record<string, any>): string {
  const dims = result.dimensions ?? {};
  const s = (k: string) => `${LIBELLES_DIMENSIONS[k]} ${String(dims[k]?.score ?? 0).replace(".", ",")}/${String(dims[k]?.scoreMax ?? 0).replace(".", ",")}`;
  let ctx = "";
  ctx += `\n═══ CONTEXTE D'ANALYSE ═══\n`;
  ctx += `Scores : ${["structure", "diagnostic", "valeur", "pcm", "conclusion"].map(s).join(", ")}\n`;
  ctx += `Point fort : ${result.point_fort ?? ""}\nPoint faible : ${result.point_faible ?? ""}\n`;
  if (result.turning_point) ctx += `Tournant : ${result.turning_point.description}\n`;
  ctx += `\n═══ AUTO-ÉVALUATION DU COMMERCIAL ═══\n`;
  ctx += `1. Moment bien géré : "${aar.momentBienGere}"\n`;
  ctx += `2. Moment difficile : "${aar.momentDifficile}"\n`;
  ctx += `3. Ce qu'il referait : "${aar.ceQueJeReferais}"\n`;
  ctx += `4. Niveau estimé : ${aar.niveauEstime}\n`;
  return `TRANSCRIPT DE L'APPEL :\n\n${transcript}\n${ctx}`;
}

export async function calculerMiroir(
  ctx: { cle: string; fetchModele?: FetchModele; attente?: (ms: number) => Promise<void> },
  transcript: string,
  aar: ReponsesAAR,
  result: Record<string, any>,
): Promise<{ miroir: Record<string, unknown> | null; couts: CoutPrompt[] }> {
  const couts: CoutPrompt[] = [];
  const attente = ctx.attente ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const user = messageMiroir(transcript, aar, result);
  for (let essai = 0; essai <= 2; essai++) {
    let entree = 0, sortie = 0;
    try {
      const r = await appeler(ctx.cle, { model: MODELE_VERIFICATEUR, system: MIROIR_SYSTEME, user, maxTokens: 16384, cacheSystem: false }, ctx.fetchModele);
      entree = r.usage.input_tokens ?? 0; sortie = r.usage.output_tokens ?? 0;
      couts.push({ prompt: "miroir", modele: MODELE_VERIFICATEUR, tokens_entree: entree, tokens_sortie: sortie, cout_usd: coutUsd(MODELE_VERIFICATEUR, entree, sortie), json_strict: null });
      const brut = extraireJson(r.text);
      const m = brut?.miroir;
      if (!m) return { miroir: null, couts };
      const reel = result.niveau as NiveauAppel;
      return {
        miroir: {
          moment_bien_gere: { reponse_commercial: aar.momentBienGere, ...m.moment_bien_gere },
          moment_difficile: { reponse_commercial: aar.momentDifficile, ...m.moment_difficile },
          ce_que_je_referais: { reponse_commercial: aar.ceQueJeReferais, ...m.ce_que_je_referais },
          niveau: { estime: LIBELLES_NIVEAU[aar.niveauEstime], reel: LIBELLES_NIVEAU[reel] ?? reel, ...m.niveau },
        },
        couts,
      };
    } catch (e) {
      console.error(`[simulateur] miroir (essai ${essai + 1}/3)`, (e as Error).message);
      if (essai < 2) await attente(1000 * (essai + 1));
    }
  }
  return { miroir: null, couts };
}

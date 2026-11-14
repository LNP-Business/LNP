// Simulateur · les routes de la fonction Edge `simulateur` (portées des routes d'origine simulations, simulation-messages,
// simulation-end, simulation-feedback). Toutes exigent le jeton d'une personne de l'équipe (crm_members actif) ; une
// simulation n'est lisible et modifiable que par la personne qui l'a lancée, ou par un administrateur.
import type { Db, Appelant } from "./base.ts";
import type { Persona } from "./types.ts";
import type { SimulationModeId } from "./simulationModes.ts";
import { buildFirstMessage } from "./build-gated-prompt.ts";
import { buildObjectionsFirstMessage } from "./build-gated-objections-prompt.ts";
import { VERSION_REFERENTIEL_SIMULATION } from "./referentiel-version.ts";
import { appelRapide, consignesProspect, fenetreGlissante, personaDepuisLigne, type MessageSim } from "./prospect.ts";
import { diffuser, ErreurModele, MODELE_PROSPECT, MODELES_PROSPECT, type Bloc, type MessageModele, type Usage } from "./llm.ts";
import { convertisseurFlux, nettoyerPourVoix, transcriptionVide, voixParDefaut, VOIX, type ReglagesVoix } from "./voix.ts";
import { mesurerRealisme } from "./realisme.ts";

export type Deps = {
  db: Db;
  anthropicKey: string;
  auth: (jeton: string) => Promise<Appelant | null>;
  fetchModele?: (url: string, init: RequestInit) => Promise<Response>;
  // la voix du prospect (ElevenLabs), si la clé existe : texte → réponse audio mp3 (flux)
  tts?: ((p: { texte: string; voiceId: string; config: ReglagesVoix }) => Promise<Response>) | null;
  // l'analyse de fin d'appel (analyse.ts), et ses routes
  analyse?: {
    demarrer: (p: { simulation: any; messages: MessageSim[]; appelant: Appelant; offerName: string | null }) => Promise<Record<string, unknown>>;
    aar: (id: string, appelant: Appelant, aar: Record<string, unknown>) => Promise<Response>;
    reprendre?: (appelant: Appelant) => Promise<Response>;
  };
  // offres et prospects (offres.ts)
  offres?: (req: Request, chemin: string[], appelant: Appelant) => Promise<Response | null>;
  waitUntil?: (p: Promise<unknown>) => void;
  now?: () => Date;
};

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
export const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
export const erreur = (status: number, message: string, code?: string) => json({ error: message, ...(code ? { code } : {}) }, status);

const DIFF_LABEL: Record<string, string> = { moyen: "Moyen", difficile: "Difficile", expert: "Expert" };
const MODES: SimulationModeId[] = ["full", "diagnostic", "objections"];

// Les erreurs de flux montrées à la personne (simulation-stream-errors d'origine) : un code, le message est dans l'écran
export function codeErreurFlux(e: unknown): string {
  const t = String((e as Error)?.message ?? e ?? "").toLowerCase();
  if (t.includes("persona généré sans offercontext") || t.includes("scénario d'entraînement")) return "SCENARIO_UNAVAILABLE";
  if (t.includes("credit balance") || t.includes("overloaded") || t.includes("rate limit") || t.includes("temporarily unavailable") ||
      t.includes("anthropic_api_key") || (e instanceof ErreurModele && e.retry)) return "PROVIDER_UNAVAILABLE";
  if (t.includes("unauthorized") || t.includes("non authentifié")) return "SESSION_EXPIRED";
  return "RESPONSE_FAILED";
}

async function lire(req: Request): Promise<Record<string, any>> {
  try { const t = await req.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

export async function config(db: Db): Promise<Record<string, any>> {
  const [c] = await db.select("crm_sim_config", { id: 1 });
  return c || { claude_model: MODELE_PROSPECT, voice_mode_enabled: true, eleven_labs_model_id: "eleven_flash_v2_5", eleven_labs_stability: 0.2,
    eleven_labs_style: 0.2, eleven_labs_speed: 1.2, silence_timeout_ms: 800, daily_analysis_limit: 10 };
}

function voixConfig(c: Record<string, any>) {
  return { modelId: c.eleven_labs_model_id || "eleven_flash_v2_5", stability: Number(c.eleven_labs_stability ?? 0.2),
    style: Number(c.eleven_labs_style ?? 0.2), speed: Number(c.eleven_labs_speed ?? 1.2) };
}

async function chargerPersona(db: Db, sim: any): Promise<Persona | undefined> {
  if (sim.persona_id) {
    const [row] = await db.select("crm_sim_personas", { id: sim.persona_id });
    if (row) return personaDepuisLigne(row);
  }
  return sim.persona_data ? (sim.persona_data as Persona) : undefined;
}

async function chargerOffre(db: Db, sim: any, persona?: Persona): Promise<{ data: any; name: string | null } | null> {
  for (const id of [sim.offer_id, persona?.offer_id]) {
    if (!id) continue;
    const [o] = await db.select("crm_sim_offers", { id });
    if (o?.data) return { data: o.data, name: o.name };
  }
  return null;
}

async function messagesDe(db: Db, id: number): Promise<any[]> {
  return await db.select("crm_sim_messages", { simulation_id: id }, { order: "id.asc" });
}

function ajouterUsage(cumul: Record<string, any>, poste: string, u: Usage) {
  const c = cumul[poste] = cumul[poste] || { input: 0, output: 0, cache_read: 0, cache_write: 0, calls: 0 };
  c.input += u.input_tokens || 0; c.output += u.output_tokens || 0; c.calls += 1;
  c.cache_read += u.cache_read_input_tokens || 0; c.cache_write += u.cache_creation_input_tokens || 0;
}

export function app(d: Deps) {
  const now = d.now || (() => new Date());

  async function simulationAccessible(id: number, a: Appelant): Promise<any | Response> {
    if (!Number.isFinite(id)) return erreur(404, "Simulation introuvable");
    const [sim] = await d.db.select("crm_sim_simulations", { id });
    if (!sim) return erreur(404, "Simulation introuvable");
    if (!a.admin && sim.user_id !== a.id) return erreur(403, "Accès non autorisé");
    return sim;
  }

  // ---------- POST /simulations : lancer une simulation ----------
  async function creer(req: Request, a: Appelant) {
    const b = await lire(req);
    const mode = (MODES.includes(b.simulationMode) ? b.simulationMode : "full") as SimulationModeId;
    if (!b.personaId || typeof b.personaId !== "string") {
      return erreur(400, mode === "objections" ? "Le mode Objections nécessite un persona. Veuillez sélectionner un prospect." : "Choisissez un prospect.");
    }
    const [row] = await d.db.select("crm_sim_personas", { id: b.personaId });
    if (!row || (!row.active && !a.admin)) return erreur(400, "Persona non trouvé. Veuillez sélectionner un prospect valide.");
    const persona = personaDepuisLigne(row);
    if (mode === "objections" && !persona.objectionsMode) return erreur(400, "Ce prospect n'a pas les données requises pour le mode Objections.");
    const difficulty = ["moyen", "difficile", "expert"].includes(row.difficulty) ? row.difficulty : "moyen";
    const [sim] = await d.db.insert("crm_sim_simulations", {
      user_id: a.id, prospect_name: row.first_name || persona.identite?.prenom || "Prospect", prospect_profile: DIFF_LABEL[difficulty],
      persona_id: row.id, offer_id: row.offer_id, difficulty, simulation_mode: mode, call_structure: "lnp",
      persona_data: persona, use_modular_prompt: true, version_referentiel: VERSION_REFERENTIEL_SIMULATION, voice: !!b.voiceMode,
    });
    // en diagnostic et en objections, le prospect parle le premier (l'appel est déjà commencé)
    if (mode !== "full") {
      const initial = mode === "objections" ? buildObjectionsFirstMessage(persona) : buildFirstMessage(persona, mode);
      if (initial) await d.db.insert("crm_sim_messages", { simulation_id: sim.id, role: "prospect", content: initial });
    }
    return json({ ...sim, messages: await messagesDe(d.db, sim.id) }, 201);
  }

  // ---------- POST /simulations/:id/messages : la réplique du commercial, la réponse du prospect en flux (SSE) ----------
  async function message(req: Request, a: Appelant, id: number) {
    const b = await lire(req);
    const content = typeof b.content === "string" ? b.content.trim() : "";
    const voiceMode = !!b.voiceMode;
    if (!content) return erreur(400, "Le message est vide.");
    if (content.length > 4000) return erreur(400, "Le message est trop long (4 000 caractères au plus).");
    const simX = await simulationAccessible(id, a);
    if (simX instanceof Response) return simX;
    let sim = simX;
    if (sim.status !== "active") return erreur(400, "Cette simulation est terminée.", "NOT_ACTIVE");

    const [commercial] = await d.db.insert("crm_sim_messages", { simulation_id: id, role: "commercial", content });
    const enc = new TextEncoder();
    let fini = false;
    const stream = new ReadableStream({
      start: async (ctrl) => {
        const send = (o: unknown) => { if (!fini) { try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { fini = true; } } };
        const keep = setInterval(() => { if (!fini) { try { ctrl.enqueue(enc.encode(": keep-alive\n\n")); } catch { fini = true; } } }, 8000);
        let prospectCree = false;
        const usage: Record<string, any> = { ...(sim.usage || {}) };
        try {
          send({ userMessage: commercial });
          const messages = await messagesDe(d.db, id);
          let chat: MessageModele[] = messages.map((m) => ({ role: m.role === "commercial" ? "user" : "assistant", content: m.content }));
          if (chat.length > 0 && chat[0].role === "assistant") chat = [{ role: "user", content: "[Le prospect décroche le téléphone]" }, ...chat];
          chat = fenetreGlissante(chat as any);
          if (chat.length >= 3) {
            const i = chat.length - 2;
            chat[i] = { role: chat[i].role, content: [{ type: "text", text: chat[i].content as string, cache_control: { type: "ephemeral" } }] };
          }
          const persona = await chargerPersona(d.db, sim);
          if (!persona) throw new Error("Persona introuvable");
          const offre = await chargerOffre(d.db, sim, persona);
          const cfg = await config(d.db);
          const modele = MODELES_PROSPECT.includes(cfg.claude_model) ? cfg.claude_model : MODELE_PROSPECT;
          const rapide = appelRapide(d.anthropicKey, (_l, u) => ajouterUsage(usage, "signaux", u), d.fetchModele);
          const mode = sim.simulation_mode as SimulationModeId;
          const base = { persona, mode, offerData: offre?.data ?? null, voiceMode, simulation: sim, messageCommercial: content, messages, rapide };
          // à la voix : les analyses de signaux tournent pendant la réponse (le prospect répond avec l'état du tour d'avant)
          const etatVoix = voiceMode ? consignesProspect(base).catch((e) => { console.error("[simulateur] signaux (voix)", e); return null; }) : null;
          const consignes = await consignesProspect({ ...base, skipHaiku: voiceMode });

          let reponse = "";
          const gen = diffuser(d.anthropicKey, {
            model: modele, maxTokens: 900, messages: chat,
            system: [{ type: "text", text: consignes.prompt, cache_control: { type: "ephemeral" } }] as Bloc[],
          }, d.fetchModele);
          while (true) {
            const r = await gen.next();
            if (r.done) { ajouterUsage(usage, "prospect", r.value || {}); break; }
            if (fini) break;
            reponse += r.value;
            send({ content: r.value });
          }
          if (!reponse.trim()) throw new Error("STREAM_INCOMPLETE");

          const [prospect] = await d.db.insert("crm_sim_messages", { simulation_id: id, role: "prospect", content: reponse });
          prospectCree = true;
          const etat = etatVoix ? await etatVoix : null;
          const stateJson = etat?.stateJson || consignes.stateJson;
          const patch: Record<string, unknown> = { usage };
          if (stateJson) {
            const s = JSON.parse(stateJson);
            s.previousProspectResponse = reponse.substring(0, 500);
            if (etat?.meta?.verdictConclusion || consignes.meta?.verdictConclusion) s.verdictConclusion = etat?.meta?.verdictConclusion || consignes.meta?.verdictConclusion;
            patch.simulation_state = s;
          }
          await d.db.update("crm_sim_simulations", { id }, patch);
          send({ done: true, prospectMessage: prospect });
        } catch (e) {
          console.error("[simulateur] message", e);
          // la réplique du commercial sans réponse est retirée : la personne peut la renvoyer
          if (!prospectCree) { try { await d.db.remove("crm_sim_messages", { id: commercial.id, role: "commercial" }); } catch { /* déjà retirée */ } }
          send({ error: { code: (e as Error)?.message === "STREAM_INCOMPLETE" ? "STREAM_INCOMPLETE" : codeErreurFlux(e) } });
        } finally {
          clearInterval(keep);
          fini = true;
          try { ctrl.close(); } catch { /* fermé */ }
        }
      },
      cancel() { fini = true; },
    });
    return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store, must-revalidate", "X-Accel-Buffering": "no" } });
  }

  // ---------- DELETE /simulations/:id/messages/undo : retirer le dernier échange ----------
  async function annuler(a: Appelant, id: number) {
    const sim = await simulationAccessible(id, a);
    if (sim instanceof Response) return sim;
    if (sim.status !== "active") return erreur(400, "Impossible d’annuler : la simulation est terminée.", "NOT_ACTIVE");
    const msgs = await messagesDe(d.db, id);
    let i = msgs.length - 1, deleted = 0;
    while (i >= 0 && msgs[i].role === "prospect") { deleted += await d.db.remove("crm_sim_messages", { id: msgs[i].id }); i--; }
    if (i >= 0 && msgs[i].role === "commercial") deleted += await d.db.remove("crm_sim_messages", { id: msgs[i].id });
    if (deleted === 0) return erreur(400, "Pas assez de messages à annuler");
    const restants = await messagesDe(d.db, id);
    return json({ success: true, deleted, messageCount: restants.length, messages: restants });
  }

  // ---------- POST /simulations/:id/end : terminer (et lancer l'analyse) ----------
  async function terminer(req: Request, a: Appelant, id: number) {
    const b = await lire(req);
    const beacon = b.beacon === true;
    const skip = b.skipAnalysis === true || beacon;
    const sim = await simulationAccessible(id, a);
    if (sim instanceof Response) return sim;
    const reprise = sim.status === "completed" && !skip;
    if (sim.status !== "active" && !reprise) {
      if (beacon) return json({ ok: true });
      return erreur(400, "Cette simulation est terminée.", "NOT_ACTIVE");
    }
    const t = now();
    const duree = reprise && sim.duration_seconds != null ? sim.duration_seconds : Math.floor((t.getTime() - new Date(sim.started_at).getTime()) / 1000);
    // v0.13 : la mesure de réalisme de la simulation (part de parole, longueur des réponses, questions du prospect), gardée
    // avec l'usage et lue dans l'historique
    const messagesFin = await messagesDe(d.db, id);
    const usageFin = { ...(sim.usage || {}), realisme: mesurerRealisme(messagesFin) };
    if (!reprise) await d.db.update("crm_sim_simulations", { id }, { status: "completed", ended_at: t.toISOString(), duration_seconds: duree, usage: usageFin });
    const terminee = { ...sim, status: "completed", ended_at: sim.ended_at ?? t.toISOString(), duration_seconds: duree, usage: usageFin };
    const relire = async () => (await d.db.select("crm_sim_simulations", { id }))[0];
    // seuls l'appel complet et le diagnostic s'analysent ; le mode objections est refusé, même sans analyse demandée
    const eligible = sim.simulation_mode === "full" || sim.simulation_mode === "diagnostic";
    if (skip && eligible) return json({ simulation: await relire(), analysisId: null, skippedAnalysis: true, reason: "Analyse non demandée" });
    if (!d.analyse) return json({ simulation: await relire(), analysisId: null, skippedAnalysis: true, reason: "Analyse indisponible" });
    const offre = await chargerOffre(d.db, sim);
    const r = await d.analyse.demarrer({ simulation: terminee, messages: messagesFin, appelant: a, offerName: offre?.name ?? null });
    return json({ simulation: await relire(), ...r });
  }

  // ---------- POST /simulations/:id/feedback : la note (1 à 5) et le commentaire ----------
  async function note(req: Request, a: Appelant, id: number) {
    const b = await lire(req);
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return erreur(400, "La note doit être un entier de 1 à 5.");
    const comment = typeof b.comment === "string" && b.comment.trim() ? b.comment.trim() : null;
    if (comment && comment.length > 2000) return erreur(400, "Le commentaire dépasse 2 000 caractères.");
    const sim = await simulationAccessible(id, a);
    if (sim instanceof Response) return sim;
    if (sim.user_id !== a.id) return erreur(403, "Accès non autorisé");
    const [deja] = await d.db.select("crm_sim_feedback", { simulation_id: id });
    if (deja) return erreur(409, "Vous avez déjà donné votre avis sur cette simulation.");
    const [row] = await d.db.insert("crm_sim_feedback", { simulation_id: id, user_id: a.id, user_email: a.email, rating, comment });
    return json({ success: true, feedback: row }, 201);
  }

  // ---------- DELETE /simulations/:id ----------
  async function supprimer(a: Appelant, id: number) {
    const sim = await simulationAccessible(id, a);
    if (sim instanceof Response) return sim;
    await d.db.remove("crm_sim_simulations", { id });
    return json({ success: true });
  }

  // ---------- POST /tts : la voix d'une phrase du prospect (ElevenLabs) ; sans clé, le navigateur parle lui-même ----------
  async function voixTexte(texte: string, voiceId: string) {
    const propre = nettoyerPourVoix(texte);
    if (propre.length < 3) return new Response(null, { status: 204, headers: CORS });
    const cfg = await config(d.db);
    if (!d.tts || cfg.voice_mode_enabled === false) return json({ fallback: "speechSynthesis", speed: Number(cfg.eleven_labs_speed ?? 1.2) });
    try {
      const r = await d.tts({ texte: propre, voiceId, config: voixConfig(cfg) });
      return new Response(r.body, { headers: { ...CORS, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    } catch (e) {
      console.error("[simulateur] voix", e);
      return json({ fallback: "speechSynthesis", speed: Number(cfg.eleven_labs_speed ?? 1.2), error: "TTS failed" });
    }
  }

  // ---------- POST /simulations/:id/voix : un tour de parole en mode voix (l'agent vocal d'origine et son « LLM » dédié) ----------
  // La transcription du commercial → la réponse du prospect, diffusée avec les nombres en toutes lettres pour la voix ; la base
  // garde les chiffres. L'état du moteur est mis à jour APRÈS la réponse (le prospect répond avec l'état du tour d'avant).
  async function tourVocal(req: Request, a: Appelant, id: number) {
    const b = await lire(req);
    const content = typeof b.content === "string" ? b.content.trim() : "";
    const simX = await simulationAccessible(id, a);
    if (simX instanceof Response) return simX;
    const sim = simX;
    if (sim.status !== "active") return erreur(400, "Cette simulation est terminée.", "NOT_ACTIVE");
    const enc = new TextEncoder();
    const persona = await chargerPersona(d.db, sim);
    const voiceId = persona?.voice_id || voixParDefaut(persona?.identite?.prenom || "");
    const sse = (f: (send: (o: unknown) => void) => Promise<void>) => new Response(new ReadableStream({
      start: async (ctrl) => {
        let fini = false;
        const send = (o: unknown) => { if (!fini) { try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { fini = true; } } };
        try { await f(send); } finally { fini = true; try { ctrl.close(); } catch { /* fermé */ } }
      },
    }), { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });

    // une transcription vide (bruit) : « Euh... tu disais ? », gardé comme réplique du prospect
    if (transcriptionVide(content)) {
      return sse(async (send) => {
        const [p] = await d.db.insert("crm_sim_messages", { simulation_id: id, role: "prospect", content: "Euh... tu disais ?" });
        send({ content: "Euh... tu disais ?" });
        send({ done: true, prospectMessage: p, spokenText: "Euh... tu disais ?", voiceId });
      });
    }
    return sse(async (send) => {
      let commercial: any = null, prospectCree = false;
      const usage: Record<string, any> = { ...(sim.usage || {}) };
      try {
        // une même transcription renvoyée n'est pas enregistrée deux fois
        const avant = await messagesDe(d.db, id);
        const der = avant[avant.length - 1];
        if (der && der.role === "commercial" && der.content === content) commercial = der;
        else [commercial] = await d.db.insert("crm_sim_messages", { simulation_id: id, role: "commercial", content });
        send({ userMessage: commercial });
        const messages = await messagesDe(d.db, id);
        let chat: MessageModele[] = messages.map((m) => ({ role: m.role === "commercial" ? "user" : "assistant", content: m.content }));
        if (chat.length > 0 && chat[0].role === "assistant") chat = [{ role: "user", content: "[Le prospect décroche le téléphone]" }, ...chat];
        chat = fenetreGlissante(chat as any);
        if (!persona) throw new Error("Persona introuvable");
        const offre = await chargerOffre(d.db, sim, persona);
        const cfg = await config(d.db);
        const modele = MODELES_PROSPECT.includes(cfg.claude_model) ? cfg.claude_model : MODELE_PROSPECT;
        const mode = sim.simulation_mode as SimulationModeId;
        const rapide = appelRapide(d.anthropicKey, (_l, u) => ajouterUsage(usage, "signaux", u), d.fetchModele);
        const base = { persona, mode, offerData: offre?.data ?? null, voiceMode: true, simulation: sim, messageCommercial: content, messages, rapide };
        const consignes = await consignesProspect({ ...base, skipHaiku: true });
        // au plus 2 nouvelles tentatives si la réponse fait moins de 10 caractères
        let reponse = "";
        for (let essai = 0; essai <= 2; essai++) {
          let texte = "";
          const gen = diffuser(d.anthropicKey, { model: modele, maxTokens: 900, messages: chat,
            system: [{ type: "text", text: consignes.prompt, cache_control: { type: "ephemeral" } }] as Bloc[] }, d.fetchModele);
          while (true) { const r = await gen.next(); if (r.done) { ajouterUsage(usage, "prospect", r.value || {}); break; } texte += r.value; }
          reponse = texte;
          if (texte.replace(/\s/g, "").length >= 10) break;
        }
        if (!reponse.trim()) throw new Error("STREAM_INCOMPLETE");
        const conv = convertisseurFlux();
        const dit = conv.push(reponse) + conv.fin();
        send({ content: dit });
        const [p] = await d.db.insert("crm_sim_messages", { simulation_id: id, role: "prospect", content: reponse });
        prospectCree = true;
        const patch: Record<string, unknown> = { usage };
        if (consignes.stateJson) { const s = JSON.parse(consignes.stateJson); s.previousProspectResponse = reponse.substring(0, 500); patch.simulation_state = s; }
        await d.db.update("crm_sim_simulations", { id }, patch);
        send({ done: true, prospectMessage: p, spokenText: dit, voiceId });
        // l'état du moteur, après la réponse (analyses de signaux de cette réplique)
        const apres = (async () => {
          const [s2] = await d.db.select("crm_sim_simulations", { id });
          if (!s2 || s2.status !== "active") return;
          const r = await consignesProspect({ ...base, simulation: s2 });
          if (r.stateJson) {
            const st = JSON.parse(r.stateJson); st.previousProspectResponse = reponse.substring(0, 500);
            if (r.meta?.verdictConclusion) st.verdictConclusion = r.meta.verdictConclusion;
            await d.db.update("crm_sim_simulations", { id }, { simulation_state: st, usage });
          }
        })().catch((e) => console.error("[simulateur] état (voix)", e));
        if (d.waitUntil) d.waitUntil(apres); else await apres;
      } catch (e) {
        console.error("[simulateur] tour vocal", e);
        if (commercial && !prospectCree) { try { await d.db.remove("crm_sim_messages", { id: commercial.id, role: "commercial" }); } catch { /* retirée */ } }
        send({ error: { code: (e as Error)?.message === "STREAM_INCOMPLETE" ? "STREAM_INCOMPLETE" : codeErreurFlux(e) }, spokenText: "Pardon, je n'ai pas bien compris. Vous pouvez répéter ?", voiceId });
      }
    });
  }

  // ---------- PUT /config : les réglages (administrateurs) ----------
  async function reglages(req: Request, a: Appelant) {
    if (!a.admin) return erreur(403, "Réservé aux administrateurs.");
    const b = await lire(req);
    const patch: Record<string, unknown> = { updated_at: now().toISOString(), updated_by: a.id };
    if (b.claude_model !== undefined) {
      if (!MODELES_PROSPECT.includes(b.claude_model)) return erreur(400, "Modèle inconnu.");
      patch.claude_model = b.claude_model;
    }
    const num = (k: string, lo: number, hi: number) => {
      if (b[k] === undefined) return true;
      const v = Number(b[k]);
      if (!Number.isFinite(v) || v < lo || v > hi) return false;
      patch[k] = v; return true;
    };
    if (!num("eleven_labs_stability", 0, 1) || !num("eleven_labs_style", 0, 1) || !num("eleven_labs_speed", 0.7, 1.2) ||
        !num("silence_timeout_ms", 300, 5000) || !num("daily_analysis_limit", 0, 1000)) return erreur(400, "Valeur hors limites.");
    if (b.voice_mode_enabled !== undefined) patch.voice_mode_enabled = !!b.voice_mode_enabled;
    if (typeof b.eleven_labs_model_id === "string" && /^[a-z0-9_]{3,60}$/.test(b.eleven_labs_model_id)) patch.eleven_labs_model_id = b.eleven_labs_model_id;
    const [row] = await d.db.update("crm_sim_config", { id: 1 }, patch);
    return json(row || {});
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const url = new URL(req.url);
    const chemin = url.pathname.replace(/^.*?\/simulateur\/?/, "").split("/").filter(Boolean);
    let jeton = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    // la fin par « beacon » (page fermée) ne peut pas porter d'en-tête : le jeton est dans le corps
    let corps: string | null = null;
    if (req.method === "POST" && chemin[2] === "end") {
      corps = await req.text();
      try { const b = JSON.parse(corps || "{}"); if (b.beacon && typeof b.token === "string") jeton = b.token; } catch { /* corps vide */ }
      req = new Request(req.url, { method: "POST", headers: req.headers, body: corps });
    }
    // la tâche planifiée (057, toutes les 10 min) : relancer les analyses en attente ; aucune entrée, des nombres en sortie
    if (req.method === "POST" && chemin[0] === "balayer" && chemin.length === 1) {
      if (!d.analyse?.reprendre) return json({ relancees: 0 });
      return await d.analyse.reprendre({ id: "00000000-0000-0000-0000-000000000000", email: "", role: "admin", admin: true });
    }
    let a: Appelant | null = null;
    try { a = await d.auth(jeton); } catch (e) { console.error("[simulateur] auth", e); }
    if (!a) return erreur(401, "Non authentifié");
    try {
      const [r0, r1, r2, r3] = chemin;
      const id = Number(r1);
      if (r0 === "moi" && req.method === "GET") {
        return json({ id: a.id, email: a.email, role: a.role, admin: a.admin, voixElevenLabs: !!d.tts, voix: VOIX, config: await config(d.db) });
      }
      if (r0 === "config" && req.method === "PUT") return await reglages(req, a);
      if (r0 === "tts" && req.method === "POST") {
        const b = await lire(req);
        if (typeof b.text !== "string" || !b.text.trim() || b.text.length > 1500) return erreur(400, "Texte attendu.");
        const voiceId = typeof b.voiceId === "string" && VOIX.some((v) => v.id === b.voiceId) ? b.voiceId : VOIX[2].id;
        return await voixTexte(b.text, voiceId);
      }
      if (r0 === "simulations") {
        if (!r1 && req.method === "POST") return await creer(req, a);
        if (r1 && !r2 && req.method === "DELETE") return await supprimer(a, id);
        if (r2 === "messages" && !r3 && req.method === "POST") return await message(req, a, id);
        if (r2 === "messages" && r3 === "undo" && req.method === "DELETE") return await annuler(a, id);
        if (r2 === "end" && req.method === "POST") return await terminer(req, a, id);
        if (r2 === "feedback" && req.method === "POST") return await note(req, a, id);
        if (r2 === "voix" && req.method === "POST") return await tourVocal(req, a, id);
      }
      if (r0 === "analyses" && d.analyse) {
        if (r1 && r2 === "aar" && req.method === "POST") return await d.analyse.aar(r1, a, await lire(req));
        if (r1 === "reprendre" && req.method === "POST" && d.analyse.reprendre) return await d.analyse.reprendre(a);
      }
      if (d.offres) { const r = await d.offres(req, chemin, a); if (r) return r; }
      return erreur(404, "Route inconnue");
    } catch (e) {
      console.error("[simulateur]", e);
      return erreur(500, "Erreur du simulateur");
    }
  };
}

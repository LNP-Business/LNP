// Simulateur · le prospect : construit ses consignes à chaque tour (moteur d'état : confiance, conscience, résistance aux
// objections), comme le service d'origine (getProspectSystemPrompt). Toujours le moteur modulaire : le moteur historique
// n'existe plus. Les analyses de signaux tournent sur le modèle rapide ; leurs échecs ont un repli (jamais d'erreur).
import type { Persona } from "./types.ts";
import type { OfferData } from "./persona-generated-full.ts";
import type { SimulationModeId } from "./simulationModes.ts";
import { SimulationStateManager } from "./simulation-state-manager.ts";
import { buildGatedDiagnosticPrompt } from "./build-gated-prompt.ts";
import { buildGatedObjectionsPrompt } from "./build-gated-objections-prompt.ts";
import { buildGatedFullPrompt } from "./build-gated-full-prompt.ts";
import { appeler, MODELE_RAPIDE, type Usage } from "./llm.ts";

export type AppelRapide = (prompt: string, system?: string, opts?: { cacheSystem?: boolean; label?: string }) => Promise<string>;

// L'appel rapide (analyses de signaux, verdict) avec sa trace de coût
export function appelRapide(key: string, trace?: (label: string, usage: Usage) => void,
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>): AppelRapide {
  return async (prompt, system, opts) => {
    const r = await appeler(key, { model: MODELE_RAPIDE, system, user: prompt, maxTokens: 300, cacheSystem: opts?.cacheSystem !== false }, fetchFn);
    try { trace?.(opts?.label || "signaux", r.usage); } catch { /* la trace ne bloque jamais */ }
    return r.text;
  };
}

const PCM_CONCLUSION_DESCRIPTIONS: Record<string, string> = {
  travaillomane: "Tu prends tes décisions sur la base de faits concrets : chiffres, cas pratiques, résultats mesurables. Plus on te donne d'informations précises, plus tu te sens prêt à décider.",
  empathique: "Tu accordes beaucoup d'importance à la relation humaine. Tu as besoin de sentir que les gens pensent à toi et que l'ambiance sera chaleureuse.",
  promoteur: "Tu aimes prendre une longueur d'avance et saisir les opportunités concrètes. Ce qui t'emballe : un résultat rapide et tangible.",
  perseverant: "Tu ne signes pas sans preuve concrète que la solution répond exactement à TON problème. Tu as besoin de stats, témoignages, mécanisme expliqué.",
};

async function verdictConclusion(persona: Persona, pcmType: string | undefined, transcript: string, rapide: AppelRapide): Promise<string> {
  const system = `Tu es un prospect. Tu vas incarner ce personnage de façon authentique et répondre en UNE seule phrase naturelle, à la première personne, comme si le commercial venait de te demander : "Alors, tu y vas ou pas ?"

Ta phrase doit sonner vrai — ni trop enthousiaste ni trop froide. Elle peut être positive, hésitante, ou un refus poli. Tu restes toujours courtois. Pas d'explication, juste la phrase.`;
  const douleurs = [...(persona.douleurs?.surface || []), ...(persona.douleurs?.emotionnel || [])].join("\n");
  const freins = (persona.objections || []).map((o: any) => o.texte).join("\n");
  const user = `Tu t'appelles ${persona.identite.prenom}.
Tu es ${persona.identite.metier}.

Ta situation : ${persona.identite.situation}
Tes problèmes : ${douleurs}
Ce que tu veux : ${persona.identite.objectif_ca ?? "Le prospect connaît son objectif mais ne l'a pas encore communiqué — c'est au commercial de le lui demander pendant le diagnostic"}
Tes hésitations : ${freins}

Ton profil de personnalité (${pcmType || "non défini"}) : ${PCM_CONCLUSION_DESCRIPTIONS[pcmType || ""] || ""}

Voici la conversation que tu viens d'avoir :
${transcript}

Ta réponse doit être cohérente avec ce que tu as exprimé pendant l'appel. Si tu as montré de la résistance, elle doit transparaître. Si tu t'es ouvert, ça se sent.

Le commercial te demande : "Alors, tu y vas ou pas ?"
Réponds en UNE phrase naturelle, à la première personne.`;
  return await rapide(user, system, { label: "verdict" });
}

export type MessageSim = { role: string; content: string; created_at?: string };

async function verdictSiPret(messages: MessageSim[], persona: Persona, pcmType: string | undefined, os: any, rapide: AppelRapide) {
  if (!os?.readyToClose) return undefined;
  try {
    const transcript = messages.slice(-15).map((m) => `${m.role === "commercial" ? "COMMERCIAL" : "PROSPECT"}: ${m.content}`).join("\n");
    return await verdictConclusion(persona, pcmType, transcript, rapide);
  } catch (err) {
    console.error("[simulateur] verdict de conclusion impossible", err);
    return undefined;
  }
}

// Une ligne de crm_sim_personas → Persona (dbPersonaToPersona d'origine)
export function personaDepuisLigne(row: any): Persona {
  const data = row.full_persona_data || {};
  const conscienceLevel = data.etatsInitiaux?.conscience || row.consciousness_level || 3;
  const labels: Record<number, { label: string; description: string; objectif: string }> = {
    1: { label: "UNAWARE", description: "Ne sait pas qu'il a un probleme", objectif: "Faire prendre conscience du probleme" },
    2: { label: "PROBLEM AWARE", description: "Sait qu'il a un probleme mais ne connait pas les solutions", objectif: "Presenter les solutions possibles" },
    3: { label: "SOLUTION AWARE", description: "Connait les solutions mais n'a pas choisi", objectif: "Montrer pourquoi cette solution est la meilleure" },
    4: { label: "PRODUCT AWARE", description: "Connait le produit mais hesite encore", objectif: "Lever les dernieres objections" },
    5: { label: "MOST AWARE", description: "Pret a acheter, besoin du dernier push", objectif: "Conclure la vente" },
  };
  const ci = labels[conscienceLevel] || labels[3];
  const briefing = data.briefing ? {
    ...data.briefing,
    niveau_conscience: data.briefing.niveau_conscience || { niveau: conscienceLevel, label: ci.label, description: ci.description, objectif_progression: ci.objectif },
  } : undefined;
  return {
    id: row.id,
    offer_id: row.offer_id,
    voice_id: row.voice_id,
    difficulte: data.difficulte || row.difficulty || "moyen",
    identite: data.identite || {
      prenom: row.first_name || "Prospect", age: row.age || 30, ville: row.city || "Non spécifié",
      metier: row.profession || "Non spécifié", situation: row.situation || "",
      ca_actuel: data.identite?.ca_actuel ?? null, objectif_ca: data.identite?.objectif_ca ?? null,
    },
    etatsInitiaux: data.etatsInitiaux || { conscience: conscienceLevel, confiance: 5, engagement: 5, etat_emotionnel: "NEUTRE" },
    offerContext: data.offerContext,
    backstory: data.backstory || "",
    douleurs: data.douleurs || { surface: [], consequences: [], emotionnel: [], identitaire: [] },
    objections: data.objections || [],
    styleLinguistique: data.styleLinguistique || { vocabulaire: [], tics: [], phrasesType: "", emotionVisible: "" },
    comportementsUniques: data.comportementsUniques || {},
    triggersPositifs: data.triggersPositifs || {},
    objectionsMode: data.objectionsMode,
    briefing,
    pcmType: data.pcmType,
    messagesInitiaux: data.messagesInitiaux,
  } as Persona;
}

// Le transcript horodaté (buildTranscriptFromMessages d'origine)
export function transcriptHorodate(messages: MessageSim[], debut: Date): string {
  return messages.map((m) => {
    const s = Math.max(0, Math.floor((new Date(m.created_at || debut).getTime() - debut.getTime()) / 1000));
    const ts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
    return `[${ts}] ${m.role === "commercial" ? "COMMERCIAL" : "PROSPECT"}:\n${m.content}`;
  }).join("\n\n");
}

export type Simulation = {
  id: number; difficulty: string | null; simulation_state: any; persona_data: any; prospect_name: string; prospect_profile: string;
};

// Les consignes du prospect pour ce tour, et l'état à garder. skipHaiku : la voix sans attente (les analyses de signaux
// tournent alors en parallèle de la réponse, comme à l'origine).
export async function consignesProspect(p: {
  persona: Persona; mode: SimulationModeId; offerData: OfferData | null; voiceMode: boolean; simulation: Simulation;
  messageCommercial?: string; messages: MessageSim[]; rapide: AppelRapide; skipHaiku?: boolean;
}): Promise<{ prompt: string; stateJson?: string; meta?: any }> {
  let persona = p.persona;
  const { mode, voiceMode, simulation, rapide } = p;
  const commercialMessage = p.messageCommercial;
  if (!p.offerData) {
    return { prompt: `Tu es ${simulation.prospect_name}, un prospect. Profil: ${simulation.prospect_profile}. Reponds de maniere conversationnelle.` };
  }
  const offerData = p.offerData;

  const overrides = (simulation.persona_data || {}) as Partial<Persona>;
  if (overrides.pcmType) persona = { ...persona, pcmType: overrides.pcmType };
  if (overrides.etatsInitiaux) persona = { ...persona, etatsInitiaux: { ...persona.etatsInitiaux, ...overrides.etatsInitiaux } };
  if (Array.isArray(overrides.objections) && overrides.objections.length > 0) persona = { ...persona, objections: overrides.objections };

  const diffLabel = String(simulation.difficulty || "moyen");
  const personaConfidence = persona?.etatsInitiaux?.confiance ?? (persona as any)?.briefing?.etats_initiaux?.confiance ?? undefined;
  const sm = simulation.simulation_state
    ? SimulationStateManager.deserialize(JSON.stringify(simulation.simulation_state))
    : new SimulationStateManager(diffLabel, undefined, mode, personaConfidence);

  if (!sm.getPcmType()) {
    const PCM = ["travaillomane", "empathique", "promoteur", "perseverant"] as const;
    sm.setPcmType(persona.pcmType ?? PCM[Math.floor(Math.random() * PCM.length)]);
  }
  if (sm.getConsciousness() === 0) sm.setInitialConsciousness(persona?.etatsInitiaux?.conscience ?? 3);
  const objTexts = () => (persona.objections || []).map((o: any) => o.texte);
  const traiterObjection = async () => {
    const analysis = await sm.analyzeCommercialObjectionMessage(commercialMessage!, rapide);
    const { resolved } = sm.updateObjectionResistance(analysis, commercialMessage!);
    if (resolved) sm.advanceToNextObjection(objTexts());
  };
  const verdict = async () => p.skipHaiku ? undefined : await verdictSiPret(p.messages, persona, sm.getPcmType(), sm.getObjectionState(), rapide);

  // ---- Objections ----
  if (mode === "objections") {
    if (!sm.getObjectionState()) sm.initObjectionState(objTexts());
    if (commercialMessage && !p.skipHaiku) await traiterObjection();
    const v = await verdict();
    return {
      prompt: buildGatedObjectionsPrompt({ persona, offerData, stateManager: sm, voiceMode }),
      stateJson: sm.serialize(),
      meta: { turn: sm.getTurnCount(), objectionState: sm.getObjectionState(), ...(v ? { verdictConclusion: v } : {}) },
    };
  }

  // ---- Appel complet ----
  if (mode === "full") {
    const phase = sm.getFullModePhase() || "diagnostic";
    if (commercialMessage && !p.skipHaiku) {
      if (phase === "diagnostic") {
        const analysis = await sm.analyzeCommercialMessage(commercialMessage, rapide);
        sm.updateConfidence(analysis);
        const switched = sm.checkPhaseSwitch(analysis);
        if (switched || (!switched && sm.getHaikuCAnalysis() && sm.checkForceObjection(sm.getHaikuCAnalysis()!))) {
          let pcmScore: number | null = null;
          if (analysis.presentation_detected && persona.pcmType) pcmScore = await sm.scorePitchPcm(commercialMessage, persona.pcmType, rapide).catch(() => null);
          sm.initObjectionStateWithResistance(objTexts(), pcmScore);
        }
      } else {
        if (!sm.getObjectionState()) sm.initObjectionStateFromSwitch(objTexts());
        await traiterObjection();
      }
    }
    const v = await verdict();
    return {
      prompt: buildGatedFullPrompt({ persona, offerData, stateManager: sm, voiceMode }),
      stateJson: sm.serialize(),
      meta: {
        confidence: sm.getConfidence(), turn: sm.getTurnCount(), fullModePhase: sm.getFullModePhase(),
        confidenceAtSwitch: sm.getConfidenceAtSwitch(), objectionState: sm.getObjectionState(), ...(v ? { verdictConclusion: v } : {}),
      },
    };
  }

  // ---- Diagnostic ----
  let justSwitched = false;
  if (commercialMessage && !p.skipHaiku) {
    if (sm.getFullModePhase() === "objections") {
      if (!sm.getObjectionState()) sm.initObjectionStateFromSwitch(objTexts());
    } else {
      const analysis = await sm.analyzeCommercialMessage(commercialMessage, rapide);
      sm.updateConfidence(analysis);
      justSwitched = sm.checkPhaseSwitch(analysis);
      if (justSwitched || (!justSwitched && sm.getHaikuCAnalysis() && sm.checkForceObjection(sm.getHaikuCAnalysis()!))) {
        let pcmScore: number | null = null;
        if (analysis.presentation_detected && persona.pcmType) pcmScore = await sm.scorePitchPcm(commercialMessage, persona.pcmType, rapide).catch(() => null);
        sm.initObjectionStateWithResistance(objTexts(), pcmScore);
        justSwitched = true;
      }
    }
  }
  if (sm.getFullModePhase() === "objections") {
    if (commercialMessage && !justSwitched && sm.getObjectionState() && !p.skipHaiku) await traiterObjection();
    const v = await verdict();
    return {
      prompt: buildGatedFullPrompt({ persona, offerData, stateManager: sm, voiceMode }),
      stateJson: sm.serialize(),
      meta: {
        confidence: sm.getConfidence(), turn: sm.getTurnCount(), fullModePhase: sm.getFullModePhase(),
        confidenceAtSwitch: sm.getConfidenceAtSwitch(), objectionState: sm.getObjectionState(), ...(v ? { verdictConclusion: v } : {}),
      },
    };
  }
  return {
    prompt: buildGatedDiagnosticPrompt({ persona, offerData, stateManager: sm, voiceMode, mode }),
    stateJson: sm.serialize(),
    meta: { confidence: sm.getConfidence(), turn: sm.getTurnCount(), pcmType: persona.pcmType },
  };
}

// La fenêtre glissante (simulation-limits.ts d'origine : 30) : les 60 derniers messages, le premier toujours « user ».
// v0.13 : un vrai appel R1 compte 134 prises de parole ; 60 messages = la moitié d'un appel, avec le cache des consignes.
export const MAX_HISTORY_MESSAGES = 60;
export function fenetreGlissante<T extends { role: "user" | "assistant"; content: string }>(msgs: T[]): T[] {
  if (msgs.length <= MAX_HISTORY_MESSAGES) return msgs;
  let s = msgs.slice(-MAX_HISTORY_MESSAGES);
  if (s[0]?.role === "assistant") s = [{ role: "user", content: "[Reprise de la conversation en cours]" } as T, ...s];
  return s;
}

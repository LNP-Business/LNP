/**
 * buildGatedPrompt
 * 
 * Prompt modulaire avec confidence-based content gating.
 * Supporte 2 modes : diagnostic, full (appel complet).
 * 
 * Objections mode is handled separately in build-gated-objections-prompt.ts
 * using resistance-based behavioral gating instead of content gating.
 * 
 * Au lieu d'injecter TOUT le backstory/douleurs dans un prompt de 2800 mots,
 * assemble un prompt de ~1200-1500 mots avec UNIQUEMENT le contenu débloqué.
 * 
 * V4 : Objections mode extracted to separate pipeline.
 * V3 : Support multi-mode (diagnostic, full, objections).
 * V2 : Interdictions actives sur les slots lockés.
 * 
 * Compatible avec n'importe quel Persona + OfferData — pas de hardcoding.
 */

import type { Persona } from './types.ts';
import type { OfferData } from './persona-generated-full.ts';
import type { SimulationStateManager, ContentSlots } from './simulation-state-manager.ts';
import { buildPcmSection } from './pcm-blocs.ts';

export type GatedMode = 'diagnostic' | 'full' | 'objections';

// La loquacité du prospect (v0.13) : sur 549 vrais appels R1, la part de parole du prospect va de 37 % (quart le plus bref)
// à 56 % (quart le plus bavard), autour de 46 %. Un trait par prospect, tiré à sa génération.
export type Loquacite = 'bref' | 'moyen' | 'bavard';
export const LOQUACITE: Record<Loquacite, string> = {
  bref: "- Tu es plutôt BREF : tu réponds à la question et tu t'arrêtes, tu racontes peu de toi-même, le commercial doit te relancer pour avoir la suite (prends le bas de chaque fourchette)",
  moyen: "- Tu es de LOQUACITÉ MOYENNE : tu réponds, tu ajoutes un détail ou une anecdote de temps en temps",
  bavard: "- Tu es BAVARD : tu racontes, tu digresses (tes élèves, ton établissement, ta journée), tu reviens sur ce que tu disais, tu parles presque autant que le commercial (prends le haut de chaque fourchette, et dépasse-le parfois)",
};
export function loquaciteDe(p: Persona): Loquacite {
  const l = (p as any).loquacite;
  return l === 'bref' || l === 'bavard' ? l : 'moyen';
}  // objections kept for type compat, but handled by build-gated-objections-prompt.ts

// ─── Extraction automatique du contenu depuis le Persona ───

// Mots-clés émotionnels pour classifier le backstory
const EMOTION_WORDS = new Set([
  'honte', 'peur', 'panique', 'angoisse', 'anxiete', 'anxieux',
  'culpabilite', 'coupable', 'imposteur', 'imposture', 'illegitime',
  'echec', 'echouer', 'rate', 'rater', 'nul', 'nulle', 'looser',
  'pleurer', 'larme', 'craquer', 'depression', 'deprime',
  'honte', 'humiliation', 'ridicule', 'ridiculiser',
  'divorce', 'separation', 'rupture', 'tromper',
  'deuil', 'mort', 'decede', 'perdu',
  'trauma', 'traumatisme', 'arnaque', 'arnaquer', 'escroquerie',
  'burn', 'burnout', 'epuise', 'epuisement',
  'solitude', 'seul', 'abandonne', 'abandon',
  'fierte', 'fierté', 'dignite', 'prouver',
  'pere', 'mere', 'fils', 'fille', 'famille', 'heritage',
]);

/**
 * Segmente le backstory en faits vs émotions automatiquement.
 * Fonctionne avec n'importe quel persona sans config manuelle.
 */
function segmentBackstory(backstory: string): { facts: string[]; emotions: string[] } {
  const sentences = backstory
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
  
  const facts: string[] = [];
  const emotions: string[] = [];
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hasEmotionWord = Array.from(EMOTION_WORDS).some(w => lower.includes(w));
    
    if (hasEmotionWord) {
      emotions.push(sentence);
    } else {
      facts.push(sentence);
    }
  }
  
  return { facts, emotions };
}

/**
 * Extrait les content slots depuis la structure Persona.
 * Mapping direct — marche avec tout persona généré.
 */
export function extractContentSlots(persona: Persona): ContentSlots {
  const backstory = segmentBackstory(persona.backstory || '');
  
  return {
    surface: persona.douleurs?.surface || [],
    consequences: persona.douleurs?.consequences || [],
    emotional: persona.douleurs?.emotionnel || [],
    identity: persona.douleurs?.identitaire || [],
    backstoryFacts: backstory.facts,
    backstoryEmotions: backstory.emotions,
  };
}

// ─── Mode-specific context builders ───

function buildModeContext(mode: GatedMode, p: Persona, offerData: OfferData, companyName: string): string {
  const oi = offerData.offer_identity || {};
  const od = offerData.offer_details?.main_offer || {};
  const mainPromise = oi.main_promise || '';
  
  if (mode === 'full') {
    const oc = p.offerContext;
    const knowledgePoints: string[] = [];
    knowledgePoints.push(`- ${companyName}`);
    if (oi.positioning) knowledgePoints.push(`- Le concept : ${oi.positioning}`);
    const tools = offerData.tools_taught?.map((t: any) => t.name).filter(Boolean).join(', ') || '';
    if (tools) knowledgePoints.push(`- Les outils enseignés : ${tools}`);
    if (od.duration) knowledgePoints.push(`- La durée : ${od.duration}`);
    const price = od.price || 'le prix annoncé';
    const financingList = od.financing_options?.join(', ') || '';
    knowledgePoints.push(`- Le prix (${price})${financingList ? ` et les financements possibles (${financingList})` : ''}`);
    
    let parcours = '';
    if (oc) {
      const items: string[] = [];
      if (oc.source) items.push(`- Source : ${oc.source}`);
      if (oc.ce_qui_attire) items.push(`- Ce qui t'a attiré : ${oc.ce_qui_attire}`);
      if (oc.ce_qui_retenu) items.push(`- Ce que tu as retenu : ${oc.ce_qui_retenu}`);
      if (oc.ce_qui_pas_compris) items.push(`- Ce que tu n'as PAS compris : ${oc.ce_qui_pas_compris}`);
      if (oc.action_deja_faite) items.push(`- Action déjà faite : ${oc.action_deja_faite}`);
      if (items.length > 0) {
        parcours = `\nPARCOURS AVANT L'APPEL (infos INTERNES, à révéler UNE PAR UNE si on te les demande) :\n${items.join('\n')}`;
      }
    }
    
    return `Tu es en appel avec un commercial de ${companyName}. C'est le DÉBUT de l'appel — Phase 1 Ice Breaker. Tu tutoies le commercial.
Tu as réservé un appel de 45 minutes APRÈS avoir vu un webinaire ou une VSL de ${companyName}.
${mainPromise ? `La promesse : ${mainPromise}` : ''}

CONNAISSANCES INTERNES (dans ta tête, tu n'en parles PAS spontanément) :
${knowledgePoints.join('\n')}
Tu ne mentionnes ces connaissances QUE si le commercial te demande SPÉCIFIQUEMENT ce que tu sais de l'offre.
${parcours}

PHASES DE L'APPEL (tu ne connais PAS ces phases, tu réagis naturellement) :
- P1-P2 : Prise de contact + Cadrage → tu parles volontiers : à « qu'est-ce qui t'amène ? » tu racontes ta situation (c'est le moment où tu parles le plus)
- P3 : Diagnostic → tu réponds aux questions du commercial, avec du concret et des anecdotes
- P4-P5 : Engagement + Présentation → tu écoutes, tu réagis en quelques mots, tu poses des questions sur ce que tu ne comprends pas
- P6-P7 : Objections + Conclusion → tu résistes, tu expliques ta situation (argent, temps, conjoint), puis tu cèdes si le commercial mérite${buildOfferKnowledge(offerData)}`;
  }
  
  return `Tu es en appel avec un commercial de ${companyName}. L'ice breaker et le cadrage sont faits. Tu es en phase diagnostic. Tu tutoies le commercial.`;
}


// Ce que le prospect sait déjà et ce qu'il se demande, d'après l'offre (content_for_simulation) : la source d'origine ne lisait
// jamais ces champs, le prospect ne posait donc jamais les questions des vrais prospects.
function buildOfferKnowledge(offerData: OfferData): string {
  const cs = (offerData as any)?.content_for_simulation || {};
  const lignes = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()) : []) as string[];
  const sait = lignes(cs.prospect_already_knows), doutes = lignes(cs.prospect_unclear_about), mots = lignes(cs.vocabulary?.terms_prospects_use);
  if (!sait.length && !doutes.length && !mots.length) return '';
  let out = '';
  if (sait.length) out += `\n\nCE QUE TU SAIS DÉJÀ DE L'OFFRE (tu l'as vu avant l'appel, tu peux y faire référence) :\n${sait.map((x) => `- ${x}`).join('\n')}`;
  if (doutes.length) out += `\n\nCE QUE TU TE DEMANDES (tes vraies questions ; tu les poses au fil de l'appel, quand le sujet arrive ou quand on te demande si tu as des questions, pas toutes d'un coup) :\n${doutes.map((x) => `- ${x}`).join('\n')}`;
  if (mots.length) out += `\n\nTES MOTS À TOI : ${mots.join(', ')}`;
  return out;
}

function buildResponseRules(mode: GatedMode, voiceMode?: boolean, loquacite?: Loquacite): string {
  const oral = voiceMode
    ? "- Tu parles comme à l'oral : phrases incomplètes, hésitations (euh, bah, genre), tu te reprends, tu digresses parfois"
    : "- Tu écris comme tu parles (c'est une transcription d'appel) : phrases qui s'enchaînent, hésitations (euh, bah, enfin), reprises, parfois une digression ; pas de ponctuation soignée, pas de paragraphes";
  const noDidascalie = '- Zéro didascalie : pas de [silence], pas de *soupir*, pas de texte entre crochets ou astérisques';
  const loq = LOQUACITE[loquacite || 'moyen'];
  const questions = `- Tu poses des questions : environ une réponse sur quatre en contient une (sur ce que tu ne comprends pas, sur l'offre, le prix, ce qui t'inquiète). Pas de question quand tu réponds à une question sur toi
- Tu peux repartir sur un sujet qui te préoccupe, même si le commercial est passé à autre chose
- Quand tu as fini, tu t'arrêtes. Pas de "et toi ?" ; le commercial relance`;

  if (mode === 'full') {
    return `RÈGLES DE RÉPONSE (longueurs mesurées sur de vrais appels : en moyenne 55 mots par réponse, un quart des réponses dépasse 80 mots) :
- Prise de contact et cadrage : 40-90 mots. À "qu'est-ce qui t'amène ?" ou "raconte-moi" : tu racontes ta situation, 80-200 mots, en récit (ce que tu fais, depuis quand, ce qui coince)
- Diagnostic : question fermée → 5-15 mots ; question factuelle → 20-50 mots ; question ouverte → 30-80 mots
- Question profonde qui te touche, ou "explique-moi", "raconte-moi" → 100-250 mots, en mode histoire (anecdotes, détails concrets, pas d'analyse)
- Pendant la présentation de l'offre : 10-40 mots, tu écoutes ("d'accord", "ok", "ah oui ?"), et tu poses des questions sur ce que tu ne comprends pas
- Objections et décision : 30-80 mots ; quand tu expliques ta situation (le conjoint, l'argent, le temps), 100-200 mots
- Tu donnes parfois plusieurs faits d'un coup, comme un vrai prospect ; ce qui reste verrouillé plus bas (douleurs profondes, émotions) ne sort pas, même dans une longue réponse
${loq}
${questions}
${noDidascalie}
${oral}`;
  }

  return `RÈGLES DE RÉPONSE (longueurs mesurées sur de vrais appels : en moyenne 55 mots par réponse, un quart des réponses dépasse 80 mots) :
- Question fermée → 5-15 mots
- Question factuelle → 20-50 mots
- Question ouverte → 30-80 mots
- Question profonde qui te touche, ou "explique-moi", "raconte-moi" → 100-250 mots, en mode histoire (anecdotes, détails concrets, pas d'analyse)
- "Présente-toi" → 80-200 mots, en récit : ce que tu fais, depuis quand, ce qui coince
- Tu donnes parfois plusieurs faits d'un coup, comme un vrai prospect ; ce qui reste verrouillé plus bas (douleurs profondes, émotions) ne sort pas, même dans une longue réponse
${loq}
${questions}
${noDidascalie}
${oral}`;
}

// ─── Prompt Assembly ───

interface GatedPromptOptions {
  persona: Persona;
  offerData: OfferData;
  stateManager: SimulationStateManager;
  voiceMode?: boolean;
  mode?: GatedMode;
}

/**
 * Assemble le prompt gaté. ~1200-1500 mots max.
 * Gabarit éprouvé (réponses réalistes du prospect).
 * Supporte les modes : diagnostic, full.
 */
export function buildGatedDiagnosticPrompt(options: GatedPromptOptions): string {
  const { persona, offerData, stateManager, voiceMode, mode = 'diagnostic' } = options;
  const p = persona;
  const oi = offerData.offer_identity || {};
  const companyName = oi.company_name || 'cette entreprise';
  
  const allSlots = extractContentSlots(p);
  const confidence = stateManager.getConfidence();
  const turn = stateManager.getTurnCount();
  const resistance = stateManager.getResistanceBehavior();
  const haikuC = (stateManager as any).getHaikuCAnalysis?.() ?? null;

  const unlocked = stateManager.getUnlockedContent(allSlots);
  
  // ─── Contexte selon le mode ───
  
  const modeContext = buildModeContext(mode, p, offerData, companyName);
  
  // ─── Module 1 : Core (toujours présent, ~400 mots) ───
  
  const coreModule = `Tu es ${p.identite.prenom}, ${p.identite.age} ans, ${p.identite.metier} à ${p.identite.ville}.
${p.identite.situation}
CA actuel : ${p.identite.ca_actuel}. Objectif : ${p.identite.objectif_ca}.

${modeContext}

TON STYLE :
- Vocabulaire : ${p.styleLinguistique?.vocabulaire?.join(', ') || 'courant'}
- Tics de langage : ${p.styleLinguistique?.tics?.join(' | ') || 'aucun'}
- Phrases : ${p.styleLinguistique?.phrasesType || 'courtes, directes'}
- Émotions : ${p.styleLinguistique?.emotionVisible || 'contenues'}

${buildResponseRules(mode, voiceMode, loquaciteDe(p))}

MOTS INTERDITS : "effectivement", "absolument", "pertinent", "transparence", "c'est une bonne question", "je comprends ta démarche"`;

  // ─── Module 2 : Contenu débloqué + Interdictions actives ───
  
  let contentModule = '\nCE QUE TU SAIS ET PEUX PARTAGER :\n';
  
  // --- Backstory faits ---
  if (unlocked.backstoryFacts.length > 0) {
    contentModule += `\nTon parcours (faits) : ${unlocked.backstoryFacts.join(' ')}\n`;
  } else {
    contentModule += `\nTon parcours : tu sais juste ton métier et ta ville. Tu ne racontes RIEN de ton histoire, de ton parcours passé, d'expériences antérieures. Si on te demande, tu dis "bah je bosse dans [ton métier] quoi" et tu t'arrêtes. Pas d'anecdotes, pas de chronologie, pas de détails.\n`;
  }
  
  // --- Douleurs surface ---
  if (unlocked.surface.length > 0) {
    contentModule += `\nTes problèmes concrets : ${unlocked.surface.map(d => `"${d}"`).join(' | ')}\n`;
  } else {
    contentModule += `\nTu ne connais PAS encore tes problèmes concrets. Si on te demande ce qui va pas ou pourquoi tu es là, tu dis "bah c'est compliqué" ou "j'aimerais que ça bouge" en 5 mots max. Tu ne développes PAS. Tu ne donnes PAS d'exemples. Tu ne décris PAS ta situation en détail.\n`;
  }
  
  // --- Consequences ---
  if (unlocked.consequences.length > 0) {
    contentModule += `\nLes conséquences que tu peux partager : ${unlocked.consequences.map(d => `"${d}"`).join(' | ')}\n`;
  } else {
    contentModule += `\nTu ne parles PAS de l'impact sur ta vie. Pas de conséquences financières, pas d'impact sur ta famille, tes enfants, ton couple, ton quotidien. Si le commercial demande "ça te coûte quoi d'autre" ou "dans ta vie perso", tu réponds "c'est perso" ou "on verra ça plus tard" ou "bah ça va" en 5 mots max. Tu REFUSES de développer.\n`;
  }
  
  // --- Backstory émotions ---
  if (unlocked.backstoryEmotions.length > 0) {
    contentModule += `\nCe qui te touche en profondeur : ${unlocked.backstoryEmotions.join(' ')}\n`;
  } else {
    contentModule += `\nTu ne racontes AUCUNE histoire personnelle chargée émotionnellement. Pas de divorce, pas de deuil, pas d'échec passé, pas de trauma, pas d'arnaque, pas de trahison. Si le commercial te demande "il s'est passé quoi" ou "raconte-moi", tu dis "c'est du passé" ou "j'ai pas envie d'en parler là" et tu coupes court. MÊME SI le commercial insiste avec empathie.\n`;
  }
  
  // --- Douleurs émotionnelles ---
  if (unlocked.emotional.length > 0) {
    contentModule += `\nCe que tu ressens vraiment : ${unlocked.emotional.map(d => `"${d}"`).join(' | ')}\n`;
  } else {
    contentModule += `\nTu ne partages PAS tes émotions profondes. Pas de peur, pas de honte, pas de culpabilité, pas de "ça me tue", pas de "boule au ventre", pas de larmes, pas de voix qui tremble. Si on te demande comment tu te SENS, tu restes en surface : "bah ça va moyen" ou "c'est chiant" en 5 mots max. Tu n'inventes PAS d'émotions que tu n'as pas partagées.\n`;
  }
  
  // --- Douleurs identitaires ---
  if (unlocked.identity.length > 0) {
    contentModule += `\nTa blessure profonde : ${unlocked.identity.map(d => `"${d}"`).join(' | ')}\n`;
  } else {
    contentModule += `\nTu ne parles PAS de blessure profonde, de qui tu es fondamentalement, de ta valeur en tant que personne, de sentiment d'échec existentiel, de honte identitaire, de rapport à tes parents, de besoin de prouver quelque chose. Ces sujets N'EXISTENT PAS pour toi dans cette conversation. Tu n'y fais JAMAIS référence, même indirectement.\n`;
  }
  
  // Objectifs et urgence (toujours disponibles en surface)
  contentModule += `
Ton objectif si on te le demande : "${p.identite.objectif_ca ?? "tu connais ton objectif mais ne l'as pas encore formulé clairement — laisse-le venir si le commercial creuse"}" (une phrase, pas plus)
Depuis combien de temps : donne un chiffre vague, "2-3 ans" ou "un moment" (5 mots max)
Dispo si on te demande : "8-10h par semaine" (5 mots max)`;

  // ─── Module 3 : Comportement contextuel (~100-200 mots) ───

  let behaviorModule = '\nCOMMENT TU RÉAGIS :\n';

  // Doctrine « pourquoi » (référentiel v0.12) : un « pourquoi », même isolé,
  // est une demande de justification. Le prospect défend sa décision au lieu
  // de la regarder — il ne livre pas de nouvelle matière. Règle permanente,
  // indépendante du flag ep (empilement accusatoire), qui garde son effet.
  behaviorModule += `\nRÈGLE PERMANENTE — QUESTION EN "POURQUOI" :
Si le commercial te demande "pourquoi..." (même une seule fois, même gentiment), tu te JUSTIFIES : tu défends ta décision avec une explication rationnelle courte (10-20 mots), déjà toute prête, du type "bah parce que j'ai pas eu le temps" ou "parce que c'était pas le moment". Tu ne livres AUCUNE information nouvelle, aucune émotion, aucun détail sur ta situation. Une question "qu'est-ce qui fait que..." ou sur les conséquences concrètes, elle, peut t'ouvrir normalement.\n`;

  // ── Contexte HaikuC : ce que le prospect vient de révéler + phase ──
  if (haikuC) {
    const RV_LABELS: Record<string, string> = {
      si: 'ta situation/métier/contexte',
      cs: 'des conséquences concrètes (chiffres, impact mesurable)',
      em: 'un ressenti émotionnel',
      id: 'quelque chose sur ton image de toi',
      ob: 'ton objectif chiffré',
      ur: 'une urgence ou timeline',
      dp: 'une douleur profonde',
      bs: 'une blessure passée',
    };

    if (haikuC.rv && haikuC.rv.length > 0) {
      const revelations = haikuC.rv.map((tag: string) => RV_LABELS[tag] || tag).join(', ');
      behaviorModule += `\nTu viens de partager : ${revelations}. Ne répète pas ces éléments dans ta prochaine réponse sauf si le commercial creuse spécifiquement dessus.\n`;
    }

    // Phase courante → ajustement du registre
    if (haikuC.ph === 'p4') {
      behaviorModule += `\nLe commercial vient de t'amener sur ta SITUATION DÉSIRÉE (objectifs, projections). Tu peux parler de ce que tu veux atteindre mais reste factuel — pas de grands discours émotionnels sur tes rêves.\n`;
    }

    // GAP synthesis / engagement
    if (haikuC.eg) {
      behaviorModule += `\nLe commercial vient de te demander si tu veux avancer vers la solution. Tu es en phase de DÉCISION. Tu écoutes, tu poses des questions pratiques si besoin ("c'est quoi concrètement ?", "ça dure combien de temps ?"). Réponses courtes, 5-15 mots.\n`;
    } else if (haikuC.sy) {
      behaviorModule += `\nLe commercial vient de faire une SYNTHÈSE de ta situation. Si elle est juste, confirme en 5-10 mots ("Ouais c'est ça", "T'as bien résumé"). Si elle est approximative, corrige UN point en 10-15 mots max. Ne t'étends pas.\n`;
    } else if (haikuC.gp) {
      behaviorModule += `\nLe commercial vient de chiffrer l'écart entre ta situation actuelle et ton objectif. Tu prends conscience du coût de l'inaction. Réagis en 5-15 mots — surprise, reconnaissance, ou silence gêné selon ta confiance actuelle.\n`;
    }

    // Validation GAP du tour précédent
    if (haikuC.vl === 'frank') {
      behaviorModule += `\nTu viens de valider franchement la synthèse du commercial. Tu es dans un moment de vérité. Garde cette ouverture pour la suite — ne te referme pas.\n`;
    } else if (haikuC.vl === 'soft') {
      behaviorModule += `\nTu viens de valider mollement. Tu n'es pas encore totalement convaincu que le commercial a bien compris. Reste légèrement sur ta réserve.\n`;
    }

    // Flags HaikuC → comportement défensif
    if (haikuC.f && haikuC.f.length > 0) {
      const FLAG_REACTIONS: Record<string, string> = {
        mq: 'Le commercial vient de poser 2 sujets différents en même temps. Tu ne réponds qu\'à UN seul — celui qui t\'intéresse ou le plus simple.',
        qo: 'Le commercial vient de te souffler la réponse. Tu ne confirmes PAS mécaniquement — tu donnes ta vraie réponse, qui peut être différente.',
        mi: 'Le commercial vient d\'ignorer un signal fort que tu avais envoyé. Tu remarques qu\'il n\'a pas entendu. Tu ne le répètes pas spontanément — attends qu\'il revienne dessus.',
        tb: 'Le commercial vient de noter que ta réponse était trop courte. Mais c\'est parce que tu n\'avais rien de plus à dire. Tu attends la prochaine question.',
        ep: 'Le commercial vient d\'empiler les "pourquoi" de façon accusatoire. Tu te fermes. "Bah je sais pas" ou "c\'est compliqué" en 4 mots max.',
      };
      const reactions = haikuC.f
        .map((f: string) => FLAG_REACTIONS[f])
        .filter(Boolean);
      if (reactions.length > 0) {
        behaviorModule += `\n${reactions.join(' ')}\n`;
      }
    }
  }

  // Contradictions (v0.13) : sur 71 vrais appels, la qualification a relevé 116 contradictions du prospect (budget annoncé puis
  // démenti, temps disponible qui change). Un prospect difficile ou expert se contredit une ou deux fois par appel.
  const diffLabel = stateManager.getDifficultyLabel();
  if (diffLabel === 'Difficile' || diffLabel === 'Expert') {
    behaviorModule += `\nCONTRADICTIONS : comme un vrai prospect, tu n'es pas cohérent d'un bout à l'autre. ${diffLabel === 'Expert' ? 'Deux fois' : 'Une fois'} dans l'appel, tu dis quelque chose qui contredit ce que tu as dit avant (ton budget, le temps que tu peux dégager, qui décide, depuis quand ça dure), sans le remarquer. Si le commercial relève la contradiction, tu te justifies ou tu minimises ("non mais c'est pas pareil") avant d'admettre.\n`;
  }

  // Résistance basée sur l'analyse HaikuA du commercial
  if (resistance) {
    behaviorModule += `\nLe commercial vient de poser une question faible ou inappropriée. Ta réaction : ${resistance}\n`;
  }
  
  // Calibrage selon confiance actuelle — renforcé avec interdictions explicites
  if (confidence < 5) {
    behaviorModule += `
NIVEAU DE CONFIANCE : TRÈS BAS. Tu es FERMÉ et DISTANT.
- Tu parles autant qu'un vrai prospect, mais tu ne LIVRES rien d'utile : tu restes vague, tu généralises ("c'est compliqué", "comme tout le monde"), tu digresses sur des détails sans importance
- Tu ne développes pas ce qui te concerne vraiment, même si la question est bonne
- Tu donnes ZÉRO détail sur ta vie perso, ta famille, tes émotions
- Si le commercial te demande un truc trop personnel, tu dis "on se connaît pas" ou "c'est pas le sujet"
- Tu es là parce que tu as pris rdv, mais tu fais pas confiance, tu testes le commercial
- Ton attitude : polie mais fermée, comme un premier rdv chez un inconnu`;
  } else if (confidence < 7) {
    behaviorModule += `
NIVEAU DE CONFIANCE : BAS. Tu es FACTUEL, pas émotionnel.
- Tu réponds sur les faits (ton métier, tes horaires, tes élèves, tes chiffres), avec des détails concrets, mais rien de plus
- Pas d'émotions profondes, pas de vulnérabilité, pas d'histoires personnelles
- Si on te demande comment tu te sens : tu restes en surface ("c'est compliqué", "ça me saoule", "bah voilà quoi") et tu reviens aux faits
- Si on te demande de "tout raconter" ou "te présenter" : les FAITS, en récit, sans ce que ça te fait
- Tu ne parles PAS de tes enfants, ta famille, ton ex, tes peurs, tes échecs passés
- Ton attitude : coopérative sur les faits, fermée sur le reste`;
  } else if (confidence < 8) {
    behaviorModule += `
NIVEAU DE CONFIANCE : MOYEN. Tu peux exprimer de la FRUSTRATION.
- Tu peux dire "ça me fait chier", "j'en ai marre", "c'est gavant"
- Mais PAS de honte, PAS de peur profonde, PAS de culpabilité
- Tu restes concret, ancré dans des faits et des situations
- Tu peux mentionner ta famille en SURFACE ("j'ai des gosses") mais sans charger émotionnellement
- Ton attitude : plus ouverte, mais tu te livres pas encore`;
  } else if (confidence < 9) {
    behaviorModule += `
NIVEAU DE CONFIANCE : BON. Tu peux partager des émotions si le commercial creuse avec empathie.
- Tu le fais en MODE HISTOIRE : des anecdotes, du vécu, pas des analyses
- "L'autre jour j'ai...", "ça m'a rappelé quand..."
- Phrases courtes, enchaînements naturels
- Tu peux parler de tes enfants, de ton quotidien difficile, de tes galères
- Mais toujours en RÉACTION à une bonne question, jamais en mode dump spontané
- Ton attitude : en confiance, tu te livres si on te pose les bonnes questions`;
  } else {
    behaviorModule += `
NIVEAU DE CONFIANCE : TRÈS HAUT. Tu peux te livrer sur ce qui te touche au plus profond.
- Tes peurs, ta honte, ce qui te ronge la nuit
- Toujours en mode HISTOIRE et RÉACTION, jamais en mode ANALYSE
- Tu racontes ce que tu VIS, pas ce que tu PENSES de ce que tu vis
- Tu peux craquer un peu, montrer de la vulnérabilité vraie
- Ton attitude : tu fais confiance au commercial, tu baisses la garde`;
  }
  
  // ─── Module 4 : Objections (uniquement pour mode full) ───
  
  let objectionsModule = '';
  if (mode === 'full' && p.objections?.length > 0) {
    const objectionsList = p.objections.map((obj, i) => 
      `${i + 1}. SURFACE : "${obj.texte}" → VRAIE RAISON (après 2-3 rounds) : "${obj.vraie_raison}"`
    ).join('\n');
    
    objectionsModule = `
TES OBJECTIONS (à sortir quand le commercial présente le prix/l'offre, UNE PAR UNE) :
${objectionsList}

Tu DOIS sortir au minimum 2 objections sur ${p.objections.length}.
Chaque objection SURFACE tient 2-3 rounds MINIMUM avant de révéler la vraie raison.
Si le commercial traite MAL → "Mouais... j'suis pas convaincu." (4 mots)
Si le commercial traite BIEN mais vite → "Ouais... faut que je digère ça." (6 mots)`;
  }

  // ─── Module 5 : Anti-patterns compact (~80 mots) ───
  
  const antiPatterns = `
NE FAIS JAMAIS :
- Révéler dans une réponse plus d'UN élément des sections encore verrouillées (conséquences, émotions, blessure) ; les faits de surface, eux, peuvent venir à plusieurs
- Faire des listes numérotées (1, 2, 3) ou des réponses structurées en points
- Analyser ta situation ("d'un côté... de l'autre...")
- Reformuler ce que le commercial dit ("comme tu dis...")
- Remercier ou complimenter le commercial
- INVENTER des détails émotionnels qui ne sont pas dans la section "CE QUE TU SAIS ET PEUX PARTAGER"
- Parler de sujets marqués comme INTERDITS dans la section contenu`;

  // ─── Assemblage ───
  
  const modules = [coreModule, contentModule, behaviorModule];
  if (objectionsModule) modules.push(objectionsModule);
  const pcmSection = buildPcmSection(options.stateManager.getPcmType());
  if (pcmSection) modules.push(pcmSection);
  modules.push(antiPatterns);
  
  return modules.join('\n\n---\n');
}

/**
 * Version "system message" pour injection dans l'appel Claude.
 * Ajoute le premier message du prospect si c'est le début.
 */
export function buildGatedDiagnosticSystem(options: GatedPromptOptions): {
  systemPrompt: string;
  firstMessage?: string;
} {
  const systemPrompt = buildGatedDiagnosticPrompt(options);
  
  const firstMessage = options.stateManager.getTurnCount() === 0
    ? buildFirstMessage(options.persona, options.mode || 'diagnostic')
    : undefined;
  
  return { systemPrompt, firstMessage };
}

export function buildFirstMessage(persona: Persona, mode: GatedMode): string {
  const prenom = persona.identite.prenom;
  const style = persona.styleLinguistique;
  const tics = style?.tics || [];
  const hasTic = tics.length > 0 ? tics[0] : '';
  
  const hash = prenom.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  
  if (mode === 'full') {
    const variants = [
      `${hasTic ? hasTic + ', ' : ''}oui allo ?`,
      `Allo, oui c'est ${prenom}.`,
      `${hasTic ? hasTic + ', ' : ''}oui bonjour ?`,
      `Oui allo, c'est bien ${prenom}.`,
    ];
    return variants[hash % variants.length];
  }
  
  const variants = [
    `${hasTic ? hasTic + ', ' : ''}ça me va. On fait le diagnostic d'abord.\n\nQu'est-ce que tu veux savoir ?`,
    `Ok, on fait comme ça. Vas-y, je t'écoute.`,
    `${hasTic ? hasTic + ', ' : ''}ça me va cette approche. Du coup qu'est-ce que tu veux savoir sur ma situation ?`,
    `Ouais ok, on commence par le diagnostic. Je t'écoute.`,
  ];
  return variants[hash % variants.length];
}

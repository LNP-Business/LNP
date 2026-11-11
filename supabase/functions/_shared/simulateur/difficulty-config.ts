/**
 * difficulty-config.ts
 *
 * Paramètres de difficulté du prospect simulé.
 * Ajoute : novel_argument tracking, flag increases, maxDropPerTurn cap,
 * resistanceDropMultiplier, maxActiveObjections, transitions, cooldown confidence.
 */

// ─── Interfaces ───────────────────────────────────────────────

export interface ObjectionResistanceConfig {
  // Drops (bons comportements — valeurs négatives)
  accueillir_empathique: number;
  accueillir_mecanique: number;
  isoler: number;
  challenger_pertinent: number;
  challenger_faible: number;
  gap_used: number;
  success_story: number;
  addresses_objection: number;  // ao:true → drop
  novel_argument: number;       // argument non répété → bonus drop

  // Increases (mauvais comportements — valeurs positives)
  flag_pressure: number;         // pr: pression
  flag_dismisses: number;        // di: minimise l'objection
  flag_ignores_emotion: number;  // ig: ignore l'émotion
  flag_jumps_close: number;      // jc: conclusion prématuré
  flag_repeats: number;          // re: répète le même argument
  not_addressing: number;        // ao:false + od:true → pénalité
}

export interface ObjectionsConfig {
  minRoundsPerObjection: number;
  minObjectionsToRaise: number;
  startingResistance: number;
  resolveThreshold: number;       // résolu quand résistance <= ce seuil
  minResistance: number;
  maxDropPerTurn: number;         // cap drop total par tour (ex: -2)
  bonusDropForUg: number;         // drop bonus si ug:true (s'ajoute au cap)
  resistanceDropMultiplier: number; // multiplicateur global des drops
  maxActiveObjections: number;    // nb max d'objections du pool actif
  minTurnsBeforeNextObjection: number;  // délai min après résolution
  maxTurnsBeforeNextObjection: number;  // délai max avant next objection
  maxRoundsPerObjection: number;        // abandon auto si trop de rounds
  resistanceDecay: ObjectionResistanceConfig;
}

export interface ConfidenceConfig {
  maxGainPerTurn: number;           // plafond absolu de gain par tour
  gainMultiplier: number;           // ×gains selon difficulté
  penaltyMultiplier: number;        // ×pénalités selon difficulté
  cooldownTurns: number;            // tours de cooldown après flag
  maxGainDuringCooldown: number;    // gain max pendant cooldown
}

export interface DifficultyConfig {
  label: string;
  startingConfidence: number;
  maxConfidence: number;
  maxGainPerWindow: number;
  windowSize: number;
  confidence: ConfidenceConfig;
  points: {
    reformulation_accurate: number;
    reformulation_partial: number;
    open_question_relevant: number;
    open_question_generic: number;
    empathy_authentic: number;
    empathy_generic: number;
    good_transition: number;
    // Pénalités HaikuA flags
    red_flag_price_early: number;
    red_flag_formation_early: number;
    red_flag_pressure: number;
    closed_question_chain: number;
    poor_listening: number;
    // Gains HaikuC (signal extractor)
    haikuC_open_question: number;
    haikuC_factual_question: number;
    haikuC_validation_frank: number;
  };
  thresholds: {
    surface: number;
    consequences: number;
    emotional: number;
    identity: number;
    backstory_facts: number;
    backstory_emotions: number;
  };
  // Double gate confidence+turn pour débloquer le contenu profond
  depthTurnGates: {
    surface: number;
    consequences: number;
    emotional: number;
    identity: number;
  };
  resistance: {
    on_weak_question: string;
    on_red_flag: string;
    on_dump_request: string;
  };
  objections: ObjectionsConfig;
}

// ─── Configs par niveau ────────────────────────────────────────

// Valeurs de résistance communes (calibrées dans le simulateur)
const BASE_RESISTANCE_DECAY: ObjectionResistanceConfig = {
  accueillir_empathique: -0.5,
  accueillir_mecanique:  -0.25,
  isoler:                -0.5,
  challenger_pertinent:  -1.5,
  challenger_faible:     -0.5,
  gap_used:              -0.5,
  success_story:         -0.5,
  addresses_objection:   -0.25,
  novel_argument:        -0.5,
  // Increases
  flag_pressure:         1.5,
  flag_dismisses:        1.0,
  flag_ignores_emotion:  2.0,
  flag_jumps_close:      2.0,
  flag_repeats:          0.5,
  not_addressing:        0.5,
};

export const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {

  moyen: {
    label: 'Moyen',
    startingConfidence: 6,
    maxConfidence: 10,
    maxGainPerWindow: 2.0,
    windowSize: 5,
    confidence: {
      maxGainPerTurn: 0.8,
      gainMultiplier: 1.0,
      penaltyMultiplier: 1.0,
      cooldownTurns: 2,
      maxGainDuringCooldown: 0.5,
    },
    points: {
      reformulation_accurate: 0.20,
      reformulation_partial: 0.10,
      open_question_relevant: 0.30,
      open_question_generic: 0.10,
      empathy_authentic: 0.20,
      empathy_generic: 0.05,
      good_transition: 0.10,
      red_flag_price_early: -1.5,
      red_flag_formation_early: -0.5,
      red_flag_pressure: -1.5,
      closed_question_chain: -0.75,
      poor_listening: -1.5,
      haikuC_open_question: 0.40,
      haikuC_factual_question: 0.25,
      haikuC_validation_frank: 0.35,
    },
    thresholds: {
      surface: 5,
      consequences: 6,
      emotional: 7,
      identity: 8.5,
      backstory_facts: 5,
      backstory_emotions: 7,
    },
    depthTurnGates: {
      surface: 0,
      consequences: 3,
      emotional: 5,
      identity: 8,
    },
    resistance: {
      on_weak_question: 'Tu réponds quand même, juste plus court. "Ouais c\'est compliqué." (3-5 mots)',
      on_red_flag: 'Tu fronces les sourcils. "On en est pas encore là non ?" Puis tu attends.',
      on_dump_request: 'Tu donnes un résumé factuel de 2 phrases max et tu attends les questions.',
    },
    objections: {
      minRoundsPerObjection: 2,
      minObjectionsToRaise: 2,
      startingResistance: 6,
      resolveThreshold: 0,
      minResistance: 0,
      maxDropPerTurn: -2,
      bonusDropForUg: -1,
      resistanceDropMultiplier: 1.0,
      maxActiveObjections: 2,
      minTurnsBeforeNextObjection: 1,
      maxTurnsBeforeNextObjection: 2,
      maxRoundsPerObjection: 8,
      resistanceDecay: BASE_RESISTANCE_DECAY,
    },
  },

  difficile: {
    label: 'Difficile',
    startingConfidence: 6,
    maxConfidence: 8.5,
    maxGainPerWindow: 1.5,
    windowSize: 5,
    confidence: {
      maxGainPerTurn: 0.8,
      gainMultiplier: 0.7,
      penaltyMultiplier: 1.3,
      cooldownTurns: 2,
      maxGainDuringCooldown: 0.4,
    },
    points: {
      reformulation_accurate: 0.20,
      reformulation_partial: 0.10,
      open_question_relevant: 0.30,
      open_question_generic: 0.05,
      empathy_authentic: 0.20,
      empathy_generic: 0.05,
      good_transition: 0.10,
      red_flag_price_early: -1.5,
      red_flag_formation_early: -0.8,
      red_flag_pressure: -1.5,
      closed_question_chain: -0.75,
      poor_listening: -1.5,
      haikuC_open_question: 0.40,
      haikuC_factual_question: 0.25,
      haikuC_validation_frank: 0.35,
    },
    thresholds: {
      surface: 5,
      consequences: 6.5,
      emotional: 7.5,
      identity: 9,
      backstory_facts: 5,
      backstory_emotions: 7.5,
    },
    depthTurnGates: {
      surface: 0,
      consequences: 4,
      emotional: 7,
      identity: 10,
    },
    resistance: {
      on_weak_question: 'Tu restes vague. "Bah c\'est-à-dire... c\'est compliqué quoi." Tu ne développes pas.',
      on_red_flag: 'Tu recules. "Attends, on parlait de ma situation là, pourquoi tu me parles de ça ?"',
      on_dump_request: 'Tu donnes un résumé factuel de 2 phrases et tu dis "voilà" pour couper court.',
    },
    objections: {
      minRoundsPerObjection: 3,
      minObjectionsToRaise: 2,
      startingResistance: 7,
      resolveThreshold: 0,
      minResistance: 0,
      maxDropPerTurn: -2,
      bonusDropForUg: -1,
      resistanceDropMultiplier: 0.7,
      maxActiveObjections: 2,
      minTurnsBeforeNextObjection: 1,
      maxTurnsBeforeNextObjection: 2,
      maxRoundsPerObjection: 8,
      resistanceDecay: BASE_RESISTANCE_DECAY,
    },
  },

  expert: {
    label: 'Expert',
    startingConfidence: 5,
    maxConfidence: 7.5,
    maxGainPerWindow: 1.2,
    windowSize: 5,
    confidence: {
      maxGainPerTurn: 0.8,
      gainMultiplier: 0.65,
      penaltyMultiplier: 1.3,
      cooldownTurns: 2,
      maxGainDuringCooldown: 0.3,
    },
    points: {
      reformulation_accurate: 0.20,
      reformulation_partial: 0.10,
      open_question_relevant: 0.30,
      open_question_generic: 0.0,
      empathy_authentic: 0.20,
      empathy_generic: 0.0,
      good_transition: 0.10,
      red_flag_price_early: -2.0,
      red_flag_formation_early: -1.0,
      red_flag_pressure: -1.5,
      closed_question_chain: -0.75,
      poor_listening: -1.5,
      haikuC_open_question: 0.40,
      haikuC_factual_question: 0.25,
      haikuC_validation_frank: 0.35,
    },
    thresholds: {
      surface: 5,
      consequences: 7,
      emotional: 8,
      identity: 9.5,
      backstory_facts: 5,
      backstory_emotions: 8,
    },
    depthTurnGates: {
      surface: 0,
      consequences: 5,
      emotional: 9,
      identity: 15,
    },
    resistance: {
      on_weak_question: 'Tu challenges. "Je vois pas le rapport avec ma question." Tu forces le commercial à reformuler.',
      on_red_flag: 'Tu te fermes. "Eh oh, on se connaît depuis 5 minutes là. On en est pas du tout là."',
      on_dump_request: 'Tu donnes UNE phrase factuelle et tu dis "c\'est tout" ou "voilà en gros".',
    },
    objections: {
      minRoundsPerObjection: 4,
      minObjectionsToRaise: 3,
      startingResistance: 9,
      resolveThreshold: 0,
      minResistance: 0,
      maxDropPerTurn: -2,
      bonusDropForUg: -1,
      resistanceDropMultiplier: 0.55,
      maxActiveObjections: 4,
      minTurnsBeforeNextObjection: 1,
      maxTurnsBeforeNextObjection: 2,
      maxRoundsPerObjection: 8,
      resistanceDecay: BASE_RESISTANCE_DECAY,
    },
  },
};

// ─── Résolution difficulté ─────────────────────────────────────

export function getDifficultyConfig(level?: string | number): DifficultyConfig {
  if (!level) return DIFFICULTY_CONFIGS.moyen;

  const normalized = String(level).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const mapping: Record<string, string> = {
    'moyen': 'moyen',
    'difficile': 'difficile',
    'expert': 'expert',
    'facile': 'moyen',
    'easy': 'moyen',
    'medium': 'moyen',
    'intermediaire': 'moyen',
    'hard': 'difficile',
    'extreme': 'expert',
    '1': 'moyen',
    '2': 'moyen',
    '3': 'difficile',
    '4': 'difficile',
    '5': 'expert',
  };

  const key = mapping[normalized] || 'moyen';
  return DIFFICULTY_CONFIGS[key];
}

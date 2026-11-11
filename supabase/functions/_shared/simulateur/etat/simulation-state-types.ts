/**
 * simulation-state-types.ts — types partagés du gestionnaire d'état de simulation.
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 */

export interface HaikuAnalysis {
  reformulation: boolean;
  reformulation_quality: 'accurate' | 'partial' | 'none';
  question_type: 'open_emotional' | 'open_factual' | 'open_generic' | 'closed' | 'statement' | 'dump_request';
  empathy_detected: boolean;
  empathy_quality: 'authentic' | 'generic' | 'none';
  good_transition: boolean;
  red_flags: ('price_early' | 'formation_early' | 'pressure' | 'closed_chain' | 'poor_listening')[];
  topics_addressed: string[];
  commercial_quality: 'strong' | 'average' | 'weak';
  presentation_detected?: boolean;
}

export interface HaikuCAnalysis {
  qt: 'o' | 'f' | 'v' | 'st';  // question type
  qd: 's' | 'c' | 'e' | 'i' | 'x';  // depth
  ph: 'p3' | 'p4' | 'p5' | 'xx';     // phase
  rv: string[];     // revealed tags
  sy: boolean;      // gap synthesis
  gp: boolean;      // gap chiffré
  eg: boolean;      // engagement
  vl: false | 'frank' | 'soft';  // validation
  f: string[];      // flags
}

export type ObjectionRedFlag = 'pressure' | 'dismisses_objection' | 'repeats_same_argument' | 'ignores_emotion' | 'jumps_to_close';

export interface HaikuObjectionAnalysis {
  od: boolean;      // objection détectée
  accueillir: boolean;
  accueillir_quality: 'empathique' | 'mecanique' | 'absent';
  isoler: boolean;
  challenger: boolean;
  challenger_quality: 'pertinent' | 'faible' | 'absent';
  uses_gap: boolean;
  uses_success_story: boolean;
  attempts_close: boolean;
  red_flags: ObjectionRedFlag[];
  addresses_objection: boolean;
}

export interface ObjectionState {
  phase: 'presentation' | 'objections' | 'conclusion';
  activeObjection: string | null;
  objectionRoundsCount: Record<string, number>;
  resolvedObjections: string[];
  raisedObjections: string[];
  resistancePerObjection: Record<string, number>;
  readyToClose: boolean;
  conclusionAttempts: number;
  lastObjectionAnalysis: HaikuObjectionAnalysis | null;
  previousProspectResponse: string;
  // Nouveau : novel argument tracking + transitions
  argumentsPerObjection: Record<string, string[]>;
  turnsSinceResolved: number;
}

export interface SimulationState {
  confidence: number;
  turnCount: number;
  windowGainAccumulator: number;
  windowStartTurn: number;
  revealedSlots: string[];
  closedQuestionStreak: number;
  lastHaikuAnalysis: HaikuAnalysis | null;
  lastHaikuCAnalysis: HaikuCAnalysis | null;  // nouveau
  difficulty: string;
  previousProspectResponse: string;
  objectionState: ObjectionState | null;
  fullModePhase: 'diagnostic' | 'objections' | null;
  confidenceAtSwitch: number | null;
  // Nouveau : cooldown + pitch tracking
  cooldownTurns: number;
  lastHaikuCSy: boolean;
  pitchDetected: boolean;
  pcmType?: string;
  consciousness: number;
  consciousnessAtSwitch: number | null;
  spinProblems: Array<{tag: string, turn: number}>;
}

export interface ContentSlots {
  surface: string[];
  consequences: string[];
  emotional: string[];
  identity: string[];
  backstoryFacts: string[];
  backstoryEmotions: string[];
}

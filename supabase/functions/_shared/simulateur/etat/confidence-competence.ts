/**
 * confidence-competence.ts — NOTE DE COMPÉTENCE « PROGRESSION DE LA CONFIANCE ».
 * Agrégation DÉTERMINISTE en TypeScript (PAS un appel LLM) — spec addon
 * Performance, prompt 3.8. Poids dans le score certifié : 6 %.
 *
 * Cette note mesure la COMPÉTENCE du commercial (faire progresser la
 * confiance), pas l'état final du prospect.
 *
 * Entrées : la série de confiance tour par tour (1-10) produite par
 * confidence-engine.ts, plus les signaux gains/pénalités par tour.
 */

export type GainSignal =
  | "empathy_authentic"
  | "open_question"
  | "validation_frank"
  | "good_transition";

export type PenaltySignal =
  | "price_early"
  | "formation_early"
  | "pressure"
  | "closed_question_chain";

export interface ConfidenceTurnSignal {
  tour: number;
  signal: GainSignal | PenaltySignal;
  /** Variation de confiance attribuée à ce signal (positive pour un gain, négative pour une pénalité). */
  delta: number;
}

export interface ConfidenceCompetenceInput {
  /** Valeurs de confiance (1-10) tour par tour. */
  serieConfidence: number[];
  /** Signaux gains par tour (empathy_authentic, open_question, validation_frank, good_transition). */
  signauxGains?: ConfidenceTurnSignal[];
  /** Signaux pénalités par tour (price_early, formation_early, pressure, closed_question_chain). */
  signauxPenalites?: ConfidenceTurnSignal[];
  /** Fixe la confiance de départ (informatif — la série fait foi). */
  difficulte?: "facile" | "moyen" | "difficile" | "expert";
}

export interface ConfidenceCompetenceResult {
  confiance_debut: number;
  confiance_fin: number;
  delta: number;
  delta_ajuste: number;
  note_competence: 0 | 1 | 2 | 3;
  drivers_positifs: Array<{ tour: number; signal: string; gain: number }>;
  drivers_negatifs: Array<{ tour: number; signal: string; perte: number }>;
  commentaire: string;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Moyenne du premier tiers de la série (au moins 1 élément). */
export function firstThirdMean(serie: number[]): number {
  const n = Math.max(1, Math.floor(serie.length / 3));
  return mean(serie.slice(0, n));
}

/** Moyenne du dernier tiers de la série (au moins 1 élément). */
export function lastThirdMean(serie: number[]): number {
  const n = Math.max(1, Math.floor(serie.length / 3));
  return mean(serie.slice(serie.length - n));
}

/**
 * Ajustement du delta par la marge de progression :
 * - confiance_debut >= 8 (peu de marge) -> exigence relativisée : delta × 2 ;
 * - confiance_debut <= 3 (grosse marge) -> delta brut ;
 * - entre les deux -> delta brut.
 */
export function adjustDelta(delta: number, confianceDebut: number): number {
  if (confianceDebut >= 8) return delta * 2;
  return delta;
}

/** Barème 0-3 sur delta_ajuste : >=+4 -> 3 ; +2 à +3 -> 2 ; 0 à +1 -> 1 ; <0 -> 0. */
export function noteFromDelta(deltaAjuste: number): 0 | 1 | 2 | 3 {
  if (deltaAjuste >= 4) return 3;
  if (deltaAjuste >= 2) return 2;
  if (deltaAjuste >= 0) return 1;
  return 0;
}

const NOTE_LABELS: Record<number, string> = {
  3: "Maîtrisé",
  2: "Correct",
  1: "Amorcé",
  0: "Absent",
};

function buildCommentaire(
  note: 0 | 1 | 2 | 3,
  delta: number,
  topGain?: ConfidenceTurnSignal,
  topPerte?: ConfidenceTurnSignal,
): string {
  const sens = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const base = `${NOTE_LABELS[note]} : tu as fait évoluer la confiance de ${sens} point${Math.abs(delta) >= 2 ? "s" : ""} sur l'appel.`;
  if (note >= 2 && topGain) {
    return `${base} Ton levier le plus efficace : ${topGain.signal} (tour ${topGain.tour}).`;
  }
  if (topPerte) {
    return `${base} Ce qui t'a coûté le plus : ${topPerte.signal} (tour ${topPerte.tour}).`;
  }
  return base;
}

/**
 * Calcule la note de compétence « progression de la confiance » (0-3),
 * selon la spec 3.8 : moyennes premier/dernier tiers, delta ajusté par la
 * marge, barème 0-3, drivers triés par impact.
 */
export function computeConfidenceCompetence(
  input: ConfidenceCompetenceInput,
): ConfidenceCompetenceResult {
  const serie = input.serieConfidence.filter((v) => Number.isFinite(v));
  const confianceDebut = firstThirdMean(serie);
  const confianceFin = lastThirdMean(serie);
  const delta = confianceFin - confianceDebut;
  const deltaAjuste = adjustDelta(delta, confianceDebut);
  const note = noteFromDelta(deltaAjuste);

  const gains = (input.signauxGains ?? [])
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const pertes = (input.signauxPenalites ?? [])
    .filter((s) => s.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  return {
    confiance_debut: round1(confianceDebut),
    confiance_fin: round1(confianceFin),
    delta: round1(delta),
    delta_ajuste: round1(deltaAjuste),
    note_competence: note,
    drivers_positifs: gains.map((s) => ({
      tour: s.tour,
      signal: s.signal,
      gain: round1(s.delta),
    })),
    drivers_negatifs: pertes.map((s) => ({
      tour: s.tour,
      signal: s.signal,
      perte: round1(Math.abs(s.delta)),
    })),
    commentaire: buildCommentaire(note, delta, gains[0], pertes[0]),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

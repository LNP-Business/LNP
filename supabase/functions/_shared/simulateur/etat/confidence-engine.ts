/**
 * confidence-engine.ts — calcul de la confidence (cooldown + multiplieurs + window).
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 * Fonction pure opérant sur l'objet state (muté par référence) + config.
 */

import type { DifficultyConfig } from '../difficulty-config.ts';
import type { HaikuAnalysis, SimulationState } from './simulation-state-types.ts';

export function updateConfidence(
  state: SimulationState,
  config: DifficultyConfig,
  analysis?: HaikuAnalysis,
): number {
  const a = analysis || state.lastHaikuAnalysis;
  if (!a) return 0;

  const pts = config.points;
  const conf = config.confidence;
  const gainMult = conf.gainMultiplier;
  const penaltyMult = conf.penaltyMultiplier;

  let delta = 0;
  const hasAnyFlag = a.red_flags && a.red_flags.length > 0;

  // ── Gains HaikuA ──
  if (!hasAnyFlag) {
    if (a.reformulation) {
      const base = a.reformulation_quality === 'accurate'
        ? pts.reformulation_accurate : pts.reformulation_partial;
      delta += base * gainMult;
    }

    const qt = a.question_type;
    if (qt === 'open_emotional' || qt === 'open_factual') {
      delta += pts.open_question_relevant * gainMult;
    } else if (qt === 'open_generic') {
      delta += pts.open_question_generic * gainMult;
    }

    if (a.empathy_detected) {
      const base = a.empathy_quality === 'authentic'
        ? pts.empathy_authentic : pts.empathy_generic;
      delta += base * gainMult;
    }

    if (a.good_transition) {
      delta += pts.good_transition * gainMult;
    }
  }

  // ── Gains HaikuC (signal extractor) ──
  const haikuC = state.lastHaikuCAnalysis;
  if (haikuC && !hasAnyFlag) {
    if (haikuC.qt === 'o') {
      delta += pts.haikuC_open_question * gainMult;
    } else if (haikuC.qt === 'f') {
      delta += pts.haikuC_factual_question * gainMult;
    }
    if (haikuC.vl === 'frank') {
      delta += pts.haikuC_validation_frank * gainMult;
    } else if (haikuC.vl === 'soft') {
      delta += (pts.haikuC_validation_frank * 0.4) * gainMult;
    }
  }

  // ── Pénalités ──
  for (const flag of (a.red_flags || [])) {
    switch (flag) {
      case 'price_early':
        if (state.confidence < 8) delta += pts.red_flag_price_early * penaltyMult;
        break;
      case 'formation_early':
        if (state.confidence < 7) delta += pts.red_flag_formation_early * penaltyMult;
        break;
      case 'pressure':
        delta += pts.red_flag_pressure * penaltyMult;
        break;
      case 'closed_chain':
        delta += pts.closed_question_chain * penaltyMult;
        break;
      case 'poor_listening':
        delta += pts.poor_listening * penaltyMult;
        break;
    }
  }

  // Pénalités HaikuC flags
  if (haikuC) {
    for (const f of haikuC.f) {
      const penMap: Record<string, number> = {
        pl: -1.5, pr: -1.5, fe: -2, pe: -1.5, cc: -0.75,
        mi: -1, rp: -0.75, tb: -1, mq: -0.5, qo: -0.5, ep: -1.5, ft: -0.5,
      };
      if (penMap[f]) delta += penMap[f] * penaltyMult;
    }
  }

  // ── Cap maxGainPerTurn ──
  if (delta > conf.maxGainPerTurn) delta = conf.maxGainPerTurn;
  if (delta < -3) delta = -3; // cap pénalité max

  // ── Cooldown ──
  if (state.cooldownTurns > 0) {
    if (delta > conf.maxGainDuringCooldown) delta = conf.maxGainDuringCooldown;
    state.cooldownTurns = Math.max(0, state.cooldownTurns - 1);
  }

  // Si flag → activer cooldown pour prochain tour
  if (hasAnyFlag || (haikuC && haikuC.f.length > 0)) {
    state.cooldownTurns = conf.cooldownTurns;
  }

  // ── Consciousness update via HaikuC ──
  if (haikuC) {
    let cDelta = 0;
    if (haikuC.sy) cDelta += 0.75;
    if (haikuC.gp) cDelta += 1.0;
    if (haikuC.vl === 'frank') cDelta += 0.2;
    if (cDelta > 1.5) cDelta = 1.5;
    state.consciousness = Math.min(10, state.consciousness + cDelta);
  }

  // ── SPIN problems tracking via HaikuC.rv ──
  if (haikuC && haikuC.rv && haikuC.rv.length > 0) {
    const spinTags = ['cs', 'em', 'id', 'dp', 'bs'];
    const priorityOrder = ['id', 'em', 'dp', 'bs', 'cs'];
    const matchingTags = haikuC.rv.filter((t: string) => spinTags.includes(t));
    if (matchingTags.length > 0) {
      const deepest = priorityOrder.find(p => matchingTags.includes(p));
      if (deepest) {
        state.spinProblems.push({ tag: deepest, turn: state.turnCount });
      }
    }
  }

  // ── Window cap ──
  state.turnCount++;

  if (state.turnCount - state.windowStartTurn >= config.windowSize) {
    state.windowGainAccumulator = 0;
    state.windowStartTurn = state.turnCount;
  }

  if (delta > 0) {
    const remainingCap = config.maxGainPerWindow - state.windowGainAccumulator;
    if (remainingCap <= 0) {
      delta = 0;
    } else if (delta > remainingCap) {
      delta = remainingCap;
    }
    state.windowGainAccumulator += delta;
  }

  state.confidence = Math.max(1, Math.min(config.maxConfidence, state.confidence + delta));

  const haikuC_info = haikuC ? ` | HaikuC qt:${haikuC.qt} qd:${haikuC.qd} vl:${haikuC.vl}` : '';
  console.log(`[ModularSim] Confidence: ${(state.confidence - delta).toFixed(1)} → ${state.confidence.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}) | cq:${a.commercial_quality} | flags:[${a.red_flags.join(',')}]${haikuC_info} | cooldown:${state.cooldownTurns}`);

  return delta;
}

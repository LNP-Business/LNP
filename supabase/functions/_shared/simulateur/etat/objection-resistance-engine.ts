/**
 * objection-resistance-engine.ts — résistance des objections (cap, novel arg,
 * flag increases) + transition vers la prochaine objection.
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 * Fonctions pures opérant sur l'objet state (muté par référence) + config.
 */

import type { DifficultyConfig } from '../difficulty-config.ts';
import type { HaikuObjectionAnalysis, SimulationState } from './simulation-state-types.ts';
import { isNovelArgument } from './state-parse-helpers.ts';

export function updateObjectionResistance(
  state: SimulationState,
  config: DifficultyConfig,
  analysis: HaikuObjectionAnalysis,
  commercialMessage: string = '',
): { delta: number; resolved: boolean } {
  const os = state.objectionState;
  if (!os || !os.activeObjection) return { delta: 0, resolved: false };

  // Si pas d'objection détectée dans le message du commercial → pas de changement
  if (!analysis.od) {
    state.turnCount++;
    os.turnsSinceResolved++;
    return { delta: 0, resolved: false };
  }

  const oc = config.objections;
  const rd = oc.resistanceDecay;
  const dropMult = oc.resistanceDropMultiplier;
  const objKey = os.activeObjection;

  const roundCount = (os.objectionRoundsCount[objKey] || 0) + 1;
  os.objectionRoundsCount[objKey] = roundCount;

  const maxRounds = config.objections.maxRoundsPerObjection ?? 8;
  if (roundCount >= maxRounds && !os.resolvedObjections.includes(objKey)) {
    os.resolvedObjections.push(objKey);
    os.turnsSinceResolved = 0;
    state.objectionState!.resistancePerObjection[objKey] = 0;
    state.turnCount++;
    console.log(`[ModularSim] Max rounds atteint sur "${objKey.substring(0,30)}" → abandon`);
    return { delta: 0, resolved: true };
  }

  let drops = 0;
  let increases = 0;

  // ── Drops (bons comportements) ──
  if (analysis.accueillir) {
    drops += analysis.accueillir_quality === 'empathique'
      ? rd.accueillir_empathique : rd.accueillir_mecanique;
  }
  if (analysis.isoler) drops += rd.isoler;
  if (analysis.challenger) {
    drops += analysis.challenger_quality === 'pertinent'
      ? rd.challenger_pertinent : rd.challenger_faible;
  }
  if (analysis.uses_gap) drops += rd.gap_used;
  if (analysis.uses_success_story) drops += rd.success_story;
  if (analysis.addresses_objection) drops += rd.addresses_objection;

  // Novel argument bonus
  const argsUsed = os.argumentsPerObjection[objKey] || [];
  const novel = isNovelArgument(argsUsed, commercialMessage);
  if (analysis.challenger && novel) {
    drops += rd.novel_argument;
    // Enregistrer l'argument
    os.argumentsPerObjection[objKey] = [...argsUsed, commercialMessage.substring(0, 80)];
  }

  // Appliquer multiplicateur de difficulté sur les drops
  drops *= dropMult;

  // Cap drop par tour (ex: -2, bonus -1 si ug)
  const bonusDrop = analysis.uses_gap ? oc.bonusDropForUg : 0;
  const effectiveCap = oc.maxDropPerTurn + bonusDrop;
  if (drops < effectiveCap) drops = effectiveCap;

  // ── Increases (mauvais comportements) ──
  for (const flag of (analysis.red_flags || [])) {
    switch (flag) {
      case 'pressure': increases += rd.flag_pressure; break;
      case 'dismisses_objection': increases += rd.flag_dismisses; break;
      case 'ignores_emotion': increases += rd.flag_ignores_emotion; break;
      case 'jumps_to_close': increases += rd.flag_jumps_close; break;
      case 'repeats_same_argument': increases += rd.flag_repeats; break;
    }
  }

  // Pénalité si objection non adressée
  if (!analysis.addresses_objection) {
    increases += rd.not_addressing;
  }

  let delta = drops + increases;

  // Plancher : on ne peut pas résoudre avant minRounds
  const currentResistance = os.resistancePerObjection[objKey] ?? oc.startingResistance;
  let newResistance = currentResistance + delta;

  if (roundCount < oc.minRoundsPerObjection) {
    newResistance = Math.max(newResistance, oc.resolveThreshold + 0.1);
  }

  newResistance = Math.max(oc.minResistance, Math.min(10, newResistance));
  os.resistancePerObjection[objKey] = newResistance;

  const resolved = newResistance <= oc.resolveThreshold && roundCount >= oc.minRoundsPerObjection;

  if (resolved && !os.resolvedObjections.includes(objKey)) {
    os.resolvedObjections.push(objKey);
    os.turnsSinceResolved = 0;
  }

  state.turnCount++;
  os.turnsSinceResolved++;

  console.log(`[ModularSim-Objections] "${objKey.substring(0, 30)}..." | Round ${roundCount} | Resistance: ${currentResistance.toFixed(1)} → ${newResistance.toFixed(1)} (drops:${drops.toFixed(2)} inc:${increases.toFixed(2)}) | novel:${novel} | resolved:${resolved}`);

  return { delta, resolved };
}

export function advanceToNextObjection(
  state: SimulationState,
  config: DifficultyConfig,
  allObjectionTexts: string[],
): string | null {
  const os = state.objectionState;
  if (!os) return null;

  const oc = config.objections;
  const pool = allObjectionTexts.slice(0, oc.maxActiveObjections);

  // Délai de transition : attendre minTurnsBeforeNextObjection
  if (os.turnsSinceResolved < oc.minTurnsBeforeNextObjection) {
    console.log(`[ModularSim-Objections] Transition delay: ${os.turnsSinceResolved}/${oc.minTurnsBeforeNextObjection} turns`);
    os.activeObjection = null;
    return null;
  }

  const nextUnraised = pool.find(t => !os.raisedObjections.includes(t));

  if (nextUnraised) {
    os.activeObjection = nextUnraised;
    os.raisedObjections.push(nextUnraised);
    os.turnsSinceResolved = 0;
    if (!(nextUnraised in os.resistancePerObjection)) {
      os.resistancePerObjection[nextUnraised] = oc.startingResistance;
    }
    return nextUnraised;
  }

  if (os.raisedObjections.length >= oc.minObjectionsToRaise) {
    os.readyToClose = true;
    os.activeObjection = null;
    os.phase = 'conclusion';
    return null;
  }

  return null;
}

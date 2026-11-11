/**
 * objection-init.ts — initialisation de l'état des objections + ajustements de
 * résistance au moment du switch diagnostic → objections (conf/cons/PCM).
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 * Fonctions pures opérant sur l'objet state (muté par référence) + config.
 */

import type { DifficultyConfig } from '../difficulty-config.ts';
import type { SimulationState } from './simulation-state-types.ts';

export function initObjectionState(
  state: SimulationState,
  config: DifficultyConfig,
  objectionTexts: string[],
): void {
  const oc = config.objections;
  const pool = objectionTexts.slice(0, oc.maxActiveObjections);
  const resistancePerObjection: Record<string, number> = {};
  for (const text of pool) {
    resistancePerObjection[text] = oc.startingResistance;
  }

  state.objectionState = {
    phase: 'objections',
    activeObjection: pool.length > 0 ? pool[0] : null,
    objectionRoundsCount: {},
    resolvedObjections: [],
    raisedObjections: pool.length > 0 ? [pool[0]] : [],
    resistancePerObjection,
    readyToClose: false,
    conclusionAttempts: 0,
    lastObjectionAnalysis: null,
    previousProspectResponse: '',
    argumentsPerObjection: {},
    turnsSinceResolved: 0,
  };
}

export function initObjectionStateFromSwitch(
  state: SimulationState,
  config: DifficultyConfig,
  objectionTexts: string[],
): void {
  initObjectionState(state, config, objectionTexts);
  const conf = state.confidenceAtSwitch ?? state.confidence;
  const cons = state.consciousnessAtSwitch ?? state.consciousness;
  const confHigh = conf >= 7;
  const consHigh = cons >= 6;

  let delta = 0;
  if (confHigh && consHigh) {
    delta = -2;
  } else if (confHigh && !consHigh) {
    delta = -0.5;
  } else if (!confHigh && consHigh) {
    delta = 2.5;
  } else {
    delta = -2;
  }

  for (const key of Object.keys(state.objectionState!.resistancePerObjection)) {
    state.objectionState!.resistancePerObjection[key] = Math.min(10, Math.max(0,
      state.objectionState!.resistancePerObjection[key] + delta
    ));
  }
  console.log(`[ModularSim] Switch objections | conf:${conf.toFixed(1)} cons:${cons.toFixed(1)} | confHigh:${confHigh} consHigh:${consHigh} | delta:${delta >= 0 ? '+' : ''}${delta}`);
}

export function initObjectionStateWithResistance(
  state: SimulationState,
  config: DifficultyConfig,
  objectionTexts: string[],
  pcmScore: number | null,
): void {
  initObjectionState(state, config, objectionTexts);

  const conf = state.confidenceAtSwitch ?? state.confidence;
  const cons = state.consciousnessAtSwitch ?? state.consciousness;
  const confHigh = conf >= 7;
  const consHigh = cons >= 6;

  let confConsDelta = 0;
  if (confHigh && consHigh) {
    confConsDelta = -2;
  } else if (confHigh && !consHigh) {
    confConsDelta = -0.5;
  } else if (!confHigh && consHigh) {
    confConsDelta = 2.5;
  } else {
    confConsDelta = -2;
  }

  const pcmModifier = pcmScore === null ? 0 : pcmScore <= 3 ? +1.5 : pcmScore >= 7 ? -1.5 : 0;
  const baseResistance = config.objections.startingResistance;
  const finalResistance = Math.min(10, Math.max(0, baseResistance + confConsDelta + pcmModifier));

  for (const key of Object.keys(state.objectionState!.resistancePerObjection)) {
    state.objectionState!.resistancePerObjection[key] = finalResistance;
  }

  state.fullModePhase = 'objections';
  state.confidenceAtSwitch = state.confidence;
  state.consciousnessAtSwitch = state.consciousness;
  console.log(`[ModularSim] initObjWithResistance | conf:${conf.toFixed(1)} cons:${cons.toFixed(1)} | confConsDelta:${confConsDelta >= 0 ? '+' : ''}${confConsDelta} | pcmScore:${pcmScore} pcmMod:${pcmModifier >= 0 ? '+' : ''}${pcmModifier} | base:${baseResistance} → final:${finalResistance.toFixed(1)}`);
}

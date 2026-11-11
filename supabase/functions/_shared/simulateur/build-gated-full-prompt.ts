import { buildGatedDiagnosticPrompt } from './build-gated-prompt.ts';
import { buildGatedObjectionsPrompt } from './build-gated-objections-prompt.ts';
import type { SimulationStateManager } from './simulation-state-manager.ts';
import type { Persona } from './types.ts';
import type { OfferData } from './persona-generated-full.ts';

interface GatedFullPromptOptions {
  persona: Persona;
  offerData: OfferData;
  stateManager: SimulationStateManager;
  voiceMode?: boolean;
}

export function buildGatedFullPrompt(options: GatedFullPromptOptions): string {
  const phase = options.stateManager.getFullModePhase();

  if (phase === 'objections') {
    return buildGatedObjectionsPrompt(options);
  }

  return buildGatedDiagnosticPrompt({
    ...options,
    mode: 'full',
  });
}

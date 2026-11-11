/**
 * simulation-state-manager.ts — v2
 *
 * Améliorations vs v1 :
 * - HaikuA + HaikuC en parallèle (signal extractor)
 * - postProcessHaikuC (R1-R7) appliqué inline
 * - Confidence : cooldown + gainMultiplier/penaltyMultiplier par difficulté + maxGainPerTurn
 * - Objections : cap maxDropPerTurn, novel argument tracking, flag increases, resolveThreshold=0
 * - Double gate (conf + turn) pour débloquer le contenu profond
 */

import { getDifficultyConfig, type DifficultyConfig, type ObjectionsConfig } from './difficulty-config.ts';
// Note: expandSlimDiagnostic/expandSlimObjection no longer needed — mapping is inline
import { HAIKU_A_SYSTEM, buildHaikuAInput } from './haiku-commercial-quality.ts';
import { HAIKU_SIGNAL_EXTRACTOR_SYSTEM, buildHaikuSignalExtractorInput } from './haiku-signal-extractor.ts';
import { HAIKU_OBJECTION_HANDLER_SYSTEM, buildHaikuObjectionHandlerInput } from './haiku-objection-handler.ts';
import { HAIKU_PCM_SCORER_SYSTEM, buildHaikuPcmScorerInput } from './haiku-pcm-scorer.ts';

// ─── Types (voir state/simulation-state-types.ts) ──────────────
export type {
  HaikuAnalysis,
  HaikuCAnalysis,
  ObjectionRedFlag,
  HaikuObjectionAnalysis,
  ObjectionState,
  SimulationState,
  ContentSlots,
} from './etat/simulation-state-types.ts';

import type {
  HaikuAnalysis,
  HaikuCAnalysis,
  HaikuObjectionAnalysis,
  ObjectionState,
  SimulationState,
  ContentSlots,
} from './etat/simulation-state-types.ts';
import { safeParseJson } from './etat/state-parse-helpers.ts';
import { mapHaikuADiagnostic, applyHaikuCResult } from './etat/haiku-diagnostic-mapper.ts';
import { mapHaikuObjection, haikuObjectionFallback } from './etat/haiku-objection-mapper.ts';
import { updateConfidence as computeConfidence } from './etat/confidence-engine.ts';
import {
  updateObjectionResistance as computeObjectionResistance,
  advanceToNextObjection as advanceObjection,
} from './etat/objection-resistance-engine.ts';
import {
  initObjectionState as initObjState,
  initObjectionStateFromSwitch as initObjStateFromSwitch,
  initObjectionStateWithResistance as initObjStateWithResistance,
} from './etat/objection-init.ts';

// ─── Classe principale ────────────────────────────────────────

export class SimulationStateManager {
  private state: SimulationState;
  private config: DifficultyConfig;

  constructor(difficulty?: string, existingState?: SimulationState, mode?: string, personaConfidence?: number) {
    this.config = getDifficultyConfig(difficulty);

    if (existingState) {
      this.state = existingState;
      this.config = getDifficultyConfig(existingState.difficulty);
    } else {
      const startingConfidence = personaConfidence !== undefined && personaConfidence > 0
        ? Math.min(personaConfidence, this.config.startingConfidence)
        : this.config.startingConfidence;

      console.log(`[ModularSim] Init | Difficulty: ${difficulty} | Config confidence: ${this.config.startingConfidence} | Persona confidence: ${personaConfidence ?? 'none'} | Starting: ${startingConfidence}`);

      this.state = {
        confidence: startingConfidence,
        turnCount: 0,
        windowGainAccumulator: 0,
        windowStartTurn: 0,
        closedQuestionStreak: 0,
        revealedSlots: [],
        lastHaikuAnalysis: null,
        lastHaikuCAnalysis: null,
        difficulty: difficulty || 'moyen',
        previousProspectResponse: '',
        objectionState: null,
        fullModePhase: mode === 'full' ? 'diagnostic' : null,
        confidenceAtSwitch: null,
        cooldownTurns: 0,
        lastHaikuCSy: false,
        pitchDetected: false,
        consciousness: 0,
        consciousnessAtSwitch: null,
        spinProblems: [],
      };
    }
  }

  // ─── Initialisation objections ─────────────────────────────

  initObjectionState(objectionTexts: string[]): void {
    initObjState(this.state, this.config, objectionTexts);
  }

  // ─── Analyse diagnostic : HaikuA + HaikuC en parallèle ────

  async analyzeCommercialMessage(
    commercialMessage: string,
    callHaiku: (prompt: string, system?: string) => Promise<string>
  ): Promise<HaikuAnalysis> {
    const prevProspect = this.state.previousProspectResponse || '(debut de conversation)';

    const promptA = buildHaikuAInput(prevProspect, commercialMessage);
    const promptC = buildHaikuSignalExtractorInput(prevProspect, commercialMessage, this.state.lastHaikuCSy);

    // Appels parallèles HaikuA + HaikuC
    const [resultA, resultC] = await Promise.allSettled([
      callHaiku(promptA, HAIKU_A_SYSTEM),
      callHaiku(promptC, HAIKU_SIGNAL_EXTRACTOR_SYSTEM),
    ]);

    // ── HaikuA ──
    const analysis: HaikuAnalysis = mapHaikuADiagnostic(resultA);

    // Closed question streak
    if (analysis.question_type === 'closed') {
      this.state.closedQuestionStreak++;
      if (this.state.closedQuestionStreak >= 3) {
        analysis.red_flags = [...(analysis.red_flags || []), 'closed_chain'];
      }
    } else {
      this.state.closedQuestionStreak = 0;
    }

    // Pitch detection
    if (!this.state.pitchDetected && analysis.presentation_detected) {
      this.state.pitchDetected = true;
    }

    this.state.lastHaikuAnalysis = analysis;

    // ── HaikuC ──
    applyHaikuCResult(this.state, resultC, commercialMessage, prevProspect, analysis.red_flags || []);

    return analysis;
  }

  // ─── Analyse objection : HaikuB ───────────────────────────

  async analyzeCommercialObjectionMessage(
    commercialMessage: string,
    callHaiku: (prompt: string, system?: string) => Promise<string>
  ): Promise<HaikuObjectionAnalysis> {
    const os = this.state.objectionState;
    if (!os) throw new Error('[ModularSim] No objectionState initialized');

    const currentObjection = os.activeObjection || '(aucune objection active)';
    const round = os.objectionRoundsCount[os.activeObjection || ''] || 0;
    const previousArguments = os.argumentsPerObjection[os.activeObjection || ''] || [];

    const prompt = buildHaikuObjectionHandlerInput(
      currentObjection,
      round,
      previousArguments,
      commercialMessage
    );

    try {
      const raw = await callHaiku(prompt, HAIKU_OBJECTION_HANDLER_SYSTEM);
      // Le nouveau prompt retourne directement od, ac, is, ch... pas besoin d'expand
      const analysis = mapHaikuObjection(safeParseJson(raw));
      os.lastObjectionAnalysis = analysis;
      return analysis;
    } catch (e) {
      console.error('[ModularSim] HaikuB failed, using fallback:', e);
      const fallback = haikuObjectionFallback();
      os.lastObjectionAnalysis = fallback;
      return fallback;
    }
  }

  // ─── updateConfidence (avec cooldown + multiplieurs) ───────

  updateConfidence(analysis?: HaikuAnalysis): number {
    return computeConfidence(this.state, this.config, analysis);
  }

  // ─── updateObjectionResistance (avec cap, novel arg, flag increases) ──

  updateObjectionResistance(analysis: HaikuObjectionAnalysis, commercialMessage: string = ''): { delta: number; resolved: boolean } {
    return computeObjectionResistance(this.state, this.config, analysis, commercialMessage);
  }

  // ─── Transition vers prochaine objection ──────────────────

  advanceToNextObjection(allObjectionTexts: string[]): string | null {
    return advanceObjection(this.state, this.config, allObjectionTexts);
  }

  // ─── Content gating (double gate conf + turn) ─────────────

  getUnlockedContent(allContent: ContentSlots): ContentSlots {
    const t = this.config.thresholds;
    const g = this.config.depthTurnGates;
    const c = this.state.confidence;
    const turn = this.state.turnCount;

    return {
      surface: c >= t.surface && turn >= g.surface ? allContent.surface : [],
      consequences: c >= t.consequences && turn >= g.consequences ? allContent.consequences : [],
      emotional: c >= t.emotional && turn >= g.emotional ? allContent.emotional : [],
      identity: c >= t.identity && turn >= g.identity ? allContent.identity : [],
      backstoryFacts: c >= t.backstory_facts && turn >= g.surface ? allContent.backstoryFacts : [],
      backstoryEmotions: c >= t.backstory_emotions && turn >= g.emotional ? allContent.backstoryEmotions : [],
    };
  }

  // ─── Phase switch (full mode) ─────────────────────────────

  checkPhaseSwitch(analysis: HaikuAnalysis): boolean {
    if (this.state.fullModePhase !== 'diagnostic' && this.state.fullModePhase !== null) return false;
    if (!analysis.presentation_detected) return false;

    this.state.fullModePhase = 'objections';
    this.state.confidenceAtSwitch = this.state.confidence;
    this.state.consciousnessAtSwitch = this.state.consciousness;

    console.log(`[ModularSim] PHASE SWITCH: diagnostic → objections | Confidence: ${this.state.confidence.toFixed(1)} | Consciousness: ${this.state.consciousness.toFixed(1)}`);
    return true;
  }

  initObjectionStateFromSwitch(objectionTexts: string[]): void {
    initObjStateFromSwitch(this.state, this.config, objectionTexts);
  }

  initObjectionStateWithResistance(objectionTexts: string[], pcmScore: number | null): void {
    initObjStateWithResistance(this.state, this.config, objectionTexts, pcmScore);
  }

  checkForceObjection(haikuC: HaikuCAnalysis): boolean {
    if (this.state.fullModePhase === 'objections') return false;
    if (this.state.turnCount < 5) return false;

    if (haikuC.eg) {
      const needsCount = this.getSpinExplicitNeedsCount();
      if (needsCount < 2) return true;
    }

    return false;
  }

  getSpinExplicitNeedsCount(): number {
    const distinctTags = new Set(this.state.spinProblems.map(sp => sp.tag));
    return distinctTags.size;
  }

  // ─── Getters ──────────────────────────────────────────────

  getActiveObjectionResistance(): number {
    const os = this.state.objectionState;
    if (!os || !os.activeObjection) return 0;
    return os.resistancePerObjection[os.activeObjection] ?? this.config.objections.startingResistance;
  }

  getObjectionState(): ObjectionState | null {
    return this.state.objectionState ? { ...this.state.objectionState } : null;
  }

  getObjectionsConfig(): ObjectionsConfig {
    return this.config.objections;
  }

  trackObjectionProspectResponse(response: string): void {
    if (this.state.objectionState) {
      this.state.objectionState.previousProspectResponse = response;
    }
  }

  trackProspectResponse(response: string): void {
    this.state.previousProspectResponse = response;
  }

  getResistanceBehavior(): string {
    const a = this.state.lastHaikuAnalysis;
    const r = this.config.resistance;
    if (!a) return r.on_weak_question;
    if (a.question_type === 'dump_request') return r.on_dump_request;
    if (a.red_flags && a.red_flags.length > 0) return r.on_red_flag;
    if (a.commercial_quality === 'weak') return r.on_weak_question;
    return '';
  }

  getHaikuCAnalysis(): HaikuCAnalysis | null {
    return this.state.lastHaikuCAnalysis;
  }

  getFullModePhase(): 'diagnostic' | 'objections' | null {
    return this.state.fullModePhase;
  }

  getConfidenceAtSwitch(): number | null {
    return this.state.confidenceAtSwitch;
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  getConfidence(): number {
    return this.state.confidence;
  }

  getTurnCount(): number {
    return this.state.turnCount;
  }

  getDifficultyLabel(): string {
    return this.config.label;
  }

  isPitchDetected(): boolean {
    return this.state.pitchDetected;
  }

  setInitialConsciousness(conscience: number): void {
    // conscience 1-5 → consciousness 0-10
    this.state.consciousness = Math.min(10, Math.max(0, (conscience - 1) * 2.5));
  }

  setPcmType(pcmType: string | undefined): void {
    this.state.pcmType = pcmType;
  }

  getConsciousness(): number {
    return this.state.consciousness;
  }

  getPcmType(): string | undefined {
    return this.state.pcmType;
  }

  async scorePitchPcm(
    pitchMessage: string,
    pcmType: string | undefined,
    callHaiku: (prompt: string, system?: string) => Promise<string>
  ): Promise<number | null> {
    if (!pcmType) return null;
    try {
      const prompt = buildHaikuPcmScorerInput(pcmType, pitchMessage);
      const raw = await callHaiku(prompt, HAIKU_PCM_SCORER_SYSTEM);
      const parsed = safeParseJson(raw);
      const score = typeof parsed.score === 'number' ? parsed.score : null;
      console.log(`[ModularSim] HaikuD PCM score | pcmType:${pcmType} | score:${score}`);
      return score;
    } catch (e) {
      console.error('[ModularSim] HaikuD failed:', e);
      return null;
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  static deserialize(json: string): SimulationStateManager {
    const state: SimulationState = JSON.parse(json);
    // Hydratation des nouveaux champs absents des anciens états sérialisés
    state.cooldownTurns = state.cooldownTurns ?? 0;
    state.lastHaikuCSy = state.lastHaikuCSy ?? false;
    state.lastHaikuCAnalysis = state.lastHaikuCAnalysis ?? null;
    state.pitchDetected = state.pitchDetected ?? false;
    state.pcmType = state.pcmType ?? undefined;
    state.consciousness = state.consciousness ?? 0;
    state.consciousnessAtSwitch = state.consciousnessAtSwitch ?? null;
    state.spinProblems = state.spinProblems ?? [];
    if (state.objectionState) {
      state.objectionState.argumentsPerObjection = state.objectionState.argumentsPerObjection ?? {};
      state.objectionState.turnsSinceResolved = state.objectionState.turnsSinceResolved ?? 0;
    }
    return new SimulationStateManager(state.difficulty, state);
  }
}

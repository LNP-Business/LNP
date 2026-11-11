// Simulateur : test de caractérisation du moteur d'état (confiance, objections, analyses de signaux simulées).
// Porté tel quel du test d'origine ; describe/it/expect sont une petite cale sur Deno.test.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
const describe = (_n: string, f: () => void) => f();
const it = (n: string, f: () => unknown) => Deno.test(n, f as () => void);
const expect = (a: unknown) => ({
  toBe: (b: unknown) => assertEquals(a, b),
  toEqual: (b: unknown) => assertEquals(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))),   // comme vitest : les clés indéfinies sont ignorées
  toBeNull: () => assertEquals(a, null),
  toBeCloseTo: (b: number, d = 2) => assertAlmostEquals(a as number, b, Math.pow(10, -d) / 2),
});
void assert;
import {
  SimulationStateManager,
  type HaikuAnalysis,
  type HaikuObjectionAnalysis,
  type ContentSlots,
} from "../functions/_shared/simulateur/simulation-state-manager.ts";
import { HAIKU_A_SYSTEM } from "../functions/_shared/simulateur/haiku-commercial-quality.ts";

/**
 * Test de caractérisation (docs/ARCHITECTURE.md §6) — épingle le comportement
 * de SimulationStateManager AVANT la décomposition du chantier #2. Aucun appel
 * LLM réel : callHaiku est mocké pour les méthodes async.
 */

const cleanStrongAnalysis: HaikuAnalysis = {
  reformulation: true,
  reformulation_quality: 'accurate',
  question_type: 'open_factual',
  empathy_detected: true,
  empathy_quality: 'authentic',
  good_transition: false,
  red_flags: [],
  topics_addressed: [],
  commercial_quality: 'strong',
};

const flaggedAnalysis: HaikuAnalysis = {
  reformulation: false,
  reformulation_quality: 'none',
  question_type: 'closed',
  empathy_detected: false,
  empathy_quality: 'none',
  good_transition: false,
  red_flags: ['pressure'],
  topics_addressed: [],
  commercial_quality: 'weak',
};

const goodObjectionAnalysis: HaikuObjectionAnalysis = {
  od: true,
  accueillir: true,
  accueillir_quality: 'empathique',
  isoler: true,
  challenger: true,
  challenger_quality: 'pertinent',
  uses_gap: false,
  uses_success_story: false,
  attempts_close: false,
  red_flags: [],
  addresses_objection: true,
};

describe('SimulationStateManager — caractérisation', () => {
  it('constructeur : plafonne la confidence de départ par celle de la persona', () => {
    const m = new SimulationStateManager('moyen', undefined, undefined, 4);
    expect(m.getConfidence()).toBe(4);
    const m2 = new SimulationStateManager('moyen');
    expect(m2.getConfidence()).toBe(6);
  });

  it('updateConfidence : gains nets sans flag (moyen)', () => {
    const m = new SimulationStateManager('moyen');
    const delta = m.updateConfidence(cleanStrongAnalysis);
    expect(delta).toBeCloseTo(0.7, 5);
    expect(m.getConfidence()).toBeCloseTo(6.7, 5);
    expect(m.getTurnCount()).toBe(1);
  });

  it('updateConfidence : flag → pénalité + cooldown armé', () => {
    const m = new SimulationStateManager('moyen');
    const delta = m.updateConfidence(flaggedAnalysis);
    expect(delta).toBeCloseTo(-1.5, 5);
    expect(m.getConfidence()).toBeCloseTo(4.5, 5);
    const state = m.getState();
    expect(state.cooldownTurns).toBe(2);
  });

  it('initObjectionState : pool limité à maxActiveObjections', () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionState(['o1', 'o2', 'o3']);
    const os = m.getObjectionState()!;
    expect(os.activeObjection).toBe('o1');
    expect(os.raisedObjections).toEqual(['o1']);
    expect(Object.keys(os.resistancePerObjection)).toEqual(['o1', 'o2']);
    expect(os.resistancePerObjection['o1']).toBe(6);
  });

  it('updateObjectionResistance : drops cappés + novel argument', () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionState(['o1', 'o2']);
    const res = m.updateObjectionResistance(goodObjectionAnalysis, 'un argument neuf');
    expect(res.delta).toBeCloseTo(-2, 5);
    expect(res.resolved).toBe(false);
    expect(m.getActiveObjectionResistance()).toBeCloseTo(4, 5);
  });

  it('advanceToNextObjection : respecte minTurnsBeforeNextObjection', () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionState(['o1', 'o2']);
    const next = m.advanceToNextObjection(['o1', 'o2']);
    expect(next).toBeNull();
    expect(m.getObjectionState()!.activeObjection).toBeNull();
  });

  it('getUnlockedContent : double gate confidence + turn', () => {
    const m = new SimulationStateManager('moyen');
    const all: ContentSlots = {
      surface: ['s1'],
      consequences: ['c1'],
      emotional: ['e1'],
      identity: ['i1'],
      backstoryFacts: ['bf1'],
      backstoryEmotions: ['be1'],
    };
    const unlocked = m.getUnlockedContent(all);
    expect(unlocked.surface).toEqual(['s1']);
    expect(unlocked.backstoryFacts).toEqual(['bf1']);
    expect(unlocked.consequences).toEqual([]);
    expect(unlocked.emotional).toEqual([]);
    expect(unlocked.identity).toEqual([]);
    expect(unlocked.backstoryEmotions).toEqual([]);
  });

  it('checkPhaseSwitch : bascule diagnostic → objections sur pitch', () => {
    const m = new SimulationStateManager('moyen', undefined, 'full');
    expect(m.getFullModePhase()).toBe('diagnostic');
    const switched = m.checkPhaseSwitch({ ...cleanStrongAnalysis, presentation_detected: true });
    expect(switched).toBe(true);
    expect(m.getFullModePhase()).toBe('objections');
  });

  it('serialize/deserialize : roundtrip conserve l\'état', () => {
    const m = new SimulationStateManager('difficile');
    m.updateConfidence(cleanStrongAnalysis);
    m.initObjectionState(['x1', 'x2']);
    const json = m.serialize();
    const restored = SimulationStateManager.deserialize(json);
    expect(restored.getState()).toEqual(m.getState());
    expect(restored.getDifficultyLabel()).toBe('Difficile');
  });

  it('analyzeCommercialMessage : mappe HaikuC + applique postProcess (R5a, vl frank)', async () => {
    const m = new SimulationStateManager('moyen');
    const mockHaiku = async (_prompt: string, system?: string): Promise<string> => {
      if (system === HAIKU_A_SYSTEM) {
        return JSON.stringify({ r: [true, 'a'], e: [true, 'a'], f: [], cq: 's', pd: false });
      }
      return JSON.stringify({
        qt: 'o', qd: 's', ph: 'p3', rv: [], sy: true, gp: false, eg: false, vl: 'frank', f: [],
      });
    };
    await m.analyzeCommercialMessage('Qu\'est-ce qui te bloque vraiment ?', mockHaiku);
    const c = m.getHaikuCAnalysis()!;
    expect(c.qt).toBe('o');
    expect(c.sy).toBe(true);
    expect(c.ph).toBe('p5');
    expect(c.vl).toBe('frank');
  });

  it('analyzeCommercialMessage : mappe HaikuA (flags, cq) + pitch + post R1', async () => {
    const m = new SimulationStateManager('moyen');
    const mockHaiku = async (_prompt: string, system?: string): Promise<string> => {
      if (system === HAIKU_A_SYSTEM) {
        return JSON.stringify({ r: [true, 'a'], e: [true, 'g'], f: ['pl'], cq: 'w', pd: true });
      }
      return JSON.stringify({
        qt: 'st', qd: 's', ph: 'xx', rv: [], sy: false, gp: false, eg: false, vl: false, f: [],
      });
    };
    const a = await m.analyzeCommercialMessage('Je te présente la formation', mockHaiku);
    expect(a.red_flags).toEqual(['pressure']);
    expect(a.commercial_quality).toBe('weak');
    expect(a.empathy_quality).toBe('generic');
    expect(m.isPitchDetected()).toBe(true);
    expect(m.getHaikuCAnalysis()!.qd).toBe('x'); // R1: st + qd!=x → x
  });

  it('analyzeCommercialObjectionMessage : mappe la réponse slim', async () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionState(['o1']);
    const mockHaiku = async (): Promise<string> =>
      JSON.stringify({ od: true, ac: [true, 'e'], is: true, ch: [true, 'p'], ug: true, us: false, at: false, f: ['pr'], ao: true });
    const r = await m.analyzeCommercialObjectionMessage('Je comprends, mais...', mockHaiku);
    expect(r.accueillir_quality).toBe('empathique');
    expect(r.challenger_quality).toBe('pertinent');
    expect(r.uses_gap).toBe(true);
    expect(r.red_flags).toEqual(['pressure']);
    expect(r.addresses_objection).toBe(true);
  });

  it('analyzeCommercialObjectionMessage : fallback sur JSON invalide', async () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionState(['o1']);
    const mockHaiku = async (): Promise<string> => 'pas du json du tout';
    const r = await m.analyzeCommercialObjectionMessage('blabla', mockHaiku);
    expect(r.od).toBe(true);
    expect(r.accueillir).toBe(false);
    expect(r.addresses_objection).toBe(false);
  });

  it('updateConfidence : pénalité issue des flags HaikuC (penMap fe)', async () => {
    const m = new SimulationStateManager('moyen');
    const mockHaiku = async (_prompt: string, system?: string): Promise<string> => {
      if (system === HAIKU_A_SYSTEM) {
        return JSON.stringify({ r: [false, 'n'], e: [false, 'n'], f: [], cq: 'a', pd: false });
      }
      return JSON.stringify({
        qt: 'v', qd: 'x', ph: 'xx', rv: [], sy: false, gp: false, eg: false, vl: false, f: ['fe'],
      });
    };
    await m.analyzeCommercialMessage('un message', mockHaiku);
    const delta = m.updateConfidence();
    expect(delta).toBeCloseTo(-1.9, 5); // open_generic +0.10, fe -2
    expect(m.getConfidence()).toBeCloseTo(4.1, 5);
    expect(m.getState().cooldownTurns).toBe(2);
  });

  it('initObjectionStateFromSwitch : ajuste la résistance (conf/cons bas → -2)', () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionStateFromSwitch(['o1', 'o2']);
    expect(m.getActiveObjectionResistance()).toBeCloseTo(4, 5);
  });

  it('initObjectionStateWithResistance : applique pcmModifier', () => {
    const m = new SimulationStateManager('moyen');
    m.initObjectionStateWithResistance(['o1'], 2);
    expect(m.getActiveObjectionResistance()).toBeCloseTo(5.5, 5);
    expect(m.getFullModePhase()).toBe('objections');
  });

  it('applyHaikuCResult : parse HaikuC invalide → lastHaikuCSy false, pas d\'analyse', async () => {
    const m = new SimulationStateManager('moyen');
    const mockHaiku = async (_prompt: string, system?: string): Promise<string> => {
      if (system === HAIKU_A_SYSTEM) {
        return JSON.stringify({ r: [false, 'n'], e: [false, 'n'], f: [], cq: 'a', pd: false });
      }
      return 'json cassé {{{';
    };
    await m.analyzeCommercialMessage('un message', mockHaiku);
    expect(m.getHaikuCAnalysis()).toBeNull();
    expect(m.getState().lastHaikuCSy).toBe(false);
  });

  it('applyHaikuCResult : appel HaikuC rejeté → lastHaikuCSy false', async () => {
    const m = new SimulationStateManager('moyen');
    const mockHaiku = async (_prompt: string, system?: string): Promise<string> => {
      if (system === HAIKU_A_SYSTEM) {
        return JSON.stringify({ r: [false, 'n'], e: [false, 'n'], f: [], cq: 'a', pd: false });
      }
      throw new Error('HaikuC down');
    };
    await m.analyzeCommercialMessage('un message', mockHaiku);
    expect(m.getState().lastHaikuCSy).toBe(false);
  });
});

/**
 * haiku-diagnostic-mapper.ts — mapping/fallback de la sortie HaikuA (diagnostic)
 * et application du résultat HaikuC sur le state. Extrait verbatim de
 * simulation-state-manager.ts (chantier #2).
 */

import type { HaikuAnalysis, HaikuCAnalysis, SimulationState } from './simulation-state-types.ts';
import { safeParseJson } from './state-parse-helpers.ts';
import { postProcessHaikuC } from './haiku-c-postprocess.ts';

/** Mappe la réponse slim de HaikuA en HaikuAnalysis, avec fallback sur erreur de parse. */
export function mapHaikuADiagnostic(resultA: PromiseSettledResult<string>): HaikuAnalysis {
  try {
    const slimA = safeParseJson(resultA.status === 'fulfilled' ? resultA.value : '{}');
    const flagMap: Record<string, string> = {
      pl: 'pressure', pr: 'pressure', pe: 'price_early',
      fe: 'formation_early', cc: 'closed_chain', re: 'poor_listening', cs: 'poor_listening',
    };
    return {
      reformulation: Array.isArray(slimA.r) ? Boolean(slimA.r[0]) : false,
      reformulation_quality: Array.isArray(slimA.r)
        ? (({ a: 'accurate', p: 'partial', n: 'none' } as Record<string, string>)[slimA.r[1]] || 'none') as any
        : 'none',
      question_type: 'open_generic',
      empathy_detected: Array.isArray(slimA.e) ? Boolean(slimA.e[0]) : false,
      empathy_quality: Array.isArray(slimA.e)
        ? (({ a: 'authentic', g: 'generic', n: 'none' } as Record<string, string>)[slimA.e[1]] || 'none') as any
        : 'none',
      good_transition: false,
      red_flags: (slimA.f || []).map((f: string) => flagMap[f]).filter(Boolean) as any[],
      topics_addressed: [],
      commercial_quality: (({ s: 'strong', a: 'average', w: 'weak' } as Record<string, string>)[slimA.cq] || 'average') as any,
      presentation_detected: slimA.pd ?? false,
    };
  } catch (e) {
    console.error('[ModularSim] HaikuA parse failed, using fallback:', e);
    return {
      reformulation: false,
      reformulation_quality: 'none',
      question_type: 'open_generic',
      empathy_detected: false,
      empathy_quality: 'none',
      good_transition: false,
      red_flags: [],
      topics_addressed: [],
      commercial_quality: 'average',
      presentation_detected: false,
    };
  }
}

/**
 * Applique le résultat HaikuC (signal extractor) sur le state : parse, postProcess
 * (R1-R7), persistance (lastHaikuCAnalysis / lastHaikuCSy) et logs.
 */
export function applyHaikuCResult(
  state: SimulationState,
  resultC: PromiseSettledResult<string>,
  commercialMessage: string,
  prevProspect: string,
  redFlags: string[],
): void {
  if (resultC.status === 'fulfilled') {
    try {
      const rawC = safeParseJson(resultC.value);
      const haikuAFlags = (redFlags || []).map(f => {
        const map: Record<string, string> = {
          'poor_listening': 'pl', 'pressure': 'pr',
          'price_early': 'pe', 'formation_early': 'fe', 'closed_chain': 'cc',
        };
        return map[f] || f;
      });

      const haikuC = postProcessHaikuC(
        rawC as HaikuCAnalysis,
        commercialMessage,
        prevProspect,
        haikuAFlags
      );

      state.lastHaikuCAnalysis = haikuC;
      state.lastHaikuCSy = haikuC.sy;

      console.log(`[ModularSim] HaikuC | qt:${haikuC.qt} qd:${haikuC.qd} ph:${haikuC.ph} rv:[${haikuC.rv.join(',')}] sy:${haikuC.sy} gp:${haikuC.gp} eg:${haikuC.eg} vl:${haikuC.vl} f:[${haikuC.f.join(',')}]`);
    } catch (e) {
      console.error('[ModularSim] HaikuC parse failed:', e);
      state.lastHaikuCSy = false;
    }
  } else {
    console.error('[ModularSim] HaikuC call failed:', resultC.reason);
    state.lastHaikuCSy = false;
  }
}

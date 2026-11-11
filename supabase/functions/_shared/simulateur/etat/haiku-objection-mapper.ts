/**
 * haiku-objection-mapper.ts — mapping/fallback de la sortie HaikuB (objections).
 * Extrait verbatim de simulation-state-manager.ts (chantier #2).
 */

import type { HaikuObjectionAnalysis, ObjectionRedFlag } from './simulation-state-types.ts';

/** Mappe la réponse slim de HaikuB en HaikuObjectionAnalysis. */
export function mapHaikuObjection(slimData: any): HaikuObjectionAnalysis {
  return {
    od: slimData.od ?? true,
    accueillir: Array.isArray(slimData.ac) ? slimData.ac[0] : false,
    accueillir_quality: Array.isArray(slimData.ac)
      ? ({ e: 'empathique', m: 'mecanique', a: 'absent' }[slimData.ac[1] as string] || 'absent') as any
      : 'absent',
    isoler: slimData.is ?? false,
    challenger: Array.isArray(slimData.ch) ? slimData.ch[0] : false,
    challenger_quality: Array.isArray(slimData.ch)
      ? ({ p: 'pertinent', f: 'faible', a: 'absent' }[slimData.ch[1] as string] || 'absent') as any
      : 'absent',
    uses_gap: slimData.ug ?? false,
    uses_success_story: slimData.us ?? false,
    attempts_close: slimData.at ?? false,
    red_flags: (slimData.f || []).map((f: string) => ({
      pr: 'pressure', di: 'dismisses_objection', re: 'repeats_same_argument',
      ig: 'ignores_emotion', jc: 'jumps_to_close',
    }[f])).filter(Boolean) as ObjectionRedFlag[],
    addresses_objection: slimData.ao ?? false,
  };
}

/** Fallback HaikuB en cas d'échec d'appel/parse. */
export function haikuObjectionFallback(): HaikuObjectionAnalysis {
  return {
    od: true,
    accueillir: false,
    accueillir_quality: 'absent',
    isoler: false,
    challenger: false,
    challenger_quality: 'absent',
    uses_gap: false,
    uses_success_story: false,
    attempts_close: false,
    red_flags: [],
    addresses_objection: false,
  };
}

/**
 * haiku-c-postprocess.ts — post-traitement R1-R7 du signal extractor (HaikuC).
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 */

import type { HaikuCAnalysis } from './simulation-state-types.ts';

export function postProcessHaikuC(raw: HaikuCAnalysis, commercialMessage: string, prospectMessage: string, haikuAFlags: string[]): HaikuCAnalysis {
  const result: HaikuCAnalysis = { ...raw, rv: [...raw.rv], f: [...raw.f] };

  // R1 : st/v + qd non-x → forcer qd=x
  if ((result.qt === 'st' || result.qt === 'v') && result.qd !== 'x') {
    result.qd = 'x';
  }

  // R2 : o/f + qd=x → fallback qd=s
  if ((result.qt === 'o' || result.qt === 'f') && result.qd === 'x') {
    result.qd = 's';
  }

  // R3 : qd invalide → fallback qd=s
  if (!['s', 'c', 'e', 'i', 'x'].includes(result.qd)) {
    result.qd = 's';
  }

  // R4 : gp=true + sy=false → forcer sy=true
  if (result.gp && !result.sy) {
    result.sy = true;
  }

  // R5a : sy ou eg sans ph=p5 → forcer ph=p5
  if ((raw.sy || raw.eg) && result.ph !== 'p5') {
    result.ph = 'p5';
  }

  // R5b : ph=p5 sans sy ni eg → déclasser ph=xx
  if (result.ph === 'p5' && !result.sy && !result.eg) {
    result.ph = 'xx';
  }

  // R6 : anti-écho em — si le prospect ne fait que reprendre le vocabulaire du commercial
  const EMOTIONAL_VOCAB = [
    'frustrant','frustré','frustration','coincé','coincée','bloqué','bloquée',
    'épuisant','épuisé','épuisée','stressant','stressé','fait chier','fais chier',
    'honte','peur','ronge','bouffe','tue','dors plus','marre',
    'invisible','légitime','fraude','nul','nulle','vidée','vidé',
  ];

  if (result.rv.includes('em') && commercialMessage && prospectMessage) {
    const cLower = commercialMessage.toLowerCase();
    const pLower = prospectMessage.toLowerCase();
    const prospectEmo = EMOTIONAL_VOCAB.filter(w => pLower.includes(w));
    const newEmo = prospectEmo.filter(w => !cLower.includes(w));
    if (prospectEmo.length > 0 && newEmo.length === 0) {
      result.rv = result.rv.filter(t => t !== 'em');
    }
  }

  // R7 : vl=frank incompatible avec flag pl (poor_listening)
  if (result.vl === 'frank' && haikuAFlags.includes('pl')) {
    result.vl = 'soft';
  }

  return result;
}

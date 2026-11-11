// Simulateur · la voix du prospect : les voix (ElevenLabs), le genre deviné d'après le prénom, le nettoyage du texte avant la
// voix, le découpage en phrases pendant le flux, les nombres dits en toutes lettres, le filtre des transcriptions vides,
// et l'appel à ElevenLabs (clé ELEVENLABS_API_KEY des secrets des fonctions ; sans clé, le navigateur parle lui-même).
export const VOIX = [
  { id: "IbbR6Av0dWuQJS0b8JVT", name: "Hugo", gender: "M" },
  { id: "ufWL6S7fryuQBD3Y5J3I", name: "Jérémy", gender: "M" },
  { id: "HuLbOdhRlvQQN8oPP0AJ", name: "Claire", gender: "F" },
  { id: "3C1zYzXNXNzrB66ON8rj", name: "Jade", gender: "F" },
] as const;
export const VOIX_HOMME = "IbbR6Av0dWuQJS0b8JVT";
export const VOIX_FEMME = "HuLbOdhRlvQQN8oPP0AJ";

const PRENOMS_MASCULINS = new Set([
  "stéphane", "stephane", "philippe", "pierre", "andré", "andre",
  "baptiste", "claude", "dominique", "jérôme", "jerome", "antoine",
  "alexandre", "maxime", "théodore", "theodore", "grégoire", "gregoire",
  "ange", "brice", "cédric", "cedric", "cyrille", "dieudonné",
  "dieudonne", "elie", "emile", "émile", "eugène", "eugene",
  "fabrice", "france", "frédérique", "gaspard", "gustave",
  "hervé", "herve", "hippolyte", "honoré", "honore", "ignace",
  "josué", "josue", "jude", "kyliane", "lance", "lazare",
  "léonce", "leonce", "luce", "modeste", "moïse", "moise",
  "narcisse", "nice", "olive", "patrice", "placide", "prince",
  "régis", "rene", "rené", "rosaire", "sévère", "severe",
  "serge", "sylvestre", "théophile", "theophile", "timothée", "timothee",
  "ulysse", "valère", "valere", "yannick", "zacharie",
  "moussa", "mustafa", "mustapha", "boubacar", "alpha", "mamadou",
  "ousmane", "abdoulaye", "souleymane", "issa", "drissa", "lamine",
  "ibrahima", "bakary", "fodé", "fode", "konaté", "konate",
  "aymane", "hamza", "amine", "youssoupha", "bilal", "taha",
  "enzo", "mattéo", "matteo", "léo", "leo", "hugo", "ange",
  "côme", "come", "blaise", "basile", "achille",
]);

const PRENOMS_FEMININS = new Set([
  "sophie", "marie", "charlotte", "nathalie", "isabelle", "claire",
  "julie", "emma", "léa", "lea", "camille", "céline", "celine",
  "laura", "sarah", "valérie", "valerie", "stéphanie", "stephanie",
  "caroline", "amandine", "aurélie", "aurelie", "émilie", "emilie",
  "anne", "catherine", "françoise", "francoise", "christine",
  "sandrine", "sylvie", "patricia", "martine", "monique", "nicole",
  "brigitte", "dominique", "asmae", "yasmine", "fatima", "amina",
  "khadija", "leila", "leïla", "meryem", "nadia", "samira",
  "zineb", "houda", "salma", "ihsane", "afaf", "zhora",
  "mathilde", "perrine", "margaux", "manon", "chloé", "chloe",
  "juliette", "alice", "lucie", "inès", "ines", "jade",
  "lina", "mila", "rosa", "anna", "nina", "lola", "clara",
  "eva", "elsa", "iris", "maya", "lena", "léna", "noémie", "noemie",
]);

export function genreDuPrenom(prenom: string): "M" | "F" {
  const p = (prenom || "").toLowerCase().trim().normalize("NFC");
  if (PRENOMS_MASCULINS.has(p)) return "M";
  if (PRENOMS_FEMININS.has(p)) return "F";
  if (p.endsWith("ette") || p.endsWith("elle") || p.endsWith("ine") || p.endsWith("ienne")) return "F";
  if (p.endsWith("eur") || p.endsWith("ien") || p.endsWith("ard") || p.endsWith("aud") || p.endsWith("ald")) return "M";
  return "M";
}

// Une seule règle, côté serveur (à l'origine l'écran et le serveur ne choisissaient pas toujours la même voix)
export function voixParDefaut(prenom: string): string {
  return genreDuPrenom(prenom) === "F" ? VOIX_FEMME : VOIX_HOMME;
}

// La voix la moins utilisée de ce genre parmi les prospects de l'offre (assignVoice d'origine)
export function choisirVoix(genre: "M" | "F", dejaPrises: (string | null)[]): string {
  const pool = VOIX.filter((v) => v.gender === genre);
  const n = new Map<string, number>();
  for (const v of dejaPrises) if (v) n.set(v, (n.get(v) || 0) + 1);
  let best: string = pool[0].id, min = Infinity;
  for (const v of pool) { const c = n.get(v.id) || 0; if (c < min) { min = c; best = v.id; } }
  return best;
}

// Avant la voix : sans [annotations], sans *gestes*, « 9 500 » d'un seul tenant (cleanTextForTTS d'origine)
export function nettoyerPourVoix(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\*[^*]+\*/g, "")
    .replace(/(\d)\s+(\d)/g, "$1$2")
    .replace(/\n{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Une transcription vide ou faite de points n'est pas une réplique (filtre d'origine)
export function transcriptionVide(t: string): boolean {
  return !t || /^[\.\s…]+$/.test(t) || t.replace(/[.\s…]/g, "").length < 2;
}

// Le découpage en phrases pendant le flux (findSentenceEnd / findVoiceBreakPoint d'origine)
const FR_ABBREVIATIONS = new Set([
  "m.", "mme.", "mr.", "dr.", "pr.", "st.", "etc.", "ex.", "cf.", "av.", "apr.",
  "env.", "éd.", "vol.", "p.", "pp.", "fig.", "ch.", "art.", "n°.",
]);

export function finDePhrase(buf: string): number {
  for (let i = 0; i < buf.length - 1; i++) {
    const char = buf[i];
    const next = buf[i + 1];

    if (char === "." && i > 0 && buf[i - 1] === ".") continue;
    if (char === "." && i < buf.length - 1 && buf[i + 1] === ".") continue;

    if (char === ".") {
      const wordStart = buf.lastIndexOf(" ", i - 1) + 1;
      const word = buf.substring(wordStart, i + 1).toLowerCase();
      if (FR_ABBREVIATIONS.has(word)) continue;

      if (next >= "0" && next <= "9") continue;

      if (
        next === " " || next === "\n" || next === '"' ||
        next === "\u00AB" || next === "\u00BB"
      ) {
        const afterSpace = i + 2 < buf.length ? buf[i + 2] : "";
        if (afterSpace && afterSpace === afterSpace.toLowerCase() && afterSpace !== afterSpace.toUpperCase()) {
          continue;
        }
        return i;
      }
    }

    if (
      (char === "!" || char === "?" || char === "\u2026") &&
      (next === " " || next === "\n" || next === '"' || next === "\u00AB" || next === "\u00BB")
    ) {
      return i;
    }

    if (char === ";" && (next === " " || next === "\n") && i > 60) {
      return i;
    }
  }
  return -1;
}

export function decoupeVoix(buf: string): number {
  const sentenceEnd = finDePhrase(buf);
  if (sentenceEnd !== -1) return sentenceEnd;
  if (buf.length < 35) return -1;
  for (let i = 30; i < buf.length - 1; i++) {
    const char = buf[i];
    const next = buf[i + 1];
    if ((char === "," || char === ":") && (next === " " || next === "\n")) {
      return i;
    }
  }
  return -1;
}


// Les nombres dits en toutes lettres (numberToFrench d'origine) : la voix lit « neuf mille cinq cents euros »
const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];

function convertBelow100(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return 'dix-' + UNITS[n - 10];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
    if (u === 0) return tens[t];
    if (u === 1) return tens[t] + ' et un';
    return tens[t] + '-' + UNITS[u];
  }
  if (n < 80) {
    const u = n - 60;
    if (u === 11) return 'soixante et onze';
    return 'soixante-' + convertBelow100(u);
  }
  if (n === 80) return 'quatre-vingts';
  return 'quatre-vingt-' + convertBelow100(n - 80);
}

function numberToFrenchWords(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return 'moins ' + numberToFrenchWords(-n);
  if (n < 100) return convertBelow100(n);

  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let result = h === 1 ? 'cent' : UNITS[h] + ' cents';
    if (r > 0) {
      result = h === 1 ? 'cent' : UNITS[h] + ' cent';
      result += ' ' + convertBelow100(r);
    }
    return result;
  }

  if (n < 1000000) {
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    let result = t === 1 ? 'mille' : numberToFrenchWords(t) + ' mille';
    if (r > 0) result += ' ' + numberToFrenchWords(r);
    return result;
  }

  if (n < 1000000000) {
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    let result = numberToFrenchWords(m) + (m === 1 ? ' million' : ' millions');
    if (r > 0) result += ' ' + numberToFrenchWords(r);
    return result;
  }

  return String(n);
}

export function nombresEnLettres(text: string): string {
  let result = text.replace(
    /(\d[\d\s]*\d|\d)(?:,(\d+))?\s*(K€|k€|K\s*€|€|%)/g,
    (match, numStr, decimals, suffix) => {
      const clean = numStr.replace(/\s/g, '');
      let num = parseInt(clean, 10);
      if (isNaN(num) || num > 999999999) return match;
      const normalized = suffix.replace(/\s/g, '').toLowerCase();
      if (normalized === 'k€') {
        return numberToFrenchWords(num * 1000) + ' euros';
      }
      let r = numberToFrenchWords(num);
      if (decimals) {
        const decNum = parseInt(decimals, 10);
        r += ' virgule ' + numberToFrenchWords(decNum);
      }
      if (suffix.trim() === '€') r += ' euros';
      else if (suffix.trim() === '%') r += ' pourcent';
      return r;
    }
  );

  result = result.replace(
    /\b(\d[\d\s]*\d|\d),(\d+)\b/g,
    (match, numStr, decimals) => {
      const clean = numStr.replace(/\s/g, '');
      const num = parseInt(clean, 10);
      const decNum = parseInt(decimals, 10);
      if (isNaN(num) || num > 999999999) return match;
      return numberToFrenchWords(num) + ' virgule ' + numberToFrenchWords(decNum);
    }
  );

  result = result.replace(
    /\b(\d[\d\s]*\d|\d)\b/g,
    (match, numStr) => {
      const clean = numStr.replace(/\s/g, '');
      const num = parseInt(clean, 10);
      if (isNaN(num) || num > 999999999) return match;
      return numberToFrenchWords(num);
    }
  );

  return result;
}

// Les chiffres d'un morceau de flux ne sont convertis qu'une fois complets (« 9 500 € » jamais coupé en deux)
export function convertisseurFlux() {
  let reste = "";
  return {
    push(text: string): string {
      const combined = reste + text;
      const m = combined.match(/^([\s\S]*?)(\d[\d\s]*)$/);
      if (m && m[2]) { reste = m[2]; return m[1] ? nombresEnLettres(m[1]) : ""; }
      reste = "";
      return nombresEnLettres(combined);
    },
    fin(): string { const r = reste; reste = ""; return r ? nombresEnLettres(r) : ""; },
  };
}

export type ReglagesVoix = { modelId: string; stability: number; style: number; speed: number };

// ElevenLabs : le texte (nettoyé, 2 000 caractères au plus) → le flux audio mp3 ; une nouvelle tentative sur 429 / 5xx
export async function elevenLabs(key: string, p: { texte: string; voiceId: string; config: ReglagesVoix },
  fetchFn: (u: string, i: RequestInit) => Promise<Response> = fetch): Promise<Response> {
  const body = JSON.stringify({
    text: p.texte.slice(0, 2000), model_id: p.config.modelId || "eleven_flash_v2_5",
    voice_settings: { stability: p.config.stability ?? 0.2, similarity_boost: 1, style: p.config.style ?? 0.2, use_speaker_boost: true, speed: p.config.speed ?? 1.2 },
  });
  for (let essai = 0; ; essai++) {
    const r = await fetchFn(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(p.voiceId)}/stream`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" }, body,
    });
    if (r.ok && r.body) return r;
    if ((r.status === 429 || r.status >= 500) && essai < 1) { await new Promise((x) => setTimeout(x, 500)); continue; }
    throw new Error(`ElevenLabs ${r.status}`);
  }
}

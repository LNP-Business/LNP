// Simulateur · la mesure de réalisme d'une simulation (v0.13). Les mêmes statistiques que sur les vrais appels R1 de LNP
// (549 appels Fathom de mai à novembre 2026, 10 minutes ou plus), comparées aux cibles mesurées :
//   part de parole du prospect 46 % des mots (de 37 à 56 % selon le prospect) ; 55 mots par réponse du prospect en moyenne ;
//   20 % des réponses du prospect font plus de 80 mots ; une réponse du prospect sur quatre contient une question.
// Calculée à la fin de chaque simulation et gardée dans crm_sim_simulations.usage.realisme ; lue dans l'historique.
export type Realisme = {
  tours_prospect: number;
  tours_commercial: number;
  mots_prospect: number;
  mots_commercial: number;
  part_prospect: number | null;          // % des mots dits par le prospect
  mots_par_tour_prospect: number | null;
  mots_par_tour_commercial: number | null;
  part_tours_longs: number | null;       // % des réponses du prospect de plus de 80 mots
  part_questions_prospect: number | null; // % des réponses du prospect avec une question
  cibles: typeof CIBLES;
  ecarts: string[];                      // ce qui s'éloigne des vrais appels, en français
  note: number | null;                   // 0-100 : la proximité avec les vrais appels
};

export const CIBLES = {
  part_prospect: { cible: 46, min: 37, max: 56 },
  mots_par_tour_prospect: { cible: 55, min: 40, max: 75 },
  part_tours_longs: { cible: 20, min: 12, max: 30 },
  part_questions_prospect: { cible: 25, min: 15, max: 35 },
};

const MIN_TOURS = 6;   // en dessous, la mesure ne veut rien dire

export function mots(t: string): number {
  const m = String(t || "").trim().match(/[^\s]+/g);
  return m ? m.length : 0;
}

export function mesurerRealisme(messages: { role: string; content: string }[]): Realisme {
  const P = messages.filter((m) => m.role === "prospect"), C = messages.filter((m) => m.role === "commercial");
  const wp = P.map((m) => mots(m.content)), wc = C.map((m) => mots(m.content));
  const mp = wp.reduce((a, b) => a + b, 0), mc = wc.reduce((a, b) => a + b, 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.round(100 * a / b) : null);
  const r: Realisme = {
    tours_prospect: P.length, tours_commercial: C.length, mots_prospect: mp, mots_commercial: mc,
    part_prospect: pct(mp, mp + mc),
    mots_par_tour_prospect: P.length ? Math.round(mp / P.length) : null,
    mots_par_tour_commercial: C.length ? Math.round(mc / C.length) : null,
    part_tours_longs: pct(wp.filter((w) => w > 80).length, P.length),
    part_questions_prospect: pct(P.filter((m) => /\?/.test(m.content)).length, P.length),
    cibles: CIBLES, ecarts: [], note: null,
  };
  if (P.length < MIN_TOURS) { r.ecarts.push("Trop court pour mesurer le réalisme (moins de 6 réponses du prospect)"); return r; }
  const libelles: Record<keyof typeof CIBLES, [string, string, string]> = {
    part_prospect: ["Le prospect parle trop peu", "Le prospect parle trop", "% des mots"],
    mots_par_tour_prospect: ["Réponses du prospect trop courtes", "Réponses du prospect trop longues", "mots par réponse"],
    part_tours_longs: ["Pas assez de longues réponses du prospect (plus de 80 mots)", "Trop de longues réponses du prospect", "% des réponses"],
    part_questions_prospect: ["Le prospect ne pose pas assez de questions", "Le prospect pose trop de questions", "% des réponses"],
  };
  let total = 0, n = 0;
  for (const k of Object.keys(CIBLES) as (keyof typeof CIBLES)[]) {
    const v = r[k]; if (v == null) continue;
    const c = CIBLES[k];
    const d = v < c.min ? (c.min - v) / (c.cible - c.min) : v > c.max ? (v - c.max) / (c.max - c.cible) : 0;
    total += Math.max(0, 1 - d); n++;
    if (v < c.min) r.ecarts.push(`${libelles[k][0]} : ${v} ${libelles[k][2]} (vrais appels : ${c.cible})`);
    else if (v > c.max) r.ecarts.push(`${libelles[k][1]} : ${v} ${libelles[k][2]} (vrais appels : ${c.cible})`);
  }
  r.note = n ? Math.round(100 * total / n) : null;
  return r;
}

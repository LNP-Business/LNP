// Grille d'analyse · prétraitement des transcriptions — étape déterministe avant P1 (porté tel quel).
// Les lignes peuvent porter un préfixe horodaté « [HH:MM:SS] » ou « [MM:SS] », retiré AVANT la regex de locuteur,
// converti en secondes et conservé dans la structure (champ debut) — jamais dans le texte formaté transmis à P1.
//
// Trois opérations, aucune n'est un jugement :
//   1. Regroupement des tours consécutifs d'un même locuteur
//   2. Numérotation des prises de parole (index de tour exploitable)
//   3. Calcul du poids de parole par locuteur, en caractères
//
// Ce traitement appartient au code, pas au modèle : regroupement mécanique, pas d'interprétation.
//
// En plus (normaliseur des simulations) : les messages d'une simulation → une ligne par message, « COMMERCIAL: » ou
// « PROSPECT: ». Le vendeur est TOUJOURS étiqueté COMMERCIAL et le prétraitement reçoit ce nom (ROLE_COMMERCIAL) : les rôles
// ne dépendent plus du nombre de questions posées (à l'origine, un prospect qui questionnait plus que le vendeur inversait
// les rôles dans toutes les consignes).

export const ROLE_COMMERCIAL = "COMMERCIAL";

export interface MessageSimulation {
  role: string; // "commercial" | "prospect"
  content: string;
}

/**
 * Normalise les messages d'une simulation :
 * - une ligne par message (pas d'horodatage), dans l'ordre ;
 * - les sauts de ligne internes deviennent des espaces (on n'invente rien) ;
 * - le rôle sur chaque ligne : COMMERCIAL pour la personne qui s'entraîne, PROSPECT sinon.
 */
export function normaliserTranscriptSimulation(messages: MessageSimulation[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "commercial" ? ROLE_COMMERCIAL : "PROSPECT";
      const texte = String(msg.content ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join(" ");
      return `${role}: ${texte}`;
    })
    .join("\n");
}

export interface Tour {
  locuteur: string;
  texte: string;
  // Horodatage du tour converti en secondes, ou null si la ligne n'en porte pas.
  debut: number | null;
}

export type Role = "SALES" | "PROSPECT";

export interface PoidsParole {
  charsSales: number;
  charsProspect: number;
  toursSales: number;
  toursProspect: number;
  partProspectCaracteres: number | null;
  avertissement: string;
}

export interface ResultatPretraitement {
  transcriptFormate: string;
  nbToursBruts: number;
  nbPrisesParole: number;
  tauxFragmentation: number;
  roles: Record<string, Role>;
  poidsParole: PoidsParole;
  // Au moins un tour brut porte un horodatage.
  horodatagesDisponibles: boolean;
  // Part des tours bruts qui portent un horodatage.
  tauxHorodatage: number;
  // false si < 50 % des lignes non vides ont un locuteur identifiable, ou si
  // moins de 10 prises regroupées alors que le transcript compte > 50 tours
  // bruts — garde-fou contre un format inconnu silencieusement écrasé.
  formatReconnu: boolean;
  // Motif du rejet : "locuteur_unique" quand un seul locuteur est identifié
  // sur l'ensemble du transcript, "format_non_reconnu" pour les autres rejets,
  // null quand formatReconnu vaut vrai.
  motifRejet: "format_non_reconnu" | "locuteur_unique" | null;
}

const LIGNE_LOCUTEUR = /^([^:]{2,45}):\s*(.*)$/;
// Préfixe horodaté en tête de ligne : [HH:MM:SS] ou [MM:SS].
const PREFIXE_HORODATAGE = /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*/;

function extraireHorodatage(ligne: string): {
  reste: string;
  debut: number | null;
} {
  const m = PREFIXE_HORODATAGE.exec(ligne);
  if (!m) return { reste: ligne, debut: null };
  const heures = m[1] !== undefined ? parseInt(m[1], 10) : 0;
  const minutes = parseInt(m[2], 10);
  const secondes = parseInt(m[3], 10);
  return {
    reste: ligne.slice(m[0].length),
    debut: heures * 3600 + minutes * 60 + secondes,
  };
}

// Découpe le transcript brut en tours { locuteur, texte, debut }.
// Les lignes sans locuteur identifiable sont rattachées au tour précédent.
export function parserTours(transcript: string): Tour[] {
  const tours: Tour[] = [];
  for (const brute of transcript.split("\n")) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const { reste, debut } = extraireHorodatage(ligne);
    const m = LIGNE_LOCUTEUR.exec(reste);
    if (m) {
      tours.push({ locuteur: m[1].trim(), texte: m[2].trim(), debut });
    } else if (tours.length > 0) {
      const dernier = tours[tours.length - 1];
      dernier.texte = `${dernier.texte} ${reste.trim()}`.trim();
    }
  }
  return tours;
}

// Fusionne les tours consécutifs d'un même locuteur en une prise de parole.
// Une prise de parole conserve l'horodatage de son PREMIER tour.
export function regrouper(tours: Tour[]): Tour[] {
  if (tours.length === 0) return [];
  const groupes: Tour[] = [{ ...tours[0] }];
  for (const tour of tours.slice(1)) {
    const dernier = groupes[groupes.length - 1];
    if (tour.locuteur === dernier.locuteur) {
      dernier.texte = `${dernier.texte} ${tour.texte}`.trim();
      if (dernier.debut === null && tour.debut !== null) {
        // Le premier tour du groupe n'avait pas d'horodatage : on garde le
        // premier horodatage rencontré dans le groupe.
        dernier.debut = tour.debut;
      }
    } else {
      groupes.push({ ...tour });
    }
  }
  return groupes.filter((g) => g.texte.length > 0);
}

// Associe chaque locuteur à SALES ou PROSPECT.
// Si le nom du sales est fourni, il fait foi. Sinon, heuristique : le sales
// est celui qui pose le plus de questions.
export function identifierRoles(
  groupes: Tour[],
  nomSales?: string,
): Record<string, Role> {
  const locuteurs = new Map<string, { questions: number; chars: number }>();
  for (const { locuteur, texte } of groupes) {
    const d = locuteurs.get(locuteur) ?? { questions: 0, chars: 0 };
    d.questions += (texte.match(/\?/g) ?? []).length;
    d.chars += texte.length;
    locuteurs.set(locuteur, d);
  }

  const attribuer = (sales: string): Record<string, Role> => {
    const roles: Record<string, Role> = {};
    for (const loc of Array.from(locuteurs.keys())) {
      roles[loc] = loc === sales ? "SALES" : "PROSPECT";
    }
    return roles;
  };

  if (nomSales) {
    const cible = nomSales.toLowerCase();
    for (const loc of Array.from(locuteurs.keys())) {
      const l = loc.toLowerCase();
      if (cible.includes(l) || l.includes(cible)) {
        return attribuer(loc);
      }
    }
  }

  let sales: string | null = null;
  let maxQuestions = -1;
  for (const [loc, d] of Array.from(locuteurs.entries())) {
    if (d.questions > maxQuestions) {
      maxQuestions = d.questions;
      sales = loc;
    }
  }
  return sales === null ? {} : attribuer(sales);
}

// Poids de parole en caractères, par rôle.
// ATTENTION — ce n'est PAS un ratio de temps de parole : approximation par
// volume de texte, non substituable au ratio temporel exigé par l'item L5.
export function poidsParole(
  groupes: Tour[],
  roles: Record<string, Role>,
): PoidsParole {
  const total: Record<Role, number> = { SALES: 0, PROSPECT: 0 };
  const toursParRole: Record<Role, number> = { SALES: 0, PROSPECT: 0 };
  for (const { locuteur, texte } of groupes) {
    const r: Role = roles[locuteur] ?? "PROSPECT";
    total[r] += texte.length;
    toursParRole[r] += 1;
  }
  const somme = total.SALES + total.PROSPECT;
  return {
    charsSales: total.SALES,
    charsProspect: total.PROSPECT,
    toursSales: toursParRole.SALES,
    toursProspect: toursParRole.PROSPECT,
    partProspectCaracteres:
      somme > 0 ? Math.round((total.PROSPECT / somme) * 10000) / 10000 : null,
    avertissement:
      "approximation par volume de texte, non substituable au ratio temporel",
  };
}

// Produit le transcript numéroté et étiqueté, prêt pour P1.
// L'horodatage ne figure JAMAIS ici : il vit uniquement dans la structure.
export function formaterPourP1(
  groupes: Tour[],
  roles: Record<string, Role>,
): string {
  return groupes
    .map(
      (g, i) => `[${i + 1}] ${g.locuteur} (${roles[g.locuteur] ?? "?"}): ${g.texte}`,
    )
    .join("\n");
}

// Chaîne complète. Retourne le transcript formaté et ses métadonnées.
export function pretraiter(
  transcript: string,
  nomSales?: string,
): ResultatPretraitement {
  const bruts = parserTours(transcript);
  const groupes = regrouper(bruts);
  const roles = identifierRoles(groupes, nomSales);
  const horodates = bruts.filter((t) => t.debut !== null).length;
  const lignesNonVides = transcript
    .split("\n")
    .filter((l) => l.trim().length > 0).length;
  const tauxLocuteur = lignesNonVides > 0 ? bruts.length / lignesNonVides : 0;
  const locuteursDistincts = new Set(groupes.map((g) => g.locuteur)).size;
  const locuteurUnique = bruts.length > 0 && locuteursDistincts <= 1;
  const formatReconnu =
    !locuteurUnique &&
    tauxLocuteur >= 0.5 &&
    !(groupes.length < 10 && bruts.length > 50);
  const motifRejet: "format_non_reconnu" | "locuteur_unique" | null =
    formatReconnu ? null : locuteurUnique ? "locuteur_unique" : "format_non_reconnu";
  return {
    transcriptFormate: formaterPourP1(groupes, roles),
    nbToursBruts: bruts.length,
    nbPrisesParole: groupes.length,
    tauxFragmentation:
      bruts.length > 0
        ? Math.round((1 - groupes.length / bruts.length) * 10000) / 10000
        : 0,
    roles,
    poidsParole: poidsParole(groupes, roles),
    horodatagesDisponibles: horodates > 0,
    tauxHorodatage:
      bruts.length > 0 ? Math.round((horodates / bruts.length) * 10000) / 10000 : 0,
    formatReconnu,
    motifRejet,
  };
}

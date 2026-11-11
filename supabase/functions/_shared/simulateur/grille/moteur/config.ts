/**
 * Grille d'analyse · Moteur d'agrégation — configuration
 *
 * Ce fichier contient TOUT ce qui est susceptible de changer après
 * calibration : seuils, pondérations, conditions de validité.
 *
 * Le code ne contient aucune valeur numérique de règle métier. Le jour où
 * la calibration donne d'autres seuils, on modifie ce fichier seul et on
 * incrémente VERSION_SEUILS. Aucune analyse produite sous une version
 * antérieure ne doit être comparée à une analyse produite sous la nouvelle.
 */

import type { CodeItem, CodeEtape, Nature, TypeAppel } from "./types.ts";

/** Version du référentiel de bornage. Figée. (Libellés des conditions traduits pour l'écran : le sens ne change pas.) */
export const VERSION_GRILLE = "GRILLE_v1.0";

/**
 * Version des seuils. À incrémenter à CHAQUE modification de ce fichier.
 * v0.9 = seuils proposés à l'origine, non calibrés.
 * v0.10 = l'éliminatoire A1 ne se déclenche plus en R2 et R3 (le gap a été
 *         validé lors d'un appel antérieur ; le verdict de l'item A1 reste
 *         évalué normalement). Une analyse v0.9 ne se compare pas à une v0.10.
 * v0.11 = alignement sur la doctrine de référence (14/08/2026) : grille
 *         90 points / 19 items notés (L2 8→7, L3 11→7, E3 11→8, R2 5→3),
 *         cinq conditions éliminatoires dont deux suspendues, prématurité
 *         par comparaison d'horodatages, ancre de pitch unique, distinction
 *         non_applicable / non_evaluable. Une analyse v0.10 ne se compare
 *         pas à une v0.11.
 * v0.12 = référentiel Impact / Vision (19/08/2026). L3 devient « Questions
 *         Impact » : Correct exige ≥ 2 questions d'impact rattachées au MÊME
 *         problème (preuve par événement, jamais par simple compte) ET un
 *         coût verbalisé par le prospect. L4 devient « Vision » — critère
 *         inchangé, seul le nom change. Une analyse v0.11 ne se compare pas
 *         à une v0.12.
 */
export const VERSION_SEUILS = "v0.12";

// ─────────────────────────────────────────────────────────────
// Pondérations
// ─────────────────────────────────────────────────────────────

export interface DefinitionItem {
  code: CodeItem;
  etape: CodeEtape;
  nature: Nature;
  points: number;
  /** Un item hors score est collecté mais ne rapporte rien. */
  hors_score?: boolean;
}

/**
 * Les 19 items notés, dont L5 qui est calculé sans modèle.
 * Total : 90 points — grille de la doctrine de référence (arbitrage du
 * 14/08/2026). C3, A4 et R6 sont hors score.
 *
 * L5 reste non évaluable faute de diarisation : le dénominateur effectif
 * courant est 87 sur 18 items. Il est TOUJOURS calculé, jamais écrit en
 * dur — c'est ce qui permet à un item non évaluable d'en sortir sans
 * fausser le résultat.
 */
export const ITEMS: DefinitionItem[] = [
  // C · Connect — 10 pts (C3 hors score)
  { code: "C1", etape: "C", nature: "geste", points: 4 },
  { code: "C2", etape: "C", nature: "geste", points: 6 },

  // L · Listen & Layer — 29 pts
  { code: "L1", etape: "L", nature: "geste", points: 3 },
  { code: "L2", etape: "L", nature: "effet", points: 7 },
  { code: "L3", etape: "L", nature: "effet", points: 7 },
  { code: "L4", etape: "L", nature: "effet", points: 5 },
  { code: "L5", etape: "L", nature: "effet", points: 3 },
  { code: "L6", etape: "L", nature: "effet", points: 4 },

  // E · Expose the Gap — 20 pts
  { code: "E1", etape: "E", nature: "geste", points: 7 },
  { code: "E2", etape: "E", nature: "geste", points: 5 },
  { code: "E3", etape: "E", nature: "effet", points: 8 },

  // A · Align — 13 pts (A4 hors score)
  { code: "A1", etape: "A", nature: "ordre", points: 6 },
  { code: "A2", etape: "A", nature: "geste", points: 4 },
  { code: "A3", etape: "A", nature: "ordre", points: 3 },

  // R · Resolve & Request — 18 pts (R6 hors score)
  { code: "R1", etape: "R", nature: "geste", points: 2 },
  { code: "R2", etape: "R", nature: "geste", points: 3 },
  { code: "R3", etape: "R", nature: "effet", points: 3 },
  { code: "R4", etape: "R", nature: "geste", points: 4 },
  { code: "R5", etape: "R", nature: "geste", points: 6 },
];

/** Total attendu de la grille. Sert au contrôle de cohérence, jamais au score. */
export const TOTAL_GRILLE = 90;

/** Un verdict partiel rapporte la moitié des points, arrondie au dixième. */
export const RATIO_PARTIEL = 0.5;

// ─────────────────────────────────────────────────────────────
// Seuils quantitatifs — version 0.9, non calibrés
// ─────────────────────────────────────────────────────────────

/**
 * Seuils proposés dans le document de validation d'origine.
 * Chacun porte le test de séparation qui doit le confirmer.
 */
export const SEUILS = {
  /**
   * L1 · Questions Situation
   * Correct : ≥ 2 questions de contexte avec réponses factuelles.
   * Test prévu : corrélation en cloche sur l'issue. Si confirmée,
   * ajouter un plafond dur vers 6.
   */
  L1_QUESTIONS_MIN: 2,
  L1_PLAFOND: null as number | null,

  /**
   * L2 · Questions Problème
   * Correct : ≥ 2 questions dont la 2e creuse la 1re, + douleur citable.
   * Test prévu : ≥ 75 % des conclus atteignent le seuil contre ≤ 40 % des
   * perdus. Sinon replier sur « ≥ 1 question + creusement » — le
   * creusement porte le signal, pas le compte.
   */
  L2_QUESTIONS_MIN: 2,
  L2_CREUSEMENT_REQUIS: true,

  /**
   * L3 · Questions Impact (v0.12)
   * Correct : au moins ce nombre de questions d'impact rattachées au MÊME
   * problème (le rattachement vient des événements extraits, jamais d'une
   * déduction du moteur) + coût verbalisé par le prospect.
   * Deux questions sur deux problèmes différents sont deux amorces, pas un
   * creusement.
   */
  L3_QUESTIONS_MEME_PROBLEME_MIN: 2,

  /**
   * L5 · Ratio de parole sur le segment L
   * Mesuré sur le seul segment de diagnostic, pas sur l'appel entier.
   */
  L5_CORRECT: 0.70,
  L5_PARTIEL: 0.55,

  /**
   * L6 · Profondeur du diagnostic
   * Correct : 3 échanges consécutifs sur le problème dominant.
   * Test prévu : comparer 2, 3 et 4 ; retenir le seuil qui maximise la
   * séparation conclus / perdus.
   */
  L6_ECHANGES_MIN: 3,
  L6_ECHANGES_PARTIEL: 2,

  /**
   * C2 · Cadre du call
   * Quatre composants : durée, déroulé, accord obtenu, décision attendue.
   */
  C2_COMPOSANTS_CORRECT: 4,
  C2_COMPOSANTS_PARTIEL_MIN: 2,

  /**
   * A2 · Pitch en 4 blocs — structure J7.
   */
  A2_BLOCS_CORRECT: 4,
  A2_BLOCS_PARTIEL_MIN: 2,

  /**
   * E1 · Formulation du GAP — trois composants.
   */
  E1_COMPOSANTS_CORRECT: 3,
  E1_COMPOSANTS_PARTIEL_MIN: 1,
} as const;

// ─────────────────────────────────────────────────────────────
// Conditions de validité
// ─────────────────────────────────────────────────────────────

/**
 * Un appel qui ne remplit pas ces conditions n'est pas mal noté : il est
 * marqué non évaluable et sort du dénominateur des moyennes.
 */
export const VALIDITE = {
  /**
   * Ratio de parole du prospect sur l'appel entier.
   * En dessous, la matière première de l'évaluation est absente : un sales
   * face à un prospect mutique serait systématiquement sous-noté.
   */
  RATIO_PAROLE_MIN: 0.25,

  /** Le segment de diagnostic doit avoir été atteint. */
  SEGMENT_L_REQUIS: true,

  /** L'issue commerciale doit être renseignée pour que l'appel serve à la calibration. */
  ISSUE_REQUISE_POUR_CALIBRATION: true,

  /** Nombre minimal de prises de parole pour qu'un appel soit analysable. */
  PRISES_PAROLE_MIN: 20,
} as const;

/**
 * Plafond appliqué au score lorsque l'éliminatoire se déclenche.
 *
 * L'éliminatoire sanctionne un pitch présenté avant validation du GAP, sans
 * retour au diagnostic — la faute que le manuel liste comme capitale au J6.
 *
 * Valeur retenue : 25. Elle place l'appel sous tout seuil de grade — le
 * message est qu'il ne compte pas comme un appel conduit, quelle que soit la
 * qualité du reste. Elle laisse néanmoins une gradation : le détail par
 * étape reste visible, et deux appels éliminés se distinguent encore par
 * leur diagnostic. Un plafond à zéro effacerait cette information et
 * rendrait le coaching aveugle.
 *
 * À confirmer par calibration : quelle est la distribution réelle des scores
 * d'appels avec pitch prématuré ? Si elle est déjà sous 25, le plafond ne
 * sert à rien. Si elle est au-dessus de 60, il faudra vérifier qu'il ne
 * masque pas des appels par ailleurs bien conduits.
 */
export const PLAFOND_ELIMINATOIRE = 25;

// ─────────────────────────────────────────────────────────────
// Conditions éliminatoires — liste ET filtre de suspension au même endroit
// ─────────────────────────────────────────────────────────────

/**
 * Les cinq conditions de la doctrine de référence. Une condition suspendue
 * est constatée et affichée, jamais appliquée : la mesure qui la fonde
 * n'atteint pas 9/10 de fiabilité, et on ne sanctionne pas sur une mesure
 * incertaine — mais on ne l'efface pas non plus, sinon la dette disparaît
 * des radars.
 *
 * Le filtre de suspension vit ICI et nulle part ailleurs : le moteur ne
 * plafonne que via plafonneLeScore(), un appelant ne peut pas le contourner.
 */
export const CONDITIONS_ELIMINATOIRES: ReadonlyArray<{
  code: import("./types.ts").CodeCondition;
  libelle: string;
  etat: "active" | "suspendue";
}> = [
  { code: "CADRE_NON_POSE", libelle: "Cadre de l'appel jamais posé", etat: "active" },
  { code: "PITCH_AVANT_GAP", libelle: "Offre présentée avant la synthèse de l'écart", etat: "active" },
  // SUSPENDUE (arbitrage 14/08/2026) : signal mesuré à 8/10, sous la barre
  // de 9/10 qui commande la suspension. La garde de position (retour
  // strictement postérieur à l'ancre de pitch) est conservée — c'est elle
  // qui permettra la réactivation quand la mesure atteindra 9/10.
  { code: "RETOUR_DIAGNOSTIC", libelle: "Question de diagnostic reposée après la présentation de l'offre", etat: "suspendue" },
  { code: "GAP_NON_FORMULE", libelle: "Écart jamais formulé", etat: "suspendue" },
  { code: "PITCH_DESALIGNE", libelle: "Valeur présentée sans lien avec le diagnostic", etat: "suspendue" },
] as const;

/**
 * SEUL point de décision du plafonnement : une condition ne plafonne le
 * score que si elle est ACTIVE et DÉCLENCHÉE. Suspendue ou indéterminée,
 * elle est présente dans la sortie mais n'applique rien.
 */
export function plafonneLeScore(c: {
  etat: "active" | "suspendue";
  statut: "declenchee" | "non_declenchee" | "indeterminee";
}): boolean {
  return c.etat === "active" && c.statut === "declenchee";
}

/** Taille d'échantillon en dessous de laquelle un agrégat est affiché grisé. */
export const SEUIL_ECHANTILLON = 15;

/** Fenêtre de mesure par défaut, en semaines. */
export const FENETRE_SEMAINES = 8;

// ─────────────────────────────────────────────────────────────
// Templates par type d'appel
// ─────────────────────────────────────────────────────────────

/**
 * Un appel se score contre son rôle dans le cycle, pas contre la méthode
 * absolue. Refaire toute la découverte en R2 est une faute de vente : la
 * grille mono-call la récompenserait.
 *
 * Les items exclus d'un template sont marqués non applicables et sortent
 * du dénominateur. Le score est ensuite ramené sur 100.
 */
export const TEMPLATES: Record<TypeAppel, { items_exclus: CodeItem[]; libelle: string }> = {
  R1: {
    items_exclus: [],
    libelle: "Premier rendez-vous — grille complète",
  },
  R2: {
    // En R2, on ne refait pas la découverte : on re-valide le gap.
    //
    // Toute la phase de diagnostic est exclue, pas seulement les questions
    // de contexte et de problème : un sales qui refait l'exploration des
    // conséquences et la projection en R2 commet la même faute que s'il
    // refaisait la découverte. Le manuel est explicite là-dessus.
    //
    // E1 et E2 restent notés : la re-validation du gap suppose de le
    // reformuler. E3 aussi : c'est elle qui autorise la suite.
    items_exclus: ["L1", "L2", "L3", "L4", "L6"],
    libelle: "Second rendez-vous — re-validation, pas re-découverte",
  },
  R3: {
    // Appel de décision : ni découverte ni formulation du gap.
    items_exclus: ["L1", "L2", "L3", "L4", "L6", "E1", "E2"],
    libelle: "Appel de décision — objections et engagement",
  },
  setting: {
    // Un appel de setting se score contre une checklist dédiée, à écrire.
    items_exclus: ["L1", "L2", "L3", "L4", "L5", "L6", "E1", "E2", "E3", "A1", "A2", "A3"],
    libelle: "Prise de rendez-vous — checklist dédiée à définir",
  },
  diagnostic: {
    // Simulation en mode « diagnostic uniquement ».
    // Seules les phases C, L, E sont jouées : le pitch (A) et le traitement
    // des objections (R) ne font pas partie du scénario.
    // A1-A3 et R1-R5 sont donc exclus. Le mécanisme non_applicable s'applique
    // normalement (ces items sortent du dénominateur, leur score vaut 0).
    items_exclus: ["A1", "A2", "A3", "R1", "R2", "R3", "R4", "R5"],
    libelle: "Simulation diagnostic — phases C, L et E uniquement",
  },
};

// ─────────────────────────────────────────────────────────────
// Contrôles de cohérence de la configuration
// ─────────────────────────────────────────────────────────────

/** Total des points du template R1. Doit valoir TOTAL_GRILLE. */
export function totalPoints(): number {
  return ITEMS.filter((i) => !i.hors_score).reduce((s, i) => s + i.points, 0);
}

/** Vérifie que la configuration est cohérente. À appeler au démarrage. */
export function verifierConfig(): string[] {
  const erreurs: string[] = [];

  const total = totalPoints();
  if (total !== TOTAL_GRILLE) {
    erreurs.push(`Le total des points vaut ${total}, attendu ${TOTAL_GRILLE}.`);
  }

  const codes = ITEMS.map((i) => i.code);
  const doublons = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (doublons.length > 0) {
    erreurs.push(`Items en double : ${doublons.join(", ")}.`);
  }

  if (SEUILS.L5_PARTIEL >= SEUILS.L5_CORRECT) {
    erreurs.push("Le seuil partiel de L5 doit être inférieur au seuil correct.");
  }

  for (const [type, tpl] of Object.entries(TEMPLATES)) {
    const inconnus = tpl.items_exclus.filter((c) => !codes.includes(c));
    if (inconnus.length > 0) {
      erreurs.push(`Template ${type} exclut des items inconnus : ${inconnus.join(", ")}.`);
    }
  }

  return erreurs;
}

/**
 * Grille d'analyse · Moteur d'agrégation — types
 *
 * Référentiel : grille d'analyse v1.0 (porté tel quel ; seuls les libellés lus par les personnes sont traduits).
 *
 * Ce fichier ne contient aucune règle métier : uniquement la forme des
 * données qui entrent et qui sortent. Les seuils vivent dans config.ts,
 * les règles dans regles.ts.
 */

// ─────────────────────────────────────────────────────────────
// Verdicts et natures
// ─────────────────────────────────────────────────────────────

/**
 * Deux verdicts hors score, jamais confondus :
 * - non_applicable : le geste n'avait pas lieu d'être (pas d'objection, pas
 *   de pitch, item exclu du template). L'item sort du dénominateur et toute
 *   condition éliminatoire fondée sur lui s'ÉTEINT.
 * - non_evaluable : la matière manque (étape non collectée, timings absents).
 *   L'item sort du dénominateur mais une condition éliminatoire fondée sur
 *   lui devient INDÉTERMINÉE — elle ne plafonne pas et ne disparaît pas.
 */
export type Verdict = "correct" | "partiel" | "absent" | "non_applicable" | "non_evaluable";

export type Nature = "geste" | "effet" | "ordre";

export type CodeItem =
  | "C1" | "C2"
  | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  | "E1" | "E2" | "E3"
  | "A1" | "A2" | "A3"
  | "R1" | "R2" | "R3" | "R4" | "R5";

export type CodeEtape = "C" | "L" | "E" | "A" | "R";

// ─────────────────────────────────────────────────────────────
// Entrées — sorties brutes des prompts
// ─────────────────────────────────────────────────────────────

export interface SortieP1 {
  version_grille: string;
  unite_temporelle: string;
  nb_prises_parole: number;
  segments: Segment[];
  ordre_observe: CodeEtape[];
  issue_structurelle: IssueStructurelle;
  verbatim_disqualification: string | null;
  verbatim_engagement: string | null;
  moments: Record<string, Moment>;
  objections: ObjectionP1[];
  anomalies: string[];
}

export type IssueStructurelle =
  | "cycle_complet"
  | "engagement_acte"
  | "prochain_pas_planifie"
  | "disqualification"
  | "interrompu";

export interface Segment {
  code: CodeEtape;
  occurrence: number;
  present: boolean;
  debut: number | null;
  fin: number | null;
  verbatim_debut: string | null;
}

export interface Moment {
  present: boolean;
  prise_de_parole: number | null;
  verbatim: string | null;
}

export interface ObjectionP1 {
  id: string;
  type: string;
  prise_de_parole: number;
  verbatim: string;
  reprise_ulterieure: boolean;
  prise_de_parole_reprise: number | null;
}

/** Sorties des cinq prompts de collecte, telles quelles. */
export interface Collecte {
  c?: BlocC;
  l?: BlocL;
  e?: BlocE;
  a?: BlocA;
  r?: BlocR;
}

export interface BlocC {
  premiere_question_business: number | null;
  c1: Record<string, unknown>;
  c2: Record<string, unknown>;
  c3: Record<string, unknown>;
  anomalies: string[];
}

export interface BlocL {
  l1: Record<string, unknown>;
  l2: Record<string, unknown>;
  /**
   * Signaux L3 · Questions Impact (v0.12). Contrat attendu :
   * - questions_impact : Array<{ probleme: string; verbatim_question: string;
   *   prise_de_parole: number }> — un événement par question d'impact du
   *   SALES, rattaché à un problème court et stable. C'est cette liste qui
   *   fonde « ≥ 2 questions sur le même problème ».
   * - cout_verbalise_prospect, type_cout, cout_chiffre, verbatim_cout,
   *   prise_de_parole : inchangés.
   * Un payload legacy (questions_implication_nb scalaire, sans événements)
   * reste lisible mais ne peut jamais valoir Correct (voir verdictL3).
   */
  l3: Record<string, unknown>;
  l4: Record<string, unknown>;
  l6: Record<string, unknown>;
  anomalies: string[];
}

export interface BlocE {
  synthese_localisee: boolean;
  e1: Record<string, unknown>;
  e2: Record<string, unknown>;
  e3: Record<string, unknown>;
  anomalies: string[];
}

export interface BlocA {
  pitch_localise: boolean;
  a1: Record<string, unknown>;
  a2: Record<string, unknown>;
  a3: Record<string, unknown>;
  a4: Record<string, unknown>;
  anomalies: string[];
}

export interface BlocR {
  nb_objections: number;
  objections: Record<string, unknown>[];
  cloture: Record<string, unknown>;
  bloquante: Record<string, unknown>;
  anomalies: string[];
}

/** Signaux contestés par le vérifieur. Un signal contesté repasse à false. */
export interface SortieVerifieur {
  signaux_contestes: {
    champ: string;
    etape?: string;
    objection_id?: string;
    /**
     * Verbatim cité par le vérifieur. Requis pour contester UNE entrée de
     * l.l3.questions_impact (champ "l3_questions_impact") : l'entrée dont le
     * verbatim_question correspond est retirée. Sans verbatim ou sans
     * correspondance, la liste ENTIÈRE est vidée (fail-closed : le vérifieur
     * ne peut que retirer).
     */
    verbatim_conteste?: string | null;
  }[];
  confiance_globale: number;
  alerte: string | null;
}

/** Mesures calculées hors modèle, sur la diarisation. */
export interface MesuresDeterministes {
  /** Ratio de parole du prospect sur l'appel entier. Null si pas de timings. */
  ratio_parole_global: number | null;
  /** Ratio de parole du prospect sur le seul segment L. Null si pas de timings. */
  ratio_parole_segment_l: number | null;
  /** Nombre de monologues du sales dépassant 60 secondes. */
  monologues_60s: number | null;
  /** Durée totale en secondes. */
  duree_secondes: number | null;
  /** Type d'appel, issu du CRM. Conditionne le template appliqué. */
  type_appel: TypeAppel;
  /** Issue commerciale, issue du CRM. Variable de contrôle, jamais un item. */
  issue_commerciale: IssueCommerciale | null;
}

/**
 * Types d'appel reconnus par le pipeline de la grille.
 *
 * - R1 / R2 / R3 / setting : types CRM historiques.
 * - diagnostic : appel de simulation en mode diagnostic uniquement.
 *   Le template exclut les items A1-A3 (phase Align) et R1-R5 (phase Resolve)
 *   car ces phases ne sont pas jouées dans ce mode.
 */
export type TypeAppel = "R1" | "R2" | "R3" | "setting" | "diagnostic";
export type IssueCommerciale = "closed" | "perdu" | "en_cours" | "disqualifie";

// ─────────────────────────────────────────────────────────────
// Sorties du moteur
// ─────────────────────────────────────────────────────────────

export interface ResultatItem {
  code: CodeItem;
  nature: Nature;
  verdict: Verdict;
  points_obtenus: number;
  points_max: number;
  /** Signaux ayant fondé le verdict, pour l'audit. */
  signaux: Record<string, unknown>;
  /** Renseigné si le vérifieur a contesté un signal de cet item. */
  signaux_contestes: string[];
  /** Renseigné quand le verdict ne peut pas être établi. */
  motif_non_applicable: string | null;
}

export interface ResultatEtape {
  code: CodeEtape;
  items: ResultatItem[];
  points_obtenus: number;
  points_max: number;
  /** Part d'items en verdict correct, hors non applicables. Null si aucun item évaluable. */
  taux_conformite: number | null;
}

// ─────────────────────────────────────────────────────────────
// Conditions éliminatoires
// ─────────────────────────────────────────────────────────────

export type CodeCondition =
  | "CADRE_NON_POSE"
  | "PITCH_AVANT_GAP"
  | "RETOUR_DIAGNOSTIC"
  | "GAP_NON_FORMULE"
  | "PITCH_DESALIGNE";

/**
 * Statut d'une condition sur un appel donné :
 * - declenchee     : la faute est constatée ;
 * - non_declenchee : la faute n'a pas eu lieu, ou n'avait pas lieu d'être ;
 * - indeterminee   : la matière manque pour trancher. Ne plafonne jamais,
 *   ne disparaît jamais de la sortie.
 */
export type StatutCondition = "declenchee" | "non_declenchee" | "indeterminee";

export interface ConditionEliminatoire {
  code: CodeCondition;
  libelle: string;
  /** Une condition suspendue est constatée et affichée, jamais appliquée. */
  etat: "active" | "suspendue";
  statut: StatutCondition;
  /** Pourquoi ce statut — motif d'indétermination ou preuve du déclenchement. */
  motif: string | null;
}

export interface ResultatAnalyse {
  version_grille: string;
  version_seuils: string;
  type_appel: TypeAppel;

  /** Faux si l'appel ne remplit pas les conditions de validité. */
  evaluable: boolean;
  motifs_non_evaluable: string[];

  /** Vrai si une condition ACTIVE s'est déclenchée (le score est plafonné). */
  eliminatoire_declenche: boolean;
  /** Les cinq conditions, toujours toutes présentes dans la sortie. */
  conditions: ConditionEliminatoire[];
  /** Score normalisé AVANT plafond. Toujours renseigné quand le score l'est. */
  score_hors_plafond: number | null;

  etapes: ResultatEtape[];
  points_obtenus: number;
  points_max: number;
  /** Score ramené sur 100, en tenant compte des items non applicables. */
  score_sur_100: number | null;

  issue_structurelle: IssueStructurelle;
  issue_commerciale: IssueCommerciale | null;

  /** Signaux collectés sans points : C3, A4, R6. */
  hors_score: Record<string, unknown>;

  /** Alertes de fiabilité, non bloquantes. */
  avertissements: string[];
}

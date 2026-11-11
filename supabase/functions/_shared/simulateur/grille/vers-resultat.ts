// Grille d'analyse · conversion du résultat du moteur vers le `result` stocké (crm_sim_analyses.result) et lu par l'écran.
// Portage du convertisseur d'origine : mêmes règles, mêmes clés, sauf
//   - `_modele: "grille"` et la clé `grille` (versions, score avant plafond, conditions) ;
//   - la dimension R s'appelle `conclusion` ;
//   - tous les libellés lus par une personne sont en français (items, étapes, conditions, signaux manquants, motifs).
// Règles :
// - scoreMax = maximum RÉEL de l'étape (items non évaluables déduits) ;
// - un item non_evaluable (ou non_applicable) n'est PAS envoyé, statut toujours ∈ correct|partiel|absent ;
// - verbatim jamais vide quand un signal est affirmé (extrait des signaux) ;
// - annotations : une par item évalué, aucune pour un non évaluable ;
// - score_total = score plafonné ; le second chiffre (« sans ce plafond ») ne s'affiche QUE si le plafond a mordu ;
// - turning_point : null — on n'invente pas de tournant ;
// - la cible de l'exercice est choisie par le code, jamais par un modèle.
import type { CodeCondition, ResultatAnalyse, ResultatItem } from "./moteur/types.ts";
import { PLAFOND_ELIMINATOIRE } from "./moteur/config.ts";

// ─── Niveaux (identifiants gardés, libellés en français) ─────
export type NiveauAppel = "insuffisant" | "discovery" | "diagnostic" | "strategic" | "elite";
export const NIVEAUX: NiveauAppel[] = ["insuffisant", "discovery", "diagnostic", "strategic", "elite"];
export const SEUILS_NIVEAU_APPEL: Record<NiveauAppel, number> = {
  insuffisant: 0,
  discovery: 50,
  diagnostic: 65,
  strategic: 75,
  elite: 85,
};
export const LIBELLES_NIVEAU: Record<NiveauAppel, string> = {
  insuffisant: "Insuffisant",
  discovery: "Découverte",
  diagnostic: "Diagnostic",
  strategic: "Stratégique",
  elite: "Élite",
};

// ─── Libellés des 19 items (table fermée, français) ─────────
export const LIBELLES_ITEMS: Record<string, string> = {
  C1: "Connexion personnelle avant d'entrer dans le vif du sujet",
  C2: "Cadre de l'appel posé et accepté",
  L1: "Questions de situation (faits)",
  L2: "Problème creusé et verbalisé par le prospect",
  L3: "Impact : coût du problème verbalisé par le prospect",
  L4: "Vision : projection vers l'état futur",
  L5: "Part d'écoute pendant la découverte",
  L6: "Dialogue soutenu (échanges consécutifs)",
  E1: "Synthèse de l'écart : point A, point B, blocage",
  E2: "Mots exacts du prospect réutilisés",
  E3: "Validation de l'écart par le prospect, avant la présentation de l'offre",
  A1: "Offre présentée après l'écart validé",
  A2: "Présentation structurée : problème, mécanisme, transformation, preuve",
  A3: "Valeur avant le prix, reliée à l'écart",
  R1: "Objection accueillie sans contre-attaque",
  R2: "Objection isolée avant d'y répondre",
  R3: "Clarification : un élément nouveau du prospect",
  R4: "Retour à la douleur avec les mots du prospect",
  R5: "Demande de décision posée",
};

// Les cinq dimensions (étape → clé du JSON → libellé)
export const ETAPE_VERS_CLE: Record<string, string> = {
  C: "structure",
  L: "diagnostic",
  E: "valeur",
  A: "pcm",
  R: "conclusion",
};
export const LIBELLES_DIMENSIONS: Record<string, string> = {
  structure: "Connexion",
  diagnostic: "Écoute",
  valeur: "Exposition",
  pcm: "Alignement",
  conclusion: "Résolution",
};
const NOMS_ETAPES: Record<string, string> = {
  C: "C · Connexion",
  L: "L · Écoute",
  E: "E · Exposition",
  A: "A · Alignement",
  R: "R · Résolution",
};

const LIBELLES_CONDITIONS: Record<CodeCondition, string> = {
  CADRE_NON_POSE: "cadre de l'appel jamais posé",
  PITCH_AVANT_GAP: "offre présentée avant la synthèse de l'écart",
  RETOUR_DIAGNOSTIC: "question de diagnostic reposée après la présentation de l'offre",
  GAP_NON_FORMULE: "écart jamais formulé",
  PITCH_DESALIGNE: "valeur présentée sans lien avec le diagnostic",
};

const CORRECTIFS_CONDITIONS: Record<CodeCondition, string> = {
  CADRE_NON_POSE: "Poser durée, déroulé et décision attendue dans les deux premières minutes.",
  PITCH_AVANT_GAP: "Ne présenter l'offre qu'après la synthèse de l'écart, validée par le prospect.",
  RETOUR_DIAGNOSTIC: "Terminer le diagnostic avant de présenter l'offre : plus aucune question de découverte ensuite.",
  GAP_NON_FORMULE: "Formuler l'écart point A / point B / blocage avant toute présentation.",
  PITCH_DESALIGNE: "Relier chaque bloc de valeur à un élément verbalisé du diagnostic.",
};

// Signaux (clés des collectes) → libellé lu par la personne, pour « Signaux manquants : … »
const LIBELLES_SIGNAUX: Record<string, string> = {
  connexion_presente: "connexion personnelle",
  information_reprise: "information reprise",
  avant_business: "avant le sujet professionnel",
  duree_annoncee: "durée annoncée",
  deroule_annonce: "déroulé annoncé",
  accord_obtenu: "accord obtenu",
  decision_attendue: "décision attendue annoncée",
  cadre_apres_diagnostic: "cadre posé après le diagnostic",
  reponses_factuelles: "réponses factuelles",
  interrogatoire: "interrogatoire",
  douleur_verbalisee_prospect: "douleur verbalisée par le prospect",
  creusement: "problème creusé",
  cout_verbalise_prospect: "coût verbalisé par le prospect",
  cout_chiffre: "coût chiffré",
  question_projection: "question de projection",
  etat_futur_verbalise_prospect: "état futur verbalisé par le prospect",
  element_specifique: "élément spécifique apporté par le prospect",
  point_a: "point A (situation actuelle)",
  point_b: "point B (situation souhaitée)",
  blocage: "blocage",
  mots_exacts_reutilises: "mots exacts du prospect réutilisés",
  demande_validation: "demande de validation",
  confirmation_prospect: "confirmation du prospect",
  acquiescement_seul: "simple acquiescement",
  avant_pitch: "avant la présentation de l'offre",
  retour_diagnostic: "retour au diagnostic",
  validation_apres_retour: "validation après le retour",
  prix_demande_par_prospect: "prix demandé par le prospect",
  bloc_probleme: "bloc problème",
  bloc_mecanisme: "bloc mécanisme",
  bloc_transformation: "bloc transformation",
  bloc_preuve: "bloc preuve",
  valeur_avant_prix: "valeur avant le prix",
  valeur_reliee_au_gap: "valeur reliée à l'écart",
  r1_acknowledge: "objection accueillie",
  r1_accuse_minimal: "accusé de réception minimal",
  r2_isolate: "objection isolée",
  r2_avant_reponse: "avant la réponse",
  r3_clarify: "question de clarification",
  r3_element_nouveau_prospect: "élément nouveau du prospect",
  r4_looping_present: "retour à la douleur",
  r4_apres_aic: "après l'accueil de l'objection",
  r4_aic_absent: "accueil de l'objection absent",
  r4_mots_prospect: "mots du prospect",
  r5_ask_present: "demande de décision",
  r5_prochain_pas_pose: "prochain pas posé",
  r5_pression_asks_repetes: "demandes répétées",
  r5_pression_urgence_invoquee: "urgence invoquée",
  r5_pression_report_refuse: "report refusé",
};
export function libelleSignal(cle: string): string {
  return LIBELLES_SIGNAUX[cle] ?? cle.replace(/^[a-z]\d_/, "").replace(/_/g, " ");
}

// Motifs du moteur → texte lu par la personne
const LIBELLES_MOTIFS: Record<string, string> = {
  etape_non_collectee: "Étape non collectée (le modèle n'a pas répondu).",
  timings_diarisation_absents: "Non mesurable : la simulation n'a pas de minutage de la parole.",
  pitch_positionne_sans_segment_e: "L'offre a été présentée sans synthèse de l'écart.",
  segment_e_non_atteint: "L'appel n'est pas allé jusqu'à la synthèse de l'écart.",
  aucun_pitch_presente: "Aucune offre présentée.",
  aucune_offre_presentee: "Aucune offre présentée.",
  aucune_objection: "Aucune objection dans l'appel.",
  item_non_code: "Item non codé.",
  pitch_signale_sans_position: "Offre signalée sans position dans l'appel.",
  synthese_sans_position: "Synthèse de l'écart sans position dans l'appel.",
  prematurite_indeterminee: "Ordre offre / écart indéterminé.",
};
export function libelleMotif(motif: string | null): string {
  if (!motif) return "";
  if (motif.startsWith("exclu_du_template_")) return "Hors du périmètre de ce mode de simulation.";
  return LIBELLES_MOTIFS[motif] ?? motif.replace(/_/g, " ");
}

// ─── Cible de l'exercice — choisie par le CODE, jamais par un modèle ──
const PILIERS_DRILL = ["L2", "L3", "E3", "A1", "R5"] as const;
/** Ordre d'amont des conditions actives (le plus tôt dans l'appel d'abord). */
const ORDRE_AMONT: CodeCondition[] = [
  "CADRE_NON_POSE",
  "PITCH_AVANT_GAP",
  "RETOUR_DIAGNOSTIC",
  "GAP_NON_FORMULE",
  "PITCH_DESALIGNE",
];
// Types d'exercice (identifiants ; libellés dans LIBELLES_TYPES_EXERCICE)
const TYPE_DRILL_PILIER: Record<(typeof PILIERS_DRILL)[number], string> = {
  L2: "decouverte",
  L3: "impact",
  E3: "gap",
  A1: "gap",
  R5: "objection",
};
const TYPE_DRILL_CONDITION: Record<CodeCondition, string> = {
  CADRE_NON_POSE: "cadrage",
  PITCH_AVANT_GAP: "gap",
  RETOUR_DIAGNOSTIC: "decouverte",
  GAP_NON_FORMULE: "gap",
  PITCH_DESALIGNE: "gap",
};
export const LIBELLES_TYPES_EXERCICE: Record<string, string> = {
  cadrage: "Cadrage",
  decouverte: "Questions de découverte",
  impact: "Impact",
  gap: "Écart",
  objection: "Objections et décision",
};

export interface CibleDrill {
  type: string;
  /** Item pilier ou condition, pour le prompt de rédaction. */
  cible: string;
  description: string;
}

function tousItems(analyse: ResultatAnalyse): ResultatItem[] {
  return analyse.etapes.flatMap((e) => e.items);
}

/**
 * Le pilier qui perd le plus de points parmi L2, L3, E3, A1, R5 — sauf si un éliminatoire est déclenché : alors la
 * condition la plus en amont.
 */
export function choisirCibleDrill(analyse: ResultatAnalyse): CibleDrill | null {
  const declenchees = analyse.conditions.filter((c) => c.etat === "active" && c.statut === "declenchee");
  if (declenchees.length > 0) {
    const amont = ORDRE_AMONT.find((code) => declenchees.some((c) => c.code === code))!;
    return {
      type: TYPE_DRILL_CONDITION[amont],
      cible: amont,
      description: `Condition éliminatoire : ${LIBELLES_CONDITIONS[amont]}. ${CORRECTIFS_CONDITIONS[amont]}`,
    };
  }
  const candidats: { code: string; perdu: number }[] = [];
  for (const item of tousItems(analyse)) {
    if (!(PILIERS_DRILL as readonly string[]).includes(item.code)) continue;
    if (item.points_max <= 0) continue; // non évaluable / non applicable
    const perdu = item.points_max - item.points_obtenus;
    if (perdu > 0) candidats.push({ code: item.code, perdu });
  }
  if (candidats.length === 0) return null;
  // Deux piliers à MOINS de 2 points d'écart sont à égalité → le plus en amont dans l'appel (ordre de PILIERS_DRILL).
  const maxPerdu = Math.max(...candidats.map((c) => c.perdu));
  const aEgalite = candidats.filter((c) => maxPerdu - c.perdu < 2);
  const pire = [...aEgalite].sort(
    (a, b) => (PILIERS_DRILL as readonly string[]).indexOf(a.code) - (PILIERS_DRILL as readonly string[]).indexOf(b.code),
  )[0];
  return {
    type: TYPE_DRILL_PILIER[pire.code as (typeof PILIERS_DRILL)[number]],
    cible: pire.code,
    description: `Pilier le plus coûteux de l'appel : ${pire.code} — ${LIBELLES_ITEMS[pire.code]} (${pire.perdu} points perdus).`,
  };
}

// ─── Extraction des verbatims depuis les signaux ─────────────
/** Premier verbatim non vide trouvé dans les signaux d'un item (audit du modèle). */
export function extraireVerbatim(signaux: Record<string, unknown>): string {
  for (const [cle, valeur] of Object.entries(signaux)) {
    if (!cle.includes("verbatim")) continue;
    if (typeof valeur === "string" && valeur.trim() !== "") return valeur.trim();
  }
  // Signaux imbriqués (objections agrégées, sous-objets, tableaux).
  for (const valeur of Object.values(signaux)) {
    if (Array.isArray(valeur)) {
      for (const element of valeur) {
        if (element && typeof element === "object") {
          const v = extraireVerbatim(element as Record<string, unknown>);
          if (v) return v;
        }
      }
    } else if (valeur && typeof valeur === "object") {
      const v = extraireVerbatim(valeur as Record<string, unknown>);
      if (v) return v;
    }
  }
  return "";
}

/** Commentaire déterministe : signaux false de l'item, jamais un texte inventé. */
function commentaireItem(item: ResultatItem): string {
  if (item.verdict === "correct") return "";
  const manquants = Object.entries(item.signaux)
    .filter(([cle, v]) => v === false && !cle.includes("verbatim"))
    .map(([cle]) => libelleSignal(cle));
  if (manquants.length === 0) return libelleMotif(item.motif_non_applicable);
  return `Signaux manquants : ${manquants.join(", ")}.`;
}

const STATUTS_ENVOYES = new Set(["correct", "partiel", "absent"]);
const EVALUATION_PAR_STATUT: Record<string, string> = {
  correct: "positif",
  partiel: "partiel",
  absent: "negatif",
};

export function calculerNiveau(score: number): NiveauAppel {
  let niveau: NiveauAppel = "insuffisant";
  for (const [nom, seuil] of Object.entries(SEUILS_NIVEAU_APPEL) as [NiveauAppel, number][]) {
    if (score >= seuil && seuil >= SEUILS_NIVEAU_APPEL[niveau]) niveau = nom;
  }
  return niveau;
}

function construirePointFort(analyse: ResultatAnalyse): string {
  let meilleure: { code: string; part: number; obtenus: number; max: number } | null = null;
  for (const e of analyse.etapes) {
    if (e.points_max <= 0) continue;
    const part = e.points_obtenus / e.points_max;
    if (meilleure === null || part > meilleure.part) {
      meilleure = { code: e.code, part, obtenus: e.points_obtenus, max: e.points_max };
    }
  }
  if (!meilleure) return "Aucune étape évaluable sur cet appel.";
  return `Étape la mieux tenue : ${NOMS_ETAPES[meilleure.code]} — ${nombre(meilleure.obtenus)}/${nombre(meilleure.max)} points.`;
}

// Un nombre écrit à la française (virgule décimale), comme le reste de l'écran
function nombre(n: number | null): string {
  return n === null ? "—" : String(n).replace(".", ",");
}

/**
 * « Chantier prioritaire » :
 * - le second chiffre (« Sans ce plafond : n/100 ») ne s'affiche QUE si le plafond a MORDU (score hors plafond > plafond) ;
 * - éliminatoire déclenché sans morsure → constat sans second chiffre ;
 * - sans éliminatoire → le pilier qui perd le plus de points.
 */
export function construirePointFaible(analyse: ResultatAnalyse): string {
  const declenchees = analyse.conditions.filter((c) => c.etat === "active" && c.statut === "declenchee");
  if (declenchees.length > 0) {
    const libelles = declenchees.map((c) => LIBELLES_CONDITIONS[c.code]).join(" ; ");
    const amont = ORDRE_AMONT.find((code) => declenchees.some((c) => c.code === code))!;
    const correctif = CORRECTIFS_CONDITIONS[amont];
    const aMordu = analyse.score_hors_plafond !== null && analyse.score_hors_plafond > PLAFOND_ELIMINATOIRE;
    if (aMordu) {
      return `Appel plafonné : ${libelles}. Sans ce plafond : ${nombre(analyse.score_hors_plafond)}/100. ${correctif}`;
    }
    return `Condition éliminatoire constatée : ${libelles}. ${correctif}`;
  }
  const cible = choisirCibleDrill(analyse);
  if (cible) return cible.description;
  return "Aucun chantier prioritaire identifié : les piliers notés sont tenus.";
}

// ─── Le convertisseur ────────────────────────────────────────
export interface DrillRedige {
  titre: string;
  duree_estimee: string;
  contexte: string;
  consigne: string;
  exemple_reponse: string | null;
}

export function versResultat(params: {
  analyse: ResultatAnalyse;
  dureeAnalyseMs: number;
  nbAppelsLlm: number;
  /** Rédigé par le modèle sur une cible choisie par le code ; null accepté. */
  drill: (DrillRedige & { type: string }) | null;
  now?: Date;
}): Record<string, unknown> {
  const { analyse, dureeAnalyseMs, nbAppelsLlm, drill } = params;

  const dimensions: Record<string, unknown> = {};
  const annotations: unknown[] = [];

  for (const etape of analyse.etapes) {
    const cle = ETAPE_VERS_CLE[etape.code];
    const items = etape.items
      .filter((i) => STATUTS_ENVOYES.has(i.verdict))
      .map((i) => {
        const verbatim = extraireVerbatim(i.signaux);
        const commentaire = commentaireItem(i);
        annotations.push({
          timestamp: "",
          dimension: cle,
          critere: i.code,
          label: `${i.code} — ${LIBELLES_ITEMS[i.code] ?? i.code}`,
          verbatim,
          evaluation: EVALUATION_PAR_STATUT[i.verdict],
          pourquoi: commentaire,
        });
        return {
          id: i.code,
          label: LIBELLES_ITEMS[i.code] ?? i.code,
          statut: i.verdict,
          points: i.points_obtenus,
          verbatim: verbatim || null,
          commentaire,
        };
      });
    dimensions[cle] = {
      items,
      // scoreMax RÉEL : les non évaluables sont déjà sortis de points_max par le moteur.
      score: etape.points_obtenus,
      scoreMax: etape.points_max,
    };
  }

  const score = Math.round(analyse.score_sur_100 ?? 0);

  return {
    timestamp: (params.now ?? new Date()).toISOString(),
    duree_analyse_ms: dureeAnalyseMs,
    session: { mode: "simulation" },
    aar: null,
    dimensions,
    score_total: score,
    niveau: calculerNiveau(score),
    turning_point: null, // on n'invente pas de tournant
    point_fort: construirePointFort(analyse),
    point_faible: construirePointFaible(analyse),
    drill,
    annotations,
    grille: {
      version_grille: analyse.version_grille,
      version_seuils: analyse.version_seuils,
      score_hors_plafond: analyse.score_hors_plafond,
      eliminatoire_declenche: analyse.eliminatoire_declenche,
      conditions: analyse.conditions,
    },
    _meta: { llm_calls: nbAppelsLlm, prompts_utilises: ["grille"] },
    _modele: "grille",
  };
}

// ─── Retour d'expérience : comparaison du niveau estimé et du niveau constaté ─
export function comparerAARvsIA(niveauEstime: NiveauAppel, niveauReel: NiveauAppel) {
  const ecart = NIVEAUX.indexOf(niveauEstime) - NIVEAUX.indexOf(niveauReel);
  const messages: Record<number, string> = {
    0: "Ta perception est parfaitement alignée avec ton niveau réel.",
    1: "Tu t'es légèrement surestimé. L'IA voit des nuances que l'on rate dans le feu de l'action.",
    2: "Écart important. Travaille l'auto-évaluation — c'est une compétence clé d'un commercial d'élite.",
    [-1]: "Tu t'es sous-estimé. Ton exécution est meilleure que tu ne le penses.",
    [-2]: "Tu t'es significativement sous-estimé. Fais confiance à ce que tu produis.",
  };
  return {
    niveau_estime: niveauEstime,
    niveau_reel: niveauReel,
    ecart,
    message: messages[ecart] ?? messages[ecart > 0 ? 2 : -2],
  };
}

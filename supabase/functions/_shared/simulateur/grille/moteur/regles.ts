/**
 * Grille d'analyse · Moteur d'agrégation — règles de conversion
 *
 * Une fonction par item. Chacune reçoit les signaux collectés et rend un
 * verdict. Aucune n'invente de seuil : tous viennent de config.ts.
 *
 * Ces fonctions sont pures : mêmes signaux, même verdict. C'est ce qui
 * garantit qu'une analyse est reproductible et auditable.
 */

import { CONDITIONS_ELIMINATOIRES, SEUILS } from "./config.ts";
import type {
  Collecte,
  ConditionEliminatoire,
  SortieP1,
  StatutCondition,
  TypeAppel,
  Verdict,
  MesuresDeterministes,
} from "./types.ts";

/** Raccourci : lit un booléen dans un objet de signaux, false si absent. */
function b(o: Record<string, unknown> | undefined, k: string): boolean {
  return o?.[k] === true;
}

/** Raccourci : lit un entier, 0 si absent. */
function n(o: Record<string, unknown> | undefined, k: string): number {
  const v = o?.[k];
  return typeof v === "number" ? v : 0;
}

/** Compte les booléens vrais parmi une liste de clés. */
function compte(o: Record<string, unknown> | undefined, cles: string[]): number {
  return cles.filter((k) => b(o, k)).length;
}

// ═════════════════════════════════════════════════════════════
// C · Connect
// ═════════════════════════════════════════════════════════════

/**
 * C1 · Mise à l'aise
 * Correct : connexion présente ET information reprise ET avant business.
 * Partiel : connexion présente sans information reprise.
 */
export function verdictC1(s: Record<string, unknown>): Verdict {
  const connexion = b(s, "connexion_presente");
  const info = b(s, "information_reprise");
  const avant = b(s, "avant_business");

  if (connexion && info && avant) return "correct";
  if (connexion) return "partiel";
  return "absent";
}

/**
 * C2 · Cadre du call — quatre composants depuis l'arbitrage A3.
 * Un cadre posé après le début du diagnostic vaut Absent, quel que soit
 * le nombre de composants : il n'a rien cadré.
 */
export function verdictC2(s: Record<string, unknown>): Verdict {
  if (b(s, "cadre_apres_diagnostic")) return "absent";

  const c = compte(s, [
    "duree_annoncee",
    "deroule_annonce",
    "accord_obtenu",
    "decision_attendue",
  ]);

  if (c >= SEUILS.C2_COMPOSANTS_CORRECT) return "correct";
  if (c >= SEUILS.C2_COMPOSANTS_PARTIEL_MIN) return "partiel";
  return "absent";
}

// ═════════════════════════════════════════════════════════════
// L · Listen & Layer
// ═════════════════════════════════════════════════════════════

/**
 * L1 · Questions Situation
 * Le seuil est en calibration : la corrélation attendue est en cloche,
 * d'où le plafond optionnel.
 */
export function verdictL1(s: Record<string, unknown>): Verdict {
  const nb = n(s, "questions_situation_nb");
  const factuelles = b(s, "reponses_factuelles");

  if (SEUILS.L1_PLAFOND !== null && nb > SEUILS.L1_PLAFOND) return "partiel";
  if (nb >= SEUILS.L1_QUESTIONS_MIN && factuelles) return "correct";
  if (nb >= 1) return "partiel";
  return "absent";
}

/**
 * L2 · Questions Problème
 * Nature effet : la douleur doit être verbalisée par le prospect.
 * Le creusement porte le signal autant que le compte.
 */
export function verdictL2(s: Record<string, unknown>): Verdict {
  const nb = n(s, "questions_probleme_nb");
  const douleur = b(s, "douleur_verbalisee_prospect");
  const creusement = b(s, "creusement");

  if (!douleur) return nb >= 1 ? "partiel" : "absent";

  const compteOk = nb >= SEUILS.L2_QUESTIONS_MIN;
  const creusementOk = !SEUILS.L2_CREUSEMENT_REQUIS || creusement;

  if (compteOk && creusementOk) return "correct";
  return "partiel";
}

/**
 * Un événement de question d'impact extrait par P2-L (v0.12).
 * Le rattachement question → problème est une DONNÉE de l'extraction,
 * jamais une déduction du moteur.
 */
interface EvenementImpact {
  probleme: string;
  prise_de_parole: number;
}

/**
 * Lit et valide les événements de questions d'impact. Fail-closed : une
 * entrée sans preuve complète (problème + verbatim + position) est ignorée —
 * elle ne compte ni pour le rattachement ni pour le total.
 */
function evenementsImpact(s: Record<string, unknown>): EvenementImpact[] {
  const brut = s?.["questions_impact"];
  if (!Array.isArray(brut)) return [];
  const evts: EvenementImpact[] = [];
  for (const e of brut) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const probleme = o["probleme"];
    const verbatim = o["verbatim_question"];
    const position = o["prise_de_parole"];
    if (typeof probleme !== "string" || probleme.trim() === "") continue;
    if (typeof verbatim !== "string" || verbatim.trim() === "") continue;
    if (typeof position !== "number" || !Number.isFinite(position)) continue;
    // Une même prise de parole ne compte qu'une fois : deux entrées à la
    // même position sont la même question extraite deux fois, pas deux
    // questions.
    if (evts.some((d) => d.prise_de_parole === position)) continue;
    evts.push({ probleme: probleme.trim().toLowerCase(), prise_de_parole: position });
  }
  return evts;
}

/**
 * L3 · Questions Impact (v0.12)
 * Nature effet : le coût doit venir du prospect.
 *
 * Correct : ≥ L3_QUESTIONS_MEME_PROBLEME_MIN questions d'impact rattachées
 * au MÊME problème ET coût verbalisé. Deux questions sur deux problèmes
 * différents sont deux amorces, pas un creusement.
 *
 * Fail-closed : un payload legacy (compte scalaire questions_implication_nb,
 * sans événements) ne peut jamais atteindre Correct — le rattachement au
 * problème est indécidable, on ne l'invente pas. Il vaut au mieux Partiel.
 */
export function verdictL3(s: Record<string, unknown>): Verdict {
  const evts = evenementsImpact(s);
  const cout = b(s, "cout_verbalise_prospect");

  // Total de questions d'impact : les événements font foi ; le compte
  // scalaire ne sert que de repli pour un payload sans événements.
  const total = evts.length > 0 ? evts.length : n(s, "questions_implication_nb");

  // Plus grand nombre de questions rattachées à un même problème.
  const parProbleme = new Map<string, number>();
  for (const e of evts) parProbleme.set(e.probleme, (parProbleme.get(e.probleme) ?? 0) + 1);
  const maxMemeProbleme =
    parProbleme.size > 0 ? Math.max(...Array.from(parProbleme.values())) : 0;

  if (maxMemeProbleme >= SEUILS.L3_QUESTIONS_MEME_PROBLEME_MIN && cout) return "correct";
  if (total >= 1) return "partiel";
  return "absent";
}

/**
 * L4 · Vision (anciennement « Questions Need Payoff » — critère inchangé,
 * seul le nom change, v0.12).
 * L'élément spécifique fait la différence entre une projection et un écho :
 * le prospect doit apporter ce que la question ne contenait pas.
 */
export function verdictL4(s: Record<string, unknown>): Verdict {
  const question = b(s, "question_projection");
  const etatFutur = b(s, "etat_futur_verbalise_prospect");
  const specifique = b(s, "element_specifique");

  if (question && etatFutur && specifique) return "correct";
  if (question && etatFutur) return "partiel";
  if (question) return "partiel";
  return "absent";
}

/**
 * L5 · Ratio de parole sur le segment L
 * Mesure déterministe, jamais produite par un modèle. Non évaluable si
 * les timings de diarisation sont absents : la matière manque, le geste
 * avait pourtant lieu d'être.
 */
export function verdictL5(m: MesuresDeterministes): Verdict {
  const r = m.ratio_parole_segment_l;
  if (r === null) return "non_evaluable";
  if (r >= SEUILS.L5_CORRECT) return "correct";
  if (r >= SEUILS.L5_PARTIEL) return "partiel";
  return "absent";
}

/**
 * L6 · Profondeur du diagnostic
 * Mesure une structure : creuser un problème plutôt qu'en effleurer cinq.
 */
export function verdictL6(s: Record<string, unknown>): Verdict {
  const echanges = n(s, "echanges_consecutifs_nb");

  if (echanges >= SEUILS.L6_ECHANGES_MIN) return "correct";
  if (echanges >= SEUILS.L6_ECHANGES_PARTIEL) return "partiel";
  return "absent";
}

// ═════════════════════════════════════════════════════════════
// E · Expose the Gap
// ═════════════════════════════════════════════════════════════

/**
 * E1 · Formulation du GAP — trois composants du manuel J6.
 */
export function verdictE1(s: Record<string, unknown>): Verdict {
  const c = compte(s, ["point_a", "point_b", "blocage"]);
  if (c >= SEUILS.E1_COMPOSANTS_CORRECT) return "correct";
  if (c >= SEUILS.E1_COMPOSANTS_PARTIEL_MIN) return "partiel";
  return "absent";
}

/**
 * E2 · Mots du prospect réutilisés
 * Binaire : soit un élément textuel est repris, soit c'est une paraphrase.
 * Le Partiel correspond à une reformulation fidèle sans reprise exacte —
 * il se déduit de la présence d'une synthèse sans reprise.
 */
export function verdictE2(s: Record<string, unknown>, syntheseLocalisee: boolean): Verdict {
  if (b(s, "mots_exacts_reutilises")) return "correct";
  if (syntheseLocalisee) return "partiel";
  return "absent";
}

/**
 * E3 · Validation par le prospect
 * L'item le plus lourd de l'étape : c'est la validation qui autorise le
 * pitch, pas la formulation.
 *
 * Une validation obtenue après le pitch ne compte que Partiel : elle
 * n'autorise plus rien.
 */
export function verdictE3(s: Record<string, unknown>): Verdict {
  const demande = b(s, "demande_validation");
  const confirmation = b(s, "confirmation_prospect");
  const avantPitch = b(s, "avant_pitch");
  const acquiescement = b(s, "acquiescement_seul");

  // Aucune demande : le sales n'a jamais vérifié que le prospect se
  // reconnaissait dans sa synthèse.
  if (!demande) return "absent";

  // La séquence complète : demande, confirmation avec contenu propre, et
  // le tout avant le pitch. C'est elle qui autorise la présentation.
  if (confirmation && avantPitch) return "correct";

  // Confirmation obtenue mais après le pitch : elle n'autorise plus rien.
  if (confirmation) return "partiel";

  // Le prospect a acquiescé sans contenu propre. Le geste a été posé, la
  // vérification n'a rien produit.
  if (acquiescement) return "partiel";

  // Demande posée sans qu'aucune réponse ne suive — question rhétorique,
  // ou le sales enchaîne sans laisser le temps de répondre. Le geste est
  // vide : il n'a rien vérifié du tout.
  return "absent";
}

// ═════════════════════════════════════════════════════════════
// A · Align the Solution
// ═════════════════════════════════════════════════════════════

/**
 * A1 · Pitch après GAP validé.
 *
 * La prématurité n'est JAMAIS une opinion du modèle : elle est calculée par
 * comparerPrematurite() sur des horodatages. Le verdict de l'item reste
 * gradué : celui qui se rattrape par un retour au diagnostic n'est pas noté
 * comme celui qui ne revient jamais.
 */
export function verdictA1(
  s: Record<string, unknown>,
  prematurite: StatutCondition,
): Verdict {
  if (prematurite === "indeterminee") return "non_evaluable";
  if (prematurite === "non_declenchee") return "correct";

  const retour = b(s, "retour_diagnostic");
  if (retour) return "partiel";
  return "absent";
}

/**
 * A2 · Pitch en 4 blocs — structure J7, ordre interne indifférent.
 */
export function verdictA2(s: Record<string, unknown>): Verdict {
  const c = compte(s, [
    "bloc_probleme",
    "bloc_mecanisme",
    "bloc_transformation",
    "bloc_preuve",
  ]);

  if (c >= SEUILS.A2_BLOCS_CORRECT) return "correct";
  if (c >= SEUILS.A2_BLOCS_PARTIEL_MIN) return "partiel";
  return "absent";
}

/**
 * A3 · Valeur reliée avant prix
 * Deux conditions : l'ordre et le lien au GAP. Un exposé générique qui
 * précède le prix ne vaut que Partiel.
 *
 * Si aucun prix n'a été énoncé, la condition d'ordre est sans objet : le
 * verdict repose alors sur le seul lien au GAP.
 */
export function verdictA3(s: Record<string, unknown>): Verdict {
  const avantPrix = s["valeur_avant_prix"];
  const relie = b(s, "valeur_reliee_au_gap");

  // Pas de prix énoncé : seule la condition de lien s'applique.
  if (avantPrix === null || avantPrix === undefined) {
    return relie ? "correct" : "partiel";
  }

  if (avantPrix === true && relie) return "correct";
  if (avantPrix === true) return "partiel";
  return "absent";
}

// ═════════════════════════════════════════════════════════════
// R · Resolve & Request
// ═════════════════════════════════════════════════════════════

/**
 * R1 · Acknowledge — par objection.
 * Un accusé minimal immédiatement suivi d'un argument vaut Partiel.
 */
export function verdictR1(s: Record<string, unknown>): Verdict {
  if (b(s, "r1_acknowledge")) return "correct";
  if (b(s, "r1_accuse_minimal")) return "partiel";
  return "absent";
}

/**
 * R2 · Isolate — par objection.
 * La question doit précéder la réponse à l'objection : posée après, elle
 * n'a plus rien isolé.
 */
export function verdictR2(s: Record<string, unknown>): Verdict {
  const isolate = b(s, "r2_isolate");
  const avant = b(s, "r2_avant_reponse");

  if (isolate && avant) return "correct";
  if (isolate) return "partiel";
  return "absent";
}

/**
 * R3 · Clarify — par objection, nature effet.
 * Poser la question sans obtenir d'information est un geste vide.
 */
export function verdictR3(s: Record<string, unknown>): Verdict {
  const clarify = b(s, "r3_clarify");
  const nouveau = b(s, "r3_element_nouveau_prospect");

  if (clarify && nouveau) return "correct";
  if (clarify) return "partiel";
  return "absent";
}

/**
 * R4 · Looping — par objection.
 *
 * Deux règles d'or du manuel : jamais avant l'AIC, jamais hors objection.
 * Le cas de l'AIC absent est traité à part : il n'y a rien avant quoi le
 * Looping pourrait arriver, mais le geste n'a pas non plus son effet.
 */
export function verdictR4(s: Record<string, unknown>): Verdict {
  const present = b(s, "r4_looping_present");
  if (!present) return "absent";

  const apresAic = b(s, "r4_apres_aic");
  const motsProspect = b(s, "r4_mots_prospect");
  const aicAbsent = b(s, "r4_aic_absent");

  if (apresAic && motsProspect) return "correct";
  // Looping sans AIC préalable : le geste existe mais la séquence est rompue.
  if (aicAbsent) return "partiel";
  return "partiel";
}

/**
 * R5 · Question de décision — une fois par appel.
 *
 * La pression est codée sur trois marqueurs factuels, jamais sur une
 * appréciation de ton. Un seul marqueur suffit à faire basculer en Partiel.
 */
export function verdictR5(s: Record<string, unknown>): Verdict {
  const ask = b(s, "r5_ask_present");

  const pression =
    b(s, "r5_pression_asks_repetes") ||
    b(s, "r5_pression_urgence_invoquee") ||
    b(s, "r5_pression_report_refuse");

  if (!ask) return "absent";
  if (pression) return "partiel";
  return "correct";
}

// ═════════════════════════════════════════════════════════════
// Ancre de pitch unique et prématurité par horodatages
// ═════════════════════════════════════════════════════════════

/** Lit une position numérique dans un objet de signaux, null sinon. */
function pos(o: Record<string, unknown> | undefined, k: string): number | null {
  const v = o?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * L'UNIQUE ancre de pitch du moteur.
 *
 * Toutes les sources qui prétendent savoir « quand le pitch a commencé »
 * convergent ici, et l'ancre est leur MINIMUM. Deux ancres dans la même
 * analyse produiraient une fiche qui se contredit elle-même.
 *
 * Sources, dans l'ordre de la chaîne :
 * - P1 : m1_premier_enonce_offre, m2_premier_enonce_prix ;
 * - P2-A : a1.horodatage_premier_pitch, a2.prise_de_parole_debut.
 *
 * `presence` distingue « aucun pitch » (l'appel s'arrête avant l'offre —
 * légitime) de « pitch signalé mais jamais positionné » (matière manquante).
 */
export function ancrePitch(
  p1: SortieP1,
  collecte: Collecte,
): { position: number | null; presence: "pitch_localise" | "aucun_pitch" | "pitch_sans_position" } {
  const m1 = p1.moments?.["m1_premier_enonce_offre"];
  const m2 = p1.moments?.["m2_premier_enonce_prix"];
  const a = collecte.a;

  const positions = [
    m1?.present === true ? (typeof m1.prise_de_parole === "number" ? m1.prise_de_parole : null) : null,
    m2?.present === true ? (typeof m2.prise_de_parole === "number" ? m2.prise_de_parole : null) : null,
    pos(a?.a1, "horodatage_premier_pitch"),
    pos(a?.a2, "prise_de_parole_debut"),
  ].filter((p): p is number => p !== null);

  if (positions.length > 0) {
    return { position: Math.min(...positions), presence: "pitch_localise" };
  }

  // La collecte A a explicitement statué qu'aucun pitch n'a été présenté :
  // ce constat prime sur la simple présence d'un segment A dans le plan.
  if (a && a.pitch_localise === false && m1?.present !== true && m2?.present !== true) {
    return { position: null, presence: "aucun_pitch" };
  }

  const signale =
    m1?.present === true ||
    m2?.present === true ||
    a?.pitch_localise === true ||
    p1.segments?.some((s) => s.code === "A" && s.present) === true;

  return { position: null, presence: signale ? "pitch_sans_position" : "aucun_pitch" };
}

/**
 * PITCH_AVANT_GAP — comparaison d'horodatages, jamais une opinion.
 *
 * Compare l'ancre de pitch à la position de la première synthèse de
 * l'écart (m3, recoupée par e1_prise_de_parole — le MINIMUM des deux,
 * même logique d'ancre unique que pour le pitch).
 *
 * - aucun pitch → non_declenchee : rien n'a pu être prématuré ;
 * - pitch positionné, aucune synthèse constatée → declenchee : le pitch
 *   est arrivé avant un GAP qui n'a jamais existé ;
 * - matière manquante (positions absentes) → indeterminee.
 */
export function comparerPrematurite(
  p1: SortieP1,
  collecte: Collecte,
): { statut: StatutCondition; motif: string | null } {
  const pitch = ancrePitch(p1, collecte);

  if (pitch.presence === "aucun_pitch") {
    return { statut: "non_declenchee", motif: "aucun_pitch_presente" };
  }
  if (pitch.presence === "pitch_sans_position") {
    return { statut: "indeterminee", motif: "pitch_signale_sans_position" };
  }

  const m3 = p1.moments?.["m3_premiere_synthese_ecart"];
  const posM3 =
    m3?.present === true && typeof m3.prise_de_parole === "number" ? m3.prise_de_parole : null;
  const posE1 =
    collecte.e && b(collecte.e as unknown as Record<string, unknown>, "synthese_localisee")
      ? pos(collecte.e.e1, "prise_de_parole")
      : null;

  const sources = [posM3, posE1].filter((p): p is number => p !== null);
  const syntheseConstatee =
    m3?.present === true || collecte.e?.synthese_localisee === true;

  if (sources.length === 0) {
    if (!syntheseConstatee && collecte.e) {
      // La collecte E a eu lieu et n'a trouvé aucune synthèse : le pitch
      // précède un GAP jamais formulé.
      return { statut: "declenchee", motif: "pitch_sans_synthese_du_gap" };
    }
    return { statut: "indeterminee", motif: "synthese_sans_position" };
  }

  const anchreGap = Math.min(...sources);
  if (pitch.position! < anchreGap) {
    return {
      statut: "declenchee",
      motif: `offre présentée en prise de parole ${pitch.position}, synthèse de l'écart en ${anchreGap}`,
    };
  }
  return { statut: "non_declenchee", motif: null };
}

// ═════════════════════════════════════════════════════════════
// Évaluation des cinq conditions éliminatoires
// ═════════════════════════════════════════════════════════════

/**
 * Traduit le verdict d'un item fondateur en statut de condition.
 * Règle d'arbitrage c : *non applicable* éteint la condition ;
 * *non évaluable* la rend indéterminée — elle ne plafonne pas et ne
 * disparaît pas. Les confondre ferait passer de 25 à 100 un sales qui
 * n'a jamais posé le cadre.
 */
function statutDepuisVerdict(v: Verdict): { statut: StatutCondition; motif: string | null } {
  if (v === "absent") return { statut: "declenchee", motif: null };
  if (v === "non_evaluable") return { statut: "indeterminee", motif: "item_fondateur_non_evaluable" };
  if (v === "non_applicable") return { statut: "non_declenchee", motif: "item_fondateur_non_applicable" };
  return { statut: "non_declenchee", motif: null };
}

/**
 * Évalue les cinq conditions. La sortie contient TOUJOURS les cinq,
 * chacune avec son état (active/suspendue) copié depuis la liste de
 * config — jamais décidé ici.
 */
export function evaluerConditions(
  p1: SortieP1,
  collecte: Collecte,
  verdicts: Map<string, Verdict>,
  typeAppel: TypeAppel,
): ConditionEliminatoire[] {
  const pitch = ancrePitch(p1, collecte);
  const prematurite = comparerPrematurite(p1, collecte);

  const statuts: Record<string, { statut: StatutCondition; motif: string | null }> = {
    CADRE_NON_POSE: statutDepuisVerdict(verdicts.get("C2") ?? "non_evaluable"),

    PITCH_AVANT_GAP:
      // DOCTRINE (validée 14/08/2026) : en R2 et R3, le gap a été validé
      // lors d'un appel antérieur ; refaire la découverte serait une faute
      // de vente. Cohérent avec le template R3 qui exclut déjà L1-L6.
      typeAppel === "R2" || typeAppel === "R3"
        ? { statut: "non_declenchee", motif: `gap_valide_en_appel_anterieur_${typeAppel}` }
        : prematurite,

    RETOUR_DIAGNOSTIC: (() => {
      if (pitch.presence === "aucun_pitch") {
        return { statut: "non_declenchee" as StatutCondition, motif: "aucun_pitch_presente" };
      }
      if (!collecte.a) {
        return { statut: "indeterminee" as StatutCondition, motif: "etape_a_non_collectee" };
      }
      // Le booléen du modèle ne suffit JAMAIS à plafonner : la condition
      // exige la comparaison des positions — retour STRICTEMENT après
      // l'ancre de pitch unique. Matière manquante (retour ou pitch sans
      // position) → indéterminée, jamais déclenchée.
      if (!b(collecte.a.a1, "retour_diagnostic")) {
        return { statut: "non_declenchee" as StatutCondition, motif: null };
      }
      const posRetour = pos(collecte.a.a1, "prise_de_parole_retour");
      if (posRetour === null) {
        return { statut: "indeterminee" as StatutCondition, motif: "retour_signale_sans_position" };
      }
      if (pitch.position === null) {
        return { statut: "indeterminee" as StatutCondition, motif: "pitch_signale_sans_position" };
      }
      return posRetour > pitch.position
        ? { statut: "declenchee" as StatutCondition, motif: `question de diagnostic en prise de parole ${posRetour}, offre présentée en ${pitch.position}` }
        : { statut: "non_declenchee" as StatutCondition, motif: "retour_anterieur_au_pitch" };
    })(),

    GAP_NON_FORMULE: statutDepuisVerdict(verdicts.get("E1") ?? "non_evaluable"),

    PITCH_DESALIGNE: (() => {
      if (pitch.presence === "aucun_pitch") {
        return { statut: "non_declenchee" as StatutCondition, motif: "aucun_pitch_presente" };
      }
      if (!collecte.a) {
        return { statut: "indeterminee" as StatutCondition, motif: "etape_a_non_collectee" };
      }
      return b(collecte.a.a3, "valeur_reliee_au_gap")
        ? { statut: "non_declenchee" as StatutCondition, motif: null }
        : { statut: "declenchee" as StatutCondition, motif: "valeur_non_reliee_au_diagnostic" };
    })(),
  };

  return CONDITIONS_ELIMINATOIRES.map((def) => ({
    code: def.code,
    libelle: def.libelle,
    etat: def.etat,
    statut: statuts[def.code].statut,
    motif: statuts[def.code].motif,
  }));
}

// ═════════════════════════════════════════════════════════════
// Agrégation des items par objection
// ═════════════════════════════════════════════════════════════

/**
 * R1 à R4 se codent par objection. Il faut un verdict unique par item.
 *
 * Règle retenue : le verdict le plus fréquent, avec le pire en cas
 * d'égalité. On ne calcule pas de moyenne — un item qui n'est jamais posé
 * ne doit pas être compensé par un item bien posé ailleurs.
 *
 * Si aucune objection n'a été émise, l'item est non applicable et sort du
 * dénominateur : on ne pénalise pas un sales pour un geste qu'aucune
 * situation n'appelait.
 */
export interface AgregationObjection {
  verdict: Verdict;
  motif: string | null;
  /**
   * Décompte par verdict. Pour le score, « absent sur une objection » et
   * « absent sur trois » sont identiques. Pour le coaching, ce sont deux
   * diagnostics différents : l'un dit que le geste n'est pas connu, l'autre
   * qu'il n'est pas tenu.
   */
  detail: { correct: number; partiel: number; absent: number; total: number };
}

export function agregerParObjection(verdicts: Verdict[]): AgregationObjection {
  const detail = {
    correct: verdicts.filter((v) => v === "correct").length,
    partiel: verdicts.filter((v) => v === "partiel").length,
    absent: verdicts.filter((v) => v === "absent").length,
    total: verdicts.length,
  };

  if (verdicts.length === 0) {
    return { verdict: "non_applicable", motif: "aucune_objection", detail };
  }

  const ordre: Verdict[] = ["absent", "partiel", "correct"];
  const comptes = new Map<Verdict, number>();
  for (const v of verdicts) comptes.set(v, (comptes.get(v) ?? 0) + 1);

  let retenu: Verdict = "absent";
  let max = -1;
  // Parcours du pire au meilleur : à égalité, le pire l'emporte.
  for (const v of ordre) {
    const c = comptes.get(v) ?? 0;
    if (c > max) {
      max = c;
      retenu = v;
    }
  }

  return { verdict: retenu, motif: null, detail };
}

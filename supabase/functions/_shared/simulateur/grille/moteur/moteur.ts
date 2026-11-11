/**
 * Grille d'analyse · Moteur d'agrégation
 *
 * Transforme les signaux collectés par les prompts en verdicts, puis en
 * points. Aucun modèle de langage n'intervient ici.
 *
 * Enchaînement :
 *   1. Application du vérifieur — les signaux contestés repassent à false
 *   2. Conditions de validité — un appel non conforme sort du dénominateur
 *   3. Conversion signaux → verdicts, item par item
 *   4. Application du template selon le type d'appel
 *   5. Éliminatoire conditionnel
 *   6. Calcul des points et normalisation sur 100
 */

import {
  ITEMS,
  PLAFOND_ELIMINATOIRE,
  RATIO_PARTIEL,
  TEMPLATES,
  VALIDITE,
  VERSION_GRILLE,
  VERSION_SEUILS,
  plafonneLeScore,
} from "./config.ts";
import * as R from "./regles.ts";
import type {
  Collecte,
  CodeEtape,
  CodeItem,
  MesuresDeterministes,
  ResultatAnalyse,
  ResultatEtape,
  ResultatItem,
  SortieP1,
  SortieVerifieur,
  Verdict,
} from "./types.ts";

// ─────────────────────────────────────────────────────────────
// 1 · Application du vérifieur
// ─────────────────────────────────────────────────────────────

/**
 * Un signal contesté par le vérifieur repasse à false.
 *
 * Le vérifieur ne peut que RETIRER, jamais ajouter : il ne fait pas passer
 * un false à true. C'est ce qui garantit qu'une seconde passe ne dégrade
 * jamais la fiabilité.
 */
export function appliquerVerifieur(
  collecte: Collecte,
  verif: SortieVerifieur | null
): { collecte: Collecte; contestes: Map<string, string[]> } {
  const contestes = new Map<string, string[]>();
  if (!verif || verif.signaux_contestes.length === 0) {
    return { collecte, contestes };
  }

  // Copie profonde pour ne pas muter l'entrée.
  const copie: Collecte = JSON.parse(JSON.stringify(collecte));

  for (const sc of verif.signaux_contestes) {
    const champ = sc.champ;
    // Le champ porte la forme "l3_cout_verbalise_prospect" ou "r2_isolate".
    const prefixe = champ.slice(0, 2).toUpperCase() as CodeItem;

    const liste = contestes.get(prefixe) ?? [];
    liste.push(champ);
    contestes.set(prefixe, liste);

    // Neutralisation ciblée.
    //
    // Les items R1 à R4 sont codés par objection : une contestation porte
    // sur UNE objection précise, pas sur toutes. Sans le filtre par
    // objection_id, contester r2_isolate sur la première objection
    // neutraliserait le geste sur toutes les autres — et transformerait un
    // signal contesté en trois.
    // l3_questions_impact : contestation d'ENTRÉES d'un tableau, pas d'un
    // booléen. On retire l'entrée dont le verbatim correspond ; sans
    // verbatim exploitable ou sans correspondance, on vide la liste
    // entière — le vérifieur ne peut que retirer, jamais laisser passer
    // une entrée douteuse (fail-closed).
    if (champ === "l3_questions_impact") {
      const l3 = copie.l?.l3 as Record<string, unknown> | undefined;
      if (l3 && Array.isArray(l3["questions_impact"])) {
        const cible = typeof sc.verbatim_conteste === "string" ? sc.verbatim_conteste.trim() : "";
        const avant = l3["questions_impact"] as unknown[];
        const apres = cible === ""
          ? []
          : avant.filter((e) => {
              const v = e && typeof e === "object" ? (e as Record<string, unknown>)["verbatim_question"] : null;
              return typeof v === "string" && v.trim() !== cible;
            });
        l3["questions_impact"] = apres.length === avant.length && cible !== "" ? [] : apres;
      }
      continue;
    }

    if (sc.objection_id && copie.r?.objections) {
      const cible = copie.r.objections.find((o) => o["id"] === sc.objection_id);
      if (cible) {
        neutraliser(cible, champ);
      } else {
        // L'objection citée n'existe pas : on ne neutralise rien plutôt que
        // de neutraliser au hasard.
        const liste2 = contestes.get("_orphelins") ?? [];
        liste2.push(`${champ} sur ${sc.objection_id} — objection introuvable`);
        contestes.set("_orphelins", liste2);
      }
      continue;
    }

    for (const bloc of Object.values(copie)) {
      if (!bloc || typeof bloc !== "object") continue;
      neutraliser(bloc as Record<string, unknown>, champ);
    }
  }

  return { collecte: copie, contestes };
}

/**
 * Cherche récursivement une clé et la met à false.
 *
 * Ne descend pas dans les tableaux d'objections : celles-ci sont traitées
 * séparément, par identifiant, pour qu'une contestation portant sur une
 * objection n'affecte pas les autres.
 */
function neutraliser(o: Record<string, unknown>, champ: string): void {
  // Le champ peut être préfixé (r2_isolate) ou non (isolate) selon le bloc.
  const sansPrefixe = champ.replace(/^[a-z]\d_/, "");

  for (const [k, v] of Object.entries(o)) {
    if (k === champ || k === sansPrefixe) {
      if (typeof v === "boolean") o[k] = false;
      continue;
    }
    // On ignore volontairement le tableau des objections : voir plus haut.
    if (k === "objections" && Array.isArray(v)) continue;

    if (v && typeof v === "object" && !Array.isArray(v)) {
      neutraliser(v as Record<string, unknown>, champ);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2 · Conditions de validité
// ─────────────────────────────────────────────────────────────

/**
 * Un appel qui ne remplit pas ces conditions n'est pas mal noté : il est
 * marqué non évaluable et sort du dénominateur des moyennes.
 *
 * La distinction est essentielle : un sales face à un prospect mutique
 * serait systématiquement sous-noté. C'est une injustice de mesure, et
 * c'est ce qui décrédibilise un système d'évaluation.
 */
export function verifierValidite(
  p1: SortieP1,
  mesures: MesuresDeterministes
): { evaluable: boolean; motifs: string[] } {
  const motifs: string[] = [];

  // Règle protectrice : une disqualification explicite et motivée est un
  // bon travail commercial. L'appel sort du dénominateur sans être
  // considéré comme raté.
  if (p1.issue_structurelle === "disqualification") {
    return { evaluable: false, motifs: ["disqualification_propre"] };
  }

  if (p1.nb_prises_parole < VALIDITE.PRISES_PAROLE_MIN) {
    motifs.push("appel_trop_court");
  }

  if (
    mesures.ratio_parole_global !== null &&
    mesures.ratio_parole_global < VALIDITE.RATIO_PAROLE_MIN
  ) {
    motifs.push("ratio_parole_insuffisant");
  }

  if (VALIDITE.SEGMENT_L_REQUIS) {
    const segL = p1.segments.find((s) => s.code === "L" && s.present);
    if (!segL) motifs.push("segment_diagnostic_absent");
  }

  const bloquantes = ["transcript_tronque", "speakers_non_identifies"];
  for (const a of p1.anomalies) {
    if (bloquantes.includes(a)) motifs.push(a);
  }

  return { evaluable: motifs.length === 0, motifs };
}

// ─────────────────────────────────────────────────────────────
// 3 · Conversion des signaux en verdicts
// ─────────────────────────────────────────────────────────────

interface VerdictItem {
  verdict: Verdict;
  signaux: Record<string, unknown>;
  motif: string | null;
}

function calculerVerdicts(
  collecte: Collecte,
  mesures: MesuresDeterministes,
  p1: SortieP1
): Map<CodeItem, VerdictItem> {
  /** Un segment est-il présent dans la segmentation ? */
  const segmentPresent = (code: CodeEtape): boolean =>
    p1.segments.some((s) => s.code === code && s.present);

  const out = new Map<CodeItem, VerdictItem>();
  // « Étape non collectée » = la matière manque, pas « le geste n'avait pas
  // lieu d'être » : c'est un non_evaluable, jamais un non_applicable.
  const vide = (motif: string): VerdictItem => ({
    verdict: "non_evaluable",
    signaux: {},
    motif,
  });

  // ── C
  if (collecte.c) {
    out.set("C1", { verdict: R.verdictC1(collecte.c.c1), signaux: collecte.c.c1, motif: null });
    out.set("C2", { verdict: R.verdictC2(collecte.c.c2), signaux: collecte.c.c2, motif: null });
  } else {
    out.set("C1", vide("etape_non_collectee"));
    out.set("C2", vide("etape_non_collectee"));
  }

  // ── L
  if (collecte.l) {
    out.set("L1", { verdict: R.verdictL1(collecte.l.l1), signaux: collecte.l.l1, motif: null });
    out.set("L2", { verdict: R.verdictL2(collecte.l.l2), signaux: collecte.l.l2, motif: null });
    out.set("L3", { verdict: R.verdictL3(collecte.l.l3), signaux: collecte.l.l3, motif: null });
    out.set("L4", { verdict: R.verdictL4(collecte.l.l4), signaux: collecte.l.l4, motif: null });
    out.set("L6", { verdict: R.verdictL6(collecte.l.l6), signaux: collecte.l.l6, motif: null });
  } else {
    for (const c of ["L1", "L2", "L3", "L4", "L6"] as CodeItem[]) {
      out.set(c, vide("etape_non_collectee"));
    }
  }

  // L5 est déterministe : il ne dépend d'aucune collecte.
  const vL5 = R.verdictL5(mesures);
  out.set("L5", {
    verdict: vL5,
    signaux: { ratio_parole_segment_l: mesures.ratio_parole_segment_l },
    motif: vL5 === "non_evaluable" ? "timings_diarisation_absents" : null,
  });

  // ── E
  //
  // Même principe qu'en A : sans synthèse localisée, les trois items n'ont
  // rien à coder. La différence avec A est que l'absence de synthèse EST le
  // constat — c'est E3 qui porte l'information, et le moteur doit distinguer
  // « le sales n'a pas restitué l'écart » de « l'appel n'y est pas arrivé ».
  //
  // Règle retenue : si le segment E est absent de la segmentation, les items
  // sont non applicables. S'il est présent mais qu'aucune synthèse n'y est
  // trouvée, ils sont codés — et absents.
  if (!segmentPresent("E")) {
    // CORRECTIF 2B — test décisif : si un pitch est positionné dans l'appel,
    // le sales avait la place de formuler l'écart. Le geste non fait est
    // ABSENT (il coûte ses points) ; seul un appel qui n'est jamais arrivé
    // jusque-là rend l'étape non applicable.
    const pitchPositionne =
      p1.moments?.["m1_premier_enonce_offre"]?.present === true || segmentPresent("A");
    if (pitchPositionne) {
      for (const c of ["E1", "E2", "E3"] as CodeItem[]) {
        out.set(c, { verdict: "absent", signaux: {}, motif: "pitch_positionne_sans_segment_e" });
      }
    } else {
      // L'appel n'a jamais atteint la phase de restitution de l'écart. Coder
      // ces items absents reviendrait à pénaliser un sales pour un geste que
      // l'appel n'appelait pas — au même titre qu'un pitch jamais présenté.
      for (const c of ["E1", "E2", "E3"] as CodeItem[]) {
        out.set(c, { verdict: "non_applicable", signaux: {}, motif: "segment_e_non_atteint" });
      }
    }
  } else if (collecte.e) {
    out.set("E1", { verdict: R.verdictE1(collecte.e.e1), signaux: collecte.e.e1, motif: null });
    out.set("E2", {
      verdict: R.verdictE2(collecte.e.e2, collecte.e.synthese_localisee),
      signaux: collecte.e.e2,
      motif: null,
    });
    out.set("E3", { verdict: R.verdictE3(collecte.e.e3), signaux: collecte.e.e3, motif: null });
  } else {
    for (const c of ["E1", "E2", "E3"] as CodeItem[]) out.set(c, vide("etape_non_collectee"));
  }

  // ── A
  //
  // Les trois items de cette étape codent la présentation de l'offre. Si
  // aucune offre n'a été présentée, ils n'ont rien à coder : les marquer
  // absents reviendrait à pénaliser un appel qui n'est pas allé jusque-là,
  // et les marquer corrects reviendrait à récompenser l'absence de pitch.
  //
  // Le cas est fréquent et légitime : un appel qui s'arrête après le
  // diagnostic pour planifier un second rendez-vous n'a pas de pitch.
  if (collecte.a && !collecte.a.pitch_localise) {
    for (const c of ["A1", "A2", "A3"] as CodeItem[]) {
      out.set(c, {
        verdict: "non_applicable",
        signaux: {},
        motif: "aucun_pitch_presente",
      });
    }
  } else if (collecte.a) {
    // A1 : la prématurité est une comparaison d'horodatages (ancre de pitch
    // unique vs synthèse du GAP), jamais un signal d'opinion du modèle.
    const prematurite = R.comparerPrematurite(p1, collecte);
    out.set("A1", {
      verdict: R.verdictA1(collecte.a.a1, prematurite.statut),
      signaux: { ...collecte.a.a1, prematurite: prematurite.statut, prematurite_motif: prematurite.motif },
      motif: prematurite.statut === "indeterminee" ? (prematurite.motif ?? "prematurite_indeterminee") : null,
    });
    out.set("A2", { verdict: R.verdictA2(collecte.a.a2), signaux: collecte.a.a2, motif: null });
    out.set("A3", { verdict: R.verdictA3(collecte.a.a3), signaux: collecte.a.a3, motif: null });
  } else {
    for (const c of ["A1", "A2", "A3"] as CodeItem[]) out.set(c, vide("etape_non_collectee"));
  }

  // ── R : agrégation par objection
  if (collecte.r) {
    const objs = collecte.r.objections ?? [];
    const parItem: Record<string, Verdict[]> = { R1: [], R2: [], R3: [], R4: [] };

    for (const o of objs) {
      parItem.R1.push(R.verdictR1(o));
      parItem.R2.push(R.verdictR2(o));
      parItem.R3.push(R.verdictR3(o));
      parItem.R4.push(R.verdictR4(o));
    }

    for (const code of ["R1", "R2", "R3", "R4"] as CodeItem[]) {
      const { verdict, motif, detail } = R.agregerParObjection(parItem[code]);
      out.set(code, {
        verdict,
        signaux: {
          nb_objections: objs.length,
          verdicts_par_objection: parItem[code],
          // Pour le score, « absent sur 1 » et « absent sur 3 » sont
          // identiques. Pour le coaching, ce sont deux diagnostics.
          detail_par_verdict: detail,
          // Signaux bruts conservés pour l'audit et les verbatims du
          // producteur coaching — purement additif.
          objections: objs,
        },
        motif,
      });
    }

    // R5 ne se code que si l'appel a présenté une offre. Demander une
    // décision suppose qu'il y ait quelque chose à décider : sans pitch,
    // l'absence d'ask n'est pas une faute.
    const offrePresentee =
      p1.moments?.["m1_premier_enonce_offre"]?.present === true || segmentPresent("A");

    if (!offrePresentee) {
      out.set("R5", {
        verdict: "non_applicable",
        signaux: collecte.r.cloture,
        motif: "aucune_offre_presentee",
      });
    } else {
      out.set("R5", {
        verdict: R.verdictR5(collecte.r.cloture),
        signaux: collecte.r.cloture,
        motif: null,
      });
    }
  } else {
    for (const c of ["R1", "R2", "R3", "R4", "R5"] as CodeItem[]) {
      out.set(c, vide("etape_non_collectee"));
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// 4 · Points
// ─────────────────────────────────────────────────────────────

function pointsPourVerdict(verdict: Verdict, max: number): number {
  if (verdict === "correct") return max;
  if (verdict === "partiel") return Math.round(max * RATIO_PARTIEL * 10) / 10;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Moteur
// ─────────────────────────────────────────────────────────────

export function agreger(
  p1: SortieP1,
  collecte: Collecte,
  mesures: MesuresDeterministes,
  verif: SortieVerifieur | null = null
): ResultatAnalyse {
  const avertissements: string[] = [];

  // 1 · Vérifieur
  const { collecte: propre, contestes } = appliquerVerifieur(collecte, verif);
  if (verif && verif.confiance_globale < 0.8) {
    avertissements.push(
      `Confiance du vérifieur à ${Math.round(verif.confiance_globale * 100)} %.`
    );
  }
  if (verif?.alerte) avertissements.push(`Alerte du vérifieur : ${verif.alerte}.`);

  // 2 · Validité
  const { evaluable, motifs } = verifierValidite(p1, mesures);

  // 3 · Verdicts
  const verdicts = calculerVerdicts(propre, mesures, p1);

  // 4 · Template
  const template = TEMPLATES[mesures.type_appel];
  const exclus = new Set<CodeItem>(template.items_exclus);

  // 6 · Assemblage
  const parEtape = new Map<CodeEtape, ResultatItem[]>();

  for (const def of ITEMS) {
    const v = verdicts.get(def.code) ?? {
      verdict: "non_applicable" as Verdict,
      signaux: {},
      motif: "item_non_code",
    };

    let verdict = v.verdict;
    let motif = v.motif;

    if (exclus.has(def.code)) {
      verdict = "non_applicable";
      motif = `exclu_du_template_${mesures.type_appel}`;
    }

    // non_applicable comme non_evaluable sortent du dénominateur : le
    // dénominateur est toujours calculé, jamais écrit en dur.
    const applicable = verdict !== "non_applicable" && verdict !== "non_evaluable";
    const item: ResultatItem = {
      code: def.code,
      nature: def.nature,
      verdict,
      points_obtenus: applicable ? pointsPourVerdict(verdict, def.points) : 0,
      points_max: applicable ? def.points : 0,
      signaux: v.signaux,
      signaux_contestes: contestes.get(def.code) ?? [],
      motif_non_applicable: motif,
    };

    const liste = parEtape.get(def.etape) ?? [];
    liste.push(item);
    parEtape.set(def.etape, liste);
  }

  const etapes: ResultatEtape[] = [];
  for (const code of ["C", "L", "E", "A", "R"] as CodeEtape[]) {
    const items = parEtape.get(code) ?? [];
    const applicables = items.filter(
      (i) => i.verdict !== "non_applicable" && i.verdict !== "non_evaluable"
    );
    const corrects = applicables.filter((i) => i.verdict === "correct").length;

    etapes.push({
      code,
      items,
      points_obtenus: items.reduce((s, i) => s + i.points_obtenus, 0),
      points_max: items.reduce((s, i) => s + i.points_max, 0),
      taux_conformite: applicables.length > 0 ? corrects / applicables.length : null,
    });
  }

  const obtenus = etapes.reduce((s, e) => s + e.points_obtenus, 0);
  const max = etapes.reduce((s, e) => s + e.points_max, 0);

  // Normalisation sur 100 : indispensable dès qu'un item est hors dénominateur.
  const scoreHorsPlafond = max > 0 ? Math.round((obtenus / max) * 1000) / 10 : null;
  let score = scoreHorsPlafond;

  // 5 · Conditions éliminatoires. Le plafonnement passe par l'unique filtre
  // plafonneLeScore() de config.ts — active ET déclenchée, rien d'autre.
  // Une condition suspendue ou indéterminée reste présente dans la sortie.
  const verdictsSimples = new Map<string, Verdict>(
    Array.from(verdicts.entries()).map(([code, v]) => {
      const exclu = exclus.has(code);
      return [code as string, exclu ? ("non_applicable" as Verdict) : v.verdict];
    })
  );
  const conditions = R.evaluerConditions(p1, propre, verdictsSimples, mesures.type_appel);
  const plafonnantes = conditions.filter(plafonneLeScore);
  const eliminatoire = plafonnantes.length > 0;

  // Le plafond ne s'applique JAMAIS sans son second chiffre : sans le score
  // hors plafond, le plafonnement dit « échec » ; avec lui, il dit ce que la
  // faute a coûté — et c'est ça qui se coache.
  if (score !== null && eliminatoire && score > PLAFOND_ELIMINATOIRE) {
    avertissements.push(
      `Score plafonné à ${PLAFOND_ELIMINATOIRE} par ${plafonnantes
        .map((c) => c.code)
        .join(", ")}. Score avant plafond : ${score}.`
    );
    score = PLAFOND_ELIMINATOIRE;
  }
  for (const c of conditions) {
    if (c.etat === "suspendue" && c.statut === "declenchee") {
      avertissements.push(
        `Condition ${c.code} constatée mais SUSPENDUE — jamais appliquée au score.`
      );
    }
    if (c.statut === "indeterminee") {
      avertissements.push(
        `Condition ${c.code} indéterminée (${c.motif ?? "matière manquante"}) — ne plafonne pas, ne disparaît pas.`
      );
    }
  }

  if (!evaluable) {
    avertissements.push(`Appel non évaluable : ${motifs.join(", ")}.`);
  }

  return {
    version_grille: VERSION_GRILLE,
    version_seuils: VERSION_SEUILS,
    type_appel: mesures.type_appel,
    evaluable,
    motifs_non_evaluable: motifs,
    eliminatoire_declenche: eliminatoire,
    conditions,
    score_hors_plafond: scoreHorsPlafond,
    etapes,
    points_obtenus: obtenus,
    points_max: max,
    score_sur_100: score,
    issue_structurelle: p1.issue_structurelle,
    issue_commerciale: mesures.issue_commerciale,
    hors_score: {
      c3: propre.c?.c3 ?? null,
      a4: propre.a?.a4 ?? null,
      objection_bloquante: propre.r?.bloquante ?? null,
    },
    avertissements,
  };
}

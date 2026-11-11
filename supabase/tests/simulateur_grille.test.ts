// Simulateur · grille d'analyse : tests du moteur (portés des tests d'origine, sans changement de logique), du prétraitement,
// du démarrage de l'analyse (éligibilité, conversation trop courte, plafond quotidien, chaîne complète avec un modèle simulé),
// du retour d'expérience et de son miroir, et de la reprise des analyses en attente.
// describe/it/expect sont une petite cale sur Deno.test (comme simulateur_etat.test.ts).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
const describe = (_n: string, f: () => void) => f();
const it = Object.assign((n: string, f: () => unknown) => Deno.test(n, f as () => void), {
  each: <T,>(valeurs: readonly T[]) => (n: string, f: (v: T) => unknown) =>
    valeurs.forEach((v) => Deno.test(n.replace("%s", String(v)), () => f(v) as void)),
});
function expect(a: any, _msg?: string) {
  const m = (neg: boolean) => {
    const ok = (c: boolean, txt: string) => { if (c === neg) throw new Error(`attendu${neg ? " (non)" : ""} : ${txt} — reçu ${JSON.stringify(a)}`); };
    const contient = (b: any) => typeof a === "string" ? a.includes(b) : a instanceof Set ? a.has(b) : Array.isArray(a) ? a.includes(b) : false;
    return {
      toBe: (b: any) => ok(Object.is(a, b), JSON.stringify(b)),
      toEqual: (b: any) => ok(JSON.stringify(a ?? null) === JSON.stringify(b ?? null), JSON.stringify(b)),
      toBeNull: () => ok(a === null, "null"),
      toBeDefined: () => ok(a !== undefined, "défini"),
      toBeTruthy: () => ok(!!a, "vrai"),
      toContain: (b: any) => ok(contient(b), `contient ${JSON.stringify(b)}`),
      toHaveProperty: (k: string) => ok(a != null && k in a, `propriété ${k}`),
      toHaveLength: (n: number) => ok(a?.length === n, `longueur ${n}`),
      toBeGreaterThan: (n: number) => ok(a > n, `> ${n}`),
      toBeGreaterThanOrEqual: (n: number) => ok(a >= n, `>= ${n}`),
      toBeLessThan: (n: number) => ok(a < n, `< ${n}`),
      toBeLessThanOrEqual: (n: number) => ok(a <= n, `<= ${n}`),
      toMatch: (r: RegExp | string) => ok(typeof r === "string" ? String(a).includes(r) : r.test(String(a)), String(r)),
      toThrow: (r?: RegExp | string) => {
        let e: unknown = null;
        try { a(); } catch (x) { e = x; }
        const msg = String((e as Error)?.message ?? "");
        ok(e !== null && (!r || (typeof r === "string" ? msg.includes(r) : r.test(msg))), `exception ${r ?? ""}`);
      },
    };
  };
  return Object.assign(m(false), { not: m(true) });
}

import { agreger, appliquerVerifieur } from "../functions/_shared/simulateur/grille/moteur/moteur.ts";
import { verdictL3, verdictL4 } from "../functions/_shared/simulateur/grille/moteur/regles.ts";
import {
  CONDITIONS_ELIMINATOIRES, ITEMS, PLAFOND_ELIMINATOIRE, SEUILS, TEMPLATES, TOTAL_GRILLE, totalPoints, verifierConfig, VERSION_SEUILS,
} from "../functions/_shared/simulateur/grille/moteur/config.ts";
import type { Collecte, MesuresDeterministes, SortieP1 } from "../functions/_shared/simulateur/grille/moteur/types.ts";
import {
  choisirCibleDrill, construirePointFaible, LIBELLES_ITEMS, LIBELLES_NIVEAU, versResultat,
} from "../functions/_shared/simulateur/grille/vers-resultat.ts";
import { normaliserTranscriptSimulation, pretraiter, ROLE_COMMERCIAL } from "../functions/_shared/simulateur/grille/pretraitement.ts";
import { analyserGrille, extraireJson, remplir } from "../functions/_shared/simulateur/grille/pipeline.ts";
import * as CONSIGNES from "../functions/_shared/simulateur/grille/prompts.ts";
import { creerAnalyse, jourParis } from "../functions/_shared/simulateur/grille/index.ts";
import { dbMemoire, type Appelant } from "../functions/_shared/simulateur/base.ts";
import type { Deps } from "../functions/_shared/simulateur/routes.ts";

// ═══ Porté du test d'origine : moteur (verrous de doctrine) ═══
{

// ─── Fixtures ────────────────────────────────────────────────

function p1Base(): SortieP1 {
  return {
    version_grille: "GRILLE_v1.0",
    unite_temporelle: "prise_de_parole",
    nb_prises_parole: 120,
    segments: [
      { code: "C", occurrence: 1, present: true, debut: 1, fin: 12, verbatim_debut: "x" },
      { code: "L", occurrence: 1, present: true, debut: 13, fin: 60, verbatim_debut: "x" },
      { code: "E", occurrence: 1, present: true, debut: 61, fin: 80, verbatim_debut: "x" },
      { code: "A", occurrence: 1, present: true, debut: 81, fin: 100, verbatim_debut: "x" },
      { code: "R", occurrence: 1, present: true, debut: 101, fin: 120, verbatim_debut: "x" },
    ],
    ordre_observe: ["C", "L", "E", "A", "R"],
    issue_structurelle: "cycle_complet",
    verbatim_disqualification: null,
    verbatim_engagement: null,
    moments: {
      m1_premier_enonce_offre: { present: true, prise_de_parole: 82, verbatim: "x" },
      m3_premiere_synthese_ecart: { present: true, prise_de_parole: 62, verbatim: "x" },
    },
    objections: [],
    anomalies: [],
  };
}

function collecteParfaite(): Collecte {
  return {
    c: {
      premiere_question_business: 13,
      c1: { connexion_presente: true, information_reprise: true, avant_business: true },
      c2: { duree_annoncee: true, deroule_annonce: true, accord_obtenu: true, decision_attendue: true, cadre_apres_diagnostic: false },
      c3: {},
      anomalies: [],
    },
    l: {
      l1: { questions_situation_nb: 3, reponses_factuelles: true },
      l2: { questions_probleme_nb: 3, douleur_verbalisee_prospect: true, creusement: true },
      l3: { questions_impact: [
              { probleme: "acquisition clients", verbatim_question: "x", prise_de_parole: 30 },
              { probleme: "acquisition clients", verbatim_question: "x", prise_de_parole: 34 },
            ], cout_verbalise_prospect: true },
      l4: { question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true },
      l6: { echanges_consecutifs_nb: 4 },
      anomalies: [],
    },
    e: {
      synthese_localisee: true,
      e1: { point_a: true, point_b: true, blocage: true, prise_de_parole: 62 },
      e2: { mots_exacts_reutilises: true },
      e3: { demande_validation: true, confirmation_prospect: true, avant_pitch: true },
      anomalies: [],
    },
    a: {
      pitch_localise: true,
      a1: { horodatage_premier_pitch: 82, horodatage_validation: 78, retour_diagnostic: false, validation_apres_retour: false },
      a2: { bloc_probleme: true, bloc_mecanisme: true, bloc_transformation: true, bloc_preuve: true, prise_de_parole_debut: 82 },
      a3: { valeur_avant_prix: true, valeur_reliee_au_gap: true },
      a4: {},
      anomalies: [],
    },
    r: {
      nb_objections: 1,
      objections: [
        { r1_acknowledge: true, r2_isolate: true, r2_avant_reponse: true, r3_clarify: true, r3_element_nouveau_prospect: true, r4_looping_present: true, r4_apres_aic: true, r4_mots_prospect: true },
      ],
      cloture: { r5_ask_present: true },
      bloquante: {},
      anomalies: [],
    },
  };
}

function mesures(ratioL: number | null): MesuresDeterministes {
  return {
    ratio_parole_global: 0.45,
    ratio_parole_segment_l: ratioL,
    monologues_60s: 0,
    duree_secondes: 2700,
    type_appel: "R1",
    issue_commerciale: "closed",
  };
}

function condition(res: ReturnType<typeof agreger>, code: string) {
  const c = res.conditions.find((x) => x.code === code);
  if (!c) throw new Error(`condition ${code} absente de la sortie`);
  return c;
}

// ─── Verrous ─────────────────────────────────────────────────

describe("grille v0.11", () => {
  it("totalise 90 points, dénominateur toujours calculé", () => {
    expect(TOTAL_GRILLE).toBe(90);
    expect(totalPoints()).toBe(90);
  });

  it("dénominateur effectif 87 sans diarisation (L5 hors dénominateur)", () => {
    const res = agreger(p1Base(), collecteParfaite(), mesures(null));
    expect(res.points_max).toBe(87);
    const l5 = res.etapes.flatMap((e) => e.items).find((i) => i.code === "L5")!;
    expect(l5.verdict).toBe("non_evaluable");
    expect(l5.points_max).toBe(0);
  });

  it("CORRECTIF 2B — segment E absent MAIS pitch positionné : E1-E3 ABSENTS (au dénominateur)", () => {
    const p1 = p1Base();
    p1.segments = p1.segments.map((s) => (s.code === "E" ? { ...s, present: false } : s));
    const col = collecteParfaite();
    col.e = undefined; // segment jamais découpé → rien collecté
    const res = agreger(p1, col, mesures(0.75));
    for (const code of ["E1", "E2", "E3"]) {
      const item = res.etapes.flatMap((e) => e.items).find((i) => i.code === code)!;
      expect(item.verdict).toBe("absent");
      expect(item.points_max).toBeGreaterThan(0); // reste au dénominateur
      expect(item.motif_non_applicable).toBe("pitch_positionne_sans_segment_e");
    }
  });

  it("CORRECTIF 2B — segment E absent SANS aucun pitch : E1-E3 non applicables (hors dénominateur)", () => {
    const p1 = p1Base();
    p1.segments = p1.segments.map((s) =>
      s.code === "E" || s.code === "A" ? { ...s, present: false } : s,
    );
    p1.moments = {}; // aucun énoncé d'offre
    const col = collecteParfaite();
    col.e = undefined;
    const res = agreger(p1, col, mesures(0.75));
    for (const code of ["E1", "E2", "E3"]) {
      const item = res.etapes.flatMap((e) => e.items).find((i) => i.code === code)!;
      expect(item.verdict).toBe("non_applicable");
      expect(item.points_max).toBe(0);
      expect(item.motif_non_applicable).toBe("segment_e_non_atteint");
    }
  });

  it("un item non évaluable sort du dénominateur sans changer les autres verdicts", () => {
    const avec = agreger(p1Base(), collecteParfaite(), mesures(0.75));
    const sans = agreger(p1Base(), collecteParfaite(), mesures(null));
    expect(avec.points_max).toBe(90);
    expect(sans.points_max).toBe(87);
    for (const item of avec.etapes.flatMap((e) => e.items)) {
      if (item.code === "L5") continue;
      const autre = sans.etapes.flatMap((e) => e.items).find((i) => i.code === item.code)!;
      expect(autre.verdict).toBe(item.verdict);
    }
  });
});

describe("conditions éliminatoires", () => {
  it("les cinq conditions sont toujours toutes présentes dans la sortie", () => {
    const res = agreger(p1Base(), collecteParfaite(), mesures(0.75));
    expect(res.conditions.map((c) => c.code).sort()).toEqual(
      [...CONDITIONS_ELIMINATOIRES.map((c) => c.code)].sort()
    );
  });

  it("C2 absent → CADRE_NON_POSE déclenchée → plafond 25 + score hors plafond exposé", () => {
    const col = collecteParfaite();
    col.c!.c2 = { duree_annoncee: false, deroule_annonce: false, accord_obtenu: false, decision_attendue: false, cadre_apres_diagnostic: false };
    const res = agreger(p1Base(), col, mesures(0.75));
    expect(condition(res, "CADRE_NON_POSE").statut).toBe("declenchee");
    expect(res.eliminatoire_declenche).toBe(true);
    expect(res.score_sur_100).toBe(PLAFOND_ELIMINATOIRE);
    expect(res.score_hors_plafond).not.toBeNull();
    expect(res.score_hors_plafond!).toBeGreaterThan(PLAFOND_ELIMINATOIRE);
  });

  it("C2 non évaluable → condition INDÉTERMINÉE : ne plafonne pas, ne disparaît pas", () => {
    const col = collecteParfaite();
    col.c = undefined; // étape C non collectée = matière manquante
    const res = agreger(p1Base(), col, mesures(0.75));
    const c = condition(res, "CADRE_NON_POSE");
    expect(c.statut).toBe("indeterminee");
    expect(res.eliminatoire_declenche).toBe(false);
    expect(res.score_sur_100).toBe(res.score_hors_plafond);
  });

  it("une condition suspendue déclenchée est constatée mais ne plafonne pas", () => {
    const col = collecteParfaite();
    // PITCH_DESALIGNE (suspendue) : valeur non reliée au gap.
    col.a!.a3 = { valeur_avant_prix: true, valeur_reliee_au_gap: false };
    const res = agreger(p1Base(), col, mesures(0.75));
    const c = condition(res, "PITCH_DESALIGNE");
    expect(c.etat).toBe("suspendue");
    expect(c.statut).toBe("declenchee");
    expect(res.eliminatoire_declenche).toBe(false);
    expect(res.score_sur_100).toBe(res.score_hors_plafond);
  });

  it("PITCH_AVANT_GAP par horodatages : pitch avant la synthèse → plafond", () => {
    const p1 = p1Base();
    p1.moments["m1_premier_enonce_offre"] = { present: true, prise_de_parole: 40, verbatim: "x" };
    const col = collecteParfaite();
    col.a!.a1 = { horodatage_premier_pitch: 40, retour_diagnostic: false, validation_apres_retour: false };
    const res = agreger(p1, col, mesures(0.75));
    expect(condition(res, "PITCH_AVANT_GAP").statut).toBe("declenchee");
    expect(res.eliminatoire_declenche).toBe(true);
    expect(res.score_sur_100).toBe(PLAFOND_ELIMINATOIRE);
    expect(res.score_hors_plafond).toBeGreaterThan(PLAFOND_ELIMINATOIRE);
  });

  it("RETOUR_DIAGNOSTIC est SUSPENDUE : retour positionné APRÈS le pitch → constatée, jamais appliquée", () => {
    const col = collecteParfaite();
    col.a!.a1 = { ...col.a!.a1, retour_diagnostic: true, prise_de_parole_retour: 90 };
    const res = agreger(p1Base(), col, mesures(0.75));
    const c = condition(res, "RETOUR_DIAGNOSTIC");
    expect(c.etat).toBe("suspendue");
    expect(c.statut).toBe("declenchee");
    expect(res.eliminatoire_declenche).toBe(false);
    expect(res.score_sur_100).toBe(res.score_hors_plafond);
  });

  it("RETOUR_DIAGNOSTIC : retour signalé SANS position → indéterminée, pas de plafond", () => {
    const col = collecteParfaite();
    col.a!.a1 = { ...col.a!.a1, retour_diagnostic: true };
    const res = agreger(p1Base(), col, mesures(0.75));
    expect(condition(res, "RETOUR_DIAGNOSTIC").statut).toBe("indeterminee");
    expect(res.eliminatoire_declenche).toBe(false);
  });

  it("RETOUR_DIAGNOSTIC : retour positionné AVANT le pitch → non déclenchée", () => {
    const col = collecteParfaite();
    col.a!.a1 = { ...col.a!.a1, retour_diagnostic: true, prise_de_parole_retour: 50 };
    const res = agreger(p1Base(), col, mesures(0.75));
    expect(condition(res, "RETOUR_DIAGNOSTIC").statut).toBe("non_declenchee");
  });

  it("comparerPrematurite : synthèse constatée sans position → indéterminée", () => {
    const p1 = p1Base();
    p1.moments["m3_premiere_synthese_ecart"] = { present: true, prise_de_parole: null as unknown as number, verbatim: "x" };
    const col = collecteParfaite();
    col.e!.e1 = { point_a: true, point_b: true, blocage: true };
    const res = agreger(p1, col, mesures(0.75));
    expect(condition(res, "PITCH_AVANT_GAP").statut).toBe("indeterminee");
    expect(res.eliminatoire_declenche).toBe(false);
  });

  // DOCTRINE (validée 14/08/2026) : en R2/R3 le gap a été validé lors d'un
  // appel antérieur — refaire la découverte serait une faute de vente.
  it.each(["R2", "R3"] as const)(
    "%s : PITCH_AVANT_GAP exemptée (gap validé en appel antérieur) — doctrine",
    (typeAppel) => {
      const p1 = p1Base();
      p1.moments["m1_premier_enonce_offre"] = { present: true, prise_de_parole: 40, verbatim: "x" };
      const col = collecteParfaite();
      col.a!.a1 = { ...col.a!.a1, horodatage_premier_pitch: 40 };
      const res = agreger(p1, col, { ...mesures(0.75), type_appel: typeAppel });
      const c = condition(res, "PITCH_AVANT_GAP");
      expect(c.statut).toBe("non_declenchee");
      expect(c.motif).toBe(`gap_valide_en_appel_anterieur_${typeAppel}`);
      expect(res.eliminatoire_declenche).toBe(false);
    }
  );

  it("trois actives, trois suspendues : la répartition des états est figée", () => {
    const res = agreger(p1Base(), collecteParfaite(), mesures(0.75));
    const etats = Object.fromEntries(res.conditions.map((c) => [c.code, c.etat]));
    expect(etats).toEqual({
      CADRE_NON_POSE: "active",
      PITCH_AVANT_GAP: "active",
      RETOUR_DIAGNOSTIC: "suspendue",
      GAP_NON_FORMULE: "suspendue",
      PITCH_DESALIGNE: "suspendue",
    });
  });

  it("ancre de pitch unique = minimum des quatre sources", () => {
    const p1 = p1Base();
    p1.moments["m1_premier_enonce_offre"] = { present: true, prise_de_parole: 70, verbatim: "x" };
    p1.moments["m2_premier_enonce_prix"] = { present: true, prise_de_parole: 95, verbatim: "x" };
    const col = collecteParfaite();
    // La source la plus précoce (a2 en 55) précède la synthèse (62) → déclenchée.
    col.a!.a1 = { ...col.a!.a1, horodatage_premier_pitch: 85 };
    col.a!.a2 = { ...col.a!.a2, prise_de_parole_debut: 55 };
    const res = agreger(p1, col, mesures(0.75));
    expect(condition(res, "PITCH_AVANT_GAP").statut).toBe("declenchee");
  });

  it("aucun pitch → PITCH_AVANT_GAP et RETOUR_DIAGNOSTIC éteintes (non applicable ≠ non évaluable)", () => {
    const p1 = p1Base();
    p1.moments = {};
    const col = collecteParfaite();
    col.a = { pitch_localise: false, a1: {}, a2: {}, a3: {}, a4: {}, anomalies: [] };
    col.e!.e1 = { ...col.e!.e1 };
    const res = agreger(p1, col, mesures(0.75));
    expect(condition(res, "PITCH_AVANT_GAP").statut).toBe("non_declenchee");
    expect(condition(res, "RETOUR_DIAGNOSTIC").statut).toBe("non_declenchee");
  });
});
}

// ═══ Porté du test d'origine : L3 Impact / L4 Vision et vérificateur ═══
{
const q = (probleme: string, pos: number) => ({
  probleme,
  verbatim_question: "qu'est-ce que ça te coûte ?",
  prise_de_parole: pos,
});

describe("L3 · Questions Impact (v0.12)", () => {
  it("le seuil vient de la config, jamais du code", () => {
    expect(SEUILS.L3_QUESTIONS_MEME_PROBLEME_MIN).toBe(2);
  });

  it("deux questions sur le MÊME problème + coût → correct", () => {
    const v = verdictL3({
      questions_impact: [q("acquisition clients", 30), q("acquisition clients", 34)],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("correct");
  });

  it("deux questions sur DEUX problèmes différents + coût → partiel", () => {
    const v = verdictL3({
      questions_impact: [q("acquisition clients", 30), q("organisation du temps", 34)],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("partiel");
  });

  it("une seule question avec coût → partiel", () => {
    const v = verdictL3({
      questions_impact: [q("acquisition clients", 30)],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("partiel");
  });

  it("deux questions même problème SANS coût → partiel", () => {
    const v = verdictL3({
      questions_impact: [q("acquisition clients", 30), q("acquisition clients", 34)],
      cout_verbalise_prospect: false,
    });
    expect(v).toBe("partiel");
  });

  it("aucune question d'impact → absent", () => {
    expect(verdictL3({ questions_impact: [], cout_verbalise_prospect: false })).toBe("absent");
    expect(verdictL3({ cout_verbalise_prospect: true })).toBe("absent");
  });

  it("payload legacy (compte scalaire) : jamais correct — rattachement indécidable", () => {
    // Fail-closed : l'ancienne forme n'apporte aucune preuve « même problème ».
    expect(
      verdictL3({ questions_implication_nb: 3, cout_verbalise_prospect: true }),
    ).toBe("partiel");
    expect(verdictL3({ questions_implication_nb: 0, cout_verbalise_prospect: false })).toBe("absent");
  });

  it("événements malformés ignorés (preuve incomplète = pas de preuve)", () => {
    const v = verdictL3({
      questions_impact: [
        { probleme: "", verbatim_question: "x", prise_de_parole: 1 },
        { verbatim_question: "x", prise_de_parole: 2 },
        { probleme: "acquisition clients" }, // sans verbatim ni position
        { probleme: "acquisition clients", verbatim_question: "x" }, // sans position
        { probleme: "acquisition clients", verbatim_question: "", prise_de_parole: 3 },
        q("acquisition clients", 30),
      ],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("partiel"); // une seule entrée valide
  });

  it("la même prise de parole dupliquée ne compte qu'une fois", () => {
    const v = verdictL3({
      questions_impact: [q("acquisition clients", 30), q("acquisition clients", 30)],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("partiel"); // une seule question réelle
  });

  it("deux entrées sans verbatim ni position ne valent JAMAIS correct", () => {
    const v = verdictL3({
      questions_impact: [{ probleme: "x" }, { probleme: "x" }],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("absent");
  });

  it("le rattachement est insensible à la casse et aux espaces de bord", () => {
    const v = verdictL3({
      questions_impact: [q(" Acquisition Clients ", 30), q("acquisition clients", 34)],
      cout_verbalise_prospect: true,
    });
    expect(v).toBe("correct");
  });
});

describe("L4 · Vision — critère inchangé, seul le nom change", () => {
  it("question + état futur + élément spécifique → correct", () => {
    expect(
      verdictL4({ question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true }),
    ).toBe("correct");
  });
  it("sans élément spécifique → partiel", () => {
    expect(
      verdictL4({ question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: false }),
    ).toBe("partiel");
  });
});

describe("version_seuils v0.12 sur production simulée (sans LLM)", () => {
  it("agreger() estampille v0.12", () => {
    const p1: SortieP1 = {
      version_grille: "GRILLE_v1.0", unite_temporelle: "prise_de_parole", nb_prises_parole: 120,
      segments: [
        { code: "C", occurrence: 1, present: true, debut: 1, fin: 12, verbatim_debut: "x" },
        { code: "L", occurrence: 1, present: true, debut: 13, fin: 60, verbatim_debut: "x" },
        { code: "E", occurrence: 1, present: true, debut: 61, fin: 80, verbatim_debut: "x" },
        { code: "A", occurrence: 1, present: true, debut: 81, fin: 100, verbatim_debut: "x" },
        { code: "R", occurrence: 1, present: true, debut: 101, fin: 120, verbatim_debut: "x" },
      ],
      ordre_observe: ["C", "L", "E", "A", "R"], issue_structurelle: "cycle_complet",
      verbatim_disqualification: null, verbatim_engagement: null,
      moments: {
        m1_premier_enonce_offre: { present: true, prise_de_parole: 82, verbatim: "x" },
        m3_premiere_synthese_ecart: { present: true, prise_de_parole: 62, verbatim: "x" },
      }, objections: [], anomalies: [],
    };
    const collecte: Collecte = {
      l: {
        l1: { questions_situation_nb: 3, reponses_factuelles: true },
        l2: { questions_probleme_nb: 3, douleur_verbalisee_prospect: true, creusement: true },
        l3: { questions_impact: [q("acquisition clients", 30), q("acquisition clients", 34)], cout_verbalise_prospect: true },
        l4: { question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true },
        l6: { echanges_consecutifs_nb: 4 }, anomalies: [],
      },
    };
    const mesures: MesuresDeterministes = {
      ratio_parole_global: 0.45, ratio_parole_segment_l: 0.75, monologues_60s: 0,
      duree_secondes: 2700, type_appel: "R1", issue_commerciale: null,
    };
    const r = agreger(p1, collecte, mesures);
    expect(r.version_seuils).toBe("v0.12");
    expect(VERSION_SEUILS).toBe("v0.12");
    // La règle L3 nouvelle est bien celle appliquée dans la production.
    const l3 = r.etapes.flatMap((e) => e.items).find((i) => i.code === "L3");
    expect(l3?.verdict).toBe("correct");
  });
});

describe("vérifieur : contestation d'une question d'impact", () => {
  const collecteL3 = (): Collecte => ({
    l: {
      l1: {}, l2: {},
      l3: {
        questions_impact: [
          { probleme: "acquisition clients", verbatim_question: "ça te coûte quoi ?", prise_de_parole: 30 },
          { probleme: "acquisition clients", verbatim_question: "et si rien ne change ?", prise_de_parole: 34 },
        ],
        cout_verbalise_prospect: true,
      },
      l4: {}, l6: {}, anomalies: [],
    },
  });

  it("l'entrée contestée par verbatim est retirée → correct devient partiel", () => {
    const { collecte } = appliquerVerifieur(collecteL3(), {
      signaux_contestes: [
        { champ: "l3_questions_impact", etape: "l", verbatim_conteste: "et si rien ne change ?" },
      ],
      confiance_globale: 0.9,
      alerte: null,
    });
    expect((collecte.l!.l3["questions_impact"] as unknown[]).length).toBe(1);
    expect(verdictL3(collecte.l!.l3)).toBe("partiel");
  });

  it("contestation sans verbatim exploitable → liste entière vidée (fail-closed)", () => {
    const { collecte } = appliquerVerifieur(collecteL3(), {
      signaux_contestes: [{ champ: "l3_questions_impact", etape: "l" }],
      confiance_globale: 0.9,
      alerte: null,
    });
    expect(collecte.l!.l3["questions_impact"]).toEqual([]);
    expect(verdictL3(collecte.l!.l3)).toBe("absent");
  });

  it("verbatim contesté sans correspondance → liste entière vidée (fail-closed)", () => {
    const { collecte } = appliquerVerifieur(collecteL3(), {
      signaux_contestes: [
        { champ: "l3_questions_impact", etape: "l", verbatim_conteste: "inexistant" },
      ],
      confiance_globale: 0.9,
      alerte: null,
    });
    expect(collecte.l!.l3["questions_impact"]).toEqual([]);
  });
});
}

// ═══ Porté du test d'origine : mode diagnostic (moteur) ═══
{
// ─── Fixtures ────────────────────────────────────────────────────────────────

function p1Base(): SortieP1 {
  return {
    version_grille: "GRILLE_v1.0",
    unite_temporelle: "prise_de_parole",
    nb_prises_parole: 120,
    segments: [
      { code: "C", occurrence: 1, present: true, debut: 1, fin: 12, verbatim_debut: "x" },
      { code: "L", occurrence: 1, present: true, debut: 13, fin: 60, verbatim_debut: "x" },
      { code: "E", occurrence: 1, present: true, debut: 61, fin: 80, verbatim_debut: "x" },
      { code: "A", occurrence: 1, present: false, debut: null, fin: null, verbatim_debut: null },
      { code: "R", occurrence: 1, present: false, debut: null, fin: null, verbatim_debut: null },
    ],
    ordre_observe: ["C", "L", "E"],
    issue_structurelle: "cycle_complet",
    verbatim_disqualification: null,
    verbatim_engagement: null,
    moments: {
      m3_premiere_synthese_ecart: { present: true, prise_de_parole: 62, verbatim: "x" },
    },
    objections: [],
    anomalies: [],
  };
}

function collecteDiagnostic(): Collecte {
  return {
    c: {
      premiere_question_business: 13,
      c1: { connexion_presente: true, information_reprise: true, avant_business: true },
      c2: { duree_annoncee: true, deroule_annonce: true, accord_obtenu: true, decision_attendue: true, cadre_apres_diagnostic: false },
      c3: {},
      anomalies: [],
    },
    l: {
      l1: { questions_situation_nb: 3, reponses_factuelles: true },
      l2: { questions_probleme_nb: 3, douleur_verbalisee_prospect: true, creusement: true },
      l3: {
        questions_impact: [
          { probleme: "acquisition clients", verbatim_question: "q1", prise_de_parole: 30 },
          { probleme: "acquisition clients", verbatim_question: "q2", prise_de_parole: 34 },
        ],
        cout_verbalise_prospect: true,
      },
      l4: { question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true },
      l6: { echanges_consecutifs_nb: 4 },
      anomalies: [],
    },
    e: {
      synthese_localisee: true,
      e1: { point_a: true, point_b: true, blocage: true, prise_de_parole: 62 },
      e2: { mots_exacts_reutilises: true },
      e3: { demande_validation: true, confirmation_prospect: true, avant_pitch: true },
      anomalies: [],
    },
    // Pas de a ni r : phases non jouées en mode diagnostic.
  };
}

function mesuresDiagnostic(ratioL: number | null = 0.75): MesuresDeterministes {
  return {
    ratio_parole_global: 0.45,
    ratio_parole_segment_l: ratioL,
    monologues_60s: 0,
    duree_secondes: 1800,
    type_appel: "diagnostic",
    issue_commerciale: null,
  };
}

// ─── 1. Template diagnostic — config ─────────────────────────────────────────

describe("TEMPLATES.diagnostic — exclusions exactes", () => {
  it("le template diagnostic existe", () => {
    expect(TEMPLATES).toHaveProperty("diagnostic");
  });

  it("exclut exactement A1, A2, A3 et R1, R2, R3, R4, R5", () => {
    const exclus = new Set(TEMPLATES.diagnostic.items_exclus);
    // Attendus exclus
    for (const code of ["A1", "A2", "A3", "R1", "R2", "R3", "R4", "R5"] as const) {
      expect(exclus, `${code} devrait être exclu`).toContain(code);
    }
    // Items NOT exclus
    for (const code of ["C1", "C2", "L1", "L2", "L3", "L4", "L5", "L6", "E1", "E2", "E3"] as const) {
      expect(exclus, `${code} ne devrait PAS être exclu`).not.toContain(code);
    }
  });

  it("n'exclut aucun item inconnu (cohérence config)", () => {
    const codes = ITEMS.map((i) => i.code);
    const inconnus = TEMPLATES.diagnostic.items_exclus.filter((c) => !codes.includes(c as any));
    expect(inconnus).toEqual([]);
  });
});

// ─── 2. Mécanisme non_applicable — items exclus hors dénominateur ─────────────

describe("diagnostic — non_applicable et dénominateur", () => {
  it("A1-A3 et R1-R5 sont non_applicable en mode diagnostic", () => {
    const res = agreger(p1Base(), collecteDiagnostic(), mesuresDiagnostic());
    const items = res.etapes.flatMap((e) => e.items);
    for (const code of ["A1", "A2", "A3", "R1", "R2", "R3", "R4", "R5"] as const) {
      const item = items.find((i) => i.code === code);
      expect(item, `item ${code} absent de la sortie`).toBeDefined();
      expect(item!.verdict, `${code} verdict`).toBe("non_applicable");
      expect(item!.points_max, `${code} points_max`).toBe(0);
    }
  });

  it("les items notés du diagnostic (C, L, E) restent évalués normalement", () => {
    const res = agreger(p1Base(), collecteDiagnostic(), mesuresDiagnostic());
    const items = res.etapes.flatMap((e) => e.items);
    for (const code of ["C1", "C2", "L1", "L2", "L3", "L4", "L6", "E1", "E2", "E3"] as const) {
      const item = items.find((i) => i.code === code);
      expect(item, `item ${code} absent`).toBeDefined();
      expect(item!.verdict, `${code} ne devrait pas être non_applicable`).not.toBe("non_applicable");
    }
  });

  it("le motif d'exclusion porte le type_appel 'diagnostic'", () => {
    const res = agreger(p1Base(), collecteDiagnostic(), mesuresDiagnostic());
    const a1 = res.etapes.flatMap((e) => e.items).find((i) => i.code === "A1")!;
    expect(a1.motif_non_applicable).toBe("exclu_du_template_diagnostic");
  });

  it("le dénominateur effectif exclut les points A et R", () => {
    const res = agreger(p1Base(), collecteDiagnostic(), mesuresDiagnostic());
    // Points A notés : A1=6, A2=4, A3=3 → 13 ; Points R notés : R1=2,R2=3,R3=3,R4=4,R5=6 → 18
    // Total = 90. Sans L5 (non_evaluable avec timings) : 87. Sans A(13)+R(18) = 87-31 = 56.
    // Avec L5 (ratioL fourni) : 90 - 13 - 18 = 59.
    expect(res.points_max).toBe(59);
  });

  it("version_seuils est v0.12 (compatibilité non altérée)", () => {
    const res = agreger(p1Base(), collecteDiagnostic(), mesuresDiagnostic());
    expect(res.version_seuils).toBe(VERSION_SEUILS);
    expect(res.version_seuils).toBe("v0.12");
  });
});

// ─── 3. Type inconnu/null — rejet strict pipeline (validation de logique) ────
}

// ═══ Porté du test d'origine : forme du résultat ═══
{

// ─── Fixtures (mêmes que le test doctrine du moteur) ─────────
function p1Base(): SortieP1 {
  return {
    version_grille: "GRILLE_v1.0",
    unite_temporelle: "prise_de_parole",
    nb_prises_parole: 120,
    segments: [
      { code: "C", occurrence: 1, present: true, debut: 1, fin: 12, verbatim_debut: "x" },
      { code: "L", occurrence: 1, present: true, debut: 13, fin: 60, verbatim_debut: "x" },
      { code: "E", occurrence: 1, present: true, debut: 61, fin: 80, verbatim_debut: "x" },
      { code: "A", occurrence: 1, present: true, debut: 81, fin: 100, verbatim_debut: "x" },
      { code: "R", occurrence: 1, present: true, debut: 101, fin: 120, verbatim_debut: "x" },
    ],
    ordre_observe: ["C", "L", "E", "A", "R"],
    issue_structurelle: "cycle_complet",
    verbatim_disqualification: null,
    verbatim_engagement: null,
    moments: {
      m1_premier_enonce_offre: { present: true, prise_de_parole: 82, verbatim: "x" },
      m3_premiere_synthese_ecart: { present: true, prise_de_parole: 62, verbatim: "x" },
    },
    objections: [],
    anomalies: [],
  };
}

function collecteParfaite(): Collecte {
  return {
    c: {
      premiere_question_business: 13,
      c1: { connexion_presente: true, information_reprise: true, avant_business: true, verbatim: "on s'était vus au salon" },
      c2: { duree_annoncee: true, deroule_annonce: true, accord_obtenu: true, decision_attendue: true, cadre_apres_diagnostic: false },
      c3: {},
      anomalies: [],
    },
    l: {
      l1: { questions_situation_nb: 3, reponses_factuelles: true },
      l2: { questions_probleme_nb: 3, douleur_verbalisee_prospect: true, creusement: true, verbatim_douleur: "je perds mes soirées" },
      l3: { questions_impact: [
              { probleme: "acquisition clients", verbatim_question: "ça te coûte quoi ?", prise_de_parole: 30 },
              { probleme: "acquisition clients", verbatim_question: "et si rien ne change ?", prise_de_parole: 34 },
            ], cout_verbalise_prospect: true, verbatim_cout: "3 000 euros par mois" },
      l4: { question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true },
      l6: { echanges_consecutifs_nb: 4 },
      anomalies: [],
    },
    e: {
      synthese_localisee: true,
      e1: { point_a: true, point_b: true, blocage: true, prise_de_parole: 62 },
      e2: { mots_exacts_reutilises: true },
      e3: { demande_validation: true, confirmation_prospect: true, avant_pitch: true },
      anomalies: [],
    },
    a: {
      pitch_localise: true,
      a1: { horodatage_premier_pitch: 82, horodatage_validation: 78, retour_diagnostic: false, validation_apres_retour: false },
      a2: { bloc_probleme: true, bloc_mecanisme: true, bloc_transformation: true, bloc_preuve: true, prise_de_parole_debut: 82 },
      a3: { valeur_avant_prix: true, valeur_reliee_au_gap: true },
      a4: {},
      anomalies: [],
    },
    r: {
      nb_objections: 1,
      objections: [
        { r1_acknowledge: true, r2_isolate: true, r2_avant_reponse: true, r3_clarify: true, r3_element_nouveau_prospect: true, r4_looping_present: true, r4_apres_aic: true, r4_mots_prospect: true },
      ],
      cloture: { r5_ask_present: true },
      bloquante: {},
      anomalies: [],
    },
  };
}

function mesures(ratioL: number | null): MesuresDeterministes {
  return {
    ratio_parole_global: 0.45,
    ratio_parole_segment_l: ratioL,
    monologues_60s: 0,
    duree_secondes: 2700,
    type_appel: "R1",
    issue_commerciale: "closed",
  };
}

function produire(analyse = agreger(p1Base(), collecteParfaite(), mesures(null))) {
  return versResultat({ analyse, dureeAnalyseMs: 1234, nbAppelsLlm: 7, drill: null });
}

// Clés que le front V2 consomme (AnalysisResult) — le contrat du .
const CLES_RACINE_V2 = [
  "timestamp", "duree_analyse_ms", "session", "aar", "dimensions",
  "score_total", "niveau", "turning_point", "point_fort", "point_faible",
  "drill", "annotations", "_meta",
];
const CLES_DIMENSIONS = ["structure", "diagnostic", "valeur", "pcm", "conclusion"];
const STATUTS_PERMIS = new Set(["correct", "partiel", "absent"]);

describe("forme du JSON produit (contrat du résultat + items)", () => {
  it("porte toutes les clés racine V2, avec les bons types", () => {
    const out = produire();
    for (const cle of CLES_RACINE_V2) expect(out).toHaveProperty(cle);
    expect(typeof out.timestamp).toBe("string");
    expect(typeof out.duree_analyse_ms).toBe("number");
    expect((out.session as any).mode).toBe("simulation");
    expect(out.aar).toBeNull();
    expect(typeof out.score_total).toBe("number");
    expect(typeof out.niveau).toBe("string");
    expect(out.turning_point).toBeNull();
    expect(typeof out.point_fort).toBe("string");
    expect(typeof out.point_faible).toBe("string");
    expect(Array.isArray(out.annotations)).toBe(true);
    expect(typeof (out._meta as any).llm_calls).toBe("number");
  });

  it("les cinq dimensions portent items[], score et scoreMax", () => {
    const dims = produire().dimensions as Record<string, any>;
    expect(Object.keys(dims).sort()).toEqual([...CLES_DIMENSIONS].sort());
    for (const cle of CLES_DIMENSIONS) {
      const d = dims[cle];
      expect(Array.isArray(d.items)).toBe(true);
      expect(d.items.length).toBeGreaterThan(0);
      expect(typeof d.score).toBe("number");
      expect(typeof d.scoreMax).toBe("number");
      for (const item of d.items) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.label).toBe("string");
        expect(STATUTS_PERMIS.has(item.statut)).toBe(true);
        expect(typeof item.points).toBe("number");
        expect("verbatim" in item).toBe(true);
        expect(typeof item.commentaire).toBe("string");
      }
    }
  });

  it("un item non évaluable n'est pas envoyé et son max sort du scoreMax", () => {
    // Sans diarisation, L5 est non_evaluable : absent des items, max 29-3=26.
    const dims = produire().dimensions as Record<string, any>;
    const ids = dims.diagnostic.items.map((i: any) => i.id);
    expect(ids).not.toContain("L5");
    expect(dims.diagnostic.scoreMax).toBe(26);
  });

  it("une annotation par item évalué, aucune pour un non évaluable", () => {
    const out = produire();
    const dims = out.dimensions as Record<string, any>;
    const nbItems = CLES_DIMENSIONS.reduce((s, c) => s + dims[c].items.length, 0);
    expect((out.annotations as any[]).length).toBe(nbItems);
    for (const a of out.annotations as any[]) {
      expect(CLES_DIMENSIONS).toContain(a.dimension);
      expect(["positif", "partiel", "negatif"]).toContain(a.evaluation);
    }
  });

  it("verbatim non vide quand un signal est affirmé (extrait des signaux)", () => {
    const dims = produire().dimensions as Record<string, any>;
    const c1 = dims.structure.items.find((i: any) => i.id === "C1");
    expect(c1.verbatim).toBe("on s'était vus au salon");
  });

  it("le verbatim est trouvé même niché dans un TABLEAU de signaux (objections)", () => {
    const col = collecteParfaite();
    (col.r!.objections as any[])[0].r1_verbatim = "je comprends votre hésitation";
    const analyse = agreger(p1Base(), col, mesures(null));
    const dims = versResultat({ analyse, dureeAnalyseMs: 1, nbAppelsLlm: 7, drill: null })
      .dimensions as Record<string, any>;
    const r1 = dims.conclusion.items.find((i: any) => i.id === "R1");
    expect(r1.verbatim).toBe("je comprends votre hésitation");
  });

  it("chaque item envoyé porte un libellé de la table fermée", () => {
    const dims = produire().dimensions as Record<string, any>;
    for (const cle of CLES_DIMENSIONS) {
      for (const item of dims[cle].items) {
        expect(item.label).toBe(LIBELLES_ITEMS[item.id]);
      }
    }
  });
});

describe("point_faible — arbitrage plafonnement", () => {
  it("plafond qui MORD → message avec le second chiffre", () => {
    // Cadre non posé : condition active déclenchée ; le reste parfait → mord.
    const col = collecteParfaite();
    col.c!.c2 = { duree_annoncee: false, deroule_annonce: false, accord_obtenu: false, decision_attendue: false, cadre_apres_diagnostic: false };
    const analyse = agreger(p1Base(), col, mesures(null));
    expect(analyse.eliminatoire_declenche).toBe(true);
    expect(analyse.score_sur_100).toBe(25);
    const pf = construirePointFaible(analyse);
    expect(pf).toContain("Appel plafonné");
    expect(pf).toContain(`Sans ce plafond : ${String(analyse.score_hors_plafond).replace(".", ",")}/100`);
  });

  it("éliminatoire déclenché sans morsure → constat SANS second chiffre", () => {
    // Cadre non posé + presque tout absent : score calculé sous 25.
    const col: Collecte = {
      c: { premiere_question_business: 13, c1: {}, c2: { duree_annoncee: false, deroule_annonce: false, accord_obtenu: false, decision_attendue: false, cadre_apres_diagnostic: false }, c3: {}, anomalies: [] },
      l: { l1: {}, l2: {}, l3: {}, l4: {}, l6: {}, anomalies: [] },
      e: { synthese_localisee: true, e1: { point_a: true, point_b: true, blocage: true, prise_de_parole: 62 }, e2: {}, e3: {}, anomalies: [] },
      a: { pitch_localise: true, a1: collecteParfaite().a!.a1, a2: {}, a3: {}, a4: {}, anomalies: [] },
      r: { nb_objections: 0, objections: [], cloture: {}, bloquante: {}, anomalies: [] },
    };
    const analyse = agreger(p1Base(), col, mesures(null));
    expect(analyse.eliminatoire_declenche).toBe(true);
    expect(analyse.score_sur_100).toBeLessThanOrEqual(25);
    const pf = construirePointFaible(analyse);
    expect(pf).toContain("Condition éliminatoire constatée");
    expect(pf).not.toContain("Sans ce plafond");
  });

  it("sans éliminatoire → le pilier qui perd le plus parmi L2/L3/E3/A1/R5", () => {
    const col = collecteParfaite();
    col.l!.l3 = { questions_implication_nb: 0, cout_verbalise_prospect: false };
    const analyse = agreger(p1Base(), col, mesures(null));
    expect(analyse.eliminatoire_declenche).toBe(false);
    expect(construirePointFaible(analyse)).toContain("L3");
  });
});

describe("cible du drill — choisie par le code", () => {
  it("éliminatoire déclenché → condition la plus en amont", () => {
    const col = collecteParfaite();
    col.c!.c2 = { duree_annoncee: false, deroule_annonce: false, accord_obtenu: false, decision_attendue: false, cadre_apres_diagnostic: false };
    const cible = choisirCibleDrill(agreger(p1Base(), col, mesures(null)));
    expect(cible?.cible).toBe("CADRE_NON_POSE");
    expect(cible?.type).toBe("cadrage");
  });

  it("sans éliminatoire → pilier le plus coûteux ; rien à perdre → null", () => {
    const col = collecteParfaite();
    col.l!.l3 = { questions_implication_nb: 0, cout_verbalise_prospect: false };
    const cible = choisirCibleDrill(agreger(p1Base(), col, mesures(null)));
    expect(cible?.cible).toBe("L3");
    expect(cible?.type).toBe("impact");
  });

  it("tie-break : deux piliers à moins de 2 points d'écart → le plus en amont", () => {
    // L2 et L3 absents : mêmes points perdus (7 et 7, écart 0 < 2) →
    // le plus en amont (L2) doit gagner, pas le premier trouvé par hasard.
    const col = collecteParfaite();
    col.l!.l2 = {};
    col.l!.l3 = { questions_implication_nb: 0, cout_verbalise_prospect: false };
    const analyse = agreger(p1Base(), col, mesures(null));
    const items = analyse.etapes.flatMap((e) => e.items);
    const perdu = (code: string) => {
      const i = items.find((x) => x.code === code)!;
      return i.points_max - i.points_obtenus;
    };
    // Précondition du scénario : écart strictement inférieur à 2 points.
    expect(Math.abs(perdu("L2") - perdu("L3"))).toBeLessThan(2);
    const cible = choisirCibleDrill(analyse);
    expect(cible?.cible).toBe("L2");
  });

  it("pas d'égalité : un pilier à 2 points ou plus devant reste la cible même en aval", () => {
    // Seul R5 (le plus en aval) est dégradé : il reste la cible — l'amont ne
    // s'applique qu'à moins de 2 points d'écart.
    const col = collecteParfaite();
    col.r!.cloture = { r5_ask_present: false };
    const analyse = agreger(p1Base(), col, mesures(null));
    const items = analyse.etapes.flatMap((e) => e.items);
    const r5 = items.find((x) => x.code === "R5")!;
    const perduR5 = r5.points_max - r5.points_obtenus;
    const autres = items
      .filter((x) => ["L2", "L3", "E3", "A1"].includes(x.code) && x.points_max > 0)
      .map((x) => x.points_max - x.points_obtenus);
    expect(perduR5 - Math.max(...autres)).toBeGreaterThanOrEqual(2);
    const cible = choisirCibleDrill(analyse);
    expect(cible?.cible).toBe("R5");
  });
});
}

// ═══ Porté du banc d'essai d'origine du moteur (test_complet) : cinq cas, sorties vérifiées ═══
{
  const p1: SortieP1 = {
    version_grille: "GRILLE_v1.0", unite_temporelle: "prise_de_parole", nb_prises_parole: 120,
    segments: [
      { code: "C", occurrence: 1, present: true, debut: 1, fin: 12, verbatim_debut: "x" },
      { code: "L", occurrence: 1, present: true, debut: 13, fin: 60, verbatim_debut: "x" },
      { code: "E", occurrence: 1, present: true, debut: 61, fin: 80, verbatim_debut: "x" },
      { code: "A", occurrence: 1, present: true, debut: 81, fin: 100, verbatim_debut: "x" },
      { code: "R", occurrence: 1, present: true, debut: 101, fin: 120, verbatim_debut: "x" },
    ],
    ordre_observe: ["C", "L", "E", "A", "R"], issue_structurelle: "cycle_complet",
    verbatim_disqualification: null, verbatim_engagement: null,
    moments: {
      m1_premier_enonce_offre: { present: true, prise_de_parole: 82, verbatim: "x" },
      m3_premiere_synthese_ecart: { present: true, prise_de_parole: 62, verbatim: "x" },
    }, objections: [], anomalies: [],
  };
  const parfait: Collecte = {
    c: { premiere_question_business: 13,
         c1: { connexion_presente: true, information_reprise: true, avant_business: true },
         c2: { duree_annoncee: true, deroule_annonce: true, accord_obtenu: true, decision_attendue: true, cadre_apres_diagnostic: false },
         c3: {}, anomalies: [] },
    l: { l1: { questions_situation_nb: 3, reponses_factuelles: true },
         l2: { questions_probleme_nb: 3, douleur_verbalisee_prospect: true, creusement: true },
         l3: { questions_impact: [
                 { probleme: "acquisition clients", verbatim_question: "x", prise_de_parole: 30 },
                 { probleme: "acquisition clients", verbatim_question: "x", prise_de_parole: 34 },
               ], cout_verbalise_prospect: true },
         l4: { question_projection: true, etat_futur_verbalise_prospect: true, element_specifique: true },
         l6: { echanges_consecutifs_nb: 4 }, anomalies: [] },
    e: { synthese_localisee: true,
         e1: { point_a: true, point_b: true, blocage: true },
         e2: { mots_exacts_reutilises: true },
         e3: { demande_validation: true, confirmation_prospect: true, avant_pitch: true }, anomalies: [] },
    a: { pitch_localise: true,
         a1: { horodatage_premier_pitch: 82, horodatage_validation: 78, retour_diagnostic: false, validation_apres_retour: false },
         a2: { bloc_probleme: true, bloc_mecanisme: true, bloc_transformation: true, bloc_preuve: true },
         a3: { valeur_avant_prix: true, valeur_reliee_au_gap: true }, a4: {}, anomalies: [] },
    r: { nb_objections: 2,
         objections: [
           { r1_acknowledge: true, r2_isolate: true, r2_avant_reponse: true, r3_clarify: true, r3_element_nouveau_prospect: true, r4_looping_present: true, r4_apres_aic: true, r4_mots_prospect: true },
           { r1_acknowledge: true, r2_isolate: true, r2_avant_reponse: true, r3_clarify: true, r3_element_nouveau_prospect: true, r4_looping_present: true, r4_apres_aic: true, r4_mots_prospect: true },
         ],
         cloture: { r5_ask_present: true }, bloquante: {}, anomalies: [] },
  };
  const mes = (ratioL: number | null): MesuresDeterministes => ({
    ratio_parole_global: 0.45, ratio_parole_segment_l: ratioL, monologues_60s: 0,
    duree_secondes: 2700, type_appel: "R1", issue_commerciale: "closed",
  });
  it("banc d'essai · cas 1 — appel exemplaire avec minutage : 100/100, 90/90", () => {
    const r = agreger(p1, parfait, mes(0.75));
    assertEquals([r.score_sur_100, r.points_obtenus, r.points_max], [100, 90, 90]);
    assertEquals(r.etapes.map((e) => `${e.code} ${e.points_obtenus}/${e.points_max}`), ["C 10/10", "L 29/29", "E 20/20", "A 13/13", "R 18/18"]);
  });
  it("banc d'essai · cas 2 — sans minutage : L5 sort du dénominateur (87/87)", () => {
    const r = agreger(p1, parfait, mes(null));
    assertEquals([r.score_sur_100, r.points_obtenus, r.points_max], [100, 87, 87]);
  });
  const p1Premature: SortieP1 = JSON.parse(JSON.stringify(p1));
  p1Premature.moments["m1_premier_enonce_offre"] = { present: true, prise_de_parole: 40, verbatim: "x" };
  const mauvais: Collecte = JSON.parse(JSON.stringify(parfait));
  mauvais.a!.a1 = { horodatage_premier_pitch: 40, retour_diagnostic: false, validation_apres_retour: false };
  it("banc d'essai · cas 3 — offre avant la synthèse de l'écart : plafond 25", () => {
    const r = agreger(p1Premature, mauvais, mes(0.75));
    assertEquals(r.eliminatoire_declenche, true);
    assertEquals(r.score_sur_100, PLAFOND_ELIMINATOIRE);
    assert(r.avertissements.some((a) => a.startsWith("Score plafonné à 25 par PITCH_AVANT_GAP")));
  });
  it("banc d'essai · cas 4 — retour au diagnostic : A1 partiel, plafonné, RETOUR_DIAGNOSTIC suspendue", () => {
    const rattrape: Collecte = JSON.parse(JSON.stringify(mauvais));
    rattrape.a!.a1 = { horodatage_premier_pitch: 40, retour_diagnostic: true, validation_apres_retour: true };
    const r = agreger(p1Premature, rattrape, mes(0.75));
    assertEquals(r.eliminatoire_declenche, true);
    assertEquals(r.score_sur_100, 25);
    assertEquals(r.etapes.flatMap((e) => e.items).find((i) => i.code === "A1")!.verdict, "partiel");
  });
  it("banc d'essai · cas 5 — prospect mutique (18 %) : non évaluable", () => {
    const r = agreger(p1, parfait, { ...mes(0.75), ratio_parole_global: 0.18 });
    assertEquals(r.evaluable, false);
    assertEquals(r.motifs_non_evaluable, ["ratio_parole_insuffisant"]);
  });
  it("configuration cohérente (90 points, aucun doublon)", () => {
    assertEquals(verifierConfig(), []);
  });
}

// ═══ Prétraitement et consignes ═══
it("normaliseur : une ligne par message, le vendeur toujours COMMERCIAL", () => {
  const t = normaliserTranscriptSimulation([
    { role: "prospect", content: "Allô ?" },
    { role: "commercial", content: "Bonjour Claire,\n  merci d'être là." },
    { role: "prospect", content: "Bonjour" },
  ]);
  assertEquals(t, "PROSPECT: Allô ?\nCOMMERCIAL: Bonjour Claire, merci d'être là.\nPROSPECT: Bonjour");
});

it("prétraitement : un prospect qui pose plus de questions ne prend jamais le rôle du vendeur", () => {
  const t = normaliserTranscriptSimulation([
    { role: "commercial", content: "Bonjour, je vous écoute." },
    { role: "prospect", content: "Combien ? Pourquoi ? Comment ? Quand ?" },
    { role: "commercial", content: "Je vous explique." },
  ]);
  const pre = pretraiter(t, ROLE_COMMERCIAL);
  assertEquals(pre.roles, { COMMERCIAL: "SALES", PROSPECT: "PROSPECT" });
  assertMatch(pre.transcriptFormate, /^\[1\] COMMERCIAL \(SALES\): Bonjour/);
  assertMatch(pre.transcriptFormate, /\[2\] PROSPECT \(PROSPECT\): Combien/);
  // sans le nom (comportement d'origine), l'heuristique des questions inversait les rôles
  assertEquals(pretraiter(t).roles, { COMMERCIAL: "PROSPECT", PROSPECT: "SALES" });
});

it("prétraitement : un seul interlocuteur est rejeté avant tout modèle", () => {
  const pre = pretraiter("COMMERCIAL: a\nCOMMERCIAL: b", ROLE_COMMERCIAL);
  assertEquals([pre.formatReconnu, pre.motifRejet], [false, "locuteur_unique"]);
});

it("consignes : chaque emplacement présent, aucun nom ni mot interdit", () => {
  const tout = Object.values(CONSIGNES).join("\n");
  // les mots interdits sont reconstitués ici pour ne pas figurer tels quels dans le dépôt
  const interdits = [["cle", "ar"], ["clo", "ser"], ["clo", "sing"], ["linked", "in"], ["whats", "app"], ["bel", "houk"], ["ros", "alia"]];
  for (const [x, y] of interdits) assert(!new RegExp(x + y, "i").test(tout), x + y);
  assert(CONSIGNES.P1_SEGMENTATION.includes("selon la grille d'analyse"));
  assert(CONSIGNES.P1_SEGMENTATION.endsWith("TRANSCRIPT :\n{{TRANSCRIPT}}"));
  assertEquals(remplir("a {{X}} b {{Y}}", { X: "$&", Y: "2" }), "a $& b 2");
});

it("extraction du JSON : clôtures retirées, du premier { au dernier }", () => {
  assertEquals(extraireJson("```json\n{\"a\":1}\n```"), { a: 1 });
  assertEquals(extraireJson("Voici : {\"a\":{\"b\":2}} fin"), { a: { b: 2 } });
  let e: unknown = null;
  try { extraireJson("rien"); } catch (x) { e = x; }
  assert(e);
});

it("type d'appel inconnu : rejet avant tout modèle", async () => {
  let appels = 0;
  let e: unknown = null;
  try {
    await analyserGrille({ cle: "k", fetchModele: async () => { appels++; return new Response("{}"); } }, { transcript: "x", typeAppel: "R4" as any, dureeMinutes: null });
  } catch (x) { e = x; }
  assertMatch(String((e as Error)?.message), /Type d'appel invalide/);
  assertEquals(appels, 0);
});

// ═══ Démarrage, plafond, chaîne complète, retour d'expérience, reprise ═══
const COMMERCIAL: Appelant = { id: "u-1", email: "c@exemple.fr", role: "sales", admin: false };
const AUTRE: Appelant = { id: "u-2", email: "a@exemple.fr", role: "sales", admin: false };
const ADMIN: Appelant = { id: "00000000-0000-0000-0000-000000000000", email: "", role: "admin", admin: true };
const MAINTENANT = new Date("2026-11-11T10:00:00Z");

const MESSAGES = [
  { role: "commercial", content: "Bonjour Claire, merci d'avoir pris ce temps. On a trente minutes, ça vous va ?" },
  { role: "prospect", content: "Oui, très bien. J'ai vu votre annonce et je voulais en savoir plus." },
  { role: "commercial", content: "Parfait. Où en êtes-vous aujourd'hui avec vos élèves ?" },
  { role: "prospect", content: "J'ai du mal à trouver des élèves, c'est épuisant et ça me coûte cher." },
];

// Réponses du modèle simulé, selon la consigne reçue
function reponsesParDefaut(): Record<string, unknown> {
  return {
    P1: {
      version_grille: "GRILLE_v1.0", unite_temporelle: "prise_de_parole", nb_prises_parole: 24,
      segments: [
        { code: "C", occurrence: 1, present: true, debut: 1, fin: 2, verbatim_debut: "Bonjour Claire" },
        { code: "L", occurrence: 1, present: true, debut: 3, fin: 4, verbatim_debut: "Où en êtes-vous" },
        { code: "E", occurrence: 1, present: false, debut: null, fin: null, verbatim_debut: null },
        { code: "A", occurrence: 1, present: false, debut: null, fin: null, verbatim_debut: null },
        { code: "R", occurrence: 1, present: false, debut: null, fin: null, verbatim_debut: null },
      ],
      ordre_observe: ["C", "L"], issue_structurelle: "interrompu", verbatim_disqualification: null, verbatim_engagement: null,
      moments: { m1_premier_enonce_offre: { present: false, prise_de_parole: null, verbatim: null } }, objections: [], anomalies: [],
    },
    C: { premiere_question_business: 3, c1: { connexion_presente: true, verbatim_connexion: "Bonjour Claire, merci d'avoir pris ce temps.", information_reprise: false, avant_business: true },
         c2: { duree_annoncee: true, deroule_annonce: false, accord_obtenu: true, decision_attendue: false, cadre_apres_diagnostic: false, verbatim_duree: "On a trente minutes" }, c3: {}, anomalies: [] },
    L: { l1: { questions_situation_nb: 1, reponses_factuelles: true, verbatim_reponse: "J'ai du mal à trouver des élèves" },
         l2: { questions_probleme_nb: 1, douleur_verbalisee_prospect: true, creusement: false, verbatim_douleur: "c'est épuisant" },
         l3: { questions_impact: [], cout_verbalise_prospect: false }, l4: { question_projection: false }, l6: { echanges_consecutifs_nb: 1 }, anomalies: [] },
    E: { synthese_localisee: false, e1: {}, e2: {}, e3: {}, anomalies: [] },
    R: { nb_objections: 0, objections: [], cloture: {}, bloquante: {}, anomalies: [] },
    A: { pitch_localise: false, a1: {}, a2: {}, a3: {}, a4: {}, anomalies: [] },
    P3: { signaux_contestes: [], incoherences: [], signaux_verifies_nb: 10, signaux_contestes_nb: 0, confiance_globale: 0.9, alerte: null },
    P4: { titre: "Creuser la douleur", duree_estimee: "2min", contexte: "Le prospect a dit que c'est épuisant.", consigne: "Pose deux questions de suite sur ce point.", exemple_reponse: null },
    MIROIR: { phases: [], annotations: [], miroir: {
      moment_bien_gere: { verdict: "confirme", verdict_label: "L'IA confirme", explication: "Bonne ouverture." },
      moment_difficile: { verdict: "nuance", verdict_label: "L'IA voit autre chose", explication: "Le cadre." },
      ce_que_je_referais: { verdict: "confirme", verdict_label: "L'IA confirme", explication: "Oui." },
      niveau: { verdict: "contredit", message: "Plus bas que prévu." } } },
  };
}

function modeleSimule(rep = reponsesParDefaut(), echecs: string[] = []) {
  const appels: { nom: string; body: any }[] = [];
  const fetchModele = async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const u = String(body.messages[0].content);
    const debut = u.slice(0, 160);
    const nom = body.system ? "MIROIR" : debut.startsWith("Tu es un analyste qui SEGMENTE") ? "P1" : debut.startsWith("Tu es un verificateur") ? "P3"
      : debut.startsWith("# P4") ? "P4" : debut.includes("phase d'ouverture") ? "C" : debut.includes("phase de diagnostic") ? "L"
      : debut.includes("phase de restitution") ? "E" : debut.includes("phase de traitement") ? "R" : debut.includes("presentation de l'offre") ? "A" : "?";
    appels.push({ nom, body });
    if (echecs.includes(nom)) return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "refus" } }), { status: 400 });
    const text = typeof rep[nom] === "string" ? rep[nom] as string : JSON.stringify(rep[nom] ?? {});
    return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: "end_turn" }));
  };
  return { appels, fetchModele };
}

function base(limit = 10, extra: Record<string, any[]> = {}) {
  return dbMemoire({
    crm_sim_config: [{ id: 1, daily_analysis_limit: limit }],
    crm_sim_simulations: [
      { id: 1, user_id: COMMERCIAL.id, status: "completed", simulation_mode: "full", duration_seconds: 600 },
      { id: 2, user_id: COMMERCIAL.id, status: "completed", simulation_mode: "objections", duration_seconds: 300 },
      { id: 3, user_id: COMMERCIAL.id, status: "completed", simulation_mode: "diagnostic", duration_seconds: 900 },
    ],
    ...extra,
  });
}

it("creerAnalyse a exactement la forme de Deps.analyse", () => {
  const a: NonNullable<Deps["analyse"]> = creerAnalyse({ db: base(), anthropicKey: "k" });
  assert(typeof a.reprendre === "function");
});

it("demarrer · mode objections : ligne « rejected », aucun modèle", async () => {
  const db = base(); const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  const r = await an.demarrer({ simulation: { id: 2, user_id: COMMERCIAL.id, simulation_mode: "objections" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  assertEquals(r.skippedAnalysis, true);
  assertMatch(String(r.reason), /Objections/);
  const [row] = db.tables.crm_sim_analyses;
  assertEquals([row.id, row.status, row.result._modele, row.result.grille_rejet], [r.analysisId, "rejected", "grille", "type_appel_non_pris_en_charge"]);
  assertEquals(m.appels.length, 0);
});

it("demarrer · conversation trop courte : rien d'enregistré", async () => {
  const db = base();
  const an = creerAnalyse({ db, anthropicKey: "k", now: () => MAINTENANT });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: [{ role: "commercial", content: "Bonjour" }, { role: "prospect", content: "Oui ?" }], appelant: COMMERCIAL, offerName: null });
  assertEquals(r, { analysisId: null, skippedAnalysis: true, reason: "Conversation trop courte pour être analysée" });
  assertEquals(db.tables.crm_sim_analyses ?? [], []);
});

it("demarrer · plafond quotidien atteint (jour de Paris) : ligne « deferred »", async () => {
  // une analyse déjà lancée aujourd'hui à Paris (23 h 30 UTC la veille = 0 h 30 à Paris), une autre hier
  const db = base(1, { crm_sim_analyses: [
    { id: "a0000000-0000-0000-0000-000000000001", simulation_id: 9, user_id: "x", status: "completed", cost: { lances: ["2026-11-10T23:30:00Z"] }, updated_at: "2026-11-10T23:40:00Z" },
    { id: "a0000000-0000-0000-0000-000000000002", simulation_id: 8, user_id: "x", status: "completed", cost: { lances: ["2026-11-10T22:30:00Z"] }, updated_at: "2026-11-10T22:40:00Z" },
  ] });
  assertEquals(jourParis(new Date("2026-11-10T23:30:00Z")), "2026-11-11");
  const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  assertEquals(r.status, "deferred");
  assertEquals(r.deferred, true);
  assertEquals(r.deferredReason, "Analyse mise en attente — plafond quotidien atteint");
  const row = db.tables.crm_sim_analyses.find((x) => x.id === r.analysisId);
  assertEquals([row.status, row.result.deferred_day, row.type_appel], ["deferred", "2026-11-11", "R1"]);
  assertEquals(m.appels.length, 0);
  // plafond à 0 : analyses coupées
  const db0 = base(0);
  const r0 = await creerAnalyse({ db: db0, anthropicKey: "k", now: () => MAINTENANT }).demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  assertEquals(r0.status, "deferred");
});

it("demarrer · chaîne complète (modèle simulé) : résultat, brut, coût, ordre et réglages des appels", async () => {
  const db = base(); const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full", duration_seconds: 600 }, messages: MESSAGES, appelant: COMMERCIAL, offerName: "Offre" });
  assertEquals(r.status, "processing");
  const [row] = db.tables.crm_sim_analyses;
  assertEquals([row.id, row.status, row.type_appel, row.attempts], [r.analysisId, "completed", "R1", 1]);
  assert(row.completed_at);
  assertMatch(row.transcript, /^COMMERCIAL: Bonjour Claire/);
  // ordre, modèles, max_tokens, pas de température
  assertEquals(m.appels.map((a) => a.nom), ["P1", "C", "L", "E", "R", "A", "P3", "P4"]);
  const par = Object.fromEntries(m.appels.map((a) => [a.nom, a.body]));
  assertEquals([par.P1.model, par.P1.max_tokens], ["claude-haiku-5-5", 8192]);
  assertEquals([par.C.max_tokens, par.A.max_tokens, par.P4.max_tokens], [4096, 4096, 2048]);
  assertEquals([par.P3.model, par.P3.max_tokens], ["claude-sonnet-5-5", 4096]);
  for (const a of m.appels) { assert(!("temperature" in a.body)); assert(!("system" in a.body)); }
  assertMatch(par.P1.messages[0].content, /\[1\] COMMERCIAL \(SALES\): Bonjour Claire/);
  for (const a of m.appels) assert(!/\{\{[A-Z_]+\}\}/.test(a.body.messages[0].content), `emplacement non rempli dans ${a.nom}`);
  // forme du résultat
  const res = row.result;
  for (const k of ["timestamp", "duree_analyse_ms", "session", "aar", "dimensions", "score_total", "niveau", "turning_point", "point_fort", "point_faible", "drill", "annotations", "grille", "_meta", "_modele"]) assert(k in res, k);
  assertEquals(res._modele, "grille");
  assert(!(["cle", "ar"].join("") in res));
  assertEquals(Object.keys(res.dimensions).sort(), ["conclusion", "diagnostic", "pcm", "structure", "valeur"]);
  assertEquals(typeof res.score_total, "number");
  assert(Object.keys(LIBELLES_NIVEAU).includes(res.niveau));
  assertEquals(res.grille.conditions.length, 5);
  assertEquals(res.drill.titre, "Creuser la douleur");
  // cadre partiel (2 composants sur 4) : aucune condition ; le pilier le plus coûteux est L3 (absent, 7 points)
  assertEquals([res.drill.type, res.grille.eliminatoire_declenche], ["impact", false]);
  assertMatch(res.point_faible, /^Pilier le plus coûteux de l'appel : L3/);
  assertMatch(par.P4.messages[0].content, /"cible":"L3"/);
  const c1 = res.dimensions.structure.items.find((i: any) => i.id === "C1");
  assertEquals([c1.label, c1.statut, c1.verbatim], [LIBELLES_ITEMS.C1, "partiel", "Bonjour Claire, merci d'avoir pris ce temps."]);
  assertEquals(c1.commentaire, "Signaux manquants : information reprise.");
  // L5 non évaluable (pas de minutage) : absent des items
  assert(!res.dimensions.diagnostic.items.some((i: any) => i.id === "L5"));
  // brut et coût
  assertEquals(Object.keys(row.raw).sort(), ["analyse", "collecte", "etapes_en_echec", "mesures", "p1", "pretraitement", "verif"]);
  assertEquals(row.raw.mesures.duree_secondes, 600);
  assertEquals(row.cost.appels.length, 8);
  assertEquals(row.cost.total_usd, Math.round((7 * (1000 * 0.10 + 200 * 0.50) + (1000 * 2 + 200 * 10)) / 1e6 * 10000) / 10000);
  assertEquals(res._meta.llm_calls, 8);
  // une deuxième fin d'appel réutilise la ligne
  const r2 = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  assertEquals([r2.analysisId, r2.status, db.tables.crm_sim_analyses.length], [r.analysisId, "processing", 1]);
});

it("demarrer · diagnostic : A et R hors du périmètre", async () => {
  const db = base(); const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  await an.demarrer({ simulation: { id: 3, user_id: COMMERCIAL.id, simulation_mode: "diagnostic" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const [row] = db.tables.crm_sim_analyses;
  assertEquals([row.status, row.type_appel], ["completed", "diagnostic"]);
  assertEquals([row.result.dimensions.pcm.scoreMax, row.result.dimensions.conclusion.scoreMax], [0, 0]);
});

it("demarrer · P1 en échec : ligne « failed » ; une collecte en échec : analyse partielle", async () => {
  const db = base(); const m = modeleSimule(reponsesParDefaut(), ["P1"]);
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const [row] = db.tables.crm_sim_analyses;
  assertEquals([row.id, row.status, row.result._modele], [r.analysisId, "failed", "grille"]);
  assertMatch(row.reason, /^P1 en échec/);
  assertEquals(m.appels.map((a) => a.nom), ["P1"]);
  // relance (nouvelle fin d'appel) : même ligne, P2-L et P3 en échec → terminée quand même
  const m2 = modeleSimule(reponsesParDefaut(), ["L", "P3"]);
  const an2 = creerAnalyse({ db, anthropicKey: "k", fetchModele: m2.fetchModele, now: () => MAINTENANT });
  await an2.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const [row2] = db.tables.crm_sim_analyses;
  assertEquals([row2.status, row2.attempts], ["completed", 2]);
  assertEquals(row2.raw.etapes_en_echec, ["P2_L_ecoute", "P3_verificateur"]);
  assertEquals(row2.result.dimensions.diagnostic.items.length, 0);
  assertEquals(row2.cost.lances.length, 2);
});

it("demarrer · JSON illisible du modèle de P4 : exercice null, analyse terminée", async () => {
  const rep = reponsesParDefaut(); rep.P4 = "désolé, pas de JSON";
  const db = base(); const m = modeleSimule(rep);
  await creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT })
    .demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const [row] = db.tables.crm_sim_analyses;
  assertEquals([row.status, row.result.drill], ["completed", null]);
});

const AAR_OK = { momentBienGere: "L'ouverture.", momentDifficile: "Le cadre.", ceQueJeReferais: "Annoncer la décision attendue.", niveauEstime: "strategic" };

it("aar · propriétaire seulement, quatre champs validés", async () => {
  const db = base(); const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT, attente: async () => {} });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const id = String(r.analysisId);
  assertEquals((await an.aar(id, AUTRE, AAR_OK)).status, 403);
  assertEquals((await an.aar("a0000000-0000-0000-0000-00000000dead", COMMERCIAL, AAR_OK)).status, 404);
  assertEquals((await an.aar("pas-un-id", COMMERCIAL, AAR_OK)).status, 404);
  assertEquals((await an.aar(id, COMMERCIAL, { ...AAR_OK, momentDifficile: "   " })).status, 400);
  assertEquals((await an.aar(id, COMMERCIAL, { ...AAR_OK, ceQueJeReferais: "x".repeat(2001) })).status, 400);
  assertEquals((await an.aar(id, COMMERCIAL, { ...AAR_OK, niveauEstime: "insuffisant" })).status, 400);
  const res = await an.aar(id, COMMERCIAL, AAR_OK);
  assertEquals(res.status, 200);
  const b = await res.json();
  assertEquals(b.success, true);
  assertEquals(b.miroir.moment_bien_gere, { reponse_commercial: "L'ouverture.", verdict: "confirme", verdict_label: "L'IA confirme", explication: "Bonne ouverture." });
  assertEquals(b.miroir.niveau.estime, "Stratégique");
  const [row] = db.tables.crm_sim_analyses;
  assertEquals(row.aar, AAR_OK);
  assertEquals(row.miroir, b.miroir);
  assertEquals(row.result.aar, AAR_OK);
  assertEquals(row.result.comparaison_aar.niveau_estime, "strategic");
  // un seul appel au miroir (claude-sonnet-5-5, 16384, consigne système), avec la transcription et les vrais maxima
  const mir = m.appels.filter((a) => a.nom === "MIROIR");
  assertEquals(mir.length, 1);
  assertEquals([mir[0].body.model, mir[0].body.max_tokens], ["claude-sonnet-5-5", 16384]);
  assertMatch(mir[0].body.messages[0].content, /^TRANSCRIPT DE L'APPEL :\n\nCOMMERCIAL: Bonjour Claire/);
  assertMatch(mir[0].body.messages[0].content, /Scores : Connexion [\d,]+\/10, Écoute/);
  assertMatch(mir[0].body.messages[0].content, /AUTO-ÉVALUATION DU COMMERCIAL/);
  // un second envoi ne recalcule pas le miroir
  await an.aar(id, COMMERCIAL, AAR_OK);
  assertEquals(m.appels.filter((a) => a.nom === "MIROIR").length, 1);
});

it("aar · envoyé pendant l'analyse : jamais effacé, miroir calculé à la fin de la chaîne", async () => {
  const db = base(); const m = modeleSimule();
  const taches: Promise<unknown>[] = [];
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT, waitUntil: (p) => { taches.push(p); }, attente: async () => {} });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  assertEquals(r.status, "processing");
  const res = await an.aar(String(r.analysisId), COMMERCIAL, AAR_OK);
  assertEquals((await res.json()).success, true);
  await Promise.all(taches);
  const [row] = db.tables.crm_sim_analyses;
  assertEquals(row.status, "completed");
  assertEquals(row.aar, AAR_OK);
  assert(row.miroir && row.miroir.moment_difficile.reponse_commercial === "Le cadre.");
  assertEquals(m.appels.filter((a) => a.nom === "MIROIR").length, 1);
});

it("aar · miroir illisible trois fois : null, le retour d'expérience reste enregistré", async () => {
  const rep = reponsesParDefaut(); rep.MIROIR = "pas de JSON";
  const db = base(); const m = modeleSimule(rep);
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT, attente: async () => {} });
  const r = await an.demarrer({ simulation: { id: 1, user_id: COMMERCIAL.id, simulation_mode: "full" }, messages: MESSAGES, appelant: COMMERCIAL, offerName: null });
  const b = await (await an.aar(String(r.analysisId), COMMERCIAL, AAR_OK)).json();
  assertEquals([b.success, b.miroir], [true, null]);
  assertEquals(m.appels.filter((a) => a.nom === "MIROIR").length, 3);
  assertEquals(db.tables.crm_sim_analyses[0].aar, AAR_OK);
});

it("reprendre · administrateurs (et tâche planifiée) : bloquées en échec, en attente relancées dans le plafond, que des nombres", async () => {
  const ancien = new Date(MAINTENANT.getTime() - 31 * 60_000).toISOString();
  const recent = new Date(MAINTENANT.getTime() - 5 * 60_000).toISOString();
  const transcript = normaliserTranscriptSimulation(MESSAGES);
  const db = base(2, { crm_sim_analyses: [
    { id: "b0000000-0000-0000-0000-000000000001", simulation_id: 5, user_id: "x", status: "processing", cost: { lances: [ancien] }, created_at: ancien, updated_at: ancien },
    { id: "b0000000-0000-0000-0000-000000000002", simulation_id: 6, user_id: "x", status: "processing", cost: { lances: [recent] }, created_at: recent, updated_at: recent },
    { id: "b0000000-0000-0000-0000-000000000003", simulation_id: 1, user_id: COMMERCIAL.id, status: "deferred", type_appel: "R1", transcript, cost: {}, created_at: "2026-11-10T08:00:00Z" },
    { id: "b0000000-0000-0000-0000-000000000004", simulation_id: 3, user_id: COMMERCIAL.id, status: "deferred", type_appel: "diagnostic", transcript, cost: {}, created_at: "2026-11-10T09:00:00Z" },
  ] });
  const m = modeleSimule();
  const an = creerAnalyse({ db, anthropicKey: "k", fetchModele: m.fetchModele, now: () => MAINTENANT });
  assertEquals((await an.reprendre(COMMERCIAL)).status, 403);
  const res = await an.reprendre(ADMIN);
  const b = await res.json();
  // plafond 2 : l'analyse ancienne (lancée il y a 31 min) et la récente comptent → aucune place ; après échec de l'ancienne, elle compte encore (lancée aujourd'hui)
  assertEquals(b, { relancees: 0, echouees: 1, enAttente: 2 });
  for (const v of Object.values(b)) assertEquals(typeof v, "number");
  const t = Object.fromEntries(db.tables.crm_sim_analyses.map((r) => [r.id.slice(-1), r]));
  assertEquals([t["1"].status, t["2"].status], ["failed", "processing"]);
  // plafond relevé : les deux en attente repartent, la plus ancienne d'abord
  db.tables.crm_sim_config[0].daily_analysis_limit = 3;
  const b2 = await (await an.reprendre(ADMIN)).json();
  assertEquals(b2, { relancees: 1, echouees: 0, enAttente: 1 });
  assertEquals([t["3"].status, t["4"].status], ["completed", "deferred"]);
  assertEquals(t["3"].raw.mesures.duree_secondes, 600);
});

// Simulateur, référentiel v0.13 : la mesure de réalisme et les consignes du prospect calibrées sur les vrais appels.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { mesurerRealisme, mots, CIBLES } from "../functions/_shared/simulateur/realisme.ts";
import { buildGatedDiagnosticPrompt, LOQUACITE, loquaciteDe } from "../functions/_shared/simulateur/build-gated-prompt.ts";
import { buildGatedObjectionsPrompt } from "../functions/_shared/simulateur/build-gated-objections-prompt.ts";
import { SimulationStateManager } from "../functions/_shared/simulateur/simulation-state-manager.ts";
import { MAX_HISTORY_MESSAGES } from "../functions/_shared/simulateur/prospect.ts";
import { VERSION_REFERENTIEL_SIMULATION } from "../functions/_shared/simulateur/referentiel-version.ts";
import type { Persona } from "../functions/_shared/simulateur/types.ts";

const phrase = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");
const P = (n: number, q = false) => ({ role: "prospect", content: phrase(n) + (q ? " ?" : ".") });
const C = (n: number) => ({ role: "commercial", content: phrase(n) + " ?" });

Deno.test("réalisme : les mots se comptent sur les espaces", () => {
  assertEquals(mots("Bah... euh, j'ai 9 500 € de côté."), 8);
  assertEquals(mots("   "), 0);
});

Deno.test("réalisme : une simulation trop courte n'est pas notée", () => {
  const r = mesurerRealisme([C(10), P(5), C(10), P(5)]);
  assertEquals(r.note, null);
  assertEquals(r.ecarts.length, 1);
  assertEquals(r.tours_prospect, 2);
});

Deno.test("réalisme : un prospect qui parle comme dans un vrai appel est proche de 100", () => {
  // 8 réponses : part de parole ~46 %, 55 mots par réponse, 2 sur 8 au-delà de 80 mots, 2 sur 8 avec une question
  const msgs = [C(60), P(30, true), C(70), P(120), C(60), P(40), C(50), P(25), C(70), P(90), C(60), P(45, true), C(60), P(50), C(80), P(40)];
  const r = mesurerRealisme(msgs);
  assert(r.note !== null && r.note >= 90, `note ${r.note}, écarts ${r.ecarts.join(" / ")}`);
  assertEquals(r.ecarts, []);
  assert(r.part_prospect! >= CIBLES.part_prospect.min && r.part_prospect! <= CIBLES.part_prospect.max);
  assertEquals(r.part_questions_prospect, 25);
});

Deno.test("réalisme : le prospect d'avant v0.13 (réponses de 5 à 15 mots, aucune question) est signalé", () => {
  const msgs: { role: string; content: string }[] = [];
  for (let i = 0; i < 10; i++) { msgs.push(C(45), P(8)); }
  const r = mesurerRealisme(msgs);
  assert(r.note !== null && r.note < 40, `note ${r.note}`);
  assert(r.ecarts.some((e) => e.startsWith("Le prospect parle trop peu")), r.ecarts.join(" / "));
  assert(r.ecarts.some((e) => e.startsWith("Réponses du prospect trop courtes")));
  assert(r.ecarts.some((e) => e.startsWith("Pas assez de longues réponses")));
  assert(r.ecarts.some((e) => e.startsWith("Le prospect ne pose pas assez de questions")));
});

const persona: Persona = {
  id: "t", difficulte: "moyen" as any,
  identite: { prenom: "Claire", age: 41, ville: "Lyon", metier: "Professeure de mathématiques", situation: "Certifiée", ca_actuel: "300 €", objectif_ca: "2 000 €" } as any,
  etatsInitiaux: { conscience: 3, confiance: 5, engagement: 5, etat_emotionnel: "NEUTRE" },
  backstory: "Elle donne des cours le mercredi.",
  douleurs: { surface: ["Pas assez d'élèves"], consequences: [], emotionnel: [], identitaire: [] },
  objections: [{ texte: "C'est cher", vraie_raison: "Peur", declencheur: "prix" } as any],
  styleLinguistique: { vocabulaire: [], tics: [], phrasesType: "", emotionVisible: "" } as any,
  comportementsUniques: {} as any, triggersPositifs: {} as any,
  objectionsMode: { prixOffre: "3 000 €", gap: { financier: "x", temps: null, total: null } } as any,
} as Persona;
const offre = {
  offer_identity: { company_name: "Les Nouveaux Profs" },
  offer_details: { main_offer: { price: "3 000 €", duration: "4 mois" } },
  content_for_simulation: { prospect_already_knows: ["Il y a une garantie"], prospect_unclear_about: ["Je suis prof titulaire, j'ai le droit ?"], vocabulary: { terms_prospects_use: ["élèves", "taux horaire"] } },
};

Deno.test("v0.13 : les consignes du prospect viennent des vrais appels", () => {
  const sm = new SimulationStateManager("moyen", undefined, "full", 5);
  const p = buildGatedDiagnosticPrompt({ persona, offerData: offre as any, stateManager: sm, mode: "full" });
  assert(p.includes("55 mots par réponse"), "longueurs calibrées");
  assert(p.includes("tu racontes ta situation, 80-200 mots"), "le prospect parle au début");
  assert(p.includes("environ une réponse sur quatre ou cinq en contient une") && p.includes("jamais deux réponses de suite avec une question"), "le prospect pose des questions, sans en abuser (rejeu du 2026-11-14 : 43 %)");
  assert(p.includes("peuvent venir comme repères concrets") && p.includes("Les faits, oui, comme un vrai prospect"), "les faits de famille passent, pas ce que ça fait");
  assert(!p.includes("5 mots max") && !p.includes("une phrase, pas plus"), "plus de plafonds en mots hérités de la source");
  assert(!p.includes("Tu ne poses JAMAIS de question"), "plus d'interdiction des questions");
  assert(!p.includes("1-10 mots") && !p.includes("une question = une info"), "plus de réponses en 1-10 mots");
  assert(p.includes("Je suis prof titulaire, j'ai le droit ?") && p.includes("Il y a une garantie") && p.includes("taux horaire"), "l'offre : ce que le prospect sait, se demande, ses mots");
  assert(p.includes(LOQUACITE.moyen), "loquacité moyenne par défaut");
  assert(p.includes("Tu écris comme tu parles"), "style oral en texte");
  assert(!p.includes("CONTRADICTIONS"), "pas de contradictions en difficulté moyenne");
  const bavard = buildGatedDiagnosticPrompt({ persona: { ...persona, loquacite: "bavard" }, offerData: offre as any, stateManager: sm, mode: "diagnostic" });
  assert(bavard.includes("Tu es BAVARD"));
  const expert = buildGatedDiagnosticPrompt({ persona, offerData: offre as any, stateManager: new SimulationStateManager("expert", undefined, "full", 3), mode: "full" });
  assert(expert.includes("CONTRADICTIONS") && expert.includes("Deux fois"), "un prospect expert se contredit deux fois");
  assert(expert.includes("tu ne LIVRES rien d'utile"), "la difficulté joue sur le contenu, pas la longueur");
  assertEquals(loquaciteDe({ ...persona, loquacite: "x" as any }), "moyen");
});

Deno.test("v0.13 : en objections, le prospect explique sa situation et pose des questions pratiques", () => {
  const sm = new SimulationStateManager("moyen", undefined, "objections", 6);
  sm.initObjectionState(["C'est cher"]);
  const p = buildGatedObjectionsPrompt({ persona: { ...persona, loquacite: "bref" }, offerData: offre as any, stateManager: sm });
  assert(p.includes("30-80 mots par réponse"), "longueurs d'objection calibrées");
  assert(p.includes("100-200 mots, en récit"));
  assert(p.includes("Tu poses des questions PRATIQUES, environ une réponse sur quatre ou cinq, jamais deux réponses de suite"));
  assert(!p.includes("3-20 mots") && !p.includes("MAX 20 mots"));
  assert(p.includes(LOQUACITE.bref));
});

Deno.test("v0.13 : version du référentiel et fenêtre d'historique", () => {
  assertEquals(VERSION_REFERENTIEL_SIMULATION, "v0.13");
  assertEquals(MAX_HISTORY_MESSAGES, 60);
});

Deno.test("v0.13 : sans analyse de signaux (voix, premier tour), le prospect n'est pas mis en résistance par défaut", () => {
  const sm = new SimulationStateManager("moyen", undefined, "full", 5);
  assertEquals(sm.getResistanceBehavior(), "");
  const p = buildGatedDiagnosticPrompt({ persona, offerData: offre as any, stateManager: sm, mode: "full", voiceMode: true });
  assert(!p.includes("vient de poser une question faible"), "pas de réaction « question faible » sans analyse");
});


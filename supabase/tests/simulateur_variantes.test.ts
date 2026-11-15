// Simulateur · la variante du jour (2026-11-15) : tirage, application au prospect, bloc des consignes, création d'une simulation.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { appliquerVariante, blocVariante, CONTEXTES, HUMEURS, libelleVariante, OBJECTIONS_SUPPLEMENTAIRES, tirerVariante } from "../functions/_shared/simulateur/variantes.ts";
import { buildGatedDiagnosticPrompt } from "../functions/_shared/simulateur/build-gated-prompt.ts";
import { buildGatedObjectionsPrompt } from "../functions/_shared/simulateur/build-gated-objections-prompt.ts";
import { SimulationStateManager } from "../functions/_shared/simulateur/simulation-state-manager.ts";
import { app } from "../functions/_shared/simulateur/routes.ts";
import { dbMemoire } from "../functions/_shared/simulateur/base.ts";
import type { Persona } from "../functions/_shared/simulateur/types.ts";

const suite = (...u: number[]) => { let i = 0; return () => u[Math.min(i++, u.length - 1)]; };

Deno.test("variante : le tirage est déterministe pour un aléa donné, et « rien » est possible", () => {
  const rien = tirerVariante(suite(0, 0, 0, 0), { loquacite: "bavard" });
  assertEquals([rien.humeur, rien.contexte, rien.objection, rien.loquacite, rien.libelle], [null, null, null, "bavard", "Prospect tel quel"]);
  const tout = tirerVariante(suite(0.35, 0.5, 0.4, 0.95), { loquacite: "moyen" });
  assertEquals([tout.humeur, tout.contexte, tout.objection?.texte], [HUMEURS[0].libelle, CONTEXTES[0].libelle, OBJECTIONS_SUPPLEMENTAIRES[0].texte]);
  assertEquals(tout.loquacite, "bavard");
  assertEquals(tout.libelle, "Manque de temps · Dans la voiture · Une objection de plus · Plutôt bavard");
  const fin = tirerVariante(suite(0.999, 0.999, 0.999, 0.7), { loquacite: "moyen" });
  assertEquals([fin.humeur, fin.contexte, fin.objection?.texte, fin.loquacite], [HUMEURS[5].libelle, CONTEXTES[3].libelle, OBJECTIONS_SUPPLEMENTAIRES[5].texte, "bref"]);
  // sans réglage, la loquacité de référence est « moyen »
  assertEquals(tirerVariante(suite(0, 0, 0, 0)).loquacite, "moyen");
  // sur 2 000 tirages : ni toujours rien, ni toujours tout
  let sans = 0; for (let i = 0; i < 2000; i++) { const v = tirerVariante(); if (v.libelle === "Prospect tel quel") sans++; }
  assert(sans > 50 && sans < 500, `prospect tel quel ${sans} fois sur 2000`);
});

const persona: Persona = {
  id: "t", difficulte: "moyen" as any, loquacite: "moyen",
  identite: { prenom: "Claire", age: 41, ville: "Lyon", metier: "Professeure", situation: "Certifiée", ca_actuel: "300 €", objectif_ca: "2 000 €" } as any,
  etatsInitiaux: { conscience: 3, confiance: 5, engagement: 5, etat_emotionnel: "NEUTRE" },
  backstory: "x", douleurs: { surface: ["Pas assez d'élèves"], consequences: [], emotionnel: [], identitaire: [] },
  objections: [{ texte: "C'est cher", vraie_raison: "Peur", declencheur: "prix" } as any],
  styleLinguistique: { vocabulaire: [], tics: [], phrasesType: "", emotionVisible: "" } as any,
  comportementsUniques: {} as any, triggersPositifs: {} as any,
  objectionsMode: { prixOffre: "3 000 €", gap: { financier: "x", temps: null, total: null } } as any,
} as Persona;

Deno.test("variante : appliquée au prospect, elle entre dans les consignes des deux modes", () => {
  const v = tirerVariante(suite(0.35, 0.5, 0.4, 0.95), { loquacite: "moyen" });
  const p = appliquerVariante(persona, v);
  assertEquals(p.loquacite, "bavard");
  assertEquals(p.objections.length, 2);
  assertEquals(p.objections[1].texte, OBJECTIONS_SUPPLEMENTAIRES[0].texte);
  assertEquals(appliquerVariante(p, v).objections.length, 2, "pas de doublon");
  const bloc = blocVariante(p);
  assert(bloc.startsWith("AUJOURD'HUI") && bloc.includes("25 minutes") && bloc.includes("garé sur un parking") && bloc.includes("Une objection de plus"), bloc);
  const full = buildGatedDiagnosticPrompt({ persona: p, offerData: {} as any, stateManager: new SimulationStateManager("moyen", undefined, "full", 5), mode: "full" });
  assert(full.includes("AUJOURD'HUI") && full.includes("Tu es BAVARD"), "appel complet");
  const so = new SimulationStateManager("moyen", undefined, "objections", 6); so.initObjectionState(p.objections.map((o) => o.texte));
  const obj = buildGatedObjectionsPrompt({ persona: p, offerData: {} as any, stateManager: so });
  assert(obj.includes("AUJOURD'HUI") && obj.includes(OBJECTIONS_SUPPLEMENTAIRES[0].texte), "objections");
  // sans rien de particulier : pas de bloc
  const rien = appliquerVariante(persona, tirerVariante(suite(0, 0, 0, 0), { loquacite: "moyen" }));
  assertEquals(blocVariante(rien), "");
  assertEquals(blocVariante(persona), "");
  assertEquals(libelleVariante({ ...rien.variante as any, loquacite: "bref" }, "moyen"), "Plutôt bref");
});

Deno.test("variante : tirée à la création de la simulation, gardée dans persona_data, refusable", async () => {
  const S1 = "11111111-1111-4111-8111-111111111111";
  const row = { id: "lnp-claire", offer_id: "o1", first_name: "Claire", difficulty: "moyen", active: true, full_persona_data: persona };
  const db = dbMemoire({ crm_sim_personas: [row], crm_sim_offers: [{ id: "o1", name: "Offre", data: {} }], crm_sim_config: [{ id: 1, claude_model: "claude-sonnet-5-5" }] });
  const h = app({ db, anthropicKey: "k", auth: () => Promise.resolve({ id: S1, email: "s1@lnp.fr", role: "sales", admin: false }), alea: suite(0.35, 0.5, 0.4, 0.95) });
  const req = (body: unknown) => h(new Request("http://x/simulations", { method: "POST", headers: { Authorization: "Bearer s1", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const sim = await (await req({ personaId: "lnp-claire", simulationMode: "objections" })).json();
  assertEquals(sim.persona_data.variante.libelle, "Manque de temps · Dans la voiture · Une objection de plus · Plutôt bavard");
  assertEquals(sim.persona_data.objections.length, 2);
  assertEquals(sim.persona_data.loquacite, "bavard");
  assertEquals(sim.messages[0].role, "prospect", "en objections le prospect parle le premier");
  const sans = await (await req({ personaId: "lnp-claire", simulationMode: "full", variante: false })).json();
  assertEquals(sans.persona_data.variante, undefined);
  assertEquals(sans.persona_data.objections.length, 1);
});

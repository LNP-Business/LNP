// Simulateur : les routes de la fonction Edge `simulateur` sur une base en mémoire, avec un modèle simulé (aucun appel réseau).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { app } from "../functions/_shared/simulateur/routes.ts";
import { dbMemoire } from "../functions/_shared/simulateur/base.ts";
import { nombresEnLettres, transcriptionVide, decoupeVoix } from "../functions/_shared/simulateur/voix.ts";

const S1 = "11111111-1111-1111-1111-111111111111", S2 = "22222222-2222-2222-2222-222222222222", ADM = "33333333-3333-3333-3333-333333333333";
const PERSONA = {
  id: "lnp-claire", offer_id: "off-1", first_name: "Claire", difficulty: "difficile", active: true, voice_id: null,
  full_persona_data: {
    identite: { prenom: "Claire", age: 41, ville: "Lyon", metier: "Professeure de mathématiques", situation: "Certifiée, 15 ans d'ancienneté", ca_actuel: "300 €/mois", objectif_ca: "2 000 €/mois" },
    etatsInitiaux: { conscience: 3, confiance: 5, engagement: 5, etat_emotionnel: "NEUTRE" },
    backstory: "Elle donne quelques cours le mercredi.",
    douleurs: { surface: ["Pas assez d'élèves"], consequences: ["Fins de mois serrées"], emotionnel: ["Peur de l'échec"], identitaire: ["Se sentir légitime"] },
    objections: [{ texte: "C'est cher", vraie_raison: "Peur de perdre l'argent", declencheur: "prix" }, { texte: "Je dois en parler à mon mari", vraie_raison: "Doute", declencheur: "décision" }],
    styleLinguistique: { vocabulaire: ["franchement"], tics: ["bon"], phrasesType: "courtes", emotionVisible: "contenue" },
    objectionsMode: { prixOffre: "3 000 €", gap: { financier: "20 000 €/an", temps: null, total: null } },
    messagesInitiaux: { diagnostic: "Bon, ok, on commence.", objections: "3 000 €... c'est pas donné." },
  },
};
const OFFRE = { id: "off-1", name: "Accompagnement LNP", data: { offer_identity: { company_name: "Les Nouveaux Profs", main_promise: "Vivre des cours particuliers" }, offer_details: { main_offer: { price: "3 000 €", duration: "4 mois" } } } };

// Le modèle simulé : les analyses de signaux reçoivent un JSON, le prospect une réponse diffusée
function modele(reponse = "Bah... franchement c'est compliqué, j'ai 9 500 € de côté.") {
  const appels: { body: any }[] = [];
  const f = (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    appels.push({ body });
    if (body.stream) {
      const evts = [
        { type: "message_start", message: { usage: { input_tokens: 100, output_tokens: 0 } } },
        ...reponse.match(/.{1,12}/gs)!.map((t) => ({ type: "content_block_delta", delta: { type: "text_delta", text: t } })),
        { type: "message_delta", usage: { output_tokens: 20 } },
      ];
      const txt = evts.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
      return Promise.resolve(new Response(txt, { headers: { "content-type": "text/event-stream" } }));
    }
    const sys = JSON.stringify(body.system ?? "");
    const text = sys.includes("Tu analyses le dernier message")
      ? '{"cq":"s","r":[true,"a"],"e":[true,"a"],"dr":"si","f":[],"rp":false,"pd":false}'
      : '{"qt":"o","qd":"c","ph":"p3","rv":["si"],"sy":false,"gp":false,"eg":false,"vl":false,"f":[]}';
    return Promise.resolve(Response.json({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } }));
  };
  return { f, appels };
}

function monter(opts: { reponse?: string; analyse?: any } = {}) {
  const db = dbMemoire({ crm_sim_personas: [PERSONA], crm_sim_offers: [OFFRE], crm_sim_config: [{ id: 1, claude_model: "claude-sonnet-5-5", voice_mode_enabled: true }] });
  const m = modele(opts.reponse);
  const qui: Record<string, any> = {
    s1: { id: S1, email: "s1@lnp.fr", role: "sales", admin: false },
    s2: { id: S2, email: "s2@lnp.fr", role: "sales", admin: false },
    adm: { id: ADM, email: "adm@lnp.fr", role: "admin", admin: true },
  };
  const h = app({ db, anthropicKey: "sk-test", auth: (j) => Promise.resolve(qui[j] ?? null), fetchModele: m.f, analyse: opts.analyse });
  const req = (jeton: string, method: string, chemin: string, body?: unknown) =>
    h(new Request(`https://x.supabase.co/functions/v1/simulateur/${chemin}`, { method, headers: { authorization: `Bearer ${jeton}` }, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { db, m, req };
}

async function evenements(r: Response) {
  const t = await r.text();
  return t.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
}

Deno.test("simulateur : sans jeton d'un membre de l'équipe, rien", async () => {
  const { req } = monter();
  assertEquals((await req("inconnu", "GET", "moi")).status, 401);
});

Deno.test("simulateur : lancer un appel complet, le prospect ne parle pas le premier ; en diagnostic, si", async () => {
  const { req, db } = monter();
  const r = await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" });
  assertEquals(r.status, 201);
  const sim = await r.json();
  assertEquals([sim.prospect_name, sim.difficulty, sim.prospect_profile, sim.messages.length, sim.version_referentiel], ["Claire", "difficile", "Difficile", 0, "v0.13"]);
  const d = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "diagnostic" })).json();
  assertEquals(d.messages.length, 1);
  assertEquals(d.messages[0].role, "prospect");
  const o = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "objections" })).json();
  assertEquals(o.messages[0].content, "3 000 €... c'est pas donné.");
  assertEquals((await req("s1", "POST", "simulations", { simulationMode: "objections" })).status, 400);
  assertEquals((await req("s1", "POST", "simulations", { personaId: "inconnu" })).status, 400);
  assertEquals(db.tables.crm_sim_simulations.length, 3);
});

Deno.test("simulateur : une réplique, la réponse du prospect en flux, l'état du moteur gardé", async () => {
  const { req, db, m } = monter();
  const sim = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" })).json();
  const ev = await evenements(await req("s1", "POST", `simulations/${sim.id}/messages`, { content: "Bonjour Claire, qu'est-ce qui vous amène ?" }));
  assertEquals(ev[0].userMessage.role, "commercial");
  const texte = ev.filter((e) => e.content).map((e) => e.content).join("");
  assertEquals(texte, "Bah... franchement c'est compliqué, j'ai 9 500 € de côté.");
  const fin = ev[ev.length - 1];
  assert(fin.done && fin.prospectMessage.content === texte);
  const s = db.tables.crm_sim_simulations[0];
  assertEquals(s.simulation_state.turnCount, 1, "un tour compté par le moteur");
  assertEquals(s.simulation_state.previousProspectResponse, texte);
  assert(s.simulation_state.confidence > 5, "une bonne question fait monter la confiance");
  assert(s.usage.prospect.calls === 1 && s.usage.signaux.calls === 2, "le coût est suivi");
  const prospect = m.appels.find((a) => a.body.stream)!.body;
  assertEquals(prospect.model, "claude-sonnet-5-5");
  assertEquals(prospect.thinking, { type: "between_tools" });
  assertEquals("temperature" in prospect, false);
  assert(prospect.system[0].text.includes("Tu es Claire, 41 ans"), "les consignes du prospect viennent du moteur");
  assert(prospect.system[0].text.includes("Les Nouveaux Profs"), "l'offre est lue");
  assertEquals(prospect.messages[0].role, "user");
  // un autre commercial ne peut pas écrire dans cette simulation
  assertEquals((await req("s2", "POST", `simulations/${sim.id}/messages`, { content: "x" })).status, 403);
});

Deno.test("simulateur : une erreur du modèle retire la réplique du commercial", async () => {
  const { req, db } = monter();
  const sim = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" })).json();
  const h = app({ db, anthropicKey: "sk-test", auth: () => Promise.resolve({ id: S1, email: "", role: "sales", admin: false }),
    fetchModele: () => Promise.resolve(Response.json({ error: { type: "overloaded_error", message: "Overloaded" } }, { status: 529 })) });
  const r = await h(new Request(`https://x/functions/v1/simulateur/simulations/${sim.id}/messages`, { method: "POST", headers: { authorization: "Bearer s1" }, body: JSON.stringify({ content: "Bonjour" }) }));
  const ev = await evenements(r);
  assertEquals(ev[ev.length - 1].error.code, "PROVIDER_UNAVAILABLE");
  assertEquals(db.tables.crm_sim_messages?.length ?? 0, 0);
});

Deno.test("simulateur : annuler le dernier échange, terminer, noter une fois", async () => {
  const analyses: any[] = [];
  const { req, db } = monter({ analyse: {
    demarrer: (p: any) => { analyses.push(p); return Promise.resolve({ analysisId: "a-1", status: "processing" }); },
    aar: () => Promise.resolve(new Response("{}")),
  } });
  const sim = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" })).json();
  await (await req("s1", "POST", `simulations/${sim.id}/messages`, { content: "Bonjour" })).text();
  await (await req("s1", "POST", `simulations/${sim.id}/messages`, { content: "Et ensuite ?" })).text();
  const u = await (await req("s1", "DELETE", `simulations/${sim.id}/messages/undo`)).json();
  assertEquals([u.deleted, u.messageCount], [2, 2]);
  const fin = await (await req("s1", "POST", `simulations/${sim.id}/end`, {})).json();
  assertEquals([fin.analysisId, fin.status, fin.simulation.status], ["a-1", "processing", "completed"]);
  assertEquals(analyses[0].messages.length, 2);
  assertEquals(analyses[0].offerName, "Accompagnement LNP");
  assertEquals((await req("s1", "DELETE", `simulations/${sim.id}/messages/undo`)).status, 400, "plus d'annulation une fois terminé");
  assertEquals((await req("s1", "POST", `simulations/${sim.id}/messages`, { content: "x" })).status, 400);
  assertEquals((await req("s1", "POST", `simulations/${sim.id}/feedback`, { rating: 6 })).status, 400);
  assertEquals((await req("s1", "POST", `simulations/${sim.id}/feedback`, { rating: 4, comment: "  Bien  " })).status, 201);
  assertEquals((await req("s1", "POST", `simulations/${sim.id}/feedback`, { rating: 5 })).status, 409);
  assertEquals(db.tables.crm_sim_feedback[0].comment, "Bien");
  // un beacon sur une simulation déjà terminée ne fait rien
  assertEquals((await req("s1", "POST", `simulations/${sim.id}/end`, { beacon: true })).status, 200);
});

Deno.test("simulateur : terminer sans analyse, et le mode objections n'est jamais analysé", async () => {
  const analyses: any[] = [];
  const { req } = monter({ analyse: {
    demarrer: (p: any) => { analyses.push(p); return Promise.resolve({ analysisId: "rej", skippedAnalysis: true, reason: "Mode non analysé" }); },
    aar: () => Promise.resolve(new Response("{}")),
  } });
  const a = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" })).json();
  const r = await (await req("s1", "POST", `simulations/${a.id}/end`, { skipAnalysis: true })).json();
  assertEquals([r.skippedAnalysis, r.reason, analyses.length], [true, "Analyse non demandée", 0]);
  const o = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "objections" })).json();
  const r2 = await (await req("s1", "POST", `simulations/${o.id}/end`, { skipAnalysis: true })).json();
  assertEquals([r2.analysisId, analyses.length], ["rej", 1], "le refus du mode objections est toujours consigné");
});

Deno.test("simulateur : la fin par beacon porte le jeton dans le corps", async () => {
  const { req } = monter();
  const sim = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "diagnostic" })).json();
  const r = await req("", "POST", `simulations/${sim.id}/end`, { beacon: true, token: "s1" });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).simulation.status, "completed");
});

Deno.test("simulateur : un tour à la voix — nombres en lettres pour la voix, chiffres en base, transcription vide", async () => {
  const { req, db } = monter({ reponse: "Bon... j'ai 9 500 € de côté, pas plus." });
  const sim = await (await req("s1", "POST", "simulations", { personaId: "lnp-claire", simulationMode: "full" })).json();
  const ev = await evenements(await req("s1", "POST", `simulations/${sim.id}/voix`, { content: "Vous avez mis de l'argent de côté ?" }));
  const fin = ev[ev.length - 1];
  assertEquals(fin.prospectMessage.content, "Bon... j'ai 9 500 € de côté, pas plus.");
  assertEquals(fin.spokenText, "Bon... j'ai neuf mille cinq cents euros de côté, pas plus.");
  assertEquals(fin.voiceId, "HuLbOdhRlvQQN8oPP0AJ", "Claire : une voix de femme");
  assertEquals(db.tables.crm_sim_simulations[0].simulation_state.turnCount, 1, "l'état est mis à jour après la réponse");
  const vide = await evenements(await req("s1", "POST", `simulations/${sim.id}/voix`, { content: " … " }));
  assertEquals(vide[vide.length - 1].prospectMessage.content, "Euh... tu disais ?");
});

Deno.test("simulateur : réglages réservés aux administrateurs, voix du navigateur sans clé ElevenLabs", async () => {
  const { req } = monter();
  assertEquals((await req("s1", "PUT", "config", { claude_model: "claude-haiku-5-5" })).status, 403);
  assertEquals((await req("adm", "PUT", "config", { claude_model: "gpt" })).status, 400);
  const c = await (await req("adm", "PUT", "config", { claude_model: "claude-haiku-5-5", daily_analysis_limit: 5 })).json();
  assertEquals([c.claude_model, c.daily_analysis_limit], ["claude-haiku-5-5", 5]);
  const t = await (await req("s1", "POST", "tts", { text: "Bonjour, je vous écoute.", voiceId: "HuLbOdhRlvQQN8oPP0AJ" })).json();
  assertEquals(t.fallback, "speechSynthesis");
  const moi = await (await req("s1", "GET", "moi")).json();
  assertEquals([moi.admin, moi.voixElevenLabs, moi.voix.length], [false, false, 4]);
});

Deno.test("simulateur : outils de la voix", () => {
  assertEquals(nombresEnLettres("3 000 € et 15 %"), "trois mille euros et quinze pourcent");
  assert(transcriptionVide("..."));
  assert(!transcriptionVide("oui"));
  assertEquals(decoupeVoix("Bonjour. Je vous écoute"), 7);
  assertEquals(decoupeVoix("M. Dupont arrive"), -1);
});

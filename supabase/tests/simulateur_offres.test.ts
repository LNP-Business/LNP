// Simulateur · offres et prospects (offres.ts) : création depuis un texte, extraction, prospects rangés (difficulté, voix),
// doublons, droits, régénération, limites des PDF, lecture d'un site, modifications d'un prospect. Aucun appel réseau : le modèle,
// le lecteur de pages et le site sont de faux fetch.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { dbMemoire } from "../functions/_shared/simulateur/base.ts";
import type { Appelant } from "../functions/_shared/simulateur/base.ts";
import {
  adapterOffre, calculerEcarts, difficulteDe, lireSite, nomsProches, normaliserUrl, routesOffres, urlAutorisee,
} from "../functions/_shared/simulateur/offres.ts";
import { EXTRACTION, PERSONA_COMPLET, PERSONA_MATRICE } from "../functions/_shared/simulateur/prompts/prompts.ts";
import { VOIX } from "../functions/_shared/simulateur/voix.ts";

const ADMIN: Appelant = { id: "11111111-1111-4111-8111-111111111111", email: "a@x.fr", role: "admin", admin: true };
const SALES: Appelant = { id: "22222222-2222-4222-8222-222222222222", email: "s@x.fr", role: "sales", admin: false };
const HUGO = VOIX[0].id, JEREMY = VOIX[1].id, CLAIRE = VOIX[2].id, JADE = VOIX[3].id;

const MATRICE = [
  { prenom: "Nadia", gender: "F", difficulte: 2, conscience: 2 }, { prenom: "Marc", gender: "M", difficulte: 4, conscience: 2 },
  { prenom: "Sophie", gender: "F", difficulte: 5, conscience: 2 }, { prenom: "Paul", gender: "M", difficulte: 2, conscience: 3 },
  { prenom: "Léa", gender: "F", difficulte: 4, conscience: 4 }, { prenom: "Hervé", gender: "M", difficulte: 5, conscience: 3 },
].map((p, i) => ({ index: i + 1, age: 30 + i * 3, ville: "Lyon", metier: "Prof", situation_familiale: "Marié", contexte_1_ligne: "Veut des élèves", trauma_passe: null, ...p }));

const MODULES: Record<string, unknown> = {
  "Module 1: IDENTITY": { _meta: { confidence: 90 }, company: { name: "Académie Test" }, founder: { name: "Jean Test", story: "Prof depuis 10 ans" }, domain: "coaching", positioning: "premium" },
  "Module 2: VALUE_PROPOSITION": { _meta: { confidence: 90 }, main_promise: "Des élèves en 4 mois" },
  "Module 3: TARGET_AUDIENCE": { _meta: { confidence: 85 }, ideal_profiles: [{ label: "Profs en poste" }] },
  "Module 4: OFFER_STRUCTURE": { _meta: { confidence: 80 }, format: "online", duration: { total: "4 mois" }, tools_taught: ["Outil A", "Outil B"] },
  "Module 5: PRICING": { _meta: { confidence: 95 }, main_offer: { name: "Starter", price: 3000, price_display: "3 000 €" }, financing_options: [{ name: "4 × 850 €" }] },
};

type Appel = { model: string; system: string; user: string; max_tokens: number; body: Record<string, unknown> };

// Le faux modèle : un JSON prêt selon la consigne reçue
function fauxModele(opts: { echecs?: number; panne?: boolean } = {}) {
  const appels: Appel[] = [];
  let echecs = opts.echecs ?? 0;
  const fetchFn = (url: string, init?: RequestInit): Promise<Response> => {
    if (!url.startsWith("https://api.anthropic.com/")) return Promise.reject(new Error(`réseau interdit : ${url}`));
    const body = JSON.parse(String(init?.body));
    const user = String(body.messages[0].content);
    const system = Array.isArray(body.system) ? body.system.map((b: { text: string }) => b.text).join("") : String(body.system ?? "");
    appels.push({ model: body.model, system, user, max_tokens: body.max_tokens, body });
    if (opts.panne) return Promise.resolve(Response.json({ error: { type: "invalid_request_error", message: "refusé" } }, { status: 400 }));
    let sortie: unknown;
    if (system.includes("MATRICE")) sortie = { personas: MATRICE };
    else if (user.includes("Génère le persona COMPLET")) {
      const prenom = user.match(/- Prénom : (.+)/)![1].trim();
      const item = MATRICE.find((m) => m.prenom === prenom)!;
      sortie = {
        id: prenom.toLowerCase(), offer_id: "", difficulte: item.difficulte,
        identite: { prenom, gender: item.gender, age: item.age, ville: "Lyon", metier: "Prof", situation: "Mariée", ca_actuel: "2000 euros/mois", objectif_ca: "3600 euros/mois" },
        etatsInitiaux: { conscience: item.conscience, confiance: 5, engagement: 5, etat_emotionnel: "NEUTRE" },
        objections: [{ texte: "C'est cher", vraie_raison: "Peur", declencheur: "Prix" }],
        objectionsMode: { prixOffre: "3000 euros", gap: { financier: "CALCULATED", temps: "Du temps", total: "CALCULATED" }, objectionPrix: { surface: "Cher", vraie_objection: "Peur" }, historique: null },
        briefing: { attentes_appel: {}, niveau_conscience: {}, diagnostic: { situation_actuelle: {}, situation_desiree: {}, gap: { actuel: 0, cible: 0, validation_prospect: "Oui" } } },
        messagesInitiaux: { diagnostic: "Ok, ça me va.", objections: "3000 euros... C'est énorme !" },
      };
    } else {
      const cle = Object.keys(MODULES).find((k) => user.includes(k));
      sortie = cle ? MODULES[cle] : { _meta: { confidence: 75 } };
      if (echecs > 0 && cle === "Module 5: PRICING") { echecs--; return Promise.resolve(Response.json({ content: [{ type: "text", text: "{ pas du json" }], usage: {} })); }
    }
    const texte = "```json\n" + JSON.stringify(sortie) + "\n```";
    return Promise.resolve(Response.json({ content: [{ type: "text", text: texte }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn" }));
  };
  return { appels, fetchFn };
}

function monter(seed: Record<string, Record<string, unknown>[]> = {}, modele = fauxModele(), extra: Record<string, unknown> = {}) {
  const db = dbMemoire(seed);
  const taches: Promise<unknown>[] = [];
  const route = routesOffres({
    db, anthropicKey: "sk-test", fetchFn: modele.fetchFn, waitUntil: (p) => { taches.push(p); }, pause: () => Promise.resolve(),
    lirePdf: () => Promise.resolve({ text: "Programme de 4 mois pour les profs, avec un coach et une garantie.", pages: 2 }),
    ...extra,
  });
  const appeler = async (methode: string, chemin: string, corps?: unknown, qui: Appelant = ADMIN) => {
    const req = new Request(`https://x/functions/v1/simulateur/${chemin}`, { method: methode, body: corps === undefined ? undefined : JSON.stringify(corps) });
    return await route(req, chemin.split("/").filter(Boolean), qui);
  };
  const fini = async () => { while (taches.length) await taches.shift(); };
  return { db, appeler, fini, modele };
}

Deno.test("offres : les consignes sont embarquées et neutralisées", () => {
  assertEquals(Object.keys(EXTRACTION).length, 10);
  assertStringIncludes(EXTRACTION["extraction-5-pricing"], "${content}");
  assertStringIncludes(PERSONA_MATRICE.user, "${offerData}");
  assertStringIncludes(PERSONA_COMPLET.user, "${company_name}");
  assert(PERSONA_COMPLET.system.startsWith("Tu es un expert"));
  const tout = JSON.stringify({ EXTRACTION, PERSONA_MATRICE, PERSONA_COMPLET });
  for (const interdit of ["Alegria", "Sarenza", "Lelong", "Cavalie", "Entrepreneurs.com", "Alec Henry", "WeClose", "CGM", "Liberty", "Trustpilot", "Jimmy"]) {
    assert(!tout.toLowerCase().includes(interdit.toLowerCase()), `« ${interdit} » ne doit plus apparaître`);
  }
});

Deno.test("offres : créer depuis un texte → extraction → 6 prospects rangés (difficulté, voix, écarts)", async () => {
  const { db, appeler, fini, modele } = monter();
  const r = (await appeler("POST", "offres", { text: "Notre accompagnement de 4 mois pour les profs." }))!;
  assertEquals(r.status, 202);
  const corps = await r.json();
  assertEquals(corps.isNew, true);
  assertEquals(corps.offer.status, "extracting");
  assertEquals(corps.offer.sources[0].extracted_text, undefined, "le texte des sources n'est pas renvoyé");
  await fini();

  const [o] = await db.select("crm_sim_offers", { id: corps.offer.id });
  assertEquals(o.status, "ready");
  assertEquals(o.error, null);
  assertEquals(o.name, "Académie Test");
  assertEquals(o.price, "3 000 €");
  assertEquals(o.description, "Des élèves en 4 mois");
  assertEquals(o.sector, "coaching");
  assertEquals(o.sources[0].type, "txt");
  assertEquals(o.data.offer_identity, { company_name: "Académie Test", main_promise: "Des élèves en 4 mois", positioning: "premium" });
  assertEquals(o.data.offer_details.main_offer, { price: "3 000 €", duration: "4 mois", financing_options: ["4 × 850 €"] });
  assertEquals(o.data.tools_taught, [{ name: "Outil A" }, { name: "Outil B" }]);
  assertEquals(o.data.extraction_summary.critical_missing, []);
  assertEquals(o.data.pricing.main_offer.price, 3000);

  // 10 modules + 1 matrice + 6 prospects, sans température, Sonnet 5.5, les bons plafonds
  assertEquals(modele.appels.length, 17);
  assert(modele.appels.every((a) => a.model === "claude-sonnet-5-5" && !("temperature" in a.body)));
  assertEquals(modele.appels.filter((a) => a.max_tokens === 4096).length, 10);
  assertEquals(modele.appels.filter((a) => a.max_tokens === 2000).length, 1);
  assertEquals(modele.appels.filter((a) => a.max_tokens === 8000).length, 6);
  const extraction = modele.appels.find((a) => a.user.includes("Module 1: IDENTITY"))!;
  assertStringIncludes(extraction.user, "SOURCE: contenu-colle.txt\n---\nNotre accompagnement de 4 mois pour les profs.");
  assert(!extraction.user.includes("${content}"));
  const persona = modele.appels.find((a) => a.user.includes("- Prénom : Nadia"))!;
  assertStringIncludes(persona.user, "Nom de l'entreprise : Académie Test");
  assertStringIncludes(persona.user, "Fondateur : Jean Test — Prof depuis 10 ans");
  assertStringIncludes(persona.user, "Prix : 3000 euros");
  assertStringIncludes(persona.user, "Options de financement : 4 × 850 €");
  assertStringIncludes(persona.user, "- Outil A");
  assertStringIncludes(modele.appels.find((a) => a.system.includes("MATRICE"))!.user, "Profs en poste");

  const ps = await db.select("crm_sim_personas", { offer_id: o.id }, { order: "position.asc" });
  assertEquals(ps.map((p) => p.id), ["academie-test-nadia", "academie-test-marc", "academie-test-sophie", "academie-test-paul", "academie-test-lea", "academie-test-herve"]);
  assertEquals(ps.map((p) => p.difficulty), ["moyen", "difficile", "expert", "moyen", "difficile", "expert"]);
  assertEquals(ps.map((p) => p.voice_id), [CLAIRE, HUGO, JADE, JEREMY, CLAIRE, HUGO]);
  assertEquals(ps.map((p) => p.consciousness_level), [2, 2, 2, 3, 4, 3]);
  assertEquals(ps.map((p) => p.position), [1, 2, 3, 4, 5, 6]);
  assert(ps.every((p) => p.active === true && p.pcm_type === null && p.first_name && p.age > 0));
  const nadia = ps[0].full_persona_data;
  assertEquals(nadia.briefing.diagnostic.gap.ecart_mensuel, 1600);
  assertEquals(nadia.briefing.diagnostic.gap.cout_annuel_inaction, 19200);
  assertEquals(nadia.objectionsMode.gap.financier, `~${(19200).toLocaleString("fr-FR")} euros/an de manque à gagner`);
});

Deno.test("offres : une réponse illisible du modèle est redemandée (3 essais)", async () => {
  const { db, appeler, fini, modele } = monter({}, fauxModele({ echecs: 2 }));
  const r = (await appeler("POST", "offres", { text: "Texte de l'offre" }))!;
  const { offer } = await r.json();
  await fini();
  assertEquals(modele.appels.filter((a) => a.user.includes("Module 5: PRICING")).length, 3);
  const [o] = await db.select("crm_sim_offers", { id: offer.id });
  assertEquals(o.status, "ready");
  assertEquals(o.data.pricing.main_offer.price, 3000);
});

Deno.test("offres : le modèle en panne → l'offre passe en échec avec l'erreur", async () => {
  const { db, appeler, fini } = monter({}, fauxModele({ panne: true }));
  const { offer } = await (await appeler("POST", "offres", { text: "Texte" }))!.json();
  await fini();
  const [o] = await db.select("crm_sim_offers", { id: offer.id });
  assertEquals(o.status, "failed");
  assertStringIncludes(o.error, "La préparation de l'offre a échoué");
  assertEquals(o.data.extraction_summary.critical_missing.length, 6);
  assertEquals((await db.select("crm_sim_personas")).length, 0);
});

Deno.test("offres : doublons (même texte, nom proche, même adresse) → l'offre existante, sans appel au modèle", async () => {
  const existante = { id: "33333333-3333-4333-8333-333333333333", name: "Accompagnement Les Nouveaux Profs", fingerprint: "url:exemple.fr/offre", archived: false, status: "ready", data: {}, sources: [] };
  const { db, appeler, fini, modele } = monter({ crm_sim_offers: [existante], crm_sim_personas: [{ id: "lnp-nadia", offer_id: existante.id, first_name: "Nadia", difficulty: "moyen", position: 1 }] });

  const parUrl = (await appeler("POST", "offres", { url: "https://www.Exemple.fr/offre/?utm_source=x" }))!;
  assertEquals(parUrl.status, 200);
  const b = await parUrl.json();
  assertEquals([b.isNew, b.offer.id, b.personas], [false, existante.id, [{ id: "lnp-nadia", first_name: "Nadia", difficulty: "moyen" }]]);

  const parNom = await (await appeler("POST", "offres", { name: "Accompagnement les nouveaux prof", text: "autre chose" }))!.json();
  assertEquals(parNom.offer.id, existante.id);

  const r1 = await (await appeler("POST", "offres", { text: "Un texte unique" }))!.json();
  await fini();
  const avant = modele.appels.length;
  const r2 = (await appeler("POST", "offres", { text: "  Un texte unique  " }))!;
  assertEquals(r2.status, 200);
  assertEquals((await r2.json()).offer.id, r1.offer.id);
  assertEquals(modele.appels.length, avant);
  assertEquals((await db.select("crm_sim_offers")).length, 2);
});

Deno.test("offres : réservé aux administrateurs, les autres routes ne sont pas les nôtres", async () => {
  const { appeler } = monter();
  for (const [m, c, b] of [["POST", "offres", { text: "x" }], ["POST", "offres/abc/prospects"], ["POST", "offres/abc/reanalyser"], ["DELETE", "offres/abc"],
    ["PATCH", "personas/abc", { active: false }], ["DELETE", "personas/abc"]] as [string, string, unknown?][]) {
    const r = (await appeler(m, c, b, SALES))!;
    assertEquals(r.status, 403, `${m} ${c}`);
    assertEquals((await r.json()).error, "Accès réservé aux administrateurs");
  }
  assertEquals(await appeler("GET", "offres", undefined, SALES), null);
  assertEquals(await appeler("POST", "simulations", {}), null);
  assertEquals(await appeler("GET", "offres/abc"), null);
});

Deno.test("offres : entrées refusées (rien, adresse interne, nom trop long)", async () => {
  const { appeler } = monter();
  const err = async (corps: unknown) => { const r = (await appeler("POST", "offres", corps))!; return [r.status, (await r.json()).error]; };
  assertEquals(await err({}), [400, "Ajoutez une URL, collez du contenu, ou ajoutez au moins un PDF."]);
  assertEquals((await err({ url: "pas une adresse" }))[0], 400);
  assertEquals(await err({ url: "ftp://exemple.fr/x" }), [400, "Seules les adresses HTTP et HTTPS sont autorisées."]);
  for (const u of ["http://127.0.0.1/", "http://localhost:8080", "http://169.254.169.254/latest", "http://10.1.2.3", "http://192.168.0.1",
    "http://[::1]/", "http://2130706433/", "http://0x7f000001/", "http://intranet.internal/", "http://serveur/"]) {
    assertEquals(await err({ url: u }), [400, "Cette adresse n'est pas accessible."], u);
  }
  assertEquals((await err({ name: "x".repeat(201), text: "y" }))[0], 400);
});

Deno.test("offres : limites des PDF (10 au plus, 20 Mo chacun, des PDF seulement)", async () => {
  const { db, appeler, fini } = monter();
  const petit = { filename: "offre.pdf", base64: btoa("%PDF-1.4 contenu") };
  const r11 = (await appeler("POST", "offres", { pdfs: Array.from({ length: 11 }, () => petit) }))!;
  assertEquals([r11.status, (await r11.json()).error], [400, "Trop de fichiers (10 PDF au plus par envoi)."]);

  const gros = { filename: "gros.pdf", base64: "A".repeat(28_000_000) };   // ≈ 20,0 Mio décodés : juste au-dessus
  const rg = (await appeler("POST", "offres", { pdfs: [gros] }))!;
  assertEquals(rg.status, 400);
  assertStringIncludes((await rg.json()).error, "Fichier ignoré : « gros.pdf » dépasse 20 Mo (taille reçue : 20,0 Mo).");

  const image = { filename: "photo.png", base64: btoa("\x89PNG....") };
  const ri = (await appeler("POST", "offres", { pdfs: [image] }))!;
  assertEquals((await ri.json()).error, "Fichier ignoré : « photo.png » n'est pas un PDF.");

  // un trop gros et un bon : l'offre est créée avec le bon, le refus est rapporté
  const ok = (await appeler("POST", "offres", { name: "Offre PDF", pdfs: [gros, petit] }))!;
  assertEquals(ok.status, 202);
  const b = await ok.json();
  assertEquals(b.fichiers.map((f: { success: boolean }) => f.success), [false, true]);
  await fini();
  const [o] = await db.select("crm_sim_offers", { id: b.offer.id });
  assertEquals(o.name, "Offre PDF", "le nom donné l'emporte sur le nom extrait");
  assertEquals(o.sources.map((s: { type: string; pages: number }) => [s.type, s.pages]), [["pdf", 2]]);
  assertEquals(o.status, "ready");
});

Deno.test("offres : un PDF sans texte est refusé avec le message de lecture", async () => {
  const { appeler } = monter({}, fauxModele(), { lirePdf: () => Promise.resolve({ text: "  \n ", pages: 1 }) });
  const r = (await appeler("POST", "offres", { pdfs: [{ filename: "scan.pdf", base64: btoa("%PDF-1.4") }] }))!;
  assertEquals(r.status, 400);
  assertStringIncludes((await r.json()).error, "Aucun texte exploitable");
});

Deno.test("offres : régénérer efface puis recrée les prospects, avec leurs voix ; pas pendant une préparation", async () => {
  const { db, appeler, fini } = monter();
  const { offer } = await (await appeler("POST", "offres", { text: "Texte" }))!.json();
  await fini();
  await db.update("crm_sim_personas", { id: "academie-test-nadia" }, { voice_id: JADE, difficulty: "expert" });
  const r = (await appeler("POST", `offres/${offer.id}/prospects`))!;
  assertEquals(r.status, 202);
  assertEquals((await r.json()).offer.status, "generating");
  assertEquals((await db.select("crm_sim_personas", { offer_id: offer.id })).length, 0, "effacés tout de suite");
  const encore = (await appeler("POST", `offres/${offer.id}/prospects`))!;
  assertEquals(encore.status, 409);
  await fini();
  const ps = await db.select("crm_sim_personas", { offer_id: offer.id }, { order: "position.asc" });
  assertEquals(ps.length, 6);
  assertEquals(ps[0].id, "academie-test-nadia");
  assertEquals(ps.map((p) => p.voice_id), [CLAIRE, HUGO, JADE, JEREMY, CLAIRE, HUGO]);
  assertEquals(ps[0].difficulty, "moyen");
  assertEquals((await db.select("crm_sim_offers", { id: offer.id }))[0].status, "ready");
  assertEquals((await appeler("POST", "offres/44444444-4444-4444-8444-444444444444/prospects"))!.status, 404);
});

Deno.test("offres : ré-analyser relit les sources sans toucher aux prospects ni au prix ; refusé sans source", async () => {
  const sansSource = { id: "55555555-5555-4555-8555-555555555555", name: "LNP", price: "3 000 €", status: "ready", archived: false, data: {}, sources: [{ type: "txt", filename: "x" }] };
  const { db, appeler, fini } = monter({ crm_sim_offers: [sansSource] });
  const r = (await appeler("POST", `offres/${sansSource.id}/reanalyser`))!;
  assertEquals([r.status, (await r.json()).error], [400, "Aucune source exploitable pour ré-analyser cette offre. Ajoutez au moins un PDF avec du texte."]);

  const { offer } = await (await appeler("POST", "offres", { name: "Autre offre", text: "Texte" }))!.json();
  await fini();
  await db.update("crm_sim_offers", { id: offer.id }, { price: "2 500 €" });
  const r2 = (await appeler("POST", `offres/${offer.id}/reanalyser`))!;
  assertEquals(r2.status, 202);
  await fini();
  const [o] = await db.select("crm_sim_offers", { id: offer.id });
  assertEquals([o.status, o.name, o.price], ["ready", "Autre offre", "2 500 €"]);
  assertEquals(o.data.offer_identity.company_name, "Académie Test");
  assertEquals((await db.select("crm_sim_personas", { offer_id: offer.id })).length, 6);
});

Deno.test("offres : modifier et supprimer un prospect, supprimer une offre", async () => {
  const off = { id: "66666666-6666-4666-8666-666666666666", name: "O", status: "ready", archived: false, data: {}, sources: [] };
  const { db, appeler } = monter({ crm_sim_offers: [off], crm_sim_personas: [
    { id: "o-nadia", offer_id: off.id, first_name: "Nadia", difficulty: "moyen", active: true, voice_id: CLAIRE },
    { id: "o-marc", offer_id: off.id, first_name: "Marc", difficulty: "expert", active: true, voice_id: HUGO }] });
  const patch = async (b: unknown) => { const r = (await appeler("PATCH", "personas/o-nadia", b))!; return [r.status, await r.json()]; };
  assertEquals(await patch({ voice_id: "inconnue" }), [400, { error: "Voix inconnue." }]);
  assertEquals((await patch({ difficulty: "facile" }))[0], 400);
  assertEquals((await patch({ active: "non" }))[0], 400);
  assertEquals(await patch({}), [400, { error: "Rien à modifier." }]);
  const [st, row] = await patch({ active: false, voice_id: JADE, difficulty: "difficile" });
  assertEquals([st, row.active, row.voice_id, row.difficulty], [200, false, JADE, "difficile"]);
  assertEquals((await appeler("PATCH", "personas/absent", { active: true }))!.status, 404);
  assertEquals((await appeler("DELETE", "personas/o-nadia"))!.status, 200);
  assertEquals((await db.select("crm_sim_personas")).map((p) => p.id), ["o-marc"]);
  const r = (await appeler("DELETE", `offres/${off.id}`))!;
  assertEquals((await r.json()).message, "Offre supprimée définitivement");
  assertEquals([(await db.select("crm_sim_offers")).length, (await db.select("crm_sim_personas")).length], [0, 0]);
});

Deno.test("offres : lecture d'un site (lecteur de pages pour l'accueil, pages du même domaine filtrées)", async () => {
  const vus: string[] = [];
  const page = (titre: string, liens: string[]) => `<html><head><title>${titre}</title><script>x()</script></head><body><nav>menu</nav><main><h1>${titre}</h1>` +
    `<p>${"Un texte assez long pour être gardé, sur l'accompagnement des profs. ".repeat(3)}</p>${liens.map((l) => `<a href="${l}">l</a>`).join("")}</main></body></html>`;
  const site: Record<string, string> = {
    "https://exemple.fr": page("Accueil", ["/programme", "/tarifs?utm_source=pub", "https://ailleurs.fr/x", "/cgv", "/brochure.pdf", "mailto:a@b.fr", "/programme#haut"]),
    "https://exemple.fr/programme": page("Programme", ["/tarifs"]),
    "https://exemple.fr/tarifs": page("Tarifs", []),
  };
  const fetchFn = (url: string): Promise<Response> => {
    vus.push(url);
    if (url.startsWith("https://r.jina.ai/")) return Promise.resolve(new Response("# Accueil (lecteur)\n\n" + "Texte propre de la page d'accueil. ".repeat(5)));
    const h = site[url];
    return Promise.resolve(h ? new Response(h, { headers: { "content-type": "text/html" } }) : new Response("absent", { status: 404 }));
  };
  const s = await lireSite("https://exemple.fr/", fetchFn, () => Promise.resolve());
  assertEquals(s.pagesCount, 3);
  assertStringIncludes(s.rawContent, "## Accueil (lecteur)\nURL: https://exemple.fr\n\n# Accueil (lecteur)");
  assertStringIncludes(s.rawContent, "## Programme\nURL: https://exemple.fr/programme\n\nTitle: Programme\nH1: Programme\n\nProgramme Un texte assez long");
  assert(!s.rawContent.includes("menu") && !s.rawContent.includes("x()"));
  assert(!vus.some((u) => u.includes("ailleurs.fr") || u.includes("cgv") || u.endsWith(".pdf")));
  assertEquals(vus.filter((u) => u === "https://exemple.fr/tarifs").length, 1, "une page n'est lue qu'une fois");
});

Deno.test("offres : outils (adresses, noms, difficulté, adaptateur, écarts)", () => {
  assertEquals(normaliserUrl("https://www.Exemple.fr/Offre/?a=1#x"), "exemple.fr/offre");
  assert(nomsProches("Accompagnement LNP", "accompagnement lnp "));
  assert(!nomsProches("Accompagnement LNP", "Formation vente"));
  assertEquals([2, 3, 4, 5, "2", "4", "moyen", null, "?"].map(difficulteDe), ["moyen", "moyen", "difficile", "expert", "moyen", "difficile", "moyen", null, null]);
  assert(urlAutorisee("https://exemple.fr/a").ok);
  assert(!urlAutorisee("https://user:pw@exemple.fr/").ok);
  assertEquals(adapterOffre({}, "Nom", "1 200 €"), { offer_identity: { company_name: "Nom", main_promise: null, positioning: null },
    offer_details: { main_offer: { price: "1 200 €", duration: null, financing_options: [] } }, tools_taught: [] });
  assertEquals(adapterOffre({ pricing: { main_offer: { price: 22224 } }, offer_structure: { duration: "15 mois", tools_taught: [{ name: "X" }] } }, "N", null).offer_details,
    { main_offer: { price: `${new Intl.NumberFormat("fr-FR").format(22224)} €`, duration: "15 mois", financing_options: [] } });
  const p = calculerEcarts({ identite: { ca_actuel: "3000", objectif_ca: "2000" }, briefing: { diagnostic: { gap: { actuel: 1 } } } });
  assertEquals(p.briefing.diagnostic.gap.actuel, 1, "objectif plus bas : rien de calculé");
});

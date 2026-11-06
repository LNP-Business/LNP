// Entraînement › Maîtrise de l'offre (2026-11-06): the prompt built on the server (cahier §4.3), the marks brought back within
// the grid (§4.4), and POST /api/academie: who may ask, the limit, the result kept on the account as a mark by Claude.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BY_ID, CONTENT, buildPrompt, hasAnswer, normalize, parseModel } from "../api/_academie.js";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://fake.supabase.co";
const { default: handler } = await import("../api/academie.js");

const A1 = BY_ID.A1, B1 = Object.values(BY_ID).find(c => c.fmt === "B");

test("the 100 cases, formats A and B", () => {
  assert.equal(CONTENT.cas.length, 100);
  assert.ok(A1 && A1.fmt === "A" && B1);
});

test("the prompt holds the grid, the corrigé and the answer, never more", () => {
  const p = buildPrompt(A1, "Ma réponse sur la garantie, assez longue pour compter.", "");
  assert.match(p, /Ma réponse sur la garantie/);
  A1.attendus.forEach((a, k) => assert.ok(p.includes(`${k + 1}. (${a[0]} pt`), "criterion " + (k + 1)));
  const pb = buildPrompt(B1, "Ce qui ne va pas.", "Ce qu'il fallait dire.");
  assert.match(pb, /L1/);
  assert.match(pb, /Ce qu'il fallait dire/);
});

test("marks: half points, at most each criterion's max, 0 when éliminatoire (format A only)", () => {
  const max = A1.attendus.map(a => a[0]);
  const n = normalize(A1, { criteres: max.map((m, k) => ({ index: k + 1, points: m + 3.3, commentaire: "x".repeat(900) })), eliminatoire: { declenche: false } });
  n.criteres.forEach((c, k) => assert.equal(c.points, max[k]));
  assert.equal(n.criteres[0].commentaire.length, 500);
  assert.ok(n.score <= 10);
  assert.equal(normalize(A1, { criteres: [{ index: 1, points: 1.26 }] }).criteres[0].points, 1.5);
  assert.equal(normalize(A1, { criteres: [{ index: 1, points: 2 }], eliminatoire: { declenche: true, raison: "« quoi qu'il arrive »" } }).score, 0);
  assert.equal(normalize(B1, { criteres: [{ index: 1, points: 1 }], eliminatoire: { declenche: true } }).eliminatoire.declenche, false);
  assert.equal(normalize(A1, {}), null);
  assert.deepEqual(parseModel('Voici : {"criteres": [{"index": 1, "points": 2}]} fin'), { criteres: [{ index: 1, points: 2 }] });
  assert.equal(hasAnswer("court", ""), false);
  assert.equal(hasAnswer("", "une réponse de plus de vingt caractères"), true);
});

// a Supabase client in memory: auth, members, the corrections log, the results
function fakeSb({ role = "member", screens } = {}) {
  const rows = { crm_academy_corrections: [], crm_training_results: [] };
  const sb = {
    rows,
    auth: {
      getUser: async (t) => t === "bon" ? { data: { user: { id: "u1", email: "a@x.com" } } } : { error: { message: "bad" } },
      admin: { getUserById: async () => ({ data: { user: { id: "u1", app_metadata: screens ? { screens } : {} } } }) }
    },
    from(table) {
      const q = {
        select: () => q, eq: () => q, gte: () => q,
        maybeSingle: async () => ({ data: table === "members" ? { role } : null }),
        insert: async (r) => { rows[table].push(r); return { error: null }; },
        then: (ok) => Promise.resolve({ count: rows.crm_academy_corrections.length }).then(ok)
      };
      return q;
    }
  };
  return sb;
}
function call(sb, body, fetchImpl, token = "bon") {
  return new Promise((resolve) => {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler({ method: "POST", headers: { authorization: "Bearer " + token }, body }, res, { sb, fetch: fetchImpl });
  });
}
const model = (obj) => async () => ({ ok: true, status: 200, json: async () => ({ text: JSON.stringify(obj), usage: { input_tokens: 10 } }) });
const ANSWER = "Le seuil, c'est le montant que tu as investi, pas un chiffre fixe.";

test("POST /api/academie: 401, 403, 400, then a correction kept on the account as a mark by Claude", async () => {
  assert.equal((await call(fakeSb(), { id: "A1", answer: ANSWER }, model({}), "faux")).status, 401);
  const r403 = await call(fakeSb({ screens: ["crm", "v2026-11-06"] }), { id: "A1", answer: ANSWER }, model({}));
  assert.equal(r403.status, 403); assert.match(r403.body.error, /Paramètres › Accès/);
  assert.equal((await call(fakeSb(), { id: "Z9", answer: ANSWER }, model({}))).status, 400);
  assert.equal((await call(fakeSb(), { id: "A1", answer: "court" }, model({}))).status, 400);
  const sb = fakeSb();
  const crit = A1.attendus.map((a, k) => ({ index: k + 1, points: a[0], commentaire: "ok" }));
  const r = await call(sb, { id: "A1", answer: ANSWER, cid: "abcd-1234-efgh", duration_s: 95.4 }, model({ criteres: crit, eliminatoire: { declenche: false } }));
  assert.equal(r.status, 200); assert.equal(r.body.feedback.score, 10);
  assert.equal(sb.rows.crm_academy_corrections.length, 1);
  assert.ok(!JSON.stringify(sb.rows.crm_academy_corrections).includes("seuil"), "the corrections log never holds the answer");
  const kept = sb.rows.crm_training_results[0];
  assert.deepEqual([kept.user_id, kept.cid, kept.module, kept.case_id, kept.score, kept.max, kept.mode, kept.duration_s], ["u1", "abcd-1234-efgh", "academie", "A1", 10, 10, "claude", 95]);
  assert.equal(kept.details.reponse, ANSWER);
});

test("POST /api/academie: a bad id from the page is replaced, the time is bounded, 7 corrections a minute → 429", async () => {
  const sb = fakeSb();
  const crit = [{ index: 1, points: 1 }];
  await call(sb, { id: "A1", answer: ANSWER, cid: "x'; drop", duration_s: 99999 }, model({ criteres: crit }));
  const k = sb.rows.crm_training_results[0];
  assert.match(k.cid, /^srv-/); assert.equal(k.duration_s, 3600);
  for (let i = 0; i < 5; i++) assert.equal((await call(sb, { id: "A1", answer: ANSWER }, model({ criteres: crit }))).status, 200);
  const r = await call(sb, { id: "A1", answer: ANSWER }, model({ criteres: crit }));
  assert.equal(r.status, 429); assert.match(r.body.error, /réessaie dans une minute/);
});

test("POST /api/academie: the gateway fails or answers nonsense → 502, nothing kept", async () => {
  const sb = fakeSb();
  const r = await call(sb, { id: "A1", answer: ANSWER }, async () => ({ ok: false, status: 500, json: async () => ({}) }));
  assert.equal(r.status, 502);
  const r2 = await call(sb, { id: "A1", answer: ANSWER }, async () => ({ ok: true, status: 200, json: async () => ({ text: "pas du JSON" }) }));
  assert.equal(r2.status, 502);
  assert.equal(sb.rows.crm_training_results.length, 0);
});

// node skl-os/crm/data.test.js — demo and live behaviour of data.js, without a browser
const fs = require("fs"), vm = require("vm"), assert = require("assert");
const src = fs.readFileSync(require("path").join(__dirname, "data.js"), "utf8");
async function load(claude) { const w = { claude }; vm.runInNewContext(src, { window: w, Promise, Date, JSON, Object, console }); await w.SKL_CRM.ready(); return w.SKL_CRM; }
(async () => {
  // plain file: demo
  let C = await load(undefined);
  assert.equal(C.mode(), "demo");
  assert.equal((await C.listCycles()).length, 2);
  assert.equal((await C.listCycles({ status: "won" })).length, 0);
  assert.deepEqual(await C.declareOutcome("demo-call1", { attendance: "no_show" }), { demo: true });
  assert.deepEqual(await C.listBoard(), [], "demo board is empty");
  assert.deepEqual(await C.listNoBooking(), [], "demo: no people without booking");
  // Artifact runtime (claude.use without web flag): demo, use("crm") never asked
  let asked = false;
  C = await load({ use: (n) => { asked = true; return Promise.resolve({}); } });
  assert.equal(C.mode(), "demo"); assert.equal(asked, false);
  // web edition: live, writes go to the RPC with the right names
  const calls = [];
  const api = { rpc: async (fn, a) => { calls.push([fn, a]); return "id1"; }, me: async () => ({ member_key: "sales" }), subscribe: () => () => {} };
  C = await load({ web: true, use: (n) => Promise.resolve(n === "crm" ? api : null) });
  assert.equal(C.mode(), "live");
  assert.equal(await C.declareOutcome("call-1", { attendance: "held", decision: "yes" }), "id1");
  await C.addNote("cy-1", "hello");
  assert.deepEqual(calls[0], ["crm_declare_outcome", { p_call: "call-1", p: { attendance: "held", decision: "yes" } }]);
  assert.deepEqual(calls[1], ["crm_add_note", { p_cycle: "cy-1", p_text: "hello" }]);
  assert.equal((await C.me()).member_key, "sales");
  // the board reads every row past the 1000-row page, and long id lists by 100
  const reqs = [];
  const table = (name) => {
    const st = { name, from: 0, to: 0, ids: null };
    const q = { select: () => q, order: () => q, in: (_c, ids) => { st.ids = ids; return q; }, range: (a, b) => { st.from = a; st.to = b; return q; },
      then: (ok) => { reqs.push({ ...st }); const n = name === "crm_cycles" ? 2500 : name === "crm_people_without_cycle" ? 1200 : (st.ids || []).length;
        const len = Math.max(0, Math.min(st.to + 1, n) - st.from);
        ok({ data: Array.from({ length: len }, (_, i) => ({ id: name + (st.from + i), cycle_id: st.ids ? st.ids[(st.from + i) % st.ids.length] : null })) }); } };
    return q;
  };
  C = await load({ web: true, use: () => Promise.resolve({ ...api, from: table }) });
  const board = await C.listBoard();
  assert.equal(board.length, 2500, "every cycle");
  assert.ok(reqs.filter((r) => r.name === "crm_calls").every((r) => r.ids.length <= 100), "ids by 100");
  assert.equal(board.filter((c) => c.calls.length === 1).length, 2500, "each cycle gets its rows");
  assert.equal((await C.listNoBooking()).length, 1200);
  // Sales cycle view model (docs/crm/16 §3)
  const T0 = Date.parse("2026-10-20T10:00:00Z"), h = (n) => new Date(T0 + n * 3600e3).toISOString(), NOW = T0 + 100 * 3600e3;
  const sc = C.salesCycleView([
    { id: "c1", opened_at: h(0), owner_id: "u1", person: { full_name: "Ann" }, next_move: { code: "rebook" },
      calls: [{ id: "k1", rank: 1, status: "held", scheduled_start: h(10), scheduled_end: h(10.75) }, { id: "k2", rank: 2, status: "canceled", scheduled_start: h(50) },
              { id: "k3", rank: 3, status: "scheduled", scheduled_start: h(90), scheduled_end: h(91) }, { id: "k4", rank: 4, status: "scheduled", scheduled_start: h(120), scheduled_end: h(121) }],
      events: [{ type: "call_booked", occurred_at: h(0), call_id: "k1", data: { event_name: "Roadmap" } }, { type: "call_canceled", occurred_at: h(40), call_id: "k2", data: {} },
               { type: "outcome_held", occurred_at: h(11), call_id: "k1" }, { type: "note", occurred_at: h(20), content: "hi" }] },
    { id: "c2", opened_at: h(0), owner_id: null, close_reason: "dq_off_target", person: { primary_email: "x@y.z" }, calls: [],
      events: [{ type: "cycle_disqualified", occurred_at: h(5), source: "import", data: { reason: "dq_off_target" } }] },
    { id: "c3", opened_at: h(0), calls: [], events: [{ type: "cycle_won", occurred_at: h(30), source: "import", data: {} }] }
  ], [{ id: "u1", member_key: "romain" }], NOW);
  assert.equal(sc[0].o, "romain"); assert.equal(sc[1].o, "none"); assert.equal(Math.round(sc[0].age), 100);
  assert.deepEqual(sc[0].ev.map((e) => e.k), ["booked", "meet", "note", "note", "meetdue", "meet"], "booked, held, note, canceled, passed with no outcome, ahead");
  assert.equal(sc[0].ev[1].dur, 45); assert.equal(sc[0].ev[5].t, 120);
  assert.equal(sc[0].nx.txt, "Rebook the call");
  assert.equal(sc[1].ev[0].no, 1); assert.ok(sc[1].ev[0].txt.includes("Not the target")); assert.equal(sc[1].p, "x@y.z");
  assert.deepEqual(sc[2].ev.map((e) => e.k), ["decision", "paid"], "an imported win closes the cycle as won");
  // phase 3: declared outcomes become decision lines, the latest one gives the next step; calls carry their id
  const sc3 = C.salesCycleView([{ id: "c9", opened_at: h(0), owner_id: "u1", person: { full_name: "Out" },
    calls: [{ id: "k9", rank: 1, status: "held", scheduled_start: h(10), scheduled_end: h(10.75) }],
    events: [{ type: "outcome_held", source: "crm", occurred_at: h(11), call_id: "k9" },
             { type: "outcome_follow_up", source: "crm", occurred_at: h(11), call_id: "k9", data: { next_step: "Send the case study" } }] }], [], NOW);
  assert.equal(sc3[0].ev.find((e) => e.k === "meet").cid, "k9");
  assert.ok(sc3[0].ev.some((e) => e.k === "decision" && e.fu && /next step: Send the case study/.test(e.txt)));
  assert.deepEqual(sc3[0].nx, { txt: "Send the case study", src: "from the R1 outcome" });
  const sc4 = C.salesCycleView([{ id: "c8", opened_at: h(0), calls: [{ id: "k8", rank: 2, status: "held", scheduled_start: h(10), scheduled_end: h(11) }],
    events: [{ type: "outcome_no", source: "crm", occurred_at: h(12), call_id: "k8", data: { reason_code: "price", nurture: "standard" } }] }], [], NOW);
  assert.ok(sc4[0].ev.some((e) => e.k === "decision" && e.no && /reason: Price · nurture/.test(e.txt)));
  // 030: an R2 with no Fathom recording is not a no-show: a note on the lane and "Plan a reschedule"
  const sc5 = C.salesCycleView([{ id: "c7", opened_at: h(0), next_move: { code: "rebook", missed: 2 },
    calls: [{ id: "k71", rank: 1, status: "held", scheduled_start: h(10), scheduled_end: h(11) },
            { id: "k72", rank: 2, status: "missed", scheduled_start: h(30), scheduled_end: h(31) }], events: [] }], [], NOW);
  assert.ok(!sc5[0].ev.some((e) => e.k === "noshow" || e.k === "meetdue"));
  assert.ok(sc5[0].ev.some((e) => e.k === "note" && e.r === 2 && /plan a reschedule/.test(e.txt)));
  assert.deepEqual(sc5[0].nx, { txt: "Plan a reschedule", src: "R2 not held" });
  // web edition where the crm interface is missing: demo
  C = await load({ web: true, use: () => Promise.reject(new Error("x")) });
  assert.equal(C.mode(), "demo");
  console.log("data.js: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });

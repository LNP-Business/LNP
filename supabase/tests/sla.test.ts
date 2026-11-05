// deno test --allow-env --allow-read supabase/tests
// Sales cycle SLAs v3 (docs/crm/18): the rules shared with the screen, the model of a cycle, and what sla-tick posts.
import "../functions/_shared/sla_rules.js";
import { slackText, toLead, type Snap } from "../functions/_shared/sla_view.ts";
import { tick } from "../functions/sla-tick/index.ts";

// deno-lint-ignore no-explicit-any
const SLA = (globalThis as any).SKL_SLA;
function eq<T>(a: T, b: T, msg = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
// the nine SLAs of the first version, one at a time; the others have their own tests below (only = the SLAs looked at)
const V1 = ["SH-2", "SH-6", "SH-8", "SH-11", "DE-1", "DE-7", "DE-9", "CA-2", "CO-1"];
const ids = (l: unknown, o?: unknown, only: string[] = V1) => SLA.evaluate(l, o).filter((b: { id: string }) => only.includes(b.id))
  .map((b: { id: string; level: string; open: boolean }) => `${b.id}:${b.level}:${b.open ? "open" : "done"}`);

Deno.test("SH-2: the first personal message within 5 min; late after 15, critical after 60", () => {
  eq(ids({ age: 2, ev: [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.05, w: "s", k: "im" }] }), [], "3 min:");
  eq(ids({ age: 2, ev: [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.1, w: "a", k: "remind" }, { t: 0.5, w: "s", k: "im" }] }), ["SH-2:late:done"], "the automatic one does not count:");
  eq(ids({ age: 0.06, ev: [{ t: 0, w: "p", k: "booked", r: 1 }] }), ["SH-2:warn:open"]);
  eq(ids({ age: 1.5, ev: [{ t: 0, w: "p", k: "booked", r: 1 }] }), ["SH-2:crit:open"]);
});

Deno.test("CO-1: reply within 15 min; a burst counts once; a held call answers; the night waits for 08:00", () => {
  const ev = [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.02, w: "s", k: "im" }, { t: 10, w: "p", k: "im" }, { t: 10.1, w: "p", k: "im" }];
  eq(ids({ age: 11.5, ev }), ["CO-1:late:open"]);
  eq(ids({ age: 15, ev }), ["CO-1:crit:open"]);
  eq(ids({ age: 15, ev: ev.concat([{ t: 10.2, w: "s", k: "im" }]) }), [], "answered within 15 min:");
  // written at 23:00 New York (03:00 UTC): the clock starts at 08:00, so at 08:30 it is only late, not critical
  const t0 = Date.parse("2026-10-29T03:00:00Z");
  eq(ids({ age: 9.5, ev: [{ t: 0, w: "p", k: "im" }] }, { t0 }), ["CO-1:warn:open"]);
});

Deno.test("calls: SH-11 outcome, DE-1 recap, SH-6 and SH-8 after a no-show", () => {
  eq(ids({ age: 3, ev: [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.02, w: "s", k: "im" }, { t: 1, w: "s", k: "meetdue", r: 1, dur: 45 }] }), ["SH-11:late:open"]);
  eq(ids({ age: 5, ev: [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.02, w: "s", k: "im" }, { t: 1, w: "s", k: "meet", r: 1, dur: 45 },
    { t: 1.8, w: "s", k: "decision", fu: 1, r: 1 }] }), ["DE-1:late:open"], "held, outcome in 3 min, no recap:");
  eq(ids({ age: 3, ev: [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.02, w: "s", k: "im" }, { t: 1, w: "p", k: "noshow", r: 1 }] }), ["SH-6:late:open", "SH-8:late:open"]);
});

Deno.test("stages: DE-9 decision within 72 h, CA-2 first payment within 24 h, DE-7 follow-up; a closed lead stops the clocks", () => {
  // deno-lint-ignore no-explicit-any
  const held: any[] = [{ t: 0, w: "p", k: "booked", r: 1 }, { t: 0.02, w: "s", k: "im" }, { t: 1, w: "s", k: "meet", r: 1, dur: 45 },
    { t: 1.8, w: "s", k: "decision", fu: 1, r: 1 }, { t: 2, w: "s", k: "im" }];
  eq(ids({ age: 80, ev: held }), ["DE-9:late:open", "DE-7:late:open"]);
  eq(ids({ age: 200, ev: held.concat([{ t: 100, w: "s", k: "decision", no: 1 }]) }), ["DE-9:late:done"], "lost at 100 h, DE-7 no longer runs:");
  eq(ids({ age: 30, ev: held.concat([{ t: 3, w: "s", k: "decision", yes: 1, r: 2 }]) }), ["CA-2:late:open"]);
  eq(SLA.worst(SLA.evaluate({ age: 60, ev: held.concat([{ t: 3, w: "s", k: "decision", yes: 1, r: 2 }]) })), "crit");
});

Deno.test("Présence: SH-1 automatic confirmation, SH-3 time to the R1, SH-4 exchange before the call, SH-9 new slot after a no-show", () => {
  const bk = { t: 0, w: "p", k: "booked", r: 1 };
  eq(ids({ age: 1, ev: [bk] }, undefined, ["SH-1"]), ["SH-1:crit:open"], "no confirmation after 1 h:");
  eq(ids({ age: 1, ev: [bk, { t: 0.01, w: "a", k: "remind" }] }, undefined, ["SH-1"]), [], "sent within a minute:");
  eq(ids({ age: 1, ev: [bk, { t: 80, w: "s", k: "meet", r: 1 }] }, undefined, ["SH-3"]), ["SH-3:late:open"], "an R1 80 h after the booking:");
  eq(ids({ age: 1, ev: [bk, { t: 30, w: "s", k: "meet", r: 1 }] }, undefined, ["SH-3"]), [], "within 48 h:");
  // SH-4: thresholds before the R1 (12 h: preventive, 3 h: missed); a sales message then a prospect reply stop it
  const r1 = { t: 40, w: "s", k: "meet", r: 1 };
  eq(ids({ age: 20, ev: [bk, r1] }, undefined, ["SH-4"]), [], "28 h before:");
  eq(ids({ age: 30, ev: [bk, r1] }, undefined, ["SH-4"]), ["SH-4:warn:open"], "10 h before:");
  eq(ids({ age: 38, ev: [bk, r1] }, undefined, ["SH-4"]), ["SH-4:late:open"], "2 h before:");
  eq(ids({ age: 38, ev: [bk, { t: 1, w: "s", k: "im" }, { t: 2, w: "p", k: "im" }, r1] }, undefined, ["SH-4"]), [], "they replied:");
  eq(ids({ age: 38, ev: [bk, { t: 1, w: "p", k: "im" }, { t: 2, w: "s", k: "im" }, r1] }, undefined, ["SH-4"]), ["SH-4:late:open"], "no reply after the sales message:");
  // SH-9: rebooked within 24 h; the 2nd no-show is critical at once
  const ns = { t: 5, w: "p", k: "noshow", r: 1 };
  eq(ids({ age: 20, ev: [bk, ns] }, undefined, ["SH-9"]), ["SH-9:warn:open"]);
  eq(ids({ age: 40, ev: [bk, ns] }, undefined, ["SH-9"]), ["SH-9:late:open"]);
  eq(ids({ age: 40, ev: [bk, ns, { t: 8, w: "p", k: "booked", r: 2 }, { t: 30, w: "p", k: "noshow", r: 2 }] }, undefined, ["SH-9"]), ["SH-9:crit:open"], "2nd no-show:");
  eq(ids({ age: 40, ev: [bk, ns, { t: 8, w: "p", k: "booked", r: 2 }, { t: 60, w: "s", k: "meet", r: 2 }] }, undefined, ["SH-9"]), [], "rebooked in 3 h:");
});

Deno.test("Décision: DE-4 next call booked, DE-5 time between calls, DE-8 calls with no decision, DE-2 / DO-2 analysis and recording", () => {
  const bk = { t: 0, w: "p", k: "booked", r: 1 }, m1 = { t: 1, w: "s", k: "meet", r: 1, dur: 45, rec: 1.9, ana: 2 };
  const fu = { t: 2, w: "s", k: "decision", fu: 1, r: 1 };
  eq(ids({ age: 16, ev: [bk, m1, fu] }, undefined, ["DE-4"]), ["DE-4:warn:open"]);
  eq(ids({ age: 60, ev: [bk, m1, fu] }, undefined, ["DE-4"]), ["DE-4:crit:open"]);
  eq(ids({ age: 60, ev: [bk, m1, fu, { t: 3, w: "p", k: "booked", r: 2 }, { t: 70, w: "s", k: "meet", r: 2 }] }, undefined, ["DE-4"]), [], "R2 booked 1 h later:");
  eq(ids({ age: 140, ev: [bk, m1, fu] }, undefined, ["DE-5"]), [], "no next call: DE-4 and DE-9 say it:");
  eq(ids({ age: 140, ev: [bk, m1, fu, { t: 200, w: "s", k: "meet", r: 2 }] }, undefined, ["DE-5"]), ["DE-5:late:open"], "the R2 is 8 days later:");
  eq(ids({ age: 300, ev: [bk, m1, fu, { t: 200, w: "s", k: "meet", r: 2, dur: 45 }] }, undefined, ["DE-5"]), ["DE-5:crit:done"], "held 8 days later:");
  eq(ids({ age: 300, ev: [bk, m1, fu, { t: 40, w: "s", k: "meet", r: 2, dur: 45 }] }, undefined, ["DE-5"]), [], "R2 after 39 h:");
  eq(ids({ age: 60, ev: [bk, m1, fu, { t: 40, w: "s", k: "meet", r: 2 }] }, undefined, ["DE-8"]), ["DE-8:warn:open"], "2 calls held:");
  eq(ids({ age: 60, ev: [bk, m1, fu, { t: 40, w: "s", k: "meet", r: 2 }, { t: 90, w: "s", k: "meet", r: 3 }] }, undefined, ["DE-8"]), ["DE-8:late:open"], "a 3rd planned:");
  eq(ids({ age: 60, ev: [bk, m1, fu, { t: 40, w: "s", k: "meet", r: 2 }, { t: 41, w: "s", k: "decision", yes: 1 }] }, undefined, ["DE-8"]), [], "a yes:");
  eq(ids({ age: 30, rec: true, ev: [bk, Object.assign({}, m1, { rec: undefined, ana: undefined })] }, undefined, ["DO-2", "DE-2"]), ["DO-2:crit:open"], "no recording after 28 h:");
  eq(ids({ age: 30, ev: [bk, Object.assign({}, m1, { rec: undefined, ana: undefined })] }, undefined, ["DO-2", "DE-2"]), [], "a model without recordings (sample leads):");
  eq(ids({ age: 30, rec: true, ev: [bk, Object.assign({}, m1, { ana: undefined })] }, undefined, ["DO-2", "DE-2"]), ["DE-2:crit:open"], "recorded, never analysed:");
  eq(ids({ age: 30, rec: true, ev: [bk, m1] }, undefined, ["DO-2", "DE-2"]), [], "recorded and analysed:");
  // a tech or indicator SLA never sets the lead's level
  eq(SLA.worst(SLA.evaluate({ age: 30, rec: true, ev: [bk, Object.assign({}, m1, { rec: undefined })] }).filter((b: { id: string }) => b.id === "DO-2")), "ok");
});

Deno.test("Encaissement, conversation, closing: CA-1, CA-5, CL-1, CL-3, CO-4, CO-5", () => {
  const y = { t: 1, w: "s", k: "decision", yes: 1, r: 1 };
  eq(ids({ age: 2, ev: [y] }, undefined, ["CA-1"]), ["CA-1:late:open"], "no link 1 h after the yes:");
  eq(ids({ age: 2, ev: [y, { t: 1.05, w: "s", k: "paylink" }] }, undefined, ["CA-1"]), []);
  eq(ids({ age: 200, ev: [y] }, undefined, ["CA-5"]), ["CA-5:warn:open"], "unpaid for 8 days:");
  eq(ids({ age: 400, ev: [y] }, undefined, ["CA-5"]), ["CA-5:crit:open"], "unpaid for 16 days:");
  // CL-1: 4 attempts on 4 days since the last reply, 28 days ago
  const tries = [24, 48, 72, 96].map((t) => ({ t, w: "s", k: "im" }));
  eq(ids({ age: 680, ev: [{ t: 0, w: "p", k: "im" }].concat(tries) }, undefined, ["CL-1"]), ["CL-1:warn:open"]);
  eq(ids({ age: 680, ev: [{ t: 0, w: "p", k: "im" }].concat(tries.slice(0, 3)) }, undefined, ["CL-1"]), [], "3 attempts only:");
  eq(ids({ age: 21.5, ev: [{ t: 1, w: "s", k: "decision", no: 1 }, { t: 20, w: "p", k: "im" }] }, undefined, ["CL-3", "CO-1"]), ["CL-3:late:open"], "a message after a no:");
  eq(ids({ age: 5, ev: [{ t: 1, w: "a", k: "note", stop: 1 }, { t: 2, w: "a", k: "remind" }] }, undefined, ["CO-4"]), ["CO-4:crit:open"]);
  // sent at 23:30 UTC = 19:30 New York (in the range), at 03:00 UTC = 23:00 New York (outside)
  eq(ids({ age: 10, ev: [{ t: 0, w: "a", k: "remind" }] }, { t0: Date.parse("2026-10-29T23:30:00Z") }, ["CO-5"]), []);
  eq(ids({ age: 10, ev: [{ t: 0, w: "a", k: "remind" }] }, { t0: Date.parse("2026-10-29T03:00:00Z") }, ["CO-5"]), ["CO-5:crit:open"]);
});

Deno.test("settings: a source not connected, an SLA off, a threshold changed, a place left out", () => {
  const l = { age: 1, ev: [{ t: 0, w: "p", k: "booked", r: 1 }] };
  try {
    SLA.configure({ sources: { messages: false } });
    eq(ids(l, undefined, ["SH-1", "SH-2"]), [], "no messages: SH-1 and SH-2 are not measured:");
    eq(SLA.status("SH-2").k, "wait");
    SLA.configure({ rules: { "SH-2": { late: 2 } } });
    eq(ids(l), ["SH-2:warn:open"], "missed only after 2 h now (the critical threshold follows):");
    eq(SLA.BY["SH-2"].crit, 2);
    SLA.configure({ rules: { "SH-2": { on: false } } });
    eq(ids(l), [], "switched off:");
    SLA.configure({ rules: { "SH-2": { slack: false } } });
    eq(ids(l, { surface: "slack" }), [], "not for Slack:");
    eq(ids(l, { surface: "screen" }), ["SH-2:crit:open"], "still on the screen:");
    SLA.configure({ rules: { "SH-5": { warn: 1 } } });
    eq(SLA.BY["SH-5"].warn, null, "no threshold where the reference has none:");
    eq(SLA.status("CL-2").k, "form");
  } finally { SLA.configure({}); }
});

const snap: Snap = { id: "c1", opened_at: "2026-10-30T10:00:00Z", person: "Test Lead", owner: "Valentino",
  events: [{ type: "call_booked", at: "2026-10-30T10:00:00Z", call_id: "k1" }, { type: "message_out", at: "2026-10-30T10:01:00Z", actor: "auto" }],
  calls: [{ id: "k1", rank: 1, status: "scheduled", start: "2026-11-02T15:00:00Z", end: "2026-11-02T15:45:00Z" }] };

Deno.test("the model of a cycle: kinds of the screen", () => {
  const l = toLead(snap, Date.parse("2026-10-30T11:00:00Z"));
  eq(l.ev.map((e) => `${e.w}${e.k}`), ["pbooked", "aremind", "smeet"]);
  eq(Math.round(l.age * 10) / 10, 1);
});

Deno.test("sla-tick: posts each new miss once, never the past, never before the settings date", async () => {
  const claimed = new Set<string>(), posts: string[] = [];
  const rpc = (fn: string, args: Record<string, unknown>) => {
    if (fn === "crm_sla_snapshot") return Promise.resolve([snap]);
    // deno-lint-ignore no-explicit-any
    const keys = (args.p_items as any[]).map((x) => x.key).filter((k) => !claimed.has(k)); keys.forEach((k) => claimed.add(k));
    return Promise.resolve(keys);
  };
  const post = (t: string) => { posts.push(t); return Promise.resolve(true); };
  const now = Date.parse("2026-10-30T11:00:00Z");
  eq(await tick(rpc, post, now, { since: "2026-10-30T12:00:00Z", sla_rules: {} }), { cycles: 1, new: 0, posted: false }, "before since:");
  // SH-2 (no personal message after 1 h) and CO-5 (the automatic message left at 06:01 in New York)
  eq(await tick(rpc, post, now, { since: "2026-10-30T00:00:00Z" }), { cycles: 1, new: 2, posted: true });
  if (!/Critique\* · SH-2 .+ · \*Test Lead\* \(Valentino\)/.test(posts[0]) || !/Critique\* \(technique\) · CO-5 /.test(posts[0])) throw new Error(posts[0]);
  eq(await tick(rpc, post, now + 60e3, { since: "2026-10-30T00:00:00Z" }), { cycles: 1, new: 0, posted: false }, "twice:");
  eq(posts.length, 1);
  // SH-2 off in Settings: nothing more to post for this cycle
  claimed.clear();
  eq(await tick(rpc, post, now, { since: "2026-10-30T00:00:00Z", sla_rules: { rules: { "SH-2": { slack: false } }, sources: { messages: false } } }), { cycles: 1, new: 0, posted: false }, "SH-2 not for Slack, no messages:");
  SLA.configure({});
  eq(slackText([{ level: "late", sla: "CO-1", name: "Reply", person: "A", owner: "B", elapsed: "1 h", extra: "x", target: "15 min" }], "L").split("\n")[0], "1 SLA du cycle de vente dépassé");
});

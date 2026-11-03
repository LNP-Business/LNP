// deno test --allow-env --allow-read supabase/tests
// Sales cycle SLAs v3 (docs/crm/18): the rules shared with the screen, the model of a cycle, and what sla-tick posts.
import "../functions/_shared/sla_rules.js";
import { slackText, toLead, type Snap } from "../functions/_shared/sla_view.ts";
import { tick } from "../functions/sla-tick/index.ts";

// deno-lint-ignore no-explicit-any
const SLA = (globalThis as any).SKL_SLA;
function eq<T>(a: T, b: T, msg = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const ids = (l: unknown, o?: unknown) => SLA.evaluate(l, o).map((b: { id: string; level: string; open: boolean }) => `${b.id}:${b.level}:${b.open ? "open" : "done"}`);

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
  eq(await tick(rpc, post, now, { since: "2026-10-30T00:00:00Z" }), { cycles: 1, new: 1, posted: true });
  if (!/Critique\* · SH-2 .+ · \*Test Lead\* \(Valentino\)/.test(posts[0])) throw new Error(posts[0]);
  eq(await tick(rpc, post, now + 60e3, { since: "2026-10-30T00:00:00Z" }), { cycles: 1, new: 0, posted: false }, "twice:");
  eq(await tick(rpc, post, now, { since: "2026-10-30T12:00:00Z" }), { cycles: 1, new: 0, posted: false }, "before since:");
  eq(posts.length, 1);
  eq(slackText([{ level: "late", sla: "CO-1", name: "Reply", person: "A", owner: "B", elapsed: "1 h", extra: "x", target: "15 min" }], "L").split("\n")[0], "1 SLA du cycle de vente dépassé");
});

// deno test --allow-env --allow-read supabase/tests
import { normEmail, normPhone } from "../functions/_shared/normalize.ts";
import { eventName, mapIclosed } from "../functions/_shared/mappers/iclosed.ts";
import { processPending, Rpc } from "../functions/_shared/worker.ts";

function eq<T>(a: T, b: T, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test("normalize: emails", () => {
  eq(normEmail(" Jane.Doe@Mail.com "), "jane.doe@mail.com");
  eq(normEmail("<jane@x.io>"), "jane@x.io");
  eq(normEmail("no-at-sign"), null);
  eq(normEmail(undefined), null);
});
Deno.test("normalize: phones (E.164, never guessed)", () => {
  eq(normPhone("+33 6 12 34 56 78"), "+33612345678");
  eq(normPhone("0033612345678"), "+33612345678");
  eq(normPhone("+1 (415) 555-2671"), "+14155552671");
  eq(normPhone("06 12 34 56 78"), null, "no country code:");
  eq(normPhone("+1 555"), null, "too short:");
});

const fixture = Deno.readTextFileSync(new URL("../../docs/crm/fixtures/iclosed-call_booked.json", import.meta.url));

Deno.test("iclosed: our Zap contract (fixture)", () => {
  const r = mapIclosed(fixture, "2026-10-24T09:12:05Z");
  if (!("items" in r)) throw new Error("not mapped");
  const it = r.items[0];
  eq(it.type, "call_booked");
  eq(it.source_id, "iclosed:call_booked:icl_call_0001:2026-10-24T09:12:00.000Z");
  eq(it.identity, { email: "test.prospect@example.com", phone: "+33600000001", iclosed_contact_id: "icl_contact_0001", name: "Test Prospect" });
  eq(it.refs, { iclosed_call_id: "icl_call_0001" });
  eq(it.data.start, "2026-10-27T15:00:00.000Z");
  eq(it.data.host_email, "sales@example.com");
});

Deno.test("iclosed: native shapes (event names, nested data, camelCase)", () => {
  const body = {
    event: "call.rescheduled", timestamp: "2026-10-24T10:00:00Z",
    data: { call: { callId: "C9", startTime: "2026-10-28T16:00:00Z", endTime: "2026-10-28T16:45:00Z", closer: { email: "Host@Team.com" } },
            contact: { contactId: 42, firstName: "Jo", lastName: "Doe", email: "JO@x.com", phoneNumber: "+1 415 555 2671" } },
  };
  const r = mapIclosed(JSON.stringify(body), "2026-10-24T10:00:03Z");
  if (!("items" in r)) throw new Error("not mapped");
  const it = r.items[0];
  eq(it.type, "call_rescheduled");
  eq(it.occurred_at, "2026-10-24T10:00:00.000Z");
  eq(it.identity, { email: "jo@x.com", phone: "+14155552671", iclosed_contact_id: "42", name: "Jo Doe" });
  eq(it.data.host_email, "host@team.com");
  eq(eventName({ type: "Call Cancelled" }), "call_cancelled");
  const c = mapIclosed(JSON.stringify({ type: "Call Cancelled", call: { id: "C9" } }), "2026-10-24T11:00:00Z");
  eq("items" in c && c.items[0].type, "call_canceled");
  eq("items" in c && c.items[0].occurred_at, "2026-10-24T11:00:00.000Z", "falls back to reception time:");
});

const native = (f: string) => Deno.readTextFileSync(new URL(`../../docs/crm/fixtures/iclosed-native-${f}.json`, import.meta.url));

Deno.test("iclosed: native webhooks (hookType + the call as an object under event)", () => {
  const b = mapIclosed(native("call_booked"), "2026-10-26T14:24:58Z");
  if (!("items" in b)) throw new Error("booked not mapped");
  const it = b.items[0];
  eq(it.type, "call_booked");
  eq(it.refs, { iclosed_call_id: "1000001" });
  eq(it.occurred_at, "2026-10-26T14:24:56.689Z");
  eq(it.data.start, "2026-10-28T15:00:00.000Z", "utc_start_time, not the shifted start_time:");
  eq(it.data.end, "2026-10-28T15:45:00.000Z");
  eq(it.data.host_email, "sales@example.com");
  eq(it.data.event_type, "DISCOVERY_CALL");
  eq(it.identity, { email: "test.prospect@example.com", phone: "+33600000001", iclosed_contact_id: "9000001", name: "Test Prospect" });
  const r = mapIclosed(native("call_rescheduled"), "2026-10-26T15:08:58Z");
  eq("items" in r && r.items[0].type, "call_rescheduled");
  eq("items" in r && r.items[0].data.start, "2026-10-29T18:00:00.000Z");
  eq("items" in r && r.items[0].occurred_at, "2026-10-26T15:08:56.892Z");
  const c = mapIclosed(native("call_cancelled"), "2026-10-27T00:07:08Z");
  eq("items" in c && c.items[0].type, "call_canceled");
  eq("items" in c && c.items[0].occurred_at, "2026-10-27T00:07:06.730Z");
  eq("items" in c && c.items[0].data.cancel_reason, "Something came up");
  eq(eventName({ hookType: "Outcome added", event: { uuid: 1 } }), "outcome_added");
  eq(eventName({ event: { uuid: 1 } }), "", "an object is never an event name:");
  eq("ignored" in mapIclosed(native("contact_updated"), "2026-10-26T14:00:00Z"), true, "a status change is never taken:");
});

Deno.test("iclosed: Contact updated takes only a new name, email or phone", () => {
  const r = mapIclosed(native("contact_email"), "2026-10-26T16:00:02Z");
  if (!("items" in r)) throw new Error("email change not mapped");
  const it = r.items[0];
  eq(it.type, "contact_updated");
  eq(it.source_id, "iclosed:contact_updated:9000001:2026-10-26T16:00:00.000Z");
  eq(it.identity, { iclosed_contact_id: "9000001", email: "new.address@example.com", phone: "+33600000001", name: "Test Prospect" });
  eq(it.data.changed, ["email"]);
  const two = mapIclosed(JSON.stringify({ ...JSON.parse(native("contact_email")), updatedAttributes: ["Status", "Name", "Phone Number"] }), "2026-10-26T16:00:02Z");
  eq("items" in two && two.items[0].data.changed, ["name", "phone"]);
  const none = mapIclosed(JSON.stringify({ ...JSON.parse(native("contact_email")), updatedAttributes: [] }), "2026-10-26T16:00:02Z");
  eq("ignored" in none, true, "nothing listed as changed:");
});

Deno.test("iclosed: other events are kept as ignored; unreadable ones throw", () => {
  eq("ignored" in mapIclosed('{"event":"contact.created","contact":{"id":1}}', "2026-10-24T10:00:00Z"), true);
  eq("ignored" in mapIclosed('{"event":"outcome_added"}', "2026-10-24T10:00:00Z"), true);
  let threw = false;
  try { mapIclosed('{"event":"call_booked","contact":{"email":"a@b.co"}}', "2026-10-24T10:00:00Z"); } catch { threw = true; }
  eq(threw, true, "no call id:");
});

Deno.test("worker: maps, applies, ignores, rejects and fails per row", async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const rows = [
    { id: 1, source: "iclosed", body: fixture, auth_ok: true, received_at: "2026-10-24T09:12:05Z" },
    { id: 2, source: "iclosed", body: '{"event":"contact_updated"}', auth_ok: true, received_at: "2026-10-24T09:13:00Z" },
    { id: 3, source: "iclosed", body: "{}", auth_ok: false, received_at: "2026-10-24T09:14:00Z" },
    { id: 4, source: "iclosed", body: "not json", auth_ok: true, received_at: "2026-10-24T09:15:00Z" },
    { id: 5, source: "iclosed", body: native("contact_email"), auth_ok: true, received_at: "2026-10-26T16:00:02Z" },
  ];
  const rpc: Rpc = (fn, args) => {
    calls.push([fn, args]);
    if (fn === "crm_inbox_pending") return Promise.resolve(rows);
    if (fn === "crm_apply_items" || fn === "crm_apply_contact") return Promise.resolve("processed");
    return Promise.resolve(null);
  };
  const s = await processPending(rpc);
  eq(s, { rows: 5, processed: 2, ignored: 1, rejected: 1, failed: 1 });
  eq(calls.find((c) => c[0] === "crm_apply_contact")![1].p_inbox, 5, "a contact update goes to crm_apply_contact:");
  eq(calls[0], ["crm_inbox_pending", { p_sources: ["iclosed", "sendblue", "fathom"], p_limit: 50 }]);
  const apply = calls.find((c) => c[0] === "crm_apply_items")!;
  eq(apply[1].p_inbox, 1);
  const marks = calls.filter((c) => c[0] === "crm_inbox_mark").map((c) => [c[1].p_inbox, c[1].p_status]);
  eq(marks, [[2, "ignored"], [3, "rejected"], [4, "failed"]]);
});

import { mapSendblue } from "../functions/_shared/mappers/sendblue.ts";
Deno.test("sendblue: received and sent messages, statuses on one handle, STOP, groups and calls", () => {
  const rec = Deno.readTextFileSync(new URL("../../docs/crm/fixtures/sendblue-receive.json", import.meta.url));
  const out = Deno.readTextFileSync(new URL("../../docs/crm/fixtures/sendblue-outbound.json", import.meta.url));
  const a = mapSendblue(rec, "2026-10-24T10:01:02Z"), b = mapSendblue(out, "2026-10-24T10:05:04Z");
  if (!("items" in a) || !("items" in b)) throw new Error("not mapped");
  eq([a.items[0].type, a.items[0].actor, a.items[0].channel, a.items[0].identity.phone], ["message_in", "prospect", "imessage", "+33600000001"]);
  eq([b.items[0].type, b.items[0].actor, b.items[0].source_id, b.items[0].data.status], ["message_out", "sales", "sendblue:msg_handle_0002", "DELIVERED"]);
  eq(a.items[0].occurred_at, "2026-10-24T10:01:00.000Z");
  const wf = mapSendblue(JSON.stringify({ ...JSON.parse(out), source: "workflow" }), "2026-10-24T10:05:04Z");
  eq("items" in wf && wf.items[0].actor, "auto", "a Sendblue workflow message is automatic:");
  const stop = mapSendblue(JSON.stringify({ ...JSON.parse(rec), content: " Stop ", message_handle: "h9" }), "2026-10-24T10:01:00Z");
  eq("items" in stop && stop.items.map((i) => i.type), ["message_in", "opt_out"]);
  eq("ignored" in mapSendblue(JSON.stringify({ ...JSON.parse(rec), group_id: "g1" }), "2026-10-24T10:01:00Z"), true);
  eq("ignored" in mapSendblue('{"type":"typing_indicator"}', "2026-10-24T10:01:00Z"), true);
  const call = mapSendblue(JSON.stringify({ call_id: "c1", direction: "outbound", from_number: "+15550000001", to_number: "+33600000001",
    sendblue_number: "+15550000001", created_at: "2026-10-24T11:00:00Z", duration: 60 }), "2026-10-24T11:01:00Z");
  eq("items" in call && [call.items[0].type, call.items[0].identity.phone, call.items[0].source_id], ["phone_call_out", "+33600000001", "sendblue:call:c1"]);
});

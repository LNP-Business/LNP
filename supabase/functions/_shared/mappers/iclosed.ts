// iClosed (calendar only, docs/crm/05): call booked, rescheduled, cancelled. Reads iClosed's own webhooks and the Zap
// contract skl.iclosed.v1. VERIFY: iClosed's native payload was not documented publicly when this was written, so fields
// are looked up under the usual names; a payload it cannot read fails with a clear error and stays in crm_webhook_log
// for replay once the mapping is adjusted. Native webhooks since 2026-10-25: hookType ("Call booked", "Call rescheduled",
// "Call cancelled"; "Outcome added" stays ignored; "Contact updated" only for a new name, email or phone, see mapContact) and the call under event (uuid = the imported
// iclosed_call_id, utc_start_time / utc_end_time, closerEmail, canceled_at); fixtures docs/crm/fixtures/iclosed-native-*.json.
import { Canonical, MapResult } from "../canonical.ts";
import { normEmail, normId, normPhone } from "../normalize.ts";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (...vs: unknown[]): Obj => (vs.find(isObj) as Obj) ?? {};
function pick(o: Obj, paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = o;
    for (const k of p.split(".")) cur = isObj(cur) ? cur[k] : undefined;
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}
function iso(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const EVENTS: Record<string, "call_booked" | "call_rescheduled" | "call_canceled"> = {
  call_booked: "call_booked", booked: "call_booked", call_scheduled: "call_booked", event_scheduled: "call_booked",
  new_booking: "call_booked", booking_created: "call_booked", call_created: "call_booked",
  call_rescheduled: "call_rescheduled", rescheduled: "call_rescheduled", event_rescheduled: "call_rescheduled",
  booking_rescheduled: "call_rescheduled",
  call_cancelled: "call_canceled", call_canceled: "call_canceled", cancelled: "call_canceled", canceled: "call_canceled",
  event_cancelled: "call_canceled", event_canceled: "call_canceled", booking_cancelled: "call_canceled",
};

export function eventName(body: Obj): string {
  // iClosed's native webhooks (seen from 2026-10-25) name the hook in hookType ("Call booked") and send the call itself
  // as an object under "event"; an object is never an event name
  const raw = [body.hookType, body.hook_type].find((v) => typeof v === "string" && v) ?? pick(body, ["event", "type", "eventType", "event_type", "trigger", "triggerType", "action", "data.event", "data.type"]);
  return String(isObj(raw) ? "" : raw ?? "").trim().toLowerCase().replace(/[\s.\-]+/g, "_");
}

// iClosed's updatedAttributes → the details the CRM takes over (Romain 2026-10-27: never the status, 023)
const DETAILS: Record<string, "name" | "email" | "phone"> = {
  name: "name", firstname: "name", lastname: "name", email: "email", phone: "phone", phonenumber: "phone",
};

function mapContact(body: Obj, receivedAt: string): MapResult {
  const attrs = Array.isArray(body.updatedAttributes) ? body.updatedAttributes.map((a) => String(a)) : [];
  const changed = [...new Set(attrs.map((a) => DETAILS[a.toLowerCase().replace(/[\s_]/g, "")]).filter(Boolean))];
  if (!changed.length) {
    return { ignored: `iclosed contact_updated: ${attrs.length ? attrs.join(", ") : "nothing"} changed; the CRM keeps its own status` };
  }
  const contactId = normId(pick(body, ["id", "contactId", "contact_id"]));
  if (!contactId) throw new Error("iclosed contact_updated: no contact id found");
  const name = [pick(body, ["firstName", "first_name"]), pick(body, ["lastName", "last_name"])].filter(Boolean).join(" ").trim();
  const email = normEmail(pick(body, ["email"]));
  const phone = normPhone(pick(body, ["phoneNumber", "phone"]));
  const occurred = iso(pick(body, ["updatedAt", "updated_at"])) ?? iso(receivedAt)!;
  const identity: Canonical["identity"] = { iclosed_contact_id: contactId };
  if (email) identity.email = email;
  if (phone) identity.phone = phone;
  if (name) identity.name = name;
  return {
    items: [{
      source: "iclosed",
      source_id: `iclosed:contact_updated:${contactId}:${occurred}`,
      type: "contact_updated",
      occurred_at: occurred,
      actor: "prospect",
      channel: "booking",
      identity,
      data: { changed, summary: [name, email, phone].filter(Boolean).join(" · ") },
    }],
  };
}

export function mapIclosed(raw: string, receivedAt: string): MapResult {
  const parsed = JSON.parse(raw);
  const body: Obj = Array.isArray(parsed) ? obj(parsed[0]) : obj(parsed);
  const ev = eventName(body);
  if (ev === "daily_snapshot") return { ignored: "iclosed daily_snapshot: reconciliation comes later (14)" };
  if (ev === "contact_updated") return mapContact(body, receivedAt);
  const type = EVENTS[ev];
  if (!type) return { ignored: `iclosed event "${ev || "?"}" stored, not used by the CRM` };

  const root = obj(body.data, body.payload, body);
  const call = obj(root.call, root.event, root.booking, root.appointment, root.meeting, root);
  const contact = obj(root.contact, root.invitee, root.lead, root.prospect, call.contact, call.invitee, root.attendee);

  const callId = normId(pick(call, ["id", "callId", "call_id", "uuid", "eventId", "event_id", "bookingId", "booking_id"]) ??
    pick(root, ["callId", "call_id", "eventId", "event_id", "bookingId", "booking_id"]));
  if (!callId) throw new Error(`iclosed ${type}: no call id found (keys: ${Object.keys(root).join(", ")})`);

  const first = pick(contact, ["first_name", "firstName", "firstname"]), last = pick(contact, ["last_name", "lastName", "lastname"]);
  const name = String(pick(contact, ["name", "fullName", "full_name"]) ?? [first, last].filter(Boolean).join(" ")).trim();
  const email = normEmail(pick(contact, ["email", "emailAddress", "email_address"]));
  const phoneRaw = pick(contact, ["phone", "phoneNumber", "phone_number", "mobile"]);
  const phone = normPhone(phoneRaw);
  const contactId = normId(pick(contact, ["id", "contactId", "contact_id", "uuid"]) ?? pick(root, ["contactId", "contact_id"]));
  const start = iso(pick(call, ["utc_start_time", "start", "startTime", "start_time", "startAt", "start_at", "scheduledStart", "scheduled_start", "startDate", "date"]));
  const end = iso(pick(call, ["utc_end_time", "end", "endTime", "end_time", "endAt", "end_at", "scheduledEnd", "scheduled_end", "endDate"]));
  const host = normEmail(pick(call, ["host_email", "hostEmail", "host.email", "closer.email", "closerEmail", "user.email", "assignedTo.email",
    "owner.email", "organizer.email"]) ?? pick(root, ["host_email", "hostEmail", "host.email", "closer.email", "closerEmail", "user.email", "owner.email"]));
  const occurred = iso(pick(body, ["occurred_at", "occurredAt", "timestamp", "data.occurred_at", "data.occurredAt"]) ??
    pick(root, type === "call_booked" ? ["createdAt", "created_at"] : ["updatedAt", "updated_at", "cancelledAt", "canceledAt"]) ??
    pick(call, type === "call_canceled" ? ["canceled_at", "cancelledAt", "canceledAt", "created_at"] : ["created_at", "createdAt"])) ?? iso(receivedAt)!;

  const identity: Canonical["identity"] = {};
  if (email) identity.email = email;
  if (phone) identity.phone = phone;
  if (contactId) identity.iclosed_contact_id = contactId;
  if (name) identity.name = name;

  return {
    items: [{
      source: "iclosed",
      source_id: `iclosed:${type}:${callId}:${occurred}`,
      type,
      occurred_at: occurred,
      actor: "prospect",
      channel: "booking",
      identity,
      refs: { iclosed_call_id: callId },
      data: {
        start, end, host_email: host,
        event_type: pick(call, ["type", "event_type", "eventType", "calendar", "calendarName", "eventName", "title"]) ?? null,
        cancel_reason: pick(call, ["cancel_reason", "cancelReason", "reason"]) ?? null,
        phone_raw: phone ? null : (phoneRaw ?? null),
        summary: [name, email, phone ?? phoneRaw, start].filter(Boolean).join(" · "),
      },
    }],
  };
}

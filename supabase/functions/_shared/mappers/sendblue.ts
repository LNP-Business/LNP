// Sendblue (docs/crm/07): iMessage / SMS messages and phone calls of the sales' Sendblue lines. One message = one event,
// found again by its handle: Sendblue sends a new webhook for each status (SENT, DELIVERED, READ…), and the same handle
// updates the event's status instead of adding a line. The same mapping reads the message history (crm-import).
// Field names checked on captured webhooks (2026-10-24): content, is_outbound, status, message_handle, date_sent,
// from_number, to_number, number, sendblue_number, service, media_url, opted_out, group_id.
import { Canonical, MapResult } from "../canonical.ts";
import { normPhone } from "../normalize.ts";

type Obj = Record<string, unknown>;
const STOP = /^\s*(stop|arret|arrêt|unsubscribe)\s*$/i;
// outbound "source": "workflow" = a Sendblue automation (shown as automatic), "dashboard" = typed by a sales rep
const AUTO = new Set(["workflow", "automation", "api"]);
const iso = (v: unknown) => { const d = new Date(String(v ?? "")); return isNaN(d.getTime()) ? null : d.toISOString(); };

export function sendblueItems(m: Obj, receivedAt: string): Canonical[] | { ignored: string } {
  if (m.group_id) return { ignored: "sendblue group message: no group policy yet (07 §2)" };
  const line = normPhone(m.sendblue_number);
  const callId = m.call_id ? String(m.call_id) : null;
  if (callId) {
    const out = String(m.direction ?? "").toLowerCase() === "outbound" || (line != null && normPhone(m.from_number) === line);
    const phone = normPhone(out ? m.to_number : m.from_number) ?? normPhone(m.number);
    if (!phone) return { ignored: "sendblue call without a prospect number" };
    return [{
      source: "sendblue", source_id: `sendblue:call:${callId}`, type: out ? "phone_call_out" : "phone_call_in",
      occurred_at: iso(m.created_at) ?? receivedAt, actor: out ? "sales" : "prospect", channel: "phone",
      content: out ? "Outgoing phone call" : "Incoming phone call", identity: { phone },
      data: { status: m.status ?? null, answered: m.answered ?? null, duration: m.duration ?? null, sendblue_number: line },
    }];
  }
  const handle = m.message_handle ? String(m.message_handle) : null;
  if (!handle) return { ignored: "sendblue event without a message handle (line, typing or contact event)" };
  const outbound = m.is_outbound === true || m.is_outbound === "true";
  const phone = normPhone(m.number) ?? normPhone(outbound ? m.to_number : m.from_number);
  if (!phone) return { ignored: "sendblue message without a prospect number" };
  const content = String(m.content ?? "");
  const items: Canonical[] = [{
    source: "sendblue", source_id: `sendblue:${handle}`, type: outbound ? "message_out" : "message_in",
    occurred_at: iso(m.date_sent) ?? receivedAt, actor: !outbound ? "prospect" : AUTO.has(String(m.source ?? "")) ? "auto" : "sales",
    channel: String(m.service ?? "").toUpperCase() === "SMS" ? "sms" : "imessage", content, identity: { phone },
    data: { handle, status: m.status ?? null, service: m.service ?? null, origin: m.source ?? null, media_url: m.media_url || null,
      sendblue_number: line, error_code: m.error_code ?? null, error_message: m.error_message ?? null },
  }];
  if (m.opted_out === true || (!outbound && STOP.test(content))) {
    items.push({ source: "sendblue", source_id: `sendblue:optout:${handle}`, type: "opt_out", occurred_at: items[0].occurred_at,
      actor: "prospect", channel: items[0].channel, identity: { phone }, data: { handle } });
  }
  return items;
}

export function mapSendblue(raw: string, receivedAt: string): MapResult {
  const body = JSON.parse(raw);
  const r = sendblueItems(Array.isArray(body) ? body[0] ?? {} : body, receivedAt);
  return Array.isArray(r) ? { items: r } : r;
}

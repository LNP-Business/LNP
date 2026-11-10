// WhatsApp Business (Cloud API with coexistence, docs/crm/07-integration-whatsapp.md): the messages of the team's WhatsApp
// Business numbers. One webhook = one Meta payload {object: "whatsapp_business_account", entry: [{changes: [{field, value}]}]},
// forwarded as is by the provider (360dialog, or Meta directly). Read here:
//   field "messages"           value.messages[]       a message from the prospect           → message_in  (prospect)
//                              value.statuses[]       a message sent through the API         → message_out (auto), status
//   field "smb_message_echoes" value.message_echoes[] a message the team sent from the app   → message_out (sales)
//   field "history"            value.history[].threads[].messages[]  the chats shared at onboarding (in or out by "from")
// One message = one event, found again by its WhatsApp id (source_id "whatsapp:<wamid>"): a status or a second delivery
// updates it. The team number is value.metadata.display_phone_number (data.line: the CRM finds the team member by it).
import { Canonical, MapResult } from "../canonical.ts";
import { normPhone } from "../normalize.ts";

type Obj = Record<string, unknown>;
const STOP = /^\s*(stop|arret|arrêt|unsubscribe)\s*$/i;
const STATUSES = new Set(["sent", "delivered", "read", "failed"]);
const obj = (v: unknown): Obj => (v && typeof v === "object" ? v as Obj : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
// WhatsApp numbers come without "+" ("33612345678")
const phone = (v: unknown) => (v == null || v === "" ? null : normPhone(String(v).startsWith("+") ? String(v) : "+" + String(v)));
const at = (ts: unknown, fallback: string) => {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : fallback;
};

// the words of a message, whatever its kind; media keep their caption, the kind stays in data.kind
export function textOf(m: Obj): string {
  const t = String(m.type ?? "");
  const o = obj(m[t]);
  if (t === "text") return String(obj(m.text).body ?? "");
  if (t === "button") return String(obj(m.button).text ?? "");
  if (t === "interactive") {
    const i = obj(m.interactive);
    return String(obj(i.button_reply).title ?? obj(i.list_reply).title ?? "");
  }
  return String(o.caption ?? o.filename ?? "");
}

function message(m: Obj, out: boolean, actor: Canonical["actor"], line: string | null, prospect: string | null, name: string | null,
                 receivedAt: string, extra: Obj = {}): Canonical[] {
  const id = m.id ? String(m.id) : null;
  if (!id || !prospect) return [];
  const content = textOf(m);
  const occurred = at(m.timestamp, receivedAt);
  const items: Canonical[] = [{
    source: "whatsapp", source_id: `whatsapp:${id}`, type: out ? "message_out" : "message_in", occurred_at: occurred, actor,
    channel: "whatsapp", content, identity: name ? { phone: prospect, name } : { phone: prospect },
    data: { wamid: id, kind: m.type ?? null, line, ...extra },
  }];
  if (!out && STOP.test(content)) {
    items.push({ source: "whatsapp", source_id: `whatsapp:optout:${id}`, type: "opt_out", occurred_at: occurred, actor: "prospect",
      channel: "whatsapp", identity: { phone: prospect }, data: { wamid: id, line } });
  }
  return items;
}

export function whatsappItems(body: Obj, receivedAt: string): Canonical[] {
  const items: Canonical[] = [];
  for (const entry of arr(body.entry)) {
    for (const ch of arr(entry.changes)) {
      const field = String(ch.field ?? ""), v = obj(ch.value);
      const line = phone(obj(v.metadata).display_phone_number);
      if (field === "messages") {
        const names: Record<string, string> = {};
        for (const c of arr(v.contacts)) if (c.wa_id) names[String(c.wa_id)] = String(obj(c.profile).name ?? "");
        for (const m of arr(v.messages)) {
          if (m.group_id || m.type === "reaction" || m.type === "unsupported" || m.type === "system") continue;
          items.push(...message(m, false, "prospect", line, phone(m.from), names[String(m.from)] || null, receivedAt));
        }
        // a status alone: a message sent through the API (an automatic reminder); an echo of the same id makes it "sales"
        for (const s of arr(v.statuses)) {
          const st = String(s.status ?? "");
          if (!STATUSES.has(st) || !s.id) continue;
          const to = phone(s.recipient_id);
          if (!to) continue;
          const err = arr(s.errors)[0];
          items.push({ source: "whatsapp", source_id: `whatsapp:${s.id}`, type: "message_out", occurred_at: at(s.timestamp, receivedAt),
            actor: "auto", channel: "whatsapp", content: "", identity: { phone: to },
            data: { wamid: String(s.id), line, status: st, error_code: err?.code ?? null, error_message: err?.title ?? null } });
        }
      } else if (field === "smb_message_echoes") {
        for (const m of arr(v.message_echoes)) {
          if (m.group_id) continue;
          items.push(...message(m, true, "sales", phone(m.from) ?? line, phone(m.to), null, receivedAt, { status: "sent" }));
        }
      } else if (field === "history") {
        for (const h of arr(v.history)) {
          for (const t of arr(h.threads)) {
            const prospect = phone(t.id);
            for (const m of arr(t.messages)) {
              const out = line != null && phone(m.from) === line;
              items.push(...message(m, out, out ? "sales" : "prospect", line, prospect, null, receivedAt,
                { status: String(obj(m.history_context).status ?? "").toLowerCase() || null, history: true }));
            }
          }
        }
      }
    }
  }
  return items;
}

export function mapWhatsapp(raw: string, receivedAt: string): MapResult {
  const body = JSON.parse(raw);
  const items = whatsappItems(obj(body), receivedAt);
  return items.length ? { items } : { ignored: "whatsapp: nothing to keep (contacts sync, reaction, group or an unknown field)" };
}

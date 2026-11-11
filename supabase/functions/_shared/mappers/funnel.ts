// Funnel leads (quiz, VSL, abandoned quiz, webinar) → the setter's « Lead à contacter » (docs/crm/19-setting.md, migration 054).
// The quiz / VSL tool (or Zapier, Make…) posts one JSON lead, or a list, to lead-in. Field names are read loosely, so most
// tools work without a mapping step:
//   source  : source | funnel | type          → quiz | vsl | quiz_abandon | webinaire
//   email   : email | contact.email
//   phone   : phone | telephone | tel | contact.phone   (French 06… is read as +33 6…)
//   name    : name | full_name | first_name + last_name | prenom + nom
//   booked  : booked | rdv | has_booking       (true: an iClosed booking follows, the setter confirms it)
//   answers : answers | quiz | responses       (kept as received, shown in the lead record)
//   attended: attended | present | showed_up   (webinar only: true = came, false = absent; migration 059)
//   id      : id | lead_id | submission_id     (the same id twice is one lead)
//   at      : submitted_at | created_at | date
import { Canonical, MapResult } from "../canonical.ts";
import { normPhone } from "../normalize.ts";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {});
const str = (...v: unknown[]) => { for (const x of v) if (x !== undefined && x !== null && String(x).trim() !== "") return String(x).trim(); return ""; };

export function funnelSource(v: unknown): string {
  const s = String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/aband|partial|incomplet/.test(s)) return "quiz_abandon";
  if (/webin/.test(s)) return "webinaire";
  if (/vsl|video|opt/.test(s)) return "vsl";
  return "quiz";
}
export function funnelPhone(v: unknown): string | null {
  const s = String(v ?? "").replace(/[^\d+]/g, "");
  if (!s) return null;
  return normPhone(s.startsWith("+") || s.startsWith("00") ? s : s.startsWith("0") ? "+33" + s.slice(1) : "+" + s);
}
const truthy = (v: unknown) => v === true || /^(true|oui|yes|1)$/i.test(String(v ?? ""));

export function funnelItem(b: Obj, receivedAt: string): Canonical | null {
  const c = obj(b.contact);
  const email = str(b.email, c.email).toLowerCase();
  const phone = funnelPhone(str(b.phone, b.telephone, b.tel, c.phone));
  if (!email && !phone) return null;
  const name = str(b.name, b.full_name, c.name, [str(b.first_name, b.prenom), str(b.last_name, b.nom)].filter(Boolean).join(" "));
  const source = funnelSource(str(b.source, b.funnel, b.type));
  const at = new Date(str(b.submitted_at, b.created_at, b.date) || receivedAt);
  const when = isNaN(at.getTime()) ? receivedAt : at.toISOString();
  const id = str(b.id, b.lead_id, b.submission_id) || `${email || phone}:${when.slice(0, 10)}`;
  const answers = b.answers ?? b.quiz ?? b.responses ?? null;
  const identity: Canonical["identity"] = {};
  if (email) identity.email = email;
  if (phone) identity.phone = phone;
  if (name) identity.name = name;
  return { source: "funnel", source_id: `funnel:${source}:${id}`, type: "lead_in", occurred_at: when, actor: "prospect", channel: "crm",
    identity, data: { source, booked: truthy(b.booked ?? b.rdv ?? b.has_booking), answers,
      attended: (b.attended ?? b.present ?? b.showed_up) == null ? null : truthy(b.attended ?? b.present ?? b.showed_up) } };
}

export function mapFunnel(raw: string, receivedAt: string): MapResult {
  const body = JSON.parse(raw);
  const list = Array.isArray(body) ? body : Array.isArray(obj(body).leads) ? obj(body).leads as unknown[] : [body];
  const items = list.map((x) => funnelItem(obj(x), receivedAt)).filter((x): x is Canonical => !!x);
  return items.length ? { items } : { ignored: "funnel: no lead with an email or a phone" };
}

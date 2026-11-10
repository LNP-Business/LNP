// Fathom (docs/crm/06 §0, rules FL-1 to FL-6, Romain 2026-10-29): Fathom is the source of truth of the sales calls. One
// recording = one item "call_recorded"; the database decides whether it is a sales call and whose (025_crm_fathom_calls.sql:
// recorder, then email, booking or name). The same mapping reads the meeting history (crm-import ?source=fathom), as the
// webhook carries a meeting of GET /meetings (06 §1; VERIFY on the first captured webhook).
import { Canonical, MapResult } from "../canonical.ts";
import { normEmail } from "../normalize.ts";

type Obj = Record<string, any>;
const iso = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d.toISOString(); };
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const twoWords = (s: string) => s.split(" ").filter(Boolean).length >= 2;

// names of two words or more in a title: "Ann Prospect x Design Career Roadmap Call on…", "Updated - Ann Prospect x …",
// "Ann Prospect: your Design Career Roadmap Call", "Ann Prospect | LNP Roadmap Call 2."
export function titleNames(title: unknown): string[] {
  const t = clean(title).replace(/^updated\s*[-:]\s*/i, "");
  const m = t.match(/^(.+?)\s+x\s+/i) ?? t.match(/^(.+?)\s*:\s/) ?? t.match(/^(.+?)\s*\|/);
  return m && twoWords(clean(m[1])) ? [clean(m[1])] : [];
}

// the engine's transcript format "[hh:mm:ss] Speaker: text" (call-analysis/engine core/foundation.py LINE); a colon in a
// name would end the label, so names lose theirs
export function engineTranscript(lines: Obj[]): string {
  return (lines ?? []).map((l) => {
    const name = clean(clean(l?.speaker?.display_name).replace(/:/g, " ")) || "Unknown";
    const ts = /^\d{1,2}:\d{2}(:\d{2})?$/.test(clean(l?.timestamp)) ? clean(l.timestamp) : "00:00:00";
    return `[${ts}] ${name}: ${clean(l?.text)}`;
  }).filter((x) => !/: $/.test(x)).join("\n");
}

export function fathomItem(m: Obj, receivedAt: string): Canonical | { ignored: string } {
  const rid = m?.recording_id;
  if (rid === undefined || rid === null || !/^\d+$/.test(String(rid))) return { ignored: "fathom event without a recording id" };
  const recorder = normEmail(m.recorded_by?.email) ?? "";
  const recorderName = clean(m.recorded_by?.name);
  const lines: Obj[] = Array.isArray(m.transcript) ? m.transcript : [];
  const invitees: Obj[] = Array.isArray(m.calendar_invitees) ? m.calendar_invitees : [];
  const speakers: { name: string; email: string | null }[] = [];
  for (const l of lines) {
    const name = clean(l?.speaker?.display_name);
    if (name && !speakers.some((s) => s.name === name)) speakers.push({ name, email: normEmail(l?.speaker?.matched_calendar_invitee_email) });
  }
  const emails = new Set<string>();
  for (const i of invitees) { const e = normEmail(i?.email); if (e && i?.is_external !== false && e !== recorder) emails.add(e); }
  for (const s of speakers) if (s.email && s.email !== recorder) emails.add(s.email);
  const names = new Set<string>();
  for (const i of invitees) { const n = clean(i?.name); if (twoWords(n) && normEmail(i?.email) !== recorder && n !== recorderName) names.add(n); }
  for (const s of speakers) if (twoWords(s.name) && s.email !== recorder && s.name !== recorderName) names.add(s.name);
  for (const n of titleNames(m.title)) names.add(n);
  const start = iso(m.recording_start_time) ?? iso(m.scheduled_start_time) ?? iso(m.created_at) ?? receivedAt;
  return {
    source: "fathom", source_id: `fathom:recorded:${rid}`, type: "call_recorded", occurred_at: start, actor: "sales", channel: "video",
    identity: { emails: [...emails] },
    refs: { fathom_recording_id: Number(rid), recorder_email: recorder },
    data: {
      start, end: iso(m.recording_end_time), scheduled_start: iso(m.scheduled_start_time), title: clean(m.title) || null,
      url: m.url ?? null, share_url: m.share_url ?? null, recorder_name: recorderName || null, names: [...names], speakers,
      transcript: lines.length ? lines : null, transcript_raw: lines.length ? engineTranscript(lines) : null,
      summary_md: m.default_summary?.markdown_formatted ?? null,
    },
  };
}

export function mapFathom(raw: string, receivedAt: string): MapResult {
  const body = JSON.parse(raw);
  const m = body?.recording_id !== undefined ? body : body?.meeting ?? body?.data ?? body;
  const r = fathomItem(m, receivedAt);
  return "ignored" in r ? r : { items: [r] };
}

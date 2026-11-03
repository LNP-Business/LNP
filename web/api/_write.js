// Claude connector, phase B: the write tools, for LNP admins only (Romain, 2026-10-25: "every admin member must be able
// to edit"). docs/crm/17-claude-connector.md §10.
// They go through the same security-definer functions as the app (crm_add_note, crm_declare_outcome: role and ownership
// checks, audit log, events), with the caller's own token. Claude asks the person before each call; nothing is ever
// written without a tool call.
import { userError } from "./_crm.js";

function need(ok, msg) { if (!ok) throw userError(msg); }

export async function leadNote(u, ctx, a) {
  const r = await u.rpc("crm_add_note", { p_cycle: a.cycle_id, p_text: a.text });
  need(!r.error, r.error ? "Not saved: " + r.error.message : "");
  return { text: "Note added to the lead.", rows: 1 };
}
export async function declareOutcome(u, ctx, a) {
  const p = { attendance: a.attendance, decision: a.decision || "", reason_code: a.reason_code || "", next_step: a.next_step || "", amount_sold: a.amount_sold != null ? String(a.amount_sold) : "",
    currency: a.currency || (a.amount_sold != null ? "EUR" : ""), product: a.product || "", payment_plan: a.payment_plan || "", nurture: a.nurture || "", return_date: a.return_date || "", note: a.note || "" };
  const r = await u.rpc("crm_declare_outcome", { p_call: a.call_id, p });
  need(!r.error, r.error ? "Not saved: " + r.error.message : "");
  return { text: "Outcome declared: " + a.attendance + (a.decision ? " · " + a.decision : "") + (a.reason_code ? " (" + a.reason_code + ")" : "") + ". The cycle is recomputed.", rows: 1 };
}

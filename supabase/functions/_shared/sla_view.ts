// The Sales cycle model of one cycle for the SLA rules (sla_rules.js): the same event kinds as SKL_CRM.salesCycleView
// (skl-os/crm/data.js) builds for the screen, reduced to what the rules read. t = hours since the cycle opened.
export type Ev = { t: number; w: "s" | "p" | "a"; k: string; r?: number; dur?: number; yes?: number; no?: number; fu?: number; rec?: number; ana?: number; stop?: number };
export type Snap = {
  id: string; opened_at: string; person?: string; owner?: string; owner_key?: string;
  events: { type: string; at: string; actor?: string; channel?: string; call_id?: string; source?: string }[];
  calls: { id: string; rank: number; status: string; start?: string; end?: string }[];
};

export function toLead(c: Snap, now: number) {
  const opened = Date.parse(c.opened_at), H = 3600e3, t = (iso: string) => Math.max(0, (Date.parse(iso) - opened) / H);
  const rank: Record<string, number> = {}, ev: Ev[] = [];
  (c.calls || []).forEach((k) => { rank[k.id] = k.rank; });
  const paid = (c.events || []).some((e) => e.type === "payment_succeeded");
  // DO-2 / DE-2: when each call got its Fathom recording and its analysis (the first of each)
  const rec: Record<string, number> = {}, ana: Record<string, number> = {};
  for (const e of c.events || []) {
    if (!e.call_id) continue;
    if (e.type === "call_recorded" && rec[e.call_id] === undefined) rec[e.call_id] = t(e.at);
    if (e.type === "analysis_ready" && ana[e.call_id] === undefined) ana[e.call_id] = t(e.at);
  }
  for (const e of c.events || []) {
    const at = t(e.at), r = (e.call_id && rank[e.call_id]) || 1, sms = e.channel === "sms", auto = e.actor === "auto" || e.actor === "system";
    switch (e.type) {
      case "call_booked": case "call_rescheduled": ev.push({ t: at, w: "p", k: "booked", r }); break;
      case "message_in": ev.push({ t: at, w: "p", k: sms ? "sms" : "im" }); break;
      case "message_out": ev.push(auto ? { t: at, w: "a", k: "remind" } : { t: at, w: "s", k: sms ? "sms" : "im" }); break;
      case "phone_call_in": ev.push({ t: at, w: "p", k: "call" }); break;
      case "phone_call_out": ev.push({ t: at, w: "s", k: "call" }); break;
      case "payment_succeeded": ev.push({ t: at, w: "p", k: "paid" }); break;
      case "checkout_created": ev.push({ t: at, w: "s", k: "paylink" }); break;
      case "opt_out": ev.push({ t: at, w: "a", k: "note", stop: 1 }); break;
      case "outcome_yes": ev.push({ t: at, w: "s", k: "decision", yes: 1, r }); break;
      case "outcome_follow_up": ev.push({ t: at, w: "s", k: "decision", fu: 1, r }); break;
      case "outcome_no": case "outcome_disqualified": ev.push({ t: at, w: "s", k: "decision", no: 1, r }); break;
      case "cycle_lost": case "cycle_disqualified":
        if (!ev.some((x) => x.k === "decision" && x.no)) ev.push({ t: at, w: "s", k: "decision", no: 1 }); break;
      case "cycle_won":
        ev.push({ t: at, w: "s", k: "decision", yes: 1 });
        if (!paid) ev.push({ t: at, w: "p", k: "paid" }); break;
    }
  }
  const age = Math.max(0, (now - opened) / H);
  for (const k of c.calls || []) {
    if (!k.start || k.status === "canceled") continue;
    const s = t(k.start), end = k.end ? Date.parse(k.end) : null, dur = end ? Math.round((end - Date.parse(k.start)) / 60e3) : undefined;
    if (k.status === "held") ev.push({ t: s, w: "s", k: "meet", r: k.rank, dur, rec: rec[k.id], ana: ana[k.id] });
    else if (k.status === "no_show") ev.push({ t: s, w: "p", k: "noshow", r: k.rank });
    else if (k.status === "missed") continue;   // 030: an R2+ not held is to reschedule, not an outcome to declare
    else if (k.status === "outcome_pending" || (end ? end < now : s < age)) ev.push({ t: s, w: "s", k: "meetdue", r: k.rank, dur });
    else ev.push({ t: s, w: "s", k: "meet", r: k.rank, dur });
  }
  ev.sort((a, b) => a.t - b.t);
  return { id: c.id, age, ev, opened, rec: true };
}

// the Slack text of the new misses (in French, LNP 2026-11-03), most critical first; the link opens the CRM
export function slackText(items: { level: string; sla: string; name: string; person: string; owner: string; elapsed: string; extra: string; target: string; kind?: string }[], link: string) {
  const L = items.slice().sort((a, b) => (a.level === b.level ? 0 : a.level === "crit" ? -1 : 1)).map((x) =>
    `${x.level === "crit" ? ":red_circle: *Critique*" : ":large_orange_circle: *En retard*"}${x.kind === "tech" ? " (technique)" : ""} · ${x.sla} ${x.name} · *${x.person}* (${x.owner}) · ${x.elapsed} ${x.extra}, objectif ${x.target}`);
  return `${items.length} SLA du cycle de vente dépassé${items.length > 1 ? "s" : ""}\n` + L.join("\n") + `\n<${link}|Ouvrir le cycle de vente>`;
}

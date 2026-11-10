// An in-memory stand-in for @supabase/supabase-js, for the connector tests only (web/tests/connector.test.js).
// It keeps the subset of the query builder the API uses and emulates the CRM's row-level security (003_crm_core.sql):
// admins, sales leads and viewers see every cycle, a sales rep only the cycles they own; OAuth tables are service-role
// only. Auth: password sign-in, access tokens, single-use rotating refresh tokens, sign-out.
import { randomUUID } from "node:crypto";

export const DB = globalThis.__FAKE_DB || (globalThis.__FAKE_DB = { tables: {}, users: [], access: new Map(), refresh: new Map(), seq: 1 });
export function reset() { DB.tables = {}; DB.users = []; DB.access = new Map(); DB.refresh = new Map(); DB.seq = 1; }
export const SERVICE_KEY = "service-key", ANON_KEY = "anon-key";
const T = n => (DB.tables[n] = DB.tables[n] || []);

function newSession(user) {
  const access_token = "at-" + randomUUID(), refresh_token = "rt-" + randomUUID();
  DB.access.set(access_token, user.id); DB.refresh.set(refresh_token, user.id);
  return { access_token, refresh_token, expires_in: 3600, token_type: "bearer", user };
}

// ---------------- row-level security ----------------
function crmRole(uid) { const m = T("crm_members").find(x => x.id === uid && x.active); return m ? m.role : null; }
function seesAll(uid) { return ["admin", "sales_lead", "viewer"].includes(crmRole(uid)); }
function cycleVisible(uid, cid) { const c = T("crm_cycles").find(x => x.id === cid); return !!c && (seesAll(uid) || c.owner_id === uid); }
function visible(table, row, who) {
  if (who.service) return true;
  const uid = who.uid; if (!uid) return false;
  const member = T("members").some(m => m.user_id === uid);
  switch (table) {
    case "members": case "docs": return member;
    case "crm_members": case "crm_stage_definitions": case "crm_reason_codes": return !!crmRole(uid) || member;
    case "crm_settings": return true;   // 003: read_config4, any signed-in user
    case "crm_cycles": return seesAll(uid) || row.owner_id === uid;
    case "crm_calls": case "crm_deals": case "crm_payments": case "crm_stage_history": return cycleVisible(uid, row.cycle_id);
    case "crm_events": return seesAll(uid) || (row.cycle_id ? cycleVisible(uid, row.cycle_id) : false);
    case "crm_people": return seesAll(uid) || T("crm_cycles").some(c => c.person_id === row.id && c.owner_id === uid);
    case "crm_person_identities": return seesAll(uid) || T("crm_cycles").some(c => c.person_id === row.person_id && c.owner_id === uid);
    case "crm_alerts": return seesAll(uid) || row.owner_id === uid;
    case "crm_sla_alerts": return crmRole(uid) === "admin" || (row.owner_id === uid && row.kind !== "tech");
    case "crm_call_analyses": { const k = T("crm_calls").find(x => x.id === row.call_id); return !!k && cycleVisible(uid, k.cycle_id); }
    // call analysis (020): CRM admins and the owner of the call's cycle
    case "crm_ca_records": case "crm_ca_jobs": case "crm_ca_results": {
      const k = T("crm_calls").find(x => x.id === row.call_id), c = k && T("crm_cycles").find(x => x.id === k.cycle_id);
      return crmRole(uid) === "admin" || (!!c && c.owner_id === uid); }
    case "crm_audit_log": return crmRole(uid) === "admin";
    default: return false;   // mcp_oauth_* and anything else: service role only
  }
}

// ---------------- query builder ----------------
function likeRe(p) {
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) { re += p[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    re += c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$", "i");
}
function parseSelect(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of String(s || "*")) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out.map(x => { const m = /^(\w+):(\w+)\((.*)\)$/.exec(x); return m ? { alias: m[1], table: m[2], cols: m[3] } : { col: x }; });
}
const FK = { crm_people: "person_id" };
function project(table, row, sel, who) {
  const parts = parseSelect(sel), o = {};
  parts.forEach(p => {
    if (p.col === "*") Object.assign(o, row);
    else if (p.col) o[p.col] = row[p.col] === undefined ? null : row[p.col];
    else { const r = T(p.table).find(x => x.id === row[FK[p.table]]); o[p.alias] = r && visible(p.table, r, who) ? project(p.table, r, p.cols, who) : null; }
  });
  return o;
}

class Query {
  constructor(table, who) { this.table = table; this.who = who; this.f = []; this.op = "select"; this.sel = "*"; this.ord = []; }
  select(cols, opts) { if (this.op === "select") this.sel = cols || "*"; else this.ret = cols || "*"; this.opts = opts || {}; return this; }
  insert(rows) { this.op = "insert"; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(row) { this.op = "upsert"; this.rows = [row]; return this; }
  update(v) { this.op = "update"; this.vals = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.f.push(r => r[c] === v); return this; }
  neq(c, v) { this.f.push(r => r[c] !== v); return this; }
  in(c, a) { this.f.push(r => a.includes(r[c])); return this; }
  ilike(c, p) { const re = likeRe(p); this.f.push(r => r[c] != null && re.test(String(r[c]))); return this; }
  gt(c, v) { this.f.push(r => r[c] != null && r[c] > v); return this; }
  gte(c, v) { this.f.push(r => r[c] != null && r[c] >= v); return this; }
  lt(c, v) { this.f.push(r => r[c] != null && r[c] < v); return this; }
  lte(c, v) { this.f.push(r => r[c] != null && r[c] <= v); return this; }
  is(c, v) { this.f.push(r => (r[c] == null) === (v === null)); return this; }
  order(c, o) { this.ord.push([c, !o || o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  maybeSingle() { this._one = "maybe"; return this; }
  single() { this._one = "one"; return this; }
  run() {
    const all = T(this.table);
    // docs: admins and members write, viewers do not (001_init.sql)
    const docWriter = () => this.who.service || T("members").some(m => m.user_id === this.who.uid && (m.role === "admin" || m.role === "member"));
    if (this.op === "upsert") {
      if (this.table !== "docs" || !docWriter()) return { data: null, error: { message: "new row violates row-level security policy", code: "42501" } };
      const r = this.rows[0], cur = all.find(x => x.col === r.col && x.id === r.id);
      if (cur) Object.assign(cur, r, { updated_by: this.who.uid }); else all.push(Object.assign({}, r, { updated_by: this.who.uid }));
      return { data: null, error: null };
    }
    if (this.op === "delete" && this.table === "docs" && !docWriter()) return { data: null, error: null };
    if (this.op === "insert") {
      if (!this.who.service && !["crm_audit_log"].includes(this.table)) return { data: null, error: { message: "permission denied for table " + this.table, code: "42501" } };
      for (const r of this.rows) {
        const pk = r.client_id || r.code_hash;
        if (pk && all.some(x => (x.client_id || x.code_hash) === pk && this.table.startsWith("mcp_oauth_") && (this.table === "mcp_oauth_clients" ? x.client_id === r.client_id : x.code_hash === r.code_hash))) return { data: null, error: { message: "duplicate key", code: "23505" } };
        all.push(Object.assign({ created_at: new Date().toISOString() }, r));
      }
      return { data: null, error: null };
    }
    let list = all.filter(r => visible(this.table, r, this.who) && this.f.every(fn => fn(r)));
    if (this.op === "delete") {
      DB.tables[this.table] = all.filter(r => !list.includes(r));
      return { data: this.ret ? list.map(r => project(this.table, r, this.ret, this.who)) : null, error: null };
    }
    if (this.op === "update") { list.forEach(r => Object.assign(r, this.vals)); return { data: null, error: null }; }
    for (const [c, asc] of this.ord.slice().reverse()) list = list.slice().sort((a, b) => (a[c] == null) - (b[c] == null) || (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
    const count = list.length;
    if (this.rng) list = list.slice(this.rng[0], Math.min(this.rng[1] + 1, this.rng[0] + 1000));
    else list = list.slice(0, 1000);
    if (this.lim != null) list = list.slice(0, this.lim);
    if (this.opts && this.opts.head) return { data: null, count, error: null };
    const data = list.map(r => project(this.table, r, this.sel, this.who));
    if (this._one) { if (this._one === "one" && data.length !== 1) return { data: null, error: { message: "not one row" } }; return { data: data[0] || null, error: null }; }
    return { data, count: this.opts && this.opts.count ? count : null, error: null };
  }
  then(ok, ko) { return Promise.resolve().then(() => this.run()).then(ok, ko); }
}

// ---------------- RPCs used by the connector (014_mcp.sql) ----------------
function rpc(who, fn, args) {
  const uid = who.uid;
  if (fn === "crm_mcp_call") {
    if (!crmRole(uid)) return { data: null, error: { message: "No CRM role", code: "42501" } };
    const since = new Date(Date.now() - 60e3).toISOString();
    if (T("crm_audit_log").filter(r => r.actor_id === uid && r.action.startsWith("mcp:") && r.at > since).length >= 60) return { data: null, error: { message: "Too many requests", code: "P0M60" } };
    const id = DB.seq++;
    T("crm_audit_log").push({ id, actor_id: uid, action: "mcp:" + args.p_tool, entity: "mcp", entity_id: args.p_tool, after: { input: args.p_input }, at: new Date().toISOString() });
    return { data: id, error: null };
  }
  if (fn === "crm_mcp_done") {
    const r = T("crm_audit_log").find(x => x.id === args.p_id && x.actor_id === uid);
    if (r) Object.assign(r.after, { rows: args.p_rows, ms: args.p_ms }, args.p_error ? { error: args.p_error } : {});
    return { data: null, error: null };
  }
  if (fn === "crm_add_note") {
    if (!crmRole(uid) || crmRole(uid) === "viewer") return { data: null, error: { message: "Not allowed" } };
    const cy = T("crm_cycles").find(c => c.id === args.p_cycle && (seesAll(uid) || c.owner_id === uid));
    if (!cy) return { data: null, error: { message: "Unknown cycle" } };
    if (!String(args.p_text || "").trim()) return { data: null, error: { message: "Empty note" } };
    T("crm_events").push({ id: DB.seq++, cycle_id: cy.id, person_id: cy.person_id, type: "note", content: args.p_text.trim(), actor: "sales", channel: "crm", source: "crm", occurred_at: new Date().toISOString(), data: {} });
    return { data: DB.seq, error: null };
  }
  if (fn === "crm_declare_outcome") {
    const k = T("crm_calls").find(c => c.id === args.p_call); const p = args.p || {};
    if (!k || !cycleVisible(uid, k.cycle_id)) return { data: null, error: { message: "Unknown call" } };
    if (p.attendance === "held" && !p.decision) return { data: null, error: { message: "A held call needs a decision" } };
    if ((p.decision === "no" || p.decision === "disqualified") && !p.reason_code) return { data: null, error: { message: "A reason is required for " + p.decision } };
    const cy = T("crm_cycles").find(c => c.id === k.cycle_id);
    T("crm_events").push({ id: DB.seq++, cycle_id: cy.id, call_id: k.id, person_id: cy.person_id, type: "outcome_" + (p.decision || p.attendance), actor: "sales", channel: "crm", source: "crm", occurred_at: new Date().toISOString(), data: p });
    return { data: "o" + DB.seq, error: null };
  }
  return { data: null, error: { message: "unknown function " + fn } };
}

export function createClient(url, key, opts) {
  const hdr = opts && opts.global && opts.global.headers && opts.global.headers.Authorization;
  const token = hdr ? hdr.replace(/^Bearer\s+/, "") : null;
  const who = key === SERVICE_KEY ? { service: true } : { uid: token ? DB.access.get(token) || null : null };
  let mySession = null;
  return {
    from: t => new Query(t, who),
    rpc: async (fn, args) => rpc(who, fn, args || {}),
    auth: {
      getUser: async t => { const id = DB.access.get(t); const u = DB.users.find(x => x.id === id); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } }; },
      signInWithPassword: async ({ email, password }) => {
        const u = DB.users.find(x => x.email === email && x.password === password);
        if (!u) return { data: { session: null, user: null }, error: { message: "Invalid login credentials" } };
        mySession = newSession(u); return { data: { session: mySession, user: u }, error: null };
      },
      refreshSession: async ({ refresh_token }) => {
        const id = DB.refresh.get(refresh_token); const u = DB.users.find(x => x.id === id);
        DB.refresh.delete(refresh_token);
        if (!u) return { data: { session: null, user: null }, error: { message: "Invalid Refresh Token" } };
        mySession = newSession(u); return { data: { session: mySession, user: u }, error: null };
      },
      signOut: async () => { if (mySession) { DB.access.delete(mySession.access_token); DB.refresh.delete(mySession.refresh_token); } return { error: null }; },
      admin: {
        deleteUser: async id => { DB.users = DB.users.filter(u => u.id !== id); for (const [k, v] of DB.access) if (v === id) DB.access.delete(k); for (const [k, v] of DB.refresh) if (v === id) DB.refresh.delete(k); return { error: null }; }
      }
    }
  };
}

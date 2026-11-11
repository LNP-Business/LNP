// Simulateur · accès à la base (PostgREST, clé de service) et identité de l'appelant (jeton Supabase de la personne).
// Comme les autres fonctions de LNP : fetch seulement. Les filtres sont des égalités simples ({ colonne: valeur }) ; l'ordre et
// la limite sont des options. Une base en mémoire (tests) implémente la même interface.
export type Filtre = Record<string, string | number | boolean | null>;
export type Options = { order?: string; limit?: number; select?: string };
export interface Db {
  select<T = any>(table: string, filtre?: Filtre, opt?: Options): Promise<T[]>;
  insert<T = any>(table: string, rows: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]>;
  update<T = any>(table: string, filtre: Filtre, patch: Record<string, unknown>): Promise<T[]>;
  remove(table: string, filtre: Filtre): Promise<number>;
  rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

function qs(filtre: Filtre = {}, opt: Options = {}): string {
  const p = new URLSearchParams();
  p.set("select", opt.select || "*");
  for (const [k, v] of Object.entries(filtre)) p.set(k, v === null ? "is.null" : `eq.${v}`);
  if (opt.order) p.set("order", opt.order);
  if (opt.limit) p.set("limit", String(opt.limit));
  return p.toString();
}

export function dbRest(base: string, key: string, fetchFn: Fetch = fetch): Db {
  const h = (extra: Record<string, string> = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra });
  const ok = async (r: Response) => {
    if (!r.ok) throw new Error(`base ${r.status} ${(await r.text()).slice(0, 300)}`);
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  };
  return {
    async select(table, filtre, opt) { return await ok(await fetchFn(`${base}/rest/v1/${table}?${qs(filtre, opt)}`, { headers: h() })); },
    async insert(table, rows) {
      return await ok(await fetchFn(`${base}/rest/v1/${table}?select=*`, { method: "POST", headers: h({ Prefer: "return=representation" }), body: JSON.stringify(rows) }));
    },
    async update(table, filtre, patch) {
      return await ok(await fetchFn(`${base}/rest/v1/${table}?${qs(filtre)}`, { method: "PATCH", headers: h({ Prefer: "return=representation" }), body: JSON.stringify(patch) }));
    },
    async remove(table, filtre) {
      const rows = await ok(await fetchFn(`${base}/rest/v1/${table}?${qs(filtre, { select: "*" })}`, { method: "DELETE", headers: h({ Prefer: "return=representation" }) }));
      return Array.isArray(rows) ? rows.length : 0;
    },
    async rpc(fn, args) { return await ok(await fetchFn(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: h(), body: JSON.stringify(args) })); },
  };
}

export type Appelant = { id: string; email: string; role: string | null; admin: boolean };

// Le jeton de la personne → son compte (Supabase Auth), puis son rôle dans l'équipe (crm_members, actif). Sans rôle : refusé.
export async function appelant(base: string, key: string, jeton: string, db: Db, fetchFn: Fetch = fetch): Promise<Appelant | null> {
  if (!jeton) return null;
  const r = await fetchFn(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${jeton}` } });
  if (!r.ok) return null;
  const u = await r.json() as { id?: string; email?: string };
  if (!u.id) return null;
  const [m] = await db.select<{ role: string; active: boolean }>("crm_members", { id: u.id }, { select: "role,active" });
  const role = m && m.active ? m.role : null;
  if (!role) return null;
  return { id: u.id, email: u.email || "", role, admin: role === "admin" };
}

// Une base en mémoire pour les tests (même interface ; identifiants numériques pour les simulations et les messages)
export function dbMemoire(seed: Record<string, any[]> = {}): Db & { tables: Record<string, any[]> } {
  const tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed));
  let seq = 1000;
  const t = (n: string) => (tables[n] = tables[n] || []);
  const match = (row: any, f: Filtre = {}) => Object.entries(f).every(([k, v]) => (v === null ? row[k] == null : String(row[k]) === String(v)));
  const auto = (n: string, row: any) => {
    const r = { ...row };
    if (r.id === undefined) r.id = ["crm_sim_simulations", "crm_sim_messages"].includes(n) ? ++seq : crypto.randomUUID();
    const now = new Date(Date.now() + seq).toISOString();
    if (r.created_at === undefined) r.created_at = now;
    if (n === "crm_sim_simulations") Object.assign(r, { status: r.status ?? "active", started_at: r.started_at ?? now, usage: r.usage ?? {} });
    if (n === "crm_sim_analyses") r.cost = r.cost ?? {};
    return r;
  };
  return {
    tables,
    async select(n, f, o) {
      let rows = t(n).filter((r) => match(r, f));
      if (o?.order) {
        const [col, dir] = o.order.split(".");
        rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
      }
      if (o?.limit) rows = rows.slice(0, o.limit);
      return JSON.parse(JSON.stringify(rows));
    },
    async insert(n, rows) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => auto(n, r));
      t(n).push(...list);
      return JSON.parse(JSON.stringify(list));
    },
    async update(n, f, patch) {
      const out: any[] = [];
      for (const r of t(n)) if (match(r, f)) { Object.assign(r, patch); out.push(r); }
      return JSON.parse(JSON.stringify(out));
    },
    async remove(n, f) {
      const before = t(n).length;
      tables[n] = t(n).filter((r) => !match(r, f));
      return before - tables[n].length;
    },
    async rpc(fn) { throw new Error(`rpc ${fn} absent de la base en mémoire`); },
  };
}

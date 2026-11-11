// Simulateur · les offres et leurs prospects (portés de la création d'offre d'origine : lecture du site et des PDF, extraction de
// l'offre en 10 modules, matrice puis 6 prospects complets, écarts calculés par le code, voix). Réservé aux administrateurs.
// La création répond tout de suite (202, statut « extracting ») ; l'extraction puis la génération des prospects se font en tâche
// de fond (EdgeRuntime.waitUntil), l'écran suit le statut de l'offre (extracting → generating → ready, ou failed avec l'erreur).
// Écarts voulus avec l'origine : l'offre reçoit aussi les champs lus par les consignes du prospect (offer_identity, offer_details,
// tools_taught), la difficulté est rangée en moyen / difficile / expert, une régénération attribue les voix, les sources collées
// ou les PDF identiques renvoient l'offre existante (empreinte), et la lecture du site est bornée dans le temps.
import type { Appelant, Db } from "./base.ts";
import { erreur, json } from "./routes.ts";
import { appeler } from "./llm.ts";
import { choisirVoix, genreDuPrenom, VOIX } from "./voix.ts";
import { EXTRACTION, PERSONA_COMPLET, PERSONA_MATRICE } from "./prompts/prompts.ts";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type LecturePdf = (octets: Uint8Array) => Promise<{ text: string; pages: number }>;
export type DepsOffres = {
  db: Db;
  anthropicKey: string;
  fetchFn?: Fetch;                                  // modèle, lecteur de pages et site (tests : une fausse)
  waitUntil?: (p: Promise<unknown>) => void;        // EdgeRuntime.waitUntil
  now?: () => Date;
  lirePdf?: LecturePdf;                             // par défaut unpdf
  pause?: (ms: number) => Promise<void>;            // attentes entre deux essais (tests : aucune)
};

export const MODELE_OFFRES = "claude-sonnet-5-5";   // là où l'origine prenait Sonnet 4.5 ; pas de température
export const MAX_PDF = 10;
export const MAX_OCTETS_PDF = 20 * 1024 * 1024;
const MIN_TEXTE_PDF = 30;
const MAX_PAGES_SITE = 30;
const BUDGET_SITE_MS = 60_000;                      // la lecture du site s'arrête là, loin de la limite de la fonction
const ENCOURS = ["extracting", "generating"];

// ---------- petits outils ----------

export function sansNul(s: string): string { return s.replace(/\u0000/g, ""); }
export function sansNulProfond<T>(v: T): T {
  if (typeof v === "string") return sansNul(v) as T;
  if (Array.isArray(v)) return v.map(sansNulProfond) as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[sansNul(k)] = sansNulProfond(x);
    return o as T;
  }
  return v;
}

export function slug(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// La normalisation d'URL et la ressemblance des noms (offer-dedup d'origine)
export function normaliserUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

export function levenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase(), s2 = b.toLowerCase();
  const m: number[][] = [];
  for (let i = 0; i <= s1.length; i++) m[i] = [i];
  for (let j = 0; j <= s2.length; j++) m[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      m[i][j] = s1[i - 1] === s2[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[s1.length][s2.length];
}

export function nomsProches(a: string, b: string): boolean {
  const d = levenshtein(a, b);
  const max = Math.max(a.length, b.length);
  const sim = max === 0 ? 1 : 1 - d / max;
  return d < 3 || sim > 0.85;
}

// Garde contre les adresses internes : http(s) seulement, pas d'hôte local, privé ou de métadonnées
const HOTES_INTERDITS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254", "metadata.google.internal", "metadata"];
const PLAGES_PRIVEES = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./, /^127\./, /^0\./, /^169\.254\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^fc[0-9a-f]{0,2}:/i, /^fd/i, /^fe80:/i, /^::ffff:/i, /^::$/];
export function urlAutorisee(texte: string): { ok: true; url: URL } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(texte); } catch { return { ok: false, error: "URL invalide. Vérifiez le format (ex. : https://exemple.fr)." }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Seules les adresses HTTP et HTTPS sont autorisées." };
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const refus = { ok: false as const, error: "Cette adresse n'est pas accessible." };
  if (!h || HOTES_INTERDITS.includes(h) || PLAGES_PRIVEES.some((p) => p.test(h))) return refus;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost") || !h.includes(".")) return refus;
  // une adresse IP écrite autrement (2130706433, 127.1, 0x7f.1, 010.0.0.1) : refusée
  if (/^[0-9a-fx.]+$/i.test(h) && /^[0-9x.]+$/i.test(h.replace(/[a-f]/gi, "")) && /\d/.test(h) && !/[g-wyz]/i.test(h)) {
    if (!/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(h)) return refus;
  }
  if (u.username || u.password) return refus;
  return { ok: true, url: u };
}

// La réponse du modèle : sans les ``` autour, puis JSON.parse (cleanJsonResponse d'origine)
export function lireJson(texte: string): any {
  let t = texte.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return JSON.parse(t.trim());
}
const erreurJson = (e: unknown) => { const m = String((e as Error)?.message ?? ""); return m.includes("JSON") || m.includes("parse") || m.includes("Unexpected token"); };

// ${nom} → valeur (fillPromptTemplate d'origine) ; une variable inconnue reste telle quelle
export function remplir(modele: string, vars: Record<string, string>): string {
  return modele.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// La difficulté générée (2, 3, 4, 5) dans les trois niveaux de l'écran (l'origine rangeait « 2/4/5 », affichés « Moyen »)
export function difficulteDe(v: unknown): "moyen" | "difficile" | "expert" | null {
  if (v === "moyen" || v === "difficile" || v === "expert") return v;
  const n = Number(String(v ?? "").match(/\d/)?.[0]);
  if (!Number.isFinite(n) || n < 1) return null;
  return n >= 5 ? "expert" : n === 4 ? "difficile" : "moyen";
}

const prixTexte = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} €`;

// Les champs lus par les consignes du prospect (persona-generated-full.ts), tirés des modules extraits : à l'origine ils
// n'existaient pas, et le prospect ne connaissait ni l'entreprise ni le prix
// deno-lint-ignore no-explicit-any
export function adapterOffre(v3: any, nom: string, prixDeLOffre: string | null): Record<string, unknown> {
  const id = v3?.identity || {};
  const st = v3?.offer_structure || {};
  const pr = v3?.pricing || {};
  const prixExtrait = typeof pr.main_offer?.price === "number" && pr.main_offer.price > 0 ? pr.main_offer.price : null;
  const duree = typeof st.duration === "string" ? st.duration : st.duration?.total;
  return {
    offer_identity: {
      company_name: id.company?.name || nom,
      main_promise: v3?.value_proposition?.main_promise ?? null,
      positioning: id.positioning ?? null,
    },
    offer_details: {
      main_offer: {
        price: (prixExtrait !== null ? (pr.main_offer.price_display || prixTexte(prixExtrait)) : null) ?? prixDeLOffre ?? pr.main_offer?.price_display ?? null,
        duration: duree ?? null,
        financing_options: Array.isArray(pr.financing_options) ? pr.financing_options.map((f: any) => f?.name).filter(Boolean) : [],
      },
    },
    tools_taught: Array.isArray(st.tools_taught)
      ? st.tools_taught.map((t: any) => ({ name: typeof t === "string" ? t : t?.name })).filter((t: { name?: string }) => t.name)
      : [],
  };
}

// Les écarts du prospect, calculés par le code (calculatePersonaGaps d'origine)
// deno-lint-ignore no-explicit-any
export function calculerEcarts(persona: any): any {
  if (!persona?.identite) return persona;
  const caActuelStr = persona.identite.ca_actuel;
  const objectifCaStr = persona.identite.objectif_ca;
  if (!caActuelStr || !objectifCaStr) return persona;
  const caActuel = parseFloat(String(caActuelStr).replace(/[^\d]/g, ""));
  const objectifCa = parseFloat(String(objectifCaStr).replace(/[^\d]/g, ""));
  if (!Number.isFinite(caActuel) || !Number.isFinite(objectifCa) || objectifCa <= caActuel) return persona;
  const ecartMensuel = objectifCa - caActuel;
  const coutAnnuelInaction = ecartMensuel * 12;
  if (persona.briefing?.diagnostic?.gap) {
    Object.assign(persona.briefing.diagnostic.gap, { actuel: caActuel, cible: objectifCa, ecart_mensuel: ecartMensuel, cout_annuel_inaction: coutAnnuelInaction });
  }
  if (persona.objectionsMode?.gap) {
    persona.objectionsMode.gap.financier = `~${coutAnnuelInaction.toLocaleString("fr-FR")} euros/an de manque à gagner`;
    persona.objectionsMode.gap.total = `~${Math.round(coutAnnuelInaction * 1.1).toLocaleString("fr-FR")} euros/an`;
  }
  return persona;
}

// ---------- PDF ----------

// unpdf, chargé seulement quand un PDF arrive (spécificateur littéral : empaqueté au déploiement)
const lirePdfUnpdf: LecturePdf = async (octets) => {
  const { extractText, getDocumentProxy } = await import("npm:unpdf@1.8.1");
  const pdf = await getDocumentProxy(octets);
  const r = await extractText(pdf, { mergePages: true });
  return { text: String(r.text ?? ""), pages: Number(r.totalPages ?? 0) };
};

export type FichierLu = { filename: string; size: number; success: boolean; charCount: number; pages: number; text: string; error?: string };

export function tailleBase64(b64: string): number {
  const s = b64.replace(/\s/g, "");
  return Math.max(0, Math.floor(s.length * 3 / 4) - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0));
}

function decoder(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const mo = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / (1024 * 1024));

export async function lireUnPdf(f: { filename?: unknown; base64?: unknown }, lire: LecturePdf): Promise<FichierLu> {
  const filename = typeof f?.filename === "string" && f.filename.trim() ? f.filename.trim().slice(0, 200) : "fichier.pdf";
  const brut = typeof f?.base64 === "string" ? f.base64.replace(/^data:[^,]*,/, "") : "";
  const size = tailleBase64(brut);
  const echec = (error: string, pages = 0): FichierLu => ({ filename, size, success: false, charCount: 0, pages, text: "", error });
  if (size > MAX_OCTETS_PDF) return echec(`Fichier ignoré : « ${filename} » dépasse 20 Mo (taille reçue : ${mo(size)} Mo).`);
  let octets: Uint8Array;
  try { octets = decoder(brut); } catch { return echec(`Fichier ignoré : « ${filename} » n'est pas un PDF.`); }
  const entete = String.fromCharCode(...octets.slice(0, 5));
  if (!filename.toLowerCase().endsWith(".pdf") && entete !== "%PDF-") return echec(`Fichier ignoré : « ${filename} » n'est pas un PDF.`);
  try {
    const r = await lire(octets);
    const propre = sansNul((r.text || "").trim().replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n"));
    if (propre.length < MIN_TEXTE_PDF) return echec("Aucun texte exploitable n'a pu être extrait de ce PDF (peut-être un PDF scanné ou une image).", r.pages || 0);
    return { filename, size, success: true, charCount: propre.length, pages: r.pages || 0, text: propre };
  } catch (e) {
    return echec(`Lecture du PDF impossible : ${(e as Error)?.message || "erreur inconnue"}`);
  }
}

// ---------- le site (Jina d'abord, puis les pages du même domaine) ----------

const EXT_EXCLUES = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".mp4", ".mp3", ".zip", ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".ico"];
const MOTS_EXCLUS = ["login", "logout", "cart", "checkout", "account", "wp-admin", "wp-content", "wp-json", "feed", "#", "mailto:", "tel:",
  "javascript:", "/tag/", "/author/", "/page/", "/category/", "/archive/", "/search/", "privacy", "legal", "mentions-legales",
  "politique-de-confidentialite", "cgu", "cgv"];

export function normaliserLien(url: string): string {
  let n = url.split("#")[0].replace(/\/$/, "");
  n = n.replace(/\?utm_[^&]*(&|$)/g, "").replace(/\?fbclid=[^&]*(&|$)/g, "").replace(/\?gclid=[^&]*(&|$)/g, "");
  return n;
}

export function lienValide(url: string, domaine: string): boolean {
  try {
    const p = new URL(url);
    if (p.hostname !== domaine) return false;
    const l = url.toLowerCase();
    if (EXT_EXCLUES.some((e) => l.endsWith(e))) return false;
    if (MOTS_EXCLUS.some((m) => l.includes(m))) return false;
    return urlAutorisee(url).ok;
  } catch {
    return false;
  }
}

export function liens(html: string, courant: string, domaine: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const href = m[1] ?? m[2] ?? m[3];
    if (!href) continue;
    try {
      const n = normaliserLien(new URL(href, courant).toString());
      if (lienValide(n, domaine)) out.add(n);
    } catch { /* lien illisible */ }
  }
  return [...out];
}

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };
function entites(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const c = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
    return ENTITES[e.toLowerCase()] ?? m;
  });
}

// Le texte d'une page HTML (fetchWithCheerio d'origine : sans scripts, styles, menus, pieds de page ni formulaires)
export function htmlVersTexte(html: string): string {
  let h = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const t of ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "form"]) {
    h = h.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}>`, "gi"), " ");
  }
  const texte = (s: string) => entites(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const title = texte(h.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const h1 = texte(h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const corps = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? h.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    h.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? h;
  return `Title: ${title}\nH1: ${h1}\n\n${texte(corps)}`;
}

function titreDe(contenu: string): string {
  for (const l of contenu.split("\n")) {
    if (l.startsWith("# ")) return l.slice(2).trim();
    if (l.startsWith("Title:")) return l.slice(6).trim();
    if (l.startsWith("H1:") && l.length > 4) return l.slice(3).trim();
  }
  return "Sans titre";
}

export type Site = { rawContent: string; pagesCount: number; wordCount: number; url: string };

export async function lireSite(url: string, fetchFn: Fetch, pause: (ms: number) => Promise<void>): Promise<Site> {
  const debut = Date.now();
  const reste = () => BUDGET_SITE_MS - (Date.now() - debut);
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  // une page, redirections suivies à la main (chacune repasse la garde)
  const html = async (u: string): Promise<string | null> => {
    let cible = u;
    for (let saut = 0; saut < 4; saut++) {
      if (!urlAutorisee(cible).ok || reste() < 1000) return null;
      try {
        const r = await fetchFn(cible, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(Math.min(10_000, reste())) });
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { cible = new URL(r.headers.get("location")!, cible).toString(); await r.body?.cancel(); continue; }
        if (!r.ok) { await r.body?.cancel(); return null; }
        const type = r.headers.get("content-type") || "text/html";
        if (!/html|text/i.test(type)) { await r.body?.cancel(); return null; }
        return (await r.text()).slice(0, 2_000_000);
      } catch { return null; }
    }
    return null;
  };
  const jina = async (u: string): Promise<string | null> => {
    try {
      const r = await fetchFn(`https://r.jina.ai/${u}`, { headers: { Accept: "text/plain" }, signal: AbortSignal.timeout(Math.max(1000, Math.min(20_000, reste()))) });
      if (!r.ok) { await r.body?.cancel(); return null; }
      const t = await r.text();
      return t && t.trim() ? t.slice(0, 2_000_000) : null;
    } catch { return null; }
  };

  const base = normaliserLien(url);
  const domaine = new URL(base).hostname;
  const pages: { url: string; title: string; content: string }[] = [];
  const garder = (u: string, contenu: string | null) => {
    if (!contenu || contenu.length < 100) return;
    const c = sansNul(contenu);
    pages.push({ url: u, title: sansNul(titreDe(c)), content: c });
  };

  // 1. la page donnée, par le lecteur de pages (texte propre), sinon directement
  const accueil = await html(base);
  const lu = await jina(base);
  garder(base, lu && lu.length >= 100 ? lu : accueil ? htmlVersTexte(accueil) : null);

  // 2. les autres pages du même domaine (30 en tout au plus), par petits groupes avec une courte pause
  const vues = new Set<string>([base]);
  const file: string[] = accueil ? liens(accueil, base, domaine).filter((l) => !vues.has(l)) : [];
  while (file.length && vues.size < MAX_PAGES_SITE && reste() > 3000) {
    const lot = file.splice(0, 4).filter((l) => !vues.has(l)).slice(0, MAX_PAGES_SITE - vues.size);
    lot.forEach((l) => vues.add(l));
    const lus = await Promise.all(lot.map(async (l) => ({ l, h: await html(l) })));
    for (const { l, h } of lus) {
      if (!h) continue;
      garder(l, htmlVersTexte(h));
      for (const n of liens(h, l, domaine)) if (!vues.has(n) && !file.includes(n) && file.length < 200) file.push(n);
    }
    if (file.length) await pause(200);
  }

  return {
    url,
    pagesCount: pages.length,
    wordCount: pages.reduce((n, p) => n + p.content.split(/\s+/).length, 0),
    rawContent: pages.map((p) => `## ${p.title}\nURL: ${p.url}\n\n${p.content}\n\n${"=".repeat(80)}`).join("\n\n"),
  };
}

// ---------- l'extraction de l'offre (10 modules en parallèle) ----------

const MODULES = [
  { id: "identity", prompt: "extraction-1-identity", critical: true },
  { id: "value_proposition", prompt: "extraction-2-value-proposition", critical: true },
  { id: "target_audience", prompt: "extraction-3-target-audience", critical: true },
  { id: "offer_structure", prompt: "extraction-4-offer-structure", critical: false },
  { id: "pricing", prompt: "extraction-5-pricing", critical: true },
  { id: "social_proof", prompt: "extraction-6-social-proof", critical: false },
  { id: "common_objections", prompt: "extraction-7-common-objections", critical: true },
  { id: "buyer_journey", prompt: "extraction-8-buyer-journey", critical: false },
  { id: "sales_context", prompt: "extraction-9-sales-context", critical: false },
  { id: "content_for_simulation", prompt: "extraction-10-content-for-simulation", critical: true },
] as const;

type Source = { id?: string; type: string; url?: string; filename?: string; extracted_text?: string; [k: string]: unknown };

export function contenuDesSources(sources: Source[]): string {
  return sources.filter((s) => typeof s.extracted_text === "string" && s.extracted_text.trim())
    .map((s) => `SOURCE: ${s.url || s.filename || "source"}\n---\n${s.extracted_text}`).join("\n\n========\n\n");
}

// ---------- les routes ----------

export function routesOffres(d: DepsOffres) {
  const fetchFn: Fetch = d.fetchFn ?? ((u, i) => fetch(u, i));
  const now = d.now ?? (() => new Date());
  const pause = d.pause ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const lirePdf = d.lirePdf ?? lirePdfUnpdf;
  const enFond = async (p: Promise<unknown>) => { if (d.waitUntil) d.waitUntil(p); else await p; };
  const maintenant = () => now().toISOString();

  async function lire(req: Request): Promise<Record<string, any> | null> {
    try { const t = await req.text(); const v = t ? JSON.parse(t) : {}; return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
  }

  // une offre sans le texte de ses sources (il peut être long)
  const legere = (o: any) => o && { ...o, sources: Array.isArray(o.sources) ? o.sources.map(({ extracted_text: _t, ...s }: any) => s) : [] };

  async function majOffre(id: string, patch: Record<string, unknown>) {
    return (await d.db.update("crm_sim_offers", { id }, sansNulProfond({ ...patch, updated_at: maintenant() })))[0];
  }

  // Un appel au modèle qui doit rendre du JSON : 3 essais, attente de 1 s puis 2 s après un JSON illisible
  async function appelJson(p: { system?: string; user: string; maxTokens: number }, valider?: (v: any) => void): Promise<any> {
    let derniere: unknown = null;
    for (let essai = 1; essai <= 3; essai++) {
      try {
        const r = await appeler(d.anthropicKey, { model: MODELE_OFFRES, system: p.system, user: p.user, maxTokens: p.maxTokens }, fetchFn);
        const v = lireJson(r.text);
        valider?.(v);
        return v;
      } catch (e) {
        derniere = e;
        if (erreurJson(e) && essai < 3) { await pause(1000 * essai); continue; }
        throw e;
      }
    }
    throw derniere;
  }

  // Un module d'extraction : jamais d'exception, 3 essais quoi qu'il arrive (attente seulement après un JSON illisible)
  async function module(m: typeof MODULES[number], contenu: string): Promise<{ module: string; success: boolean; data: any; error?: string }> {
    const message = EXTRACTION[m.prompt].replace("${content}", () => contenu);
    let derniere = "";
    for (let essai = 1; essai <= 3; essai++) {
      try {
        const r = await appeler(d.anthropicKey, { model: MODELE_OFFRES, user: message, maxTokens: 4096 }, fetchFn);
        return { module: m.id, success: true, data: lireJson(r.text) };
      } catch (e) {
        derniere = String((e as Error)?.message ?? e);
        if (erreurJson(e) && essai < 3) await pause(1000 * essai);
      }
    }
    return { module: m.id, success: false, data: null, error: derniere };
  }

  // Les 10 modules, puis la synthèse (mergeResults + toOfferData d'origine)
  async function extraire(contenu: string): Promise<Record<string, any>> {
    const resultats = await Promise.all(MODULES.map((m) => module(m, contenu)));
    const resume = { overall_confidence: 0, sections_complete: [] as string[], sections_needing_review: [] as string[], critical_missing: [] as string[],
      ready_for_persona_generation: false, blocking_issues: [] as string[] };
    const data: Record<string, any> = {};
    const critiques: string[] = MODULES.filter((m) => m.critical).map((m) => m.id);
    let total = 0, n = 0;
    for (const r of resultats) {
      data[r.module] = null;
      if (r.success && r.data) {
        data[r.module] = r.data;
        const c = r.data._meta?.confidence;
        if (typeof c === "number") { total += c; n++; if (c >= 70) resume.sections_complete.push(r.module); }
        if (r.data._meta?.needs_review) resume.sections_needing_review.push(r.module);
      } else if (critiques.includes(r.module)) {
        resume.critical_missing.push(r.module);
        resume.blocking_issues.push(`Module critique « ${r.module} » en échec : ${r.error || "erreur inconnue"}`);
      }
    }
    resume.overall_confidence = n > 0 ? Math.round(total / n) : 0;
    resume.ready_for_persona_generation = critiques.every((id) => resume.sections_complete.includes(id)) && resume.blocking_issues.length === 0;
    data.extraction_summary = resume;
    return data;
  }

  // ---------- les prospects ----------

  // deno-lint-ignore no-explicit-any
  async function genererProspects(od: any, prix: number): Promise<any[]> {
    const cible = od?.target_audience?.ideal_profiles?.[0]?.label || od?.identity?.domain || "Professionnels en reconversion";
    const matrice = await appelJson({
      system: PERSONA_MATRICE.system,
      user: remplir(PERSONA_MATRICE.user, { offerData: JSON.stringify(od, null, 2), targetAudience: cible }),
      maxTokens: 2000,
    }, (v) => { if (!Array.isArray(v?.personas) || v.personas.length === 0) throw new Error("Matrice des prospects vide ou invalide"); });

    const identity = od?.identity || {}, company = identity.company || {}, fondateur = identity.founder || {};
    const vp = od?.value_proposition || {}, st = od?.offer_structure || {}, certif = st.certification || {}, duree = st.duration || {};
    const pr = od?.pricing || {}, sp = od?.social_proof || {}, cs = od?.content_for_simulation || {};
    const avant = od?.buyer_journey?.pre_call_knowledge || {}, objs = od?.common_objections || {};
    const liste = (a: unknown, f: (x: any) => string, vide: string) => Array.isArray(a) && a.length > 0 ? a.map(f).join("\n") : vide;
    const sait = [...(Array.isArray(avant.definitely_knows) ? avant.definitely_knows : []), ...(Array.isArray(avant.probably_knows) ? avant.probably_knows : [])];
    const fixes: Record<string, string> = {
      offerData: JSON.stringify(od, null, 2),
      price: String(prix),
      offer_id: "",
      company_name: company.name || "Non renseigné",
      founder: fondateur.story ? `${fondateur.name || "Non renseigné"} — ${fondateur.story}` : (fondateur.name || "Non renseigné"),
      positioning: identity.positioning || "Non renseigné",
      main_promise: vp.main_promise || "Non renseigné",
      duration: (typeof duree === "string" ? duree : duree.total) || "Non renseigné",
      format: st.format || "Non renseigné",
      certification: certif.name || "Aucune",
      financing_options: Array.isArray(pr.financing_options) ? pr.financing_options.map((f: any) => f?.name).filter(Boolean).join(", ") || "Aucune" : "Aucune",
      testimonials_list: liste(sp.testimonials, (t) => {
        const profil = t?.profile_after || t?.profile_before || "";
        return `- ${t?.name || "Anonyme"}${profil ? ` (${profil})` : ""} : "${t?.key_result || t?.quote || ""}"`;
      }, "Aucun témoignage renseigné"),
      key_numbers: liste(cs.key_numbers_to_remember, (k) => `- ${k?.full_phrase || `${k?.number || ""}${k?.context ? ` (${k.context})` : ""}`}`, "Aucun chiffre clé renseigné"),
      confusion_points: liste(cs.prospect_unclear_about, (p) => `- ${p}`, "Aucun point de confusion renseigné"),
      objections_typical: liste(objs.objections, (o) =>
        `- "${o?.surface_objection || ""}" (type: ${o?.category || "autre"}${o?.underlying_reason ? `, vraie raison: ${o.underlying_reason}` : ""})`, "Aucune objection typique renseignée"),
      what_they_know: sait.length > 0 ? sait.map((s) => `- ${s}`).join("\n") : "Non renseigné",
      what_they_dont_understand: liste(avant.unclear_points, (s) => `- ${s}`, "Non renseigné"),
      tools_list: liste(st.tools_taught, (t) => typeof t === "string" ? `- ${t}` : `- ${t?.name || ""}${t?.category ? ` (${t.category})` : ""}${t?.use_case ? ` : ${t.use_case}` : ""}`, "Aucun outil renseigné"),
    };

    const personas = await Promise.all(matrice.personas.map((item: any) => appelJson({
      system: PERSONA_COMPLET.system,
      user: remplir(PERSONA_COMPLET.user, {
        ...fixes,
        prenom: String(item?.prenom ?? ""), gender: item?.gender || "M", genre: item?.gender || "M", age: String(item?.age ?? ""),
        ville: String(item?.ville ?? ""), metier: String(item?.metier ?? ""), situation_familiale: String(item?.situation_familiale ?? ""),
        conscience: String(item?.conscience ?? ""), difficulte: String(item?.difficulte ?? ""), contexte_1_ligne: String(item?.contexte_1_ligne ?? ""),
        trauma_passe: item?.trauma_passe || "Aucun trauma particulier",
      }),
      maxTokens: 8000,
    }, (p) => { if (!p?.id || !p?.identite || !p?.objections) throw new Error(`Structure de prospect invalide pour ${item?.prenom}`); })
      .then((p) => ({ persona: calculerEcarts(p), item }))));
    return personas;
  }

  // Le prix envoyé aux consignes du prospect (0 quand l'offre n'en a pas, comme à l'origine)
  // deno-lint-ignore no-explicit-any
  function prixPourProspects(o: any): number {
    const p = o?.data?.pricing?.main_offer?.price;
    if (typeof p === "number" && p > 0) return p;
    const t = String(o?.price ?? "").replace(/[^\d]/g, "");
    return t ? Number(t) : 0;
  }

  // Génère les 6 prospects d'une offre et les range, un par un (la voix tient compte des précédents)
  // deno-lint-ignore no-explicit-any
  async function genererEtRanger(o: any): Promise<number> {
    const generes = await genererProspects(o.data || {}, prixPourProspects(o));
    const deja = (await d.db.select<{ voice_id: string | null }>("crm_sim_personas", { offer_id: o.id }, { select: "voice_id" })).map((r) => r.voice_id);
    const racine = (slug(o.name).slice(0, 40).replace(/-+$/, "") || "offre");
    const pris = new Set<string>();
    let position = 0;
    for (const { persona, item } of generes) {
      position++;
      const id = persona.identite || {};
      const prenom = sansNul(String(id.prenom || item?.prenom || "Prospect")).slice(0, 80);
      let cle = `${racine}-${slug(prenom) || "prospect"}`.slice(0, 72);
      for (let n = 2; pris.has(cle) || (await d.db.select("crm_sim_personas", { id: cle }, { select: "id" })).length > 0; n++) {
        cle = `${`${racine}-${slug(prenom) || "prospect"}`.slice(0, 72)}-${n}`;
      }
      pris.add(cle);
      const genre: "M" | "F" = id.gender === "F" || id.gender === "M" ? id.gender : (item?.gender === "F" || item?.gender === "M" ? item.gender : genreDuPrenom(prenom));
      const voix = choisirVoix(genre, deja);
      deja.push(voix);
      const conscience = Math.round(Number(persona.etatsInitiaux?.conscience ?? item?.conscience));
      const age = Math.round(Number(id.age ?? item?.age));
      await d.db.insert("crm_sim_personas", sansNulProfond({
        id: cle, offer_id: o.id, first_name: prenom,
        age: Number.isFinite(age) && age > 0 && age < 120 ? age : null,
        city: id.ville ? String(id.ville) : null,
        profession: id.metier ? String(id.metier) : null,
        situation: id.situation ? String(id.situation) : null,
        difficulty: difficulteDe(persona.difficulte) ?? difficulteDe(item?.difficulte) ?? "moyen",
        consciousness_level: Number.isFinite(conscience) && conscience >= 1 && conscience <= 5 ? conscience : null,
        pcm_type: ["travaillomane", "empathique", "promoteur", "perseverant"].includes(persona.pcmType) ? persona.pcmType : null,
        voice_id: voix,
        full_persona_data: persona && typeof persona === "object" && !Array.isArray(persona) ? persona : {},
        position, active: true,
      }));
    }
    return generes.length;
  }

  // ---------- les tâches de fond ----------

  const echec = (id: string, quoi: string) => async (e: unknown) => {
    console.error("[simulateur/offres]", quoi, e);
    try { await majOffre(id, { status: "failed", error: `${quoi} : ${String((e as Error)?.message ?? e)}`.slice(0, 1000) }); } catch (e2) { console.error("[simulateur/offres]", e2); }
  };

  // création : le site éventuel, l'extraction, l'assemblage, puis les prospects
  async function preparer(id: string, p: { url?: string; nom?: string; appelant: string }) {
    let [o] = await d.db.select("crm_sim_offers", { id });
    if (!o) return;
    let sources: Source[] = Array.isArray(o.sources) ? o.sources : [];
    if (p.url) {
      const site = await lireSite(p.url, fetchFn, pause);
      if (site.pagesCount > 0) {
        const t = maintenant();
        sources = [{ id: crypto.randomUUID(), type: "url", url: site.url, filename: new URL(site.url).hostname, extracted_at: t, added_at: t,
          added_by_user_id: p.appelant, char_count: site.rawContent.length, pages: site.pagesCount, word_count: site.wordCount, extracted_text: site.rawContent }, ...sources];
        o = await majOffre(id, { sources });
      } else if (!contenuDesSources(sources)) {
        throw new Error("Aucun contenu n'a pu être extrait de ce site");
      }
    }
    const contenu = contenuDesSources(sources);
    if (!contenu) throw new Error("Aucune source exploitable");
    const v3 = await extraire(contenu);
    const nom = (p.nom || v3.identity?.company?.name || o.name || "Offre sans nom").trim().slice(0, 200);
    const prix = typeof v3.pricing?.main_offer?.price === "number" && v3.pricing.main_offer.price > 0 ? v3.pricing.main_offer.price : null;
    if (prix === null && !v3.extraction_summary.sections_needing_review.includes("pricing")) v3.extraction_summary.sections_needing_review.push("pricing");
    const prixAffiche = prix !== null ? (v3.pricing.main_offer.price_display || prixTexte(prix)) : null;
    o = await majOffre(id, {
      name: nom, description: v3.value_proposition?.main_promise || null, price: prixAffiche, sector: v3.identity?.domain || null,
      data: { ...v3, ...adapterOffre(v3, nom, prixAffiche) }, status: "generating", error: null,
    });
    await genererEtRanger(o);
    await majOffre(id, { status: "ready", error: null });
  }

  // ré-analyse : les sources enregistrées, sans toucher aux prospects, au nom, à la description, au secteur ni au prix
  async function reanalyser(id: string) {
    const [o] = await d.db.select("crm_sim_offers", { id });
    if (!o) return;
    const v3 = await extraire(contenuDesSources(o.sources || []));
    const prixOffre = String(o.price ?? "").replace(/[^\d]/g, "");
    if (!(typeof v3.pricing?.main_offer?.price === "number" && v3.pricing.main_offer.price > 0) && prixOffre && v3.pricing?.main_offer) {
      v3.pricing.main_offer.price = Number(prixOffre);
    }
    await majOffre(id, { data: { ...v3, ...adapterOffre(v3, o.name, o.price ?? null) }, status: "ready", error: null });
  }

  async function regenerer(id: string) {
    const [o] = await d.db.select("crm_sim_offers", { id });
    if (!o) return;
    await genererEtRanger(o);
    await majOffre(id, { status: "ready", error: null });
  }

  // ---------- POST offres ----------

  async function creer(req: Request, a: Appelant): Promise<Response> {
    const b = await lire(req);
    if (!b) return erreur(400, "Requête illisible.");
    if (b.name !== undefined && b.name !== null && typeof b.name !== "string") return erreur(400, "Le nom doit être une chaîne de caractères.");
    const nom = typeof b.name === "string" ? sansNul(b.name).trim() : "";
    if (nom.length > 200) return erreur(400, "Le nom doit faire entre 1 et 200 caractères.");
    const url = typeof b.url === "string" ? b.url.trim() : "";
    if (url) { const g = urlAutorisee(url); if (!g.ok) return erreur(400, g.error); }
    const texte = typeof b.text === "string" ? sansNul(b.text).trim() : "";
    if (b.pdfs !== undefined && b.pdfs !== null && !Array.isArray(b.pdfs)) return erreur(400, "Envoi invalide : « pdfs » doit être une liste.");
    const pdfs: { filename?: unknown; base64?: unknown }[] = Array.isArray(b.pdfs) ? b.pdfs : [];
    if (pdfs.length > MAX_PDF) return erreur(400, "Trop de fichiers (10 PDF au plus par envoi).");
    if (!url && !texte && pdfs.length === 0) return erreur(400, "Ajoutez une URL, collez du contenu, ou ajoutez au moins un PDF.");

    // déjà connue ? même adresse (normalisée) ou mêmes contenus, puis un nom proche
    let empreinte: string;
    if (url) empreinte = `url:${normaliserUrl(url)}`;
    else {
      const parts = [texte, ...pdfs.map((p) => (typeof p?.base64 === "string" ? p.base64 : ""))].join("\n\u0001\n");
      const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts)));
      empreinte = `sha256:${[...h].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    }
    const existante = async (): Promise<any | null> => {
      const [parEmpreinte] = await d.db.select("crm_sim_offers", { fingerprint: empreinte, archived: false });
      if (parEmpreinte) return parEmpreinte;
      if (!nom) return null;
      const toutes = await d.db.select<any>("crm_sim_offers", { archived: false }, { select: "id,name", order: "created_at.asc" });
      const proche = toutes.find((o) => nomsProches(String(o.name || ""), nom));
      return proche ? (await d.db.select("crm_sim_offers", { id: proche.id }))[0] ?? null : null;
    };
    const retrouvee = async (o: any) => json({
      isNew: false, message: "Offre trouvée en base ! Vous pouvez commencer directement.", offer: legere(o),
      personas: (await d.db.select("crm_sim_personas", { offer_id: o.id }, { order: "position.asc", select: "id,first_name,difficulty" })),
    });
    const deja = await existante();
    if (deja) return await retrouvee(deja);

    // les PDF, un par un (taille vérifiée avant toute lecture)
    const fichiers: FichierLu[] = [];
    for (const p of pdfs) fichiers.push(await lireUnPdf(p, lirePdf));
    const t = maintenant();
    const sources: Source[] = [];
    if (texte) sources.push({ id: crypto.randomUUID(), type: "txt", filename: "contenu-colle.txt", extracted_at: t, added_at: t, added_by_user_id: a.id, char_count: texte.length, extracted_text: texte });
    for (const f of fichiers.filter((f) => f.success)) {
      sources.push({ id: crypto.randomUUID(), type: "pdf", filename: f.filename, extracted_at: t, added_at: t, added_by_user_id: a.id, char_count: f.charCount, pages: f.pages, size: f.size, extracted_text: f.text });
    }
    if (!url && sources.length === 0) return erreur(400, fichiers.find((f) => f.error)?.error || "Aucun texte exploitable extrait des PDF.");

    const provisoire = (nom || (url ? new URL(url).hostname : "") || fichiers.find((f) => f.success)?.filename || "Nouvelle offre").slice(0, 200);
    let o: any;
    try {
      [o] = await d.db.insert("crm_sim_offers", sansNulProfond({
        name: provisoire, description: null, price: null, sector: null, data: {}, sources, fingerprint: empreinte,
        status: "extracting", error: null, archived: false, created_by: a.id, created_at: t, updated_at: t,
      }));
    } catch (e) {
      const autre = await existante();   // créée au même moment par une autre requête
      if (autre) return await retrouvee(autre);
      throw e;
    }
    await enFond(preparer(o.id, { url: url || undefined, nom: nom || undefined, appelant: a.id }).catch(echec(o.id, "La préparation de l'offre a échoué")));
    return json({
      isNew: true, message: "Nouvelle offre créée : lecture des sources, puis génération des prospects.", offer: legere(o),
      fichiers: fichiers.map(({ text: _t, ...f }) => f),
    }, 202);
  }

  async function offre(id: string): Promise<any | Response> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return erreur(404, "Offre introuvable");
    const [o] = await d.db.select("crm_sim_offers", { id });
    return o ?? erreur(404, "Offre introuvable");
  }

  // ---------- le routeur ----------

  return async function (req: Request, chemin: string[], a: Appelant): Promise<Response | null> {
    const [r0, r1, r2, r3] = chemin;
    const m = req.method;
    const route =
      r0 === "offres" && !r1 && m === "POST" ? "creer" :
      r0 === "offres" && r1 && r2 === "prospects" && !r3 && m === "POST" ? "prospects" :
      r0 === "offres" && r1 && r2 === "reanalyser" && !r3 && m === "POST" ? "reanalyser" :
      r0 === "offres" && r1 && !r2 && m === "DELETE" ? "supprimerOffre" :
      r0 === "personas" && r1 && !r2 && m === "PATCH" ? "modifierPersona" :
      r0 === "personas" && r1 && !r2 && m === "DELETE" ? "supprimerPersona" : null;
    if (!route) return null;
    if (!a.admin) return erreur(403, "Accès réservé aux administrateurs");

    if (route === "creer") return await creer(req, a);

    if (route === "prospects" || route === "reanalyser") {
      const o = await offre(r1);
      if (o instanceof Response) return o;
      if (ENCOURS.includes(o.status)) return erreur(409, "Cette offre est déjà en cours de préparation. Attendez la fin avant de relancer.");
      if (route === "reanalyser") {
        if (!contenuDesSources(o.sources || [])) {
          return erreur(400, "Aucune source exploitable pour ré-analyser cette offre. Ajoutez au moins un PDF avec du texte.");
        }
        const maj = await majOffre(o.id, { status: "extracting", error: null });
        await enFond(reanalyser(o.id).catch(echec(o.id, "La ré-analyse de l'offre a échoué")));
        return json({ offer: legere(maj) }, 202);
      }
      // régénérer : les anciens prospects sont effacés, puis les 6 nouveaux sont générés (avec leurs voix)
      await d.db.remove("crm_sim_personas", { offer_id: o.id });
      const maj = await majOffre(o.id, { status: "generating", error: null });
      await enFond(regenerer(o.id).catch(echec(o.id, "La génération des prospects a échoué")));
      return json({ offer: legere(maj) }, 202);
    }

    if (route === "supprimerOffre") {
      if (/^[0-9a-f-]{36}$/i.test(r1)) {
        await d.db.remove("crm_sim_personas", { offer_id: r1 });
        await d.db.remove("crm_sim_offers", { id: r1 });
      }
      return json({ success: true, message: "Offre supprimée définitivement" });
    }

    const [p] = await d.db.select("crm_sim_personas", { id: r1 });
    if (!p) return erreur(404, "Persona non trouvé");
    if (route === "supprimerPersona") {
      await d.db.remove("crm_sim_personas", { id: r1 });
      return json({ success: true });
    }
    const b = await lire(req);
    if (!b) return erreur(400, "Requête illisible.");
    const patch: Record<string, unknown> = {};
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") return erreur(400, "« active » doit valoir vrai ou faux.");
      patch.active = b.active;
    }
    if (b.voice_id !== undefined) {
      if (!VOIX.some((v) => v.id === b.voice_id)) return erreur(400, "Voix inconnue.");
      patch.voice_id = b.voice_id;
    }
    if (b.difficulty !== undefined) {
      if (!["moyen", "difficile", "expert"].includes(b.difficulty)) return erreur(400, "Difficulté inconnue : moyen, difficile ou expert.");
      patch.difficulty = b.difficulty;
    }
    if (Object.keys(patch).length === 0) return erreur(400, "Rien à modifier.");
    const [row] = await d.db.update("crm_sim_personas", { id: r1 }, { ...patch, updated_at: maintenant() });
    return json(row);
  };
}

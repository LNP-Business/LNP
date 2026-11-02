// The Claude planner of Build in the web edition (proposal/os-v2, docs/os-v2). The page sends the sections of its prompt
// (PLAN, LOAD, CARRY, TEAM, the targeted key result) and the step; this route rebuilds the prompt exactly like the
// reference promptFor() with the prompt pack (proposal/os-v2/prompts.js → _prompts.json, build.sh stage 4), adds CONTEXT
// read with the caller's own token (the connector's readers, web/api/_os.js and _crm.js: row-level security and
// Settings › Access apply) and lets Claude read more through skl_os_read. Read only: Claude never writes; the page applies
// a suggestion only when the person clicks Accept. The key is the Vercel env var ANTHROPIC_API_KEY, never in the page.
// Each call writes one audit row and counts in the 60 calls per minute of the connector (crm_mcp_call / crm_mcp_done, 014).
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { anon, asUser, send, readJson } from "./_lib.js";
import { accessOf } from "./_screens.js";
import * as T from "./_crm.js";
import * as O from "./_os.js";

const PROMPTS = JSON.parse(readFileSync(new URL("./_prompts.json", import.meta.url), "utf8"));   // vercel.json includeFiles ships it
const MODEL = "claude-opus-5-5", MAX_READS = 2;
// skl_os_read: the read tools of the connector, with the screens that open each one
const READERS = {
  whoami: [T.whoami, "crm", null], okrs: [O.okrs, "os", ["cockpit", "build", "review"]], key_result: [O.keyResult, "os", ["cockpit", "build", "review"]],
  roadmap: [O.roadmap, "os", ["build"]], tasks: [O.tasks, "os", ["execute", "build"]], my_day: [O.myDay, "os", ["execute"]],
  decisions: [O.decisions, "os", ["decisions"]], weekly_review: [O.weeklyReview, "os", ["review"]], alerts: [O.alerts, "os", ["cockpit", "execute", "settings"]],
  library: [O.library, "os", ["bibliotheque"]], mechanism: [O.mechanism, "os", ["mechanisms", "mechprecall", "mechsales", "mechos", "registers"]],
  skl_map: [O.sklMap, "os", ["cartomap", "cartoevents", "cartoworks", "cartosim", "cartomodel"]], performance: [T.performance, "crm", ["crm"]],
  pipeline_summary: [T.pipelineSummary, "crm", ["crm"]], os_data: [O.osData, "os", null]
};
const fill = (t, v) => String(t).replace(/\{\{(\w+)\}\}/g, (m, k) => (v[k] != null ? v[k] : m));
const cut = (t, n) => (t.length > n ? t.slice(0, n) + " …[cut]" : t);
const str = (x, n) => cut(typeof x === "string" ? x : JSON.stringify(x == null ? "" : x), n);
// the page's values for {{…}}: known keys only, short
const VARS = ["today", "start", "due", "msWeek", "taskMax", "dayH", "days", "weekMax", "owners", "krNum", "krWords"];
function vars(v, question) { const o = {}; VARS.forEach(k => { if (v && v[k] != null) o[k] = String(v[k]).slice(0, 200); }); o.question = String(question || "").slice(0, 1000); return o; }

export function promptFor(b, context) {
  const v = vars(b.vars, b.question), step = b.question ? PROMPTS.steps.free : (PROMPTS.steps[b.step] || PROMPTS.steps.milestones);
  return [fill(PROMPTS.system, v), fill(step, v),
    "## CONTEXT (SKL OS, read live)\n" + (context || "Not available in this view. Work from PLAN only and say what you could not check."),
    "## TARGETED KEY RESULT\n" + str(b.targeted, 4000), "## PLAN\n" + str(b.plan, 60000),
    "## LOAD (planned hours per person per week, limit " + v.weekMax + " h)\n" + str(b.load, 8000),
    "## CARRY (left from last week)\n" + str(b.carry, 8000), "## TEAM\n" + str(b.team, 4000),
    fill(PROMPTS.output, v), fill(PROMPTS.selfcheck, v)].join("\n\n");
}
// the JSON object of the answer (the model is asked for nothing else)
export function parseAnswer(text) {
  const s = String(text || ""), a = s.indexOf("{"), z = s.lastIndexOf("}");
  let o = {}; try { o = JSON.parse(s.slice(a, z + 1)); } catch (e) { return { message: s.trim().slice(0, 2000) || "Claude gave no usable answer.", question: "", suggestions: [] }; }
  return { message: String(o.message || ""), question: String(o.question || ""), suggestions: Array.isArray(o.suggestions) ? o.suggestions.slice(0, 6) : [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "POST only" }); }
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return send(res, 401, { error: "Sign in first." });
  const { data, error } = await anon().auth.getUser(m[1]);
  if (error || !data || !data.user) return send(res, 401, { error: "The sign-in has expired." });
  const u = asUser(m[1]), user = data.user;
  const mem = await u.from("members").select("role").eq("user_id", user.id);
  const role = mem.data && mem.data[0] ? mem.data[0].role : null;
  if (!role) return send(res, 403, { error: "This account is not a member of SKL OS." });
  const access = accessOf(user, role);
  if (!access.includes("build")) return send(res, 403, { error: "Build is closed for you in Settings › Access." });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { code: "not_configured", error: "The Claude planner is not set up yet." });
  const b = await readJson(req);
  const t0 = Date.now(); let id = null;
  const r = await u.rpc("crm_mcp_call", { p_tool: "planner", p_input: { step: String(b.step || "").slice(0, 20), kr: String(b.kr || "").slice(0, 20) } });
  if (r.error) return r.error.code === "P0M60" ? send(res, 429, { code: "rate_limited", error: "Too many requests: wait a minute." }) : send(res, 500, { error: r.error.message });
  id = r.data;
  let ctx = null, os = null, reads = 0;
  const getCtx = () => (ctx = ctx || T.loadContext(u, user));
  const getOs = () => (os = os || getCtx().then(c => O.loadOs(u, user, c.tz, false, user.email)));
  async function read(tool, args) {
    const rd = READERS[tool]; if (!rd) throw T.userError("Unknown read tool: " + tool);
    if (rd[2] && !rd[2].some(x => access.includes(x))) throw T.userError("Closed for you in Settings › Access.");
    const out = rd[1] === "os" ? await rd[0](await getOs(), await getCtx(), args || {}) : await rd[0](u, await getCtx(), args || {});
    return out.text;
  }
  try {
    // CONTEXT: what the page reads once per key result (PROMPTS.context), each cut at about 3.5 KB
    const v = vars(b.vars, b.question);
    const parts = await Promise.all(PROMPTS.context.map(async ([tool, args]) => {
      const a = JSON.parse(fill(JSON.stringify(args), v));
      try { return "### " + tool + " " + JSON.stringify(a) + "\n" + cut(await read(tool, a), 3500); } catch (e) { return "### " + tool + "\n(not available: " + (e.user ? e.message : "error") + ")"; }
    }));
    const client = new Anthropic();
    const tool = { name: PROMPTS.tool.name, description: PROMPTS.tool.description, input_schema: PROMPTS.tool.inputSchema };
    const messages = [{ role: "user", content: promptFor(b, parts.join("\n\n")) }];
    let msg;
    for (let turn = 0; turn <= MAX_READS; turn++) {
      msg = await client.beta.messages.create({ model: MODEL, max_tokens: 16000, output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", tools: turn < MAX_READS ? [tool] : [], messages });
      if (msg.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: msg.content });
      const results = [];
      for (const blk of msg.content.filter(x => x.type === "tool_use")) {
        let content, is_error = false;
        try { reads++; content = cut(await read(String(blk.input && blk.input.tool || ""), blk.input && typeof blk.input.args === "object" ? blk.input.args : {}), 8000); }
        catch (e) { content = e.user ? e.message : "SKL OS could not answer this read."; is_error = true; }
        results.push({ type: "tool_result", tool_use_id: blk.id, content, is_error });
      }
      messages.push({ role: "user", content: results });
    }
    const out = msg.stop_reason === "refusal" ? { message: "Claude declined this request.", question: "", suggestions: [] }
      : parseAnswer(msg.content.filter(x => x.type === "text").map(x => x.text).join(""));
    await u.rpc("crm_mcp_done", { p_id: id, p_rows: reads, p_ms: Date.now() - t0, p_error: null });
    return send(res, 200, out);
  } catch (e) {
    await u.rpc("crm_mcp_done", { p_id: id, p_rows: reads, p_ms: Date.now() - t0, p_error: String(e.message || e).slice(0, 300) });
    console.error("planner", e && e.status, e && e.message);
    const st = e && e.status;
    return send(res, st === 429 ? 429 : 502, { code: st === 429 ? "rate_limited" : "unavailable", error: "Claude did not answer this time." });
  }
}

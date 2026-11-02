/* SKL OS › Agent System: the agent cockpit (functional spec "Cockpit agents SKL", mock-up v3), in SKL OS design.
   One shadow-DOM module mounted on five screens: overview, decisions, agents (registry + agent sheet), triggers, log.
   Like the mock-up, decisions and pauses live for the session only. */
(function () {
  "use strict";
  var LEVELS = ["Human only", "AI assists", "AI does, human approves", "AI does, human supervises", "Autonomous"];
  var STATUS = { active: ["Active", "pos"], test: ["In test", "info"], paused: ["Paused", "neu"], build: ["In build", "warn"] };
  var TYPE = { decision: ["Decision", "warn"], escalation: ["Escalation", "crit"] };
  var RESULT = { review: ["To approve", "warn"], auto: ["Sent automatically", "pos"], ok: ["Approved", "pos"], edited: ["Edited then approved", "pos"],
                 rejected: ["Rejected", "neu"], escalation: ["Escalation", "crit"], error: ["Error", "critsolid"] };
  var STATE = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

  // ---------- sample data (section 9 of the spec, fictitious) ----------
  var AGENTS = [
    { id: "a1", name: "Post-call analyst", pole: "Sales", status: "active", level: 2, owner: "Romain", esc: "Valentino", runs: "38", clean: "92%", cost: "€4.10", tests: "46/50",
      role: "Analyses every finished sales call and prepares 3 concrete coaching points for the sales rep.",
      trigger: "Call ended in Fathom", produces: "Coaching in #sales-coaching", reads: "Fathom transcript, SKL analysis grid",
      next: "90% approved without edits over 30 consecutive runs. Currently 92% over 38: ready to move to level 3.",
      actions: ["Read the Fathom transcripts of sales calls", "Write in #sales-coaching after approval", "Update the call score in the lead's record"],
      guards: ["Never contacts the lead", "Never quotes the lead's personal information in Slack", "Escalates if the call lasts less than 5 min or the transcript is incomplete"] },
    { id: "a2", name: "Lead follow-ups", pole: "Sales", status: "test", level: 2, owner: "Valentino", esc: "Romain", runs: "21", clean: "81%", cost: "€1.90", tests: "39/50",
      role: "Writes a personal follow-up for every lead who did not convert, based on what was said on the call.",
      trigger: "Lead with no payment 48 h after the call", produces: "Email draft", reads: "Transcript, lead record, offer",
      next: "45 tests out of 50 passed and 85% approved without edits. Currently 39/50 and 81%.",
      actions: ["Read the transcript and the lead's record", "Prepare an email draft", "Suggest a follow-up date"],
      guards: ["Sends nothing without Valentino's approval", "No discount or promise outside the offer", "At most 2 follow-ups per lead"] },
    { id: "a3", name: "Pre-call brief", pole: "Sales", status: "active", level: 3, owner: "Valentino", esc: "Romain", runs: "44", clean: "97%", cost: "€2.60", tests: "48/50",
      role: "Prepares a one-page brief on every lead, one hour before their call.",
      trigger: "1 h before a booked call", produces: "Brief in Slack", reads: "Form, CRM, history of exchanges",
      next: "Level 4: 98% without edits over 60 runs and Romain's approval. Currently 97% over 44.",
      actions: ["Read the form and the lead's record", "Post the brief in the sales rep's thread"],
      guards: ["Read-only on the CRM", "Flags missing information instead of guessing it"] },
    { id: "a4", name: "Deadline keeper", pole: "Steering", status: "active", level: 3, owner: "Romain", esc: "Amin", runs: "7", clean: "100%", cost: "€0.40", tests: "30/30",
      role: "Tracks everyone's weekly milestone, nudges mid-week and flags delays.",
      trigger: "Every day at 9 am", produces: "Daily update in #ops", reads: "This week's milestones, Slack messages",
      next: "Level 4: 4 weeks with no nudge judged useless in the weekly review.",
      actions: ["Read this week's milestones", "Send a reminder to the person concerned", "Post the daily update"],
      guards: ["Never changes a deadline", "Escalates to Amin after 2 days of delay"] },
    { id: "a5", name: "Activation follow-up D1–D30", pole: "Delivery", status: "test", level: 1, owner: "To assign", esc: "Romain", runs: "12", clean: "67%", cost: "€0.90", tests: "31/50",
      role: "Follows every new student to their first result and flags those who drop out.",
      trigger: "Every day at 11 am", produces: "List of students at risk", reads: "Student platform, recorded sessions",
      next: "40 tests out of 50 passed and 80% approved without edits. Currently 31/50 and 67%.",
      actions: ["Read students' progress", "Suggest a follow-up message to the coach"],
      guards: ["Never contacts the student directly", "Escalates any sign of a refund request"] },
    { id: "a6", name: "Guru scripts", pole: "Content", status: "active", level: 2, owner: "Ilya", esc: "Michael", runs: "15", clean: "87%", cost: "€3.20", tests: "44/50",
      role: "Writes the week's scripts in the guru's voice, from the editorial calendar.",
      trigger: "Every Monday at 8 am", produces: "5 scripts to approve", reads: "Guru charter, editorial calendar",
      next: "90% approved without edits over 4 weeks. Currently 87%.",
      actions: ["Read the charter and the calendar", "Create the scripts in Docs"],
      guards: ["No promise of a figured result", "Follows the list of banned topics"] },
    { id: "a7", name: "Viral content watch", pole: "Content", status: "paused", level: 3, owner: "Michael", esc: "Ilya", runs: "0", clean: "—", cost: "€0.00", tests: "40/40",
      role: "Spots the content that performs in the niche every week and draws angles from it.",
      trigger: "Every Friday at 7 am", produces: "Note of angles to test", reads: "Public social networks",
      next: "Fix the TikTok access, then 4 weeks without errors.",
      actions: ["View public content", "Write a note in Docs"],
      guards: ["Read-only", "Never copies content as is"] },
    { id: "a8", name: "OKR drift alert", pole: "Steering", status: "build", level: 0, owner: "Romain", esc: "Amin", runs: "0", clean: "—", cost: "—", tests: "0/30",
      role: "Before Saturday's weekly, reviews every KR and alerts as soon as a KR drifts.",
      trigger: "Every Saturday at 8 am", produces: "OKR update in #direction", reads: "KR board",
      next: "Write the test set, then start at level 1.",
      actions: ["Read the KR values"],
      guards: ["Never changes a value"] }
  ];
  var DECISIONS = [
    { id: "v1", agent: "a1", type: "decision", when: "12 min ago", title: "Coaching · call L-2417",
      why: "the agent is at level 2: every coaching is approved before it is posted.", dest: "#sales-coaching", sources: "Fathom transcript (42 min)", cta: "Approve and post",
      proposal: "Call L-2417 · 42 min · score 71/100\n\n1. You presented the offer before putting a figure on the lead's problem. Ask what the situation costs them today before pitching.\n\n2. Price objection (min 31) handled in 20 seconds. Rephrase first, then link the price to their goal.\n\n3. Great moment: rephrasing their goal at minute 12. Keep it." },
    { id: "v2", agent: "a2", type: "decision", when: "1 h ago", title: "Follow-up · lead L-2398",
      why: "agent in test: nothing goes to the lead without approval.", dest: "Email to the lead", sources: "Transcript, lead record", cta: "Approve and send",
      proposal: "Subject: Your goal of €10k a month\n\nHi Karim,\n\nWhen we spoke, you told me you wanted to leave your job by the summer. I've prepared the two steps that get you there without putting your income at risk.\n\nShall we talk for 15 minutes on Thursday?\n\nValentino" },
    { id: "v3", agent: "a5", type: "escalation", when: "3 h ago", title: "Student E-118 inactive for 6 days",
      why: "refund risk: only a human can decide what happens next.", dest: "The student's coach", sources: "Student platform", cta: "Notify the coach",
      proposal: "Student E-118 · Day 9 of the programme\n\nNo login for 6 days. Module 2 started, not finished. Tuesday's coaching session missed.\n\nProposal: a call from the coach within 24 h to clear the blocker before the end of the 30-day window." },
    { id: "v4", agent: "a6", type: "decision", when: "4 h ago", title: "5 scripts · week 43",
      why: "every script speaks in the guru's name: approval by Ilya or you.", dest: "Docs · Content W43", sources: "Guru charter, calendar", cta: "Approve the scripts",
      proposal: "Script 1 · “The real reason you're stuck”\n\nScript 2 · “3 decisions that saved me 2 years”\n\nScript 3 · “What nobody tells you about your first client”\n\nScript 4 · Student case study (to complete with a real testimonial)\n\nScript 5 · Thursday live Q&A" }
  ];
  var TRIGGERS = [
    { when: "Call ended in Fathom", agent: "a1", produces: "Coaching in Slack", decision: "Romain", tools: "Fathom · Slack" },
    { when: "1 h before a booked call", agent: "a3", produces: "Lead brief", decision: "Automatic", tools: "Calendar · CRM · Slack" },
    { when: "Lead with no payment 48 h after the call", agent: "a2", produces: "Email draft", decision: "Valentino", tools: "Fathom · CRM · Email" },
    { when: "Every day at 9 am", agent: "a4", produces: "Daily update #ops", decision: "Automatic", tools: "Slack" },
    { when: "Every day at 11 am", agent: "a5", produces: "Students at risk", decision: "To assign", tools: "Student platform" },
    { when: "Every Monday at 8 am", agent: "a6", produces: "5 scripts", decision: "Ilya", tools: "Docs" },
    { when: "Every Friday at 7 am", agent: "a7", produces: "Note of angles", decision: "Michael", tools: "Web" },
    { when: "Every Saturday at 8 am", agent: "a8", produces: "OKR update", decision: "Romain", tools: "KR board · Slack" }
  ];
  var LOG = [
    ["14:52", "Post-call analyst", "Call L-2417 ended", "review", "48 s", "€0.11"],
    ["14:30", "Pre-call brief", "Call L-2421 in 1 h", "auto", "22 s", "€0.06"],
    ["13:05", "Lead follow-ups", "L-2398 no payment 48 h", "review", "31 s", "€0.09"],
    ["11:40", "Activation follow-up D1–D30", "Daily review", "escalation", "1 min 12", "€0.07"],
    ["11:02", "Guru scripts", "Calendar W43", "review", "2 min 05", "€0.38"],
    ["09:00", "Deadline keeper", "Every day at 9 am", "auto", "35 s", "€0.06"],
    ["08:47", "Post-call analyst", "Call L-2409 ended", "ok", "51 s", "€0.12"],
    ["Yesterday 18:20", "Lead follow-ups", "L-2390 no payment 48 h", "rejected", "29 s", "€0.08"],
    ["Yesterday 17:55", "Post-call analyst", "Call L-2402 ended", "edited", "46 s", "€0.11"],
    ["Yesterday 16:10", "Viral content watch", "TikTok access refused", "error", "8 s", "€0.01"]
  ];
  var ALERTS = [
    ["Activation follow-up D1–D30", ": 67% approved without edits, below the 80% threshold. Review the instructions before raising autonomy."],
    ["Viral content watch", ": TikTok access refused yesterday at 4:10 pm. Agent paused."]
  ];

  // ---------- session state ----------
  var S = { done: {}, flip: {}, sel: "v1", agent: "a1", sheet: false, wantSheet: false, banner: "", view: null };
  var byId = {}; AGENTS.forEach(function (a) { byId[a.id] = a; });
  function stateOf(d) { return S.done[d.id] || "pending"; }
  function pendingList() { return DECISIONS.filter(function (d) { return stateOf(d) === "pending"; }); }
  function statusOf(a) { return S.flip[a.id] ? (a.status === "paused" ? "active" : "paused") : a.status; }
  function activeCount() { return AGENTS.filter(function (a) { return statusOf(a) === "active"; }).length; }
  function syncBadge() {
    var n = pendingList().length;
    window.__sklAgentsPending = n;
    document.querySelectorAll('[data-badge="agentdec"]').forEach(function (el) { el.textContent = String(n); el.style.display = n ? "" : "none"; });
  }
  window.__sklAgentsPending = pendingList().length;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function tag(pair) { return '<span class="t t-' + pair[1] + '">' + esc(pair[0]) + "</span>"; }
  var internal = false;
  function goScreen(file) { var a = document.querySelector('#app a[href="' + file + '"]'); if (!a) return; internal = true; try { a.click(); } finally { internal = false; } }
  // a click on a sidebar entry is a fresh navigation: no banner, and "Agents" opens the registry
  document.addEventListener("click", function (e) {
    if (internal) return;
    var a = e.target.closest && e.target.closest("#app nav a[href]"); if (!a) return;
    S.banner = "";
    if (a.getAttribute("href") === "AgentsRegistry.dc.html") { S.sheet = false; S.wantSheet = false; }
  }, true);

  var CSS = [
    ":host{display:block;min-height:var(--screen-h,100vh);",
    "--bg:#F6F4EF;--card:#FFFFFF;--ink:#1B1B18;--ink2:#3D3A33;--mut:#5E5B53;--mut2:#8E8A80;--line:#E3DFD5;--line2:#EFEBE3;--soft:#ECE8DF;",
    "--gold:#D9B46A;--gold2:#9A6614;--goldsoft:#FBF6EC;--green:#2E7D4F;--greent:#1E5E38;--greens:#E6F2EA;--amber:#B45309;--ambert:#8A3F06;--ambers:#FDF1E3;",
    "--red:#B42318;--redt:#9B1C12;--reds:#FDECEA;--blue:#2D5C9C;--bluet:#244B82;--blues:#E8EEF7;",
    "--sans:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;--serif:Fraunces,Georgia,serif;",
    "font-family:var(--sans);color:var(--ink);font-size:15px;line-height:1.5}",
    "*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}",
    ":focus-visible{outline:2px solid var(--gold);outline-offset:2px}",
    ".wrap{padding:40px 48px 48px;display:flex;flex-direction:column;gap:24px}",
    ".top{display:flex;align-items:center;gap:16px;min-height:54px;padding-right:72px}",
    ".ctx{min-width:0;flex:1}.ctx .k{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2)}",
    ".ctx p{margin:3px 0 0;font-size:16px;color:var(--ink2)}",
    ".mock{flex-shrink:0;font-size:12px;color:var(--mut);border:1px dashed #D8D3C7;border-radius:999px;padding:5px 12px;white-space:nowrap}",
    ".banner{border-radius:12px;padding:12px 16px;background:var(--greens);border:1px solid #BFDCC9;color:var(--greent);font-size:14px;font-weight:500}",
    ".t{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}",
    ".t::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.85}",
    ".t-pos{background:var(--greens);color:var(--greent)}.t-info{background:var(--blues);color:var(--bluet)}.t-neu{background:var(--soft);color:var(--ink2)}",
    ".t-warn{background:var(--ambers);color:var(--ambert)}.t-crit{background:var(--reds);color:var(--redt)}.t-critsolid{background:var(--red);color:#fff}.t-critsolid::before{background:#fff}",
    ".kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}",
    ".kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:4px}",
    ".kpi b{font-family:var(--mono);font-size:30px;font-weight:600;line-height:1.1}.kpi span{font-size:13px;color:var(--mut)}",
    ".kpi.hi{background:var(--ink);border-color:var(--ink)}.kpi.hi b{color:var(--gold)}.kpi.hi span{color:#C9C4B7}",
    ".cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px;align-items:start}",
    ".stack{display:flex;flex-direction:column;gap:14px;min-width:0}",
    ".card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;min-width:0}",
    ".ch{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}",
    ".ch h2{margin:0;font-family:var(--serif);font-weight:500;font-size:20px}",
    ".lnk{border:0;background:none;padding:2px 0;font-size:13px;font-weight:600;color:var(--gold2)}.lnk:hover{text-decoration:underline}",
    ".tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}",
    "th{text-align:left;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mut2);padding:8px 7px;border-bottom:1px solid var(--line);vertical-align:bottom}",
    "td{padding:11px 7px;border-top:1px solid var(--line2);vertical-align:middle}td:first-child,th:first-child{padding-left:0}td:last-child,th:last-child{padding-right:0}.hl td:first-child{max-width:190px}.hl td{white-space:nowrap}.hl td:first-child{white-space:normal}tr:first-child td{border-top:0}",
    ".num{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".an{border:0;background:none;padding:0;font-weight:600;color:var(--ink);text-align:left}.an:hover{color:var(--gold2);text-decoration:underline}",
    ".sub{display:block;font-size:12px;color:var(--mut)}",
    ".todo{display:flex;flex-direction:column}",
    ".ti{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 12px;align-items:center;border:0;border-top:1px solid var(--line2);background:none;padding:12px 4px;text-align:left;width:100%}",
    ".ti:first-child{border-top:0}.ti:hover{background:var(--goldsoft)}.ti b{font-weight:600}.ti .sub{grid-column:2}.ti .chev{grid-row:1/3;grid-column:3;font-size:20px;color:var(--mut2)}",
    ".empty{padding:18px 4px;color:var(--mut);font-size:14px}",
    ".alert{border-left:3px solid var(--red);background:var(--reds);border-radius:0 10px 10px 0;padding:10px 14px;font-size:14px;color:var(--ink2);margin-top:8px}.alert:first-of-type{margin-top:0}.alert b{color:var(--redt)}",
    ".dec{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px;align-items:start}",
    ".dl{display:flex;flex-direction:column;gap:8px}.dl h2{margin:0 0 4px;font-family:var(--serif);font-weight:500;font-size:20px}",
    ".di{display:flex;flex-direction:column;gap:4px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:12px 14px;text-align:left;width:100%}",
    ".di:hover{border-color:var(--ink)}.di[aria-pressed=true]{border-color:var(--ink);background:var(--goldsoft);box-shadow:inset 3px 0 0 var(--gold)}",
    ".di.past{opacity:.55}.di .r1{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--mut)}.di b{font-size:15px}",
    ".dd{display:flex;flex-direction:column;gap:14px;padding:20px 24px}.dd .cx{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mut);flex-wrap:wrap}",
    ".dd h2{margin:0;font-family:var(--serif);font-weight:500;font-size:26px;line-height:1.15}",
    ".whybox{background:var(--bg);border-radius:10px;padding:12px 14px;font-size:14px;color:var(--ink2)}",
    ".lab{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2)}",
    ".prop{white-space:pre-wrap;border:1px solid var(--line);border-radius:12px;padding:16px 18px;font-size:14.5px;line-height:1.6;background:#FFFEFB}",
    ".dest{font-size:14px;color:var(--ink2)}",
    ".acts{display:flex;gap:10px;flex-wrap:wrap}",
    ".bp{min-height:44px;padding:0 20px;border:0;border-radius:10px;background:var(--ink);color:var(--gold);font-weight:600;font-size:15px}",
    ".bs{min-height:44px;padding:0 18px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;color:var(--ink);font-weight:600;font-size:14px}.bs:hover{border-color:var(--ink)}",
    ".bd{min-height:44px;padding:0 18px;border:1px solid #F1C6C1;border-radius:10px;background:#fff;color:var(--redt);font-weight:600;font-size:14px}.bd:hover{border-color:var(--red)}",
    ".rh{display:flex;justify-content:space-between;align-items:center;gap:12px}.rh span{font-size:15px;color:var(--ink2)}.rh b{font-family:var(--mono)}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}",
    ".ac{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:16px 18px;text-align:left;width:100%}",
    ".ac:hover{border-color:var(--ink)}.ac .k{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2)}",
    ".ac h3{margin:0;font-family:var(--serif);font-weight:500;font-size:20px;line-height:1.2}.ac p{margin:0;font-size:13.5px;color:var(--mut);flex:1}",
    ".meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin-top:4px}",
    ".back{align-self:flex-start;border:0;background:none;padding:0;font-size:14px;font-weight:600;color:var(--gold2)}.back:hover{text-decoration:underline}",
    ".id{display:flex;flex-direction:column;gap:8px}.id .meta{margin:0}.id h1{margin:0;font-family:var(--serif);font-weight:500;font-size:34px;line-height:1.1}",
    ".id p{margin:0;font-size:16px;color:var(--ink2);max-width:75ch}",
    ".kv{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px 16px;margin:0;font-size:14.5px}.kv dt{color:var(--mut);font-size:13px;padding-top:1px}.kv dd{margin:0}",
    ".lvl{font-size:13px;color:var(--mut)}.lvl b{color:var(--ink);font-family:var(--mono)}",
    ".ladder{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:4px 0 12px}",
    ".step{border-radius:10px;padding:10px 10px 12px;border:1px solid var(--line);background:var(--bg);color:var(--mut);font-size:12.5px;line-height:1.35;min-height:84px}",
    ".step b{display:block;font-family:var(--mono);font-size:18px;margin-bottom:4px}",
    ".step.past{background:var(--goldsoft);border-color:#E6D3A8;color:var(--gold2)}",
    ".step.now{background:var(--ink);border-color:var(--ink);color:#F6F4EF}.step.now b{color:var(--gold)}",
    ".next{background:var(--goldsoft);border:1px solid #E6D3A8;border-radius:10px;padding:12px 14px;font-size:14px}",
    ".two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.two h3{margin:0 0 6px;font-size:14px;font-weight:600}.two ul{margin:0;padding-left:18px;font-size:14px;color:var(--ink2);display:flex;flex-direction:column;gap:4px}",
    ".btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}",
    ".arrow{color:var(--mut2);font-size:18px;width:28px}.when{font-weight:600}.mutd{color:var(--mut);font-size:13px}"
  ].join("\n");

  // ---------- views ----------
  var HEAD = {
    overview: ["Steering", "What your agents do, what waits for your decision, what is drifting."],
    decisions: ["Human control", "Agents propose, you decide. Every decision helps improve them."],
    agents: ["Registry", "Each agent's identity card: role, owner, autonomy."],
    triggers: ["Orchestration", "Which event wakes which agent, and who approves what it produces."],
    log: ["Traceability", "Every run: trigger, result, duration, cost."]
  };
  function head(view) {
    var h = HEAD[view];
    if (view === "agents" && S.sheet) { var a = byId[S.agent]; h = ["Agent sheet", "Owner: " + a.owner + " · escalates to " + a.esc]; }
    return '<header class="top"><div class="ctx"><div class="k">' + esc(h[0]) + "</div><p>" + esc(h[1]) + '</p></div><span class="mock">Mock-up · sample data</span></header>'
      + (S.banner ? '<div class="banner" role="status">' + esc(S.banner) + "</div>" : '<div role="status" hidden></div>');
  }
  function overview() {
    var p = pendingList();
    var h = '<div class="kpis">'
      + '<div class="kpi"><b>' + activeCount() + "</b><span>active agents out of " + AGENTS.length + "</span></div>"
      + '<div class="kpi hi"><b>' + p.length + "</b><span>waiting for your decision</span></div>"
      + '<div class="kpi"><b>137</b><span>runs over 7 days</span></div>'
      + '<div class="kpi"><b>89%</b><span>approved without edits</span></div>'
      + '<div class="kpi"><b>€13.10</b><span>AI cost over 7 days</span></div></div>';
    h += '<div class="cols"><section class="card"><div class="ch"><h2>Agent health</h2><button class="lnk" data-go="AgentsRegistry.dc.html">See the registry</button></div>'
      + '<div class="tw"><table class="hl"><thead><tr><th>Agent</th><th>Status</th><th>Autonomy</th><th>Runs 7d</th><th>Approved without edits</th><th>Cost 7d</th></tr></thead><tbody>'
      + AGENTS.map(function (a) {
        return '<tr><td><button class="an" data-agent="' + a.id + '">' + esc(a.name) + '</button><span class="sub">' + esc(a.pole) + "</span></td><td>" + tag(STATUS[statusOf(a)])
          + "</td><td>Level " + a.level + '</td><td class="num">' + esc(a.runs) + '</td><td class="num">' + esc(a.clean) + '</td><td class="num">' + esc(a.cost) + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
    h += '<div class="stack"><section class="card"><div class="ch"><h2>To handle</h2><button class="lnk" data-go="AgentsDecisions.dc.html">See all</button></div><div class="todo">'
      + (p.length ? p.map(function (d) {
        return '<button class="ti" data-pick="' + d.id + '">' + tag(TYPE[d.type]) + "<b>" + esc(d.title) + '</b><span class="sub">' + esc(byId[d.agent].name) + " · " + esc(d.when) + '</span><span class="chev" aria-hidden="true">›</span></button>';
      }).join("") : '<div class="empty">Nothing to approve. Your agents are running.</div>')
      + '</div></section><section class="card"><div class="ch"><h2>Alerts</h2></div>'
      + ALERTS.map(function (x) { return '<div class="alert"><b>' + esc(x[0]) + "</b>" + esc(x[1]) + "</div>"; }).join("")
      + "</section></div></div>";
    return h;
  }
  function decisions() {
    var p = pendingList(), d = DECISIONS.filter(function (x) { return x.id === S.sel; })[0] || DECISIONS[0], st = stateOf(d), ag = byId[d.agent];
    var h = '<div class="dec"><div class="dl"><h2>' + p.length + " pending</h2>"
      + DECISIONS.map(function (x) {
        var s = stateOf(x);
        return '<button class="di' + (s !== "pending" ? " past" : "") + '" data-sel="' + x.id + '" aria-pressed="' + (x.id === d.id) + '"><span class="r1">' + tag(TYPE[x.type]) + "<span>" + esc(x.when) + "</span></span><b>" + esc(x.title)
          + '</b><span class="sub">' + esc(byId[x.agent].name) + " · " + STATE[s] + "</span></button>";
      }).join("") + "</div>";
    h += '<section class="card dd"><div class="cx">' + tag(TYPE[d.type]) + "<span>" + esc(ag.name) + '</span><span aria-hidden="true">·</span><span>' + esc(d.when) + "</span></div>"
      + "<h2>" + esc(d.title) + '</h2><div class="whybox"><b>Why you:</b> ' + esc(d.why) + '</div><div class="lab">Agent\'s proposal</div><div class="prop">' + esc(d.proposal) + "</div>"
      + '<div class="dest">Destination: <b>' + esc(d.dest) + "</b> · Sources read: " + esc(d.sources) + "</div>"
      + (st === "pending"
        ? '<div class="acts"><button class="bp" data-do="approve">' + esc(d.cta) + '</button><button class="bs" data-do="edit">Edit before sending</button><button class="bd" data-do="reject">Reject</button></div>'
        : '<div class="banner">Decision recorded: ' + STATE[st] + ". The agent learns from this feedback.</div>")
      + "</section></div>";
    return h;
  }
  function registry() {
    return '<div class="rh"><span><b>' + AGENTS.length + "</b> agents · <b>" + activeCount() + '</b> active</span><button class="bp" data-do="new">New agent</button></div><div class="grid">'
      + AGENTS.map(function (a) {
        return '<button class="ac" data-agent="' + a.id + '"><span class="k">' + esc(a.pole) + "</span><h3>" + esc(a.name) + "</h3><p>" + esc(a.role) + '</p><span class="meta">' + tag(STATUS[statusOf(a)])
          + "<span>Level " + a.level + '</span><span aria-hidden="true">·</span><span>' + esc(a.owner) + "</span></span></button>";
      }).join("") + "</div>";
  }
  function sheet() {
    var a = byId[S.agent], st = statusOf(a);
    var ladder = LEVELS.map(function (l, i) {
      var c = i < a.level ? "past" : i === a.level ? "now" : "";
      return '<div class="step ' + c + '"' + (i === a.level ? ' aria-current="step"' : "") + "><b>" + i + "</b>" + esc(l) + "</div>";
    }).join("");
    return '<button class="back" data-go="AgentsRegistry.dc.html" data-registry="1">‹ All agents</button>'
      + '<div class="id"><div class="meta">' + tag(STATUS[st]) + "<span>" + esc(a.pole) + "</span></div><h1>" + esc(a.name) + "</h1><p>" + esc(a.role) + "</p></div>"
      + '<div class="cols"><div class="stack">'
      + '<section class="card"><div class="ch"><h2>How it works</h2></div><dl class="kv"><dt>Triggered by</dt><dd>' + esc(a.trigger) + "</dd><dt>Produces</dt><dd>" + esc(a.produces) + "</dd><dt>Reads</dt><dd>" + esc(a.reads) + "</dd></dl></section>"
      + '<section class="card"><div class="ch"><h2>Autonomy</h2><span class="lvl">Level <b>' + a.level + "</b> of 4</span></div>"
      + '<div class="ladder">' + ladder + '</div><div class="next"><b>To reach the next level:</b> ' + esc(a.next) + "</div></section>"
      + '<section class="card"><div class="two"><div><h3>Allowed actions</h3><ul>' + a.actions.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("")
      + "</ul></div><div><h3>Guardrails</h3><ul>" + a.guards.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div></section>"
      + '</div><div class="stack">'
      + '<section class="card"><div class="ch"><h2>Performance</h2></div><dl class="kv"><dt>Test set</dt><dd class="num">' + esc(a.tests) + ' passed</dd><dt>Runs 7d</dt><dd class="num">' + esc(a.runs)
      + '</dd><dt>Approved without edits</dt><dd class="num">' + esc(a.clean) + '</dd><dt>Cost 7d</dt><dd class="num">' + esc(a.cost) + "</dd></dl></section>"
      + '<section class="card"><div class="ch"><h2>Accountability</h2></div><dl class="kv"><dt>Owner</dt><dd>' + esc(a.owner) + "</dd><dt>Escalates to</dt><dd>" + esc(a.esc) + "</dd></dl>"
      + '<div class="btns"><button class="bs" data-do="pause">' + (st === "paused" ? "Reactivate the agent" : "Pause") + '</button><button class="bs" data-do="tests">Rerun the tests</button></div></section>'
      + "</div></div>";
  }
  function triggers() {
    return '<section class="card"><div class="tw"><table><thead><tr><th>When</th><th><span hidden>Then</span></th><th>Agent</th><th>Produces</th><th>Decision</th><th>Connectors</th></tr></thead><tbody>'
      + TRIGGERS.map(function (t) {
        return '<tr><td class="when">' + esc(t.when) + '</td><td class="arrow" aria-hidden="true">→</td><td><button class="an" data-agent="' + t.agent + '">' + esc(byId[t.agent].name) + "</button></td><td>" + esc(t.produces)
          + "</td><td>" + esc(t.decision) + '</td><td class="mutd">' + esc(t.tools) + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }
  function log() {
    return '<section class="card"><div class="tw"><table><thead><tr><th>Time</th><th>Agent</th><th>Trigger</th><th>Result</th><th>Duration</th><th>Cost</th></tr></thead><tbody>'
      + LOG.map(function (r) {
        return '<tr><td class="num">' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + "</b></td><td>" + esc(r[2]) + "</td><td>" + tag(RESULT[r[3]]) + '</td><td class="num">' + esc(r[4]) + '</td><td class="num">' + esc(r[5]) + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }

  function nextPending(after) {
    var p = DECISIONS.filter(function (x) { return x.id !== after && stateOf(x) === "pending"; });
    return p.length ? p[0].id : after;
  }

  window.SKL_AGENTS = {
    css: CSS,
    html: '<div class="wrap" id="ag"></div>',
    mount: function (root) {
      var host = root.host, box = root.getElementById("ag");
      function viewOf() { var p = host.parentNode; return (p && p.getAttribute && p.getAttribute("data-agents")) || "overview"; }
      function render() {
        var v = viewOf();
        if (v !== S.view) { S.banner = ""; S.sheet = v === "agents" && S.wantSheet; S.wantSheet = false; S.view = v; }
        var body = v === "overview" ? overview() : v === "decisions" ? decisions() : v === "agents" ? (S.sheet ? sheet() : registry()) : v === "triggers" ? triggers() : log();
        box.innerHTML = head(v) + body;
        syncBadge();
      }
      function openAgent(id) {
        S.agent = id; S.banner = "";
        if (viewOf() === "agents") { S.sheet = true; render(); window.scrollTo(0, 0); }
        else { S.wantSheet = true; goScreen("AgentsRegistry.dc.html"); }
      }
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.agent) return openAgent(b.dataset.agent);
        if (b.dataset.registry) { S.sheet = false; S.banner = ""; render(); window.scrollTo(0, 0); return; }
        if (b.dataset.go) return goScreen(b.dataset.go);
        if (b.dataset.pick) { S.sel = b.dataset.pick; return goScreen("AgentsDecisions.dc.html"); }
        if (b.dataset.sel) { S.sel = b.dataset.sel; S.banner = ""; return render(); }
        var d = DECISIONS.filter(function (x) { return x.id === S.sel; })[0];
        switch (b.dataset.do) {
          case "approve": S.done[d.id] = "approved"; S.banner = "Approved and sent: " + d.dest + "."; S.sel = nextPending(d.id); break;
          case "reject": S.done[d.id] = "rejected"; S.banner = "Rejected. The reason will be asked to improve the agent."; S.sel = nextPending(d.id); break;
          case "edit": S.banner = "In the final version, the text becomes editable here before sending."; break;
          case "new": S.banner = "Creating an agent: role, trigger, allowed actions, guardrails, tests, owner."; break;
          case "tests": S.banner = "Tests rerun for " + byId[S.agent].name + ": " + byId[S.agent].tests + " passed."; break;
          case "pause": S.flip[S.agent] = !S.flip[S.agent]; S.banner = ""; break;
          default: return;
        }
        render();
      });
      render();
      return { render: render };
    }
  };
})();

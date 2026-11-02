/* ================= render: build ================= */
function render(){if(!cur())return;$all(".os2seg [data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===S.view));$all(".os2seg [data-sub]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.sub===(S.sub||"plan")));renderBar();
 
 if(S.view==="build"){const kb=S.sub==="krs",vb=$id("v-build");if(vb)vb.classList.toggle("krmode",kb);if(kb){const w0=$one(".kbw"),x=w0&&S.kbMoved?w0.scrollLeft:null;$id("ws").innerHTML=boardHTML();const w1=$one(".kbw");if(w1){/* the board opens on this week (W-1 at the left edge); a sideways scroll by the person is kept (Romain 2026-11-02) */const go=()=>{w1.scrollLeft=x!=null?x:Math.max(0,(SK.week-2)*156)};go();requestAnimationFrame(go);setTimeout(go,120);w1.addEventListener("scroll",()=>{if(Math.abs(w1.scrollLeft-Math.max(0,(SK.week-2)*156))>4)S.kbMoved=true},{passive:true})}}else{renderSteps();renderScore();renderWS();renderCarry()}renderFeed();renderGuideActions()}
 if(S.view==="exec")renderExec();save()}
function renderSteps(){const P=plan();$id("steps").innerHTML=STEPS.map(([k,n,d],i)=>{const is=stepIssues(P,k);
 return `<button class="step ${is?"":"ok"}" data-step="${k}" aria-current="${S.step===k}"><span class="n">${is?i+1:"✓"}</span><span><b>${n}</b></span>${is?`<span class="badge">${is}</span>`:`<span class="badge ok">OK</span>`}</button>`}).join("")}
function renderScore(){const P=plan(),q=quality(P),col=q>=85?"var(--ok)":q>=60?"var(--late)":"var(--crit)";
 $id("score").innerHTML=`<div class="qrow"><span class="pk">${esc(krShort(krOf(S.kr)))} · quality</span><b style="color:${col}">${q}<small> %</small></b></div><div class="qbar"><i style="width:${q}%;background:${col}"></i></div>`}
function krTabs(){const sel=S.sel||[];return sel.length>1?`<div class="krtabs" role="tablist" aria-label="Targeted key results">${sel.map(id=>{const K=krOf(id),Q=planOf(id);return `<button role="tab" data-pickkr="${id}" aria-selected="${id===S.kr}">${esc(krShort(K))} <span class="note">${Q.ms.length} ms</span></button>`}).join("")}</div>`:""}
function head(title,sub,rule){return (!["outcome","milestones","tasks","estimates","premortem","commit"].includes(S.step)?krTabs():"")+`<div class="wsh"><div><h1>${title}</h1></div><div style="display:flex;gap:8px"><button class="btn" data-ask="1">Review with Claude</button>${S.step!=="commit"?`<button class="btn p" data-next="1" ${blockedFrom(STEPS.findIndex(s=>s[0]===S.step)+1)?"aria-disabled=\"true\" title=\"Choose the milestones to keep first\"":""}>Next →</button>`:""}</div></div>`}
// someone else's milestone or task (Romain 2026-11-02): what is missing is theirs to fix, shown in grey, never as a red check of yours
const neutralHTML=t=>`<div class="checks"><span class="chk" style="background:var(--soft,#ECE8DF);color:var(--muted,#5E5B53)">${esc(t)}</span></div>`;
const checksHTML=c=>`<div class="checks">${c.map(x=>`<span class="chk ${x.ok?"":(x.hard?"x":"w")}">${x.ok?"✓":x.hard?"✕":"!"} ${esc(x.lab)}</span>`).join("")}</div>`;
function renderWS(){const P=plan(),K=krOf(P.kr),el=$id("ws");let h="";
 if(S.step==="outcome"){
  h=head("The outcome","Everything in the roadmap serves one measurable change. Choose up to 3 key results you target this week.","<b>Rule.</b> A number and one owner per key result, due at the end of the quarter; the week holds 3 milestones at most across them.")+krPickHTML()+
  ``}
 if(S.step==="milestones"||S.step==="tasks"){const keep=S.kr,ids=(S.sel||[]).length?S.sel.slice():[S.kr],tasks=S.step==="tasks";
  const hm=head("Milestones","Set what must be true this week, three milestones at most. Later weeks can stay open: you build them when their week comes. Each milestone is a checkpoint anyone can verify.",
   `<b>Rules.</b> A result, not an activity · proof lines checked on Sunday 8 pm · one owner · at most ${R.msWeek} per week: more than that and nobody checks them properly on Sunday. The step counts only <b>your</b> milestones of this week: the others are set up by their owners.`);
  const ht=head("Tasks","Under each milestone, the next physical actions that deliver its proof. Small enough to finish in one sitting.",`<b>Rules.</b> Starts with a verb · says what done looks like · one owner · ${R.taskMax} h at most (split bigger ones) · together, the tasks deliver every proof line. Each of <b>your</b> milestones of this week needs tasks; others' milestones need none of yours.`);
  h=(tasks?ht:hm)+ids.map(id=>{S.kr=id;const P=plan(),K=krOf(id),G=gaps(P);
   return `<section class="krsec" data-krsec="${id}"><div class="krsech"><b class="mono">${esc(krShort(K))}</b><span>${esc(K.t.split(" · ").slice(1).join(" · "))}</span><span class="sp"></span>${av(K.o)}<span class="note">${TEAM[K.o]?nm(K.o):"—"} · ${P.ms.length} milestone${P.ms.length===1?"":"s"}</span></div>`+
   (tasks?(P.ms.length?P.ms.map(m=>msCard(P,m,true)).join(""):`<div class="card empty">Add milestones first.</div>`)
   :chooserHTML(P)+(G.length?`<div class="rule" style="background:var(--crits);border-color:var(--crit)"><span class="ic" style="color:var(--crit)">!</span><span><b>Gap.</b> ${G.map(g=>"W"+g[0]+(g.length>1?"–W"+g[g.length-1]:"")).join(", ")} ${G.length>1?"have":"has"} no milestone: a slip there stays invisible.</span></div>`:"")+
    (P.ms.length?P.ms.slice().sort((a,b)=>b.w-a.w).map(m=>msCard(P,m,false)).join(""):`<div class="card empty">No milestone yet for this key result.</div>`)+`<div><button class="btn" data-addms="1">+ Add a milestone to ${esc(krShort(K))}</button></div>`)+`</section>`}).join("");S.kr=keep}
 if(S.step==="estimates"){
  h=head("Estimates","People are optimistic about their own time. The OS corrects each estimate with that person's record, then checks nobody is planned over the week.",`<b>Rules.</b> Nobody plans more than ${R.weekMax} h in a week (${R.dayH} h × ${R.days} days) · estimate the hours of real work · the coefficient (actual ÷ estimated) comes from Execute · a task above ${R.taskMax} h goes back to Tasks to be split.`)+loadHTML(selIds())+
  perKr(P=>{const T=allTasks(P);return T.length?`<div class="card tw"><table class="t"><thead><tr><th>Task</th><th>Owner</th><th>Your estimate</th><th>Coefficient</th><th>Planned</th><th></th></tr></thead><tbody>${T.map(t=>{const o=ownerOf(P,t),bad=!(+t.e>0)||+t.e>R.taskMax;
   return `<tr><td>${esc(t.t)}<div class="note">M${P.ms.findIndex(m=>m.id===t._m)+1}</div></td><td><span class="who">${av(o)}${TEAM[o]?nm(o):"No owner"}</span></td><td><input class="num" type="number" min="0" step="0.5" data-te="${t.id}" value="${t.e||""}" aria-label="Estimate in hours"> h</td><td class="n">× ${coef(o).toFixed(1)}</td><td class="n"><b>${(+t.e?cal(P,t):0).toFixed(1)} h</b></td><td>${bad?`<span class="chk x">✕ ${!(+t.e>0)?"No estimate":"Split it"}</span>`:`<span class="chk">✓</span>`}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="card" style="padding:14px 18px"><span class="note">No task in this key result yet.</span></div>`});
  }
  if(S.step==="premortem"){
  h=head("Pre-mortem","Imagine each key result missed its deadline. Why did it happen? Naming the risk now is how you avoid it.","<b>Rule.</b> At least one risk per milestone, each with a mitigation. A mitigation that needs work becomes a task. The step counts only <b>your</b> milestones of this week: others run their own pre-mortem.")+perKr(P=>  P.ms.map((m,i)=>{const rc=riskChecks(P,m);return `<div class="card ms"><div class="msh"><div class="msn"><b>M${i+1}</b>W${m.w}</div><div><b style="font-family:var(--serif);font-size:16px;font-weight:500">${esc(m.t)}</b><div class="meta">${rc.info?`<div class="checks"><span class="chk" style="background:var(--soft,#ECE8DF);color:var(--muted,#5E5B53)">${esc(rc.lab)}</span></div>`:checksHTML([{ok:rc.ok,hard:1,lab:rc.lab}])}</div></div></div>
   <div class="tasks">${m.risks.map((r,k)=>`<div class="risk"><input data-rk="${m.id}:${k}:t" value="${esc(r.t)}" placeholder="What could make it late" aria-label="Risk"><input data-rk="${m.id}:${k}:mit" value="${esc(r.mit)}" placeholder="Mitigation" aria-label="Mitigation"><select data-rk="${m.id}:${k}:l" aria-label="Likelihood">${["low","medium","high"].map(l=>`<option ${r.l===l?"selected":""}>${l}</option>`).join("")}</select><button class="x" data-rmrisk="${m.id}:${k}" aria-label="Remove risk">×</button></div>`).join("")}
   <div class="addrow"><button class="btn sm" data-addrisk="${m.id}">+ Add a risk</button> ${m.risks.some(r=>r.mit)?`<button class="btn sm ghost" data-mittask="${m.id}">Turn the mitigation into a task</button>`:""}</div></div></div>`}).join(""))}
 if(S.step==="commit")h=commitHead()+myCommitHTML();
 const lk=lockedWeek();if(lk&&S.step!=="commit")h=`<div class="rule"><span class="ic">🔒</span><span>Your week W${isoWk(D().n)} is committed${lk.at?" since "+esc(new Date(lk.at).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})):""}: the roadmap is locked until next week. Execute is open.</span></div>`+h;
 el.innerHTML=h;el.querySelectorAll("textarea.ti,textarea.tkt").forEach(fit);
 if(lk){el.querySelectorAll("input,textarea,select").forEach(x=>{if(x.id!=="who"&&!x.closest("#gform"))x.disabled=true});el.querySelectorAll(EDITSEL).forEach(x=>{x.disabled=true})}}
function perKr(fn){const keep=S.kr,ids=(S.sel||[]).length?S.sel.slice():[S.kr];const out=ids.map(id=>{S.kr=id;const P=plan(),K=krOf(id);
  return `<section class="krsec" data-krsec="${id}"><div class="krsech"><b class="mono">${esc(krShort(K))}</b><span>${esc(K.t.split(" · ").slice(1).join(" · "))}</span><span class="sp"></span>${av(K.o)}<span class="note">${TEAM[K.o]?nm(K.o):"—"} · ${P.ms.length} milestone${P.ms.length===1?"":"s"}</span></div>${fn(P,K)}</section>`}).join("");S.kr=keep;return out}
function msCard(P,m,withTasks){const i=P.ms.indexOf(m),c=msChecks(P,m);
 return `<div class="card ms"><div class="msh"><div class="msn"><b>M${i+1}</b>W${m.w}</div><div>
  <textarea class="ti" rows="1" data-mf="${m.id}:t" aria-label="Milestone">${esc(m.t)}</textarea>
  <div class="meta">${weekSel(m.w,`data-mf="${m.id}:w" aria-label="Week"`)}${ownerSel(m.o,`data-mf="${m.id}:o" aria-label="Owner"`)}</div>
  ${(()=>{const f=(withTasks?c.filter(x=>x.k==="tasks"):c.filter(x=>x.k!=="tasks")).filter(x=>!x.ok);if(!f.length)return "";if(!mine(m,P))return `<div class="meta">${neutralHTML(`${ownerOfMs(m,P)?nm(ownerOfMs(m,P)):"Its owner"} sets it up: `+f.map(x=>x.lab).join(" · "))}</div>`;return `<div class="meta">${checksHTML(f)}</div>`})()}</div>
  <div class="acts"><button class="x" data-rmms="${m.id}" aria-label="Remove milestone">×</button></div></div>
  ${withTasks?`<div class="tasks">${m.tasks.map((t,k)=>{const bad=taskChecks(P,t).filter(x=>!x.ok),o=t.o,theirs=(t.o||ownerOfMs(m,P))!==(S.exec&&S.exec.who);return `<div class="tk ${bad.some(x=>x.hard)&&!theirs?"bad":""}"><span class="tkn">${k+1}</span><div class="tkb">
  <textarea class="tkt" rows="1" data-tf="${t.id}:t" placeholder="Verb + object: the next physical action" aria-label="Task">${esc(t.t)}</textarea>
  <label class="tkd"><span>Done when</span><input data-tf="${t.id}:dw" value="${esc(t.dw)}" placeholder="What anyone can check when it is finished" aria-label="Done when"></label>
  <div class="tkm"><span class="tko">${av(o)}${ownerSel(o,`data-tf="${t.id}:o" aria-label="Owner"`)}</span>
   <span class="tkh"><button class="stp" data-th="${t.id}:-" aria-label="Less time">−</button><input class="num" type="number" min="0" step="0.5" data-tf="${t.id}:e" value="${t.e||""}" aria-label="Hours"><span>h</span><button class="stp" data-th="${t.id}:+" aria-label="More time">+</button></span>
   ${t.e?`<span class="note mono">${hrs(cal(P,t))} planned</span>`:""}
   <span class="sp"></span>${bad.length?(theirs?neutralHTML(`${TEAM[o||ownerOfMs(m,P)]?nm(o||ownerOfMs(m,P)):"Its owner"} finishes it: `+bad.map(x=>x.lab).join(" · ")):checksHTML(bad)):`<span class="chk">✓ Ready</span>`}<button class="x" data-rmt="${t.id}" aria-label="Remove task">×</button></div></div></div>`}).join("")}<div class="addrow"><button class="btn sm" data-addt="${m.id}">+ Add a task</button></div></div>`
  :`<div class="proof"><span class="pk">Proof</span>${m.proof.map((p,k)=>`<div class="pr"><input data-pf="${m.id}:${k}" value="${esc(p)}" placeholder="Something anyone can check" aria-label="Proof line"><button class="x" data-rmp="${m.id}:${k}" aria-label="Remove proof line">×</button></div>`).join("")}<div><button class="btn sm ghost" data-addp="${m.id}">+ Add a proof line</button></div></div>`}</div>`}

// Planned hours per person per week, against the limit (9 h a day, 6 days a week). A task counts in its milestone's week.
// Hours per person and week across several key results at once (Estimates shows the ticked key results on one screen, Romain 2026-11-02):
// plan = the tasks of these key results, other = every other key result with a plan, carry = carried over hours
function weekLoadIds(ids){const weeks=Array.from({length:R.last-R.start+1},(_,i)=>R.start+i),rows={},add=(o,w,k,h)=>{if(!o||w<R.start||w>R.last)return;const r=rows[o]=rows[o]||{};const c=r[w]=r[w]||{plan:0,other:0,carry:0};c[k]+=h};
 ids.forEach(id=>{const Q=planOf(id);allTasks(Q).forEach(t=>{const o=ownerOf(Q,t);if(+t.e>0)add(o,findM(Q,t._m).w,"plan",cal(Q,t))})});
 const people=Object.keys(rows);
 KRS.filter(k=>!ids.includes(k.id)&&hasPlan(k.id)).forEach(k=>{const Q=planOf(k.id);allTasks(Q).forEach(t=>{const o=ownerOf(Q,t);if(people.includes(o)&&+t.e>0)add(o,findM(Q,t._m).w,"other",cal(Q,t))})});
 if(S.carryReserve!==false)Object.entries(reserveByPerson()).forEach(([o,h])=>{if(people.includes(o))add(o,R.start,"carry",h)});
 const over=[];people.forEach(o=>weeks.forEach(w=>{const c=rows[o][w];if(c&&c.plan+c.other+c.carry>R.weekMax+.01)over.push({o,w,h:c.plan+c.other+c.carry})}));
 return {weeks,rows,people,over}}
function weekLoad(P){return weekLoadIds([P.kr])}
const selIds=()=>((S.sel||[]).length?S.sel.slice():[S.kr]).filter(Boolean);
function loadHTML(ids){const L=weekLoadIds(ids),TT=ids.flatMap(id=>{const Q=planOf(id);return allTasks(Q).map(t=>[Q,t])}),T=TT.map(x=>x[1]),tot=TT.reduce((a,[Q,t])=>a+(+t.e?cal(Q,t):0),0),est=T.reduce((a,t)=>a+(+t.e||0),0);
 const peak=Math.max(0,...L.people.flatMap(o=>L.weeks.map(w=>{const c=L.rows[o][w];return c?c.plan+c.other+c.carry:0})));
 return `<div class="card fc"><div class="fchead"><div><div class="pk">Planned</div><div class="big">${tot.toFixed(1)}<span style="font-size:22px"> h</span></div><div class="note">for ${est.toFixed(1)} h estimated · ${T.filter(t=>+t.e>0).length} task${T.filter(t=>+t.e>0).length===1?"":"s"}</div></div>
  <div><div class="pk">Busiest week</div><div class="big" style="font-size:36px;color:${peak>R.weekMax?"var(--crit)":peak>R.weekMax*.85?"var(--late)":"var(--ok)"}">${peak.toFixed(1)} h</div><div class="note">limit ${R.weekMax} h</div></div>
  <div><span class="verdict ${L.over.length?"x":"ok"}">${L.over.length?`✕ ${L.over.length} week${L.over.length>1?"s":""} over ${R.weekMax} h`:`✓ Every week under ${R.weekMax} h`}</span></div></div>
 ${L.over.length?`<div class="rule" style="background:var(--crits);border-color:var(--crit)"><span class="ic" style="color:var(--crit)">!</span><span>${L.over.map(x=>`<b>${nm(x.o)}</b> has ${x.h.toFixed(1)} h planned in W${x.w}: ${(x.h-R.weekMax).toFixed(1)} h to move, cut or give to someone else`).join(" · ")}.</span></div>`:""}
 <div class="tw"><table class="t wl"><thead><tr><th>Planned hours per week</th>${L.weeks.map(w=>`<th class="n">W${w}</th>`).join("")}</tr></thead><tbody>${L.people.map(o=>`<tr><td><span class="who">${av(o)}${TEAM[o]?nm(o):o}</span></td>${L.weeks.map(w=>{const c=L.rows[o][w],h=c?c.plan+c.other+c.carry:0,cls=h>R.weekMax+.01?"x":h>R.weekMax*.85?"w":h?"ok":"";
   return `<td class="n wc ${cls}" title="${c?`These key results ${c.plan.toFixed(1)} h · other key results ${c.other.toFixed(1)} h · carried over ${c.carry.toFixed(1)} h`:"Nothing planned"}"><b>${h?h.toFixed(1):"·"}</b>${h?`<i style="width:${Math.min(100,h/R.weekMax*100)}%"></i>`:""}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>
 </div>`}
function commitHead(){return head("Commit","Your roadmap becomes your order of work. Each person commits their own roadmap for the week: their milestones, their tasks, their hours. Execute then serves your tasks one at a time, earliest milestone first.",`<b>Rule.</b> You commit your own roadmap only: no blocking issue on your milestones and tasks of this week (Milestones, Tasks, Estimates, Pre-mortem), and you are not planned over ${R.weekMax} h in a week.`)}
// Commit is personal (Romain 2026-11-02): each member commits their own roadmap of the week, stored as their week ("weeks" <member>:W<week>,
// {at, by, krs}); it opens Execute for them. Nobody commits a key result for the team any more.
const CSTEPS=[["milestones","Milestones"],["tasks","Tasks"],["estimates","Estimates"],["premortem","Pre-mortem"]];
function myIssues(){return CSTEPS.map(([k,n])=>({k,n,v:stepIssues(plan(),k)}))}
function myOrder(){const who=S.exec&&S.exec.who,rows=[];selIds().forEach((id,ki)=>{const Q=planOf(id),F=forecast(Q);FC.sig="";(F.order||[]).forEach((t,ti)=>{if(ownerOf(Q,t)===who){const m=findM(Q,t._m);rows.push({Q,t,m,ki,ti})}})});
 return rows.sort((a,b)=>(a.m?a.m.w:99)-(b.m?b.m.w:99)||a.ki-b.ki||a.ti-b.ti)}
function myCommitHTML(){const who=S.exec.who,w=isoWk(D().n),done=(S.weeks||{})[weekKey(who,w)],iss=myIssues(),bad=iss.reduce((a,x)=>a+x.v,0),sel=(S.sel||[]).length,rows=myOrder(),
  tot=rows.reduce((a,r)=>a+(+r.t.e?cal(r.Q,r.t):0),0),open=carryItems().filter(c=>!c.st&&c.who===who),ready=!bad&&sel>0,self=!SK.me||SK.me===who;
 return `<div class="card fc weekc"><div class="xsh"><span class="pk">Roadmap of ${esc(nm(who))} · W${w}</span><span class="sp"></span>${personSel()}</div>
 <div class="fchead"><div><div class="pk">Ready to commit</div><div class="big" style="font-size:36px">${ready?"Yes":"Not yet"}</div><div class="note">${rows.length} task${rows.length===1?"":"s"} · ${tot.toFixed(1)} h planned</div></div>
 <div style="flex:1;min-width:240px"><div class="checks"><button class="chk ${sel?"":"x"}" data-step="outcome">${sel?"✓":"✕"} ${sel} key result${sel===1?"":"s"} targeted</button>${iss.map(x=>`<button class="chk ${x.v?"x":""}" data-step="${x.k}">${x.v?"✕":"✓"} ${x.n}${x.v?` · ${x.v} to fix`:""}</button>`).join("")}<span class="chk ${open.length?"w":""}">${open.length?`! ${open.length} carried over from last week (${hrs(open.reduce((a,c)=>a+c.e,0))})`:"✓ Nothing carried over"}</span></div></div></div>
 ${done?`<div class="rule"><span class="ic">✓</span><span>Roadmap W${w} committed by ${esc(nm(done.by||who))}${done.at?" on "+esc(new Date(done.at).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})):""}${done.override?" (unlocked by a lead)":""}. Execute is open for ${esc(nm(who))}.</span></div>`:""}
 <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${done&&Array.isArray(done.krs)?`<span class="chk">🔒 Locked until next week</span>`:`<button class="btn p" data-commit="1" ${ready&&self?"":"disabled"}>Commit my roadmap W${w}</button>`}${self?"":`<span class="note">Only ${esc(nm(who))} commits their roadmap.</span>`}${sel?"":`<span class="note">Tick at least one key result in The outcome.</span>`}</div>
 ${!ready&&!done?`<details class="ovr"><summary>Unlock anyway (lead only)</summary><div class="oadd"><input id="wovr" placeholder="Why the week is unlocked without a committed roadmap (logged as a decision)" aria-label="Reason"><button class="btn" data-weekovr="1">Unlock</button></div></details>`:""}</div>
 <div class="card tw"><table class="t"><thead><tr><th>#</th><th>Your task</th><th>Key result · milestone</th><th>Week</th><th>Planned</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="n">${i+1}</td><td>${esc(r.t.t||"(untitled task)")}</td><td><span class="note">${esc(krShort(krOf(r.Q.kr)))} · M${r.Q.ms.indexOf(r.m)+1} ${esc((r.m&&r.m.t||"").slice(0,60))}</span></td><td class="n">${r.m?"W"+r.m.w:"—"}</td><td class="n">${+r.t.e?cal(r.Q,r.t).toFixed(1)+" h":"—"}</td></tr>`).join("")||`<tr><td colspan="5"><span class="note">No task of yours in the targeted key results yet.</span></td></tr>`}</tbody></table></div>`}
/* ================= carried over from last week ================= */
// What last week left behind, per person, from their Execute days: unfinished tasks and objectives carried to the next
// day, help accepted for tomorrow, and what went back to the queue
function carryFromDays(){const out=[];Object.keys(TEAM).forEach(who=>{const st=S.exec&&S.exec.who===who?S.exec:stateOf(who);const day=st&&st.day;if(!day||!st.d0)return;
 const wk=isoWeekUTC(dayDateOf(st.d0,day.n));if(wk>=R.start||day.phase!=="setup")return;
 (day.carried||[]).forEach(i=>out.push({id:"cv-"+who+"-"+i.id,who,type:i.src==="help"?"request":"task",t:i.t,why:i.src==="help"?"Help accepted for "+dayLbl(day.n,1):"Not finished on "+dayLbl(day.n-1,1),e:+i.e||1,from:i.req&&i.req.from||""}));
 (day.own||[]).filter(o=>o.carried).forEach((o,k)=>out.push({id:"co-"+who+"-"+k+"-"+day.n,who,type:"objective",t:o.t,why:"Objective not reached on "+dayLbl(day.n-1,1),e:+o.h||1}))});
 Object.keys(TEAM).forEach(who=>{const st=S.exec&&S.exec.who===who?S.exec:stateOf(who);((st&&st.pool)||[]).forEach(i=>out.push({id:i.id,who,type:"request",t:i.t,why:"Back to the queue in Execute",e:+i.e||1}))});return out}
const CT={task:"Task",objective:"Objective",request:"Request"};
function carryItems(){const out=carryFromDays();
 return out.map(c=>Object.assign(c,{st:(S.carryDone||{})[c.id]}))}
function reserveByPerson(){if(S.carryReserve===false)return {};const r={};carryItems().forEach(c=>{if(!c.st&&c.type!=="request")r[c.who]=(r[c.who]||0)+c.e*coef(c.who)});return r}
function renderCarry(){const el=$id("carry");if(!el)return;const P=plan(),people=new Set(allTasks(P).map(t=>ownerOf(P,t)).concat(P.ms.map(m=>m.o)).filter(Boolean)),all=carryItems(),open=all.filter(c=>!c.st),mine=open.filter(c=>people.has(c.who)),other=open.filter(c=>!people.has(c.who));
 const by={};open.forEach(c=>by[c.who]=(by[c.who]||0)+c.e);const tot=open.reduce((a,c)=>a+c.e,0);
 const row=c=>`<div class="cri ${c.type}"><div class="crh"><span class="crt">${CT[c.type]}</span>${av(c.who)}<span class="note">${TEAM[c.who]?nm(c.who):""}${c.from&&TEAM[c.from]?" · asked by "+nm(c.from):""}</span><span class="mono crh2">${hrs(c.e)}</span></div><b>${esc(c.t)}</b><span class="note">${esc(c.why)}${c.src?" · "+esc(c.src):""}</span>
  <div class="cra">${P.ms.length?`<select data-cplan="${c.id}" aria-label="Plan it under a milestone"><option value="">Plan it under…</option>${P.ms.map((m,i)=>`<option value="${m.id}">M${i+1} · W${m.w} · ${esc(m.t.length>34?m.t.slice(0,32)+"…":m.t)}</option>`).join("")}</select>`:""}<button class="btn sm ghost" data-cdrop="${c.id}">Not in this plan</button></div></div>`;
 const open2=S.carryOpen!==false;el.classList.toggle("shut",!open2);
 el.innerHTML=`<button class="crhd" data-ctog="1" aria-expanded="${open2}"><span><b>Carried over from last week</b></span><span class="chk ${tot?"w":""}">${hrs(tot)}</span><span class="crcar" aria-hidden="true">${open2?"▾":"▸"}</span></button>${open2?`
 ${open.length?`<div class="crsum">${Object.entries(by).map(([w,h])=>`<span>${av(w)} ${TEAM[w]?nm(w):w} <b class="mono">${hrs(h)}</b></span>`).join("")}</div>
 <label class="crres"><input type="checkbox" data-cres="1" ${S.carryReserve!==false?"checked":""}> Count in W${R.start} load</label>
 <div class="crl">${mine.length?`<span class="pk">People in this plan</span>${mine.map(row).join("")}`:""}${other.length?`<span class="pk">Rest of the team</span>${other.map(row).join("")}`:""}</div>`:`<p class="note">Nothing left over. Last week closed clean.</p>`}
 ${all.some(c=>c.st)?`<p class="note">${all.filter(c=>c.st==="planned").length} planned, ${all.filter(c=>c.st==="dropped").length} set aside. <button class="btn sm ghost" data-creset="1">Show them again</button></p>`:""}
 `:""}`}
/* ================= the week must be set up before Execute ================= */
// From Sunday 2 pm, Execute opens only once the coming week is set up in Build (demo: the week of the simulated day)
const weekKey=(who,w)=>who+":W"+w;
function weekNeeds(who){return []} // the week opens with the person's own committed roadmap (Build › Commit), not with key result commits
function weekGateHTML(day){const who=S.exec.who,w=isoWk(day.n),need=weekNeeds(who),open=carryItems().filter(c=>!c.st&&c.who===who);
 return `<div class="card xwin gate"><span class="pk" style="color:var(--crit)">Execute is locked</span><h2 style="margin:0;font-family:var(--serif);font-weight:500;font-size:30px">Set up week W${w} first</h2>
 
 <ul class="mini">
 <li><span>${open.length?"!":"✓"} <b>Carried over from last week</b> ${open.length?open.map(c=>esc(c.t)).join(" · "):"nothing"}</span><span class="chk ${open.length?"w":""}">${open.length?hrs(open.reduce((a,c)=>a+c.e,0)):"clear"}</span></li>
 <li><span>✕ <b>Your roadmap committed</b> in Build › Commit</span><span class="chk x">To do</span></li></ul>
 <div class="xfoot"><span class="note">${personSel()}</span><button class="btn p" data-gobuild="1">Build my week →</button></div></div>`}
const OBJ={1:"O1 · Operations",2:"O2 · Marketing",3:"O3 · Sales"};
function krPickHTML(){const P=plan(),sel=S.sel||[];
 const row=k=>{const on=sel.includes(k.id),act=k.id===S.kr,Pk=S.plans[k.id],wk=(S.weeks||{})[weekKey(S.exec.who,isoWk(D().n))],st=wk&&(wk.krs||[]).includes(k.id)?["Committed",""]:Pk&&Pk.ms&&Pk.ms.length?[`${Pk.ms.length} drafted`,"w"]:["No plan","x"];
  return `<div class="kpl ${on?"on":""} ${act?"act":""}"><button class="kpb" data-selkr="${k.id}" role="checkbox" aria-checked="${on}" aria-label="Target ${esc(krShort(k))}">${on?"✓":""}</button>
  <button class="kpn" data-pickkr="${k.id}" title="${esc(k.t)}"><b>${esc(k.t.split(" · ")[0])}</b><span>${esc(k.t.split(" · ").slice(1).join(" · "))}</span></button>
  <span class="kpw2">${av(k.o)}<span>${TEAM[k.o]?nm(k.o):"—"}</span></span><span class="mono kpv">${esc(k.now)} → ${esc(k.tg)}</span><span class="chk ${st[1]}">${st[0]}</span>${act?`<span class="kpon2">Working on</span>`:""}</div>`};
 return `<div class="card kpick"><div class="xsh"><span class="pk">Key results this week · ${sel.length} of ${R.krMax}</span><span class="sp"></span>${personSel()}</div>
 ${objIds().map(o=>{const ks=KRS.filter(k=>k.obj===String(o));return ks.length?`<div class="kpg2"><span class="kpo">${esc(objLabel(o))}</span>${ks.map(row).join("")}</div>`:""}).join("")}
 <div class="kpx2">${sel.length?`<span class="kpd">Deadline of every key result: <b>the end of the quarter, ${SK.wl(13)}</b></span>`:""}
 ${sel.length?"":`<span class="chk x">✕ No key result ticked: The outcome and the week cannot be validated</span>`}<span class="note">Tick up to ${R.krMax} key results; the week holds ${R.msWeek} milestones at most across them. Click a key result to work on it in the next steps.</span></div></div>`}
/* weekly measures (Romain 2026-10-31): the value of each week typed by hand, e.g. 3.2 closing rate W43 20 %, W44 22 %; one check-in per
   week in the key result (kept with its confidence and notes when it exists), the current value = the latest week measured */
const measOf=K=>SK.krWeeks(K)
function measHTML(id){const K=SK.get("krs",id);if(!K)return "";const by=measOf(K),cur=SK.week,Q=Array.from({length:13},(_,i)=>i+1),u=K.unit==="pct"?"%":K.unit==="eur"||K.unit==="eur2"?"€":K.unit==="usd"?"$":"";
 const pts=Q.filter(q=>by[q]&&by[q].value!==""&&by[q].value!=null).map(q=>[q,Number(by[q].value)]),plan=(K.plan||[]).map(p=>[+p[0],+p[1]]),all=pts.map(p=>p[1]).concat(plan.map(p=>p[1]),[+K.target||0,+K.baseline||0]),lo=Math.min(...all),hi=Math.max(...all),sp=hi-lo||1;
 const X=q=>8+(q-1)*(484/12),Y=v=>70-((v-lo)/sp)*60,line=a=>a.map(p=>X(p[0]).toFixed(1)+","+Y(p[1]).toFixed(1)).join(" ");
 const svg=`<svg class="msv" viewBox="0 0 500 78" role="img" aria-label="Weekly measures of ${esc(krShort(krOf(id)))}"><line x1="${X(cur)}" y1="4" x2="${X(cur)}" y2="76" stroke="#D8D3C7"/>${plan.length>1?`<polyline points="${line(plan)}" fill="none" stroke="#1B1B18" stroke-width="1.2" stroke-dasharray="4 4"/>`:""}${pts.length>1?`<polyline points="${line(pts)}" fill="none" stroke="#9A6614" stroke-width="2.5" stroke-linejoin="round"/>`:""}${pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="#9A6614"/>`).join("")}</svg>`;
 return `<div class="meas"><div class="xsh"><span class="pk">Weekly measures · ${esc(krShort(krOf(id)))}</span><span class="sp"></span><span class="note">Target ${esc(SK.fmtVal(K.target,K.unit))} · dashed: plan</span></div>${svg}
  <div class="mgrid">${Q.map(q=>`<label class="mcell ${q===cur?"now":""}" for="meas${q}"><span>${SK.wl(q)}</span><input id="meas${q}" data-meas="${q}" data-measkr="${esc(id)}" type="number" step="any" inputmode="decimal" value="${by[q]&&by[q].value!=null?esc(by[q].value):""}" placeholder="${q>cur?"":"—"}" ${q>cur?"disabled":""} aria-label="${SK.wl(q)} measure${u?" ("+u+")":""}"></label>`).join("")}</div>
  <p class="note">Type the value measured for each week${u?" ("+u+")":""}. It is saved at once as that week's check-in; changing a recorded value asks first; the latest week gives the current value.</p></div>`}
/* Key Results › Weekly results (Romain 2026-10-31: "où mettre les résultats de chaque semaine"): every key result, one row, its
   13 weeks; a value typed is saved at once like in step 1 (one check-in per week) */
function measTabHTML(){const Q=Array.from({length:13},(_,i)=>i+1),cur=SK.week;
 const rows=objIds().map(o=>{const ks=KRS.filter(k=>k.obj===o);if(!ks.length)return "";return `<tr class="mto"><th colspan="15">${esc(objLabel(o))}</th></tr>`+ks.map(k=>{const K=SK.get("krs",k.id)||{},by=measOf(K),u=K.unit==="pct"?"%":K.unit==="eur"||K.unit==="eur2"?"€":K.unit==="usd"?"$":"";
  return `<tr><th class="mtk"><b>${esc(k.t.split(" · ")[0])}</b> ${esc(k.t.split(" · ").slice(1).join(" · "))}<small>${esc(nm(k.o))} · target ${esc(SK.fmtVal(K.target,K.unit))}</small></th><td class="mtu">${u||"#"}</td>${Q.map(q=>`<td class="${q===cur?"now":""}"><input data-meas="${q}" data-measkr="${esc(k.id)}" type="number" step="any" inputmode="decimal" value="${by[q]&&by[q].value!=null?esc(by[q].value):""}" ${q>cur?"disabled":""} aria-label="${esc(krShort(k))}, ${SK.wl(q)}"></td>`).join("")}</tr>`}).join("")}).join("");
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:min(1320px,100%)" role="dialog" aria-modal="true" aria-labelledby="mth"><div class="dh"><div><div class="pk">Key results</div><h2 id="mth" style="font-size:22px">Weekly results</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <p class="note">The value measured each week, for each key result. Type it and leave the cell: a new value is saved at once as that week's check-in; changing or removing a recorded one asks first. The latest week becomes the current value. Future weeks open when they come.</p>
 <div class="mtw"><table class="mtab"><thead><tr><th class="mtk">Key result</th><th></th>${Q.map(q=>`<th class="${q===cur?"now":""}">${SK.wl(q)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
 <div style="display:flex;justify-content:flex-end"><button class="btn p" data-close="1">Done</button></div></div></div></div>`}
function saveMeas(q,raw,kr){SK.krWeekAsk(kr||S.kr,q,raw,(ok,msg)=>{if(msg)toast(msg);if(!ok){render();renderPop()}})}
function chooserHTML(P){const O=overWeeks(P);if(!O.length)return "";return O.map(({w,list})=>{const c=S.choose[P.kr+":"+w]||(S.choose[P.kr+":"+w]={keep:[],act:{}}),kept=c.keep.filter(id=>list.some(m=>m.id===id)),room=x=>P.ms.filter(m=>m.w===x).length;
 const targets=Array.from({length:P.due-R.start+1},(_,i)=>R.start+i).filter(x=>x!==w);
 const cap=capIn(P,w),ready=kept.length===cap&&list.filter(m=>!kept.includes(m.id)).every(m=>c.act[m.id]);
 return `<div class="card chooser" data-week="${w}"><div class="chh"><span class="ic">!</span><div><b>W${w} has ${list.length+othersIn(P,w)} ${w===R.start?"of your milestones across the targeted key results":"milestones"}. Keep ${cap} here.</b></div><span class="chk ${kept.length===cap?"":"w"}">${kept.length} of ${cap} kept</span></div>
 ${list.map(m=>{const k=kept.includes(m.id),i=P.ms.indexOf(m);return `<div class="chr ${k?"on":""}"><button class="msel ${k?"on":""}" data-ckeep="${w}:${m.id}" aria-pressed="${k}"><span class="mbox">${k?"✓":""}</span><span class="mb"><span class="mt"><b>M${i+1}</b> ${esc(m.t||"Untitled milestone")}</span><span class="mm">${av(m.o)}<span>${TEAM[m.o]?nm(m.o):"No owner"}</span><span>${m.tasks.length} task${m.tasks.length!==1?"s":""} · ${m.proof.filter(x=>x.trim()).length} proof line${m.proof.filter(x=>x.trim()).length!==1?"s":""}</span></span></span></button>
  ${k?`<span class="note">Stays in W${w}</span>`:`<select data-cact="${w}:${m.id}" aria-label="What happens to M${i+1}"><option value="">Choose: move or remove</option>${targets.map(x=>`<option value="w${x}" ${c.act[m.id]==="w"+x?"selected":""} ${room(x)>=R.msWeek?"disabled":""}>Move to W${x}${room(x)>=R.msWeek?" (full)":` · ${room(x)} there`}</option>`).join("")}<option value="rm" ${c.act[m.id]==="rm"?"selected":""}>Remove it${m.tasks.length?` and its ${m.tasks.length} task${m.tasks.length>1?"s":""}`:""}</option></select>`}</div>`}).join("")}
 <div class="chf"><span class="note">${ready?"Ready: the others are moved or removed.":kept.length<cap?`Pick ${cap-kept.length} more to keep.`:"Say where each other milestone goes."}</span><button class="btn p" data-capply="${w}" ${ready?"":"disabled"}>Apply my choice</button></div></div>`}).join("")}
function fit(el){el.style.height="auto";el.style.height=el.scrollHeight+"px"}

/* ================= render: guide ================= */
function renderGuideMode(){const el=$id("gmode");if(el)el.textContent=SAMPLE?(CTX[S.kr]&&CTX[S.kr].n?"Connected · SKL OS data read":MCP?"Connected · reads SKL OS on first use":"Connected"):"Built-in guide";renderGuideActions()}
function renderFeed(){const el=$id("feed");if(!el)return;const P=plan(),F=S.feed[S.kr]||[];
 if(!F.length){el.innerHTML=`<div class="msg cl">Ask me to review this step, or pick a question below.</div>`;return}
 el.innerHTML=F.map(f=>{if(f.k==="sug"){const s=f.s;return `<div class="sug ${f.done?"done":""}"><span class="ty">${SUGT[s.type]||s.type}${f.done?" · "+f.done:""}</span><div class="pv">${sugPreview(P,s)}</div><p>${esc(s.why||"")}</p><div class="acts"><button class="btn p sm" data-acc="${f.id}">Accept</button><button class="btn sm" data-dis="${f.id}">Dismiss</button></div></div>`}
  return `<div class="msg ${f.k}">${esc(f.t)}</div>`}).join("");el.scrollTop=el.scrollHeight}
const GQ={
 outcome:[["Target","Is the target ambitious enough?"],["Target","Is this target realistic by the end of the quarter?"],["Choice","Is this the right key result to push this quarter?"],["Measure","How will we measure it every week?"],["Measure","How could this key result be gamed without real progress?"],["Why","Write a sharper “why it matters”"],["Owner","Is the owner the right person to be accountable?"]],
 milestones:[["Draft","Draft this week's milestones"],["Quality","Which milestone is an activity, not a result?"],["Quality","Which milestone has the weakest proof?"],["Next week","What should be true next week if this week goes to plan?"],["Load","Is this week trying to prove too much?"],["Risk","Which milestone carries the most risk?"],["Early signal","Which first milestone proves we are on track?"],["Owner","Is any owner carrying too many milestones?"]],
 tasks:[["Risk","Which task is the riskiest?"],["Size","Which task is too big or too vague?"],["Coverage","Which proof line has no task delivering it?"],["Flow","Which task unblocks the most work?"],["Flow","Which tasks could run in parallel?"],["Load","Who is overloaded, and what could move?"],["Wording","Rewrite the tasks as next physical actions"]],
 estimates:[["Optimism","Which estimate looks too optimistic?"],["Uncertainty","Which tasks have the most uncertainty?"],["Reference","Compare these estimates with similar past work"],["People","Whose estimates need the biggest correction?"],["Buffer","Where would a buffer help most?"],["Hidden work","What hidden work is not estimated (reviews, waiting, back-and-forth)?"]],
 premortem:[["Blind spot","What did we not think of?"],["Week 1","What would make this plan fail in week 1?"],["People","Which dependency on another person is the most fragile?"],["Signal","Which early warning should we watch every week?"],["Gaps","Which risk has no real mitigation yet?"],["Outside","What outside event could break the plan (clients, tools, holidays)?"]],
 commit:[["Watch","What should I watch in week 1?"],["Ready","Is this plan good enough to commit?"],["Team","What should I tell the team about this plan?"],["Decision","Which decision should I log before committing?"],["Saturday","What will I check on Saturday?"],["Trade-off","What are we choosing not to do with this plan?"]]};
function renderGuideActions(){const el=$id("gq");if(!el)return;const P=plan(),Q=(GQ[S.step]||[]).map(([k,q])=>[k,typeof q==="function"?q(P):q]);
 el.innerHTML=``+Q.map(([k,q])=>`<button class="chip gqc" data-q="${esc(q)}" title="${esc(k)}"><span class="gqk">${esc(k)}</span>${esc(q)}</button>`).join("");
 $id("gsend").disabled=!!BUSY}


/* ================= Key results: one row per key result, its milestones in their week (Build › Key Results) ================= */
// Objectives: the short labels of the reference, then any objective added in the shared "objectives" config
const objIds=()=>[...new Set(KRS.map(k=>k.obj).filter(Boolean).concat(Object.keys(SK.OBJ||{}).map(x=>x.replace(/\D/g,""))))].sort((a,b)=>a-b);
const objLabel=o=>OBJ[o]||((SK.OBJ||{})["O"+o]||"O"+o);
const objFull=o=>(SK.OBJ||{})["O"+o]||objLabel(o);
function boardHTML(){const Q=Array.from({length:13},(_,i)=>i+1),cur=SK.week,cols=`grid-template-columns:240px repeat(13,156px)`;
 const head=`<div class="kbh kbk0">Key result</div>${Q.map(q=>`<div class="kbh ${q===cur?"now":""}">${SK.wl(q)}<small>${esc(SK.dayName(SK.weekSunday(q)).replace(/^\w+ /,""))}</small></div>`).join("")}`;
 const rows=objIds().map(o=>{const ks=KRS.filter(k=>k.obj===o);return `<div class="kbo" style="grid-column:1/-1" title="${esc(objFull(o))}"><span>${esc(objLabel(o))}</span></div>`+(ks.length?ks.map(k=>{const K=SK.get("krs",k.id)||{},ms=K.miles||[];
  return `<button class="kbk" data-kred="${k.id}" title="Edit this key result"><b>${esc(k.t.split(" · ")[0])}</b><span>${esc(k.t.split(" · ").slice(1).join(" · "))}</span><span class="kbm2">${av(k.o)}<span class="mono">${esc(k.now)} → ${esc(k.tg)}</span></span></button>`+
  Q.map(q=>{const L=ms.filter(m=>+m.week===q),over=L.length>R.msWeek;return `<div class="kbc ${q===cur?"now":""} ${over?"over":""}">${L.map(m=>{const ow=m.owner||K.owner||"",st=SK.msStatus(m);
   return `<button class="kbt ${st}" data-msed="${k.id}|${esc(m.id)}" title="${esc(m.text)}"><span class="kbtt">${esc(m.text||"Untitled milestone")}</span><span class="kbto">${av(ow)}<span>${esc(nm(ow))}</span>${st==="done"?`<span class="chk">✓ reached</span>`:st==="review"||st==="notdone"?`<span class="chk x" title="A past week's milestone not reached yet: still in progress">delayed</span>`:""}</span></button>`}).join("")}${over?`<span class="chk x">${L.length} of ${R.msWeek}</span>`:""}<button class="kba" data-msadd="${k.id}|${q}" aria-label="Add a milestone to ${esc(krShort(k))} in ${SK.wl(q)}">+</button></div>`}).join("")}).join("")
  :`<div class="kbe" style="grid-column:1/-1">No key result in this objective yet.</div>`)}).join("");
 return `<div class="wsh"><div><h1>Key results</h1></div><div style="display:flex;gap:8px"><button class="btn" data-meastab="1">Weekly results</button><button class="btn p" data-krnew="1">+ New key result</button></div></div>
 <div class="card kbw"><div class="kbg" style="${cols}">${head}${rows}</div></div>
 <p class="note">One row per key result, its milestones in the week they are due (Sunday 8 pm). Click a milestone to change it, + to add one, a key result to edit it. At most ${R.msWeek} milestones a week per key result.</p>`}
function msPopHTML(p){const K=SK.get("krs",p.kr)||{},m=(K.miles||[]).find(x=>x.id===p.mid)||{week:p.q,owner:K.owner,text:"",doneDef:[]},proof=(m.doneDef||[]).map(x=>x.t).join("\n");
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:580px" role="dialog" aria-modal="true" aria-labelledby="msh"><div class="dh"><div><div class="pk">${esc(krShort(krOf(p.kr)))}</div><h2 id="msh" style="font-size:22px">${p.mid?"Milestone":"New milestone"}</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <label class="fld" for="bmt">Result true on Sunday 8 pm<textarea id="bmt" class="inp ta" rows="2" placeholder="A result, not an activity">${esc(m.text||"")}</textarea></label>
 <div class="ugrid"><label class="fld" for="bmw">Week<select id="bmw">${Array.from({length:13},(_,i)=>i+1).map(q=>`<option value="${q}" ${+m.week===q?"selected":""}>${SK.wl(q)} · ${esc(SK.dayName(SK.weekSunday(q)))}</option>`).join("")}</select></label>
 <label class="fld" for="bmo" style="grid-column:span 2">Owner${ownerSel(m.owner||K.owner||"",'id="bmo"').replace('<option value="">No owner</option>',"")}</label></div>
 <label class="fld" for="bmp">Proof lines, one per line<textarea id="bmp" class="inp ta" rows="3" placeholder="Something anyone can check">${esc(proof)}</textarea></label>
 <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><div>${p.mid?`<button class="btn" data-msdel="1">Delete</button>`:""}</div><div style="display:flex;gap:8px"><button class="btn" data-close="1">Cancel</button><button class="btn p" data-mssave="1">Save</button></div></div></div></div></div>`}
function krPopHTML(p){const K=p.id?SK.get("krs",p.id)||{}:{owner:SK.me||"",unit:"n",baseline:0,target:"",due:13},num=p.id?krOf(p.id).t.split(" · ")[0]:"",name=p.id?krOf(p.id).t.split(" · ").slice(1).join(" · "):"";
 const os=objIds(),units=[["n","Number"],["pct","Percent"],["eur","Euros"],["usd","Dollars"]];
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:640px" role="dialog" aria-modal="true" aria-labelledby="krh"><div class="dh"><div><div class="pk">${p.id?esc("KR "+num):"Objectives and key results"}</div><h2 id="krh" style="font-size:22px">${p.id?"Edit the key result":"New key result"}</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <div class="ugrid"><label class="fld" for="bko" style="grid-column:span 2">Objective<select id="bko">${os.map(o=>`<option value="${o}" ${String(K.obj||"").replace(/\D/g,"")===o?"selected":""}>${esc(objFull(o))}</option>`).join("")}<option value="new">+ New objective…</option></select></label>
 <label class="fld" for="bkon">New objective (if chosen)<input id="bkon" class="inp" placeholder="Build a world-class…" autocomplete="off"></label></div>
 <label class="fld" for="bkn">Key result<input id="bkn" class="inp" value="${esc(name)}" placeholder="A number by the end of the quarter, e.g. 70% of new students reach a first result in 30 days" autocomplete="off"></label>
 <label class="fld" for="bkm">Metric (how it is measured every week)<input id="bkm" class="inp" value="${esc(K.metric||"")}" autocomplete="off"></label>
 <div class="ugrid"><label class="fld" for="bku">Unit<select id="bku">${units.map(([v,l])=>`<option value="${v}" ${K.unit===v?"selected":""}>${l}</option>`).join("")}</select></label>
 <label class="fld" for="bkb">Baseline<input id="bkb" class="inp" type="number" step="any" value="${esc(K.baseline??0)}"></label><label class="fld" for="bkt">Target<input id="bkt" class="inp" type="number" step="any" value="${esc(K.target??"")}"></label></div>
 <div class="ugrid"><label class="fld" for="bkw">Owner${ownerSel(K.owner||"",'id="bkw"').replace('<option value="">No owner</option>',"")}</label>
 <label class="fld" for="bkc" style="align-self:end;flex-direction:row;gap:8px;align-items:center"><input id="bkc" type="checkbox" ${K.kind==="ceiling"?"checked":""}> Stay below the target</label></div>
 <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close="1">Cancel</button><button class="btn p" data-krsave="1">${p.id?"Save":"Create the key result"}</button></div>${p.id?krWeeksHTML(p.id):""}</div></div></div>`}
/* the key result's popup: one row per week with the result reached (Romain 2026-11-01: every week measured, so the Key result and
   Overview charts have all their points). Validate saves and locks the week; a locked week changes after Modify, asked first. */
function krWeeksHTML(id){const K=SK.get("krs",id);if(!K)return "";const by=SK.krWeeks(K),cur=SK.week,Q=Array.from({length:cur},(_,i)=>i+1),u=K.unit==="pct"?"%":K.unit==="eur"||K.unit==="eur2"?"€":K.unit==="usd"?"$":"";
 const n=Q.filter(q=>by[q]&&by[q].value!==""&&by[q].value!=null).length,lk=Q.filter(q=>by[q]&&by[q].locked).length;
 return `<div class="kwk"><div class="xsh"><span class="pk">Weekly results</span><span class="sp"></span><span class="note">${n} of ${Q.length} weeks measured · ${lk} validated</span></div>
 <div class="kwr kwh"><span>Week</span><span>Result${u?" ("+u+")":""}</span><span>Recorded</span><span></span></div>
 ${Q.slice().reverse().map(q=>{const c=by[q],has=c&&c.value!==""&&c.value!=null,lock=has&&c.locked;
  return `<div class="kwr ${q===cur?"now":""} ${lock?"lock":""}"><b>${SK.wl(q)}</b>${lock?`<span class="kwv mono">🔒 ${esc(SK.fmtVal(c.value,K.unit))}</span>`:`<input id="pwk${q}" class="inp" type="number" step="any" inputmode="decimal" value="${has?esc(c.value):""}" placeholder="${q===cur?"This week":"Missing"}" aria-label="${SK.wl(q)} result">`}
  <span class="note">${has?(c.manual?"By hand":"Weekly Review")+(c.locked?" · validated "+esc(SK.dayLabel(c.locked.at)):""):"—"}</span>
  ${lock?`<button class="btn sm" data-wkmod="${q}">Modify</button>`:`<button class="btn sm p" data-wkval="${q}">Validate</button>`}</div>`}).join("")}
 <p class="note">Type the result of each week and Validate: the week is saved and locked. A validated week changes only after Modify, which asks first.</p></div>`}
const vOf=id=>{const e=$id(id);return e?e.value.trim():""};
function saveMs(p){const K=SK.get("krs",p.kr);if(!K)return;const text=vOf("bmt");if(!text){toast("Write the result first.");return}
 const k2=JSON.parse(JSON.stringify(K));delete k2.expected;k2.miles=k2.miles||[];const old=k2.miles.find(m=>m.id===p.mid);
 const lines=vOf("bmp").split("\n").map(x=>x.trim()).filter(Boolean),dd=lines.map(t=>{const x=old&&(old.doneDef||[]).find(d=>d.t===t);return {t,ok:!!(x&&x.ok)}});
 const body={week:+vOf("bmw"),text,owner:vOf("bmo"),doneDef:dd};
 if(old)Object.assign(old,body);else{const ids=new Set(k2.miles.map(m=>m.id));let i=k2.miles.length;while(ids.has(k2.id+"-m"+i))i++;k2.miles.push(Object.assign({id:k2.id+"-m"+i},body))}
 const n=k2.miles.filter(m=>+m.week===body.week).length;SK.save("krs",k2);S.pop=null;renderPop();toast(n>R.msWeek?`Saved. ${SK.wl(body.week)} now has ${n} milestones for this key result: keep ${R.msWeek} in Build › Milestones.`:"Milestone saved.")}
function deleteMs(p){SK.confirm({title:"Delete this milestone?",body:"Its risks go with it. Its tasks stay in their owner's list.",ok:"Delete",onOk:()=>{const K=SK.get("krs",p.kr);if(!K)return;const k2=JSON.parse(JSON.stringify(K));delete k2.expected;
 k2.miles=(k2.miles||[]).filter(m=>m.id!==p.mid);k2.risks=(k2.risks||[]).filter(r=>r.mile!==p.mid);SK.save("krs",k2);S.pop=null;renderPop();toast("Milestone deleted.")}})}
function saveKr(p){const name=vOf("bkn");if(!name){toast("Write the key result first.");return}const target=vOf("bkt");if(target===""){toast("Give the target.");return}
 let o=vOf("bko");if(o==="new"){const nn=vOf("bkon");if(!nn){toast("Name the new objective.");return}const c=SK.get("config","objectives")||{id:"objectives",list:[]},n=Math.max(0,...objIds().map(Number))+1;
  SK.save("config",Object.assign({},c,{id:"objectives",list:(c.list||[]).concat([{id:"O"+n,name:nn}])}));o=String(n)}
 const f={obj:"O"+o,metric:vOf("bkm"),unit:vOf("bku"),baseline:Number(vOf("bkb"))||0,target:Number(target),owner:vOf("bkw"),due:13,kind:$id("bkc")&&$id("bkc").checked?"ceiling":""};
 if(p.id){const K=SK.get("krs",p.id);if(!K)return;const k2=Object.assign(JSON.parse(JSON.stringify(K)),f,{name:krOf(p.id).t.split(" · ")[0]+" · "+name});delete k2.expected;if(!f.kind)delete k2.kind;SK.save("krs",k2);S.pop=null;renderPop();toast("Key result saved.");return}
 const inObj=SK.list("krs").filter(k=>String(k.obj||"").replace(/\D/g,"")===o),ids=new Set(SK.list("krs").map(k=>k.id));let n=inObj.length+1;while(ids.has("kr"+o+n))n++;
 const id="kr"+o+n,doc=Object.assign({id,name:o+"."+n+" · "+name,type:"committed",freq:"weekly",current:f.baseline,plan:[[1,f.baseline],[f.due,f.target]],checkins:[],inits:[],miles:[],risks:[],close:{score:"",worked:"",noEffect:"",lessons:"",next:""}},f);
 if(!f.kind)delete doc.kind;SK.save("krs",doc);S.kr=id;S.pop=null;renderPop();toast(`KR ${o}.${n} created. Add its milestones on its row.`)}
function boardClick(t,d){
 if(d.sub){S.sub=d.sub;S.kbMoved=false;render();return true}
 if(d.meastab){S.pop={x:"meas"};renderPop();return true}
 if(d.krnew){S.pop={x:"kr"};renderPop();setTimeout(()=>{const e=$id("bkn");e&&e.focus()},30);return true}
 if(d.kred){S.pop={x:"kr",id:d.kred};renderPop();return true}
 if(d.msadd){const[kr,q]=d.msadd.split("|");S.pop={x:"ms",kr,q:+q};renderPop();setTimeout(()=>{const e=$id("bmt");e&&e.focus()},30);return true}
 if(d.msed){const[kr,mid]=d.msed.split("|");S.pop={x:"ms",kr,mid};renderPop();return true}
 if(d.mssave){saveMs(S.pop);return true}
 if(d.msdel){deleteMs(S.pop);return true}
 if(d.krsave){saveKr(S.pop);return true}
 if(d.wkval){const q=+d.wkval,id=S.pop&&S.pop.id,v=vOf("pwk"+q);if(!id)return true;if(v===""||isNaN(Number(v))){toast("Type the result of "+SK.wl(q)+" first.");return true}
  const K=SK.get("krs",id),old=SK.krWeeks(K)[q],r=SK.setKrWeek(id,q,Number(v),true);if(!r.ok){toast(r.why);return true}
  renderPop();toast(SK.wl(q)+": "+SK.fmtVal(Number(v),K.unit)+(old&&old.value!=null&&old.value!==""&&Number(old.value)!==Number(v)?" (was "+SK.fmtVal(old.value,K.unit)+")":"")+" validated.");return true}
 if(d.wkmod){const q=+d.wkmod,id=S.pop&&S.pop.id;if(!id)return true;const K=SK.get("krs",id),c=SK.krWeeks(K)[q];
  SK.confirm({title:"Modify the "+SK.wl(q)+" result?",body:krOf(id).t+": "+SK.fmtVal(c.value,K.unit)+", validated "+SK.dayLabel(c.locked.at)+". The week opens again; Validate it after your change.",ok:"Modify",
   onOk:()=>{const r=SK.lockKrWeek(id,q,false);if(!r.ok){toast(r.why);return}renderPop();setTimeout(()=>{const e=$id("pwk"+q);e&&e.focus()},30)}});return true}
 return false}

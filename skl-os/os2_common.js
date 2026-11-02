/* Build and Execute (Operating System): the shared core of the two screens, from proposal/os-v2/roadmap-studio.html.
   The reference keeps its plans in the browser; here every plan, task, week, day and request lives in the SKL OS store
   (window.SKL, store.js): key results and milestones (k.miles), tasks (S.taskCreate / taskUpdate / taskDelete, owner rules
   apply), risks (k.risks), commits (k.committed), and the shared collections "weeks", "days" and "requests". */

/* ================= frame: one core, two screens (Build, Execute), each in its own shadow root ================= */
const ROOTS={},LISTEN=[];
function cur(){return ROOTS[S.view]||null}
function $id(id){const r=cur();return r?r.getElementById(id):null}
function $all(q){const r=cur();return r?r.querySelectorAll(q):[]}
function $one(q){const r=cur();return r?r.querySelector(q):null}
function activeEl(){const r=cur();return r?r.activeElement:null}
// REDRAW: while a screen part is redrawn under the cursor, the field being typed in is removed and Chrome fires its "change";
// that event is not the person's and must not start a full render (it took the focus away while typing, Romain 2026-11-02).
let REDRAW=false;
// The week of a person once their roadmap is committed in Build › Commit ("weeks" <member>:W<week> with its key results): it is locked
// until the next week (Romain 2026-11-02); a week only unlocked by a lead (override, no key results) is not.
function lockedWeek(){if(!S.exec||!S.exec.who)return null;let d=null;try{d=(S.weeks||{})[weekKey(S.exec.who,isoWk(D().n))]}catch(e){}return d&&Array.isArray(d.krs)?d:null}
const EDITSEL="[data-selkr],[data-addt],[data-rmt],[data-rmrisk],[data-rmp],[data-rmms],[data-addrisk],[data-addp],[data-addms],[data-mittask],[data-ckeep],[data-cdrop],[data-capply],[data-acc],[data-commit],[data-cplan],[data-creset],[data-weekovr]";
const lockMsg=()=>`Your week W${isoWk(D().n)} is committed: it is locked until next week.`;
function lockBlocks(view,type,e){if(view!=="build"||S.sub==="krs"||!lockedWeek())return false;const t=e.target;if(!t||!t.closest||!t.closest("#ws,#carry"))return false;
 if(type==="click"&&t.closest(EDITSEL)){toast(lockMsg());return true}
 return (type==="input"||type==="change")&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.id!=="who"&&!t.closest("#gform")}
function bind(view,type,fn){ROOTS[view].addEventListener(type,e=>{if(REDRAW&&(type==="change"||type==="focusout"||type==="blur"))return;if(lockBlocks(view,type,e))return;S.view=view;const sec=e.target&&e.target.closest&&e.target.closest("[data-krsec]");if(sec&&S.plans[sec.dataset.krsec])S.kr=sec.dataset.krsec;fn(e)})}
function on(type,fn){LISTEN.push([type,fn]);Object.keys(ROOTS).forEach(v=>bind(v,type,fn))}

/* ================= data: SKL OS store ================= */
const SK=window.SKL;
const KRS=[],TEAM={},REQS={},OTHER={};
const COLORS=["#7A4B00","#2D5C9C","#1F6A66","#6B4FA0","#8A2D3B","#4F6B2D","#5E5B53"];
// One set of rules for Build and Execute. start = the week being planned (this ISO week, the next one from Sunday 2 pm).
const R={now:0,start:0,last:0,taskMax:4,gap:2,msWeek:3,krMax:3,help:.15,commit:85,dayH:9,days:6,lunch:"12:30",objectives:3,wip:1,newDays:8};R.weekMax=R.dayH*R.days;
const ACT=["work","working","prepare","preparing","start","starting","continue","improve","improving","think","research","look","try","help","support","manage","handle","explore","review","reviewing","discuss","plan","planning","organise","organize","follow","focus","develop","developing","build","building"];
const VERBS=new Set("add analyse analyze approve ask audit book brief build calculate call check choose clean collect compare compile configure confirm connect create decide define deliver design draft edit email export fill find fix gather hire import interview launch list load log map measure meet merge migrate move name note order outline pay post price print publish record recruit remove rename replace report rewrite run schedule score send set setup share ship sign sort split survey tag test train update upload validate write".split(" "));
const STEPS=[
 ["outcome","Outcome","Key result, target, owner"],
 ["milestones","Milestones","Results, 3 a week at most"],
 ["tasks","Tasks","Next physical actions, ≤ 4 h"],
 ["estimates","Estimates","Calibrated on each person's record"],
 ["premortem","Pre-mortem","Why we could be late"],
 ["commit","Commit","Your roadmap, then Execute"]];

// ISO weeks on screen, quarter weeks 1-13 in the data (S.isoWeek)
function isoWeekUTC(d){const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));t.setUTCDate(t.getUTCDate()+3-((t.getUTCDay()+6)%7));const y=new Date(Date.UTC(t.getUTCFullYear(),0,4));return 1+Math.round(((t-y)/864e5-3+((y.getUTCDay()+6)%7))/7)}
const isoQ=q=>SK.isoWeek(Math.max(1,Math.min(13,+q||1)));
function qOfIso(w){for(let q=1;q<=13;q++)if(SK.isoWeek(q)===+w)return q;return Math.max(1,Math.min(13,+w-SK.isoWeek(1)+1))}
const todayIso=()=>SK.iso(SK.today);
const utcOf=s=>new Date(Date.parse(s+"T00:00:00Z"));
function clockNow(){const d=new Date(SK.today),r=new Date();d.setHours(r.getHours(),r.getMinutes(),0,0);return d}
function refreshClock(){const c=clockNow(),wk=isoWeekUTC(utcOf(todayIso())),sunPm=c.getDay()===0&&c.getHours()>=14;R.start=wk+(sunPm?1:0);R.now=R.start-1;R.last=Math.max(R.start,SK.isoWeek(13))}
const todayLabel=()=>`${SK.dayName(todayIso())} (W${isoWeekUTC(utcOf(todayIso()))})`;

/* ================= state ================= */
const KEY="skl-os2-view";
const S={choose:{},view:"build",step:"outcome",kr:"",sel:[],plans:{},feed:{},sugs:{},committed:{},weeks:{},exec:null,pop:null,carryDone:{},carryOpen:true,carryReserve:true};
// what stays in this browser: the view of each person (step, key result, carry-over panel); the plans are shared
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||"null");if(d){Object.assign(S,{carryOpen:d.carryOpen!==false,carryDone:d.carryDone||{},carryReserve:d.carryReserve!==false,step:d.step||S.step,kr:d.kr||S.kr,sub:"plan"})}}catch(e){}}   // Build always opens on Build, not Key Results (Romain 2026-11-02)
// a click on Build in the sidebar is a fresh visit: it opens on the Build view (the six steps)
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("#app nav a[href]");if(a&&a.getAttribute("href")==="Build.dc.html")S.sub="plan"},true);
let LASTPREF="";
function save(){const p=JSON.stringify({carryOpen:S.carryOpen,carryDone:S.carryDone,carryReserve:S.carryReserve,step:S.step,kr:S.kr,sub:S.sub});if(p!==LASTPREF){LASTPREF=p;try{localStorage.setItem(KEY,p)}catch(e){}}
 syncAll();saveExec()}

// ---------- key results, team, plans: read from the store ----------
function stateOf(who){const L=SK.list("days").filter(d=>d.who===who&&d.state).sort((a,b)=>a.id<b.id?-1:1);return L.length?L[L.length-1]:null}
function coefOf(who){const st=S.exec&&S.exec.who===who?S.exec:stateOf(who),L=(st&&st.log||[]).filter(l=>!l.help&&l.w>=R.start-4&&l.w<R.start),weeks=new Set(L.map(l=>l.w));
 if(weeks.size>=4){const e=L.reduce((a,l)=>a+(+l.est||0),0),a=L.reduce((x,l)=>x+(+l.act||0),0);if(e>0)return Math.round(a/e*10)/10}
 const c=SK.get("config","coefficients"),v=c&&c.values?+c.values[who]:0;return v>0?v:1.3}
// The deadline of a key result is the end of its quarter (Romain 2026-11-02): week 13, whatever k.due or the plan says
function dueOf(k){return isoQ(13)}
// what each plan was when read: only a plan changed on this screen is written back (a remote change is never overwritten)
const BASE={},sig=P=>JSON.stringify(P,(k,v)=>k==="_m"?undefined:v);
const DRAFTS={}; // task rows not in the store yet (no title, or refused): id → {kr, mid, t, err}
function planFromStore(k){const tasks=SK.list("tasks");
 const ms=(k.miles||[]).filter(m=>isoQ(m.week)>=R.start).map(m=>({id:m.id,t:m.text||"",w:isoQ(m.week),o:m.owner||k.owner||"",proof:(m.doneDef||[]).map(x=>x.t||""),
  risks:(k.risks||[]).filter(r=>r.mile===m.id).map(r=>({t:r.text||"",mit:r.fix||"",l:r.p||"medium"})),
  tasks:tasks.filter(t=>t.mile===m.id&&t.status!=="split").map(t=>({id:t.id,t:t.title||"",dw:t.doneWhen||"",o:t.owner||"",e:+t.est||0,deps:Array.isArray(t.deps)?t.deps.slice():[],nb:+t.notBefore||undefined,done:t.status==="done"}))}));
 Object.keys(DRAFTS).forEach(id=>{const d=DRAFTS[id];if(d.kr!==k.id)return;const m=ms.find(x=>x.id===d.mid);if(!m){delete DRAFTS[id];return}if(!m.tasks.some(x=>x.id===id))m.tasks.push(d.t)});
 ms.sort((a,b)=>a.w-b.w);return {kr:k.id,due:dueOf(k),why:k.why||"",ms}}
function refresh(){refreshClock();
 KRS.length=0;SK.list("krs").forEach(k=>KRS.push({id:k.id,t:k.name||k.id,o:k.owner||"",now:SK.fmtVal(k.current,k.unit),tg:SK.fmtVal(k.target,k.unit),obj:String(k.obj||"").replace(/\D/g,"")||String(k.id)[2]||""}));
 const want=SK.me||(S.exec&&S.exec.who)||(SK.members[0]||{}).id;
 if(!S.exec||(!S.exec.mine&&S.exec.who!==want))setWho(want,true);
 else if(PRE&&SK.isLoaded("days"))setWho(S.exec.who,!S.exec.mine); // the stored days just arrived: they replace the provisional state
 else{const st=stateOf(S.exec.who),js=st?JSON.stringify(st.state):"";if(js&&js!==EXECDOC&&JSON.stringify(S.exec)===LASTEXEC)setWho(S.exec.who,!S.exec.mine)} // changed on another device
 Object.keys(TEAM).forEach(x=>delete TEAM[x]);SK.members.forEach((m,i)=>{TEAM[m.id]={n:m.name,focus:8,coef:coefOf(m.id),c:COLORS[i%COLORS.length]}});
 S.plans={};S.committed={};Object.keys(BASE).forEach(x=>delete BASE[x]);SK.list("krs").forEach(k=>{S.plans[k.id]=planFromStore(k);BASE[k.id]=sig(S.plans[k.id]);if(k.committed)S.committed[k.id]=k.committed});
 if(!S.kr||!S.plans[S.kr])S.kr=(KRS.find(k=>k.o===S.exec.who)||KRS[0]||{}).id||"";
 // the key results targeted this week (Romain 2026-11-02): up to 3, since the week's 3 milestones may sit in 1 to 3 key results
 if(!S.sel.length){try{const v=JSON.parse(localStorage.getItem("skl_build_sel:"+S.exec.who)||"[]");if(Array.isArray(v))S.sel=v}catch(e){}}
 // none ticked is allowed (Romain 2026-11-02): The outcome and the week then cannot be validated
 S.sel=S.sel.filter(id=>S.plans[id]).slice(0,R.krMax);if(S.sel.length&&!S.sel.includes(S.kr))S.kr=S.sel[0];
 S.weeks={};SK.list("weeks").forEach(w=>{S.weeks[w.id]=w});
 // a committed week is shared and locked (Romain 2026-11-02): its targeted key results come from the commit, on every computer
 {const lk=lockedWeek();if(lk){S.sel=lk.krs.filter(id=>S.plans[id]).slice(0,R.krMax);if(S.sel.length&&!S.sel.includes(S.kr))S.kr=S.sel[0]}}
 Object.keys(REQS).forEach(x=>delete REQS[x]);SK.list("requests").filter(r=>!r.answer).forEach(r=>(REQS[r.to]=REQS[r.to]||[]).push({id:r.id,from:r.from,t:r.title||"",dw:r.doneWhen||"",e:+r.est||.5,at:r.at?SK.dayName(r.at):"",serves:r.serves||"their work"}));
 Object.keys(OTHER).forEach(x=>delete OTHER[x]);const inPlan=new Set(Object.values(S.plans).flatMap(P=>allTasks(P).map(t=>t.id))),lim=SK.iso(new Date(SK.today.getTime()+R.newDays*864e5));
 SK.list("tasks").filter(t=>t.owner&&SK.isOpen(t)&&t.status!=="split"&&!inPlan.has(t.id)&&(t.status==="progress"||!t.due||t.due<=lim)).forEach(t=>{const k=KRS.find(x=>x.id===t.kr);(OTHER[t.owner]=OTHER[t.owner]||[]).push({id:t.id,t:t.title,dw:t.doneWhen||"",tag:(k?krShort(k):"Task")+(t.due?" · due "+SK.dayName(t.due):""),e:+t.est||1})})}
function planOf(id){if(!S.plans[id]){const k=SK.get("krs",id);S.plans[id]=k?planFromStore(k):{kr:id,due:R.last,why:"",ms:[]};BASE[id]=sig(S.plans[id])}return S.plans[id]}
function plan(){return planOf(S.kr)}
const krOf=id=>KRS.find(k=>k.id===id)||{id,t:id||"—",o:"",now:"",tg:"",obj:""};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid=p=>p+Math.random().toString(36).slice(2,7);
const allTasks=P=>P.ms.flatMap(m=>m.tasks.map(t=>Object.assign(t,{_m:m.id})));
const findT=(P,id)=>allTasks(P).find(t=>t.id===id);
const findM=(P,id)=>P.ms.find(m=>m.id===id);
const ownerOf=(P,t)=>t.o||(findM(P,t._m)||{}).o||"";
const cap=o=>TEAM[o]?TEAM[o].focus:8;
const coef=o=>TEAM[o]?TEAM[o].coef:1.3;
const cal=(P,t)=>(+t.e||0)*coef(ownerOf(P,t));
// Sunday 8 pm of ISO week w (the quarter's weeks, S.weekSunday)
const sunday=w=>SK.dayName(SK.weekSunday(qOfIso(w)));
const nm=id=>TEAM[id]?TEAM[id].n:(id||"someone");
const LEADS=SK.members.filter(m=>/CEO|CPO/.test(m.role||"")).map(m=>m.id),isLead=id=>LEADS.includes(id);
const av=o=>TEAM[o]?`<span class="av" style="background:${TEAM[o].c}">${TEAM[o].n.slice(0,2).toUpperCase()}</span>`:`<span class="av" style="background:var(--mut2)">?</span>`;
const ownerSel=(v,attrs)=>`<select ${attrs}><option value="">No owner</option>${Object.entries(TEAM).map(([k,p])=>`<option value="${k}" ${v===k?"selected":""}>${p.n}</option>`).join("")}</select>`;
const weekSel=(v,attrs)=>`<select ${attrs}>${Array.from({length:R.last-R.start+1},(_,i)=>R.start+i).map(w=>`<option value="${w}" ${+v===w?"selected":""}>W${w} · ${sunday(w)}</option>`).join("")}</select>`;

// ---------- writes: the plan of the screen goes back to the store ----------
const NOTES=[];
function note(t){if(t&&!NOTES.includes(t))NOTES.push(t)}
function msNewId(P){const k=SK.get("krs",P.kr)||{},ids=new Set([...(k.miles||[]).map(m=>m.id),...P.ms.map(m=>m.id)]);let i=(k.miles||[]).length;while(ids.has(P.kr+"-m"+i))i++;return P.kr+"-m"+i}
function renameTask(P,a,b){allTasks(P).forEach(t=>{if(t.id===a)t.id=b;if(t.deps)t.deps=t.deps.map(d=>d===a?b:d)});
 ["tf","th","rmt","te"].forEach(k=>$all(`[data-${k}^="${a}"]`).forEach(el=>el.dataset[k]=el.dataset[k].replace(a,b)))}
function syncPlan(P){const k=SK.get("krs",P.kr);if(!k||BASE[P.kr]===sig(P))return;
 const old=Object.fromEntries((k.miles||[]).map(m=>[m.id,m])),keep=(k.miles||[]).filter(m=>isoQ(m.week)<R.start);
 const miles=keep.concat(P.ms.map(m=>{const o=old[m.id]||{};return Object.assign({},o,{id:m.id,week:qOfIso(m.w),text:m.t,owner:m.o,doneDef:m.proof.map((t,i)=>{const p=(o.doneDef||[]).find(x=>x.t===t);return {t,ok:!!(p&&p.ok)}})})}));
 const shown=new Set(P.ms.map(m=>m.id)),alive=new Set(miles.map(m=>m.id));
 const risks=(k.risks||[]).filter(r=>!r.mile||(!shown.has(r.mile)&&alive.has(r.mile))).concat(P.ms.flatMap(m=>m.risks.map(r=>({text:r.t,fix:r.mit,p:r.l,i:"medium",owner:m.o,mile:m.id}))));
 const due=k.due,cur=JSON.stringify([k.miles||[],k.risks||[],k.why||"",k.due||null]),nxt=JSON.stringify([miles,risks,P.why||"",due||null]);
 if(cur!==nxt){const k2=Object.assign({},k,{miles,risks,why:P.why||""});if(due)k2.due=due;delete k2.expected;SK.save("krs",k2)}
 P.ms.forEach(m=>{const mile=miles.find(x=>x.id===m.id)||{},dueD=SK.weekFriday(qOfIso(m.w));m.tasks.slice().forEach(t=>{const st=SK.get("tasks",t.id);
  if(!st){if(!(t.t||"").trim()){DRAFTS[t.id]={kr:P.kr,mid:m.id,t};return}
   const ini=SK.msInits(k,mile),r=SK.taskCreate({title:t.t,kr:P.kr,init:ini.length?ini[0]:-1,mile:m.id,owner:t.o||m.o,due:dueD,est:+t.e||0,doneWhen:t.dw,deps:t.deps,notBefore:t.nb});
   if(r.ok){delete DRAFTS[t.id];renameTask(P,t.id,r.id)}else{DRAFTS[t.id]={kr:P.kr,mid:m.id,t,err:r.why};note(r.why)}return}
  const want={title:t.t,doneWhen:t.dw||"",owner:t.o||st.owner,est:+t.e||0,mile:m.id,deps:t.deps||[],notBefore:t.nb||""},patch={};
  Object.keys(want).forEach(f=>{const v=st[f]==null?(f==="deps"?[]:f==="est"?0:""):st[f];if(JSON.stringify(v)!==JSON.stringify(want[f]))patch[f]=want[f]});
  if(SK.weekOf(st.due)!==qOfIso(m.w))patch.due=dueD;
  if(Object.keys(patch).length){const r=SK.taskUpdate(t.id,patch);if(!r.ok)note(r.why)}})});BASE[P.kr]=sig(P)}
function syncAll(){Object.values(S.plans).forEach(syncPlan);if(NOTES.length){toast(NOTES[0]);NOTES.length=0}}
// removing goes through the store's owner rule; what the store refuses stays
function dropTask(P,id){if(SK.get("tasks",id)){const r=SK.taskDelete(id);if(!r.ok){toast(r.why);return false}}delete DRAFTS[id];P.ms.forEach(m=>m.tasks=m.tasks.filter(x=>x.id!==id));return true}
function dropMs(P,id){const m=findM(P,id);if(!m)return;let kept=0;m.tasks.slice().forEach(t=>{if(SK.get("tasks",t.id)&&!SK.taskDelete(t.id).ok)kept++;delete DRAFTS[t.id]});P.ms=P.ms.filter(x=>x.id!==id);if(kept)toast(`${kept} task${kept>1?"s":""} owned by someone else stay${kept>1?"":"s"} in their list.`)}
function markSplit(id){if(SK.get("tasks",id)){const r=SK.taskUpdate(id,{status:"split"});if(!r.ok)note(r.why)}}
function setWeek(who,w,body){const id=weekKey(who,w),doc=Object.assign({id,who,week:w},body);S.weeks[id]=doc;SK.save("weeks",doc)}

/* ================= checks: the code decides ================= */
function msChecks(P,m){const first=(m.t||"").trim().toLowerCase().split(/\s+/)[0]||"";const c=[];
 c.push({k:"result",ok:!!m.t&&!ACT.includes(first),hard:1,lab:m.t?(ACT.includes(first)?"Activity, not a result":"States a result"):"No title"});
 c.push({k:"proof",ok:m.proof.filter(x=>x.trim()).length>0,hard:1,lab:m.proof.filter(x=>x.trim()).length?"Proof for Sunday 8 pm":"No proof line"});
 c.push({k:"owner",ok:!!m.o,hard:1,lab:m.o?"One owner":"No owner"});
 c.push({k:"date",ok:m.w>=R.start&&m.w<=P.due,hard:1,lab:m.w<R.start?"Before the week being planned":m.w<=P.due?"Within the quarter":"After the end of the quarter"});
 // tasks are required only under the builder's own milestones of the week being planned (Romain 2026-11-02): someone else's milestone may
 // hold none of the builder's tasks, and a later week can stay open
 {const need=m.w===R.start&&mine(m,P);c.push({k:"tasks",ok:m.tasks.length>0||!need,hard:1,lab:m.tasks.length?m.tasks.length+" task"+(m.tasks.length>1?"s":""):need?"No task delivers it":mine(m,P)?"Tasks when its week comes":`${ownerOfMs(m,P)?nm(ownerOfMs(m,P)):"Its owner"} plans its tasks`})}
 if(m.w===R.start&&!isTarget(m)&&!mine(m,P))c.push({k:"load",ok:true,hard:1,lab:`${ownerOfMs(m,P)?nm(ownerOfMs(m,P)):"Its owner"} sets it up`});
 else{const same=m.w===R.start?P.ms.filter(x=>x.w===m.w&&!isTarget(x)&&mine(x,P)).length+othersIn(P,m.w):P.ms.filter(x=>x.w===m.w).length,yours=m.w===R.start;
  c.push({k:"load",ok:same<=R.msWeek,hard:1,lab:same>R.msWeek?`${same} ${yours?"of your milestones":"milestones"} in W${m.w}${yours?" across the targeted key results":""}: keep ${R.msWeek}`:`${same} of ${R.msWeek} in W${m.w}`})}
 return c}
function taskChecks(P,t){const first=(t.t||"").trim().toLowerCase().split(/\s+/)[0]||"";const c=[];
 c.push({k:"verb",ok:VERBS.has(first),hard:0,lab:VERBS.has(first)?"Starts with a verb":"Start with a verb"});
 c.push({k:"done",ok:!!(t.dw||"").trim(),hard:1,lab:(t.dw||"").trim()?"Done-when set":"No done-when"});
 c.push({k:"owner",ok:!!t.o,hard:1,lab:t.o?"Owner":"No owner"});
 c.push({k:"est",ok:+t.e>0,hard:1,lab:+t.e>0?"Estimated":"No estimate"});
 c.push({k:"size",ok:!(+t.e>R.taskMax),hard:1,lab:+t.e>R.taskMax?`${t.e} h · over ${R.taskMax} h, split it`:`≤ ${R.taskMax} h`});
 return c}
function gaps(P){return []} // gap rule removed: only this week's milestones are required, 3 at most
// milestones of the other targeted key results in a week: the cap of R.msWeek counts all of them together
// only the week being planned shares its 3 milestones across the targeted key results; "Target…" milestones never count
const isTarget=m=>/^target/i.test(String(m.t||"").trim());
// The cap of the week being planned is per person (Romain 2026-11-02): the builder's own milestones across the targeted key results
// (an unowned milestone belongs to its key result's owner); everyone sets up and trims their own.
function ownerOfMs(m,P){return m.o||krOf(P.kr).o||""}
function mine(m,P){return ownerOfMs(m,P)===(S.exec&&S.exec.who)}
function othersIn(P,w){return w!==R.start?0:(S.sel||[]).filter(id=>id!==P.kr).reduce((n,id)=>{const Q=planOf(id);return n+Q.ms.filter(m=>m.w===w&&!isTarget(m)&&mine(m,Q)).length},0)}
function capIn(P,w){return Math.max(0,R.msWeek-othersIn(P,w))}
function overWeeks(P){const by={};P.ms.forEach(m=>{if(m.w===R.start&&(isTarget(m)||!mine(m,P)))return;(by[m.w]=by[m.w]||[]).push(m)});return Object.keys(by).map(Number).filter(w=>by[w].length>capIn(P,w)).sort((a,b)=>a-b).map(w=>({w,list:by[w]}))}
const MSI=STEPS.findIndex(s=>s[0]==="milestones");
// the first targeted key result whose week is over its cap (all of them shown at once in Milestones)
function firstOver(){const ids=(S.sel||[]).length?S.sel:[S.kr];for(const id of ids){const P=planOf(id),o=overWeeks(P)[0];if(o)return {P,o}}return null}
function blockedFrom(i){return i>MSI&&!!firstOver()}
function riskChecks(P,m){const done=m.risks.some(r=>(r.t||"").trim()&&(r.mit||"").trim());if(done)return {ok:true,lab:"Pre-mortem done"};
 // required only on the builder's own milestones of the week being planned; others run theirs in their own Build
 if(!mine(m,P))return {ok:true,lab:`${ownerOfMs(m,P)?nm(ownerOfMs(m,P)):"Its owner"} runs its pre-mortem`,info:1};
 if(m.w!==R.start)return {ok:true,lab:"Pre-mortem when its week comes",info:1};
 return {ok:false,lab:"No risk with a mitigation"}}
// Step 2 is each person's own set-up (Romain 2026-11-02): it counts only the milestones of the week being planned that belong to
// the person whose week is built, across the ticked key results (an unowned one counts for the key result's owner); others' are theirs.
function myMs(){const who=S.exec&&S.exec.who,ids=(S.sel&&S.sel.length?S.sel:[S.kr]).filter(Boolean),out=[];
 ids.forEach(id=>{const Q=planOf(id);Q.ms.forEach(m=>{if(m.w===R.start&&ownerOfMs(m,Q)===who)out.push([Q,m])})});return out}
function stepIssues(P,step){if(lockedWeek())return 0; // committed: every step stays validated for the week
 if(step==="outcome")return (S.sel||[]).length?0:1; // at least one ticked key result validates the step
 if(step==="milestones"){const L=myMs();return L.reduce((a,[Q,m])=>a+msChecks(Q,m).filter(c=>!c.ok&&c.k!=="tasks").length,0)+(L.length?0:1)}
 // Tasks: each of the builder's milestones of the week has a task, and the builder's own tasks pass their checks, across the ticked key results
 if(step==="tasks"){const who=S.exec&&S.exec.who,ids=(S.sel&&S.sel.length?S.sel:[S.kr]).filter(Boolean);let n=myMs().filter(([Q,m])=>!m.tasks.length).length;
  ids.forEach(id=>{const Q=planOf(id);Q.ms.forEach(m=>m.tasks.forEach(t=>{if((t.o||ownerOfMs(m,Q))===who)n+=taskChecks(Q,t).filter(c=>!c.ok&&c.k!=="est"&&c.k!=="size").length}))});return n}
 // Estimates, like Tasks: across the ticked key results, the builder's own tasks without an estimate or above the task limit, and the
 // builder's weeks over the limit (Romain 2026-11-02)
 if(step==="estimates"){const who=S.exec&&S.exec.who,ids=selIds();let n=0;ids.forEach(id=>{const Q=planOf(id);allTasks(Q).forEach(t=>{if(ownerOf(Q,t)===who&&(!(+t.e>0)||+t.e>R.taskMax))n++})});
  return n+weekLoadIds(ids).over.filter(x=>x.o===who).length}
 if(step==="forecast")return 0;
 // Pre-mortem is the builder's own (Romain 2026-11-02): only their milestones of the week, across the ticked key results
 if(step==="premortem")return myMs().filter(([Q,m])=>!riskChecks(Q,m).ok).length;
 if(step==="commit")return (S.weeks||{})[weekKey(S.exec.who,isoWk(D().n))]?0:1; // the builder's own roadmap of the week
 return 0}
function quality(P){let ok=0,n=0;P.ms.forEach(m=>{msChecks(P,m).forEach(c=>{n++;ok+=c.ok}) ;const r=riskChecks(P,m);n++;ok+=r.ok;m.tasks.forEach(t=>taskChecks(P,t).forEach(c=>{n++;ok+=c.ok}))});const g=gaps(P).length;n+=1;ok+=g?0:1;n+=1;ok+=P.why.trim()?1:0;return n?Math.round(ok/n*100):0}
const hardFails=P=>weekLoad(P).over.length+P.ms.reduce((a,m)=>a+msChecks(P,m).filter(c=>c.hard&&!c.ok).length+m.tasks.reduce((b,t)=>b+taskChecks(P,t).filter(c=>c.hard&&!c.ok).length,0),0)+gaps(P).length;

/* ================= forecast: Monte Carlo, priority by slack ================= */
function order(P,slack){const T=allTasks(P),dependents={};T.forEach(t=>(t.deps||[]).forEach(d=>dependents[d]=(dependents[d]||0)+1));
 const mo={};P.ms.forEach((m,i)=>mo[m.id]=i);
 const base=T.slice().sort((a,b)=>{const sa=slack?slack[a._m]:0,sb=slack?slack[b._m]:0;return (sa-sb)||(findM(P,a._m).w-findM(P,b._m).w)||(mo[a._m]-mo[b._m])||((dependents[b.id]||0)-(dependents[a.id]||0))});
 const out=[],done=new Set();let guard=0;while(out.length<base.length&&guard++<500){for(const t of base){if(done.has(t.id))continue;if((t.deps||[]).every(d=>done.has(d)||!findT(P,d))){out.push(t);done.add(t.id);break}}}
 base.forEach(t=>{if(!done.has(t.id))out.push(t)});return {list:out,dependents}}
let FC={sig:"",val:null};
// Order of work only (no probability): earliest milestone first, then what unblocks the most
function forecast(P){const sig=JSON.stringify([P.ms]);if(FC.sig===sig)return FC.val;const fin=order(P);const v={order:fin.list,dependents:fin.dependents,ms:{},slack:{},prob:1};FC={sig,val:v};return v}
const lateMs=()=>[];
function whyFirst(P,F,t){const m=findM(P,t._m),d=F.dependents[t.id]||0,bits=[];
 bits.push(`M${P.ms.indexOf(m)+1} is due W${m.w}`);
 if(d)bits.push(`unblocks ${d} task${d>1?"s":""}`);return bits.join(" · ")}

/* ================= suggestions (same shape for Claude and for the built-in guide) ================= */
// {type, target, data, why}: rewrite_ms, add_ms, move_ms, rewrite_task, split_task, set_owner, add_task, set_est, add_risk, reassign_task, set_focus
function applySug(P,s){const d=s.data||{};
 switch(s.type){
  case "rewrite_ms":{const m=findM(P,s.target);if(!m)throw 0;if(d.t)m.t=d.t;if(Array.isArray(d.proof))m.proof=d.proof.slice(0,4);if(d.o)m.o=d.o;break}
  case "add_ms":{const m={id:msNewId(P),t:d.t||"New milestone",w:Math.min(P.due,Math.max(R.start,+d.w||R.start)),o:d.o||"",proof:Array.isArray(d.proof)?d.proof:[],risks:[],tasks:[]};P.ms.push(m);P.ms.sort((a,b)=>a.w-b.w);break}
  case "move_ms":{const m=findM(P,s.target);if(!m)throw 0;m.w=Math.min(P.due,Math.max(R.start,+d.w));P.ms.sort((a,b)=>a.w-b.w);break}
  case "rewrite_task":{const t=findT(P,s.target);if(!t)throw 0;if(d.t)t.t=d.t;if(d.dw!=null)t.dw=d.dw;break}
  case "split_task":{const t=findT(P,s.target);if(!t||!Array.isArray(d.parts))throw 0;const m=findM(P,t._m),i=m.tasks.indexOf(t);
   const parts=d.parts.map((p,k)=>({id:uid("t"),t:p.t,dw:p.dw||"",o:t.o,e:+p.e||2,deps:k?[]:t.deps.slice()}));for(let k=1;k<parts.length;k++)parts[k].deps=[parts[k-1].id];
   m.tasks.splice(i,1,...parts);markSplit(t.id);allTasks(P).forEach(x=>{if(x.deps.includes(t.id))x.deps=x.deps.map(z=>z===t.id?parts[parts.length-1].id:z)});break}
  case "set_owner":case "reassign_task":{const t=findT(P,s.target);if(!t)throw 0;t.o=d.o;break}
  case "add_task":{const m=findM(P,s.target);if(!m)throw 0;m.tasks.push({id:uid("t"),t:d.t||"New task",dw:d.dw||"",o:d.o||m.o,e:+d.e||0,deps:[],nb:+d.nb||undefined});break}
  case "set_est":{const t=findT(P,s.target);if(!t)throw 0;t.e=+d.e;break}
  case "add_risk":{const m=findM(P,s.target);if(!m)throw 0;m.risks.push({t:d.t||"",mit:d.mit||"",l:d.l||"medium"});break}
  case "set_focus":{if(!TEAM[s.target])throw 0;TEAM[s.target].focus=+d.h;break}
  default:throw 0}}
const SUGT={rewrite_ms:"Rewrite milestone",add_ms:"Add milestone",move_ms:"Move milestone",rewrite_task:"Rewrite task",split_task:"Split task",set_owner:"Set owner",reassign_task:"Rebalance",add_task:"Add task",set_est:"Correct estimate",add_risk:"Add risk",set_focus:"Capacity"};
function sugPreview(P,s){const d=s.data||{};const t=findT(P,s.target),m=findM(P,s.target);
 switch(s.type){case "rewrite_ms":return `<b>${esc(d.t||m&&m.t)}</b>${d.proof?`<br>Proof: ${d.proof.map(esc).join(" · ")}`:""}`;
  case "add_ms":return `<b>W${d.w} · ${esc(d.t)}</b>${d.proof?`<br>Proof: ${d.proof.map(esc).join(" · ")}`:""}`;
  case "move_ms":return `${esc(m?m.t:"")} → <b>W${d.w}</b>`;
  case "rewrite_task":return `<b>${esc(d.t||t&&t.t)}</b>${d.dw?`<br>Done when: ${esc(d.dw)}`:""}`;
  case "split_task":return (d.parts||[]).map(p=>`• ${esc(p.t)} <span class="mono">${p.e} h</span>`).join("<br>");
  case "set_owner":case "reassign_task":return `${esc(t?t.t:"")} → <b>${esc(TEAM[d.o]?nm(d.o):d.o)}</b>`;
  case "add_task":return `<b>${esc(d.t)}</b>${d.dw?`<br>Done when: ${esc(d.dw)}`:""} <span class="mono">${d.e||"?"} h</span>`;
  case "set_est":return `${esc(t?t.t:"")}: <span class="mono">${t?t.e:"?"} h → <b>${d.e} h</b></span>`;
  case "add_risk":return `<b>${esc(d.t)}</b><br>Mitigation: ${esc(d.mit)}`;
  case "set_focus":return `${esc(TEAM[s.target]?nm(s.target):"")}: <b>${d.h} focus h / week</b>`}return ""}
// Built-in guidance (used when Claude cannot be reached from this view): the rule checks of the step
const BUILTIN={};

/* ================= Claude ================= */
let SAMPLE=null,BUSY=null;
let PLANNER=null;
(async()=>{try{SAMPLE=await window.claude?.use?.("sample")}catch(e){SAMPLE=null}try{PLANNER=window.claude&&window.claude.web?await window.claude.use("planner"):null}catch(e){PLANNER=null}renderGuideMode()})();
/*@PROMPTS@*/
/* ===== Claude planner: SKL OS context + prompt assembly ===== */
const CTX={};
function fill(t,v){return String(t).replace(/\{\{(\w+)\}\}/g,(m,k)=>v[k]!=null?v[k]:m)}
function pvars(P,extra){const K=krOf(P.kr);return Object.assign({today:todayLabel(),start:R.start,due:P.due,msWeek:R.msWeek,taskMax:R.taskMax,dayH:R.dayH,days:R.days,weekMax:R.weekMax,owners:Object.keys(TEAM).join(", "),krNum:K.t.split(" · ")[0],krWords:K.t.split(" · ").slice(1).join(" ").split(/\s+/).filter(w=>/^[a-z]{4,}$/i.test(w)).slice(0,3).join(" ")},extra||{})}
const asText=r=>{const v=r&&typeof r==="object"&&("payload" in r)?r.payload:r;return typeof v==="string"?v:JSON.stringify(v)};
const cutT=(t,n)=>t.length>n?t.slice(0,n)+" …[cut]":t;
async function sklRead(tool,args,signal){if(!MCP)throw new Error("SKL OS is not connected in this view");return asText(await MCP.callTool("SKL OS",tool,args||{},signal?{signal}:undefined))}
async function sklContext(P){const k=P.kr,c=CTX[k];if(c&&Date.now()-c.at<6e5)return c;if(!MCP)return null;const v=pvars(P);
 const parts=await Promise.all(PROMPTS.context.map(async([tool,args])=>{const a=JSON.parse(fill(JSON.stringify(args),v));try{return {ok:1,t:`### ${tool} ${JSON.stringify(a)}\n`+cutT(await sklRead(tool,a),3500)}}catch(e){return {ok:0,t:`### ${tool}\n(not available: ${e&&(e.code||e.message)||"error"})`}}}));
 const n=parts.filter(x=>x.ok).length;CTX[k]={at:Date.now(),n,text:parts.map(x=>x.t).join("\n\n")};renderGuideMode();return CTX[k]}
function promptFor(step,free,P,ctx){const v=pvars(P,{question:free||""}),L=weekLoad(P),K=krOf(P.kr);
 return [fill(PROMPTS.system,v),fill(free?PROMPTS.steps.free:(PROMPTS.steps[step]||PROMPTS.steps.milestones),v),
  "## CONTEXT (SKL OS, read live)\n"+(ctx&&ctx.n?ctx.text:"Not available in this view. Work from PLAN only and say what you could not check."),
  "## TARGETED KEY RESULT\n"+JSON.stringify(Object.assign({},K,{owner:TEAM[K.o]?nm(K.o):K.o,builder:TEAM[S.exec.who]?nm(S.exec.who):""})),
  "## PLAN\n"+planJSON(P),
  "## LOAD (planned hours per person per week, limit "+R.weekMax+" h)\n"+JSON.stringify(Object.fromEntries(L.people.map(o=>[o,Object.fromEntries(L.weeks.map(w=>{const c=L.rows[o][w];return ["W"+w,c?+(c.plan+c.other+c.carry).toFixed(1):0]}))]))),
  "## CARRY (left from last week)\n"+JSON.stringify(carryItems().filter(c=>!c.st).map(c=>({who:c.who,type:c.type,t:c.t,h:c.e,why:c.why}))),
  "## TEAM\n"+JSON.stringify(Object.fromEntries(Object.entries(TEAM).map(([k,t])=>[k,{name:t.n,coefficient:t.coef}]))),
  fill(PROMPTS.output,v),fill(PROMPTS.selfcheck,v)].join("\n\n")}
const sklTool={name:PROMPTS.tool.name,description:PROMPTS.tool.description,inputSchema:PROMPTS.tool.inputSchema,
 execute:async(input,ctx)=>{const t=String(input&&input.tool||"");if(!PROMPTS.tool.inputSchema.properties.tool.enum.includes(t))throw new Error("Unknown read tool: "+t);setStatus("Reading SKL OS · "+t,"dots");
  return cutT(await sklRead(t,input.args&&typeof input.args==="object"?input.args:{},ctx&&ctx.signal),8000)}};
const METHOD=`SKL OS roadmap method (apply strictly):
- Outcome: a key result with a number and one owner, due at the end of the quarter, plus why it matters.
- Milestones are RESULTS true on Sunday 8 pm of their week, never activities ("work on", "prepare"…). Each has 1-4 proof lines anyone can check, one owner, a week between W${R.start} and the KR deadline. Build this week's milestones first; later weeks are optional. At most ${R.msWeek} milestones in the same week.
- Tasks are the next physical action: start with a verb, a "done when", one owner, an estimate of at most ${R.taskMax} h (split bigger ones).
- Estimates are corrected by each person's coefficient (actual ÷ estimated). Compare with similar past work (reference class).
- Each person plans at most ${R.dayH} h a day, ${R.days} days a week (${R.weekMax} h a week); help given to colleagues comes on top of that. Commit only with no blocking issue.
- Pre-mortem: assume the KR failed, list why, give each risk a mitigation.
Never invent facts about the company; say "to confirm" instead. Write in English. Never write "closer": say "sales".`;
const SUGSCHEMA=`Suggestion types (use the exact ids from the plan): rewrite_ms {target: milestone id, data:{t, proof:[...]}}, add_ms {data:{t, w, o, proof:[...]}}, move_ms {target, data:{w}}, rewrite_task {target: task id, data:{t, dw}}, split_task {target: task id, data:{parts:[{t, dw, e}]}}, set_owner {target: task id, data:{o}}, reassign_task {target: task id, data:{o}}, add_task {target: milestone id, data:{t, dw, o, e}}, set_est {target: task id, data:{e}}, add_risk {target: milestone id, data:{t, mit, l:"low"|"medium"|"high"}}. Owners: ${Object.keys(TEAM).join(", ")}.`;
function planJSON(P){const F=forecast(P);return JSON.stringify({kr:krOf(P.kr),deadlineWeek:P.due,why:P.why,today:todayLabel(),team:Object.fromEntries(Object.entries(TEAM).map(([k,v])=>[k,{coefficient:v.coef}])),
 milestones:P.ms.map(m=>({id:m.id,week:m.w,owner:m.o,title:m.t,proof:m.proof,risks:m.risks,checksFailed:msChecks(P,m).filter(c=>!c.ok).map(c=>c.lab),
  tasks:m.tasks.map(t=>({id:t.id,title:t.t,doneWhen:t.dw,owner:t.o,estimateH:t.e,deps:t.deps,checksFailed:taskChecks(P,t).filter(c=>!c.ok).map(c=>c.lab)}))})),
 gaps:gaps(P).map(g=>"W"+g.join(", W")),weeksOverLimit:weekLoad(P).over.map(x=>`${x.o} W${x.w} ${x.h.toFixed(1)} h`)})}
const STEPASK={outcome:"Review the outcome: is it measurable, dated and owned, and is the why convincing? Suggest nothing structural yet.",
 milestones:"Work backwards from the deadline. Fix milestones that are activities, missing proof or owners, and keep at most 3 per week. Up to 4 suggestions.",
 tasks:"For each milestone, check that its tasks deliver the proof. Fix tasks without a verb, done-when or owner, split tasks over 4 h, add missing tasks. Up to 5 suggestions.",
 estimates:"Challenge estimates that look optimistic for their kind of work, using reference classes; give the reason. Up to 4 suggestions.",
 premortem:"Run a pre-mortem: it is the deadline and the KR missed. Give the most likely reasons, one per milestone, each with a mitigation. Up to 4 suggestions of type add_risk.",
 commit:"Give a short final review before commit: what is strong, what is still weak, what to watch in week 1. No suggestions unless something blocks."};
function pushFeed(item){(S.feed[S.kr]=S.feed[S.kr]||[]).push(item);renderFeed()}
async function ask(step,free){const P=plan();if(BUSY)return;
 if(free)pushFeed({k:"me",t:free});
 if(!SAMPLE&&PLANNER)return askPlanner(step,free,P);
 if(!SAMPLE){builtin(step,free);return}
 const ctl=new AbortController();BUSY=ctl;renderGuideActions();
 try{setStatus(MCP?"Reading SKL OS":"Claude is thinking","dots");
  const ctx=await sklContext(P).catch(()=>null);if(ctl.signal.aborted)throw {code:"cancelled"};
  setStatus("Claude is thinking","dots");
  const prompt=promptFor(step,free,P,ctx);let lim=null;try{lim=await SAMPLE.limits()}catch(e){}
  const opts={signal:ctl.signal,cache:false};if(!lim||!lim.modelTiers||lim.modelTiers.includes("complex"))opts.modelTier="complex";
  if(MCP&&lim&&lim.tools)opts.tools=[sklTool];
  let out;try{out=await SAMPLE.json(prompt,opts)}catch(e){if(e&&opts.tools&&(e.code==="tools_unavailable"||e.code==="invalid_request")){delete opts.tools;out=await SAMPLE.json(prompt,opts)}else throw e}
  pushFeed({k:"cl",t:String(out&&out.message||"Done.")+(out&&out.question?"\n\n"+String(out.question):"")});
  (Array.isArray(out&&out.suggestions)?out.suggestions:[]).slice(0,6).forEach(x=>{if(x&&SUGT[x.type])pushFeed({k:"sug",s:x,id:uid("s")})});
  setStatus("")}
 catch(e){setStatus("");const c=e&&e.code;
  if(c==="not_granted"||c==="sampling_disabled"||c==="capability_disabled"||c==="not_declared"){SAMPLE=null;renderGuideMode();builtin(step,free);return}
  if(c==="cancelled"){pushFeed({k:"sys",t:"Stopped."})}
  else if(c==="rate_limited")pushFeed({k:"sys",t:"Claude is busy for your account right now. Try again in a minute."});
  else pushFeed({k:"sys",t:"Claude did not answer this time ("+(c||"error")+"). Try again."})}
 finally{BUSY=null;renderGuideActions()}}
async function askPlanner(step,free,P){const ctl=new AbortController();BUSY=ctl;renderGuideActions();
 try{setStatus("Claude is reading SKL OS","dots");const out=await PLANNER.ask(plannerBody(step,free,P),ctl.signal);
  pushFeed({k:"cl",t:String(out&&out.message||"Done.")+(out&&out.question?"\n\n"+String(out.question):"")});
  (Array.isArray(out&&out.suggestions)?out.suggestions:[]).slice(0,6).forEach(x=>{if(x&&SUGT[x.type])pushFeed({k:"sug",s:x,id:uid("s")})});setStatus("")}
 catch(e){setStatus("");const c=e&&e.code;if(c==="cancelled"||(e&&e.name==="AbortError"))pushFeed({k:"sys",t:"Stopped."});else if(c==="rate_limited")pushFeed({k:"sys",t:"Claude is busy for your account right now. Try again in a minute."});else if(c==="not_configured"){PLANNER=null;renderGuideMode();builtin(step,free)}else pushFeed({k:"sys",t:"Claude did not answer this time ("+(c||"error")+"). Try again."})}
 finally{BUSY=null;renderGuideActions()}}
// what /api/planner needs to rebuild promptFor() on the server: the same sections, CONTEXT read there
function plannerBody(step,free,P){const v=pvars(P,{question:free||""}),L=weekLoad(P),K=krOf(P.kr);
 return {version:PROMPTS.version,step,question:free||"",vars:v,kr:P.kr,
  targeted:JSON.stringify(Object.assign({},K,{owner:TEAM[K.o]?nm(K.o):K.o,builder:TEAM[S.exec.who]?nm(S.exec.who):""})),
  plan:planJSON(P),
  load:JSON.stringify(Object.fromEntries(L.people.map(o=>[o,Object.fromEntries(L.weeks.map(w=>{const c=L.rows[o][w];return ["W"+w,c?+(c.plan+c.other+c.carry).toFixed(1):0]}))]))),
  carry:JSON.stringify(carryItems().filter(c=>!c.st).map(c=>({who:c.who,type:c.type,t:c.t,h:c.e,why:c.why}))),
  team:JSON.stringify(Object.fromEntries(Object.entries(TEAM).map(([k,t])=>[k,{name:t.n,coefficient:t.coef}])))}}
function builtin(step,free){const P=plan(),B=(BUILTIN[S.kr]||{})[step];
 if(free){pushFeed({k:"cl",t:"This question needs Claude: open the page in Claude and allow it to ask Claude, or use the web edition. Meanwhile the built-in guide still checks every rule of this step."});}
 if(B&&!free){pushFeed({k:"cl",t:B.msg});B.sugs.forEach(s=>{const done=(S.feed[S.kr]||[]).some(f=>f.k==="sug"&&JSON.stringify(f.s)===JSON.stringify(s));if(!done)pushFeed({k:"sug",s,id:uid("s")})});return}
 if(!free){const issues=stepIssues(P,step);pushFeed({k:"cl",t:issues?`${issues} point${issues>1?"s":""} to fix in this step. Each one is marked in red on the plan, with the rule it breaks.`:"This step passes every check. Move on when you are ready."})}}
function setStatus(t,cls){const el=$id("gstatus");el.innerHTML=t?`<span class="${cls||""}">${esc(t)}</span> <button class="btn ghost sm" data-stop="1">Stop</button>`:""}

/* ================= events ================= */
function toast(t){const el=$id("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.k);toast.k=setTimeout(()=>el.hidden=true,3600)}
function changed(){FC.sig="";render()}
on("click",e=>{const t=e.target.closest("button,[data-step]");if(!t)return;const P=plan(),d=t.dataset;
 if(d.view){if(d.view!==S.view)goScreen(d.view);return}
 if(boardClick(t,d))return;
 if(d.method){S.pop="method";return renderPop()}
 if(d.close){if(e.target===t||t.classList.contains("close")){S.pop=null;renderPop()}return}
 if(d.ctog){S.carryOpen=S.carryOpen===false;renderCarry();save();return}
 if(d.cdrop){S.carryDone=Object.assign(S.carryDone||{},{[d.cdrop]:"dropped"});FC.sig="";toast("Set aside for this plan. It stays visible in Execute.");return render()}
 if(d.creset){S.carryDone={};FC.sig="";return render()}
 if(d.gokr){S.kr=d.gokr;S.step="commit";FC.sig="";render();window.scrollTo({top:0,behavior:"smooth"});return}
 if(d.weekovr){const r=($id("wovr")||{}).value||"";if(!r.trim()){toast("Write why the week is unlocked.");return}if(!isLead(SK.me)){toast("Only a lead ("+LEADS.map(x=>TEAM[x]?nm(x):x).join(" or ")+") unlocks a week.");return}const who=S.exec.who,w=isoWk(D().n);setWeek(who,w,{at:new Date().toISOString(),override:r.trim(),by:SK.me});
  SK.createDecision({title:`Week W${w} unlocked for ${nm(who)} without a committed roadmap`,question:`Unlock week W${w} for ${nm(who)} before their roadmap is committed?`,col:"review",owner:SK.me,source:"Execute · week gate",expected:r.trim(),decided:SK.iso(SK.today),reviewNote:r.trim()});
  toast(`Week W${w} unlocked for ${nm(who)}. Logged as a decision for Saturday's review.`);return render()}

 if(d.gobuild){const need=null;S.step="commit";FC.sig="";goScreen("build");window.scrollTo({top:0,behavior:"smooth"});toast("Commit your roadmap at the bottom of Commit.");return}
 if(d.selkr){const id=d.selkr,i=S.sel.indexOf(id);if(i>=0){S.sel.splice(i,1);if(S.kr===id&&S.sel.length)S.kr=S.sel[0]}else{if(S.sel.length>=R.krMax){toast(`${R.krMax} key results at most this week: untick one first.`);return}S.sel.push(id);S.kr=id}
  try{localStorage.setItem("skl_build_sel:"+S.exec.who,JSON.stringify(S.sel))}catch(e){}FC.sig="";S.choose={};render();return}
 if(d.pickkr&&!S.sel.includes(d.pickkr)){if(S.sel.length>=R.krMax){toast(`${R.krMax} key results at most this week: untick one first.`);return}S.sel.push(d.pickkr);try{localStorage.setItem("skl_build_sel:"+S.exec.who,JSON.stringify(S.sel))}catch(e){}}
 if(d.pickkr){S.kr=d.pickkr;FC.sig="";S.choose={};render();toast("Targeting "+krOf(S.kr).t.split(" · ")[0]+(krOf(S.kr).o!==S.exec.who?". Owned by "+TEAM[krOf(S.kr).o].n+": build it with their agreement.":". The steps now work on this key result."));return}
 if(d.ckeep){const[w,id]=d.ckeep.split(":"),c=S.choose[S.kr+":"+w];const i=c.keep.indexOf(id);if(i>=0)c.keep.splice(i,1);else{if(c.keep.length>=capIn(P,+w)){toast(`${capIn(P,+w)} already kept. Untick one first.`);return}c.keep.push(id);delete c.act[id]}return renderWS()}
 if(d.capply){const w=+d.capply,c=S.choose[S.kr+":"+w];P.ms.slice().forEach(m=>{if(m.w!==w||c.keep.includes(m.id))return;const a=c.act[m.id];if(a==="rm")dropMs(P,m.id);else if(a)m.w=+a.slice(1)});P.ms.sort((a,b)=>a.w-b.w);delete S.choose[S.kr+":"+w];toast(`W${w} now carries ${R.msWeek} milestones.`);return changed()}
 if(d.step){const i=STEPS.findIndex(s=>s[0]===d.step);if(blockedFrom(i)){const f=firstOver(),o=f.o;S.step="milestones";render();toast(`${krShort(krOf(f.P.kr))} · W${o.w} has ${o.list.length+othersIn(f.P,o.w)} of your milestones. Keep ${R.msWeek} before going further.`);return}S.step=d.step;return render()}
 if(d.next){const i=STEPS.findIndex(s=>s[0]===S.step);if(blockedFrom(i+1)){const f=firstOver(),o=f.o;toast(`${krShort(krOf(f.P.kr))} · W${o.w} has ${o.list.length+othersIn(f.P,o.w)} of your milestones. Keep ${R.msWeek} before the next step.`);$one(".chooser")&&$one(".chooser").scrollIntoView({behavior:"smooth",block:"center"});return}S.step=STEPS[Math.min(STEPS.length-1,i+1)][0];render();window.scrollTo({top:0,behavior:"smooth"});return}
 if(d.ask){return ask(S.step)}
 if(d.q){return ask(S.step,d.q)}
 if(d.stop){BUSY&&BUSY.abort();return}
 if(d.acc||d.dis){const f=(S.feed[S.kr]||[]).find(x=>x.id===(d.acc||d.dis));if(!f)return;if(d.dis){f.done="dismissed";return render()}
  try{applySug(P,f.s);f.done="applied";if(["reassign_task","set_focus","move_ms"].includes(f.s.type)){(S.feed[S.kr]||[]).forEach(x=>{if(x.k==="sug"&&!x.done&&["reassign_task","set_focus","move_ms"].includes(x.s.type))x.done="outdated"});changed();}else changed();toast("Applied: "+(SUGT[f.s.type]||"change"))}catch(err){f.done="could not apply";render();toast("This suggestion no longer matches the plan.")}return}
 if(d.addms){P.ms.push({id:msNewId(P),t:"",w:Math.max(R.start,(P.ms[P.ms.length-1]||{w:R.start}).w),o:krOf(S.kr).o,proof:[""],risks:[],tasks:[]});P.ms.sort((a,b)=>a.w-b.w);return changed()}
 if(d.rmms){const m=findM(P,d.rmms);if(m&&!m.t.trim()&&!m.tasks.length){dropMs(P,m.id);return changed()}return SK.confirm({title:"Remove this milestone?",body:"Its tasks and risks go with it.",ok:"Remove",onOk:()=>{dropMs(plan(),d.rmms);changed()}})}
 if(d.addp){findM(P,d.addp).proof.push("");return changed()}
 if(d.rmp){const[m,k]=d.rmp.split(":"),go=()=>{findM(plan(),m).proof.splice(+k,1);changed()};if(!(findM(P,m).proof[+k]||"").trim())return go();return SK.confirm({title:"Remove this proof line?",body:"It is no longer checked on Sunday.",ok:"Remove",onOk:go})}
 if(d.th){const[id,k]=d.th.split(":"),x=findT(P,id);if(x){x.e=Math.max(0,Math.min(8,(+x.e||0)+(k==="+"?.5:-.5)));return changed()}return}
 if(d.addt){findM(P,d.addt).tasks.push({id:uid("t"),t:"",dw:"",o:(TEAM[S.exec&&S.exec.who]?S.exec.who:"")||(TEAM[SK.me]?SK.me:""),e:0,deps:[]});return changed()}
 if(d.rmt){const x=findT(P,d.rmt);if(x&&!SK.get("tasks",x.id)&&!x.t.trim()){dropTask(P,x.id);return changed()}return SK.confirm({title:"Remove this task?",body:"It leaves the plan and the forecast.",ok:"Remove",onOk:()=>{if(dropTask(plan(),d.rmt))changed()}})}
 if(d.addrisk){findM(P,d.addrisk).risks.push({t:"",mit:"",l:"medium"});return changed()}
 if(d.rmrisk){const[m,k]=d.rmrisk.split(":"),r=findM(P,m).risks[+k],go=()=>{findM(plan(),m).risks.splice(+k,1);changed()};if(!(r.t||"").trim()&&!(r.mit||"").trim())return go();return SK.confirm({title:"Remove this risk?",body:"It leaves the pre-mortem of this milestone.",ok:"Remove",onOk:go})}
 if(d.mittask){const m=findM(P,d.mittask),r=m.risks.find(x=>x.mit);m.tasks.unshift({id:uid("t"),t:r.mit,dw:"Mitigation in place",o:m.o,e:.5,deps:[]});toast("Mitigation added as a task of this milestone");return changed()}
 if(d.commit){const who=S.exec.who;if(lockedWeek()){toast(lockMsg());return}if(SK.me&&SK.me!==who){toast(`Only ${nm(who)} commits their roadmap.`);return}if(!(S.sel||[]).length){toast("Tick at least one key result in The outcome first.");S.step="outcome";return render()}
  const bad=myIssues().filter(x=>x.v);if(bad.length){toast(`Fix ${bad.map(x=>x.n).join(", ")} first.`);return}const w=isoWk(D().n);setWeek(who,w,{at:new Date().toISOString(),by:SK.me||who,krs:(S.sel||[]).slice()});
  toast(`Roadmap W${w} committed. Execute is open for ${nm(who)}.`);return render()}
 if(execClick(t,d))return;
});
on("input",e=>{const t=e.target,P=plan(),d=t.dataset;
 if(d.mf){const[id,k]=d.mf.split(":"),m=findM(P,id);if(k==="t"){m.t=t.value;fit(t)}return lazy()}
 if(d.tf){const[id,k]=d.tf.split(":"),x=findT(P,id);if(k==="t"||k==="dw"){x[k]=t.value;if(t.tagName==="TEXTAREA")fit(t);return lazy()}}
 if(d.pf){const[id,k]=d.pf.split(":");findM(P,id).proof[+k]=t.value;return lazy()}
 if(d.rk){const[id,k,f]=d.rk.split(":");findM(P,id).risks[+k][f]=t.value;return lazy()}
 if(d.f==="why"){P.why=t.value;return lazy()}
 if(t.id==="xmsg"&&S.pop&&S.pop.x){S.pop.text=t.value}
 if(t.id==="xpts"&&S.pop&&S.pop.x){S.pop.pts=t.value}
 if(t.id==="xslt"&&S.pop&&S.pop.x){S.pop.text=t.value}
 if(t.id==="xcmt"){D().comment=t.value;save()}
 if(t.id==="xslq"&&S.pop&&S.pop.x){S.pop.q=t.value}});
on("submit",e=>{const f=e.target,d=f.dataset||{};if(d.xslf){e.preventDefault();slackSearch();return}
 if(d.xntf){e.preventDefault();const t=$id("xnt").value.trim();if(!t){toast("Write the task first.");return}const day=D();day.newT=day.newT||[];
  const lk=msLink($id("xnl").value);day.newT.push(Object.assign({id:uid("n"),t,dw:$id("xnd").value.trim(),e:+$id("xnh").value||1,dayN:+$id("xndate").value},lk));renderExec();toast("Planned. It will be in the list that day.");const n=$id("xnt");n&&n.focus();return}
 if(d.xqf){e.preventDefault();const t=$id("xqt").value.trim();if(!t)return;const h=+$id("xqh").value||1,day=D();const it={id:uid("q"),t,dw:"",tag:"Added today",e:h,p:h,src:"extra"};day.extra.push(it);insertItem(day,it,null);renderExec();toast("Added to Today.");return}
 if(!d.xaddf)return;e.preventDefault();const i=$id("xnew"),v=i.value.trim();if(!v)return;const day=D();if(allObjs(day).some(o=>o.t===v)){toast("Already in the list.");return}day.own.push({t:v,h:1});const on=day.sel.length<3;if(on)day.sel.push(v);repropose(day);renderExec();toast(on?"Added and chosen. A 1 h task for it is in the list.":"Added. Untick an objective to choose it.");const n=$id("xnew");n&&n.focus()});
let LZ=null;function lazy(){clearTimeout(LZ);LZ=setTimeout(()=>{FC.sig="";renderSteps();renderScore();save();refreshChecks()},350)}
function refreshChecks(){const a=activeEl(),id=a&&a.dataset&&(a.dataset.mf||a.dataset.tf||a.dataset.pf||a.dataset.rk||a.dataset.f),pos=a&&a.selectionStart,end=a&&a.selectionEnd;REDRAW=true;try{renderWS()}finally{REDRAW=false}if(id){const el=$one(`[data-mf="${id}"],[data-tf="${id}"],[data-pf="${id}"],[data-rk="${id}"],[data-f="${id}"]`);if(el){REDRAW=true;try{el.focus();el.setSelectionRange(pos,end)}catch(e){}finally{REDRAW=false}}}}
on("change",e=>{const t=e.target,P=plan(),d=t.dataset;
 if(t.id==="kr"){S.kr=t.value;FC.sig="";S.choose={};return render()}
 if(d.meas&&typeof saveMeas==="function"){saveMeas(+d.meas,t.value.trim(),d.measkr);return}
 if(d.cplan){const c=carryItems().find(x=>x.id===d.cplan),m=findM(P,t.value);if(c&&m){m.tasks.push({id:"cv-"+c.id,t:c.t,dw:"",o:c.who,e:c.e,deps:[]});S.carryDone=Object.assign(S.carryDone||{},{[c.id]:"planned"});toast(`Planned under M${P.ms.indexOf(m)+1}. Give it a done-when in Tasks.`);return changed()}return}
 if(d.cres){S.carryReserve=t.checked;FC.sig="";toast(t.checked?"Carry-over hours counted in W"+R.start+".":"Carry-over hours no longer counted.");return render()}
 if(d.cact){const[w,id]=d.cact.split(":");S.choose[S.kr+":"+w].act[id]=t.value;return renderWS()}
 if(d.who){setWho(t.value);return render()}
 if(d.xstart){D().start=t.value;return renderExec()}
 if(d.xobjtask){const id=t.value;if(!id)return;const day=D(),G=pool(),i=[...G.carried,...G.planned,...G.other].find(x=>x.id===id);if(!i)return;
  if(!day.own.some(o=>o.task===id))day.own.push({t:i.t,h:i.e||1,task:id});const on=day.sel.length<3&&!day.sel.includes(i.t);if(on)day.sel.push(i.t);
  day.frozen=false;repropose(day);renderExec();toast(on?"Task chosen as an objective: it must be finished today.":"Task added to your objectives. Three are chosen: untick one to use it.");return}
 if(d.xhours){const day=D();day.hours=+t.value;day.frozen=false;day.plan=day.plan.filter(i=>i.manual);day.plan=propose(day);toast(`Proposal adapted to ${day.hours} h of your own work. Help comes on top.`);return renderExec()}
 if(d.mf){const[id,k]=d.mf.split(":"),m=findM(P,id);if(k!=="w"&&k!=="o")return;if(k==="w"){m.w=+t.value;P.ms.sort((a,b)=>a.w-b.w)}if(k==="o")m.o=t.value;return changed()}
 if(d.tf){const[id,k]=d.tf.split(":"),x=findT(P,id);if(k!=="o"&&k!=="e")return;if(k==="o")x.o=t.value;if(k==="e")x.e=+t.value||0;return changed()}
 if(d.te){findT(P,d.te).e=+t.value||0;return changed()}
 if(d.focus){TEAM[d.focus].focus=Math.max(1,+t.value||1);return changed()}
 if(d.rk){const[id,k,f]=d.rk.split(":");findM(P,id).risks[+k][f]=t.value;if(t.tagName==="SELECT")return changed();return lazy()}});
on("submit",e=>{if(!e.target||e.target.id!=="gform")return;e.preventDefault();const v=$id("gtext").value.trim();if(!v)return;$id("gtext").value="";ask(S.step,v)});
on("keydown",e=>{if(e.target&&e.target.id==="gtext"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();$id("gform").requestSubmit()}});
on("keydown",e=>{if(e.key==="Escape"&&S.pop){S.pop=null;renderPop()}});

/* ================= method popup ================= */
function renderPop(){const el=$id("pop");if(!S.pop){el.innerHTML="";return}
 if(S.pop.x){el.innerHTML=S.pop.x==="msg"?msgPopHTML(S.pop):S.pop.x==="slack"?slackPopHTML(S.pop):S.pop.x==="unpl"?unplPopHTML(S.pop):S.pop.x==="ask"?askPopHTML(S.pop):S.pop.x==="ms"?msPopHTML(S.pop):S.pop.x==="kr"?krPopHTML(S.pop):S.pop.x==="meas"?measTabHTML():eodPopHTML();return}
 el.innerHTML=`<div class="scrim" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="dh"><div><div class="pk" style="color:var(--gold2)">Page method</div><h2 id="mh">${S.view==="exec"?"Execute":"Build"}</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <section><h4>What it is for</h4><p>Turn a key result into a roadmap that holds: milestones anyone can check, tasks small enough to finish, estimates corrected by real records, a week that fits ${R.weekMax} h per person, then execution one task at a time.</p></section>
 <section><h4>The method, and where it comes from</h4><ul>
  <li><b>Week by week</b>: each week sets up to three milestones, results that must be true on Sunday; later weeks are built when they come.</li>
  <li><b>Milestones are results</b>, checked on Sunday 8 pm against proof lines (OKR practice: outcomes, not activities).</li>
  <li><b>Definition of ready and done</b> for tasks: a verb, a done-when, one owner, ${R.taskMax} h at most.</li>
  <li><b>Reference-class forecasting and calibration</b>: estimates are compared with similar past work and corrected by each person's actual ÷ estimated record.</li>
  <li><b>Priority by due date and critical path</b>: the task of the earliest milestone goes first, then the one that unblocks the most.</li>
  <li><b>Pre-mortem</b>: assume failure, list the causes, mitigate them before starting.</li>
  <li><b>Daily planning</b>: each day starts with three objectives (results visible tonight) and a timed roadmap that fits the focus hours; it is validated before the first task.</li>
  <li><b>Work in progress = 1</b> in Execute: one card at a time, the day's timeline above it, the real time recorded.</li>
  <li><b>End-of-day review</b>: what is not finished is replanned on the spot (tomorrow first, back to the queue, or dropped) with what got in the way; the EOD recap is then written from the day and posted to Slack once you validate it.</li></ul></section>
 <section><h4>Decisions taken for SKL OS</h4><ul>
  <li>Task: ${R.taskMax} h at most; above that it is split.</li>
  <li>Milestone: a result with proof lines; ${R.msWeek} per week at most, only this week's are required, and a fourth one must be chosen out before going further.</li>
  <li>Priority is computed by the OS. A person cannot reorder the queue; a lead can override with a written reason.</li>
  <li>Planned work: ${R.dayH} h a day, ${R.days} days a week (${R.weekMax} h). Help given to colleagues comes on top and is counted per person.</li>
  <li>Each person commits their own roadmap of the week, with no blocking issue on their milestones and tasks; it opens Execute for them.</li>
  <li>Help requests wait until the current card is done, unless marked urgent; their cost on your milestone is shown. Every answer (accept, later today, tomorrow, decline) sends a message to the person who asked, prepared for that answer or written by Claude from your main points.</li>
  <li>Blocked needs a reason and who it waits on; it raises a risk on the milestone.</li>
  <li>The Cockpit is unchanged; it reads the plan, the actual times and the help given.</li></ul></section>
 <section><h4>How to use it</h4><ul><li>Pick a key result, then go through the six steps on the left; red marks show which rule is broken.</li><li>Ask Claude at each step. Every suggestion shows a preview and a reason; nothing changes until you accept it.</li><li>Commit, then open Execute.</li></ul></section>
 <p class="note">Coefficients are measured from Execute (actual ÷ estimated, last four weeks); until four weeks exist they come from the Registers (config "coefficients"), 1.3 by default. Plans, weeks, days and requests are shared through SKL OS.</p></div></div></div>`}

/* ================= the two screens ================= */
// the SKL OS sidebar replaces the reference's left navigation; the top bar keeps both views as a segmented control
function goScreen(v){S.view=v;window.postMessage({skl:"go",screen:v==="exec"?"execute":"build"},"*")}
function renderBar(){const el=$id("os2ctx");if(!el)return;const who=S.exec&&S.exec.who;
 el.textContent=S.view==="exec"?`${nm(who)} · ${todayLabel()}`:S.sub==="krs"?`${KRS.length} key results · ${todayLabel()}`:`Week being planned W${R.start} · ${todayLabel()}`}
function typing(root){const a=root.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))}
function attach(root,view){ROOTS[view]=root;LISTEN.forEach(([t,f])=>bind(view,t,f));
 const api={render(){const prev=S.view;S.view=view;try{syncAll();saveExec()}catch(e){console.error(e)}refresh();
  // S.openKr / S.goto from the other screens: the key result to build, the person whose day to open
  const fk=SK.takeFocus&&SK.takeFocus(view==="build"?"build":"execute");if(fk&&view==="build"&&S.plans[fk])S.kr=fk;if(fk&&view==="exec"&&TEAM[fk]&&fk!==S.exec.who)setWho(fk);
  if(typing(root)){if(view==="build"){renderSteps();renderScore()}renderBar();return}render();if(prev!==view)window.scrollTo(0,0)}};
 api.render();return api}

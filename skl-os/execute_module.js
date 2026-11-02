/* ================= execute: set up the day, then one task at a time ================= */
// The request a colleague sent, shown as the help card between two tasks (REQS: shared "requests" not answered yet)
let HELP={id:"",from:"",t:"",dw:"",e:0,urgent:false};
// Day n of a person = the n-th working day (Monday to Saturday: 9 h × 6 days) from the first day they used Execute (d0).
// On screen a day is named by its place in the week (Romain 2026-11-02): Monday = Day 1 … Saturday = Day 6 (weekDayNo).
function dayDateOf(d0,n){let d=utcOf(d0),k=1;while(k<n){d=new Date(d.getTime()+864e5);if(d.getUTCDay())k++}return d}
function oldDateOf(d0,n){let d=utcOf(d0),k=1;while(k<n){d=new Date(d.getTime()+864e5);const w=d.getUTCDay();if(w&&w!==6)k++}return d} // before 2026-11-02: Monday to Friday
function nOfDate(d0,date){let n=1;while(dayDateOf(d0,n)<date&&n<5000)n++;return n}
const weekDayNo=n=>((dayDate(n).getUTCDay()+6)%7)+1;
// states saved before Saturday counted: every stored day number is moved to the same date under the Monday-to-Saturday count
function migrateDays(x){if(!x||x.nv===2||!x.d0){if(x)x.nv=2;return}const c=n=>typeof n==="number"?nOfDate(x.d0,oldDateOf(x.d0,n)):n;
 if(x.day){x.day.n=c(x.day.n);(x.day.newT||[]).forEach(t=>{t.dayN=c(t.dayN)})}(x.log||[]).forEach(l=>{l.n=c(l.n)});(x.history||[]).forEach(h=>{h.n=c(h.n)});
 (x.sched||[]).forEach(t=>{t.dayN=c(t.dayN)});if(x.lastPost)x.lastPost.n=c(x.lastPost.n);x.nv=2}
function dayDate(n){return dayDateOf(S.exec.d0||firstWorkday(),n)}
function firstWorkday(){let d=utcOf(todayIso());while(d.getUTCDay()===0)d=new Date(d.getTime()+864e5);return d.toISOString().slice(0,10)}
function todayN(){const t=utcOf(firstWorkday());let n=1;while(dayDate(n)<t&&n<5000)n++;return n}
const dayLbl=(n,short)=>dayDate(n).toLocaleDateString("en-GB",short?{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}:{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"});
const isoWk=n=>isoWeekUTC(dayDate(n));
const hm=m=>`${Math.floor(m/60)}:${String(Math.round(m%60)).padStart(2,"0")}`;
const hrs=h=>{const v=Math.round((+h||0)*4)/4;return (Number.isInteger(v)?String(v):v.toFixed(2).replace(/0+$/,"").replace(/\.$/,""))+" h"};
function newDay(n,who,carried,objs){const own=(objs||[]).map(o=>({t:o.t,carried:true}));return {n,who,phase:"setup",start:"09:00",hours:9,focus:null,gen:null,genBy:"",sel:own.map(o=>o.t).slice(0,3),own,objs:[],plan:null,excl:[],extra:[],reqs:{},frozen:false,note:"",st:{},act:{},blk:{},cur:null,startAt:null,carried:carried||[],tomorrow:[],help:"none",msgs:[],rp:{},why:[],keepObj:{}}}
function D(){const x=S.exec,tn=todayN();if(!x.day||x.day.who!==x.who||!("gen" in x.day))x.day=newDay(tn,x.who);
 if(x.day.phase==="setup"&&x.day.n<tn)Object.assign(x.day,{n:tn,focus:null,gen:null,plan:null,frozen:false}); // a day set up and never run moves to today
 return x.day}
// the Execute state of a person: one "days" document per day, "<member>:<YYYY-MM-DD>", the reference day object plus the log
// PRE: the Execute state was made before the shared "days" were read (web edition, first seconds after loading). It is never saved,
// and it is replaced by the stored state as soon as the days arrive (Romain 2026-11-02: a fresh day saved over the real one).
let PRE=false;
function setWho(who,auto){PRE=!!(SK.isLoaded&&!SK.isLoaded("days"));const st=stateOf(who);EXECDOC=st?JSON.stringify(st.state):"";S.exec=Object.assign({who,mine:!auto,d0:"",blocked:[],log:[],doneIds:[],dropped:[],pool:[],history:[],sched:[],answered:{},day:null},JSON.parse(EXECDOC||"{}"),{who,mine:!auto});if(!S.exec.d0)S.exec.d0=firstWorkday();migrateDays(S.exec);LASTEXEC=JSON.stringify(S.exec)}
let LASTEXEC="",EXECDOC="";
function saveExec(){const x=S.exec;if(!x||!x.day||!x.who||PRE||(SK.isLoaded&&!SK.isLoaded("days")))return;const st=JSON.stringify(x);if(st===LASTEXEC)return;LASTEXEC=st;
 const date=dayDate(x.day.n).toISOString().slice(0,10),body=JSON.parse(st);delete body.mine;EXECDOC=JSON.stringify(body);SK.save("days",{id:x.who+":"+date,who:x.who,date,state:body})}
function answerReq(id,act,msg){const r=SK.get("requests",id);if(!r)return;SK.save("requests",Object.assign({},r,{answer:act,message:msg,answeredAt:new Date().toISOString(),by:S.exec.who}))}
const hasPlan=id=>!!(S.plans[id]&&S.plans[id].ms.length);
const krShort=k=>"KR "+k.t.split(" · ")[0];
function myKRs(){const who=S.exec.who;return KRS.filter(k=>hasPlan(k.id)&&(k.o===who||planOf(k.id).ms.some(m=>m.o===who||m.tasks.some(t=>t.o===who))))}
// Milestones to look at this week: due this week or next, or past and still open
function weekMs(k,day){const P=planOf(k.id),F=forecast(P),wk=isoWk(day.n);return P.ms.filter(m=>m.w>=wk-1&&m.w<=wk+1).map(m=>({k,P,m,i:P.ms.indexOf(m),f:F.ms[m.id]||{},thisWeek:m.w<=wk}))}
function pool(){const who=S.exec.who,day=D(),wk=isoWk(day.n),done=new Set(S.exec.doneIds.concat(SK.list("tasks").filter(t=>t.status==="done").map(t=>t.id))),drop=new Set(S.exec.dropped||[]),planned=[],waiting=[],focus=new Set(day.focus||[]);
 myKRs().forEach(k=>{const P=planOf(k.id),F=forecast(P);(F.order||[]).forEach(t=>{if(ownerOf(P,t)!==who||!(+t.e>0)||done.has(t.id)||drop.has(t.id))return;const m=findM(P,t._m);
  const it={id:t.id,t:t.t,dw:t.dw,tag:`${krShort(k)} · M${P.ms.indexOf(m)+1} · W${m.w}`,ms:`${krShort(k)} · M${P.ms.indexOf(m)+1}`,e:+t.e,p:cal(P,t),src:"plan",kr:k.id,mid:m.id,mw:m.w,late:false};
  const w=(t.deps||[]).map(d=>findT(P,d)).find(x=>x&&!done.has(x.id)&&ownerOf(P,x)!==who);
  if(w)waiting.push(Object.assign(it,{why:`Waits on ${TEAM[ownerOf(P,w)]?TEAM[ownerOf(P,w)].n:"someone"}: “${w.t}”`,wo:ownerOf(P,w)}));
  else if(t.nb&&t.nb>wk)waiting.push(Object.assign(it,{why:`Cannot start before W${t.nb}`}));else planned.push(it)})});
 planned.sort((a,b)=>(focus.has(b.mid)-focus.has(a.mid))||(a.mw-b.mw)||(b.late-a.late));
 const carried=[...day.carried.map(c=>Object.assign({},c,{carried:true})),...(S.exec.sched||[]).filter(x=>x.who===who&&x.dayN===day.n&&!done.has(x.id)).map(x=>({id:x.id,t:x.t,dw:x.dw,tag:x.lk||"Planned yesterday",ms:x.ms,mid:x.mid,kr:x.kr,e:x.e,p:x.e*coef(who),src:"extra",sched:true}))];
 const reqs=(REQS[who]||[]).filter(r=>!(S.exec.answered||{})[r.id]&&day.reqs[r.id]!=="decline"&&day.reqs[r.id]!=="tomorrow").map(r=>({id:r.id,t:r.t,dw:r.dw,tag:"Request · "+nm(r.from),e:r.e,p:r.e,src:"request",req:r}));
 const objs=day.own.map((o,k)=>o.task?null:({id:"ob"+k,t:o.t,dw:"Objective reached",tag:"Objective",e:o.h||1,p:o.h||1,src:"objective"})).filter(Boolean);
 const other=[...(OTHER[who]||[]).filter(o=>!done.has(o.id)&&!drop.has(o.id)).map(o=>({id:o.id,t:o.t,dw:o.dw,tag:o.tag,e:o.e,p:o.e*coef(who),src:"other"})),
  ...(S.exec.pool||[]).filter(i=>i.who===who&&!done.has(i.id)),...day.extra];
 return {planned,waiting,carried,reqs,objs,other}}
const allPool=G=>[...G.carried,...G.planned,...G.reqs,...G.objs,...G.other];
function focusMs(day){const out=[];myKRs().forEach(k=>weekMs(k,day).forEach(x=>{if((day.focus||[]).includes(x.m.id))out.push(x)}));return out}
function defaultFocus(day){const {planned}=pool(),wk=isoWk(day.n);return [...new Set(planned.filter(i=>i.mw<=wk).map(i=>i.mid))]}
const lc=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
function objGen(day){const G=pool(),out=[],seen=new Set(day.own.map(o=>o.t)),add=(t,src,ids)=>{if(!t||seen.has(t)||out.length>=6)return;seen.add(t);out.push({t,src,ids})};const F=focusMs(day);
 F.forEach(({k,P,m,i})=>G.planned.filter(x=>x.mid===m.id).forEach(x=>add(x.dw,`${krShort(k)} · M${i+1}`,[x.id])));
 G.carried.forEach(x=>add(x.dw,"Yesterday",[x.id]));
 G.reqs.filter(r=>!day.reqs[r.id]).forEach(r=>add(`${nm(r.req.from)} unblocked: ${lc(r.dw)}`,"Request",[r.id]));
 F.forEach(({k,P,m,i})=>{const ids=G.planned.filter(x=>x.mid===m.id).map(x=>x.id);if(ids.length)m.proof.filter(x=>x.trim()).forEach(pr=>add(pr,`${krShort(k)} · M${i+1} proof`,ids))});
 G.planned.filter(x=>!(day.focus||[]).includes(x.mid)).forEach(x=>add(x.dw,x.tag.split(" · W")[0],[x.id]));
 add("Real time recorded for every task","Discipline",[]);add("Nothing carried over tonight","Discipline",[]);return out}
// An objective can be one of the person's tasks (Romain 2026-11-02): a task that must be finished today. It goes into the day's plan,
// the day cannot be validated without it, and finishing the task reaches the objective.
function allObjs(day){return [...(day.gen||[]),...day.own.map((o,k)=>({t:o.t,src:o.task?"Task to finish":o.carried?"Yesterday":"Yours",ids:o.task?[o.task]:["ob"+k],task:o.task||null}))]}
const selObjs=day=>day.sel.map(t=>allObjs(day).find(o=>o.t===t)).filter(Boolean);
// The proposal: carried first, then the focus milestones, the chosen objectives, a short request, then the rest of the week. 10 % kept free.
// Help = work for a colleague: their requests, help accepted during the day, unplanned work a teammate asked for. It comes on top of the 9 h.
const isHelp=i=>i&&(i.src==="help"||i.src==="request"||(i.src==="unpl"&&!!i.help));
const ownH=day=>day.plan.filter(i=>!isHelp(i)).reduce((a,i)=>a+i.p,0),helpH=day=>day.plan.filter(isHelp).reduce((a,i)=>a+i.p,0);
function helpStats(who,w){const L=(S.exec.log||[]).filter(l=>l.who===who&&(w==null||l.w===w)),hl=L.filter(l=>l.help),tot=L.reduce((a,l)=>a+l.act,0),h=hl.reduce((a,l)=>a+l.act,0);return {n:hl.length,h,tot,pct:tot?h/tot*100:0,from:[...new Set(hl.map(l=>l.from).filter(Boolean))]}}
function propose(day){const G=pool(),P=allPool(G),lim=day.hours,excl=new Set(day.excl);
 const out=day.plan?day.plan.filter(i=>i.manual):[];let h=out.filter(i=>!isHelp(i)).reduce((a,i)=>a+i.p,0);const has=id=>out.some(i=>i.id===id);
 const put=(i,why)=>{if(!i||has(i.id)||excl.has(i.id))return;const hp=isHelp(i);if(!hp&&h+i.p>lim+.01)return;out.push(Object.assign({},i,{why,manual:false}));if(!hp)h+=i.p};
 const sel=selObjs(day),focus=day.focus||[];
 G.carried.forEach(i=>put(i,i.sched?"Planned for today at yesterday's end of day":"Carried from yesterday: first, so it does not slip twice"));
 G.planned.filter(i=>focus.includes(i.mid)).forEach(i=>put(i,`Focus ${i.ms}: due W${i.mw}`));
 sel.forEach((o,n)=>(o.ids||[]).forEach(id=>put(P.find(x=>x.id===id),`Delivers objective ${n+1}`)));
 G.reqs.filter(r=>r.p<=1).forEach(r=>put(r,`Unblocks ${nm(r.req.from)} (${r.req.serves}); on top of your ${day.hours} h`));
 G.planned.forEach(i=>put(i,`Next on ${i.tag.split(" · W")[0]}`));
 G.other.forEach(i=>put(i,i.src==="other"?"Routine":"Added"));
 return out}
function repropose(day){if(day.frozen)return;day.plan=propose(day);day.note=""}
function slots(day){const[a,b]=day.start.split(":").map(Number);let t=a*60+b,lunch=false;return day.plan.map(i=>{let l=false;if(!lunch&&t>=12*60+30){t+=60;lunch=true;l=true}const s=t,d=Math.max(15,Math.round(i.p*4)*15);t+=d;return {s,e:t,l}})}
const curItem=day=>day.plan.find(i=>!day.st[i.id]);
function renderExec(){const day=D();if(day.phase==="setup"&&(S.weeks||{})[weekKey(S.exec.who,isoWk(day.n))]){if(!day.focus)day.focus=defaultFocus(day);if(!day.gen)day.gen=objGen(day);if(!day.plan)day.plan=propose(day)}
 const el=$id("v-exec"),y=window.scrollY,locked=day.phase==="setup"&&!(S.weeks||{})[weekKey(S.exec.who,isoWk(day.n))];el.innerHTML=`<div class="xwrap ${day.phase==="setup"&&!locked?"wide":""}">${locked?weekGateHTML(day):day.phase==="setup"?setupHTML(day):day.phase==="run"?runHTML(day):replanHTML(day)}</div>`;tick();save()}
function personSel(){return `<label class="krsel" for="who">Person ${ownerSel(S.exec.who,'id="who" data-who="1"').replace('<option value="">No owner</option>',"")}</label>`}
const SRC={plan:"Planned",objective:"Objective",request:"Request",other:"Routine",extra:"Added",help:"Help"};
function poolCard(i,day){const req=i.src==="request";return `<div class="pc ${i.src} ${i.carried?"carried":""}" draggable="true" data-pid="${esc(i.id)}"><span class="grip" aria-hidden="true">⋮⋮</span><div class="pcb"><b>${esc(i.t)}</b><span class="pm"><span class="tag">${esc(i.tag)}</span>${i.late?`<span class="chk x">late</span>`:""}${(day.focus||[]).includes(i.mid)?`<span class="chk">focus</span>`:""}${req?`<span class="note">from ${nm(i.req.from)}, ${esc(i.req.at)}${day.reqs[i.id]?" · "+HACT[day.reqs[i.id]].toLowerCase():""}</span>`:""}</span></div><span class="mono ph">${hrs(i.p)}</span>${req&&!day.reqs[i.id]?`<button class="btn sm" data-xans="${esc(i.id)}">Answer</button>`:""}<button class="add" data-xpadd="${esc(i.id)}" aria-label="Add to today">+</button></div>`}
function setupHTML(day){const G=pool(),inPlan=new Set(day.plan.map(i=>i.id)),T=slots(day),wk=isoWk(day.n),K=myKRs(),sel=selObjs(day),objs=allObjs(day);
 const tot=ownH(day),hh=helpH(day),F=focusMs(day),pend=G.reqs.filter(r=>!day.reqs[r.id]);
 const end=T.length?T[T.length-1].e:0;
 // decision checks
 // a day may serve one key result only (Romain 2026-11-02): a focus milestone with no task today is not a fault, only covered ones are listed
 const chk=[];F.forEach(x=>{if(day.plan.some(i=>i.mid===x.m.id))chk.push({ok:1,t:`Focus ${krShort(x.k)} · M${x.i+1} covered`})});
 sel.forEach((o,n)=>{if(!(o.ids||[]).length)return;chk.push(o.ids.some(id=>inPlan.has(id))?{ok:1,t:`Objective ${n+1} covered`}:{ok:0,t:`Objective ${n+1} has no task`})});
 chk.push(tot>day.hours+.01?{ok:0,t:`${hrs(tot-day.hours)} over your ${day.hours} h`}:{ok:1,t:tot<day.hours-.01?`${hrs(day.hours-tot)} of your ${day.hours} h still free`:`${day.hours} h of your own work`});if(hh)chk.push({ok:1,t:`+ ${hrs(hh)} helping, on top`});
 if(pend.some(r=>inPlan.has(r.id)))chk.push({ok:-1,t:`${nm(pend[0].req.from)} waits for your answer`});
 const missT=sel.filter(o=>o.task&&!inPlan.has(o.task)),ok=sel.length===3&&day.plan.length&&tot<=day.hours+.01&&!missT.length;
 const grp=(title,hint,list,cls)=>{const L=list.filter(i=>!inPlan.has(i.id));return L.length?`<div class="pg ${cls||""}"><div class="pgh"><b>${title}</b><span class="cnt">${L.length}</span></div>${L.map(i=>poolCard(i,day)).join("")}</div>`:""};
 const wkMs=K.map(k=>({k,list:weekMs(k,day)}));
 return `<div class="card xwin"><div class="xhead"><div><span class="pk">Day ${weekDayNo(day.n)} · set up the day · W${wk}</span><h2>${dayLbl(day.n)}</h2></div><div class="xctl">${personSel()}<label class="krsel">Start <select data-xstart="1">${["07:00","07:30","08:00","08:30","09:00","09:30","10:00"].map(v=>`<option ${v===day.start?"selected":""}>${v}</option>`).join("")}</select></label><label class="krsel">Hours for your milestones <select data-xhours="1">${[4,5,6,7,8,9,10,11,12].map(v=>`<option value="${v}" ${v===day.hours?"selected":""}>${v} h</option>`).join("")}</select></label></div></div>
 ${S.exec.lastPost&&S.exec.lastPost.n===day.n-1?`<div class="rule"><span class="ic">✓</span><span>Yesterday's EOD was posted to Slack (${esc(S.exec.lastPost.dest)})${S.exec.lastPost.url?` · <a href="${esc(S.exec.lastPost.url)}" target="_blank" rel="noopener">Open in Slack</a>`:""}.</span></div>`:""}${repliesHTML()}
 <section class="xsec"><div class="xsh"><span class="sn">1</span><h3>Milestones this week</h3></div>
  <div class="krrow">${wkMs.map(({k,list})=>`<div class="krcard"><div class="krt"><span class="pk">${krShort(k)}</span><b>${esc(k.t.split(" · ").slice(1).join(" · "))}</b><span class="note mono">${esc(k.now)} → ${esc(k.tg)}</span></div>
   ${list.length?list.map(x=>{const on=(day.focus||[]).includes(x.m.id),mine=G.planned.filter(i=>i.mid===x.m.id).length,wait=G.waiting.filter(i=>i.mid===x.m.id).length,late=x.f.p85>x.m.w;
    return `<button class="msel ${on?"on":""}" data-xfm="${x.m.id}" aria-pressed="${on}"><span class="mbox">${on?"✓":""}</span><span class="mb"><span class="mt"><b>M${x.i+1} · W${x.m.w}</b> ${esc(x.m.t)}</span><span class="mm">${av(x.m.o)}<span>${x.thisWeek?(x.m.w<wk?"overdue":"this week"):"next week"}</span><span>${mine?mine+" task"+(mine>1?"s":"")+" for you":wait?wait+" waiting":"no task for you"}</span></span></span></button>`}).join(""):`<p class="note">No milestone this week or next.</p>`}</div>`).join("")||`<p class="note">No key result with a plan for ${nm(S.exec.who)}. Build one first.</p>`}</div></section>
 <section class="xsec"><div class="xsh"><span class="sn">2</span><h3>Today's 3 objectives</h3><span class="chk ${sel.length===3?"":"w"}">${sel.length} of 3 chosen</span><span class="sp"></span>${SAMPLE?`<button class="btn sm" data-xcl="1">${day.genBy==="claude"?"Ask Claude again":"Ask Claude for 6 objectives"}</button>`:``}</div>
  <div class="og">${(day.gen||[]).map(o=>{const k=day.sel.indexOf(o.t);return `<button class="ocard" data-xobj="${esc(o.t)}" aria-pressed="${k>=0}"><span class="ob">${k>=0?k+1:""}</span><span class="ot">${esc(o.t)}</span><span class="src">${esc(o.src)}</span></button>`}).join("")}</div>
  <div class="og3">${day.own.map(o=>{const k=day.sel.indexOf(o.t);return `<button class="ocard own" data-xobj="${esc(o.t)}" aria-pressed="${k>=0}"><span class="ob">${k>=0?k+1:""}</span><span class="ot">${esc(o.t)}</span><span class="src">${o.task?"Task to finish":o.carried?"Yesterday":"Yours"}</span></button>`}).join("")}
   ${(()=>{const L=[...G.carried,...G.planned,...G.other].filter(i=>i.src!=="objective"&&!day.own.some(o=>o.task===i.id));return L.length?`<label class="oadd"><select data-xobjtask="1" aria-label="Choose a task as an objective" style="flex:1;min-height:42px;border:1px solid var(--line,#E3DFD5);border-radius:10px;padding:0 12px;font:inherit;background:#fff;color:inherit"><option value="">Or choose one of your tasks: it must be finished today</option>${L.map(i=>`<option value="${esc(i.id)}">${esc(i.t)} · ${esc(String(i.tag||"").split(" · W")[0])}</option>`).join("")}</select></label>`:""})()}
   <form class="oadd" data-xaddf="1"><input id="xnew" placeholder="Write your own objective: a result visible tonight" aria-label="Your own objective" autocomplete="off"><button class="btn" type="submit">Add</button></form></div></section>
 <section class="xsec"><div class="xsh"><span class="sn">3</span><h3>Build the day</h3></div>
  <div class="bld"><div class="poolc" data-drop="pool" aria-label="Possible tasks">
   ${grp("Carried and planned for today","from yesterday's end of day",G.carried,"c")}
   ${grp("Planned this week","from Build, in priority order",G.planned,"p")}
   ${grp("Requests from colleagues","answer before it goes in",G.reqs,"r")}
   ${grp("For your own objectives","1 h each, change it in Today",G.objs,"o")}
   ${grp("Routines and other","",G.other,"x")}
   <form class="oadd qadd" data-xqf="1"><input id="xqt" placeholder="+ Another task" aria-label="New task" autocomplete="off"><select id="xqh" aria-label="Hours">${[.25,.5,1,1.5,2,3,4].map(v=>`<option value="${v}" ${v===1?"selected":""}>${hrs(v)}</option>`).join("")}</select><button class="btn" type="submit">Add</button></form>
   ${G.waiting.length?`<details class="pg w"><summary><b>Cannot start today</b> <span class="cnt">${G.waiting.length}</span></summary>${G.waiting.map(i=>`<div class="pc off"><div class="pcb"><b>${esc(i.t)}</b><span class="pm"><span class="tag">${esc(i.tag)}</span><span class="note">${esc(i.why)}</span></span></div></div>`).join("")}</details>`:""}
  </div>
  <div class="todayc"><div class="tdh"><div><b>Today</b> <span class="note">${day.start} → ${end?hm(end):"—"}${T.some(x=>x.l)?" · lunch 1 h":""}</span></div><span class="sp"></span>${SAMPLE?`<button class="btn sm" data-xcd="1">${day.note?"Ask Claude again":"Ask Claude for the ideal day"}</button>`:""}${day.frozen?`<button class="btn sm ghost" data-xre="1">Propose again</button>`:""}</div>
   <div class="capbar" aria-label="${hrs(tot)} of your own work planned for ${day.hours} h">${day.plan.filter(i=>!isHelp(i)).map(i=>`<i class="${i.src}" style="width:${Math.min(100,i.p/Math.max(day.hours,tot)*100)}%" title="${esc(i.t)}"></i>`).join("")}</div>${hh?`<div class="capbar hl" aria-label="${hrs(hh)} helping on top">${day.plan.filter(isHelp).map(i=>`<i class="help" style="width:${Math.min(100,i.p/day.hours*100)}%" title="${esc(i.t)}"></i>`).join("")}</div>`:""}
   
   <div class="checks">${chk.map(c=>`<span class="chk ${c.ok===1?"":c.ok===0?"x":"w"}">${c.ok===1?"✓":c.ok===0?"✕":"!"} ${esc(c.t)}</span>`).join("")}</div>
   ${day.note?`<div class="cnote"><span class="mk">C</span><span>${esc(day.note)}</span></div>`:""}
   <ol class="tl" data-drop="today" id="tl">${day.plan.length?day.plan.map((i,k)=>`${T[k].l?`<li class="lunch">Lunch · ${hm(T[k].s-60)}–${hm(T[k].s)}</li>`:""}<li class="tcard ${i.src}" draggable="true" data-tid="${k}"><span class="tt mono">${hm(T[k].s)}<small>${hm(T[k].e)}</small></span><div class="tb"><b>${esc(i.t)}</b><span class="pm"><span class="tag">${esc(i.tag)}</span>${i.src==="request"&&!day.reqs[i.id]?`<span class="chk w">answer ${nm(i.req.from)}</span>`:""}</span>${i.why&&!i.manual&&(/^Claude:/.test(i.why)||i.carried)?`<span class="why">${esc(i.why)}</span>`:""}</div>
    <span class="th">${["objective","extra"].includes(i.src)?`<button class="x" data-xh="${k}:-" aria-label="Less time">−</button>`:""}<span class="mono">${hrs(i.p)}</span>${["objective","extra"].includes(i.src)?`<button class="x" data-xh="${k}:+" aria-label="More time">+</button>`:""}</span>
    <span class="racts"><button class="x" data-xup="${k}" aria-label="Move up" ${k?"":"disabled"}>↑</button><button class="x" data-xdn="${k}" aria-label="Move down" ${k<day.plan.length-1?"":"disabled"}>↓</button><button class="x" data-xrm="${k}" aria-label="Remove from today">×</button></span></li>`).join(""):`<li class="tempty">Drag tasks here</li>`}</ol>
  </div></div></section>
 <div class="xfoot"><span class="note">${ok?"":sel.length!==3?`${sel.length} of 3 objectives`:!day.plan.length?"No task in Today":missT.length?`Put the task "${esc(missT[0].t)}" in Today: it is an objective`:"Over "+day.hours+" h"}</span><button class="btn p" data-xgo="1" ${ok?"":"disabled"}>Validate my day →</button></div></div>`}
function objBar(day){return `<div class="obar" aria-label="Today's objectives">${day.objs.filter(o=>o.on).map((o,k)=>`<button class="obj ${o.done?"done":""}" data-xod="${day.objs.indexOf(o)}" aria-pressed="${o.done}" title="Mark as reached"><span class="ok">${o.done?"✓":k+1}</span><span>${esc(o.t)}</span></button>`).join("")}</div>`}
function helpStrip(day){const w=isoWk(day.n),H=helpStats(S.exec.who,w);if(!H.n)return "";return `<div class="hstrip"><span class="pk" style="color:var(--info)">Help · W${w}</span><span><b class="mono">${H.n}</b> task${H.n!==1?"s":""}</span><span><b class="mono">${hrs(H.h)}</b></span><span><b class="mono">${Math.round(H.pct)} %</b> of time worked</span>${H.from.length?`<span class="note">for ${esc(H.from.join(", "))}</span>`:""}</div>`}
function friseHTML(day){const T=slots(day),cur=curItem(day);
 return `<div class="tw"><div class="frise" role="list" aria-label="Roadmap of the day">${day.plan.map((i,k)=>{const st=day.st[i.id],cls=st==="done"?"done":st==="blocked"?"blocked":i===cur?"cur":"";
  return `<div class="fb ${cls} ${i.src==="help"?"fhelp":i.src==="unpl"?"funpl":""}" role="listitem" style="flex-grow:${T[k].e-T[k].s}"><span class="fl" title="${esc(i.t)}">${st==="done"?"✓ ":st==="blocked"?"⏸ ":""}${esc(i.t)}</span><span class="fbar"></span><span class="ft">${hm(T[k].s)}–${hm(T[k].e)}${i===cur?" · now":""}</span></div>`}).join("")}</div></div>`}
function runHTML(day){const cur=curItem(day),n=day.plan.length,dn=day.plan.filter(i=>day.st[i.id]==="done").length,who=S.exec.who;let card="";
 // a request from a colleague waits until the current card is done
 const req=(REQS[who]||[]).find(r=>!(S.exec.answered||{})[r.id]);if(req&&!day.cur){HELP=req;day.help="show"}else if(day.help==="show"&&!req)day.help="none";
 if(day.help==="show"){card=`<div class="help"><span class="pk" style="color:var(--info)">Help request · ${nm(HELP.from)}</span><h3>${esc(HELP.t)}</h3><div class="dw"><b>Done when</b>${esc(HELP.dw)}</div>
   <div class="est"><div><b>${hrs(HELP.e)}</b><span>asked</span></div><div><b>${esc(HELP.at||"Today")}</b><span>sent</span></div><div><b>${esc(HELP.serves||"—")}</b><span>for ${nm(HELP.from)}</span></div></div>
   
   <div class="cacts"><button class="btn p" data-xhelp="accept">Accept</button><button class="btn" data-xhelp="later">Later today</button><button class="btn" data-xhelp="tomorrow">Tomorrow</button><button class="btn" data-xhelp="decline">Decline</button></div></div>`}
 else if(!cur){card=`<div class="tc" style="text-align:center;align-items:center"><span class="pk">Roadmap done</span><h2>Everything planned for today is finished</h2><p class="why">Tick the objectives you reached above, then end the day.</p></div>`}
 else{const running=day.cur===cur.id,p=cur.p;
  card=`<div class="deck"><article class="tc" id="tc"><div class="ctx"><span class="tag">${esc(cur.tag)}</span><span>Task ${day.plan.indexOf(cur)+1} of ${n}</span></div><h2>${esc(cur.t)}</h2>
   <div class="dw"><b>Done when</b>${esc(cur.dw||"—")}</div>
   <div class="est"><div><b>${hrs(cur.e)}</b><span>estimated</span></div><div><b>× ${coef(who).toFixed(1)}</b><span>your record</span></div><div><b>${hrs(p)}</b><span>planned</span></div></div>
   ${running?`<div class="timer mono" id="timer">0:00:00</div><div class="cacts"><button class="btn p" data-xs="done">Done</button><button class="btn" data-xs="blocked">Blocked</button><button class="btn" data-xs="split">Too big</button></div>`:`<div class="cacts"><button class="btn p" data-xs="start">Start</button></div>`}
   <div id="exsub" class="xsubf"></div></article></div>`}
 return objBar(day)+helpStrip(day)+`<div class="card xwin"><div class="xhead"><div><span class="pk">Day ${weekDayNo(day.n)} · ${dn} of ${n} done</span><h2>${dayLbl(day.n)}</h2></div>${personSel()}</div>
  ${repliesHTML()}<div class="xsh"><span class="sp"></span><button class="btn sm" data-xask="1">Ask a colleague</button><button class="btn sm" data-xun="1">+ Unplanned task</button></div>${friseHTML(day)}<div class="stage">${card}</div>
  <div class="xfoot"><button class="btn" data-xeod="1">End of day</button></div></div>`}
function replanHTML(day){const left=day.plan.filter(i=>day.st[i.id]!=="done"),done=day.plan.filter(i=>day.st[i.id]==="done"),act=done.reduce((a,i)=>a+(day.act[i.id]||0),0),pl=done.reduce((a,i)=>a+i.p,0),objs=day.objs.filter(o=>o.on),reached=objs.filter(o=>o.done).length;
 const C=[["tomorrow","Tomorrow, first"],["queue","Back to the queue"],["drop","Drop it"]];
 return `<div class="card xwin"><div class="xhead"><div><span class="pk">Day ${weekDayNo(day.n)} · end of day · replan</span><h2>${dayLbl(day.n)}</h2></div></div>
 <div class="krc" style="padding:0"><div class="fld">Tasks done<span class="v">${done.length} of ${day.plan.length}</span></div><div class="fld">Real time / planned<span class="v">${hrs(act)} / ${hrs(pl)}</span></div>${pl?`<div class="fld">Measured today<span class="v">× ${(act/pl*coef(S.exec.who)).toFixed(2)}</span></div>`:""}<div class="fld">Objectives reached<span class="v">${reached} of ${objs.length}</span></div>${(S.exec.log||[]).some(l=>l.who===S.exec.who&&l.n===day.n&&l.help)?`<div class="fld">Help given today<span class="v" style="color:var(--info)">${(()=>{const L=(S.exec.log||[]).filter(l=>l.who===S.exec.who&&l.n===day.n),h=L.filter(l=>l.help).reduce((a,l)=>a+l.act,0),t=L.reduce((a,l)=>a+l.act,0);return `${L.filter(l=>l.help).length} · ${hrs(h)} · ${t?Math.round(h/t*100):0} %`})()}</span></div>`:""}</div>
 ${left.length?`<section class="xsec"><div class="xsh"><h3>Not finished · ${left.length}</h3></div><ul class="mini">${left.map(i=>{const c=day.rp[i.id]||"tomorrow",b=day.blk[i.id];return `<li class="rp"><span><b>${esc(i.t)}</b> <span class="note">${esc(i.tag)} · ${hrs(i.p)}${b?` · blocked: ${esc(b.why)}${b.by?" ("+esc(nm(b.by))+")":""}`:""}</span></span><span class="seg sm">${C.map(([k,l])=>`<button data-xrp="${i.id}:${k}" aria-pressed="${c===k}">${l}</button>`).join("")}</span></li>`}).join("")}</ul></section>`
 :`<div class="rule"><span class="ic">✓</span><span>Every task of today's roadmap is done.</span></div>`}
 <section class="xsec"><div class="xsh"><h3>What got in the way?</h3></div><div class="reasons">${["Underestimated","Interruptions","Unplanned work","Help given","Blocked","Started late","Too many meetings"].map(r=>`<button class="chip" data-xwy="${r}" aria-pressed="${day.why.includes(r)}">${r}</button>`).join("")}</div>
  <textarea id="xcmt" class="inp ta" rows="2" placeholder="Comment for the EOD" aria-label="Comment for the EOD">${esc(day.comment||"")}</textarea></section>
 <section class="xsec"><div class="xsh"><h3>New tasks from today</h3></div>
  ${(day.newT||[]).length?`<ul class="mini">${day.newT.map((n,k)=>`<li class="rp"><span><b>${esc(n.t)}</b> <span class="note">${hrs(n.e)} · ${dayLbl(n.dayN,1)} (W${isoWk(n.dayN)})${n.lk?" · "+esc(n.lk):""}${n.dw?" · done when "+esc(n.dw):""}</span></span><button class="x" data-xntrm="${k}" aria-label="Remove">×</button></li>`).join("")}</ul>`:""}
  <form class="ntask" data-xntf="1"><input id="xnt" class="inp" placeholder="Verb + object" aria-label="New task" autocomplete="off"><input id="xnd" class="inp" placeholder="Done when (optional)" aria-label="Done when" autocomplete="off"><select id="xnh" aria-label="Hours">${[.25,.5,1,1.5,2,3,4].map(v=>`<option value="${v}" ${v===1?"selected":""}>${hrs(v)}</option>`).join("")}</select><select id="xndate" aria-label="Planned for">${[1,2,3,4,5,6,7,8].map(k=>`<option value="${day.n+k}">${k===1?"Tomorrow, ":""}${dayLbl(day.n+k,1)}</option>`).join("")}</select><select id="xnl" aria-label="Linked to">${msOptions()}</select><button class="btn" type="submit">Add</button></form></section>
 ${objs.some(o=>!o.done)?`<section class="xsec"><div class="xsh"><h3>Objectives not reached</h3></div><ul class="mini">${objs.filter(o=>!o.done).map(o=>{const k=day.objs.indexOf(o),keep=day.keepObj[k]!==false;return `<li><span>${esc(o.t)}</span><button class="chip" data-xko="${k}" aria-pressed="${keep}">${keep?"✓ Carry to tomorrow":"Carry to tomorrow"}</button></li>`}).join("")}</ul></section>`:""}
 ${day.tomorrow.length?`<p class="note">Also first tomorrow: ${day.tomorrow.map(i=>esc(i.t)).join(", ")} (help accepted for tomorrow).</p>`:""}
 <div class="xfoot"><button class="btn" data-xback="1">← Back to today</button><button class="btn p" data-xrpok="1">Validate and write the EOD →</button></div></div>`}
let TICK=null;function tick(){clearInterval(TICK);const day=S.exec.day;if(!day||!day.cur)return;const f=()=>{const el=$id("timer");if(!el){clearInterval(TICK);return}const s=Math.floor((Date.now()-day.startAt)/1000);el.textContent=`${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`};f();TICK=setInterval(f,1000)}

/* help reply: predefined message per answer, or written by Claude from the main points */
const HACT={accept:"Accept",later:"Later today",tomorrow:"Tomorrow",decline:"Decline"};
let XBUSY=null;
function eodPopHTML(){const day=D(),left=day.plan.filter(i=>day.st[i.id]!=="done"),h=left.reduce((a,i)=>a+i.p,0),objs=day.objs.filter(o=>o.on&&!o.done);
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:500px" role="dialog" aria-modal="true" aria-labelledby="eh"><div class="dh"><h2 id="eh" style="font-size:22px">${left.length?"End the day with tasks left?":"End the day?"}</h2></div><div class="db">
 ${left.length?`<p>${left.length} task${left.length>1?"s":""} not finished (${hrs(h)} planned)${objs.length?` and ${objs.length} objective${objs.length>1?"s":""} not ticked`:""}. You will decide where each one goes: tomorrow, back to the queue, or dropped.</p><ul>${left.map(i=>`<li>${esc(i.t)}</li>`).join("")}</ul>`:`<p>Every task of today's roadmap is done${objs.length?`, but ${objs.length} objective${objs.length>1?"s are":" is"} not ticked`:""}.</p>`}
 <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn" data-close="1">Keep working</button><button class="btn p" data-xeodok="1">${left.length?"End the day and replan":"End the day"}</button></div></div></div></div>`}

function helpTpl(act,reason,req){req=req||HELP;const day=D(),n=nm(req.from),T=day.plan?slots(day):[],ci=day.plan?day.plan.findIndex(i=>!day.st[i.id]):-1,end=T.length?T[T.length-1].e:17*60,next=ci>=0&&T[ci]?T[ci].s:(T.length?T[0].s:9*60),what=`“${req.t}”`;
 if(act==="accept")return `Hi ${n}, I'm on it: ${what} is on my roadmap ${day.phase==="setup"?"today":"now"}, done by ${hm(next+Math.round(req.e*60)+(day.phase==="setup"?60:0))}.`;
 if(act==="later")return `Hi ${n}, I'm in the middle of my roadmap, but I'll do ${what} later today, by ${hm(end+60)}.`;
 if(act==="tomorrow")return `Hi ${n}, today is full on my side. I'll do ${what} first thing tomorrow (${dayLbl(day.n+1,1)}), by 11:00. Tell me if that is too late.`;
 return `Hi ${n}, I can't take ${what}${reason?": "+lc(reason):""}. Can you ask someone else, or tell me if it is blocking you?`}
async function claudeWrite(){const p=S.pop;if(!p||XBUSY)return;const req=p.req||HELP;
 if(!SAMPLE){p.text=helpTpl(p.act,p.reason,req)+(p.pts.trim()?"\n\n"+p.pts.trim():"");renderPop();toast("Built-in: points added to the message. Open the page in Claude to have Claude write it.");return}
 const ctl=new AbortController();XBUSY=ctl;p.busy=true;renderPop();
 const prompt=`Write a short Slack message from ${nm(S.exec.who)} to ${nm(req.from)}, a teammate at ALKIMIY.\n${nm(req.from)} asked for help: "${req.t}" (done when: ${req.dw}; about ${Math.round(req.e*60)} minutes).\n${nm(S.exec.who)}'s answer: ${HACT[p.act]}${p.reason?" (reason: "+p.reason+")":""}.\nMain points to include: ${p.pts||"none, keep it simple"}.\nSuggested starting point: ${helpTpl(p.act,p.reason,req)}\nFriendly, direct, 2 to 4 sentences, in English, start with "Hi ${nm(req.from)}," and no sign-off. Never write "closer"; say "sales". Return only the message.`;
 try{const r=await SAMPLE(prompt,{signal:ctl.signal,cache:false,onText:({text})=>{p.text=text;const b=$id("xmsg");if(b)b.value=text}});p.text=r.text}
 catch(e){if(e&&e.code==="not_granted"){SAMPLE=null;renderGuideMode()}if(!(e&&e.code==="cancelled"))toast("Claude did not answer this time"+(e&&e.code?" ("+e.code+")":"")+". The prepared message is kept.")}
 finally{XBUSY=null;p.busy=false;renderPop()}}
function msgPopHTML(p){const req=p.req||HELP,n=nm(req.from);
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:620px" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="dh"><div><div class="pk" style="color:var(--info)">Reply to ${n}</div><h2 id="mh" style="font-size:22px">${esc(req.t)}</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <div class="seg" role="group" aria-label="Your answer">${Object.entries(HACT).map(([k,l])=>`<button data-xact="${k}" aria-pressed="${p.act===k}">${l}</button>`).join("")}</div>
 ${p.act==="decline"?`<div class="reasons">${["My milestone is at risk","Someone else knows it better","Not clear enough yet","Today is full"].map(r=>`<button class="chip" data-xrs="${r}" aria-pressed="${p.reason===r}">${r}</button>`).join("")}</div>`:""}
 <label class="fld" for="xmsg"><span>Message to ${n} </span><textarea id="xmsg" rows="5">${esc(p.text)}</textarea></label>
 <div class="xclaude"><label class="fld" for="xpts">Or give Claude the main points<textarea id="xpts" rows="2" placeholder="Main points">${esc(p.pts)}</textarea></label>
 <div style="display:flex;gap:8px;align-items:center">${p.busy?`<span class="note dots">Claude is writing</span><button class="btn sm ghost" data-xstop="1">Stop</button>`:`<button class="btn sm" data-xwrite="1">${SAMPLE?"Write it with Claude":"Add the points to the message"}</button>`}</div></div>
 <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn" data-close="1">Cancel</button><button class="btn p" data-xsend="1" ${p.busy?"disabled":""}>Send to ${n} · ${HACT[p.act]}</button></div></div></div></div>`}
function msOptions(sel){const o=[`<option value="">No milestone</option>`];myKRs().forEach(k=>{const P=planOf(k.id);P.ms.forEach((m,i)=>o.push(`<option value="${k.id}:${m.id}" ${sel===k.id+":"+m.id?"selected":""}>${krShort(k)} · M${i+1} · W${m.w} · ${esc(m.t.length>48?m.t.slice(0,46)+"…":m.t)}</option>`))});return o.join("")}
function msLink(v){if(!v)return {};const[kid,mid]=v.split(":"),k=krOf(kid),P=planOf(kid),m=findM(P,mid);if(!k||!m)return {};return {kr:kid,mid,ms:"M"+(P.ms.indexOf(m)+1),lk:`${krShort(k)} · M${P.ms.indexOf(m)+1} · W${m.w}`}}
function unplPopHTML(p){const day=D(),T=slots(day),end=T.length?T[T.length-1].e:0;
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:600px" role="dialog" aria-modal="true" aria-labelledby="uh"><div class="dh"><div><div class="pk" style="color:var(--late)">Unplanned task</div><h2 id="uh" style="font-size:22px">Something came up</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <label class="fld" for="ut">What is it?<input id="ut" class="inp" placeholder="Verb + object" autocomplete="off" value="${esc(p.t||"")}"></label>
 <label class="fld" for="ud">Done when<input id="ud" class="inp" placeholder="What will be true when it is finished" autocomplete="off" value="${esc(p.dw||"")}"></label>
 <div class="ugrid"><label class="fld" for="uh2">Time<select id="uh2">${[.25,.5,.75,1,1.5,2,3].map(v=>`<option value="${v}" ${v===(p.h||.5)?"selected":""}>${hrs(v)}</option>`).join("")}</select></label>
 <label class="fld" for="uf">Who asked<select id="uf"><option value="">Nobody, I found it</option>${Object.entries(TEAM).filter(([k])=>k!==S.exec.who).map(([k,v])=>`<option value="${v.n}">${v.n}</option>`).join("")}<option value="A client or student">A client or student</option><option value="Someone outside">Someone outside</option></select></label>
 <label class="fld" for="ul">Linked to<select id="ul">${msOptions()}</select></label></div>
 <span class="pk">When</span><div class="seg" role="group" aria-label="When">${[["now","Now, pause my task"],["next","Next"],["later","Later today"],["tomorrow","Tomorrow"]].map(([k,l])=>`<button data-xuw="${k}" aria-pressed="${(p.when||"next")===k}">${l}</button>`).join("")}</div>
 
 <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close="1">Cancel</button><button class="btn p" data-xuok="1">Add to my roadmap</button></div></div></div></div>`}
function poolItem(id){return allPool(pool()).find(i=>i.id===id)}
function insertItem(day,it,idx){day.excl=day.excl.filter(x=>x!==it.id);if(day.plan.some(i=>i.id===it.id))return;const x=Object.assign({},it,{manual:true,why:""});day.plan.splice(idx==null?day.plan.length:Math.max(0,Math.min(idx,day.plan.length)),0,x)}
function addToToday(id,idx){const day=D(),it=poolItem(id);if(!it)return;
 if(it.src==="request"&&!day.reqs[it.id]){S.pop={x:"msg",req:it.req,act:"accept",reason:"",pts:"",text:helpTpl("accept","",it.req),ins:idx==null?-1:idx};renderPop();return}
 insertItem(day,it,idx);renderExec()}
function execClick(t,d){const day=D();
 // set-up
 if(d.xfm){const f=day.focus||[],i=f.indexOf(d.xfm);i<0?f.push(d.xfm):f.splice(i,1);day.focus=f;if(day.genBy!=="claude")day.gen=objGen(day);day.sel=day.sel.filter(s=>allObjs(day).some(o=>o.t===s));repropose(day);renderExec();return true}
 if(d.xobj!=null){const k=day.sel.indexOf(d.xobj);if(k>=0)day.sel.splice(k,1);else{if(day.sel.length>=3){toast("Three objectives already chosen. Untick one first.");return true}day.sel.push(d.xobj)}repropose(day);renderExec();return true}
 if(d.xpadd){addToToday(d.xpadd);return true}
 if(d.xans){const it=poolItem(d.xans);if(it){S.pop={x:"msg",req:it.req,act:"accept",reason:"",pts:"",text:helpTpl("accept","",it.req),ins:-1};renderPop()}return true}
 if(d.xup!=null||d.xdn!=null){const k=+(d.xup??d.xdn),j=d.xup!=null?k-1:k+1;[day.plan[k],day.plan[j]]=[day.plan[j],day.plan[k]];day.frozen=true;renderExec();return true}
 if(d.xrm!=null){const [it]=day.plan.splice(+d.xrm,1);if(it&&!it.manual)day.excl.push(it.id);renderExec();return true}
 if(d.xh){const[k,s]=d.xh.split(":"),it=day.plan[+k];it.p=it.e=Math.max(.25,Math.min(4,it.p+(s==="+"?.25:-.25)));if(it.src==="objective"){const o=day.own[+it.id.slice(2)];if(o)o.h=it.p}renderExec();return true}
 if(d.xre){day.frozen=false;day.plan=day.plan.filter(i=>i.manual&&i.src!=="plan");day.plan=propose(day);renderExec();toast("Proposal rebuilt from your focus, objectives and time.");return true}
 if(d.xcd){claudeDay();return true}
 if(d.xcl){suggestObjs();return true}
 if(d.xgo){const pend=day.plan.find(i=>i.src==="request"&&!day.reqs[i.id]);if(pend){S.pop={x:"msg",req:pend.req,act:"accept",reason:"",pts:"",text:helpTpl("accept","",pend.req),ins:-2};renderPop();toast(`Answer ${nm(pend.req.from)} first.`);return true}
  day.objs=selObjs(day).map(o=>({t:o.t,src:o.src,on:true,done:false,task:o.task||null}));day.phase="run";toast("Day validated. One task at a time.");renderExec();window.scrollTo({top:0,behavior:"smooth"});return true}
 // run
 if(d.xod!=null){const o=day.objs[+d.xod];o.done=!o.done;if(o.done)toast("Objective reached.");renderExec();return true}
 if(d.xs){const cur=curItem(day);if(!cur)return true;const sub=$id("exsub");
  if(d.xs==="start"){day.cur=cur.id;day.startAt=Date.now();renderExec();return true}
  if(d.xs==="done"){const el=Math.round((Date.now()-day.startAt)/36e5*4)/4;sub.innerHTML=`<label class="fld" for="act">How long did it really take? (hours)<input id="act" type="number" min="0.25" step="0.25" value="${el<.25?cur.p.toFixed(2):el}"></label><button class="btn p" data-xfin="1">Record and show the next task</button>`;$id("act").focus();return true}
  if(d.xs==="blocked"){sub.innerHTML=`<span class="pk">What blocks it?</span><div class="reasons">${["Waiting on someone","Missing information","Tool or access","Not clear enough"].map(r=>`<button class="chip" data-xwhyb="${r}" aria-pressed="false">${r}</button>`).join("")}</div><label class="fld" for="by">Waiting on${ownerSel("",'id="by"')}</label><button class="btn p" data-xblk="1">Set aside and show the next task</button>`;return true}
  if(d.xs==="split"){sub.innerHTML=`<span class="pk">Split it in two</span><input id="s1" class="inp" placeholder="First part (verb + object)" aria-label="First part"><input id="s2" class="inp" placeholder="Second part" aria-label="Second part"><button class="btn p" data-xspl="1">Split</button>`;return true}}
 if(d.xwhyb){$all("[data-xwhyb]").forEach(b=>b.setAttribute("aria-pressed",b===t));return true}
 if(d.xfin){const cur=curItem(day),v=Math.max(.25,+$id("act").value||.25);day.st[cur.id]="done";day.act[cur.id]=v;day.cur=null;(day.objs||[]).forEach(o=>{if(o.task&&o.task===cur.id)o.done=true});
  if(cur.src!=="help")S.exec.doneIds.push(cur.id);if((cur.src==="plan"||cur.src==="other")&&SK.get("tasks",cur.id))SK.taskUpdate(cur.id,{status:"done"});S.exec.log.push({who:S.exec.who,t:cur.t,est:cur.e,plan:cur.p,act:v,w:isoWk(day.n),n:day.n,help:isHelp(cur),from:cur.req?nm(cur.req.from):cur.src==="help"?(cur.tag.split("· ")[1]||""):cur.from||""});
  if(day.help==="pending")day.help="show";
  toast(v>cur.p+.1?`Recorded ${hrs(v)} for ${hrs(cur.p)} planned. Your coefficient learns from it.`:`Recorded ${hrs(v)}. On plan.`);
  const c=$id("tc");if(c){c.classList.add("out");setTimeout(()=>{FC.sig="";renderExec()},240)}else renderExec();return true}
 if(d.xblk){const cur=curItem(day),w=$one('[data-xwhyb][aria-pressed="true"]'),by=$id("by").value;day.st[cur.id]="blocked";day.blk[cur.id]={why:w?w.dataset.xwhyb:"Blocked",by};day.cur=null;
  if(cur.src==="plan"&&cur.kr){const P=planOf(cur.kr),tk=findT(P,cur.id),m=tk&&findM(P,tk._m);if(m){m.risks.push({t:`Blocked: ${cur.t}${by?" (waiting on "+nm(by)+")":""}`,mit:"",l:"high"});syncPlan(P)}if(SK.get("tasks",cur.id))SK.taskUpdate(cur.id,{status:"blocked"})}
  toast(`Set aside${cur.ms?". A risk is raised on "+cur.ms:""}${by?"; "+nm(by)+" is told":""}.`);FC.sig="";renderExec();return true}
 if(d.xspl){const cur=curItem(day),a=$id("s1").value.trim(),b=$id("s2").value.trim();if(!a||!b){toast("Write both parts.");return true}
  const k=day.plan.indexOf(cur),h=+(cur.e/2).toFixed(2);let parts=[Object.assign({},cur,{id:uid("t"),t:a,e:h,p:cur.p/2}),Object.assign({},cur,{id:uid("t"),t:b,e:h,p:cur.p/2})];
  if(cur.src==="plan"&&cur.kr){const P=planOf(cur.kr),tk=findT(P,cur.id);if(tk){const m=findM(P,tk._m),i=m.tasks.indexOf(tk);applySug(P,{type:"split_task",target:cur.id,data:{parts:[{t:a,dw:cur.dw,e:h},{t:b,dw:cur.dw,e:h}]}});syncPlan(P);parts[0].id=m.tasks[i].id;parts[1].id=m.tasks[i+1].id}}
  day.plan.splice(k,1,...parts);day.cur=null;FC.sig="";toast("Split in two. The first part is on the card.");renderExec();return true}
 if(d.xhelp){S.pop={x:"msg",req:HELP,act:d.xhelp,reason:"",pts:"",text:helpTpl(d.xhelp,"",HELP)};renderPop();return true}
 if(d.xact){const p=S.pop;p.act=d.xact;p.reason="";p.text=helpTpl(p.act,"",p.req);renderPop();return true}
 if(d.xrs){const p=S.pop;p.reason=d.xrs;p.text=helpTpl("decline",d.xrs,p.req);renderPop();return true}
 if(d.xwrite){claudeWrite();return true}
 if(d.xstop){XBUSY&&XBUSY.abort();return true}
 if(d.xsend){const p=S.pop,req=p.req||HELP,msg=($id("xmsg").value||"").trim();if(!msg){toast("Write a message first.");return true}
  const n=nm(req.from);day.msgs.push({to:req.from,act:p.act,text:msg,t:req.t});
  if(day.phase==="setup"){day.reqs[req.id]=p.act;S.exec.answered=Object.assign(S.exec.answered||{},{[req.id]:{act:p.act,n:day.n}});answerReq(req.id,p.act,msg);const it={id:req.id,t:req.t,dw:req.dw,tag:"Request · "+n,e:req.e,p:req.e,src:"request",req};
   if(p.act==="accept"||p.act==="later"){if(!day.plan.some(i=>i.id===req.id))insertItem(day,it,p.ins>=0?p.ins:(p.act==="accept"?0:null));else day.plan.forEach(i=>{if(i.id===req.id)i.manual=true})}
   else{day.plan=day.plan.filter(i=>i.id!==req.id);if(p.act==="tomorrow")day.tomorrow.push(Object.assign(it,{src:"help"}))}
   S.pop=null;renderPop();toast(`Sent to ${n}. ${p.act==="accept"?"In today's roadmap.":p.act==="later"?"At the end of today.":p.act==="tomorrow"?"First on tomorrow's roadmap.":"Declined."}`);renderExec();return true}
  S.exec.answered=Object.assign(S.exec.answered||{},{[req.id]:{act:p.act,n:day.n}});answerReq(req.id,p.act,msg);
  const item={id:"help-"+req.id,t:req.t,dw:req.dw,tag:"Help · "+n,e:req.e,p:req.e,src:"help"};
  if(p.act==="accept"){const k=day.plan.findIndex(i=>!day.st[i.id]);day.plan.splice(k<0?day.plan.length:k,0,item)}
  if(p.act==="later")day.plan.push(item);
  if(p.act==="tomorrow")day.tomorrow.push(item);
  day.help="answered";S.pop=null;renderPop();
  toast(`Sent to ${n}. ${p.act==="accept"?"It is your next card.":p.act==="later"?"Added at the end of today.":p.act==="tomorrow"?"First on tomorrow's roadmap.":"Declined."}`);renderExec();return true}
 if(d.xeod){S.pop={x:"eod"};renderPop();return true}
 if(d.xask){S.pop={x:"ask"};renderPop();setTimeout(()=>{const u=$id("qt");u&&u.focus()},30);return true}
 if(d.xaskok){const tt=$id("qt").value.trim();if(!tt){toast("Say what you need.");$id("qt").focus();return true}const to=$id("qto").value,lk=msLink($id("qs").value);
  SK.save("requests",{id:SK.newId("rq"),from:S.exec.who,to,title:tt,doneWhen:$id("qd").value.trim(),est:+$id("qh").value||.5,at:todayIso(),serves:lk.lk||"their work",answer:"",message:""});
  S.pop=null;renderPop();toast(`Sent to ${nm(to)}. Their answer will show here.`);return true}
 if(d.xun){S.pop={x:"unpl",when:"next",h:.5};renderPop();setTimeout(()=>{const u=$id("ut");u&&u.focus()},30);return true}
 if(d.xuw){const p=S.pop;p.t=$id("ut").value;p.dw=$id("ud").value;p.h=+$id("uh2").value;p.when=d.xuw;renderPop();return true}
 if(d.xuok){const p=S.pop,tt=$id("ut").value.trim();if(!tt){toast("Say what it is.");$id("ut").focus();return true}
  const h=+$id("uh2").value||.5,from=$id("uf").value,lk=msLink($id("ul").value),when=p.when||"next";
  const it=Object.assign({id:uid("u"),t:tt,dw:$id("ud").value.trim(),tag:"Unplanned"+(from?" · "+from:""),e:h,p:h,src:"unpl",from,help:Object.values(TEAM).some(v=>v.n===from)},lk,lk.lk?{tag:"Unplanned · "+lk.lk}:{});
  const ci=day.plan.findIndex(i=>!day.st[i.id]);
  if(when==="now"){if(day.cur){day.cur=null;day.startAt=null}day.plan.splice(ci<0?day.plan.length:ci,0,it)}
  else if(when==="next")day.plan.splice(ci<0?day.plan.length:ci+1,0,it);
  else if(when==="later")day.plan.push(it);else day.tomorrow.push(it);
  if(!day.why.includes("Unplanned work")&&when!=="tomorrow")day.why.push("Unplanned work");
  S.pop=null;renderPop();toast(when==="now"?"Your task is paused; the unplanned one is on the card.":when==="next"?"It comes right after this task.":when==="later"?"Added at the end of today.":"First on tomorrow's roadmap.");renderExec();return true}
 if(d.xntrm!=null){day.newT.splice(+d.xntrm,1);renderExec();return true}
 if(d.xeodok){S.pop=null;renderPop();day.phase="replan";day.cur=null;renderExec();window.scrollTo({top:0,behavior:"smooth"});return true}
 if(d.xback){day.phase="run";renderExec();return true}
 if(d.xrp){const[id,c]=d.xrp.split(":");day.rp[id]=c;renderExec();return true}
 if(d.xwy){const i=day.why.indexOf(d.xwy);i<0?day.why.push(d.xwy):day.why.splice(i,1);renderExec();return true}
 if(d.xko!=null){day.keepObj[+d.xko]=day.keepObj[+d.xko]===false;renderExec();return true}
 if(d.xrpok){S.pop={x:"slack",text:eodText(day),dest:S.exec.slackDest||ME,q:"",res:[],state:"idle",err:""};renderPop();return true}
 if(d.xsl){const p=S.pop;if(d.xsl==="send")slackSend();
  if(d.xsl==="copy"){const tx=$id("xslt");try{navigator.clipboard.writeText(p.text).then(()=>toast("Copied. Paste it in Slack."),()=>{tx.select();toast("Selected: copy it with your keyboard.")})}catch(e){tx.select()}}
  if(d.xsl==="skip"){S.pop=null;renderPop();applyReplan("EOD not posted to Slack.")}
  if(d.xsl==="claude")polishEod();
  if(d.xsl==="search")slackSearch();return true}
 if(d.xsd){const[id,...n]=d.xsd.split("|");S.pop.dest={id,name:n.join("|")};S.exec.slackDest=S.pop.dest;S.pop.res=[];S.pop.err="";renderPop();return true}
 return false}
/* drag and drop: pool → Today, inside Today, Today → pool */
let DRAG=null;
on("dragstart",e=>{const c=e.target.closest&&e.target.closest("[data-pid],[data-tid]");if(!c)return;DRAG=c.dataset.pid!=null?{pid:c.dataset.pid}:{tid:+c.dataset.tid};c.classList.add("dragging");try{e.dataTransfer.setData("text/plain",c.dataset.pid||c.dataset.tid);e.dataTransfer.effectAllowed="move"}catch(x){}});
on("dragend",()=>{DRAG=null;$all(".dragging").forEach(x=>x.classList.remove("dragging"));$all(".ph-line").forEach(x=>x.remove());$all(".over").forEach(x=>x.classList.remove("over"))});
function dropIndex(list,y){const cards=[...list.querySelectorAll(".tcard")];for(const c of cards){const r=c.getBoundingClientRect();if(y<r.top+r.height/2)return +c.dataset.tid}return cards.length}
on("dragover",e=>{if(!DRAG)return;const z=e.target.closest&&e.target.closest("[data-drop]");if(!z)return;e.preventDefault();$all(".over").forEach(x=>x!==z&&x.classList.remove("over"));z.classList.add("over");
 if(z.dataset.drop==="today"){let ph=z.querySelector(".ph-line");if(!ph){ph=document.createElement("li");ph.className="ph-line";}const i=dropIndex(z,e.clientY),cards=[...z.querySelectorAll(".tcard")];const ref=cards.find(c=>+c.dataset.tid===i);const at=ref&&ref.previousElementSibling&&ref.previousElementSibling.classList.contains("lunch")?ref.previousElementSibling:ref;if(at)z.insertBefore(ph,at);else z.appendChild(ph)}});
on("drop",e=>{if(!DRAG)return;const z=e.target.closest&&e.target.closest("[data-drop]");if(!z)return;e.preventDefault();const day=D(),dg=DRAG;DRAG=null;
 if(z.dataset.drop==="today"){const i=dropIndex(z,e.clientY);if(dg.pid!=null){addToToday(dg.pid,i)}else{const[it]=day.plan.splice(dg.tid,1);day.plan.splice(i>dg.tid?i-1:i,0,it);day.frozen=true;renderExec()}}
 else if(z.dataset.drop==="pool"&&dg.tid!=null){const[it]=day.plan.splice(dg.tid,1);if(it&&!it.manual)day.excl.push(it.id);renderExec();toast("Back in the list.")}});
/* end of day: replan, then the EOD recap posted to Slack after the person validates it */
let MCP=null;(async()=>{try{MCP=await window.claude?.use?.("mcp")}catch(e){MCP=null}})();
const SLACK="Slack",ME={id:"U0ACHGGRX8D",name:"Me (direct message)"};
const RPL={tomorrow:"tomorrow, first",queue:"back to the queue",drop:"dropped"};
function eodText(day){const who=nm(S.exec.who),done=day.plan.filter(i=>day.st[i.id]==="done"),left=day.plan.filter(i=>day.st[i.id]!=="done"),act=done.reduce((a,i)=>a+(day.act[i.id]||0),0),pl=done.reduce((a,i)=>a+i.p,0),objs=day.objs.filter(o=>o.on);
 const L=[`**EOD · ${who} · ${dayLbl(day.n,1)} (W${isoWk(day.n)})**`,"",`**Objectives · ${objs.filter(o=>o.done).length} of ${objs.length} reached**`];
 objs.forEach(o=>{const k=day.objs.indexOf(o);L.push(`${o.done?"✅":"❌"} ${o.t}${!o.done&&day.keepObj[k]!==false?" → carried to tomorrow":""}`)});
 L.push("",`**Done · ${done.length} of ${day.plan.length} tasks · ${hrs(act)} real for ${hrs(pl)} planned**`);
 done.forEach(i=>L.push(`• ${i.t} (${i.tag.split(" · ")[0]}) · ${hrs(day.act[i.id]||0)}`));if(!done.length)L.push("• Nothing finished today");
 if(left.length){L.push("","**Not finished**");left.forEach(i=>{const b=day.blk[i.id];L.push(`• ${i.t} → ${RPL[day.rp[i.id]||"tomorrow"]}${b?` _(blocked: ${b.by&&b.why==="Waiting on someone"?"waiting on "+nm(b.by):b.why+(b.by?", waiting on "+nm(b.by):"")})_`:""}`)})}
 day.msgs.forEach(m=>L.push("",`**Help** · ${nm(m.to)} asked: “${m.t||HELP.t}” → ${HACT[m.act].toLowerCase()}`));
 {const D2=(S.exec.log||[]).filter(l=>l.who===S.exec.who&&l.n===day.n),hl=D2.filter(l=>l.help),hh=hl.reduce((a,l)=>a+l.act,0),tt=D2.reduce((a,l)=>a+l.act,0),Wk=helpStats(S.exec.who,isoWk(day.n));if(hl.length||Wk.n)L.push("",`**Help given** · today ${hl.length} task${hl.length!==1?"s":""}, ${hrs(hh)} (${tt?Math.round(hh/tt*100):0} % of the time worked) · this week ${Wk.n} task${Wk.n!==1?"s":""}, ${hrs(Wk.h)} (${Math.round(Wk.pct)} %)`)}
 if(day.why.length)L.push("",`**What got in the way** · ${day.why.join(", ")}`);
 const un=day.plan.filter(i=>i.src==="unpl");if(un.length)L.push("",`**Unplanned · ${un.length} task${un.length>1?"s":""}, ${hrs(un.reduce((a,i)=>a+i.p,0))}** · ${un.map(i=>i.t+(i.from?" ("+i.from+")":"")).join(" · ")}`);
 if((day.comment||"").trim())L.push("",`**Comment** · ${day.comment.trim()}`);
 if((day.newT||[]).length){L.push("","**New tasks planned**");day.newT.forEach(n=>L.push(`• ${n.t} → ${dayLbl(n.dayN,1)} · ${hrs(n.e)}${n.lk?" · "+n.lk:""}`))}
 const first=[...left.filter(i=>(day.rp[i.id]||"tomorrow")==="tomorrow"),...day.tomorrow];if(first.length)L.push("",`**Tomorrow first** · ${first.map(i=>i.t).join(" · ")}`);
 return L.join("\n")}
function applyReplan(note){const day=D();S.exec.sched=(S.exec.sched||[]).concat((day.newT||[]).map(n=>Object.assign({},n,{who:S.exec.who})));const left=day.plan.filter(i=>day.st[i.id]!=="done"),carried=[...day.tomorrow];S.exec.dropped=S.exec.dropped||[];S.exec.pool=S.exec.pool||[];
 left.forEach(i=>{const c=day.rp[i.id]||"tomorrow";if(c==="tomorrow")carried.push(i.src==="request"?Object.assign({},i,{src:"help"}):i);else if(c==="drop")S.exec.dropped.push(i.id);else if(i.src==="help")S.exec.pool.push(Object.assign({},i,{who:S.exec.who}))});
 const objs=day.objs.filter((o,k)=>o.on&&!o.done&&day.keepObj[k]!==false).map(o=>({t:o.t,src:"Yesterday",on:true,done:false}));
 S.exec.history=(S.exec.history||[]).concat({n:day.n,done:day.plan.length-left.length,of:day.plan.length,why:day.why});
 const nn=Math.max(day.n+1,todayN());S.exec.day=newDay(nn,S.exec.who,carried,objs);toast(`${note?note+" ":""}${dayLbl(nn,1)} is ready to set up${carried.length?": "+carried.length+" task"+(carried.length>1?"s":"")+" first":""}.`);renderExec();window.scrollTo({top:0,behavior:"smooth"})}
function mcpMsg(e){const c=e&&e.code;return c==="server_not_connected"?"Slack is not connected for you: add it in claude.ai Settings → Connectors.":c==="needs_reauth"?"Reconnect Slack in claude.ai Settings → Connectors.":c==="not_in_manifest"||c==="approval_required"||c==="blocked_by_policy"?"Posting to Slack was not allowed for this page.":c==="selection_required"?"Choose which Slack connector to use when Claude asks, then try again.":c==="tool_error"?"Slack refused the message: "+(e.message||"unknown reason"):"Slack did not answer ("+(c||"error")+")."}
async function slackSend(){const p=S.pop;if(!p||p.state==="sending")return;if(!MCP){p.err="Slack cannot be reached from this view. Open the page in Claude with Slack connected, or copy the message.";renderPop();return}
 p.state="sending";p.err="";renderPop();
 try{const r=await MCP.callTool(SLACK,"slack_send_message",{channel_id:p.dest.id,message:p.text});const raw=typeof r.payload==="string"?r.payload:JSON.stringify(r.payload||r.content||"");const m=raw.match(/https:\/\/[^\s"'\\)]*slack\.com\/archives\/[^\s"'\\)]+/);
  S.exec.lastPost={url:m?m[0]:"",dest:p.dest.name,n:D().n};S.pop=null;renderPop();applyReplan(`EOD posted to Slack (${p.dest.name}).`)}
 catch(e){if(S.pop){S.pop.state="idle";S.pop.err=mcpMsg(e);renderPop()}}}
async function slackSearch(){const p=S.pop,q=(p.q||"").trim().replace(/^#/,"");if(!q)return;if(!MCP){p.err="Slack cannot be reached from this view.";renderPop();return}p.searching=true;p.err="";renderPop();
 try{const r=await MCP.callTool(SLACK,"slack_search_channels",{keywords:[q],natural_language_query:q,channel_types:"public_channel,private_channel",response_format:"concise"},{cache:false});const raw=typeof r.payload==="string"?r.payload:JSON.stringify(r.payload||"");
  p.res=[...raw.matchAll(/#([\w.-]+)\s*\(([A-Z0-9]{8,})\)/g)].map(m=>({id:m[2],name:"#"+m[1]}));if(!p.res.length)p.err=`No channel matches “${q}”.`}
 catch(e){p.err=mcpMsg(e)}finally{if(S.pop){S.pop.searching=false;renderPop()}}}
async function polishEod(){const p=S.pop;if(!SAMPLE||XBUSY)return;const ctl=new AbortController();XBUSY=ctl;p.busy=true;renderPop();
 try{const r=await SAMPLE(`Rewrite this end-of-day recap for Slack so a teammate reads it in 20 seconds. Keep every fact, number, task name and the same sections; do not add anything. Keep the Slack markdown (**bold**, bullets, ✅ ❌). English. Never write "closer"; say "sales". Return only the message.\n\n${p.text}`,{signal:ctl.signal,cache:false,onText:({text})=>{p.text=text;const b=$id("xslt");if(b)b.value=text}});p.text=r.text}
 catch(e){if(!(e&&e.code==="cancelled"))toast("Claude did not answer this time. The recap is kept.")}finally{XBUSY=null;if(S.pop){S.pop.busy=false;renderPop()}}}
function slackPopHTML(p){const sending=p.state==="sending";
 return `<div class="scrim" data-close="1"><div class="dlg" style="width:680px" role="dialog" aria-modal="true" aria-labelledby="sh"><div class="dh"><div><div class="pk" style="color:var(--gold2)">End of day · Slack</div><h2 id="sh" style="font-size:22px">Check your EOD before it is posted</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <div class="xsh"><span class="note">Post to</span><b>${esc(p.dest.name)}</b>${p.dest.id===ME.id?`<span class="note">· team channel to confirm</span>`:""}</div>
 <form class="oadd" data-xslf="1"><input id="xslq" value="${esc(p.q||"")}" placeholder="Find a channel, e.g. eod, ops, team…" aria-label="Find a Slack channel" autocomplete="off"><button class="btn" type="submit" ${p.searching?"disabled":""}>${p.searching?"Searching…":"Find"}</button>${p.dest.id!==ME.id?`<button class="btn" type="button" data-xsd="${ME.id}|${ME.name}">Me</button>`:""}</form>
 ${p.res&&p.res.length?`<div class="olist">${p.res.map(c=>`<button class="ochip" data-xsd="${c.id}|${esc(c.name)}">${esc(c.name)}</button>`).join("")}</div>`:""}
 <label class="fld" for="xslt"><span>Message </span><textarea id="xslt" rows="14" style="font-family:var(--mono);font-size:12.5px">${esc(p.text)}</textarea></label>
 ${p.err?`<div class="rule" style="background:var(--crits);border-color:var(--crit)"><span class="ic" style="color:var(--crit)">!</span><span>${esc(p.err)}</span></div>`:""}
 ${!MCP?`<p class="note">Slack is not reachable from this view: open the page in Claude with Slack connected to post it directly, or copy it.</p>`:""}
 <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><div style="display:flex;gap:8px;flex-wrap:wrap">${SAMPLE?(p.busy?`<span class="note dots" style="align-self:center">Claude is rewriting</span>`:`<button class="btn sm" data-xsl="claude">Tighten with Claude</button>`):""}<button class="btn sm" data-xsl="copy">Copy</button>${!MCP||p.err?`<button class="btn sm ghost" data-xsl="skip">Continue without posting</button>`:""}</div>
 <div style="display:flex;gap:8px"><button class="btn" data-close="1">Back to replan</button><button class="btn p" data-xsl="send" ${sending||p.busy||!MCP?"disabled":""}>${sending?"Posting…":"Validate and post to Slack"}</button></div></div></div></div></div>`}
async function suggestObjs(){const day=D();if(!SAMPLE||XBUSY)return;const ctl=new AbortController();XBUSY=ctl;toast("Claude is reading your milestones…");const G=pool(),F=focusMs(day);
 try{const out=await SAMPLE.json(`You help ${nm(S.exec.who)} (ALKIMIY) set up a working day. Propose exactly 6 objectives for today. An objective is a result visible tonight, one short line, written as what will be true (e.g. "Definition of the first result shared in #ops"), never an activity. Serve the focus milestones first, then requests from colleagues, then the rest of the week. Never invent facts; say "to confirm" if needed. English. Never write "closer".
Focus milestones: ${JSON.stringify(F.map(x=>({id:x.m.id,kr:krShort(x.k),milestone:x.m.t,week:x.m.w,proof:x.m.proof})))}
Tasks available today (id, title, done when, hours): ${JSON.stringify(allPool(G).map(i=>({id:i.id,t:i.t,doneWhen:i.dw,from:i.tag,h:+i.p.toFixed(2)})))}
Reply with ONLY a JSON array of 6 objects: {"t": objective, "src": short source label like "KR 1.3 · M1" or "Request", "ids": [ids of the tasks that deliver it]}.`,{signal:ctl.signal,cache:false});
  const ids=new Set(allPool(G).map(i=>i.id)),list=(Array.isArray(out)?out:[]).map(o=>({t:String(o&&o.t||"").trim(),src:String(o&&o.src||"Claude").slice(0,30),ids:(Array.isArray(o&&o.ids)?o.ids:[]).filter(x=>ids.has(x))})).filter(o=>o.t).slice(0,6);
  if(list.length){day.gen=list;day.genBy="claude";day.sel=day.sel.filter(s=>allObjs(day).some(o=>o.t===s));repropose(day);renderExec()}else toast("Claude gave no usable objective.")}
 catch(e){if(e&&e.code==="not_granted"){SAMPLE=null;renderGuideMode();renderExec()}else toast("Claude did not answer this time.")}finally{XBUSY=null}}
async function claudeDay(){const day=D();if(!SAMPLE||XBUSY)return;const ctl=new AbortController();XBUSY=ctl;toast("Claude is building your ideal day…");const G=pool(),A=allPool(G),F=focusMs(day);
 try{const out=await SAMPLE.json(`Build the ideal roadmap for ${nm(S.exec.who)}'s working day at ALKIMIY (${dayLbl(day.n)}, ISO week W${isoWk(day.n)}), ${day.hours} hours allocated from ${day.start}, lunch 1 h at 12:30.
Method: hardest focus work first in the morning; tasks of the focus milestones before anything else, late milestones first; every chosen objective must be delivered by at least one task; a colleague's request goes in only if it is short or unblocks them, never more than about 15 % of the day; keep at least 10 % of the day free for the unexpected; total hours must not exceed ${day.hours - Math.max(.5,Math.round(day.hours*.1*4)/4)} h; tasks the person dragged in themselves (manual) must stay.
Focus milestones: ${JSON.stringify(F.map(x=>({kr:krShort(x.k),milestone:"M"+(x.i+1)+" "+x.m.t,week:x.m.w})))}
Chosen objectives: ${JSON.stringify(selObjs(day).map((o,n)=>({n:n+1,t:o.t,deliveredBy:o.ids})))}
Possible tasks (id, title, source, planned hours, manual): ${JSON.stringify(A.map(i=>({id:i.id,t:i.t,src:i.tag,h:+i.p.toFixed(2),manual:day.plan.some(p=>p.id===i.id&&p.manual)})))}
Reply with ONLY a JSON object: {"order":[{"id":task id,"why":"one short reason"}],"note":"one or two sentences on the shape of the day"}.`,{signal:ctl.signal,cache:false});
  const byId=Object.fromEntries(A.map(i=>[i.id,i])),man=day.plan.filter(i=>i.manual);const order=(out&&Array.isArray(out.order)?out.order:[]).filter(o=>o&&byId[o.id]);
  if(!order.length){toast("Claude gave no usable roadmap.");return}
  const plan=order.map(o=>Object.assign({},byId[o.id],{why:"Claude: "+String(o.why||"").slice(0,140),manual:man.some(m=>m.id===o.id)}));man.forEach(m=>{if(!plan.some(p=>p.id===m.id))plan.push(m)});
  day.plan=plan;day.frozen=true;day.note=String(out.note||"").slice(0,300);renderExec()}
 catch(e){if(e&&e.code==="not_granted"){SAMPLE=null;renderGuideMode();renderExec()}else toast("Claude did not answer this time.")}finally{XBUSY=null}}
// Ask a colleague: a shared request; their answer and message come back here (and in their Execute)
function askPopHTML(p){return `<div class="scrim" data-close="1"><div class="dlg" style="width:600px" role="dialog" aria-modal="true" aria-labelledby="ah"><div class="dh"><div><div class="pk" style="color:var(--info)">Request</div><h2 id="ah" style="font-size:22px">Ask a colleague</h2></div><button class="close" data-close="1" aria-label="Close">×</button></div><div class="db">
 <label class="fld" for="qto">Who<select id="qto">${Object.entries(TEAM).filter(([k])=>k!==S.exec.who).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join("")}</select></label>
 <label class="fld" for="qt">What do you need?<input id="qt" class="inp" placeholder="Verb + object" autocomplete="off"></label>
 <label class="fld" for="qd">Done when<input id="qd" class="inp" placeholder="What will be true when it is finished" autocomplete="off"></label>
 <div class="ugrid"><label class="fld" for="qh">Time<select id="qh">${[.25,.5,.75,1,1.5,2].map(v=>`<option value="${v}" ${v===.5?"selected":""}>${hrs(v)}</option>`).join("")}</select></label><label class="fld" for="qs" style="grid-column:span 2">It serves<select id="qs"><option value="">My work</option>${msOptions()}</select></label></div>
 <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close="1">Cancel</button><button class="btn p" data-xaskok="1">Send the request</button></div></div></div></div>`}
function repliesHTML(){const who=S.exec.who,since=Date.now()-3*864e5,L=SK.list("requests").filter(r=>r.from===who&&r.answer&&Date.parse(r.answeredAt||0)>since);
 return L.length?`<div class="rule"><span class="ic">i</span><span>${L.map(r=>`<b>${esc(nm(r.to))}</b> · ${esc(HACT[r.answer]||r.answer)} “${esc(r.title)}”${r.message?`: ${esc(r.message)}`:""}`).join("<br>")}</span></div>`:""}

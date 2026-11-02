
/* ================== SKL OS EMBED ==================
   The editor's own mechanism workspace — HUD, Build, Model, Organs, Control — mounted inside SKL OS.
   State lives in a module store so it survives the host page re-rendering its frame. */

/* ================== THE OPERATING SYSTEM, MODELLED AS TWO MECHANISMS ==================
   Built with the Iteration-system method that produced Pre-call. One mechanism per clock:
   - Execution steering: event alerts on tasks and decisions, closed in days.
   - Results steering: key results read every week, corrected over weeks.
   Alert rules are not mechanisms: each one is a sensor (organ 15) with its threshold, filed in the
   mechanism it watches. Load and work-in-progress alerts are states, read as constraints (organ 04). */
const OS_EXEC = {
 "01":[{type:"start",nom:"A task rule fires: overdue (a1), blocked over 24 h (a2), over 8 h (a3), timebox used up (a11)"},
       {type:"start",nom:"A decision rule fires: reversible or irreversible decision overdue (a8, a9), review due (a10)"},
       {type:"end",nom:"The alert is closed by the data: task unblocked, split or done"},
       {type:"end",nom:"The decision is taken"},
       {type:"end",nom:"The alert expires unhandled"}],
 "02":{metrique:"Execution alerts closed within 7 days",cible:85,unite:"% of alerts raised",plancher:70,horizon:"one quarter"},
 "03":{sacrifie:"When the week fills up, alert triage is the first thing skipped; owners keep shipping tasks and leave blocked ones waiting",
       revele:"Keep tasks moving, not clear what blocks them. Activity is protected, unblocking gives way"},
 "04":[{nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,preuve:"benchmark"},
       {nom:"Team planned load (read by rules a4, a13, a14)",nature:"throughput",unite:"h/7 days",borne:82,charge:62,seuil:57,preuve:"measured"},
       {nom:"Lead available to receive escalations",nature:"presence",unite:"person",borne:1,charge:1,seuil:7,preuve:"measured"}],
 "05":{nom:"Romain · CPO",
       autorite:"Task and decision alert rules, the escalation delay, who owns each alert, the snooze rule",
       refus:"yes"},
 "06":[{nom:"Task alerts",volume:18,unite:"per week",varia:"±6 · doubles in a launch week",source:"Tasks in My Day and Roadmap"},
       {nom:"Decision alerts",volume:6,unite:"per week",varia:"±2",source:"Decisions board"}],
 "07":[{nom:"A launch week pulls everyone into execution",gravite:"high",obs:"yes"},
       {nom:"The lead is away: escalations have no receiver",gravite:"high",obs:"yes"},
       {nom:"Tasks created without a date or an owner",gravite:"medium",obs:"yes"},
       {nom:"Shared database unavailable",gravite:"low",obs:"no"}],
 "08":[{nom:"Open alerts",niveau:12,rotation:2,unite:"alerts"},
       {nom:"Decisions waiting",niveau:8,rotation:4,unite:"decisions"}],
 "09":[{nom:"Triage",de:"Task alerts",vers:"Open alerts",debit:18,unite:"/wk"},
       {nom:"Fixed at the source",de:"Open alerts",vers:"Closed by the data",debit:13,unite:"/wk"},
       {nom:"Expired unhandled",de:"Open alerts",vers:"Expired unhandled",debit:1,unite:"/wk"},
       {nom:"Escalated or framed as a decision",de:"Open alerts",vers:"Decisions waiting",debit:4,unite:"/wk"},
       {nom:"Decision due",de:"Decision alerts",vers:"Decisions waiting",debit:6,unite:"/wk"},
       {nom:"Decided",de:"Decisions waiting",vers:"Decision taken",debit:10,unite:"/wk"},
       {nom:"Read but not acted on",de:"Open alerts",vers:"Alert fatigue",debit:3,unite:"/wk"},
       {nom:"Leads' triage time",de:"Decisions waiting",vers:"Leadership time on escalations",debit:150,unite:"min/wk"},
       {nom:"The decision unblocks tasks, which raises or removes the next alerts",de:"Decision taken",vers:"Task alerts",debit:10,unite:"/wk"}],
 "10":[{nom:"Closed by the data",valeur:13,dest:"The steered mechanisms (task unblocked, split or done)",induite:"no"},
       {nom:"Decision taken",valeur:10,dest:"Results steering (plan of the key result)",induite:"no"},
       {nom:"Expired unhandled",valeur:1,dest:"Quarter close (lesson only)",induite:"no"},
       {nom:"Leadership time on escalations",valeur:150,dest:"Founder's attention",induite:"yes"},
       {nom:"Alert fatigue",valeur:3,dest:"Trust in the OS",induite:"yes"}],
 "11":[{nom:"Escalation delay for Critical and High alerts (24 h)",
        agit:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",acteur:"Romain"},
       {nom:"Blocked threshold (a2, 24 h) and task size cap (a3, 8 h)",
        agit:"A task over 8 h is three times more likely to block than two tasks of 4 h",acteur:"Romain"},
       {nom:"Decision lead time (48 h reversible, 7 d irreversible)",
        agit:"A decision taken within its lead time unblocks about 2 tasks",acteur:"Romain"},
       {nom:"Snooze allowed once per alert",
        agit:"A second snooze ends in expiry three times out of four",acteur:"Romain"}],
 "12":[{nom:"Medium and Low alerts never escalate",raison:"Protect the leads' triage time",
        degel:"If a Medium alert stays open over 14 days three times in a quarter"},
       {nom:"Tasks capped at 8 h, unknown work as a timeboxed exploration",raison:"Keeps cycle time readable",
        degel:"If cycle time stays above 5 days for 4 weeks"},
       {nom:"One owner per alert",raison:"An alert owned by two people is owned by nobody",
        degel:"Never: change who owns it instead"}],
 "13":[{nom:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",
        porte:"Fixed at the source",nonlin:"yes",usage:"intervene"},
       {nom:"A task over 8 h is three times more likely to block than two tasks of 4 h",
        porte:"Triage",nonlin:"yes",usage:"intervene"},
       {nom:"Escalation converts about 3 in 4 escalated alerts into a decision within the week",
        porte:"Escalated or framed as a decision",nonlin:"no",usage:"predict"},
       {nom:"A decision taken within its lead time unblocks about 2 tasks",
        porte:"Decided",nonlin:"no",usage:"predict"},
       {nom:"A second snooze ends in expiry three times out of four",
        porte:"Expired unhandled",nonlin:"yes",usage:"intervene"}],
 "14":{processus:3,capteur:1},
 "15":[{nom:"Alert log",mesure:"Closed by the data",latence:0,bruit:3,unite:"pts of closure rate",
        saisie:"Automatic: an alert closes when the data behind it is fixed"},
       {nom:"Decision log",mesure:"Decision taken",latence:1,bruit:2,unite:"pts of closure rate",
        saisie:"The decision owner, when the decision moves to Decided"},
       {nom:"Task rules · a1 overdue · a2 blocked > 24 h · a3 over 8 h · a11 timebox",mesure:"Open alerts",latence:0,bruit:3,unite:"alerts",
        saisie:"Automatic, from tasks in My Day and Roadmap"},
       {nom:"Decision rules · a8 · a9 overdue · a10 review due",mesure:"Decisions waiting",latence:0,bruit:1,unite:"decisions",
        saisie:"Automatic, from the Decisions board"}],
 "16":{mesure:74,fenetre:2},
 "17":{cadence:7,bande:5,gain:1,
       inaction:"Nothing. Rules and thresholds stay as they are; alerts keep flowing to their owners in My Day."},
 "18":[{nom:"Alert open > 24 h → escalated → decision taken → task unblocked → alert closed",type:"balancing",delai:3},
       {nom:"Load > 70 % → tasks late → more alerts → more triage time → less time to execute → load ↑",type:"reinforcing",delai:14}],
 "19":[{valeur:"Open alerts and decisions waiting",niveau:"measured",date:"live in the OS"},
       {valeur:"Planned load 76 % for the team",niveau:"measured",date:"live in My Day"},
       {valeur:"Task over 8 h three times more likely to block",niveau:"benchmark",date:"flow literature"},
       {valeur:"Escalation converts 3 in 4 into a decision",niveau:"hunch",date:"—"},
       {valeur:"Cycle time 3.4 days",niveau:"hunch",date:"sample data until phase 4"}],
 "20":[{nom:"Alert closure time does not depend on who owns the alert",test:"Compare closure time by owner over one quarter"},
       {nom:"Escalation speed does not depend on the day of the week",test:"Cross escalation-to-decision time with the weekday the alert fired"}],
 "21":[{nom:"Key result alerts (a5, a6, a7)",raison:"Weekly clock: they belong to Results steering",
        signal:"If a key result alert closes in under 3 days, three times in a quarter"},
       {nom:"The steered mechanisms themselves (Pre-call, Sales…)",raison:"Different owners, their own clocks",
        signal:"If more than half of the alerts come from one mechanism three weeks running"}]
};
const OS_RES = {
 "01":[{type:"start",nom:"A key result is read at its weekly check-in, or the stale rule (a7) fires after 7 days without one"},
       {type:"end",nom:"The key result is read on plan"},
       {type:"end",nom:"The key result comes back on plan after a recovery"},
       {type:"end",nom:"The plan changes: recovery plan, target or owner, decided at the Saturday call"},
       {type:"end",nom:"The key result is kept off plan by an explicit go"}],
 "02":{metrique:"Key results on plan at the weekly read",cible:80,unite:"% of key results",plancher:60,horizon:"one quarter"},
 "03":{sacrifie:"Under pressure, the check-in is skipped before the work is: an off-plan key result goes unread rather than being declared",
       revele:"Avoid declaring a key result off plan. Silence is preferred to a red status"},
 "04":[{nom:"Saturday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,preuve:"measured"},
       {nom:"Weeks left in the quarter",nature:"depleting stock",unite:"weeks",borne:10,charge:1,seuil:3,preuve:"measured"},
       {nom:"Owners' check-in time",nature:"throughput",unite:"min/week",borne:75,charge:40,seuil:60,preuve:"hunch"}],
 "05":{nom:"Amin · CEO",
       autorite:"The go / no-go call, recovery plans, changing a target or an owner, the KR colour rule",
       refus:"yes"},
 "06":[{nom:"Weekly key result readings",volume:5,unite:"per week",varia:"one per key result",source:"Roadmap check-ins, and rule a7 when one is missing"}],
 "07":[{nom:"A key result whose data arrives monthly, not weekly",gravite:"high",obs:"yes"},
       {nom:"A launch moves the curve by steps, not by slope",gravite:"medium",obs:"yes"},
       {nom:"The owner is away on Saturday",gravite:"medium",obs:"yes"},
       {nom:"A target is copied from another quarter without a baseline",gravite:"low",obs:"no"}],
 "08":[{nom:"Key results off plan",niveau:3,rotation:21,unite:"key results"},
       {nom:"Key results not tracked",niveau:1,rotation:7,unite:"key results"}],
 "09":[{nom:"Check-in on plan",de:"Weekly key result readings",vers:"Read on plan",debit:2,unite:"/wk"},
       {nom:"Check-in off plan (a5, a6)",de:"Weekly key result readings",vers:"Key results off plan",debit:2,unite:"/wk"},
       {nom:"No check-in (a7)",de:"Weekly key result readings",vers:"Key results not tracked",debit:1,unite:"/wk"},
       {nom:"Checked in late",de:"Key results not tracked",vers:"Key results off plan",debit:1,unite:"/wk"},
       {nom:"Back on plan",de:"Key results off plan",vers:"Back on plan",debit:1,unite:"/wk"},
       {nom:"No-go: recovery plan decided",de:"Key results off plan",vers:"Plan changed",debit:1,unite:"/wk"},
       {nom:"Go despite the gap",de:"Key results off plan",vers:"Kept off plan by a go",debit:1,unite:"/wk"},
       {nom:"Recovery actions",de:"Plan changed",vers:"Recovery actions sent to execution",debit:6,unite:"actions/wk"},
       {nom:"The changed plan sets a new expected value for the next reading",de:"Plan changed",vers:"Weekly key result readings",debit:1,unite:"/wk"}],
 "10":[{nom:"Read on plan",valeur:2,dest:"Cockpit · On track",induite:"no"},
       {nom:"Back on plan",valeur:1,dest:"Cockpit · On track",induite:"no"},
       {nom:"Plan changed",valeur:1,dest:"Roadmap (recovery plan, target or owner)",induite:"no"},
       {nom:"Kept off plan by a go",valeur:1,dest:"Weekly Review (written down, read again next Saturday)",induite:"no"},
       {nom:"Recovery actions sent to execution",valeur:6,dest:"Execution steering (new tasks)",induite:"yes"}],
 "11":[{nom:"KR colour thresholds (landing below 90 % = red, behind plan below 0.9 = recovering)",
        agit:"Confidence below 5 / 10 predicts an off-plan reading two weeks later",acteur:"Amin"},
       {nom:"Stale check-in threshold (7 days)",
        agit:"Each missed check-in delays detection by a week and doubles the recovery needed",acteur:"Amin"},
       {nom:"Recovery plan due within one week of a no-go",
        agit:"A no-go followed by a recovery plan within a week brings 1 key result in 2 back on plan within 4 weeks",acteur:"Amin"},
       {nom:"Mid-point review at W6: keep or pivot the initiatives",
        agit:"A key result off plan for 3 weeks without a recovery plan almost never comes back",acteur:"Amin"}],
 "12":[{nom:"Quarter of 13 weeks",raison:"Same clock for every objective",degel:"If two key results are rewritten mid-quarter"},
       {nom:"Target fixed after W2, except through a decision",raison:"Stops targets from drifting towards the result",
        degel:"If more than one target change per quarter is needed"},
       {nom:"2 to 5 initiatives per key result",raison:"Focus",degel:"If a key result needs a sixth bet to cover its gap"}],
 "13":[{nom:"A key result off plan for 3 weeks without a recovery plan almost never comes back",
        porte:"Back on plan",nonlin:"yes",usage:"intervene"},
       {nom:"A no-go followed by a recovery plan within a week brings 1 key result in 2 back on plan within 4 weeks",
        porte:"No-go: recovery plan decided",nonlin:"no",usage:"intervene"},
       {nom:"Each missed check-in delays detection by a week and doubles the recovery needed",
        porte:"No check-in (a7)",nonlin:"yes",usage:"intervene"},
       {nom:"Confidence below 5 / 10 predicts an off-plan reading two weeks later",
        porte:"Check-in off plan (a5, a6)",nonlin:"no",usage:"predict"}],
 "14":{processus:14,capteur:7},
 "15":[{nom:"Weekly check-ins",mesure:"Read on plan",latence:3,bruit:20,unite:"pts (one key result = 20)",
        saisie:"Each key result owner, before Saturday"},
       {nom:"Status rule · a5 off track · a6 at risk or recovering",mesure:"Key results off plan",latence:0,bruit:0,unite:"key results",
        saisie:"Automatic, from the forecast in the Cockpit"},
       {nom:"Stale rule · a7 no check-in for 7 days",mesure:"Key results not tracked",latence:0,bruit:0,unite:"key results",
        saisie:"Automatic"}],
 "16":{mesure:40,fenetre:2},
 "17":{cadence:21,bande:25,gain:1,
       inaction:"Nothing. The Saturday review reads the statuses every week, but levers and thresholds are only changed every three weeks, once a correction has had time to show."},
 "18":[{nom:"Key result off plan → no-go → recovery plan → pace ↑ → back on plan",type:"balancing",delai:28},
       {nom:"Key result off plan → recovery actions → execution load ↑ → pace ↓ → key result off plan",type:"reinforcing",delai:21}],
 "19":[{valeur:"Key result statuses",niveau:"measured",date:"live in the Cockpit"},
       {valeur:"Landing forecast at the recent pace",niveau:"benchmark",date:"two check-ins needed"},
       {valeur:"1 key result in 2 comes back after a recovery plan",niveau:"hunch",date:"—"},
       {valeur:"Confidence predicts the reading two weeks later",niveau:"hunch",date:"—"}],
 "20":[{nom:"Confidence predicts the next reading whoever the owner",test:"Compare confidence and the reading two weeks later, owner by owner, over one quarter"},
       {nom:"A plan changed mid-quarter does not lower the team's commitment",test:"Compare commitments kept the 3 weeks before and after each plan change"}],
 "21":[{nom:"Task and decision alerts",raison:"Days, not weeks: they belong to Execution steering",
        signal:"If a task alert stays open more than 3 weeks"},
       {nom:"Setting the objectives of the quarter",raison:"A 13-week clock, slower than weekly steering",
        signal:"If a key result is rewritten twice in a quarter"}]
};
CATALOG.push({id:"opexec",nom:"Execution steering",lane:6,col:2,
  quoi:"Turns task and decision alerts into fixes or decisions within days. Part of the Operating System.",
  pre:["tools"]});
CATALOG.push({id:"opres",nom:"Results steering",lane:6,col:3,
  quoi:"Reads every key result each week and changes the plan when one goes off it. Part of the Operating System.",
  pre:["opexec"]});
const OS_IDS = ["s-os-exec","s-os-res"];
const OS_REG = {
 interfaces:[
  {point:"Decisions taken",de:"Execution steering",part:"100 %",vers:"Results steering",mode:"duplication",debit:10,unite:"week",
   def:"A decision changes a plan, a target or an owner of a key result"},
  {point:"Recovery actions",de:"Results steering",part:"100 %",vers:"Execution steering",mode:"duplication",debit:6,unite:"week",
   def:"Induced output — a no-go adds tasks, which raise the next execution alerts"},
  {point:"Leadership time on escalations",de:"Execution steering",part:"100 %",vers:"Founder's attention",mode:"duplication",debit:150,unite:"week (minutes)",
   def:"Induced output — the cost of steering, paid by the leads"}],
 ressources:[
  {nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,puisent:"Execution steering",
   note:"CONFIRM — the same two people as Founder's attention"},
  {nom:"Saturday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,puisent:"Results steering",note:"45-minute agenda, 6 steps"}],
 evenements:[
  {date:"1 Oct 2026",nom:"Inbox merged into My Day",rompt:"Alert handling times before and after are not comparable",rouages:"Execution steering"},
  {date:"1 Oct 2026",nom:"KR colour rule moved to the forecast",rompt:"Status history: reds before this date read differently",rouages:"Results steering"},
  {date:"1 Oct 2026",nom:"Roadmap rebuilt: review and builder",rompt:"How milestones and actions are created",rouages:"Results steering · Execution steering"}],
 acteurs:[
  {nom:"Romain",role:"CPO · owns Execution steering",leviers:"Task and decision alert rules · escalation delay · snooze rule",
   rouages:"Execution steering",note:"",refus:"yes"},
  {nom:"Amin",role:"CEO · owns Results steering",leviers:"Go / no-go call · recovery plans · KR colour rule · targets and owners",
   rouages:"Results steering",note:"",refus:"yes"}]
};
/* Add the Operating System lines to the registers once, without touching anyone else's lines. */
function withOsReg(R){
  const r={...(R||{})};
  Object.keys(OS_REG).forEach(k=>{
    const cur=Array.isArray(r[k])?r[k]:[];
    const key=x=>(x.point||x.nom||"")+"|"+(x.rouages||x.puisent||x.vers||"");
    const have=new Set(cur.map(key));
    r[k]=cur.concat(OS_REG[k].filter(x=>!have.has(key(x))).map(x=>({...x})));
  });
  return r;
}

const SKL_STORE = {
  systemes: normSys([
    {id:"s-preappel",nom:"Pre-call",type:"mechanism",modele:PREAPPEL},
    {id:"s-vente",nom:"Sales",type:"mechanism",modele:DEFAUT},
    {id:"s-os-exec",nom:"Execution steering",type:"mechanism",etape:9,modele:OS_EXEC},
    {id:"s-os-res",nom:"Results steering",type:"mechanism",etape:9,modele:OS_RES}]),
  regData: withOsReg(regSemer(null)),
  ui: {}
};

/* Shared database: one document per mechanism (mech/sys-<id>) and one for the registers (mech/registers),
   stored as JSON text so the editor's deep model never hits the database depth limit. */
const SKL_SYNC = { last: {}, timers: {}, subs: new Set() };
function sklDbPush(){
  const S = window.SKL; if(!S) return;
  const docs = SKL_STORE.systemes.map(x=>["sys-"+x.id, x]).concat([["registers", SKL_STORE.regData]]);
  docs.forEach(([id,val])=>{
    const json = JSON.stringify(val);
    if(SKL_SYNC.last[id]===json) return;
    clearTimeout(SKL_SYNC.timers[id]);
    SKL_SYNC.timers[id] = setTimeout(()=>{
      SKL_SYNC.last[id]=json;
      try{ S.save("mech",{id, json, at:S.iso(S.today), by:S.me||""}); }catch(e){ console.error(e); }
    }, 1200);
  });
}
function sklDbPull(){
  const S = window.SKL; if(!S) return;
  let changed=false;
  S.list("mech").forEach(d=>{
    if(!d || typeof d.json!=="string" || SKL_SYNC.last[d.id]===d.json) return;
    let val; try{ val=JSON.parse(d.json); }catch(e){ return; }
    SKL_SYNC.last[d.id]=d.json;
    if(d.id==="registers"){ SKL_STORE.regData=withOsReg(val); changed=true; return; }
    if(d.id.indexOf("sys-")!==0 || !val || !val.id || val.id==="s-os") return;
    const i=SKL_STORE.systemes.findIndex(x=>x.id===val.id);
    const n=normSys([val])[0];
    SKL_STORE.systemes = i<0 ? [...SKL_STORE.systemes, n] : SKL_STORE.systemes.map((x,k)=>k===i?n:x);
    changed=true;
  });
  if(changed) SKL_SYNC.subs.forEach(f=>f());
}
function useSklSync(pull){
  useEffect(()=>{ SKL_SYNC.subs.add(pull); return ()=>SKL_SYNC.subs.delete(pull); },[]);
}
(function initSync(){
  // what is already in the demo store counts as saved, so opening a page never writes
  SKL_STORE.systemes.forEach(x=>{ SKL_SYNC.last["sys-"+x.id]=JSON.stringify(x); });
  SKL_SYNC.last.registers=JSON.stringify(SKL_STORE.regData);
  const start=()=>{ if(!window.SKL) return setTimeout(start,50); sklDbPull(); window.SKL.onChange(()=>sklDbPull()); };
  start();
})();

const SKL_CSS = `
.sy.sy-embed{
 --wine-900:#1B1B18;--wine-800:#2C2B26;--wine-700:#1B1B18;--wine-600:#B42318;
 --wine-500:#9A6614;--wine-300:#D9B46A;
 --bone:#F6F4EF;--bone-2:#FFFFFF;--bone-3:#EFECE4;
 --line:#E3DFD5;--line-2:#D8D3C7;
 --ink:#1B1B18;--ink-2:#5E5B53;--ink-3:#8E8A80;
 --grad:linear-gradient(135deg,#1B1B18,#34322C);
 --grad2:linear-gradient(135deg,#FBF6EC,#F4ECDD);
 --dark:linear-gradient(135deg,#2C2B26,#1B1B18);
 --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
 --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
 height:var(--screen-h,100vh);width:100%;display:flex;overflow:hidden}
.sy.sy-embed .sy-hud{padding-right:96px}
.sy.sy-embed .sy-delsys{display:none}
.sy.sy-embed .sy-tabs button[data-on="1"]{color:#7A4B00}
.sy.sy-embed .sy-tabs .tbn{margin-left:6px}
`;

function SklMech({sysId,onBack}){
  const u = SKL_STORE.ui[sysId] || (SKL_STORE.ui[sysId] = {});
  const [systemes,setSystemesRaw]=useState(SKL_STORE.systemes);
  const [regData,setRegDataRaw]=useState(SKL_STORE.regData);
  const setSystemes=f=>setSystemesRaw(p=>{const n=typeof f==="function"?f(p):f;SKL_STORE.systemes=n;setTimeout(sklDbPush,0);return n;});
  const setRegData=f=>setRegDataRaw(p=>{const n=typeof f==="function"?f(p):f;SKL_STORE.regData=n;setTimeout(sklDbPush,0);return n;});
  useSklSync(()=>{setSystemesRaw(SKL_STORE.systemes);setRegDataRaw(SKL_STORE.regData);});
  const keep=(k,init)=>{const [v,s]=useState(k in u?u[k]:init);
    return [v,x=>s(p=>{const n=typeof x==="function"?x(p):x;u[k]=n;return n;})];};
  const [vue,setVue]=keep("vue","schema");
  const [sel,setSel]=keep("sel","16");
  const [pop,setPop]=keep("pop",null);
  const [voirExpl,setVoirExpl]=keep("voirExpl",false);
  const [voirRegles,setVoirRegles]=keep("voirRegles",false);
  const [barPliee,setBarPliee]=keep("barPliee",false);
  const [fnOuv,setFnOuv]=keep("fnOuv","frame");
  const [filtre,setFiltre]=keep("filtre",{critique:true,attention:true,veille:true});
  const actif=sysId;

  const sys=systemes.find(s=>s.id===actif);
  const etape=Math.min(Math.max(0,(sys&&sys.etape)||0),BUILD_ET.length-1);
  const setEtape=n=>setSystemes(p=>p.map(x=>x.id===actif
    ?{...x,etape:Math.min(Math.max(0,typeof n==="function"?n(x.etape||0):n),BUILD_ET.length-1)}
    :x));
  const M=sys?sys.modele:{};
  const majM=fn=>setSystemes(p=>p.map(s=>s.id===actif?{...s,modele:fn(s.modele)}:s));
  const nEtapesOk=useMemo(()=>sys?BUILD_ET.filter((_,i)=>etatEtape(i,M,sys,regData).ok).length:0,[M,sys,regData]);
  const notifs=useMemo(()=>calcNotifs(M),[M]);
  const ign=useMemo(()=>carteIgnorance(M),[M]);
  const nCrit=notifs.filter(n=>n.sev==="critique").length;
  const nSocle=fonctionsCouvertes(M);
  const ecartTxt=useMemo(()=>{const e=ecart(M), o=obj(M,"02");
    return e===null?"not computable"
      :`${obj(M,"16").mesure} → ${o.cible} (${e>0?"+":""}${e})`;},[M]);

  const setCh=(id,k,v)=>majM(m=>({...m,[id]:{...obj(m,id),[k]:v}}));
  const setLi=(id,i,k,v)=>majM(m=>{const l=[...lst(m,id)];l[i]={...l[i],[k]:v};return{...m,[id]:l};});
  const addLi=id=>majM(m=>({...m,[id]:[...lst(m,id),{}]}));
  const delLi=(id,i)=>majM(m=>({...m,[id]:lst(m,id).filter((_,j)=>j!==i)}));
  const maj={setCh,setLi,addLi,delLi};
  const SEED_MODELE={"s-preappel":PREAPPEL,"s-vente":DEFAUT,"s-os-exec":OS_EXEC,"s-os-res":OS_RES};
  const srcSeed=SEED_MODELE[actif];
  const restaurer=srcSeed
    ? id=>majM(m=>({...m,[id]:JSON.parse(JSON.stringify(srcSeed[id]||[]))}))
    : null;
  const majReg={
    set:(r,i,k,v)=>setRegData(p=>{const l=[...p[r]];l[i]={...l[i],[k]:v};return{...p,[r]:l};}),
    add:r=>setRegData(p=>({...p,[r]:[...p[r],{}]})),
    seed:r=>setRegData(p=>({...p,[r]:(REG_SEED[r]||[]).map(x=>({...x}))})),
    del:(r,i)=>setRegData(p=>({...p,[r]:p[r].filter((_,j)=>j!==i)}))};
  const setType=t=>setSystemes(p=>p.map(x=>x.id===actif?{...x,type:t}:x));
  const ouvrirOrgane=id=>{setPop(null);setSel(id);setVue("organes");};

  if(!sys) return <div className="sy sy-embed"><style>{CSS+SKL_CSS}</style><div className="sy-empty">No mechanism selected.</div></div>;
  return (
  <div className="sy sy-embed">
    <style>{CSS+SKL_CSS}</style>
    <div className="sy-col">
          <div className="sy-hud">
            {onBack && <button className="sy-b sm" onClick={onBack}>← Map</button>}
            <span className="sy-rd">Mechanism <b>{sys.nom}</b> · {sys.type||"mechanism"}</span>
            <span className="sy-rd">Gap <b>{ecartTxt}</b></span>
            <span className="sy-rd">Ignorance <b>{ign.length}</b> point{ign.length>1?"s":""}</span>
            <span className="sy-rd">Functions <b>{nSocle}</b> / 5</span>
            <span className="sy-rd">Notifications <b>{notifs.length}</b>
              {nCrit>0?<> · <b>{nCrit} crit.</b></>:null}</span>
            <span className="sy-rd">Registers <b>{REG_CLES.map(k=>(regData[k]||[]).length).join(" · ")}</b></span>
            <div className="sy-sp"/>
            <div className="sy-tabs">
              <button data-on={vue==="build"?"1":"0"}
                onClick={()=>{setVue("build");setPop(null);}}>Build
                <i className="tbn" data-fait={nEtapesOk===BUILD_ET.length?"1":"0"}>
                  {String(nEtapesOk).padStart(2,"0")}/{BUILD_ET.length}</i></button>
              <button data-on={vue==="schema"?"1":"0"} onClick={()=>setVue("schema")}>Model</button>
              <button data-on={vue==="organes"?"1":"0"}
                onClick={()=>{setVue("organes");setPop(null);}}>Organs</button>
              <button data-on={vue==="pilotage"?"1":"0"}
                onClick={()=>{setVue("pilotage");setPop(null);}}>Control</button>
            </div>
          </div>

          {vue==="build" ? (
            <Assistant sys={sys} M={M} maj={maj} etape={etape} setEtape={setEtape}
              restaurer={restaurer} setType={setType} regData={regData} majReg={majReg}
              systemes={systemes} onControl={()=>setVue("pilotage")}/>
          ) : vue==="schema" ? (
            <div className="sy-schema">
              <div className="sy-bar" data-plie={barPliee?"1":"0"}>
                <div className="sy-bart">OUTSIDE THE MODEL — THEY FRAME, CONDITION OR ANNOTATE THE MECHANISM
                  <button className="sy-plier" onClick={()=>setBarPliee(v=>!v)}>
                    {barPliee?"show":"hide"}</button></div>
                <div className="sy-db">
                  {ORGANES.filter(x=>x.zone==="barre").map(x=>{const k=kpi(x.id,M);
                    const col=k.etat==="vide"?"var(--line-2)"
                            :k.etat==="alerte"?"var(--wine-600)":"var(--ink)";
                    return (
                      <div key={x.id} className="sy-dbt" data-etat={k.etat}
                        style={{"--fc":k.etat==="vide"?"var(--line-2)":couleurOrgane(x.id)}}
                        onClick={()=>setPop(x.id)}>
                        <span className="dp"/>
                        <div className="dl">{x.id} · {x.nom.toUpperCase()}</div>
                        <div className={"dv"+(k.txt?" txt":"")} style={{color:col}}>{k.v}</div>
                        <div className="ds">{k.sub}</div>
                      </div>);})}
                </div>
                <div className="sy-leg">
                  {Object.values(FAMT).map(f=>(
                    <span key={f.n}><i style={{background:f.c,height:8,width:8,borderRadius:2}}/>{f.n}</span>))}
                  <span style={{opacity:.4}}>│</span>
                  <span><i style={{background:"#9C8A84"}}/>matter flow</span>
                  <span><i style={{background:"#9C8A84",borderTop:"2px dashed #9C8A84",height:0}}/>return flow</span>
                  <span><i style={{background:"#9578A6",borderTop:"2px dashed #9578A6",height:0}}/>measurement</span>
                  <span><i style={{background:"#C39B4E",borderTop:"2px dashed #C39B4E",height:0}}/>command</span>
                  <span><i style={{background:"#B0572E",borderTop:"2px dotted #B0572E",height:0}}/>rule governing a flow</span>
                </div>
              </div>
              <div className="sy-cv">
                <Schema M={M} reg={regData} sysNom={sys.nom} restaurer={restaurer}
                  pop={estOrganeId(pop)?null:pop}
                  onPick={id=>setPop(p=>p===id?null:id)}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane} maj={maj}/>
              </div>
              {estOrganeId(pop) && (
                <PopEdit organId={pop} rowIdx={null} titre={OM[pop].nom} soustitre={OM[pop].ty}
                  couleur={couleurOrgane(pop)} M={M} maj={maj} reg={regData} sysNom={sys.nom}
                  restaurer={restaurer}
                  style={{top:14,right:18}}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane}/>)}
            </div>
          ) : vue==="pilotage" ? (
            <Pilotage notifs={notifs} ign={ign} filtre={filtre} setFiltre={setFiltre}
              onOuvrir={ouvrirOrgane}/>
          ) : (
            <div className="sy-view">
              <div className="sy-rail">
                <div className="sy-fam">THE FIVE FUNCTIONS</div>
                {FONCTIONS.map(([cle,nom,verbe])=>{
                  const liste=ORGANES.filter(o=>FN_KEY[o.fam]===cle);
                  const n=liste.filter(o=>estRempli(o,M)).length;
                  const ouvert=fnOuv===cle || liste.some(o=>o.id===sel);
                  return (
                    <div key={cle} className="sy-fnb" data-ouv={ouvert?"1":"0"}
                      style={{"--fc":FAMT[cle].c}}>
                      <button className="fnh" onClick={()=>setFnOuv(v=>v===cle?null:cle)}>
                        <b>{nom}</b><span>{verbe}</span>
                        <i data-ok={n>0?"1":"0"}>{n}/{liste.length}</i>
                        <em>{ouvert?"−":"+"}</em>
                      </button>
                      {ouvert && liste.map(x=>(
                        <button key={x.id} className="sy-o fnx" data-on={sel===x.id?"1":"0"}
                          onClick={()=>setSel(x.id)}>
                          <span className="no">{x.id}</span>
                          <span className="nm">{x.nom}</span>
                          <span className="dot" data-on={estRempli(x,M)?"1":"0"}/>
                        </button>))}
                    </div>);})}
                <div className="sy-railft">
                  Every organ serves exactly one of the five functions. A mechanism that leaves
                  one function unserved cannot be steered, whatever else is filled in.
                </div>
              </div>
              <Fiche o={OM[sel]} M={M} voirExpl={voirExpl} setVoirExpl={setVoirExpl}
                voirRegles={voirRegles} setVoirRegles={setVoirRegles} maj={maj} restaurer={restaurer}/>
            </div>
          )}
    </div>
  </div>);
}

const SKL_PAGES = {"s-preappel":"MechPrecall.dc.html","s-vente":"MechSales.dc.html","s-os-exec":"MechOS.dc.html","s-os-res":"MechOS.dc.html"};
function SklMap(){
  const [systemes,setSys]=useState(SKL_STORE.systemes);
  const [inline,setInline]=useState(SKL_STORE.ui.__mapInline||null);
  useSklSync(()=>setSys(SKL_STORE.systemes));
  const show=id=>{SKL_STORE.ui.__mapInline=id;setInline(id);};
  const aller=id=>{
    const href=SKL_PAGES[id];
    if(OS_IDS.indexOf(id)>=0) SKL_STORE.ui.__osActive=id;
    const a=href&&document.querySelector('a[href="'+href+'"]');
    if(a){a.click();return;}
    show(id);
  };
  const ui=id=>SKL_STORE.ui[id]||(SKL_STORE.ui[id]={});
  if(inline && SKL_STORE.systemes.some(s=>s.id===inline))
    return <SklMech sysId={inline} onBack={()=>{show(null);setSys(SKL_STORE.systemes);}}/>;
  return (
  <div className="sy sy-embed">
    <style>{CSS+SKL_CSS}</style>
    <div className="sy-col">
      <div className="sy-hud">
        <span className="sy-rd">Map <b>{CATALOG.length} mechanisms</b></span>
        <span className="sy-rd">Modelled <b>{systemes.length}</b></span>
        <span className="sy-rd">Domains <b>4</b></span>
        <span className="sy-live"><i className="sy-dot"/>
          <span className="sy-rd">tech tree</span></span>
      </div>
      <CarteMecanismes systemes={systemes} decisions={[]}
        onCreer={nom=>{const id=uid();
          SKL_STORE.systemes=[...SKL_STORE.systemes,{id,nom,type:"chain",modele:{}}];
          Object.assign(ui(id),{vue:"organes",sel:"16",pop:null});
          setSys(SKL_STORE.systemes);sklDbPush();show(id);}}
        onOuvrir={id=>{Object.assign(ui(id),{vue:"schema",pop:null});aller(id);}}
        onCycle={id=>{Object.assign(ui(id),{vue:"pilotage",pop:null});aller(id);}}/>
    </div>
  </div>);
}

/* One page, two mechanisms: a switch sits on the tabs row, the mechanism below keeps its own state. */
function SklMechSwitch({ids}){
  const [cur,setCur]=useState(SKL_STORE.ui.__osActive&&ids.indexOf(SKL_STORE.ui.__osActive)>=0?SKL_STORE.ui.__osActive:ids[0]);
  useEffect(()=>{const t=setInterval(()=>{const a=SKL_STORE.ui.__osActive;if(a&&a!==cur&&ids.indexOf(a)>=0)setCur(a);},300);return ()=>clearInterval(t);},[cur]);
  const pick=id=>{SKL_STORE.ui.__osActive=id;setCur(id);};
  const nom=id=>(SKL_STORE.systemes.find(s=>s.id===id)||{}).nom||id;
  return (<div style={{display:"flex",flexDirection:"column",width:"100%",height:"100%"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 24px",borderBottom:"1px solid #E4DFD4",background:"#F7F5F0",flexShrink:0}}>
      <span style={{fontSize:12,letterSpacing:".06em",textTransform:"uppercase",color:"#5E5B53"}}>Two mechanisms, one per clock</span>
      <div role="group" aria-label="Mechanism" style={{display:"flex",gap:4,padding:4,background:"#ECE8DF",borderRadius:10}}>
      {ids.map(id=>(<button key={id} onClick={()=>pick(id)} style={{border:0,borderRadius:7,padding:"7px 14px",font:"inherit",fontSize:13,cursor:"pointer",whiteSpace:"nowrap",
        background:cur===id?"#1B1B18":"transparent",color:cur===id?"#FFFFFF":"#3D3A33",fontWeight:cur===id?600:500}}>{nom(id)}</button>))}
      </div></div>
    <div style={{flex:1,minHeight:0,position:"relative"}}><SklMech key={cur} sysId={cur}/></div>
    </div>);
}

window.SKLMech = {
  mount(scope){
    (scope||document).querySelectorAll("[data-mech]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      const ids=el.getAttribute("data-mech").split("|");
      el.__sklRoot.render(ids.length>1?<SklMechSwitch ids={ids}/>:<SklMech sysId={ids[0]}/>);
    });
    (scope||document).querySelectorAll("[data-mechmap]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      el.__sklRoot.render(<SklMap/>);
    });
  }
};

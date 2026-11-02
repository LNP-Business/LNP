
/* ================== SKL OS EMBED ==================
   The editor's own mechanism workspace — HUD, Build, Model, Organs, Control — mounted inside SKL OS.
   State lives in a module store so it survives the host page re-rendering its frame. */

/* ================== THE OPERATING SYSTEM, MODELLED AS A MECHANISM ==================
   Built with the Iteration-system method that produced Pre-call: same 21 organs, same rules.
   It is a SYSTEM, not a chain: an alert left open escalates, the decision it forces changes the plan,
   and the plan produces the next alerts. Effects come back onto their causes.
   Unit of matter: one deviation (an alert raised by the rules in Settings). Period: one week. */
const SKLOS = {
 "01":[{type:"start",nom:"A rule detects a deviation: a key result drifts or goes unchecked, a task blocks or slips, a decision passes its date, someone goes over 70 % load"},
       {type:"end",nom:"The deviation is closed by the data: the task is unblocked, the key result checked in, the decision taken"},
       {type:"end",nom:"The deviation is turned into a decision that changes the plan, a target or an owner"},
       {type:"end",nom:"The deviation expires unhandled and is only read at the quarter close"}],
 "02":{metrique:"Deviations closed within 7 days",cible:85,unite:"% of alerts raised",plancher:70,horizon:"one quarter"},
 "03":{sacrifie:"When the week fills up, the Friday review is cut to the scoreboard and alert triage is skipped first; check-ins slip before tasks do",
       revele:"Keep execution moving (tasks shipped), not keep the plan true. Activity is protected, correction is what gives way"},
 "04":[{nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,preuve:"benchmark"},
       {nom:"Friday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,preuve:"measured"},
       {nom:"Team planned load",nature:"throughput",unite:"h/7 days",borne:82,charge:62,seuil:57,preuve:"measured"},
       {nom:"Lead available to receive escalations",nature:"presence",unite:"person",borne:1,charge:1,seuil:7,preuve:"measured"}],
 "05":{nom:"Romain · CPO",
       autorite:"Alert rules and thresholds, the escalation delay, the KR colour rule, the Friday review agenda, who owns each alert",
       refus:"yes"},
 "06":[{nom:"Deviations raised by the alert rules",volume:24,unite:"per week",
        varia:"±8 · doubles in a launch week",source:"Every steered mechanism, through check-ins, tasks, decisions and load"}],
 "07":[{nom:"A launch week pulls everyone into execution",gravite:"high",obs:"yes"},
       {nom:"Check-ins entered late or not at all",gravite:"high",obs:"yes"},
       {nom:"The lead is away: escalations have no receiver",gravite:"high",obs:"yes"},
       {nom:"A key result or objective is added mid-quarter",gravite:"medium",obs:"yes"},
       {nom:"Shared database unavailable",gravite:"low",obs:"no"}],
 "08":[{nom:"Open alerts",niveau:12,rotation:2,unite:"alerts"},
       {nom:"Decisions waiting",niveau:8,rotation:5,unite:"decisions"}],
 "09":[{nom:"Triage",de:"Deviations raised by the alert rules",vers:"Open alerts",debit:24,unite:"/wk"},
       {nom:"Fixed at the source",de:"Open alerts",vers:"Closed by the data",debit:15,unite:"/wk"},
       {nom:"Expired unhandled",de:"Open alerts",vers:"Expired unhandled",debit:2,unite:"/wk"},
       {nom:"Escalated or framed as a decision",de:"Open alerts",vers:"Decisions waiting",debit:7,unite:"/wk"},
       {nom:"Decided",de:"Decisions waiting",vers:"Decision taken",debit:7,unite:"/wk"},
       {nom:"Read but not acted on",de:"Open alerts",vers:"Alert fatigue: alerts read but not acted on",debit:3,unite:"/wk"},
       {nom:"Leads' triage time",de:"Decisions waiting",vers:"Leadership time spent on escalations",debit:150,unite:"min/wk"},
       {nom:"The decision changes the plan, which raises or removes the next deviations",de:"Decision taken",vers:"Deviations raised by the alert rules",debit:7,unite:"/wk"}],
 "10":[{nom:"Closed by the data",valeur:15,dest:"The steered mechanisms (task unblocked, KR checked in)",induite:"no"},
       {nom:"Decision taken",valeur:7,dest:"Roadmap and Decisions (plan, target or owner changed)",induite:"no"},
       {nom:"Expired unhandled",valeur:2,dest:"Quarter close (lesson only)",induite:"no"},
       {nom:"Leadership time spent on escalations",valeur:150,dest:"Founder's attention",induite:"yes"},
       {nom:"Alert fatigue: alerts read but not acted on",valeur:3,dest:"Trust in the OS",induite:"yes"}],
 "11":[{nom:"Escalation delay for Critical and High alerts (24 h)",
        agit:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",
        acteur:"Romain"},
       {nom:"KR colour thresholds (landing below 90 % = red)",
        agit:"Escalation converts about 3 in 4 escalated alerts into a decision within the week",
        acteur:"Romain"},
       {nom:"Stale check-in threshold (7 days)",
        agit:"When the review skips triage, open alerts grow by about 30 % the next week",
        acteur:"Romain"},
       {nom:"Planned load ceiling (70 %) and 3 tasks in progress per person",
        agit:"Above 70 % planned load, blocked time doubles and alerts per person rise sharply",
        acteur:"Romain"},
       {nom:"Snooze allowed once per alert",
        agit:"A second snooze ends in expiry three times out of four",
        acteur:"Romain"}],
 "12":[{nom:"Weekly cadence, review on Friday",raison:"Matches the delay of the slowest steered loop and the team's rhythm",
        degel:"If more than 30 % of alerts wait over 7 days for the review, three weeks running"},
       {nom:"Medium and Low alerts never escalate",raison:"Protect the leads' triage time",
        degel:"If a Medium alert stays open over 14 days three times in a quarter"},
       {nom:"Quarter of 13 weeks, mid-point at W6",raison:"Same clock as the objectives",
        degel:"If two key results are rewritten mid-quarter"},
       {nom:"Tasks capped at 8 h, unknown work as a timeboxed exploration",raison:"Keeps cycle time readable",
        degel:"If cycle time stays above 5 days for 4 weeks"}],
 "13":[{nom:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",
        porte:"Fixed at the source",nonlin:"yes",usage:"intervene"},
       {nom:"Escalation converts about 3 in 4 escalated alerts into a decision within the week",
        porte:"Escalated or framed as a decision",nonlin:"no",usage:"predict"},
       {nom:"When the review skips triage, open alerts grow by about 30 % the next week",
        porte:"Triage",nonlin:"yes",usage:"intervene"},
       {nom:"Above 70 % planned load, blocked time doubles and alerts per person rise sharply",
        porte:"Expired unhandled",nonlin:"yes",usage:"intervene"},
       {nom:"A second snooze ends in expiry three times out of four",
        porte:"Expired unhandled",nonlin:"yes",usage:"intervene"},
       {nom:"A decision taken within its lead time unblocks about 2 tasks",
        porte:"Decided",nonlin:"no",usage:"predict"}],
 "14":{processus:4,capteur:3},
 "15":[{nom:"Alert log",mesure:"Closed by the data",latence:0,bruit:3,unite:"pts of closure rate",
        saisie:"Automatic: an alert closes when the data behind it is fixed"},
       {nom:"Decision log",mesure:"Decision taken",latence:1,bruit:2,unite:"pts of closure rate",
        saisie:"The decision owner, when the decision moves to Decided"},
       {nom:"Alert rules",mesure:"Open alerts",latence:0,bruit:3,unite:"alerts",
        saisie:"Automatic, computed from check-ins, tasks, decisions and load"}],
 "16":{mesure:74,fenetre:2},
 "17":{cadence:7,bande:5,gain:1,
       inaction:"Nothing. Rules and thresholds stay as they are; alerts keep flowing to their owners and the Friday review only reads the number."},
 "18":[{nom:"Alert open > 24 h → escalated to the lead → decision taken → task unblocked → alert closed",type:"balancing",delai:3},
       {nom:"Load > 70 % → tasks late → more alerts → more triage time → less time to execute → load ↑",type:"reinforcing",delai:14},
       {nom:"Commitments kept ↑ → trust in the review ↑ → check-ins on time ↑ → earlier signals → commitments kept ↑",type:"reinforcing",delai:28},
       {nom:"KR off track → recovery plan → actions added → load ↑ → pace ↓",type:"balancing",delai:21}],
 "19":[{valeur:"Open alerts and decisions waiting",niveau:"measured",date:"live in the OS"},
       {valeur:"Promises kept 72 % at the weekly review",niveau:"measured",date:"3 reviews"},
       {valeur:"Planned load 76 % for the team",niveau:"measured",date:"live in My Day"},
       {valeur:"70 % load ceiling before blocked time doubles",niveau:"benchmark",date:"flow literature"},
       {valeur:"Escalation converts 3 in 4 into a decision",niveau:"hunch",date:"—"},
       {valeur:"Cycle time 3.4 days, decision speed",niveau:"hunch",date:"sample data until phase 4"}],
 "20":[{nom:"Alert closure time does not depend on who owns the alert",
        test:"Compare closure time by owner over one quarter"},
       {nom:"A 30-minute review corrects as well as a 45-minute one",
        test:"Alternate 30 and 45 minute reviews over 6 weeks, compare commitments kept"},
       {nom:"Escalation speed does not depend on the day of the week",
        test:"Cross escalation-to-decision time with the weekday the alert fired"}],
 "21":[{nom:"The steered mechanisms themselves (Pre-call, Sales, Content…)",raison:"Different owners, their own clocks: the OS steers them, it does not run them",
        signal:"If more than half of the alerts come from one mechanism three weeks running"},
       {nom:"Setting the objectives of the quarter",raison:"A 13-week clock, slower than weekly steering",
        signal:"If a key result is rewritten twice in a quarter"},
       {nom:"People performance",raison:"Belongs to the People mechanisms",
        signal:"If load alerts concentrate on one person four weeks running"}]
};
CATALOG.push({id:"opsys",nom:"Operating System",lane:6,col:2,
  quoi:"Steers every other mechanism: key results, check-ins, alerts, decisions and the weekly review. It turns deviations into decisions on time.",
  pre:["tools"]});
const OS_REG = {
 interfaces:[
  {point:"Deviations raised (alerts)",de:"Every steered mechanism",part:"100 %",vers:"Operating System",mode:"duplication",debit:24,unite:"week",
   def:"Raised by the alert rules from check-ins, tasks, decisions and load"},
  {point:"Decisions taken",de:"Operating System",part:"100 %",vers:"Roadmap · every key result",mode:"duplication",debit:7,unite:"week",
   def:"A decision changes a plan, a target or an owner"},
  {point:"Leadership time on escalations",de:"Operating System",part:"100 %",vers:"Founder's attention",mode:"duplication",debit:150,unite:"week (minutes)",
   def:"Induced output — the cost of steering, paid by the leads"}],
 ressources:[
  {nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,puisent:"Operating System",
   note:"CONFIRM — the same two people as Founder's attention"},
  {nom:"Friday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,puisent:"Operating System",note:"45-minute agenda, 6 steps"}],
 evenements:[
  {date:"1 Oct 2026",nom:"Inbox merged into My Day",rompt:"Alert handling times before and after are not comparable",rouages:"Operating System"},
  {date:"1 Oct 2026",nom:"KR colour rule moved to the forecast",rompt:"Status history: reds before this date read differently",rouages:"Operating System"},
  {date:"1 Oct 2026",nom:"Roadmap rebuilt: review and builder",rompt:"How milestones and actions are created",rouages:"Operating System"}],
 acteurs:[
  {nom:"Romain",role:"CPO · owns the Operating System",leviers:"Alert rules and thresholds · escalation delay · KR colour rule · review agenda",
   rouages:"Operating System",note:"",refus:"yes"},
  {nom:"Amin",role:"CEO · receives escalations when Romain owns the alert",leviers:"Priorities · the objectives of the quarter",
   rouages:"Operating System",note:"",refus:"yes"}]
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
    {id:"s-os",nom:"Operating System",type:"mechanism",etape:9,modele:SKLOS}]),
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
    if(d.id.indexOf("sys-")!==0 || !val || !val.id) return;
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
  const SEED_MODELE={"s-preappel":PREAPPEL,"s-vente":DEFAUT,"s-os":SKLOS};
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

const SKL_PAGES = {"s-preappel":"MechPrecall.dc.html","s-vente":"MechSales.dc.html","s-os":"MechOS.dc.html"};
function SklMap(){
  const [systemes,setSys]=useState(SKL_STORE.systemes);
  const [inline,setInline]=useState(SKL_STORE.ui.__mapInline||null);
  useSklSync(()=>setSys(SKL_STORE.systemes));
  const show=id=>{SKL_STORE.ui.__mapInline=id;setInline(id);};
  const aller=id=>{
    const href=SKL_PAGES[id];
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

window.SKLMech = {
  mount(scope){
    (scope||document).querySelectorAll("[data-mech]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      el.__sklRoot.render(<SklMech sysId={el.getAttribute("data-mech")}/>);
    });
    (scope||document).querySelectorAll("[data-mechmap]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      el.__sklRoot.render(<SklMap/>);
    });
  }
};

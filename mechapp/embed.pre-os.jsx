
/* ================== SKL OS EMBED ==================
   The editor's own mechanism workspace — HUD, Build, Model, Organs, Control — mounted inside SKL OS.
   State lives in a module store so it survives the host page re-rendering its frame. */
const SKL_STORE = {
  systemes: normSys([
    {id:"s-preappel",nom:"Pre-call",type:"mechanism",modele:PREAPPEL},
    {id:"s-vente",nom:"Sales",type:"mechanism",modele:DEFAUT}]),
  regData: regSemer(null),
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
    if(d.id==="registers"){ SKL_STORE.regData=val; changed=true; return; }
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
  const SEED_MODELE={"s-preappel":PREAPPEL,"s-vente":DEFAUT};
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

const SKL_PAGES = {"s-preappel":"MechPrecall.dc.html","s-vente":"MechSales.dc.html"};
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

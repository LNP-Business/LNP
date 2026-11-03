"""Cockpit › Sales, one screen: the approved proposal (proposal/sales-cockpit-v2.html) turned into a module
that SKL OS mounts in a shadow root under the Cockpit tabs. Writes sales_v2.json = {css, html, js}."""
import json, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
src = (HERE.parent / 'proposal' / 'sales-cockpit-v2.html').read_text(encoding='utf-8')

# ---- css: keep the dashboard rules, drop page, sidebar, proposal badge; tooltips live outside the shadow root ----
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
css = css.replace(':root{', ':host{')
drop = [r'\*\{box-sizing:border-box\}', r'html,body\{[^}]*\}', r'#stage\{[^}]*\}', r'/\* sidebar replica \*/', r'nav\{[^}]*\}',
        r'\.logo\{[^}]*\}\.logo span\{[^}]*\}', r'\.sys\{[^}]*\}', r'\.sys span\{[^}]*\}\.sys \.on\{[^}]*\}', r'\.grp\{[^}]*\}\.grp\+\.grp,\.it\+\.grp\{[^}]*\}',
        r'\.it\{[^}]*\}\.it\.on\{[^}]*\}', r'\.it b\{[^}]*\}', r'#tip\{[^}]*\}', r'#toast\{[^}]*\}', r'\.note\{[^}]*\}', r'/\* proposal note \*/', r'/\* tooltip \*/']
for d in drop:
    css, n = re.subn(d, '', css)
    assert n, d
css = css.replace('main{flex:1;min-width:0;padding:18px 24px 20px;display:grid;grid-template-rows:auto 1fr 1fr;gap:14px}',
                  '.sv{position:relative;height:100%;display:grid;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:14px}')
assert '.sv{' in css
css = css.replace('.top{display:flex;align-items:center;gap:16px;min-width:0}',
                  '.top{position:absolute;right:40px;top:-82px;height:54px;display:flex;align-items:center;gap:14px}')
css = (':host{display:block;position:relative;height:calc(var(--screen-h, 900px) - 162px);min-height:620px;font-family:var(--sans);color:var(--ink)}'
       '*{box-sizing:border-box}' + css)

# ---- markup: the dashboard without the sidebar and without the Cockpit tabs (the page has them) ----
body = re.search(r'<main>(.*?)</main>', src, re.S).group(1)
body = re.sub(r'\s*<div class="seg" id="tabs".*?</div>\n', '\n', body, flags=re.S)
body = body.replace('<span class="sp"></span>', '')
html = '<div class="sv">' + body + '</div>'

# ---- script: same logic, reading the shadow root, the shared key result, and talking to the CRM ----
js = re.search(r'<script>(.*?)</script>', src, re.S).group(1)
js = js.replace('const KR={name:"50 k€ encaissés",cur:12000,exp:15000,target:50000,status:"Orange"}; // SKL key result, from Roadmap\n', '')
js = js.replace('const el=(id)=>document.getElementById(id);\nconst tip=el("tip");',
                'const el=(id)=>R.getElementById(id);\nconst tip=TIP;')
js = js.replace('function toast(m){const t=el("toast");', 'function toast(m){const t=TOAST;')
# team rows open the CRM on that sales rep; "See all alerts" opens the CRM alerts
js = js.replace('b.onclick=()=>toast("Ouvre le CRM filtré sur "+SALES.find(s=>s.id===b.dataset.id).name)',
                'b.onclick=()=>window.postMessage({skl:"crm",owner:b.dataset.id},"*")')
js = js.replace('''<button class="lnk" onclick="toast('Ouvre toutes les alertes dans le CRM')">Voir toutes les alertes →</button>''',
                '''<button class="lnk" data-allalerts>Voir toutes les alertes →</button>''')
js = js.replace('  bindTips(el("al"));', '  bindTips(el("al"));\n  const aa=el("al").querySelector("[data-allalerts]"); if(aa) aa.onclick=()=>window.postMessage({skl:"crm",view:"alerts"},"*");')
# the key result comes from the shared database (Roadmap), owned by Sales
old_kr = js[js.index('    <div class="kr" data-tip='):js.index('</div></div>`;\n  bindTips(el("pipe"));')] + '</div></div>`;'
new_kr = '''    ${krBox()}`;'''
js = js.replace(old_kr, new_kr)
js = js.replace('/* ---- 5. Cash at risk', r'''function krBox(){
  const SK=window.SKL; if(!SK) return "";
  const k=SK.list("krs").find(x=>x.owner==="sales"); if(!k) return "";
  const v=SK.krView(k), fm=x=>SK.fmtVal(x,k.unit), span=(Number(k.target)-Number(k.baseline))||1;
  const w=Math.max(0,Math.min(100,(Number(k.current)-Number(k.baseline))/span*100)), e=Math.max(0,Math.min(100,(Number(k.expected)-Number(k.baseline))/span*100));
  return `<div class="kr" data-kr="${k.id}" style="cursor:pointer" data-tip="Résultat clé commercial : ${fm(k.current)} sur ${fm(k.target)}. Attendu à date : ${fm(k.expected)}. Cliquer pour l’ouvrir."><div class="l"><span>Résultat clé</span><b>${v.label} · ${v.ratio}</b></div><div class="v">${k.name} : <strong>${fm(k.current)}</strong> <span style="color:#C9C4B7">· attendu ${fm(k.expected)}</span></div><div class="krbar"><i style="width:${w}%"></i><u style="left:${e}%"></u></div></div>`;
}

/* ---- 5. Cash at risk''')
js = js.replace('  bindTips(el("pipe"));', '  bindTips(el("pipe"));\n  const kb=el("pipe").querySelector("[data-kr]"); if(kb) kb.onclick=()=>window.SKL&&SKL.openKr(kb.dataset.kr);')
js = js.replace('const box=el("flow"), W=box.clientWidth, H=box.clientHeight;', 'const box=el("flow"), W=box.clientWidth, H=box.clientHeight;\n  if(W<200||H<120)return;')
assert 'if(W<200' in js
# no page fit: the host fills the cockpit; redraw when the size changes
js = re.sub(r'/\* fit the 1440 × 900 screen.*$', '', js, flags=re.S)
js = ('(function(R,TIP,TOAST){\n' + js + '\nrender();\nif(document.fonts)document.fonts.ready.then(render);\n'
      'let rw=0;new ResizeObserver(()=>{const w=R.host.clientWidth+"x"+R.host.clientHeight;if(w!==rw){rw=w;render()}}).observe(R.host);\n'
      'return {render};\n})')
for must in ['R.getElementById', 'krBox()', 'postMessage({skl:"crm",owner', 'view:"alerts"']:
    assert must in js, must
# ---- live figures (web edition): crm_sales_cockpit() through SKL_CRM.salesCockpit(); the sample stays for the Artifact and demo ----
LIVE = r"""
let LIVE=null; const SALES0=SALES, ALERTS0=ALERTS, PAL=["#1B1B18","#7A4B00","#9A6614","#3D3A33","#5E5B53"];
// a rate with nothing to divide is not measured (NaN, shown "—"); cash and amounts are not measured until the CRM has payments / deals
const rt=(x,y)=>Number(y)?Number(x)/Number(y):NaN;
function liveFig(o){const P=LIVE.has_payments,D=LIVE.has_deals;return {sales:+o.won,cash:P?+o.cash:NaN,cpc:P?rt(o.cash,o.held):NaN,show:(o.shown_leads!=null?rt(o.shown_leads,+o.shown_leads+ +o.no_show_leads):rt(o.held,+o.held+ +o.no_show))*100,
  refund:P?rt(o.refunded,o.received)*100:NaN,aov:D?rt(o.signed,o.deals):NaN}}
function liveK(p){const n=LIVE.periods[p].now,a=liveFig(n),z=liveFig(LIVE.periods[p].base);
  return {sales:[a.sales,z.sales],cash:[a.cash,z.cash],cpc:[a.cpc,z.cpc],show:[a.show,z.show],refund:[a.refund,z.refund],aov:[a.aov,z.aov],
    funnel:[+n.leads,+n.booked,+n.held,+n.won],pond:+LIVE.pipeline,close:rt(n.won,n.held)*100,upfront:LIVE.has_payments&&+n.signed?rt(n.cash,n.signed)*100:NaN,
    follow:rt(n.follow_done,n.follow_total)*100,velo:n.days_per_stage==null?NaN:+n.days_per_stage,noOutcome:+n.no_outcome||0}}
function liveTeam(p){return LIVE.team[p].map((t,i)=>{const f=t.figures,nm=t.name&&t.name!=="Unassigned"?t.name:"Non attribué";return {id:t.id,name:nm,ini:nm.split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase(),
  color:PAL[i%PAL.length],calls:+f.held,won:+f.won,close:rt(f.won,f.held)*100,cpc:LIVE.has_payments?rt(f.cash,f.held):NaN,cash:LIVE.has_payments?+f.cash:0,show:(f.shown_leads!=null?rt(f.shown_leads,+f.shown_leads+ +f.no_show_leads):rt(f.held,+f.held+ +f.no_show))*100,booked:+f.booked}})
  .filter(s=>s.calls||s.won||s.cash||s.booked)}
// the few English words the SQL adds to the live alerts (overdue next move, stage name), shown in French
const STG={Show:"Présence",Decision:"Décision",Cash:"Encaissement",Won:"Gagné",Lost:"Perdu"};
const frTxt=t=>String(t==null?"":t).replace(/ · overdue$/," · en retard").replace(/ · (Show|Decision|Cash|Won|Lost)$/,(m,x)=>" · "+STG[x]);
function liveWeekly(k){return LIVE.weekly.map(w=>{const v=k==="cpc"?rt(w.cash,w.held):k==="aov"?rt(w.signed,w.deals):rt(w.refunded,w.received)*100;return isFinite(v)?v:0})}
"""
js = js.replace('const SALES=[', 'let SALES=[').replace('const ALERTS=[', 'let ALERTS=[')
js = js.replace('const S={period:30};', 'const S={period:30};\n' + LIVE)
js = js.replace('  const K=KPI.all, f=PF[S.period], C=criteria(K,f);',
  '  const K=LIVE?liveK(S.period):KPI.all, f=LIVE?1:PF[S.period], C=criteria(K,f);\n'
  '  SALES=LIVE?liveTeam(S.period):SALES0; ALERTS=LIVE?LIVE.alerts.map(a=>({c:a.c==="next"?"SLA":a.c,o:a.o,imp:+a.imp,t:frTxt(a.t),obj:frTxt(a.obj)})):ALERTS0;')
js = js.replace('    const ser=series(x.v,x.b,i+2),', '    const ser=LIVE?liveWeekly(["cpc","aov","refund"][i]):series(x.v,x.b,i+2),')
# empty periods and no baseline yet: no NaN, no division by zero
js = js.replace('const pc=(x,d=0)=>(Math.round', 'const pc=(x,d=0)=>!isFinite(x)?"—":(Math.round')
js = js.replace('const nf=x=>Math.round(x)', 'const nf=x=>!isFinite(x)?"—":Math.round(x)')
js = js.replace('const money=x=>nf(x)+"\\u00a0€";', 'const money=x=>!isFinite(x)?"—":nf(x)+"\\u00a0€";')
js = js.replace('const moneyK=x=>x>=1000', 'const moneyK=x=>!isFinite(x)?"—":x>=1000')
# a criterion with no measure: neither pass nor fail, said so in the gate
js = js.replace('d.forEach(x=>{x.ratio=x.inv?x.b/x.v*100:x.v/x.b*100;x.tone=tone(x.ratio)});',
  'd.forEach(x=>{x.nd=!isFinite(x.v)||!isFinite(x.b)||(!x.b&&!x.v);x.ratio=x.nd?NaN:x.inv?(x.v?x.b/x.v*100:100):(x.b?x.v/x.b*100:100);x.tone=x.nd?"a":tone(x.ratio)});')
js = js.replace('  const below=Object.values(C).filter(x=>x.ratio<100);\n  const fail=below.length>0;',
  '  const below=Object.values(C).filter(x=>x.ratio<100), nd=Object.values(C).filter(x=>x.nd);\n  const fail=below.length>0;')
js = js.replace('${fail?below.length+" sur 6 sous la référence":"6 sur 6 à la référence"}</span>`;',
  '${fail?below.length+" sur 6 sous la référence":nd.length?(6-nd.length)+" sur 6 à la référence · "+nd.length+(nd.length>1?" non mesurés":" non mesuré"):"6 sur 6 à la référence"}</span>`;')
js = js.replace('"Ventes gagnées, taux de présence et montant encaissé sont marqués dans le flux, les trois autres dans la rentabilité unitaire.");',
  '(nd.length?"Pas encore mesuré : "+nd.map(x=>x.l.toLowerCase()).join(", ")+" (pas encore de données dans le CRM). ":"")+"Ventes gagnées, taux de présence et montant encaissé sont marqués dans le flux, les trois autres dans la rentabilité unitaire.");')
js = js.replace('>${pc(x.crit.ratio)} de la réf.</text></g>`;', '>${x.crit.nd?"non mesuré":pc(x.crit.ratio)+" de la réf."}</text></g>`;')
js = js.replace('  L.forEach((x,i)=>{\n    const box=el("uec"+i), W=box.clientWidth, H=box.clientHeight; if(W<80||H<40) return;',
  '  L.forEach((x,i)=>{\n    const box=el("uec"+i), W=box.clientWidth, H=box.clientHeight; if(W<80||H<40) return;\n    if(x.nd){box.innerHTML=`<p style="margin:14px 0 0;font-size:12px;color:var(--mut)">Pas encore mesuré : ${i===1?"aucune vente avec un montant":"aucun paiement"} dans le CRM.</p>`;return}')
js = js.replace('${sg}${pc(Math.abs(dv))} vs réf.</span>', '${x.nd?"non mesuré":sg+pc(Math.abs(dv))+" vs réf."}</span>')
js = js.replace('{v:fn[2]/fn[1]*100,l:"présence",t:"Taux de présence",crit:C.show}', '{v:LIVE?K.show[0]:fn[2]/fn[1]*100,l:"présence",t:"Taux de présence",crit:C.show}')
js = js.replace('{v:fn[3]/fn[2]*100,l:"conversion",t:"Taux de conversion"}', '{v:LIVE?K.close:fn[3]/fn[2]*100,l:"conversion",t:"Taux de conversion"}')
js = js.replace('el("verdict").innerHTML=`<span class="vbadge ${fail?"fail":"pass"}">${fail?"ÉCHEC":"VALIDÉ"}</span>',
  'el("verdict").innerHTML=`<span class="vbadge ${fail?"fail":nd.length?"":"pass"}"${!fail&&nd.length?\' style="background:#ECE8DF;color:#5E5B53"\':""}>${fail?"ÉCHEC":nd.length?"EN ATTENTE":"VALIDÉ"}</span>')
js = js.replace('const hc=h*(K.upfront/100);', 'const hc=h*((isFinite(K.upfront)?K.upfront:0)/100);')
js = js.replace('<span class="val ${K.velo>8?"a":"g"}">${K.velo} j</span>', '<span class="val ${K.velo>8?"a":"g"}">${isFinite(K.velo)?String(K.velo).replace(".",",")+" j":"—"}</span>')
js = js.replace("  el(\"alq\").innerHTML=", "  if(LIVE&&!L.length){el(\"alq\").innerHTML=\"0 alerte\";el(\"al\").innerHTML=`<p style=\"color:var(--mut);font-size:13px;margin:8px 0\">Rien à risque pour l’instant : aucune alerte ouverte et aucune prochaine étape en retard.</p>`;return}\n  el(\"alq\").innerHTML=")
js = js.replace('const hOf=v=>Math.max(10,hMax*Math.sqrt(v/fn[0]));', 'const hOf=v=>Math.max(10,hMax*Math.sqrt(Math.min(1,v/(Math.max(...fn)||1))));')
js = js.replace('  const mx=Math.max(...t.map(s=>s.cash));', '  const mx=Math.max(1,...t.map(s=>s.cash));\n  if(!t.length){el("team").innerHTML=`<p style="color:var(--mut);font-size:13px;margin:8px 0">Aucune activité commerciale sur cette période.</p>`;return}')
js = js.replace('  const fc=K.pond*K.upfront/100, w=fc/K.pond*100;', '  const fc=K.pond*K.upfront/100, w=K.pond?fc/K.pond*100:0;')
js = js.replace('s.name.split(" ")[0]:"Direction"}', 's.name.split(" ")[0]:(LIVE?"Non attribué":"Direction")}').replace('${s?s.name:"Direction"}', '${s?s.name:(LIVE?"Non attribué":"Direction")}')
js = js.replace('${i===0?"entrés":i===1?"à l’agenda":"réalisés"}', '${i===0?"entrés":i===1?"à l’agenda":(LIVE&&K.noOutcome?"réalisés · "+nf(K.noOutcome)+" sans issue":"réalisés")}')
js = js.replace('  el("flowq").textContent=`${PL[S.period]} · réf. marquée sur ventes, présence et encaissé`;',
  '  el("flowq").textContent=`${PL[S.period]} · réf. = les ${PL[S.period]} d’avant · ${LIVE?"CRM en direct":"exemple"}`;')
for must in ['LIVE?K.show[0]', 'LIVE?K.close', 'EN ATTENTE', 'x.nd?"non mesuré"', 'x.nd=!isFinite', 'isFinite(K.upfront)', 'isFinite(K.velo)', 'non mesuré', 'Rien à risque', 'LIVE?liveK', 'liveWeekly(["cpc"', 'isFinite(x)', 'Math.max(...fn)', 'Aucune activité commerciale', 'K.pond?fc', 'sans issue', 'CRM en direct', 'Pas encore mesuré : "+nd', 'non mesurés', 'nf(x)+"\\u00a0€"', 'Non attribué":"Direction"']:
    assert must in js, must
# in the web edition the sample never shows: a cover says the live figures are loading, or why they did not load (Retry)
js = js.replace('function render(){', '''function cover(msg,retry){let c=R.getElementById("livecover");if(!msg){if(c)c.remove();return}
  if(!c){c=document.createElement("div");c.id="livecover";c.setAttribute("role","status");c.style.cssText="position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:12px;background:var(--bg);font-size:14px;color:var(--mut)";R.querySelector(".sv").appendChild(c)}
  c.textContent=msg;if(retry){const b=document.createElement("button");b.textContent="Réessayer";b.style.cssText="font:inherit;font-weight:600;border:1px solid #D8D3C7;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer;color:var(--ink)";b.onclick=()=>{cover("Chargement des chiffres en direct…");loadLive()};c.appendChild(b)}}
function render(){''',1)
js = js.replace('\nrender();\nif(document.fonts)', '\nconst WEB=!!(window.claude&&window.claude.web);\n'
  'function loadLive(){const C=window.SKL_CRM;if(!C||!C.salesCockpit)return;C.ready().then(()=>{if(C.mode()!=="live")return;'
  'return C.salesCockpit().then(d=>{if(!d||!d.periods)throw new Error("aucun chiffre reçu");LIVE=d;cover(null);render()})}).catch(e=>{console.error("sales cockpit",e);if(!LIVE)cover("Les chiffres en direct ne se sont pas chargés ("+String(e&&e.message||e)+").",true)})}\n'
  'loadLive();setInterval(loadLive,300000);\nrender();if(WEB&&!LIVE)cover("Chargement des chiffres en direct…");\nif(document.fonts)')
assert 'loadLive();' in js and 'livecover' in js and 'WEB&&!LIVE' in js

(HERE / 'sales_v2.json').write_text(json.dumps({'css': css, 'html': html, 'js': js}), encoding='utf-8')
print('sales v2', len(css), len(html), len(js))

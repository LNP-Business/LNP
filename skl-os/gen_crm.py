"""CRM screen: the ALKIMIY Lite CRM, embedded whole in its own frame."""
import re, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / 'skl-en' / 'project'
# LNP: the shared screen head (skl-en/project/Shell.base.html, the head of the former Decisions screen) and the i button of shell.py
import sys; sys.path.insert(0, str(ROOT / 'skl-os')); from shell import INFO_BTN
src = (P / 'Shell.base.html').read_text(encoding='utf-8').replace('{title}', 'CRM')
m = re.search(r'<div style="position: relative; width: \d+px', src)
head = src[:m.start()]
nav = re.search(r'<nav aria-label="Main navigation".*?</nav>', src, flags=re.S).group(0)
ibtn = INFO_BTN
H3 = 'margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600'
NUM = 'width: 28px; height: 28px; border-radius: 50%; background: #1B1B18; color: #FFFFFF; font-size: 13px; display: inline-flex; align-items: center; justify-content: center'
TXT = 'margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33'
info = f'''<sc-if value="{{{{info}}}}" hint-placeholder-val="{{{{false}}}}">
<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 48px; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="info-title" style="width: 820px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 32px 36px; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">
<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53">Mode d’emploi</div><h2 id="info-title" style="margin: 6px 0 0; font-family: Fraunces, Georgia, serif; font-size: 32px; font-weight: 500">CRM</h2></div>
<button type="button" onClick="{{{{closeInfo}}}}" aria-label="Fermer" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>
</div>
<section><h3 style="{H3}"><span style="{NUM}">1</span>À quoi sert cette page</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3D3A33">Le CRM des ventes : chaque prospect, du premier contact au montant encaissé, avec sa prochaine action, ses appels, ses transcriptions et le motif d’une perte.</p></section>
<section><h3 style="{H3}"><span style="{NUM}">2</span>Ce qu’elle apporte à chacun</h3>
<ul style="{TXT}">
<li><strong style="color: #1B1B18">Aucun prospect n’est oublié.</strong> Chaque prospect a une prochaine action datée ; celles en retard ressortent.</li>
<li><strong style="color: #1B1B18">Le pipeline dit vrai.</strong> Étapes, tours et motifs de perte sont explicites : la prévision repose sur des faits.</li>
<li><strong style="color: #1B1B18">L’encaissé, pas seulement les ventes.</strong> Les ventes gagnées montrent côte à côte le montant signé et le montant encaissé.</li></ul></section>
<section><h3 style="{H3}"><span style="{NUM}">3</span>Comment l’utiliser</h3>
<ol style="{TXT}; padding-left: 22px">
<li>Pipeline : faites glisser une carte dans une autre colonne pour faire avancer le prospect. S’il y a une action à faire, une fenêtre s’ouvre : l’issue de l’appel à déclarer (déjà remplie pour la colonne : Absent, Gagné, Perdu, Disqualifié, tour suivant), ou le motif d’une perte. S’il n’y a rien à déclarer, le prospect est déplacé tout de suite (ex. R1 honoré et déclaré → R2, à réserver ensuite dans iClosed ; Relance longue).</li>
<li>Ce qui est refusé : revenir à un tour déjà atteint (un prospect en R2 ne revient pas en R1), sauter un tour (R1 → R3), passer au tour suivant avant que l’appel prévu ait eu lieu ou après une absence, remettre en « Nouveau » un prospect qui a eu un appel, déplacer une vente payée. Un prospect clos se rouvre après confirmation.</li>
<li>Pipeline : un appel passé sans issue affiche « Déclarer l’issue » sur sa carte ; le même formulaire que dans Cycle de vente s’ouvre, sans quitter le Pipeline.</li>
<li>Prospects : filtrez, triez, choisissez vos colonnes et agissez sur plusieurs prospects à la fois.</li>
<li>Cycle de vente : une ligne par prospect en cours, du RDV pris au premier paiement Whop, face aux objectifs de présence, de décision et d’encaissement. Chaque matin, lisez Critique, puis Le commercial doit agir, de haut en bas ; Calendrier montre aujourd’hui et les prochains appels, Depuis le RDV compare la durée des cycles ; ouvrez une ligne pour lire chaque échange, ou la fiche prospect pour chaque message, appel et paiement.</li>
<li>Cliquez sur un prospect pour ouvrir sa fiche : à gauche son cycle de vente jour par jour (filtres Tous, Messages, Paiements), à droite « À faire » avec l’action du moment (déclarer l’issue, ou « Fait » avec ce que vous avez fait, enregistré en note), ses appels de vente et leur analyse. Son menu Statut déplace le prospect comme dans le Pipeline.</li>
<li>Notez la prochaine action avant de fermer la fiche d’un prospect.</li></ol></section>
<button type="button" onClick="{{{{closeInfo}}}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">J’ai compris</button>
</div>
</div>
</sc-if>
'''
out = (head + '<div style="position: relative; width: 1440px; height: 1080px; display: flex; background: #F6F4EF; font-family: \'IBM Plex Sans\', system-ui, sans-serif; color: #1B1B18">\n\n'
       + nav + '\n\n<main style="flex-grow: 1; min-width: 0; display: flex"><div data-crm="1" style="flex-grow: 1; min-width: 0; height: var(--screen-h, 100vh)"></div></main>\n\n'
       + ibtn + '\n\n' + info + '</div>\n</x-dc>\n' + '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1080}}'>
class Component extends DCLogic {
  constructor(props) { super(props); this.state = {}; }
  renderVals() {
    return {
      info: !!this.state.info,
      openInfo: () => this.setState({ info: true }),
      closeInfo: () => this.setState({ info: false })
    };
  }
}
</script>
</body>
</html>
''')
(P / 'CRM.dc.html').write_text(out, encoding='utf-8')


# ---- LNP palette for the ALKIMIY Lite screens: white / black / gold, LNP type ----
SKL_VARS = ('<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
  '<style>:root{--bg:#F6F4EF;--bg-2:#EFECE4;--card:#FFFFFF;--ink:#1B1B18;--ink-2:#3D3A33;--muted:#5E5B53;--muted-2:#8E8A80;'
  '--line:#E3DFD5;--hair:#EFEBE3;--side:#1B1B18;--side-2:#2C2B26;--side-ink:#C9C4B7;--side-mut:#8E8A80;--side-line:#34322C;'
  '--gold:#D9B46A;--gold-soft:#F7EEDC;--gold-ink:#7A4B00;--teal:#1B1B18;--teal-soft:#EFECE4;--teal-ink:#1B1B18;'
  '--green:#2E7D4F;--green-soft:#E6F2EA;--green-ink:#1E5E38;--amber:#B45309;--amber-soft:#FDF1E3;--amber-ink:#8A3F06;'
  '--red:#B42318;--red-soft:#FDECEA;--red-ink:#9B1C12;--page:#F6F4EF;--overlay:rgba(27,27,24,.5);'
  '--shadow:0 1px 2px rgba(27,27,24,.04),0 1px 3px rgba(27,27,24,.04);--shadow-lg:0 8px 24px rgba(27,27,24,.10),0 30px 60px rgba(27,27,24,.14);'
  '--display:Fraunces,Georgia,serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}'
  ':focus-visible{outline-color:#D9B46A!important}h1,h2{font-weight:500!important;letter-spacing:0!important}'
  '.cx-tabs button.on{color:var(--gold-ink)!important}.btn.gold{color:#1B1B18!important}.lite{color:#1B1B18!important}'
  '.fun-bar i{background:var(--gold)!important;opacity:.6!important}</style>')
PAL = [
  # pipeline stages: grey, gold, deep gold, amber, green, red, stone
  ('#94A3B8', '#B7B2A6'), ('#3B82F6', '#C9A04A'), ('#8B5CF6', '#7A4B00'), ('#F97316', '#B45309'),
  ('#22A06B', '#2E7D4F'), ('#E05555', '#B42318'), ('#64748B', '#5E5B53'),
  # sales rep avatars
  ('#3E6FD0', '#1B1B18'), ('#2E9E5B', '#7A4B00'), ('#B87F2E', '#9A6614'), ('#0E8F8F', '#3D3A33'), ('#C0564B', '#5E5B53'),
  # other literals
  ('#0A6A6A', '#1B1B18'), ('#4F46E5', '#1B1B18'), ('#4f46e5', '#1B1B18'), ('#7C4DDB', '#7A4B00'), ('#6366F1', '#1B1B18'), ('#9085e9', '#C9A04A'), ('#3987e5', '#C9A04A'),
  ('#1d4ed8', '#1B1B18'), ('#0f766e', '#1B1B18'), ('#D74253', '#B42318'), ('#D64545', '#B42318'), ('#1F8A5C', '#2E7D4F'),
  ('#15803d', '#2E7D4F'), ('#C06A12', '#B45309'), ('#b45309', '#B45309'), ('#b3261e', '#B42318'), ('#d95926', '#B45309'),
  ('#6b7280', '#5E5B53'), ('#9aa3ae', '#8E8A80'), ('#c9ced6', '#D8D3C7'), ('#E6A94A', '#D9B46A'), ('#B97A1F', '#9A6614'), ('#8E5E1E', '#7A4B00'),
  ('rgba(59,130,246', 'rgba(217,180,106'), ('rgba(57,135,229', 'rgba(217,180,106'), ('rgba(139,92,246', 'rgba(154,102,20'),
  ('rgba(79,70,229', 'rgba(27,27,24'), ('rgba(22,32,43', 'rgba(27,27,24'), ('rgba(15,23,32', 'rgba(27,27,24'),
  ('rgba(148,163,184', 'rgba(183,178,166'), ('rgba(100,116,139', 'rgba(94,91,83'), ('rgba(34,160,107', 'rgba(46,125,79'),
  ('rgba(62,155,107', 'rgba(46,125,79'), ('rgba(224,85,85', 'rgba(180,35,24'), ('rgba(215,66,83', 'rgba(180,35,24'),
  ('rgba(201,54,42', 'rgba(180,35,24'), ('rgba(226,106,95', 'rgba(180,35,24'), ('rgba(234,138,40', 'rgba(180,83,9'),
]
def theme(doc):
    for a, b in PAL:
        doc = doc.replace(a, b)
    i = doc.index('<div class="app">')
    return doc[:i] + SKL_VARS + '\n' + doc[i:]

crm = (pathlib.Path(__file__).resolve().parent.parent / 'uploads' / 'ALKIMIY_Lite.html').read_text(encoding='utf-8')
crm = theme(crm)
inj = '<style>.side{display:none!important}.app{grid-template-columns:minmax(0,1fr)!important}.wrap{padding-inline-end:96px}</style>'
i = crm.index('<div class="app">'); crm = crm[:i] + inj + '\n' + crm[i:]
k = crm.rindex('renderAll();'); crm = crm[:k] + 'S.view="crm";renderAll();' + crm[k + len('renderAll();'):]
# a way back to the pipeline when LNP opens the CRM on its alerts
crm = crm.replace('<section class="view" id="v-alerts"></section>', '<button class="linkbtn" id="sklCrmBack" data-act="goto" data-v="crm" hidden style="margin-bottom:14px">← Pipeline</button>\n      <section class="view" id="v-alerts"></section>', 1)
k = crm.rindex('S.view="crm";renderAll();')
crm = crm[:k] + '{const _rn=renderNav;renderNav=function(){_rn();const b=document.getElementById("sklCrmBack");if(b)b.hidden=S.view!=="alerts";};}' + crm[k:]
# every delete or remove button asks first, in a popup (same look as the rest of the OS), in the CRM's language
ASK = ('<script>window.sklAsk=function(title,body,ok,fn){var bg=document.createElement("div");'
       'bg.style.cssText="position:fixed;inset:0;z-index:999;background:rgba(27,27,24,.55);display:flex;align-items:center;justify-content:center;padding:24px";'
       'bg.innerHTML=\'<div role="alertdialog" aria-modal="true" style="width:min(440px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:12px;font-family:inherit;color:#1B1B18">\''
       '+\'<h3 style="margin:0;font-family:Fraunces,Georgia,serif;font-size:21px;font-weight:600"></h3><p style="margin:0;font-size:14px;line-height:1.5;color:#5E5B53"></p>\''
       '+\'<div style="display:flex;justify-content:flex-end;gap:10px"><button type="button" data-n style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;background:#fff;border:1px solid #D8D3C7;color:#1B1B18"></button>\''
       '+\'<button type="button" data-y style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;background:#B42318;border:1px solid #B42318;color:#fff"></button></div></div>\';'
       'bg.querySelector("h3").textContent=title;bg.querySelector("p").textContent=body;bg.querySelector("[data-n]").textContent="Annuler";bg.querySelector("[data-y]").textContent=ok;'
       'var close=function(){bg.remove();document.removeEventListener("keydown",key,true)},key=function(e){if(e.key==="Escape"){e.stopPropagation();close()}};'
       'bg.addEventListener("mousedown",function(e){if(e.target===bg)close()});bg.querySelector("[data-n]").onclick=close;bg.querySelector("[data-y]").onclick=function(){close();fn()};'
       'document.addEventListener("keydown",key,true);document.body.appendChild(bg);bg.querySelector("[data-n]").focus();};</script>')
crm = crm.replace('</body>', ASK + '</body>', 1) if '</body>' in crm else crm + ASK

# ---- web edition: the board shows the real CRM cycles (docs/crm phase 2) ----
# The parent page's window.SKL_CRM (skl-os/crm/data.js) is live only in the web edition. The board is read-only there
# until the outcome form (phase 3): a note is saved for real, the other writes say so instead of changing data that
# would vanish on reload. As a plain file or an Artifact nothing changes: the board stays empty.
LIVE = ('<script>(function(){'
  'var LIVE=false,TIMER=null,DAY=864e5;'
  'var WRITES={nxpick:1,nxclear:1,nxdone:1,warm:1,stnew:1,stedit:1,stdel:1,rdvheld:1,rdvnoshow:1,cxnew:1,cxmock:1};'
  'function day0(d){var x=new Date(d);x.setHours(0,0,0,0);return x}'
  'function dd(iso){return iso?Math.round((day0(iso)-day0(Date.now()))/DAY):null}'
  'function hm(iso){var d=new Date(iso);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}'
  'function soon(){toast("Déclarez l’issue d’un appel dans CRM › Cycle de vente ; les autres modifications ici arriveront plus tard.")}'
  'var LOSS={price:"budget",timing:"timing",trust:"trust",unreachable:"noshow_unreach",dq_off_target:"offtarget",dq_budget:"nomoney"};'
  'var STAGEDATA={call_booked:1,call_rescheduled:1,call_canceled:1,call_missed:1,call_recorded:1,outcome_held:1,outcome_no_show:1,outcome_yes:1,outcome_follow_up:1,outcome_no:1,outcome_disqualified:1,cycle_reopened:1,cycle_won:1,cycle_lost:1,cycle_disqualified:1,payment_succeeded:1};'
  'var EVST={call_booked:"planifie",call_rescheduled:"planifie",outcome_no_show:"noshow",outcome_held:"realise",cycle_won:"close",cycle_lost:"perdu",cycle_disqualified:"disq"};'
  'function toLead(c,keys){'
    'var calls=(c.calls||[]).filter(function(x){return x.status!=="canceled"}),all=c.calls||[],last=all[all.length-1]||null;'
    'var held=all.filter(function(x){return x.status==="held"}).length,next=calls.filter(function(x){return x.status==="scheduled"})[0]||null;'
    'var call=next||calls[calls.length-1]||null,st;'
    'if(c.status==="won")st="close";else if(c.status==="lost")st="perdu";else if(c.status==="disqualified")st="disq";'
    'else if(!call)st="nouveau";else if(call.status==="no_show")st="noshow";else if(call.status==="held")st="realise";else st="planifie";'
    # Long follow-up (Romain 2026-10-31): refused, no-show or silent leads with no news for over 14 days and no call ahead
    'var quiet=dd(c.last_event_at||c.opened_at)<-14,ahead=calls.some(function(x){return x.status==="scheduled"&&x.scheduled_start&&Date.parse(x.scheduled_start)>Date.now()});'
    'if(quiet&&!ahead&&(st==="noshow"||st==="nouveau"||st==="planifie"||st==="realise"||(st==="perdu"&&c.close_reason!=="refunded")))st="longfu";'
    # 047 (Romain 2026-11-05): a move with nothing to declare (stage_moved) puts the lead in its column until newer data about
    # its calls (a booking, an outcome, a recording, a closing) says where it is
    'var MVT=0,MV=null,MVN=null;(c.events||[]).forEach(function(e){if(STAGEDATA[e.type]){var x=Date.parse(e.occurred_at);if(x>MVT)MVT=x}});'
    '(c.events||[]).forEach(function(e){if(e.type==="stage_moved"&&Date.parse(e.occurred_at)>MVT&&(!MV||Date.parse(e.occurred_at)>=Date.parse(MV.occurred_at)))MV=e});'
    'if(MV&&c.status==="active"){var mto=(MV.data||{}).to;if(mto==="longfu")st="longfu";else if(/^r[1-3]$/.test(mto)){st="planifie";MVN=+mto.charAt(1)}}'
    'var p=c.person||{},o=keys[c.owner_id]||"none",loss=c.close_reason?(LOSS[c.close_reason]||c.close_reason):undefined;'
    'if(loss&&!REASON_L[loss]){var rlb=loss;try{rlb=window.parent.SKL_CRM.reasonLabel(loss)}catch(e){}REASON_L[loss]={fr:rlb,en:loss}}'
    'var byCall={};all.forEach(function(x){byCall[x.id]=x.rank});'
    'var hist=[{st:"nouveau",d:dd(c.opened_at),src:"bookings",r:null}];'
    '(c.events||[]).forEach(function(e){var h=EVST[e.type];if(!h)return;hist.push({st:h,d:dd(e.occurred_at),src:e.source==="iclosed"?"bookings":"sales",r:e.call_id?byCall[e.call_id]||null:null})});'
    'var nmk=c.next_move&&c.next_move.code,nx=nmk==="rebook"?{k:"resched",d:0}:nmk==="follow_up"?{k:"relance",d:0}:null;'
    'var l={id:c.id,p:p.full_name||p.primary_email||p.primary_phone||"—",em:p.primary_email||"",o:o,st:st,prod:null,'
      'a:c.deal&&c.deal.amount_sold?Number(c.deal.amount_sold):0,age:Math.max(0,-dd(c.stage_entered_at||c.opened_at)),'
      'born:dd(p.first_seen_at||c.opened_at),last:dd(c.last_event_at||c.opened_at),tour:MVN||Math.max(1,(call&&call.rank)||all.length||1),mv:MV?(MV.data||{}).to:null,ns:c.no_shows||0,loss:loss,tent:0,rel:{n:0},'
      'rdv:!MVN&&call&&call.scheduled_start?{d:dd(call.scheduled_start),h:hm(call.scheduled_start)}:null,'
      'warm:[false,false,false],nx:nx,note:((c.events||[]).filter(function(e){return e.type==="note"}).pop()||{}).content||"",inv:c.deal&&c.deal.amount_sold?Number(c.deal.amount_sold):0,cur:c.deal&&c.deal.currency||"EUR",plan:c.deal&&c.deal.payment_plan||"",sched:c.deal&&c.deal.schedule||null,col:(c.payments||[]).reduce(function(s,x){return s+Number(x.amount||0)-Number(x.refunded_amount||0)},0),pays:c.payments||[],stg:c.current_stage||null,hist:hist,tr:held||(call&&dd(call.scheduled_start)<0)?"none":undefined,live:true};'
    'return l}'
  # people who never booked (no cycle): status "No booking", their iClosed status as the note; nothing to save for them
  'function toNoBooking(p){return{id:"p-"+p.id,p:p.full_name||p.primary_email||p.primary_phone||"—",em:p.primary_email||"",o:"none",st:"nobook",prod:null,'
    'a:0,age:Math.max(0,-dd(p.first_seen_at||p.created_at)),born:dd(p.first_seen_at||p.created_at),last:dd(p.first_seen_at||p.created_at),tour:1,ns:0,tent:0,rel:{n:0},rdv:null,warm:[false,false,false],nx:null,'
    'note:p.iclosed_status?"iClosed : "+p.iclosed_status:"",inv:0,col:0,hist:[{st:"nobook",d:dd(p.first_seen_at||p.created_at),src:"import",r:null}],tr:"none",live:true}}'
  # the board draws the cycles as soon as they are in (calls, messages and events follow: a slow connection took minutes,
  # with an empty board and no word, Michael 2026-10-25); a status pill says what is loading and why a load failed
  'function loadMsg(txt,retry){var el=document.getElementById("sklLoad");if(!txt){if(el)el.remove();return}'
    'if(!el){el=document.createElement("div");el.id="sklLoad";el.setAttribute("role","status");'
      'el.style.cssText="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:10px;background:#1B1B18;color:#F6F4EF;border-radius:999px;padding:9px 16px;font:500 13px \'IBM Plex Sans\',sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18)";document.body.appendChild(el)}'
    'el.textContent=txt;if(retry){var b=document.createElement("button");b.textContent="Réessayer";'
      'b.style.cssText="font:inherit;font-weight:600;background:transparent;color:#D9B46A;border:1px solid #D9B46A;border-radius:999px;padding:3px 12px;cursor:pointer";b.onclick=retry;el.appendChild(b)}}'
  'var LOADS=0;'
  'async function load(C){var n=++LOADS,full=false,keys={};if(!LEADS.length)loadMsg("Chargement des prospects…");'
    'var meta=Promise.all([C.listMembers(),C.listNoBooking(),Promise.resolve().then(function(){return C.me()}).catch(function(){return null}),'
    'Promise.resolve().then(function(){return C.listReasons()}).catch(function(){return []}),'
    # the SLA settings of Settings › Alerts (crm_settings.sla_rules): the Sales cycle applies them (sla_rules.js configure)
    'Promise.resolve().then(function(){return C.slaRules?C.slaRules():null}).catch(function(){return null})]);'
    'function paint(cycles,r){if(n!==LOADS)return;'
      'LEADS.length=0;cycles.forEach(function(c){var l=toLead(c,keys);projectCycle(l);LEADS.push(l)});r[1].forEach(function(p){LEADS.push(toNoBooking(p))});'
      'var PAL=["#7A4B00","#1F6A66","#6B4FA0","#2D5C9C","#8A2D3B"],reps={none:["Non attribué","#8E8A80"]};r[0].forEach(function(m,i){reps[m.member_key]=[m.full_name,PAL[i%PAL.length]]});'
      'var me=r[2]||{},rs=(r[3]||[]).filter(function(x){return x.active&&!x.automatic}),rl=function(k){return rs.filter(function(x){return x.kind===k}).map(function(x){return [x.code,C.reasonLabel?C.reasonLabel(x.code,x.label):x.label]})};'
      'if(C.salesCycleView)window.sklScData={leads:C.salesCycleView(cycles,r[0],Date.now()),reps:reps,now:Date.now(),role:me.role||null,reasons:rs.length?{no:rl("lost"),dq:rl("disqualified")}:null,sla:r[4]||{}};'
      'if(typeof sklCyclePush==="function")sklCyclePush(true);'
      'renderAll();if(S.cx.lead&&byD(S.cx.lead.id))renderLead()}'
    'try{'
      'var board=C.listBoard(function(cycles){meta.then(function(r){if(!full){prep(r);paint(cycles,r);loadMsg("Chargement des appels et des messages…")}},function(){})});'
      'var r=await meta;prep(r);var cycles=await board;full=true;paint(cycles,r);if(n===LOADS)loadMsg(null)'
    '}catch(err){full=true;console.error(err);if(n===LOADS)loadMsg("Impossible de charger les prospects : "+String(err&&err.message||err),function(){load(C)})}'
    'function prep(r){r[0].forEach(function(m){keys[m.id]=m.member_key;if(!SALES.some(function(s){return s.id===m.member_key}))SALES.push({id:m.member_key,name:m.full_name,ini:(m.full_name||"?").charAt(0),color:"#5E5B53",camp:"atlas",email:"",calls:0,won:0,close:0,cpc:0,cash:0,show:0})})}}'
  'window.sklCrmLive=function(C){LIVE=true;window.sklCrmDeclare=function(callId,p){return C.declareOutcome(callId,p).then(function(){return load(C)})};'
  # moves of CRM › Pipeline with no call to declare (045, outcome_ui.js › sklMove), and the note of the lead record's « À faire »
  'window.sklCrmClose=function(id,d,r,n){return C.closeCycle(id,d,r,n).then(function(){return load(C)})};'
  'window.sklCrmReopen=function(id,quiet){return C.reopenCycle(id).then(function(){return quiet?null:load(C)})};'
  'window.sklCrmNote=function(id,txt){return C.addNote(id,txt).then(function(){return load(C)})};'
  'window.sklCrmMove=function(id,to){return C.moveCycle(id,to).then(function(){return load(C)})};'
  # Settings › Alerts saved the SLA settings (crm_settings.sla_rules): the Sales cycle applies them at once
  'try{parent.addEventListener("skl-sla-saved",function(e){if(window.sklScData&&e.detail){window.sklScData.sla=e.detail;if(typeof sklCyclePush==="function")sklCyclePush(true)}})}catch(_){}'
    'if(!SALES.some(function(s){return s.id==="none"}))SALES.push({id:"none",name:"Non attribué",ini:"?",color:"#8E8A80",camp:"atlas",email:"",calls:0,won:0,close:0,cpc:0,cash:0,show:0});'
    'var _a=cxAction;cxAction=function(act,el,e){if(LIVE&&WRITES[act]){closeMenu();soon();return true}'
      # cash entered by hand (022, Romain 2026-10-26): the lead's Invoicing and payment opens the cash window (cash_ui.js)
      # the outcome of a call from the Pipeline card (Romain 2026-11-05, outcome_ui.js)
      'if(LIVE&&act==="outdecl"){if(e)e.stopPropagation();closeMenu();var ol=byD(el.dataset.id);if(!(window.sklOutcome&&sklOutcome.open(el.dataset.id,ol&&ol.a)))toast("Aucun appel passé sans issue pour ce prospect.");return true}'
      'if(LIVE&&(act==="lstpick"||act==="nslost"||act==="nsback")){if(e)e.stopPropagation();closeMenu();var sl=byD(el.dataset.id||(S.cx.lead&&S.cx.lead.id));'
        'if(sl&&window.sklMove)sklMove(sl,act==="lstpick"?el.dataset.s:act==="nslost"?"perdu":"planifie");return true}'
      'if(LIVE&&act==="ltr"){closeMenu();var lt=S.cx.lead&&byD(S.cx.lead.id),rw=lt&&typeof SKL_CA!=="undefined"?SKL_CA.latestRow(lt.id):null;'
        'if(rw)SKL_CA.open(rw.call_id,{person:lt.p,sales:byS(lt.o).name});else toast("Aucun appel R1 ou R2 passé à analyser pour ce prospect.");return true}'
      'if(LIVE&&act==="pay"){if(e)e.stopPropagation();closeMenu();var pl=byD(el&&el.dataset.id||(S.cx.lead&&S.cx.lead.id));'
        'if(pl&&String(pl.id).indexOf("p-")!==0)sklCash.open(pl,C,function(){return load(C)},!(window.sklScData&&window.sklScData.role==="viewer"),byD);return true}'
      'if(LIVE&&act==="notesave"&&String(S.cx.lead&&S.cx.lead.id).indexOf("p-")===0){closeMenu();soon();return true}'
      'if(LIVE&&act==="notesave"){var id=S.cx.lead&&S.cx.lead.id,txt=document.getElementById("noteTa").value.trim();S.cx.lead.edit=false;'
        'if(!txt){renderLead();return true}C.addNote(id,txt).then(function(){toast(t("cx_note_saved"));load(C)},function(err){toast(String(err&&err.message||err))});return true}'
      # the sales rep of a lead (Romain 2026-10-31): admins and sales leads change it (crm_reassign_cycle, 004) from the lead
      # record's header or the Leads list; the menu lists the active CRM members who sell
      'if(LIVE&&act==="ownmenu"){if(e)e.stopPropagation();var oid=el.dataset.id;C.listMembers().then(function(ms){var cur=(byD(oid)||{}).o;'
        'openMenu(el,`<div class="mh">Attribuer à</div>`+ms.filter(function(m){return m.active!==false&&m.role!=="viewer"}).map(function(m){'
        'return `<button data-act="ownpick" data-id="${oid}" data-m="${m.id}" ${m.member_key===cur?"disabled":""}>${esc(m.full_name||m.member_key)}</button>`}).join(""))},'
        'function(err){toast(String(err&&err.message||err))});return true}'
      'if(LIVE&&act==="ownpick"){closeMenu();var cid=el.dataset.id,nm=el.textContent;C.reassignCycle(cid,el.dataset.m).then(function(){'
        'toast("Attribué à "+nm);load(C)},function(err){toast(String(err&&err.message||err))});return true}'
      'return _a(act,el,e)};'
    # Romain 2026-11-05: a lead moves for real (a Pipeline column, the lead record's status menu, the Leads list's status):
    # outcome_ui.js › sklMove opens the outcome form, the closing form or the reopening, or says why the column is computed
    'var _m=moveLead;moveLead=function(id,st){if(LIVE){var ml=byD(id);if(ml&&window.sklMove)sklMove(ml,st);renderAll();return}return _m.apply(this,arguments)};'
    'var _c=moveToCol;moveToCol=function(id,c){if(LIVE){var ml=byD(id);if(ml&&window.sklMove&&colOf(ml)!==c)sklMove(ml,c);return}return _c.apply(this,arguments)};'
    'var _s=stepSave;stepSave=function(){if(LIVE){soon();return}return _s.apply(this,arguments)};'
    # 048: only an admin sees every lead, so only an admin gives a lead to another rep
    'C.me().then(function(m){window.sklCanAssign=!!m&&m.role==="admin";renderAll()}).catch(function(){});'
    'return load(C).then(function(){C.subscribe(function(){clearTimeout(TIMER);TIMER=setTimeout(function(){load(C)},800)})})};'
  'try{var C=window.parent&&window.parent!==window&&window.parent.SKL_CRM;if(C)C.ready().then(function(){if(C.mode()==="live")window.sklCrmLive(C)})}catch(e){}'
  '})();</script>')
crm = crm.replace('</body>', LIVE + '</body>', 1) if '</body>' in crm else crm + LIVE
# the sales rep shows as a button for admins and sales leads in the web edition (window.sklCanAssign, from the CRM role)
for a, b in [('<span>· ${esc(s.name)}</span>',
              '<span>· ${window.sklCanAssign&&String(l.id).indexOf("p-")!==0?`<button class="cx-own" data-act="ownmenu" data-id="${l.id}" title="Changer le commercial">${esc(s.name)} ▾</button>`:esc(s.name)}</span>'),
             ('${C.rep?`<td class="mut">${byS(l.o).email}</td>`:""}',
              '${C.rep?`<td class="mut">${window.sklCanAssign&&String(l.id).indexOf("p-")!==0?`<button class="cx-own" data-act="ownmenu" data-id="${l.id}" title="Changer le commercial">${esc(byS(l.o).name)} ▾</button>`:esc(byS(l.o).email||byS(l.o).name)}</td>`:""}'),
             ('</head>', '<style>.cx-own{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}.cx-own:hover{color:#1B1B18}</style></head>')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
# "No booking": a person who never booked a call (Romain, 2026-10-24); the last column of the pipeline (Romain 2026-10-31: it
# was first, it goes to the far right)
for a, b in [('const STG=["nouveau","planifie","noshow","realise","close","perdu","disq"];', 'const STG=["nouveau","planifie","noshow","realise","close","perdu","disq","nobook"];'),
             ('const STC={nouveau:"#B7B2A6",', 'const STC={nobook:"#8E8A80",nouveau:"#B7B2A6",'),
             ('const COLS=["nouveau","r1","noshow","r2","r3","close","perdu","disq"];', 'const COLS=["nouveau","r1","noshow","r2","r3","close","perdu","disq","nobook"];'),
             ('const COLC={nouveau:"#B7B2A6",', 'const COLC={nobook:"#8E8A80",nouveau:"#B7B2A6",'),
             (' st_nouveau:"Nouveau",', ' st_nobook:"Sans rendez-vous", st_nouveau:"Nouveau",'),
             ('const ACT_BY={nouveau:[', 'const ACT_BY={nobook:["call","calendly"],nouveau:['),
             ('if((!isRound(colOf(l))&&l.st!=="nouveau")||l.tour>=3)chips+=tourChip(l);',
              'if((!isRound(colOf(l))&&l.st!=="nouveau"&&l.st!=="nobook")||l.tour>=3)chips+=tourChip(l);'),
             # "Created" filter (Romain, 2026-10-24): last 7 days, last 30 days or all leads, on when the lead came in (l.born)
             ('tab:"pipeline",q:"",owner:"all",', 'tab:"pipeline",q:"",owner:"all",born:"all",'),
             ('  const count=`<span class="cx-count">',
              '  const born=`<select class="sel" id="cxBorn" data-act="cxborn" aria-label="${t("cx_born_all")}">${["all","7","30"].map(v=>`<option value="${v}" ${X.born===v?"selected":""}>${t("cx_born_"+v)}</option>`).join("")}</select>`;\n  const count=`<span class="cx-count">'),
             ('${search}${reps}${acts}${count}', '${search}${reps}${born}${acts}${count}'),
             ('${search}${reps}${st}${tr}', '${search}${reps}${born}${st}${tr}'),
             ('    if(X.owner!=="all"&&l.o!==X.owner)return false;\n',
              '    if(X.owner!=="all"&&l.o!==X.owner)return false;\n    if(X.born!=="all"&&!(l.born!=null&&l.born>=-Number(X.born)))return false;\n'),
             ('  if(a==="cxowner"){X.owner=el.value; renderCRM();}', '  if(a==="cxowner"){X.owner=el.value; renderCRM();}\n  if(a==="cxborn"){X.born=el.value; renderCRM();}'),
             ('"cxowner","cxact",', '"cxowner","cxborn","cxact",'),
             (' cx_all_reps:"Tous les commerciaux",', ' cx_all_reps:"Tous les commerciaux", cx_born_all:"Tous les prospects", cx_born_7:"Créés depuis 1 semaine", cx_born_30:"Créés depuis 1 mois",')]:
    assert crm.count(a) == 1, a
    crm = crm.replace(a, b)
# no product catalogue yet (Whop plans come in phase 5): a lead without a product shows a dash, not a sample product
a2 = 'const prodName=l=>L(prodOf(l).n);'
assert crm.count(a2) == 1
crm = crm.replace(a2, 'const prodName=l=>l.prod?L(prodOf(l).n):"—";')
for a, b in [
    ('case "nxclear": l.nx=null; closeMenu(); renderAll(); if(X.lead)renderLead(); return true;',
     'case "nxclear": closeMenu(); sklAsk("Retirer l’action ?","La prochaine action de ce prospect sera retirée.",t("cx_nx_clear"),function(){l.nx=null; renderAll(); if(X.lead)renderLead();}); return true;'),
    ('case "stdel": {const lead=byD(X.lead.id);lead.hist.splice(+el.dataset.i,1);X.lead.step=null;renderLead();toast(t("cy_deleted"));return true;}',
     'case "stdel": {const si=+el.dataset.i;sklAsk("Supprimer cette étape ?","Cette étape du cycle de vente sera supprimée.",t("cy_delete"),function(){const lead=byD(X.lead.id);lead.hist.splice(si,1);X.lead.step=null;renderLead();toast(t("cy_deleted"));});return true;}')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
# no sample leads: the ALKIMIY Lite demo prospects (Sophie Marchand…) never existed; the CRM starts empty until the shared
# CRM (docs/crm, phase 2) fills it with real cycles
m = re.search(r'const LEADS=\[.*?\n\];', crm, flags=re.S)
assert m, 'LEADS block not found'
crm = crm[:m.start()] + 'const LEADS=[];' + crm[m.end():]
# its sample alerts describe those leads: none either
m = re.search(r'let ALERTS=\[.*?\n\];', crm, flags=re.S)
assert m, 'ALERTS block not found'
crm = crm[:m.start()] + 'let ALERTS=[];' + crm[m.end():]
# its sales reps were fictional too: the real ones, by their LNP member id (no figures until the shared CRM has data)
m = re.search(r'const SALES=\[.*?\n\];', crm, flags=re.S)
assert m, 'SALES block not found'
crm = crm[:m.start()] + ('const SALES=[\n'
  ' {id:"sales",name:"Camille Martin",ini:"CM",color:"#1B1B18",camp:"atlas",email:"",calls:0,won:0,close:0,cpc:0,cash:0,show:0},\n'
  ' {id:"romain",name:"Romain",ini:"R",color:"#7A4B00",camp:"atlas",email:"",calls:0,won:0,close:0,cpc:0,cash:0,show:0}\n'
  '];') + crm[m.end():]
# ---- CRM › Sales cycle (docs/crm/16-sales-cycle-screen.md): the reference mock-up v6, whole, as the third CRM view ----
# It runs in its own frame over the CRM document (its own top bar, popups and toasts). Demo: the mock-up's sample leads and
# clock. Web edition: the live script hands it SKL_CRM.salesCycleView() (real cycles, now = the real time); writes say they
# arrive with phase 3, and no call analysis is invented.
sc = (ROOT / 'docs' / 'crm' / 'reference' / 'sales-cycle-v6.html').read_text(encoding='utf-8')
for a, b in [
    # payment terms at close (Romain 2026-10-28): paid in full or 2 to 6 instalments; the dates and amounts are set in the
    # lead's cash window (cash_ui.js, crm_set_payment_plan 024); the method is not asked
    ('<div class="fr"><span>Échéances</span>${ch("inst",[["1","1"],["2","2"],["3","3"]])}</div>',
     '<div class="fr"><span>Modalités de paiement</span>${ch("inst",[["1","Payé en une fois"],["2","2 échéances"],["3","3"],["4","4"],["6","6"]])}</div>'),
    ('S.of={res:"held",dec:"fu",amt:l.a,inst:"3",reason:"",nur:"y",step:""}', 'S.of={res:"held",dec:"fu",amt:l.a,inst:"1",reason:"",nur:"y",step:""}'),
    ('<span class="mock">Maquette v6 · CRM › Cycle de vente · prospects d’exemple · maintenant = dim. 25 oct., 08:51 (Dubaï)</span>',
     '<span class="mock" id="scMock">Démo · prospects d’exemple · rien n’est enregistré · maintenant = dim. 25 oct., 08:51 (Dubaï)</span>'),
    # one Page method per screen: LNP's round i button (top right) explains the CRM and its Sales cycle view, so the
    # mock-up's own i button goes and its top bar keeps the 72 px the round button needs (design system)
    ('<button class="ibtn" data-method="1" aria-label="Mode d’emploi">i</button>', ''),
    ('<header class="top">', '<header class="top" style="padding-right:72px">'),
    ('<button aria-pressed="false">Pipeline</button><button aria-pressed="false">Prospects</button>',
     '<button aria-pressed="false" data-cxtab="pipeline">Pipeline</button><button aria-pressed="false" data-cxtab="leads">Prospects</button>'),
    ('const NOW=new Date("2026-10-25T08:51:00+04:00").getTime();', 'let NOW=new Date("2026-10-25T08:51:00+04:00").getTime(),LIVE=false;'),
    ('document.addEventListener("click",e=>{\n  if(moved){moved=false;return}',
     'document.addEventListener("click",e=>{\n  if(moved){moved=false;return}\n'
     '  const ctab=e.target.closest("[data-cxtab]");if(ctab){try{parent.sklCrmTab(ctab.dataset.cxtab)}catch(_){}return}\n'
     '  const anb=e.target.closest("[data-an]");if(LIVE&&anb){const [li,ix]=anb.dataset.an.split(":"),ll=LEADS.find(z=>z.id===li),ev=ll&&ll.ev[+ix];'
     'if(ev&&ev.cid){try{parent.SKL_CA.open(ev.cid,{person:ll.p,round:ev.r})}catch(_){}}return}\n'
     '  const lw=e.target.closest("[data-send],[data-act=whop],[data-act=book]");'
     'if(LIVE&&lw)return toast(lw.dataset.send?"L’envoi d’iMessages depuis le CRM arrivera plus tard : répondez depuis Sendblue pour l’instant.":"Ce lien arrivera plus tard (liens Whop et iClosed).");\n'
     '  const ofs=e.target.closest("[data-ofsave]");if(LIVE&&ofs){saveLive(LEADS.find(z=>z.id===ofs.dataset.ofsave));return}'),
    ('  if(t.dataset.needs)return toast(',
     '  if(t.dataset.needs&&LIVE){try{parent.parent.postMessage({skl:"go",screen:"monjour"},"*")}catch(_){}return}\n  if(t.dataset.needs)return toast('),
    ('function anHTML(l,i){\n',
     'function anHTML(l,i){\n  if(LIVE){const e=l.ev[i];return `<div class="scrim2" data-closean="1"><div class="adlg" role="dialog" aria-modal="true" aria-labelledby="anh"><div class="dh"><div><div class="kick">Analyse d’appel</div><h2 id="anh">${esc(e.txt.split(" · ")[0])} · ${esc(l.p)}</h2><div class="meta"><span>${dayOf(l,e.t)} · ${timeOf(l,e.t)}</span></div></div><button class="x" data-closean="1" aria-label="Fermer">×</button></div><div class="abody"><div class="aban">Pas encore d’analyse pour cet appel. L’analyste après appel (Claude) lit l’enregistrement Fathom dès que Fathom est relié au CRM ; rien n’est affiché d’ici là.</div></div></div></div>`}\n'),
    # call analysis (call-analysis/PLAN.md phase 3): in the web edition a past call waiting for its outcome can be analysed too
    # (most imported calls never had one declared); the button opens the analysis window of the CRM document (SKL_CA)
    ('${e.k==="meet"&&!fut?`<button class="anl" data-an="${l.id}:${i}">Analyse d’appel</button>`:""}',
     '${(e.k==="meet"||(LIVE&&e.k==="meetdue"))&&!fut?`<button class="anl" data-an="${l.id}:${i}">Analyse d’appel</button>`:""}'),
    ('e.k==="meetdue"?`<button class="btn p sm">Déclarer l’issue</button>`',
     'e.k==="meetdue"?`<button class="btn p sm">Déclarer l’issue</button>${LIVE?`<button class="btn sm" data-an="${l.id}:${i}">Analyse d’appel</button>`:""}`'),
    ('${e.k==="meet"&&e.t<=l.age?`<button class="lnk" data-an="${l.id}:${i}">Analyse</button>`',
     '${(e.k==="meet"||(LIVE&&e.k==="meetdue"))&&e.t<=l.age?`<button class="lnk" data-an="${l.id}:${i}">Analyse</button>`'),
    # §14 test 7: after a Follow-up outcome the next step shows in "Who must act" even while the prospect has the ball
    ('return {t,b:"En attente du prospect",s:`relancer dans ${fmtH(b?b.left:0)}${b&&b.src?" · "+esc(b.src):""}`};',
     'return {t,b:"En attente du prospect",s:`relancer dans ${fmtH(b?b.left:0)}${b&&b.src?" · "+esc(b.src):""}${b&&b.then?" · prochaine étape : "+esc(b.then):""}`};'),
    # Romain, 2026-10-25: filter the board by recency (last activity: a past event of the lead, or the booking) and by
    # stage (the current stage of a live lead, the stage it closed in for a closed one); live and closed sections alike
    ('const S={axis:"book",', 'const S={rec:"",stg:"",axis:"book",'),
    ('const list=LEADS.filter(l=>(!S.rep||l.o===S.rep)&&(!S.q||l.p.toLowerCase().includes(S.q)));',
     'const lastAct=l=>Math.max(0,...l.ev.filter(e=>e.t<=l.age).map(e=>e.t));\n'
     '  const list=LEADS.filter(l=>(!S.rep||l.o===S.rep)&&(!S.q||l.p.toLowerCase().includes(S.q))&&(!S.rec||l.age-lastAct(l)<=Number(S.rec)*24));'),
    ('const live=list.filter(l=>!A[l.id].closed),closed=list.filter(l=>A[l.id].closed);',
     'const stOk=l=>{if(!S.stg)return true;const a=A[l.id],sg=a.cur||a.segs[a.segs.length-1];return !!sg&&STAGES[sg.i].k===S.stg};\n'
     '  const live=list.filter(l=>!A[l.id].closed&&stOk(l)),closed=list.filter(l=>A[l.id].closed&&stOk(l));'),
    ('<button class="needs" data-needs="1"',
     '<span style="display:inline-flex;align-items:center;gap:10px"><span class="lb">Activité</span><select class="in" data-sel="rec" aria-label="Dernière activité">${[["","Depuis toujours"],["7","7 derniers jours"],["30","30 derniers jours"],["90","90 derniers jours"]].map(o=>`<option value="${o[0]}" ${S.rec===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></span>\n'
     '    <span style="display:inline-flex;align-items:center;gap:10px"><span class="lb">Étape</span><select class="in" data-sel="stg" aria-label="Étape">${[["","Toutes les étapes"]].concat(STAGES.map(s=>[s.k,s.n])).map(o=>`<option value="${o[0]}" ${S.stg===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></span>\n'
     '    <button class="needs" data-needs="1"'),
    ('<span class="pk">Résumé · rédigé par Claude à partir des événements · proposition</span>',
     '<span class="pk">${LIVE?"Résumé · à partir des événements":"Résumé · rédigé par Claude à partir des événements · proposition"}</span>'),
    ('const paid=rows.filter(e=>e.k==="paid"&&e.t<=l.age).length?3000:0;',
     'const paid=LIVE?(l.collected||0):rows.filter(e=>e.k==="paid"&&e.t<=l.age).length?3000:0;'),
    ('\nrender();\n</script>',
     '\n/* LNP web edition: real cycles from SKL_CRM.salesCycleView(), the real clock, the CRM team */\n'
     'window.scLive=function(d){LIVE=true;NOW=d.now||Date.now();if(d.sla)SKL_SLA.configure(d.sla);LEADS.splice(0,LEADS.length,...d.leads);'
     'Object.keys(REPS).forEach(k=>delete REPS[k]);Object.assign(REPS,d.reps);if(!d.keep)S.open.clear();'
     'document.getElementById("scMock").hidden=true;const rs=document.getElementById("rep"),v=S.rep;'
     'rs.innerHTML=`<option value="">Tous les commerciaux</option>`+Object.entries(REPS).map(([k,x])=>`<option value="${k}">${x[0]}</option>`).join("");'
     'if(REPS[v])rs.value=v;else S.rep="";rs.hidden=d.role!=="admin";document.body.classList.toggle("ro",d.role==="viewer");'
     'if(d.reasons){REASON_CODE={};OF_REASONS.no=d.reasons.no.map(x=>(REASON_CODE[x[1]]=x[0],x[1]));OF_REASONS.dq=d.reasons.dq.map(x=>(REASON_CODE[x[1]]=x[0],x[1]))}'
     'render()};\n'
     '/* phase 3: the outcome form saves through crm_declare_outcome (the CRM document holds the Supabase client), then reloads */\n'
     'let REASON_CODE={},SAVING=false;\n'
     'function saveLive(l){const f=S.of,c=l&&l.ev.find(e=>e.k==="meetdue");if(!c||!c.cid||SAVING)return;'
     'const a=document.getElementById("ofa"),st=document.getElementById("ofs"),held=f.res==="held";'
     'const dec=held?{yes:"yes",fu:"follow_up",no:"no",dq:"disqualified"}[f.dec]:null;'
     'const p={attendance:held?"held":"no_show",decision:dec};'
     'if(dec==="yes"){p.amount_sold=String(+(a&&a.value||l.a)||0);p.payment_plan=f.inst==="1"?"Payé en une fois":f.inst+" échéances"}'
     'if(dec==="follow_up")p.next_step=(st&&st.value.trim())||"Relance";'
     'if(dec==="no"||dec==="disqualified"){p.reason_code=REASON_CODE[f.reason];if(!p.reason_code)return toast("Choisissez un motif.")}'
     'if(dec==="no")p.nurture=f.nur==="y"?"standard":"none";'
     'SAVING=true;toast("Enregistrement de l’issue…");'
     'Promise.resolve().then(()=>parent.sklCrmDeclare(c.cid,p)).then(()=>{S.ofm=null;renderModal();toast("Issue enregistrée · l’étape, la prochaine étape et les alertes sont recalculées")},'
     'err=>toast("Non enregistré : "+String(err&&err.message||err))).finally(()=>{SAVING=false})}\n'
     'render();\n</script>'),
    # §13 / §14 test 12: a viewer reads everything and sees no write button; a sales has no sales filter (set by scLive)
    ('</style>', '.ro [data-act=outcome],.ro [data-act=reply],.ro [data-act=whop],.ro [data-act=book],.ro .comp,.ro [data-ofsave]{display:none!important}\n'
     # embedded in the CRM lead record (Romain 2026-10-26): the lead's story only, no board, no lead record button, no actions
     # (the lead record has its own); Call analysis buttons still open the analysis window of the CRM document
     'body.emb{background:transparent}.emb .wrap{padding:0;max-width:none}.emb .wrap>:not(#board){display:none!important}'
     '.emb #board{border:0;background:transparent;box-shadow:none;overflow:visible}.emb .det{background:transparent;border:0;padding:0}'
     '.emb [data-pop],.emb .dtool [data-act]{display:none!important}\n</style>'),
    ('function render(){\n  const cal=', 'function render(){\n  if(EMB)return renderEmb();\n  const cal='),
    ('\nrender();\n</script>',
     '\nlet EMB=null;\n'
     'function renderEmb(){document.body.classList.add("emb");const l=LEADS.find(z=>z.id===EMB),bd=document.getElementById("board");bd.className="board";'
     'bd.innerHTML=l?detailHTML(l,analyse(l)):`<div class="dsum" style="padding:8px 2px">Pas encore de chronologie pour ce prospect.</div>`;renderPop();renderModal();'
     'document.querySelectorAll(".story").forEach(el=>{el.scrollLeft=S.sx[el.dataset.story]!=null?S.sx[el.dataset.story]:el.scrollWidth});'
     'if(S.jump){const c=document.querySelector(`.story [data-ev="${S.jump}"],.feed [data-ev="${S.jump}"]`);S.jump=null;if(c){const st=c.closest(".story");if(st){st.scrollLeft=c.closest(".col").offsetLeft-st.clientWidth/2+90;S.sx[st.dataset.story]=st.scrollLeft}c.focus({preventScroll:true})}}'
     'try{const h=bd.offsetHeight+2;frameElement.style.height=h+"px";parent.SKL_TLH=h}catch(_){}}\n'
     'window.scEmbed=function(id){EMB=id;render()};\n'
     'render();\n</script>'),
]:
    assert sc.count(a) == 1, a[:70]
    sc = sc.replace(a, b)
# Sales cycle SLAs v3 (Romain 2026-10-30, docs/crm/18-sales-cycle-slas.md): the rules of supabase/functions/_shared/sla_rules.js
# (one source with the Slack alerts of sla-tick) decide each lead's level (Critical, Late, Due soon), the KPI row takes the whole
# width and gains Due soon and Closed (the closed leads were only at the bottom), and the lane shows every SLA miss at its time
SLA_JS = (ROOT / 'supabase' / 'functions' / '_shared' / 'sla_rules.js').read_text(encoding='utf-8')
# the same frame as Pipeline and Leads (Romain 2026-10-31): the CRM document's padding (40 / 48 px, full width), so the
# Pipeline | Leads | Sales cycle buttons stay in the same place; the demo pill no longer pushes the top bar down
for a, b in [('.wrap{padding:24px 32px 40px;max-width:1480px;margin:0 auto;display:flex;flex-direction:column;gap:16px}',
              '.wrap{padding:40px 48px 48px;max-width:none;margin:0;display:flex;flex-direction:column;gap:16px;position:relative}.wrap>header.top{margin-bottom:12px}'),
             ('.mock{font-size:12px;color:var(--mut);border:1px dashed #D8D3C7;border-radius:999px;padding:3px 12px;align-self:flex-start}',
              '.mock{font-size:12px;color:var(--mut);border:1px dashed #D8D3C7;border-radius:999px;padding:3px 12px;position:absolute;top:10px;left:48px}'),
             ('.seg button{border:0;min-height:44px;padding:0 20px;border-radius:9px;background:transparent;color:var(--ink2);font-size:15px;font-weight:500}',
              '.seg button{border:0;min-height:44px;padding:0 20px;border-radius:9px;background:transparent;color:var(--ink2);font-size:15px;font-weight:500;display:inline-flex;align-items:center;gap:7px}'
              '.seg .cx-n{font-size:11px;background:#EFECE4;border-radius:6px;padding:1px 6px;color:#5E5B53;font-weight:600}'
              # the French labels are longer: at phone width the three views fit with a 16 px gutter
              '@media(max-width:620px){.wrap{padding:24px 16px 32px}.seg button{padding:0 11px}}')]:
    assert sc.count(a) == 1, a[:60]
    sc = sc.replace(a, b)
assert '</' not in SLA_JS
for a, b in [
    ('/* ---------- derived state ---------- */', SLA_JS + '\n/* ---------- derived state ---------- */'),
    ('  return {segs,cur,closed,ball,ftLate,level,risk,past,fut};\n}',
     '  const sla=SKL_SLA.evaluate(l,LIVE&&l.opened?{t0:Date.parse(l.opened),surface:"screen"}:{surface:"screen"}),sw=SKL_SLA.worst(sla);\n'
     '  level=sw==="warn"?"ok":sw;\n'
     '  return {segs,cur,closed,ball,ftLate,level,risk:!closed&&sw==="warn",past,fut,sla};\n}'),
    ('  return h;\n}\nfunction clusters(',
     '  (A.sla||[]).forEach(b=>{if(b.at>l.age+1e-6)return;const lv=b.level,word=lv==="crit"?"Critique":lv==="late"?"En retard":"Bientôt dû";\n'
     '    if(b.open&&lv!=="warn"&&(b.kind||"sales")==="sales")h+=`<div class="slab ${lv}" style="left:${x(b.late)}%;width:${Math.max(.3,x(l.age)-x(b.late))}%"></div>`;\n'
     '    h+=`<span class="slam ${lv}${b.open?"":" done"}" style="left:${x(b.at)}%" data-tip="${b.id} · ${esc(b.name)}${b.open?"":" · résolu"}|${word}${b.kind==="tech"?" (technique)":b.kind==="indicator"?" (indicateur)":""} · ${SKL_SLA.said(b)} ${esc(b.extra)} · objectif ${esc(b.target)}">${lv==="crit"?"!!":"!"}</span>`});\n'
     '  return h;\n}\nfunction clusters('),
    ('const K=[["all","Tous les prospects en cours",live.length,"var(--ink2)"],["crit","Critique",cnt.crit,"var(--crit)"],["late","En retard",cnt.late,"var(--late)"],["sales","Le commercial doit agir",cnt.salesOwes,"var(--ink)"],["calls","Appels sous 24 h",calls24,"var(--info)"],["wait","En attente du prospect",cnt.wait,"var(--sts)"]];',
     'const won=closed.filter(l=>A[l.id].closed==="won").length;\n'
     '  const K=[["all","Prospects en cours",live.length,"var(--ink2)","dans le pipeline"],["crit","Critique",cnt.crit,"var(--crit)","seuil critique du SLA dépassé"],'
     '["late","En retard",cnt.late,"var(--late)","un objectif de SLA manqué"],["risk","Bientôt dû",cnt.risk,"var(--gold)","agir avant que l’objectif soit manqué"],'
     '["sales","Le commercial doit agir",cnt.salesOwes,"var(--ink)","la prochaine étape est à nous"],["calls","Appels sous 24 h",calls24,"var(--info)","à l’agenda"],'
     '["wait","En attente du prospect",cnt.wait,"var(--sts)","à lui d’agir"],["closed","Clos",closed.length,"var(--mut2)",`${won} gagné${won>1?"s":""} · ${closed.length-won} perdu${closed.length-won>1?"s":""}`]];'),
    ('document.getElementById("kpis").innerHTML=K.map(k=>`<button class="kpi" data-f="${k[0]}" aria-pressed="${S.f===k[0]}"><i style="background:${k[3]}"></i><b>${k[2]}</b><span>${k[1]}</span></button>`).join("");',
     'document.getElementById("kpis").innerHTML=K.map(k=>`<button class="kpi" data-f="${k[0]}" aria-pressed="${S.f===k[0]}" style="--k:${k[3]}"><span class="kt"><i></i>${k[1]}</span><b>${k[2]}</b><small>${k[4]}</small></button>`).join("");'),
    ('return S.f==="all"||', 'return S.f==="all"||(S.f==="risk"&&a.risk)||'),
    ('const rows=live.filter(keep).sort(SORT[S.sort]);', 'const rows=(S.f==="closed"?closed:live.filter(keep)).sort(SORT[S.sort]);'),
    (':[["En cours",()=>true]];', ':[[S.f==="closed"?"Clos":"En cours",()=>true]];'),
    ('<div class="sec">Clos · ${closed.length} <button data-closed>${S.showClosed?"Masquer":"Afficher"}</button></div>${S.showClosed?closed.map(row).join(""):""}',
     '${S.f==="closed"?"":`<div class="sec">Clos · ${closed.length} <button data-closed>${S.showClosed?"Masquer":"Afficher"}</button></div>${S.showClosed?closed.map(row).join(""):""}`}'),
    ('<button class="needs" data-needs="1" title="Les alertes du CRM arrivent avec toutes les autres alertes">Alertes du CRM <b>${cnt.crit+cnt.late}</b></button>',
     '<span class="needs" title="Chaque SLA en retard ou critique est publié dans Slack #sales-cycle (espace IDA)">Slack #sales-cycle <b>${cnt.crit+cnt.late}</b></span>'),
    ('.kpis{display:flex;gap:10px;flex-wrap:wrap}', '.kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}'
     '@media(max-width:1180px){.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:620px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'),
    ('.kpi{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;min-width:0}',
     '.kpi{display:flex;flex-direction:column;align-items:flex-start;gap:4px;background:#fff;border:1px solid var(--line);border-top:4px solid var(--k);border-radius:12px;padding:12px 14px;min-width:0;text-align:left;cursor:pointer}'
     '.kpi:hover{border-color:var(--ink);border-top-color:var(--k)}.kt{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink2)}.kpi small{font-size:11.5px;color:var(--mut);line-height:1.3}'
     '.slam{position:absolute;top:50%;z-index:4;min-width:16px;height:16px;margin:4px 0 0 -8px;border-radius:8px;padding:0 3px;font:700 10px/16px var(--mono);color:#fff;text-align:center;cursor:help}'
     '.slam.late{background:var(--late)}.slam.crit{background:var(--crit)}.slam.warn{background:var(--gold);color:#1B1B18}'
     '.slam.done{background:#fff;color:var(--late);box-shadow:inset 0 0 0 1.5px currentColor}.slam.done.crit{color:var(--crit)}'
     '.slab{position:absolute;bottom:4px;height:4px;border-radius:2px;z-index:1;background:repeating-linear-gradient(90deg,var(--c,var(--late)) 0 6px,transparent 6px 9px)}'
     '.slab.crit{--c:var(--crit)}.slab.late{--c:var(--late)}'),
    ('.kpi b{font-family:var(--mono);font-size:20px;font-weight:600}', '.kpi b{font-family:var(--mono);font-size:26px;font-weight:600;line-height:1.1}'),
    ('.kpi span{font-size:12.5px;color:var(--mut);line-height:1.3}\n', ''),
    ('.kpi i{width:8px;height:28px;border-radius:4px}', '.kpi i{width:8px;height:8px;border-radius:50%;background:var(--k)}'),
]:
    assert sc.count(a) == 1, a[:70]
    sc = sc.replace(a, b)
# Romain 2026-10-29: past 72 h the Sales cycle counts in days, not hours (the lead record's timeline is the same document)
sc, k = re.subn(r'function fmtH\(h\)\{h=Math\.max\(0,h\);return ', 'function fmtH(h){h=Math.max(0,h);if(h>=72){const d=h/24;return (d<10?(Math.round(d*10)/10).toString().replace(/\\.0$/,"").replace(".",","):Math.round(d))+" j"}return ', sc)
assert k == 1, 'fmtH'
for pat, rep, n in [(r'h \$\{fmtH\(([^`]*?)\)\.replace\(" h",""\)\}', r'${atH(\1)}', 4), (r'hour \$\{fmtH\(', '${atH(', 4), (r'"h "\+fmtH\(', 'atH(', 1),
                    (r'h \$\{fmtH\(', '${atH(', None),
                    (r'\$\{(STAGES\[st\]\.tgt|st\.tgt|c\.tgt|STAGES\[z\.i\]\.tgt|s\.tgt)\} h', r'${fmtH(\1)}', 8), (r'\$\{h\} h<', '${fmtH(h)}<', 2)]:
    sc, k = re.subn(pat, rep, sc)
    assert (k == n) if n is not None else k >= 0, (pat, k)
sc = sc.replace('function fmtH(h){', 'function atH(h){return h>=72?"jour "+fmtH(h).replace(" j",""):"h "+fmtH(h).replace(" h","")}\nfunction fmtH(h){', 1)
SCJS = ('<script>var SKL_SC_DOC=' + json.dumps(sc).replace('</', '<\\/') + ';\n'
  'var SKL_SCF=null;\n'
  'function sklCycle(show){if(!show){if(SKL_SCF)SKL_SCF.style.display="none";return false}'
  'if(!SKL_SCF){SKL_SCF=document.createElement("iframe");SKL_SCF.title="Cycle de vente";'
  'SKL_SCF.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:40;background:#F6F4EF";'
  'SKL_SCF.addEventListener("load",function(){sklCyclePush(false);sklCycleTabs()});SKL_SCF.srcdoc=SKL_SC_DOC;document.body.appendChild(SKL_SCF)}'
  'SKL_SCF.style.display="block";sklCycleTabs();return true}\n'
  # the same buttons as the CRM's Pipeline | Leads | Sales cycle, Leads count included, so they stay in place (Romain 2026-10-31)
  'function sklCycleTabs(){try{var b=SKL_SCF.contentDocument.querySelector(\'[data-cxtab="leads"]\');if(b)b.innerHTML=\'Prospects <span class="cx-n">\'+LEADS.length+"</span>"}catch(e){}}\n'
  'var SKL_TLH=0;\n'
  'function sklTimeline(l){var box=document.getElementById("cxTl");if(!box)return;var d=window.sklScData;'
  'if(!l.live||!d){box.innerHTML=\'<div class="cx-panel small mut">\'+(l.live?"Chargement de la chronologie…":"La chronologie des appels et des messages du prospect s\\u2019affiche dans l\\u2019édition web, à partir de ses vrais événements.")+"</div>";return}'
  'if(!d.leads.some(function(z){return z.id===l.id})){box.innerHTML=\'<div class="cx-panel small mut">Pas encore de chronologie : ce prospect n\\u2019a jamais pris de rendez-vous.</div>\';return}'
  'var f=document.createElement("iframe");f.title="Chronologie";f.style.cssText="width:100%;border:0;display:block;background:transparent;height:"+(SKL_TLH||330)+"px";'
  'f.addEventListener("load",function(){try{var w=f.contentWindow;w.scEmbed(l.id);w.scLive(Object.assign({keep:true},window.sklScData))}catch(e){console.error(e)}});'
  'f.srcdoc=SKL_SC_DOC;box.appendChild(f)}\n'
  'document.head.insertAdjacentHTML("beforeend","<style>.cx-tl:empty{display:none}.cx-modal.cx-full{left:0;top:0;transform:none;width:100%;height:100%;border-radius:0;animation:none}.cx-full .cx-mh{padding-right:84px}</style>");\n'
  'function sklCyclePush(keep){try{if(SKL_SCF&&window.sklScData&&SKL_SCF.contentWindow.scLive)SKL_SCF.contentWindow.scLive(Object.assign({keep:keep},window.sklScData))}catch(e){console.error(e)}}\n'
  'window.sklCrmTab=function(t){S.cx.tab=t;closeMenu();renderCRM()};</script>')
crm = crm.replace('</body>', SCJS + '</body>', 1) if '</body>' in crm else crm + SCJS

# ---- call analysis (call-analysis/PLAN.md phase 3): one window over the CRM document (skl-os/crm/call_analysis.js), opened
# from a chip on the pipeline card, the lead list's Analysis column and Sales cycle; rows from SKL_CRM.caBoard() (web edition)
CA = ('<script>' + (ROOT / 'skl-os' / 'crm' / 'transcript_parse.js').read_text(encoding='utf-8') + '</script>'
      '<script>' + (ROOT / 'skl-os' / 'crm' / 'call_analysis_view.js').read_text(encoding='utf-8') + '</script>'
      '<script>' + (ROOT / 'skl-os' / 'crm' / 'call_analysis.js').read_text(encoding='utf-8') + '</script>'
      '<script>(function(){'
      'document.addEventListener("click",function(e){var b=e.target.closest("[data-ca]");if(!b)return;e.preventDefault();e.stopPropagation();'
      'var l=typeof byD==="function"?byD(b.dataset.cycle):null;SKL_CA.open(b.dataset.ca,{person:l?l.p:"",sales:l?byS(l.o).name:""})},true);'
      # Romain 2026-10-27 (mock-up "Analyse d'un appel"): the analysis of a call shows in its lead record, under Call analysis
      'SKL_CA.showInLead=function(cy,c){if(typeof byD!=="function"||!byD(cy))return false;if(!S.cx.lead||S.cx.lead.id!==cy)openLead(cy);'
      'SKL_CA.select(cy,c);S.cx.lead.tab="analyse";renderLead();return true};'
      'function caLoad(C){if(!C.caBoard)return Promise.resolve();return C.caBoard().then(function(r){window.SKL_CA_ROWS=r;renderAll();if(S.cx.lead&&byD(S.cx.lead.id))renderLead()},function(e){console.error(e)})}'
      # the live CRM may start before this script runs (C.ready() resolves while the page is still parsing): start from both sides, once
      'var ON=false;function caStart(C){if(ON)return;ON=true;SKL_CA.onChange(function(){caLoad(C)});caLoad(C);setInterval(function(){if(!document.hidden)caLoad(C)},300000)}'
      'var _live=window.sklCrmLive;window.sklCrmLive=function(C){var p=_live(C);caStart(C);return p};'
      'try{var C0=window.parent&&window.parent!==window&&window.parent.SKL_CRM;if(C0)C0.ready().then(function(){if(C0.mode()==="live")caStart(C0)})}catch(e){}'
      '})();</script>')
crm = crm.replace('</body>', CA + '</body>', 1) if '</body>' in crm else crm + CA
for a, b in [
    ('${meta?`<div class="cx-meta">${meta}</div>`:""}',
     '${meta?`<div class="cx-meta">${meta}</div>`:""}${typeof SKL_CA!=="undefined"?SKL_CA.chip(l.id):""}'),
    ('${C.nx?th("nx",t("cx_th_nx")):""}</tr></thead>', '${C.nx?th("nx",t("cx_th_nx")):""}<th class="cx-th">Analyse</th></tr></thead>'),
    ('${C.nx?`<td class="cx-tdnx">${nxHtml(l)}</td>`:""}</tr>`).join("");',
     '${C.nx?`<td class="cx-tdnx">${nxHtml(l)}</td>`:""}<td>${typeof SKL_CA!=="undefined"?SKL_CA.chip(l.id):""}</td></tr>`).join("");'),
    ('<td colspan="11" class="empty">', '<td colspan="12" class="empty">'),
    # the lead record (Romain 2026-10-26): its Prospect analysis tab lists the lead's R1 / R2 calls and opens their analysis
    ('  const body=Lx.tab==="analyse"\n    ?(hasTr?renderAnalysis(l)',
     '  const body=Lx.tab==="analyse"\n    ?(l.live&&typeof SKL_CA!=="undefined"?SKL_CA.leadPanel(l.id):hasTr?renderAnalysis(l)'),
    # a call ahead is upcoming even on a won lead (a won lead's R3 on the 28th read "past")
    ('${past||["realise","close","perdu","noshow"].includes(l.st)?t("cx_past"):t("cx_upcoming")}',
     '${(l.live?(past||l.rdv.d<0):(past||["realise","close","perdu","noshow"].includes(l.st)))?t("cx_past"):t("cx_upcoming")}'),
    # the lead record (Romain 2026-10-26): the Sales cycle timeline of the lead at the top (sklTimeline), in place of the
    # vertical cycle of the right column, which is gone
    ('    <div class="cx-mbody"><div class="cx-main">\n      <div class="cx-callrow">',
     '    <div class="cx-mbody"><div class="cx-main">\n      <div class="cx-tl" id="cxTl"></div>\n      <div class="cx-callrow">'),
    # Romain 2026-10-29: no Next action and no Sales note under the tabs any more (cxKeep is gone)
    ('      ${body}\n    </div>${cxSide(l,past)}</div>', '      ${body}\n    </div></div>'),
    ('  {const f=document.getElementById("cyForm");if(f)', '  sklTimeline(l);\n  {const f=document.getElementById("cyForm");if(f)'),
    # Romain 2026-10-27, mock-up "Analyse d'un appel · lead record": in the web edition the record shows the lead's analysed calls
    # and "Call analysis" with the chosen call's analysis (SKL_CA.leadView), in place of the call row, the two tabs and the old panel
    ('      <div class="cx-callrow">${IC.phone} ${callchip}<span>${t(l.tour>1?"cx_calls":"cx_call",{n:l.tour})}</span></div>',
     '      ${l.live&&typeof SKL_CA!=="undefined"?"":`<div class="cx-callrow">${IC.phone} ${callchip}<span>${t(l.tour>1?"cx_calls":"cx_call",{n:l.tour})}</span></div>`}'),
    ('      <div class="cx-mtabs-row"><div class="cx-mtabs" role="tablist">',
     '      ${l.live&&typeof SKL_CA!=="undefined"?SKL_CA.leadView(l.id,{person:l.p,sales:s.name,next:l.rdv&&!past&&l.rdv.d>=0?callchip:""}):`<div class="cx-mtabs-row"><div class="cx-mtabs" role="tablist">'),
    ('      ${body}\n    </div></div>', '      ${body}`}\n    </div></div>'),
    # Romain 2026-10-27: in the web edition the lead record (with its call analysis) fills the whole CRM area, right of the sidebar
    ('  <div class="cx-modal" role="dialog" aria-modal="true" aria-labelledby="lT">',
     '  <div class="cx-modal${l.live?" cx-full":""}" role="dialog" aria-modal="true" aria-labelledby="lT">'),
    # nothing signed and nothing collected is not "Fully collected"
    ('function payLine(l){const left=l.a-l.col;',
     'function payLine(l){if(!l.a&&!l.col)return `<span>Aucun montant signé</span>`;const left=l.a-l.col;')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
# ---- cash entered by hand (022_crm_manual_cash.sql, Romain 2026-10-26): the amount signed and the payments received, from the
# lead record (Invoicing and payment) or its card, in the web edition; Whop's payments come later on their own (phase 5)
CASH = '<script>' + (ROOT / 'skl-os' / 'crm' / 'cash_ui.js').read_text(encoding='utf-8') + '</script>'
crm = crm.replace('</body>', CASH + '</body>', 1) if '</body>' in crm else crm + CASH
# ---- the outcome of a call, declared from the Pipeline too (Romain 2026-11-05): the Sales cycle's form, same RPC (outcome_ui.js)
OUTCOME = '<script>' + (ROOT / 'skl-os' / 'crm' / 'outcome_ui.js').read_text(encoding='utf-8') + '</script>'
crm = crm.replace('</body>', OUTCOME + '</body>', 1) if '</body>' in crm else crm + OUTCOME
# ---- the lead record (Romain 2026-11-05, the approach of the reference screenshots in LNP's design): on the left the lead's
# sales cycle as a vertical feed by day with its filters, on the right « À faire » (lead_feed.js), its sales calls and the
# call analysis (SKL_CA.leadView); the horizontal timeline stays in CRM › Sales cycle
FEED = ('<script>' + (ROOT / 'skl-os' / 'crm' / 'lead_feed.js').read_text(encoding='utf-8') + '</script>'
        '<script>function sklLfView(id){var d=window.sklScData;return d&&(d.leads||[]).find(function(z){return z.id===id})||null}'
        'function sklRo(){var d=window.sklScData;return !d||d.role==="viewer"}'
        'if(window.SKL_LEADFEED)SKL_LEADFEED.bind(document);'
        'document.head.insertAdjacentHTML("beforeend","<style>.lf-grid{display:grid;grid-template-columns:minmax(340px,500px) minmax(0,1fr);gap:28px;align-items:start}'
        '.lf-side{position:sticky;top:0;height:calc(100vh - 150px);min-height:420px;display:flex;flex-direction:column;background:#fff;border:1px solid #E3DFD5;border-radius:16px;padding:18px 16px 6px 20px}'
        '.lf-side .lf{flex:1;min-height:0}.lf-side .lf-ls{flex:1;min-height:0}.lf-main{display:flex;flex-direction:column;gap:22px;min-width:0}'
        '@media(max-width:1100px){.lf-grid{grid-template-columns:1fr}.lf-side{position:static;height:auto;max-height:560px}}</style>")</script>')
crm = crm.replace('</body>', FEED + '</body>', 1) if '</body>' in crm else crm + FEED
for a, b in [
    ('    <div class="cx-mbody"><div class="cx-main">\n      <div class="cx-tl" id="cxTl"></div>',
     '    <div class="cx-mbody"><div class="cx-main">\n      ${l.live&&window.SKL_LEADFEED&&sklLfView(l.id)?`<div class="lf-grid"><aside class="lf-side">${SKL_LEADFEED.feed(sklLfView(l.id),{newest:true,calls:false})}</aside><div class="lf-main">${SKL_LEADFEED.todo(sklLfView(l.id),{ro:sklRo()})}`:`<div class="cx-tl" id="cxTl"></div>`}'),
    ('      ${body}`}\n    </div></div>', '      ${body}`}${l.live&&window.SKL_LEADFEED&&sklLfView(l.id)?"</div></div>":""}\n    </div></div>'),
    ('  sklTimeline(l);\n', '  sklTimeline(l);if(window.SKL_LEADFEED)SKL_LEADFEED.settle(document);\n')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
for a, b in [
    ('    ${X.show.nx?nxHtml(l):""}\n    ${warm}',
     '    ${X.show.nx?nxHtml(l):""}\n    ${window.sklOutcome?sklOutcome.button(l):""}\n    ${warm}')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
for a, b in [
    # the panel shows for a won lead and, in the web edition, for any lead in the decision or cash stage or with cash already
    ('${l.st==="close"?`<div class="cx-panel cx-paypanel">',
     '${(l.st==="close"||(l.live&&(l.a||l.col||l.stg==="decision"||l.stg==="cash")))?`<div class="cx-panel cx-paypanel">'),
    # live: Signed and Collected only (no invoices in the CRM)
    ('<div><dt>${t("cx_inv")}</dt><dd>${money(l.inv)}</dd></div>', '${l.live?"":`<div><dt>${t("cx_inv")}</dt><dd>${money(l.inv)}</dd></div>`}'),
    ('${payLine(l)} · ${t("cx_inv_left",{v:money(Math.max(0,l.a-l.inv))})}', '${payLine(l)}${l.live?"":` · ${t("cx_inv_left",{v:money(Math.max(0,l.a-l.inv))})}`}'),
    ('<span>${t("cx_inv")} <b>${money(l.inv)}</b></span>', '<span>${l.live?t("cx_signed"):t("cx_inv")} <b>${money(l.live?l.a:l.inv,l.cur)}</b></span>'),
    # amounts in the deal's currency (024: a deal signed in USD shows in USD; EUR by default)
    ('const money=v=>new Intl.NumberFormat(loc(),{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);',
     'const money=(v,c)=>new Intl.NumberFormat(loc(),{style:"currency",currency:c||"EUR",maximumFractionDigits:0}).format(v);'),
    ('`<span>${t("cx_left",{v:money(left)})}</span>`;}', '`<span>${t("cx_left",{v:money(left,l.cur)})}</span>`;}')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
for a, b in [
    ('Prospects <span class="cx-n">${LEADS.length}</span></button></div>',
     'Prospects <span class="cx-n">${LEADS.length}</span></button><button role="tab" aria-selected="false" data-act="cxtab" data-t="cycle">Cycle de vente</button></div>'),
    ('function renderCRM(){const X=S.cx,el=document.getElementById("v-crm");',
     'function renderCRM(){const X=S.cx,el=document.getElementById("v-crm");if(typeof sklCycle==="function"&&sklCycle(X.tab==="cycle"))return;')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
# Pipeline period (Romain 2026-10-31): 7 days / 30 days / All at the top right, on the lead's latest activity (last event, or an
# upcoming call); the leads with no activity in the period leave the board, the KPIs and the counts
for a, b in [
    ('tab:"pipeline",q:"",owner:"all",born:"all",', 'tab:"pipeline",q:"",owner:"all",born:"all",per:"all",'),
    ('  ${X.tab==="leads"?`<div class="controls">',
     '  ${X.tab==="pipeline"?`<div class="cx-tabs cx-per" role="group" aria-label="Période">${[["7","7 jours"],["30","30 jours"],["all","Tout"]].map(([v,n])=>`<button aria-pressed="${X.per===v}" class="${X.per===v?"on":""}" data-act="cxper" data-v="${v}">${n}</button>`).join("")}</div>`:""}\n  ${X.tab==="pipeline"&&window.cxColOrder?`<button class="btn cx-colreset" data-act="cxcolreset" title="Revenir à l’ordre par défaut des colonnes">Réinitialiser les colonnes</button>`:""}\n  ${X.tab==="leads"?`<div class="controls">'),
    ('    if(X.act!=="all"){', '    if(X.per!=="all"&&!(cxLast(l)>=-Number(X.per)))return false;\n    if(X.act!=="all"){'),
    ('function cxKpis(){', 'function cxKpis(){const LEADS=cxPerLeads();'),
    ('function cxFiltered(mode){', 'function cxPerLeads(){const X=S.cx;return X.per==="all"?LEADS:LEADS.filter(l=>cxLast(l)>=-Number(X.per))}\nfunction cxLast(l){const v=[l.last,l.born,l.rdv?l.rdv.d:null,l.age!=null?-l.age:null].filter(x=>x!=null);return v.length?Math.max(...v):-1e9}\nfunction cxFiltered(mode){'),
    ('    case "cxtab": X.tab=el.dataset.t; closeMenu(); renderCRM(); return true;',
     '    case "cxtab": X.tab=el.dataset.t; closeMenu(); renderCRM(); return true;\n    case "cxper": X.per=el.dataset.v; renderCRM(); return true;')]:
    assert crm.count(a) == 1, a[:60]
    crm = crm.replace(a, b)
# Long follow-up column (Romain 2026-10-31: "les leads qui ont refusé, no show depuis plus de 14 jours, et aucune nouvelle depuis
# plus de 14 jours"): status longfu, set by toLead in the web edition; between R3+ and Won
# Column order per person (Romain 2026-10-31): a column is dragged by its header; the order is saved for the signed-in person only
# (SKL_CRM.setPref "crm.pipeline.cols", 031; in this browser outside the web edition); "Reset columns" goes back to the default
for a, b in [
    ('const STG=["nouveau","planifie","noshow","realise","close","perdu","disq","nobook"];', 'const STG=["nouveau","planifie","noshow","realise","longfu","close","perdu","disq","nobook"];'),
    ('const STC={nobook:"#8E8A80",', 'const STC={longfu:"#B08D57",nobook:"#8E8A80",'),
    ('const COLS=["nouveau","r1","noshow","r2","r3","close","perdu","disq","nobook"];', 'const COLS=["nouveau","r1","noshow","r2","r3","longfu","close","perdu","disq","nobook"];'),
    ('const COLC={nobook:"#8E8A80",', 'const COLC={longfu:"#B08D57",nobook:"#8E8A80",'),
    (' st_nobook:"Sans rendez-vous",', ' st_longfu:"Relance longue", st_nobook:"Sans rendez-vous",'),
    ('const ACT_BY={nobook:["call","calendly"],', 'const ACT_BY={longfu:["reprise","relance","nurturing"],nobook:["call","calendly"],'),
    ('const cols=COLS.map(c=>{const items=list.filter', 'const cols=cxCols().map(c=>{const items=list.filter'),
    ('<div class="cx-ch"><i style="background:${COLC[c]}"></i>', '<div class="cx-ch" draggable="true" data-col="${c}" title="Glisser pour déplacer cette colonne"><i style="background:${COLC[c]}"></i>'),
    ('col.addEventListener("drop",e=>{e.preventDefault();col.classList.remove("over");moveToCol(e.dataTransfer.getData("text/plain"),col.dataset.st)});});',
     'col.addEventListener("drop",e=>{e.preventDefault();col.classList.remove("over");const mc=e.dataTransfer.getData("text/x-skl-col");if(mc){cxMoveCol(mc,col.dataset.st);return}moveToCol(e.dataTransfer.getData("text/plain"),col.dataset.st)});});\n'
     '  document.querySelectorAll(".cx-ch[data-col]").forEach(h=>h.addEventListener("dragstart",e=>{e.stopPropagation();e.dataTransfer.setData("text/x-skl-col",h.dataset.col);e.dataTransfer.effectAllowed="move";closeMenu()}));'),
    ('function cxPipeline(){',
     'function cxCols(){const o=(window.cxColOrder||[]).filter(c=>COLS.includes(c));return o.concat(COLS.filter(c=>!o.includes(c)))}\n'
     'function cxPrefs(){try{const P=window.parent&&window.parent!==window&&window.parent.SKL_CRM;return P||null}catch(e){return null}}\n'
     'function cxSaveCols(o){window.cxColOrder=o;const P=cxPrefs();if(P)P.setPref("crm.pipeline.cols",o).catch(()=>toast("L’ordre des colonnes n’a pas pu être enregistré"))}\n'
     'function cxMoveCol(src,dst){if(src===dst)return;const o=cxCols(),from=o.indexOf(src),to=o.indexOf(dst);if(from<0||to<0)return;o.splice(from,1);o.splice(to,0,src);cxSaveCols(o);renderCRM()}\n'
     '(function(){const P=cxPrefs();if(P)P.ready().then(()=>P.getPref("crm.pipeline.cols")).then(v=>{if(Array.isArray(v)&&v.length){window.cxColOrder=v;if(S.cx.tab==="pipeline")renderCRM()}}).catch(()=>{})})();\n'
     'function cxPipeline(){'),
    ('    case "cxper": X.per=el.dataset.v; renderCRM(); return true;',
     '    case "cxper": X.per=el.dataset.v; renderCRM(); return true;\n    case "cxcolreset": window.cxColOrder=null;{const P=cxPrefs();if(P)P.setPref("crm.pipeline.cols",null).catch(()=>{})} renderCRM(); return true;'),
    ('.cx-head{padding-bottom:4px}', '.cx-head{padding-bottom:4px}.cx-ch[draggable]{cursor:grab}.cx-ch[draggable]:active{cursor:grabbing}.cx-colreset{margin-left:auto;margin-right:10px}')]:
    assert crm.count(a) == 1, a[:70]
    crm = crm.replace(a, b)
(ROOT / 'skl-os' / 'crm_doc.html').write_text(crm, encoding='utf-8')
print('CRM screen', len(out), 'doc', len(crm))

# ---- Sales cockpit: the ALKIMIY Lite dashboard, whole, with the Sales department KRs under it ----
base = (pathlib.Path(__file__).resolve().parent.parent / 'uploads' / 'ALKIMIY_Lite.html').read_text(encoding='utf-8')
base = theme(base)
kr = (ROOT / 'skl-os' / 'sales_kr.html').read_text(encoding='utf-8')
css = ('<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&display=swap" rel="stylesheet">'
       '<style>.side{display:none!important}.app{grid-template-columns:minmax(0,1fr)!important;min-height:0!important}'
       'html,body,.app,.main{background:transparent!important}.wrap{max-width:none;padding-inline:0;padding-block:0 48px}'
       '#sklKR{margin-top:28px;font-family:"IBM Plex Sans",system-ui,sans-serif;color:#1B1B18}'
       '#sklBack{margin-bottom:14px}#v-dash .head>div:first-child{display:none}#v-dash .head{justify-content:flex-end}</style>')
i = base.index('<div class="app">'); d = base[:i] + css + '\n' + base[i:]
d = d.replace('<section class="view" id="v-dash"></section>',
              '<button class="linkbtn" id="sklBack" data-act="goto" data-v="dash" hidden>← Dashboard</button>\n      <section class="view" id="v-dash"></section>', 1)
d = d.replace('<section class="view" id="v-settings"></section>',
              '<section class="view" id="v-settings"></section>\n      <div id="sklKR">' + kr + '</div>', 1)
hook = '''
/* LNP: dashboard first; team rows open the LNP CRM filtered on that sales rep */
{const _rn=renderNav;renderNav=function(){_rn();const k=S.view==="dash";document.getElementById("sklKR").hidden=!k;document.getElementById("sklBack").hidden=k;};}
document.addEventListener("click",e=>{const el=e.target.closest('[data-act="teamrow"]');if(!el)return;e.stopImmediatePropagation();e.preventDefault();try{parent.postMessage({skl:"crm",owner:el.dataset.id},"*")}catch(x){}},true);
S.view="dash";renderAll();'''
k = d.rindex('renderAll();'); d = d[:k] + hook.strip() + d[k + len('renderAll();'):]
(ROOT / 'skl-os' / 'dash_doc.html').write_text(d, encoding='utf-8')
print('dash doc', len(d))

# ---- The same dashboard, rendered in the cockpit page itself (shadow DOM), not in a frame ----
import json as _json
doc = d
body = doc.split('<body>', 1)[1]
styles = re.findall(r'<style>(.*?)</style>', body, flags=re.S)
css = '\n'.join(styles)
css = css.replace(':root', ':host').replace('body{', '.alk-body{')
css = re.sub(r'(^|[}\s])html\{[^}]*\}', r'\1', css)
css = ':host{display:block}[hidden]{display:none!important}\n' + css
html_start = body.index('<div class="app">')
html_end = body.index('<script>', html_start)
markup = body[html_start:html_end]
js = body[html_end + len('<script>'):body.rindex('</script>')]
(ROOT / 'skl-os' / 'dash_shadow.json').write_text(_json.dumps({'css': css, 'html': markup, 'js': js}), encoding='utf-8')
print('dash shadow', len(css), len(markup), len(js))

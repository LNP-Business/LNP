/* LNP › Cockpit commercial : les onglets Exécution, Qualité et Impact (Romain 2026-11-09, tout en français). L'onglet Résultats reste le module LNP_SALES (sales_v2.json).
   Un module pour les trois onglets, monté dans [data-salesexec] ; l'onglet est le data-view du slot (salescockpit_logic.js).
   Édition web : LNP_CRM.salesExecution(jours, commercial) → crm_sales_execution (web/supabase/050_crm_sales_execution.sql).
   Ailleurs : un exemple.
   Règles affichées avec les chiffres : un prospect est gagné pour ces onglets quand son premier paiement arrive dans les 14 jours
   après son premier appel tenu (le R1) ; qualifié = la qualification de LNP (portes 2.2 : Métier, Financement, Décision et
   timing ; la lecture de l'agent quand il a lu l'appel, sinon « inconnu compte comme qualifié ») ; délais et cibles = les SLA de
   LNP (Paramètres › Alertes), bonne pratique quand ils ne disent rien. Chaque taux montre son effectif ; un taux sur moins de 20
   prospects est marqué indicatif. Impact = corrélation, jamais preuve. */
(function () {
  "use strict";
  var CSS = [
    ":host{all:initial;display:block;container-type:inline-size;font:15px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;--line:#E3DFD5;--soft:#ECE8DF;--mut:#5E5B53;--gold:#D9B46A;--goldt:#9A6614;--ok:#2F7D4F;--oks:#E6F2EA;--warn:#B4561E;--warns:#F8E9DE;--bad:#B42318;--bads:#FBE4E1}",
    "*{box-sizing:border-box}button,select{font:inherit;color:inherit}",
    ".wrap{display:flex;flex-direction:column;gap:20px}",
    ".bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.bar .sp{flex:1}",
    ".seg{display:flex;gap:4px;padding:4px;background:var(--soft);border-radius:10px}",
    ".seg button{min-height:32px;padding:0 12px;border:0;border-radius:7px;background:transparent;cursor:pointer;font-size:13px;color:#3D3A33}",
    ".seg button[aria-pressed=true]{background:#1B1B18;color:#fff;font-weight:600}",
    ".sel{height:36px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;padding:0 10px;font-size:13.5px}",
    ".btn{min-height:36px;padding:0 14px;border-radius:10px;border:1px solid #D8D3C7;background:#fff;cursor:pointer;font-size:13.5px;font-weight:600}",
    ".note{font-size:12.5px;color:var(--mut);line-height:1.5}",
    ".card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px;display:flex;flex-direction:column;gap:12px;min-width:0}",
    "h2,h3{font-family:Fraunces,Georgia,serif;font-weight:500;margin:0}h2{font-size:21px}h3{font-size:17px}",
    ".grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}",
    "@container (max-width:900px){.grid{grid-template-columns:1fr}}",
    ".tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
    "@container (max-width:900px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    ".card .tiles{grid-template-columns:repeat(2,minmax(0,1fr))}",
    ".tile{border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;background:#FBF9F4}",
    ".tile b{font:600 24px 'IBM Plex Mono',monospace}.tile span{font-size:12.5px;color:var(--mut)}.tile em{font-style:normal;font-size:11.5px;color:var(--mut)}",
    "table{width:100%;border-collapse:collapse;font-size:13.5px}th{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut);font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}",
    "td{padding:8px;border-bottom:1px solid #EFECE4;vertical-align:middle}tr:last-child td{border-bottom:0}td.n{font-family:'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}th.n{text-align:right}",
    ".rule{font-size:11.5px;color:var(--mut)}",
    ".pill{display:inline-block;font:600 12px 'IBM Plex Mono',monospace;padding:2px 8px;border-radius:999px}",
    ".ok{background:var(--oks);color:var(--ok)}.warn{background:var(--warns);color:var(--warn)}.bad{background:var(--bads);color:var(--bad)}.na{background:var(--soft);color:var(--mut)}",
    ".mini{height:8px;border-radius:4px;background:var(--soft);overflow:hidden;min-width:80px}.mini i{display:block;height:100%}",
    ".ind{font-size:11px;color:var(--warn);font-weight:600;margin-left:6px}",
    ".alert{border:1px solid #EBC7A9;background:var(--warns);border-radius:12px;padding:12px 14px;font-size:13.5px}",
    ".cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
    ".cmp div{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column}.cmp b{font:600 20px 'IBM Plex Mono',monospace}.cmp span{font-size:12px;color:var(--mut)}",
    ".verdict{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}",
    ".cover{padding:60px 20px;text-align:center;color:var(--mut)}",
    "tr.step{cursor:pointer}tr.step:hover td{background:#FBF9F4}tr.step td:first-child b{font-weight:600;border-bottom:1px dotted var(--mut)}",
    ".scrim{position:fixed;inset:0;z-index:80;background:rgba(27,27,24,.5);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:40px 16px}",
    ".dlg{width:min(760px,100%);background:#fff;border-radius:16px;padding:26px 28px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 50px rgba(0,0,0,.25)}",
    ".dlg .kick{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}.dlg h2{font-size:25px;margin-top:4px}",
    ".dlg .x{width:40px;height:40px;border-radius:50%;border:1px solid #D8D3C7;background:#fff;cursor:pointer;font-size:20px;flex-shrink:0}",
    ".dlg h4{margin:0 0 6px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}.dlg p{margin:0;font-size:14.5px;line-height:1.55}",
    ".dlg ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5}",
    ".bm{border-left:3px solid var(--gold);background:#FBF9F4;border-radius:0 10px 10px 0;padding:10px 12px;display:flex;flex-direction:column;gap:4px}.bm b{font-weight:600;font-size:14px;line-height:1.5}.bm span{font-size:12px;color:var(--mut)}"
  ].join("\n");
  var HTML = '<div class="wrap" id="sx"></div>';
  var MIN = 20;   // sous 20 prospects, un taux est indicatif

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
  function fmtP(v) { return v == null ? "—" : v + " %"; }
  function dec(x) { return String(x).replace(".", ","); }
  function ind(n) { return n < MIN ? '<span class="ind" title="Moins de ' + MIN + ' prospects : indicatif">n &lt; ' + MIN + '</span>' : ""; }
  function grade(p) { return p == null ? "na" : p >= 80 ? "ok" : p >= 50 ? "warn" : "bad"; }
  function dur(v, unit) {
    if (v == null) return "—";
    var m = unit === "h" ? v * 60 : v;
    if (m < 90) return Math.round(m) + " min";
    if (m < 48 * 60) return dec(Math.round(m / 6) / 10) + " h";
    return dec(Math.round(m / 144) / 10) + " j";
  }
  function target(d) { return (d.unit === "h" ? d.target + " h" : d.target + " min"); }

  // Comment fonctionne chaque étape de l'Exécution et la bonne pratique derrière sa cible (un clic sur une étape l'explique).
  // Les chiffres extérieurs sont ceux d'autres entreprises, cités avec leur source et leur solidité ; l'effet propre à l'équipe est
  // dans Impact.
  var STEPS = {
    speed_to_lead: {
      how: "Le chrono part quand le RDV est pris (iClosed) et s’arrête au premier message, e-mail ou appel envoyé par une personne de l’équipe ; un texte automatique ne compte pas. Chaque appel réservé et passé dans la période est mesuré.",
      why: "La prise de RDV est le moment de plus forte intention. L’attention se déplace en quelques minutes, et la première entreprise qui répond pose le cadre de la conversation.",
      bench: [
        ["Appeler dans les 5 minutes plutôt qu’à 30 : 100 fois plus de chances de joindre le prospect, 21 fois plus de le qualifier.", "Lead Response Management Study, InsideSales.com et James Oldroyd, 2007 : environ 15 000 prospects et 100 000 tentatives d’appel. Données d’un éditeur, non relues par des pairs, mais la mesure la plus citée."],
        ["Les entreprises qui répondaient dans l’heure avaient environ 7 fois plus de chances de qualifier le prospect que celles qui répondaient une heure plus tard ; la réponse moyenne prenait 42 heures et 23 % des entreprises ne répondaient jamais.", "Oldroyd, McElheran et Elkington, « The Short Life of Online Sales Leads », Harvard Business Review, mars 2011 : audit de 2 241 entreprises américaines."]],
      best: "Les deux études mesurent la même chose sous deux angles : la valeur d’un prospect chute le plus vite dans ses premières minutes, donc les minutes comptent plus que la qualité du premier message. D’où le standard « moins de 5 minutes », qui est aussi la cible de LNP (SH-2).",
      tips: ["Un message court et personnel dans les minutes qui suivent : un merci, une question sur sa situation.", "D’abord un message, puis un appel s’il ne répond pas.", "Les alertes de prise de RDV sur le téléphone du commercial de permanence, de 8 h à 22 h."]
    },
    r1_within_48h: {
      how: "De la réservation du R1 au R1 lui-même : dans les temps quand l’appel a lieu dans les 48 heures après sa réservation (SH-3).",
      why: "Entre la réservation et l’appel, la raison de réserver s’estompe, d’autres priorités et d’autres offres arrivent, et les absences augmentent.",
      bench: [
        ["Le taux de présence baisse quand l’écart entre la réservation et le rendez-vous grandit : les outils de prise de rendez-vous et les agences de prospection constatent la meilleure présence pour les rendez-vous du jour même et du lendemain, et une présence bien plus faible au-delà d’environ cinq jours.", "Données d’éditeurs (logiciels de prise de rendez-vous, agences commerciales). Aucune étude relue par des pairs ne donne un chiffre unique : à lire comme une tendance, et à vérifier sur vos prospects dans Impact."]],
      best: "C’est la même décroissance que pour le premier contact, appliquée à l’appel : plus l’attente est courte, plus l’intention de la réservation arrive jusqu’à l’appel.",
      tips: ["Proposer d’abord les créneaux les plus proches ; garder de la place dans les 48 prochaines heures.", "Avancer un RDV fixé à plus de 48 heures.", "Confirmer la veille et rappeler une heure avant."]
    },
    noshow_contact: {
      how: "De l’heure prévue d’un R1 manqué au premier message ou appel de l’équipe ; dans les temps dans les 15 minutes (SH-8).",
      why: "Dans les premières minutes, le prospect est souvent juste en retard ou pris : l’appel peut encore avoir lieu aujourd’hui. Après une heure, cela devient une conversation d’excuses.",
      bench: [
        ["Rappels et contact rapide font remonter la présence : les rappels par SMS font passer les rendez-vous manqués d’environ 21 % à 15 %.", "Méta-analyse de 21 études, environ 16 000 patients, BMJ Open, 2016 (rendez-vous médicaux : le cas le mieux mesuré du même comportement)."]],
      best: "Les absences sont surtout de l’oubli et de la friction, pas un refus ; le contact qui arrive pendant que le créneau est encore ouvert enlève la friction. Les équipes commerciales appliquent la même règle : un message et un appel dans les premières minutes.",
      tips: ["À +5 minutes : « Je suis dans la salle, c’est toujours bon pour toi ? » et un appel.", "Proposer deux nouveaux créneaux dans le même message.", "Deuxième absence : dernière chance."]
    },
    noshow_rebook: {
      how: "Du R1 manqué à la réservation suivante de la même personne ; dans les temps dans les 24 heures (SH-9).",
      why: "Une absence qui n’est pas replanifiée dans la journée revient rarement : l’intention s’estompe comme après une première réservation.",
      bench: [["Même décroissance que pour le premier contact et l’écart entre réservation et appel (voir ces étapes).", "Études citées sur le premier contact et le R1 dans les 48 h."]],
      best: "Replanifier dans la même conversation, pendant que le prospect s’excuse, est le moment le moins coûteux pour récupérer l’appel.",
      tips: ["Replanifier dans le même échange, un créneau dans les 48 heures.", "Si le créneau est loin, envoyer une courte raison de le garder."]
    },
    outcome_declared: {
      how: "De la fin de l’appel à l’issue déclarée dans le CRM ; dans les temps dans les 15 minutes (SH-11).",
      why: "Tous les autres chiffres en dépendent : l’étape, la prochaine action, les alertes, l’analyse et le taux de vente. Un appel non déclaré bloque le prospect.",
      bench: [["Les commerciaux ne passent que 28 % de leur semaine à vendre ; la saisie et l’administratif prennent une grande part du reste.", "Salesforce, State of Sales, 5e édition (enquête de 2022)."],
        ["Les détails d’une conversation s’effacent en quelques heures : la raison, l’objection et la prochaine étape convenue sont les plus justes juste après l’appel.", "La courbe de l’oubli (Ebbinghaus), un classique de la recherche sur la mémoire."]],
      best: "Saisir l’issue d’un geste juste après l’appel coûte une minute ; la reconstituer plus tard coûte plus de temps et perd en précision.",
      tips: ["La déclarer avant l’appel suivant, depuis Ma journée ou le CRM.", "Écrire la prochaine étape avec les mots du prospect."]
    },
    recap_60: {
      how: "De la fin du R1 au premier message ou e-mail de l’équipe ; dans les temps dans les 60 minutes (DE-1).",
      why: "Le récap reprend l’écart, l’offre et la prochaine étape avec les mots du prospect pendant que l’appel est frais ; c’est ce que le prospect montre à la personne qui décide avec lui.",
      bench: [["Une relance dans les 24 heures allait avec un taux de vente 14 % plus élevé et des ventes 11 % plus courtes ; les commerciaux manquaient cette relance de 24 heures 32 % du temps.", "Gong Labs, 2022 : plus d’un million d’interactions sur 103 600 ventes (surtout B2B, cycles plus longs que les nôtres)."]],
      best: "Une fois l’appel fini, c’est la relance qui porte la décision. Dans une vente en un appel avec une fenêtre de décision de 72 heures, le récap doit arriver avant que le prospect ne commence à en discuter : d’où l’heure.",
      tips: ["Trois lignes : où il en est, où il veut aller, l’offre et la date de décision.", "Reprendre ses mots de l’appel.", "L’envoyer avant l’appel suivant de la journée."]
    },
    call_after_r1: {
      how: "Après un R1 sans décision : un appel téléphonique de l’équipe dans les 72 heures (bonne pratique, dans la fenêtre de décision DE-9).",
      why: "Un appel fait sortir la vraie objection ; un message la laisse se taire.",
      bench: [["Aucun chiffre extérieur n’est assez solide pour être cité ici. Votre propre effet est mesuré : la vente avec un appel après le R1, face à sans (Exécution, Interactions commerciales ; Impact).", "Les données de l’équipe."]],
      best: "Ce sont les objections qui bloquent une décision, et elles sortent plus à l’oral qu’à l’écrit : l’appel est la façon pour le commercial de continuer à travailler la décision au lieu de l’attendre.",
      tips: ["Appeler à la date de décision convenue, pas avant.", "Demander ce qu’il reste à décider, puis la décision."]
    },
    decision_72: {
      how: "De l’offre (le R1) à un oui ou un non déclaré ; dans les temps dans les 72 heures (DE-9).",
      why: "Plus une décision attend, plus l’urgence de l’appel s’efface : le temps tue les ventes.",
      bench: [["Relancer vite raccourcit les ventes (11 % plus courtes avec une relance dans les 24 heures).", "Gong Labs, 2022, cité sur le récap."]],
      best: "Une date de décision convenue pendant l’appel transforme « je vais réfléchir » en engagement, et un non clair vaut mieux qu’un long peut-être : il libère du temps pour d’autres prospects.",
      tips: ["Convenir de la date de décision pendant l’appel.", "Demander un oui ou un non à cette date ; bien accueillir le non."]
    },
    yes_to_payment: {
      how: "Du oui au premier paiement ; dans les temps dans les 24 heures (CA-2).",
      why: "Entre le oui et le paiement, les doutes reviennent ; chaque friction (lien, échéancier, carte) leur laisse du temps.",
      bench: [["Aucun chiffre extérieur n’est assez solide pour être cité ici ; le délai et les paiements sont mesurés sur vos prospects.", "Les données de l’équipe."]],
      best: "Le oui est le sommet de l’engagement ; encaisser pendant qu’il est frais, avec l’échéancier prêt, protège la vente.",
      tips: ["Envoyer le lien de paiement pendant l’appel ou juste après.", "Avoir les échéances prêtes avant l’appel."]
    },
    handover_2h: {
      how: "Du premier paiement au premier message de l’équipe ; dans les temps dans les 2 heures (CA-6).",
      why: "Juste après avoir payé, le client cherche la confirmation d’avoir fait le bon choix ; le silence nourrit le doute et les remboursements.",
      bench: [["Aucun chiffre extérieur n’est assez solide pour être cité ici ; les remboursements et leur moment sont dans le CRM.", "Les données de l’équipe."]],
      best: "Un accueil rapide confirme la décision et commence la relation ; répondre au paiement par une prochaine étape et une date est la pratique courante de l’accueil des clients.",
      tips: ["Le remercier, donner la première étape et sa date.", "Présenter qui l’accompagne à partir de maintenant."]
    },
    reply_15: {
      how: "Chaque message d’un prospect, entre 8 h et 22 h (heure de Paris), jusqu’au message, e-mail ou appel suivant de l’équipe ; dans les temps dans les 15 minutes (CO-1).",
      why: "Un prospect qui écrit est engagé maintenant ; la réponse qui arrive pendant qu’il a encore son téléphone en main garde la conversation vivante.",
      bench: [["La même décroissance que pour le premier contact s’applique à chaque message entrant : les réponses en quelques minutes touchent et convertissent bien plus que les réponses en quelques heures.", "Lead Response Management Study (2007) et HBR « The Short Life of Online Sales Leads » (2011), cités sur le premier contact."]],
      best: "Le délai de réponse est la seule chose qu’un commercial maîtrise entièrement, et il se cumule sur toute la conversation.",
      tips: ["Les notifications des messages de prospects activées pendant la journée.", "Une réponse courte maintenant vaut mieux qu’une réponse parfaite dans une heure."]
    }
  };

  // un exemple de la forme de crm_sales_execution, pour la page hors ligne (rien de réel)
  function sample() {
    var imp = function (mn, mw, xn, xw) { return { met_n: mn, met_won: mw, miss_n: xn, miss_won: xw }; };
    return { sample: true, days: 90, cohort: { held: 66, qualified: 54, qual_read: 18, matured: 46, won14: 10 },
      delays: [
        { id: "speed_to_lead", label: "Premier contact du commercial après la prise de RDV", rule: "SH-2", target: 5, unit: "min", n: 180, met: 2, median: 38, impact: imp(1, 0, 45, 10) },
        { id: "r1_within_48h", label: "R1 tenu dans les 48 h après sa réservation", rule: "SH-3", target: 48, unit: "h", n: 180, met: 75, median: 60, impact: imp(22, 7, 24, 3) },
        { id: "noshow_contact", label: "Absence : message et appel", rule: "SH-8", target: 15, unit: "min", n: 120, met: 44, median: 8, impact: null },
        { id: "noshow_rebook", label: "Absence : nouveau créneau réservé", rule: "SH-9", target: 24, unit: "h", n: 120, met: 4, median: 80, impact: null },
        { id: "outcome_declared", label: "Issue déclarée après l’appel", rule: "SH-11", target: 15, unit: "min", n: 70, met: 1, median: 2900, impact: null },
        { id: "recap_60", label: "Récap écrit après le R1", rule: "DE-1", target: 60, unit: "min", n: 66, met: 18, median: 94, impact: imp(12, 5, 34, 5) },
        { id: "call_after_r1", label: "Appel téléphonique après un R1 sans décision", rule: "Bonne pratique (fenêtre DE-9)", target: 72, unit: "h", n: 58, met: 7, median: 4, impact: imp(5, 3, 36, 2) },
        { id: "decision_72", label: "Décision après l’offre", rule: "DE-9", target: 72, unit: "h", n: 52, met: 8, median: 65, impact: null },
        { id: "yes_to_payment", label: "Premier paiement après un oui", rule: "CA-2", target: 24, unit: "h", n: 20, met: 6, median: 30, impact: null },
        { id: "handover_2h", label: "Message de bienvenue après le premier paiement", rule: "CA-6", target: 2, unit: "h", n: 18, met: 7, median: null, impact: null },
        { id: "reply_15", label: "Réponse à un message du prospect (8 h – 22 h)", rule: "CO-1", target: 15, unit: "min", n: 1500, met: 500, median: 43, impact: imp(5, 1, 40, 9) }],
      reactivation: { no_show: { n: 120, contacted_15: 44, rebooked: 14, rebooked_24h: 4, rebook_median_h: 80, held_after: 9, won_after: 2, never_contacted: 30 },
        closing_failure: { n: 25, touched: 5, silent: 20, reactivated: 1, react_median_days: 40, won_after: 0 } },
      interactions: { touches: [{ bucket: "0", n: 18, won: 5 }, { bucket: "1 à 3", n: 18, won: 2 }, { bucket: "4 à 8", n: 7, won: 2 }, { bucket: "9 et plus", n: 3, won: 1 }],
        phone_call: { with_n: 6, with_won: 3, without_n: 40, without_won: 7 }, replied: { yes_n: 24, yes_won: 5, no_n: 22, no_won: 5 },
        reply_time: [{ bucket: "15 min ou moins", n: 5, won: 1 }, { bucket: "15 à 60 min", n: 12, won: 3 }, { bucket: "Plus de 60 min", n: 25, won: 5 }, { bucket: "Pas de réponse attendue", n: 4, won: 1 }] },
      quality: { held_calls: 70, declared: 12, recorded: 66, analysis: { n: 30, spin: 55, objections: 28, gap_present: 0, gap_n: 30, pitch_ok: 0, pitch_n: 30 }, references_missing: true,
        verdicts: { "SQL OUVERT": 6, "NON SQL": 10, "À REVOIR": 2 },
        criteria: [{ k: "metier", name: "Métier", pass: 12, fail: 3, unknown: 3 }, { k: "financement", name: "Financement", pass: 14, fail: 4, unknown: 0 },
          { k: "decision_timing", name: "Décision et timing", pass: 6, fail: 2, unknown: 10 }],
        reasons: [{ label: "Prix", status: "lost", n: 9 }, { label: "Pas le bon moment", status: "lost", n: 7 }, { label: "Injoignable", status: "lost", n: 6 }, { label: "Hors cible", status: "disqualified", n: 3 }] } };
  }

  window.LNP_SALESEXEC = {
    css: CSS,
    html: HTML,
    mount: function (root, tip, toast) {
      var box = root.getElementById("sx");
      var C = window.LNP_CRM, S = { live: false, loading: true, error: "", data: null, days: 90, owner: "", me: null, members: [] };
      function view() { var p = root.host && root.host.parentNode; return (p && p.getAttribute && p.getAttribute("data-view")) || "execution"; }
      function lead() { return !S.live || (S.me && S.me.role === "admin"); }
      function load() {
        S.loading = true; S.error = ""; render();
        Promise.resolve(C && C.ready && C.ready()).then(function () {
          S.live = !!(C && C.mode && C.mode() === "live");
          if (!S.live) { S.data = sample(); S.data.days = S.days; return; }
          return Promise.all([C.me(), C.listMembers ? C.listMembers().catch(function () { return []; }) : []]).then(function (r) {
            S.me = r[0] || { role: "viewer" }; S.members = r[1] || [];
            return C.salesExecution(S.days, S.owner || null);
          }).then(function (res) {
            if (res && res.error) throw new Error(res.error.message || String(res.error));
            S.data = res && res.data ? res.data : res;
          });
        }).then(function () { S.loading = false; render(); }, function (e) { S.loading = false; S.error = String((e && e.message) || e); render(); });
      }

      function head(title, sub) {
        var periods = [7, 30, 90, 180].map(function (d) { return '<button data-days="' + d + '" aria-pressed="' + (S.days === d) + '">' + d + ' j</button>'; }).join("");
        var who = lead() && S.live ? '<select class="sel" data-owner aria-label="Les prospects de qui"><option value="">Tous les commerciaux</option>' +
          S.members.filter(function (m) { return m.active !== false; }).map(function (m) { return '<option value="' + esc(m.id) + '"' + (S.owner === m.id ? " selected" : "") + '>' + esc(m.full_name || m.member_key) + '</option>'; }).join("") + '</select>' : "";
        return '<div class="bar"><div><h2>' + esc(title) + '</h2><div class="note">' + sub + '</div></div><span class="sp"></span>' + who +
          '<div class="seg" role="group" aria-label="Période">' + periods + '</div><button class="btn" data-reload>Actualiser</button></div>' +
          (S.data && S.data.sample ? '<div class="note">Chiffres d’exemple : les vrais s’affichent dans l’édition web, lus dans le CRM.</div>' : "") +
          (S.data && S.data.days < 14 ? '<div class="alert">Sur 7 jours, aucun R1 n’a encore 14 jours : les taux de vente restent vides, ils s’affichent à partir de 30 jours. Les délais, les absences et la qualité sont mesurés.</div>' : "");
      }

      function execution(D) {
        var rows = D.delays.map(function (d) {
          var p = pct(d.met, d.n);
          return '<tr class="step" data-step="' + esc(d.id) + '" tabindex="0" title="Comment fonctionne cette étape et sa bonne pratique"><td><b>' + esc(d.label) + '</b><div class="rule">' + esc(d.rule) + '</div></td><td class="n">' + target(d) + '</td>' +
            '<td><div class="mini"><i class="' + grade(p) + '" style="width:' + (p || 0) + '%;background:currentColor"></i></div></td>' +
            '<td class="n"><span class="pill ' + grade(p) + '">' + fmtP(p) + '</span></td><td class="n">' + dur(d.median, d.unit) + '</td><td class="n">' + d.n + ind(d.n) + '</td></tr>';
        }).join("");
        var R = D.reactivation, ns = R.no_show, cf = R.closing_failure, I = D.interactions;
        var cmp = function (aL, aN, aW, bL, bN, bW) {
          return '<div class="cmp"><div><b>' + fmtP(pct(aW, aN)) + '</b><span>' + aL + ' · ' + aW + '/' + aN + ind(aN) + '</span></div><div><b>' + fmtP(pct(bW, bN)) +
            '</b><span>' + bL + ' · ' + bW + '/' + bN + ind(bN) + '</span></div></div>';
        };
        var buckets = function (list) {
          return '<table><thead><tr><th>Groupe</th><th class="n">Prospects</th><th class="n">Vente à 14 j</th></tr></thead><tbody>' + (list || []).map(function (b) {
            return '<tr><td>' + esc(b.bucket) + '</td><td class="n">' + b.n + '</td><td class="n">' + fmtP(pct(b.won, b.n)) + ind(b.n) + '</td></tr>';
          }).join("") + '</tbody></table>';
        };
        return head("Exécution", "Chaque étape du cycle de vente face à sa cible : la part faite dans les temps, le délai médian et le nombre de cas. Les cibles viennent des SLA de LNP (Paramètres › Alertes) ; en vert à partir de 80 % dans les temps (bonne pratique), en orange à partir de 50 %.") +
          '<div class="card"><h3>Délais</h3><div class="note">Cliquez sur une étape pour voir comment elle fonctionne, la bonne pratique derrière sa cible et pourquoi elle est considérée comme la meilleure.</div><table><thead><tr><th>Étape</th><th class="n">Cible</th><th></th><th class="n">Dans les temps</th><th class="n">Médiane</th><th class="n">Cas</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<div class="grid"><div class="card"><h3>Relance après une absence</h3><div class="tiles">' +
            '<div class="tile"><b>' + fmtP(pct(ns.contacted_15, ns.n)) + '</b><span>Contactés dans les 15 min</span><em>' + ns.contacted_15 + ' / ' + ns.n + ' · jamais : ' + ns.never_contacted + '</em></div>' +
            '<div class="tile"><b>' + fmtP(pct(ns.rebooked, ns.n)) + '</b><span>Replanifiés</span><em>' + ns.rebooked + ' · dans les 24 h : ' + ns.rebooked_24h + '</em></div>' +
            '<div class="tile"><b>' + dur(ns.rebook_median_h, "h") + '</b><span>Délai médian pour replanifier</span><em>cible 24 h (SH-9)</em></div>' +
            '<div class="tile"><b>' + fmtP(pct(ns.won_after, ns.n)) + '</b><span>Gagnés ensuite</span><em>' + ns.won_after + ' · appel tenu ensuite : ' + ns.held_after + '</em></div></div>' +
            '<div class="note">Première absence au R1 de chaque prospect. Règle : un message et un appel dans les 15 min, un nouveau créneau dans les 24 h (SH-8, SH-9).</div></div>' +
          '<div class="card"><h3>Relance après une vente manquée</h3><div class="tiles">' +
            '<div class="tile"><b>' + fmtP(pct(cf.touched, cf.n)) + '</b><span>Contactés après le 14e jour</span><em>' + cf.touched + ' / ' + cf.n + ' · sans contact : ' + cf.silent + '</em></div>' +
            '<div class="tile"><b>' + fmtP(pct(cf.reactivated, cf.n)) + '</b><span>Réactivés</span><em>nouveau RDV ou une réponse</em></div>' +
            '<div class="tile"><b>' + (cf.react_median_days == null ? "—" : dec(cf.react_median_days) + " j") + '</b><span>Délai médian</span><em>depuis le R1</em></div>' +
            '<div class="tile"><b>' + fmtP(pct(cf.won_after, cf.n)) + '</b><span>Gagnés ensuite</span><em>' + cf.won_after + '</em></div></div>' +
            '<div class="note">Un R1 qualifié sans paiement dans les 14 jours. Rythme de relance : J+1, J+2, J+4, J+7, puis chaque semaine ; perte automatique à 30 jours (CL-1).</div></div></div>' +
          '<div class="grid"><div class="card"><h3>Interactions commerciales et vente</h3>' +
            cmp("Avec un appel après le R1", I.phone_call.with_n, I.phone_call.with_won, "Sans appel", I.phone_call.without_n, I.phone_call.without_won) +
            cmp("Le prospect a répondu après le R1", I.replied.yes_n, I.replied.yes_won, "Pas de réponse", I.replied.no_n, I.replied.no_won) +
            '<div class="note">Contacts commerciaux = messages, e-mails et appels d’une personne de l’équipe (jamais un texte automatique), de la fin du R1 au paiement ou au 14e jour.</div>' +
            buckets(I.touches) + '</div>' +
          '<div class="card"><h3>Délai de réponse et vente</h3>' + buckets(I.reply_time) +
            '<div class="note">Le délai médian de chaque prospect pour obtenir une réponse à son message, entre 8 h et 22 h (cible 15 min, CO-1).</div></div></div>';
      }

      function quality(D) {
        var Q = D.quality, A = Q.analysis || {}, V = Q.verdicts || {};
        var crit = '<table><thead><tr><th>Porte</th><th class="n">Ouverte</th><th class="n">Fermée</th><th class="n">Non vérifiée</th></tr></thead><tbody>' +
          (Q.criteria || []).map(function (c) {
            var t = c.pass + c.fail + c.unknown;
            return '<tr><td>' + esc(c.name) + '</td><td class="n">' + c.pass + ' <span class="rule">' + fmtP(pct(c.pass, t)) + '</span></td><td class="n">' + c.fail +
              '</td><td class="n">' + c.unknown + ' <span class="rule">' + fmtP(pct(c.unknown, t)) + '</span></td></tr>';
          }).join("") + '</tbody></table>';
        var verdicts = Object.keys(V).map(function (k) { return esc(k) + ' : ' + V[k]; }).join(" · ");
        var reasons = '<table><thead><tr><th>Motif</th><th>Statut</th><th class="n">Prospects</th></tr></thead><tbody>' + (Q.reasons || []).map(function (r) {
          return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.status === "disqualified" ? "Disqualifié" : "Perdu") + '</td><td class="n">' + r.n + '</td></tr>';
        }).join("") + '</tbody></table>';
        return head("Qualité", "La qualité des appels et de leur suivi : l’analyse d’appel, la qualification porte par porte, pourquoi des prospects sont perdus, et si les données sont fiables.") +
          '<div class="tiles">' +
          '<div class="tile"><b>' + fmtP(pct(Q.declared, Q.held_calls)) + '</b><span>Appels tenus avec une issue</span><em>' + Q.declared + ' / ' + Q.held_calls + ' · cible 100 %</em></div>' +
          '<div class="tile"><b>' + fmtP(pct(Q.recorded, Q.held_calls)) + '</b><span>Appels tenus enregistrés (Fathom)</span><em>' + Q.recorded + ' / ' + Q.held_calls + '</em></div>' +
          '<div class="tile"><b>' + (A.spin == null ? "—" : A.spin) + '</b><span>Découverte (SPIN), sur 100</span><em>' + (A.n || 0) + ' appels analysés</em></div>' +
          '<div class="tile"><b>' + (A.objections == null ? "—" : A.objections) + '</b><span>Traitement des objections, sur 100</span><em>analyse d’appel</em></div></div>' +
          (Q.references_missing ? '<div class="alert"><b>L’écart et la présentation de l’offre ne sont pas encore fiables.</b> La référence de l’offre et la bibliothèque de cas clients de l’analyse d’appel sont vides : aucun appel ne peut les réussir (écart présent ' +
            (A.gap_present || 0) + ' sur ' + (A.gap_n || 0) + ', présentation conforme ' + (A.pitch_ok || 0) + ' sur ' + (A.pitch_n || 0) + '). Remplissez-les avant de lire ces deux notes.</div>' : "") +
          '<div class="grid"><div class="card"><h3>Qualification du prospect</h3>' + crit +
            '<div class="note">La lecture de l’agent de qualification sur le R1 de chaque prospect (portes 2.2 : Métier, Financement, Décision et timing), la plus récente par prospect.' +
            (verdicts ? ' Résultats : ' + verdicts + '.' : '') + ' Un prospect non lu compte comme qualifié, sauf s’il est disqualifié.</div></div>' +
          '<div class="card"><h3>Pourquoi les prospects sont perdus</h3>' + reasons + '<div class="note">Les prospects fermés dans la période, avec leur motif déclaré ou automatique.</div></div></div>';
      }

      function impact(D) {
        var rows = D.delays.filter(function (d) { return d.impact; }).map(function (d) {
          var m = d.impact, a = pct(m.met_won, m.met_n), b = pct(m.miss_won, m.miss_n), lift = (a != null && b) ? a / b : (a && b === 0 ? Infinity : null);
          var v, cls;
          if (m.met_n < 5 || m.miss_n < 5) { v = "Pas assez de données"; cls = "na"; }
          else if (lift >= 1.5) { v = "Fait vendre"; cls = "ok"; }
          else if (lift >= 1.1) { v = "Un certain effet"; cls = "warn"; }
          else if (lift < 0.9) { v = "Effet inverse : à vérifier"; cls = "bad"; }
          else { v = "Pas d’effet visible"; cls = "na"; }
          return { d: d, m: m, a: a, b: b, lift: lift, v: v, cls: cls, firm: m.met_n >= MIN && m.miss_n >= MIN };
        }).sort(function (x, y) { return (y.lift === Infinity ? 99 : y.lift || 0) - (x.lift === Infinity ? 99 : x.lift || 0); });
        var tbl = '<table><thead><tr><th>Étape</th><th class="n">Vente si dans les temps</th><th class="n">Si manquée</th><th class="n">Effet</th><th>Lecture</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td>' + esc(r.d.label) + '<div class="rule">' + esc(r.d.rule) + ' · cible ' + target(r.d) + '</div></td>' +
              '<td class="n">' + fmtP(r.a) + ' <span class="rule">(' + r.m.met_won + '/' + r.m.met_n + ')</span>' + ind(r.m.met_n) + '</td>' +
              '<td class="n">' + fmtP(r.b) + ' <span class="rule">(' + r.m.miss_won + '/' + r.m.miss_n + ')</span>' + ind(r.m.miss_n) + '</td>' +
              '<td class="n">' + (r.lift == null ? "—" : r.lift === Infinity ? "∞" : "×" + dec(Math.round(r.lift * 10) / 10)) + '</td>' +
              '<td><span class="verdict ' + r.cls + '">' + r.v + '</span>' + (r.firm || r.cls === "na" ? "" : ' <span class="rule">indicatif</span>') + '</td></tr>';
          }).join("") + '</tbody></table>';
        var keep = rows.filter(function (r) { return r.cls === "ok"; }).map(function (r) { return esc(r.d.label); });
        return head("Impact", "Les étapes qui font vraiment vendre : le taux de vente des prospects qualifiés dont l’étape a été faite dans les temps, face à ceux dont l’étape a été manquée. Il dit où mettre l’effort de l’équipe ; c’est une corrélation, pas une preuve.") +
          '<div class="card"><h3>Étapes et vente</h3>' + tbl +
          '<div class="note">Base : les R1 tenus et qualifiés de la période, d’au moins 14 jours ; gagné = payé dans les 14 jours. « Fait vendre » à partir de ×1,5 avec au moins 5 prospects de chaque côté ; « indicatif » sous ' + MIN + ' prospects d’un côté. ' +
          'À revoir chaque mois : garder et pousser les étapes qui font vendre, tester celles sans effet visible, et retirer un délai qui ne fait bouger aucun résultat en 8 semaines.</div></div>' +
          '<div class="card"><h3>Ce qu’il faut pousser maintenant</h3><div class="note">' + (keep.length ? keep.join(" · ") : "Pas encore assez de données sur aucune étape.") + '</div>' +
          '<div class="note">Puis tester, un changement à la fois : proposer chaque R1 dans les 48 h, envoyer le récap dans l’heure, appeler (pas seulement écrire) après chaque R1 sans décision, et recontacter chaque absent dans les 15 minutes.</div></div>';
      }

      // une étape de l'Exécution, expliquée (STEPS), avec les chiffres de l'équipe
      function stepPop(id) {
        var d = (S.data && S.data.delays || []).filter(function (x) { return x.id === id; })[0], T = STEPS[id];
        if (!d || !T) return;
        var p = pct(d.met, d.n), m = d.impact;
        var own = '<div class="cmp"><div><b>' + fmtP(p) + '</b><span>dans les temps (' + d.met + ' / ' + d.n + ')' + ind(d.n) + '</span></div><div><b>' + dur(d.median, d.unit) + '</b><span>délai médian · cible ' + target(d) + '</span></div></div>' +
          (m ? '<div class="cmp"><div><b>' + fmtP(pct(m.met_won, m.met_n)) + '</b><span>vente si dans les temps (' + m.met_won + '/' + m.met_n + ')' + ind(m.met_n) + '</span></div><div><b>' + fmtP(pct(m.miss_won, m.miss_n)) +
            '</b><span>vente si manquée (' + m.miss_won + '/' + m.miss_n + ')' + ind(m.miss_n) + '</span></div></div>' : "");
        var host = document.createElement("div");
        host.innerHTML = '<div class="scrim" data-close><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="sxh">' +
          '<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1"><div class="kick">Étape du cycle de vente · ' + esc(d.rule) + '</div><h2 id="sxh">' + esc(d.label) + '</h2></div>' +
          '<button class="x" data-close aria-label="Fermer">×</button></div>' +
          '<div><h4>Comment ça marche</h4><p>' + esc(T.how) + '</p></div>' +
          '<div><h4>Pourquoi c’est important</h4><p>' + esc(T.why) + '</p></div>' +
          '<div><h4>Vos chiffres' + (S.data.sample ? ' (exemple)' : ' · ' + S.days + ' derniers jours') + '</h4>' + own + '</div>' +
          '<div><h4>Bonne pratique et ce que la recherche a mesuré</h4><div style="display:flex;flex-direction:column;gap:8px">' +
            T.bench.map(function (x) { return '<div class="bm"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join("") + '</div></div>' +
          '<div><h4>Pourquoi c’est considéré comme la meilleure</h4><p>' + esc(T.best) + '</p></div>' +
          '<div><h4>Comment l’atteindre</h4><ul>' + T.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>' +
          '<div class="note">Les chiffres extérieurs sont ceux d’autres entreprises, cités avec leur source ; ce que cette étape fait pour vos propres ventes est dans Impact.</div></div></div>';
        var el = host.firstChild;
        var close = function () { el.remove(); document.removeEventListener("keydown", key, true); };
        var key = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
        el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("button[data-close]")) close(); });
        document.addEventListener("keydown", key, true);
        root.appendChild(el); el.querySelector(".x").focus();
      }

      function render() {
        var v = view();
        if (S.loading && !S.data) { box.innerHTML = '<div class="cover">Chargement…</div>'; return; }
        if (S.error) { box.innerHTML = '<div class="cover">Les chiffres ne se sont pas chargés : ' + esc(S.error) + '<br><br><button class="btn" data-reload>Réessayer</button></div>'; return; }
        var D = S.data; if (!D || !D.delays) { box.innerHTML = '<div class="cover">Pas encore de chiffres.</div>'; return; }
        box.innerHTML = v === "quality" ? quality(D) : v === "impact" ? impact(D) : execution(D);
      }

      box.addEventListener("click", function (e) {
        var st = e.target.closest("tr[data-step]"); if (st) return stepPop(st.dataset.step);
        var b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-reload")) return load();
        if (b.dataset.days) { S.days = +b.dataset.days; return load(); }
      });
      box.addEventListener("keydown", function (e) { var st = e.target.closest && e.target.closest("tr[data-step]"); if (st && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); stepPop(st.dataset.step); } });
      box.addEventListener("change", function (e) { if (e.target.hasAttribute("data-owner")) { S.owner = e.target.value; load(); } });
      load();
      return { render: render };
    }
  };
})();

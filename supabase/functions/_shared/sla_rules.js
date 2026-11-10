// LNP CRM · Sales cycle SLAs v3 (docs/crm/18-sales-cycle-slas.md, reference SLAs v3 of 2026-10-25 / 2026-10-30). One source for
// the Sales cycle screen (inlined by app/gen_crm.py), Settings › Alerts (the catalogue, through app/build.py) and the
// Slack alerts (supabase/functions/sla-tick).
// A lead is the screen's model: {age, ev: [{t (hours since the cycle opened), w: s|p|a, k, r, dur (min), rec, ana, stop}]}
// (rec / ana on a call: hours of its Fathom recording / of its call analysis, l.rec = the model carries them; stop on a note:
// the prospect's STOP);
// opt.t0 = the cycle's opening (ms) turns on the sales window of CO-1 / CO-2 (08:00-22:00, opt.tz, default Europe/Paris);
// opt.surface = "screen" | "slack" leaves out the SLAs switched off for that place.
// Each SLA: a start event, a stop event, thresholds in hours (DE-8: calls; SH-4: hours before the R1): warn (preventive),
// late (missed), crit (critical); null = no such threshold.
// kind: sales (sets the lead's level), tech (a data or integration fault, for Romain: never the lead's level),
// indicator (read in Performance: never the lead's level, not posted by default), form (a form rule: no clock).
// needs: the data sources the SLA reads beyond iClosed and Fathom (messages = WhatsApp Business messages of the team; whop = Whop
// links and payments; analysis = the automatic call analysis of every recording). eval: measured by the rules below.
// configure({sources, rules}) applies crm_settings.sla_rules (saved in Settings › Alerts): a source not connected turns its
// SLAs off; per SLA: on, warn / late / crit (only where the reference has that threshold), app (screen), slack.
(function (root) {
  "use strict";
  var M = 1 / 60, D = 24;
  var SOURCES = [
    { id: "messages", name: "Messages WhatsApp de l’équipe" },
    { id: "whop", name: "Liens et paiements Whop" },
    { id: "analysis", name: "Analyse automatique de chaque appel" }
  ];
  var DEFS = [
    // ---------------- Présence · from the booked call to the first call held
    { id: "SH-1", name: "Confirmation automatique", stage: "Présence", kind: "tech", needs: ["messages"], eval: true, unit: "min",
      start: "Prise de RDV dans iClosed", stop: "Confirmation WhatsApp automatique", target: "1 min", warn: null, late: 5 * M, crit: 15 * M,
      esc: "Au-delà de 15 min : alerte technique à Romain",
      why: "Le prospect reçoit tout de suite une trace dans le canal de toute la relation. Un retard vient de l’intégration, pas d’une personne." },
    { id: "SH-2", name: "Premier contact du commercial", stage: "Présence", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Prise de RDV", stop: "Premier message ou appel personnel du commercial", target: "5 min", warn: 3 * M, late: 15 * M, crit: 1,
      esc: "Au-delà de 60 min : critique, Romain alerté",
      why: "La prise de RDV est le pic d’intention du prospect : un contact en 5 minutes multiplie les chances de le joindre." },
    { id: "SH-3", name: "Délai jusqu’au R1", stage: "Présence", kind: "indicator", needs: [], eval: true, unit: "h",
      start: "Prise de RDV", stop: "Heure prévue du R1", target: "48 h", warn: null, late: 72, crit: 96,
      esc: "Au-delà de 96 h : signal d’agenda lu chaque semaine par Romain (pas d’alerte au commercial)",
      why: "Plus l’appel est loin, plus l’intention retombe et plus les absences montent. Il juge l’agenda, pas le commercial." },
    { id: "SH-4", name: "Échange avant l’appel", stage: "Présence", kind: "sales", needs: ["messages"], eval: true, unit: "h", before: true,
      start: "Prise de RDV", stop: "Un message du commercial et une réponse du prospect, avant le R1", target: "avant le R1", warn: 12, late: 3, crit: null,
      esc: "Sans réponse : appel de confirmation du commercial avant le R1",
      why: "Un prospect qui a déjà répondu vient plus souvent et arrive préparé : le meilleur signe avant-coureur du taux de présence." },
    { id: "SH-5", name: "Rappels avant l’appel", stage: "Présence", kind: "tech", needs: ["messages"], eval: false, unit: "h",
      start: "Heure du R1", stop: "Rappels automatiques J-1 et H-2, plus un message personnel le jour même", target: "100 % envoyés", warn: null, late: null, crit: null,
      esc: "Un rappel non envoyé : alerte technique à Romain", pending: "Les rappels automatiques ne passent pas encore par le CRM.",
      why: "Les rappels réduisent les absences ; le message personnel rappelle qu’une personne attend le prospect." },
    { id: "SH-6", name: "R1 honoré à l’heure prévue", stage: "Présence", kind: "sales", needs: [], eval: true, unit: "h",
      start: "Heure prévue du R1 d’origine (absence)", stop: "Un appel tenu", target: "à l’heure prévue", warn: null, late: 0.75, crit: 48,
      esc: "48 h après l’heure prévue sans appel tenu : critique, Romain alerté",
      why: "L’étape Présence est jugée sur la date promise au prospect. Dès que le créneau passe sans appel, le prospect est à récupérer." },
    { id: "SH-7", name: "Déplacement demandé par le prospect", stage: "Présence", kind: "sales", needs: [], eval: false, unit: "h",
      start: "Le prospect déplace l’appel avant l’heure prévue", stop: "Nouveau créneau", target: "au plus 48 h après l’heure d’origine", warn: null, late: 24, crit: null,
      esc: "2e déplacement : avertissement à Romain ; 3e : Romain décide", pending: "iClosed n’indique pas encore qui a déplacé l’appel.",
      why: "Un déplacement est un signal faible, souvent légitime ; le nouveau créneau doit rester proche pour garder l’élan." },
    { id: "SH-8", name: "Relance après une absence", stage: "Présence", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Absence (heure prévue)", stop: "Message ou appel du commercial", target: "15 min", warn: null, late: 1, crit: 24,
      esc: "Au-delà de 24 h : critique",
      why: "Dans le quart d’heure, le prospect est souvent encore joignable et l’appel peut avoir lieu le jour même." },
    { id: "SH-9", name: "Nouveau créneau après une absence", stage: "Présence", kind: "sales", needs: [], eval: true, unit: "h",
      start: "Absence", stop: "Nouvel appel réservé", target: "24 h", warn: 12, late: 24, crit: null,
      esc: "2e absence : critique, Romain décide (dernière chance ou disqualification)",
      why: "Une absence non replanifiée dans la journée se récupère rarement. Après deux absences, la suite est une décision de Romain." },
    { id: "SH-10", name: "Déplacement de notre côté", stage: "Présence", kind: "sales", needs: [], eval: false, unit: "h",
      start: "Le commercial ou LNP déplace un appel prévu", stop: "—", target: "zéro", warn: null, late: null, crit: null,
      esc: "Chaque cas : alerte à Romain, compté dans Performance", pending: "iClosed n’indique pas encore qui a déplacé l’appel.",
      why: "Un appel déplacé par nous dit au prospect qu’il n’est pas prioritaire, juste avant qu’on lui demande de s’engager." },
    { id: "SH-11", name: "Issue déclarée", stage: "Présence", kind: "sales", needs: [], eval: true, unit: "min",
      start: "Fin prévue de l’appel", stop: "Formulaire d’issue rempli", target: "15 min", warn: 10 * M, late: 1, crit: 24,
      esc: "Au-delà de 24 h : critique, Romain alerté",
      why: "Tout le système dépend de cette déclaration : l’étape, la prochaine étape, les alertes et l’analyse." },
    { id: "SH-12", name: "Durée de l’étape Présence", stage: "Présence", kind: "indicator", needs: [], eval: false, unit: "h",
      start: "Prise de RDV", stop: "Premier appel tenu", target: "médiane ≤ 48 h", warn: null, late: null, crit: null,
      esc: "Indicateur sans alerte, lu chaque samedi dans Performance", pending: "Indicateur de pilotage : pas d’alerte.",
      why: "La durée totale sert au pilotage : si elle monte, l’agenda (SH-3) ou la récupération des déplacements faiblit." },
    // ---------------- Décision · from the first call held to a yes or a no
    { id: "DE-1", name: "Récap écrit après l’appel", stage: "Décision", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Fin d’un appel tenu", stop: "Message de récap : l’écart dans les mots du prospect, l’offre, la prochaine étape", target: "60 min", warn: 0.75, late: 3, crit: 24,
      esc: "Au-delà de 24 h : critique",
      why: "Le récap fixe ce que le prospect a dit pendant que c’est frais : c’est le texte qu’il relira au moment de décider." },
    { id: "DE-2", name: "Analyse d’appel disponible", stage: "Décision", kind: "tech", needs: ["analysis"], eval: true, unit: "min",
      start: "Enregistrement Fathom reçu", stop: "Analyse prête dans la fiche prospect", target: "15 min", warn: null, late: 1, crit: 4,
      esc: "Au-delà de 4 h : alerte technique à Romain",
      why: "Le commercial doit pouvoir lire l’analyse avant d’écrire le récap et de préparer l’appel suivant." },
    { id: "DE-3", name: "Prochaine étape datée", stage: "Décision", kind: "form", needs: [], eval: false, unit: "h",
      start: "Issue « Relance »", stop: "Prochaine étape avec une date et une heure", target: "100 % à la déclaration", warn: null, late: null, crit: null,
      esc: "Formulaire bloquant : pas d’enregistrement sans date", pending: "Le formulaire d’issue ne demande pas encore de date.",
      why: "Une relance sans date est un prospect qui dérive. C’est une règle de formulaire, pas une alerte." },
    { id: "DE-4", name: "Prochain appel réservé", stage: "Décision", kind: "sales", needs: [], eval: true, unit: "h",
      start: "Issue « Relance »", stop: "Appel suivant réservé (idéalement pendant l’appel)", target: "24 h", warn: 12, late: 24, crit: 48,
      esc: "Au-delà de 48 h : critique",
      why: "Le R2 se réserve pendant le R1, tant que le prospect est engagé. Au-delà de 24 h, l’agenda se referme." },
    { id: "DE-5", name: "Délai entre deux appels", stage: "Décision", kind: "sales", needs: [], eval: true, unit: "j",
      start: "Appel tenu", stop: "Appel suivant", target: "72 h", warn: null, late: 5 * D, crit: 7 * D,
      esc: "Au-delà de 7 jours : critique",
      why: "À l’étape Décision, l’élan compte plus que tout : un R2 une semaine plus tard ramène la discussion au point de départ." },
    { id: "DE-6", name: "Date promise tenue", stage: "Décision", kind: "sales", needs: [], eval: false, unit: "h",
      start: "Date de décision promise par le prospect", stop: "Contact du commercial ce jour-là", target: "le jour même", warn: null, late: 24, crit: 72,
      esc: "48 h après le lendemain : critique", pending: "Le formulaire d’issue n’enregistre pas encore la date promise.",
      why: "Contacter le jour convenu montre de la fiabilité ; laisser passer la date dit que la décision peut attendre." },
    { id: "DE-7", name: "Relance sans réponse", stage: "Décision", kind: "sales", needs: ["messages"], eval: true, unit: "h",
      start: "Dernier message du commercial sans réponse (étape Décision, pas d’appel prévu)", stop: "Nouvelle tentative ou réponse", target: "24 h", warn: 20, late: 48, crit: 96,
      esc: "Au-delà de 96 h : critique",
      why: "Un rythme serré au début, puis plus large, garde le contact sans harceler." },
    { id: "DE-8", name: "Appels sans décision", stage: "Décision", kind: "sales", needs: [], eval: true, unit: "appels",
      start: "Appels tenus sans oui ni non", stop: "Oui ou non", target: "2 appels au plus", warn: 2, late: 3, crit: null,
      esc: "Revue de l’analyse par Romain avant le 3e appel",
      why: "Au-delà de deux appels, ce qui manque n’est plus de l’information mais une objection jamais isolée." },
    { id: "DE-9", name: "Étape de décision", stage: "Décision", kind: "sales", needs: [], eval: true, unit: "h",
      start: "Premier appel tenu", stop: "Oui ou non déclaré", target: "72 h", warn: 60, late: 72, crit: 144,
      esc: "Au-delà de 144 h : critique, Romain alerté",
      why: "72 h laissent la place à un R1, un récap et un R2 proche ; au-delà de 6 jours, les chances d’un oui chutent." },
    // ---------------- Encaissement · from the yes to the first payment
    { id: "CA-1", name: "Lien de paiement envoyé", stage: "Encaissement", kind: "sales", needs: ["whop"], eval: true, unit: "min",
      start: "Oui déclaré", stop: "Lien Whop envoyé", target: "5 min, idéalement pendant l’appel", warn: null, late: 0.5, crit: 2,
      esc: "Au-delà de 2 h : critique",
      why: "L’intention d’achat n’est jamais aussi forte qu’au moment du oui : le prospect paie avec le commercial en ligne." },
    { id: "CA-2", name: "Premier paiement", stage: "Encaissement", kind: "sales", needs: [], eval: true, unit: "h",
      start: "Oui", stop: "Premier paiement réussi", target: "24 h", warn: 12, late: 24, crit: 48,
      esc: "Au-delà de 48 h : critique, Romain alerté",
      why: "Le cycle est gagné au premier paiement, pas au oui. Un oui non payé à 48 h est souvent un non poli." },
    { id: "CA-3", name: "Relance de paiement", stage: "Encaissement", kind: "sales", needs: ["whop", "messages"], eval: false, unit: "h",
      start: "Lien envoyé sans paiement", stop: "Relance du commercial", target: "à H+4, puis à H+24", warn: null, late: null, crit: null,
      esc: "Relance manquée", pending: "Les liens Whop ne sont pas encore reliés au CRM.",
      why: "Une relance courte avec une aide concrète (autre carte, paiement en plusieurs fois) récupère la plupart des paiements bloqués." },
    { id: "CA-4", name: "Paiement échoué", stage: "Encaissement", kind: "sales", needs: ["whop"], eval: false, unit: "min",
      start: "Paiement Whop échoué ou à valider", stop: "Contact du commercial", target: "15 min", warn: null, late: 1, crit: 4,
      esc: "Au-delà de 4 h : critique", pending: "Les échecs de paiement Whop ne sont pas encore reliés au CRM.",
      why: "Un échec est presque toujours technique : le prospect voulait payer. L’appeler tout de suite évite qu’il abandonne." },
    { id: "CA-5", name: "Oui non payé : clôture", stage: "Encaissement", kind: "sales", needs: [], eval: true, unit: "j",
      start: "Oui sans paiement", stop: "Paiement ou décision de clôture", target: "14 jours", warn: 7 * D, late: null, crit: 14 * D,
      esc: "À 7 jours : revue par Romain ; à 14 jours : à clore « Perdu · non payé » (valeur à confirmer)",
      why: "Le pipeline reste honnête : au-delà, le oui ne doit plus compter dans l’encaissement prévu." },
    { id: "CA-6", name: "Passage à l’accompagnement", stage: "Encaissement", kind: "sales", needs: [], eval: false, unit: "h",
      start: "Premier paiement", stop: "Message de bienvenue et passage de relais", target: "2 h", warn: null, late: 2, crit: 24,
      esc: "Au-delà de 24 h : critique", pending: "Le message de bienvenue n’est pas encore enregistré dans le CRM.",
      why: "Le doute de l’acheteur commence juste après le paiement : un démarrage rapide rassure et protège des remboursements." },
    { id: "CA-7", name: "Remboursement ou litige", stage: "Encaissement", kind: "sales", needs: ["whop"], eval: false, unit: "min",
      start: "Remboursement ou litige Whop", stop: "Romain informé", target: "15 min (automatique)", warn: null, late: null, crit: null,
      esc: "Critique dès l’arrivée", pending: "Les remboursements et litiges Whop ne sont pas encore reliés au CRM.",
      why: "Cela change l’encaissé et peut révéler un problème de promesse : Romain doit le savoir le jour même." },
    // ---------------- Conversation (every stage)
    { id: "CO-1", name: "Réponse à un message du prospect", stage: "Conversation", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Message du prospect", stop: "Réponse du commercial ou appel tenu", target: "15 min dans la plage du commercial", warn: 10 * M, late: 1, crit: 4,
      esc: "Au-delà de 4 h : critique",
      why: "WhatsApp est un canal instantané : le délai de réponse est le premier signe de l’attention qu’on porte au prospect." },
    { id: "CO-2", name: "Message hors plage du commercial", stage: "Conversation", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Message reçu hors 08:00-22:00 (heure du prospect)", stop: "Réponse", target: "dans les 15 premières minutes de la plage suivante", warn: null, late: null, crit: null,
      esc: "Comme CO-1 (désactivée : l’horloge de CO-1 part dès le message, même la nuit)",
      why: "Évite les fausses alertes la nuit sans faire attendre le prospect plus que nécessaire." },
    { id: "CO-3", name: "Appel manqué", stage: "Conversation", kind: "sales", needs: ["messages"], eval: false, unit: "min",
      start: "Appel entrant manqué du prospect", stop: "Rappel du commercial", target: "10 min", warn: null, late: 0.5, crit: 2,
      esc: "Au-delà de 2 h : critique", pending: "Les appels manqués ne sont pas reçus : WhatsApp ne les transmet pas au CRM.",
      why: "Un prospect qui appelle est au sommet de son intention : c’est l’échange qui mérite la réponse la plus rapide." },
    { id: "CO-4", name: "Demande d’arrêt (STOP)", stage: "Conversation", kind: "tech", needs: ["messages"], eval: true, unit: "min",
      start: "Réponse STOP du prospect", stop: "Messages automatiques bloqués", target: "immédiat", warn: null, late: null, crit: null,
      esc: "Tout message automatique après un STOP : critique à Romain",
      why: "Une obligation légale de respecter le consentement et une condition de confiance." },
    { id: "CO-5", name: "Heures d’envoi automatique", stage: "Conversation", kind: "tech", needs: ["messages"], eval: true, unit: "h",
      start: "Message automatique", stop: "Envoyé entre 09:00 et 20:00, heure du prospect (à confirmer)", target: "100 % dans la plage", warn: null, late: null, crit: null,
      esc: "Message envoyé hors plage : alerte technique",
      why: "Un message automatique à 23 h abîme la relation plus qu’il n’aide." },
    // ---------------- Clôture et suivi long terme
    { id: "CL-1", name: "Perte automatique", stage: "Clôture et suivi long terme", kind: "sales", needs: ["messages"], eval: true, unit: "j",
      start: "Dernière réponse du prospect (au moins 4 tentatives depuis, une par jour au plus)", stop: "Réponse ou clôture « injoignable »", target: "30 jours (règle D5)", warn: 27 * D, late: 30 * D, crit: null,
      esc: "À J-3 : avis au commercial ; à 30 jours : à clore « injoignable »",
      why: "L’avis à J-3 laisse au commercial une dernière tentative avant que le prospect quitte le pipeline." },
    { id: "CL-2", name: "Motif de perte", stage: "Clôture et suivi long terme", kind: "form", needs: [], eval: false, applied: true, unit: "h",
      start: "Clôture perdue ou disqualifiée", stop: "Motif choisi dans la liste", target: "100 % à la clôture", warn: null, late: null, crit: null,
      esc: "Formulaire bloquant", pending: "Appliquée : le formulaire d’issue exige un motif.",
      why: "Sans motif, on ne peut ni apprendre (motifs de perte) ni choisir le bon suivi long terme." },
    { id: "CL-3", name: "Réponse à un prospect en suivi long terme", stage: "Clôture et suivi long terme", kind: "sales", needs: ["messages"], eval: true, unit: "min",
      start: "Message d’un prospect après un non", stop: "Réponse du commercial", target: "15 min dans la plage du commercial", warn: 10 * M, late: 1, crit: 4,
      esc: "Au-delà de 4 h : critique",
      why: "Un prospect qui revient de lui-même montre une nouvelle intention : à traiter comme une nouvelle prise de RDV." },
    { id: "CL-4", name: "Archivage du suivi long terme", stage: "Clôture et suivi long terme", kind: "sales", needs: [], eval: false, unit: "j",
      start: "6 mois sans signal", stop: "Suivi long terme archivé", target: "règle D6", warn: 150, late: null, crit: null,
      esc: "À 5 mois : revue ; archivage automatique", pending: "Le suivi long terme n’est pas encore géré par le CRM.",
      why: "La revue à 5 mois évite d’archiver un profil qu’il fallait contacter à la main." },
    // ---------------- Données et fiabilité
    { id: "DO-1", name: "Événement visible dans le CRM", stage: "Données et fiabilité", kind: "tech", needs: [], eval: false, unit: "min",
      start: "Requête reçue (iClosed, WhatsApp, Fathom, Whop)", stop: "Événement dans la fiche prospect", target: "1 min", warn: null, late: 5 * M, crit: 15 * M,
      esc: "Au-delà de 15 min : alerte technique à Romain", pending: "Mesure côté serveur à brancher (file des requêtes reçues).",
      why: "Les SLA en minutes n’ont de sens que si les données arrivent en temps réel." },
    { id: "DO-2", name: "Enregistrement rattaché", stage: "Données et fiabilité", kind: "tech", needs: [], eval: true, unit: "h",
      start: "Fin d’un appel tenu", stop: "Enregistrement Fathom rattaché à l’appel", target: "30 min", warn: null, late: 2, crit: 24,
      esc: "Au-delà de 24 h : alerte à Romain",
      why: "Sans enregistrement, pas d’analyse d’appel et pas de preuve en cas de litige." },
    { id: "DO-3", name: "Événement non rattaché", stage: "Données et fiabilité", kind: "tech", needs: [], eval: false, unit: "h",
      start: "Événement sans prospect identifié", stop: "Résolu dans la file des non rattachés", target: "24 h", warn: null, late: 24, crit: 72,
      esc: "Au-delà de 72 h : critique", pending: "Mesure côté serveur à brancher (file des non rattachés).",
      why: "Un message ou un paiement non rattaché manque à l’historique : la fiche prospect serait fausse." },
    { id: "DO-4", name: "Rapprochement", stage: "Données et fiabilité", kind: "tech", needs: [], eval: false, unit: "h",
      start: "Chaque nuit : comparaison avec iClosed, Fathom et Whop", stop: "Écart nul", target: "écart : 0", warn: null, late: null, crit: null,
      esc: "Tout écart : alerte à Romain", pending: "Le rapprochement de nuit n’existe pas encore.",
      why: "Il garantit que le CRM reste la source de vérité, même si une requête se perd." },
    { id: "DO-5", name: "Source silencieuse", stage: "Données et fiabilité", kind: "tech", needs: [], eval: false, unit: "h",
      start: "Aucune donnée d’une source qui devrait en envoyer", stop: "Une donnée de cette source", target: "aucun silence anormal", warn: null, late: 6, crit: null,
      esc: "Alerte à Romain (ex. 6 h sans événement iClosed un jour ouvré)", pending: "Mesure côté serveur à brancher.",
      why: "Une source muette fausse tous les SLA qui en dépendent." }
  ];
  var STAGES = ["Présence", "Décision", "Encaissement", "Conversation", "Clôture et suivi long terme", "Données et fiabilité"];
  var BY = {}, BASE = {};
  DEFS.forEach(function (d) {
    // the CRM is the base of the alerts (053); Slack is a copy, off by default (Romain 2026-11-09)
    d.on = true; d.app = true; d.slack = false;
    BY[d.id] = d; BASE[d.id] = { warn: d.warn, late: d.late, crit: d.crit, slack: d.slack };
  });
  var SRC = { messages: true, whop: true, analysis: true };

  // crm_settings.sla_rules: {sources: {messages, whop, analysis}, rules: {ID: {on, warn, late, crit, app, slack}}}
  function configure(cfg) {
    cfg = cfg || {};
    var src = cfg.sources || {}, r = cfg.rules || {};
    SOURCES.forEach(function (s) { SRC[s.id] = src[s.id] === undefined ? true : !!src[s.id]; });
    DEFS.forEach(function (d) {
      var o = r[d.id] || {}, b = BASE[d.id];
      d.on = o.on === undefined ? true : !!o.on;
      d.app = o.app === undefined ? true : !!o.app;
      d.slack = o.slack === undefined ? b.slack : !!o.slack;
      ["warn", "late", "crit"].forEach(function (k) { d[k] = b[k] != null && typeof o[k] === "number" && isFinite(o[k]) && o[k] >= 0 ? o[k] : b[k]; });
      // the thresholds keep their order: preventive, then missed, then critical (SH-4 counts hours before the R1: the other way)
      // (a later threshold set below an earlier one is raised to it)
      var up = function (a, z) { if (d[a] != null && d[z] != null && (d.before ? d[a] < d[z] : d[a] > d[z])) d[z] = d[a]; };
      up("warn", "late"); up("late", "crit"); up("warn", "crit");
    });
  }
  // measured here, switched on, its sources connected, and shown in that place
  function active(id, surface) {
    var d = BY[id]; if (!d || !d.eval || !d.on) return false;
    for (var i = 0; i < d.needs.length; i++) if (!SRC[d.needs[i]]) return false;
    if (surface === "screen" && !d.app) return false;
    if (surface === "slack" && !d.slack) return false;
    return true;
  }
  // what Settings shows: measured, waiting for a source, a form rule, an indicator, or not measured yet
  function status(id) {
    var d = BY[id], miss = d.needs.filter(function (s) { return !SRC[s]; });
    if (d.kind === "form") return { k: d.applied ? "form" : "todo", label: d.applied ? "Règle de formulaire · appliquée" : "Règle de formulaire · à appliquer", note: d.pending || "" };
    if (!d.eval) return { k: d.kind === "indicator" ? "ind" : "todo", label: d.kind === "indicator" ? "Indicateur · Cockpit commercial" : "Pas encore mesurée", note: d.pending || "" };
    if (miss.length) return { k: "wait", label: "En attente de données", note: "Source non reliée : " + miss.map(function (s) { return SOURCES.filter(function (x) { return x.id === s; })[0].name; }).join(", ") + "." };
    return { k: "on", label: d.kind === "indicator" ? "Mesurée · indicateur" : d.kind === "tech" ? "Mesurée · technique" : "Mesurée", note: "" };
  }

  var RANK = { ok: 0, warn: 1, late: 2, crit: 3 };
  var TOUCH = { im: 1, sms: 1, call: 1 };
  function sTouch(e) { return e.w === "s" && TOUCH[e.k]; }
  function pTouch(e) { return e.w === "p" && TOUCH[e.k]; }
  function held(e, age) { return e.k === "meet" && e.t <= age; }
  function isCall(e) { return e.k === "meet" || e.k === "meetdue" || e.k === "noshow"; }
  function callEnd(e) { return e.t + (e.dur || 45) / 60; }
  function first(ev, f, from) { for (var i = 0; i < ev.length; i++) if (ev[i].t >= (from || 0) && f(ev[i])) return ev[i]; return null; }
  function hourAt(t, opt, tz) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(opt.t0 + t * 3600e3)).forEach(function (x) { p[x.type] = Number(x.value); });
    return (p.hour || 0) + (p.minute || 0) / 60;
  }

  // CO-2: a message received outside 08:00-22:00 starts the clock at the next 08:00
  function windowStart(t, opt) {
    if (!opt || !opt.t0 || !active("CO-2")) return t;
    var h = hourAt(t, opt, opt.tz || "Europe/Paris");
    return h < 8 ? t + (8 - h) : h >= 22 ? t + (24 - h + 8) : t;
  }

  function evaluate(l, opt) {
    opt = opt || {};
    var ev = (l.ev || []).slice().sort(function (a, b) { return a.t - b.t; }), age = l.age, out = [], surface = opt.surface;
    var closedEv = first(ev, function (e) { return e.t <= age && (e.k === "paid" || (e.k === "decision" && e.no)); });
    var closedAt = closedEv ? closedEv.t : null;
    var on = function (id) { return active(id, surface); };
    function push(id, lv, o) {
      var d = BY[id];
      out.push({ id: id, name: d.name, stage: d.stage, kind: d.kind, target: d.target, level: lv, open: o.open, start: o.start, stop: o.stop == null ? null : o.stop,
        elapsed: o.elapsed, at: o.at, late: o.late == null ? o.at : o.late, extra: o.extra || "", label: o.label || "" });
    }
    // one clock: start, stop (null = still running), the SLA's thresholds; nothing when it stays within the warning
    function clock(id, start, stop, extra, force) {
      var d = BY[id]; if (!on(id) || start == null || start > age) return;
      if (stop == null && closedAt != null && closedAt >= start) stop = closedAt;
      var end = stop == null ? age : stop, el = end - start, open = stop == null;
      var lv = d.crit != null && el >= d.crit ? "crit" : d.late != null && el >= d.late ? "late" : open && d.warn != null && el >= d.warn ? "warn" : "ok";
      if (force && open && lv !== "crit") lv = force;
      if (lv === "ok") return;
      var thr = lv === "crit" ? d.crit : lv === "late" ? d.late : d.warn;
      push(id, lv, { open: open, start: start, stop: stop, elapsed: el, at: start + (thr == null ? 0 : thr),
        late: start + (d.late != null ? d.late : d.crit != null ? d.crit : d.warn != null ? d.warn : 0), extra: extra });
    }
    var booked = first(ev, function (e) { return e.k === "booked"; });
    if (booked) {
      var c1 = first(ev, sTouch, booked.t); clock("SH-2", booked.t, c1 ? c1.t : null, "depuis la prise de RDV");
      var a1 = first(ev, function (e) { return e.w === "a" && e.k === "remind"; }, booked.t); clock("SH-1", booked.t, a1 ? a1.t : null, "depuis la prise de RDV");
    }
    // SH-6: the original R1 at its planned time; a no-show starts the recovery, held when a call is held from then on
    // (an R1 past with no outcome and no recording is SH-11's: declare what happened first)
    var r1 = first(ev, function (e) { return isCall(e) && (e.r || 1) === 1; });
    if (r1 && r1.k === "noshow") {
      var h1 = first(ev, function (e) { return held(e, age); }, r1.t);
      clock("SH-6", r1.t, h1 ? h1.t : null, "depuis le R1 prévu");
    }
    // SH-3: from the booking to the planned R1 (known at the booking: an agenda signal)
    if (booked && r1 && r1.t >= booked.t && on("SH-3")) {
      var d3 = BY["SH-3"], gap = r1.t - booked.t, lv3 = d3.crit != null && gap >= d3.crit ? "crit" : d3.late != null && gap >= d3.late ? "late" : "ok";
      if (lv3 !== "ok") push("SH-3", lv3, { open: r1.t > age, start: booked.t, stop: r1.t, elapsed: gap, at: booked.t, extra: "entre la prise de RDV et le R1" });
    }
    // SH-4: before the R1, a two-way exchange (a sales message, then a prospect reply); thresholds are hours before the R1
    if (booked && r1 && r1.t > booked.t && on("SH-4")) {
      var d4 = BY["SH-4"], s4 = first(ev, function (e) { return sTouch(e) && e.t < r1.t; }, booked.t);
      var p4 = s4 && first(ev, function (e) { return pTouch(e) && e.t < r1.t; }, s4.t + 1e-9);
      if (!p4) {
        var now4 = Math.min(age, r1.t), left = r1.t - now4;
        var lv4 = d4.late != null && left <= d4.late ? "late" : d4.warn != null && left <= d4.warn ? "warn" : "ok";
        if (lv4 !== "ok" && (lv4 === "late" || age < r1.t)) push("SH-4", lv4, { open: age < r1.t, start: booked.t, stop: age < r1.t ? null : r1.t, elapsed: left,
          at: r1.t - (lv4 === "late" ? d4.late : d4.warn), late: r1.t - (d4.late != null ? d4.late : 0), extra: "avant le R1, sans réponse du prospect",
          label: "R1 dans " + fmt(left) });
      }
    }
    var noshows = 0, refused = first(ev, function (z) { return z.k === "decision" && z.no; });
    ev.forEach(function (e, i) {
      if (e.t > age) return;
      if (e.k === "noshow") {
        noshows++;
        var f = first(ev, sTouch, e.t); clock("SH-8", e.t, f ? f.t : null, "depuis l’absence au R" + (e.r || 1));
        // SH-9: a new call booked (a later call already planned counts as booked); the 2nd no-show is Romain's to decide
        var bk = first(ev, function (z) { return z.k === "booked"; }, e.t + 1e-9), later = first(ev, isCall, e.t + 1e-9);
        clock("SH-9", e.t, bk ? bk.t : later ? e.t : null, noshows > 1 ? "· 2e absence : à Romain de décider" : "depuis l’absence au R" + (e.r || 1), noshows > 1 ? "crit" : null);
      }
      if (e.k === "meetdue") clock("SH-11", callEnd(e), null, "depuis la fin du R" + (e.r || 1));
      if (e.k === "meet") {
        var end = callEnd(e), dec = first(ev, function (z) { return z.k === "decision" && (z.r || 0) === (e.r || 0); }, end);
        if (dec) clock("SH-11", end, dec.t, "après le R" + (e.r || 1));
        if (end <= age) {
          var rc = first(ev, sTouch, end); clock("DE-1", end, rc ? rc.t : null, "depuis la fin du R" + (e.r || 1));
          // only on a model that carries the recordings (l.rec: the CRM's cycles, not the sample leads)
          if (l.rec) clock("DO-2", end, e.rec != null ? Math.max(end, e.rec) : null, "depuis la fin du R" + (e.r || 1));
          if (l.rec && e.rec != null) clock("DE-2", e.rec, e.ana != null ? Math.max(e.rec, e.ana) : null, "depuis l’enregistrement du R" + (e.r || 1));
          // DE-5: from this call to the next one (held, due, missed or still ahead), while no yes or no came in between;
          // with no next call at all, DE-4 (no call booked) and DE-9 (decision stage) already say it
          var nx = first(ev, isCall, e.t + 1e-9);
          var yn = first(ev, function (z) { return z.k === "decision" && (z.yes || z.no); }, end);
          if (nx && (!yn || nx.t < yn.t)) clock("DE-5", end, nx.t <= age ? nx.t : null, "jusqu’au R" + (nx.r || (e.r || 1) + 1));
        }
      }
      // DE-4: a follow-up outcome, then the next call booked (a call already planned after this one counts)
      if (e.k === "decision" && e.fu) {
        var bk4 = first(ev, function (z) { return z.k === "booked"; }, e.t + 1e-9), ahead = first(ev, isCall, e.t + 1e-9);
        var nd = first(ev, function (z) { return z.k === "decision" && (z.yes || z.no); }, e.t + 1e-9);
        var st4 = ahead ? e.t : bk4 ? bk4.t : nd ? nd.t : null;
        clock("DE-4", e.t, st4, "depuis l’issue « Relance » du R" + (e.r || 1));
      }
      // CO-1 (CL-3 after a no): the first unanswered prospect message of a burst; a call held in between counts as the answer
      if (pTouch(e)) {
        var prev = null; for (var j = i - 1; j >= 0; j--) { if (sTouch(ev[j]) || held(ev[j], age)) break; if (pTouch(ev[j])) { prev = ev[j]; break; } }
        if (prev) return;
        var ans = first(ev, function (z) { return sTouch(z) || held(z, age); }, e.t + 1e-9);
        clock(refused && refused.t < e.t ? "CL-3" : "CO-1", windowStart(e.t, opt), ans ? ans.t : null, "depuis le message du prospect");
      }
      // CO-4: an automatic message after a STOP; CO-5: an automatic message outside 09:00-20:00 (the prospect's time)
      if (e.w === "a" && e.k === "remind") {
        var stop4 = first(ev, function (z) { return z.stop && z.t < e.t; });
        if (stop4 && on("CO-4")) push("CO-4", "crit", { open: true, start: e.t, elapsed: e.t - stop4.t, at: e.t, extra: "message automatique après un STOP", label: "après un STOP" });
        if (opt.t0 && on("CO-5")) { var hh = hourAt(e.t, opt, opt.tz || "Europe/Paris");
          if (hh < 9 || hh >= 20) push("CO-5", "crit", { open: true, start: e.t, elapsed: 0, at: e.t, extra: "message automatique hors 09:00-20:00", label: "envoyé à " + Math.floor(hh) + " h" }); }
      }
    });
    var h = first(ev, function (e) { return held(e, age); });
    var decided = h && first(ev, function (e) { return e.k === "decision" && (e.yes || e.no); }, h.t);
    if (h) clock("DE-9", h.t, decided ? decided.t : null, "dans l’étape de décision");
    // DE-7: in the Decision stage, the sales wrote last, no call ahead
    if (h && !decided && !first(ev, function (e) { return e.k === "meet" && e.t > age; })) {
      var past = ev.filter(function (e) { return e.t <= age && (sTouch(e) || pTouch(e)); }), last = past[past.length - 1];
      if (last && last.w === "s") clock("DE-7", last.t, null, "depuis le dernier message du commercial");
    }
    // DE-8: calls held with no yes and no no; preventive at the 2nd, missed when the 3rd is planned
    if (h && !decided && on("DE-8")) {
      var d8 = BY["DE-8"], helds = ev.filter(function (e) { return held(e, age); }), ahead8 = ev.filter(function (e) { return (e.k === "meet" && e.t > age) || e.k === "meetdue"; });
      var n8 = helds.length, planned = n8 + ahead8.length;
      var lv8 = d8.late != null && planned >= d8.late ? "late" : d8.warn != null && n8 >= d8.warn ? "warn" : "ok";
      if (lv8 !== "ok") { var at8 = helds[(lv8 === "late" ? n8 : Math.min(n8, d8.warn)) - 1].t;
        push("DE-8", lv8, { open: true, start: h.t, elapsed: n8, at: at8, extra: "sans oui ni non" + (lv8 === "late" ? " · revue par Romain avant le prochain appel" : ""),
          label: n8 + " appel" + (n8 > 1 ? "s" : "") + " tenu" + (n8 > 1 ? "s" : "") }); }
    }
    var yes = first(ev, function (e) { return e.k === "decision" && e.yes; });
    if (yes) {
      var pd = first(ev, function (e) { return e.k === "paid"; }, yes.t);
      clock("CA-2", yes.t, pd ? pd.t : null, "depuis le oui");
      clock("CA-5", yes.t, pd ? pd.t : null, "depuis le oui, sans paiement");
      var pl = first(ev, function (e) { return e.k === "paylink" || e.k === "paid"; }, yes.t);
      clock("CA-1", yes.t, pl ? pl.t : null, "depuis le oui");
    }
    // CL-1: no reply for 30 days with at least 4 attempts (one a day at most) since the last reply
    if (!(h && decided) && !closedAt && on("CL-1")) {
      var lastP = null; ev.forEach(function (e) { if (e.t <= age && pTouch(e)) lastP = e; });
      var from1 = lastP ? lastP.t : booked ? booked.t : 0, days = {};
      ev.forEach(function (e) { if (e.t > from1 && e.t <= age && sTouch(e)) days[Math.floor(((opt.t0 || 0) / 3600e3 + e.t) / 24)] = 1; });
      if (Object.keys(days).length >= 4) clock("CL-1", from1, null, "sans réponse du prospect");
    }
    return out;
  }
  // the worst open level of a lead (its sales SLAs): crit, late, warn or ok
  function worst(list) { var w = "ok"; (list || []).forEach(function (b) { if (b.open && (b.kind || "sales") === "sales" && RANK[b.level] > RANK[w]) w = b.level; }); return w; }
  // shown in French (LNP): decimal comma, "j" for days
  function fmt(h) { return (h < 1 ? Math.round(h * 60) + " min" : h < 72 ? (Math.round(h * 10) / 10) + " h" : Math.round(h / 24 * 10) / 10 + " j").replace(".", ","); }
  // what a miss reads as: its own label (a count, a time before the call) or the time elapsed
  function said(b) { return b.label || fmt(b.elapsed); }
  root.LNP_SLA = { DEFS: DEFS, BY: BY, BASE: BASE, STAGES: STAGES, SOURCES: SOURCES, get sources() { return Object.assign({}, SRC); },
    configure: configure, active: active, status: status, evaluate: evaluate, worst: worst, fmt: fmt, said: said, RANK: RANK };
})(typeof window !== "undefined" ? window : globalThis);

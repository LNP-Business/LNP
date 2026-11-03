# 02 · Écrans et fonctionnalités

Spécification fonctionnelle de chaque écran de la page LNP, assez précise pour la reconstruire. Tout est tiré du code
(chemins cités) ; quand `docs/crm/` dit autre chose, **le code fait foi** et l'écart est signalé (§ 13). Les libellés entre
« » sont ceux que la personne lit, mot pour mot. Les identifiants, clés et valeurs comparées restent en anglais.

Sources principales : `skl-os/build.py` (cadre, routage), `skl-os/nav.py`, `skl-os/shell.py`, `skl-os/store.js`,
`skl-os/kr_view.js`, `proposal/sales-cockpit-v2.html` + `skl-os/gen_sales_v2.py`, `skl-os/salesday_module.js` +
`skl-os/gen_salesday.py`, `uploads/ALKIMIY_Lite.html` + `skl-os/gen_crm.py` (résultat figé : `skl-os/crm_doc.html`),
`docs/crm/reference/sales-cycle-v6.html`, `skl-os/crm/*.js`, `supabase/functions/_shared/sla_rules.js`,
`skl-en/project/Settings.pre-hz.dc.html`, `skl-os/gen_access.py`, `web/public/skl-web.js`, `web/api/*.js`,
`web/supabase/*.sql`.

---

## 1. Le cadre commun

### 1.1 Une page, des écrans

- La page finie est `skl-os/skl-os-en.html` (édition web : `web/public/index.html`, la même page précédée d'un en-tête,
  voir § 1.6). Chaque écran est un gabarit `<template id="tpl-<id>" data-file="<Fichier>.dc.html">` et une classe
  `Component extends DCLogic` (moteur de gabarits maison de `build.py` : trous `{{…}}`, `<sc-if value>`, `<sc-for list as>`,
  événements `onClick="{{fn}}"`). `setState` redessine tout l'écran courant dans `#app`.
- Écrans gardés par `edition.json` (`systems: ["ss"]`, `settings: [Settings, Account, Access]`) :

| id | Fichier | Titre dans la barre latérale |
|---|---|---|
| `salescockpit` | `SalesCockpit.dc.html` | Cockpit commercial (écran d'accueil, `home`) |
| `salesday` | `SalesDay.dc.html` | Ma journée |
| `crm` | `CRM.dc.html` | CRM |
| `settings` | `Settings.dc.html` | Alertes |
| `account` | `Account.dc.html` | Compte |
| `access` | `Access.dc.html` | Accès (administrateurs du web seulement) |

- **Routage** : l'écran courant est dans le hash (`#salescockpit`, `#crm`…), écrit par `history.replaceState`. Un hash
  inconnu ou hors édition renvoie à `home` (table `MOVED`, `build.py`). Les liens `<a href="Xxx.dc.html">` sont interceptés et
  appellent `go(id)` (redessin + `scrollTo(0,0)`). Un message `postMessage({skl:"go", screen})` change aussi d'écran ; un
  message `{skl:"crm", owner}` ouvre le CRM sur le Pipeline filtré sur ce commercial, `{skl:"crm", view:"alerts"}` ouvre la vue
  Alertes du CRM (§ 7.7).
- **Largeur de conception 1440 px** : sous 1440 px, `#app` reçoit `zoom = largeur / 1440` ; au-dessus, la page s'étire. La
  racine fait au moins la hauteur de la fenêtre (`--screen-h`).
- **Barre latérale** (`skl-os/nav.py`, 232 px, fond nuit, collante) : logo LNP 38 px + « Les **Nouveaux** Profs » et
  « VENTES » ; une seule « système », donc pas de sélecteur de système ; groupe repliable « VENTES » (Cockpit commercial,
  Ma journée, CRM) ; sur les écrans de Paramètres, groupe « PARAMÈTRES » (Alertes, Compte, Accès marqué `data-admin-only`) ;
  en bas, bouton « Paramètres » (roue dentée) vers `Settings.dc.html`. L'entrée courante porte `aria-current="page"`. Le pli
  d'un groupe est gardé dans `localStorage["skl-nav-fold"]` ; le groupe de l'écran courant se rouvre à chaque changement
  d'écran. `html:not(.skl-admin) [data-admin-only]{display:none}` cache Accès hors administrateur.
- **Barre du haut** des écrans (`gen_access.py` `bar`, `harmonize.py`) : 54 px, contrôle segmenté à gauche (vues),
  contexte ou actions à droite, 72 px réservés à droite pour le bouton « i ». Pas de titre de page.
- **Redessin et focus** (`build.py`, Romain 2026-11-02) : un redessin ne retire jamais le curseur du champ en cours
  (`focusMark`/`focusBack` retrouvent le champ par son chemin et rendent caret et texte non enregistré). Un changement
  partagé (`SKL.onChange`) qui arrive pendant la saisie attend la perte du focus ; idem pour les modules en shadow root.
  Un `change` d'un champ autre qu'un `select` diffère le redessin d'un tick.
- **Modules en shadow root** : le Cockpit commercial (`window.SKL_SALES`, slot `[data-dash]`) et Ma journée
  (`window.SKL_SALESDAY`, slot `[data-salesday]`) sont montés une fois dans un `div` + `attachShadow`, gardent leur état et
  reçoivent une infobulle (`role="tooltip"`) et une bulle de message (`role="status"`, bas centre) communes.
- **CRM en iframe** : le document CRM (`window.SKL_CRM_DOC`, `skl-os/crm_doc.html`) vit dans une `iframe srcdoc` fixe,
  hors du redessin, placée sur le slot `[data-crm]` à chaque rendu, défilement et redimensionnement. Cycle de vente est une
  seconde iframe dans ce document (§ 7.5).

### 1.2 « Mode d'emploi » (bouton « i »)

Bouton rond 52 px en haut à droite (« i » italique, `aria-label="Mode d’emploi de la page"`). Il ouvre une fenêtre
(`role="dialog"`, 820 px, voile fixe) : sur-titre « Mode d’emploi », titre de l'écran, trois sections numérotées
(1 « À quoi sert cette page », 2 « Ce qu’elle apporte… », 3 « Comment l’utiliser »), bouton « Compris » (« J’ai compris »
dans le CRM) et « × ». Échap ferme (`keydown` de `build.py` remet `info:false`). Textes par écran : § 3.9, 4.8, 7.8, 9.5,
10.4, 11.4. Les mêmes textes alimentent le connecteur Claude (`web/kb/build_kb.mjs` → `web/api/_kb.json`).

### 1.3 Confirmation avant toute suppression

- Page : `window.sklConfirm({title, body, ok, onOk, onCancel, primary, focus, quick})` = `SKL.confirm`
  (`skl-os/kr_view.js`) : voile, `role="alertdialog"`, titre, texte, « Annuler » (focus par défaut) et bouton rouge
  (`ok`, « Supprimer » par défaut). Échap, Annuler ou clic hors de la boîte n'appliquent rien.
- Document CRM : `window.sklAsk(title, body, ok, fn)` (`gen_crm.py`), même aspect, « Annuler » + bouton rouge.

### 1.4 Les trois façons d'ouvrir la page

| Contexte | `store.js` (`SKL.mode`) | `crm/data.js` (`SKL_CRM.mode()`) | Effet |
|---|---|---|---|
| Fichier ouvert tel quel | `demo` | `demo` | données d'exemple, rien n'est enregistré |
| Artifact claude.ai (`window.claude.use` existe, pas `.web`) | `shared` (base de l'Artifact) | `demo` | réglages partagés, CRM d'exemple |
| Édition web (`window.claude.web === true`, `web/public/skl-web.js`) | `shared` (table `docs`) | `live` (tables `crm_*`) | données réelles, sous connexion |

`window.SKL_TODAY = "AAAA-MM-JJ"` fige l'horloge de `store.js` (tests). `store.js` recharge la date chaque minute
(page laissée ouverte la nuit).

### 1.5 Rôles

Deux niveaux de rôles (détail : `web/supabase/001_init.sql`, `003_crm_core.sql`, `011_access_everyone.sql`).

| Rôle de l'équipe (`members.role`, libellé « Accès de l’équipe ») | Rôle CRM créé automatiquement (`crm_members.role`) | Données partagées (`docs`) | CRM : voit | CRM : écrit |
|---|---|---|---|---|
| `admin` « Administrateur · gère l’équipe » | `admin` | lit, écrit | tout | tout (RPC `crm_require`) ; seul à voir/ajouter une analyse d'appel sans être le commercial attitré |
| `member` « Membre · lit et modifie » | `sales_lead` | lit, écrit | tout (`crm_sees_all`) | tout sauf analyse d'appel d'un prospect qu'il n'a pas |
| `viewer` « Lecteur · lit seulement » | `viewer` | lit (écritures ignorées, `SKL.readOnly`) | tout | rien |
| — (posé à la main) | `sales` | — | ses cycles seulement (RLS `owner_id = auth.uid()`) | ses cycles seulement |

Le trigger `members_to_crm` (`011`) crée la ligne `crm_members` à l'invitation : `member_key` = partie locale de l'e-mail
sans caractères spéciaux (suffixe 2, 3… si pris), `full_name` = `initcap` de la partie locale. Une ligne existante n'est
pas modifiée.

### 1.6 Édition web : l'enveloppe

`web/build_web.py` écrit `web/public/index.html` = `<!doctype html><html lang="fr">`, `meta viewport`,
`meta robots noindex`, `<script src="/api/config">` (définit `window.SKL_WEB_CONFIG = {url, anonKey}`),
supabase-js `2.117.2` (jsDelivr), `<script src="/skl-web.js">`, puis la page telle quelle. `skl-web.js` ajoute
`html.skl-locked` (`#app` invisible) jusqu'à la connexion, et définit `window.claude = {web:true, use(name)}` qui résout
`"db"` (collections `docs` + Realtime), `"user"`, `"assets"` (Storage `library` via `/api/files`), `"crm"` (tables et RPC
`crm_*` seulement : `from()` et `rpc()` refusent tout autre nom) une fois connecté.

---

## 2. Connexion et mots de passe (édition web)

Fichier : `web/public/skl-web.js` (`showGate`, `enter`, `authFr`), API : `web/api/me.js`, `web/api/team.js`.

### 2.1 Fenêtre de connexion (`#skl-gate`)

Plein écran, carte 420 px, en-tête « LNP Ventes ». Vues :

| Vue | Quand | Contenu |
|---|---|---|
| `config` | `SKL_WEB_CONFIG.url` ou `anonKey` absent | « Pas encore configuré » · « La connexion à la base de données manque. Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le projet Vercel, puis rechargez la page. » |
| `loading` | pendant `enter()` | « Connexion en cours… » |
| `signin` | pas de session | « Connexion » · « LNP est réservé à l’équipe LNP. Utilisez l’adresse e-mail avec laquelle vous avez été invité. » · champs « E-mail » (`vous@exemple.fr`), « Mot de passe » · « Se connecter » (« Connexion… » pendant l'envoi) · « Mot de passe oublié ? Demandez un lien de réinitialisation à un administrateur (Accès de l’équipe). » |
| `setpw` | lien d'invitation ou de réinitialisation | titre « Bienvenue sur LNP » (invitation) ou « Choisissez un nouveau mot de passe » (réinitialisation) · « Choisissez le mot de passe qui vous servira à vous connecter avec <e-mail>. 8 caractères au moins. » · « Mot de passe », « Répétez le mot de passe » · « Enregistrer mon mot de passe » |
| `denied` | session sans ligne `members` | « Pas encore d’accès » · « Vous êtes connecté avec <e-mail>, mais ce compte ne fait pas partie de l’équipe LNP. Demandez à un administrateur de vous inviter. » · « Se déconnecter » |
| `noscreens` | rôle mais liste d'écrans vide | « Aucun écran ouvert pour l’instant » · « … Demandez à un administrateur d’en ouvrir dans Paramètres › Accès. » · « Se déconnecter » |

### 2.2 Déroulé

1. `boot()` : crée le client Supabase (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `flowType: "implicit"`).
   Un `#error_description=` dans l'URL affiche `signin` avec le message traduit. Un `#skl-link=<token_hash>&type=invite|recovery`
   (lien rendu par Accès de l'équipe) est mémorisé, retiré de l'URL, et ouvre `setpw` : **le jeton n'est dépensé qu'au moment
   d'enregistrer le mot de passe** (un aperçu de lien Slack ou un antivirus qui ouvre le lien ne le consomme pas).
2. `setpw` : refus si < 8 caractères (« Utilisez au moins 8 caractères. ») ou différents (« Les deux mots de passe ne sont pas
   identiques. ») ; puis `auth.verifyOtp({type, token_hash})` (échec : `signin` avec « Ce lien a déjà servi ou a expiré.
   Demandez-en un nouveau à un administrateur (Accès de l’équipe › Nouveau lien d’invitation). ») puis
   `auth.updateUser({password})`, puis `enter()`.
3. `signin` : `auth.signInWithPassword` ; erreur « invalid » → « E-mail ou mot de passe incorrect. », sinon `authFr`.
4. `enter()` : `GET /api/me` (jeton Bearer) → `{role, access}`. Pas de rôle → `denied` ; liste vide → `noscreens` ; sinon
   `applyAccess()` (§ 11), retrait du voile, résolution de `claude.use`, dessin du Compte (§ 10).
5. Déconnexion (`signOut`) : `auth.signOut()` puis `location.replace(pathname)` ; un `SIGNED_OUT` venu d'un autre onglet fait
   de même.

`authFr` traduit les messages de Supabase Auth : mot de passe identique à l'ancien, trop court ou trop simple, trop facile à
deviner, adresse non confirmée, trop de tentatives, lien expiré, réseau ; sinon « La connexion a échoué. Réessayez, ou
demandez de l’aide à un administrateur. »

`/api/me` (`web/api/me.js`) : 401 « Connectez-vous d’abord. » sans jeton valide ; `{role:null, access:[]}` hors équipe ;
sinon `access = accessOf(user, role)` (+ `"access"` pour un administrateur). Premier administrateur : `web/api/bootstrap.js`,
actif seulement tant que la variable `BOOTSTRAP_TOKEN` existe.

---

## 3. Cockpit commercial

Sources : `proposal/sales-cockpit-v2.html` (maquette), `skl-os/gen_sales_v2.py` (module + branchement en direct, écrit
`skl-os/sales_v2.json`), `skl-os/gen_salescockpit.py` (cadre et mode d'emploi), RPC `crm_sales_cockpit()`
(`web/supabase/034_lnp_fr_labels.sql`, fenêtre `crm_sales_cockpit_window` de `033_crm_noshow_audit.sql`).

### 3.1 But et disposition

La vue commerciale sur un seul écran, sans défilement : en haut à droite la période et le contrôle de parité ; ligne A
« Du prospect à l’encaissement » (7/12) et « Rentabilité unitaire » (5/12) ; ligne B « Équipe commerciale » (4,6),
« À venir » (3,5), « Encaissements à risque » (3,9). Hauteur du module : `--screen-h − 162 px`, au moins 620 px. Redessin à
chaque changement de taille (`ResizeObserver`) et au chargement des polices.

### 3.2 Données

- **Démo / Artifact** : constantes de la maquette (`KPI.all`, `SALES` — cinq commerciaux fictifs —, `ALERTS` — huit alertes
  d'exemple). La période multiplie volumes et montants par `PF = {7: 0,24 ; 30: 1 ; 56: 1,85}` ; les taux ne changent pas.
- **Web** : `SKL_CRM.salesCockpit()` = RPC `crm_sales_cockpit()` au chargement puis toutes les 5 min. Tant que rien n'est
  reçu, un voile couvre le module : « Chargement des chiffres en direct… » ; en cas d'échec : « Les chiffres en direct ne se
  sont pas chargés (<message>). » + « Réessayer ». L'exemple n'est jamais montré dans l'édition web.

`crm_sales_cockpit()` (sécurité definer) refuse un appelant sans rôle CRM (« Aucun rôle dans le CRM ») et calcule, sur les
cycles visibles (`crm_sees_all()` ou `owner_id = auth.uid()`) :

| Champ | Calcul |
|---|---|
| `periods.{7,30,56}.now` / `.base` | `crm_sales_cockpit_window` sur [maintenant − N j ; maintenant[ et la période précédente de même durée [− 2N ; − N[ |
| `team.{7,30,56}` | une ligne par commercial de `crm_sales_team` (rep = `member_key` du propriétaire, sinon partie locale de l'`host_email` du dernier `call_booked`), mêmes chiffres sur ses cycles ; les cycles des anciens commerciaux comptent seulement dans les totaux |
| `weekly` | 8 fenêtres de 7 jours, de la plus ancienne à la plus récente |
| `pipeline` | pipeline pondéré : Σ sur les cycles `active` de (montant signé du `crm_deals`, sinon panier moyen 180 j) × taux de gain observé à l'étape courante (cycles clos depuis 180 j à cette étape ou plus loin : gagnés ÷ clos) |
| `aov_180` | moyenne des `crm_deals.amount_sold > 0` signés depuis 180 j |
| `alerts` | encaissements à risque (60 max) : alertes ouvertes de `crm_alerts` (`resolved_at is null`) puis prochaines étapes en retard (`next_move.due_at < now`, cycle sans alerte ouverte), valeur = (montant ou panier 180 j) × max(taux de gain de l'étape ; 0,05) ; triées par valeur décroissante |
| `has_payments`, `has_deals` | il existe au moins un `crm_payments` / un `crm_deals.amount_sold > 0` |

`crm_sales_cockpit_window(from, to, ids, people_all)` renvoie :

| Clé | Définition |
|---|---|
| `leads` | personnes non fusionnées dont `first_seen_at` ∈ fenêtre (toutes si l'appelant voit tout, sinon celles de ses cycles) |
| `booked` | événements `call_booked` de la fenêtre |
| `held`, `no_show` | appels `held` / `no_show` dont `scheduled_start` ∈ fenêtre |
| `no_outcome` | appels encore `scheduled` dont l'heure est passée |
| `shown_leads` | prospects ayant un appel dû dans la fenêtre et déjà passé, **présents** : cycle gagné ou au moins un appel complet (`crm_call_complete` : enregistrement Fathom d'au moins `no_show_rule.min_minutes` — 30 depuis `032` —, ou transcription ajoutée à la main) |
| `no_show_leads` | mêmes prospects, ni présents ni en attente |
| `pending_leads` | ni présents, mais un appel à venir, ou dernier appel annulé pour être replanifié (`crm_call_is_reschedule`) |
| `won` | cycles `won` fermés dans la fenêtre |
| `signed`, `deals` | Σ `amount_sold` et nombre de ventes avec montant, `yes_at` ∈ fenêtre |
| `received`, `refunded`, `cash` | Σ `amount`, Σ `refunded_amount`, différence, des paiements `paid_at` ∈ fenêtre |
| `follow_total`, `follow_done` | appels `held` de la fenêtre ; ceux suivis sous 24 h après la fin (message sortant du commercial, note, ou événement `outcome_*`) |
| `days_per_stage` | médiane des `crm_stage_history.hours` sorties dans la fenêtre ÷ 24, arrondie à 0,1 |

### 3.3 Période et contrôle de parité (haut à droite)

- Contrôle segmenté « 7 j » · « 30 j » (défaut) · « 8 sem. » (`S.period` = 7, 30, 56).
- Six critères, chacun comparé à sa **référence** (la période précédente de même durée ; en démo, la valeur `[1]`) :

| Critère | Valeur (web) | Format |
|---|---|---|
| Ventes gagnées | `won` | entier |
| Montant encaissé | `cash` (non mesuré sans paiement) | k€ |
| Taux de présence | `shown_leads ÷ (shown_leads + no_show_leads)` × 100 | % |
| Chiffre d’affaires par appel | `cash ÷ held` (non mesuré sans paiement) | € |
| Panier moyen | `signed ÷ deals` (non mesuré sans vente avec montant) | € |
| Taux de remboursement | `refunded ÷ received` × 100 (plus bas = mieux) | % (1 décimale) |

  Rapport = valeur ÷ référence × 100 (inverse pour le remboursement ; 100 si les deux sont nuls). Teinte : vert ≥ 100,
  ambre ≥ 95, rouge < 95. Un critère est **non mesuré** si la valeur ou la référence n'est pas un nombre (`x.nd`).
- Pastille : « ÉCHEC » (au moins un critère < 100) avec « Contrôle de parité · n sur 6 sous la référence » ; sinon
  « EN ATTENTE » (gris) si un critère n'est pas mesuré, avec « k sur 6 à la référence · n non mesuré(s) » ; sinon « VALIDÉ »
  avec « 6 sur 6 à la référence ». Infobulle : la liste des critères sous la référence et non mesurés.

### 3.4 « Du prospect à l’encaissement »

Sous-titre : « <période> · réf. = les <période> d’avant · CRM en direct » (ou « · exemple »). Diagramme SVG de 5 colonnes
reliées par des rubans : « PROSPECTS » (`leads`, « entrés »), « RDV PRIS » (`booked`, « à l’agenda »),
« APPELS HONORÉS » (`held`, « réalisés », ou « réalisés · n sans issue » si `no_outcome > 0`), « VENTES GAGNÉES » (`won`,
pastille « x % de la réf. » du critère Ventes), « ENCAISSÉ » (colonne pointillée dont la part pleine = part à la signature,
pastille du critère Montant encaissé). Hauteur des colonnes ∝ √(valeur ÷ maximum). Entre colonnes, quatre taux :
« prise RDV » = `booked ÷ leads`, « présence » = taux de présence (cadre coloré selon son critère), « conversion » =
`won ÷ held`, « comptant » = `cash ÷ signed` (part du signé payée à la signature, non mesurée sans paiement). Chaque élément
a une infobulle de calcul.

### 3.5 « Rentabilité unitaire »

Sous-titre « 8 semaines · pointillés = réf. ». Trois lignes : Chiffre d’affaires par appel, Panier moyen, Taux de
remboursement. À gauche : valeur, écart « ±x % vs réf. » coloré, « réf. <valeur> » (+ « · plus bas = mieux »). À droite :
courbe des 8 semaines (web : `weekly`, même formule par semaine ; démo : série synthétique `series()`), aire verte au-dessus
de la référence et rouge en dessous (inversé pour le remboursement), point final coloré, repères « il y a 8 sem. » et
« maintenant », infobulle par semaine. Critère non mesuré : « Pas encore mesuré : aucun paiement dans le CRM. » (ou
« aucune vente avec un montant »).

### 3.6 « Équipe commerciale »

Sous-titre « par encaissé · un clic ouvre son pipeline ». Colonnes « Commercial » (pastille d'initiales, nom,
« <CA par appel> par appel »), « Encaissé » (barre proportionnelle au meilleur, montant, « n gagnée(s) / n appel(s) »),
« Conversion » (`won ÷ held` ; vert ≥ 32 %, ambre ≥ 28 %, rouge), « Présence » (vert ≥ 72 %, ambre ≥ 65 %, rouge). Tri par
encaissé décroissant. Web : seules les lignes avec de l'activité (appels, ventes, encaissé ou RDV) ; nom « Non attribué »
sans commercial. Vide : « Aucune activité commerciale sur cette période. » **Clic sur une ligne** : ouvre le CRM, Pipeline,
filtré sur ce commercial (`postMessage({skl:"crm", owner})`).

### 3.7 « À venir »

Sous-titre « 30 prochains jours ».
- « Prévision d’encaissement à 30 jours » = pipeline pondéré × part à la signature ; « sur <pondéré> pondérés » ; barre
  « encaissement attendu » / « reste en pipeline pondéré ».
- « Relance sous 24 h » = `follow_done ÷ follow_total` ; objectif 75 % (ambre en dessous).
- « Jours par étape » = `days_per_stage` (« 7 j », virgule décimale) ; alerte au-delà de 8 j (ambre).
- Bloc « Résultat clé » : seulement si `SKL.list("krs")` contient un résultat clé de propriétaire `sales` (statut et rapport
  de `SKL.krView`, clic `SKL.openKr`). **Dans LNP il n'y en a pas** (les données Operating System sont vides) : le bloc est
  absent.

### 3.8 « Encaissements à risque »

En-tête : « ~<total> · n alerte(s) ». Les 5 premières lignes : code (`rule_id`, « SLA » pour une prochaine étape en
retard), titre (web : « … · en retard » ; les noms d'étape anglais du SQL sont traduits : Présence, Décision, Encaissement,
Gagné, Perdu), objet « prospect · détail · prénom du commercial », barre d'impact « ~x ». Pied : « n de plus, ~x » et
« Voir toutes les alertes → » (ouvre la vue Alertes du CRM, § 7.7). Web sans rien : « 0 alerte » et « Rien à risque pour
l’instant : aucune alerte ouverte et aucune prochaine étape en retard. »

### 3.9 Mode d'emploi (résumé)

« La vue commerciale de LNP sur un seul écran » ; cinq apports (entonnoir, rentabilité unitaire 8 semaines, équipe classée par
encaissé avec clic vers le CRM, À venir et Encaissements à risque, contrôle de parité VALIDÉ / ÉCHEC / EN ATTENTE) ; usage :
choisir la période (comparée à la précédente de même durée), lire de haut en bas chaque lundi, survoler pour le calcul,
cliquer un commercial, agir dans le CRM.

Aucune écriture sur cet écran. Rôles : chacun voit les chiffres des cycles que la RLS lui montre.

---

## 4. Ma journée

Sources : `skl-os/salesday_module.js` (module `SKL_SALESDAY`), `skl-os/gen_salesday.py` (cadre, mode d'emploi).

### 4.1 But et disposition

La journée du commercial, un prospect à la fois. Barre du haut : contexte « Un prospect à la fois : d'abord les issues à
déclarer, puis les appels, les replanifications et les relances. » Module en deux colonnes (`1fr 320px`, une seule sous
1000 px de large) : carte principale à gauche, trois listes à droite.

### 4.2 Données

- Web : `SKL_CRM.me()`, `listMembers()`, `listBoard()` (cycles + appels + événements + ventes + paiements), `listReasons()`
  (motifs actifs, non automatiques, `lost` ou `disqualified`), puis la liste du jour `getPref("salesday.<AAAA-MM-JJ>")`
  (table `crm_member_prefs`, RPC `crm_get_pref` / `crm_set_pref`, `031_crm_member_prefs.sql` ; les clés `salesday.%` de plus de
  30 jours sont effacées à l'écriture).
- Démo : six prospects fictifs générés autour de maintenant, motifs d'exemple, liste du jour dans
  `localStorage["skl_crm_pref:salesday.<date>"]`.
- États : « Chargement de votre journée… » ; erreur : « Votre journée n'a pas pu être chargée : <message> » + « Réessayer ».
  Le changement de jour remet à zéro la liste du jour.

### 4.3 La file (fonction `queue`)

Une carte au plus par cycle `active`, la première règle qui s'applique gagne :

| Ordre | Type (`kind`) | Pastille | Action affichée | Condition |
|---|---|---|---|---|
| 1 | `outcome` | « Issue à déclarer » (rouge) | « Déclarer l'issue de l'appel » | `next_move.code = "declare_outcome"` et un appel terminé (fin = `scheduled_end`, sinon début + 45 min) dont le statut est `scheduled`, `outcome_pending`, ou `held` sans événement `outcome_*` de source `crm` |
| 2 | `prep` | « Appel aujourd'hui » | « Préparer et confirmer l'appel » | prochain appel `scheduled` à venir dans moins de 24 h |
| — | — | — | — | un appel est réservé plus loin : aucune carte |
| — | — | — | — | aucun événement depuis plus de 14 jours : aucune carte (le prospect est dans « Relance longue » du CRM) |
| 3 | `resched` | « À replanifier » | « Replanifier l'appel » (+ « · R<n> n'a pas eu lieu (pas d'enregistrement Fathom) ») | `next_move.code = "rebook"` |
| 4 | `reengage` | « Absent » | « Relancer après l'absence » | dernier appel `no_show` fini depuis moins de 14 jours |
| 5 | `follow` | « Relance » (or) | « Relancer » (+ « · <prochaine étape de la dernière issue> ») | `next_move.code = "follow_up"` et dernier contact du commercial (`last_sales_at`) il y a 48 h ou plus |

Tri : ordre des types, puis échéance croissante. Les cartes « Passer » vont en fin de file ; une carte choisie dans
« À suivre » passe devant. Un prospect traité aujourd'hui (carte ou cycle dans `day.done`) ne revient pas aujourd'hui ;
une carte mise à « Demain » (`day.snoozed`) sort de la file.

Filtre « Prospects affichés » (`select`) : « Mes prospects » (cycles dont je suis propriétaire) ; pour `admin`, `sales_lead`
et `viewer` aussi « Toute l'équipe » et chaque membre actif. Un responsable sans prospect à lui démarre sur « Toute
l'équipe ». En démo, seulement « Mes prospects ».

### 4.4 Carte principale

- En-tête : « MA JOURNÉE · [prospects fictifs · ]n sur N fait(s) », date longue (`fr-FR`, « lundi 3 novembre »), filtre,
  « Actualiser » (relit le CRM) ; barre de progression = faits ÷ (faits + restants) ; compteurs par type (pastilles).
- Carte (paquet de cartes animé) : pastille du type, « Prospect k sur N », téléphone ; nom ; « À faire » + action ; trois
  faits : heure ou ancienneté de l'appel (« il y a 3 h », « dans 20 min », « 2 j ») avec « R<n> · manqué / absent /
  aujourd'hui / appel », « dernière activité », « commercial ».
- Carte `outcome` : « L'appel a-t-il eu lieu ? » [Honoré | Absent] ; si Honoré, « Décision » [Oui | Relance | Non |
  Disqualifié] ; Relance → champ « Prochaine étape (ce qui a été convenu) » ; Non / Disqualifié → « Motif… » (motifs du
  type `lost` ou `disqualified`, libellés de la base) ; Oui → « Montant signé (facultatif) » (« 1 500,50 » lu 1500,50).
  Boutons « Déclarer et suivant » (actif quand Absent, ou Honoré + décision, + motif pour Non/Disqualifié), « Demain »,
  « Passer ». **Écriture** : `crm_declare_outcome(p_call, {attendance, decision, reason_code, next_step, amount_sold})`. Toast
  « Issue déclarée pour <nom> ». Le cycle est mis à jour localement jusqu'au prochain chargement.
- Autres cartes : zone « Qu'avez-vous fait ? (enregistré en note sur le prospect) », « Fait », « Demain », « Passer », aide
  « Faites glisser la carte vers la droite une fois l'action faite. » **Écriture** : `crm_add_note(p_cycle,
  "Ma journée · <action>[ : <texte>]")`.
- Glisser la carte de plus de 120 px : à droite = « Fait » (pas pour une issue), à gauche = « Passer ».
- « Demain » et « Passer » n'écrivent que la liste du jour (`crm_set_pref`). « Ouvrir le CRM » en pied de carte.
- Pendant l'envoi : « Enregistrement… » ; erreur sous la carte (message du serveur ou « Non enregistré »).
- File vide : « TOUT EST FAIT » · « Tous les prospects du jour sont traités » · « Les nouvelles issues et relances s'affichent
  ici dès que le CRM les reçoit. » (+ « n mis de côté pour demain. »).

### 4.5 Colonne de droite

« À suivre » (8 suivants, clic = la passer devant ; « + n autres » ; vide « Rien d'autre en attente. »), « Fait aujourd'hui »
(du plus récent : nom, « fait / absent / oui / relance / non / disqualifié · HH:MM » ; vide « Rien pour l'instant. »),
« Demain » (si non vide : « Remettre aujourd'hui »).

### 4.6 Rôles

`viewer` : tout est lisible, « Déclarer et suivant » et « Fait » sont désactivés. Serveur : `crm_declare_outcome` et
`crm_add_note` exigent `admin`, `sales_lead`, ou `sales` propriétaire du cycle.

### 4.7 Démo

Libellé « prospects fictifs » ; rien n'est envoyé au serveur ; la liste du jour reste dans ce navigateur.

### 4.8 Mode d'emploi (résumé)

La journée du commercial dans le CRM, un prospect à la fois, dans l'ordre qui protège l'encaissé (issues, appels du jour,
replanifications, absents, relances). Rien ne passe entre les mailles ; une chose à la fois ; une issue déclarée ici est la
même que dans CRM › Cycle de vente et « Fait » devient une note. Usage : choisir « Mes prospects » (ou un commercial),
déclarer l'issue puis « Déclarer et suivant », sinon écrire ce qui a été fait et « Fait » ou glisser à droite ; « Demain »
met de côté, « Passer » envoie en fin de file, « À suivre » permet de choisir ; la liste du jour n'est gardée que pour vous.

---

## 5. Les données du CRM vues par les écrans

### 5.1 Lecture (`skl-os/crm/data.js`, `window.SKL_CRM`)

| Fonction | Lecture |
|---|---|
| `listBoard(onCycles)` | `crm_cycles` (colonnes `CYCLE_COLS`, avec `person:crm_people(...)`), par pages de 1000 ; puis par lots de 100 cycles : `crm_calls`, `crm_events`, `crm_deals`, `crm_payments`. `onCycles` reçoit les cycles dès qu'ils arrivent (le tableau se dessine avant les appels et messages) |
| `listNoBooking()` | vue `crm_people_without_cycle` (`009_crm_import_calls.sql`) : personnes qui n'ont jamais pris de rendez-vous |
| `listMembers()`, `listReasons()`, `me()` | `crm_members`, `crm_reason_codes` (par `position`), ligne `crm_members` de l'utilisateur |
| `salesCycleView(cycles, members, now)` | transforme les cycles en modèle du Cycle de vente (§ 7.5.2) |
| `caBoard()`, `caRecord(job)` | RPC `crm_ca_board`, `crm_ca_record` (§ 8) |
| `salesCockpit()` | RPC `crm_sales_cockpit` (§ 3) |
| `getPref` / `setPref` | RPC `crm_get_pref` / `crm_set_pref` ; en démo `localStorage["skl_crm_pref:<clé>"]` |
| `subscribe(fn)` | Realtime sur `crm_cycles`, `crm_events`, `crm_alerts` |

Libellés français des motifs à l'affichage (`REASON`) : `price` Prix, `timing` Pas le bon moment, `partner` Associé ou
conjoint, `trust` Manque de confiance, `competitor` A choisi une autre offre, `unreachable` Injoignable, `unpaid` Paiement non
effectué, `refunded` Remboursé, `dq_off_target` Hors cible, `dq_budget` Aucun budget, `dq_not_decider` Pas décisionnaire,
`dq_fake` Faux contact ou spam, `dq_customer` Déjà client, `dq_out_of_offer` Demande hors de l’offre. (Ma journée affiche,
lui, le libellé stocké en base : voir § 13.)

### 5.2 Écritures (toutes par RPC, auditées dans `crm_audit_log`)

| Fonction | RPC | Qui (serveur) |
|---|---|---|
| `declareOutcome(callId, p)` | `crm_declare_outcome` | `admin`, `sales_lead`, `sales` propriétaire |
| `addNote(cycleId, text)` | `crm_add_note` | idem ; texte non vide |
| `reassignCycle(cycleId, memberId)` | `crm_reassign_cycle` | `admin`, `sales_lead` ; nouveau propriétaire actif et non `viewer` ; ses alertes ouvertes le suivent |
| `setPlan(cycle, amount, currency, schedule)` | `crm_set_payment_plan` | `admin`, `sales_lead`, `sales` propriétaire |
| `addPayment(cycle, {amount, paid_at, method, note})` | `crm_add_payment` | idem ; montant > 0, date ≤ maintenant + 1 j, méthode `other` envoyée |
| `deletePayment(id)` | `crm_delete_payment` | idem ; seulement `source = 'manual'` |
| `addRefund(paymentId, amount)` | `crm_add_refund` | idem ; reste du paiement par défaut |
| `caAddTranscript`, `caRetry` | `crm_ca_add_transcript`, `crm_ca_retry` | `admin` ou propriétaire du cycle |
| `setDeal`, `cancelAutoClose`, `setNurture`, `resolveUnmatched`, `dismissUnmatched`, `mergePeople`, `updateCrmConfig`, `createCheckout` | RPC du même nom | existent dans la couche, **aucun écran ne les appelle** |

En démo, `call()` répond `{demo:true}` sans rien enregistrer.

### 5.3 Ce que le serveur recalcule (`crm_recompute_cycle`, `034_lnp_fr_labels.sql`)

Après chaque issue, paiement ou remboursement :
- **Étapes** : `crm_stage_definitions` — `show` « Présence » (entrée sur `call_booked`, objectif 96 h, critique 168 h),
  `decision` « Décision » (`outcome_held`, 72 / 144 h), `cash` « Encaissement » (`outcome_yes`, 24 / 48 h)
  (`003_crm_core.sql`). L'étape courante est la plus avancée atteinte ; `crm_stage_history` est réécrit.
- **Statut** : `won` au premier `payment_succeeded` ; `lost` motif `refunded` si tous les paiements sont remboursés ;
  `lost` / `disqualified` à la dernière issue courante non / disqualifié (sauf réouverture postérieure) ; statut importé
  (événements `cycle_*` de source `import`) tant qu'aucune issue n'est déclarée ; `lost` par règle (`cycle_lost` source
  `rules`).
- **Prochaine étape** `next_move` (cycles en cours seulement) : `declare_outcome` « Déclarer l'issue de l'appel » (un appel
  terminé encore `scheduled`, ou `held` enregistré par Fathom sans issue courante) ; sinon `attend_call` « Appel R<n> » ;
  sinon `rebook` « Replanifier l'appel » (dernier appel `missed`, avec `missed` = son rang) ou « Reprendre un rendez-vous »
  (dernier appel annulé) ; sinon `follow_up` « Relancer ».
- Compteurs `calls_held`, `no_shows`, `sales_attempts`, `last_prospect_at`, `last_sales_at`, `last_event_at`.

---

## 6. CRM : le cadre

Le CRM est le document `skl-os/crm_doc.html` (source `uploads/ALKIMIY_Lite.html`, dictionnaire français fixé, retouches de
`skl-os/gen_crm.py`, cadre de `harmonize.py`) dans une iframe. Sa propre barre latérale est cachée ; la vue est toujours
`crm` (sauf la vue Alertes ouverte depuis le Cockpit, avec un bouton « ← Pipeline »).

Barre du haut (`.cx-tabs-row`) : contrôle segmenté **« Pipeline » | « Prospects <n> » | « Cycle de vente »** (n = nombre de
prospects chargés). Sur Pipeline s'ajoutent la période et, si un ordre de colonnes personnel existe, « Réinitialiser les
colonnes ». Sur Prospects : « Rattacher les commerciaux » et « + Nouveau prospect ».

### 6.1 Chargement en direct (édition web)

Script `LIVE` de `gen_crm.py` (`window.sklCrmLive(C)`, démarré quand `parent.SKL_CRM.mode() === "live"`) :
1. Bulle d'état bas centre : « Chargement des prospects… », puis « Chargement des appels et des messages… » (cycles déjà
   dessinés), puis retirée ; échec : « Impossible de charger les prospects : <message> » + « Réessayer ».
2. Chaque cycle devient un « prospect » du tableau (`toLead`), chaque personne sans cycle une ligne « Sans rendez-vous »
   (`toNoBooking`, id `p-<personne>`, note « iClosed : <statut iClosed> »).
3. `window.sklScData = {leads: salesCycleView(...), reps, now, role, reasons}` est poussé au Cycle de vente.
4. Abonnement Realtime : un changement de cycle, d'événement ou d'alerte relance le chargement (attente 800 ms).
5. `window.sklCanAssign` = rôle CRM `admin` ou `sales_lead`.

Conversion d'un cycle (`toLead`) :

| Champ | Valeur |
|---|---|
| statut `st` | `won`→`close` « Gagné », `lost`→`perdu` « Perdu », `disqualified`→`disq` « Disqualifié » ; sinon selon l'appel de référence (prochain `scheduled`, sinon le dernier non annulé) : aucun → `nouveau` « Nouveau », `no_show` → `noshow` « Absent », `held` → `realise` « RDV honoré », autre → `planifie` « RDV planifié » |
| **Relance longue** `longfu` | dernière activité (`last_event_at`, sinon ouverture) il y a plus de 14 jours, aucun appel à venir, et statut `noshow`, `nouveau`, `planifie`, `realise` ou `perdu` (sauf perdu pour remboursement) |
| `tour` | rang de l'appel de référence, sinon nombre d'appels, au moins 1 |
| `age` | jours depuis `stage_entered_at` (sinon ouverture) |
| `born`, `last` | jours (négatifs) depuis `first_seen_at` et depuis la dernière activité |
| `rdv` | date (jours) et heure de l'appel de référence |
| `nx` | `rebook` → « Replanifier le RDV » (aujourd'hui), `follow_up` → « Relancer » (aujourd'hui), sinon aucune |
| `a`, `inv` | montant signé du `crm_deals` |
| `col` | Σ (`amount` − `refunded_amount`) des paiements |
| `loss` | `close_reason` (codes réécrits vers ceux du document : `price`→budget, `unreachable`→injoignable après absence…) |
| `prod` | aucun (pas de catalogue : « — ») |

### 6.2 Ce qui est en lecture seule dans l'édition web

Les actions du document d'origine qui ne correspondent à aucune RPC affichent « Déclarez l’issue d’un appel dans CRM ›
Cycle de vente ; les autres modifications ici arriveront plus tard. » au lieu de modifier : glisser une carte d'une colonne à
une autre, changer le statut (menu « Statut ▾ » de la fiche, sélecteur de la liste), choisir / retirer / cocher une prochaine
action, mise en condition J-3 / J-1 / Jour J, « Contact repris sans RDV », « Déclarer perdu », étapes du cycle, « Nouveau
prospect », « RDV honoré » / « Absent » de la fiche. Une note sur un « Sans rendez-vous » non plus. Restent actifs : filtres,
tris, colonnes, ordre des colonnes, changement de commercial, fenêtre d'encaissement, analyse d'appel, déclaration d'issue
(Cycle de vente).

### 6.3 Démo

Hors édition web, le Pipeline et la liste sont **vides** (les prospects d'exemple d'ALKIMIY Lite ont été retirés par
`gen_crm.py`) ; seul Cycle de vente montre ses prospects d'exemple. Les commerciaux du filtre sont deux noms fixes
(« Camille Martin », « Romain »).

---

## 7. CRM : les vues

### 7.1 Pipeline

**KPI** (`cxKpis`, cinq cartes, sur les prospects de la période) — chaque carte cliquable (sauf Durées) applique un filtre
rapide, recliquer l'enlève ; le filtre actif apparaît aussi comme « ✕ <nom> » dans la barre :

| Carte | Valeur | Filtre |
|---|---|---|
| « RDV sans issue déclarée » | prospects `planifie` dont le RDV est passé (`noIssue`) · « issue à déclarer — cliquer pour voir les prospects » | `noissue` |
| « Absents à relancer » | prospects `noshow` · « n à relancer maintenant » (sans prochaine action ou action due) | `noshow` |
| « Durées de vente » | médianes « RDV honoré → décision » et « Cycle complet (prospect → gagné) » des gagnés datés, publiées à partir de 3 | — |
| « Prospects en 2ᵉ tour et plus » | `nouveau` / `planifie` / `realise` avec `tour ≥ 2` | `r2` |
| « Ventes qui stagnent » | `nouveau` et `planifie` au niveau de vitesse rouge, + « · n à l’ancienneté inconnue » | `rot` |

Niveau de vitesse (`VEL`, jours dans l'étape → vert / orange / rouge) : Nouveau 3 / 6, RDV planifié 6 / 12, RDV honoré 4 / 8,
Absent 5 / 10 ; âge inconnu = « ancienneté inconnue », jamais rouge. Dans l'édition web, `l.cyc` n'est jamais renseigné :
« Durées de vente » affiche toujours « — ».

**Barre de filtres** : recherche (« Rechercher un prospect, un e-mail, un commercial, un produit… », sur nom, e-mail, nom du
commercial, produit) ; commercial (« Tous les commerciaux » + équipe CRM + « Non attribué ») ; création (« Tous les
prospects », « Créés depuis 1 semaine », « Créés depuis 1 mois », sur `born`) ; prochaine action (« Toutes les prochaines
actions », chaque action, « — » = aucune) ; compteur « n / N prospects ». Bascules « AFFICHER » : Commercial, Prochaine
action, Produit, Montant.

**Période** (« 7 jours » | « 30 jours » | « Tout », défaut Tout) : garde les prospects dont la dernière activité
(max de dernière activité, création, date du RDV, −âge) est dans les N derniers jours ; s'applique aux colonnes, aux KPI et
aux compteurs.

**Colonnes** (ordre par défaut) :

| Clé | Titre | Contenu |
|---|---|---|
| `nouveau` | Nouveau | aucun appel |
| `r1` | R1 | `planifie` ou `realise` au tour 1 · sous-titre « a planifié(s) · b honoré(s) » |
| `noshow` | Absent | dernier appel absent |
| `r2` | R2 | tour 2 |
| `r3` | R3+ | tour ≥ 3 |
| `longfu` | Relance longue | § 6.1 |
| `close` | Gagné | total signé, « facturé x · encaissé y » |
| `perdu` | Perdu | total des montants |
| `disq` | Disqualifié | |
| `nobook` | Sans rendez-vous | personnes sans cycle (dernière colonne, Romain 2026-10-31) |

En-tête : pastille de couleur, titre, (n). Tri dans une colonne : RDV sans issue d'abord, RDV planifiés avant honorés, puis
date du RDV. Vide : « Aucun prospect ».

**Glisser une colonne** par son en-tête : nouvel ordre enregistré pour la personne seule
(`setPref("crm.pipeline.cols", [...])` ; échec : « L’ordre des colonnes n’a pas pu être enregistré »).
« Réinitialiser les colonnes » efface la préférence (`setPref(..., null)`). Les colonnes inconnues de l'ordre enregistré
sont ignorées, les nouvelles ajoutées à la fin.

**Carte d'un prospect** : nom, œil « Ouvrir la fiche prospect », pastilles (âge « n j » coloré par la vitesse ; Absent
« ×n » ; Nouveau « tentative n/3 » ; RDV honoré « relance n/3 · il y a n j » ; tour « R<n> » hors colonnes de tour ou
dès R3) ; e-mail ; produit ; dans une colonne de tour, sous-statut « RDV planifié / RDV honoré » (+ « · Dépassé ») ;
méta (montant si Gagné, commercial, RDV « aujourd’hui 10:00 », « demain … », « mar. 04/11/2026 10:00 ») ; pastille d'analyse
d'appel (§ 8.2) ; Absent : « RDV manqué : <date> », « Contact repris sans RDV », « Déclarer perdu » ; Gagné : bouton
« Signé x · Encaissé y » + barre + « reste x à encaisser » / « Entièrement encaissé » / « Aucun montant signé » (ouvre la
fenêtre d'encaissement) ; prochaine action (bouton « + Planifier… » ou action + date, en retard si due, « ✓ ») ; mise en
condition J-3 / J-1 / Jour J (RDV planifié à J ou J+1) ; Perdu / Disqualifié : motif. Glisser une carte : voir § 6.2.

### 7.2 Prospects (liste)

Filtres : recherche, commercial, création, statut (« Tous les statuts » + les 10 statuts), transcription (« Transcription :
toutes / disponible / absente »). À droite : compteur, « Vues » et « Exporter en CSV » (toast « Disponible dans l’application
— inactif dans la maquette »), « Colonnes » (menu de cases : Commercial, Transcription, Prochain RDV, Prix proposé, Facturé,
Encaissé, Tour, Statut, Prochaine action ; toutes cochées par défaut). « Rattacher les commerciaux » : toast « Commerciaux
rattachés par e-mail · aucun prospect orphelin » (sans effet).

Colonnes du tableau : case à cocher (et « Tout sélectionner » ; aucune action groupée n'existe) ; Prospect (nom cliquable →
fiche, e-mail) ; Commercial (bouton « <nom> ▾ » pour `admin` / `sales_lead`, § 7.3.2) ; Transcription (« Pas encore »,
« Aucune », « R<n> ») ; Prochain RDV ; Prix proposé ; Facturé (Gagné) ; Encaissé (Gagné, bouton → encaissement) ; Tour ;
Statut (sélecteur coloré) ; Prochaine action ; « Analyse » (pastille § 8.2). Clic sur un en-tête : tri croissant puis
décroissant (▲ ▼ ↕). Vide : « Aucun prospect ».

### 7.3 Fiche prospect

Ouverte par l'œil d'une carte, un nom de la liste, une pastille d'analyse ou une analyse du Cycle de vente. Dans l'édition
web elle occupe toute la zone du CRM (`cx-full`) ; ailleurs, fenêtre modale.

#### 7.3.1 En-tête

Initiale, nom, pastille de statut, produit, « · <commercial> » (bouton pour `admin` / `sales_lead`), « ↻ R<tour> » ;
« Statut ▾ » (menu « Changer le statut » ; lecture seule en web, § 6.2) ; « × ».

#### 7.3.2 Changer de commercial

Bouton « <nom> ▾ » (« Changer le commercial ») dans l'en-tête et dans la liste, montré si `sklCanAssign` et pas pour un
« Sans rendez-vous ». Menu « Attribuer à » : membres CRM actifs dont le rôle n'est pas `viewer`, l'actuel désactivé. Choix →
`crm_reassign_cycle(p_cycle, p_member)`, toast « Attribué à <nom> », rechargement.

#### 7.3.3 Corps

1. **Chronologie** (`sklTimeline`) : le Cycle de vente embarqué (même document, mode `scEmbed`) réduit à la ligne ouverte de
   ce prospect (Récit / Échelle de temps / Tableau, § 7.5.6), sans tableau ni actions. Cas : « Chargement de la chronologie… » ;
   « Pas encore de chronologie : ce prospect n’a jamais pris de rendez-vous. » ; hors web : « La chronologie des appels et
   des messages du prospect s’affiche dans l’édition web, à partir de ses vrais événements. »
2. **« Facturation et encaissement »** : affiché pour un Gagné et, en web, dès qu'il y a un montant signé, un encaissement,
   ou que l'étape est Décision ou Encaissement. « Signé », « Encaissé » (en web pas de « Facturé »), barre, « reste x à
   encaisser » / « Entièrement encaissé » / « Aucun montant signé ». « Mettre à jour » ouvre la fenêtre d'encaissement (§ 7.4).
3. **Analyse d'appel** (web) : panneau `SKL_CA.leadView` (§ 8.3). Hors web : onglets « Analyse du prospect » / « Prochain
   appel » de la maquette avec textes d'exemple.

**Notes** : la fiche n'a plus de bloc « Note du commercial » ni de « Prochaine action » (retirés le 2026-10-29). Le code
d'enregistrement d'une note (`notesave` → `crm_add_note`, toast « Note enregistrée ») reste branché mais n'est plus atteint
depuis la fiche ; les notes s'écrivent aujourd'hui par Ma journée (« Fait ») et par le connecteur Claude.

### 7.4 Fenêtre d'encaissement

Source : `skl-os/crm/cash_ui.js` (`window.sklCash.open(lead, C, reload, canWrite, find)`), RPC `022`, `024`, `026`.
Ouverte par « Mettre à jour » de la fiche, le bouton d'une carte Gagné, ou la colonne Encaissé de la liste (web seulement,
pas pour un « Sans rendez-vous »). 760 px, Échap / × / clic dehors ferment.

- En-tête « ENCAISSEMENT · CLIENT SIGNÉ », nom ; note « Saisi à la main pour l’instant. Quand Whop sera relié, ses paiements
  apparaîtront ici d’eux-mêmes, marqués Whop. »
- Trois totaux : « Signé » (montant du `crm_deals`), « Encaissé » (Σ net des paiements), « Reste à encaisser »
  (max(0, signé − encaissé)) + « Prochaine : <reste de l'échéance> · <date> ».
- **« Échéancier · <modalités> »** : tableau # / Échéance / Montant / Statut. Les paiements reçus soldent les échéances dans
  l'ordre : « Payée », « Payée en partie · x », « En retard » (date passée, rien payé), « À venir ». Sans échéancier :
  « <modalités> choisi à la signature ; fixez les dates et les montants ci-dessous. » ou « Pas encore d’échéancier : fixez
  les modalités de la vente ci-dessous. »
- **« Fixer / Modifier l’échéancier »** (écriture) : « Montant signé (EUR) », « Modalités » (Payé en une fois, 2, 3, 4, 6,
  12 échéances, + la valeur actuelle si autre), « Première échéance » (date). Les lignes se recalculent : une échéance par
  mois à partir de la première date (fin de mois ramenée au dernier jour), montant ÷ n arrondi au centime inférieur, le reste
  sur la dernière. Chaque date et montant reste modifiable ; écart affiché « Les échéances font x, et non y. ». « Enregistrer
  l’échéancier » → `crm_set_payment_plan(p_cycle, p_amount, p_currency, p_schedule=[{due, amount}])`. Contrôles : client
  (« Saisissez le montant signé. », « Chaque échéance doit avoir une date et un montant. ») ; serveur (montant > 0, 1 à 12
  échéances, chacune > 0, somme = montant à 0,01 près ; `payment_plan` stocké « Payé en une fois » ou « N échéances »).
  Message « Échéancier enregistré. »
- **« Paiements reçus »** : Date / Montant (net, « (x remboursé) ») / Source (« À la main » ou « Whop ») / Note / actions :
  « Remboursé » (s'il reste un montant non remboursé) et « Retirer » (paiement à la main seulement). Vide : « Aucun paiement
  enregistré pour l’instant. »
- **« Ajouter un paiement reçu »** : « Montant » (prérempli avec le reste de la prochaine échéance), « Date » (aujourd'hui,
  pas après), « Note » (indication « Échéance k sur n » reprise si vide, sinon « Acompte, première échéance… ») ;
  « Ajouter le paiement » → `crm_add_payment` (méthode `other`, la méthode n'est pas demandée). Crée le `crm_deals` s'il
  manque, un événement `payment_succeeded` ; le cycle devient gagné. Message « Paiement ajouté : le prospect compte comme
  gagné et le cockpit commercial l’inclut dans l’encaissé. »
- **Remboursement** : confirmation « Marquer ce paiement comme remboursé ? » · « Le montant encaissé baisse de ce qu’il en
  reste. Quand tous les paiements du prospect sont remboursés, le prospect est perdu (motif : remboursé). » ·
  « Remboursé » → `crm_add_refund(p_payment)` (reste du paiement ; événement `payment_refunded`). « Remboursement
  enregistré. »
- **Retirer** : confirmation « Retirer ce paiement ? » · « Il a été saisi à la main. Le montant encaissé et le cockpit
  commercial reviennent sans lui ; si c’était le seul paiement, le prospect n’est plus gagné. » · « Retirer » →
  `crm_delete_payment`. « Paiement retiré. »
- Après chaque écriture : rechargement du tableau, la fenêtre se redessine sur les nouvelles données ; erreur affichée en
  rouge (message du serveur).
- `viewer` (rôle de `sklScData.role`) : pas de formulaire ni de boutons ; « Vous pouvez consulter l’encaissement ; un
  administrateur, un responsable commercial ou le commercial du prospect le saisit. »
- Montants au format `fr-FR` dans la devise du `crm_deals` (EUR par défaut).

### 7.5 Cycle de vente

Source : `docs/crm/reference/sales-cycle-v6.html` (maquette v6, entièrement en français) retouchée par `gen_crm.py`, règles
SLA de `supabase/functions/_shared/sla_rules.js` (insérées telles quelles), adaptateur `salesCycleView` (`data.js`). Il
tourne dans une iframe plein écran au-dessus du document CRM (`sklCycle`). Ses boutons « Pipeline » / « Prospects » rappellent
le CRM (`parent.sklCrmTab`). Le bouton « i » propre à la maquette est retiré : le mode d'emploi du CRM le couvre.

#### 7.5.1 But

Suivre chaque prospect en cours, du RDV pris au premier paiement Whop (gagné) ou à perdu, et montrer qui doit agir, sur
quoi, depuis quand.

#### 7.5.2 Le modèle (`salesCycleView`)

Un prospect = un cycle : `p` nom (sinon e-mail, téléphone), `o` `member_key` du propriétaire (`none` sinon), `a` montant
signé, `ph`, `em`, `opened`, `age` (heures depuis l'ouverture), `ev` événements (`t` heures depuis l'ouverture, `w` acteur
`s`/`p`/`a`, `k` type), `nx` prochaine étape.

| Événement CRM | `k` · acteur · texte |
|---|---|
| `call_booked` / `call_rescheduled` | `booked` · p · « RDV R<n> pris[ · <type d'événement>] » / « RDV R<n> reporté » |
| `call_canceled` | `note` · a · « R<n> annulé[ · motif] » |
| `message_in` | `im` ou `sms` · p |
| `message_out` | automatique → `remind` · a ; sinon `im` / `sms` · s ; statut de remise Sent / Delivered / Read |
| `phone_call_in` / `_out` | `call` · p / s (« Appel téléphonique entrant / sortant ») |
| `note` | `note` · s |
| `checkout_created` | `paylink` · « Lien Whop envoyé » |
| `payment_succeeded` | `paid` · « Paiement Whop · <montant> » |
| `cycle_won` | `decision` oui « Issue déclarée · Gagné[ (depuis iClosed)] » (+ `paid` « Gagné · paiement enregistré dans iClosed » sans paiement) |
| `outcome_yes` | `decision` oui « Issue déclarée · Honoré · Oui · <montant> · <modalités> » ; prochaine étape « Envoyer le lien Whop », source « oui au R<n> », due 1 h après |
| `outcome_follow_up` | `decision` « … · Relance · prochaine étape : <texte> » ; prochaine étape = le texte, « d’après l’issue du R<n> » |
| `outcome_no_show` (source `crm` ou `rules`) | prochaine étape « Reprendre contact après l’absence », source « votre issue » ou « aucun enregistrement Fathom », due 2 h après |
| `outcome_no` / `outcome_disqualified` | `decision` non « … · Non / Disqualifié · motif : <motif>[ · suivi long terme] » |
| `cycle_lost` / `cycle_disqualified` | `decision` non (si pas déjà) |
| appel `held` | `meet` « R<n> · Appel » (durée = fin − début) |
| appel `no_show` | `noshow` « Absence R<n> » |
| appel `missed` | `note` · a « R<n> non honoré (aucun enregistrement Fathom) · à replanifier » |
| appel `outcome_pending`, ou `scheduled` dont la fin est passée | `meetdue` (heure passée, aucune issue) |
| appel `scheduled` à venir | `meet` futur (prévu) |

La prochaine étape d'une issue n'est gardée que si le commercial n'a rien envoyé depuis ; sinon `next_move` `rebook` donne
« Replanifier l’appel » (« R<n> non honoré ») ou « Reprendre un rendez-vous » (« le dernier appel a été annulé »).

#### 7.5.3 Calculs (`analyse`)

- **Étapes** : jalons [0, premier `meet` passé, première décision oui/non, premier `paid`] ; Présence (objectif 96 h,
  critique 168 h, `#2A9D8F`), Décision (72 / 144 h, `#8B67C9`), Encaissement (24 / 48 h, `#4F9A5B`), arrêt avant Encaissement
  sur un non. Verdict d'une étape : `crit` si durée ≥ critique, `late` si > objectif. Ces objectifs sont des constantes de la
  page (`STAGES`), copies de `crm_stage_definitions`.
- **Clos** : `won` si payé, `lost` si décision non.
- **Qui doit agir** (« ball », cycles non clos) : 1) un `meetdue` passé → commercial « Déclarer l’issue du R<n> », source
  « heure de l’appel passée, aucune issue » ; 2) un appel à venir → appel ; 3) prochaine étape datée → commercial ;
  4) dernier échange réel du prospect → « Répondre au prospect », en retard au-delà de 2 h ; 5) dernier échange du commercial :
  au-delà de 48 h de silence « Relancer le prospect », sinon prospect « En attente du prospect » (relance dans 48 h − silence).
  Puis, s'il y a une prochaine étape (et pas d'appel ni d'issue manquante), son texte remplace celui du commercial et sa
  source s'affiche.
- **Niveau** (LNP) : le pire SLA **ouvert** de `SKL_SLA.evaluate` : `crit` → Critique, `late` → En retard, `warn` → reste
  « ok » mais compte en **Bientôt dû** (`risk`). (Les règles de la maquette sur la durée d'étape et le retard du commercial
  sont remplacées.)
- **Temps de réponse** : pour chaque échange passé non automatique, l'échange précédent de l'autre côté sans échange du
  même côté ni appel entre les deux ; « réponse en x » (commercial, rouge au-delà de 2 h) ou « a répondu en x ».
- **Durées** : « 5,5 h » sous 72 h, au-delà en jours « 4,1 j » / « 11 j » ; « h 12 » ou « jour 4 » sur l'axe.

#### 7.5.4 Les SLA (`sla_rules.js`, une seule source avec l'Edge Function `sla-tick`)

Seuils en heures : préventif (Bientôt dû), manqué (En retard), critique. Un SLA ne s'affiche qu'au-delà du préventif.
Un prospect clos arrête toutes les horloges (à la date du paiement ou du non).

| ID | Nom | Démarre | S'arrête | Bientôt dû | En retard | Critique | Objectif affiché |
|---|---|---|---|---|---|---|---|
| SH-2 | Premier contact du commercial | RDV pris | premier message ou appel du commercial | 3 min | 15 min | 60 min | 5 min |
| SH-6 | R1 honoré à l’heure prévue | absence au R1 | un appel honoré | — | 45 min | 48 h | à l’heure prévue |
| SH-8 | Relance après une absence | chaque absence | contact du commercial | — | 60 min | 24 h | 15 min |
| SH-11 | Issue déclarée | fin d'un appel (`meetdue`, ou `meet` + décision du même rang) | décision | 10 min | 60 min | 24 h | 15 min |
| DE-1 | Récap écrit après l’appel | fin d'un appel honoré | message du commercial | 45 min | 3 h | 24 h | 60 min |
| DE-7 | Relance sans réponse | dernier message du commercial (Décision, aucun appel à venir, pas de décision) | réponse | 20 h | 48 h | 96 h | 24 h |
| DE-9 | Étape de décision | premier appel honoré | oui ou non | 60 h | 72 h | 144 h | 72 h |
| CA-2 | Premier paiement | oui | premier paiement | 12 h | 24 h | 48 h | 24 h |
| CO-1 | Réponse à un message du prospect | premier message sans réponse d'une rafale (CO-2 : hors 08:00-22:00 New York, à 08:00 suivant) | contact du commercial ou appel honoré | 10 min | 60 min | 4 h | 15 min |

La fenêtre CO-2 n'est appliquée qu'en direct (heure réelle d'ouverture connue). Durée d'un appel par défaut 45 min.

#### 7.5.5 Disposition

1. Pastille démo (démo seulement) : « Démo · prospects d’exemple · rien n’est enregistré · maintenant = dim. 25 oct., 08:51
   (Dubaï) ».
2. Barre du haut : Pipeline | Prospects <n> | Cycle de vente ; recherche « Rechercher un prospect » (sur le nom) ;
   « Tous les commerciaux » + équipe (caché pour le rôle `sales`).
3. **Ligne de KPI** (8 cartes, grille de 8 colonnes, 4 sous 1180 px, 2 sous 620 px), chacune filtre le tableau, une à la fois :

| Carte | Compte | Texte |
|---|---|---|
| Prospects en cours | prospects non clos | « dans le pipeline » |
| Critique | niveau `crit` | « seuil critique du SLA dépassé » |
| En retard | niveau `late` | « un objectif de SLA manqué » |
| Bientôt dû | `risk` (SLA préventif ouvert) | « agir avant que l’objectif soit manqué » |
| Le commercial doit agir | qui doit agir = commercial | « la prochaine étape est à nous » |
| Appels sous 24 h | un appel à venir dans les 24 h | « à l’agenda » |
| En attente du prospect | qui doit agir = prospect | « à lui d’agir » |
| Clos | prospects clos | « n gagné(s) · n perdu(s) » ; le filtre affiche les clos à la place des en cours |

4. **Barre du tableau** : axe « Depuis le RDV » | « Calendrier » ; fenêtre « 24 h » | « 72 h » | « 168 h » | « Tout » ;
   « LIGNE » « Simple » | « Complet » ; « TRI » (« Plus urgent », « Prochain appel », « Montant », « Temps dans l’étape ») ;
   « GROUPER » (« Aucun », « Qui doit agir », « Étape ») ; « ACTIVITÉ » (« Depuis toujours », « 7 / 30 / 90 derniers jours » :
   dernier événement passé, ou le RDV, dans ces jours) ; « ÉTAPE » (« Toutes les étapes », Présence, Décision, Encaissement :
   étape courante, ou étape de clôture d'un clos) ; pastille « Slack #sales-cycle <n> » (n = Critique + En retard,
   infobulle « Chaque SLA en retard ou critique est publié dans Slack #sales-cycle (espace IDA) », non cliquable).
5. **Tableau** : colonnes « PROSPECT · ÉTAPE » (250 px), règle et lignes, « QUI DOIT AGIR · PROCHAINE ÉTAPE » (270 px).
   Sections « En cours · n » (ou par groupe : « Le commercial doit agir », « Appel prévu », « En attente du prospect » ; ou par
   étape ; groupes vides cachés) puis « Clos · n » avec « Afficher » / « Masquer ». Vide : « Aucun prospect dans cette vue. »
6. Légende (Présence, Décision, Encaissement, « Projeté, si les étapes suivantes restent dans l’objectif », « Au-delà de
   l’objectif », « Plus de deux fois l’objectif », points commercial / prospect, ✕ absence, badge « échanges trop proches pour
   être lus : cliquez pour les ouvrir », « R2 · jeu. 19:00 » prochain appel, « Ligne : Simple montre les échanges au survol
   d’une ligne · faites glisser une ligne pour vous déplacer dans le temps »).

**Tris** : Plus urgent = poids (crit 3, late 2, risk 1, ok 0) × 1000 + 500 si Bientôt dû + heures de retard ; Prochain appel
(sans appel en dernier) ; Montant ; Temps dans l’étape.

**Axe** : Depuis le RDV, heure 0 = RDV pris, fenêtre 0 → 340 h, bandes idéales Présence / Décision / Encaissement et repères
verticaux, jamais avant 0. Calendrier : maintenant = 0, fenêtre −170 → +120 h, jours (« Aujourd’hui » en or), minuits, ligne
« Maintenant HH:MM », heures 06/12/18 quand la fenêtre ≤ 96 h ; jamais avant le plus ancien RDV − 12 h. Glisser une ligne
déplace la fenêtre ; molette = déplacer, Ctrl/⌘ + molette = zoom (6 à 600 h).

**Ligne** (60 px) : chevron, initiales du commercial, nom, « <Étape> · <durée> / <objectif> » (orange / rouge si en retard /
critique ; clos : « Gagné · cycle de x » / « Perdu · … »). Sur la voie : barres d'étapes, dépassement hachuré, projection en
pointillé et « € » projeté (non clos), points d'échanges (regroupés en badge numéroté au-delà de 14 px de proximité, rouge
s'il contient une absence) visibles au survol en mode Simple, puce du prochain appel « R2 · Demain 10:21 », point
« maintenant » (pulsé s'il est critique), **marques SLA** : « ! » (orange En retard, or Bientôt dû) ou « !! » (rouge
Critique) à l'instant du manquement, contour seul si résolu, barre pointillée sous la voie tant qu'il est ouvert ; infobulle
« <ID> · <nom>[ · résolu] | <En retard / Critique / Bientôt dû> · <durée> <depuis…> · objectif <objectif> ».

**Qui doit agir** (bordure gauche colorée) : gagné « Gagné · passer la main à l’accompagnement » · « cycle de x · premier
paiement reçu » ; perdu « Perdu » · « à l’étape <étape> · motif dans l’issue » ; commercial : texte de l'action, étiquette
« Critique » / « En retard », « en retard de x » ou « à faire dans x », « · <source> » (infobulle « Pourquoi critique /
en retard ») ; appel : « Appel R<n> · Aujourd’hui 10:21 » · « dans x · préparer à partir de la dernière analyse » ou
« · premier appel » ; attente : « En attente du prospect » · « relancer dans x · <source> · prochaine étape : <texte> ».

#### 7.5.6 Ligne ouverte

Clic sur la colonne du nom (plusieurs lignes ouvertes possibles ; en direct aucune au départ). Barre : « Récit » |
« Échelle de temps » | « Tableau » ; résumé « n échanges · n réponse(s) lente(s) du commercial[ · premier message du
commercial x après la prise de RDV (au-delà de 1 h)] » ; actions rapides ; « Ouvrir la fiche prospect ».
- **Récit** : une colonne de 184 px par échange (badge d'étape au changement d'étape, carte commercial / automatique en haut,
  axe avec écart « +x » ou « ⋯ +x ⋯ » au-delà de 24 h, carte prospect en bas), colonne « Maintenant » avec « Au commercial
  d’agir » / « Au prospect d’agir » ; bouton « Analyse d’appel » sous un appel honoré (et, en direct, sous un `meetdue`) ;
  ← → déplacent la sélection.
- **Échelle de temps** : espacement réel, commercial au-dessus, automatique sur l'axe, prospect dessous, liens de réponse
  (pointillé or, rouge si lent).
- **Tableau** : du plus ancien au plus récent, colonnes heure, qui, canal (« · prévu »), texte, temps de réponse.

Actions rapides (ligne et fiche) : « Déclarer l’issue » (un `meetdue` passé) ; « Répondre par iMessage » (non clos) ;
« Copier le lien Whop » (oui sans paiement) ; « Planifier le prochain appel » (non clos, pas d'appel à venir). En direct,
iMessage, Whop et iClosed ne sont pas reliés : « L’envoi d’iMessages depuis le CRM arrivera plus tard : répondez depuis
Sendblue pour l’instant. » / « Ce lien arrivera plus tard (liens Whop et iClosed). »

#### 7.5.7 Formulaire d'issue (« Déclarer l’issue »)

Fenêtre 600 px : « FORMULAIRE D’ISSUE », « R<n> · <nom> », « <jour> · <heure> · <commercial> ».

| Champ | Valeurs | Montré si |
|---|---|---|
| « L’appel a-t-il eu lieu ? » | Honoré · Absent (défaut Honoré) | toujours |
| « Décision » | Oui · Relance (défaut) · Non · Disqualifié | Honoré |
| « Montant vendu » | nombre, défaut le montant signé | Oui |
| « Modalités de paiement » | Payé en une fois (défaut) · 2 échéances · 3 · 4 · 6 | Oui |
| « Prochaine étape (affichée dans « Qui doit agir ») » | texte, exemple « ex. Envoyer l’étude de cas, puis appeler jeudi » | Relance |
| « Motif » | motifs actifs non automatiques de `crm_reason_codes` (Non : `lost`, Disqualifié : `disqualified`), libellés `REASON` ; le premier est présélectionné au choix de la décision | Non, Disqualifié |
| « Suivi long terme » | Mettre en suivi long terme · Pas de suivi long terme | Non |

« Annuler » · « Enregistrer l’issue ». En direct, `saveLive` envoie `crm_declare_outcome(p_call = l'appel du meetdue, p)`
avec `attendance` `held`/`no_show`, `decision` `yes`/`follow_up`/`no`/`disqualified`, `amount_sold` (texte),
`payment_plan` « Payé en une fois » ou « N échéances », `next_step` (« Relance » si vide), `reason_code`, `nurture`
`standard`/`none`. Sans motif : « Choisissez un motif. » Toasts « Enregistrement de l’issue… », puis « Issue enregistrée ·
l’étape, la prochaine étape et les alertes sont recalculées » (le tableau se recharge) ou « Non enregistré : <message> ».
Le serveur exige la présence, une décision pour un appel honoré, aucune pour une absence, un motif du bon type, puis remplace
l'issue courante (correction auditée), passe l'appel `held` / `no_show`, écrit `outcome_<présence>` et `outcome_<décision>`,
crée ou complète la vente sur un oui, recalcule le cycle. Démo : la maquette modifie ses prospects en mémoire.

#### 7.5.8 Fiche prospect du Cycle de vente

Fenêtre 1180 px (Échap, ×, clic dehors) : « FICHE PROSPECT », nom, pastille qui doit agir, commercial, produit, montant,
téléphone, e-mail ; puces d'étapes « Décision 9,8 j / 72 h +x » ; « cycle ouvert le … · il y a … » ; actions rapides.
Colonne principale : **résumé** en 3 lignes (« Résumé · à partir des événements » en direct : appels, dernière issue ou
prochain appel, gagné ou dernier mot du prospect ≤ 80 caractères) ; filtres « Tout / Messages / Appels / Paiements / RDV et
issues » avec compteurs, « Plus anciens d’abord ⇅ » ; conversation par jour (bulles, cartes d'appel « Honoré / Absence /
Issue non déclarée / Prévu » avec « Analyse d’appel » et « Enregistrement dans Fathom ↗ », lignes système iClosed, Sendblue,
Whop, issues « déclarée par … », notes), séparateur « Maintenant » ; zone d'écriture « Écrire à <prénom>… » + « Envoyer »
(non clos). Colonne latérale : « Qui doit agir », « Échanges » (messages du prospect, du commercial, automatiques, réponse
médiane du commercial, appels honorés · absences), « Appels » (« Analyse » / « absence » / « sans issue » / « prévu »),
« Montants » (« Vendu », « Encaissé (Whop) »), pied « Tout ce qui figure sur cette page vient d’iClosed, de Sendblue, de
Fathom, de Whop et des formulaires d’issue. Les transcriptions des appels restent dans Fathom. »

Analyse d'appel depuis le Cycle de vente : en direct, ouvre l'analyse réelle (`parent.SKL_CA.open`, § 8) ; la fenêtre de
la maquette (5 sections inventées) ne sert qu'en démo.

#### 7.5.9 États et rôles

`viewer` : classe `ro`, aucun bouton d'écriture (issue, réponse, Whop, prochain appel, zone d'écriture). `sales` : pas de
filtre commercial (et la RLS ne charge que ses cycles). Clos : pas de point « maintenant », pas de projection, pas d'écriture.
Échap ferme dans l'ordre : formulaire d'issue, mode d'emploi, analyse, fiche.

### 7.6 « Sans rendez-vous »

Personnes sans cycle (`crm_people_without_cycle`) : statut `nobook`, dernière colonne du Pipeline, statut « Sans
rendez-vous » de la liste, actions proposées « Appeler » et « Prendre un RDV (Calendly) » (sans effet en web), note
= statut iClosed. Pas de chronologie, pas d'encaissement, pas de changement de commercial.

### 7.7 Vue Alertes du CRM

Atteinte par « Voir toutes les alertes → » du Cockpit. C'est la vue d'ALKIMIY Lite (groupes « Maintenant / En
tête-à-tête / À escalader / En attente », compteurs « À traiter / En file / Différées / Escaladées / Fermées aujourd’hui »).
Sa liste `ALERTS` est vidée par `gen_crm.py` et rien ne la remplit : elle affiche toujours « Rien à traiter. ». Bouton
« ← Pipeline ».

### 7.8 Mode d'emploi du CRM (résumé)

« Le CRM des ventes : chaque prospect, du premier contact au montant encaissé… » ; apports : aucun prospect oublié, pipeline
qui dit vrai, l'encaissé à côté du signé ; usage : Pipeline (glisser une carte — inactif en web), Prospects (filtres, tris,
colonnes), Cycle de vente (une ligne par prospect, lire Critique puis Le commercial doit agir, Calendrier et Depuis le RDV,
ouvrir une ligne ou la fiche), ouvrir un prospect pour ses appels, transcriptions et analyse, noter la prochaine action avant
de fermer. Bouton « J’ai compris ».

---

## 8. Analyse d'appel

Sources : `skl-os/crm/call_analysis.js` (`SKL_CA` : fenêtre, pastilles, panneau de la fiche), `call_analysis_view.js`
(`SKL_CAV.html` : rendu du dossier du moteur), `transcript_parse.js` (`SKL_TRANSCRIPT`), RPC `020_crm_call_analysis.sql`,
`021_crm_call_analysis_board.sql`, `025`, `034`. Spécification de départ : `call-analysis/docs/SCREEN_SPEC.md`. Le moteur
cite, le code décide et note ; ces fichiers n'affichent que ce que le moteur a stocké. Les codes du moteur restent en anglais
dans le dossier ; seuls leurs libellés sont traduits (tables `WHY`, `STATUS`, `NATURE`, `SUBT`, `REACT`, `PCAT`…) ; les
citations restent mot pour mot.

### 8.1 Quels appels, qui les voit

`crm_ca_board()` renvoie une ligne par appel analysable : appels passés, non annulés, rang de vente 1 ou 2 (les appels dont
le type iClosed contient « onboarding » ou « case stud » ne comptent pas), sur les cycles visibles : **`admin` CRM : tous ;
sinon les cycles dont la personne est propriétaire** (un `sales_lead` non propriétaire ne voit pas l'analyse). Champs :
`call_id`, `cycle_id`, `round`, `start`, `transcript`, dernier job (`job`, `status` `queued`/`running`/`failed`/`done`,
`error`, `queued_at`, `started_at`), `done_job` (dernier dossier), `scores` par compétence `{score, status, verdict}`.
Lecture une fois par chargement du CRM, puis toutes les 5 minutes (onglet visible) et après chaque ajout.

### 8.2 La pastille d'un prospect

Sur la carte du Pipeline et dans la colonne « Analyse » de la liste. Appel choisi : le dernier R1/R2 avec un job, sinon un
appel récent (moins de 30 jours). États : « R<n> » + quatre notes (Découverte, Écart, Présentation de l'offre, Objections ;
couleur du niveau, rouge si écart absent ou présentation non conforme, « — » si non notée) ; « Analyse R<n> en cours… » ;
« Échec de l'analyse R<n> » ; « + Transcription R<n> ». Clic : ouvre la fiche du prospect sur son analyse (si une analyse
existe), sinon la fenêtre d'ajout.

### 8.3 Dans la fiche prospect (`leadView`)

- « APPELS DE VENTE » : contrôle segmenté R1 / R2 (date `JJ/MM/AAAA HH:MM`, durée si analysée, état « En file », « En
  cours », « Échec », « Analysé », « Sans transcription »), et « Prochain appel : … ».
- Titre « Analyse d'appel » + bouton « Ajouter la transcription » / « Remplacer la transcription ».
- États : aucun appel — « Aucun appel de vente R1 ou R2 passé à analyser pour ce prospect pour l'instant (les appels
  d'intégration et d'étude de cas ne sont pas analysés). Seuls les administrateurs et le commercial attitré du prospect voient
  l'analyse. » ; en cours — « Analyse en cours… » + texte d'attente (« Elle attend le prochain passage de l'analyse, toutes
  les heures à la 7e minute, puis prend 15 à 30 minutes environ. » ou « L'analyse a commencé le … ») + « Ci-dessous :
  l'analyse précédente. » ; échec — « L'analyse n'a pas abouti », erreur, « Relancer l'analyse » (`crm_ca_retry`) ; sans
  transcription — « Pas encore de transcription pour cet appel. Ajoutez-la (Fathom, Zoom, Google Meet…) pour analyser la
  découverte, l'écart, la présentation de l'offre et les objections. » ; chargement — « Chargement de l'analyse… »
  (`crm_ca_record(job)`) ; erreur de lecture.

### 8.4 Le rendu d'une analyse (`SKL_CAV.html`)

1. **Carte d'en-tête** : « Analyse d'appel — <prospect> », bouton « Transcription » / « Masquer la transcription » (tiroir
   de toute la transcription, prises de parole horodatées, 620 px max, « Fermer »). Bandeau rouge si le dossier n'est pas
   noté (« Cet appel n'a pas été noté : <raison> », précision pour `diarization_suspect`). **Quatre tuiles** « 1 · Découverte »,
   « 2 · Écart », « 3 · Présentation de l'offre », « 4 · Objections » : note /100 arrondie + étiquette : « Maîtrisé » ≥ 85,
   « En progrès » ≥ 60, « À travailler » < 60 ; « Écart absent », « Non conforme » ; non notée : « Exclu », « À vérifier »,
   « Non applicable », « Aucun résultat » + raison. La plus basse des tuiles notées (s'il y en a au moins deux) est marquée
   « · point faible » (fond rouge). Pied : « Scores provisoires tant que les seuils de fiabilité ne sont pas atteints · »
   (si `provisional`), « Règles <versions> · », « le modèle cite, le code note · cliquez sur une lettre SPIN pour lire sa
   question et la réponse. »
2. **« 1 La découverte »** : sous-titre « De la première question de diagnostic au début de la présentation de l'offre ·
   <début> → <fin> · n questions codées · lu dans ce que le prospect a dit, jamais dans la lettre ». Bandeau si non notée ;
   bandeau si l'accord des lecteurs sur les registres est faible (« … % tranchés à 3/3 par les lecteurs (objectif 92 %) »).
   Tableau **par registre SPIN** (dossiers v1.2 : Financier, Temps et charge, Identité et statut, Mental et émotionnel, Autre,
   + « Sans registre » ; dossiers plus anciens : par domaine de réponse — Argent, Clients, Confiance en soi, Famille, Temps,
   Santé, Avenir…) : colonne « Registre » (pastille, premier extrait des mots du prospect, 9 mots, citation entière au survol) ;
   « Questions posées, dans l'ordre » (une puce par question : S vert, P orange, I rouge, N noir ; pleine = la question a
   produit un fait, pointillée = sans effet, hachurée = hors SPIN ; « n questions · n chaîne(s) approfondie(s) ») ;
   « ◂ Douleur · Désir ▸ » (faits PAIN/BLOCKER/IMPACT à gauche en rouge, DESIRE/VALUE à droite en or) ; « État » : « Non
   exploré », « Aucun fait du prospect », « Approfondi », « Chiffré », « Valeur exprimée », « Effleuré ». Lignes « Aucun fait du
   prospect » (questions sans effet) et « Hors SPIN » (« aucun point »). **Clic sur une lettre** : sous la ligne, la question
   du commercial et la réponse du prospect (« S · Situation — question 12:40 · T034 », « Fermer » ; « Aucune réponse du prospect
   n'a été trouvée pour cette question. »). Légende.
3. **« 2 L'écart reformulé »** (« Écart présent » vert / « Écart absent » rouge) : sous-titre « Problème et coût reformulés en
   une fois, avec les mots exacts du prospect, validés par le prospect, avant la présentation de l'offre et le prix. » ;
   bandeau « Écart absent : <raison>. n passage(s) s'en est/sont approché(s)… ». **Chronologie de l'écart** : barre 0 → fin
   avec Découverte (bleu), Reformulation (vert), Validation (trait noir), Présentation de l'offre (orange clair), Prix (trait
   rouge), légende horodatée, résumé « reformulation x min · validation à mm:ss · x avant la présentation de l'offre ».
   **« Ce qu'a dit le commercial · mot pour mot »** (ou « Le passage le plus proche · pas une reformulation ») : texte intégral
   des prises de parole du commercial, passages surlignés « problème / coût / A / B · mot pour mot » (vert), « paraphrase »
   (rouge), « mot du commercial » (orange), « non compté » (gris) ; puis la validation du prospect et son issue (« confirmé »,
   « confirmé avec contenu », « corrigé », « rejeté », « aucune réponse »…). **Quatre contrôles** ✓/✗ : « En une fois »,
   « Avant l'offre et le prix », « Problème + coût mot pour mot », « Validé ». **Tableau** Élément / Ce qu'a dit le prospect /
   Ce qu'a reformulé le commercial / Mot pour mot (sans reformulation : ce que le prospect a donné, « non reformulé »). Ligne
   « Matière pour la feuille de route : n autre(s) blocage(s) relevé(s) dans les réponses P ou I[ · Alerte Copilot : …] ».
4. **« 3 La présentation de l'offre »** (« Conforme » / « Non conforme · <raison> ») : sous-titre « Blocage validé « … » →
   <catégorie> · un blocage, un mécanisme, quatre étapes, puis feuille de route, montant, décision. » ; puces « ✓ Offre
   présentée après le oui » / « ✗ … avant le oui » / « ✗ … avant la reformulation de l'écart », « ? n affirmation(s) à vérifier
   par rapport à l'offre », « ✗ <promesse de résultat> » ; **escalier** de cinq cases « Étape 1 · Blocage », « Étape 2 ·
   Mécanisme », « Étape 3 · A → B », « Étape 4 · Preuve », « Puis feuille de route » (Fait / raison de l'échec / Non applicable /
   « Prix d'abord » ; détail : expression clé, horodatage, mécanismes, « récitation », « prix à mm:ss · avant / après le
   prix ») ; **« Ce qu'a dit le commercial · présentation complète, mot pour mot »** du début de la présentation au premier prix
   (620 px max, prises de parole du prospect sur fond gris, passages marqués adhésion, étapes, promesse interdite, affirmation à
   vérifier). Non applicable : bandeau seul.
5. **« 4 Objections »** (note + niveau) : sous-titre « Une résistance, c'est ce que dit le prospect ; les gestes se lisent dans
   la réponse du commercial qui suit ; la résolution, dans les mots du prospect. » Une ligne par objection (regroupée par sous-
   type : Prix, Argent disponible, Confiance dans l'offre, Pertinence, Temps, Co-décideur, Capacité, Choix, Moment — ou par
   nature : Objection, Anxiété · capacité, Anxiété · choix, Inertie) : nom, « n fois · <nature> », état de la dernière
   (« résolue » vert, « persistante » rouge, « latente » gris, « reconnue » / « à vérifier » or), position sur une barre 0 → durée ;
   à droite, chaque épisode : horodatage, mots du prospect, **puces A · I · E · M** (A « Accueillie », I « Isolée »,
   E « Explorée », M « Réponse adaptée » ; vert fait, rouge pointillé non fait, or partiel, grisée non applicable), réponse du
   commercial. **Clic sur une lettre** : panneau « A · Accueillie » + « oui / partiel / non », justification avec la règle
   (OB-13, OB-14, OB-15, OB-16), les prises de parole qui le prouvent (passage surligné) ; reclic ferme. Aucune : « Aucune
   résistance n'a été trouvée dans cet appel. » **Tuiles de prévention** : « Circuit de décision » (« non établi avant le
   prix »), « Budget et échéance » (« non établis avant le prix »), « Tentative passée » (« non mentionnée »). Pied « A
   accueillie · I isolée · E explorée · M réponse adaptée (or = partiel) · cliquez sur une lettre pour ouvrir sa citation ».

Une compétence `to_review` / `excluded` / `not_applicable` montre un bandeau « <état> : <raison>. Ce qui a été trouvé est
affiché ci-dessous, sans note finale / sans points. » L'heure s'écrit `mm:ss` (jamais `h:mm:ss`).

### 8.5 Ajouter une transcription

Fenêtre 1180 px (`SKL_CA.open(callId, {add})`) : avatar, nom, « Analyse d'appel · R<n> · <date> ». Hors web : « L'analyse
d'appel fonctionne dans la version web, où le CRM est en ligne. » Appel non analysable : « Cet appel n'est pas analysé : seuls
les appels de vente R1 et R2 passés le sont (pas les appels d'intégration ni d'étude de cas), et seuls un administrateur ou le
commercial attitré du prospect voient l'analyse. »

« Ajouter la transcription » / « Remplacer la transcription » : « Collez la transcription de l'appel (Fathom, Zoom, Google Meet,
un export .vtt ou .txt), ou déposez le fichier. Chaque prise de parole a besoin d'une heure et du nom de la personne qui parle.
Indiquez ensuite qui est le commercial et qui est le prospect : l'analyse lit les mots du prospect lui-même. » Zone de texte,
« Choisir un fichier » (.txt, .vtt, .srt, .json), dépôt ou collage → lecture automatique ; « Lire les intervenants ».

Lecture (`transcript_parse.js`) : JSON Fathom (`transcript[]`, `speaker.display_name`, `text`, `timestamp`), WebVTT / SRT,
format du moteur `[T001 00:06] SALES: texte`, `[00:06] Nom: texte`, `00:06 Nom: texte`, `Nom (00:06): texte`, blocs avec une
ligne d'en-tête (`Nom  0:06`, `0:06 - Nom`, `Nom: 0:06`) suivie du texte. Lignes consécutives d'un même intervenant réunies.
Résumé « n prises de parole · n intervenants · se termine à mm:ss ». Avertissements : « La transcription est vide. », « Aucune
prise de parole trouvée… », « Un seul intervenant trouvé : le commercial et le prospect doivent être nommés tous les deux. »,
« Aucune heure trouvée : les chronologies de l'appel seront vides. »

**Correspondance des intervenants** : tableau Intervenant / Prises de parole / Mots / Rôle (« Commercial », « Prospect »,
« Autre (associé, assistant…) »). Proposition : l'intervenant dont le nom contient le prénom du commercial → Commercial ; parmi
les autres, celui qui parle le plus → Prospect ; les suivants → Autre (ou Commercial s'il n'y en a pas). « Analyser cet appel »
exige au moins un Commercial et un Prospect (« Choisissez au moins un commercial et un prospect. »), puis envoie
`crm_ca_add_transcript(p_call, p_raw = turns au format "[mm:ss] Nom: texte", p_speaker_map = {nom: SALES|PROSPECT|OTHER},
p_source = 'upload')`. Serveur : `admin` ou propriétaire, appel éligible (`crm_ca_call_info`), texte d'au moins 200
caractères, rôles valides ; enregistre la transcription sur `crm_calls`, passe en échec les jobs encore en file
(« remplacée par une nouvelle transcription »), crée un `crm_ca_jobs` en file et un événement `transcript_added`. La fenêtre
passe à « Analyse en cours… ». Erreur : « Non enregistré : <message> ». Le travail est fait par le worker
`.github/workflows/call-analysis.yml`.

---

## 9. Paramètres › Alertes

Source : `skl-en/project/Settings.pre-hz.dc.html` (cadre posé par `harmonize.py`), lecture des seuils par `skl-os/store.js`
(`rule()`, `alerts()`).

### 9.1 Portée réelle dans LNP

Cet écran règle le moteur d'alertes de `store.js`, conçu pour l'Operating System (tâches, résultats clés, décisions…). Dans
LNP ces collections sont vides : **aucune de ces règles ne se déclenche**. Les alertes commerciales sont les SLA du Cycle de
vente (`sla_rules.js`, § 7.5.4, non réglables ici) et leurs messages Slack (`sla-tick`, `crm_settings.sla_alerts`).

### 9.2 Disposition

Barre : onglets « Alertes et notifications » | « Compte » | « Accès » (administrateurs) ; à droite l'état (« Modifications non
enregistrées » orange, « Enregistré pour toute l’équipe » ou « Enregistré pour cette session du navigateur seulement », « À
jour » vert), « Rétablir les réglages par défaut », « Enregistrer les modifications » (actif seulement s'il y a des
modifications).

Quatre tuiles : « n / 16 · alertes activées » (calculé), puis trois valeurs **écrites en dur** : « 23 · notifications envoyées
· 7 derniers jours », « 4 · critiques · toutes prises en compte », « 3,1 h · délai moyen de prise en compte ».

**« Règles d’envoi »** : « Heures calmes » (interrupteur, « Aucune notification de 20 h à 8 h, à l’heure locale de chacun. Les
alertes critiques passent quand même. ») ; « Résumé quotidien » (« Les alertes de gravité basse sont regroupées en un seul
message à 8 h 30… ») ; « Escalade » (« Une alerte critique ou haute qui n’est pas prise en compte dans le délai ci-dessous est
envoyée à Romain. », − / + de 2 h en 2 h, 2 à 72 h, défaut 24 h) ; « Exemple de notification » (texte fixe).

**« Alertes »** : par groupe (« n sur m activée(s) »), une ligne par règle : nom (clic → fenêtre de réglage) et interrupteur.

### 9.3 Les règles et leurs défauts

| id | Groupe | Nom | Condition (avant · seuil · après) | Défaut | Pas | Min–max | Gravité | Prévenir (Responsable, Chef de pôle, Romain) | Canaux (Application, Slack, E-mail) | Activée |
|---|---|---|---|---|---|---|---|---|---|---|
| a1 | Tâches | Tâche en retard | « Une tâche dépasse sa date d’engagement de plus de » | 0 h | 2 | 0–48 | Haute | 1,1,0 | 1,1,0 | oui |
| a2 | Tâches | Tâche bloquée trop longtemps | « Une tâche reste bloquée plus de » | 24 h | 4 | 4–96 | Haute | 1,1,0 | 1,1,0 | oui |
| a3 | Tâches | Tâche trop grosse | « Une estimation dépasse » … « et doit être découpée » | 8 h | 1 | 4–16 | Moyenne | 1,0,0 | 1,0,0 | oui |
| a4 | Tâches | Trop de travail en cours | « Une personne a plus de » … « tâches en cours » | 3 | 1 | 1–6 | Basse | 1,0,0 | 1,0,0 | oui |
| a5 | Résultats clés | Résultat clé hors trajectoire (rouge) | « Au rythme récent, le résultat clé finit sous » … « de sa cible » | 0,90 | 0,05 | 0,5–1 | Critique | 1,0,1 | 1,1,1 | oui |
| a6 | Résultats clés | Résultat clé à risque ou en rattrapage (orange) | « …ou le réel ÷ attendu passe sous » | 0,90 | 0,05 | 0,7–1 | Moyenne | 1,0,0 | 1,0,0 | oui |
| a7 | Résultats clés | Point d’avancement manquant | « Aucun point d’avancement du résultat clé depuis » | 7 j | 1 | 3–14 | Haute | 1,0,1 | 1,1,0 | oui |
| a8 | Décisions | Décision réversible en retard | « Aucune décision après » | 48 h | 12 | 12–120 | Haute | 1,0,0 | 1,1,0 | oui |
| a9 | Décisions | Décision irréversible en retard | « Aucune décision après » | 7 j | 1 | 2–21 | Haute | 1,0,1 | 1,1,0 | oui |
| a10 | Décisions | Revue de décision à faire | « Une revue à 30 ou 90 jours a un retard de » | 0 j | 1 | 0–14 | Moyenne | 1,0,0 | 1,0,0 | oui |
| a11 | Explorations | Temps imparti épuisé | « Une exploration atteint » … « de son temps imparti » | 100 % | 5 | 50–100 | Haute | 1,1,0 | 1,1,0 | oui |
| a12 | Explorations | Temps imparti bientôt épuisé | idem « …sans résultat pour l’instant » | 75 % | 5 | 25–95 | Moyenne | 1,0,0 | 1,0,0 | oui |
| a15 | Bibliothèque et propriété intellectuelle | Cession de droits manquante | « Un contenu réalisé par un indépendant n’a pas de cession de droits » | sans seuil | — | — | Haute | 0,1,0 | 1,0,1 | oui |
| a16 | Bibliothèque et propriété intellectuelle | Guide de méthode à revoir | « …n’a pas été revu depuis » | 6 mois | 1 | 1–12 | Basse | 1,0,0 | 0,0,1 | oui |
| a17 | Finances | Dépassement de budget | « Un pôle dépense plus de » … « au-delà de son budget mensuel » | 10 % | 5 | 0–50 | Haute | 0,1,1 | 1,0,1 | **non** |
| a18 | Finances | Trésorerie trop courte | « L’autonomie de trésorerie passe sous » | 6 mois | 1 | 2–18 | Critique | 0,0,1 | 1,0,1 | oui |

`store.js` n'évalue que a1 à a11 (`RULE_DEFAULTS`) ; a12, a15 à a18 n'existent que sur cet écran. Gravités stockées `Low`,
`Medium`, `High`, `Critical`, affichées Basse, Moyenne, Haute, Critique (clic sur la pastille de la ligne = gravité suivante).
Formats : ratio « 0,90 », « 75 % », « 6 mois », « 24 h », « 7 j ».

### 9.4 Fenêtre de réglage d'une alerte

« ALERTE · <groupe> », nom, « × ». État « Alerte activée » (« Les notifications partent quand la condition est remplie. ») /
« Alerte désactivée » (« Rien n’est envoyé. Les réglages ci-dessous sont gardés. ») + interrupteur. « Condition » : texte avec
le seuil réglable par − / + (bornes min–max), « Par défaut : x » (ou « Cette alerte n’a pas de seuil. »). « Gravité » :
quatre boutons + explication (Basse : résumé quotidien ; Moyenne : tout de suite hors heures calmes ; Haute : tout de suite et
remonte à Romain ; Critique : passe outre les heures calmes et remonte). « Prévenir » : Responsable, Chef de pôle, Romain ;
« Canaux » : Dans l’application, Slack, E-mail. « Quand elle se déclenche » : résumé (« Gravité haute · prévenus :
Responsable et Chef de pôle · canaux : Dans l’application et Slack. » ; « · regroupée dans le résumé de 8 h 30. » si basse ;
« Personne ne sera prévenu : choisissez au moins une personne et un canal. »). « Rétablir la valeur par défaut », « Terminé ».

### 9.5 Enregistrement, rôles, mode d'emploi

- « Enregistrer les modifications » : `SKL.save("config", {id:"alerts", alerts, values, quietOn, digestOn, escH})` →
  document `docs(col='config', id='alerts')` (web, Artifact) ou mémoire (démo). Tant qu'on modifie (`dirty`), les changements
  d'autrui ne sont pas appliqués à l'écran. « Rétablir les réglages par défaut » remet les défauts sans enregistrer.
- `viewer` : `SKL.readOnly` ignore l'écriture (la RLS de `docs` n'autorise que `admin` et `member`) ; l'écran affiche
  pourtant « Enregistré pour toute l’équipe » (voir § 13).
- Mode d'emploi : le système d'alertes, une condition par alerte avec seuil, gravité, destinataires et canaux ; apports (le
  système prévient, la bonne personne, pas de bruit, des règles qui suivent les règles de travail) ; usage (interrupteur,
  clic sur le nom, − / +, gravité et destinataires, règles d'envoi, enregistrer et revoir chaque trimestre).

---

## 10. Paramètres › Compte

Sources : `skl-os/gen_access.py` (cadre), `skl-os/build.py` `decorate()` (bloc `[data-me]`), `web/public/skl-web.js`
`account()` et `team()`, `web/api/team.js`.

### 10.1 « Qui utilise LNP ici »

« Les écrans montrent le travail de la personne choisie ici : ses tâches, ses alertes et ses suivis. » Sélecteur « VOUS ÊTES »
(« Choisissez qui vous êtes… » + les membres fixes de `store.js`, noms fictifs de l'Operating System, rôles affichés en
français : « Commercial », « Responsable contenu »). Le choix est gardé dans `localStorage["skl_me"]` et, en mode partagé, dans
`docs(col='members', id=<uid>)`. Point d'état : « Données partagées · enregistrées pour l’équipe » (vert), « Données partagées
· lecture seule » (or), « Connexion… », « Données de démonstration · non enregistrées » (gris). Ce choix ne sert à aucun écran
commercial (le CRM utilise le compte connecté).

### 10.2 « Connecté » (web)

Carte : « Connecté », e-mail, « <rôle> » (+ « · lecture seule » pour un lecteur), bouton « Se déconnecter ». Hors web : carte
« Connexion et équipe » qui explique où cela se trouve.

### 10.3 « Accès de l’équipe » (administrateurs, web)

`GET /api/team` (admin seulement : 403 « Seuls les administrateurs gèrent les accès de l’équipe. ») liste `members`
(`user_id, email, role, created_at`) avec la dernière connexion et l'état confirmé de chaque compte Auth.

- Formulaire « E-mail » (`nom@exemple.fr`) + « Rôle » (Administrateur · gère l’équipe / Membre · lit et modifie / Lecteur · lit
  seulement ; défaut Membre) + « Inviter » → `POST {action:"invite"}` : e-mail validé (« Saisissez une adresse e-mail
  valide. »), lien d'invitation généré (`auth.admin.generateLink type invite`, ou `recovery` si le compte existe), ligne
  `members` créée ou mise à jour (le trigger crée le membre CRM). Encadré « Invitation prête pour <e-mail> » : « Envoyez ce lien
  à <e-mail> (Slack, e-mail…). Il ouvre LNP et lui demande de choisir un mot de passe. Il ne sert qu’une fois ; s’il ne marche
  plus, créez-en un nouveau ici (Nouveau lien d’invitation). », le lien `https://<site>/#skl-link=<hashed_token>&type=invite`,
  « Copier le lien » (→ « Copié »).
- Tableau « Membre » (e-mail, « (vous) », « Dernière connexion le 3 nov. » ou « Invité · ne s’est pas encore connecté ») /
  « Rôle » (sélecteur, désactivé pour soi ; changement → `{action:"role"}` ; « Gardez au moins un administrateur. ») /
  actions (pas pour soi) : « Lien de réinitialisation » (compte confirmé) ou « Nouveau lien d’invitation » → `{action:"reset"}`
  (lien `type=recovery` dans le même encadré) ; « Retirer » → confirmation `sklConfirm` « Retirer cette personne ? » · « <e-mail>
  ne pourra plus se connecter à LNP. Son travail reste dans les données partagées. » · « Retirer l’accès » → `{action:"remove"}`
  (compte Auth supprimé ; pas soi-même ; garder au moins un administrateur).
- Erreurs en rouge au-dessus du tableau ; « Chargement… » pendant la lecture.

### 10.4 Mode d'emploi (résumé)

Qui utilise LNP ici ; le menu ne garde que les écrans, compte et équipe sont réunis ; usage : « Vous êtes », « Se
déconnecter », et pour les administrateurs « Accès de l’équipe » (inviter, changer un rôle, lien de réinitialisation, retirer) ;
les écrans de chacun se règlent dans Accès.

---

## 11. Paramètres › Accès (administrateurs, web)

Sources : `skl-os/gen_access.py` (cadre), `web/public/skl-web.js` (`AREAS`, `applyAccess`, `drawAccess`), `web/api/_screens.js`,
`web/api/team.js` (`action:"access"`).

### 11.1 Les clés

`SCREENS = ["salescockpit", "salesday", "crm", "settings", "claude"]` (`settings` = Paramètres › Alertes ; `claude` = le
connecteur LNP dans Claude, pas un écran). Défaut : tout sauf `claude` ; un administrateur a tout, y compris `claude`. Stocké
dans `app_metadata.screens` du compte (écrit seulement par le serveur). Une liste ancienne qui contient `crm` gagne `salesday`
(Ma journée, 2026-10-31) ; les clés inconnues sont ignorées. « Compte » est toujours ouvert ; « Accès » toujours ouvert aux
administrateurs (`/api/me` ajoute `access`) et jamais attribuable.

### 11.2 Effet dans la page (`applyAccess`)

Une feuille de style cache les entrées de la barre latérale et les onglets des écrans fermés, les groupes vides et un système
sans écran ouvert ; un clic vers un écran fermé est bloqué et renvoie au premier écran ouvert de son espace (Paramètres →
Compte) ; à l'ouverture, si l'écran courant est fermé, la page va au premier écran ouvert. `html.skl-admin` affiche les entrées
`data-admin-only`. Cela cache des écrans, pas des données (la RLS décide toujours des prospects visibles).

### 11.3 Le panneau

Hors web : « Les accès se gèrent dans la version web » · « Connectez-vous à LNP sur le web avec un compte administrateur pour
choisir les écrans que chaque personne peut ouvrir. » En web (administrateur) : carte « Qui ouvre quoi » (règles rappelées :
tout ouvert par défaut, décocher un espace ou un écran, administrateurs restreignables mais gardant Accès, personne ne change
ses propres accès, case Claude réservée aux administrateurs par défaut, écrans et non données). Moins de deux membres :
« Personne à configurer pour l’instant ». Une carte par membre : e-mail (« (vous) »), « <rôle> · dernière connexion le … » ou
« · ne s’est pas encore connecté », état « Enregistrement… » / « Enregistré » / erreur, « Tout ouvrir » (remet le défaut :
`access: null`). Pour soi : « C’est vous : un autre administrateur peut changer vos accès. » Grille d'espaces : « Ventes »
(Cockpit commercial, Ma journée, CRM), « Paramètres » (Alertes), « Claude » (Connecteur Claude), chacun avec une case
« tout » (indéterminée si partiel) et « k/n ». Chaque case enregistre aussitôt (`POST /api/team {action:"access", user_id,
access:[…]}` ; refus pour soi : « Vous ne pouvez pas changer vos propres accès. Demandez à un autre administrateur. »). La
personne voit le changement au prochain chargement.

### 11.4 Mode d'emploi (résumé)

Décider quels écrans chaque personne peut ouvrir, par espace ou écran par écran ; seuls les administrateurs voient la page ;
enregistrement immédiat, effet au prochain chargement, tout ouvert par défaut, « Tout ouvrir » pour revenir au défaut ;
fermer un écran le cache, pas ses données.

---

## 12. Récapitulatif : qui peut faire quoi

| Action | Écran | RPC / API | admin | membre (`sales_lead`) | lecteur | `sales` |
|---|---|---|---|---|---|---|
| Déclarer une issue | Ma journée, Cycle de vente | `crm_declare_outcome` | ✓ | ✓ | — | ses cycles |
| Note « Fait » | Ma journée | `crm_add_note` | ✓ | ✓ | — | ses cycles |
| Changer de commercial | Fiche, liste | `crm_reassign_cycle` | ✓ | ✓ | — | — |
| Échéancier, paiement, remboursement, retrait | Encaissement | `crm_set_payment_plan`, `crm_add_payment`, `crm_add_refund`, `crm_delete_payment` | ✓ | ✓ | — | ses cycles |
| Voir / ajouter une analyse, relancer | Fiche, pastilles | `crm_ca_board`, `crm_ca_record`, `crm_ca_add_transcript`, `crm_ca_retry` | ✓ | ses cycles seulement | — | ses cycles |
| Ordre des colonnes, liste du jour | Pipeline, Ma journée | `crm_set_pref` | ✓ | ✓ | ✓ | ✓ |
| Réglages des alertes | Paramètres › Alertes | `docs` (`config/alerts`) | ✓ | ✓ | — | — |
| Inviter, rôle, lien, retirer | Compte | `/api/team` | ✓ | — | — | — |
| Accès par écran | Accès | `/api/team` `access` | ✓ | — | — | — |

(« membre » = rôle d'équipe `member`, devenu `sales_lead` dans le CRM ; `sales` n'est jamais attribué par l'invitation.)

---

## 13. Écarts entre le code et `docs/crm/` (le code fait foi)

- `docs/crm/11-crm-frontend.md` : UI « en anglais » et « interrupteur anglais / français » — LNP est entièrement en français,
  langue fixée. Le glisser-déposer du Pipeline n'est pas remplacé par le formulaire d'issue : il affiche un message (§ 6.2).
  Pas d'écran « Non rattachés », « Fiabilité » ni « Règles de vente » ; l'onglet « Alertes » des Paramètres n'a pas de groupe
  « Ventes (CRM) » c1–c18.
- `docs/crm/16-sales-cycle-screen.md` : six cartes KPI et un bouton « Ma journée › Besoin de vous » → huit cartes (avec
  Bientôt dû et Clos) et une pastille Slack non cliquable ; le niveau d'un prospect vient des SLA v3, plus de la durée d'étape ;
  filtres Activité et Étape en plus ; modalités de paiement 1 / 2 / 3 / 4 / 6 au lieu de 1 / 2 / 3 ; durées en jours au-delà de
  72 h ; pas de bouton « i » propre ; envoi d'iMessage, lien Whop et lien iClosed non branchés en direct ; la fenêtre d'analyse
  à 5 sections n'existe qu'en démo.
- `call-analysis/docs/SCREEN_SPEC.md` : pas de « carte de l'appel » (frise des jalons) dans le rendu ; les gestes sont
  A · I · E · M (pas A · I · C) ; la découverte est par registre SPIN v1.2, pas par domaine ; l'analyse s'affiche dans la fiche
  prospect et non dans une fenêtre à part ; le bouton « Transcription » montre toute la transcription aux personnes autorisées.
- `docs/crm/18-sales-cycle-slas.md` : conforme au code (mêmes seuils).

Incohérences observées dans le code, à reproduire ou corriger en connaissance de cause :
- Libellés de motifs : Ma journée affiche `crm_reason_codes.label` (« Budget impossible », « Concurrent »…), le Cycle de vente
  le dictionnaire `REASON` de `data.js` (« Aucun budget », « A choisi une autre offre »…).
- « Montants › Encaissé (Whop) » de la fiche du Cycle de vente lit `l.collected`, que `salesCycleView` ne fournit pas : 0 € en
  direct.
- Un appel importé déjà `held` sans issue déclarée est un `meet` (pas `meetdue`) dans le Cycle de vente : pas de bouton
  « Déclarer l’issue » pour lui ; Ma journée le propose (`next_move = declare_outcome`).
- `crm_ca_board` exclut les appels d'intégration par le nom de l'événement iClosed, alors que `crm_ca_call_info` (`025`) se
  fonde sur l'enregistrement Fathom quand le cycle en a un : un appel peut figurer au tableau et être refusé à l'ajout.
- Paramètres › Alertes : tuiles chiffrées en dur ; message « Enregistré pour toute l’équipe » aussi pour un lecteur dont
  l'écriture est ignorée.
- « Durées de vente » du Pipeline toujours « — » en direct (`cyc` non calculé) ; la vue Alertes du CRM toujours vide.
- La fiche prospect garde le code d'enregistrement de note sans bloc pour l'atteindre.

---

## 14. Non déterminé à partir du dépôt

- Qui remplit `crm_alerts` (lu par Encaissements à risque, `crm_reassign_cycle` et Realtime) : aucun fichier du dépôt n'y
  insère de ligne (seuls `003_crm_core.sql` la crée et `crm_merge_people` / `crm_reassign_cycle` la mettent à jour). En
  pratique, Encaissements à risque ne montre donc que les prochaines étapes en retard (code « SLA »).
- Le contenu exact des dossiers d'analyse (`crm_ca_record`) dépend du moteur (`call-analysis/docs/OUTPUT_CONTRACT.md`) : seuls
  les champs lus par `call_analysis_view.js` sont décrits ici.
- La date `no_show_rule.since` et l'activation de la règle d'absence (`enabled`) en production ne sont pas dans le dépôt.

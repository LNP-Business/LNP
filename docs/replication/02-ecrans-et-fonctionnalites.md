# 02 · Écrans et fonctionnalités

Spécification fonctionnelle de chaque écran de LNP tel qu'il est sur `main` (relevé du 27 novembre 2026), assez précise pour le
reconstruire. Les libellés entre « » sont ceux que la personne lit, mot pour mot ; identifiants, clés et valeurs comparées restent
en anglais. Quand `docs/crm/` ou `CLAUDE.md` disent autre chose que le code, **le code fait foi** et l'écart est signalé (§ 17).

**Source de vérité.** Depuis le 10 novembre, l'interface a été refaite directement dans la page construite `app/lnp.html`
(`CLAUDE.md`, « Interface en production ») : les générateurs (`app/gen_*.py`, `gabarits/`, `uploads/crm_source.html`) et la plupart
des modules `app/crm/*.js` sont en retard sur elle. Ce chapitre décrit donc `app/lnp.html`. Les copies embarquées diffèrent de
leurs fichiers sources : `app/crm/call_analysis_view.js` (846 lignes d'écart), `call_analysis.js` (132), `setting_ui.js` (75),
`lead_feed.js` (54), `cash_ui.js` (36), `outcome_ui.js` (29) ; seuls `app/crm/transcript_parse.js` et
`app/training/simulateur.html` sont identiques à leur copie. Une partie de ces écarts vient du thème d'`edition.json` (couleurs,
polices) appliqué au build, mais pas tout : `call_analysis_view.js` n'a ni `gSide`, ni `piste`, ni `.gx3`, ni « Pour ton prochain
appel », ni les questions incertaines (`UNC`) ; `setting_ui.js` n'a pas les trois lignes `STEP` du panneau du setter.

**Lire la page.** `app/lnp.html` (2,6 Mo, 4 352 lignes) contient l'enveloppe (gabarits `<template>`, modules `window.LNP_*`) et six
documents d'écran sous forme de chaînes JSON d'une seule ligne : `window.LNP_CRM_DOC` (Leads, qui contient lui-même
`LNP_SB_DOC`, le bureau de Cycle de vente, et `LNP_SC_DOC`, l'ancienne vue v6), `LNP_TRAINING_DOC` (Découverte),
`LNP_ACADEMIE_DOC` (Maîtrise de l'offre), `LNP_SIMULATEUR_DOC`, `LNP_RESULTATS_DOC` et `LNP_SUIVI_DOC`. Pour les lire, décoder
chaque ligne `<script>window.LNP_…_DOC = "…";</script>` avec un analyseur JSON (`json.loads`), puis, dans le document du CRM,
la déclaration `var LNP_SB_DOC="…";`.

---

## 1. Le cadre commun

### 1.1 Une page, des écrans

- Chaque écran est un gabarit `<template id="tpl-<id>" data-file="<Fichier>.dc.html">` et une classe `Component extends DCLogic`
  (moteur de gabarits de `app/build.py` : trous `{{…}}`, `<sc-if value>`, `<sc-for list as>`, `onClick="{{fn}}"`). `setState`
  redessine l'écran courant dans `#app`. La page en contient 13 :

| id | Fichier | Titre (`h1`) | Contenu |
|---|---|---|---|
| `salescockpit` | `SalesCockpit.dc.html` | Cockpit commercial | modules `LNP_SALES` (`[data-dash]`) et `LNP_SALESEXEC` (`[data-salesexec]`) |
| `salescycle` | `SalesCycle.dc.html` | Cycle de vente (lecteur d'écran seulement) | cadre du CRM, `[data-crm][data-crmview="cycle"]` |
| `crm` | `CRM.dc.html` | Leads | cadre du CRM, `[data-crm]` |
| `entrainement` | `Entrainement.dc.html` | Découverte | cadre `[data-training]` |
| `academie` | `Academie.dc.html` | Maîtrise de l’offre | cadre `[data-academie]` |
| `simulateur` | `Simulateur.dc.html` | Simulateur | cadre `[data-simulateur]` |
| `resultats` | `Resultats.dc.html` | Mes résultats | cadre `[data-resultats]` |
| `suivi` | `SuiviCommerciaux.dc.html` | Entraînement de l’équipe | cadre `[data-suivi]` |
| `settings` | `Settings.dc.html` | Paramètres (onglet Alertes et notifications) | réglages des SLA |
| `account` | `Account.dc.html` | Paramètres (onglet Compte) | `[data-account]`, dessiné par `web/public/lnp-web.js` |
| `access` | `Access.dc.html` | Paramètres (onglet Accès) | `[data-access]`, dessiné par `web/public/lnp-web.js` |
| `salesday` | `SalesDay.dc.html` | Ma journée | **inatteignable** : redirigé vers Cycle de vente (§ 4.9) |
| `alertes` | `Alertes.dc.html` | Alertes | **inatteignable** : redirigé vers Cycle de vente (§ 10.4) |

- **Routage** (script de fin de `app/lnp.html`) : l'écran courant est dans le hash (`#salescockpit`…), écrit par
  `history.replaceState` ; l'onglet du navigateur s'appelle « LNP · <titre de l'écran> ». `HOME = "salescockpit"` ;
  `KEEP` = les 13 écrans ci-dessus ; `MOVED = { alertes: "salescycle", salesday: "salescycle" }` ; un hash inconnu renvoie à `HOME`.
  `go("salesday")` et un démarrage sur `#salesday` appellent `openNow()` (Cycle de vente sur « À traiter »).
  `window.LNP_EDITION = { home, keep }` est lu par `lnp-web.js` (Paramètres › Accès ne liste que ces écrans).
- Les liens `<a href="Xxx.dc.html">` sont interceptés et appellent `go(id)`. Un lien vers `SalesCycle.dc.html` (ou portant
  `data-now`) ouvre Cycle de vente sur « À traiter » quand des prospects y attendent.
- **Écran d'arrivée selon le rôle** (`roleHome`) : à la connexion, sans hash ni clic, un administrateur reste sur le Cockpit ; une
  personne dont le rôle CRM est `sales` part sur Cycle de vente › « À traiter ».
- **Messages entre cadres** (`window.postMessage`) :

| Message | Effet |
|---|---|
| `{lnp:"go", screen}` | change d'écran ; `screen:"alertes"` ouvre Cycle de vente › À traiter |
| `{lnp:"crm", owner}` | ouvre Leads sur l'onglet Pipeline filtré sur ce commercial (clic sur une ligne d'Équipe commerciale) |
| `{lnp:"crm", lead}` | ouvre la fiche de ce prospect dans Leads (notification du navigateur, alertes) |
| `{lnp:"crm", view:"alerts"}` | ouvre Cycle de vente › À traiter (« Voir toutes les alertes → » du Cockpit) |
| `{lnp:"now", n, crit, list}` | envoyé par le bureau de Cycle de vente : nombre de prospects « Agir maintenant », dont critiques, et leur liste (`window.LNP_NOWLIST`, événement `lnp-nowlist`) |
| `{lnp:"scrim", on}` | une fenêtre ouverte dans un cadre d'entraînement assombrit toute la page |

- **Mise en page** (`fit`, décision du 2026-11-09) : bureau seulement, fluide de 1 280 à 1 920 px, **plus de zoom**. La racine
  `[data-root]` fait la hauteur de la fenêtre (`--screen-h`).
- **Cadres** (`frameFor`, `placeOne`) : chaque document d'écran vit dans une `iframe srcdoc` fixe (`position: fixed`, fond
  `#F7F8FB`), créée une fois, hors du redessin, replacée sur son emplacement à chaque rendu, défilement et redimensionnement.
  Le cadre du CRM descend jusqu'au bas de la fenêtre (`"edge"`), les autres s'arrêtent 24 px au-dessus ; hauteur minimale
  480 px. Titres des cadres (`FRAME_TITLES`) : « Leads », « Découverte », « Maîtrise de l’offre », « Simulateur »,
  « Mes résultats », « Entraînement de l’équipe ». Le CRM sert deux écrans : `crmView()` appelle `lnpCrmView("cycle"|"crm")`
  dans le document. Le cadre du CRM est préparé en arrière-plan dès que les documents sont là (`warmCrm` → `lnpCycleWarm`),
  pour que le compteur « Agir maintenant » existe sur tous les écrans.
- **Documents chargés après la connexion** : dans l'édition web, `web/build_web.py` retire les six `window.LNP_*_DOC` de la page et
  les écrit dans `web/public/docs/lnp-docs.<empreinte>.js` (`window.LNP_DOCS_SRC`), chargé par `loadDocs()` une fois la personne
  connectée (`html.lnp-locked` retiré) et gardé en cache (`web/vercel.json`).
- **Modules en shadow root** (`mountModule`) : `LNP_SALES`, `LNP_SALESEXEC`, `LNP_SALESDAY`, `LNP_ALERTS` sont montés une fois
  dans un `div` + `attachShadow`, gardent leur état, reçoivent une infobulle commune (`role="tooltip"`) et une bulle de message
  commune (`role="status"`, bas centre). Une donnée qui change pendant une saisie attend la perte du focus.
- **Redessin et focus** (`build.py`) : un redessin ne retire jamais le curseur du champ en cours ; le défilement déplace seulement
  les cadres, sans redessiner les modules.
- Lien d'évitement « Aller au contenu » : place le focus dans le cadre du CRM sur Leads et Cycle de vente, sinon sur `<main>`.

### 1.2 Barre latérale

Source dans la page : chaque gabarit porte sa barre (`<nav aria-label="Navigation principale">`, 232 px, fond `#1E2A5E`) ;
générateur en retard : `app/nav.py`.

- En tête : logo 38 px, « Les **Nouveaux** Profs », sous-titre « Ventes ».
- Groupe « Ventes » (`data-navgrp="ss-sales-system"`) : **Cockpit commercial**, **Cycle de vente** (avec la pastille
  `data-badge="alertes"`), **Leads** (l'écran `crm`).
- Groupe « Entraînement » (`ss-training`) : **Découverte**, **Maîtrise de l'offre**, **Simulateur**, **Mes résultats**,
  **Entraînement de l’équipe** (`data-admin-only`).
- Groupe « Paramètres » (`settings-settings`), affiché seulement sur les écrans de Paramètres : **Alertes et notifications**,
  **Compte**, **Accès** (`data-admin-only`).
- En bas : bouton « Paramètres » (roue dentée) vers `Settings.dc.html`.
- Plus d'entrée « Ma journée » ni « Alertes ».
- L'entrée courante porte `aria-current="page"`. Chaque groupe se replie sur son titre (« Replier ou déplier <groupe> ») ; le
  choix est gardé dans `localStorage["lnp-nav-fold"]` ; le groupe de l'écran courant se rouvre à chaque changement d'écran.
  `html:not(.lnp-admin) [data-admin-only]{display:none}`.
- **Pastille de Cycle de vente** (`decorate`) : le nombre de prospects « Agir maintenant » envoyé par le bureau (`{lnp:"now"}`) ;
  tant que le bureau n'a pas compté, le nombre d'alertes ouvertes (`LNP_ALERTS.store`). Fond `#B42318` s'il y a un critique,
  sinon `#143A8D` ; cachée à zéro ; infobulle et nom du lien « Cycle de vente : N prospects à traiter maintenant, dont K
  critiques ».

### 1.3 En-tête des écrans

Barre `header[data-topbar]` de 54 px : `h1` (classe `ph`), contrôle segmenté des vues à gauche (`role="group"
aria-label="Vues"`), contexte ou actions à droite, 72 px réservés pour le bouton « i ». Quand l'en-tête porte des onglets
(Cockpit, Paramètres), il reste collé en haut au défilement (`position: sticky`, ombre quand `html.lnp-scrolled`).

### 1.4 « Mode d'emploi » (bouton « i »)

Bouton rond 52 px en haut à droite (« i » italique, `aria-label="Mode d’emploi de la page"`). Il ouvre une fenêtre
(`role="dialog"`, 820 px, voile `rgba(30,42,94,.55)`) : sur-titre « Mode d’emploi », titre, sections numérotées « À quoi sert cette
page », « Ce qu’elle apporte… » (le titre varie selon l'écran), « Comment l’utiliser », et pour Cycle de vente une quatrième
« Lexique » (R1, R2, R3 ; Issue ; Délai (SLA) ; En retard, Critique ; Setter) ; bouton « Compris » et « × ». Échap ferme. Les
textes de chaque écran sont résumés dans sa section. `web/kb/build_kb.mjs` les reprend pour le connecteur Claude (§ 17 : il lit
d'abord les gabarits périmés).

### 1.5 Confirmation avant toute suppression

- Page : `window.lnpConfirm({title, body, ok, onOk, onCancel, primary, focus, quick})` = `LNP.confirm` (`app/store.js`) : voile,
  `role="alertdialog"`, « Annuler » (focus par défaut) et un bouton rouge (`ok`, « Supprimer » par défaut). Échap, Annuler ou un
  clic hors de la boîte n'appliquent rien.
- Document du CRM : `window.lnpAsk(title, body, ok, fn)`, même aspect.

### 1.6 Les trois façons d'ouvrir la page

| Contexte | `store.js` (`LNP.mode`) | `LNP_CRM.mode()` | Effet |
|---|---|---|---|
| Fichier ouvert tel quel | `demo` | `demo` | données d'exemple, rien n'est enregistré |
| Artifact claude.ai (`window.claude.use` existe, pas `.web`) | `shared` | `demo` | réglages partagés, CRM d'exemple |
| Édition web (`window.claude.web === true`) | `shared` | `live` (tables `crm_*`) | données réelles, sous connexion |

`window.LNP_TODAY = "AAAA-MM-JJ"` fige l'horloge de `store.js` (tests) ; `store.js` relit la date chaque minute.

### 1.7 Rôles

Deux niveaux (`web/supabase/001_init.sql`, `003_crm_core.sql`, `011_access_everyone.sql`, `048_crm_admin_only_sees_all.sql`,
`054_crm_setting.sql`).

| Rôle d'équipe (`members.role`, libellé de Compte) | Rôle CRM créé à l'invitation (`crm_members.role`) |
|---|---|
| `admin` « Administrateur · gère l’équipe » | `admin` |
| `member` « Membre · lit et modifie » | `sales_lead` |
| `viewer` « Lecteur · lit seulement » | `viewer` |

Le déclencheur de `011` (`crm_member_from_team`) crée la ligne `crm_members` : `member_key` = partie locale de l'e-mail sans
caractères spéciaux (suffixe 2, 3… si pris), `full_name` = `initcap` de la partie locale ; une ligne existante n'est pas modifiée.
Les rôles CRM `sales` (commercial) et `setter` se posent par la colonne « Fonction » de Compte (§ 14) ou à la main.

| Rôle CRM | Voit (RLS, `crm_sees_all()` = `admin` seulement depuis `048`) | Écrit (`crm_require`, version de `054`) |
|---|---|---|
| `admin` | tous les prospects | tout |
| `sales_lead` | les cycles dont il est propriétaire | toutes les RPC qui demandent `admin`/`sales_lead`, sur n'importe quel cycle |
| `sales` | ses cycles (`owner_id`) | sur ses cycles |
| `setter` | les personnes qui lui sont confiées (`crm_people.setter_id`) | sur les cycles de ces personnes ; actions du setter |
| `viewer` | rien en propre | rien |

Dans la page : `html.lnp-admin` (rôle d'équipe `admin`) affiche les entrées `data-admin-only` ; `window.lnpCanAssign` (changer de
commercial) = rôle CRM `admin` ; `lnpScData.role` règle le bureau (`sales` : pas de filtre commercial ; `viewer` : lecture).

### 1.8 Édition web : l'enveloppe

`web/build_web.py` écrit `web/public/index.html` : `<!doctype html><html lang="fr">`, `meta viewport`, `meta robots noindex`,
`window.LNP_BUILD`, `<script src="/api/config">` (`window.LNP_WEB_CONFIG = {url, anonKey}`), supabase-js `2.117.2` (jsDelivr),
`/lnp-web.js`, puis la page sans ses documents (§ 1.1). `lnp-web.js` pose `html.lnp-locked` (`#app` invisible) jusqu'à la
connexion et définit `window.claude = { web: true, use(name) }`, qui résout une fois connecté :

| `use(…)` | Contenu |
|---|---|
| `"user"` | `id()`, `me()`, `isOwner()`, `canEdit()` (administrateur), `can("data.write")` (administrateur ou membre), `profiles()` |
| `"crm"` | `from(table)` et `rpc(fn)` limités aux noms `crm_[a-z_]+`, `me()` (ligne `crm_members`), `subscribe(tables, fn)` (Realtime) |
| `"simulateur"` | `fetch(chemin, init)` vers la fonction Edge `simulateur`, toujours avec le jeton frais de la personne |

Version : `lnp-web.js` compare `LNP_BUILD` à `/version.json` ; à l'ouverture, une version plus récente recharge la page une fois
(`sessionStorage["lnp-reloaded-for"]`), ensuite (retour sur l'onglet, au plus toutes les 10 min) un bandeau « Une nouvelle version
de LNP est disponible. » + « Recharger ».

---

## 2. Connexion et mots de passe (édition web)

Fichier : `web/public/lnp-web.js` (`showGate`, `enter`, `authFr`) ; API : `web/api/me.js`, `web/api/team.js`.

### 2.1 Fenêtre de connexion (`#lnp-gate`)

Plein écran, carte 420 px, en-tête « LNP Ventes », `role="dialog"` « Connexion à LNP » ; onglet « LNP · Connexion ». Une erreur
est annoncée (`role="alert"`).

| Vue | Quand | Contenu |
|---|---|---|
| `config` | `LNP_WEB_CONFIG.url` ou `anonKey` absent | « Pas encore configuré » · « La connexion à la base de données manque. Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le projet Vercel, puis rechargez la page. » |
| `loading` | pendant `enter()` | « Connexion en cours… » |
| `signin` | pas de session | « Connexion » · « LNP est réservé à l’équipe LNP. Utilisez l’adresse e-mail avec laquelle vous avez été invité. » · « E-mail » (`vous@exemple.fr`), « Mot de passe » · « Se connecter » (« Connexion… ») · « Mot de passe oublié ? Demandez un lien de réinitialisation à un administrateur (Accès de l’équipe). » ; l'e-mail saisi reste après une erreur |
| `setpw` | lien d'invitation ou de réinitialisation | « Bienvenue sur LNP » ou « Choisissez un nouveau mot de passe » · « Choisissez le mot de passe qui vous servira à vous connecter avec <e-mail>. 8 caractères au moins. » · « Mot de passe », « Répétez le mot de passe » · « Enregistrer mon mot de passe » |
| `denied` | session sans ligne `members` | « Pas encore d’accès » · « Vous êtes connecté avec <e-mail>, mais ce compte ne fait pas partie de l’équipe LNP. Demandez à un administrateur de vous inviter. » · « Se déconnecter » |
| `noscreens` | rôle, mais aucun écran | « Aucun écran ouvert pour l’instant » · « Vous faites partie de l’équipe LNP, mais aucun écran ne vous est encore ouvert. Demandez à un administrateur d’en ouvrir dans Paramètres › Accès. » · « Se déconnecter » |

### 2.2 Déroulé

1. `boot()` crée le client Supabase (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `flowType: "implicit"`). Un
   `#error_description=` affiche `signin` avec le message traduit. Un `#lnp-link=<token_hash>&type=invite|recovery` est gardé,
   retiré de l'URL, et ouvre `setpw` : **le jeton n'est dépensé qu'à l'enregistrement du mot de passe**.
2. `setpw` : « Utilisez au moins 8 caractères. », « Les deux mots de passe ne sont pas identiques. » ; puis
   `auth.verifyOtp({type, token_hash})` (échec : `signin` avec « Ce lien a déjà servi ou a expiré. Demandez-en un nouveau à un
   administrateur (Accès de l’équipe › Nouveau lien d’invitation). »), `auth.updateUser({password})`, `enter()`.
3. `signin` : `auth.signInWithPassword` ; « invalid » → « E-mail ou mot de passe incorrect. », sinon `authFr`.
4. `enter()` : `GET /api/me` → `{role, access}`. Pas de rôle → `denied` ; liste vide → `noscreens` ; sinon `applyAccess()`
   (§ 15), retrait du voile, résolution de `claude.use`, dessin du Compte.
5. Déconnexion : `auth.signOut()` puis `location.replace(pathname)` ; un `SIGNED_OUT` venu d'un autre onglet fait de même.

`authFr` traduit : mot de passe identique à l'ancien, trop court ou trop simple, trop facile à deviner, adresse non confirmée,
trop de tentatives, lien expiré, réseau ; sinon « La connexion a échoué. Réessayez, ou demandez de l’aide à un administrateur. »

`/api/me` : 401 « Connectez-vous d’abord. » ; `{role:null, access:[]}` hors équipe ; sinon `access = accessOf(user, role)`, plus
`"access"` et `"suivi"` pour un administrateur. Premier administrateur : `web/api/bootstrap.js`, actif tant que `BOOTSTRAP_TOKEN`
existe.

---

## 3. Cockpit commercial

Gabarit `SalesCockpit` ; état `view` = `results` (défaut), `execution`, `quality`, `impact`. En-tête : « Cockpit commercial » et
les onglets **Résultats · Exécution · Qualité · Impact** (collés en haut au défilement). Résultats est le module `LNP_SALES`
(`[data-dash]`, `app/sales_v2.json` en retard sur la page) ; les trois autres sont un seul module `LNP_SALESEXEC`
(`[data-salesexec]`, l'onglet est son `data-view` ; source en retard : `app/sales_exec_module.js`). Aucune écriture sur cet
écran.

### 3.1 Résultats

**En-tête du module** : « Résultats » + « Du prospect à l’encaissement, la rentabilité et l’équipe, face à la période
précédente. » ; à droite, le contrôle de parité et la période « 7 j » · « 30 j » (défaut) · « 8 sem. » (`S.period` = 7, 30, 56).

**Données.** Web : `LNP_CRM.salesCockpit()` = RPC `crm_sales_cockpit()` (dernière version : `060_crm_cockpit_corrections.sql`),
au chargement puis toutes les 5 min ; tant que rien n'est reçu, « Chargement des chiffres en direct… » ; en cas d'échec « Les
chiffres en direct ne se sont pas chargés (<message>). » + « Réessayer ». Démo : constantes de la maquette (`KPI.all`, `SALES`,
`ALERTS`) multipliées par `PF = {7: 0,24 ; 30: 1 ; 56: 1,85}`. Champs lus : `periods.{7,30,56}.now|base` (fenêtre courante et
précédente de même durée), `team`, `weekly` (8 semaines), `pipeline` (pondéré), `alerts`, `has_payments`, `has_deals` ; par
fenêtre `leads`, `booked`, `held`, `no_show`, `no_outcome`, `shown_leads`, `no_show_leads`, `won`, `signed`, `deals`,
`collected`, `received`, `refunded`, `cash`, `follow_total`, `follow_done`, `days_per_stage` (calculs : chapitre 03). Un taux
sans dénominateur est « — » ; montants non mesurés sans paiement (`has_payments`) ou sans vente avec montant (`has_deals`).

**Contrôle de parité** : six critères comparés à leur référence (période précédente) :

| Critère | Valeur | Format |
|---|---|---|
| Ventes gagnées | `won` | entier |
| Montant encaissé | `cash` | k€ |
| Taux de présence | `shown_leads ÷ (shown_leads + no_show_leads)` | % |
| Chiffre d’affaires par appel | `cash ÷ held` | € |
| Panier moyen | `signed ÷ deals` | € |
| Taux de remboursement | `refunded ÷ received` (inversé : plus bas = mieux) | % à 1 décimale |

Rapport = valeur ÷ référence × 100 (inverse pour le remboursement ; 100 si les deux sont nuls) ; non mesuré si l'un n'est pas un
nombre. Teinte (`tone`) : ≥ 95 vert, ≥ 85 neutre, sinon orange. Affichage : « k/6 » + « critère(s) à la référence[ · n non
mesuré(s)] » et dessous « À relever : <critères sous 100> », « En attente des données du CRM » ou « Tout est au niveau de la
référence » ; pastille `pass` (tout à la référence), `fail` (un critère orange), sinon `part`. Infobulle : « Contrôle de parité :
les 6 critères face à leur référence. Sous la référence : … Pas encore mesuré : … ».

**Cartes** (toutes suivent leur contenu depuis le 2026-11-15, plus de mode « tient dans l'écran ») :
- **« Du prospect à l’encaissement »** : sous-titre « <période> · réf. = les <période> d’avant · CRM en direct » (ou « · exemple ») ;
  colonnes reliées par des rubans « Prospects » (« entrés »), « RDV pris » (« à l’agenda »), « Appels honorés » (« réalisés », ou
  « réalisés · n sans issue »), « Ventes gagnées », « Encaissé » ; taux « prise RDV », « présence », « conversion », « comptant » ;
  ligne du bas « Ventes de la période : Signé x · Encaissé y (z %) · Reste à encaisser r ».
- **« Rentabilité unitaire »** (« 8 semaines · pointillés = réf. ») : Chiffre d’affaires par appel, Panier moyen, Taux de
  remboursement ; valeur, écart « ±x % vs réf. », courbe des 8 semaines (`weekly`), « Pas encore mesuré : … ».
- **« Équipe commerciale »** (« par encaissé · un clic ouvre son pipeline ») : colonnes Commercial (« <CA> par appel »),
  « Encaissé · encaissé / signé » (barre, « n gagnée(s) / n appel(s) · encaissé / signé »), Conversion (vert ≥ 32 %, neutre
  ≥ 28 %), Présence (vert ≥ 72 %, neutre ≥ 65 %) ; seules les lignes avec de l'activité ; « Non attribué » ; vide « Aucune
  activité commerciale sur cette période. » Clic : `{lnp:"crm", owner}`.
- **« À venir »** : « Prévision d’encaissement à 30 jours » (pipeline pondéré × part payée à la signature), « Relance sous 24 h »
  (`follow_done ÷ follow_total`, objectif 75 %), « Jours par étape » (`days_per_stage`, alerte au-delà de 8 j).
- **« Encaissements à risque »** : « ~<total> · n alerte(s) », 5 lignes (code de règle, titre traduit « · en retard », impact),
  pied « Voir toutes les alertes → » (Cycle de vente › À traiter) ; vide « Rien à risque pour l’instant : aucune alerte ouverte et
  aucune prochaine étape en retard. »

### 3.2 Exécution, Qualité, Impact (`LNP_SALESEXEC`)

En-tête commun : titre, une phrase (le reste sous « En savoir plus »), pour un administrateur un sélecteur « Tous les
commerciaux » + chaque membre actif, la période « 7 j » · « 30 j » (défaut) · « 90 j », « Actualiser ». Web :
`LNP_CRM.salesExecution(jours, commercial)` = RPC `crm_sales_execution` (`050`, corrigée par `060`), appelée deux fois (la période
et le double, pour la tendance). Démo : un exemple mis à l'échelle de la période, avec « Chiffres d’exemple : les vrais chiffres
s’affichent une fois connecté au CRM. » Sur 7 jours : « Sur 7 jours, aucun R1 n’a encore 14 jours : les taux de vente restent
vides… ». Règles affichées : la cohorte est le **premier appel tenu du cycle** ; gagné = premier paiement dans les 14 jours après
cet appel ; qualifié = la qualification de LNP la plus récente (un prospect non lu compte comme qualifié, sauf disqualifié) ; un
taux sur moins de 20 prospects porte « échantillon faible ». Objectif 80 % dans les temps : vert au-dessus, neutre au-dessus de
50 %, orange en dessous, jamais rouge.

**Exécution** : « Vos progrès » (étapes en hausse face aux N jours d'avant) ; « Les étapes à travailler cette semaine » (les trois
qui coûtent le plus : (80 − %) × cas), les autres sous « Les n autres étapes » ; tableau Étape · Cible · barre · Dans les temps
(+ écart à l'objectif et tendance) · Médiane · Cas. Les 11 étapes (`delays`) :

| id | Libellé | Règle | Cible |
|---|---|---|---|
| `speed_to_lead` | Premier contact du commercial après la prise de RDV | SH-2 | 5 min |
| `r1_within_48h` | R1 tenu dans les 48 h après sa réservation | SH-3 | 48 h |
| `noshow_contact` | Absence : message et appel | SH-8 | 15 min |
| `noshow_rebook` | Absence : nouveau créneau réservé | SH-9 | 24 h |
| `outcome_declared` | Issue déclarée après l’appel | SH-11 | 15 min |
| `recap_60` | Récap écrit après le R1 | DE-1 | 60 min |
| `call_after_r1` | Appel téléphonique après un R1 sans décision | Bonne pratique (fenêtre DE-9) | 72 h |
| `decision_72` | Décision après l’offre | DE-9 | 72 h |
| `yes_to_payment` | Premier paiement après un oui | CA-2 | 24 h |
| `handover_2h` | Message de bienvenue après le premier paiement | CA-6 | 2 h |
| `reply_15` | Réponse à un message du prospect (8 h – 22 h) | CO-1 | 15 min |

Sans messages WhatsApp branchés (`sources.messages === false`), les six étapes qui lisent les messages (`speed_to_lead`,
`noshow_contact`, `recap_60`, `call_after_r1`, `handover_2h`, `reply_15`) affichent « non mesuré · messages WhatsApp non
branchés ». Un clic (ou Entrée) sur une étape ouvre une fenêtre « Étape du cycle de vente · <règle> » : « Comment ça marche »,
« Pourquoi c’est important », « Vos chiffres », « Bonne pratique et ce que la recherche a mesuré » (études citées avec leur source),
« Pourquoi c’est considéré comme la meilleure », « Comment l’atteindre » (textes `STEPS` du module). Puis quatre cartes :
« Relance après une absence » (contactés dans les 15 min, replanifiés, délai médian, gagnés ensuite), « Relance après une vente
manquée » (contactés après le 14e jour, réactivés, délai médian, gagnés ensuite), « Interactions commerciales et vente » (avec ou
sans appel après le R1, réponse du prospect, groupes de contacts 0 / 1 à 3 / 4 à 8 / 9 et plus), « Délai de réponse et vente ».

**Qualité** : tuiles « Appels tenus avec une issue » (cible 100 %), « Appels tenus enregistrés (Fathom) », « Découverte (SPIN), sur
100 », « Traitement des objections, sur 100 » ; si `references_missing`, l'avertissement « L’écart et la présentation de l’offre
ne sont pas encore fiables… » ; « Qualification du prospect » (tableau Porte · Ouverte · Fermée · Non vérifiée sur **trois** portes :
Métier, Financement, Décision et timing ; verdicts traduits : SQL OUVERT « qualifiés (SQL) », NON SQL « non qualifiés »…) ;
« Pourquoi les prospects sont perdus » (motif, statut, nombre).

**Impact** : tableau Étape · Vente si dans les temps · Si manquée · Effet (×) · Lecture : « Fait vendre » (≥ ×1,5), « Un certain
effet » (≥ ×1,1), « Effet inverse : à vérifier » (< ×0,9), « Pas d’effet visible » ; « Pas assez de données » sous 5 prospects
d'un côté ; « À confirmer » sous 20 ; « Ce qu’il faut pousser maintenant ». « C’est une corrélation, pas une preuve. »

### 3.3 Mode d'emploi (résumé)

La vue commerciale sur un seul écran ; les appels honorés ne comptent que les R1 (un R1 sans issue reste en attente 48 h puis
compte comme absence), les fiches de test ne comptent pas ; Rentabilité unitaire, Équipe commerciale, À venir, Encaissements à
risque, contrôle de parité « 4/6 critères à la référence » ; Exécution, Qualité (portes Métier, Financement, Décision et timing),
Impact ; choisir la période, survoler ou tabuler un chiffre pour son calcul, cliquer un commercial.

---

## 4. Cycle de vente (le bureau)

**Ma journée est fusionnée ici** (2026-11-10) : plus d'entrée dans la barre latérale ; `#salesday`, un ancien lien et un accès
`salesday` ouvrent Cycle de vente (§ 4.9).

### 4.1 Où il vit

Gabarit `SalesCycle` : `<h1 class="sr-only">Cycle de vente</h1>` et l'emplacement `[data-crm][data-crmview="cycle"]` ; pas
d'en-tête de page, le bouton « i » reste. Le cadre du CRM bascule (`lnpCrmView("cycle")` → `S.cx.tab = "cycle"` → `lnpCycle(true)`)
et pose par-dessus son contenu une seconde `iframe` plein cadre (`title="Cycle de vente"`, `z-index: 40`) dont le `srcdoc` est
`LNP_SB_DOC` ; la barre du CRM dessous devient `inert`. Le bureau reçoit les données par `scLive(window.lnpScData)`
(`lnpCyclePush`) à chaque chargement du CRM. Hors édition web, il tourne sur ses prospects d'exemple (heure de Paris, « maintenant »
= 25 oct. 08:51) et passe les mêmes prospects au CRM (`lnpDemoLeads`).

### 4.2 Données

`window.lnpScData = { leads, reps, now, role, reasons, sla }` est construit par le CRM (§ 5.2) : `leads =
LNP_CRM.salesCycleView(cycles, membres, maintenant)` (un prospect par cycle : `p` nom, `o` clé du commercial, `a` montant signé, `ph`,
`em`, `opened`, `age` en heures, `ev` événements `{t, w: s|p|a, k, r, txt, dur, cid…}`, `nx` prochaine étape) ; `reasons` = motifs
actifs non automatiques (`lost` → Non, `disqualified` → Disqualifié) ; `sla` = `crm_settings.sla_rules` (appliqué par
`LNP_SLA.configure`). Le document embarque sa propre copie de `LNP_SLA` (§ 10.5) et de `LNP_ETAPES` (§ 6).

### 4.3 L'état d'un prospect (`stateOf`)

- Étapes de durée (`STAGES`) : Présence (objectif 96 h, critique 168 h), Décision (72 / 144 h), Encaissement (24 / 48 h) ; clos =
  `won` si payé, `lost` sur une décision non.
- **Qui doit agir** (`b`), dans l'ordre : un appel passé sans issue (`meetdue`) → commercial « Déclarer l’issue du R<n> » ; un
  appel à venir → `call` ; une prochaine étape datée (`l.nx`) → commercial ; dernier événement = RDV pris → « Prendre le premier
  contact » (dû 15 min après) ; dernier échange du prospect → « Répondre au prospect » (dû en 2 h) ; dernier échange du commercial :
  au-delà de 48 h « Relancer le prospect », sinon prospect « En attente du prospect ». Une prochaine étape convenue remplace le
  texte du commercial. Le type d'action (`k`) : `outcome`, `call`, `step`, `first`, `reply`, `follow`, `wait`, et par mots clés
  `noshow`, `resched`, `pay`.
- **Niveau** : le pire SLA ouvert de `LNP_SLA.evaluate(l, {t0, surface:"screen"})` ; `warn` reste « ok » mais compte « Bientôt
  dû ». **Critique = seulement le niveau critique d'un SLA** (un long retard seul est « En retard », orange).
- **Groupe** (`bucket`) : `closed` ; `calls` (appel prévu) ; `wait` (au prospect) ; `now` (à nous, en retard ou SLA dépassé) ;
  sinon `todo`. Étiquette : « Gagné », « Perdu », « Critique », « En retard », « Bientôt dû » ou « À faire », « Appel prévu »,
  « En attente ». Score d'urgence = poids du SLA (crit 3, late 2, warn 1) × 1000 + retard.
- Texte d'action (`action`) : gagné « Gagné · passer le relais à l’accompagnement » ; perdu en « Relance après refus » « Relance
  après refus · <étape> » ; perdu « Perdu » / « Disqualifié » / « Injoignable » « à l’étape <étape> · <motif> » ; commercial « en
  retard de x » ou « à faire dans x » + source ; appel « Appel R<n> · <quand> » ; attente « relancer dans x ».

### 4.4 Disposition et file

- **En-tête** : « Cycle de vente » (+ « Démo · prospects d’exemple · rien n’est enregistré » en démo) ; dessous « **N à traiter** ·
  n en retard · k appels aujourd’hui » (+ « · M sur T affichés » si une recherche ou un filtre réduit la liste) ; « Aujourd’hui ·
  **n prospect(s) traité(s)** · k à demain » (dépliable, § 4.6). À droite : sélecteur « Commercial » (« Tous les commerciaux » +
  équipe ; caché pour le rôle `sales`) et deux onglets « À traiter · **N** » (agir maintenant, à faire, appels prévus ; défaut) et
  « Tous · **N** » (tous les prospects en cours). Les nombres sont ceux de la personne, filtres de recherche exclus.
- **File** (colonne de 248 px, `role="listbox"` « Prospects, du plus urgent au moins urgent ») : sections
  - « Agir maintenant » découpée en « En premier · n » (les trois premiers critiques), « Aussi critique · n », « En retard · n »,
    dans l'ordre `NOWRANK` (critique d'abord, puis le plus gros montant, puis le plus urgent) — le même ordre que le compteur ;
  - « À faire · n », « Appels prévus · n » ; dans « Tous » aussi « En attente · n » et « Clos · n » (« Afficher » / « Masquer ») ;
  - « Demain · n » : les prospects mis de côté, chacun avec « Remettre aujourd’hui ».
  Une ligne (`rowHTML`) : point de couleur (critique rouge, en retard orange, appel bleu, sinon gris), nom, action, échéance
  courte (heure, « demain », « attente », retard, « à faire », « Gagné », « Clos »). Les prospects « Passer » vont en fin de leur
  groupe (`SKIPRANK`). Vide : « Aucun prospect dans « À traiter » pour l’instant. », « Aucun cycle de vente pour l’instant. »…
- La recherche, les filtres (Action, Étape — la liste de `LNP_ETAPES.STAGE` —, Dernière activité, Tri) et l'aide clavier existent
  dans le code mais sont cachés (`.rh` et `.kbd` `hidden`).

### 4.5 Le prospect à droite

- **Édition web** (`LIVE` et `parent.lnpCycleDock` existe) : le panneau garde seulement une place (`#dock`) ; `dockTo(id)` envoie
  au CRM le rectangle de cette place, et le CRM y pose **la fiche du lead de Leads, à l'identique** (`renderLead2`, classe
  `lr-dock`, sans voile ; § 7), redimensionnée par un `ResizeObserver`. Les touches du bureau (↑ ↓ J K, D, P, U, Ctrl/⌘ + Z,
  Échap) cliquées dans la fiche sont renvoyées au bureau. Une fiche ouverte en grand, un encaissement ou un motif en cours ne sont
  pas remplacés. « Fait » et « Déclarer l’issue » de la fiche appellent `lnpDockDone(id, how)` → `scDone` : la journée compte le
  prospect et le suivant s'ouvre.
- **Démo, ou pas de fiche web pour ce lead** : panneau en bulles : en-tête « ← Tous les prospects » (écran étroit), nom, étape
  (`LNP_ETAPES`), montant, commercial ; « ← Le lead » / « L’équipe de vente → » ; la conversation (`chatHTML` : un séparateur par
  jour « Aujourd’hui / Hier / <date> », les bulles du lead à gauche et de l'équipe à droite, l'automatique au centre, la dernière
  action réelle encadrée « Dernière action », « À venir · R<n> · <quand> » en bas ; un appel honoré porte un lien « analyse ») ;
  puis **« À faire »** : étiquette, action, raison, et le formulaire :
  - issue à déclarer : « L’appel a-t-il eu lieu ? » [Honoré | Absent] ; « Décision » [Oui | Relance | Non | Disqualifié] ; Oui :
    « Montant signé » et « Paiement » [En une fois | 2 échéances | 3 | 4 | 6] ; Relance : « Prochaine étape convenue avec le
    prospect (elle devient la prochaine action) » ; Non / Disqualifié : « Motif » (puces) ; Non : « Suivi long terme » [Mettre en
    suivi long terme | Pas de suivi] ; « Enregistrer · prospect suivant » (+ « Analyse de l’appel ») ;
  - sinon : champ « Ce que vous avez fait… » (ou « Une note (facultatif) ») et « Fait · prospect suivant » (ou « Enregistrer la
    note ») ; « Ouvrir les paiements » pour une action de paiement, « Lire l’analyse du R<n> » avant un appel ; aide « Envoyez depuis
    WhatsApp Business ou votre boîte mail ; Fait l’enregistre et passe le prospect en attente. » ;
  - toujours (sauf lecteur) « Demain D » et « Passer P ».
- **Écritures du bureau** : l'issue → `parent.lnpCrmDeclare(callId, {attendance, decision, amount_sold, payment_plan, next_step,
  reason_code, nurture})` = `crm_declare_outcome` ; « Choisissez un motif. » ; toast « Issue enregistrée · la prochaine action et
  les alertes sont recalculées » ; erreur « Non enregistré : … ». La note → `crm_add_note(cycle, "<action> : <texte>")`, **différée
  5 s** : bandeau « Fait pour <nom> · prospect suivant » + « Annuler · U » (U ou Ctrl/⌘ + Z) ; envoyée à la fin du délai, en
  quittant la page ou en la cachant ; « Annulé : rien n’a été enregistré ». En démo, l'issue et la note modifient le prospect
  d'exemple (« Démo · … rien n’est enregistré »).

### 4.6 La journée

- « Aujourd’hui » ouvre « Fait aujourd’hui » : chaque prospect traité, du plus récent, avec son issue (« fait », « absent »,
  « vente signée », « relance », « non », « disqualifié ») et l'heure ; vide « Rien pour l’instant. »
- **Demain** (D) retire le prospect de la file jusqu'au lendemain ; **Passer** (P) le met en fin de son groupe sans rien
  enregistrer. Après une action, le prospect suivant dans l'ordre d'avant s'ouvre (`advance`).
- La journée `{done, snoozed}` est gardée dans les préférences de la personne, clé `salesday.<AAAA-M-J>` (`crm_set_pref`,
  `crm_get_pref`, `031_crm_member_prefs.sql`) ; « Passer » reste en mémoire. Changement de jour : la journée repart à zéro.

### 4.7 Clavier

↑ ↓ (ou J K) changent de prospect ; Entrée sur une ligne l'ouvre ; Entrée dans le champ de note = Fait ; D et P (sauf lecteur et
clos) ; U ou Ctrl/⌘ + Z annule le dernier « Fait » ; Échap ferme les filtres, la journée, puis le panneau sur écran étroit.

### 4.8 Le compteur « Agir maintenant »

À chaque rendu, le bureau envoie `{lnp:"now", n, crit, list}` à la page : pastille de la barre latérale (§ 1.2) et
`window.LNP_NOWLIST`. `openNow()` (Cycle de vente sur l'onglet « À traiter », `lnpCrmBucket("now")` → `lnpDeskBucket`) est appelé
par « Voir » du bandeau d'alerte, « Voir toutes les alertes → » du Cockpit et tout ancien lien vers Alertes ou Ma journée.

### 4.9 Ce qui reste de Ma journée

`app/salesday_module.js` (`LNP_SALESDAY`) et le gabarit `SalesDay` sont encore dans la page mais jamais affichés (`MOVED`). Le
bandeau « N prospects à traiter maintenant en tête de votre file » de `decorate()` ne se pose que dans l'emplacement
`[data-salesday]` : il n'apparaît plus.

### 4.10 Mode d'emploi (résumé)

Traiter ses prospects un par un : la file à gauche, la fiche du lead à droite (la même que dans Leads) ; le cycle de vente en
conversation ; « À traiter » (en retard, à faire, appels prévus) et « Tous » ; rouge critique, orange en retard ; Enregistrer ou
Fait ouvre le suivant ; « Aujourd’hui » compte les prospects traités ; « Cette page remplace Ma journée » ; Demain (D), Passer (P),
« Remettre aujourd’hui », ↑ ↓ ; Lexique.

---

## 5. Leads (le CRM)

### 5.1 Le cadre

Le document `window.LNP_CRM_DOC` (source en retard : `uploads/crm_source.html` + `app/gen_crm.py` → `app/crm_doc.html`) vit dans
le cadre `[data-crm]`. Sa barre latérale d'origine est cachée ; la feuille `#hz` cache aussi son en-tête (`.cx-head`). Restent
dans `#v-crm` : les onglets **« Pipeline » | « Prospects <n> »** (n = nombre de leads chargés) et, sur Prospects, « Rattacher les
commerciaux » (toast « Commerciaux rattachés par e-mail · aucun prospect orphelin », sans effet) et « + Nouveau prospect » (§ 9.4).
Les vues `#v-dash`, `#v-alerts`, `#v-settings` du document d'origine ne sont plus atteintes.

### 5.2 Chargement en direct (`lnpCrmLive`)

Démarré quand `parent.LNP_CRM.mode() === "live"` :
1. Bulle d'état : « Chargement des prospects… », puis « Chargement des appels et des messages… » (les cycles sont dessinés avant
   leurs appels et événements, `listBoard(onCycles)`), puis retirée ; échec « Impossible de charger les prospects : <message> » +
   « Réessayer ».
2. Lectures : `listMembers()`, `listNoBooking()` (vue `crm_people_without_cycle`), `me()`, `listReasons()`, `slaRules()`, puis
   `listBoard()` (`crm_cycles` + `crm_calls`, `crm_events`, `crm_deals`, `crm_payments`, par pages).
3. Chaque cycle devient un lead (`toLead`, ci-dessous), chaque personne sans cycle une ligne « Sans rendez-vous » (id `p-<personne>`).
4. `window.lnpScData` (§ 4.2) est construit et poussé au bureau ; `window.LNP_SETCTX = {me, members}` sert au suivi du setter.
5. Abonnement Realtime (`crm_cycles`, `crm_events`, `crm_alerts`) : rechargement 800 ms après un changement (en production, seules
   `crm_sla_alerts` et `docs` sont publiées : chapitre 08).
6. Le tableau des analyses (`LNP_CA_ROWS` = `crm_ca_board()`) est relu au chargement puis toutes les 5 min (onglet visible).
7. Fonctions posées : `lnpCrmReload`, `lnpCrmDeclare` (`crm_declare_outcome`), `lnpCrmClose` (`crm_close_cycle`), `lnpCrmReopen`
   (`crm_reopen_cycle`), `lnpCrmNote` (`crm_add_note`), `lnpCrmMove` (`crm_move_cycle`), toutes suivies d'un rechargement ;
   `lnpCanAssign` = rôle CRM `admin`.

`toLead` : statut `st` = `won`→`close`, `lost`→`perdu`, `disqualified`→`disq` ; sinon d'après l'appel de référence (prochain
`scheduled`, sinon le dernier non annulé) : aucun → `nouveau`, `no_show` → `noshow`, `held` → `realise`, autre → `planifie` ;
**Relance longue** `longfu` si aucune activité depuis plus de 14 jours, aucun appel à venir et statut `noshow`, `nouveau`,
`planifie`, `realise` ou `perdu` (sauf remboursé) ; un déplacement manuel (`stage_moved` postérieur au dernier événement d'étape)
vers `longfu` ou `r1`–`r3` est respecté (migration 047). Autres champs : `tour`, `age`, `born`, `last`, `rdv`, `nx`
(`rebook` → replanifier, `follow_up` → relancer), `a` (montant signé), `col` (encaissé net), `loss` (motif), `set` (statut setter,
§ 9).

### 5.3 Onglet « Pipeline » : un lead par ligne

Depuis que `window.LNP_LP` existe (`LNP_ETAPES`, 2026-11-11), l'onglet Pipeline n'est **plus un tableau en colonnes à glisser** :
c'est le tableau des leads (`cxLeads(true)`), sous-titre « Chaque lead sur une ligne : son état, son progrès, sa prochaine action et
l’heure prévue, ses alertes et le temps depuis son dernier message ».

- **Barre de filtres sur une ligne** (`cxBar`, décision du 2026-11-14) : « Rechercher » (nom, e-mail, commercial, produit),
  « Commercial » (+ « Non attribué »), « Prise de RDV » (statut setter, § 9), « Création » (« Créés depuis 1 semaine », « Créés
  depuis 1 mois »), « Statut » (Nouveau, RDV planifié, Absent, RDV honoré, Relance longue, Gagné, Perdu, Disqualifié, Sans
  rendez-vous), « Transcription » (« disponible », « absente »), le compteur « n / N », puis trois icônes : « Vues » et « Exporter
  en CSV » (bloqués en direct, § 5.5), « Colonnes ».
- **« Répartition par étape »** (`LNP_LP.bar`) : une barre segmentée et une légende, une part par étape de `LNP_ETAPES.STAGE` (§ 6)
  avec son pourcentage (plus fort reste, « <1 % ») et son nombre ; « N leads · cliquez sur une étape pour filtrer » ; un clic filtre
  le tableau (`S.cx.lpst`) : « filtré sur <étape> » + « Tout afficher ».
- **Colonnes par défaut** (`S.cx.colsP`) : case à cocher ; **Prospect** (nom cliquable → fiche, et à côté le **nombre d'alertes**
  `LNP_LP.al` : SLA ouverts en retard ou critiques, rouge si un critique, infobulle « <ID> · <nom> ») ; **État** (dernière action :
  « RDV pris », « Message reçu · WhatsApp », « Issue : … », « Paiement reçu »…, et « il y a x ») ; **Progrès** (points de la ligne
  principale ou de la branche en cours, « n/total », « payé », « perdu », « disqualifié » ; infobulle de toutes les étapes) ;
  **Prochaine action · heure** (« Déclarer l’issue du R<n> », « Appel R<n> » ou la prochaine étape, avec « aujourd’hui 10:00 »,
  « demain … », en rouge « · en retard ») ; **Commercial** (bouton « <nom> ▾ » pour un administrateur) ; **Analyse** (pastille, § 11.2).
  Pas de colonnes Alertes ni Statut.
- **« Colonnes »** ajoute ou retire : État, Progrès, Prochaine action · heure, Dernier message (temps depuis le dernier message du
  lead), Prise de RDV, Dernière action, Action actuelle, Commercial, Transcription, Prochain RDV, Prix proposé, Facturé, Encaissé,
  Tour, Prochaine action.
- **Tri** : clic sur un en-tête, croissant puis décroissant (▲ ▼ ↕) ; Progrès trie gagné d'abord, puis branches, puis l'avancement.
- Vide : « Aucun prospect pour l’instant : les nouveaux prospects arrivent ici dès qu’un RDV est pris dans iClosed. » +
  « Réessayer », ou « Aucun prospect ne correspond à la recherche ou aux filtres ci-dessus : élargissez-les… ».

### 5.4 Onglet « Prospects »

Même barre et même tableau sans la répartition (`cxLeads()`), colonnes par défaut (`S.cx.cols`) : Prospect (+ alertes), **Prise de
RDV**, **Action actuelle** (setter), Commercial, Prochain RDV, Prochaine action (bouton « + Planifier… » ou action + date + ✓),
Analyse. Les cases à cocher n'ont aucune action groupée.

### 5.5 Ce qui est bloqué ou transformé en direct

- Bloqué (`WRITES` : `nxpick`, `nxclear`, `nxdone`, `warm`, `stnew`, `stedit`, `stdel`, `rdvheld`, `rdvnoshow`, `cxmock`) : toast
  « Déclarez l’issue d’un appel dans CRM › Cycle de vente ; les autres modifications ici arriveront plus tard. » (planifier ou
  cocher une prochaine action, mise en condition J-3 / J-1 / Jour J, étapes manuelles, Vues, Export CSV).
- **Déplacer un lead** (menu « Statut ▾ » de la fiche, `lstpick`, et les anciens boutons « Contact repris sans RDV » / « Déclarer
  perdu ») passe par `window.lnpMove(lead, vers)` (`app/crm/outcome_ui.js`, version embarquée) : une issue à déclarer ou à corriger →
  le formulaire d'issue prérempli (« Formulaire d’issue », « Enregistrer l’issue » / « Corriger l’issue ») ; perdu ou disqualifié
  sans appel à déclarer → formulaire de clôture (`crm_close_cycle`) ; un lead clos remis dans le pipeline → confirmation puis
  `crm_reopen_cycle` ; une colonne calculée → un message qui dit pourquoi (« Ce prospect a payé : une vente ne se déplace pas. Un
  remboursement se saisit dans sa fenêtre d’encaissement. », « « Sans rendez-vous » regroupe les contacts qui n’ont jamais réservé
  d’appel : un prospect n’y retourne pas. »…). Lecteur : « Lecture seule : votre rôle ne permet pas de déplacer un prospect. »
- Restent actifs : filtres, tris, colonnes, changement de commercial, encaissement, analyse d'appel, issue, note, setter.

### 5.6 Code encore présent mais non affiché

Le tableau en colonnes (`cxPipeline` : Nouveau, R1, Absent, R2, R3+, Relance longue, Gagné, Perdu, Disqualifié, Sans rendez-vous ;
ordre des colonnes par personne `crm.pipeline.cols`), ses cinq cartes KPI (`cxKpis`), la période 7 / 30 jours / Tout et
« Réinitialiser les colonnes » ne s'affichent que si `LNP_LP` manque : jamais dans la page actuelle.

### 5.7 Mode d'emploi (résumé)

Le CRM des ventes ; Pipeline : un lead par ligne, État, Progrès (les étapes de § 6 et leurs deux branches), la répartition par étape
qui filtre, la prochaine action en rouge si en retard, les alertes, le temps depuis le dernier message ; tri par en-tête et
Colonnes ; Prospects ; Cycle de vente a son propre onglet dans la barre de gauche ; la fiche ; « Notez la prochaine action avant de
fermer la fiche d’un prospect. »

---

## 6. Les étapes du lead (`LNP_ETAPES`)

Une seule liste pour Leads (Progrès, Répartition par étape, son filtre), la fiche du lead et Cycle de vente (fiche, filtre Étape,
en-tête, À faire), décision du 2026-11-11. Écrite une fois et injectée dans le document du CRM (premier script) et dans
`LNP_SB_DOC`. Calculée à partir des événements du lead (`ev`).

**Ligne principale** (`MAIN`) : `book` « RDV pris » → `first` « 1er contact » (un message ou appel du commercial) → `elig` « Appel
d’éligibilité (R1) » (**facultatif** : un appel téléphonique avant le premier appel) → `conf` « Confirmation de présence » (un
message du commercial ou automatique dans les 48 h avant le premier appel, ou une mise en condition cochée) → `held` « Appel honoré
(R2) » → `dec` « Décision » → `paid` « Payé ». Chaque étape est `done`, `skip` (facultative non faite), `cur`, `todo`, `wait` (en
pause pendant une branche) ou `stop` (lead clos).

**Branches** (`BRANCHES`) :

| Branche | Couleur | Déclencheur | Étapes | Sortie | Retour |
|---|---|---|---|---|---|
| « Rattrapage » (`ratt`) | `#D97706` | une absence sans appel tenu depuis, ou, sans appel tenu ni décision, au moins deux contacts du commercial sans réponse 24 h après le premier | Absence ou silence → Relance → Nouveau RDV | « Injoignable » après 6 relances sans réponse ni RDV | à « Confirmation de présence » |
| « Relance après refus » (`refus`) | `#7C5CC4` | la dernière décision est un non (pas une disqualification) **après un appel tenu**, sans paiement | Refus · <motif> → Objection notée → Relance → Réponse → Nouvel appel | « Disqualifié après 6 mois » (182 jours sans réponse ni nouvel appel) | à « Appel honoré » |

Un non sans appel tenu est « Perdu sans appel tenu », sans branche ; une disqualification arrête la ligne principale. Pendant la
Relance après refus, le lead reste « Clos » dans Cycle de vente ; en base, `crm_refusal_tick` (migration 055, chaque jour) le
disqualifie 6 mois après le refus sans nouveau RDV.

**Étapes de la répartition et des filtres** (`STAGE`, dans cet ordre, clé · libellé · couleur) : `m:first` 1er contact `#9AA3BF` ;
`m:elig` Appel d’éligibilité `#6B8DE3` ; `m:conf` Confirmation de présence `#2B6CF5` ; `m:held` Appel honoré `#1E2A5E` ; `m:dec`
Décision `#8B67C9` ; `m:paid` Paiement attendu `#4F9A5B` ; `ratt` Rattrapage ; `refus` Relance après refus ; `won` Payé `#2E7D4F` ;
`injoignable` Injoignable `#B45309` ; `perdu` Perdu sans appel tenu `#B42318` ; `dq` Disqualifié `#5A6478` ; `nobook` Sans RDV
`#CDD5F0`. La clé d'un lead (`key`) est l'étape courante de la ligne principale (`m:book` compte comme `m:first`), sa branche, ou
son état final.

**Formes** : `dots(z)` (colonne Progrès : points, puce de branche, « n/total ») et `path(z)` (« Étapes » : la ligne principale
« · en pause pendant « <branche> » », « · vente conclue »…, puis chaque branche entrée, « puis retour à « <étape> » » ou sa sortie).

---

## 7. La fiche d'un lead

Ouverte par le nom dans Leads, une pastille d'analyse, un prospect d'alerte (`{lnp:"crm", lead}`) ou, posée, par Cycle de vente.

### 7.1 La fiche web (`renderLead2`)

Utilisée pour un lead réel présent dans `lnpScData` (édition web). Plein cadre (`cx-full lr2`, `role="dialog"`), ou posée dans le
bureau (`lr-dock`, `role="region"`).

- **En-tête** (`lr-top`) : nom (`h2`), e-mail (lien `mailto:`), puce de l'étape (`LNP_LP.stageName`), puce du montant, puce du
  commercial (bouton « <nom> ▾ » pour un administrateur), « Statut ▾ » (§ 5.5), « × ».
- **À gauche** (`aside.lr-l`, « Pour décider de la prochaine action ») :
  1. **« À faire »** (`LNP_LEADFEED.todo`) : une carte selon le lead — gagné « Vente encaissée » ; clos « Prospect clos » (+ motif) ;
     un appel passé sans issue « Issue à déclarer · Déclarer l’issue du R<n> · appel du <date> à <heure>, rien n’est déclaré » +
     bouton « Déclarer l’issue » (formulaire `lnpOutcome`) ; un appel à venir « Appel aujourd’hui » / « Appel à venir · Préparer le
     R<n> » ; une prochaine étape « À replanifier » / « Relance » ; une absence « Absent · Reprendre contact après l’absence au R<n> » ;
     sans RDV « Nouveau · Obtenir un premier rendez-vous » ; sinon « Relance · Relancer le prospect ». Les cartes sans issue ont le
     champ « Qu’avez-vous fait ? (enregistré en note sur le prospect) » et « Fait » (`lnpCrmNote` → `crm_add_note`, « Note
     enregistrée sur le prospect », puis `lnpDockDone`) ; vide : « Écrivez en une ligne ce que vous avez fait. » Lecteur : « Lecture
     seule. »
  2. **La fiche en lignes** (`.lr-sheet`, `.ls-row`, décision du 2026-11-14 « le plus lisible possible ») :
     - **Étape** (`lrWhere`) : point de couleur, l'étape courante (ou « Payé », ou l'état final), « Rattrapage · n sur N » / « vente
       conclue » / « lead clos », une barre de cases, et « Toutes les étapes » (dépliable : `LNP_LP.path`) ;
     - **Dernière action** (`LNP_LP.cur`) ; **Prochaine action** (`LNP_LP.nxt`, sinon le prochain RDV, sinon « À planifier » /
       « Aucune ») ;
     - **Setter** (le panneau du setter, § 9.3, sauf statut « transmis ») ;
     - **Paiement** (si montant, encaissé ou étape Décision / Encaissement) : « x encaissés sur y signés », « Modifier » (§ 8), barre ;
     - **Appels** : une ligne par appel de `crm_ca_board` du cycle : « R<n> », date, état (« Analysé », « Analyse en cours »,
       « Échec de l’analyse », « Sans transcription »), « Lire la transcription » (si une analyse existe : fenêtre « Transcription ·
       R<n> · <date> » lue dans `crm_ca_record`, le prospect à gauche et le commercial à droite, « Pas de transcription pour cet
       appel. », Échap ou × ferment), « Analyse » / « Voir » / « Ajouter la transcription » (`LNP_CA.open`) ; « Chargement… » ou
       « Aucun appel de vente pour l’instant » ;
     - **Profil** : Téléphone, Source (Quiz, VSL, Quiz abandonné, Webinaire, Saisi à la main, iClosed), « Réponses du quiz (n) »
       (repliées).
- **À droite** (`LNP_CHAT`, `app/crm` n'a pas de fichier source pour lui) : « ← Le lead » / « L’équipe de vente → » et la
  conversation : le lead à gauche, l'équipe à droite, l'automatique au centre, un séparateur par jour, la dernière action encadrée en
  bas (« Dernière action »), les appels à venir dessous ; un appel tenu porte « analyse et transcription » ; « Aucun échange pour
  l’instant. » La conversation défile en bas à l'ouverture.

### 7.2 L'ancienne fiche (`renderLead1`)

Pour un « Sans rendez-vous » ou hors édition web : en-tête (initiale, nom, statut, produit, commercial, « ↻ R<tour> », « Statut ▾ »),
« Étapes », panneau du setter, fil vertical (`LNP_LEADFEED.feed` : « Cycle de vente · N événements · depuis le … », filtres Tous ·
Appels · Messages · Paiements) et « À faire », ou à défaut la chronologie (`lnpTimeline` : « Pas encore de chronologie : ce prospect
n’a jamais pris de rendez-vous. », hors web « La chronologie … s’affiche dans l’édition web… ») ; « Facturation et encaissement »
pour un gagné ; hors web, onglets d'exemple « Analyse du prospect » / « Prochain appel ». L'iframe `LNP_SC_DOC` (vue v6 de Cycle de
vente) qu'ouvre `lnpTimeline` n'est atteinte que pour un lead réel sans `LNP_CHAT` : jamais dans la page actuelle.

### 7.3 Changer de commercial

Bouton « <nom> ▾ » (« Changer le commercial ») dans la fiche et la colonne Commercial, montré si `lnpCanAssign` (administrateur) et
pas pour un « Sans rendez-vous ». Menu « Attribuer à » : membres actifs dont le rôle n'est pas `viewer`, l'actuel désactivé →
`crm_reassign_cycle(p_cycle, p_member)`, toast « Attribué à <nom> », rechargement.

### 7.4 Formulaire d'issue (`lnpOutcome`, Leads)

Fenêtre 620 px « Formulaire d’issue » : « L’appel a-t-il eu lieu ? » (Honoré · Absent), « Décision » (Oui · Relance · Non ·
Disqualifié), « Modalités de paiement » (Payé en une fois, 2 échéances…), « Prochaine étape » (« ex. Envoyer l’étude de cas, puis
appeler jeudi »), motif, suivi long terme ; « Enregistrer l’issue » → `crm_declare_outcome` sur l'appel passé le plus ancien sans
issue (ou le dernier, pour une correction : « L’issue déjà déclarée pour le R<n> sera remplacée. ») ; « Issue enregistrée · l’étape,
la prochaine étape et les alertes sont recalculées ». Le serveur exige la présence, une décision pour un appel honoré, un motif du
bon type, remplace l'issue courante (correction auditée) et recalcule le cycle (chapitre 03).

---

## 8. Fenêtre d'encaissement

Source embarquée de `app/crm/cash_ui.js` (`window.lnpCash.open(lead, C, reload, canWrite, find)`), RPC `022`, `024`, `026`. Ouverte
par « Modifier » (ligne Paiement de la fiche), « Ouvrir les paiements » du bureau (`lnpCyclePay`) ou la colonne Encaissé ; pas pour
un « Sans rendez-vous ». 760 px ; Échap, × ou clic dehors ferment.

- En-tête « Encaissement · client signé », nom ; « Saisi à la main pour l’instant. Quand Whop sera relié, ses paiements
  apparaîtront ici d’eux-mêmes, marqués Whop. »
- Totaux « Signé » (montant du `crm_deals`), « Encaissé » (net des remboursements), « Reste à encaisser » (+ « Prochaine : … »).
- **« Échéancier · <modalités> »** : # / Échéance / Montant / Statut (« Payée », « Payée en partie · x », « En retard », « À
  venir », les paiements soldant les échéances dans l'ordre) ; sans échéancier, une phrase d'invitation.
- **« Fixer / Modifier l’échéancier »** : « Montant signé (EUR) », « Modalités » (Payé en une fois, 2, 3, 4, 6, 12 échéances),
  « Première échéance » ; une échéance par mois (fin de mois ramenée au dernier jour), montant ÷ n arrondi au centime inférieur, le
  reste sur la dernière ; chaque ligne modifiable, écart signalé ; « Enregistrer l’échéancier » → `crm_set_payment_plan` (1 à 12
  échéances, somme = montant à 0,01 près) ; « Échéancier enregistré. »
- **« Paiements reçus »** : Date / Montant (net, « (x remboursé) ») / Source (« À la main », « Whop ») / Note / « Remboursé » et
  « Retirer » (à la main seulement) ; vide « Aucun paiement enregistré pour l’instant. »
- **« Ajouter un paiement reçu »** : Montant (le reste de la prochaine échéance), Date (pas après aujourd'hui), Note ; « Ajouter le
  paiement » → `crm_add_payment` (méthode `other`) : crée la vente si besoin, événement `payment_succeeded`, le cycle devient gagné.
- **Remboursement** (`lnpAsk` « Marquer ce paiement comme remboursé ? ») → `crm_add_refund` ; **Retirer** (`lnpAsk` « Retirer ce
  paiement ? ») → `crm_delete_payment`.
- Après chaque écriture, rechargement et nouveau dessin ; erreur du serveur en rouge. Lecteur : « Vous pouvez consulter
  l’encaissement ; un administrateur, un responsable commercial ou le commercial du prospect le saisit. » Montants `fr-FR`.

---

## 9. Suivi du setter

Version embarquée de `app/crm/setting_ui.js` (migration 054, `docs/crm/19-setting.md`). Un statut setter par lead, gardé sur la
personne (`crm_people.setting_*`, lu par `lnpSetOf(person)`) ; actions par `crm_setter_action`, choix du setter par
`crm_set_setter` (administrateur), lead saisi à la main par `crm_create_lead`. Hors édition web, rien ne s'affiche.

### 9.1 Les statuts

| Clé | Libellé | Action actuelle (`STEP[0]`) | À faire ensuite (`STEP[1]`) |
|---|---|---|---|
| `a_contacter` | Lead à contacter | Appeler le lead (en moins de 5 min) | Sans réponse : message de relance WhatsApp, puis nouvelle tentative |
| `relance` | Relance n / 6 (2 pour un quiz abandonné) | Nouvelle tentative : appel ou message | Joint : qualifier et poser le RDV ; après 6 tentatives : injoignable |
| `qualification` | Appel de qualification | Qualifier le lead en 4 points | Poser le RDV dans iClosed |
| `rdv_a_confirmer` | RDV à confirmer | Envoyer le message de confirmation du RDV | Attendre le « OK » du lead |
| `appel_confirmation` | Appel de confirmation | Appeler pour valider le créneau | Attendre le « OK », puis rappels J−1 et H−2 |
| `rdv_pose` | RDV posé · OK attendu | Envoyer le récapitulatif du RDV | Attendre le « OK » du lead |
| `rdv_confirme` | RDV confirmé | Rappel la veille (J−1) | Rappel 2 h avant (H−2), puis le commercial fait l’appel |
| `reconfirmation` | Re-confirmation | Appeler pour reconfirmer le RDV | Rappel 2 h avant (H−2) |
| `a_replanifier` | À replanifier | Reposer un RDV aujourd’hui | Confirmer le nouveau RDV |
| `absent_rattrapage` | Absent · rattrapage | Appeler le lead pour reprendre un RDV | Sans réponse : relancer jusqu’au nouveau RDV |
| `webinaire_absent` | Webinaire absent · attente de réponse | Attendre une réponse du lead (48 h) | Sans réponse : le setter l’appelle |
| `absent_attente` | Absent · attente de réponse | Le commercial relance (24 h) | Sans réponse : le setter reprend le lead |
| `transmis` | RDV tenu · au commercial | Le commercial a la main | — |
| `injoignable` | Injoignable · nurture | Aucune : lead injoignable | Reprendre le lead s’il répond |
| `non_qualifie` | Non qualifié · nurture | Aucune : lead non qualifié | Reprendre le lead s’il revient |

Actions proposées selon le statut (`NOW`) parmi : « Appel sans réponse », « Joint au téléphone », « Message de relance envoyé »,
« RDV posé dans iClosed », « Non qualifié », « Classer injoignable », « Message de confirmation envoyé », « Appel de confirmation
fait », « « OK » reçu », « Rappel J−1 envoyé », « Rappel H−2 envoyé », « Pas de « OK » à J−1 », « RDV annulé ou déplacé »,
« Reprendre le lead ». Couleurs de puce (`GRP`) : `go`, `rdv`, `ok`, `off`.

### 9.2 Dans Leads

Filtre « Prise de RDV » (`lnpSetFilter`/`lnpSetMatch`, chaque statut) et colonnes **Prise de RDV** (puce + échéance, en retard si
dépassée), **Dernière action**, **Action actuelle** (`lnpSetCell`, `lnpSetLast`, `lnpSetNow`).

### 9.3 Le panneau de la fiche (`lnpSetPanel`)

« Prise de RDV · setter » + la puce du statut (ou « Pas encore suivi par un setter ») ; **trois lignes** : « Action actuelle »
(+ échéance), « Dernière faite », « À faire ensuite » (`STEP`, décision du 2026-11-14) ; puis « Enregistrer une action du setter »
(repliable, ouvert sans statut) : les boutons d'action (le premier mis en avant), « Une note avec l’action (facultatif) » et
« Ajouter la note » ; pour un administrateur, « Setter » (« Sans setter » + les setters actifs). Messages « Enregistrement… »,
« Enregistré : <action> », « Non enregistré : … ».

### 9.4 « + Nouveau prospect » (`lnpNewLead`)

Fenêtre « Nouveau prospect » : Nom, E-mail, Téléphone (`06 12 34 56 78`), Source (Saisi à la main, Quiz complété, Opt-in VSL, Quiz
abandonné, Webinaire) → `crm_create_lead` (« Création… », « Non créé : … ») ; Échap ferme.

---

## 10. Alertes

Le CRM est la base des notifications (décision du 2026-11-09) ; Slack n'en est qu'une copie facultative, éteinte par défaut.
`sla-tick` (toutes les 5 min) ouvre, fait monter et ferme les alertes (`crm_sla_alerts`, `crm_sync_sla_alerts`, migration 053) ;
`crm_sla_alerts_open()` rend à chacun les alertes qu'il peut voir (un commercial les siennes, un administrateur toute l'équipe).
Module : `LNP_ALERTS` (copie embarquée de `app/alerts_module.js`).

### 10.1 Le magasin (`LNP_ALERTS.store`)

Démarré au chargement de la page : `LNP_CRM.slaAlerts()` puis rechargé par Realtime sur `crm_sla_alerts` (attente 1,5 s), chaque
minute et au retour sur l'onglet. Il compte les alertes (`count`, `critical`) et émet `lnp-alerts`. Hors édition web : quatre
alertes fictives.

### 10.2 Pastille

Celle de « Cycle de vente » dans la barre latérale (§ 1.2) : elle compte d'abord les prospects « Agir maintenant », les alertes
seulement en attendant le bureau.

### 10.3 Bandeau et notification du navigateur

Une alerte nouvelle ou montée à En retard ou Critique (jamais « Bientôt dû ») ouvre en haut à droite un bandeau `role="status"` :
« Nouvelle alerte · <niveau> · <SLA> <nom> · <prospect> » (ou « n nouvelles alertes · … (et k autres) »), « Voir » (Cycle de vente ›
À traiter) et « × » ; il disparaît après 15 s. Pour une critique, si la permission est déjà accordée et que LNP n'est pas au
premier plan : notification « LNP · Alerte critique » (« <SLA> <nom> · <prospect> ») ; un clic ouvre la fiche du prospect.

### 10.4 L'écran Alertes (inatteignable)

Le gabarit `Alertes` et son module existent encore (titre « Alertes », sélecteur « Commercial » pour un administrateur,
« Être prévenu des alertes critiques », compteurs Critique · En retard · Bientôt dû · Fermées aujourd’hui, groupes, « Ouvrir la
fiche », « Aucune alerte ouverte. Tout est dans les temps. »), mais `MOVED.alertes = "salescycle"` : les alertes se traitent dans
Cycle de vente › « À traiter ». Conséquence : **le bouton qui demande l'autorisation des notifications n'est plus atteint**
(§ 17).

### 10.5 Le catalogue des SLA (`LNP_SLA`)

Une seule source, `supabase/functions/_shared/sla_rules.js`, pour le bureau (copie dans `LNP_SB_DOC`), Paramètres › Alertes (copie
dans la page), `sla-tick` et le connecteur. `LNP_SLA` expose `DEFS`, `BY`, `BASE`, `STAGES`, `SOURCES`, `configure`, `active`,
`status`, `evaluate`, `worst`, `fmt`, `said`, `RANK`, `SETTING`, `setting`. `evaluate(lead, {t0, tz, surface})` rend pour chaque
SLA actif `{id, name, level (warn|late|crit), open, elapsed, target, kind}` ; un SLA ne s'affiche qu'au-delà du préventif ; un
lead clos arrête les horloges ; CO-1 / CO-2 suivent la plage 08:00-22:00 Europe/Paris quand l'ouverture réelle est connue. Types
(`kind`) : `sales` (fait le niveau du lead), `tech` (défaut de données ou d'intégration, administrateurs seulement), `indicator`
(lu dans le Cockpit), `form` (règle de formulaire, sans horloge). Sources (`needs`) : `messages` « Messages WhatsApp de l’équipe »,
`whop` « Liens et paiements Whop », `analysis` « Analyse automatique de chaque appel » ; une source non reliée éteint ses SLA.

**52 SLA** (seuils Bientôt dû / En retard / Critique ; « non » = non mesuré par le code, `eval: false`) :

| ID | Nom | Étape | Type | Mesuré | Sources | Bientôt dû | En retard | Critique | Objectif |
|---|---|---|---|---|---|---|---|---|---|
| SH-1 | Confirmation automatique | Présence | tech | oui | messages | — | 5 min | 15 min | 1 min |
| SH-2 | Premier contact du commercial | Présence | sales | oui | messages | 3 min | 15 min | 1 h | 5 min |
| SH-3 | Délai jusqu’au R1 | Présence | indicator | oui | — | — | 3 j | 4 j | 48 h |
| SH-4 | Échange avant l’appel | Présence | sales | oui | messages | 12 h | 3 h | — | avant le R1 (heures avant l'appel) |
| SH-5 | Rappels avant l’appel | Présence | tech | non | messages | — | — | — | 100 % envoyés |
| SH-6 | R1 honoré à l’heure prévue | Présence | sales | oui | — | — | 45 min | 2 j | à l’heure prévue |
| SH-7 | Déplacement demandé par le prospect | Présence | sales | non | — | — | 24 h | — | au plus 48 h après l’heure d’origine |
| SH-8 | Relance après une absence | Présence | sales | oui | messages | — | 1 h | 24 h | 15 min |
| SH-9 | Nouveau créneau après une absence | Présence | sales | oui | — | 12 h | 24 h | — | 24 h |
| SH-10 | Déplacement de notre côté | Présence | sales | non | — | — | — | — | zéro |
| SH-11 | Issue déclarée | Présence | sales | oui | — | 10 min | 1 h | 24 h | 15 min |
| SH-12 | Durée de l’étape Présence | Présence | indicator | non | — | — | — | — | médiane ≤ 48 h |
| DE-1 | Récap écrit après l’appel | Décision | sales | oui | messages | 45 min | 3 h | 24 h | 60 min |
| DE-2 | Analyse d’appel disponible | Décision | tech | oui | analysis | — | 1 h | 4 h | 15 min |
| DE-3 | Prochaine étape datée | Décision | form | non | — | — | — | — | 100 % à la déclaration |
| DE-4 | Prochain appel réservé | Décision | sales | oui | — | 12 h | 24 h | 2 j | 24 h |
| DE-5 | Délai entre deux appels | Décision | sales | oui | — | — | 5 j | 7 j | 72 h |
| DE-6 | Date promise tenue | Décision | sales | non | — | — | 24 h | 3 j | le jour même |
| DE-7 | Relance sans réponse | Décision | sales | oui | messages | 20 h | 2 j | 4 j | 24 h |
| DE-8 | Appels sans décision | Décision | sales | oui | — | 2 | 3 | — | 2 appels au plus (seuils en appels) |
| DE-9 | Étape de décision | Décision | sales | oui | — | 60 h | 3 j | 6 j | 72 h |
| CA-1 | Lien de paiement envoyé | Encaissement | sales | oui | whop | — | 30 min | 2 h | 5 min, idéalement pendant l’appel |
| CA-2 | Premier paiement | Encaissement | sales | oui | — | 12 h | 24 h | 2 j | 24 h |
| CA-3 | Relance de paiement | Encaissement | sales | non | whop, messages | — | — | — | à H+4, puis à H+24 |
| CA-4 | Paiement échoué | Encaissement | sales | non | whop | — | 1 h | 4 h | 15 min |
| CA-5 | Oui non payé : clôture | Encaissement | sales | oui | — | 7 j | — | 14 j | 14 jours |
| CA-6 | Passage à l’accompagnement | Encaissement | sales | non | — | — | 2 h | 24 h | 2 h |
| CA-7 | Remboursement ou litige | Encaissement | sales | non | whop | — | — | — | 15 min (automatique) |
| CO-1 | Réponse à un message du prospect | Conversation | sales | oui | messages | 10 min | 1 h | 4 h | 15 min dans la plage du commercial |
| CO-2 | Message hors plage du commercial | Conversation | sales | oui | messages | — | — | — | dans les 15 premières minutes de la plage suivante |
| CO-3 | Appel manqué | Conversation | sales | non | messages | — | 30 min | 2 h | 10 min |
| CO-4 | Demande d’arrêt (STOP) | Conversation | tech | oui | messages | — | — | — | immédiat |
| CO-5 | Heures d’envoi automatique | Conversation | tech | oui | messages | — | — | — | 100 % dans la plage |
| CL-1 | Perte automatique | Clôture et suivi long terme | sales | oui | messages | 27 j | 30 j | — | 30 jours |
| CL-2 | Motif de perte | Clôture et suivi long terme | form | non | — | — | — | — | 100 % à la clôture |
| CL-3 | Réponse à un prospect en suivi long terme | Clôture et suivi long terme | sales | oui | messages | 10 min | 1 h | 4 h | 15 min dans la plage du commercial |
| CL-4 | Archivage du suivi long terme | Clôture et suivi long terme | sales | non | — | 150 h | — | — | règle D6 |
| DO-1 | Événement visible dans le CRM | Données et fiabilité | tech | non | — | — | 5 min | 15 min | 1 min |
| DO-2 | Enregistrement rattaché | Données et fiabilité | tech | oui | — | — | 2 h | 24 h | 30 min |
| DO-3 | Événement non rattaché | Données et fiabilité | tech | non | — | — | 24 h | 3 j | 24 h |
| DO-4 | Rapprochement | Données et fiabilité | tech | non | — | — | — | — | écart : 0 |
| DO-5 | Source silencieuse | Données et fiabilité | tech | non | — | — | 6 h | — | aucun silence anormal |
| SE-1 | Premier appel du setter | Setting | sales | oui | — | — | 10 min | 55 min | 5 min |
| SE-2 | WhatsApp après un appel sans réponse | Setting | sales | non | messages | — | 15 min | — | dans la minute |
| SE-3 | Relance due | Setting | sales | oui | — | — | 2 h | 24 h | à l’heure de la cadence |
| SE-4 | Six tentatives sans contact | Setting | form | non | — | — | — | — | automatique |
| SE-5 | Quiz abandonné | Setting | form | non | — | — | — | — | 48 h |
| SE-6 | Confirmation d’un RDV auto-booké | Setting | sales | oui | — | — | 1 h | 3 h | 1 h |
| SE-7 | Issue de l’appel setter notée | Setting | sales | oui | — | — | 0 min | 24 h | le jour même (21 h) |
| SE-8 | Lead sans action | Setting | sales | oui | — | — | 24 h | 2 j | 24 h |
| SE-9 | Pas de « OK » à J−1 | Setting | sales | oui | — | — | 0 min | 2 h | le jour même |
| SE-10 | RDV replanifié ou annulé | Setting | sales | oui | — | — | 0 min | 24 h | le jour même (21 h) |

---

## 11. Analyse d'appel

Copies embarquées de `app/crm/call_analysis.js` (`LNP_CA` : ouverture, pastilles, ajout de transcription),
`call_analysis_view.js` (`LNP_CAV.html(record, ui)` : le rendu) et `transcript_parse.js` (`LNP_TRANSCRIPT`). Données :
`crm_ca_board()` (liste et numérotation des appels, `062`), `crm_ca_record(job)` (le dossier du moteur), `crm_ca_add_transcript`,
`crm_ca_retry`, `crm_ca_correct` (`063`). **Le moteur relève et cite, le code note** ; ces fichiers n'affichent que ce qui est stocké ;
les codes restent en anglais dans le dossier, seuls leurs libellés sont traduits (`WHY`, `STATUS`, `OUTR`, `OUTCOME`, `PCAT`,
`NATURE`, `SUBT`, `REACT`…) ; les citations restent mot pour mot ; l'heure s'écrit `mm:ss`.

### 11.1 Quels appels, qui les voit

`crm_ca_board()` : une ligne par appel analysable (appels passés non annulés des cycles visibles, numérotés comme l'analyse :
`crm_ca_call_info`, un appel enregistré par Fathom compte par son rang, les absences ne décalent plus le R1) ; un administrateur
voit tout, sinon le propriétaire du cycle. Champs `call_id`, `cycle_id`, `round`, `start`, `transcript`, `job`, `status`
(`queued`/`running`/`failed`/`done`), `error`, `queued_at`, `started_at`, `done_job`, `scores`.

### 11.2 Pastille et ouverture

`LNP_CA.chip(id)` (colonne Analyse) : « R<n> » + les quatre notes colorées, « Analyse R<n> en cours… », « Échec de l'analyse R<n> »,
« + Transcription R<n> ». `LNP_CA.open(callId, ctx)` : un appel déjà analysé s'ouvre **en plein écran** (`.ca-full`, décision du
2026-11-19 : `leadView`), le nom du lead et la croix restant en haut au défilement ; sinon une fenêtre de 1 180 px (« Analyse d'appel ·
R<n> · <date> ») : en cours (« Analyse en cours… », « Elle attend le prochain passage de l'analyse, toutes les heures à la 7e minute,
puis prend 15 à 30 minutes environ. » ou « L'analyse a commencé le … »), échec (« L'analyse n'a pas abouti », l'erreur, « Relancer
l'analyse » → `crm_ca_retry`) ou ajout (§ 11.10). Hors web : « L'analyse d'appel fonctionne dans la version web, où le CRM est en
ligne. » ; appel inconnu : « Cet appel n'est pas analysé : seuls les appels de vente R1 et R2 passés le sont… ». Le focus est tenu
dans la fenêtre et rendu à l'élément qui l'a ouverte. **Échap** ferme d'abord le panneau d'un geste, puis la question ouverte, puis la
transcription, enfin l'analyse.

### 11.3 En-tête (`header`) et « Pour ton prochain appel » (`plan`)

- Barre des notes collée en haut (`nav.cav-nav` « Notes de l’appel ») : quatre tuiles Découverte, Écart, Présentation de l'offre,
  Objections : note sur 100, état (`compState` : « Maîtrisé » ≥ 85, « En progrès » ≥ 60, « À travailler » ; « Écart absent » et
  « Non conforme » en rouge ; non noté : « Exclu », « À vérifier », « Non applicable », « Aucun résultat » + raison), « +x à gagner »
  (100 − note) ou « au maximum » ; la plus basse des notes (au moins deux notées) porte « priorité ». Un clic mène à la section.
  Bouton « Transcription » / « Masquer la transcription ».
- Un appel non noté : « Cet appel n'a pas été noté : <raison> » (précision pour `diarization_suspect`).
- **« Pour ton prochain appel »** (« jusqu’à +n points ») : les trois actions qui rapportent le plus (`ACT`, items D1–D5, G1–G6,
  K1–K7, H1–H5, R1–R3 : poids × (2 − niveau) / 2, ramené à ce qui manque pour 100 ; pour les objections, les gestes à 70 % et la
  prévention à 30 %), chacune avec sa section et « +p » ; « Ce qui a marché » (`WON`, trois items au maximum). Affichage seulement :
  la note reste celle du moteur.
- Couleurs d'état uniques : vert maîtrisé, bleu en progrès ou en partie, ambre à travailler ou manqué, rouge seulement pour une
  règle enfreinte, neutre à vérifier.

### 11.4 Qualification du lead (`qualification`)

Section « Q · Qualification du lead » avec le verdict (« SQL gagné », « SQL ouvert », « SQL perdu », « Non SQL », « À revoir »,
« MQL en attente », détail au survol : motif, méthode, règle, confiance). **Cinq fenêtres sur une ligne** (règle des portes 2.3,
2026-11-21) : Métier, Financement, Décision et timing, Douleur, Projet ; chacune seulement « Validé » ✓, « Refusé » ✕ ou
« Incomplet » … (« Non évalué » – pour une qualification faite avant la règle 2.3). Au survol ou au focus, une fenêtre : pourquoi (ou
« Non abordé pendant l’appel. »), « Ce que le prospect a dit » (citations), « Pour valider » (`QRULE`). Dessous, « n point(s)
d’attention ». Données : `crm_ca_record` porte `qualification` (worker `callqa_worker/qualif.py`, migration 046).

### 11.5 Transcription (`drawer`)

Panneau à droite « Transcription de l’appel » : toutes les prises de parole horodatées, recherche sans accents (`.cav-find`,
« Chercher un mot, un prénom, un montant… », « n répliques sur N »).

### 11.6 « 1 La découverte » (`discovery`)

- Sous-titre « <début> → <fin> · n questions de découverte · k autres · chaque question est jugée sur ce que le prospect a
  répondu » ; « ⚠ n questions incertaines » (« lettre orange avec un « ? » : cliquez dessus pour lire pourquoi ») ; « Comment c’est
  noté » (`HOW.SPIN` : situation 15, problème 20, conséquences 30, bénéfice 20, profondeur 15) ; bandeau si non notée ; bandeau si
  les registres sont peu fiables (« … % tranchés par les trois lectures (objectif 92 %) »).
- **Tableau** à trois colonnes dont les titres ne s'affichent pas (`.sr`, lecteur d'écran) : « Sujet abordé » (22 %), « Questions »
  (60 %), « Profondeur » (18 %). Les explications sont dans l'infobulle d'un petit ⓘ (`.th-i`) : lettres S Situation · P Problème ·
  I Implication · N Bénéfice, lettre pleine = un fait obtenu, pointillée = rien retenu, tiret = autre question ; l'axe du temps ;
  l'échelle de profondeur.
- Une ligne par **registre** (Financier, Temps et charge, Identité et statut, Mental et émotionnel, « Sans registre » pour la clé
  `other` ; anciens dossiers : par domaine) : point de couleur, nom, premier extrait des mots du prospect. Colonne Questions
  (`piste`, `axe`) : **une seule échelle** de la première question de diagnostic à l'offre, graduée dans l'en-tête et prolongée dans
  chaque ligne ; chaque question est une lettre placée à son heure, une question qui en couvrirait une autre est poussée à droite ;
  « n questions · k chaînes approfondies ». Colonne Profondeur (`profondeur`, `echelle`) : échelle de 0 à 10 (faits, douleurs et
  blocages ×1,5 jusqu'à 2, désirs, un chiffre, chaînes approfondies ×1,5 jusqu'à 2, question d'implication 1, de bénéfice 0,5) ;
  dessous ce que le prospect a confié (« 2 douleurs · 1 désir ») et l'état (Effleuré, Chiffré, Valeur exprimée, Approfondi), détail au
  survol. Lignes « Rien de retenu » (sans registres) et « Autres questions » (« demandes d'accord, questions sur l'offre et le
  financement », « ne comptent pas »).
- **Clic sur une lettre** : panneau à droite (`pane()`, « Question choisie ») qui n'apparaît qu'au clic : la question, l'heure,
  sa réponse et les répliques autour (`ctxRows`, 2 avant et 2 après, le passage en clair, le reste atténué en couleur) ; raisons
  d'une question incertaine (`UNC` : non tranchée, arbitrée, lue une seule fois, aucune porte franchie, sujet non tranché, réponse non
  trouvée, voix douteuse, effet reclassé) ; pour un administrateur (`can_correct`) « Corriger la lettre : S P I N Hors SPIN »,
  « Pourquoi (facultatif) » → `caCorrect(job, unit, lettre, note)` = `crm_ca_correct` (table `crm_ca_corrections`, ajout seulement) ;
  la lettre corrigée s'affiche en pointillés, la lettre du moteur en infobulle, « La note de l'analyse n'est pas recalculée. »

### 11.7 « 2 L'écart reformulé » (`gap`)

Sous-titre « Problème et coût reformulés en une fois, avec les mots exacts du prospect, validés par le prospect, avant la
présentation de l'offre et le prix. » ; « Comment c’est noté » (point A 10, point B 10, écart mesurable 10, coût 20, reformulation
25, validation 25). **Deux fenêtres de même taille** sur la largeur (`.gx3`, `.gx-win`), qui défilent en elles-mêmes : à gauche la
reformulation en un seul texte (puis la validation du prospect), chaque élément surligné de sa couleur ; à droite les éléments dans
l'ordre de la transcription — Point A, Point B, Problème, Coût, puis Validation, les non repris en creux à la fin — chacun avec son
état (« Ses mots », « Paraphrase », « Pas ses mots », « Non repris », « Pas dit par le prospect », « Pas le bon point A/B », « Validé,
avec ses mots », « Validé d’un « oui » », « Pas validé »…) et les mots exacts du lead (`nodeR`). État du blocage : « Demandé, non
dit », « Jamais demandé »… ; « Écart à reprendre » (`gap_not_remedied`). Puis **« Pour un écart parfait »** (« jusqu’à +n points ») :
ce qui manque (« Faire chiffrer le point A », « Poser la question du blocage avant l’offre : « qu’est-ce qui t’a empêché d’y arriver
jusqu’ici ? » »… ; « indispensable » ; « Rien ne manque : l’écart est complet. ») et **« La reformulation parfaite, avec ses mots »**
(`formula.perfect` du moteur, cases non dites remplacées par la question à poser). Sans reformulation : « Aucune reformulation de
l’écart avant la présentation de l’offre. »

### 11.8 « 3 La présentation de l'offre » (`pitch`)

« Conforme » / « Non conforme » ; sous-titre « Blocage validé « … » → <catégorie> · un blocage, un mécanisme, quatre étapes, puis
feuille de route, montant, décision. » ; « Comment c’est noté » (sept critères) ; bandeau « Prix donné trop tôt, déguisé en « tour du
marché »… » (`disguised_price`) ; escalier « Étape 1 · Blocage », « Étape 2 · Mécanisme », « Étape 3 · A → B », « Étape 4 ·
Preuve », « Puis feuille de route » ; la présentation complète mot pour mot, passages marqués (adhésion, étapes, « interdit ·
promesse de résultat », « affirmation · à vérifier par rapport à l'offre », « récitation »).

### 11.9 « 4 Objections » (`objections`)

Sous-titre « Une résistance, c'est ce que dit le prospect ; les gestes se lisent dans ta réponse ; la résolution, dans les mots du
prospect. » ; « Comment c’est noté » (70 % traitement, 30 % prévention). **« Avant le prix : ce que tu savais »** : tuiles « Circuit
de décision » (« non établi avant le prix »), « Budget et échéance » (« non établis avant le prix »), « Tentative passée » (« non
mentionnée »). **« Après le prix : les objections »** : tableau Objection · « Ce qu’il a dit, ta réponse, sa réaction et les gestes
A · I · E · M » (ⓘ : « A accueillie · I isolée · E explorée · M réponse adaptée… ») ; une ligne par objection regroupée par
sous-type (Prix, Argent disponible, Confiance dans l'offre, Pertinence, Temps, Co-décideur, Capacité, Choix, Moment) ou nature,
« revient n fois », état de la dernière (« résolue », « persistante », « latente », « reconnue »…) ; chaque épisode : heure, mots du
prospect, puces A · I · E · M (vert fait, bleu en partie, rouge pointillé manqué, grisé sans objet), « Ta réponse : … »,
« Réaction du prospect : … ». **Clic sur une lettre** : le passage s'ouvre dans un panneau **à gauche du tableau**
(`gSide`, `.ob-side`, collant sous la barre des notes, défilant en lui-même) : « <lettre> · <geste> » + état, l'objection et son
heure, la définition du geste, les répliques autour (`ctxRows`, 1 avant et 2 ou 3 après) ; la même lettre ou « × » le referme. Vide :
« Aucune résistance n'a été trouvée dans cet appel. »

### 11.10 Pied, transcription remplacée, ajout

Pied : « Notes provisoires tant que les seuils de fiabilité ne sont pas atteints · » (si `provisional`), « Le modèle relève et cite ;
le code note, avec les règles de la méthode LNP (<versions>). » « Remplacer la transcription » est en bas de l'analyse.

Ajout (`showAdd`, `crm_ca_add_transcript`) : « Ajouter la transcription » / « Remplacer la transcription » ; « Collez la
transcription de l'appel (Fathom, Zoom, Google Meet, un export .vtt ou .txt), ou déposez le fichier… » ; « Choisir un fichier »
(.txt, .vtt, .srt, .json), « Lire les intervenants » ; tableau Intervenant dans la transcription · Prises de parole · Mots · Rôle
(Commercial, Prospect, Autre) : proposition = le nom qui contient le prénom du commercial, puis celui qui parle le plus ;
« Choisissez au moins un commercial et un prospect. » ; « Analyser cet appel » → `p_raw` (« [mm:ss] Nom: texte »), `p_speaker_map`,
`p_source = 'upload'` ; le serveur (administrateur ou propriétaire, appel éligible, au moins 200 caractères) crée un job en file. Le
travail est fait par `.github/workflows/call-analysis.yml`. Formats lus par `transcript_parse.js` : JSON Fathom, WebVTT / SRT,
`[T001 00:06] SALES: texte`, `[00:06] Nom: texte`, `00:06 Nom: texte`, `Nom (00:06): texte`, blocs « Nom  0:06 » + texte.

Raisons traduites (`WHY`, extraits) : « enregistrement incomplet (moins de 20 minutes) : appel non analysé »
(`recording_incomplete`), « écart déjà fait lors d'un appel précédent du cycle », « offre déjà présentée lors d'un appel précédent du
cycle », « la transcription confond trop souvent qui a dit quoi » (`diarization_suspect`), « trop de questions de découverte n'ont pu
être classées… » (`health_absent_share`).

---

## 12. Entraînement

Cinq écrans, chacun un document dans son cadre (`app/training/*.html`, injectés par `build.py` / `app/gen_training.py` /
`app/gen_simulateur.py`). Dans LNP, le titre est celui de la page (classe `emb`). Chaque exercice terminé est enregistré par
`app/training/results_log.js` dans `crm_training_results` (migration 049 : ajout seulement, jamais modifié ni effacé) ; sans
connexion, il attend sur l'appareil (« Résultats gardés sur cet appareil : connecte-toi à LNP pour les retrouver sur ton compte. »,
« … en attente d’envoi vers ton compte. », « Résultats enregistrés sur ton compte. »).

### 12.1 Découverte (`LNP_TRAINING_DOC`, `app/training/entrainement.html`)

Onglets « Le coup suivant » et « La lettre imposée » (chacun garde sa séance) et « Nouvelle séance ». Cas : `coup_lnp.json` (100) et
`lettre_lnp.json` (20). Registres : Financier, Temps & charge, Identité & statut, Mental & émotionnel.

- **Le coup suivant** : un extrait de R1 (« Il vient de dire »), choisir le geste L1 Situation, L2 Problème, L3 Impact, L4 Vision
  (« Sûr » / « J’hésite », « Valider le geste »), puis écrire la question exacte ; règles vérifiées pendant la saisie : ouverte (« Est-ce
  que » et l'inversion appellent un oui ou un non), « Sans choix A ou B », « Sans « pourquoi » », « Une seule question », « 18 mots au
  plus », « Se termine par « ? » », règles propres au geste (« Pas de projection », « Pas de solution », « Repart de ses mots ») ;
  « Comparer à l’étalon », deux jugements (O / N) ; verdicts « Coup juste », « Bon coup, avec indice : non compté », « Bon geste,
  question à retravailler », « Geste manqué ». Bilan : matrice des confusions, « Tu montes trop vite sur l’échelle » / « Tu restes trop
  longtemps sur le même cran », objectif « 16 coups justes sur 20 ». Séance : nombre de coups 10 / 20 / 40 / Les 100, geste attendu,
  registre, quels cas (Tous, Jamais joués, Mes erreurs).
- **La lettre imposée** : trois questions d'implication d'affilée (le coût direct, l'effet en chaîne, ce que ça lui fait), le
  prospect répond après chacune ; « Question d’implication valide » / « Question refusée », temps moyen (cible sous 30 s), « Ton
  maillon le plus faible », « La règle que tu enfreins le plus » ; objectif 80 % de questions valides. Séance : 3 cas · 9 questions,
  5 cas · 15, 10 cas · 30, Les 20 ; quels cas (Tous, Jamais joués, Chaînes incomplètes).
- Clavier : 1 à 4 choisissent un geste, Entrée valide, Ctrl ou ⌘ + Entrée compare, O et N jugent.

### 12.2 Maîtrise de l'offre (`LNP_ACADEMIE_DOC`, `app/training/academie.html`)

100 cas (`academie_contenu.json`) tirés de vrais appels. Barre : « ← » / « → », la grille des 100 cas (filtres de format et d'état),
« Prochain à faire », « Fiche mémo », et « Formateur » (administrateurs : résultats de l'équipe lus dans `crm_academy_progress` et
`crm_members`, plus « Avant de diffuser : 11 points à faire trancher »). **Format A · À toi de répondre** (réponse écrite comme en
visio, chrono de 90 s facultatif) ; **Format B · Trouve l’erreur** (extrait d'appel : l'erreur, la règle, ce qu'il fallait faire,
réécriture). Onglets « Ta réponse », « Auto-correction », « Résultat · <note> », « Corrigé » : la réponse est **validée puis figée**
(« Écris d’abord ta réponse… »), l'auto-correction coche ce qu'elle contient vraiment contre la grille du formateur (« J’ai utilisé
une formulation éliminatoire » ramène à 0), « Enregistrer ma note » ; **pas de correction par Claude** (décision du 2026-11-08).
Validé à 8/10 ; meilleure note gardée par cas dans `crm_academy_progress` (« Progression synchronisée avec ton compte. »).

### 12.3 Mes résultats (`LNP_RESULTATS_DOC`, `app/training/resultats.html`, mode personnel)

Période « 7 j » · « 30 j » · « 90 j » · « Depuis le début », « Actualiser », « Mis à jour à … ». Source : RPC
`crm_training_dashboard(p_days)`. « Ton score d’entraînement » sur 100 = moyenne de trois parts, depuis le début : Le coup suivant
(coups justes sur les 50 derniers), La lettre imposée (questions valides sur les 20 derniers cas, sur 60), Maîtrise de l'offre
(meilleures notes des 100 cas, sur 1 000) ; un entraînement jamais fait compte 0. Tuiles « Exercices faits », « Temps passé » (temps
actif : rien après deux minutes d'inactivité), réussite, cas validés ; « Temps d’entraînement par jour » (30 derniers jours) ;
historique cliquable (questions, réponses, règles en faute, points par critère), « Voir les exercices plus anciens ». Le Simulateur
n'y figure pas.

### 12.4 Entraînement de l'équipe (`LNP_SUIVI_DOC`, même fichier, `MODE = "equipe"`)

Administrateurs seulement (`suivi` ajouté par `/api/me`). Tuiles de l'équipe (score moyen, exercices, temps…) et tableau trié par clic
sur un titre : Commercial, Score, Le coup suivant, La lettre imposée, Maîtrise de l’offre, Exercices, Temps, Dernier entraînement,
Appels réalisés, Ventes, CA signé, Encaissé, CA par appel ; « Ne fait plus partie de l’équipe ». Clic sur une personne : son score
détaillé, son temps par jour, son historique.

### 12.5 Simulateur (`LNP_SIMULATEUR_DOC` = `app/training/simulateur.html`)

L'appel de vente avec un prospect joué par Claude (`docs/crm/20-simulateur.md`). Le document lit les tables `crm_sim_*` par
`claude.use("crm")` et fait tout le reste par `claude.use("simulateur")` (fonction Edge `simulateur`). Hors LNP en ligne : un aperçu
avec deux prospects d'exemple.

- Barre : « LES NOUVEAUX PROFS · Simulateur », sections « Nouvelle simulation », « Historique » et, pour un administrateur, « Offres
  et prospects » et « Réglages ».
- **Nouvelle simulation** : l'entraînement (`MODES` : « Appel complet », « Diagnostic », « Objections »), « Offre à vendre », le
  prospect (la difficulté vient du prospect : `DIFF` Moyen, Difficile, Expert ; loquacité par prospect), texte ou voix, « ▶ Lancer la
  simulation ». Variante du jour tirée à chaque lancement (humeur, contexte, objection de plus, loquacité), visible après l'appel.
- **Appel** : fiche du prospect à gauche (« Afficher / Masquer la fiche prospect »), étapes à cocher en haut, texte (Entrée envoie,
  Maj + Entrée passe à la ligne, micro) ou voix (le prospect répond au silence ; on peut lui couper la parole ; voix ElevenLabs si la
  clé existe, sinon celle du navigateur ; « Mode voix indisponible », « Basculement en mode texte. ») ; « ↶ Annuler le dernier
  échange » ; « Terminer l’appel » (« Quitter sans analyser » / « Terminer et analyser »).
- **Fin d'appel et résultat** : note de la simulation, auto-analyse en quatre questions (« Ton moment difficile »…), puis l'analyse :
  note sur 100 sur cinq dimensions (`DIMS` : Connexion, Écoute, Exposition, Alignement, Résolution), chaque point avec sa citation,
  point fort, point faible, exercice ; « Réalisme de la simulation » (part de parole du prospect, réponses de plus de 80 mots…) ; le
  mode Objections est analysé (« Un rapport d’analyse sera généré sur le traitement des objections et la décision. »).
- **Historique** : chaque simulation, sa transcription et son analyse ; « Relancer les analyses en attente ».
- **Offres et prospects** (administrateurs) : créer une offre (adresse, texte ou PDF), « Réanalyser l’offre », « Supprimer l’offre »,
  « Générer les prospects » (six profils), difficulté et loquacité par prospect, désactiver ou supprimer un prospect (confirmation).
- **Réglages** (administrateurs) : « Modèle du prospect », « Modèle de voix », « Proposer le mode voix aux commerciaux », « Détection
  du silence », analyses ; « Enregistrer les réglages ».

---

## 13. Paramètres › Alertes et notifications

Gabarit `Settings` (source en retard : `gabarits/Settings.pre-hz.dc.html`), catalogue `LNP_SLA` (§ 10.5), réglages
`crm_settings.sla_rules` (`crm_save_sla_rules`, migration 044 : forme vérifiée, sources `messages`, `whop`, `analysis`).

- En-tête « Paramètres » : onglets « Alertes et notifications » | « Compte » | « Accès » (administrateurs) ; à droite l'état
  (« Modifications non enregistrées », « Enregistrement… », « Non enregistré : … », « Enregistré pour toute l’équipe » ou
  « Enregistré pour cette session du navigateur… », « À jour »), « Rétablir les réglages par défaut », « Enregistrer les
  modifications ».
- Section « Gestion des prospects · SLA du cycle de vente » : résumé, la phrase « Chaque SLA est un engagement de délai… et devient
  une alerte dans le CRM (Cycle de vente › Agir maintenant, avec le nombre d’alertes sur « Cycle de vente » dans la barre latérale)… » ;
  « Sources de données » (« Une source non reliée met en attente les SLA qui en ont besoin, pour ne pas mettre en retard des
  prospects à tort ») avec un interrupteur par source ; puis les SLA par étape (Présence, Décision, Encaissement, Conversation, Clôture
  et suivi long terme, Données et fiabilité, Setting) : « <nom> · <ID> », état (`LNP_SLA.status` : « Mesurée », « Mesurée ·
  technique », « Mesurée · indicateur », « En attente de données » + « Source non reliée : … », « Règle de formulaire · appliquée /
  à appliquer », « Indicateur · Cockpit commercial », « Pas encore mesurée »), « objectif <cible> », interrupteur.
- **Fenêtre d'un SLA** : « SLA <ID> · <étape> », nom, état et explication ; Démarre, S’arrête, Objectif, Escalade ; « Seuils »
  (Bientôt dû, En retard, Critique, avec − / +, seulement ceux que le référentiel prévoit) ; « Où il apparaît » : « Alertes du CRM »,
  « Copie dans Slack (facultatif) » ; « Pourquoi ce SLA » ; « Rétablir la valeur par défaut » ; « Terminé ».
- Enregistrement : `crm_save_sla_rules(p_value)` ; l'événement `lnp-sla-saved` repousse les réglages au bureau. Hors édition web :
  gardé pour la session (`LNP.save`).
- Mode d'emploi : « les 42 SLA » (il y en a 52, § 17), les seuils ouvrent les alertes du CRM (Cycle de vente › Agir maintenant),
  Slack copie facultative éteinte par défaut, heures de Paris ; « Seuls un administrateur et le responsable commercial
  enregistrent. »

---

## 14. Paramètres › Compte

Gabarit `Account` (contexte « Votre compte, comment se déconnecter, et qui fait partie de l’équipe. ») ; contenu dessiné par
`lnp-web.js` (`account()`, `team()`) ; API `web/api/team.js`. Hors web : « Connexion et équipe » + une phrase d'explication.

- Carte « Connecté » : e-mail, rôle (+ « · lecture seule » pour un lecteur), « Se déconnecter ».
- **« Accès de l’équipe »** (administrateurs) : « Qui peut ouvrir LNP, et ce que chacun peut faire. Invitez quelqu’un, puis envoyez-lui
  son lien. Les écrans que chacun ouvre : l’onglet Accès. Le numéro WhatsApp Business de chacun rattache ses messages aux
  prospects. » `GET /api/team` (403 « Seuls les administrateurs gèrent les accès de l’équipe. ») rend `members` avec dernière
  connexion, compte confirmé, accès, `whatsapp` (`crm_members.whatsapp_number`, 052) et `crm_role`.
  - Invitation : « E-mail » (`nom@exemple.fr`), « Rôle » (défaut Membre), « Inviter » → `{action:"invite"}` (« Saisissez une adresse
    e-mail valide. ») ; encadré « Invitation prête pour <e-mail> » : « Envoyez ce lien à <e-mail> (Slack, e-mail…). Il ouvre LNP et lui
    demande de choisir un mot de passe. Il ne sert qu’une fois ; s’il ne marche plus, créez-en un nouveau ici (Nouveau lien
    d’invitation). », le lien `https://<site>/#lnp-link=<jeton>&type=invite`, « Copier le lien » (→ « Copié »).
  - Tableau **Membre** (e-mail, « (vous) », « Dernière connexion le 3 nov. » / « Invité · ne s’est pas encore connecté ») · **Rôle**
    (sélecteur, désactivé pour soi ; `{action:"role"}`, « Gardez au moins un administrateur. ») · **Fonction** (rôle CRM : un
    sélecteur « Commercial » / « Setter » pour `sales` et `setter` → `{action:"crmrole"}` = `crm_set_member_role` ; sinon
    « Administrateur », « Lecteur » ou « — ») · **WhatsApp Business** (`+33 6 12 34 56 78`, enregistré en quittant le champ →
    `{action:"whatsapp"}` = `crm_set_member_whatsapp`) · actions (pas pour soi) « Lien de réinitialisation » ou « Nouveau lien
    d’invitation » (`{action:"reset"}`) et « Retirer » (`lnpConfirm` « Retirer cette personne ? » · « <e-mail> ne pourra plus se
    connecter à LNP. Son travail reste dans les données partagées. » · « Retirer l’accès » → `{action:"remove"}`).
- Mode d'emploi : le compte et l'équipe au même endroit ; Se déconnecter ; inviter, rôle, lien, retirer ; la colonne WhatsApp
  Business rattache les messages de chaque commercial et setter aux prospects et aux alertes.

---

## 15. Paramètres › Accès

Gabarit `Access` (contexte « Choisissez les écrans que chaque personne peut ouvrir. ») ; `lnp-web.js` (`AREAS`, `applyAccess`,
`drawAccess`), `web/api/_screens.js`, `web/api/team.js` (`action:"access"`).

### 15.1 Les clés

`SCREENS = ["salescockpit", "salescycle", "entrainement", "academie", "simulateur", "crm", "settings", "claude"]` (`crm` = Leads ;
`settings` = Alertes et notifications ; `claude` = le connecteur LNP dans Claude, pas un écran). Défaut : tout sauf `claude` ; un
administrateur a tout. Dérivées (`DERIVED`) : `resultats` (avec un entraînement : Découverte, Maîtrise de l'offre ou Simulateur),
`alertes` (avec `crm` ou `salescycle`). `account` est toujours ouvert ; `access` et `suivi` sont ajoutés pour un administrateur par
`/api/me` et ne s'attribuent pas. Stocké dans `app_metadata.screens` (écrit par le serveur seulement). Migrations d'anciennes listes
(`accessOf`) : sans la marque `v2026-11-06`, `crm` ouvre `salesday` et `entrainement`, `entrainement` ouvre `academie` ; sans
`v2026-11-09`, `crm` ouvre `salescycle` ; sans `v2026-11-11`, un entraînement ouvre `simulateur` ; **`salesday` ouvre
`salescycle`** ; les clés inconnues sont ignorées.

### 15.2 Effet dans la page (`applyAccess`)

Une feuille de style cache les entrées de la barre latérale et les onglets des écrans fermés et les groupes vides ; un clic vers un
écran fermé est bloqué et renvoie au premier écran ouvert de son espace (Paramètres → Compte) ; à l'ouverture, un écran courant
fermé renvoie au premier écran ouvert. `html.lnp-admin` pour un administrateur. Cela cache des écrans, pas des données.

### 15.3 Le panneau

Hors web : « Les accès se gèrent dans la version web » · « Connectez-vous à LNP sur le web avec un compte administrateur pour choisir
les écrans que chaque personne peut ouvrir. » En web (administrateur) : « Chargement de l’équipe… », carte « Qui ouvre quoi » (tout
ouvert par défaut, décocher un espace ou un écran, administrateurs restreignables mais gardant Accès, personne ne change ses propres
accès, case Claude réservée aux administrateurs par défaut, écrans et non données) ; moins de deux membres : « Personne à configurer
pour l’instant ». Une carte par membre : e-mail (« (vous) »), « <rôle> · dernière connexion le … » / « · ne s’est pas encore
connecté », état « Enregistrement… » / « Enregistré » / erreur, « Tout ouvrir » (`access: null`). Pour soi : « C’est vous : un autre
administrateur peut changer vos accès. » Grille d'espaces (`AREAS`) :

| Espace | Groupes et écrans |
|---|---|
| Ventes | « Ventes » : Cockpit commercial, Cycle de vente, Leads ; « Entraînement » : Découverte, Maîtrise de l’offre, Simulateur |
| Paramètres | « Paramètres » : Alertes et notifications |
| Claude | Connecteur Claude |

Chaque espace a une case « tout » (indéterminée si partiel) et « k/n » ; chaque case enregistre aussitôt (`POST /api/team
{action:"access", user_id, access:[…]}` ; « Vous ne pouvez pas changer vos propres accès. Demandez à un autre administrateur. »).
Effet au prochain chargement de la personne.

---

## 16. Récapitulatif : qui peut faire quoi

| Action | Écran | RPC / API | `admin` | `sales_lead` | `sales` | `setter` | `viewer` |
|---|---|---|---|---|---|---|---|
| Déclarer ou corriger une issue | Cycle de vente, fiche, Statut | `crm_declare_outcome` | ✓ | ✓ | ses cycles | cycles de ses personnes | — |
| « Fait » / note | Cycle de vente, À faire | `crm_add_note` | ✓ | ✓ | ses cycles | cycles de ses personnes | — |
| Clore, rouvrir, déplacer | Statut ▾ | `crm_close_cycle`, `crm_reopen_cycle`, `crm_move_cycle` | ✓ | ✓ | ses cycles | cycles de ses personnes | — |
| Changer de commercial | fiche, colonne Commercial | `crm_reassign_cycle` | ✓ (seul à voir le bouton) | serveur ✓ | — | — | — |
| Échéancier, paiement, remboursement, retrait | Encaissement | `crm_set_payment_plan`, `crm_add_payment`, `crm_add_refund`, `crm_delete_payment` | ✓ | ✓ | ses cycles | cycles de ses personnes | — |
| Voir une analyse | fiche, pastilles | `crm_ca_board`, `crm_ca_record` | ✓ | ses cycles | ses cycles | — | — |
| Ajouter une transcription, relancer | fiche, pastilles | `crm_ca_add_transcript`, `crm_ca_retry` | ✓ | ses cycles | ses cycles | serveur : cycles de ses personnes (`crm_owns_cycle`), mais l'appel n'est pas dans son tableau | — |
| Corriger une lettre | Analyse › Découverte | `crm_ca_correct` | ✓ | — | — | — | — |
| Action du setter | fiche › Setter | `crm_setter_action` | ✓ | — | — | ses personnes | — |
| Choisir le setter | fiche › Setter | `crm_set_setter` | ✓ | — | — | — | — |
| Nouveau prospect | Leads › Prospects | `crm_create_lead` | ✓ | — | ✓ | ✓ | — |
| Préférences (journée) | Cycle de vente | `crm_set_pref` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Réglages des SLA | Paramètres › Alertes | `crm_save_sla_rules` | ✓ | ✓ | — | — | — |
| Inviter, rôle, fonction, WhatsApp, lien, retirer | Compte | `/api/team` | ✓ (rôle d'équipe) | — | — | — | — |
| Accès par écran | Accès | `/api/team` `access` | ✓ (rôle d'équipe) | — | — | — | — |

---

## 17. Écarts entre le code, `CLAUDE.md` et `docs/crm/` (le code fait foi)

Avec `CLAUDE.md` :
- Barre latérale : l'écran `crm` s'appelle « Leads », « Suivi des commerciaux » s'affiche « Entraînement de l’équipe », l'onglet
  Paramètres › Alertes s'appelle « Alertes et notifications ».
- Analyse d'appel, Objections : `CLAUDE.md` décrit deux versions, un panneau à gauche du tableau (`gSide`) et une fenêtre sous la
  lettre (`gPanel`, `.ob-pop`, 2 répliques avant et 4 après) ; le code n'a que `gSide` (1 réplique avant, 2 ou 3 après) ; `gPanel`
  n'existe pas, `.ob-pop` n'a que du style.
- « Pas un appel de vente » (`not_sales_call`, C1b, 2026-11-23) : aucune source sur `main` (seulement des fichiers compilés
  `__pycache__` d'une branche dans `call-analysis/lite/`) ; l'écran ne traduit pas ce code (il afficherait « Not sales call »).
- `WHY.health_absent_share` dit « au moins 3, plus de 5 % » alors que le seuil est passé à 20 % le 2026-11-23.
- Cockpit › Exécution, Qualité, Impact : le Mode d'emploi annonce des périodes de 7, 30, 90 ou 180 jours ; le code n'offre que 7, 30 et
  90 jours. Qualité ne montre que trois portes de qualification (Métier, Financement, Décision et timing) alors que l'analyse d'appel en
  a cinq depuis la règle 2.3.
- Simulateur : le Mode d'emploi dit « le mode objections ne l'est pas [analysé] » ; le code et `CLAUDE.md` (2026-11-15) l'analysent.
- Paramètres › Alertes et `web/kb/build_kb.mjs` parlent de « 42 SLA » ; le catalogue en a 52 (avec SE-1 à SE-10).
- Mode d'emploi de Leads : « agissez sur plusieurs prospects à la fois » et « Cliquez sur un en-tête pour trier (Alertes…) » : il
  n'y a ni action groupée ni colonne Alertes.
- Les fichiers sources `app/crm/*.js` et les générateurs sont en retard sur la page (voir l'introduction) : les reporter avant tout
  `./build.sh`.

Incohérences observées dans le code, à reproduire ou corriger en connaissance de cause :
- **Notifications du navigateur** : seul l'écran Alertes, devenu inatteignable, demande la permission ; personne ne peut plus
  l'accorder depuis LNP.
- `decorate()` pose son bandeau seulement dans Ma journée, inatteignable ; `LNP_SALESDAY`, les gabarits `SalesDay` et `Alertes`, la
  vue v6 `LNP_SC_DOC` (370 Ko) et le tableau en colonnes du Pipeline (`cxPipeline`, `cxKpis`) sont du code mort dans la page.
- Compte › Fonction : un membre invité devient `sales_lead` (`011`), affiché « Lecteur » et non modifiable (`crm_set_member_role` ne
  change que `sales`, `setter`, `viewer`).
- `sales_lead` passe `crm_require` sur n'importe quel cycle mais ne voit que les siens (048).
- Le document du CRM garde dans sa barre latérale cachée la marque et le nom d'utilisateur du CRM d'origine (un autre nom de produit) :
  invisible, mais contraire à la règle « aucun nom d'une autre entreprise » ; à retirer.
- Le groupe de SLA « Setting » et la phrase « Aucun sales n’a encore enregistré de tentative » (Formateur de Maîtrise de l'offre)
  sont des mots anglais visibles.
- La copie de `sla_rules.js` dans `app/lnp.html` diffère de `supabase/functions/_shared/sla_rules.js` sur cinq textes d'escalade
  (« l’administrateur est alerté » au lieu d'un prénom).
- `web/kb/build_kb.mjs` lit d'abord `gabarits/<écran>.dc.html` : pour SalesCockpit, Settings, Account, Access, SuiviCommerciaux,
  Alertes et CRM, le connecteur Claude sert un Mode d'emploi plus ancien que celui de la page (CRM : l'ancien « faites glisser une
  carte »).
- Les erreurs de relance et de correction d'une analyse s'affichent dans une boîte `alert()` du navigateur.

Avec `docs/crm/` : `16-sales-cycle-screen.md` décrit la vue v6 (KPI, tableau, axe Depuis le RDV / Calendrier), remplacée par le
bureau en file (§ 4) ; `11-crm-frontend.md` décrit un Pipeline à glisser, remplacé par le tableau d'une ligne par lead.
`call-analysis/docs/SCREEN_SPEC.md` : découverte par registre sur une échelle de temps, gestes A · I · E · M, analyse en plein écran.

---

## 18. Non déterminé à partir du dépôt

- Qui remplit `crm_alerts` (lu par Encaissements à risque et l'abonnement Realtime du CRM) : aucun fichier n'y insère de ligne ; en
  pratique, Encaissements à risque montre les prochaines étapes en retard (code « SLA »).
- Le contenu exact des dossiers d'analyse (`crm_ca_record`) dépend du moteur (`call-analysis/docs/OUTPUT_CONTRACT.md`) : seuls les
  champs lus par l'écran sont décrits ici.
- Le rendu réel du Simulateur à la voix (ElevenLabs absent en production, chapitre 08) et le comportement d'un rôle `setter` dans le
  bureau n'ont pas été exercés.

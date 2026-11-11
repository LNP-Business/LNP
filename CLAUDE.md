# LNP · consignes du dépôt

LNP est l'application commerciale de Les Nouveaux Profs : une page unique (HTML autonome) publiée sur Vercel, avec un back end
Supabase. Présentation, marque et installation : `LNP.md`. Ne jamais toucher aux dépôts ni aux projets Supabase d'autres
entreprises.

## Règles

- **Tout ce qu'une personne lit est en français** : libellés, boutons, infobulles, messages, fenêtres « Mode d'emploi », dates
  et nombres au format `fr-FR`. Termes : `docs/lnp/GLOSSAIRE.md`. Pas d'anglicisme quand un mot français courant existe.
- Ne jamais écrire « closer » ni « closing » : « commercial », « conclure », « vente ».
- L'entreprise est **LNP** (Les Nouveaux Profs). LNP est un projet à part entière : aucun nom d'une autre entreprise ou d'un autre
  projet, ni dans ce qu'on lit, ni dans le code (identifiants, chemins, commentaires), ni dans la documentation.
- Heure de référence : **Europe/Paris** (fenêtres des alertes, `crm_settings.sla_alerts.window_tz`, migration 051).
- Seul ce que la personne lit est traduit : identifiants, clés, valeurs comparées dans le code (`'won'`, `"held"`…), types
  d'événements et noms de champs restent en anglais.
- Toute suppression demande confirmation dans une fenêtre (`S.confirm` / `window.lnpConfirm` dans la page, `lnpAsk` dans le CRM).
- Ne jamais mettre de clé dans le dépôt. Les secrets du CRM sont des secrets des fonctions Supabase (`docs/crm/setup.md`) ;
  ne jamais les demander dans une conversation.

## ⚠️ Interface en production : `app/lnp.html` fait foi (2026-11-10)

L'interface actuelle (passes Impeccable : phases 1 à 3, C1 à C13, D1 à D10, écran Cycle de vente à part) a été faite
directement dans la page construite `app/lnp.html` et n'est **pas encore reportée dans les générateurs** (`app/gen_*.py`,
`gabarits/`, `uploads/crm_source.html`, modules…). Tant que ce report n'est pas fait :

- **ne pas lancer `./build.sh`** : il régénère `app/lnp.html` depuis les générateurs et effacerait cette interface ;
- modifier `app/lnp.html` lui-même, puis `python3 web/build_web.py` (écrit `web/public/index.html` et
  `web/public/docs/lnp-docs.<build>.js`) et `node web/kb/build_kb.mjs` ;
- les écrans en cadre (CRM, Cycle de vente, Découverte, Maîtrise de l'offre, Résultats, Suivi) sont dans un fichier à part,
  chargé seulement après la connexion et gardé en cache (`web/public/docs/`, `vercel.json`) ;
- `app/EXPECTED.sha256` décrit l'ancienne référence : `./build.sh --verify` ne s'applique pas.

## Construire la page

Prérequis : Python 3.10+, Node 18+.

```bash
./build.sh            # app/lnp.html, puis web/public/index.html et web/api/_kb.json
./build.sh --verify   # même chose, puis comparaison avec app/EXPECTED.sha256
```

Ne mettre à jour `EXPECTED.sha256` que lorsque Romain valide une nouvelle référence.

1. **Écrans** (`app/`, dans cet ordre) : `harmonize.py` (cadre des Paramètres et du CRM), `gen_access.py` (Compte, Accès),
   `gen_salescockpit.py` (Cockpit commercial), `gen_salesday.py` (Ma journée), `gen_alertes.py` (Alertes), `gen_training.py`, `nav.py` (barre latérale). Ils écrivent les
   gabarits `gabarits/*.dc.html` ; l'en-tête commun est `gabarits/Shell.base.html`, le bouton « i » et sa fenêtre
   viennent de `app/shell.py`.
2. **Assemblage** : `build.py` réunit les gabarits, `store.js` (`window.LNP` : confirmation des suppressions), `crm/data.js`, le CRM (`crm_doc.html`), le module
   du Cockpit (`sales_v2.json`) et celui de Ma journée (`salesday_module.js`), puis applique `edition.json` (écrans gardés, nom,
   logo, couleurs, polices).
3. **Édition web** : `web/build_web.py` écrit `web/public/index.html` ; `web/kb/build_kb.mjs` écrit `web/api/_kb.json` (les modes
   d'emploi des écrans, lus par le connecteur Claude).

Fichiers intermédiaires figés (entrées du build, non régénérés par `build.sh`) :
- `app/sales_v2.json` (Cockpit commercial) : modifier `proposal/sales-cockpit-v2.html`, puis `python3 app/gen_sales_v2.py`.
- `app/crm_doc.html` (le CRM) : modifier `uploads/crm_source.html` (source du CRM, dictionnaire français, langue fixée en
  français), `app/gen_crm.py` (ses retouches, vérifiées par des assertions), `docs/crm/reference/sales-cycle-v6.html` (vue Cycle
  de vente), `app/crm/*.js` (données, encaissements, analyse d'appel), puis `python3 app/gen_crm.py`.
- Les gabarits `*.pre-hz.dc.html` : modifier ceux-là (ou le générateur), jamais le `.dc.html` généré.

## Où changer quoi

- Barre latérale (groupes, entrées, logo) : `app/nav.py` ; nom, logo, couleurs, polices : `edition.json`.
- Cockpit commercial : `proposal/sales-cockpit-v2.html` + `app/gen_sales_v2.py` ; son mode d'emploi : `gen_salescockpit.py`.
  Onglets Exécution, Qualité, Impact : `app/sales_exec_module.js`, onglets dans `gen_salescockpit.py` et
  `salescockpit_logic.js`, chiffres de `crm_sales_execution` (migration 050) ; test `node app/sales_exec_test.js $PWD/app/lnp.html <dossier>`.
- Ma journée est fusionnée dans Cycle de vente (Romain, 2026-11-10) : plus d'entrée dans la barre latérale, `#salesday` ouvre
  Cycle de vente sur « Agir maintenant », un accès « salesday » donne Cycle de vente (`web/api/_screens.js`). Dans l'écran
  (`LNP_SB_DOC`, dans `LNP_CRM_DOC` de `app/lnp.html`) : « Aujourd'hui » et « Fait aujourd'hui », « Demain » (touche D) et
  « Passer » (touche P), la journée gardée dans les préférences `salesday.<jour>`. Test `node app/cycle_day_test.js $PWD/app/lnp.html <dossier>`.
  Le module de Ma journée (`app/salesday_module.js`, `gen_salesday.py`) n'est plus affiché.
- Alertes (Romain, 2026-11-09 : le CRM est la base des notifications, pas Slack) : `sla-tick` ouvre, fait monter et ferme les
  alertes toutes les 5 min (`crm_sla_alerts`, `crm_sync_sla_alerts`, migration 053) ; un commercial voit les alertes de ses
  prospects, un administrateur celles de toute l'équipe (`crm_sla_alerts_open`). Écran, pastille, bandeau et notification du
  navigateur : `app/alerts_module.js` + `gen_alertes.py` ; les alertes se traitent dans Cycle de vente › « Agir maintenant ». Slack n'est
  qu'une copie facultative, éteinte par défaut (`sla_rules.js`). Test `node app/alertes_test.js $PWD/app/lnp.html <dossier>`.
- Suivi du setter (Romain, 2026-11-09, `docs/crm/19-setting.md`, migration 054) : un statut setter par lead, gardé sur la
  personne (`crm_people.setting_*`) ; actions `crm_setter_action`, réactions à iClosed par un déclencheur sur `crm_calls`, leads
  des funnels par la fonction `lead-in` (`mappers/funnel.ts`, `crm_apply_leads`) ou « + Nouveau prospect » (`crm_create_lead`) ;
  rôle `setter` ; alertes SE-1 à SE-10 (`sla_rules.js`, `sla-tick`). Écran Prospects et fiche : `app/crm/setting_ui.js` ; test
  `node app/crm/setting_live.js $PWD/app/lnp.html <dossier>`.
- Entraînement (groupe de la barre latérale, écrans écrits par `gen_training.py`, applications de `app/training/` injectées
  par `build.py`) :
  - Découverte : `entrainement.html`, ses cas `coup_lnp.json` et `lettre_lnp.json` ; test `training_test.js`.
  - Maîtrise de l'offre (« Académie sales LNP ») : `academie.html` et ses 100 cas `academie_contenu.json` ; pas de correction
    par Claude (Romain, 2026-11-08) : la réponse est validée puis auto-corrigée avec la grille et le corrigé ; progression
    `crm_academy_progress` ; test `academie_test.js`.
  - Résultats : chaque exercice terminé est gardé dans `crm_training_results` (migration 049 : ajout seulement, jamais modifié
    ni effacé) via `results_log.js` ; « Mes résultats » et « Suivi des
    commerciaux » (administrateurs) sont `resultats.html` en deux modes, sur `crm_training_dashboard(p_days)` ; test `results_test.js`.
  - Tests : `node app/training/<test>.js $PWD/app/lnp.html <dossier>`.
- CRM, Cycle de vente, encaissements : voir les fichiers figés ci-dessus ; règles SLA : `supabase/functions/_shared/sla_rules.js`
  (une seule source pour l'écran, pour `sla-tick` et pour le catalogue de Paramètres › Alertes ; réglages enregistrés dans
  `crm_settings.sla_rules`, migration 044).
- Étapes du lead (Romain, 2026-11-11) : une seule liste pour Leads (colonne Progrès, « Répartition par étape » et son filtre),
  la fiche du lead et Cycle de vente (fiche, filtre « Étape », en-tête, « À faire ») : `LNP_ETAPES`, écrit une fois et injecté dans
  le document du CRM et dans celui de Cycle de vente de `app/lnp.html`. Ligne principale (RDV pris → 1er contact → appel
  d'éligibilité R1 facultatif → confirmation de présence → appel honoré R2 → décision → payé) et deux branches : « Rattrapage »
  (absence ou silence après le RDV pris ; sortie Injoignable après 6 relances) et « Relance après refus » (un « non » après un appel tenu ; perdu sans appel tenu = « Perdu », sans branche ; le lead reste « Clos »
  dans Cycle de vente ; disqualifié 6 mois après le refus sans nouveau RDV : `crm_refusal_tick`, migration 055, chaque jour).
  Tests `node app/crm/etapes_live.js $PWD/app/lnp.html <dossier>` et `tests/refus_six_mois_test.sql`.
- Fiche prospect et Ma journée : le cycle de vente en fil vertical et « À faire » (`app/crm/lead_feed.js`) ; déplacements du
  Pipeline et formulaire d'issue (`app/crm/outcome_ui.js`, `lnpMove` ; clôture et réouverture : migration 045 ;
  déplacement sans action et règles des tours : migration 047, `crm_move_cycle`).
- Analyse d'appel (écran) : `app/crm/call_analysis.js`, `call_analysis_view.js`, `transcript_parse.js` ; les codes du moteur
  sont traduits à l'affichage, les citations restent mot pour mot.
- Paramètres › Alertes : `gabarits/Settings.pre-hz.dc.html` ; Compte et Accès : `gen_access.py` et `web/public/lnp-web.js`.
- Connexion, équipe, accès par écran, interface `window.claude.use("user" | "crm")` : `web/public/lnp-web.js`.

## Édition web (Vercel + Supabase)

- `web/api/` : `config.js` (URL publique et clé anonyme), `me.js`, `team.js` (administrateurs : inviter, changer un rôle, lien de
  réinitialisation, retirer ; les liens sont rendus à l'administrateur au format `/#lnp-link=…`), `bootstrap.js`
  (premier administrateur, actif seulement tant que `BOOTSTRAP_TOKEN` existe).
- Version de la page : `web/build_web.py` inscrit un identifiant de build dans `index.html` (`LNP_BUILD`) et dans
  `web/public/version.json` ; `lnp-web.js` recharge une page restée en cache d'un navigateur (une fois, puis bandeau « Recharger »).
- Accès par écran (Paramètres › Accès, administrateurs) : clés `salescockpit`, `salescycle`, `entrainement`, `academie`, `crm`,
  `settings`, `claude` (`web/api/_screens.js`), stockées dans `app_metadata.screens` de chaque compte ; `resultats` suit les
  entraînements ouverts, `suivi` (Suivi des commerciaux) et `access` sont réservés aux administrateurs (`web/api/me.js`).
- **Connecteur Claude** (`web/api/mcp.js`, OAuth `web/api/oauth.js`, doc `docs/crm/17-claude-connector.md`) : 10 outils de lecture
  (prospects, pipeline, préparation et analyse d'appel, performance, modes d'emploi, règles d'alerte) et 2 outils d'écriture pour les
  administrateurs (note sur un prospect, issue d'un appel), toujours avec le jeton de la personne (RLS). Ne jamais renvoyer une
  transcription. Tests : `cd web && npm ci && npm test`.

## Back end du CRM

Spécification : `docs/crm/` (commencer par `docs/crm/README.md`). Les données du CRM sont dans les tables `crm_*`
(`web/supabase/003_crm_core.sql` et suivants), les écritures du navigateur passent par les fonctions `crm_*` (`004_crm_rpc.sql`).
- Fonctions Edge (`supabase/functions/`, `verify_jwt = false`, chacune vérifie son jeton ou sa signature) : `iclosed-in`,
  `fathom-in`, `whatsapp-in`, `whop-in`, `lead-in` (stockent la requête brute), `process-inbox` (chaque minute, `006_crm_cron.sql`),
  `crm-import` (imports et Fathom toutes les heures), `sla-tick` (alertes du CRM toutes les 5 min, copie Slack en option), `callqa-llm`.
- **Le CRM LNP est la seule source de vérité des statuts** (Romain, 2026-11-11, migration 059) : d'iClosed, on ne garde que le
  lead, la date des RDV (déplacements, annulations) et le montant d'une vente, affiché pour information ; jamais honoré, absent,
  gagné, perdu ni un paiement. Webinaire : au setter seulement si présent sans RDV, ou absent sans réponse (48 h au webinaire,
  24 h au RDV de vente), `crm_setting_tick` ; test `web/supabase/tests/source_de_verite_test.sql`.
- Messages : **WhatsApp Business seulement** (Romain, 2026-11-09 : pas de Sendblue). API officielle en coexistence,
  `whatsapp-in` + `mappers/whatsapp.ts` (`docs/crm/07-integration-whatsapp.md`, migration 052) ; le numéro WhatsApp Business de
  chaque commercial et setter (Paramètres › Compte › Accès de l'équipe) rattache ses messages.
- Libellés en base (étapes, motifs, règles d'alerte, prochaines actions) : en français ; `034_lnp_fr_labels.sql` met à jour une
  base existante.
- Tests SQL sur un Postgres local : `web/supabase/tests/run.sh` ; données : `node app/crm/data.test.js` ; Cycle de vente :
  `node app/crm/sales_cycle_accept.js $PWD/app/lnp.html <dossier>` ; fonctions : `deno test --allow-env --allow-read supabase/tests`.
- La base en ligne ne change qu'après accord de Romain sur la PR.

## Analyse d'appel

Le moteur (`call-analysis/`) a ses propres règles : lire `call-analysis/CLAUDE.md` avant d'y toucher. Le modèle extrait et cite,
le code décide et note. Les consignes envoyées au modèle (`call-analysis/engine/lnp_callqa/prompts/*.md`) restent en anglais :
les traduire changerait l'analyse. Le worker tourne dans `.github/workflows/call-analysis.yml`.
Qualification du lead (règle des portes 2.2 : Métier, Financement, Décision et timing ; `call-analysis/qualification`) : chaque R1 analysé est qualifié par le
worker de l'analyse (`callqa_worker/qualif.py`, migration 046) et la qualification s'affiche dans l'analyse d'appel.
Moteur allégé (`call-analysis/lite`, objectif ≤ 0,10 USD par appel) : cinq questions au modèle sur l'appel entier
(phases, questions de découverte, écart, présentation de l'offre, objections après la présentation), le code vérifie
chaque citation et calcule les notes avec les fonctions du moteur de référence. Choix par analyse :
`update crm_ca_config set engine = 'lite';` (retour : `engine = 'full'`, valeur par défaut ; migration 035). Tests :
`cd call-analysis/lite && python3 -m pytest -q tests` ; écarts avec la méthodologie : `call-analysis/lite/README.md`.

## Vérifier après un changement

Ouvrir `app/lnp.html` dans un navigateur (ou Playwright) et vérifier, sans erreur dans la console et sans texte anglais :
Cockpit commercial (7 j, 30 j, 8 sem.), Cycle de vente (Aujourd'hui, Demain, Passer), CRM (Pipeline, Prospects, Cycle de vente, fiche prospect, fenêtre
d'encaissement), Paramètres (Alertes, Compte ; Accès en édition web) et chaque « Mode d'emploi ».

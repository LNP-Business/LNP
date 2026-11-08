# LNP · consignes du dépôt

LNP est l'application commerciale de Les Nouveaux Profs : une page unique (HTML autonome) publiée sur Vercel, avec un back end
Supabase. Présentation, marque et installation : `LNP.md`. Ne jamais toucher aux dépôts ni aux projets Supabase d'autres
entreprises (SKL OS, Clarity…).

## Règles

- **Tout ce qu'une personne lit est en français** : libellés, boutons, infobulles, messages, fenêtres « Mode d'emploi », dates
  et nombres au format `fr-FR`. Termes : `docs/lnp/GLOSSAIRE.md`. Pas d'anglicisme quand un mot français courant existe.
- Ne jamais écrire « closer » ni « closing » : « commercial », « conclure », « vente ».
- L'entreprise est **LNP** (Les Nouveaux Profs). Aucune mention de SKL ni d'ALKIMIY dans ce qu'on lit (les noms techniques
  internes `SKL_*`, `skl-os/`, `skl-web.js` restent : ce sont des identifiants).
- Seul ce que la personne lit est traduit : identifiants, clés, valeurs comparées dans le code (`'won'`, `"held"`…), types
  d'événements et noms de champs restent en anglais.
- Toute suppression demande confirmation dans une fenêtre (`S.confirm` / `window.sklConfirm` dans la page, `sklAsk` dans le CRM).
- Ne jamais mettre de clé dans le dépôt. Les secrets du CRM sont des secrets des fonctions Supabase (`docs/crm/setup.md`) ;
  ne jamais les demander dans une conversation.

## Construire la page

Prérequis : Python 3.10+, Node 18+.

```bash
./build.sh            # skl-os/skl-os-en.html, puis web/public/index.html et web/api/_kb.json
./build.sh --verify   # même chose, puis comparaison avec skl-os/EXPECTED.sha256
```

Ne mettre à jour `EXPECTED.sha256` que lorsque Romain valide une nouvelle référence.

1. **Écrans** (`skl-os/`, dans cet ordre) : `harmonize.py` (cadre des Paramètres et du CRM), `gen_access.py` (Compte, Accès),
   `gen_salescockpit.py` (Cockpit commercial), `gen_salesday.py` (Ma journée), `nav.py` (barre latérale). Ils écrivent les
   gabarits `skl-en/project/*.dc.html` ; l'en-tête commun est `skl-en/project/Shell.base.html`, le bouton « i » et sa fenêtre
   viennent de `skl-os/shell.py`.
2. **Assemblage** : `build.py en` réunit les gabarits, `store.js`, `kr_view.js`, `crm/data.js`, le CRM (`crm_doc.html`), le module
   du Cockpit (`sales_v2.json`) et celui de Ma journée (`salesday_module.js`), puis applique `edition.json` (écrans gardés, nom,
   logo, couleurs, polices).
3. **Édition web** : `web/build_web.py` écrit `web/public/index.html` ; `web/kb/build_kb.mjs` écrit `web/api/_kb.json` (les modes
   d'emploi des écrans, lus par le connecteur Claude).

Fichiers intermédiaires figés (entrées du build, non régénérés par `build.sh`) :
- `skl-os/sales_v2.json` (Cockpit commercial) : modifier `proposal/sales-cockpit-v2.html`, puis `python3 skl-os/gen_sales_v2.py`.
- `skl-os/crm_doc.html` (le CRM) : modifier `uploads/ALKIMIY_Lite.html` (source du CRM, dictionnaire français, langue fixée en
  français), `skl-os/gen_crm.py` (ses retouches, vérifiées par des assertions), `docs/crm/reference/sales-cycle-v6.html` (vue Cycle
  de vente), `skl-os/crm/*.js` (données, encaissements, analyse d'appel), puis `python3 skl-os/gen_crm.py`.
- Les gabarits `*.pre-hz.dc.html` : modifier ceux-là (ou le générateur), jamais le `.dc.html` généré.

## Où changer quoi

- Barre latérale (groupes, entrées, logo) : `skl-os/nav.py` ; nom, logo, couleurs, polices : `edition.json`.
- Cockpit commercial : `proposal/sales-cockpit-v2.html` + `skl-os/gen_sales_v2.py` ; son mode d'emploi : `gen_salescockpit.py`.
- Ma journée : `skl-os/salesday_module.js` + `gen_salesday.py`.
- Entraînement (groupe de la barre latérale, écrans écrits par `gen_training.py`, applications de `skl-os/training/` injectées
  par `build.py`) :
  - Découverte : `entrainement.html`, ses cas `coup_lnp.json` et `lettre_lnp.json` ; test `training_test.js`.
  - Maîtrise de l'offre (« Académie sales LNP ») : `academie.html` et ses 100 cas `academie_contenu.json` (copiés dans
    `web/api/_academie.json` par `build.sh`) ; correction par Claude : `web/api/academie.js` et `_academie.js` (consigne du
    cahier, côté serveur), progression `crm_academy_progress` ; test `academie_test.js`.
  - Résultats : chaque exercice terminé est gardé dans `crm_training_results` (migration 049 : ajout seulement, jamais modifié
    ni effacé ; une note de Claude n'est écrite que par le serveur) via `results_log.js` ; « Mes résultats » et « Suivi des
    commerciaux » (administrateurs) sont `resultats.html` en deux modes, sur `crm_training_dashboard(p_days)` ; test `results_test.js`.
  - Tests : `node skl-os/training/<test>.js $PWD/skl-os/skl-os-en.html <dossier>`.
- CRM, Cycle de vente, encaissements : voir les fichiers figés ci-dessus ; règles SLA : `supabase/functions/_shared/sla_rules.js`
  (une seule source pour l'écran, pour `sla-tick` et pour le catalogue de Paramètres › Alertes ; réglages enregistrés dans
  `crm_settings.sla_rules`, migration 044).
- Fiche prospect et Ma journée : le cycle de vente en fil vertical et « À faire » (`skl-os/crm/lead_feed.js`) ; déplacements du
  Pipeline et formulaire d'issue (`skl-os/crm/outcome_ui.js`, `sklMove` ; clôture et réouverture : migration 045 ;
  déplacement sans action et règles des tours : migration 047, `crm_move_cycle`).
- Analyse d'appel (écran) : `skl-os/crm/call_analysis.js`, `call_analysis_view.js`, `transcript_parse.js` ; les codes du moteur
  sont traduits à l'affichage, les citations restent mot pour mot.
- Paramètres › Alertes : `skl-en/project/Settings.pre-hz.dc.html` ; Compte et Accès : `gen_access.py` et `web/public/skl-web.js`.
- Connexion, équipe, accès par écran, interface `window.claude.use("db" | "user" | "crm" | "assets")` : `web/public/skl-web.js`.

## Édition web (Vercel + Supabase)

- `web/api/` : `config.js` (URL publique et clé anonyme), `me.js`, `team.js` (administrateurs : inviter, changer un rôle, lien de
  réinitialisation, retirer ; les liens sont rendus à l'administrateur au format `/#skl-link=…`), `files.js`, `bootstrap.js`
  (premier administrateur, actif seulement tant que `BOOTSTRAP_TOKEN` existe).
- Version de la page : `web/build_web.py` inscrit un identifiant de build dans `index.html` (`SKL_BUILD`) et dans
  `web/public/version.json` ; `skl-web.js` recharge une page restée en cache d'un navigateur (une fois, puis bandeau « Recharger »).
- Accès par écran (Paramètres › Accès, administrateurs) : clés `salescockpit`, `salesday`, `entrainement`, `academie`, `crm`,
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
  `fathom-in`, `sendblue-in`, `whop-in` (stockent la requête brute), `process-inbox` (chaque minute, `006_crm_cron.sql`),
  `crm-import` (imports et Fathom toutes les heures), `sla-tick` (alertes SLA vers Slack toutes les 5 min), `callqa-llm`.
- Libellés en base (étapes, motifs, règles d'alerte, prochaines actions) : en français ; `034_lnp_fr_labels.sql` met à jour une
  base existante.
- Tests SQL sur un Postgres local : `web/supabase/tests/run.sh` ; données : `node skl-os/crm/data.test.js` ; Cycle de vente :
  `node skl-os/crm/sales_cycle_accept.js $PWD/skl-os/skl-os-en.html <dossier>` ; fonctions : `deno test --allow-env --allow-read supabase/tests`.
- La base en ligne ne change qu'après accord de Romain sur la PR.

## Analyse d'appel

Le moteur (`call-analysis/`) a ses propres règles : lire `call-analysis/CLAUDE.md` avant d'y toucher. Le modèle extrait et cite,
le code décide et note. Les consignes envoyées au modèle (`call-analysis/engine/alkimiy_callqa/prompts/*.md`) restent en anglais :
les traduire changerait l'analyse. Le worker tourne dans `.github/workflows/call-analysis.yml`.
Qualification du lead (règle des portes 2.2 : Métier, Financement, Décision et timing ; `call-analysis/qualification`) : chaque R1 analysé est qualifié par le
worker de l'analyse (`callqa_worker/qualif.py`, migration 046) et la qualification s'affiche dans l'analyse d'appel.
Moteur allégé (`call-analysis/lite`, objectif ≤ 0,10 USD par appel) : cinq questions au modèle sur l'appel entier
(phases, questions de découverte, écart, présentation de l'offre, objections après la présentation), le code vérifie
chaque citation et calcule les notes avec les fonctions du moteur de référence. Choix par analyse :
`update crm_ca_config set engine = 'lite';` (retour : `engine = 'full'`, valeur par défaut ; migration 035). Tests :
`cd call-analysis/lite && python3 -m pytest -q tests` ; écarts avec la méthodologie : `call-analysis/lite/README.md`.

## Vérifier après un changement

Ouvrir `skl-os/skl-os-en.html` dans un navigateur (ou Playwright) et vérifier, sans erreur dans la console et sans texte anglais :
Cockpit commercial (7 j, 30 j, 8 sem.), Ma journée, CRM (Pipeline, Prospects, Cycle de vente, fiche prospect, fenêtre
d'encaissement), Paramètres (Alertes, Compte ; Accès en édition web) et chaque « Mode d'emploi ».

# 06 · Build, design, langue et tests

## Construire la page

### La règle actuelle : `app/lnp.html` fait foi

Depuis le 10 novembre 2026, l'interface (passes de design phases 1 à 3, C1 à C13, D1 à D10, écran Cycle de vente, Leads, analyse
d'appel, Entraînement, Simulateur) a été faite **directement dans la page construite `app/lnp.html`**. Elle n'est pas encore
reportée dans les générateurs (`app/gen_*.py`, `gabarits/`, `uploads/crm_source.html`, modules). Tant que ce report n'est pas
fait (`CLAUDE.md`) :

- **ne pas lancer `./build.sh`** : il régénère `app/lnp.html` depuis les générateurs et effacerait l'interface actuelle ;
- un changement d'écran se fait dans `app/lnp.html`, puis :
  ```bash
  python3 web/build_web.py     # écrit web/public/index.html, web/public/docs/lnp-docs.<empreinte>.js, web/public/version.json
  node web/kb/build_kb.mjs     # écrit web/api/_kb.json (les modes d'emploi lus par le connecteur Claude)
  ```
- le Simulateur se met dans `app/lnp.html` par `python3 app/gen_simulateur.py` (idempotent) à partir de
  `app/training/simulateur.html` ;
- `app/EXPECTED.sha256` décrit l'ancienne référence : `./build.sh --verify` ne s'applique pas. L'empreinte à vérifier est celle du
  chapitre 10.

Prérequis : Python 3.10+ (bibliothèque standard seulement), Node 18+ (Node 22 en CI). La page n'a aucune dépendance npm ; `web/` a
les siennes pour l'API et les tests (`npm ci` dans `web/`).

### Ce que fait `web/build_web.py`

| Sortie | Contenu |
|---|---|
| `web/public/index.html` | la page `app/lnp.html`, `lang="fr"`, `<script src="/lnp-web.js">` (connexion, équipe, accès, données réelles), l'identifiant de build `window.LNP_BUILD` |
| `web/public/docs/lnp-docs.<empreinte>.js` | les documents des écrans en cadre (CRM, Cycle de vente, Découverte, Maîtrise de l'offre, Résultats, Suivi), sortis de la page, chargés seulement après la connexion et gardés en cache (`vercel.json`) ; l'ancien fichier est supprimé |
| `web/public/version.json` | `{"build": "<id>"}` : `lnp-web.js` recharge une page restée en cache dans un navigateur (une fois, puis bandeau « Recharger ») |

### La chaîne de construction d'origine (pour mémoire)

`build.sh` enchaîne : 1. les écrans (`app/harmonize.py`, `gen_access.py`, `gen_salescockpit.py`, `gen_salesday.py`,
`gen_alertes.py`, `gen_training.py`, `nav.py`, qui écrivent `gabarits/*.dc.html`) ; 2. l'assemblage (`app/build.py` : gabarits,
`store.js`, `crm/data.js`, le CRM `crm_doc.html`, le module du Cockpit `sales_v2.json`, le module de Ma journée
`salesday_module.js`, puis la marque d'`edition.json`) ; 3. l'édition web (`web/build_web.py`, `web/kb/build_kb.mjs`). Fichiers
figés, régénérés à la main : `app/sales_v2.json` (`python3 app/gen_sales_v2.py`), `app/crm_doc.html` (`python3 app/gen_crm.py`).
Cette chaîne redeviendra la référence quand l'interface y aura été reportée ; d'ici là, elle sert seulement à comprendre d'où
viennent les morceaux de `app/lnp.html`.

## La marque : `edition.json`

C'est le seul fichier à changer pour donner une autre identité à l'application.

| Clé | Rôle | Valeur LNP |
|---|---|---|
| `name` | nom court de l'édition | `LNP` |
| `systems` | systèmes gardés (`ss` = Ventes) | `["ss"]` |
| `settings` | écrans de Paramètres gardés | `Settings.dc.html`, `Account.dc.html`, `Access.dc.html` |
| `home` | écran d'ouverture | `salescockpit` |
| `brand` | nom et sous-titre de la barre latérale (sans `wordmark`) | `["LNP", "Ventes"]` |
| `title` | titre de l'onglet du navigateur | `LNP · Ventes` |
| `wordmark` | nom affiché à côté du logo : début, partie colorée, fin | `["Les ", "Nouveaux", " Profs"]` |
| `logo` | image PNG de la barre latérale et de l'onglet (intégrée en base64 ; 80 px suffisent) | `app/brand/lnp-logo.png` |
| `rename` | remplacements de texte dans toute la page finie, dans l'ordre | anciens noms → `LNP` |
| `recolor.hex` | couleur d'origine → couleur de la marque (insensible à la casse) | 100 couleurs |
| `recolor.rgb` | même chose pour les triplets `rgb()` / `rgba()` | 8 triplets |
| `fonts` | remplacements des polices (noms et liens Google Fonts) | Fraunces, IBM Plex Sans → Poppins |

### La charte LNP (site https://www.lesnouveauxprofs.fr/)

| Nom | Couleur | Usage dans l'application |
|---|---|---|
| nuit | `#1E2A5E` | barre latérale, texte principal, boutons principaux |
| vif | `#2B6CF5` | texte d'accent |
| vif-clair | `#5B8DF7` | accent principal, onglet actif, mot coloré du logo |
| ciel | `#AECBF2` | bordures secondaires, sous-titre de la barre latérale |
| pâle | `#E3ECFB` | bordures des cartes, fonds discrets |
| ardoise | `#5A6478` | texte secondaire |
| cassé | `#F7F8FB` | fond de l'application |
| blanc | `#FFFFFF` | cartes |

Les couleurs de statut (rouge `#B42318`, vert `#2E7D4F`, orange `#B45309`, violet `#5B3A9E`, sarcelle `#0E6E7A`…) ne sont pas
converties : elles portent un sens. Les autres gris d'origine gardent leur luminosité dans la teinte bleu nuit (teinte 226°,
saturation 0,40 sous 30 % de luminosité, 0,16 jusqu'à 80 %, 0,55 au-delà), les ors deviennent des bleus (teinte 221°).
Police : Poppins (titres et texte) ; IBM Plex Mono reste pour les chiffres.

Pour une autre marque : changer `wordmark`, `logo`, `brand`, `title`, recalculer `recolor` (une couleur d'arrivée ne doit jamais être
aussi une couleur de départ) et `fonts`, puis appliquer les mêmes valeurs à `web/public/lnp-web.js` (écran de connexion, servi tel
quel) et à la page de connexion OAuth (`web/api/oauth.js`).

## Langue

- Toute l'interface est en français ; le vocabulaire est fixé par `docs/lnp/GLOSSAIRE.md` (sans anglicisme, jamais « closer »).
- Le CRM n'a qu'une langue : `S.lang = "fr"` dans `uploads/crm_source.html` (dictionnaire `fr:{…}`), sans sélecteur.
- Dates et nombres : `fr-FR` (« 3 nov. », « 1 050 € », « 73 % », « 7 j », « 8 sem. »).
- Seuls les textes lus par une personne sont traduits ; les valeurs stockées et comparées restent en anglais (`won`, `held`…), les
  libellés en base sont traduits (`web/supabase/034_lnp_fr_labels.sql`), les codes du moteur d'analyse sont traduits à l'affichage.
- Les consignes envoyées au modèle d'analyse restent en anglais.

## Tests

| Domaine | Commande | Contenu |
|---|---|---|
| Données du CRM | `node app/crm/data.test.js` | `window.LNP_CRM` (lectures, écritures, libellés français) |
| Transcriptions | `node app/crm/transcript_parse.test.js` | lecture des formats collés, intervenants |
| Écrans | `node <test> $PWD/app/lnp.html <dossier>` (Playwright, Chromium) | Cycle de vente (`app/crm/sales_cycle_accept.js`, `app/cycle_day_test.js`, `app/crm/cycle_fiche_live.js`), étapes et fiche (`app/crm/etapes_live.js`), setter (`app/crm/setting_live.js`), analyse d'appel (`app/crm/fiche_analyse_live.js`, `app/crm/analyse_decouverte_test.js`), alertes (`app/alertes_test.js`), Cockpit (`app/sales_exec_test.js`), Entraînement (`app/training/training_test.js`, `academie_test.js`, `results_test.js`) ; Simulateur sur `app/training/simulateur.html` (`simulateur_test.js`) |
| SQL | `web/supabase/tests/run.sh` (Postgres 16 local, `PGHOST`, `PGUSER`) | 45 fichiers `*_test.sql`, chacun sur une base jetable avec `supabase_stub.sql` |
| Fonctions Edge | `deno test --allow-env --allow-read supabase/tests` | 12 fichiers : ingestion, mappers, import, pipeline, SLA, `callqa-llm`, Simulateur (état, grille, offres, réalisme, routes, variantes) |
| Connecteur et API | `cd web && npm ci && npm test` | OAuth, outils MCP, accès, sur un Supabase en mémoire (`web/tests/`) |
| Analyse d'appel | `python3 -m pytest -q tests` dans `call-analysis/engine`, `lite`, `worker`, `qa` | chapitre 09 |
| Vérification à la main | ouvrir chaque écran | sans erreur dans la console et sans texte anglais (chapitre 10) |

## Intégration continue (`.github/workflows/`)

| Workflow | Déclencheurs | Tâches |
|---|---|---|
| `crm-functions.yml` | push sur `main` ou `crm-*`, PR, touchant `supabase/`, `web/supabase/`, `app/crm/`, `web/api/`, `web/tests/`, `web/package*.json` ; manuel | tests Deno, tests SQL (Postgres 16) et `data.test.js`, tests du connecteur, puis déploiement des fonctions Edge depuis `main` (`supabase functions deploy <f> --no-verify-jwt`, avec `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF`) |
| `call-analysis.yml` | push et PR touchant `call-analysis/` ; toutes les heures à la minute 7 ; manuel (tâche `worker` ou `measure`, effort) | tests du moteur, du moteur allégé, du worker et de la mesure ; le worker qui analyse les appels en file ; la mesure sur le jeu de référence privé `callqa-fixtures` (chapitre 09) |
| `qualification.yml` | push et PR touchant `call-analysis/qualification/` ; manuel | tests de la qualification ; lancement à la demande |

Vercel déploie la page à chaque push sur `main` (projet relié au dépôt, dossier racine `web/`).

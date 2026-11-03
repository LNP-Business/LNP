# 06 · Build, design, langue et tests

## Construire la page

Prérequis : Python 3.10+ (bibliothèque standard seulement), Node 18+ (Node 22 en CI). Aucune dépendance npm n'est nécessaire pour
la page ; `web/` a ses propres dépendances pour les tests et l'API (`npm ci` dans `web/`).

```bash
./build.sh            # construit la page
./build.sh --verify   # puis compare skl-os/skl-os-en.html à skl-os/EXPECTED.sha256
```

`build.sh` enchaîne trois étapes, toutes idempotentes (relancer tout le script après chaque modification) :

| Étape | Script | Produit |
|---|---|---|
| 1 · Écrans | `skl-os/harmonize.py` | le cadre des Paramètres (`Settings.dc.html` depuis `Settings.pre-hz.dc.html`) et la barre d'onglets du CRM (`crm_doc.html`) |
| | `skl-os/gen_access.py` | `Account.dc.html` et `Access.dc.html` (cadres remplis par `web/public/skl-web.js`) |
| | `skl-os/gen_salescockpit.py` | `SalesCockpit.dc.html` (cadre du module `SKL_SALES`) et son « Mode d'emploi » |
| | `skl-os/gen_salesday.py` | `SalesDay.dc.html` (cadre du module `SKL_SALESDAY`) et son « Mode d'emploi » |
| | `skl-os/nav.py` | la barre latérale de chaque écran (groupes, entrées, logo, nom) |
| 2 · Assemblage | `skl-os/build.py en` | `skl-os/skl-os-en.html` : gabarits des écrans gardés par `edition.json`, `store.js`, `kr_view.js`, `crm/data.js`, CRM (`crm_doc.html`), module Cockpit (`sales_v2.json`), module Ma journée (`salesday_module.js`), puis application de la marque (`rename`, `recolor`, `fonts`, `logo`) |
| 3 · Édition web | `web/build_web.py` | `web/public/index.html` (la page + `<script src="/skl-web.js">`, `lang="fr"`) |
| | `web/kb/build_kb.mjs` | `web/api/_kb.json` (modes d'emploi et place dans la barre latérale des 6 écrans, lus par le connecteur Claude) |

Les écrans sont des gabarits « Design canvas » (`<x-dc>` + une classe `Component extends DCLogic`) : `build.py` extrait le corps et le
script de chaque gabarit et les monte dans une coquille commune (navigation, fenêtre « Mode d'emploi », confirmations, maintien du
focus pendant la saisie). Les modules (Cockpit, Ma journée, CRM) sont montés dans un Shadow DOM par `mountModule`.

### Fichiers figés (régénérés à la main, pas par `build.sh`)

| Fichier | Source | Commande |
|---|---|---|
| `skl-os/sales_v2.json` | `proposal/sales-cockpit-v2.html` + retouches de `skl-os/gen_sales_v2.py` | `python3 skl-os/gen_sales_v2.py` |
| `skl-os/crm_doc.html` (+ `dash_doc.html`, `dash_shadow.json`) | `uploads/ALKIMIY_Lite.html`, `docs/crm/reference/sales-cycle-v6.html`, `skl-os/crm/*.js`, `supabase/functions/_shared/sla_rules.js`, retouches de `skl-os/gen_crm.py` (vérifiées par des assertions) | `python3 skl-os/gen_crm.py` |

Ne jamais modifier à la main un fichier généré (`*.dc.html` sans `.pre-hz`, `skl-os-en.html`, `web/public/index.html`, `_kb.json`).

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
| `logo` | image PNG de la barre latérale et de l'onglet (intégrée en base64 ; 80 px suffisent) | `skl-os/brand/lnp-logo.png` |
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
aussi une couleur de départ) et `fonts`, puis appliquer les mêmes valeurs à `web/public/skl-web.js` (écran de connexion, servi tel
quel) et à la page de connexion OAuth (`web/api/oauth.js`).

## Langue

- Toute l'interface est en français ; le vocabulaire est fixé par `docs/lnp/GLOSSAIRE.md` (sans anglicisme, jamais « closer »).
- Le CRM n'a qu'une langue : `S.lang = "fr"` dans `uploads/ALKIMIY_Lite.html` (dictionnaire `fr:{…}`), sans sélecteur.
- Dates et nombres : `fr-FR` (« 3 nov. », « 1 050 € », « 73 % », « 7 j », « 8 sem. »).
- Seuls les textes lus par une personne sont traduits ; les valeurs stockées et comparées restent en anglais (`won`, `held`…), les
  libellés en base sont traduits (`web/supabase/034_lnp_fr_labels.sql`), les codes du moteur d'analyse sont traduits à l'affichage.
- Les consignes envoyées au modèle d'analyse restent en anglais.

## Tests

| Domaine | Commande | Contenu |
|---|---|---|
| Données du CRM | `node skl-os/crm/data.test.js` | `window.SKL_CRM` (lectures, écritures, libellés français) |
| Cycle de vente | `node skl-os/crm/sales_cycle_accept.js $PWD/skl-os/skl-os-en.html <dossier>` | 17 contrôles d'acceptation dans Playwright |
| Cycle de vente (direct) | `node skl-os/crm/sales_cycle_live.js …` | comportement avec des données simulées |
| Transcriptions | `node skl-os/crm/transcript_parse.test.js` | lecture des formats collés, intervenants |
| SQL | `web/supabase/tests/run.sh` (Postgres 16 local, `PGHOST`, `PGUSER`) | 20 suites, sur des bases jetables, avec `supabase_stub.sql` |
| Fonctions Edge | `deno test --allow-env --allow-read supabase/tests` | ingestion, mappers, import, pipeline, SLA, `callqa-llm` |
| Connecteur et API | `cd web && npm ci && npm test` | OAuth, outils MCP, accès, sur un Supabase en mémoire |
| Moteur d'analyse | `cd call-analysis/engine && python3 -m pytest -q tests` | méthodologie (cas de l'annexe B si les transcriptions sont disponibles) |
| Worker d'analyse | `cd call-analysis/worker && python3 -m pytest -q tests` | file, préchargement, budget |
| Écrans | Playwright sur `skl-os/skl-os-en.html` | chaque écran sans erreur et sans texte anglais (voir `CLAUDE.md`) |

## Intégration continue (`.github/workflows/`)

| Workflow | Déclencheurs | Tâches |
|---|---|---|
| `crm-functions.yml` | push sur `main` ou `crm-*`, PR touchant `supabase/`, `web/supabase/`, `skl-os/crm/`, `web/api/`, `web/tests/`, `web/package*.json` ; manuel | `test` (Deno), `sql` (Postgres 16 + `data.test.js`), `connector` (`npm test`), `deploy` (depuis `main`, si `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF` existent : `supabase functions deploy <f> --remote=… --no-verify-jwt --yes`) |
| `call-analysis.yml` | push et PR touchant `call-analysis/` ; toutes les heures (`7 * * * *`) ; manuel (effort `low` ou `default`) | `test` (moteur et worker ; télécharge les transcriptions de test depuis le stockage `callqa-fixtures` si la clé existe), `worker` (analyse les appels en file, budget 120 min) |

Point connu : le bucket `callqa-fixtures` n'existe pas dans le projet LNP, donc la tâche `test` de `call-analysis.yml` échoue au
téléchargement quand la clé est définie. Il faut soit créer ce bucket avec un corpus de transcriptions autorisé, soit faire sauter
le téléchargement quand le fichier est absent.

Vercel déploie la page à chaque push sur `main` (projet relié au dépôt, dossier racine `web/`).

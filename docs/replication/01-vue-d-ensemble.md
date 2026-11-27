# 01 · Vue d'ensemble

## Ce que fait LNP

LNP est l'outil commercial de Les Nouveaux Profs. Il suit chaque prospect depuis sa prise de rendez-vous jusqu'à l'encaissement,
organise la journée des commerciaux et des setters, mesure l'activité de l'équipe, analyse les appels de vente et entraîne les
commerciaux.

| Groupe | Écran | À quoi il sert |
|---|---|---|
| Ventes | **Cockpit commercial** | les chiffres de l'équipe sur 7 j, 30 j ou 8 semaines (du prospect à l'encaissement, rentabilité, panier, équipe, prévisions) et les onglets Exécution, Qualité, Impact, Résultats |
| | **Cycle de vente** | la journée d'un commercial, un prospect à la fois : « Agir maintenant », Aujourd'hui, Demain, Passer ; le cycle de vente en conversation et, à droite, la fiche du lead (l'ancien écran « Ma journée » y est fusionné) |
| | **CRM** | Leads (tableau et fiche d'un lead), Pipeline, Alertes, suivi du setter, fenêtre d'encaissement, analyse d'appel en plein écran |
| Entraînement | **Découverte** | exercices de questions de découverte |
| | **Maîtrise de l'offre** | 100 cas corrigés avec une grille et un corrigé |
| | **Simulateur** | un appel de vente simulé avec un prospect joué par le modèle, en texte ou à la voix, analysé à la fin |
| | **Mes résultats**, **Suivi des commerciaux** | les résultats des exercices (le suivi est réservé aux administrateurs) |
| Paramètres | **Alertes**, **Compte**, **Accès** | règles d'alerte ; compte et équipe ; écrans ouverts à chaque personne |

Le détail de chaque écran est au chapitre 02.

## Architecture

```
Navigateur ── https://lnp-sales.vercel.app ── Vercel (dossier web/)
   │            page unique web/public/index.html (= app/lnp.html) + web/public/lnp-web.js
   │            documents des écrans en cadre : web/public/docs/lnp-docs.<empreinte>.js (après connexion)
   │            API serverless web/api/*.js (config, me, team, bootstrap, mcp, oauth)
   │
   ├── Supabase Auth (connexion, invitations, mots de passe)
   ├── Supabase Postgres (53 tables crm_* et autres, RLS partout ; fonctions crm_* ; pg_cron + pg_net)
   └── Supabase Realtime (alertes du CRM en direct)

Outils externes ── webhooks / API ── Fonctions Edge Supabase (supabase/functions/)
   iClosed → iclosed-in      WhatsApp Business → whatsapp-in     Whop → whop-in     funnels → lead-in
   Fathom, iClosed (contacts, appels, ventes) → crm-import (toutes les heures)
   chaque minute : process-inbox (les requêtes brutes deviennent prospects, cycles, appels, événements)
   toutes les 5 min : sla-tick (ouvre, fait monter et ferme les alertes du CRM ; copie Slack facultative)
   toutes les 10 min : crm_setting_tick (setter), simulateur/balayer (analyses du Simulateur en attente)
   chaque jour : crm_refusal_tick (disqualifié 6 mois après un refus)

Simulateur ── fonction Edge simulateur ── modèle Anthropic (prospect, analyse) ; ElevenLabs facultatif (voix)

Analyse d'appel ── GitHub Actions (call-analysis.yml, toutes les heures) ── worker Python (call-analysis/)
   prend les appels en file (crm_ca_claim), interroge le modèle par la fonction Edge callqa-llm, écrit le résultat
   (crm_ca_store) et la qualification du lead ; l'écran lit crm_ca_board

Claude (claude.ai) ── connecteur MCP https://lnp-sales.vercel.app/api/mcp (OAuth 2.1) ── le CRM avec le jeton de la personne
```

Principes :
- **Une seule page** : l'écran est un fichier HTML autonome. Ouvert seul (hors édition web), il tourne en **mode démonstration**
  avec des données d'exemple et n'enregistre rien. **`app/lnp.html` fait foi** (chapitre 06) : l'interface actuelle n'est pas
  encore reportée dans les générateurs.
- **La base décide** : les règles métier (étapes, statuts, absences, refus, remboursements, rangs des appels, alertes, chiffres du
  cockpit) sont dans Postgres. Le navigateur lit à travers la RLS et écrit uniquement par des fonctions `crm_*`.
- **Le CRM est la seule source de vérité des statuts** (migration 059) : d'iClosed, on garde le lead, la date des rendez-vous et
  le montant d'une vente, jamais un statut.
- **Les sources ne parlent qu'à leur fonction** : chaque webhook est stocké brut, puis transformé par `process-inbox`, ce qui
  permet de rejouer un traitement.
- **Le modèle cite, le code décide**, pour l'analyse d'appel comme pour le Simulateur.

## Services et comptes

Tous au nom de l'entreprise de l'installation, jamais le compte d'une autre entreprise.

| Service | Usage | Obligatoire |
|---|---|---|
| GitHub (organisation) | dépôt, tests, déploiement des fonctions, worker d'analyse d'appel | oui |
| Supabase | base, authentification, fonctions Edge, tâches planifiées, stockage | oui |
| Vercel | hébergement de la page et de l'API | oui |
| Anthropic | modèle de l'analyse d'appel et du Simulateur | pour l'analyse et le Simulateur |
| iClosed | prise de rendez-vous (webhooks, imports horaires des contacts, appels et ventes) | pour alimenter le CRM |
| Fathom | enregistrement et transcription des appels (import horaire) | pour les appels honorés et l'analyse |
| WhatsApp Business (Meta, API officielle en coexistence) | messages des commerciaux et des setters avec les prospects (`whatsapp-in`) | pour les messages (seul canal de messages) |
| Funnels | leads entrants (`lead-in`) | si utilisé |
| Whop | paiements (`whop-in`) | si utilisé |
| ElevenLabs | voix du prospect dans le Simulateur | facultatif (sinon la voix du navigateur) |
| Slack | copie des alertes | facultatif, éteint par défaut |
| Close | ancien CRM (import d'historique) | si utilisé |

## Arborescence du dépôt

| Chemin | Contenu |
|---|---|
| `app/lnp.html` | **la page en production** (2,6 Mo), modifiée directement |
| `app/` (autres) | générateurs d'origine (`harmonize.py`, `gen_*.py`, `nav.py`, `build.py`, `shell.py`), socle (`store.js`), modules (`sales_exec_module.js`, `salescockpit_logic.js`, `alerts_module.js`, `salesday_module.js`, `info_logic.js`), figés (`sales_v2.json`, `crm_doc.html`), `crm/` (données, encaissements, analyse d'appel, setter, fil du cycle, tests), `training/` (Découverte, Maîtrise de l'offre et ses 100 cas, Résultats, Simulateur, tests), `brand/` (logo), tests d'écrans (`*_test.js`) |
| `gabarits/` | gabarits des écrans d'origine (`*.dc.html`, `*.pre-hz.dc.html`, en-tête `Shell.base.html`) |
| `uploads/crm_source.html` | source d'origine du CRM |
| `proposal/sales-cockpit-v2.html` | source d'origine du Cockpit commercial |
| `web/` | édition web : `public/` (page, `lnp-web.js`, `docs/`, `version.json`), `api/` (routes, `_screens.js`, `_kb.json`), `kb/` (base de connaissances du connecteur), `supabase/` (les 63 migrations SQL et `tests/`), `tests/` (connecteur), `build_web.py`, `vercel.json`, `package.json` |
| `supabase/` | `functions/` (10 fonctions Edge et `_shared/` : SLA, Simulateur, mappers), `tests/` (Deno), `config.toml` |
| `call-analysis/` | analyse d'appel : moteur de référence (`engine/`), moteur allégé (`lite/`), worker (`worker/`), mesure (`qa/`), qualification (`qualification/`), méthodologie et contrats (`docs/`) (chapitre 09) |
| `.github/workflows/` | `crm-functions.yml`, `call-analysis.yml`, `qualification.yml` |
| `docs/crm/` | spécification du CRM (décisions, modèle de données, intégrations, écrans, Simulateur `20-simulateur.md`) |
| `docs/lnp/GLOSSAIRE.md` | le vocabulaire français |
| `docs/replication/` | ce dossier |
| `simulations/` | documents de travail du référentiel du Simulateur |
| `CLAUDE.md`, `LNP.md`, `README.md` | consignes du dépôt (la carte « où changer quoi » la plus à jour), marque, présentation |

Les noms techniques `app/`, `LNP_*`, `lnp-web.js` sont des identifiants : ils ne s'affichent nulle part et restent tels quels dans
une réplication.

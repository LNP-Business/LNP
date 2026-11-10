# 01 · Vue d'ensemble

## Ce que fait LNP

LNP est l'outil commercial de Les Nouveaux Profs. Il suit chaque prospect depuis sa prise de rendez-vous jusqu'à l'encaissement,
mesure l'activité de l'équipe commerciale et analyse les appels de vente.

| Écran | À quoi il sert |
|---|---|
| **Cockpit commercial** | les chiffres de l'équipe sur 7 j, 30 j ou 8 semaines, comparés à la période précédente : du prospect à l'encaissement, rentabilité par appel, panier moyen, remboursements, équipe commerciale, prévision d'encaissement, encaissements à risque, contrôle de parité |
| **Ma journée** | la journée d'un commercial, un prospect à la fois : issues d'appel à déclarer, appels du jour, replanifications, absences, relances |
| **CRM** | Pipeline (colonnes par étape), Prospects (liste), Cycle de vente (frise de chaque prospect, SLA, formulaire d'issue), fiche prospect (historique, commercial attitré, notes, analyse d'appel), fenêtre d'encaissement (montant signé, échéancier, paiements, remboursements) |
| **Paramètres** | Alertes (règles et seuils), Compte (compte, équipe, invitations, rôles), Accès (écrans ouverts à chaque personne, administrateurs) |

Le détail de chaque écran est au chapitre 02.

## Architecture

```
Navigateur ── https://lnp-sales.vercel.app ── Vercel (web/)
   │            page unique web/public/index.html + web/public/lnp-web.js
   │            API serverless web/api/*.js (config, me, team, bootstrap, mcp, oauth)
   │
   ├── Supabase Auth (connexion, invitations, mots de passe)
   ├── Supabase Postgres (tables crm_*, members ; RLS ; fonctions crm_* ; pg_cron + pg_net)
   └── Supabase Realtime (mises à jour en direct des tables crm_*)

Outils externes ── webhooks / API ── Fonctions Edge Supabase (supabase/functions/)
   iClosed  → iclosed-in      WhatsApp Business → whatsapp-in     Whop → whop-in     Fathom → crm-import (toutes les heures)
   chaque minute : process-inbox (transforme les requêtes brutes en prospects, cycles, appels, événements)
   toutes les 5 min : sla-tick → Slack (alertes du cycle de vente)
   Close, iClosed, Fathom : imports d'historique par crm-import (l'historique WhatsApp arrive par whatsapp-in à la connexion)

Analyse d'appel ── GitHub Actions (call-analysis.yml, toutes les heures) ── worker Python
   lit les appels en file (crm_ca_claim), interroge le modèle par la fonction Edge callqa-llm (Anthropic), écrit le résultat (crm_ca_store)

Claude (claude.ai) ── connecteur MCP https://lnp-sales.vercel.app/api/mcp (OAuth 2.1) ── lecture du CRM avec le jeton de la personne
```

Principes :
- **Une seule page** : tout l'écran est un fichier HTML autonome, construit par `./build.sh` à partir des sources du dépôt. Hors
  édition web (fichier ouvert seul), elle tourne en **mode démonstration** avec des données d'exemple et n'enregistre rien.
- **La base décide** : les règles métier (étapes, statuts, absences, remboursements, rangs R1/R2, SLA, chiffres du cockpit) sont dans
  Postgres. Le navigateur lit à travers la sécurité au niveau des lignes (RLS) et écrit uniquement par des fonctions `crm_*`.
- **Les sources ne parlent qu'à leur fonction** : chaque webhook est stocké brut (`crm_webhook_log`), puis transformé par
  `process-inbox`, ce qui permet de rejouer un traitement.
- **Le modèle cite, le code décide** pour l'analyse d'appel (voir `call-analysis/CLAUDE.md`).

## Services et comptes

Tous au nom de l'entreprise (pour LNP : e-mail LNP, jamais le compte d'une autre entreprise).

| Service | Usage | Obligatoire |
|---|---|---|
| GitHub (organisation) | dépôt, CI, déploiement des fonctions, worker d'analyse | oui |
| Supabase | base, authentification, fonctions Edge, tâches planifiées | oui |
| Vercel | hébergement de la page et de l'API | oui |
| iClosed | prise de rendez-vous (webhooks des RDV, import des contacts et appels) | pour alimenter le CRM |
| Fathom | enregistrement et transcription des appels (import toutes les heures) | pour les appels honorés et l'analyse |
| WhatsApp Business (Meta, par un fournisseur comme 360dialog) | messages des commerciaux et des setters avec les prospects (webhook `whatsapp-in`, API officielle en coexistence ; historique partagé à la connexion) | pour les messages (seul canal de messages du CRM) |
| Whop | paiements (webhook `whop-in`, stocké brut ; encaissements saisis à la main en attendant) | si utilisé |
| Close | ancien CRM (import unique des prospects) | si utilisé |
| Slack | alertes SLA (webhook entrant) | conseillé |
| Anthropic | modèle de l'analyse d'appel (clé dans les secrets Supabase) | pour l'analyse |

## Arborescence du dépôt

| Chemin | Contenu |
|---|---|
| `build.sh` | construit la page (chapitre 06) |
| `edition.json` | la marque et le périmètre de l'édition : écrans gardés, nom, logo, couleurs, polices |
| `app/` | générateurs des écrans (`harmonize.py`, `gen_access.py`, `gen_salescockpit.py`, `gen_salesday.py`, `nav.py`), assemblage (`build.py`), coquille (`shell.py`), socle de la page (`store.js` : confirmation des suppressions), module Ma journée (`salesday_module.js`), module Cockpit figé (`sales_v2.json`, `gen_sales_v2.py`), CRM figé (`crm_doc.html`, `gen_crm.py`), `crm/` (données, encaissements, analyse d'appel, transcriptions, tests), `brand/` (logo), la page construite `lnp.html` et son empreinte `EXPECTED.sha256` |
| `gabarits/` | gabarits des écrans (`*.dc.html`, `*.pre-hz.dc.html`, en-tête commun `Shell.base.html`) |
| `uploads/crm_source.html` | source du CRM (dictionnaire français, langue fixée en français) |
| `proposal/sales-cockpit-v2.html` | source du Cockpit commercial |
| `docs/crm/reference/sales-cycle-v6.html` | source de la vue Cycle de vente |
| `web/` | édition web Vercel : `public/` (page et `lnp-web.js`), `api/` (routes), `kb/` (base de connaissances du connecteur), `supabase/` (migrations SQL et leurs tests), `tests/` (tests du connecteur), `vercel.json`, `package.json` |
| `supabase/` | dossier de la CLI Supabase : `functions/` (fonctions Edge et `_shared/`), `tests/` (tests Deno), `config.toml` (`verify_jwt = false`) |
| `call-analysis/` | moteur d'analyse (`engine/`), worker (`worker/`), méthodologie et contrats (`docs/`) |
| `.github/workflows/` | `crm-functions.yml` (tests + déploiement des fonctions), `call-analysis.yml` (tests + worker horaire) |
| `docs/crm/` | spécification du CRM ; `docs/lnp/GLOSSAIRE.md` ; ce dossier |

Les noms techniques `app/`, `LNP_*`, `lnp-web.js` sont des identifiants hérités : ils ne s'affichent nulle part et peuvent
rester tels quels dans une réplication (les renommer demande de reprendre build, générateurs et tests ensemble).

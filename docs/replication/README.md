# Dossier de réplication de LNP

Ce dossier décrit **tout ce qui compose l'application LNP** (Les Nouveaux Profs · Ventes), pour la reproduire à l'identique dans
une nouvelle installation : le code (ce dépôt), la base, les fonctions, le site, les tâches planifiées, les réglages, les
intégrations et l'analyse d'appel. Il se lit avec le dépôt : le code est la référence, ce dossier l'explique, dit dans quel ordre
tout installer et comment vérifier que la copie est identique. Il ne contient aucune clé ni aucune donnée personnelle.

Mis à jour le 28 novembre 2026, sur `main` (la version en production).

| Chapitre | Contenu |
|---|---|
| [01 · Vue d'ensemble](01-vue-d-ensemble.md) | ce que fait l'application, son architecture, les services et comptes, l'arborescence du dépôt |
| [02 · Écrans et fonctionnalités](02-ecrans-et-fonctionnalites.md) | chaque écran, chaque bloc, chaque chiffre et sa formule, chaque action, les rôles |
| [03 · Base de données](03-base-de-donnees.md) | tout le schéma Supabase : migrations, tables, fonctions, déclencheurs, RLS, tâches planifiées, réglages |
| [04 · Intégrations et fonctions](04-integrations-et-fonctions.md) | les 10 fonctions Edge, iClosed, Fathom, WhatsApp Business, funnels, Whop, Close, Slack |
| [05 · Édition web et connecteur](05-edition-web-et-connecteur.md) | Vercel, l'API, la connexion et l'équipe, l'accès par écran, le connecteur Claude (MCP + OAuth) |
| [06 · Build, design, langue et tests](06-build-design-tests.md) | la page (`app/lnp.html` fait foi), l'édition web, la marque, le français, les tests, la CI |
| [07 · Procédure de réplication](07-procedure-de-replication.md) | pas à pas, du dépôt au site en ligne |
| [08 · Configuration actuelle](08-configuration-actuelle.md) | l'état de la production relevé le 27 novembre 2026, sans valeur secrète |
| [09 · Analyse d'appel](09-analyse-d-appel.md) | le moteur, le worker, les modèles, la mesure, la qualification |
| [10 · Liste de contrôle](10-liste-de-controle.md) | comment prouver que la réplique est identique (empreintes, compteurs, écrans, tests) |
| [11 · Prompts](11-prompts.md) | chaque prompt envoyé à un modèle : fichier, étape, modèle, entrée, sortie, tests |

| Outil | Contenu |
|---|---|
| [`configuration/production.sql`](configuration/production.sql) | la configuration de la production qui n'est pas dans les migrations (réglages, modèles, offre et prospects fictifs du Simulateur), sans clé ni donnée personnelle |
| [`scripts/`](scripts/) | `01` pousser le code, `02` base et configuration, `03` secrets, `04` fonctions, authentification et stockage, `05` vérification (chapitre 07, § 0) |
| [`PROMPT-CLAUDE-CODE.md`](PROMPT-CLAUDE-CODE.md) | le prompt à coller dans Claude Code pour se faire guider de bout en bout |

Ordre de lecture conseillé : 01, puis 07 pour installer (§ 0 : les scripts et le prompt de Claude Code) en ouvrant 02 à 06, 09 et
11 au besoin, puis 10 pour vérifier.

Pour remettre le code à un collègue : un accès au dépôt (ou un transfert), ou une copie autonome avec tout l'historique
(`git bundle create lnp.bundle main dossier-replication`, puis chez lui `git clone -b main lnp.bundle LNP` ; tant que ce dossier
n'est pas fusionné, il se lit sur la branche `origin/dossier-replication` de la copie). Les secrets ne se transmettent jamais avec le
code : chaque installation crée les siens (chapitres 07 et 08).

Documents voisins à garder en tête :
- `CLAUDE.md` : les consignes de travail du dépôt (règles, où changer quoi, vérifications).
- `LNP.md` : la marque et l'installation résumées.
- `docs/lnp/GLOSSAIRE.md` : le vocabulaire français de l'application.
- `docs/crm/` : la spécification détaillée du CRM, écrite au fil du projet.
- `call-analysis/CLAUDE.md` : les règles du moteur d'analyse d'appel.

# Dossier de réplication de LNP

Ce dossier décrit **tout ce qui compose l'application LNP** (Les Nouveaux Profs · Ventes), pour la reconstruire dans un autre
projet, pour une autre entreprise ou une autre marque. Il se lit avec le dépôt `LNP-Business/LNP` : le code est la référence,
ce dossier l'explique et dit dans quel ordre tout installer. Il ne contient aucune clé ni aucune donnée personnelle.

| Chapitre | Contenu |
|---|---|
| [01 · Vue d'ensemble](01-vue-d-ensemble.md) | ce que fait l'application, son architecture, les services et comptes utilisés, l'arborescence du dépôt |
| [02 · Écrans et fonctionnalités](02-ecrans-et-fonctionnalites.md) | chaque écran, chaque bloc, chaque chiffre et sa formule, chaque action, les rôles |
| [03 · Base de données](03-base-de-donnees.md) | tout le schéma Supabase : tables, vues, fonctions, déclencheurs, droits (RLS), tâches planifiées, réglages, règles métier |
| [04 · Intégrations et fonctions](04-integrations-et-fonctions.md) | les fonctions Edge, iClosed, Fathom, Sendblue, Whop, Close, Slack, l'analyse d'appel |
| [05 · Édition web et connecteur](05-edition-web-et-connecteur.md) | Vercel, l'API, la connexion et l'équipe, l'accès par écran, le connecteur Claude (MCP + OAuth) |
| [06 · Build, design, langue et tests](06-build-design-tests.md) | la construction de la page, `edition.json` (marque, couleurs, polices, logo), le français, les tests et la CI |
| [07 · Procédure de réplication](07-procedure-de-replication.md) | pas à pas, du dépôt vide au site en ligne, avec la liste de contrôle finale |
| [08 · Configuration actuelle de LNP](08-configuration-actuelle.md) | l'état relevé en direct le 3 novembre 2026 (Supabase, Vercel, GitHub), sans aucune valeur secrète |

Ordre de lecture conseillé : 01, puis 07 pour installer, en ouvrant 02 à 06 au besoin.

Documents voisins à garder en tête :
- `CLAUDE.md` : les consignes de travail du dépôt (règles, où changer quoi, vérifications).
- `LNP.md` : la marque et l'installation résumées.
- `docs/lnp/GLOSSAIRE.md` : le vocabulaire français de l'application.
- `docs/crm/` : la spécification détaillée du CRM (décisions, modèle de données, intégrations, écrans), écrite au fil du projet.
- `call-analysis/` : le moteur d'analyse d'appel, sa méthodologie et ses propres règles (`call-analysis/CLAUDE.md`).

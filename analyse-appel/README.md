# Analyse des appels de vente LNP

Tout ce qui sert à analyser les appels de vente de LNP : la méthodologie, le moteur, le moteur allégé, l'exécutant qui tourne
chaque heure et la qualification des leads. Tout est en français, sauf le format de l'analyse enregistrée (`CLAUDE.md`).

| Chemin | Contenu |
|---|---|
| `CLAUDE.md` | Les règles du système, à lire avant toute modification |
| `PLAN.md` | Le plan d'intégration dans l'application (approuvé par Romain le 2026-10-25) |
| `CONSIGNE_DE_REPRISE.md` | Le texte qui a lancé l'intégration (document historique) |
| `docs/ARCHITECTURE.md` | L'architecture : fondation → SPIN → écart → présentation → objections, 30 tâches du modèle, fiabilité |
| `docs/INDEX_DES_BORNES.md` | L'index de chaque règle de bornage (SEG, SB, GB, PB, OB) et de l'élément qu'elle borne |
| `docs/methodologie/` | La méthodologie complète par compétence : A notation · B règles de bornage · C cas de calibration ; 00 règles communes (Partie C) |
| `docs/memos/` | Les quatre mémos LNP des compétences (PDF), source de vérité pour une personne |
| `docs/CONTRAT_DE_SORTIE.md` | L'analyse enregistrée pour chaque appel et lue par les écrans |
| `docs/SPEC_ECRAN.md` | La spécification de l'écran d'analyse d'appel |
| `docs/DECISIONS_OUVERTES.md` | Les données à fournir, les décisions à prendre, les contradictions connues, les interprétations du moteur |
| `moteur/` | Le moteur de référence (`lnp_analyse`, Python 3.11+, bibliothèque standard seulement) et ses tests |
| `allege/` | Le moteur allégé (`analyse_allegee`) : cinq étapes, une lecture, ≤ 0,10 USD par appel |
| `executant/` | L'exécutant lancé par GitHub Actions (`executer.py`, `executant_analyse/`) |
| `qualification/` | La qualification des leads après un R1 (règle des portes 2.2) |

Versions : SPIN 1.1 · écart 1.3 (avec GB-34 « d'un seul tenant ») · présentation 2.0 · objections 1.1 · moteur 1.0 · 25 octobre 2026.

Les transcriptions de test (`moteur/tests/fixtures/transcripts/`) sont de vrais appels de prospects : elles ne sont jamais dans
le dépôt (stockage privé `callqa-fixtures`, téléchargé par la CI).

# lnp_analyse · moteur d'analyse des appels de vente LNP (implémentation de référence)

Applique les quatre méthodologies (SPIN 1.1, écart 1.3, présentation 2.0, objections 1.1) à la transcription d'un appel de vente.
Architecture : `../docs/ARCHITECTURE.md`. Contrat du moteur : `CONTRAT.md`.

Règle : le modèle extrait et cite, le code décide et note.

## Organisation
- `lnp_analyse/noyau/` modèle de données, vérification des citations et règle du mot pour mot, client du modèle, exécuteur
  (3 lectures, nouvelle demande, arbitrage), fondation (lecture, diarisation, réparation de l'attribution, carte des phases),
  notation, agrégation par période
- `lnp_analyse/competences/` spin.py, ecart.py, presentation.py, objections.py
- `lnp_analyse/consignes/` les règles communes envoyées au modèle (`systeme_commun.md`) et une consigne par tâche (30 tâches)
- `lnp_analyse/chaine_analyse.py` l'ordre fixe des étapes, l'analyse enregistrée, la ligne de commande
- `tests/` les tests : noyau, paires minimales et vrais cas de l'annexe B par compétence, essai de bout en bout

## Lancer les tests
    pip install pytest
    python3 -m pytest -q tests
(Les tests de l'annexe B lisent `tests/fixtures/transcripts/` ; `CALLQA_CORPUS` donne un autre corpus ;
`CALLQA_SKIP_MISSING_CORPUS=1` les compte comme ignorés quand les transcriptions manquent.)

## Analyser un appel (modèle réel)
    pip install anthropic ; export ANTHROPIC_API_KEY=...
    python3 -m lnp_analyse.chaine_analyse transcription.txt --config appel.json
`appel.json` (clés du format d'entrée, en anglais) : {"speaker_map": {"Nom": "SALES", ...}, "call_id", "sales_id",
"start_utc", "timezone", "tiers": {"fast": "<modèle>", "strong": "<modèle>", "arbiter": "<modèle>"},
"offer_reference": {"price": ..., "mechanisms": {...}, ...}, "case_library": [...]}
Les identifiants des modèles, la référence de l'offre (les neuf mécanismes) et la bibliothèque de cas ne sont pas fournis ici :
ils viennent de la configuration (`crm_ca_config`, `crm_ca_offer`, `crm_ca_cases`).

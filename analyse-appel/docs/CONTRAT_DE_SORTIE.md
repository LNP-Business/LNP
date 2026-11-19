# Contrat de sortie · l'enregistrement d'un appel

> **Les clés JSON restent en anglais.** Ce document décrit le format enregistré de l'analyse : c'est ce que l'écran, la base
> et le connecteur lisent. Romain a choisi de garder ce format tel quel : toutes les clés (`call_id`, `results`, `verdict`,
> `items`…) et toutes les valeurs fermées (`"scored"`, `"to_review"`, `"present"`, `"compliant"`…) restent en anglais. Seules
> les explications de ce document sont en français.

Un enregistrement est produit pour chaque appel analysé par `lnp_analyse.chaine_analyse.enregistrement_resultat(ctx)`. C'est
ce qui est stocké et ce que l'écran lit. Les contrats de sortie de chaque compétence sont définis dans chaque
`0N_<x>_A_notation.md` (section « Contrat de sortie ») ; ce fichier donne l'enveloppe et ce dont l'écran a besoin.

```
{
  "call_id": "001", "sales_id": "valentino", "start_utc": "2026-06-18T11:00:00Z", "timezone": "Asia/Dubai",
  "status": "ok" | "no_transcript" | "no_diarization" | "diarization_suspect",
  "flags": [...],
  "turns": [{"id": "T081", "ts": "28:07", "role": "SALES", "speaker": "...", "text": "...",
             "repaired": false, "attribution_doubtful": false}, ...],      // tours réparés ; identifiants comme T050b après une coupure
  "phases": {"discovery_start": "T028", "discovery_end": "T085", "pitch_start": "T085", "first_price": "T113",
             "decision_request": "T113", "pitch_end": "T113", "offer_mentions": [], "early_price": null, "flags": []},
  "results": {
    "SPIN":       ResultatCompetence,
    "GAP":        ResultatCompetence,
    "PITCH":      ResultatCompetence,
    "OBJECTIONS": ResultatCompetence
  },
  "audit": [ {task, unit, pass, tier, prompt_hash, answer, errors}, ... ]   // chaque passe du modèle, chaque arbitrage, chaque erreur
}
```

`status` : `"ok"`, `"no_transcript"` (pas de transcription), `"no_diarization"` (locuteurs non séparés),
`"diarization_suspect"` (séparation des locuteurs douteuse). `role` vaut `SALES` (le commercial), `PROSPECT` ou `OTHER`.

`ResultatCompetence` (classe `ResultatCompetence` de `noyau/modeles.py`) :

```
{
  "competence": "GAP", "rules_version": "GAP-1.3",
  "status": "scored" | "not_applicable" | "excluded" | "to_review",
  "verdict": "present" | "absent" | "compliant" | "non_compliant" | null,
  "reasons": [...],                 // raisons d'absence / de non-conformité / de non-applicabilité, la raison principale en premier
  "score": 0..100 | null,
  "items": [{"id": "G5", "weight": 25, "level": 0|1|2|null,
             "evidence": [{"quote": "...", "turn": "T081", "role": "SALES"}], "note": "..."}],
  "flags": [...],
  "details": { ... propre à chaque compétence, voir plus bas ... },
  "concordance": "3/3" | null
}
```

Valeurs : `status` `"scored"` (noté), `"not_applicable"` (sans objet), `"excluded"` (exclu), `"to_review"` (à revoir) ;
`verdict` `"present"` / `"absent"` (écart présent ou absent), `"compliant"` / `"non_compliant"` (présentation conforme ou non
conforme) ; `concordance` : accord des trois passes.

## Détails lus par l'écran

| Compétence | Clés | Servent à |
|---|---|---|
| SPIN | `perimeter`, `solicitations[]` (id, turn, ts, letter, gate_letter, out_reason, tags, in_perimeter, status, answer_turns, followed_up, register, register_status, register_basis, register_domain, register_quote, register_reference_turn : le tour de la réponse pour la base `answer` (SB-35, v1.3), sinon celui de la référence), `registers` (décomptes par registre, questions, verified, to_review, agreement, threshold, flags ; v1.2), `items_evidence` (par item : niveau, lignes de preuve avec tour, horodatage, citation, atome, domaine, identifiant et lettre de la question), `chains`, `diagnostics` (répartition des lettres, jamais notée), `health`, `unit_status` | Tableau de la découverte : lignes par registre (Financier, Temps et charge, Identité et statut, Mental et émotionnel, Autre, puis Hors SPIN), une puce par sollicitation, décomptes des douleurs et des désirs, états |
| GAP | `verdict`, `validation_turn`, restitutions (plage, tours, signaux, composantes avec tour source, expression clé et correspondance `verbatim`/`paraphrased`/`untraced`, `explicit_quote`, propositions, issue de la validation, conformité), `selected_A`, `selected_B`, `selected_P`, `validated_P` (citation, tour, expression clé), `cost`, `roadmap_blockers`, formule, diagnostics | Barre de chronologie (plage → horodatages tirés de `turns`), verbatim annoté, quatre contrôles, tableau des composantes, ligne de la feuille de route. Lu par PITCH. |
| PITCH | `verdict`, `non_compliance`, `phases` (pitch_start, roadmap, first_price, decision_request, early_price), `validated_P` (+ catégorie), `steps` {1..4}, `order_ok`, `roadmap`, `roadmap_span`, `claims` (chacune avec le résultat de sa recherche), `outcome_promises`, `adhesion`, `raw_score`, `diagnostics` | Puces de conformité, escalier, verbatim annoté de la présentation (fenêtre pitch_start → first_price tirée de `turns`). `roadmap_span` est lu par OBJECTIONS. |
| OBJECTIONS | `handling_status`, `prevention_status`, `handling_score`, `prevention_score`, `episodes[]` (début, nature, thème, gestes acknowledge/isolate/explore/match (accueillir, isoler, explorer, répondre) avec citations et tours, réaction, résolution, latente, récurrence, changement de sujet), `prevention` (R1 à R3 avec citations), `deadlines_detected`, `diagnostics` | Tableau des épisodes, panneaux A · I · E · M cliquables (les tours de chaque geste), tuiles de la prévention |

Correspondances : `verbatim` (mot pour mot), `paraphrased` (reformulé), `untraced` (introuvable chez le prospect).

## Résultats par période (écran de performance)

`lnp_analyse.noyau.agregation.periode(resultats, competence, genre, aujourdhui, tz)` rend, par commercial et par compétence :
la note, l'intervalle à 95 % (Student), les taux de niveau 2 par item avec leurs intervalles de Wilson, le niveau avec la règle
du plancher, l'écart avec la fenêtre de comparaison (« stable » quand il reste dans la moitié de l'intervalle), les décomptes
par statut ; `goulot(periodes)` nomme la compétence la plus faible. Fenêtres : `7d`, `month`, `all`, dans le fuseau horaire du
commercial (Partie C, C5 et C6).

## Qualification du prospect d'un R1 (046, 2026-11-05)

Un R1 analysé porte aussi la qualification de son prospect (`analyse-appel/qualification`, règles « Qualification SQL des
appels LNP » 2.2, trois portes) : l'exécutant la lance après le moteur (`executant/executant_analyse/qualif.py`, sur les mêmes
tours), la stocke dans `crm_lead_qualifications` avec le travail (`crm_qualif_store(…, p_job)`), et `crm_ca_record(job)` la
rend sous la clé `qualification` :

```
{"status": "SQL GAGNÉ | SQL OUVERT | SQL PERDU | NON SQL | MQL EN ATTENTE | À REVOIR",
 "result": {"statut", "portes": {"metier" | "financement" | "decision_timing": {"statut": "OUVERTE | FERMÉE | NON VÉRIFIÉE", "preuve", "raisons"}},
            "offre_presentee", "base": {"issue_r1", "outcome", "motif", "date_relance"}, "solution_aware", "alertes", "confiance"},
 "verification": ["lecture 1 : …: preuve introuvable dans la transcription"], "prompt_version", "rules_version", "created_at"}
```

`verification` liste les remarques des deux lectures (citations écartées parce qu'introuvables dans la transcription, réponse
illisible). Les faits extraits (deux lectures) restent dans la table, jamais à l'écran. `crm_ca_board()` ajoute
`qualification: {status, solution_aware}` à chaque ligne de R1. Une qualification qui échoue n'arrête jamais l'analyse (pas de
ligne, l'exécutant l'écrit dans son journal).

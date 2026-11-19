# Contrat du moteur (à lire avant d'écrire un module de compétence)

Paquet : `lnp_analyse` (Python 3.11+, bibliothèque standard seulement ; `anthropic` facultatif).

## Règle d'or
Le modèle extrait et cite ; le code décide et note. Une réponse du modèle ne contient jamais de note, de niveau ni de verdict
final : seulement des réponses fermées (booléen, valeur d'une liste fermée) et des citations exactes avec leurs numéros de tour.

## Interface du noyau (ne pas modifier `noyau/` ; si un changement est nécessaire, le décrire dans le compte rendu)
- `noyau/modeles.py` : `Tour`, `Preuve(citation, tour, role)`, `CartePhases`, `Sollicitation`, `Atome`, `NoteItem`,
  `ResultatCompetence`, `ContexteAppel` (aides : `tour(id)`, `n(id)` = position, `avant(a, b)`, `fenetre(a, b)`,
  `afficher(tours)`), et `vers_dict(obj)`, qui écrit un objet du moteur au format enregistré (`CHAMPS_ENREGISTRES` : nom
  français du champ → clé enregistrée).
- `noyau/texte.py` : `normaliser`, `citation_ok(ctx, Preuve, mots_min, mots_max, phase_permise=(debut, fin))` → code d'erreur
  ou None, `approbation_seule(texte)`, `expression_cle_ok(expression_cle, texte_prospect, texte_commercial)` (GB-22 a/b/d),
  `normaliser_nombre` (PB-21), `phrases(texte)` (PB-33), `jetons_propres`.
- `noyau/executeur.py` : `TacheModele(id, palier, regles, construire(ctx, unite) → str, valider(reponse, ctx, unite) → [erreurs],
  cle(reponse), passes=3)` ; `Executeur.executer(ctx, tache, id_unite, unite) → Resolu(reponse, statut, concordance, lectures_,
  justification, libelle_cas)`. `regles` = nom du fichier de consigne dans `consignes/` (sans `.md`) ; `systeme_commun.md` est
  ajouté en tête automatiquement. Statut : `verified` (3/3), `arbitrated`, `to_review` (réponse None → l'unité sort des notes).
  ATTENTION : `valider` reçoit la chaîne `id_unite` en troisième argument (pas l'objet unité).
- `noyau/notation.py` : `item(id_, poids, niveau, preuve, remarque, deux_citations=True)` applique le plafond des deux
  citations ; `note_appel(items)` = Σ poids × niveau / 2 sur 100, le poids des items non applicables (niveau None) est réparti.
- `noyau/client_modele.py` : `ClientSimule(reponses={(id_tache, id_unite): dict | [lecture1, lecture2, lecture3, arbitre]},
  repli=fonction)`.
- `noyau/fondation.py` : déjà exécutée avant toute compétence. Elle remplit `ctx.phases.debut_presentation`, `premier_prix`,
  `demande_decision`, `fin_presentation`, `mentions_offre`, `prix_precoce`. Les tours réparés peuvent avoir des numéros comme
  `T050b`.

## Interface d'un module
Chaque module `competences/<nom>.py` expose une classe avec `nom_`, `version_regles` et
`executer(self, ctx, executeur) → ResultatCompetence`, plus des fonctions de décision pures, testables sans aucun modèle.
Découper chaque question au modèle en une petite `TacheModele` (une question fermée, une unité, une courte fenêtre de contexte,
seulement les règles utiles dans `consignes/<nom>_<tache>.md`). Les identifiants d'unité sont des chaînes déterministes
(ex. `restit:T081`).

## État partagé écrit par SPIN (lu par l'écart, la présentation, les objections)
- `ctx.phases.debut_decouverte`, `ctx.phases.fin_decouverte` (SB-1 : fin = premier début de présentation ou premier prix).
- `ctx.sollicitations` : liste de `Sollicitation` avec `lettre` dans S/P/I/N/OUT, `raison_hors`, `tours_reponse`, `approfondi`.
- `ctx.atomes` : liste d'`Atome` (type SITUATION/PAIN/BLOCKER/IMPACT/DESIRE/VALUE, preuve = citation du PROSPECT,
  `id_sollicitation`, `lettre` de cette sollicitation, libellé `objet`, `domaine`, `quantifie`, `valeur`, `unite`,
  `spontane`, `suggere_par_commercial`).

## État partagé écrit par l'écart (lu par la présentation)
`ctx.resultats["GAP"].details` contient (clés du format enregistré) :
`{"verdict": "present"|"absent", "validation_turn": "T082"|None, "restitution_span": [..],
  "selected_A": {"quote","turn","value","unit","solicitation"}|None, "selected_B": {...,"horizon"}|None,
  "selected_P": {"quote","turn","object","rule"}|None, "validated_P": {"quote","turn","key_expression"}|None,
  "roadmap_blockers": [{"object","quote","turn","solicitation"}], "cost": [...]}`.

## État partagé écrit par la présentation (lu par les objections)
`ctx.resultats["PITCH"].details` contient `"roadmap_span": [debut, fin]|None`.

## Tests
`tests/test_<nom>.py` avec pytest. Des tests de décision purs sur des `ContexteAppel` synthétiques (sans dépendre des autres
modules de compétence : remplir `ctx.atomes`, `ctx.sollicitations`, `ctx.phases`, `ctx.resultats` à la main), plus au moins
3 cas de l'annexe B de la méthodologie construits sur les vraies transcriptions de
`tests/fixtures/transcripts/NNN/transcript_compact.txt` (ou du dossier de `CALLQA_CORPUS`)
(format `[T001 00:06] SALES: texte`, déjà numéroté et étiqueté ; construire les `Tour` directement) avec des réponses simulées.
Lancer `python3 -m pytest -q tests/test_<nom>.py` depuis la racine du paquet jusqu'à ce que tout passe.

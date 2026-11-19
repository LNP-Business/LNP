# Moteur allégé (`analyse_allegee`, 2026-11-03)

Une lecture peu coûteuse d'un appel de vente : **cinq étapes du modèle sur la transcription entière au lieu d'environ 540
questions fermées posées trois fois**, le code vérifiant toujours chaque citation et décidant de chaque niveau, verdict et
note. Objectif fixé par Romain : au plus 0,10 USD par appel (estimation plus bas : environ 0,02 à 0,03 USD).

Choix (par analyse, lu par l'exécutant dans la prise en charge) : `update crm_ca_config set engine = 'lite';` (retour :
`engine = 'full'`), migration `web/supabase/035_crm_ca_engine_choice.sql`. Le moteur de référence (`analyse-appel/moteur`)
ne change pas et reste celui qui tourne par défaut.

## Ce qu'il mesure (Romain, 2026-11-03)

Règles des phases vérifiées par le code (Romain, 2026-11-03, `phases.py`) : le premier prix est le prix du commercial
**pour l'offre**, avec le tour du commercial, cité, qui explique cette offre (`lnp_offer_price`, `offer_explained`) ; une
mention de l'offre suivie d'une question de découverte citée est une mention, pas le début de la présentation
(`next_discovery_question`) ; un prix valide avant le début de la présentation ramène le début de la présentation à
l'explication de l'offre. Un appel sans question de découverte, sans présentation et sans prix : écart `not_applicable`
(non applicable). Expressions clés (GB-22) : quand le modèle copie toute la phrase du prospect au lieu des mots que le
commercial reprend, le code garde la plus longue suite de mots du modèle qui est à la fois dans la source et dans la
proposition du commercial et qui n'est pas générique (`key_expression:narrowed_by_code`, `ecart.expression_cle_partagee`) ;
la consigne S2 dit aussi qu'une conséquence vécue à cause du problème (dépendre d'un parent, l'épuisement…) est un COST
(coût), pas un PROBLEM (problème).

1. Chaque question que le commercial pose **dans la découverte** : jusqu'à ce que l'écart soit fait (sa validation), ou
   avant la présentation quand aucun écart n'est fait (SB-1, Romain 2026-11-03), avec sa **lettre SPIN** et son
   **registre** (Financier, Temps et charge, Identité et statut, Mental et émotionnel, Autre ; SB-26 à SB-35), et la
   réponse du prospect.
2. L'**écart** restitué, avec la méthodologie Écart 1.3 (porte d'absence, règle du mot pour mot GB-22, formule GB-28 à
   GB-34).
3. La **présentation de l'offre**, avec la méthodologie Présentation 2.0 (porte de conformité, escalier, feuille de route,
   affirmations, promesses, adhésion).
4. Les **objections levées après le premier prix seulement** (OB-27), chaque objection **une seule fois** (ses reprises
   réunies, avec toutes leurs citations), et **A · I · E · M** sur chacune ; plus les faits de prévention avant le premier
   prix.

## Les étapes

Toutes les étapes passent par la passerelle `callqa-llm`, au palier `fast` (rapide) de `crm_ca_config.tiers`
(claude-haiku-5-5), effort `low` (réflexion activée, courte ; `CALLQA_LITE_EFFORT` le change). Les règles communes
(`consignes/systeme.md`) et la transcription (`T001 [SALES] texte`, une ligne par tour) sont les deux mêmes premiers blocs
de chaque appel : la passerelle les met en cache (champ `prefix`), donc la transcription est écrite une fois dans le cache
et relue par les étapes suivantes. Chaque consigne d'étape est un court résumé des règles B (de bornage) de sa compétence
et un schéma JSON strict. Une réponse qui n'est pas un JSON valide est redemandée une fois avec l'erreur ; encore
invalide, la compétence est `to_review` (à revoir, raison `engine_error`) ; si la carte des phases ou la plupart des
étapes échouent, l'analyse s'arrête (`ErreurModeleAllege`, transmise à l'exécutant comme `ErreursModele`, jamais
relancée telle quelle).

| Étape | Ce qui est demandé | Ce que fait ensuite le code |
|---|---|---|
| S0 `lite.s0_phases` | chaque tour du commercial avec une description de l'offre, un partage d'écran, un montant pour l'offre ou une demande de décision, avec les signaux fermés du moteur (`foundation.phases`) | vérifie chaque citation (tour SALES) et place les repères avec `decider_phases` du moteur (PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) et `fin_decouverte` (SB-1) |
| S1 `lite.s1_discovery` | chaque sollicitation du commercial avant le premier début de présentation ou le premier prix : citation exacte, lettre (portes dans l'ordre, raison OUT), objet, question sur ce qui arrête le prospect, domaine et fondement du registre avec citation, la réponse du prospect, les atomes de la réponse (SITUATION … VALUE, avec les champs d'atome du moteur). Blocs de 160 tours ; une réponse coupée par `max_tokens` est redemandée en deux moitiés | écarte une question qui n'est pas un extrait exact d'un tour SALES ou qui vient après la présentation (SB-34) ; règles dures du §3 (une queue de validation ou une question de valeur fermée → OUT agreement) ; périmètre (SB-1, SB-2) ; plages de réponse (SB-5 à SB-8, `plages_reponse` du moteur) ; chaque atome doit être un extrait exact d'un tour PROSPECT de la plage de réponse de sa question (`_valider_atomes` du moteur), puis les décisions du moteur sur les atomes (`construire_atomes` : SB-9 à SB-24) ; approfondissements (SB-17, SB-19) ; chaînes (`trouver_chaines`, SB-16 à SB-20) ; vérifications du registre (`_valider_registre` du moteur, SB-32 : place de la citation, ordre des règles, conflit avec les listes de mots) ; items D1 à D5 (`noter_items`) |
| S2 `lite.s2_gap` | chaque passage de restitution jusqu'au premier prix : ses tours du commercial, chaque proposition restituée (composante, citation du commercial, tour source, expression clé), une question sur un nouveau sujet à la fin, la validation lue sur le tour du prospect juste après ; les échéances attachées à un objectif | fait tourner `CompetenceEcart` du moteur sans changement : ses questions fermées (`gap.restitution`, `gap.validation`, `gap.a_current`, `gap.stopping`, `gap.horizon`) reçoivent leur réponse de S2 et de S1 et sont vérifiées par les validateurs du moteur ; la règle du mot pour mot GB-22, la formule, la porte, G1 à G6 sont le code du moteur. Un passage que le modèle a trouvé et que l'inventaire du code a manqué est ajouté comme candidat (signal `S5_lite`) |
| S3 `lite.s3_pitch` | en une seule réponse, les questions de présentation du moteur : catégorie du P validé, étapes 1 à 4, feuille de route, affirmations, promesses de résultat, adhésion | fait tourner `CompetencePresentation` du moteur sans changement (réponses en liste coupées selon ses blocs) ; porte de conformité (PB-37 présentation après le oui, PB-35 affirmations, PB-36 promesses), K1 à K7 sont le code du moteur. Le code décide si la présentation vient après l'écart, à partir du tour de validation de l'écart ; ce n'est jamais demandé |
| S4 `lite.s4_objections` | chaque résistance différente une seule fois, ses sujets et toutes ses citations ; pour le premier passage : changement de sujet, accueillir, isoler, explorer, geste adapté, réaction ; les faits de prévention | voir plus bas |

S4 dans le code (`objections.py`) : une citation doit être un extrait exact d'un tour PROSPECT ou d'un co-décideur **après
le premier prix** (avant : écartée et comptée) ; la nature vient des sujets avec les tests de frontière d'OB-3
(`nature_des_sujets`, OB-24) ; les objections de même nature et de même thème, ou qui partagent une citation, sont réunies
en une seule avec toutes leurs citations ; un épisode par objection : réponse = les tours du commercial depuis son premier
passage jusqu'au changement de sujet (celui du modèle, vérifié : un tour SALES avant l'objection suivante), réaction = les
tours du prospect après la première réponse ; une citation de la même objection dans la réaction est une répétition (elle
persiste), une citation après l'épisode une récurrence (H5 = 0). Accueillir, isoler, explorer, le geste, la résolution, la
latence, les items H1 à H5, la prévention R1 à R3, la combinaison 70/30 : les fonctions du moteur (`accueilli`,
`isolement_valide`, `exploration`, `niveau_h1`, `niveau_h3`, `niveau_resolution`, `est_latent`, `items_episode`,
`items_prevention`, `combiner`), chaque lecture d'un geste vérifiée par le validateur de la tâche du moteur.

Jamais demandé au modèle : une note, un niveau, un verdict, l'ordre des phases, si une composante est reprise mot pour mot.

## L'analyse enregistrée

La même analyse enregistrée que `lnp_analyse.chaine_analyse.enregistrement_resultat` (`docs/CONTRAT_DE_SORTIE.md`),
enregistrée par `crm_ca_store` et lue par `app/crm/call_analysis_view.js` (vérifiée dans un navigateur avec une analyse du
moteur allégé : vignettes d'en-tête, lignes de découverte par registre avec les pastilles des lettres et le panneau
question + réponse, le panneau de l'écart et ses quatre vérifications, l'escalier et le mot pour mot de la présentation, le
tableau des objections avec A · I · E · M), plus :

- `meta` : `{"engine": "lite", "version": "callqa-lite-1.0", "tier", "effort", "failed_steps", "steps": {S0..S4:
  {"dropped": n, "reasons": {...}}}}` ; 035 garde `meta.engine`, `meta.engine_version` et `meta.engine_steps` dans
  `crm_ca_records.meta` ;
- `concordance: "single_reading"` (lecture unique) sur chaque compétence ; SPIN `solicitations[].status =
  "single_reading"`, chacune avec sa `quote` et sa `answer` ; SPIN `registers.agreement = null` (une seule lecture :
  l'accord 3/3 n'est pas mesuré, pas de signal `register_agreement_low`) ;
- OBJECTIONS `episodes[].quotes` (chaque passage de l'objection) et `merged_items` ;
- `details.lite` sur l'écart, la présentation et les objections (unités répondues, ce qui a été écarté) ;
- l'audit : une entrée par appel du modèle (tâche, unité, essai, palier, empreinte de la consigne, réponse, erreurs, raison
  d'arrêt).

`crm_ca_jobs.usage` garde comme avant les jetons consommés par palier, plus `engine` et `effort` ;
`analyse_allegee.cout.estimer` les convertit en USD.

## Estimation du coût (appel de 60 minutes, environ 15 000 jetons de transcription)

Prix indiqués pour claude-haiku-5-5 (USD par million de jetons) : entrée 0,10, sortie 0,50, lecture du cache 0,01,
écriture du cache 0,125 (`cout.PRIX`, à vérifier sur la grille de prix du fournisseur).

| Appel | Préfixe en cache (règles ≈ 500 + transcription 15 000) | Consigne de l'étape (hors cache) | Sortie (réponse + courte réflexion) |
|---|---|---|---|
| S0 | écrit : 15 500 | ≈ 600 | ≈ 1 500 + 1 000 |
| S1 (1 ou 2 blocs pour une découverte de 30 à 40 minutes et de 60 à 100 questions) | lu : 15 500 par bloc | ≈ 1 700 par bloc | ≈ 10 000 + 2 000 en tout |
| S2 | lu : 15 500 | ≈ 1 400 + ≈ 1 500 d'énoncés | ≈ 2 500 + 1 000 |
| S3 | lu : 15 500 | ≈ 1 900 + références | ≈ 3 000 + 1 000 |
| S4 | lu : 15 500 | ≈ 1 600 | ≈ 3 000 + 1 000 |

Avec deux blocs S1 : écriture du cache 15 500 × 0,125 = 0,0019 ; lectures du cache 5 × 15 500 × 0,01 = 0,0008 ; consignes
des étapes ≈ 12 000 × 0,10 = 0,0012 ; sortie ≈ 26 000 × 0,50 = 0,013. **Environ 0,017 USD par appel ; environ 0,03 USD
avec une nouvelle demande de S1 et une réflexion plus longue**, sous l'objectif de 0,05 et bien sous 0,10. (Mesuré avant :
3,12 USD avec Sonnet / Opus, 0,22 USD avec tous les paliers sur Haiku et sans réflexion.) Le premier appel écrit le cache,
donc les étapes tournent l'une après l'autre ; le cache vit 5 minutes, assez pour les cinq étapes d'un appel. À mesurer par
le responsable sur de vrais appels (`crm_ca_jobs.usage`).

Les consignes sont en français depuis le 2026-11-19 : le nombre de jetons des consignes d'étape (colonne du milieu) est à
mesurer de nouveau ; l'estimation ci-dessus a été faite avec les consignes en anglais.

## Approximations par rapport à la méthodologie (chacune aussi dans `docs/DECISIONS_OUVERTES.md`, section E)

1. **Une seule lecture, pas d'arbitre** (Partie C, C4). Chaque fait est lu une fois ; il n'y a ni concordance ni
   arbitrage. C4 n'autorise une seule lecture qu'après 95 % de reproductibilité sur la version actuelle des règles : les
   résultats du moteur allégé sont `single_reading` et doivent rester « provisoires » jusqu'à ce que ce soit mesuré.
2. **Une preuve invalide est écartée item par item**, pas redemandée (C3, règle 7, redemande une unité une fois, puis
   `to_review`) : un atome, une proposition, une affirmation ou un geste non prouvé compte comme non dit / non fait ;
   l'étape entière n'est redemandée qu'une fois, seulement quand son JSON est invalide. Les comptes par raison sont dans
   `meta.steps`.
3. **Pas de vérification de l'attribution** (C1 : tours fusionnés, inversés ou en écho) : seule la porte de diarisation du
   code tourne. Un appel aux tours mal étiquetés n'est pas réparé et ses citations peuvent être rejetées comme
   `wrong_speaker` (mauvais locuteur).
4. **Lettres SPIN** : le modèle donne la lettre après avoir passé les portes de la consigne, au lieu de répondre à chaque
   porte avec sa preuve (§3) ; le code impose les règles dures qu'il peut lire dans le texte (queue de validation, question
   de valeur fermée) mais pas « valeur sur l'offre » ni « charge d'une solution » (elles reposent sur la raison OUT du
   modèle). La segmentation (SEG-1 à SEG-8) est la liste du modèle, pas l'inventaire du code. SB-21 (un N de plan
   d'action sans état futur) est laissé à la raison OUT `solution_load` du modèle.
5. **Chaînes SPIN** : « même objet » (SB-16) = les objets donnés par le modèle concordent et la vérification lexicale du
   moteur (`lien_lexical`) passe, au lieu d'une question `spin.link` par paire.
6. **Registres** : une seule lecture, donc la mesure de fiabilité de SB-33 (part décidée à 3/3, 92 %) n'est pas calculée
   (`agreement: null`). Les vérifications du code de SB-32 tournent toujours (place de la citation, ordre des règles,
   conflit avec les listes de mots) ; un registre rejeté est `to_review` et laissé hors des comptes.
7. **Écart** : la vérification X13 (un chiffre qui n'est pas l'état présent) utilise le `figure_kind` de l'atome donné par
   S1 (un chiffre sans nature compte comme présent) ; la question sur ce qui arrête le prospect (GB-30) est le signal de S1
   (l'expression régulière du moteur s'applique toujours d'abord). La validation doit être lue sur le tour du prospect
   juste après le passage (GB-8, code) : une lecture d'un autre tour met l'unité `to_review`.
8. **Objections** : (a) seulement les résistances après le premier prix (OB-27, Romain, 2026-11-03 ; le moteur applique la
   même règle). (b) Une objection par nature et par thème : les reprises dans l'épisode sont une répétition (elle
   persiste), après lui une récurrence (H5 = 0), et deux natures dans un passage (OB-4) sont réunies en une seule quand
   elles partagent une citation. (c) Le changement de sujet (OB-8) est la réponse unique du modèle, vérifiée comme tour
   SALES avant l'objection suivante, pas le parcours tour par tour, par le code et des questions, du moteur. (d) Les
   échéances trouvées à la détection (OB-2, OB-25) n'alimentent pas la prévention ; seuls les faits de prévention de S4
   le font.
9. **Langue** : les consignes sont en français depuis le 2026-11-19 (Romain : « tout ce qui touche à l'analyse d'appel
   doit être écrit et codé en français ») ; les noms de champs et les valeurs fermées des schémas JSON restent en anglais,
   et le modèle cite l'appel dans sa langue (français ou anglais). Les listes de mots du code (approbations, queues de
   validation, glissement de personne de GB-22, mots vides) viennent du moteur de référence et reçoivent maintenant les
   tournures françaises, à côté des tournures anglaises des transcriptions de référence des tests ; le moteur allégé n'a
   pas de liste à lui et les applique telles quelles (test `test_une_queue_de_validation_francaise_met_la_question_hors_accord`,
   ignoré tant qu'une tournure manque au moteur de référence).
10. **Écran** : le tableau des objections montre la première citation de chaque objection (`resistance.quote`) ; les
    autres citations sont dans `episodes[].quotes` jusqu'à ce que l'écran les lise.

## Fichiers

`analyse_allegee/moteur.py` la chaîne (`analyse`) · `etapes.py` appels du modèle, JSON, nouvelle demande, client simulé
(`ClientAllegeSimule`) · `adaptateur.py` l'interface d'exécuteur du moteur, répondue depuis une étape (`ExecuteurEtape`,
`Rejets`) · `phases.py` S0 · `spin.py` S1 → SPIN · `ecart.py` S2 → écart · `presentation.py` S3 → présentation ·
`objections.py` S4 → objections · `cout.py` · `consignes/*.md` (en français ; schémas JSON en anglais) · `tests/` (appel
fictif `appel_synthetique.py`, en anglais, aucune vraie donnée).

```
cd analyse-appel/allege && python3 -m pytest -q tests
```

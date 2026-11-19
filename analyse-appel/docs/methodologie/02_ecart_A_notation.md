# Compétence 2 · Formalisation de l'écart
_Méthodologie de notation : comment le système mesure si le commercial a transformé la découverte en un écart dit par le prospect, restitué par le commercial et validé par le prospect avant la présentation de l'offre_

**Version :** version 1.3 · 25 octobre 2026  
**Statut :** brouillon à faire valider par le responsable de la méthodologie. Les valeurs marquées « à valider » sont des propositions.  
**Périmètre :** appels de vente avec une phase de découverte. Sources : référence des verbatims LNP v2 (état actuel, état désiré, décision), référence de bornage SPIN LNP v1.0 (restitution), analyse de 85 vrais appels.  
# 1. Ce que mesure cette compétence

**Définition.** L'écart est la distance entre là où le prospect en est aujourd'hui (point A) et là où il veut être (point B), le problème qui l'empêche de franchir cette distance seul, et ce que ce problème lui coûte. Formaliser l'écart, c'est le rendre explicite et partagé **avant** que l'offre soit présentée : le commercial le restitue avec les mots du prospect et le prospect le valide.

**Ce que veut dire réussir, en une phrase.** Le commercial a réussi quand, avant la première présentation de l'offre et le premier prix, il a restitué le problème du prospect et le coût de ce problème avec les propres mots du prospect, et que le prospect a validé cette restitution ; l'écart est d'autant plus fort que les points A et B sont chiffrés dans la même unité et que le prospect ajoute quelque chose de lui en validant.

**La règle d'absence (exclusion stricte).** **Si, avant la première présentation de l'offre, il n'y a pas eu de restitution du problème du prospect et du coût de ce problème, validée par le prospect, l'écart est considéré comme absent.** L'appel reçoit alors 0 sur cette compétence, quoi qu'on ait recueilli pendant la découverte. Recueillir les éléments, c'est la découverte ; les formaliser, c'est l'écart. Sans restitution validée, la présentation de l'offre n'a ni problème partagé ni coût partagé auquel répondre, et le prix n'est comparé à rien.

**Le principe du mot pour mot (gouverne chaque règle de cette compétence).** L'écart appartient au prospect : il n'est construit qu'avec les mots exacts du prospect.
1. **Chaque composant est une citation du prospect.** PROBLEM, COST, A et B n'existent que comme citations exactes de tours du prospect, vérifiées caractère pour caractère sur la transcription (partie C, C3). Rien de ce que le commercial a dit en premier, calculé ou suggéré n'est jamais un composant, même si le prospect l'a approuvé.
2. **La restitution rend au prospect ses mots.** Un composant restitué ne compte que si la proposition du commercial contient l'**expression clé** du prospect pour ce composant, copiée à l'identique (annexe A, GB-3 et GB-22). Une paraphrase, un synonyme, un résumé avec les mots du commercial ou un changement de forme du mot (« stressé » restitué en « stress ») ne compte pas, aussi fidèle soit-il.
3. **Les chiffres sont ceux du prospect.** Un nombre ne compte que si le prospect l'a dit ; un nombre arrondi, converti ou calculé est le nombre du commercial.
4. **La validation se lit dans les mots du prospect.** Son issue est prouvée par une citation exacte du prospect ; « avec contenu » veut dire un contenu dans les propres mots du prospect, cité.

# Partie A · Définitions
Les règles qui trouvent chaque élément dans une transcription brute (unités, marqueurs de début et de fin, segmentation, exclusions et paires minimales) sont dans l'**annexe A · Règles de bornage**. L'**annexe B** donne de vrais cas annotés pour la calibration. Un verdict qu'on ne peut pas atteindre avec ces règles va à l'arbitre comme cas non couvert.

# 2. Les quatre composants

| Composant | Définition | Obligatoire pour que l'écart existe ? | Vient de (référence des verbatims v2) |
|---|---|---|---|
| PROBLEM (P) | Ce qui ne marche pas et empêche le prospect d'atteindre B : un manque, un blocage, une peur, un échec passé, une contrainte. **Un seul blocage** est restitué (§2.1) | **Oui** | Réponses aux sollicitations **P** (SPIN) ; CURRENT_STATE (douleur), atomes BLOCKER, anxiété, tentative passée |
| COST | Ce que le problème coûte au prospect, ou ce que lui coûte de rester dans la situation actuelle : argent, temps, clients, famille, santé, confiance en soi, occasion perdue | **Oui** | CURRENT_STATE avec une conséquence ou un chiffre, atomes IMPACT, coût de l'inaction |
| A · État actuel | Là où le prospect en est aujourd'hui : **le chiffre qu'il veut faire bouger**, pas le plus gros chiffre de l'appel | Non (noté) | Réponses aux sollicitations **S** et **I** (SPIN) ; CURRENT_STATE, atomes SITUATION |
| B · État désiré | Là où le prospect veut aller : son objectif, **dans la même unité que A**, avec son échéance s'il en a donné une | Non (noté) | Réponses aux sollicitations **N** (SPIN) ; DESIRED_STATE, atomes DESIRE |

**Unité.** La dimension dans laquelle A et B sont exprimés : chiffre d'affaires mensuel, nombre de clients, heures par semaine, statut, date. Deux affirmations ont la même unité quand le code peut calculer une différence entre elles.

**Chiffré.** Une affirmation est chiffrée quand elle attache au composant un nombre, un montant, une durée, une fréquence ou une date.

**Horizon.** Une date ou une durée attachée à B. On distingue une échéance **contraignante** (extérieure, vérifiable : « mon contrat se termine en mars ») d'un délai **souhaité** (« j'aimerais commencer bientôt »).

**Restitution, validation, écart valable.** Les règles exactes qui repèrent une restitution, ses composants et sa validation dans une transcription sont dans l'annexe A (Règles de bornage). En bref :
- une **restitution** est un passage du commercial qui restitue au moins deux composants, chacun contenant l'expression clé exacte du prospect pour ce composant ;
- une **validation** est la réponse du prospect à cette restitution : confirmée avec contenu, confirmée, corrigée, rejetée ou aucune ;
- un **écart valable** est une restitution qui contient PROBLEM et COST, placée avant la première présentation de l'offre et le premier prix, et confirmée par le prospect (avec ou sans contenu, ou corrigée puis confirmée).


## 2.1 La formule de l'écart : quel A, quel B, quel P

La restitution de l'écart suit une phrase, remplie avec les propres mots du prospect :

> **« Tu es à [A] · tu veux atteindre [B] · et ce qui te bloque aujourd'hui, c'est [P]. »** (version anglaise : « You're at [A] · you want to get to [B] · and what's holding you back today is [P]. »)

Le coût de P s'ajoute à cette phrase, avec les mots du prospect : il reste obligatoire pour que l'écart existe (règle d'absence).

| Case | Ce que c'est | D'où ça vient | Règle de sélection (annexe A) |
|---|---|---|---|
| **A** · Là où il en est | Le chiffre qu'il veut faire bouger, pas le plus gros chiffre de l'appel | Réponses du prospect aux sollicitations **S** et **I** | La valeur actuelle sur la dimension que vise B (GB-28) |
| **B** · Là où il veut aller | Son objectif, dans la même unité que A ; son échéance s'il en a donné une | Réponses du prospect aux sollicitations **N** | L'objectif exprimé dans l'unité de A (GB-29) |
| **P** · Ce qui le bloque | **Un seul blocage** | Réponses du prospect aux sollicitations **P** | Le blocage qu'il a nommé quand on lui a demandé ce qui l'arrête ; sinon celui auquel il revient le plus (GB-30) |

**Les autres blocages ne sont pas perdus.** Chaque autre blocage que le prospect a dit en réponse à une sollicitation P ou I devient une étape de sa feuille de route, présentée dans la présentation de l'offre. Une feuille de route de 3 étapes demande au moins 3 blocages distincts relevés dans des réponses P ou I ; en dessous, **le Copilot avertit le commercial avant de générer la page de la feuille de route** (GB-33). Le compte de la feuille de route est un diagnostic : il ne change jamais la note de l'écart.

**Ce que le système sélectionne, ce que le commercial doit dire.** Le code sélectionne A, B et P dans les citations du prospect avec les règles de l'annexe A (GB-28 à GB-30), avant de lire la restitution. Il vérifie ensuite si la restitution reprend **ces** A, B et P, mot pour mot (GB-22), avec un seul blocage (GB-31). Une restitution qui reprend un autre chiffre, une autre unité ou plusieurs blocages peut quand même passer la porte d'absence si elle contient un PROBLEM et un COST mot pour mot, mais elle ne peut pas atteindre le niveau 2 en G5.

# Partie B · Mécanisme et notation

Les rôles des tours de parole s'écrivent comme dans la transcription : `SALES` (le commercial), `PROSPECT` (le prospect), `OTHER` (une autre personne).

# 3. Ce que le système extrait

**Chez le prospect (périmètre de la découverte et toute réouverture) :**

| Champ | Question fermée posée au modèle | Preuve |
|---|---|---|
| `A_statements` | Quels passages du prospect décrivent l'état actuel sur une dimension liée à l'objectif ? | Citation exacte du prospect, tour, unité, valeur si chiffrée |
| `B_statements` | Quels passages du prospect décrivent un état désiré ou un moyen nécessaire ? Exclure l'intérêt exprimé après la première présentation de l'offre | Citation exacte, unité, valeur, horizon, contraignant ou souhaité |
| `problem_statements` | Quels passages du prospect nomment ce qui ne marche pas ou ce qui l'empêche d'atteindre B ? | Citation exacte ; type : compétence, temps, argent, peur, échec passé, contrainte extérieure |
| `cost_statements` | Quels passages du prospect disent ce que le problème lui coûte, ou ce que lui coûte de rester comme il est ? | Citation exacte, domaine, chiffré oui / non |
| `prompted_by_sales` | Pour chaque passage : le contenu a-t-il été énoncé d'abord par le commercial et seulement approuvé ? | oui / non |

**Chez le commercial et dans la réponse du prospect (annexe A) :**

| Champ | Question fermée posée au modèle | Preuve |
|---|---|---|
| `restitutions` | Quels passages du commercial sont des restitutions (règles GB-1 à GB-7) ? | Plage de tours, citation exacte du commercial |
| `components` | Pour chaque restitution : quels composants restitue-t-elle, de quelle affirmation antérieure du prospect vient chacun, et quels mots exacts du prospect reprend-il ? | Citation exacte du commercial par composant ; identifiant et citation exacte de l'affirmation source du prospect ; l'expression clé (GB-22), copiée depuis la source |
| `validation` | Quelle est la réponse du prospect (règles GB-8 à GB-10) ? | Issue, citation exacte du prospect |

**Sélectionné par le code (formule de l'écart, §2.1) :** `selected_A` (GB-28), `selected_B` (GB-29), `selected_P` (GB-30) et `roadmap_blockers`, les blocages distincts dits dans des réponses P ou I (GB-32). La lettre SPIN de chaque sollicitation vient de la référence de bornage SPIN ; l'étiquette d'objet de chaque blocage vient de l'annexe SPIN (SB-16).

**Calculé par le code :** la phase de chaque restitution (avant ou après la première présentation de l'offre et le premier prix) ; le contrôle mot pour mot de chaque expression clé (sous-chaîne exacte de la source du prospect et de la proposition du commercial, avec seulement les transformations permises par GB-22) ; `same_unit` et `gap_value` (B − A) ; le verdict d'écart valable ; l'écartement des passages soufflés, des tours de simple approbation et du revenu actuel présenté comme un coût.

# 4. Applicabilité

| Situation | Statut de l'écart |
|---|---|
| Le périmètre de la découverte existe, une présentation de l'offre ou un prix suit dans l'appel | `scored` (la règle d'absence s'applique) |
| Le périmètre de la découverte existe, l'appel se termine avant toute présentation de l'offre ou tout prix (présentation reportée à un deuxième appel) | `scored` sur les restitutions de l'appel ; la règle d'absence s'applique à la fin de l'appel |
| Appel de relance où la présentation de l'offre reprend après un premier appel du même cycle | `scored` : un écart valable doit être restitué et validé à nouveau dans cet appel avant que la présentation reprenne ; les affirmations du premier appel peuvent servir de sources aux composants |
| Ni découverte ni restitution, pas de présentation de l'offre | `not_applicable` |
| Attribution des locuteurs suspecte | `excluded` |

# 5. La note de l'écart

### 5.1 Étape 1 : la porte d'absence

Le code vérifie, dans cet ordre :
1. Il existe au moins une restitution avant la première présentation de l'offre et avant le premier prix.
2. Parmi elles, au moins une restitue PROBLEM et COST **d'un seul tenant** (les deux dans la même restitution, annexe A GB-34), chacun **mot pour mot** : la proposition du commercial contient l'expression clé exacte du prospect pour ce composant (annexe A, GB-3 et GB-22). Un composant paraphrasé ne compte pas.
3. Cette restitution est suivie d'une issue de validation `confirmed_with_content`, `confirmed`, ou `corrected` suivie d'une version restituée à nouveau et confirmée.

Si un contrôle échoue : **verdict « Écart absent », note de l'appel = 0**, mention affichée sur la carte de l'appel avec la raison (`no_restitution`, `restitution_after_pitch`, `problem_missing`, `cost_missing`, `not_validated`). Les items ci-dessous sont quand même calculés et affichés comme diagnostics (« éléments recueillis mais pas formalisés »), jamais comme une note.

### 5.2 Étape 2 : la note d'un écart présent

Quand la porte est passée, six items notés 0, 1 ou 2. **Note de l'appel = Σ (poids × niveau / 2)**, arrondie, sur 100.

| Item | Poids | Niveau 0 | Niveau 1 | Niveau 2 |
|---|---|---|---|---|
| G1 Point A | 10 | Aucune affirmation A du prospect dans les réponses S ou I | A dit, non chiffré | A chiffré par le prospect, sur la dimension que vise B (GB-28) |
| G2 Point B | 10 | Aucune affirmation B du prospect dans les réponses N | B dit, non chiffré | B chiffré par le prospect dans l'unité de A, avec un horizon |
| G3 Écart mesurable | 10 | Pas de A et B chiffrés dans la même unité | (pas de niveau 1) | A et B chiffrés ont la même unité ; `gap_value` calculable |
| G4 Coût du problème | 20 | Coût restitué, mais l'affirmation de coût du prospect lui-même n'est pas chiffrée et reste générale (« c'est dur ») | Coût dit par le prospect dans un domaine concret, non chiffré | Coût chiffré par le prospect (argent, heures, mois perdus) |
| G5 Qualité de la restitution | 25 | (impossible une fois la porte passée) | PROBLEM et COST restitués mot pour mot, mais la formule est incomplète : A ou B manque, n'est pas mot pour mot ou n'est pas celui sélectionné ; plusieurs blocages restitués comme ce qui le bloque ; ou un blocage autre que le P sélectionné | La formule est complète : A sélectionné, B sélectionné et l'unique P sélectionné, plus le COST, tous mot pour mot (GB-31), avec au moins une expression clé de 3 mots ou plus ou un chiffre du prospect |
| G6 Validation | 25 | (impossible une fois la porte passée) | Confirmée (simple accord), ou corrigée puis confirmée | Confirmée avec un contenu venant du prospect |

Un écart qui passe la porte reçoit donc au moins 25 (G5 = 1, G6 = 1).

**Règle des deux citations.** G4 au niveau 2 demande la citation du coût chiffré par le prospect ; G5 au niveau 2 demande, pour chacun des quatre composants, la citation du commercial et la citation source du prospect qui contiennent la même expression clé ; G6 au niveau 2 demande la citation du prospect qui montre le contenu ajouté.

**Pourquoi ces poids.** La restitution et sa validation (50) sont ce qui fait exister l'écart et le rend partagé. Le coût (20) est ce qui sera mis en balance avec le prix. A, B et leur unité commune (30) rendent l'écart mesurable. Propositions, à valider.

# 6. Comment le système sait que le commercial a réussi

1. **L'écart a été redit au prospect avant l'offre.** Une restitution est repérée par les règles de bornage de l'annexe A, et sa place avant la première présentation de l'offre et le premier prix est vérifiée sur les numéros de tour.
2. **Elle contient le problème et son coût, avec les mots du prospect.** Chaque composant restitué doit contenir l'expression clé exacte du prospect, trouvée par le code dans un tour antérieur du prospect et dans la proposition du commercial. Une paraphrase ne compte pas ; un coût introduit pour la première fois par le commercial ne compte pas.
3. **Le prospect l'a validée.** La validation se lit dans la réponse du prospect à cette restitution, pas à une autre question ; une correction doit être prise en compte et validée à nouveau.
4. **Sinon, l'écart est absent.** La porte est binaire et calculée par le code ; un appel ne peut pas gagner de points d'écart avec des éléments recueillis mais jamais formalisés.
5. **Trois lectures concordent.** Les plages de restitution, les composants et la validation viennent de trois passes concordantes ou d'une décision arbitrée (partie C, C4).

# 7. Diagnostics d'accompagnement (affichés, jamais notés)

| Diagnostic | Calcul |
|---|---|
| Raisons d'absence | Répartition de `no_restitution`, `restitution_after_pitch`, `problem_missing`, `cost_missing`, `not_validated` sur la période |
| Recueilli mais pas formalisé | Pour les écarts absents : quels composants le prospect avait dits (le commercial avait donc la matière) |
| Valeur de l'écart | `gap_value` par appel, avec son unité |
| Horizon contraignant ou souhaité | Part des appels où B a une échéance contraignante |
| Moment de la restitution | Minutes entre la dernière question de découverte et la restitution ; minutes entre la validation et la première présentation de l'offre |
| Corrections | Restitutions corrigées par le prospect, et si le commercial a restitué à nouveau après la correction |
| Conformité à la formule | Part des restitutions qui disent le A, le B et l'unique P sélectionnés ; écart le plus fréquent (`A_not_selected`, `unit_mismatch`, `several_blockers`, `P_not_selected`) |
| Matière de la feuille de route | Nombre de blocages distincts relevés dans des réponses P ou I par appel ; part des appels qui en ont moins de 3 (`roadmap_insufficient_blockers`, l'avertissement du Copilot) |

**Référence observée sur Valentino (85 appels, de juin à octobre 2026, indicateurs indirects mesurés avant cette version) :** point A chiffré par le prospect dans 93 % des appels avec découverte, point B dans 89 %, une restitution d'au moins deux composants avant la présentation de l'offre dans 84 %. La présence du coût dans la restitution et la validation par le prospect n'ont pas été mesurées ; la part des écarts qui passent la porte d'absence est donc inconnue et c'est le premier chiffre à établir.

# 8. Exemples commentés
Cas d'illustration, adaptés et raccourcis à partir de vrais appels. En production, chaque preuve est une citation exacte vérifiée sur la transcription.

| Cas | Verdict |
|---|---|
| Restitution avant la présentation de l'offre : « Donc ça fait trois ans que tu fais ça gratuitement, ça te coûte à peu près 2 000 € par mois que tu pourrais gagner, et tu veux que ça remplace ton salaire de 4 000 €. C'est bien ça ? » Prospect : « Oui, et franchement mon mari n'y croit pas non plus. » | Porte passée (problème, coût, validation). G4 = 2 ; G5 = 2 seulement si chaque composant reprend les mots exacts du prospect (le prospect avait dit « à peu près 2 000 € par mois », « trois ans », « gratuitement », « remplacer mon salaire ») ; G6 = 2 |
| Restitution : « Donc tu veux t'y mettre à plein temps et ce qui t'arrête, c'est la confiance. » Prospect : « Exactement. » Aucun coût restitué | Écart absent, raison `cost_missing` |
| Le prospect a dit « j'ai perdu deux ans à ne rien faire » pendant la découverte, mais le commercial passe directement de la découverte à « Je partage mon écran » | Écart absent, raison `no_restitution` (diagnostic : le problème et le coût avaient été recueillis) |
| Restitution complète donnée après le partage d'écran du programme | Écart absent, raison `restitution_after_pitch` |
| Restitution avec problème et coût, puis dans le même tour : « …et tu pourrais y mettre combien d'heures par semaine ? » Prospect : « Sûrement 10. » | Écart absent, raison `not_validated` (la réponse répond à la dernière question, pas à la restitution) |
| Le prospect corrige : « C'est pas 4 000, plutôt 3 000. » Le commercial restitue avec 3 000, prospect : « Exactement. » | Porte passée sur la deuxième restitution, G6 = 1 |
| Le prospect a dit « je suis très stressée, j'ai quasiment plus aucune motivation ». Restitution : « …et ça te pèse, tu es à bout. » Prospect : « Ouais. » | COST paraphrasé (aucune expression clé du prospect) : pas un composant. Si aucun autre coût n'est restitué mot pour mot, écart absent, raison `cost_missing` |
| La restitution introduit un coût que le prospect n'a jamais dit (« et j'imagine que ça te fait perdre le sommeil »), prospect : « Ouais. » | Coût sans source chez le prospect : si c'est le seul coût, écart absent, raison `cost_missing` |

# 9. Contrat de sortie

```
{
  "call_id": "…", "competence": "GAP", "rules_version": "GAP-1.3",
  "status": "scored", "verdict": "present", "absence_reason": null, "score": 80,
  "gap": {"A": {"value": 2500, "unit": "USD/month", "quote": "…", "turn": "T088"},
          "B": {"value": 10000, "unit": "USD/month", "horizon": "12 months", "binding": false,
                "quote": "…", "turn": "T102"},
          "gap_value": 7500,
          "problem": [{"type": "fear", "quote": "…", "turn": "T120"}],
          "cost": [{"domain": "money", "quantified": true, "quote": "…", "turn": "T126"}]},
  "restitution": {"span": ["T146", "T146"], "before_first_pitch": true, "before_first_price": true,
                  "components": {"PROBLEM": {"source": "T120", "key_expression": "…", "match": "verbatim"},
                                 "COST": {"source": "T126", "key_expression": "…", "match": "verbatim"},
                                 "A": {"source": "T088", "key_expression": "…", "match": "paraphrased"},
                                 "B": null},
                  "validation": {"outcome": "confirmed_with_content", "quote": "…", "turn": "T147"}},
  "formula": {"selected_A": {"quote": "…", "turn": "T088", "solicitation": "S"},
              "selected_B": {"quote": "…", "turn": "T102", "solicitation": "N", "same_unit": true},
              "selected_P": {"quote": "…", "turn": "T120", "solicitation": "P", "rule": "named_when_asked"},
              "conformity": {"A": true, "B": false, "single_P": true, "P_selected": true}},
  "roadmap": {"blockers": [{"object": "…", "quote": "…", "turn": "T120", "solicitation": "P"}],
              "count": 3, "warning": false},
  "items": [{"id": "G5", "level": 1}, {"id": "G6", "level": 2}],
  "concordance": "3/3"
}
```

# 10. Décisions à valider

- La règle d'absence telle qu'elle est écrite : problème **et** coût, restitués **et** validés, **avant** la première présentation de l'offre et le premier prix. Point ouvert : une restitution placée entre la première présentation de l'offre et le premier prix (le commercial commence à présenter, puis revient en arrière pour restituer l'écart) doit-elle passer la porte ? Proposition actuelle : non.
- Le seuil du mot pour mot de GB-22 : un seul mot principal exact suffit pour la porte ; le niveau 2 de G5 demande au moins une expression clé de 3 mots ou plus ou un chiffre du prospect. Variante à tester sur l'ensemble de référence : 3 mots consécutifs exigés pour chaque composant (plus strict ; sur l'ensemble de calibration, plusieurs écarts jugés présents deviendraient absents).
- Les transformations permises de GB-22 (changement de personne, singulier / pluriel, normalisation des nombres) et rien d'autre.
- La formule de l'écart (§2.1) : A seulement dans les réponses S et I, B seulement dans les réponses N, P seulement dans les réponses P. Point ouvert : un état désiré dit en dehors d'une réponse N est aujourd'hui enregistré mais pas utilisé comme B.
- Le départage de GB-30 quand deux blocages sont cités aussi souvent l'un que l'autre (proposition actuelle : celui nommé en premier en réponse à la question sur ce qui l'arrête, puis le plus récent).
- Le compte de la feuille de route de GB-32 : si le P sélectionné compte comme l'un des 3 blocages (proposition actuelle : oui, chaque blocage distinct relevé dans des réponses P ou I compte) — à confirmer.
- Les six items et leurs poids (10 / 10 / 10 / 20 / 25 / 25).
- Si un B sans horizon peut atteindre le niveau 2 (proposition actuelle : non).
- La règle des appels de relance (nouvelle validation exigée dans l'appel où la présentation de l'offre reprend).
---

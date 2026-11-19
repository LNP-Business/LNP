# Annexe A · Règles de bornage des objections

Cette annexe dit comment le système repère, dans une transcription brute, chaque résistance, sa nature, l'épisode qui la suit, les gestes du commercial et la résolution du prospect. Une règle qui n'est pas écrite ici n'existe pas : un cas non couvert va à l'arbitre avec l'étiquette `uncovered_case` et devient une nouvelle règle numérotée.

Les appels de LNP sont en français ; les listes de marqueurs ci-dessous donnent les tournures françaises, puis les tournures anglaises des transcriptions de référence des tests, que le code reconnaît aussi.

## A1. Repérer une résistance

**OB-1 · Candidate.** L'inventaire (code) signale un passage du prospect comme résistance candidate quand il contient un marqueur des listes ci-dessous. Les marqueurs ne font que proposer des candidates ; le modèle décide avec les tests de frontière (OB-3). Le modèle peut aussi proposer une résistance sans aucun marqueur, avec sa citation.

| Nature | Marqueurs typiques (appels en français ; appels en anglais) |
|---|---|
| Objection · prix, argent disponible | « trop cher », « beaucoup d'argent », « je n'ai pas les moyens », « je n'ai pas l'argent », « hors de mon budget », « mon crédit », « financement » ; "too expensive", "a lot of money", "can't afford", "don't have the money", "out of my budget", "my credit", "financing" |
| Objection · confiance dans l'offre, pertinence | « pas sûr que ça marche », « j'ai déjà vu des programmes comme ça », « c'est certifié ? », « je sais déjà enseigner », « je n'ai pas besoin de… » ; "not sure it works", "I've seen programs like this", "is it accredited", "I already know how to design", "I don't need…" |
| Objection · temps | « je n'ai pas le temps », « avec mon travail », « avec les enfants » (comme contrainte pour suivre le programme) ; "I don't have time", "with my job", "with the kids" |
| Objection · codécideur | « en parler à mon mari / ma femme / mon conjoint », « on décide ensemble », « il faut que je voie avec » ; "talk to my husband / wife / partner", "we decide together", "I need to check with" |
| Anxiété · capacité | « j'ai peur », « je crains », « je ne sais pas si j'en suis capable », « je ne suis pas assez bon », « je vais abandonner », « j'abandonne toujours » ; "I'm scared", "I'm afraid", "I don't know if I can", "I'm not good enough", "I'll quit", "I always give up" |
| Anxiété · choix | « et si ça ne marche pas », « je me suis déjà fait avoir », « je ne veux pas me tromper », « comment je peux savoir » ; "what if it doesn't work", "I got burned before", "I don't want to make a mistake", "how do I know" |
| Inertie | « pas le bon moment », « peut-être plus tard », « après les vacances », « ça va pour l'instant », « il faut que je réfléchisse » (sans raison), « laisse-moi la nuit pour y penser » ; "not the right time", "maybe later", "after the holidays", "I'm okay for now", "I need to think about it" (sans raison), "let me sleep on it" |

**OB-2 · Exclusions à la détection.**
- Une demande d'information (« ça dure combien de temps ? », « combien d'appels par semaine ? », « il y a un paiement en plusieurs fois ? ») n'est pas une résistance, sauf si le prospect exprime une réserve dans le même tour.
- Un délai avec une raison extérieure vérifiable (« je déménage en janvier », « mes indemnités s'arrêtent en mars ») est une échéance du circuit de décision, pas une inertie.
- Un fait du circuit de décision énoncé de façon neutre pendant la découverte (« c'est mon mari qui gère l'argent ») est une information sur le circuit, pas une objection. Il devient une objection quand il est avancé comme une raison de ne pas décider maintenant.
- Une acceptation sous condition (« si je peux payer tous les mois, alors oui ») est un critère de décision, pas une résistance.
- « Je vais réfléchir » avec une raison (« il faut que je regarde mes comptes ») est classé selon la raison ; sans raison, c'est une inertie.

**OB-3 · Nature : tests de frontière.** Dans cet ordre :
1. Le sujet du doute est-il l'offre, son prix ou ses conditions, l'entreprise, le commercial, ou un moyen qui manque au prospect (temps, argent, accord d'un codécideur) ? → **objection**.
2. Le sujet est-il le prospect lui-même (ne pas y arriver, ne pas tenir) → **anxiété · capacité** ; ou sa décision (se tromper, se faire avoir) → **anxiété · choix**.
3. Est-ce un attachement au présent, ou un report sans raison extérieure ? → **inertie**.
« Je ne suis pas sûr que ça marche » est une objection ; « je ne suis pas sûr d'en être capable » est une anxiété ; « ça va comme ça » est une inertie.

**OB-4 · Passages mixtes.** Un passage du prospect qui exprime deux natures (« je n'ai pas les moyens et franchement j'ai peur d'abandonner encore ») ouvre **deux épisodes**, un par nature, avec le même tour de début. Chacun est jugé sur son propre geste.

**OB-5 · Une résistance sur plusieurs tours.** Des tours consécutifs du prospect qui expriment la même résistance, séparés seulement par des relances d'écoute du commercial (« mm-hmm », « je t'entends ») de 5 mots ou moins, forment une seule résistance.

## A2. Borner l'épisode

**OB-6 · Début.** Le premier tour de la résistance.

**OB-7 · Réponse.** Chaque tour du commercial après la résistance jusqu'au changement de sujet.

**OB-8 · Changement de sujet.** Le premier tour du commercial qui (a) ne contient aucun mot de contenu de la résistance ni de la réponse jusque-là, et (b) introduit un nouveau sujet : une nouvelle question de découverte, un nouveau segment de l'offre, de la logistique, ou la conclusion. Les marqueurs de continuité (« donc », « et », « aussi », « l'autre chose là-dessus » ; "so", "and", "also", "the other thing about that") avec un mot repris ne sont pas un changement de sujet. La fin de l'appel termine tout épisode ouvert.

**OB-9 · Réaction.** Les tours du prospect entre la première réponse du commercial et le changement de sujet. Si le prospect soulève une nouvelle résistance à l'intérieur de l'épisode, l'épisode en cours se termine et un nouveau commence.

**OB-10 · Latente.** Un épisode est latent quand le sujet change dans les 2 tours suivant la résistance (le tour de la résistance, au plus un tour du commercial, puis le changement de sujet) et que le prospect n'a eu aucune réaction de 6 mots ou plus. Calculé par le code à partir des numéros de tour.

**OB-11 · Récurrence.** Une résistance de même nature et de même thème (sous-type) qui apparaît après la fin d'un épisode précédent, dans le même appel ou dans l'appel suivant du même cycle, ouvre un nouvel épisode relié au précédent (`recurrence_of`).

**OB-12 · Locuteurs.** Les résistances d'un codécideur (`OTHER`) sont des épisodes comme celles du prospect. Les tours marqués `attribution_doubtful` (attribution douteuse) sont exclus.

## A3. Repérer les gestes

**OB-13 · Accueillir.** Se lit sur la première phrase du premier tour de réponse.
- Accueillie : un marqueur d'accueil sans contradiction (« je t'entends », « ça se comprend tout à fait », « c'est normal », « je comprends », « bonne question », « merci de me le dire » ; "I hear you", "that makes total sense", "totally fair", "I understand", "good question", "I appreciate you sharing that") ou une reformulation neutre de la résistance.
- Pas accueillie : la première phrase commence par une contradiction ou en contient une (« mais », « en fait », « non, », « ce n'est pas vrai », « le truc, c'est que », « je ne suis pas d'accord » ; "but", "actually", "no,", "that's not true", "the thing is", "I disagree") ou un contre-argument.

**OB-14 · Isoler.** Une sollicitation du commercial qui demande si la résistance est le seul obstacle : « à part… », « en dehors de… », « c'est la seule chose ? », « si on règle ça, est-ce que tu… », « est-ce qu'il y a autre chose qui t'arrête ? » ("apart from…", "other than…", "is that the only thing", "if we solved that, would you…", "is there anything else stopping you"). Doit être dans l'épisode, avant la réponse.

**OB-15 · Explorer.** Une sollicitation du commercial qui demande au prospect d'ouvrir la résistance elle-même (une question ouverte qui reprend un mot de la résistance) : « quand tu dis que c'est beaucoup, beaucoup par rapport à quoi ? », « qu'est-ce qui te fait penser ça ? », « qu'est-ce qui s'est passé la dernière fois ? ». Avec une réponse de contenu si le tour suivant du prospect ajoute quelque chose au-delà de l'accord.

**OB-16 · Geste de réponse adapté.** Jugé par rapport à la nature (méthodologie § 2) :
- objection → accueillir, isoler, explorer, puis une réponse reliée à ce que le prospect a dit ;
- anxiété · capacité → description de l'accompagnement, du cadre, des étapes ou du suivi qui retirent le risque de ne pas y arriver ;
- anxiété · choix → preuve (résultats d'élèves comparables), réversibilité, garantie ;
- inertie → une question qui amène le prospect à dire le coût de rester où il est, avec une réponse du prospect.
« Partiel » quand la réponse contient le geste adapté et aussi un argument du mauvais genre (par exemple une réassurance suivie d'un argument sur le prix).

**OB-17 · Résolution.** Se lit sur la réaction (OB-9) :
- **résolue :** le prospect dit que la résistance ne tient plus (« ok, à 900 par mois je peux le faire »), la reformule comme ayant reçu sa réponse, ou avance de lui-même (demande comment commencer, propose une date) ;
- **accueillie :** accord sans contenu (« ok », « je vois », « ça se tient ») ;
- **persistante :** répète ou renforce la résistance ;
- **latente :** OB-10.
Une « résolution » dont le contenu a d'abord été énoncé par le commercial et seulement approuvé (« donc le paiement en plusieurs fois, ça règle le problème pour toi, non ? » → « ouais ») est **accueillie**, pas résolue.

## A4. Repérer les faits de prévention

**OB-18 · Avant le prix.** Les faits de prévention (décideur, personnes qui influencent, budget, échéance, tentative passée désamorcée) ne comptent que s'ils sont énoncés par le prospect dans un tour avant le premier prix (annexe de la présentation, PB-3).

**OB-19 · Supposition.** Une supposition du commercial qui n'est pas confirmée avec du contenu (« j'imagine que c'est toi qui décides ? » → « mm-hmm ») n'établit pas le fait ; « oui, c'est ma décision » l'établit.

## A4b. Règles ajoutées après la première passe de calibration

**OB-20 · Exploration elliptique.** Une question ouverte qui renvoie à la résistance par ellipse, sans en reprendre les mots (« Par rapport à quoi ? », « Pourquoi ça ? », « Dans quel sens ? »), placée juste après la résistance, compte comme exploration (OB-15). Une première phrase de réponse qui est une telle question, sans marqueur d'accueil ni contradiction, compte comme accueillie (OB-13).

**OB-21 · Recadrage de l'état d'esprit sur une anxiété.** Une réponse à une anxiété qui recadre la croyance (« tout le monde ressent ça avant de commencer », « la peur veut dire que ça compte pour toi ») sans décrire aucun accompagnement, cadre ou preuve est une correspondance **partielle** (H1 = 1), étiquetée `mindset_reframe`. Avec un accompagnement ou une preuve ajoutés dans le même épisode, elle devient une correspondance complète.

**OB-22 · Recevoir et repartir dans le même tour.** Un seul tour du commercial qui accueille la résistance puis passe à un nouveau sujet, sans y répondre ni l'explorer, rend l'épisode **latent** (OB-10), quelle que soit la longueur du tour.

**OB-23 · Engagement sur une réponse proposée.** Quand le commercial propose une réponse concrète (un paiement en plusieurs fois, une date de début, un appel avec le conjoint) et que le prospect s'y engage avec ses propres mots et un élément précis (« Marché conclu », « Ok, la formule à 900, on y va », « Jeudi 19 h, ça nous va à tous les deux »), la résolution est **résolue**. Un simple « ouais » ou « ok » à la même proposition reste **accueillie** (OB-17).

**OB-24 · Anxiété niée.** Quand le prospect nie explicitement une nature et en affirme une autre (« je n'ai pas peur, c'est juste le montant »), l'épisode prend seulement la nature affirmée (ici : objection · argent disponible) ; aucun épisode d'anxiété n'est ouvert.

**OB-25 · Raison extérieure qui limite aussi le temps.** Un délai lié à un événement extérieur et vérifiable qui réduit aussi la disponibilité du prospect (« c'est la période des examens, je suis pris jusqu'en octobre ») ouvre deux enregistrements : une échéance du circuit de décision (pour la prévention) et une objection · temps (pour le traitement).

**OB-26 · Attribution.** La porte de qualité de la diarisation (Partie C, C1) doit signaler les tours `attribution_doubtful` avant le bornage. Quand le signal manque, le modèle marque un tour comme douteux si son contenu contredit son étiquette (le propre nom du commercial ou l'offre décrite à la première personne sous une étiquette PROSPECT) ; ces tours sont exclus des épisodes.

**OB-27 · Portée : seulement après le premier prix.** (Romain, 2026-11-03.) Une résistance ne se lit que dans un tour
PROSPECT (ou d'un codécideur) qui vient après le premier prix (ancre de la présentation PB-3 / PB-18). Rien de ce qui est
dit avant le premier prix n'est une objection, une anxiété ou une inertie : ce n'est ni proposé, ni borné, ni noté, même si
cela correspond à un marqueur de OB-1. Un appel sans prix n'a aucun épisode (traitement `not_applicable`). La prévention
(A4, OB-18, OB-19) ne change pas : elle lit toujours les faits énoncés avant le premier prix, parce que ce ne sont pas des
objections.

## A5. Règles d'exclusion (résumé)

| # | Ne compte jamais comme… | Cas |
|---|---|---|
| X1 | une résistance | Une demande d'information ; une acceptation sous condition ; un fait neutre sur le circuit |
| X2 | une inertie | Un délai avec une raison extérieure et vérifiable (c'est une échéance) |
| X3 | résolue | Un simple accord ; un accord sur une résolution énoncée par le commercial |
| X4 | résolue | Toute résistance qui revient plus tard (elle est renotée H5 = 0) |
| X5 | accueillie par le commercial | Une première phrase qui contredit ou argumente |
| X6 | un isolement | « Autre chose ? » demandé après la réponse, à la fin de l'épisode |
| X7 | une exploration | Une question fermée, ou une question qui ne reprend pas la résistance |
| X8 | la prévention | Des faits énoncés après le premier prix ; des suppositions du commercial |

## A6. Paires minimales

Les passages sont donnés en français, avec entre parenthèses la phrase anglaise du test unitaire correspondant quand la forme exacte compte.

| # | Passage | Verdict | Pourquoi |
|---|---|---|---|
| 1a | « Le programme dure combien de temps ? » | Pas une résistance | Demande d'information (OB-2) |
| 1b | « Ça dure combien de temps ? Parce que franchement, je n'ai pas beaucoup de temps. » | Objection · temps | Réserve exprimée |
| 2a | « Je ne suis pas sûr que ça marche. » ("I'm not sure it works.") | Objection · confiance | Doute sur l'offre |
| 2b | « Je ne suis pas sûr d'en être capable. » ("I'm not sure I can do it.") | Anxiété · capacité | Doute sur soi |
| 3a | « Pas maintenant, peut-être après les vacances. » | Inertie | Pas de raison extérieure |
| 3b | « Pas avant janvier, je déménage en décembre. » | Échéance (circuit) | Raison extérieure (OB-2) |
| 4a | « C'est mon mari qui gère nos finances. » (découverte) | Fait du circuit | Neutre |
| 4b | « Il faut d'abord que j'en parle à mon mari. » (après le prix) | Objection · codécideur | Raison de ne pas décider maintenant |
| 5a | Commercial : « Je t'entends. À part l'argent, est-ce qu'il y a autre chose qui te retient ? » | Accueillir + isoler | OB-13, OB-14 |
| 5b | Commercial : « Mais pense à ce que ça te coûte de ne pas le faire. » | Pas accueillie | Contradiction d'abord (OB-13) |
| 6a | Prospect après un paiement en plusieurs fois : « Ok, 900 par mois, ça je peux vraiment le faire. » | Résolue | Ses propres mots |
| 6b | Commercial : « Donc le paiement en plusieurs fois, ça te va, non ? » Prospect : « Ouais. » ("So the payment plan works for you, right?" → "Yeah.") | Accueillie | Résolution énoncée par le commercial (OB-17) |
| 7a | Anxiété « j'abandonne toujours » → le commercial décrit des points hebdomadaires et un mentor qui assure le suivi | Geste adapté | L'accompagnement retire le risque |
| 7b | Anxiété « j'abandonne toujours » → Commercial : « Le prix est vraiment bas comparé à un diplôme » | Inadapté | Oppose l'offre à un doute sur soi |
| 8a | Résistance, le commercial change de sujet au tour suivant, le prospect se tait | Latente | OB-10 |
| 8b | Résistance, le commercial explore, le prospect répond pendant 3 tours, puis changement de sujet | Pas latente | Réaction présente |

## A7. Fiabilité de la détection pour les objections

| Mesure | Seuil |
|---|---|
| Rappel des résistances sur le jeu de référence | ≥ 95 % |
| Précision des résistances | ≥ 85 % |
| Accord sur la nature (objection / anxiété / inertie) | κ ≥ 0,80 |
| Fin de l'épisode : même tour ± 1 | ≥ 90 % |
| Accord sur le niveau de résolution | κ ≥ 0,80 |
| Items des gestes (accueillir, isoler, explorer, geste adapté) | κ ≥ 0,80 chacun |

D'ici là, la note du traitement des objections est marquée « provisoire ». Confusions les plus probables : une anxiété classée comme objection (OB-3) ; une demande d'information prise pour une objection (OB-2) ; une résistance accueillie prise pour une résistance résolue (OB-17) ; un « autre chose ? » tardif pris pour un isolement (X6).

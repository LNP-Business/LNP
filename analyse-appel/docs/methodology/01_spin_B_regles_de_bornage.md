# Annexe A · Règles de bornage de la découverte SPIN (v1.3 : registres A8, SB-26 à SB-33 et SB-35)

Le bornage des **questions** (sollicitation, règles de segmentation SEG-1 à SEG-8, les cinq portes, les raisons de OUT et les règles strictes) est donné aux §2 et §3 et suit la référence de bornage SPIN LNP v1.0. Cette annexe ajoute ce que cette référence laisse ouvert pour la notation : le bornage exact du **périmètre**, de la **réponse du prospect**, des **atomes** qu'elle contient et des **suites**. Une règle qui n'est pas écrite ici n'existe pas : un cas non couvert va à l'arbitre avec l'étiquette `uncovered_case`.

Les rôles des tours de parole s'écrivent comme dans la transcription : `SALES` (le commercial), `PROSPECT` (le prospect), `OTHER` (une autre personne).

## A1. Périmètre

**SB-1 · Bornes.** Le périmètre commence à la première sollicitation sur la situation, les objectifs ou les problèmes du prospect qui n'est ni sociale, ni logistique, ni de cadrage. Il se termine quand l'écart est fait : à la validation par le prospect de la restitution qui rend l'écart présent (annexe de l'écart, porte d'absence) (Romain, 2026-11-03). Quand aucun écart n'est fait, il se termine au premier début de la présentation de l'offre ou au premier prix (annexe de la présentation de l'offre, PB-1 et PB-3). Une restitution qui ne rend pas l'écart présent ne le termine pas. (Moteur allégé : appliqué ; moteur de référence : se termine encore au début de la présentation de l'offre ou au prix, voir `DECISIONS_OUVERTES`.)

**SB-2 · Questions sociales et de cadrage.** Jamais le début du périmètre : d'où le prospect appelle, comment se passe sa journée, papotage sur la famille, « tu me vois et tu m'entends ? », « voilà comment va se passer l'appel, ça te va ? ». Une question sur ce qui l'a poussé à prendre rendez-vous (« qu'est-ce que tu espérais qu'on puisse faire pour toi ? ») **est** un début valable.

**SB-3 · Réouvertures.** *Remplacée par SB-34 (v1.2) : pas de réouverture ; gardée pour mémoire.* Après la fin, une sollicitation du commercial qui pose une nouvelle question de diagnostic sur la situation, les problèmes ou les objectifs du prospect rouvre le périmètre ; la réouverture se termine au segment d'offre suivant, au prix, à la demande de décision ou au changement de sujet. Ne sont pas des réouvertures : les questions sur l'offre, la logistique (heures disponibles, date de début), le financement (épargne, crédit, budget mensuel), et la clarification d'une résistance (compétence Objections).

**SB-4 · Questions pendant la présentation de l'offre.** *Remplacée par SB-34 (v1.2) : gardée pour mémoire.* Une question posée pendant la présentation de l'offre sur la situation propre du prospect (« would you say your eye is ahead of your process? », tu dirais que ton œil est en avance sur ta méthode ?) n'est une réouverture que si sa réponse est suivie d'au moins une autre question de diagnostic ; une question isolée pendant la présentation de l'offre est un point d'étape de la présentation (annexe de la présentation de l'offre, PB-11).

## A2. La réponse

**SB-5 · Plage de la réponse.** La réponse à une sollicitation est la parole du prospect depuis la fin de la sollicitation jusqu'à la sollicitation suivante du commercial. Une relance d'écoute du commercial de 5 mots ou moins à l'intérieur ne la termine pas.

**SB-6 · Questions empilées.** Quand plusieurs sollicitations sont empilées dans un même tour du commercial (SEG-1), la réponse est attribuée à la **dernière**, sauf si le prospect répond explicitement à une précédente (la cite ou reprend son mot clé) ; les autres sollicitations empilées n'ont pas de réponse (`unanswered`), ce qui ne change pas leur lettre.

**SB-7 · Première réponse courte.** Si le premier tour du prospect fait moins de 6 mots et que le commercial ne parle pas entre les deux, le tour suivant du prospect est inclus dans la réponse.

**SB-8 · Parole spontanée.** Ce que le prospect dit en dehors de toute plage de réponse à l'intérieur du périmètre (le prospect continue de parler après l'acquiescement du commercial) est rattaché à la dernière sollicitation qui précède, avec le signal `volunteered`. Les atomes spontanés comptent pour les items D1 à D4, jamais pour D5 (suites).

## A3. Atomes

**SB-9 · Un atome, un passage.** Un atome est un passage continu de 2 à 40 mots dans un seul tour du prospect. Deux passages qui disent la même chose en des mots différents dans la même réponse font un seul atome (garder le plus explicite). Deux conséquences différentes dans une même phrase font deux atomes (« je suis épuisée et je ne vois plus mes enfants » → deux atomes IMPACT, santé et famille).

**SB-10 · PAIN ou IMPACT.** Une conséquence ne compte comme IMPACT que si son domaine diffère du domaine du problème (unité de perte : argent, temps, clients, famille, santé, confiance en soi, avenir). « Je n'ai pas d'élèves » → PAIN ; « donc je n'arrive pas à payer mon loyer » → IMPACT (money). Le modèle donne les deux domaines ; le code les compare.

**SB-11 · SITUATION ou IMPACT pour les chiffres.** Un chiffre qui décrit le présent (chiffre d'affaires, heures, nombre d'élèves) est une SITUATION. Un chiffre qui décrit ce que le problème leur fait perdre (argent laissé sur la table, mois perdus, heures gâchées) est un IMPACT. Un revenu actuel n'est jamais un IMPACT.

**SB-12 · DESIRE ou réaction à l'offre.** Un état désiré dit après le début de la présentation de l'offre n'est pas un atome DESIRE (c'est une réaction à l'offre, compétence Présentation de l'offre).

**SB-13 · DESIRE ou VALUE.** DESIRE est l'état (« je veux 10 000 € par mois ») ; VALUE est pourquoi cela compte ou ce que cela changerait (« pour pouvoir arrêter et être à la maison pour mes enfants »). Une phrase qui contient les deux donne deux atomes.

**SB-14 · Contenu soufflé.** Si le commercial a énoncé le contenu et que le prospect ne fait qu'approuver (« oui », « exactement », « carrément » ; en anglais « yes », « exactly », « for sure »), pas d'atome. Si le prospect approuve **et ajoute** du contenu, seul le contenu ajouté est un atome.

**SB-15 · Chiffré.** Un atome est chiffré si son passage contient un nombre, un montant, une durée, une fréquence ou une date qui s'y rattache (« deux ans », « 15 heures par semaine », « à peu près 3 000 »). Les quantités vagues (« beaucoup », « depuis toujours ») ne sont pas chiffrées.

## A4. Suites

**SB-16 · Objet.** Chaque atome PAIN, BLOCKER et IMPACT porte une courte étiquette d'objet. Deux atomes ont le même objet quand le modèle les relie et que le code trouve au moins un mot plein commun entre leurs citations ou les citations des questions qui les ont produits.

**SB-17 · Repris.** Une sollicitation est reprise (`followed_up`) quand elle reprend au moins un mot plein (4 lettres ou plus, hors de la liste des mots vides) ou un nombre de la réponse précédente.

**SB-18 · Suite profonde.** P (réponse : PAIN ou BLOCKER sur l'objet X) → I (réponse : IMPACT sur X) → I ou N (réponse : IMPACT, DESIRE ou VALUE sur X), consécutives parmi les sollicitations codées S/P/I/N, chacune reprise. Une question OUT `nothing` au milieu (une question de relance d'écoute) ne casse pas la suite ; toute autre question codée la casse.

## A4b. Règles ajoutées après la première passe de calibration

**SB-19 · Relances en écho.** Une sollicitation anaphorique ou en écho placée juste après la réponse (« dis-m'en plus », « c'est-à-dire ? », « comment ça ? », « quoi d'autre ? », « beaucoup ? » ; en anglais « Tell me more », « How so? », « What else? », « A lot? », « Meaning? ») compte comme reprise (SB-17), même sans mot repris de 4 lettres ou plus.

**SB-20 · Ce qui casse une suite.** Remplace la dernière phrase de SB-18. Une suite n'est cassée que par : une sollicitation codée S, P, I ou N sur un autre objet ; ou une sollicitation OUT `sales_list` ou `agreement`. Un OUT `nothing` ne la casse pas. Un S qui chiffre le problème de la suite elle-même (« tu as perdu combien d'élèves ? ») ne la casse pas, mais ne compte pas comme un de ses maillons.

**SB-21 · Questions sur le plan d'action.** « Qu'est-ce que tu devrais faire différemment ? » et les questions semblables sur le plan du prospect lui-même ne sont N que si la réponse énonce un état futur ou sa valeur ; sinon la question est OUT `solution_load` et sa réponse ne produit aucun atome DESIRE.

**SB-22 · Baisse de revenu.** Une baisse entre un revenu passé et un revenu actuel, attribuée explicitement par le prospect au problème (« I went from 175K to 58K since… », je suis passé de 175 000 à 58 000 depuis…), est un IMPACT chiffré (money). Un revenu actuel seul reste une SITUATION (SB-11).

**SB-23 · Paroles rapportées.** Les mots que le prospect attribue à quelqu'un d'autre (« my brother says I'll never make money from this », mon frère dit que je ne gagnerai jamais d'argent avec ça) ne sont un atome que si le prospect les reprend à son compte dans la même réponse (« and honestly he's right », et franchement il a raison, ou une affirmation équivalente à la première personne).

**SB-24 · Chiffré, précisément.** Remplace SB-15. Un atome est chiffré s'il contient un montant, un nombre ou une durée (« 2 000 », « trois élèves », « deux ans », « 15 heures par semaine »). Une fréquence seule (« tous les mois », « tout le temps ») ne suffit pas.

**SB-25 · Questions sur le financement.** Une question sur la façon dont le prospect paierait la solution (épargne, crédit, budget mensuel disponible pour le programme) est OUT `solution_load`, où qu'elle se trouve ; elle ne rouvre jamais le périmètre (SB-3).

## A5. Règles d'exclusion (résumé)

| n° | Ne compte jamais comme… | Cas |
|---|---|---|
| X1 | début du périmètre | Questions sociales, logistiques ou de cadrage (SB-2) |
| X2 | une réouverture | Depuis la v1.2, rien ne rouvre la découverte (SB-34) |
| X3 | un atome | Approbation sans contenu ; contenu soufflé par le commercial (SB-14) |
| X4 | IMPACT | Une conséquence dans le domaine propre du problème (SB-10) ; un revenu actuel (SB-11) |
| X5 | DESIRE | Un souhait dit après le début de la présentation de l'offre (SB-12) |
| X6 | chiffré | « beaucoup », « depuis toujours », « tellement » (SB-15) |
| X7 | un maillon de suite | Une question qui ne reprend pas la réponse précédente (SB-17) ; un atome spontané (SB-8) |
| X8 | un point de note | La lettre d'une question, le nombre de questions d'une lettre (garde-fou de la référence SPIN) |

## A6. Paires minimales (réponses et atomes)

| n° | Question → réponse | Atomes | Pourquoi |
|---|---|---|---|
| 1a | « Qu'est-ce qui ne marche pas ? » → « Je n'ai pas d'élèves. » | PAIN | Le problème lui-même |
| 1b | « Et ça fait quoi ? » → « Je n'arrive pas à payer mon loyer. » | IMPACT (money) | Autre domaine (SB-10) |
| 1c | « Et ça fait quoi ? » → « Je n'ai aucun cours à donner. » | PAIN | Même domaine que « pas d'élèves » |
| 2a | « Tu gagnes combien ? » → « À peu près 3 000 € par mois. » | SITUATION, chiffrée | Chiffre du présent |
| 2b | « Ça t'a coûté combien ? » → « Sûrement 2 000 € par mois que je ne gagne pas. » | IMPACT (money), chiffré | Perte (SB-11) |
| 3a | « Tu veux en être où ? » → « À 10 000 € par mois. » | DESIRE, chiffré | État |
| 3b | « Pourquoi c'est important ? » → « Pour pouvoir être à la maison avec mes enfants. » | VALUE | Pourquoi cela compte (SB-13) |
| 4a | « Donc tu aimerais plus de liberté, c'est ça ? » → « Oui. » | aucun | Soufflé (SB-14) |
| 4b | « Donc tu aimerais plus de liberté, c'est ça ? » → « Oui, franchement je veux pouvoir aller chercher mes enfants à l'école. » | DESIRE (la partie ajoutée) | Contenu ajouté |
| 5a | Avant la présentation de l'offre : « Je veux mon propre cabinet de cours. » | DESIRE | Avant la présentation |
| 5b | Après le partage d'écran : « J'adorerais faire partie de cette communauté. » | aucun (réaction à l'offre) | SB-12 |
| 6a | « Ça fait combien de temps que c'est comme ça ? » → « Depuis toujours. » | SITUATION, non chiffrée | SB-15 |
| 6b | « Ça fait combien de temps que c'est comme ça ? » → « Trois ans. » | SITUATION, chiffrée | Durée |

## A7b. Le SPIN s'arrête à la présentation de l'offre (v1.2, Romain 2026-10-27)

**SB-34 · Rien après la présentation de l'offre n'est du SPIN.** La découverte se termine au premier début de la présentation de l'offre ou au premier prix (SB-1) et
ne se rouvre jamais. Une question du commercial après ce point, sur la situation, les problèmes ou les objectifs du prospect ou sur quoi que ce soit
d'autre, n'est pas lue pour le SPIN : pas de lettre, pas d'atome, pas de suite, pas de registre, et elle ne compte dans aucune mesure SPIN.
Remplace SB-3 (réouvertures) et SB-4 (questions pendant la présentation de l'offre) ; leurs cas de calibration (B1 cas 6, B3 cas 3) sont
remplacés. Constante du moteur `REOUVERTURES = False` ; la tâche `spin.reopen_end` n'est plus demandée.

## A8. Registres des questions (SPIN v1.2, Romain 2026-10-27 ; v1.3 SB-35, Romain 2026-10-29)

Chaque question de la découverte est placée dans un des quatre registres, ou Autre. Le registre est une aide de lecture pour le
commercial et pour celui qui l'accompagne (où la découverte est allée et où elle n'est pas allée) ; il est affiché et jamais noté : il ne change
aucune lettre, aucun atome, aucun item ni aucune note.

| Registre | Domaines (§2) | Ce qu'il couvre |
|---|---|---|
| Financier | money, clients | revenu, chiffre d'affaires, prix, dettes ; clients, projets, contacts (un manque de clients se traduit en argent) |
| Temps et charge | time, family | heures, emploi du temps, charge de travail ; le temps pris sur la famille |
| Identité et statut | future | l'écart entre là où le prospect en est et là où il veut être |
| Mental et émotionnel | self_belief, health | confiance, motivation, peur, sentiments ; stress, épuisement, sommeil |
| Autre | other, none | un sujet en dehors des sept domaines, ou pas de sujet du tout |

**SB-26 · Registre d'une question.** Chaque sollicitation codée S, P, I ou N de la découverte, du début du périmètre
au premier début de la présentation de l'offre ou au premier prix (SB-1), reçoit un registre. Le modèle nomme un domaine ; le code le rattache avec le
tableau ci-dessus (`other` et `none` donnent Autre). Aucun registre n'est donné à : une question après le premier début de la présentation de l'offre ou le premier prix,
rien après n'est du SPIN (SB-34) ; une sollicitation OUT (elle est hors du SPIN, confirmé par Romain le 2026-10-27) ; une sollicitation hors du
périmètre ; une unité passée `to_review`.

**SB-27 · Lu dans la question, ou dans son effet.** Quand la question nomme un des sept domaines (SB-28,
sujet de SB-29), le registre est ce dont elle demande au prospect de parler, avec les mots du commercial, et la réponse ne le
change jamais, de la même façon que les atomes ne changent jamais la lettre (§2). Quand elle n'en nomme aucun (une question ouverte), son
registre est l'effet qu'elle a eu : la réponse décide (SB-35, v1.3).

**SB-28 · Ce qui est demandé l'emporte sur la prémisse.** Quand la question nomme plusieurs domaines, c'est le domaine dont on demande au prospect de parler
qui décide, pas la prémisse. « With your clients being so up and down, what impact is that having on your income? » (avec tes élèves qui vont et viennent, quel impact ça a sur ton revenu ?)
porte sur le revenu : money, Financier (les élèves sont la prémisse). Quand deux domaines sont demandés tous les deux (« ton revenu et ta
famille »), le premier demandé, dans l'ordre de lecture, décide.

**SB-29 · Sujet et renvoi.** Une question qui nomme un sujet des sept domaines sans demander un domaine
(« has that fear of failure cost you anything? », cette peur de l'échec t'a coûté quelque chose ? ; « where does that belief come from? », d'où vient cette croyance ?) prend le domaine de ce sujet.
Depuis la v1.3, une question qui ne nomme rien et renvoie en arrière (« how has that impacted you? », ça t'a touché comment ?) est une question ouverte (SB-35) : elle
prend le domaine de ce à quoi elle renvoie, lu dans les deux derniers tours du prospect qui la précèdent (`TOURS_REFERENCE_REGISTRE = 2`),
seulement quand elle n'a pas eu de réponse. « Personnellement », « ta vie », « toi » (« personally », « your life », « you ») ne nomment aucun domaine.

**SB-30 · Mots des domaines.** Les domaines sont lus à partir des mots du §2 et du §4. Le code garde une liste de mots par registre
(constante du moteur `LEXIQUE_REGISTRE`) : Financier money, income, revenue, earn, salary, cash, price, afford, debt, bills,
rent, finance, profit, dollar, paid, client, customer, project, leads, booking, pipeline, sales, un montant (« $5K », « 10K ») ;
Temps et charge time, hour, week, weekend, schedule, workload, busy, family, kid, child, wife, husband, partner, son, daughter,
parent ; Identité et statut future, years from now, long term, where do you see yourself, where do you want to be, become,
dream, vision, career, legacy, status ; Mental et émotionnel confidence, believe in yourself, self-belief, motivation,
mindset, fear, doubt, feel, emotion, frustrated, proud, health, stress, anxiety, burnout, exhausted, tired, sleep, energy.
Un objectif en argent ou en clients (« combien tu veux gagner ? ») est Financier, pas Identité et statut ; les mots qui ne font que
dater la question (« aujourd'hui », « l'an dernier », « dans 12 mois ») ne sont pas le domaine du temps.

**SB-31 · Autre.** Depuis la v1.3, une question sur un sujet en dehors des sept domaines (un outil, un lieu, une méthode) est une
question ouverte (SB-35). Autre est donné quand la réponse ne parle d'aucun des sept domaines, ou, pour une question sans
réponse, quand elle ne nomme aucun sujet et ne renvoie à rien.

**SB-32 · Contrôles du code.** (1) Le modèle répond à une question fermée par unité : le domaine demandé, la base (`named`,
`answer`, `reference` ou `none`) et une citation. (2) La citation est contrôlée (C3) : pour `named`, mots exacts de la question ou
de son préambule ; pour `answer`, mots exacts du prospect dans un des trois premiers tours de la réponse (plage de réponse de SB-6,
`TOURS_REPONSE_REGISTRE = 3`), dont l'identifiant est donné ; pour `reference`, mots exacts d'un des deux derniers tours du prospect,
dont l'identifiant est donné. L'ordre des règles est contrôlé aussi : `named` ne donne jamais Autre (`named_other`) ; une question qui a une
réponse n'est jamais lue par `reference` ni par `none` (`reference_with_answer`, `none_with_answer`) ; `answer` demande une réponse
(`no_answer`). (3) Quand les mots de
la question appartiennent à la liste d'un seul registre (SB-30) et que le modèle nomme un domaine d'un autre registre avec
la base `named`, la réponse est rejetée (`lexicon_conflict`) et rejouée une fois (C3, règle 7). (4) Trois passes
indépendantes ; la clé comparée est le registre ; un désaccord va à l'arbitre, qui tranche en parcourant SB-28, SB-29, SB-35, SB-31 dans
l'ordre ; si rien ne tranche, `to_review` : pas de registre, et la question est laissée hors des comptes de registres.

**SB-35 · Question ouverte : son effet décide (v1.3, Romain 2026-10-29).** Une question qui ne nomme aucun des sept
domaines, ni comme demandé (SB-28) ni comme sujet (SB-29) — « is it plausible for you in this season of life? » (c'est envisageable pour toi en ce moment de ta vie ?), « what's
actually riskier for you? » (qu'est-ce qui est vraiment le plus risqué pour toi ?), « what made you book this call? » (qu'est-ce qui t'a fait prendre ce rendez-vous ?), « how has that impacted you? » (ça t'a touché comment ?) — prend le registre de la
réponse que le prospect lui a faite : le domaine dont parle la réponse, l'effet que la question a produit, lu dans les trois premiers
tours de sa réponse, avec les mots exacts du prospect comme citation. Quand la réponse parle de plusieurs domaines, le premier
dans la réponse décide ; quand elle ne parle d'aucun des sept, Autre. C'est seulement quand la question n'a pas eu de réponse (SB-6,
`unanswered`) que s'applique le renvoi de SB-29, puis SB-31. Raison : sur ces questions, les mots du commercial ne choisissent pas un terrain,
c'est la réponse du prospect qui montre le terrain que la question a ouvert (sur l'appel de Jaci Sung du 2026-10-19, les passes se sont partagées sur deux
questions de ce type, 2026-10-28).

**SB-33 · Fiabilité des registres.** Cible : au moins 92 % des questions dans le bon registre (Romain,
2026-10-27). Sa garantie est la conception de SB-32 : un modèle qui ne fait que nommer un domaine avec une citation contrôlée, le
recoupement par la liste de mots du code, trois passes, l'arbitre et `to_review`. Pas d'ensemble de vérification étiqueté à la main pour l'instant
(Romain, 2026-10-27) ; s'il en est construit un plus tard, il doit venir d'appels hors de l'ensemble de calibration (C7). Sur chaque appel, le code mesure aussi la part des registres tranchés 3/3
(`agreement`) ; sous 92 % (`ACCORD_MIN_REGISTRE = 0.92`), l'appel reçoit le signal `register_agreement_low` et l'écran
dit que ses registres sont moins fiables.

## A7. Fiabilité de la détection pour le SPIN

En plus des seuils au niveau des questions de la référence SPIN (segmentation ≥ 95 %, κ des lettres ≥ 0,80, reproductibilité ≥ 95 %) :

| Mesure | Seuil |
|---|---|
| Début et fin du périmètre : même tour ± 2 | ≥ 95 % des appels |
| Rappel des atomes sur les réponses de référence | ≥ 90 % |
| Accord sur le type d'atome pour les atomes appariés | κ ≥ 0,80 |
| Accord sur les suites profondes par appel | ≥ 90 % |
| Exactitude des registres sur un ensemble étiqueté à la main (SB-33) | ≥ 92 % des questions |
| Reproductibilité des registres, tranchés 3/3 (SB-33) | ≥ 92 % des questions d'un appel, sinon `register_agreement_low` |

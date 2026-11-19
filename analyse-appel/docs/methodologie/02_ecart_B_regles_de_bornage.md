# Annexe A · Règles de bornage de l'écart

Cette annexe dit comment le système trouve, dans une transcription brute, une restitution de l'écart, ses composants et la validation du prospect. Elle est écrite pour que deux annotateurs humains et la machine arrivent au même résultat sur le même appel. Une règle qui n'est pas écrite ici n'existe pas : un cas non couvert va à l'arbitre avec l'étiquette `uncovered_case` et devient une nouvelle règle numérotée dans la version suivante.

Les rôles des tours de parole s'écrivent comme dans la transcription : `SALES` (le commercial), `PROSPECT` (le prospect), `OTHER` (une autre personne, par exemple un codécideur).

Les exemples sont donnés en français, suivis des tournures anglaises des transcriptions de référence (« en anglais … »). Les listes de la règle GB-22 (changement de personne, mots vides, mots génériques) sont celles du code, telles quelles. Les paires minimales de A5 restent en anglais, comme dans les tests du moteur qui les reprennent, avec une traduction entre parenthèses.

## A1. L'unité : la restitution candidate

Une **restitution candidate** est un passage du commercial, dans la fenêtre de phase (A2), que l'étape d'inventaire (code) signale parce qu'il remplit **au moins un** de ces signaux (union, pas intersection) :

| Signal | Détection | Exemples |
|---|---|---|
| S1 Ouverture | Le passage du commercial commence par un marqueur de restitution, ou en contient un dans ses 20 premiers mots | « Si je comprends bien », « Laisse-moi reformuler », « Corrige-moi si je me trompe », « Pour résumer », « Ce que j'entends, c'est », « Je veux être sûr d'avoir bien compris », « Donc en gros, là où tu en es » ; en anglais « So from what I'm hearing », « Let me play that back », « If I understood correctly », « Correct me if I'm wrong », « So just to recap », « What I'm hearing is », « Let me make sure I got this », « So basically where you're at is », « So to summarise » |
| S2 Passage dense à la deuxième personne | Un tour du commercial de 25 mots ou plus, dans lequel au moins deux propositions ont le prospect pour sujet (« tu », « ton », « vous » ; en anglais « you », « your ») et portent un mot ou un nombre que le prospect a employé plus tôt | « Donc tu es à environ 2 000, tu fais ça à côté depuis trois ans, et tu veux remplacer ton salaire… » |
| S3 Demande de validation | Un passage du commercial qui se termine par une demande de validation sur ce qui vient d'être dit | « C'est bien ça ? », « C'est juste ? », « J'ai oublié quelque chose ? », « Tu dirais que c'est là où tu en es ? » ; en anglais « Did I get that right? », « Is that fair? », « Is that accurate? », « Anything I missed? », « Would you say that's where you're at? » |

L'inventaire ne supprime jamais une candidate. Le modèle décide ensuite, pour chaque candidate, si c'est une restitution (GB-4) et quels composants elle contient (GB-3). Les candidates rejetées par le modèle sont gardées avec la raison, pour l'audit.

## A2. La fenêtre de phase

- **Début :** le début du périmètre de la découverte (méthodologie SPIN, §2).
- **Fin :** le premier début de la présentation de l'offre ou le premier prix, selon ce qui vient en premier (carte des phases, partie C étape S2).
- Une candidate après la fin est quand même enregistrée (pour les diagnostics) avec `after_pitch = true` ou `after_price = true`. Elle ne peut jamais passer la porte d'absence.

## A3. Règles numérotées

**GB-1 · Plage.** Une restitution commence à sa première affirmation de composant (ou à son ouverture, si l'ouverture vient avant) et se termine au premier de ces événements : un tour du prospect de 6 mots ou plus ; une sollicitation du commercial sur un nouveau sujet (elle ne reprend aucun mot des composants restitués) ; la première mention de l'offre (programme, accompagnement, académie, « ce qu'on fait », « comment on aide » ; en anglais « what we do », « how we help »). Les tours du prospect de 5 mots ou moins faits seulement d'approbation ou de relance d'écoute (« ouais », « mm-hmm », « d'accord », « exactement » ; en anglais « yeah », « mm-hmm », « right », « exactly ») ne terminent pas la plage : les tours du commercial de part et d'autre sont réunis.

**GB-2 · Une restitution ou deux.** Deux passages du commercial séparés par un tour du prospect de 6 mots ou plus sont deux restitutions. Leurs composants ne sont jamais mis en commun. Si le second passage ne fait qu'ajouter des composants (« et en plus de ça… »), il est évalué comme une restitution à part, avec sa propre validation.

**GB-3 · Reconnaissance d'un composant.** Une proposition de la restitution ne compte comme composant que si les trois conditions sont remplies :
- (a) elle porte sur le prospect (sujet « tu », « ton », « vous », ou le prénom du prospect ; en anglais « you », « your »), pas sur une autre personne ;
- (b) elle est déclarative, ou déclarative suivie d'une queue de validation (« ..., non ? », « ..., c'est ça ? » ; en anglais « …, right? ») ;
- (c) elle restitue une affirmation antérieure du prospect pour le même composant (`problem_statements`, `cost_statements`, `A_statements`, `B_statements`) **avec les mots exacts du prospect**. Le modèle donne l'identifiant de l'affirmation source et copie l'**expression clé** qu'elle reprend (GB-22). Le code classe ensuite la proposition : **mot pour mot** (verbatim) si l'expression clé se retrouve exactement dans le tour source du prospect et dans la proposition du commercial (GB-22) ; **paraphrasée** (paraphrased) si le modèle relie une source mais que le code ne trouve aucune expression clé dans les deux ; **sans source** (untraced) si aucune source n'existe.
Seule une proposition **mot pour mot** est un composant. Une proposition paraphrasée ou sans source n'est pas un composant : elle ne compte ni pour GB-4 (deux composants), ni pour la porte d'absence, ni pour G5. Elle est gardée comme diagnostic (`paraphrased_component`) pour que l'accompagnement puisse montrer au commercial les mots exacts que le prospect avait employés.

**GB-4 · Restitution ou pas.** Une candidate n'est une restitution que si elle contient **au moins deux** composants (GB-3). Un seul composant restitué fermé par une queue (« Donc ton objectif, c'est 10 000, c'est ça ? ») n'est pas une restitution : en SPIN, c'est une question OUT `agreement`.

**GB-5 · Restitution ou présentation de l'offre.** Si le passage restitue des composants puis les relie à l'offre dans le même tour (« …et c'est exactement là-dessus qu'on aide »), la restitution se termine au premier mot de l'offre (GB-1). Le tour suivant du prospect est alors une réaction à la présentation de l'offre, pas une validation, sauf si le commercial demande explicitement la validation de la restitution avant de mentionner l'offre.

**GB-6 · Restitution ou histoire.** Les propositions sur une autre personne (une ancienne élève, un témoignage, « beaucoup de gens dans ta situation… ») ne sont jamais des composants, même si elles ressemblent à la situation du prospect.

**GB-7 · Le composant coût.** Une proposition COST doit énoncer une conséquence du problème dans un autre domaine, ou ce que coûte de rester dans la situation actuelle (argent, temps, clients, famille, santé, confiance en soi, occasion perdue), et doit restituer mot pour mot une `cost_statement` du prospect (GB-22). Un coût introduit pour la première fois par le commercial dans la restitution (« et j'imagine que ça te fait perdre le sommeil ») est sans source et ne compte pas, même si le prospect dit « ouais ». Un chiffre de revenu actuel n'est jamais un coût.

**GB-8 · Le tour de validation.** La validation est le premier tour du prospect de 6 mots ou plus après la fin de la plage ou, si le prospect ne répond que par une courte approbation, ce tour court. Elle est lue par rapport à la restitution, pas par rapport à autre chose :
- si la dernière phrase du commercial avant que le prospect parle est une question sans rapport (GB-9), il n'y a pas de validation ;
- si le commercial a demandé une validation (S3), la réponse du prospect est la validation.

**GB-9 · Validation captée par une autre question.** Si le tour de restitution se termine par une question sur un nouveau sujet (« …, et tu pourrais y mettre combien d'heures par semaine ? »), la réponse du prospect répond à cette question : issue `none`.

**GB-10 · Issues de la validation.**

| Issue | Le tour du prospect… | Exemple |
|---|---|---|
| `confirmed_with_content` | est d'accord et ajoute quelque chose de lui : une précision, un nombre, une émotion, un élément nouveau, une reformulation | « Oui, et franchement ça me ronge depuis des années. » |
| `confirmed` | est d'accord sans contenu nouveau | « Ouais, exactement. » « C'est ça. » « À 100 %. » |
| `corrected` | corrige un ou plusieurs composants | « Pas tout à fait, c'est plutôt 3 000, pas 4 000. » |
| `rejected` | n'est pas d'accord avec la restitution dans son ensemble | « Non, ce n'est pas vraiment ça. » |
| `none` | pas de réponse à la restitution (GB-9), ou changement de sujet par le commercial avant que le prospect réponde | — |

Une issue `corrected` ne passe la porte que si le commercial restitue le composant corrigé dans une nouvelle restitution et que cette nouvelle restitution est `confirmed` ou `confirmed_with_content`.

**GB-11 · Plusieurs restitutions.** La porte est évaluée sur chaque restitution de la fenêtre ; l'écart est présent si au moins une passe. Les items G5 et G6 sont notés sur la dernière restitution qui passe la porte.

**GB-12 · Locuteurs.** Seul un tour `SALES` peut être une restitution. La validation doit venir du prospect, ou d'un codécideur étiqueté `OTHER` si c'est au codécideur que la restitution s'adresse. Un tour marqué `attribution_doubtful` ne peut être ni une restitution ni une validation.

**GB-13 · Appels de relance.** Dans un appel où la présentation de l'offre reprend après un appel antérieur du même cycle, la restitution et sa validation doivent avoir lieu dans cet appel, avant que la présentation reprenne. Ses composants peuvent avoir pour source des affirmations du prospect de l'appel antérieur.

## A3b. Règles ajoutées après la première passe de calibration

**GB-14 · Quel début de la présentation de l'offre.** La fenêtre de phase se termine au début de la présentation de l'offre défini par l'annexe de la présentation de l'offre, PB-1 et PB-17 : un partage d'écran annoncé n'est le début de la présentation que si une description de l'offre suit dans les 2 tours du commercial ; sinon la présentation commence à la première description de l'offre. La même ancre sert aux quatre compétences d'un appel.

**GB-15 · « Non » à « j'ai oublié quelque chose ? ».** Quand la demande de validation demande si quelque chose manque ou est faux (« J'ai oublié quelque chose ? », « Il y a quelque chose que j'ai mal compris ? » ; en anglais « Did I miss anything? », « Anything I got wrong? »), une réponse « Non », « Non, c'est tout », « Non, c'est bon, tu as tout » (en anglais « No », « No, that's it », « Nope, that's everything ») est `confirmed` ; avec un élément ajouté, elle est `confirmed_with_content`.

**GB-16 · Accord partiel.** Une réponse qui est d'accord avec une réserve puis corrige (« à 99 %, sauf que c'est plutôt 3 000 ») est `corrected`. Une réponse qui est d'accord avec une réserve et sans correction (« à peu près », « plus ou moins ») est `confirmed`.

**GB-17 · Réaction émotionnelle.** Une réponse émotionnelle à la restitution (« Pourquoi tu dis ça ? », des larmes, « ça fait mal à entendre ») sans désaccord sur son contenu est `confirmed_with_content` : le prospect fait sien le problème restitué. Avec un désaccord explicite, elle est `rejected`.

**GB-18 · Coût minimisé.** Si les propres affirmations du prospect minimisent le coût (« ce ne serait pas forcément mal », « ça va pour l'instant ») et que le commercial le restitue comme un coût lourd (« tu te contenterais de ça »), le composant COST est sans source (GB-7) : la façon dont le commercial présente les choses n'est pas le coût du prospect.

**GB-19 · Notes des contacts antérieurs.** Une information que le prospect a donnée avant l'appel ne peut être une source que si les propres mots du prospect sont gardés (le texte qu'il a tapé dans le formulaire de candidature, un appel antérieur enregistré). Les notes du setter et les résumés du CRM sont les mots de quelqu'un d'autre : ils ne sont jamais une source mot pour mot. Un composant restitué à partir d'eux ne compte que si le prospect, dans le tour de validation, le redit **avec ses propres mots** (`confirmed_with_content`) ; cette citation de la validation devient alors la source du composant.

**GB-20 · Raisons d'absence : priorité et pluralité.** Le verdict d'absence garde chaque condition non remplie, et affiche une raison principale dans cet ordre de priorité : `no_restitution` > `restitution_after_pitch` (quand une restitution qui passe n'existe qu'après la présentation de l'offre) > `problem_missing` > `cost_missing` > `not_validated`. Exemple : une restitution sans coût avant la présentation de l'offre et une complète après donnent la raison principale `restitution_after_pitch`, avec `cost_missing` gardée en raison secondaire.

**GB-21 · Tours fusionnés.** Applique la règle d'attribution des locuteurs de la partie C (C1) : une queue ou une question du commercial trouvée à l'intérieur d'un tour du prospect est rendue au commercial avant d'appliquer GB-8 ; si on ne trouve pas où couper, le tour est `attribution_doubtful` et ne peut pas servir de validation.


## A3c. Les règles du mot pour mot (version 1.2)

Ces règles font des mots exacts du prospect la colonne vertébrale de l'écart. Elles l'emportent sur toute règle antérieure de cette annexe.

**GB-22 · Expression clé.** Pour chaque composant restitué, le modèle copie l'**expression clé** : les mots de la citation source du prospect qui portent le composant et que le commercial répète. Le code ne l'accepte que si les quatre conditions sont remplies :
- (a) **elle est dans la source :** c'est une sous-chaîne exacte du tour du prospect cité (comparaison normalisée de la partie C, C3) ;
- (b) **elle est dans la restitution :** on la retrouve dans la proposition du commercial après les seules transformations permises : changement de personne (I → you, me → you, my → your, mine → yours, myself → yourself, we → you, our → your, us → you, am → are, I'm → you're, I've → you've, I'd → you'd, I'll → you'll, was → were ; constante du code `CHANGEMENT_PERSONNE`) ; singulier / pluriel du même nom (« self-doubts » = « self-doubt ») ; normalisation des nombres de l'annexe de la présentation de l'offre, PB-21 (« 10K » = « 10,000 »). **Rien d'autre :** pas de synonyme, pas d'autre forme du mot (« stressed » ≠ « stress », « fulfill » ≠ « unfulfilling », « scared » ≠ « fear » ; en français « stressée » ≠ « stress », « peur » ≠ « effrayée »), pas de changement d'ordre ;
- (c) **elle porte le composant :** elle contient la tête du composant : pour PROBLEM, le ou les mots qui nomment l'obstacle (« support », « resources », « overthinking », « fear », « as a need ») ; pour COST, la conséquence ou le montant (« miserable », « motivation », « not sleeping well », « time », « 2K a month ») ; pour A et B, l'état ou la valeur (« not in a steady paying gig », « 10K », « my own business ») ;
- (d) **elle n'est pas générique :** elle contient au moins un mot hors de la liste des mots vides (`MOTS_VIDES`) et hors de la liste des mots génériques (`GENERIQUES` : thing, things, stuff, something, everything, way, lot, life, people, good, bad, better, hard, easy, want, feel, like, make, get, know, think, really, just, kind, sort, able). « You want to » (tu veux) ou « a lot of things » (plein de choses) n'est jamais une expression clé.
Les conditions (a), (b) et (d) sont vérifiées par le code ; (c) est répondue par le modèle et contrôlée par les trois passes (partie C, C4).

**GB-23 · Marqueur de citation.** Une proposition du commercial qui cite explicitement le prospect (« pour reprendre tes mots », « comme tu l'as dit », « tu as employé le mot… » ; en anglais « in your words », « as you said », « you used the word… ») a quand même besoin d'une expression clé (GB-22) : le marqueur seul ne prouve rien. Avec une expression clé, le marqueur est enregistré (`explicit_quote = true`) comme un point fort pour l'accompagnement.

**GB-24 · Chiffres.** Un composant chiffré n'est mot pour mot par son chiffre que si le chiffre est celui du prospect (GB-22 b, après normalisation). Un chiffre arrondi, converti, ramené à l'année ou calculé par le commercial (« donc ça fait à peu près 30 000 par an ») est le chiffre du commercial : le composant peut quand même être mot pour mot grâce à une autre expression clé, mais le chiffre ne compte jamais pour G1 à G4 (X10).

**GB-25 · Correction.** Après une validation `corrected`, la nouvelle restitution doit contenir mot pour mot la correction du prospect (« plutôt 3 000 » → « 3 000 »). Une nouvelle restitution qui garde la formulation du commercial ou un autre chiffre ne restitue pas la correction : la porte échoue (X9).

**GB-26 · Validation dans les mots du prospect.** L'issue de la validation est prouvée par une citation exacte du prospect (partie C, C3). Pour `confirmed_with_content`, le contenu ajouté est cité depuis le tour de validation et doit être le contenu propre du prospect, pas une répétition de la restitution du commercial : un prospect qui répète les mots du commercial (« oui, je tourne en rond comme un hamster dans sa roue » après que le commercial a dit « hamster dans sa roue ») est `confirmed`, pas `confirmed_with_content`.

**GB-27 · Plusieurs sources possibles.** Quand le même composant a été dit plusieurs fois par le prospect, n'importe laquelle de ces affirmations peut être la source ; le modèle cite celle dont le commercial reprend les mots. Une proposition mot pour mot sur une source et paraphrasée sur une autre est mot pour mot.


## A3d. La formule de l'écart (version 1.3)

Ces règles sélectionnent, dans les citations du prospect, le A, le B et le P que la restitution doit reprendre (méthodologie §2.1). La sélection se fait **avant** de lire la restitution, pour que le choix du commercial ne décide jamais quel est le bon A, B ou P. Chaque élément sélectionné est une citation exacte du prospect (principe du mot pour mot).

**GB-28 · Sélection de A.** Candidats : citations du prospect dans les plages de réponse (annexe SPIN, SB-5) des sollicitations **S** ou **I** qui décrivent un état actuel (SITUATION, ou IMPACT qui dit où il en est maintenant). A est le candidat sur **la dimension que vise B** : même unité que B quand B est chiffré (revenu mensuel, clients par mois, heures). Si plusieurs candidats ont cette unité, le plus récent avant la première restitution. Jamais A : le plus gros chiffre de l'appel quand il est sur une autre dimension (un revenu passé, une épargne, un budget du foyer, un crédit immobilier), un chiffre énoncé par le commercial et approuvé (X12). Si B n'est pas chiffré, A est la citation d'état actuel sur le même objet que B (SB-16).

**GB-29 · Sélection de B.** Candidats : citations du prospect dans les plages de réponse des sollicitations **N** qui énoncent un objectif. B est l'objectif exprimé dans l'unité de A ; son horizon y est rattaché si le prospect en a donné un dans la même réponse N ou une réponse N suivante (contraignant ou souhaité, §2). Un objectif énoncé en dehors d'une réponse N est enregistré (`B_outside_N`) mais n'est pas sélectionné (à valider). Si aucune réponse N ne contient d'objectif, `selected_B = null`.

**GB-30 · Sélection de P (un seul blocage).** Candidats : les blocages (atomes PAIN ou BLOCKER, annexe SPIN) dans les réponses du prospect aux sollicitations **P**. Dans cet ordre :
1. **Nommé quand on le lui a demandé.** Si le commercial a demandé ce qui l'arrête (« qu'est-ce qui t'a retenu ? », « qu'est-ce qui t'arrête ? », « qu'est-ce qui te bloque ? », « pourquoi tu ne l'as pas encore fait ? » ; en anglais « what's held you back? », « what's stopping you? », « what's getting in the way? », « why haven't you done it yet? »), P est le blocage de la réponse du prospect à la première de ces questions. Si cette réponse nomme plusieurs blocages, passer à l'étape 2 parmi eux seulement.
2. **Celui auquel il revient le plus.** Sinon, P est le blocage dont l'objet (SB-16) apparaît dans le plus grand nombre de tours distincts du prospect avant la première restitution.
3. **Départage.** Celui nommé en premier en réponse à la question sur ce qui l'arrête ; en cas d'égalité encore, le plus récent (à valider).
Le code applique l'ordre ; le modèle fournit seulement les atomes, leurs étiquettes d'objet et les questions sur ce qui l'arrête, avec des citations.

**GB-31 · Conformité d'une restitution à la formule.** Une restitution est conforme à la formule quand elle reprend, mot pour mot (GB-22) : le A sélectionné, le B sélectionné, et **un seul blocage comme ce qui le bloque**, qui est le P sélectionné. Deux propositions sur le même objet comptent pour un seul blocage. Écarts, gardés pour l'accompagnement : `A_not_selected` (un autre chiffre, en général le plus gros), `unit_mismatch` (A et B restitués dans des unités différentes), `several_blockers` (deux objets de blocage ou plus restitués comme ce qui le bloque), `P_not_selected`. L'ordre A → B → P est l'ordre conseillé de la phrase ; il n'est pas vérifié (à valider). La conformité est exigée pour le niveau 2 de G5 ; elle n'est jamais exigée pour la porte d'absence.

**GB-32 · Blocages de la feuille de route.** `roadmap_blockers` = les objets de blocage distincts (SB-16) dits par le prospect en réponse à des sollicitations **P** ou **I**, avant la première présentation de l'offre, chacun avec sa citation exacte. Un même objet dit plusieurs fois compte une fois. Les blocages soufflés par le commercial et seulement approuvés ne comptent pas (X12). Le P sélectionné est inclus dans le compte (à confirmer).

**GB-33 · Avertissement du Copilot.** Avant de générer la page de la feuille de route de la présentation de l'offre, le Copilot lit `roadmap_blockers.count` : avec moins de 3 pour une feuille de route de 3 étapes (en général, moins que le nombre d'étapes), il avertit le commercial (`roadmap_insufficient_blockers`) et montre quels blocages sont relevés. L'avertissement est un diagnostic d'accompagnement : il ne change pas la note de l'écart.

**GB-34 · D'un seul tenant.** L'écart n'existe que si PROBLEM et COST sont restitués dans la **même restitution** (une seule plage, GB-1) et que cette restitution est validée. Des composants restitués dans des restitutions différentes ne s'additionnent jamais (GB-2), quel que soit leur moment : un écart donné en morceaux, avec le prospect qui parle entre les deux, n'est pas un écart. La plage et sa durée (horodatages de début et de fin) sont gardées et affichées avec l'écart.

## A4. Règles d'exclusion (résumé)

Ces cas ne comptent jamais, quoi qu'il en soit par ailleurs :

| n° | Ne compte jamais comme… | Cas |
|---|---|---|
| X1 | un écart | Aucune restitution contenant PROBLEM et COST, validée, avant la première présentation de l'offre et le premier prix (règle d'absence) |
| X2 | une restitution | Un seul composant restitué, même fermé par « ..., non ? » |
| X3 | une restitution | Tout passage après la première présentation de l'offre ou le premier prix |
| X4 | un composant | Une proposition sur une autre personne, un témoignage, une généralité (« la plupart des gens… ») |
| X5 | un composant | Une proposition sans source antérieure chez le prospect (sans source), y compris un coût inventé par le commercial |
| X11 | un composant | Une proposition qui paraphrase le prospect : synonyme, résumé, autre forme du mot, aucune expression clé trouvée dans les deux textes (GB-3, GB-22) |
| X13 | le A sélectionné | Le plus gros chiffre de l'appel sur une autre dimension que B (revenu passé, épargne, budget) ; un chiffre hors des réponses S et I (GB-28) |
| X14 | l'unique P | Une liste de blocages restitués ensemble comme ce qui le bloque ; c'est `several_blockers` (GB-31) |
| X15 | un écart | PROBLEM et COST restitués dans des restitutions différentes, avec le prospect qui parle entre les deux (GB-34) |
| X12 | un composant ou un chiffre | Des mots ou des chiffres énoncés d'abord, arrondis ou calculés par le commercial, y compris les notes du setter et les résumés du CRM (GB-19, GB-24) |
| X6 | un coût | Un revenu actuel, un prix, un budget |
| X7 | une validation | La réponse à une autre question posée à la fin de la restitution |
| X8 | une validation | Une réaction qui vient après que le commercial a déjà mentionné l'offre |
| X9 | une validation | Une restitution corrigée que le commercial n'a pas restituée à nouveau |
| X10 | une affirmation du prospect | Un contenu dit d'abord par le commercial et seulement approuvé par le prospect (`prompted_by_sales`) |

Contre-exclusions : une queue de validation (« ..., non ? ») à la fin d'une restitution de deux composants ou plus ne la disqualifie **pas** (contrairement à une question SPIN, où la queue en fait un OUT) ; une restitution étalée sur plusieurs tours du commercial séparés seulement par de courtes approbations est une seule restitution (GB-1).

## A5. Paires minimales

Paires de passages qui ne diffèrent que d'un élément et qui changent le verdict. Elles servent à former les annotateurs et d'ensemble de non-régression de la machine.

| n° | Passage | Verdict | Pourquoi |
|---|---|---|---|
| 1a | "So your goal is 10K a month, right?" (donc ton objectif, c'est 10 000 par mois, c'est ça ?) | Pas une restitution | Un seul composant (GB-4) |
| 1b | "So you're at 2K, your goal is 10K a month, right?" (donc tu es à 2 000, ton objectif c'est 10 000 par mois, c'est ça ?) | Restitution (A, B) | Deux composants ; mais ni PROBLEM ni COST, ne peut pas passer la porte |
| 2a | "So what's held you back is confidence, and it's cost you three years. Fair?" (donc ce qui t'a retenu, c'est la confiance, et ça t'a coûté trois ans. C'est juste ?) → "Yeah, exactly." (ouais, exactement) | Écart présent | PROBLEM + COST + confirmée |
| 2b | Même restitution → le commercial continue : "Let me show you how we fix that." (je vais te montrer comment on règle ça) | Écart absent (`not_validated`) | Pas de validation du prospect avant l'offre (GB-5) |
| 3a | Le prospect, plus tôt : "I've lost so much time." (j'ai perdu tellement de temps) Restitution : "…and you've lost so much time." (…et tu as perdu tellement de temps) | COST mot pour mot | Expression clé « lost so much time » après le changement de personne (GB-22) |
| 3c | Le prospect, plus tôt : "I've lost so much time." Restitution : "…and you've wasted years on this." (…et tu as gâché des années là-dessus) | COST paraphrasé : pas un composant | Aucune expression clé dans les deux textes (X11) |
| 3b | Le prospect n'a jamais parlé d'un coût. Restitution : "…and that's probably costing you a lot of money." (…et ça te coûte sûrement beaucoup d'argent) | COST sans source | Inventé par le commercial (GB-7) |
| 4a | "…that's where you're at. Did I get that right?" (…c'est là où tu en es. C'est bien ça ?) → "Yes, and my husband doesn't believe in it either." (oui, et mon mari n'y croit pas non plus) | `confirmed_with_content` | Élément nouveau |
| 4b | "…that's where you're at. Did I get that right?" → "Yes." (oui) | `confirmed` | Pas de contenu nouveau |
| 5a | "…and that's what's been holding you back. Is that fair?" (…et c'est ce qui te retient. C'est juste ?) → "Yeah." (ouais) | Validation de la restitution | Demande S3 à laquelle le prospect répond |
| 5b | "…and that's what's been holding you back. How many hours a week can you commit?" (…et c'est ce qui te retient. Tu peux y consacrer combien d'heures par semaine ?) → "Maybe 10." (peut-être 10) | `none` | Réponse à une autre question (GB-9) |
| 6a | "Amelia was exactly where you are, stuck at 2K…" (Amelia était exactement là où tu en es, bloquée à 2 000…) | Pas un composant | Une autre personne (GB-6) |
| 6b | "You're stuck at 2K, like Amelia was…" (tu es bloquée à 2 000, comme Amelia l'était…) | Composant A | Porte sur le prospect ; la comparaison est ignorée |
| 7a | Restitution avant le partage d'écran | Peut passer la porte | Avant la présentation de l'offre |
| 7b | Même restitution après le partage d'écran | Ne peut pas passer la porte | Après la présentation de l'offre (X3) |
| 8a | "…it's more like 3K." (…c'est plutôt 3 000) Le commercial : "Got it, 3K, and you want 10K…" (d'accord, 3 000, et tu veux 10 000…) → "Exactly." (exactement) | Porte passée | Corrigée puis confirmée à nouveau |
| 8b | "…it's more like 3K." Le commercial : "Got it. So let me show you the program." (d'accord. Alors je te montre le programme) | Porte échouée (`not_validated`) | Correction non restituée (X9) |
| 9a | "You make 4K at your job." (tu gagnes 4 000 dans ton travail) (comme COST) | Pas un coût | Revenu (X6) |
| 13a | Le prospect : "I make 87,000 now… I used to make over 100,000." (je gagne 87 000 maintenant… avant je gagnais plus de 100 000) Plus tard : "ideally a hundred." (idéalement cent) | A sélectionné = 87 000 ; B = cent | A est le chiffre qu'il veut faire bouger (GB-28) |
| 13b | Même appel, restitution : "You used to make over 100K and you want to get back there." (avant tu gagnais plus de 100 000 et tu veux y revenir) | `A_not_selected` | Le plus gros chiffre, un revenu passé (X13) |
| 14a | "What's held you back?" (qu'est-ce qui t'a retenu ?) → "One, self-doubt. Two, change is scary." (un, le doute de moi. Deux, le changement fait peur) Restitution : "…and what's holding you back today is self-doubt." (…et ce qui te bloque aujourd'hui, c'est le doute de toi) | P unique, conforme si le doute de soi est le P sélectionné | GB-30, GB-31 |
| 14b | Même réponse. Restitution : "…what's holding you back is self-doubt, fear of change, and not knowing the next step." (…ce qui te bloque, c'est le doute de toi, la peur du changement et le fait de ne pas savoir quelle est la prochaine étape) | `several_blockers` : G5 plafonné à 1 | X14 ; les deux autres deviennent des étapes de la feuille de route (GB-32) |
| 15a | A « 2K a month » (2 000 par mois), B « 10K a month » (10 000 par mois) | Même unité | G3 peut atteindre 2 |
| 15b | A « 2K a month », B « to quit my job » (quitter mon travail) | `unit_mismatch` | B n'est pas dans l'unité de A (GB-29) |
| 9b | "You're spending 20 hours a week on admin work that pays 23 dollars an hour." (tu passes 20 heures par semaine sur du travail administratif payé 23 dollars de l'heure) | COST, chiffré | Conséquence en temps et en argent |
| 10a | Le prospect : "Oh, very stressed." (oh, très stressée) Restitution : "…and you've been very stressed." (…et tu as été très stressée) | COST mot pour mot | « very stressed » |
| 10b | Le prospect : "Oh, very stressed." Restitution : "…there's been a lot of stress." (…il y a eu beaucoup de stress) | Pas mot pour mot | Autre forme du mot, « stressed » ≠ « stress » (GB-22 b) |
| 11a | Le prospect : "I'm making about 1,800 a month." (je gagne à peu près 1 800 par mois) Restitution : "…you're at 1,800 a month…" (…tu es à 1 800 par mois…) | A mot pour mot, le chiffre compte | Chiffre du prospect |
| 11b | Le prospect : "I'm making about 1,800 a month." Restitution : "…you're at roughly 2K…" (…tu es à environ 2 000…) | A pas mot pour mot, le chiffre ne compte pas | Arrondi par le commercial (GB-24) |
| 12a | Le prospect : "Failure." (l'échec) Restitution : "…which, in your words, is failure." (…ce qui, pour reprendre tes mots, est l'échec) | COST mot pour mot, `explicit_quote` | Mot principal repris exactement (GB-22, GB-23) |
| 12b | Le prospect : "I wouldn't be happy." (je ne serais pas heureuse) Restitution : "…and in your words you'd be stuck in the hamster wheel." (…et pour reprendre tes mots, tu serais coincée comme un hamster dans sa roue) | Pas mot pour mot | Le marqueur ne remplace pas l'expression clé (GB-23) |

## A6. Fiabilité de la détection pour l'écart

On ne fait confiance au moteur pour repérer les écarts que lorsque, sur l'ensemble de référence de la partie C (C7) :

| Mesure | Définition | Seuil |
|---|---|---|
| Rappel des restitutions | Restitutions de l'ensemble de référence que la machine repère aussi (même plage ± 1 tour) | ≥ 95 % |
| Précision des restitutions | Restitutions de la machine qui sont des restitutions dans l'ensemble de référence | ≥ 85 % |
| Accord sur les composants | Mêmes composants sur les restitutions appariées | κ ≥ 0,80 |
| Accord sur la validation | Même issue sur les restitutions appariées | κ ≥ 0,80 |
| Accord sur la porte | Même verdict « présent / absent » par appel | ≥ 95 % |
| Accord sur la sélection de la formule | Mêmes A, B et P sélectionnés par appel, entre annotateurs et machine | ≥ 90 % par case |
| Accord sur le compte de la feuille de route | Même `roadmap_blockers.count` par appel (± 0) | ≥ 85 % |
| Accord sur les expressions clés | Même classement mot pour mot / paraphrasé par composant restitué, entre annotateurs et machine | κ ≥ 0,85 |
| Contrôle du mot pour mot | Expressions clés trouvées par le code à la fois dans la source et dans la proposition du commercial, sur les composants acceptés | 100 % (déterministe ; tout le reste est un défaut) |

D'ici là, la note de l'écart porte la mention « provisoire ». Les confusions les plus probables, et où agir : restitution manquée parce qu'aucune ouverture n'a été employée (renforcer le signal S2) ; queue à un seul composant prise pour une restitution (GB-4) ; réponse à une question finale prise pour une validation (GB-9) ; coût inventé par le commercial accepté (GB-7) ; paraphrase acceptée comme composant, ou expression générique prise pour une expression clé (GB-22).

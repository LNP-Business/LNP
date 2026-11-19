# Compétence 3 · Présentation de l'offre
_Méthodologie de notation : comment le système mesure si le commercial a présenté l'offre sur le seul blocage que le prospect a validé, avec son seul mécanisme, en quatre étapes construites avec les mots du prospect, avant la feuille de route, le prix et la décision_

**Version :** version 2.0 · 25 octobre 2026  
**Statut :** brouillon à valider par le responsable de la méthodologie. Les valeurs marquées « à valider » ou « à confirmer » sont des propositions ou des faits manquants.  
**Périmètre :** appels de vente qui contiennent une présentation de l'offre. Sources : tableau de présentation LNP « 9 blocages, 9 mécanismes » (octobre 2026), méthodologie de formalisation de l'écart v1.3 (formule de l'écart, règles du mot pour mot), référence verbatim LNP v2 (point de bascule), analyse de 85 vrais appels.  
# 1. Ce que mesure cette compétence

**Définition.** La présentation est la partie de l'appel où le commercial présente l'offre : de la première phrase qui décrit l'offre (ou du début du partage d'écran du programme) jusqu'au premier prix, ou jusqu'à la fin de la présentation si aucun prix n'est donné.

**Ce qu'est désormais la présentation.** La présentation traite **un seul blocage** : le blocage P que le prospect a validé dans l'écart. Elle y répond avec **un seul mécanisme** : le mécanisme de l'offre qui porte le nom de ce blocage. Elle se déroule comme un **escalier de quatre étapes, dans cet ordre**, chaque étape partant de ce que le prospect a dit : (1) reformuler le blocage, (2) le mécanisme, (3) la transformation A → B, (4) la preuve. **Seulement après** les quatre étapes viennent la feuille de route (les autres blocages du prospect), puis le montant, puis la décision. Le tableau que celui-ci remplace demandait au commercial de parcourir trois fois les étapes 1 et 2 ; ce n'est plus le cas : les autres blocages vont dans la feuille de route.

**Ce que veut dire réussir, en une phrase.** Le commercial a réussi quand, une fois l'écart validé, il a reformulé le blocage du prospect avec ses mots exacts, donné le seul mécanisme de ce blocage comme un principe que le prospect peut répéter et la phase de l'offre qui le porte, décrit sa propre transformation de A vers B dans son unité et avec ses mots, donné un vrai cas client parti de là où il part, puis montré sa feuille de route avant tout prix, et que le prospect s'est approprié la solution avec ses propres mots.

**Le test qui décide de tout.** **Cette présentation n'est vraie que pour lui.** Chaque étape doit contenir quelque chose que seul ce prospect a dit (son blocage, ses chiffres, ses mots, un cas parti de là où il est). Une étape qu'on pourrait dire mot pour mot à n'importe quel autre prospect est générique et ne peut pas atteindre le niveau le plus haut.

**Ce qui est interdit, même si cela aidait à signer (exclusions strictes).**
1. **Présenter avant le oui.** Présenter l'offre avant que l'écart soit validé. Le Copilote bloque la présentation tant que l'écart n'est pas validé.
2. **Tout ce qui sort de son écart ou de l'offre.** Un chiffre, un cas client, un prix ou une garantie qui n'est ni dans l'écart du prospect (ses citations) ni dans la référence de l'offre (offre, bibliothèque de cas).
3. **Promettre que l'Académie fait son travail.** Dire que l'Académie fera tourner son activité, trouvera ou signera ses clients, ou réalisera ses projets. L'Académie apporte les systèmes, les retours et l'accompagnement ; c'est lui qui fait tourner son activité.

Une seule d'entre elles rend la présentation **non conforme** : note de présentation = 0 pour l'appel, avec la raison affichée (§ 5.1).

**Ce qui n'est pas mesuré.** Le style, l'énergie, les diapositives. La note de présentation mesure si l'offre a été reliée au blocage validé de ce prospect, dans l'ordre prescrit, et si le prospect s'y est relié.

# Partie A · Définitions
Les règles qui repèrent chaque élément dans une transcription brute (unités, marqueurs de début et de fin, découpage, exclusions et paires minimales) sont dans l'**annexe A · Règles de bornage**. L'**annexe B** donne de vrais cas annotés pour la calibration. Un verdict qui ne peut pas être atteint avec ces règles va à l'arbitre comme cas non couvert.

# 2. Vocabulaire

## 2.1 L'offre : 9 blocages, 9 mécanismes

Chaque mécanisme répond à un blocage et porte son nom. Le Copilote choisit le mécanisme qui correspond au P du prospect, à partir de la phrase que le prospect a dite. Les noms des catégories restent écrits en anglais dans le code et dans l'enregistrement (valeurs fermées, entre parenthèses).

| Blocage (= mécanisme) | La phrase du prospect, typiquement |
|---|---|
| Compétence (`Skill`) | « est-ce que je suis vraiment capable de le faire ? » |
| Légitimité (`Legitimacy`) | « qui va me prendre sans expérience ? » |
| Tarification (`Pricing`) | « je ne sais pas combien facturer » |
| Acquisition (`Acquisition`) | « je ne sais pas d'où viendront les clients » |
| Vente (`Selling`) | « je ne sais pas comment transformer une conversation en client » |
| Réalisation (`Delivery`) | « je ne suis pas sûr de savoir mener un projet client de bout en bout » |
| Temps (`Time`) | « je n'ai que quelques heures par semaine » |
| Échec passé (`Past failure`) | « j'ai suivi une formation et il ne s'est rien passé » |
| Risque financier (`Financial risk`) | « et si ça ne marche pas ? » |

**Catégorie de P.** Le modèle classe le P validé (la citation exacte du prospect) dans une des neuf catégories, avec les tests de frontière de l'annexe A (PB-27). Un P qui n'entre dans aucune est `P_category_unknown` : il va à l'arbitre comme `uncovered_case`, et l'escalier est noté sans l'étape 2 (§ 5.3).

**Référence des mécanismes (à confirmer).** Pour chacun des neuf mécanismes, la référence de l'offre doit garder : son nom ; son **principe**, une phrase que le prospect peut répéter ; la **phase de l'offre** qui le porte ; et ses indices lexicaux. Ces textes ne sont pas encore écrits : ils doivent être fournis par le responsable de l'offre. En attendant, l'étape 2 n'est vérifiée que sur la catégorie et signalée `mechanism_reference_missing`.

## 2.2 L'escalier : quatre étapes, dans cet ordre

Chaque étape part de ce que le prospect a dit. Phrases courtes, naturelles à l'oral : **une à trois phrases par étape**.

| Étape | Vient de | Phrase d'ouverture (indicative) | Bien faite | L'échec qui compte |
|---|---|---|---|---|
| **1 · Reformuler le blocage** | P (écart) | « Ce qui te bloque aujourd'hui, c'est… » | Son blocage, avec **ses mots exacts**. Pas de traduction, pas de résumé | Le dire avec le vocabulaire du commercial : il ne s'y reconnaît plus |
| **2 · Le mécanisme** | P retourné | « Ce qui fait céder ça, c'est… » | **Un** mécanisme, celui de son blocage, dit comme un principe qu'il peut répéter en une phrase, puis la phase de l'offre qui le porte. Exemple : Légitimité | Ajouter un second mécanisme, ou réciter le contenu de l'offre |
| **3 · La transformation** | A → B (écart) | « Tu passes de A à B. » | Dans **son unité** : ses euros, ses heures, ses clients. Son échéance **seulement s'il en a donné une**. Se termine par une image concrète de sa vie une fois arrivé, **avec ses mots** | Parler dans l'unité du commercial, ou inventer une date |
| **4 · La preuve** | A, son point de départ | « Quelqu'un qui est parti exactement de là où tu es… » | Un **vrai cas client**, cité avec le consentement du client, dont le point de départ ressemble au sien. Sans cas qui corresponde, le Copilote laisse une case à remplir : il **n'invente jamais** | Sortir le meilleur cas : il ne s'y reconnaît pas |

**Et seulement après :** sa feuille de route, puis le montant, puis la décision. **Ni la présentation ni la page de la feuille de route ne donnent le prix.**

## 2.3 La feuille de route : la page du client

La présentation traite le blocage qu'il a validé. **Ses autres blocages deviennent les étapes de sa feuille de route sur une page**, partagée à l'écran à la fin de l'appel, puis envoyée par lien privé. Une étape par blocage qu'il a nommé, dans l'ordre où ils doivent tomber (règle d'ordre à confirmer ; proposition : l'ordre du tableau du § 2.1).

| Bloc | Contenu |
|---|---|
| **Aujourd'hui** | Son point A, quantifié, avec sa phrase, et ce que le statu quo lui coûte sur un an |
| **Étape 1** | Son blocage (mot pour mot) · 2 livrables de l'Académie · une preuve · ce que ça lui apporte, avec le calcul · une première victoire sous 30 jours |
| **Étape 2** | Blocage suivant · mêmes rubriques · le palier monte |
| **Étape 3 (ou 4)** | Dernier blocage · le dernier palier égale son objectif |
| **Son objectif** | Son point B · le gain par an et ses autres gains : temps, confiance, crédibilité, sécurité, liberté |

**Valeurs.** La valeur de chaque étape est calculée avec ses chiffres (prix par projet, heures, demandes et taux de signature). Un chiffre manquant apparaît en petits caractères sous la forme **« À demander »** : le commercial le lui demande en direct.

**Contrôles avant de partager le lien.** Le lien ne peut être copié que lorsque chaque contrôle est vert :
- capacité tenue à chaque palier ;
- flux de clients expliqué ;
- objectif respecté (le dernier palier égale B) ;
- valeurs qui s'additionnent ;
- aucun prix de l'offre ;
- pas de lien (sens à confirmer) ;
- 3 ou 4 étapes ;
- tient sur un écran ;
- point de départ choisi.

Les contrôles ◇ informent sans bloquer : une étape sans preuve est comptée dans **Administration › Preuves manquantes**, pour savoir quelle preuve recueillir en premier.

**Nombre de blocages.** Une feuille de route en 3 étapes demande au moins 3 blocages relevés dans les réponses P ou I ; en dessous, le Copilote prévient le commercial avant de produire la page (méthodologie de l'écart, GB-32 et GB-33). Point ouvert à confirmer : le blocage traité dans la présentation compte-t-il aussi comme étape de la feuille de route (le tableau dit « les autres deviennent les étapes », alors que la page montre « Étape 1 · son blocage »).

## 2.4 Autres termes

**Limites de la présentation.** Placées par la carte des phases (Partie C, C2, étape S2) :
- **Début de la présentation :** le premier tour du commercial qui décrit l'offre (son contenu, son format, sa durée, son accompagnement, sa garantie) ou qui annonce et lance un partage d'écran du programme. Une réponse d'une phrase à une question directe du prospect sur ce qu'est l'offre n'est pas un début de présentation ; elle est notée `offer_mention` (mention de l'offre) (annexe A, PB-1, PB-2, PB-17).
- **Fin de la présentation :** le premier énoncé d'un prix par le commercial ; sinon la première demande de décision ; sinon la fin de l'appel.

**P validé.** Le blocage reformulé dans la restitution qui a franchi la porte d'absence de l'écart. Si cette restitution a reformulé plusieurs blocages, le P validé est, parmi eux, le P choisi par la méthodologie de l'écart (GB-30).

**Adhésion.** Le moment où le prospect passe de la réserve à l'adhésion, observé dans ses mots : il fait sienne la solution, se projette concrètement dans son utilisation, ou formule un nouveau lien entre l'offre et sa situation (annexe A, PB-14). Un simple « ok », « ça me va », « c'est super » n'est pas une adhésion.

# Partie B · Mécanisme et notation

# 3. Ce que le système extrait

| Champ | Question fermée posée au modèle | Preuve |
|---|---|---|
| `pitch_start`, `pitch_end`, `first_price`, `decision_request` | Ancres des phases | Numéro de tour et citation exacte du commercial |
| `validated_P` | Pris dans le résultat de l'écart du même appel (verdict, restitution, P choisi) | Citation du prospect, tour |
| `P_category` | À laquelle des neuf catégories appartient le P validé ? (PB-27) | Catégorie, citation du prospect |
| `steps` | Pour chacune des quatre étapes : quel passage du commercial la réalise ? (PB-28 à PB-31) | Plage de tours, citation exacte du commercial |
| `mechanisms_stated` | Quels mécanismes de la référence le commercial énonce-t-il comme principe ou comme phase dans la présentation, avant la feuille de route ? (PB-29) | Nom du mécanisme, citation exacte du commercial |
| `transformation` | Quels A, B, unité, échéance et image de vie l'étape 3 énonce-t-elle, et à partir de quelles citations du prospect ? (PB-30) | Citation du commercial, citations sources du prospect |
| `proof_case` | Quel cas client est cité à l'étape 4 ? Est-il dans la bibliothèque de cas ? (PB-31) | Citation du commercial, identifiant du cas ou `not_in_library` |
| `roadmap` | Où le commercial présente-t-il la feuille de route, et quels blocages en sont les étapes ? (PB-34) | Plage de tours, citations du commercial, citations sources du prospect |
| `claims` | Quels chiffres, cas clients, prix et garanties le commercial énonce-t-il dans la présentation ? (PB-35) | Citation du commercial |
| `outcome_promises` | Le commercial dit-il que l'Académie fera tourner son activité, trouvera ou signera ses clients, ou réalisera ses projets ? (PB-36) | Citation du commercial |
| `adhesion` | Quels passages du prospect montrent une appropriation, une projection concrète ou un nouveau lien ? Pour chacun, le geste du commercial juste avant | Citation du prospect, citation du geste du commercial |

Les noms des champs restent ceux de l'enregistrement (en anglais).

**Calculé par le code :**
- `gap_verdict` et `validated_P`, à partir du résultat de l'écart du même appel ;
- la vérification mot pour mot de l'étape 1 et de l'étape 3 (annexe A de l'écart, GB-22) ;
- l'ordre des étapes, de la feuille de route, du prix et de la demande de décision, sur les numéros de tour ;
- le nombre de phrases de chaque étape ;
- la correspondance entre le mécanisme énoncé et `P_category` ;
- la correspondance de chaque affirmation avec les citations de l'écart du prospect, la référence de l'offre et la bibliothèque de cas (PB-35) ;
- la correspondance entre le point de départ du cas de preuve et le A du prospect (PB-31).

# 4. Applicabilité

| Situation | Statut de la présentation |
|---|---|
| Un début de présentation existe | `scored` (notée) |
| Seulement une `offer_mention`, pas de présentation | `not_applicable` (sans objet) |
| Second appel où la présentation reprend après un premier appel | `scored` ; l'écart doit être validé à nouveau dans cet appel avant que la présentation reprenne (écart, GB-13) |
| Référence de l'offre ou référence des mécanismes manquante | `scored`, étape 2 vérifiée sur la catégorie seulement, signal `mechanism_reference_missing` |
| Bibliothèque de cas manquante | `scored`, étape 4 `not_applicable`, signal `case_library_missing` |

# 5. La note de présentation

### 5.1 Étape 1 : la porte de conformité

Le code vérifie, dans cet ordre :
1. **Présentation après le oui.** Le verdict de l'écart de l'appel est « présent » et le tour de validation vient avant le début de la présentation. Sinon : raison `pitch_before_gap`.
2. **Rien en dehors de son écart ou de l'offre.** Aucune affirmation (chiffre, cas client, prix, garantie) qui ne soit ni dans les citations de l'écart du prospect, ni dans la référence de l'offre ou la bibliothèque de cas (PB-35). Sinon : raison `out_of_gap_claim`.
3. **Aucune promesse que l'Académie fait son travail.** Aucune promesse de résultat (PB-36). Sinon : raison `outcome_promise`.

Si un contrôle échoue : **verdict « non conforme », note de présentation = 0**, avec chaque raison d'échec gardée et la première affichée. Les items ci-dessous sont quand même calculés et montrés comme diagnostics, jamais comme une note. (Sévérité à valider : l'autre possibilité est un plafond à 40 au lieu de 0.)

### 5.2 Étape 2 : la note d'une présentation conforme

Sept items, chacun noté 0, 1 ou 2. **Note de l'appel = Σ (poids × niveau / 2)**, arrondie, sur 100.

| Item | Poids | Niveau 0 | Niveau 1 | Niveau 2 |
|---|---|---|---|---|
| K1 Étape 1 · Blocage reformulé | 15 | Aucune reformulation du P validé dans la présentation, ou seulement une paraphrase (pas d'expression clé, écart GB-22) | Le P validé reformulé mot pour mot, mais avec d'autres blocages, ou un autre blocage reformulé à sa place | Le P validé seul, reformulé mot pour mot |
| K2 Étape 2 · Le mécanisme | 20 | Aucun mécanisme énoncé ; ou le mécanisme d'une autre catégorie ; ou deux mécanismes ou plus | Le mécanisme de la catégorie de P, seul, mais sans le principe en une phrase ou sans la phase de l'offre, ou suivi d'une récitation du contenu de l'offre | Le mécanisme de la catégorie de P, seul, comme un principe en une phrase, puis la phase de l'offre qui le porte |
| K3 Étape 3 · La transformation | 15 | Pas de A → B ; ou A et B dans une unité qui n'est pas celle du prospect ; ou une échéance que le prospect n'a jamais donnée | A → B dans l'unité du prospect avec ses chiffres, sans date inventée, mais sans image de sa vie une fois arrivé, ou avec une image qui n'est pas dans ses mots | A → B dans son unité avec ses chiffres, son échéance seulement s'il en a donné une, se terminant par une image concrète de sa vie avec ses mots (expression clé, écart GB-22) |
| K4 Étape 4 · La preuve | 15 | Aucun cas client | Un vrai cas de la bibliothèque, dont le point de départ ne correspond pas à son A (le meilleur cas) | Un vrai cas de la bibliothèque, avec consentement, dont le point de départ correspond à son A (PB-31) |
| K5 Ordre et brièveté | 10 | Moins de trois des quatre étapes | Les étapes présentes mais pas dans l'ordre 1 → 2 → 3 → 4, ou une étape de plus de trois phrases | Les quatre étapes, dans l'ordre, chacune d'une à trois phrases |
| K6 Puis : feuille de route, montant, décision | 15 | Aucune feuille de route présentée, ou le prix donné avant la feuille de route | Feuille de route présentée après l'étape 4 et avant le prix, mais ses étapes ne sont pas les blocages qu'il a nommés, ou la demande de décision vient avant le prix | Feuille de route après l'étape 4, ses étapes sont ses autres blocages avec ses mots, puis le montant, puis la décision |
| K7 Adhésion | 10 | Aucune adhésion | Un passage d'adhésion | Deux passages d'adhésion ou plus, ou un seul avec une projection concrète (une date, un nombre, une première action nommée) |

**Le test « vrai seulement pour lui ».** K1 à K4 n'atteignent le niveau 2 que si l'étape contient au moins un élément que seul ce prospect a dit : son expression clé (K1), ses chiffres et ses mots (K3), un cas qui correspond à son A (K4) ; K2 n'atteint le niveau 2 que s'il suit un K1 qui l'atteint. Une étape qui serait identique avec n'importe quel autre prospect est plafonnée au niveau 1 (`generic_step`).

**Étape 4 sans cas qui corresponde.** Si la bibliothèque de cas ne contient aucun cas dont le point de départ correspond à son A, l'étape 4 est `not_applicable` pour K4 (le commercial ne doit pas en inventer un ; le Copilote laisse une case à remplir) et l'appel est compté dans **Preuves manquantes**. Le poids de K4 est alors réparti au prorata sur les autres items.

**P hors des neuf catégories.** Si `P_category_unknown`, K2 est `not_applicable` et son poids est réparti au prorata sur les autres items ; le cas est signalé au responsable de la méthodologie.

**Pourquoi ces poids.** Le mécanisme (20) est ce qui fait céder le blocage. Le blocage, la transformation, la preuve et la suite feuille de route → montant → décision (15 chacun) portent le reste du tableau. L'ordre et l'adhésion (10 chacun) vérifient la façon de dérouler et la réaction du prospect. Propositions, à valider.

# 6. Comment le système sait que le commercial a réussi

1. **Il a présenté après le oui.** Le verdict de l'écart et le tour de validation viennent du résultat de l'écart ; le début de la présentation est placé après, sur les numéros de tour. Sinon la présentation n'est pas conforme.
2. **Un blocage, ses mots.** L'étape 1 contient l'expression clé du prospect pour le P validé, vérifiée par le code dans les deux textes ; un autre blocage à sa place, ou plusieurs, ne peut pas atteindre le niveau le plus haut.
3. **Un mécanisme, le bon.** Le mécanisme énoncé est comparé à la catégorie du P validé ; un second mécanisme ou une récitation de l'offre est détecté et indiqué avec sa citation.
4. **Sa transformation, sa preuve.** A, B et l'image viennent des citations du prospect ; l'unité et l'échéance sont comparées aux siennes ; le cas est cherché dans la bibliothèque et son point de départ comparé à son A.
5. **L'ordre.** Étapes 1 à 4, feuille de route, prix, décision : tout est placé sur les numéros de tour et comparé par le code.
6. **Rien d'inventé, rien de promis.** Chaque chiffre, cas, prix et garantie est comparé à son écart et à l'offre ; chaque promesse de résultat est relevée avec sa citation.
7. **Le prospect se projette.** L'adhésion se lit dans ses mots, avec une citation ; un simple accord ne compte jamais.
8. **C'est reproductible.** Trois lectures concordantes ou une décision arbitrée pour chaque étape, chaque affirmation et chaque passage d'adhésion (Partie C, C4).

# 7. Diagnostics d'accompagnement (affichés, jamais notés)

| Diagnostic | Calcul |
|---|---|
| Raisons de non-conformité | Répartition de `pitch_before_gap`, `out_of_gap_claim`, `outcome_promise` sur la période |
| Catégorie de P | Répartition du P validé sur les neuf blocages ; part de `P_category_unknown` |
| Erreurs de mécanisme | Part des présentations avec un second mécanisme, le mauvais mécanisme ou une récitation de l'offre |
| Échecs par étape | Pour chaque étape, l'échec le plus fréquent (paraphrase, autre unité, date inventée, meilleur cas) |
| Preuves manquantes | Appels pour lesquels aucun cas correspondant n'existait, par catégorie de P et par point de départ : quelle preuve recueillir en premier |
| Feuille de route | Nombre d'étapes de la feuille de route ; part des feuilles de route partagées avant le prix ; chiffres « À demander » restés ouverts |
| Part de parole pendant la présentation | Part des mots dits par le commercial entre le début et la fin de la présentation ; au-dessus de 85 %, signalé « monologue » (seuil à valider) |
| Geste avant l'adhésion | Les gestes du commercial qui précèdent le plus souvent l'adhésion, sur l'ensemble des appels |
| Points de contrôle | Sollicitations du commercial dans la présentation qui demandent comment une composante s'applique à lui, et s'il a répondu avec du contenu (annexe A, PB-11 à PB-13) |
| Ancienne couverture (version 1) | Blocages et critères du prospect auxquels une composante répond dans la présentation (liens, annexe A PB-8 à PB-10), montrés pour comparaison pendant la transition |

**Référence observée sur Valentino (85 appels avec une présentation, indicateurs de la version 1, avant l'existence de ce tableau) :** présentation commencée après une restitution d'au moins deux composantes dans 76 % des appels ; un passage d'adhésion observé après le début de la présentation dans 59 %. Aucun des items de la version 2 (blocage unique, mécanisme unique, escalier, preuve correspondante, feuille de route avant le prix) n'a encore été mesuré : ce sont les premiers chiffres à établir une fois les appels faits avec le nouveau tableau.

# 8. Exemples commentés
Cas d'illustration, adaptés et raccourcis. En production, chaque preuve est une citation exacte vérifiée dans la transcription.

| Cas | Verdict |
|---|---|
| P validé : « Je ne sais pas combien facturer. » Commercial : « Ce qui te bloque aujourd'hui, c'est que tu ne sais pas combien facturer. » | K1 = 2 (mot pour mot) |
| Même P. Commercial : « Ce qui te bloque aujourd'hui, c'est ta stratégie tarifaire. » | K1 = 0 : paraphrase avec le vocabulaire du commercial |
| Catégorie de P Tarification. Le commercial énonce le principe de la Tarification en une phrase, puis « c'est la deuxième phase de l'Académie ». | K2 = 2 |
| Même chose, puis : « Et en plus, le système d'Acquisition va t'amener des contacts… » | K2 = 0 : un second mécanisme |
| Prospect : A « à peu près 2 000 par mois », B « 10 000 par mois », pas d'échéance, « être à la maison quand mes enfants rentrent de l'école ». Commercial : « Tu passes d'à peu près 2 000 par mois à 10 000 par mois, et tu es à la maison quand tes enfants rentrent de l'école. » | K3 = 2 |
| Même chose, commercial : « Tu passes à six chiffres d'ici l'été prochain. » | K3 = 0 : autre unité, date inventée |
| Le prospect part de zéro client avec un emploi à temps plein. Le commercial cite le cas de la bibliothèque d'un élève parti de zéro client avec un emploi à temps plein. | K4 = 2 |
| Le commercial cite l'élève arrivé à 30 000 par mois, qui avait commencé comme professionnel déjà installé. | K4 = 1 : meilleur cas, le point de départ ne correspond pas |
| Commercial : « On va te trouver les clients. » | Non conforme, `outcome_promise` : note 0 |
| Commercial : « Nos élèves gagnent en moyenne 15 000 par mois. » Le chiffre n'est pas dans la référence de l'offre. | Non conforme, `out_of_gap_claim` : note 0 |
| Prix « 5 800 € » donné juste après l'étape 3, feuille de route jamais montrée | K6 = 0 |

# 9. Contrat de sortie

Les clés et les valeurs fermées restent en anglais (format enregistré, voir `docs/CONTRAT_DE_SORTIE.md`).

```
{
  "call_id": "…", "competence": "PITCH", "rules_version": "PITCH-2.0",
  "status": "scored", "verdict": "compliant", "non_compliance": [], "score": 78,
  "phases": {"pitch_start": "T185", "roadmap": ["T231", "T248"], "first_price": "T259",
             "decision_request": "T266"},
  "validated_P": {"quote": "…", "turn": "T120", "category": "Pricing"},
  "steps": {"1": {"span": ["T186", "T186"], "key_expression": "…", "verbatim": true, "sentences": 1},
            "2": {"span": ["T187", "T189"], "mechanisms": ["Pricing"], "principle": true,
                  "offer_phase": true, "recitation": false, "sentences": 3},
            "3": {"span": ["T190", "T191"], "A": "…", "B": "…", "same_unit": true,
                  "deadline": null, "image_key_expression": "…", "sentences": 2},
            "4": {"span": ["T192", "T194"], "case_id": "…", "consent": true,
                  "start_matches_A": true, "sentences": 3}},
  "order_ok": true,
  "roadmap": {"steps": [{"blocker_quote": "…", "turn": "T061"}], "before_price": true},
  "claims": [{"quote": "…", "source": "offer_reference"}],
  "adhesion": [{"turn": "T214", "quote": "…", "sales_gesture": "…", "projection": true}],
  "items": [{"id": "K1", "level": 2}, {"id": "K2", "level": 2}],
  "concordance": "3/3"
}
```

# 10. Décisions à valider

- La porte de conformité : note 0 pour `pitch_before_gap`, `out_of_gap_claim` et `outcome_promise` (autre possibilité : plafond à 40).
- Les sept items et leurs poids (15 / 20 / 15 / 15 / 10 / 15 / 10).
- **À confirmer par le responsable de l'offre :** pour chacun des neuf mécanismes, son principe en une phrase, la phase de l'offre qui le porte et ses indices lexicaux.
- **À confirmer :** la bibliothèque de cas (cas, consentement du client, point de départ de chaque cas) et la règle de correspondance de PB-31 (même dimension que A, valeur de départ à un facteur près, facteur à définir).
- **À confirmer :** l'ordre dans lequel les blocages de la feuille de route doivent tomber ; le blocage traité dans la présentation est-il aussi une étape de la feuille de route ; le sens du contrôle « pas de lien ».
- La limite d'une à trois phrases par étape (découpage en phrases par le code ; tolérance à valider).
- Que faire des vrais blocages hors des neuf catégories (peur, trop réfléchir, manque d'argent ; voir annexe B, B5).

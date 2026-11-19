# Annexe A · Règles de bornage de la présentation de l'offre

Cette annexe dit comment le système repère, dans une transcription brute, le début et la fin de la présentation, ses segments, les liens avec ce que le prospect a apporté, les points de contrôle et l'adhésion du prospect. Une règle qui n'est pas écrite ici n'existe pas : un cas non couvert va à l'arbitre avec l'étiquette `uncovered_case` et devient une nouvelle règle numérotée.

Les appels de LNP sont en français ; les listes d'indices ci-dessous donnent les tournures françaises, puis entre parenthèses les tournures anglaises des transcriptions de référence des tests, que le code reconnaît aussi.

## A1. Ancres des phases

**PB-1 · Début de la présentation.** Le premier tour du commercial qui remplit une de ces conditions :
- il décrit l'offre : son contenu (modules, piliers, étapes), son format (accompagnement, coaching, communauté, appels), sa durée (« six mois »), son suivi, sa garantie ou sa promesse de résultat (« dans six mois, tu auras… ») ;
- il annonce ou lance un partage d'écran du programme (« je te partage mon écran », « tu vois mon écran ? ») suivi, dans les 2 tours suivants du commercial, d'une description de l'offre.

Indices lexicaux utilisés par l'inventaire (jamais décisifs seuls) : « le programme », « l'accompagnement », « l'académie », « ce qu'on fait, c'est », « la façon dont on aide », « comment ça marche », « le premier pilier », « module », « six mois », « je vais te montrer », « partager mon écran » ("the program", "the mentorship", "the academy", "what we do is", "the way we help", "how it works", "the first pillar", "module", "six-month", "let me show you", "share my screen").

**PB-2 · Mention de l'offre (pas un début de présentation).** Un passage qui décrit l'offre et qui est suivi, dans les 2 tours suivants du commercial, d'un retour aux questions de découverte (voir PB-17). Il est noté `offer_mention`.

**PB-3 · Premier prix.** Le premier passage du commercial qui énonce un montant **pour l'offre** (prix complet, échéance, acompte, remise). Ce n'est jamais un prix : le revenu d'un ancien élève, le prix par projet que le prospect pourrait facturer, un budget de publicité ou de logiciel, un montant cité par le prospect. Un prix énoncé par le prospect (« j'ai vu que c'est 5 800 ») est noté mais n'est pas le premier prix. (Romain, 2026-11-03.) Le premier prix est dit par le commercial et accompagne l'explication de l'offre de l'entreprise : le montant doit être ce que ce prospect paierait pour l'offre présentée, et le tour du commercial qui explique cette offre (le même tour ou un tour précédent) est cité ; un exemple de ce que le prospect pourrait faire payer à ses propres élèves (« un programme de 10 semaines à 500 euros »), un prix du marché ou un budget n'est jamais le premier prix. Un prix valide dit avant le début de présentation trouvé par PB-1 appartient à cette explication : la présentation commence au tour qui explique l'offre. Une introduction de l'appel (« si on travaille ensemble, ce sera sur quatre mois ») suivie de questions de découverte est une mention de l'offre (PB-2), jamais le début de la présentation. (Moteur allégé : appliqué avec une preuve citée et vérifiée par le code ; moteur de référence : voir DECISIONS_OUVERTES.)

**PB-4 · Fin de la présentation.** Le premier de ces moments : le premier prix ; la première demande de décision (« tu es prêt à démarrer ? », « qu'est-ce que tu veux faire ? ») ; la fin de l'appel.

**PB-5 · Présentation sur deux appels.** Si la présentation commence dans un appel et reprend dans l'appel suivant du même cycle, chaque appel a son propre début de présentation ; ce que le prospect a apporté dans l'appel précédent reste une donnée d'entrée valide.

## A2. Segments

**PB-6 · Limites des segments.** À l'intérieur de la présentation, un nouveau segment commence à :
- un marqueur d'énumération (« la première chose », « deuxièmement », « ensuite », « puis on a », « en plus de ça », « le dernier élément », « pilier un/deux/trois », « module » ; "the first thing", "second", "next", "then we have", "on top of that", "the last piece", "pillar one/two/three", "module") ;
- une navigation à l'écran annoncée par le commercial (« sur cette diapositive », « si je descends », « cette partie suivante » ; "on this slide", "if I scroll down", "this next part") ;
- un tour du prospect de 6 mots ou plus (le passage du commercial qui suit commence un nouveau segment).

**PB-7 · Étiquette d'un segment.** Le modèle étiquette chaque segment avec une composante de la référence de l'offre (par exemple : appels d'accompagnement, relecture de projet, module de tarification, acquisition de clients, communauté, outils d'IA, garantie, calendrier). Un segment qui ne présente aucune composante (une histoire, un passage de motivation) est étiqueté `narrative`. Un segment qui présente deux composantes est coupé au premier mot de la seconde composante.

## A3. Liens (diagnostic seulement depuis la version 2.0)

Depuis la version 2.0, la présentation ne traite qu'un seul blocage, et les autres blocages vont dans la feuille de route : les liens et la couverture ne sont plus notés. PB-8 à PB-10 sont gardées pour calculer le diagnostic « ancienne couverture » pendant la transition.


**PB-8 · Ce qu'est un lien.** Un segment est relié à une donnée du prospect (blocage ou critère) quand, dans le segment ou dans le tour suivant du commercial, le commercial :
- (a) renvoie explicitement à la donnée du prospect avec un marqueur de discours rapporté (« tu as dit », « tu as parlé de », « tu m'as dit », « tout à l'heure tu disais », « pour toi en particulier », « tu te souviens quand tu as dit » ; "you said", "you mentioned", "you told me", "earlier you were saying", "for you specifically", "remember when you said") **et** reprend au moins un mot de contenu ou un nombre de cette donnée ; ou
- (b) reprend au moins un mot de contenu ou un nombre de la donnée **et** le relie à la composante par un connecteur de cause ou de but (« pour que », « ce qui veut dire », « c'est pour ça que », « c'est ce qui règle », « ça sert à », « ça résout », « c'est là que … intervient » ; "so that", "which means", "that's why", "this is what fixes", "this is for", "this solves", "this is where … comes in").

**PB-9 · Ce qui n'est pas un lien.** Une personnalisation générique (« les gens comme toi », « beaucoup de nos élèves ont du mal avec ça ») ; le prénom du prospect cité sans sa donnée ; un mot repris sans lien avec la composante ; un lien vers une donnée que le prospect n'a jamais énoncée (introuvable).

**PB-10 · Données d'entrée.** Les blocages et les critères sont pris dans ce que le prospect a dit **avant le début de la présentation** (et dans les appels précédents du même cycle). Les critères excluent le prix et le budget. Une phrase dite après le début de la présentation peut être une réaction ou une objection, jamais une donnée d'entrée pour la couverture.

## A4. Points de contrôle (diagnostic seulement depuis la version 2.0)


**PB-11 · Point de contrôle.** Une sollicitation du commercial dans la présentation qui demande comment une composante s'applique au prospect, quelle partie compte le plus pour lui, où il se voit, ou ce qu'il en ferait.

**PB-12 · Pas un point de contrôle.** « Ça te parle ? », « Tu vois mon écran ? », « Des questions pour l'instant ? », « Ça va ? », « Ça te va ? », « Non ? », « Tu me suis ? » ("Does that make sense?", "Can you see my screen?", "Any questions so far?", "Cool?", "Sounds good?", "Right?", "You with me?"), et toute question de logistique (heures disponibles, date de début) ou d'argent.

**PB-13 · Réponse avec contenu.** Le tour suivant du prospect contient quelque chose qui vient de lui au-delà de l'accord (une préférence, une peur, une projection, une question sur son propre cas).

## A5. Adhésion

**PB-14 · Adhésion.** Un passage du prospect, du début de la présentation jusqu'à la demande de décision, qui montre l'une de ces choses :
- **appropriation :** le prospect reformule une composante appliquée à lui-même (« donc j'aurais quelqu'un qui relit mes cours chaque semaine ») ;
- **projection concrète :** première personne, futur ou conditionnel, avec un élément concret (une date, un nombre, une première action, un client ou un projet nommé) (« si je commence maintenant, je pourrais avoir mes premiers élèves avant mars ») ;
- **nouveau lien :** le prospect relie de lui-même une composante à sa situation (« c'est exactement ce qui me manquait avec la dernière formation »).

**PB-15 · Pas une adhésion.** Les simples approbations et compliments (« ok », « ça me va », « c'est super », « waouh », « génial », « j'adore » ; "okay", "sounds good", "that's great", "wow", "amazing", "I love that") ; les questions de prix, de paiement ou de logistique sans projection (« c'est combien ? », « ça commence quand ? »), qui sont notées `buying_signal` (signal d'achat) ; un contenu énoncé d'abord par le commercial et seulement approuvé.

**PB-16 · Le geste avant l'adhésion.** Pour chaque passage d'adhésion, le modèle cite le passage du commercial juste avant (le geste qui l'a produit). Cette paire sert à l'accompagnement ; elle ne change pas la note.

## A5b. Règles ajoutées après la première passe de calibration

**PB-17 · Mention non sollicitée.** Une description de l'offre de n'importe quelle longueur, sollicitée ou non, suivie dans les 2 tours suivants du commercial d'un retour aux questions de découverte est une `offer_mention`, pas un début de présentation. Cela remplace la clause de la « seconde mention » de PB-2 : des mentions répétées restent des mentions tant que chacune est suivie d'un retour à la découverte.

**PB-18 · Montants hypothétiques et fourchettes.** Un montant hypothétique (« disons que c'était 10K, ce n'est pas le prix ») n'est jamais un prix. Une fourchette donnée pour l'offre (« entre 3 000 et 8 000 ») est un prix. Un montant n'est accepté comme prix de l'offre que s'il est vraisemblable pour la référence de l'offre (entre 0,3 et 3 fois le prix de référence, à valider) ; sinon il est noté `amount_doubtful` (montant douteux) pour être revu (par exemple « 800 à 1 000 » dit à propos de l'offre alors que c'est un prix par projet).

**PB-19 · Prix avant la présentation.** Un prix donné avant le début de la présentation est enregistré (`early_price`, K6 = 0 : le prix vient avant la feuille de route) mais ne fixe pas la fin de la présentation ; la présentation se termine alors à la première demande de décision ou à la fin de l'appel.

**PB-20 · Données hors de la transcription.** Les blocages et les critères connus seulement par le formulaire de candidature ou le CRM sont des données d'entrée valides s'ils sont enregistrés dans la fiche du prospect avant l'appel (source `form`). Un lien vers eux suit PB-8 (le commercial doit les nommer dans la présentation). Ce qui n'existe nulle part par écrit n'est pas une donnée d'entrée.

**PB-21 · Normalisation des nombres.** Avant l'ancrage, les nombres sont normalisés : "10K" = "10,000" = "$10,000" = "ten thousand" ; "5 grand" = 5 000 ; les devises sont ignorées pour la comparaison. Les mêmes équivalences valent pour les formes françaises (« 10 000 », « 10 000 € », « dix mille »).

**PB-22 · Doute sur le marché.** Un doute sur la viabilité du marché ou du métier (« l'IA va remplacer les profs ») dit avant la présentation est un **blocage** (il empêche d'atteindre B) ; dit après le début de la présentation, c'est une résistance (compétence Objections).

**PB-23 · Reformuler pour vérifier la compréhension.** Quand le prospect reformule ce que le commercial vient d'expliquer **en réponse à une question de compréhension** (« alors, qu'est-ce que ça voudrait dire pour toi ? »), la reformulation n'est une adhésion que si elle ajoute un élément sur la situation propre du prospect (son projet, une date, un nombre) ; un simple écho des mots du commercial relève de X7.

**PB-24 · Projection utilisée pour repousser.** Une projection concrète utilisée pour justifier un délai (« je préférerais commencer en janvier, une fois les examens passés ») n'est pas une adhésion : elle est étiquetée `reserve` (réserve) et envoyée à la compétence Objections (inertie ou échéance).

**PB-25 · Questions fermées d'adéquation et échelles.** Une question fermée sur l'adéquation (« c'est ce que tu cherchais ? ») est au plus un point de contrôle de niveau 1. Une échelle de 1 à 10 prévue au script ne compte comme point de contrôle que si la réponse du prospect contient plus que le nombre.

**PB-26 · Tours fusionnés.** Quand un tour du prospect contient la question du commercial (fusion de la diarisation), la partie question est rendue au commercial avant de calculer les points de contrôle et le geste avant l'adhésion (PB-16) ; si le point de coupure ne peut pas être trouvé, le tour est `attribution_doubtful` (attribution douteuse) et exclu.


## A5c. L'escalier et la porte de conformité (version 2.0)

**PB-27 · Catégorie de P.** Le modèle classe le P validé (la citation exacte du prospect) dans une des neuf catégories, en se demandant de quoi le prospect doute. Tests de frontière, dans cet ordre :
1. Le doute porte sur **sa capacité à faire le métier lui-même** (« est-ce que j'en suis vraiment capable ? », « je ne suis pas assez bon ») → **Compétence** (`Skill`).
2. Le doute porte sur **le fait d'être choisi sans expérience ni diplôme** (« qui va me prendre ? », « je n'ai rien à montrer », « je n'ai pas de diplôme ») → **Légitimité** (`Legitimacy`).
3. **Combien faire payer** → **Tarification** (`Pricing`). **D'où viennent les clients** (marketing, visibilité, contacts, « trouver les clients ») → **Acquisition** (`Acquisition`). **Transformer une conversation en client** (appels de vente, propositions, conclure une vente) → **Vente** (`Selling`). **Mener un projet de bout en bout** (méthode, contrats, fournisseurs, gestion du client) → **Réalisation** (`Delivery`).
4. **Les heures disponibles** → **Temps** (`Time`). **Une formation ou une tentative précédente qui n'a rien donné** → **Échec passé** (`Past failure`). **Le risque que l'investissement ne rapporte pas** (« et si ça ne marche pas ? ») → **Risque financier** (`Financial risk`).
Le manque d'argent pour payer le programme n'est pas un blocage de la présentation : c'est un fait du circuit de décision ou une objection (compétence Objections). Un P qui n'entre dans aucune des neuf (par exemple une peur, le fait de trop réfléchir, « ne pas le voir comme un besoin ») est `P_category_unknown` et va à l'arbitre comme `uncovered_case`. Quand un P entre dans deux catégories, c'est la catégorie des mots employés par le prospect qui l'emporte (« je ne sais pas comment trouver des clients » → Acquisition, même si le commercial y entend un problème de vente).

**PB-28 · Étape 1.** Le premier passage du commercial, après le début de la présentation, qui énonce ce qui bloque le prospect, introduit ou non par « ce qui te bloque aujourd'hui, c'est… ». Il est mot pour mot s'il contient l'expression clé du P validé (annexe A de l'écart, GB-22). Il se termine à la première phrase qui énonce un principe, une composante de l'offre ou une phase. Si le blocage n'est reformulé que dans la restitution de l'écart et pas après le début de la présentation, l'étape 1 manque.

**PB-29 · Étape 2.** Le passage du commercial qui suit l'étape 1 et énonce un principe (« ce qui fait céder ça, c'est… ») et une phase de l'offre. Le modèle rattache chaque principe ou phase énoncé avant la feuille de route à un des neuf mécanismes de la référence (`mechanisms_stated`). Il faut exactement un mécanisme, égal à `P_category`. **Second mécanisme :** un principe ou une phase rattaché à un autre mécanisme, n'importe où entre l'étape 1 et la feuille de route. **Récitation :** un passage qui énumère trois composantes, modules ou livrables de l'offre ou plus, sans les relier au principe (seuil à valider). **Principe en une phrase :** le principe tient dans une phrase de 25 mots au plus (à valider).

**PB-30 · Étape 3.** Le passage du commercial qui dit d'où part le prospect et où il arrive. A et B doivent être le A et le B choisis dans le résultat de l'écart (GB-28, GB-29), avec ses chiffres (GB-24) et son unité. Une date ou une durée énoncée par le commercial ne compte comme son échéance que si le prospect l'a donnée (une citation existe) ; sinon c'est une date inventée. L'**image de sa vie** est une scène concrète énoncée après B (où il est, ce qu'il fait, avec qui) ; elle est avec ses mots si elle contient une expression clé tirée de ses réponses aux sollicitations N ou de ses atomes VALUE (écart GB-22).

**PB-31 · Étape 4.** Un passage qui raconte l'histoire d'un client nommé ou décrit qui a suivi l'offre. Contrôles du code : le cas est trouvé dans la bibliothèque de cas (par identifiant, par nom ou par correspondance de ses chiffres) ; son consentement est enregistré ; son **point de départ** correspond au A du prospect : même dimension (unité de A) et valeur de départ dans le facteur à valider, ou même étiquette de profil de départ (par exemple « emploi à temps plein, zéro client »). Un cas cité par le commercial qui n'est pas dans la bibliothèque est `out_of_gap_claim` (PB-35). Plusieurs cas à l'étape 4 : celui qui correspond le mieux est noté, les autres sont notés au journal.

**PB-32 · Ordre.** Chaque étape est placée au tour de sa première phrase. L'ordre est respecté si étape 1 < étape 2 < étape 3 < étape 4 < début de la feuille de route < premier prix < demande de décision. Une étape répétée plus tard (par exemple l'étape 1 redite avant le prix) ne casse pas l'ordre ; la première occurrence compte.

**PB-33 · Phrases.** Le code découpe chaque étape en phrases (ponctuation de fin de la transcription, puis une coupure à « et » + sujet quand une phrase de la transcription dépasse 40 mots ; "and" dans les transcriptions anglaises). Une étape de plus de trois phrases échoue à la brièveté (K5).

**PB-34 · Feuille de route.** La feuille de route commence au premier passage du commercial, après l'étape 4, qui présente des étapes ou des paliers du parcours du prospect (« ta feuille de route », « la première étape pour toi, c'est… », le plan d'une page partagé). Ses étapes sont rattachées à ses blocages (écart GB-32) par l'expression clé. Elle doit venir avant le premier prix.

**PB-35 · Affirmations hors de son écart ou de l'offre.** Une affirmation est un chiffre, un cas client, un prix ou une garantie énoncé par le commercial entre le début de la présentation et la demande de décision. Elle est permise si on la trouve dans : les citations du prospect (son écart, ses chiffres) ; la référence de l'offre (prix, modes de paiement, garantie, composantes) ; la bibliothèque de cas (les cas et leurs chiffres) ; ou un calcul sur ces chiffres présenté comme tel (« à 1 000 par projet et 3 projets par mois… », avec son prix par projet). Tout le reste est `out_of_gap_claim` : un résultat moyen des élèves, un chiffre du marché, une garantie qui n'est pas dans l'offre, un cas qui n'est pas dans la bibliothèque. Le modèle liste chaque affirmation avec sa citation ; le code cherche chacune.

**PB-36 · Promesse de résultat.** Une phrase du commercial dont le sujet est l'Académie, l'équipe ou « nous » (« on »), et dont l'action est de faire tourner son activité, de lui trouver ou de lui apporter des clients, de faire signer ses clients ou de conclure ses ventes, ou de réaliser ses projets (« on va te trouver tes élèves », « c'est nous qui les faisons signer pour toi », « notre équipe donne les cours à ta place »). Pas une promesse : l'Académie qui fournit des méthodes, des retours, de l'accompagnement, des modèles, des relectures (« on te donne la méthode pour trouver des élèves », « on relit chaque proposition que tu envoies »). Les formes conditionnelles ou hypothétiques sont des promesses si le sujet et l'action sont ceux ci-dessus.

**PB-37 · Présentation avant le oui.** Le début de la présentation (PB-1, PB-17) vient avant le tour de validation de la restitution qui a franchi la porte de l'écart, ou le verdict de l'écart est « absent ». Une `offer_mention` avant la validation n'est pas une présentation et ne déclenche pas cette règle.

## A6. Règles d'exclusion (résumé)

| # | Ne compte jamais comme… | Cas |
|---|---|---|
| X1 | un début de présentation | Une réponse courte à une question directe du prospect, suivie d'un retour à la découverte (PB-2) |
| X2 | un prix | Revenu d'un élève, prix par projet, budget de publicité, abonnement à un logiciel, montant dit par le prospect |
| X3 | une donnée d'entrée | Un blocage ou un critère énoncé après le début de la présentation ; un budget énoncé comme critère |
| X4 | un lien | Personnalisation générique, prénom cité sans plus, un mot repris sans lien (PB-9) |
| X5 | un point de contrôle | « Ça te parle ? » et la liste de PB-12 |
| X6 | une adhésion | Approbations, compliments, questions de logistique ou de prix sans projection (PB-15) |
| X7 | une adhésion | Un contenu énoncé d'abord par le commercial et approuvé |
| X8 | une présentation conforme | Une présentation commencée avant la validation de l'écart (`pitch_before_gap`, PB-37), une affirmation hors de son écart ou de l'offre (PB-35), une promesse de résultat (PB-36) : note 0 |
| X9 | l'étape 1 | Une paraphrase du blocage avec le vocabulaire du commercial (PB-28) |
| X10 | l'étape 2 | Un second mécanisme ; une récitation du contenu de l'offre (PB-29) |
| X11 | l'étape 3 | Une unité qui n'est pas celle du prospect ; une échéance qu'il n'a jamais donnée (PB-30) |
| X12 | l'étape 4 | Un cas qui n'est pas dans la bibliothèque ; un cas sans consentement ; un cas inventé (c'est aussi `out_of_gap_claim`) (PB-31) |
| X13 | la feuille de route | Une feuille de route montrée après le prix, ou dont les étapes ne sont pas les blocages qu'il a nommés (PB-34) |

## A7. Paires minimales

Les passages sont donnés en français, avec entre parenthèses la phrase anglaise du test unitaire correspondant quand la forme exacte compte.

| # | Passage | Verdict | Pourquoi |
|---|---|---|---|
| 1a | Prospect : « Et c'est quoi exactement ? » Commercial : « C'est un accompagnement de six mois, je te montre tout ça dans un instant. Et ça fait combien de temps que tu fais ça ? » | `offer_mention` | Réponse courte, retour à la découverte (PB-2) |
| 1b | Commercial : « Alors, comment ça marche : c'est un accompagnement de six mois, on commence par tes bases, puis la tarification, puis les clients… » | Début de la présentation | Description de l'offre, 3 éléments ou plus |
| 2a | « Nos élèves facturent 800 à 1 000 par projet. » ("Our students charge 800 to 1,000 per room.") | Pas un prix | Prix par projet (X2) |
| 2b | « L'investissement est de 5 800, ou six paiements de 1 097. » | Premier prix | Montant pour l'offre |
| 3a | « Tu as dit que tu ne sais jamais combien facturer : le module 3 porte entièrement sur la tarification. » | Lien | Discours rapporté + mot repris |
| 3b | « Le module 3 porte entièrement sur la tarification, beaucoup de gens ont du mal avec ça. » | Générique | Aucun renvoi au prospect (PB-9) |
| 4a | « Lequel de ces trois te paraît le plus loin pour toi ? » → « Le côté business, je n'ai jamais fixé un prix de ma vie. » | Point de contrôle avec réponse de contenu | PB-11, PB-13 |
| 4b | « Ça te parle ? » → « Oui. » ("Does that make sense?" → "Yes.") | Pas un point de contrôle | PB-12 |
| 5a | « Donc j'aurais quelqu'un qui regarde mon travail chaque semaine, c'est ce qu'il me faut. » | Adhésion (appropriation) | PB-14 |
| 5b | « Ça a l'air génial. » ("That sounds amazing.") | Pas une adhésion | PB-15 |
| 6a | « Si je commence en novembre, je pourrais avoir des élèves d'ici le printemps. » | Adhésion (projection) | Date concrète |
| 6b | « Ça commence quand ? » | `buying_signal` | Logistique sans projection |
| 7a | Prospect, avant la présentation : « Ce qui compte, c'est de ne pas être lâché tout seul après. » | Critère (donnée d'entrée) | Avant la présentation, sur la nature de l'offre |
| 7b | Prospect, après le partage d'écran : « Il faudrait que je ne sois pas lâché tout seul. » | Pas une donnée d'entrée | Après le début de la présentation (PB-10) ; une réaction |
| 8a | P validé : « Je ne sais pas d'où viendront les clients. » Commercial : « Ce qui te bloque aujourd'hui, c'est que tu ne sais pas d'où viendront les clients. » | Étape 1 mot pour mot | PB-28 |
| 8b | Même P. Commercial : « Donc le problème, c'est ta génération de contacts. » | Étape 1 paraphrasée | X9 |
| 9a | Catégorie de P Acquisition ; l'étape 2 énonce le principe de l'Acquisition et sa phase | Un seul mécanisme | PB-29 |
| 9b | Même chose, puis « et le module 4, c'est la tarification, le module 5 les contrats, le module 6 la communauté » | Récitation | X10 |
| 10a | A « 2K par mois », B « 10K par mois ». Commercial : « de 2K par mois à 10K par mois » | Même unité | PB-30 |
| 10b | Même chose. Commercial : « de là où tu es à six chiffres d'ici l'été prochain » | Autre unité et date inventée | X11 |
| 11a | « Quelqu'un qui est parti exactement de là où tu es, avec un emploi à temps plein et aucun client… » (cas dans la bibliothèque, même profil) | Preuve correspondante | PB-31 |
| 11b | « Une de nos élèves a atteint 40K dès son troisième mois » (pas dans la bibliothèque) | `out_of_gap_claim` | PB-35, X12 |
| 12a | « On te donne la méthode et on relit chaque appel que tu fais. » | Permis | PB-36 |
| 12b | « On va te trouver les élèves, toi tu donnes juste les cours. » ("We'll find the clients, you just do the design.") | `outcome_promise` | PB-36, X8 |
| 13a | Validation « Exactement. » au T150, partage d'écran et description de l'offre au T152 | Présentation après le oui | PB-37 |
| 13b | Partage d'écran et description de l'offre au T140, restitution validée au T150 | `pitch_before_gap` | PB-37, X8 |

## A8. Fiabilité de la détection pour la présentation

| Mesure | Seuil |
|---|---|
| Début de la présentation : même tour que le jeu de référence (± 2 tours) | ≥ 95 % des appels |
| Premier prix : même tour | ≥ 98 % des appels |
| Rappel et précision des liens sur les segments de référence | ≥ 90 % et ≥ 85 % |
| Adhésion : accord sur la présence par passage | κ ≥ 0,80 |
| Point de contrôle : accord par sollicitation | κ ≥ 0,80 |
| Catégorie de P | κ ≥ 0,80 sur les neuf catégories |
| Étapes 1 à 4 : même plage ± 1 tour | ≥ 90 % par étape |
| Mécanismes énoncés : même ensemble par présentation | ≥ 90 % |
| Affirmations : rappel des affirmations hors de l'écart sur le jeu de référence | ≥ 95 % |
| Promesses de résultat : rappel | ≥ 95 % |

D'ici là, la note de présentation est marquée « provisoire ». La version 2.0 ajoute : un P classé dans la mauvaise catégorie (PB-27) ; un second mécanisme manqué parce qu'il est dit en passant (PB-29) ; un résultat d'élève pris pour un cas de la bibliothèque (PB-35). Confusions les plus probables : une mention de l'offre prise pour un début de présentation (PB-2) ; un revenu d'élève pris pour un prix (X2) ; un compliment pris pour une adhésion (PB-15) ; une personnalisation générique prise pour un lien (PB-9).

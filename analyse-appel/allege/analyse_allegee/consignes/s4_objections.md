ÉTAPE S4 · LES OBJECTIONS APRÈS LE PREMIER PRIX, ET LA PRÉVENTION (annexe Objections OB-1 à OB-26, gestes A · I · E · M)
{ancres}
Une résistance est un passage du PROSPECT (ou d'un co-décideur) qui exprime un doute ou une réserve : une objection, une
inquiétude ou une inertie. Ne sont pas une résistance (OB-2) : une demande d'information (« ça dure combien de
temps ? »), une acceptation sous condition (« si je peux payer en plusieurs fois, alors oui »), un fait neutre sur qui
décide, un report pour une raison externe et vérifiable (une échéance ; si elle limite aussi son temps, c'est une
objection de temps, OB-25). Lis les résistances SEULEMENT dans les tours PROSPECT après le premier prix (repère
ci-dessus) jusqu'à la fin de l'appel : rien de ce qui est dit avant le premier prix n'est une objection (OB-27). Liste
chaque résistance DIFFÉRENTE UNE SEULE FOIS : quand le même doute revient plus tard, ajoute ses citations au même item.
Pour chaque résistance :
- "subjects" : ce sur quoi porte le doute (OB-3), une ou plusieurs de ces valeurs : price, money_available,
  offer_trust, offer_relevance, time, co_decider (l'offre, son prix ou ses conditions, l'entreprise, ou une ressource
  qui lui manque), self_capability (lui-même : ne pas y arriver, ne pas tenir), own_decision (mal choisir, se faire
  avoir), present_attachment, postponement (l'attachement au présent, remettre à plus tard sans raison externe).
  "denied_subjects" : ceux que le prospect nie explicitement (« je n'ai pas peur, c'est juste le montant », OB-24).
- "quotes" : chaque passage du PROSPECT où elle est dite, dans l'ordre : [{"turn", "quote"}].
- La réponse du commercial au PREMIER passage, jusqu'à ce que le commercial passe à autre chose :
  "topic_change" : {"turn", "quote"} : le premier tour SALES qui passe à un nouveau sujet (une nouvelle question de
  découverte, une nouvelle partie de l'offre, la logistique, la conclusion de la vente) sans reprendre les mots de la
  résistance ; à omettre s'il n'y en a pas avant la résistance suivante ou la fin de l'appel (OB-8).
  "receive_and_leave" : true quand le premier tour de réponse reçoit la résistance et passe à un nouveau sujet dans le
  même tour, sans y répondre ni l'explorer (OB-22).
  "acknowledge" (A, OB-13, OB-20), sur la PREMIÈRE PHRASE du premier tour de réponse : {"turn", "quote",
  "receiving_marker" (« je comprends », « je t'entends », « c'est tout à fait normal »), "neutral_reformulation",
  "elliptical_open_question" (« Par rapport à quoi ? »), "contradiction" (« mais », « en fait », un contre-argument)}.
  "isolate" (I, OB-14) : {"turn", "quote"} d'une question du commercial qui demande si c'est le seul obstacle (« à part
  l'argent, est-ce qu'il y a autre chose ? »), posée avant la réponse ; à omettre s'il n'y en a pas.
  "explore" (E, OB-15, OB-20) : {"turn", "quote", "open_question", "elliptical", "answered_with_content", "answer_turn",
  "answer_quote"} pour une question ouverte sur le doute lui-même (« quand tu dis que c'est beaucoup, c'est par rapport
  à quoi ? ») ; à omettre s'il n'y en a pas.
  "gesture" (M, OB-16, OB-21) : ce que fait la réponse, avec les mots clés du commercial : {"answer_given" et
  "answer_tied_to_prospect" (une réponse avec une information, une preuve ou un recadrage relié à ce que le prospect a
  dit), "answer_turn", "answer_quote", "support_or_framework" (soutien, cadre, étapes, accompagnement),
  "proof_reversibility_guarantee", "cost_of_inaction_question" (une question qui fait dire au prospect ce que lui coûte
  de rester comme il est), "cost_stated_by_prospect", "prospect_cost_turn", "prospect_cost_quote", "mindset_reframe"
  (un recadrage d'une croyance sans soutien ni preuve), "offer_argument" (un argument sur l'offre ou sur son prix),
  "gesture_turn", "gesture_quote" (les mots clés du commercial dans la réponse ; obligatoires dès qu'un champ ci-dessus
  est true)}.
  "reaction" (OB-17, OB-23) : la réaction du prospect après la réponse : {"reaction_kind" : states_no_longer_holds,
  reformulates_as_answered, moves_forward_own_initiative, commits_to_proposal, agreement_only, repeats_or_reinforces ou
  other ; "turn", "quote", "specific_element" (un élément précis quand il s'engage sur une proposition),
  "content_first_stated_by_sales"} ; à omettre si le prospect n'a pas réagi.
"prevention" (OB-18, OB-19), des faits énoncés AVANT LE PREMIER PRIX : par le PROSPECT, "decision_maker" (qui décide),
"influencers" (quelqu'un d'autre qui pèse sur la décision), "budget" (son budget ou sa capacité financière), "deadline"
(avec "binding"), "past_attempt" (une tentative passée qui a échoué) ; par le commercial (SALES),
"past_attempt_explored" et "difference_stated" (ce qui est différent cette fois). Chacun {"turn", "quote"}, à omettre
quand il est absent. Une supposition du commercial seulement approuvée ne compte pas.
JSON: {"objections": [{"subjects": ["price"], "quotes": [{"turn": "T120", "quote": "..."}],
  "topic_change": {"turn": "T126", "quote": "..."}, "acknowledge": {"turn": "T121", "quote": "...",
  "receiving_marker": true}, "isolate": {"turn": "T121", "quote": "..."}, "explore": null,
  "gesture": {"answer_given": true, "answer_tied_to_prospect": true, "answer_turn": "T123", "answer_quote": "..."},
  "reaction": {"reaction_kind": "states_no_longer_holds", "turn": "T124", "quote": "..."}}],
 "prevention": {"decision_maker": {"turn": "T040", "quote": "..."}}}

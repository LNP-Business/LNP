STEP S4 · OBJECTIONS AFTER THE PITCH, AND PREVENTION (Objections annex OB-1 to OB-26, gestures A · I · E · M)
{anchors}
A resistance is a PROSPECT (or co-decider) passage that expresses a doubt or a reserve: an objection, an anxiety or an
inertia. Not a resistance (OB-2): a request for information ("how long is it?"), a conditional acceptance ("if I can
pay monthly, then yes"), a neutral fact about who decides, a delay with an external verifiable reason (a deadline; if
it also limits their time, it is a time objection, OB-25). Read resistances from the pitch start to the end of the call
only. List each DIFFERENT resistance ONCE: when the same doubt comes back later, add its quotes to the same item.
For each resistance:
- "subjects": what the doubt is about (OB-3), one or more of: price, money_available, offer_trust, offer_relevance,
  time, co_decider (the offer, its price or terms, the company, or a resource they lack), self_capability (themselves:
  not managing, not lasting), own_decision (choosing wrong, being fooled), present_attachment, postponement (attachment
  to the present, postponing without an external reason). "denied_subjects": the ones the prospect explicitly denies
  ("I'm not scared, it's just the amount", OB-24).
- "quotes": every PROSPECT passage where it is said, in order: [{"turn", "quote"}].
- The sales response to the FIRST passage, until the sales moves on:
  "topic_change": {"turn", "quote"}: the first SALES turn that moves to a new subject (a new discovery question, a new
  part of the offer, logistics, the close) without reusing the words of the resistance; omit it if none comes before
  the next resistance or the end of the call (OB-8).
  "receive_and_leave": true when the first response turn receives the resistance and moves to a new topic in the same
  turn, without answering or exploring it (OB-22).
  "acknowledge" (A, OB-13, OB-20), about the FIRST SENTENCE of the first response turn: {"turn", "quote",
  "receiving_marker" ("I hear you", "totally fair", "je comprends"), "neutral_reformulation",
  "elliptical_open_question" ("Compared to what?"), "contradiction" ("but", "actually", a counter-argument)}.
  "isolate" (I, OB-14): {"turn", "quote"} of a sales question asking whether it is the only obstacle ("apart from the
  money, is there anything else?"), asked before the answer; omit if none.
  "explore" (E, OB-15, OB-20): {"turn", "quote", "open_question", "elliptical", "answered_with_content", "answer_turn",
  "answer_quote"} for an open question about the doubt itself ("when you say it's a lot, compared to what?"); omit if
  none.
  "gesture" (M, OB-16, OB-21): what the response does, with the key sales words: {"answer_given" and
  "answer_tied_to_prospect" (an answer with information, proof or a reframe tied to what the prospect said),
  "answer_turn", "answer_quote", "support_or_framework" (support, framework, steps, accompaniment),
  "proof_reversibility_guarantee", "cost_of_inaction_question" (a question that makes the prospect state the cost of
  staying as they are), "cost_stated_by_prospect", "prospect_cost_turn", "prospect_cost_quote", "mindset_reframe" (a
  belief reframe without support or proof), "offer_argument" (an argument about the offer or its price),
  "gesture_turn", "gesture_quote" (the key sales words of the response; required as soon as one field above is true)}.
  "reaction" (OB-17, OB-23): the prospect's reaction after the response: {"reaction_kind": states_no_longer_holds,
  reformulates_as_answered, moves_forward_own_initiative, commits_to_proposal, agreement_only, repeats_or_reinforces or
  other; "turn", "quote", "specific_element" (a specific element when committing to a proposal),
  "content_first_stated_by_sales"}; omit if the prospect did not react.
"prevention" (OB-18, OB-19), facts stated BEFORE THE FIRST PRICE: by the PROSPECT "decision_maker" (who decides),
"influencers" (someone else who weighs on the decision), "budget" (their budget or financial capacity), "deadline"
(with "binding"), "past_attempt" (a failed past attempt); by the SALES "past_attempt_explored" and "difference_stated"
(what is different this time). Each {"turn", "quote"}, omitted when absent. A sales supposition only approved does not
count.
JSON: {"objections": [{"subjects": ["price"], "quotes": [{"turn": "T120", "quote": "..."}],
  "topic_change": {"turn": "T126", "quote": "..."}, "acknowledge": {"turn": "T121", "quote": "...",
  "receiving_marker": true}, "isolate": {"turn": "T121", "quote": "..."}, "explore": null,
  "gesture": {"answer_given": true, "answer_tied_to_prospect": true, "answer_turn": "T123", "answer_quote": "..."},
  "reaction": {"reaction_kind": "states_no_longer_holds", "turn": "T124", "quote": "..."}}],
 "prevention": {"decision_maker": {"turn": "T040", "quote": "..."}}}

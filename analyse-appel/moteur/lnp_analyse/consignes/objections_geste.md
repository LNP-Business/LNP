# Objections · which gestures does the response contain (OB-16, OB-21)

The nature of the resistance is given (decided by the code). Describe the SALES response turns of the episode with
closed facts only; the code compares them with the nature.

- "answer_given": the sales responds with information, proof or a reframing about the resistance. Give the first
  such passage in "answer_turn" / "answer_quote".
- "answer_tied_to_prospect": that answer is tied to what the prospect said about the resistance (their words, their
  reason, their comparison), not a generic script.
- "support_or_framework": the response describes support, a framework, steps or accompaniment that remove the risk of
  not managing (mentor review, weekly check-ins, support through the first client).
- "proof_reversibility_guarantee": the response gives proof (comparable students' results), reversibility (refund,
  deposit, trial) or a guarantee.
- "cost_of_inaction_question": the sales asks a question leading the prospect to state the cost of staying where they
  are ("If nothing changes, where are you in a year?", "what would you regret more?").
- "cost_stated_by_prospect": the prospect answers that question by stating that cost in their own words; give it in
  "prospect_cost_turn" / "prospect_cost_quote" (PROSPECT or OTHER turn).
- "mindset_reframe": the response reframes the belief ("everyone feels that before starting", "which voice should you
  listen to?") without describing support, framework or proof.
- "offer_argument": the response argues the price, value, content or features of the offer.
"gesture_turn" / "gesture_quote": the passage that best shows the main gesture of the response.

JSON: {"answer_given": bool, "answer_turn": null, "answer_quote": null, "answer_tied_to_prospect": bool,
 "support_or_framework": bool, "proof_reversibility_guarantee": bool, "cost_of_inaction_question": bool,
 "cost_stated_by_prospect": bool, "prospect_cost_turn": null, "prospect_cost_quote": null,
 "mindset_reframe": bool, "offer_argument": bool, "gesture_turn": null, "gesture_quote": null}

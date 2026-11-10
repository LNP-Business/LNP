Rules: Gap annex GB-8 to GB-10, GB-15, GB-16, GB-17, GB-26 (validation of a restitution).
Read the VALIDATION TURN only as the prospect's response to the restitution.
- `outcome`:
  - confirmed_with_content: agrees and adds something of their own (a precision, a number, an emotion, a new
    element, a reformulation in their own words).
  - confirmed: agrees without new content ("Yeah, exactly.", "That's right.", "100 %", "pretty much", "more or
    less"). "No", "No, that's it" to "Did I miss anything?" / "Anything I got wrong?" is confirmed.
  - corrected: corrects one or more components ("Not quite, it's more like 3K"), including agreement with a
    qualifier followed by a correction ("99 %, except it's more like 3K").
  - rejected: disagrees with the restitution as a whole.
  - none: the turn answers another question, or does not respond to the restitution.
- `agreement_quote`: the exact words of the validation turn that agree (one word is allowed: "Yes.").
- `content_quote`: for confirmed_with_content, the exact words of the added content.
- `content_is_repetition`: true if that content only repeats the words the sales used in the restitution.
- `corrected_components` (PROBLEM, COST, A, B) and `correction_quote`: for corrected, the exact correcting words.
- `emotional_reaction`: the prospect reacts emotionally to the restitution ("Why do you have to go saying that?",
  "that hurts to hear"); `disagreement`: they explicitly disagree with its content.
- `answers_other_question`: true if the turn answers a question asked at the end of the restitution on another
  topic, or the sales' next question merged into the turn.
- `addressed_co_decider`: true if the turn is spoken by a co-decider (OTHER) whom the restitution addressed.

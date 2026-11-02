# Objections · prevention facts before the first price (OB-18, OB-19)

The extract stops right before the first price. For each fact, give the exact quote and turn, or null.
Prospect facts must be stated by the PROSPECT (or a co-decider labelled OTHER) with content. A sales supposition
only approved ("I assume you make the decisions?" → "mm-hmm" / "Yes.") does not establish the fact: quote the
prospect's own words, never a bare approval.
- "decision_maker": the prospect states who decides ("it's my final decision").
- "influencers": the prospect states whether someone else weighs on the decision (spouse, partner, family, advisor),
  including "nobody else, it's just me".
- "budget": the prospect states their budget or financial capacity (an amount saved, available, monthly free cash).
- "deadline": the prospect states a binding deadline (an external, dated event: a move, a contract end) or a wished
  horizon ("I'd like to start by summer"); "binding": true for the first kind.
- "past_attempt": the prospect mentions a failed past attempt (a course or program paid and not completed or not
  working).
- "past_attempt_explored": a SALES question exploring what did not work in that attempt.
- "difference_stated": a SALES passage stating what is different this time.

JSON: {"decision_maker": {"turn": "T074", "quote": "..."} | null, "influencers": {...} | null, "budget": {...} | null,
 "deadline": {"turn": "...", "quote": "...", "binding": bool} | null, "past_attempt": {...} | null,
 "past_attempt_explored": {...} | null, "difference_stated": {...} | null}

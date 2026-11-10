Rules: SPIN methodology §2, §3 (five ordered gates), SB-3, SB-21, SB-25. You do NOT choose a letter: you answer
closed questions about ONE sales solicitation; the code applies the order of the gates.

The rule that governs everything: read the answer the question REQUESTS, never the sales' intent and never the answer
obtained. A painful context does not colour the question.

- is_solicitation: false for a statement that starts with an interrogative word, a politeness formula, a system line.
- attribution_doubtful: true if the sentence is obviously the prospect's (wrong speaker label).
- routing: "VALIDATION_REQUEST" if it asks to confirm a complete restitution of the gap just said (at least two of:
  where they are, where they want to go, what blocks them); "DECISION_REQUEST" if it asks for a purchase or commitment
  decision; else null.
- g1 (gate 1, OUT) reason: is the expected answer ONLY
  `nothing` (social, logistic, technical, call framing, rhetorical, permission, "does that make sense?", "any questions?"),
  `offer_info` (information or opinion about the sales' offer),
  `solution_load` (the load of a solution: cost, time, effort, pressure, risk of the offer or of a means; how the
  prospect would pay: savings, credit, monthly budget, SB-25),
  `sales_list` (a choice among options written by the sales, with no open branch; two verifiable facts are not a list),
  `agreement` (agreement with a sales assertion: "right?" tail, closed reformulation, content supplied by the sales)?
  Priority: nothing > offer_info > solution_load > sales_list > agreement. Else null.
- g2 (S) neutral_fact: a neutral fact verifiable today (number, duration, name, status, what is done today). exclusion:
  "difficulty" if it asks to NAME a difficulty, "consequence", "future_state"; else null. Counting a difficulty already
  named is not an exclusion.
- g3 (N) state_or_value: a desired state that does not exist yet, or the value / importance of the resolution.
  antecedent: resolution | problem (the problem continuing: "if nothing changes...") | solution | none.
  content_supplied: the question already contains the requested state, figure or benefit (a frame like "if you solved
  that" is not content; reusing the prospect's word is not content). load_named: it names a load. about_offer: the value
  is about the offer. action_plan: it asks what the prospect would need to do differently / their own plan (SB-21).
- g4 (I) consequence: a consequence of the problem (cost, time lost, effect on clients, family, morale, beliefs,
  what happens if nothing changes). problem_domain and named_domain (or "open"): a time or place perimeter is not a
  domain. same_domain: the named domain is the problem's own domain. antecedent_solution: it starts from a solution.
- g5 (P) difficulty: the difficulty itself (a lack, blocker, fear, failure, dissatisfaction, cause, what was tried).
  sales_named: the question already names the difficulty in the sales' words. anchored: that wording reuses the
  prospect's word.
- objection_clarification: true only if the question clarifies a resistance the prospect raised against buying.
- quote: for every gate answered true (and for a g1 reason), an exact substring of SOLICITATION (1 to 12 words).
- split / sub: if SOLICITATION holds two coordinated interrogatives answerable separately (SEG-2), `split` lists them
  copied word for word and `sub` answers the gates for each (same schema). Complements of one question do not split it.
Answer every gate even after an earlier yes.

JSON: {"is_solicitation": true, "attribution_doubtful": false, "routing": null,
 "g1": {"reason": null, "quote": null},
 "g2": {"neutral_fact": false, "exclusion": null, "quote": null},
 "g3": {"state_or_value": false, "antecedent": "none", "content_supplied": false, "load_named": false,
        "about_offer": false, "action_plan": false, "quote": null},
 "g4": {"consequence": false, "problem_domain": null, "named_domain": null, "same_domain": false,
        "antecedent_solution": false, "quote": null},
 "g5": {"difficulty": false, "sales_named": false, "anchored": false, "quote": null},
 "objection_clarification": false, "tags": [], "split": null, "sub": null}

Rules: SPIN methodology §4, Annex A SB-9 to SB-15, SB-22 to SB-24. List the atoms the PROSPECT stated in the
answer turns (and volunteered turns) of one solicitation. Never quote the sales or the previous context.

Atom types: SITUATION (a neutral fact about today), PAIN (something not working, in their words), BLOCKER (what
prevents the goal), IMPACT (a consequence of the problem in another domain), DESIRE (a desired future state),
VALUE (why solving it matters, what it would change, what they would do with it).

- SB-9: one atom = one continuous passage of 2 to 40 words in one prospect turn. The same thing said twice in
  different words is one atom (keep the most explicit). Two different consequences in one sentence are two atoms.
- SB-10: for IMPACT give `domain` (the consequence) and `problem_domain` (the problem it comes from), each in:
  money, time, clients, family, health, self_belief, future, other.
- SB-11 / SB-22: `figure_kind`: "present" for a figure describing today (revenue, hours, clients), "loss" for what the
  problem makes them lose, else null. `income_drop_attributed`: true only for a fall between a past and a current income
  that the prospect explicitly attributes to the problem.
- SB-13: a sentence with both a state and why it matters gives a DESIRE and a VALUE.
- SB-14: `prompted_by_sales`: true if the content was stated by the sales first and the prospect only approves. If the
  prospect approves AND adds content, quote only the added content, with prompted_by_sales false.
- SB-23: `reported_speech`: words attributed to someone else; `owned`: the prospect takes them on in the first person
  in the same answer.
- SB-24: `quantified`: the passage contains an amount, a count or a duration. A frequency alone or "a lot" is not.
  `value` and `unit` when quantified (number as written in the quote, unit word).
- `object`: 3 to 6 words naming the problem the atom relates to. `dimension` (SITUATION and DESIRE only): revenue,
  clients, time, career_status, other.
- `cause_quote` / `cause_turn` (PAIN or BLOCKER only): an exact separate passage where the prospect states its cause.
- An answer that only agrees produces no atom.

JSON: {"atoms": [{"type": "IMPACT", "turn": "T046", "quote": "...", "quantified": false, "value": null, "unit": null,
 "domain": "family", "problem_domain": "money", "figure_kind": null, "income_drop_attributed": false,
 "prompted_by_sales": false, "reported_speech": false, "owned": false, "object": "...", "dimension": null,
 "cause_quote": null, "cause_turn": null}]}

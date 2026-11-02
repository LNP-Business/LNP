Rules: Gap annex GB-1 to GB-7, GB-22, GB-23, GB-27, GB-31 (components of a restitution). You do not decide whether
the passage is a restitution, whether a component is verbatim or whether the gap is present: the code does.

The four components (each one only ever exists as the prospect's own words):
- PROBLEM: what is not working and keeps the prospect from reaching the desired state (a lack, a blocker, a fear,
  a past failure, a constraint).
- COST: what the problem costs the prospect, or what staying in the current situation costs (money, time, clients,
  family, health, self-belief, lost opportunity). A current income, a price or a budget is never a cost.
- A: where the prospect is today (current state, current figure).
- B: where the prospect wants to go (target, desired state).

For each clause of the SALES turns of the span that restates one component:
- `component`: PROBLEM, COST, A or B.
- `sales_turn`, `sales_quote`: the exact sales words of the clause (2 to 40 words, one SALES turn of the span).
- `about_prospect`: false if the clause is about another person (a former student, a testimonial, "most people",
  "a lot of people in your position") (GB-6). A comparison inside a clause about the prospect is ignored.
- `declarative`: true for a statement, or a statement followed by a validation tail ("..., right?"); false for a
  question.
- `source_turn`: the earlier PROSPECT turn whose statement the clause restates; if the prospect said it several
  times, cite the turn whose words the sales reuses (GB-27). `PRIOR<k>` for the k-th prior input (application
  form, earlier call). null if the prospect never said it (a cost or a problem introduced by the sales).
- `key_expression`: the words of the source turn that carry the component (for PROBLEM the obstacle, for COST the
  consequence or the amount, for A and B the state or the value), copied character for character from the SOURCE
  turn, and that the sales repeats. Never a generic phrase ("you want to", "a lot of things"). If the sales
  paraphrased, still copy the prospect's words from the source: the code will find that they are not repeated.
- `as_holding_back` (PROBLEM only): true if the clause presents this blocker as what holds the prospect back
  ("what's holding you back is...", "the biggest thing getting in the way", "what's missing for you").
- Ignore clauses placed after the first mention of the offer (program, mentorship, academy, "what we do",
  "how we help").
- `ends_with_new_topic_question`: true if the last sentence of the span is a question on a new topic (not a
  request to validate what was just said, such as "Did I get that right?", "Is that fair?", "Anything I missed?").
  Then give its exact words in `new_topic_question_quote`.

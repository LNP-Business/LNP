STEP S2 · THE GAP PLAYED BACK (Gap annex GB-1 to GB-29)
{anchors}
The four components only ever exist as the prospect's own words: PROBLEM (what is not working and keeps the prospect
from the goal: a lack, a blocker, a fear, a past failure, a constraint), COST (what the problem costs, or what staying
as they are costs: money, time, clients, family, health, self-belief, lost opportunity; never a current income, a
price or a budget), A (where the prospect is today), B (where they want to go). A consequence the prospect lives because
of the problem (depending on a parent, exhaustion, less time with the children, savings running out, feeling exploited)
is a COST, not a PROBLEM; the PROBLEM is what keeps them from the goal.

List every SALES passage, from the discovery start up to {limit}, that plays back what the prospect said: an opener
("so from what I'm hearing", "let me play that back", "if I understood correctly", "si je résume"), a long passage of
"you..." clauses carrying the prospect's words, or a passage ending with a request to validate it ("did I get that
right?", "is that fair?", "c'est bien ça ?"). One passage = consecutive sales turns separated only by short approvals
("yeah", "mm-hmm"); a prospect turn of 6 words or more ends it (GB-1, GB-2).
For each passage:
- "turns": the ids of its SALES turns.
- "clauses": every clause that restates one component: "component" (PROBLEM, COST, A or B); "sales_turn" and
  "sales_quote" (the exact sales words of the clause); "source_turn" (the earlier PROSPECT turn it restates, the one
  whose words the sales reuses; null when the prospect never said it); "key_expression" (the prospect's words that carry
  the component, copied character for character from the SOURCE turn, that the sales repeats: only the words the sales
  takes up (e.g. "10%", "dépendante"), not the prospect's whole sentence; never a generic phrase
  such as "you want to"; if the sales paraphrased, still copy the prospect's words: the code checks); "as_holding_back"
  (PROBLEM presented as what holds the prospect back); "other_person": true when the clause is about someone else (a
  former student, "most people", GB-6); "is_question": true when the clause is a question rather than a statement (a
  statement with a "..., right?" tail is a statement). Leave out clauses after the first mention of the offer
  (program, mentorship, academy, "what we do", "how we help").
- "ends_with_new_topic_question": the last sentence of the passage is a question on a new topic (not a request to
  validate what was said), with "new_topic_question_quote".
- "validation": the PROSPECT turn right after the passage, read only as the response to it (GB-8 to GB-10, GB-15 to
  GB-17, GB-26): "turn"; "outcome": confirmed_with_content (agrees and adds something of their own: a precision, a
  number, an emotion, a new element), confirmed (agrees without new content; "no, that's it" to "did I miss
  anything?"), corrected (corrects a component, also "99 %, except it's 3K"), rejected, or none (answers another
  question); "agreement_quote", "content_quote", "content_is_repetition" (the content only repeats the sales' words),
  "corrected_components", "correction_quote", "emotional_reaction", "disagreement", "answers_other_question",
  "addressed_co_decider". Omit "validation" only when a sales turn follows the passage.
Also list "deadlines": every date or duration the PROSPECT attaches to a target (where they want to be), before the
pitch, each with "turn", "quote", "horizon" (as said) and "binding" (true for an external, verifiable deadline, false
for a wish) (GB-29).

PROSPECT STATEMENTS FOUND IN THE DISCOVERY (component, turn, quote), for the source turns:
{statements}
JSON: {"passages": [{"turns": ["T081"], "clauses": [{"component": "PROBLEM", "sales_turn": "T081", "sales_quote": "...",
  "source_turn": "T052", "key_expression": "...", "as_holding_back": true}], "ends_with_new_topic_question": false,
  "validation": {"turn": "T082", "outcome": "confirmed", "agreement_quote": "..."}}],
 "deadlines": [{"turn": "T060", "quote": "...", "horizon": "...", "binding": false}]}

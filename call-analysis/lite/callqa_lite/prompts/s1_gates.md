STEP S1g · THE GATES OF EACH DISCOVERY QUESTION (SPIN §3; the code decides the letter)
Each unit below is ONE sales turn, read on its PRIORITY question (SEG-1); the other questions of the turn and the turns
around it are context only. For every unit, answer the closed questions about its PRIORITY question.

Rules: SPIN methodology §2, §3 (five ordered gates), SB-3, SB-21, SB-25. You do NOT choose a letter: you answer
closed questions about each PRIORITY question; the code applies the order of the gates.

The rule that governs everything: read the answer the question REQUESTS, never the sales' intent and never the answer
obtained. A painful context does not colour the question.

- is_solicitation: true for every sentence that asks the prospect for an answer, even a social, logistic or framing
  one ("vous m'entendez ?", "comment allez-vous ?": those are true, with g1 `nothing`). Every unit below was listed by
  the code because it has a question form, so false is rare: ONLY a sentence that asks for no answer at all (a
  statement that merely starts with an interrogative word, "comment dire…", "pourquoi pas"), or a recorder/system line.
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
- g2 (S) neutral_fact: a neutral fact verifiable today (number, duration, name, status, what is done today). An open
  question on the prospect's present situation is one: "tu vois les choses comment aujourd'hui ?", "tu es professeur de
  quoi ?", "ça fait longtemps ?", "par rapport à quoi, tu as une situation à côté ?", "tu fais comment aujourd'hui ?". exclusion:
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
- g5 (P) difficulty: the difficulty itself (a lack, blocker, fear, failure, dissatisfaction, cause, what was tried), also
  asked as a yes/no question: "qu'est-ce qui te bloque / t'a bloqué / t'empêche / te freine ?", "qu'est-ce qui ne va
  pas ?", "c'est quoi le plus dur ?", "tu es en difficulté avec ça ?", "tu es à l'aise avec le fait que ça dure ?",
  "qu'est-ce que tu as déjà essayé ?", "pourquoi ça n'a pas marché ?".
  sales_named: the question already names the difficulty in the sales' words. anchored: that wording reuses the
  prospect's word.
- objection_clarification: true only if the question clarifies a resistance the prospect raised against buying.
Read every gate even after an earlier yes. A discovery question almost always asks for a fact (g2), a desire (g3), a
consequence (g4), a difficulty (g5) or nothing to read (g1): before leaving every gate false, read the question
again; all false is for a question that asks none of these.

Answer for EVERY unit, with its "id" as listed, and write ONLY what is true: a gate at false, a null reason, a false flag
or a null domain is left out (the code reads what is left out as false or null, and is_solicitation as true). No quote:
the code holds the PRIORITY question. A unit with nothing true is {"id": "Q0xx"}.
Fields: is_solicitation, attribution_doubtful, routing; g1 {reason}; g2 {neutral_fact, exclusion};
g3 {state_or_value, antecedent, content_supplied, load_named, about_offer, action_plan};
g4 {consequence, problem_domain, named_domain, same_domain, antecedent_solution}; g5 {difficulty, sales_named, anchored};
objection_clarification.
JSON: {"units": [{"id": "Q030", "g2": {"neutral_fact": true}},
 {"id": "Q032", "g1": {"reason": "nothing"}},
 {"id": "Q034", "g3": {"state_or_value": true, "antecedent": "resolution"}},
 {"id": "Q036", "g4": {"consequence": true, "problem_domain": "clients", "named_domain": "family"}},
 {"id": "Q038", "g5": {"difficulty": true, "sales_named": true, "anchored": true}},
 {"id": "Q040", "is_solicitation": false},
 {"id": "Q042", "routing": "VALIDATION_REQUEST"},
 {"id": "Q044"}]}

UNITS
{units}

# Objections · is this passage a resistance, and what is the subject of the doubt (OB-2, OB-3, OB-4, OB-24, OB-25, OB-26)

You read ONE target turn (with a few turns of context) and describe the doubts it expresses. You do not decide the
nature: you name the subject of each doubt from the closed list; the code applies the boundary tests in order.

Step 1 · exclusions (OB-2). Set "exclusion" to:
- "information_request": a question for information ("how long is it?", "is there a payment plan?") with no reserve
  stated in the same turn;
- "external_deadline": a delay with an external, verifiable reason ("I'm moving in January", "my severance ends in March");
- "circuit_fact": a decision-circuit fact stated neutrally ("my husband handles our finances"). It is NOT a
  circuit fact when it is put forward as a reason not to decide now ("I need to talk to my husband first");
- "conditional_acceptance": "if I can pay monthly, then yes" (a decision criterion);
- "none": none of these.
"I'll think about it" with a reason is described by its reason ("I need to see my numbers" = money); without a reason
it is a postponement.

Step 2 · doubts. For each distinct doubt in the turn, give its exact quote and its subject(s) from this closed list:
- "price" (the amount is too high, the price of instalments), "money_available" (the prospect lacks the money now),
  "offer_trust" (does it work, is it legit, trust in the company or the sales), "offer_relevance" (I don't need it,
  I already know), "time" (no time / bandwidth to follow the program), "co_decider" (needs someone else's agreement
  before deciding);
- "self_capability" (not managing, not lasting, not good enough), "own_decision" (choosing wrong, being fooled again);
- "present_attachment" ("it's fine as it is", "I'm good for now"), "postponement" (later, after the holidays, no reason).
A passage expressing two different doubts ("I can't afford it and I'm scared I'll quit again") gives two doubts (OB-4).
A word such as "scared" does not make an anxiety by itself: name what the prospect is scared OF.
If the prospect explicitly denies a doubt ("I'm not scared, it's just the amount"), list the denied subject in
"denied_subjects" and do not list it as a doubt (OB-24).
With exclusion "external_deadline", list a "time" doubt only if the event also removes the prospect's availability
("it's wedding season, I'm booked until October") (OB-25), and give the deadline.

Step 3 · attribution (OB-26). "label_contradicted": true if the target turn's content cannot belong to its label
(the sales' own name or the offer described in the first person under a PROSPECT label).

JSON: {"exclusion": "none|information_request|external_deadline|circuit_fact|conditional_acceptance",
 "doubts": [{"quote": "...", "subjects": ["price"]}], "denied_subjects": [],
 "deadline": {"quote": "...", "binding": true} | null, "label_contradicted": false}

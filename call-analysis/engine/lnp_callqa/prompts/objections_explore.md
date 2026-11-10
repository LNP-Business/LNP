# Objections · does the sales explore the resistance (OB-15, OB-20, X7)

Explore: an open question of the sales that asks the prospect to open up the resistance itself: "when you say it's a
lot, a lot compared to what?", "what makes you feel that?", "what happened last time?". An elliptical open question
placed right after the resistance ("Compared to what?", "Why is that?") also counts.
A closed question (yes/no, either/or) is not an exploration.
Give the FIRST exploration of the SALES response turns. Quote the whole question including its lead-in sentence in
the same turn ("It's a lot. Compared to what?").
- "open_question": the quoted question is open.
- "elliptical": it does not reuse words of the resistance and refers back to it by ellipsis.
- "answered_with_content": the prospect's next turn adds something beyond agreement about the resistance
  (a reason, a comparison, a fact). Give that answer's quote and turn.

JSON: {"explore": bool, "turn": "T151" | null, "quote": "..." | null, "open_question": bool, "elliptical": bool,
 "answered_with_content": bool, "answer_turn": "T152" | null, "answer_quote": "..." | null}

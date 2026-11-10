# Objections · does the first response receive the resistance (OB-13, OB-20)

Read ONLY the first sentence of the FIRST RESPONSE turn.
- "receiving_marker": it contains a receiving marker without contradiction ("I hear you", "that makes total sense",
  "totally fair", "I understand", "good question", "I appreciate you sharing that", "of course", "that's not a problem").
- "neutral_reformulation": it restates the resistance neutrally ("So the amount is what's holding you back.").
- "elliptical_open_question": it is an open question that refers back to the resistance by ellipsis
  ("Compared to what?", "Why is that?", "In what way?").
- "contradiction": it starts with or contains a contradiction ("but", "actually", "no,", "that's not true",
  "the thing is", "I disagree") or a counter-argument or a defence.
"quote": the exact first sentence (or its first 40 words).

JSON: {"receiving_marker": bool, "neutral_reformulation": bool, "elliptical_open_question": bool,
 "contradiction": bool, "quote": "..."}

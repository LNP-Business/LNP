# Objections · does this sales turn change the topic (OB-8, OB-22)

You are given a resistance, the sales response so far, and ONE target sales turn.

"new_subject": true if the target turn introduces a new subject unrelated to the resistance: a new discovery
question, a new offer segment, logistics (screen share, scheduling, payment processing), or the close.
Continuing on the resistance ("so", "and", "also", "the other thing about that"), answering it, exploring it or
reassuring about it is NOT a new subject.

"receive_and_leave" (only when the target turn is marked FIRST RESPONSE): true if the turn receives the resistance
("I totally understand") and then moves to a new subject in the same turn, without answering or exploring the
resistance (OB-22). Otherwise false.

When "new_subject" or "receive_and_leave" is true, "quote" holds the exact words of the target turn where the new
subject starts.

JSON: {"new_subject": bool, "receive_and_leave": bool, "quote": "..." | null}

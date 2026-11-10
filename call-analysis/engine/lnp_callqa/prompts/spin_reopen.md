Rules: SPIN Annex A SB-3 and SB-4 (reopenings of the discovery after the first pitch or price). A reopening starts
at the given sales solicitation and ends at the next offer segment, price, decision request or topic change.

- end_turn: the id of the first SALES turn after the start where the sales returns to the offer (presents the next part
  of the program, "that brings me to the next point"), states a price, asks for a decision, or moves to another topic.
  null if none in the extract.
- quote: exact words (2 to 40) of that SALES turn showing the return.

JSON: {"end_turn": "T177", "quote": "..."}

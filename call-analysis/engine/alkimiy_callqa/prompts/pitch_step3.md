Rules: Pitch annex PB-30 (step 3 of the staircase, version PITCH-2.0).
Step 3 = the sales passage that states where the prospect goes from (A) and to (B).
- "A" and "B": the value and the unit the SALES states in step 3, with the exact sales quote that contains the figure.
  Copy the value as said (10000 for "10K"); unit as said ("per month", "clients per month", "hours per week").
- "deadline": a date or duration the sales attaches to B in step 3 (exact sales quote), else null.
  "deadline_source": the exact PROSPECT quote, before the pitch, where the prospect gave that deadline; null if he never did.
- "image": a concrete scene of his life once at B, stated after B (where he is, what he does, with whom), exact
  sales quote, else null. "image_key_expression": the prospect's words the sales reuses in the image;
  "image_source": the exact PROSPECT quote (an answer to a need/vision question, or a statement of what B would give
  him) that contains them. null if the image is not built from his words.
The selected A and B of the Gap result are given below for reference only; report what the sales SAID.
JSON: {"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "A": {"value": 2000, "unit": "per month", "quote": "...", "turn": "T190"} | null,
       "B": {"value": 10000, "unit": "per month", "quote": "...", "turn": "T190"} | null,
       "deadline": {"quote": "...", "turn": "..."} | null, "deadline_source": {"quote": "...", "turn": "..."} | null,
       "image": {"quote": "...", "turn": "..."} | null, "image_key_expression": "..." | null,
       "image_source": {"quote": "...", "turn": "..."} | null}

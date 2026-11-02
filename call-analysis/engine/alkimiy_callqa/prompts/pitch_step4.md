Rules: Pitch annex PB-31 (step 4 of the staircase, the proof, version PITCH-2.0).
Step 4 = a passage that tells the story of a named or described client who used the offer.
List every such client case told in the pitch. For each: its span (exact SALES quotes), the exact quote that
describes the case, and "library_id": the id of the case of the CASE LIBRARY below that it is (by name, or by its
figures and starting point), or "not_in_library" if it matches none. Never guess an id: when unsure, "not_in_library".
"profile_match": true only if the case's starting profile label in the library is also the prospect's starting point,
with "prospect_evidence": the exact PROSPECT quote, before the pitch, that shows it; else false and null.
JSON: {"cases": [{"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."},
                  "quote": "...", "turn": "T192", "library_id": "case-07|not_in_library",
                  "profile_match": false, "prospect_evidence": null}]}

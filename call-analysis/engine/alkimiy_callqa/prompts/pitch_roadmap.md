Rules: Pitch methodology §2.3 and annex PB-34 (version PITCH-2.0).
The roadmap starts at the first sales passage that presents steps or milestones of THE PROSPECT'S path ("your
roadmap", "step one for you is...", the shared one-page plan). A presentation of the program's pillars or modules is
not a roadmap. Give its span (exact SALES quotes), or null.
For each step of the roadmap, give the exact sales quote, the key expression (the prospect's words the sales reuses
for that blocker) and "source": the exact PROSPECT quote, before the pitch, where he named that blocker (the list of
his blockers from the Gap result is given below). source null if the step is not one of his named blockers.
JSON: {"roadmap": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "steps": [{"quote": "...", "turn": "T233", "key_expression": "...", "source": {"quote": "...", "turn": "T061"} | null}]}

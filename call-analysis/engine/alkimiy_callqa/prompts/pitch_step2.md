Rules: Pitch annex PB-29 (step 2 of the staircase, version PITCH-2.0).
Step 2 = the sales passage that follows step 1 and states a principle ("what makes that give way is...") and a phase
of the offer.
1. "step": its span (exact SALES quotes at start and end), or null.
2. "mechanisms_stated": map EVERY principle or phase of the offer that the sales states between the pitch start and
   the roadmap (or the price) to ONE of the nine mechanisms: Skill, Legitimacy, Pricing, Acquisition, Selling,
   Delivery, Time, Past failure, Financial risk. Use the mechanism reference given below when there is one (name,
   principle, phase, cues); without it, map by the blocker each passage answers. kind = "principle" (a principle the
   prospect could repeat) or "phase" (the phase / part of the offer that carries it). One entry per passage, each
   with an exact sales quote. A mechanism said in passing still counts.
3. "recitation": a passage that lists components, modules or deliverables of the offer without tying them to the
   principle; give the exact quote and the list of the items named. null if none.
JSON: {"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "mechanisms_stated": [{"mechanism": "Pricing", "kind": "principle|phase", "quote": "...", "turn": "T187"}],
       "recitation": {"items": ["module 4 pricing", "module 5 contracts", "community"], "quote": "...", "turn": "T189"} | null}

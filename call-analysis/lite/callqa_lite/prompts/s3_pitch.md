STEP S3 · THE PITCH (Pitch 2.0, annex PB-14 to PB-16, PB-23, PB-24, PB-27 to PB-36)
{anchors}
VALIDATED P (the blocker of the gap the prospect validated): {vp}
SELECTED A: {a}
SELECTED B: {b}
HIS OTHER BLOCKERS (roadmap material): {blockers}
{references}
A span is {"start_turn", "start_quote", "end_turn", "end_quote"} with exact SALES words. Read from the pitch start to
the end of the call. Give:
1 "category" (only when a validated P is given, PB-27): what does the prospect doubt? Tests in order: his ability to do
  the work -> Skill; being chosen without experience or credentials -> Legitimacy; what to charge -> Pricing; where
  clients come from -> Acquisition; turning a conversation into a client -> Selling; running a project end to end ->
  Delivery; hours available -> Time; an earlier course or attempt that produced nothing -> Past failure; the risk that
  the investment does not pay off -> Financial risk. A lack of money to pay for the program: not_a_pitch_blocker. None
  of the nine (a fear, overthinking, "change is scary"): P_category_unknown, with "uncovered" (one sentence). When two
  fit, the category of the prospect's own words wins. {"category", "quote" (the deciding prospect words, from the turn
  of the validated P), "turn"}.
2 "step1" (PB-28): {"step": the first sales passage after the pitch start that states what blocks the prospect; it
  ends at the first sentence that states a principle, a component or a phase; null if none,
  "other_blockers": [{"quote", "turn"}] other blockers restated inside step 1 as what blocks him}.
3 "step2" (PB-29): {"step": the passage after step 1 that states a principle ("what makes that give way is...") and a
  phase of the offer, or null; "mechanisms_stated": EVERY principle or phase stated between the pitch start and the
  roadmap (or the price), each mapped to one of Skill, Legitimacy, Pricing, Acquisition, Selling, Delivery, Time,
  Past failure, Financial risk: [{"mechanism", "kind": "principle" or "phase", "quote", "turn"}]; "recitation":
  {"items": [...], "quote", "turn"} for a passage that lists components, modules or deliverables without tying them to
  the principle, else null}.
4 "step3" (PB-30): what the SALES says about where the prospect goes from and to: {"step": span or null, "A": {"value"
  (a number), "unit", "quote", "turn"}, "B": {...}, "deadline": {"quote", "turn"} (a date or duration the sales
  attaches to B), "deadline_source": {"quote", "turn"} (the PROSPECT words, before the pitch, where he gave it),
  "image": {"quote", "turn"} (a concrete scene of his life once at B), "image_key_expression" (the prospect's words
  reused in the image), "image_source": {"quote", "turn"} (the PROSPECT quote that contains them)}.
5 "step4" (PB-31): {"cases": every client case told: [{"step": span, "quote", "turn", "library_id" (the id in the
  case library, else "not_in_library"; never guess), "profile_match", "prospect_evidence": {"quote", "turn"}}]}.
6 "roadmap" (PB-34): {"roadmap": span of the steps or milestones of THE PROSPECT'S path ("your roadmap", "step one
  for you is"), not the program's modules, or null; "steps": [{"quote", "turn", "key_expression", "source": {"quote",
  "turn"} (where he named that blocker, before the pitch) or null}]}.
7 "claims" (PB-35): EVERY figure, client case, price or guarantee the SALES states from the pitch start to the decision
  request: [{"kind": "figure" | "case" | "price" | "guarantee", "quote", "turn", "library_id", "guarantee_ref",
  "calculation" (presented as a calculation on other figures)}].
8 "promises" (PB-36): sales sentences whose subject is the Academy, the team or "we" and whose action is running his
  business, finding or bringing him clients, signing his clients or delivering his projects: [{"quote", "turn",
  "action": "run_business" | "find_clients" | "sign_clients" | "deliver_projects"}]. Providing systems, feedback,
  coaching, templates or reviews is not a promise.
9 "adhesion" (PB-14 to PB-16, PB-23, PB-24): PROSPECT passages showing "appropriation" (he restates a component as
  applied to himself), "projection" (first person, future or conditional, with a date, a number, a first action, a
  named client or project) or "new_link" (he connects a component to his situation on his own). Not: approvals,
  compliments, price or logistics questions, content first stated by the sales. [{"quote", "turn", "kind", "concrete",
  "comprehension_echo" (only echoes the sales' words in answer to a comprehension question), "postpone" (a projection
  used to justify a delay), "gesture": {"quote", "turn"} (the sales words just before)}].
JSON: {"category": {"category": "Acquisition", "quote": "...", "turn": "T028"}, "step1": {"step": null,
  "other_blockers": []}, "step2": {"step": null, "mechanisms_stated": [], "recitation": null}, "step3": {"step": null},
  "step4": {"cases": []}, "roadmap": {"roadmap": null, "steps": []}, "claims": [], "promises": [], "adhesion": []}

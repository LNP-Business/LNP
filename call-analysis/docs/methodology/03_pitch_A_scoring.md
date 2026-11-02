# Competence 3 · Pitch
_Scoring methodology: how the system measures whether the sales pitched the one blocker the prospect validated, with its one mechanism, in four steps built from the prospect's own words, before the roadmap, the price and the decision_

**Version:** Version 2.0 · 25 October 2026  
**Status:** Draft for validation by the methodology owner. Values marked "to validate" or "à confirmer" are proposals or missing facts.  
**Scope:** Sales calls that contain a presentation of the offer. Sources: ALKIMIY pitch board "9 blocages, 9 mécanismes" (October 2026), Gap Formalisation methodology v1.3 (gap formula, verbatim rules), ALKIMIY verbatim reference v2 (tipping point), analysis of 85 real calls.  
# 1. What this competence measures

**Definition.** The pitch is the part of the call where the sales presents the offer: from the first statement describing the offer (or the start of the screen share of the program) to the first price, or to the end of the presentation if no price is given.

**What the pitch is now.** The pitch treats **one blocker only**: the blocker P that the prospect validated in the gap. It answers it with **one mechanism only**: the mechanism of the offer that carries the name of that blocker. It is delivered as a **staircase of four steps, in this order**, each step starting from what the prospect said: (1) restate the blocker, (2) the mechanism, (3) the transformation A → B, (4) the proof. **Only after** the four steps come the roadmap (the prospect's other blockers), then the amount, then the decision. The board this replaces asked the sales to go through steps 1 and 2 three times; that is no longer done: the other blockers go into the roadmap.

**What success means, in one sentence.** The sales succeeded when, once the gap was validated, they restated the prospect's blocker in his exact words, gave the single mechanism of that blocker as a principle he can repeat and the phase of the offer that carries it, described his own transformation from A to B in his unit and his words, gave a real client case that started where he starts, then showed his roadmap before any price, and the prospect took the solution on board in words of his own.

**The test that decides everything.** **This pitch is only true for him.** Every step must contain something that only this prospect said (his blocker, his figures, his words, a case that started where he is). A step that could be said word for word to any other prospect is generic and cannot reach the top level.

**What is forbidden, even if it would help to sign (hard exclusions).**
1. **Pitching before the yes.** Presenting the offer before the gap is validated. The Copilot blocks the pitch until the gap is validated.
2. **Anything outside his gap or the offer.** A figure, a client case, a price or a guarantee that is neither in the prospect's gap (his quotes) nor in the offer reference (offer, case library).
3. **Promising that the Academy does his work.** Saying that the Academy will run his business, find or sign his clients, or deliver his projects. The Academy brings the systems, the feedback and the coaching; he runs his business.

Any one of them makes the pitch **non-compliant**: Pitch score = 0 for the call, with the reason shown (§5.1).

**What is not measured.** Style, energy, slides. The pitch score measures whether the offer was connected to this prospect's validated blocker, in the prescribed order, and whether the prospect connected to it.

# Part A · Definitions
The rules that find each element in a raw transcript (units, start and end markers, segmentation, exclusions and minimal pairs) are in **Annex A · Bounding rules**. **Annex B** gives real annotated cases for calibration. A verdict that cannot be reached with these rules goes to the arbiter as an uncovered case.

# 2. Vocabulary

## 2.1 The offer: 9 blockers, 9 mechanisms

Each mechanism answers one blocker and carries its name. The Copilot picks the mechanism that matches the prospect's P, from the sentence the prospect said.

| Blocker (= mechanism) | The prospect's sentence, typically |
|---|---|
| Skill | "can I actually do this?" |
| Legitimacy | "who will hire me without experience?" |
| Pricing | "I don't know what to charge" |
| Acquisition | "I don't know where clients will come from" |
| Selling | "I don't know how to turn a conversation into a client" |
| Delivery | "I'm not sure I can run a client project end to end" |
| Time | "I only have a few hours a week" |
| Past failure | "I took a course and nothing happened" |
| Financial risk | "what if it doesn't work?" |

**Category of P.** The model classifies the validated P (the prospect's exact quote) into one of the nine categories, with the boundary tests of Annex A (PB-27). A P that fits none is `P_category_unknown`: it goes to the arbiter as `uncovered_case`, and the staircase is scored without step 2 (§5.3).

**Mechanism reference (à confirmer).** For each of the nine mechanisms, the offer reference must store: its name; its **principle**, one sentence the prospect can repeat; the **phase of the offer** that carries it; and its lexical cues. These texts are not written yet: they must be provided by the offer owner. Until they are, step 2 is checked on the category only and flagged `mechanism_reference_missing`.

## 2.2 The staircase: four steps, in this order

Each step starts from what the prospect said. Short sentences, natural when spoken: **one to three sentences per step**.

| Step | Comes from | Opening line (indicative) | Done right | Failure that matters |
|---|---|---|---|---|
| **1 · Restate the blocker** | P (gap) | "What's blocking you today is…" | His blocker, with **his exact words**. No translation, no summary | Saying it in the sales' vocabulary: he no longer recognises himself |
| **2 · The mechanism** | P turned around | "What makes that give way is…" | **One** mechanism, the one of his blocker, said as a principle he can repeat in one sentence, then the phase of the offer that carries it. Example: Legitimacy | Adding a second mechanism, or reciting the content of the offer |
| **3 · The transformation** | A → B (gap) | "You go from A to B." | In **his unit**: his euros, his hours, his clients. His deadline **only if he gave one**. Ends with a concrete image of his life once there, **in his words** | Speaking in the sales' unit, or inventing a date |
| **4 · The proof** | A, his starting point | "Someone who started exactly where you are…" | A **real client case**, cited with the client's consent, whose starting point resembles his. Without a matching case, the Copilot leaves a slot to fill: it **never invents** | Bringing out the best case: he does not recognise himself in it |

**And only after:** his roadmap, then the amount, then the decision. **Neither the pitch nor the roadmap page gives the price.**

## 2.3 The roadmap: the client page

The pitch treats the blocker he validated. **His other blockers become the steps of his one-page roadmap**, shared on screen at the end of the call, then sent by private link. One step per blocker he named, in the order in which they must fall (order rule à confirmer; proposal: the order of the table of §2.1).

| Block | Content |
|---|---|
| **Today** | His point A, quantified, with his sentence, and what the status quo costs him over one year |
| **Step 1** | His blocker (verbatim) · 2 deliverables of the Academy · one proof · what it brings him, with the calculation · a first win within 30 days |
| **Step 2** | Next blocker · same headings · the milestone rises |
| **Step 3 (or 4)** | Last blocker · the last milestone equals his objective |
| **His objective** | His point B · the gain per year and his other gains: time, confidence, credibility, security, freedom |

**Values.** The value of each step is computed with his figures (price per project, hours, inquiries and signing rate). A missing figure appears in small type as **"To ask"**: the sales asks him live.

**Checks before sharing the link.** The link can only be copied when every check is green:
- capacity held at each milestone;
- client flow explained;
- objective respected (the last milestone equals B);
- values that add up;
- no price of the offer;
- no link (meaning à confirmer);
- 3 or 4 steps;
- fits on one screen;
- starting point chosen.

The ◇ checks inform without blocking: a step without proof is counted in **Admin › Proof gaps**, to know which proof to collect first.

**Number of blockers.** A 3-step roadmap needs at least 3 blockers ticked in P or I answers; below that, the Copilot warns the sales before generating the page (Gap methodology, GB-32 and GB-33). Open point à confirmer: whether the blocker treated in the pitch also counts as a roadmap step (the board says "the others become the steps", while the page shows "Step 1 · his blocker").

## 2.4 Other terms

**Pitch boundaries.** Placed by the phase map (Part C, C2, stage S2):
- **Pitch start:** the first sales turn that describes the offer (its content, format, duration, support, guarantee) or announces and starts a screen share of the program. A one-sentence answer to a direct question of the prospect about what the offer is is not a pitch start; it is logged as `offer_mention` (Annex A, PB-1, PB-2, PB-17).
- **Pitch end:** the first price statement by the sales; otherwise the first decision request; otherwise the end of the call.

**Validated P.** The blocker restated in the restitution that passed the Gap absence gate. If that restitution restated several blockers, the validated P is the selected P of the Gap methodology (GB-30) among them.

**Adhesion.** The moment the prospect moves from reserve to adherence, observed in his words: he takes the solution as his own, projects himself concretely into using it, or formulates a new link between the offer and his situation (Annex A, PB-14). A plain "okay", "sounds good", "that's great" is not adhesion.

# Part B · Mechanism and scoring

# 3. What the system extracts

| Field | Closed question to the model | Evidence |
|---|---|---|
| `pitch_start`, `pitch_end`, `first_price`, `decision_request` | Phase anchors | Turn number and exact sales quote |
| `validated_P` | Taken from the Gap result of the call (verdict, restitution, selected P) | Prospect quote, turn |
| `P_category` | Which of the nine categories does the validated P belong to? (PB-27) | Category, prospect quote |
| `steps` | For each of the four steps: which sales passage performs it? (PB-28 to PB-31) | Turn span, exact sales quote |
| `mechanisms_stated` | Which mechanisms of the reference does the sales state as a principle or a phase in the pitch before the roadmap? (PB-29) | Mechanism name, exact sales quote |
| `transformation` | Which A, B, unit, deadline and image of life does step 3 state, and from which prospect quotes? (PB-30) | Sales quote, prospect source quotes |
| `proof_case` | Which client case is cited in step 4? Is it in the case library? (PB-31) | Sales quote, case id or `not_in_library` |
| `roadmap` | Where does the sales present the roadmap, and which blockers are its steps? (PB-34) | Turn span, sales quotes, prospect source quotes |
| `claims` | Which figures, client cases, prices and guarantees does the sales state in the pitch? (PB-35) | Sales quote |
| `outcome_promises` | Does the sales say the Academy will run his business, find or sign his clients, or deliver his projects? (PB-36) | Sales quote |
| `adhesion` | Which prospect passages show appropriation, concrete projection or a new link? For each, the sales gesture just before | Prospect quote, sales gesture quote |

**Computed by code:**
- `gap_verdict` and `validated_P`, from the Gap result of the same call;
- the verbatim check of step 1 and step 3 (Gap Annex A, GB-22);
- the order of the steps, of the roadmap, of the price and of the decision request, on turn numbers;
- the number of sentences of each step;
- the match between the mechanism stated and `P_category`;
- the match of each claim against the prospect's gap quotes, the offer reference and the case library (PB-35);
- the match between the proof case's starting point and the prospect's A (PB-31).

# 4. Applicability

| Situation | Pitch status |
|---|---|
| A pitch start exists | `scored` |
| Only an `offer_mention`, no pitch | `not_applicable` |
| Second call where the pitch is resumed after a first call | `scored`; the gap must be re-validated in this call before the pitch resumes (Gap, GB-13) |
| Offer reference or mechanism reference missing | `scored`, step 2 checked on the category only, flag `mechanism_reference_missing` |
| Case library missing | `scored`, step 4 `not_applicable`, flag `case_library_missing` |

# 5. The Pitch score

### 5.1 Step 1: the compliance gate

The code checks, in this order:
1. **Pitch after the yes.** The Gap verdict of the call is "present" and the validation turn comes before the pitch start. Otherwise: reason `pitch_before_gap`.
2. **Nothing outside his gap or the offer.** No claim (figure, client case, price, guarantee) that is neither in the prospect's gap quotes nor in the offer reference or the case library (PB-35). Otherwise: reason `out_of_gap_claim`.
3. **No promise that the Academy does his work.** No outcome promise (PB-36). Otherwise: reason `outcome_promise`.

If any check fails: **verdict "non-compliant", Pitch score = 0**, with every failed reason stored and the first one displayed. The items below are still computed and shown as diagnostics, never as a score. (Severity to validate: the alternative is a cap at 40 instead of 0.)

### 5.2 Step 2: the score of a compliant pitch

Seven items, each scored 0, 1 or 2. **Call score = Σ (weight × level / 2)**, rounded, on 100.

| Item | Weight | Level 0 | Level 1 | Level 2 |
|---|---|---|---|---|
| K1 Step 1 · Blocker restated | 15 | No restatement of the validated P in the pitch, or a paraphrase only (no key expression, Gap GB-22) | The validated P restated verbatim, but together with other blockers, or another blocker restated in its place | The validated P alone, restated verbatim |
| K2 Step 2 · The mechanism | 20 | No mechanism stated; or the mechanism of another category; or two mechanisms or more | The mechanism of P's category, alone, but without the principle in one sentence or without the phase of the offer, or followed by a recitation of the offer content | The mechanism of P's category, alone, as a principle in one sentence, then the phase of the offer that carries it |
| K3 Step 3 · The transformation | 15 | No A → B; or A and B in a unit that is not the prospect's; or a deadline the prospect never gave | A → B in the prospect's unit with his figures, no invented date, but no image of his life once there, or an image not in his words | A → B in his unit with his figures, his deadline only if he gave one, ending with a concrete image of his life in his words (key expression, Gap GB-22) |
| K4 Step 4 · The proof | 15 | No client case | A real case from the library, whose starting point does not match his A (the best case) | A real case from the library, with consent, whose starting point matches his A (PB-31) |
| K5 Order and brevity | 10 | Fewer than three of the four steps | The steps present but not in the order 1 → 2 → 3 → 4, or a step longer than three sentences | All four steps, in order, each one to three sentences |
| K6 Then: roadmap, amount, decision | 15 | No roadmap presented, or the price given before the roadmap | Roadmap presented after step 4 and before the price, but its steps are not his named blockers, or the decision request comes before the price | Roadmap after step 4, its steps are his other blockers in his words, then the amount, then the decision |
| K7 Adhesion | 10 | No adhesion | One adhesion passage | Two or more adhesion passages, or one with a concrete projection (a date, a number, a named first action) |

**The test "only true for him".** K1 to K4 reach level 2 only if the step contains at least one element that only this prospect said: his key expression (K1), his figures and his words (K3), a case matched on his A (K4); K2 reaches level 2 only if it follows a K1 that does. A step that would be identical with any other prospect is capped at level 1 (`generic_step`).

**Step 4 without a matching case.** If the case library holds no case whose starting point matches his A, step 4 is `not_applicable` for K4 (the sales must not invent one; the Copilot leaves a slot to fill) and the call is counted in **Proof gaps**. K4's weight is then spread proportionally over the other items.

**P outside the nine categories.** If `P_category_unknown`, K2 is `not_applicable` and its weight is spread proportionally over the other items; the case is reported to the methodology owner.

**Why these weights.** The mechanism (20) is what makes the blocker give way. The blocker, the transformation, the proof and the sequence roadmap → amount → decision (15 each) carry the rest of the board. Order and adhesion (10 each) check delivery and the prospect's reaction. Proposals, to validate.

# 6. How the system knows the sales succeeded

1. **He pitched after the yes.** The Gap verdict and the validation turn come from the Gap result; the pitch start is placed after it on turn numbers. Otherwise the pitch is non-compliant.
2. **One blocker, his words.** Step 1 contains the prospect's key expression for the validated P, checked by code in both texts; another blocker in its place, or several, cannot reach the top level.
3. **One mechanism, the right one.** The mechanism stated is matched against the category of the validated P; a second mechanism or a recitation of the offer is detected and stated with its quote.
4. **His transformation, his proof.** A, B and the image come from the prospect's quotes; the unit and the deadline are compared with his; the case is looked up in the library and its starting point compared with his A.
5. **The order.** Steps 1 to 4, roadmap, price, decision: all placed on turn numbers and compared by code.
6. **Nothing invented, nothing promised.** Every figure, case, price and guarantee is matched against his gap and the offer; every outcome promise is caught with its quote.
7. **The prospect projects.** Adhesion is read in his words, with a quote; agreement alone never counts.
8. **It is reproducible.** Three concordant passes or an arbitrated decision for every step, claim and adhesion passage (Part C, C4).

# 7. Coaching diagnostics (displayed, never scored)

| Diagnostic | Computation |
|---|---|
| Non-compliance reasons | Distribution of `pitch_before_gap`, `out_of_gap_claim`, `outcome_promise` over the period |
| Category of P | Distribution of the validated P over the nine blockers; share of `P_category_unknown` |
| Mechanism errors | Share of pitches with a second mechanism, the wrong mechanism, or a recitation of the offer |
| Step failures | Per step, the most frequent failure (paraphrase, other unit, invented date, best case) |
| Proof gaps | Calls where no matching case existed, by category of P and by starting point: which proof to collect first |
| Roadmap | Number of roadmap steps; share of roadmaps shared before the price; "To ask" figures left open |
| Talk share during the pitch | Share of words spoken by the sales between pitch start and pitch end; above 85 % flagged "monologue" (threshold to validate) |
| Gesture before adhesion | The sales gestures that most often precede adhesion across calls |
| Check-ins | Sales solicitations in the pitch that ask how a component applies to him, and whether he answered with content (Annex A, PB-11 to PB-13) |
| Former coverage (version 1) | Blockers and criteria of the prospect answered by a component in the pitch (links, Annex A PB-8 to PB-10), shown for comparison during the transition |

**Reference observed on Valentino (85 calls with a pitch, version 1 indicators, before this board existed):** pitch started after a restitution of at least two components in 76 % of calls; an adhesion passage observed after the pitch start in 59 %. None of the version 2 items (single blocker, single mechanism, staircase, matched proof, roadmap before price) has been measured yet: they are the first figures to establish once calls are made with the new board.

# 8. Worked examples
Illustrative cases, adapted and shortened. In production, every piece of evidence is an exact quote checked against the transcript.

| Case | Verdict |
|---|---|
| Validated P: "I don't know what to charge." Sales: "What's blocking you today is you don't know what to charge." | K1 = 2 (verbatim) |
| Same P. Sales: "What's blocking you today is your pricing strategy." | K1 = 0: paraphrase in the sales' vocabulary |
| P category Pricing. Sales states the Pricing principle in one sentence, then "that's the second phase of the Academy". | K2 = 2 |
| Same, then: "And on top of that, the Acquisition system will bring you leads…" | K2 = 0: a second mechanism |
| Prospect: A "about 2K a month", B "10K a month", no deadline, "be home when my kids get back from school". Sales: "You go from about 2K a month to 10K a month, and you're home when your kids get back from school." | K3 = 2 |
| Same, Sales: "You go to six figures by next summer." | K3 = 0: other unit, invented date |
| Prospect starts from zero clients with a full-time job. Sales cites the library case of a student who started with zero clients and a full-time job. | K4 = 2 |
| Sales cites the student who reached 30K a month, who started as an established architect. | K4 = 1: best case, starting point does not match |
| Sales: "We'll find the clients for you." | Non-compliant, `outcome_promise`: score 0 |
| Sales: "Our students make 15K a month on average." The figure is not in the offer reference. | Non-compliant, `out_of_gap_claim`: score 0 |
| Price "$5,800" given right after step 3, roadmap never shown | K6 = 0 |

# 9. Output contract

```
{
  "call_id": "…", "competence": "PITCH", "rules_version": "PITCH-2.0",
  "status": "scored", "verdict": "compliant", "non_compliance": [], "score": 78,
  "phases": {"pitch_start": "T185", "roadmap": ["T231", "T248"], "first_price": "T259",
             "decision_request": "T266"},
  "validated_P": {"quote": "…", "turn": "T120", "category": "Pricing"},
  "steps": {"1": {"span": ["T186", "T186"], "key_expression": "…", "verbatim": true, "sentences": 1},
            "2": {"span": ["T187", "T189"], "mechanisms": ["Pricing"], "principle": true,
                  "offer_phase": true, "recitation": false, "sentences": 3},
            "3": {"span": ["T190", "T191"], "A": "…", "B": "…", "same_unit": true,
                  "deadline": null, "image_key_expression": "…", "sentences": 2},
            "4": {"span": ["T192", "T194"], "case_id": "…", "consent": true,
                  "start_matches_A": true, "sentences": 3}},
  "order_ok": true,
  "roadmap": {"steps": [{"blocker_quote": "…", "turn": "T061"}], "before_price": true},
  "claims": [{"quote": "…", "source": "offer_reference"}],
  "adhesion": [{"turn": "T214", "quote": "…", "sales_gesture": "…", "projection": true}],
  "items": [{"id": "K1", "level": 2}, {"id": "K2", "level": 2}],
  "concordance": "3/3"
}
```

# 10. Decisions to validate

- The compliance gate: score 0 for `pitch_before_gap`, `out_of_gap_claim` and `outcome_promise` (alternative: cap at 40).
- The seven items and their weights (15 / 20 / 15 / 15 / 10 / 15 / 10).
- **À confirmer by the offer owner:** for each of the nine mechanisms, its principle in one sentence, the phase of the offer that carries it, and its lexical cues.
- **À confirmer:** the case library (cases, client consent, starting point of each case) and the matching rule of PB-31 (same dimension as A, starting value within a factor to define).
- **À confirmer:** the order in which the roadmap blockers must fall; whether the blocker treated in the pitch is also a roadmap step; the meaning of the check "no link".
- The limit of one to three sentences per step (sentence split by code; tolerance to validate).
- What to do with real blockers outside the nine categories (fear, overthinking, lack of money; see Annex B, B5).

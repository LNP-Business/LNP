# Competence 2 · Gap Formalisation
_Scoring methodology: how the system measures whether the sales turned the discovery into a gap stated by the prospect, restated by the sales and validated by the prospect before the pitch_

**Version:** Version 1.3 · 25 October 2026  
**Status:** Draft for validation by the methodology owner. Values marked "to validate" are proposals.  
**Scope:** Sales calls with a discovery phase. Sources: LNP verbatim reference v2 (current state, desired state, decision), LNP SPIN bounding reference v1.0 (restitution), analysis of 85 real calls.  
# 1. What this competence measures

**Definition.** The gap is the distance between where the prospect is today (point A) and where they want to be (point B), the problem that keeps them from closing that distance on their own, and what that problem costs them. Formalising the gap means making it explicit and agreed **before** the offer is presented: the sales restates it in the prospect's words and the prospect validates it.

**What success means, in one sentence.** The sales succeeded when, before the first pitch and the first price, they restated the prospect's problem and the cost of that problem in the prospect's own words, and the prospect validated that restitution; the gap is all the stronger when points A and B are quantified in the same unit and the prospect adds something of their own when validating.

**The absence rule (hard exclusion).** **If, before the first pitch, there was no restitution of the prospect's problem and of the cost of that problem, validated by the prospect, the gap is considered absent.** The call then scores 0 on this competence, whatever was collected during discovery. Collecting the elements is discovery; formalising them is the gap. Without a validated restitution, the pitch has no agreed problem and no agreed cost to answer, and the price is compared with nothing.

**The verbatim principle (governs every rule of this competence).** The gap belongs to the prospect, so it is built only from the prospect's exact words:
1. **Every component is a prospect quote.** PROBLEM, COST, A and B exist only as exact quotes of prospect turns, checked character for character against the transcript (Part C, C3). Nothing the sales said first, computed or suggested is ever a component, even if the prospect approved it.
2. **The restitution gives back the prospect's words.** A restated component counts only if the sales clause contains the prospect's **key expression** for that component, copied exactly (Annex A, GB-3 and GB-22). A paraphrase, a synonym, a summary in the sales' own words or a change of word form ("stressed" restated as "stress") does not count, however faithful it is.
3. **Figures are the prospect's figures.** A number counts only if the prospect said it; a rounded, converted or computed number is the sales' number.
4. **The validation is read in the prospect's words.** Its outcome is proved by an exact prospect quote; "with content" means content in the prospect's own words, quoted.

# Part A · Definitions
The rules that find each element in a raw transcript (units, start and end markers, segmentation, exclusions and minimal pairs) are in **Annex A · Bounding rules**. **Annex B** gives real annotated cases for calibration. A verdict that cannot be reached with these rules goes to the arbiter as an uncovered case.

# 2. The four components

| Component | Definition | Mandatory for the gap to exist? | Comes from (verbatim reference v2) |
|---|---|---|---|
| PROBLEM (P) | What is not working and keeps the prospect from reaching B: a lack, a blocker, a fear, a past failure, a constraint. **One single blocker** is restated (§2.1) | **Yes** | Answers to **P** solicitations (SPIN); CURRENT_STATE (pain), BLOCKER atoms, anxiety, past attempt |
| COST | What the problem costs the prospect, or what staying in the current situation costs: money, time, clients, family, health, self-belief, lost opportunity | **Yes** | CURRENT_STATE with consequence or figure, IMPACT atoms, cost of inaction |
| A · Current state | Where the prospect is today: **the figure he wants to move**, not the biggest figure of the call | No (scored) | Answers to **S** and **I** solicitations (SPIN); CURRENT_STATE, SITUATION atoms |
| B · Desired state | Where the prospect wants to go: his target, **in the same unit as A**, with his deadline if he gave one | No (scored) | Answers to **N** solicitations (SPIN); DESIRED_STATE, DESIRE atoms |

**Unit.** The dimension in which A and B are expressed: monthly revenue, number of clients, hours per week, status, date. Two statements share a unit when the code can compute a difference between them.

**Quantified.** A statement is quantified when it attaches a number, an amount, a duration, a frequency or a date to the component.

**Horizon.** A date or duration attached to B. A **binding** deadline (external, verifiable: "my contract ends in March") is distinguished from a **wished** delay ("I'd like to start soon").

**Restitution, validation, valid gap.** The exact rules that identify a restitution, its components and its validation in a transcript are in Annex A (Bounding rules). In short:
- a **restitution** is a sales passage that restates at least two components, each containing the prospect's exact key expression for that component;
- a **validation** is the prospect's response to that restitution: confirmed with content, confirmed, corrected, rejected or none;
- a **valid gap** is a restitution that contains PROBLEM and COST, is placed before the first pitch and the first price, and is confirmed by the prospect (with or without content, or corrected then confirmed).


## 2.1 The gap formula: which A, which B, which P

The restitution of the gap follows one sentence, filled with the prospect's own words:

> **"You're at [A] · you want to get to [B] · and what's holding you back today is [P]."** (French version used in coaching: « Tu es à [A] · tu veux atteindre [B] · et ce qui te bloque aujourd'hui, c'est [P]. »)

The cost of P is added to this sentence, in the prospect's words: it remains mandatory for the gap to exist (absence rule).

| Slot | What it is | Where it comes from | Selection rule (Annex A) |
|---|---|---|---|
| **A** · Where he is | The figure he wants to move, not the biggest figure of the call | Prospect answers to **S** and **I** solicitations | The current value on the dimension that B targets (GB-28) |
| **B** · Where he wants to go | His target, in the same unit as A; his deadline if he gave one | Prospect answers to **N** solicitations | The target expressed in A's unit (GB-29) |
| **P** · What blocks him | **One single blocker** | Prospect answers to **P** solicitations | The blocker he named when asked what stops him; otherwise the one he comes back to most (GB-30) |

**The other blockers are not lost.** Every other blocker the prospect stated in answer to a P or I solicitation becomes a step of his roadmap, presented in the pitch. A roadmap of 3 steps needs at least 3 distinct blockers ticked from P or I answers; below that, **the Copilot warns the sales before generating the roadmap page** (GB-33). The roadmap count is a diagnostic: it never changes the Gap score.

**What the system selects, what the sales must say.** The code selects A, B and P from the prospect's quotes with the rules of Annex A (GB-28 to GB-30), before reading the restitution. It then checks whether the restitution restates **these** A, B and P, verbatim (GB-22), with one single blocker (GB-31). A restitution that restates another figure, another unit or several blockers can still pass the absence gate if it contains a verbatim PROBLEM and COST, but it cannot reach level 2 on G5.

# Part B · Mechanism and scoring

# 3. What the system extracts

**From the prospect (discovery perimeter and any reopening):**

| Field | Closed question to the model | Evidence |
|---|---|---|
| `A_statements` | Which prospect passages describe the current state on a dimension related to the goal? | Exact prospect quote, turn, unit, value if quantified |
| `B_statements` | Which prospect passages describe a desired state or a necessary means? Exclude interest expressed after the first pitch | Exact quote, unit, value, horizon, binding or wished |
| `problem_statements` | Which prospect passages name what is not working or what prevents them from reaching B? | Exact quote; type: skill, time, money, fear, past failure, external constraint |
| `cost_statements` | Which prospect passages state what the problem costs them, or what staying as they are costs? | Exact quote, domain, quantified yes/no |
| `prompted_by_sales` | For each passage: was the content stated by the sales first and only approved? | yes / no |

**From the sales and the prospect's response (Annex A):**

| Field | Closed question to the model | Evidence |
|---|---|---|
| `restitutions` | Which sales passages are restitutions (rules GB-1 to GB-7)? | Turn span, exact sales quote |
| `components` | For each restitution: which components does it restate, which earlier prospect statement does each come from, and which exact prospect words does it reuse? | Exact sales quote per component; id and exact quote of the source prospect statement; the key expression (GB-22), copied from the source |
| `validation` | What is the prospect's response (rules GB-8 to GB-10)? | Outcome, exact prospect quote |

**Selected by code (gap formula, §2.1):** `selected_A` (GB-28), `selected_B` (GB-29), `selected_P` (GB-30) and `roadmap_blockers`, the distinct blockers stated in P or I answers (GB-32). The SPIN letter of each solicitation comes from the SPIN bounding reference; the object label of each blocker comes from the SPIN annex (SB-16).

**Computed by code:** the phase of each restitution (before or after the first pitch and the first price); the verbatim check of each key expression (exact substring of the prospect source and of the sales clause, with only the transformations allowed by GB-22); `same_unit` and `gap_value` (B − A); the valid-gap verdict; the discarding of prompted passages, approval-only turns and current income presented as a cost.

# 4. Applicability

| Situation | Gap status |
|---|---|
| Discovery perimeter exists, a pitch or a price follows in the call | `scored` (the absence rule applies) |
| Discovery perimeter exists, the call ends before any pitch or price (presentation moved to a second call) | `scored` on the restitutions of the call; the absence rule applies at the end of the call |
| Follow-up call where the pitch resumes after a first call of the same cycle | `scored`: a valid gap must be restated and re-validated in this call before the pitch resumes; statements of the first call can be the sources of the components |
| No discovery and no restitution, no pitch | `not_applicable` |
| Diarization suspect | `excluded` |

# 5. The Gap score

### 5.1 Step 1: the absence gate

The code checks, in this order:
1. At least one restitution exists before the first pitch and before the first price.
2. Among them, at least one restates PROBLEM and COST **in one go** (both in the same restitution, Annex A GB-34), each **verbatim**: the sales clause contains the prospect's exact key expression for that component (Annex A, GB-3 and GB-22). A paraphrased component does not count.
3. That restitution is followed by a validation outcome `confirmed_with_content`, `confirmed`, or `corrected` followed by a restated and confirmed version.

If any check fails: **verdict "Gap absent", call score = 0**, label shown on the call card with the reason (`no_restitution`, `restitution_after_pitch`, `problem_missing`, `cost_missing`, `not_validated`). The items below are still computed and shown as diagnostics ("elements collected but not formalised"), never as a score.

### 5.2 Step 2: the score of a present gap

When the gate passes, six items scored 0, 1 or 2. **Call score = Σ (weight × level / 2)**, rounded, on 100.

| Item | Weight | Level 0 | Level 1 | Level 2 |
|---|---|---|---|---|
| G1 Point A | 10 | No A statement by the prospect in S or I answers | A stated, not quantified | A quantified by the prospect, on the dimension that B targets (GB-28) |
| G2 Point B | 10 | No B statement by the prospect in N answers | B stated, not quantified | B quantified by the prospect in A's unit, with a horizon |
| G3 Measurable gap | 10 | No quantified A and B in the same unit | (no level 1) | Quantified A and B share a unit; `gap_value` computable |
| G4 Cost of the problem | 20 | Cost restated, but the prospect's own cost statement is not quantified and stays generic ("it's hard") | Cost stated by the prospect in a concrete domain, not quantified | Cost quantified by the prospect (money, hours, months lost) |
| G5 Restitution quality | 25 | (cannot happen once the gate passes) | PROBLEM and COST restated verbatim, but the formula is incomplete: A or B missing, not verbatim or not the selected ones; several blockers restated as what holds him back; or a blocker other than the selected P | The formula is complete: selected A, selected B and the single selected P, plus the COST, all verbatim (GB-31), with at least one key expression of 3 words or more or a prospect figure |
| G6 Validation | 25 | (cannot happen once the gate passes) | Confirmed (plain agreement), or corrected then confirmed | Confirmed with content of the prospect's own |

A gap that passes the gate therefore scores at least 25 (G5 = 1, G6 = 1).

**Two-quote rule.** G4 at level 2 needs the prospect's quantified cost quote; G5 at level 2 needs, for each of the four components, the sales quote and the prospect source quote containing the same key expression; G6 at level 2 needs the prospect quote showing the added content.

**Why these weights.** The restitution and its validation (50) are what makes the gap exist and be shared. The cost (20) is what will be weighed against the price. A, B and their common unit (30) make the gap measurable. Proposals, to validate.

# 6. How the system knows the sales succeeded

1. **The gap was said back to the prospect before the offer.** A restitution is identified by the bounding rules of Annex A, and its position before the first pitch and price is checked on turn numbers.
2. **It contains the problem and its cost, in the prospect's words.** Each restated component must contain the prospect's exact key expression, found by code in an earlier prospect turn and in the sales clause. A paraphrase does not count; a cost introduced for the first time by the sales does not count.
3. **The prospect validated it.** The validation is read on the prospect's response to that restitution, not to another question; a correction must be taken into account and re-validated.
4. **Otherwise the gap is absent.** The gate is binary and computed by code; a call cannot earn gap points from elements that were collected but never formalised.
5. **Three readings agree.** Restitution spans, components and validation come from three concordant passes or an arbitrated decision (Part C, C4).

# 7. Coaching diagnostics (displayed, never scored)

| Diagnostic | Computation |
|---|---|
| Absence reasons | Distribution of `no_restitution`, `restitution_after_pitch`, `problem_missing`, `cost_missing`, `not_validated` over the period |
| Collected but not formalised | For absent gaps: which components the prospect had stated (so the sales had the material) |
| Gap value | `gap_value` per call, with its unit |
| Binding vs wished horizon | Share of calls where B has a binding deadline |
| Restitution timing | Minutes between the last discovery question and the restitution; minutes between validation and first pitch |
| Corrections | Restitutions corrected by the prospect, and whether the sales restated after the correction |
| Formula conformity | Share of restitutions that state the selected A, B and single P; most frequent deviation (`A_not_selected`, `unit_mismatch`, `several_blockers`, `P_not_selected`) |
| Roadmap material | Number of distinct blockers ticked in P or I answers per call; share of calls with fewer than 3 (`roadmap_insufficient_blockers`, the Copilot warning) |

**Reference observed on Valentino (85 calls, June to October 2026, indirect indicators measured before this version):** point A quantified by the prospect in 93 % of calls with discovery, point B in 89 %, a restitution of at least two components before the pitch in 84 %. The presence of the cost in the restitution and the prospect's validation were not measured; the share of gaps that pass the absence gate is therefore unknown and is the first figure to establish.

# 8. Worked examples
Illustrative cases, adapted and shortened from real calls. In production, every piece of evidence is an exact quote checked against the transcript.

| Case | Verdict |
|---|---|
| Restitution before the pitch: "So you've been doing this for free for three years, it's costing you about 2K a month you could be earning, and you want it to replace your 4K salary. Did I get that right?" Prospect: "Yes, and honestly my husband doesn't believe in it either." | Gate passed (problem, cost, validation). G4 = 2; G5 = 2 only if each component reuses the prospect's exact words (the prospect had said "about 2K a month", "three years", "for free", "replace my salary"); G6 = 2 |
| Restitution: "So you want to go full time and what's stopping you is confidence." Prospect: "Exactly." No cost restated | Gap absent, reason `cost_missing` |
| Prospect said "I've lost two years doing nothing" during discovery, but the sales goes straight from discovery to "Let me share my screen" | Gap absent, reason `no_restitution` (diagnostic: problem and cost had been collected) |
| Complete restitution given after the program screen share | Gap absent, reason `restitution_after_pitch` |
| Restitution with problem and cost, then in the same turn: "…and how many hours a week could you put in?" Prospect: "Probably 10." | Gap absent, reason `not_validated` (the answer responds to the last question, not to the restitution) |
| Prospect corrects: "It's not 4K, more like 3K." Sales restates with 3K, prospect: "Exactly." | Gate passed on the second restitution, G6 = 1 |
| Prospect said "I'm very stressed, I basically don't have any motivation". Restitution: "…and it's been weighing on you, you're running on empty." Prospect: "Yeah." | COST paraphrased (no key expression of the prospect): not a component. If no other cost is restated verbatim, gap absent, reason `cost_missing` |
| Restitution introduces a cost the prospect never said ("and I imagine that's costing you sleep"), prospect: "Yeah." | Cost not traced to the prospect: if it is the only cost, gap absent, reason `cost_missing` |

# 9. Output contract

```
{
  "call_id": "…", "competence": "GAP", "rules_version": "GAP-1.3",
  "status": "scored", "verdict": "present", "absence_reason": null, "score": 80,
  "gap": {"A": {"value": 2500, "unit": "USD/month", "quote": "…", "turn": "T088"},
          "B": {"value": 10000, "unit": "USD/month", "horizon": "12 months", "binding": false,
                "quote": "…", "turn": "T102"},
          "gap_value": 7500,
          "problem": [{"type": "fear", "quote": "…", "turn": "T120"}],
          "cost": [{"domain": "money", "quantified": true, "quote": "…", "turn": "T126"}]},
  "restitution": {"span": ["T146", "T146"], "before_first_pitch": true, "before_first_price": true,
                  "components": {"PROBLEM": {"source": "T120", "key_expression": "…", "match": "verbatim"},
                                 "COST": {"source": "T126", "key_expression": "…", "match": "verbatim"},
                                 "A": {"source": "T088", "key_expression": "…", "match": "paraphrased"},
                                 "B": null},
                  "validation": {"outcome": "confirmed_with_content", "quote": "…", "turn": "T147"}},
  "formula": {"selected_A": {"quote": "…", "turn": "T088", "solicitation": "S"},
              "selected_B": {"quote": "…", "turn": "T102", "solicitation": "N", "same_unit": true},
              "selected_P": {"quote": "…", "turn": "T120", "solicitation": "P", "rule": "named_when_asked"},
              "conformity": {"A": true, "B": false, "single_P": true, "P_selected": true}},
  "roadmap": {"blockers": [{"object": "…", "quote": "…", "turn": "T120", "solicitation": "P"}],
              "count": 3, "warning": false},
  "items": [{"id": "G5", "level": 1}, {"id": "G6", "level": 2}],
  "concordance": "3/3"
}
```

# 10. Decisions to validate

- The absence rule as written: problem **and** cost, restated **and** validated, **before** the first pitch and price. Open point: should a restitution placed between the first pitch and the first price (the sales starts presenting, then steps back to restate the gap) pass the gate? Current proposal: no.
- The verbatim threshold of GB-22: one exact head word is enough for the gate; G5 level 2 requires at least one key expression of 3 words or more or a prospect figure. Alternative to test on the gold set: 3 consecutive words required for every component (stricter; on the calibration set it would turn several gaps judged present into absent).
- The allowed transformations of GB-22 (person shift, singular / plural, number normalisation) and nothing else.
- The gap formula (§2.1): A only from S and I answers, B only from N answers, P only from P answers. Open point: a desired state stated outside an N answer is currently recorded but not used as B.
- The tie-break of GB-30 when two blockers are mentioned equally often (current proposal: the one named first in answer to the stopping question, then the most recent).
- The roadmap count of GB-32: whether the selected P counts as one of the 3 blockers (current proposal: yes, every distinct blocker ticked in P or I answers counts) — à confirmer.
- The six items and their weights (10 / 10 / 10 / 20 / 25 / 25).
- Whether B without a horizon can reach level 2 (current proposal: no).
- The rule for follow-up calls (re-validation required in the call where the pitch resumes).
---

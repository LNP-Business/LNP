# Competence 1 · SPIN Discovery
_Scoring methodology: how the system measures whether the sales ran a discovery that made the prospect state their problem, its consequences and the value of solving it_

**Version:** Version 1.1 · 25 October 2026  
**Status:** Draft for validation by the methodology owner. Values marked "to validate" are proposals.  
**Scope:** Sales calls (first call and any call that reopens discovery). Sources: ALKIMIY SPIN bounding reference v1.0, ALKIMIY verbatim reference v2, analysis of 85 real calls.  
# 1. What this competence measures

**Definition.** SPIN Discovery is the sales' ability to lead the prospect, through questions, to say in their own words: their current situation, what is not working, what it costs them outside the problem itself, and what solving it would be worth to them.

**What success means, in one sentence.** The sales succeeded when the prospect, not the sales, has verbalised a measurable starting point, at least one problem, at least two consequences of that problem in other areas of life (one of them quantified), and a desired state with the value they attach to it, and when these came out of chains of questions that dug into the same problem.

**The governing principle.** The system measures the **effect** of the questions on the prospect, never the number of questions. A question earns nothing by itself; only what the prospect says in response does. This follows the SPIN research (Rackham, Huthwaite: in complex sales, implication and need-payoff questions predict progress because they make the buyer state the problem's consequences and the value of solving it) and the ALKIMIY guard: **the letter of a question never produces points.** If question counts entered the score, sales would fire questions to fill the counter.

The analysis therefore has two layers that are never mixed:

| Layer | What it reads | What it produces | Scored? |
|---|---|---|---|
| Letter layer | The sales' question | S, P, I, N or OUT, with the gate and the evidence | No. Coaching diagnostics only (Part B §8) |
| Effect layer | The prospect's answer | Atoms: SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE | Yes. The SPIN score (Part B §6) |

# Part A · Definitions
The rules that find each element in a raw transcript (units, start and end markers, segmentation, exclusions and minimal pairs) are in **Annex A · Bounding rules**. **Annex B** gives real annotated cases for calibration. A verdict that cannot be reached with these rules goes to the arbiter as an uncovered case.

# 2. Units and vocabulary

**Solicitation.** Any proposition of the sales that requests an answer from the prospect. It is recognised by any one of three signals: a final question mark; an interrogative form without a question mark (inversion, interrogative word at the head of the clause); an imperative of request ("tell me", "walk me through", "help me understand", "describe"). An elliptical form ("And the revenue?") is a solicitation.

**Segmentation rules.**
- **SEG-1.** One interrogative clause, one solicitation. Three questions in one turn are three units, numbered `Q007.1`, `Q007.2`, `Q007.3`.
- **SEG-2.** Two coordinated interrogatives are two units if the prospect can answer one without the other ("How much is it stuck at, and since when?"). Complements attached to one question do not split it ("what does it cost you, on your month, on your family?").
- **SEG-3.** An alternative ("is it the price or the timing?") is one unit.
- **SEG-4.** A validation tail ("…, right?", "…, no?", "…, is that it?", "does that make sense?") belongs to the clause it closes and is never counted separately.
- **SEG-5.** A declarative preamble in the same turn is not a solicitation, but its words count for anchoring.
- **SEG-6.** An interrupted question counts if it is intelligible and the prospect answers it; otherwise it is kept with the attribute `debris` and excluded.
- **SEG-7.** Backchannel ("hmm?", "oh yeah?", "really?") spoken over the prospect is never a solicitation.
- **SEG-8.** Only the sales produces solicitations. A question of the prospect is never coded.

**Discovery perimeter.** Only solicitations inside the perimeter are coded:
- **Start:** the first solicitation about the prospect's situation, goals or problems that is neither social (where are you calling from, family small talk), nor logistic, nor framing ("here is how the call will go").
- **End:** the first pitch start or the first price, whichever comes first (Pitch methodology, Annex A, PB-1 and PB-3). A restitution of the gap does **not** end the perimeter: questions asked after a restitution and before the pitch are still discovery (see Annex A, SB-1, and the decision in §11).
- **No reopening (v1.2, SB-34):** the discovery ends at the first pitch start or price and never reopens; nothing said after it is SPIN.

**Letters.**

| Letter | The question requests… |
|---|---|
| S · Situation | a neutral fact that can be verified today: a number, a duration, a name, a status, a description of what is done today |
| P · Problem | the difficulty itself, formulated by the prospect: a lack, a blocker, a loss, a dissatisfaction, a failed attempt |
| I · Implication | what the problem does: a consequence outside the problem's own domain (money, time, clients, family, health, self-belief, future) |
| N · Need-payoff | a desired state that does not exist yet, or the value the prospect attaches to solving the problem, said by the prospect |
| OUT | an agreement, a choice in the sales' list, information about the offer, the load of a solution, or nothing of substance |

**Domain.** A unit of loss: money, hours, clients, staff, sleep, health, reputation, family, self-belief. A time or place perimeter ("the rest of the week", "at home in the evening") is not a domain.

**Atoms (effect layer).** What the prospect produced in an answer.

| Atom | The prospect states… | Typically produced by |
|---|---|---|
| SITUATION | a neutral fact about today | S |
| PAIN | something that is not working, in their words | P |
| BLOCKER | what prevents them from reaching their goal | P |
| IMPACT | a consequence of the problem in another domain | I |
| DESIRE | a desired future state | N |
| VALUE | why solving it matters, what it would change, what they would do with it | N |

An atom is attached to the question that produced it, but **never changes the letter of that question**. A situation question that receives a quantified pain stays an S; an implication question answered "I don't know" stays an I.

# 3. How a question gets its letter

The model does not choose a letter. It answers five gates in a fixed order, each with an exact quote. The code applies the order: **the first "yes" wins.** At each gate, the exclusion is evaluated before the positive test.

| Gate | Closed question asked to the model | If yes |
|---|---|---|
| 0 Routing | Does it ask to confirm a complete restitution of the gap, or ask for a purchase decision? | `VALIDATION_REQUEST` or `DECISION_REQUEST`, not coded |
| 1 OUT | Is the expected answer only an agreement with what the sales just asserted, a choice among options listed by the sales, information or an opinion about the sales' offer, the estimated load of a solution, or nothing of substance? | OUT, with its reason |
| 2 S | Is the expected answer a neutral fact the prospect could verify today? (No if it asks them to name a difficulty, a consequence or a state that does not exist yet) | S |
| 3 N | Is the expected answer a desired state that does not exist yet, or the value of the resolution? (No if the question already contains that state or value, names a load, or bears on the offer; no if the antecedent is the problem continuing) | N |
| 4 I | Is the expected answer a consequence of the problem, in a domain other than the problem's own? | I |
| 5 P | Is the expected answer the difficulty itself, formulated by the prospect? (No if the sales already named it in their own words) | P |
| none | No gate answered yes | OUT, reason `absent` (a system defect, never counted against the sales) |

**OUT reasons, in priority order:** `nothing` (social, logistic, framing, rhetorical, "does that make sense?"), `offer_info`, `solution_load`, `sales_list`, `agreement`, `absent`. A need-payoff whose content is supplied by the sales ("so your goal is probably about $10,000, right?") is OUT `agreement` with the tag `closed_need_payoff`.

**Hard rules enforced by code, overriding the model:** a final validation tail always gives OUT `agreement`; a desired state contained in the question always gives OUT `agreement` + `closed_need_payoff`; a load of a solution always gives OUT `solution_load`; a value requested about the offer always gives OUT `offer_info`.

# Part B · Mechanism and scoring

# 4. What the system extracts from each answer

For each coded solicitation, the model receives the question, the prospect's next turn (and the following prospect turn if the first is shorter than 6 words and the sales did not speak in between), and answers these closed questions, each positive answer with an exact quote **from the prospect turn**:

| Field | Closed question | Allowed values |
|---|---|---|
| `atoms` | Which atoms does the answer contain? | List of SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE, or empty |
| `atom.quote` | Exact passage stating the atom | 2 to 40 words, prospect turn |
| `atom.quantified` | Does the passage attach a number, amount, duration or frequency to it? | yes / no |
| `atom.domain` | For IMPACT: which domain? | money, time, clients, family, health, self_belief, future, other |
| `atom.problem_domain` | For IMPACT: domain of the problem it comes from | same list |
| `atom.prompted_by_sales` | Was the content stated by the sales first and only approved? | yes / no |
| `atom.object` | Short label of the problem it relates to (3 to 6 words) | free text, used to build chains |
| `followed_up` | Does the next sales solicitation reuse a word or number from this answer? | computed by code (lexical overlap of content words of 4+ letters, excluding a stop list) |

**Decision rules on atoms (code):**
- An atom with `prompted_by_sales = yes` is discarded.
- An IMPACT whose domain equals the problem's domain is reclassified PAIN (it re-describes the problem).
- A revenue figure is a SITUATION, never an IMPACT: a current income is not a cost of the problem. Only what the problem makes the prospect lose counts as IMPACT.
- An answer that only contains agreement produces no atom.
- Two atoms are **distinct** if their quotes do not overlap and, for IMPACT, their domains differ.

**Chains.** A chain is a run of consecutive coded solicitations on the same `atom.object`, opened by a P (or an N on the desire side) whose answer produced a PAIN or BLOCKER. A chain is **deep** when it contains at least one I whose answer produced an IMPACT, followed by at least one more I or N on the same object whose answer produced an IMPACT, DESIRE or VALUE, and the sales' solicitations in the chain are `followed_up` on the previous answer.

# 5. Applicability

| Situation | SPIN status |
|---|---|
| Discovery perimeter exists with at least 5 coded solicitations | `scored` |
| Follow-up call that only reopens discovery with fewer than 5 coded solicitations | `not_applicable` |
| No discovery (technical call, reschedule, pure follow-up) | `not_applicable` |
| More than 5 % of perimeter solicitations with OUT `absent` | `excluded` (health) |

# 6. The SPIN score

Five items, each scored 0, 1 or 2 from the atoms of the call. **Call score = Σ (weight × level / 2)**, rounded to the nearest integer, on 100.

| Item | Weight | Level 0 | Level 1 | Level 2 |
|---|---|---|---|---|
| D1 Baseline | 15 | No SITUATION atom related to the goal | At least one SITUATION atom related to the goal, not quantified | At least two quantified SITUATION atoms related to the goal (for example current revenue and hours per week) |
| D2 Problem | 20 | No PAIN or BLOCKER atom | One distinct PAIN or BLOCKER | Two or more distinct PAIN/BLOCKER atoms, or one with its cause stated by the prospect |
| D3 Implication | 30 | No IMPACT atom | One IMPACT atom | Two or more IMPACT atoms in distinct domains, at least one quantified |
| D4 Need-payoff | 20 | No DESIRE or VALUE atom | A DESIRE atom (desired state) | A DESIRE atom and a VALUE atom (why it matters, what it would change) |
| D5 Depth | 15 | No deep chain | One deep chain | Two or more deep chains on different objects |

"Related to the goal": the SITUATION atom bears on the same dimension as a DESIRE stated in the call (revenue, clients, time, career status). If no DESIRE exists, any quantified SITUATION atom counts.

**Two-quote rule.** Level 2 always needs at least two distinct supporting quotes. D5 level 2 needs the quotes of both chains.

**Why these weights.** Implication carries the most weight (30) because it is the step that turns a stated problem into a felt cost; it is also the step most often missing. Baseline and depth (15 each) are enablers. The weights are proposals, to validate.

**Item rates on the screen.** For each item: share of scored calls at level 2, share at level ≥ 1.

# 7. How the system knows the sales succeeded

The system never decides "the discovery was good" from the sales' intent or the number of questions. It concludes success only from facts it can quote:

1. **The prospect said it.** Each item is supported by a prospect quote, verified verbatim in the transcript (Part C, C3).
2. **The sales caused it.** The atom is attached to a sales solicitation that preceded it in the perimeter; an atom volunteered by the prospect outside any discovery question still counts for D1 to D4 (the prospect said it), but never for D5.
3. **It was not put in the prospect's mouth.** Prompted content is discarded; agreement alone produces nothing.
4. **It went deep, not wide.** D5 requires chains where each question reuses the prospect's previous answer and moves from problem to consequence to value on the same object.
5. **Three readings agree.** Every atom and every letter comes from three concordant passes or an arbitrated decision (C4).

# 8. Coaching diagnostics (displayed, never scored)

These indicators explain the score; they never enter it.

| Diagnostic | Computation | Reference |
|---|---|---|
| Letter distribution | Share of S, P, I, N among coded S/P/I/N solicitations | — |
| Call budget | S and P: ceiling of 2 per call. I and N: floor of 3 per call | ALKIMIY SPIN reference |
| Problem followed by implication | Share of P solicitations whose next coded S/P/I/N solicitation is an I | Target 50 % (to validate) |
| Prompted answers | Share of perimeter solicitations with OUT `agreement` | Target ≤ 15 % (to validate) |
| Closed need-payoff | Count of `closed_need_payoff` tags | Target 0 |
| Yield per letter | Share of solicitations of a letter that produced at least one atom of the expected kind | — |
| Follow-up rate | Share of solicitations followed by a `followed_up` sales solicitation | — |

**Baseline observed on Valentino (85 calls, June to October 2026):** S 28 %, P 24 %, I 12 %, N 36 % of 2,033 coded questions; 2.8 implications per call; 23 calls without any implication question; a P followed by an I in 10 % of cases; 590 prompted questions (16 % of all bounded questions). These figures come from the letter layer and serve as a starting reference for coaching, not as a score.

# 8b. Registers of the questions (displayed, never scored)

Since v1.2 every coded question of the discovery, before the first pitch start or price, is placed in one register:
**Financial** (money, clients), **Time & load** (time, family), **Identity & status** (future), **Mental & emotional**
(self-belief, health) or **Other**. The model names the domain the question asks about, with an exact quote; the code
maps it to the register (Annex A, SB-26 to SB-33). Since v1.3 an open question, one that names none of the seven
domains, takes the register of the prospect's answer to it, the effect it produced (SB-35, Romain 2026-10-29). Questions after the pitch (not SPIN at all, SB-34), OUT
solicitations and questions outside the perimeter have no register. The register tells the sales which ground the discovery covered; it never produces
points. Target reliability: ≥ 92 % of questions in the right register (SB-33).

# 9. Worked examples
Illustrative cases, adapted and shortened from real calls. In production, every piece of evidence is an exact quote checked against the transcript.

| Prospect context | Sales question | Letter | Prospect answer | Atoms | Item effect |
|---|---|---|---|---|---|
| "I only put in about 15 hours a week" | "How has that impacted you on a personal level?" | I (open domain) | "It's depressing. My motivation is gone." | IMPACT (domain: self_belief) | D3 +1 atom |
| "I lost my job two years ago" | "What has that cost you since, in money?" | I | "Probably 40K, we're in debt now." | IMPACT (money, quantified) | D3 quantified |
| Talking about her goal | "So your goal is probably about $10,000 then, right?" | OUT agreement, `closed_need_payoff` | "Yes." | none | nothing; diagnostic counter +1 |
| Goal stated: 5K a month | "And at 5K a month, what does your life look like?" | N | "I can stop the admin job and be home for the kids." | DESIRE, VALUE | D4 level 2 |
| Hours per week stated | "How many hours a week do you work on it?" | S | "About 15." | SITUATION (quantified) | D1 |
| Problem: no clients | "Is it more the marketing or the pricing?" | OUT sales_list | "The marketing." | none (the content came from the sales' list) | nothing |

# 10. Output contract

```
{
  "call_id": "…", "competence": "SPIN", "rules_version": "SPIN-1.3",
  "status": "scored",
  "score": 64,
  "items": [
    {"id": "D3", "level": 1, "evidence": [
      {"turn": "T112", "ts": "18:42", "speaker": "PROSPECT",
       "quote": "it's depressing", "atom": "IMPACT", "domain": "self_belief",
       "question_id": "Q111.1", "question_letter": "I"}]}
  ],
  "diagnostics": {"letters": {"S": 9, "P": 6, "I": 2, "N": 8}, "p_followed_by_i": 0.17,
                  "prompted_share": 0.14, "closed_need_payoff": 1},
  "concordance": "3/3", "health": {"absent_share": 0.02},
  "solicitations": [{"id": "Q111.1", "letter": "I", "register": "mental_emotional", "register_status": "verified",
                     "register_basis": "named", "register_domain": "self_belief", "register_quote": "how does that make you feel"}],
  "registers": {"counts": {"financial": 9, "time_load": 3, "identity_status": 2, "mental_emotional": 5, "other": 4},
                "questions": 23, "verified": 22, "to_review": 0, "agreement": 0.957, "threshold": 0.92, "flags": []}
}
```

# 11. Decisions to validate

- Registers (v1.2): the word lists of SB-30. Decided 2026-10-27 (Romain): OUT solicitations get no register; SPIN stops
  at the pitch (SB-34); no human-labelled verification set for now.

- The five items and their weights (15 / 20 / 30 / 20 / 15).
- The thresholds of the diagnostics (P followed by I ≥ 50 %, prompted ≤ 15 %).
- Whether an atom volunteered without a question should count for D1 to D4 (current proposal: yes) or only atoms produced by a question.
- The minimum of 5 coded solicitations for a call to be scored.
- The end of the perimeter at the first pitch or price, instead of the first restitution (change from the SPIN bounding reference v1.0, §6). Reason: on the 85 calls analysed, annotators disagreed on whether a two-component restitution closes discovery, which moved the border without changing the questions asked.
---

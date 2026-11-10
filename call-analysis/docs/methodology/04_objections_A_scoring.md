# Competence 4 · Objection Removal
_Scoring methodology: how the system measures whether the sales prevented objections upstream and removed those raised, until the prospect, in their own words, no longer holds them_

**Version:** Version 1.1 · 25 October 2026  
**Status:** Draft for validation by the methodology owner. Values marked "to validate" are proposals.  
**Scope:** All sales calls of a cycle (first call, follow-ups, decision calls). Sources: LNP verbatim reference v2 (objection triplet, anxiety, inertia, past attempt, decision circuit), analysis of 95 real calls.  
# 1. What this competence measures

**Definition.** Objection removal covers two things: **preventing** the resistances that can be anticipated (decision circuit, budget, timing) before the price, and **removing** each resistance the prospect raises after the first price (OB-27), with the gesture that fits its nature, until the prospect states that it no longer holds.

**What success means, in one sentence.** The sales succeeded when every resistance raised was identified for what it is (objection, anxiety or inertia), received the matching gesture, was acknowledged, isolated and explored before being answered, and ended with the prospect saying in their own words that it was resolved, without coming back later in the call or the cycle; and when the decision circuit and budget were qualified before the price.

**The distinction that governs everything.** Three resistances look alike and call for opposite gestures (verbatim reference v2, §6.3). Treating an anxiety as an objection means arguing against someone who doubts themselves, the surest way to lose a sale already won. Treating an inertia as an objection answers a question the prospect did not ask.

| Nature | The prospect doubts… | Example | Expected gesture |
|---|---|---|---|
| Objection | the offer, the price, the terms, the company, the sales; or a resource constraint (time, money) | "It's a lot of money." "I'm not sure it works." | Treat: acknowledge, isolate, explore, answer |
| Anxiety · capability | themselves: not managing, not lasting | "I'm not sure I can do it." | Reassure with framework and support, never with arguments about the offer |
| Anxiety · choice | their decision: choosing wrong, being fooled | "What if I get burned again?" | Reassure with proof, reversibility, guarantee |
| Inertia | nothing about the future: attachment to the present | "It's not the right moment." "It's fine as it is." | Make the cost of doing nothing explicit and quantified, in the prospect's words |

A **past attempt** ("I already paid for a course and did nothing with it") is not a resistance in itself but predicts one; it is used for prevention (§5, R2).

# Part A · Definitions
The rules that find each element in a raw transcript (units, start and end markers, segmentation, exclusions and minimal pairs) are in **Annex A · Bounding rules**. **Annex B** gives real annotated cases for calibration. A verdict that cannot be reached with these rules goes to the arbiter as an uncovered case.

# 2. Units

**Resistance episode.** Starts at a prospect passage expressing an objection, anxiety or inertia (extracted under the verbatim reference rules, with its exclusions: a request for information such as "how long is it?" is not an objection; a delay with a verifiable external reason, "I'm moving in January", is a decision-circuit deadline, not inertia). The episode contains:
1. the **resistance** (prospect quote);
2. the **sales response**: every sales turn until the topic changes (empty if none);
3. the **prospect reaction**: the prospect's turns after the response, until the topic changes (empty if none).

**Topic change.** The episode ends when the sales moves to another subject (a new question or statement unrelated to the resistance), or when the call ends. The model marks the turn; the code counts the turns.

**Same resistance.** Two passages belong to the same resistance when they share nature and theme (for example objection · price). A resistance raised again after its episode ended is a **recurrence**; it opens a new episode linked to the first one.

**Gesture steps (for objections).**
- **Acknowledge:** the first sales turn after the resistance receives it without contradiction (no immediate "but", no defence, no counter-argument in the first sentence).
- **Isolate:** the sales checks whether this is the only thing standing in the way ("Apart from the money, is there anything else that would stop you?").
- **Explore:** the sales asks an open question about the resistance itself, and the prospect answers with content ("When you say it's a lot, a lot compared to what?").
- **Answer:** the sales responds with information, proof or a reframing tied to what the prospect said while exploring.

**Matching gesture (for anxiety and inertia).**
- Anxiety · capability: the response describes the support, framework, steps or accompaniment that remove the risk of not managing. Arguments about the price or the content of the offer do not match.
- Anxiety · choice: the response provides proof (comparable student results), reversibility or a guarantee.
- Inertia: the response leads the prospect to state the cost of staying where they are, in their own words, ideally quantified ("If nothing changes, where are you in a year?" answered by the prospect).

**Resolution levels (read on the prospect reaction).**
- **Resolved:** the prospect states in their own words that the resistance no longer holds, reformulates it as answered, or moves forward on their own initiative ("Okay, if I can pay in instalments then it's doable for me").
- **Acknowledged:** the prospect accepts without content ("okay", "I see", "makes sense").
- **Latent:** no prospect reaction, or the sales changed the subject within 2 turns of the resistance without any reaction (verbatim reference rule). The system counts it as handled, but the prospect never confirmed: it is the one that comes back as "I'll think about it".
- **Persisting:** the prospect repeats or reinforces the resistance.

# Part B · Mechanism and scoring

# 3. What the system extracts

| Field | Closed question to the model | Evidence |
|---|---|---|
| `resistances` | Which prospect passages express an objection, an anxiety or an inertia? Nature, sub-type (price, money available, time, trust in offer, relevance, co-decider, timing, capability, choice) | Exact prospect quote, turn |
| `response_turns` | Which sales turns respond to it, until the topic changes? | Turn numbers, exact quotes |
| `acknowledge` | Does the first response turn receive the resistance without contradiction? | yes / no, quote |
| `isolate` | Does the sales check whether it is the only obstacle? | yes / no, quote |
| `explore` | Does the sales ask an open question about the resistance? Does the prospect answer with content? | quotes |
| `gesture_match` | For anxiety and inertia: does the response use the matching gesture defined in §2? | yes / partial / no, quote |
| `reaction` | Resolution level: resolved, acknowledged, latent, persisting | Prospect quote (none for latent) |
| `prompted_resolution` | Was the "resolution" content stated by the sales and only approved? | yes / no |

**Computed by code:** turns between the resistance and the topic change; latent rule (topic change within 2 turns and no prospect reaction); recurrence (same nature and theme later in the call, or in the next call of the same cycle); position of each episode relative to the first price.

**Prevention fields (extracted once per call):**

| Field | Closed question | Evidence |
|---|---|---|
| `decision_maker` | Did the prospect state who decides, before the first price? | Prospect quote |
| `influencers` | Did the prospect state whether someone else weighs on the decision (spouse, partner, family), before the first price? | Prospect quote |
| `budget` | Did the prospect state their budget or financial capacity themselves, before the first price? | Prospect quote |
| `deadline` | Did the prospect state a binding deadline or a wished horizon, before the first price? | Prospect quote, binding / wished |
| `past_attempt_defused` | When the prospect mentioned a failed past attempt, did the sales explore what did not work and state, before the price, what is different this time? | Sales and prospect quotes |

A supposition of the sales not confirmed by the prospect ("I imagine you're the one deciding?" with no answer) does not count.

# 4. Applicability

| Situation | Status |
|---|---|
| At least one resistance episode | Handling: `scored`. Prevention: `scored` if a price was given in the call |
| No resistance, price given | Handling: `not_applicable`. Prevention: `scored`. Call score = prevention score |
| No resistance, no price | `not_applicable` |

# 5. The Objection Removal score

**Call score = 70 % × Handling score + 30 % × Prevention score** when both apply; otherwise the one that applies, on 100.

### 5.1 Handling score (per episode, then averaged)

Each episode gets five items scored 0, 1 or 2. **Episode score = Σ (weight × level / 2)** on 100. **Handling score = mean of episode scores**, each episode weighted by its nature: anxiety and inertia episodes weigh 1.5, objection episodes 1 (they are the ones most often mishandled; proposal, to validate).

| Item | Weight | Level 0 | Level 1 | Level 2 |
|---|---|---|---|---|
| H1 Right gesture | 25 | Gesture of another nature (argues against an anxiety, answers an inertia with features) | Partial match | Matching gesture as defined in §2 |
| H2 Acknowledge | 10 | Contradiction or defence in the first response turn | — | Received without contradiction |
| H3 Isolate and explore | 20 | Neither | One of the two | Both, and the prospect answered the exploration with content |
| H4 Resolution | 35 | Latent or persisting | Acknowledged | Resolved, in the prospect's own words, not prompted |
| H5 No recurrence | 10 | Recurs later in the call or in the next call of the cycle | — | Does not recur |

For anxiety and inertia, H3 reads "explore" only (isolating an anxiety is not required): level 2 if the sales explored and the prospect answered with content, level 1 if explored without content, 0 otherwise.

H5 is provisional until the next call of the cycle is analysed or the cycle closes; until then it is scored on the current call only.

### 5.2 Prevention score

| Item | Weight | Level 0 | Level 1 | Level 2 |
|---|---|---|---|---|
| R1 Decision circuit | 40 | Neither decision maker nor influencers known before the price | One of the two | Both stated by the prospect before the price |
| R2 Budget and deadline | 40 | Neither | One of the two | Budget stated by the prospect and a deadline (binding counts double in diagnostics) before the price |
| R3 Past attempt defused | 20 | A failed past attempt was mentioned and not addressed before the price | Explored, but what differs this time not stated | Explored and the difference stated before the price; or no past attempt mentioned (scored 2, flagged `not_triggered`) |

**Why these weights.** Resolution (35 % of an episode) is the only proof the resistance is gone; the right gesture (25 %) decides whether resolution is even possible. Prevention weighs 30 % of the call because a resistance avoided is worth more than a resistance removed, but it can only be read on facts stated before the price. Proposals, to validate.

# 6. How the system knows the sales succeeded

1. **Resolution is said by the prospect.** H4 at level 2 requires a prospect quote showing the resistance no longer holds; an "okay" is level 1; silence is level 0. Content first stated by the sales and approved is discarded.
2. **A latent objection is detected mechanically.** Topic change within 2 turns with no prospect reaction is computed from turn numbers, not judged.
3. **The nature is classified before the gesture is judged.** The model classifies objection, anxiety or inertia with the boundary tests of the verbatim reference (subject of the doubt: the offer → objection; themselves or their decision → anxiety; attachment to the present → inertia). The gesture is then judged against the nature, never against a generic script.
4. **Recurrence closes the loop.** A resistance that comes back means the earlier "resolution" was not one; H5 and the linked episodes show it.
5. **Prevention is dated.** Decision circuit and budget only count if stated before the first price, checked on turn numbers.

# 7. Coaching diagnostics (displayed, never scored)

| Diagnostic | Computation |
|---|---|
| Resistance mix | Share of objections, anxieties (capability / choice), inertias, by theme |
| Latent rate | Share of episodes ending latent |
| Mismatch rate | Share of anxiety and inertia episodes answered with an objection gesture |
| Time to resolution | Turns and minutes from resistance to resolution |
| Resistances after price | Share of episodes opened after the first price (high values point to weak prevention) |
| Most recurrent themes | The themes that come back across calls of the same cycle |

**Reference observed on Valentino (95 calls, verbatim extraction):** 81 % of objections received a prospect reaction after the response; 52 % of calls with an objection left at least one latent; 70 % of calls with an objection ended with a sale or a dated follow-up. The most frequent themes were money not available, timing, price, offer fit and financing refused. Nature-gesture matching and isolation were not measured in that first analysis.

# 8. Worked examples
Illustrative cases, adapted and shortened from real calls. In production, every piece of evidence is an exact quote checked against the transcript.

| Case | Nature | Verdict |
|---|---|---|
| "I don't have the money right now." Sales: "I hear you. Apart from the money, is there anything else holding you back?" Prospect: "No, it's really just that." Sales explores, offers instalments. Prospect: "Okay, at 900 a month I can make that work." | Objection · money available | H1 2, H2 2, H3 2, H4 2 |
| "I'm scared I won't be good enough." Sales: "Our price is actually very competitive." | Anxiety · capability | H1 0 (argues the offer against a self-doubt) |
| "I'm scared I won't be good enough." Sales: "What makes you feel that?" … "This is why every project is reviewed by your mentor before it goes to a client." Prospect: "That would help, I wouldn't be alone." | Anxiety · capability | H1 2, H3 2, H4 2 |
| "Maybe after the holidays, it's not the right time." Sales: "If nothing changes until then, where are you in January?" Prospect: "Same place, still stuck in this job, another 3 months lost." | Inertia | H1 2 (cost of inaction stated by the prospect) |
| "I need to talk to my husband." Sales moves straight to booking a slot | Objection · co-decider | H4 0 if no prospect reaction on the substance (latent); and R1 shows the influencer was not known before the price |
| "It's a lot of money" in call 1, resolved; comes back in call 2 | Objection · price | Call 1 H5 = 0 once call 2 is analysed |

# 9. Output contract

```
{
  "call_id": "…", "competence": "OBJECTIONS", "rules_version": "OBJ-1.0",
  "status": "scored", "score": 62, "handling_score": 58, "prevention_score": 70,
  "episodes": [
    {"id": "E1", "nature": "objection", "subtype": "money_available",
     "resistance": {"turn": "T231", "quote": "…"},
     "response_turns": ["T232", "T234"], "turns_to_topic_change": 4,
     "acknowledge": true, "isolate": true, "explore": {"asked": true, "answered_with_content": true},
     "gesture_match": "yes",
     "reaction": {"level": "resolved", "turn": "T237", "quote": "…"},
     "after_first_price": true, "recurrence_of": null,
     "items": [{"id": "H4", "level": 2}], "score": 90}
  ],
  "prevention": {"decision_maker": {"turn": "T060", "quote": "…"}, "influencers": null,
                 "budget": {"turn": "T145", "quote": "…"}, "deadline": null,
                 "items": [{"id": "R1", "level": 1}]},
  "concordance": "3/3"
}
```

# 10. Decisions to validate

- The 70 / 30 split between handling and prevention.
- The episode weights (25 / 10 / 20 / 35 / 10) and the 1.5 weight of anxiety and inertia episodes.
- Whether a "no resistance" call should score its prevention alone (current proposal) or be marked not applicable.
- The latent rule (topic change within 2 turns without reaction), taken from the verbatim reference.
---

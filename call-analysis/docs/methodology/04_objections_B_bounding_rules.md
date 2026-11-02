# Annex A · Bounding rules for objections

This annex says how the system finds, in a raw transcript, each resistance, its nature, the episode that follows it, the sales' gestures and the prospect's resolution. A rule that is not written here does not exist: an uncovered case goes to the arbiter with the label `uncovered_case` and becomes a new numbered rule.

## A1. Detecting a resistance

**OB-1 · Candidate.** The inventory (code) flags a prospect passage as a resistance candidate when it contains a marker of the lists below. Markers only nominate candidates; the model decides with the boundary tests (OB-3). The model may also nominate a resistance without any marker, with its quote.

| Nature | Typical markers (English calls) |
|---|---|
| Objection · price, money available | "too expensive", "a lot of money", "can't afford", "don't have the money", "out of my budget", "my credit", "financing" |
| Objection · trust in offer, relevance | "not sure it works", "I've seen programs like this", "is it accredited", "I already know how to design", "I don't need…" |
| Objection · time | "I don't have time", "with my job", "with the kids" (as a constraint on following the program) |
| Objection · co-decider | "talk to my husband / wife / partner", "we decide together", "I need to check with" |
| Anxiety · capability | "I'm scared", "I'm afraid", "I don't know if I can", "I'm not good enough", "I'll quit", "I always give up" |
| Anxiety · choice | "what if it doesn't work", "I got burned before", "I don't want to make a mistake", "how do I know" |
| Inertia | "not the right time", "maybe later", "after the holidays", "I'm okay for now", "I need to think about it" (without a reason), "let me sleep on it" |

**OB-2 · Exclusions at detection.**
- A request for information ("how long is it?", "how many calls a week?", "is there a payment plan?") is not a resistance, unless the prospect states a reserve in the same turn.
- A delay with a verifiable external reason ("I'm moving in January", "my severance ends in March") is a decision-circuit deadline, not inertia.
- A decision-circuit fact stated neutrally during discovery ("my husband handles the money") is circuit information, not an objection. It becomes an objection when it is put forward as a reason not to decide now.
- A conditional acceptance ("if I can pay monthly, then yes") is a decision criterion, not a resistance.
- "I'll think about it" with a reason ("I need to see my numbers") is classified by the reason; without a reason, inertia.

**OB-3 · Nature: boundary tests.** In this order:
1. Is the subject of the doubt the offer, its price or terms, the company, the sales, or a resource the prospect lacks (time, money, a co-decider's agreement)? → **objection**.
2. Is the subject the prospect themselves (not managing, not lasting) → **anxiety · capability**; or their decision (choosing wrong, being fooled) → **anxiety · choice**.
3. Is it attachment to the present, or postponement without an external reason? → **inertia**.
"I'm not sure it works" is an objection; "I'm not sure I can do it" is an anxiety; "it's fine as it is" is an inertia.

**OB-4 · Mixed passages.** One prospect passage expressing two natures ("I can't afford it and honestly I'm scared I'll quit again") opens **two episodes**, one per nature, sharing the same start turn. Each is judged on its own gesture.

**OB-5 · One resistance over several turns.** Consecutive prospect turns expressing the same resistance, separated only by sales backchannel ("mm-hmm", "I hear you") of 5 words or fewer, form one resistance.

## A2. Bounding the episode

**OB-6 · Start.** The first turn of the resistance.

**OB-7 · Response.** Every sales turn after the resistance until the topic change.

**OB-8 · Topic change.** The first sales turn that (a) contains no content word of the resistance or of the response so far, and (b) introduces a new subject: a new discovery question, a new offer segment, logistics, or the close. Continuation markers ("so", "and", "also", "the other thing about that") with a reused word are not a topic change. The end of the call ends any open episode.

**OB-9 · Reaction.** The prospect turns between the first sales response and the topic change. If the prospect raises a new resistance inside the episode, the current episode ends and a new one starts.

**OB-10 · Latent.** An episode is latent when the topic changes within 2 turns of the resistance (the resistance turn, at most one sales turn, then the topic change) and the prospect has made no reaction of 6 words or more. Computed by code from turn numbers.

**OB-11 · Recurrence.** A resistance of the same nature and theme (subtype) that appears after an earlier episode ended, in the same call or in the next call of the same cycle, opens a new episode linked to the earlier one (`recurrence_of`).

**OB-12 · Speakers.** Resistances from a co-decider (`OTHER`) are episodes like the prospect's. Turns marked `attribution_doubtful` are excluded.

## A3. Detecting the gestures

**OB-13 · Acknowledge.** Read on the first sentence of the first response turn.
- Acknowledged: a receiving marker without contradiction ("I hear you", "that makes total sense", "totally fair", "I understand", "good question", "I appreciate you sharing that") or a neutral reformulation of the resistance.
- Not acknowledged: the first sentence starts with or contains a contradiction ("but", "actually", "no,", "that's not true", "the thing is", "I disagree") or a counter-argument.

**OB-14 · Isolate.** A sales solicitation that asks whether the resistance is the only obstacle: "apart from…", "other than…", "is that the only thing", "if we solved that, would you…", "is there anything else stopping you". Must be in the episode, before the answer.

**OB-15 · Explore.** A sales solicitation that asks the prospect to open up the resistance itself (an open question that reuses a word of the resistance): "when you say it's a lot, a lot compared to what?", "what makes you feel that?", "what happened last time?". Answered with content if the prospect's next turn adds something beyond agreement.

**OB-16 · Matching gesture.** Judged against the nature (methodology §2):
- objection → acknowledge, isolate, explore, then an answer tied to what the prospect said;
- anxiety · capability → description of the support, framework, steps or accompaniment that remove the risk of not managing;
- anxiety · choice → proof (comparable students' results), reversibility, guarantee;
- inertia → a question leading the prospect to state the cost of staying where they are, answered by the prospect.
"Partial" when the response contains the matching gesture and also an argument of the wrong kind (for example reassurance followed by a price argument).

**OB-17 · Resolution.** Read on the reaction (OB-9):
- **resolved:** the prospect states that the resistance no longer holds ("okay, at 900 a month I can do that"), reformulates it as answered, or moves forward on their own initiative (asks how to start, proposes a date);
- **acknowledged:** agreement without content ("okay", "I see", "makes sense");
- **persisting:** repeats or reinforces the resistance;
- **latent:** OB-10.
A "resolution" whose content was first stated by the sales and only approved ("so the payment plan solves it for you, right?" → "yeah") is **acknowledged**, not resolved.

## A4. Detecting prevention facts

**OB-18 · Before the price.** Prevention facts (decision maker, influencers, budget, deadline, past attempt defused) count only if stated by the prospect in a turn before the first price (Pitch annex, PB-3).

**OB-19 · Supposition.** A sales supposition not confirmed with content ("I assume you make the decisions?" → "mm-hmm") does not establish the fact; "yes, it's my decision" does.

## A4b. Rules added after the first calibration pass

**OB-20 · Elliptical exploration.** An open question that refers back to the resistance by ellipsis, without reusing its words ("Compared to what?", "Why is that?", "In what way?"), placed directly after the resistance, counts as exploration (OB-15). A first response sentence that is such a question, with neither a receiving marker nor a contradiction, counts as acknowledged (OB-13).

**OB-21 · Mindset reframe on an anxiety.** A response to an anxiety that reframes the belief ("everyone feels that before starting", "fear means it matters to you") without describing any support, framework or proof is a **partial** match (H1 = 1), tagged `mindset_reframe`. With support or proof added in the same episode, it becomes a full match.

**OB-22 · Receive and leave in one turn.** A single sales turn that acknowledges the resistance and then moves to a new topic, without answering or exploring it, makes the episode **latent** (OB-10), whatever the length of the turn.

**OB-23 · Commitment to a proposed answer.** When the sales proposes a concrete answer (a payment plan, a start date, a call with the spouse) and the prospect commits to it in their own words with a specific element ("You have a deal", "Okay, the 900 plan, let's do it", "Thursday 7 pm works for both of us"), the resolution is **resolved**. A bare "yeah" or "okay" to the same proposal stays **acknowledged** (OB-17).

**OB-24 · Denied anxiety.** When the prospect explicitly denies one nature and asserts another ("I'm not scared, it's just the amount"), the episode takes the asserted nature only (here: objection · money available); no anxiety episode is opened.

**OB-25 · External reason that also limits time.** A delay tied to an external, verifiable event that also reduces the prospect's availability ("it's wedding season, I'm booked until October") opens two records: a decision-circuit deadline (for prevention) and an objection · time (for handling).

**OB-26 · Attribution.** The diarization quality gate (Part C, C1) must flag `attribution_doubtful` turns before bounding. When the flag is missing, the model marks a turn as doubtful if its content contradicts its label (the sales' own name or offer described in the first person under a PROSPECT label); such turns are excluded from episodes.

## A5. Exclusion rules (summary)

| # | Never counts as… | Case |
|---|---|---|
| X1 | a resistance | A request for information; a conditional acceptance; a neutral circuit fact |
| X2 | inertia | A delay with an external, verifiable reason (it is a deadline) |
| X3 | resolved | Plain agreement; agreement to a resolution stated by the sales |
| X4 | resolved | Any resistance that recurs later (it is re-scored H5 = 0) |
| X5 | acknowledged by the sales | A first sentence that contradicts or argues |
| X6 | isolation | "Anything else?" asked after the answer, at the end of the episode |
| X7 | exploration | A closed question, or a question that does not reuse the resistance |
| X8 | prevention | Facts stated after the first price; sales suppositions |

## A6. Minimal pairs

| # | Passage | Verdict | Why |
|---|---|---|---|
| 1a | "How long is the program?" | Not a resistance | Information request (OB-2) |
| 1b | "How long is it? Because honestly I don't have much time." | Objection · time | Reserve stated |
| 2a | "I'm not sure it works." | Objection · trust | Doubt on the offer |
| 2b | "I'm not sure I can do it." | Anxiety · capability | Doubt on self |
| 3a | "Not right now, maybe after the holidays." | Inertia | No external reason |
| 3b | "Not before January, I'm moving in December." | Deadline (circuit) | External reason (OB-2) |
| 4a | "My husband handles our finances." (discovery) | Circuit fact | Neutral |
| 4b | "I need to talk to my husband first." (after the price) | Objection · co-decider | Reason not to decide now |
| 5a | Sales: "I hear you. Apart from the money, is anything else holding you back?" | Acknowledge + isolate | OB-13, OB-14 |
| 5b | Sales: "But think about what it's costing you not to do it." | Not acknowledged | Contradiction first (OB-13) |
| 6a | Prospect after a payment plan: "Okay, 900 a month I can actually do." | Resolved | Own words |
| 6b | Sales: "So the payment plan works for you, right?" Prospect: "Yeah." | Acknowledged | Resolution stated by the sales (OB-17) |
| 7a | Anxiety "I always give up" → Sales describes weekly check-ins and a mentor who follows up | Matching gesture | Support removes the risk |
| 7b | Anxiety "I always give up" → Sales: "The price is really low compared to a degree" | Mismatched | Argues the offer against self-doubt |
| 8a | Resistance, sales changes subject in the next turn, prospect silent | Latent | OB-10 |
| 8b | Resistance, sales explores, prospect answers for 3 turns, then topic change | Not latent | Reaction present |

## A7. Detection reliability for objections

| Measure | Threshold |
|---|---|
| Resistance recall on the gold set | ≥ 95 % |
| Resistance precision | ≥ 85 % |
| Nature agreement (objection / anxiety / inertia) | κ ≥ 0.80 |
| Episode end: same turn ± 1 | ≥ 90 % |
| Resolution level agreement | κ ≥ 0.80 |
| Gesture items (acknowledge, isolate, explore, match) | κ ≥ 0.80 each |

Until then the Objection Removal score is labelled "provisional". Most probable confusions: anxiety classified as objection (OB-3); information request taken as objection (OB-2); acknowledged taken as resolved (OB-17); late "anything else?" taken as isolation (X6).

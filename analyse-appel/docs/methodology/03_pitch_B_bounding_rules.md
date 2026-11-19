# Annex A · Bounding rules for the pitch

This annex says how the system finds, in a raw transcript, the start and end of the pitch, its segments, the links to the prospect's inputs, the check-ins and the prospect's adhesion. A rule that is not written here does not exist: an uncovered case goes to the arbiter with the label `uncovered_case` and becomes a new numbered rule.

## A1. Phase anchors

**PB-1 · Pitch start.** The first sales turn that meets one of these conditions:
- it describes the offer: its content (modules, pillars, steps), its format (mentorship, coaching, community, calls), its duration ("six months"), its support, its guarantee or its outcome promise ("in six months you'll have…");
- it announces or starts a screen share of the program ("let me share my screen", "can you see my screen?") followed within 2 sales turns by an offer description.

Lexical cues used by the inventory (never decisive alone): "the program", "the mentorship", "the academy", "what we do is", "the way we help", "how it works", "the first pillar", "module", "six-month", "let me show you", "share my screen".

**PB-2 · Offer mention (not a pitch start).** A passage that describes the offer and is followed, within 2 sales turns, by a return to discovery questions (see PB-17). It is logged `offer_mention`.

**PB-3 · First price.** The first sales passage stating an amount **for the offer** (full price, instalment, deposit, discount). Never a price: the income of a former student, the price per project the prospect could charge, a budget for ads or software, an amount quoted by the prospect. A price stated by the prospect ("I saw it's 5,800") is logged but is not the first price. (Romain, 2026-11-03.) The first price is said by the sales and goes with the explanation of the company's offer: the amount must be what this prospect would pay for the offer being presented, and the sales turn that explains that offer (the same turn or an earlier one) is quoted; an example of what the prospect could charge her own students ("a 10-week programme at 500 euros"), a market price or a budget is never the first price. A valid price said before the pitch start found by PB-1 belongs to that explanation: the pitch starts at the turn that explains the offer. An introduction of the call ("if we work together it will be over four months") followed by discovery questions is an offer mention (PB-2), never the pitch start. (Lite engine: applied with quoted evidence checked by code; reference engine: see OPEN_DECISIONS.)

**PB-4 · Pitch end.** The first of: the first price; the first decision request ("are you ready to get started?", "what would you like to do?"); the end of the call.

**PB-5 · Pitch over two calls.** If the pitch starts in one call and resumes in the next call of the same cycle, each call has its own pitch start; prospect inputs from the earlier call are valid inputs.

## A2. Segments

**PB-6 · Segment boundaries.** Inside the pitch, a new segment starts at:
- an enumeration marker ("the first thing", "second", "next", "then we have", "on top of that", "the last piece", "pillar one/two/three", "module");
- a screen navigation announced by the sales ("on this slide", "if I scroll down", "this next part");
- a prospect turn of 6 words or more (the sales passage that follows starts a new segment).

**PB-7 · Segment label.** The model labels each segment with one component of the offer reference (for example: mentoring calls, project review, pricing module, client acquisition, community, AI tools, guarantee, timeline). A segment that presents no component (a story, a motivational passage) is labelled `narrative`. A segment presenting two components is split at the second component's first word.

## A3. Links (diagnostic only since version 2.0)

Since version 2.0 the pitch treats one blocker only, and the other blockers go to the roadmap: links and coverage are no longer scored. PB-8 to PB-10 are kept to compute the diagnostic "former coverage" during the transition.


**PB-8 · What a link is.** A segment is linked to a prospect input (blocker or criterion) when, in the segment or in the next sales turn, the sales:
- (a) refers explicitly to the prospect's input with a reported-speech marker ("you said", "you mentioned", "you told me", "earlier you were saying", "for you specifically", "remember when you said") **and** reuses at least one content word or number of that input; or
- (b) reuses at least one content word or number of the input **and** connects it to the component with a causal or purpose connector ("so that", "which means", "that's why", "this is what fixes", "this is for", "this solves", "this is where … comes in").

**PB-9 · What is not a link.** Generic personalisation ("people like you", "a lot of our students struggle with this"); a mention of the prospect's name without their input; a reused word with no connection to the component; a link to an input the prospect never stated (untraced).

**PB-10 · Inputs.** Blockers and criteria are taken from prospect statements **before the pitch start** (and from earlier calls of the same cycle). Criteria exclude price and budget. A statement made after the pitch start can be a reaction or an objection, never an input for coverage.

## A4. Check-ins (diagnostic only since version 2.0)


**PB-11 · Check-in.** A sales solicitation inside the pitch that asks how a component applies to the prospect, which part matters most, where they see themselves, or what they would do with it.

**PB-12 · Not a check-in.** "Does that make sense?", "Can you see my screen?", "Any questions so far?", "Cool?", "Sounds good?", "Right?", "You with me?", and any question about logistics (hours available, start date) or money.

**PB-13 · Answered with content.** The prospect's next turn contains something of their own beyond agreement (a preference, a fear, a projection, a question about their own case).

## A5. Adhesion

**PB-14 · Adhesion.** A prospect passage, from the pitch start until the decision request, that shows one of:
- **appropriation:** the prospect restates a component as applied to themselves ("so I'd have someone checking my designs every week");
- **concrete projection:** first person, future or conditional, with a concrete element (a date, a number, a first action, a named client or project) ("if I start now I could have my portfolio ready before March");
- **new link:** the prospect connects a component to their situation on their own ("that's exactly what I was missing with the last course").

**PB-15 · Not adhesion.** Plain approvals and compliments ("okay", "sounds good", "that's great", "wow", "amazing", "I love that"); questions about price, payment or logistics without a projection ("how much is it?", "when does it start?"), which are logged as `buying_signal`; content first stated by the sales and only approved.

**PB-16 · The gesture before adhesion.** For each adhesion passage, the model quotes the sales passage immediately before it (the gesture that produced it). This pair feeds coaching; it does not change the score.

## A5b. Rules added after the first calibration pass

**PB-17 · Unsolicited mention.** An offer description of any length, solicited or not, that is followed within 2 sales turns by a return to discovery questions is an `offer_mention`, not a pitch start. This replaces the "second mention" clause of PB-2: repeated mentions stay mentions as long as each is followed by a return to discovery.

**PB-18 · Hypothetical and range amounts.** A hypothetical amount ("let's say it was 10K, this is not the price") is never a price. A range given for the offer ("between 3,000 and 8,000") is a price. An amount is only accepted as the offer price if it is plausible for the offer reference (within 0.3 to 3 times the reference price, to validate); otherwise it is logged `amount_doubtful` for review (for example "800 to 1,000" said about the offer when it is a price per project).

**PB-19 · Price before the pitch.** A price given before the pitch start is recorded (`early_price`, K6 = 0: the price comes before the roadmap) but does not set the pitch end; the pitch then ends at the first decision request or at the end of the call.

**PB-20 · Inputs outside the transcript.** Blockers and criteria known only from the application form or the CRM are valid inputs if they are stored in the prospect record before the call (source `form`). A link to them follows PB-8 (the sales must name them in the pitch). Inputs that exist nowhere in writing are not inputs.

**PB-21 · Number normalisation.** Before anchoring, numbers are normalised: "10K" = "10,000" = "$10,000" = "ten thousand"; "5 grand" = 5,000; currencies are ignored for matching.

**PB-22 · Market doubt.** A doubt about the viability of the market or the profession ("AI will replace designers") stated before the pitch is a **blocker** (it prevents reaching B); stated after the pitch start, it is a resistance (Objections competence).

**PB-23 · Restating to check understanding.** When the prospect restates what the sales just explained **in answer to a comprehension question** ("so what would that mean for you?"), the restatement is adhesion only if it adds an element about the prospect's own situation (their project, date, number); a pure echo of the sales' words is X7.

**PB-24 · Projection used to postpone.** A concrete projection used to justify a delay ("I'd rather start in January when the wedding season is over") is not adhesion: it is tagged `reserve` and routed to the Objections competence (inertia or deadline).

**PB-25 · Closed fit questions and scales.** A closed question on fit ("is that what you were looking for?") is at most a level-1 check-in. A scripted 1-to-10 scale counts as a check-in only if the prospect's answer contains more than the number.

**PB-26 · Merged turns.** When a prospect turn contains the sales' question (diarization merge), the question part is reattributed to the sales before computing check-ins and the gesture before adhesion (PB-16); if the split point cannot be found, the turn is `attribution_doubtful` and excluded.


## A5c. The staircase and the compliance gate (version 2.0)

**PB-27 · Category of P.** The model classifies the validated P (the prospect's exact quote) into one of the nine categories, by asking what the prospect doubts. Boundary tests, in this order:
1. The doubt is about **his ability to do the design work** ("can I actually do this?", "I'm not good enough") → **Skill**.
2. The doubt is about **being chosen without experience or credentials** ("who will hire me?", "I have no portfolio", "I'm not certified") → **Legitimacy**.
3. **What to charge** → **Pricing**. **Where clients come from** (marketing, visibility, leads, "getting the clients") → **Acquisition**. **Turning a conversation into a client** (sales calls, proposals, closing a deal) → **Selling**. **Running a project end to end** (process, contracts, suppliers, client management) → **Delivery**.
4. **Hours available** → **Time**. **An earlier course or attempt that produced nothing** → **Past failure**. **The risk that the investment does not pay off** ("what if it doesn't work?") → **Financial risk**.
A lack of money to pay for the program is not a blocker of the pitch: it is a decision-circuit fact or an objection (Objections competence). A P that fits none of the nine (for example a fear, overthinking, "not treating it as a need") is `P_category_unknown` and goes to the arbiter as `uncovered_case`. When a P fits two categories, the category of the words the prospect used wins ("I don't know how to get clients" → Acquisition, even if the sales hears a selling problem).

**PB-28 · Step 1.** The first sales passage after the pitch start that states what blocks the prospect, introduced or not by "what's blocking you today is…". It is verbatim if it contains the key expression of the validated P (Gap Annex A, GB-22). It ends at the first sentence that states a principle, a component of the offer or a phase. If the blocker is only restated in the gap restitution and not after the pitch start, step 1 is missing.

**PB-29 · Step 2.** The sales passage that follows step 1 and states a principle ("what makes that give way is…") and a phase of the offer. The model maps every principle or phase stated before the roadmap to one of the nine mechanisms of the reference (`mechanisms_stated`). Exactly one mechanism, equal to `P_category`, is required. **Second mechanism:** a principle or phase mapped to another mechanism, anywhere between step 1 and the roadmap. **Recitation:** a passage that lists three or more components, modules or deliverables of the offer without tying them to the principle (threshold to validate). **Principle in one sentence:** the principle fits in one sentence of 25 words or fewer (to validate).

**PB-30 · Step 3.** The sales passage that states where the prospect goes from and to. A and B must be the selected A and B of the Gap result (GB-28, GB-29), with his figures (GB-24) and his unit. A date or duration stated by the sales counts as his deadline only if the prospect gave it (a quote exists); otherwise it is an invented date. The **image of his life** is a concrete scene stated after B (where he is, what he does, with whom); it is in his words if it contains a key expression from his answers to N solicitations or his VALUE atoms (Gap GB-22).

**PB-31 · Step 4.** A passage that tells the story of a named or described client who used the offer. Checks by code: the case is found in the case library (by id, name or match of its figures); consent is recorded for it; its **starting point** matches the prospect's A: same dimension (unit of A) and starting value within the factor to validate, or the same starting profile label (for example "full-time job, zero clients"). A case cited by the sales that is not in the library is `out_of_gap_claim` (PB-35). Several cases in step 4: the best-matching one is scored, the others are logged.

**PB-32 · Order.** Each step is placed at the turn of its first sentence. The order is respected if step 1 < step 2 < step 3 < step 4 < roadmap start < first price < decision request. A step repeated later (for example step 1 said again before the price) does not break the order; the first occurrence counts.

**PB-33 · Sentences.** The code splits each step into sentences (end punctuation of the transcript, then a split at "and" + subject when a transcript sentence exceeds 40 words). A step of more than three sentences fails brevity (K5).

**PB-34 · Roadmap.** The roadmap starts at the first sales passage, after step 4, that presents steps or milestones of the prospect's path ("your roadmap", "step one for you is…", the shared one-page plan). Its steps are matched to his blockers (Gap GB-32) by key expression. It must come before the first price.

**PB-35 · Claims outside his gap or the offer.** A claim is a figure, a client case, a price or a guarantee stated by the sales between the pitch start and the decision request. It is allowed if it is found in: the prospect's quotes (his gap, his figures); the offer reference (price, payment options, guarantee, components); the case library (cases and their figures); or a calculation on those figures shown as such ("at 1,000 per project and 3 projects a month…", using his price per project). Anything else is `out_of_gap_claim`: an average result of students, a market figure, a guarantee not in the offer, a case not in the library. The model lists every claim with its quote; the code looks up each one.

**PB-36 · Outcome promise.** A sales sentence whose subject is the Academy, the team or "we", and whose action is running his business, finding or bringing him clients, signing or closing his clients, or delivering his projects ("we'll find the clients for you", "we close them for you", "our team delivers the project"). Not a promise: the Academy providing systems, feedback, coaching, templates, reviews ("we give you the system to find clients", "we review every proposal you send"). Conditional or hypothetical forms are promises if the subject and action are those above.

**PB-37 · Pitch before the yes.** The pitch start (PB-1, PB-17) comes before the validation turn of the restitution that passed the Gap gate, or the Gap verdict is "absent". An `offer_mention` before the validation is not a pitch and does not trigger this rule.

## A6. Exclusion rules (summary)

| # | Never counts as… | Case |
|---|---|---|
| X1 | a pitch start | A short answer to a direct prospect question, followed by a return to discovery (PB-2) |
| X2 | a price | Income of a student, price per project, ad budget, software subscription, amount said by the prospect |
| X3 | an input | A blocker or criterion stated after the pitch start; a budget stated as a criterion |
| X4 | a link | Generic personalisation, name-dropping, a reused word without connection (PB-9) |
| X5 | a check-in | "Does that make sense?" and the list of PB-12 |
| X6 | adhesion | Approvals, compliments, logistic or price questions without projection (PB-15) |
| X7 | adhesion | Content first stated by the sales and approved |
| X8 | a compliant pitch | A pitch started before the gap was validated (`pitch_before_gap`, PB-37), a claim outside his gap or the offer (PB-35), an outcome promise (PB-36): score 0 |
| X9 | step 1 | A paraphrase of the blocker in the sales' vocabulary (PB-28) |
| X10 | step 2 | A second mechanism; a recitation of the offer content (PB-29) |
| X11 | step 3 | A unit that is not the prospect's; a deadline he never gave (PB-30) |
| X12 | step 4 | A case not in the library; a case without consent; an invented case (it is also `out_of_gap_claim`) (PB-31) |
| X13 | the roadmap | A roadmap shown after the price, or whose steps are not his named blockers (PB-34) |

## A7. Minimal pairs

| # | Passage | Verdict | Why |
|---|---|---|---|
| 1a | Prospect: "So what is it exactly?" Sales: "It's a six-month mentorship, I'll show you everything in a bit. So how long have you been doing this?" | `offer_mention` | Short answer, return to discovery (PB-2) |
| 1b | Sales: "So the way it works, it's a six-month mentorship, we start with your foundations, then pricing, then clients…" | Pitch start | Offer description, 3+ elements |
| 2a | "Our students charge 800 to 1,000 per room." | Not a price | Price per project (X2) |
| 2b | "The investment is 5,800, or six payments of 1,097." | First price | Amount for the offer |
| 3a | "You said you never know what to charge: module 3 is all about pricing." | Link | Reported speech + reused word |
| 3b | "Module 3 is all about pricing, a lot of people struggle with it." | Generic | No reference to the prospect (PB-9) |
| 4a | "Which of these three feels furthest away for you?" → "The business side, I've never priced anything." | Check-in answered with content | PB-11, PB-13 |
| 4b | "Does that make sense?" → "Yes." | Not a check-in | PB-12 |
| 5a | "So I'd have someone looking at my work every week, that's what I need." | Adhesion (appropriation) | PB-14 |
| 5b | "That sounds amazing." | Not adhesion | PB-15 |
| 6a | "If I start in November I could be taking clients by spring." | Adhesion (projection) | Concrete date |
| 6b | "When does it start?" | `buying_signal` | Logistics without projection |
| 7a | Prospect, before the pitch: "What matters is that I'm not left alone after." | Criterion (input) | Before the pitch, about the nature of the offer |
| 7b | Prospect, after the screen share: "I'd need to not be left alone." | Not an input | After the pitch start (PB-10); a reaction |
| 8a | Validated P: "I don't know where clients will come from." Sales: "What's blocking you today is you don't know where clients will come from." | Step 1 verbatim | PB-28 |
| 8b | Same P. Sales: "So your lead generation is the issue." | Step 1 paraphrased | X9 |
| 9a | P category Acquisition; step 2 states the Acquisition principle and its phase | One mechanism | PB-29 |
| 9b | Same, then "and module 4 is pricing, module 5 is contracts, module 6 is the community" | Recitation | X10 |
| 10a | A "2K a month", B "10K a month". Sales: "from 2K a month to 10K a month" | Same unit | PB-30 |
| 10b | Same. Sales: "from where you are to six figures by next summer" | Other unit and invented date | X11 |
| 11a | "Someone who started exactly where you are, with a full-time job and no clients…" (case in the library, same profile) | Matched proof | PB-31 |
| 11b | "One of our students hit 40K in her third month" (not in the library) | `out_of_gap_claim` | PB-35, X12 |
| 12a | "We give you the system and we review every call you take." | Allowed | PB-36 |
| 12b | "We'll find the clients, you just do the design." | `outcome_promise` | PB-36, X8 |
| 13a | Validation "Exactly." at T150, screen share and offer description at T152 | Pitch after the yes | PB-37 |
| 13b | Screen share and offer description at T140, restitution validated at T150 | `pitch_before_gap` | PB-37, X8 |

## A8. Detection reliability for the pitch

| Measure | Threshold |
|---|---|
| Pitch start: same turn as the gold set (± 2 turns) | ≥ 95 % of calls |
| First price: same turn | ≥ 98 % of calls |
| Link recall and precision on gold segments | ≥ 90 % and ≥ 85 % |
| Adhesion: agreement on presence per passage | κ ≥ 0.80 |
| Check-in: agreement per solicitation | κ ≥ 0.80 |
| Category of P | κ ≥ 0.80 over the nine categories |
| Steps 1 to 4: same span ± 1 turn | ≥ 90 % per step |
| Mechanisms stated: same set per pitch | ≥ 90 % |
| Claims: recall of out-of-gap claims on the gold set | ≥ 95 % |
| Outcome promises: recall | ≥ 95 % |

Until then the Pitch score is labelled "provisional". Version 2.0 adds: P classified in the wrong category (PB-27); a second mechanism missed because it is said in passing (PB-29); a student result taken as a case from the library (PB-35). Most probable confusions: offer mention taken as pitch start (PB-2); student income taken as price (X2); compliment taken as adhesion (PB-15); generic personalisation taken as link (PB-9).

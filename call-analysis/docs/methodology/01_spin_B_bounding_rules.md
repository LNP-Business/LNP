# Annex A · Bounding rules for SPIN discovery (v1.3: A8 registers, SB-26 to SB-33 and SB-35)

The bounding of the **questions** (solicitation, segmentation rules SEG-1 to SEG-8, the five gates, OUT reasons and hard rules) is given in §2 and §3 and follows the ALKIMIY SPIN bounding reference v1.0. This annex adds what that reference leaves open for scoring: the exact bounding of the **perimeter**, of the **prospect's answer**, of the **atoms** it contains and of the **chains**. A rule that is not written here does not exist: an uncovered case goes to the arbiter with the label `uncovered_case`.

## A1. Perimeter

**SB-1 · Borders.** The perimeter starts at the first solicitation on the prospect's situation, goals or problems that is neither social, nor logistic, nor framing. It ends when the gap is made: at the prospect's validation of the restitution that makes the gap present (Gap annex, absence gate) (Romain, 2026-11-03). When no gap is made, it ends at the first pitch start or the first price (Pitch annex, PB-1 and PB-3). A restitution that does not make the gap present does not end it. (Lite engine: applied; reference engine: still ends at the pitch start or price, see OPEN_DECISIONS.)

**SB-2 · Social and framing questions.** Never the perimeter start: where the prospect is calling from, how their day is, family small talk, "can you see and hear me?", "here is how the call will go, sound good?". A question about what made them book the call ("what were you hoping we could help you with?") **is** a valid start.

**SB-3 · Reopenings.** *Superseded by SB-34 (v1.2): no reopening; kept for the record.* After the end, a sales solicitation that asks a new diagnostic question about the prospect's situation, problems or goals reopens the perimeter; the reopening ends at the next offer segment, price, decision request or topic change. Not reopenings: questions about the offer, logistics (hours available, start date), financing (savings, credit, monthly budget), and clarification of a resistance (Objections competence).

**SB-4 · Questions inside the pitch.** *Superseded by SB-34 (v1.2): kept for the record.* A question asked during the pitch about the prospect's own situation ("would you say your eye is ahead of your process?") is a reopening only if its answer is followed by at least one more diagnostic question; a single question inside the pitch is a pitch check-in (Pitch annex, PB-11).

## A2. The answer

**SB-5 · Answer span.** The answer to a solicitation is the prospect's speech from the end of the solicitation to the next sales solicitation. Sales backchannel of 5 words or fewer inside it does not end it.

**SB-6 · Stacked questions.** When several solicitations are stacked in one sales turn (SEG-1), the answer is attributed to the **last** one, unless the prospect explicitly answers an earlier one (quotes or reuses its key word); the other stacked solicitations get no answer (`unanswered`), which does not change their letter.

**SB-7 · Short first answer.** If the first prospect turn has fewer than 6 words and the sales does not speak in between, the next prospect turn is included in the answer.

**SB-8 · Volunteered speech.** Prospect statements made outside any answer span inside the perimeter (the prospect keeps talking after the sales' acknowledgement) are attached to the last solicitation before them, with the flag `volunteered`. Volunteered atoms count for items D1 to D4, never for D5 (chains).

## A3. Atoms

**SB-9 · One atom, one passage.** An atom is a continuous passage of 2 to 40 words in one prospect turn. Two passages that state the same thing in different words in the same answer are one atom (keep the most explicit). Two different consequences in one sentence are two atoms ("I'm exhausted and I'm not seeing my kids" → two IMPACT atoms, health and family).

**SB-10 · PAIN or IMPACT.** A consequence counts as IMPACT only if its domain differs from the problem's domain (unit of loss: money, time, clients, family, health, self-belief, future). "I don't have clients" → PAIN; "so I can't pay my rent" → IMPACT (money). The model gives both domains; the code compares them.

**SB-11 · SITUATION or IMPACT for figures.** A figure describing the present (revenue, hours, number of clients) is SITUATION. A figure describing what the problem makes them lose (money left on the table, months lost, hours wasted) is IMPACT. A current income is never IMPACT.

**SB-12 · DESIRE or reaction to the offer.** A desired state stated after the pitch start is not a DESIRE atom (it is a reaction to the offer, Pitch competence).

**SB-13 · DESIRE or VALUE.** DESIRE is the state ("I want 10K a month"); VALUE is why it matters or what it would change ("so I can quit and be home for my kids"). A sentence containing both gives two atoms.

**SB-14 · Prompted content.** If the sales stated the content and the prospect only approves ("yes", "exactly", "for sure"), no atom. If the prospect approves **and adds** content, only the added content is an atom.

**SB-15 · Quantified.** An atom is quantified if its passage contains a number, an amount, a duration, a frequency or a date attached to it ("two years", "15 hours a week", "about 3K"). Vague quantities ("a lot", "forever") are not quantified.

## A4. Chains

**SB-16 · Object.** Each PAIN, BLOCKER and IMPACT atom carries a short object label. Two atoms share an object when the model links them and the code finds at least one shared content word between their quotes or the quotes of the questions that produced them.

**SB-17 · Followed up.** A solicitation is followed up when it reuses at least one content word (4 letters or more, outside the stop list) or one number from the previous answer.

**SB-18 · Deep chain.** P (answer: PAIN or BLOCKER on object X) → I (answer: IMPACT on X) → I or N (answer: IMPACT, DESIRE or VALUE on X), consecutive among coded S/P/I/N solicitations, each followed up. One OUT `nothing` question in between (a backchannel question) does not break the chain; any other coded question does.

## A4b. Rules added after the first calibration pass

**SB-19 · Echo follow-ups.** An anaphoric or echo solicitation placed directly after the answer ("Tell me more", "How so?", "What else?", "A lot?", "Meaning?") counts as followed up (SB-17), even without a reused word of 4+ letters.

**SB-20 · What breaks a chain.** Replaces the last sentence of SB-18. A chain is broken only by: a coded S, P, I or N solicitation on another object; or an OUT `sales_list` or `agreement` solicitation. An OUT `nothing` does not break it. An S that counts the problem of the chain itself ("how many clients did you lose?") does not break it, but does not count as one of its links.

**SB-21 · Action-plan questions.** "What would you need to do differently?" and similar questions about the prospect's own plan are N only if the answer states a future state or its value; otherwise the question is OUT `solution_load` and its answer produces no DESIRE atom.

**SB-22 · Income drop.** A fall between a past and a current income, explicitly attributed by the prospect to the problem ("I went from 175K to 58K since…"), is a quantified IMPACT (money). A current income alone stays SITUATION (SB-11).

**SB-23 · Reported speech.** Words the prospect attributes to someone else ("my brother says I'll never make money from this") are an atom only if the prospect takes them on as their own in the same answer ("and honestly he's right" or an equivalent statement in the first person).

**SB-24 · Quantified, precisely.** Replaces SB-15. An atom is quantified if it contains an amount, a count or a duration ("2K", "three clients", "two years", "15 hours a week"). A frequency alone ("every month", "all the time") is not enough.

**SB-25 · Financing questions.** A question about how the prospect would pay for the solution (savings, credit, monthly budget available for the program) is OUT `solution_load`, wherever it occurs; it never reopens the perimeter (SB-3).

## A5. Exclusion rules (summary)

| # | Never counts as… | Case |
|---|---|---|
| X1 | perimeter start | Social, logistic or framing questions (SB-2) |
| X2 | a reopening | Since v1.2 nothing reopens the discovery (SB-34) |
| X3 | an atom | Approval without content; content prompted by the sales (SB-14) |
| X4 | IMPACT | A consequence in the problem's own domain (SB-10); a current income (SB-11) |
| X5 | DESIRE | A wish stated after the pitch start (SB-12) |
| X6 | quantified | "a lot", "forever", "so much" (SB-15) |
| X7 | a chain link | A question that does not reuse the previous answer (SB-17); a volunteered atom (SB-8) |
| X8 | a score point | The letter of a question, the number of questions of a letter (guard of the SPIN reference) |

## A6. Minimal pairs (answers and atoms)

| # | Question → answer | Atoms | Why |
|---|---|---|---|
| 1a | "What's not working?" → "I don't have clients." | PAIN | The problem itself |
| 1b | "And what does that do?" → "I can't pay my rent." | IMPACT (money) | Other domain (SB-10) |
| 1c | "And what does that do?" → "I don't get any projects." | PAIN | Same domain as "no clients" |
| 2a | "How much do you make?" → "About 3K a month." | SITUATION, quantified | Present figure |
| 2b | "What has that cost you?" → "Probably 2K a month I'm not earning." | IMPACT (money), quantified | Loss (SB-11) |
| 3a | "Where do you want to be?" → "At 10K a month." | DESIRE, quantified | State |
| 3b | "Why does that matter?" → "So I can be home with my kids." | VALUE | Why it matters (SB-13) |
| 4a | "So you'd love more freedom, right?" → "Yes." | none | Prompted (SB-14) |
| 4b | "So you'd love more freedom, right?" → "Yes, honestly I want to pick my kids up from school." | DESIRE (the added part) | Added content |
| 5a | Before the pitch: "I want my own studio." | DESIRE | Before pitch |
| 5b | After the screen share: "I'd love to have that community." | none (reaction to the offer) | SB-12 |
| 6a | "How long has it been like this?" → "Forever." | SITUATION, not quantified | SB-15 |
| 6b | "How long has it been like this?" → "Three years." | SITUATION, quantified | Duration |

## A7b. SPIN stops at the pitch (v1.2, Romain 2026-10-27)

**SB-34 · Nothing after the pitch is SPIN.** The discovery ends at the first pitch start or the first price (SB-1) and
never reopens. A sales question after that point, about the prospect's situation, problems or goals or about anything
else, is not read for SPIN: no letter, no atom, no chain, no register, and it does not count in any SPIN measure.
Replaces SB-3 (reopenings) and SB-4 (questions inside the pitch); their calibration cases (B1 case 6, B3 case 3) are
superseded. Engine constant `REOPENINGS = False`; the `spin.reopen_end` task is no longer asked.

## A8. Registers of the questions (SPIN v1.2, Romain 2026-10-27; v1.3 SB-35, Romain 2026-10-29)

Each question of the discovery is placed in one of four registers, or Other. The register is a reading aid for the
sales and the coach (where the discovery went and where it did not); it is displayed and never scored: it changes
no letter, no atom, no item and no score.

| Register | Domains (§2) | What it covers |
|---|---|---|
| Financial | money, clients | income, revenue, prices, debt; clients, projects, leads (a lack of clients turns into money) |
| Time & load | time, family | hours, schedule, workload; the time taken from the family |
| Identity & status | future | the gap between where the prospect is and where they want to be |
| Mental & emotional | self_belief, health | confidence, motivation, fear, feelings; stress, exhaustion, sleep |
| Other | other, none | a subject outside the seven domains, or no subject at all |

**SB-26 · Register of a question.** Every coded solicitation S, P, I or N of the discovery, from the perimeter start
to the first pitch start or price (SB-1), gets one register. The model names one domain; the code maps it with the
table above (`other` and `none` give Other). No register is given to: a question after the first pitch start or price,
nothing after it is SPIN (SB-34); an OUT solicitation (it is out of SPIN, confirmed by Romain 2026-10-27); a solicitation outside the
perimeter; a unit gone `to_review`.

**SB-27 · Read from the question, or from its effect.** When the question names one of the seven domains (SB-28,
SB-29 subject), the register is what it asks the prospect to talk about, in the sales' words, and the answer never
changes it, in the same way that atoms never change the letter (§2). When it names none (an open question), its
register is the effect it had: the answer decides (SB-35, v1.3).

**SB-28 · Asked over premise.** When the question names several domains, the domain the prospect is asked to talk
about decides, not the premise. "With your clients being so up and down, what impact is that having on your income?"
asks about income: money, Financial (clients is the premise). When two domains are both asked ("your income and your
family"), the first one asked, in reading order, decides.

**SB-29 · Subject and reference.** A question that names a subject of the seven domains without asking for a domain
("has that fear of failure cost you anything?", "where does that belief come from?") takes the domain of that subject.
Since v1.3 a question that names nothing and points back ("how has that impacted you?") is an open question (SB-35): it
takes the domain of what it points to, read in the last two prospect turns before it (`REGISTER_REFERENCE_TURNS = 2`),
only when it got no answer. "Personally", "your life", "you" name no domain.

**SB-30 · Domain words.** The domains are read from the words of §2 and §4. The code keeps a word list per register
(engine constant `REGISTER_LEXICON`): Financial money, income, revenue, earn, salary, cash, price, afford, debt, bills,
rent, finance, profit, dollar, paid, client, customer, project, leads, booking, pipeline, sales, an amount ("$5K", "10K");
Time & load time, hour, week, weekend, schedule, workload, busy, family, kid, child, wife, husband, partner, son, daughter,
parent; Identity & status future, years from now, long term, where do you see yourself, where do you want to be, become,
dream, vision, career, legacy, status; Mental & emotional confidence, believe in yourself, self-belief, motivation,
mindset, fear, doubt, feel, emotion, frustrated, proud, health, stress, anxiety, burnout, exhausted, tired, sleep, energy.
A target in money or clients ("how much do you want to make?") is Financial, not Identity & status; words that only
date the question ("today", "last year", "in 12 months") are not the time domain.

**SB-31 · Other.** Since v1.3 a question about a subject outside the seven domains (a tool, a place, a method) is an
open question (SB-35). Other is given when the answer talks about none of the seven domains, or, for a question with
no answer, when it names no subject and points to none.

**SB-32 · Code checks.** (1) The model answers one closed question per unit: the asked domain, the basis (`named`,
`answer`, `reference` or `none`) and a quote. (2) The quote is checked (C3): for `named`, exact words of the question or
of its preamble; for `answer`, exact prospect words of one of the first three turns of the answer (SB-6 answer span,
`REGISTER_ANSWER_TURNS = 3`), whose id is given; for `reference`, exact words of one of the last two prospect turns,
whose id is given. The rule order is checked too: `named` never gives Other (`named_other`); a question with an
answer is never read by `reference` or `none` (`reference_with_answer`, `none_with_answer`); `answer` needs an answer
(`no_answer`). (3) When the words of
the question belong to the list of exactly one register (SB-30) and the model names a domain of another register with
the basis `named`, the answer is rejected (`lexicon_conflict`) and replayed once (C3 rule 7). (4) Three independent
passes; the key compared is the register; a disagreement goes to the arbiter, who decides by walking SB-28, SB-29, SB-35, SB-31 in
order; undecidable gives `to_review`: no register, and the question is left out of the register counts.

**SB-35 · Open question: its effect decides (v1.3, Romain 2026-10-29).** A question that names none of the seven
domains as asked (SB-28) or as its subject (SB-29) — "is it plausible for you in this season of life?", "what's
actually riskier for you?", "what made you book this call?", "how has that impacted you?" — takes the register of the
prospect's answer to it: the domain the answer talks about, the effect the question produced, read in the first three
turns of its answer, with the prospect's exact words as quote. When the answer talks about several domains, the first
one in the answer decides; when it talks about none of the seven, Other. Only when the question got no answer (SB-6
unanswered) does SB-29 reference apply, then SB-31. Reason: on these questions the sales' words do not choose a ground,
the prospect's answer shows the ground the question opened (on Jaci Sung's call of 2026-10-19, the passes split on two
such questions, 2026-10-28).

**SB-33 · Reliability of the registers.** Target: at least 92 % of the questions in the right register (Romain,
2026-10-27). Its guarantee is the design of SB-32: a model that only names a domain with a checked quote, the
code's word-list cross-check, three passes, the arbiter and `to_review`. No human-labelled verification set for now
(Romain, 2026-10-27); if one is built later, it must come from calls outside the calibration set (C7). On every call, the code also measures the share of registers decided 3/3
(`agreement`); below 92 % (`REGISTER_MIN_AGREEMENT = 0.92`) the call is flagged `register_agreement_low` and the screen
says its registers are less reliable.

## A7. Detection reliability for SPIN

In addition to the question-level thresholds of the SPIN reference (segmentation ≥ 95 %, letter κ ≥ 0.80, reproducibility ≥ 95 %):

| Measure | Threshold |
|---|---|
| Perimeter start and end: same turn ± 2 | ≥ 95 % of calls |
| Atom recall on gold answers | ≥ 90 % |
| Atom type agreement on matched atoms | κ ≥ 0.80 |
| Deep chain agreement per call | ≥ 90 % |
| Register accuracy on a human-labelled set (SB-33) | ≥ 92 % of questions |
| Register reproducibility, decided 3/3 (SB-33) | ≥ 92 % of the questions of a call, else `register_agreement_low` |

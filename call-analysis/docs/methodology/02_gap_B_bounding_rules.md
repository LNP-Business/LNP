# Annex A · Bounding rules for the gap

This annex says how the system finds, in a raw transcript, a restitution of the gap, its components and the prospect's validation. It is written so that two human annotators and the machine reach the same result on the same call. A rule that is not written here does not exist: an uncovered case goes to the arbiter with the label `uncovered_case` and becomes a new numbered rule in the next version.

## A1. The unit: the restitution candidate

A **restitution candidate** is a sales passage, inside the phase window (A2), that the inventory stage (code) flags because it meets **at least one** of these signals (union, not intersection):

| Signal | Detection | Examples |
|---|---|---|
| S1 Opener | The sales passage starts with, or contains within its first 20 words, a playback marker | "So from what I'm hearing", "Let me play that back", "If I understood correctly", "Correct me if I'm wrong", "So just to recap", "What I'm hearing is", "Let me make sure I got this", "So basically where you're at is", "So to summarise" |
| S2 Dense second-person passage | A sales turn of 25 words or more, in which at least two clauses have the prospect as subject ("you", "your") and carry a word or number the prospect used earlier | "So you're at about 2K, you've been doing this on the side for three years, and you want to replace your salary…" |
| S3 Validation request | A sales passage ending with a validation request about what was just said | "Did I get that right?", "Is that fair?", "Is that accurate?", "Anything I missed?", "Would you say that's where you're at?" |

The inventory never deletes a candidate. The model then decides, for each candidate, whether it is a restitution (GB-4) and which components it contains (GB-3). Candidates rejected by the model are kept with the reason, for audit.

## A2. The phase window

- **Start:** the start of the discovery perimeter (SPIN methodology, §2).
- **End:** the first pitch start or the first price, whichever comes first (phase map, Part C stage S2).
- A candidate after the end is still recorded (for diagnostics) with `after_pitch = true` or `after_price = true`. It can never pass the absence gate.

## A3. Numbered rules

**GB-1 · Span.** A restitution starts at its first component statement (or at its opener, if the opener comes first) and ends at the first of: a prospect turn of 6 words or more; a sales solicitation on a new topic (it does not reuse any word of the restated components); the first mention of the offer (program, mentorship, academy, "what we do", "how we help"). Prospect turns of 5 words or fewer made only of approval or backchannel ("yeah", "mm-hmm", "right", "exactly") do not end the span: the sales turns on either side are merged.

**GB-2 · One restitution or two.** Two sales passages separated by a prospect turn of 6 words or more are two restitutions. Their components are never pooled. If the second passage only adds components ("and on top of that…"), it is evaluated as a separate restitution with its own validation.

**GB-3 · Component recognition.** A clause of the restitution counts as a component only if all three conditions hold:
- (a) it is about the prospect (subject "you", "your", or the prospect's name), not about another person;
- (b) it is declarative, or declarative followed by a validation tail ("…, right?");
- (c) it restates an earlier prospect statement of the same component (`problem_statements`, `cost_statements`, `A_statements`, `B_statements`) **in the prospect's exact words**. The model gives the id of the source statement and copies the **key expression** it reuses (GB-22). The code then classifies the clause: **verbatim** if the key expression is found exactly in the source prospect turn and in the sales clause (GB-22); **paraphrased** if the model links a source but the code finds no key expression in both; **untraced** if no source exists.
Only a **verbatim** clause is a component. A paraphrased or untraced clause is not a component: it does not count for GB-4 (two components), for the absence gate or for G5. It is kept as a diagnostic (`paraphrased_component`) so that the coaching can show the sales the exact words the prospect had used.

**GB-4 · Restitution or not.** A candidate is a restitution only if it contains **at least two** components (GB-3). A single restated component closed by a tail ("So your goal is 10K, right?") is not a restitution: in SPIN it is an OUT `agreement` question.

**GB-5 · Restitution or pitch.** If the passage restates components and then links them to the offer in the same turn ("…and that's exactly what we help with"), the restitution ends at the first offer word (GB-1). The prospect's next turn is then a reaction to the pitch, not a validation, unless the sales explicitly asks for validation of the restatement before mentioning the offer.

**GB-6 · Restitution or story.** Clauses about another person (a former student, a testimonial, "a lot of people in your position…") are never components, even if they mirror the prospect's situation.

**GB-7 · The cost component.** A COST clause must state a consequence of the problem in another domain, or what staying in the current situation costs (money, time, clients, family, health, self-belief, lost opportunity), and must restate a prospect `cost_statement` verbatim (GB-22). A cost introduced for the first time by the sales in the restitution ("and I imagine that's costing you sleep") is untraced and does not count, even if the prospect says "yeah". A current income figure is never a cost.

**GB-7b · The costs listed by the code** (version 1.4, 2026-11-20). The `cost_statements` are the model's IMPACT atoms **and** the clauses the code lists in the prospect's turns of the discovery that state a consequence in a cost domain, read with a lexicon per domain: money (« difficultés financières », « dettes », « dépendante de l'aide de ma mère »), time (« je n'ai plus le temps pour », « je passe des journées »), clients (« je perds des élèves »), family (« on profite moins des enfants », « mes enfants au centre de loisirs »), health (« fatigue », « épuisée », « stress », « burn-out », « j'ai envie d'en pleurer »), self-belief (« je me sens exploitée », « plus confiance en moi », « ça me pèse »). The quote is an exact passage of the turn, a few words around the cost words. Never a cost: a clause whose subject is the sales (« tu es épuisée »), a negation (« je ne suis pas fatiguée »), a question, reported speech (« ma collègue m'a dit que »), words the prospect only repeats after the sales (X10: every content word already in the sales turn just before), a figure (X6: the code reads no figure here). These statements feed the list of what the prospect said (`cost`, `collected_not_formalised`) and the sources shown to the model for the restitution; the cost **component** of a restitution is still a verbatim restatement checked by GB-22 and GB-7, and G4 level 2 still needs a quantified cost. What the prospect said is listed over the whole phase window, not only before the first restitution (a cost stated after a failed restitution is still his).

**GB-8 · The validation turn.** The validation is the first prospect turn of 6 words or more after the end of the span, or, if the prospect only answers with a short approval, that short turn. It is read against the restitution, not against anything else:
- if the sales' last sentence before the prospect speaks is an unrelated question (GB-9), there is no validation;
- if the sales asked for validation (S3), the prospect's answer is the validation.

**GB-9 · Validation captured by another question.** If the restitution turn ends with a question on a new topic ("…, and how many hours a week could you put in?"), the prospect's answer responds to that question: outcome `none`.

**GB-10 · Validation outcomes.**

| Outcome | The prospect turn… | Example |
|---|---|---|
| `confirmed_with_content` | agrees and adds something of their own: a precision, a number, an emotion, a new element, a reformulation | "Yes, and honestly it's been eating at me for years." |
| `confirmed` | agrees without new content | "Yeah, exactly." "That's right." "100 %." |
| `corrected` | corrects one or more components | "Not quite, it's more like 3K, not 4K." |
| `rejected` | disagrees with the restitution as a whole | "No, that's not really it." |
| `none` | no response to the restitution (GB-9), or topic change by the sales before the prospect answers | — |

A `corrected` outcome passes the gate only if the sales restates the corrected component in a new restitution and that new restitution is `confirmed` or `confirmed_with_content`.

**GB-11 · Several restitutions.** The gate is evaluated on every restitution in the window; the gap is present if at least one passes. The items G5 and G6 are scored on the last restitution that passes the gate.

**GB-12 · Speakers.** Only a `SALES` turn can be a restitution. The validation must come from the prospect, or from a co-decider labelled `OTHER` if the co-decider is the one the restitution addresses. A turn marked `attribution_doubtful` cannot be a restitution or a validation.

**GB-13 · Follow-up calls.** In a call where the pitch resumes after an earlier call of the same cycle, the restitution and its validation must happen in this call, before the pitch resumes. Its components may be traced to prospect statements of the earlier call.

## A3b. Rules added after the first calibration pass

**GB-14 · Which pitch start.** The phase window ends at the pitch start defined by the Pitch annex, PB-1 and PB-17: an announced screen share is the pitch start only if an offer description follows within 2 sales turns; otherwise the pitch starts at the first offer description. The same anchor is used by the four competences of a call.

**GB-15 · "No" to "did I miss anything?".** When the validation request asks whether something is missing or wrong ("Did I miss anything?", "Anything I got wrong?"), an answer "No", "No, that's it", "Nope, that's everything" is `confirmed`; with an added element it is `confirmed_with_content`. French requests of this family (Romain, 2026-11-21): « j'ai oublié / raté / loupé / zappé quelque chose (un truc, un point) ? », « je n'ai rien oublié ? », « il te manque quelque chose ? », « je me trompe ? », « je me suis trompé(e) ? », « j'ai mal compris ? ». A generic tail (« …, non ? », « …, d'accord ? », « …, hein ? ») is never a validation request (A1 S3).

**GB-16 · Partial agreement.** An answer that agrees with a qualifier and then corrects ("99 %, except it's more like 3K") is `corrected`. An answer that agrees with a qualifier and no correction ("pretty much", "more or less") is `confirmed`.

**GB-17 · Emotional reaction.** An emotional response to the restitution ("Why do you have to go saying that?", tears, "that hurts to hear") without disagreement on its content is `confirmed_with_content`: the prospect owns the restated problem. With an explicit disagreement, it is `rejected`.

**GB-18 · Cost played down.** If the prospect's own statements minimise the cost ("it wouldn't necessarily be bad", "I'm fine for now") and the sales restates it as a heavy cost ("you'd be settling"), the COST component is untraced (GB-7): the sales' framing is not the prospect's cost.

**GB-19 · Notes from earlier touchpoints.** Information the prospect gave before the call can be a source only if the prospect's own words are stored (the text they typed in the application form, a recorded earlier call). Setter's notes and CRM summaries are someone else's words: they are never a verbatim source. A component restated from them counts only if the prospect, in the validation turn, states it again **in their own words** (`confirmed_with_content`); that validation quote then becomes the component's source.

**GB-20 · Absence reasons: priority and plurality.** The absence verdict stores every failed condition, and displays one main reason in this priority: `no_restitution` > `restitution_after_pitch` (when a passing restitution exists only after the pitch) > `problem_missing` > `cost_missing` > `not_validated`. Example: a pre-pitch restitution without cost and a complete one after the pitch gives the main reason `restitution_after_pitch`, with `cost_missing` stored as secondary.

**GB-21 · Merged turns.** Applies the diarization rule of Part C (C1): a sales tail or question found inside a prospect turn is reattributed to the sales before GB-8 is applied; if the split cannot be found, the turn is `attribution_doubtful` and cannot serve as a validation.


## A3c. The verbatim rules (version 1.2)

These rules make the prospect's exact words the backbone of the gap. They take precedence over any earlier rule of this annex.

**GB-22 · Key expression.** For each restated component, the model copies the **key expression**: the words of the prospect source quote that carry the component, which the sales repeats. The code accepts it only if all four conditions hold:
- (a) **it is in the source:** it is an exact substring of the cited prospect turn (normalised comparison of Part C, C3);
- (b) **it is in the restitution:** it is found in the sales clause after the allowed transformations only: person shift (I → you, me → you, my → your, mine → yours, myself → yourself, we → you, our → your, us → you, am → are, I'm → you're, I've → you've, I'd → you'd, I'll → you'll, was → were); singular / plural of the same noun ("self-doubts" = "self-doubt"); number normalisation of the Pitch annex, PB-21 ("10K" = "10,000"; French « 2 000 » = « deux mille » = « 2 k€ »). French (2026-11-19, 2026-11-21, Romain): je → tu, me → te, mon / ma / mes → ton / ta / tes, nous → vous…; the sales' « vous » counts as « tu » (« vous êtes épuisée » restates « je suis épuisée »), and a possessive is read without its gender (« ta » = « ton » = « votre »). **Nothing else:** no synonym, no other word form ("stressed" ≠ "stress", "fulfill" ≠ "unfulfilling", "scared" ≠ "fear"), no reordering;
- (c) **it carries the component:** it contains the head of the component: for PROBLEM, the word or words naming the obstacle ("support", "resources", "overthinking", "fear", "as a need"); for COST, the consequence or the amount ("miserable", "motivation", "not sleeping well", "time", "2K a month"); for A and B, the state or the value ("not in a steady paying gig", "10K", "my own business");
- (d) **it is not generic:** it contains at least one word outside the stop list and outside the generic list (thing, things, stuff, something, everything, way, lot, life, people, good, bad, better, hard, easy, want, feel, like, make, get, know, think, really, just, kind, sort, able). "You want to" or "a lot of things" is never a key expression.
Conditions (a), (b) and (d) are checked by code; (c) is answered by the model and checked by the three passes (Part C, C4).

**GB-22b · The key expression found by the code** (version 1.5, 2026-11-23). When the model names a restated component but
its source or its key expression fails (a), (b) or (d), or it gives no source, the code looks for the key expression itself:
it reads every prospect statement of **that component** said before the restitution (the model's atoms of the component,
and the figures, target clauses, costs and blockers the code lists: GB-28b, GB-7b, GB-30b; never a prompted statement,
X10), and keeps the longest run of its words that passes (a), (b) and (d) in the sales clause, the most recent statement on
a tie. The source being a statement of the component, the expression carries it (c). A run whose only content word has
fewer than four letters (« do », « vie ») is never taken, nor words the sales said first (X12). The clause is then decided
as any other (X10 to X12, GB-7), and recorded `source_by_code`. Why: on the same restitution the model cited « se déplacer »
in one analysis (verbatim) and « je préfère rester à la maison » in another (paraphrased); the restitution existed in one
and not in the other. The code does **not** add a component the model did not name: tried the same day, a single common
word (« temps », « mois », « enfants », « à côté ») made false components in 4 analyses of 27.

**GB-23 · Quoting marker.** A sales clause that explicitly quotes the prospect ("in your words", "as you said", "you used the word…") still needs a key expression (GB-22): the marker alone proves nothing. With a key expression, the marker is recorded (`explicit_quote = true`) as a coaching strength.

**GB-24 · Figures.** A quantified component is verbatim through its figure only if the figure is the prospect's (GB-22 b, after normalisation). A figure rounded, converted, annualised or computed by the sales ("so that's about 30K a year") is the sales' figure: the component can still be verbatim through another key expression, but the figure never counts for G1 to G4 (X10).

**GB-25 · Correction.** After a `corrected` validation, the new restitution must contain the prospect's correction verbatim ("more like 3K" → "3K"). A new restitution that keeps the sales' wording or another figure is not a restatement of the correction: the gate fails (X9).

**GB-26 · Validation in the prospect's words.** The validation outcome is proved by an exact prospect quote (Part C, C3). For `confirmed_with_content`, the added content is quoted from the validation turn and must be the prospect's own content, not a repetition of the sales' restitution: a prospect who repeats the sales' words back ("yes, I'm stuck in the hamster wheel" after the sales said "hamster wheel") is `confirmed`, not `confirmed_with_content`.

**GB-27 · Several possible sources.** When the same component was stated several times by the prospect, any of those statements can be the source; the model cites the one whose words the sales reuses. A clause verbatim on one source and paraphrased on another is verbatim.


## A3d. The gap formula (version 1.3)

These rules select, from the prospect's quotes, the A, B and P that the restitution must restate (methodology §2.1). Selection is done **before** reading the restitution, so that the sales' choice never decides what the right A, B or P is. Every selected element is an exact prospect quote (verbatim principle).

**Cutoff of the formula** (version 1.4, 2026-11-21). The candidates of GB-28 to GB-30 are the prospect's statements **before the restitution that is judged**: the last restitution that passes the gate (GB-11), else the last restitution before the pitch, else the end of the phase window. Not the first restitution: an early partial playback (« donc le problème, c'est de vous déplacer, c'est ça ? » at the tenth minute) would hide every figure the prospect gives afterwards (« minimum 2 000 euros ») from the formula, while the restitution the sales is judged on comes later.

**GB-28 · Selecting A** (version 1.4, 2026-11-20). Candidates: the prospect's current-state quotes, from two sources. (a) The model's atoms in the answer spans (SPIN annex, SB-5) of **S** or **I** solicitations that describe a current state (SITUATION, or IMPACT stating where he is now). (b) The **figures the code lists** (GB-28b): every figure with a unit of the gap (money, time, clients) the prospect states in the discovery, whose surrounding words say it is where he is today (when the model listed the same figure as an atom, that atom is the candidate, with the code's unit when its own has no dimension: « 2000 c'est » read as unit "c"; and the code's reading of its kind stands: a figure dated to a recent month is where he is even when the model calls « j'étais à » a past, X13 is not asked about it) (« je suis payée 15 euros de l'heure », « là je suis à 2000 », « ça fait 5,50 euros l'heure », « j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ »), whatever the question it answers. A is the candidate on **the dimension that B targets**: when B is in figures, the most recent candidate in B's unit (same unit: monthly income, clients per month, hours per week; « euros de l'heure » and "EUR/hour" are one unit), else the most recent on B's dimension (money, time, clients), else **no A** (`selected_A = null`, `no_A_on_B_dimension`). When B is not in figures, A is the current-state quote in B's unit when B names a status or a career, else the one on the same object as B (SB-16), else the most recent current figure (money first, then clients, then time), else no A. Without B, A is the most recent current figure, or none. **Never A:** a fact unrelated to B (« la conférence m'a convaincu », « j'habite à Gradignan », « 3-4 heures par semaine » when B is an income); the biggest figure of the call when it is on another dimension (a past income, savings, a household budget, a mortgage); a figure stated by the sales and approved (X12); a figure the prospect dates to the past (« avant, j'étais à 2008 »; a figure dated to a recent month is where he is).

**GB-28b · The figures listed by the code.** Before the formula, the code reads every prospect turn of the discovery and lists each figure with a unit of the gap: its value, its unit (one spelling per unit), and its **kind** read from the words around it: `present` (where he is: « je suis à », « je suis payée », « je gagne », « ça fait », « actuellement », « là »…), `target` (where he wants to go: « j'aimerais », « je veux », « objectif », « minimum », « au moins », « me conviendrait », « plus que »…), `past` (« avant », « j'étais à »… unless a recent month is named), `expense` (what he pays: « je la payais 25 euros de l'heure »), `offer` (a price or the programme), `other` (no marker, a hypothesis « si tu fais 20 heures », a negation, a clause about « tu »). It also lists the **targets without a figure**: a clause opened by a wish (« j'aimerais bien tenir ça dans la distance, ça serait un objectif », « j'ai envie de la retrouver »), feelings (« j'ai envie d'en pleurer »), tics (« je veux dire ») and requests for information (« j'ai besoin de savoir ») set aside. Ages, dates, clock times, durations in months or years and percentages are not figures of the gap. A figure the sales said in the turn just before is `prompted` (X12) and never selected. Every quote is an exact passage of the prospect's turn. A figure the model already holds (same turn, same value) is not listed twice; it gives its unit to the model's atom when that one has none. The whole inventory is kept in `formula.figures` for audit.

**GB-29 · Selecting B** (version 1.4, 2026-11-20). Candidates: the prospect's targets, from two sources: the model's DESIRE atoms, and the `target` figures and target clauses the code lists (GB-28b). B is, in this order: the most recent target **in figures** stated in an **N** answer; else the most recent target in figures stated anywhere in the discovery (`B_outside_N`: the question that got « minimum 2 000 euros » was not coded N, the target is still his); else the most recent target without a figure, wherever it was said. Its horizon is attached if the prospect gave one in the same or a following N answer (binding or wished, §2). With no target at all, `selected_B = null`. The rule applied is kept (`formula.rule_AB`: `same_unit`, `same_dimension`, `figure`, `no_A_on_B_dimension`… with the source of B: `quantified_N`, `quantified_outside_N`, `N`, `outside_N`, `_clause` for a code clause).

**GB-28b, GB-29 · Reference reading of 2026-11-23.** A number of 100 or more with no unit, right after the words that place the prospect on a scale (« je suis à 1893 », « un minimum de 2 000 », « au moins », « je vise »), is an amount. A figure the model also holds gives its unit to the model's atom when the model's unit names no dimension, whatever the kind of the figure. Among the quantified targets, B is an income before a number of students before a time (« 3 000 euros » before « 20-21 heures » of lessons a week), the most recent on that dimension: the target of the gap is the result the prospect wants.

**GB-28c, GB-29c, GB-7c · Twelve new tuning calls** (version 1.6, 2026-11-24; Romain: « améliore les éléments de l'écart des
appels de contrôle »). The control calls stay untouched (C7): twelve new first sales calls were read by the expert reader
(gap only; three are not sales calls) and the rules corrected on them. The figures (GB-28c): a number of 100 or more
with no unit is an amount when the sales turn just before asks about money (« tu voudrais gagner combien ? », a salary, an
income, euros) or when the prospect calls it their ideal (« 2,100, ça serait l'optimal »); « je vise », « viser les »,
« l'optimal », « l'idéal », « je serai bien », « pour être tranquille », « il me faudrait » mark a target; « arriver à 15-16
heures » is a target in hours, not a clock time; a figure with no tense of its own that answers a question in the past
(« Comment ça se passait ? » → « 400-500 par mois ») is `past`, and the model's atom holding the same figure takes that kind;
« je suis sans revenu », « je ne gagne rien » are a present income of zero; « j'ai envie de dire » is a tic, not a wish;
« j'ai investi 6000€ » is an expense. A (GB-28c): never a past figure, an expense or an offer, whoever read it. B (GB-29c):
never a need for a solution (« j'ai besoin d'un accompagnement assez forcé », « besoin d'avoir une méthode »): that is
what the offer answers, not where the prospect wants to be. The costs (GB-7c): an illness of someone else (« mon frère est
malade », « un proche parent gravement malade ») or a health word naming a field of work (« le stress des autres »,
« formée en stress ») is not the prospect's cost; a negation a few words before (« je ne suis pas quelqu'un de stressé »)
removes it; « découvert » counts only as an overdraft (« à découvert »); common ways of saying a cost join the lexicon
(« je perdais mon temps », « la tête sous l'eau », « ça monopolise », « situation financière compliquée », « perte de
salaire », « ça précarise », « anxiogène », « c'est vraiment dur », « ça me manque », « je stagne », « avancer à pas de
fourmis »). Measured (`qa/README.md`): gap elements on the twelve new calls 25 % → 56 %; the five first tuning calls stay
at 90 %; the control calls do not move (42 to 58 % depending on the analysis replayed).

**GB-30 · The blocker and its state** (version 1.4, 2026-11-21). « Ce qui te bloque » can be wrong for two reasons that must be told apart: the analysis missed what the prospect said, or the prospect never said it because the sales never asked. So the code first decides the **state** of the blocker, over the whole discovery window (a question asked after an early restitution counts), from two things it reads itself: the sales' **stopping questions** (« qu'est-ce qui t'a empêché… », « qu'est-ce qui t'a bloqué jusqu'ici ? », « pourquoi tu ne l'as jamais fait ? », « qu'est-ce qui te manque pour que ça marche ? »; the list is the code's, tolerant to the « n' » the recorder drops; the model is asked only about the P questions the list did not match) with their answer turns, and the prospect's **blocker statements**: the model's PAIN and BLOCKER atoms, whatever the letter of the question they answer, and the blocker clauses the code lists (GB-30b).

| State | When | Selected P | Shown as |
|---|---|---|---|
| `named_when_asked` | The first stopping question whose answer holds a blocker statement | That statement; several in the answer → the object coming back most (distinct prospect turns), tie → the first named | « nommé à la question du blocage » |
| `asked_not_answered` | A stopping question was asked, no blocker in its answer (the prospect deflected) | none | « demandé, non dit » : relancer |
| `said_unasked` | No stopping question; the prospect said of their own what prevents them | A BLOCKER atom or a code blocker clause, else a PAIN: the one coming back most, tie → the most recent, **to confirm** | « dit de lui-même, à confirmer » |
| `not_asked` | No stopping question, nothing said | none | « jamais demandé » : the formula is incomplete by the sales' doing |

A pain stated elsewhere is never P by default any more (the former « comes back to most » only serves inside the answer to the stopping question, or among the blockers said unasked). `selected_P` carries the state; `blocker` carries the state, the question (turn and words) and the code's candidates. The formula conformity (GB-31) notes `blocker_not_asked` for the two states without a question answered; G5 cannot be full then.

**GB-30b · The blockers listed by the code** (version 1.4, 2026-11-21). Like the figures (GB-28b) and the costs (GB-7b): the clauses in the first person that say what prevents the prospect (« je n'arrive pas à », « je ne sais pas comment », « ce qui me bloque », « je n'ai pas le temps / les moyens / la confiance / de visibilité », « je ne me suis pas donné les moyens », « je n'ai jamais réussi », « j'ai peur de », « je n'ose pas », « il faut se déplacer », « il n'y a rien qui tombe », « le côté âge »), exact passages of the turn, set aside when the subject is the sales, in a question, in reported speech, in a hypothesis (« si j'arrive pas ») or repeated after the sales (X10). They join the `problem_statements` next to the model's atoms (the model's atom wins when both hold the same passage).

**GB-31 · Formula conformity of a restitution.** A restitution conforms to the formula when it restates, verbatim (GB-22): the selected A, the selected B, and **one single blocker as what holds him back**, which is the selected P. Two clauses on the same object count as one blocker. Deviations, stored for coaching: `A_not_selected` (another figure, typically the biggest one), `unit_mismatch` (A and B restated in different units), `several_blockers` (two or more blocker objects restated as what holds him back), `P_not_selected`, `blocker_not_asked` (v1.4: the sales never got the blocker from the prospect, GB-30 states `not_asked` and `asked_not_answered`). The order A → B → P is the recommended order of the sentence; it is not checked (to validate). Conformity is required for G5 level 2; it is never required for the absence gate.

**GB-32 · Roadmap blockers.** `roadmap_blockers` = the distinct blocker objects (SB-16) stated by the prospect in answers to **P** or **I** solicitations, before the first pitch, each with its exact quote. Same object stated several times counts once. Blockers prompted by the sales and only approved do not count (X12). The selected P is included in the count (to confirm).

**GB-33 · Roadmap warning.** Before generating the roadmap page of the pitch, the pitch assistant reads `roadmap_blockers.count`: with fewer than 3 for a 3-step roadmap (in general, fewer than the number of steps), it warns the sales (`roadmap_insufficient_blockers`) and shows which blockers are ticked. The warning is a coaching diagnostic: it does not change the Gap score.

**GB-34 · In one go.** The gap exists only if PROBLEM and COST are restated in the **same restitution** (one span, GB-1) and that restitution is validated. Components restated in different restitutions are never added up (GB-2), whatever their timing: a gap given in pieces, with the prospect speaking in between, is not a gap. The span and its duration (start and end timestamps) are stored and displayed with the gap.

## A4. Exclusion rules (summary)

These cases never count, whatever else is true:

| # | Never counts as… | Case |
|---|---|---|
| X1 | a gap | No restitution containing PROBLEM and COST, validated, before the first pitch and the first price (absence rule) |
| X2 | a restitution | A single restated component, even closed by "right?" |
| X3 | a restitution | Any passage after the first pitch or the first price |
| X4 | a component | A clause about another person, a testimonial, a generality ("most people…") |
| X5 | a component | A clause with no earlier prospect source (untraced), including a cost invented by the sales |
| X11 | a component | A clause that paraphrases the prospect: synonym, summary, other word form, no key expression found in both texts (GB-3, GB-22) |
| X13 | the selected A | The biggest figure of the call on another dimension than B (past income, savings, budget); a fact unrelated to B, whatever the question it answered (GB-28, version 1.4: an unquantified fact is never a fallback) |
| X14 | the single P | A list of blockers restated together as what holds him back; it is `several_blockers` (GB-31) |
| X15 | a gap | PROBLEM and COST restated in different restitutions, with the prospect speaking in between (GB-34) |
| X12 | a component or a figure | Words or figures first stated, rounded or computed by the sales, including setter's notes and CRM summaries (GB-19, GB-24) |
| X6 | a cost | A current income, a price, a budget |
| X7 | a validation | The answer to another question asked at the end of the restitution |
| X8 | a validation | A reaction that comes after the sales has already mentioned the offer |
| X9 | a validation | A corrected restitution that the sales did not restate |
| X10 | a prospect statement | Content first said by the sales and only approved by the prospect (`prompted_by_sales`) |

Counter-exclusions: a validation tail ("…, right?") at the end of a restitution of two components or more does **not** disqualify it (unlike a SPIN question, where the tail makes it OUT); a restitution spread over several sales turns separated only by short approvals is one restitution (GB-1).

## A5. Minimal pairs

Pairs of passages that differ by one element and change the verdict. They are the training material of annotators and the non-regression set of the machine.

| # | Passage | Verdict | Why |
|---|---|---|---|
| 1a | "So your goal is 10K a month, right?" | Not a restitution | One component (GB-4) |
| 1b | "So you're at 2K, your goal is 10K a month, right?" | Restitution (A, B) | Two components; but no PROBLEM/COST, cannot pass the gate |
| 2a | "So what's held you back is confidence, and it's cost you three years. Fair?" → "Yeah, exactly." | Gap present | PROBLEM + COST + confirmed |
| 2b | Same restitution → sales continues: "Let me show you how we fix that." | Gap absent (`not_validated`) | No prospect validation before the offer (GB-5) |
| 3a | Prospect earlier: "I've lost so much time." Restitution: "…and you've lost so much time." | COST verbatim | Key expression "lost so much time" after the person shift (GB-22) |
| 3c | Prospect earlier: "I've lost so much time." Restitution: "…and you've wasted years on this." | COST paraphrased: not a component | No key expression in both texts (X11) |
| 3b | Prospect never mentioned a cost. Restitution: "…and that's probably costing you a lot of money." | COST untraced | Invented by the sales (GB-7) |
| 4a | "…that's where you're at. Did I get that right?" → "Yes, and my husband doesn't believe in it either." | `confirmed_with_content` | New element |
| 4b | "…that's where you're at. Did I get that right?" → "Yes." | `confirmed` | No new content |
| 5a | "…and that's what's been holding you back. Is that fair?" → "Yeah." | Validation of the restitution | S3 request answered |
| 5b | "…and that's what's been holding you back. How many hours a week can you commit?" → "Maybe 10." | `none` | Answer to another question (GB-9) |
| 6a | "Amelia was exactly where you are, stuck at 2K…" | Not a component | Another person (GB-6) |
| 6b | "You're stuck at 2K, like Amelia was…" | Component A | About the prospect; the comparison is ignored |
| 7a | Restitution before the screen share | Can pass the gate | Before the pitch |
| 7b | Same restitution after the screen share | Cannot pass the gate | After the pitch (X3) |
| 8a | "…it's more like 3K." Sales: "Got it, 3K, and you want 10K…" → "Exactly." | Gate passed | Corrected then re-confirmed |
| 8b | "…it's more like 3K." Sales: "Got it. So let me show you the program." | Gate failed (`not_validated`) | Correction not restated (X9) |
| 9a | "You make 4K at your job." (as COST) | Not a cost | Income (X6) |
| 13a | Prospect: "I make 87,000 now… I used to make over 100,000." Later: "ideally a hundred." | selected A = 87,000; B = a hundred | A is the figure he wants to move (GB-28) |
| 13b | Same call, restitution: "You used to make over 100K and you want to get back there." | `A_not_selected` | The biggest figure, a past income (X13) |
| 14a | "What's held you back?" → "One, self-doubt. Two, change is scary." Restitution: "…and what's holding you back today is self-doubt." | Single P, conforms if self-doubt is the selected P | GB-30, GB-31 |
| 14b | Same answer. Restitution: "…what's holding you back is self-doubt, fear of change, and not knowing the next step." | `several_blockers`: G5 capped at 1 | X14; the other two become roadmap steps (GB-32) |
| 15a | A "2K a month", B "10K a month" | Same unit | G3 can reach 2 |
| 15b | A "2K a month", B "to quit my job" | `unit_mismatch` | B not in A's unit (GB-29) |
| 16a | Prospect (S answer): « la conférence m'a convaincu », then « le revenu que je veux, c'est minimum 2 000 euros » | selected A = null, B = « minimum 2 000 euros » | No current figure on B's dimension: A is not « la conférence m'a convaincu » (GB-28 v1.4, X13) |
| 16b | Same call, prospect earlier: « là je suis à 2000 net » | selected A = « là je suis à 2000 », B = « 3000 euros… me conviendrait » | Current figure in B's unit, listed by the code (GB-28b); `gap_value` 1000 |
| 17a | « je suis payée maximum 15 euros de l'heure » (S answer); later, to a question coded S: « c'est plus que 15 euros de l'heure » | B = « plus que 15 euros de l'heure », `quantified_outside_N` | A target in figures stated outside an N answer is selected, flagged (GB-29 v1.4) |
| 17b | « j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA, j'aimerais bien tenir ça dans la distance » | A = « 1000€ », B = « tenir ça dans la distance » (code clause) | A recent month is where he is, not a past (GB-28b); a target without a figure is taken when there is no other (GB-29) |
| 9b | "You're spending 20 hours a week on admin work that pays 23 dollars an hour." | COST, quantified | Consequence in time and money |
| 10a | Prospect: "Oh, very stressed." Restitution: "…and you've been very stressed." | COST verbatim | "very stressed" |
| 10b | Prospect: "Oh, very stressed." Restitution: "…there's been a lot of stress." | Not verbatim | Other word form, "stressed" ≠ "stress" (GB-22 b) |
| 11a | Prospect: "I'm making about 1,800 a month." Restitution: "…you're at 1,800 a month…" | A verbatim, figure counts | Prospect's figure |
| 11b | Prospect: "I'm making about 1,800 a month." Restitution: "…you're at roughly 2K…" | A not verbatim, figure does not count | Rounded by the sales (GB-24) |
| 12a | Prospect: "Failure." Restitution: "…which, in your words, is failure." | COST verbatim, `explicit_quote` | Head word reused exactly (GB-22, GB-23) |
| 12b | Prospect: "I wouldn't be happy." Restitution: "…and in your words you'd be stuck in the hamster wheel." | Not verbatim | The marker does not replace the key expression (GB-23) |

## A6. Detection reliability for the gap

The engine is trusted to identify gaps only when, on the gold set of Part C (C7):

| Measure | Definition | Threshold |
|---|---|---|
| Restitution recall | Restitutions of the gold set that the machine also identifies (same span ± 1 turn) | ≥ 95 % |
| Restitution precision | Machine restitutions that are restitutions in the gold set | ≥ 85 % |
| Component agreement | Same components on matched restitutions | κ ≥ 0.80 |
| Validation agreement | Same outcome on matched restitutions | κ ≥ 0.80 |
| Gate agreement | Same "present / absent" verdict per call | ≥ 95 % |
| Formula selection agreement | Same selected A, B and P per call, between annotators and machine | ≥ 90 % per slot |
| Roadmap count agreement | Same `roadmap_blockers.count` per call (± 0) | ≥ 85 % |
| Key expression agreement | Same verbatim / paraphrased classification per restated component, between annotators and machine | κ ≥ 0.85 |
| Verbatim check | Key expressions found by code in both the source and the sales clause, on accepted components | 100 % (deterministic; anything else is a defect) |

Until then the Gap score is labelled "provisional". The most probable confusions, and where to act: restitution missed because no opener was used (strengthen signal S2); single-component tail taken as a restitution (GB-4); answer to a final question taken as validation (GB-9); cost invented by the sales accepted (GB-7); paraphrase accepted as a component, or a generic phrase taken as a key expression (GB-22).

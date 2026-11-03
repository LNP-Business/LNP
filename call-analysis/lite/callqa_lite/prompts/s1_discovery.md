STEP S1 · THE DISCOVERY QUESTIONS (SPIN §2 to §4, annex SB-5 to SB-35)
{window}
List EVERY solicitation of the SALES asked in those turns: any proposition that asks the prospect for an answer (a
question mark, an interrogative form, or "tell me", "walk me through", "help me understand", "describe", "explique-moi",
"raconte-moi"). One interrogative clause is one item: three questions in one turn are three items (SEG-1). A tail
("..., right?", "..., non ?") belongs to the clause it closes (SEG-4). Backchannel over the prospect ("really?", "ah
oui ?") is not a solicitation (SEG-7). Only the sales asks (SEG-8). A request to confirm a restatement of the gap
("did I get that right?") or a request for the purchase decision is not listed.

For each solicitation:
- "turn", "quote": the exact words of the question itself.
- "letter", read from the question only, never from the answer; in this order, the first that applies wins:
  OUT if the expected answer is only an agreement with what the sales just asserted (out_reason "agreement"; a
  need-payoff whose content the sales supplies, "so your goal is about 10K, right?", also gets "closed_need_payoff":
  true), a choice in a list the sales gives ("sales_list"), information or an opinion about the sales' offer
  ("offer_info"), the load of a solution or how the prospect would pay or finance it ("solution_load"), or nothing of
  substance: social, logistics, framing, "does that make sense?" ("nothing");
  S if the expected answer is a neutral fact the prospect can verify today (a number, a duration, a name, a status,
  what they do today);
  N if it asks for a desired state that does not exist yet, or the value of solving the problem (not if the question
  already contains that state, names a load, bears on the offer, or its antecedent is the problem continuing);
  I if it asks what the problem does: a consequence in another domain than the problem's own;
  P if it asks for the difficulty itself, in the prospect's words (not if the sales already named it in his own words).
- "out_reason" for OUT only.
- "object": 3 to 6 words naming the problem the question and its answer bear on; the same words for the same problem.
- "stopping_question": true if it asks what stops the prospect, what held them back, what gets in the way, or why they
  have not done it yet.
- For S, P, I and N only, the register (SB-26 to SB-35): "register_domain" is one of money (income, revenue, prices,
  debt, savings), clients (clients, customers, projects, leads, bookings), time (hours, schedule, workload), family
  (partner, children, parents), future (where they want to be, who they want to become, their career or status ahead;
  a target amount of money or clients is money or clients), self_belief (confidence, motivation, fear, doubt,
  feelings), health (stress, exhaustion, sleep, energy), other, none. "register_basis", in this order:
  1 "named": the question names a domain as what the prospect should talk about (the domain asked wins over a
    premise; when two are asked, the first asked), or names a subject of one domain ("has that fear cost you
    anything?"); "register_quote" = those words of the question.
  2 "answer": an open question, that names none of the seven domains, takes the domain the prospect's answer talks
    about (the first one in the answer; "other" if none); "register_turn" = that answer turn (one of the first three
    turns of the answer), "register_quote" = the prospect's words that show it.
  3 only when the question got no answer: "reference" when it points back ("that", "it", "ça") to what the prospect
    said in the last two prospect turns before it ("register_turn", "register_quote"), else "none".
  Words that only date the question ("today", "in 12 months") are not the time domain; "personally", "your life",
  "you" name no domain.
- "answer": {"turn", "quote"}: the prospect's answer (their speech after the question, up to the next sales
  question), its key words; omit it when the question got no answer.
- "atoms": what the PROSPECT states in the answer (SB-9 to SB-24), each with "type", "turn", "quote":
  SITUATION a neutral fact about today; PAIN something not working; BLOCKER what prevents the goal; IMPACT a
  consequence of the problem in another domain; DESIRE a desired future state; VALUE why solving it matters, what it
  would change. One atom = one continuous passage of 2 to 40 words of one prospect turn; the same thing said twice is
  one atom; two different consequences are two atoms; a sentence with a state and why it matters gives a DESIRE and a
  VALUE. An answer that only agrees has no atom. Also give:
  "quantified" (an amount, a count or a duration; a frequency alone or "a lot" is not), with "value" (a number) and
  "unit" ("month", "clients", "hours per week"); for IMPACT "domain" and "problem_domain" (money, time, clients,
  family, health, self_belief, future, other); "figure_kind" for a figure: "present" (about today), "loss" (what the
  problem makes them lose), "past" (a past state), "other" (savings, a budget, a debt); "income_drop_attributed" (a
  fall from a past to a current income that the prospect attributes to the problem); "prompted_by_sales" (the sales
  said it first and the prospect only approves; when they add content, quote only the added part);
  "reported_speech" and "owned" (words of someone else, taken on in the first person); "object" (3 to 6 words, the
  problem it relates to); "dimension" for SITUATION and DESIRE (revenue, clients, time, career_status, other);
  "cause_quote" and "cause_turn" for a PAIN or BLOCKER whose cause the prospect states in a separate passage.
JSON: {"questions": [{"turn": "T030", "quote": "...", "letter": "P", "object": "...", "stopping_question": true,
  "register_domain": "clients", "register_basis": "named", "register_quote": "...",
  "answer": {"turn": "T031", "quote": "..."},
  "atoms": [{"type": "BLOCKER", "turn": "T031", "quote": "...", "object": "..."}]}]}

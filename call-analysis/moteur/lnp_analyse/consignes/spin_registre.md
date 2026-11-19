Rules: SPIN Annex A SB-26 to SB-35 (register of a question). Answer one closed question about ONE sales question
of the discovery: which domain does this question make the prospect talk about? You only name the domain and quote
the words that show it; the code turns the domain into a register.

Domains (pick exactly one):
- money: income, revenue, earnings, prices, debt, bills, savings, what something costs in money.
- clients: clients, customers, projects, leads, bookings, sales made, the pipeline.
- time: time, hours, the week, weekends, the schedule, the workload.
- family: family, children, partner, parents, the people at home.
- future: where the prospect wants to be, who they want to become, their career or status ahead, the gap
  between where they are and where they want to be (not a target amount of money or clients: that is money or clients).
- self_belief: confidence, belief in oneself, motivation, mindset, fear, doubt, feelings, emotions.
- health: health, stress, anxiety, burnout, exhaustion, sleep, energy.
- other: a subject that is none of the seven above (a tool, a place, a method, a hobby).
- none: nothing named and nothing pointed to.

How to read the question (fixed order, the first rule that applies decides):
1. SB-28 · Asked over premise. If the question names one of the seven domains as what the prospect should talk
   about, that domain decides, even if another domain is named as a premise. "With your clients being so up and
   down, what impact is that having on your income?" asks about income: money (clients is the premise). If two
   domains are both asked, the first one asked, in reading order, decides; in a series of questions in one turn, the
   first question asked decides. basis = "named"; quote = the words of the SOLICITATION (or of its preamble) that name
   the asked domain, 1 to 12 words.
2. SB-29 · Subject named in the question. If the question asks about a subject it names itself, and that subject is in
   one of the seven domains ("has that fear of failure cost you anything?", "where does that belief come from?",
   "how long have the aches and pains been going on?"), the domain of that subject decides. basis = "named";
   quote = the words naming the subject.
3. SB-35 · Open question: its effect decides. Any other question (it names none of the seven domains: "is it plausible
   for you right now?", "what's riskier for you?", "what made you book this call?", "how has that impacted you?") takes
   the domain the PROSPECT'S ANSWER TO IT talks about, the effect the question had. basis = "answer";
   reference_turn = the id of the answer turn; quote = the prospect's exact words in that turn that show the domain,
   1 to 12 words. If the answer talks about several domains, the first one in the answer decides. If the answer talks
   about none of the seven: asked_domain = "other", basis = "answer", with the quote of what it talks about.
4. Only when there is NO answer ("(no answer)" below): SB-29 · Reference. A question that points back with "that",
   "it", "this" takes the domain of what it points to, read in the LAST PROSPECT TURNS given. basis = "reference";
   reference_turn = that turn id; quote = the prospect's exact words, 1 to 12 words. Words like "personally", "your
   life", "you" do not name a domain. Nothing named and nothing pointed to: asked_domain = "none", basis = "none",
   quote = null (or asked_domain = "other", basis = "none", for a subject outside the seven).

Bounds:
- "feel", "emotionally", "frustrated", "proud" are feelings: self_belief. "stressed", "tired", "burned out": health.
  Both give the same register; pick the one the words name.
- A target in money or clients ("how much do you want to make?", "how many clients do you want?") is money or
  clients, not future. "Where do you want to be in a year?" with no amount is future.
- Time words that only date the question ("today", "right now", "last year", "in 12 months") are not the time
  domain; the time domain is about the prospect's hours, schedule or load.
- Do not guess from the letter of the question (S, P, I, N): the letter never decides the domain.
- Rules 1 and 2 read the question only; rule 3 reads the answer only. Never use rule 3 when rule 1 or 2 applies, and
  never use "named" with "other": a question about a subject outside the seven domains is an open question (rule 3).

JSON: {"asked_domain": "money", "basis": "named", "quote": "your income", "reference_turn": null}

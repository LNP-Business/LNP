"""Builds the SPIN Discovery memo 1.1 (methodology SPIN v1.3) as HTML, in the layout of memo 1.0."""
import html, sys

E = html.escape
OUT = sys.argv[1]

CSS = """
@page { size: A4; margin: 18mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font-family: Inter, sans-serif; color: #15171a; font-size: 10.2pt; line-height: 1.55; margin: 0; }
.eyebrow { font-size: 8pt; letter-spacing: .16em; font-weight: 600; color: #15171a; margin: 0 0 10px; }
h1 { font-family: 'Inter Display', Inter, sans-serif; font-size: 30pt; font-weight: 700; margin: 0 0 10px; letter-spacing: -.01em; }
.lede { font-size: 12.5pt; color: #4a5260; line-height: 1.5; margin: 0 0 16px; max-width: 88%; }
.meta { font-size: 8.6pt; color: #4a5260; margin: 0 0 6px; } .meta b { color: #15171a; }
.badge { display: inline-block; background: #15171a; color: #fff; font-size: 7.4pt; letter-spacing: .14em; font-weight: 600; padding: 5px 10px; margin: 10px 0 18px; }
.rule { border-top: 2px solid #15171a; margin: 0 0 26px; }
h2 { font-family: 'Inter Display', Inter, sans-serif; font-size: 15pt; font-weight: 700; margin: 26px 0 12px; padding-top: 14px; border-top: 1px solid #d9dde3; break-after: avoid; }
h2 .n { color: #4a5260; font-weight: 400; margin-right: 6px; }
h3 { font-size: 10.6pt; font-weight: 700; margin: 18px 0 8px; break-after: avoid; }
p { margin: 0 0 10px; }
.quote { border-left: 3px solid #15171a; padding: 2px 0 2px 16px; font-size: 12pt; line-height: 1.55; margin: 0 0 14px; }
.box { background: #f2f4f7; border-left: 3px solid #15171a; padding: 12px 18px; margin: 12px 0 16px; break-inside: avoid; }
.box b.t { display: block; margin-bottom: 4px; }
.new { background: #fff7e6; border-left-color: #b7791f; }
.tag-new { display: inline-block; font-size: 7pt; letter-spacing: .1em; font-weight: 700; color: #8a5a00; background: #fdebc8; padding: 1px 6px; border-radius: 3px; margin-left: 6px; vertical-align: 2px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 9.2pt; break-inside: auto; }
th { background: #15171a; color: #fff; text-align: left; font-weight: 600; padding: 7px 10px; font-size: 8.6pt; }
td { padding: 7px 10px; border-bottom: 1px solid #e3e6eb; vertical-align: top; }
td:first-child { font-weight: 600; }
tr { break-inside: avoid; }
.gr { display: grid; grid-template-columns: 26px 1fr; gap: 0 12px; margin: 0 0 12px; break-inside: avoid; }
.gr .c { width: 20px; height: 20px; border-radius: 50%; background: #15171a; color: #fff; font-size: 8.5pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.gr b { display: block; }
.step { display: grid; grid-template-columns: 26px 1fr; gap: 0 12px; margin: 0 0 9px; break-inside: avoid; }
.step .c { width: 18px; height: 18px; border: 1px solid #15171a; border-radius: 4px; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.case { border: 1px solid #d9dde3; margin: 12px 0 18px; break-inside: avoid; }
.case .h { background: #f2f4f7; padding: 9px 14px; font-weight: 700; border-bottom: 1px solid #d9dde3; }
.case .ctx { padding: 9px 14px 0; color: #4a5260; font-size: 9.4pt; }
.case .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 10px 14px 14px; }
.col { padding: 10px 12px; font-size: 9.3pt; }
.col.ok { background: #e9f5ee; border-top: 3px solid #1f7a4d; } .col.ko { background: #fbeaea; border-top: 3px solid #b3302f; }
.col .k { font-size: 7.6pt; letter-spacing: .14em; font-weight: 700; margin-bottom: 6px; }
.col.ok .k { color: #1f7a4d; } .col.ko .k { color: #b3302f; }
.col .w { font-size: 7.4pt; letter-spacing: .12em; font-weight: 700; color: #5b6472; }
.col p { margin: 0 0 6px; } .col .src { font-style: italic; color: #5b6472; font-size: 8.2pt; }
.levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid #d9dde3; margin: 8px 0 14px; font-size: 9pt; break-inside: avoid; }
.levels div { padding: 8px 12px; border-right: 1px solid #d9dde3; } .levels div:last-child { border-right: 0; }
.small { font-size: 8.4pt; color: #4a5260; }
ul.open { margin: 0; padding-left: 18px; } ul.open li { margin-bottom: 6px; }
.changes td:first-child { white-space: nowrap; }
"""


def table(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def say(who, t):
    return f'<p><span class="w">{who}</span> {t}</p>'


def case(title, ctx, ok, ko, ko_label="POORLY EXECUTED"):
    def col(kind, label, lines, why, src):
        return (f'<div class="col {kind}"><div class="k">{label}</div>' + "".join(say(w, t) for w, t in lines) +
                f'<p><b>Why:</b> {why}</p><div class="src">{src}</div></div>')
    return (f'<div class="case"><div class="h">{title}</div><div class="ctx">{ctx}</div><div class="cols">'
            + col("ok", "WELL EXECUTED", *ok) + col("ko", ko_label, *ko) + "</div></div>")


S, P = "SALES", "PROSPECT"
body = []
A = body.append

A('<div class="eyebrow">SKL · COMPETENCE MEMO 1 OF 4</div><h1>SPIN Discovery</h1>')
A('<p class="lede">Make the prospect say, in their own words, where they are, what is not working, what it costs them elsewhere in their life, and what solving it would be worth.</p>')
A('<p class="meta"><b>Version:</b> Memo 1.1 · 29 October 2026 (replaces Memo 1.0 of 25 October 2026)</p>')
A('<p class="meta"><b>Based on:</b> SPIN Discovery scoring methodology v1.3 (with Annex A bounding rules SB-1 to SB-35 and Annex B calibration set)</p>')
A('<div class="badge">SOURCE OF TRUTH</div><div class="rule"></div>')

A('<div class="box new"><b class="t">What changed since Memo 1.0</b>' + table(["Version", "Change"], [
    ["v1.2 · 27 Oct", "SPIN stops at the pitch: nothing after the first pitch start or price is discovery, and discovery never reopens (SB-34). Replaces the reopenings of v1.1."],
    ["v1.2 · 27 Oct", "Every coded question of the discovery is placed in one of four registers, or Other: Financial, Time &amp; load, Identity &amp; status, Mental &amp; emotional (SB-26 to SB-33). Shown, never scored."],
    ["v1.3 · 29 Oct", "An open question, one that names none of the domains, takes the register of the prospect's answer to it: the effect the question produced decides (SB-35)."],
], "changes") + "</div>")

A('<h2><span class="n">1</span>In one sentence</h2>')
A('<div class="quote">SPIN Discovery is the sales\' ability to lead the prospect, through questions, to state in their own words their current situation, what is not working, what it costs them outside the problem itself, and what solving it would be worth to them.</div>')
A('<p>The discovery succeeded when <b>the prospect, not the sales,</b> has said: a measurable starting point, at least one problem, at least two consequences of that problem in other areas of life (one of them with a number), and a desired state with the value they attach to it. These must come out of chains of questions that dig into the same problem.</p>')
A('<p>The governing principle is simple: <b>the letter of a question never produces points.</b> SKL measures the <i>effect</i> of the questions on the prospect, never the number or the type of questions. A question earns nothing by itself; only what the prospect says in response does. If question counts entered the score, sales would fire questions to fill the counter.</p>')
A('<div class="box"><b class="t">Two layers that are never mixed</b>The <b>letter layer</b> reads the sales\' question and gives it a letter (S, P, I, N or OUT). It is used for coaching only. The <b>effect layer</b> reads the prospect\'s answer and finds what it contains (situation, pain, blocker, impact, desire, value). Only the effect layer is scored. The <b>register</b> of each question (section 7) is a third reading aid: shown, never scored.</div>')

A('<h2><span class="n">2</span>Its role in the call</h2>')
A('<p><b>Where it sits.</b> Discovery opens once the social talk and the framing of the call are over, with the first real question about the prospect\'s situation, goals or problems. It runs until the sales starts the pitch or says a price, whichever comes first. A restitution of the gap in the middle does not close it: questions asked after a restitution and before the pitch are still discovery. <b>Once the pitch has started or a price has been said, nothing is discovery any more:</b> no question after it is read for SPIN, and discovery never reopens (SB-34).<span class="tag-new">v1.2</span></p>')
A('<p><b>What it receives.</b> Nothing from another competence. It is the first competence of the call. It only needs the prospect to have accepted the frame of the call.</p>')
A('<p><b>What it hands to the next competence.</b> It hands raw material, in the prospect\'s own words, to <b>Gap Formalisation</b> (memo 2): the current state (from situation answers), the problem (from pain and blocker answers), its cost (from impact answers) and the desired state (from desire answers). The Gap competence can only restate what the prospect actually said during discovery. The <b>Pitch</b> (memo 3) then answers that problem and that cost, and the <b>Objections</b> work (memo 4) relies on them when the price is discussed.</p>')
A('<p><b>Why the call fails without it.</b> Without a stated problem, there is nothing to solve. Without a stated cost, the price is compared with nothing. Without a stated value, the prospect has no reason of their own to change. A discovery made of questions that the prospect only approves gives the sales a story they told themselves, not one the prospect owns.</p>')

A('<h2><span class="n">3</span>What it is for</h2>')
A(table(["For whom", "What discovery gives"], [
    ["The prospect", "Hearing themselves say what the problem really costs them (money, time, family, health, self-belief, future) and what solving it would change. The problem becomes felt, not just known."],
    ["The sales", "The exact words, figures and stakes to restate in the gap and to answer in the pitch. A sales who has not heard them is pitching blind."],
    ["The decision", "A decision made against the prospect's own cost and value, not against the price alone. In complex sales, implication and need-payoff questions predict progress because they make the buyer state the consequences and the value (SPIN research, Rackham)."],
]))

A('<h2><span class="n">4</span>The golden rules</h2>')
for i, (t, d) in enumerate([
    ("Only the prospect's words score.", "A question is never worth anything by itself. What counts is what the prospect said in answer: a situation, a pain or blocker, an impact in another domain, a desire, a value. Ten implication questions answered \"I don't know\" are worth nothing."),
    ("Ask open. Never put the answer inside the question.", "A question that only asks the prospect to agree (\"…, right?\"), to pick from the sales' options (\"the marketing or the pricing?\"), or that already contains the desired state (\"so your goal is about $10,000, right?\") produces nothing. The prospect's \"yes\" is approval, not evidence."),
    ("Let the prospect name the problem.", "The problem must be formulated by the prospect: a lack, a blocker, a loss, a dissatisfaction, a failed attempt. If the sales names it first and the prospect confirms, the problem belongs to the sales."),
    ("Push the problem into another domain.", "An implication is a consequence outside the problem's own domain. \"I have no clients\" is the problem; \"so I can't pay my rent\" is an impact (money). \"So I get fewer projects\" is still the same problem, re-described. Implication carries the largest weight of the score."),
    ("Get a number.", "The baseline and at least one impact need an amount, a count or a duration said by the prospect (\"15 hours a week\", \"about 3K\", \"three years\"). \"A lot\", \"forever\" and \"all the time\" are not numbers. A number the sales computed and the prospect approved does not count."),
    ("Let the prospect say the desire and why it matters.", "Ask where they want to be, then what it would change. The desired state (\"10K a month\") and its value (\"so I can be home for my kids\") must both come from the prospect, before the pitch starts."),
    ("Dig, don't spread.", "Each question should reuse the prospect's last answer and go one step deeper on the same problem: problem → consequence → further consequence or value. Jumping to a new topic, or inserting a closed or list question, breaks the chain."),
    ("Stay inside discovery, and on the prospect.", "Social talk does not start discovery. Questions about the offer, the logistics of the programme, or how the prospect would pay (savings, credit, budget) are never discovery, wherever they occur. Once the pitch has started, discovery is over: questions about the prospect after it are not discovery either."),
], 1):
    A(f'<div class="gr"><div class="c">{i}</div><div><b>{t}</b>{d}</div></div>')

A('<h2><span class="n">5</span>Exclusion rules</h2><p>These rules are absolute. They apply whatever the sales intended and whatever the prospect answered.</p>')
A(table(["Never counts as…", "Case", "Example"], [
    ["A score point", "The letter of a question, or the number of questions of a letter (X8); the register of a question", "\"I asked five implication questions\" earns nothing on its own."],
    ["A discovery question (OUT)", "A question whose expected answer is only agreement with what the sales just said: any question closed by a validation tail (\"right?\", \"no?\", \"is that it?\", \"does that make sense?\")", "\"So we're essentially looking to double the income, right?\""],
    ["A discovery question (OUT)", "A desired state supplied by the sales inside the question (closed need-payoff)", "\"So your goal is probably about $10,000 then, right?\""],
    ["A discovery question (OUT)", "A choice among options listed by the sales, including \"A or B?\"", "\"You want or you need?\" · \"Is it more the marketing or the pricing?\""],
    ["A discovery question (OUT)", "A question about the offer, or about the load of a solution: the prospect's capacity to pay, the effort or plan the solution would require", "\"Do you have access to some sort of capital, whether it's credit, savings…?\""],
    ["A discovery question (OUT)", "Nothing of substance: social, logistic, framing, rhetorical", "\"Where are you calling in from?\" · \"Here is how the call will go, sound good?\""],
    ["The start of discovery", "Social, logistic or framing questions (X1)", "\"Can you see and hear me?\""],
    ["Discovery at all <span class=\"tag-new\">v1.2</span>", "Anything after the first pitch start or price: questions on the offer, logistics, financing, objections, and also questions about the prospect's situation (SB-34). Discovery never reopens. These belong to Pitch or Objections.", "After the price: \"Do you have, like, a savings or anything like that?\""],
    ["Something the prospect said", "Approval without content (\"yes\", \"exactly\", \"for sure\"); content first stated by the sales and only approved (X3)", "Sales: \"You'd love more freedom, right?\" Prospect: \"Yes.\""],
    ["An impact", "A consequence in the problem's own domain; a current income (X4)", "\"I don't get any projects\" after \"I don't have clients\". \"I make 4,000 a month.\""],
    ["A desire", "A wish stated after the pitch has started: it is a reaction to the offer (X5)", "After the screen share: \"I'd love to have that community.\""],
    ["Quantified", "Vague quantities, or a frequency alone (X6, SB-24)", "\"A lot\", \"forever\", \"so much\", \"every month\"."],
    ["A chain link", "A question that does not reuse the previous answer; an atom volunteered without a question (X7)", "The sales moves to a new subject after \"it cost me three years\"."],
    ["Reported words", "Words the prospect attributes to someone else, unless they take them on as their own in the same answer (SB-23)", "\"My brother says I'll never make money from this\" (alone)."],
]))
A('<div class="box"><b class="t">When SPIN is not judged at all</b>A call is judged on SPIN only if it has a discovery with at least 5 coded questions. A technical call, a reschedule or a pure follow-up is "not applicable": it is shown but never averaged. A call where the system could not classify too many questions is excluded as a system defect, never held against the sales. The minimum of 5 is to be validated.</div>')

A('<h2><span class="n">6</span>How to judge it from a transcript</h2><h3>Reading procedure</h3>')
for i, (t, d) in enumerate([
    ("Mark the start of discovery.", "Find the first sales question about the prospect's situation, goals or problems that is not social, logistic or framing. \"What were you hoping we could help you with?\" is a valid start."),
    ("Mark the end.", "Find the first pitch start or the first price, whichever comes first. Ignore restitutions of the gap: they do not end discovery. After the end, nothing is read for SPIN: no reopening, no letter, no register, even for a question about the prospect inside the pitch (SB-34)."),
    ("Cut the sales turns into questions.", "One interrogative clause is one question. Two coordinated questions are two if the prospect could answer one without the other. An \"A or B\" alternative is one. A \"…, right?\" tail belongs to the question it closes. Backchannel (\"really?\", \"hmm?\") is never a question. Only the sales' questions are coded."),
    ("Give each question its letter", "by walking the gates in order (table below). The first \"yes\" wins. This tells you what the question asked for. It does not score."),
    ("Read the prospect's answer:", "everything they say until the next sales question. If the first answer is under 6 words and the sales said nothing in between, include the next prospect turn. When the sales stacked several questions, the answer goes to the last one, unless the prospect clearly answers an earlier one."),
    ("List the atoms in the answer,", "each as an exact quote of 2 to 40 words from the prospect: SITUATION, PAIN, BLOCKER, IMPACT (note its domain and the problem's domain), DESIRE, VALUE. Mark each as quantified or not. Strike any content the sales said first and the prospect only approved."),
    ("Check the impacts.", "If an impact's domain equals the problem's domain, it is a pain. If it is a current income, it is a situation."),
    ("Trace the chains.", "Look for a P whose answer gave a pain or blocker, followed by an I whose answer gave an impact on the same problem, followed by another I or an N whose answer gave an impact, desire or value on the same problem, each question reusing the previous answer."),
    ("Score the five items", "from the atoms (table \"What the verdict looks like\"). Level 2 always needs two distinct prospect quotes."),
    ("Place each coded question in its register", "(section 7). It never changes a letter, an atom or the score."),
], 1):
    A(f'<div class="step"><div class="c">{i}</div><div><b>{t}</b> {d}</div></div>')

A('<h3>How to code a question (the five gates)</h3><p>Ask these questions in this order about each sales question. At each gate, check the exclusion before the positive test. The first "yes" decides.</p>')
A(table(["Gate", "Question to ask", "If yes"], [
    ["0 · Routing", "Does it ask the prospect to confirm a complete restitution of the gap, or ask for a purchase decision?", "Not SPIN (Gap or close)"],
    ["1 · OUT", "Is the expected answer only: agreement with what the sales just said; a choice among the sales' options; information or opinion about the offer; the load of a solution (capacity to pay, effort, plan); or nothing of substance?", "OUT"],
    ["2 · S", "Is the expected answer a neutral fact the prospect could verify today (a number, a duration, a name, a status, what they do today)? No if it asks them to name a difficulty, a consequence or a future state.", "S · Situation"],
    ["3 · N", "Is the expected answer a desired state that does not exist yet, or the value of solving the problem? No if the question already contains that state or value, names a load, or bears on the offer.", "N · Need-payoff"],
    ["4 · I", "Is the expected answer a consequence of the problem in a domain other than the problem's own?", "I · Implication"],
    ["5 · P", "Is the expected answer the difficulty itself, formulated by the prospect? No if the sales already named it in their own words.", "P · Problem"],
]))
A('<p>Three rules always win over the reading: a final validation tail always makes the question OUT (agreement); a desired state contained in the question always makes it OUT (closed need-payoff); a question on the load of a solution or on the value of the offer is always OUT. A yes/no form alone does not make a question OUT: "has that impacted you personally in any way?" is an I, because the sales asserts nothing to agree with.</p>')
A('<p>The answer never changes the letter. A situation question that receives a quantified pain stays an S. An implication question answered "not really" stays an I. The letter is coaching information; the atoms are the score.</p>')

A('<h3>Quantified or not</h3>')
A(table(["Quantified (counts)", "Not quantified"], [
    ["<span style='font-weight:400'>An amount, a count or a duration attached to the atom, said by the prospect: \"2K\", \"three clients\", \"two years\", \"15 hours a week\", \"probably 40K, we're in debt now\".</span>",
     "Vague quantities: \"a lot\", \"forever\", \"so much\". A frequency alone: \"every month\", \"all the time\". A number that sits only in the sales' question. A figure the sales computed and the prospect approved."],
]))
A('<p><b>Figures: situation or impact?</b> A figure that describes the present (revenue, hours, number of clients) is a SITUATION. A figure that describes what the problem makes the prospect lose (money left on the table, months lost, hours wasted) is an IMPACT. A current income is never an impact. A drop between a past and a current income, explicitly attributed by the prospect to the problem ("I went from 175K to 58K since…"), is a quantified impact (money).</p>')

A('<h3>What the verdict looks like</h3><p>Five items, each at level 0, 1 or 2. Call score = sum of (weight × level ÷ 2), on 100. The weights are proposals, to be validated.</p>')
A(table(["Item", "Weight", "Level 1", "Level 2"], [
    ["D1 Baseline", "15", "At least one situation related to the goal, not quantified", "At least two quantified situations related to the goal (for example current revenue and hours per week)"],
    ["D2 Problem", "20", "One distinct pain or blocker", "Two or more distinct pains or blockers, or one with its cause stated by the prospect"],
    ["D3 Implication", "30", "One impact", "Two or more impacts in distinct domains, at least one quantified"],
    ["D4 Need-payoff", "20", "A desire (desired state)", "A desire and a value (why it matters, what it would change)"],
    ["D5 Depth", "15", "One deep chain", "Two or more deep chains on different problems"],
]))
A('<p class="small">Level 0 = nothing of the kind. "Related to the goal": the situation bears on the same dimension as a desire stated in the call (revenue, clients, time, career status); if no desire was stated, any quantified situation counts. Level 2 always needs two distinct prospect quotes; D5 level 2 needs the quotes of both chains. An atom the prospect volunteered without a question counts for D1 to D4, never for D5 (to be validated).</p>')
A('<div class="levels"><div><b>Mastered · 85 to 100</b><br>Executed correctly on almost every call.</div><div><b>Developing · 60 to 84</b><br>Executed, with recurrent gaps.</div><div><b>Needs work · 0 to 59</b><br>Not executed reliably.</div></div>')
A('<p><b>Floor rule.</b> Over a period, if any item reaches level 2 on fewer than 25 % of the calls, the competence cannot be rated above Developing, whatever the average. An average must not hide a gesture that is almost never done.</p>')
A('<p><b>Example of a call score</b> (illustrative). Two quantified situations (D1 = 2 → 15), one pain (D2 = 1 → 10), one impact (D3 = 1 → 15), a desire and a value (D4 = 2 → 20), no deep chain (D5 = 0 → 0). Score: 60, Developing. The fastest gain is on implication and depth: one more impact in another domain with a number, reached by following up on the pain, would add 15 to 22 points.</p>')
A('<div class="box"><b class="t">Coaching indicators (shown, never scored)</b>The letter layer feeds diagnostics: letter mix, share of P questions followed by an I (target 50 %, to be validated), share of prompted questions (target 15 % or less, to be validated), number of closed need-payoffs (target 0). Observed starting point on 85 calls (June to October 2026): implication was 12 % of coded questions, 23 calls had no implication question, and a P was followed by an I in only 10 % of cases. The registers (section 7) show which ground of the prospect\'s life the discovery covered. These explain a score; they never enter it.</div>')

# ---------------------------------------------------------------- 7 registers (new)
A('<h2><span class="n">7</span>The registers of the questions <span class="tag-new">v1.2 · v1.3</span></h2>')
A('<p>Every coded question of the discovery (S, P, I or N, from the start of discovery to the first pitch start or price) is placed in <b>one register</b>. The register tells the sales and the coach which ground of the prospect\'s life the discovery opened, and which it left untouched. It is <b>shown, never scored</b>: it changes no letter, no atom, no item and no score.</p>')
A(table(["Register", "Domains", "What it covers"], [
    ["Financial", "money, clients", "Income, revenue, prices, debt, bills; clients, projects, leads, the pipeline (a lack of clients turns into money)."],
    ["Time &amp; load", "time, family", "Hours, the week, the schedule, the workload; the time taken from the family."],
    ["Identity &amp; status", "future", "The gap between where the prospect is and where they want to be: who they want to become, their career or status ahead."],
    ["Mental &amp; emotional", "self-belief, health", "Confidence, motivation, mindset, fear, doubt, feelings; stress, anxiety, exhaustion, sleep, energy."],
    ["Other", "anything else", "A subject outside these domains (a tool, a place, a method), or nothing at all."],
]))
A('<p><b>No register</b> for: a question after the first pitch start or price (it is not SPIN at all); an OUT question (it is out of SPIN); a question outside the discovery; a question the system could not decide (to review).</p>')
A('<h3>How to place a question (in this order, the first rule that applies decides)</h3>')
for i, (t, d) in enumerate([
    ("The question names the domain it asks about.", "That domain decides, not the premise. \"With your clients being so up and down, what impact is that having on your income?\" asks about income: <b>Financial</b> (clients is only the premise). When two domains are both asked, or several questions are stacked in one turn, the first one asked decides."),
    ("The question names a subject of one of the domains.", "The domain of that subject decides. \"Has that fear of failure cost you anything?\", \"Where does that belief come from?\": <b>Mental &amp; emotional</b>. \"How long have the aches and pains been going on?\": <b>Mental &amp; emotional</b> (health)."),
    ("Otherwise it is an open question: its effect decides.<span class=\"tag-new\">v1.3</span>", "A question that names none of the domains takes the register of <b>the prospect's answer to it</b>: the ground the question opened. \"Is it plausible for you in this season of life?\", \"What's actually riskier for you?\", \"What made you book this call?\", \"How has that impacted you?\". If the answer is \"I have no clients and it's killing my income\", the question is <b>Financial</b>. If the answer touches several domains, the first one in the answer decides; if it touches none, Other."),
    ("Only when the question got no answer:", "a question that points back (\"how has that impacted you?\") takes the domain of what it points to in what the prospect had just said; a question that names nothing and points to nothing is <b>Other</b>."),
], 1):
    A(f'<div class="step"><div class="c">{i}</div><div><b>{t}</b> {d}</div></div>')
A('<p><b>Bounds.</b> A target in money or clients ("how much do you want to make?") is Financial, not Identity &amp; status; "where do you want to be in a year?" with no amount is Identity &amp; status. Words that only date the question ("today", "right now", "last year") are not the time domain. "Personally", "your life", "you" name no domain. The letter never decides the register: an I question can be Financial, Time &amp; load or Mental &amp; emotional.</p>')
A('<div class="box new"><b class="t">Why open questions are read in the answer (v1.3, 29 October 2026)</b>On questions like "is it plausible for you right now?" or "what\'s riskier for you?", the sales\' words do not choose a ground; the prospect\'s answer shows the ground the question opened. Reading these questions in the question alone gave unstable results (on a real call of October 2026, the three readings split on two such questions). Reading them in the answer, with the prospect\'s exact words as proof, follows the principle of the whole memo: the effect on the prospect decides.</div>')
A('<div class="box"><b class="t">Reliability of the registers</b>Target: at least 92 % of the questions in the right register. Each register is read three times independently, each reading proved by an exact quote checked by the system; a disagreement goes to an arbiter who walks the rules above in order; a question that cannot be decided is left out. When fewer than 92 % of the registers of a call were decided by three identical readings, the call is flagged and the screen says its registers are less reliable.</div>')
A(case("Case 12 · An open question is read in its answer (section 7, rule 3)",
       "The sales asks a question that names no domain. Its register comes from what the prospect answers.",
       ([(S, '"Is it plausible for you in this season of life?"'), (P, '"Honestly, with the kids still at home, I only have the evenings."')],
        "The question names none of the domains: it is an open question. The answer opens the ground of time and family: <b>Time &amp; load</b>.", "Illustrative"),
       ([(S, '"Is it plausible for you in this season of life?"'), (P, '"I\'d have to find the money first, I\'m still paying off the credit card."')],
        "The same question, another effect: the answer opens the money ground, so the register is <b>Financial</b>. Neither reading is wrong: the register records where the question took the prospect.", "Illustrative"),
       ko_label="SAME QUESTION, OTHER ANSWER"))

# ---------------------------------------------------------------- 8 cases
A('<h2><span class="n">8</span>Practical cases: well executed vs poorly executed</h2>')
A('<p class="small">Real excerpts are exact quotes from calls of the calibration set (Annex B), transcription errors included; their verdicts are proposed and still to be confirmed by two blind annotators. Illustrative excerpts are written for this memo and are labelled as such.</p>')
A(case("Case 1 · Ask for the target, do not supply it (rules 1, 2)", "The prospect has described an income that goes up and down. The sales wants the desired state.",
       ([(S, '"So in order to do all of that, how much would you need to be making on a monthly basis?"'), (P, '"I would say minimum $5,000."')], "Open N question. The target comes from the prospect, with a number: a quantified DESIRE for D4.", "Real call 001 · T033–T034"),
       ([(S, '"So we\'re essentially looking to double the income, right?"'), (P, '"Yes."')], "The desired state is inside the question and closed by \"right?\": OUT, closed need-payoff. \"Yes\" is approval only. No atom, nothing for D4.", "Real call 011 · T049–T050")))
A(case("Case 2 · Ask what it would change, not what they feel (rules 2, 6)", "The target is known. The sales wants the value of reaching it.",
       ([(S, '"What does that actually change about the day-to-day situation that you\'re in right now?"'), (P, '"Well, I feel like I could actually spend time with my kids after school instead of chasing" … "So I feel like it would just be the peace of mind of that and also trying to climb out of the debt."')], "Open N question. Two VALUE atoms in the prospect's words (family time, getting out of debt): with a desire, D4 reaches level 2. The sales had just stacked a closed \"going to 5K, right?\", which is OUT; the answer goes to this last, open question.", "Real call 001 · T045–T046"),
       ([(S, '"You want to feel proud of yourself?"'), (P, '"need to feel proud of myself. I need to. That\'s exactly it."')], "The value was stated by the sales and approved: closed need-payoff, no atom. (The prospect then added a fact about weight and medication: it counts as a situation, not as a value.)", "Real call 046 · T127–T128")))
A(case("Case 3 · Let the prospect name the problem (rule 3)", "The prospect has wanted a design business for years.",
       ([(S, '"And so in these last 14 years, whatever you actually tried to create this business?"'), (P, '"Oh, I haven\'t. No, I haven\'t. Because life gets in the way."')], "P question asking for the failed attempt. The prospect names the blocker: \"life gets in the way\" (BLOCKER for D2). Not quantified: the \"14 years\" is in the question, not in the answer.", "Real call 129 · T034–T035"),
       ([(S, '"So really the issue is that you never had the time to start, right?"'), (P, '"Yeah, pretty much."')], "The sales named the difficulty and closed it with \"right?\": OUT agreement. The problem belongs to the sales; D2 gets nothing.", "Illustrative")))
A(case("Case 4 · Push into another domain (rule 4)", "Both sales ask an implication question. Only one answer leaves the problem's domain.",
       ([(S, '"going through the aches and pains on a daily basis, especially over the last two years, has that impacted you personally in any way?"'), (P, '"I step back my hours. I normally leave the salon now probably by no later than four o\'clock in the afternoon."')], "Problem: health (arthritis). Consequence: time at work, a different domain: IMPACT for D3. The yes/no form is still an I: the sales asserts nothing to agree with.", "Real call 003 · T051–T052"),
       ([(S, '"If I may ask, how has that impacted you on a personal level?"'), (P, '"Because in the place that I am supposed to work with three people, I\'ll be having only one person."')], "The question is an I, but the answer re-describes the problem itself (short staffing). Same domain: it is a PAIN, not an IMPACT. The letter stays I; D3 gets nothing. The sales should have asked again what that does to them.", "Real call 011 · T079–T080")))
A(case("Case 5 · Turn \"a lot\" into a number (rules 5, 7)", "The prospect has named fear of failure as what holds them back.",
       ([(S, '"What do you think that fear has actually cost you?"'), (P, '"A lot of wasted time, I think."'), (S, '"Wasted time… how much, if you had to put a number on it?"'), (P, '"Honestly? Two years. I could have started two years ago."')], "The follow-up reuses the prospect's words and gets a duration. The impact (time) becomes quantified, which D3 level 2 requires.", "Illustrative"),
       ([(S, '"what do you think that fear of failure and that lack of tolerance for uncertainty has actually cost you?"'), (P, '"A lot of wasted time, I think."')], "A real IMPACT (time, outside the self-belief problem), but \"a lot\" is not a number. Left as it is, it cannot carry the quantified condition of D3.", "Real call 087 · T119–T120")))
A(case("Case 6 · The prospect's figure, not the sales' calculation (rules 1, 5)", "The sales wants the cost of the problem to be stated in money.",
       ([(S, '"You said you\'ve been at 3K for two years. What has staying there cost you, in money?"'), (P, '"Probably 2K a month I\'m not earning. And we\'ve had to put things on the credit card."')], "The loss is stated and quantified by the prospect: IMPACT (money), quantified. The \"3K\" and \"two years\" reused from earlier anchor the question but the figure of the loss is the prospect's.", "Illustrative"),
       ([(S, '"That\'s $216,000. How does that number sit with you?"'), (S, '"How do you feel about that number and those losses?"'), (P, '"it is a big loss."')], "The loss was computed and stated by the sales. The prospect only approves it and adds nothing of their own. No atom: nothing for D3, even though a big figure exists in the call.", "Real call 038 · T077–T082")))
A(case("Case 7 · Do not offer a choice (rule 2)", "The prospect said: \"I need something different. I want to, I want to wake up in the morning and be like, I am excited to do that.\" (Real call 054 · T120)",
       ([(S, '"Waking up excited… what would that change for you?"'), (P, '"I\'d stop dreading Mondays. I\'d be nicer at home, to be honest."')], "Open N question reusing the prospect's words. The answer gives VALUE in the prospect's terms, and keeps the chain going.", "Illustrative"),
       ([(S, '"You want or you need?"'), (P, '"I need to."')], "A choice between two options supplied by the sales: OUT (sales list). The answer only picks one of the sales' words: no atom.", "Real call 054 · T121–T122")))
A(case("Case 8 · Keep the chain alive (rule 7)", "The prospect has said they keep \"falling into other people's expectations of me, like what I should do or, you know, who I should be\" (pain), then, asked what it cost: \"Three years. It's cost me literally three years.\" (Real call 027 · T057–T059)",
       ([(S, '"Three years. And those three years, what have they done to how you see yourself?"'), (P, '"I feel like I\'ve let myself down. I\'m 41 and I\'m still asking permission."')], "Second I on the same problem, reusing \"three years\": a second IMPACT, in another domain (self-belief). P → I → I with follow-up on each step: one deep chain for D5, and D3 now has two domains, one quantified.", "Illustrative"),
       ([(S, '"I\'m going to interrupt you because do you want it or do you need it?"')], "A list question (OUT) right after a quantified impact. It breaks the run before the next question: the three years still count for D3, but there is no deep chain for D5.", "Real call 027 · T060")))
A(case("Case 9 · Dig into a vague answer (rule 7)", "Asked what not having done it has cost, the prospect answers: \"Everything.\" (Real call 046 · T104)",
       ([(S, '"Well, everything is pretty vague. What is everything?"'), (P, '"The life I currently want, the life I want to give my children before they\'ve moved out" … "it just makes me really unhappy with myself that I haven\'t done it"')], "\"Everything\" alone is not an atom (one word). The echo follow-up turns it into two distinct IMPACT atoms: family and self-belief.", "Real call 046 · T105–T106"),
       ([(S, '"Everything. Wow. Okay, and how many hours a week are you working right now?"')], "The sales accepts \"everything\" and changes topic with an S. No impact is produced and the chain is broken by a question on another subject.", "Illustrative")))
A(case("Case 10 · Where discovery starts (rule 8)", "Both calls open with small talk. The question is: which sales question starts the discovery?",
       ([(S, '"So, just to start us off with the context, what were you actually hoping that we could help you with?"')], "A question about what made the prospect book the call is a valid start of discovery, even after 26 turns of social talk and a framing turn.", "Real call 028 · T027"),
       ([(S, '"Where are calling in from?"')], "Social question: never the start. In this call, discovery starts later, at \"what's your North Star? What is the ultimate goal we're looking to accomplish with interior design?\" (T023).", "Real call 046 · T007"),
       ko_label="NOT A START"))
A(case("Case 11 · Money questions: the cost of the problem, not the capacity to pay (rule 8)", "Before the pitch, the sales talks about money.",
       ([(S, '"With your clients being so up and down, what does a bad month do to the household?"'), (P, '"We dip into savings. Last winter it was about 1,500 just to cover the bills."')], "I question on the problem's cost. The answer is a quantified IMPACT (money) for D3.", "Illustrative"),
       ([(S, '"And then obviously it also requires a form of investment. So are you in a position where you currently have access to some sort of capital, whether it\'s credit, savings, or something that you can use to invest into your education"')], "Inside the discovery window, but it asks whether the prospect can bear the cost of the solution: OUT (solution load). It produces no SPIN atom, wherever it is asked.", "Real call 005 · T069")))

# ---------------------------------------------------------------- 9 edge cases
A('<h2><span class="n">9</span>Edge cases and common confusions</h2>')
A(table(["Situation", "Decision"], [
    ["A yes/no question: \"has that impacted you personally in any way?\"", "Not OUT by its form. It is OUT only if the sales asserts something to agree with. Here: I (Real call 003 · T051)."],
    ["\"How long have you been doing the stressful work?\" after the prospect named stress", "S: the duration of a named problem is a fact verifiable today. \"More than ten years\" is a quantified SITUATION (Real call 028 · T039–T042)."],
    ["An implication question answered \"Not too much, really\"", "No impact (the consequence is denied). The letter stays I. If the prospect then states a wish (\"I want to have that security\"), it is a DESIRE (Real call 005 · T033–T034)."],
    ["Several questions stacked in one turn", "Each is a unit. The answer goes to the last one, unless the prospect clearly answers an earlier one; the others are unanswered and keep their letter. For the register, the first question asked decides when it names a domain."],
    ["The prospect approves and adds something", "The approval is nothing; only the added content can be an atom. \"Yes, honestly I want to pick my kids up from school\" gives a DESIRE for the added part."],
    ["A social question used to set up a metaphor (\"are you religious?\")", "OUT (nothing), even if the answer is a verifiable fact. Gate 1 comes before Gate 2 (Real call 041 · T073)."],
    ["A question about the prospect inside the pitch <span class=\"tag-new\">v1.2</span>", "Not SPIN: after the first pitch start or price nothing is read for SPIN, and discovery never reopens (SB-34). No letter, no atom, no register."],
    ["\"What would you need to do differently?\"", "N only if the answer states a future state or its value. Otherwise OUT (solution load) and no desire."],
    ["The prospect says \"I make 4,000 on a good month\"", "SITUATION, quantified. A current income is never an impact. A drop attributed to the problem (\"175K, now 58K\") is an impact (money)."],
    ["Two health quotes (\"taken a toll on my health\", \"periods of anxiety\")", "One domain: they count as one impact for D3, not two. Distinct impacts need distinct domains (Real call 028 · T046–T052)."],
    ["Several I questions on the same problem, but no P opening the run", "No deep chain. A chain must start with a P (or an N on the desire side) whose answer gave a pain or blocker (Real call 028)."],
    ["An echo follow-up: \"Tell me more\", \"How so?\", \"Meaning?\", \"A lot?\"", "Counts as following up the previous answer, even without a reused word."],
    ["A short question that only counts the problem (\"how many clients did you lose?\") inside a chain", "Does not break the chain, but is not one of its links. A backchannel question in between does not break it either."],
    ["A gap restitution in the middle of discovery", "Does not end discovery. Questions after it, before the pitch, are still SPIN."],
    ["\"Is it plausible for you in this season of life?\" · \"What's riskier for you?\" <span class=\"tag-new\">v1.3</span>", "Open questions: they name no domain. Their register is the one of the prospect's answer (section 7, rule 3)."],
    ["\"Where does that belief come from?\" <span class=\"tag-new\">v1.2</span>", "The question names its subject (a belief): Mental &amp; emotional, whatever the prospect answers (section 7, rule 2)."],
    ["\"How much do you want to make?\"", "A target in money: Financial, not Identity &amp; status."],
]))

# ---------------------------------------------------------------- 10 glossary
A('<h2><span class="n">10</span>Glossary</h2>')
A(table(["Term", "Meaning"], [
    ["Discovery perimeter", "From the first non-social question on the prospect's situation, goals or problems, to the first pitch start or first price. Nothing after it is discovery (no reopening since v1.2)."],
    ["Solicitation (question)", "Any sales proposition that asks for an answer: a question mark, an interrogative form, or a request (\"tell me\", \"walk me through\")."],
    ["Letter", "What a question asks for: S, P, I, N or OUT. Coaching only, never scored."],
    ["S · Situation", "A question asking for a neutral fact verifiable today."],
    ["P · Problem", "A question asking for the difficulty itself, in the prospect's words."],
    ["I · Implication", "A question asking for a consequence of the problem in another domain."],
    ["N · Need-payoff", "A question asking for a desired state that does not exist yet, or the value of solving the problem."],
    ["OUT", "A question that asks for agreement, a choice in the sales' list, offer information, the load of a solution, or nothing of substance."],
    ["Closed need-payoff", "A question in which the sales supplies the desired state or value and asks the prospect to confirm. Always OUT."],
    ["Atom", "One thing the prospect stated in an answer, proved by an exact quote of 2 to 40 words."],
    ["SITUATION / PAIN / BLOCKER", "A neutral fact about today / something not working / what prevents reaching the goal."],
    ["IMPACT", "A consequence of the problem in a domain other than the problem's own."],
    ["DESIRE / VALUE", "The desired future state / why it matters or what it would change."],
    ["Domain", "A unit of loss: money, time, clients, staff, sleep, health, reputation, family, self-belief, future. \"The rest of the week\" is not a domain."],
    ["Register <span class=\"tag-new\">v1.2</span>", "The ground of the prospect's life a question opened: Financial, Time &amp; load, Identity &amp; status, Mental &amp; emotional, or Other. Shown, never scored."],
    ["Open question <span class=\"tag-new\">v1.3</span>", "A question that names none of the domains, as asked or as its subject. Its register is the one of the prospect's answer to it."],
    ["Quantified", "The atom carries an amount, a count or a duration said by the prospect."],
    ["Prompted content", "Content stated by the sales first and only approved by the prospect. Never counts."],
    ["Followed up", "A question that reuses a word (4 letters or more) or a number from the previous answer, or an echo (\"How so?\")."],
    ["Deep chain", "P (pain or blocker) → I (impact) → I or N (impact, desire or value), on the same problem, each step following up the previous answer."],
    ["Volunteered", "Said by the prospect outside any answer to a question. Counts for D1 to D4, never for D5."],
]))

# ---------------------------------------------------------------- 11 open points
A('<h2><span class="n">11</span>Open points</h2><div class="box"><ul class="open">'
  + "".join(f"<li>{x}</li>" for x in [
      "The five items and their weights (15 / 20 / 30 / 20 / 15): to be validated.",
      "Coaching targets (P followed by I at 50 %, prompted questions at 15 % or less): to be validated. All real-call verdicts in this memo are proposals until confirmed by two blind annotators.",
      "Whether an atom volunteered without a question should count for D1 to D4 (current proposal: yes).",
      "The minimum of 5 coded questions for a call to be judged on SPIN.",
      "Decided on 27 October 2026: discovery ends at the first pitch or price and never reopens (SB-34); OUT questions get no register; no human-labelled verification set of the registers for now.",
      "Decided on 29 October 2026: an open question takes the register of the prospect's answer (SB-35).",
      "Still open: the word lists that recognise each register's domains (SB-30).",
      "Quantified: the latest rule (SB-24) says a frequency alone does not quantify; one calibration case (Real call 005 · T034, \"money every month\") was still marked quantified under the older rule. This memo follows SB-24.",
      "Echo follow-ups: the latest rule (SB-19) counts \"A lot?\" as a follow-up; one calibration case (Real call 017 · T076) was marked not followed up. This memo follows SB-19. The reported speech of the brother in the same call is to be arbitrated.",
      "Uncovered cases to arbitrate: \"half of the ink\" (income) as a money impact (Real call 037 · T109); the chain of Real call 050 (T094–T103), which holds only if \"what do you need to do differently\" is read as N.",
  ]) + "</ul></div>")

open(OUT, "w", encoding="utf-8").write(
    f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SKL · SPIN Discovery memo</title><style>{CSS}</style></head><body>'
    + "".join(body) + "</body></html>")
print("written", OUT)

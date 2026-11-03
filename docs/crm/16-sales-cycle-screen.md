# 16 — Screen specification: CRM › Sales cycle

Version 1 · 25 October 2026 · status: ready to build
Reference implementation: `reference/sales-cycle-v6.html` (mock-up v6, sample data). When this document and the
mock-up disagree, **this document wins**; when this document is silent, **copy the mock-up exactly** (layout,
wording, colours, spacing, behaviour).

---

## 0. How to use this document (for the builder)

1. Open `reference/sales-cycle-v6.html` in a browser and click through every element listed in §14 before writing code.
2. Read the current LNP repository first. This spec describes **only the Sales cycle screen**. It does not describe
   how LNP is organised today; adapt the integration points (§12) to the code you find, and reuse what exists
   (design tokens, confirmation popup, Page method popup, alert engine, sign-in, roles).
3. The screen reads the CRM data model of this pack (`02-data-model.md`, `04-event-pipeline.md`). Where those tables
   are not built yet, implement the view model of §3 behind one adapter function so the screen can run on sample data
   (demo mode) and on live data with no change to the UI code.
4. Every number in §2 (stage targets, SLA values) is **configuration**, never a constant in the UI code.
5. UI text is in English. Never write "closer": always "sales" / "sales rep".

---

## 1. Purpose and concept

**What the screen is for.** Follow every live lead from the **booked call** to the **first Whop payment** (won), or
to **lost / disqualified**, and show at a glance **who must act now, on what, and since when**.

**The concept, in five ideas.**

| # | Idea | What it means on screen |
|---|---|---|
| C1 | One line per lead on a shared time axis | Each lead is a horizontal line made of coloured stage bars. Lines can be compared because they share one axis. |
| C2 | Three stages with a target and a critical limit | Show → Decision → Cash. Time spent in a stage is compared with its target; overruns are hatched orange (late) or red (critical). |
| C3 | Two ways to read time | **Since booking**: hour 0 = the booking of each lead (compare cycle lengths). **Calendar**: real dates, one common "Now" line (see today and the calls of the next days). |
| C4 | "Who must act" is a concrete next step | Not "follow up": the real next step written in the last outcome form (or a rule), its urgency in words, and where it comes from. |
| C5 | 100 % of the interactions, one click away | Open a line to read every interaction in order (Story / Time scale / Table). Open the lead record to read every message, call, booking, outcome and payment, with the call analysis in a popup. The call transcript is never shown. |

**Who uses it.** The sales (Valentino) every day to know what to do; the sales lead (Romain) to steer. A sales sees
only their own cycles (row-level security, `12-security-compliance.md`); the sales lead, admins and viewers see all.

**Place in LNP.** CRM area, third view of the segmented control: `Pipeline | Leads | Sales cycle`.

---

## 2. Configuration (read from the CRM settings, never hard-coded)

### 2.1 Stages (`crm_stage_definitions`, decision F1)

| key | Name | Starts at | Ends at | Target (h) | Critical (h) | Colour |
|---|---|---|---|---|---|---|
| `show` | Show | Call booked | First call held | 96 | 168 | `#2A9D8F` |
| `dec` | Decision | First call held | Yes or no declared | 72 | 144 | `#8B67C9` |
| `cash` | Cash | Yes | First successful payment | 24 | 48 | `#4F9A5B` |

The values above are the ones of the mock-up. The SLA reference (`SKL-CRM-SLA-cycle-de-vente-v1.docx`) proposes
Show 72 / 96 late / 168 critical; whichever values Romain validates go into the configuration, not into this screen.
Times are **calendar hours** (D7).

### 2.2 SLA values used by the screen (`crm_rules`)

| key | Mock-up value | Used for |
|---|---|---|
| `first` | 1 h | First sales message after booking: "first sales message X h after booking" in the detail summary when exceeded |
| `reply` | 2 h | A sales reply slower than this is shown in red (response chips) and makes "Reply to the prospect" overdue |
| `atRisk` | 4 h | A stage whose target breaks within this time counts as "at risk" (ranking) |
| `follow` | 48 h | After this silence following a sales message, the sales must follow up |

### 2.3 Other settings

- Time zone of display: the viewer's LNP time zone (mock-up: `Asia/Dubai`). Dates formatted `en-GB`
  (`Sun, 25 Oct`, `08:51`, 24-hour clock).
- Sales reps: from `crm_members` (name, initials, avatar colour).
- Default view: axis "Since booking", row detail "Simple", sort "Most urgent", group "None", filter "All live leads",
  the first lead of the list not expanded (the mock-up opens Yassine Diallo for the demo only).

---

## 3. View model (what the screen needs)

One **adapter** builds this structure from the CRM tables (or from sample data in demo mode). The UI only reads this.

### 3.1 Lead (one per sales cycle)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | string | `crm_sales_cycles.id` | |
| `p` | string | person full name | |
| `o` | member key | cycle owner | for avatar, filter, "Sales · Malik" labels |
| `prod` | string | product of the deal | |
| `a` | number | amount of the deal (or default offer price) | € |
| `ph`, `em` | string | person phone, email | shown in the lead record |
| `opened` | timestamp | `opened_at` = booking time | hour 0 |
| `age` | number (h) | now − `opened` | computed |
| `ev` | Event[] | `crm_events` of the cycle, ordered by `occurred_at`, plus scheduled calls | see 3.2 |
| `nx` | NextStep \| null | last outcome form, or a rule | see 3.3 |

### 3.2 Event

| Field | Type | Meaning |
|---|---|---|
| `t` | number (h) | hours since the booking (`(occurred_at − opened_at)/3600`). `t > age` = scheduled (future). |
| `w` | `s` \| `p` \| `a` | actor: sales, prospect, automatic |
| `k` | kind | see table below |
| `txt` | string | text shown (message body, call title, outcome summary…) |
| `r` | number | call rank (R1, R2…) for calls, bookings, no-shows |
| `dur` | number (min) | duration of a held call |
| `st` | string | delivery status of an outgoing message: `Sent`, `Delivered`, `Read` |
| `yes` / `no` / `fu` | flag | on `decision` events: the decision |

**Event kinds and their source (canonical events of `04-event-pipeline.md`).**

| `k` | Label (channel) | Source | Actor |
|---|---|---|---|
| `booked` | iClosed booking | `call_booked` (R1 and later calls) | p |
| `remind` | iMessage · auto | automatic outbound message (warming steps, confirmations) | a |
| `im` | iMessage | `message_in` / `message_out` with channel iMessage | p / s |
| `sms` | SMS | same, channel SMS | p / s |
| `call` | Phone call | Sendblue call log (incoming / outgoing, answered or not) | s / p |
| `meet` | Video call | call held (outcome "Held", Fathom recording attached). Future `meet` = scheduled call | s |
| `meetdue` | Video call | **derived**: scheduled call whose end time passed with no outcome declared | s |
| `noshow` | No-show | outcome "No-show" | p |
| `decision` | Outcome | outcome form (`Held · Yes · €6,000 · 3 instalments`, `Held · Follow-up · next step: …`, `Held · No · reason: price`) | s |
| `paylink` | Whop link | `checkout_created` / link sent | s |
| `paid` | Whop payment | `payment_succeeded` | p |
| `note` | Note | note written in the CRM | s |

Icons: booked ◷ · remind ⏰ · im/sms ✉ · call ☎ · meet ● · meetdue ! · noshow ✕ · decision ✓ · paylink/paid € · note ✐.

### 3.3 NextStep (`nx`)

| Field | Meaning | Example |
|---|---|---|
| `txt` | the concrete action, imperative | "Call Yassine for the decision promised on Monday" |
| `src` | where it comes from | "from the R2 outcome", "her iMessage", "rule: 2 no-shows", "yes on R1, link not paid" |
| `due` | optional, hours since booking | when set, the action is due at that time even if the last message came from the sales |

Written by: the outcome form (§10.1, "Next step"), the rules engine (`crm_rules.next_move`, F4), or the
Lead follow-ups agent as a proposal. Cleared when the sales sends a message and the step had no `due`, or its `due`
was within 2 h.

---

## 4. Computations (exact rules)

Implement these as pure functions in one module, shared by the board, the expanded row and the lead record.
They are the same as `analyse()`, `respOf()`, `clusters()` in the reference implementation.

### 4.1 Stage segments

Milestones `ms = [0, tHeld, tDecision, tPaid]`:
- `tHeld` = time of the first past `meet`;
- `tDecision` = time of the first past `decision` with `yes` or `no`;
- `tPaid` = time of the first past `paid`.

For stage `i` = 0..2: start `a = ms[i]` (stop if undefined); if the decision is `no`, stop before Cash. End =
`ms[i+1]` if defined (done) else `age` (current). `dur = end − a`. Verdict `v`: `crit` if `dur ≥ critical`, `late`
if `dur > target`, else `ok`. The current stage is the segment with no end.

`closed` = `won` if paid, `lost` if decision no (disqualified is shown as lost in this version), else null.

### 4.2 Who must act ("ball"), in this order of priority (only when not closed)

1. A past `meetdue` → sales: "Declare the R{r} outcome", since the call time, overdue = age − t, source
   "call time passed, no outcome".
2. A future `meet` → **call**: the next call (event kept to show its date).
3. `nx.due` defined → sales: `nx.txt`, overdue = age − `nx.due`, source `nx.src`.
4. Last real event (not automatic, not `meetdue`) from the prospect → sales: "Reply to the prospect",
   overdue = age − t − `reply`.
5. Last real event from the sales: if silence > `follow` → sales: "Follow up the prospect", overdue = silence −
   `follow`; else → prospect: "Waiting on the prospect", time left = `follow` − silence.
6. Then, if `nx` exists and the ball is not a call and there is no `meetdue`: when the ball is the sales', its text
   becomes `nx.txt`; in all cases its source becomes `nx.src`.

### 4.3 Level and risk

- `level` = verdict of the current stage (`ok` / `late` / `crit`).
- If the sales must act and is overdue (> 0) and level is `ok` → `late`. If overdue > 24 h → `crit`.
- `risk` = not closed, current stage `ok`, target − dur ≤ `atRisk`, and the ball is not a call.

### 4.4 Tone of "Who must act" (colour and word)

| Case | Tone | Line 1 (bold) | Line 2 (small) |
|---|---|---|---|
| Won | `ok` | Won · hand over to delivery | {cycle h} cycle · first payment received |
| Lost | neutral | Lost | at {stage} · reason in the outcome |
| Sales must act | `crit` if level crit or overdue > 24 h; `late` if level late or overdue > 0; else `info` | the action text | **CRITICAL** / **LATE** tag, then "overdue X h" or "due in X h", then " · " + source |
| Call scheduled | `info` | R{r} call · {Today / Tomorrow / Yesterday / Thu} {HH:MM} | in X h · "prepare from the last analysis" if a call was already held, else "first call" |
| Waiting | neutral | Waiting on the prospect | follow up in X h · source |

Hovering a crit/late status shows "Why critical | {Stage} is X h over its N h target".

### 4.5 Response times

For each past event `e` that is not automatic and not a meeting: take the previous event from the **other** side
(not automatic, not a meeting). Count it only if no event from `e`'s side sits between them and no meeting sits
between them. `dt = e.t − prev.t`. Label "answered in X h" (sales) or "replied in X h" (prospect); red if the sales
took more than `reply`.

### 4.6 Close events (clusters)

Walking events in time order, an event closer than **14 px** (at the current zoom) to the previous one joins its
cluster. A cluster of 1 is a dot; a cluster of n is a numbered dark badge (red if it contains a no-show) that opens
the row and selects its first event in Story.

### 4.7 Projection

From now, the current stage is projected to its target (dashed ghost bar in the stage colour), then each next stage
for its full target; a green "€" marks the projected cash date. Not drawn for closed cycles.

### 4.8 Counters and filters (KPI chips)

| Chip | Counts the live leads where | Colour mark |
|---|---|---|
| All live leads | all live | ink |
| Critical | level = crit | red |
| Late | level = late | orange |
| Sales must act | ball = sales | ink |
| Calls within 24 h | a future call within 24 h | blue |
| Waiting on prospect | ball = prospect | grey |

Clicking a chip filters the board (one at a time, "All live leads" resets).

### 4.9 Sort and group

- **Most urgent** (default): rank = level weight (crit 3, late 2, risk 1, ok 0) × 1000 + 500 if at risk + overdue
  hours. Highest first.
- **Next call**: soonest future call first; leads with no call last; ties by urgency.
- **Amount**: highest first; ties by urgency.
- **Time in stage**: longest current stage first.
- **Group**: None (one section "Live · n") · Who must act (Sales must act / Call scheduled / Waiting on the prospect)
  · Stage (Show / Decision / Cash). Empty groups are hidden.
- Closed leads are always in a last section "Closed · n" with a Show / Hide link.

### 4.10 Lead record summary (3 lines)

Written by Claude from the events (proposal; label "Summary · written by Claude from the events · proposal").
Store it on the cycle and refresh it after each new event. Fallback when no summary is stored yet (rule-based):
1. The calls: "R1 held Thu, 15 Oct (50 min) · R2 no-show …", or "Booked … ; no call yet."
2. The last outcome ("Last outcome: Held, Follow-up, reason: timing, next step: …") or the next call.
3. "Won: hand over to delivery", or the prospect's last words (≤ 80 characters) and how long ago.

---

## 5. Page layout

```
[mock-up label — demo only]
TOP BAR     [Pipeline | Leads | Sales cycle]                         [Search a lead] [All sales reps ▾] (i)
KPI CHIPS   [11 All live leads] [4 Critical] [2 Late] [7 Sales must act] [1 Calls within 24 h] [1 Waiting on prospect]
TOOLBAR     [Since booking | Calendar] [24 h|72 h|168 h|All]  ROW [Simple|Full]  SORT [▾]  GROUP [▾]   [My Day › Needs you (6)]
BOARD       LEAD · STAGE (250 px) | time ruler / lanes (flexible) | WHO MUST ACT · NEXT STEP (270 px)
LEGEND
```

- Page: background `#F6F4EF`, max width 1480 px, padding 24 / 32 / 40 px, gap 16 px. Designed for 1440 px.
- Fonts: Fraunces (titles of dialogs), IBM Plex Sans (text), IBM Plex Mono (hours, times, amounts).
- Colours: ink `#1B1B18`, muted `#6B675E`, line `#E7E3DA`, soft `#ECE8DF`, gold `#D9B46A` / text gold `#9A6614`,
  late `#D97706`, critical `#C2261A`, ok `#2E7D4F`, info `#2D5C9C`.
- Top bar: segmented control (soft group, active ink / white); on the right: search (filters by name as you type),
  sales filter ("All sales reps" + each member; hidden for a sales who only sees their own cycles), round **i** button
  (Page method, §11.2). **No notification bell** on this screen.
- "My Day › Needs you (n)" chip: n = Critical + Late; it opens My Day › Needs you (CRM alerts c1–c18 live there).

---

## 6. The board

### 6.1 Ruler (sticky at the top of the board)

**Since booking.** Hour ticks (`0 h, 48 h…`, step chosen so that ≤ 12 ticks show: 1, 2, 3, 6, 12, 24, 48, 72, 96,
168 h). The **ideal cycle** is drawn once as three coloured bands (Show 96 h, Decision 72 h, Cash 24 h, side by side
from hour 0), and dashed vertical guides at their ends cross all rows.

**Calendar.** Hour 0 = now. Day labels centred on each day ("Mon 19", "Today" in gold; full "Sun, 25 Oct" when a day
is wider than 110 px; every other day when narrower than 46 px). Thin vertical lines at midnight. A gold vertical
**Now** line across all rows with a dark pill "Now 08:51". When the window is ≤ 96 h, hour ticks 06:00 / 12:00 /
18:00 are added.

**Window.** Zoom buttons 24 h / 72 h / 168 h / All. Since booking: default 0 → 340 h; All = 0 → 340 h; a zoom keeps
the centre. Calendar: default −170 h → +120 h; All = from the oldest booking − 8 h to +122 h; a zoom places now at
60 % of the window. Drag a lane to pan; mouse wheel pans; Ctrl/⌘ + wheel zooms around the pointer (6 h to 600 h).
**Since booking never shows hours before 0**; Calendar never goes before the oldest booking − 12 h.

### 6.2 A row (height 60 px)

**Lead column (250 px).** Chevron (rotates when open) · avatar of the sales (initials, colour) · two lines:
- the person's name (bold, ellipsis);
- a small square in the stage colour + "{Stage} · **{dur} h** / {target} h", the duration in mono, coloured orange or
  red when late or critical. Closed: "Won · 160 h cycle" / "Lost · …".

Clicking anywhere in the column opens or closes the row.

**Lane.** On a thin base line, in this order:
1. stage bars (8 px high, rounded) in the stage colour — done stages to their end, the current stage up to its target;
2. overrun: from the target to now, hatched **orange** (late) or **red** (critical) for the current stage; done stages
   that overran keep a hatched part in their own colour with an orange/red underline;
3. projection ghosts and the "€" (§4.7);
4. interaction dots above the line: sales = dark, prospect = white with gold ring, automatic = small grey,
   no-show = red ✕, payment = green, scheduled = dashed; clusters as numbered badges (§4.6);
5. **next call chip** below the line, under each scheduled call: "R2 · Thu 19:00" (blue, mono, with a small tick to
   the line) — always visible;
6. the **now** point (white with ink ring; red ring pulsing when the level is critical, no pulse if the user prefers
   reduced motion). Not drawn for closed cycles.

Every element has a tooltip ("Decision · in progress | 236 h for a target of 72 h", "Scheduled · hour 80 | …",
"3 interactions within 1.5 h | list | Click to read them"). Hit area of dots ≥ 24 px.

**Row: Simple / Full.** Simple (default) hides dots, clusters and ghosts; they appear when the row is hovered or open.
Full shows them on every row. Stage bars, overrun, now, € and next-call chips are always shown.

**Who must act column (270 px).** A block with a 3 px left border in the tone colour, line 1 bold (2 lines max), line
2 small (ellipsis), as in §4.4.

### 6.3 Expanded row

Opens under the row, full width, gold-tinted background. Several rows can be open at once.

**Toolbar.** Segmented `Story | Time scale | Table` (shared by all open rows) · summary "**19** interactions ·
**0** slow sales replies · first sales message **1.5 h** after booking" (the last part only when over `first`) ·
quick actions (§9) · "Open lead record".

**Story (default).** Horizontal scroll of 184 px columns, one per event, in time order, scrolled to the end (now)
when opened. Each column has four rows: stage badge (30 px), sales/automatic card (118 px), axis (66 px), prospect card
(118 px).
- A new stage starts a column with a coloured top bar, a dashed left border and a badge "Decision · **236 h** / 72 h".
- Cards: icon, channel in bold, actor name; text clamped to 3 lines (full when selected); response chip ("answered
  in 1.5 h", red when slow) or "scheduled". Prospect cards are cream with a gold border, automatic cards dashed grey,
  scheduled cards dashed.
- Axis: dot coloured by actor/kind, "h 204", the gap since the previous event as a chip ("+1 h"; "⋯ +44 h ⋯" dashed
  when ≥ 24 h). Under a held call: a gold "Call analysis" button (opens §8).
- A **Now** column at the current time (between past and scheduled events): "Sales' move" (red card if overdue) or
  "Prospect's move" card with the ball text and "overdue X h" / "silent for X h".
- Keyboard: ← → move the selection between events; the selected card is outlined in gold.

**Time scale.** Real spacing in hours from 0 to the last event + 4 h. Sales nodes above the axis, automatic on it,
prospect below; nodes closer than 30 px stack in tiers 28 px apart. Response links between a message and its answer
(dashed gold; solid red when slow). Stage bars on the axis. Now marker. Hour ticks.

**Table.** Chronological, **oldest first, hour 0 at the top**. Columns: time ("h 64"), who (sales name / Prospect /
Auto, coloured), channel (+ "· scheduled"), text, response time (red when slow). Max height 320 px, scroll.

Clicking a cluster badge on the lane opens the row in Story and selects that event.

---

## 7. Lead record (dialog, 1180 px)

Opened by "Open lead record", "Reply by iMessage", or a call-analysis link. Closed by ×, a click outside, or Esc.

### 7.1 Header

"LEAD RECORD" · name (Fraunces 28 px) · line: status pill (§4.4 tone and line 1), sales name, product, amount, phone,
email · stage chips ("Show 64 h / 96 h", "Decision 236 h / 72 h **+164 h**") and "cycle opened {date} · {age} ago" ·
quick actions (§9) as normal-size buttons.

### 7.2 Main column

1. **Summary** box (gold tint): the 3 lines of §4.10.
2. **Filters**: All · Messages · Calls · Payments · Bookings and outcomes, each with its count; order toggle "Oldest
   first ⇅" / "Newest first ⇅". Mapping: im, sms, remind → Messages; call, meet, meetdue, noshow → Calls; paylink,
   paid → Payments; booked, decision, note → Bookings and outcomes.
3. **Conversation** (scroll), grouped by day (centred day separator "FRI, 23 OCT", "· scheduled" for future days). In
   oldest-first order with the "All" filter, a gold separator "Now · Sun, 25 Oct 08:51" sits between past and
   scheduled items.
   - **Messages** as bubbles: prospect left (white, border); sales right (dark blue `#1F3B5C`, white text); automatic
     right (light blue, dashed). Under each: who · iMessage/SMS · "automatic" · time · delivery status · "h 251" ·
     response chip.
   - **Calls** as cards with a left colour border: Held (green) · No-show (red) · Outcome not declared (orange, with
     "Declare the outcome" button) · Scheduled (blue, "Reminders and warming steps planned"). Line 2: "Video call ·
     day · time · duration · sales". Held: "Call analysis" button + "Recording in Fathom ↗" (link to the recording).
   - **System rows** (centred pills): bookings "· iClosed", phone calls "· Sendblue", outcomes "declared by Malik",
     Whop link and payments (green), notes (dashed).
4. **Composer** (not for closed cycles): text area "Write to Yassine…", **Send** button, line "iMessage through
   Sendblue, from {sales}'s number · {phone} · it appears in the conversation and in the response times."

### 7.3 Side column (300 px)

- **Who must act** (dark card): line 1 of §4.4, "overdue X h" in light red when overdue.
- **Interactions**: messages from the prospect · from the sales · automatic · median sales reply · calls held ·
  no-shows.
- **Calls**: "R1 · Thu, 15 Oct 12:51" + "Analysis" link (held) or "no-show" / "no outcome" / "scheduled".
- **Money**: Sold (amount of the yes, else —) · Collected (Whop) (sum of succeeded payments − refunds).
- Footer: "Everything on this page comes from iClosed, Sendblue, Fathom, Whop and the outcome forms. Call transcripts
  stay in Fathom."

---

## 8. Call analysis (popup over the lead record, 980 px)

Data: `crm_call_analyses.result` (`09-call-analysis.md`). Header: "CALL ANALYSIS", "R1 · Strategy call · {name}",
meta "day · time · duration · sales · n questions". Banner: "Post-call analyst (Claude) · method v{n} · the transcript
is not shown in the CRM; short extracts are quoted as evidence, with their time in the call."

- **SPIN count bar**: S (L1 · Situation, `#2E7D4F`), P (L2 · Problem, `#B45309`), I (L3 · Implication, `#B42318`),
  N (L4 · Need-payoff, `#1B1B18`), and "outside SPIN".
- **1 · The diagnosis** — table per register: Financial (F, `#C9A04A`), Time & load (T, `#B45309`), Identity & status
  (Id, `#7A4B00`), Mental & emotional (M, `#1B1B18`). Columns: register · questions asked in order (letter chips:
  filled = question that had an effect, outlined = no effect, "no question asked") · state pill (Deep `#2E7D4F`,
  Reinforced `#2E6FC0`, Touched `#B45309`, Absent `#6B675E`) · reading. Legend under the table.
- **2 · The lead's profile** — rows: label · the prospect's words · time in the call.
- **3 · Objections** — objection · prospect's words · when in the call (bar on the call length + time) · A · I · C
  chips (green = done, red struck = missing). "No objection in this call." when empty.
- **4 · The gap to play back** — the quote (Fraunces, gold left border) and its source cards (situation / vision, time,
  register), or a red box "No gap played back. The sales rep moved on without restating the distance between the
  situation and the vision."
- **5 · Prepare the next call** — three columns: Goals · Questions to ask · Risks.

Open question for Romain: keep the short evidence quotes, or show only the time in the call.

---

## 9. Quick actions (row toolbar and lead record header)

| Button | Shown when | Effect |
|---|---|---|
| **Declare the outcome** (primary) | a `meetdue` exists | opens the outcome form (§10.1) |
| **Reply by iMessage** | cycle not closed | opens the lead record, focuses the composer, scrolls the conversation to the end |
| **Copy the Whop link** | a yes exists and no payment yet | copies the checkout URL of the deal (`crm_deals.whop_purchase_url`); toast "Whop link copied · paste it in the conversation; the payment will be matched to this cycle" |
| **Book the next call** | not closed and no future call | copies the iClosed booking link carrying the cycle id; toast "iClosed link copied · the call it books joins this cycle" |
| **Open lead record** | always (row toolbar) | §7 |

Copy uses the clipboard inside the click; if blocked, the toast shows the link to copy by hand.

---

## 10. Writes

All writes go through security-definer RPCs that check role and ownership and write `crm_audit_log`
(`12-security-compliance.md`). The board recomputes immediately (optimistic update), then reconciles with the
saved event.

### 10.1 Outcome form (dialog, 600 px)

"OUTCOME FORM" · "R1 · {name}" · "{date · time} · {sales}".

| Field | Options | Shown when |
|---|---|---|
| Did the call take place? | Held · No-show | always |
| Decision | Yes · Follow-up · No · Disqualified | Held |
| Amount sold | number, default the deal amount | Yes |
| Instalments | 1 · 2 · 3 | Yes |
| Next step (shown in "Who must act") | text | Follow-up |
| Reason | No: Price · Timing · Partner · Not a priority · Chose another offer — Disqualified: Not the target · No budget at all · Not reachable (lists from `crm_reason_codes`) | No, Disqualified |
| Nurture | Put in nurture · No nurture | No |

Buttons: Cancel · **Save the outcome**. Effects:
- No-show → the call becomes a no-show; next step "Re-engage after the no-show", due in 2 h.
- Held → the call becomes held (Fathom duration when known); a `decision` event is written at now:
  Yes → "Held · Yes · €X · N instalments", next step "Send the Whop link" due in 1 h; Follow-up → "Held · Follow-up ·
  next step: …", next step = the text; No → "Held · No · reason: …" (+ "· nurture"), cycle lost, nurture track if
  chosen; Disqualified → cycle disqualified with its reason.
- Toast "Outcome saved · the stage, the next step and the alerts are recomputed".

### 10.2 Sending a message

Send → `crm_send_message` (Sendblue, from the owner's number) → `message_out` event at now with status `Sent`, then
`Delivered` / `Read` from the Sendblue webhooks. Empty text: focus the field, do nothing. Clears the next step as in
§3.3. Toast "Sent by iMessage through Sendblue". Blocked if the person replied STOP (show why).

---

## 11. Other elements

### 11.1 Toast
Bottom centre, dark, 3.8 s, one at a time, `role="status"`.

### 11.2 Page method (i button)
- **What it is for**: Follow every live lead from the booked call to the first Whop payment, and see who must act now.
- **How it helps**: one line per lead (time in the stage against its target, the next step written in the last
  outcome, the next call); open a line to read every interaction in order; open the lead record for 100 % of the
  messages, calls and payments, and the call analysis; act from the line (declare an outcome, reply by iMessage, copy
  the Whop link, book the next call).
- **How to use it**: each morning, Critical then Sales must act, top to bottom; Calendar shows today and the calls of
  the next days, Since booking compares cycle lengths; Row: Simple keeps lines readable, hover a line or choose Full
  to see each interaction; alerts are not repeated here, they arrive in My Day › Needs you.

### 11.3 Legend (under the board)
Show / Decision / Cash colours · "Projected, if the next stages stay on target" · Over target · Over twice the target
· sales dot · prospect dot · ✕ no-show · numbered badge "interactions too close to read: click to open them" · next
call chip · "Row: Simple shows interactions when you hover a line · drag a line to move in time".

### 11.4 Keyboard
Esc closes, in this order: outcome form, Page method, call analysis, lead record. ← → in Story. Tab order follows the
page; focus ring gold 2 px.

---

## 12. Integration in LNP (adapt to the current code)

- **Navigation**: CRM › Sales cycle, same frame as the other LNP screens (top bar, i button, no page title).
- **Data**: an adapter `salesCycleView()` returns `Lead[]` (§3) from the `crm_` tables through the Supabase client
  of the web edition (live through Realtime); demo mode (file opened without sign-in, or Artifact) uses the sample
  leads of the reference file and saves nothing.
- **Alerts**: the screen does not raise alerts. The alert engine (rules c1–c18) and My Day › Needs you do; the
  "Needs you" chip only links there.
- **Access**: Settings › Access decides if the screen shows; row-level security decides which cycles load.
- **Agents**: the summary (§4.10) and the call analysis come from Agent System agents (Lead follow-ups, Post-call
  analyst); their runs appear in Agent System › Log.
- **Confirmation popup**: no delete action on this screen; if one is added, use the existing confirmation popup.

---

## 13. States

| State | Display |
|---|---|
| Loading | board skeleton (axis + 6 grey rows); KPIs show "—" |
| No live lead | "No lead in this view." in the board; closed section still available |
| Filter with no match | same message; the chip stays selected |
| A source silent / data late | no special display here (alert c17 handles it) |
| Closed cycle | no now point, no projection, no composer, no quick actions except Open lead record |
| Viewer role | everything readable, every write button hidden |
| Error on a write | toast with the reason; the optimistic change is undone |

---

## 14. Acceptance tests (with the sample data of the reference file, now = Sun 25 Oct 2026 08:51 Dubai)

1. The board shows 11 live leads; KPIs: 4 Critical, 2 Late, 7 Sales must act, 1 Calls within 24 h, 1 Waiting on
   prospect; "Needs you" shows 6.
2. Yassine Diallo: lead column "Decision · 236 h / 72 h" in red; Who must act "Call Yassine for the decision promised
   on Monday", "CRITICAL overdue 1 h · from the R2 outcome".
3. Claire Vidal: next call chip "R1 · Today 10:21" on the lane and "R1 call · Today 10:21 · in 1.5 h · first call".
4. Switch to Calendar: day labels Mon 19 … Thu 29, "Today" in gold, Now line at 08:51; every live line ends on the
   Now line; scheduled calls are to its right.
5. Row: Simple hides the dots; hovering a row shows them; Full shows them everywhere.
6. Sort "Next call" puts Claire Vidal, then Marc Dupont, then Julien Perrot first. Group "Who must act" shows three
   sections.
7. Open Thomas Girard: "Declare the outcome" shows; save Held + Follow-up with a next step → his stage becomes Decision,
   Who must act shows the next step, the toast shows.
8. Open Yassine's lead record: summary of 3 lines; 23 items in All; filters change the counts; "Oldest first" toggles;
   send a message → it appears at the bottom, status Sent, Who must act becomes "Waiting on the prospect".
9. Click "Call analysis" under R1: the popup shows 5 sections; Esc closes it, Esc again closes the record.
10. Since booking cannot be dragged before hour 0. Table view lists hour 0 first.
11. At 400 px wide the page has no horizontal scroll.
12. A sales signed in as Valentino sees only his cycles and no sales filter; a viewer sees no write button.
13. No console error on any of the above.

---

## 15. Not in this version (do not build)

- Editing or deleting events, moving a call (done in iClosed).
- Bulk actions on several leads.
- Comparison between two call analyses (R1 → R2) — proposed for a next version.
- Date field on the follow-up next step — recommended by the SLA reference (DE-3), to add when Romain validates it.

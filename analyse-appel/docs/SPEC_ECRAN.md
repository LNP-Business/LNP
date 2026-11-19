# Call analysis screen · specification

Reference mockup: `docs/screen/call_analysis_mockup.dc.html` (built on real call 001, Jennifer S., with
illustrative scores). It is a design reference, not production code: rebuild it with the app's own components.

**Scope.** One screen = the analysis of ONE call. It is not a CRM view: no sales cycle, no payment status, no next
action, no sales note, no "Next call" tab. It lives in the lead record of the existing app and reuses its visual
language (see Design tokens).

## 1. Layout, top to bottom

| Block | Content | Data source (call record, see OUTPUT_CONTRACT.md) |
|---|---|---|
| Lead header | Avatar initial, prospect name, status chip ("Call held"), client name, sales name, round chip (R1, R2…) , Status menu, close button | App's lead record (existing) |
| Call line | Phone icon · chip `R1 · 18/06/2026 15:00 · 62 min · past` · `1 call` | Call metadata: round, start time in the sales' time zone, duration = last turn timestamp |
| Title row | "Call analysis" + button "Add transcript" | — |
| Analysis header card | Title `Call analysis — <prospect>` · button "Transcript" (toggles the transcript drawer) · four score tiles (1 Discovery, 2 Gap, 3 Pitch, 4 Objections): score /100 + level chip (Mastered ≥ 85, Developing 60–84, Needs work < 60, or Non-compliant / Gap absent / Not applicable / Excluded) · the lowest tile is marked "bottleneck" · line "provisional" while the reliability thresholds are not met | `results.<COMP>.score`, `.status`, `.verdict` |
| Call map | Horizontal timeline, one marker per anchor, left to right, each with timestamp, label and turn id: Discovery starts · Gap restatement (start → end, duration) · Validation · Pitch starts · First price · Objection (one per episode) · Decision. Scrolls horizontally on small screens | `phases.*`, `results.GAP.details` (restitution span, validation turn), `results.OBJECTIONS.details.episodes[].start`, decision request |
| Transcript drawer | Opens under the header card: the turns around the selected evidence, highlighted | `turns[]` |
| 1 · The discovery | See §2.1 | `results.SPIN` |
| 2 · The gap played back | See §2.2 | `results.GAP` |
| 3 · The pitch | See §2.3 | `results.PITCH` |
| 4 · Objections | See §2.4 | `results.OBJECTIONS` |

## 2. Sections

### 2.1 The discovery (SPIN)
- Subtitle: perimeter start → end (timestamps), number of coded questions, "read from what the prospect said, never from the letter".
- Table, one row per **domain** of the prospect's atoms (money, time, clients, family, health, self-belief, future; plus a last row "Out of SPIN"):
  - Domain name, colour square, the prospect's key quotes for that domain;
  - **Questions asked, in order**: one chip per solicitation (S green, P orange, I red, N black). Solid chip = the question produced an atom; dashed chip = no effect; hatched chip = OUT. Under the chips: count, chains;
  - **Pain · Desire** bar: number of PAIN/BLOCKER/IMPACT atoms (left, red) vs DESIRE/VALUE atoms (right, gold);
  - **State** chip: Absent, Touched, Quantified, Deep (a deep chain on this domain), Value stated, Out of SPIN ("no points").
- Legend line. Item levels D1–D5 can be shown on hover or in a details toggle.

### 2.2 The gap played back
- Status chip: `Gap present` (green) or `Gap absent · <main reason>` (red).
- Subtitle: "Problem and cost restated in one go, in the prospect's exact words, validated by the prospect, before the pitch and the price."
- **Timing of the gap**: a proportional bar over the call (0 → end) showing discovery, the restatement span (start → end, duration, number of sales turns), the validation tick, the pitch start, the first price; legend with timestamps.
- **What the sales said · exact verbatim**: the full text of the restitution turn(s), unedited, with every evaluated passage highlighted and labelled: her exact words (green), paraphrase (red, does not count), sales' own framing (orange, does not count), not her figure (grey), validation request (blue). Under it, the prospect's validation turn, with its outcome chip (confirmed / confirmed with content / corrected / rejected / none).
- **Four validity checks**, each ✓ or ✗ with a one-line justification: In one go (GB-34) · Before pitch & price · Problem + cost verbatim (GB-22) · Validated (GB-8..GB-10).
- **Component table**: Component · Prospect said (quote + timestamp) · Sales played back (quote) · Verbatim (yes / no · reason).
- Roadmap material line: number of other blockers ticked in P or I answers; Copilot warning when fewer than the roadmap steps.

### 2.3 The pitch
- Status chip: `Compliant` or `Non-compliant · <reason>` (pitch before the yes / outside her gap or the offer / outcome promise).
- Subtitle: validated blocker (quote) → category → expected mechanism.
- Compliance chips: ✓/✗ per forbidden thing, with the offending quote and turn; `?` chips for claims that could not be checked (offer reference missing).
- **Staircase**: five boxes — Step 1 Blocker, Step 2 Mechanism, Step 3 A → B, Step 4 Proof, Then roadmap — each with its state (done / paraphrased / recitation / partial / missing / not applicable / price first) and a short reason.
- **Full pitch verbatim**: every turn from the pitch start to the first price (sales and prospect, prospect turns on a grey background), in a scrollable box (max ~620 px), each turn with timestamp, turn id and speaker, evaluated passages highlighted and labelled (steps, recitation, outcome promise, claims to check, check-ins, adhesion, price).

### 2.4 Objections
- Table, one row per episode: Resistance (theme + resolution chip: resolved / acknowledged / persisting / latent) · Prospect's words · Nature (objection / anxiety · capability / anxiety · choice / inertia) · When in the call (position on a 0 → end bar with timestamp) · **A · I · E · M** chips.
- **A · I · E · M chips are buttons.** A = acknowledged, I = isolated, E = explored, M = matching gesture. Green = done, red dashed = not done, gold = partial. Clicking a letter opens, under the table, a panel with: the gesture name, its verdict chip, a one-line justification citing the rule (OB-13, OB-14, OB-15/OB-20, OB-16/OB-21), and the exact turns that prove it (timestamp, turn id, speaker, key passage highlighted). Clicking the same letter again closes the panel; the selected letter has a ring.
- Prevention tiles: Decision circuit · Budget & deadline · Past attempt, each with its state and quote (before the first price).

## 3. States

| State | Display |
|---|---|
| Competence `not_applicable` | Tile shows "Not applicable" and the reason (no pitch, no resistance); section collapsed with the reason |
| Competence `excluded` | Tile "Excluded · diarization suspect"; sections hidden; banner explaining why |
| Competence `to_review` | Tile "To review"; section shows what is pending |
| Gap absent | Score 0, red chip with the main reason; the restitution panel still shows any candidate and why it failed (diagnostics) |
| Pitch non-compliant | Score 0, red chip; items still shown as diagnostics ("raw score" on hover) |
| Provisional | Small red "provisional" label in the header card until the thresholds of Part C (C7) are met |

## 4. Design tokens (from the app's lead record)

- Ground `#F6F4EE`, cards `#FFFFFF` with border `#E7E2D6`, radius 12 px; ink `#1E1C17`; muted `#6B675C`.
- Gold `#D9A93F` (accent, chips `#FBF1DA` / text `#8A6417`); red `#B42318`; green `#2E7D4F`; blue `#2F5DA8`; orange `#C2571A`.
- Headings: Source Serif 4 (600–700). Body: IBM Plex Sans. Timestamps and ids: IBM Plex Mono.
- Section numbers in small gold squares; uppercase letter-spaced captions for table heads.
- Prefer the app's existing components and tokens over these values where they differ.

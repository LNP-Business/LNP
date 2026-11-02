# Prompt to give Claude Code

Copy this folder (`skl-call-analysis/`) into the app repository (for example under `call-analysis/`), open Claude
Code at the repository root, and paste the prompt below.

---

You are integrating the SKL sales-call analysis system into this application. Everything you need is in
`call-analysis/` (adjust the path if the folder was copied elsewhere).

**Read first, in this order, before writing any code:**
1. `call-analysis/CLAUDE.md` (the rules that override everything; copy its content into the repository's own
   CLAUDE.md under a "Call analysis" section);
2. `call-analysis/docs/ARCHITECTURE.md`;
3. `call-analysis/docs/BOUNDING_INDEX.md`, then for each competence the three files
   `docs/methodology/0N_<competence>_A_scoring.md`, `_B_bounding_rules.md`, `_C_calibration_cases.md`, and
   `docs/methodology/00_engine_common_part_C.md`;
4. `call-analysis/docs/OUTPUT_CONTRACT.md`, `docs/SCREEN_SPEC.md` (and the mockup `docs/screen/call_analysis_mockup.dc.html`),
   `docs/OPEN_DECISIONS.md`;
5. the engine code in `call-analysis/engine/` and its tests.

Then inspect this repository (stack, database, existing lead record screen, background jobs, auth, how call
recordings or transcripts arrive) and **write a plan in `call-analysis/PLAN.md` before coding**: which files you
will add or change, the database tables, the job flow, the screen components, and the open questions. Stop and show
me the plan. Do not start phase 2 until I approve it.

**Goal.** For every sales call with a transcript, the app runs the analysis, stores the call record, shows the call
analysis screen in the lead record, and feeds the performance screen (periods 7 days / this month / all).

**Phases (one pull request per phase, tests green at each step):**
1. **Engine in place.** Add the engine as a package or service in the stack that fits this repository (keep the
   Python reference if a Python worker is possible; otherwise port it module by module, keeping every rule id in
   comments and porting the 182 tests with it — the port is accepted only when all tests pass). Run the tests.
2. **Data.** Tables for: calls (metadata, round, cycle id, sales, prospect, start time UTC, time zone, status),
   turns (repaired, with ids and timestamps), call results (one row per call × competence: rules version, status,
   verdict, reasons, score, items with evidence, details JSON), audit (every model pass, arbitration, human
   correction), offer reference (versioned), case library (with consent flag and starting point). Row-level
   security consistent with the app.
3. **Ingestion and job.** When a transcript arrives (upload "Add transcript" or the recording integration already
   used by the app), map speakers to SALES / PROSPECT / OTHER (ask the user when the mapping is ambiguous), store the
   turns, enqueue the analysis job. The job runs the pipeline in the fixed order with three passes per unit,
   parallel units inside a stage, retries, and stores the call record. Model ids per tier come from configuration;
   the API key from the secret store.
4. **Call analysis screen** in the lead record, exactly as specified in `docs/SCREEN_SPEC.md`, with the app's
   own components and design tokens: header, call line with duration, four score tiles, horizontal call map,
   transcript drawer, the four sections (discovery table by domain with S/P/I/N chips; gap timing bar, full
   annotated verbatim of the restatement, four validity checks, component table; pitch compliance, staircase, full
   annotated pitch verbatim; objections table with clickable A·I·E·M opening the exact turns). Every number opens its
   evidence.
5. **Performance screen**: period aggregation (`core/aggregate.py`) per sales and competence, bottleneck, item rates,
   provisional label.
6. **Calibration harness**: a command that replays every calibration case (Annex C files) with the live model and
   reports agreement per rule; a reproducibility report (three passes) per item; an arbitration backlog view
   (`rule_ambiguity`, `uncovered_case`) for the methodology owner.

**Non-negotiable rules** (from CLAUDE.md): the model quotes, the code decides; every quote verified; three passes and
arbitration; nothing invented (missing business inputs → configuration + flag + OPEN_DECISIONS); never "closer",
always "sales"; no secrets or personal transcripts in the repository or logs; methodology wins over code.

**Ask me before:** choosing the model ids; any change to a rule, weight or threshold; deleting or migrating existing
data; anything listed in `docs/OPEN_DECISIONS.md` sections A and B.

**Acceptance criteria:**
- the 182 engine tests pass in CI, plus new tests for storage, job and screen;
- one real call processed end to end with the live model, call record stored, screen rendered with evidence
  clickable to the transcript;
- the calibration harness runs on the Annex C cases and prints agreement per competence;
- every score shown carries its rules version and the "provisional" label until the thresholds of Part C (C7) are met.

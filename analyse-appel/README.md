# LNP call analysis · handoff package

Everything needed to add the LNP call analysis system to the app with Claude Code.

| Path | What it is |
|---|---|
| `HANDOFF_PROMPT.md` | The prompt to paste into Claude Code, with phases and acceptance criteria |
| `CLAUDE.md` | Rules for Claude Code (copy into the repository's CLAUDE.md) |
| `docs/ARCHITECTURE.md` | Architecture: foundation → SPIN → Gap → Pitch → Objections, 30 model tasks, reliability, roadmap |
| `docs/BOUNDING_INDEX.md` | Index of every bounding rule (SEG, SB, GB, PB, OB) and the element it bounds |
| `docs/methodology/` | Full methodology per competence: A scoring · B bounding rules · C calibration cases; 00 common engine (Part C) |
| `docs/memos/` | The four LNP competence memos (PDF), human source of truth |
| `docs/OUTPUT_CONTRACT.md` | The call record stored per call and read by the screens |
| `docs/SCREEN_SPEC.md` + `docs/screen/` | Call analysis screen specification and mockup |
| `docs/OPEN_DECISIONS.md` | Inputs to provide, decisions to take, known contradictions, engine interpretations |
| `engine/` | Reference implementation (Python 3.11+, stdlib only), 205 tests, transcript fixtures (phone numbers redacted) |

Versions: SPIN 1.1 · Gap 1.3 (with GB-34 "in one go") · Pitch 2.0 · Objections 1.1 · Engine 1.0 · 25 October 2026.

The fixtures in `engine/tests/fixtures/transcripts/` are real prospect calls: keep the repository private.

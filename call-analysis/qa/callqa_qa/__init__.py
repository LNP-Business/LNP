"""LNP call analysis · quality measure (2026-11-20).

A reference set of calls read by a person (expected letters, registers, effects, gap, pitch, objections, scores) and the
code that measures an analysis record against it, and the reproducibility of several records of the same call (Part C,
C4: 95 % identical; SB-33: 92 % of registers right). The reference files and the transcripts hold personal data: they
never go into git (private Storage bucket `callqa-fixtures`, folder `reference/`). See README.md.
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
for p in (_ROOT / "engine", _ROOT / "lite", _ROOT / "worker"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

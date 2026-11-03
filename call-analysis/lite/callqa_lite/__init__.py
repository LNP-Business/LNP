"""LNP call analysis, lite engine (2026-11-03): five whole-transcript model steps, the code decides.

S0 phase map, S1 discovery questions (SPIN letter, register, atoms of the answers), S2 gap played back, S3 pitch,
S4 objections after the pitch (unique, with A · I · E · M) and prevention. Every quote is checked by code, every item
level, verdict and score is computed by the reference engine's decision functions (call-analysis/engine). See README.md.
Stdlib only; the reference engine is imported from ../engine.
"""
from __future__ import annotations

import sys
from pathlib import Path

LITE_VERSION = "callqa-lite-1.0"

_ENGINE = Path(__file__).resolve().parents[2] / "engine"
if str(_ENGINE) not in sys.path:
    sys.path.insert(0, str(_ENGINE))

"""Step SV · voices (Part C, C1, 2026-11-19): who says each line, checked and repaired before any other step.

The recorder (Fathom) cuts the call into sentences and gives each one a speaker label; on the calls of November 2026,
41 to 52 % of the lines of three calls had the wrong label (a short reply, the start of an answer or the next question
under the other name). The engine joins lines of one label into turns, so a wrong label merges a question with its
answer and sends quotes to the wrong role. This step runs on every call, before S0:

1. the model reads the lines (cached prefix `L001 [SALES] text`, its own system prompt) in chunks and lists the lines
   whose label is wrong, the whole line or from an exact quote on (`prompts/sv_voices.md`);
2. the code checks each correction: the line exists and is in the chunk, the role is SALES, PROSPECT or OTHER and
   differs from the label, the "from" quote is in the line (case and spaces aside); anything else is dropped and
   counted (`meta.steps.SV`); a line whose split quote is not found is marked doubtful (left out of every step);
3. the code relabels the lines, splits the two-speaker lines and rebuilds the turns (consecutive lines of one role),
   so every later step reads the repaired transcript.

C1's 10 % threshold counts here the lines left doubtful, not the repaired ones: a call is `diarization_suspect` when
more than 10 % of its lines could not be decided (lite README, approximation 3; OPEN_DECISIONS E). A step with no valid
answer leaves the transcript as recorded and flags it (`voices_unchecked`).
"""
from __future__ import annotations

import re
from typing import Any, Optional

from lnp_callqa.core.models import OTHER, PROSPECT, SALES, CallContext, Turn

from .shim import Drops
from .steps import Steps, fill, load

ROLES = (SALES, PROSPECT, OTHER)
DOUBTFUL_MAX_SHARE = 0.10          # C1 (to validate, OPEN_DECISIONS B): share of lines left undecided
CHUNK_LINES = 150
MIN_CHUNK_LINES = 40
MAX_TOKENS = 8000


def render_lines(lines: list[Turn]) -> str:
    return f"TRANSCRIPT · {len(lines)} lines\n" + "\n".join(f"{l.id} [{l.role}] {l.text}" for l in lines)


def _other(role: str) -> str:
    return PROSPECT if role == SALES else SALES


def _find(text: str, quote: str) -> int:
    """Index of the quote in the line, case and spaces aside; -1 if absent."""
    q = re.sub(r"\s+", " ", quote or "").strip().lower()
    return text.lower().find(q) if q else -1


def check(lines: list[Turn], chunk: tuple[int, int], items: list, drops: Drops) -> dict[str, dict]:
    """The corrections the code accepts for one chunk: {line id: {"role", "at"}} (at = split index, 0 = whole line;
    None = the line is doubtful)."""
    a, b = chunk
    ids = {l.id: l for l in lines[a:b + 1]}
    out: dict[str, dict] = {}
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            drops.add("SV", "not_an_object")
            continue
        lid, role = str(it.get("line") or ""), str(it.get("role") or "").upper()
        line = ids.get(lid)
        if line is None:
            drops.add("SV", "line_outside_chunk")
            continue
        if lid in out:
            drops.add("SV", "line_listed_twice")
            continue
        if role not in ROLES:
            drops.add("SV", "role_unknown")
            continue
        q = it.get("from")
        if q:
            at = _find(line.text, q)
            if at < 0:
                drops.add("SV", "quote_not_in_line", {"turn": lid})
                out[lid] = {"role": role, "at": None}
                continue
            if at > 0:
                out[lid] = {"role": role, "at": at}
                continue
        if role == line.role:
            drops.add("SV", "same_role")
            continue
        out[lid] = {"role": role, "at": 0}
    return out


def _speaker_of(lines: list[Turn]) -> dict[str, str]:
    """The recorder's name for each role (first seen), so a relabelled line keeps a speaker name of its role."""
    names: dict[str, str] = {}
    for l in lines:
        names.setdefault(l.role, l.speaker)
    return names


def apply(lines: list[Turn], fixes: dict[str, dict]) -> tuple[list[Turn], dict]:
    """Relabel and split the lines, then join consecutive lines of one role into turns T001…; a doubtful line is a
    turn of its own marked attribution_doubtful (left out of the prefix and of every computation)."""
    names = _speaker_of(lines)
    parts: list[tuple[Turn, str, str, bool, bool]] = []          # (line, role, text, changed, doubtful)
    relabelled = split = doubtful = 0
    for l in lines:
        f = fixes.get(l.id)
        if not f:
            parts.append((l, l.role, l.text, False, False))
        elif f["at"] is None:
            doubtful += 1
            parts.append((l, l.role, l.text, False, True))
        elif f["at"] == 0:
            relabelled += 1
            parts.append((l, f["role"], l.text, True, False))
        else:
            split += 1
            head, tail = l.text[:f["at"]].strip(), l.text[f["at"]:].strip()
            first = _other(f["role"]) if f["role"] in (SALES, PROSPECT) else l.role
            if head:
                parts.append((l, first, head, first != l.role, False))
            if tail:
                parts.append((l, f["role"], tail, f["role"] != l.role, False))
    turns: list[Turn] = []
    for l, role, text, changed, doubt in parts:
        last = turns[-1] if turns else None
        same = last and last.role == role and (role != OTHER or last.speaker == l.speaker)
        if same and not doubt and not last.attribution_doubtful:
            last.text = (last.text + " " + text).strip()
            last.repaired = last.repaired or changed
            continue
        n = len(turns) + 1
        spk = l.speaker if role == l.role else names.get(role, l.speaker)
        turns.append(Turn(f"T{n:03d}", n, l.ts, spk, role, text, attribution_doubtful=doubt, repaired=changed))
    stats = {"lines": len(lines), "relabelled": relabelled, "split": split, "doubtful": doubtful,
             "share_corrected": round((relabelled + split) / max(1, len(lines)), 3),
             "share_doubtful": round(doubtful / max(1, len(lines)), 3), "turns_before": None, "turns_after": len(turns)}
    return turns, stats


def run_voices(ctx: CallContext, client: Any, cfg: dict, drops: Drops) -> dict:
    """Ask, check, apply. Returns meta.voices; ctx.turns is replaced by the repaired turns."""
    lines = ctx.lines
    if not lines:
        return {"status": "no_lines"}
    steps = Steps(client, ctx, tier=cfg["tier"], effort=cfg["effort"], system=load("sv_system"),
                  prefix=render_lines(lines))
    size, low = cfg.get("sv_chunk_lines", CHUNK_LINES), cfg.get("sv_min_chunk_lines", MIN_CHUNK_LINES)
    queue = [(a, min(a + size, len(lines)) - 1) for a in range(0, len(lines), size)]
    fixes: dict[str, dict] = {}
    done = failed = 0
    while queue:
        a, b = queue.pop(0)
        la, lb = lines[a].id, lines[b].id
        ans = steps.ask("lite.sv_voices", f"{la}-{lb}", fill(load("sv_voices"), first=la, last=lb),
                        cfg["max_tokens"].get("SV", MAX_TOKENS), replay_truncated=False)
        if ans.answer is None and ans.stop_reason == "max_tokens" and b - a + 1 > low:
            mid = (a + b) // 2
            queue[:0] = [(a, mid), (mid + 1, b)]
            continue
        if ans.answer is None:
            failed += 1
            drops.add("SV", "chunk_failed")
            continue
        done += 1
        fixes.update(check(lines, (a, b), ans.answer.get("lines") or [], drops))
    if not done:
        ctx.flags.append("voices_unchecked")
        return {"status": "unchecked", "lines": len(lines)}
    before = len(ctx.turns)
    ctx.turns, stats = apply(lines, fixes)
    stats["turns_before"] = before
    stats["status"] = "checked" if not failed else "partly_checked"
    stats["chunks_failed"] = failed
    if failed:
        ctx.flags.append("voices_partly_unchecked")
    if stats["share_doubtful"] > DOUBTFUL_MAX_SHARE:
        ctx.status = "diarization_suspect"
        ctx.flags.append("attribution_rate")
    return stats

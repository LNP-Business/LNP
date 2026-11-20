"""Step SV · voices (Part C, C1, 2026-11-19): who says each line, checked and repaired before any other step.

The recorder (Fathom) cuts the call into sentences and gives each one a speaker label; on the calls of November 2026,
41 to 52 % of the lines of three calls had the wrong label (a short reply, the start of an answer or the next question
under the other name). The engine joins lines of one label into turns, so a wrong label merges a question with its
answer and sends quotes to the wrong role. This step runs on every call, before S0:

1. repair: the model reads the lines (cached prefix `L001 [SALES] text`, its own system prompt) in chunks and lists the
   lines whose label is wrong, the whole line or from an exact quote on (`prompts/sv_voices.md`, task `lite.sv_voices`);
2. the code checks each correction: the line exists and is in the chunk, the role is SALES, PROSPECT or OTHER and
   differs from the label, the "from" quote is in the line (case and spaces aside); anything else is dropped and
   counted (`meta.steps.SV`); a line whose split quote is not found is marked doubtful (left out of every step);
   the code relabels the lines and splits the two-speaker lines (the second part keeps the id with "b": L073b);
3. control (Romain, 2026-11-20): the model reads the repaired lines again, with the same question (task
   `lite.sv_control`). What it still flags, plus the lines left doubtful, are the errors left after the repair. C1:
   more than 10 % of the recorded lines → the call is `diarization_suspect` (flag `attribution_rate`), not analysed.
   Otherwise the control's corrections are applied too;
4. the code rebuilds the turns (consecutive lines of one role), so every later step reads the repaired transcript.

A repair with no valid answer leaves the transcript as recorded (flag `voices_unchecked`); a control with no valid
answer keeps the repair, without the measure (flag `voices_control_unchecked`).
"""
from __future__ import annotations

import re
from dataclasses import replace
from typing import Any

from lnp_callqa.core.models import OTHER, PROSPECT, SALES, CallContext, Turn

from .shim import Drops
from .steps import Steps, fill, load

ROLES = (SALES, PROSPECT, OTHER)
RESIDUAL_MAX_SHARE = 0.10          # C1 (to validate, OPEN_DECISIONS B): errors left after the repair, share of the lines
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


def check(lines: list[Turn], chunk: tuple[int, int], items: list, drops: Drops, step: str = "SV") -> dict[str, dict]:
    """The corrections the code accepts for one chunk: {line id: {"role", "at"}} (at = split index, 0 = whole line;
    None = the line is doubtful)."""
    a, b = chunk
    ids = {l.id: l for l in lines[a:b + 1]}
    out: dict[str, dict] = {}
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            drops.add(step, "not_an_object")
            continue
        lid, role = str(it.get("line") or ""), str(it.get("role") or "").upper()
        line = ids.get(lid)
        if line is None:
            drops.add(step, "line_outside_chunk")
            continue
        if lid in out:
            drops.add(step, "line_listed_twice")
            continue
        if role not in ROLES:
            drops.add(step, "role_unknown")
            continue
        q = it.get("from")
        if q:
            at = _find(line.text, q)
            if at < 0:
                drops.add(step, "quote_not_in_line", {"turn": lid})
                out[lid] = {"role": role, "at": None}
                continue
            if at > 0:
                out[lid] = {"role": role, "at": at}
                continue
        if role == line.role:
            drops.add(step, "same_role")
            continue
        out[lid] = {"role": role, "at": 0}
    return out


def relabel(lines: list[Turn], fixes: dict[str, dict]) -> tuple[list[Turn], dict]:
    """The lines after the corrections: relabelled, split in two (the second part "L073b"), or marked doubtful."""
    names: dict[str, str] = {}
    for l in lines:
        names.setdefault(l.role, l.speaker)                    # the recorder's name for each role (first seen)

    def part(l: Turn, role: str, text: str, pid: str, changed: bool) -> Turn:
        return replace(l, id=pid, role=role, text=text, speaker=l.speaker if role == l.role else names.get(role, l.speaker),
                       repaired=l.repaired or changed)

    out: list[Turn] = []
    n = {"relabelled": 0, "split": 0, "doubtful": 0}
    for l in lines:
        f = fixes.get(l.id)
        if not f:
            out.append(l)
        elif f["at"] is None:
            n["doubtful"] += 1
            out.append(replace(l, attribution_doubtful=True))
        elif f["at"] == 0:
            n["relabelled"] += 1
            out.append(part(l, f["role"], l.text, l.id, True))
        else:
            n["split"] += 1
            head, tail = l.text[:f["at"]].strip(), l.text[f["at"]:].strip()
            first = _other(f["role"]) if f["role"] in (SALES, PROSPECT) else l.role
            if head:
                out.append(part(l, first, head, l.id, first != l.role))
            if tail:
                out.append(part(l, f["role"], tail, l.id + "b", f["role"] != l.role))
    return out, n


def join(lines: list[Turn]) -> list[Turn]:
    """Consecutive lines of one role → turns T001…; a doubtful line is a turn of its own (left out of every step)."""
    turns: list[Turn] = []
    for l in lines:
        last = turns[-1] if turns else None
        same = last and last.role == l.role and (l.role != OTHER or last.speaker == l.speaker)
        if same and not l.attribution_doubtful and not last.attribution_doubtful:
            last.text = (last.text + " " + l.text).strip()
            last.repaired = last.repaired or l.repaired
            continue
        k = len(turns) + 1
        turns.append(Turn(f"T{k:03d}", k, l.ts, l.speaker, l.role, l.text,
                          attribution_doubtful=l.attribution_doubtful, repaired=l.repaired))
    return turns


def apply(lines: list[Turn], fixes: dict[str, dict]) -> tuple[list[Turn], dict]:
    """One pass of corrections, then the turns (kept for the tests and offline use)."""
    parts, n = relabel(lines, fixes)
    return join(parts), n


def read(ctx: CallContext, client: Any, cfg: dict, drops: Drops, lines: list[Turn], task: str, step: str) -> tuple:
    """Ask one pass in chunks (a chunk cut by max_tokens is asked again as two halves). Returns (fixes, done, failed)."""
    steps = Steps(client, ctx, tier=cfg["tier"], effort=cfg["effort"], system=load("sv_system"),
                  prefix=render_lines(lines))
    size, low = cfg.get("sv_chunk_lines", CHUNK_LINES), cfg.get("sv_min_chunk_lines", MIN_CHUNK_LINES)
    queue = [(a, min(a + size, len(lines)) - 1) for a in range(0, len(lines), size)]
    fixes: dict[str, dict] = {}
    done = failed = 0
    while queue:
        a, b = queue.pop(0)
        la, lb = lines[a].id, lines[b].id
        ans = steps.ask(task, f"{la}-{lb}", fill(load("sv_voices"), first=la, last=lb),
                        cfg["max_tokens"].get("SV", MAX_TOKENS), replay_truncated=False)
        if ans.answer is None and ans.stop_reason == "max_tokens" and b - a + 1 > low:
            mid = (a + b) // 2
            queue[:0] = [(a, mid), (mid + 1, b)]
            continue
        if ans.answer is None:
            failed += 1
            drops.add(step, "chunk_failed")
            continue
        done += 1
        fixes.update(check(lines, (a, b), ans.answer.get("lines") or [], drops, step))
    return fixes, done, failed


def run_voices(ctx: CallContext, client: Any, cfg: dict, drops: Drops) -> dict:
    """Repair, control, rebuild. Returns meta.voices; ctx.turns is replaced by the repaired turns."""
    lines = ctx.lines
    if not lines:
        return {"status": "no_lines"}
    fixes, done, failed = read(ctx, client, cfg, drops, lines, "lite.sv_voices", "SV")
    if not done:
        ctx.flags.append("voices_unchecked")
        return {"status": "unchecked", "lines": len(lines)}
    if failed:
        ctx.flags.append("voices_partly_unchecked")
    parts, n1 = relabel(lines, fixes)
    total = len(lines)
    stats: dict[str, Any] = {"lines": total, **n1,
                             "share_corrected": round((n1["relabelled"] + n1["split"]) / total, 3),
                             "chunks_failed": failed, "turns_before": len(ctx.turns)}

    # control: the repaired lines read again; what is still flagged is an error left after the repair
    cfixes, cdone, cfailed = read(ctx, client, cfg, drops, parts, "lite.sv_control", "SV2")
    if not cdone:
        ctx.flags.append("voices_control_unchecked")
        stats["control"] = {"status": "unchecked"}
        stats["share_residual"] = None
    else:
        parts2, n2 = relabel(parts, cfixes)
        residual = n1["doubtful"] + n2["relabelled"] + n2["split"] + n2["doubtful"]
        stats["control"] = {"status": "checked" if not cfailed else "partly_checked", **n2, "chunks_failed": cfailed}
        stats["residual"] = residual
        stats["share_residual"] = round(residual / total, 3)
        if cfailed:
            ctx.flags.append("voices_control_partly_unchecked")
        parts = parts2
    ctx.turns = join(parts)
    stats["turns_after"] = len(ctx.turns)
    stats["status"] = "checked" if not failed else "partly_checked"
    if stats["share_residual"] is not None and stats["share_residual"] > RESIDUAL_MAX_SHARE:
        ctx.status = "diarization_suspect"
        ctx.flags.append("attribution_rate")
    return stats

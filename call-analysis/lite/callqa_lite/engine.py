"""The lite pipeline: foundation (code) → SV voices → S0 phases → S1 discovery → S2 gap → S3 pitch → S4 objections → call record.

`analyse(ctx, client, config)` returns the same record as lnp_callqa.pipeline.result_record (OUTPUT_CONTRACT.md),
plus `meta` ({"engine": "lite", "version", "steps": what the code dropped per step}). The model is asked one question per
step about the whole call (S1 in chunks of turns on long discoveries), always with the transcript as the same cached
prefix; the code checks every quote and decides every level, verdict and score. A crash in one competence makes it
`to_review` (reason engine_error) without stopping the others, as in the reference pipeline.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from . import LITE_VERSION
from lnp_callqa.competences import pitch as P
from lnp_callqa.core import rounds
from lnp_callqa.core.foundation import diarization_gate, recording_gate
from lnp_callqa.core.models import CallContext, CompetenceResult
from lnp_callqa.pipeline import result_record

from .gap import merge_readings, run_gap, statements_text
from lnp_callqa.competences import objections as O
from .objections import checked_reading, reaction_plan, run_objections
from .phases import apply_phases
from .kind import STATUS as KIND_STATUS, call_kind
from .pitch import context_text, run_pitch
from .shim import Drops
from .spin import SpinFacts, run_spin
from .steps import Steps, fill, load
from .voices import run_voices
from lnp_callqa.competences import spin as SP
from . import spin as LS
from lnp_callqa.core.text import norm

DEFAULTS: dict[str, Any] = {
    "tier": "fast",                 # crm_ca_config.tiers.fast (claude-haiku-5-5)
    "effort": "low",                # thinking on, kept short
    "s1_chunk_turns": 40,           # turns of discovery per S1 call (2026-11-20: was 160, the model skimmed)
    "s1_min_chunk_turns": 15,
    "gates_batch": 25,              # S1g: listed questions per call, each with its context (2026-11-20)
    "gates_passes": 2,              # S1g: two independent readings; a disagreement goes to the arbiter (C4)
    "s2_readings": 2,               # S2: two readings of the gap step, merged by the code (C4, 2026-11-23)
    "reaction_passes": 2,           # S4r: the reaction read reply by reply, twice; a disagreement goes to the arbiter (OB-28)
    "arbiter_tier": "arbiter",      # crm_ca_config.tiers.arbiter
    "sv_chunk_lines": 150,          # SV: who says each line, checked and repaired before S0 (always on, Romain 2026-11-19)
    "sv_min_chunk_lines": 40,
    "max_tokens": {"SV": 8000, "S0": 12000,      # S0 6000 → 12000 (2026-11-20): an R2 of the reference set was cut twice
                   "S1": 16000, "S1g": 12000, "S1a": 8000, "S2": 16000, "S3": 10000, "S4": 10000,
                   "S4r": 6000, "S4ra": 6000},
}
RULES = {"SPIN": "SPIN-1.3", "GAP": "GAP-1.5", "PITCH": "PITCH-2.0", "OBJECTIONS": "OBJ-1.2"}
WINDOW_PRICE = ("Read resistances ONLY in PROSPECT turns after the first price (anchor above) to the end of the call: "
                "nothing said before the first price is an objection (OB-27).")
WINDOW_START = ("The price was already given in an earlier call of this sales cycle: read resistances in EVERY PROSPECT "
                "turn of this call, from its first turn (OB-27). Leave \"prevention\" empty: it belongs to the earlier call.")


class LiteModelError(RuntimeError):
    """The model steps failed (no valid JSON after a replay) on the phase map or on most steps: nothing is stored."""
    final = True


def _anchor(ctx: CallContext, tid: Optional[str]) -> str:
    return f"{tid} ({ctx.turn(tid).ts})" if tid else "none"


def anchors(ctx: CallContext) -> str:
    ph = ctx.phases
    return (f"PHASE MAP (decided by the code): discovery start {_anchor(ctx, ph.discovery_start)}; pitch start "
            f"{_anchor(ctx, ph.pitch_start)}; first price {_anchor(ctx, ph.first_price)}; decision request "
            f"{_anchor(ctx, ph.decision_request)}.")


def _windows(ctx: CallContext, size: int) -> list[tuple[int, int]]:
    end = ctx.n(ctx.phases.discovery_end) if ctx.phases.discovery_end else len(ctx.turns)
    return [(a, min(a + size, end) - 1) for a in range(0, end, size)] if end else []


def inventory(ctx: CallContext, a: int, b: int) -> list[dict]:
    """SEG-1 (Romain, 2026-11-20): the code lists one item per sales turn of turns[a..b] that asks something; several
    questions of one turn are one item, read on its priority question (spin.group_turn). A backchannel (SEG-7) is not
    listed."""
    out = []
    for t in ctx.turns[a:b + 1]:
        if t.role != "SALES" or t.attribution_doubtful:
            continue
        g = SP.group_turn(t.text)
        if not g:
            continue
        ws = [w for w in SP._fold(g["priority"]).split() if w]
        if len(g["questions"]) == 1 and len(ws) <= 3 and all(w.strip("'?") in SP.ACK or w in ("ah", "oh", "hmm", "vraiment",
                                                                                               "really") for w in ws):
            continue                                                   # SEG-7: backchannel over the prospect
        out.append({"id": f"Q{t.id[1:]}", "turn": t.id, "quote": g["priority"],
                    "others": [q for k, q in enumerate(g["questions"]) if k != g["index"]]})
    return out


def inventory_text(items: list[dict]) -> str:
    if not items:
        return "(no question listed by the code in these turns)"
    lines = []
    for it in items:
        extra = (" · also in the turn: " + " | ".join(f'"{q}"' for q in it["others"])) if it["others"] else ""
        lines.append(f'{it["id"]} · {it["turn"]} · PRIORITY: "{it["quote"]}"{extra}')
    return "\n".join(lines)


def run_s1(ctx: CallContext, steps: Steps, cfg: dict, drops: Drops) -> Optional[list]:
    """S1 over the turns before the first pitch start or price, in chunks; an answer cut by max_tokens is asked again
    as two halves. Returns the questions, or None if every chunk failed."""
    queue, out, failed, done = _windows(ctx, cfg["s1_chunk_turns"]), [], 0, 0
    listed = {it["turn"] for a, b in queue for it in inventory(ctx, a, b)}     # SEG-1: every turn the code lists
    end = ctx.phases.discovery_end
    if not queue:                                   # the pitch starts at the first turn: no discovery (SPIN §5)
        return []
    while queue:
        a, b = queue.pop(0)
        ta, tb = ctx.turns[a].id, ctx.turns[b].id
        window = (f"Read the questions asked in turns {ta} to {tb} only (their answers may continue after {tb}). "
                  + (f"The first pitch start or price is at {end}: nothing from {end} on is discovery (SB-34)."
                     if end else "No pitch start or price was found: the whole call can be discovery."))
        inv = inventory(ctx, a, b)
        ans = steps.ask("lite.s1_discovery", f"{ta}-{tb}", fill(load("s1_discovery"), window=window,
                                                                inventory=inventory_text(inv)),
                        cfg["max_tokens"]["S1"], replay_truncated=False)
        if ans.answer is None and ans.stop_reason == "max_tokens" and b - a + 1 > cfg["s1_min_chunk_turns"]:
            mid = (a + b) // 2
            queue[:0] = [(a, mid), (mid + 1, b)]
            continue
        if ans.answer is None:
            failed += 1
            drops.add("S1", "chunk_failed")
            continue
        done += 1
        got = [q for q in ans.answer.get("questions") or [] if isinstance(q, dict)]
        read_ids = {q.get("id") for q in got} | {f"Q{str(q.get('turn'))[1:]}" for q in got if not q.get("id")}
        missing = [it for it in inv if it["id"] not in read_ids]
        if missing:                                                    # every listed question is read: asked once more
            again = steps.ask("lite.s1_discovery", f"{ta}-{tb}:missing", fill(load("s1_discovery"), window=window,
                                                                              inventory=inventory_text(missing)),
                              cfg["max_tokens"]["S1"], replay_truncated=False)
            if again.answer:
                got += [q for q in again.answer.get("questions") or [] if isinstance(q, dict) and q.get("id")]
        out += with_inventory(got, inv, drops, listed)
    return group_added(ctx, out, drops) if done else None


def group_added(ctx: CallContext, items: list[dict], drops: Drops) -> list[dict]:
    """SEG-1 for the questions the model added on a turn the code did not list (no question mark: the recorder did not
    punctuate): one per turn too, the last one in the turn, unless it only follows up the previous one (the code's
    follows_previous); the others are counted (`question:same_turn_grouped`) and kept in `grouped`."""
    added: dict[str, list[dict]] = {}
    for q in items:
        if q.get("added_by_model"):
            added.setdefault(q.get("turn"), []).append(q)
    drop = set()
    for tid, qs in added.items():
        if len(qs) < 2 or ctx.turn(tid) is None:
            continue
        text = norm(ctx.turn(tid).text)
        qs = sorted(qs, key=lambda q: text.find(norm(q.get("quote") or "").strip(' .,?!"')))
        k = len(qs) - 1
        while k > 0 and SP.follows_previous(qs[k].get("quote") or "", qs[k - 1].get("quote") or ""):
            k -= 1
        qs[k]["grouped"] = [q.get("quote") for q in qs]
        for j, q in enumerate(qs):
            if j != k:
                drop.add(id(q))
                drops.add("S1", "question:same_turn_grouped", {"turn": tid})
    return [q for q in items if id(q) not in drop]


def _short(t, n: int = 300) -> str:
    return f"[{t.id} {t.role}] " + (t.text if len(t.text) <= n else t.text[:n] + "…")


def gates_units_text(ctx: CallContext, items: list[dict]) -> str:
    """S1g: each listed question with its context: the 2 turns before it, the other questions of its turn, the answer
    (the prospect turns after it, up to the next sales turn that asks something)."""
    out = []
    for q in items:
        i = ctx.n(q["turn"])
        before = [_short(t) for t in ctx.turns[max(0, i - 2):i]]
        answer = []
        for t in ctx.turns[i + 1:i + 6]:
            if t.role == "SALES" and SP.group_turn(t.text):
                break
            answer.append(_short(t))
        others = [x for x in q.get("grouped") or [] if x != q["quote"]]
        out.append("\n".join([f'{q["id"]} · {q["turn"]}',
                               "BEFORE: " + (" | ".join(before) or "(none)"),
                               "OTHER QUESTIONS IN THE TURN: " + (" | ".join(f'"{x}"' for x in others) or "(none)"),
                               f'PRIORITY: "{q["quote"]}"',
                               "ANSWER: " + (" | ".join(answer) or "(none)")]))
    return "\n\n".join(out)


ARBITER_PREFIX = "Each unit below carries its own context (the turns before it and its answer)."


def _read_gates(steps: Steps, unit_id: str, prompt: str, max_tokens: int, by_id: dict, drops: Drops,
                task: str = "lite.s1_gates") -> dict[str, dict]:
    """One reading of the gates for a batch: the answers whose quotes pass the engine's check, by question id."""
    ans = steps.ask(task, unit_id, prompt, max_tokens)
    if ans.answer is None:
        drops.add("S1", "gates:chunk_failed")
        return {}
    out = {}
    for g in ans.answer.get("units") or []:
        q = by_id.get(g.get("id")) if isinstance(g, dict) else None
        if q is None:
            continue
        g = LS.normalize_gates(g)                                     # answers by ids: what is left out is false
        if SP._validate_gate_obj(g, q["quote"], require_quotes=False):   # a quote given is checked; none is needed
            drops.add("S1", "gates:invalid", {"turn": q["turn"]})
            continue
        out[q["id"]] = g
    return out


def _reading_text(g: Optional[dict], quote: str) -> str:
    if not g:
        return "no valid answer"
    d = LS.gate_letter(g, quote)
    parts = [f'{k} {json.dumps({x: y for x, y in (g.get(k) or {}).items() if y not in (None, False)}, ensure_ascii=False)}'
             for k in ("g1", "g2", "g3", "g4", "g5") if any(v not in (None, False, "none") for v in (g.get(k) or {}).values())]
    return f"letter {d[0] if d else '?'}" + (f" ({d[1]})" if d and d[1] else "") + " · " + ("; ".join(parts) or "no gate")


def _same_outcome(letter: Optional[tuple]) -> Optional[tuple]:
    """Two readings agree when they lead to the same outcome: "not a solicitation" and OUT `nothing` both leave the
    sentence out of the discovery with nothing to read (SPIN §2, SB-2), so they are one outcome."""
    return ("OUT", "nothing") if letter and letter[0] == "NOT_SOLICITATION" else letter


def _answered_with_effects(q: dict) -> bool:
    """§5 (2026-11-21): the prospect's answer to the question carries an effect the model read (S1 atoms): a question no
    gate passes while its answer holds effects is read once more by the arbiter before it counts as absent (an absent
    question weighs on the exclusion of the discovery, health share)."""
    return any(isinstance(a, dict) and a.get("type") and a.get("turn") for a in q.get("atoms") or [])


def run_gates(ctx: CallContext, steps: Steps, cfg: dict, drops: Drops, questions: list) -> dict[str, dict]:
    """S1g (2026-11-20, SPIN §3, Part C, C4): the model answers the closed gates of each listed question, in batches
    with their context; the code decides the letter with the engine's decide_letter. Two independent readings (the second
    with the units in reverse order); when they lead to the same letter it is `agreed`; otherwise the arbiter tier walks
    the gates again on the disputed units (`arbitrated`), its own prompt carrying their context (no transcript prefix).
    A unit with one valid reading only keeps it (`single_reading`). Returns {id: gates} with "_status"."""
    items = [q for q in questions if q.get("id") and q.get("turn") and q.get("quote") and not q.get("added_by_model")]
    size = max(1, int(cfg.get("gates_batch") or 25))
    passes = max(1, int(cfg.get("gates_passes") or 1))
    readings: list[dict[str, dict]] = [{} for _ in range(passes)]
    for k in range(0, len(items), size):
        batch = items[k:k + size]
        by_id = {q["id"]: q for q in batch}
        uid = f"{batch[0]['id']}-{batch[-1]['id']}"
        for p in range(passes):
            order = batch if p % 2 == 0 else list(reversed(batch))
            readings[p].update(_read_gates(steps, uid + (f":p{p + 1}" if p else ""),
                                           fill(load("s1_gates"), units=gates_units_text(ctx, order)),
                                           cfg["max_tokens"]["S1g"], by_id, drops))
    out: dict[str, dict] = {}
    disputed = []
    for q in items:
        got = [r.get(q["id"]) for r in readings]
        valid = [g for g in got if g]
        if not valid:
            continue
        if passes == 1:
            out[q["id"]] = dict(valid[0], _status="single_reading")
            continue
        letters = {_same_outcome(LS.gate_letter(g, q["quote"])) for g in valid}
        absent = letters in ({("OUT", None)}, {("OUT", "absent")})
        if len(valid) == passes and len(letters) == 1 and not (absent and _answered_with_effects(q)):
            keep = next((g for g in valid if g.get("is_solicitation") is not False), valid[0])   # listed, OUT nothing
            out[q["id"]] = dict(keep, _status="agreed")
        else:
            if len(letters) == 1:
                drops.add("S1", "gates:absent_reread", {"turn": q["turn"]})  # §5 (2026-11-21): read once more
            disputed.append((q, got))
    if disputed:
        arb = Steps(steps.client, ctx, tier=cfg.get("arbiter_tier") or "arbiter", effort=steps.effort,
                    prefix=ARBITER_PREFIX)
        for k in range(0, len(disputed), size):
            chunk = disputed[k:k + size]
            text = gates_units_text(ctx, [q for q, _ in chunk])
            blocks = text.split("\n\n")
            text = "\n\n".join(b + "\n" + "\n".join(f"READER {i + 1}: {_reading_text(g, q['quote'])}"
                                                    for i, g in enumerate(got))
                                for b, (q, got) in zip(blocks, chunk))
            prompt = load("s1_gates_arbiter") + fill(load("s1_gates"), units=text)
            by_id = {q["id"]: q for q, _ in chunk}
            res = _read_gates(arb, f"{chunk[0][0]['id']}-{chunk[-1][0]['id']}:arbiter", prompt,
                              cfg["max_tokens"]["S1a"], by_id, drops, task="lite.s1_gates_arbiter")
            for q, got in chunk:
                if q["id"] in res:
                    out[q["id"]] = dict(res[q["id"]], _status="arbitrated")
                else:                                              # the arbiter failed: a valid reading, flagged
                    one = next((g for g in got if g), None)
                    if one:
                        drops.add("S1", "gates:arbiter_failed", {"turn": q["turn"]})
                        out[q["id"]] = dict(one, _status="to_review")
    return out


def with_inventory(got: list[dict], inv: list[dict], drops: Drops, listed: Optional[set] = None) -> list[dict]:
    """The model's readings on the code's list: a listed question keeps the code's turn and priority question (the
    model cannot move or reword it), one reading per turn; a question the model added counts only on a turn the code
    did not list. C4 (2026-11-20): one reading never removes a listed question. A listed question still unread is
    counted (`question:not_read`) and kept for the gates (`s1_unread`); one S1 sends to gate 0 (a validation or
    decision request) is counted (`question:routing_s1`) and kept for the gates too (`s1_routing`): the two
    readings of the gates, and the arbiter on a disagreement, decide (spin.build_units). A reading without
    id (an answer of the earlier per-question listing) goes to its turn's item: the one on the priority question, else
    the last one of the turn."""
    by_id = {it["id"]: it for it in inv}
    by_turn = {it["turn"]: it for it in inv}
    chosen: dict[str, dict] = {}
    extra = []
    for q in got:
        it = by_id.get(q.get("id") or "") or (by_turn.get(q.get("turn") or "") if not q.get("id") else None)
        if it is None:
            if q.get("id"):
                drops.add("S1", "question:unknown_id", q)
                continue
            if q.get("turn") in by_turn:
                drops.add("S1", "question:same_turn_as_listed", q)   # SEG-1: one item per turn
            elif q.get("turn") in (listed or ()):
                drops.add("S1", "question:turn_of_another_chunk", q)  # SEG-1: read with its own chunk, never twice
            else:
                extra.append(dict(q, added_by_model=True))
            continue
        if q.get("routing") in ("validation_request", "decision_request"):   # gate 0: not a discovery solicitation
            chosen[it["id"]] = {"_routing": True}
            continue
        prev = chosen.get(it["id"])
        if prev and prev.get("_routing"):
            continue
        on_priority = norm(q.get("quote") or "").strip(" .,?!") in norm(it["quote"]) if q.get("quote") else False
        if prev is None or q.get("id") or (on_priority and not prev.get("_on_priority")) or \
                (not prev.get("_on_priority") and not prev.get("id")):
            if prev is not None and prev.get("id") and not q.get("id"):
                continue
            chosen[it["id"]] = dict(q, _on_priority=on_priority or bool(q.get("id")))
    out = []
    for it in inv:
        q = chosen.get(it["id"])
        base = {"id": it["id"], "turn": it["turn"], "quote": it["quote"], "grouped": [it["quote"]] + it["others"]}
        if q is None:
            drops.add("S1", "question:not_read", {"turn": it["turn"]})
            out.append(dict(base, s1_unread=True))
            continue
        if q.get("_routing"):
            drops.add("S1", "question:routing_s1", {"turn": it["turn"]})
            out.append(dict(base, s1_routing=True))
            continue
        q = {k: v for k, v in q.items() if k != "_on_priority"}
        out.append(dict(q, **base))
    return out + extra


def _to_review(name: str, reason: str = "engine_error") -> CompetenceResult:
    return CompetenceResult(name, RULES[name], status="to_review", reasons=[reason], concordance="single_reading")


def _safe(ctx: CallContext, name: str, fn) -> CompetenceResult:
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 - a crash in one competence never blocks the others
        ctx.audit.append({"competence": name, "error": repr(e)[:500]})
        return _to_review(name)


def analyse(ctx: CallContext, client: Any, config: Optional[dict] = None) -> dict:
    cfg = {**DEFAULTS, **(config or {})}
    cfg["max_tokens"] = {**DEFAULTS["max_tokens"], **((config or {}).get("max_tokens") or {})}
    drops = Drops()
    meta = {"engine": "lite", "version": LITE_VERSION, "tier": cfg["tier"], "effort": cfg["effort"],
            "cycle": rounds.public(ctx.cycle)}
    if not recording_gate(ctx):                              # C1 (2026-11-20): under 20 minutes, the recording is cut
        for name, rv in RULES.items():
            ctx.results[name] = CompetenceResult(name, rv, status="excluded", reasons=[ctx.status])
        return _record(ctx, meta, drops)
    if ctx.lines:                                            # C1: the model lists the wrong labels, the code repairs
        meta["voices"] = run_voices(ctx, client, cfg, drops)
    diarization_gate(ctx)                                    # C1 (code): word shares, after the repair
    if ctx.status != "ok":
        for name, rv in RULES.items():
            ctx.results[name] = CompetenceResult(name, rv, status="excluded", reasons=[ctx.status])
        return _record(ctx, meta, drops)
    steps = Steps(client, ctx, tier=cfg["tier"], effort=cfg["effort"])
    failed: list[str] = []
    attempted = ["S0"]

    # S0 · phase map
    s0 = steps.ask("lite.s0_phases", "call", load("s0_phases"), cfg["max_tokens"]["S0"])
    if s0.answer is None:
        raise LiteModelError(f"phase map (S0): {s0.error}")
    apply_phases(ctx, s0.answer, drops)
    kind = call_kind(ctx, s0.answer, drops)                   # C1b (2026-11-23): a person already enrolled
    if kind["not_sales"]:
        ctx.status = KIND_STATUS
        meta["call_kind"] = kind
        for name, rv in RULES.items():
            ctx.results[name] = CompetenceResult(name, rv, status="excluded", reasons=[KIND_STATUS],
                                                 details={"call_kind": kind})
        return _record(ctx, meta, drops)

    # C9 (Romain, 2026-11-20): a good gap made in an earlier call of the cycle: no discovery, no gap in this one
    skip = rounds.skip_reason(ctx, "SPIN")
    questions: Optional[list] = None
    facts = SpinFacts()
    if skip:
        ctx.results["SPIN"] = CompetenceResult("SPIN", RULES["SPIN"], status="not_applicable", reasons=[skip])
        ctx.results["GAP"] = CompetenceResult("GAP", RULES["GAP"], status="not_applicable", reasons=[skip],
                                              details=rounds.carried_gap(ctx))
    # S1 · discovery → SPIN and the shared fact base
    if not skip:
        attempted.append("S1")
        questions = run_s1(ctx, steps, cfg, drops)
        if questions:                                            # S1g: the letter decided by code, gate by gate
            gates = run_gates(ctx, steps, cfg, drops, questions)
            for q in questions:
                if q.get("id") in gates:
                    g = dict(gates[q["id"]])
                    q["gates_status"] = g.pop("_status", None)
                    q["gates"] = g
    if skip:
        pass
    elif questions is None:
        failed.append("S1")
        ctx.results["SPIN"] = _to_review("SPIN")
    else:
        def spin():
            nonlocal facts
            res, facts = run_spin(ctx, questions, drops)
            return res
        ctx.results["SPIN"] = _safe(ctx, "SPIN", spin)

    # S2 · gap (needs the discovery facts)
    if skip:
        pass
    elif "engine_error" in ctx.results["SPIN"].reasons:
        ctx.results["GAP"] = _to_review("GAP", "engine_error")
    else:
        wlimit = ctx.phases.first_price or ctx.phases.decision_request
        prompt = fill(load("s2_gap"), anchors=anchors(ctx), limit=f"turn {wlimit}" if wlimit else "the end of the call",
                      statements=statements_text(ctx))
        attempted.append("S2")
        s2 = steps.ask("lite.s2_gap", "call", prompt, cfg["max_tokens"]["S2"])
        s2b = steps.ask("lite.s2_gap", "call:p2", prompt, cfg["max_tokens"]["S2"]) \
            if s2.answer is not None and int(cfg.get("s2_readings") or 1) > 1 else None
        if s2.answer is None:
            failed.append("S2")
            ctx.results["GAP"] = _to_review("GAP")
        else:
            both = merge_readings(ctx, s2.answer, s2b.answer if s2b else None, drops)    # C4 (2026-11-23): two readings
            ctx.results["GAP"] = _safe(ctx, "GAP", lambda: run_gap(ctx, both, facts, drops))
    if not skip:
        _gap_rules(ctx, questions, drops, meta)
        meta["gap_remediation"] = rounds.gap_remediation(ctx)        # C9: a bad gap followed up before the pitch

    # S3 · pitch (needs the Gap result: validated P, selected A and B, roadmap blockers)
    pskip = rounds.skip_reason(ctx, "PITCH")                    # C9: the offer was presented in an earlier call
    if pskip:
        ctx.results["PITCH"] = CompetenceResult("PITCH", RULES["PITCH"], status="not_applicable", reasons=[pskip])
    elif not ctx.phases.pitch_start:
        ctx.results["PITCH"] = _safe(ctx, "PITCH", lambda: P.decide(ctx, {}))          # not applicable (§4)
    else:
        c = context_text(ctx)
        prompt = fill(load("s3_pitch"), anchors=anchors(ctx), vp=c["vp"], a=c["a"], b=c["b"], blockers=c["blockers"],
                      references=c["references"])
        attempted.append("S3")
        s3 = steps.ask("lite.s3_pitch", "call", prompt, cfg["max_tokens"]["S3"])
        if s3.answer is None:
            failed.append("S3")
            ctx.results["PITCH"] = _to_review("PITCH")
        else:
            ctx.results["PITCH"] = _safe(ctx, "PITCH", lambda: run_pitch(ctx, s3.answer, drops))

    # S4 · objections after the first price (OB-27), prevention before it; no price = nothing to read
    from_start = rounds.objections_from_start(ctx)              # C9: the price was given in an earlier call
    if not ctx.phases.first_price and not from_start:
        ctx.results["OBJECTIONS"] = CompetenceResult("OBJECTIONS", RULES["OBJECTIONS"], status="not_applicable",
                                                     reasons=["no_resistance_no_price"], concordance="single_reading")
    else:
        attempted.append("S4")
        s4 = steps.ask("lite.s4_objections", "call", fill(load("s4_objections"), anchors=anchors(ctx),
                                                          window=WINDOW_START if from_start else WINDOW_PRICE),
                       cfg["max_tokens"]["S4"])
        if s4.answer is None:
            failed.append("S4")
            ctx.results["OBJECTIONS"] = _to_review("OBJECTIONS")
        else:
            reactions = run_reactions(ctx, steps, cfg, drops, s4.answer)
            ctx.results["OBJECTIONS"] = _safe(ctx, "OBJECTIONS",
                                              lambda: run_objections(ctx, s4.answer, drops, reactions))

    if len(failed) * 2 > len(attempted):
        raise LiteModelError(f"{len(failed)} of {len(attempted)} model steps gave no valid JSON: " + ", ".join(failed))
    meta["failed_steps"] = failed
    return _record(ctx, meta, drops)


REACTION_ARBITER_PREFIX = "Each episode below carries its own turns (the resistance, the sales response, the prospect's replies)."


def reaction_units_text(ctx: CallContext, units: list[dict], with_turns: bool = False) -> str:
    """S4r units: the resistance and the prospect turns to read (ids of the cached transcript); for the arbiter, the
    turns of the episode themselves, from the resistance to the last turn read."""
    pos = O._pos(ctx)
    out = []
    for i, u in enumerate(units, 1):
        lines = [f'E{i} · resistance at {u["turn"]} ({u["nature"]} · {u["subtype"]}): « {u["quote"]} »',
                 f'   prospect turns to read: {", ".join(u["window"])}']
        if with_turns:
            span = O.seq(ctx)[pos[u["turn"]]: pos[u["last"]] + 1]
            lines.append(ctx.render(span))
        out.append("\n".join(lines))
    return "\n\n".join(out)


def _read_reactions(steps: Steps, unit_id: str, prompt: str, max_tokens: int, units: list[dict], drops: Drops,
                    task: str = "lite.s4_reactions") -> dict[str, dict]:
    """One reading: {episode key: checked turns}. The model answers episodes by their position E1, E2… in `units`."""
    ans = steps.ask(task, unit_id, prompt, max_tokens)
    if ans.answer is None:
        drops.add("S4", "reaction:reading_failed")
        return {}
    out = {}
    for e in ans.answer.get("episodes") or []:
        if not isinstance(e, dict) or not str(e.get("id") or "").startswith("E"):
            continue
        try:
            u = units[int(str(e["id"])[1:]) - 1]
        except (ValueError, IndexError):
            continue
        got = checked_reading(steps.ctx, u, e.get("turns"), drops)
        if got is not None:
            out[u["key"]] = got
    return out


def _reaction_summary(turns: Optional[dict]) -> str:
    if not turns:
        return "no valid answer"
    return "; ".join(f'{t} {a.get("kind")}' + (" (first stated by the sales)" if a.get("prompted") else "") +
                     (f' « {a.get("quote")} »' if a.get("quote") else "") for t, a in turns.items())


def run_reactions(ctx: CallContext, steps: Steps, cfg: dict, drops: Drops, s4: dict) -> dict[str, dict]:
    """S4r (OB-28, 2026-11-24): the prospect's reaction to each resistance, read reply by reply. The code lists the
    prospect turns after the resistance and before the next one; the model says what each turn does with THIS
    resistance (holds, no longer holds, commits, moves forward, agrees, asks, other), with the prospect's words; the
    code checks every quote and decides the level (`O.reaction_from_turns`). Two readings, the second with the episodes
    in reverse order; the same level = `agreed`; otherwise the arbiter tier reads the disputed episodes, their turns in
    its prompt (`arbitrated`); a failed arbiter leaves the first valid reading (`to_review` tag). One valid reading only:
    `single_reading`. Returns {episode key: {"turns", "_status"}}; an episode without a valid reading keeps S4's."""
    units = reaction_plan(ctx, s4)
    if not units:
        return {}
    passes = max(1, int(cfg.get("reaction_passes") or 1))
    readings: list[dict[str, dict]] = []
    for p in range(passes):
        order = units if p % 2 == 0 else list(reversed(units))
        readings.append(_read_reactions(steps, "reactions" + (f":p{p + 1}" if p else ""),
                                        fill(load("s4_reactions"), units=reaction_units_text(ctx, order)),
                                        cfg["max_tokens"]["S4r"], order, drops))
    out: dict[str, dict] = {}
    disputed = []
    for u in units:
        got = [r.get(u["key"]) for r in readings]
        valid = [g for g in got if g]
        if not valid:
            continue
        levels = {O.reaction_from_turns(ctx, g)[0] for g in valid}
        if len(valid) == 1:
            out[u["key"]] = {"turns": valid[0], "_status": "single_reading"}
        elif len(levels) == 1:
            out[u["key"]] = {"turns": valid[0], "_status": "agreed"}
        else:
            disputed.append((u, got))
    if disputed:
        arb = Steps(steps.client, ctx, tier=cfg.get("arbiter_tier") or "arbiter", effort=steps.effort,
                    prefix=REACTION_ARBITER_PREFIX)
        chunk = [u for u, _ in disputed]
        text = reaction_units_text(ctx, chunk, with_turns=True).split("\n\n")
        text = "\n\n".join(b + "\n" + "\n".join(f"READER {i + 1}: {_reaction_summary(g)}" for i, g in enumerate(got))
                             for b, (u, got) in zip(text, disputed))
        res = _read_reactions(arb, "reactions:arbiter", load("s4_reactions_arbiter") + fill(load("s4_reactions"), units=text),
                              cfg["max_tokens"]["S4ra"], chunk, drops, task="lite.s4_reactions_arbiter")
        for u, got in disputed:
            if u["key"] in res:
                out[u["key"]] = {"turns": res[u["key"]], "_status": "arbitrated"}
            else:
                drops.add("S4", "reaction:arbiter_failed", {"turn": u["turn"]})
                out[u["key"]] = {"turns": next(g for g in got if g), "_status": "to_review"}
    return out


def _gap_rules(ctx: CallContext, questions: Optional[list], drops: Drops, meta: dict) -> None:
    """Romain, 2026-11-03.
    - The discovery ends when the gap is made: with a gap present, the end of the discovery is its validation turn, and
      SPIN is scored again on the questions asked up to it (a question after the validated gap is not discovery).
      With no gap, the discovery ends before the pitch (SB-1, unchanged).
    - A call with no discovery question, no pitch and no price has no gap to make: not applicable (§4), not absent."""
    g, sp, ph = ctx.results.get("GAP"), ctx.results.get("SPIN"), ctx.phases
    meta["discovery_end_rule"] = "pitch"
    if g and g.verdict == "present":
        vt = (g.details or {}).get("validation_turn")
        if vt and (not ph.discovery_end or ctx.n(vt) < ctx.n(ph.discovery_end)):
            ph.discovery_end = vt
            meta["discovery_end_rule"] = "gap"
            if questions is not None:
                kept = [q for q in questions if isinstance(q, dict) and q.get("turn") in {t.id for t in ctx.turns}
                        and ctx.n(q["turn"]) < ctx.n(vt)]
                for _ in range(len(questions) - len(kept)):
                    drops.add("S1", "question:after_gap")
                ctx.results["SPIN"] = _safe(ctx, "SPIN", lambda: run_spin(ctx, kept, Drops())[0])
    elif g and g.status == "scored" and sp and sp.status == "not_applicable" and not ph.pitch_start and not ph.first_price:
        ctx.results["GAP"] = CompetenceResult("GAP", RULES["GAP"], status="not_applicable",
                                              reasons=["no_discovery_no_pitch"], concordance="single_reading")


def _record(ctx: CallContext, meta: dict, drops: Drops) -> dict:
    rec = result_record(ctx)
    meta["steps"] = {k: {"dropped": sum(v.values()), "reasons": v} for k, v in drops.counts.items()}
    rec["meta"] = meta
    rec["audit"].append({"lite_drops": drops.examples})
    json.dumps(rec, default=str)                            # what crm_ca_store receives
    return rec


def summary(record: dict) -> str:
    """One log line: status and scores only (never a quote)."""
    res = record.get("results") or {}
    parts = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    return f"engine=lite status={record.get('status')} turns={len(record.get('turns') or [])} " + " ".join(parts)

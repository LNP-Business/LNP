"""S4d · the resistances, reply by reply (OB-29, 2026-11-24; Romain: « go pour le 1 »).

The objections step used to find the resistances itself, reading the whole after-price part of the call at once: it found
61 % of the reference's resistances (recurrences, a second doubt in the same turn, a new anxiety after a first doubt were
missed) and the episodes it bounded did not line up with the reference's, which capped the reaction. Here, as for the
questions of the discovery (S1g):
- the code lists every PROSPECT (or co-decider) turn of the window (after the first price, OB-27; the whole call once the
  price was given in an earlier call, C9);
- the model answers by turn id which turns hold a doubt or a reserve, what about (OB-3 subjects), whether it is a doubt
  already said (`new`), with the prospect's words (checked; a missing or failed quote: the code takes the turn's own words,
  Part C, C3 rule 8);
- two readings; a turn both list is kept (`agreed`), a turn only one lists goes to the arbiter tier with its context
  (`arbitrated`); a failed arbiter keeps the reader's entry (`to_review` tag);
- the code groups the entries into resistances (a doubt said again, `new` false and the same theme, joins the previous
  one; the chain of the objections module then tells a repetition from a recurrence by the episode's end, OB-11);
- the objections step (S4) then reads, by id, the sales' response to each listed resistance, and may set one aside as
  not a resistance (OB-2).
Returns None when the step gave no valid reading: the objections step then finds the resistances itself, as before.
"""
from __future__ import annotations

from typing import Any, Optional

from lnp_callqa.competences import objections as O
from lnp_callqa.core import rounds
from lnp_callqa.core.models import CallContext, Evidence, SALES

from .shim import Drops
from .steps import Steps, fill, load

STEP = "S4"
JOIN_MAX_TURNS = 10               # engineering parameter: a passage joins the resistance it follows within 10 turns
QUOTE_WORDS = 25                  # the turn's own words when the model's quote is missing or fails (C3 rule 8)
ARBITER_PREFIX = "Each turn below carries its context (the turns just before it)."


def window_turns(ctx: CallContext) -> list[str]:
    """The prospect-side turns to read: after the first price (OB-27), or every one when the price was given in an
    earlier call of the cycle (C9); attribution-doubtful turns are left out (OB-26)."""
    seq, pos = O.seq(ctx), O._pos(ctx)
    if rounds.objections_from_start(ctx):
        start = 0
    elif ctx.phases.first_price and ctx.phases.first_price in pos:
        start = pos[ctx.phases.first_price] + 1
    else:
        return []
    return [t.id for t in seq[start:] if t.role != SALES and t.text.strip()]


def _own_words(text: str) -> str:
    return " ".join(text.split()[:QUOTE_WORDS])


def checked_entries(ctx: CallContext, ans: Optional[dict], listed: set, drops: Drops) -> Optional[dict[str, list]]:
    """One reading: {turn id: [entries]}. None when the reading has no "resistances" list (failed or not given)."""
    if not isinstance(ans, dict) or not isinstance(ans.get("resistances"), list):
        return None
    out: dict[str, list] = {}
    for e in ans["resistances"]:
        if not isinstance(e, dict):
            continue
        tid = e.get("id") or e.get("turn")
        if tid not in listed:
            drops.add(STEP, "detect:turn_not_listed", {"turn": tid})
            continue
        kind = e.get("kind") or "doubt"
        if kind != "doubt":                              # OB-2 (2026-11-24): a look-alike, named, set aside by the code
            drops.add(STEP, f"detect:not_a_resistance:{kind}", {"turn": tid})
            continue
        subjects = [s for s in e.get("subjects") or [] if s in O.SUBJECTS]
        if not subjects:
            drops.add(STEP, "detect:no_subject", {"turn": tid})
            continue
        q = e.get("quote") or ""
        if not q or O._prospect_side_ok(ctx, Evidence(q, tid)):
            if q:
                drops.add(STEP, "detect:quote_replaced", {"turn": tid})
            q = _own_words(ctx.turn(tid).text)
        out.setdefault(tid, []).append({"turn": tid, "quote": q, "subjects": subjects,
                                        "denied_subjects": [s for s in e.get("denied_subjects") or [] if s in O.SUBJECTS],
                                        "new": e.get("new") is not False})
    return out


def _turns_text(ctx: CallContext, ids: list[str]) -> str:
    return ", ".join(ids)


def _context_text(ctx: CallContext, ids: list[str], readers: list[Optional[dict]]) -> str:
    seq, pos = O.seq(ctx), O._pos(ctx)
    blocks = []
    for tid in ids:
        lo = max(0, pos[tid] - 2)
        lines = [ctx.render(seq[lo: pos[tid] + 1]), f"TURN TO READ: {tid}"]
        for i, r in enumerate(readers, 1):
            got = (r or {}).get(tid)
            lines.append(f"READER {i}: " + ("; ".join(f'{"/".join(e["subjects"])} « {e["quote"]} »' for e in got)
                                             if got else "no resistance"))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def run_detection(ctx: CallContext, steps: Steps, cfg: dict, drops: Drops, window: str, anchors: str
                  ) -> Optional[list[dict]]:
    """The entries kept, in the order of the call, each with "_status". None: no valid reading."""
    ids = window_turns(ctx)
    if not ids:
        return []
    listed = set(ids)
    size = max(1, int(cfg.get("detect_batch") or 60))
    passes = max(1, int(cfg.get("detect_passes") or 1))
    readings: list[Optional[dict]] = []
    for p in range(passes):
        got: Optional[dict] = {}
        for k in range(0, len(ids), size):
            batch = ids[k:k + size]
            order = batch if p % 2 == 0 else list(reversed(batch))
            ans = steps.ask("lite.s4_detect", f"{batch[0]}-{batch[-1]}" + (f":p{p + 1}" if p else ""),
                            fill(load("s4_detect"), anchors=anchors, window=window, turns=_turns_text(ctx, order)),
                            cfg["max_tokens"]["S4d"])
            one = checked_entries(ctx, ans.answer, set(batch), drops)
            if one is None:
                drops.add(STEP, "detect:reading_failed")
                got = None
                break
            got.update(one)
        readings.append(got)
    valid = [r for r in readings if r is not None]
    if not valid:
        return None
    keep: dict[str, list] = {}
    status: dict[str, str] = {}
    disputed = []
    for tid in ids:
        flagged = [r.get(tid) for r in valid]
        if len(valid) == 1:
            if flagged[0]:
                keep[tid], status[tid] = flagged[0], "single_reading"
        elif all(flagged):
            keep[tid], status[tid] = flagged[0], "agreed"
        elif any(flagged):
            disputed.append(tid)
    if disputed:
        arb = Steps(steps.client, ctx, tier=cfg.get("arbiter_tier") or "arbiter", effort=steps.effort,
                    prefix=ARBITER_PREFIX)
        size_a = max(1, int(cfg.get("detect_arbiter_batch") or 20))
        for k in range(0, len(disputed), size_a):
            chunk = disputed[k:k + size_a]
            ans = arb.ask("lite.s4_detect_arbiter", f"{chunk[0]}-{chunk[-1]}:arbiter",
                          load("s4_detect_arbiter") + fill(load("s4_detect"), anchors="", window=window,
                                                           turns=_context_text(ctx, chunk, valid)),
                          cfg["max_tokens"]["S4da"])
            res = checked_entries(ctx, ans.answer, set(chunk), drops)
            for tid in chunk:
                if res is not None:
                    if res.get(tid):
                        keep[tid], status[tid] = res[tid], "arbitrated"
                else:                                               # the arbiter failed: the reader's entry, flagged
                    drops.add(STEP, "detect:arbiter_failed", {"turn": tid})
                    keep[tid], status[tid] = next(r[tid] for r in valid if r.get(tid)), "to_review"
    pos = O._pos(ctx)
    out = []
    for tid in sorted(keep, key=pos.get):
        for e in keep[tid]:
            out.append(dict(e, _status=status[tid]))
    return out


def _sales_moved_on(ctx: CallContext, after: str, before: str, words: set) -> bool:
    """OB-8 (a) by the code, between two passages: a sales turn (not a backchannel) that reuses no content word of the
    resistance or of the sales' response so far. The words of each sales turn that does not move on join the response."""
    seq, pos = O.seq(ctx), O._pos(ctx)
    words = set(words)
    for t in seq[pos[after] + 1: pos[before]]:
        if t.role != SALES or O.is_backchannel(t):
            continue
        if O.topic_change_condition_a(t.text, words):
            return True
        words |= O.content_words(t.text)
    return False


def group(ctx: CallContext, entries: list[dict]) -> list[dict]:
    """Resistances from the entries, in the order of the call (OB-29, reference reading of 2026-11-23: an episode holds
    every doubt of the same nature the prospect raises while the sales answers it).
    - The entries of one turn are one passage per nature: their subjects together (a mixed passage of two natures is two
      resistances that share the same response, OB-4).
    - A passage joins the last resistance of the same nature when the sales has not moved on since its last passage
      (OB-8 (a) by the code: no sales turn in between reuses none of the words of the resistance and of the response so
      far); otherwise it opens a resistance (the same doubt after the sales moved on is a recurrence, OB-11).
    The model's `new` flag is not used to group: it marks a doubt said two turns before as new."""
    pos = O._pos(ctx)
    passages: list[dict] = []
    for e in entries:
        denied = {O.SUBJECTS[s][1] for s in e["denied_subjects"]}
        subj = [s for s in e["subjects"] if O.SUBJECTS[s][1] not in denied]
        nt = O.nature_of_subjects(subj)
        if nt is None:
            continue
        same = next((p for p in passages if p["turn"] == e["turn"] and p["nature"] == nt[0]), None)
        if same:
            same["subjects"] += [x for x in e["subjects"] if x not in same["subjects"]]
            same["denied_subjects"] += [x for x in e["denied_subjects"] if x not in same["denied_subjects"]]
            continue
        passages.append({"turn": e["turn"], "quote": e["quote"], "nature": nt[0], "subjects": list(e["subjects"]),
                         "denied_subjects": list(e["denied_subjects"]), "status": e["_status"]})
    items: list[dict] = []
    for p in sorted(passages, key=lambda p: pos[p["turn"]]):
        prev = next((it for it in reversed(items) if it["nature"] == p["nature"]), None)
        if prev is not None and prev["quotes"][-1]["turn"] != p["turn"] and \
                pos[p["turn"]] - pos[prev["quotes"][-1]["turn"]] <= JOIN_MAX_TURNS and \
                not _sales_moved_on(ctx, prev["quotes"][-1]["turn"], p["turn"], prev["words"]):
            prev["quotes"].append({"turn": p["turn"], "quote": p["quote"]})
            prev["subjects"] += [x for x in p["subjects"] if x not in prev["subjects"]]
            prev["words"] |= O.content_words(ctx.turn(p["turn"]).text)
            continue
        items.append({"nature": p["nature"], "subjects": p["subjects"], "denied_subjects": p["denied_subjects"],
                      "quotes": [{"turn": p["turn"], "quote": p["quote"]}], "status": p["status"],
                      "words": O.content_words(ctx.turn(p["turn"]).text)})
    for k, it in enumerate(items, 1):
        it["id"] = f"R{k}"
        denied = {O.SUBJECTS[s][1] for s in it["denied_subjects"]}
        it["theme"] = O.nature_of_subjects([s for s in it["subjects"] if O.SUBJECTS[s][1] not in denied])
        it.pop("words")
    return items


def items_text(items: list[dict]) -> str:
    if not items:
        return "(none: no resistance was listed; answer \"objections\": [] and read the prevention)"
    return "\n".join(f'{it["id"]} · {it["theme"][0]} · {it["theme"][1]} · ' +
                     " / ".join(f'{q["turn"]} « {q["quote"]} »' for q in it["quotes"]) for it in items)


def s4_from_ids(items: list[dict], ans: dict, drops: Drops) -> dict[str, Any]:
    """The S4 answer by ids turned into the objections module's input: each listed resistance with its subjects and
    passages (the code's), and the sales' response read by the model (its fields, by id). A resistance the model set
    aside as not one (OB-2) carries its exclusion; one it did not answer keeps no reading of the response."""
    by_id = {}
    for o in ans.get("objections") or []:
        if isinstance(o, dict) and o.get("id"):
            by_id[o["id"]] = o
    objs = []
    for it in items:
        o = dict(by_id.get(it["id"]) or {})
        if not any(v for k, v in o.items() if k != "id"):
            drops.add(STEP, "objection:response_unread", {"turn": it["quotes"][0]["turn"]})
        o.pop("id", None)
        o.update(subjects=it["subjects"], denied_subjects=it["denied_subjects"], quotes=it["quotes"],
                 detect_status=it["status"])
        objs.append(o)
    return {"objections": objs, "prevention": ans.get("prevention") or {}}

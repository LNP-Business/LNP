"""S4 → Objections result (OBJ-1.1, lite reading): unique objections raised after the pitch start, A · I · E · M.

Romain (2026-11-03): only the resistances raised after the pitch start count, and each objection appears once, with all
its quotes. The code:
- checks every quote (a PROSPECT or co-decider turn, exact passage, after the pitch start) and drops the others;
- derives the nature from the subjects of the doubt with the boundary tests of OB-3 (`nature_of_subjects`, OB-24);
- merges objections of the same nature and theme, or that share a quote, into one (with all their quotes);
- bounds one episode per objection: response = sales turns from the first passage to the topic change (the model's,
  checked: a SALES turn before the next objection), reaction = prospect turns after the first response; a quote of
  the same objection inside the reaction is a repetition (persisting), one after the episode is a recurrence (H5 = 0);
- judges A · I · E · M, resolution, latency and prevention with the reference engine's functions (acknowledged,
  isolation_valid, exploration, h1_level, h3_level, resolution_level, is_latent, episode_items, prevention_items).
"""
from __future__ import annotations

from typing import Any, Optional

from alkimiy_callqa.competences import objections as O
from alkimiy_callqa.core.models import CallContext, CompetenceResult, Evidence, ItemScore, SALES
from alkimiy_callqa.core.scoring import call_score
from alkimiy_callqa.core.text import norm, sentences

from .shim import Drops

STEP = "S4"


def _valid_quotes(ctx: CallContext, o: dict, drops: Drops) -> list[dict]:
    ps = ctx.phases.pitch_start
    out = []
    for q in o.get("quotes") or []:
        if not isinstance(q, dict):
            drops.add(STEP, "quote:not_an_object")
            continue
        e = O._prospect_side_ok(ctx, Evidence(q.get("quote") or "", q.get("turn") or ""))
        if e:
            drops.add(STEP, f"quote:{e}", q)
            continue
        if not ps or ctx.n(q["turn"]) <= ctx.n(ps):
            drops.add(STEP, "quote:before_pitch", q)            # Romain 2026-11-03: after the pitch start only
            continue
        out.append({"turn": q["turn"], "quote": q["quote"]})
    return sorted(out, key=lambda q: (ctx.n(q["turn"]), norm(ctx.turn(q["turn"]).text).find(norm(q["quote"]))))


def _overlap(a: list[dict], b: list[dict]) -> bool:
    for x in a:
        for y in b:
            if x["turn"] == y["turn"] and (norm(x["quote"]) in norm(y["quote"]) or norm(y["quote"]) in norm(x["quote"])):
                return True
    return False


def unique_objections(ctx: CallContext, s4: dict, drops: Drops) -> list[dict]:
    items = []
    for o in s4.get("objections") or []:
        if not isinstance(o, dict):
            drops.add(STEP, "objection:not_an_object")
            continue
        if (o.get("exclusion") or "none") != "none":                   # OB-2, X1
            drops.add(STEP, f"objection:excluded_{o.get('exclusion')}")
            continue
        quotes = _valid_quotes(ctx, o, drops)
        if not quotes:
            drops.add(STEP, "objection:no_valid_quote_after_pitch")
            continue
        denied = {O.SUBJECTS[s][1] for s in o.get("denied_subjects") or [] if s in O.SUBJECTS}
        subjects = [s for s in o.get("subjects") or [] if s in O.SUBJECTS and O.SUBJECTS[s][1] not in denied]
        nt = O.nature_of_subjects(subjects)                            # OB-3 boundary tests, OB-24
        if nt is None:
            drops.add(STEP, "objection:no_nature")
            continue
        items.append({"nature": nt[0], "subtype": nt[1], "quotes": quotes, "raw": o, "merged": 1})
    items.sort(key=lambda m: ctx.n(m["quotes"][0]["turn"]))
    merged: list[dict] = []
    for it in items:                                                   # one objection, all its quotes (code)
        tgt = next((m for m in merged if (m["nature"], m["subtype"]) == (it["nature"], it["subtype"])
                    or _overlap(m["quotes"], it["quotes"])), None)
        if tgt is None:
            merged.append(it)
            continue
        tgt["merged"] += 1
        for q in it["quotes"]:
            if not _overlap(tgt["quotes"], [q]):
                tgt["quotes"].append(q)
        tgt["quotes"].sort(key=lambda q: ctx.n(q["turn"]))
    return merged


def _first_sales(ctx: CallContext, after: str, before: Optional[str]) -> list:
    seq, pos = O.seq(ctx), O._pos(ctx)
    hi = pos[before] if before else len(seq)
    return [t for t in seq[pos[after] + 1: hi] if t.role == SALES]


def bound(ctx: CallContext, m: dict, k: int, next_start: Optional[str], drops: Drops) -> O.Episode:
    seq, pos = O.seq(ctx), O._pos(ctx)
    first = m["quotes"][0]
    t0 = ctx.turn(first["turn"])
    res = O.Resistance(t0.id, t0.id, t0.role, first["quote"], m["nature"], m["subtype"], [t0.id])
    for q in m["quotes"][1:]:                                          # OB-5: same resistance over several turns
        between = seq[pos[res.last] + 1: pos[q["turn"]]]
        if q["turn"] != res.last and all(t.role == SALES and O.is_backchannel(t) for t in between):
            res.last = q["turn"]
            res.turns.append(q["turn"])
    ep = O.Episode(f"E{k}", res)
    raw = m["raw"]
    tc = raw.get("topic_change") if isinstance(raw.get("topic_change"), dict) else None
    tc_turn = None
    if tc:
        ok = not O._sales_ok(ctx, Evidence(tc.get("quote") or "", tc.get("turn") or ""), max_words=60)
        if ok and pos[tc["turn"]] > pos[res.last] and (next_start is None or pos[tc["turn"]] < pos[next_start]):
            tc_turn = tc["turn"]
        else:
            drops.add(STEP, "topic_change:rejected", tc)
    end = tc_turn or next_start
    response = [t for t in _first_sales(ctx, res.last, end)]
    while response and O.is_backchannel(response[0]):                  # a backchannel is not the first response
        response.pop(0)
    if raw.get("receive_and_leave") and response:                      # OB-22
        ep.response = [response[0].id]
        ep.topic_change = ep.end_turn = response[0].id
        ep.end_reason, ep.latent_rule = "topic_change", "OB-22"
    else:
        ep.response = [t.id for t in response]
        ep.topic_change, ep.end_turn = tc_turn, end
        ep.end_reason = "topic_change" if tc_turn else "new_resistance" if next_start else "end_of_call"
    if ep.response:
        hi = pos[ep.end_turn] if ep.end_turn else len(seq)
        ep.reaction = [t.id for t in seq[pos[ep.response[0]] + 1: hi] if t.role != SALES]
    later = [q["turn"] for q in m["quotes"] if q["turn"] not in res.turns]
    ep.repeats = [t for t in later if t in ep.reaction]                 # inside the episode: persisting
    hi = pos[ep.end_turn] if ep.end_turn else len(seq)
    if any(pos[t] >= hi for t in later):                               # after the episode: a recurrence (OB-11, X4)
        ep.recurs_later = True
        ep.tags.append("recurs_later")
    ep.latent, rule = O.is_latent(ctx, ep)
    if ep.latent:
        ep.latent_rule = rule
    return ep


def _checked(T: O._Tasks, task, ans: Optional[dict], uid: str, ctx: CallContext, drops: Drops, name: str) -> Optional[dict]:
    if not isinstance(ans, dict):
        return None
    try:
        e = task.validate(ans, ctx, uid)
    except Exception as x:  # noqa: BLE001
        e = [f"invalid_shape:{type(x).__name__}"]
    if e:
        drops.add(STEP, f"{name}:{str(e[0]).split(':')[0]}", ans)
        return None
    return ans


def judge(ctx: CallContext, ep: O.Episode, raw: dict, res_starts: set[str], drops: Drops) -> None:
    """The engine's _judge, on the S4 readings (each checked by the engine task's validator). A gesture whose quote
    fails the check is not proved: it counts as not done (and is counted in the drops)."""
    T = O._Tasks()
    uid = ep.key
    T.units[uid] = ep
    f: dict[str, Any] = {"h1_tags": []}
    nature = ep.res.nature
    if not ep.response:
        f.update(ack=False, h1=0, h3=0, reaction_level="latent", isolate=False, explore=False, explore_content=False,
                 prompted=False, mismatch=False)
        ep.facts = f
        return
    first = ctx.turn(ep.response[0])
    first_sentence = (sentences(first.text) or [first.text])[0]
    ack_a = _checked(T, T.acknowledge(), raw.get("acknowledge"), uid, ctx, drops, "acknowledge")
    g = _checked(T, T.gesture(), raw.get("gesture"), uid, ctx, drops, "gesture") or {}
    e = raw.get("explore")
    exp_a = _checked(T, T.explore(), dict(e, explore=True) if isinstance(e, dict) else {"explore": False}, uid, ctx,
                     drops, "explore")
    i = raw.get("isolate")
    iso_a = _checked(T, T.isolate(), dict(i, isolate=True) if isinstance(i, dict) else {"isolate": False}, uid, ctx,
                     drops, "isolate") if nature == "objection" else None
    r = raw.get("reaction")
    res_a = _checked(T, T.resolution(), r, uid, ctx, drops, "reaction") if not ep.latent and ep.reaction else None
    f["ack"] = O.acknowledged(first_sentence, ack_a)
    f["ack_ev"] = Evidence((ack_a or {}).get("quote", first_sentence), first.id, SALES) if f["ack"] else None
    answer_ev = O._ev(ctx, {"turn": g.get("answer_turn"), "quote": g.get("answer_quote")}, SALES) \
        if g.get("answer_given") else None
    iso = O.isolation_valid(ctx, ep, iso_a, answer_ev) if nature == "objection" else False
    explored, content = O.exploration(ctx, ep, exp_a, res_starts)
    f["isolate"], f["explore"], f["explore_content"] = iso, explored, content
    f["iso_ev"] = O._ev(ctx, iso_a, SALES) if iso else None
    f["exp_ev"] = O._ev(ctx, exp_a, SALES) if explored else None
    f["exp_answer_ev"] = O._ev(ctx, {"turn": exp_a.get("answer_turn"), "quote": exp_a.get("answer_quote")}) \
        if content else None
    if g.get("cost_stated_by_prospect"):
        g = dict(g, cost_stated_by_prospect=bool(O._ev(ctx, {"turn": g.get("prospect_cost_turn"),
                                                              "quote": g.get("prospect_cost_quote")})))
    f["h1"], f["h1_tags"] = O.h1_level(nature, g, {"ack": f["ack"], "isolate": iso, "explore": explored})
    f["gesture_ev"] = O._ev(ctx, {"turn": g.get("gesture_turn"), "quote": g.get("gesture_quote")}, SALES) \
        if f["h1"] else None
    if nature == "inertia" and f["h1"] == 2:
        f["gesture_ev"] = f["gesture_ev"] or O._ev(ctx, {"turn": g.get("prospect_cost_turn"),
                                                          "quote": g.get("prospect_cost_quote")})
    f["h3"] = O.h3_level(nature, iso, explored, content)
    f["mismatch"] = nature != "objection" and bool(g.get("offer_argument")) and f["h1"] == 0
    f["answer_ev"] = answer_ev
    lvl, rev, prompted = O.resolution_level(ctx, ep, res_a)
    f["reaction_level"], f["reaction_ev"], f["prompted"] = lvl, rev, prompted
    if res_a and res_a.get("reaction_kind") == "other":
        ep.tags.append("uncovered_reaction")
    ep.facts = f
    ep.tags += f.get("h1_tags", [])


def _prevention_facts(ctx: CallContext, raw: dict, drops: Drops) -> dict:
    T = O._Tasks()
    task = T.prevention()
    out = {}
    for k in O.PROSPECT_FACTS + O.SALES_FACTS:
        d = raw.get(k)
        if not isinstance(d, dict) or not d.get("quote"):
            continue
        if _checked(T, task, {k: d}, "prevention", ctx, drops, f"prevention.{k}") is not None:
            out[k] = d
    return out


def run_objections(ctx: CallContext, s4: dict, drops: Drops) -> CompetenceResult:
    out = CompetenceResult("OBJECTIONS", "OBJ-1.1")
    if not ctx.offer_reference:
        out.flags.append("offer_reference_missing")
    objs = unique_objections(ctx, s4, drops)
    eps: list[O.Episode] = []
    for k, m in enumerate(objs, 1):
        nxt = objs[k]["quotes"][0]["turn"] if k < len(objs) else None
        eps.append(bound(ctx, m, k, nxt, drops))
    res_starts = {e.res.start for e in eps}
    for ep, m in zip(eps, objs):
        judge(ctx, ep, m["raw"], res_starts, drops)
    previous = [dict(e, call_id=p.get("call_id")) for p in ctx.prior_inputs
                if p.get("kind") == "objections_episodes" for e in p.get("episodes", [])]
    recurring_prev = O.link_recurrences(ctx, eps, previous)
    for ep in eps:
        ep.items = O.episode_items(ctx, ep, ep.facts)
        ep.score = call_score(ep.items)

    fp = ctx.phases.first_price
    h_status, p_status = O.applicability(len(eps), bool(fp))
    prevention, p_items, p_score = None, [], None
    if p_status == "scored":
        p_items, prevention, pf = O.prevention_items(ctx, _prevention_facts(ctx, s4.get("prevention") or {}, drops), fp)
        out.flags += pf
        p_score = call_score(p_items)
    h_score = O.handling_score(eps) if h_status == "scored" else None
    if h_status == "not_applicable" and p_status == "not_applicable":
        out.status, out.reasons = "not_applicable", ["no_resistance_no_price"]
    else:
        out.status = "scored"
        out.score = O.combine(h_score, p_score)
        if h_status == "not_applicable":
            out.reasons.append("no_resistance: call score = prevention score")
    if eps:
        out.flags.append("h5_provisional")
    call_items: list[ItemScore] = []
    for hid in O.H_WEIGHTS:
        levels = [(e, next(i for i in e.items if i.id == hid)) for e in eps]
        if levels:
            e, it = min(levels, key=lambda x: x[1].level)
            call_items.append(ItemScore(hid, O.H_WEIGHTS[hid], it.level, it.evidence, f"min over episodes ({e.id})"))
    out.items = call_items + p_items
    out.concordance = "single_reading"
    records = []
    for e, m in zip(eps, objs):
        rec = O.ObjectionsCompetence._episode_record(ctx, e)
        rec["quotes"] = m["quotes"]                      # every passage of this one objection (Romain 2026-11-03)
        rec["merged_items"] = m["merged"]
        records.append(rec)
    out.details = {
        "handling_status": h_status, "prevention_status": p_status,
        "handling_score": h_score, "prevention_score": p_score,
        "episodes": records,
        "prevention": O.ObjectionsCompetence._prevention_record(prevention, p_items),
        "deadlines_detected": [],
        "recurs_from_previous_call": recurring_prev,
        "diagnostics": O.diagnostics(ctx, eps, prevention),
        "unit_status": {"single_reading": len(eps)},
        "lite": {"scope": "after_pitch_start", "unique": True, "dropped": drops.counts.get(STEP, {})},
    }
    return out

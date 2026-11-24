"""S4 → Objections result (OBJ-1.2, lite reading): unique objections raised after the first price, A · I · E · M.

Romain (2026-11-03): only the resistances raised after the first price count (OB-27; before: after the pitch start).
Romain (2026-11-20): an objection that comes back after the sales moved on is a recurrence and opens a new episode linked
to the first (OB-11, the method); said again before the sales moved on, it stays a repetition of the same episode. The code:
- checks every quote (a PROSPECT or co-decider turn, exact passage, after the first price) and drops the others;
- derives the nature from the subjects of the doubt with the boundary tests of OB-3 (`nature_of_subjects`, OB-24);
- merges objections that share a quote; keeps objections of the same nature and theme together while the first episode
  lasts (a repetition) and opens a new episode for a passage after its end (a recurrence, OB-11: after the topic change
  or another resistance); a recurrence the model listed under the first objection, without its own reading, opens an
  episode `to_review` (counted in H5 of the first, left out of the scores);
- bounds one episode per objection: response = sales turns from the first passage to the topic change (the model's,
  checked: a SALES turn before the next objection), reaction = prospect turns after the first response; a quote of
  the same objection inside the reaction is a repetition (persisting); a recurrence gives H5 = 0 to the earlier episode;
- OB-28 (2026-11-24): the reaction is read reply by reply (S4r, `reaction_plan`, `checked_reading`, `engine.run_reactions`)
  on the prospect turns up to the next resistance; the level comes from `reaction_from_turns`, the last state winning;
- judges A · I · E · M, resolution, latency and prevention with the reference engine's functions (acknowledged,
  isolation_valid, exploration, h1_level, h3_level, resolution_level, is_latent, episode_items, prevention_items).
"""
from __future__ import annotations

from typing import Any, Optional

from lnp_callqa.competences import objections as O
from lnp_callqa.core import rounds
from lnp_callqa.core.models import CallContext, CompetenceResult, Evidence, ItemScore, SALES
from lnp_callqa.core.scoring import call_score
from lnp_callqa.core.text import norm, sentences

from .shim import Drops

STEP = "S4"


def _valid_quotes(ctx: CallContext, o: dict, drops: Drops) -> list[dict]:
    fp = ctx.phases.first_price
    out = []
    for q in o.get("quotes") or []:
        if not isinstance(q, dict):
            drops.add(STEP, "quote:not_an_object")
            continue
        e = O._prospect_side_ok(ctx, Evidence(q.get("quote") or "", q.get("turn") or ""))
        if e:
            drops.add(STEP, f"quote:{e}", q)
            continue
        if not rounds.objections_from_start(ctx) and (not fp or ctx.n(q["turn"]) <= ctx.n(fp)):
            drops.add(STEP, "quote:before_price", q)            # OB-27, Romain 2026-11-03: after the first price only
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
            drops.add(STEP, "objection:no_valid_quote_after_price")
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
    for it in items:                                                   # the same passage listed twice: one objection
        tgt = next((m for m in merged if _overlap(m["quotes"], it["quotes"])), None)
        if tgt is None:
            merged.append(it)
            continue
        _absorb(ctx, tgt, it)
    return chain(ctx, merged)


def _absorb(ctx: CallContext, tgt: dict, it: dict) -> None:
    tgt["merged"] += 1
    for q in it["quotes"]:
        if not _overlap(tgt["quotes"], [q]):
            tgt["quotes"].append(q)
    tgt["quotes"].sort(key=lambda q: ctx.n(q["turn"]))


def _theme(m: dict) -> tuple:
    return m["nature"], m["subtype"]


def episode_end(ctx: CallContext, m: dict, others: list[dict]) -> Optional[str]:
    """Where the first episode of an objection ends: the sales' topic change (the model's, a SALES turn after the first
    passage and before the next other resistance), else the start of the next resistance of another theme (OB-8)."""
    pos = O._pos(ctx)
    start = pos[m["quotes"][0]["turn"]]
    nxt = min((o["quotes"][0]["turn"] for o in others if _theme(o) != _theme(m) and pos[o["quotes"][0]["turn"]] > start),
              key=lambda t: pos[t], default=None)
    tc = (m.get("raw") or {}).get("topic_change")
    if isinstance(tc, dict) and tc.get("turn") in pos and pos[tc["turn"]] > start \
            and (nxt is None or pos[tc["turn"]] < pos[nxt]) \
            and not O._sales_ok(ctx, Evidence(tc.get("quote") or "", tc["turn"]), max_words=60):
        return tc["turn"]
    return nxt


def chain(ctx: CallContext, items: list[dict]) -> list[dict]:
    """OB-11 (Romain, 2026-11-20). A passage of the same nature and theme before the end of the first episode is a
    repetition (same objection); after it, a recurrence: its own episode. The model lists a recurrence as its own item
    (with its own reading); one it left under the first objection is split off without a reading (`unread`)."""
    pos = O._pos(ctx)
    out: list[dict] = []
    for m in items:
        end = episode_end(ctx, m, items)
        later = [q for q in m["quotes"] if end and pos[q["turn"]] >= pos[end]]
        if later and len(later) < len(m["quotes"]):
            m["quotes"] = [q for q in m["quotes"] if q not in later]
            out.append(m)
            out.append({"nature": m["nature"], "subtype": m["subtype"], "quotes": later, "raw": {}, "merged": 0,
                        "unread": True})
        else:
            out.append(m)
    out.sort(key=lambda m: pos[m["quotes"][0]["turn"]])
    kept: list[dict] = []
    for it in out:
        prev = next((m for m in reversed(kept) if _theme(m) == _theme(it)), None)
        if prev is not None:
            end = episode_end(ctx, prev, out)
            if end is None or pos[it["quotes"][0]["turn"]] < pos[end]:
                _absorb(ctx, prev, it)                                  # said again inside the episode: a repetition
                continue
        kept.append(it)
    return kept


def _first_sales(ctx: CallContext, after: str, before: Optional[str]) -> list:
    seq, pos = O.seq(ctx), O._pos(ctx)
    hi = pos[before] if before else len(seq)
    return [t for t in seq[pos[after] + 1: hi] if t.role == SALES]


def bound(ctx: CallContext, m: dict, k: int, next_start: Optional[str], drops: Drops,
          next_quote: Optional[str] = None) -> O.Episode:
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
    if not response and tc_turn:
        # OB-22 by the code (reference reading of 2026-11-23): the first sales turn after the resistance is the one that
        # changes the subject: it received and left, in one turn. Read as such, not as « no response »
        first = next((t for t in _first_sales(ctx, res.last, None) if not O.is_backchannel(t)), None)
        if first is not None and first.id == tc_turn:
            response = [first]
            raw = dict(raw, receive_and_leave=True)
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
        if ep.end_turn and ep.end_turn == next_start and next_quote \
                and norm(ctx.turn(next_start).text).find(norm(next_quote)) > 0:
            hi += 1                    # the turn of the next resistance opens with the reaction to this one (2026-11-20)
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


def _next_passage(ctx: CallContext, objs: list[dict], k: int) -> Optional[dict]:
    """The first passage of the next resistance that starts AFTER this one's first passage (OB-4, 2026-11-24): two
    resistances raised in the same turn share the sales' response; the first does not end where the second starts."""
    pos = O._pos(ctx)
    here = pos[objs[k - 1]["quotes"][0]["turn"]]
    return next((m["quotes"][0] for m in objs[k:] if pos[m["quotes"][0]["turn"]] > here), None)


def reaction_window(ctx: CallContext, ep: O.Episode, next_start: Optional[str], next_quote: Optional[str]) -> list[str]:
    """OB-28: the prospect turns that can react to this resistance, read one by one: after its last passage and before
    the next resistance (the turn of the next resistance too when it opens with the reaction to this one), whatever the
    sales' topic change; at most REACTION_WINDOW_MAX turns. Nothing to read without a sales response."""
    if not ep.response:
        return []
    seq, pos = O.seq(ctx), O._pos(ctx)
    hi = pos[next_start] if next_start else len(seq)
    if next_start and next_quote and norm(ctx.turn(next_start).text).find(norm(next_quote)) > 0:
        hi += 1
    out = [t.id for t in seq[pos[ep.res.last] + 1: hi] if t.role != SALES and t.id not in ep.res.turns]
    return out[:O.REACTION_WINDOW_MAX]


def reaction_plan(ctx: CallContext, s4: dict) -> list[dict]:
    """The episodes whose reaction is read reply by reply (OB-28), bounded exactly as `run_objections` bounds them (the
    same code on the same S4 answer): key, resistance, the prospect turns to read."""
    drops = Drops()
    objs = unique_objections(ctx, s4, drops)
    out = []
    for k, m in enumerate(objs, 1):
        if m.get("unread"):
            continue
        nxt = _next_passage(ctx, objs, k)
        ep = bound(ctx, m, k, nxt["turn"] if nxt else None, drops, nxt["quote"] if nxt else None)
        win = reaction_window(ctx, ep, nxt["turn"] if nxt else None, nxt["quote"] if nxt else None)
        if win:
            out.append({"key": ep.key, "turn": ep.res.start, "quote": ep.res.quote, "nature": ep.res.nature,
                        "subtype": ep.res.subtype, "window": win,
                        "last": max([ep.res.last] + win, key=lambda t: O._pos(ctx)[t])})
    return out


def checked_reading(ctx: CallContext, unit: dict, got: Any, drops: Drops) -> Optional[dict[str, dict]]:
    """One reader's answers for one episode, each turn checked (C3); a turn outside the window or that fails its check
    is dropped (read as saying nothing about the resistance). None when the reader gave nothing for the episode."""
    if not isinstance(got, list):
        return None
    out: dict[str, dict] = {}
    for a in got:
        if not isinstance(a, dict):
            continue
        tid = a.get("turn")
        if tid not in unit["window"]:
            drops.add(STEP, "reaction:turn_outside_window", {"turn": tid})
            continue
        a = dict(a)
        e = O.check_reaction_turn(ctx, tid, a)
        if e:
            drops.add(STEP, f"reaction:{e}", {"turn": tid})
            continue
        out[tid] = a
    return out or None                     # every turn is answered, « other » included: nothing valid = no reading


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


ELLIPTICAL_EXPLORE = __import__("re").compile(
    r"^\W*(et |ouais,? |oui,? |ok,? |d'accord,? |alors |du coup )*(pourquoi|comment ça|c'est-à-dire|par rapport à quoi|"
    r"dans quel sens|en quoi|à quel niveau|c'est quoi (le|ton|votre) (problème|souci|blocage|frein|doute)s?|"
    r"qu'est-ce qui (te |vous |t')?(bloque|freine|retient|gêne|gene|inquiète|inquiete|fait peur|dérange|pose problème)|"
    r"why( is that)?|how so|in what way|compared to what|meaning|what do you mean|what's the (problem|issue|concern))\b")


def _stems(text: str) -> set:
    """Content words by their first five letters: « réfléchis » and « réfléchisse » are the same word asked back."""
    return {w[:5] for w in O.content_words(text, drop_generic=False) if len(w) >= 5}


def _opens_on_open_question(text: str, resistance: str) -> Optional[str]:
    """OB-15 / OB-20: the open question among the first two sentences of a response turn that asks about the resistance
    itself: it reuses one of its words, or refers back to it by ellipsis (« par rapport à quoi ? », « c'est quoi le
    problème ? »), with nothing before it that contradicts, minimises or presses (OB-13). Its words, else None."""
    from lnp_callqa.competences import spin as SPN
    for sent in (sentences(text) or [text])[:2]:
        if O.not_acknowledged_by(sent):
            return None
        t = sent.strip()
        if not t.endswith("?") or SPN.solution_load_question(t) or SPN.offer_question(t):
            continue
        low = SPN._apostrophe(t.lower())
        elliptical = len(t.split()) <= 10 and bool(ELLIPTICAL_EXPLORE.search(low))
        if elliptical or (SPN.OPEN_WORDS.search(low) and _stems(t) & _stems(resistance)):
            return t
    return None


def judge(ctx: CallContext, ep: O.Episode, raw: dict, res_starts: set[str], drops: Drops,
          reaction: Optional[dict] = None, quotes: Optional[list[dict]] = None) -> None:
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
    # OB-20 by the code (reference reading of 2026-11-23): the response opens on an open question about what was just
    # said (« Tu réfléchis à quoi, du coup ? », « … par rapport à quoi ? »), with no contradiction before it: the
    # resistance is received, and explored
    open_q = _opens_on_open_question(first.text, " ".join(ctx.turn(t).text for t in ep.res.turns))
    if open_q and not f["ack"]:
        f["ack"] = True
        ack_a = dict(ack_a or {}, quote=open_q, elliptical_open_question=True)
        drops.add(STEP, "acknowledge:open_question_by_code")
    f["ack_ev"] = Evidence((ack_a or {}).get("quote", first_sentence), first.id, SALES) if f["ack"] else None
    answer_ev = O._ev(ctx, {"turn": g.get("answer_turn"), "quote": g.get("answer_quote")}, SALES) \
        if g.get("answer_given") else None
    iso = O.isolation_valid(ctx, ep, iso_a, answer_ev) if nature == "objection" else False
    explored, content = O.exploration(ctx, ep, exp_a, res_starts)
    if open_q and not explored:
        nxt = O.next_reaction_turn(ctx, first.id)
        explored = True
        content = bool(nxt and nxt.id not in res_starts and not O.approval_only(nxt.text) and len(nxt.text.split()) >= 4)
        exp_a = {"explore": True, "turn": first.id, "quote": open_q, "open_question": True, "elliptical": True,
                 "answered_with_content": content, "answer_turn": nxt.id if content else None,
                 "answer_quote": " ".join(nxt.text.split()[:25]) if content else None}
        drops.add(STEP, "explore:open_question_by_code")
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
    if reaction is not None:                                           # OB-28: read reply by reply, decided by code
        turns = dict(reaction.get("turns") or {})
        for q in quotes or []:                                         # a repetition of this objection still holds it
            if q["turn"] in ep.repeats and (turns.get(q["turn"]) or {}).get("kind") in (None, "agrees", "asks", "other"):
                turns[q["turn"]] = {"kind": "holds", "quote": q["quote"]}
        lvl2, rev2, prompted2 = O.reaction_from_turns(ctx, turns)
        if ep.latent and O.reaction_overrides_latent(lvl2, rev2):
            ep.tags.append(f"reacted_after_{ep.latent_rule}")          # the prospect came back to it: not latent
            ep.latent, ep.latent_rule = False, None
        if not ep.latent:
            lvl, rev, prompted = lvl2, rev2, prompted2
        ep.tags.append(f"reaction_{reaction.get('_status') or 'read'}")
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


def _link_same_call(ctx: CallContext, eps: list[O.Episode]) -> None:
    """OB-11 inside the call, every episode included (a recurrence `to_review` still shows that the earlier
    resolution did not hold): linked to the first episode of the chain, every earlier one recurs later (H5 = 0)."""
    pos = O._pos(ctx)
    end = lambda e: pos[e.end_turn] if e.end_turn else len(pos)
    ordered = sorted(eps, key=lambda e: pos[e.res.start])
    for i, e in enumerate(ordered):
        earlier = [f for f in ordered[:i] if (f.res.nature, f.res.subtype) == (e.res.nature, e.res.subtype)
                   and end(f) <= pos[e.res.start]]
        if earlier:
            e.recurrence_of = earlier[0].id
            for f in earlier:
                f.recurs_later = True
                if "recurs_later" not in f.tags:
                    f.tags.append("recurs_later")


def run_objections(ctx: CallContext, s4: dict, drops: Drops, reactions: Optional[dict] = None) -> CompetenceResult:
    """`reactions`: {episode key: {"turns": {turn id: answer}, "_status"}}, the reaction read reply by reply (OB-28,
    `engine.run_reactions`); an episode without one keeps the S4 reading of its reaction."""
    out = CompetenceResult("OBJECTIONS", "OBJ-1.2")
    if not ctx.offer_reference:
        out.flags.append("offer_reference_missing")
    objs = unique_objections(ctx, s4, drops)
    eps: list[O.Episode] = []
    for k, m in enumerate(objs, 1):
        nxt = _next_passage(ctx, objs, k)
        eps.append(bound(ctx, m, k, nxt["turn"] if nxt else None, drops, nxt["quote"] if nxt else None))
    res_starts = {e.res.start for e in eps}
    for ep, m in zip(eps, objs):
        if m.get("unread"):                                            # a recurrence with no reading of its own
            ep.status = "to_review"
            ep.tags.append("recurrence_unread")
            drops.add(STEP, "recurrence:unread")
            continue
        judge(ctx, ep, m["raw"], res_starts, drops, (reactions or {}).get(ep.key), m["quotes"])
    _link_same_call(ctx, eps)
    previous = [dict(e, call_id=p.get("call_id")) for p in ctx.prior_inputs
                if p.get("kind") == "objections_episodes" for e in p.get("episodes", [])]
    recurring_prev = O.link_recurrences(ctx, eps, previous)
    for ep in eps:
        if ep.status == "scored":
            ep.items = O.episode_items(ctx, ep, ep.facts)
            ep.score = call_score(ep.items)

    fp = ctx.phases.first_price
    h_status, p_status = O.applicability(len(eps), bool(fp) and not rounds.objections_from_start(ctx))
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
        levels = [(e, next(i for i in e.items if i.id == hid)) for e in eps if e.items]
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
        "lite": {"scope": "after_first_price", "unique": True, "dropped": drops.counts.get(STEP, {}),
                 "reactions": {k: v.get("_status") for k, v in (reactions or {}).items()}},
    }
    return out

"""Step SV · voices (C1, 2026-11-19): the model lists the wrong speaker labels, the code checks and repairs them before
any other step. Fictional French call (no real person, no real data)."""
import copy

import synthetic_call as sc
from callqa_lite.engine import analyse
from callqa_lite.steps import MockLiteClient
from callqa_lite.voices import apply, check, render_lines
from callqa_lite.shim import Drops
from lnp_callqa.core.foundation import parse_lines, parse_transcript
from lnp_callqa.core.models import CallContext

S, P = "Léa - Commerciale", "Julie Martin"
MAP = {S: "SALES", P: "PROSPECT"}
# the recorder's lines, with the label errors it makes: a question under the prospect's name, an answer under the
# sales' name, a line holding the end of one speaker and the start of the other
RAW = "\n".join([
    f"[00:00:05] {S}: Bonjour Julie, tu m'entends bien ?",
    f"[00:00:08] {P}: Oui, je t'entends. Alors, qu'est-ce qui t'a amenée à réserver cet appel ?",
    f"[00:00:15] {P}: Je donne des cours depuis deux ans, mais je n'ai pas assez d'élèves.",
    f"[00:00:24] {P}: Et tu as combien d'élèves aujourd'hui ?",
    f"[00:00:27] {S}: Trois élèves, surtout le soir.",
    f"[00:00:31] {S}: D'accord.",
])
FIXES = {"lines": [
    {"line": "L002", "role": "SALES", "from": "Alors, qu'est-ce qui"},       # split: the head stays the prospect's
    {"line": "L004", "role": "SALES"},                                         # whole line
    {"line": "L005", "role": "PROSPECT"},
]}


def ctx_of(raw=RAW):
    c = CallContext("c-sv", "sales-1", "2026-11-19T10:00:00+00:00", "Europe/Paris", parse_transcript(raw, MAP))
    c.lines = parse_lines(raw, MAP)
    return c


def test_parse_lines_keeps_one_item_per_recorded_line():
    lines = parse_lines(RAW + "\nune ligne sans heure", MAP)
    assert [l.id for l in lines] == ["L001", "L002", "L003", "L004", "L005", "L006"]
    assert lines[3].role == "PROSPECT" and lines[5].text == "D'accord. une ligne sans heure"
    assert len(parse_transcript(RAW, MAP)) == 3                         # the turns join L002 to L004, L005 to L006


def test_the_code_checks_each_correction():
    lines, d = parse_lines(RAW, MAP), Drops()
    items = FIXES["lines"] + [
        {"line": "L006", "role": "SALES"},                                # same role as the label
        {"line": "L009", "role": "SALES"},                                # no such line
        {"line": "L003", "role": "HOST"},                                 # unknown role
        {"line": "L004", "role": "PROSPECT"},                             # listed twice: the first one stands
        {"line": "L003", "role": "SALES", "from": "mais je ne sais pas"},  # quote not in the line: doubtful
        "L001",
    ]
    out = check(lines, (0, 5), items, d)
    assert out == {"L002": {"role": "SALES", "at": 19}, "L004": {"role": "SALES", "at": 0},
                   "L005": {"role": "PROSPECT", "at": 0}, "L003": {"role": "SALES", "at": None}}
    assert d.counts["SV"] == {"same_role": 1, "line_outside_chunk": 1, "role_unknown": 1, "line_listed_twice": 1,
                              "quote_not_in_line": 1, "not_an_object": 1}
    assert check(lines, (0, 2), [{"line": "L005", "role": "PROSPECT"}], Drops()) == {}     # outside the chunk


def test_the_turns_are_rebuilt_from_the_repaired_lines():
    lines = parse_lines(RAW, MAP)
    turns, st = apply(lines, check(lines, (0, 5), FIXES["lines"], Drops()))
    assert [(t.id, t.role, t.text) for t in turns] == [
        ("T001", "SALES", "Bonjour Julie, tu m'entends bien ?"),
        ("T002", "PROSPECT", "Oui, je t'entends."),
        ("T003", "SALES", "Alors, qu'est-ce qui t'a amenée à réserver cet appel ?"),
        ("T004", "PROSPECT", "Je donne des cours depuis deux ans, mais je n'ai pas assez d'élèves."),
        ("T005", "SALES", "Et tu as combien d'élèves aujourd'hui ?"),
        ("T006", "PROSPECT", "Trois élèves, surtout le soir."),
        ("T007", "SALES", "D'accord."),
    ]
    assert [t.repaired for t in turns] == [False, False, True, False, True, True, False]
    assert turns[4].speaker == S and turns[5].speaker == P                # a relabelled line takes its role's name
    assert st | {"turns_before": 0} == {"lines": 6, "relabelled": 2, "split": 1, "doubtful": 0, "share_corrected": 0.5,
                                         "share_doubtful": 0.0, "turns_before": 0, "turns_after": 7}


def test_a_doubtful_line_is_a_turn_of_its_own_left_out_of_the_prefix():
    from callqa_lite.steps import render_turns
    lines = parse_lines(RAW, MAP)
    turns, st = apply(lines, {"L003": {"role": "SALES", "at": None}})
    c = ctx_of()
    c.turns = turns
    assert [t.attribution_doubtful for t in turns] == [False, False, True, False, False]
    assert "Je donne des cours" not in render_turns(c) and st["doubtful"] == 1


def test_the_step_runs_first_in_chunks_with_its_own_prefix():
    client = MockLiteClient({"lite.sv_voices": [{"lines": FIXES["lines"][:1]}, {"lines": FIXES["lines"][1:]}, {}]})
    long_answer = "Je voudrais vivre de mes cours, " + "avoir plus d'élèves le soir et le week-end, " * 25
    c = ctx_of(RAW + f"\n[00:00:35] {P}: {long_answer}")          # enough prospect words for the diarization gate
    rec = analyse(c, client, {"sv_chunk_lines": 3})
    sv = [x for x in client.calls if x["task"] == "lite.sv_voices"]
    assert client.calls[0]["task"] == "lite.sv_voices" and [x["unit"] for x in sv] == ["L001-L003", "L004-L006", "L007-L007"]
    assert sv[0]["prefix"] == render_lines(c.lines) and sv[0]["prefix"].startswith("TRANSCRIPT · 7 lines\nL001 [SALES]")
    assert "L001 to L003" in sv[0]["prompt"]
    s0 = next(x for x in client.calls if x["task"] == "lite.s0_phases")
    assert "T005 [SALES] Et tu as combien" in s0["prefix"]                # the other steps read the repaired turns
    v = rec["meta"]["voices"]
    assert (v["status"], v["relabelled"], v["split"], v["turns_before"], v["turns_after"]) == ("checked", 2, 1, 4, 8)
    assert [t["role"] for t in rec["turns"]][:3] == ["SALES", "PROSPECT", "SALES"]


def test_a_chunk_cut_by_max_tokens_is_asked_again_in_two_halves():
    client = MockLiteClient({"lite.sv_voices": [('{"lines": [', "max_tokens"), FIXES, FIXES]})
    rec = analyse(ctx_of(), client, {"sv_chunk_lines": 6, "sv_min_chunk_lines": 2})
    assert [x["unit"] for x in client.calls if x["task"] == "lite.sv_voices"] == ["L001-L006", "L001-L003", "L004-L006"]
    assert rec["meta"]["voices"]["relabelled"] == 2 and rec["meta"]["voices"]["split"] == 1


def test_no_valid_answer_leaves_the_transcript_as_recorded_and_says_so():
    client = MockLiteClient({"lite.sv_voices": "not json"})
    rec = analyse(ctx_of(), client)
    assert rec["meta"]["voices"]["status"] == "unchecked" and "voices_unchecked" in rec["flags"]
    assert len(rec["turns"]) == 3


def test_more_than_ten_percent_of_doubtful_lines_excludes_the_call():
    client = MockLiteClient({"lite.sv_voices": {"lines": [{"line": "L003", "role": "SALES", "from": "pas là"}]}})
    rec = analyse(ctx_of(), client)
    assert rec["status"] == "diarization_suspect" and "attribution_rate" in rec["flags"]
    assert all(r["status"] == "excluded" for r in rec["results"].values())
    assert [x["task"] for x in client.calls] == ["lite.sv_voices"]


def test_a_call_with_right_labels_is_analysed_as_before():
    c = sc.context()
    c.lines = parse_lines(sc.transcript(), sc.SPEAKERS)
    a = {**sc.ANSWERS, "lite.sv_voices": {"lines": []}}
    with_sv = analyse(c, MockLiteClient(a))
    without = analyse(sc.context(), MockLiteClient(copy.deepcopy(sc.ANSWERS)))
    assert with_sv["results"] == without["results"] and with_sv["phases"] == without["phases"]
    assert with_sv["meta"]["voices"]["share_corrected"] == 0.0

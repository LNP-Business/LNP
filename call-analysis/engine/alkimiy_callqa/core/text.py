"""Text normalisation, exact-quote checks (Part C, C3) and the verbatim rule (Gap annex, GB-22)."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

from .models import CallContext, Evidence

_QUOTES = {"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"'}


def norm(s: Optional[str]) -> str:
    """C3 normalised comparison: case-insensitive, whitespace collapsed, straight = curly quotes."""
    s = unicodedata.normalize("NFC", s or "")
    for a, b in _QUOTES.items():
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip().lower()


def words(s: str) -> list[str]:
    return re.findall(r"[a-z0-9$€£][a-z0-9'$€£,.\-]*", norm(s))


def clean_tokens(s: str) -> list[str]:
    return [w.strip(".,") for w in words(s) if w.strip(".,")]


# ---------------------------------------------------------------- C3 evidence checks
def quote_ok(ctx: CallContext, ev: Evidence, *, min_words: int = 2, max_words: int = 40,
             allowed_phase: Optional[tuple[Optional[str], Optional[str]]] = None) -> Optional[str]:
    """Return None if the evidence is valid, else an error code (C3 rules 1-3)."""
    if ev is None or not ev.quote:
        return "missing_quote"
    try:
        t = ctx.turn(ev.turn)
    except KeyError:
        return "unknown_turn"
    q = norm(ev.quote).strip(' .,?!"')
    n = len(q.split())
    if n < min_words and len(norm(t.text).split()) > n:   # a whole one-word turn ("Failure.") is a valid quote
        return "quote_too_short"
    if n > max_words:
        return "quote_too_long"
    if q not in norm(t.text):
        return "not_a_substring"
    if ev.role and t.role != ev.role:
        return "wrong_speaker"
    if t.attribution_doubtful:
        return "attribution_doubtful"
    if allowed_phase:
        a, b = allowed_phase
        if a and ctx.n(t.id) < ctx.n(a):
            return "outside_phase"
        if b and ctx.n(t.id) >= ctx.n(b):
            return "outside_phase"
    return None


# ---------------------------------------------------------------- approval-only turns (C3 rule 5)
_APPROVAL = re.compile(
    r"^(yes|yeah|yep|yup|exactly|right|correct|totally|absolutely|for sure|sure|mm-?hmm|uh-?huh|ok(ay)?|"
    r"that's (right|true|correct|it)|100 ?%|pretty much|definitely|of course|no|nope)[\s.,!]*"
    r"((yes|yeah|exactly|right|totally|for sure|okay|cool)[\s.,!]*)*$")


def approval_only(text: str) -> bool:
    return bool(_APPROVAL.match(norm(text).strip()))


# ---------------------------------------------------------------- GB-22 verbatim rule
PERSON_SHIFT = {"i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself",
                "we": "you", "our": "your", "us": "you", "ourselves": "yourselves",
                "am": "are", "i'm": "you're", "im": "you're", "i've": "you've", "i'd": "you'd",
                "i'll": "you'll", "we're": "you're", "we've": "you've", "we'd": "you'd",
                "we'll": "you'll", "was": "were"}
STOP = set("""a an the and or but so to of in on at for with by from as about into over than then
that this these those it its is are be been being were was do does did have has had not no
you your you're you've you'd you'll yours yourself he she they them their there here what which who
whom when where why how if just very really also too can could would will should may might must
um uh oh yeah okay ok right like kind sort""".split())
GENERIC = set("""thing things stuff something everything anything way ways lot lots life people good bad
better hard easy want wants wanted feel feels felt like make makes made get gets got know knows think
thinks really just kind sort able""".split())

_NUM_WORDS = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
              "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
              "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100, "thousand": 1000}


def norm_number(tok: str) -> Optional[str]:
    """PB-21: 10K = 10,000 = $10,000 = ten thousand; currency ignored. Returns canonical digits or None."""
    t = tok.lower().strip("$€£.,")
    m = re.fullmatch(r"(\d+(?:[.,]\d+)*)(k|grand|m)?", t)
    if not m:
        return str(_NUM_WORDS[t]) if t in _NUM_WORDS else None
    raw = m.group(1)
    raw = raw.replace(",", "") if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", raw) else raw.replace(",", ".")
    try:
        v = float(raw)
    except ValueError:
        return None
    mult = {"k": 1e3, "grand": 1e3, "m": 1e6}.get(m.group(2) or "", 1)
    v *= mult
    return str(int(v)) if v == int(v) else str(v)


def _singular(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def canon(tokens: list[str], shift: bool) -> list[str]:
    """Allowed transformations of GB-22 (b): person shift, singular/plural, number normalisation."""
    out = []
    # merge "ten thousand" / "5 grand"
    i = 0
    while i < len(tokens):
        t = tokens[i]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        if norm_number(t) and nxt in ("thousand", "grand", "k"):
            out.append(str(int(float(norm_number(t)) * 1000)))
            i += 2
            continue
        n = norm_number(t)
        if n is not None and (re.search(r"\d", t) or t in _NUM_WORDS):
            out.append(n)
        else:
            if shift:
                t = PERSON_SHIFT.get(t, t)
            out.append(_singular(t))
        i += 1
    return out


def _contains(hay: list[str], needle: list[str]) -> bool:
    k = len(needle)
    return k > 0 and any(hay[i:i + k] == needle for i in range(len(hay) - k + 1))


def key_expression_ok(key_expression: str, prospect_text: str, sales_text: str) -> tuple[bool, str]:
    """GB-22 conditions (a), (b) and (d). Condition (c) (it carries the component) is the model's.

    Returns (ok, reason). reason in: ok, not_in_source, not_in_restitution, generic, empty.
    """
    ke = clean_tokens(key_expression)
    if not ke:
        return False, "empty"
    # (d) not generic: at least one word outside STOP and GENERIC, or a number
    if not any((w not in STOP and w not in GENERIC) or norm_number(w) for w in ke):
        return False, "generic"
    src = clean_tokens(prospect_text)
    # (a) in the source, exactly (no transformation on the prospect side)
    if not _contains(src, ke):
        # allow numbers written differently in the key expression vs source
        if not _contains(canon(src, False), canon(ke, False)):
            return False, "not_in_source"
    # (b) in the restitution after the allowed transformations
    if not _contains(canon(clean_tokens(sales_text), False), canon(ke, True)):
        return False, "not_in_restitution"
    return True, "ok"


def sentences(text: str) -> list[str]:
    """PB-33 sentence split: end punctuation, then split long sentences at ', and' + subject."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p.strip()]
    out: list[str] = []
    for p in parts:
        if len(p.split()) > 40:
            out += [x for x in re.split(r",?\s+and (?=(?:you|we|i|it|that|this|he|she|they)\b)", p) if x]
        else:
            out.append(p)
    return out

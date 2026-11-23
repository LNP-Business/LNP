"""The prospect's figures, listed by the code (GAP-1.4, GB-28 and GB-29; LNP, 2026-11-20).

The model lists the atoms of each answer; when it misses a figure, the gap formula had no A, or an unrelated fact as A
(the audit of 2026-11-20 on six calls: « 15 euros de l'heure », « minimum 2 000 euros », « 220 euros » and « là je
suis à 2000 » were not atoms, and « la conférence m'a convaincu » or « 3-4 heures par semaine » were selected as A).
So the code reads every prospect turn of the discovery and lists:

- the **figures** with a unit of the gap (money, time, clients): value, canonical unit, and the **kind** read from the
  words around the figure: `present` (where he is), `target` (where he wants to go), `past`, `expense` (what he pays),
  `offer` (the price or the programme), `other` (no marker, a hypothesis, a negation);
- the **targets without a figure**: a clause opened by a wish marker (« j'aimerais », « je veux », « objectif »…).

A figure the sales said just before is `prompted` (X12). Every quote is an exact passage of the prospect's turn: the
code never writes a word of its own. The gap competence merges this inventory with the model's atoms
(`gap.statements_with_figures`) and selects A and B on it (GB-28, GB-29). English twins of every French marker are
kept, so the English tests behave as before.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Optional

from . import lang_fr as FR
from .models import CallContext, PROSPECT, SALES, Turn
from .text import norm, norm_number

MONEY, TIME, CLIENTS = "money", "time", "clients"

# ------------------------------------------------------------------------------------------- units
_CURRENCY = re.compile(r"€|\beuros?\b|\beur\b|\bballes\b|\$|\bdollars?\b|\busd\b|\bbucks\b|\bk€")
_HOURS = re.compile(r"\b(heures?|hours?|hrs?)\b|\bh\b")
_CLIENTS = re.compile(r"\b(élèves?|eleves?|clients?|étudiants?|etudiants?|students?|customers?|leads?)\b")
_PERIOD = [("hour", re.compile(r"de l'heure|de l'h\b|l'heure|par heure|/\s?h\b|an hour|per hour|/hour|hourly")),
           ("day", re.compile(r"par jour|a day|per day|/day|daily")),
           ("week", re.compile(r"par semaine|la semaine|a week|per week|/week|weekly|semaine\b")),
           ("month", re.compile(r"par mois|le mois|a month|per month|/month|monthly|mensuel|\bmois\b|\bmonth\b")),
           ("year", re.compile(r"par an\b|par année|a year|per year|/year|yearly|annuel|\ban\b|\byear\b"))]


def canon_unit(u: Optional[str]) -> Optional[str]:
    """One spelling per unit, whatever the model or the code wrote: « euros de l'heure », "EUR/hour", "€/h" are all
    "EUR/hour"; "hours per week" and « heures par semaine » are "hours/week"; a bare period ("month") is an income
    period, "money/month". Unknown units keep their words without spaces (as before)."""
    if not u:
        return None
    n = norm(u)
    period = next((p for p, rx in _PERIOD if rx.search(n)), None)
    if _CURRENCY.search(n) or re.search(r"\b(money|revenu|salaire|income|revenue|net|brut|ca)\b", n):
        cur = "USD" if re.search(r"\$|usd|dollar|buck", n) else ("EUR" if _CURRENCY.search(n) else "money")
        return f"{cur}/{period}" if period else cur
    if _HOURS.search(n):
        return f"hours/{period}" if period and period != "hour" else "hours"
    if _CLIENTS.search(n):
        return f"clients/{period}" if period else "clients"
    if period and len(n.split()) <= 3:
        return f"money/{period}"
    return re.sub(r"\s+", "", n)


def dimension(unit: Optional[str]) -> Optional[str]:
    c = canon_unit(unit)
    if not c:
        return None
    if c.startswith(("EUR", "USD", "money")):
        return MONEY
    if c.startswith("hours"):
        return TIME
    if c.startswith("clients"):
        return CLIENTS
    return None


def units_match(a: Optional[str], b: Optional[str]) -> bool:
    """Same unit (GB-28, GB-29, G3): same canonical spelling; a currency-less income period matches any currency."""
    ca, cb = canon_unit(a), canon_unit(b)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    if dimension(ca) == MONEY and dimension(cb) == MONEY:
        pa, pb = (ca.split("/") + [None])[1], (cb.split("/") + [None])[1]
        return pa == pb and ("money" in (ca.split("/")[0], cb.split("/")[0]))
    return False


# ------------------------------------------------------------------------------------------- markers
_NUM = r"(?:\d{1,3}(?:[   ]\d{3})+|\d+(?:[.,]\d+)?)"
_WORD_NUM = r"(?:(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente|quarante|cinquante|two|three|" \
            r"four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty)\s+)?(?:mille|thousand)"
FIGURE = re.compile(rf"(?<![\w.,])(?:\$\s?)?(?P<num>{_NUM}|{_WORD_NUM})\s?(?P<k>k\b|K\b)?(?:\s?-\s?{_NUM})?", re.I)
MONTHS = re.compile(r"\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|"
                    r"décembre|decembre|january|february|march|april|june|july|august|september|october|november|"
                    r"december)\b")
RECENT = re.compile(r"\ble mois d|\ble mois dernier|\bce mois|\blast month\b|" + MONTHS.pattern)
PRESENT = re.compile(r"\b(là je suis|je (?:ne )?suis à|j'en suis à|je (?:ne )?suis payée?s?|on me paie|je (?:ne )?gagne|"
                     r"je (?:ne )?touche|je (?:ne )?fais|j'ai fait|je facture|ça reste|ça fait|ça me fait|ça doit avoir|"
                     r"je (?:ne )?travaille|je bosse|actuellement|en ce moment|aujourd'hui|maintenant|pour l?'?instant|"
                     r"right now|currently|"
                     r"at the moment|i make|i'm making|i am making|i'm at|i earn|i'm earning|i charge|i work|"
                     r"i'm working|where i'm at)\b")
TARGET = re.compile(r"\b(j'aimerais|je voudrais|je veux(?= (?!dire)\S)|je souhaite|je souhaiterais|objectif|mon but|minimum|au moins|"
                    r"au minimum|me conviendrait|me permettrait|pour vivre|pour en vivre|idéalement|idealement|"
                    r"j'ai besoin d|j'ai envie d|viser|atteindre|arriver à|passer à|plus que|i want|i'd like|"
                    r"i would like|my goal|ideally|at least|i need to|get to|reach)")
PAST = re.compile(r"\b(avant|à l'époque|a l'epoque|il y a \d+ ans|je gagnais|j'avais|j'étais|j'etais|je faisais|"
                  r"used to|i was making|i was at|i made|back then|last year)\b")
EXPENSE = re.compile(r"\b(je (?:la |le |les |l')?pay(?:e|ais|ait|é|ée)|j'ai payé|je dépense|je dépensais|ça (?:me )?coûte|"
                     r"coûtait|loyer|i pay|i paid|i spend|it costs? me)\b")
OFFER = re.compile(r"\b(formation|offre|accompagnement|programme|coaching|mentorat|starter|hybride|pack|tarif|prix|"
                   r"cher|budget|rembours\w*|mensualis\w*|financ\w*|investissement|paiement|program|mentorship|academy|"
                   r"price|investment|payment|installments?)\b")
NEGATION = re.compile(r"\b(pas|jamais|not|never|n't)\b")
HYPOTHESIS = re.compile(r"\b(si\b|if\b|par exemple|for example|imagine)")
CLOCK_BEFORE = re.compile(r"\b(à|vers|dès|avant|après|jusqu'à|entre|at|around|until)\s*$")
SKIP_AFTER = re.compile(r"^\s?(%|ans\b|years?\b|yrs\b|minutes?\b|min\b|kilom|km\b|jours?\b|days?\b|fois\b|times\b|"
                        r"pages?\b|" + MONTHS.pattern.strip(r"\b()") + r")", re.I)
# 2026-11-23 (control calls): a bare number of 100 or more right after the words that place the prospect on a scale
# (« je suis à 1893 », « un minimum de 2 000 ») is an amount, with no word for money around it
BARE_POSITION = re.compile(r"\b(je (?:ne )?suis à|j'en suis à|j'étais à|je tourne à|je tourne autour de|je suis autour de|"
                           r"(?:un |le )?minimum(?: de)?|au moins|je (?:ne )?cherche(?: pas)?|arriver à|atteindre|monter à|"
                           r"passer à|je vise|i'm at|i am at|at least|a minimum of)\s*(?:environ|à peu près|peut-être|genre|"
                           r"about|around)?\s*$")
MONEY_CONTEXT = re.compile(r"\b(net|brut|salaire|revenus?|gagn\w*|chiffre|ca|income|revenue|salary|make|making|earn\w*)\b")
WISH = re.compile(r"\b(j'aimerais|je voudrais|je veux(?= (?!dire)\S)|je souhaite|je souhaiterais|objectif|mon but|j'ai envie d|"
                  r"j'ai besoin d|me conviendrait|au moins|un minimum de|i want|i'd like|i would like|my goal|i need|i wish)")
IDIOM = re.compile(r"envie d'en pleurer|envie de pleurer|envie de vomir|envie de tout lâcher|je veux dire\b|"
                   r"ce que je veux dire|if you want|je veux bien\b|besoin de savoir|besoin de comprendre|"
                   r"besoin d'informations?|veux savoir|voudrais savoir|aimerais savoir|i want to know|"
                   r"i need to know")   # feelings, tics and requests for information, not a target
STRONG_PRESENT = re.compile(r"je suis pay|on me paie|je gagne|je touche|je facture|i make|i'm making|i earn|i charge")
KIND_RANK = {"present": 0, "target": 1, "past": 2, "expense": 3, "offer": 4}


@dataclass
class Figure:
    """One figure of the prospect (or a target without a figure, value None) as an exact passage of his turn."""
    turn: str
    quote: str
    value: Optional[float]
    unit: Optional[str]            # canonical: EUR, EUR/hour, hours/week, clients...
    dimension: Optional[str]       # money / time / clients
    kind: str                      # present / target / past / expense / offer / other
    prompted: bool = False         # the sales said the figure just before (X12)
    marker: Optional[str] = None   # the words that gave the kind

    def to_dict(self) -> dict:
        return asdict(self)


# ------------------------------------------------------------------------------------------- reading
def _tokens(text: str) -> list[tuple[int, int, str]]:
    return [(m.start(), m.end(), m.group()) for m in re.finditer(r"\S+", text)]


def _value(num: str, k: Optional[str]) -> Optional[float]:
    n = norm(num)
    words = n.split()
    if words and words[-1] in ("mille", "thousand"):
        base = FR.NUM_WORDS.get(words[0]) if len(words) > 1 else None
        if base is None and len(words) > 1:
            base = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
                    "ten": 10, "fifteen": 15, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50}.get(words[0])
        return float((base or 1) * 1000)
    v = norm_number(re.sub(r"[   ]", "", num))
    if v is None:
        return None
    return float(v) * (1000 if k else 1)


def _sentence_bounds(tokens: list[tuple[int, int, str]], i: int) -> tuple[int, int]:
    """Indexes [lo, hi) of the sentence holding token i (end punctuation closes a sentence)."""
    lo = i
    while lo > 0 and not re.search(r"[.!?]$", tokens[lo - 1][2]):
        lo -= 1
    hi = i + 1
    while hi < len(tokens) and not re.search(r"[.!?]$", tokens[hi - 1][2]):
        hi += 1
    return lo, hi


def _period_in(tail: str, limit: int = 28) -> tuple[Optional[str], int]:
    """The first income period named in the next words (raw text, accents kept): (period, end offset) or (None, 0)."""
    best = None
    tail = re.split(r"[.!?;]", tail, maxsplit=1)[0]
    for p, rx in _PERIOD:
        m = rx.search(norm_keep(tail[:limit]))
        if m and (best is None or m.start() < best[1]):
            best = (p, m.start(), m.end())
    return (best[0], best[2]) if best else (None, 0)


def norm_keep(s: str) -> str:
    """Lower case and one apostrophe, every character kept (offsets stay those of the raw text)."""
    return (s or "").lower().replace("\u2019", "'").replace("`", "'")


def _unit_after(text: str, end: int, dollar_before: bool = False) -> tuple[Optional[str], Optional[str], int]:
    """The unit right after the figure: (dimension, canonical unit, end offset of the unit and period words).
    `dollar_before`: the figure was written "$40" (the currency comes first)."""
    tail = text[end:end + 70]
    m = re.match(r"\s?(€|euros?\b|eur\b|balles\b|\$|dollars?\b|usd\b|bucks\b|k€)", tail, re.I)
    if m or dollar_before:
        mend = m.end() if m else 0
        period, pend = _period_in(tail[mend:])
        cur = "USD" if dollar_before or re.search(r"\$|usd|dollar|buck", m.group(1), re.I) else "EUR"
        return MONEY, (f"{cur}/{period}" if period else cur), end + mend + (pend if period else 0)
    m = re.match(r"\s?(heures?\b|hours?\b|hrs?\b|h\b)", tail, re.I)
    if m:
        if re.match(r"\d", tail[m.end():m.end() + 1]):                       # 14h30: a clock time
            return None, None, end
        period, pend = _period_in(tail[m.end():])
        if period == "hour":
            period, pend = None, 0
        return TIME, (f"hours/{period}" if period else "hours"), end + m.end() + pend
    m = re.match(r"\s?(élèves?|eleves?|clients?|étudiants?|etudiants?|students?|customers?|leads?)\b", tail, re.I)
    if m:
        period, pend = _period_in(tail[m.end():])
        return CLIENTS, (f"clients/{period}" if period else "clients"), end + m.end() + pend
    return None, None, end


def _nearest(rx: re.Pattern, before: str, after: str) -> Optional[tuple[int, str]]:
    """Distance (in characters) and words of the closest match of rx around the figure."""
    best = None
    for m in rx.finditer(before):
        d = len(before) - m.end()
        if best is None or d < best[0]:
            best = (d, m.group(0))
    for m in rx.finditer(after):
        d = m.start()
        if best is None or d < best[0]:
            best = (d, m.group(0))
    return best


SECOND_PERSON = re.compile(r"\b(tu|vous|t'|te|toi)\b")


def _kind(before: str, after: str, text_before_figure: str) -> tuple[str, Optional[str]]:
    near = norm(text_before_figure)
    close = " ".join(near.split()[-3:])
    if NEGATION.search(close) or HYPOTHESIS.search(close) or SECOND_PERSON.search(near):
        return "other", None
    found = {}
    for kind, rx in (("present", PRESENT), ("target", TARGET), ("past", PAST), ("expense", EXPENSE), ("offer", OFFER)):
        hit = _nearest(rx, before, after)
        if hit:
            found[kind] = hit
    if not found:
        return "other", None
    if "past" in found and RECENT.search(before + " " + after) and not STRONG_PRESENT.search(before):
        found["present"] = min(found.get("present", found["past"]), found["past"])     # a recent month: where he is
        del found["past"]
    kind = min(found, key=lambda k: (found[k][0], KIND_RANK[k]))
    return kind, found[kind][1]


def _prompted(ctx: CallContext, turn: Turn, value: Optional[float]) -> bool:
    """X12: the same figure in the sales turn just before (short prospect turns in between are skipped)."""
    if value is None:
        return False
    for t in reversed(ctx.turns[: ctx.n(turn.id)]):
        if t.role == SALES:
            for fm in FIGURE.finditer(t.text):
                if _value(fm.group("num"), fm.group("k")) == value:
                    return True
            return False
        if t.role == PROSPECT and len(t.text.split()) > 5:
            return False
    return False


def prospect_figures(ctx: CallContext, start: Optional[str], end: Optional[str]) -> list[Figure]:
    """Every figure with a unit of the gap in the prospect's turns of [start, end), in transcript order, plus the
    targets without a figure (`value` None, kind `target`). Ages, dates, durations in months or years, percentages
    and clock times are not figures of the gap."""
    out: list[Figure] = []
    for turn in ctx.window(start, end):
        if turn.role != PROSPECT or turn.attribution_doubtful:
            continue
        text = turn.text
        tokens = _tokens(text)
        seen_spans: list[tuple[int, int]] = []
        for m in FIGURE.finditer(text):
            if not re.search(r"\d|mille|thousand", m.group("num"), re.I):
                continue
            value = _value(m.group("num"), m.group("k"))
            if value is None:
                continue
            m_end = m.start() + len(m.group(0).rstrip())
            if SKIP_AFTER.match(text[m_end:m_end + 14]):
                continue
            head = text[max(0, m.start() - 12):m.start()]
            if CLOCK_BEFORE.search(norm(head) + " ") and TIME == _unit_after(text, m_end)[0]:
                continue
            dim, unit, uend = _unit_after(text, m_end, dollar_before="$" in m.group(0))
            i = next((k for k, (s, e, _) in enumerate(tokens) if s <= m.start() < e), None)
            if i is None:
                continue
            j = next((k for k, (s, e, _) in enumerate(tokens) if s < uend <= e), i)
            lo, hi = _sentence_bounds(tokens, i)
            b_lo = max(lo, i - 12)
            a_hi = min(hi, j + 8)
            before = norm(text[tokens[b_lo][0]:tokens[i][0]]) if i > b_lo else ""
            after = norm(text[tokens[j][1]:tokens[a_hi - 1][1]]) if a_hi - 1 > j else ""
            if dim is None:
                # a bare number is an income when its words say so (« là je suis à 2000 », « 2K a month »)
                period = next((p for p, rx in _PERIOD if rx.match(after.lstrip()) and p != "hour"), None)
                if value >= 100 and (MONEY_CONTEXT.search(before) or MONEY_CONTEXT.search(after[:30]) or period
                                     or BARE_POSITION.search(before)):
                    dim, unit = MONEY, f"money/{period}" if period else "money"
                else:
                    continue
            near = norm(text[tokens[max(lo, i - 6)][0]:tokens[i][0]]) if i > lo else ""
            kind, marker = _kind(before, after, near)
            # the quote: from the marker (when it opens the clause) to the unit words, or figure to a later marker
            q_lo, q_hi = tokens[i][0], tokens[j][1]
            if marker:
                mb = _nearest(re.compile(re.escape(marker)), before, "")
                if mb is not None:
                    nb = norm(text[tokens[b_lo][0]:tokens[i][0]])
                    pos = nb.rfind(marker)
                    # map the marker back to the raw text: count the words before it (a marker inside a token,
                    # « l'objectif », starts at that token)
                    nwords = len(nb[:pos].split()) - (1 if pos and nb[pos - 1] != " " else 0)
                    q_lo = tokens[b_lo + nwords][0] if b_lo + nwords < i else tokens[i][0]
                else:
                    ma = _nearest(re.compile(re.escape(marker)), "", after)
                    if ma is not None:
                        nwords = len(after[:ma[0]].split()) + len(marker.split())
                        q_hi = tokens[min(a_hi - 1, j + nwords)][1]
            quote = text[q_lo:q_hi].strip(" ,;:.!?")
            if (q_lo, q_hi) in seen_spans or any(f.turn == turn.id and f.value == value and f.unit == unit and
                                                 f.kind == kind for f in out):
                continue
            seen_spans.append((q_lo, q_hi))
            out.append(Figure(turn.id, quote, value, unit, dim, kind, _prompted(ctx, turn, value), marker))
        # targets without a figure: a clause opened by a wish, up to the end of its sentence (no digits in it)
        for lo, hi in _sentences(tokens):
            clauses = _clauses(text, tokens, lo, hi)
            for ci, (cs, ce) in enumerate(clauses):
                ctext = text[cs:ce]
                if re.search(r"\d", ctext) or len(ctext.split()) < 4:
                    continue
                wm = WISH.search(norm(ctext))
                if not wm or NEGATION.search(norm(ctext)[:wm.start()]) or IDIOM.search(norm(ctext)):
                    continue
                nc = norm(ctext)
                nwords = len(nc[:wm.start()].split()) - (1 if wm.start() and nc[wm.start() - 1] != " " else 0)
                words = _tokens(ctext)
                if nwords >= len(words):
                    continue
                q_lo = cs + words[nwords][0]
                q_hi = ce
                for cs2, ce2 in clauses[ci + 1:]:
                    if re.search(r"\d", text[cs2:ce2]) or len(text[q_lo:ce2].split()) > 22:
                        break
                    q_hi = ce2
                quote = text[q_lo:q_hi].strip(" ,;:.!?")
                if len(quote.split()) < 3 or any(quote in text[s:e] or text[s:e] in quote or
                                                 (s < q_lo < e) for s, e in seen_spans):
                    continue
                seen_spans.append((q_lo, q_hi))
                out.append(Figure(turn.id, quote, None, None, None, "target", False, wm.group(0)))
                break                                                     # one target clause per sentence
    return out


def _sentences(tokens: list[tuple[int, int, str]]) -> list[tuple[int, int]]:
    out, lo = [], 0
    for k, (_, _, w) in enumerate(tokens):
        if re.search(r"[.!?]$", w):
            out.append((lo, k + 1))
            lo = k + 1
    if lo < len(tokens):
        out.append((lo, len(tokens)))
    return out


def _clauses(text: str, tokens: list[tuple[int, int, str]], lo: int, hi: int) -> list[tuple[int, int]]:
    """Comma clauses of one sentence, as (start, end) offsets in the text."""
    out, start = [], tokens[lo][0]
    for k in range(lo, hi):
        s, e, w = tokens[k]
        if w.endswith((",", ";", ":")) or k == hi - 1:
            out.append((start, e))
            start = tokens[k + 1][0] if k + 1 < hi else e
    return [(s, e) for s, e in out if e > s]

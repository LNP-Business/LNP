"""The perfect restitution, in the prospect's words (GAP-1.4, §2.1; LNP, 2026-11-21).

The sentence the sales should have said is built from the prospect's own statements selected by the gap formula
(GB-28 to GB-30, GB-7b), never from the words the sales happened to reuse. Each slot is one complete clause of the
prospect (4 to 20 words, figures and units untouched), shifted to the second person by the same table the verbatim
rule uses (« je suis payée 15 euros » → « tu es payée 15 euros »); nothing else is changed, nothing is added. A slot the
prospect never filled says so, with the question to ask. The engine computes it once (`formula.perfect`); the screen
and the connector show it as it is.
"""
from __future__ import annotations

import re
from typing import Optional

from . import lang_fr as FR
from .text import norm

MAX_WORDS = 20
MIN_WORDS = 4
FILLERS = re.compile(r"^(?:(?:et|mais|donc|alors|voilà|bon|ben|euh|oui|non|en fait|du coup|là|enfin|bref|ok|d'accord|puis|"
                     r"après|déjà|justement|parce que|parce qu'|moi|toi|peut-être|je dis|je veux dire|c'est-à-dire|so|well|yeah|and|"
                     r"but|like)[,\s]+)+", re.I)
TAIL_FILLERS = re.compile(r"(?:[,\s]+(?:voilà|quoi|hein|en fait|tu vois|vous voyez|là|donc|ok|d'accord|right|you know))+$", re.I)
VERB_1_TO_2 = {"suis": "es", "ai": "as", "vais": "vas", "sais": "sais", "peux": "peux", "veux": "veux", "dois": "dois",
               "fais": "fais", "vois": "vois", "dis": "dis", "prends": "prends", "mets": "mets", "viens": "viens",
               "tiens": "tiens", "sors": "sors", "pars": "pars", "sens": "sens"}
PRONOUNS = {"me": "te", "m'": "t'", "moi": "toi", "mon": "ton", "ma": "ta", "mes": "tes", "moi-même": "toi-même",
            "mien": "tien", "mienne": "tienne", "miens": "tiens", "miennes": "tiennes"}


def _verb2(v: str) -> str:
    """The second-person form of a first-person verb: a table for the irregular ones, « -e » → « -es » for the first
    group (« j'habite » → « tu habites »), the rest unchanged (« j'aimerais », « je fais », « je peux »)."""
    low = v.lower()
    if low in VERB_1_TO_2:
        out = VERB_1_TO_2[low]
    elif low.endswith("e") and not low.endswith(("ais", "ée", "ue", "ie", "oie")) and len(low) > 2:
        out = low + "s"
    else:
        out = low
    return out.capitalize() if v[:1].isupper() else out


def shift_person(text: str) -> str:
    """« je » → « tu » with the verb that follows, « me/m' » → « te/t' », « mon/ma/mes » → « ton/ta/tes », « moi » → « toi ».
    Everything else stays: the prospect's words, figures, order."""
    def subj(m: re.Match) -> str:
        head, neg, refl, verb = m.group(1), m.group(2) or "", m.group(3) or "", m.group(4)
        cap = head[:1].isupper()
        tu = "Tu" if cap else "tu"
        v2 = _verb2(verb)
        refl2 = {"me ": "te ", "m'": "t'"}.get(refl.lower(), refl)
        if refl2 == "te " and re.match(r"^[aeiouyàâéèêëîïôûùh]", v2, re.I):
            refl2 = "t'"                                                 # « je me suis » → « tu t'es »
        return f"{tu} {neg}{refl2}{v2}"
    s = re.sub(r"\b([Jj](?:e\s+|'))(ne\s+|n')?(me\s+|m')?([A-Za-zÀ-ÿ]+)", subj, text)
    s = re.sub(r"\b(ne |n')?(me |m')([A-Za-zÀ-ÿ]+)", lambda m: (m.group(1) or "") + {"me ": "te ", "m'": "t'"}[m.group(2)] + m.group(3), s)
    def pron(m: re.Match) -> str:
        w = m.group(0); low = w.lower()
        out = PRONOUNS.get(low, w)
        return out.capitalize() if w[:1].isupper() and out != w else out
    s = re.sub(r"\b(moi-même|moi|mon|ma|mes|mien|mienne|miens|miennes)\b", pron, s, flags=re.I)
    return s


def _w(w: str) -> str:
    """One word, lower case, without punctuation (the quote and the turn differ by commas only)."""
    return re.sub(r"[^\w'€$%]", "", norm(w))


CONJ = {"donc", "mais", "parce", "et", "puis", "alors", "enfin", "car", "sinon", "or", "but", "so", "because", "and"}
DANGLING = {"et", "parce", "que", "qu'", "qui", "où", "car", "puis", "mais", "donc", "ça", "alors", "enfin", "quoi", "hein", "ou",
            "voilà", "là", "en", "fait", "tu", "vous", "si", "comme", "oui", "non", "pour", "à", "de", "dans", "sur", "avec",
            "par", "etc", "and", "but", "so", "because", "to", "of", "with"}


def clause_of(turn_text: str, quote: str) -> str:
    """The prospect's complete clause around the quote: from the start of its comma clause (at most 8 words before the
    quote) to the end of the quote, extended to the next punctuation when it is within 3 words; at most MAX_WORDS words,
    fillers removed at both ends, no dangling conjunction at the end. The quote itself is kept whole."""
    text = turn_text or ""
    q = (quote or "").strip()
    if not q:
        return ""
    sents = [x for x in re.split(r"(?<=[.!?])\s+", text) if x.strip()]
    qw = [_w(w) for w in q.split() if _w(w)]
    sent = next((x for x in sents if " ".join(qw) in " ".join(_w(w) for w in x.split() if _w(w))), None)
    if sent is None:
        # the quote spans two sentences: keep its last sentence when it is a clause of its own
        parts = [x for x in re.split(r"(?<=[.!?])\s+", q) if x.strip()]
        if len(parts) > 1 and len(parts[-1].split()) >= MIN_WORDS:
            return clause_of(turn_text, parts[-1])
        sent = q
    words = sent.split()
    nw = [_w(w) for w in words]

    def at(i: int) -> bool:
        if nw[i + 1:i + len(qw)] != qw[1:] or i + len(qw) > len(nw):
            return False
        return nw[i] == qw[0] or nw[i].endswith("'" + qw[0])          # « qu'il » holds « il »

    start = next((i for i in range(len(nw)) if at(i)), None)
    if start is None:
        start, end = 0, len(words)
    else:
        end = start + len(qw)
    lo = start
    head2 = " ".join(_w(w) for w in words[start:start + 2])
    own_subject = re.match(r"^(?:(?:là|moi|aujourd'hui|maintenant|actuellement) )?(je|j'|tu|moi|on|il|elle|ça|c'est|nous)\b", head2, re.I)
    if not own_subject:
        for i in range(start - 1, max(-1, start - 9), -1):        # back to the clause boundary, 8 words at most
            if words[i].endswith((",", ";", ":", ".", "!", "?")) or _w(words[i]) in CONJ:
                break
            lo = i
    elif re.match(r"^(?:là )?j'(?:étais|avais)\b", head2, re.I):   # « j'étais à » takes the clause before when it dates it
        prev = " ".join(_w(w) for w in words[max(0, start - 8):start])
        if re.search(r"\b(mois|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|"
                     r"décembre|decembre|dernier|dernière|semaine|année|an)\b", prev):
            i = start - 1
            while i > 0 and not words[i - 1].endswith((",", ";", ":", ".", "!", "?")) and start - i < 8:
                i -= 1
            lo = i
    hi = end                                                       # the clause ends where the quote ends
    seg = words[lo:hi]
    while len(seg) > MAX_WORDS and lo < start:                     # too long: give up words on the left first
        lo += 1
        seg = words[lo:hi]
    out = " ".join(seg).strip(" ,;:.!?")
    out = FILLERS.sub("", out)
    out = re.sub(r"^(?:parce qu'|puisqu'|qu')", "", out, flags=re.I)
    out = FILLERS.sub("", out)
    out = re.sub(r"^'[^\s]*\s+", "", out)                          # an orphan « 'est » left by the recorder
    out = re.sub(r"^[a-zA-Zàéèy]\s+", "", out)                       # an orphan letter (« y la fatigue »)
    out = TAIL_FILLERS.sub("", out).strip(" ,;:.!?")
    # a trailing fragment that opens a new clause (« parce que pour commencer », « si cette soutenance a lieu ou »,
    # « c'est un système de primes ») is left out when enough words remain
    cut = re.sub(r"[,\s]+(?:si|parce que|parce qu'|quand|c'est|alors)(?:\s+\S+){0,5}$", "", out, flags=re.I)
    if len(cut.split()) >= MIN_WORDS:
        out = cut
    toks = out.split()
    while toks and _w(toks[-1]) in DANGLING and len(toks) > MIN_WORDS:
        toks.pop()
    out = " ".join(toks).strip(" ,;:.!?")
    return out or q


def _starts_with_subject(s: str, impersonal: bool = True) -> bool:
    """The clause carries its own subject: « tu … » always; « ça fait », « c'est », « il faut » when `impersonal`."""
    pat = r"^(tu|t'|ça|c'est|c'était|il|elle|on|ce)\b" if impersonal else r"^(tu|t')\b"
    return bool(re.match(pat, s.strip(), re.I))


def perfect_formula(ctx, sel_a, sel_b, horizon: Optional[dict], sel_p, blocker_status: Optional[str],
                    cost, units_match_fn=None) -> dict:
    """The sentence, slot by slot. `cost` is the chosen cost statement (a Statement or None)."""
    def turn_text(tid):
        try:
            return ctx.turn(tid).text
        except (KeyError, AttributeError):
            return ""

    def slot(st, missing: str) -> dict:
        if st is None:
            return {"text": None, "missing": missing, "quote": None, "turn": None}
        cl = clause_of(turn_text(st.turn), st.quote)
        return {"text": shift_person(cl), "missing": None, "quote": st.quote, "turn": st.turn}

    a = slot(sel_a, "à faire dire : où il en est aujourd'hui, en chiffre")
    b = slot(sel_b, "à faire dire : où il veut arriver, dans la même unité que A, et pour quand")
    if blocker_status == "not_asked":
        p = {"text": None, "missing": "blocage jamais demandé : poser la question « qu'est-ce qui t'a empêché d'y arriver jusqu'ici ? »",
             "quote": None, "turn": None, "status": blocker_status}
    elif blocker_status == "asked_not_answered":
        p = {"text": None, "missing": "demandé, non dit : relancer « concrètement, qu'est-ce qui t'a retenu ? »",
             "quote": None, "turn": None, "status": blocker_status}
    else:
        p = dict(slot(sel_p, "à faire dire : ce qui le bloque aujourd'hui"), status=blocker_status)
    c = slot(cost, "à faire dire : ce que ça lui coûte, en argent, en temps, en famille")
    hz = (horizon or {}).get("horizon") or (horizon or {}).get("quote")
    unit_note = None
    if sel_a is not None and sel_b is not None and sel_a.quantified and sel_b.quantified and sel_a.unit and sel_b.unit \
            and units_match_fn is not None and not units_match_fn(sel_a.unit, sel_b.unit):
        unit_note = "A et B à ramener dans la même unité"

    def part(sl: dict, with_subject: str, without: str, impersonal: bool = True) -> str:
        if sl["text"] is None:
            return f"[{sl['missing']}]"
        t = sl["text"]
        prefix = with_subject if _starts_with_subject(t, impersonal) else without
        if prefix and not re.match(r"^[A-Z][a-z]+'", t):            # keep « D'être », lower the rest after a prefix
            t = t[:1].lower() + t[1:]
        return prefix + t

    s_a = part(a, "Aujourd'hui, ", "Aujourd'hui, tu es à ")
    if b["text"]:                                                    # « c'est déjà minimum 2 000 euros » → the target itself
        b["text"] = re.sub(r"^(?:c'est|ça serait|ce serait|ça fait)\s+(?:déjà|vraiment|plutôt|au moins|minimum)?\s*(?=\S)", "", b["text"], flags=re.I) or b["text"]
    s_b = part(b, "", "tu veux ", impersonal=False) + (f", d'ici {hz}" if hz and b["text"] else "")
    s_p = part(p, "ce qui te bloque, c'est que ", "ce qui te bloque, c'est ")
    s_c = part(c, "et ça te coûte : ", "et ça te coûte : ")
    sentence = f"{s_a} · {s_b} · {s_p} · {s_c}." + (f" [{unit_note}]" if unit_note else "") + " C'est bien ça ?"
    return {"sentence": sentence, "slots": {"A": a, "B": b, "P": p, "COST": c}, "unit_note": unit_note}

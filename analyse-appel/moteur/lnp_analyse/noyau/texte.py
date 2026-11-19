"""Text normalisation, exact-quote checks (Part C, C3) and the verbatim rule (Gap annex, GB-22)."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

from .modeles import ContexteAppel, Preuve

_GUILLEMETS = {"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"'}


def normaliser(s: Optional[str]) -> str:
    """C3 normalised comparison: case-insensitive, whitespace collapsed, straight = curly quotes."""
    s = unicodedata.normalize("NFC", s or "")
    for a, b in _GUILLEMETS.items():
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip().lower()


def mots(s: str) -> list[str]:
    return re.findall(r"[a-z0-9$€£][a-z0-9'$€£,.\-]*", normaliser(s))


def jetons_propres(s: str) -> list[str]:
    return [w.strip(".,") for w in mots(s) if w.strip(".,")]


# ---------------------------------------------------------------- C3 evidence checks
def citation_ok(ctx: ContexteAppel, ev: Preuve, *, mots_min: int = 2, mots_max: int = 40,
             phase_permise: Optional[tuple[Optional[str], Optional[str]]] = None) -> Optional[str]:
    """Return None if the evidence is valid, else an error code (C3 rules 1-3)."""
    if ev is None or not ev.citation:
        return "missing_quote"
    try:
        t = ctx.tour(ev.tour)
    except KeyError:
        return "unknown_turn"
    q = normaliser(ev.citation).strip(' .,?!"')
    n = len(q.split())
    if n < mots_min and len(normaliser(t.texte).split()) > n:   # a whole one-word turn ("Failure.") is a valid quote
        return "quote_too_short"
    if n > mots_max:
        return "quote_too_long"
    if q not in normaliser(t.texte):
        return "not_a_substring"
    if ev.role and t.role != ev.role:
        return "wrong_speaker"
    if t.attribution_douteuse:
        return "attribution_doubtful"
    if phase_permise:
        a, b = phase_permise
        if a and ctx.n(t.id) < ctx.n(a):
            return "outside_phase"
        if b and ctx.n(t.id) >= ctx.n(b):
            return "outside_phase"
    return None


# ---------------------------------------------------------------- approval-only turns (C3 rule 5)
_APPROBATION = re.compile(
    r"^(yes|yeah|yep|yup|exactly|right|correct|totally|absolutely|for sure|sure|mm-?hmm|uh-?huh|ok(ay)?|"
    r"that's (right|true|correct|it)|100 ?%|pretty much|definitely|of course|no|nope)[\s.,!]*"
    r"((yes|yeah|exactly|right|totally|for sure|okay|cool)[\s.,!]*)*$")


def approbation_seule(texte: str) -> bool:
    return bool(_APPROBATION.match(normaliser(texte).strip()))


# ---------------------------------------------------------------- GB-22 verbatim rule
CHANGEMENT_PERSONNE = {"i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself",
                "we": "you", "our": "your", "us": "you", "ourselves": "yourselves",
                "am": "are", "i'm": "you're", "im": "you're", "i've": "you've", "i'd": "you'd",
                "i'll": "you'll", "we're": "you're", "we've": "you've", "we'd": "you'd",
                "we'll": "you'll", "was": "were"}
MOTS_VIDES = set("""a an the and or but so to of in on at for with by from as about into over than then
that this these those it its is are be been being were was do does did have has had not no
you your you're you've you'd you'll yours yourself he she they them their there here what which who
whom when where why how if just very really also too can could would will should may might must
um uh oh yeah okay ok right like kind sort""".split())
GENERIQUES = set("""thing things stuff something everything anything way ways lot lots life people good bad
better hard easy want wants wanted feel feels felt like make makes made get gets got know knows think
thinks really just kind sort able""".split())

_MOTS_NOMBRES = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
              "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
              "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100, "thousand": 1000}


def normaliser_nombre(jet: str) -> Optional[str]:
    """PB-21: 10K = 10,000 = $10,000 = ten thousand; currency ignored. Returns canonical digits or None."""
    t = jet.lower().strip("$€£.,")
    m = re.fullmatch(r"(\d+(?:[.,]\d+)*)(k|grand|m)?", t)
    if not m:
        return str(_MOTS_NOMBRES[t]) if t in _MOTS_NOMBRES else None
    brut = m.group(1)
    brut = brut.replace(",", "") if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", brut) else brut.replace(",", ".")
    try:
        v = float(brut)
    except ValueError:
        return None
    mult = {"k": 1e3, "grand": 1e3, "m": 1e6}.get(m.group(2) or "", 1)
    v *= mult
    return str(int(v)) if v == int(v) else str(v)


def _singulier(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def canon(jetons: list[str], decalage: bool) -> list[str]:
    """Allowed transformations of GB-22 (b): person shift, singular/plural, number normalisation."""
    sortie = []
    # merge "ten thousand" / "5 grand"
    i = 0
    while i < len(jetons):
        t = jetons[i]
        suiv = jetons[i + 1] if i + 1 < len(jetons) else ""
        if normaliser_nombre(t) and suiv in ("thousand", "grand", "k"):
            sortie.append(str(int(float(normaliser_nombre(t)) * 1000)))
            i += 2
            continue
        n = normaliser_nombre(t)
        if n is not None and (re.search(r"\d", t) or t in _MOTS_NOMBRES):
            sortie.append(n)
        else:
            if decalage:
                t = CHANGEMENT_PERSONNE.get(t, t)
            sortie.append(_singulier(t))
        i += 1
    return sortie


def _contient(meule: list[str], aiguille: list[str]) -> bool:
    k = len(aiguille)
    return k > 0 and any(meule[i:i + k] == aiguille for i in range(len(meule) - k + 1))


def expression_cle_ok(expression_cle: str, texte_prospect: str, texte_commercial: str) -> tuple[bool, str]:
    """GB-22 conditions (a), (b) and (d). Condition (c) (it carries the component) is the model's.

    Returns (ok, reason). reason in: ok, not_in_source, not_in_restitution, generic, empty.
    """
    ke = jetons_propres(expression_cle)
    if not ke:
        return False, "empty"
    # (d) not generic: at least one word outside STOP and GENERIC, or a number
    if not any((w not in MOTS_VIDES and w not in GENERIQUES) or normaliser_nombre(w) for w in ke):
        return False, "generic"
    src = jetons_propres(texte_prospect)
    # (a) in the source, exactly (no transformation on the prospect side)
    if not _contient(src, ke):
        # allow numbers written differently in the key expression vs source
        if not _contient(canon(src, False), canon(ke, False)):
            return False, "not_in_source"
    # (b) in the restitution after the allowed transformations
    if not _contient(canon(jetons_propres(texte_commercial), False), canon(ke, True)):
        return False, "not_in_restitution"
    return True, "ok"


def phrases(texte: str) -> list[str]:
    """PB-33 sentence split: end punctuation, then split long sentences at ', and' + subject."""
    parties = [p.strip() for p in re.split(r"(?<=[.!?])\s+", texte.strip()) if p.strip()]
    sortie: list[str] = []
    for p in parties:
        if len(p.split()) > 40:
            sortie += [x for x in re.split(r",?\s+and (?=(?:you|we|i|it|that|this|he|she|they)\b)", p) if x]
        else:
            sortie.append(p)
    return sortie

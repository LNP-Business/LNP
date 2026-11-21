"""The blockers the prospect states, listed by the code (GAP-1.4, GB-30b; LNP, 2026-11-21).

« Ce qui te bloque » can be wrong for two reasons: the analysis missed what the prospect said, or the prospect never said
it because the sales never asked. The code reads two things in the discovery, so that the two cases are told apart
(GB-30, the four states of the blocker):

- the **stopping questions** of the sales (« qu'est-ce qui t'a empêché… », « pourquoi tu ne l'as jamais fait ? »), with the
  prospect turns that answer them;
- the **blocker clauses** of the prospect: a clause in the first person that says what prevents them (« je n'arrive pas
  à », « je ne sais pas comment », « ce qui me bloque », « je n'ai pas le temps / les moyens », « j'ai peur de », « je ne
  me suis pas donné les moyens », « il faut se déplacer »), as an exact passage of the turn.

Set aside, as for the costs: a clause whose subject is the sales, a question, reported speech, words the prospect only
repeats after the sales (X10). The code never writes a word of its own.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Optional

from .costs import HYPOTHESIS, SECOND_PERSON, REPORTED, _clauses, _prompted, _tokens
from .models import CallContext, PROSPECT, SALES
from .text import norm

# A question of the sales that asks what stops the prospect (GB-30 step 1). Transcripts often drop « n' » (« pourquoi tu
# n jamais essayé »), so the French forms are tolerant.
STOPPING = re.compile(
    r"held you back|holding you back|hold you back|stopp(?:ed|ing) you|stops you|getting in the way|standing in the way|"
    r"in your way|why haven'?t you|prevented you|what'?s been in the way|kept you from|keeping you from|"
    r"qu'est-ce qui (?:t'|te |vous )(?:a |as |avait )?(?:bloqu|empêch|empech|frein|retien|retenu|manqu|coinc|gên|gen)\w*|"
    r"ce qui (?:te |vous )(?:a |as )?(?:bloqu|empêch|empech|frein|retien|retenu)\w*|"
    r"qu'est-ce qui fait que (?:tu|vous) (?:n|ne |n'|ne l'|n'y )?\w*\s?(?:pas|jamais)|"
    r"pourquoi (?:tu|vous|t'as|t'es)\b[^?.!]{0,30}?\b(?:pas|jamais)\b|"
    r"pourquoi (?:tu|vous) (?:ne |n' ?)?(?:le |l'|la |les |y )?(?:fais|faites|as|avez|es|êtes)\b[^?.!]{0,20}?\b(?:pas|jamais|plus)\b|"
    r"c'est quoi qui (?:te |vous )?(?:bloque|empêche|freine|retient|manque)|"
    r"qu'est-ce qui (?:te |vous )?manque")

BLOCKER = re.compile(
    r"je (?:n'|ne |n )?arrive pas à|j'arrive pas à|je (?:ne )?sais pas (?:comment|par où|par quoi|faire|me vendre|me mettre)|"
    r"ce qui (?:me |m')(?:bloque|empêche|freine|retient|manque)|ça (?:me |m')(?:bloque|empêche|freine|retient)|"
    r"je (?:n'|ne |n )?(?:ai |avais )?pas (?:le temps|les moyens|la confiance|le réseau|les compétences|la visibilité|de visibilité|"
    r"de clients|d'élèves|de réseau|assez de|la méthode|de méthode|de structure|de stratégie|les codes|l'habitude|de temps)|"
    r"j'ai pas (?:le temps|les moyens|la confiance|le réseau|les compétences|de visibilité|de clients|d'élèves|de réseau|assez de|"
    r"la méthode|de méthode|de temps)|je (?:ne )?me suis pas donné les moyens|je (?:n'|ne |n )?(?:ai |avais )?jamais (?:réussi|osé|pris le temps|"
    r"su|trouvé|eu l'occasion)|j'ai jamais (?:réussi|osé|su|trouvé|eu l'occasion)|je (?:n'|ne )?ose pas|j'ose pas|j'ai peur de|"
    r"je (?:ne )?(?:connais|maîtrise) pas|je (?:n'|ne |n )?(?:ai |avais )?pas (?:réussi|su|pu)|il faut se déplacer|je (?:ne )?peux pas (?:me |m')|"
    r"je manque de|il me manque|l'occasion (?:ne )?s'est pas présentée|je (?:n'|ne |n )?(?:ai |avais )?pas (?:vraiment |du tout |beaucoup )?d'expérience|"
    r"j'ai pas (?:vraiment |du tout )?d'expérience|je (?:ne )?l'ai jamais fait|j'ai jamais fait ça|il n'y a rien qui tombe|il n'y rien qui tombe|rien ne tombe|"
    r"rien qui tombe|personne ne (?:me )?répond|aucune réponse|ça ne (?:marche|prend|décolle) pas|ça marche pas|ça prend pas|"
    r"(?:le côté|à cause de mon|avec mon|c'est mon) âge|je (?:ne )?suis pas (?:à l'aise|capable|faite? pour|"
    r"commerciale?|vendeur|vendeuse)|je (?:ne )?me sens pas (?:capable|légitime|à l'aise)|"
    r"i can'?t |i don'?t know how|what'?s holding me back|i haven'?t (?:managed|been able|dared)|i'?m (?:scared|afraid) to|"
    r"i don'?t have (?:the time|the money|the network|the skills|enough)|i never (?:managed|dared)|i'?m not (?:good at|comfortable|a salesperson)")

WORDS_BEFORE, WORDS_AFTER = 4, 8


def about_offer(text: str) -> bool:
    """A statement about paying for, or joining, the offer (« pas de moyens d'investir dans cette affaire »)."""
    return bool(OFFER_CONTEXT.search(norm(text or "")))
# a clause about paying for, or joining, the offer is a question on the offer, not what blocks the goal (X-offer)
OFFER_CONTEXT = re.compile(r"\b(?:payer|paye|prix|tarif|collaboration avec vous|avec vous|le programme|l'accompagnement|"
                           r"la formation|votre offre|vous rejoindre|m'inscrire|investir|mensualit\w*|budget pour|cette affaire|"
                           r"cette somme|ces \d[\d ]* ?euros)\b")


@dataclass
class Blocker:
    turn: str
    quote: str
    marker: str
    prompted: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class StoppingQuestion:
    turn: str
    quote: str                 # the sentence of the sales that asks
    answer_turns: list[str]    # the prospect turns that answer it, up to the next sales turn

    def to_dict(self) -> dict:
        return asdict(self)


def stopping_questions(ctx: CallContext, start, end) -> list[StoppingQuestion]:
    """Every sales turn of [start, end) that asks what stops the prospect, with its answer turns (the prospect turns
    that follow, up to the next sales turn of more than five words), in transcript order."""
    out: list[StoppingQuestion] = []
    turns = ctx.window(start, end)
    ids = [t.id for t in ctx.turns]
    for t in turns:
        if t.role != SALES or t.attribution_doubtful:
            continue
        m = STOPPING.search(norm(t.text))
        if not m:
            continue
        # the sentences of the turn that ask (« Pourquoi tu n'as jamais essayé ? Qu'est-ce qui t'a bloqué ? » is one question)
        asks = [s for s in re.split(r"(?<=[.!?])\s+", t.text) if STOPPING.search(norm(s))]
        sent = " ".join(asks) if asks else t.text
        answers: list[str] = []
        for u in ctx.turns[ids.index(t.id) + 1:]:
            if u.role == SALES and len(u.text.split()) > 5:
                break
            if u.role == PROSPECT and not u.attribution_doubtful:
                answers.append(u.id)
            if end is not None and not ctx.before(u.id, end):
                break
        out.append(StoppingQuestion(t.id, sent.strip(), answers))
    return out


def prospect_blockers(ctx: CallContext, start, end) -> list[Blocker]:
    """Every clause of the prospect's turns of [start, end) that says what prevents them, as an exact passage."""
    out: list[Blocker] = []
    for turn in ctx.window(start, end):
        if turn.role != PROSPECT or turn.attribution_doubtful:
            continue
        text = turn.text
        sentences = [(m.start(), m.end()) for m in re.finditer(r"[^.!?]+[.!?]*", text)]
        for cs, ce in _clauses(text):
            clause = text[cs:ce]
            nc = norm(clause)
            if not nc:
                continue
            sent = next((text[a:b] for a, b in sentences if a <= cs < b), clause)
            if OFFER_CONTEXT.search(norm(sent)):
                continue
            words = _tokens(clause)
            nwords = nc.split()
            taken: list[tuple[int, int]] = []
            for m in BLOCKER.finditer(nc):
                nb = len(nc[:m.start()].split()) - (1 if m.start() and nc[m.start() - 1] != " " else 0)
                n_marker = len(m.group(0).split())
                around = " ".join(nwords[max(0, nb - 8): nb + n_marker + 8])
                before = " ".join(nwords[max(0, nb - 8): nb])
                if SECOND_PERSON.search(around) or REPORTED.search(before) or HYPOTHESIS.search(before):
                    continue
                lo, hi = max(0, nb - WORDS_BEFORE), min(len(words), nb + n_marker + WORDS_AFTER)
                if lo >= len(words) or hi <= lo or any(a <= nb < b for a, b in taken):
                    continue
                taken.append((lo, hi))
                quote = clause[words[lo][0]:words[hi - 1][1]].strip(" ,;:.!?")
                if len(quote.split()) < 3 or any(b.turn == turn.id and (quote in b.quote or b.quote in quote)
                                                 for b in out):
                    continue
                out.append(Blocker(turn.id, quote, m.group(0).strip(), _prompted(ctx, turn, quote)))
    return out

"""The costs the prospect states, listed by the code (GAP-1.4, GB-7b; LNP, 2026-11-20).

On the six calls of the audit, the model listed no IMPACT atom for « difficultés financières très très graves »,
« j'ai envie d'en pleurer », « ça fatigue physiquement », « on profite moins des enfants », « je suis dépendante de
l'aide de ma mère », « ça me pèse émotionnellement »: the gap had no cost statement to show, and the restitution prompt
no source to point at. So the code reads every prospect turn of the discovery and lists the clauses that state a
consequence in one of the cost domains of the method (money, time, clients, family, health, self-belief), each as an
exact passage of the turn, with its domain and the words that gave it. Set aside: a clause about « tu » or « vous », a
negation right before the words (« je ne suis pas fatiguée »), a question, reported speech, and the words the sales
said in the turn just before (X10). The code never writes a word of its own; a current income, a price or a budget is
never a cost (X6: no figure is read here).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict

from .models import CallContext, PROSPECT, SALES, Turn
from .text import STOP, clean_tokens, norm

# French first, then the English twin of each family (the English tests behave as before: nothing matched them).
LEXICON: dict[str, re.Pattern] = {
    "money": re.compile(r"difficult\w+ financi\w+|galère\w* financi\w*|problèmes? d'argent|problèmes? financi\w+|"
                        r"dettes?\b|découvert\b|je n'arrive pas à payer|pas les moyens|fins? de mois difficile\w*|"
                        r"dépendante? (?:financièrement )?de|l'aide de (?:ma|mes|mon) (?:mère|parents|père|famille)|"
                        r"argent perdu|perte d'argent|je perds de l'argent|"
                        r"financial (?:trouble|difficult\w+|stress)|in debt|can't pay|i'm broke|depend(?:ent|ing)? on my"),
    "time": re.compile(r"plus (?:le )?temps pour|pas (?:le |de )?temps pour|je n'ai (?:plus|pas) (?:le |de )?temps|"
                       r"mes (?:soirées|week-ends|weekends|dimanches) (?:y passent|sont pris|sacrifi\w+)|"
                       r"je cours (?:partout|à droite et à gauche|à droite à gauche)|journées? à rallonge|"
                       r"je passe des journées|no time for|my evenings|my weekends"),
    "clients": re.compile(r"je perds (?:des|mes) (?:élèves|clients|étudiants)|j'ai perdu (?:des|mes|deux|trois) (?:élèves|clients)|"
                          r"losing (?:clients|students)|lost (?:clients|students)"),
    "family": re.compile(r"profite moins (?:de|des|de mes) enfants|on profite moins|moins (?:de temps|du temps) (?:avec|pour) (?:mes|les) enfants|"
                         r"je (?:ne )?vois (?:plus|pas|moins) mes enfants|(?:mes|les) enfants (?:en )?pâtissent|"
                         r"au centre de loisirs|ça pèse sur (?:ma|la) famille|tensions? (?:avec|dans) (?:mon|ma|le|la) (?:mari|femme|conjoint\w*|couple|famille)|"
                         r"(?:don't|barely|hardly) see my (?:kids|children|family)|my (?:kids|children) (?:suffer|pay for it)"),
    "health": re.compile(r"\bfatigu\w*|épuis\w+|crevée?s?\b|\bstress\w*|burn-?out|craquage|je dors mal|insomnies?|"
                         r"\bmalade\b|envie d'en pleurer|envie de pleurer|je pleure|déprim\w+|dépression|angoiss\w+|"
                         r"exhaust\w+|\btired\b|stressed|burnt? out|i cry|anxious|depress\w+"),
    "self_belief": re.compile(r"je me sens (?:vraiment |un peu |très )?(?:nulle?|exploitée?|inutile|mal|dévaloris\w+|incapable|"
                              r"coupable|seule?|perdue?|bloquée?)|me sentir (?:exploitée?|nulle?|inutile)|"
                              r"(?:plus|pas) (?:de )?confiance en moi|je doute de moi|j'ai honte|je culpabilise|"
                              r"ça me pèse|ça me ronge|ça me mine|ça me bouffe|découragée?|démotivée?|"
                              r"i feel (?:like a fraud|worthless|useless|stuck|guilty|exploited)|no confidence|"
                              r"doubt myself|ashamed|it eats (?:at )?me"),
}
NEGATION = re.compile(r"\b(?:pas|jamais|plus|not|never|n't|no)\s*$")
# a clause whose subject is the sales (« tu sais te valoriser »), not « je t'en parle »
SECOND_PERSON = re.compile(r"^\s*(?:tu|vous|you)\b|\b(?:tu|vous) (?:es|as|sais|vois|vas|dis|dites|êtes|avez|allez|fais|"
                           r"faites|peux|pouvez|parles|parlez)\b|\byou(?:'re| are| have| know| said| can)\b")
REPORTED = re.compile(r"\b(?:m'a dit|dit que|disait|il paraît|on m'a dit|told me|says that|said that)\b")
WORDS_BEFORE, WORDS_AFTER = 6, 6


@dataclass
class Cost:
    turn: str
    quote: str
    domain: str
    marker: str
    prompted: bool = False        # the sales said these words just before (X10)

    def to_dict(self) -> dict:
        return asdict(self)


def _tokens(text: str) -> list[tuple[int, int, str]]:
    return [(m.start(), m.end(), m.group()) for m in re.finditer(r"\S+", text)]


def _clauses(text: str) -> list[tuple[int, int]]:
    """Offsets of the clauses of a turn: sentences (a question is left out whole), then comma clauses."""
    out = []
    for sm in re.finditer(r"[^.!?]+[.!?]*", text):
        if not sm.group().strip() or sm.group().rstrip().endswith("?"):
            continue
        for m in re.finditer(r"[^,;:]+[,;:]*", sm.group()):
            if m.group().strip():
                out.append((sm.start() + m.start(), sm.start() + m.end()))
    return out


def _prompted(ctx: CallContext, turn: Turn, quote: str) -> bool:
    """X10: the prospect only approves what the sales just said (every content word of the quote is in the sales
    turn just before); « oui, ça fatigue physiquement » to « ça te fatigue ? » adds a word, so it is his."""
    content = [w for w in clean_tokens(quote) if len(w) > 3 and w not in STOP]
    if not content:
        return False
    for t in reversed(ctx.turns[: ctx.n(turn.id)]):
        if t.role == SALES:
            sales = set(clean_tokens(t.text))
            return all(w in sales for w in content)
        if t.role == PROSPECT and len(t.text.split()) > 5:
            return False
    return False


def prospect_costs(ctx: CallContext, start, end) -> list[Cost]:
    """Every clause of the prospect's turns of [start, end) that states a cost, in transcript order. A transcript
    without punctuation gives clauses of a hundred words: the checks (second person, reported speech, negation) and the
    quote are read in a window of a few words around the cost words, never on the whole clause."""
    out: list[Cost] = []
    for turn in ctx.window(start, end):
        if turn.role != PROSPECT or turn.attribution_doubtful:
            continue
        text = turn.text
        for cs, ce in _clauses(text):
            clause = text[cs:ce]
            nc = norm(clause)
            if not nc:
                continue
            words = _tokens(clause)
            nwords = nc.split()
            taken: list[tuple[int, int]] = []                                  # word ranges already quoted
            for domain, rx in LEXICON.items():
                for m in rx.finditer(nc):
                    nb = len(nc[:m.start()].split()) - (1 if m.start() and nc[m.start() - 1] != " " else 0)
                    n_marker = len(m.group(0).split())
                    around = " ".join(nwords[max(0, nb - 8): nb + n_marker + 8])
                    before = " ".join(nwords[max(0, nb - 8): nb])
                    if SECOND_PERSON.search(around) or REPORTED.search(before) or NEGATION.search(before + " "):
                        continue
                    lo, hi = max(0, nb - WORDS_BEFORE), min(len(words), nb + n_marker + WORDS_AFTER)
                    if lo >= len(words) or hi <= lo or any(a <= nb < b for a, b in taken):
                        continue
                    taken.append((lo, hi))
                    quote = clause[words[lo][0]:words[hi - 1][1]].strip(" ,;:.!?")
                    if len(quote.split()) < 2 or any(c.turn == turn.id and (quote in c.quote or c.quote in quote)
                                                     for c in out):
                        continue
                    out.append(Cost(turn.id, quote, domain, m.group(0), _prompted(ctx, turn, quote)))
    return out

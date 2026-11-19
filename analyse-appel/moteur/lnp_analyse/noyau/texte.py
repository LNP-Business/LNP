"""Normalisation du texte, vérification des citations exactes (partie C, C3) et règle du mot pour mot (annexe Écart, GB-22).

Les appels de LNP sont en français ; les transcriptions de référence des tests sont en anglais : chaque liste de mots
garde ses mots anglais et a ses équivalents français à côté."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

from .modeles import ContexteAppel, Preuve

_GUILLEMETS = {"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"'}


def normaliser(s: Optional[str]) -> str:
    """Comparaison normalisée de C3 : sans tenir compte de la casse, espaces réduits, apostrophes et guillemets
    typographiques ramenés aux droits (les accents restent)."""
    s = unicodedata.normalize("NFC", s or "")
    for a, b in _GUILLEMETS.items():
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip().lower()


# lettres accentuées du français (à â ç é è ê ë î ï ô ö ù û ü ÿ œ æ…) : un mot accentué reste un seul mot
_LETTRES = "a-z0-9à-öø-ÿœæ"


# Espace des milliers à la française (« 2 000 », « 10 000 € », y compris les espaces insécables U+00A0 et U+202F,
# ramenées à une espace par normaliser) : les groupes de trois chiffres sont recollés au nombre qui les précède.
_MILLIERS_FR = re.compile(r"(?<![\d.,])(\d{1,3})((?:\s\d{3})+)(?![\d.,]?\d)")


def recoller_milliers(s: str) -> str:
    return _MILLIERS_FR.sub(lambda m: m.group(1) + re.sub(r"\s", "", m.group(2)), s)


def mots(s: str) -> list[str]:
    return re.findall(rf"[{_LETTRES}$€£][{_LETTRES}'$€£,.\-]*", recoller_milliers(normaliser(s)))


def jetons_propres(s: str) -> list[str]:
    return [w.strip(".,") for w in mots(s) if w.strip(".,")]


# ---------------------------------------------------------------- vérification des preuves (C3)
def citation_ok(ctx: ContexteAppel, ev: Preuve, *, mots_min: int = 2, mots_max: int = 40,
             phase_permise: Optional[tuple[Optional[str], Optional[str]]] = None) -> Optional[str]:
    """Rend None si la preuve est valable, sinon un code d'erreur (C3, règles 1 à 3)."""
    if ev is None or not ev.citation:
        return "missing_quote"
    try:
        t = ctx.tour(ev.tour)
    except KeyError:
        return "unknown_turn"
    q = normaliser(ev.citation).strip(' .,?!"')
    n = len(q.split())
    if n < mots_min and len(normaliser(t.texte).split()) > n:   # un tour entier d'un seul mot (« Échec. ») est une citation valable
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


# ---------------------------------------------------------------- tours qui ne font qu'approuver (C3, règle 5)
# Sur le texte normalisé (minuscules, apostrophe droite, accents gardés) : formes françaises avec et sans accents.
_APPROBATION_FR = (r"(?:(?:ah|oh|bah|ben|eh) )?(?:oui|ouais)|ouai|ouaip|mouais|voil[àa]|exactement|exact|carr[ée]ment|tout [àa] fait|absolument|"
                   r"totalement|compl[èe]tement|clairement|[ée]videmment|effectivement|bien s[ûu]r|bien entendu|"
                   r"c'est (exactement |bien )?([çc]a|vrai|clair|exact|s[ûu]r|juste|certain)|d'accord|dac|grave|"
                   r"sans aucun doute|certainement|[àa] peu pr[èe]s|plus ou moins|[àa] 100 ?%|mm+h?|hm+|hum|non|nan")
_APPROBATION = re.compile(
    r"^(yes|yeah|yep|yup|exactly|right|correct|totally|absolutely|for sure|sure|mm-?hmm|uh-?huh|ok(ay)?|"
    r"that's (right|true|correct|it)|100 ?%|pretty much|definitely|of course|no|nope|" + _APPROBATION_FR + r")[\s.,!]*"
    r"((yes|yeah|exactly|right|totally|for sure|okay|cool|"
    r"oui|ouais|voil[àa]|exactement|exact|carr[ée]ment|tout [àa] fait|absolument|totalement|compl[èe]tement|"
    r"clairement|bien s[ûu]r|c'est (exactement |bien )?([çc]a|vrai|clair|exact)|exactement [çc]a|d'accord|ok|grave|"
    r"parfait|super)[\s.,!]*)*$")


def approbation_seule(texte: str) -> bool:
    return bool(_APPROBATION.match(normaliser(texte).strip()))


# ---------------------------------------------------------------- règle du mot pour mot (GB-22)
# Changement de personne permis (GB-22 b) : les mots du prospect à la première personne, redits par le commercial à la
# deuxième. Français : « je », « moi », « mon », « ma »… deviennent la deuxième personne, notée comme en anglais
# (« you », « your ») pour que le tutoiement et le vouvoiement du commercial comptent pareil (DEUXIEME_PERSONNE).
# Le « me » français (« je me sens ») suit déjà « me » → « you » ; « suis » / « es » / « êtes » deviennent « are ». Les
# autres verbes conjugués (« j'ai » / « vous avez ») ne sont pas ramenés l'un à l'autre.
CHANGEMENT_PERSONNE = {"i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself",
                "we": "you", "our": "your", "us": "you", "ourselves": "yourselves",
                "am": "are", "i'm": "you're", "im": "you're", "i've": "you've", "i'd": "you'd",
                "i'll": "you'll", "we're": "you're", "we've": "you've", "we'd": "you'd",
                "we'll": "you'll", "was": "were",
                "je": "you", "moi": "you", "nous": "you", "mon": "your", "ma": "your", "mes": "your",
                "notre": "your", "nos": "your", "moi-même": "yourself", "moi-meme": "yourself",
                "suis": "are", "sommes": "are"}
# deuxième personne du français, des deux côtés (tutoiement = vouvoiement), sous la même forme que l'anglais
DEUXIEME_PERSONNE = {"tu": "you", "te": "you", "toi": "you", "vous": "you", "ton": "your", "ta": "your",
                     "tes": "your", "votre": "your", "vos": "your", "toi-même": "yourself", "toi-meme": "yourself",
                     "vous-même": "yourself", "vous-meme": "yourself", "es": "are", "êtes": "are", "etes": "are"}
MOTS_VIDES = set("""a an the and or but so to of in on at for with by from as about into over than then
that this these those it its is are be been being were was do does did have has had not no
you your you're you've you'd you'll yours yourself he she they them their there here what which who
whom when where why how if just very really also too can could would will should may might must
um uh oh yeah okay ok right like kind sort""".split()) | set("""
le la les l' un une des du de d' au aux et ou mais donc ni que qu' qui quoi ce c' ça ca cet cette ces
il elle ils elles on je j' tu te t' toi moi me m' se s' lui leur leurs eux nous vous mon ma mes ton ta tes sa ses
notre nos votre vos y en ne n' pas plus non oui ouais ok d'accord est es suis sommes êtes etes sont être etre été ete
était etait étais etais ai as a avons avez ont avoir avais avait eu fait faire fais faisais va vais vas allez vont
aller peux peut pouvoir veux veut voulez vouloir dans sur sous pour par avec sans chez vers entre depuis pendant
avant après apres comme si alors aussi très tres trop bien juste vraiment déjà deja encore là la ici voilà voila
genre enfin bon bah ben euh hein quand comment pourquoi combien où quel quelle quels quelles c'est j'ai t'as
qu'il qu'on n'est n'ai c'était c'etait aujourd'hui maintenant""".split())
GENERIQUES = set("""thing things stuff something everything anything way ways lot lots life people good bad
better hard easy want wants wanted feel feels felt like make makes made get gets got know knows think
thinks really just kind sort able""".split()) | set("""
chose choses truc trucs machin quelque tout tous toute toutes rien n'importe façon facon manière maniere vie gens
bon bonne bien mieux mal dur difficile facile veux veut voulais voulez vouloir envie sens sentir ressens
faire fait fais avoir obtenir savoir sais sait pense penses pensez penser crois croire vraiment juste genre""".split())

_MOTS_NOMBRES = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
              "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
              "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100, "thousand": 1000,
              # français (« un » et « une » sont d'abord des articles : jamais un nombre ici)
              "zéro": 0, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "sept": 7, "huit": 8, "neuf": 9,
              "dix": 10, "onze": 11, "douze": 12, "quinze": 15, "vingt": 20, "trente": 30, "quarante": 40,
              "cinquante": 50, "soixante": 60, "cent": 100, "mille": 1000}
_MILLIERS = ("thousand", "grand", "k", "mille")   # « ten thousand », « 5 grand », « deux mille »


def normaliser_nombre(jet: str) -> Optional[str]:
    """PB-21 : 10K = 10,000 = $10,000 = ten thousand = 10 000 € = dix mille ; la devise est ignorée. Rend les chiffres
    canoniques ou None.

    Virgule : suivie d'exactement trois chiffres (« 2,000 », « 1,500.50 »), c'est le séparateur des milliers anglais ;
    sinon c'est la virgule décimale française (« 2,5 », « 2,50 », « 2,5 k€ »). Espace entre groupes de trois chiffres :
    séparateur des milliers français (« 2 000 »)."""
    t = recoller_milliers(re.sub(r"\s+", " ", jet.lower()).strip()).strip("$€£., ")
    m = re.fullmatch(r"(\d+(?:[.,]\d+)*)(?: ?(k)|(grand|m))?", t)
    if not m:
        return str(_MOTS_NOMBRES[t]) if t in _MOTS_NOMBRES else None
    brut = m.group(1)
    brut = brut.replace(",", "") if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", brut) else brut.replace(",", ".")
    try:
        v = float(brut)
    except ValueError:
        return None
    mult = {"k": 1e3, "grand": 1e3, "m": 1e6}.get(m.group(2) or m.group(3) or "", 1)
    v *= mult
    return str(int(v)) if v == int(v) else str(v)


def _singulier(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def canon(jetons: list[str], decalage: bool) -> list[str]:
    """Transformations permises par GB-22 (b) : changement de personne, singulier / pluriel, écriture des nombres."""
    sortie = []
    # réunir « ten thousand » / « 5 grand » / « deux mille »
    i = 0
    while i < len(jetons):
        t = jetons[i]
        suiv = jetons[i + 1] if i + 1 < len(jetons) else ""
        if normaliser_nombre(t) and suiv.strip("$€£") in _MILLIERS:     # « 2,5 k€ »
            sortie.append(str(int(float(normaliser_nombre(t)) * 1000)))
            i += 2
            continue
        n = normaliser_nombre(t)
        if n is not None and (re.search(r"\d", t) or t in _MOTS_NOMBRES):
            sortie.append(n)
        else:
            if decalage:
                t = CHANGEMENT_PERSONNE.get(t, t)
            t = DEUXIEME_PERSONNE.get(t, t)
            sortie.append(_singulier(t))
        i += 1
    return sortie


def _contient(meule: list[str], aiguille: list[str]) -> bool:
    k = len(aiguille)
    return k > 0 and any(meule[i:i + k] == aiguille for i in range(len(meule) - k + 1))


def expression_cle_ok(expression_cle: str, texte_prospect: str, texte_commercial: str) -> tuple[bool, str]:
    """Conditions (a), (b) et (d) de GB-22. La condition (c) (l'expression porte la composante) revient au modèle.

    Rend (ok, raison). raison parmi : ok, not_in_source, not_in_restitution, generic, empty.
    """
    ke = jetons_propres(expression_cle)
    if not ke:
        return False, "empty"
    # (d) pas générique : au moins un mot hors de MOTS_VIDES et de GENERIQUES, ou un nombre
    if not any((w not in MOTS_VIDES and w not in GENERIQUES) or normaliser_nombre(w) for w in ke):
        return False, "generic"
    src = jetons_propres(texte_prospect)
    # (a) dans la source, tel quel (aucune transformation du côté du prospect)
    if not _contient(src, ke):
        # admettre un nombre écrit autrement dans l'expression clé que dans la source
        if not _contient(canon(src, False), canon(ke, False)):
            return False, "not_in_source"
    # (b) dans la restitution, après les transformations permises
    if not _contient(canon(jetons_propres(texte_commercial), False), canon(ke, True)):
        return False, "not_in_restitution"
    return True, "ok"


def phrases(texte: str) -> list[str]:
    """Découpage en phrases de PB-33 : ponctuation de fin, puis les phrases longues (plus de 40 mots) coupées à
    « , and » / « , et » suivi d'un sujet."""
    parties = [p.strip() for p in re.split(r"(?<=[.!?])\s+", texte.strip()) if p.strip()]
    sortie: list[str] = []
    for p in parties:
        if len(p.split()) > 40:
            sortie += [x for x in re.split(r",?\s+(?:and (?=(?:you|we|i|it|that|this|he|she|they)\b)|"
                                           r"et (?=(?:tu|vous|on|je|il|elle|ils|elles|nous|[çc]a)\b|[jc]['’]))", p) if x]
        else:
            sortie.append(p)
    return sortie

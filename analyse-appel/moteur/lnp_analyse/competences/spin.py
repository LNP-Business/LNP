"""Compétence 1 · découverte SPIN (méthodologie SPIN v1.3, annexe A SB-1 à SB-35, partie C du moteur).

Deux couches qui ne se mélangent jamais (spin.md §1) :
- couche des lettres : chaque sollicitation du commercial reçoit S / P / I / N / OUT par cinq portes ordonnées.
  Diagnostic seulement : **la lettre ne rapporte jamais de points** (garde-fou du référentiel SPIN de LNP, annexe A X8) ;
- couche des effets : les atomes énoncés par le prospect dans ses réponses (SITUATION, PAIN, BLOCKER, IMPACT,
  DESIRE, VALUE). La note (items D1 à D5) se calcule à partir des atomes et des chaînes seulement.

Déroulé de ce module (partie C, C2) :
  S1 inventaire (code)                inventaire()                 SEG-1 à SEG-8, portage de segment.py du référentiel SPIN
  S3 portes (modèle)                  tâche des portes             cinq portes OUT/S/N/I/P, aiguillage, avec citations exactes
  S5 décision de la lettre (code)     decider_lettre()             portage de decide() (decide_all.py), le premier « oui » l'emporte
  périmètre (code)                    placer_perimetre()           SB-1, SB-2, SB-25, SB-34 : SPIN s'arrête à la présentation
                                                                   (SB-3 / SB-4 éteintes)
  plages de réponse (code)            plages_reponse()             SB-5 à SB-8
  atomes (modèle, puis code)          tâche des atomes + decider_atome()    SB-9 à SB-15, SB-22 à SB-24
  approfondissement (code)            approfondit()                SB-17, SB-19
  chaînes (lien du modèle + code)     tâche du lien + trouver_chaines()     SB-16, SB-18, SB-20
  items (code)                        noter_items()                §6 D1 à D5, règle des deux citations (C3, règle 4)
  diagnostics (code)                  diagnostics()                §8, affichés, jamais notés
  registres (modèle, puis code)       tâche du registre + decider_registre()   SB-26 à SB-33, affichés, jamais notés
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from ..noyau.modeles import (PROSPECT, COMMERCIAL, Atome, ContexteAppel, ResultatCompetence, Preuve, NoteItem,
                           Sollicitation, Tour)
from ..noyau.executeur import TacheModele, Executeur
from ..noyau.notation import note_appel, item
from ..noyau.texte import approbation_seule, normaliser, normaliser_nombre, citation_ok

# =============================================================================================== constantes
# Chaque valeur ci-dessous que la méthodologie marque « à valider » reste une constante de configuration.
POIDS = {"D1": 15, "D2": 20, "D3": 30, "D4": 20, "D5": 15}     # §6, poids à valider (§11)
MIN_CODEES = 5                     # §5 : nombre minimal de sollicitations codées pour `scored` (à valider, §11)
PART_MAX_ABSENTS = 0.05           # §5 santé : plus de 5 % de OUT `absent` -> exclu (seuil de santé de C7)
COMPTER_SPONTANES = True          # proposition du §11 : les atomes spontanés comptent pour D1 à D4 (jamais pour D5, SB-8)
MOTS_MAX_RELANCE_ORALE = 5         # SB-5 : une relance orale du commercial de 5 mots ou moins ne clôt pas une plage de réponse
MOTS_REPONSE_COURTE = 6            # SB-7
MIN_MOTS_CONTENU = 4              # SB-17 : mots de contenu de 4 lettres ou plus
MIN_DIAGNOSTICS_POINT_PRESENTATION = 2 # SB-4 : une réouverture dans la présentation demande au moins 2 questions de diagnostic
TOURS_FENETRE_REOUVERTURE = 24          # contexte donné au modèle pour placer la fin d'une réouverture (SB-3)
REOUVERTURES = False                # SB-34 (Romain 2026-10-27) : SPIN s'arrête à la présentation ; les réouvertures SB-3 / SB-4 sont éteintes
CIBLES_DIAG = {"p_followed_by_i": 0.50, "prompted_share": 0.15, "closed_need_payoff": 0}   # §8, à valider
BUDGET_APPEL = {"S": ("ceiling", 2), "P": ("ceiling", 2), "I": ("floor", 3), "N": ("floor", 3)}  # §8

LETTRES = ("S", "P", "I", "N")
OUT = "OUT"
# Raisons de OUT par ordre de priorité (§3). `absent` = aucune porte n'a dit oui (défaut du système, jamais contre le commercial).
PRIORITE_HORS = ["nothing", "offer_info", "solution_load", "sales_list", "agreement"]
AIGUILLAGE = ("VALIDATION_REQUEST", "DECISION_REQUEST")       # porte 0
TYPES_ATOMES = ("SITUATION", "PAIN", "BLOCKER", "IMPACT", "DESIRE", "VALUE")
DOMAINES = ("money", "time", "clients", "family", "health", "self_belief", "future", "other")   # §2, §4
DIMENSIONS = ("revenue", "clients", "time", "career_status", "other")    # §6 « lié à l'objectif »
ATOMES_ATTENDUS = {"S": {"SITUATION"}, "P": {"PAIN", "BLOCKER"}, "I": {"IMPACT"}, "N": {"DESIRE", "VALUE"}}

# Registres (SB-26 à SB-33, Romain 2026-10-27) : le code ramène le domaine sur lequel porte une question à un registre.
REGISTRES = ("financial", "time_load", "identity_status", "mental_emotional", "other")
LIBELLES_REGISTRE = {"financial": "Financial", "time_load": "Time & load", "identity_status": "Identity & status",
                   "mental_emotional": "Mental & emotional", "other": "Other"}
REGISTRE_DU_DOMAINE = {"money": "financial", "clients": "financial", "time": "time_load", "family": "time_load",
                      "future": "identity_status", "self_belief": "mental_emotional", "health": "mental_emotional",
                      "other": "other", "none": "other"}
BASES_REGISTRE = ("named", "answer", "reference", "none")   # SB-28 / SB-35 / SB-29 / SB-31
TOURS_REPONSE_REGISTRE = 3          # SB-35 : une question ouverte se lit dans (au plus) les trois premiers tours de sa réponse
TOURS_REFERENCE_REGISTRE = 2       # SB-29 : une référence se lit dans les deux derniers tours du prospect avant la question
ACCORD_MIN_REGISTRE = 0.92      # SB-33 : part, par appel, des registres décidés à 3/3 (objectif de 92 % fixé par Romain)
# Mots des domaines de SB-30, contre-vérification par le code d'une réponse « named » (SB-32, règle 3) ; cherchés en début de
# mot, sur le texte replié (minuscules, sans accents : _replier). Mots anglais (transcriptions des tests), puis français.
LEXIQUE_REGISTRE = {
    "financial": ("money", "income", "revenue", "earn", "salary", "cash", "price", "afford", "debt", "bills", "rent",
                  "financ", "profit", "dollar", "paid", "paying", "client", "customer", "project", "leads", "booking",
                  "pipeline", "sales",
                  "argent", "revenu", "salaire", "gagne", "gagnais", "chiffre d'affaires", "prix", "tarif", "dette",
                  "factur", "loyer", "benefice", "euro", "payer", "paye", "paie", "paiement", "les moyens", "fin de mois",
                  "fins de mois", "eleves", "projet", "vente", "vendre", "reservation", "carnet de commandes"),
    "time_load": ("time", "hour", "week", "weekend", "schedule", "workload", "busy", "family", "kid", "child", "wife",
                  "husband", "partner", "son", "daughter", "parent",
                  "temps", "heures", "une heure", "semaine", "planning", "horaire", "emploi du temps",
                  "charge de travail", "deborde", "ma famille", "ta famille", "votre famille", "sa famille", "en famille",
                  "vie de famille", "familial", "enfant", "gamin", "gosse", "bebe", "mon mari", "ton mari", "votre mari",
                  "ma femme", "ta femme", "votre femme", "conjoint", "compagne", "compagnon", "fils", "fille"),
    "identity_status": ("future", "years from now", "long term", "long-term", "where do you see yourself",
                        "where do you want to be", "become", "dream", "vision", "career", "legacy", "status",
                        "avenir", "futur", "long terme", "dans un an", "dans cinq ans", "dans 5 ans", "ou tu te vois",
                        "ou vous vous voyez", "ou tu veux etre", "ou vous voulez etre", "ou tu veux en etre",
                        "ou vous voulez en etre", "devenir", "rever", "reve ", "reves", "carriere", "statut",
                        "reconver"),
    "mental_emotional": ("confiden", "believe in yourself", "self-belief", "motivat", "mindset", "fear", "doubt",
                         "feel", "emotion", "frustrat", "proud", "health", "stress", "anxi", "burnout", "burn out",
                         "burned out", "exhaust", "tired", "sleep", "energy",
                         "confian", "croire en toi", "croire en vous", "croire en moi", "motiv", "etat d'esprit",
                         "mental", "peur", "doute", "ressen", "sentiment", "frustre", "fier", "sante", "angoiss",
                         "epuis", "fatigu", "sommeil", "dormir", "energie", "deprim", "moral", "culpabil", "honte",
                         "te sens", "vous sentez", "me sens", "se sent"),
}


# =============================================================================================== S1 inventaire
# Lexiques portés du script d'inventaire du référentiel SPIN (segment.py), complétés des tournures françaises.
def _replier(s: str) -> str:
    """Minuscules, apostrophe droite, accents retirés, ponctuation (sauf l'apostrophe) remplacée par une espace."""
    s = unicodedata.normalize("NFD", (s or "").lower().replace("’", "'"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s']", " ", s)


ACCUEIL = set("yes yeah yep yup ok okay right sure fine exactly totally absolutely definitely correct true indeed "
          "mm-hmm mhm uh-huh cool great perfect awesome nice wow oh gotcha amazing beautiful lovely love "
          # français, replié comme par _replier (sans accents)
          "oui ouais ouaip d'accord dac exactement exact carrement clairement absolument totalement evidemment voila "
          "super genial parfait top nickel bien excellent incroyable magnifique waouh mmh hum ah".split())
# mots de remplissage d'une relance orale (SEG-7), en plus de ACCUEIL
REMPLISSAGE = ("oh", "really", "so", "and", "hmm", "huh",
               "vraiment", "donc", "et", "euh", "hein", "bon", "ben", "bah", "tres", "tout", "a", "fait", "c'est", "ca")
# formes interrogatives sans point d'interrogation, sur la phrase en minuscules (accents gardés)
INTERRO = re.compile(r"^(how|what|what's|whats|when|where|why|who|which|whose|do|does|did|are|is|was|were|have|has|"
                     r"had|can|could|would|will|should|shall|may|might|am|isn't|aren't|don't|doesn't|didn't|won't|"
                     r"wouldn't|couldn't|"
                     r"comment|combien|pourquoi|quand|où|qui|quel|quelle|quels|quelles|lequel|laquelle|"
                     r"qu['’]est[- ]ce|est[- ]ce que|est[- ]ce qu['’]|c['’]est quoi|depuis quand|depuis combien|"
                     r"[àa] quel|[àa] quelle|as[- ]tu|avez[- ]vous|es[- ]tu|[êe]tes[- ]vous|peux[- ]tu|pouvez[- ]vous|"
                     r"veux[- ]tu|voulez[- ]vous|sais[- ]tu|savez[- ]vous|penses[- ]tu|pensez[- ]vous|"
                     r"aurais[- ]tu|auriez[- ]vous|serais[- ]tu|seriez[- ]vous)\b")
# demandes à l'impératif, sur la phrase repliée (_replier : sans accents, traits d'union devenus espaces)
IMPERATIF = re.compile(r"^(tell me|walk me through|talk me through|describe|explain|help me understand|share with me|"
                        r"give me a sense|paint me a picture|"
                        r"dis moi|dites moi|dis m'en|dites m'en|raconte|parle moi|parlez moi|explique|decri|"
                        r"aide moi a comprendre|aidez moi a comprendre|fais moi comprendre|faites moi comprendre|"
                        r"partage avec moi|partagez avec moi|donne moi une idee|donnez moi une idee|detaille|developpe|"
                        r"precise)")
# queues de validation en fin de phrase, sur la phrase en minuscules (accents gardés ; espace permise avant « ? »)
QUEUES = [r"\bright\?$", r"\bisn't it\?$", r"\bdon't you\?$", r"\bcorrect\?$", r"\byeah\?$", r"\bno\?$",
         r"\bis that it\?$", r"\bis that right\?$", r"\bam i right\?$", r"\bdoes that make sense\?$", r"\bfair\?$",
         r"\byou know\?$", r"\bok\?$", r"\bokay\?$",
         r"\bnon\s*\?$", r"\bhein\s*\?$", r"\bc['’]est (bien )?[çc]a\s*\?$", r"\bpas vrai\s*\?$",
         r"\bn['’]est[- ]ce pas\s*\?$", r"\btu vois\s*\?$", r"\bvous voyez\s*\?$", r"\bd['’]accord\s*\?$",
         r"\bok\s+\?$", r"\boui\s*\?$", r"\bouais\s*\?$", r"\bexact\s*\?$", r"\bj['’]ai raison\s*\?$",
         r"\bje me trompe\s*\?$", r"\bc['’]est (bien )?(juste|clair|logique)\s*\?$", r"\btu comprends\s*\?$",
         r"\bvous comprenez\s*\?$", r"\btu me suis\s*\?$", r"\bvous me suivez\s*\?$",
         r"\b[çc]a (te|vous) parle\s*\?$", r"\b[çc]a (a|fait) du sens\s*\?$", r"\b[çc]a fait sens\s*\?$"]
QUEUE_SEULE = re.compile(r"^(right|correct|yeah|no|okay|ok|fair|you know|does that make sense|is that right|am i right|"
                       r"isn't it|"
                       r"non|hein|oui|ouais|exact|d['’]accord|c['’]est (bien )?[çc]a|pas vrai|n['’]est[- ]ce pas|tu vois|"
                       r"vous voyez|j['’]ai raison|je me trompe|c['’]est (bien )?(juste|clair)|tu comprends|vous comprenez|"
                       r"tu me suis|vous me suivez|[çc]a (te|vous) parle)\s*\?$", re.I)
MOTS_VIDES = set(_replier("""the a an and or but so to of in on at for with that this it its is are was were be been i you he
she we they me my your our their them there here what how when where why who which do does did have has had not no
yes just like really very about from as if then than also can could would will should get got go going know think
mean thing things kind sort lot little bit yeah okay right well one two some any more most much many even still now
today make made want really actually maybe something anything everything people time
alors avec avoir dans donc elle elles etre etait etais fait faire mais nous vous leur leurs meme moins plus pour
quand quel quelle quels quelles quoi sans sont tout tous toute toutes tres voila vraiment aussi encore deja juste
comme comment combien pourquoi parce chose choses truc trucs genre enfin bref bien beaucoup ouais d'accord accord
exactement peut aujourd'hui maintenant chaque autre autres ceux celle celui cette ceci cela entre depuis pendant
avant apres jamais toujours souvent rien personne quelqu'un quelque quelques notre votre c'est j'ai j'avais
qu'est qu'il qu'on c'etait n'est d'ailleurs suis sommes etes avez avons avais avait aura serait sera vont vais
allez aller veux veut voulez vouloir pense penses pensez crois sais savez dire dis disais fois temps gens voir""").split())
MOTS_OFFRE = re.compile(r"\b(program|programme|academy|our (method|course|coaching|mentorship|offer)|the course|"
                         r"enroll|tuition|investment|price|cost|payment plan|"
                         r"notre (m[ée]thode|formation|accompagnement|coaching|offre|acad[ée]mie|suivi)|"
                         r"l['’]accompagnement|la formation|le coaching|le suivi|modules?|s[ée]ances?|"
                         r"inscri(re|ption|s)|investissement|tarif|prix|co[ûu]ts?|paiement en (plusieurs|\d+) fois|"
                         r"[ée]ch[ée]ancier)\b")
LIGNE_SYSTEME = re.compile(r"SCREEN SHARING|https?://|WATCH:")


def couper_phrases(texte: str) -> list[str]:
    """Coupe après . ? ! devant une majuscule (accentuée comprise : « À », « Ça », « Œ »), un chiffre ou un guillemet."""
    t = re.sub(r"\s+", " ", texte or "").strip()
    return [p.strip() for p in re.split(r"(?<=[.?!])\s+(?=[A-Z0-9À-ÖØ-ÞŒ\"'«“])", t) if p.strip()]


def forme_question(s: str) -> Optional[str]:
    """§2 Sollicitation : point d'interrogation final, forme interrogative sans point, ou demande à l'impératif."""
    ns = s.strip().lower()
    if ns.endswith("?"):
        return "interrogative"
    if IMPERATIF.match(_replier(ns).strip()):
        return "imperative"
    if INTERRO.match(ns):
        return "interrogative_no_mark"
    return None


def mots_contenu(s: str) -> set[str]:
    """SB-17 : mots de contenu (4 lettres ou plus, hors de la liste des mots vides) et nombres."""
    sortie = {w for w in _replier(s).split() if len(w) >= MIN_MOTS_CONTENU and w not in MOTS_VIDES}
    for jet in re.findall(r"\$?\d[\d,.]*k?", (s or "").lower()):
        n = normaliser_nombre(jet)
        if n is not None:
            sortie.add("#" + n)
    return sortie


@dataclass
class Unite:
    """Unité d'analyse interne : une sollicitation avec ses attributs calculés par le code."""
    sol: Sollicitation
    tour: Tour
    rang: int
    total_dans_tour: int
    preambule: str = ""
    prospect_prec: list[Tour] = field(default_factory=list)
    attrs: dict[str, Any] = field(default_factory=dict)
    portes_: Optional[dict] = None             # réponse des portes une fois résolue
    decision: Optional["DecisionLettre"] = None
    fin_fenetre: Optional[str] = None         # fin (exclue) de la fenêtre du périmètre à laquelle l'unité appartient
    dans_perimetre: bool = False
    reouverture: Optional[int] = None
    tours_spontanes: list[str] = field(default_factory=list)
    texte_reponse: str = ""
    suit_prec: bool = False               # cette question reprend la réponse précédente (SB-17 / SB-19)
    sans_reponse: bool = False                 # SB-6
    parties: list = field(default_factory=list)  # [(texte, DecisionLettre)] après une coupe SEG-2


def inventaire(ctx: ContexteAppel) -> list[Unite]:
    """S1 : chaque phrase du commercial qui est une sollicitation devient une unité (SEG-1) ; rien n'est supprimé, les
    filtres sont des attributs. SEG-4 : une queue de validation isolée ferme la phrase précédente. SEG-8 : tours du
    commercial seulement."""
    unites: list[Unite] = []
    tours = [t for t in ctx.tours if not t.attribution_douteuse]
    for idx, t in enumerate(tours):
        if t.role != COMMERCIAL:
            continue
        fusionne: list[str] = []
        for s in couper_phrases(t.texte):
            if QUEUE_SEULE.match(s) and fusionne:                           # SEG-4
                fusionne[-1] = fusionne[-1].rstrip(".!") + ", " + s
            else:
                fusionne.append(s)
        qs = [(k, s) for k, s in enumerate(fusionne) if forme_question(s)]
        p_prec = [x for x in tours[:idx] if x.role == PROSPECT][-2:]
        mots_pros = set().union(*[mots_contenu(x.texte) for x in p_prec]) if p_prec else set()
        for r, (k, s) in enumerate(qs, 1):
            ws = [w for w in _replier(s).split() if w]
            bas = s.strip().lower()
            attrs = {
                "form": forme_question(s),
                "validation_tail": any(re.search(p, bas) for p in QUEUES),                     # SEG-4
                "backchannel": len(ws) <= 3 and all(w.strip("'") in ACCUEIL or w in REMPLISSAGE for w in ws),  # SEG-7
                "alternative": bool(re.search(r"\b(or|ou)\b", bas)) and bas.endswith("?"),         # SEG-3
                "open_branch": bool(re.search(r"\bor (something else|anything else|other|not)\b|"
                                              r"\bou (pas|non|autre|quelque chose d['’]autre|rien)\b", bas)),
                "why": bool(re.search(r"\b(why|pourquoi)\b", bas)),
                "offer_mention": bool(MOTS_OFFRE.search(bas)),
                "anchor_words": sorted(mots_contenu(s) & mots_pros),                        # SEG-5 ancrage
                "n_words": len(ws),
                "stacked": len(qs) > 1,                                                       # SEG-1 / SB-6
                "system": bool(LIGNE_SYSTEME.search(s)),
                "no_final_mark": not s.strip().endswith("?"),
            }
            sid = f"Q{t.id[1:]}.{r}"
            etiquettes = [k2 for k2 in ("validation_tail", "backchannel", "stacked", "system") if attrs[k2]]
            unites.append(Unite(Sollicitation(sid, t.id, s, etiquettes=etiquettes), t, r, len(qs),
                              preambule=" ".join(fusionne[:k])[-500:], prospect_prec=p_prec, attrs=attrs))
    return unites


# =============================================================================================== S5 décision de la lettre
@dataclass
class DecisionLettre:
    lettre: str                 # S / P / I / N / OUT, ou NOT_SOLICITATION / ATTRIBUTION_DOUBTFUL / valeur d'aiguillage
    porte: int                   # 0 aiguillage, 1 OUT, 2 S, 3 N, 4 I, 5 P
    raison: Optional[str]       # raison du OUT
    etiquettes: list[str]
    preuve_invalide: bool = False


def _preuve_ok(citation: Optional[str], texte: str) -> bool:
    return bool(citation) and normaliser(citation).strip(' .,?!"') in normaliser(texte)


def decider_lettre(g: dict, attrs: dict, texte: str) -> DecisionLettre:
    """Portage de decide() (decide_all.py, référentiel SPIN P5 à P7), avec les noms de champs anglais du JSON.

    Ordre : filtres SEG, porte 0 (aiguillage), porte 1 OUT avec les règles dures du §3 évaluées avant tout test positif,
    puis S (porte 2), N (porte 3), I (porte 4), P (porte 5) ; le premier « oui » l'emporte ; aucun -> OUT `absent`.
    Une porte positive dont la citation n'est pas dans la sollicitation échoue (C3, règle 1) et marque la décision
    comme invalide.
    """
    etiquettes = list(g.get("tags") or [])
    if attrs.get("system") or g.get("is_solicitation") is False:
        return DecisionLettre("NOT_SOLICITATION", 0, None, etiquettes)
    if g.get("attribution_doubtful"):
        return DecisionLettre("ATTRIBUTION_DOUBTFUL", 0, None, etiquettes)
    if g.get("routing") in AIGUILLAGE:                                             # porte 0
        return DecisionLettre(g["routing"], 0, None, etiquettes)
    g1, g2, g3, g4, g5 = (g.get(k) or {} for k in ("g1", "g2", "g3", "g4", "g5"))
    raisons: list[str] = []
    if g1.get("reason") in PRIORITE_HORS:                                        # porte 1 (modèle)
        raisons.append(g1["reason"])
    if attrs.get("validation_tail"):                                           # règle dure : queue -> agreement
        raisons.append("agreement")
    if g3.get("state_or_value"):
        if g3.get("about_offer"):                                              # règle dure : valeur portant sur l'offre
            raisons.append("offer_info")
        if g3.get("load_named") and g3.get("antecedent") == "solution":         # règle dure : charge d'une solution
            raisons.append("solution_load")
        if g3.get("content_supplied") and not g3.get("load_named") and not g3.get("about_offer"):
            raisons.append("agreement")                                        # règle dure : besoin fermé (closed need-payoff)
            etiquettes.append("closed_need_payoff")
    if g4.get("consequence") and g4.get("antecedent_solution") and g3.get("load_named"):
        raisons.append("solution_load")
    if raisons:
        return DecisionLettre(OUT, 1, min(raisons, key=PRIORITE_HORS.index), sorted(set(etiquettes)))
    invalide = False

    def porte(cond: Any, partie: dict) -> bool:
        nonlocal invalide
        if not cond:
            return False
        if not _preuve_ok(partie.get("quote"), texte):
            invalide = True
            return False
        return True

    if porte(g2.get("neutral_fact") and not g2.get("exclusion"), g2):
        return DecisionLettre("S", 2, None, etiquettes, invalide)
    if porte(g3.get("state_or_value") and g3.get("antecedent") != "problem", g3):
        return DecisionLettre("N", 3, None, etiquettes, invalide)
    if porte(g4.get("consequence") and not g4.get("same_domain") and not g4.get("antecedent_solution"), g4):
        return DecisionLettre("I", 4, None, etiquettes, invalide)
    if porte(g5.get("difficulty") and (not g5.get("sales_named") or g5.get("anchored")), g5):
        return DecisionLettre("P", 5, None, etiquettes, invalide)
    return DecisionLettre(OUT, 1, "absent", etiquettes, invalide)


def decider_portes(g: dict, attrs: dict, texte: str) -> list[tuple[str, DecisionLettre]]:
    """Applique la coupe SEG-2 du modèle s'il y en a une : rend [(texte, décision)] pour une ou plusieurs unités."""
    coupe, sous = g.get("split"), g.get("sub")
    if isinstance(coupe, list) and isinstance(sous, list) and len(coupe) >= 2 and len(sous) == len(coupe):
        # la queue de validation appartient à la proposition qu'elle ferme (SEG-4) : seule la dernière partie la garde
        sortie = []
        for j, (txt, sg) in enumerate(zip(coupe, sous)):
            a = dict(attrs, validation_tail=attrs.get("validation_tail") and j == len(coupe) - 1)
            sortie.append((txt, decider_lettre(sg, a, txt)))
        return sortie
    return [(texte, decider_lettre(g, attrs, texte))]


def est_lettre_codee(lettre: Optional[str]) -> bool:
    return lettre in LETTRES or lettre == OUT


# =============================================================================================== S3 tâche des portes
def _ctx_lines(tours: list[Tour], limite: int = 600) -> str:
    return "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.texte[-limite:]}" for t in tours)


def _construire_portes(ctx: ContexteAppel, u: Unite) -> str:
    pos = "après la fin de la découverte (phase de l'offre, de la présentation ou de la conclusion)" \
        if u.attrs.get("post_end") else "avant la première présentation de l'offre ou le premier prix"
    return (f"UNITÉ : {u.sol.id}  (tour {u.tour.id}, sollicitation {u.rang} sur {u.total_dans_tour} dans le tour ; {pos})\n"
            f"TOURS PRÉCÉDENTS DU PROSPECT :\n{_ctx_lines(u.prospect_prec) or '(aucun)'}\n"
            f"PRÉAMBULE DU COMMERCIAL DANS LE MÊME TOUR : {u.preambule or '(aucun)'}\n"
            f"SOLLICITATION : {u.sol.texte}\n"
            f"ATTRIBUTS CALCULÉS PAR LE CODE : validation_tail={u.attrs['validation_tail']} alternative={u.attrs['alternative']} "
            f"open_branch={u.attrs['open_branch']} offer_mention={u.attrs['offer_mention']} "
            f"anchor_words={u.attrs['anchor_words']}\n"
            "Réponds à chaque porte (même après un « oui » plus tôt). Les citations sont des sous-chaînes exactes de "
            "SOLLICITATION.")


RAISONS_PORTE = set(PRIORITE_HORS) | {None}


def _valider_obj_porte(g: dict, texte: str, profondeur: int = 0) -> list[str]:
    errs = []
    if not isinstance(g, dict):
        return ["not_an_object"]
    if g.get("routing") not in (None, *AIGUILLAGE):
        errs.append("bad_routing")
    g1 = g.get("g1") or {}
    if g1.get("reason") not in RAISONS_PORTE:
        errs.append("bad_out_reason")
    positifs = [("g1", g1.get("reason")), ("g2", (g.get("g2") or {}).get("neutral_fact")),
                 ("g3", (g.get("g3") or {}).get("state_or_value")), ("g4", (g.get("g4") or {}).get("consequence")),
                 ("g5", (g.get("g5") or {}).get("difficulty"))]
    for k, pos in positifs:
        if pos:
            q = (g.get(k) or {}).get("quote")
            if not _preuve_ok(q, texte):
                errs.append(f"bad_quote:{k}")
            elif len(normaliser(q).split()) > 40:
                errs.append(f"quote_too_long:{k}")
    if (g.get("g3") or {}).get("antecedent") not in (None, "resolution", "problem", "solution", "none"):
        errs.append("bad_antecedent")
    coupe = g.get("split")
    if coupe and profondeur == 0:
        sous = g.get("sub") or []
        if not isinstance(coupe, list) or not isinstance(sous, list):
            return errs + ["bad_split"]
        if len(coupe) < 2 or len(sous) != len(coupe):
            errs.append("bad_split")
        for j, partie in enumerate(coupe):
            if not _preuve_ok(partie, texte):
                errs.append(f"split_not_verbatim:{j}")
            elif j < len(sous):
                errs += [f"sub{j}:{e}" for e in _valider_obj_porte(sous[j], partie, 1)]
    return errs


def tache_porte(u: Unite) -> TacheModele:
    """Une tâche fermée par sollicitation. La clé comparée d'une passe à l'autre est la décision du code elle-même."""
    def cle(a: dict) -> Any:
        return [(d.lettre, d.raison, "closed_need_payoff" in d.etiquettes) for _, d in decider_portes(a, u.attrs, u.sol.texte)] \
            + [bool(a.get("objection_clarification"))]
    return TacheModele("spin.gates", "fast", "spin_portes", _construire_portes,
                     lambda a, c, uid: _valider_obj_porte(a, u.sol.texte), cle)


# =============================================================================================== périmètre
def _construire_reouverture(ctx: ContexteAppel, u: Unite) -> str:
    i = ctx.n(u.tour.id)
    fenetre = ctx.tours[i: i + TOURS_FENETRE_REOUVERTURE]
    return (f"DÉBUT DE LA RÉOUVERTURE : {u.sol.id} (tour {u.tour.id}) : {u.sol.texte}\n"
            "Donne le premier tour SALES après le début où le commercial revient à l'offre (partie suivante de l'offre), "
            "annonce un prix, demande une décision ou change de sujet. JSON : {\"end_turn\": \"T177\"|null, "
            "\"quote\": \"mots exacts de ce tour\"}\n\nTRANSCRIPTION\n" + ctx.afficher(fenetre))


def tache_reouverture(u: Unite) -> TacheModele:
    def valider(a: dict, ctx: ContexteAppel, uid: str) -> list[str]:
        et = a.get("end_turn")
        if et is None:
            return []
        try:
            if ctx.n(et) <= ctx.n(u.tour.id):
                return ["end_before_start"]
        except KeyError:
            return ["unknown_turn"]
        e = citation_ok(ctx, Preuve(a.get("quote", ""), et, COMMERCIAL), mots_min=2, mots_max=40)
        return [e] if e else []
    return TacheModele("spin.reopen_end", "fast", "spin_reouverture", _construire_reouverture, valider,
                     cle=lambda a: a.get("end_turn"))


def fin_decouverte(ctx: ContexteAppel) -> Optional[str]:
    """SB-1 : premier début de présentation de l'offre ou premier prix, le premier des deux (annexe Présentation PB-1, PB-3)."""
    c = [x for x in (ctx.phases.debut_presentation, ctx.phases.premier_prix) if x]
    return min(c, key=ctx.n) if c else None


def est_debut_valide(d: DecisionLettre) -> bool:
    """SB-1 / SB-2 : le début porte sur la situation, les objectifs ou les problèmes du prospect ; les questions sociales,
    pratiques et de cadrage (porte 1 `nothing`), les questions sur l'offre et les charges ne sont jamais le début."""
    return d.lettre in LETTRES or (d.lettre == OUT and d.raison in ("agreement", "sales_list"))


def est_diagnostic(u: Unite) -> bool:
    """SB-3 : une nouvelle question de diagnostic sur la situation, les problèmes ou les objectifs. Pas : l'offre, la
    logistique (porte 1 `nothing`), le financement (SB-25 -> OUT solution_load), la clarification d'une résistance
    (compétence Objections)."""
    return bool(u.decision and u.decision.lettre in LETTRES and not (u.portes_ or {}).get("objection_clarification"))


def fin_de_reouverture(u: Unite) -> bool:
    """SB-3, fins d'une réouverture vues par le code : demande de décision, demande de validation, information sur l'offre,
    charge d'une solution, clarification d'une résistance."""
    d = u.decision
    if d is None:
        return False
    return d.lettre in AIGUILLAGE or (d.lettre == OUT and d.raison in ("offer_info", "solution_load")) or \
        bool((u.portes_ or {}).get("objection_clarification"))


# =============================================================================================== plages de réponse
def plages_reponse(ctx: ContexteAppel, unites: list[Unite], tours_sollicitation: set[str]) -> None:
    """SB-5 à SB-8. `unites` sont les unités codées dans l'ordre de la transcription (chacune avec `fin_fenetre`).

    SB-5 : la réponse est la parole du prospect après la sollicitation jusqu'à la sollicitation suivante du commercial ;
           une relance orale du commercial de 5 mots ou moins ne la clôt pas.
    SB-6 : sollicitations empilées : la réponse va à la dernière, sauf si le prospect reprend un mot clé d'une
           précédente et aucun de la dernière ; les autres sont `unanswered`.
    SB-7 : englobés : les tours consécutifs du prospect sans parole du commercial entre eux sont tous dans la plage.
    SB-8 : la parole du prospect après un acquiescement plus long du commercial et avant la sollicitation suivante est
           rattachée à la dernière sollicitation avec le signal `volunteered` (spontané).
    """
    tours_sol = {u.tour.id for u in unites} | tours_sollicitation     # tout tour du commercial qui porte une sollicitation
    par_tour: dict[str, list[Unite]] = {}
    for u in unites:
        par_tour.setdefault(u.tour.id, []).append(u)
    tours = [t for t in ctx.tours if not t.attribution_douteuse]
    pos = {t.id: i for i, t in enumerate(tours)}
    for tid, groupe in par_tour.items():
        groupe.sort(key=lambda x: x.rang)
        fin = groupe[-1].fin_fenetre
        reponse, spontane, accueil = [], [], False
        for t in tours[pos[tid] + 1:]:
            if fin and ctx.n(t.id) >= ctx.n(fin):
                break
            if t.role == COMMERCIAL:
                if t.id in tours_sol:
                    break
                if len(t.texte.split()) > MOTS_MAX_RELANCE_ORALE:
                    accueil = True                                                  # SB-8
                continue
            if t.role == PROSPECT:
                (spontane if accueil else reponse).append(t.id)
        cible = groupe[-1]
        if len(groupe) > 1 and reponse:                                           # SB-6 exception
            premier = mots_contenu(ctx.tour(reponse[0]).texte)
            if not (mots_contenu(cible.sol.texte) & premier):
                plus_tot = [g for g in groupe[:-1] if mots_contenu(g.sol.texte) & premier]
                if plus_tot:
                    cible = plus_tot[-1]
        for g in groupe:
            g.sans_reponse = g is not cible
            if g.sans_reponse and "unanswered" not in g.sol.etiquettes:
                g.sol.etiquettes.append("unanswered")
        cible.sol.tours_reponse = reponse
        cible.tours_spontanes = spontane
        cible.texte_reponse = " ".join(ctx.tour(x).texte for x in reponse + spontane)


# =============================================================================================== atomes
def _construire_atomes(ctx: ContexteAppel, u: Unite) -> str:
    rep = [ctx.tour(x) for x in u.sol.tours_reponse]
    spont = [ctx.tour(x) for x in u.tours_spontanes]
    return (f"UNITÉ : {u.sol.id} (lettre de la question : {u.sol.lettre} ; la lettre ne change jamais avec la réponse)\n"
            f"TOURS PRÉCÉDENTS DU PROSPECT (contexte seulement, jamais cités) :\n{_ctx_lines(u.prospect_prec)}\n"
            f"TOUR DU COMMERCIAL {u.tour.id} : {u.tour.texte}\nQUESTION : {u.sol.texte}\n"
            f"TOURS DE RÉPONSE :\n{_ctx_lines(rep, 4000) or '(aucun)'}\n"
            f"TOURS SPONTANÉS (après un acquiescement du commercial) :\n{_ctx_lines(spont, 4000) or '(aucun)'}\n"
            "Liste les atomes des tours de réponse et des tours spontanés. Citations tirées de ces tours PROSPECT "
            "seulement.")


def _valider_atomes(a: dict, ctx: ContexteAppel, u: Unite) -> list[str]:
    errs = []
    permis = set(u.sol.tours_reponse) | set(u.tours_spontanes)
    for k, x in enumerate(a.get("atoms") or []):
        if x.get("type") not in TYPES_ATOMES:
            errs.append(f"bad_type:{k}")
            continue
        if x.get("turn") not in permis:
            errs.append(f"turn_outside_answer:{k}")
            continue
        e = citation_ok(ctx, Preuve(x.get("quote", ""), x["turn"], PROSPECT), mots_min=2, mots_max=40)
        if e:
            errs.append(f"{e}:{k}")
        if x["type"] == "IMPACT" and (x.get("domain") not in DOMAINES or x.get("problem_domain") not in DOMAINES):
            errs.append(f"bad_domain:{k}")
        if x.get("cause_quote"):
            e = citation_ok(ctx, Preuve(x["cause_quote"], x.get("cause_turn") or x["turn"], PROSPECT), mots_min=2,
                         mots_max=40)
            if e or (x.get("cause_turn") or x["turn"]) not in permis:
                errs.append(f"bad_cause_quote:{k}")
    return errs


def tache_atomes(u: Unite) -> TacheModele:
    return TacheModele("spin.atoms", "strong", "spin_atomes", _construire_atomes, lambda a, c, uid: _valider_atomes(a, c, u),
                     cle=lambda a: sorted((x.get("type"), x.get("turn"),
                                           x.get("domain") if x.get("type") == "IMPACT" else None)
                                          for x in a.get("atoms") or []))


MOTS_NOMBRES = r"(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|" \
            r"sixty|hundred|thousand|million|dozen|" \
            r"deux|trois|quatre|cinq|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|soixante|" \
            r"cent|cents|mille|millions?|douzaines?|dizaines?|quinzaines?|vingtaines?|centaines?)"


def a_quantite(citation: str) -> bool:
    """SB-24 (remplace SB-15) : un montant, un compte ou une durée. Une fréquence seule (« every month », « tous les
    mois ») ou une quantité vague (« a lot », « beaucoup », « forever », « depuis toujours », X6) ne suffit pas.
    « un jour » (« un jour, je voudrais… ») n'est pas une durée."""
    q = (citation or "").lower()
    return bool(re.search(r"\d", q) or re.search(rf"\b{MOTS_NOMBRES}\b", q) or
                re.search(r"\b(a|one) (year|month|week|day|hour|client|half)s?\b", q) or
                re.search(r"\b(un|une) (an|ann[ée]e|mois|semaine|journ[ée]e|heure|client|cliente|[ée]l[èe]ve|demi)s?\b", q))


def lire_quantite(citation: str) -> tuple[Optional[float], Optional[str]]:
    # « 2 000 euros par mois » : espace des milliers à la française, unité accentuée ou « € »
    m = re.search(r"(\$?\d(?:[\d,.]|\s(?=\d{3}(?!\d)))*\s?(k|grand)?)\s*(a |per |an |par )?([a-zà-öø-ÿœ€]+)?",
                  (citation or "").lower())
    if not m:
        return None, None
    n = normaliser_nombre(re.sub(r"\s", "", m.group(1)))
    try:
        return (float(n) if n is not None else None), m.group(4)
    except ValueError:
        return None, m.group(4)


@dataclass
class DecisionAtome:
    garder: bool
    type: Optional[str]
    raison: str            # kept / prompted / approval_only / reported_speech / desire_after_pitch / ... (codes enregistrés)
    quantifie: bool = False


def decider_atome(brut: dict, *, apres_presentation: bool) -> DecisionAtome:
    """Règles de décision du code sur un atome du modèle (§4 et annexe A3, dans cet ordre)."""
    t = brut.get("type")
    citation = brut.get("quote", "")
    if len(normaliser(citation).strip(' .,?!"').split()) < 2:                           # SB-9 : 2 à 40 mots (B2, cas 12)
        return DecisionAtome(False, None, "below_two_words")
    if approbation_seule(citation):                                                    # C3, règle 5, X3
        return DecisionAtome(False, None, "approval_only")
    if brut.get("prompted_by_sales"):                                            # SB-14, X3 (gardé, signalé)
        return DecisionAtome(False, t, "prompted")
    if brut.get("reported_speech") and not brut.get("owned"):                     # SB-23
        return DecisionAtome(False, None, "reported_speech")
    if t == "IMPACT":
        if brut.get("figure_kind") == "present" and not brut.get("income_drop_attributed"):
            t = "SITUATION"                                                     # SB-11 : chiffre actuel, X4
        elif brut.get("domain") and brut.get("domain") == brut.get("problem_domain") and brut.get("domain") != "other":
            t = "PAIN"                                                          # SB-10 : même domaine, X4
    if t == "DESIRE" and apres_presentation:                                           # SB-12, X5
        return DecisionAtome(False, None, "desire_after_pitch")
    quantifie = bool(brut.get("quantified")) and a_quantite(citation)            # SB-24, X6
    if t == "IMPACT" and brut.get("income_drop_attributed"):                     # SB-22
        quantifie = a_quantite(citation)
    return DecisionAtome(True, t, "kept" if t == brut.get("type") else f"reclassified_{brut.get('type')}_to_{t}",
                        quantifie)


def _chevauche(a: Preuve, b: Preuve) -> bool:
    if a.tour != b.tour:
        return False
    x, y = normaliser(a.citation).strip(" .,"), normaliser(b.citation).strip(" .,")
    return x in y or y in x


def construire_atomes(ctx: ContexteAppel, u: Unite, atomes_bruts: list[dict], indice_debut: int,
                meta: dict[str, dict]) -> tuple[list[Atome], list[dict]]:
    """Change les atomes validés du modèle pour une réponse en `Atome` (décision du code), dédoublonnage SB-9."""
    apres_presentation = bool(ctx.phases.debut_presentation and ctx.n(u.tour.id) >= ctx.n(ctx.phases.debut_presentation))
    garde: list[Atome] = []
    journal: list[dict] = []
    for brut in atomes_bruts:
        d = decider_atome(brut, apres_presentation=apres_presentation)
        journal.append({"solicitation": u.sol.id, "turn": brut.get("turn"), "quote": brut.get("quote"),
                    "model_type": brut.get("type"), "decision": d.raison, "type": d.type})
        if d.type is None:
            continue
        ev = Preuve(brut["quote"], brut["turn"], PROSPECT)
        if d.garder and any(_chevauche(ev, k.preuve) and k.type == d.type for k in garde):   # SB-9 un seul passage
            continue
        val, unite = (None, None)
        if d.quantifie:
            mv = brut.get("value")
            if isinstance(mv, (int, float)) and any(normaliser_nombre(w) and float(normaliser_nombre(w)) == float(mv)
                                                    for w in re.findall(r"\$?[\w.,]+", brut["quote"].lower())):
                val, unite = float(mv), brut.get("unit")
            else:
                val, unite = lire_quantite(brut["quote"])
        a = Atome(f"A{indice_debut + len(garde) + 1:03d}", d.type, ev, u.sol.id, u.sol.lettre, brut.get("object"),
                 brut.get("domain"), d.quantifie, val, unite,
                 spontane=brut["turn"] in u.tours_spontanes, suggere_par_commercial=not d.garder)
        # données annexes que l'Atome ne porte pas : dimension de l'objectif (§6 D1) et cause énoncée par le prospect (§6 D2)
        meta[a.id] = {"dimension": brut.get("dimension"),
                      "cause": Preuve(brut["cause_quote"], brut.get("cause_turn") or brut["turn"], PROSPECT)
                      if brut.get("cause_quote") else None}
        garde.append(a)
    return garde, journal


# =============================================================================================== approfondissement
# relance en écho (SB-19), sur la question normalisée (minuscules, apostrophe droite, accents gardés)
ECHO = re.compile(r"^(and |et )?(tell me more|how so|what else|meaning|what do you mean|in what way|what way|like what|"
                  r"such as|a lot|why|how come|and then|then what|really|for example|go on|say more|"
                  r"dis[- ]m'en plus|dites[- ]m'en plus|raconte[- ]moi|racontez[- ]moi|c'est[- ][àa][- ]dire|comment [çc]a|"
                  r"quoi d'autre|qu'est[- ]ce que (tu veux|vous voulez) dire|de quelle (fa[çc]on|mani[èe]re)|"
                  r"dans quel sens|comme quoi|par exemple|genre|beaucoup|pourquoi|comment [çc]a se fait|et apr[èe]s|"
                  r"et ensuite|vraiment|ah bon|continue|continuez|vas[- ]y|allez[- ]y|d[ée]veloppe|d[ée]veloppez)\b.{0,25}\?*$")


def approfondit(reponse_prec: str, question: str, preambule: str = "") -> bool:
    """SB-17 : la question (avec son préambule dans le même tour, SEG-5) reprend un mot de contenu de 4 lettres ou plus
    ou un nombre de la réponse précédente. SB-19 : une sollicitation en écho ou anaphorique juste après la réponse compte
    comme un approfondissement."""
    if not reponse_prec:
        return False
    q = normaliser(question).strip()
    if ECHO.match(q):
        return True
    qw = [w for w in _replier(question).split() if w]
    if 0 < len(qw) <= 4 and all(w in _replier(reponse_prec).split() for w in qw):   # SB-19 écho des mots de la réponse
        return True
    return bool(mots_contenu(question + " " + preambule) & mots_contenu(reponse_prec))


# =============================================================================================== chaînes
@dataclass
class MaillonChaine:
    id_sol: str
    lettre: str
    raison: Optional[str]
    atomes: list[Atome]            # atomes non spontanés et notés de sa réponse
    suit_prec: bool
    sans_reponse: bool = False


def _construire_lien(ctx: ContexteAppel, unite: tuple) -> str:
    ouvrante, citations_chaine, cand, reponse_cand = unite
    return (f"CHAÎNE OUVERTE PAR {ouvrante.sol.id} : {ouvrante.sol.texte}\nCITATIONS DU PROBLÈME DANS LA CHAÎNE : "
            f"{citations_chaine}\n"
            f"QUESTION CANDIDATE {cand.sol.id} ({cand.tour.id}) : {cand.sol.texte}\nRÉPONSE CANDIDATE : {reponse_cand}\n"
            "La question candidate et sa réponse portent-elles sur le même objet de problème que la chaîne ?")


def tache_lien(cand: Unite, ctx: ContexteAppel) -> TacheModele:
    def valider(a: dict, c: ContexteAppel, uid: str) -> list[str]:
        if not isinstance(a.get("same_object"), bool):
            return ["missing_same_object"]
        if a["same_object"]:
            src = [cand.sol.texte, cand.preambule] + [ctx.tour(t).texte for t in cand.sol.tours_reponse]
            if not any(_preuve_ok(a.get("quote"), s) for s in src if s):
                return ["bad_quote"]
        return []
    return TacheModele("spin.link", "fast", "spin_lien", _construire_lien, valider, cle=lambda a: bool(a.get("same_object")))


def trouver_chaines(etapes: list[MaillonChaine], meme_objet: Callable[[MaillonChaine, list[MaillonChaine], MaillonChaine], bool]
                ) -> list[dict]:
    """Chaînes profondes de SB-18 / SB-20. `etapes` sont les sollicitations codées dans l'ordre ; `meme_objet(ouverture,
    chaine, candidate)` applique SB-16 (lien du modèle + vérification lexicale du code).

    Ouverture : un P dont la réponse (non spontanée) a un PAIN ou un BLOCKER. Puis, parmi les étapes suivantes :
    - OUT `nothing` (et les autres raisons de OUT, SB-20) et les unités empilées `unanswered` sont transparents ;
    - OUT `sales_list` ou `agreement` rompt la chaîne (SB-20) ;
    - un S/P/I/N codé sur un autre objet la rompt (SB-20) ;
    - un S sur le même objet ne rompt pas et n'est pas un maillon (SB-20) ; un P sur le même objet non plus ;
    - un I ou un N qui n'approfondit pas la réponse précédente la rompt (SB-17, SB-18 « chacun approfondi ») ;
    - premier maillon : un I avec un IMPACT ; profonde quand un I ou un N plus loin sur l'objet donne IMPACT, DESIRE ou VALUE.
    Rend chaque chaîne trouvée, une par objet (un P plus loin sur le même objet qu'une chaîne trouvée est sauté).
    """
    chaines: list[dict] = []
    utilise: set[str] = set()
    for i, op in enumerate(etapes):
        if op.lettre != "P" or op.id_sol in utilise or not any(a.type in ("PAIN", "BLOCKER") for a in op.atomes):
            continue
        chaine = [op]
        impact: Optional[MaillonChaine] = None
        profond: Optional[MaillonChaine] = None
        rupteur = None
        for st in etapes[i + 1:]:
            if st.sans_reponse:
                continue
            if st.lettre == OUT:
                if st.raison in ("sales_list", "agreement"):
                    rupteur = f"{st.id_sol}:OUT_{st.raison}"
                    break
                continue
            if st.lettre not in LETTRES:
                continue
            if not meme_objet(op, chaine, st):
                rupteur = f"{st.id_sol}:other_object"
                break
            chaine.append(st)
            if st.lettre in ("S", "P"):
                continue
            if not st.suit_prec:
                rupteur = f"{st.id_sol}:not_followed_up"
                break
            genres = {a.type for a in st.atomes}
            if impact is None:
                if st.lettre == "I" and "IMPACT" in genres:
                    impact = st
                continue
            if genres & {"IMPACT", "DESIRE", "VALUE"}:
                profond = st
                break
        utilise |= {s.id_sol for s in chaine}
        if profond:
            obj = next((a.objet for a in op.atomes if a.type in ("PAIN", "BLOCKER")), None)
            chaines.append({"opening": op.id_sol, "impact": impact.id_sol, "closing": profond.id_sol,
                           "links": [s.id_sol for s in chaine], "object": obj,
                           "evidence": [a.preuve for s in (op, impact, profond) for a in s.atomes
                                        if a.type in ({"PAIN", "BLOCKER"} if s is op else
                                                      {"IMPACT"} if s is impact else {"IMPACT", "DESIRE", "VALUE"})]})
        else:
            chaines.append({"opening": op.id_sol, "deep": False, "broken_at": rupteur,
                           "links": [s.id_sol for s in chaine]})
    chaines_profondes = [c for c in chaines if "closing" in c]
    for c in chaines_profondes:
        c["deep"] = True
    return chaines


def lien_lexical(unites_chaine: list[Unite], chaine: list[MaillonChaine], unite_cand: Unite, cand: MaillonChaine) -> bool:
    """SB-16 côté code : au moins un mot de contenu commun entre les citations (atomes ou questions) de la chaîne et celles
    de la candidate. Une question en écho qui approfondit (SB-19) porte son objet par anaphore."""
    texte_chaine = " ".join([u.sol.texte + " " + u.preambule for u in unites_chaine] +
                          [a.preuve.citation for s in chaine for a in s.atomes])
    texte_cand = " ".join([unite_cand.sol.texte, unite_cand.preambule] + [a.preuve.citation for a in cand.atomes])
    return bool(mots_contenu(texte_chaine) & mots_contenu(texte_cand)) or cand.suit_prec


def objets_distincts(chaines: list[dict]) -> list[dict]:
    """D5 niveau 2 : chaînes profondes sur des objets différents (libellés d'objet comparés après normalisation)."""
    sortie, vus = [], set()
    for c in chaines:
        if not c.get("deep"):
            continue
        k = normaliser(c.get("object") or c["opening"])
        if k in vus:
            continue
        vus.add(k)
        sortie.append(c)
    return sortie


# =============================================================================================== items
def _distincts(evs: list[Atome]) -> list[Atome]:
    sortie: list[Atome] = []
    for a in evs:
        if not any(_chevauche(a.preuve, b.preuve) for b in sortie):
            sortie.append(a)
    return sortie


def noter_items(atomes: list[Atome], chaines: list[dict], meta: Optional[dict[str, dict]] = None
                ) -> tuple[list[NoteItem], dict[str, list[Atome]]]:
    """§6. Les atomes suggérés par le commercial ne comptent jamais. Les atomes spontanés comptent pour D1 à D4 si
    COMPTER_SPONTANES (§11). `meta[atome.id]` peut porter "dimension" (lien à l'objectif, D1) et "cause" (Preuve de la
    cause, D2)."""
    meta = meta or {}
    dim = lambda a: (meta.get(a.id) or {}).get("dimension")          # noqa: E731
    cause = lambda a: (meta.get(a.id) or {}).get("cause")            # noqa: E731
    reserve = [a for a in atomes if not a.suggere_par_commercial and (COMPTER_SPONTANES or not a.spontane)]
    by = {t: _distincts([a for a in reserve if a.type == t]) for t in TYPES_ATOMES}
    utilise: dict[str, list[Atome]] = {}
    items: list[NoteItem] = []

    # D1 Point de départ : SITUATION liée à l'objectif (même dimension qu'un DESIRE) ; sans DESIRE -> toute SITUATION chiffrée
    dims_desir = {dim(a) for a in by["DESIRE"]} - {None, "other"}
    if by["DESIRE"]:
        lie = [a for a in by["SITUATION"] if dim(a) in dims_desir]
    else:
        lie = [a for a in by["SITUATION"] if a.quantifie]
    q = [a for a in lie if a.quantifie]
    lv, ev = (2, q[:2]) if len(q) >= 2 else ((1, (q or lie)[:1]) if lie else (0, []))
    utilise["D1"] = ev
    items.append(item("D1", POIDS["D1"], lv, [a.preuve for a in ev],
                      "related to the goal by dimension" if by["DESIRE"] else "no DESIRE: quantified SITUATION"))

    # D2 Problème : PAIN / BLOCKER distincts ; niveau 2 = deux distincts, ou un avec sa cause énoncée par le prospect
    pb = _distincts(by["PAIN"] + by["BLOCKER"])
    cause_par = [a for a in pb if cause(a) and not _chevauche(cause(a), a.preuve)]
    if len(pb) >= 2:
        lv, ev, evd, remarque = 2, pb[:2], [a.preuve for a in pb[:2]], "two distinct PAIN/BLOCKER"
    elif cause_par:
        lv, ev, evd, remarque = 2, cause_par[:1], [cause_par[0].preuve, cause(cause_par[0])], "one PAIN/BLOCKER with its cause"
    elif pb:
        lv, ev, evd, remarque = 1, pb[:1], [pb[0].preuve], ""
    else:
        lv, ev, evd, remarque = 0, [], [], ""
    utilise["D2"] = ev
    items.append(item("D2", POIDS["D2"], lv, evd, remarque))

    # D3 Implication : IMPACT ; niveau 2 = deux dans des domaines distincts, au moins un chiffré
    imp = by["IMPACT"]
    lv, ev = (0, [])
    if imp:
        lv, ev = 1, [next((a for a in imp if a.quantifie), imp[0])]
        for a in imp:
            for b in imp:
                if a is not b and a.domaine != b.domaine and (a.quantifie or b.quantifie):
                    lv, ev = 2, [a, b]
                    break
            if lv == 2:
                break
    utilise["D3"] = ev
    items.append(item("D3", POIDS["D3"], lv, [a.preuve for a in ev]))

    # D4 Bénéfice attendu : DESIRE -> 1 ; DESIRE et VALUE -> 2
    if by["DESIRE"] and by["VALUE"]:
        lv, ev = 2, [by["DESIRE"][0], by["VALUE"][0]]
    elif by["DESIRE"]:
        lv, ev = 1, [by["DESIRE"][0]]
    else:
        lv, ev = 0, []
    remarque = "VALUE without DESIRE gives level 0 (table §6)" if by["VALUE"] and not by["DESIRE"] else ""
    utilise["D4"] = ev
    items.append(item("D4", POIDS["D4"], lv, [a.preuve for a in ev], remarque))

    # D5 Profondeur : chaînes profondes (jamais d'atomes spontanés, SB-8, X7) ; le niveau 2 demande les citations des deux chaînes
    profond = objets_distincts(chaines)
    lv = 2 if len(profond) >= 2 else 1 if profond else 0
    evd = [e for c in profond[:2] for e in c["evidence"]]
    if lv == 2 and not (profond[0]["evidence"] and profond[1]["evidence"]):
        lv = 1
    items.append(item("D5", POIDS["D5"], lv, evd, f"{len(profond)} deep chain(s) on distinct objects"))
    return items, utilise


# =============================================================================================== diagnostics
def diagnostics(unites: list[Unite], atomes: list[Atome]) -> dict:
    """§8 diagnostics pour l'accompagnement du commercial. Affichés, jamais notés : la lettre ne rapporte jamais de points."""
    codees = [u for u in unites if u.dans_perimetre and u.decision and est_lettre_codee(u.decision.lettre)
             and u.sol.statut != "to_review"]
    spin = [u for u in codees if u.decision.lettre in LETTRES]
    comptes = {L: sum(u.decision.lettre == L for u in spin) for L in LETTRES}
    n_spin = sum(comptes.values())
    raisons_hors: dict[str, int] = {}
    for u in codees:
        if u.decision.lettre == OUT:
            raisons_hors[u.decision.raison] = raisons_hors.get(u.decision.raison, 0) + 1
    ps = [i for i, u in enumerate(spin) if u.decision.lettre == "P"]
    p_puis_i = sum(1 for i in ps if i + 1 < len(spin) and spin[i + 1].decision.lettre == "I")
    par_sol: dict[str, set[str]] = {}
    for a in atomes:
        if not a.suggere_par_commercial and not a.spontane:
            par_sol.setdefault(a.id_sollicitation, set()).add(a.type)
    rendement = {L: (round(sum(bool(par_sol.get(u.sol.id, set()) & ATOMES_ATTENDUS[L]) for u in spin
                            if u.decision.lettre == L) / comptes[L], 3) if comptes[L] else None) for L in LETTRES}
    repondu = [u for u in codees if not u.sans_reponse and u.sol.tours_reponse]
    budget = {L: {"count": comptes[L], genre: lim, "ok": comptes[L] <= lim if genre == "ceiling" else comptes[L] >= lim}
              for L, (genre, lim) in BUDGET_APPEL.items()}
    return {
        "note": "Letter layer: coaching only. The letter never produces points.",
        "letters": comptes,
        "letter_shares": {L: round(comptes[L] / n_spin, 3) if n_spin else None for L in LETTRES},
        "i_share": round(comptes["I"] / n_spin, 3) if n_spin else None,
        "out_reasons": raisons_hors,
        "call_budget": budget,
        "p_followed_by_i": round(p_puis_i / len(ps), 3) if ps else None,
        "prompted_share": round(raisons_hors.get("agreement", 0) / len(codees), 3) if codees else None,
        "closed_need_payoff": sum("closed_need_payoff" in u.sol.etiquettes for u in codees),
        "yield_per_letter": rendement,
        "follow_up_rate": round(sum(u.sol.approfondi for u in repondu) / len(repondu), 3) if repondu else None,
        "targets": CIBLES_DIAG,
    }


def applicabilite(unites: list[Unite], debut_decouverte: Optional[str]) -> tuple[str, list[str], dict]:
    """§5. Rend (statut, raisons, santé)."""
    perim = [u for u in unites if u.dans_perimetre and u.decision]
    codees = [u for u in perim if est_lettre_codee(u.decision.lettre) and u.sol.statut != "to_review"]
    absent = sum(u.decision.lettre == OUT and u.decision.raison == "absent" for u in codees)
    sante = {"absent_share": round(absent / len(codees), 3) if codees else 0.0,
              "to_review": sum(u.sol.statut == "to_review" for u in perim), "coded": len(codees)}
    if debut_decouverte is None:
        return "not_applicable", ["no_discovery"], sante
    if len(codees) < MIN_CODEES:
        return "not_applicable", [f"fewer_than_{MIN_CODEES}_coded_solicitations"], sante
    if sante["absent_share"] > PART_MAX_ABSENTS:
        return "excluded", ["health_absent_share"], sante
    return "scored", [], sante


# =============================================================================================== orchestration
def placer_perimetre(ctx: ContexteAppel, unites: list[Unite], resoudre: Callable[[Unite], None],
                    fin_reouverture: Callable[[Unite], Optional[str]]) -> dict:
    """SB-1, SB-2, SB-25, SB-34 (SB-3 / SB-4 éteintes). `resoudre(u)` fait passer les portes à une unité (remplit
    u.portes_ / u.decision / le statut)."""
    fin = fin_decouverte(ctx)
    ctx.phases.fin_decouverte = fin
    pre = [u for u in unites if fin is None or ctx.n(u.tour.id) < ctx.n(fin)]
    poster = [u for u in unites if u not in pre]
    debut: Optional[Unite] = None
    for u in pre:
        if u.attrs["backchannel"] or u.attrs["system"]:           # SEG-7 : jamais une sollicitation (code)
            u.sol.etiquettes.append("not_coded")
            continue
        u.fin_fenetre = fin
        resoudre(u)
        if debut is None and u.decision and est_debut_valide(u.decision):   # SB-1, SB-2
            debut = u
        if debut is not None:
            u.dans_perimetre = True
        else:
            u.sol.etiquettes.append("pre_perimeter")
    ctx.phases.debut_decouverte = debut.tour.id if debut else None
    # SB-34 : après le premier début de présentation ou le premier prix, plus rien n'est SPIN : ni lu, ni codé, sans registre
    reouvertures: list[dict] = []
    if not REOUVERTURES:
        for u in poster:
            u.attrs["post_end"] = True
            u.sol.etiquettes.append("post_discovery")
        return {"start": ctx.phases.debut_decouverte, "end": fin, "reopenings": reouvertures}
    # SB-3 réouvertures après la fin (remplacées par SB-34, gardées éteintes)
    if fin is not None and debut is not None:
        for u in poster:
            u.attrs["post_end"] = True
        i = 0
        cand = [u for u in poster if not (u.attrs["backchannel"] or u.attrs["system"])]
        while i < len(cand):
            u = cand[i]
            resoudre(u)
            if not est_diagnostic(u):
                u.sol.etiquettes.append("post_discovery")
                i += 1
                continue
            fin_modele = fin_reouverture(u)
            executer = [u]
            j = i + 1
            while j < len(cand):
                v = cand[j]
                if fin_modele and ctx.n(v.tour.id) >= ctx.n(fin_modele):
                    break
                resoudre(v)
                if fin_de_reouverture(v):
                    break
                executer.append(v)
                j += 1
            arret = cand[j].tour.id if j < len(cand) else fin_modele
            if fin_modele and arret and ctx.n(fin_modele) < ctx.n(arret):
                arret = fin_modele
            n_diag = sum(est_diagnostic(v) for v in executer)
            dans_presentation = bool(ctx.phases.debut_presentation and ctx.n(u.tour.id) >= ctx.n(ctx.phases.debut_presentation) and
                            (ctx.phases.fin_presentation is None or ctx.n(u.tour.id) < ctx.n(ctx.phases.fin_presentation)))
            if dans_presentation and n_diag < MIN_DIAGNOSTICS_POINT_PRESENTATION:              # SB-4
                for v in executer:
                    v.sol.etiquettes.append("pitch_check_in" if v is u else "post_discovery")
            else:
                k = len(reouvertures)
                for v in executer:
                    v.dans_perimetre, v.reouverture, v.fin_fenetre = True, k, arret
                    v.sol.etiquettes.append(f"reopening_{k}")
                reouvertures.append({"start": u.tour.id, "end": arret, "solicitations": [v.sol.id for v in executer]})
            i = j
    return {"start": ctx.phases.debut_decouverte, "end": fin, "reopenings": reouvertures}


def appliquer_decision(u: Unite, d: DecisionLettre) -> None:
    u.decision = d
    u.sol.lettre, u.sol.raison_hors = d.lettre, d.raison
    u.sol.etiquettes = sorted(set(u.sol.etiquettes) | set(d.etiquettes) | ({"invalid_proof"} if d.preuve_invalide else set()))


def deplier_coupes(unites: list[Unite]) -> list[Unite]:
    """SEG-2 : une sollicitation que le modèle a coupée en interrogatives coordonnées devient plusieurs unités
    (identifiants Q007.1a, Q007.1b…), chacune avec sa lettre ; ce sont des unités empilées pour SB-6."""
    sortie: list[Unite] = []
    for u in unites:
        if len(u.parties) < 2:
            sortie.append(u)
            continue
        for j, (txt, d) in enumerate(u.parties):
            v = Unite(Sollicitation(f"{u.sol.id}{'abcdef'[j]}", u.tour.id, txt, etiquettes=sorted(set(u.sol.etiquettes) | {"stacked"}),
                                  statut=u.sol.statut), u.tour, u.rang, u.total_dans_tour, u.preambule, u.prospect_prec,
                     dict(u.attrs, stacked=True), u.portes_, None, u.fin_fenetre, u.dans_perimetre, u.reouverture)
            appliquer_decision(v, d)
            sortie.append(v)
    return sortie


# =============================================================================================== registres
def registres_lexique(texte: str) -> set[str]:
    """SB-30 : les registres dont des mots du domaine paraissent dans un texte (en début de mot, sans tenir compte de la
    casse ni des accents ; un début de mot peut suivre une élision : « l'argent », « d'heures »)."""
    t = " " + re.sub(r"[^a-z0-9$' -]+", " ", _replier(texte)) + " "
    touches = set()
    for reg, mots in LEXIQUE_REGISTRE.items():
        if any(re.search(r"[ $']" + re.escape(w), t) for w in mots):
            touches.add(reg)
    if re.search(r"\$ ?\d|\d+ ?(k|balles)\b", t):
        touches.add("financial")
    return touches


def decider_registre(a: Optional[dict]) -> Optional[str]:
    """SB-26 : le code ramène le domaine demandé donné par le modèle à son registre (other / none -> Other)."""
    if not a:
        return None
    return REGISTRE_DU_DOMAINE.get(a.get("asked_domain"))


def _tours_reponse(ctx: ContexteAppel, u: Unite) -> list:
    """SB-35 : la réponse du prospect à la question (plage de réponse de SB-6), ses premiers tours."""
    return [t for t in (ctx.tour(i) for i in (u.sol.tours_reponse or [])[:TOURS_REPONSE_REGISTRE]) if t is not None]


def _construire_registre(ctx: ContexteAppel, u: Unite) -> str:
    prec = u.prospect_prec[-TOURS_REFERENCE_REGISTRE:]
    rep = _tours_reponse(ctx, u)
    return (f"UNITÉ : {u.sol.id}  (tour {u.tour.id}, une question {u.decision.lettre if u.decision else '?'} de la découverte)\n"
            f"DERNIERS TOURS DU PROSPECT AVANT ELLE :\n{_ctx_lines(prec) or '(aucun)'}\n"
            f"PRÉAMBULE DU COMMERCIAL DANS LE MÊME TOUR : {u.preambule or '(aucun)'}\n"
            f"SOLLICITATION : {u.sol.texte}\n"
            f"RÉPONSE DU PROSPECT À CETTE QUESTION :\n{chr(10).join(f'[{t.id} {t.ts}] {t.role}: {t.texte[:800]}' for t in rep) or '(pas de réponse)'}\n"
            "De quel domaine cette question fait-elle parler le prospect ? Les citations sont des sous-chaînes exactes.")


def _valider_registre(a: dict, ctx: ContexteAppel, u: Unite) -> list[str]:
    """SB-32, règles 1 à 3 : valeurs fermées, une citation exacte au bon endroit, l'ordre des règles de SB-35, pas de
    conflit avec les mots du domaine."""
    if not isinstance(a, dict):
        return ["not_an_object"]
    dom, base_ = a.get("asked_domain"), a.get("basis")
    if dom not in REGISTRE_DU_DOMAINE:
        return ["bad_domain"]
    if base_ not in BASES_REGISTRE:
        return ["bad_basis"]
    repondu = bool(_tours_reponse(ctx, u))
    if base_ == "none":
        if repondu:
            return ["none_with_answer"]                       # SB-35 : une question ouverte qui a une réponse se lit dans sa réponse
        return [] if dom in ("none", "other") else ["none_basis_with_domain"]
    if dom == "none":
        return ["domain_without_basis"]
    q = a.get("quote")
    if base_ == "named":
        if dom == "other":
            return ["named_other"]                            # SB-35 : un sujet hors des sept domaines est une question ouverte
        ou = (u.preambule + " " + u.sol.texte) if u.preambule else u.sol.texte
        if not _preuve_ok(q, ou):
            return ["bad_quote:named"]
        lex = registres_lexique(u.sol.texte)
        if len(lex) == 1 and REGISTRE_DU_DOMAINE[dom] not in lex:
            return ["lexicon_conflict"]
        return []
    rt = a.get("reference_turn")
    if base_ == "answer":
        # SB-35 : l'effet de la question, dans les mots du prospect dans sa réponse
        if not repondu:
            return ["no_answer"]
        if rt not in {t.id for t in _tours_reponse(ctx, u)}:
            return ["bad_answer_turn"]
        e = citation_ok(ctx, Preuve(q or "", rt, PROSPECT), mots_min=1, mots_max=40)
        return [f"bad_quote:{e}"] if e else []
    # référence : seulement pour une question ouverte sans réponse ; les mots qu'elle désigne, dans les derniers tours du prospect (SB-29)
    if repondu:
        return ["reference_with_answer"]
    if rt not in {t.id for t in u.prospect_prec[-TOURS_REFERENCE_REGISTRE:]}:
        return ["bad_reference_turn"]
    e = citation_ok(ctx, Preuve(q or "", rt, PROSPECT), mots_min=1, mots_max=40)
    return [f"bad_quote:{e}"] if e else []


def tache_registre(u: Unite) -> TacheModele:
    """Une tâche fermée par question codée de la découverte ; la clé comparée d'une passe à l'autre est le registre."""
    return TacheModele("spin.register", "fast", "spin_registre", _construire_registre,
                     lambda a, c, uid: _valider_registre(a, c, u), cle=lambda a: decider_registre(a))


def resume_registres(unites: list["Unite"], decide: dict[str, dict]) -> dict:
    """SB-33 : comptes par registre, et seuil d'accord par appel (part des registres décidés à 3/3)."""
    n = len(decide)
    verifie_ = sum(1 for d in decide.values() if d["status"] == "verified")
    revue = sum(1 for d in decide.values() if d["status"] == "to_review")
    comptes = {r: sum(1 for d in decide.values() if d["register"] == r) for r in REGISTRES}
    accord = round(verifie_ / n, 3) if n else None
    signaux = ["register_agreement_low"] if n and accord < ACCORD_MIN_REGISTRE else []
    return {"counts": comptes, "questions": n, "verified": verifie_, "to_review": revue,
            "agreement": accord, "threshold": ACCORD_MIN_REGISTRE, "flags": signaux,
            "labels": LIBELLES_REGISTRE}


class CompetenceSpin:
    nom_ = "SPIN"
    version_regles = "SPIN-1.3"

    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence:
        res = ResultatCompetence(self.nom_, self.version_regles)
        unites = inventaire(ctx)
        statuts_: list[str] = []
        concord: list[str] = []

        def resoudre(u: Unite) -> None:
            """S3 + S4 + S5 pour une unité : trois passes, validation, arbitrage, puis la lettre décidée par le code."""
            if u.portes_ is not None or u.sol.statut in ("to_review", "verified", "arbitrated"):
                return
            r = executeur.executer(ctx, tache_porte(u), f"gates:{u.sol.id}", u)
            u.sol.statut = r.statut
            statuts_.append(r.statut)
            concord.append(r.concordance)
            if r.reponse is None:                                    # C3 règle 7 / C4 : écartée des notes
                u.sol.etiquettes.append("to_review")
                return
            u.portes_ = r.reponse
            u.parties = decider_portes(r.reponse, u.attrs, u.sol.texte)
            # pour le périmètre, une unité coupée est représentée par sa première partie S/P/I/N (sinon sa première partie)
            appliquer_decision(u, next((d for _, d in u.parties if d.lettre in LETTRES), u.parties[0][1]))

        def fin_reouverture(u: Unite) -> Optional[str]:
            r = executeur.executer(ctx, tache_reouverture(u), f"reopen:{u.sol.id}", u)
            return (r.reponse or {}).get("end_turn")

        perimetre = placer_perimetre(ctx, unites, resoudre, fin_reouverture)
        unites = deplier_coupes(unites)
        for v in unites:
            if not v.dans_perimetre:          # inventoriée, non codée : la lettre ne s'écrit que dans le périmètre
                v.sol.lettre = v.sol.raison_hors = None
                if "not_coded" not in v.sol.etiquettes:
                    v.sol.etiquettes.append("not_coded")
        for k, v in enumerate(unites):
            v.rang = k                                              # ordre de la transcription, utilisé par SB-6
        codees = [u for u in unites if u.dans_perimetre and u.decision and est_lettre_codee(u.decision.lettre)]
        plages_reponse(ctx, codees, {u.tour.id for u in unites if not u.attrs["backchannel"]})

        # atomes : extraction par le modèle, puis décisions du code (SB-9 à SB-15, SB-22 à SB-24)
        atomes: list[Atome] = []
        meta: dict[str, dict] = {}
        journal_atomes: list[dict] = []
        for u in codees:
            if u.sans_reponse or not (u.sol.tours_reponse or u.tours_spontanes):
                continue
            r = executeur.executer(ctx, tache_atomes(u), f"atoms:{u.sol.id}", u)
            statuts_.append(r.statut)
            concord.append(r.concordance)
            if r.reponse is None:
                u.sol.etiquettes.append("atoms_to_review")
                continue
            nouveau, journal = construire_atomes(ctx, u, r.reponse.get("atoms") or [], len(atomes), meta)
            atomes += nouveau
            journal_atomes += journal
        # SB-21 : une question de plan d'action n'est N que si sa réponse énonce un état futur ou sa valeur
        for u in codees:
            if u.decision.lettre == "N" and ((u.portes_ or {}).get("g3") or {}).get("action_plan"):
                genres = {a.type for a in atomes if a.id_sollicitation == u.sol.id and not a.suggere_par_commercial}
                if not genres & {"DESIRE", "VALUE"}:
                    appliquer_decision(u, DecisionLettre(OUT, 1, "solution_load", u.decision.etiquettes + ["sb21_action_plan"]))
                    for a in atomes:
                        if a.id_sollicitation == u.sol.id:
                            a.lettre = OUT
        ctx.atomes = atomes

        # approfondissement (SB-17 / SB-19) entre sollicitations codées consécutives qui ont une réponse
        repondu = [u for u in codees if not u.sans_reponse]
        for prec, suiv in zip(repondu, repondu[1:]):
            suiv.suit_prec = approfondit(prec.texte_reponse, suiv.sol.texte, suiv.preambule)
            prec.sol.approfondi = suiv.suit_prec

        # chaînes : lien du modèle + vérification lexicale du code (SB-16), puis SB-18 / SB-20 par le code
        par_id = {u.sol.id: u for u in codees}
        etapes = [MaillonChaine(u.sol.id, u.decision.lettre, u.decision.raison,
                           [a for a in atomes if a.id_sollicitation == u.sol.id and not a.suggere_par_commercial
                            and not a.spontane], u.suit_prec, u.sans_reponse)
                 for u in codees if u.sol.statut != "to_review"]

        def meme_objet(op: MaillonChaine, chaine: list[MaillonChaine], cand: MaillonChaine) -> bool:
            cu = par_id[cand.id_sol]
            r = executeur.executer(ctx, tache_lien(cu, ctx), f"link:{op.id_sol}>{cand.id_sol}",
                           (par_id[op.id_sol], [a.preuve.citation for s in chaine for a in s.atomes], cu,
                            cu.texte_reponse[:1500]))
            statuts_.append(r.statut)
            modele = bool(r.reponse and r.reponse.get("same_object"))
            return modele and lien_lexical([par_id[s.id_sol] for s in chaine], chaine, cu, cand)

        chaines = trouver_chaines(etapes, meme_objet)

        # registres (SB-26 à SB-33) : questions codées avant la présentation seulement (ni réouvertures, ni OUT, ni après la présentation)
        reg_decides: dict[str, dict] = {}
        for u in codees:
            if u.reouverture is not None or u.sol.statut == "to_review" or not u.decision or u.decision.lettre not in LETTRES:
                continue
            r = executeur.executer(ctx, tache_registre(u), f"register:{u.sol.id}", u)
            statuts_.append(r.statut)
            reg = decider_registre(r.reponse) if r.reponse is not None else None
            reg_decides[u.sol.id] = {"register": reg, "status": r.statut, "concordance": r.concordance,
                                     "domain": (r.reponse or {}).get("asked_domain"), "basis": (r.reponse or {}).get("basis"),
                                     "quote": (r.reponse or {}).get("quote"), "reference_turn": (r.reponse or {}).get("reference_turn")}

        # état partagé (CONTRAT) et résultat
        ctx.sollicitations = [u.sol for u in unites]
        statut, raisons, sante = applicabilite(unites, ctx.phases.debut_decouverte)
        res.statut, res.raisons = statut, raisons
        if "to_review" in statuts_:
            res.signaux.append("units_to_review")
        res.concordance = (min(concord, key=lambda c: int(c.split("/")[0]) / max(1, int(c.split("/")[1])))
                           if concord else None)
        diag = diagnostics(unites, atomes)
        resume_reg = resume_registres(unites, reg_decides)
        res.signaux += resume_reg["flags"]
        res.signaux += [f"budget_{L}" for L, b in diag["call_budget"].items() if not b["ok"]]
        items, _ = noter_items(atomes, chaines, meta)
        if statut == "scored":
            res.items = items
            res.note = note_appel(items)
        res.details = {
            "perimeter": perimetre,
            "items_evidence": self._details_preuves(ctx, items, atomes) if statut == "scored" else {},
            "chains": [{k: v for k, v in c.items() if k != "evidence"} for c in chaines],
            "diagnostics": diag,
            "health": sante,
            "unit_status": {s: statuts_.count(s) for s in sorted(set(statuts_))},
            "atom_decisions": journal_atomes,
            "solicitations": [{"id": u.sol.id, "turn": u.tour.id, "ts": u.tour.ts, "letter": u.sol.lettre,
                               "gate_letter": u.decision.lettre if u.decision else None,
                               "out_reason": u.sol.raison_hors, "gate": u.decision.porte if u.decision else None,
                               "tags": u.sol.etiquettes, "in_perimeter": u.dans_perimetre, "status": u.sol.statut,
                               "answer_turns": u.sol.tours_reponse, "followed_up": u.sol.approfondi,
                               "register": (reg_decides.get(u.sol.id) or {}).get("register"),
                               "register_status": (reg_decides.get(u.sol.id) or {}).get("status"),
                               "register_basis": (reg_decides.get(u.sol.id) or {}).get("basis"),
                               "register_domain": (reg_decides.get(u.sol.id) or {}).get("domain"),
                               "register_quote": (reg_decides.get(u.sol.id) or {}).get("quote"),
                               "register_reference_turn": (reg_decides.get(u.sol.id) or {}).get("reference_turn")}
                              for u in unites],
            "registers": resume_reg,
        }
        return res

    @staticmethod
    def _details_preuves(ctx: ContexteAppel, items: list[NoteItem], atomes: list[Atome]) -> dict:
        """§10 contrat de sortie : chaque preuve avec tour, minutage, locuteur, citation, atome, domaine, identifiant et lettre
        de la question."""
        sortie = {}
        for it in items:
            lignes_ = []
            for e in it.preuve:
                a = next((x for x in atomes if x.preuve.tour == e.tour and x.preuve.citation == e.citation), None)
                lignes_.append({"turn": e.tour, "ts": ctx.tour(e.tour).ts, "speaker": PROSPECT, "quote": e.citation,
                             "atom": a.type if a else "CAUSE", "domain": a.domaine if a else None,
                             "question_id": a.id_sollicitation if a else None,
                             "question_letter": a.lettre if a else None})
            sortie[it.id] = {"level": it.niveau, "evidence": lignes_, "note": it.remarque}
        return sortie

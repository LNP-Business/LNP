"""Compétence 2 · Formalisation de l'écart (méthodologie v1.3, version des règles GAP-1.3).

Le modèle extrait et cite ; le code décide et note (partie C, C2).

Déroulé de ce module
  1. Les énoncés du prospect (A, B, PROBLEM, COST) sont lus dans les atomes SPIN (citations exactes du prospect) (§3).
  2. Formule de l'écart : A / B / P choisis (GB-28..GB-30), blocages de la feuille de route (GB-32), alerte du Copilote
     (GB-33). Le choix est fait par le code à partir des atomes, avant de lire la restitution ; le modèle ne répond qu'à
     de petites questions fermées (état actuel d'un chiffre, question de blocage, horizon de B).
  3. Inventaire des restitutions par le code (signaux S1/S2/S3, fenêtre A2, plage GB-1/GB-2), puis une tâche du modèle
     par candidat (propositions, tour source, expression clé). Le code classe chaque proposition : mot pour mot,
     paraphrasée ou sans trace (GB-3, GB-22 avec noyau.texte.expression_cle_ok, GB-23, GB-24, X4..X6, X10..X12), et
     décide si le candidat est une restitution (GB-4).
  4. Une tâche du modèle par restitution pour la validation (GB-8..GB-10, GB-15..GB-17, GB-26), décidée par le code ;
     corrections (GB-25, X9).
  5. Porte d'absence (§5.1) avec ses raisons ordonnées (GB-20), items G1..G6 (§5.2) avec la conformité à la formule
     (GB-31) pour G5, règle des deux citations (C3, règle 4), diagnostics (§7), contrat de sortie (§9) et l'état partagé
     lu par la présentation de l'offre.

Chaque valeur marquée « à valider » dans la méthodologie est une constante du module, ci-dessous.

Les appels de LNP sont en français : les listes de mots et de tournures ci-dessous gardent les formes anglaises (les
transcriptions de référence des tests sont en anglais) et ajoutent leurs équivalents français courants, à l'oral, en
tutoiement et en vouvoiement, avec et sans accents. Elles s'appliquent au texte passé par `normaliser` (minuscules,
espaces réduits, apostrophe typographique ramenée à l'apostrophe droite ; les accents restent).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..noyau.modeles import (vers_dict, ContexteAppel, ResultatCompetence, Preuve, NoteItem, AUTRE, PROSPECT, COMMERCIAL, Atome,
                           Sollicitation, Tour)
from ..noyau.executeur import TacheModele, Executeur
from ..noyau.notation import note_appel, item
from ..noyau.texte import (GENERIQUES, MOTS_VIDES, _contient, approbation_seule, canon, jetons_propres, expression_cle_ok, normaliser,
                         normaliser_nombre, citation_ok, phrases)

NOM = "GAP"
VERSION_REGLES = "GAP-1.3"

# ------------------------------------------------------------------------------------------- constantes
POIDS = {"G1": 10, "G2": 10, "G3": 10, "G4": 20, "G5": 25, "G6": 25}   # §5.2, propositions « à valider »
ETAPES_FEUILLE_ROUTE = 3                      # GB-33 : feuille de route en 3 étapes (en général : nombre d'étapes)
FEUILLE_ROUTE_COMPTE_P_CHOISI = True       # GB-32 : le P choisi entre dans le compte (« à confirmer »)
S1_PREMIERS_MOTS = 20                    # A1 S1 : ouverture dans les 20 premiers mots
S2_MIN_MOTS = 25                      # A1 S2 : passage dense à la deuxième personne, de 25 mots ou plus
S2_MIN_PROPOSITIONS = 2                     # A1 S2 : au moins deux propositions dont le prospect est le sujet
MOTS_MAX_TOUR_COURT = 5               # GB-1 : une approbation courte ou une relance d'écoute ne ferme pas la plage
MOTS_MIN_VALIDATION = 6               # GB-1, GB-2, GB-8
MOTS_EXPRESSION_CLE_LONGUE = 3          # G5 niveau 2 : une expression clé de 3 mots ou plus, ou un chiffre du prospect
MOTS_MAX_CITATION = 40                   # C3, règle 1
# GB-20 donne `restitution_after_pitch` « quand une restitution qui passe n'existe qu'après la présentation », alors
# que le cas B3.7 de l'annexe B (appel 018) donne `restitution_after_pitch` pour une restitution après la présentation
# sans COST. Avec False (lecture de B3.7), toute restitution après la présentation donne `restitution_after_pitch`
# quand il n'y a aucune restitution avant la présentation ; quand il y en a, il faut encore une restitution *qui passe*
# après la présentation (exemple de GB-20). À valider.
RAISON_APRES_PRESENTATION_EXIGE_PASSAGE = False
# Diagnostics A2 après la fin de la fenêtre : jusqu'où va l'inventaire, et quels signaux il garde (maîtrise du coût,
# à valider). "first_price" : arrêt au premier prix ou à la demande de décision ; "S1_S3" : après le début de la
# présentation, seuls les passages avec une ouverture ou une demande de validation sont candidats.
LIMITE_FENETRE_APRES = "first_price"
SIGNAUX_FENETRE_APRES = "S1_S3"
# Un B sans horizon ne peut pas atteindre le niveau 2 sur G2 (§10, proposition actuelle).
G2_EXIGE_HORIZON = True
# GB-19 : points de contact antérieurs dont le texte est fait des propres mots du prospect (ctx.prior_inputs[k]["kind"]).
TYPES_SOURCES_ANTERIEURES = {"form", "earlier_call"}

COMPOSANTES = ("PROBLEM", "COST", "A", "B")
ISSUES = ("confirmed_with_content", "confirmed", "corrected", "rejected", "none")
VALIDE = {"confirmed_with_content", "confirmed"}
DOMAINES_COUT = {"money", "time", "clients", "family", "health", "self-belief", "self_belief", "future",
                "opportunity", "lost opportunity"}
# Types d'atomes qui peuvent être l'énoncé de chaque composante (§2, correspondance de la référence mot pour mot v2).
TYPES_COMPOSANTES = {"PROBLEM": {"PAIN", "BLOCKER"}, "COST": {"IMPACT"}, "A": {"SITUATION", "IMPACT"}, "B": {"DESIRE"}}
PRIORITE_RAISONS = ["no_restitution", "restitution_after_pitch", "problem_missing", "cost_missing", "not_validated"]

# A1 S1 : ouvertures (exemples de l'annexe et leurs variantes grammaticales évidentes), cherchées dans les 20 premiers mots
OUVERTURES = re.compile(
    r"\b(so from what i'?m hearing|from what i'?ve (been )?hear(d|ing)|let me play (that|this|it) back|"
    r"play back what i'?(m|ve) (been )?hear(d|ing)|if i understood (you )?correctly|correct me if i'?m wrong|"
    r"just to recap|so to recap|to recap|what i'?m hearing is|let me make sure i (got|get|understand)|"
    r"so basically where you'?re at is|so to summari[sz]e|to summari[sz]e|"
    r"relay what i'?ve been hearing|reflect back|"
    # français : « si je résume », « si j'ai bien compris », « corrige-moi si je me trompe », « ce que j'entends »…
    r"si je r[ée]sume|pour r[ée]sumer|en r[ée]sum[ée]|si je r[ée]capitule|pour r[ée]capituler|si je reformule|"
    r"je reformule|(?:laisse|laissez)-moi (?:reformuler|r[ée]sumer|r[ée]capituler|te r[ée]sumer|vous r[ée]sumer)|"
    r"si (?:j'ai|je t'ai|je vous ai) bien compris|si je comprends bien|si je (?:te|vous) comprends bien|"
    r"(?:corrige|corrigez)-moi si je me trompe|"
    r"(?:d'apr[èe]s|de) ce que (?:j'entends|j'ai entendu|je comprends|j'ai compris|tu m'as dit|tu me dis|"
    r"vous m'avez dit|vous me dites)|ce que j'entends|ce que je retiens|ce que j'ai retenu|si je reprends|"
    r"pour reprendre|(?:si je|je) fais le point|on fait le point|"
    r"donc,? l[àa] o[ùu] (?:tu en es|t'en es|vous en [êe]tes))\b")
# GB-15 : demandes de la famille « j'ai oublié quelque chose ? » / « je me trompe ? » (partagées par S3 et GB-15)
_DEMANDE_MANQUANTE_FR = (
    r"\b(?:oubli[ée]?|rat[ée]|manqu[ée]|loup[ée]|zapp[ée])s? (?:quelque chose|qqch|un truc|des choses|un point|"
    r"un [ée]l[ée]ment)|\brien (?:d')?oubli|\bil (?:te |vous )?manque (?:quelque chose|un truc|des choses)|"
    r"\bje me (?:suis )?tromp|\bmal compris|\bj'ai faux")
# A1 S3 : demandes de validation (fin du passage). Les queues françaises (« …, non ? », « …, c'est ça ? ») demandent
# le point d'interrogation, avec ou sans espace devant.
DEMANDE_VALIDATION = re.compile(
    r"(did i get (that|this|it|everything) right|have i got (that|this|it) right|got that right|is that fair|"
    r"fair\??$|is that accurate|is that right|is that correct|correct\??$|right\?$|anything i(?:'ve)? missed|"
    r"(think|did|have) i(?:'ve)? miss(ed)? anything|anything i got wrong|did i miss anything|"
    r"am i missing (something|anything)|missing something|would you say that'?s where you'?re at|"
    r"does that sound (about )?right|does that resonate|are we on the same page|same page|"
    # français : « c'est bien ça ? », « j'ai bien résumé ? », « est-ce que je me trompe ? », « ça te parle ? »…
    r"c'est (?:bien )?[çc]a ?\?|c'est bien [çc]a|est-ce que c'est (?:bien )?[çc]a|c'est (?:bien )?juste ?\?|"
    r"est-ce que c'est (?:bien )?juste|c'est (?:bien )?correct|"
    r"(?:j'ai|je l'ai|je t'ai|je vous ai) bien (?:r[ée]sum[ée]|compris|reformul[ée]|saisi|cern[ée]|entendu)|"
    r"[çc]a (?:te|vous) (?:parle|correspond|semble juste|semble correct|para[iî]t juste|r[ée]sonne)|"
    r"[çc]a r[ée]sume bien|on est (?:bien )?d'accord|on est (?:bien )?align[ée]s|"
    r"c'est (?:bien )?l[àa] o[ùu] (?:tu en es|t'en es|vous en [êe]tes)|tu (?:valides|confirmes)|"
    r"vous (?:validez|confirmez)|(?:non|hein|d'accord|oui|pas vrai) ?\?$|" + _DEMANDE_MANQUANTE_FR + ")")
# GB-15 : famille « did I miss anything? » / « j'ai oublié quelque chose ? » : un simple « non » vaut accord
DEMANDE_MANQUANTE = re.compile(r"(miss(ed|ing)? (anything|something)|anything i(?:'ve)? missed|got (anything )?wrong|"
                               + _DEMANDE_MANQUANTE_FR + ")")
# GB-1 / GB-5 : la première mention de l'offre ferme la plage
MOTS_OFFRE = re.compile(
    r"\b(our program|the program|the mentorship|the academy|what we do|how we help|how we can help|"
    r"how our program|let me show you|show you how we|share my screen|"
    # français : programme, accompagnement, formation, coaching, mentorat, académie, modules, séances, suivi,
    # « ce qu'on fait », « comment on t'aide »… Les noms seuls (« formation », « suivi », « séances ») sont trop
    # courants dans la découverte (« tu as suivi une formation ») : ils ne comptent qu'avec « notre » / « nos ».
    r"notre (?:programme|accompagnement|formation|coaching|mentorat|acad[ée]mie|suivi|m[ée]thode)|"
    r"nos (?:programmes|accompagnements|formations|modules|s[ée]ances|coachs|coaches)|"
    r"le programme|l'accompagnement|le mentorat|"
    r"l'acad[ée]mie|ce qu'on fait|ce que nous faisons|comment (?:on|nous) (?:t'|te |vous )?aid(?:e|ons)|"
    r"comment (?:on|nous) (?:peut|pouvons|va|allons) (?:t'|vous )aider|comment notre (?:programme|accompagnement)|"
    r"(?:laisse|laissez)-moi (?:te |vous )montrer|je (?:vais )?(?:te|vous) montrer|je (?:te|vous) montre|"
    r"partager mon [ée]cran|je partage mon [ée]cran)\b")
# GB-30 étape 1 : questions de blocage (repérées par le code ; le modèle n'est interrogé que si rien ne correspond)
QUESTION_BLOCAGE = re.compile(
    r"(held you back|holding you back|hold you back|stopp(ed|ing) you|stops you|getting in the way|"
    r"standing in the way|in your way|why haven'?t you|prevented you|what'?s been in the way|kept you from|"
    r"keeping you from|"
    # français : « qu'est-ce qui t'a retenu ? », « qu'est-ce qui vous en empêche ? », « pourquoi tu ne l'as pas
    # encore fait ? », « tes freins », « ce qui se met en travers de ton chemin »…
    r"\bqui (?:t'|te |vous )(?:en )?(?:a |as |ont |avait |avaient )?(?:retenu|retien|bloqu|frein|emp[êe]ch|arr[êe]t)|"
    r"(?:\bt'|\bte |\bvous )(?:en )?(?:bloque|freine|emp[êe]che|retient|arr[êe]te)|\bfreins?\b|\bobstacles?\b|"
    r"en travers|sur (?:ton|votre) chemin|qu'est-ce qui coince|"
    r"\bpourquoi\b[^?.!]{0,40}\bpas (?:encore )?(?:fait|lanc|commenc|franchi|saut|d[ée]marr|boug|"
    r"pass[ée] [àa] l'action))")
# GB-23 : marqueurs de citation
MARQUEUR_CITATION = re.compile(r"\b(in your (own )?words|as you said|you used the word|from your words|"
                            r"like you said|you said it yourself|"
                            # français : « avec tes mots », « comme tu l'as dit », « tu as employé le mot »…
                            r"(?:avec|selon|pour reprendre|je reprends) (?:tes|vos|ton|votre) (?:propres )?"
                            r"(?:mots|mot|termes|expression)|"
                            r"comme (?:tu (?:l')?as dit|t'as dit|tu (?:le )?disais|vous (?:l')?avez dit|"
                            r"vous (?:le )?disiez)|"
                            r"(?:tu as|t'as|vous avez) (?:utilis[ée]|employ[ée]) (?:le mot|l'expression|ce mot|"
                            r"cette expression)|(?:tu l'as|vous l'avez) dit (?:toi|vous)-m[êe]mes?|"
                            r"c'est (?:toi qui l'as|vous qui l'avez) dit|ce sont (?:tes|vos) (?:propres )?mots|"
                            r"je (?:te|vous) cite)\b")
# A1 S2 : premier mot d'une proposition dont le prospect est le sujet (après les mots d'amorce). Formes françaises :
# « tu », « vous », « t'as », « t'es », possessifs « ton », « ta », « tes », « votre », « vos ». « t' » seul couvre une
# transcription où l'apostrophe est suivie d'une espace (« t' étais »).
SUJET_TU = {"you", "your", "you're", "you've", "you'd", "you'll", "yourself",
            "tu", "vous", "t'", "t'as", "t'es", "t'étais", "t'avais", "t'auras", "t'aurais", "t'en", "t'y", "toi",
            "toi-même", "vous-même", "vous-mêmes", "ton", "ta", "tes", "votre", "vos"}
# A1 S2 : mots d'amorce, retirés d'une proposition avant d'en lire le sujet (« donc tu… », « du coup tu… »,
# « en fait ton… »). « du coup » et « en fait » sont lus comme deux jetons chacun.
MOTS_AMORCE = {"so", "and", "but", "now", "then", "also", "obviously", "basically", "like", "well", "okay", "right",
              "currently", "today", "ultimately", "essentially", "just",
              "donc", "et", "mais", "alors", "puis", "aussi", "bon", "ben", "bah", "enfin", "bref", "voilà", "voila",
              "ok", "ouais", "oui", "d'accord", "évidemment", "evidemment", "actuellement", "aujourd'hui",
              "finalement", "essentiellement", "fondamentalement", "concrètement", "concretement", "globalement",
              "honnêtement", "honnetement", "clairement", "juste", "là", "du", "coup", "en", "fait"}
# Coupure d'une phrase en propositions (A1 S2) : ponctuation, puis les conjonctions anglaises et françaises.
COUPURE_PROPOSITIONS = re.compile(r"[;,]\s*|\s+(?:and|but|so|et|mais|donc)\s+")
# Questions fermées sans « ? » final (les débuts en wh- restent : "what's holding you back is X" est une affirmation).
# Français : « est-ce que… » et l'inversion du sujet (« as-tu… », « pouvez-vous… », « a-t-il… »), sauf « rendez-vous ».
INTERROGATIF = re.compile(r"^(?:\W*)(?:(so |and |but |now |okay,? )?(do|does|did|are|is|can|could|would|will|have|has)"
                           r" (you|we|i|that|this|it)\b"
                           r"|(?:donc |et |mais |alors |ok,? |d'accord,? )?"
                           r"(?:est-ce qu|(?!rendez-vous)\w+-(?:t-)?(?:tu|vous|il|elle|on)\b))")
DEUXIEME_PERSONNE = {"you", "your", "you're", "you've", "you'd", "you'll", "yourself", "yours",
                     "tu", "vous", "t'", "t'as", "t'es", "t'étais", "t'avais", "t'auras", "t'aurais", "t'en", "t'y", "te",
                     "toi", "toi-même",
                     "vous-même", "vous-mêmes", "ton", "ta", "tes", "votre", "vos", "tien", "tienne", "tiens",
                     "tiennes", "vôtre", "vôtres"}
# GB-1 : relances d'écoute et approbations courtes (un tour de 5 mots ou moins fait seulement de ces mots).
# Français : « oui », « ouais », « d'accord », « exactement », « tout à fait », « c'est clair », « bien sûr », « je vois »…
RELANCE_ORALE = {"yeah", "yes", "yep", "mm", "mhm", "hmm", "mm-hmm", "uh-huh", "okay", "ok", "cool", "right", "sure",
               "got", "it", "exactly", "totally", "true", "no", "nope", "oh", "wow", "great", "perfect", "nice",
               "oui", "ouais", "ouaip", "mouais", "mmh", "hum", "euh", "ah", "bah", "ben", "d'accord", "dac", "exact",
               "exactement", "carrément", "carrement", "totalement", "complètement", "completement", "absolument",
               "effectivement", "évidemment", "evidemment", "tout", "à", "fait", "c'est", "ça", "ca", "clair",
               "vrai", "voilà", "voila", "bien", "sûr", "sur", "super", "parfait", "génial", "genial", "top",
               "nickel", "grave", "entendu", "non", "je", "vois", "comprends"}


# ------------------------------------------------------------------------------------------- petites fonctions
def _mots(texte: str) -> int:
    return len(jetons_propres(texte))


def _secondes_ts(ts: str) -> Optional[int]:
    try:
        parties = [int(x) for x in ts.split(":")]
    except (ValueError, AttributeError):
        return None
    s = 0
    for p in parties:
        s = s * 60 + p
    return s


def approbation_courte(texte: str) -> bool:
    """GB-1 : un tour du prospect de 5 mots ou moins, fait seulement d'approbation ou de relance d'écoute."""
    jets = jetons_propres(texte)
    if len(jets) > MOTS_MAX_TOUR_COURT:
        return False
    return not jets or approbation_seule(texte) or all(t in RELANCE_ORALE for t in jets)


def _unite(u: Optional[str]) -> Optional[str]:
    return re.sub(r"\s+", "", normaliser(u)) if u else None


def _a_chiffre(jetons: list[str]) -> bool:
    return any(re.search(r"\d", t) and normaliser_nombre(t) is not None for t in jetons)


def _jetons_contenu(jetons: list[str]) -> list[str]:
    return [t for t in jetons if t not in MOTS_VIDES and t not in GENERIQUES]


def _pos(ctx: ContexteAppel, tid: str, citation: str = "") -> tuple[int, int]:
    """Position triable d'une citation : (rang du tour, décalage en caractères dans le tour)."""
    try:
        n = ctx.n(tid)
    except KeyError:
        return (-1, -1)
    i = normaliser(ctx.tour(tid).texte).find(normaliser(citation)) if citation else 0
    return (n, max(i, 0))


def _pr(d: Optional[dict], role: Optional[str] = None) -> Optional[Preuve]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    return Preuve(d["quote"], d["turn"], role)


# ------------------------------------------------------------------------------------------- données
@dataclass
class Enonce:
    """Un énoncé du prospect pour une composante : toujours une citation exacte du prospect (principe 1 du mot pour
    mot)."""
    composante: str
    id_atome: str
    citation: str
    tour: str
    lettre: Optional[str]
    sollicitation: Optional[str]
    objet: Optional[str]
    domaine: Optional[str]
    quantifie: bool
    valeur: Optional[float]
    unite: Optional[str]
    type_atome: str

    def vers_dict(self) -> dict:
        return {"quote": self.citation, "turn": self.tour, "value": self.valeur, "unit": self.unite,
                "solicitation": self.lettre, "solicitation_id": self.sollicitation, "object": self.objet,
                "domain": self.domaine, "quantified": self.quantifie, "atom": self.id_atome}


@dataclass
class Plage:
    debut: str
    fin: str
    tours: list[str]                       # tous les tours de la plage (tours du commercial + approbations courtes absorbées)
    signaux_: list[str]

    @property
    def uid(self) -> str:
        return f"{self.debut}:{self.fin}"


@dataclass
class Proposition:
    composante: str
    citation_commercial: str
    tour_commercial: str
    tour_source: Optional[str]
    expression_cle: Optional[str]
    correspondance: str = "untraced"                # verbatim (mot pour mot) / paraphrased / untraced (sans trace) / excluded
    raison: str = ""
    atome_source: Optional[str] = None
    citation_source: Optional[str] = None
    objet: Optional[str] = None
    comme_frein: bool = False
    citation_explicite: bool = False

    def vers_dict(self) -> dict:
        return vers_dict(self)


@dataclass
class Restitution:
    plage: Plage
    statut: str                            # statut de l'unité côté modèle : verified / arbitrated / to_review
    concordance: str = ""
    propositions: list[Proposition] = field(default_factory=list)
    est_restitution: bool = False
    apres_presentation: bool = False
    apres_prix: bool = False
    coupure_offre: Optional[tuple[str, int]] = None
    demande_: Optional[str] = None          # demande S3 trouvée à la fin du passage
    question_nouveau_sujet: Optional[str] = None
    validation: dict = field(default_factory=dict)
    reformule_correction_de: Optional[str] = None
    issue_effective: Optional[str] = None
    conformite: Optional[dict] = None

    @property
    def composantes(self) -> set[str]:
        return {c.composante for c in self.propositions if c.correspondance == "verbatim"}

    @property
    def avant_presentation(self) -> bool:
        return not self.apres_presentation and not self.apres_prix


# ------------------------------------------------------------------------------------------- 1. énoncés
def enonces_depuis_atomes(ctx: ContexteAppel, fin: Optional[str] = None) -> dict[str, list[Enonce]]:
    """§3 : énoncés du prospect par composante, tirés des atomes SPIN (chacun une citation exacte du prospect).
    Exclus : prompted_by_sales (X10, X12), les citations qui ne sont pas du prospect, les atomes à `fin` ou après."""
    sortie: dict[str, list[Enonce]] = {c: [] for c in COMPOSANTES}
    for a in ctx.atomes:
        ev = a.preuve
        if a.suggere_par_commercial or ev is None:
            continue
        try:
            t = ctx.tour(ev.tour)
        except KeyError:
            continue
        if t.role != PROSPECT or t.attribution_douteuse or normaliser(ev.citation) not in normaliser(t.texte):
            continue
        if fin and not ctx.avant(ev.tour, fin):
            continue
        for comp, types in TYPES_COMPOSANTES.items():
            if a.type not in types:
                continue
            if comp == "COST" and (a.domaine or "").lower() not in DOMAINES_COUT and a.domaine is not None:
                continue
            sortie[comp].append(Enonce(comp, a.id, ev.citation, ev.tour, a.lettre, a.id_sollicitation, a.objet,
                                       a.domaine, a.quantifie, a.valeur, a.unite, a.type))
    for comp in sortie:
        sortie[comp].sort(key=lambda s: _pos(ctx, s.tour, s.citation))
    return sortie


# ------------------------------------------------------------------------------------------- 2. formule de l'écart
def candidats_a(ctx: ContexteAppel, st: dict[str, list[Enonce]], limite_: Optional[str],
                 absent_: set[str] = frozenset()) -> list[Enonce]:
    """Candidats GB-28 : citations de l'état actuel dans les réponses S ou I (SITUATION, ou IMPACT chiffré qui dit où
    il en est maintenant), avant la limite. `absent_` = les atomes dont le modèle a dit qu'ils ne décrivent pas le
    présent (X13)."""
    sortie = []
    for s in st["A"]:
        if s.lettre not in ("S", "I") or not ctx.avant(s.tour, limite_):
            continue
        if s.type_atome == "IMPACT" and not s.quantifie:
            continue
        if s.id_atome in absent_:
            continue
        sortie.append(s)
    return sortie


def candidats_b(ctx: ContexteAppel, st: dict[str, list[Enonce]], limite_: Optional[str]) -> tuple[list, list]:
    """Candidats GB-29 (réponses N) et les cibles dites hors des réponses N (`B_outside_N`, seulement enregistrées)."""
    dedans = [s for s in st["B"] if s.lettre == "N" and ctx.avant(s.tour, limite_)]
    dehors = [s for s in st["B"] if s.lettre != "N" and ctx.avant(s.tour, limite_)]
    return dedans, dehors


def choisir_a_b(ctx: ContexteAppel, A: list[Enonce], B: list[Enonce]) -> tuple[Optional[Enonce],
                                                                                    Optional[Enonce], str]:
    """GB-28 / GB-29. Renvoie (A choisi, B choisi, règle). Les listes sont dans l'ordre de la transcription."""
    def dernier(xs):
        return xs[-1] if xs else None
    Aq = [a for a in A if a.quantifie and a.unite]
    Bq = [b for b in B if b.quantifie and b.unite]
    partage = [b for b in Bq if any(_unite(a.unite) == _unite(b.unite) for a in Aq)]
    if partage:
        b = dernier(partage)
        a = dernier([x for x in Aq if _unite(x.unite) == _unite(b.unite)])
        return a, b, "same_unit"
    # B dans l'unité de A quand l'unité n'est pas un chiffre (statut, carrière, date…) : la paire que reprend la formule
    u_partage = [b for b in B if b.unite and any(a.unite and _unite(a.unite) == _unite(b.unite) for a in A)]
    if u_partage:
        b = dernier(u_partage)
        return dernier([x for x in A if x.unite and _unite(x.unite) == _unite(b.unite)]), b, "same_unit_unquantified"
    if B:
        b = dernier(Bq) or dernier(B)
        meme_obj = [x for x in A if b.objet and x.objet and normaliser(x.objet) == normaliser(b.objet)]
        if meme_obj:
            return dernier(meme_obj), b, "same_object"
        meme_u = [x for x in A if b.unite and _unite(x.unite) == _unite(b.unite)]
        if meme_u:
            return dernier(meme_u), b, "same_unit_unquantified"
        return dernier(A), b, "no_A_on_B_dimension" if A else "no_A"
    return (dernier(Aq) or dernier(A)), None, "no_B"


def choisir_p(ctx: ContexteAppel, P: list[Enonce], blocage: list[Sollicitation],
             atomes_avant_tous: list[Atome]) -> tuple[Optional[Enonce], Optional[str]]:
    """GB-30. P = énoncés PAIN/BLOCKER dans les réponses P (avant la limite), dans l'ordre de la transcription.
    blocage = les sollicitations P qui sont des questions de blocage, dans l'ordre de la transcription."""
    if not P:
        return None, None

    def cle_obj(s: Enonce) -> str:
        return normaliser(s.objet) if s.objet else f"#{s.id_atome}"

    reserve, nomme = P, None
    for q in blocage:                                   # étape 1 : première question de blocage suivie d'un blocage
        rep = [s for s in P if s.sollicitation == q.id]
        if rep:
            nomme = rep
            break
    if nomme is not None:
        if len({cle_obj(s) for s in nomme}) == 1:
            return nomme[0], "named_when_asked"
        reserve = nomme                                     # plusieurs blocages : étape 2 entre eux seulement
    # étape 2 : l'objet présent dans le plus grand nombre de tours distincts du prospect avant la première restitution
    tours_par_obj: dict[str, set[str]] = {}
    for a in atomes_avant_tous:
        if a.objet and not a.suggere_par_commercial:
            tours_par_obj.setdefault(normaliser(a.objet), set()).add(a.preuve.tour)
    for s in P:
        tours_par_obj.setdefault(cle_obj(s), set()).add(s.tour)
    meilleur = max(len(tours_par_obj.get(cle_obj(s), ())) for s in reserve)
    haut = [s for s in reserve if len(tours_par_obj.get(cle_obj(s), ())) == meilleur]
    if len({cle_obj(s) for s in haut}) == 1:
        return haut[0], "comes_back_most"
    # étape 3 : départage : nommé en premier en réponse à la question de blocage, sinon le plus récent (à valider)
    if nomme is not None:
        return min(haut, key=lambda s: _pos(ctx, s.tour, s.citation)), "tie_named_first"
    return max(haut, key=lambda s: _pos(ctx, s.tour, s.citation)), "tie_most_recent"


def blocages_feuille_route(ctx: ContexteAppel, fin: Optional[str], p_choisi: Optional[Enonce] = None) -> list[dict]:
    """GB-32 : objets de blocage distincts dits en réponse à des sollicitations P ou I avant la première présentation,
    chacun avec sa première citation exacte. Les blocages suggérés par le commercial sont exclus (X12)."""
    vus: dict[str, dict] = {}
    atomes = sorted((a for a in ctx.atomes if a.type in ("PAIN", "BLOCKER") and a.lettre in ("P", "I")
                    and not a.suggere_par_commercial and a.preuve and ctx.avant(a.preuve.tour, fin)),
                   key=lambda a: _pos(ctx, a.preuve.tour, a.preuve.citation))
    for a in atomes:
        try:
            if ctx.tour(a.preuve.tour).role != PROSPECT:
                continue
        except KeyError:
            continue
        k = normaliser(a.objet) if a.objet else f"#{a.id}"
        if k not in vus:
            vus[k] = {"object": a.objet, "quote": a.preuve.citation, "turn": a.preuve.tour,
                       "solicitation": a.lettre}
    sortie = list(vus.values())
    if not FEUILLE_ROUTE_COMPTE_P_CHOISI and p_choisi is not None:
        sortie = [b for b in sortie if normaliser(b["object"] or "") != normaliser(p_choisi.objet or "")]
    return sortie


def alerte_copilote(blocages: list[dict], etapes: int = ETAPES_FEUILLE_ROUTE) -> bool:
    """GB-33 : prévenir le commercial, avant de produire la page de la feuille de route, quand il y a moins de
    blocages que d'étapes."""
    return len(blocages) < etapes


# ------------------------------------------------------------------------------------------- 3. inventaire
def limite_fenetre_apres(ctx: ContexteAppel) -> Optional[str]:
    """A2 : les candidats après la fin de la fenêtre sont enregistrés pour les diagnostics (after_pitch /
    after_price). L'inventaire s'arrête au premier prix ou à la demande de décision (LIMITE_FENETRE_APRES), au premier
    des deux."""
    if LIMITE_FENETRE_APRES != "first_price":
        return None
    fins = [x for x in (ctx.phases.premier_prix, ctx.phases.demande_decision) if x]
    return min(fins, key=ctx.n) if fins else None


def fin_fenetre(ctx: ContexteAppel) -> Optional[str]:
    """A2 : fin de la fenêtre = premier début de présentation ou premier prix, au premier des deux (GB-14)."""
    fins = [x for x in (ctx.phases.debut_presentation, ctx.phases.premier_prix) if x]
    return min(fins, key=ctx.n) if fins else None


def signaux_candidats(ctx: ContexteAppel, t: Tour, jetons_prospect_anterieurs: set[str]) -> list[str]:
    """A1 : S1 ouverture (20 premiers mots), S2 passage dense à la deuxième personne, S3 demande de validation à la
    fin."""
    sig = []
    tete = " ".join(normaliser(t.texte).split()[:S1_PREMIERS_MOTS])
    if OUVERTURES.search(tete):
        sig.append("S1")
    jets = jetons_propres(t.texte)
    if len(jets) >= S2_MIN_MOTS:
        n = 0
        for envoye in phrases(t.texte):
            if envoye.rstrip().endswith("?") or INTERROGATIF.match(normaliser(envoye)):
                continue                                   # S2 ne compte que les propositions affirmatives
            for c in COUPURE_PROPOSITIONS.split(normaliser(envoye)):
                ct = [w for w in jetons_propres(c) if w not in MOTS_AMORCE]
                if not ct or ct[0] not in SUJET_TU:     # le prospect est le sujet
                    continue
                if any(w in jetons_prospect_anterieurs and (len(w) > 3 and w not in MOTS_VIDES and w not in GENERIQUES
                                                       or (re.search(r"\d", w) and normaliser_nombre(w)))
                       for w in ct[1:]):
                    n += 1
        if n >= S2_MIN_PROPOSITIONS:
            sig.append("S2")
    if demande_validation(t.texte):
        sig.append("S3")
    return sig


def demande_validation(texte: str) -> Optional[str]:
    """S3 : la dernière phrase du passage demande de valider ce qui vient d'être dit."""
    ss = phrases(texte) or [texte]
    dernier = normaliser(ss[-1]).strip()
    queue = " ".join(normaliser(texte).split()[-12:])
    for bloc_ in (dernier, queue):
        m = DEMANDE_VALIDATION.search(bloc_)
        if m:
            return ss[-1].strip()
    return None


def inventaire(ctx: ContexteAppel) -> list[Plage]:
    """S1 Inventaire (code) : candidats à la restitution, du début de la découverte à la fin de l'appel (les
    candidats après la fin de la fenêtre sont gardés pour les diagnostics, A2). Plage GB-1 : des tours candidats du
    commercial séparés seulement par des approbations courtes sont réunis ; un tour court qui n'a que S3 est réuni au
    tour du commercial juste avant."""
    debut = ctx.phases.debut_decouverte
    tours = ctx.fenetre(debut, None) if debut else list(ctx.tours)
    anterieur: set[str] = set()
    if debut:
        for t in ctx.fenetre(None, debut):
            if t.role == PROSPECT and not t.attribution_douteuse:
                anterieur.update(jetons_propres(t.texte))
    signale: dict[str, list[str]] = {}
    ffin = fin_fenetre(ctx)
    limite = limite_fenetre_apres(ctx)
    for t in tours:
        if limite is not None and not ctx.avant(t.id, limite):
            break
        if t.role == PROSPECT and not t.attribution_douteuse:
            anterieur.update(jetons_propres(t.texte))
            continue
        if t.role != COMMERCIAL or t.attribution_douteuse:          # GB-12
            continue
        sig = signaux_candidats(ctx, t, anterieur)
        if sig and ffin is not None and not ctx.avant(t.id, ffin) and sig == ["S2"] and \
                SIGNAUX_FENETRE_APRES == "S1_S3":
            sig = []                                       # après la fenêtre : ouvertures et demandes seulement (A2)
        if sig:
            signale[t.id] = sig
    return construire_plages(ctx, signale)


def construire_plages(ctx: ContexteAppel, signale: dict[str, list[str]]) -> list[Plage]:
    plages: list[Plage] = []
    ids = [t.id for t in ctx.tours]
    utilise: set[str] = set()
    for tid in [t.id for t in ctx.tours if t.id in signale]:
        if tid in utilise:
            continue
        i = ids.index(tid)
        membres, sig = [tid], list(signale[tid])
        # réunion vers l'arrière : queue courte S3 seule -> tour précédent du commercial, par-dessus les approbations
        # courtes (GB-1)
        if signale[tid] == ["S3"] and _mots(ctx.tours[i].texte) < S2_MIN_MOTS:
            j, ecart = i - 1, []
            while j >= 0 and ctx.tours[j].role != COMMERCIAL and approbation_courte(ctx.tours[j].texte):
                ecart.append(ctx.tours[j].id)
                j -= 1
            if j >= 0 and ctx.tours[j].role == COMMERCIAL and ecart and ctx.tours[j].id not in utilise \
                    and not ctx.tours[j].attribution_douteuse:
                membres = [ctx.tours[j].id] + list(reversed(ecart)) + membres
        # réunion vers l'avant : le tour suivant du commercial est candidat, avec seulement des approbations courtes
        # entre les deux (GB-1)
        k = i + 1
        while True:
            ecart = []
            while k < len(ids) and ctx.tours[k].role != COMMERCIAL and approbation_courte(ctx.tours[k].texte):
                ecart.append(ids[k])
                k += 1
            if ecart and k < len(ids) and ids[k] in signale and ctx.tours[k].role == COMMERCIAL:
                membres += ecart + [ids[k]]
                sig += [s for s in signale[ids[k]] if s not in sig]
                k += 1
                continue
            break
        utilise.update(membres)
        commercial = [m for m in membres if ctx.tour(m).role == COMMERCIAL]
        plages.append(Plage(commercial[0], commercial[-1], membres, sig))
    return plages


def coupure_offre(ctx: ContexteAppel, plage: Plage) -> Optional[tuple[str, int]]:
    """GB-1 / GB-5 : position du premier mot de l'offre dans la plage (tours du commercial)."""
    for tid in plage.tours:
        t = ctx.tour(tid)
        if t.role != COMMERCIAL:
            continue
        m = MOTS_OFFRE.search(normaliser(t.texte))
        if m:
            return tid, m.start()
    return None


def _avant_coupure(ctx: ContexteAppel, tid: str, citation: str, coupure: Optional[tuple[str, int]]) -> bool:
    if coupure is None:
        return True
    if ctx.n(tid) != ctx.n(coupure[0]):
        return ctx.n(tid) < ctx.n(coupure[0])
    i = normaliser(ctx.tour(tid).texte).find(normaliser(citation))
    return 0 <= i < coupure[1]


# ------------------------------------------------------------------------------------------- décision d'une proposition
def _atomes_dans(ctx: ContexteAppel, tid: str) -> list[Atome]:
    return [a for a in ctx.atomes if a.preuve and a.preuve.tour == tid]


def _atome_avec(ctx: ContexteAppel, tid: str, ke: str, types: Optional[set] = None) -> Optional[Atome]:
    kc = canon(jetons_propres(ke), False)
    touches = [a for a in _atomes_dans(ctx, tid) if (types is None or a.type in types)
            and _contient(canon(jetons_propres(a.preuve.citation), False), kc)]
    return touches[0] if touches else None


def dit_dabord_par_commercial(ctx: ContexteAppel, ke: str, tour_source: str) -> bool:
    """X12 / GB-24 : mots ou chiffres dits d'abord par le commercial et seulement repris par le prospect.
    S'applique aux chiffres et aux expressions clés de 2 mots pleins ou plus (un seul mot principal que le commercial
    reprend au prospect appartient au prospect : ancrage, C3 règle 6)."""
    jets = jetons_propres(ke)
    if not (_a_chiffre(jets) or len(_jetons_contenu(jets)) >= 2):
        return False
    k_com, k_pros = canon(jets, True), canon(jets, False)
    try:
        src_n = ctx.n(tour_source)
    except KeyError:
        return False
    for t in ctx.tours[:src_n]:
        if t.attribution_douteuse:
            continue
        meule = canon(jetons_propres(t.texte), False)
        if t.role == PROSPECT and _contient(meule, k_pros):
            return False
        if t.role == COMMERCIAL and _contient(meule, k_com):
            return True
    return False


def _texte_source(ctx: ContexteAppel, src: str) -> tuple[Optional[str], str]:
    """Renvoie (texte, erreur). Sources : un tour PROSPECT antérieur, ou PRIOR<k> (GB-13 / GB-19)."""
    if src.upper().startswith("PRIOR"):
        try:
            p = ctx.entrees_anterieures[int(src[5:])]
        except (ValueError, IndexError):
            return None, "unknown_source"
        if p.get("kind") not in TYPES_SOURCES_ANTERIEURES or not p.get("text"):
            return None, "not_prospect_words"            # GB-19 : notes du setter, résumés du CRM
        return p["text"], ""
    try:
        t = ctx.tour(src)
    except KeyError:
        return None, "unknown_source"
    if t.role != PROSPECT:
        return None, "source_not_prospect"
    if t.attribution_douteuse:
        return None, "source_attribution_doubtful"
    return t.texte, ""


def classer_proposition(ctx: ContexteAppel, brut: dict, plage: Plage, coupure: Optional[tuple[str, int]]) -> Proposition:
    """GB-3 / GB-22 : décision sur une proposition (code). Seule une proposition mot pour mot est une composante."""
    c = Proposition(brut.get("component", ""), brut.get("sales_quote", ""), brut.get("sales_turn", ""),
               brut.get("source_turn"), brut.get("key_expression"),
               comme_frein=bool(brut.get("as_holding_back")))
    if not brut.get("about_prospect", True):
        c.correspondance, c.raison = "excluded", "other_person"                     # GB-3 a, GB-6, X4
        return c
    if brut.get("declarative") is False:
        c.correspondance, c.raison = "excluded", "not_declarative"                  # GB-3 b
        return c
    if not _avant_coupure(ctx, c.tour_commercial, c.citation_commercial, coupure):
        c.correspondance, c.raison = "excluded", "after_offer_words"                # GB-1, GB-5
        return c
    if not c.tour_source or not c.expression_cle:
        c.correspondance, c.raison = "untraced", "no_source"                        # X5
        return c
    texte_src, err = _texte_source(ctx, c.tour_source)
    if texte_src is None:
        c.correspondance, c.raison = "untraced", err
        return c
    if not c.tour_source.upper().startswith("PRIOR") and not ctx.avant(c.tour_source, plage.debut):
        c.correspondance, c.raison = "untraced", "source_not_earlier"
        return c
    ok, pourquoi = expression_cle_ok(c.expression_cle, texte_src, c.citation_commercial)  # GB-22 a, b, d
    if not ok:
        c.correspondance, c.raison = "paraphrased", pourquoi                             # X11
        return c
    if dit_dabord_par_commercial(ctx, c.expression_cle, c.tour_source):
        c.correspondance, c.raison = "excluded", "first_said_by_sales"              # X12, GB-24
        return c
    atome = None if c.tour_source.upper().startswith("PRIOR") else \
        _atome_avec(ctx, c.tour_source, c.expression_cle)
    if atome is not None and atome.suggere_par_commercial:
        c.correspondance, c.raison = "excluded", "prompted_by_sales"                # X10
        return c
    if c.composante == "COST" and atome is not None and atome.type == "SITUATION":
        autre = _atome_avec(ctx, c.tour_source, c.expression_cle, {"IMPACT", "PAIN", "BLOCKER"})
        if autre is None:
            c.correspondance, c.raison = "excluded", "income_not_cost"              # X6, GB-7
            return c
        atome = autre
    saisi = _atome_avec(ctx, c.tour_source, c.expression_cle, TYPES_COMPOSANTES.get(c.composante)) \
        if not c.tour_source.upper().startswith("PRIOR") else None
    atome = saisi or atome
    c.correspondance, c.raison = "verbatim", "ok"
    c.atome_source = atome.id if atome else None
    c.citation_source = atome.preuve.citation if atome else _phrase_avec(texte_src, c.expression_cle)
    c.objet = (atome.objet if atome and atome.objet else None) or normaliser(c.expression_cle)
    c.citation_explicite = bool(MARQUEUR_CITATION.search(normaliser(c.citation_commercial)))  # GB-23 (noté seulement si mot pour mot)
    return c


def _phrase_avec(texte: str, ke: str) -> str:
    for s in phrases(texte):
        if normaliser(ke) in normaliser(s):
            return s
    return ke


def decider_restitution(ctx: ContexteAppel, plage: Plage, rep: Optional[dict], statut: str, conc: str = "") -> Restitution:
    """GB-1..GB-7 : décision sur un candidat à partir des propositions du modèle (code)."""
    ffin = fin_fenetre(ctx)
    r = Restitution(plage, statut, conc)
    r.apres_presentation = bool(ctx.phases.debut_presentation) and not ctx.avant(plage.fin, ctx.phases.debut_presentation)
    r.apres_prix = bool(ctx.phases.premier_prix) and not ctx.avant(plage.fin, ctx.phases.premier_prix)
    if ffin is None:
        r.apres_presentation = r.apres_prix = False
    r.coupure_offre = coupure_offre(ctx, plage)
    dernier_commercial = ctx.tour(plage.fin)
    r.demande_ = demande_validation(dernier_commercial.texte)
    if rep is None:
        return r
    r.propositions = [classer_proposition(ctx, c, plage, r.coupure_offre) for c in rep.get("clauses", [])
                 if c.get("component") in COMPOSANTES]
    r.question_nouveau_sujet = rep.get("new_topic_question_quote") if rep.get("ends_with_new_topic_question") else None
    r.est_restitution = len(r.composantes) >= 2                              # GB-4, X2
    return r


# ------------------------------------------------------------------------------------------- 4. validation
def tour_validation(ctx: ContexteAppel, r: Restitution) -> tuple[Optional[Tour], str]:
    """GB-8 : le tour du prospect juste après la plage. Renvoie (tour, raison s'il n'y en a pas)."""
    if r.question_nouveau_sujet:
        dernier = normaliser(ctx.tour(r.plage.fin).texte)
        qi = dernier.find(normaliser(r.question_nouveau_sujet))
        ri = dernier.rfind(normaliser(r.demande_)) if r.demande_ else -1
        if not (r.demande_ and ri > qi and normaliser(r.question_nouveau_sujet) not in normaliser(r.demande_)):
            return None, "captured_by_other_question"                      # GB-9, X7 (la demande S3 dite en dernier l'emporte, GB-8)
    if r.coupure_offre is not None:
        dem_avant_offre = r.demande_ and _avant_coupure(ctx, r.plage.fin, r.demande_, r.coupure_offre)
        if not dem_avant_offre:
            return None, "offer_mentioned_before_validation"               # GB-5, X8
    i = ctx.n(r.plage.fin) + 1
    if i >= len(ctx.tours):
        return None, "no_response"
    t = ctx.tours[i]
    if t.role == COMMERCIAL:
        return None, "sales_continued"                                     # changement de sujet avant que le prospect réponde
    if t.attribution_douteuse:
        return None, "attribution_doubtful"                                # GB-12, GB-21
    return t, ""


def _est_repetition(contenu: str, texte_restitution: str) -> bool:
    """GB-26 : un contenu ajouté qui ne fait que répéter les mots du commercial n'est pas un contenu du prospect."""
    ct = _jetons_contenu(canon(jetons_propres(contenu), True))
    if not ct:
        return True
    meule = set(canon(jetons_propres(texte_restitution), False))
    return all(w in meule for w in ct)


def decider_validation(ctx: ContexteAppel, r: Restitution, vt: Optional[Tour], rep: Optional[dict]) -> dict:
    """GB-10 : issue décidée par le code à partir des réponses fermées du modèle (GB-15, GB-16, GB-17, GB-26)."""
    sortie = {"outcome": "none", "turn": vt.id if vt else None, "quote": None, "content_quote": None,
           "corrected_components": [], "correction_quote": None, "rule": ""}
    if vt is None or rep is None:
        return sortie
    issue = rep.get("outcome") if rep.get("outcome") in ISSUES else "none"
    if vt.role == AUTRE and not rep.get("addressed_co_decider"):
        sortie["rule"] = "GB-12"
        return sortie
    if rep.get("answers_other_question"):
        sortie["rule"] = "GB-9"
        return sortie
    sortie["quote"] = rep.get("agreement_quote") or vt.texte
    texte = vt.texte
    texte_reste = " ".join(ctx.tour(x).texte for x in r.plage.tours if ctx.tour(x).role == COMMERCIAL)
    if rep.get("emotional_reaction"):                                      # GB-17
        if rep.get("disagreement"):
            issue = "rejected"
        elif issue in ("confirmed", "confirmed_with_content", "none"):
            issue = "confirmed_with_content"
            sortie["content_quote"] = rep.get("content_quote") or rep.get("agreement_quote") or texte
            sortie["rule"] = "GB-17"
    if issue == "rejected" and approbation_seule(texte) and r.demande_ and DEMANDE_MANQUANTE.search(normaliser(r.demande_)):
        issue, sortie["rule"] = "confirmed", "GB-15"                       # « Non » à « j'ai oublié quelque chose ? »
    if issue in ("confirmed", "confirmed_with_content") and rep.get("correction_quote"):
        issue, sortie["rule"] = "corrected", "GB-16"                       # accord avec réserve + correction
    if issue == "confirmed_with_content" and sortie["rule"] != "GB-17":
        cq = rep.get("content_quote")
        if approbation_seule(texte) or not cq or citation_ok(ctx, Preuve(cq, vt.id, vt.role), mots_min=2,
                                                     mots_max=MOTS_MAX_CITATION):
            issue, sortie["rule"] = "confirmed", "C3-5"                    # une approbation n'est pas un contenu
        elif rep.get("content_is_repetition") or _est_repetition(cq, texte_reste):
            issue, sortie["rule"] = "confirmed", "GB-26"
        else:
            sortie["content_quote"] = cq
    if issue == "corrected":
        sortie["corrected_components"] = [c for c in rep.get("corrected_components", []) if c in COMPOSANTES]
        sortie["correction_quote"] = rep.get("correction_quote")
    sortie["outcome"] = issue
    return sortie


def resoudre_corrections(rs: list[Restitution]) -> None:
    """GB-10 / GB-25 / X9 : une restitution corrigée n'est validée que si la restitution suivante reprend la
    correction mot pour mot (une composante dont la source est le tour qui corrige) et est confirmée. La restitution
    qui reprend doit elle-même reprendre la correction pour passer."""
    for i, r in enumerate(rs):
        r.issue_effective = r.validation.get("outcome") if r.est_restitution else None
    for i, r in enumerate(rs):
        if not r.est_restitution or r.validation.get("outcome") != "corrected":
            continue
        vt = r.validation.get("turn")
        suiv = next((x for x in rs[i + 1:] if x.est_restitution), None)
        if suiv is None:
            r.issue_effective = "corrected_not_restated"
            continue
        reformule = any(c.correspondance == "verbatim" and c.tour_source == vt for c in suiv.propositions)
        if reformule:
            suiv.reformule_correction_de = r.plage.uid
            if suiv.validation.get("outcome") in VALIDE:
                r.issue_effective = "corrected_then_confirmed"
        else:
            r.issue_effective = "corrected_not_restated"
            if suiv.issue_effective in VALIDE:
                suiv.issue_effective = "correction_not_restated"         # GB-25 : la porte échoue (X9)


# ------------------------------------------------------------------------------------------- 5. porte
def passes(r: Restitution) -> bool:
    return r.est_restitution and {"PROBLEM", "COST"} <= r.composantes and \
        r.issue_effective in (VALIDE | {"corrected_then_confirmed"})


def porte(rs: list[Restitution]) -> tuple[str, list[str], list[Restitution]]:
    """§5.1 porte d'absence + GB-20. Renvoie (verdict, raisons [la principale d'abord], restitutions qui passent
    avant la présentation)."""
    reel = [r for r in rs if r.est_restitution]
    pre = [r for r in reel if r.avant_presentation]
    poster = [r for r in reel if not r.avant_presentation]
    ok = [r for r in pre if passes(r)]
    if ok:
        return "present", [], ok
    echoue: list[str] = []
    apres_passe = any(passes(r) for r in poster)
    if not pre:
        echoue.append("restitution_after_pitch" if poster and (apres_passe or not RAISON_APRES_PRESENTATION_EXIGE_PASSAGE)
                      else "no_restitution")
    else:
        if apres_passe:
            echoue.append("restitution_after_pitch")                       # exemple de GB-20
        a_p = any("PROBLEM" in r.composantes for r in pre)
        a_c = any("COST" in r.composantes for r in pre)
        if not a_p:
            echoue.append("problem_missing")
        if not a_c:
            echoue.append("cost_missing")
        if any({"PROBLEM", "COST"} <= r.composantes for r in pre):
            echoue.append("not_validated")                                 # contrôle 3 échoué sur chaque restitution P+C
        elif a_p and a_c:
            echoue += ["problem_missing", "cost_missing"]                  # jamais additionnés d'une restitution à l'autre (GB-2)
    echoue = sorted(set(echoue), key=PRIORITE_RAISONS.index)
    return "absent", echoue, []


# ------------------------------------------------------------------------------------------- conformité à la formule
def _correspond(c: Proposition, s: Optional[Enonce]) -> bool:
    if s is None or c.correspondance != "verbatim":
        return False
    if c.atome_source and c.atome_source == s.id_atome:
        return True
    return c.tour_source == s.tour and _contient(canon(jetons_propres(s.citation), False),
                                                 canon(jetons_propres(c.expression_cle or ""), False))


def conformite_formule(ctx: ContexteAppel, r: Restitution, choix_a: Optional[Enonce], choix_b: Optional[Enonce],
                       choix_p: Optional[Enonce]) -> dict:
    """GB-31 : le A choisi, le B choisi, un seul blocage qui est le P choisi, le tout mot pour mot."""
    v = [c for c in r.propositions if c.correspondance == "verbatim"]
    prop_a = [c for c in v if c.composante == "A"]
    prop_b = [c for c in v if c.composante == "B"]
    prop_p = [c for c in v if c.composante == "PROBLEM"]
    tenu = [c for c in r.propositions if c.composante == "PROBLEM" and c.comme_frein and c.correspondance == "verbatim"] or prop_p
    objs = {normaliser(c.objet or c.expression_cle or "") for c in tenu}
    dev = []
    a_valide = any(_correspond(c, choix_a) for c in prop_a)
    b_valide = any(_correspond(c, choix_b) for c in prop_b)
    if not prop_a:
        dev.append("A_missing")
    elif not a_valide:
        dev.append("A_not_selected")
    if not prop_b:
        dev.append("B_missing")
    elif not b_valide:
        dev.append("B_not_selected")
    unites = {}
    for comp, cls in (("A", prop_a), ("B", prop_b)):
        for c in cls:
            at = next((x for x in ctx.atomes if x.id == c.atome_source), None)
            if at is not None and at.quantifie and at.unite:
                unites[comp] = _unite(at.unite)
    if len(unites) == 2 and unites["A"] != unites["B"]:
        dev.append("unit_mismatch")
    unique = len(objs) == 1
    if len(objs) >= 2:
        dev.append("several_blockers")                                     # X14
    p_valide = unique and choix_p is not None and (any(_correspond(c, choix_p) for c in tenu) or
                                             (choix_p.objet and normaliser(choix_p.objet) in objs))
    if prop_p and unique and not p_valide:
        dev.append("P_not_selected")
    ec_longue = any(len(jetons_propres(c.expression_cle or "")) >= MOTS_EXPRESSION_CLE_LONGUE or
                  _a_chiffre(jetons_propres(c.expression_cle or "")) for c in v)
    conforme = a_valide and b_valide and p_valide and "unit_mismatch" not in dev and "COST" in r.composantes
    return {"A": a_valide, "B": b_valide, "single_P": unique, "P_selected": p_valide, "long_key_expression": ec_longue,
            "conforms": conforme, "deviations": dev}


# ------------------------------------------------------------------------------------------- notation
def noter_items(ctx: ContexteAppel, r: Optional[Restitution], choix_a: Optional[Enonce],
                choix_b: Optional[Enonce], horizon: Optional[dict], choix_p: Optional[Enonce],
                conf: Optional[dict], sol_par_id: dict[str, Sollicitation]) -> list[NoteItem]:
    """§5.2 items G1..G6 avec la règle des deux citations (C3, règle 4)."""
    def sol_pr(s: Optional[Enonce]) -> Optional[Preuve]:
        q = sol_par_id.get(s.sollicitation) if s and s.sollicitation else None
        return Preuve(q.texte, q.tour, COMMERCIAL) if q else None

    meme_unite = bool(choix_a and choix_b and choix_a.quantifie and choix_b.quantifie and choix_a.unite and
                     _unite(choix_a.unite) == _unite(choix_b.unite))
    items = []
    # G1 point A
    if choix_a is None:
        g1, ev1 = 0, []
    else:
        sur_dim = choix_b is None or not choix_b.quantifie or meme_unite
        g1 = 2 if (choix_a.quantifie and sur_dim) else 1
        ev1 = [Preuve(choix_a.citation, choix_a.tour, PROSPECT), sol_pr(choix_a)]
    items.append(item("G1", POIDS["G1"], g1, ev1, "A choisi (GB-28)"))
    # G2 point B
    if choix_b is None:
        g2, ev2, remarque2 = 0, [], "aucun B dans les réponses N (GB-29)"
    else:
        hz = horizon or {}
        g2 = 1
        if choix_b.quantifie and meme_unite and (hz.get("quote") or not G2_EXIGE_HORIZON):
            g2 = 2
        ev2 = [Preuve(choix_b.citation, choix_b.tour, PROSPECT),
               _pr(hz, PROSPECT) if hz.get("quote") else sol_pr(choix_b)]
        remarque2 = "horizon : " + (hz.get("horizon") or hz.get("quote") or "aucun")
    items.append(item("G2", POIDS["G2"], g2, ev2, remarque2))
    # G3 écart mesurable
    g3 = 2 if meme_unite and choix_a.valeur is not None and choix_b.valeur is not None else 0
    items.append(item("G3", POIDS["G3"], g3,
                      [Preuve(choix_a.citation, choix_a.tour, PROSPECT), Preuve(choix_b.citation, choix_b.tour, PROSPECT)]
                      if g3 else [], "même unité, gap_value calculable" if g3 else "pas de A et de B chiffrés dans une même unité"))
    # G4 coût du problème (sur l'énoncé du coût fait par le prospect lui-même, repris mot pour mot)
    g4, ev4, remarque4 = 0, [], "aucun coût repris mot pour mot"
    if r is not None:
        meilleur = None
        for c in (x for x in r.propositions if x.composante == "COST" and x.correspondance == "verbatim"):
            at = next((a for a in ctx.atomes if a.id == c.atome_source), None)
            niv = 0
            if at is not None and at.quantifie and not _chiffre_commercial(ctx, at):
                niv = 2
            elif at is not None and (at.domaine or "").lower() in DOMAINES_COUT:
                niv = 1
            if meilleur is None or niv > meilleur[0]:
                meilleur = (niv, c, at)
        if meilleur:
            g4, c, at = meilleur
            ev4 = [Preuve(c.citation_commercial, c.tour_commercial, COMMERCIAL),
                   Preuve(at.preuve.citation, at.preuve.tour, PROSPECT) if at else
                   Preuve(c.citation_source or "", c.tour_source or "", PROSPECT)]
            remarque4 = f"énoncé du coût {'chiffré' if g4 == 2 else 'domaine ' + str(at.domaine) if at else 'générique'}"
    items.append(item("G4", POIDS["G4"], g4, ev4, remarque4))
    # G5 qualité de la restitution
    if r is None:
        items.append(item("G5", POIDS["G5"], 0, [], "aucune restitution"))
    else:
        niv = 2 if conf and conf["conforms"] and conf["long_key_expression"] else 1
        ev5 = []
        for c in r.propositions:
            if c.correspondance == "verbatim":
                ev5.append(Preuve(c.citation_commercial, c.tour_commercial, COMMERCIAL))
                ev5.append(Preuve(c.expression_cle or "", c.tour_source or "", PROSPECT))
        remarque5 = "formule complète (GB-31)" if niv == 2 else "écarts à la formule : " + ", ".join((conf or {}).get(
            "deviations", []) or (["aucune expression clé de 3 mots ou plus ni chiffre du prospect"]))
        items.append(item("G5", POIDS["G5"], niv, ev5, remarque5))
    # G6 validation
    if r is None:
        items.append(item("G6", POIDS["G6"], 0, [], "aucune validation"))
    else:
        v = r.validation
        niv = 2 if r.issue_effective == "confirmed_with_content" else 1
        ev6 = [Preuve(ctx.tour(r.plage.fin).texte if not r.demande_ else r.demande_, r.plage.fin, COMMERCIAL)]
        if v.get("content_quote") and v.get("turn"):
            ev6.append(Preuve(v["content_quote"], v["turn"], PROSPECT))
        elif v.get("quote") and v.get("turn"):
            ev6.append(Preuve(v["quote"], v["turn"], PROSPECT))
        items.append(item("G6", POIDS["G6"], niv, ev6, f"issue {r.issue_effective}"))
    return items


def _chiffre_commercial(ctx: ContexteAppel, at: Atome) -> bool:
    """GB-24 / X10 : un chiffre dit ou calculé d'abord par le commercial ne compte jamais pour G1..G4."""
    chiffres_ = [w for w in jetons_propres(at.preuve.citation) if re.search(r"\d", w)]
    return bool(chiffres_) and all(dit_dabord_par_commercial(ctx, f, at.preuve.tour) for f in chiffres_)


# ------------------------------------------------------------------------------------------- tâches du modèle
def _afficher_enonces(st: dict[str, list[Enonce]]) -> str:
    lignes = []
    for comp in COMPOSANTES:
        for s in st[comp]:
            lignes.append(f"- {comp} atome={s.id_atome} [{s.tour}] \"{s.citation}\"")
    return "\n".join(lignes) or "(aucun)"


def _plage_depuis_uid(ctx: ContexteAppel, uid: str) -> tuple[str, str]:
    _, a, b = uid.split(":", 2)
    return a, b


def construire_restitution(ctx: ContexteAppel, unite: tuple[Plage, dict]) -> str:
    plage, st = unite
    lo = ctx.n(plage.debut)
    hi = min(len(ctx.tours), ctx.n(plage.fin) + 2)
    plus_tot = [t for t in ctx.fenetre(ctx.phases.debut_decouverte, plage.debut) if t.role == PROSPECT]
    return (f"PLAGE CANDIDATE : {plage.debut} à {plage.fin} (signaux de l'inventaire : {', '.join(plage.signaux_)})\n"
            "Liste chaque proposition des tours SALES (le commercial) de la plage qui reprend une composante (PROBLEM, "
            "COST, A, B) de l'écart. Pour chaque proposition, donne les mots exacts du commercial, le tour PROSPECT "
            "antérieur qu'elle reprend (ou PRIOR<k> pour une entrée antérieure), et l'EXPRESSION CLÉ : les mots du "
            "prospect, copiés de ce tour source, que le commercial répète. Si le commercial emploie d'autres mots, donne "
            "quand même la source la plus proche et copie exactement les mots du prospect ; c'est le code qui décide "
            "s'ils correspondent. Dis ensuite si la plage se termine par une question sur un nouveau sujet.\n"
            "JSON: {\"clauses\": [{\"component\": \"PROBLEM|COST|A|B\", \"sales_turn\": \"T081\", \"sales_quote\": "
            "\"...\", \"about_prospect\": bool, \"declarative\": bool, \"source_turn\": \"T052\"|null, "
            "\"key_expression\": \"...\"|null, \"as_holding_back\": bool}], \"ends_with_new_topic_question\": bool, "
            "\"new_topic_question_quote\": \"...\"|null}\n\n"
            "ÉNONCÉS DU PROSPECT DÉJÀ EXTRAITS\n" + _afficher_enonces(st) +
            "\n\nTOURS ANTÉRIEURS DU PROSPECT\n" + ctx.afficher(plus_tot) +
            "\n\nPLAGE ET TOUR SUIVANT\n" + ctx.afficher(ctx.tours[lo:hi]))


def valider_restitution(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    a, b = _plage_depuis_uid(ctx, id_unite)
    permis = {t.id for t in ctx.tours[ctx.n(a): ctx.n(b) + 1] if t.role == COMMERCIAL}
    errs = []
    if not isinstance(rep.get("clauses", []), list):
        return ["bad_schema"]
    for c in rep.get("clauses", []):
        if c.get("component") not in COMPOSANTES:
            errs.append("bad_component")
            continue
        if c.get("sales_turn") not in permis:
            errs.append(f"sales_turn_outside_span:{c.get('sales_turn')}")
            continue
        e = citation_ok(ctx, Preuve(c.get("sales_quote", ""), c["sales_turn"], COMMERCIAL), mots_min=2,
                     mots_max=MOTS_MAX_CITATION)
        if e:
            errs.append(f"{e}:{c['sales_turn']}")
        src = c.get("source_turn")
        if src and not str(src).upper().startswith("PRIOR"):
            try:
                ctx.tour(src)
            except KeyError:
                errs.append(f"unknown_turn:{src}")
    if rep.get("ends_with_new_topic_question"):
        q = rep.get("new_topic_question_quote") or ""
        if citation_ok(ctx, Preuve(q, b, COMMERCIAL), mots_min=2, mots_max=MOTS_MAX_CITATION):
            errs.append("bad_new_topic_question_quote")
    return errs


def cle_restitution(rep: dict) -> Any:
    return [sorted((c.get("component"), c.get("sales_turn"), c.get("source_turn") or "",
                    bool(c.get("about_prospect", True)), c.get("declarative", True) is not False,
                    bool(c.get("as_holding_back"))) for c in rep.get("clauses", [])),
            bool(rep.get("ends_with_new_topic_question"))]


def construire_validation(ctx: ContexteAppel, unite: tuple[Restitution, Tour]) -> str:
    r, vt = unite
    lo = ctx.n(r.plage.debut)
    return (f"RESTITUTION : {r.plage.debut} à {r.plage.fin}. TOUR DE VALIDATION : {vt.id}\n"
            "Lis le TOUR DE VALIDATION comme la réponse à la restitution, avec les règles de validation.\n"
            "JSON: {\"outcome\": \"confirmed_with_content|confirmed|corrected|rejected|none\", "
            "\"agreement_quote\": \"...\"|null, \"content_quote\": \"...\"|null, \"content_is_repetition\": bool, "
            "\"corrected_components\": [\"A\"], \"correction_quote\": \"...\"|null, \"emotional_reaction\": bool, "
            "\"disagreement\": bool, \"answers_other_question\": bool, \"addressed_co_decider\": bool}\n\n"
            "TOURS\n" + ctx.afficher(ctx.tours[lo: ctx.n(vt.id) + 1]))


def valider_validation(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    vt = id_unite.split(":")[-1]
    if rep.get("outcome") not in ISSUES:
        return ["bad_outcome"]
    errs = []
    role = ctx.tour(vt).role
    for k in ("agreement_quote", "content_quote", "correction_quote"):
        q = rep.get(k)
        if q:
            e = citation_ok(ctx, Preuve(q, vt, role), mots_min=1, mots_max=MOTS_MAX_CITATION)
            if e:
                errs.append(f"{k}:{e}")
    if rep.get("outcome") == "corrected" and not rep.get("correction_quote"):
        errs.append("correction_quote_missing")
    return errs


def cle_validation(rep: dict) -> Any:
    return [rep.get("outcome"), bool(rep.get("content_quote")), sorted(rep.get("corrected_components", []) or []),
            bool(rep.get("emotional_reaction")), bool(rep.get("disagreement")), bool(rep.get("answers_other_question"))]


def construire_a_actuel(ctx: ContexteAppel, s: Enonce) -> str:
    t = ctx.tour(s.tour)
    q = next((x for x in ctx.sollicitations if x.id == s.sollicitation), None)
    return (f"CHIFFRE DU PROSPECT : \"{s.citation}\" dans {s.tour}\n"
            "Ce chiffre décrit-il là où le prospect en est MAINTENANT (état actuel), et non un état passé "
            "(« avant, je gagnais »), une épargne, un budget, un crédit immobilier ou un solde de dette ?\n"
            "JSON: {\"present_state\": bool, \"quote\": \"mots exacts du tour qui le montrent\"}\n\n"
            + (f"[{q.tour}] SALES: {q.texte}\n" if q else "") + f"[{t.id} {t.ts}] {t.role}: {t.texte}")


def valider_a_actuel(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    if not isinstance(rep.get("present_state"), bool):
        return ["bad_schema"]
    tid = id_unite.split(":")[-1]
    if rep.get("quote"):
        e = citation_ok(ctx, Preuve(rep["quote"], tid, PROSPECT), mots_min=1, mots_max=MOTS_MAX_CITATION)
        return [e] if e else []
    return []


def construire_blocage(ctx: ContexteAppel, q: Sollicitation) -> str:
    return (f"SOLLICITATION DU COMMERCIAL {q.id} dans {q.tour} : \"{q.texte}\"\n"
            "Est-ce une question de blocage : le commercial demande-t-il ce qui arrête le prospect, ce qui l'a retenu, "
            "ce qui se met en travers de son chemin, ou pourquoi il ne l'a pas encore fait ?\n"
            "JSON: {\"is_stopping_question\": bool, \"quote\": \"mots exacts de la question\"|null}")


def valider_blocage(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    if not isinstance(rep.get("is_stopping_question"), bool):
        return ["bad_schema"]
    if rep["is_stopping_question"]:
        tid = id_unite.split(":")[-1]
        e = citation_ok(ctx, Preuve(rep.get("quote") or "", tid, COMMERCIAL), mots_min=2, mots_max=MOTS_MAX_CITATION)
        return [e] if e else []
    return []


def construire_horizon(ctx: ContexteAppel, unite: tuple[Enonce, list[str]]) -> str:
    s, tids = unite
    return (f"CIBLE (point B) : \"{s.citation}\" dans {s.tour}\n"
            "Le prospect a-t-il associé une échéance ou une durée à cette cible, dans la même réponse ou dans une "
            "réponse suivante ci-dessous ? Est-elle contraignante (externe, vérifiable) ou souhaitée ?\n"
            "JSON: {\"horizon_quote\": \"...\"|null, \"horizon_turn\": \"T102\"|null, \"horizon\": "
            "\"mots de l'échéance tels qu'ils ont été dits\"|null, \"binding\": bool|null}\n\n"
            + ctx.afficher([ctx.tour(t) for t in tids]))


def valider_horizon(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    if rep.get("horizon_quote"):
        e = citation_ok(ctx, Preuve(rep["horizon_quote"], rep.get("horizon_turn") or "", PROSPECT), mots_min=1,
                     mots_max=MOTS_MAX_CITATION)
        return [e] if e else []
    return []


RESTITUTION = TacheModele("gap.restitution", "strong", "ecart_restitution", construire_restitution, valider_restitution,
                        cle_restitution)
VALIDATION = TacheModele("gap.validation", "strong", "ecart_validation", construire_validation, valider_validation,
                       cle_validation)
A_ACTUEL = TacheModele("gap.a_current", "fast", "ecart_a_actuel", construire_a_actuel, valider_a_actuel,
                      cle=lambda a: bool(a.get("present_state")))
BLOCAGE = TacheModele("gap.stopping", "fast", "ecart_blocage", construire_blocage, valider_blocage,
                     cle=lambda a: bool(a.get("is_stopping_question")))
HORIZON = TacheModele("gap.horizon", "fast", "ecart_horizon", construire_horizon, valider_horizon,
                    cle=lambda a: [bool(a.get("horizon_quote")), a.get("binding")])


# ------------------------------------------------------------------------------------------- compétence
class CompetenceEcart:
    nom_ = NOM
    version_regles = VERSION_REGLES

    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence:
        res = ResultatCompetence(NOM, VERSION_REGLES)
        ffin = fin_fenetre(ctx)
        concs: list[str] = []
        a_revoir: list[str] = []

        # ---- inventaire des restitutions (code) et propositions du modèle
        st_tous = enonces_depuis_atomes(ctx, ffin)
        plages = self.plages_candidates(ctx)
        rs: list[Restitution] = []
        for sp in plages:
            r = self._executer_plage(ctx, executeur, sp, st_tous, concs, a_revoir)
            rs.append(r)

        # ---- applicabilité (§4)
        if not ctx.phases.debut_decouverte and not any(r.est_restitution for r in rs) and ffin is None:
            res.statut, res.raisons = "not_applicable", ["no_discovery_no_restitution_no_pitch"]
            return res

        # ---- validations (+ candidat après une correction, GB-10 / GB-25)
        i = 0
        while i < len(rs):
            r = rs[i]
            if r.est_restitution:
                self._valider(ctx, executeur, r, concs, a_revoir)
                if r.validation.get("outcome") == "corrected" and r.validation.get("turn"):
                    suiv = self._tour_commercial_suivant(ctx, r.validation["turn"])
                    if suiv and not any(suiv in x.plage.tours for x in rs):
                        sp = construire_plages(ctx, {suiv: ["S4_post_correction"]})[0]
                        rs.insert(i + 1, self._executer_plage(ctx, executeur, sp, st_tous, concs, a_revoir))
            i += 1
        resoudre_corrections(rs)

        # ---- formule de l'écart (GB-28..GB-33), limite = première restitution (ou fin de la fenêtre)
        premier = next((r.plage.debut for r in rs if r.est_restitution and r.avant_presentation), None)
        limite_ = premier or ffin
        st = enonces_depuis_atomes(ctx, limite_)
        absent_ = self._verif_a_present(ctx, executeur, st, limite_, concs)
        A = candidats_a(ctx, st, limite_, absent_)
        B, B_hors = candidats_b(ctx, st, limite_)
        choix_a, choix_b, regle_ab = choisir_a_b(ctx, A, B)
        P = [s for s in st["PROBLEM"] if s.lettre == "P"]
        blocage = self._questions_blocage(ctx, executeur, P, concs)
        atomes_avant = [a for a in ctx.atomes if a.preuve and ctx.avant(a.preuve.tour, limite_)
                        and a.type in ("PAIN", "BLOCKER", "IMPACT")]
        choix_p, regle_p = choisir_p(ctx, P, blocage, atomes_avant)
        horizon = self._horizon(ctx, executeur, choix_b, limite_, concs) if choix_b else None
        blocages = blocages_feuille_route(ctx, ctx.phases.debut_presentation or ffin, choix_p)
        avertir = alerte_copilote(blocages)
        if avertir:
            res.signaux.append("roadmap_insufficient_blockers")              # GB-33

        # ---- porte et items
        verdict, raisons, ok = porte(rs)
        for r in rs:
            r.conformite = conformite_formule(ctx, r, choix_a, choix_b, choix_p) if r.est_restitution else None
        note_ = ok[-1] if ok else None                                    # GB-11 : dernière restitution qui passe
        sol_par_id = {q.id: q for q in ctx.sollicitations}
        pre = [r for r in rs if r.est_restitution and r.avant_presentation]
        diag_r = note_ or (pre[-1] if pre else None)
        items = noter_items(ctx, diag_r, choix_a, choix_b, horizon, choix_p, (diag_r.conformite if diag_r else None),
                            sol_par_id)
        if verdict == "present":
            res.items, res.note = items, note_appel(items)
        else:
            res.note = 0
            res.items = [NoteItem(x.id, x.poids, 0, [], "écart absent (porte d'absence, §5.1)") for x in items]
        res.verdict, res.raisons = verdict, raisons
        pre_en_attente = [u for u in a_revoir if not self._unite_apres_presentation(ctx, u)]
        if verdict == "absent" and pre_en_attente:
            res.statut = "to_review"
            res.signaux.append("units_to_review:" + ",".join(pre_en_attente))
        elif a_revoir:
            res.signaux.append("units_to_review:" + ",".join(a_revoir))
        res.concordance = min(concs, key=lambda c: _rang_conc(c)) if concs else None
        res.details = self._details(ctx, rs, verdict, raisons, note_, diag_r, items, choix_a, choix_b, choix_p, regle_ab,
                                    regle_p, horizon, blocages, avertir, st, B_hors)
        return res

    def plages_candidates(self, ctx: ContexteAppel) -> list[Plage]:
        """Inventaire A1 (code). Le moteur allégé (analyse-appel/allege) y ajoute les passages trouvés par son étape
        du modèle."""
        return inventaire(ctx)

    # ---------------------------------------------------------------- étapes
    def _executer_plage(self, ctx, executeur, sp, st, concs, a_revoir) -> Restitution:
        uid = f"restit:{sp.uid}"
        rr = executeur.executer(ctx, RESTITUTION, uid, (sp, st))
        concs.append(rr.concordance)
        if rr.reponse is None:
            a_revoir.append(uid)
        return decider_restitution(ctx, sp, rr.reponse, rr.statut, rr.concordance)

    def _valider(self, ctx, executeur, r: Restitution, concs, a_revoir) -> None:
        vt, pourquoi = tour_validation(ctx, r)
        if vt is None:
            r.validation = {"outcome": "none", "turn": None, "quote": None, "rule": pourquoi}
            return
        uid = f"valid:{r.plage.uid}:{vt.id}"
        rr = executeur.executer(ctx, VALIDATION, uid, (r, vt))
        concs.append(rr.concordance)
        if rr.reponse is None:
            a_revoir.append(uid)
        r.validation = decider_validation(ctx, r, vt, rr.reponse)

    @staticmethod
    def _tour_commercial_suivant(ctx, tid) -> Optional[str]:
        for t in ctx.tours[ctx.n(tid) + 1:]:
            if t.role == COMMERCIAL and not t.attribution_douteuse:
                return t.id
            if t.role == PROSPECT and not approbation_courte(t.texte):
                return None
        return None

    def _verif_a_present(self, ctx, executeur, st, limite_, concs) -> set[str]:
        """X13 : un candidat A chiffré doit décrire le présent (pas un revenu passé, une épargne, un budget)."""
        sortie = set()
        for s in candidats_a(ctx, st, limite_):
            if not s.quantifie:
                continue
            rr = executeur.executer(ctx, A_ACTUEL, f"acur:{s.id_atome}:{s.tour}", s)
            concs.append(rr.concordance)
            if rr.reponse is not None and rr.reponse.get("present_state") is False:
                sortie.add(s.id_atome)
        return sortie

    def _questions_blocage(self, ctx, executeur, P, concs) -> list[Sollicitation]:
        """GB-30 étape 1 : les sollicitations P qui demandent ce qui arrête le prospect (expression régulière, sinon
        une question fermée au modèle)."""
        ids = {s.sollicitation for s in P}
        sortie = []
        for q in sorted((x for x in ctx.sollicitations if x.lettre == "P" and x.id in ids),
                        key=lambda x: ctx.n(x.tour)):
            if QUESTION_BLOCAGE.search(normaliser(q.texte)):
                sortie.append(q)
                continue
            rr = executeur.executer(ctx, BLOCAGE, f"stop:{q.id}:{q.tour}", q)
            concs.append(rr.concordance)
            if rr.reponse and rr.reponse.get("is_stopping_question"):
                sortie.append(q)
        return sortie

    def _horizon(self, ctx, executeur, b: Enonce, limite_, concs) -> Optional[dict]:
        """GB-29 : horizon dans la même réponse N ou dans une réponse N suivante."""
        tids = [b.tour]
        nq = sorted((q for q in ctx.sollicitations if q.lettre == "N" and ctx.n(q.tour) >= ctx.n(b.tour) - 1),
                    key=lambda q: ctx.n(q.tour))
        for q in nq:
            for t in q.tours_reponse:
                if t not in tids and ctx.n(t) >= ctx.n(b.tour) and ctx.avant(t, limite_):
                    tids.append(t)
        tids = sorted(tids, key=ctx.n)
        rr = executeur.executer(ctx, HORIZON, f"horizon:{b.id_atome}:{b.tour}", (b, tids))
        concs.append(rr.concordance)
        a = rr.reponse or {}
        if not a.get("horizon_quote") or a.get("horizon_turn") not in tids:
            return {"quote": None, "turn": None, "horizon": None, "binding": None}
        return {"quote": a["horizon_quote"], "turn": a["horizon_turn"], "horizon": a.get("horizon"),
                "binding": a.get("binding")}

    @staticmethod
    def _unite_apres_presentation(ctx, uid: str) -> bool:
        parties = uid.split(":")
        if parties[0] not in ("restit", "valid"):
            return False
        ffin = fin_fenetre(ctx)
        try:
            return ffin is not None and not ctx.avant(parties[2], ffin)
        except KeyError:
            return False

    # ---------------------------------------------------------------- sortie
    def _details(self, ctx, rs, verdict, raisons, note_, diag_r, items, choix_a, choix_b, choix_p, regle_ab, regle_p,
                 horizon, blocages, avertir, st, B_hors) -> dict:
        meme_unite = bool(choix_a and choix_b and choix_a.quantifie and choix_b.quantifie and
                         _unite(choix_a.unite) == _unite(choix_b.unite))
        valeur_ecart = (choix_b.valeur - choix_a.valeur) if meme_unite and choix_a.valeur is not None and \
            choix_b.valeur is not None else None
        sa = choix_a.vers_dict() if choix_a else None
        sb = dict(choix_b.vers_dict(), horizon=(horizon or {}).get("horizon") or (horizon or {}).get("quote"),
                  binding=(horizon or {}).get("binding"), same_unit=meme_unite) if choix_b else None
        sp = {"quote": choix_p.citation, "turn": choix_p.tour, "object": choix_p.objet, "rule": regle_p,
              "solicitation": choix_p.lettre} if choix_p else None
        p_valide_ = None
        if note_ is not None:
            pprop = [c for c in note_.propositions if c.composante == "PROBLEM" and c.correspondance == "verbatim"]
            choisir = next((c for c in pprop if _correspond(c, choix_p)), pprop[0] if pprop else None)
            if choisir:
                p_valide_ = {"quote": choisir.citation_source, "turn": choisir.tour_source,
                               "key_expression": choisir.expression_cle}
        cout = [{"domain": s.domaine, "quantified": s.quantifie, "quote": s.citation, "turn": s.tour}
                for s in st["COST"]]
        reste_hors = []
        for r in rs:
            reste_hors.append({
                "span": [r.plage.debut, r.plage.fin], "turns": r.plage.tours, "signals": r.plage.signaux_,
                "model_status": r.statut, "concordance": r.concordance, "is_restitution": r.est_restitution,
                "before_first_pitch": not r.apres_presentation, "before_first_price": not r.apres_prix,
                "components": {comp: next(({"source": c.tour_source, "key_expression": c.expression_cle,
                                            "match": c.correspondance, "explicit_quote": c.citation_explicite}
                                           for c in r.propositions if c.composante == comp and c.correspondance == "verbatim"),
                                          next(({"source": c.tour_source, "key_expression": c.expression_cle,
                                                 "match": c.correspondance} for c in r.propositions if c.composante == comp),
                                               None)) for comp in COMPOSANTES},
                "clauses": [c.vers_dict() for c in r.propositions],
                "paraphrased_component": [c.vers_dict() for c in r.propositions if c.correspondance in ("paraphrased", "untraced")],
                "validation": r.validation, "effective_outcome": r.issue_effective,
                "restates_correction_of": r.reformule_correction_de,
                "conformity": r.conformite})
        principal = note_ or diag_r
        minutage_ = self._minutage_(ctx, principal) if principal else {}
        pre = [r for r in rs if r.est_restitution and r.avant_presentation]
        devs = [d for r in pre for d in ((r.conformite or {}).get("deviations", []))]
        return {
            "verdict": verdict,
            "absence_reason": raisons[0] if raisons else None,
            "absence_reasons": raisons,
            "validation_turn": note_.validation.get("turn") if note_ else None,
            "restitution_span": [note_.plage.debut, note_.plage.fin] if note_ else None,
            "selected_A": sa, "selected_B": sb, "selected_P": sp, "validated_P": p_valide_,
            "roadmap_blockers": blocages, "cost": cout,
            "gap": {"A": sa, "B": sb, "gap_value": valeur_ecart,
                    "problem": [{"type": None, "quote": s.citation, "turn": s.tour, "object": s.objet}
                                for s in st["PROBLEM"]],
                    "cost": cout},
            "restitutions": reste_hors,
            "restitution": next((x for x, r in zip(reste_hors, rs) if r is principal), None),
            "formula": {"selected_A": sa, "selected_B": sb, "selected_P": sp, "rule_AB": regle_ab,
                        "conformity": principal.conformite if principal else None,
                        "B_outside_N": [s.vers_dict() for s in B_hors]},
            "roadmap": {"blockers": blocages, "count": len(blocages), "warning": avertir,
                        "steps": ETAPES_FEUILLE_ROUTE},
            "diagnostic_items": [{"id": x.id, "level": x.niveau, "note": x.remarque} for x in items],
            "diagnostics": {
                "collected_not_formalised": {c: bool(st[c]) for c in COMPOSANTES} if verdict == "absent" else None,
                "gap_value": valeur_ecart, "gap_unit": choix_a.unite if meme_unite else None,
                "binding_horizon": (horizon or {}).get("binding"),
                "timing": minutage_,
                "corrections": [{"span": [r.plage.debut, r.plage.fin], "effective": r.issue_effective}
                                for r in rs if r.validation.get("outcome") == "corrected"],
                "formula_deviations": devs,
                "roadmap_material": len(blocages),
            },
        }

    @staticmethod
    def _minutage_(ctx, r: Restitution) -> dict:
        debut = _secondes_ts(ctx.tour(r.plage.debut).ts)
        qs = [q for q in ctx.sollicitations if q.lettre in ("S", "P", "I", "N") and ctx.avant(q.tour, r.plage.debut)]
        derniere_q = max(qs, key=lambda q: ctx.n(q.tour)) if qs else None
        sortie = {"last_discovery_question": derniere_q.tour if derniere_q else None, "min_since_last_question": None,
               "min_validation_to_pitch": None}
        if derniere_q and debut is not None and _secondes_ts(ctx.tour(derniere_q.tour).ts) is not None:
            sortie["min_since_last_question"] = round((debut - _secondes_ts(ctx.tour(derniere_q.tour).ts)) / 60, 1)
        vt, ffin = r.validation.get("turn"), fin_fenetre(ctx)
        if vt and ffin:
            a, b = _secondes_ts(ctx.tour(vt).ts), _secondes_ts(ctx.tour(ffin).ts)
            if a is not None and b is not None:
                sortie["min_validation_to_pitch"] = round((b - a) / 60, 1)
        return sortie


def _rang_conc(c: str) -> float:
    try:
        a, b = c.split("/")
        return int(a) / int(b)
    except (ValueError, ZeroDivisionError):
        return 0.0

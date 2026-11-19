"""Shared data model of the LNP call analysis engine.

Every object that carries a claim about the transcript carries its Evidence
(exact quote + turn). Competence modules read and write the CallContext only.
"""
from __future__ import annotations

from dataclasses import dataclass, field, fields, is_dataclass
from typing import Any, Optional

COMMERCIAL, PROSPECT, AUTRE = "SALES", "PROSPECT", "OTHER"


# Format enregistré (docs/OUTPUT_CONTRACT.md) : l'analyse stockée, lue par l'écran, la base et le connecteur, garde ses clés
# d'origine. Les champs des objets du moteur ont des noms français ; vers_dict les écrit sous leur clé enregistrée.
CHAMPS_ENREGISTRES = {
    "approfondi": "followed_up",
    "apres_presentation": "after_pitch",
    "apres_prix": "after_price",
    "atome_source": "source_atom",
    "atomes": "atoms",
    "attribution_douteuse": "attribution_doubtful",
    "bibliotheque_cas": "case_library",
    "blocage": "stopping",
    "brut": "raw",
    "changement_sujet": "topic_change",
    "citation": "quote",
    "citation_commercial": "sales_quote",
    "citation_explicite": "explicit_quote",
    "citation_source": "source_quote",
    "cle": "key",
    "comme_frein": "as_holding_back",
    "composante": "component",
    "conformite": "conformity",
    "construire": "build",
    "correspondance": "match",
    "coupure_offre": "offer_cut",
    "dans_perimetre": "in_perimeter",
    "debut": "start",
    "debut_decouverte": "discovery_start",
    "debut_presentation": "pitch_start",
    "debut_utc": "start_utc",
    "demande_": "request",
    "demande_decision": "decision_request",
    "dernier": "last",
    "domaine": "domain",
    "entrees_anterieures": "prior_inputs",
    "erreur": "error",
    "est_restitution": "is_restitution",
    "etiquettes": "tags",
    "expression_cle": "key_expression",
    "faits": "facts",
    "fin": "end",
    "fin_decouverte": "discovery_end",
    "fin_fenetre": "window_end",
    "fin_presentation": "pitch_end",
    "fuseau": "timezone",
    "garder": "keep",
    "graine": "seed",
    "id_appel": "call_id",
    "id_atome": "atom_id",
    "id_commercial": "sales_id",
    "id_sol": "sol_id",
    "id_sollicitation": "solicitation_id",
    "issue_effective": "effective_outcome",
    "lectures_": "readings",
    "lettre": "letter",
    "libelle_cas": "case_label",
    "locuteur": "speaker",
    "mentions_offre": "offer_mentions",
    "niveau": "level",
    "note": "score",
    "objet": "object",
    "palier": "tier",
    "parties": "parts",
    "passe_unique_permise": "single_pass_allowed",
    "passes_paralleles": "parallel_passes",
    "plage": "span",
    "poids": "weight",
    "porte": "gate",
    "portes_": "gates",
    "preambule": "preamble",
    "prefixe": "prefix",
    "premier_prix": "first_price",
    "preuve": "evidence",
    "preuve_invalide": "invalid_proof",
    "prix_precoce": "early_price",
    "propositions": "clauses",
    "prospect_prec": "prev_prospect",
    "quantifie": "quantified",
    "question_nouveau_sujet": "new_topic_question",
    "raison": "reason",
    "raison_arret": "stop_reason",
    "raison_fin": "end_reason",
    "raison_hors": "out_reason",
    "raisons": "reasons",
    "rang": "rank",
    "recurrence_de": "recurrence_of",
    "reference_offre": "offer_reference",
    "reformule_correction_de": "restates_correction_of",
    "regle_latente": "latent_rule",
    "regles": "rules",
    "remarque": "note",
    "reouverture": "reopening",
    "repare": "repaired",
    "repetitions": "repeats",
    "reponse": "answer",
    "reponse_com": "response",
    "resultats": "results",
    "revient_plus_tard": "recurs_later",
    "sans_reponse": "unanswered",
    "signaux": "flags",
    "signaux_": "signals",
    "sollicitation": "solicitation",
    "sollicitations": "solicitations",
    "sous_type": "subtype",
    "spontane": "volunteered",
    "statut": "status",
    "suggere_par_commercial": "prompted_by_sales",
    "suit_prec": "follows_prev",
    "systeme": "system",
    "taux_echantillon": "sample_rate",
    "texte": "text",
    "texte_reponse": "answer_text",
    "total_dans_tour": "total_in_turn",
    "tour": "turn",
    "tour_commercial": "sales_turn",
    "tour_fin": "end_turn",
    "tour_source": "source_turn",
    "tours": "turns",
    "tours_reponse": "answer_turns",
    "tours_spontanes": "volunteered_turns",
    "type_atome": "atom_type",
    "type_chiffre": "figure_kind",
    "unite": "unit",
    "valeur": "value",
    "valider": "validate",
    "version_regles": "rules_version",
}


def vers_dict(obj: Any) -> Any:
    """Un objet du moteur (dataclass), une liste ou un dictionnaire, au format enregistré : chaque champ sous sa clé
    enregistrée ; les clés des dictionnaires, déjà au format enregistré, ne changent pas."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return {CHAMPS_ENREGISTRES.get(f.name, f.name): vers_dict(getattr(obj, f.name)) for f in fields(obj)}
    if isinstance(obj, dict):
        return {k: vers_dict(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return type(obj)(vers_dict(v) for v in obj)
    return obj


@dataclass
class Tour:
    id: str                 # "T001"
    n: int                  # 1
    ts: str                 # "mm:ss" or "h:mm:ss"
    locuteur: str            # raw label
    role: str               # SALES / PROSPECT / OTHER
    texte: str
    attribution_douteuse: bool = False
    repare: bool = False


@dataclass
class Preuve:
    citation: str
    tour: str
    role: Optional[str] = None      # expected role of the speaker, checked by code

    def vers_dict(self) -> dict:
        return vers_dict(self)


@dataclass
class CartePhases:
    debut_decouverte: Optional[str] = None
    fin_decouverte: Optional[str] = None
    debut_presentation: Optional[str] = None
    premier_prix: Optional[str] = None
    demande_decision: Optional[str] = None
    fin_presentation: Optional[str] = None
    mentions_offre: list[str] = field(default_factory=list)
    prix_precoce: Optional[str] = None
    preuve: dict[str, Preuve] = field(default_factory=dict)
    signaux: list[str] = field(default_factory=list)


@dataclass
class Sollicitation:
    """A sales solicitation (SPIN bounding reference, SEG-1..8)."""
    id: str
    tour: str
    texte: str
    lettre: Optional[str] = None      # S / P / I / N / OUT
    raison_hors: Optional[str] = None  # nothing, info_solution, solution_load, sales_list, agreement, absent
    etiquettes: list[str] = field(default_factory=list)
    tours_reponse: list[str] = field(default_factory=list)
    approfondi: bool = False
    statut: str = "pending"           # verified / arbitrated / to_review


@dataclass
class Atome:
    """A prospect atom (SPIN annex A3): SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE."""
    id: str
    type: str
    preuve: Preuve
    id_sollicitation: Optional[str] = None   # the solicitation whose answer contains it
    lettre: Optional[str] = None            # letter of that solicitation
    objet: Optional[str] = None            # object label (SB-16)
    domaine: Optional[str] = None            # money, time, clients, family, health, self-belief, future
    quantifie: bool = False
    valeur: Optional[float] = None
    unite: Optional[str] = None
    spontane: bool = False
    suggere_par_commercial: bool = False


@dataclass
class NoteItem:
    id: str
    poids: float
    niveau: Optional[int]                     # 0, 1, 2 or None (not applicable)
    preuve: list[Preuve] = field(default_factory=list)
    remarque: str = ""


@dataclass
class ResultatCompetence:
    competence: str
    version_regles: str
    statut: str = "scored"                   # scored / not_applicable / excluded / to_review
    verdict: Optional[str] = None            # e.g. present / absent / compliant / non_compliant
    raisons: list[str] = field(default_factory=list)
    note: Optional[int] = None
    items: list[NoteItem] = field(default_factory=list)
    signaux: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)
    concordance: Optional[str] = None

    def vers_dict(self) -> dict:
        d = vers_dict(self)
        return d


@dataclass
class ContexteAppel:
    id_appel: str
    id_commercial: str
    debut_utc: str
    fuseau: str
    tours: list[Tour]
    reference_offre: dict[str, Any] = field(default_factory=dict)
    bibliotheque_cas: list[dict[str, Any]] = field(default_factory=list)
    entrees_anterieures: list[dict[str, Any]] = field(default_factory=list)   # form text, earlier calls of the cycle
    statut: str = "ok"                       # ok / no_transcript / no_diarization / diarization_suspect
    signaux: list[str] = field(default_factory=list)
    phases: CartePhases = field(default_factory=CartePhases)
    sollicitations: list[Sollicitation] = field(default_factory=list)
    atomes: list[Atome] = field(default_factory=list)
    resultats: dict[str, ResultatCompetence] = field(default_factory=dict)
    audit: list[dict[str, Any]] = field(default_factory=list)          # every model pass, arbitration, error

    # ---- helpers -------------------------------------------------------------
    def tour(self, tid: str) -> Tour:
        return self._indexer()[tid]

    def _indexer(self) -> dict[str, Tour]:
        cle = tuple(t.id for t in self.tours)
        if getattr(self, "_cle_idx", None) != cle:
            self._idx = {t.id: t for t in self.tours}
            self._pos = {t.id: i for i, t in enumerate(self.tours)}
            self._cle_idx = cle
        return self._idx

    def n(self, tid: Optional[str]) -> Optional[int]:
        """Position of a turn in the (repaired) transcript; repaired sub-turns ("T050b") sort right after."""
        if tid is None:
            return None
        self._indexer()
        return self._pos[tid]

    def avant(self, a: Optional[str], b: Optional[str]) -> bool:
        """True if turn a is strictly before turn b (b None = end of call)."""
        if a is None:
            return False
        return b is None or self.n(a) < self.n(b)

    def fenetre(self, debut: Optional[str], fin: Optional[str]) -> list[Tour]:
        s = self.n(debut) if debut else 0
        e = self.n(fin) if fin else len(self.tours)
        return self.tours[s:e]

    def afficher(self, tours: Optional[list[Tour]] = None) -> str:
        """Compact transcript fed to the model: one line per turn."""
        tours = self.tours if tours is None else tours
        return "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.texte}" for t in tours if not t.attribution_douteuse)

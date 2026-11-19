"""LNP lead qualification agent (« Qualification SQL des appels LNP » version 2, 4 November 2026; rules version 2.1 of
5 November 2026: any Éducation nationale teacher, a student who already sells lessons, « solution aware » leads; rules
2.2, same day: the « Douleur et projet » gate is removed, three gates).

Step 1: the model reads the Fathom transcript of an R1 and extracts facts (prompts/extraction.md, kept as written in the
document), twice (double reading). Step 2: qualification_lnp.py applies the four-gate rule to those facts and decides.

The model extracts, the code decides. On top of the document, the code checks every piece of evidence: a fact whose
« preuve » is not a passage of the transcript (after spaces, case and punctuation are normalised) is set back to
« inconnu » (a resource without evidence is dropped), so a gate never opens on an invented quote. Each such case is
listed in `verification`.
"""
from __future__ import annotations

import difflib
import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any, Optional

from qualification_lnp import PARAMS, qualifier

ICI = Path(__file__).resolve().parent
VERSION_CONSIGNES = "lnp-sql-v2.2-2026-11-05"
VERSION_REGLES = "qualification_lnp-v2.2"
DOMAINE_COMMERCIAL = "@lesnouveauxprofs.fr"


def charger_consigne() -> str:
    return (ICI / "consignes" / "extraction.md").read_text(encoding="utf-8")


# ------------------------------------------------------------------------------------------------ transcript
def _minutage(ts: str) -> str:
    """Fathom "HH:MM:SS" → "mm:ss" (minutes past 59 are kept: "01:02:10" → "62:10")."""
    m = re.match(r"^(\d+):(\d{2}):(\d{2})", str(ts or ""))
    if not m:
        m2 = re.match(r"^(\d+):(\d{2})$", str(ts or ""))
        return f"{int(m2.group(1)):02d}:{m2.group(2)}" if m2 else ""
    return f"{int(m.group(1)) * 60 + int(m.group(2)):02d}:{m.group(3)}"


def afficher_transcription(paroles: Any, enregistre_par: Optional[str] = None) -> str:
    """One line per speaker turn: "[mm:ss] SALES (name): text" or "[mm:ss] PROSPECT (name): text"."""
    if isinstance(paroles, str):
        try:
            paroles = json.loads(paroles)
        except ValueError:
            return paroles
    lignes: list[list[str]] = []
    enr = (enregistre_par or "").lower()
    for u in paroles or []:
        if not isinstance(u, dict):
            continue
        texte = str(u.get("text") or "").strip()
        if not texte:
            continue
        sp = u.get("speaker") or {}
        email = str(sp.get("matched_calendar_invitee_email") or "").lower()
        nom_ = str(sp.get("display_name") or "").strip()
        role = "SALES" if (email.endswith(DOMAINE_COMMERCIAL) or (enr and email == enr) or "nouveaux profs" in nom_.lower()) \
            else "PROSPECT"
        tete = f"{role} ({nom_})" if nom_ else role
        if lignes and lignes[-1][1] == tete:
            lignes[-1][2] += " " + texte
        else:
            lignes.append([_minutage(u.get("timestamp")), tete, texte])
    return "\n".join(f"[{m}] {h}: {t}" for m, h, t in lignes)


def remplir_consigne(gabarit: str, date_appel: str, fathom: str, analyse: str = "") -> str:
    """The transcript itself goes in the cached prefix (same for both readings); the prompt points to it."""
    return (gabarit.replace("{{date_appel}}", date_appel).replace("{{oui_ou_non}}", fathom)
            .replace("{{transcription}}", "(la transcription est donnée plus haut, entre <transcription> et </transcription>)")
            .replace("{{analyse}}", analyse or "aucune"))


# ------------------------------------------------------------------------------------------------ evidence check
def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s or "")).lower().replace("’", "'")
    s = re.sub(r"[^\w']+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


PART_MIN_CITATION = 0.8      # share of the quote's words found in order at one place of the transcript (engineering value)


def _partie_trouvee(partie: str, transcription_norm: str) -> bool:
    """A passage of the transcript, word for word, or with small corrections: the model writes « il y a » where Fathom
    transcribed « il y », drops an « en fait »... At least QUOTE_MIN_SHARE of its words, in order, in one window of the
    transcript of about its length. A quote that is not there at all never passes."""
    p = _norm(partie)
    if not p:
        return True
    if p in transcription_norm:
        return True
    q = p.split()
    if len(q) < 3:
        return False
    t = transcription_norm.split()
    ancres = sorted(set(q), key=lambda w: (-len(w), w))[:3]
    n = len(q)
    for w in ancres:
        o = q.index(w)
        for i, x in enumerate(t):
            if x != w:
                continue
            fen = t[max(0, i - o - 4): i - o + n + 4]
            m = sum(b.size for b in difflib.SequenceMatcher(None, q, fen, autojunk=False).get_matching_blocks())
            if m >= PART_MIN_CITATION * n:
                return True
    return False


def citation_trouvee(citation: str, transcription_norm: str) -> bool:
    """Every part of the quote (parts cut on "...", "…" or " / ") is a passage of the transcript."""
    parties = [p for p in re.split(r"\.\.\.|…|\s/\s|\[|\]", str(citation or "")) if _norm(p)]
    return bool(parties) and all(_partie_trouvee(p, transcription_norm) for p in parties)


def verifier(faits: dict, transcription: str) -> tuple[dict, list[str]]:
    """Facts whose evidence is not in the transcript go back to « inconnu » (resources are dropped)."""
    tn, remarques = _norm(transcription), []
    f = json.loads(json.dumps(faits))                      # a copy

    def parcourir(noeud: Any, chemin: str) -> None:
        if isinstance(noeud, dict):
            if "preuve" in noeud and noeud.get("preuve") and not citation_trouvee(noeud["preuve"], tn):
                remarques.append(f"{chemin}: preuve introuvable dans la transcription")
                if "valeur" in noeud:
                    noeud["valeur"] = "inconnu" if not isinstance(noeud.get("valeur"), (int, float)) else None
                for k in ("type",):
                    if k in noeud and chemin.split(".")[-1] in ("echeance", "demarrage"):
                        noeud[k] = "absente" if chemin.endswith("echeance") else "absent"
                if chemin.endswith("second_rdv"):
                    noeud["date"] = None
                if chemin.endswith("relance"):
                    noeud["date"] = None
                noeud["preuve_non_trouvee"] = True
            for k, x in list(noeud.items()):
                parcourir(x, f"{chemin}.{k}" if chemin else k)
        elif isinstance(noeud, list):
            for i, x in enumerate(noeud):
                parcourir(x, f"{chemin}[{i}]")

    parcourir(f, "")
    res = (f.get("financement") or {}).get("ressources_citees") or []
    garde = []
    for r in res:
        if isinstance(r, dict) and r.get("type") and r.get("preuve") and r.get("preuve_non_trouvee"):
            continue                                       # a resource without a real quote does not count
        garde.append(r)
    if isinstance(f.get("financement"), dict):
        f["financement"]["ressources_citees"] = garde
    return f, remarques


# ------------------------------------------------------------------------------------------------ model
def lire_json(texte: str) -> Optional[dict]:
    t = (texte or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    a, b = t.find("{"), t.rfind("}")
    if a < 0 or b <= a:
        return None
    try:
        sortie = json.loads(t[a:b + 1])
    except ValueError:
        return None
    return sortie if isinstance(sortie, dict) else None


def lire_une_fois(client: Any, palier: str, transcription: str, consigne: str, unite: str, max_tokens: int = 8000) -> Optional[dict]:
    """One extraction; an answer that is not JSON is asked once more."""
    prefixe = f"<transcription>\n{transcription}\n</transcription>"
    systeme = "Tu extrais des faits d'une transcription d'appel et tu réponds uniquement par du JSON valide."
    for essai in (1, 2):
        sortie = client.completer("qualif.extraction", f"{unite}:{essai}", palier, systeme, prefixe, consigne,
                              max_tokens=max_tokens, effort="low")
        faits = lire_json(sortie.get("text") or "")
        if faits is not None:
            return faits
    return None


# ------------------------------------------------------------------------------------------------ one call
def saisie_depuis_iclosed(issue: Optional[str], raison: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """What the sales entered in iClosed, in the words of the BASE (for the « Écart avec la saisie » alert)."""
    o, r = (issue or "").upper(), (raison or "").upper()
    if o == "WON":
        return "Closé", None
    if r in ("UNQUALIFIED", "BAD_FIT"):
        return "Pas pitché", "Pas qualifié"
    if r == "NOT_INTERESTED":
        return "Non closé", "Perdu"
    if r == "FOLLOW_UP_SCHEDULE":
        return "Non closé", "FUP court"
    return None, None


def qualifier_appel(appel_: dict, client: Any, paliers: tuple[str, str] = ("fast", "strong")) -> dict:
    """call: {call_id, date_appel (YYYY-MM-DD), transcript (Fathom utterances or None), recorded_by, saisie: {outcome,
    no_sale_reason}}. Returns {status, result, readings, verification, prompt_version, rules_version}."""
    d = date.fromisoformat(str(appel_.get("date_appel"))[:10]) if appel_.get("date_appel") else date.today()
    probleme, issue = saisie_depuis_iclosed((appel_.get("saisie") or {}).get("outcome"),
                                         (appel_.get("saisie") or {}).get("no_sale_reason"))
    base = {"prompt_version": VERSION_CONSIGNES, "rules_version": VERSION_REGLES, "params": PARAMS}
    texte = afficher_transcription(appel_.get("transcript"), appel_.get("recorded_by")) if appel_.get("transcript") else ""
    if not texte:
        bouchon = {"meta": {"date_appel": d.isoformat(), "enregistrement_fathom": "non"}}
        res = qualifier([bouchon], d, "non", probleme, issue)
        return dict(base, status=res["statut"], result=res, readings=[], verification=[])
    consigne = remplir_consigne(charger_consigne(), d.isoformat(), "oui")
    lectures_, remarques = [], []
    for i, palier in enumerate(paliers, 1):
        faits = lire_une_fois(client, palier, texte, consigne, f"{appel_.get('call_id')}:{i}")
        if faits is None:
            remarques.append(f"lecture {i} : réponse illisible")
            continue
        faits.setdefault("meta", {})
        faits["meta"].update({"date_appel": d.isoformat(), "enregistrement_fathom": "oui"})
        verifie, n = verifier(faits, texte)
        lectures_.append(verifie)
        remarques += [f"lecture {i} : {x}" for x in n]
    if not lectures_:
        return dict(base, status="À REVOIR", result={"statut": "À REVOIR", "alertes": remarques, "portes": {}, "base": {}},
                    readings=[], verification=remarques)
    res = qualifier(lectures_, d, "oui", probleme, issue)
    if len(lectures_) < 2:
        res["alertes"].append("Une seule lecture valide : pas de double lecture")
    return dict(base, status=res["statut"], result=res, readings=lectures_, verification=remarques)

"""LNP lead qualification agent (document « Qualification SQL des appels LNP — version 2 », 4 November 2026).

Step 1: the model reads the Fathom transcript of an R1 and extracts facts (prompts/extraction.md, kept as written in the
document), twice (double reading). Step 2: qualification_lnp.py applies the four-gate rule to those facts and decides.

The model extracts, the code decides. On top of the document, the code checks every piece of evidence: a fact whose
« preuve » is not a passage of the transcript (after spaces, case and punctuation are normalised) is set back to
« inconnu » (a resource without evidence is dropped), so a gate never opens on an invented quote. Each such case is
listed in `verification`.
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any, Optional

from qualification_lnp import PARAMS, qualifier

HERE = Path(__file__).resolve().parent
PROMPT_VERSION = "lnp-sql-v2-2026-11-04"
RULES_VERSION = "qualification_lnp-v2"
SALES_DOMAIN = "@lesnouveauxprofs.fr"


def load_prompt() -> str:
    return (HERE / "prompts" / "extraction.md").read_text(encoding="utf-8")


# ------------------------------------------------------------------------------------------------ transcript
def _minutage(ts: str) -> str:
    """Fathom "HH:MM:SS" → "mm:ss" (minutes past 59 are kept: "01:02:10" → "62:10")."""
    m = re.match(r"^(\d+):(\d{2}):(\d{2})", str(ts or ""))
    if not m:
        m2 = re.match(r"^(\d+):(\d{2})$", str(ts or ""))
        return f"{int(m2.group(1)):02d}:{m2.group(2)}" if m2 else ""
    return f"{int(m.group(1)) * 60 + int(m.group(2)):02d}:{m.group(3)}"


def render_transcript(utterances: Any, recorded_by: Optional[str] = None) -> str:
    """One line per speaker turn: "[mm:ss] SALES (name): text" or "[mm:ss] PROSPECT (name): text"."""
    if isinstance(utterances, str):
        try:
            utterances = json.loads(utterances)
        except ValueError:
            return utterances
    lines: list[list[str]] = []
    rec = (recorded_by or "").lower()
    for u in utterances or []:
        if not isinstance(u, dict):
            continue
        text = str(u.get("text") or "").strip()
        if not text:
            continue
        sp = u.get("speaker") or {}
        email = str(sp.get("matched_calendar_invitee_email") or "").lower()
        name = str(sp.get("display_name") or "").strip()
        role = "SALES" if (email.endswith(SALES_DOMAIN) or (rec and email == rec) or "nouveaux profs" in name.lower()) \
            else "PROSPECT"
        head = f"{role} ({name})" if name else role
        if lines and lines[-1][1] == head:
            lines[-1][2] += " " + text
        else:
            lines.append([_minutage(u.get("timestamp")), head, text])
    return "\n".join(f"[{m}] {h}: {t}" for m, h, t in lines)


def fill_prompt(template: str, date_appel: str, fathom: str, analyse: str = "") -> str:
    """The transcript itself goes in the cached prefix (same for both readings); the prompt points to it."""
    return (template.replace("{{date_appel}}", date_appel).replace("{{oui_ou_non}}", fathom)
            .replace("{{transcription}}", "(la transcription est donnée plus haut, entre <transcription> et </transcription>)")
            .replace("{{analyse}}", analyse or "aucune"))


# ------------------------------------------------------------------------------------------------ evidence check
def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s or "")).lower().replace("’", "'")
    s = re.sub(r"[^\w']+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def quote_found(quote: str, transcript_norm: str) -> bool:
    """Every part of the quote (parts cut on "...", "…" or " / ") is a passage of the transcript."""
    parts = [p for p in re.split(r"\.\.\.|…|\s/\s|\[|\]", str(quote or "")) if _norm(p)]
    return bool(parts) and all(_norm(p) in transcript_norm for p in parts)


def verify(facts: dict, transcript: str) -> tuple[dict, list[str]]:
    """Facts whose evidence is not in the transcript go back to « inconnu » (resources are dropped)."""
    tn, notes = _norm(transcript), []
    f = json.loads(json.dumps(facts))                      # a copy

    def walk(node: Any, path: str) -> None:
        if isinstance(node, dict):
            if "preuve" in node and node.get("preuve") and not quote_found(node["preuve"], tn):
                notes.append(f"{path}: preuve introuvable dans la transcription")
                if "valeur" in node:
                    node["valeur"] = "inconnu" if not isinstance(node.get("valeur"), (int, float)) else None
                for k in ("type",):
                    if k in node and path.split(".")[-1] in ("echeance", "demarrage"):
                        node[k] = "absente" if path.endswith("echeance") else "absent"
                if path.endswith("second_rdv"):
                    node["date"] = None
                if path.endswith("relance"):
                    node["date"] = None
                node["preuve_non_trouvee"] = True
            for k, x in list(node.items()):
                walk(x, f"{path}.{k}" if path else k)
        elif isinstance(node, list):
            for i, x in enumerate(node):
                walk(x, f"{path}[{i}]")

    walk(f, "")
    res = (f.get("financement") or {}).get("ressources_citees") or []
    kept = []
    for r in res:
        if isinstance(r, dict) and r.get("type") and r.get("preuve") and r.get("preuve_non_trouvee"):
            continue                                       # a resource without a real quote does not count
        kept.append(r)
    if isinstance(f.get("financement"), dict):
        f["financement"]["ressources_citees"] = kept
    return f, notes


# ------------------------------------------------------------------------------------------------ model
def parse_json(text: str) -> Optional[dict]:
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    a, b = t.find("{"), t.rfind("}")
    if a < 0 or b <= a:
        return None
    try:
        out = json.loads(t[a:b + 1])
    except ValueError:
        return None
    return out if isinstance(out, dict) else None


def read_once(client: Any, tier: str, transcript: str, prompt: str, unit: str, max_tokens: int = 8000) -> Optional[dict]:
    """One extraction; an answer that is not JSON is asked once more."""
    prefix = f"<transcription>\n{transcript}\n</transcription>"
    system = "Tu extrais des faits d'une transcription d'appel et tu réponds uniquement par du JSON valide."
    for attempt in (1, 2):
        out = client.complete("qualif.extraction", f"{unit}:{attempt}", tier, system, prefix, prompt,
                              max_tokens=max_tokens, effort="low")
        facts = parse_json(out.get("text") or "")
        if facts is not None:
            return facts
    return None


# ------------------------------------------------------------------------------------------------ one call
def saisie_from_iclosed(outcome: Optional[str], reason: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """What the sales entered in iClosed, in the words of the BASE (for the « Écart avec la saisie » alert)."""
    o, r = (outcome or "").upper(), (reason or "").upper()
    if o == "WON":
        return "Closé", None
    if r in ("UNQUALIFIED", "BAD_FIT"):
        return "Pas pitché", "Pas qualifié"
    if r == "NOT_INTERESTED":
        return "Non closé", "Perdu"
    if r == "FOLLOW_UP_SCHEDULE":
        return "Non closé", "FUP court"
    return None, None


def qualify_call(call: dict, client: Any, tiers: tuple[str, str] = ("fast", "strong")) -> dict:
    """call: {call_id, date_appel (YYYY-MM-DD), transcript (Fathom utterances or None), recorded_by, saisie: {outcome,
    no_sale_reason}}. Returns {status, result, readings, verification, prompt_version, rules_version}."""
    d = date.fromisoformat(str(call.get("date_appel"))[:10]) if call.get("date_appel") else date.today()
    issue, outcome = saisie_from_iclosed((call.get("saisie") or {}).get("outcome"),
                                         (call.get("saisie") or {}).get("no_sale_reason"))
    base = {"prompt_version": PROMPT_VERSION, "rules_version": RULES_VERSION, "params": PARAMS}
    text = render_transcript(call.get("transcript"), call.get("recorded_by")) if call.get("transcript") else ""
    if not text:
        stub = {"meta": {"date_appel": d.isoformat(), "enregistrement_fathom": "non"}}
        res = qualifier([stub], d, "non", issue, outcome)
        return dict(base, status=res["statut"], result=res, readings=[], verification=[])
    prompt = fill_prompt(load_prompt(), d.isoformat(), "oui")
    readings, notes = [], []
    for i, tier in enumerate(tiers, 1):
        facts = read_once(client, tier, text, prompt, f"{call.get('call_id')}:{i}")
        if facts is None:
            notes.append(f"lecture {i} : réponse illisible")
            continue
        facts.setdefault("meta", {})
        facts["meta"].update({"date_appel": d.isoformat(), "enregistrement_fathom": "oui"})
        checked, n = verify(facts, text)
        readings.append(checked)
        notes += [f"lecture {i} : {x}" for x in n]
    if not readings:
        return dict(base, status="À REVOIR", result={"statut": "À REVOIR", "alertes": notes, "portes": {}, "base": {}},
                    readings=[], verification=notes)
    res = qualifier(readings, d, "oui", issue, outcome)
    if len(readings) < 2:
        res["alertes"].append("Une seule lecture valide : pas de double lecture")
    return dict(base, status=res["statut"], result=res, readings=readings, verification=notes)

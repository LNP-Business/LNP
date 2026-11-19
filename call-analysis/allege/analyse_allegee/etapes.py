"""One model call per step, through the gateway (callqa-llm): the transcript is a cached prefix shared by the steps.

The client is anything with `complete(task_id, unit_id, tier, system, prefix, prompt, max_tokens, effort)` returning
{"text", "stop_reason"} (callqa_worker.gateway.GatewayClient.complete, or the MockLiteClient of the tests). The answer
is parsed as JSON; an invalid answer is asked again once with the parsing error (C3 rule 7), never more. Every call is
written to the audit (task, unit, tier, prompt hash, answer, errors); nothing is logged.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from lnp_analyse.noyau.modeles import ContexteAppel

CONSIGNES = Path(__file__).resolve().parent / "consignes"


def charger(nom_: str) -> str:
    return (CONSIGNES / f"{nom_}.md").read_text(encoding="utf-8")


def remplir(gabarit: str, **valeurs: str) -> str:
    """Placeholders are {name}; the JSON examples of the prompts keep their braces."""
    for k, v in valeurs.items():
        gabarit = gabarit.replace("{" + k + "}", v)
    return gabarit


def lire_json(texte: str) -> dict[str, Any]:
    """Robust reading of the model's text: code fences, prose around the object, trailing commas."""
    t = (texte or "").strip()
    t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        raise ValueError("no JSON object in the answer")
    corps = t[i:j + 1]
    try:
        v = json.loads(corps)
    except json.JSONDecodeError:
        try:
            v = json.loads(re.sub(r",\s*([}\]])", r"\1", corps))
        except json.JSONDecodeError as e:
            raise ValueError(f"invalid JSON: {e.msg} at {e.pos}") from None
    if not isinstance(v, dict):
        raise ValueError("the answer is not a JSON object")
    return v


def afficher_tours(ctx: ContexteAppel) -> str:
    """The cached prefix: numbered turns, `T001 [SALES] text`. Turns marked attribution_doubtful are left out."""
    lignes = [f"{t.id} [{t.role}] {t.texte}" for t in ctx.tours if not t.attribution_douteuse]
    return f"TRANSCRIPT · {len(lignes)} turns\n" + "\n".join(lignes)


@dataclass
class ReponseEtape:
    reponse: Optional[dict]
    raison_arret: Optional[str] = None
    erreur: Optional[str] = None


@dataclass
class Etapes:
    client: Any
    ctx: ContexteAppel
    palier: str = "fast"
    effort: str = "low"
    systeme: str = field(default_factory=lambda: charger("system"))
    prefixe: str = ""

    def __post_init__(self):
        self.prefixe = self.prefixe or afficher_tours(self.ctx)

    def demander(self, id_tache: str, id_unite: str, consigne: str, max_tokens: int, rejouer_tronque: bool = True) -> ReponseEtape:
        derniere_err, arret = None, None
        for essai in (1, 2):
            p = consigne if essai == 1 else (
                consigne + "\n\nYOUR PREVIOUS ANSWER WAS REJECTED BY THE CODE: " + str(derniere_err) +
                ". Return only the JSON object, with the same schema, every quote copied exactly from its turn.")
            sortie = self.client.completer(id_tache, id_unite, self.palier, self.systeme, self.prefixe, p, max_tokens, self.effort)
            arret = (sortie or {}).get("stop_reason")
            entree = {"task": id_tache, "unit": id_unite, "pass": 1, "attempt": essai, "tier": self.palier,
                     "prompt_hash": hashlib.sha256((self.systeme + "\n" + p).encode()).hexdigest()[:16],
                     "stop_reason": arret}
            try:
                rep = lire_json((sortie or {}).get("text") or "")
            except ValueError as e:
                derniere_err = "truncated answer (max_tokens)" if arret == "max_tokens" else str(e)
                entree["errors"] = [derniere_err]
                self.ctx.audit.append(entree)
                if arret == "max_tokens" and not rejouer_tronque:
                    return ReponseEtape(None, arret, derniere_err)
                continue
            entree.update(answer=rep, errors=[])
            self.ctx.audit.append(entree)
            return ReponseEtape(rep, arret, None)
        self.ctx.audit.append({"task": id_tache, "unit": id_unite, "error": f"no valid JSON after a replay: {derniere_err}"})
        return ReponseEtape(None, arret, derniere_err)


class ClientAllegeSimule:
    """Replays recorded answers per step id (tests, offline runs). An answer may be a dict, a raw string, or a list of
    them (one per call of that step, the last one repeated)."""

    def __init__(self, reponses: dict[str, Any]):
        self.reponses = reponses
        self.appels: list[dict] = []
        self.conso: dict = {}

    def completer(self, id_tache, id_unite, palier, systeme, prefixe, consigne, max_tokens=16000, effort="low"):
        self.appels.append({"task": id_tache, "unit": id_unite, "tier": palier, "prompt": consigne, "prefix": prefixe,
                           "max_tokens": max_tokens, "effort": effort})
        a = self.reponses.get(id_tache, {})
        if isinstance(a, list):
            n = sum(1 for c in self.appels if c["task"] == id_tache) - 1
            a = a[min(n, len(a) - 1)]
        if isinstance(a, tuple):              # (text, stop_reason)
            return {"text": a[0], "stop_reason": a[1]}
        return {"text": a if isinstance(a, str) else json.dumps(a), "stop_reason": "end_turn"}

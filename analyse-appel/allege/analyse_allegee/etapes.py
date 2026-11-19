"""Un appel du modèle par étape, par la passerelle (callqa-llm) : la transcription est un préfixe en cache partagé par
les étapes.

Le client est tout objet qui a `completer(id_tache, id_unite, palier, systeme, prefixe, consigne, max_tokens, effort)` et
rend {"text", "stop_reason"} (executant_analyse.passerelle.ClientPasserelle.completer, ou le ClientAllegeSimule des
tests). La réponse est lue comme du JSON ; une réponse invalide est redemandée une fois avec l'erreur de lecture (C3,
règle 7), jamais plus. Chaque appel est écrit dans l'audit (tâche, unité, palier, empreinte de la consigne, réponse,
erreurs) ; rien n'est écrit dans le journal.
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
    """Les marqueurs s'écrivent {nom} ; les exemples JSON des consignes gardent leurs accolades."""
    for k, v in valeurs.items():
        gabarit = gabarit.replace("{" + k + "}", v)
    return gabarit


def lire_json(texte: str) -> dict[str, Any]:
    """Lecture solide du texte du modèle : blocs de code, texte autour de l'objet, virgules finales."""
    t = (texte or "").strip()
    t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        raise ValueError("aucun objet JSON dans la réponse")
    corps = t[i:j + 1]
    try:
        v = json.loads(corps)
    except json.JSONDecodeError:
        try:
            v = json.loads(re.sub(r",\s*([}\]])", r"\1", corps))
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON invalide : {e.msg} à la position {e.pos}") from None
    if not isinstance(v, dict):
        raise ValueError("la réponse n'est pas un objet JSON")
    return v


def afficher_tours(ctx: ContexteAppel) -> str:
    """Le préfixe en cache : les tours numérotés, `T001 [SALES] texte`. Les tours marqués attribution_douteuse sont
    laissés de côté."""
    lignes = [f"{t.id} [{t.role}] {t.texte}" for t in ctx.tours if not t.attribution_douteuse]
    return f"TRANSCRIPTION · {len(lignes)} tours\n" + "\n".join(lignes)


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
    systeme: str = field(default_factory=lambda: charger("systeme"))
    prefixe: str = ""

    def __post_init__(self):
        self.prefixe = self.prefixe or afficher_tours(self.ctx)

    def demander(self, id_tache: str, id_unite: str, consigne: str, max_tokens: int, rejouer_tronque: bool = True) -> ReponseEtape:
        derniere_err, arret = None, None
        for essai in (1, 2):
            p = consigne if essai == 1 else (
                consigne + "\n\nTA RÉPONSE PRÉCÉDENTE A ÉTÉ REJETÉE PAR LE CODE : " + str(derniere_err) +
                ". Rends seulement l'objet JSON, avec le même schéma, chaque citation copiée exactement depuis son tour.")
            sortie = self.client.completer(id_tache, id_unite, self.palier, self.systeme, self.prefixe, p, max_tokens, self.effort)
            arret = (sortie or {}).get("stop_reason")
            entree = {"task": id_tache, "unit": id_unite, "pass": 1, "attempt": essai, "tier": self.palier,
                     "prompt_hash": hashlib.sha256((self.systeme + "\n" + p).encode()).hexdigest()[:16],
                     "stop_reason": arret}
            try:
                rep = lire_json((sortie or {}).get("text") or "")
            except ValueError as e:
                derniere_err = "réponse tronquée (max_tokens)" if arret == "max_tokens" else str(e)
                entree["errors"] = [derniere_err]
                self.ctx.audit.append(entree)
                if arret == "max_tokens" and not rejouer_tronque:
                    return ReponseEtape(None, arret, derniere_err)
                continue
            entree.update(answer=rep, errors=[])
            self.ctx.audit.append(entree)
            return ReponseEtape(rep, arret, None)
        self.ctx.audit.append({"task": id_tache, "unit": id_unite,
                               "error": f"aucun JSON valide après une nouvelle demande : {derniere_err}"})
        return ReponseEtape(None, arret, derniere_err)


class ClientAllegeSimule:
    """Rejoue des réponses enregistrées, par identifiant d'étape (tests, essais hors ligne). Une réponse peut être un
    dict, une chaîne brute, ou une liste de ces valeurs (une par appel de l'étape, la dernière répétée)."""

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
        if isinstance(a, tuple):              # (texte, stop_reason)
            return {"text": a[0], "stop_reason": a[1]}
        return {"text": a if isinstance(a, str) else json.dumps(a), "stop_reason": "end_turn"}

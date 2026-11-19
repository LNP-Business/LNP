"""Accès au modèle. Le moteur ne laisse jamais un modèle noter : un modèle répond à des questions fermées, avec des citations.

`ClientModele.demander` rend le JSON lu. Deux mises en œuvre :
- ClientAnthropic : vrais appels (demande le paquet `anthropic` et une clé d'API ; les identifiants des modèles sont de la
  configuration).
- ClientSimule : rejoue des réponses enregistrées, rangées par identifiant de tâche et d'unité (tests, exécutions hors ligne).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any, Callable, Optional, Protocol


class ClientModele(Protocol):
    def demander(self, id_tache: str, id_unite: str, palier: str, systeme: str, consigne: str,
            no_passe: int) -> dict[str, Any]: ...


def empreinte_consigne(systeme: str, consigne: str) -> str:
    return hashlib.sha256((systeme + "\n" + consigne).encode()).hexdigest()[:16]


def lire_json(texte: str) -> dict[str, Any]:
    m = re.search(r"\{.*\}", texte, re.S)
    if not m:
        raise ValueError("aucun objet JSON dans la réponse du modèle")
    return json.loads(m.group(0))


class ClientAnthropic:
    """Enveloppe légère. Les identifiants des modèles par palier sont de la configuration, jamais des faits métier écrits
    en dur.

    paliers : {"fast": "<identifiant du modèle>", "strong": "<identifiant du modèle>", "arbiter": "<identifiant du modèle>"}
    """

    def __init__(self, paliers: dict[str, str], max_tokens: int = 4000, temperature: float = 0.0):
        import anthropic  # dépendance facultative
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.paliers, self.max_tokens, self.temperature = paliers, max_tokens, temperature

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        msg = self.client.messages.create(
            model=self.paliers[palier], max_tokens=self.max_tokens, temperature=self.temperature,
            system=systeme, messages=[{"role": "user", "content": consigne}])
        texte = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        return lire_json(texte)


class ClientSimule:
    """Rejoue des réponses. `reponses[(id_tache, id_unite)]` est soit un dict (même réponse à chaque passe), soit une
    liste de dicts (un par passe ; l'arbitre est la passe 0). On peut aussi donner une fonction (`repli`)."""

    def __init__(self, reponses: Optional[dict] = None, repli: Optional[Callable] = None):
        self.reponses = reponses or {}
        self.repli = repli
        self.appels: list[tuple[str, str, int]] = []

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        self.appels.append((id_tache, id_unite, no_passe))
        a = self.reponses.get((id_tache, id_unite))
        if a is None and self.repli:
            return self.repli(id_tache, id_unite, consigne, no_passe)
        if a is None:
            raise KeyError(f"aucune réponse simulée pour {(id_tache, id_unite)}")
        if isinstance(a, list):
            return a[min(max(no_passe - 1, 0), len(a) - 1)] if no_passe else a[-1]
        return a

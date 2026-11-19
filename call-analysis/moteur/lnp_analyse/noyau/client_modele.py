"""Model access. The engine never lets a model score: a model answers closed questions with quotes.

`ModelClient.ask` returns parsed JSON. Two implementations:
- AnthropicClient: real calls (needs the `anthropic` package and an API key; model ids are configuration).
- MockClient: replays recorded answers keyed by task id and unit id (tests, offline runs).
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
        raise ValueError("no JSON object in model output")
    return json.loads(m.group(0))


class ClientAnthropic:
    """Thin wrapper. Model identifiers per tier are configuration, never hard-coded business facts.

    tiers: {"fast": "<model id>", "strong": "<model id>", "arbiter": "<model id>"}
    """

    def __init__(self, paliers: dict[str, str], max_tokens: int = 4000, temperature: float = 0.0):
        import anthropic  # optional dependency
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.paliers, self.max_tokens, self.temperature = paliers, max_tokens, temperature

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        msg = self.client.messages.create(
            model=self.paliers[palier], max_tokens=self.max_tokens, temperature=self.temperature,
            system=systeme, messages=[{"role": "user", "content": consigne}])
        texte = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        return lire_json(texte)


class ClientSimule:
    """Replays answers. `answers[(task_id, unit_id)]` is either one dict (same answer on every pass)
    or a list of dicts (one per pass; the arbiter is pass 0). A callable can also be given."""

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
            raise KeyError(f"no mock answer for {(id_tache, id_unite)}")
        if isinstance(a, list):
            return a[min(max(no_passe - 1, 0), len(a) - 1)] if no_passe else a[-1]
        return a

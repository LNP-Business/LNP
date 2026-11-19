"""Model client of the engine (core/llm.py ModelClient) going through the Edge Function callqa-llm.

The worker never holds the model key: the gateway does (Supabase function secret ANTHROPIC_API_KEY). Model ids per tier
come from crm_ca_config (never from code). Token usage is added up per tier for the job row.

Cost (docs/ARCHITECTURE.md §7, Romain 2026-10-28): the model answers one closed JSON question, so its thinking runs at
effort "low" (an `effort` key in the claim's config would override it); the question of a pass (pass_no >= 1) is marked for caching, since the
same prompt is asked three times (passes 2 and 3 read it from the cache, see prefetch.fetch). The answers are the same
kind of answer: quotes are still checked by code, three passes and the arbiter still decide.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from lnp_analyse.noyau.client_modele import lire_json


# tasks asked at another effort than the job's (docs/ARCHITECTURE.md §7). "default" = the model's own default (no effort
# sent). The foundation decides whether the call can be analysed at all (attribution, phases): at effort low, Amber
# Peterson's call was excluded as diarization_suspect on one run and analysed on another (2026-10-28), so it keeps the
# default; it is a cheap fast-tier step. The register of a SPIN question (SB-33) is asked at medium.
EFFORT_TACHE = {"foundation.attribution": "default", "foundation.phases": "default", "spin.register": "medium"}


class ErreurPasserelle(RuntimeError):
    def __init__(self, msg: str, final: bool = False):
        super().__init__(msg)
        self.final = final


class ClientPasserelle:
    def __init__(self, url: str, cle: str, paliers: dict[str, str], max_tokens: int = 4000, essais: int = 5,
                 delai: float = 180, dormir=time.sleep, ouverture=None, effort: str = "low", passes: int = 3):
        manquant = [t for t in ("fast", "strong", "arbiter") if not paliers.get(t)]
        if manquant:
            raise ErreurPasserelle("model id missing for tier " + ", ".join(manquant) + " (crm_ca_config)", final=True)
        self.url, self.cle, self.paliers, self.effort, self.passes = url, cle, paliers, effort, int(passes or 3)
        self.max_tokens, self.essais, self.delai, self.dormir = max_tokens, essais, delai, dormir
        self.ouverture = ouverture or urllib.request.urlopen
        self.verrou = threading.Lock()
        self.conso: dict[str, dict[str, int]] = {}

    def _compter(self, palier: str, conso: dict) -> None:
        with self.verrou:
            u = self.conso.setdefault(palier, {"calls": 0, "input_tokens": 0, "output_tokens": 0,
                                             "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0})
            u["calls"] += 1
            for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
                u[k] += int(conso.get(k) or 0)

    def demander(self, id_tache: str, id_unite: str, palier: str, systeme: str, consigne: str, no_passe: int) -> dict[str, Any]:
        # effort "none" (LNP, 2026-11-03): no thinking on any question, except the foundation, which keeps its default
        effort = EFFORT_TACHE.get(id_tache, self.effort)
        if self.effort == "none" and not id_tache.startswith("foundation."):
            effort = "none"
        # a question is cached only when another pass will ask it again (one pass: writing the cache costs more than it saves)
        corps = {"model": self.paliers[palier], "system": systeme, "prompt": consigne,
                "max_tokens": self.max_tokens, "effort": effort,
                "cache_prompt": int(no_passe) >= 1 and self.passes > 1}
        return lire_json(self._poster(palier, corps).get("text") or "")

    def completer(self, id_tache: str, id_unite: str, palier: str, systeme: str, prefixe: str, consigne: str,
                 max_tokens: int = 16000, effort: str = "low") -> dict[str, Any]:
        """One step of the lite engine (call-analysis/lite): the transcript goes in `prefix`, cached by the gateway and
        read back by the next steps; the step prompt is not cached. Returns {text, stop_reason} (the step parses it)."""
        sortie = self._poster(palier, {"model": self.paliers[palier], "system": systeme, "prefix": prefixe, "prompt": consigne,
                                "max_tokens": int(max_tokens), "effort": effort, "cache_prompt": False})
        return {"text": sortie.get("text") or "", "stop_reason": sortie.get("stop_reason")}

    def _poster(self, palier: str, charge: dict) -> dict[str, Any]:
        corps = json.dumps(charge).encode()
        dernier = ""
        for i in range(self.essais):
            dem = urllib.request.Request(self.url, data=corps, method="POST", headers={
                "authorization": "Bearer " + self.cle, "content-type": "application/json"})
            try:
                with self.ouverture(dem, timeout=self.delai) as r:
                    sortie = json.loads(r.read())
                self._compter(palier, sortie.get("usage") or {})
                return sortie
            except urllib.error.HTTPError as e:
                try:
                    j = json.loads(e.read())
                except Exception:  # noqa: BLE001
                    j = {}
                dernier = f"HTTP {e.code} {j.get('error', '')}".strip()
                # wrong key, no model key in Supabase, or the provider refused the request itself (the gateway says retry
                # false: a bad model id or parameter): the same request fails every time, so the whole job stops
                if e.code in (401, 409) or (e.code == 502 and j.get("retry") is False):
                    raise ErreurPasserelle(dernier, final=True) from None
                if e.code not in (429, 503, 504, 500, 502):
                    raise ErreurPasserelle(dernier) from None
            except (urllib.error.URLError, TimeoutError) as e:
                dernier = str(e)
            self.dormir(min(2 ** (i + 1), 30))
        raise ErreurPasserelle("model gateway unavailable: " + dernier)

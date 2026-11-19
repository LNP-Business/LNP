"""Client du modèle pour le moteur (ClientModele de noyau/client_modele.py) qui passe par la fonction Edge callqa-llm.

L'exécutant ne détient jamais la clé du modèle : la passerelle la détient (secret des fonctions Supabase ANTHROPIC_API_KEY).
Les identifiants de modèle par palier viennent de crm_ca_config (jamais du code). Les jetons consommés sont additionnés par
palier pour la ligne du travail.

Coût (docs/ARCHITECTURE.md §7, Romain 2026-10-28) : le modèle répond à une question fermée en JSON, donc sa réflexion tourne
en effort « low » (une clé `effort` dans la config de la prise la remplacerait) ; la question d'une passe (no_passe >= 1) est
marquée pour le cache, puisque la même consigne est posée trois fois (les passes 2 et 3 la lisent dans le cache, voir
anticipation.ClientAnticipe.recuperer). Les réponses restent du même genre : les citations sont toujours vérifiées par le
code, les trois passes et l'arbitre décident toujours.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from lnp_analyse.noyau.client_modele import lire_json


# tâches posées à un autre effort que celui du travail (docs/ARCHITECTURE.md §7). "default" = le réglage par défaut du
# modèle (aucun effort envoyé). La fondation décide si l'appel peut être analysé (attribution, phases) : en effort low,
# un même appel réel a été exclu comme diarization_suspect sur une exécution et analysé sur une autre (2026-10-28),
# donc elle garde le réglage par défaut ; c'est une étape peu coûteuse du palier rapide. Le registre d'une question SPIN
# (SB-33) est demandé en effort medium.
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
            raise ErreurPasserelle("identifiant de modèle manquant pour le palier " + ", ".join(manquant) + " (crm_ca_config)", final=True)
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
        # effort "none" (LNP, 2026-11-03) : aucune réflexion sur aucune question, sauf la fondation, qui garde son réglage par défaut
        effort = EFFORT_TACHE.get(id_tache, self.effort)
        if self.effort == "none" and not id_tache.startswith("foundation."):
            effort = "none"
        # une question n'est mise en cache que si une autre passe la reposera (une seule passe : écrire le cache coûte plus qu'il
        # ne fait gagner)
        corps = {"model": self.paliers[palier], "system": systeme, "prompt": consigne,
                "max_tokens": self.max_tokens, "effort": effort,
                "cache_prompt": int(no_passe) >= 1 and self.passes > 1}
        return lire_json(self._poster(palier, corps).get("text") or "")

    def completer(self, id_tache: str, id_unite: str, palier: str, systeme: str, prefixe: str, consigne: str,
                 max_tokens: int = 16000, effort: str = "low") -> dict[str, Any]:
        """Une étape du moteur allégé (analyse-appel/allege) : la transcription va dans `prefix`, mise en cache par la passerelle
        et relue par les étapes suivantes ; la consigne de l'étape n'est pas mise en cache. Renvoie {text, stop_reason}
        (l'étape le lit elle-même)."""
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
                # mauvaise clé, pas de clé du modèle dans Supabase, ou le fournisseur a refusé la demande elle-même (la passerelle
                # répond retry false : mauvais identifiant de modèle ou mauvais paramètre) : la même demande échoue à chaque
                # fois, donc tout le travail s'arrête
                if e.code in (401, 409) or (e.code == 502 and j.get("retry") is False):
                    raise ErreurPasserelle(dernier, final=True) from None
                if e.code not in (429, 503, 504, 500, 502):
                    raise ErreurPasserelle(dernier) from None
            except (urllib.error.URLError, TimeoutError) as e:
                dernier = str(e)
            self.dormir(min(2 ** (i + 1), 30))
        raise ErreurPasserelle("passerelle du modèle indisponible : " + dernier)

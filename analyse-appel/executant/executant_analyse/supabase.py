"""Supabase REST calls with the service role key (rpc only)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any


class Supabase:
    def __init__(self, url: str, cle: str, delai: float = 120):
        self.url, self.cle, self.delai = url.rstrip("/"), cle, delai

    def _poster(self, chemin: str, corps: Any, essais: int = 4) -> Any:
        donnees = json.dumps(corps, default=str).encode()
        dem = urllib.request.Request(self.url + chemin, data=donnees, method="POST", headers={
            "apikey": self.cle, "authorization": "Bearer " + self.cle, "content-type": "application/json"})
        for i in range(essais):
            try:
                with urllib.request.urlopen(dem, timeout=self.delai) as r:
                    brut = r.read()
                    return json.loads(brut) if brut else None
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:500]
                if e.code < 500 or i == essais - 1:
                    raise RuntimeError(f"{chemin}: HTTP {e.code} {msg}") from None
            except (urllib.error.URLError, TimeoutError) as e:
                if i == essais - 1:
                    raise RuntimeError(f"{chemin}: {e}") from None
            time.sleep(2 ** (i + 1))

    def rpc(self, nom_: str, args: dict) -> Any:
        return self._poster(f"/rest/v1/rpc/{nom_}", args)

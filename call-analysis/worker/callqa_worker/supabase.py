"""Supabase REST calls with the service role key (rpc only)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any


class Supabase:
    def __init__(self, url: str, key: str, timeout: float = 120):
        self.url, self.key, self.timeout = url.rstrip("/"), key, timeout

    def _post(self, path: str, body: Any, attempts: int = 4) -> Any:
        data = json.dumps(body, default=str).encode()
        req = urllib.request.Request(self.url + path, data=data, method="POST", headers={
            "apikey": self.key, "authorization": "Bearer " + self.key, "content-type": "application/json"})
        for i in range(attempts):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    raw = r.read()
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:500]
                if e.code < 500 or i == attempts - 1:
                    raise RuntimeError(f"{path}: HTTP {e.code} {msg}") from None
            except (urllib.error.URLError, TimeoutError) as e:
                if i == attempts - 1:
                    raise RuntimeError(f"{path}: {e}") from None
            time.sleep(2 ** (i + 1))

    def rpc(self, name: str, args: dict) -> Any:
        return self._post(f"/rest/v1/rpc/{name}", args)

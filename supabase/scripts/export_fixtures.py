#!/usr/bin/env python3
"""Export captured webhook rows as anonymised fixtures (docs/crm/13-testing.md §3).

Input, either:
  python3 supabase/scripts/export_fixtures.py rows.json
      rows.json = the result of this query, downloaded as JSON from the Supabase SQL editor:
      select id, source, delivery_id, received_at, headers, body, auth_ok, status from crm_webhook_log order by id;
  python3 supabase/scripts/export_fixtures.py --live
      reads crm_webhook_log directly; needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
      (of the project LNP; never paste them in a chat or commit them).

Output: docs/crm/fixtures/<source>-<event>.json, one per event type (the latest authenticated row wins),
with personal data replaced: emails, phone numbers, names, free text, links and IP addresses.
Run with --dry-run to print what would be written.
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "docs" / "crm" / "fixtures"

EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# "+33 6 12…", "06 12 34 56 78", "0612345678": a "+", a leading 0 or separators. Plain digit runs (ids, Unix
# timestamps) are not phone numbers.
PHONE = re.compile(r"(?:\+\d[\d\s().\-]{6,}\d|\b0\d(?:[\s.\-]?\d{2}){4}\b)")
URL = re.compile(r"https?://\S+")
ISO_TIME = re.compile(r"^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+\-]\d{2}:?\d{2})?)?$")
NAME_KEYS = {"name", "first_name", "last_name", "full_name", "display_name", "firstname", "lastname", "username"}
# Keys whose string values are codes, not personal data: kept as they are.
SAFE_KEYS = {
    "contract", "event", "type", "status", "service", "message_type", "direction", "currency", "event_type",
    "api_version", "template_name", "action", "object", "mode", "state", "kind", "source", "plan_id", "product_id",
    "error_code", "error_message", "is_external", "email_domain", "accountEmail",
}
HEADERS_KEPT = {"content-type", "user-agent", "webhook-id", "webhook-timestamp"}


class Anon:
    """Replaces each distinct email / phone / name by the same placeholder everywhere."""

    def __init__(self):
        self.maps = {"email": {}, "phone": {}, "name": {}}

    def _get(self, kind, value, fmt):
        m = self.maps[kind]
        if value not in m:
            m[value] = fmt(len(m) + 1)
        return m[value]

    def email(self, v):
        return self._get("email", v.lower(), lambda n: f"person{n}@example.com")

    def phone(self, v):
        digits = re.sub(r"\D", "", v)
        return self._get("phone", digits, lambda n: f"+3360000{n:04d}")

    def name(self, v):
        return self._get("name", v.strip().lower(), lambda n: f"Person {n}")

    def text(self, s):
        s = URL.sub("https://example.com/redacted", s)
        s = EMAIL.sub(lambda m: self.email(m.group(0)), s)
        return PHONE.sub(lambda m: self.phone(m.group(0)) if len(re.sub(r"\D", "", m.group(0))) >= 8 else m.group(0), s)

    def value(self, v, key=""):
        k = key.lower()
        if isinstance(v, dict):
            return {kk: self.value(vv, kk) for kk, vv in v.items()}
        if isinstance(v, list):
            return [self.value(x, key) for x in v]
        if not isinstance(v, str) or not v:
            return v
        if key in SAFE_KEYS or k in SAFE_KEYS:
            return EMAIL.sub(lambda m: self.email(m.group(0)), v) if key == "accountEmail" else v
        if ISO_TIME.match(v):
            return v
        if k in NAME_KEYS:
            return self.name(v)
        if URL.fullmatch(v):
            return "https://example.com/redacted"
        if EMAIL.fullmatch(v):
            return self.email(v)
        if PHONE.fullmatch(v) and len(re.sub(r"\D", "", v)) >= 8:
            return self.phone(v)
        if " " in v.strip() or "\n" in v:
            # free text (messages, transcripts, summaries, titles, notes)
            return f"<redacted text, {len(v)} chars>"
        return self.text(v)  # ids and single words: kept, emails/phones inside replaced


def event_of(source, body):
    if not isinstance(body, dict):
        return "raw"
    if source == "iclosed":
        return str(body.get("event") or "unknown")
    if source == "whop":
        return str(body.get("type") or body.get("action") or "unknown").replace(".", "_")
    if source == "fathom":
        return str(body.get("type") or body.get("event") or "new_meeting_content_ready").replace(".", "_")
    if source == "whatsapp":
        changes = [c for e in body.get("entry") or [] for c in e.get("changes") or []]
        return str(changes[0].get("field") if changes else "unknown")
    return "unknown"


def load_rows(argv):
    if "--live" in argv:
        base, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not base or not key:
            sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (project LNP) in the environment.")
        req = urllib.request.Request(
            f"{base}/rest/v1/crm_webhook_log?select=id,source,delivery_id,received_at,headers,body,auth_ok,status&order=id",
            headers={"apikey": key, "authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        sys.exit(__doc__)
    return json.loads(Path(files[0]).read_text())


def main(argv):
    rows = load_rows(argv)
    best = {}
    for row in rows:
        headers = row.get("headers") or {}
        if isinstance(headers, str):
            headers = json.loads(headers)
        try:
            body = json.loads(row["body"])
        except (TypeError, ValueError):
            body = {"_raw": row.get("body")}
        name = f"{row['source']}-{event_of(row['source'], body)}"
        # prefer authenticated rows, then the latest
        rank = (bool(row.get("auth_ok")), row.get("id") or 0)
        if name not in best or rank > best[name][0]:
            best[name] = (rank, row, headers, body)

    written = []
    for name, (_, row, headers, body) in sorted(best.items()):
        anon = Anon()
        clean = anon.value(body)
        kept = {k: v for k, v in headers.items() if k.lower() in HEADERS_KEPT}
        if "webhook-signature" in {k.lower() for k in headers}:
            kept["webhook-signature"] = "<removed: anonymisation changes the body>"
        fixture = {
            "_captured": True,
            "_source": row["source"],
            "_received_at": row.get("received_at"),
            "_auth_ok": row.get("auth_ok"),
            "_headers": kept,
        }
        fixture.update(clean if isinstance(clean, dict) else {"_body": clean})
        path = OUT / f"{name}.json"
        if "--dry-run" in argv:
            print(f"--- {path}\n{json.dumps(fixture, indent=2, ensure_ascii=False)}")
        else:
            path.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n")
        written.append(path.name)
    print(f"{len(written)} fixture(s): {', '.join(written) or 'none'}")


if __name__ == "__main__":
    main(sys.argv[1:])

"""Web edition: wraps the verified single page (app/lnp.html) for Vercel.
Writes web/public/index.html = a real document head (config, Supabase client, sign-in layer) + the page as is.
The page itself is not modified, so the reference build stays byte-identical."""
import pathlib, hashlib, json

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE.parent / "app" / "lnp.html"
OUT = HERE / "public" / "index.html"
SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js"

page = PAGE.read_text(encoding="utf-8")
# C13 (2026-11-09): the screens' documents leave the page for a versioned file, fetched once signed in and cached for good
import re
DOC_RE = re.compile(r'<script>window\.LNP_[A-Z]+_DOC = .*?;</script>\n', re.S)
docs = "".join(m.group(0)[len("<script>"):-len("</script>\n")] + "\n" for m in DOC_RE.finditer(page))
if docs:
    DH = hashlib.sha256(docs.encode("utf-8")).hexdigest()[:16]
    DD = HERE / "public" / "docs"; DD.mkdir(exist_ok=True)
    for old in DD.glob("lnp-docs.*.js"): old.unlink()
    (DD / f"lnp-docs.{DH}.js").write_text(docs, encoding="utf-8")
    first = True
    def keep_one(m):
        global first
        if first: first = False; return f'<script>window.LNP_DOCS_SRC = "/docs/lnp-docs.{DH}.js";</script>\n'
        return ""
    page = DOC_RE.sub(keep_one, page)
# The build id (2026-11-08): a browser can show a page it kept in its cache (a tab it reopens at start), an older version
# than the one deployed. lnp-web.js compares LNP_BUILD with public/version.json and reloads, so nobody stays on an old
# version without knowing it.
BUILD = hashlib.sha256((page + (HERE / "public" / "lnp-web.js").read_text(encoding="utf-8")).encode("utf-8")).hexdigest()[:16]
head = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="robots" content="noindex">\n'
        f'<script>window.LNP_BUILD = "{BUILD}";</script>\n'
        '<script src="/api/config"></script>\n'
        f'<script src="{SUPABASE_JS}"></script>\n'
        '<script src="/lnp-web.js"></script>\n')
OUT.write_text(head + page, encoding="utf-8")
(HERE / "public" / "version.json").write_text(json.dumps({"build": BUILD}) + "\n", encoding="utf-8")
print(OUT, len(head) + len(page))

"""Web edition: wraps the verified single page (skl-os/skl-os-en.html) for Vercel.
Writes web/public/index.html = a real document head (config, Supabase client, sign-in layer) + the page as is.
The page itself is not modified, so the reference build stays byte-identical."""
import pathlib, hashlib, json

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE.parent / "skl-os" / "skl-os-en.html"
OUT = HERE / "public" / "index.html"
SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js"

page = PAGE.read_text(encoding="utf-8")
# The build id (2026-11-08): a browser can show a page it kept in its cache (a tab it reopens at start), an older version
# than the one deployed. skl-web.js compares SKL_BUILD with public/version.json and reloads, so nobody stays on an old
# version without knowing it.
BUILD = hashlib.sha256((page + (HERE / "public" / "skl-web.js").read_text(encoding="utf-8")).encode("utf-8")).hexdigest()[:16]
head = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="robots" content="noindex">\n'
        f'<script>window.SKL_BUILD = "{BUILD}";</script>\n'
        '<script src="/api/config"></script>\n'
        f'<script src="{SUPABASE_JS}"></script>\n'
        '<script src="/skl-web.js"></script>\n')
OUT.write_text(head + page, encoding="utf-8")
(HERE / "public" / "version.json").write_text(json.dumps({"build": BUILD}) + "\n", encoding="utf-8")
print(OUT, len(head) + len(page))

"""Web edition: wraps the verified single page (skl-os/skl-os-en.html) for Vercel.
Writes web/public/index.html = a real document head (config, Supabase client, sign-in layer) + the page as is.
The page itself is not modified, so the reference build stays byte-identical."""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE.parent / "skl-os" / "skl-os-en.html"
OUT = HERE / "public" / "index.html"
SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js"

page = PAGE.read_text(encoding="utf-8")
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="robots" content="noindex">\n'
        '<script src="/api/config"></script>\n'
        f'<script src="{SUPABASE_JS}"></script>\n'
        '<script src="/skl-web.js"></script>\n')
OUT.write_text(head + page, encoding="utf-8")
print(OUT, len(head) + len(page))

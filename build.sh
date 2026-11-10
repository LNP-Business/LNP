#!/usr/bin/env bash
# Rebuild the LNP page from source. Output: app/lnp.html and web/public/index.html
set -euo pipefail
cd "$(dirname "$0")"

echo "1/3 Screens and modules"
( cd app
  for s in harmonize gen_access gen_salescockpit gen_salesday gen_alertes gen_training nav; do
    python3 "$s.py" > /dev/null
  done
  echo "2/3 Single-page assembly"
  python3 build.py )

echo "3/3 Web edition (Vercel)"
python3 web/build_web.py > /dev/null
node web/kb/build_kb.mjs > /dev/null   # the page content the Claude connector reads (web/api/_kb.json)

# Reference check: only meaningful while the sources are unchanged
if [ "${1:-}" = "--verify" ]; then
  ( cd app && sha256sum -c EXPECTED.sha256 --quiet ) && echo "OK: byte-identical to the LNP reference build." \
    || { echo "DIFFERENT: the output does not match the reference build."; exit 1; }
fi

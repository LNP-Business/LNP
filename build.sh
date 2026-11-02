#!/usr/bin/env bash
# Rebuild SKL OS (English) from source. Output: skl-os/skl-os-en.html
set -euo pipefail
cd "$(dirname "$0")"

echo "1/4 Mechanism app (React bundle)"
( cd mechapp
  [ -d node_modules ] || npm ci --silent
  python3 assemble.py
  ./node_modules/.bin/esbuild app.jsx --bundle --minify --outfile=dist/mech.js --loader:.jsx=jsx "--define:process.env.NODE_ENV=\"production\"" --log-level=warning )

echo "2/4 Screens and modules"
( cd skl-os
  for s in gen_seed gen_cockpit_v2 gen_poles harmonize inject_logic gen_cockpit gen_build gen_execute gen_mechos gen_carto gen_agents gen_access gen_salescockpit gen_salesday nav; do
    python3 "$s.py" > /dev/null
  done
  echo "3/4 Single-page assembly"
  python3 build.py en )

echo "4/4 Web edition (Vercel)"
python3 web/build_web.py > /dev/null
node web/kb/build_kb.mjs > /dev/null   # the page content the Claude connector reads (web/api/_kb.json)

# Reference check: only meaningful while the sources are unchanged
if [ "${1:-}" = "--verify" ]; then
  ( cd skl-os && sha256sum -c EXPECTED.sha256 --quiet ) && echo "OK: byte-identical to the reference build (artifact version 43)." \
    || { echo "DIFFERENT: the output does not match the reference build."; exit 1; }
fi

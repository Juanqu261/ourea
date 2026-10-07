#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/frontend"
echo "== Node model/service/domain tests =="
node --test tests/*.test.js

echo "== Frontend data validation =="
node tests/dataValidation.mjs

echo "== Frontend source/DRY validation =="
node tests/sourceValidation.mjs

echo "== Decision-readiness API tests =="
if [ -f "$ROOT/services/decision-readiness/package.json" ]; then
  (
    cd "$ROOT/services/decision-readiness"
    if [ -d node_modules ]; then
      node --test tests/*.test.js
    elif command -v npm >/dev/null; then
      npm install
      npm test
    fi
  )
fi

if [ -x "node_modules/.bin/vite" ]; then
  echo "== Vite production build =="
  npm run build
else
  echo "== Vite production build SKIPPED =="
  echo "Install dependencies with npm install on an internet-enabled machine."
fi

cd "$ROOT"
echo "== Python syntax =="
python -m compileall -q scripts

echo "== Python unit tests =="
python -m unittest discover -s tests -p "test_*.py" -v
python -m unittest discover -s scripts -p "test_*.py" -v

echo "== Browser checkpoints =="
node frontend/scripts/generateCheckpoint.mjs >/dev/null

echo "== Formal MILP + policy cross-checks =="
python scripts/optimizer_milp.py >/dev/null

echo "== Full geospatial/model/checkpoint validation =="
python scripts/validate_project.py

echo "== Decision-brief PDF inspection =="
python scripts/inspect_brief_pdfs.py

echo "== Reproducibility manifest =="
python scripts/make_manifest.py

echo "Ourea QA completed."

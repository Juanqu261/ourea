#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/frontend"
echo "== Node tests =="
npm test

if [ -x "node_modules/.bin/vite" ]; then
  echo "== Vite production build =="
  npm run build
else
  echo "== Vite production build SKIPPED =="
fi

cd "$ROOT"
echo "== Python syntax =="
python -m compileall -q scripts decision_engine services

echo "== Python unit tests =="
python -m unittest discover -s tests -p "test_*.py" -v

echo "== CORNARE input validation =="
python scripts/climaterisk/validate_inputs.py

echo "== Decision engine outputs =="
python -m decision_engine.build --check

echo "== Reproducibility manifest =="
python scripts/make_manifest.py --check

echo "Ourea QA completed."

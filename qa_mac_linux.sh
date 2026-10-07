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
uv run python -m compileall -q scripts decision_engine services

echo "== Python unit tests =="
uv run python -m unittest discover -s tests -p "test_*.py" -v

echo "== CORNARE input validation =="
uv run python scripts/climaterisk/validate_inputs.py

echo "== Decision engine outputs =="
uv run python -m decision_engine.build --check

echo "== Reproducibility manifest =="
uv run python scripts/make_manifest.py --check

echo "Ourea QA completed."

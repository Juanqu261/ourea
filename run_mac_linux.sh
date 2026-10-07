#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/frontend"

echo "== Installing pinned direct dependencies =="
npm install

echo "== Running model/data/source tests =="
npm test

echo "== Verifying production build =="
npm run build

echo "== Starting OUREA development server =="
npm run dev

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src');

function files(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, found);
    else if (/\.(js|jsx)$/.test(entry)) found.push(path);
  }
  return found;
}

test('runtime fetches stay under Vite BASE_URL', () => {
  const offenders = [];
  for (const path of files(src)) {
    const text = readFileSync(path, 'utf8');
    if (/(?:fetch|setWorkerUrl)\(\s*['"`]\/(?:data|vendor)\//.test(text)) offenders.push(path);
    if (text.includes('"/data/') || text.includes("'/data/") || text.includes('"/vendor/') || text.includes("'/vendor/")) {
      offenders.push(path);
    }
  }
  assert.deepEqual(offenders, []);
  const loader = readFileSync(join(src, 'cornare/loadData.js'), 'utf8');
  const map = readFileSync(join(src, 'cornare/map/DecisionMap.jsx'), 'utf8');
  assert.match(loader, /import\.meta\.env\.BASE_URL/);
  assert.match(map, /BASE_URL\}vendor\/maplibre\/maplibre-gl-worker\.mjs/);
  assert.match(map, /const base = import\.meta\.env\.BASE_URL/);
  assert.match(map, /\$\{base\}data\/cornare\/map\//);
});

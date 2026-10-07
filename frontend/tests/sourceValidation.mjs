import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src');
// Denylist. These tokens are the search patterns, not product copy.
const banned = [
  /sk-[a-zA-Z0-9]{20,}/,
  /nanjing/i,
  /cicsic/i,
  /llanaditas/i,
  /riesgo evitado/i,
  /% menos riesgo/i,
  /CORNARE no entregó/,
  /no nos dieron/,
];

function files(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, found);
    else if (/\.(js|jsx|css|json)$/.test(entry)) found.push(path);
  }
  return found;
}

const hits = [];
for (const path of files(src)) {
  const text = readFileSync(path, 'utf8');
  banned.forEach((pattern) => {
    if (pattern.test(text)) hits.push(`${path} matches ${pattern}`);
  });
}
if (hits.length) {
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log('Source guardrails hold');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseEnvText, rootEnvPath } from '../lib/loadEnv.js';

test('parseEnvText loads keys, strips quotes and skips comments', () => {
  const env = parseEnvText([
    '# comment',
    'OPENAI_MODEL=gpt-5.6-terra',
    'VITE_OUREA_AI_API_URL="http://127.0.0.1:8787/api/decision-readiness"',
    "ALLOWED_ORIGINS='https://ybedoyab.github.io'",
    '',
    'LEADING=keep',
  ].join('\n'), { LEADING: 'existing' });
  assert.equal(env.OPENAI_MODEL, 'gpt-5.6-terra');
  assert.equal(env.VITE_OUREA_AI_API_URL, 'http://127.0.0.1:8787/api/decision-readiness');
  assert.equal(env.ALLOWED_ORIGINS, 'https://ybedoyab.github.io');
  assert.equal(env.LEADING, 'existing');
  assert.equal(JSON.stringify(env).includes('sk-'), false);
});

test('root env path is the repository .env', () => {
  assert.match(rootEnvPath().replaceAll('\\', '/'), /\/\.env$/);
  assert.equal(rootEnvPath().includes('services'), false);
});

test('service contract matches the frontend contract', () => {
  const service = JSON.parse(readFileSync(fileURLToPath(new URL('../lib/aiDecisionContract.json', import.meta.url)), 'utf8'));
  const frontend = JSON.parse(readFileSync(fileURLToPath(new URL('../../../frontend/src/config/aiDecisionContract.json', import.meta.url)), 'utf8'));
  assert.deepEqual(service, frontend);
});

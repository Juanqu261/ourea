import { loadRootEnv } from '../lib/loadEnv.js';
import { VALID_SNAPSHOT } from '../../../frontend/tests/fixtures/aiReview.js';

loadRootEnv();

const url = String(process.argv[2] || process.env.VITE_OUREA_AI_API_URL || '').trim();
if (!url) {
  process.stderr.write('Usage: node scripts/smoke.mjs <api-url>\n');
  process.exit(2);
}

const origin = process.env.SMOKE_ORIGIN || 'http://localhost:5173';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin,
  },
  body: JSON.stringify({ snapshot: VALID_SNAPSHOT }),
});

const text = await response.text();
if (text.includes('sk-') || text.includes('OPENAI_API_KEY')) {
  process.stderr.write('smoke failed: response contained a secret marker\n');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(text);
} catch {
  process.stderr.write(`smoke failed: HTTP ${response.status} non-JSON\n`);
  process.exit(1);
}

if (response.status !== 200 || !payload?.synthesis?.headline) {
  process.stderr.write(`smoke failed: HTTP ${response.status} code=${payload?.error?.code || 'none'}\n`);
  process.exit(1);
}

process.stdout.write(
  `smoke ok: HTTP ${response.status} headline_chars=${payload.synthesis.headline.length} generated_at=${payload.generated_at || 'n/a'}\n`,
);

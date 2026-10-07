// Reads a JSON array of payloads on stdin and prints their JS fingerprints. Used by tests/test_engine_parity.py.
import { decisionFingerprint } from '../../frontend/src/domain/fingerprint.js';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const payloads = JSON.parse(input);
  console.log(JSON.stringify(payloads.map((payload) => decisionFingerprint(payload))));
});

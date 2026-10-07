import http from 'node:http';
import { createDecisionReadinessHandler } from '../lib/handler.js';
import { loadRootEnv } from '../lib/loadEnv.js';

loadRootEnv();

const handler = createDecisionReadinessHandler();
const server = http.createServer((req, res) => {
  if (req.url === '/api/decision-readiness' || req.url === '/api/decision-readiness/') {
    handler(req, res);
    return;
  }
  res.statusCode = 404;
  res.end('Not found');
});

server.listen(8787, '127.0.0.1', () => {
  process.stdout.write('decision-readiness listening on http://127.0.0.1:8787/api/decision-readiness\n');
});

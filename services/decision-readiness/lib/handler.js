import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { CONTRACT, RequestSchema, SnapshotSchema, SynthesisSchema, SYSTEM_INSTRUCTIONS } from './schema.js';
import { createMemoryLimiter } from './rateLimit.js';

const limiter = createMemoryLimiter({
  windowMs: CONTRACT.instance_rate_limit.window_ms,
  maxRequests: CONTRACT.instance_rate_limit.max_requests,
});

const DEFAULT_ORIGINS = [
  'https://ybedoyab.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function allowedOrigins(source = process.env.ALLOWED_ORIGINS) {
  return String(source ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function configuredOrigins() {
  const fromEnv = allowedOrigins();
  return fromEnv.length ? fromEnv : DEFAULT_ORIGINS;
}

function requestId() {
  return `ourea-${crypto.randomUUID().slice(0, 8)}`;
}

function compactSnapshotForModel(snapshot) {
  return {
    ...snapshot,
    readiness: {
      ...snapshot.readiness,
      gates: snapshot.readiness.gates.filter((item) => item.status !== 'passed').slice(0, 6),
    },
    guardrails: snapshot.guardrails.slice(0, 4),
  };
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function fail(res, status, code, id) {
  const messages = {
    method: 'POST only',
    origin: 'Origin not allowed',
    payload: 'The review request was invalid.',
    busy: 'The review service is busy. Try again in a moment.',
    timeout: 'The decision review timed out.',
    unavailable: 'The review service is unavailable.',
    refused: 'The model declined to complete this review.',
    incomplete: 'The review output was cut off. Try again.',
    schema: 'The review output did not match the required brief schema.',
  };
  json(res, status, {
    error: {
      code,
      message: messages[code] ?? messages.unavailable,
      request_id: id,
    },
  });
}

function applyCors(req, res, origins) {
  const origin = req.headers?.origin;
  if (origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Max-Age', '600');
    return 'allowed';
  }
  if (!origin) return 'none';
  return 'blocked';
}

function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > CONTRACT.snapshot_max_bytes + 512) {
        reject(Object.assign(new Error('too_large'), { code: 'too_large' }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createOpenAi(factory) {
  if (factory) return factory();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    timeout: CONTRACT.timeout_ms,
    maxRetries: CONTRACT.max_retries,
  });
}

export function createDecisionReadinessHandler({
  openaiFactory,
  openai,
  origins = configuredOrigins(),
  rateLimiter = limiter,
  model = process.env.OPENAI_MODEL || CONTRACT.default_model,
} = {}) {
  return async function handler(req, res) {
    const id = requestId();
    try {
      const cors = applyCors(req, res, origins);
      if (req.method === 'OPTIONS') {
        if (cors === 'blocked') {
          fail(res, 403, 'origin', id);
          return;
        }
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        fail(res, 405, 'method', id);
        return;
      }
      if (cors === 'blocked') {
        fail(res, 403, 'origin', id);
        return;
      }
      if (!rateLimiter.allow()) {
        fail(res, 429, 'busy', id);
        return;
      }

      let raw;
      try {
        raw = await readRawBody(req);
      } catch (error) {
        if (error?.code === 'too_large') {
          fail(res, 413, 'payload', id);
          return;
        }
        fail(res, 400, 'payload', id);
        return;
      }
      if (!raw || Buffer.byteLength(raw, 'utf8') > CONTRACT.snapshot_max_bytes + 256) {
        fail(res, 413, 'payload', id);
        return;
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        fail(res, 400, 'payload', id);
        return;
      }
      const request = RequestSchema.safeParse(parsedJson);
      if (!request.success) {
        fail(res, 400, 'payload', id);
        return;
      }
      const snapshotCheck = SnapshotSchema.safeParse(request.data.snapshot);
      if (!snapshotCheck.success) {
        fail(res, 400, 'payload', id);
        return;
      }

      const client = openai ?? createOpenAi(openaiFactory);
      if (!client) {
        console.error('decision-readiness missing_key');
        fail(res, 503, 'unavailable', id);
        return;
      }

      let completion;
      try {
        completion = await client.responses.parse({
          model,
          store: false,
          instructions: SYSTEM_INSTRUCTIONS,
          input: JSON.stringify(compactSnapshotForModel(snapshotCheck.data)),
          text: { format: zodTextFormat(SynthesisSchema, 'decision_synthesis') },
          reasoning: { effort: 'low' },
          max_output_tokens: CONTRACT.token_budget.max_output_tokens,
        });
      } catch (error) {
        const status = Number(error?.status ?? error?.statusCode);
        if (error?.name === 'AbortError' || error?.code === 'ETIMEDOUT' || status === 408) {
          fail(res, 408, 'timeout', id);
          return;
        }
        if (status === 429) {
          fail(res, 429, 'busy', id);
          return;
        }
        if (status === 401 || status === 403) {
          console.error('decision-readiness upstream_auth');
          fail(res, 503, 'unavailable', id);
          return;
        }
        console.error('decision-readiness upstream');
        fail(res, 502, 'unavailable', id);
        return;
      }

      if (completion?.status === 'incomplete' || (!completion?.output_parsed && !completion?.refusal)) {
        fail(res, 422, 'incomplete', id);
        return;
      }
      if (completion?.refusal) {
        fail(res, 422, 'refused', id);
        return;
      }

      const synthesized = SynthesisSchema.safeParse(completion.output_parsed);
      if (!synthesized.success) {
        fail(res, 422, 'schema', id);
        return;
      }

      json(res, 200, {
        schema_version: 1,
        synthesis: synthesized.data,
        generated_at: new Date().toISOString(),
        request_id: id,
      });
    } catch {
      fail(res, 500, 'unavailable', id);
    }
  };
}

# AI-assisted decision review

Ourea remains a deterministic decision-intelligence sandbox. The optional **AI decision review** explains an existing recommendation, lists binding gates and drafts field-visit questions. It does not select portfolios, change costs or approve construction.

## Hierarchy

1. Ourea’s deterministic engine selects and compares the portfolio.
2. `frontend/src/domain/decisionReadiness.js` computes readiness gates without OpenAI.
3. A minimized snapshot is POSTed to `services/decision-readiness/`.
4. OpenAI synthesizes prose through Structured Outputs.
5. OpenAI never changes rankings, US$ figures, projects, metrics or evidence states.

The visible badge (`Ready for field validation` / `Proceed with conditions` / `Needs evidence review`) comes only from step 2. `construction_readiness` is always `not_assessed_by_ourea`.

## Data sent

`buildAiDecisionSnapshot()` sends:

- snapshot id / fingerprint;
- policy profile;
- intervention types and cell numbers;
- aggregated rainfall context;
- P10 / median / P90 / downside retention;
- aggregated benchmark and breakage;
- US$ low/base/high, confidence and cost driver;
- action footprint labeled as a planning proxy;
- aggregated evidence and community statuses;
- deterministic gates;
- relevant scientific guardrails.

## Data excluded

The request must not include API keys, GeoJSON, coordinates, building geometries, free-text community notes, personal names, session history, source files, or instructions embedded in uploaded data. Planning credits are omitted so the model cannot present them.

## Frontend → backend → OpenAI

1. The Review card starts idle. No request runs on page load.
2. `VITE_OUREA_AI_API_URL` (public) is the only frontend setting. There is no frontend OpenAI key.
3. `useDecisionReview` caches by fingerprint, cancels with `AbortController`, enforces a client cooldown and refuses concurrent requests.
4. The Node 20 Vercel function validates the snapshot with Zod, calls the Responses API with `store: false`, no tools, low reasoning, ~20 s timeout and at most one retry, then validates the model output with Zod again.
5. CORS is limited to `ALLOWED_ORIGINS`. Error bodies never include stack traces, OpenAI metadata or secrets.

If the URL is unset, the card shows:

> AI decision review is not configured. Ourea’s deterministic analysis and PDF remain available.

The six-step flow and PDF remain complete.

## Local configuration

One file at the repository root: copy `.env.example` to `.env` (gitignored). Vite loads `VITE_` values from that file. The Node service loads the same file. Never prefix the OpenAI key with `VITE_`.

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
ALLOWED_ORIGINS=https://ybedoyab.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
VITE_OUREA_AI_API_URL=http://127.0.0.1:8787/api/decision-readiness
```

Use an OpenAI **Project** API key exclusive to Ourea, with a budget cap and rate limits in the OpenAI dashboard. The in-memory limiter in the function is per instance, not a global serverless guarantee.

```
cd services/decision-readiness
npm install
npm test
npm run dev
```

Live check against a running endpoint (does not run in CI):

```
npm run smoke -- http://127.0.0.1:8787/api/decision-readiness
```

## Deploy the endpoint

1. Create a Vercel project from `services/decision-readiness/`.
2. Set secrets `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-5.6-terra`.
3. Set `ALLOWED_ORIGINS` to the GitHub Pages origin plus local preview origins.
4. Note the public URL, for example `https://ourea-decision-readiness.vercel.app/api/decision-readiness`.
5. Store that URL as repository variable `OUREA_AI_API_URL` (not a secret).
6. GitHub Pages injects it as `VITE_OUREA_AI_API_URL` at build time.

## Disable

Unset `VITE_OUREA_AI_API_URL` / `OUREA_AI_API_URL` and rebuild Pages, or remove `OPENAI_API_KEY` from the backend. The product stays usable. To test the fallback locally, leave `VITE_OUREA_AI_API_URL` empty.

## Cost per generation

Implemented token budget (`frontend/src/config/aiDecisionContract.json`):

- estimated input ≈ 1,800 tokens;
- `max_output_tokens` = 1,600;
- typical output ≈ 900 tokens.

Official short-context rates for `gpt-5.6-terra` as of 2026-08-28 ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)):

- input US$2.00 / million tokens;
- output US$12.00 / million tokens.

Typical request:

`(1800 / 1e6) * 2 + (900 / 1e6) * 12 ≈ US$0.014`

Upper bound at the output cap:

`(1800 / 1e6) * 2 + (1600 / 1e6) * 12 ≈ US$0.023`

GitHub Actions live smoke posts two snapshots (tiny fixture + published guided example) against the public endpoint. It does not use an OpenAI key.

These are API token charges, not Ourea project costs.

## Scientific limits

The review cannot conclude construction feasibility, safety, community support, parcel-level precision, people protected, or which house will fail. USD remains a pre-feasibility envelope. Community `not assessed` stays a pending gate, never a negative social finding. Generated text is not stored as scientific or community evidence.

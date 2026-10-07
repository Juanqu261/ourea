# Ourea changelog

## Public AI, ROM costs and decision brief — 2026-08-28

- Published AI reviews explain only pending gates, raise the output budget from evidence, and return a safe `request_id` on failure.
- Decision brief is a 7-page investment package: immediate ask versus future envelope, numbered citations, ROM drainage packages, and a compact AI section.
- Hillside mechanism animation is restored as a controlled illustration, not a collapse forecast.
- Civil works use DANE ICOCIV; household RWH equipment keeps DANE IPC. Drainage is no longer a USD/m multiplier.

## AI-assisted decision review — 2026-08-28

- Optional Review-step card explains the existing Ourea result, lists binding gates and drafts field-visit questions.
- Readiness badges are deterministic. OpenAI never changes rankings, US$ envelopes or evidence states.
- The OpenAI key lives only in the serverless backend. GitHub Pages stays static.
- Local secrets use a single gitignored `.env` at the repository root. Python dependencies live in one `requirements.txt`.

## Financed decision brief — 2026-08-28

- Decision brief is a six-page pre-feasibility package with a versioned US$ envelope, Ourea/Maps/Earth links and document metadata.
- Collapse/falling-house imagery is replaced by a static “Why early action matters” mechanism diagram.
- Planning credits remain the optimizer unit; they are not shown in the PDF.
- `scripts/build_cost_context.py` writes `frontend/public/data/cost_context.json` from the local registry, TRM 2026-08-28 and DANE IPC factors.

## Complete decision product — 2026-08-27

- Climate scenarios are anchored in CHIRPS v3 Final observations for Llanaditas / upper Comuna 8.
- Historical rainfall panel replaced by Observed climate context.
- Benchmark P10 regret is non-negative; sensitivity combinations are not spatial grid cells.
- Guided demo, GitHub Pages `/ourea/` base path, and expanded Playwright coverage.

## Reproducible QA, community evidence and competitive depth — 2026-08-27

- Local GeoJSON QA now loads JSON and builds GeoDataFrames without Fiona/pyogrio native readers.
- Community evidence treats only documented `validated` reviews as recorded; `planned`/`in_progress` are incomplete; malformed files are invalid rather than absent.
- Added documentary Comuna 8 plan alignment and a hazard-only vs deterministic vs robust selection benchmark, including a deterministic “what breaks this portfolio?” grid.
- MapLibre is code-split from the initial application bundle.
- GitHub Actions and a Playwright smoke test cover Linux QA and the core decision flow.

## Identity, community safeguards and documentation — 2026-08-27

- The product is named **Ourea** throughout the repository. Retired marketing labels and former product names were removed from UI, docs, data contracts, scripts and artifacts.
- Decision export uses `schema: ourea-decision-package` with `schema_version: 2`.
- Documentation moved under `docs/` with a navigable index.
- Added Community Evidence & Safeguards as a visible, non-scoring layer. Missing records mean not assessed.
- Documented Moravia as a learning case for participation and in-situ adaptation, not as a proving ground or optimizer target.
- Split App responsibilities into data, map and portfolio hooks; split styles into focused sheets; centralized guardrails and data paths.
- Scientific counts, seeds, rankings and optimizer results were not intentionally changed.

## Brand / judge-ready UI — 2026-08-18

- Established the Ourea product identity (Optimized Urban Resilience through Equity & Adaptation).
- Added inline SVG mark, design tokens, numbered journey, intervention cards, P10–P90 interval and grouped evidence.
- Numerical model, optimizer, uncertainty and evidence meanings were not changed.

## City-scale screening and named policy profiles — 2026-08-18

### City scale
- Replaced V3 hazard-only city screen with official hazard + official 2026 projected population + official 2023 IMCV/AMPI.
- Parsed 249 official urban barrio population records.
- Safely matched 248/249 to the current city polygon export.
- Deliberately left one ambiguous record unmatched rather than forcing geometry.
- Added Exposure / Balanced / Equity city lenses.
- Added city-lens map coloring, ranking cards and detailed barrio inspection.
- Llanaditas now has transparent multi-lens ranks (#7 exposure, #13 balanced, #22 equity) rather than a single hazard-only narrative.

### Decision policies
- Replaced one implicit objective policy with four named profiles:
  - Balanced;
  - Equity-first;
  - Access-first;
  - Low-regret.
- Kept every weight in the single model parameter source.
- Added highest-P10 recommendation label without claiming universal optimality.

### Multi-objective decision intelligence
- Added alternative robust portfolio generation.
- Added named-policy consensus analysis (projects shared across all four policy lenses).
- Added deterministic equity-benefit and access-benefit proxies.
- Added sampled 3×3 equity/access policy grid.
- Added non-dominated trade-off extraction.
- UI labels it “sampled non-dominated trade-offs”, not exhaustive Pareto frontier.

### Explainability
- Added project-level opportunity/equity/access chips.
- Added expandable “Why here?” with mean/P10 marginal benefit, robust value and value/credit.
- Added selection-stability status to project rows.
- Added explicit statement of assumptions that can change recommendations.

### Robustness
- Frontier and stability now follow the active policy profile.
- Active UI Monte Carlo now uses the same comparison seed as alternative cards to avoid confusing cross-view discrepancies.
- Low-regret policy strengthened to create a genuinely risk-averse lower-tail portfolio rather than duplicate another policy lens.

### Formal optimization
- Updated Python MILP to consume the Ourea Balanced objective profile.
- Added formal all-policy structural cross-checks.
- Each formal selected plan receives nonlinear 500-future reevaluation.

### SIATA readiness
- Added `siata_event_diagnostics.py`.
- Added regression tests for event-nearest observation, missing accumulations and required fields.
- Calibration plan explicitly requires verified event timestamp before hindcast claims.

### Cost evidence
- Added official 2023 Santa Elena household RWH procurement budget ceiling:
  ~COP 2.119M per installed 1,000 L system as a local evidence anchor.
- Explicitly kept it out of the optimizer because it is a procurement ceiling in a different context, not a transferable Comuna 8 unit price.

### Evidence / governance
- Added city population projection, official IMCV and derived city-screen statuses to the evidence registry.
- Expanded decision export with city lens, policy alternatives, sampled trade-offs and guardrails.

### QA
- Expanded Node domain/service test suite to 30 tests.
- Expanded SIATA Python regression suite to 8 tests (ingestion + event diagnostics).
- Ourea city data validation covers 248 population-matched barrios.
- Source validation prevents stale V3 city-screen asset use and duplicated policy-weight constants.
- Formal Ourea Python validation covers city screen, alternatives, trade-offs, browser checkpoints and MILP.

## Earlier modular architecture — 2026-08-18

That snapshot introduced:
- modular frontend/domain/services architecture;
- true 3D terrain;
- common-random-number Monte Carlo;
- robust budget frontier;
- selection stability;
- evidence/provenance labels;
- SIATA ingestion QA;
- formal MILP cross-check;
- competition documentation/guardrails.

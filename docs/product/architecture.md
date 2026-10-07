# Ourea — architecture

## 1. Architectural goal

Ourea separates **evidence, uncertainty, public-policy choices and UI** so the decision sandbox can be piloted without rewriting the architecture if a city later supplies station series for optional local-intensity comparison.

## 2. Design principles

### SOLID
- React components do not own climate/optimization equations.
- MapLibre lifecycle is isolated from domain logic.
- Data loading is isolated from rendering.
- Decision policies are configuration, not hard-coded UI behavior.

### KISS
- transparent equations before opaque models;
- only three physical intervention families;
- optional AI review explains an existing result and never replaces the optimizer;
- no false house-level probabilities.

### DRY

All numerical development assumptions live in `frontend/src/config/modelParameters.json`.

Scientific guardrails live in `frontend/src/config/scientificGuardrails.json`.

Data URLs live in `frontend/src/config/dataPaths.js`.

Community categories and copy live in `frontend/src/config/communityEvidence.js`.

### Fail visibly
- required JSON/data failures surface;
- optional community-evidence file can be absent safely;
- a missing community-evidence file is `not_assessed`; a malformed file is `invalid`;
- missing rainfall stays missing;
- validation scripts fail on stale/obsolete fields and model artifacts.

## 3. Application structure

### `frontend/src/flow/`
Guided decision orchestration without a router:
- `DecisionFlow.jsx` — six-step shell, drawers and explore mode;
- `flowReducer.js` / `flowGuards.js` — explicit events and pure step guards;
- `steps/` — Area, Conditions, Priorities, Portfolio, Review, Safeguards;
- `ExploreWorkspace.jsx` — Scenario / Build / Compare / Evidence tabs.

### `frontend/src/components/`
Focused UI pieces:
- `TopBar`;
- `MapLayersControl`;
- `SelectField` / `TextField` / `ChoiceCard` / `SegmentedControl`;
- `ScenarioControls`;
- `PortfolioBuilder`;
- `AlternativePortfolios`;
- `PortfolioList`;
- `DecisionAnalysis`;
- `TradeoffChart`;
- `StabilityPanel`;
- `ParetoPanel`;
- `CommunitySafeguardsPanel`;
- `PlanAlignmentPanel`;
- `BenchmarkPanel`;
- `EvidencePanel`;
- `ClimateContextPanel`;
- `MapLegend`;
- `HillsideMechanismAnimation`;
- `AiDecisionReviewCard`;


### `frontend/src/domain/`
- `climateScenarios.js` — observational presets from CHIRPS context;
- `climateStress.js` — planning climate-stress index from rainfall context and spatial susceptibility;
- `interventionModel.js` — opportunity, maturity, RWH physics, stacking;
- `uncertainty.js` — deterministic scenarios/project seeds;
- `scenarioEngine.js` — deterministic + Monte Carlo portfolio evaluation;
- `optimizer.js` — profile-aware marginal robust optimizer;
- `alternatives.js` — four named public-policy portfolios;
- `frontier.js` — policy-aware budget frontier;
- `stability.js` — selection stability under uncertainty resampling;
- `pareto.js` — sampled non-dominated multi-objective trade-offs;
- `decisionPackage.js` — auditable export;
- `decisionBrief.js` / `decisionBriefPdf.js` — 6–8-page decision brief;
- `costEstimate.js` — pre-feasibility US$ envelope from `cost_context.json`;
- `decisionReadiness.js` — deterministic field-validation gates;
- `aiDecisionSnapshot.js` — minimized AI request payload;
- `earlyAction.js` — planning-safe mechanism copy for UI and PDF;
- `communitySafeguards.js` — community evidence status without scoring;
- `benchmark.js` — hazard-only vs deterministic vs robust comparison;
- `sensitivity.js` — deterministic “what breaks this portfolio?” grid.

### `frontend/src/hooks/`
- `useOureaData.js` — required and optional data loading;
- `useOureaMap.js` — MapLibre lifecycle and view sync;
- `usePortfolioWorkspace.js` — plans, robust options, diagnostics and session community records;
- `useDecisionReview.js` — optional OpenAI-assisted review of an existing result.

### `frontend/src/styles/`
Tokens, base, layout, city screen, sandbox/portfolio, map overlays, guided flow and responsive rules are split into small sheets. `index.css` imports them.

Production MapLibre is loaded through a dedicated chunk / dynamic import so the initial application code can stay smaller than the map runtime.

### `frontend/src/services/`
- `dataService.js` — required/optional JSON loading;
- `mapService.js` — MapLibre terrain/layers/city lens/selection/portfolio display;
- `decisionReviewClient.js` — POST-only client for the optional decision-readiness API.

Independent backend: `services/decision-readiness/` (Vercel Node 20). Local secrets live in the repository-root `.env`. See `docs/product/ai-decision-review.md`.

## 4. City-scale stage

Ourea loads:

`frontend/public/data/medellin_city_priority_screen.geojson`

The screen contains official barrio geometry/hazard plus matched official 2026 population and 2023 IMCV/AMPI data.

The map can switch between:
- Exposure;
- Balanced;
- Equity.

The city stage deliberately ends at **shortlisting**, not project optimization.

## 5. Detailed sandbox stage

Stable inputs:
- 1 m DEM / slope;
- official mass-movement hazard;
- cadastral building footprint/floors;
- socioeconomic stratum;
- DANE population planning proxy;
- official access network;
- roof/open-space/access opportunity features.

Dynamic climate input:
- observational rainfall contexts from CHIRPS v3 Final (typical / high / extreme presets, or Explore);
- antecedent rainfall percentile derived from accumulated rainfall context, not in-situ soil moisture;
- planning-year restoration maturity (not a temporal pathway optimizer).

Optional later comparison, not a runtime requirement:
- a local SIATA station series if a city supplies it, used only to compare gridded context with gauge intensity.

## 6. Opportunity vs exposure separation

This remains a key correctness guardrail.

Opportunity answers:
> Where is this intervention physically/plausibly applicable?

Exposure answers:
> What stress-weighted population is associated with this location?

Ourea never folds official hazard into the intervention opportunity field and then multiplies by hazard-weighted exposure again.

## 7. Common-random-number uncertainty

For fair portfolio comparison:
- climate future `i` is shared across compared portfolios;
- intervention effect for project `j` in future `i` is keyed to `j+i`;
- project ordering does not alter its draw;
- seeds are centralized.

This reduces Monte Carlo comparison noise and makes checkpoints reproducible.

## 8. Profile-aware marginal robust optimizer

For each policy profile:
1. generate a climate ensemble;
2. calculate baseline exposure per cell/future;
3. generate eligible location/intervention candidates;
4. sample intervention-effect uncertainty;
5. calculate candidate **marginal** benefit after previously selected projects;
6. calculate mean/P10/downside;
7. apply explicit equity/access policy factors;
8. divide robust value by planning-credit cost;
9. select the best feasible candidate;
10. update multiplicative residual exposure;
11. repeat.

The output retains project-level diagnostics used by the “Why here?” UI.

## 9. Four named policy alternatives

`alternatives.js` runs the same engine under:
- Balanced;
- Equity-first;
- Access-first;
- Low-regret.

All alternatives share comparison futures.

The UI automatically opens the current **highest-P10** option while leaving all lenses inspectable.

## 10. Budget frontier

`frontier.js` reruns the **active policy profile** at configured budgets and evaluates each selected portfolio under shared futures.

Output:
- P10;
- median;
- P90;
- downside retention.

## 11. Selection stability

`stability.js` holds the policy definition/budget fixed and resamples uncertainty repeatedly.

Output:
- frequency with which each project remains selected.

This is decision stability, not probability of true optimality.

## 12. Sampled multi-objective trade-offs

`pareto.js` samples explicit equity/access weights.

Each candidate portfolio is evaluated on:
- robust median benefit;
- equity benefit proxy;
- access benefit proxy.

Duplicate portfolios are removed and non-dominated candidates are returned.

This is intentionally labeled a **sampled non-dominated set**, not an exhaustive Pareto frontier.

## 13. Formal Python cross-check

`scripts/optimizer_milp.py` supplies an independent binary optimization view.

It supports:
- exact planning-credit budget;
- exact maximum projects per cell;
- linearized robust coefficients;
- balanced budget frontier;
- named policy cross-checks;
- nonlinear 500-future post-selection reevaluation.

The formal model and interactive algorithm are related but not identical; disagreement is documented rather than hidden.

## 14. Optional SIATA station comparison

`scripts/siata_ingest.py` can convert a local station export into QA'd rainfall features if a city supplies one.

`scripts/siata_event_diagnostics.py` can summarize rainfall state around a verified event timestamp.

Neither script runs in the browser. Ourea does not download station data at runtime and does not wait on a third-party delivery to present a complete decision product.

See `docs/methodology/siata-calibration.md`.

## 15. Decision export

`decisionPackage.js` exports schema:

`ourea-decision-package`

It can contain:
- city lens;
- active policy;
- scenario status;
- selected portfolio;
- deterministic benefit/equity/access proxies;
- Monte Carlo uncertainty;
- all robust alternatives;
- selection stability;
- budget frontier;
- sampled non-dominated trade-offs;
- evidence registry;
- community safeguards;
- scientific guardrails.

Optional AI-assisted decision review is documented in `docs/product/ai-decision-review.md`. It never writes into this package as scientific evidence.

## 16. Validation layers

- Node domain/service tests;
- GeoJSON/data reconciliation;
- Ourea city-screen validation;
- import/source/DRY checks;
- deterministic uncertainty fixtures;
- JS/JSX syntax parse;
- Python compilation;
- SIATA ingestion tests;
- event-diagnostic tests;
- Python geospatial/config/checkpoint validation;
- browser checkpoint generation;
- formal MILP execution;
- optional community-evidence absence;
- SHA-256 manifest.

The Vite production bundle remains large because MapLibre dominates the JavaScript payload. That warning is documented rather than papered over with an unmaintainable split.

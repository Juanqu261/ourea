# Ourea

**Ourea** — Optimized Urban Resilience through Equity & Adaptation

**From climate risk to robust action.**

Ourea is an evidence-backed decision sandbox for robust urban climate-adaptation portfolio planning under budget, uncertainty and implementation constraints. **Medellín is the primary proving ground; Nanjing is a cross-city portability demonstration.**

Public demo: https://ybedoyab.github.io/ourea/

## Why Medellín + Nanjing?

The same method is deliberately tested under:

- two countries;
- different data availability;
- different hazard / adaptation contexts (hillside mass-movement vs monsoon urban drainage);
- different planning objectives (including intentional absence of a fabricated equity layer in Nanjing).

Headline: **Same decision engine. Different city. Different data. Different risk context.**

Nanjing is **not** a fully validated deployment and is **not** claimed to match Medellín’s local evidence depth.

Current product flow:

`CITY / CASE SELECT → CITY SCREEN → DETAILED PROVING GROUND → OBSERVED CLIMATE CONTEXT → EXPLORE RAINFALL → TEST ACTION → COMPARE ROBUST PORTFOLIOS → UNDERSTAND TRADE-OFFS → INSPECT EVIDENCE → COMMUNITY SAFEGUARDS (Medellín) → PLAN ALIGNMENT / RETROSPECTIVE CHECK`

## Why Ourea is different

Medellín already has strong hazard mapping and early-warning capability. Ourea deliberately does **not** build another warning system.

Instead it asks:

> Given limited budgets and uncertain climate/effectiveness assumptions, which physical adaptation portfolio should a city test first—and how stable is that recommendation?

The differentiator is comparison of physical adaptation portfolios under uncertainty, limited budget, explicit public objectives and auditable evidence.

Ourea is not:
- a landslide predictor;
- a hydraulic flood model;
- an early-warning system;
- a generic digital twin;
- a community-acceptance predictor;
- an automatic resettlement recommender;
- a substitute for geotechnical studies, authorities or communities.

## Informal and marginalized settlements

Innovate4Cities 2026 awards additional points when solutions integrate underserved communities through inclusive urban planning and service delivery.

Ourea already works at city scale with official hazard, 2026 population projections and 2023 IMCV/AMPI. Those layers are **not** community participation. Socioeconomic indices at comuna scale and stratum-1 building share do not prove that a portfolio is socially acceptable.

Community Evidence & Safeguards therefore records whether a technically robust portfolio has enough community evidence to advance. Missing records mean **not assessed**, never support, opposition or low risk. `planned` and `in_progress` stay **incomplete**. Only a documented `validated` review can become **community review recorded**. High livelihood, accessibility or displacement concerns mark the portfolio as **requires deliberation**. A malformed evidence file is **invalid**, not silently absent. None of these records change optimizer rankings.

The Moravia neighborhood in Medellín is documented as a learning case for territorial attachment, livelihoods and participation. It is **not** the current proving ground and is not used to alter rankings. See `docs/research/case-studies/moravia.md`.

Nanjing intentionally **does not** fabricate a Chinese socioeconomic/equity layer when defensible local evidence is absent.

## City scale

The Medellín city screen combines:
- official mass-movement hazard coverage;
- official Medellín/DANE **2026 barrio population projections**;
- official **2023 IMCV/AMPI** socioeconomic conditions.

It provides three transparent planning lenses:
- **Exposure**;
- **Balanced**;
- **Equity**.

See `docs/methodology/city-screen.md`.

The Nanjing screening grid uses WorldPop estimates, terrain-derived drainage-stress proxies and WorldCover-derived runoff-pressure proxies with lenses: Exposure, Balanced, Runoff/drainage stress, Low-regret. See `docs/cicsic/`.

## Detailed proving ground

### Medellín — Upper Comuna 8 / Llanaditas–El Faro (primary)

- **1,588 cadastral buildings**;
- **~4,057 people** as a DANE census-based planning proxy;
- **1,445 buildings** intersecting official high mass-movement hazard;
- **1,540 buildings** assigned stratum 1;
- median slope **~25.4°**;
- real Medellín **1 m terrain** rendered with local Terrain-RGB tiles.

### Nanjing — Xianlin / Qixia (portability)

- Screening AOI bbox (not an official administrative boundary);
- Mapzen Skadi terrain derivatives;
- WorldPop 2026 population estimates (or documented fallback if the national raster cannot be cropped in CI);
- Drainage-stress **screening proxies** (not inundation maps);
- Official municipal projects for **retrospective** comparison only.

## Decision intelligence

### Manual planning

A user can choose planning cells and place:
1. rainwater harvesting / storage;
2. drainage / water management;
3. restoration / green infrastructure / soil-water retention.

### Robust policy options

Under the same budget/data, Ourea generates named policy lenses (Medellín includes equity/access; Nanjing uses exposure-first / runoff-reduction / low-regret without equity).

The UI does not claim one objective is universally correct.

After generation it highlights the option with the **highest P10 lower-tail benefit in the current ensemble**, not “the optimal plan”.

### Robustness diagnostics

Ourea includes:
- common-random-number Monte Carlo;
- P10 / median / P90;
- downside retention;
- budget robustness frontier;
- project-selection stability across independent uncertainty resamples;
- sampled non-dominated trade-offs;
- project-level “Why here?” explanation;
- selection benchmark vs random / greedy / hazard-only / deterministic baselines;
- formal binary MILP cross-check (Medellín) with nonlinear reevaluation.

See `docs/methodology/policy-portfolios.md` and `docs/cicsic/cross-city-methodology.md`.

Optional **AI decision review** (Review step) turns those deterministic results into a field-validation brief. It is off unless `VITE_OUREA_AI_API_URL` is set. See `docs/product/ai-decision-review.md`.

## Observed climate context

**Medellín:** CHIRPS v3 Final for the Llanaditas / upper Comuna 8 0.05° cell (`frontend/public/data/climate_context.json`). Never downloaded at runtime.

**Nanjing:** NASA POWER Daily credential-free climate context (IMERG preferred when credentials allow; sources are never silently mixed). See `frontend/public/data/nanjing/climate_context.json`.

Rebuild Medellín climate:

```bash
python scripts/build_climate_context.py
```

Rebuild Nanjing case artifacts:

```bash
python scripts/build_nanjing_case.py
```

## Evidence and cost discipline

Ourea labels major inputs as:
- observed / official;
- official projection;
- population estimate;
- planning proxy;
- derived screening proxy;
- observed gridded / meteorological climatology;
- explicit planning prior;
- planning-credit budget unit;
- retrospective municipal evidence (validation-only).

The optimizer still uses **planning credits, not COP, USD or CNY**.

## Scientific boundary

Do **not** call current outputs:
- landslide probability;
- flood probability or inundation depth;
- hydraulic flood model results;
- calibrated risk;
- people saved/protected;
- avoided losses;
- current exact household population;
- drainage capacity;
- a COP/USD/CNY investment recommendation, offer or contract;
- an exhaustive Pareto frontier;
- community acceptance;
- municipal endorsement;
- validation across China.

## Architecture

Ourea follows practical SOLID / KISS / DRY constraints:

- `frontend/src/components/` — focused presentation / interaction;
- `frontend/src/hooks/` — data loading, map lifecycle and portfolio workspace;
- `frontend/src/domain/` — decision/scenario logic (**shared engine**);
- `frontend/src/services/` — data and map lifecycle;
- `frontend/src/config/` — numerical, copy, path, **case** and guardrail source of truth;
- `frontend/src/config/cases/` — Medellín + Nanjing case adapters;
- `frontend/src/utils/` — deterministic utilities.

All development numbers, sample counts and reproducibility seeds live in:

`frontend/src/config/modelParameters.json`

Scientific guardrails live in:

`frontend/src/config/scientificGuardrails.json`
(+ `nanjingScientificGuardrails.json` for the portability case)

## Run locally

This CICSIC fork includes checked-in **derived** Medellín and Nanjing artifacts under `frontend/public/data/`. Normal demo use does **not** require downloading the ~921 MB WorldPop China raster or other national/global source caches. Those live under `.cache/` only when you rebuild Nanjing evidence from source.

Clone (this fork):

```bash
git clone https://github.com/MarycieloBerrio/ourea.git
cd ourea
```

Node.js `>=20.19` is required.

### Windows

```bat
run_windows.bat
```

### macOS / Linux

```bash
./run_mac_linux.sh
```

The launcher scripts must be executable on macOS/Linux:

```bash
chmod +x run_mac_linux.sh qa_mac_linux.sh
```

The launcher performs:

`npm install → npm test → npm run build → npm run dev`

and fails fast if any gate fails.

- Default launch is **Medellín** (primary proving ground).
- Open with `?case=nanjing` (or use Change city) for the **Nanjing portability demonstration**.
- Rebuild Nanjing from raw sources only if needed: `python scripts/rebuild_nanjing_evidence.py` (requires local cache under `.cache/nanjing/`).

## QA

```bat
qa_windows.bat
```

or:

```bash
./qa_mac_linux.sh
```

The user should run final browser QA locally after `npm install`.

Playwright covers city screen, climate context, portfolios, benchmark, community evidence, export, keyboard and 390×844 / tablet / desktop viewports.

## Documentation

Start at [`docs/README.md`](docs/README.md). CICSIC portability docs: [`docs/cicsic/`](docs/cicsic/).

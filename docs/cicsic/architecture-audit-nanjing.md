# Architecture audit — Nanjing portability (CICSIC 2026)

Internal implementation note before the Nanjing case. Goal: smallest clean refactor that keeps Medellín as the primary proving ground and adds Nanjing as a portability demonstration.

## City-independent today

- Robust marginal optimizer (`frontend/src/domain/optimizer.js`)
- Common-random-number uncertainty (`uncertainty.js`, `scenarioEngine.js`)
- Portfolio alternatives / frontier / stability / Pareto / benchmark / sensitivity
- Intervention maturity/stacking math (`interventionModel.js`)
- Climate-stress index structure (`climateStress.js`) — schema-driven once hazard keys are configured
- Decision package / brief / PDF primitives (layout engine)
- `modelParameters.json` numeric engine settings (effect ranges, seeds, MC counts)
- Scientific-guardrail *mechanism* (JSON + merge into evidence)

## Hard-coded to Medellín

- Map bbox / views (`modelConfig.js`), area id `llanaditas`, flow guards
- Brand / UI copy / hillside mechanism narrative
- City screen asset `medellin_city_priority_screen.geojson` and IMCV/equity lenses
- Session hash / example load locked to Llanaditas
- PDF aerial `llanaditas_imagery.jpg` and place keywords
- QA cardinalities in `validate_project.py` and city-screen contract

## Dataset-specific

- CHIRPS LatAm climate extract; Medellín 1 m DEM Terrain-RGB; cadastral buildings; official mass-movement hazard; DANE population; stratum; SIATA optional; COP/TRM cost context

## Intervention-specific

- Three families (RWH, drainage, restoration) with Medellín opportunity fields and hillside semantics in copy; effect ranges remain explicit planning priors

## Presentation / copy-specific

- README, competition docs, `uiCopy.js`, `climateCopy.js`, TopBar/AreaStep Medellín framing

## Optimizer reuse

- **Reuse unchanged** for Nanjing if planning cells expose the same opportunity fields and buildings supply `population_proxy`, `cell_id`, `hazard_max`, `slope_deg`
- Pass Nanjing policy profiles as objects (equity weights zeroed); do **not** duplicate the optimizer

## Guardrails that must remain

- No landslide/flood probability; no people saved; no avoided losses; no COP investment offer; community evidence not acceptance; planning credits ≠ money
- Add Nanjing-specific forbidden claims (hydraulic model, inundation depth, China-wide validation, municipal endorsement)

## Adapter surface (minimal)

Introduce a **case registry** (`frontend/src/config/cases/`) declaring id, role, data paths, lenses, profiles, unsupported features, terminology, guardrails, retrospective evidence (validation-only). Load data by case; keep Medellín paths as default so existing tests stay green.

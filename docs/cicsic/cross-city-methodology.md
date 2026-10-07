# Cross-city methodology

## Design test

The same portfolio / uncertainty engine runs for Medellín and Nanjing with city-specific inputs and configured objectives.

## Shared (unchanged) core

- `optimizer.js` — profile-aware marginal robust selection  
- `uncertainty.js` / `scenarioEngine.js` — common-random-number ensembles  
- `alternatives.js`, `frontier.js`, `stability.js`, `pareto.js`, `benchmark.js`  

No Nanjing-specific optimizer exists.

## Case adapter

`frontend/src/config/cases/` declares id, role, bbox/map, datasets, lenses, interventions, climate/terrain/population sources, unsupported features, forbidden claims, and retrospective evidence.

Runtime loads data via `loadOureaData(signal, caseConfig)`.

## Schema contract

Planning cells expose opportunity fields (`rwh_opportunity`, `drainage_corridor_proxy`, `restoration_opportunity`), `population_proxy`, and hazard category keys consumed by `climateStress.js`. Nanjing maps drainage-stress terciles onto the existing `Baja`/`Media`/`Alta` keys **as screening labels**, not mass-movement classes.

## Equity discipline

Medellín may use stratum / IMCV lenses. Nanjing sets `stratum1_buildings = 0` and disables equity profiles. Absence of a defensible local social-vulnerability layer is intentional scientific restraint.

## Uncertainty

Same seeds and Monte Carlo machinery. Policy profiles differ by configuration objects, not by a fork of the engine.

## Benchmark

`scripts/run_cross_city_benchmark.mjs` evaluates random, greedy, hazard-only, deterministic, and robust strategies under identical budget/scenario rules per case. Results are reported honestly if a baseline wins a metric.

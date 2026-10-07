# Shared-engine portability verification

## Claim

**No Nanjing-specific optimizer was required.**

This claim is literal: Nanjing does not ship a separate optimizer implementation. Both cases call:

| Module | Role |
|--------|------|
| `frontend/src/domain/optimizer.js` | Profile-aware marginal robust selection |
| `frontend/src/domain/uncertainty.js` | Common-random-number draws / seeds |
| `frontend/src/domain/scenarioEngine.js` | Portfolio evaluation + Monte Carlo |
| `frontend/src/domain/alternatives.js` | Named policy portfolios |
| `frontend/src/domain/frontier.js` / `stability.js` / `pareto.js` / `benchmark.js` | Diagnostics |

Inventory artifact: `data/derived/portability_summary.json` (12 shared core modules; `nanjing_specific_optimizer: false`).

## Same across cities

- Portfolio representation: `{ cell_id, type }[]` with planning-credit costs
- Uncertainty machinery and seed fields in `modelParameters.json`
- Robustness metrics: P10 / median / P90 / downside retention / regret
- Result schema for alternatives, benchmark strategies, decision package core fields

## What changes between cities (adapters only)

| Dimension | Medellín | Nanjing |
|-----------|----------|---------|
| Data adapters | cadastral, official hazard, CHIRPS, IMCV | Skadi, WorldPop, WorldCover, NASA POWER |
| Interventions | same three families; hillside copy | same three families; drainage/storage/green-infra copy |
| Policy objectives | balanced / equity / access / low_regret | balanced / exposure_first / runoff_reduction / low_regret (equity weight 0) |
| Assumptions | stratum equity; mass-movement stress | no equity score; drainage-stress + land-cover runoff screening proxies |
| Source metadata | Medellín evidence registry | Nanjing data_manifest + WorldCover S3 keys |

## Reproduction

```bash
node scripts/run_competitive_benchmark.mjs
python scripts/portability_summary.py
```

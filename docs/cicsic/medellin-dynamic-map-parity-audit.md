# Medellín dynamic map parity audit

Audit date: 2026-09-13. Scope: building fill-extrusion color driven by rainfall condition and active portfolio.

## Before a plan (baseline)

1. **UI state:** Conditions step selects a climate preset (`typical_wet` / `high_rainfall` / `extreme_observed`).
2. **Scenario object:** `scenarioFromPreset` sets `rainMm`, `antecedentWetness`, `presetId`, `planningYear`.
3. **Domain:** `baselineStress(buildingProps, scenario)` in `climateStress.js`:

   \[
   S = \mathrm{clamp}\big(
     (0.72\,H(\texttt{hazard\_max}) + 0.28\,\mathrm{clamp}(\texttt{slope\_deg}/50))
     \cdot
     (0.52 + 0.3\,\mathrm{clamp}((\texttt{rainMm}-30)/150) + 0.18\,\mathrm{clamp}(\texttt{wetness}))
   \big)
   \]

4. **Map pipeline:** `buildingStressGeoJson` writes `properties.scenario_stress = baselineStress × (1 − cellReduction)`.
5. With empty plan, `cellReduction = 0` → color = baseline.
6. **MapLibre:** `updateBuildingStress` copies `scenario_stress` into feature-state; fill-extrusion interpolates green→amber→red on `[0,1]` (same stops for residual).

## After a plan (residual)

1. **Active plan:** `activePlan` is `userPlan` or `aiPlan` (`{ cell_id, type }[]`).
2. **Effect model:** `cellReduction` in `interventionModel.js` uses frozen suitability fields + mid-range effect × maturity; multiple projects on one cell combine multiplicatively.
3. **Display value:** still `scenario_stress` on the **same** `[0,1]` scale (no re-normalization).
4. Unaffected cells keep `reduction = 0`.

## Condition + plan

Changing rainfall recomputes baseline via `climateMultiplier`; residual = new baseline × `(1 − reduction)` for the current plan. Changing plan / manual edits invalidates via the same `useOureaMap` effect deps: `scenario`, `activePlan`.

## Nanjing gap (pre-fix)

| Piece | Medellín | Nanjing (broken) |
|--------|----------|------------------|
| Map geometry | Cadaster buildings | OSM `building_massing` |
| Color driver | Live `scenario_stress` | Baked `visual_priority_score` |
| `updateBuildingStress` | Applies engine GeoJSON | Early-return; reseeds static score |
| Optimizer buildings | Same as map | Separate 80 exposure Points |

Nanjing **already** runs `createScenarioContext` + `baselineStress` + `cellReduction` on the 80 exposure proxies for portfolio metrics. The map layer was not consuming that output.

## Color scale (Nanjing)

Absolute `scenario_stress` values for Nanjing exposure proxies typically fall in ~0.12–0.45 because cells carry Baja/Media `hazard_max` and modest slopes. Medellín’s interpolate stops (0.48 / 0.68 / 0.82) would leave almost every Nanjing building in the green–yellow band.

Nanjing fill-extrusion therefore uses **case-calibrated stops** on the **same absolute residual values** (0 / 0.18 / 0.28 / 0.36 / 0.45 / 0.6 / 1). Baseline and residual share those stops (no per-frame renormalization). Typical→Extreme remains comparable on that fixed scale.

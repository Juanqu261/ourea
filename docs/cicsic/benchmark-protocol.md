# Benchmark protocol (predeclared)

Documented **before** final headline selection for the CICSIC red-team phase.

## Primary metric

`mean P10 lower-tail portfolio planning benefit`

across paired evaluation trials.

## Primary comparison

`ourea_robust` vs `deterministic_central`

Policy question:

> What happens to downside (P10) performance if a planner explicitly optimizes robustness instead of only central expected performance?

## Cities

- Medellín (primary proving ground)
- Nanjing / Xianlin (portability demonstration)

## Reference configuration (predeclared)

| Item | Value |
|------|-------|
| Budget | **10** planning credits |
| Uncertainty regime | **base** (`rainMultiplier` and wetness from `modelParameters.json`) |
| Profile | Medellín `balanced`; Nanjing `balanced` (equityWeight=0) |
| Root seed | `20260912` |
| Competition trials | **500** paired evaluation trials |
| Smoke / CI trials | **100** |
| MC runs per evaluation | `modelParameters.optimizer.monteCarloRuns` (220) |
| Bootstrap samples | 2000 |
| Bootstrap seed | `424242` |

## Paired design (mandatory)

Within each trial `t`:

1. Strategy **plans are selected once** under fixed planning seeds (method-specific), so plan identity does not change across evaluation trials.
2. One evaluation ensemble seed `S_t = (rootSeed + t * 9973) >>> 0` is drawn.
3. **Every strategy** is evaluated with `monteCarlo` using **exactly** seed `S_t` (same climate draws and same project-effect future indices).
4. Record paired differences `Δ_t = P10_robust(S_t) − P10_deterministic(S_t)`.

**Answer:** Yes — all strategies are evaluated on the exact same future set within each trial.

## Secondary analyses (not used to cherry-pick the primary headline)

- Budget sweep: `{6,8,10,12,15,20}` under base uncertainty, ≥100 paired trials each (or shared plan + 100 eval seeds).
- Uncertainty sweep: `{low, base, high}` at budget 10.
- Intervention-effect multipliers `{0.8, 1.0, 1.2}` on all families jointly.
- Baselines: random_feasible, greedy_opportunity, hazard_only (supporting only).

## Headline selection rules

1. Primary headline must use reference configuration unless a documented bug invalidates it.
2. Relative % is **unsafe** if `|baseline mean P10| < 1e-6` or baseline is unstable near zero (flagged automatically).
3. Do not lead with greedy comparisons when greedy collapses near zero.
4. Selection-stability from evaluation-seed loops is **excluded** from headlines.
5. Expected-value trade-off must be reported alongside P10.

## Statistical method

Paired bootstrap 95% CI on mean `Δ_t` (deterministic bootstrap seed).

Also report win / equal / loss rates for `Δ_t`.

## Reproduction

```bash
node scripts/run_cicsic_redteam.mjs --mode smoke   # 100 trials
node scripts/run_cicsic_redteam.mjs --mode full    # 500 trials
```

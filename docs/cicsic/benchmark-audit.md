# Benchmark audit (pre-expansion)

Audit of the competitive benchmark before scaling to the paired red-team experiment.

## How portfolios are generated

| Strategy | Selection | Information used |
|----------|-----------|------------------|
| `ourea_robust` | Greedy marginal robust value from `optimizeRobustPortfolio` | Full scenario context, multi-sample uncertainty during planning, equity/access weights, downside penalty |
| `deterministic_central` | Same optimizer with `scenarioSamples: 1`, `freezeScenario: true` | Same data as robust **except** uncertainty is frozen to the central scenario |
| `greedy_opportunity` | Rank `opportunity / costCredits`, pack to budget | Suitability/opportunity fields only — **no** exposure, population, or scenario evaluation |
| `hazard_only` | Rank hazard score then opportunity | `high_hazard_buildings` / `hazard_max` + opportunity — no scenario MC |
| `random_feasible` | Shuffle eligible candidates with seeded RNG, pack to budget | Feasibility only |

Plans are packed with `maxProjectsPerCell` and hard budget constraints (`costCredits`).

## How futures are generated

Evaluation Monte Carlo (`pairedMonteCarloPortfolio` / `monteCarloPortfolio`):

1. Seeded RNG draws rain multiplier and antecedent wetness within the uncertainty regime.
2. Project effect samples use `sampleProjectEffectsForFuture(projects, index, seed)`.
3. Portfolio benefit is scored via `evaluatePortfolio`.

## Seeds: planning vs evaluation

| Seed role | Controls |
|-----------|----------|
| Planning (robust) | Internal optimizer scenario samples (`baseSeed` / profile) |
| Planning (random) | Shuffle seed for `random_feasible` |
| Evaluation | Ensemble seed for MC futures |

**Legacy `run_competitive_benchmark.mjs` (12 trials):** plans were selected once; each trial only changed the evaluation seed. Strategies within a trial shared that evaluation seed (paired on evaluation), but “trials” did not re-plan under resampled planning uncertainty.

## Are strategies evaluated on the exact same future set within each trial?

**Legacy:** Yes for evaluation seeds within a trial (same MC seed passed to each strategy’s `monteCarloPortfolio`).

**Red-team suite:** Yes — mandatory. Within trial `t`, every strategy is evaluated with evaluation seed `S_t = (rootSeed + t * 9973) >>> 0`.

Do **not** compare strategies using independently sampled futures.

## How P10 is computed

Empirical 0.1 quantile of MC portfolio benefits (sorted ascending). Default runs: `modelParameters.optimizer.monteCarloRuns` (220).

## Deterministic optimization

Calls `optimizeRobustPortfolio` with a frozen central scenario. It optimizes central/expected robust value under that freeze — not an explicit P10 objective.

## Greedy selection

Ranks by opportunity per planning credit. **Bug found and fixed:** sort used `b.opportunity/a.costCredits − a.opportunity/b.costCredits` (crossed denominators). Corrected to `b.opportunity/b.costCredits − a.opportunity/a.costCredits`.

## Hazard-only

Ranks by building hazard count / Medellín hazard labels. In Nanjing, Medellín hazard labels are absent; score falls back to `high_hazard_buildings` (often 0) → behaves more like opportunity packing. Name retained for cross-city continuity; interpret carefully.

## Robust Ourea

Marginal selection maximizing mean − downsidePenalty×downside (plus equity/access factors) per credit across scenario samples.

## Shared assumptions

Same intervention catalog, costs, effect ranges, cell feature table, climate scenario baseline, and evaluation MC machinery.

## Does any baseline receive less information than Ourea?

Yes — by design:

- Greedy / hazard / random do not use the exposure model at selection time.
- Deterministic uses the same model but without planning-time uncertainty ensembles.

This is intentional for the policy question: does explicit robustness optimization improve P10 vs central-only optimization?

## Hidden disadvantages?

- Greedy can select high-suitability / low-exposure cells → near-zero planning benefit under evaluation (especially Nanjing). Fair as a naïve baseline; **not** the primary headline baseline.
- Hazard-only is Medellín-shaped; weaker conceptual analogue in Nanjing.
- Primary fair test remains `deterministic_central`.

## Selection-stability note

Evaluation-seed loops with fixed plans yield 0% “selection stability lift” by construction. That metric is **excluded** from headlines. Meaningful selection stability would require resampling planning-time uncertainty and re-selecting plans (optional; not required for competition primary claims).

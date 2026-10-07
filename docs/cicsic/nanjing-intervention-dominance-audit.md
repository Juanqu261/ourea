# Nanjing intervention dominance audit (10× RWH)

## Observation

Under the reference configuration (budget=10, base uncertainty, `balanced` Nanjing profile with `equityWeight=0`), robust Ourea selects:

`10 × rainwater harvesting (RWH)`

Deterministic selects a mixed plan (`7 × RWH + 1 × drainage`) with lower P10 and lower expected benefit.

## Unit economics (canonical parameters)

| Family | costCredits | effectRange | midEffect / credit | Eligible cells (minOpportunity) | Mean opportunity | P90 opportunity |
|--------|------------:|-------------|-------------------:|--------------------------------:|-----------------:|----------------:|
| RWH | 1 | [0.03, 0.12] | 0.075 | 80 | ~0.53 | ~0.88 |
| Drainage | 3 | [0.08, 0.25] | 0.055 | 80 | ~0.43 | ~0.54 |
| Restoration | 2 | [0.03, 0.18] | 0.053 | 80 | ~0.40 | ~0.90 |

Additional structural factors:

- Restoration has `maturityYears=3` → delayed maturity under near-term planning year.
- Budget 10 admits at most 10 RWH, 5 restoration, or 3 drainage placements (or mixtures).
- Nanjing profile disables equity weighting; selection is driven by exposure/stress reduction value.

## Why robust prefers all RWH

1. **Cost granularity:** RWH’s 1-credit cost lets the optimizer fill the entire budget with high-marginal-value cells.
2. **Effect per credit:** Mid-effect/credit is highest for RWH under current priors.
3. **Opportunity mass:** Many cells have high `rwh_opportunity`; drainage corridor scores are lower at the top of the distribution.
4. **No bug found** in packing or Nanjing-specific optimizer forks (shared engine verified).

Cell choice still matters: greedy also picks 10× RWH but different cells → ~183 P10 vs robust ~326. Dominance is of the **family**, not of “any RWH packing.”

## Classification

**1. Legitimately preferred under current explicit assumptions**

with an important caveat:

**2. Weakly parameter-favored** — RWH’s cost=1 and midEffect/credit lead the catalog; a different credit schedule could diversify portfolios.

Not classified as:

- strongly/artificially dominant via a coding asymmetry;
- selected because other interventions are structurally broken;
- bug-driven.

## Sensitivity (joint effect multipliers 0.8 / 1.0 / 1.2)

Across multipliers, Nanjing robust plan remains **10× RWH**; deterministic remains **7× RWH + 1× drainage**. Absolute P10 deltas scale with effect strength; portfolio mix does not flip.

## What we did *not* do

- Did not retune costs/effects to force portfolio diversity.
- Did not use municipal retrospective projects as optimizer inputs.
- Did not mix rainfall products.

## Honest competition wording

Safe: “Under current planning-credit and effect priors, robust optimization concentrates Nanjing’s budget-10 plan on rainwater harvesting in high-value cells.”

Unsafe: “RWH is uniquely correct for Nanjing regardless of parameterization.”

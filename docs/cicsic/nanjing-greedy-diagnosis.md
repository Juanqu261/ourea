# Nanjing greedy diagnosis

## Observed (legacy 12-trial benchmark)

`greedy_opportunity` mean P10 ≈ **0.5** under Nanjing budget=10.

## Root cause

**Implementation bug** in `selectGreedyOpportunityPortfolio` ranking:

```text
# buggy (crossed denominators)
b.opportunity / a.costCredits - a.opportunity / b.costCredits

# correct opportunity-per-credit
b.opportunity / b.costCredits - a.opportunity / a.costCredits
```

When intervention costs differ (RWH=1, restoration=2, drainage=3), the crossed formula mis-orders candidates and can pack a near-useless portfolio under Nanjing opportunity/cost structure.

## After fix (same city / budget / evaluation seed smoke)

| Strategy | Approx P10 (seed 20260912) |
|----------|----------------------------:|
| ourea_robust | ~332 |
| deterministic_central | ~294 |
| greedy_opportunity | ~183 |
| hazard_only | ~272 |
| random_feasible | ~42 |

Greedy now selects **10× RWH** on high opportunity/credit cells (often high population). It remains weaker than robust/deterministic because it **ignores exposure/stress and scenario evaluation** at selection time — only suitability ÷ cost.

## Classification

**implementation bug** (fixed)

Post-fix residual weakness vs robust/deterministic:

**expected consequence of greedy objective** + **baseline design weakness** (no exposure model)

## Keep or demote?

- **Keep** as a naïve supporting baseline (now fair after the bugfix).
- **Do not** use as primary headline baseline.
- Primary remains `deterministic_central`.

## What greedy optimizes

Score = `opportunity / costCredits` from intervention suitability fields (`rwh_opportunity`, `drainage_corridor_proxy`, `restoration_opportunity`). No benefit/cost from the runoff/stress model. No lower-tail awareness.

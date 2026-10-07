# Ourea — optimizer cross-check

This is a **software/model consistency artifact**, not real-world validation of intervention effectiveness.

## Default observational scenario

- CHIRPS v3 Final 15-day P75 (typical wet): 118.788 mm
- antecedent rainfall percentile: 50%
- planning year: 1
- budget: 10 planning credits

## Interactive robust policy options

All named options use the same 220 comparison futures in the current Ourea configuration.

| Policy | Credits | Projects | P10 | Median | Equity proxy | Access proxy |
|---|---:|---:|---:|---:|---:|---:|
| Balanced | 10 | 6 | 69.60 | 87.17 | 84.67 | 55.40 |
| Equity-first | 10 | 6 | 67.98 | 86.53 | 85.21 | 55.65 |
| Access-first | 10 | 6 | 70.83 | 84.91 | 85.52 | 61.74 |
| Low-regret | 10 | 4 | 71.55 | 88.51 | 87.21 | 60.99 |

Current lower-tail leader: **Low-regret**.

This means highest P10 in the current observational ensemble, **not universal optimality**.

## Policy consensus

Projects selected by all four named policy lenses:
- cell 35 — drainage (4/4 named profiles)
- cell 35 — rwh (4/4 named profiles)

Other projects appear in only some profiles, which is useful evidence of objective sensitivity.

## Default Balanced browser checkpoint

Selected projects:
- cell 35 — rwh
- cell 1 — rwh
- cell 35 — drainage
- cell 2 — drainage
- cell 29 — rwh
- cell 28 — rwh

500-future checkpoint:
- P10: 69.2631
- median: 86.0597
- P90: 100.9559

## Formal Balanced MILP cross-check

Selected projects:
- cell 1 — drainage
- cell 2 — drainage
- cell 35 — rwh
- cell 35 — drainage

Nonlinear post-selection reevaluation:
- P10: 69.3223
- median: 87.0449
- P90: 103.8546

The browser and MILP need not select identical plans:
- browser = sequential marginal nonlinear decision process;
- MILP = exact binary budget/cell constraints over linearized robust coefficients, then nonlinear reevaluation.

## Formal cross-check for all named policy profiles

| Policy | Credits | Projects | P10 nonlinear | Median nonlinear | P90 nonlinear |
|---|---:|---:|---:|---:|---:|
| balanced | 10 | 4 | 69.32 | 87.04 | 103.85 |
| equity | 10 | 4 | 69.32 | 87.04 | 103.85 |
| access | 10 | 4 | 68.52 | 85.89 | 104.04 |
| low_regret | 10 | 4 | 69.32 | 87.04 | 103.85 |

Some formal profiles collapse to the same plan under current linearized coefficients. Ourea preserves that result rather than manufacturing differentiation.

## Sampled multi-objective trade-offs

Ourea samples **9** equity/access weight combinations, producing **4** unique portfolios and **4** non-dominated portfolios in the current checkpoint.

This is a **sampled non-dominated set**, not an exhaustive mathematical Pareto frontier.

## What this supports

- budget constraints are enforced;
- uncertainty comparison is reproducible;
- policy assumptions can change project membership;
- consensus and disagreement can be surfaced;
- independent optimization formulations produce comparable-order outputs.

## What this does not support

- physical calibration of intervention effects;
- validated landslide prediction skill;
- casualties/people saved;
- real COP benefit/cost optimality.

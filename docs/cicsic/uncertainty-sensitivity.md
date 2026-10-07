# Uncertainty sensitivity

Hypothesis tested (not forced):

> When uncertainty is low, deterministic and robust may converge; as uncertainty increases, robust should provide more downside protection.

## Regimes

| Regime | rainMultiplier | antecedentWetnessHalfRange |
|--------|----------------|----------------------------:|
| low | [0.95, 1.05] | 0.04 |
| base | modelParameters `[0.88, 1.12]` | 0.12 |
| high | [0.7, 1.3] | 0.22 |

Budget fixed at 10. Plans selected once under base planning machinery; evaluation ensembles vary by regime (paired across strategies).

Artifact: `data/derived/cicsic_uncertainty_sweep.json`

## Smoke results (≈50–100 paired eval trials)

### Medellín — mean P10 / Δ (robust − deterministic)

| Regime | Robust | Deterministic | Δ |
|--------|-------:|--------------:|--:|
| low | 69.66 | 66.92 | 2.74 |
| base | 69.50 | 66.77 | 2.73 |
| high | 68.61 | 66.00 | 2.61 |

### Nanjing

| Regime | Robust | Deterministic | Δ |
|--------|-------:|--------------:|--:|
| low | 325.70 | 294.07 | 31.63 |
| base | 325.00 | 293.21 | 31.79 |
| high | 322.22 | 290.42 | 31.81 |

Full competition primary results use 500 trials at base uncertainty (see `cicsic_redteam_benchmark.json`). Uncertainty sweep rows above use 100 paired eval trials with plans fixed from base planning.

## Verdict on the hypothesis

**Not supported as a strong increasing relationship** in this experiment.

- Robust remains better on P10 in all regimes.
- Absolute paired Δ is approximately **flat to slightly decreasing** as evaluation uncertainty widens.
- Levels of P10 fall for both strategies under high uncertainty (harder climates), but the **gap does not systematically widen**.

Likely reason: plans differ in cell/intervention mix chosen under base planning; evaluation noise scales both portfolios similarly once plans are fixed.

## Competition-safe wording

Safe: “Across low/base/high evaluation uncertainty, robust retained a positive P10 advantage versus deterministic in both cities.”

Unsafe: “Robust value increases monotonically with uncertainty.”

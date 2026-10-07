# Competitive selection benchmark

Generated: 2026-09-13T03:03:42.678Z

Shared engine; no Nanjing-specific optimizer. Trials = 12 Monte Carlo seed resamples.

## medellin

P10 leader (mean across trials): **ourea_robust**

| Strategy | mean P10 | mean median | downside retention | mean regret vs robust | stability Jaccard |
|---|---:|---:|---:|---:|---:|
| random_feasible | 15.97 | 21.98 | 0.727 | 53.33 | 1.000 |
| greedy_opportunity | 52.01 | 65.38 | 0.796 | 17.30 | 1.000 |
| hazard_only | 60.05 | 73.93 | 0.812 | 9.25 | 1.000 |
| deterministic_central | 66.43 | 85.01 | 0.782 | 2.88 | 1.000 |
| ourea_robust | 69.31 | 85.80 | 0.808 | 0.00 | 1.000 |

Headline candidates:
- lower_tail_p10_lift_vs_best_baseline: 0.0433 (4.3%); favorable_to_ourea=true; baseline=deterministic_central
- mean_p10_regret_of_best_baseline_vs_robust: 2.8767; favorable_to_ourea=true; baseline=deterministic_central
- selection_stability_lift_vs_best_baseline: 0.0000 (0.0%); favorable_to_ourea=false; baseline=deterministic_central

## nanjing_xianlin

P10 leader (mean across trials): **ourea_robust**

| Strategy | mean P10 | mean median | downside retention | mean regret vs robust | stability Jaccard |
|---|---:|---:|---:|---:|---:|
| random_feasible | 20.60 | 26.18 | 0.787 | 306.16 | 1.000 |
| greedy_opportunity | 0.49 | 0.70 | 0.699 | 326.26 | 1.000 |
| hazard_only | 262.60 | 317.31 | 0.828 | 64.15 | 1.000 |
| deterministic_central | 294.15 | 348.90 | 0.843 | 32.61 | 1.000 |
| ourea_robust | 326.75 | 382.16 | 0.855 | 0.00 | 1.000 |

Headline candidates:
- lower_tail_p10_lift_vs_best_baseline: 0.1109 (11.1%); favorable_to_ourea=true; baseline=deterministic_central
- mean_p10_regret_of_best_baseline_vs_robust: 32.6078; favorable_to_ourea=true; baseline=deterministic_central
- selection_stability_lift_vs_best_baseline: 0.0000 (0.0%); favorable_to_ourea=false; baseline=deterministic_central


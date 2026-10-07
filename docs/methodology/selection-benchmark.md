# Selection benchmark

Ourea can compare three reproducible selection rules under the same budget, candidates and comparison seed:

1. **Hazard-only** — greedy placement on mapped high-hazard exposure.
2. **Deterministic central scenario** — one frozen planning scenario, no uncertainty ensemble.
3. **Ourea robust** — the published uncertainty ensemble and named policy profile.

P10 **regret** is `max(0, robust P10 − strategy P10)` and is therefore non-negative. P10 **delta** is signed (`strategy − robust`).

The comparison reports budget feasibility, median and lower-tail (P10) benefit proxies, project overlap with the robust plan, and equity/access proxies where the model already computes them.

## What breaks this portfolio?

One-at-a-time sensitivity varies:

- rainfall context;
- antecedent rainfall percentile;
- restoration maturity;
- intervention effect range;
- cost uncertainty (effective budget).

It reports which assumptions change **portfolio composition** versus which change **results only**. Combinations below the benefit threshold are **scenario combinations**, not spatial grid cells.

This is not a calibrated climate forecast.

Neither benchmark nor sensitivity consumes community-evidence records.

# Competition-safe headline metrics (post red-team)

Primary metric declared in `benchmark-protocol.md` before headline selection.

**Reference configuration:** budget=10, base uncertainty, rootSeed=`20260912`, **500** paired trials, bootstrap seed=`424242`.

**Primary artifact:** `data/derived/cicsic_redteam_benchmark.json`

---

## PRIMARY

### Nanjing — robust vs deterministic mean P10

| Field | Value |
|-------|------:|
| Exact relative | **+11.38%** |
| Absolute Δ | **+33.36** planning-benefit units |
| Robust mean P10 | 326.51 |
| Deterministic mean P10 | 293.15 |
| 95% CI (paired Δ) | [32.92, 33.81] |
| Win / equal / loss | 100% / 0% / 0% |
| City | Nanjing / Xianlin |
| Budget | 10 |
| Uncertainty | base |
| Trials | 500 |
| Baseline | deterministic_central |
| Safe wording | “Under the predeclared reference configuration, robust optimization improved mean lower-tail (P10) planning benefit by about 11.4% versus a deterministic central planner in Nanjing (95% CI on absolute paired Δ: 32.9–33.8).” |
| Unsafe wording | “Ourea is ~65,000% better than greedy”; “proven flood-risk reduction”; “always best at any budget” |
| Caveats | Planning-proxy units; Nanjing equity absent; 10× RWH under current priors; not a hydraulic model |

### Medellín — robust vs deterministic mean P10

| Field | Value |
|-------|------:|
| Exact relative | **+4.23%** |
| Absolute Δ | **+2.81** |
| Robust mean P10 | 69.43 |
| Deterministic mean P10 | 66.61 |
| 95% CI (paired Δ) | [2.65, 2.97] |
| Win / equal / loss | 93.4% / 0% / 6.6% |
| City | Medellín |
| Budget | 10 |
| Uncertainty | base |
| Trials | 500 |
| Baseline | deterministic_central |
| Safe wording | “In Medellín’s reference configuration, robust optimization improved mean P10 planning benefit by about 4.2% versus deterministic central planning (95% CI on absolute paired Δ: 2.65–2.97; wins in 93% of paired trials).” |
| Unsafe wording | “Robust always dominates”; “selection-stability lift” |
| Caveats | Planning-proxy units; 6.6% of trials deterministic wins on P10 |

---

## SECONDARY

### Expected-value trade-off (same plans / reference)

| City | Robust expected | Deterministic expected | Δ expected |
|------|----------------:|-----------------------:|-----------:|
| Medellín | 85.98 | 85.03 | **+0.95** (~+1.1%) |
| Nanjing | 382.49 | 348.06 | **+34.43** (~+9.9%) |

Safe: “P10 gains were not purchased by sacrificing expected performance in this configuration; expected scores also rose modestly.”

### Budget sweep (robust Δ vs deterministic)

- Medellín: positive Δ at all budgets 6–20 (win rates ≥97%).
- Nanjing: positive at 6,10,12,15,20; **tie at budget=8** (identical 8× RWH plans).
- Relative lift often **larger at tighter budgets** (e.g. Nanjing +15.4% at 6; Medellín +10.8% at 6) but not a universal “only constrained budgets” story — Medellín absolute Δ peaks at budget 20.

### Shared-engine portability

Same optimizer/uncertainty/scenario/benchmark modules; differences limited to adapters/data/lenses. See `shared-engine-verification.md`.

---

## SUPPORTING

- Random feasible remains a low floor (Medellín ~13 P10; Nanjing ~44).
- Hazard-only is competitive but below robust (Medellín ~60; Nanjing ~262).
- Greedy (post bug-fix) Medellín ~51; Nanjing ~176 — informative naïve baseline, not headline.
- Intervention sensitivity: mix stable under 0.8–1.2× joint effect scaling.
- Uncertainty sweep: advantage **persists** but does **not** increase monotonically with uncertainty.

---

## DO NOT USE

| Metric / claim | Why |
|----------------|-----|
| Selection-stability lift from evaluation-seed loops | 0% by design; plans fixed |
| Relative % vs Nanjing greedy near-zero (legacy ~0.5) | Was a **bug**; even post-fix, greedy is not primary baseline |
| “Robust value rises with uncertainty” | Not supported by uncertainty sweep |
| Retrospective municipal projects as validation of optimizer | `optimizer_input: false`; classifications frozen |
| Physical flood-risk reduction percentages | Planning-proxy only |
| Provisional 12-trial +11.1% / +4.3% without CI | Superseded by 500-trial paired study |

---

## Ranking summary

| Rank | Claim |
|------|-------|
| PRIMARY | Nanjing +11.38% and Medellín +4.23% mean P10 vs deterministic (with CI) |
| SECONDARY | Expected-value co-improvement; budget-sweep persistence; shared engine |
| SUPPORTING | Baseline ordering; sensitivity stability; uncertainty persistence |
| DO NOT USE | Selection-stability lift; greedy mega-percentages; uncertainty-monotone story |

# Evidence freeze (CICSIC red-team)

**Freeze tag:** `cicsic-evidence-freeze` (annotated; resolves to the freeze metadata commit)  
**Evidence snapshot SHA:** `296fd9d113cb3216d5bbf2e73703f688400a796e`

`evidence_snapshot_sha` is the immutable scientific implementation + benchmark artifacts commit. It is **not** the SHA of this metadata commit.

Machine-readable record: `data/derived/cicsic_evidence_freeze.json`.

## Statement

> After this evidence freeze, model assumptions and benchmark protocol must not be modified for presentation optimization unless correcting a documented bug. Any such correction requires rerunning the full benchmark suite and updating the freeze.

## Frozen protocol

| Item | Value |
|------|-------|
| Root seed | `20260912` |
| Trials | 500 paired |
| Budget | 10 |
| Uncertainty | base |
| Bootstrap seed | `424242` |
| Primary metric | mean P10 |
| Primary baseline | deterministic_central |

## Frozen headline results (reference configuration)

### Medellín
- Robust mean P10: 69.43 · Deterministic: 66.61 · Δ +2.81 (+4.23%) · 95% CI [2.65, 2.97] · wins 93.4%

### Nanjing
- Robust mean P10: 326.51 · Deterministic: 293.15 · Δ +33.36 (+11.38%) · 95% CI [32.92, 33.81] · wins 100%

Expected scores also rose (Medellín 85.98 vs 85.03; Nanjing 382.49 vs 348.06).

## Canonical parameters

- `frontend/src/config/modelParameters.json`
- `frontend/src/config/nanjingLandCoverAssumptions.json`
- `frontend/src/config/nanjingScientificGuardrails.json`

SHA-256 checksums: `data/derived/cicsic_evidence_freeze.json` → `artifacts`.

## Benchmark artifacts

- `data/derived/cicsic_redteam_benchmark.json`
- `data/derived/cicsic_redteam_trials.csv`
- `data/derived/cicsic_budget_sweep.json`
- `data/derived/cicsic_uncertainty_sweep.json`
- `data/derived/cicsic_sensitivity_interventions.json`

## Claims register

- `docs/cicsic/headline-metrics.md`
- `docs/cicsic/red-team-findings.md`
- `docs/cicsic/competition-claims-register.md`
- `docs/cicsic/benchmark-protocol.md`

## Dataset manifests

- `data/derived/nanjing/planning_cell_features.json` (checksum recorded)
- Large raw national rasters remain **uncommitted** (cache-only under `.cache/nanjing/`).

## Tagging

Annotated tag `cicsic-evidence-freeze` marks the freeze metadata commit. That commit records `evidence_snapshot_sha` = `296fd9d113cb3216d5bbf2e73703f688400a796e`.

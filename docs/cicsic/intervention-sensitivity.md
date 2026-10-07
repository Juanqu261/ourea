# Intervention-effect sensitivity

Canonical intervention parameters are **not** modified permanently. Sensitivity uses `withEffectRangeMultiplier` (joint scale on all families).

## Design

| Item | Value |
|------|-------|
| Multipliers | 0.8×, 1.0×, 1.2× (all interventions jointly) |
| Budget | 10 |
| Uncertainty | base |
| Cities | Medellín, Nanjing |
| Paired trials | ≤50 evaluation seeds per multiplier |

Artifact: `data/derived/cicsic_sensitivity_interventions.json`

## Smoke results (root seed 20260912)

### Medellín

| Mult | Robust mix | Deterministic mix | Mean Δ P10 (R−D) |
|-----:|------------|-------------------|-----------------:|
| 0.8 | 4 RWH + 2 drainage | 3 drainage + 1 RWH | ~3.1 |
| 1.0 | 4 RWH + 2 drainage | 3 drainage + 1 RWH | ~2.6 |
| 1.2 | 4 RWH + 2 drainage | 3 drainage + 1 RWH | ~3.1 |

Portfolio composition stable; robust advantage remains positive.

### Nanjing

| Mult | Robust mix | Deterministic mix | Mean Δ P10 (R−D) |
|-----:|------------|-------------------|-----------------:|
| 0.8 | 10 RWH | 7 RWH + 1 drainage | ~25.8 |
| 1.0 | 10 RWH | 7 RWH + 1 drainage | ~32.9 |
| 1.2 | 10 RWH | 7 RWH + 1 drainage | ~40.2 |

Mix unchanged; absolute advantage scales with effect magnitude.

## Conclusion

Robust vs deterministic **advantage is directionally stable** under ±20% joint effect scaling. Nanjing’s 10× RWH selection is **not fragile** to this perturbation. Advantage magnitude is parameter-sensitive (scales with effects); selection structure is not.

# Cross-city comparison artifact

## Headline

**Same decision engine. Different city. Different data. Different risk context.**

## Medellín — Primary proving ground

- Deep local / official high-resolution evidence
- Hillside / mass-movement adaptation context
- Socioeconomic / equity evidence (IMCV, stratum)
- CHIRPS climate context; municipal DEM

## Nanjing — Portability demonstration

- Independent international / open data stack
- Monsoon urban drainage / stormwater screening context
- WorldPop 2026 population estimate (~51.4k in screening AOI)
- ESA WorldCover 2021 land-cover fractions (when S3 tile available)
- **No fabricated equity layer**
- Official municipal projects used only for retrospective qualitative sanity checks

## Shared

- Portfolio framework
- Uncertainty / CRN engine
- Robustness evaluation (P10, regret, downside retention)
- Evidence discipline and scientific guardrails

## Benchmark snapshot (12 trials, budget 10)

| Case | P10 leader | Robust mean P10 lift vs best baseline |
|------|------------|----------------------------------------|
| Medellín | ourea_robust | +4.3% vs deterministic_central |
| Nanjing | ourea_robust | +11.1% vs deterministic_central |

Source: `docs/cicsic/headline-metrics.md` / `data/derived/competitive_benchmark.json`.

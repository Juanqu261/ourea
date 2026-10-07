# Nanjing portability case (CICSIC 2026)

## Positioning

- **Medellín — Primary proving ground:** deeper local evidence, official hazard, high-resolution terrain, socioeconomic/equity context, hillside / mass-movement adaptation.
- **Nanjing (Xianlin / Qixia) — Portability demonstration:** different country, data stack, and monsoon urban-drainage / stormwater context.

Headline: **Same decision engine. Different city. Different data. Different risk context.**

Nanjing is **not** claimed to be as locally validated as Medellín.

## Planning problem

Monsoon urban drainage / stormwater adaptation on mixed hilly–lowland terrain — **not** a clone of Medellín’s mass-movement narrative.

## Working AOI

WGS84 bbox `[118.88, 32.075, 118.97, 32.145]` is an **initial reproducible screening bbox**, not an official Xianlin administrative boundary.

## Build

```bash
python scripts/build_nanjing_case.py
```

Caches: `.cache/nanjing/` (Git-ignored). Outputs: `frontend/public/data/nanjing/`.

Raw nationwide rasters are never committed. Prefer cropped derived artifacts.

## Data stack

| Layer | Source | Role |
|-------|--------|------|
| Terrain | Mapzen Skadi N32E118 (AWS Open Data) | Elevation / slope / relative relief |
| Climate | NASA POWER Daily (IMERG fallback path documented) | Observed climate context / presets |
| Population | WorldPop China 2026 constrained ~100 m | Population **estimate** |
| Land cover | ESA WorldCover 2021 (when retrievable) | Built-up / vegetation proxies |
| OSM | Optional offline Geofabrik crop | Roads/waterways; building counts avoided if sparse |

## Interventions

Reuse Ourea conceptual families with Nanjing semantics:

1. Rainwater storage / harvesting  
2. Drainage / water-management upgrade  
3. Green infrastructure / soil-water retention  

Effect ranges remain **explicit planning assumptions**.

## Lenses

Balanced · Exposure-first · Runoff / drainage-stress reduction · Low-regret  

**No fabricated equity / IMCV layer.**

## Retrospective municipal evidence

Official Nanjing projects are listed in `retrospective_validation.json` with `optimizer_input: false`. They must never train, seed, or constrain the optimizer. Compare **after** independent results.

## Rebuild climate note

POWER is the credential-free path so CI/build succeeds without NASA Earthdata login. Do not silently mix POWER and IMERG in one unlabeled product.

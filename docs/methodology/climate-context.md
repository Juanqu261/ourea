# Ourea — observed climate context

Ourea uses **CHIRPS v3.0 Final** to anchor planning rainfall contexts for Llanaditas / upper Comuna 8.

Authorized sources:
- https://www.chc.ucsb.edu/data/chirps
- https://data.chc.ucsb.edu/products/CHIRPS/v3.0/
- https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt
- https://doi.org/10.1038/s41597-026-07096-4

## What is shipped

`frontend/public/data/climate_context.json` is generated offline by `scripts/build_climate_context.py`.

The runtime application never downloads CHIRPS. After `npm run build`, GeoJSON, climate JSON and terrain tiles load from the static site.

## Extract

- Product: CHIRPS v3.0 **Final pentads**, Latin America GeoTIFF subset. Not preliminary.
- Geometry: the single 0.05° cell containing the proving-ground centroid (−75.53887, 6.25265). Colombia-wide rasters are not stored in Git.
- Versioned extract: `data/derived/climate/llanaditas_chirps_v3_pentads.csv` plus `metadata.json`. CI rebuilds `climate_context.json` from that CSV and compares it with the shipped file.
- Daily series: each pentad total is divided equally across its calendar days (1–5, 6–10, 11–15, 16–20, 21–25, 26–end of month). This preserves pentad mass, so 15- and 30-day accumulations match the native product. Intra-pentad timing is not independently observed.
- Climatology: 1991–2020.
- Additional record: 1981–2024.
- Statistics: daily-allocated values; trailing 3/7/15/30-day accumulations; empirical P50/P75/P90/P95/P99 (Hyndman-Fan type 7); observed maxima; valid-day counts; coverage dates.
- Optional download cache: `.cache/chirps/` (Git-ignored). Promote with `--from-cache-only` or refresh from UCSB with `--update-from-source`.

## Appropriate use

Ourea evaluates portfolio performance across observed and stress-tested rainfall contexts. It supports planning decisions; it does not issue real-time forecasts.

Named presets:
- Typical wet conditions — 15-day P75;
- High rainfall context — 15-day P90;
- Extreme observed context — 15-day P99.

Antecedent rainfall percentile is a historical percentile of accumulated rain, not measured soil moisture.

## Scope

- Gridded precipitation is not rain-gauge intensity at a hillside station.
- Daily values are pentad totals allocated uniformly inside each pentad; they are not station daily gauges and not the ERA5-ratio rnl partition.
- These values are not landslide probability, failure chance, or a warning threshold.
- Intervention-effect ranges and planning credits remain explicit model assumptions.

## Optional local station comparison

`scripts/siata_ingest.py` can ingest a local SIATA series if a city supplies it. That comparison is optional. Ourea does not wait on a third-party delivery to present a complete decision product.

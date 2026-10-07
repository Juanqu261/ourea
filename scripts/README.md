# Ourea — scripts

## `build_nanjing_case.py`

Offline Nanjing / Xianlin portability-case builder.

- Terrain: Mapzen Skadi N32E118 → `.cache/nanjing/terrain/`
- Climate: NASA POWER Daily → `frontend/public/data/nanjing/climate_context.json`
- Population / land cover: windowed crop when available; documented fallback otherwise
- Writes planning cells, screening, evidence, retrospective validation, data manifest
- `--check` verifies required artifacts exist
- Official municipal projects are retrospective-only (`optimizer_input: false`)

## `portability_summary.py`

Emits `data/derived/portability_summary.json` with explicit shared-core vs city-specific file counts (no invented reuse %).

## `run_cross_city_benchmark.mjs`

Runs the shared JS selection benchmark for Medellín and Nanjing; writes `data/derived/cross_city_benchmark.json`.

## `geojson_io.py`

Shared loader for versioned local GeoJSON. It parses JSON and builds a `GeoDataFrame` with `from_features()`, so QA does not need Fiona/pyogrio native readers. CRS defaults to EPSG:4326 / CRS84.

## `test_geojson_io.py`

Regression tests for valid FeatureCollections, empty geometry, malformed JSON and missing properties.

## `validate_project.py`

Full artifact validator:
- 1,588 detailed buildings / 49 cells;
- intervention opportunity bounds;
- Ourea city screen and 249→248 population-match provenance;
- evidence/model guardrails;
- browser checkpoint/frontier/stability;
- four named robust alternatives;
- sampled non-dominated trade-offs;
- formal Balanced MILP;
- formal all-policy MILP cross-checks;
- CHIRPS climate context;
- no synthetic rainfall timeline.

## `optimizer_milp.py`

Independent formal binary portfolio model.

Outputs:
- `data/derived/milp_checkpoint.json`
- `data/derived/portfolio_frontier_milp.csv`
- `data/derived/milp_plan_10credits.geojson`
- `data/derived/milp_policy_alternatives.json`

Every selected plan receives nonlinear post-selection reevaluation.

## `siata_ingest.py`

Raw rainfall adapter:
- delimiter/column handling;
- explicit increment/cumulative modes;
- missing-as-missing behavior;
- rolling coverage;
- 1h/6h/24h/3d/7d/15d features;
- QA report;
- optional SIATA station comparison if a local series is supplied.

## `siata_event_diagnostics.py`

Consumes actual SIATA feature output and summarizes rainfall around a **caller-supplied verified event timestamp**.

It intentionally does not calibrate a landslide predictor.

## `test_siata_ingest.py`

5 rainfall-ingestion/data-quality regression tests.

## `test_siata_event_diagnostics.py`

3 historical-event diagnostic regression tests.

## `rebuild_buildings.py`

Narrow helper for rebuilding the detailed building asset from an already fully enriched source.

It does not pretend to reproduce the whole GIS pipeline.

## `make_manifest.py`

Creates:
- `MANIFEST.json`
- `SHA256SUMS.txt`

Checksums are SHA-256 of the Git canonical form (LF text, raw binary). Working-tree CRLF checkouts on Windows therefore match Linux CI.

The Ourea manifest records city-screen, policy-alternative, sampled trade-off and formal cross-check metadata. Environment files other than `.env.example` are excluded.

## `services/decision-readiness`

Optional Vercel function for AI-assisted decision review. Tests use an injected OpenAI client. Local listen: `npm run dev` in that folder after copying the root `.env.example` to `.env`. See `docs/product/ai-decision-review.md`.

## `build_climate_context.py`

Offline CHIRPS v3 Final extract for the Llanaditas / upper Comuna 8 cell.

- Reads Latin America pentad GeoTIFFs with a one-pixel window.
- Allocates each pentad total uniformly across calendar days.
- Writes `frontend/public/data/climate_context.json`.
- Cache: `.cache/chirps/` (Git-ignored).
- Pure statistics live in `chirps_stats.py` and are unit-tested.

The runtime application never calls this script.

## `build_cost_context.py`

Offline USD cost context for the decision brief.

- Reads `data/derived/cost_reference_registry.json` and `data/derived/local_infrastructure_cost_scale.csv`.
- Applies versioned Banco de la República TRM and DANE IPC factors.
- Writes `frontend/public/data/cost_context.json`.
- `--check` fails if the committed JSON is stale.

Runtime Ourea never calls this script or a price API.

## `inspect_brief_pdfs.py`

Renders the guided RWH+drainage and restoration fixture PDFs and checks page count, metadata and banned copy. Uses poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) when installed.

On macOS/Linux the entry scripts `run_mac_linux.sh` and `qa_mac_linux.sh` must keep the Git executable bit so they can be invoked as documented in the root README.

## `build_city_screen.py`

Deterministically rebuilds the enriched city screen from:
- the preserved hazard-only barrio baseline;
- the official 2018–2030 population-projection workbook;
- the official 2023 IMCV workbook.

It uses an explicit audited alias map rather than unconstrained fuzzy matching and deliberately leaves the ambiguous Nueva Villa de La Iguaná record unmatched.

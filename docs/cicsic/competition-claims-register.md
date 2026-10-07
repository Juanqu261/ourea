# Competition claims register (CICSIC 2026)

Update when artifacts change. Prefer silence over overclaiming.

**Primary quantitative source (post red-team):** `data/derived/cicsic_redteam_benchmark.json` (500 paired trials). Provisional `competitive_benchmark.json` (12 trials) is superseded for headlines.

| Claim | Source / artifact | Evidence class | Reproducible? | Safe? | Allowed wording | Prohibited wording |
|-------|-------------------|----------------|---------------|-------|-----------------|--------------------|
| Medellín is primary proving ground | product positioning | positioning | yes | **Yes** | “Medellín — Primary proving ground” | “both cities equally validated” |
| Nanjing is portability demonstration | product positioning | positioning | yes | **Yes** | “Nanjing — Portability demonstration” | “Nanjing deployment”; “validated in China” |
| No Nanjing-specific optimizer | `portability_summary.json`, `shared-engine-verification.md` | model-derived | yes | **Yes** | “No Nanjing-specific optimizer was required” | “95% reusable”; “China-ready engine” |
| Same uncertainty / portfolio schema | domain modules + benchmark | model-derived | yes | **Yes** | “Shared uncertainty and portfolio machinery” | “identical scientific validation depth” |
| ~51.4k WorldPop population in AOI | `summary.json`, cell feature table | population estimate | yes (local cache) | **Yes** | “WorldPop 2026 population estimate ≈51k in the screening AOI” | “census”; “exact residents”; “households” |
| WorldCover built-up / class fractions | S3 `…N30E117_Map.tif`, cell features | observed/remote-sensing | yes | **Yes** | “ESA WorldCover 2021 v200 class fractions” | “measured imperviousness” |
| Runoff pressure proxy | `nanjingLandCoverAssumptions.json` | land-cover-derived screening proxy | yes | **Yes** | “land-cover-derived screening proxy (configured class weights)” | “calibrated runoff coefficient”; “hydraulic parameter” |
| Drainage-stress proxy | terrain + runoff proxy | terrain-derived screening proxy | yes | **Yes** | “terrain-derived drainage-stress screening proxy” | “flood probability”; “inundation depth” |
| Medellín +4.23% mean P10 vs deterministic | `cicsic_redteam_benchmark.json` | model-derived benchmark | yes | **Yes** with caveats | see `headline-metrics.md` | “people protected”; “always wins” |
| Nanjing +11.38% mean P10 vs deterministic | `cicsic_redteam_benchmark.json` | model-derived benchmark | yes | **Yes** with caveats | see `headline-metrics.md` | “validated flood reduction”; “guaranteed” |
| Selection stability lift | evaluation-seed loop | excluded | n/a | **DO NOT USE as benefit** | “not measured as a headline; fixed-plan eval loops are not selection stability” | “more stable selection than baselines” |
| Legacy greedy Nanjing P10 ≈0.5 | old competitive benchmark | **bug (fixed)** | n/a | **Rejected** | “prior collapse was a ranking bug; post-fix greedy ~176 P10” | use 0.5 as fair baseline |
| Qixia / Yuanhua / Hengyang retrospective | retrospective comparison | qualitative; optimizer_input false | yes | **Conditional** | keep frozen classifications | “municipal validation”; retune optimizer |
| NASA POWER climate presets | climate_context.json | observed/remote-sensing | yes | **Yes** | “NASA POWER Daily climate context (IMERG not mixed)” | “street-scale rainfall hazard” |

## WorldCover retrieval status

- **Fixed** via anonymous S3 discovery: `s3://esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N30E117_Map.tif`

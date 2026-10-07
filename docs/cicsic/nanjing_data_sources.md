# Ourea — Nanjing / Xianlin portability case: source pack

Generated for the CICSIC 2026 fork.
Purpose: build a **portability demonstration**, not a hydraulic flood model and not an engineering design.

## Recommended case framing

- **Primary proving ground:** Medellín, Colombia — keep as the deep/local case.
- **Portability case:** Xianlin / Qixia District, Nanjing, Jiangsu, China.
- **Question:** can the same Ourea decision/uncertainty engine ingest a different city/data stack and still produce auditable adaptation portfolios?
- **Initial working AOI (WGS84):** `[118.88, 32.075, 118.97, 32.145]`.
  - Treat this as a reproducible starting bbox, not an official administrative boundary.
  - If an authoritative/OSM Xianlin boundary is available, clip to that and record provenance.

## Data sources

### 1) Terrain — primary reproducible route
**Mapzen Terrain Tiles on AWS Open Data**
- Global bare-earth terrain tiles; around Nanjing the source stack includes global SRTM.
- Public S3 bucket, no AWS account required.
- Registry: https://registry.opendata.aws/terrain-tiles/
- S3 bucket: `s3://elevation-tiles-prod/`
- Skadi endpoint template:
  `https://s3.amazonaws.com/elevation-tiles-prod/skadi/{N|S}{lat}/{N|S}{lat}{E|W}{lon}.hgt.gz`
- Xianlin falls in the 1° tile whose lower-left corner is approximately `N32E118`.
- Use for screening-scale elevation/slope/relative-relief derivatives only.

**Optional reference:** NASADEM 1 arc-second
- DOI/product: `10.5067/MEASURES/NASADEM/NASADEM_HGT.001`
- Catalog: https://data.nasa.gov/dataset/nasadem-merged-dem-global-1-arc-second-v001
- May require NASA Earthdata access workflow.

**Do not make the pipeline depend on Copernicus GLO-30.**
As of August 2026, access to the 30 m view service is restricted to authorized CCM categories. GLO-90 can remain an optional fallback/reference.

### 2) Rainfall / climate context
**Preferred research source: NASA GPM IMERG V07 Final**
- Global precipitation estimates.
- Approx. 0.1° / 10 km.
- 30-minute, daily and monthly products.
- Data directory: https://gpm.nasa.gov/data/directory
- IMERG overview: https://gpm.nasa.gov/data/imerg
- Use only as **observed climate context** / rainfall presets.
- Do NOT use 10 km precipitation pixels to claim street-scale flood hazard.

**Credential-free fallback for reproducible builds: NASA POWER Daily API**
- Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- Daily data from 1981 to near-real-time.
- Meteorology spatial resolution is much coarser than neighborhood scale.
- Use only for climate context; label source/resolution in UI.

### 3) Population
**WorldPop — China, 2026 spatial distribution of population**
- ~100 m (3 arc-second), WGS84.
- Units: estimated people per pixel.
- R2025A alpha release.
- Dataset page: https://hub.worldpop.org/geodata/summary?id=72928
- Direct GeoTIFF:
  https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/CHN/v1/100m/constrained/chn_pop_2026_CN_100m_R2025A_v1.tif
- License: CC BY 4.0, subject to source-specific ODbL conditions noted by WorldPop.
- Crop locally to AOI; do not commit the nationwide raster.

### 4) Land cover / imperviousness proxy
**ESA WorldCover 2021 v200**
- 10 m, EPSG:4326.
- 11 land-cover classes.
- License: CC BY 4.0.
- Access: https://esa-worldcover.org/en/data-access
- AWS public data route is preferred for automation.
- Discover the required tile from ESA's published grid rather than hard-coding an unverified filename.
- Useful classes: built-up, tree cover, grassland, cropland, water, bare/sparse vegetation.
- Any runoff/imperviousness score derived from classes must be labeled **derived screening proxy**, not measured runoff coefficient.

### 5) Built-up surface — optional/fallback
**European Commission JRC — EMC-BUILT R2025A**
- Epoch: 2022.
- Global built-up surface at 10 m / 100 m / coarser resolutions.
- Official overview: https://human-settlement.emergency.copernicus.eu/emc_built_s.php
- Useful when OSM building completeness is poor.
- Do not convert built-up surface into exact building counts.

### 6) Roads, waterways, buildings, POIs
**OpenStreetMap / Geofabrik China extract**
- Geofabrik: https://download.geofabrik.de/asia/china.html
- ODbL.
- Crop offline to the AOI with `osmium`, `pyrosm`, `ogr2ogr`, or equivalent.
- Evaluate completeness before using building counts.
- Prefer GHSL/EMC-BUILT as fallback for exposure if OSM building coverage is sparse.
- No runtime dependency on Overpass/Nominatim in the public demo.

## Official Nanjing evidence — use for retrospective validation, NOT as optimizer inputs

### A) Qixia topography is genuinely mixed/hilly
Official Qixia District page:
https://www.njqxq.gov.cn/sjb2018/ssqx/qxgk/index.html

Relevant facts to translate/record:
- District terrain is strongly varied.
- Southern hills/uplands are commonly around 50–300 m.
- Northern Yangtze plain/islands are generally below 10 m.
- Terrain trend: higher in south, lower in north.

### B) 2026 Xianlin waterlogging project: Yuanhua Road / Xianyin North Road
Nanjing Public Resources Trading Center:
https://njggzy.nanjing.gov.cn/njweb/jtsw/069005/069005001/20260306/f9f67762-9758-45d8-a898-d801ed8720f7.html

Official project facts:
- Project owner: Xianlin Subdistrict Office, Qixia District.
- Purpose: waterlogging remediation.
- Yuanhua Road scope includes 373 m of new d1000 reinforced-concrete stormwater pipe, 7 stormwater manholes, 306 m of existing pipe dredging/cleaning, and repair of 9 rainwater inlets.

Use this only after Ourea produces its results, as a **retrospective qualitative sanity check**.

### C) Jiuxiang River / Hengyang Lake 9,000 m³ detention-storage project
Nanjing Water Affairs Bureau:
https://shuiwu.nanjing.gov.cn/njsswj/202501/t20250122_5063584.html

Official facts:
- Located in Qixia District, south of Hengyang Lake, east near Jiuxiang River, west near Jiuxianghe West Road.
- Explicit goals include reducing Xianlin waterlogging risk and Jiuxianghe West Road ponding/waterlogging risk.
- One detention/storage facility with **9,000 m³ effective volume**.
- Includes large inlet/overflow pipe works.

Again: validation evidence, not an input used to force the optimizer toward storage.

### D) Nanjing's current policy context
Official 2026–2030 municipal water plan:
https://www.nanjing.gov.cn/zdgk/202608/t20260807_5890796.html

Relevant points:
- Dynamic treatment of historical and newly emerging urban waterlogging points.
- Drainage/flood-control projects explicitly include Qixia areas.
- City policy emphasizes active defense, drainage coordination and stormwater management.

## Scientific guardrails for the Nanjing case

Must say:
- "adaptation screening"
- "portability demonstration"
- "derived screening proxy" where appropriate
- "retrospective qualitative validation" for official projects
- "population estimate" for WorldPop
- source, year, resolution and license for every layer

Must NOT say:
- hydraulic flood simulation/model
- flood probability
- street-level inundation depth
- people protected/saved
- avoided losses
- exact drainage capacity inferred from remote sensing
- municipal endorsement
- "Ourea discovered the city's 9,000 m³ solution"
- "validated for all Chinese cities"

## Recommended comparison in the UI / pitch

Medellín:
- deep local case
- high-resolution/local official layers
- hillside + mass-movement adaptation
- stronger local socioeconomic/equity evidence

Nanjing:
- portability case
- different data stack
- monsoon rainfall context + terrain + urban drainage screening
- no fabricated local-equity layer
- compare output *after the fact* with documented municipal projects

Headline:
**Same decision engine. Different city. Different data. Different risk context.**

# Ourea — data provenance

## Purpose

This document separates:
- official source data;
- derived spatial fields;
- planning proxies;
- development assumptions.

The purpose is to prevent accidental over-claiming in the demo/deck.

## 1. City-scale screen

### Official Medellín/DANE population projections

Source workbook:
`https://www.medellin.gov.co/es/wp-content/uploads/2022/08/5.-Proyecciones-poblacionales-a-nivel-Barrios-y-Veredas-Medellin-2018-%E2%80%93-2030.xlsx`

Ourea uses 2026 total population by urban barrio.

Parsed:
- 249 official urban barrio records;
- total projected urban population in those records: 2,256,465;
- 248 safely matched to current polygon export;
- unmatched: Nueva Villa de La Iguaná, population 2,374.

Audit:
`data/derived/city_population_2026_barrio_match.csv`

### Official 2023 IMCV / AMPI-AMPI

Source:
`https://www.medellin.gov.co/es/wp-content/uploads/2022/08/socializacionIMCV2023.xlsx`

Ourea uses comuna/corregimiento-level AMPI-AMPI as a relative socioeconomic quality-of-life measure.

Important:
- it is **not barrio-level**;
- every barrio in one comuna inherits the same socioeconomic component in the city screen.

### Official barrio / mass-movement hazard geometry

The working city polygons and official mass-movement hazard export were assembled during the Medellín GIS research workflow.

Ourea calculates high/medium hazard coverage by barrio and combines that static coverage with the official projected population.

### Derived city-screen fields

- `population_2026`
- `imcv_ampi_2023`
- `hazard_weighted_population_proxy_2026`
- `exposure_component`
- `vulnerability_component`
- `priority_exposure`
- `priority_balanced`
- `priority_equity`
- corresponding ranks.

Method:
`docs/methodology/city-screen.md`

## 2. Detailed terrain

Official Medellín 2024 municipal DEM ImageServer:
`https://www.medellin.gov.co/servidormapas/rest/services/ServiciosImagen/Modelo_digital_de_elevacion_medellin_2024/ImageServer`

Working raster:
- EPSG 9377;
- ~1 m pixel size;
- detailed sandbox crop converted to local Terrain-RGB tiles.

Use:
- 3D terrain;
- elevation;
- local slope.

Limitation:
terrain is not a soil/geotechnical model.

## 3. Buildings

Official Medellín construction geometry service:
`https://www.medellin.gov.co/servidormapas/rest/services/vivienda_ciudad_terri/VA_ConsultaOperadorCatastral_geo/MapServer/14`

Working detailed source originally contained 5,835 unique valid geometries.

Competition sandbox contains 1,588 building geometries.

Fields include:
- official/cadastral construction attributes;
- assigned official hazard category;
- sampled terrain elevation/slope;
- socioeconomic stratum;
- DANE population/household planning proxies;
- planning-cell ID;
- display height.

`height_m = floors × 3 m` is a display approximation, not surveyed building height.

## 4. Detailed mass-movement hazard

Official Medellín hazard polygons.

Building assignment uses a conservative maximum intersected hazard category:

`Alta > Media > Baja`

This is a spatial hazard classification, not a probability.

## 5. Detailed access network

Official Medellín road/pedestrian/service-access network:
`https://www.medellin.gov.co/servidormapas/rest/services/transporte/VM_Transporte/MapServer/0`

Use:
- displayed access network;
- cell-level mapped corridor length;
- access decision proxy.

Limitation:
not traffic flow, travel time, evacuation or road failure simulation.

## 6. Socioeconomic stratum

Official Medellín spatial stratum/manzana information assembled during the research workflow.

Use:
- building-level planning equity proxy;
- stratum-1 share per planning cell.

Limitation:
stratum is not household income and should not be described as one.

## 7. DANE detailed population proxy

DANE 2018 census-block source:
`https://geoportal.dane.gov.co/mparcgis/rest/services/MGN2018/Serv_CapaManzanaInt_2018/MapServer/0`

Detailed sandbox block totals were allocated to buildings by constructed-area share.

Use:
- population-weighted planning exposure.

Limitation:
not current household-level population.

## 8. Planning cells

Ourea uses ~80 m derived planning cells in the detailed sandbox.

They are a decision discretization, not:
- administrative boundaries;
- engineering project boundaries;
- property parcels.

## 9. Intervention opportunity proxies

### RWH
Based primarily on roof-area opportunity.

### Drainage
Based on mapped access-corridor opportunity.

Explicitly **not drainage capacity**.

### Restoration
Based on open-space/slope opportunity.

Not a vegetation/geotechnical suitability survey.

## 10. Observed rainfall context

Shipped status: **CHIRPS v3 Final pentads** for the Llanaditas / upper Comuna 8 0.05° cell, 1991–2020 climatology, with a 1981–2024 record summary. Daily series used for rolling windows allocate each pentad total uniformly across calendar days.

No CHIRPS rasters are stored in Git. The application does not download CHIRPS at runtime.

Optional SIATA station ingest can compare local intensity if a series is supplied. See `docs/methodology/climate-context.md`.

## 11. Cost evidence

Current optimizer unit:
**planning credits, not COP**.

Ourea cost evidence includes:
- local RWH technical specifications;
- local RWH budget components;
- 2023 Santa Elena official procurement ceiling equivalent to ~COP 2.119M / installed 1,000 L system;
- local Comuna 8 mitigation/bioengineering project budgets;
- current Medellín hydraulic/risk project scale references.

The evidence is intentionally not collapsed into one false cross-intervention COP unit cost.

## 12. Reproducibility

Key audit files:
- `data/derived/city_population_2026_barrio_match.csv`
- `data/derived/city_screening_source_metadata.json`
- `data/derived/city_priority_screen.csv`
- `data/derived/cost_reference_registry.json`
- `frontend/public/data/climate_context.json`
- `frontend/src/config/modelParameters.json`
- `MANIFEST.json`
- `SHA256SUMS.txt`

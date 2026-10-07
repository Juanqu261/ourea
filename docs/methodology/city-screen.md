# Ourea — city screening method

## Purpose

The city screen is a **transparent first-stage prioritization proxy** for Medellín. It answers:

> Which barrios combine large projected population exposure to official mass-movement hazard with relatively weaker socioeconomic conditions and therefore deserve deeper adaptation analysis?

It does **not** answer:
- where a landslide will occur;
- the probability of failure;
- where the city must invest;
- which barrio has the highest dynamic climate risk.

The detailed adaptation sandbox remains the second stage of the workflow.

## Spatial universe

The working Medellín polygon export contains **271 barrio/special polygons**.

The official 2018–2030 population-projection workbook contains **249 urban barrio records** for the 16 urban comunas. Ourea safely matches **248/249** records to the current polygon export.

The one deliberately unmatched record is:
- `0725 — Nueva Villa de La Iguaná` — projected 2026 population 2,374.

It is left unmatched rather than forcing a low-confidence geometry assignment.

Special/institutional polygons with no safely matched resident projection remain visible in gray and are excluded from population-based ranking.

## Sources

### Official 2026 barrio population projections

Official Medellín/DANE workbook:
`https://www.medellin.gov.co/es/wp-content/uploads/2022/08/5.-Proyecciones-poblacionales-a-nivel-Barrios-y-Veredas-Medellin-2018-%E2%80%93-2030.xlsx`

The official Medellín data page states the projections were updated by DANE on 30 July 2025. Ourea uses the **2026 total population** field.

### Official socioeconomic quality-of-life measure

Official Medellín 2023 IMCV workbook:
`https://www.medellin.gov.co/es/wp-content/uploads/2022/08/socializacionIMCV2023.xlsx`

Ourea uses the official **AMPI-AMPI 2023** value at comuna/corregimiento level. Lower values are treated as relatively worse socioeconomic conditions.

### Official mass-movement hazard

The existing official Medellín mass-movement hazard polygons are intersected with official barrio polygons. Ourea retains the previously derived high/medium hazard area shares.

## Matching policy

Ourea uses:
1. exact normalized names;
2. a small explicit alias table for known official naming variants;
3. high-confidence fuzzy matching only for obvious spelling/prefix variants;
4. no forced match for ambiguous records.

Machine-readable audit:
`data/derived/city_population_2026_barrio_match.csv`

Source hashes and matching counts:
`data/derived/city_screening_source_metadata.json`

## Hazard-weighted population proxy

For barrio `i`, define a static hazard-coverage factor:

`H_i = clip(high_share_i + 0.5 × medium_share_i, 0, 1)`

Then:

`hazard_weighted_population_proxy_i = population_2026_i × H_i`

This is intentionally a **screening proxy**.

### Important assumption

The calculation assumes projected residents are distributed uniformly across the barrio when translating hazard-area coverage into a population-exposure proxy.

That assumption is not suitable for parcel-level intervention decisions; it is only used for first-stage city screening.

## Exposure component

Because barrio populations vary strongly, the hazard-weighted population proxy is log-transformed before min-max normalization:

`E_i = normalize(log(1 + hazard_weighted_population_proxy_i))`

`E_i ∈ [0,1]`

## Socioeconomic vulnerability component

The 2023 IMCV/AMPI value is available at comuna level, so every barrio inside the same comuna currently shares that socioeconomic value.

For matched urban barrios:

`V_i = (IMCV_max - IMCV_i) / (IMCV_max - IMCV_min)`

Higher `V_i` means relatively weaker socioeconomic conditions.

### Important limitation

This is **coarse within a comuna**. It is not a barrio-specific deprivation index and should not be described as one.

## Three transparent planning lenses

Ourea intentionally does not hide policy choices inside one ranking.

### Exposure lens

`priority_exposure_i = E_i`

Use when the decision question is primarily:
> Where is the largest hazard-weighted projected population exposure?

### Balanced lens

`priority_balanced_i = 0.75 E_i + 0.25 V_i`

Use as the default city shortlist: exposure dominates, while socioeconomic conditions remain visible.

### Equity lens

`priority_equity_i = 0.55 E_i + 0.45 V_i`

Use to inspect how a stronger equity emphasis changes the shortlist.

These weights are **transparent development policy settings**, not empirically calibrated welfare weights.

## Llanaditas No. 2 result

Current Ourea result:
- projected 2026 population: **10,416**;
- hazard-only rank: **#9**;
- exposure rank: **#7**;
- balanced rank: **#13**;
- equity rank: **#22**.

This is useful strategically: the proving ground is **not cherry-picked as the #1 barrio** under every metric.

Llanaditas is selected because it combines:
- substantial hazard/exposure;
- upper-hillside vulnerability;
- dense detailed data coverage;
- active local risk/adaptation work;
- a historical June 2022 event suitable for hindcast validation.

## What would improve the city screen next

Without inventing precision, the next citywide enrichments would be:
- building/population distribution inside each barrio rather than uniform population assumption;
- more granular social vulnerability than comuna-level IMCV;
- citywide critical-access / essential-facility connectivity;
- calibrated climate-driver information when suitable citywide data are available.

Until then, the Ourea screen should be presented as:

> **A transparent city-scale shortlist for deeper adaptation analysis, not a climate-risk prediction.**

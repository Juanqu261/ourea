# Public data enrichment

Accessed 7 October 2026. This pass adds public context around the corridor decision. It does not replace the Level 1 institutional series, and it does not change the portfolio.

## What each value is allowed to do

| Source | Effect |
| --- | --- |
| Challenge packet and current municipal classes | Score |
| CORNARE GIS layers already cached | Map only |
| Fichas de adaptación, 2026 | Explainability |
| Referentes ambientales 2024–2027 | Explainability |
| Plan regional Valles de San Nicolás, 2026 | Explainability. Not applied to the score |
| Observatorio dashboards | Not used as numbers. The session did not return a series |

## Sources searched

- Observatorio Ambiental CORNARE, cambio climático, and the three integrated dashboards (riesgo 84, vulnerabilidad 88, amenaza 79).
- WordPress media on the Observatorio for the 2026 adaptation products.
- CORNARE ArcGIS at `mapas.cornare.gov.co`, already cached in the spatial pipeline.
- Referentes ambientales 2024–2027 for Guarne, Marinilla and Rionegro.
- Plan de adaptación regional Valles de San Nicolás (M-E-2852).

## Observatorio endpoints

The climate page is WordPress. The dashboards are a HYG/MapGIS application, not a JSON collection.

| Request | Result |
| --- | --- |
| GET `/crecimiento-verde-y-cambio-climatico/cambio-climatico/` | 200, about 216 KB of HTML |
| GET `/indicadores/verTablero.hyg?app=1&id=84` | 200, dashboard shell |
| GET `verTablero.hyg?app=1&id=88` and `id=79` | 200, same shell |
| POST `/mapgis9/inicioAjax.do` with `app=0&appPublic=1` | 200, empty body |

`tablero.js` then calls `consultarParametrosCliente.hyg` and `cargardatos.hyg` with a session token. The public session post returned no token, so municipality × dimension × scenario series were not downloaded. Index PNGs were not scraped as scores.

The reproducible probe is `scripts/climaterisk/fetch_observatorio_data.py`.

## Documents downloaded

Cached under `data/public/` and not committed:

- `Copia-de-M-E-2897_Fichas_Adaptacion_Municipales.xlsx` (275,666 bytes).
- `RA_Guarne.pdf`, `RA_Marinilla.pdf`, `RA_Rionegro.pdf`, 19 pages each.
- `Copia-de-M-E-2852-Plan-Adaptacion-Regional-VSN-CORNARE-v2.pdf`, 65 pages, 1.9 MB.

Derived JSON tracked with the app:

- `frontend/public/data/cornare/measure_fichas.json`
- `frontend/public/data/cornare/municipal_context.json`

## Values extracted

Fichas, Producto 15. Each mapped measure has `score_effect: "none"`. Áreas protegidas reports a consolidated SIRAP. That is precedent, not a parcel.

Referentes 2024–2027, verified in the PDF text:

- Guarne: 769 active concession/RURH files and 1.76 m³/s concessioned. Urban domestic supply 145.83 l/s from La Charanga, La Brizuela and El Salado (brazo La Honda).
- Marinilla: urban domestic supply 144.9 l/s from Barbacoas and La Bolsa. Those intakes are described as excellent quality. 272 active concession files.
- Rionegro: urban domestic supply 982.15 l/s from Río Negro, Abreo Mal Paso and La Pereira. 710 active concession files. La Pereira intake is described as poor quality.

The pypdf extract renders the cubic-metre unit as `m/three.sups/s`. The digits 1,76 sit on the concessioned-flow sentence. The briefs in `municipal_context.json` use that reading and do not enter the optimizer.

Plan regional VSN, Tabla 6.1, average vulnerability for the nine-municipality region: biodiversity 0.55 Alto, water 0.53 Alto, disaster 0.33 Medio, food 0.29 Medio, infrastructure 0.27 Medio, habitat 0.25 Medio, health 0.20 Bajo.

Tabla 6.2 ranks regional measures with the published 70/15/15 rule. The workshop column is “% de municipios de la regional”, not a count inside Rionegro, Guarne and Marinilla. The top rows are PSA (6.35), water efficiency (4.95), agricultural soils (3.55), risk knowledge (3.25), green space (3.25) and SUDS (2.95).

## Why the portfolio did not change

The corridor score still uses the municipal classes and the documented action recurrence from the challenge packet. The 15% participatory term stays withheld.

The VSN table is real, and it is the wrong geography and the wrong index to merge. It covers nine municipalities, its general scores are not the corridor objective, and its workshop percentages are shares of the regional set. Applying them would replace Level 1 municipal evidence. The institutional portfolio remains:

`bio_pa`, `food_agro`, `hab_green`, `health`, `risk_knowledge`, `water_eff`

Cost 4,800 of 5,000. Fingerprint unchanged from the baseline decision model.

## Gaps

| Gap | Class | Why |
| --- | --- | --- |
| Named aqueduct sources and concession context | RESOLVED_PUBLIC | Referentes 2024–2027 |
| Institutional status of the regional measures | PARTIALLY_RESOLVED | Fichas describe status, not a corridor site |
| Workshop recurrence inside the three municipalities | INSTITUTIONAL_DATA_REQUIRED | Only the nine-municipality percentage was published |
| SSP3-7.0 series beyond Rionegro disaster risk | INSTITUTIONAL_DATA_REQUIRED | Observatorio session returned no table |
| Company-to-source dependency | FIELD_VALIDATION | Public hydrology does not name the user |
| Exact project site | FIELD_VALIDATION | Candidate context is not a selected worksite |

## Rejected uses

- Observatorio map images, as numeric inputs.
- The 2017 precipitation study, as a replacement for SSP3-7.0. It was not needed once the 2026 regional plan was read, and it stays historical only.
- Participant totals (58 workshops, 1,031 people, or the 2025 semester counts). They are not measure recurrence.
- Regional average vulnerability, as a substitute for Rionegro 0.75 or Marinilla 0.72.

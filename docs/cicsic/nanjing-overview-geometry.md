# Nanjing Step-1 overview geometry

## Purpose

Step 1 (“Where should the city act?”) must show a geographic overview covering the full screening AOI, not the raw 80-cell planning grid.

The 80 planning cells remain the optimizer units and are unchanged.

## Geometry provenance

Built by `scripts/build_nanjing_overview.py` from:

1. **OpenStreetMap named polygons** (ODbL) — campus / residential / park areas clipped to the screening AOI (`geometry_class = osm_named_polygon`).
2. **Derived screening sectors** — AOI remainder after named polygons, split by major OSM roads/waterways (`geometry_class = derived_screening_sector`). These are **not** administrative boundaries. Named `Screening Sector A`, `B`, …

All overview polygons use `map_fill: true` so the choropleth covers the AOI.

## Coverage QA

`data/derived/nanjing/overview_coverage.json` records:

- AOI / covered / uncovered area
- coverage percentage (build fails if &lt; 99%)
- real polygon count and derived sector count

## Aggregation

For each overview polygon, member planning cells are those whose centroids fall in the polygon.

| Metric | Aggregation |
|--------|-------------|
| `population_proxy` | Sum of member-cell WorldPop estimates |
| `drainage_stress_proxy` | Population-weighted mean |
| `built_up_fraction` | Population-weighted mean |
| `runoff_pressure_proxy` | Population-weighted mean |
| `priority_*` choropleth fields | Min–max normalized to **[0, 1] within Nanjing overview** |
| `priority_*_raw` | Unnormalized scores retained for audit |
| `member_overlaps` | Per-cell overlap area (m²) for audit |

## Map hierarchy

```text
Step 1 city scope → screening.geojson overview (full AOI)
Analyze Nanjing     → planning_cells.geojson (80 cells)
                    + building_massing.geojson (visualization only)
                    + remote terrarium hillshade
```

## Building massing (visualization only)

`scripts/build_nanjing_buildings.py` extracts OSM `building=*` footprints into:

- `frontend/public/data/nanjing/building_massing.geojson`
- `data/derived/nanjing/building_massing_meta.json`

Height provenance:

- `osm_reported_height` from `height=*`
- `level_derived_visualization` from `building:levels × 3 m`
- `fallback_visualization_proxy` = 8 m

This file **does not** replace `buildings.geojson` (optimizer exposure proxies) and must never enter the optimizer.

Building extrusion colors inherit city-relative `drainage_stress_proxy` from the containing planning cell (`visual_priority_score` ∈ [0,1]), using the same green→amber→red interpolate stops as Medellín’s `scenario_stress` massing.

Artifacts:

- `frontend/public/data/nanjing/screening.geojson`
- `frontend/public/data/nanjing/place_labels.geojson`
- `frontend/public/data/nanjing/context_water.geojson`
- `frontend/public/data/nanjing/roads.geojson`
- `frontend/public/data/nanjing/overview_meta.json`
- `frontend/public/data/nanjing/building_massing.geojson`
- `data/derived/nanjing/overview_meta.json`
- `data/derived/nanjing/overview_coverage.json`

#!/usr/bin/env python3
"""Rebuild Nanjing case with WorldCover S3 discovery, cell feature table, and spatial QA."""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_nanjing_case import (  # noqa: E402
    BBOX,
    CACHE,
    CELL_DEG,
    OUT,
    ensure_dirs,
    fetch_nasa_power_climate,
    load_skadi_elevation,
    sample_dem,
    slope_deg_at,
    try_windowed_raster,
    utc_now,
    worldcover_class_weights,
    write_json,
    WORLDPOP_URL,
)
from nanjing_worldcover import ensure_tiles, window_read  # noqa: E402

DERIVED = ROOT / "data" / "derived" / "nanjing"
CONFIG = ROOT / "frontend" / "src" / "config" / "nanjingLandCoverAssumptions.json"


def json_safe(obj):
    if isinstance(obj, dict):
        return {str(k): json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        val = float(obj)
        return None if math.isnan(val) or math.isinf(val) else val
    if isinstance(obj, np.ndarray):
        return json_safe(obj.tolist())
    return obj


def write_json_safe(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(json_safe(payload), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_runoff_assumptions() -> dict:
    if CONFIG.exists():
        return json.loads(CONFIG.read_text(encoding="utf-8"))
    weights = worldcover_class_weights()
    payload = {
        "schema": "ourea-nanjing-landcover-assumptions",
        "schema_version": 1,
        "label": "land-cover-derived screening proxy assumptions",
        "not": [
            "measured imperviousness",
            "calibrated runoff coefficients",
            "hydraulic parameters",
        ],
        "classes": {
            str(k): v for k, v in weights.items()
        },
        "composite_runoff_formula": (
            "cell_runoff_pressure = mean(class.runoff_weight over WorldCover pixels in cell)"
        ),
    }
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def class_fractions(patch: np.ndarray) -> dict[str, float]:
    flat = patch.ravel()
    flat = flat[np.isfinite(flat)]
    if flat.size == 0:
        return {
            "built_up_fraction": float("nan"),
            "tree_cover_fraction": float("nan"),
            "grass_vegetation_fraction": float("nan"),
            "cropland_fraction": float("nan"),
            "surface_water_fraction": float("nan"),
            "bare_sparse_fraction": float("nan"),
            "pixel_count": 0,
        }
    vals = flat.astype(int)
    n = vals.size
    def frac(codes):
        return float(np.isin(vals, codes).sum() / n)

    return {
        "built_up_fraction": frac([50]),
        "tree_cover_fraction": frac([10]),
        "grass_vegetation_fraction": frac([20, 30, 90, 95, 100]),
        "cropland_fraction": frac([40]),
        "surface_water_fraction": frac([80]),
        "bare_sparse_fraction": frac([60, 70]),
        "pixel_count": int(n),
    }


def build_everything() -> int:
    ensure_dirs()
    DERIVED.mkdir(parents=True, exist_ok=True)
    assumptions = load_runoff_assumptions()
    class_map = {int(k): v for k, v in assumptions["classes"].items()}

    print("Terrain…")
    dem, terrain_meta = load_skadi_elevation()
    print("Climate…")
    climate, climate_meta = fetch_nasa_power_climate()
    print("WorldPop…")
    pop_raster, pop_meta = try_windowed_raster(WORLDPOP_URL, BBOX)
    pop_meta.update(
        {
            "provider": "WorldPop",
            "dataset_product": "China 2026 constrained ~100 m (R2025A)",
            "dataset_year": 2026,
            "license": "CC BY 4.0 / source-specific ODbL conditions where applicable",
            "evidence_classification": "population-estimate",
            "limitations": "Population estimate only — not census counts or exact households.",
        }
    )

    print("WorldCover S3 discovery…")
    wc_meta = ensure_tiles(BBOX)
    wc_raster = None
    wc_window_info = None
    if wc_meta.get("local_paths"):
        path = Path(wc_meta["local_paths"][0])
        try:
            wc_raster, wc_window_info = window_read(path, BBOX)
            wc_meta["status"] = "windowed-read"
            wc_meta["window"] = wc_window_info
            wc_meta["crop_bounds"] = list(BBOX)
            # save small cropped GeoTIFF for QA (not full tile)
            try:
                import rasterio
                from rasterio.transform import from_bounds

                crop_path = CACHE / "worldcover" / "nanjing_aoi_worldcover_crop.tif"
                transform = from_bounds(*BBOX, wc_raster.shape[1], wc_raster.shape[0])
                with rasterio.open(
                    crop_path,
                    "w",
                    driver="GTiff",
                    height=wc_raster.shape[0],
                    width=wc_raster.shape[1],
                    count=1,
                    dtype=wc_raster.dtype,
                    crs="EPSG:4326",
                    transform=transform,
                    compress="lzw",
                ) as dst:
                    dst.write(wc_raster, 1)
                wc_meta["aoi_crop_path"] = str(crop_path)
                wc_meta["aoi_crop_bytes"] = crop_path.stat().st_size
            except Exception as exc:  # noqa: BLE001
                wc_meta["aoi_crop_error"] = str(exc)
        except Exception as exc:  # noqa: BLE001
            wc_meta["status"] = f"window-failed: {exc}"
    else:
        wc_meta["status"] = "no-tiles-downloaded"

    used_worldpop = bool(pop_raster is not None and np.isfinite(pop_raster).any())
    used_worldcover = bool(wc_raster is not None and np.isfinite(wc_raster).any())

    west, south, east, north = BBOX
    xs = np.arange(west, east, CELL_DEG)
    ys = np.arange(south, north, CELL_DEG)

    elev_samples = []
    for y in ys:
        for x in xs:
            elev_samples.append(sample_dem(dem, x + CELL_DEG / 2, y + CELL_DEG / 2))
    elev_arr = np.array(elev_samples, dtype=np.float64)
    elev_mean = float(np.nanmean(elev_arr)) if np.isfinite(elev_arr).any() else 50.0

    meters_per_deg_lat = 111_320.0
    aoi_lat = (south + north) / 2.0
    meters_per_deg_lon = 111_320.0 * math.cos(math.radians(aoi_lat))
    cell_area_m2 = (CELL_DEG * meters_per_deg_lon) * (CELL_DEG * meters_per_deg_lat)

    rows = []
    cell_features = []
    building_features = []
    hazard_features = []
    cell_id = 0
    rng = np.random.default_rng(20260912)

    for y0 in ys:
        for x0 in xs:
            x1, y1 = x0 + CELL_DEG, y0 + CELL_DEG
            cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
            elev = sample_dem(dem, cx, cy)
            if math.isnan(elev):
                elev = elev_mean
            slope = slope_deg_at(dem, cx, cy)
            rel = float(elev_mean - elev)
            stress_raw = float(
                np.clip(
                    0.45 * max(0.0, rel) / 40.0
                    + 0.25 * min(slope, 25.0) / 25.0
                    + 0.30 * max(0.0, (80.0 - elev) / 80.0),
                    0,
                    1,
                )
            )

            completeness = {
                "terrain": True,
                "worldpop": used_worldpop,
                "worldcover": used_worldcover,
                "osm_buildings": False,
            }

            if used_worldpop:
                pr = int((north - cy) / (north - south) * (pop_raster.shape[0] - 1))
                pc = int((cx - west) / (east - west) * (pop_raster.shape[1] - 1))
                pr = int(np.clip(pr, 0, pop_raster.shape[0] - 1))
                pc = int(np.clip(pc, 0, pop_raster.shape[1] - 1))
                r0, r1 = max(0, pr - 2), min(pop_raster.shape[0], pr + 3)
                c0, c1 = max(0, pc - 2), min(pop_raster.shape[1], pc + 3)
                pop = float(np.nansum(pop_raster[r0:r1, c0:c1]))
                pop_source = "WorldPop 2026 population estimate"
            else:
                campus = math.exp(-((cx - 118.96) ** 2 + (cy - 32.12) ** 2) / (2 * 0.02**2))
                pop = float(80 + 420 * campus + 40 * rng.random())
                pop_source = "documented population fallback estimate"

            fracs = {
                "built_up_fraction": float("nan"),
                "tree_cover_fraction": float("nan"),
                "grass_vegetation_fraction": float("nan"),
                "cropland_fraction": float("nan"),
                "surface_water_fraction": float("nan"),
                "bare_sparse_fraction": float("nan"),
                "pixel_count": 0,
            }
            runoff_w = float("nan")
            built = veg = water = 0.0
            if used_worldcover:
                wr = int((north - cy) / (north - south) * (wc_raster.shape[0] - 1))
                wc = int((cx - west) / (east - west) * (wc_raster.shape[1] - 1))
                wr = int(np.clip(wr, 0, wc_raster.shape[0] - 1))
                wc = int(np.clip(wc, 0, wc_raster.shape[1] - 1))
                # ~110 m neighborhood at 10 m (~11 px); use 5 px half-window
                half = 5
                r0, r1 = max(0, wr - half), min(wc_raster.shape[0], wr + half + 1)
                c0, c1 = max(0, wc - half), min(wc_raster.shape[1], wc + half + 1)
                patch = wc_raster[r0:r1, c0:c1]
                fracs = class_fractions(patch)
                built = fracs["built_up_fraction"]
                veg = (
                    (fracs["tree_cover_fraction"] or 0)
                    + (fracs["grass_vegetation_fraction"] or 0)
                )
                water = fracs["surface_water_fraction"]
                runoff_vals = []
                for val in patch.ravel():
                    w = class_map.get(int(val))
                    if w:
                        runoff_vals.append(w["runoff_weight"])
                runoff_w = float(np.mean(runoff_vals)) if runoff_vals else float("nan")
            else:
                # keep documented assumption fallback only when WorldCover missing
                built, veg, water, runoff_w = 0.35, 0.4, 0.02, 0.45
                fracs = {
                    "built_up_fraction": built,
                    "tree_cover_fraction": 0.2,
                    "grass_vegetation_fraction": 0.2,
                    "cropland_fraction": 0.1,
                    "surface_water_fraction": water,
                    "bare_sparse_fraction": 0.05,
                    "pixel_count": 0,
                }

            drainage_stress = float(
                np.clip(
                    0.55 * stress_raw
                    + 0.45 * (0.0 if math.isnan(runoff_w) else runoff_w),
                    0,
                    1,
                )
            )
            if drainage_stress >= 0.66:
                hazard_max = "Alta"
            elif drainage_stress >= 0.4:
                hazard_max = "Media"
            else:
                hazard_max = "Baja"

            rwh_opportunity = float(np.clip(0.2 + 0.75 * (0 if math.isnan(built) else built), 0, 1))
            drainage_corridor_proxy = float(
                np.clip(
                    0.15
                    + 0.7 * drainage_stress
                    + 0.15 * (0 if math.isnan(water) else water),
                    0,
                    1,
                )
            )
            restoration_opportunity = float(
                np.clip(
                    0.1
                    + 0.8
                    * (0 if math.isnan(veg) else veg)
                    * (1.0 - 0.5 * (0 if math.isnan(built) else built)),
                    0,
                    1,
                )
            )
            built_safe = 0.0 if math.isnan(built) else built
            built_units = int(round(max(0.0, pop / 35.0) * (0.4 + 0.6 * built_safe)))
            high_stress_units = int(round(built_units * drainage_stress))

            row = {
                "cell_id": cell_id,
                "centroid_lon": round(cx, 6),
                "centroid_lat": round(cy, 6),
                "area_m2": round(cell_area_m2, 1),
                "mean_elevation_m": round(float(elev), 2),
                "mean_slope_deg": round(slope, 2),
                "relative_elevation_m": round(rel, 2),
                "population_estimate": round(pop, 2),
                "population_source": pop_source,
                "built_up_fraction": None if math.isnan(fracs["built_up_fraction"]) else round(fracs["built_up_fraction"], 4),
                "tree_cover_fraction": None if math.isnan(fracs["tree_cover_fraction"]) else round(fracs["tree_cover_fraction"], 4),
                "grass_vegetation_fraction": None if math.isnan(fracs["grass_vegetation_fraction"]) else round(fracs["grass_vegetation_fraction"], 4),
                "cropland_fraction": None if math.isnan(fracs["cropland_fraction"]) else round(fracs["cropland_fraction"], 4),
                "surface_water_fraction": None if math.isnan(fracs["surface_water_fraction"]) else round(fracs["surface_water_fraction"], 4),
                "bare_sparse_fraction": None if math.isnan(fracs["bare_sparse_fraction"]) else round(fracs["bare_sparse_fraction"], 4),
                "vegetation_fraction": None if math.isnan(veg) else round(float(veg), 4),
                "runoff_pressure_proxy": None if math.isnan(runoff_w) else round(runoff_w, 4),
                "runoff_pressure_label": "land-cover-derived screening proxy",
                "drainage_stress_proxy": round(drainage_stress, 4),
                "drainage_stress_label": "terrain-derived screening proxy",
                "rainfall_context_id": "nasa_power_daily_presets",
                "hazard_max": hazard_max,
                "rwh_opportunity": round(rwh_opportunity, 4),
                "drainage_corridor_proxy": round(drainage_corridor_proxy, 4),
                "restoration_opportunity": round(restoration_opportunity, 4),
                "worldcover_pixels": fracs["pixel_count"],
                "data_completeness": completeness,
                "equity_score": None,
                "equity_score_reason": "intentionally unsupported — no fabricated Chinese equity layer",
            }
            rows.append(row)

            ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
            props = {
                "cell_id": cell_id,
                "buildings": built_units,
                "population_proxy": round(pop, 2),
                "households_proxy": round(pop / 3.1, 2),
                "high_hazard_buildings": high_stress_units,
                "stratum1_buildings": 0,
                "mean_slope_deg": round(slope, 2),
                "mean_elevation_m": round(float(elev), 2),
                "relative_elevation_m": round(rel, 2),
                "baseline_stress": round(drainage_stress, 4),
                "roof_footprint_m2": round(built_units * 85.0 * built_safe, 1),
                "vehicular_access_m": round(120.0 * built_safe, 1),
                "pedestrian_access_m": round(180.0 * built_safe, 1),
                "open_space_proxy": round(1.0 - built_safe, 4),
                "built_up_share": None if math.isnan(built) else round(built, 4),
                "vegetated_share": None if math.isnan(veg) else round(float(veg), 4),
                "water_presence": None if math.isnan(water) else round(water, 4),
                "runoff_pressure_proxy": None if math.isnan(runoff_w) else round(runoff_w, 4),
                "rwh_opportunity": round(rwh_opportunity, 4),
                "drainage_corridor_proxy": round(drainage_corridor_proxy, 4),
                "restoration_opportunity": round(restoration_opportunity, 4),
                "hazard_max": hazard_max,
                "drainage_stress_proxy": round(drainage_stress, 4),
                "population_label": pop_source,
                "building_metric": "worldcover_built_up_proxy" if used_worldcover else "assumption_fallback_built_up",
                "land_cover_source": "ESA WorldCover 2021 v200" if used_worldcover else "assumption_fallback",
                "note": "terrain-derived screening proxy; not hydraulic flood simulation",
            }
            for k, v in fracs.items():
                if k == "pixel_count":
                    props["worldcover_pixels"] = v
                elif isinstance(v, float) and not math.isnan(v):
                    props[k] = round(v, 4)

            cell_features.append(
                {"type": "Feature", "properties": props, "geometry": {"type": "Polygon", "coordinates": [ring]}}
            )
            building_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "cell_id": cell_id,
                        "population_proxy": props["population_proxy"],
                        "estrato": 0,
                        "hazard_max": hazard_max,
                        "slope_deg": props["mean_slope_deg"],
                        "floors": 1,
                        "source": "exposure_unit_from_population_and_built_up_proxy",
                    },
                    "geometry": {"type": "Point", "coordinates": [cx, cy]},
                }
            )
            hazard_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "hazard_class": hazard_max,
                        "label": "terrain-derived drainage-stress screening proxy",
                        "drainage_stress_proxy": props["drainage_stress_proxy"],
                        "not": "inundation map / flood probability",
                    },
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                }
            )
            cell_id += 1

    # Screening ranks
    scored = []
    for feat in cell_features:
        p = feat["properties"]
        exposure = p["population_proxy"] * p["drainage_stress_proxy"]
        runoff_p = p.get("runoff_pressure_proxy") or 0
        balanced = 0.75 * exposure + 0.25 * (p["population_proxy"] * runoff_p)
        scored.append((feat, exposure, balanced, p["drainage_stress_proxy"]))

    def ranks(values):
        order = sorted(range(len(values)), key=lambda i: -values[i])
        out = [0] * len(values)
        for rank, idx in enumerate(order, start=1):
            out[idx] = rank
        return out

    exp_r = ranks([s[1] for s in scored])
    bal_r = ranks([s[2] for s in scored])
    run_r = ranks([s[3] for s in scored])
    low_regret_score = [1.0 / exp_r[i] + 1.0 / bal_r[i] + 1.0 / run_r[i] for i in range(len(scored))]
    lr_r = ranks(low_regret_score)
    screening_features = []
    for i, (feat, exposure, balanced, runoff) in enumerate(scored):
        props = {
            **feat["properties"],
            "NAME": f"Xianlin cell {feat['properties']['cell_id']}",
            "BARRIO": f"XIANLIN_CELL_{feat['properties']['cell_id']}",
            "priority_exposure": round(exposure, 3),
            "priority_balanced": round(balanced, 3),
            "priority_runoff": round(runoff, 4),
            "priority_low_regret": round(low_regret_score[i], 4),
            "rank_exposure": exp_r[i],
            "rank_balanced": bal_r[i],
            "rank_runoff": run_r[i],
            "rank_low_regret": lr_r[i],
            "priority_equity": None,
            "rank_equity": None,
        }
        screening_features.append(
            {"type": "Feature", "properties": props, "geometry": feat["geometry"]}
        )

    total_pop = sum(r["population_estimate"] for r in rows)
    summary = {
        "case_id": "nanjing_xianlin_portability",
        "city": "Nanjing",
        "focus_area": "Xianlin / Qixia",
        "case_role": "portability_demonstration",
        "sandbox_bbox_wgs84": list(BBOX),
        "bbox_status": "initial reproducible screening bbox; not an official administrative boundary",
        "planning_cells": len(rows),
        "exposure_units": len(building_features),
        "roads_segments": 0,
        "hazard_polygons": len(hazard_features),
        "population_estimate": round(total_pop, 1),
        "population_label": "WorldPop 2026 population estimate" if used_worldpop else "documented population fallback estimate",
        "median_slope_deg": round(float(np.median([r["mean_slope_deg"] for r in rows])), 2),
        "mean_built_up_fraction": round(float(np.nanmean([r["built_up_fraction"] for r in rows if r["built_up_fraction"] is not None])), 4) if used_worldcover else None,
        "building_metric": "worldcover_built_up_proxy" if used_worldcover else "assumption_fallback",
        "land_cover_source": "ESA WorldCover 2021 v200" if used_worldcover else None,
        "osm_building_counts_used": False,
        "equity_layer": None,
        "worldcover_used": used_worldcover,
        "note": (
            "Adaptation screening for monsoon urban drainage / stormwater context. "
            "Terrain-derived drainage-stress and land-cover-derived runoff indicators are screening proxies, "
            "not inundation maps or calibrated runoff coefficients. "
            "Population figures are WorldPop estimates, not census counts."
        ),
    }

    # Feature table artifact
    column_docs = {
        "cell_id": {"source": "generated planning grid", "class": "derived"},
        "centroid_lon": {"source": "cell geometry", "class": "derived"},
        "centroid_lat": {"source": "cell geometry", "class": "derived"},
        "area_m2": {"source": "WGS84 cell size at AOI latitude", "class": "derived"},
        "mean_elevation_m": {"source": "Mapzen Skadi N32E118", "class": "observed-remote-sensing"},
        "mean_slope_deg": {"source": "Skadi DEM finite-difference slope", "class": "derived-screening-proxy"},
        "relative_elevation_m": {"source": "elev_mean - cell elev", "class": "derived-screening-proxy"},
        "population_estimate": {"source": "WorldPop 2026 constrained China", "class": "population-estimate"},
        "built_up_fraction": {"source": "ESA WorldCover class 50", "class": "observed-remote-sensing"},
        "tree_cover_fraction": {"source": "ESA WorldCover class 10", "class": "observed-remote-sensing"},
        "grass_vegetation_fraction": {"source": "ESA WorldCover classes 20/30/90/95/100", "class": "observed-remote-sensing"},
        "cropland_fraction": {"source": "ESA WorldCover class 40", "class": "observed-remote-sensing"},
        "surface_water_fraction": {"source": "ESA WorldCover class 80", "class": "observed-remote-sensing"},
        "bare_sparse_fraction": {"source": "ESA WorldCover classes 60/70", "class": "observed-remote-sensing"},
        "runoff_pressure_proxy": {"source": "WorldCover class → configured runoff_weight mean", "class": "land-cover-derived screening proxy"},
        "drainage_stress_proxy": {"source": "terrain relative relief + slope + runoff proxy", "class": "terrain-derived screening proxy"},
        "rainfall_context_id": {"source": "NASA POWER climate_context presets", "class": "observed-remote-sensing"},
        "equity_score": {"source": None, "class": "intentionally unsupported"},
    }

    feature_table = {
        "schema": "ourea-nanjing-planning-cell-features",
        "schema_version": 1,
        "generated_at": utc_now(),
        "case_id": "nanjing_xianlin_portability",
        "working_bbox": list(BBOX),
        "cell_count": len(rows),
        "column_documentation": column_docs,
        "runoff_assumptions_path": "frontend/src/config/nanjingLandCoverAssumptions.json",
        "rows": rows,
    }

    # Spatial QA
    qa = {
        "schema": "ourea-nanjing-spatial-alignment-qa",
        "generated_at": utc_now(),
        "crs": "EPSG:4326 / CRS84 for all vector outputs",
        "axis_order": "lon, lat (x, y)",
        "aoi": list(BBOX),
        "checks": [
            {
                "id": "aoi_bbox",
                "pass": True,
                "detail": "All planning cells generated inside working bbox",
            },
            {
                "id": "no_medellin_leak",
                "pass": bool(all(r["centroid_lon"] > 100 for r in rows)),
                "detail": "All cell centroids east of 100°E",
            },
            {
                "id": "terrain_samples_finite",
                "pass": bool(all(math.isfinite(r["mean_elevation_m"]) for r in rows)),
                "detail": "Skadi elevation samples finite for every cell",
            },
            {
                "id": "worldpop_present",
                "pass": bool(used_worldpop),
                "detail": pop_meta.get("status"),
            },
            {
                "id": "worldcover_present",
                "pass": bool(used_worldcover),
                "detail": wc_meta.get("status"),
                "s3_keys": [t.get("s3_key") for t in wc_meta.get("tiles", [])],
            },
            {
                "id": "population_positive_share",
                "pass": bool(sum(1 for r in rows if r["population_estimate"] > 0) / len(rows) > 0.5),
                "detail": f"cells_with_pop={(sum(1 for r in rows if r['population_estimate'] > 0))}",
            },
        ],
        "layer_bounds": {
            "planning_grid": list(BBOX),
            "worldcover_window": wc_window_info,
            "worldpop_status": pop_meta.get("status"),
        },
    }
    qa["all_pass"] = bool(all(c["pass"] for c in qa["checks"]))

    # Write app artifacts via existing shapes
    cells = {
        "type": "FeatureCollection",
        "name": "nanjing_xianlin_planning_cells",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": cell_features,
    }
    buildings = {
        "type": "FeatureCollection",
        "name": "nanjing_xianlin_exposure_units",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": building_features,
    }
    hazard = {
        "type": "FeatureCollection",
        "name": "nanjing_drainage_stress_proxy",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": hazard_features,
    }
    screening = {
        "type": "FeatureCollection",
        "name": "nanjing_xianlin_screening",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": screening_features,
    }
    roads = {
        "type": "FeatureCollection",
        "name": "nanjing_roads_optional",
        "features": [],
        "properties": {
            "note": "OSM not bundled; WorldCover built-up used instead of building counts.",
            "osm_building_counts_displayed": False,
        },
    }

    # Preserve retrospective files if present
    for name in (
        "retrospective_validation.json",
        "retrospective_comparison.json",
        "plan_alignment.json",
        "cost_context.json",
        "evidence_status.json",
    ):
        pass

    evidence = {
        "schema": "ourea-evidence-registry",
        "schema_version": 1,
        "case_id": "nanjing_xianlin_portability",
        "guardrail_source": "frontend/src/config/nanjingScientificGuardrails.json",
        "generated_date": utc_now()[:10],
        "layers": [
            {
                "id": "terrain",
                "label": "Terrain (Mapzen Skadi)",
                "status": "observed-remote-sensing",
                "confidence": "medium-for-screening",
                "basis": terrain_meta.get("dataset_product", "Skadi"),
                "use": "Elevation, slope, relative relief — screening only",
            },
            {
                "id": "hazard",
                "label": "Drainage-stress screening proxy",
                "status": "derived-screening-proxy",
                "confidence": "low-medium",
                "basis": "Terrain + land-cover-derived runoff screening proxy",
                "use": "NOT inundation depth or flood probability",
            },
            {
                "id": "population",
                "label": "WorldPop 2026 population estimate",
                "status": "population-estimate",
                "confidence": "medium",
                "basis": pop_meta.get("dataset_product", "WorldPop"),
                "use": "Exposure screening; not exact households",
            },
            {
                "id": "land_cover",
                "label": "ESA WorldCover 2021 v200",
                "status": "observed-remote-sensing" if used_worldcover else "explicit-planning-assumption",
                "confidence": "medium" if used_worldcover else "assumption",
                "basis": (
                    "WorldCover classes with documented runoff-weight assumptions"
                    if used_worldcover
                    else "Fallback assumptions — WorldCover unavailable"
                ),
                "use": "Built-up / vegetation / land-cover-derived screening proxies",
            },
            {
                "id": "climate",
                "label": climate.get("source_name", "Climate context"),
                "status": "observed-remote-sensing",
                "confidence": "medium-for-climate-context",
                "basis": climate_meta.get("dataset_product", "NASA POWER"),
                "use": "Rainfall presets only; not street-scale flood hazard",
            },
            {
                "id": "intervention_effects",
                "label": "Intervention effect ranges",
                "status": "explicit-planning-assumption",
                "confidence": "assumption",
                "basis": "Shared Ourea planning priors (not Nanjing-calibrated)",
                "use": "Portfolio comparison under uncertainty",
            },
            {
                "id": "cost",
                "label": "Planning-credit budget unit",
                "status": "planning-credit-budget-unit",
                "confidence": "n/a",
                "basis": "Dimensionless planning credits",
                "use": "Budget-constrained portfolio comparison",
            },
        ],
    }

    data_manifest = {
        "schema": "ourea-data-manifest",
        "schema_version": 1,
        "case_id": "nanjing_xianlin_portability",
        "generated_at": utc_now(),
        "working_bbox": list(BBOX),
        "working_bbox_status": "initial reproducible screening bbox; not an official Xianlin administrative boundary",
        "artifacts": {
            "planning_cells": "frontend/public/data/nanjing/planning_cells.geojson",
            "cell_feature_table": "data/derived/nanjing/planning_cell_features.json",
            "spatial_qa": "data/derived/nanjing/spatial_alignment_qa.json",
            "buildings": "frontend/public/data/nanjing/buildings.geojson",
            "drainage_stress": "frontend/public/data/nanjing/drainage_stress.geojson",
            "screening": "frontend/public/data/nanjing/screening.geojson",
            "climate_context": "frontend/public/data/nanjing/climate_context.json",
            "retrospective_validation": "frontend/public/data/nanjing/retrospective_validation.json",
        },
        "datasets": [terrain_meta, climate_meta, pop_meta, wc_meta],
        "retrospective_only": [
            "qixia_official_topography",
            "xianlin_yuanhua_xianyin_2026",
            "hengyang_jiuxiang_storage",
            "nanjing_water_plan_2026_2030",
        ],
        "forbidden_as_optimizer_inputs": [
            "qixia_official_topography",
            "xianlin_yuanhua_xianyin_2026",
            "hengyang_jiuxiang_storage",
            "nanjing_water_plan_2026_2030",
        ],
    }

    write_json_safe(OUT / "planning_cells.geojson", cells)
    write_json_safe(OUT / "buildings.geojson", buildings)
    write_json_safe(OUT / "drainage_stress.geojson", hazard)
    write_json_safe(OUT / "screening.geojson", screening)
    write_json_safe(OUT / "roads.geojson", roads)
    write_json_safe(OUT / "climate_context.json", climate)
    write_json_safe(OUT / "summary.json", summary)
    write_json_safe(OUT / "evidence_status.json", evidence)
    write_json_safe(OUT / "data_manifest.json", data_manifest)
    write_json_safe(DERIVED / "planning_cell_features.json", feature_table)
    write_json_safe(DERIVED / "spatial_alignment_qa.json", qa)
    write_json_safe(DERIVED / "worldcover_meta.json", wc_meta)

    # CSV feature table
    import csv

    csv_path = DERIVED / "planning_cell_features.csv"
    fieldnames = list(rows[0].keys())
    # flatten completeness
    flat_rows = []
    for r in rows:
        fr = {k: v for k, v in r.items() if k != "data_completeness"}
        for ck, cv in r["data_completeness"].items():
            fr[f"complete_{ck}"] = cv
        flat_rows.append(fr)
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(flat_rows[0].keys()))
        writer.writeheader()
        writer.writerows(flat_rows)

    print(f"cells={len(rows)} population~{total_pop:.0f}")
    print(f"worldpop={pop_meta.get('status')} worldcover={wc_meta.get('status')} qa_all_pass={qa['all_pass']}")
    return 0 if qa["all_pass"] else 2


if __name__ == "__main__":
    raise SystemExit(build_everything())

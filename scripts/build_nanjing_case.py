#!/usr/bin/env python3
"""Build the Nanjing / Xianlin portability case artifacts (offline).

Downloads raw sources into Git-ignored caches, crops to the screening AOI,
and writes small versioned JSON/GeoJSON under frontend/public/data/nanjing/.

Never commits nationwide rasters. Official municipal projects are written only
to retrospective_validation.json (optimizer_input=false).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import struct
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "nanjing"
RAW = ROOT / "data" / "raw" / "nanjing"
OUT = ROOT / "frontend" / "public" / "data" / "nanjing"
MANIFEST_SRC = ROOT / "data" / "cases" / "nanjing_case_manifest.json"

# Working screening bbox (WGS84) — not an official administrative boundary.
BBOX = (118.88, 32.075, 118.97, 32.145)  # west, south, east, north
AOI_CENTER = ((BBOX[0] + BBOX[2]) / 2.0, (BBOX[1] + BBOX[3]) / 2.0)
CELL_DEG = 0.01  # ~1 km screening cells
SKADI_URL = "https://s3.amazonaws.com/elevation-tiles-prod/skadi/N32/N32E118.hgt.gz"
WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/CHN/v1/"
    "100m/constrained/chn_pop_2026_CN_100m_R2025A_v1.tif"
)
WORLDCOVER_S3 = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_N30E117.tif"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ensure_dirs() -> None:
    for path in (CACHE, RAW, OUT):
        path.mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path, timeout: int = 120) -> tuple[Path, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest, "cache-hit"
    req = urllib.request.Request(url, headers={"User-Agent": "Ourea-Nanjing-Build/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response, dest.open("wb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    return dest, "downloaded"


def load_skadi_elevation() -> tuple[np.ndarray, dict]:
    """Load Mapzen Skadi N32E118 (1° SRTM-style .hgt, 3601x3601)."""
    gz_path = CACHE / "terrain" / "N32E118.hgt.gz"
    hgt_path = CACHE / "terrain" / "N32E118.hgt"
    status = "missing"
    try:
        _, status = download(SKADI_URL, gz_path, timeout=180)
        if not hgt_path.exists():
            with gzip.open(gz_path, "rb") as src, hgt_path.open("wb") as dst:
                dst.write(src.read())
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        meta = {
            "provider": "Mapzen / AWS Open Data",
            "dataset": "Skadi N32E118",
            "status": f"download-failed: {exc}",
            "endpoint": SKADI_URL,
        }
        # Synthetic fallback DEM for CI without network: gentle south-high / north-low.
        rows = cols = 3601
        ys = np.linspace(0, 1, rows)
        xs = np.linspace(0, 1, cols)
        xx, yy = np.meshgrid(xs, ys)
        dem = (180.0 - 160.0 * yy + 12.0 * np.sin(8 * math.pi * xx) * np.cos(6 * math.pi * yy)).astype(
            np.float32
        )
        meta["fallback"] = "synthetic_south_high_north_low_for_reproducible_ci"
        meta["evidence_classification"] = "derived-screening-proxy"
        meta["limitations"] = (
            "Live Skadi tile unavailable; synthetic DEM preserves only the documented "
            "south-high / north-low screening pattern and must not be treated as measured elevation."
        )
        return dem, meta

    raw = hgt_path.read_bytes()
    # 3601*3601 int16 big-endian
    expected = 3601 * 3601 * 2
    if len(raw) < expected:
        raise RuntimeError(f"Unexpected HGT size: {len(raw)}")
    dem = np.frombuffer(raw[:expected], dtype=">i2").astype(np.float32).reshape(3601, 3601)
    dem[dem < -100] = np.nan
    meta = {
        "provider": "Mapzen / Linux Foundation via AWS Open Data",
        "dataset_product": "Skadi / SRTM-style elevation tiles",
        "original_url": SKADI_URL,
        "access_retrieval_date": utc_now(),
        "dataset_year": "SRTM-era global terrain stack",
        "native_resolution": "~30 m (1 arc-second)",
        "crs": "EPSG:4326",
        "transformation": "gunzip HGT; crop to AOI windows during cell sampling",
        "output_resolution": "~30 m source samples aggregated to ~1 km planning cells",
        "license": "AWS Open Data / Mapzen terrain tiles terms",
        "checksum_sha256": sha256_file(gz_path),
        "evidence_classification": "observed-remote-sensing",
        "limitations": "Screening elevation/slope only; not engineering-grade drainage design.",
        "status": status,
        "tile_id": "N32E118",
    }
    return dem, meta


def sample_dem(dem: np.ndarray, lon: float, lat: float) -> float:
    """Sample N32E118 DEM (lower-left of tile is 32N, 118E; row 0 is north)."""
    # Tile covers lon [118,119], lat [32,33]; row 0 = lat 33, col 0 = lon 118
    col = (lon - 118.0) * 3600.0
    row = (33.0 - lat) * 3600.0
    r0, c0 = int(math.floor(row)), int(math.floor(col))
    if r0 < 0 or c0 < 0 or r0 >= 3600 or c0 >= 3600:
        return float("nan")
    vals = dem[r0 : r0 + 2, c0 : c0 + 2]
    if np.isnan(vals).all():
        return float("nan")
    return float(np.nanmean(vals))


def slope_deg_at(dem: np.ndarray, lon: float, lat: float) -> float:
    dlon = 1.0 / 3600.0
    e = sample_dem(dem, lon, lat)
    e_e = sample_dem(dem, lon + dlon, lat)
    e_n = sample_dem(dem, lon, lat + dlon)
    if any(math.isnan(v) for v in (e, e_e, e_n)):
        return 0.0
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    dz_dx = (e_e - e) / max(meters_per_deg_lon * dlon, 1e-6)
    dz_dy = (e_n - e) / max(meters_per_deg_lat * dlon, 1e-6)
    return float(math.degrees(math.atan(math.hypot(dz_dx, dz_dy))))


def fetch_nasa_power_climate() -> tuple[dict, dict]:
    """Credential-free climate context from NASA POWER Daily PRECTOTCORR."""
    lon, lat = AOI_CENTER
    # Climatology window 1991–2020; API may truncate — request available span.
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters=PRECTOTCORR&community=RE&longitude={lon:.4f}&latitude={lat:.4f}"
        "&start=20010101&end=20201231&format=JSON"
    )
    meta = {
        "provider": "NASA POWER",
        "dataset_product": "Daily surface meteorology (PRECTOTCORR)",
        "original_url": url.split("?")[0],
        "access_retrieval_date": utc_now(),
        "dataset_year": "2001–2020 extract",
        "native_resolution": "coarse meteorological grid (not neighborhood scale)",
        "crs": "EPSG:4326 point extract",
        "transformation": "daily totals → percentiles and rolling accumulations",
        "output_resolution": "point climate context for AOI centroid",
        "license": "NASA POWER open data",
        "evidence_classification": "observed-remote-sensing",
        "limitations": (
            "Climate context only. Not street-scale flood hazard. "
            "POWER is the documented credential-free fallback when IMERG auth is unavailable. "
            "Do not silently mix with IMERG."
        ),
        "source_name": "NASA POWER Daily",
        "imerg_status": "not_used_in_this_build",
    }
    cache_json = CACHE / "climate" / "nasa_power_daily.json"
    try:
        path, status = download(url, cache_json, timeout=180)
        meta["status"] = status
        meta["checksum_sha256"] = sha256_file(path)
        payload = json.loads(path.read_text(encoding="utf-8"))
        series = payload["properties"]["parameter"]["PRECTOTCORR"]
        dates = sorted(series.keys())
        values = np.array([float(series[d]) for d in dates], dtype=np.float64)
        values = values[values >= 0]
    except Exception as exc:  # noqa: BLE001 — document fallback honestly
        meta["status"] = f"download-failed: {exc}"
        meta["fallback"] = "embedded_nanjing_monsoon_climatology_proxy"
        # Honest CI fallback: monsoon-like daily series shape, labelled as proxy.
        rng = np.random.default_rng(20260912)
        n = 365 * 20
        day = np.arange(n) % 365
        seasonal = 2.5 + 8.0 * np.exp(-0.5 * ((day - 195) / 40) ** 2)
        values = np.clip(rng.gamma(1.2, seasonal / 1.2), 0, None)
        dates = [f"proxy-{i}" for i in range(len(values))]

    def pct(arr: np.ndarray, q: float) -> float:
        return float(np.percentile(arr, q))

    daily = {
        "p50": pct(values, 50),
        "p75": pct(values, 75),
        "p90": pct(values, 90),
        "p95": pct(values, 95),
        "p99": pct(values, 99),
    }

    rolling = {}
    for window in (3, 7, 15, 30):
        if len(values) < window:
            continue
        kernel = np.ones(window)
        acc = np.convolve(values, kernel, mode="valid")
        rolling[str(window)] = {
            "window_days": window,
            "percentiles": {
                "p50": pct(acc, 50),
                "p75": pct(acc, 75),
                "p90": pct(acc, 90),
                "p95": pct(acc, 95),
                "p99": pct(acc, 99),
            },
            "valid_windows": int(len(acc)),
            "observed_maxima": {
                "value_mm": float(np.max(acc)),
                "date": str(dates[int(np.argmax(acc)) + window - 1])
                if not str(dates[0]).startswith("proxy")
                else "proxy-series",
            },
        }

    climate = {
        "schema": "ourea-climate-context",
        "schema_version": 1,
        "generated_at": utc_now(),
        "source_name": meta["source_name"],
        "source_version": "POWER Daily API",
        "source_product": "PRECTOTCORR",
        "source_urls": [
            "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
            "https://gpm.nasa.gov/data/imerg",
        ],
        "doi": "https://doi.org/10.5067/POWER/",
        "accessed_at": utc_now(),
        "spatial_resolution": meta["native_resolution"],
        "temporal_resolution": "Daily",
        "area": "Xianlin / Qixia screening AOI centroid, Nanjing (not street-scale).",
        "coordinates": {"lon": AOI_CENTER[0], "lat": AOI_CENTER[1], "epsg": 4326},
        "bounds": {
            "proving_ground": list(BBOX),
            "extracted_cell": list(BBOX),
        },
        "climatology_period": {
            "start": "2001-01-01",
            "end": "2020-12-31",
            "label": "2001-2020",
        },
        "available_period": {
            "start": "2001-01-01",
            "end": "2020-12-31",
            "label": "2001-2020",
        },
        "daily_percentiles": daily,
        "rolling_accumulation_percentiles": rolling,
        "observed_maxima": {
            "climatology_2001_2020": {
                "daily": {
                    "value_mm": float(np.max(values)),
                    "date": str(dates[int(np.argmax(values))])
                    if not str(dates[0]).startswith("proxy")
                    else "proxy-series",
                }
            }
        },
        "scenario_presets": [
            {
                "id": "typical_wet",
                "label": "Typical wet conditions",
                "accumulation_window_days": 15,
                "precipitation_mm": rolling["15"]["percentiles"]["p75"],
                "percentile": 75,
                "antecedent_window_days": 30,
                "antecedent_rainfall_percentile": 0.5,
                "climatology_period": "2001-2020",
                "source_name": meta["source_name"],
                "source_product": "PRECTOTCORR",
            },
            {
                "id": "high_rainfall",
                "label": "High rainfall context",
                "accumulation_window_days": 15,
                "precipitation_mm": rolling["15"]["percentiles"]["p90"],
                "percentile": 90,
                "antecedent_window_days": 30,
                "antecedent_rainfall_percentile": 0.75,
                "climatology_period": "2001-2020",
                "source_name": meta["source_name"],
                "source_product": "PRECTOTCORR",
            },
            {
                "id": "extreme_observed",
                "label": "Extreme observed / high-percentile context",
                "accumulation_window_days": 15,
                "precipitation_mm": rolling["15"]["percentiles"]["p99"],
                "percentile": 99,
                "antecedent_window_days": 30,
                "antecedent_rainfall_percentile": 0.9,
                "climatology_period": "2001-2020",
                "source_name": meta["source_name"],
                "source_product": "PRECTOTCORR",
            },
        ],
        "method": (
            "NASA POWER Daily PRECTOTCORR at AOI centroid; rolling windows for presets. "
            "IMERG V07 Final is preferred when credentials allow but was not required for this build."
        ),
        "appropriate_uses": [
            "Observed climate context / rainfall presets for adaptation screening",
            "Portability demonstration under monsoon rainfall context",
        ],
        "limitations": [
            "Not a hydraulic flood model",
            "Not street-level inundation depth or flood probability",
            "Coarse meteorological resolution — do not downscale to fake neighborhood hazard",
            meta.get("fallback", "Live POWER series used"),
        ],
        "input_provenance": meta,
        "case_id": "nanjing_xianlin_portability",
    }
    return climate, meta


def try_windowed_raster(url_or_path: str, bbox: tuple[float, float, float, float]) -> tuple[np.ndarray | None, dict]:
    meta = {
        "original_url": url_or_path if str(url_or_path).startswith("http") else "local-cache",
        "access_retrieval_date": utc_now(),
        "crs": "EPSG:4326",
        "transformation": "windowed read + AOI crop",
    }
    try:
        import rasterio
        from rasterio.windows import from_bounds
    except ImportError:
        meta["status"] = "rasterio-unavailable"
        return None, meta

    candidates = [url_or_path]
    # Prefer fully cached local GeoTIFF when remote range reads fail.
    if "worldpop" in str(url_or_path).lower() or "chn_pop" in str(url_or_path).lower():
        local = CACHE / "population" / "chn_pop_2026_CN_100m_R2025A_v1.tif"
        if local.exists() and local.stat().st_size > 1_000_000:
            candidates.insert(0, str(local))
            meta["local_cache"] = str(local)

    for candidate in candidates:
        try:
            with rasterio.open(candidate) as src:
                window = from_bounds(*bbox, transform=src.transform)
                data = src.read(1, window=window).astype(np.float64)
                meta.update(
                    {
                        "status": "windowed-read",
                        "native_resolution": str(src.res),
                        "driver": src.driver,
                        "nodata": src.nodata,
                        "read_from": candidate if not str(candidate).startswith("http") else "remote",
                    }
                )
                if src.nodata is not None:
                    data = np.where(data == src.nodata, np.nan, data)
                return data, meta
        except Exception as exc:  # noqa: BLE001
            meta["status"] = f"read-failed: {exc}"
            continue
    return None, meta


def worldcover_class_weights() -> dict[int, dict]:
    """ESA WorldCover class → screening proxies (documented assumptions)."""
    return {
        10: {"built": 0.0, "veg": 1.0, "water": 0.0, "runoff_weight": 0.15},  # tree
        20: {"built": 0.0, "veg": 0.85, "water": 0.0, "runoff_weight": 0.2},  # shrub
        30: {"built": 0.0, "veg": 0.7, "water": 0.0, "runoff_weight": 0.25},  # grassland
        40: {"built": 0.05, "veg": 0.4, "water": 0.0, "runoff_weight": 0.35},  # cropland
        50: {"built": 1.0, "veg": 0.0, "water": 0.0, "runoff_weight": 0.85},  # built-up
        60: {"built": 0.1, "veg": 0.05, "water": 0.0, "runoff_weight": 0.55},  # bare
        70: {"built": 0.0, "veg": 0.0, "water": 0.0, "runoff_weight": 0.1},  # snow
        80: {"built": 0.0, "veg": 0.0, "water": 1.0, "runoff_weight": 0.05},  # water
        90: {"built": 0.0, "veg": 0.6, "water": 0.3, "runoff_weight": 0.2},  # wetland
        95: {"built": 0.0, "veg": 0.5, "water": 0.2, "runoff_weight": 0.2},  # mangroves
        100: {"built": 0.0, "veg": 0.15, "water": 0.0, "runoff_weight": 0.4},  # moss
    }


def build_planning_grid(dem: np.ndarray) -> tuple[dict, dict, dict, list[dict]]:
    west, south, east, north = BBOX
    xs = np.arange(west, east, CELL_DEG)
    ys = np.arange(south, north, CELL_DEG)

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
    wc_raster, wc_meta = try_windowed_raster(WORLDCOVER_S3, BBOX)
    wc_meta.update(
        {
            "provider": "ESA WorldCover",
            "dataset_product": "WorldCover 2021 v200",
            "dataset_year": 2021,
            "license": "CC BY 4.0",
            "evidence_classification": "observed-remote-sensing",
            "limitations": (
                "Land-cover classes are not measured imperviousness or calibrated runoff coefficients. "
                "Runoff weights are explicit planning assumptions stored in configuration."
            ),
            "runoff_weight_assumptions": worldcover_class_weights(),
        }
    )

    # Local relative elevation: dem mean within AOI for depression proxy.
    elev_samples = []
    for y in ys:
        for x in xs:
            elev_samples.append(sample_dem(dem, x + CELL_DEG / 2, y + CELL_DEG / 2))
    elev_arr = np.array(elev_samples, dtype=np.float64)
    elev_mean = float(np.nanmean(elev_arr)) if np.isfinite(elev_arr).any() else 50.0

    features = []
    building_features = []
    hazard_features = []
    cell_id = 0
    rng = np.random.default_rng(20260912)

    pop_fallback_total = 0.0
    used_worldpop = pop_raster is not None and np.isfinite(pop_raster).any()
    used_worldcover = wc_raster is not None and np.isfinite(wc_raster).any()

    for yi, y0 in enumerate(ys):
        for xi, x0 in enumerate(xs):
            x1, y1 = x0 + CELL_DEG, y0 + CELL_DEG
            cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
            elev = sample_dem(dem, cx, cy)
            if math.isnan(elev):
                elev = elev_mean
            slope = slope_deg_at(dem, cx, cy)
            rel = float(elev_mean - elev)  # positive => locally lower (depression proxy)
            # Terrain-derived drainage-stress screening proxy (NOT inundation).
            stress_raw = (
                0.45 * max(0.0, rel) / 40.0
                + 0.25 * min(slope, 25.0) / 25.0
                + 0.30 * max(0.0, (80.0 - elev) / 80.0)
            )
            stress_raw = float(np.clip(stress_raw, 0, 1))

            # Population
            if used_worldpop:
                # Approximate row/col in cropped array
                pr = int((north - cy) / (north - south) * (pop_raster.shape[0] - 1))
                pc = int((cx - west) / (east - west) * (pop_raster.shape[1] - 1))
                pr = int(np.clip(pr, 0, pop_raster.shape[0] - 1))
                pc = int(np.clip(pc, 0, pop_raster.shape[1] - 1))
                # Sum a small neighborhood as cell population estimate
                r0, r1 = max(0, pr - 2), min(pop_raster.shape[0], pr + 3)
                c0, c1 = max(0, pc - 2), min(pop_raster.shape[1], pc + 3)
                pop = float(np.nansum(pop_raster[r0:r1, c0:c1]))
            else:
                # Transparent fallback: urbanizing campus corridor heuristic (documented).
                campus = math.exp(-((cx - 118.96) ** 2 + (cy - 32.12) ** 2) / (2 * 0.02**2))
                pop = float(80 + 420 * campus + 40 * rng.random())
                pop_fallback_total += pop

            built = 0.35
            veg = 0.4
            water = 0.02
            runoff_w = 0.45
            if used_worldcover:
                wr = int((north - cy) / (north - south) * (wc_raster.shape[0] - 1))
                wc = int((cx - west) / (east - west) * (wc_raster.shape[1] - 1))
                wr = int(np.clip(wr, 0, wc_raster.shape[0] - 1))
                wc = int(np.clip(wc, 0, wc_raster.shape[1] - 1))
                r0, r1 = max(0, wr - 3), min(wc_raster.shape[0], wr + 4)
                c0, c1 = max(0, wc - 3), min(wc_raster.shape[1], wc + 4)
                patch = wc_raster[r0:r1, c0:c1].astype(int)
                weights = worldcover_class_weights()
                built_vals, veg_vals, water_vals, runoff_vals = [], [], [], []
                for val in patch.ravel():
                    w = weights.get(int(val))
                    if not w:
                        continue
                    built_vals.append(w["built"])
                    veg_vals.append(w["veg"])
                    water_vals.append(w["water"])
                    runoff_vals.append(w["runoff_weight"])
                if built_vals:
                    built = float(np.mean(built_vals))
                    veg = float(np.mean(veg_vals))
                    water = float(np.mean(water_vals))
                    runoff_w = float(np.mean(runoff_vals))

            drainage_stress = float(np.clip(0.55 * stress_raw + 0.45 * runoff_w, 0, 1))
            if drainage_stress >= 0.66:
                hazard_max = "Alta"
            elif drainage_stress >= 0.4:
                hazard_max = "Media"
            else:
                hazard_max = "Baja"

            # Opportunity fields reuse Ourea conceptual library semantics.
            rwh_opportunity = float(np.clip(0.2 + 0.75 * built, 0, 1))
            drainage_corridor_proxy = float(np.clip(0.15 + 0.7 * drainage_stress + 0.15 * water, 0, 1))
            restoration_opportunity = float(np.clip(0.1 + 0.8 * veg * (1.0 - 0.5 * built), 0, 1))

            # Built-up surface metric instead of OSM building counts when completeness unknown.
            built_units = int(round(max(0.0, pop / 35.0) * (0.4 + 0.6 * built)))
            high_stress_units = int(round(built_units * drainage_stress))

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
                "roof_footprint_m2": round(built_units * 85.0 * built, 1),
                "vehicular_access_m": round(120.0 * built, 1),
                "pedestrian_access_m": round(180.0 * built, 1),
                "open_space_proxy": round(1.0 - built, 4),
                "built_up_share": round(built, 4),
                "vegetated_share": round(veg, 4),
                "water_presence": round(water, 4),
                "runoff_pressure_proxy": round(runoff_w, 4),
                "rwh_opportunity": round(rwh_opportunity, 4),
                "drainage_corridor_proxy": round(drainage_corridor_proxy, 4),
                "restoration_opportunity": round(restoration_opportunity, 4),
                "hazard_max": hazard_max,
                "drainage_stress_proxy": round(drainage_stress, 4),
                "population_label": "WorldPop 2026 population estimate"
                if used_worldpop
                else "documented population fallback estimate",
                "building_metric": "worldcover_built_up_proxy",
                "note": "terrain-derived screening proxy; not hydraulic flood simulation",
            }
            features.append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                }
            )

            # One representative exposure point per cell (schema-compatible "building").
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

    if not used_worldpop:
        pop_meta["fallback"] = (
            "WorldPop windowed read unavailable; used documented campus-corridor population "
            f"heuristic (total≈{pop_fallback_total:.0f}). Competition claims must disclose this."
        )
        pop_meta["status"] = pop_meta.get("status", "fallback")

    cells = {
        "type": "FeatureCollection",
        "name": "nanjing_xianlin_planning_cells",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
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
    return cells, buildings, hazard, features, pop_meta, wc_meta


def build_screening(features: list[dict]) -> dict:
    """Grid screening with Nanjing lenses (no equity/IMCV)."""
    scored = []
    for feat in features:
        p = feat["properties"]
        exposure = p["population_proxy"] * p["drainage_stress_proxy"]
        balanced = 0.75 * exposure + 0.25 * (p["population_proxy"] * p["runoff_pressure_proxy"])
        runoff = p["drainage_stress_proxy"]
        scored.append((feat, exposure, balanced, runoff))

    def ranks(values: list[float]) -> list[int]:
        order = sorted(range(len(values)), key=lambda i: -values[i])
        out = [0] * len(values)
        for rank, idx in enumerate(order, start=1):
            out[idx] = rank
        return out

    exp_r = ranks([s[1] for s in scored])
    bal_r = ranks([s[2] for s in scored])
    run_r = ranks([s[3] for s in scored])
    low_regret_score = [
        1.0 / exp_r[i] + 1.0 / bal_r[i] + 1.0 / run_r[i] for i in range(len(scored))
    ]
    lr_r = ranks(low_regret_score)

    out_features = []
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
            # Keep Medellín field names absent of IMCV; equity lens disabled in UI.
            "priority_equity": None,
            "rank_equity": None,
        }
        out_features.append(
            {"type": "Feature", "properties": props, "geometry": feat["geometry"]}
        )
    return {
        "type": "FeatureCollection",
        "name": "nanjing_xianlin_screening",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": out_features,
    }


def build_roads_stub() -> dict:
    """Minimal empty roads FC — OSM completeness not assumed without offline extract."""
    return {
        "type": "FeatureCollection",
        "name": "nanjing_roads_optional",
        "features": [],
        "properties": {
            "note": (
                "OSM/Geofabrik China extract not bundled. Built-up exposure uses WorldCover / "
                "EMC-BUILT-style proxies instead of OSM building counts."
            ),
            "osm_building_counts_displayed": False,
        },
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify required outputs exist")
    args = parser.parse_args()
    ensure_dirs()

    if args.check:
        required = [
            OUT / "planning_cells.geojson",
            OUT / "buildings.geojson",
            OUT / "climate_context.json",
            OUT / "data_manifest.json",
            OUT / "retrospective_validation.json",
        ]
        missing = [str(p) for p in required if not p.exists()]
        if missing:
            print("Missing:", *missing, sep="\n  ")
            return 1
        print("Nanjing case artifacts present.")
        return 0

    print("Loading terrain…")
    dem, terrain_meta = load_skadi_elevation()
    print("Building climate context…")
    climate, climate_meta = fetch_nasa_power_climate()
    print("Building planning grid…")
    cells, buildings, hazard, feature_list, pop_meta, wc_meta = build_planning_grid(dem)
    screening = build_screening(feature_list)
    roads = build_roads_stub()

    total_pop = sum(f["properties"]["population_proxy"] for f in feature_list)
    summary = {
        "case_id": "nanjing_xianlin_portability",
        "city": "Nanjing",
        "focus_area": "Xianlin / Qixia",
        "case_role": "portability_demonstration",
        "sandbox_bbox_wgs84": list(BBOX),
        "bbox_status": "initial reproducible screening bbox; not an official administrative boundary",
        "planning_cells": len(feature_list),
        "exposure_units": len(buildings["features"]),
        "roads_segments": 0,
        "hazard_polygons": len(hazard["features"]),
        "population_estimate": round(total_pop, 1),
        "population_label": "WorldPop 2026 population estimate"
        if "fallback" not in pop_meta
        else "documented population fallback estimate",
        "median_slope_deg": round(
            float(np.median([f["properties"]["mean_slope_deg"] for f in feature_list])), 2
        ),
        "building_metric": "worldcover_built_up_proxy",
        "osm_building_counts_used": False,
        "equity_layer": None,
        "note": (
            "Adaptation screening for monsoon urban drainage / stormwater context. "
            "Terrain-derived drainage-stress indicators are screening proxies, not inundation maps. "
            "Population figures are estimates, not census counts."
        ),
    }

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
                "basis": "Terrain relative elevation + slope + WorldCover runoff weights",
                "use": "NOT inundation depth or flood probability",
            },
            {
                "id": "population",
                "label": "WorldPop 2026 population estimate",
                "status": "population-estimate",
                "confidence": "medium",
                "basis": pop_meta.get("dataset_product", "WorldPop / fallback"),
                "use": "Exposure screening; not exact households",
            },
            {
                "id": "land_cover",
                "label": "ESA WorldCover 2021",
                "status": "observed-remote-sensing",
                "confidence": "medium",
                "basis": "WorldCover classes with documented runoff-weight assumptions",
                "use": "Built-up / vegetation / green-infrastructure opportunity proxies",
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
                "basis": "Dimensionless planning credits (not CNY/USD investment advice)",
                "use": "Budget-constrained portfolio comparison",
            },
        ],
    }

    plan_alignment = {
        "schema": "ourea-plan-alignment",
        "case_id": "nanjing_xianlin_portability",
        "title": "Nanjing drainage / waterlogging policy context",
        "summary": (
            "Municipal waterlogging and stormwater management is an active Nanjing policy theme. "
            "Official projects listed under retrospective validation were not used to train or "
            "constrain the optimizer."
        ),
        "items": [
            {
                "id": "nanjing_water_plan_2026_2030",
                "label": "Municipal water / waterlogging plan context",
                "url": "https://www.nanjing.gov.cn/zdgk/202608/t20260807_5890796.html",
                "optimizer_input": False,
            }
        ],
    }

    cost_context = {
        "schema": "ourea-cost-context",
        "case_id": "nanjing_xianlin_portability",
        "currency_note": (
            "Nanjing portability case uses planning credits only in the optimizer. "
            "No fabricated CNY unit-cost schedule is provided."
        ),
        "planning_credits_only": True,
        "interventions": {
            "rwh": {"label": "Rainwater storage / harvesting"},
            "drainage": {"label": "Drainage / water-management upgrade"},
            "restoration": {"label": "Green infrastructure / soil-water retention"},
        },
        "limitations": [
            "No COP/CNY investment recommendation",
            "Effect and cost remain planning assumptions",
        ],
    }

    retrospective = {
        "schema": "ourea-retrospective-validation",
        "schema_version": 1,
        "case_id": "nanjing_xianlin_portability",
        "generated_at": utc_now(),
        "disclaimer": (
            "Ourea screening results can be compared retrospectively with documented municipal "
            "interventions. These projects were not used as optimizer inputs, training targets, "
            "seeds, or constraints."
        ),
        "optimizer_input": False,
        "projects": [
            {
                "id": "qixia_official_topography",
                "title_en": "Qixia mixed terrain (south-high / north-low)",
                "title_zh": "栖霞地形（南高北低）",
                "source": "Qixia District Government",
                "url": "https://www.njqxq.gov.cn/sjb2018/ssqx/qxgk/index.html",
                "claim": (
                    "Southern Qixia is hilly/upland, commonly 50–300 m; northern Yangtze "
                    "plain/islands generally below 10 m."
                ),
                "optimizer_input": False,
                "comparison_note": (
                    "Terrain screening uses Mapzen elevation; qualitative consistency with "
                    "south-high / north-low may be checked after optimization, never before."
                ),
            },
            {
                "id": "xianlin_yuanhua_xianyin_2026",
                "title_en": "Yuanhua Road / Xianyin North Road waterlogging remediation (2026)",
                "title_zh": "仙林元化路/仙隐北路内涝整治",
                "source": "Nanjing Public Resources Trading Center",
                "url": "https://njggzy.nanjing.gov.cn/njweb/jtsw/069005/069005001/20260306/f9f67762-9758-45d8-a898-d801ed8720f7.html",
                "claim": (
                    "Official 2026 waterlogging-remediation works including new d1000 stormwater "
                    "pipe segments and cleaning/repair."
                ),
                "optimizer_input": False,
                "comparison_note": (
                    "Compare functional theme (drainage conveyance) with selected intervention "
                    "families after the fact. Do not claim spatial discovery of this project."
                ),
            },
            {
                "id": "hengyang_jiuxiang_storage",
                "title_en": "Jiuxiang River / Hengyang Lake 9,000 m³ detention storage",
                "title_zh": "九乡河/横阳湖调蓄工程（有效库容9000立方米）",
                "source": "Nanjing Water Affairs Bureau",
                "url": "https://shuiwu.nanjing.gov.cn/njsswj/202501/t20250122_5063584.html",
                "claim": (
                    "Official detention/storage facility with 9,000 m³ effective volume intended "
                    "in part to reduce Xianlin / Jiuxianghe-area waterlogging risk."
                ),
                "optimizer_input": False,
                "comparison_note": (
                    "If Ourea selects rainwater-storage type actions nearby, report thematic "
                    "overlap only. Never claim Ourea discovered the 9,000 m³ facility."
                ),
            },
            {
                "id": "nanjing_water_plan_2026_2030",
                "title_en": "Nanjing municipal water / waterlogging policy (2026–2030)",
                "title_zh": "南京市水务相关规划语境",
                "source": "Nanjing Municipal Government",
                "url": "https://www.nanjing.gov.cn/zdgk/202608/t20260807_5890796.html",
                "claim": (
                    "Municipal plan emphasizes continued urban waterlogging remediation and "
                    "drainage coordination, including Qixia areas."
                ),
                "optimizer_input": False,
                "comparison_note": "Policy context only.",
            },
        ],
        "spatial_overlap_method": (
            "Qualitative / thematic after independent optimization. Exact coordinate overlays "
            "for municipal works are not fabricated when precise geometries are unavailable."
        ),
    }

    data_manifest = {
        "schema": "ourea-data-manifest",
        "schema_version": 1,
        "case_id": "nanjing_xianlin_portability",
        "generated_at": utc_now(),
        "working_bbox": list(BBOX),
        "working_bbox_status": (
            "initial reproducible screening bbox; not an official Xianlin administrative boundary"
        ),
        "artifacts": {
            "planning_cells": "frontend/public/data/nanjing/planning_cells.geojson",
            "buildings": "frontend/public/data/nanjing/buildings.geojson",
            "drainage_stress": "frontend/public/data/nanjing/drainage_stress.geojson",
            "screening": "frontend/public/data/nanjing/screening.geojson",
            "climate_context": "frontend/public/data/nanjing/climate_context.json",
            "retrospective_validation": "frontend/public/data/nanjing/retrospective_validation.json",
        },
        "datasets": [
            terrain_meta,
            climate_meta,
            pop_meta,
            wc_meta,
            {
                "provider": "OpenStreetMap / Geofabrik",
                "dataset_product": "China extract (optional)",
                "status": "not_bundled",
                "evidence_classification": "observed-remote-sensing",
                "limitations": (
                    "OSM completeness not assumed; building counts not displayed. "
                    "Built-up metric from WorldCover proxy."
                ),
                "optimizer_input": False,
            },
        ],
        "retrospective_only": [p["id"] for p in retrospective["projects"]],
        "forbidden_as_optimizer_inputs": [p["id"] for p in retrospective["projects"]],
    }

    write_json(OUT / "planning_cells.geojson", cells)
    write_json(OUT / "buildings.geojson", buildings)
    write_json(OUT / "drainage_stress.geojson", hazard)
    write_json(OUT / "screening.geojson", screening)
    write_json(OUT / "roads.geojson", roads)
    write_json(OUT / "climate_context.json", climate)
    write_json(OUT / "summary.json", summary)
    write_json(OUT / "evidence_status.json", evidence)
    write_json(OUT / "plan_alignment.json", plan_alignment)
    write_json(OUT / "cost_context.json", cost_context)
    write_json(OUT / "retrospective_validation.json", retrospective)
    write_json(OUT / "data_manifest.json", data_manifest)

    if MANIFEST_SRC.exists():
        # Keep a copy of the case definition under data/cases if present.
        pass
    else:
        (ROOT / "data" / "cases").mkdir(parents=True, exist_ok=True)

    print(f"Wrote Nanjing case artifacts to {OUT}")
    print(f"  cells={len(feature_list)} population_estimate~{total_pop:.0f}")
    print(f"  terrain_status={terrain_meta.get('status')}")
    print(f"  climate_status={climate_meta.get('status')}")
    print(f"  worldpop_status={pop_meta.get('status')}")
    print(f"  worldcover_status={wc_meta.get('status')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

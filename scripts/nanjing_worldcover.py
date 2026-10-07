#!/usr/bin/env python3
"""Discover and cache ESA WorldCover 2021 v200 tiles via anonymous AWS S3.

Official bucket: s3://esa-worldcover/v200/2021/map
Tile grid: 3° × 3°, keys end with _Map.tif.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "nanjing" / "worldcover"
BUCKET = "esa-worldcover"
PREFIX = "v200/2021/map/"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def worldcover_tile_ids(bbox: tuple[float, float, float, float]) -> list[str]:
    """Return lower-left 3° tile ids intersecting bbox (west,south,east,north)."""
    west, south, east, north = bbox
    tiles = set()
    lat0 = int(math.floor(south / 3.0) * 3)
    lat1 = int(math.floor((north - 1e-9) / 3.0) * 3)
    lon0 = int(math.floor(west / 3.0) * 3)
    lon1 = int(math.floor((east - 1e-9) / 3.0) * 3)
    for lat in range(lat0, lat1 + 1, 3):
        for lon in range(lon0, lon1 + 1, 3):
            lat_label = f"N{abs(lat):02d}" if lat >= 0 else f"S{abs(lat):02d}"
            lon_label = f"E{abs(lon):03d}" if lon >= 0 else f"W{abs(lon):03d}"
            tiles.add(f"{lat_label}{lon_label}")
    return sorted(tiles)


def s3_client():
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config

    return boto3.client("s3", config=Config(signature_version=UNSIGNED))


def discover_keys(tile_ids: list[str]) -> list[dict]:
    client = s3_client()
    found = []
    for tile_id in tile_ids:
        key = f"{PREFIX}ESA_WorldCover_10m_2021_v200_{tile_id}_Map.tif"
        try:
            head = client.head_object(Bucket=BUCKET, Key=key)
            found.append(
                {
                    "tile_id": tile_id,
                    "s3_uri": f"s3://{BUCKET}/{key}",
                    "s3_key": key,
                    "content_length": head["ContentLength"],
                    "etag": head.get("ETag"),
                }
            )
        except Exception as exc:  # noqa: BLE001
            found.append(
                {
                    "tile_id": tile_id,
                    "s3_key": key,
                    "status": f"head-failed: {exc}",
                }
            )
    return found


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_tiles(bbox: tuple[float, float, float, float]) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    tile_ids = worldcover_tile_ids(bbox)
    discovered = discover_keys(tile_ids)
    client = s3_client()
    local_paths = []
    for item in discovered:
        if "status" in item and item["status"].startswith("head-failed"):
            continue
        key = item["s3_key"]
        dest = CACHE / Path(key).name
        if dest.exists() and dest.stat().st_size > 1_000_000:
            status = "cache-hit"
        else:
            client.download_file(BUCKET, key, str(dest))
            status = "downloaded"
        item["local_path"] = str(dest)
        item["status"] = status
        item["checksum_sha256"] = sha256_file(dest)
        item["access_retrieval_date"] = utc_now()
        local_paths.append(dest)

    meta = {
        "provider": "ESA WorldCover",
        "dataset_product": "WorldCover 2021 v200",
        "dataset_year": 2021,
        "native_resolution": "10 m",
        "crs": "EPSG:4326",
        "license": "CC BY 4.0",
        "bucket": f"s3://{BUCKET}/",
        "access_mode": "anonymous UNSIGNED boto3",
        "discovery_method": "AOI ∩ official 3° WorldCover tile grid + S3 HeadObject",
        "working_bbox": list(bbox),
        "tiles": discovered,
        "local_paths": [str(p) for p in local_paths],
        "evidence_classification": "observed-remote-sensing",
        "limitations": (
            "Land-cover classes are not measured imperviousness or calibrated runoff. "
            "Any runoff weights derived from classes are explicit planning assumptions."
        ),
    }
    (CACHE / "discovery.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return meta


def window_read(path: Path, bbox: tuple[float, float, float, float]):
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds

    with rasterio.open(path) as src:
        window = from_bounds(*bbox, transform=src.transform)
        data = src.read(1, window=window)
        transform = src.window_transform(window)
        return data, {
            "crs": str(src.crs),
            "transform": list(transform)[:6] if transform else None,
            "shape": list(data.shape),
            "res": list(src.res),
            "nodata": src.nodata,
            "dtype": str(data.dtype),
        }


if __name__ == "__main__":
    BBOX = (118.88, 32.075, 118.97, 32.145)
    meta = ensure_tiles(BBOX)
    print(json.dumps(meta, indent=2))
    if meta["local_paths"]:
        arr, info = window_read(Path(meta["local_paths"][0]), BBOX)
        print("window", info, "unique", sorted(set(arr.ravel().tolist()))[:20])

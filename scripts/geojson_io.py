from __future__ import annotations

from pathlib import Path
import json

from geopandas import GeoDataFrame

DEFAULT_CRS = "EPSG:4326"
CRS84_ALIASES = (
    "CRS84",
    "EPSG:4326",
    "WGS84",
    "WGS 84",
)


class GeoJsonLoadError(ValueError):
    pass


def crs_from_geojson(payload: dict, fallback: str = DEFAULT_CRS) -> str:
    crs = payload.get("crs")
    if not isinstance(crs, dict):
        return fallback
    name = str(crs.get("properties", {}).get("name") or crs.get("name") or "")
    if any(alias.casefold() in name.casefold() for alias in CRS84_ALIASES):
        return DEFAULT_CRS
    return name or fallback


def read_local_geojson(path: str | Path, *, crs: str | None = None) -> GeoDataFrame:
    target = Path(path)
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise GeoJsonLoadError(f"Malformed GeoJSON in {target}: {exc}") from exc

    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise GeoJsonLoadError(f"{target} is not a GeoJSON FeatureCollection")
    raw_features = payload.get("features")
    if not isinstance(raw_features, list):
        raise GeoJsonLoadError(f"{target} FeatureCollection is missing a features array")

    features = []
    for index, feature in enumerate(raw_features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise GeoJsonLoadError(f"{target} feature {index} is not a GeoJSON Feature")
        features.append(
            {
                "type": "Feature",
                "properties": feature.get("properties") or {},
                "geometry": feature.get("geometry"),
                **({"id": feature["id"]} if "id" in feature else {}),
            }
        )

    resolved_crs = crs or crs_from_geojson(payload)
    if not features:
        return GeoDataFrame(columns=["geometry"], geometry="geometry", crs=resolved_crs)

    frame = GeoDataFrame.from_features(
        {"type": "FeatureCollection", "features": features},
        crs=resolved_crs,
    )
    if frame.crs is None:
        frame = frame.set_crs(resolved_crs, allow_override=True)
    return frame

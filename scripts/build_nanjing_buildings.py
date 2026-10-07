"""
Extract Nanjing OSM building footprints for DETAILED MAP VISUALIZATION ONLY.

Does NOT replace frontend/public/data/nanjing/buildings.geojson (optimizer exposure
proxies). Writes a separate massing artifact that must never enter the optimizer.
"""
from __future__ import annotations

import json
import math
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / ".cache" / "nanjing" / "osm" / "tiles"
CELLS_PATH = ROOT / "frontend" / "public" / "data" / "nanjing" / "planning_cells.geojson"
OUT_PUBLIC = ROOT / "frontend" / "public" / "data" / "nanjing" / "building_massing.geojson"
OUT_DERIVED = ROOT / "data" / "derived" / "nanjing" / "building_massing.geojson"
OUT_META = ROOT / "data" / "derived" / "nanjing" / "building_massing_meta.json"
OUT_META_PUBLIC = ROOT / "frontend" / "public" / "data" / "nanjing" / "building_massing_meta.json"
BBOX = (118.88, 32.075, 118.97, 32.145)
AOI = box(*BBOX)
LEVEL_HEIGHT_M = 3.0
FALLBACK_HEIGHT_M = 8.0
MIN_AREA_M2 = 40.0  # drop tiny footprints
SIMPLIFY_DEG = 0.00002
# Match Medellín fill-extrusion interpolate stops for class labels.
CLASS_STOPS = (0.48, 0.68)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def tags_of(el: ET.Element) -> dict[str, str]:
    return {t.get("k"): t.get("v") for t in el.findall("tag") if t.get("k")}


def approx_area_m2(geom) -> float:
    lon, lat = geom.centroid.x, geom.centroid.y
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    return float(geom.area * m_per_deg_lat * m_per_deg_lon)


def parse_height_m(raw: str | None) -> float | None:
    if not raw:
        return None
    text = str(raw).strip().lower().replace(",", ".")
    match = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*(m|meter|metres|meters)?$", text)
    if not match:
        return None
    value = float(match.group(1))
    if value <= 0 or value > 400:
        return None
    return value


def parse_levels(raw: str | None) -> float | None:
    if not raw:
        return None
    text = str(raw).strip().replace(",", ".")
    match = re.match(r"^([0-9]+(?:\.[0-9]+)?)$", text)
    if not match:
        return None
    value = float(match.group(1))
    if value <= 0 or value > 120:
        return None
    return value


def resolve_height(tags: dict[str, str]) -> tuple[float, str]:
    explicit = parse_height_m(tags.get("height"))
    if explicit is not None:
        return explicit, "osm_reported_height"
    levels = parse_levels(tags.get("building:levels"))
    if levels is not None:
        return levels * LEVEL_HEIGHT_M, "level_derived_visualization"
    return FALLBACK_HEIGHT_M, "fallback_visualization_proxy"


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def write_json_pretty(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def priority_class(score: float) -> str:
    if score < CLASS_STOPS[0]:
        return "lower"
    if score < CLASS_STOPS[1]:
        return "medium"
    return "higher"


def load_cells() -> list[dict]:
    cells_fc = json.loads(CELLS_PATH.read_text(encoding="utf-8"))
    rows = []
    for feat in cells_fc["features"]:
        geom = shape(feat["geometry"])
        props = feat["properties"]
        rows.append(
            {
                "cell_id": int(props["cell_id"]),
                "geom": geom,
                "drainage_stress_proxy": float(props.get("drainage_stress_proxy") or 0.0),
                "baseline_stress": float(props.get("baseline_stress") or 0.0),
                "runoff_pressure_proxy": float(props.get("runoff_pressure_proxy") or 0.0),
            }
        )
    return rows


def cell_score_lookup(cells: list[dict]) -> dict[int, float]:
    raw = [c["drainage_stress_proxy"] for c in cells]
    lo, hi = min(raw), max(raw)
    span = hi - lo if abs(hi - lo) > 1e-12 else 1.0
    return {
        c["cell_id"]: float((c["drainage_stress_proxy"] - lo) / span)
        for c in cells
    }


def assign_building_to_cell(centroid: Point, cells: list[dict]) -> dict | None:
    for cell in cells:
        if cell["geom"].covers(centroid) or cell["geom"].intersects(centroid):
            return cell
    # Fallback: nearest cell (centroid outside cell polygons due to clip/simplify).
    return min(cells, key=lambda c: c["geom"].distance(centroid))


def attach_visual_priority(features: list[dict], cells: list[dict]) -> dict:
    scores = cell_score_lookup(cells)
    class_counts = {"lower": 0, "medium": 0, "higher": 0, "unjoined": 0}
    for feature in features:
        geom = shape(feature["geometry"])
        centroid = geom.centroid
        cell = assign_building_to_cell(centroid, cells) if cells else None
        if cell is None:
            feature["properties"].update(
                {
                    "source_cell_id": None,
                    "visual_priority_score": 0.0,
                    "priority_class": "lower",
                    "visual_priority_source": "unjoined_fallback",
                    "join_method": "none",
                }
            )
            class_counts["unjoined"] += 1
            class_counts["lower"] += 1
            continue
        score = scores[cell["cell_id"]]
        cls = priority_class(score)
        class_counts[cls] += 1
        feature["properties"].update(
            {
                "source_cell_id": int(cell["cell_id"]),
                "visual_priority_score": round(score, 4),
                "priority_class": cls,
                "visual_priority_source": "planning_cell_drainage_stress_proxy_minmax",
                "join_method": "centroid_in_polygon_or_nearest",
                "drainage_stress_proxy_raw": round(cell["drainage_stress_proxy"], 4),
            }
        )
    return class_counts


def extract_buildings() -> tuple[list[dict], dict]:
    nodes: dict[str, tuple[float, float]] = {}
    features: list[dict] = []
    seen_ids: set[str] = set()
    counts = {
        "osm_reported_height": 0,
        "level_derived_visualization": 0,
        "fallback_visualization_proxy": 0,
        "skipped_outside_aoi": 0,
        "skipped_tiny": 0,
        "skipped_invalid": 0,
    }

    for path in sorted(TILE_DIR.glob("tile*.osm")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "too many nodes" in text or text.strip().startswith("You requested"):
            continue
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            continue
        for node in root.findall("node"):
            nodes[node.get("id")] = (float(node.get("lon")), float(node.get("lat")))
        for way in root.findall("way"):
            tags = tags_of(way)
            if "building" not in tags:
                continue
            osm_id = way.get("id")
            if not osm_id or osm_id in seen_ids:
                continue
            refs = [nd.get("ref") for nd in way.findall("nd")]
            coords = [nodes[r] for r in refs if r in nodes]
            if len(coords) < 4 or coords[0] != coords[-1]:
                continue
            try:
                geom = make_valid(Polygon(coords))
            except Exception:
                counts["skipped_invalid"] += 1
                continue
            if geom.is_empty:
                counts["skipped_invalid"] += 1
                continue
            clipped = geom.intersection(AOI)
            if clipped.is_empty:
                counts["skipped_outside_aoi"] += 1
                continue
            if clipped.geom_type == "GeometryCollection":
                polys = [g for g in clipped.geoms if g.geom_type in {"Polygon", "MultiPolygon"}]
                if not polys:
                    counts["skipped_invalid"] += 1
                    continue
                clipped = unary_union(polys)
            if clipped.geom_type == "MultiPolygon":
                # Keep largest part for massing simplicity.
                clipped = max(clipped.geoms, key=lambda g: g.area)
            if clipped.geom_type != "Polygon":
                counts["skipped_invalid"] += 1
                continue
            area_m2 = approx_area_m2(clipped)
            if area_m2 < MIN_AREA_M2:
                counts["skipped_tiny"] += 1
                continue
            simplified = clipped.simplify(SIMPLIFY_DEG, preserve_topology=True)
            if simplified.is_empty or simplified.geom_type != "Polygon":
                simplified = clipped
            height_m, height_source = resolve_height(tags)
            counts[height_source] += 1
            seen_ids.add(osm_id)
            name = tags.get("name:en") or tags.get("name")
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "osm_id": osm_id,
                        "building": tags.get("building"),
                        "name": name,
                        "visual_height_m": round(height_m, 2),
                        "height_source": height_source,
                        "height_m_reported": parse_height_m(tags.get("height")),
                        "building_levels": parse_levels(tags.get("building:levels")),
                        "area_m2": round(area_m2, 1),
                        "visualization_only": True,
                        "optimizer_input": False,
                        "source": "OpenStreetMap (ODbL) via cached map API tiles",
                    },
                    "geometry": mapping(simplified),
                }
            )

    covered = unary_union([Polygon(f["geometry"]["coordinates"][0]) for f in features]) if features else None
    aoi_area = approx_area_m2(AOI)
    footprint_area = approx_area_m2(covered) if covered and not covered.is_empty else 0.0
    cells = load_cells()
    class_counts = attach_visual_priority(features, cells)
    meta = {
        "schema": "ourea-nanjing-building-massing",
        "schema_version": 2,
        "generated_at": utc_now(),
        "bbox": list(BBOX),
        "building_count": len(features),
        "height_provenance_counts": {
            "osm_reported_height": counts["osm_reported_height"],
            "level_derived_visualization": counts["level_derived_visualization"],
            "fallback_visualization_proxy": counts["fallback_visualization_proxy"],
        },
        "priority_class_counts": class_counts,
        "color_logic": {
            "driver": "planning_cell.drainage_stress_proxy",
            "normalization": "minmax within 80 Nanjing planning cells → visual_priority_score [0,1]",
            "class_stops": {
                "lower": f"< {CLASS_STOPS[0]}",
                "medium": f"[{CLASS_STOPS[0]}, {CLASS_STOPS[1]})",
                "higher": f">= {CLASS_STOPS[1]}",
            },
            "join": "building centroid in cell polygon; else nearest cell",
            "map_ramp": "same interpolate stops as Medellín scenario_stress fill-extrusion",
            "optimizer_input": False,
        },
        "skipped": {
            "outside_aoi": counts["skipped_outside_aoi"],
            "tiny": counts["skipped_tiny"],
            "invalid": counts["skipped_invalid"],
        },
        "aoi_area_m2": round(aoi_area, 1),
        "footprint_union_area_m2": round(footprint_area, 1),
        "footprint_coverage_pct": round(100.0 * footprint_area / aoi_area, 3) if aoi_area else 0.0,
        "level_height_m": LEVEL_HEIGHT_M,
        "fallback_height_m": FALLBACK_HEIGHT_M,
        "optimizer_input": False,
        "note": (
            "Visualization-only 3D massing. Building tones inherit city-relative "
            "drainage-stress screening intensity from the containing planning cell. "
            "Does not replace nanjing/buildings.geojson exposure proxies and must never "
            "enter the optimizer."
        ),
    }
    return features, meta


def main() -> None:
    features, meta = extract_buildings()
    fc = {"type": "FeatureCollection", "features": features}
    write_json(OUT_PUBLIC, fc)
    write_json(OUT_DERIVED, fc)
    meta["artifact_bytes"] = OUT_PUBLIC.stat().st_size
    write_json_pretty(OUT_META, meta)
    write_json_pretty(OUT_META_PUBLIC, meta)
    print(json.dumps({
        "buildings": meta["building_count"],
        "explicit": meta["height_provenance_counts"]["osm_reported_height"],
        "levels": meta["height_provenance_counts"]["level_derived_visualization"],
        "fallback": meta["height_provenance_counts"]["fallback_visualization_proxy"],
        "classes": meta["priority_class_counts"],
        "bytes": meta["artifact_bytes"],
        "coverage_pct": meta["footprint_coverage_pct"],
    }, indent=2))


if __name__ == "__main__":
    main()

"""
Build Nanjing Step-1 overview screening polygons with full AOI coverage.

Overview geometry (NOT optimizer units):
  - Prefer OpenStreetMap named campus / residential / park polygons (ODbL).
  - Fill remaining AOI with derived screening sectors from major roads/waterways
    (polygonize), not the raw 80-cell rectangular grid.

Optimization still uses the unchanged 80 planning_cells.geojson features.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, MultiLineString, Point, box, mapping, shape
from shapely.ops import linemerge, polygonize, unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
CELLS_PATH = ROOT / "frontend" / "public" / "data" / "nanjing" / "planning_cells.geojson"
OSM_PATH = ROOT / ".cache" / "nanjing" / "osm" / "osm_features.geojson"
OUT_DIR = ROOT / "frontend" / "public" / "data" / "nanjing"
DERIVED = ROOT / "data" / "derived" / "nanjing"
BBOX = (118.88, 32.075, 118.97, 32.145)
AOI = box(*BBOX)
MIN_NAMED_AREA_M2 = 25_000
MIN_SECTOR_AREA_M2 = 80_000
COVERAGE_THRESHOLD = 0.99
MAJOR_HIGHWAYS = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_fc(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def approx_area_m2(geom) -> float:
    lon, lat = geom.centroid.x, geom.centroid.y
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    return float(geom.area * m_per_deg_lat * m_per_deg_lon)


def display_name(props: dict) -> str:
    en = props.get("name_en")
    zh = props.get("name")
    if en and zh and en != zh:
        return f"{en} ({zh})"
    return en or zh or "Unnamed OSM area"


def ranks_desc(values: list[float]) -> list[int]:
    order = sorted(range(len(values)), key=lambda i: -values[i])
    out = [0] * len(values)
    for rank, idx in enumerate(order, start=1):
        out[idx] = rank
    return out


def minmax_norm(values: list[float]) -> list[float]:
    arr = np.asarray(values, dtype=float)
    lo, hi = float(np.nanmin(arr)), float(np.nanmax(arr))
    if not np.isfinite(lo) or not np.isfinite(hi) or abs(hi - lo) < 1e-12:
        return [0.5 for _ in values]
    return [float((v - lo) / (hi - lo)) for v in arr]


def cell_records(cells_fc: dict) -> list[dict]:
    rows = []
    for feat in cells_fc["features"]:
        geom = shape(feat["geometry"])
        props = feat["properties"]
        rows.append(
            {
                "cell_id": int(props["cell_id"]),
                "geom": geom,
                "centroid": geom.centroid,
                "properties": props,
            }
        )
    return rows


def select_named_overview(osm_fc: dict) -> list[dict]:
    candidates = []
    for feat in osm_fc["features"]:
        props = feat["properties"]
        kind = props.get("kind")
        if kind not in {"campus", "named_area", "park"}:
            continue
        if not props.get("name"):
            continue
        if kind == "named_area" and props.get("landuse") not in {
            "residential",
            "education",
            "commercial",
            "retail",
        }:
            continue
        geom = make_valid(shape(feat["geometry"]))
        if geom.is_empty:
            continue
        clipped = geom.buffer(0).intersection(AOI)
        if clipped.is_empty or clipped.area <= 0:
            continue
        if clipped.geom_type == "GeometryCollection":
            polys = [g for g in clipped.geoms if g.geom_type in {"Polygon", "MultiPolygon"}]
            if not polys:
                continue
            clipped = unary_union(polys)
        area_m2 = approx_area_m2(clipped)
        if area_m2 < MIN_NAMED_AREA_M2:
            continue
        candidates.append(
            {
                "geom": clipped,
                "area_m2": area_m2,
                "kind": kind,
                "props": props,
            }
        )
    candidates.sort(key=lambda c: -c["area_m2"])
    selected = []
    covered = None
    for cand in candidates:
        g = cand["geom"]
        if covered is not None:
            inter = g.intersection(covered)
            overlap = inter.area / g.area if g.area > 0 else 1.0
            if overlap > 0.55:
                continue
        selected.append(cand)
        covered = g if covered is None else unary_union([covered, g])
        if len(selected) >= 24:
            break
    return selected


def collect_cut_lines(osm_fc: dict):
    lines = []
    for feat in osm_fc["features"]:
        props = feat["properties"]
        kind = props.get("kind")
        geom = shape(feat["geometry"])
        if geom.is_empty:
            continue
        if kind == "road" and props.get("highway") in MAJOR_HIGHWAYS:
            clipped = geom.intersection(AOI)
            if clipped.is_empty:
                continue
            if clipped.geom_type == "LineString":
                lines.append(clipped)
            elif clipped.geom_type == "MultiLineString":
                lines.extend(list(clipped.geoms))
        if kind == "water":
            clipped = geom.intersection(AOI)
            if clipped.is_empty:
                continue
            if clipped.geom_type == "LineString":
                lines.append(clipped)
            elif clipped.geom_type == "MultiLineString":
                lines.extend(list(clipped.geoms))
            elif clipped.geom_type in {"Polygon", "MultiPolygon"}:
                lines.append(clipped.boundary)
    return lines


def sector_letter(idx: int) -> str:
    # A, B, ... Z, AA, AB...
    n = idx
    chars = []
    while True:
        n, rem = divmod(n, 26)
        chars.append(chr(ord("A") + rem))
        if n == 0:
            break
        n -= 1
    return "".join(reversed(chars))


def derive_screening_sectors(named_union, osm_fc: dict) -> list:
    remaining = AOI.difference(named_union) if named_union and not named_union.is_empty else AOI
    remaining = make_valid(remaining).buffer(0)
    if remaining.is_empty:
        return []

    cut_lines = collect_cut_lines(osm_fc)
    # Light buffer so parallel roads form clean separators without large voids.
    separators = []
    for line in cut_lines:
        if line.is_empty:
            continue
        separators.append(line.buffer(0.00035, cap_style=2, join_style=2))
    if separators:
        cut_union = unary_union(separators)
        pieces = remaining.difference(cut_union)
    else:
        pieces = remaining

    raw_polys = []
    if pieces.geom_type == "Polygon":
        raw_polys = [pieces]
    elif pieces.geom_type == "MultiPolygon":
        raw_polys = list(pieces.geoms)
    elif pieces.geom_type == "GeometryCollection":
        raw_polys = [g for g in pieces.geoms if g.geom_type in {"Polygon", "MultiPolygon"}]
        expanded = []
        for g in raw_polys:
            if g.geom_type == "MultiPolygon":
                expanded.extend(list(g.geoms))
            else:
                expanded.append(g)
        raw_polys = expanded

    # Also polygonize road network + AOI boundary as a complementary split when cuts are sparse.
    if cut_lines:
        network = unary_union(cut_lines + [AOI.boundary])
        try:
            merged = linemerge(network)
        except Exception:
            merged = network
        for poly in polygonize(merged):
            inter = make_valid(poly.intersection(remaining)).buffer(0)
            if inter.is_empty:
                continue
            if inter.geom_type == "Polygon":
                raw_polys.append(inter)
            elif inter.geom_type == "MultiPolygon":
                raw_polys.extend(list(inter.geoms))

    # Deduplicate / merge tiny scraps into nearest large polygon.
    cleaned = []
    for poly in raw_polys:
        poly = make_valid(poly).buffer(0).intersection(remaining)
        if poly.is_empty:
            continue
        if poly.geom_type == "MultiPolygon":
            cleaned.extend(list(poly.geoms))
        elif poly.geom_type == "Polygon":
            cleaned.append(poly)

    large = []
    small = []
    for poly in cleaned:
        area = approx_area_m2(poly)
        if area >= MIN_SECTOR_AREA_M2:
            large.append(poly)
        elif area > 5_000:
            small.append(poly)

    if not large and remaining.geom_type in {"Polygon", "MultiPolygon"}:
        # Fallback: spatial clustering of remaining area via grid-free Voronoi-like dissolve
        # of random sample points — last resort irregular sectors.
        return [remaining] if remaining.geom_type == "Polygon" else list(remaining.geoms)

    for scrap in small:
        if not large:
            large.append(scrap)
            continue
        nearest = min(large, key=lambda g: g.distance(scrap.centroid))
        idx = large.index(nearest)
        large[idx] = make_valid(unary_union([nearest, scrap])).buffer(0)

    # Merge highly overlapping fragments from dual methods.
    merged_out = []
    for poly in sorted(large, key=lambda g: -g.area):
        absorbed = False
        for i, existing in enumerate(merged_out):
            inter = poly.intersection(existing)
            if inter.area / min(poly.area, existing.area) > 0.4:
                merged_out[i] = make_valid(unary_union([existing, poly])).buffer(0)
                absorbed = True
                break
        if not absorbed:
            merged_out.append(poly)

    # Cap sector count for readability while keeping coverage.
    if len(merged_out) > 14:
        merged_out = sorted(merged_out, key=lambda g: -g.area)[:14]
        leftovers = remaining.difference(unary_union(merged_out))
        if not leftovers.is_empty:
            merged_out[0] = make_valid(unary_union([merged_out[0], leftovers])).buffer(0)

    return merged_out


def aggregate_from_cells(member_cells: list[dict], geom) -> dict:
    if not member_cells:
        return {
            "population_proxy": 0.0,
            "population_estimate": 0.0,
            "population_label": "WorldPop 2026 population estimate (aggregated from planning cells)",
            "built_up_fraction": 0.0,
            "drainage_stress_proxy": 0.0,
            "runoff_pressure_proxy": 0.0,
            "mean_elevation_m": None,
            "mean_slope_deg": None,
            "priority_exposure_raw": 0.0,
            "priority_balanced_raw": 0.0,
            "priority_runoff_raw": 0.0,
            "member_cell_ids": [],
            "member_cell_count": 0,
            "member_overlaps": [],
            "aggregation_method": "population_weighted_mean_for_proxies;sum_for_population",
        }

    pops = [float(c["properties"].get("population_proxy") or 0) for c in member_cells]
    pop_sum = float(sum(pops))
    weights = pops if pop_sum > 0 else [1.0] * len(member_cells)

    def wmean(key: str, default: float = 0.0) -> float:
        vals = [float(c["properties"].get(key) or default) for c in member_cells]
        return float(np.average(vals, weights=weights))

    overlaps = []
    for c in member_cells:
        inter = geom.intersection(c["geom"])
        overlaps.append(
            {
                "cell_id": int(c["cell_id"]),
                "overlap_area_m2": round(approx_area_m2(inter), 1) if not inter.is_empty else 0.0,
            }
        )

    built = wmean("built_up_fraction")
    stress = wmean("drainage_stress_proxy")
    runoff = wmean("runoff_pressure_proxy")
    elev = wmean("mean_elevation_m")
    slope = wmean("mean_slope_deg")
    exposure = pop_sum * stress
    balanced = 0.75 * exposure + 0.25 * (pop_sum * runoff)
    return {
        "population_proxy": round(pop_sum, 1),
        "population_estimate": round(pop_sum, 1),
        "population_label": "WorldPop 2026 population estimate (aggregated from planning cells)",
        "built_up_fraction": round(built, 4),
        "drainage_stress_proxy": round(stress, 4),
        "runoff_pressure_proxy": round(runoff, 4),
        "mean_elevation_m": round(elev, 2),
        "mean_slope_deg": round(slope, 2),
        "priority_exposure_raw": round(exposure, 3),
        "priority_balanced_raw": round(balanced, 3),
        "priority_runoff_raw": round(stress, 4),
        "member_cell_ids": [int(c["cell_id"]) for c in member_cells],
        "member_cell_count": len(member_cells),
        "member_overlaps": overlaps,
        "aggregation_method": "population_weighted_mean_for_proxies;sum_for_population;centroid_membership",
    }


def assign_cells_to_polygon(cells: list[dict], geom, claimed_ids: set[int] | None = None) -> list[dict]:
    members = []
    for c in cells:
        if claimed_ids is not None and c["cell_id"] in claimed_ids:
            continue
        if geom.intersects(c["centroid"]) or geom.contains(c["centroid"]):
            members.append(c)
    return members


def compute_coverage(overview_geoms) -> dict:
    covered = unary_union(overview_geoms) if overview_geoms else None
    aoi_area = float(AOI.area)
    covered_area = float(covered.intersection(AOI).area) if covered and not covered.is_empty else 0.0
    uncovered_area = max(0.0, aoi_area - covered_area)
    pct = covered_area / aoi_area if aoi_area else 0.0
    return {
        "aoi_area_deg2": aoi_area,
        "aoi_area_m2": approx_area_m2(AOI),
        "covered_area_deg2": covered_area,
        "covered_area_m2": approx_area_m2(covered.intersection(AOI)) if covered and not covered.is_empty else 0.0,
        "uncovered_area_deg2": uncovered_area,
        "uncovered_area_m2": approx_area_m2(AOI) - (
            approx_area_m2(covered.intersection(AOI)) if covered and not covered.is_empty else 0.0
        ),
        "coverage_ratio": pct,
        "coverage_pct": round(100.0 * pct, 3),
    }


def build_overview() -> dict:
    cells_fc = load_fc(CELLS_PATH)
    osm_fc = load_fc(OSM_PATH)
    cells = cell_records(cells_fc)
    named = select_named_overview(osm_fc)

    overview = []
    claimed_ids: set[int] = set()
    covered_parts = []

    for i, cand in enumerate(named, start=1):
        members = assign_cells_to_polygon(cells, cand["geom"], claimed_ids)
        # Keep named polygons even with zero cells for geographic continuity;
        # still prefer members when present.
        for m in members:
            claimed_ids.add(m["cell_id"])
        covered_parts.append(cand["geom"])
        agg = aggregate_from_cells(members, cand["geom"])
        name = display_name(cand["props"])
        overview.append(
            {
                "type": "Feature",
                "properties": {
                    "OBJECTID": 1000 + i,
                    "overview_id": f"osm_{cand['kind']}_{cand['props'].get('osm_id')}",
                    "NAME": name,
                    "BARRIO": name,
                    "label": name,
                    "comuna_name": "Xianlin / Qixia · OSM named area",
                    "geometry_class": "osm_named_polygon",
                    "geometry_provenance": (
                        "OpenStreetMap (ODbL) named campus/residential/park polygon clipped to screening AOI"
                    ),
                    "kind": cand["kind"],
                    "area_m2": round(cand["area_m2"], 1),
                    "is_focus_area": "xianlin" in name.lower() or "仙林" in name,
                    "map_fill": True,
                    **agg,
                },
                "geometry": mapping(cand["geom"]),
            }
        )

    named_union = unary_union(covered_parts) if covered_parts else None
    sectors = derive_screening_sectors(named_union, osm_fc)
    for j, geom in enumerate(sectors):
        geom = make_valid(geom).buffer(0).intersection(AOI)
        if geom.is_empty:
            continue
        if geom.geom_type == "MultiPolygon":
            # Keep as multipolygon for coverage; MapLibre supports it.
            pass
        elif geom.geom_type != "Polygon":
            continue
        members = assign_cells_to_polygon(cells, geom, claimed_ids)
        for m in members:
            claimed_ids.add(m["cell_id"])
        # Also attach any still-unclaimed cell whose centroid falls in sector later.
        agg = aggregate_from_cells(members, geom)
        letter = sector_letter(j)
        label = f"Screening Sector {letter}"
        overview.append(
            {
                "type": "Feature",
                "properties": {
                    "OBJECTID": 2000 + j + 1,
                    "overview_id": f"sector_{letter}",
                    "NAME": label,
                    "BARRIO": label,
                    "label": label,
                    "comuna_name": "Derived screening sector",
                    "geometry_class": "derived_screening_sector",
                    "geometry_provenance": (
                        "Derived screening polygon from AOI remainder split by major OSM roads/waterways; "
                        "not an administrative boundary or neighborhood"
                    ),
                    "kind": "screening_sector",
                    "area_m2": round(approx_area_m2(geom), 1),
                    "is_focus_area": False,
                    "map_fill": True,
                    **agg,
                },
                "geometry": mapping(geom),
            }
        )

    # Assign any leftover cells to nearest overview polygon for metric completeness.
    leftover = [c for c in cells if c["cell_id"] not in claimed_ids]
    if leftover and overview:
        for cell in leftover:
            nearest = min(
                overview,
                key=lambda f: shape(f["geometry"]).distance(cell["centroid"]),
            )
            nearest["properties"]["member_cell_ids"].append(int(cell["cell_id"]))
            nearest["properties"]["member_cell_count"] = len(nearest["properties"]["member_cell_ids"])
            claimed_ids.add(cell["cell_id"])
            # Re-aggregate nearest with updated members
            member_ids = set(nearest["properties"]["member_cell_ids"])
            members = [c for c in cells if c["cell_id"] in member_ids]
            nearest["properties"].update(aggregate_from_cells(members, shape(nearest["geometry"])))

    # Fill residual coverage slivers if needed.
    coverage = compute_coverage([shape(f["geometry"]) for f in overview])
    if coverage["coverage_ratio"] < COVERAGE_THRESHOLD:
        covered = unary_union([shape(f["geometry"]) for f in overview])
        gap = make_valid(AOI.difference(covered)).buffer(0)
        if not gap.is_empty and approx_area_m2(gap) > 1_000:
            members = assign_cells_to_polygon(cells, gap, None)
            letter = sector_letter(len([f for f in overview if f["properties"]["geometry_class"] == "derived_screening_sector"]))
            overview.append(
                {
                    "type": "Feature",
                    "properties": {
                        "OBJECTID": 2999,
                        "overview_id": f"sector_gap_{letter}",
                        "NAME": f"Screening Sector {letter}",
                        "BARRIO": f"Screening Sector {letter}",
                        "label": f"Screening Sector {letter}",
                        "comuna_name": "Derived screening sector",
                        "geometry_class": "derived_screening_sector",
                        "geometry_provenance": (
                            "Residual AOI coverage fill; derived screening polygon, not administrative"
                        ),
                        "kind": "screening_sector",
                        "area_m2": round(approx_area_m2(gap), 1),
                        "is_focus_area": False,
                        "map_fill": True,
                        **aggregate_from_cells(members, gap),
                    },
                    "geometry": mapping(gap),
                }
            )
            coverage = compute_coverage([shape(f["geometry"]) for f in overview])

    exp = [f["properties"]["priority_exposure_raw"] for f in overview]
    bal = [f["properties"]["priority_balanced_raw"] for f in overview]
    run = [f["properties"]["priority_runoff_raw"] for f in overview]
    exp_r = ranks_desc(exp)
    bal_r = ranks_desc(bal)
    run_r = ranks_desc(run)
    lr_score = [1.0 / exp_r[i] + 1.0 / bal_r[i] + 1.0 / run_r[i] for i in range(len(overview))]
    lr_r = ranks_desc(lr_score)
    exp_n = minmax_norm(exp)
    bal_n = minmax_norm(bal)
    run_n = minmax_norm(run)
    lr_n = minmax_norm(lr_score)

    for i, feat in enumerate(overview):
        p = feat["properties"]
        p["rank_exposure"] = exp_r[i]
        p["rank_balanced"] = bal_r[i]
        p["rank_runoff"] = run_r[i]
        p["rank_low_regret"] = lr_r[i]
        p["rank_equity"] = None
        p["priority_exposure"] = round(exp_n[i], 4)
        p["priority_balanced"] = round(bal_n[i], 4)
        p["priority_runoff"] = round(run_n[i], 4)
        p["priority_low_regret"] = round(lr_n[i], 4)
        p["priority_equity"] = None
        p["priority_low_regret_raw"] = round(lr_score[i], 4)
        p["normalization"] = "minmax_within_nanjing_overview"

    if not any(f["properties"].get("is_focus_area") for f in overview):
        densest = max(overview, key=lambda f: f["properties"].get("population_proxy") or 0)
        densest["properties"]["is_focus_area"] = True

    osm_named_count = sum(1 for f in overview if f["properties"]["geometry_class"] == "osm_named_polygon")
    derived_sector_count = sum(
        1 for f in overview if f["properties"]["geometry_class"] == "derived_screening_sector"
    )

    if coverage["coverage_ratio"] < COVERAGE_THRESHOLD:
        raise RuntimeError(
            f"Nanjing overview coverage {coverage['coverage_pct']}% < {COVERAGE_THRESHOLD * 100:.0f}%"
        )

    meta = {
        "schema": "ourea-nanjing-overview-screening",
        "schema_version": 2,
        "generated_at": utc_now(),
        "bbox": list(BBOX),
        "overview_polygon_count": len(overview),
        "osm_named_count": osm_named_count,
        "derived_sector_count": derived_sector_count,
        "planning_cells_unchanged": True,
        "planning_cell_count": len(cells),
        "cells_assigned": len(claimed_ids),
        "coverage": coverage,
        "coverage_threshold": COVERAGE_THRESHOLD,
        "aggregation": {
            "population_proxy": "sum of member-cell population_proxy (centroid membership)",
            "drainage_stress_proxy": "population-weighted mean of member cells",
            "built_up_fraction": "population-weighted mean of member cells",
            "runoff_pressure_proxy": "population-weighted mean of member cells",
            "priority_choropleth_fields": "minmax normalized within Nanjing overview set to [0,1]",
            "optimizer_units": "frontend/public/data/nanjing/planning_cells.geojson (unchanged)",
        },
        "provenance": {
            "osm": "OpenStreetMap via api.openstreetmap.org map API tiles; ODbL",
            "derived_sectors": (
                "AOI remainder after OSM named polygons, split by major roads/waterways; "
                "not administrative"
            ),
        },
        "map_fill_policy": "all overview polygons including derived sectors",
        "note": (
            "Step-1 overview only. Portfolio optimization continues on the 80 planning cells. "
            "Priority fill colors use city-relative [0,1] normalization, not Medellín thresholds."
        ),
    }

    # Context layers (roads / water / labels) — reuse prior extraction style
    roads = []
    for feat in osm_fc["features"]:
        if feat["properties"].get("kind") != "road":
            continue
        if feat["properties"].get("highway") not in MAJOR_HIGHWAYS | {"residential"}:
            continue
        roads.append(feat)
    water = [f for f in osm_fc["features"] if f["properties"].get("kind") == "water"]
    labels = []
    for feat in osm_fc["features"]:
        if feat["properties"].get("kind") == "place" and feat["properties"].get("name"):
            labels.append(feat)
    for feat in overview:
        if feat["properties"]["geometry_class"] != "osm_named_polygon":
            continue
        geom = shape(feat["geometry"])
        c = geom.representative_point()
        labels.append(
            {
                "type": "Feature",
                "properties": {
                    "kind": "overview_label",
                    "name": feat["properties"]["NAME"],
                    "source": "OpenStreetMap",
                },
                "geometry": mapping(c),
            }
        )

    return {
        "screening": {"type": "FeatureCollection", "features": overview},
        "roads": {"type": "FeatureCollection", "features": roads},
        "context_water": {"type": "FeatureCollection", "features": water},
        "place_labels": {"type": "FeatureCollection", "features": labels},
        "meta": meta,
    }


def main() -> None:
    payload = build_overview()
    write_json(OUT_DIR / "screening.geojson", payload["screening"])
    write_json(OUT_DIR / "roads.geojson", payload["roads"])
    write_json(OUT_DIR / "context_water.geojson", payload["context_water"])
    write_json(OUT_DIR / "place_labels.geojson", payload["place_labels"])
    write_json(OUT_DIR / "overview_meta.json", payload["meta"])
    write_json(DERIVED / "overview_meta.json", payload["meta"])
    write_json(DERIVED / "overview_coverage.json", {
        **payload["meta"]["coverage"],
        "osm_named_count": payload["meta"]["osm_named_count"],
        "derived_sector_count": payload["meta"]["derived_sector_count"],
        "overview_polygon_count": payload["meta"]["overview_polygon_count"],
        "coverage_threshold": payload["meta"]["coverage_threshold"],
        "generated_at": payload["meta"]["generated_at"],
    })
    print(
        json.dumps(
            {
                "overview": payload["meta"]["overview_polygon_count"],
                "osm_named": payload["meta"]["osm_named_count"],
                "sectors": payload["meta"]["derived_sector_count"],
                "coverage_pct": payload["meta"]["coverage"]["coverage_pct"],
                "cells_assigned": payload["meta"]["cells_assigned"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

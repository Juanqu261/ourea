"""Parse cached OSM XML tiles into GeoJSON features for Nanjing overview."""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / ".cache" / "nanjing" / "osm" / "tiles"
OUT = ROOT / ".cache" / "nanjing" / "osm" / "osm_features.geojson"


def tags_of(el: ET.Element) -> dict[str, str]:
    return {t.get("k"): t.get("v") for t in el.findall("tag") if t.get("k")}


def main() -> None:
    nodes: dict[str, tuple[float, float]] = {}
    feats: list[dict] = []
    for path in sorted(TILE_DIR.glob("tile*.osm")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "too many nodes" in text or text.strip().startswith("You requested"):
            print("skip", path.name)
            continue
        try:
            root = ET.fromstring(text)
        except ET.ParseError as exc:
            print("parse fail", path.name, exc)
            continue
        for n in root.findall("node"):
            nid = n.get("id")
            nodes[nid] = (float(n.get("lon")), float(n.get("lat")))
            tags = tags_of(n)
            if tags.get("place") and tags.get("name"):
                name = tags["name"]
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": nodes[nid]},
                        "properties": {
                            "kind": "place",
                            "place": tags.get("place"),
                            "name": name,
                            "name_en": tags.get("name:en"),
                            "name_zh": name if re.search(r"[\u4e00-\u9fff]", name) else None,
                            "source": "OpenStreetMap",
                            "osm_id": nid,
                        },
                    }
                )
        for w in root.findall("way"):
            tags = tags_of(w)
            refs = [nd.get("ref") for nd in w.findall("nd")]
            coords = [nodes[r] for r in refs if r in nodes]
            if len(coords) < 2:
                continue
            highway = tags.get("highway")
            if highway in {
                "motorway",
                "trunk",
                "primary",
                "secondary",
                "tertiary",
                "residential",
                "unclassified",
                "living_street",
            }:
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "LineString", "coordinates": coords},
                        "properties": {
                            "kind": "road",
                            "highway": highway,
                            "name": tags.get("name") or tags.get("name:en"),
                            "source": "OpenStreetMap",
                            "osm_id": w.get("id"),
                        },
                    }
                )
            if tags.get("natural") == "water" or tags.get("waterway") in {
                "river",
                "canal",
                "stream",
            }:
                closed = coords[0] == coords[-1] and len(coords) >= 4
                geom = (
                    {"type": "Polygon", "coordinates": [coords]}
                    if closed
                    else {"type": "LineString", "coordinates": coords}
                )
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": geom,
                        "properties": {
                            "kind": "water",
                            "name": tags.get("name") or tags.get("name:en"),
                            "natural": tags.get("natural"),
                            "waterway": tags.get("waterway"),
                            "source": "OpenStreetMap",
                            "osm_id": w.get("id"),
                        },
                    }
                )
            closed = coords[0] == coords[-1] and len(coords) >= 4
            if not closed:
                continue
            if tags.get("landuse") in {"residential", "education", "commercial", "retail"} and tags.get(
                "name"
            ):
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": [coords]},
                        "properties": {
                            "kind": "named_area",
                            "landuse": tags.get("landuse"),
                            "name": tags.get("name"),
                            "name_en": tags.get("name:en"),
                            "source": "OpenStreetMap",
                            "osm_id": w.get("id"),
                        },
                    }
                )
            if tags.get("amenity") in {"university", "college"} and tags.get("name"):
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": [coords]},
                        "properties": {
                            "kind": "campus",
                            "name": tags.get("name"),
                            "name_en": tags.get("name:en"),
                            "source": "OpenStreetMap",
                            "osm_id": w.get("id"),
                        },
                    }
                )
            if tags.get("leisure") in {"park", "nature_reserve"} and tags.get("name"):
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": [coords]},
                        "properties": {
                            "kind": "park",
                            "name": tags.get("name"),
                            "name_en": tags.get("name:en"),
                            "source": "OpenStreetMap",
                            "osm_id": w.get("id"),
                        },
                    }
                )

    # Deduplicate
    seen: set[tuple] = set()
    unique: list[dict] = []
    for f in feats:
        key = (
            f["properties"].get("kind"),
            f["properties"].get("osm_id"),
            f["properties"].get("name"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)

    by_kind: dict[str, int] = defaultdict(int)
    for f in unique:
        by_kind[f["properties"]["kind"]] += 1
    print("features", len(unique), dict(by_kind))
    for f in unique:
        p = f["properties"]
        if p["kind"] in {"place", "named_area", "campus", "park"} and p.get("name"):
            line = f"{p['kind']}|{p.get('name')}|{p.get('name_en')}|{p.get('place') or p.get('landuse')}"
            print(line.encode("ascii", "backslashreplace").decode("ascii"))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": unique}, ensure_ascii=False),
        encoding="utf-8",
    )
    print("wrote", OUT, "n=", len(unique))


if __name__ == "__main__":
    main()

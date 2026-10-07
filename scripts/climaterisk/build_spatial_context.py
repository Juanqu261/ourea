"""Cache CORNARE vector context for the Rionegro–Guarne–Marinilla corridor.

The script reads the local DANE municipalities and queries the public ArcGIS
REST directory. It does not modify CLIMATERISK/ and it does not turn these
layers into decision-model scores.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[2]
MUNICIPALITIES = ROOT / "frontend" / "public" / "data" / "cornare" / "municipalities.geojson"
OUT = ROOT / "frontend" / "public" / "data" / "cornare" / "map"
BASE = "https://mapas.cornare.gov.co/arcgis/rest/services"
ACCESSED = "2026-10-07"
BUFFER_DEGREES = 0.02
USER_AGENT = "Ourea-CORNARE/1.0 (local spatial cache)"

VECTOR_LAYERS = [
    {
        "id": "wetlands",
        "file": "wetlands.geojson",
        "path": "Determinantes/humedales/MapServer/0",
        "fields": ["nom_are", "categor", "regiona", "codigo"],
        "group": "nature",
        "label": "Humedales",
        "default_visible": True,
        "kind": "fill",
        "simplify": 0.00012,
        "dissolve": None,
    },
    {
        "id": "protected_areas",
        "file": "protected_areas.geojson",
        "path": "Areas_Protegidas/Areas_Protegidas_2022/MapServer/0",
        "fields": ["Nombre_Are", "Acto_Admin", "Cerro"],
        "group": "nature",
        "label": "Áreas protegidas",
        "default_visible": True,
        "kind": "fill",
        "simplify": 0.00015,
        "dissolve": None,
    },
    {
        "id": "rio_negro_riparian",
        "file": "rio_negro_riparian.geojson",
        "path": "Rondas/Rondas_251_Q_Rio_Negro/FeatureServer/0",
        "fields": ["Nombre", "Uso_Ronda", "Tipo_Ronda"],
        "group": "nature",
        "label": "Ronda Río Negro",
        "default_visible": True,
        "kind": "fill",
        "simplify": 0.00004,
        "dissolve": None,
    },
    {
        "id": "la_marinilla_ecosystem",
        "file": "la_marinilla_ecosystem.geojson",
        "path": "Rondas/Rondas_La_Marinilla_Ecosistemico/FeatureServer/0",
        "fields": [],
        "group": "nature",
        "label": "Ecosistema Quebrada La Marinilla",
        "default_visible": False,
        "kind": "fill",
        "simplify": 0.00004,
        "dissolve": None,
    },
    {
        "id": "la_marinilla_zoning",
        "file": "la_marinilla_zoning.geojson",
        "path": "Rondas/Rondas_La_Marinilla_Zonificacion/FeatureServer/0",
        "fields": ["Nombre", "Uso_Ronda", "Tipo_Ronda"],
        "group": "nature",
        "label": "Zonificación Quebrada La Marinilla",
        "default_visible": True,
        "kind": "fill",
        "simplify": 0.00005,
        "dissolve": None,
    },
    {
        "id": "hydrography",
        "file": "hydrography.geojson",
        "path": "RECURSO_HIDRICO/Hidrologia/MapServer/10",
        "fields": ["NMG", "TIPO"],
        "group": "nature",
        "label": "Ríos principales",
        "default_visible": True,
        "kind": "line",
        "simplify": 0.00008,
        "dissolve": None,
    },
    {
        "id": "pomca_rio_negro",
        "file": "pomca_rio_negro.geojson",
        "path": "POMCAS/pomca_rio_negro/MapServer/1",
        "fields": ["*"],
        "group": "territory",
        "label": "POMCA Río Negro",
        "default_visible": False,
        "kind": "line",
        "simplify": 0.0008,
        "dissolve": "pomca",
    },
    {
        "id": "mass_movement",
        "file": "mass_movement.geojson",
        "path": "OAT_Y_GR/Cornare_Movimiento_Masa2/MapServer/0",
        "fields": ["AMENAZA"],
        "group": "risk",
        "label": "Movimiento en masa",
        "default_visible": False,
        "kind": "fill",
        "simplify": 0.0035,
        "dissolve": "amenaza",
        "offset": 0.0007,
    },
]


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def query(path: str, params: dict) -> dict:
    url = f"{BASE}/{path}/query?" + urllib.parse.urlencode(params)
    return get_json(url)


def shoelace(ring: list) -> float:
    area = 0.0
    for index in range(len(ring) - 1):
        x1, y1 = ring[index][:2]
        x2, y2 = ring[index + 1][:2]
        area += x1 * y2 - x2 * y1
    return area


def esri_polygon(rings: list):
    exteriors = []
    holes = []
    for ring in rings:
        if len(ring) < 4:
            continue
        # ArcGIS exterior rings are clockwise (negative shoelace here).
        # ArcGIS shells are clockwise, which is a negative signed area.
        if shoelace(ring) < 0:
            exteriors.append(ring)
        else:
            holes.append(ring)
    if not exteriors:
        exteriors = holes
        holes = []
    polygons = []
    for exterior in exteriors:
        shell = Polygon(exterior)
        if shell.is_empty:
            continue
        contained = []
        for hole in holes:
            candidate = Polygon(hole)
            if candidate.is_empty:
                continue
            if shell.contains(candidate.representative_point()):
                contained.append(hole)
        polygons.append(Polygon(exterior, contained))
    if not polygons:
        return None
    geometry = polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)
    return make_valid(geometry)


def esri_geometry(geometry: dict | None):
    if not geometry:
        return None
    if geometry.get("rings"):
        return esri_polygon(geometry["rings"])
    paths = [path for path in geometry.get("paths") or [] if len(path) >= 2]
    if not paths:
        return None
    lines = [LineString(path) for path in paths]
    geometry = lines[0] if len(lines) == 1 else MultiLineString(lines)
    return make_valid(geometry)


def clean_properties(attributes: dict, fields: list[str], layer_id: str) -> dict:
    if fields == ["*"]:
        kept = {
            key: value
            for key, value in attributes.items()
            if value not in (None, "") and not str(key).lower().startswith("shape")
        }
    else:
        kept = {key: attributes.get(key) for key in fields if attributes.get(key) not in (None, "")}
    name = (
        kept.get("nom_are")
        or kept.get("Nombre_Are")
        or kept.get("Nombre")
        or kept.get("NMG")
        or kept.get("AMENAZA")
    )
    properties = {
        "layer_id": layer_id,
        "name": name,
        "category": kept.get("categor") or kept.get("Tipo_Ronda") or kept.get("TIPO") or kept.get("AMENAZA"),
        "use": kept.get("Uso_Ronda") or kept.get("Acto_Admin") or kept.get("regiona"),
        "source_id": f"gis-{layer_id}",
        "provenance": "institutional",
        "exact_site": False,
    }
    properties = {key: value for key, value in properties.items() if value not in (None, "")}
    if "AMENAZA" in kept:
        properties["amenaza"] = threat_class(kept["AMENAZA"])
        properties["amenaza_label"] = kept["AMENAZA"]
    return properties


def threat_class(value: str) -> str:
    text = str(value).lower()
    if "muy alta" in text:
        return "muy_alta"
    if "alta" in text:
        return "alta"
    if "media" in text:
        return "media"
    if "baja" in text:
        return "baja"
    return "sin_clase"


def fetch_features(spec: dict, bbox: tuple[float, float, float, float]) -> list[dict]:
    envelope = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    layer = get_json(f"{BASE}/{spec['path']}?f=pjson")
    object_field = layer.get("objectIdField") or "OBJECTID"
    page_size = min(int(layer.get("maxRecordCount") or 500), 200)
    listed = query(spec["path"], {
        "where": "1=1",
        "returnIdsOnly": "true",
        "geometry": envelope,
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "f": "pjson",
    })
    if listed.get("error"):
        raise RuntimeError(f"{spec['id']} id query failed: {listed['error']}")
    object_ids = listed.get("objectIds") or []
    object_field = listed.get("objectIdFieldName") or object_field
    print(f"  {spec['id']}: {len(object_ids)} features")
    features = []
    out_fields = ",".join(spec["fields"]) if spec["fields"] != ["*"] else "*"
    for start in range(0, len(object_ids), page_size):
        chunk = object_ids[start:start + page_size]
        params = {
            "where": f"{object_field} IN ({','.join(str(item) for item in chunk)})",
            "outFields": out_fields,
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "pjson",
        }
        if spec.get("offset"):
            params["maxAllowableOffset"] = spec["offset"]
            params["geometryPrecision"] = "5"
        payload = query(spec["path"], params)
        if payload.get("error"):
            raise RuntimeError(f"{spec['id']} page failed: {payload['error']}")
        features.extend(payload.get("features") or [])
        if spec["id"] == "mass_movement" and start % 2000 == 0:
            print(f"    downloaded {min(start + page_size, len(object_ids))}/{len(object_ids)}")
    return features


def to_records(raw_features: list[dict], spec: dict, mask) -> list[dict]:
    records = []
    for feature in raw_features:
        geometry = esri_geometry(feature.get("geometry"))
        if geometry is None or geometry.is_empty:
            continue
        geometry = make_valid(geometry.intersection(mask))
        if geometry.is_empty:
            continue
        geometry = geometry.simplify(spec["simplify"], preserve_topology=True)
        if geometry.is_empty:
            continue
        records.append({
            "geometry": geometry,
            "properties": clean_properties(feature.get("attributes") or {}, spec["fields"], spec["id"]),
        })
    return records


def display_polygons(geometry, tolerance: float):
    geometry = make_valid(geometry)
    if geometry.geom_type == "GeometryCollection":
        parts = [part for part in geometry.geoms if part.geom_type.endswith("Polygon")]
        if not parts:
            return None
        geometry = unary_union(parts)
    geometry = geometry.simplify(tolerance, preserve_topology=True)
    if geometry.is_empty:
        return None
    if geometry.geom_type == "Polygon":
        return geometry if geometry.area > 1e-6 else None
    if geometry.geom_type == "MultiPolygon":
        parts = [part for part in geometry.geoms if part.area > 1e-6]
        if not parts:
            return None
        return parts[0] if len(parts) == 1 else unary_union(parts)
    return geometry if not geometry.is_empty else None


def dissolve(records: list[dict], mode: str) -> list[dict]:
    if mode == "pomca":
        geometry = unary_union([record["geometry"] for record in records]).simplify(0.0008, preserve_topology=True)
        return [{
            "geometry": geometry.boundary if geometry.geom_type.endswith("Polygon") else geometry,
            "properties": {
                "layer_id": "pomca_rio_negro",
                "name": "Cobertura municipal del POMCA Río Negro",
                "category": "cuenca",
                "source_id": "gis-pomca_rio_negro",
                "provenance": "institutional",
                "exact_site": False,
                "limitation": "Estar dentro del POMCA no es un puntaje de riesgo climático.",
            },
        }]
    groups: dict[str, list] = {}
    labels: dict[str, str] = {}
    for record in records:
        key = record["properties"].get("amenaza") or "sin_clase"
        groups.setdefault(key, []).append(record["geometry"])
        labels[key] = record["properties"].get("amenaza_label") or key
    dissolved = []
    for key, geometries in groups.items():
        geometry = display_polygons(unary_union(geometries), 0.0035)
        if geometry is None:
            continue
        dissolved.append({
            "geometry": geometry,
            "properties": {
                "layer_id": "mass_movement",
                "name": labels[key],
                "amenaza": key,
                "amenaza_label": labels[key],
                "category": labels[key],
                "source_id": "gis-mass_movement",
                "provenance": "institutional",
                "exact_site": False,
                "limitation": "Amenaza por movimiento en masa. No es la vulnerabilidad climática del reto.",
            },
        })
    return dissolved


def feature_collection(records: list[dict]) -> dict:
    features = []
    for index, record in enumerate(records, start=1):
        geometry = record["geometry"]
        if geometry.geom_type == "GeometryCollection":
            polygons = [part for part in geometry.geoms if part.geom_type.endswith("Polygon") or "Line" in part.geom_type]
            if not polygons:
                continue
            geometry = polygons[0] if len(polygons) == 1 else unary_union(polygons)
        features.append({
            "type": "Feature",
            "id": index,
            "properties": record["properties"],
            "geometry": mapping(geometry),
        })
    return {"type": "FeatureCollection", "features": features}


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def source_record(spec: dict, count: int) -> dict:
    return {
        "id": f"gis-{spec['id']}",
        "title": spec["label"],
        "institution": "CORNARE",
        "year": 2026,
        "url": f"{BASE}/{spec['path']}",
        "file": f"frontend/public/data/cornare/map/{spec['file']}",
        "level": 2,
        "kind": "official",
        "claim": (
            f"Contexto espacial de {spec['label']}. {count} geometrías de visualización "
            "después de recorte al corredor. No entra al puntaje de prioridad."
        ),
        "accessed": ACCESSED,
        "geometry_type": spec["kind"],
        "original_crs": "service native; requested outSR 4326",
        "output_crs": "EPSG:4326",
        "filter": f"intersects corridor envelope plus {BUFFER_DEGREES} degree buffer; simplify {spec['simplify']} degrees",
        "limitation": "Capa de contexto. No es una variable del modelo de decisión ni una ubicación de obra.",
    }


def runtime_sources() -> list[dict]:
    flood = (
        f"{BASE}/OAT_Y_GR/Cornare_Inundacion_22/MapServer/export"
        "?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256"
        "&format=png32&transparent=true&f=image&layers=show:0"
    )
    return [
        {
            "id": "gis-flood-runtime",
            "title": "Riesgo de inundación (ráster de consulta)",
            "institution": "CORNARE",
            "year": 2026,
            "url": f"{BASE}/OAT_Y_GR/Cornare_Inundacion_22/MapServer/0",
            "file": None,
            "level": 2,
            "kind": "official",
            "claim": "Capa ráster opcional. El MapServer no publica vectores. Si el servicio no responde, el mapa la apaga.",
            "accessed": ACCESSED,
            "geometry_type": "raster",
            "original_crs": "service native",
            "output_crs": "EPSG:3857 tiles",
            "filter": "runtime export only; not cached",
            "limitation": "No es el índice de vulnerabilidad climática del reto y no se descarga como polígonos.",
            "tiles": [flood],
        },
        {
            "id": "gis-openfreemap",
            "title": "OpenFreeMap Dark, esquema OpenMapTiles",
            "institution": "OpenFreeMap / OpenStreetMap",
            "year": 2026,
            "url": "https://tiles.openfreemap.org/styles/dark",
            "file": None,
            "level": 3,
            "kind": "open-data",
            "claim": "Mapa base vectorial sin llave: vías, agua, etiquetas y edificios. La extrusión usa render_height del esquema OpenMapTiles.",
            "accessed": ACCESSED,
            "geometry_type": "vector tiles",
            "original_crs": "EPSG:3857",
            "output_crs": "EPSG:3857",
            "filter": "runtime style; not copied into the repository",
            "limitation": "Contexto cartográfico. Una altura ausente no se reemplaza con un número de pisos inventado.",
        },
        {
            "id": "gis-aws-terrarium",
            "title": "Terrain Tiles, codificación Terrarium",
            "institution": "AWS Open Data / Mapzen",
            "year": 2026,
            "url": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
            "file": None,
            "level": 3,
            "kind": "open-data",
            "claim": "Elevación de terreno desnudo, teselas XYZ 0–15, sin llave. Exageración por defecto 1.0.",
            "accessed": ACCESSED,
            "geometry_type": "raster-dem",
            "original_crs": "EPSG:3857",
            "output_crs": "EPSG:3857",
            "filter": "runtime tiles",
            "limitation": (
                "No es el MDT de CORNARE. Bg_Cornare_Mdt_22 devuelve un valor de píxel por consulta identify, "
                "pero no un ráster numérico descargable, y no hay MDT municipal de Guarne."
            ),
            "attribution": "Terrain Tiles via AWS Open Data. Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        },
        {
            "id": "gis-cornare-dtm-not-used",
            "title": "MDT CORNARE 2022, no usado como terreno",
            "institution": "CORNARE",
            "year": 2022,
            "url": f"{BASE}/BASE_CARTOGRAFIA/Bg_Cornare_Mdt_22/MapServer",
            "file": None,
            "level": 2,
            "kind": "official",
            "claim": (
                "El servicio expone Mdt_Marinilla, Mdt_Rionegro, DTM_Cornare_.img y HILL_DTM_30M_L como Raster Layer. "
                "Una prueba identify en Rionegro devolvió Pixel Value cercano a 2079–2085. "
                "No hay ImageServer ni descarga GeoTIFF. El relieve coloreado no se usa como elevación."
            ),
            "accessed": ACCESSED,
            "geometry_type": "rendered raster",
            "original_crs": "service native",
            "output_crs": None,
            "filter": "investigated; not ingested",
            "limitation": "No cubre un DEM reproducible del corredor completo, incluido Guarne.",
        },
    ]


def merge_registry(sources: list[dict]) -> None:
    registry_path = ROOT / "frontend" / "public" / "data" / "cornare" / "source_registry.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    incoming = {source["id"] for source in sources}
    registry["sources"] = [source for source in registry["sources"] if source["id"] not in incoming]
    registry["sources"].extend(sources)
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    docs = ROOT / "docs" / "climaterisk" / "source_registry.md"
    text = docs.read_text(encoding="utf-8") if docs.exists() else "# Registro de fuentes\n"
    marker = "\n## Contexto espacial\n"
    if marker in text:
        text = text.split(marker)[0].rstrip() + "\n"
    lines = [text.rstrip(), "", "## Contexto espacial", ""]
    for source in sources:
        lines.extend([
            f"## {source['title']}",
            "",
            f"- Institución: {source['institution']}",
            f"- Año: {source['year']}",
            f"- Nivel: {source['level']}",
            f"- Tipo: {source['kind']}",
            f"- URL o archivo: {source['url'] or source['file']}",
            f"- Geometría: {source.get('geometry_type')}",
            f"- CRS de salida: {source.get('output_crs')}",
            f"- Filtro: {source.get('filter')}",
            f"- Respalda: {source['claim']}",
            f"- Límite: {source.get('limitation')}",
            "",
        ])
    docs.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    municipalities = json.loads(MUNICIPALITIES.read_text(encoding="utf-8"))
    corridor = unary_union([shape(feature["geometry"]) for feature in municipalities["features"]])
    mask = corridor.buffer(BUFFER_DEGREES)
    bounds = mask.bounds
    OUT.mkdir(parents=True, exist_ok=True)
    catalog_layers = []
    sources = []
    for spec in VECTOR_LAYERS:
        print("fetch", spec["id"])
        raw = fetch_features(spec, bounds)
        records = to_records(raw, spec, mask)
        if spec["dissolve"]:
            records = dissolve(records, spec["dissolve"])
        collection = feature_collection(records)
        write_json(OUT / spec["file"], collection)
        catalog_layers.append({
            "id": spec["id"],
            "file": spec["file"],
            "group": spec["group"],
            "label": spec["label"],
            "kind": spec["kind"],
            "defaultVisible": spec["default_visible"],
            "featureCount": len(collection["features"]),
            "provenance": "institutional",
            "sourceLabel": "CORNARE",
            "sourceId": f"gis-{spec['id']}",
        })
        sources.append(source_record(spec, len(collection["features"])))
        print(f"  wrote {spec['file']} ({len(collection['features'])})")
    runtime = runtime_sources()
    catalog = {
        "schema": "ourea.cornare.map_catalog",
        "accessed": ACCESSED,
        "buffer_degrees": BUFFER_DEGREES,
        "layers": catalog_layers,
        "runtime": [
            {
                "id": "flood",
                "group": "risk",
                "label": "Inundación",
                "kind": "raster",
                "defaultVisible": False,
                "tiles": runtime[0]["tiles"],
                "attribution": "CORNARE · OAT_Y_GR/Cornare_Inundacion_22",
                "provenance": "institutional",
                "sourceLabel": "CORNARE",
                "sourceId": "gis-flood-runtime",
                "limitation": runtime[0]["limitation"],
            }
        ],
        "basemap": {
            "style": "https://tiles.openfreemap.org/styles/dark",
            "fallbackStyle": "https://tiles.openfreemap.org/styles/liberty",
            "sourceId": "gis-openfreemap",
        },
        "terrain": {
            "tiles": ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
            "encoding": "terrarium",
            "tileSize": 256,
            "minzoom": 0,
            "maxzoom": 15,
            "exaggeration": 1,
            "maxExaggeration": 1.3,
            "attribution": runtime[2]["attribution"],
            "sourceId": "gis-aws-terrarium",
        },
    }
    write_json(OUT / "catalog.json", catalog)
    provenance = {"schema": "ourea.cornare.map_provenance", "accessed": ACCESSED, "sources": sources + runtime}
    write_json(OUT / "provenance.json", provenance)
    merge_registry(sources + runtime)
    print("spatial context written")


if __name__ == "__main__":
    main()

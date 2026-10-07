"""Download public CORNARE Observatorio files and record the MapGIS session gate.

The climate page is WordPress. The indicator dashboards are a HYG/MapGIS
application. This script caches the public workbook already identified and
tries the public session endpoints without inventing municipal series.
"""

from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "public" / "observatorio"
OUT.mkdir(parents=True, exist_ok=True)

FICHA = (
    "https://observatorioambiental.cornare.gov.co/wp-content/uploads/2026/04/"
    "Copia-de-M-E-2897_Fichas_Adaptacion_Municipales.xlsx"
)
ENDPOINTS = [
    {
        "name": "climate_page",
        "method": "GET",
        "url": "https://observatorioambiental.cornare.gov.co/crecimiento-verde-y-cambio-climatico/cambio-climatico/",
        "note": "WordPress page. Selectors are not a JSON collection.",
    },
    {
        "name": "riesgo_integrado",
        "method": "GET",
        "url": "https://observatorioambiental.cornare.gov.co/indicadores/verTablero.hyg?app=1&id=84",
    },
    {
        "name": "vulnerabilidad_integrado",
        "method": "GET",
        "url": "https://observatorioambiental.cornare.gov.co/indicadores/verTablero.hyg?app=1&id=88",
    },
    {
        "name": "amenaza_integrado",
        "method": "GET",
        "url": "https://observatorioambiental.cornare.gov.co/indicadores/verTablero.hyg?app=1&id=79",
    },
    {
        "name": "mapgis_session",
        "method": "POST",
        "url": "https://observatorioambiental.cornare.gov.co/mapgis9/inicioAjax.do",
        "body": "app=0&appPublic=1",
        "note": "Session gate used by tablero.js before consultarParametrosCliente.hyg and cargardatos.hyg.",
    },
]


def fetch(url: str, data: bytes | None = None) -> tuple[int, bytes]:
    request = Request(url, data=data, headers={"User-Agent": "Ourea/1.0"})
    with urlopen(request, timeout=60) as response:
        return response.status, response.read()


def main() -> None:
    ficha_path = ROOT / "data" / "public" / "fichas_adaptacion_municipales.xlsx"
    if not ficha_path.exists():
        status, payload = fetch(FICHA)
        ficha_path.write_bytes(payload)
        print("ficha", status, len(payload))
    else:
        print("ficha cached", ficha_path.stat().st_size)

    results = []
    for item in ENDPOINTS:
        record = dict(item)
        try:
            body = item.get("body", "").encode() if item["method"] == "POST" else None
            status, payload = fetch(item["url"], body)
            record["status"] = status
            record["bytes"] = len(payload)
            sample = payload[:400].decode("utf-8", "replace")
            record["sample"] = sample.replace("\n", " ")[:240]
        except Exception as error:  # noqa: BLE001 - record the public failure
            record["error"] = type(error).__name__ + ": " + str(error)[:240]
        results.append(record)
        print(record["name"], record.get("status") or record.get("error"))

    (OUT / "endpoints.json").write_text(
        json.dumps({"accessed": "2026-10-07", "endpoints": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

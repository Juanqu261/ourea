"""Download the 2024-2027 municipal environmental references and keep verified excerpts.

Numbers enter the output only when the PDF text contains them. They do not
change the portfolio score.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "public" / "referentes"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "guarne": "https://www.cornare.gov.co/SIAR/REFERENTES_AMBIENTALES/2024-2027/RA_Guarne.pdf",
    "marinilla": "https://www.cornare.gov.co/SIAR/REFERENTES_AMBIENTALES/2024-2027/RA_Marinilla.pdf",
    "rionegro": "https://www.cornare.gov.co/SIAR/REFERENTES_AMBIENTALES/2024-2027/RA_Rionegro.pdf",
}

BRIEFS = {
    "guarne": "769 concesiones vigentes y 1,76 m³/s concesionados. Acueducto urbano: La Charanga, La Brizuela y El Salado.",
    "marinilla": "Acueducto urbano: Barbacoas y La Bolsa, 144,9 l/s. Bocatomas con calidad excelente en el referente 2024–2027.",
    "rionegro": "Acueducto urbano: Río Negro, Abreo Mal Paso y La Pereira, 982,15 l/s concesionados.",
}

NEEDLES = {
    "guarne": ["769", "Charanga", "Brizuela", "Salado", "IRCA", "concesi"],
    "marinilla": ["Bolsa", "Barbacoas", "Marinilla", "IRCA", "ronda"],
    "rionegro": ["982", "Pereira", "Abreo", "Mal Paso", "Río Negro", "Rio Negro", "IRCA"],
}


def download(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 10000:
        return
    request = Request(url, headers={"User-Agent": "Ourea/1.0"})
    with urlopen(request, timeout=120) as response:
        path.write_bytes(response.read())


def pages(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    return [(page.extract_text() or "") for page in reader.pages]


def windows(text: str, needle: str) -> list[str]:
    found = []
    for match in re.finditer(re.escape(needle), text, flags=re.IGNORECASE):
        start = max(0, match.start() - 90)
        end = min(len(text), match.end() + 140)
        snippet = " ".join(text[start:end].split())
        if snippet not in found:
            found.append(snippet)
        if len(found) == 2:
            break
    return found


def main() -> None:
    records = []
    for municipality, url in SOURCES.items():
        path = OUT_DIR / f"RA_{municipality}.pdf"
        download(url, path)
        text_pages = pages(path)
        joined = "\n".join(text_pages)
        hits = []
        for needle in NEEDLES[municipality]:
            snippets = windows(joined, needle)
            hits.append({
                "needle": needle,
                "found": bool(snippets),
                "excerpts": snippets,
            })
        records.append({
            "municipality_id": municipality,
            "url": url,
            "bytes": path.stat().st_size,
            "pages": len(text_pages),
            "score_effect": "none",
            "use": "explainability",
            "brief": BRIEFS[municipality],
            "hits": hits,
        })
        print(municipality, path.stat().st_size, "pages", len(text_pages))
    target = ROOT / "frontend" / "public" / "data" / "cornare" / "municipal_context.json"
    target.write_text(json.dumps({
        "accessed": "2026-10-07",
        "source": "CORNARE referentes ambientales 2024-2027",
        "limitation": "Contexto de capacidad existente. No entra al optimizador.",
        "municipalities": records,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", target)


if __name__ == "__main__":
    main()

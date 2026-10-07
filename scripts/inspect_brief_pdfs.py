"""Inspect fixture decision-brief PDFs.

Always checks page count, metadata and forbidden copy from the PDF bytes.
When pdfinfo/pdftotext/pdftoppm/qpdf are on PATH, also renders every page.
"""
from __future__ import annotations

import html
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "pdf-audit"
FRONTEND = ROOT / "frontend"

FIXTURES = (
    "guided-rwh-drainage.pdf",
    "guided-with-ai.pdf",
    "restoration.pdf",
    "six-interventions.pdf",
    "many-references.pdf",
    "incomplete-cost.pdf",
    "mobile-originated.pdf",
)


def generate() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["node", "scripts/renderBriefFixtures.mjs", str(CACHE)],
        cwd=FRONTEND,
        check=True,
    )


def pdf_bytes(path: Path) -> bytes:
    return path.read_bytes()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def inspect_bytes(name: str, data: bytes) -> int:
    text = data.decode("latin-1", errors="ignore")
    require(text.startswith("%PDF-1."), f"{name} is not a PDF")
    count = re.search(r"/Count (\d+)", text)
    require(count is not None, f"{name} missing page count")
    pages = int(count.group(1))
    require(6 <= pages <= 8, f"{name} has {pages} pages, expected 6-8")
    require("/Author (Ourea)" in text, f"{name} missing Author")
    require("/Lang (en-US)" in text, f"{name} missing language")
    require("/Title" in text, f"{name} missing title")
    title = re.search(r"/Title \((?:\\.|[^\\)])*\)", text)
    require(title is not None and "Š" not in title.group(0), f"{name} has a corrupt title")
    require(f"Page {pages} of {pages}" in text, f"{name} missing last page label")
    require("Page 9 of" not in text, f"{name} has a trailing page")
    for banned in ("houses fall", "houses lean", "planning credit", "collapse in year", "collapse expected", "failure year", "clickable annotations"):
        require(banned.lower() not in text.lower(), f"{name} contains banned copy: {banned}")
    require("US$" in text or r"US\$" in text, f"{name} missing US$")
    require("ybedoyab.github.io/ourea" in text, f"{name} missing public Pages URL")
    require("/S /URI" in text, f"{name} missing URI annotations")
    require("fx_banrep_trm" not in text, f"{name} leaked an internal source id")
    sizes = [float(item) for item in re.findall(r"(\d+(?:\.\d+)?) Tf", text)]
    require(sizes, f"{name} missing fonts")
    require(min(sizes) >= 9, f"{name} font {min(sizes)} is below 9pt")
    for match in re.finditer(r"/Rect \[([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)\]", text):
        llx, lly, urx, ury = map(float, match.groups())
        require(llx >= -0.05 and lly >= -0.05, f"{name} annotation underflow {match.group(0)}")
        require(urx <= 595.33 and ury <= 841.94, f"{name} annotation outside MediaBox {match.group(0)}")
    return pages


def tool_stderr(text: str) -> str:
    return "\n".join(
        line for line in (text or "").splitlines()
        if "No display font for" not in line
    )


def run_checked(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    err = tool_stderr(result.stderr)
    require(result.returncode == 0, f"{' '.join(command)} failed:\n{err}\n{result.stdout}")
    require("Syntax Error" not in err, f"Poppler/qpdf syntax error:\n{err}")
    require("Error:" not in err, f"tool error:\n{err}")
    return result


def poppler(path: Path, pages: int) -> None:
    pdfinfo = shutil.which("pdfinfo")
    pdftotext = shutil.which("pdftotext")
    pdftoppm = shutil.which("pdftoppm")
    qpdf = shutil.which("qpdf")
    if not pdfinfo or not pdftotext or not pdftoppm:
        print(f"[info] poppler not on PATH; byte-level checks already passed for {path.name}")
        return
    info = run_checked(["pdfinfo", str(path)])
    require(f"Pages:" in info.stdout, f"pdfinfo missing pages:\n{info.stdout}")
    require(re.search(rf"Pages:\s*{pages}\b", info.stdout) is not None, f"pdfinfo pages:\n{info.stdout}")
    require("Ourea" in info.stdout, f"pdfinfo missing author/title:\n{info.stdout}")
    if qpdf:
        run_checked([qpdf, "--check", str(path)])
    text = run_checked(["pdftotext", "-layout", str(path), "-"]).stdout
    require("Decision requested" in text, f"{path.name} text missing decision")
    require("Why early action matters" in text, f"{path.name} missing mechanism title")
    require("Immediate" in text, f"{path.name} missing immediate ask")
    if "unknown" not in path.name:
        require("US$" in text, f"{path.name} missing US$ in extracted text")
    if "many-references" in path.name:
        require("date not stated" in text, f"{path.name} missing undated source")
    out_dir = path.parent / path.stem
    out_dir.mkdir(exist_ok=True)
    run_checked(["pdftoppm", "-png", str(path), str(out_dir / "page")])
    images = sorted(out_dir.glob("page*.png"))
    require(len(images) == pages, f"{path.name} rendered {len(images)} PNGs, expected {pages}")
    for image in images:
        require(image.stat().st_size > 8000, f"{image.name} looks empty ({image.stat().st_size} bytes)")
    sheet = path.parent / f"{path.stem}-contact-sheet.html"
    cards = "\n".join(
        f'<figure><img src="{html.escape(image.name if False else str(image.relative_to(path.parent)).replace(chr(92), "/"))}" alt="{html.escape(image.name)}"><figcaption>{html.escape(image.name)}</figcaption></figure>'
        for image in images
    )
    sheet.write_text(
        "<!doctype html><meta charset='utf-8'><title>Contact sheet</title>"
        "<style>body{font-family:sans-serif;background:#111;color:#eee;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:16px}"
        "img{width:100%;height:auto;background:#fff}figcaption{font-size:12px}</style>"
        f"{cards}",
        encoding="utf-8",
    )
    print(f"[OK] poppler rendered {path.name}")


def main() -> int:
    generate()
    for name in FIXTURES:
        path = CACHE / name
        data = pdf_bytes(path)
        pages = inspect_bytes(name, data)
        poppler(path, pages)
        print(f"[OK] {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

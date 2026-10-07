"""Audit every CLIMATERISK workbook and write docs/climaterisk/data_audit.md."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "CLIMATERISK"
DOCS = ROOT / "docs" / "climaterisk"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def excel_report(path: Path) -> list[str]:
    book = pd.ExcelFile(path)
    lines = [f"### {path.name}", "", f"- Bytes: {path.stat().st_size}", f"- SHA-256: `{sha256(path)}`", ""]
    for sheet in book.sheet_names:
        frame = pd.read_excel(path, sheet_name=sheet)
        lines.append(f"#### Hoja `{sheet}`")
        lines.append("")
        lines.append(f"- Filas: {len(frame)}")
        lines.append(f"- Columnas: {', '.join(str(column) for column in frame.columns)}")
        nulls = frame.isna().sum()
        null_bits = [f"{column}={int(count)}" for column, count in nulls.items() if int(count)]
        lines.append(f"- Nulos: {', '.join(null_bits) if null_bits else 'ninguno'}")
        lines.append("")
    return lines


def write_audit() -> Path:
    files = sorted(path for path in SOURCE_DIR.iterdir() if path.is_file() and path.suffix.lower() != ".zip")
    hashes = {}
    lines = [
        "# Auditoría de fuentes CLIMATERISK",
        "",
        "Fecha de lectura: 2026-10-07. Los archivos crudos no se modifican.",
        "Herramientas: pandas, openpyxl y PyMuPDF. No se usó OCR: el texto del reto y de las diapositivas con texto estaba en el archivo.",
        "",
        "## Alcance de la decisión",
        "",
        "El único corredor de decisión es Rionegro, Guarne y Marinilla, en Valles de San Nicolás, jurisdicción de CORNARE, Antioquia.",
        "Mitigación y reducción de emisiones no miden desempeño de adaptación. No entran al puntaje.",
        "",
        "## Archivos",
        "",
    ]
    for path in files:
        digest = sha256(path)
        hashes.setdefault(digest, []).append(path.name)
        lines.append(f"- `{path.name}` — {path.stat().st_size} bytes — `{digest[:16]}`")
    lines.extend(["", "## Duplicados", ""])
    duplicate_found = False
    for digest, names in hashes.items():
        if len(names) > 1:
            duplicate_found = True
            lines.append(f"- Mismo SHA-256 `{digest[:16]}`: {', '.join(names)}")
    zip_path = next(SOURCE_DIR.glob("*.zip"), None)
    if zip_path:
        lines.append(
            f"- `{zip_path.name}` ({zip_path.stat().st_size} bytes) repite el paquete descomprimido y supera el límite de archivo de GitHub. No se versiona."
        )
        duplicate_found = True
    if not duplicate_found:
        lines.append("- No se detectaron duplicados byte a byte entre los archivos sueltos.")
    lines.extend(
        [
            "",
            "Los dos PDF del reto tienen distinto hash, pero PyMuPDF extrajo el mismo texto en las ocho páginas. Se trata como un duplicado de contenido.",
            "La carpeta `__MACOSX` solo contiene metadatos de macOS. Se ignora.",
            "",
            "## Relevancia",
            "",
            "- Directa: el PDF del reto, la presentación y el reporte de medidas de adaptación municipales.",
            "- Indirecta: mitigación regional, emisiones por alcance, reducción de emisiones e indicadores por unidad de producción. Sirven para contexto productivo y para no confundir MRV de carbono con adaptación.",
            "- Acciones de adaptación por sector: no tienen municipio. No se usan para localizar medidas ni para calificar recurrencia del corredor.",
            "",
            "## Hallazgos del reto que sí se codifican",
            "",
            "Tomados del PDF del reto, no de una estimación nueva:",
            "",
            "- Fondo simulado: COP 5.000 millones. Costos indivisibles. No es obligatorio gastar todo.",
            "- Catálogo de 15 medidas. La suma de referencia es 18.900 millones.",
            "- Vulnerabilidad en biodiversidad: Rionegro 0,75 Muy alta; Marinilla 0,72 Muy alta.",
            "- Promedios regionales: biodiversidad 0,55; recurso hídrico 0,53. No son valores municipales.",
            "- Capacidad adaptativa en biodiversidad: Rionegro 0,22; Marinilla 0,24; Guarne 0,33 Baja.",
            "- Capacidad adaptativa en gestión del riesgo: Rionegro 0,56; Marinilla 0,61.",
            "- Amenaza de desastres en Marinilla: 0,66–0,73 Alta. Es amenaza, no vulnerabilidad.",
            "- Sensibilidad de desastres en Rionegro: 0,40. Sin clase publicada.",
            "- Riesgo de desastres en Rionegro: 0,28 Bajo hacia 0,32 Medio en 2060.",
            "",
            "La diapositiva 12 trae clases para 26 municipios y siete dimensiones. En el corredor:",
            "",
            "- Rionegro: desastres Alta, hábitat Muy baja, agua Media, infraestructura Media, salud Muy baja, biodiversidad Muy alta, seguridad alimentaria Baja.",
            "- Guarne: Alta, Baja, Media, Alta, Baja, Media, Baja.",
            "- Marinilla: Muy baja, Baja, Alta, Muy baja, Baja, Muy alta, Muy baja.",
            "",
            "Esas celdas se guardan como clase de vulnerabilidad. La columna se llama Riesgo de desastres porque así se llama la dimensión. No coincide con el riesgo Bajo/Medio de Rionegro, así que no se lee como la métrica de riesgo.",
            "No hay un cubo numérico municipio × dimensión × escenario en los libros. Lo que falta queda nulo.",
            "",
            "Pesos de priorización en la presentación: vulnerabilidad 70%, recurrencia de acciones 15%, recurrencia en talleres 15%. Los talleres no traen conteos.",
            "",
            "## Libros Excel",
            "",
        ]
    )
    for path in files:
        if path.suffix.lower() == ".xlsx":
            lines.extend(excel_report(path))
    lines.extend(
        [
            "## Lectura del reporte de adaptación",
            "",
            "La columna `Vulnerabilidad` contiene etiquetas de amenaza (inundaciones, movimiento en masa, incendios) o `No Aplica`. No es el índice de vulnerabilidad climática.",
            "El Carmen de Viboral concentra muchos más registros que Marinilla. Esa asimetría es cobertura del dataset, no capacidad adaptativa.",
            "Hay inversiones nulas y algunas en cero. Un cero contable no se convierte en capacidad adaptativa cero.",
            "Guarne tiene una línea de infraestructura de movilidad en 2022 de gran magnitud. No se homologa a la medida del reto «infraestructura resiliente al cambio climático».",
            "Aparece el ecosistema `prueba2` en el libro completo. Es un problema de calidad y no está en el corredor de decisión.",
            "",
            "## Mitigación y emisiones",
            "",
            "Los libros de mitigación están por subregión, incluida Valles. Los de emisiones, reducción e indicadores están por sector productivo (aguacate, construcción, flores, industrias), sin municipio.",
            "Hay indicadores de aprovechamiento con valores negativos. No se corrigen ni se usan.",
            "Varias medidas de adaptación también aparecen en el libro de mitigación porque algunas acciones tienen cobeneficio de carbono. Esa tonelada de CO2e no es un puntaje de vulnerabilidad.",
            "",
            "## Límites",
            "",
            "- Varias diapositivas de la presentación son imagen y no aportaron tablas adicionales en el texto extraído.",
            "- No se publicó la ficha numérica completa por municipio y dimensión.",
            "- Los costos del catálogo son supuestos homogéneos del ejercicio, no disponibilidades presupuestales de CORNARE.",
            "- La meta regional de reducir 30% la vulnerabilidad a 2035 es un objetivo de plan, no una efectividad por medida.",
            "",
        ]
    )
    DOCS.mkdir(parents=True, exist_ok=True)
    target = DOCS / "data_audit.md"
    target.write_text("\n".join(lines), encoding="utf-8")
    return target


if __name__ == "__main__":
    print(write_audit())

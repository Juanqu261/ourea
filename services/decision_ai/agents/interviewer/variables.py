"""Minimum aggregate variables per dependency gap (§5.2). No LLM."""

from __future__ import annotations

import re
import unicodedata

VARIABLES = {
    "water_intake": "Fuente, captación o acueducto del que depende la operación",
    "critical_road": "Vía o punto crítico de acceso del que depende la operación",
    "circuit": "Circuito o red de energía del que depende la operación",
    "supplier_municipality": "Municipio de los proveedores críticos",
    "worker_municipality_pct": "Porcentaje de personas trabajadoras que viven en el corredor",
}

GAP_VARIABLES = {
    "gap-company-water": ["water_intake"],
    "gap-company-road": ["critical_road"],
    "gap-suppliers": ["supplier_municipality"],
    "gap-energy": ["circuit"],
    "gap-workers": ["worker_municipality_pct"],
}

AGGREGATE = "solo datos agregados"

IDENTIFIABLE = re.compile(r"\bS\.?\s?A\.?\s?S\b\.?|\bS\.\s?A\.|\bLtda\b\.?|\bNIT\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d\b", re.IGNORECASE)
COMPANY_WORDS = re.compile(r"\b(empresa|compañ[ií]a|sociedad|floricultora|flores)\s+[A-ZÁÉÍÓÚÑ][\w]+", re.UNICODE)


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", folded.lower()).strip()


def grounded(value: str | None, raw_answer: str) -> bool:
    """A parsed value counts only if it is literally in the answer (accents and case aside)."""
    if value is None or not str(value).strip():
        return False
    return normalize(str(value)) in normalize(raw_answer)


def identifiable(text: str) -> bool:
    return bool(IDENTIFIABLE.search(text or ""))


def question_ok(question: str) -> bool:
    """A question carries no number and no company name."""
    return not re.search(r"\d", question or "") and not identifiable(question) and not COMPANY_WORDS.search(question or "")


def template_question(gap: dict) -> str:
    wanted = "; ".join(VARIABLES[name].lower() for name in GAP_VARIABLES.get(gap["id"], []))
    return f"Sobre «{gap['missing_information'].lower()}»: ¿nos puede indicar {wanted}? Responda con {AGGREGATE}; no nombre empresas ni personas."

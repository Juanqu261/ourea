"""Deterministic Spanish answers for forbidden asks, write requests and location asks. No LLM."""

from __future__ import annotations

import re

from ...audit import forbidden

EFFECTIVENESS = (
    "Ourea no calcula ese número. El puntaje es de prioridad: ordena qué financiar primero con el presupuesto del reto. "
    "Medir cuánto baja la vulnerabilidad o cuánto se evita en pérdidas exige datos de efectividad por medida que el paquete no trae. "
    "Esa es la brecha gap-effectiveness."
)

TEMPLATES = {
    "vulnerability_reduction": EFFECTIVENESS,
    "avoided_losses": EFFECTIVENESS,
    "probability": (
        "Ourea no asigna esa cifra. La robustez se dice como «casi óptimo en X% de los mundos probados»: "
        "es la fracción de combinaciones de supuestos que construyó el equipo, no una frecuencia esperada. "
        "Si quiere, pregunte qué tan robusto es el portafolio y consulto el motor."
    ),
}

WRITE = (
    "El copiloto solo lee la decisión. No cambia pesos, datos, clases ni presupuesto. "
    "Puedo mostrar qué pasaría bajo otro supuesto si lo pregunta como «¿qué pasa si…?», y lo rotulo como supuesto. "
    "Un cambio real del modelo lo hace el equipo, con revisión y una nueva huella."
)

LOCATION = (
    "La ubicación exacta está Por definir. Las capas del mapa son contexto y no son el sitio de obra. "
    "Definir el predio es la brecha gap-sites."
)

ALIASES = {
    "bio_psa": r"\bpsa\b|pago por servicios",
    "bio_restore": r"restauraci[oó]n",
    "bio_pa": r"[aá]reas? protegidas?",
    "water_eff": r"eficien\w+ (del )?(recurso h[ií]drico|agua)|uso (intersectorial )?eficiente",
    "water_riparian": r"rondas?",
    "water_head": r"cabeceras?|ecosistemas abastecedores",
    "food_soil": r"suelos?",
    "food_agro": r"agroecol\w*",
    "hab_green": r"espacios? verdes?|zonas? verdes?",
    "hab_suds": r"\bsuds\b|drenaje",
    "infra_resilient": r"infraestructura (gris|resiliente)|\bv[ií]as?\b",
    "infra_services": r"servicios p[uú]blicos|energ[ií]a",
    "risk_sat": r"\bsat\b|alertas? tempranas?",
    "risk_knowledge": r"conocimiento (y comunicaci[oó]n )?(del|sobre) (el )?riesgo",
    "health": r"\bsalud\b",
}


def measure_in(text: str) -> str | None:
    lowered = (text or "").lower()
    for measure_id in ALIASES:
        if measure_id in lowered:
            return measure_id
    for measure_id, pattern in ALIASES.items():
        if re.search(pattern, lowered):
            return measure_id
    return None


def answer(respuesta: str, etiquetas: list[str], brechas: list[str] | None = None, focus: str | None = None) -> dict:
    return {
        "respuesta": respuesta,
        "cifras": [],
        "etiquetas": etiquetas,
        "brechas_relacionadas": brechas or [],
        "fuentes": [],
        "enfoque_mapa": {"intervention_id": focus} if focus else None,
    }


def classify(question: str) -> tuple[str, dict | None]:
    """('ask', spec) · ('write', None) · ('location', None) · ('agent', None)."""
    spec = forbidden.ask(question)
    if spec:
        return "ask", spec
    if forbidden.is_write(question):
        return "write", None
    if forbidden.is_location(question):
        return "location", None
    return "agent", None


def refuse(spec: dict) -> dict:
    gap = spec.get("gap")
    return answer(TEMPLATES[spec["id"]], ["Información faltante"], [gap] if gap else [])


def refuse_write() -> dict:
    return answer(WRITE, ["Supuesto"])


def locate(measure_id: str | None, layers: list[dict]) -> dict:
    text = LOCATION
    if layers:
        names = ", ".join(layer["label"] for layer in layers)
        text += f" Para mirar la medida, el mapa enciende estas capas de contexto: {names}."
    return answer(text, ["Información faltante", "Dato institucional"] if layers else ["Información faltante"], ["gap-sites"], measure_id)

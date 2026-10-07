"""The copilot's structured answer (§5.1). Pydantic only."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Cifra(BaseModel):
    valor: float = Field(description="El número tal como aparece en la salida de la herramienta, sin redondear.")
    texto: str = Field(description="Cómo aparece en la respuesta, en formato es-CO (p. ej. '2,81', '5.000', '15%').")
    unidad: str = Field("", description="'puntos', 'millones COP', '%', 'mundos', 'veces' o ''.")
    herramienta: str = Field(description="Nombre de la herramienta que devolvió el número.")
    huella: str = Field(description="El campo fingerprint de esa salida.")


class EnfoqueMapa(BaseModel):
    intervention_id: str


class CopilotAnswer(BaseModel):
    respuesta: str = Field(description="Respuesta en español, máximo 120 palabras. Cada número debe estar en cifras.")
    cifras: list[Cifra] = Field(default_factory=list)
    etiquetas: list[str] = Field(default_factory=list, description="Etiquetas de evidencia de lo afirmado.")
    brechas_relacionadas: list[str] = Field(default_factory=list, description="ids de information_gaps.json")
    fuentes: list[str] = Field(default_factory=list, description="source_id de source_registry.json")
    enfoque_mapa: EnfoqueMapa | None = None

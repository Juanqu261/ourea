"""Pydantic contracts for the tools (§4.10 + map) and the envelope (§3.4)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MeasureId = str


class Envelope(BaseModel):
    result: Any = None
    evidence_labels: dict[str, str] = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    fingerprint: str | None = None


class NoInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WorldOverrides(BaseModel):
    """World 0 with optional changes. Every field is a supuesto of the team."""

    model_config = ConfigDict(extra="forbid")
    scenario: Literal["reference", "ssp3_7_0"] | None = None
    w_vuln: float | None = None
    w_rec: float | None = None
    gamma: float | None = None
    dim_penalty: float | None = None
    cobenefit_w: float | None = None
    lever_mismatch: float | None = None
    dim_w: dict[str, float] | None = Field(None, description="Peso relativo por dimensión, p. ej. {'health': 0.5}.")
    eff: dict[MeasureId, float] | None = Field(None, description="Multiplicador de efectividad por medida.")

    def compact(self) -> dict | None:
        data = self.model_dump(exclude_none=True)
        return data or None


class SearchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    world: WorldOverrides | None = None
    force: list[MeasureId] = Field(default_factory=list, description="Medidas que deben entrar.")
    exclude: list[MeasureId] = Field(default_factory=list, description="Medidas que no pueden entrar.")
    budget: int | None = Field(None, description="Presupuesto en millones de COP. Por defecto 5.000.")


class MeasureInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intervention_id: MeasureId


class CompareInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    a: list[MeasureId]
    b: list[MeasureId]


class ConstraintInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    force: list[MeasureId] = Field(default_factory=list)
    exclude: list[MeasureId] = Field(default_factory=list)


class BreakingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    portfolio: list[MeasureId] | None = Field(None, description="Por defecto s*, el portafolio más robusto.")


INPUTS: dict[str, type[BaseModel]] = {
    "get_context": NoInput,
    "search_portfolios": SearchInput,
    "explain": MeasureInput,
    "compare_portfolios": CompareInput,
    "price_of_constraint": ConstraintInput,
    "run_robustness": NoInput,
    "breaking_points": BreakingInput,
    "value_of_information": NoInput,
    "switching_value": MeasureInput,
    "get_spatial_context": MeasureInput,
}

DESCRIPTIONS: dict[str, str] = {
    "get_context": "Contexto del corredor: municipios, dimensiones, clases de vulnerabilidad, las 15 medidas con costo y las brechas de información. No calcula portafolios.",
    "search_portfolios": "Mejor portafolio bajo el presupuesto en el Mundo 0 (puntaje institucional) o en un mundo con supuestos cambiados, con medidas forzadas o excluidas. Responde qué medidas entran y su puntaje de prioridad. No mide reducción de vulnerabilidad.",
    "explain": "Hechos de una medida: dónde se asigna, términos del puntaje en el Mundo 0, si entra al mejor portafolio y su valor de cambio. No da la ubicación exacta.",
    "compare_portfolios": "Compara dos portafolios: costo, puntaje del Mundo 0, arrepentimiento y en qué fracción de los mundos probados es casi óptimo. No es una probabilidad.",
    "price_of_constraint": "Precio de exigir o excluir medidas: puntaje sin y con la restricción, pérdida de puntaje (score_loss_pct), qué sale y qué entra. Úsala para '¿y si exigimos infraestructura gris?'.",
    "run_robustness": "Robustez en 4.000 mundos probados: s*, medidas núcleo, contingentes y raras, y en qué fracción de mundos es casi óptimo cada conjunto. No es una probabilidad.",
    "breaking_points": "Puntos de quiebre: bajo qué supuestos s* deja de ser casi óptima. Las cajas exploratorias van rotuladas como exploratorio.",
    "value_of_information": "Valor de la información: qué supuesto o brecha cambia más la decisión y el orden en que conviene cerrar las brechas de dependencia.",
    "switching_value": "Valor de cambio de una medida: cuánto tendría que cambiar su puntaje para entrar o salir del mejor portafolio.",
    "get_spatial_context": "Capas de contexto espacial relacionadas con una medida, con su limitación y fuente. La ubicación exacta siempre es 'Por definir'. Una capa no es el sitio de obra.",
}

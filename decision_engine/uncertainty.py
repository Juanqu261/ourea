"""World parameters: ranges, evidence labels and signposts. Published as uncertainty_ranges.json.

Every range here is a supuesto or exploratorio of the team, never a CORNARE number.
Exploratory parameters are never reported as findings, only in breaking points
and signposts, labeled as exploratory.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from .dataset import MUNICIPALITY_IDS, Dataset

SEED = 20261007
N_WORLDS = 4000                      # 2.000 per scenario
NEAR_THRESHOLDS = (0.01, 0.02, 0.05)
PRIMARY_NEAR = 0.05                  # supuesto: World 0 has 4 sets within 5%, 3 within 2%
FAILURE_REGRET = 0.10
FAILURE_REGRET_ALT = 0.05
CORE_SHARE = 0.80
RARE_SHARE = 0.20
SITE_CHANGE_SHARE = 0.20
PRIM_ALPHA = 0.05
PRIM_MIN_SUPPORT = 0.05
PRIM_MAX_RESTRICTED = 3
PRIM_MAX_BOXES = 3
EVPPI_BINS = 10
EVPPI_SHUFFLES = 5
DELAY_COST_SHARE = 0.01              # supuesto: waiting one cycle costs 1% of the mean best score
MULTIDIMENSIONAL_PENALTY = 0.15

EVIDENCE_LABELS = {
    "institutional": "Dato institucional",
    "team_inference": "Inferencia del equipo",
    "assumption": "Supuesto",
    "missing": "Información faltante",
    "exploratory": "Exploratorio",
}

MUNICIPALITY_NAMES = {"rionegro": "Rionegro", "guarne": "Guarne", "marinilla": "Marinilla"}
DIMENSION_NAMES = {
    "biodiversity": "biodiversidad",
    "water": "recurso hídrico",
    "disaster": "riesgo de desastres",
    "health": "salud",
    "infrastructure": "infraestructura",
    "habitat": "hábitat",
    "food": "seguridad alimentaria",
}


@dataclass(frozen=True)
class Parameter:
    name: str
    group: str
    sampling: str            # uniform | log_uniform | bernoulli | dirichlet | fixed_ssp | shift
    low: float | None
    high: float | None
    world0: float
    evidence: str            # key of EVIDENCE_LABELS
    phrase: str              # Spanish noun phrase for sentences
    gaps: list[str] = field(default_factory=list)
    watch: str = ""
    measure_id: str | None = None
    binary: bool = False

    def public(self) -> dict:
        payload = asdict(self)
        payload["evidence_label"] = EVIDENCE_LABELS[self.evidence]
        return payload


def parameters(dataset: Dataset) -> list[Parameter]:
    """The columns of the world matrix, in order."""
    model = dataset.parameters
    weights = model["weights"]
    params = [
        Parameter("scenario", "scenario", "bernoulli", 0, 1, 0, "institutional",
                  "el escenario SSP3-7.0 a 2060", ["gap-ssp-cube"],
                  "Publicación del cubo municipio × dimensión × escenario del Observatorio Ambiental.", binary=True),
        Parameter("w_vuln", "weights", "uniform", 0.55, 0.85, weights["vulnerability"], "assumption",
                  "el peso de la vulnerabilidad", ["gap-workshops"],
                  "Cómo reparte CORNARE el 70/15/15 cuando los talleres puedan calificarse."),
        Parameter("w_rec", "weights", "uniform", 0.05, 0.25, weights["recurrence"], "assumption",
                  "el peso de la recurrencia documentada", ["gap-workshops", "gap-marinilla-coverage"],
                  "Conteos de talleres y cobertura completa del reporte de Marinilla."),
        Parameter("gamma", "scale", "log_uniform", 0.5, 2.5, 1.0, "assumption",
                  "la curvatura de la escala de clases", [],
                  "Cómo se lee la distancia entre clases (Alta frente a Muy alta)."),
        Parameter("dim_penalty", "scale", "uniform", 0.10, 0.60, model["diminishing_second_measure"]["institucional"], "assumption",
                  "el valor de una segunda medida en la misma dimensión", [],
                  "Si CORNARE prefiere profundidad en una dimensión o cobertura de varias."),
        Parameter("cobenefit_w", "scale", "uniform", 0.0, 0.10, model["cobenefit_weight"], "assumption",
                  "el peso del cobeneficio", [],
                  "Evidencia de cobeneficios entre dimensiones en el seguimiento MEA."),
        Parameter("lever_mismatch", "lever", "uniform", 0.5, 1.0, 1.0, "assumption",
                  "el descuento por palanca equivocada (S frente a CA)", ["gap-ssp-cube"],
                  "Sensibilidad y capacidad adaptativa publicadas por celda municipio × dimensión."),
        Parameter("p_shift", "ssp", "uniform", 0.0, 0.5, 0.0, "exploratory",
                  "la frecuencia con que otras celdas suben de clase bajo SSP3-7.0", ["gap-ssp-cube"],
                  "El cubo de escenarios del Observatorio Ambiental."),
        Parameter("dim_emphasis", "dimension_weights", "bernoulli", 0, 1, 0, "assumption",
                  "el énfasis regional en biodiversidad y agua", [],
                  "Prioridad declarada de CORNARE entre dimensiones.", binary=True),
    ]
    for dimension_id in dataset.dimension_ids:
        params.append(Parameter(
            f"dim_w[{dimension_id}]", "dimension_weights", "dirichlet", None, None, 1.0, "assumption",
            f"el peso relativo de {DIMENSION_NAMES[dimension_id]}", [],
            "Prioridad declarada de CORNARE entre dimensiones.",
        ))
    outcomes = {}
    for indicator in dataset.mea.get("indicators", []):
        if indicator["indicator_type"] == "resultado":
            outcomes.setdefault(indicator["intervention_id"], []).append(indicator["id"])
    for measure in dataset.interventions:
        mea_ids = outcomes.get(measure["id"], [])
        params.append(Parameter(
            f"eff[{measure['id']}]", "effectiveness", "uniform", 0.5, 1.5, 1.0, "exploratory",
            f"la efectividad relativa de «{measure['name']}»", ["gap-effectiveness"],
            (f"Indicador MEA de resultado {', '.join(mea_ids)}: hoy sin línea base y con meta por definir."
             if mea_ids else "Indicador MEA de resultado para esta medida (no existe todavía)."),
            measure_id=measure["id"],
        ))
    ssp = model["ssp"]
    for municipality_id in MUNICIPALITY_IDS:
        for dimension_id in dataset.dimension_ids:
            fixed = municipality_id == ssp["municipality_id"] and dimension_id == ssp["dimension_id"]
            params.append(Parameter(
                f"ssp_shift[{municipality_id},{dimension_id}]", "ssp",
                "fixed_ssp" if fixed else "shift", 0, 1, 0,
                "team_inference" if fixed else "exploratory",
                f"{DIMENSION_NAMES[dimension_id]} en {MUNICIPALITY_NAMES[municipality_id]} sube una clase bajo SSP3-7.0",
                ["gap-ssp-cube"],
                "Único cambio de escenario cuantificado en el reto (riesgo 0,28 → 0,32)." if fixed
                else f"Clase SSP3-7.0 de {DIMENSION_NAMES[dimension_id]} en {MUNICIPALITY_NAMES[municipality_id]} en el cubo de escenarios.",
                binary=True,
            ))
    return params


def column_names(dataset: Dataset) -> list[str]:
    return [parameter.name for parameter in parameters(dataset)]


def ranges_payload(dataset: Dataset) -> dict:
    return {
        "schema": "ourea.cornare.uncertainty_ranges",
        "seed": SEED,
        "n_worlds": N_WORLDS,
        "sampling": "Hipercubo latino con semilla (numpy PCG64), 2.000 mundos por escenario.",
        "dirichlet_note": "Los 7 pesos de dimensión suman 7 (media 1). La mitad de los mundos usa la variante de énfasis regional: biodiversidad y agua reciben los dos pesos más altos.",
        "ssp_note": "En los mundos SSP3-7.0, riesgo de desastres en Rionegro sube una clase siempre. Cada una de las otras 20 celdas sube en una fracción p_shift de los mundos SSP (exploratorio).",
        "thresholds": {
            "near_best": list(NEAR_THRESHOLDS),
            "near_best_primary": PRIMARY_NEAR,
            "near_best_primary_evidence": "assumption",
            "failure_regret": FAILURE_REGRET,
            "failure_regret_alt": FAILURE_REGRET_ALT,
            "core_share": CORE_SHARE,
            "rare_share": RARE_SHARE,
            "site_change_share": SITE_CHANGE_SHARE,
            "delay_cost_share": DELAY_COST_SHARE,
            "delay_cost_evidence": "assumption",
        },
        "evidence_labels": EVIDENCE_LABELS,
        "parameters": [parameter.public() for parameter in parameters(dataset)],
        "lenses": {
            "institucional": "Mundo 0: los valores del modelo institucional.",
            "multidimensional": f"Mundo 0 con dim_penalty = {MULTIDIMENSIONAL_PENALTY}.",
            "naturaleza": "Regla de desempate, no un punto del espacio de mundos. Se compara con compare_portfolios.",
            "bajo_arrepentimiento": "Cambia el objetivo a puntaje/costo. No es un punto del espacio de mundos.",
        },
    }

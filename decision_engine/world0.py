"""Scalar engine: a line-by-line port of the JS World 0, generalized to any world.

At the World 0 parameter values this reproduces frontend/src/domain/ exactly
(ids, cost, score and fingerprint). The vectorized engine in world_score.py must
equal this module in every world; tests/test_engine_world.py checks both.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace

from .dataset import (
    CLASS_ORDER,
    MUNICIPALITY_IDS,
    Dataset,
    adaptive_capacity_value,
    class_index,
    vulnerability_class,
)
from .fingerprint import decision_fingerprint
from .levers import cell_profiles, lever_mismatch
from .portfolios import space_for


@dataclass(frozen=True)
class World:
    """One point in world space. Defaults are filled from decision_model.json by world0()."""

    scenario: str
    w_vuln: float
    w_rec: float
    dim_w: tuple[float, ...]          # dataset.dimension_ids order
    gamma: float
    dim_penalty: float
    cobenefit_w: float
    lever_mismatch: float
    eff: tuple[float, ...]            # dataset.measure_ids order
    ssp_shift: frozenset = field(default_factory=frozenset)  # {(municipality_id, dimension_id)} raised one class
    p_shift: float = 0.0


def world0(dataset: Dataset) -> World:
    parameters = dataset.parameters
    return World(
        scenario="reference",
        w_vuln=parameters["weights"]["vulnerability"],
        w_rec=parameters["weights"]["recurrence"],
        dim_w=tuple(1.0 for _ in dataset.dimension_ids),
        gamma=1.0,
        dim_penalty=parameters["diminishing_second_measure"]["institucional"],
        cobenefit_w=parameters["cobenefit_weight"],
        lever_mismatch=1.0,
        eff=tuple(1.0 for _ in dataset.measure_ids),
    )


def ssp_cell(dataset: Dataset) -> tuple[str, str]:
    ssp = dataset.parameters["ssp"]
    return (ssp["municipality_id"], ssp["dimension_id"])


def with_ssp(world: World, dataset: Dataset) -> World:
    """The guide's SSP reading: Rionegro × disaster goes up one class, then measures are placed again."""
    return replace(world, scenario=dataset.parameters["ssp"]["scenario"], ssp_shift=world.ssp_shift | {ssp_cell(dataset)})


class Context:
    """Static facts the score needs, read once from the dataset."""

    def __init__(self, dataset: Dataset):
        self.dataset = dataset
        self.measures = dataset.interventions
        self.measure_ids = dataset.measure_ids
        self.dimension_ids = dataset.dimension_ids
        parameters = dataset.parameters
        self.class_scores = parameters["class_scores"]
        self.min_records = parameters["recurrence_coverage_min_records"]
        self.low_regret_min_class = class_index(
            next(name for name, score in self.class_scores.items() if score == parameters["low_regret_full_weight_min_class_score"])
        )
        self.low_regret_other = parameters["low_regret_other_factor"]
        history = dataset.history
        self.denominator = history["max_adequate_match_count"]
        self.records = {
            municipality_id: next((row["records"] for row in history["coverage"] if row["municipality_id"] == municipality_id), 0)
            for municipality_id in MUNICIPALITY_IDS
        }
        self.counts = {(row["intervention_id"], row["municipality_id"]): row["count"] for row in history["matches"]}
        self.base_class = {}
        self.capacity = {}
        for municipality_id in MUNICIPALITY_IDS:
            for dimension_id in self.dimension_ids:
                classification = vulnerability_class(dataset.metrics, municipality_id, dimension_id)
                if classification is None:
                    raise ValueError(f"Missing vulnerability class for {municipality_id} × {dimension_id}")
                self.base_class[(municipality_id, dimension_id)] = class_index(classification)
                self.capacity[(municipality_id, dimension_id)] = adaptive_capacity_value(dataset.metrics, municipality_id, dimension_id)
        self.cells = cell_profiles(dataset)

    def class_of(self, world: World, municipality_id: str, dimension_id: str) -> int:
        shift = 1 if (municipality_id, dimension_id) in world.ssp_shift else 0
        return min(5, self.base_class[(municipality_id, dimension_id)] + shift)

    def class_score(self, world: World, index: int) -> float:
        return self.class_scores[CLASS_ORDER[index - 1]] ** world.gamma

    def count(self, measure_id: str, municipality_id: str) -> int:
        return self.counts.get((measure_id, municipality_id), 0)


@dataclass(frozen=True)
class Placement:
    candidates: tuple[str, ...]
    tie_steps: tuple[str, ...]
    highest_class: int


def place_measure(ctx: Context, measure: dict, world: World) -> Placement:
    """Mirror of `placeMeasure`: highest class, then lower CA, then higher recurrence."""
    dimension_id = measure["dimension_id"]
    classes = {m: ctx.class_of(world, m, dimension_id) for m in MUNICIPALITY_IDS}
    highest = max(classes.values())
    tied, steps = break_tie(ctx, measure, [m for m in MUNICIPALITY_IDS if classes[m] == highest])
    return Placement(tuple(tied), tuple(steps), highest)


def break_tie(ctx: Context, measure: dict, tied: list[str]) -> tuple[list[str], list[str]]:
    """The tie steps after the class. CA and recurrence are static, so the result depends only on `tied`."""
    dimension_id = measure["dimension_id"]
    steps = ["mayor clase de vulnerabilidad"]
    capacities = {m: ctx.capacity[(m, dimension_id)] for m in tied}
    with_capacity = [m for m in tied if capacities[m] is not None]
    if len(with_capacity) == len(tied) and len(tied) > 1:
        lowest = min(capacities[m] for m in with_capacity)
        tied = [m for m in with_capacity if capacities[m] == lowest]
        steps.append("menor capacidad adaptativa documentada")
    elif len(tied) > 1 and len(with_capacity) != len(tied):
        steps.append("la capacidad adaptativa faltante no se usa para desempatar")
    if len(tied) > 1:
        adequate = [m for m in tied if ctx.records[m] >= ctx.min_records]
        if len(adequate) == len(tied):
            most = max(ctx.count(measure["id"], m) for m in adequate)
            tied = [m for m in adequate if ctx.count(measure["id"], m) == most]
            steps.append("mayor recurrencia documentada")
        else:
            steps.append("un municipio con poca cobertura permanece en el empate")
    return tied, steps


@dataclass(frozen=True)
class Terms:
    """One measure's score terms in one world."""

    id: str
    dimension_id: str
    cost: int
    placement: Placement
    class_score: float
    lever_fit: float
    vuln: float
    rec: float | None   # None = withheld (low coverage), scored as 0, never imputed
    cob: float

    @property
    def total(self) -> float:
        return self.vuln + (0.0 if self.rec is None else self.rec) + self.cob


def measure_terms(ctx: Context, measure: dict, world: World, candidates: tuple[str, ...] | None = None) -> Terms:
    """Score terms for a measure. `candidates` overrides the placement rule (location variants)."""
    if candidates is None:
        placement = place_measure(ctx, measure, world)
    else:
        highest = max(ctx.class_of(world, m, measure["dimension_id"]) for m in candidates)
        placement = Placement(tuple(candidates), ("sitio fijado",), highest)
    index = ctx.measure_ids.index(measure["id"])
    dimension_index = ctx.dimension_ids.index(measure["dimension_id"])
    class_score = ctx.class_score(world, placement.highest_class)
    lever_fit = world.lever_mismatch if lever_mismatch(measure, placement.candidates, ctx.cells) else 1.0
    vuln = world.w_vuln * world.dim_w[dimension_index] * class_score * world.eff[index] * lever_fit
    if any(ctx.records[m] < ctx.min_records for m in placement.candidates):
        rec = None
    else:
        count = max(ctx.count(measure["id"], m) for m in placement.candidates)
        rec = world.w_rec * (count / ctx.denominator if ctx.denominator > 0 else 0.0)
    cob = 0.0
    for dimension_id in measure.get("cobenefit_dimension_ids") or []:
        cob += world.cobenefit_w * min(
            ctx.class_score(world, ctx.class_of(world, m, dimension_id)) for m in placement.candidates
        )
    return Terms(measure["id"], measure["dimension_id"], measure["cost_million_cop"], placement, class_score, lever_fit, vuln, rec, cob)


def prepare_measures(ctx: Context, world: World) -> list[Terms]:
    return [measure_terms(ctx, measure, world) for measure in ctx.measures]


def round6(value: float) -> float:
    """Math.round(value * 1e6) / 1e6, half rounds up like JS."""
    return math.floor(value * 1e6 + 0.5) / 1e6


def score_set(chosen: list[Terms], dim_penalty: float, regret_gate: tuple[int, float] | None = None) -> tuple[float, list[dict]]:
    """Mirror of `scoreSet`: the second and later measures in a dimension keep dim_penalty of their vulnerability term."""
    groups: dict[str, list[Terms]] = {}
    for terms in chosen:
        groups.setdefault(terms.dimension_id, []).append(terms)
    objective = 0.0
    parts = []
    for dimension_id, items in groups.items():
        ordered = sorted(items, key=lambda item: (-item.total, item.id))
        for position, terms in enumerate(ordered):
            factor = 1.0 if position == 0 else dim_penalty
            recurrence = 0.0 if terms.rec is None else terms.rec
            contribution = factor * terms.vuln + recurrence + terms.cob
            if regret_gate is not None:
                min_class, other = regret_gate
                gate = 1 if terms.placement.highest_class >= min_class else other
                contribution = (contribution * gate) / terms.cost
            objective += contribution
            parts.append({
                "id": terms.id,
                "dimension_id": dimension_id,
                "order_in_dimension": position + 1,
                "factor": factor,
                "vulnerability": factor * terms.vuln,
                "recurrence": terms.rec,
                "recurrence_withheld": terms.rec is None,
                "cobenefit": terms.cob,
                "contribution": contribution,
            })
    return round6(objective), parts


@dataclass(frozen=True)
class Candidate:
    ids: tuple[str, ...]
    cost: int
    remaining: int
    objective: float
    parts: list

    @property
    def key(self) -> str:
        return "|".join(self.ids)


def institutional_key(candidate: Candidate):
    """compareInstitutional: higher score, then more budget left, then ids."""
    return (-candidate.objective, -candidate.remaining, candidate.key)


def enumerate_candidates(ctx: Context, world: World, force=(), exclude=(), budget: int | None = None):
    """Every feasible set scored in `world`, with the measure terms it was built from."""
    space = space_for(ctx.dataset, budget)
    prepared = prepare_measures(ctx, world)
    force, exclude = set(force), set(exclude)
    for index in range(space.size):
        chosen = [prepared[k] for k in range(len(prepared)) if space.members[index, k]]
        ids = tuple(sorted(terms.id for terms in chosen))
        if not force <= set(ids) or exclude & set(ids):
            continue
        objective, parts = score_set(chosen, world.dim_penalty)
        cost = int(space.cost[index])
        yield Candidate(ids, cost, space.budget - cost, objective, parts), chosen


def search(ctx: Context, world: World, force=(), exclude=(), budget: int | None = None) -> Candidate | None:
    best = None
    for candidate, _ in enumerate_candidates(ctx, world, force, exclude, budget):
        if best is None or institutional_key(candidate) < institutional_key(best):
            best = candidate
    return best


def analyze_world0(dataset: Dataset) -> dict:
    """The JS `analyzeCorridor` numbers: lenses, baselines, SSP stress, rejected gaps, fingerprint."""
    ctx = Context(dataset)
    base = world0(dataset)
    parameters = dataset.parameters
    lenses = parameters["diminishing_second_measure"]
    institutional = None
    nature = None
    max_count = None
    grey = None
    containing: dict[str, Candidate] = {}
    nbs = {measure["id"]: measure["nbs_class"] for measure in dataset.interventions}
    costs = {measure["id"]: measure["cost_million_cop"] for measure in dataset.interventions}

    def nature_key(candidate: Candidate):
        classes = [nbs[i] for i in candidate.ids]
        grey_cost = sum(costs[i] for i in candidate.ids if nbs[i] == "GREY_INFRASTRUCTURE")
        return (-candidate.objective, -classes.count("NBS_DIRECT"), -classes.count("NBS_HYBRID"), grey_cost, *institutional_key(candidate)[1:])

    multidimensional = None
    low_regret = None
    gate = (ctx.low_regret_min_class, ctx.low_regret_other)
    for candidate, chosen in enumerate_candidates(ctx, base):
        key = institutional_key(candidate)
        if institutional is None or key < institutional_key(institutional):
            institutional = candidate
        if nature is None or nature_key(candidate) < nature_key(nature):
            nature = candidate
        count_key = (-len(candidate.ids), *key)
        if max_count is None or count_key < (-len(max_count.ids), *institutional_key(max_count)):
            max_count = candidate
        if "infra_resilient" in candidate.ids and (grey is None or key < institutional_key(grey)):
            grey = candidate
        for measure_id in candidate.ids:
            if measure_id not in containing or key < institutional_key(containing[measure_id]):
                containing[measure_id] = candidate
        multi_key = (-score_set(chosen, lenses["multidimensional"])[0], *key)
        if multidimensional is None or multi_key < multidimensional[0]:
            multidimensional = (multi_key, candidate)
        regret_key = (-score_set(chosen, lenses["bajo_arrepentimiento"], gate)[0], *key)
        if low_regret is None or regret_key < low_regret[0]:
            low_regret = (regret_key, candidate)
    multidimensional = multidimensional[1]
    low_regret = low_regret[1]
    stress = search(ctx, with_ssp(base, dataset))
    rejected = sorted(
        (
            {"id": measure_id, "gap": round(institutional.objective - containing[measure_id].objective, 6)}
            for measure_id in dataset.measure_ids if measure_id not in institutional.ids
        ),
        key=lambda row: row["gap"],
    )
    fingerprint = decision_fingerprint({
        "ids": list(institutional.ids),
        "cost": institutional.cost,
        "budget": parameters["budget_million_cop"],
        "weights": parameters["weights"],
        "diminishing": lenses["institucional"],
    })
    return {
        "institucional": institutional,
        "naturaleza": nature,
        "multidimensional": multidimensional,
        "bajo_arrepentimiento": low_regret,
        "max_count": max_count,
        "grey": grey,
        "stress": stress,
        "containing": containing,
        "rejected": rejected,
        "fingerprint": fingerprint,
        "prepared": prepare_measures(ctx, base),
    }


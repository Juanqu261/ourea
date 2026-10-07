function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

export function scoreSet(chosen, diminishing, {
  useUrgency = false,
  regret = false,
  parameters = null,
  includeCobenefit = false,
} = {}) {
  const groups = new Map();
  chosen.forEach((measure) => {
    if (!groups.has(measure.dimensionId)) groups.set(measure.dimensionId, []);
    groups.get(measure.dimensionId).push(measure);
  });
  const parts = [];
  let objective = 0;
  groups.forEach((items, dimensionId) => {
    const ordered = items.slice().sort((left, right) => {
      const rank = undiminished(right, useUrgency, includeCobenefit) - undiminished(left, useUrgency, includeCobenefit);
      if (rank !== 0) return rank;
      return left.id.localeCompare(right.id);
    });
    ordered.forEach((measure, index) => {
      const factor = index === 0 ? 1 : diminishing;
      const vulnerability = factor * measure.vulnTerm;
      const recurrence = measure.recurrence.withheld ? 0 : measure.recurrence.term;
      const cobenefit = includeCobenefit ? measure.cobenefit.term : 0;
      const urgency = useUrgency ? factor * measure.urgencyTerm : 0;
      let contribution = vulnerability + recurrence + cobenefit + urgency;
      if (regret) {
        const gate = measure.classScore >= parameters.low_regret_full_weight_min_class_score
          ? 1
          : parameters.low_regret_other_factor;
        contribution = (contribution * gate) / measure.cost;
      }
      objective += contribution;
      parts.push({
        id: measure.id,
        dimensionId,
        orderInDimension: index + 1,
        factor,
        vulnerability,
        recurrence: measure.recurrence.withheld ? null : measure.recurrence.term,
        recurrenceWithheld: measure.recurrence.withheld,
        cobenefit: measure.cobenefit.term,
        cobenefitApplied: includeCobenefit,
        urgency,
        contribution,
      });
    });
  });
  return { objective: round6(objective), parts };
}

function undiminished(measure, useUrgency, includeCobenefit) {
  return measure.vulnTerm
    + (measure.recurrence.withheld ? 0 : measure.recurrence.term)
    + (includeCobenefit ? measure.cobenefit.term : 0)
    + (useUrgency ? measure.urgencyTerm : 0);
}

function compareBy(objectiveOf, left, right) {
  const delta = objectiveOf(right) - objectiveOf(left);
  if (delta !== 0) return delta;
  return 0;
}

function compareInstitutional(left, right) {
  const delta = compareBy((item) => item.institucional.objective, left, right);
  if (delta !== 0) return delta;
  if (left.remaining !== right.remaining) return right.remaining - left.remaining;
  return left.ids.join('|').localeCompare(right.ids.join('|'));
}

function compareNature(left, right) {
  const delta = compareBy((item) => item.withCobenefit.objective, left, right);
  if (delta !== 0) return delta;
  if (left.nbsDirect !== right.nbsDirect) return right.nbsDirect - left.nbsDirect;
  if (left.nbsHybrid !== right.nbsHybrid) return right.nbsHybrid - left.nbsHybrid;
  if (left.greyCost !== right.greyCost) return left.greyCost - right.greyCost;
  return compareInstitutional(left, right);
}

function compareMulti(left, right) {
  const delta = compareBy((item) => item.multi.objective, left, right);
  if (delta !== 0) return delta;
  return compareInstitutional(left, right);
}

function compareRegret(left, right) {
  const delta = compareBy((item) => item.regret.objective, left, right);
  if (delta !== 0) return delta;
  return compareInstitutional(left, right);
}

function compareCount(left, right) {
  if (left.count !== right.count) return right.count - left.count;
  return compareInstitutional(left, right);
}

function keepBest(current, candidate, compare) {
  if (!current || compare(candidate, current) < 0) return candidate;
  return current;
}

export function searchPortfolios(prepared, parameters) {
  const budget = parameters.budget_million_cop;
  const count = prepared.length;
  let institucional = null;
  let naturaleza = null;
  let multidimensional = null;
  let bajoArrepentimiento = null;
  let maxCount = null;
  let grey = null;
  const containing = new Map();

  for (let mask = 0; mask < (2 ** count); mask += 1) {
    const chosen = [];
    let cost = 0;
    let overflow = false;
    for (let index = 0; index < count; index += 1) {
      if ((mask & (2 ** index)) === 0) continue;
      cost += prepared[index].cost;
      if (cost > budget) {
        overflow = true;
        break;
      }
      chosen.push(prepared[index]);
    }
    if (overflow) continue;
    const candidate = {
      ids: chosen.map((measure) => measure.id).sort(),
      cost,
      remaining: budget - cost,
      count: chosen.length,
      institucional: scoreSet(chosen, parameters.diminishing_second_measure.institucional),
      withCobenefit: scoreSet(chosen, parameters.diminishing_second_measure.institucional, {
        includeCobenefit: true,
      }),
      multi: scoreSet(chosen, parameters.diminishing_second_measure.multidimensional, {
        includeCobenefit: true,
      }),
      regret: scoreSet(chosen, parameters.diminishing_second_measure.bajo_arrepentimiento, {
        regret: true,
        parameters,
        includeCobenefit: true,
      }),
      nbsDirect: chosen.filter((measure) => measure.nbsClass === 'NBS_DIRECT').length,
      nbsHybrid: chosen.filter((measure) => measure.nbsClass === 'NBS_HYBRID').length,
      greyCost: chosen
        .filter((measure) => measure.nbsClass === 'GREY_INFRASTRUCTURE')
        .reduce((sum, measure) => sum + measure.cost, 0),
    };
    if (candidate.cost > budget) throw new Error('Portfolio exceeded the adaptation fund');
    institucional = keepBest(institucional, candidate, compareInstitutional);
    naturaleza = keepBest(naturaleza, candidate, compareNature);
    multidimensional = keepBest(multidimensional, candidate, compareMulti);
    bajoArrepentimiento = keepBest(bajoArrepentimiento, candidate, compareRegret);
    maxCount = keepBest(maxCount, candidate, compareCount);
    if (candidate.ids.includes('infra_resilient')) {
      grey = keepBest(grey, candidate, compareInstitutional);
    }
    candidate.ids.forEach((id) => {
      containing.set(id, keepBest(containing.get(id) ?? null, candidate, compareInstitutional));
    });
  }

  if (!institucional) throw new Error('The search did not return a portfolio');
  return {
    institucional,
    naturaleza,
    multidimensional,
    bajo_arrepentimiento: bajoArrepentimiento,
    max_count: maxCount,
    grey,
    containing,
  };
}

export function computeLeaveOneOutImpact(prepared, parameters, portfolio) {
  const current = portfolio.institucional?.objective ?? portfolio.objective;
  const selected = portfolio.ids;
  return selected.map((id) => {
    const subset = prepared.filter((measure) => measure.id !== id);
    const best = searchPortfolios(subset, parameters).institucional;
    const objectiveWithout = best.institucional.objective;
    const loss = round6(current - objectiveWithout);
    return {
      id,
      bestWithoutMeasure: best.ids,
      objectiveWithoutMeasure: objectiveWithout,
      objectiveLoss: loss > 1e-6 ? loss : 0,
      replacementMeasures: best.ids.filter((item) => !selected.includes(item)),
    };
  });
}

export function searchWithUrgency(prepared, parameters) {
  const budget = parameters.budget_million_cop;
  const count = prepared.length;
  let best = null;
  for (let mask = 0; mask < (2 ** count); mask += 1) {
    const chosen = [];
    let cost = 0;
    let overflow = false;
    for (let index = 0; index < count; index += 1) {
      if ((mask & (2 ** index)) === 0) continue;
      cost += prepared[index].cost;
      if (cost > budget) {
        overflow = true;
        break;
      }
      chosen.push(prepared[index]);
    }
    if (overflow) continue;
    const candidate = {
      ids: chosen.map((measure) => measure.id).sort(),
      cost,
      remaining: budget - cost,
      count: chosen.length,
      institucional: scoreSet(
        chosen,
        parameters.diminishing_second_measure.institucional,
        { useUrgency: true },
      ),
    };
    best = keepBest(best, candidate, compareInstitutional);
  }
  return best;
}

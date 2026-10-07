import { decisionFingerprint } from './fingerprint.js';
import { prepareMeasures } from './cornareModel.js';
import { searchPortfolios } from './portfolioSearch.js';
import { compareStress } from './stressTest.js';
import {
  criticalFindings,
  explainRejection,
  explainSelection,
  nbsRollup,
  residualView,
} from './explanations.js';

export function analyzeCorridor(dataset) {
  const prepared = prepareMeasures(dataset);
  const search = searchPortfolios(prepared, dataset.parameters);
  const stress = compareStress(search.institucional, prepared, dataset.parameters);
  const profiles = dataset.profiles;
  const byId = new Map(prepared.map((measure) => [measure.id, measure]));
  const partById = new Map(search.institucional.institucional.parts.map((part) => [part.id, part]));

  const explanations = {};
  prepared.forEach((measure) => {
    const part = partById.get(measure.id);
    if (part) {
      explanations[measure.id] = {
        selected: true,
        lines: explainSelection(measure, part, profiles),
      };
      return;
    }
    const alternative = search.containing.get(measure.id);
    explanations[measure.id] = {
      selected: false,
      lines: explainRejection(
        { ...measure, parametersBudget: dataset.parameters.budget_million_cop },
        { ...search.institucional, parametersBudget: dataset.parameters.budget_million_cop },
        alternative && alternative.ids.join('|') !== search.institucional.ids.join('|') ? alternative : alternative,
      ),
    };
  });

  const rejected = prepared
    .filter((measure) => !search.institucional.ids.includes(measure.id))
    .map((measure) => {
      const alternative = search.containing.get(measure.id);
      const gap = alternative
        ? search.institucional.institucional.objective - alternative.institucional.objective
        : null;
      return { id: measure.id, name: measure.name, gap, cost: measure.cost };
    })
    .sort((left, right) => (left.gap ?? 99) - (right.gap ?? 99));

  const portfolio = decorate(search.institucional, prepared, profiles);
  if (portfolio.cost > dataset.parameters.budget_million_cop) {
    throw new Error('Institutional portfolio exceeds COP 5000 million');
  }

  const fingerprint = decisionFingerprint({
    ids: portfolio.ids,
    cost: portfolio.cost,
    budget: dataset.parameters.budget_million_cop,
    weights: dataset.parameters.weights,
    diminishing: dataset.parameters.diminishing_second_measure.institucional,
  });

  return {
    prepared,
    byId,
    portfolio,
    lenses: {
      institucional: portfolio,
      naturaleza: decorate(search.naturaleza, prepared, profiles),
      multidimensional: decorate(search.multidimensional, prepared, profiles),
      bajo_arrepentimiento: decorate(search.bajo_arrepentimiento, prepared, profiles),
    },
    baselines: {
      max_count: decorate(search.max_count, prepared, profiles),
      grey: decorate(search.grey, prepared, profiles),
    },
    stress: {
      ...stress,
      portfolio: decorate(stress.portfolio, prepared, profiles),
    },
    findings: criticalFindings(dataset.metrics, dataset.history),
    residual: residualView(search.institucional, prepared, dataset.metrics),
    gaps: dataset.gaps,
    mea: dataset.mea,
    nbs: nbsRollup(search.institucional, prepared),
    explanations,
    rejected,
    fingerprint,
    parameters: dataset.parameters,
  };
}

function decorate(candidate, prepared, profiles) {
  const measures = candidate.institucional.parts
    .slice()
    .sort((left, right) => right.contribution - left.contribution || left.id.localeCompare(right.id))
    .map((part, index) => {
      const measure = prepared.find((item) => item.id === part.id);
      return {
        ...measure,
        part,
        implementationOrder: index + 1,
        place: placeOf(measure, profiles),
      };
    });
  return { ...candidate, measures };
}

function placeOf(measure, profiles) {
  const names = measure.placement.candidates.map((row) => (
    profiles.find((item) => item.id === row.municipalityId)?.name ?? row.municipalityId
  ));
  if (measure.scope === 'corridor') {
    return {
      localization: 'Corredor Rionegro–Guarne–Marinilla',
      trigger: names.join(' y '),
    };
  }
  return {
    localization: names.length > 1 ? names.join(' o ') : names[0],
    trigger: names.join(' y '),
  };
}

export function bundleDataset({
  interventions,
  metrics,
  history,
  parameters,
  gaps,
  mea,
  profiles,
}) {
  return {
    interventions: interventions.interventions,
    metrics: metrics.metrics,
    history,
    parameters,
    gaps: gaps.gaps,
    mea,
    profiles: profiles.municipalities,
    dimensions: interventions.dimensions,
  };
}

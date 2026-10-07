import { CLASS_LABELS } from './evidence.js';

const MUNICIPALITY_IDS = ['rionegro', 'guarne', 'marinilla'];

export function classScoreOf(classification, parameters) {
  if (!classification) return null;
  const score = parameters.class_scores[classification];
  if (typeof score !== 'number') {
    throw new Error(`Unknown vulnerability class: ${classification}`);
  }
  return score;
}

export function metricRows(metrics, { municipalityId, dimensionId, metric, scenario = 'reference' }) {
  return metrics.filter((row) => (
    row.municipality_id === municipalityId
    && row.dimension_id === dimensionId
    && row.metric === metric
    && row.scenario === scenario
  ));
}

export function vulnerabilityClass(metrics, municipalityId, dimensionId) {
  const rows = metricRows(metrics, { municipalityId, dimensionId, metric: 'vulnerability' });
  const numeric = rows.find((row) => row.value != null && row.classification);
  if (numeric) return numeric.classification;
  return rows.find((row) => row.classification)?.classification ?? null;
}

export function adaptiveCapacityValue(metrics, municipalityId, dimensionId) {
  const row = metricRows(metrics, {
    municipalityId,
    dimensionId,
    metric: 'adaptive_capacity',
  }).find((item) => item.value != null);
  return row ? row.value : null;
}

function coverageFor(history, municipalityId) {
  return history.coverage.find((row) => row.municipality_id === municipalityId);
}

function recurrenceCount(history, interventionId, municipalityId) {
  return history.matches.find((row) => (
    row.intervention_id === interventionId && row.municipality_id === municipalityId
  ))?.count ?? 0;
}

export function placeMeasure(measure, dataset) {
  const { metrics, history, parameters } = dataset;
  const ranked = MUNICIPALITY_IDS.map((municipalityId) => ({
    municipalityId,
    classification: vulnerabilityClass(metrics, municipalityId, measure.dimension_id),
    classScore: classScoreOf(
      vulnerabilityClass(metrics, municipalityId, measure.dimension_id),
      parameters,
    ),
    adaptiveCapacity: adaptiveCapacityValue(metrics, municipalityId, measure.dimension_id),
    records: coverageFor(history, municipalityId)?.records ?? 0,
    recurrence: recurrenceCount(history, measure.id, municipalityId),
  }));
  if (ranked.some((row) => row.classScore == null)) {
    throw new Error(`Missing vulnerability class for ${measure.id}`);
  }
  const highest = Math.max(...ranked.map((row) => row.classScore));
  let tied = ranked.filter((row) => row.classScore === highest);
  const tieSteps = ['mayor clase de vulnerabilidad'];
  const withCapacity = tied.filter((row) => row.adaptiveCapacity != null);
  if (withCapacity.length === tied.length && tied.length > 1) {
    const lowest = Math.min(...withCapacity.map((row) => row.adaptiveCapacity));
    tied = withCapacity.filter((row) => row.adaptiveCapacity === lowest);
    tieSteps.push('menor capacidad adaptativa documentada');
  } else if (tied.length > 1 && withCapacity.length !== tied.length) {
    tieSteps.push('la capacidad adaptativa faltante no se usa para desempatar');
  }
  if (tied.length > 1) {
    const minimum = parameters.recurrence_coverage_min_records;
    const adequate = tied.filter((row) => row.records >= minimum);
    if (adequate.length === tied.length) {
      const most = Math.max(...adequate.map((row) => row.recurrence));
      tied = adequate.filter((row) => row.recurrence === most);
      tieSteps.push('mayor recurrencia documentada');
    } else {
      tieSteps.push('un municipio con poca cobertura permanece en el empate');
    }
  }
  return { candidates: tied, tieSteps, highestClassScore: highest };
}

function recurrenceComponent(placement, history, parameters) {
  const minimum = parameters.recurrence_coverage_min_records;
  const inadequate = placement.candidates.some((row) => row.records < minimum);
  if (inadequate) {
    return {
      withheld: true,
      count: null,
      normalized: null,
      term: 0,
      provenance: 'missing',
      reason: 'La cobertura del reporte es demasiado baja para tratar la ausencia de registros como recurrencia cero.',
    };
  }
  const count = Math.max(...placement.candidates.map((row) => row.recurrence));
  const denominator = history.max_adequate_match_count;
  const normalized = denominator > 0 ? count / denominator : 0;
  return {
    withheld: false,
    count,
    normalized,
    term: parameters.weights.recurrence * normalized,
    provenance: count > 0 ? 'team_inference' : 'institutional',
    reason: count > 0
      ? 'Hay frases del catálogo en el reporte municipal. La coincidencia es una inferencia de texto, no una evaluación.'
      : 'El reporte del municipio tiene cobertura suficiente y no contiene esta medida. Eso no prueba que la acción no exista fuera del archivo.',
  };
}

function cobenefitTerm(measure, placement, metrics, parameters) {
  if (!measure.cobenefit_dimension_ids?.length) {
    return { term: 0, dimensions: [], provenance: null };
  }
  const dimensions = measure.cobenefit_dimension_ids.map((dimensionId) => {
    const scores = placement.candidates.map((row) => classScoreOf(
      vulnerabilityClass(metrics, row.municipalityId, dimensionId),
      parameters,
    ));
    return {
      dimensionId,
      classScore: Math.min(...scores),
      note: measure.cobenefit_note,
    };
  });
  const term = dimensions.reduce(
    (sum, item) => sum + parameters.cobenefit_weight * item.classScore,
    0,
  );
  return { term, dimensions, provenance: 'team_inference' };
}

export function urgencyTerm(measure, placement, parameters) {
  const shift = parameters.ssp;
  if (measure.dimension_id !== shift.dimension_id) return 0;
  const includesShift = placement.candidates.some((row) => row.municipalityId === shift.municipality_id)
    || measure.scope === 'corridor';
  if (!includesShift) return 0;
  const current = placement.highestClassScore;
  const delta = parameters.class_scores[shift.to_class] - parameters.class_scores[shift.from_class];
  const effective = Math.min(1, current + delta);
  return parameters.weights.vulnerability * (effective - current);
}

export function prepareMeasures(dataset) {
  const { interventions, history, parameters, metrics } = dataset;
  return interventions.map((measure) => {
    const placement = placeMeasure(measure, dataset);
    const recurrence = recurrenceComponent(placement, history, parameters);
    const cobenefit = cobenefitTerm(measure, placement, metrics, parameters);
    const classification = placement.candidates[0].classification;
    const classScore = placement.highestClassScore;
    return {
      ...measure,
      placement,
      classification,
      classificationLabel: CLASS_LABELS[classification],
      classScore,
      vulnTerm: parameters.weights.vulnerability * classScore,
      recurrence,
      cobenefit,
      urgencyTerm: urgencyTerm(measure, placement, parameters),
      cost: measure.cost_million_cop,
      dimensionId: measure.dimension_id,
      nbsClass: measure.nbs_class,
    };
  });
}

export function municipalityName(id, profiles) {
  return profiles.find((item) => item.id === id)?.name ?? id;
}

export function placementLabel(measure, profiles) {
  const names = measure.placement.candidates.map((row) => municipalityName(row.municipalityId, profiles));
  const joined = names.join(' y ');
  if (measure.scope === 'corridor') {
    return {
      localization: 'Corredor Rionegro–Guarne–Marinilla',
      trigger: joined,
    };
  }
  return {
    localization: names.length > 1 ? names.join(' o ') : joined,
    trigger: joined,
  };
}

// Generated explanations of the result. Every sentence is built from the analysis, so a different
// budget, catalog or territory produces its own text. Four questions per result:
// what was decided, why, how stable it is, and what would change it.
import { CLASS_LABELS } from './evidence.js';
import { vulnerabilityClass } from './cornareModel.js';
import { dimensionName } from './explanations.js';
import { copM, esNumber, esPct, joinEs, plural } from './format.js';

const RISK_CLASS = { muy_baja: 'Muy bajo', baja: 'Bajo', media: 'Medio', alta: 'Alto', muy_alta: 'Muy alto' };
const CLASS_RANK = { muy_baja: 1, baja: 2, media: 3, alta: 4, muy_alta: 5 };

// "Instrumentos de compensación y Pago por Servicios Ambientales – PSA" → "PSA".
export function shortName(measure) {
  const name = measure?.name ?? '';
  const parts = name.split(/\s[–—-]\s/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : name;
}

function nameOf(profiles, id) {
  return profiles.find((item) => item.id === id)?.name ?? id;
}

export function scenarioName(shift) {
  return String(shift.scenario).replace(/^ssp(\d)_(\d)_(\d)$/i, 'SSP$1-$2.$3');
}

function placeShort(measure) {
  return measure.scope === 'corridor' ? 'corredor' : measure.place?.localization ?? '';
}

// The score of one measure, term by term, as it enters the portfolio.
export function scoreBreakdown(measure, part, parameters, profiles) {
  const weights = parameters.weights;
  const dimension = dimensionName(measure.dimensionId);
  const where = joinEs(measure.placement.candidates.map((row) => nameOf(profiles, row.municipalityId)));
  const rows = [{
    label: 'Vulnerabilidad',
    detail: `Clase de vulnerabilidad ${measure.classificationLabel} en ${dimension} (${where}): ${esNumber(weights.vulnerability, 2)} × ${esNumber(measure.classScore, 2)}.`,
    value: measure.vulnTerm,
  }];
  if (part && part.factor < 1) {
    rows.push({
      label: 'Segunda medida de la dimensión',
      detail: `Otra medida de ${dimension} aporta más en este portafolio, así que esta vulnerabilidad cuenta al ${esPct(part.factor)}.`,
      value: part.vulnerability - measure.vulnTerm,
    });
  }
  const recurrence = measure.recurrence;
  if (recurrence.withheld) {
    const low = measure.placement.candidates.filter((row) => row.records < parameters.recurrence_coverage_min_records);
    rows.push({
      label: 'Recurrencia de acciones',
      detail: `Sin calificar: ${joinEs(low.map((row) => `${nameOf(profiles, row.municipalityId)} tiene ${plural(row.records, 'registro')}`))} en el reporte municipal y el mínimo es ${parameters.recurrence_coverage_min_records}. No se cuenta como cero.`,
      value: null,
    });
  } else if (recurrence.count > 0) {
    rows.push({
      label: 'Recurrencia de acciones',
      detail: `${plural(recurrence.count, 'registro')} de esta medida en el reporte de ${where}: ${esNumber(weights.recurrence, 2)} × ${recurrence.count} ÷ ${esNumber(recurrence.count / recurrence.normalized)}.`,
      value: recurrence.term,
    });
  } else {
    rows.push({
      label: 'Recurrencia de acciones',
      detail: `Ningún registro de esta medida en el reporte de ${where}.`,
      value: 0,
    });
  }
  rows.push({
    label: 'Talleres municipales',
    detail: `Peso ${esPct(weights.workshops)} sin datos en el paquete. No se suma.`,
    value: null,
  });
  const standalone = measure.vulnTerm + (recurrence.withheld ? 0 : recurrence.term);
  return {
    rows,
    total: part ? part.contribution : standalone,
    totalLabel: part ? 'Aporte al portafolio' : 'Puntaje propio',
  };
}

// The dimension where most municipalities sit in Alta or Muy alta, for the territory step.
export function regionalPressure(metrics, profiles, dimensions) {
  const ranked = dimensions.map((dimension) => {
    const classes = profiles.map((profile) => ({
      municipalityId: profile.id,
      classification: vulnerabilityClass(metrics, profile.id, dimension.id),
    })).filter((row) => row.classification);
    return {
      dimension,
      classes,
      high: classes.filter((row) => CLASS_RANK[row.classification] >= CLASS_RANK.alta).length,
      total: classes.reduce((sum, row) => sum + CLASS_RANK[row.classification], 0),
    };
  }).sort((left, right) => right.high - left.high || right.total - left.total);
  const top = ranked[0];
  if (!top || !top.classes.length) return null;
  const groups = new Map();
  top.classes
    .slice()
    .sort((left, right) => CLASS_RANK[right.classification] - CLASS_RANK[left.classification])
    .forEach((row) => {
      if (!groups.has(row.classification)) groups.set(row.classification, []);
      groups.get(row.classification).push(nameOf(profiles, row.municipalityId));
    });
  return {
    dimensionId: top.dimension.id,
    title: `${top.dimension.short_name ?? dimensionName(top.dimension.id)} es la presión más extendida`,
    detail: [...groups.entries()].map(([classification, names]) => `${CLASS_LABELS[classification]} en ${joinEs(names)}`).join(' · '),
  };
}

// "el riesgo de desastres de Rionegro pasa de 0,28 a 0,32 hacia 2060", with or without the class names.
export function stressSentence(stress, profiles) {
  const shift = stress.shift;
  const place = nameOf(profiles, shift.municipality_id);
  const metric = shift.metric === 'risk' ? 'riesgo' : 'vulnerabilidad';
  const dimension = dimensionName(shift.dimension_id);
  const subject = dimension.startsWith(metric) ? dimension : `${metric} de ${dimension}`;
  const from = esNumber(shift.from_value, 2);
  const to = esNumber(shift.to_value, 2);
  return {
    place,
    short: `el ${subject} de ${place} pasa de ${from} a ${to} hacia ${shift.year}`,
    full: `el ${subject} de ${place} pasa de ${from} (${RISK_CLASS[shift.from_class]}) a ${to} (${RISK_CLASS[shift.to_class]}) hacia ${shift.year}`,
  };
}

export function decisionSummary(analysis) {
  const { portfolio, parameters, prepared, stress, hinges, rejected, profiles } = analysis;
  const byId = new Map(prepared.map((measure) => [measure.id, measure]));
  const budget = parameters.budget_million_cop;
  const count = portfolio.measures.length;
  const decided = `Con ${copM(budget)} y los pesos de priorización de CORNARE, Ourea financia ${count} de las ${prepared.length} medidas ${
    portfolio.remaining > 0 ? `y deja ${copM(portfolio.remaining)} sin asignar` : 'y usa todo el fondo'
  }.`;

  const leaders = portfolio.measures.slice(0, 3).map((measure) => (
    `${dimensionName(measure.dimensionId)} ${measure.classificationLabel.toLowerCase()} (${placeShort(measure)})`
  ));
  const why = `Los mayores aportes vienen de la vulnerabilidad más alta de cada dimensión: ${joinEs(leaders)}. Una segunda medida en la misma dimensión cuenta su vulnerabilidad al ${esPct(parameters.diminishing_second_measure.institucional)}.`;

  const { short: shiftText } = stressSentence(stress, profiles);
  const scenario = scenarioName(stress.shift);
  const stable = stress.sameSet
    ? `El conjunto no cambia con el único cambio documentado para ${scenario}: ${shiftText}.`
    : `El conjunto cambia con el único cambio documentado para ${scenario} (${shiftText}): entran ${joinEs(stress.entered.map((id) => shortName(byId.get(id))))}; salen ${joinEs(stress.exited.map((id) => shortName(byId.get(id))))}.`;

  const hinge = hinges[0];
  const nearest = hinge ? rejected.find((item) => item.id === hinge.id) : null;
  let change = 'Ninguna alternativa factible queda cerca del portafolio elegido.';
  if (hinge && nearest) {
    const inIds = nearest.alternativeIds.filter((id) => !portfolio.ids.includes(id));
    const outIds = portfolio.ids.filter((id) => !nearest.alternativeIds.includes(id));
    const swap = outIds.length
      ? `cambia ${joinEs(outIds.map((id) => shortName(byId.get(id))))} por ${joinEs(inIds.map((id) => shortName(byId.get(id))))}`
      : `suma ${joinEs(inIds.map((id) => shortName(byId.get(id))))}`;
    const workshops = `la recurrencia en talleres municipales (${esPct(parameters.weights.workshops)} de la regla) aún no tiene datos`;
    change = `La alternativa más cercana ${swap} y queda a ${hinge.gapDisplay} puntos. ${
      hinge.rangeFraction <= 1
        ? `Como ${workshops}, ese dato podría invertir el orden.`
        : `La diferencia supera lo que ${workshops.replace(' aún no tiene datos', '')} podría sumar.`
    }`;
  }
  return {
    decided,
    why,
    stable,
    change,
    sentence: [decided, stable, change].join(' '),
  };
}

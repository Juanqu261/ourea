import { NBS_LABELS, STRESS_LABELS } from './evidence.js';
import { placementLabel } from './cornareModel.js';

const DIMENSION_NAMES = {
  biodiversity: 'biodiversidad y servicios ecosistémicos',
  water: 'recurso hídrico',
  disaster: 'riesgo de desastres',
  health: 'salud humana',
  infrastructure: 'infraestructura',
  habitat: 'hábitat humano',
  food: 'seguridad alimentaria',
};

export function dimensionName(id) {
  return DIMENSION_NAMES[id] ?? id;
}

function money(value) {
  return `COP ${value.toLocaleString('es-CO')} millones`;
}

export function explainSelection(measure, part, profiles) {
  const place = placementLabel(measure, profiles);
  const recurrence = measure.recurrence.withheld
    ? 'La recurrencia no se califica: la cobertura del reporte no alcanza.'
    : measure.recurrence.count > 0
      ? `La recurrencia documentada suma ${measure.recurrence.count} registros coincidentes.`
      : 'No hay registros coincidentes en municipios con cobertura suficiente.';
  const cobenefit = measure.cobenefit.term > 0
    ? `La unidad funcional nombra un cobeneficio hacia ${measure.cobenefit.dimensions.map((item) => dimensionName(item.dimensionId)).join(', ')}. Ese término no entra al puntaje institucional.`
    : 'No se suma un cobeneficio al puntaje institucional.';
  return [
    `${measure.name} se ubica en ${place.localization}.`,
    `La dispara la vulnerabilidad ${measure.classificationLabel.toLowerCase()} en ${dimensionName(measure.dimensionId)} (${place.trigger}).`,
    measure.sensitivity_factors_addressed.length
      ? `Busca reducir sensibilidad por: ${measure.sensitivity_factors_addressed.join('; ')}.`
      : 'No se le atribuye una reducción de sensibilidad biofísica.',
    measure.adaptive_capacity_factors_strengthened.length
      ? `Busca fortalecer capacidad adaptativa por: ${measure.adaptive_capacity_factors_strengthened.join('; ')}.`
      : 'No se le atribuye un fortalecimiento de capacidad adaptativa.',
    `Cuesta ${money(measure.cost)}. Ese costo es un supuesto del ejercicio.`,
    recurrence,
    cobenefit,
    `Clase: ${NBS_LABELS[measure.nbsClass]}. Esa clase no significa que la medida sea la mejor.`,
    `Aporta ${part.contribution.toFixed(3)} al puntaje de prioridad del portafolio.`,
    'No hay un porcentaje de vulnerabilidad reducida.',
  ];
}

export function explainRejection(measure, best, alternative) {
  if (!alternative) {
    return `${measure.name} no cabe en el fondo de ${money(best.parametersBudget ?? 5000)}.`;
  }
  const gap = best.institucional.objective - alternative.institucional.objective;
  return [
    `${measure.name} queda por fuera del portafolio institucional.`,
    `Forzarla y reoptimizar el resto usa ${money(alternative.cost)} y baja el puntaje de prioridad en ${gap.toFixed(3)}.`,
    `Su costo es ${money(measure.cost)} y su vulnerabilidad de referencia es ${measure.classificationLabel.toLowerCase()}.`,
    'El descarte no afirma que la medida sea inútil. Afirma que, con esta regla y este fondo, otra combinación puntúa más.',
  ];
}

export function criticalFindings(metrics, history) {
  const value = (id) => metrics.find((row) => row.id === id);
  const rio = value('rio-bio-vuln');
  const mar = value('mar-bio-vuln');
  const water = value('region-water-vuln');
  const threat = value('mar-disaster-threat');
  const riskFrom = value('rio-disaster-risk-ref');
  const riskTo = value('rio-disaster-risk-2060');
  const marinillaRecords = history.coverage.find((row) => row.municipality_id === 'marinilla')?.records;
  return [
    {
      id: 'finding-biodiversity',
      text: `En biodiversidad, Rionegro tiene vulnerabilidad ${rio.value} (${rio.classification_label}) y Marinilla ${mar.value} (${mar.classification_label}). Sus capacidades adaptativas en esa dimensión son 0,22 y 0,24.`,
      provenance: 'institutional',
    },
    {
      id: 'finding-water',
      text: `A escala regional, recurso hídrico tiene vulnerabilidad promedio ${water.value}. En el corredor, Marinilla está en clase Alta y Rionegro y Guarne en Media.`,
      provenance: 'institutional',
    },
    {
      id: 'finding-disaster',
      text: `En riesgo de desastres, Marinilla tiene amenaza Alta (${threat.value_min}–${threat.value_max}) y vulnerabilidad Muy baja. Rionegro tiene la mayor sensibilidad del corredor (0,40) y su riesgo pasa de ${riskFrom.value} ${riskFrom.classification_label} a ${riskTo.value} ${riskTo.classification_label} hacia 2060.`,
      provenance: 'institutional',
    },
    {
      id: 'finding-guarne',
      text: 'Guarne concentra vulnerabilidad Alta en riesgo de desastres y en infraestructura. En biodiversidad su capacidad adaptativa es 0,33, todavía Baja, y su vulnerabilidad es Media.',
      provenance: 'institutional',
    },
    {
      id: 'finding-gaps',
      text: `No hay dependencias empresa–territorio ni conteo de talleres. Marinilla solo tiene ${marinillaRecords} registro de adaptación en el reporte: eso es una brecha de cobertura, no adaptación cero.`,
      provenance: 'missing',
    },
  ];
}

export function residualView(portfolio, prepared, metrics) {
  const selected = new Set(portfolio.ids);
  const dimensionIds = [...new Set(prepared.map((measure) => measure.dimensionId))];
  const rows = dimensionIds.map((dimensionId) => {
    const addressed = prepared.some((measure) => selected.has(measure.id) && measure.dimensionId === dimensionId);
    const high = ['rionegro', 'guarne', 'marinilla'].flatMap((municipalityId) => {
      const row = metrics.find((item) => (
        item.municipality_id === municipalityId
        && item.dimension_id === dimensionId
        && item.metric === 'vulnerability'
        && item.scenario === 'reference'
        && item.value == null
        && item.classification
      ));
      if (!row || (row.classification !== 'alta' && row.classification !== 'muy_alta')) return [];
      return [{ municipalityId, classification: row.classification }];
    });
    return {
      dimensionId,
      addressed,
      high,
      statement: addressed
        ? 'El portafolio incluye una medida. La vulnerabilidad de la dimensión no se declara resuelta.'
        : high.length
          ? 'Queda al menos una clase Alta o Muy alta sin medida.'
          : 'No hay clase Alta o Muy alta en el corredor y tampoco hay medida seleccionada.',
    };
  });
  return {
    rows,
    reminder: 'Seleccionar una medida no equivale a un porcentaje de reducción de la vulnerabilidad.',
  };
}

export function nbsRollup(portfolio, prepared) {
  const selected = prepared.filter((measure) => portfolio.ids.includes(measure.id));
  const classes = ['NBS_DIRECT', 'NBS_HYBRID', 'ENABLING', 'GREY_INFRASTRUCTURE'];
  return classes.map((nbsClass) => {
    const items = selected.filter((measure) => measure.nbsClass === nbsClass);
    return {
      nbsClass,
      label: NBS_LABELS[nbsClass],
      count: items.length,
      investment: items.reduce((sum, measure) => sum + measure.cost, 0),
      dimensions: [...new Set(items.map((measure) => measure.dimensionId))],
    };
  });
}

export function stressNarrative(stress, prepared) {
  const label = STRESS_LABELS[stress.status];
  const entered = stress.entered.map((id) => prepared.find((measure) => measure.id === id)?.name ?? id);
  const exited = stress.exited.map((id) => prepared.find((measure) => measure.id === id)?.name ?? id);
  const riskClass = { baja: 'Bajo', media: 'Medio' };
  const shift = `El único cambio cuantificado es el riesgo de desastres de Rionegro: ${stress.shift.from_value} (${riskClass[stress.shift.from_class]}) hacia ${stress.shift.to_value} (${riskClass[stress.shift.to_class]}) en ${stress.shift.year}.`;
  let decision = 'El conjunto de medidas no cambia con ese escalón.';
  if (!stress.sameSet) {
    decision = `Entran: ${entered.join(', ') || 'ninguna'}. Salen: ${exited.join(', ') || 'ninguna'}.`;
  }
  return { label, shift, decision };
}

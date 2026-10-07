import { dimensionName } from './explanations.js';
import { copM, esNumber } from './format.js';

export const ROBUSTNESS_MEANING = 'Mayormente robusta significa que el conjunto permanece estable ante la evidencia de escenario disponible; no significa que todas las dimensiones tengan series SSP3-7.0.';

export function decisionRobustness(analysis) {
  const shift = analysis.stress.shift;
  const nearest = analysis.rejected[0] ?? null;
  const stable = [];
  const sensitive = [];
  if (analysis.stress.sameSet) {
    stable.push(`El cambio de riesgo documentado (${esNumber(shift.from_value, 2)} → ${esNumber(shift.to_value, 2)}) no cambia el conjunto.`);
  } else {
    sensitive.push('El conjunto cambia cuando se aplica el único cambio cuantificado de SSP3-7.0.');
  }
  sensitive.push(`La recurrencia en talleres municipales podría sumar entre 0 y ${esNumber(analysis.parameters.weights.workshops, 2)} por medida y no está observada.`);
  if (analysis.sensitivity.status === 'SENSITIVE_TO_MISSING_EVIDENCE') {
    sensitive.push('Si esa evidencia favorece a una alternativa y no al portafolio, el orden puede cambiar.');
  }
  if (nearest) {
    sensitive.push(nearest.gap == null
      ? `${nearest.name} no cabe en el fondo.`
      : `${nearest.name} queda a ${esNumber(nearest.gap, 4)} puntos del portafolio elegido.`);
  }
  const grey = analysis.baselines.grey;
  if (grey) {
    sensitive.push(`Exigir la infraestructura gris arma un portafolio de ${copM(grey.cost)} con puntaje ${esNumber(grey.institucional.objective, 4)}, frente a ${esNumber(analysis.portfolio.institucional.objective, 4)}.`);
  }
  return { stable, sensitive };
}

export function adaptivePathways(analysis) {
  // The measure with the largest contribution in each dimension (measures come sorted by contribution).
  const byDimension = new Map();
  analysis.portfolio.measures.forEach((measure) => {
    if (!byDimension.has(measure.dimensionId)) byDimension.set(measure.dimensionId, measure);
  });
  const rows = analysis.residual.rows
    .filter((row) => !row.addressed || row.high.length)
    .slice(0, 4)
    .map((row) => {
      const current = byDimension.get(row.dimensionId);
      const indicator = analysis.mea.indicators.find((item) => item.intervention_id === current?.id && item.indicator_type === 'producto');
      return {
        dimensionId: row.dimensionId,
        dimension: dimensionName(row.dimensionId),
        current: current ? current.name : 'Sin medida en el portafolio',
        monitor: indicator?.name ?? 'Indicador por definir',
        next: row.dimensionId === 'disaster'
          ? 'Reevaluar el SAT o la infraestructura resiliente'
          : row.dimensionId === 'infrastructure'
            ? 'Reevaluar la obra gris solo con un punto crítico caracterizado'
            : 'Reevaluar la siguiente medida de esta dimensión',
        threshold: 'Umbral por acordar con CORNARE',
      };
    });
  return rows;
}

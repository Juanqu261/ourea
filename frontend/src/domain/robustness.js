import { dimensionName } from './explanations.js';

export const ROBUSTNESS_MEANING = 'Mayormente robusta significa que el conjunto permanece estable ante la evidencia de escenario disponible; no significa que todas las dimensiones tengan series SSP3-7.0.';

export function decisionRobustness(analysis) {
  const shift = analysis.stress.shift;
  const nearest = analysis.rejected[0] ?? null;
  const stable = [];
  const sensitive = [];
  if (analysis.stress.sameSet) {
    stable.push(`Rionegro, riesgo de desastres: ${shift.from_value} → ${shift.to_value}. El conjunto se mantiene.`);
  } else {
    sensitive.push('El conjunto cambia cuando se aplica el único cambio cuantificado de SSP3-7.0.');
  }
  sensitive.push('Componente participativo: entre 0 y 0,15 por medida. No está observado.');
  if (analysis.sensitivity.status === 'SENSITIVE_TO_MISSING_EVIDENCE') {
    sensitive.push('Si la evidencia no observada favorece a una alternativa y no al portafolio, el orden puede cambiar.');
  }
  if (nearest) {
    sensitive.push(`${nearest.name} queda a ${nearest.gap == null ? 'un costo que no cabe' : nearest.gap.toFixed(3)} del puntaje verificado.`);
  }
  const grey = analysis.baselines.grey;
  if (grey) {
    sensitive.push(`Incluir la obra gris usa ${grey.cost.toLocaleString('es-CO')} millones y baja el puntaje verificado a ${grey.institucional.objective.toFixed(2)}.`);
  }
  return { stable, sensitive };
}

export function adaptivePathways(analysis) {
  const byDimension = new Map(analysis.portfolio.measures.map((measure) => [measure.dimensionId, measure]));
  const rows = analysis.residual.rows
    .filter((row) => !row.addressed || row.high.length)
    .slice(0, 4)
    .map((row) => {
      const current = byDimension.get(row.dimensionId);
      const indicator = analysis.mea.indicators.find((item) => item.intervention_id === current?.id);
      return {
        dimensionId: row.dimensionId,
        dimension: dimensionName(row.dimensionId),
        current: current ? current.name : 'Sin medida en el portafolio',
        monitor: indicator?.name ?? 'Seguimiento requerido',
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

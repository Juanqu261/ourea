import { searchWithUrgency } from './portfolioSearch.js';

export function stressStatus({ referenceIds, stressIds, evidencedDimensions, portfolioDimensions }) {
  if (!evidencedDimensions.length) return 'EVIDENCIA_INSUFICIENTE';
  const same = referenceIds.join('|') === stressIds.join('|');
  if (!same) return 'REQUIERE_AJUSTE';
  const fullyCovered = portfolioDimensions.every((dimensionId) => evidencedDimensions.includes(dimensionId));
  return fullyCovered ? 'ROBUSTA' : 'MAYORMENTE_ROBUSTA';
}

export function compareStress(reference, prepared, parameters) {
  const stressed = searchWithUrgency(prepared, parameters);
  const referenceIds = reference.ids;
  const stressIds = stressed.ids;
  const portfolioDimensions = [...new Set(
    referenceIds.map((id) => prepared.find((measure) => measure.id === id).dimensionId),
  )];
  const entered = stressIds.filter((id) => !referenceIds.includes(id));
  const exited = referenceIds.filter((id) => !stressIds.includes(id));
  const status = stressStatus({
    referenceIds,
    stressIds,
    evidencedDimensions: [parameters.ssp.dimension_id],
    portfolioDimensions,
  });
  return {
    status,
    portfolio: stressed,
    entered,
    exited,
    sameSet: entered.length === 0 && exited.length === 0,
    evidencedDimensions: [parameters.ssp.dimension_id],
    shift: parameters.ssp,
  };
}

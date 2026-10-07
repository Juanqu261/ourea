import { placementLabel } from './cornareModel.js';
import { dimensionName } from './explanations.js';

const CLOSE_COUNT = 3;

export function buildDecisionMatrix({ prepared, portfolio, rejected, explanations, mea, profiles }) {
  const selected = new Set(portfolio.ids);
  const partById = new Map(portfolio.institucional.parts.map((part) => [part.id, part]));
  const closeIds = new Set(rejected.slice(0, CLOSE_COUNT).map((item) => item.id));
  const rows = prepared.map((measure) => {
    const part = partById.get(measure.id);
    const place = placementLabel(measure, profiles);
    const rejection = rejected.find((item) => item.id === measure.id) ?? null;
    const indicator = (mea.indicators ?? []).find((item) => item.intervention_id === measure.id);
    const recurrenceWithheld = measure.recurrence.withheld;
    return {
      id: measure.id,
      name: measure.name,
      dimensionId: measure.dimensionId,
      dimension: dimensionName(measure.dimensionId),
      scope: place.localization,
      vulnerabilityClass: measure.classificationLabel,
      vulnerabilityComponent: part ? part.vulnerability : measure.vulnTerm,
      recurrence: {
        withheld: recurrenceWithheld,
        observed: recurrenceWithheld ? null : measure.recurrence.term,
        display: recurrenceWithheld ? 'Por integrar' : null,
        provenance: measure.recurrence.provenance,
      },
      workshop: {
        withheld: true,
        observed: null,
        display: 'Por integrar',
        min: 0,
        max: 0.15,
        provenance: 'missing',
      },
      cost: measure.cost,
      nbsClass: measure.nbsClass,
      verifiedScore: part ? part.contribution : null,
      cobenefit: {
        term: measure.cobenefit.term,
        appliedToInstitutionalScore: false,
        dimensions: measure.cobenefit.dimensions.map((item) => item.dimensionId),
      },
      scenario: measure.dimensionId === 'disaster'
        ? 'Rionegro cuantificado'
        : 'Integración requerida',
      decision: selected.has(measure.id)
        ? 'SELECTED'
        : closeIds.has(measure.id)
          ? 'CLOSE ALTERNATIVE'
          : 'NOT SELECTED',
      rejection: rejection && {
        gap: rejection.gap,
        cost: rejection.cost,
        lines: explanations[measure.id]?.lines ?? [],
      },
      explanation: explanations[measure.id]?.lines ?? [],
      qualitative: {
        readiness: null,
        evidence: recurrenceWithheld ? 'Recurrencia por integrar' : 'Recurrencia observada',
        spatial: place.localization,
        indicator: indicator?.name ?? null,
      },
    };
  });
  const order = { SELECTED: 0, 'CLOSE ALTERNATIVE': 1, 'NOT SELECTED': 2 };
  rows.sort((left, right) => {
    const rank = order[left.decision] - order[right.decision];
    if (rank !== 0) return rank;
    if (left.decision === 'SELECTED') return (right.verifiedScore ?? 0) - (left.verifiedScore ?? 0);
    return (left.rejection?.gap ?? 99) - (right.rejection?.gap ?? 99);
  });
  return {
    rows,
    weights: { vulnerability: 0.7, recurrence: 0.15, workshop: 0.15 },
    cobenefitInInstitutionalScore: false,
  };
}

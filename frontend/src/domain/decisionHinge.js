export const HINGE_THRESHOLDS = Object.freeze({
  verySensitive: 0.05,
  sensitive: 0.25,
  moderatelyStable: 1,
});

const BAND_LABEL = Object.freeze({
  VERY_SENSITIVE: 'VERY SENSITIVE',
  SENSITIVE: 'SENSITIVE',
  MODERATELY_STABLE: 'MODERATELY STABLE',
  STABLE: 'STABLE',
});

const BAND_INTERPRETATION = Object.freeze({
  VERY_SENSITIVE: 'Alternativa muy cercana',
  SENSITIVE: 'Sensible',
  MODERATELY_STABLE: 'Moderadamente estable',
  STABLE: 'Estable',
});

function formatDecimal(value, digits) {
  const [whole, fraction] = value.toFixed(digits).split('.');
  return `${whole},${fraction}`;
}

export function hingeBand(gap, participatoryRange) {
  const fraction = gap / participatoryRange;
  if (fraction <= HINGE_THRESHOLDS.verySensitive) return 'VERY_SENSITIVE';
  if (fraction <= HINGE_THRESHOLDS.sensitive) return 'SENSITIVE';
  if (fraction <= HINGE_THRESHOLDS.moderatelyStable) return 'MODERATELY_STABLE';
  return 'STABLE';
}

function criteriaFor(measure) {
  const criteria = [{
    id: 'workshop',
    label: 'Recurrencia participativa',
    range: null,
  }];
  if (measure?.recurrence?.withheld) {
    criteria.push({
      id: 'withheld_recurrence',
      label: 'Recurrencia de acciones no observada',
      range: null,
    });
  }
  return criteria;
}

export function decisionHinges({
  rejected,
  prepared,
  recommendedIds,
  participatoryRange = 0.15,
  limit = 3,
}) {
  const recommended = new Set(recommendedIds);
  const byId = new Map(prepared.map((measure) => [measure.id, measure]));
  return rejected
    .filter((item) => item.gap != null)
    .slice(0, limit)
    .map((item) => {
      const differing = (item.alternativeIds?.length ? item.alternativeIds : [item.id])
        .filter((id) => !recommended.has(id));
      const criteria = [];
      const seen = new Set();
      differing.forEach((id) => {
        criteriaFor(byId.get(id)).forEach((criterion) => {
          if (seen.has(criterion.id)) return;
          seen.add(criterion.id);
          criteria.push({ ...criterion, range: participatoryRange });
        });
      });
      if (!seen.has('workshop')) {
        criteria.unshift({
          id: 'workshop',
          label: 'Recurrencia participativa',
          range: participatoryRange,
        });
      }
      const band = hingeBand(item.gap, participatoryRange);
      const rangeFraction = item.gap / participatoryRange;
      const sentence = rangeFraction <= 1
        ? `Una diferencia equivalente al ${formatDecimal(rangeFraction * 100, 1)}% del rango total posible del componente participativo podría revertir este orden.`
        : 'La diferencia supera el rango total posible de un solo componente participativo. La diferencia ponderada mínima sigue siendo la brecha verificada y no se reparte entre criterios.';
      return {
        id: item.id,
        name: item.name,
        gap: item.gap,
        gapDisplay: formatDecimal(item.gap, 4),
        minimumWeightedDifference: item.gap,
        minimumDisplay: formatDecimal(item.gap, 4),
        participatoryRange,
        rangeFraction,
        band,
        label: BAND_LABEL[band],
        interpretation: BAND_INTERPRETATION[band],
        criteria,
        sentence,
        assignment: 'No se asigna la brecha a un criterio. Es la diferencia ponderada mínima que haría falta en la evidencia institucional aún no integrada.',
        thresholds: `Umbrales sobre el rango 0–${formatDecimal(participatoryRange, 2)} del componente participativo: muy sensible ≤ 5%, sensible ≤ 25%, moderadamente estable ≤ 100%, estable por encima.`,
      };
    });
}

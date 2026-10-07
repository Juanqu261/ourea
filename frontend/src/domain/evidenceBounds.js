const WORKSHOP_MAX = 0.15;
const RECURRENCE_MAX = 0.15;

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function verifiedTerm(measure, factor = 1) {
  const recurrence = measure.recurrence.withheld ? 0 : measure.recurrence.term;
  return factor * measure.vulnTerm + recurrence;
}

function unknownMax(measure) {
  const recurrence = measure.recurrence.withheld ? RECURRENCE_MAX : 0;
  return recurrence + WORKSHOP_MAX;
}

function scoreBounded(chosen, diminishing, unknownOf) {
  const groups = new Map();
  chosen.forEach((measure) => {
    if (!groups.has(measure.dimensionId)) groups.set(measure.dimensionId, []);
    groups.get(measure.dimensionId).push(measure);
  });
  let objective = 0;
  groups.forEach((items) => {
    const ordered = items.slice().sort((left, right) => (
      verifiedTerm(right) - verifiedTerm(left) || left.id.localeCompare(right.id)
    ));
    ordered.forEach((measure, index) => {
      const factor = index === 0 ? 1 : diminishing;
      objective += verifiedTerm(measure, factor) + unknownOf(measure);
    });
  });
  return round6(objective);
}

export function measureEvidence(measure) {
  const verified = round6(verifiedTerm(measure));
  const recurrenceUnknown = measure.recurrence.withheld;
  return {
    id: measure.id,
    verified,
    vulnerability: round6(measure.vulnTerm),
    recurrence: recurrenceUnknown ? null : round6(measure.recurrence.term),
    recurrenceWithheld: recurrenceUnknown,
    workshop: null,
    workshopWithheld: true,
    range: {
      min: verified,
      max: round6(verified + (recurrenceUnknown ? RECURRENCE_MAX : 0) + WORKSHOP_MAX),
    },
  };
}

export function assessMissingEvidence(prepared, parameters, selectedIds) {
  const diminishing = parameters.diminishing_second_measure.institucional;
  const selected = prepared.filter((measure) => selectedIds.includes(measure.id));
  const selectedMin = scoreBounded(selected, diminishing, () => 0);
  const budget = parameters.budget_million_cop;
  let flips = 0;
  let nearest = null;
  const count = prepared.length;
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
    if (overflow || !chosen.length) continue;
    const ids = chosen.map((measure) => measure.id).sort();
    if (ids.join('|') === selectedIds.slice().sort().join('|')) continue;
    const altMax = scoreBounded(chosen, diminishing, unknownMax);
    if (altMax > selectedMin) {
      flips += 1;
      const gap = round6(altMax - selectedMin);
      if (!nearest || gap < nearest.gap) nearest = { ids, cost, altMax, gap };
    }
  }
  return {
    status: flips > 0 ? 'SENSITIVE_TO_MISSING_EVIDENCE' : 'STABLE_TO_MISSING_EVIDENCE',
    label: flips > 0 ? 'Sensible a evidencia no observada' : 'Estable ante evidencia no observada',
    selectedMin,
    flips,
    nearest,
    note: 'Intervalo institucional, no una probabilidad. El componente participativo vale entre 0 y 0,15. La recurrencia no observada vale entre 0 y 0,15.',
    measures: prepared.map(measureEvidence),
  };
}

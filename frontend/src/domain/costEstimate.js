import { RWH_ASSUMPTIONS } from '../config/modelConfig.js';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const TYPE_LABEL = {
  rwh: 'Rainwater harvesting',
  drainage: 'Drainage upgrade',
  restoration: 'Restoration / bioengineering',
};

const FIELDWORK_ITEMS = Object.freeze([
  'Site visit',
  'Topographic and hydraulic survey',
  'Community co-design',
]);

const AFTER_SURVEY_ITEMS = Object.freeze([
  '30% design',
  'Procurement-ready bill of quantities',
]);

const FIELDWORK_DISPLAY = 'To be procured through a scoped preparation TOR or supplier quotations before fieldwork.';
const AFTER_SURVEY_DISPLAY = 'To be priced after the field survey defines the scope.';
const DRAINAGE_CONSOLIDATION_WARNING = 'Adjacent selected cells may represent one connected corridor. The current envelope counts them separately until the field survey establishes hydraulic continuity.';

export function formatUsd(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return USD.format(Number(value)).replace('$', 'US$');
}

export function roundUsd(value, step = 1000) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const size = Number(step) || 1000;
  return Math.round(Number(value) / size) * size;
}

export function formatUsdMillions(value) {
  const rounded = roundUsd(value);
  if (rounded == null) return '—';
  const millions = rounded / 1e6;
  const digits = millions >= 10 ? 1 : 2;
  return `US$${millions.toFixed(digits)} million`;
}

export function formatUsdMillionRange(low, high) {
  const lo = roundUsd(low);
  const hi = roundUsd(high);
  if (lo == null || hi == null) return '—';
  return `US$${(lo / 1e6).toFixed(2)}–${(hi / 1e6).toFixed(2)} million`;
}

export function rwhParticipatingSystems(buildings, share = RWH_ASSUMPTIONS.participationShare) {
  const count = Number(buildings) || 0;
  const participation = Number(share);
  if (!Number.isFinite(participation) || participation <= 0) return 0;
  return Math.max(1, Math.round(count * participation));
}

function band(low, base, high) {
  return { low, base, high };
}

function addBands(items) {
  return items.reduce(
    (sum, item) => band(sum.low + item.low, sum.base + item.base, sum.high + item.high),
    band(0, 0, 0),
  );
}

function scaleBand(unit, quantity) {
  return band(unit.low * quantity, unit.base * quantity, unit.high * quantity);
}

function present(value, step = 1000) {
  return {
    low: roundUsd(value.low, step),
    base: roundUsd(value.base, step),
    high: roundUsd(value.high, step),
  };
}

function cellProperties(cells, cellId) {
  const feature = (cells?.features ?? []).find(
    (item) => Number(item.properties?.cell_id) === Number(cellId),
  );
  return feature?.properties ?? {};
}

function ordered(value) {
  return value.low <= value.base && value.base <= value.high;
}

function formulaRange(quantity, unit, unitLabel) {
  return `${quantity} × ${formatUsd(unit.low)} / ${formatUsd(unit.base)} / ${formatUsd(unit.high)} ${unitLabel}`;
}

function drainageLine(projects, spec) {
  const packages = projects.length;
  const unit = spec.usd_per_package;
  const cost = scaleBand(unit, packages);
  const lengths = spec.length_m;
  return {
    type: 'drainage',
    label: TYPE_LABEL.drainage,
    component: 'construction',
    method: 'rom_package',
    assumedQuantity: packages,
    quantityUnit: spec.quantity_unit,
    quantityLabel: `${packages} selected planning-cell package${packages === 1 ? '' : 's'}; corridor consolidation not assessed.`,
    quantityNote: 'Conservative planning scenario: one ROM hillside corridor package per selected cell. This is not a bill of quantities. Adjacent cells may consolidate into one corridor after the survey; hydraulic topology determines the real package count.',
    formula: formulaRange(packages, unit, 'per ROM package'),
    unit: unit,
    includes: spec.includes,
    excludes: spec.excludes,
    priceDate: spec.price_date,
    confidence: spec.evidence_tier,
    low: cost.low,
    base: cost.base,
    high: cost.high,
    evidenceTier: spec.evidence_tier,
    sourceIds: spec.source_ids,
    lengthScenarios: lengths,
  };
}

function rwhLine(projects, cells, spec, participationShare) {
  const systems = projects.reduce((sum, project) => {
    const buildings = Number(cellProperties(cells, project.cell_id).buildings) || 0;
    return sum + rwhParticipatingSystems(buildings, participationShare);
  }, 0);
  const unit = spec.usd_per_system;
  const cost = scaleBand(unit, systems);
  return {
    type: 'rwh',
    label: TYPE_LABEL.rwh,
    component: 'equipment',
    method: 'unit_rate',
    assumedQuantity: systems,
    quantityUnit: spec.quantity_unit,
    quantityLabel: `${systems} participating system${systems === 1 ? '' : 's'}`,
    quantityNote: spec.evidence_label,
    formula: formulaRange(systems, unit, 'per system'),
    unit,
    includes: spec.includes,
    excludes: spec.excludes,
    priceDate: spec.price_date,
    confidence: spec.evidence_tier,
    ...cost,
    evidenceTier: spec.evidence_tier,
    sourceIds: spec.source_ids,
  };
}

function restorationLine(projects, spec) {
  const packages = projects.length;
  const unit = spec.usd_per_package;
  const cost = scaleBand(unit, packages);
  return {
    type: 'restoration',
    label: TYPE_LABEL.restoration,
    component: 'construction',
    method: 'rom_package',
    assumedQuantity: packages,
    quantityUnit: spec.quantity_unit,
    quantityLabel: `${packages} project-scale package${packages === 1 ? '' : 's'}`,
    quantityNote: spec.evidence_label,
    formula: formulaRange(packages, unit, 'per package'),
    unit,
    includes: spec.includes,
    excludes: spec.excludes,
    priceDate: spec.price_date,
    confidence: spec.evidence_tier,
    ...cost,
    evidenceTier: spec.evidence_tier,
    sourceIds: spec.source_ids,
  };
}

function costDriver(lines) {
  const drainage = lines.find((line) => line.type === 'drainage');
  if (drainage) {
    return 'Drainage ROM corridor packages from heterogeneous 2026 Medellín hydraulic comparators dominate capital uncertainty.';
  }
  if (lines.some((line) => line.type === 'restoration')) {
    return 'Restoration is a project-scale package with low evidence confidence because installed area is unknown.';
  }
  if (lines.some((line) => line.type === 'rwh')) {
    return 'Rainwater-harvesting system count follows the participation prior and a 2026-normalized procurement ceiling.';
  }
  return 'Quantity and evidence confidence still bound the envelope.';
}

function unpricedRow(label, stage) {
  const beforeFieldwork = stage === 'before_fieldwork';
  return {
    label,
    stage,
    status: beforeFieldwork ? 'to_be_procured_before_fieldwork' : 'to_be_priced_after_survey',
    display: beforeFieldwork ? FIELDWORK_DISPLAY : AFTER_SURVEY_DISPLAY,
  };
}

function preparationAsk() {
  return {
    status: 'unpriced_preparation',
    fieldwork: {
      status: 'to_be_procured_before_fieldwork',
      display: FIELDWORK_DISPLAY,
      items: FIELDWORK_ITEMS,
    },
    afterSurvey: {
      status: 'to_be_priced_after_survey',
      display: AFTER_SURVEY_DISPLAY,
      items: AFTER_SURVEY_ITEMS,
    },
    rows: [
      ...FIELDWORK_ITEMS.map((label) => unpricedRow(label, 'before_fieldwork')),
      ...AFTER_SURVEY_ITEMS.map((label) => unpricedRow(label, 'after_survey')),
    ],
  };
}

export function costSensitivity(estimate) {
  const total = estimate?.total;
  if (!total || !estimate.lines?.length) return [];
  return estimate.lines.map((line) => ({
    id: line.type,
    label: line.label,
    low: line.low,
    base: line.base,
    high: line.high,
    down: line.base - line.low,
    up: line.high - line.base,
  })).sort((a, b) => (b.down + b.up) - (a.down + a.up));
}

export function estimatePortfolioCost({
  portfolio = [],
  cells = null,
  costContext = null,
  participationShare = RWH_ASSUMPTIONS.participationShare,
} = {}) {
  const projects = Array.isArray(portfolio) ? portfolio : [];
  const unpriced = [];
  const lines = [];

  if (!costContext?.interventions) {
    return {
      complete: false,
      unpriced: projects.length ? ['cost_context'] : [],
      confidence: 'pre-feasibility',
      lines: [],
      total: null,
      display: null,
      immediateAsk: preparationAsk(),
    };
  }

  const grouped = {
    rwh: projects.filter((item) => item.type === 'rwh'),
    drainage: projects.filter((item) => item.type === 'drainage'),
    restoration: projects.filter((item) => item.type === 'restoration'),
  };
  const unknown = projects.filter((item) => !grouped[item.type]);
  if (unknown.length) unpriced.push(...unknown.map((item) => item.type));

  if (grouped.rwh.length) {
    const spec = costContext.interventions.rwh;
    if (!spec?.usd_per_system) unpriced.push('rwh');
    else lines.push(rwhLine(grouped.rwh, cells, spec, participationShare));
  }
  if (grouped.drainage.length) {
    const spec = costContext.interventions.drainage;
    if (!spec?.usd_per_package) unpriced.push('drainage');
    else lines.push(drainageLine(grouped.drainage, spec));
  }
  if (grouped.restoration.length) {
    const spec = costContext.interventions.restoration;
    if (!spec?.usd_per_package) unpriced.push('restoration');
    else lines.push(restorationLine(grouped.restoration, spec));
  }

  const complete = unpriced.length === 0 && (projects.length === 0 || lines.length > 0);
  const designGuidance = costContext.design_allowance ?? { low: 0.05, base: 0.075, high: 0.1 };
  const drainagePackages = grouped.drainage.length;
  const immediateAsk = {
    ...preparationAsk(),
    designShareGuidance: {
      low: designGuidance.low,
      base: designGuidance.base,
      high: designGuidance.high,
      basis: designGuidance.basis,
      source_id: designGuidance.source_id ?? designGuidance.id,
      note: 'IDB design-share guidance is a later pricing method, not a present lump-sum ask.',
    },
  };
  const drainageConsolidationWarning = drainagePackages > 1 ? DRAINAGE_CONSOLIDATION_WARNING : null;

  if (!complete) {
    return {
      complete: false,
      unpriced,
      confidence: 'pre-feasibility',
      lines: lines.map((line) => ({ ...line, display: present(line) })),
      total: null,
      display: null,
      priceDate: costContext.price_date ?? null,
      fx: costContext.fx ?? null,
      immediateAsk,
      drainageConsolidationWarning,
      implementationEnvelope: null,
    };
  }

  const construction = addBands(lines.filter((line) => line.component === 'construction'));
  const equipment = addBands(lines.filter((line) => line.component === 'equipment'));
  const total = addBands([construction, equipment]);
  const sourceIds = [...new Set(lines.flatMap((line) => line.sourceIds ?? []))];
  if (designGuidance.id || designGuidance.source_id) {
    sourceIds.push(designGuidance.source_id ?? designGuidance.id);
  }

  const result = {
    complete: true,
    unpriced: [],
    confidence: 'pre-feasibility',
    priceDate: costContext.price_date,
    fx: costContext.fx,
    designAllowance: designGuidance,
    lines: lines.map((line) => ({
      ...line,
      display: present(line, line.component === 'equipment' ? 10 : 1000),
    })),
    construction,
    equipment,
    total,
    display: {
      construction: present(construction),
      equipment: present(equipment, 10),
      total: present(total),
    },
    ordered: ordered(total),
    sourceIds,
    sources: (costContext.sources ?? []).filter((item) => sourceIds.includes(item.id)),
    costDriver: costDriver(lines),
    immediateAsk,
    drainageConsolidationWarning,
    implementationEnvelope: present(total),
    included: [
      'RWH tank packages at the planning participation prior',
      'drainage as ROM hillside corridor packages, not USD/m',
      'restoration as a project-scale package when selected',
    ].filter((item, index) => {
      if (index === 0) return grouped.rwh.length;
      if (index === 1) return grouped.drainage.length;
      return grouped.restoration.length;
    }),
    excluded: [
      'land acquisition',
      'construction supervision',
      'maintenance after handover',
      'an awarded Comuna 8 contract price',
      'surveyed corridor geometry',
      'a present 30% design fee',
      'taxes isolated from source budgets',
    ],
  };
  result.sensitivity = costSensitivity(result);
  return result;
}

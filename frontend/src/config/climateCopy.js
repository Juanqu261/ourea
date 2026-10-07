const PERCENTILE_PLAIN = Object.freeze({
  75: 'Common wet period',
  90: 'Unusually wet',
  99: 'Among the wettest observed',
});

const PRESET_SHORT = Object.freeze({
  typical_wet: 'Typical',
  high_rainfall: 'High',
  extreme_observed: 'Extreme',
  explore: 'Custom',
});

export function climatologyYears(climate) {
  const label = climate?.climatology_period?.label ?? climate?.climatology_period;
  if (!label) return '1991–2020';
  return String(label).replace('-', '–');
}

export function rainfallHeadline(climate) {
  return `Observed rainfall, ${climatologyYears(climate)}`;
}

export function rainfallChip(climate, scenario) {
  const presetLabel = PRESET_SHORT[scenario?.presetId] ?? 'Rainfall';
  return `${presetLabel} · ${climatologyYears(climate)}`;
}

export function presetShortLabel(preset) {
  return PRESET_SHORT[preset?.id] ?? String(preset?.label ?? 'Rainfall').split(' ')[0];
}

export function plainPresetCaption(preset) {
  const mm = Number(preset?.precipitation_mm);
  const days = Number(preset?.accumulation_window_days) || 15;
  const percentile = Number(preset?.percentile);
  const amount = Number.isFinite(mm) ? `${Math.round(mm)} mm / ${days} days` : `${days}-day rainfall`;
  const comparison = PERCENTILE_PLAIN[percentile] ?? 'Observed wet period';
  return `${amount} · ${comparison}`;
}

export function plainPresetLines(preset) {
  const mm = Number(preset?.precipitation_mm);
  const days = Number(preset?.accumulation_window_days) || 15;
  const percentile = Number(preset?.percentile);
  return {
    short: presetShortLabel(preset),
    amount: Number.isFinite(mm) ? `${Math.round(mm)} mm / ${days} days` : `${days}-day rainfall`,
    tone: PERCENTILE_PLAIN[percentile] ?? 'Observed wet period',
  };
}

export function plainClimateFacts(climate) {
  return [
    { label: 'What this is', value: 'Observed rainfall, not a forecast' },
    { label: 'Years used', value: climatologyYears(climate) },
    { label: 'Where', value: 'Focus planning area' },
    { label: 'Used for', value: 'Comparing typical, high and extreme wet conditions' },
  ];
}

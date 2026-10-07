// es-CO number formatting shared by every panel: 5.000 · 2,8125 · 14%.

export function esNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  // Drop float noise first, so 0,7 + 0,0375 shows as 0,738 like the stored 0,7375 does.
  const clean = Number(Math.abs(number).toFixed(10));
  const [integer, fraction] = clean.toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const negative = number < 0 && Number(clean.toFixed(decimals)) !== 0;
  return `${negative ? '−' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

export function esPct(share, decimals = 0) {
  if (share == null || Number.isNaN(Number(share))) return '—';
  return `${esNumber(Number(share) * 100, decimals)}%`;
}

export function copM(value) {
  return `COP ${esNumber(value)} M`;
}

// "1 registro", "3 registros".
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${esNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

// "a", "a y b", "a, b y c".
export function joinEs(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

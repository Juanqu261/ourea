#!/usr/bin/env node
/**
 * Generate CICSIC presentation figures from frozen red-team artifacts.
 * Does not redesign the app UI.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const figDir = join(root, 'docs', 'cicsic', 'figures');
mkdirSync(figDir, { recursive: true });

const bench = JSON.parse(
  readFileSync(join(root, 'data', 'derived', 'cicsic_redteam_benchmark.json'), 'utf8'),
);
const budget = JSON.parse(
  readFileSync(join(root, 'data', 'derived', 'cicsic_budget_sweep.json'), 'utf8'),
).budgetSweep;
const unc = JSON.parse(
  readFileSync(join(root, 'data', 'derived', 'cicsic_uncertainty_sweep.json'), 'utf8'),
).uncertaintySweep;
const sens = JSON.parse(
  readFileSync(join(root, 'data', 'derived', 'cicsic_sensitivity_interventions.json'), 'utf8'),
).interventionSensitivity;

function esc(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function barChart({ title, subtitle, rows, valueKey, labelKey, unit }) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey])), 1);
  const bars = rows
    .map((r) => {
      const v = Number(r[valueKey]);
      const w = Math.max(2, Math.round((v / max) * 420));
      return `<div class="row"><span class="lab">${esc(r[labelKey])}</span><span class="bar" style="width:${w}px"></span><span class="val">${v.toFixed(1)}</span></div>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
body{font-family:Georgia,serif;margin:32px;color:#1a1a1a;background:#f7f4ef}
h1{font-size:22px;margin:0 0 6px}p{margin:0 0 18px;color:#444;font-size:13px}
.row{display:flex;align-items:center;gap:10px;margin:8px 0}
.lab{width:170px;font-size:13px}.bar{height:16px;background:#2f5d50}.val{font-size:13px}
.note{margin-top:24px;font-size:11px;color:#666}
</style></head><body>
<h1>${esc(title)}</h1>
<p>${esc(subtitle)} · units: ${esc(unit)}</p>
${bars}
<p class="note">Planning-proxy benefit units (not physical flood-risk reduction). Source: cicsic_redteam_benchmark.json · commit ${esc(bench.git_commit ?? 'n/a')}</p>
</body></html>`;
}

function lineSvg({ title, subtitle, series, xKey, yKey, unit }) {
  const w = 640;
  const h = 320;
  const pad = 48;
  const xs = series.flatMap((s) => s.points.map((p) => p[xKey]));
  const ys = series.flatMap((s) => s.points.map((p) => p[yKey]));
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(0, ...ys);
  const ymax = Math.max(...ys);
  const sx = (x) => pad + ((x - xmin) / Math.max(1e-9, xmax - xmin)) * (w - 2 * pad);
  const sy = (y) => h - pad - ((y - ymin) / Math.max(1e-9, ymax - ymin)) * (h - 2 * pad);
  const colors = ['#2f5d50', '#8b4513', '#1f4e79', '#6b3a2a'];
  const paths = series
    .map((s, i) => {
      const d = s.points
        .map((p, j) => `${j ? 'L' : 'M'}${sx(p[xKey]).toFixed(1)},${sy(p[yKey]).toFixed(1)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2.5"/>`;
    })
    .join('\n');
  const legend = series
    .map((s, i) => `<span style="color:${colors[i % colors.length]};margin-right:12px">${esc(s.label)}</span>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>body{font-family:Georgia,serif;margin:32px;background:#f7f4ef;color:#1a1a1a}
h1{font-size:22px;margin:0 0 6px}p{color:#444;font-size:13px}.note{font-size:11px;color:#666}</style></head><body>
<h1>${esc(title)}</h1>
<p>${esc(subtitle)} · ${esc(unit)}</p>
<div>${legend}</div>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#333"/>
<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#333"/>
${paths}
</svg>
<p class="note">Planning-proxy units. Artifact-backed; not hydraulic risk reduction.</p>
</body></html>`;
}

// 1. P10 by strategy — reference
for (const city of bench.citySummaries) {
  const rows = Object.entries(city.strategies).map(([id, s]) => ({
    strategy: id,
    p10: s.p10.mean,
  }));
  writeFileSync(
    join(figDir, `p10_by_strategy_${city.city}.html`),
    barChart({
      title: `Mean P10 by strategy — ${city.city}`,
      subtitle: `budget=${city.budgetCredits}, trials=${city.trials}, base uncertainty`,
      rows,
      valueKey: 'p10',
      labelKey: 'strategy',
      unit: 'planning-benefit (P10)',
    }),
  );
}

// 2. Paired difference note (summary HTML)
{
  const rows = bench.citySummaries.map((c) => ({
    city: c.city,
    delta: c.primaryComparison.robust_minus_deterministic.absolute_mean,
  }));
  writeFileSync(
    join(figDir, 'robust_minus_deterministic_mean_delta.html'),
    barChart({
      title: 'Mean paired Δ P10 (robust − deterministic)',
      subtitle: `Reference config · rootSeed=${bench.protocol.rootSeed}`,
      rows,
      valueKey: 'delta',
      labelKey: 'city',
      unit: 'planning-benefit Δ',
    }),
  );
}

// 3. Budget vs P10
{
  const cities = [...new Set(budget.map((b) => b.city))];
  const series = cities.flatMap((city) => [
    {
      label: `${city} robust`,
      points: budget.filter((b) => b.city === city).map((b) => ({ x: b.budget, y: b.robust_mean_p10 })),
    },
    {
      label: `${city} deterministic`,
      points: budget
        .filter((b) => b.city === city)
        .map((b) => ({ x: b.budget, y: b.deterministic_mean_p10 })),
    },
  ]);
  writeFileSync(
    join(figDir, 'budget_vs_p10.html'),
    lineSvg({
      title: 'Budget vs mean P10',
      subtitle: 'Paired evaluation under base uncertainty',
      series,
      xKey: 'x',
      yKey: 'y',
      unit: 'planning-benefit (P10)',
    }),
  );
}

// 4. Uncertainty vs delta
{
  const series = [...new Set(unc.map((u) => u.city))].map((city) => ({
    label: city,
    points: unc
      .filter((u) => u.city === city)
      .map((u) => ({
        x: u.regime === 'low' ? 1 : u.regime === 'base' ? 2 : 3,
        y: u.delta_mean,
      })),
  }));
  writeFileSync(
    join(figDir, 'uncertainty_vs_delta.html'),
    lineSvg({
      title: 'Uncertainty regime vs robust−deterministic Δ P10',
      subtitle: 'x: 1=low, 2=base, 3=high',
      series,
      xKey: 'x',
      yKey: 'y',
      unit: 'planning-benefit Δ',
    }),
  );
}

// 5. Intervention mix under sensitivity
{
  const rows = sens.map((s) => ({
    label: `${s.city} ×${s.effectMultiplier}`,
    rwh: s.robust_typeCounts.rwh ?? 0,
  }));
  writeFileSync(
    join(figDir, 'intervention_mix_sensitivity.html'),
    barChart({
      title: 'Robust RWH count under effect multipliers',
      subtitle: 'Joint 0.8 / 1.0 / 1.2 effect-range scaling',
      rows,
      valueKey: 'rwh',
      labelKey: 'label',
      unit: 'project count (RWH)',
    }),
  );
}

// 6. Portability comparison
{
  const rows = bench.citySummaries.map((c) => {
    const pc = c.primaryComparison.robust_minus_deterministic;
    return {
      city: c.city,
      relPct: pc.relative_unsafe ? 0 : pc.relative_mean * 100,
    };
  });
  writeFileSync(
    join(figDir, 'portability_relative_p10.html'),
    barChart({
      title: 'Relative P10 lift vs deterministic (portability)',
      subtitle: 'Primary metric · reference configuration',
      rows,
      valueKey: 'relPct',
      labelKey: 'city',
      unit: '% (relative to deterministic mean P10)',
    }),
  );
}

writeFileSync(
  join(figDir, 'README.md'),
  `# CICSIC figures

Reproducible HTML charts from \`scripts/plot_cicsic_figures.mjs\`.

Regenerate after updating \`data/derived/cicsic_*.json\`:

\`\`\`bash
node scripts/plot_cicsic_figures.mjs
\`\`\`

All values are **planning-proxy benefit units**, not physical flood-risk reduction.
`,
);

console.log('Wrote figures to', figDir);

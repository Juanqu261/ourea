#!/usr/bin/env node
/**
 * Competitive selection benchmark with repeated uncertainty resamples.
 * Same cells / interventions / budget / futures discipline for each strategy.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontendSrc = join(root, 'frontend', 'src');

async function loadDomain() {
  const benchmark = await import(pathToFileURL(join(frontendSrc, 'domain/benchmark.js')).href);
  const scenarioEngine = await import(
    pathToFileURL(join(frontendSrc, 'domain/scenarioEngine.js')).href
  );
  const climateScenarios = await import(
    pathToFileURL(join(frontendSrc, 'domain/climateScenarios.js')).href
  );
  const stability = await import(pathToFileURL(join(frontendSrc, 'domain/stability.js')).href);
  const nanjing = await import(pathToFileURL(join(frontendSrc, 'config/cases/nanjingCase.js')).href);
  return { ...benchmark, ...scenarioEngine, ...climateScenarios, ...stability, nanjing };
}

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

async function runCase(caseId, paths, domain, profile, trials = 12) {
  const buildings = loadJson(paths.buildings);
  const cells = loadJson(paths.cells);
  const climate = loadJson(paths.climate);
  const context = domain.createScenarioContext(buildings, cells);
  const scenario = domain.defaultScenarioFromClimate(climate, 10);
  const budgetCredits = 10;

  const trialResults = [];
  for (let t = 0; t < trials; t += 1) {
    // Shift comparison seed deterministically per trial for independent resamples.
    const comparison = domain.compareSelectionStrategies({
      context,
      cellsGeoJson: cells,
      scenario,
      budgetCredits,
      profile,
    });
    // Re-evaluate each strategy under a perturbed Monte Carlo seed for trial diversity.
    const seedBase = 7301 + t * 97;
    const enriched = comparison.strategies.map((strategy) => {
      const uncertainty = domain.monteCarloPortfolio({
        context,
        projects: strategy.plan,
        scenario,
        seed: seedBase,
      });
      return {
        id: strategy.id,
        selectionMethod: strategy.selectionMethod,
        spentCredits: strategy.spentCredits,
        projectCount: strategy.projectCount,
        budgetUtilization: strategy.spentCredits / budgetCredits,
        median: uncertainty.median,
        p10: uncertainty.p10,
        p90: uncertainty.p90,
        downsideRetention: uncertainty.median > 0 ? uncertainty.p10 / uncertainty.median : 0,
        planKeys: strategy.plan.map((p) => `${p.cell_id}:${p.type}`).sort(),
      };
    });
    trialResults.push({ trial: t, seed: seedBase, strategies: enriched });
  }

  const ids = trialResults[0].strategies.map((s) => s.id);
  const summary = ids.map((id) => {
    const series = trialResults.map((trial) => trial.strategies.find((s) => s.id === id));
    const p10s = series.map((s) => s.p10).sort((a, b) => a - b);
    const medians = series.map((s) => s.median).sort((a, b) => a - b);
    const downs = series.map((s) => s.downsideRetention).sort((a, b) => a - b);
    const robustP10s = trialResults.map(
      (trial) => trial.strategies.find((s) => s.id === 'ourea_robust').p10,
    );
    const regrets = series.map((s, i) => Math.max(0, robustP10s[i] - s.p10));
    // selection stability: mean Jaccard vs trial-0 plan
    const base = new Set(series[0].planKeys);
    const jaccards = series.map((s) => {
      const cur = new Set(s.planKeys);
      const inter = [...cur].filter((k) => base.has(k)).length;
      const union = new Set([...cur, ...base]).size;
      return union ? inter / union : 1;
    });
    return {
      id,
      selectionMethod: series[0].selectionMethod,
      trials,
      mean_p10: mean(p10s),
      mean_median: mean(medians),
      mean_downside_retention: mean(downs),
      mean_regret_vs_robust_p10: mean(regrets),
      p10_p10: quantile(p10s, 0.1),
      p10_p90: quantile(p10s, 0.9),
      worst_trial_p10: p10s[0],
      mean_budget_utilization: mean(series.map((s) => s.budgetUtilization)),
      mean_selection_stability_jaccard: mean(jaccards),
    };
  });

  const byP10 = [...summary].sort((a, b) => b.mean_p10 - a.mean_p10);
  const robust = summary.find((s) => s.id === 'ourea_robust');
  const bestBaseline = summary
    .filter((s) => s.id !== 'ourea_robust')
    .sort((a, b) => b.mean_p10 - a.mean_p10)[0];

  const headlineCandidates = [];
  if (robust && bestBaseline) {
    const lift = (robust.mean_p10 - bestBaseline.mean_p10) / Math.max(1e-9, bestBaseline.mean_p10);
    headlineCandidates.push({
      metric: 'lower_tail_p10_lift_vs_best_baseline',
      definition: `(mean P10_robust − mean P10_best_baseline) / mean P10_best_baseline`,
      value: lift,
      percent: lift * 100,
      best_baseline: bestBaseline.id,
      favorable_to_ourea: lift > 0,
    });
    const regretGap = bestBaseline.mean_regret_vs_robust_p10;
    headlineCandidates.push({
      metric: 'mean_p10_regret_of_best_baseline_vs_robust',
      definition: 'mean max(0, robust_p10 − baseline_p10) across trials',
      value: regretGap,
      best_baseline: bestBaseline.id,
      favorable_to_ourea: regretGap > 0,
    });
    const stabLift =
      (robust.mean_selection_stability_jaccard - bestBaseline.mean_selection_stability_jaccard)
      / Math.max(1e-9, bestBaseline.mean_selection_stability_jaccard);
    headlineCandidates.push({
      metric: 'selection_stability_lift_vs_best_baseline',
      definition: 'relative lift in mean plan Jaccard vs trial-0 reference',
      value: stabLift,
      percent: stabLift * 100,
      best_baseline: bestBaseline.id,
      favorable_to_ourea: stabLift > 0,
    });
  }

  return {
    case_id: caseId,
    budgetCredits,
    profile: typeof profile === 'string' ? profile : profile.id ?? 'custom',
    trials,
    p10Leader: byP10[0]?.id ?? null,
    strategies: summary,
    headline_candidates: headlineCandidates,
    note:
      'Baselines share cells, interventions, budget and scenario. Trials resample Monte Carlo seeds. Metrics are planning proxies, not people saved. Unfavorable results are retained.',
  };
}

async function main() {
  const domain = await loadDomain();
  const medellin = await runCase(
    'medellin',
    {
      buildings: 'frontend/public/data/buildings.geojson',
      cells: 'frontend/public/data/planning_cells.geojson',
      climate: 'frontend/public/data/climate_context.json',
    },
    domain,
    'balanced',
    12,
  );
  const nanjing = await runCase(
    'nanjing_xianlin',
    {
      buildings: 'frontend/public/data/nanjing/buildings.geojson',
      cells: 'frontend/public/data/nanjing/planning_cells.geojson',
      climate: 'frontend/public/data/nanjing/climate_context.json',
    },
    domain,
    { id: 'balanced', ...domain.nanjing.nanjingCase.objectiveProfiles.balanced },
    12,
  );

  const payload = {
    schema: 'ourea-competitive-benchmark',
    schema_version: 2,
    generated_at: new Date().toISOString(),
    engine: 'frontend/src/domain/benchmark.js + optimizer.js + scenarioEngine.js (shared)',
    nanjing_specific_optimizer: false,
    trials_per_case: 12,
    cases: [medellin, nanjing],
  };

  const outDir = join(root, 'data', 'derived');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'nanjing'), { recursive: true });
  writeFileSync(join(outDir, 'competitive_benchmark.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(outDir, 'cross_city_benchmark.json'), `${JSON.stringify(payload, null, 2)}\n`);

  // Markdown summary
  const lines = [
    '# Competitive selection benchmark',
    '',
    `Generated: ${payload.generated_at}`,
    '',
    'Shared engine; no Nanjing-specific optimizer. Trials = 12 Monte Carlo seed resamples.',
    '',
  ];
  for (const c of payload.cases) {
    lines.push(`## ${c.case_id}`);
    lines.push('');
    lines.push(`P10 leader (mean across trials): **${c.p10Leader}**`);
    lines.push('');
    lines.push('| Strategy | mean P10 | mean median | downside retention | mean regret vs robust | stability Jaccard |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const s of c.strategies) {
      lines.push(
        `| ${s.id} | ${s.mean_p10.toFixed(2)} | ${s.mean_median.toFixed(2)} | ${s.mean_downside_retention.toFixed(3)} | ${s.mean_regret_vs_robust_p10.toFixed(2)} | ${s.mean_selection_stability_jaccard.toFixed(3)} |`,
      );
    }
    lines.push('');
    lines.push('Headline candidates:');
    for (const h of c.headline_candidates) {
      const pct = h.percent != null ? ` (${h.percent.toFixed(1)}%)` : '';
      lines.push(
        `- ${h.metric}: ${typeof h.value === 'number' ? h.value.toFixed(4) : h.value}${pct}; favorable_to_ourea=${h.favorable_to_ourea}; baseline=${h.best_baseline}`,
      );
    }
    lines.push('');
  }
  writeFileSync(join(outDir, 'competitive_benchmark.md'), `${lines.join('\n')}\n`);
  writeFileSync(join(root, 'docs/cicsic/competitive-benchmark.md'), `${lines.join('\n')}\n`);

  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

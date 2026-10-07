#!/usr/bin/env node
/**
 * CICSIC red-team paired benchmark suite.
 * Usage:
 *   node scripts/run_cicsic_redteam.mjs --mode smoke
 *   node scripts/run_cicsic_redteam.mjs --mode full
 *   node scripts/run_cicsic_redteam.mjs --mode smoke --city nanjing --trials 50
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontendSrc = join(root, 'frontend', 'src');
const outDir = join(root, 'data', 'derived');
const figDir = join(root, 'docs', 'cicsic', 'figures');

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'smoke' },
      trials: { type: 'string' },
      seed: { type: 'string' },
      budget: { type: 'string' },
      city: { type: 'string', default: 'both' },
      skipSweeps: { type: 'boolean', default: false },
    },
  });

  const rt = await import(pathToFileURL(join(frontendSrc, 'domain/redTeamBenchmark.js')).href);
  const scenarioEngine = await import(
    pathToFileURL(join(frontendSrc, 'domain/scenarioEngine.js')).href
  );
  const climateScenarios = await import(
    pathToFileURL(join(frontendSrc, 'domain/climateScenarios.js')).href
  );
  const { nanjingCase } = await import(
    pathToFileURL(join(frontendSrc, 'config/cases/nanjingCase.js')).href
  );
  const { INTERVENTIONS } = await import(
    pathToFileURL(join(frontendSrc, 'config/modelConfig.js')).href
  );
  const { withEffectRangeMultiplier } = await import(
    pathToFileURL(join(frontendSrc, 'domain/interventionModel.js')).href
  );

  const rootSeed = Number(values.seed ?? rt.REFERENCE_CONFIG.rootSeed);
  const mode = values.mode === 'full' ? 'full' : 'smoke';
  const defaultTrials = mode === 'full' ? rt.REFERENCE_CONFIG.trials : rt.REFERENCE_CONFIG.smokeTrials;
  const trials = Number(values.trials ?? defaultTrials);
  const refBudget = Number(values.budget ?? rt.REFERENCE_CONFIG.budgetCredits);
  const cityFilter = values.city;

  const cases = [
    {
      id: 'medellin',
      profile: 'balanced',
      buildings: 'frontend/public/data/buildings.geojson',
      cells: 'frontend/public/data/planning_cells.geojson',
      climate: 'frontend/public/data/climate_context.json',
    },
    {
      id: 'nanjing_xianlin',
      profile: { id: 'balanced', ...nanjingCase.objectiveProfiles.balanced },
      buildings: 'frontend/public/data/nanjing/buildings.geojson',
      cells: 'frontend/public/data/nanjing/planning_cells.geojson',
      climate: 'frontend/public/data/nanjing/climate_context.json',
    },
  ].filter((c) => cityFilter === 'both' || cityFilter === c.id || (cityFilter === 'nanjing' && c.id.startsWith('nanjing')));

  console.log(`Red-team mode=${mode} trials=${trials} seed=${rootSeed} cities=${cases.map((c) => c.id).join(',')}`);

  const trialRows = [];
  const citySummaries = [];

  for (const city of cases) {
    const buildings = loadJson(city.buildings);
    const cells = loadJson(city.cells);
    const climate = loadJson(city.climate);
    const context = scenarioEngine.createScenarioContext(buildings, cells);
    const scenario = climateScenarios.defaultScenarioFromClimate(climate, refBudget);

    const plans = rt.selectAllStrategyPlans({
      context,
      cellsGeoJson: cells,
      scenario,
      budgetCredits: refBudget,
      profile: city.profile,
      randomSeed: rootSeed,
    });

    const perStrategy = Object.fromEntries(
      Object.keys(plans).map((id) => [id, { p10: [], expected: [], median: [], downside: [] }]),
    );
    const pairedRobustMinusDet = [];
    const pairedRobustMinusDetExpected = [];

    for (let t = 0; t < trials; t += 1) {
      const evaluationSeed = rt.trialEvaluationSeed(rootSeed, t);
      const evaluated = rt.evaluatePlansPaired({
        context,
        scenario,
        plans,
        budgetCredits: refBudget,
        evaluationSeed,
        regime: rt.UNCERTAINTY_REGIMES.base,
      });
      for (const [id, row] of Object.entries(evaluated)) {
        perStrategy[id].p10.push(row.p10);
        perStrategy[id].expected.push(row.expectedBenefit);
        perStrategy[id].median.push(row.median);
        perStrategy[id].downside.push(row.downsideRetention);
        trialRows.push({
          city: city.id,
          trial: t,
          evaluationSeed,
          budget: refBudget,
          uncertainty: 'base',
          strategy: id,
          p10: row.p10,
          expectedBenefit: row.expectedBenefit,
          median: row.median,
          downsideRetention: row.downsideRetention,
          spentCredits: row.spentCredits,
          projectCount: row.projectCount,
          typeCounts: JSON.stringify(row.typeCounts),
        });
      }
      pairedRobustMinusDet.push(
        evaluated.ourea_robust.p10 - evaluated.deterministic_central.p10,
      );
      pairedRobustMinusDetExpected.push(
        evaluated.ourea_robust.expectedBenefit - evaluated.deterministic_central.expectedBenefit,
      );
    }

    const strategySummary = {};
    for (const [id, series] of Object.entries(perStrategy)) {
      strategySummary[id] = {
        p10: rt.summarizeNumeric(series.p10),
        expected: rt.summarizeNumeric(series.expected),
        median: rt.summarizeNumeric(series.median),
        downsideRetention: rt.summarizeNumeric(series.downside),
        plan: plans[id].plan,
        typeCounts: plans[id].plan.reduce((acc, p) => {
          acc[p.type] = (acc[p.type] ?? 0) + 1;
          return acc;
        }, {}),
        spentCredits: plans[id].spentCredits,
      };
    }

    const rel = rt.relativeDelta(
      strategySummary.ourea_robust.p10.mean,
      strategySummary.deterministic_central.p10.mean,
      1.0, // absolute P10 denominator floor for headline safety
    );
    const boot = rt.pairedBootstrapCI(pairedRobustMinusDet);
    const wel = rt.winEqualLoss(pairedRobustMinusDet);
    const bootExp = rt.pairedBootstrapCI(pairedRobustMinusDetExpected);

    citySummaries.push({
      city: city.id,
      budgetCredits: refBudget,
      uncertaintyRegime: 'base',
      trials,
      rootSeed,
      plansSelectedOnce: true,
      pairedEvaluation: true,
      strategies: strategySummary,
      primaryComparison: {
        metric: 'p10',
        robust_minus_deterministic: {
          absolute_mean: boot.mean,
          absolute_median: boot.median,
          ci95: boot.ci95,
          relative_mean: rel.relative,
          relative_unsafe: rel.unsafe_relative,
          relative_reason: rel.reason,
          winEqualLoss: wel,
        },
        expected_robust_minus_deterministic: {
          absolute_mean: bootExp.mean,
          ci95: bootExp.ci95,
        },
      },
      interventionUnitEconomics: rt.interventionUnitEconomics(cells),
      greedyDiagnosis: rt.diagnoseGreedyPlan(cells, refBudget),
    });
  }

  // --- Budget sweep (shared plans per budget; 100 paired eval trials) ---
  const budgetSweep = [];
  const sweepTrials = Math.min(trials, mode === 'full' ? 100 : 50);
  if (!values.skipSweeps) {
    for (const city of cases) {
      const buildings = loadJson(city.buildings);
      const cells = loadJson(city.cells);
      const climate = loadJson(city.climate);
      const context = scenarioEngine.createScenarioContext(buildings, cells);
      const scenario = climateScenarios.defaultScenarioFromClimate(climate, refBudget);
      for (const budget of rt.BUDGET_SWEEP) {
        const plans = rt.selectAllStrategyPlans({
          context,
          cellsGeoJson: cells,
          scenario,
          budgetCredits: budget,
          profile: city.profile,
          randomSeed: rootSeed,
        });
        const deltas = [];
        const robustP10 = [];
        const detP10 = [];
        for (let t = 0; t < sweepTrials; t += 1) {
          const evaluationSeed = rt.trialEvaluationSeed(rootSeed + 100000, t);
          const evaluated = rt.evaluatePlansPaired({
            context,
            scenario,
            plans,
            budgetCredits: budget,
            evaluationSeed,
            regime: rt.UNCERTAINTY_REGIMES.base,
          });
          robustP10.push(evaluated.ourea_robust.p10);
          detP10.push(evaluated.deterministic_central.p10);
          deltas.push(evaluated.ourea_robust.p10 - evaluated.deterministic_central.p10);
        }
        const rel = rt.relativeDelta(
          rt.summarizeNumeric(robustP10).mean,
          rt.summarizeNumeric(detP10).mean,
          1.0,
        );
        budgetSweep.push({
          city: city.id,
          budget,
          trials: sweepTrials,
          robust_mean_p10: rt.summarizeNumeric(robustP10).mean,
          deterministic_mean_p10: rt.summarizeNumeric(detP10).mean,
          greedy_mean_p10: null, // filled below with one paired pass mean via plans eval seed0
          delta_mean: rt.summarizeNumeric(deltas).mean,
          delta_ci95: rt.pairedBootstrapCI(deltas).ci95,
          relative: rel.relative,
          relative_unsafe: rel.unsafe_relative,
          winEqualLoss: rt.winEqualLoss(deltas),
          robust_typeCounts: plans.ourea_robust.plan.reduce((acc, p) => {
            acc[p.type] = (acc[p.type] ?? 0) + 1;
            return acc;
          }, {}),
          deterministic_typeCounts: plans.deterministic_central.plan.reduce((acc, p) => {
            acc[p.type] = (acc[p.type] ?? 0) + 1;
            return acc;
          }, {}),
        });
        // one-shot greedy/hazard means under seed 0 for composition context
        const snap = rt.evaluatePlansPaired({
          context,
          scenario,
          plans,
          budgetCredits: budget,
          evaluationSeed: rootSeed,
          regime: rt.UNCERTAINTY_REGIMES.base,
        });
        budgetSweep[budgetSweep.length - 1].greedy_mean_p10 = snap.greedy_opportunity.p10;
        budgetSweep[budgetSweep.length - 1].random_mean_p10 = snap.random_feasible.p10;
        budgetSweep[budgetSweep.length - 1].hazard_mean_p10 = snap.hazard_only.p10;
      }
    }
  }

  // --- Uncertainty sweep at budget 10 ---
  const uncertaintySweep = [];
  if (!values.skipSweeps) {
    for (const city of cases) {
      const buildings = loadJson(city.buildings);
      const cells = loadJson(city.cells);
      const climate = loadJson(city.climate);
      const context = scenarioEngine.createScenarioContext(buildings, cells);
      const scenario = climateScenarios.defaultScenarioFromClimate(climate, refBudget);
      const plans = rt.selectAllStrategyPlans({
        context,
        cellsGeoJson: cells,
        scenario,
        budgetCredits: refBudget,
        profile: city.profile,
        randomSeed: rootSeed,
      });
      for (const regime of Object.values(rt.UNCERTAINTY_REGIMES)) {
        const deltas = [];
        const robustP10 = [];
        const detP10 = [];
        const robustExp = [];
        const detExp = [];
        for (let t = 0; t < sweepTrials; t += 1) {
          const evaluationSeed = rt.trialEvaluationSeed(rootSeed + 200000, t);
          const evaluated = rt.evaluatePlansPaired({
            context,
            scenario,
            plans,
            budgetCredits: refBudget,
            evaluationSeed,
            regime,
          });
          robustP10.push(evaluated.ourea_robust.p10);
          detP10.push(evaluated.deterministic_central.p10);
          robustExp.push(evaluated.ourea_robust.expectedBenefit);
          detExp.push(evaluated.deterministic_central.expectedBenefit);
          deltas.push(evaluated.ourea_robust.p10 - evaluated.deterministic_central.p10);
        }
        uncertaintySweep.push({
          city: city.id,
          budget: refBudget,
          regime: regime.id,
          trials: sweepTrials,
          robust_mean_p10: rt.summarizeNumeric(robustP10).mean,
          deterministic_mean_p10: rt.summarizeNumeric(detP10).mean,
          robust_mean_expected: rt.summarizeNumeric(robustExp).mean,
          deterministic_mean_expected: rt.summarizeNumeric(detExp).mean,
          delta_mean: rt.summarizeNumeric(deltas).mean,
          delta_ci95: rt.pairedBootstrapCI(deltas).ci95,
          winEqualLoss: rt.winEqualLoss(deltas),
        });
      }
    }
  }

  // --- Intervention effect sensitivity (joint multipliers; canonical params untouched) ---
  const sensitivity = [];
  if (!values.skipSweeps) {
    for (const city of cases) {
      const buildings = loadJson(city.buildings);
      const cells = loadJson(city.cells);
      const climate = loadJson(city.climate);
      const context = scenarioEngine.createScenarioContext(buildings, cells);
      const scenario = climateScenarios.defaultScenarioFromClimate(climate, refBudget);
      for (const mult of [0.8, 1.0, 1.2]) {
        const row = withEffectRangeMultiplier(mult, () => {
          const plans = rt.selectAllStrategyPlans({
            context,
            cellsGeoJson: cells,
            scenario,
            budgetCredits: refBudget,
            profile: city.profile,
            randomSeed: rootSeed,
          });
          const deltas = [];
          const robustP10 = [];
          const detP10 = [];
          for (let t = 0; t < Math.min(sweepTrials, 50); t += 1) {
            const evaluationSeed = rt.trialEvaluationSeed(rootSeed + 300000, t);
            const evaluated = rt.evaluatePlansPaired({
              context,
              scenario,
              plans,
              budgetCredits: refBudget,
              evaluationSeed,
              regime: rt.UNCERTAINTY_REGIMES.base,
            });
            robustP10.push(evaluated.ourea_robust.p10);
            detP10.push(evaluated.deterministic_central.p10);
            deltas.push(evaluated.ourea_robust.p10 - evaluated.deterministic_central.p10);
          }
          return {
            city: city.id,
            effectMultiplier: mult,
            trials: Math.min(sweepTrials, 50),
            robust_plan: plans.ourea_robust.plan,
            robust_typeCounts: plans.ourea_robust.plan.reduce((acc, p) => {
              acc[p.type] = (acc[p.type] ?? 0) + 1;
              return acc;
            }, {}),
            deterministic_typeCounts: plans.deterministic_central.plan.reduce((acc, p) => {
              acc[p.type] = (acc[p.type] ?? 0) + 1;
              return acc;
            }, {}),
            robust_mean_p10: rt.summarizeNumeric(robustP10).mean,
            deterministic_mean_p10: rt.summarizeNumeric(detP10).mean,
            delta_mean_p10: rt.summarizeNumeric(deltas).mean,
            delta_ci95: rt.pairedBootstrapCI(deltas).ci95,
          };
        });
        sensitivity.push(row);
      }
    }
  }

  // Nanjing RWH dominance deeper audit using unit economics + selected plan
  const njSummary = citySummaries.find((c) => c.city === 'nanjing_xianlin');
  const rwhAudit = njSummary
    ? {
        selected_robust_plan: njSummary.strategies.ourea_robust.plan,
        typeCounts: njSummary.strategies.ourea_robust.typeCounts,
        unitEconomics: njSummary.interventionUnitEconomics,
        costStructure: Object.fromEntries(
          Object.entries(INTERVENTIONS).map(([k, v]) => [
            k,
            { costCredits: v.costCredits, effectRange: v.effectRange },
          ]),
        ),
        note:
          'RWH costCredits=1 allows up to 10 placements at budget 10; drainage=3, restoration=2. Mid-effect/credit favors cheaper actions unless high-opportunity drainage cells dominate robust marginal scores.',
      }
    : null;

  const payload = {
    schema: 'ourea-cicsic-redteam-benchmark',
    schema_version: 1,
    generated_at: new Date().toISOString(),
    git_commit: gitSha(),
    mode,
    protocol: {
      primaryMetric: rt.PRIMARY_METRIC,
      primaryBaseline: rt.PRIMARY_BASELINE,
      primaryStrategy: rt.PRIMARY_STRATEGY,
      pairedEvaluation: true,
      referenceBudget: refBudget,
      rootSeed,
      trials,
      bootstrapSamples: rt.REFERENCE_CONFIG.bootstrapSamples,
      bootstrapSeed: rt.REFERENCE_CONFIG.bootstrapSeed,
    },
    citySummaries,
    budgetSweep,
    uncertaintySweep,
    interventionSensitivity: sensitivity,
    nanjingRwhAudit: rwhAudit,
  };

  writeJson(join(outDir, 'cicsic_redteam_benchmark.json'), payload);
  writeJson(join(outDir, 'cicsic_budget_sweep.json'), { generated_at: payload.generated_at, budgetSweep });
  writeJson(join(outDir, 'cicsic_uncertainty_sweep.json'), {
    generated_at: payload.generated_at,
    uncertaintySweep,
  });
  writeJson(join(outDir, 'cicsic_sensitivity_interventions.json'), {
    generated_at: payload.generated_at,
    interventionSensitivity: sensitivity,
  });

  // CSV trials
  const headers = Object.keys(trialRows[0] ?? { city: 1 });
  const csv = [
    headers.join(','),
    ...trialRows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ].join('\n');
  writeText(join(outDir, 'cicsic_redteam_trials.csv'), csv);

  console.log('\n=== PRIMARY RESULTS ===');
  for (const c of citySummaries) {
    const pc = c.primaryComparison.robust_minus_deterministic;
    console.log(
      c.city,
      'robustP10',
      c.strategies.ourea_robust.p10.mean.toFixed(3),
      'detP10',
      c.strategies.deterministic_central.p10.mean.toFixed(3),
      'Δ',
      pc.absolute_mean.toFixed(3),
      'rel%',
      pc.relative_unsafe ? 'UNSAFE' : ((pc.relative_mean ?? 0) * 100).toFixed(2),
      'CI',
      pc.ci95.map((x) => x.toFixed(3)).join('..'),
      'winRate',
      (pc.winEqualLoss.winRate * 100).toFixed(1) + '%',
    );
  }
  console.log('Wrote', join(outDir, 'cicsic_redteam_benchmark.json'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

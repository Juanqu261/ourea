import scientificGuardrails from '../config/scientificGuardrails.json' with { type: 'json' };
import { BRAND } from '../config/brand.js';
import { MODEL_PARAMETERS } from '../config/modelConfig.js';
import { actionFootprint } from './actionFootprint.js';
import { climateSourceSummary } from './climateScenarios.js';
import { decisionFingerprint } from './fingerprint.js';
import { planCostCredits } from './optimizer.js';
import { policyConsensus } from './alternatives.js';
import { emptyCommunityAssessment } from './communitySafeguards.js';

export const DECISION_PACKAGE_SCHEMA = 'ourea-decision-package';
export const DECISION_PACKAGE_SCHEMA_VERSION = 2;
export const SCIENTIFIC_GUARDRAILS = Object.freeze([...scientificGuardrails.items]);

function portfolioSummary(option) {
  return {
    profile_id: option.profileId,
    profile_label: option.profile.label,
    policy_weights: {
      equity: option.profile.equityWeight,
      access: option.profile.accessWeight,
      downside_penalty: option.profile.downsidePenalty,
    },
    spent_credits: option.spentCredits,
    projects: option.plan.map((project) => ({
      cell_id: Number(project.cell_id),
      type: project.type,
    })),
    deterministic: {
      benefit_proxy: option.deterministic.benefit,
      equity_benefit_proxy: option.deterministic.equityBenefit,
      access_benefit_proxy: option.deterministic.accessBenefit,
    },
    uncertainty: {
      runs: option.uncertainty.runs,
      p10: option.uncertainty.p10,
      median: option.uncertainty.median,
      p90: option.uncertainty.p90,
      downside_retention: option.downsideRetention,
    },
  };
}

export function buildDecisionPackage({
  scenario,
  budgetCredits,
  view,
  cityLens,
  selectedAiProfileId,
  projects,
  metrics,
  baseline,
  monteCarlo,
  frontier,
  aiDiagnostics,
  alternatives,
  stability,
  pareto,
  summary,
  evidence,
  community,
  benchmark,
  breakage,
  planAlignment,
  climateContext,
  cells,
  city = null,
  country = null,
  caseRole = null,
  provingGround = null,
  caseId = null,
}) {
  const packageProjects = projects.map((project) => ({
    cell_id: Number(project.cell_id),
    type: project.type,
  }));
  const communityAssessment = community ?? emptyCommunityAssessment(packageProjects);

  return {
    schema: DECISION_PACKAGE_SCHEMA,
    schema_version: DECISION_PACKAGE_SCHEMA_VERSION,
    product: BRAND.name,
    product_expansion: BRAND.expansion,
    slogan: BRAND.slogan,
    generated_at: new Date().toISOString(),
    model_status: MODEL_PARAMETERS.status,
    uncertainty_seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
    scope: {
      city: city ?? 'Medellín',
      country: country ?? null,
      case_id: caseId ?? null,
      case_role: caseRole ?? null,
      proving_ground: provingGround ?? BRAND.provingGround,
      city_screen_lens: cityLens ?? null,
    },
    portfolio_mode: view,
    selected_ai_policy: selectedAiProfileId ?? null,
    scenario: {
      preset_id: scenario.presetId ?? null,
      rain_mm: Number(scenario.rainMm),
      accumulation_window_days: Number(scenario.climate?.accumulationWindowDays ?? 15),
      historical_percentile: scenario.climate?.percentile ?? null,
      antecedent_rainfall_percentile: Number(scenario.antecedentWetness),
      planning_year: Number(scenario.planningYear),
      climatology_period: scenario.climate?.climatologyPeriod
        ?? climateContext?.climatology_period?.label
        ?? null,
      source_name: scenario.climate?.sourceName ?? climateContext?.source_name ?? null,
      role: 'observed-or-explored-rainfall-context-and-restoration-maturity',
    },
    climate_context: climateSourceSummary(climateContext),
    budget: {
      unit: 'planning-credit-not-COP',
      available: Number(budgetCredits),
      spent: planCostCredits(packageProjects),
    },
    portfolio: packageProjects,
    action_footprint: actionFootprint({
      projects: packageProjects,
      cells,
      rainMm: Number(scenario.rainMm),
    }),
    sandbox_summary: summary,
    deterministic_metrics: metrics
      ? {
          baseline_exposure_index: metrics.baselineExposure,
          residual_exposure_index: metrics.residualExposure,
          benefit_proxy: metrics.benefit,
          equity_benefit_proxy: metrics.equityBenefit,
          access_benefit_proxy: metrics.accessBenefit,
          buildings_above_stress_threshold: metrics.buildingsAboveThreshold,
          population_proxy_above_stress_threshold: metrics.populationAboveThreshold,
        }
      : null,
    no_action_metrics: baseline
      ? {
          baseline_exposure_index: baseline.baselineExposure,
          buildings_above_stress_threshold: baseline.buildingsAboveThreshold,
          population_proxy_above_stress_threshold: baseline.populationAboveThreshold,
        }
      : null,
    uncertainty: monteCarlo
      ? {
          runs: monteCarlo.runs,
          benefit_proxy_p10: monteCarlo.p10,
          benefit_proxy_median: monteCarlo.median,
          benefit_proxy_p90: monteCarlo.p90,
          benefit_proxy_mean: monteCarlo.mean,
          downside_retention:
            monteCarlo.median > 0 ? monteCarlo.p10 / monteCarlo.median : 0,
        }
      : null,
    optimizer_diagnostics: aiDiagnostics,
    robust_policy_alternatives: alternatives?.map(portfolioSummary) ?? null,
    policy_consensus: alternatives?.length
      ? policyConsensus(alternatives).map((item) => ({
          cell_id: item.cell_id,
          type: item.type,
          selected_by_policies: item.policyCount,
          policy_share: item.policyShare,
          consensus_all_named_policies: item.consensus,
        }))
      : null,
    selection_stability: stability
      ? {
          policy_profile: stability.profileId,
          uncertainty_resamples: stability.runCount,
          scenario_samples_per_optimization: stability.scenarioSamplesPerOptimization,
          projects: stability.projects.map((project) => ({
            cell_id: project.cell_id,
            type: project.type,
            selections: project.selections,
            frequency: project.frequency,
          })),
          interpretation: stability.interpretation,
        }
      : null,
    budget_frontier:
      frontier?.map((point) => ({
        policy_profile: point.profileId,
        budget_credits: point.budgetCredits,
        spent_credits: point.spentCredits,
        projects: point.projectCount,
        benefit_proxy_p10: point.p10,
        benefit_proxy_median: point.median,
        benefit_proxy_p90: point.p90,
        downside_retention: point.downsideRetention,
      })) ?? null,
    sampled_multiobjective_tradeoffs: pareto
      ? {
          sampled_profiles: pareto.sampledProfiles,
          unique_portfolios: pareto.uniquePortfolios,
          note: pareto.note,
          non_dominated: pareto.frontier.map((item) => ({
            label: item.label,
            equity_weight: item.equityWeight,
            access_weight: item.accessWeight,
            spent_credits: item.spentCredits,
            robust_median_benefit_proxy: item.robustMedian,
            robust_p10_benefit_proxy: item.robustP10,
            robust_p90_benefit_proxy: item.robustP90,
            equity_benefit_proxy: item.equityBenefit,
            access_benefit_proxy: item.accessBenefit,
            projects: item.plan,
          })),
        }
      : null,
    evidence_status: evidence,
    community_safeguards: {
      validation_status: communityAssessment.validation_status,
      validation_label: communityAssessment.validation_label,
      file_status: communityAssessment.file_status,
      file_errors: communityAssessment.file_errors ?? [],
      not_assessed_count: communityAssessment.not_assessed_count,
      incomplete_count: communityAssessment.incomplete_count,
      documented_count: communityAssessment.documented_count,
      not_assessed_projects: communityAssessment.not_assessed_projects,
      safeguards_activated: communityAssessment.safeguards_activated,
      unresolved_concerns: communityAssessment.unresolved_concerns,
      records: communityAssessment.records,
      participatory_records: communityAssessment.participatory_records,
      session_history: communityAssessment.session_history ?? [],
      privacy_warning: communityAssessment.privacy_warning,
      provenance: {
        as_of: new Date().toISOString().slice(0, 10),
        file_status: communityAssessment.file_status,
        template_ignored: communityAssessment.template_ignored,
      },
      guardrail: communityAssessment.guardrail,
    },
    plan_alignment: planAlignment
      ? {
          status: planAlignment.status,
          geographic_scope: planAlignment.geographic_scope,
          guardrail: planAlignment.guardrail,
          entries: planAlignment.entries,
        }
      : null,
    selection_benchmark: benchmark ?? null,
    portfolio_breakage: breakage ?? null,
    schema_versions: {
      decision_package: DECISION_PACKAGE_SCHEMA_VERSION,
      climate_context: climateContext?.schema_version ?? null,
      plan_alignment: planAlignment?.schema_version ?? null,
      evidence_registry: evidence?.schema_version ?? null,
    },
    reproducible_id: decisionFingerprint({
      seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
      budget: Number(budgetCredits),
      profile: selectedAiProfileId ?? null,
      scenario: {
        presetId: scenario.presetId ?? null,
        rainMm: Number(scenario.rainMm),
        antecedentRainfallPercentile: Number(scenario.antecedentWetness),
        planningYear: Number(scenario.planningYear),
      },
      portfolio: packageProjects,
      climate: climateContext?.source_version ?? null,
      schema_version: DECISION_PACKAGE_SCHEMA_VERSION,
    }),
    guardrails: SCIENTIFIC_GUARDRAILS,
  };
}

export function downloadDecisionPackage(
  payload,
  filename = 'ourea_decision_package.json',
) {
  const blob = new Blob(
    [`${JSON.stringify(payload, null, 2)}\n`],
    { type: 'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

import { rainfallChip } from '../../config/climateCopy.js';
import { DECISION_ENGINE_COPY, PRIORITY_CARDS } from '../../config/uiCopy.js';
import { actionFootprint } from '../../domain/actionFootprint.js';
import { AiDecisionReviewCard } from '../../components/AiDecisionReviewCard.jsx';
import { Metric } from '../../components/Metric.jsx';
import { UncertaintyInterval } from '../../components/UncertaintyInterval.jsx';
import { SegmentedControl } from '../../components/SegmentedControl.jsx';
import { InfoTip } from '../../components/InfoTip.jsx';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

function robustnessCopy(benchmark) {
  const robust = benchmark?.strategies?.find((item) => item.id === 'ourea_robust');
  const hazard = benchmark?.strategies?.find((item) => item.id === 'hazard_only');
  const deterministic = benchmark?.strategies?.find((item) => item.id === 'deterministic');
  if (!robust || !hazard || !deterministic) {
    return 'Compare this plan with simpler alternatives under the same budget.';
  }
  if (robust.p10 >= hazard.p10 && robust.p10 >= deterministic.p10) {
    return 'Holds up better in difficult scenarios than hazard-only or one-scenario plans.';
  }
  return 'Compared with hazard-only and one-scenario plans under the same budget.';
}

export function ReviewStep({
  state,
  workspace,
  cells,
  climate,
  readiness,
  review,
  onCompare,
  onAdvanced,
  onRefresh,
  onBack,
  onContinue,
}) {
  const profile = PRIORITY_CARDS[state.profileId] ?? PRIORITY_CARDS.balanced;
  const footprint = actionFootprint({
    projects: workspace.activePlan,
    cells,
    rainMm: workspace.scenario?.rainMm,
  });
  const monteCarlo = workspace.monteCarlo;
  const metrics = workspace.metrics;
  const retention = monteCarlo?.median
    ? Math.round((monteCarlo.p10 / monteCarlo.median) * 100)
    : null;
  const combinationCount = workspace.breakage?.scenarioCombinationsBelowThreshold?.length
    ?? workspace.breakage?.breaches?.length
    ?? 0;
  const cellsTargeted = footprint.planning_cells_targeted;
  const compareOptions = [
    { id: 'none', label: 'Baseline', testId: 'view-none' },
    workspace.userPlan.length > 0
      ? { id: 'user', label: 'My plan', testId: 'view-user' }
      : null,
    workspace.aiPlan.length > 0
      ? { id: 'ai', label: 'With plan', testId: 'view-ai' }
      : null,
  ].filter(Boolean);

  return (
    <StepShell
      state={state}
      actions={(
        <FlowActions
          onBack={onBack}
          onContinue={onContinue}
          continueLabel="Continue to review"
          continueDisabled={state.recommendationStale || !workspace.activePlan.length}
          continueTestId="review-safeguards"
        />
      )}
    >
      {state.exampleBanner && (
        <p className="flow-banner" role="status" data-testid="example-banner">
          Example plan loaded
        </p>
      )}
      {state.recommendationStale ? (
        <div className="flow-banner warning" role="status" data-testid="stale-recommendation">
          <span>Update the plan after your latest changes</span>
          <button type="button" className="primary" data-testid="update-recommendation" onClick={onRefresh}>
            Update plan
          </button>
        </div>
      ) : (
        <div className="compare-stack">
          <div className="recommended-plan" data-testid="recommended-plan">
            <p className="recommended-kicker">Recommended plan</p>
            <p className="takeaway">
              Best under difficult scenarios within your {workspace.budgetCredits}-credit budget.
            </p>
            <div className="review-summary">
              <span><small>Priority</small><b>{profile.name}</b></span>
              <span><small>Budget</small><b>{workspace.budgetCredits} credits</b></span>
              <span><small>Projects</small><b>{workspace.activePlan.length}</b></span>
              <span><small>Areas</small><b>{cellsTargeted}</b></span>
            </div>
            {cellsTargeted > 0 ? (
              <p className="hint" data-testid="plan-area-summary">
                {cellsTargeted} planning {cellsTargeted === 1 ? 'cell' : 'cells'} in this plan
              </p>
            ) : null}
          </div>

          <section className="results-section" aria-label="Performance">
            <p className="area-section-label">Performance</p>
            <div className="review-outcome-grid" data-testid="review-outcome-grid">
              <div className="outcome-card">
                <small>Expected</small>
                <b>{metrics ? metrics.benefit.toFixed(1) : '—'}</b>
                <span>Typical performance</span>
              </div>
              <div className="outcome-card">
                <small>
                  Downside
                  <InfoTip label="P10">
                    Lower-tail planning benefit (P10). In 90% of modeled futures the plan retains at least this level.
                  </InfoTip>
                </small>
                <b>{monteCarlo ? monteCarlo.p10.toFixed(1) : '—'}</b>
                <span>Difficult scenarios · P10</span>
              </div>
              <div className="outcome-card">
                <small>Robustness</small>
                <b>{retention != null ? `${retention}%` : '—'}</b>
                <span>Holds up when assumptions change</span>
              </div>
            </div>
          </section>

          <div className="map-compare-block">
            <SegmentedControl
              className="map-compare"
              legend="Map view"
              value={workspace.view}
              onChange={onCompare}
              options={compareOptions}
            />
            <p className="hint map-compare-hint">Switch Baseline ↔ With plan on the map.</p>
          </div>

          <div className="scenario-compare">
            <p className="area-section-label">Scenario comparison</p>
            <div className="review-climate-chip" data-testid="climate-context-panel">
              {rainfallChip(climate, workspace.scenario)}
            </div>
            <p className="takeaway compact" data-testid="robustness-copy">{robustnessCopy(workspace.benchmark)}</p>
            {monteCarlo && (
              <UncertaintyInterval
                p10={monteCarlo.p10}
                median={monteCarlo.median}
                p90={monteCarlo.p90}
                runs={monteCarlo.runs}
              />
            )}
          </div>

          <details className="ux-details" data-testid="decision-engine">
            <summary>{DECISION_ENGINE_COPY.title}</summary>
            <ul>
              <li>{DECISION_ENGINE_COPY.eligibleCandidates} eligible candidates</li>
              <li>{DECISION_ENGINE_COPY.uncertaintyScenarios} uncertainty scenarios</li>
              <li>{DECISION_ENGINE_COPY.policyObjectives} policy objectives</li>
              <li>{DECISION_ENGINE_COPY.comparisonFutures} comparison futures</li>
            </ul>
          </details>

          <details className="ux-details" data-testid="action-footprint">
            <summary>Where the plan acts</summary>
            <p className="hint">
              Planning proxies for targeted cells — not people protected or avoided losses.
            </p>
            <div className="metric-group-grid">
              <Metric label="Planning cells" value={footprint.planning_cells_targeted.toLocaleString('en-US')} />
              <Metric label="Buildings in cells" value={footprint.cadastral_buildings_in_targeted_cells.toLocaleString('en-US')} />
              <Metric label="High-hazard buildings" value={footprint.high_hazard_buildings_in_targeted_cells.toLocaleString('en-US')} />
              <Metric
                label="Population proxy"
                value={`~${Math.round(footprint.population_proxy_in_targeted_cells).toLocaleString('en-US')}`}
              />
              {footprint.rwh_captured_volume_m3 > 0 && (
                <Metric label="RWH volume" value={`${footprint.rwh_captured_volume_m3.toFixed(0)} m³`} />
              )}
            </div>
          </details>

          {workspace.breakage && (
            <p className="hint" data-testid="breakage-combination-count">
              {combinationCount} scenario combinations fall below the threshold.
            </p>
          )}

          <button type="button" className="flow-tertiary" data-testid="open-advanced" onClick={onAdvanced}>
            Advanced analysis
          </button>

          {readiness && review && (
            <AiDecisionReviewCard readiness={readiness} review={review} />
          )}
        </div>
      )}
    </StepShell>
  );
}

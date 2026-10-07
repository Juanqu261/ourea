import { RWH_ASSUMPTIONS } from '../config/modelConfig.js';
import { frontierTakeaway } from '../config/uiCopy.js';
import { actionFootprint } from '../domain/actionFootprint.js';
import { BenchmarkPanel } from './BenchmarkPanel.jsx';
import { Metric, MetricGroup } from './Metric.jsx';
import { ParetoPanel } from './ParetoPanel.jsx';
import { SectionHeading } from './SectionHeading.jsx';
import { StabilityPanel } from './StabilityPanel.jsx';
import { TradeoffChart } from './TradeoffChart.jsx';
import { UncertaintyInterval } from './UncertaintyInterval.jsx';

export function DecisionAnalysis({
  baseline,
  metrics,
  monteCarlo,
  capturedVolumeM3,
  frontier,
  frontierBusy,
  frontierError,
  budgetCredits,
  onAnalyzeFrontier,
  onExport,
  canExport,
  stability,
  stabilityBusy,
  stabilityError,
  onAnalyzeStability,
  pareto,
  paretoBusy,
  paretoError,
  onAnalyzePareto,
  activePolicyLabel,
  benchmark,
  breakage,
  benchmarkBusy,
  benchmarkError,
  onAnalyzeBenchmark,
  cells,
  activePlan,
  rainMm,
}) {
  const takeaway = frontierTakeaway(frontier);
  const footprint = actionFootprint({
    projects: activePlan,
    cells,
    rainMm,
  });

  return (
    <section>
      <SectionHeading step={7} title="Understand trade-offs">
        Residual exposure, robust benefit, public-value proxies and sampled non-dominated portfolios.
      </SectionHeading>

      <div className="policy-context">
        <span>Active OUREA policy lens</span>
        <b>{activePolicyLabel ?? 'Generate options to compare'}</b>
      </div>

      <MetricGroup label="Risk / exposure">
        <Metric
          label="Baseline exposure index"
          value={baseline ? baseline.baselineExposure.toFixed(1) : '—'}
          hint="Planning index of hillside climate stress with no adaptation portfolio."
        />
        <Metric
          label="Residual exposure index"
          value={metrics ? metrics.residualExposure.toFixed(1) : '—'}
          hint="Same index after the active portfolio. Not landslide probability."
        />
      </MetricGroup>

      <MetricGroup label="Robust benefit">
        <Metric
          label="Expected benefit proxy"
          value={metrics ? metrics.benefit.toFixed(1) : '—'}
          hint="Reduction in the exposure index versus no action. A planning proxy, not avoided losses."
        />
        <Metric
          label="RWH captured volume"
          value={`${capturedVolumeM3.toFixed(0)} m³`}
          hint={`Roof footprint × ${RWH_ASSUMPTIONS.runoffCoefficient} runoff coefficient and planning storage/participation assumptions.`}
        />
      </MetricGroup>

      <MetricGroup label="Public value">
        <Metric
          label="Equity benefit proxy"
          value={metrics ? metrics.equityBenefit.toFixed(1) : '—'}
          hint="Benefit weighted toward stratum-1 exposure. Not people saved."
        />
        <Metric
          label="Access benefit proxy"
          value={metrics ? metrics.accessBenefit.toFixed(1) : '—'}
          hint="Benefit weighted toward mapped hillside access. Not an evacuation simulation."
        />
      </MetricGroup>

      <MetricGroup label="Action footprint">
        <div className="action-footprint" data-testid="action-footprint">
          <p>
            Where the selected portfolio concentrates action. These are targeted planning
            proxies, not people protected or avoided losses.
          </p>
          <div className="metric-group-grid">
            <Metric
              label="Planning cells targeted"
              value={footprint.planning_cells_targeted.toLocaleString()}
            />
            <Metric
              label="Cadastral buildings in targeted cells"
              value={footprint.cadastral_buildings_in_targeted_cells.toLocaleString()}
            />
            <Metric
              label="High-hazard buildings in targeted cells"
              value={footprint.high_hazard_buildings_in_targeted_cells.toLocaleString()}
            />
            <Metric
              label="Population proxy in targeted cells"
              value={`~${Math.round(footprint.population_proxy_in_targeted_cells).toLocaleString()}`}
            />
            <Metric
              label="Intervention families"
              value={footprint.intervention_families.join(', ') || '—'}
            />
            <Metric
              label="RWH captured volume"
              value={`${footprint.rwh_captured_volume_m3.toFixed(0)} m³`}
            />
          </div>
        </div>
      </MetricGroup>

      {monteCarlo ? (
        <UncertaintyInterval
          p10={monteCarlo.p10}
          median={monteCarlo.median}
          p90={monteCarlo.p90}
          runs={monteCarlo.runs}
        />
      ) : (
        <p className="hint">
          Select your plan or generate robust options to evaluate intervention-effect and
          climate-scenario uncertainty.
        </p>
      )}

      <div className="frontier-header">
        <div>
          <b>Budget robustness frontier</b>
          <span>How the active policy lens changes as the planning-credit budget grows.</span>
        </div>
        <button type="button" data-testid="analyze-frontier" onClick={onAnalyzeFrontier} disabled={frontierBusy}>
          {frontierBusy ? 'Analyzing…' : frontier?.length ? 'Recompute' : 'Analyze frontier'}
        </button>
      </div>

      {frontierError && (
        <div className="analysis-error" role="alert">
          Frontier analysis failed: {frontierError}
        </div>
      )}

      {frontier?.length > 0 && (
        <>
          <TradeoffChart frontier={frontier} activeBudget={budgetCredits} />
          {takeaway && <p className="takeaway">{takeaway}</p>}
          <div className="frontier-table">
            {frontier.map((point) => (
              <div
                key={point.budgetCredits}
                className={
                  Math.abs(point.budgetCredits - budgetCredits) < 0.5
                    ? 'frontier-row active'
                    : 'frontier-row'
                }
              >
                <b>{point.budgetCredits} cr</b>
                <span>{point.projectCount} projects</span>
                <span>median {point.median.toFixed(1)}</span>
                <span>P10 {point.p10.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <StabilityPanel
        stability={stability}
        busy={stabilityBusy}
        error={stabilityError}
        onAnalyze={onAnalyzeStability}
      />

      <ParetoPanel
        pareto={pareto}
        busy={paretoBusy}
        error={paretoError}
        onAnalyze={onAnalyzePareto}
      />

      <BenchmarkPanel
        benchmark={benchmark}
        breakage={breakage}
        busy={benchmarkBusy}
        error={benchmarkError}
        onAnalyze={onAnalyzeBenchmark}
      />

      <div className="export-row">
        <button type="button" className="primary" data-testid="export-package" onClick={onExport} disabled={!canExport}>
          Download PDF
        </button>
        <small>
          A formatted PDF proposal for the meeting: decision, map, implementation steps and crew notes.
        </small>
      </div>
    </section>
  );
}

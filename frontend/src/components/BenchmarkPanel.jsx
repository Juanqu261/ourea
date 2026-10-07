export function BenchmarkPanel({
  benchmark,
  breakage,
  busy,
  error,
  onAnalyze,
}) {
  const combinationCount = breakage?.scenarioCombinationsBelowThreshold?.length
    ?? breakage?.breaches?.length
    ?? 0;

  return (
    <div className="benchmark-box" data-testid="benchmark-panel">
      <div className="frontier-header benchmark-header">
        <div>
          <b>Selection benchmark</b>
          <span>
            Random feasible, greedy opportunity, hazard-only, deterministic central-scenario,
            and Ourea robust under the same budget and comparison seed. If a baseline wins a
            metric, that result is reported.
          </span>
        </div>
        <button
          type="button"
          className="benchmark-recompute"
          data-testid="analyze-benchmark"
          onClick={onAnalyze}
          disabled={busy}
        >
          {busy ? 'Comparing…' : benchmark ? 'Recompute' : 'Compare selection rules'}
        </button>
      </div>

      {error && (
        <div className="analysis-error" role="alert">
          Benchmark failed: {error}
        </div>
      )}

      {benchmark?.strategies && (
        <div className="frontier-table">
          {benchmark.strategies.map((item) => (
            <div key={item.id} className="frontier-row">
              <b>{item.id.replaceAll('_', ' ')}</b>
              <span>{item.budgetFeasible ? 'feasible' : 'over budget'}</span>
              <span>{item.projectCount} projects</span>
              <span>median {item.median.toFixed(1)}</span>
              <span>P10 {item.p10.toFixed(1)}</span>
              <span>P10 Δ {item.p10DeltaVersusRobust.toFixed(1)}</span>
              <span>P10 regret {item.p10RegretVersusRobust.toFixed(1)}</span>
              <span>overlap {Math.round(item.overlapWithRobust * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {breakage && (
        <div className="breakage-box" data-testid="breakage-panel">
          <b>What breaks this portfolio?</b>
          <span>
            One-at-a-time sensitivity on rainfall, antecedent rainfall, restoration maturity,
            effect range and cost uncertainty. Threshold is
            {` ${Math.round(breakage.thresholdRatio * 100)}% `}
            of the reference benefit proxy.
          </span>
          <span>
            {combinationCount} scenario combinations fall below the threshold.
          </span>
          {(breakage.oneAtATime ?? []).map((item) => (
            <span key={item.assumption}>
              {item.assumption.replaceAll('_', ' ')}
              {item.changesComposition
                ? ': changes portfolio composition'
                : ': changes results only'}
            </span>
          ))}
          <small>{breakage.note}</small>
        </div>
      )}
    </div>
  );
}

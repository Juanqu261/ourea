function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

function scale(value, [domainMin, domainMax], rangeMin, rangeMax) {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

export function ParetoPanel({
  pareto,
  busy,
  error,
  onAnalyze,
}) {
  const frontier = pareto?.frontier ?? [];
  const width = 330;
  const height = 220;
  const pad = { left: 48, right: 16, top: 22, bottom: 44 };

  const xDomain = frontier.length
    ? extent(frontier.map((item) => item.equityBenefit))
    : [0, 1];
  const yDomain = frontier.length
    ? extent(frontier.map((item) => item.accessBenefit))
    : [0, 1];
  const robustDomain = frontier.length
    ? extent(frontier.map((item) => item.robustMedian))
    : [0, 1];

  const x = (value) => scale(value, xDomain, pad.left, width - pad.right);
  const y = (value) => scale(value, yDomain, height - pad.bottom, pad.top);
  const radius = (value) => scale(value, robustDomain, 5, 11);

  return (
    <div className="pareto-box">
      <div className="frontier-header">
        <div>
          <b>Sampled multi-objective trade-offs</b>
          <span>Non-dominated portfolios among sampled policy weights.</span>
        </div>
        <button type="button" data-testid="analyze-pareto" onClick={onAnalyze} disabled={busy}>
          {busy ? 'Analyzing…' : pareto ? 'Recompute' : 'Analyze trade-offs'}
        </button>
      </div>

      {error && (
        <div className="analysis-error" role="alert">
          Trade-off analysis failed: {error}
        </div>
      )}

      {pareto && (
        <>
          <div className="pareto-summary">
            <span>{pareto.sampledProfiles} policy-weight samples</span>
            <span>{pareto.uniquePortfolios} unique portfolios</span>
            <span>{pareto.frontier.length} non-dominated</span>
          </div>
          <p className="hint">
            There is no single universal “best” portfolio. Point size is robust median benefit.
            This is a sampled non-dominated set, not a complete Pareto frontier.
          </p>

          {frontier.length > 0 && (
            <div className="pareto-chart-wrap">
              <svg
                className="pareto-chart"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Sampled non-dominated portfolio trade-offs. X: equity benefit proxy. Y: access benefit proxy. Point size: robust median."
              >
                <line
                  x1={pad.left}
                  y1={height - pad.bottom}
                  x2={width - pad.right}
                  y2={height - pad.bottom}
                  className="chart-axis"
                />
                <line
                  x1={pad.left}
                  y1={pad.top}
                  x2={pad.left}
                  y2={height - pad.bottom}
                  className="chart-axis"
                />

                {frontier.map((item) => (
                  <g key={item.id}>
                    <circle
                      cx={x(item.equityBenefit)}
                      cy={y(item.accessBenefit)}
                      r={radius(item.robustMedian)}
                      className="pareto-point"
                    />
                    <text
                      x={x(item.equityBenefit)}
                      y={y(item.accessBenefit) - radius(item.robustMedian) - 4}
                      textAnchor="middle"
                      className="chart-label"
                    >
                      {item.label}
                    </text>
                  </g>
                ))}

                <text
                  x={(pad.left + width - pad.right) / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="chart-title"
                >
                  Equity benefit proxy →
                </text>
                <text
                  transform={`translate(13 ${(pad.top + height - pad.bottom) / 2}) rotate(-90)`}
                  textAnchor="middle"
                  className="chart-title"
                >
                  Access benefit proxy →
                </text>
              </svg>

              <div className="pareto-list">
                {frontier.map((item) => (
                  <div className="pareto-row" key={item.id}>
                    <b>{item.label}</b>
                    <span>median {item.robustMedian.toFixed(1)}</span>
                    <span>equity {item.equityBenefit.toFixed(1)}</span>
                    <span>access {item.accessBenefit.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <small>
            {pareto.note} Axes are planning proxies, not calibrated welfare or accessibility units.
          </small>
        </>
      )}
    </div>
  );
}

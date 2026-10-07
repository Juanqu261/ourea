function scale(value, domainMin, domainMax, rangeMin, rangeMax) {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

export function TradeoffChart({ frontier, activeBudget }) {
  if (!frontier?.length) return null;

  const width = 330;
  const height = 170;
  const pad = { left: 40, right: 12, top: 14, bottom: 30 };
  const budgets = frontier.map((point) => point.budgetCredits);
  const lows = frontier.map((point) => point.p10);
  const highs = frontier.map((point) => point.p90);
  const xMin = Math.min(...budgets);
  const xMax = Math.max(...budgets);
  const yMin = Math.min(0, ...lows);
  const yMax = Math.max(...highs, 1);

  const x = (value) => scale(value, xMin, xMax, pad.left, width - pad.right);
  const y = (value) => scale(value, yMin, yMax, height - pad.bottom, pad.top);

  const medianPath = frontier
    .map((point, index) => `${index ? 'L' : 'M'} ${x(point.budgetCredits)} ${y(point.median)}`)
    .join(' ');

  return (
    <div className="frontier-chart-wrap">
      <svg
        className="frontier-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Budget robustness frontier showing P10, median and P90 benefit proxy"
      >
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} className="chart-axis" />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} className="chart-axis" />

        {[0, 0.5, 1].map((fraction) => {
          const value = yMin + fraction * (yMax - yMin);
          return (
            <g key={fraction}>
              <line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} className="chart-grid" />
              <text x={pad.left - 7} y={y(value) + 3} textAnchor="end" className="chart-label">
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {frontier.map((point) => {
          const isActive = Math.abs(point.budgetCredits - activeBudget) < 0.5;
          return (
            <g key={point.budgetCredits}>
              <line
                x1={x(point.budgetCredits)}
                x2={x(point.budgetCredits)}
                y1={y(point.p10)}
                y2={y(point.p90)}
                className="chart-whisker"
              />
              <circle
                cx={x(point.budgetCredits)}
                cy={y(point.median)}
                r={isActive ? 5 : 3.5}
                className={isActive ? 'chart-point active' : 'chart-point'}
              />
              <text x={x(point.budgetCredits)} y={height - 10} textAnchor="middle" className="chart-label">
                {point.budgetCredits}
              </text>
            </g>
          );
        })}

        <path d={medianPath} className="chart-line" />
        <text x={(pad.left + width - pad.right) / 2} y={height - 1} textAnchor="middle" className="chart-title">
          Planning credits →
        </text>
        <text
          transform={`translate(10 ${(pad.top + height - pad.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="chart-title"
        >
          Robust benefit proxy →
        </text>
      </svg>
      <div className="frontier-legend">
        <span><i className="dot median" /> median</span>
        <span><i className="whisker" /> P10–P90</span>
      </div>
    </div>
  );
}

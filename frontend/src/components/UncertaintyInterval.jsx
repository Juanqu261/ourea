export function UncertaintyInterval({ p10, median, p90, runs }) {
  const low = Number(p10);
  const mid = Number(median);
  const high = Number(p90);
  if (![low, mid, high].every(Number.isFinite)) return null;

  const min = Math.min(0, low);
  const max = Math.max(high, mid, 1);
  const span = max - min || 1;
  const left = ((low - min) / span) * 100;
  const width = ((high - low) / span) * 100;
  const medianLeft = ((mid - min) / span) * 100;
  const retention = mid > 0 ? Math.round((low / mid) * 100) : null;

  return (
    <div className="uncertainty-card">
      <div className="uncertainty-head">
        <span>Robust benefit under uncertainty</span>
        <b>{runs} common-random futures</b>
      </div>
      <div
        className="uncertainty-track"
        role="img"
        aria-label={`P10 ${low.toFixed(1)}, median ${mid.toFixed(1)}, P90 ${high.toFixed(1)}`}
      >
        <i className="uncertainty-range" style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }} />
        <i className="uncertainty-median" style={{ left: `${medianLeft}%` }} />
      </div>
      <div className="uncertainty-scale">
        <span><small>P10</small><b>{low.toFixed(1)}</b></span>
        <span><small>Median</small><b>{mid.toFixed(1)}</b></span>
        <span><small>P90</small><b>{high.toFixed(1)}</b></span>
      </div>
      {retention != null && (
        <div className="retention-row">
          <span>Downside retention</span>
          <b>{retention}%</b>
          <small>
            P10 ÷ median. Higher means less downside sensitivity within this uncertainty ensemble.
          </small>
        </div>
      )}
    </div>
  );
}

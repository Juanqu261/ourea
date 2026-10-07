import { INTERVENTIONS } from '../config/modelConfig.js';
import { STABILITY_BANDS, stabilityBand } from '../config/uiCopy.js';

export function StabilityPanel({
  stability,
  busy,
  error,
  onAnalyze,
}) {
  const top = stability?.projects?.slice(0, 8) ?? [];

  return (
    <div className="stability-box">
      <div className="frontier-header">
        <div>
          <b>Portfolio selection stability</b>
          <span>
            Which decisions keep coming back when climate and effect uncertainty is resampled?
          </span>
        </div>
        <button type="button" data-testid="analyze-stability" onClick={onAnalyze} disabled={busy}>
          {busy ? 'Analyzing…' : stability ? 'Recompute' : 'Analyze stability'}
        </button>
      </div>

      {error && (
        <div className="analysis-error" role="alert">
          Stability analysis failed: {error}
        </div>
      )}

      {stability && (
        <>
          <div className="stability-summary">
            <span>{stability.runCount} uncertainty resamples</span>
            <span>{stability.scenarioSamplesPerOptimization} optimizer samples each</span>
          </div>
          <div className="band-legend">
            <i className="band-high">High ≥ {Math.round(STABILITY_BANDS.high.min * 100)}%</i>
            <i className="band-moderate">Moderate ≥ {Math.round(STABILITY_BANDS.moderate.min * 100)}%</i>
            <i className="band-sensitive">Sensitive below that</i>
          </div>
          <div className="stability-list">
            {top.map((project) => {
              const config = INTERVENTIONS[project.type];
              const pct = Math.round(project.frequency * 100);
              const band = stabilityBand(project.frequency);
              return (
                <div
                  className={`stability-row band-${band}`}
                  key={`${project.cell_id}:${project.type}`}
                >
                  <div>
                    <b>{config?.short ?? project.type}</b>
                    <span>Cell {project.cell_id}</span>
                  </div>
                  <div className="stability-bar" aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <strong>
                    {project.selections}/{stability.runCount}
                    <span>{STABILITY_BANDS[band].label}</span>
                  </strong>
                </div>
              );
            })}
          </div>
          <small>
            Selection frequency measures decision stability under repeated development
            uncertainty draws, not the probability that a project is truly optimal.
          </small>
        </>
      )}
    </div>
  );
}

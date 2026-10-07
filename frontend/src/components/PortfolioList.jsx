import { INTERVENTIONS } from '../config/modelConfig.js';
import { stabilityBand } from '../config/uiCopy.js';

function diagnosticFor(project, diagnostics) {
  if (!diagnostics?.length) return null;
  return diagnostics.find(
    (item) =>
      Number(item.cell_id) === Number(project.cell_id) &&
      item.type === project.type,
  ) ?? null;
}

function stabilityFor(project, stability) {
  if (!stability?.projects?.length) return null;
  return stability.projects.find(
    (item) =>
      Number(item.cell_id) === Number(project.cell_id) &&
      item.type === project.type,
  ) ?? null;
}

function pct(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function equityChip(share) {
  const value = Number(share);
  if (value >= 0.6) return 'high equity exposure';
  if (value >= 0.3) return 'moderate equity exposure';
  return 'lower equity exposure';
}

function accessChip(index) {
  const value = Number(index);
  if (value >= 0.6) return 'high access relevance';
  if (value >= 0.3) return 'moderate access relevance';
  return 'lower access relevance';
}

export function PortfolioList({
  projects,
  title,
  empty = 'No projects selected',
  removable = false,
  onRemove,
  diagnostics = null,
  stability = null,
}) {
  if (!projects?.length) {
    return (
      <div className="portfolio-empty">
        <span>{title}</span>
        <b>{empty}</b>
      </div>
    );
  }

  return (
    <div className="portfolio-list">
      <div className="portfolio-list-head">
        <span>{title}</span>
        <b>{projects.length} project{projects.length === 1 ? '' : 's'}</b>
      </div>

      {projects.map((project) => {
        const config = INTERVENTIONS[project.type];
        const key = `${project.cell_id}:${project.type}`;
        const rationale = diagnosticFor(project, diagnostics);
        const stable = stabilityFor(project, stability);
        const band = stable ? stabilityBand(stable.frequency) : null;

        return (
          <div className="portfolio-row explainable" key={key}>
            <div className="portfolio-main">
              <b>{config?.label ?? project.type} · Cell {project.cell_id}</b>
              <span>
                {config?.costCredits ?? 0} planning credit
                {config?.costCredits === 1 ? '' : 's'}
                {stable && (
                  <>
                    {' · '}selected {stable.selections}/{stability.runCount} uncertainty resamples
                    {band ? ` · ${band === 'high' ? 'high stability' : band === 'moderate' ? 'moderate stability' : 'sensitive'}` : ''}
                  </>
                )}
              </span>

              {rationale && (
                <>
                  <div className="why-kicker">Why here?</div>
                  <div className="why-summary">
                    <i>{pct(rationale.opportunity)} opportunity</i>
                    <i>{equityChip(rationale.equityShare)}</i>
                    <i>{accessChip(rationale.accessIndex)}</i>
                    {stable && (
                      <i className={`stable-chip band-${band}`}>
                        {stable.selections}/{stability.runCount}
                      </i>
                    )}
                  </div>
                  <div className="robust-marginal">
                    <span>Robust marginal value</span>
                    <b>{rationale.marginalRobustValue.toFixed(1)}</b>
                  </div>
                </>
              )}

              {rationale && (
                <details className="project-explain">
                  <summary>What could change this recommendation?</summary>
                  <div className="explain-grid">
                    <span>
                      <small>Mean marginal benefit proxy</small>
                      <b>{rationale.meanMarginalBenefit.toFixed(1)}</b>
                    </span>
                    <span>
                      <small>P10 marginal benefit proxy</small>
                      <b>{rationale.p10MarginalBenefit.toFixed(1)}</b>
                    </span>
                    <span>
                      <small>Robust value / credit</small>
                      <b>{rationale.scorePerCredit.toFixed(1)}</b>
                    </span>
                    <span>
                      <small>Opportunity</small>
                      <b>{pct(rationale.opportunity)}</b>
                    </span>
                  </div>
                  <p>
                    This recommendation can change if the budget, rainfall ensemble,
                    intervention-effect distribution, public-policy weights or local cost
                    assumptions change. OUREA is decision support, not an autonomous selector.
                  </p>
                </details>
              )}
            </div>

            {removable && (
              <button
                type="button"
                className="icon-button"
                onClick={() => onRemove?.(project)}
                aria-label={`Remove ${config?.short ?? project.type} from cell ${project.cell_id}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

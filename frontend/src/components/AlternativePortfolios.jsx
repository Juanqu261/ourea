import { INTERVENTIONS } from '../config/modelConfig.js';
import { DECISION_ENGINE_COPY } from '../config/uiCopy.js';
import { policyConsensus } from '../domain/alternatives.js';

function score(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';
}

export function AlternativePortfolios({
  alternatives,
  selectedProfileId,
  busy,
  error,
  onGenerate,
  onSelect,
  showEngine = true,
  showGenerate = true,
}) {
  const consensus = policyConsensus(alternatives);
  const consensusCore = consensus.filter((item) => item.consensus);
  const recommendedId = alternatives?.length
    ? [...alternatives].sort(
        (a, b) =>
          b.uncertainty.p10 - a.uncertainty.p10 ||
          b.downsideRetention - a.downsideRetention,
      )[0]?.profileId
    : null;

  return (
    <div className="alternative-box">
      {showEngine && (
      <details className="ux-details" data-testid="decision-engine">
        <summary>{DECISION_ENGINE_COPY.title}</summary>
        <ul>
          <li>{DECISION_ENGINE_COPY.eligibleCandidates} eligible candidates</li>
          <li>{DECISION_ENGINE_COPY.uncertaintyScenarios} uncertainty scenarios</li>
          <li>{DECISION_ENGINE_COPY.policyObjectives} policy objectives</li>
          <li>{DECISION_ENGINE_COPY.comparisonFutures} comparison futures</li>
        </ul>
        <p>{DECISION_ENGINE_COPY.explanation}</p>
        <small>{DECISION_ENGINE_COPY.milpNote}</small>
      </details>
      )}

      <section className="advanced-section" aria-labelledby="compare-plans-heading">
        <div className="alternative-head">
          <div>
            <b id="compare-plans-heading">Compare plans</b>
            <span>Same data and budget — different priorities.</span>
          </div>
          {showGenerate && (
          <button type="button" onClick={onGenerate} className="primary" disabled={busy} data-testid="generate-alternatives">
            {busy
              ? 'Generating…'
              : alternatives?.length
                ? 'Regenerate options'
                : 'Generate robust options'}
          </button>
          )}
        </div>

        {error && (
          <div className="analysis-error" role="alert">
            Alternative portfolio generation failed: {error}
          </div>
        )}

        {!alternatives?.length && !busy && !error && (
          <p className="empty-note">
            Generate robust options to compare Balanced, Equity-first, Access-first and Low-regret
            portfolios.
          </p>
        )}

        {alternatives?.length > 0 && (
          <div className="alternative-grid">
            {alternatives.map((option) => {
              const active = option.profileId === selectedProfileId;
              const highestP10 = option.profileId === recommendedId;
              const classes = ['alternative-card'];
              if (active) classes.push('active');
              if (highestP10) classes.push('is-best');
              return (
                <button
                  key={option.profileId}
                  type="button"
                  className={classes.join(' ')}
                  data-testid={`select-profile-${option.profileId}`}
                  onClick={() => onSelect(option.profileId)}
                  aria-pressed={active}
                >
                  <div className="alternative-title">
                    <b>{option.profile.label}</b>
                    <div className="alternative-title-meta">
                      {highestP10 && <em>Best downside</em>}
                      <i>{option.spentCredits} cr</i>
                    </div>
                  </div>
                  <span className="alternative-desc">{option.profile.description}</span>
                  <div className="alternative-stats">
                    <small>
                      <b>{option.plan.length}</b>
                      projects
                    </small>
                    <small>
                      <b>{score(option.uncertainty.p10)}</b>
                      P10
                    </small>
                    <small>
                      <b>{score(option.uncertainty.median)}</b>
                      median
                    </small>
                    <small>
                      <b>{score(option.deterministic.equityBenefit)}</b>
                      equity proxy
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {consensus.length > 0 && (
        <section className="policy-consensus" aria-label="Policy consensus">
          <p className="area-section-label">Policy consensus</p>
          <p className="policy-consensus-lead">
            {consensusCore.length} project{consensusCore.length === 1 ? '' : 's'} selected by all {alternatives.length} lenses
          </p>
          <div className="policy-consensus-list">
            {consensus.slice(0, 6).map((item) => (
              <i key={`${item.cell_id}:${item.type}`} className={item.consensus ? 'core' : ''}>
                {INTERVENTIONS[item.type]?.short ?? item.type} · cell {item.cell_id} · {item.policyCount}/{alternatives.length}
              </i>
            ))}
          </div>
        </section>
      )}

      <details className="ux-details alternative-method-note">
        <summary>Method note</summary>
        <p>
          “Highest P10 in current ensemble” means strongest lower-tail benefit proxy in this
          current ensemble, not universal optimality. Policy weights remain explicit settings and
          should be co-designed with decision-makers.
        </p>
      </details>
    </div>
  );
}

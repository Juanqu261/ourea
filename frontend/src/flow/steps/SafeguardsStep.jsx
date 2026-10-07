import { useState } from 'react';
import { EVIDENCE_GROUPS } from '../../config/uiCopy.js';
import { COMMUNITY_COPY } from '../../config/communityEvidence.js';
import { INTERVENTIONS } from '../../config/modelConfig.js';
import { AiDecisionReviewSummary } from '../../components/AiDecisionReviewCard.jsx';
import { CellPlaceLinks } from '../../components/CellPlaceLinks.jsx';
import { HillsideMechanismAnimation } from '../../components/HillsideMechanismAnimation.jsx';
import { EvidenceIcon, CommunityIcon, AlignmentIcon, DownloadIcon } from '../../components/FlowIcons.jsx';
import { featureLngLat } from '../../domain/placeLinks.js';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

const DEFAULT_CELL_ROWS = 3;

function communityHeadline(status) {
  if (status === 'community_reviewed') return 'Community review recorded';
  if (status === 'requires_deliberation') return 'Requires deliberation';
  if (status === 'invalid') return 'Invalid evidence';
  return 'Not assessed';
}

export function SafeguardsStep({
  state,
  evidence,
  communityAssessment,
  planAlignment,
  projects,
  cells,
  canExport,
  readiness,
  review,
  onEvidence,
  onCommunity,
  onAlignment,
  onExport,
  onBack,
  onSelectCell,
}) {
  const [showAllCells, setShowAllCells] = useState(false);
  const grouped = EVIDENCE_GROUPS.map((group) => ({
    ...group,
    count: group.ids.filter((id) => (evidence?.layers ?? []).some((layer) => layer.id === id)).length,
  }));
  const families = [...new Set((planAlignment?.entries ?? []).map((entry) => entry.intervention_type).filter(Boolean))];
  const projectList = projects ?? [];
  const visibleProjects = showAllCells ? projectList : projectList.slice(0, DEFAULT_CELL_ROWS);

  return (
    <StepShell
      state={state}
      actions={(
        <FlowActions
          backLabel="Back to review"
          onBack={onBack}
          onContinue={onExport}
          continueLabel="Download PDF"
          continueDisabled={!canExport}
          continueTestId="export-package"
        />
      )}
    >
      <div className="review-stack">
        <p className="flow-banner" data-testid="package-ready">Ready for discussion</p>
        <AiDecisionReviewSummary readiness={readiness} review={review} />
        <p className="hint">
          <span className="label-with-icon"><DownloadIcon /> Download a PDF briefing for the meeting.</span>
        </p>

        <HillsideMechanismAnimation />

        {projectList.length > 0 && (
          <section className="cell-place-section" data-testid="cell-place-list">
            <p className="area-section-label">Recommended locations</p>
            <b>Open a recommended cell</b>
            <span>See it on this map, or open the same square in Google Maps or Google Earth.</span>
            <ul className="cell-place-list">
              {visibleProjects.map((project) => {
                const feature = (cells?.features ?? []).find(
                  (item) => Number(item.properties.cell_id) === Number(project.cell_id),
                );
                const centroid = featureLngLat(feature);
                return (
                  <li key={`${project.cell_id}:${project.type}`}>
                    <strong>Cell {project.cell_id}</strong>
                    <span>{INTERVENTIONS[project.type]?.label ?? project.type}</span>
                    <CellPlaceLinks
                      lat={centroid?.[1]}
                      lng={centroid?.[0]}
                      onSeeOnMap={() => onSelectCell?.(Number(project.cell_id))}
                    />
                  </li>
                );
              })}
            </ul>
            {projectList.length > DEFAULT_CELL_ROWS ? (
              <button
                type="button"
                className="area-show-more"
                data-testid="show-all-cells"
                onClick={() => setShowAllCells((value) => !value)}
              >
                {showAllCells
                  ? 'Show fewer cells'
                  : `Show all ${projectList.length} recommended cells`}
              </button>
            ) : null}
          </section>
        )}

        <div className="support-stack">
          <p className="area-section-label">Supporting evidence</p>
          <article className="support-card" data-testid="support-card-evidence">
            <header className="support-card-head">
              <span className="support-card-icon" aria-hidden="true"><EvidenceIcon /></span>
              <b>Evidence</b>
            </header>
            <div className="support-card-body">
              <span>
                {grouped.find((item) => item.id === 'observed')?.count ?? 0} observed/official ·{' '}
                {grouped.find((item) => item.id === 'proxies')?.count ?? 0} proxies ·{' '}
                {grouped.find((item) => item.id === 'priors')?.count ?? 0} priors
              </span>
              <button type="button" className="flow-tertiary" data-testid="view-evidence" onClick={onEvidence}>
                View evidence and methods
              </button>
            </div>
          </article>

          <article className="support-card" data-testid="support-card-community">
            <header className="support-card-head">
              <span className="support-card-icon" aria-hidden="true"><CommunityIcon /></span>
              <b>Community review</b>
            </header>
            <div className="support-card-body">
              <span data-testid="community-headline" data-status={communityAssessment?.validation_status}>
                {communityHeadline(communityAssessment?.validation_status)}
              </span>
              <small>{COMMUNITY_COPY.incomplete}</small>
              <button type="button" className="flow-tertiary" data-testid="record-community" onClick={onCommunity}>
                Record community evidence
              </button>
            </div>
          </article>

          <article className="support-card" data-testid="support-card-alignment">
            <header className="support-card-head">
              <span className="support-card-icon" aria-hidden="true"><AlignmentIcon /></span>
              <b>Local alignment</b>
            </header>
            <div className="support-card-body">
              <span>
                {planAlignment?.entries?.length ?? 0} references · {families.join(', ') || 'documented families'}
              </span>
              <small>{planAlignment?.geographic_scope}</small>
              <button type="button" className="flow-tertiary" data-testid="view-alignment" onClick={onAlignment}>
                View local evidence
              </button>
            </div>
          </article>
        </div>
      </div>
    </StepShell>
  );
}

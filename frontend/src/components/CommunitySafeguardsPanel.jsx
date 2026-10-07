import { useMemo, useState } from 'react';
import {
  COMMUNITY_COPY,
  COMMUNITY_FIELD_OPTIONS,
} from '../config/communityEvidence.js';
import { SelectField } from './SelectField.jsx';
import { TextField } from './TextField.jsx';
import { SectionHeading } from './SectionHeading.jsx';

const FIELD_LABELS = {
  consultation_status: 'Consultation',
  community_position: 'Community position',
  livelihood_disruption: 'Livelihood disruption',
  maintenance_capacity: 'Maintenance capacity',
  displacement_risk: 'Displacement risk',
  accessibility_concern: 'Accessibility concern',
  evidence_type: 'Evidence type',
};

function labelize(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

export function CommunitySafeguardsPanel({
  assessment,
  activePlan,
  onRecord,
}) {
  const projects = activePlan ?? [];
  const [draft, setDraft] = useState({
    cell_id: '',
    intervention_type: '',
    consultation_status: 'in_progress',
    community_position: 'unknown',
    livelihood_disruption: 'unknown',
    maintenance_capacity: 'unknown',
    displacement_risk: 'unknown',
    accessibility_concern: 'unknown',
    evidence_type: 'participatory_input',
    source: COMMUNITY_COPY.participatoryLabel,
    as_of: new Date().toISOString().slice(0, 10),
    process_reference: '',
    notes: '',
  });

  const selectedOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: `${project.cell_id}:${project.type}`,
        label: `Cell ${project.cell_id} · ${project.type}`,
        cell_id: project.cell_id,
        type: project.type,
      })),
    [projects],
  );

  function submitRecord(event) {
    event.preventDefault();
    if (draft.cell_id === '' || !draft.intervention_type) return;
    onRecord?.({
      ...draft,
      cell_id: Number(draft.cell_id),
      process_reference: draft.process_reference || null,
    });
  }

  if (!assessment) return null;

  return (
    <section className="community-panel" data-testid="community-panel">
      <SectionHeading title={COMMUNITY_COPY.title}>
        {COMMUNITY_COPY.heading}
      </SectionHeading>

      <div
        className={`community-banner status-${assessment.validation_status}`}
        role="status"
        data-testid="community-status"
        data-status={assessment.validation_status}
      >
        <b>{assessment.validation_label}</b>
        <span>
          {assessment.not_assessed_count} of {assessment.project_count || 0} selected
          projects are {COMMUNITY_COPY.notAssessed.toLowerCase()}.
        </span>
      </div>

      {assessment.validation_status === 'invalid' && (
        <p className="warning" role="alert" data-testid="community-invalid">
          {COMMUNITY_COPY.invalidFile}
        </p>
      )}
      {assessment.file_errors?.length > 0 && (
        <ul data-testid="community-file-errors">
          {assessment.file_errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {(assessment.validation_status === 'not_assessed'
        || assessment.validation_status === 'incomplete') && (
        <p className="warning" role="note">
          {COMMUNITY_COPY.incomplete}
        </p>
      )}

      {assessment.file_status === 'absent' && (
        <p className="hint">{COMMUNITY_COPY.missingFile}</p>
      )}

      {assessment.unresolved_concerns.length > 0 && (
        <div className="community-concerns">
          <b>Open safeguards</b>
          {assessment.unresolved_concerns.map((item) => (
            <span key={`${item.cell_id}:${item.type}`}>
              Cell {item.cell_id} · {item.type}: {item.safeguards.map(labelize).join(', ')}
            </span>
          ))}
        </div>
      )}

      <p className="hint">{COMMUNITY_COPY.notAPrediction}</p>
      <p className="hint" role="note">{COMMUNITY_COPY.privacy}</p>

      <form className="community-form" onSubmit={submitRecord} data-testid="community-form">
        <div className="community-form-label">{COMMUNITY_COPY.participatoryLabel}</div>
        <p className="hint">{COMMUNITY_COPY.participatoryHint}</p>

        <SelectField
          id="community-project"
          testId="community-project"
          label="Selected project"
          placeholder="Choose a selected project"
          disabled={!selectedOptions.length}
          value={draft.cell_id === '' ? '' : `${draft.cell_id}:${draft.intervention_type}`}
          options={selectedOptions}
          onChange={(value) => {
            if (!value) {
              setDraft((current) => ({ ...current, cell_id: '', intervention_type: '' }));
              return;
            }
            const [cellId, type] = value.split(':');
            setDraft((current) => ({
              ...current,
              cell_id: cellId,
              intervention_type: type,
            }));
          }}
        />

        {Object.entries(FIELD_LABELS).map(([field, label]) => (
          <SelectField
            key={field}
            id={`community-${field}`}
            testId={`community-${field}`}
            label={label}
            placeholder={null}
            value={draft[field]}
            options={COMMUNITY_FIELD_OPTIONS[field].map((option) => ({
              value: option,
              label: labelize(option),
            }))}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                [field]: value,
              }))
            }
          />
        ))}

        <TextField
          id="community-source"
          testId="community-source"
          label="Source"
          value={draft.source}
          onChange={(value) => setDraft((current) => ({ ...current, source: value }))}
        />

        <TextField
          id="community-as-of"
          testId="community-as-of"
          type="date"
          label="As of"
          value={draft.as_of}
          onChange={(value) => setDraft((current) => ({ ...current, as_of: value }))}
        />

        <TextField
          id="community-process"
          label="Process or source reference"
          value={draft.process_reference}
          onChange={(value) => setDraft((current) => ({ ...current, process_reference: value }))}
        />

        <TextField
          id="community-notes"
          label="Notes"
          value={draft.notes}
          onChange={(value) => setDraft((current) => ({ ...current, notes: value }))}
        />

        <button
          type="submit"
          data-testid="community-submit"
          disabled={!selectedOptions.length || draft.cell_id === ''}
        >
          Record participatory input
        </button>
      </form>
    </section>
  );
}

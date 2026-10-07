import { DECISION_ENGINE_COPY, INTERVENTION_COPY } from '../../config/uiCopy.js';
import { ChoiceCard } from '../../components/ChoiceCard.jsx';
import { SelectField } from '../../components/SelectField.jsx';
import { INTERVENTIONS } from '../../config/modelConfig.js';
import { PortfolioList } from '../../components/PortfolioList.jsx';
import { RecommendIcon, ManualIcon } from '../../components/FlowIcons.jsx';
import { SearchGraph } from '../../components/SearchGraph.jsx';
import { CellPlaceLinks } from '../../components/CellPlaceLinks.jsx';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

export function PortfolioStep({
  state,
  workspace,
  selectedType,
  selectedCell,
  selectedCellId,
  cells,
  onSelectType,
  onSelectCell,
  onChooseRecommended,
  onChooseManual,
  onGenerate,
  onAdd,
  onRemove,
  onBack,
  onContinueManual,
}) {
  const generating = state.pendingGeneration || workspace.alternativeBusy || workspace.benchmarkBusy;

  if (state.manualOpen) {
    return (
      <StepShell
        state={state}
        actions={(
          <FlowActions
            onBack={onBack}
            onContinue={onContinueManual}
            continueLabel="Continue"
            continueDisabled={!workspace.userPlan.length}
            continueTestId="confirm-manual-portfolio"
          />
        )}
      >
        <p className="hint">
          Spent {workspace.userCost} of {workspace.budgetCredits} credits.
        </p>
        <SelectField
          id="planning-cell"
          testId="select-cell"
          label="Planning cell"
          placeholder="Choose a planning cell"
          value={selectedCellId ?? ''}
          onChange={(value) => onSelectCell(value == null ? null : Number(value))}
          options={(cells?.features ?? []).map((feature) => ({
            value: String(feature.properties.cell_id),
            label: `Cell ${feature.properties.cell_id}`,
          }))}
        />
        {selectedCell ? (
          <CellPlaceLinks
            lat={selectedCell.lat}
            lng={selectedCell.lng}
            onSeeOnMap={() => onSelectCell(selectedCellId)}
          />
        ) : null}
        <div className="tools compact-tools">
          {Object.entries(INTERVENTIONS).map(([type, config]) => (
            <button
              key={type}
              type="button"
              className={selectedType === type ? `tool active tool-${type}` : `tool tool-${type}`}
              data-testid={`select-type-${type}`}
              aria-pressed={selectedType === type}
              onClick={() => onSelectType(type)}
            >
              <b>{config.label}</b>
              <span>{INTERVENTION_COPY[type]?.mechanism ?? ''}</span>
              <small>{config.costCredits} credits</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          data-testid="add-intervention"
          onClick={onAdd}
          disabled={!workspace.canAddSelected}
        >
          Add to plan
        </button>
        <PortfolioList
          title="Your plan"
          empty="Select a cell and an intervention, then add it."
          projects={workspace.userPlan}
          removable
          onRemove={onRemove}
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      state={state}
      actions={(
        <FlowActions
          onBack={onBack}
          onContinue={onGenerate}
          continueLabel={generating ? 'Generating…' : 'Generate plan'}
          continueDisabled={generating}
          continueTestId="generate-alternatives"
        />
      )}
    >
      {generating ? <SearchGraph active /> : (
        <>
          <ChoiceCard
            selected={state.portfolioMode !== 'manual'}
            primary
            testId="choose-recommended"
            onClick={onChooseRecommended}
          >
            <span className="choice-icon"><RecommendIcon /></span>
            <b>Generate a plan</b>
            <span>Let Ourea compare robust portfolios within your budget.</span>
          </ChoiceCard>

          <ChoiceCard
            testId="choose-manual"
            disabled={generating}
            onClick={onChooseManual}
          >
            <span className="choice-icon"><ManualIcon /></span>
            <b>Build manually</b>
            <span>Choose interventions yourself.</span>
          </ChoiceCard>

          <details className="ux-details">
            <summary>What Ourea compares</summary>
            <p>
              {DECISION_ENGINE_COPY.eligibleCandidates} candidates ·{' '}
              {DECISION_ENGINE_COPY.uncertaintyScenarios} uncertainty scenarios ·{' '}
              {DECISION_ENGINE_COPY.comparisonFutures} comparison futures.
            </p>
          </details>
        </>
      )}
    </StepShell>
  );
}

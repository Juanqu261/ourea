import { INTERVENTIONS } from '../config/modelConfig.js';
import { INTERVENTION_COPY } from '../config/uiCopy.js';
import { AlternativePortfolios } from './AlternativePortfolios.jsx';
import { CellPlaceLinks } from './CellPlaceLinks.jsx';
import { PortfolioList } from './PortfolioList.jsx';
import { SectionHeading } from './SectionHeading.jsx';
import { SelectField } from './SelectField.jsx';

function InterventionIcon({ type }) {
  if (type === 'rwh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 10h12v8H6zM8 10V7h8v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 14h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'drainage') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 8h16M6 12h12M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 18l5-8 3 4 3-5 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function InterventionTools({ selectedType, onSelect, selectedCell }) {
  return (
    <div className="tools">
      {Object.entries(INTERVENTIONS).map(([type, config]) => {
        const copy = INTERVENTION_COPY[type];
        const opportunity = selectedCell
          ? Math.round(Number(selectedCell[config.suitabilityField] ?? 0) * 100)
          : null;
        return (
          <button
            key={type}
            type="button"
            className={selectedType === type ? `tool active tool-${type}` : `tool tool-${type}`}
            onClick={() => onSelect(type)}
            aria-pressed={selectedType === type}
            data-testid={`select-type-${type}`}
          >
            <span className="tool-icon"><InterventionIcon type={type} /></span>
            <b>{config.label}</b>
            <span>{copy.mechanism}</span>
            <div className="tool-meta">
              <i>{config.costCredits} credit{config.costCredits === 1 ? '' : 's'}</i>
              {opportunity != null && <i>Opportunity {opportunity}%</i>}
            </div>
            <small>{copy.evidence}</small>
          </button>
        );
      })}
    </div>
  );
}

function CellCard({ cell, selectedType, canAdd, onAdd }) {
  if (!cell) {
    return (
      <div className="cellcard empty">
        <b>No cell selected</b>
        <span>Select a planning cell to start testing adaptation.</span>
      </div>
    );
  }
  const config = INTERVENTIONS[selectedType];

  return (
    <div className="cellcard">
      <b>Planning cell {cell.cell_id}</b>
      <span>
        {cell.buildings} buildings · ~{Math.round(Number(cell.population_proxy ?? 0))} people proxy
      </span>
      <span>
        {cell.high_hazard_buildings} high-hazard buildings ·{' '}
        {Number(cell.mean_slope_deg ?? 0).toFixed(1)}° mean slope
      </span>
      <CellPlaceLinks lat={cell.lat} lng={cell.lng} />
      <div className="suits">
        <i>RWH {Math.round(Number(cell.rwh_opportunity ?? 0) * 100)}%</i>
        <i>Drain {Math.round(Number(cell.drainage_corridor_proxy ?? 0) * 100)}%</i>
        <i>Restore {Math.round(Number(cell.restoration_opportunity ?? 0) * 100)}%</i>
      </div>
      <button type="button" className="primary" data-testid="add-intervention" onClick={onAdd} disabled={!canAdd}>
        Add {config.label} · {config.costCredits} credit{config.costCredits > 1 ? 's' : ''}
      </button>
    </div>
  );
}

export function PortfolioBuilder({
  budgetCredits,
  onBudgetChange,
  selectedType,
  onSelectType,
  selectedCell,
  cells,
  selectedCellId,
  onSelectCell,
  userPlan,
  userCost,
  canAddSelected,
  onAddSelected,
  onRemoveUserProject,
  onClearUser,
  aiPlan,
  aiDiagnostics,
  alternatives,
  alternativeBusy,
  alternativeError,
  selectedAiProfileId,
  onGenerateAlternatives,
  onSelectAlternative,
  stability,
}) {
  return (
    <>
      <section>
        <SectionHeading step={5} title="Test action">
          Place rainwater harvesting, drainage or restoration on a planning cell. Planning credits
          are not local currency.
        </SectionHeading>

        <label htmlFor="budget-credits">
          Budget <b>{budgetCredits} planning credits</b>
        </label>
        <input
          id="budget-credits"
          type="range"
          min="4"
          max="20"
          step="1"
          value={budgetCredits}
          onChange={(event) => onBudgetChange(Number(event.target.value))}
          aria-valuetext={`${budgetCredits} planning credits`}
        />
        <small>
          Relative budget units until local cost distributions are comparable. Your plan:
          {' '}{userCost}/{budgetCredits}.
        </small>

        <SelectField
          id="planning-cell"
          testId="select-cell"
          label="Planning cell"
          placeholder="Choose a planning cell"
          value={selectedCellId == null ? '' : String(selectedCellId)}
          onChange={(value) => onSelectCell?.(value == null ? null : Number(value))}
          options={(cells?.features ?? []).map((feature) => ({
            value: String(feature.properties.cell_id),
            label: `Cell ${feature.properties.cell_id}`,
          }))}
        />

        <InterventionTools
          selectedType={selectedType}
          onSelect={onSelectType}
          selectedCell={selectedCell}
        />

        <CellCard
          cell={selectedCell}
          selectedType={selectedType}
          canAdd={canAddSelected}
          onAdd={onAddSelected}
        />

        <PortfolioList
          title="Your plan"
          empty="Select a planning cell to start testing adaptation."
          projects={userPlan}
          removable
          onRemove={onRemoveUserProject}
        />

        <div className="actions single-action">
          <button type="button" onClick={onClearUser} disabled={!userPlan.length}>
            Clear my plan
          </button>
        </div>
      </section>

      <section>
        <SectionHeading step={6} title="Compare robust portfolios">
          Your plan versus OUREA robust options under the same data, budget and rainfall ensemble.
        </SectionHeading>

        <AlternativePortfolios
          alternatives={alternatives}
          selectedProfileId={selectedAiProfileId}
          busy={alternativeBusy}
          error={alternativeError}
          onGenerate={onGenerateAlternatives}
          onSelect={onSelectAlternative}
        />

        {aiPlan.length > 0 && (
          <PortfolioList
            title={`${aiDiagnostics?.profile?.label ?? 'OUREA'} portfolio`}
            projects={aiPlan}
            diagnostics={aiDiagnostics?.selectedProjects}
            stability={stability}
          />
        )}

        {aiDiagnostics && (
          <div className="robust">
            <span>Active decision policy · {aiDiagnostics.profile.label}</span>
            <b>
              {aiDiagnostics.selectionMethod} · {aiDiagnostics.scenarioSamples} scenarios ·{' '}
              {aiDiagnostics.candidateCount} eligible candidates
            </b>
            <small>{aiDiagnostics.profile.description}</small>
          </div>
        )}
      </section>
    </>
  );
}

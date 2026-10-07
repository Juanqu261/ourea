import { observationalPresets } from '../../domain/climateScenarios.js';
import { plainPresetLines } from '../../config/climateCopy.js';
import { RainIcon, BudgetIcon } from '../../components/FlowIcons.jsx';
import { InfoTip } from '../../components/InfoTip.jsx';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

const GUIDED_PRESETS = ['typical_wet', 'high_rainfall', 'extreme_observed'];

export function ConditionsStep({
  state,
  climate,
  scenario,
  budgetCredits,
  onSelectPreset,
  onBudgetChange,
  onHowCalculated,
  onAdjustManually,
  onBack,
  onContinue,
  continueDisabled = false,
}) {
  const presets = observationalPresets(climate).filter((preset) => GUIDED_PRESETS.includes(preset.id));

  return (
    <StepShell
      state={state}
      actions={(
        <FlowActions
          onBack={onBack}
          onContinue={onContinue}
          continueDisabled={continueDisabled}
          extra={(
            <button type="button" className="flow-tertiary" data-testid="how-calculated" onClick={onHowCalculated}>
              How was this calculated?
            </button>
          )}
        />
      )}
    >
      <div className="conditions-stack">
      <div className="scenario-presets" role="group" aria-label="Rainfall conditions">
        {presets.map((preset) => {
          const active = scenario?.presetId === preset.id;
          const lines = plainPresetLines(preset);
          return (
            <button
              key={preset.id}
              type="button"
              className={active ? 'active' : ''}
              data-testid={`climate-preset-${preset.id}`}
              aria-pressed={active}
              onClick={() => onSelectPreset(preset)}
            >
              <span className="choice-icon"><RainIcon /></span>
              <b>{lines.short}</b>
              <span className="preset-amount">{lines.amount}</span>
              <span className="preset-tone">{lines.tone}</span>
            </button>
          );
        })}
      </div>

      <div className="form-control">
        <label htmlFor="budget-credits" className="budget-label">
          <span className="label-with-icon">
            <BudgetIcon />
            Planning budget
            <InfoTip label="planning credits">
              Credits are a relative budget used to compare plans — not local currency or engineering cost estimates.
            </InfoTip>
          </span>
          <b>{budgetCredits} credits</b>
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
        <p className="hint">A relative budget used to compare plans.</p>
      </div>

      <button
        type="button"
        className="flow-tertiary"
        data-testid="adjust-manually"
        onClick={onAdjustManually}
      >
        Adjust rainfall manually
      </button>
      </div>
    </StepShell>
  );
}

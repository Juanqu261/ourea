import { MODEL_LIMITS } from '../config/modelConfig.js';
import { EXPLORE_PRESET_ID, matchPresetId } from '../domain/climateScenarios.js';
import { Guardrail, SectionHeading } from './SectionHeading.jsx';
import { Metric } from './Metric.jsx';

export function ScenarioControls({
  scenario,
  onScenarioChange,
  climate,
  summary,
  metrics,
}) {
  const update = (field, value) =>
    onScenarioChange({
      ...scenario,
      [field]: value,
      presetId: EXPLORE_PRESET_ID,
      climate: {
        ...(scenario.climate ?? {}),
        note: 'Manual explore values. Still interpreted as a planning rainfall context, not a forecast.',
      },
    });

  const activePreset = matchPresetId(climate, scenario);
  const windowDays = scenario.climate?.accumulationWindowDays ?? 15;
  const percentile = scenario.climate?.percentile;
  const period = scenario.climate?.climatologyPeriod ?? climate?.climatology_period?.label;

  return (
    <section className="scenario-controls" data-testid="scenario-controls">
      <SectionHeading step={4} title="Explore rainfall context">
        Start from typical, high or extreme observed wet conditions, then vary the same planning
        controls by hand.
      </SectionHeading>

      <Guardrail>
        Rainfall depth is a {windowDays}-day gridded accumulation used as a planning context.
        Antecedent rainfall percentile is not measured soil moisture and not landslide probability.
      </Guardrail>

      <div className="preset-kicker" data-testid="preset-mode">
        {activePreset === EXPLORE_PRESET_ID ? 'Explore' : 'Observed wet conditions'}
        {percentile ? ` · wetter than most years` : ''}
        {period ? ` · ${String(period).replace('-', '–')}` : ''}
      </div>

      <div className="form-control">
        <label htmlFor="rain-depth">
          <span>
            Rainfall context
            <em className="field-sublabel">{windowDays}-day accumulation</em>
          </span>
          <b>{scenario.rainMm} mm</b>
        </label>
        <input
          id="rain-depth"
          type="range"
          min="10"
          max="400"
          step="1"
          value={scenario.rainMm}
          onChange={(event) => update('rainMm', Number(event.target.value))}
          aria-valuetext={`${scenario.rainMm} millimeters over ${windowDays} days`}
        />
        <small>
          Planning rainfall depth for the selected accumulation window.
          {period ? ` Years used: ${String(period).replace('-', '–')}.` : ''}
        </small>
      </div>

      <div className="form-control">
        <label htmlFor="antecedent-rainfall">
          <span>Antecedent rainfall percentile</span>
          <b>{Math.round(Number(scenario.antecedentWetness) * 100)}</b>
        </label>
        <input
          id="antecedent-rainfall"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={scenario.antecedentWetness}
          onChange={(event) => update('antecedentWetness', Number(event.target.value))}
          aria-valuetext={`${Math.round(Number(scenario.antecedentWetness) * 100)}th percentile antecedent rainfall`}
        />
        <small>
          Historical percentile of antecedent rainfall context, not in-situ soil wetness.
        </small>
      </div>

      <div className="form-control">
        <label htmlFor="planning-year">
          <span>Restoration maturity</span>
          <b>Year {scenario.planningYear}</b>
        </label>
        <input
          id="planning-year"
          type="range"
          min="1"
          max="5"
          step="1"
          value={scenario.planningYear}
          onChange={(event) => update('planningYear', Number(event.target.value))}
          aria-valuetext={`Year ${scenario.planningYear}`}
        />
        <small>
          Restoration reaches its full prior effect only after the maturity window. This control is
          not a temporal investment pathway or sequencing optimizer.
        </small>
      </div>

      <div className="metrics">
        <Metric label="Buildings" value={summary?.buildings?.toLocaleString() ?? '—'} />
        <Metric
          label="Population proxy"
          value={summary?.population_proxy?.toLocaleString() ?? '—'}
          hint="DANE census-block planning proxy allocated to buildings, not a current household count."
        />
        <Metric
          label={`Residual stress ≥ ${MODEL_LIMITS.stressThreshold}`}
          value={metrics?.buildingsAboveThreshold?.toLocaleString() ?? '—'}
        />
        <Metric
          label={`People proxy in ≥ ${MODEL_LIMITS.stressThreshold}`}
          value={metrics ? Math.round(metrics.populationAboveThreshold).toLocaleString() : '—'}
        />
      </div>
    </section>
  );
}

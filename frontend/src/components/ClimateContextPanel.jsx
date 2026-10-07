import { observationalPresets } from '../domain/climateScenarios.js';
import { climatologyYears, plainClimateFacts, plainPresetCaption, rainfallHeadline } from '../config/climateCopy.js';
import { SectionHeading } from './SectionHeading.jsx';

const SOURCE_LABELS = Object.freeze({
  'https://www.chc.ucsb.edu/data/chirps': 'Scientific rainfall source',
  'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/': 'Rainfall data archive',
  'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt': 'Rainfall product notes',
  'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/pentads/latam/tifs/': 'Latin America rainfall tiles',
});

export function ClimateContextPanel({
  climate,
  scenario,
  onSelectPreset,
  showPresets = true,
}) {
  const presets = observationalPresets(climate);
  if (!climate) {
    return null;
  }

  const activeId = scenario?.presetId;
  const landing = climate.doi || climate.source_urls?.[0];

  return (
    <section data-testid="climate-context-panel">
      <SectionHeading title="Observed rainfall for this hillside">
        {rainfallHeadline(climate)}. Ourea uses this record to compare typical, high and extreme
        wet conditions — not to forecast the next storm.
      </SectionHeading>

      <p className="hint" role="note">
        Ourea evaluates portfolios across observed wet conditions. It supports planning decisions;
        it does not issue real-time forecasts.
      </p>

      <div className="climate-facts" data-testid="climate-facts">
        {plainClimateFacts(climate).map((fact) => (
          <span key={fact.label}><small>{fact.label}</small><b>{fact.value}</b></span>
        ))}
      </div>

      {showPresets && (
      <div className="scenario-presets" role="group" aria-label="Observed rainfall context presets">
        {presets.map((preset) => {
          const active = activeId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={active ? 'active' : ''}
              data-testid={`climate-preset-${preset.id}`}
              aria-pressed={active}
              onClick={() => onSelectPreset(preset)}
            >
              <b>{preset.label}</b>
              <span>{plainPresetCaption(preset)}</span>
            </button>
          );
        })}
      </div>
      )}

      <p>
        <a
          href={landing}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="climate-source-link"
        >
          Scientific rainfall source
        </a>
      </p>

      <details className="method-disclosure" data-testid="climate-method">
        <summary>Method and appropriate use</summary>
        <p data-testid="climate-source-technical">
          Technical source: {climate.source_name} · {climatologyYears(climate)}. This is a specialist
          annex, not the language used in the decision brief.
        </p>
        <ul>
          <li>{climate.method?.product}</li>
          <li>{climate.method?.extract}</li>
          <li>{climate.method?.daily_allocation}</li>
          <li>{climate.method?.percentiles}</li>
          <li>{climate.method?.preset_mapping}</li>
        </ul>
        <p><b>Appropriate uses</b></p>
        <ul>
          {(climate.appropriate_uses ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p><b>Scope</b></p>
        <ul>
          {(climate.limitations ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>Sources</p>
        <ul>
          {(climate.source_urls ?? []).map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {SOURCE_LABELS[url] ?? 'Scientific rainfall documentation'}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

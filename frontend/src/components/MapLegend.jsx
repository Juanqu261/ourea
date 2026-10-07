import { BRAND } from '../config/brand.js';
import { CITY_LENSES } from '../config/uiCopy.js';
import { lensConfig } from '../domain/cityScreen.js';

export function MapLegend({
  scope,
  cityLens = 'balanced',
  cityLenses = null,
  focusLabel = null,
  legendCityTitle = null,
  legendCityNote = null,
  legendSandboxTitle = null,
  legendSandboxNote = null,
  collapsed,
  onToggle,
}) {
  const lens = lensConfig(cityLens, cityLenses ?? CITY_LENSES);
  const title = scope === 'city'
    ? (legendCityTitle ?? `${lens.label} · priority`)
    : (legendSandboxTitle ?? 'Screening condition');
  const placeNote = focusLabel ?? BRAND.provingGround;
  const tip = scope === 'city'
    ? (legendCityNote ?? 'Colors show relative screening priority on the city map.')
    : (legendSandboxNote
      ?? 'Building colors show baseline or residual screening condition for the selected rainfall.');

  return (
    <div
      className={collapsed ? 'map-legend is-collapsed' : 'map-legend'}
      data-testid="map-legend"
    >
      <div className="map-legend-head">
        <b>{collapsed ? 'Legend' : title}</b>
        <div className="map-legend-actions">
          {!collapsed ? (
            <details className="legend-help" data-testid="legend-help">
              <summary aria-label="About this legend">i</summary>
              <p>{tip}</p>
            </details>
          ) : null}
          <button
            type="button"
            className="map-legend-toggle"
            data-testid="legend-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show legend' : 'Hide legend'}
            onClick={onToggle}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      {!collapsed && (scope === 'city' ? (
        <>
          <span><i className="legend-swatch low" /> lower</span>
          <span><i className="legend-swatch medium" /> medium</span>
          <span><i className="legend-swatch high" /> higher</span>
          <span className="legend-note">{placeNote}</span>
        </>
      ) : (
        <>
          <span><i className="legend-swatch stress-low" /> lower</span>
          <span><i className="legend-swatch stress-med" /> medium</span>
          <span><i className="legend-swatch stress-high" /> higher</span>
          <span className="legend-divider" />
          <span><i className="legend-dot rwh" /> Rainwater</span>
          <span><i className="legend-dot drainage" /> Drainage</span>
          <span><i className="legend-dot restoration" /> Restoration</span>
          <span className="legend-note">{placeNote}</span>
        </>
      ))}
    </div>
  );
}

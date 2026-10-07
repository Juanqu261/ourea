import { useState } from 'react';
import { CITY_LENSES } from '../../config/uiCopy.js';
import { BRAND } from '../../config/brand.js';
import {
  CITY_SCREEN_CONTRACT,
  countSafePopulationMatches,
  lensConfig,
  topScreening,
} from '../../domain/cityScreen.js';
import { numeric } from '../../domain/numeric.js';
import { LensIcon } from '../../components/FlowIcons.jsx';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

const DEFAULT_RANK_ROWS = 5;

function lensSignal(properties, lensId, usesEquity) {
  if (lensId === 'exposure') {
    const weighted = numeric(properties.hazard_weighted_population_proxy_2026);
    if (weighted != null) {
      return `~${Math.round(weighted).toLocaleString('en-US')}`;
    }
    const proxy = numeric(properties.population_proxy) ?? numeric(properties.population_estimate);
    return proxy == null ? '—' : `~${Math.round(proxy).toLocaleString('en-US')}`;
  }
  if (lensId === 'equity' && usesEquity) {
    const imcv = numeric(properties.imcv_ampi_2023);
    return imcv == null ? '—' : imcv.toFixed(1);
  }
  if (lensId === 'runoff_stress' || lensId === 'low_regret_screen') {
    const stress = numeric(properties.drainage_stress_proxy) ?? numeric(properties.baseline_stress);
    return stress == null ? '—' : stress.toFixed(2);
  }
  const population = numeric(properties.population_2026)
    ?? numeric(properties.population_proxy)
    ?? numeric(properties.population_estimate);
  return population == null
    ? '—'
    : Math.round(population).toLocaleString('en-US');
}

function lensSignalUnit(lensId, usesEquity) {
  if (lensId === 'equity' && usesEquity) return 'IMCV';
  if (lensId === 'runoff_stress' || lensId === 'low_regret_screen') return 'stress';
  return 'people proxy';
}

function categoryChip(properties, isPortability) {
  if (!isPortability) {
    const barrio = String(properties.BARRIO ?? properties.NAME ?? '');
    if (/special|unmatched/i.test(String(properties.comuna_name ?? ''))) {
      return { key: 'other', label: 'OTHER' };
    }
    return { key: 'barrio', label: 'BARRIO' };
  }
  const kind = String(properties.kind ?? '');
  if (kind === 'screening_sector' || properties.geometry_class === 'derived_screening_sector') {
    return { key: 'derived', label: 'DERIVED' };
  }
  if (kind === 'campus') return { key: 'campus', label: 'CAMPUS' };
  if (kind === 'park') return { key: 'park', label: 'PARK' };
  return { key: 'osm', label: 'OSM AREA' };
}

function placeSubtitle(properties, isPortability, caseConfig) {
  if (isPortability) {
    if (properties.kind === 'screening_sector') return 'Derived screening sector';
    return properties.comuna_name || (caseConfig?.focusArea ?? 'Screening area');
  }
  return properties.comuna_name || 'Special / unmatched polygon';
}

export function AreaStep({
  state,
  screening,
  selectedBarrio,
  llanaditas,
  provingGroundFeature = null,
  caseConfig = null,
  onLensChange,
  onSelectBarrio,
  onAnalyze,
  onSeeWhy,
  onLoadExample,
}) {
  const [showAllRanks, setShowAllRanks] = useState(false);
  const lenses = caseConfig?.cityLenses ?? CITY_LENSES;
  const usesEquity = caseConfig?.usesEquityLens !== false;
  const focusFeature = provingGroundFeature ?? llanaditas;
  const focusLabel = caseConfig?.focusArea ?? BRAND.provingGround;
  const isPortability = caseConfig?.usesEquityLens === false;
  const isOverview = caseConfig?.screeningMode === 'overview';
  const lens = lensConfig(state.cityLens, lenses);
  const ranked = topScreening(screening, state.cityLens, screening?.features?.length ?? 8, lenses);
  const visibleRanks = showAllRanks ? ranked : ranked.slice(0, DEFAULT_RANK_ROWS);
  const populationMatched = countSafePopulationMatches(screening);
  const focusRank = numeric(focusFeature?.properties?.[lens.rankField]);
  const continueLabel = isPortability
    ? `Analyze ${caseConfig?.shortName ?? 'focus area'}`
    : 'Analyze Llanaditas';
  const areaInstruction = caseConfig?.stepAreaInstruction
    ?? 'Llanaditas is the detailed case. Other areas inform city ranking only.';
  const screeningCount = screening?.features?.length ?? 0;

  return (
    <StepShell
      state={state}
      instruction={areaInstruction}
      actions={(
        <FlowActions
          hideBack
          continueLabel={continueLabel}
          continueTestId="open-sandbox"
          onContinue={onAnalyze}
          extra={(
            <button type="button" className="flow-tertiary" data-testid="see-why-area" onClick={onSeeWhy}>
              Why this area?
            </button>
          )}
        />
      )}
    >
      <div className="area-stack">
        {caseConfig?.introNotice ? (
          <details className="area-disclosure" data-testid="case-intro-notice">
            <summary>About this case</summary>
            <div className="area-disclosure-body">
              <p>{caseConfig.introNotice}</p>
            </div>
          </details>
        ) : null}

        <section className="area-section" aria-labelledby="area-lens-label">
          <p className="area-section-label" id="area-lens-label">Planning lens</p>
          <div className="city-lenses" role="radiogroup" aria-label="Planning lens">
            {Object.entries(lenses).map(([id, config]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={state.cityLens === id}
                className={state.cityLens === id ? 'active' : ''}
                onClick={() => onLensChange(id)}
              >
                <span className="choice-icon" aria-hidden="true"><LensIcon id={id} /></span>
                <b>{config.label}</b>
                <span>{config.question}</span>
              </button>
            ))}
          </div>
          <details className="area-disclosure">
            <summary>How this lens is scored</summary>
            <div className="area-disclosure-body">
              <p>{lens.description}</p>
            </div>
          </details>
        </section>

        <section className="area-section" aria-label="Summary metrics">
          <div className="area-metrics">
            {isPortability ? (
              <div
                className="area-metric"
                data-testid="population-matches"
                title={
                  isOverview
                    ? 'OSM named areas and derived screening sectors'
                    : 'Grid screening cells with population estimate proxies'
                }
              >
                <strong>{screeningCount}</strong>
                <span>{isOverview ? 'Screening areas' : 'Screening cells'}</span>
              </div>
            ) : (
              <div
                className="area-metric"
                data-testid="population-matches"
                title="Safe matches of official urban records onto the current polygon export"
              >
                <strong>{`${populationMatched}/${CITY_SCREEN_CONTRACT.official_urban_records}`}</strong>
                <span>Population matches</span>
              </div>
            )}
            <div className="area-metric" data-testid="focus-rank">
              <strong>{focusRank ? `#${focusRank}` : '—'}</strong>
              <span>Current focus rank</span>
            </div>
          </div>
        </section>

        <section className="area-section" aria-labelledby="area-rank-label">
          <div className="area-rank-head">
            <p className="area-section-label" id="area-rank-label">Top screening areas</p>
            <p className="area-section-note">Ranked using the selected planning lens</p>
          </div>

          <div className="screening-list" role="list" data-testid="city-top-list">
            {visibleRanks.map((feature) => {
              const properties = feature.properties;
              const rank = numeric(properties[lens.rankField]);
              const rowKey = properties.OBJECTID ?? properties.overview_id ?? properties.cell_id ?? properties.BARRIO;
              const name = properties.NAME ?? properties.BARRIO ?? `Cell ${properties.cell_id}`;
              const chip = categoryChip(properties, isPortability);
              const active = selectedBarrio
                && (
                  (properties.OBJECTID != null && Number(selectedBarrio.OBJECTID) === Number(properties.OBJECTID))
                  || (properties.overview_id != null && selectedBarrio.overview_id === properties.overview_id)
                  || (properties.cell_id != null && Number(selectedBarrio.cell_id) === Number(properties.cell_id))
                );
              return (
                <button
                  key={rowKey}
                  type="button"
                  className={active ? 'screening-row active' : 'screening-row'}
                  data-testid="screening-row"
                  data-rank={rank}
                  title={String(name)}
                  onClick={() => onSelectBarrio?.(properties)}
                >
                  <b>#{rank}</b>
                  <span className="screening-row-main">
                    <strong className="screening-row-name">{name}</strong>
                    <i className="screening-row-meta">
                      <em className={`place-chip place-chip-${chip.key}`}>{chip.label}</em>
                      {placeSubtitle(properties, isPortability, caseConfig)}
                    </i>
                  </span>
                  <span className="screening-row-stat">
                    <strong>{lensSignal(properties, state.cityLens, usesEquity)}</strong>
                    <em>{lensSignalUnit(state.cityLens, usesEquity)}</em>
                  </span>
                </button>
              );
            })}
          </div>

          {ranked.length > DEFAULT_RANK_ROWS ? (
            <button
              type="button"
              className="area-show-more"
              data-testid="show-full-ranking"
              onClick={() => setShowAllRanks((value) => !value)}
            >
              {showAllRanks
                ? 'Show fewer areas'
                : `Show all ${ranked.length}`}
            </button>
          ) : null}
        </section>

        <p className="hint area-hint" role="note">
          {isOverview
            ? 'Select an area on the map, then Analyze for detailed planning.'
            : isPortability
              ? `Detailed analysis is available for ${focusLabel}.`
              : `Detailed analysis is available for ${BRAND.provingGround}.`}
        </p>

        {isOverview && caseConfig?.detailGridNote ? (
          <details className="area-disclosure" data-testid="nanjing-detail-grid-note">
            <summary>Planning grid</summary>
            <div className="area-disclosure-body">
              <p>{caseConfig.detailGridNote}</p>
            </div>
          </details>
        ) : null}

        <button
          type="button"
          className="flow-tertiary area-example"
          data-testid="run-guided-demo"
          onClick={onLoadExample}
        >
          Load completed example
        </button>
      </div>
    </StepShell>
  );
}

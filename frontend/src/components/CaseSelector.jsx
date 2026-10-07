import { listCases, CASE_IDS } from '../config/cases/index.js';
import { OureaLogo } from './OureaLogo.jsx';
import { BRAND } from '../config/brand.js';
import { PRODUCT_INTRO } from '../config/uiCopy.js';

const SELECT_TEST_IDS = {
  [CASE_IDS.MEDELLIN]: 'select-case-medellin',
  [CASE_IDS.NANJING]: 'select-case-nanjing',
};

export function CaseSelector({
  selectedCaseId = null,
  onSelect,
  onCancel = null,
  overlay = false,
}) {
  const cases = listCases();

  return (
    <div
      className={overlay ? 'case-selector case-selector-overlay' : 'case-selector'}
      data-testid="case-selector"
      role={overlay ? 'dialog' : 'region'}
      aria-label="Choose city"
    >
      <div className="case-selector-panel">
        <div className="case-selector-brand">
          <OureaLogo />
          <div>
            <b>{BRAND.name}</b>
            <span>{PRODUCT_INTRO.tagline}</span>
          </div>
        </div>

        <p className="case-selector-path">{PRODUCT_INTRO.path}</p>

        <h2>Choose a city</h2>

        <div className="case-selector-cards">
          {cases.map((item) => {
            const primary = item.id === CASE_IDS.MEDELLIN;
            const selected = selectedCaseId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={[
                  'case-card',
                  primary ? 'is-primary' : 'is-portability',
                  selected ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                data-testid={SELECT_TEST_IDS[item.id]}
                onClick={() => onSelect?.(item.id)}
              >
                <span className="case-card-role">{item.hierarchyLabel}</span>
                <strong>{item.shortName ?? item.displayName}</strong>
                <span className="case-card-focus">{item.focusArea}</span>
                <p>{item.contextLine ?? item.hierarchyBlurb}</p>
              </button>
            );
          })}
        </div>

        <details className="ux-details case-selector-details">
          <summary>How the two cases differ</summary>
          <p>
            Same decision engine. Different geography and evidence depth —
            Medellín is the primary proving ground; Nanjing shows portability.
          </p>
        </details>

        {overlay && onCancel ? (
          <button type="button" className="case-selector-cancel" onClick={onCancel}>
            Keep current city
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { DECISION_ENGINE_COPY } from '../config/uiCopy.js';

const CELLS = [12, 18, 21, 28, 29, 35, 41, 44, 48];
const ACTIONS = [
  { id: 'rwh', label: 'RWH' },
  { id: 'drain', label: 'Drain' },
  { id: 'rest', label: 'Restore' },
];
const FUTURES = Array.from({ length: 8 }, (_, index) => index);
const PHASES = [
  'Scoring 125 cell × intervention candidates',
  'Passing benefit through overlapping sites',
  'Resampling 80 rainfall futures',
  'Keeping the lower-tail portfolio',
];

function cellPoint(index) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 28 + col * 34, y: 48 + row * 46 };
}

function actionPoint(index) {
  return { x: 156, y: 56 + index * 50 };
}

function futurePoint(index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 248 + col * 28, y: 46 + row * 36 };
}

const HUB = { x: 356, y: 110 };

export function SearchGraph({ active = false }) {
  return (
    <div className={active ? 'search-graph is-active' : 'search-graph'} data-testid="generation-progress" role="status">
      <div className="search-graph-head">
        <b>Search network</b>
        <span>Budgeted graph search over sites, actions and wet futures — not a neural net.</span>
      </div>
      <svg className="search-graph-svg" viewBox="0 0 400 210" aria-hidden="true">
        <text className="search-col-label" x="45" y="18">Sites</text>
        <text className="search-col-label" x="156" y="18">Actions</text>
        <text className="search-col-label" x="262" y="18">Futures</text>
        <text className="search-col-label" x="356" y="18">Keep</text>

        {CELLS.map((id, index) => {
          const from = cellPoint(index);
          return ACTIONS.map((action, actionIndex) => {
            const to = actionPoint(actionIndex);
            return (
              <path
                key={`${id}-${action.id}`}
                className={`search-edge search-edge-${(index + actionIndex) % 4}`}
                d={`M${from.x + 11} ${from.y} C ${from.x + 42} ${from.y}, ${to.x - 36} ${to.y}, ${to.x - 22} ${to.y}`}
              />
            );
          });
        })}
        {ACTIONS.map((action, actionIndex) => {
          const from = actionPoint(actionIndex);
          return FUTURES.map((future) => {
            const to = futurePoint(future);
            return (
              <path
                key={`${action.id}-f${future}`}
                className={`search-edge search-edge-${(actionIndex + future) % 4}`}
                d={`M${from.x + 24} ${from.y} C ${from.x + 48} ${from.y}, ${to.x - 24} ${to.y}, ${to.x - 8} ${to.y}`}
              />
            );
          });
        })}
        {FUTURES.map((future) => {
          const from = futurePoint(future);
          return (
            <path
              key={`hub-${future}`}
              className={`search-edge search-hub search-edge-${future % 4}`}
              d={`M${from.x + 8} ${from.y} C ${from.x + 28} ${from.y}, ${HUB.x - 36} ${HUB.y}, ${HUB.x - 22} ${HUB.y}`}
            />
          );
        })}

        {CELLS.map((id, index) => {
          const point = cellPoint(index);
          return (
            <g key={id} className={`search-node search-cell search-node-${index % 3}`}>
              <circle cx={point.x} cy={point.y} r="11" />
              <text x={point.x} y={point.y + 3}>{id}</text>
            </g>
          );
        })}
        {ACTIONS.map((action, index) => {
          const point = actionPoint(index);
          return (
            <g key={action.id} className={`search-node search-type search-node-${index}`}>
              <rect x={point.x - 22} y={point.y - 12} width="44" height="24" rx="6" />
              <text x={point.x} y={point.y + 4}>{action.label}</text>
            </g>
          );
        })}
        {FUTURES.map((future) => {
          const point = futurePoint(future);
          return (
            <g key={`future-${future}`} className={`search-node search-future search-node-${future % 3}`}>
              <circle cx={point.x} cy={point.y} r="7" />
            </g>
          );
        })}
        <g className="search-node search-hub-node">
          <circle cx={HUB.x} cy={HUB.y} r="20" />
          <text x={HUB.x} y={HUB.y - 3}>P10</text>
          <text x={HUB.x} y={HUB.y + 10}>keep</text>
        </g>
      </svg>
      <ol className="search-graph-legend">
        <li>{DECISION_ENGINE_COPY.eligibleCandidates} candidates</li>
        <li>{DECISION_ENGINE_COPY.uncertaintyScenarios} rainfall futures</li>
        <li>{DECISION_ENGINE_COPY.policyObjectives} policy lenses</li>
        <li>{DECISION_ENGINE_COPY.comparisonFutures} comparison draws</li>
      </ol>
      <p className="search-graph-phase">
        {PHASES.map((phase) => (
          <span key={phase}>{phase}</span>
        ))}
      </p>
    </div>
  );
}

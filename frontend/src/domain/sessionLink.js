export const SESSION_KEY = 'ourea.session.v1';

const PLAN_TYPES = new Set(['rwh', 'drainage', 'restoration']);
const ALLOWED_AREA_IDS = new Set(['llanaditas', 'xianlin']);

export function encodePlan(plan = []) {
  return (plan ?? [])
    .map((item) => {
      const cellId = Number(item?.cell_id);
      const type = String(item?.type ?? '');
      if (!Number.isInteger(cellId) || !PLAN_TYPES.has(type)) return null;
      return `${cellId}:${type}`;
    })
    .filter(Boolean)
    .join(',');
}

export function decodePlan(text = '') {
  if (!text) return [];
  return String(text)
    .split(',')
    .map((part) => {
      const [cell, type] = part.split(':');
      const cellId = Number(cell);
      if (!Number.isInteger(cellId) || !PLAN_TYPES.has(type)) return null;
      return { cell_id: cellId, type };
    })
    .filter(Boolean);
}

export function parseSessionHash(hash = '') {
  const raw = String(hash ?? '').replace(/^#/, '');
  const params = new URLSearchParams(raw.includes('=') ? raw : '');
  const rawCell = params.get('cell');
  const cell = Number(rawCell);
  const area = params.get('area');
  return {
    areaId: ALLOWED_AREA_IDS.has(area) ? area : null,
    cellId: rawCell != null && rawCell !== '' && Number.isInteger(cell) ? cell : null,
    plan: decodePlan(params.get('plan')),
  };
}

export function sessionHash({ areaId = 'llanaditas', cellId, plan } = {}) {
  const params = new URLSearchParams();
  if (areaId) params.set('area', areaId);
  if (cellId != null && Number.isFinite(Number(cellId))) params.set('cell', String(Number(cellId)));
  const encoded = encodePlan(plan);
  if (encoded) params.set('plan', encoded);
  const text = params.toString();
  return text ? `#${text}` : '';
}

export function simulatorBaseUrl() {
  if (typeof window === 'undefined') return 'https://ybedoyab.github.io/ourea/';
  const path = window.location.pathname.endsWith('.html')
    ? window.location.pathname.replace(/[^/]+$/, '')
    : window.location.pathname;
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${normalized}`;
}

export function cellSimulatorUrl(cellId, baseUrl = simulatorBaseUrl(), plan, areaId = 'llanaditas') {
  const root = String(baseUrl ?? '').replace(/\/?$/, '/');
  return `${root}${sessionHash({ areaId, cellId, plan })}`;
}

export function writeSessionHash({ areaId = 'llanaditas', cellId, plan } = {}) {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  const next = sessionHash({ areaId, cellId, plan });
  if (window.location.hash === next) return;
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
}

export function clearSessionHash() {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  if (!window.location.hash) return;
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function readStoredSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredSession(session) {
  if (typeof localStorage === 'undefined' || !session) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      v: 1,
      savedAt: new Date().toISOString(),
      ...session,
    }));
  } catch {
    // Quota or private mode: the hash still focuses the cell.
  }
}

export function clearStoredSession() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore private-mode failures.
  }
}

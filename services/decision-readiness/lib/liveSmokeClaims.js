const BANNED_PHRASES = Object.freeze([
  'planning credit',
  'lives saved',
  'losses avoided',
  'the site is safe',
  'collapse expected',
  'failure year',
  'construction is feasible',
  'ready for construction',
]);

function collectStrings(value, bucket = []) {
  if (typeof value === 'string') {
    bucket.push(value);
    return bucket;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket);
    return bucket;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, bucket);
  }
  return bucket;
}

function fieldAllowsPhrase(text) {
  return /\b(not|cannot|never|without|nor)\b|do not|does not|n['’]t /i.test(text);
}

export function flaggedClaim(synthesis) {
  const { cannot_conclude: _limits, ...rest } = synthesis ?? {};
  for (const text of collectStrings(rest)) {
    const lower = text.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase) && !fieldAllowsPhrase(text)) return text;
    }
  }
  return null;
}

export function hasUsd(blob, value) {
  const n = Math.round(Number(value));
  const compact = String(blob).replace(/[$,]/g, '');
  if (compact.includes(String(n))) return true;
  const millions = n / 1e6;
  return [`${millions.toFixed(2)}`, `${millions.toFixed(1)}`].some((item) => String(blob).includes(item));
}

export function assertSynthesisClaims(label, synthesis, snapshot) {
  const blob = JSON.stringify(synthesis);
  if (snapshot?.cost?.complete) {
    for (const value of [snapshot.cost.low, snapshot.cost.base, snapshot.cost.high]) {
      if (!Number.isFinite(value)) continue;
      if (!hasUsd(blob, value)) {
        throw new Error(`${label}: missing exact USD figure ${value}`);
      }
    }
  }
  const flagged = flaggedClaim(synthesis);
  if (flagged) throw new Error(`${label}: banned claim in synthesis: ${flagged}`);
  if (synthesis?.headline && snapshot?.readiness?.status && synthesis.headline === snapshot.readiness.status) {
    throw new Error(`${label}: model echoed the raw status token`);
  }
}

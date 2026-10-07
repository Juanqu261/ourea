export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function quantile(sortedValues, probability) {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor(probability * (sortedValues.length - 1))),
  );
  return sortedValues[index];
}

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

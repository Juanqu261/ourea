export function signedDelta(reference, value, digits = 4) {
  return Number((Number(value) - Number(reference)).toFixed(digits));
}

export function regret(reference, value, digits = 4) {
  return Number(Math.max(0, Number(reference) - Number(value)).toFixed(digits));
}

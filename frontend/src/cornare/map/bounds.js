export function boundsOf(geojson) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let count = 0;

  const walk = (value) => {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      minLon = Math.min(minLon, value[0]);
      maxLon = Math.max(maxLon, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      count += 1;
      return;
    }
    value.forEach(walk);
  };

  (geojson?.features ?? []).forEach((feature) => walk(feature.geometry?.coordinates));
  if (!count) return null;
  return [[minLon, minLat], [maxLon, maxLat]];
}

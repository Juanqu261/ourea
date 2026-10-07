export function ringCentroid(ring) {
  const pts = (ring ?? []).filter((point) => Array.isArray(point) && point.length >= 2);
  if (!pts.length) return null;
  const closed = pts.length > 1
    && pts[0][0] === pts[pts.length - 1][0]
    && pts[0][1] === pts[pts.length - 1][1];
  const usable = closed ? pts.slice(0, -1) : pts;
  if (!usable.length) return null;
  const sum = usable.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / usable.length, sum[1] / usable.length];
}

export function ringOf(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!coords) return [];
  if (feature.geometry.type === 'Polygon') return coords[0] ?? [];
  if (feature.geometry.type === 'MultiPolygon') return coords[0]?.[0] ?? [];
  return [];
}

export function featureLngLat(feature) {
  return ringCentroid(ringOf(feature));
}

export function googleMapsSearchUrl(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

export function googleEarthLookUrl(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const ns = Number(lat).toFixed(5);
  const ew = Number(lng).toFixed(5);
  return `https://earth.google.com/web/@${ns},${ew},1550a,380d,35y,0h,60t,0r`;
}

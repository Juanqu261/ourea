import { boundsOf } from './map/bounds.js';
import { encodeJpeg } from './jpegEncode.js';

export const BRIEF_MAP_WIDTH = 1600;
export const BRIEF_MAP_HEIGHT = 900;

export const BRIEF_MAP_FILES = [
  'municipalities.geojson',
  'map/protected_areas.geojson',
  'map/wetlands.geojson',
  'map/rio_negro_riparian.geojson',
  'map/la_marinilla_ecosystem.geojson',
  'map/hydrography.geojson',
];

const FILL = {
  rionegro: [132, 78, 84],
  guarne: [122, 112, 72],
  marinilla: [64, 108, 86],
};
const OVERLAY = {
  'map/protected_areas.geojson': { color: [78, 128, 92], alpha: 0.38 },
  'map/wetlands.geojson': { color: [70, 118, 108], alpha: 0.42 },
  'map/rio_negro_riparian.geojson': { color: [86, 132, 96], alpha: 0.34 },
  'map/la_marinilla_ecosystem.geojson': { color: [92, 124, 78], alpha: 0.3 },
};

function mercator(lon, lat) {
  const x = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return [x, y];
}

function viewOf(bounds, width, height, pad) {
  const [minX, minY] = mercator(bounds[0][0], bounds[0][1]);
  const [maxX, maxY] = mercator(bounds[1][0], bounds[1][1]);
  const worldW = Math.max(maxX - minX, 1e-9);
  const worldH = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width * (1 - pad * 2)) / worldW, (height * (1 - pad * 2)) / worldH);
  const usedW = worldW * scale;
  const usedH = worldH * scale;
  const originX = (width - usedW) / 2;
  const originY = (height - usedH) / 2;
  return (lon, lat) => {
    const [x, y] = mercator(lon, lat);
    return [originX + (x - minX) * scale, originY + (maxY - y) * scale];
  };
}

function projectRing(ring, project) {
  const points = ring.map(([lon, lat]) => project(lon, lat));
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) points.push(first);
  return points;
}

function blend(rgb, width, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= rgb.length / 3 / width) return;
  const index = (y * width + x) * 3;
  const keep = 1 - alpha;
  rgb[index] = rgb[index] * keep + color[0] * alpha;
  rgb[index + 1] = rgb[index + 1] * keep + color[1] * alpha;
  rgb[index + 2] = rgb[index + 2] * keep + color[2] * alpha;
}

function fillRings(rgb, width, height, rings, color, alpha) {
  const edges = [];
  let minY = height;
  let maxY = 0;
  rings.forEach((ring) => {
    for (let index = 0; index < ring.length - 1; index += 1) {
      let [x1, y1] = ring[index];
      let [x2, y2] = ring[index + 1];
      if (y1 === y2) continue;
      if (y1 > y2) {
        [x1, x2] = [x2, x1];
        [y1, y2] = [y2, y1];
      }
      minY = Math.min(minY, y1);
      maxY = Math.max(maxY, y2);
      edges.push({ x1, y1, x2, y2 });
    }
  });
  const start = Math.max(0, Math.floor(minY));
  const end = Math.min(height - 1, Math.ceil(maxY));
  for (let y = start; y <= end; y += 1) {
    const scan = y + 0.5;
    const crossings = [];
    edges.forEach((edge) => {
      if (scan < edge.y1 || scan >= edge.y2) return;
      const t = (scan - edge.y1) / (edge.y2 - edge.y1);
      crossings.push(edge.x1 + t * (edge.x2 - edge.x1));
    });
    crossings.sort((left, right) => left - right);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const from = Math.max(0, Math.ceil(crossings[index]));
      const to = Math.min(width - 1, Math.floor(crossings[index + 1]));
      for (let x = from; x <= to; x += 1) blend(rgb, width, x, y, color, alpha);
    }
  }
}

function strokeRing(rgb, width, height, points, color, radius) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    for (let step = 0; step <= steps; step += 1) {
      const x = x1 + ((x2 - x1) * step) / steps;
      const y = y1 + ((y2 - y1) * step) / steps;
      const x0 = Math.floor(x - radius);
      const x1b = Math.ceil(x + radius);
      const y0 = Math.floor(y - radius);
      const y1b = Math.ceil(y + radius);
      for (let py = y0; py <= y1b; py += 1) {
        for (let px = x0; px <= x1b; px += 1) {
          const dx = px + 0.5 - x;
          const dy = py + 0.5 - y;
          if (dx * dx + dy * dy <= radius * radius) blend(rgb, width, px, py, color, 1);
        }
      }
    }
  }
}

function centroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-4) {
    const count = Math.max(1, points.length - 1);
    const sum = points.slice(0, count).reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / count, sum[1] / count];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

function polygonsOf(geometry, project) {
  if (!geometry) return [];
  const raw = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];
  return raw.map((polygon) => polygon.map((ring) => projectRing(ring, project)));
}

function linesOf(geometry, project) {
  if (!geometry) return [];
  const raw = geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.type === 'MultiLineString'
      ? geometry.coordinates
      : [];
  return raw.map((line) => projectRing(line, project));
}

export function renderBriefMap(collections, { width = BRIEF_MAP_WIDTH, height = BRIEF_MAP_HEIGHT } = {}) {
  const municipalities = collections['municipalities.geojson'];
  const bounds = boundsOf(municipalities);
  if (!bounds) throw new Error('Los municipios del corredor no tienen geometría.');
  const project = viewOf(bounds, width, height, 0.08);
  const rgb = new Uint8Array(width * height * 3);
  rgb.fill(28);
  for (let index = 1; index < rgb.length; index += 3) rgb[index] = 26;
  for (let index = 2; index < rgb.length; index += 3) rgb[index] = 24;

  const outlines = [];
  const labels = [];
  (municipalities.features ?? []).forEach((feature) => {
    const id = feature.properties?.id;
    const rings = polygonsOf(feature.geometry, project);
    rings.forEach((polygon) => {
      fillRings(rgb, width, height, polygon, FILL[id] ?? [90, 96, 92], 0.92);
      if (polygon[0]) {
        outlines.push(polygon[0]);
        const [x, y] = centroid(polygon[0]);
        labels.push({
          id,
          name: String(feature.properties?.name ?? id ?? '').toUpperCase(),
          x,
          y,
        });
      }
    });
  });

  Object.entries(OVERLAY).forEach(([file, style]) => {
    (collections[file]?.features ?? []).forEach((feature) => {
      polygonsOf(feature.geometry, project).forEach((polygon) => {
        fillRings(rgb, width, height, polygon, style.color, style.alpha);
      });
    });
  });

  outlines.forEach((ring) => {
    strokeRing(rgb, width, height, ring, [236, 228, 214], 2.2);
    strokeRing(rgb, width, height, ring, [200, 167, 94], 1.1);
  });

  (collections['map/hydrography.geojson']?.features ?? []).forEach((feature) => {
    linesOf(feature.geometry, project).forEach((line) => {
      strokeRing(rgb, width, height, line, [96, 148, 176], 1.6);
    });
  });

  return {
    bytes: encodeJpeg(rgb, width, height, 84),
    width,
    height,
    labels,
  };
}

export async function buildBriefMapImage(options = {}) {
  const collections = {};
  if (options.layers) {
    BRIEF_MAP_FILES.forEach((file) => {
      collections[file] = options.layers[file];
    });
  } else {
    const base = options.baseUrl ?? import.meta.env?.BASE_URL ?? '/';
    const root = base.endsWith('/') ? base : `${base}/`;
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    for (const file of BRIEF_MAP_FILES) {
      const response = await fetchImpl(`${root}data/cornare/${file}`);
      if (!response.ok) throw new Error(`No se pudo leer ${file}`);
      collections[file] = await response.json();
    }
  }
  return renderBriefMap(collections, options);
}

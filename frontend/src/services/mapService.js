import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/maplibre-theme.css';
import { CITY_MAX_BOUNDS, MAP_VIEWS, SANDBOX_BBOX } from '../config/modelConfig.js';
import { CASE_IDS } from '../config/cases/caseTypes.js';
import { assetUrl } from '../config/assetUrl.js';
import {
  massingDisplayStress,
  screeningConditionClass,
  stressByCellId,
} from '../domain/nanjingMassingStress.js';

export class MapUnavailableError extends Error {
  constructor(message = 'WebGL2 is required') {
    super(message);
    this.name = 'MapUnavailableError';
  }
}

export function supportsWebGL2() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
/**
 * Keyless basemap with global coverage (including China urban AOIs).
 * Esri World Street Map often shows “Map data not yet available” over Nanjing;
 * World Imagery remains usable without an API key. Local roads/water overlays
 * supply street context on top.
 */
const BASEMAP_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];
const BASEMAP_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function resolveMapGeometry(data) {
  const bounds = data?.caseConfig?.boundingArea;
  if (!bounds?.sandboxBbox || !bounds?.mapViews || !bounds?.cityMaxBounds) {
    return {
      sandboxBbox: SANDBOX_BBOX,
      cityMaxBounds: CITY_MAX_BOUNDS,
      mapViews: MAP_VIEWS,
      useLocalDem: true,
      useRemoteDem: false,
    };
  }
  const isMedellin = data?.caseConfig?.id === CASE_IDS.MEDELLIN;
  const isNanjing = data?.caseConfig?.id === CASE_IDS.NANJING;
  return {
    sandboxBbox: bounds.sandboxBbox,
    cityMaxBounds: bounds.cityMaxBounds,
    mapViews: bounds.mapViews,
    useLocalDem: isMedellin,
    useRemoteDem: isNanjing,
  };
}

const DEM_SOURCE_TEMPLATE = Object.freeze({
  type: 'raster-dem',
  tiles: [assetUrl('terrain/{z}/{x}/{y}.png')],
  tileSize: 256,
  encoding: 'mapbox',
  minzoom: 15,
  maxzoom: 18,
});

/** Keyless Mapzen/AWS Terrarium tiles for Nanjing hillshade (visualization only). */
const REMOTE_DEM_SOURCE_TEMPLATE = Object.freeze({
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 15,
});

const SANDBOX_LAYER_IDS = Object.freeze([
  'sandbox-ground',
  'shade',
  'hazard',
  'roads',
  'cells-outline',
  'cells-fill',
  'cells-hit',
  'cells-hover-fill',
  'buildings',
  'cells-hover',
  'cell-labels',
  'projects',
]);
const CITY_LAYER_IDS = Object.freeze([
  'screening-fill',
  'screening-outline',
  'screening-selected',
  'city-water',
  'city-roads',
  'comuna-labels',
  'barrio-labels',
  'place-labels',
]);

const CITY_LENS_FIELDS = Object.freeze({
  exposure: 'priority_exposure',
  balanced: 'priority_balanced',
  equity: 'priority_equity',
  runoff_stress: 'priority_runoff',
  low_regret_screen: 'priority_low_regret',
});

const CAMERA = Object.freeze({
  city: Object.freeze({ minZoom: 11, maxZoom: 15.4 }),
  sandbox: Object.freeze({ minZoom: 14.2, maxZoom: 18.5 }),
});

const SANDBOX_PLACE_MEDELLIN = 'Llanaditas No.2 · Comuna 8 · Villa Hermosa';

function cityFillExpression(lens) {
  const field = CITY_LENS_FIELDS[lens] ?? CITY_LENS_FIELDS.balanced;
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', field], -1],
    -1, '#343b3f',
    0, '#2e5b4a',
    0.45, '#b69b45',
    0.72, '#d66f45',
    1, '#b42d34',
  ];
}

function setVisibility(map, layerId, visible) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

function padBbox(bbox, factor) {
  const [west, south, east, north] = bbox;
  const dx = (east - west) * factor;
  const dy = (north - south) * factor;
  return [west - dx, south - dy, east + dx, north + dy];
}

function bboxToBounds(bbox) {
  return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
}

function sandboxGroundFeature(sandboxBbox = SANDBOX_BBOX) {
  const [west, south, east, north] = sandboxBbox;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ]],
    },
  };
}

function geometryBounds(geometry) {
  if (!geometry) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function walk(value) {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === 'number') {
      minX = Math.min(minX, value[0]);
      minY = Math.min(minY, value[1]);
      maxX = Math.max(maxX, value[0]);
      maxY = Math.max(maxY, value[1]);
      return;
    }
    for (const item of value) walk(item);
  }

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries ?? []) walk(child.coordinates);
  } else {
    walk(geometry.coordinates);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [[minX, minY], [maxX, maxY]];
}

function comunaLabelCollection(screening) {
  const groups = new Map();
  for (const feature of screening.features ?? []) {
    const name = feature.properties?.comuna_name;
    const code = String(feature.properties?.comuna_code ?? '');
    if (!name || !code) continue;
    const bounds = geometryBounds(feature.geometry);
    if (!bounds) continue;
    const current = groups.get(code) ?? {
      name,
      code,
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    current.minX = Math.min(current.minX, bounds[0][0]);
    current.minY = Math.min(current.minY, bounds[0][1]);
    current.maxX = Math.max(current.maxX, bounds[1][0]);
    current.maxY = Math.max(current.maxY, bounds[1][1]);
    groups.set(code, current);
  }

  return {
    type: 'FeatureCollection',
    features: [...groups.values()].map((item) => ({
      type: 'Feature',
      properties: {
        comuna_name: item.name,
        comuna_code: item.code,
        label: `${item.code}  ${item.name}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [
          (item.minX + item.maxX) / 2,
          (item.minY + item.maxY) / 2,
        ],
      },
    })),
  };
}

function formatCount(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function sandboxInspectHtml(cell, building, caseConfig = null) {
  const isNanjing = caseConfig?.id === CASE_IDS.NANJING;
  const placeLabel = caseConfig?.sandboxPlaceLabel
    ?? (isNanjing ? 'Xianlin · Qixia District · Nanjing' : SANDBOX_PLACE_MEDELLIN);

  if (building && (building.visualization_only || building.height_source || building.source_cell_id != null)) {
    const height = Number(building.visual_height_m ?? building.height_m);
    const source = String(building.height_source ?? 'visualization').replaceAll('_', ' ');
    const name = building.name ? String(building.name) : 'OSM building';
    const type = building.building ? String(building.building) : 'building';
    const cellId = Number(building.source_cell_id ?? cell?.cell_id);
    const display = Number(building.scenario_stress ?? building.visual_priority_score);
    const cls = Number.isFinite(display)
      ? screeningConditionClass(display, { nanjingStops: true })
      : (building.priority_class ? String(building.priority_class) : null);
    const lines = [
      `<strong>${name}</strong>`,
      `<span>${type} · ${Number.isFinite(height) ? `${height} m visual` : 'height n/a'}</span>`,
      `<span>${source} · visualization only</span>`,
    ];
    if (cls && Number.isFinite(display)) {
      lines.push(`<span>Screening condition ${display.toFixed(2)} · ${cls}</span>`);
    } else if (cls) {
      lines.push(`<span>Screening intensity · ${cls}</span>`);
    }
    if (Number.isFinite(cellId)) lines.push(`<span>Planning cell ${cellId}</span>`);
    return lines.join('');
  }

  const cellId = Number(cell?.cell_id ?? building?.cell_id);
  if (!Number.isFinite(cellId)) return '';

  const barrio = building?.BARRIO;
  const lines = [
    `<strong>Planning cell ${cellId}</strong>`,
    `<span>${isNanjing || !barrio || barrio === 'LLANADITAS No.2' ? placeLabel : `${barrio} · Comuna 8`}</span>`,
  ];

  if (cell) {
    const buildings = formatCount(cell.buildings);
    const people = formatCount(cell.population_proxy);
    const slope = Number(cell.mean_slope_deg);
    const hazard = formatCount(cell.high_hazard_buildings);
    const stress = Number(cell.drainage_stress_proxy);
    lines.push(`<span>${buildings} buildings · ~${people} people (proxy)</span>`);
    if (isNanjing && Number.isFinite(stress)) {
      lines.push(`<span>Drainage-stress screening proxy ${stress.toFixed(2)}</span>`);
    } else if (Number.isFinite(slope) && slope > 0) {
      lines.push(`<span>Mean slope ${slope.toFixed(1)}° · ${hazard} in official high hazard</span>`);
    }
  }

  if (building && !isNanjing) {
    const bits = [];
    const height = Number(building.height_m);
    const floors = Number(building.numero_pisos);
    const estrato = building.estrato;
    const hazardMax = building.hazard_max;
    if (Number.isFinite(floors) && floors > 0) bits.push(`${floors} floor${floors === 1 ? '' : 's'}`);
    if (Number.isFinite(height) && height > 0) bits.push(`${height.toFixed(0)} m`);
    if (estrato != null && estrato !== '') bits.push(`stratum ${estrato}`);
    if (hazardMax) bits.push(`hazard ${hazardMax}`);
    if (bits.length) lines.push(`<span>Building · ${bits.join(' · ')}</span>`);
  }

  return lines.join('');
}

function createViewResetControl(mapViews = MAP_VIEWS) {
  return {
    onAdd(map) {
      this._map = map;
      this._container = document.createElement('div');
      this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group map-view-ctrl';
      const button = document.createElement('button');
      button.type = 'button';
      button.title = 'Reset view';
      button.setAttribute('aria-label', 'Reset view');
      button.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 3.4 4 10.2h1.8V20h5.1v-5.6h2.2V20h5.1v-9.8H20L12 3.4z"/></svg>';
      button.addEventListener('click', () => {
        const sandbox = map.getLayer('buildings')
          && map.getLayoutProperty('buildings', 'visibility') === 'visible';
        map.stop();
        map.easeTo({
          ...(sandbox ? mapViews.sandbox : mapViews.city),
          duration: 700,
          essential: true,
        });
      });
      this._container.appendChild(button);
      return this._container;
    },
    onRemove() {
      this._container?.remove();
      this._map = undefined;
    },
  };
}

function projectPointFeature(project, cellsGeoJson, index) {
  const cellFeature = cellsGeoJson.features.find(
    (feature) => Number(feature.properties.cell_id) === Number(project.cell_id),
  );
  if (!cellFeature) return null;
  const ring = cellFeature.geometry.coordinates[0];
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return {
    type: 'Feature',
    properties: { ...project, index },
    geometry: {
      type: 'Point',
      coordinates: [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ],
    },
  };
}

function copyMapFrame(map) {
  try {
    const source = map.getCanvas();
    if (!source?.width || !source.height) return null;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0);
    const sampleW = Math.min(48, copy.width);
    const sampleH = Math.min(48, copy.height);
    const pixels = ctx.getImageData(0, 0, sampleW, sampleH).data;
    let luma = 0;
    const count = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      luma += pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
    }
    if (count < 1 || luma / count < 18) return null;
    const dataUrl = copy.toDataURL('image/jpeg', 0.84);
    if (!dataUrl.startsWith('data:image/jpeg')) return null;
    return { dataUrl, width: copy.width, height: copy.height };
  } catch {
    return null;
  }
}

export function createOureaMap({ container, data, onSelectCell, onSelectBarrio, onReady }) {
  if (!supportsWebGL2()) {
    throw new MapUnavailableError(
      'WebGL2 is required to render the 3D map. The decision workflow remains available.',
    );
  }

  const geometry = resolveMapGeometry(data);
  const mapViews = geometry.mapViews;
  const cityMaxBounds = geometry.cityMaxBounds;
  const sandboxBbox = geometry.sandboxBbox;
  const useLocalDem = geometry.useLocalDem;
  const useRemoteDem = Boolean(geometry.useRemoteDem);
  const useDem = useLocalDem || useRemoteDem;
  const caseConfig = data?.caseConfig ?? null;
  const isNanjing = caseConfig?.id === CASE_IDS.NANJING;
  const buildingMassingFc = isNanjing && data.buildingMassing?.features?.length
    ? data.buildingMassing
    : null;
  const buildingsForMap = buildingMassingFc ?? data.buildings;

  let cameraGeneration = 0;
  let settleTimer = 0;
  let map;
  let frameSnapshot = null;

  try {
    map = new maplibregl.Map({
    container,
    preserveDrawingBuffer: true,
    style: {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#11171a' } }],
    },
    ...mapViews.city,
    attributionControl: false,
    maxBounds: cityMaxBounds,
    minZoom: CAMERA.city.minZoom,
    maxZoom: CAMERA.sandbox.maxZoom,
    minPitch: 0,
    maxPitch: 70,
    dragRotate: true,
    pitchWithRotate: true,
    touchPitch: true,
    touchZoomRotate: true,
    keyboard: true,
    renderWorldCopies: false,
    fadeDuration: 120,
    cancelPendingTileRequestsWhileZooming: false,
    });
  } catch (error) {
    throw new MapUnavailableError(error?.message ?? String(error));
  }

  if (typeof map?.dragRotate?.enable !== 'function') {
    map?.remove?.();
    throw new MapUnavailableError('WebGL2 is required');
  }

  try {
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.keyboard.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right');
    map.addControl(createViewResetControl(mapViews), 'bottom-right');
  } catch (error) {
    map?.remove?.();
    throw new MapUnavailableError(error?.message ?? String(error));
  }
  map.on('error', (event) => {
    const message = String(event.error?.message ?? event.error ?? '');
    const terrainFault = (
      event.error?.name === 'InvalidStateError'
      || event.error?.name === 'RangeError'
      || /decoded|terrain|DEM|out of range source/i.test(message)
    );
    if (terrainFault) {
      if (map.getTerrain()) map.setTerrain(null);
      setVisibility(map, 'shade', false);
      return;
    }
    console.warn('MapLibre error', event.error ?? event);
  });

  const hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 12,
    className: 'map-hover-popup',
    maxWidth: '280px',
  });

  const inspectEl = document.createElement('div');
  inspectEl.className = 'map-inspect';
  inspectEl.hidden = true;
  container.appendChild(inspectEl);

  const cellsById = new Map(
    (data.cells?.features ?? []).map((feature) => [
      Number(feature.properties.cell_id),
      feature.properties,
    ]),
  );

  let hoveredCellId = null;

  const resizeObserver = new ResizeObserver(() => {
    map.resize();
  });
  resizeObserver.observe(container);

  function requestResize() {
    map.resize();
    requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
  }

  function clearSettleTimer() {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = 0;
    }
  }

  function afterSettled(generation, callback) {
    clearSettleTimer();
    let ran = false;
    const run = () => {
      if (ran || generation !== cameraGeneration) return;
      ran = true;
      clearSettleTimer();
      callback();
    };
    map.once('idle', run);
    settleTimer = window.setTimeout(run, 1500);
  }

  function sandboxCenterReady() {
    const { lng, lat } = map.getCenter();
    const minZoom = useDem ? 15.1 : 12.5;
    return (
      map.getZoom() >= minZoom
      && lng >= sandboxBbox[0]
      && lng <= sandboxBbox[2]
      && lat >= sandboxBbox[1]
      && lat <= sandboxBbox[3]
    );
  }

  function lockCamera(scope) {
    const limits = CAMERA[scope] ?? CAMERA.city;
    map.setMinZoom(limits.minZoom);
    map.setMaxZoom(limits.maxZoom);
    map.setMaxBounds(scope === 'city' ? cityMaxBounds : null);
  }

  function runCamera(scope, animate) {
    const generation = ++cameraGeneration;
    clearSettleTimer();
    map.stop();
    map.setMaxBounds(null);
    map.setMinZoom(CAMERA.city.minZoom);
    map.setMaxZoom(CAMERA.sandbox.maxZoom);
    if (map.getTerrain()) map.setTerrain(null);

    map.easeTo({
      ...(scope === 'sandbox' ? mapViews.sandbox : mapViews.city),
      duration: animate ? (scope === 'sandbox' ? 850 : 750) : 0,
      essential: true,
    });

    afterSettled(generation, () => {
      if (scope === 'sandbox' && !sandboxCenterReady()) {
        map.jumpTo(mapViews.sandbox);
      }
      lockCamera(scope);
      if (scope === 'sandbox') {
        setVisibility(map, 'buildings', true);
      }
    });
  }

  map.on('load', () => {
    requestResize();

    map.addSource('basemap', {
      type: 'raster',
      tiles: BASEMAP_TILES,
      tileSize: 256,
      maxzoom: 19,
      attribution: BASEMAP_ATTRIBUTION,
    });
    map.addLayer({
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      paint: {
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          11, 0.72,
          13, 0.58,
          15.5, 0.48,
          18, 0.42,
        ],
        'raster-saturation': -0.55,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.05,
        'raster-brightness-max': 0.85,
      },
    });
    const screeningForMap = {
      type: 'FeatureCollection',
      features: (data.screening?.features ?? []).filter(
        (feature) => feature.properties?.map_fill !== false,
      ),
    };
    map.addSource('screening', { type: 'geojson', data: screeningForMap });
    map.addLayer({
      id: 'screening-fill',
      type: 'fill',
      source: 'screening',
      paint: {
        'fill-color': cityFillExpression('balanced'),
        'fill-opacity': [
          'case',
          [
            'all',
            ['==', ['coalesce', ['get', 'population_2026'], -1], -1],
            ['==', ['coalesce', ['get', 'population_proxy'], -1], -1],
          ],
          0.28,
          isNanjing ? 0.62 : 0.78,
        ],
      },
    });
    map.addLayer({
      id: 'screening-outline',
      type: 'line',
      source: 'screening',
      paint: {
        'line-color': '#ece4d3',
        'line-opacity': isNanjing ? 0.55 : 0.42,
        'line-width': isNanjing ? 1.15 : 0.85,
      },
    });
    map.addLayer({
      id: 'screening-selected',
      type: 'line',
      source: 'screening',
      filter: ['==', ['get', 'OBJECTID'], -999999],
      paint: {
        'line-color': '#f1eadc',
        'line-opacity': 0.95,
        'line-width': 2.6,
      },
    });

    map.addSource('city-water', {
      type: 'geojson',
      data: data.contextWater ?? { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'city-water',
      type: 'fill',
      source: 'city-water',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#3d6f86',
        'fill-opacity': 0.35,
      },
    });

    map.addSource('city-roads', { type: 'geojson', data: data.roads ?? { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'city-roads',
      type: 'line',
      source: 'city-roads',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#d7c9a8',
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 14, 1.6],
      },
    });

    map.addSource('comunas', { type: 'geojson', data: comunaLabelCollection(data.screening) });
    map.addLayer({
      id: 'comuna-labels',
      type: 'symbol',
      source: 'comunas',
      minzoom: 11,
      maxzoom: 13.55,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 13.2, 14],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.05,
        'text-max-width': 9,
        'text-padding': 6,
        'text-allow-overlap': false,
        'symbol-sort-key': ['to-number', ['get', 'comuna_code']],
      },
      paint: {
        'text-color': '#f4eee3',
        'text-halo-color': '#101618',
        'text-halo-width': 1.6,
        'text-opacity': 0.94,
      },
    });
    map.addLayer({
      id: 'barrio-labels',
      type: 'symbol',
      source: 'screening',
      minzoom: 13.2,
      layout: {
        visibility: isNanjing ? 'none' : 'visible',
        'text-field': ['get', 'BARRIO'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13.2, 10, 15, 13],
        'text-max-width': 8,
        'text-padding': 2,
        'text-optional': true,
      },
      paint: {
        'text-color': '#f7f1e4',
        'text-halo-color': '#12181b',
        'text-halo-width': 1.25,
      },
    });

    map.addSource('place-labels', {
      type: 'geojson',
      data: data.placeLabels ?? { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'place-labels',
      type: 'symbol',
      source: 'place-labels',
      minzoom: 11.5,
      layout: {
        visibility: isNanjing ? 'visible' : 'none',
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 11, 14, 14],
        'text-max-width': 10,
        'text-padding': 4,
        'text-optional': true,
      },
      paint: {
        'text-color': '#f4eee3',
        'text-halo-color': '#101618',
        'text-halo-width': 1.5,
        'text-opacity': 0.95,
      },
    });

    map.addSource('sandbox-ground', { type: 'geojson', data: sandboxGroundFeature(sandboxBbox) });
    map.addLayer({
      id: 'sandbox-ground',
      type: 'fill',
      source: 'sandbox-ground',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#314147',
        'fill-opacity': 0.35,
      },
    });

    if (useLocalDem) {
      map.addSource('dem-shade', { ...DEM_SOURCE_TEMPLATE, bounds: sandboxBbox });
      map.addLayer({
        id: 'shade',
        type: 'hillshade',
        source: 'dem-shade',
        layout: { visibility: 'none' },
        paint: {
          'hillshade-exaggeration': 0.52,
          'hillshade-shadow-color': '#1c262b',
          'hillshade-highlight-color': '#efe6d2',
          'hillshade-accent-color': '#8b9693',
          'hillshade-illumination-direction': 315,
        },
      });
    } else if (useRemoteDem) {
      map.addSource('dem-shade', { ...REMOTE_DEM_SOURCE_TEMPLATE });
      map.addLayer({
        id: 'shade',
        type: 'hillshade',
        source: 'dem-shade',
        layout: { visibility: 'none' },
        paint: {
          'hillshade-exaggeration': 0.45,
          'hillshade-shadow-color': '#1c262b',
          'hillshade-highlight-color': '#efe6d2',
          'hillshade-accent-color': '#8b9693',
          'hillshade-illumination-direction': 315,
        },
      });
    }
    map.addSource('hazard', { type: 'geojson', data: data.hazard });
    map.addLayer({
      id: 'hazard',
      type: 'fill',
      source: 'hazard',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'match',
          ['coalesce', ['get', 'Categoria'], ['get', 'hazard_class'], ''],
          'Alta', '#e04b45',
          'Media', '#d99d3d',
          'Baja', '#4f9b68',
          '#5f7f8a',
        ],
        'fill-opacity': isNanjing ? 0.22 : 0.18,
      },
    });

    map.addSource('roads', { type: 'geojson', data: data.roads });
    map.addLayer({
      id: 'roads',
      type: 'line',
      source: 'roads',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#f0e7d0',
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.15, 18, 3.4],
      },
    });

    data.cells.features.forEach((feature) => {
      if (feature.id == null) feature.id = Number(feature.properties.cell_id);
    });
    map.addSource('cells', { type: 'geojson', data: data.cells });
    map.addLayer({
      id: 'cells-outline',
      type: 'line',
      source: 'cells',
      layout: { visibility: 'none' },
      paint: {
        'line-color': isNanjing ? '#c5d5dc' : '#a8bcc4',
        'line-opacity': isNanjing ? 0.22 : 0.42,
        'line-width': isNanjing ? 0.55 : 1.05,
      },
    });
    map.addLayer({
      id: 'cells-fill',
      type: 'fill',
      source: 'cells',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': isNanjing ? '#6aa3b5' : '#7cc4d7',
        'fill-opacity': 0,
      },
    });
    map.addLayer({
      id: 'cells-hit',
      type: 'fill',
      source: 'cells',
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#000000', 'fill-opacity': 0 },
    });
    map.addLayer({
      id: 'cells-hover-fill',
      type: 'fill',
      source: 'cells',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'cell_id'], -1],
      paint: {
        'fill-color': '#f4ead8',
        'fill-opacity': 0.18,
      },
    });

    buildingsForMap.features.forEach((feature, index) => {
      if (feature.id == null) feature.id = index + 1;
    });
    map.addSource('buildings', { type: 'geojson', data: buildingsForMap });
    map.addLayer({
      id: 'buildings',
      type: 'fill-extrusion',
      source: 'buildings',
      minzoom: isNanjing ? 13.8 : 0,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-height': isNanjing
          ? ['coalesce', ['get', 'visual_height_m'], ['get', 'height_m'], 8]
          : ['coalesce', ['get', 'height_m'], 3],
        'fill-extrusion-base': 0,
        // Live scenario_stress (baseline or residual).
        // Medellín: full [0,1] domain (Alta hazard + steep slopes).
        // Nanjing: same absolute baselineStress residuals, but color stops are
        // calibrated to the Baja/Media + low-slope domain (~0.12–0.55) so
        // Typical→Extreme and plan residuals remain visually distinguishable
        // without per-frame renormalization.
        'fill-extrusion-color': isNanjing
          ? [
            'interpolate', ['linear'],
            ['coalesce', ['feature-state', 'scenario_stress'], -1],
            -1, '#c56a58',
            0, '#4f9b68',
            0.18, '#7faf5a',
            0.28, '#c4a14b',
            0.36, '#d66f45',
            0.45, '#d7433c',
            0.6, '#761919',
            1, '#4a0f0f',
          ]
          : [
            'interpolate', ['linear'],
            ['coalesce', ['feature-state', 'scenario_stress'], -1],
            -1, '#c56a58',
            0, '#4f9b68',
            0.48, '#c4a14b',
            0.68, '#d66f45',
            0.82, '#d7433c',
            1, '#761919',
          ],
        'fill-extrusion-opacity': isNanjing ? 0.82 : 0.93,
        'fill-extrusion-vertical-gradient': true,
      },
    });
    map.addLayer({
      id: 'cells-hover',
      type: 'line',
      source: 'cells',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'cell_id'], -1],
      paint: {
        'line-color': '#f4ead8',
        'line-opacity': 0.95,
        'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.8, 18, 3.2],
      },
    });
    map.addLayer({
      id: 'cell-labels',
      type: 'symbol',
      source: 'cells',
      minzoom: isNanjing ? 16.2 : 15.7,
      layout: {
        visibility: 'none',
        'text-field': ['concat', 'Cell ', ['to-string', ['get', 'cell_id']]],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15.7, 10, 18, 13],
        'text-allow-overlap': false,
        'text-padding': 8,
      },
      paint: {
        'text-color': '#f4ead8',
        'text-halo-color': 'rgba(17,23,26,0.9)',
        'text-halo-width': 1.4,
        'text-opacity': 0.92,
      },
    });

    map.addSource('projects', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'projects',
      type: 'circle',
      source: 'projects',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 5, 18, 10],
        'circle-color': [
          'match', ['get', 'type'],
          'rwh', '#67b7d1', 'drainage', '#d2a24b', 'restoration', '#64a96d', '#ffffff',
        ],
        'circle-stroke-color': '#111111',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95,
      },
    });

    function isSandboxVisible() {
      return map.getLayer('buildings')
        && map.getLayoutProperty('buildings', 'visibility') === 'visible';
    }

    function visibleLayers(ids) {
      return ids.filter((id) => (
        map.getLayer(id) && map.getLayoutProperty(id, 'visibility') === 'visible'
      ));
    }

    function clearSandboxHover() {
      hoveredCellId = null;
      hoverPopup.remove();
      inspectEl.hidden = true;
      inspectEl.innerHTML = '';
      if (map.getLayer('cells-hover')) {
        map.setFilter('cells-hover', ['==', ['get', 'cell_id'], -1]);
      }
      if (map.getLayer('cells-hover-fill')) {
        map.setFilter('cells-hover-fill', ['==', ['get', 'cell_id'], -1]);
      }
      if (isSandboxVisible()) map.getCanvas().style.cursor = '';
    }

    function showSandboxInspect(event, cell, building, featureState = null) {
      const enriched = building && featureState
        ? { ...building, scenario_stress: featureState.scenario_stress }
        : building;
      const html = sandboxInspectHtml(cell, enriched, caseConfig);
      const cellId = Number(
        cell?.cell_id
          ?? building?.cell_id
          ?? building?.source_cell_id,
      );
      if (!html || !Number.isFinite(cellId)) {
        clearSandboxHover();
        return;
      }
      if (hoveredCellId !== cellId) {
        if (map.getLayer('cells-hover')) {
          map.setFilter('cells-hover', ['==', ['get', 'cell_id'], cellId]);
        }
        if (map.getLayer('cells-hover-fill')) {
          map.setFilter('cells-hover-fill', ['==', ['get', 'cell_id'], cellId]);
        }
      }
      hoveredCellId = cellId;
      inspectEl.innerHTML = html;
      inspectEl.hidden = false;
      hoverPopup.setLngLat(event.lngLat).setHTML(html).addTo(map);
      map.getCanvas().style.cursor = 'pointer';
    }

    map.on('click', 'screening-fill', (event) => {
      if (event.features?.length) onSelectBarrio?.(event.features[0].properties);
    });
    map.on('click', (event) => {
      if (!isSandboxVisible()) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: visibleLayers(['buildings', 'cells-hit', 'cells-fill']),
      });
      const props = hits[0]?.properties;
      const cellId = Number(props?.cell_id ?? props?.source_cell_id);
      if (Number.isFinite(cellId)) onSelectCell?.(cellId);
    });

    map.on('mousemove', 'screening-fill', (event) => {
      const properties = event.features?.[0]?.properties;
      if (!properties) return;
      const comuna = properties.comuna_name
        ? `Comuna ${properties.comuna_code} · ${properties.comuna_name}`
        : 'Special / unmatched polygon';
      hoverPopup
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${properties.BARRIO}</strong><span>${comuna}</span>`,
        )
        .addTo(map);
    });
    map.on('mouseleave', 'screening-fill', () => hoverPopup.remove());

    map.on('mousemove', (event) => {
      if (!isSandboxVisible() || event.originalEvent?.buttons) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: visibleLayers(['buildings', 'cells-hit', 'cells-fill', 'cells-outline']),
      });
      if (!hits.length) {
        clearSandboxHover();
        return;
      }
      const buildingHit = hits.find((feature) => feature.layer.id === 'buildings');
      const building = buildingHit?.properties;
      const cellId = Number(
        building?.cell_id
          ?? building?.source_cell_id
          ?? hits[0]?.properties?.cell_id
          ?? hits[0]?.properties?.source_cell_id,
      );
      showSandboxInspect(event, cellsById.get(cellId), building, buildingHit?.state);
    });
    map.getCanvas().addEventListener('mouseleave', clearSandboxHover);

    map.on('mouseenter', 'screening-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'screening-fill', () => { map.getCanvas().style.cursor = ''; });

    requestResize();
    onReady?.();
  });

  map.on('idle', () => {
    frameSnapshot = copyMapFrame(map);
  });

  function setCityLens(lens) {
    if (!map.getLayer('screening-fill')) return;
    map.setPaintProperty(
      'screening-fill',
      'fill-color',
      cityFillExpression(lens),
    );
  }

  function setScope(scope) {
    const isCity = scope === 'city';
    CITY_LAYER_IDS.forEach((id) => {
      if (id === 'barrio-labels' && isNanjing) {
        setVisibility(map, id, false);
        return;
      }
      if (id === 'place-labels') {
        setVisibility(map, id, isCity && isNanjing);
        return;
      }
      if (id === 'city-roads' || id === 'city-water') {
        setVisibility(map, id, isCity && isNanjing);
        return;
      }
      if (id === 'comuna-labels' && isNanjing) {
        setVisibility(map, id, false);
        return;
      }
      setVisibility(map, id, isCity);
    });
    SANDBOX_LAYER_IDS.forEach((id) => setVisibility(map, id, !isCity));
    hoveredCellId = null;
    inspectEl.hidden = true;
    inspectEl.innerHTML = '';
    hoverPopup.remove();
    if (map.getLayer('cells-hover')) {
      map.setFilter('cells-hover', ['==', ['get', 'cell_id'], -1]);
    }
    if (map.getLayer('cells-hover-fill')) {
      map.setFilter('cells-hover-fill', ['==', ['get', 'cell_id'], -1]);
    }
    if (map.getTerrain()) map.setTerrain(null);
    requestResize();
    if (!isCity) {
      setVisibility(map, 'buildings', true);
      setVisibility(map, 'sandbox-ground', true);
      setVisibility(map, 'projects', true);
      if (map.getLayer('shade')) setVisibility(map, 'shade', true);
      // Keep roads under the analytical grid for Nanjing detail view.
      if (isNanjing) setVisibility(map, 'roads', true);
    }
  }

  function focusBarrio(barrio) {
    const objectId = Number(barrio?.OBJECTID);
    if (!Number.isFinite(objectId)) return;

    const feature = data.screening.features.find(
      (item) => Number(item.properties.OBJECTID) === objectId,
    );
    const bounds = geometryBounds(feature?.geometry);
    if (!bounds) return;

    const generation = ++cameraGeneration;
    clearSettleTimer();
    map.stop();
    map.setMaxBounds(null);
    map.setMinZoom(CAMERA.city.minZoom);
    map.setMaxZoom(CAMERA.sandbox.maxZoom);
    try {
      map.fitBounds(bounds, {
        padding: { top: 96, right: 56, bottom: 72, left: 56 },
        maxZoom: 14.7,
        pitch: 0,
        bearing: 0,
        duration: 700,
        essential: true,
      });
    } catch {
      const [[west, south], [east, north]] = bounds;
      map.easeTo({
        center: [(west + east) / 2, (south + north) / 2],
        zoom: 14.2,
        pitch: 0,
        bearing: 0,
        duration: 700,
        essential: true,
      });
    }
    map.once('moveend', () => {
      if (generation !== cameraGeneration) return;
      lockCamera('city');
    });
  }

  function planCenter(projects, cellsGeoJson, fallback) {
    const points = [];
    for (const project of projects ?? []) {
      const feature = cellsGeoJson?.features?.find(
        (item) => Number(item.properties.cell_id) === Number(project.cell_id),
      );
      const bounds = geometryBounds(feature?.geometry);
      if (!bounds) continue;
      points.push([
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2,
      ]);
    }
    if (!points.length) return fallback;
    return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
  }

  function easeStory(view, lockScope) {
    const generation = ++cameraGeneration;
    clearSettleTimer();
    map.stop();
    map.setMaxBounds(null);
    map.setMinZoom(CAMERA.city.minZoom);
    map.setMaxZoom(CAMERA.sandbox.maxZoom);
    if (map.getTerrain()) map.setTerrain(null);
    map.easeTo({
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      duration: view.duration ?? 1100,
      essential: true,
    });
    afterSettled(generation, () => {
      lockCamera(lockScope);
      if (lockScope === 'sandbox') setVisibility(map, 'buildings', true);
    });
  }

  function playStoryCamera({ step, mode, barrio, projects, cellsGeoJson }) {
    if (mode === 'explore') {
      runCamera('sandbox', true);
      return;
    }
    if (step === 'area') {
      if (barrio) {
        focusBarrio(barrio);
        return;
      }
      runCamera('city', true);
      return;
    }

    const hillside = mapViews.sandbox;
    const frames = isNanjing
      ? {
        conditions: {
          center: hillside.center,
          zoom: Math.max(hillside.zoom ?? 15.35, 15.2),
          pitch: Math.max(hillside.pitch ?? 42, 38),
          bearing: hillside.bearing ?? 18,
          duration: 1700,
        },
        priorities: {
          center: hillside.center,
          zoom: 15.55,
          pitch: 44,
          bearing: (hillside.bearing ?? 18) + 4,
          duration: 1200,
        },
        portfolio: {
          center: hillside.center,
          zoom: 16.05,
          pitch: 48,
          bearing: (hillside.bearing ?? 18) + 6,
          duration: 1100,
        },
        review: {
          center: hillside.center,
          zoom: 16.45,
          pitch: 52,
          bearing: (hillside.bearing ?? 18) + 8,
          duration: 1100,
        },
        safeguards: {
          center: hillside.center,
          zoom: 16.75,
          pitch: 55,
          bearing: (hillside.bearing ?? 18) + 10,
          duration: 1100,
        },
      }
      : {
        conditions: { center: hillside.center, zoom: 14.85, pitch: 20, bearing: -8, duration: 1700 },
        priorities: { center: hillside.center, zoom: 15.55, pitch: 28, bearing: -10, duration: 1200 },
        portfolio: { center: hillside.center, zoom: 16.35, pitch: 36, bearing: -12, duration: 1100 },
        review: { center: hillside.center, zoom: 16.85, pitch: 44, bearing: -16, duration: 1100 },
        safeguards: { center: hillside.center, zoom: 17.15, pitch: 50, bearing: -22, duration: 1100 },
      };
    const frame = frames[step] ?? { ...hillside, duration: 1100 };
    if ((step === 'review' || step === 'safeguards') && projects?.length) {
      frame.center = planCenter(projects, cellsGeoJson, hillside.center);
    }
    easeStory(frame, 'sandbox');
  }

  function setSelectedBarrio(barrio) {
    if (!map.getLayer('screening-selected')) return;
    const objectId = Number(barrio?.OBJECTID);
    map.setFilter(
      'screening-selected',
      Number.isFinite(objectId)
        ? ['==', ['get', 'OBJECTID'], objectId]
        : ['==', ['get', 'OBJECTID'], -999999],
    );
  }

  function focusCell(cellId, cellsGeoJson) {
    const feature = cellsGeoJson?.features?.find(
      (item) => Number(item.properties.cell_id) === Number(cellId),
    );
    const bounds = geometryBounds(feature?.geometry);
    if (!bounds) {
      setSelectedCell(cellId);
      return;
    }
    const center = [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2,
    ];
    setSelectedCell(cellId);
    easeStory({
      center,
      zoom: 17.7,
      pitch: 50,
      bearing: -20,
      duration: 1100,
    }, 'sandbox');
  }

  function setSelectedCell(cellId) {
    if (!map.getLayer('cells-fill')) return;
    const expression = cellId == null
      ? 0
      : ['case', ['==', ['get', 'cell_id'], Number(cellId)], 0.22, 0.012];
    map.setPaintProperty('cells-fill', 'fill-opacity', expression);
  }

  function setLayerVisibility(layerState) {
    const mapping = {
      hazard: ['hazard'],
      cells: ['cells-outline', 'cells-fill'],
      roads: ['roads'],
    };
    for (const [key, ids] of Object.entries(mapping)) {
      for (const id of ids) setVisibility(map, id, Boolean(layerState[key]));
    }
  }

  function updateBuildingStress(buildingsGeoJson) {
    if (!map.getSource('buildings')) return;

    // Nanjing: map live engine stress from 80 exposure proxies onto OSM massing by cell.
    if (isNanjing && buildingMassingFc) {
      const byCell = stressByCellId(buildingsGeoJson);
      for (const feature of buildingsForMap.features) {
        const id = feature.id;
        if (id == null) continue;
        map.setFeatureState(
          { source: 'buildings', id },
          { scenario_stress: massingDisplayStress(feature, byCell) },
        );
      }
      return;
    }

    if (!buildingsGeoJson?.features) return;
    for (const feature of buildingsGeoJson.features) {
      const id = feature.id;
      if (id == null) continue;
      map.setFeatureState(
        { source: 'buildings', id },
        { scenario_stress: Number(feature.properties.scenario_stress) || 0 },
      );
    }
  }

  function updateProjects(projects, cellsGeoJson) {
    const features = projects
      .map((project, index) => projectPointFeature(project, cellsGeoJson, index))
      .filter(Boolean);
    map.getSource('projects')?.setData({ type: 'FeatureCollection', features });
  }

  return {
    map,
    setScope,
    setCityLens,
    focusBarrio,
    playStoryCamera,
    setSelectedBarrio,
    setSelectedCell,
    focusCell,
    setLayerVisibility,
    updateBuildingStress,
    updateProjects,
    captureImage() {
      return frameSnapshot ?? copyMapFrame(map);
    },
    destroy: () => {
      if (!map) return;
      clearSettleTimer();
      hoverPopup.remove();
      inspectEl.remove();
      resizeObserver.disconnect();
      map.remove();
    },
  };
}

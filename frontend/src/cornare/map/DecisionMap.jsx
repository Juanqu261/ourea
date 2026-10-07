import { useEffect, useRef, useState } from 'react';
import { Map, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { boundsOf } from './bounds.js';
import { GREEN_BLUE_LAYERS } from './focus.js';

setWorkerUrl(`${import.meta.env.BASE_URL}vendor/maplibre/maplibre-gl-worker.mjs`);

const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const LOCAL_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#161c1f' } }],
};
const TERRAIN_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
const TERRAIN_ATTRIBUTION = 'Terrain Tiles via AWS Open Data. https://github.com/tilezen/joerd/blob/master/docs/attribution.md';

const FILL_COLOR = {
  wetlands: '#3f8f98',
  protected_areas: '#6c9878',
  rio_negro_riparian: '#5d91a7',
  la_marinilla_ecosystem: '#527d64',
  la_marinilla_zoning: '#8fb89a',
  mass_movement: '#d87549',
};

const GROUPS = [
  ['territory', 'Territorio'],
  ['nature', 'Naturaleza'],
  ['risk', 'Contexto de amenaza'],
  ['decision', 'Decisión'],
];

export function DecisionMap({
  boundaries,
  colors,
  selectedIds = [],
  shadingLabel,
  focus = null,
  onMunicipality,
}) {
  const node = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const boundariesRef = useRef(boundaries);
  const colorsRef = useRef(colors);
  const selectedRef = useRef(selectedIds);
  const shadingRef = useRef(true);
  const modeRef = useRef('2d');
  const exaggerationRef = useRef(1);
  const handlers = useRef({});
  const [mode, setMode] = useState('2d');
  const [exaggeration, setExaggeration] = useState(1);
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  ));
  const [layers, setLayers] = useState([]);
  const [basemapOn, setBasemapOn] = useState(true);
  const [hillshadeOn, setHillshadeOn] = useState(true);
  const [shadingOn, setShadingOn] = useState(true);
  const [note, setNote] = useState('');
  const [card, setCard] = useState(null);
  boundariesRef.current = boundaries;
  colorsRef.current = colors;
  selectedRef.current = selectedIds;
  shadingRef.current = shadingOn;
  modeRef.current = mode;
  exaggerationRef.current = exaggeration;
  handlers.current = { onCard: setCard, onMunicipality, shading: shadingLabel };

  function commitLayers(updater) {
    setLayers((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      layersRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;
    (async () => {
      try {
        const response = await fetch(`${base}data/cornare/map/catalog.json`);
        if (!response.ok) throw new Error('catalog');
        const catalog = await response.json();
        const entries = [];
        for (const layer of catalog.layers ?? []) {
          try {
            const file = await fetch(`${base}data/cornare/map/${layer.file}`);
            if (!file.ok) throw new Error(layer.id);
            const data = await file.json();
            if (cancelled) return;
            entries.push({ ...layer, data, visible: Boolean(layer.defaultVisible), unavailable: false });
            commitLayers([...entries]);
          } catch {
            entries.push({ ...layer, data: null, visible: false, unavailable: true });
          }
        }
        const flood = (catalog.runtime ?? []).find((layer) => layer.id === 'flood');
        if (flood?.tiles?.length) {
          entries.push({ ...flood, data: null, visible: false, unavailable: false });
        }
        if (!cancelled) commitLayers(entries);
      } catch {
        if (!cancelled) setNote('El contexto espacial local no cargó. Siguen los municipios.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!boundaries?.features?.length || !node.current) return undefined;
    const terrainFailed = { current: false };
    const styleStep = { current: 0 };
    const frame = boundsOf(boundaries);
    const center = frame
      ? [(frame[0][0] + frame[1][0]) / 2, (frame[0][1] + frame[1][1]) / 2]
      : [-75.42, 6.22];
    const map = new Map({
      container: node.current,
      style: DARK_STYLE,
      center,
      zoom: 10,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      attributionControl: true,
      fadeDuration: 0,
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    const useLocalStyle = () => {
      styleStep.current = 2;
      map.setStyle(LOCAL_STYLE);
      setNote('El mapa base no respondió. Siguen los límites y el contexto local.');
      setBasemapOn(false);
    };

    map.on('error', (event) => {
      const sourceId = event.sourceId || event.error?.sourceId;
      const message = String(event.error?.message || '');
      const url = String(event.error?.url || '');
      if (sourceId === 'terrain') {
        terrainFailed.hits = (terrainFailed.hits || 0) + 1;
        if (terrainFailed.hits >= 8 && !terrainFailed.current && modeRef.current === '3d') {
          terrainFailed.current = true;
          map.__terrainFailed = true;
          if (map.getTerrain()) map.setTerrain(null);
          if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade', 'visibility', 'none');
          setHillshadeOn(false);
          setMode('2d');
          setNote('El terreno externo no cargó. El mapa sigue en 2D.');
        }
        return;
      }
      if (sourceId === 'flood') {
        if (map.getLayer('flood')) map.setLayoutProperty('flood', 'visibility', 'none');
        commitLayers((current) => current.map((layer) => (
          layer.id === 'flood' ? { ...layer, visible: false, unavailable: true } : layer
        )));
        setNote('La capa de inundación de CORNARE no está disponible en este momento.');
        return;
      }
      const styleDocumentFailed = !sourceId && /styles\/(dark|liberty)/.test(`${url} ${message}`);
      if (styleDocumentFailed && styleStep.current < 2 && !map.isStyleLoaded()) {
        styleStep.current += 1;
        if (styleStep.current === 1) map.setStyle(LIBERTY_STYLE);
        else useLocalStyle();
      }
    });

    const styled = { current: false };
    map.on('style.load', () => {
      styled.current = true;
      installBase(map, boundariesRef.current, terrainFailed, handlers);
      syncContext(map, layersRef.current);
      if (map.getLayer('municipalities')) {
        map.setPaintProperty('municipalities', 'fill-color', colorExpression(colorsRef.current));
        map.setPaintProperty('municipalities', 'fill-opacity', shadingRef.current ? opacityExpression(selectedRef.current) : 0);
      }
      map.resize();
      const nextFrame = boundsOf(boundariesRef.current);
      if (nextFrame) {
        map.fitBounds(nextFrame, {
          padding: 36,
          duration: 0,
          pitch: modeRef.current === '3d' ? 60 : 0,
          bearing: modeRef.current === '3d' ? -28 : 0,
        });
      }
      applyView(map, modeRef.current, exaggerationRef.current);
      setReady(true);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(node.current);
    const timer = window.setTimeout(() => {
      if (!styled.current && styleStep.current < 2) useLocalStyle();
    }, 8000);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [boundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer('municipalities')) return;
    map.setPaintProperty('municipalities', 'fill-color', colorExpression(colors));
    map.setPaintProperty('municipalities', 'fill-opacity', shadingOn ? opacityExpression(selectedIds) : 0);
    const filter = selectedIds.length
      ? ['in', ['get', 'id'], ['literal', selectedIds]]
      : ['==', ['get', 'id'], ''];
    if (map.getLayer('municipalities-selected')) map.setFilter('municipalities-selected', filter);
  }, [colors, selectedIds, shadingOn, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded()) return;
    syncContext(map, layers);
    layers.forEach((layer) => {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', layer.visible && !layer.unavailable ? 'visible' : 'none');
    });
  }, [layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    applyView(map, mode, exaggeration);
  }, [mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || mode !== '3d' || map.__terrainFailed || !map.getSource('terrain')) return;
    map.setTerrain({ source: 'terrain', exaggeration });
  }, [exaggeration, mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer('hillshade')) return;
    map.setLayoutProperty('hillshade', 'visibility', hillshadeOn ? 'visible' : 'none');
  }, [hillshadeOn, ready]);

  const focusKey = focus
    ? `${focus.measureId}|${focus.municipalityIds.join(',')}|${focus.layerIds.join(',')}`
    : '';
  const loadedLayerIds = layers.map((layer) => layer.id).join(',');

  useEffect(() => {
    if (!focus?.measureId) return;
    setCard({
      title: focus.title,
      lines: [
        ['Ámbito de decisión', focus.scopeLabel],
        ['Contexto espacial disponible', focus.contextLabel],
        ['Ubicación exacta', focus.exactLocation],
        ['Fuente', focus.sourceLabel],
      ],
    });
    commitLayers((current) => {
      if (!current.some((layer) => focus.layerIds.includes(layer.id) && !layer.visible)) return current;
      return current.map((layer) => (
        focus.layerIds.includes(layer.id) ? { ...layer, visible: true } : layer
      ));
    });
    const map = mapRef.current;
    if (!ready || !map) return;
    const frame = boundsOf({
      features: boundaries.features.filter((feature) => focus.municipalityIds.includes(feature.properties.id)),
    }) || boundsOf(boundaries);
    if (frame) map.fitBounds(frame, { padding: 48, duration: motion(), pitch: mode === '3d' ? 60 : 0, bearing: mode === '3d' ? -28 : 0 });
  }, [focusKey, loadedLayerIds, ready, mode]);

  function fitHome() {
    const map = mapRef.current;
    const frame = boundsOf(boundaries);
    if (!map || !frame) return;
    map.fitBounds(frame, { padding: 36, pitch: mode === '3d' ? 60 : 0, bearing: mode === '3d' ? -28 : 0, duration: motion() });
  }

  function toggleBasemap() {
    const map = mapRef.current;
    if (!map?.getStyle()) return;
    const next = !basemapOn;
    setBasemapOn(next);
    (map.getStyle().layers ?? []).forEach((layer) => {
      if (isOverlay(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', next ? 'visible' : 'none');
    });
    if (map.getLayer('building-3d') && mode !== '3d') {
      map.setLayoutProperty('building-3d', 'visibility', 'none');
    }
  }

  return (
    <figure className="decision-map">
      <div ref={node} className="decision-map-canvas" data-testid="decision-map" data-ready={ready ? 'true' : 'false'} data-shading={shadingLabel} />
      <div className="map-toolbar">
        <div className="map-modes" role="group" aria-label="Modo del mapa">
          <button type="button" className={mode === '2d' ? 'is-active' : ''} data-testid="mode-2d" onClick={() => setMode('2d')}>2D</button>
          <button type="button" className={mode === '3d' ? 'is-active' : ''} data-testid="mode-3d" onClick={() => setMode('3d')}>3D</button>
        </div>
        <button type="button" onClick={fitHome} data-testid="map-home">Corredor</button>
        <button type="button" data-testid="layer-panel-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}>Capas</button>
      </div>
      {panelOpen && (
        <div className="map-panel" data-testid="layer-panel">
          <section>
            <h3>Base</h3>
            <label><input data-testid="basemap-toggle" type="checkbox" checked={basemapOn} onChange={toggleBasemap} /> Mapa vectorial</label>
            <label><input type="checkbox" checked={hillshadeOn} onChange={() => setHillshadeOn((value) => !value)} /> Relieve</label>
            {mode === '3d' && (
              <label className="terrain-scale">
                Exageración {exaggeration.toFixed(1)}
                <input
                  data-testid="terrain-exaggeration"
                  type="range"
                  min="1"
                  max="1.3"
                  step="0.1"
                  value={exaggeration}
                  onChange={(event) => setExaggeration(Number(event.target.value))}
                />
              </label>
            )}
          </section>
          {GROUPS.map(([id, label]) => (
            <section key={id}>
              <h3>{label}</h3>
              {id === 'decision' && (
                <label><input type="checkbox" checked={shadingOn} onChange={() => setShadingOn((value) => !value)} /> Sombreado del diagnóstico</label>
              )}
              {layers.filter((layer) => layer.group === id).map((layer) => (
                <label key={layer.id}>
                  <input
                    type="checkbox"
                    data-testid={`layer-${layer.id}`}
                    checked={layer.visible}
                    disabled={layer.unavailable}
                    onChange={() => commitLayers((current) => current.map((item) => (
                      item.id === layer.id ? { ...item, visible: !item.visible } : item
                    )))}
                  />
                  {layer.label}
                  {layer.unavailable ? ' (no disponible)' : ''}
                </label>
              ))}
            </section>
          ))}
          <button
            type="button"
            data-testid="green-blue"
            onClick={() => commitLayers((current) => current.map((layer) => (
              GREEN_BLUE_LAYERS.includes(layer.id) ? { ...layer, visible: true } : layer
            )))}
          >
            Red verde-azul
          </button>
          <p>Contexto espacial para mirar conectividad y soluciones basadas en la naturaleza. No marca predios óptimos.</p>
        </div>
      )}
      <p className="map-help">Arrastra para mover · Ctrl/arrastre o clic derecho para rotar</p>
      {note && <p className="map-note" data-testid="map-note">{note}</p>}
      <figcaption>{shadingLabel}</figcaption>
      <ul className="map-legend">
        {(boundaries?.features ?? []).map((feature) => (
          <li key={feature.properties.id}>
            <i style={{ background: colors?.[feature.properties.id] ?? '#2a3338' }} />
            {feature.properties.name}
          </li>
        ))}
      </ul>
      {card && (
        <aside className="map-card" data-testid="map-focus-card">
          <h3>{card.title}</h3>
          <dl>
            {card.lines.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </aside>
      )}
    </figure>
  );
}

function installBase(map, boundaries, terrainFailed, handlers) {
  if (!terrainFailed.current && !map.getSource('terrain')) {
    try {
      map.__terrainFailed = false;
      map.addSource('terrain', {
        type: 'raster-dem',
        encoding: 'terrarium',
        tiles: TERRAIN_TILES,
        tileSize: 256,
        minzoom: 0,
        maxzoom: 15,
        attribution: TERRAIN_ATTRIBUTION,
      });
      if (!map.getLayer('hillshade')) {
        const before = (map.getStyle().layers ?? []).find((layer) => layer.type === 'symbol')?.id;
        map.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrain',
          paint: {
            'hillshade-exaggeration': 0.28,
            'hillshade-shadow-color': '#0c1012',
            'hillshade-highlight-color': '#efe8dc',
            'hillshade-illumination-direction': 315,
            'hillshade-illumination-anchor': 'map',
          },
        }, before);
      }
    } catch {
      terrainFailed.current = true;
      map.__terrainFailed = true;
    }
  }
  ensureBuildings(map);
  if (!map.getSource('corridor')) {
    map.addSource('corridor', {
      type: 'geojson',
      data: boundaries,
      promoteId: 'id',
      attribution: 'Límites municipales: DANE MGN 2025',
    });
    map.addLayer({
      id: 'municipalities',
      type: 'fill',
      source: 'corridor',
      paint: { 'fill-color': '#2a3338', 'fill-opacity': 0.42 },
    });
    map.addLayer({
      id: 'municipalities-line',
      type: 'line',
      source: 'corridor',
      paint: { 'line-color': '#eee8dc', 'line-width': 1.8 },
    });
    map.addLayer({
      id: 'municipalities-selected',
      type: 'line',
      source: 'corridor',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'line-color': '#c8a75e', 'line-width': 3.4 },
    });
  }
  bindPointer(map, handlers);
}

function syncContext(map, layers) {
  layers.forEach((layer) => {
    if (layer.unavailable || map.getSource(layer.id)) return;
    if (layer.kind === 'raster') {
      if (!layer.tiles?.length) return;
      map.addSource(layer.id, {
        type: 'raster',
        tiles: layer.tiles,
        tileSize: 256,
        attribution: layer.attribution,
      });
      map.addLayer({
        id: layer.id,
        type: 'raster',
        source: layer.id,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.55 },
      }, map.getLayer('municipalities') ? 'municipalities' : undefined);
      return;
    }
    if (!layer.data) return;
    map.addSource(layer.id, { type: 'geojson', data: layer.data });
    addVectorLayer(map, layer);
  });
}

function addVectorLayer(map, layer) {
  const before = map.getLayer('municipalities-line') ? 'municipalities-line' : undefined;
  if (layer.kind === 'line') {
    map.addLayer({
      id: layer.id,
      type: 'line',
      source: layer.id,
      layout: { visibility: layer.visible ? 'visible' : 'none' },
      paint: {
        'line-color': layer.id === 'hydrography' ? '#7eb6c9' : '#eee8dc',
        'line-width': layer.id === 'hydrography' ? 1.8 : 1.3,
        ...(layer.id === 'pomca_rio_negro' ? { 'line-dasharray': [2, 1.2] } : {}),
      },
    }, before);
    return;
  }
  map.addLayer({
    id: layer.id,
    type: 'fill',
    source: layer.id,
    layout: { visibility: layer.visible ? 'visible' : 'none' },
    paint: {
      'fill-color': layer.id === 'mass_movement'
        ? ['match', ['get', 'amenaza'], 'muy_alta', '#a8443f', 'alta', '#d87549', 'media', '#c8a75e', 'baja', '#527d64', '#8c999d']
        : (FILL_COLOR[layer.id] ?? '#6c9878'),
      'fill-opacity': layer.id === 'mass_movement' ? 0.48 : 0.38,
    },
  }, before);
}

function ensureBuildings(map) {
  if (map.getLayer('building-3d') || !map.getSource('openmaptiles')) return;
  map.addLayer({
    id: 'building-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': '#d9d3c6',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.82,
    },
  });
}

function bindPointer(map, handlers) {
  if (map.__oureaBound) return;
  map.__oureaBound = true;
  const interactive = () => ['municipalities', ...contextIds(map)];
  map.on('mousemove', (event) => {
    const layers = interactive().filter((id) => map.getLayer(id));
    if (!layers.length) return;
    const features = map.queryRenderedFeatures(event.point, { layers });
    map.getCanvas().style.cursor = features.length ? 'pointer' : '';
  });
  map.on('click', (event) => {
    const visible = interactive().filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    if (!visible.length) return;
    const feature = map.queryRenderedFeatures(event.point, { layers: visible })[0];
    if (!feature) return;
    const properties = feature.properties ?? {};
    const title = properties.name || properties.amenaza_label || 'Elemento del mapa';
    const lines = [
      ['Capa', properties.layer_id || 'Municipio'],
      ['Categoría', properties.category || properties.amenaza_label || 'Límite municipal'],
      ['Ubicación exacta', properties.layer_id ? 'Por definir' : 'No aplica: es el límite municipal'],
      ['Fuente', properties.source_id || 'DANE MGN 2025'],
    ];
    if (!properties.layer_id && handlers.current.shading) lines.unshift(['Lectura', handlers.current.shading]);
    if (properties.limitation) lines.push(['Límite', properties.limitation]);
    handlers.current.onCard?.({ title, lines });
    if (!properties.layer_id && properties.id) handlers.current.onMunicipality?.(properties.id);
  });
}

function contextIds(map) {
  return (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.source
      && layer.source !== 'openmaptiles'
      && layer.source !== 'ne2_shaded'
      && layer.source !== 'terrain'
      && layer.source !== 'flood'
      && !['municipalities-line', 'municipalities-selected', 'hillshade'].includes(layer.id))
    .map((layer) => layer.id);
}

function applyView(map, mode, exaggeration) {
  const reduced = motion() === 0;
  if (mode === '3d') {
    if (!map.__terrainFailed && map.getSource('terrain')) {
      try {
        map.setTerrain({ source: 'terrain', exaggeration });
      } catch {
        map.__terrainFailed = true;
        map.setTerrain(null);
      }
    }
    if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', 'visible');
    map.easeTo({ pitch: 60, bearing: -28, duration: reduced ? 0 : 900 });
    return;
  }
  if (map.getTerrain()) map.setTerrain(null);
  if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', 'none');
  map.easeTo({ pitch: 0, bearing: 0, duration: reduced ? 0 : 700 });
}

function colorExpression(colors = {}) {
  const expression = ['match', ['get', 'id']];
  Object.entries(colors).forEach(([id, color]) => expression.push(id, color));
  expression.push('#2a3338');
  return expression.length > 3 ? expression : '#2a3338';
}

function opacityExpression(selectedIds) {
  if (!selectedIds.length) return 0.42;
  return ['case', ['in', ['get', 'id'], ['literal', selectedIds]], 0.62, 0.16];
}

function isOverlay(id) {
  return ['hillshade', 'municipalities', 'municipalities-line', 'municipalities-selected', 'flood'].includes(id)
    || ['wetlands', 'protected_areas', 'rio_negro_riparian', 'la_marinilla_ecosystem', 'la_marinilla_zoning', 'hydrography', 'pomca_rio_negro', 'mass_movement'].includes(id);
}

function motion() {
  if (typeof window === 'undefined') return 0;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800;
}

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { boundsOf } from '../src/cornare/map/bounds.js';
import { focusForMeasure } from '../src/cornare/map/focus.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(path, 'utf8');

test('bounds follow nested polygon and multipolygon coordinates', () => {
  const polygon = boundsOf({
    features: [{ geometry: { type: 'Polygon', coordinates: [[[-75.5, 6.1], [-75.2, 6.1], [-75.2, 6.4], [-75.5, 6.1]]] } }],
  });
  assert.deepEqual(polygon, [[-75.5, 6.1], [-75.2, 6.4]]);
  const multi = boundsOf({
    features: [{
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-76, 5], [-75, 5], [-75, 6], [-76, 5]]],
          [[[-74, 7], [-73, 7], [-73, 8], [-74, 7]]],
        ],
      },
    }],
  });
  assert.deepEqual(multi, [[-76, 5], [-73, 8]]);
});

test('a portfolio focus never invents a project coordinate', () => {
  const focus = focusForMeasure({
    id: 'water_eff',
    name: 'Uso eficiente del agua',
    placement: { candidates: [{ municipalityId: 'marinilla' }] },
    place: { localization: 'Marinilla' },
  });
  assert.deepEqual(focus.municipalityIds, ['marinilla']);
  assert.equal(focus.exactLocation, 'Ubicación por validar');
  assert.equal(JSON.stringify(focus).includes('coordinates'), false);
  assert.equal(focus.layerIds.includes('hydrography'), true);
  const corridor = focusForMeasure({
    id: 'bio_pa',
    name: 'Áreas protegidas',
    placement: { candidates: [{ municipalityId: 'rionegro' }, { municipalityId: 'guarne' }] },
    place: { localization: 'Corredor Rionegro–Guarne–Marinilla' },
  });
  assert.deepEqual(corridor.municipalityIds, ['rionegro', 'guarne']);
  assert.equal(corridor.exactLocation, 'Área candidata para prefactibilidad');
});

test('map modules do not call keyed or legacy tile services', () => {
  const root = join(here, '../src/cornare/map');
  const banned = [/mapbox/i, /api[_-]?key/i, /google\.com\/vt/i, /llanaditas/i, /pk\.[a-z0-9]/i];
  const files = readdirSync(root).filter((name) => name.endsWith('.js') || name.endsWith('.jsx'));
  files.forEach((name) => {
    const text = read(join(root, name));
    banned.forEach((pattern) => assert.equal(pattern.test(text), false, `${name} ${pattern}`));
  });
  assert.match(read(join(root, 'DecisionMap.jsx')), /setWorkerUrl\(/);
});

test('every cached GIS layer is registered', () => {
  const data = join(here, '../public/data/cornare');
  const catalogPath = join(data, 'map/catalog.json');
  const catalog = JSON.parse(read(catalogPath));
  const registry = JSON.parse(read(join(data, 'source_registry.json')));
  const ids = new Set(registry.sources.map((source) => source.id));
  catalog.layers.forEach((layer) => {
    assert.equal(ids.has(layer.sourceId), true, layer.id);
    const file = join(data, 'map', layer.file);
    assert.equal(statSync(file).isFile(), true);
    const collection = JSON.parse(read(file));
    assert.equal(collection.type, 'FeatureCollection');
    collection.features.forEach((feature) => {
      assert.equal(Object.hasOwn(feature.geometry, 'coordinates'), true);
      assert.equal(feature.properties.exact_site, false);
    });
  });
  assert.equal(ids.has('gis-aws-terrarium'), true);
  assert.equal(ids.has('gis-openfreemap'), true);
  assert.equal(ids.has('gis-cornare-dtm-not-used'), true);
});

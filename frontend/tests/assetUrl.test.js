import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl, baseUrl } from '../src/config/assetUrl.js';

test('assetUrl prefixes BASE_URL and strips a leading slash', () => {
  assert.equal(baseUrl().endsWith('/'), true);
  assert.equal(assetUrl('data/climate_context.json').endsWith('data/climate_context.json'), true);
  assert.equal(assetUrl('/data/buildings.geojson'), assetUrl('data/buildings.geojson'));
  assert.ok(!assetUrl('data/buildings.geojson').includes('//data/'));
});

test('assetUrl keeps MapLibre tile templates intact', () => {
  const tiles = assetUrl('terrain/{z}/{x}/{y}.png');
  assert.match(tiles, /terrain\/\{z\}\/\{x\}\/\{y\}\.png$/);
});

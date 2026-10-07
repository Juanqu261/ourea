import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  CITY_SCREEN_CONTRACT,
  countSafePopulationMatches,
  countSpatialPolygons,
  isRankableCityFeature,
  topScreening,
} from '../src/domain/cityScreen.js';
import { numeric } from '../src/domain/numeric.js';

const screening = JSON.parse(
  await readFile(
    fileURLToPath(new URL('../public/data/medellin_city_priority_screen.geojson', import.meta.url)),
    'utf8',
  ),
);

test('numeric does not coerce missing values to zero', () => {
  assert.equal(numeric(null), null);
  assert.notEqual(numeric(null), 0);
  assert.equal(numeric(undefined), null);
  assert.notEqual(numeric(undefined), 0);
  assert.equal(numeric(''), null);
  assert.equal(numeric('   '), null);
  assert.equal(numeric(Number.NaN), null);
  assert.equal(numeric(Number.POSITIVE_INFINITY), null);
  assert.equal(numeric('12.5'), 12.5);
  assert.equal(numeric(0), 0);
});

test('city contract matches the shipped GeoJSON provenance', () => {
  assert.equal(countSpatialPolygons(screening), CITY_SCREEN_CONTRACT.spatial_polygons);
  assert.equal(countSafePopulationMatches(screening), CITY_SCREEN_CONTRACT.safe_population_matches);
  assert.equal(CITY_SCREEN_CONTRACT.official_urban_records, 249);
  const unmatched = screening.features.filter(
    (feature) =>
      feature.properties.population_match === CITY_SCREEN_CONTRACT.unmatched_population_match_value,
  );
  assert.equal(unmatched.length, 23);
  assert.ok(unmatched.every((feature) => !isRankableCityFeature(feature, 'balanced')));
});

test('balanced top 8 is ranks 1-8 with no unmatched polygons', () => {
  const top = topScreening(screening, 'balanced');
  assert.equal(top.length, 8);
  assert.deepEqual(
    top.map((feature) => numeric(feature.properties.rank_balanced)),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  for (const feature of top) {
    assert.ok(feature.properties.comuna_name);
    assert.ok(!String(feature.properties.comuna_name).includes('Special'));
    assert.notEqual(feature.properties.BARRIO, 'PLAZA DE FERIAS');
    assert.ok(numeric(feature.properties.population_2026) > 0);
  }
  assert.equal(top[0].properties.BARRIO, 'SANTO DOMINGO SAVIO No.1');
});

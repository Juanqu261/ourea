import cityScreenContract from '../config/cityScreenContract.json' with { type: 'json' };
import { CITY_LENSES } from '../config/uiCopy.js';
import { numeric } from './numeric.js';

export const CITY_SCREEN_CONTRACT = Object.freeze({
  ...cityScreenContract,
  rankable_population_match_values: Object.freeze([
    ...cityScreenContract.rankable_population_match_values,
  ]),
});

const RANKABLE_MATCH = new Set(CITY_SCREEN_CONTRACT.rankable_population_match_values);

export function lensConfig(lensId, lensesOverride) {
  const lenses = lensesOverride ?? CITY_LENSES;
  return lenses[lensId] ?? lenses.balanced ?? CITY_LENSES.balanced;
}

function populationProxyValue(properties) {
  return (
    numeric(properties.population_2026)
    ?? numeric(properties.population_proxy)
    ?? numeric(properties.population_estimate)
  );
}

export function isRankableCityFeature(feature, lensId, lensesOverride) {
  const properties = feature?.properties ?? {};
  const lens = lensConfig(lensId, lensesOverride);
  const rank = numeric(properties[lens.rankField]);
  const score = numeric(properties[lens.scoreField]);
  if (
    rank == null
    || !Number.isInteger(rank)
    || rank < 1
    || score == null
  ) {
    return false;
  }

  // Medellín barrio screen: require an official population_match value.
  if (Object.prototype.hasOwnProperty.call(properties, 'population_match')) {
    const population = numeric(properties.population_2026);
    return (
      population != null
      && population > 0
      && RANKABLE_MATCH.has(properties.population_match)
    );
  }

  // Nanjing / grid screening: rankable when a population proxy is present.
  const population = populationProxyValue(properties);
  return population != null && population > 0;
}

export function topScreening(screening, lensId, limit = 8, lensesOverride) {
  if (!screening?.features?.length) return [];
  const lens = lensConfig(lensId, lensesOverride);
  return [...screening.features]
    .filter((feature) => isRankableCityFeature(feature, lensId, lensesOverride))
    .sort(
      (a, b) =>
        numeric(a.properties[lens.rankField]) - numeric(b.properties[lens.rankField]),
    )
    .slice(0, limit);
}

export function countSafePopulationMatches(screening) {
  return (screening?.features ?? []).filter((feature) => {
    const population = numeric(feature.properties?.population_2026);
    return (
      RANKABLE_MATCH.has(feature.properties?.population_match)
      && population != null
      && population > 0
    );
  }).length;
}

export function countSpatialPolygons(screening) {
  return screening?.features?.length ?? 0;
}

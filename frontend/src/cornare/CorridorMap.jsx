import { useEffect, useRef } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function CorridorMap({ boundaries, colors, label }) {
  const node = useRef(null);

  useEffect(() => {
    if (!boundaries?.features?.length || !node.current) return undefined;
    const frame = node.current;
    const map = new Map({
      container: frame,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#161c1f' } }],
      },
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('corridor', { type: 'geojson', data: boundaries });
      map.addLayer({
        id: 'municipalities',
        type: 'fill',
        source: 'corridor',
        paint: {
          'fill-color': [
            'match',
            ['get', 'id'],
            'rionegro', colors.rionegro,
            'guarne', colors.guarne,
            'marinilla', colors.marinilla,
            '#313a3e',
          ],
          'fill-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'municipalities-line',
        type: 'line',
        source: 'corridor',
        paint: { 'line-color': '#eee8dc', 'line-width': 1.4 },
      });
      const coordinates = boundaries.features.flatMap((feature) => feature.geometry.coordinates.flat());
      const longitudes = coordinates.map((pair) => pair[0]);
      const latitudes = coordinates.map((pair) => pair[1]);
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        { padding: 28, animate: false },
      );
    });
    return () => map.remove();
  }, [boundaries, colors]);

  return (
    <figure className="corridor-map">
      <div ref={node} className="corridor-map-canvas" />
      <figcaption>{label} Límites: DANE, Marco Geoestadístico Nacional 2025, simplificados.</figcaption>
      <ul className="map-legend">
        {boundaries.features.map((feature) => (
          <li key={feature.properties.id}>
            <i style={{ background: colors[feature.properties.id] }} />
            {feature.properties.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}

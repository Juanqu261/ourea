import { googleEarthLookUrl, googleMapsSearchUrl } from '../domain/placeLinks.js';

export function CellPlaceLinks({ lat, lng, onSeeOnMap }) {
  const maps = googleMapsSearchUrl(lat, lng);
  const earth = googleEarthLookUrl(lat, lng);
  if (!maps && !earth && !onSeeOnMap) return null;
  return (
    <p className="cell-place-links" data-testid="cell-place-links">
      {onSeeOnMap ? (
        <button type="button" className="cell-place-link" data-testid="see-cell-on-map" onClick={onSeeOnMap}>
          See on Ourea map
        </button>
      ) : null}
      {maps ? (
        <a className="cell-place-link" href={maps} target="_blank" rel="noreferrer" data-testid="open-google-maps">
          Google Maps
        </a>
      ) : null}
      {earth ? (
        <a className="cell-place-link" href={earth} target="_blank" rel="noreferrer" data-testid="open-google-earth">
          Google Earth
        </a>
      ) : null}
    </p>
  );
}

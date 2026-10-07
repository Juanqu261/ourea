import { LAYER_LABELS } from '../config/uiCopy.js';
import { BarButton, LayersIcon } from './BarButton.jsx';

export function MapLayersControl({ open, layerState, onToggleOpen, onToggleLayer }) {
  return (
    <div className="map-layers">
      <BarButton
        testId="map-layers"
        className="map-layers-toggle"
        icon={<LayersIcon />}
        ariaExpanded={open}
        onClick={onToggleOpen}
      >
        Map layers
      </BarButton>
      {open && (
        <div className="map-layers-pop" role="group" aria-label="Sandbox map layers">
          {Object.entries(layerState).map(([key, enabled]) => (
            <button
              key={key}
              type="button"
              className={enabled ? 'layer-chip on' : 'layer-chip'}
              aria-pressed={enabled}
              onClick={() => onToggleLayer(key)}
            >
              {LAYER_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

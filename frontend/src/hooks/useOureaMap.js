import { useEffect, useRef, useState } from 'react';
import { buildingStressGeoJson } from '../domain/scenarioEngine.js';

export function useOureaMap({
  data,
  context,
  scope,
  cityLens,
  flowStep,
  flowMode,
  selectedBarrio,
  selectedCellId,
  layerState,
  activePlan,
  scenario,
  onSelectCell,
  onSelectBarrio,
}) {
  const mapNode = useRef(null);
  const mapApiRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStatus, setMapStatus] = useState('pending');
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (!data || !mapNode.current) return undefined;
    let cancelled = false;

    import('../services/mapService.js')
      .then(({ createOureaMap }) => {
        if (cancelled || !mapNode.current) return;
        try {
          const api = createOureaMap({
            container: mapNode.current,
            data,
            onSelectCell,
            onSelectBarrio,
            onReady: () => {
              if (cancelled) return;
              setMapReady(true);
              setMapStatus('ready');
            },
          });
          if (cancelled) {
            api.destroy?.();
            return;
          }
          mapApiRef.current = api;
        } catch (error) {
          if (cancelled) return;
          mapApiRef.current = null;
          setMapReady(false);
          setMapStatus('unavailable');
          setMapError(error?.message ?? String(error));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        mapApiRef.current = null;
        setMapReady(false);
        setMapStatus('unavailable');
        setMapError(error?.message ?? String(error));
      });

    return () => {
      cancelled = true;
      setMapReady(false);
      mapApiRef.current?.destroy?.();
      mapApiRef.current = null;
    };
  }, [data, onSelectCell, onSelectBarrio]);

  useEffect(() => {
    if (!mapReady) return;
    mapApiRef.current?.setScope?.(scope);
  }, [scope, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    mapApiRef.current?.setCityLens?.(cityLens);
  }, [cityLens, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    mapApiRef.current?.setSelectedBarrio?.(selectedBarrio);
  }, [selectedBarrio, mapReady]);

  const storyRef = useRef({ flowStep, flowMode, selectedBarrio, activePlan, cells: data?.cells });
  storyRef.current = { flowStep, flowMode, selectedBarrio, activePlan, cells: data?.cells };
  const storySignature = `${flowMode}|${flowStep}|${selectedBarrio?.OBJECTID ?? ''}|${
    (activePlan ?? []).map((project) => `${project.cell_id}:${project.type}`).join(',')
  }`;

  useEffect(() => {
    if (!mapReady) return;
    const story = storyRef.current;
    if (selectedCellId != null && story.cells) {
      mapApiRef.current?.focusCell?.(selectedCellId, story.cells);
      return;
    }
    mapApiRef.current?.setSelectedCell?.(null);
    mapApiRef.current?.playStoryCamera?.({
      step: story.flowStep,
      mode: story.flowMode,
      barrio: story.selectedBarrio,
      projects: story.activePlan,
      cellsGeoJson: story.cells,
    });
  }, [mapReady, storySignature, selectedCellId]);

  useEffect(() => {
    if (!mapReady || scope !== 'sandbox') return;
    mapApiRef.current?.setLayerVisibility?.(layerState);
  }, [layerState, scope, mapReady]);

  useEffect(() => {
    if (!mapReady || !context || !data || scope !== 'sandbox') return;
    mapApiRef.current?.updateBuildingStress?.(
      buildingStressGeoJson({
        context,
        projects: activePlan,
        scenario,
        originalGeoJson: data.buildings,
      }),
    );
    mapApiRef.current?.updateProjects?.(activePlan, data.cells);
  }, [mapReady, context, data, activePlan, scenario, scope]);

  return {
    mapNode,
    mapStatus,
    mapError,
    captureMapImage: () => mapApiRef.current?.captureImage?.() ?? null,
  };
}

import { useEffect, useState } from 'react';
import { medellinCase } from '../config/cases/medellinCase.js';
import { loadOureaData } from '../services/dataService.js';

export function useOureaData(caseConfig = medellinCase) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const caseId = caseConfig?.id ?? medellinCase.id;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(null);
    loadOureaData(controller.signal, caseConfig)
      .then(setData)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error);
      });
    return () => controller.abort();
  }, [caseId, caseConfig]);

  return { data, loadError };
}

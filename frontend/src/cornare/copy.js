export const STEPS = [
  { id: 'overview', label: 'Panorama', title: 'Dónde intervenir primero' },
  { id: 'diagnosis', label: 'Diagnóstico', title: 'Municipio por dimensión' },
  { id: 'prioritize', label: 'Priorizar', title: 'Cómo se comparan las opciones' },
  { id: 'portfolio', label: 'Portafolio', title: 'Medidas dentro del fondo' },
  { id: 'stress', label: 'SSP3-7.0', title: 'Prueba hacia 2060' },
  { id: 'robustness', label: 'Robustez', title: 'Mundos probados' },
  { id: 'residual', label: 'Riesgo residual', title: 'Lo que queda sin resolver' },
  { id: 'monitoring', label: 'MEA', title: 'Cómo saber si funcionó' },
  { id: 'export', label: 'Exportar', title: 'Síntesis para el pitch' },
];

export const CLASS_COLOR = {
  muy_baja: '#3e6554',
  baja: '#527d64',
  media: '#c8a75e',
  alta: '#d87549',
  muy_alta: '#a8443f',
  missing: '#2a3338',
};

export function copMillions(value) {
  return `COP ${Number(value).toLocaleString('es-CO')} millones`;
}

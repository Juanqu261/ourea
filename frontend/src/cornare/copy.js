export const STEPS = [
  { id: 'territory', label: 'Territorio', title: '¿Dónde intervenir primero?' },
  { id: 'priority', label: 'Prioridad', title: '¿Qué intervenciones generan más valor con recursos limitados?' },
  { id: 'portfolio', label: 'Portafolio', title: '¿Qué financiamos con COP 5.000 millones?' },
  { id: 'horizon', label: '2060', title: '¿La decisión sigue siendo válida bajo SSP3-7.0?' },
  { id: 'robustness', label: 'Robustez', title: '¿Se sostiene la decisión en los mundos probados?' },
  { id: 'residual', label: 'Residual', title: '¿Qué sigue vulnerable después de invertir?' },
  { id: 'followup', label: 'Seguimiento', title: '¿Cómo sabremos si funcionó?' },
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

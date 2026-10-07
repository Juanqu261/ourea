export const EVIDENCE_LABELS = Object.freeze({
  institutional: 'Dato institucional',
  team_inference: 'Inferencia del equipo',
  assumption: 'Supuesto',
  missing: 'Información faltante',
});

export const NBS_LABELS = Object.freeze({
  NBS_DIRECT: 'Naturaleza',
  NBS_HYBRID: 'Híbrida',
  ENABLING: 'Habilitadora',
  GREY_INFRASTRUCTURE: 'Gris',
});

export const CLASS_LABELS = Object.freeze({
  muy_baja: 'Muy baja',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  muy_alta: 'Muy alta',
});

export const STRESS_LABELS = Object.freeze({
  ROBUSTA: 'Robusta',
  MAYORMENTE_ROBUSTA: 'Mayormente robusta',
  REQUIERE_AJUSTE: 'Requiere ajuste',
  EVIDENCIA_INSUFICIENTE: 'Evidencia insuficiente',
});

export function evidenceLabel(kind) {
  const label = EVIDENCE_LABELS[kind];
  if (!label) throw new Error(`Unknown evidence class: ${kind}`);
  return label;
}

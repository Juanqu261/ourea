import { createPdf } from '../domain/pdfDocument.js';
import { NBS_LABELS, STRESS_LABELS } from '../domain/evidence.js';
import { dimensionName, stressNarrative } from '../domain/explanations.js';
import { copMillions } from './copy.js';

export function downloadPitchPdf(analysis) {
  const pdf = createPdf({ info: { Title: 'Ourea — decisión de adaptación CORNARE' } });
  const ink = [238, 232, 220];
  const muted = [140, 153, 157];
  const gold = [200, 167, 94];
  let y = 36;
  pdf.text('OUREA', 36, y, { size: 11, bold: true, color: gold });
  y += 22;
  pdf.text('Decisión de adaptación para Rionegro, Guarne y Marinilla', 36, y, { size: 16, bold: true, color: ink, maxWidth: 520 });
  y += 28;
  pdf.text(`Fondo ${copMillions(analysis.parameters.budget_million_cop)}. Usado ${copMillions(analysis.portfolio.cost)}. Disponible ${copMillions(analysis.portfolio.remaining)}.`, 36, y, { size: 10, color: ink, maxWidth: 520 });
  y += 28;
  pdf.text('Tablero', 36, y, { size: 12, bold: true, color: gold });
  y += 18;
  analysis.findings.forEach((finding) => {
    y += pdf.text(finding.text, 36, y, { size: 9, color: ink, maxWidth: 520, lineHeight: 12 });
    y += 8;
  });
  pdf.addPage();
  y = 36;
  pdf.text('Portafolio institucional', 36, y, { size: 12, bold: true, color: gold });
  y += 20;
  analysis.portfolio.measures.forEach((measure) => {
    y += pdf.text(`${measure.implementationOrder}. ${measure.name}`, 36, y, { size: 10, bold: true, color: ink, maxWidth: 520 });
    y += 4;
    y += pdf.text(`${measure.place.localization} · ${copMillions(measure.cost)} · ${NBS_LABELS[measure.nbsClass]} · ${dimensionName(measure.dimensionId)}`, 36, y, { size: 9, color: muted, maxWidth: 520 });
    y += 12;
  });
  const stress = stressNarrative(analysis.stress, analysis.prepared);
  y += 8;
  pdf.text(`Prueba SSP3-7.0: ${STRESS_LABELS[analysis.stress.status]}`, 36, y, { size: 12, bold: true, color: gold });
  y += 18;
  y += pdf.text(stress.shift, 36, y, { size: 9, color: ink, maxWidth: 520 });
  y += 8;
  y += pdf.text(stress.decision, 36, y, { size: 9, color: ink, maxWidth: 520 });
  y += 16;
  pdf.text('Riesgo residual', 36, y, { size: 12, bold: true, color: gold });
  y += 18;
  analysis.residual.rows.filter((row) => !row.addressed && row.high.length).forEach((row) => {
    y += pdf.text(`${dimensionName(row.dimensionId)}: ${row.statement}`, 36, y, { size: 9, color: ink, maxWidth: 520 });
    y += 6;
  });
  y += pdf.text(analysis.residual.reminder, 36, y, { size: 9, color: muted, maxWidth: 520 });
  y += 18;
  pdf.text(`Huella ${analysis.fingerprint}`, 36, y, { size: 8, color: muted });
  const blob = pdf.toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ourea-cornare-decision.pdf';
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadDecisionJson(analysis) {
  const payload = {
    fingerprint: analysis.fingerprint,
    budget_million_cop: analysis.parameters.budget_million_cop,
    used_million_cop: analysis.portfolio.cost,
    remaining_million_cop: analysis.portfolio.remaining,
    measures: analysis.portfolio.measures.map((measure) => ({
      id: measure.id,
      name: measure.name,
      localization: measure.place.localization,
      trigger: measure.place.trigger,
      cost_million_cop: measure.cost,
      dimension_id: measure.dimensionId,
      nbs_class: measure.nbsClass,
      order: measure.implementationOrder,
      priority_contribution: measure.part.contribution,
    })),
    stress_status: analysis.stress.status,
    findings: analysis.findings,
    residual: analysis.residual.rows,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ourea-cornare-decision.json';
  link.click();
  URL.revokeObjectURL(url);
}

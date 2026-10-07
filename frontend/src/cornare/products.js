// The three exported products as auditable claims (AI_AGENTS_PLAN.md §5.3).
// P1 priorización · P2 portafolio y robustez · P3 riesgo residual y seguimiento.
// Every claim with a number cites the fingerprint of the engine output that holds it, or a source_id.
import { EVIDENCE_LABELS, STRESS_LABELS } from '../domain/evidence.js';
import { dimensionName } from '../domain/explanations.js';

const INSTITUTIONAL = EVIDENCE_LABELS.institutional;
const INFERENCE = EVIDENCE_LABELS.team_inference;
const ASSUMPTION = EVIDENCE_LABELS.assumption;
const MISSING = 'Información faltante';

// es-CO, always grouped: 5.000 · 2,81
export function esNumber(value, decimals = 0) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '−' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

export function buildProducts(analysis, raw) {
  const fp = analysis.fingerprint;
  const portfolio = analysis.portfolio;
  const budget = analysis.parameters.budget_million_cop;
  const grey = analysis.baselines?.grey;
  const robustness = raw?.engine?.robustness;

  const p1 = [
    {
      text: `Con COP ${esNumber(budget)} millones compiten 15 medidas por el corredor Rionegro–Guarne–Marinilla.`,
      numbers: [budget, 15],
      label: INSTITUTIONAL,
      source_id: 'reto-brief-2026',
    },
    {
      text: `Puntaje institucional verificado del portafolio: ${esNumber(portfolio.institucional.objective, 2)}.`,
      numbers: [portfolio.institucional.objective],
      label: INFERENCE,
      fingerprint: fp,
    },
    {
      text: 'El puntaje es de prioridad. No mide cuánto baja la vulnerabilidad.',
      numbers: [],
      label: INFERENCE,
    },
    // The five findings of the territorial dashboard quote the challenge's municipal metrics.
    ...(analysis.findings ?? []).map((finding) => ({
      text: finding.text,
      numbers: [],
      label: finding.provenance === 'institutional' ? INSTITUTIONAL : MISSING,
      source_id: 'hackathon-deck-2026',
    })),
  ];

  const p2 = [
    {
      text: `El portafolio usa COP ${esNumber(portfolio.cost)} millones y deja ${esNumber(portfolio.remaining)} millones sin asignar.`,
      numbers: [portfolio.cost, portfolio.remaining],
      label: INFERENCE,
      fingerprint: fp,
    },
    ...portfolio.measures.map((measure) => ({
      text: `${measure.name}: COP ${esNumber(measure.cost)} millones. Ubicación exacta por definir.`,
      numbers: [measure.cost],
      label: ASSUMPTION,
      source_id: 'reto-brief-2026',
    })),
    {
      text: `Ante SSP3-7.0 hacia 2060 el portafolio queda como «${STRESS_LABELS[analysis.stress.status]}».`,
      numbers: [],
      label: INFERENCE,
    },
  ];
  if (grey) {
    p2.push({
      text: `Exigir infraestructura gris baja el puntaje institucional a ${esNumber(grey.institucional.objective, 2)}.`,
      numbers: [grey.institucional.objective],
      label: INFERENCE,
      fingerprint: fp,
    });
  }
  if (robustness?.s_star_sentence) {
    p2.push({ text: robustness.s_star_sentence, numbers: [], label: INFERENCE, fingerprint: robustness.fingerprint });
  }

  const p3 = [
    { text: analysis.residual.reminder, numbers: [], label: INFERENCE },
    ...analysis.residual.rows.filter((row) => !row.addressed).map((row) => ({
      text: `${dimensionName(row.dimensionId)}: ${row.statement}`,
      numbers: [],
      label: INFERENCE,
    })),
    ...analysis.gaps.slice(0, 3).map((gap) => ({
      text: `Falta: ${gap.missing_information}.`,
      numbers: [],
      label: MISSING,
    })),
  ];

  return {
    schema: 'ourea.cornare.audit_bundle',
    fingerprint: fp,
    products: [
      { id: 'P1', title: 'Priorización institucional', claims: p1 },
      { id: 'P2', title: 'Portafolio y robustez', claims: p2 },
      { id: 'P3', title: 'Riesgo residual y seguimiento', claims: p3 },
    ],
  };
}

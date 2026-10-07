import { NBS_LABELS, STRESS_LABELS, CLASS_LABELS } from '../domain/evidence.js';
import { dimensionName, stressNarrative } from '../domain/explanations.js';
import {
  BRIEF_BOTTOM,
  THEME,
  badge,
  card,
  divider,
  drawMark,
  iconCircle,
  kicker,
  openBrief,
  progressBar,
  sectionTitle,
  widthOf,
} from './briefLayout.js';

export const BRIEF_FILENAME = 'ourea-cornare-decision-brief.pdf';
export const DEMO_URL = 'https://juanqu261.github.io/ourea/';
export const REPO_URL = 'https://github.com/Juanqu261/ourea';
const PRODUCT_VERSION = '1.0.0';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CORRIDOR_ORDER = ['rionegro', 'guarne', 'marinilla'];
const SHORT_DIMENSION = {
  biodiversity: 'Biodiversidad',
  water: 'Agua',
  disaster: 'Desastres',
  health: 'Salud',
  infrastructure: 'Infraestructura',
  habitat: 'Hábitat',
  food: 'Alimentos',
};
const RISK_CLASS = {
  muy_baja: 'MUY BAJO',
  baja: 'BAJO',
  media: 'MEDIO',
  alta: 'ALTO',
  muy_alta: 'MUY ALTO',
};
const BAND_ES = {
  VERY_SENSITIVE: 'MUY SENSIBLE',
  SENSITIVE: 'SENSIBLE',
  MODERATELY_STABLE: 'MODERADAMENTE ESTABLE',
  STABLE: 'ESTABLE',
};
const NBS_COLOR = {
  NBS_DIRECT: THEME.nature,
  NBS_HYBRID: THEME.water,
  ENABLING: THEME.goldDeep,
  GREY_INFRASTRUCTURE: THEME.rust,
};
const NBS_WASH = {
  NBS_DIRECT: THEME.natureWash,
  NBS_HYBRID: THEME.waterWash,
  ENABLING: THEME.selected,
  GREY_INFRASTRUCTURE: THEME.rustWash,
};
const NBS_INK = {
  NBS_DIRECT: THEME.nature,
  NBS_HYBRID: [40, 78, 102],
  ENABLING: THEME.bronze,
  GREY_INFRASTRUCTURE: THEME.rust,
};

const PRINCIPAL_SOURCES = [
  {
    title: 'Observatorio Ambiental de CORNARE',
    meta: 'CORNARE · 2026',
    url: 'https://observatorioambiental.cornare.gov.co/crecimiento-verde-y-cambio-climatico/cambio-climatico/',
    note: 'Consulta pública de amenaza, vulnerabilidad y riesgo.',
  },
  {
    title: 'MARCO, Monitoreo Ambiental Regional',
    meta: 'CORNARE · 2026',
    url: 'https://marco.cornare.gov.co/',
    note: 'Seguimiento ambiental de la jurisdicción.',
  },
  {
    title: 'Riesgos climáticos en la jurisdicción de CORNARE',
    meta: 'CORNARE · 2026',
    url: null,
    note: 'Clases por municipio y pesos institucionales. Documento del reto.',
  },
  {
    title: 'Reporte de medidas de adaptación por municipio',
    meta: 'CORNARE · 2026',
    url: null,
    note: 'Historial, planes e indicadores. Documento del reto.',
  },
  {
    title: 'Global Standard for Nature-based Solutions',
    meta: 'UICN · 2020',
    url: 'https://doi.org/10.2305/IUCN.CH.2020.08.en',
    note: 'Ocho criterios como tamiz. No certifica medidas.',
  },
  {
    title: 'Climate Change 2022: Impacts, Adaptation and Vulnerability',
    meta: 'IPCC · 2022',
    url: 'https://www.ipcc.ch/report/ar6/wg2/',
    note: 'Adaptación bajo escenarios. No se importan porcentajes de efectividad.',
  },
  {
    title: 'Marco Geoestadístico Nacional 2025',
    meta: 'DANE · 2025',
    url: 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317',
    note: 'Límites de Guarne, Marinilla y Rionegro. Contexto espacial.',
  },
];

export function formatMillions(value) {
  const rounded = Math.round(Number(value));
  const body = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-${body}` : body;
}

export function formatDecimal(value, digits) {
  const [whole, fraction] = Number(value).toFixed(digits).split('.');
  return `${whole},${fraction}`;
}

function percent(weight) {
  return `${Math.round(Number(weight) * 100)}%`;
}

function placeName(id) {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function formatScenario(code) {
  const parts = String(code ?? 'ssp3_7_0').split('_');
  if (parts.length < 3) return String(code ?? 'SSP3-7.0').replace('ssp', 'SSP');
  return `${parts[0].replace(/^ssp/i, 'SSP')}-${parts[1]}.${parts[2]}`;
}

function corridorIds(analysis) {
  const ids = new Set();
  analysis.prepared.forEach((measure) => {
    measure.placement.candidates.forEach((row) => ids.add(row.municipalityId));
  });
  const known = CORRIDOR_ORDER.filter((id) => ids.has(id));
  const extra = [...ids].filter((id) => !CORRIDOR_ORDER.includes(id));
  return [...known, ...extra];
}

function shortDimension(id) {
  return SHORT_DIMENSION[id] ?? dimensionName(id);
}

function whyEnters(measure) {
  const level = measure.classificationLabel.toLowerCase();
  const dim = shortDimension(measure.dimensionId);
  if (measure.part?.factor != null && measure.part.factor < 1) {
    return `Por qué entra: vulnerabilidad ${level} en ${dim}. El aporte baja: ya hay otra medida de la misma dimensión.`;
  }
  return `Por qué entra: vulnerabilidad ${level} en ${dim}.`;
}

export function sacrificeView(analysis) {
  const hinge = analysis.hinges?.[0] ?? null;
  const nearest = hinge
    ? {
      id: hinge.id,
      name: hinge.name,
      cost: analysis.prepared.find((measure) => measure.id === hinge.id)?.cost ?? null,
      gapDisplay: hinge.gapDisplay,
    }
    : null;
  const budget = analysis.parameters.budget_million_cop;
  const selected = new Set(analysis.portfolio.ids);
  const grey = analysis.prepared
    .filter((measure) => measure.nbsClass === 'GREY_INFRASTRUCTURE' && !selected.has(measure.id) && measure.cost >= budget * 0.4)
    .sort((left, right) => right.cost - left.cost)[0] ?? null;
  return {
    nearest,
    grey: grey && grey.id !== nearest?.id ? grey : null,
  };
}

function hingePitch(analysis, hinge) {
  if (!analysis.stress.sameSet) return stressNarrative(analysis.stress, analysis.prepared).decision;
  if (hinge && (hinge.band === 'VERY_SENSITIVE' || hinge.band === 'SENSITIVE')) {
    return 'El portafolio es estable frente al cambio climático cuantificado, pero sensible a evidencia institucional todavía no integrada.';
  }
  return 'El portafolio es estable frente al cambio climático cuantificado.';
}

function equivalentLine(hinge) {
  if (hinge.rangeFraction <= 1) {
    return `${formatDecimal(hinge.rangeFraction * 100, 1)}% del rango ponderado completo del criterio participativo`;
  }
  return 'Supera el rango ponderado completo de un solo criterio participativo';
}

function compactScope(scope) {
  if (String(scope).startsWith('Corredor')) return 'Corredor';
  return scope;
}

function matrixRows(analysis) {
  return analysis.matrix.rows.filter((row) => row.decision === 'SELECTED' || row.decision === 'CLOSE ALTERNATIVE');
}

function formatBriefDate(date = new Date()) {
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function linkedLine(pdf, label, url, x, y, size = 9, color = THEME.bronze) {
  const width = widthOf(label, size, false);
  const height = pdf.text(label, x, y, { size, color, lineHeight: size * 1.35 });
  pdf.strokePath([[x, y + size + 1], [x + width, y + size + 1]], { color, lineWidth: 0.6 });
  pdf.addLink(x, y, width, size + 3, url);
  return height;
}

function drawCover(brief, analysis) {
  const { pdf, margin, contentWidth, bottom } = brief;
  const budget = formatMillions(analysis.parameters.budget_million_cop);
  const used = formatMillions(analysis.portfolio.cost);
  const year = analysis.stress.shift.year;
  const scenario = formatScenario(analysis.stress.shift.scenario);
  const names = corridorIds(analysis).map(placeName);
  const count = analysis.prepared.length;
  const selectedCount = analysis.portfolio.measures.length;
  const question = `¿Dónde intervenir primero con COP ${budget} millones y qué decisión sigue siendo defendible hacia ${year}?`;
  const questionHeight = pdf.measure(question, { size: 18, bold: true, maxWidth: contentWidth, lineHeight: 24 });
  const heroH = 108 + questionHeight + 16;

  pdf.fillRect(0, 0, pdf.width, heroH, THEME.hero);
  pdf.fillRect(0, heroH - 3, pdf.width, 3, THEME.gold);
  pdf.text('OUREA', margin, 26, { size: 13, bold: true, color: THEME.gold, lineHeight: 16 });
  pdf.text('Soporte de decisión para adaptación climática territorial', margin, 46, {
    size: 11,
    color: THEME.heroText,
    maxWidth: contentWidth,
    lineHeight: 15,
  });
  pdf.text(names.join(' · '), margin, 68, { size: 9, color: THEME.heroMuted, lineHeight: 12 });
  pdf.text('Valles de San Nicolás · CORNARE', margin, 82, { size: 9, color: THEME.heroMuted, lineHeight: 12 });
  pdf.text(question, margin, 106, {
    size: 18,
    bold: true,
    color: THEME.heroText,
    maxWidth: contentWidth,
    lineHeight: 24,
  });

  let y = heroH + 14;
  const gap = 8;
  const propW = (contentWidth - gap * 2) / 3;
  const props = [
    ['target', 'PRIORIZA', `${count} medidas compiten por un fondo limitado`],
    ['layers', 'OPTIMIZA', `Selecciona una combinación bajo COP ${budget} M`],
    ['shield', 'PRUEBA', `Evalúa si la decisión cambia bajo ${scenario}`],
  ];
  const propH = 88;
  props.forEach(([kind, title, body], index) => {
    const x = margin + index * (propW + gap);
    card(pdf, x, y, propW, propH);
    drawMark(pdf, kind, x + 18, y + 20);
    pdf.text(title, x + 34, y + 12, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
    pdf.text(body, x + 10, y + 40, { size: 8.5, color: THEME.muted, maxWidth: propW - 20, lineHeight: 11.5 });
  });
  y += propH + 12;

  const decisionH = 118;
  card(pdf, margin, y, contentWidth, decisionH, { accent: THEME.goldDeep });
  pdf.text('Portafolio recomendado con evidencia verificada', margin + 14, y + 10, {
    size: 12,
    bold: true,
    color: THEME.ink,
    maxWidth: contentWidth - 28,
    lineHeight: 16,
  });
  const metric = `COP ${used} M`;
  pdf.text(metric, margin + 14, y + 32, { size: 22, bold: true, color: THEME.ink, lineHeight: 26 });
  pdf.text(`de COP ${budget} M`, margin + 22 + widthOf(metric, 22, true), y + 40, {
    size: 10,
    color: THEME.muted,
    lineHeight: 13,
  });
  pdf.text(`${selectedCount} medidas seleccionadas`, margin + 14, y + 64, {
    size: 9.5,
    color: THEME.ink,
    lineHeight: 13,
  });
  const fraction = analysis.parameters.budget_million_cop
    ? analysis.portfolio.cost / analysis.parameters.budget_million_cop
    : 0;
  progressBar(pdf, margin + 14, y + 84, contentWidth - 28, 8, fraction);
  pdf.text(`Usado COP ${used} M`, margin + 14, y + 96, { size: 8.5, color: THEME.muted, lineHeight: 11 });
  pdf.text(`Disponible COP ${formatMillions(analysis.portfolio.remaining)} M`, margin + contentWidth - 14, y + 96, {
    size: 8.5,
    color: THEME.muted,
    align: 'right',
    lineHeight: 11,
  });
  y += decisionH + 12;

  const lead = 'Ourea transforma el diagnóstico climático existente de CORNARE en una decisión presupuestal trazable, espacial y revisable.';
  y += pdf.text(lead, margin, y, { size: 10.5, color: THEME.ink, maxWidth: contentWidth, lineHeight: 14.5 });
  y += 12;

  const diffH = 72;
  card(pdf, margin, y, contentWidth, diffH);
  const colW = (contentWidth - 36) / 2;
  pdf.text('OBSERVATORIO CORNARE', margin + 12, y + 10, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text('Diagnostica y consulta el riesgo', margin + 12, y + 26, {
    size: 10,
    color: THEME.ink,
    maxWidth: colW - 8,
    lineHeight: 13.5,
  });
  pdf.fillCircle(margin + contentWidth / 2, y + 36, 9, THEME.gold);
  pdf.text('>', margin + contentWidth / 2, y + 30, {
    size: 11,
    bold: true,
    color: THEME.hero,
    align: 'center',
    lineHeight: 12,
  });
  pdf.text('OUREA', margin + contentWidth / 2 + 16, y + 10, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text('Convierte ese diagnóstico en una decisión de inversión', margin + contentWidth / 2 + 16, y + 26, {
    size: 10,
    color: THEME.ink,
    maxWidth: colW - 8,
    lineHeight: 13.5,
  });
  y += diffH + 12;

  const mapH = bottom - y;
  brief.guard(y + 110, 'portada');
  drawCorridor(pdf, margin, y, contentWidth, mapH, names);
  brief.guard(y + mapH, 'mapa');
}

function scalePoly(poly, x, y, w, h, pad) {
  return poly.map(([px, py]) => [x + pad + px * (w - pad * 2), y + pad + py * (h - pad * 2)]);
}

function drawCorridor(pdf, x, y, w, h, names) {
  card(pdf, x, y, w, h);
  pdf.text('Corredor de decisión', x + 12, y + 8, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
  const plotX = x + 12;
  const plotY = y + 26;
  const plotW = w * 0.62;
  const plotH = h - 58;
  const shapes = [
    {
      name: names[1] ?? 'Guarne',
      fill: THEME.guarne,
      poly: [[0.06, 0.04], [0.4, 0.0], [0.46, 0.22], [0.32, 0.42], [0.04, 0.36]],
      label: [0.24, 0.2],
    },
    {
      name: names[0] ?? 'Rionegro',
      fill: THEME.rionegro,
      poly: [[0.02, 0.4], [0.34, 0.44], [0.4, 0.62], [0.28, 0.98], [0.0, 0.86]],
      label: [0.18, 0.68],
    },
    {
      name: names[2] ?? 'Marinilla',
      fill: THEME.marinilla,
      poly: [[0.5, 0.14], [0.86, 0.04], [0.98, 0.36], [0.8, 0.7], [0.52, 0.56], [0.48, 0.3]],
      label: [0.72, 0.34],
    },
  ];
  shapes.forEach((shape) => {
    const points = scalePoly(shape.poly, plotX, plotY, plotW, plotH, 8);
    pdf.fillPath(points, shape.fill);
    pdf.strokePath([...points, points[0]], { color: THEME.goldDeep, lineWidth: 1.3 });
    const [lx, ly] = scalePoly([shape.label], plotX, plotY, plotW, plotH, 8)[0];
    const labelW = widthOf(shape.name, 8.5, true) + 8;
    pdf.fillRect(lx - labelW / 2, ly - 2, labelW, 13, THEME.paper);
    pdf.text(shape.name, lx, ly, { size: 8.5, bold: true, color: THEME.ink, align: 'center', lineHeight: 11 });
  });
  const river = scalePoly([[0.18, 0.24], [0.32, 0.4], [0.46, 0.36], [0.62, 0.42], [0.76, 0.3]], plotX, plotY, plotW, plotH, 8);
  pdf.strokePath(river, { color: THEME.water, lineWidth: 1.6 });

  const legendX = x + plotW + 28;
  const legend = [
    [THEME.rionegro, names[0] ?? 'Rionegro'],
    [THEME.guarne, names[1] ?? 'Guarne'],
    [THEME.marinilla, names[2] ?? 'Marinilla'],
  ];
  legend.forEach(([color, label], index) => {
    const row = index % 3;
    const ly = y + 28 + row * 18;
    pdf.fillRect(legendX, ly, 10, 10, color);
    pdf.text(label, legendX + 16, ly - 1, { size: 8.5, color: THEME.ink, lineHeight: 11 });
  });
  pdf.text('Trazo dorado: ámbito de la decisión.', legendX, plotY + 70, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: w - plotW - 40,
    lineHeight: 11.5,
  });
  pdf.text('Línea azul: red hídrica esquemática.', legendX, plotY + 96, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: w - plotW - 40,
    lineHeight: 11.5,
  });
  pdf.text('Esquema del corredor para leer la decisión. No usa teselas remotas.', x + 12, y + h - 22, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: w - 24,
    lineHeight: 11.5,
  });
}

function drawLogic(brief, analysis) {
  const { pdf, margin, contentWidth } = brief;
  let y = 36;
  y = kicker(pdf, 'LÓGICA', margin, y);
  y += 2;
  y = sectionTitle(pdf, 'De los datos a la decisión', margin, y, contentWidth);

  const weights = analysis.parameters.weights;
  const participatory = analysis.parameters.workshops_scored ? 'integrado' : 'por integrar';
  const budget = formatMillions(analysis.parameters.budget_million_cop);
  const combinations = formatMillions(2 ** analysis.prepared.length);
  const scenario = formatScenario(analysis.stress.shift.scenario);
  const steps = [
    ['DATOS CORNARE', 'Amenaza, sensibilidad, capacidad adaptativa, vulnerabilidad, histórico, MEA y costos.'],
    ['PRIORIZACIÓN INSTITUCIONAL', `${percent(weights.vulnerability)} vulnerabilidad · ${percent(weights.recurrence)} recurrencia documentada · ${percent(weights.workshops)} componente participativo ${participatory}.`],
    ['RESTRICCIÓN', `COP ${budget} M · ${analysis.prepared.length} medidas indivisibles.`],
    ['BÚSQUEDA DE PORTAFOLIO', `${combinations} combinaciones evaluadas.`],
    ['DECISIÓN', `${analysis.portfolio.measures.length} medidas · COP ${formatMillions(analysis.portfolio.cost)} M.`],
    ['STRESS TEST', `${scenario} · ${analysis.stress.shift.year}.`],
    ['REVISIÓN', 'Riesgo residual, indicadores MEA y umbral de cambio.'],
  ];
  steps.forEach(([title, detail], index) => {
    const detailH = pdf.measure(detail, { size: 8.5, maxWidth: contentWidth - 36, lineHeight: 11.5 });
    const rowH = Math.max(28, 15 + detailH);
    if (index < steps.length - 1) {
      pdf.strokePath([[margin + 8, y + 16], [margin + 8, y + rowH]], { color: THEME.goldDeep, lineWidth: 1 });
    }
    iconCircle(pdf, margin + 8, y + 8, index + 1, { fill: THEME.hero, color: THEME.gold, radius: 8 });
    pdf.text(title, margin + 24, y - 1, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
    pdf.text(detail, margin + 24, y + 13, { size: 8.5, color: THEME.muted, maxWidth: contentWidth - 36, lineHeight: 11.5 });
    y += rowH;
  });
  y += 8;

  const boxGap = 8;
  const boxW = (contentWidth - boxGap) / 2;
  const boxH = 100;
  card(pdf, margin, y, boxW, boxH, { accent: THEME.nature });
  pdf.text('DATOS QUE SÍ AFECTAN LA DECISIÓN', margin + 12, y + 8, {
    size: 8.5,
    bold: true,
    color: THEME.ink,
    maxWidth: boxW - 20,
    lineHeight: 11.5,
  });
  const affects = [
    'Vulnerabilidad municipal',
    'Recurrencia documentada',
    'Costos del catálogo',
    'Presupuesto',
    `Cambio ${scenario} disponible`,
  ];
  affects.forEach((item, index) => {
    pdf.fillCircle(margin + 16, y + 30 + index * 13, 1.6, THEME.nature);
    pdf.text(item, margin + 24, y + 24 + index * 13, { size: 8.5, color: THEME.ink, lineHeight: 11 });
  });
  card(pdf, margin + boxW + boxGap, y, boxW, boxH, { accent: THEME.water });
  pdf.text('CONTEXTUAL / NO SCORING', margin + boxW + boxGap + 12, y + 8, {
    size: 8.5,
    bold: true,
    color: THEME.ink,
    lineHeight: 11.5,
  });
  const context = ['SIG', 'Hidrografía', 'Humedales', 'Áreas protegidas', 'Cobeneficios', 'Mitigación y emisiones'];
  context.forEach((item, index) => {
    const col = index < 3 ? 0 : 1;
    const row = index % 3;
    const bx = margin + boxW + boxGap + 16 + col * ((boxW - 28) / 2);
    pdf.fillCircle(bx, y + 36 + row * 22, 1.6, THEME.water);
    pdf.text(item, bx + 8, y + 30 + row * 22, { size: 8.5, color: THEME.ink, maxWidth: (boxW - 40) / 2, lineHeight: 11 });
  });
  y += boxH + 8;
  y += pdf.text('Quedan integrados en la secuencia de decisión. El contexto espacial no modifica el puntaje.', margin, y, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 10;

  y = kicker(pdf, 'MATRIZ', margin, y);
  y += 1;
  pdf.text('Seleccionadas y alternativas cercanas', margin, y, {
    size: 13,
    bold: true,
    color: THEME.ink,
    lineHeight: 17,
  });
  y += 20;
  y = drawMatrix(pdf, margin, y, contentWidth, analysis);
  const hinge = analysis.hinges?.[0];
  if (hinge) {
    y += 6;
    pdf.text(`${hinge.name} queda fuera. Brecha verificada: ${hinge.gapDisplay}.`, margin, y, {
      size: 9,
      color: THEME.ink,
      maxWidth: contentWidth,
      lineHeight: 12,
    });
  }
  brief.guard(y + 16, 'lógica');
}

function drawMatrix(pdf, x, y, width, analysis) {
  const columns = [
    { label: 'Medida', width: width * 0.34, align: 'left' },
    { label: 'Ámbito', width: width * 0.15, align: 'left' },
    { label: 'Clase', width: width * 0.1, align: 'left' },
    { label: 'COP M', width: width * 0.09, align: 'right' },
    { label: 'Puntaje\nverificado', width: width * 0.14, align: 'right' },
    { label: 'Estado', width: width * 0.18, align: 'left' },
  ];
  const headerH = 28;
  pdf.fillRect(x, y, width, headerH, THEME.wash);
  let cx = x;
  columns.forEach((column) => {
    column.label.split('\n').forEach((line, index) => {
      pdf.text(line, column.align === 'right' ? cx + column.width - 4 : cx + 4, y + 2 + index * 11, {
        size: 8.5,
        bold: true,
        color: THEME.ink,
        align: column.align === 'right' ? 'right' : 'left',
        lineHeight: 11,
      });
    });
    cx += column.width;
  });
  y += headerH;
  matrixRows(analysis).forEach((row) => {
    const selected = row.decision === 'SELECTED';
    const values = [
      row.name,
      compactScope(row.scope),
      row.vulnerabilityClass,
      formatMillions(row.cost),
      formatDecimal(row.standaloneVerifiedScore, 3),
      selected ? 'SELECCIONADA' : 'ALTERNATIVA CERCANA',
    ];
    const heights = values.map((value, index) => pdf.measure(value, {
      size: 8.5,
      bold: index === 0 || index === 5,
      maxWidth: columns[index].width - 8,
      lineHeight: 11,
    }));
    const rowH = Math.max(22, ...heights) + 6;
    if (selected) pdf.fillRect(x, y, width, rowH, THEME.selected);
    pdf.fillRect(x, y + rowH - 0.4, width, 0.4, THEME.border);
    cx = x;
    values.forEach((value, index) => {
      const column = columns[index];
      pdf.text(value, column.align === 'right' ? cx + column.width - 4 : cx + 4, y + 4, {
        size: 8.5,
        bold: index === 0 || (index === 5 && selected),
        color: index === 5 && !selected ? THEME.muted : THEME.ink,
        align: column.align === 'right' ? 'right' : 'left',
        maxWidth: column.width - 8,
        lineHeight: 11,
      });
      cx += column.width;
    });
    y += rowH;
  });
  return y;
}

function drawPortfolio(brief, analysis) {
  const { pdf, margin, contentWidth, bottom } = brief;
  const budget = formatMillions(analysis.parameters.budget_million_cop);
  let y = 36;
  y = kicker(pdf, 'DECISIÓN', margin, y);
  y += 2;
  y = sectionTitle(pdf, `COP ${budget} millones: ¿qué financiamos?`, margin, y, contentWidth);

  const gap = 8;
  const cardW = (contentWidth - gap) / 2;
  const measures = analysis.portfolio.measures;
  const pairs = [];
  for (let index = 0; index < measures.length; index += 2) {
    const pair = [measures[index], measures[index + 1]].filter(Boolean);
    pairs.push({
      pair,
      height: Math.max(...pair.map((measure) => measureCardHeight(pdf, measure, cardW))),
    });
  }
  const sacrificePreview = sacrificeView(analysis);
  const sacrificeH = sacrificePreview.grey ? 108 : 78;
  const cardsBlock = pairs.reduce((sum, row) => sum + row.height + gap, 0);
  const spare = bottom - (y + cardsBlock + 4 + 58 + 12 + 52 + 12 + sacrificeH);
  const bump = spare > 36 ? Math.min(16, spare / pairs.length) : 0;
  pairs.forEach((row) => {
    const rowH = row.height + bump;
    row.pair.forEach((measure, offset) => {
      drawMeasureCard(pdf, measure, margin + offset * (cardW + gap), y, cardW, rowH);
    });
    y += rowH + gap;
  });
  y += 4;

  const totalH = 58;
  card(pdf, margin, y, contentWidth, totalH, { accent: THEME.goldDeep });
  pdf.text('TOTAL', margin + 14, y + 8, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(`COP ${formatMillions(analysis.portfolio.cost)} M`, margin + 14, y + 22, {
    size: 16,
    bold: true,
    color: THEME.ink,
    lineHeight: 20,
  });
  pdf.text('RESTANTE', margin + 210, y + 8, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(`COP ${formatMillions(analysis.portfolio.remaining)} M`, margin + 210, y + 22, {
    size: 16,
    bold: true,
    color: THEME.ink,
    lineHeight: 20,
  });
  y += totalH + 12;

  y = drawInvestment(pdf, margin, y, contentWidth, analysis);
  y += 12;

  const sacrifice = sacrificePreview;
  const leftover = bottom - (y + sacrificeH);
  const boxH = sacrificeH + Math.max(0, Math.min(leftover - 10, 56));
  card(pdf, margin, y, contentWidth, boxH, { accent: THEME.rust });
  pdf.text('¿QUÉ SACRIFICAMOS?', margin + 14, y + 8, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
  pdf.text('La decisión también muestra el costo de oportunidad del fondo.', margin + 14, y + 66, {
    size: 9,
    color: THEME.muted,
    maxWidth: contentWidth - 28,
    lineHeight: 12,
  });
  if (sacrifice.nearest) {
    const blockW = sacrifice.grey ? contentWidth / 2 - 20 : contentWidth - 28;
    pdf.text(sacrifice.nearest.name, margin + 14, y + 26, {
      size: 11,
      bold: true,
      color: THEME.ink,
      maxWidth: blockW,
      lineHeight: 14,
    });
    const cost = sacrifice.nearest.cost == null ? '' : `COP ${formatMillions(sacrifice.nearest.cost)} M · `;
    pdf.text(`${cost}Brecha verificada: ${sacrifice.nearest.gapDisplay}`, margin + 14, y + boxH - 22, {
      size: 9,
      color: THEME.ink,
      maxWidth: blockW,
      lineHeight: 12,
    });
  }
  if (sacrifice.grey) {
    const gx = margin + contentWidth / 2 + 8;
    const blockW = contentWidth / 2 - 24;
    pdf.text(sacrifice.grey.name, gx, y + 26, {
      size: 11,
      bold: true,
      color: THEME.ink,
      maxWidth: blockW,
      lineHeight: 14,
    });
    pdf.text(`COP ${formatMillions(sacrifice.grey.cost)} M. El costo desplaza otras medidas del fondo.`, gx, y + boxH - 22, {
      size: 8.5,
      color: THEME.ink,
      maxWidth: blockW,
      lineHeight: 11.5,
    });
  }
  y += boxH;
  brief.guard(y, 'portafolio');
}

function measureCardHeight(pdf, measure, width) {
  const inner = width - 24;
  const nameH = pdf.measure(measure.name, { size: 10, bold: true, maxWidth: inner, lineHeight: 13 });
  const scopeH = pdf.measure(measure.place.localization, { size: 8.5, maxWidth: inner, lineHeight: 11.5 });
  const whyH = pdf.measure(whyEnters(measure), { size: 8.5, maxWidth: inner, lineHeight: 11.5 });
  return 12 + nameH + 3 + scopeH + 4 + 16 + 16 + 4 + whyH + 10;
}

function drawMeasureCard(pdf, measure, x, y, w, h) {
  card(pdf, x, y, w, h);
  const inner = w - 24;
  let cursor = y + 8;
  cursor += pdf.text(measure.name, x + 12, cursor, {
    size: 10,
    bold: true,
    color: THEME.ink,
    maxWidth: inner,
    lineHeight: 13,
  });
  cursor += 2;
  cursor += pdf.text(measure.place.localization, x + 12, cursor, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: inner,
    lineHeight: 11.5,
  });
  cursor += 3;
  pdf.text(`COP ${formatMillions(measure.cost)} M`, x + 12, cursor, {
    size: 12,
    bold: true,
    color: THEME.ink,
    lineHeight: 15,
  });
  cursor += 18;
  let bx = x + 12;
  const dimLabel = shortDimension(measure.dimensionId);
  bx += badge(pdf, bx, cursor, dimLabel, THEME.wash, THEME.ink) + 4;
  const nbsLabel = NBS_LABELS[measure.nbsClass] ?? measure.nbsClass;
  badge(pdf, bx, cursor, nbsLabel, NBS_WASH[measure.nbsClass] ?? THEME.wash, NBS_INK[measure.nbsClass] ?? THEME.ink);
  cursor += 18;
  pdf.text(whyEnters(measure), x + 12, cursor, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: inner,
    lineHeight: 11.5,
  });
}

function drawInvestment(pdf, x, y, width, analysis) {
  pdf.text('INVERSIÓN POR TIPO', x, y, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
  y += 16;
  const parts = analysis.nbs.filter((item) => item.investment > 0);
  const total = parts.reduce((sum, item) => sum + item.investment, 0) || 1;
  const barH = 12;
  let cursor = x;
  parts.forEach((part) => {
    const slice = (part.investment / total) * width;
    pdf.fillRect(cursor, y, slice, barH, NBS_COLOR[part.nbsClass] ?? THEME.ink);
    cursor += slice;
  });
  y += barH + 8;
  let lx = x;
  parts.forEach((part) => {
    const label = `${part.label}  COP ${formatMillions(part.investment)} M`;
    const labelW = widthOf(label, 8.5, false);
    if (lx > x && lx + labelW > x + width) {
      lx = x;
      y += 14;
    }
    pdf.fillRect(lx, y + 1, 8, 8, NBS_COLOR[part.nbsClass] ?? THEME.ink);
    pdf.text(label, lx + 12, y, { size: 8.5, color: THEME.ink, lineHeight: 11 });
    lx += labelW + 22;
  });
  return y + 14;
}

function drawRobustness(brief, analysis) {
  const { pdf, margin, contentWidth, bottom } = brief;
  const shift = analysis.stress.shift;
  const scenario = formatScenario(shift.scenario);
  let y = 36;
  y = kicker(pdf, 'ROBUSTEZ', margin, y);
  y += 2;
  y = sectionTitle(pdf, '¿La decisión resiste el futuro?', margin, y, contentWidth);

  const cardW = (contentWidth - 28) / 2;
  const cardH = 108;
  card(pdf, margin, y, cardW, cardH);
  pdf.text('REFERENCIA', margin + 12, y + 10, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(placeName(shift.municipality_id), margin + 12, y + 28, { size: 12, bold: true, color: THEME.ink, lineHeight: 16 });
  pdf.text(dimensionName(shift.dimension_id), margin + 12, y + 46, { size: 9, color: THEME.muted, lineHeight: 12 });
  pdf.text(formatDecimal(shift.from_value, 2), margin + 12, y + 62, { size: 26, bold: true, color: THEME.ink, lineHeight: 30 });
  pdf.text(RISK_CLASS[shift.from_class] ?? CLASS_LABELS[shift.from_class] ?? shift.from_class, margin + 78, y + 74, {
    size: 11,
    bold: true,
    color: THEME.ink,
    lineHeight: 14,
  });

  pdf.fillCircle(margin + cardW + 14, y + cardH / 2, 10, THEME.hero);
  pdf.text('>', margin + cardW + 14, y + cardH / 2 - 6, {
    size: 11,
    bold: true,
    color: THEME.gold,
    align: 'center',
    lineHeight: 12,
  });

  card(pdf, margin + cardW + 28, y, cardW, cardH, { accent: THEME.goldDeep });
  pdf.text(`${scenario} · ${shift.year}`, margin + cardW + 40, y + 10, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(placeName(shift.municipality_id), margin + cardW + 40, y + 28, { size: 12, bold: true, color: THEME.ink, lineHeight: 16 });
  pdf.text(dimensionName(shift.dimension_id), margin + cardW + 40, y + 46, { size: 9, color: THEME.muted, lineHeight: 12 });
  pdf.text(formatDecimal(shift.to_value, 2), margin + cardW + 40, y + 62, { size: 26, bold: true, color: THEME.ink, lineHeight: 30 });
  pdf.text(RISK_CLASS[shift.to_class] ?? CLASS_LABELS[shift.to_class] ?? shift.to_class, margin + cardW + 106, y + 74, {
    size: 11,
    bold: true,
    color: THEME.ink,
    lineHeight: 14,
  });
  y += cardH + 10;

  const resultH = 62;
  card(pdf, margin, y, contentWidth, resultH, { accent: THEME.goldDeep });
  pdf.text('RESULTADO', margin + 14, y + 8, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(STRESS_LABELS[analysis.stress.status].toUpperCase(), margin + 14, y + 22, {
    size: 14,
    bold: true,
    color: THEME.ink,
    lineHeight: 18,
  });
  const outcome = analysis.stress.sameSet
    ? 'El portafolio no cambia ante el cambio de escenario cuantificado.'
    : stressNarrative(analysis.stress, analysis.prepared).decision;
  pdf.text(outcome, margin + 200, y + 24, { size: 9, color: THEME.ink, maxWidth: contentWidth - 220, lineHeight: 12 });
  y += resultH + 8;

  const signals = analysis.stress.evidencedDimensions.length;
  const signalText = signals === 1 ? '1 señal cuantificada' : `${signals} señales cuantificadas`;
  pdf.text('COBERTURA DEL STRESS TEST', margin, y, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  y += 14;
  pdf.text(signalText, margin, y, { size: 12, bold: true, color: THEME.ink, lineHeight: 16 });
  pdf.text(`${placeName(shift.municipality_id)} · ${dimensionName(shift.dimension_id)}`, margin + 150, y + 1, {
    size: 9.5,
    color: THEME.ink,
    lineHeight: 13,
  });
  y += 18;
  pdf.text('Otras dimensiones: integración de escenario requerida.', margin, y, {
    size: 9,
    color: THEME.muted,
    lineHeight: 12,
  });
  y += 16;

  const hinge = analysis.hinges?.[0];
  if (hinge) {
    const hingeH = 108;
    card(pdf, margin, y, contentWidth, hingeH, { fill: THEME.selected, accent: THEME.goldDeep });
    pdf.text('¿QUÉ PODRÍA CAMBIAR LA DECISIÓN?', margin + 14, y + 8, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
    pdf.text('Alternativa', margin + 14, y + 28, { size: 8.5, color: THEME.muted, lineHeight: 11 });
    pdf.text(hinge.name, margin + 14, y + 40, { size: 12, bold: true, color: THEME.ink, maxWidth: 220, lineHeight: 15 });
    pdf.text('Brecha verificada', margin + 250, y + 28, { size: 8.5, color: THEME.muted, lineHeight: 11 });
    pdf.text(hinge.gapDisplay, margin + 250, y + 40, { size: 16, bold: true, color: THEME.ink, lineHeight: 20 });
    pdf.text(BAND_ES[hinge.band] ?? hinge.interpretation, margin + 360, y + 42, {
      size: 10,
      bold: true,
      color: THEME.bronze,
      lineHeight: 13,
    });
    pdf.text(`Equivalente a ${equivalentLine(hinge)}.`, margin + 14, y + 64, {
      size: 9,
      color: THEME.ink,
      maxWidth: contentWidth - 28,
      lineHeight: 12,
    });
    pdf.text(hingePitch(analysis, hinge), margin + 14, y + 80, {
      size: 9,
      color: THEME.ink,
      maxWidth: contentWidth - 28,
      lineHeight: 12,
    });
    y += hingeH + 8;
  }

  const residual = analysis.residual.rows.filter((row) => !row.addressed && row.high.length);
  const residualH = 28 + Math.max(1, Math.min(residual.length, 3)) * 16 + 28;
  card(pdf, margin, y, contentWidth, residualH, { accent: THEME.rust });
  pdf.text('Riesgo residual', margin + 14, y + 8, { size: 11, bold: true, color: THEME.ink, lineHeight: 14 });
  residual.slice(0, 3).forEach((row, index) => {
    const places = row.high
      .map((item) => `${placeName(item.municipalityId)} · ${CLASS_LABELS[item.classification] ?? item.classification}`)
      .join(', ');
    pdf.text(`${shortDimension(row.dimensionId)} · ${places}`, margin + 14, y + 26 + index * 16, {
      size: 10,
      bold: true,
      color: THEME.ink,
      maxWidth: contentWidth - 160,
      lineHeight: 13,
    });
    pdf.text('Sin medida financiada', margin + contentWidth - 16, y + 26 + index * 16, {
      size: 9,
      color: THEME.rust,
      align: 'right',
      lineHeight: 12,
    });
  });
  pdf.text('Seleccionar una medida no equivale a eliminar la vulnerabilidad.', margin + 14, y + residualH - 20, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: contentWidth - 28,
    lineHeight: 11.5,
  });
  y += residualH + 10;

  drawPathway(pdf, margin, y, contentWidth, analysis);
  y += 82;
  const closeH = 102;
  const closeY = Math.max(y, bottom - closeH);
  drawPitchClose(pdf, margin, closeY, contentWidth);
  brief.guard(closeY + closeH, 'robustez');
}

function drawPathway(pdf, x, y, width, analysis) {
  const ids = new Set(analysis.portfolio.ids);
  const indicators = (analysis.mea?.indicators ?? []).filter((item) => ids.has(item.intervention_id)).length;
  const boxes = [
    ['HOY', 'Ejecutar el portafolio priorizado'],
    ['MONITOREAR', indicators ? `Indicadores MEA · ${indicators} ligados al portafolio` : 'Indicadores MEA'],
    ['REEVALUAR', 'Si cambian los indicadores o se integra nueva evidencia'],
  ];
  const gap = 16;
  const boxW = (width - gap * 2) / 3;
  const boxH = 68;
  boxes.forEach(([title, body], index) => {
    const bx = x + index * (boxW + gap);
    card(pdf, bx, y, boxW, boxH, { accent: index === 1 ? THEME.nature : THEME.goldDeep });
    pdf.text(title, bx + 10, y + 8, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
    pdf.text(body, bx + 10, y + 24, { size: 9, color: THEME.ink, maxWidth: boxW - 20, lineHeight: 12 });
    if (index < boxes.length - 1) {
      pdf.text('>', bx + boxW + 4, y + 26, { size: 12, bold: true, color: THEME.goldDeep, lineHeight: 14 });
    }
  });
}

function drawPitchClose(pdf, x, y, width) {
  const height = 102;
  card(pdf, x, y, width, height, { fill: THEME.hero });
  pdf.text('Ourea no reemplaza el diagnóstico climático de CORNARE. Lo convierte en una decisión presupuestal explicable, reproducible y adaptable.', x + 14, y + 12, {
    size: 10.5,
    color: THEME.heroText,
    maxWidth: width - 28,
    lineHeight: 14.5,
  });
  linkedLine(pdf, 'Prototipo en vivo', DEMO_URL, x + 14, y + 52, 9.5, THEME.gold);
  pdf.text(DEMO_URL, x + 14, y + 66, { size: 8.5, color: THEME.heroMuted, lineHeight: 11 });
  linkedLine(pdf, 'Repositorio', REPO_URL, x + 280, y + 52, 9.5, THEME.gold);
  pdf.text(REPO_URL, x + 280, y + 66, { size: 8.5, color: THEME.heroMuted, lineHeight: 11 });
  return height;
}

function drawAppendix(brief, analysis, date) {
  const { pdf, margin, contentWidth } = brief;
  const weights = analysis.parameters.weights;
  let y = 36;
  y = kicker(pdf, 'APÉNDICE', margin, y);
  y += 2;
  y = sectionTitle(pdf, 'Metodología y fuentes', margin, y, contentWidth);

  const formulaH = 96;
  card(pdf, margin, y, contentWidth, formulaH, { accent: THEME.goldDeep });
  pdf.text('FÓRMULA INSTITUCIONAL', margin + 14, y + 8, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  pdf.text(`Puntaje = ${percent(weights.vulnerability)} vulnerabilidad + ${percent(weights.recurrence)} recurrencia documentada + ${percent(weights.workshops)} componente participativo.`, margin + 14, y + 24, {
    size: 10,
    color: THEME.ink,
    maxWidth: contentWidth - 28,
    lineHeight: 13.5,
  });
  const diminish = percent(analysis.parameters.diminishing_second_measure.institucional);
  const workshopLine = analysis.parameters.workshops_scored
    ? 'El componente participativo entra con el peso definido.'
    : 'El componente participativo no se imputa: el paquete no trae esos conteos.';
  pdf.text(`La segunda medida de una dimensión conserva el ${diminish} de su término de vulnerabilidad. ${workshopLine}`, margin + 14, y + 46, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: contentWidth - 28,
    lineHeight: 11.5,
  });
  y += formulaH + 10;

  pdf.text('Cómo se relacionan los datos', margin, y, { size: 12, bold: true, color: THEME.ink, lineHeight: 16 });
  y += 18;
  const relations = [
    ['Vulnerabilidad', 'define la prioridad territorial'],
    ['Recurrencia documentada', 'aporta evidencia institucional'],
    ['Costos', 'limitan los portafolios factibles'],
    ['SIG', 'da contexto espacial'],
    ['Evidencia NbS', 'caracteriza cobeneficios, fuera del puntaje'],
    ['Escenario', 'prueba la decisión ya seleccionada'],
    ['MEA', 'cierra el ciclo de monitoreo'],
  ];
  relations.forEach(([left, right]) => {
    pdf.text(left, margin, y, { size: 9, bold: true, color: THEME.ink, lineHeight: 12 });
    pdf.text('>', margin + 148, y, { size: 9, bold: true, color: THEME.goldDeep, lineHeight: 12 });
    pdf.text(right, margin + 168, y, { size: 9, color: THEME.muted, lineHeight: 12 });
    y += 15;
  });
  y += 4;
  y += pdf.text('Esos vínculos quedan integrados en la secuencia de decisión.', margin, y, { size: 8.5, color: THEME.muted, lineHeight: 11.5 });
  y += 12;

  const standard = (analysis.nbsScreen?.find((item) => item.standard)?.standard
    ?? 'Tamiz cualitativo de ocho criterios. No es una certificación.')
    .replace(/^Screening contra/, 'Tamiz contra');
  y += pdf.text(standard, margin, y, { size: 9.5, color: THEME.ink, maxWidth: contentWidth, lineHeight: 13 });
  y += 10;
  divider(pdf, margin, y, contentWidth);
  y += 10;

  pdf.text('Fuentes principales', margin, y, { size: 12, bold: true, color: THEME.ink, lineHeight: 16 });
  y += 16;
  PRINCIPAL_SOURCES.forEach((source) => {
    const titleH = source.url
      ? linkedLine(pdf, source.title, source.url, margin, y, 9.5)
      : pdf.text(source.title, margin, y, { size: 9.5, bold: true, color: THEME.ink, maxWidth: contentWidth, lineHeight: 12.5 });
    y += Math.max(titleH, 12);
    y += pdf.text(`${source.meta}. ${source.note}`, margin, y, {
      size: 8.5,
      color: THEME.muted,
      maxWidth: contentWidth,
      lineHeight: 11.5,
    });
    y += 6;
  });

  y += 4;
  const closeH = 78;
  const closeY = Math.max(y + 8, brief.bottom - closeH);
  card(pdf, margin, closeY, contentWidth, closeH, { fill: THEME.hero });
  pdf.text('Ourea no reemplaza el diagnóstico climático de CORNARE. Lo convierte en una decisión presupuestal explicable, reproducible y adaptable.', margin + 14, closeY + 10, {
    size: 9.5,
    color: THEME.heroText,
    maxWidth: contentWidth - 28,
    lineHeight: 13,
  });
  pdf.text(`Decision fingerprint: ${analysis.fingerprint}`, margin + 14, closeY + 42, {
    size: 8.5,
    color: THEME.gold,
    lineHeight: 11,
  });
  pdf.text(`${formatBriefDate(date)} · versión ${PRODUCT_VERSION}`, margin + 14, closeY + 56, {
    size: 8.5,
    color: THEME.heroMuted,
    lineHeight: 11,
  });
  y = closeY + closeH;
  brief.guard(y, 'apéndice');
}

export function composeDecisionBrief(analysis, date = new Date()) {
  const brief = openBrief();
  drawCover(brief, analysis);
  brief.newPage();
  drawLogic(brief, analysis);
  brief.newPage();
  drawPortfolio(brief, analysis);
  brief.newPage();
  drawRobustness(brief, analysis);
  brief.newPage();
  drawAppendix(brief, analysis, date);
  return brief.finish();
}

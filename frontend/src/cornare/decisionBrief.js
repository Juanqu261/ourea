import { NBS_LABELS, STRESS_LABELS, CLASS_LABELS } from '../domain/evidence.js';
import { dimensionName, stressNarrative } from '../domain/explanations.js';
import { computeLeaveOneOutImpact } from '../domain/portfolioSearch.js';
import { buildBriefMapImage } from './briefMap.js';
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

function lossDigits(loss) {
  return loss < 0.01 ? 4 : 3;
}

function rationalePlace(measure) {
  if (measure.scope === 'corridor' || String(measure.place?.localization ?? '').startsWith('Corredor')) return 'el corredor';
  return measure.place?.localization ?? '';
}

export function selectionRationale(measure, analysis, impact) {
  const row = analysis.matrix.rows.find((item) => item.id === measure.id);
  const score = formatDecimal(row?.standaloneVerifiedScore ?? 0, 3);
  const contribution = formatDecimal(measure.part.contribution, 3);
  const dimension = shortDimension(measure.dimensionId);
  const place = rationalePlace(measure);
  const high = measure.classScore >= 0.6;
  const documented = !measure.recurrence.withheld && measure.recurrence.count > 0;
  const lines = [];
  if (high) {
    lines.push(`Prioridad: ${dimension} ${measure.classificationLabel} en ${place}.`);
  } else if (documented) {
    lines.push(`Prioridad: ${dimension} es ${measure.classificationLabel}. Hay recurrencia documentada y no se solapa con otra medida de esa dimensión.`);
  } else {
    lines.push(`Prioridad: ${dimension} es ${measure.classificationLabel}. Entra por costo y por la mejor combinación factible, no por esa clase sola.`);
  }
  if (measure.part.factor < 1) {
    lines.push(`Aporte: ${score} por sí sola. En el portafolio conserva el ${percent(measure.part.factor)} del término de vulnerabilidad y suma ${contribution}.`);
  } else if (measure.recurrence.withheld) {
    lines.push(`Aporte: ${score} verificado. La recurrencia no integrada no se cuenta como cero. En el conjunto suma ${contribution}.`);
  } else {
    lines.push(`Aporte: ${score} verificado. En el conjunto suma ${contribution}.`);
  }
  const cost = formatMillions(measure.cost);
  if (impact && impact.objectiveLoss > 0) {
    lines.push(`Rol: COP ${cost} M. Si se excluye, el mejor portafolio pierde ${formatDecimal(impact.objectiveLoss, lossDigits(impact.objectiveLoss))}.`);
  } else {
    lines.push(`Rol: COP ${cost} M. Existe una solución equivalente bajo la evidencia integrada.`);
  }
  return lines.join(' ');
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

function drawCover(brief, analysis, map) {
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
  drawTerritory(pdf, margin, y, contentWidth, mapH, map);
  brief.guard(y + mapH, 'mapa');
}

function drawTerritory(pdf, x, y, w, h, map) {
  card(pdf, x, y, w, h);
  pdf.text('CONTEXTO TERRITORIAL DEL PORTAFOLIO', x + 12, y + 8, {
    size: 9,
    bold: true,
    color: THEME.ink,
    lineHeight: 12,
  });
  const caption = 'Rionegro, Guarne y Marinilla. Límites municipales: DANE MGN 2025. Contexto hídrico y ecosistémico: CORNARE.';
  const guardrail = 'Las capas muestran contexto territorial; no representan sitios definitivos de obra.';
  const captionH = pdf.measure(caption, { size: 8, maxWidth: w - 24, lineHeight: 10.5 })
    + pdf.measure(guardrail, { size: 8, maxWidth: w - 24, lineHeight: 10.5 });
  const plotX = x + 10;
  const plotY = y + 24;
  const plotW = w - 20;
  const plotH = h - 30 - captionH;
  const scale = Math.min(plotW / map.width, plotH / map.height);
  const displayW = map.width * scale;
  const displayH = map.height * scale;
  const imageX = plotX + (plotW - displayW) / 2;
  const imageY = plotY + (plotH - displayH) / 2;
  pdf.addJpeg({
    bytes: map.bytes,
    width: map.width,
    height: map.height,
    x: imageX,
    y: imageY,
    displayWidth: displayW,
    displayHeight: displayH,
  });
  map.labels.forEach((label) => {
    const labelX = imageX + (label.x / map.width) * displayW;
    const labelY = imageY + (label.y / map.height) * displayH - 5;
    const labelW = widthOf(label.name, 7.5, true) + 8;
    pdf.fillRect(labelX - labelW / 2, labelY - 1, labelW, 11, [24, 22, 20]);
    pdf.text(label.name, labelX, labelY, {
      size: 7.5,
      bold: true,
      color: THEME.heroText,
      align: 'center',
      lineHeight: 9,
    });
  });
  let cursor = y + h - captionH - 8;
  cursor += pdf.text(caption, x + 12, cursor, { size: 8, color: THEME.muted, maxWidth: w - 24, lineHeight: 10.5 });
  pdf.text(guardrail, x + 12, cursor, { size: 8, color: THEME.muted, maxWidth: w - 24, lineHeight: 10.5 });
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

function drawPortfolio(brief, analysis, impacts) {
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
      height: Math.max(...pair.map((measure) => measureCardHeight(pdf, measure, cardW, analysis, impacts))),
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
      drawMeasureCard(pdf, measure, margin + offset * (cardW + gap), y, cardW, rowH, analysis, impacts);
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

function measureCardHeight(pdf, measure, width, analysis, impacts) {
  const inner = width - 24;
  const nameH = pdf.measure(measure.name, { size: 10, bold: true, maxWidth: inner, lineHeight: 13 });
  const scopeH = pdf.measure(measure.place.localization, { size: 8.5, maxWidth: inner, lineHeight: 11.5 });
  const why = selectionRationale(measure, analysis, impacts.get(measure.id));
  const whyH = pdf.measure(why, { size: 8, maxWidth: inner, lineHeight: 10.5 });
  return nameH + scopeH + whyH + 66;
}

function drawMeasureCard(pdf, measure, x, y, w, h, analysis, impacts) {
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
  cursor += 16;
  pdf.text('POR QUÉ LA SELECCIONAMOS', x + 12, cursor, {
    size: 7.5,
    bold: true,
    color: THEME.bronze,
    lineHeight: 10,
  });
  cursor += 12;
  pdf.text(selectionRationale(measure, analysis, impacts.get(measure.id)), x + 12, cursor, {
    size: 8,
    color: THEME.ink,
    maxWidth: inner,
    lineHeight: 10.5,
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

function equation(pdf, x, y, width, line) {
  const height = 22;
  pdf.fillRect(x, y, width, height, THEME.hero);
  pdf.fillRect(x, y, 2, height, THEME.gold);
  pdf.text(line, x + 10, y + 5, { size: 9, color: THEME.heroText, lineHeight: 12 });
  return height;
}

function drawModel(brief, analysis) {
  const { pdf, margin, contentWidth } = brief;
  const weights = analysis.parameters.weights;
  const scores = analysis.parameters.class_scores;
  const alpha = analysis.parameters.diminishing_second_measure.institucional;
  const budget = analysis.parameters.budget_million_cop;
  const objective = analysis.portfolio.institucional.objective;
  const count = analysis.prepared.length;
  const hinge = analysis.hinges?.[0];
  const shift = analysis.stress.shift;
  const scenario = formatScenario(shift.scenario);
  const psa = analysis.portfolio.measures.find((measure) => measure.id === 'bio_psa');
  const areas = analysis.portfolio.measures.find((measure) => measure.id === 'bio_pa');
  const rowOf = (id) => analysis.matrix.rows.find((row) => row.id === id);
  let y = 36;
  y = kicker(pdf, 'MODELO', margin, y);
  y += 2;
  y = sectionTitle(pdf, 'MODELO DETERMINÍSTICO', margin, y, contentWidth);
  y += pdf.text('Cómo Ourea convierte evidencia institucional en una decisión presupuestal.', margin, y, {
    size: 10,
    color: THEME.muted,
    maxWidth: contentWidth,
    lineHeight: 13,
  });
  y += 6;
  y += pdf.text('Ourea no predice probabilidades de éxito ni recalcula el riesgo climático. Evalúa exhaustivamente portafolios discretos utilizando la evidencia institucional integrada.', margin, y, {
    size: 9,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 12,
  });
  y += 8;

  const scale = `Muy baja ${formatDecimal(scores.muy_baja, 1)} · Baja ${formatDecimal(scores.baja, 1)} · Media ${formatDecimal(scores.media, 1)} · Alta ${formatDecimal(scores.alta, 1)} · Muy alta ${formatDecimal(scores.muy_alta, 1)}`;
  y += pdf.text('i es la medida. d(i) es su dimensión. x_i vale 1 si se financia y 0 si no. c_i es su costo en COP millones. v_i es la clase de vulnerabilidad. r_i es la recurrencia documentada normalizada, cuando está observada. p_i es el componente participativo.', margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 4;
  y += pdf.text(scale, margin, y, { size: 8.5, color: THEME.muted, maxWidth: contentWidth, lineHeight: 11.5 });
  y += 8;

  pdf.text('FÓRMULA INSTITUCIONAL PUBLICADA', margin, y, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  y += 14;
  y += equation(pdf, margin, y, contentWidth, `S_i = ${formatDecimal(weights.vulnerability, 2)} v_i + ${formatDecimal(weights.recurrence, 2)} r_i + ${formatDecimal(weights.workshops, 2)} p_i`);
  y += 6;
  y += pdf.text(`${percent(weights.vulnerability)} vulnerabilidad, ${percent(weights.recurrence)} recurrencia documentada y ${percent(weights.workshops)} recurrencia participativa.`, margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 8;

  pdf.text('PUNTAJE VERIFICADO QUE SE OPTIMIZA', margin, y, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  y += 14;
  y += equation(pdf, margin, y, contentWidth, `Sver_i = ${formatDecimal(weights.vulnerability, 2)} v_i + I_i × ${formatDecimal(weights.recurrence, 2)} r_i`);
  y += 6;
  y += pdf.text('I_i vale 1 si la recurrencia documentada tiene cobertura suficiente, y 0 en el objetivo verificado cuando esa evidencia no está disponible. Eso no afirma que la recurrencia sea cero: ese aporte no se cuenta como evidencia verificada. El componente participativo aún no está integrado en la evidencia operacional; se conserva explícitamente como incertidumbre y no se imputa.', margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 4;
  y += pdf.text(`Incertidumbre participativa: 0 <= ${formatDecimal(weights.workshops, 2)} p_i <= ${formatDecimal(weights.workshops, 2)}.`, margin, y, {
    size: 8.5,
    color: THEME.muted,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 8;

  pdf.text('SOLAPAMIENTO POR DIMENSIÓN', margin, y, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  y += 14;
  y += equation(pdf, margin, y, contentWidth, `A_i(P) = alfa_i(P) × ${formatDecimal(weights.vulnerability, 2)} v_i + I_i × ${formatDecimal(weights.recurrence, 2)} r_i`);
  y += 6;
  const overlap = `alfa_i vale 1,00 para la medida de mayor puntaje verificado en la dimensión y ${formatDecimal(alpha, 2)} para una medida adicional. El factor multiplica solo el término de vulnerabilidad. Una segunda medida de la misma dimensión sigue aportando valor, pero Ourea evita contabilizar dos veces la misma prioridad territorial.`;
  y += pdf.text(overlap, margin, y, { size: 8.5, color: THEME.ink, maxWidth: contentWidth, lineHeight: 11.5 });
  if (psa && areas) {
    y += 3;
    const example = `${psa.name.split('–')[0].trim()}: ${formatDecimal(rowOf(psa.id).standaloneVerifiedScore, 3)} por sí sola. ${areas.name.split('–')[0].trim()}: ${formatDecimal(rowOf(areas.id).standaloneVerifiedScore, 3)} por sí sola y ${formatDecimal(areas.part.contribution, 3)} dentro del portafolio, con el término de vulnerabilidad en ${percent(areas.part.factor)}.`;
    y += pdf.text(example, margin, y, { size: 8.5, color: THEME.ink, maxWidth: contentWidth, lineHeight: 11.5 });
  }
  y += 8;

  pdf.text('BÚSQUEDA', margin, y, { size: 8.5, bold: true, color: THEME.bronze, lineHeight: 11 });
  y += 14;
  y += equation(pdf, margin, y, contentWidth, `maximizar Z(P) = suma x_i A_i(P), con suma c_i x_i <= ${formatMillions(budget)} y x_i en {0, 1}`);
  y += 6;
  y += pdf.text(`${count} medidas indivisibles, una unidad funcional por medida. ${formatMillions(2 ** count)} subconjuntos se enumeran de forma exhaustiva y determinística.`, margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 3;
  y += pdf.text('Si dos portafolios empatan en Z, se prefiere el que deja más presupuesto sin usar. Si el empate continúa, decide el orden lexicográfico de los identificadores ya ordenados.', margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 6;
  y += pdf.text(`Portafolio recomendado: Z* = ${formatDecimal(objective, 4)}. COP ${formatMillions(analysis.portfolio.cost)} M. ${analysis.portfolio.measures.length} medidas. P* es el portafolio que maximiza Z bajo el presupuesto.`, margin, y, {
    size: 9,
    bold: true,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 12,
  });
  y += 8;

  if (hinge) {
    const relative = formatDecimal(hinge.rangeFraction * 100, 1);
    y += pdf.text(`Sensibilidad: la brecha con la alternativa más cercana es ${hinge.gapDisplay}. El rango ponderado del criterio participativo es ${formatDecimal(weights.workshops, 2)}. ${hinge.gapDisplay} / ${formatDecimal(weights.workshops, 2)} = ${relative}% de ese rango. Una diferencia de ese tamaño puede invertir el ordenamiento más cercano. No es un porcentaje de talleres ni una probabilidad.`, margin, y, {
      size: 8.5,
      color: THEME.ink,
      maxWidth: contentWidth,
      lineHeight: 11.5,
    });
    y += 6;
  }
  y += pdf.text(`SSP3-7.0 es una prueba posterior, no la optimización. El cambio cuantificado es ${placeName(shift.municipality_id)}, ${dimensionName(shift.dimension_id)}: ${formatDecimal(shift.from_value, 2)} ${RISK_CLASS[shift.from_class] ?? shift.from_class} hacia ${formatDecimal(shift.to_value, 2)} ${RISK_CLASS[shift.to_class] ?? shift.to_class} en ${shift.year} bajo ${scenario}. ${analysis.stress.sameSet ? 'El conjunto seleccionado no cambia ante ese cambio cuantificado.' : 'El conjunto seleccionado cambia ante ese cambio cuantificado.'} Esto no significa que todas las dimensiones tengan series ${scenario}.`, margin, y, {
    size: 8.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 11.5,
  });
  y += 8;

  const flow = [
    'CLASE DE VULNERABILIDAD',
    'RECURRENCIA OBSERVADA',
    'PUNTAJE VERIFICADO',
    'SOLAPAMIENTO POR DIMENSIÓN',
    'APORTE AL PORTAFOLIO',
    `RESTRICCIÓN COP ${formatMillions(budget)} M`,
    `${formatMillions(2 ** count)} SUBCONJUNTOS`,
    'PORTAFOLIO RECOMENDADO',
    scenario,
    'RIESGO RESIDUAL / MEA',
  ];
  flow.forEach((step, index) => {
    pdf.fillCircle(margin + 3, y + 4, 2.2, THEME.gold);
    pdf.text(step, margin + 12, y, { size: 8, bold: true, color: THEME.ink, lineHeight: 10 });
    if (index < flow.length - 1) {
      pdf.strokePath([[margin + 3, y + 8], [margin + 3, y + 12]], { color: THEME.goldDeep, lineWidth: 1 });
    }
    y += 12;
  });
  brief.guard(y, 'modelo');
}

function drawSources(brief, analysis, date) {
  const { pdf, margin, contentWidth } = brief;
  let y = 36;
  y = kicker(pdf, 'APÉNDICE', margin, y);
  y += 2;
  y = sectionTitle(pdf, 'Fuentes y guardarraíles', margin, y, contentWidth);
  y += pdf.text('El contexto espacial no entra al puntaje. El tamiz de soluciones basadas en la naturaleza no certifica medidas. La mitigación y las emisiones no sustituyen la adaptación.', margin, y, {
    size: 9.5,
    color: THEME.ink,
    maxWidth: contentWidth,
    lineHeight: 13,
  });
  y += 8;
  const standard = (analysis.nbsScreen?.find((item) => item.standard)?.standard
    ?? 'Tamiz cualitativo de ocho criterios. No es una certificación.')
    .replace(/^Screening contra/, 'Tamiz contra');
  y += pdf.text(standard, margin, y, { size: 9, color: THEME.muted, maxWidth: contentWidth, lineHeight: 12 });
  y += 8;
  divider(pdf, margin, y, contentWidth);
  y += 10;
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
    y += 8;
  });
  y += 10;
  const limits = [
    'No se recalcula el riesgo climático publicado por CORNARE.',
    'No se inventan probabilidades de éxito.',
    'No se imputa el componente participativo como cero observado.',
    'No se convierten las capas geográficas en puntaje.',
  ];
  limits.forEach((line) => {
    pdf.fillCircle(margin + 4, y + 5, 1.6, THEME.goldDeep);
    y += pdf.text(line, margin + 14, y, { size: 9, color: THEME.ink, maxWidth: contentWidth - 14, lineHeight: 12 });
    y += 4;
  });
  const barY = Math.max(y + 16, brief.bottom - 40);
  card(pdf, margin, barY, contentWidth, 36, { fill: THEME.hero });
  pdf.text(`${formatBriefDate(date)} · Ourea · versión ${PRODUCT_VERSION}`, margin + 14, barY + 12, {
    size: 9,
    color: THEME.heroText,
    lineHeight: 12,
  });
  brief.guard(barY + 36, 'fuentes');
}

export async function composeDecisionBrief(analysis, date = new Date(), options = {}) {
  const map = options.map ?? await buildBriefMapImage(options.mapOptions);
  const impacts = new Map(
    computeLeaveOneOutImpact(analysis.prepared, analysis.parameters, analysis.portfolio)
      .map((item) => [item.id, item]),
  );
  const brief = openBrief();
  drawCover(brief, analysis, map);
  brief.newPage();
  drawLogic(brief, analysis);
  brief.newPage();
  drawPortfolio(brief, analysis, impacts);
  brief.newPage();
  drawRobustness(brief, analysis);
  brief.newPage();
  drawModel(brief, analysis);
  brief.newPage();
  drawSources(brief, analysis, date);
  return brief.finish();
}

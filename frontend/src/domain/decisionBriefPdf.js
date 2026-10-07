import { createPdf, jpegSofSize } from './pdfDocument.js';
import { assetUrl } from '../config/assetUrl.js';
import { formatUsd } from './costEstimate.js';
import { AI_REVIEW_COPY, READINESS_LABELS } from '../config/aiReview.js';
import { MECHANISM_COPY, MECHANISM_STORYBOARD } from './hillsideMechanism.js';
import { cellSimulatorUrl } from './sessionLink.js';

const GOLD = [200, 167, 94];
const DARK = [17, 21, 23];
const INK = [28, 36, 40];
const MUTED = [72, 84, 88];
const CREAM = [247, 243, 234];
const CARD = [236, 230, 216];
const WHITE = [255, 255, 255];
const TYPE_COLORS = {
  rwh: [93, 145, 167],
  drainage: [200, 167, 94],
  restoration: [108, 152, 120],
};
const IMAGERY_BBOX = [-75.5426, 6.2489, -75.5351, 6.2564];
const ACTION_LEGEND = [
  { type: 'rwh', color: [93, 145, 167], label: 'Rainwater harvesting' },
  { type: 'drainage', color: [200, 167, 94], label: 'Drainage' },
  { type: 'restoration', color: [108, 152, 120], label: 'Restoration' },
];
const DEMO = 'https://ybedoyab.github.io/ourea/';

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cite(brief, sourceId) {
  const hit = (brief.citations ?? []).find((item) => item.id === sourceId);
  return hit ? `[${hit.n}]` : '';
}

function citesFor(brief, ids) {
  return [...new Set((ids ?? []).map((id) => cite(brief, id)).filter(Boolean))].join(' ');
}

function scaleCmd(x, y, scale, commands) {
  return commands.map(([op, ...nums]) => {
    const mapped = [op];
    for (let i = 0; i < nums.length; i += 2) {
      mapped.push(x + nums[i] * scale, y + nums[i + 1] * scale);
    }
    return mapped;
  });
}

function drawLogo(pdf, x, y, scale = 0.72) {
  pdf.strokeCommands(scaleCmd(x, y, scale, [
    ['M', 8, 42], ['L', 24, 16], ['L', 32, 30], ['L', 42, 12], ['L', 56, 42],
  ]), { color: [238, 232, 220], lineWidth: 1.55 });
  pdf.strokeCommands(scaleCmd(x, y, scale, [
    ['M', 10, 46], ['C', 20, 42, 28, 50, 38, 44], ['C', 46, 40, 52, 46, 54, 44],
  ]), { color: GOLD, lineWidth: 1.15 });
}

function header(pdf, brief) {
  pdf.fillRect(0, 0, pdf.width, 58, DARK);
  pdf.fillRect(0, 58, pdf.width, 3, GOLD);
  drawLogo(pdf, 22, 6, 0.48);
  pdf.text('OUREA', 62, 10, { size: 9, bold: true, color: GOLD });
  pdf.text('Investment and decision brief', 62, 22, { size: 13, bold: true, color: WHITE });
  pdf.text(brief.subtitle, 62, 40, { size: 9, color: [217, 189, 117] });
  pdf.text(formatDate(brief.generatedAt), pdf.width - 168, 22, { size: 9, color: [140, 153, 157] });
}

function footerBar(pdf, brief) {
  pdf.fillRect(0, pdf.height - 28, pdf.width, 28, DARK);
  pdf.text(brief.slogan, 40, pdf.height - 18, { size: 9, color: GOLD });
}

function startPage(pdf, brief) {
  pdf.fillRect(0, 0, pdf.width, pdf.height, CREAM);
  header(pdf, brief);
  footerBar(pdf, brief);
}

function stampPages(pdf, brief) {
  pdf.stamp((page, total) => {
    pdf.text(`Page ${page} of ${total}`, pdf.width - 40, pdf.height - 18, {
      size: 9,
      color: [140, 153, 157],
      align: 'right',
    });
  });
}

function continuePage(pdf, brief, y, needed = 28) {
  if (y + needed <= pdf.height - 40) return y;
  pdf.addPage();
  startPage(pdf, brief);
  return 76;
}

const ZEBRA = [242, 237, 226];

function tableHeader(pdf, x, y, width, columns) {
  pdf.fillRect(x, y, width, 18, CARD);
  columns.forEach((col) => {
    pdf.text(col.label, x + col.dx, y + 4, { size: 9, bold: true, color: GOLD, maxWidth: col.width ?? 80 });
  });
  return y + 18;
}

function tableBand(pdf, x, y, width, height, stripe) {
  pdf.fillRect(x, y, width, height, stripe ? ZEBRA : WHITE);
}

function usdTriple(value) {
  if (!value) return ['—', '—', '—'];
  return [formatUsd(value.low), formatUsd(value.base), formatUsd(value.high)];
}

function briefPlan(brief) {
  return (brief.projects ?? []).map((item) => ({ cell_id: item.cell_id, type: item.type }));
}

function projectLink(brief, cellId) {
  if (!brief.simulatorUrl) return null;
  return cellSimulatorUrl(cellId, brief.simulatorUrl, briefPlan(brief));
}

function communityStatusLabel(status) {
  if (status === 'community_reviewed') return 'Community review recorded';
  if (status === 'requires_deliberation') return 'Needs deliberation';
  if (status === 'incomplete') return 'Incomplete review';
  return 'Not assessed';
}

function projectSite(lng, lat, frame, bbox) {
  const [west, south, east, north] = bbox;
  const u = (lng - west) / (east - west);
  const v = (north - lat) / (north - south);
  return [frame.x + 8 + u * (frame.w - 16), frame.y + 8 + v * (frame.h - 16)];
}

function drawFallbackMap(pdf, brief, x, y, width, height) {
  pdf.fillRect(x, y, width, height, DARK);
  const frame = { x, y, w: width, h: height };
  const bbox = brief.bbox?.length === 4 ? brief.bbox : IMAGERY_BBOX;
  (brief.sites ?? []).forEach((site) => {
    if (!site.ring?.length) return;
    const points = site.ring.map((point) => projectSite(point[0], point[1], frame, bbox));
    pdf.strokePath(points, {
      color: site.type ? (TYPE_COLORS[site.type] ?? GOLD) : [80, 90, 94],
      lineWidth: site.type ? 1.6 : 0.5,
    });
  });
  pdf.text('Llanaditas planning cells', x + 10, y + 8, { size: 9, bold: true, color: GOLD });
}

function drawHouse(pdf, x, y, scale = 1, treat = false) {
  const w = 7 * scale;
  const h = 8 * scale;
  pdf.fillRect(x - w / 2, y - h, w, h, treat ? [180, 204, 188] : [216, 208, 196]);
  pdf.strokePath([
    [x - w / 2 - 1, y - h],
    [x, y - h - 5 * scale],
    [x + w / 2 + 1, y - h],
  ], { color: [61, 70, 74], lineWidth: 0.8 });
}

function drawMechanism(pdf, x, y, width, height) {
  const gap = 8;
  const frameW = (width - gap * 3) / 4;
  MECHANISM_STORYBOARD.forEach((frame, index) => {
    const fx = x + index * (frameW + gap);
    pdf.fillRect(fx, y, frameW, height, WHITE);
    pdf.strokeRect(fx, y, frameW, height, [210, 200, 180], 0.7);
    pdf.fillRect(fx + 6, y + 36, frameW - 12, height - 52, index === 3 ? [222, 232, 224] : [244, 238, 226]);
    const treat = index === 3;
    drawHouse(pdf, fx + frameW * 0.28, y + height - 24, 1.05, treat);
    drawHouse(pdf, fx + frameW * 0.52, y + height - 30, 1.05, treat);
    drawHouse(pdf, fx + frameW * 0.76, y + height - 36, 1.05, treat);
    if (index === 0) pdf.fillCircle(fx + frameW - 18, y + 48, 7, [168, 196, 208]);
    if (index === 1) {
      pdf.strokePath([[fx + 12, y + 44], [fx + frameW - 14, y + height - 16]], { color: [126, 167, 194], lineWidth: 2 });
    }
    if (index === 2) {
      pdf.strokePath([
        [fx + 14, y + 50],
        [fx + frameW * 0.45, y + 70],
        [fx + frameW - 12, y + height - 14],
      ], { color: [176, 132, 84], lineWidth: 1.2 });
    }
    if (index === 3) {
      pdf.strokePath([[fx + 10, y + 48], [fx + frameW - 12, y + height - 20]], { color: GOLD, lineWidth: 2 });
      pdf.fillRect(fx + 16, y + 46, 7, 9, [93, 145, 167]);
    }
    pdf.text(frame.title, fx + 6, y + 6, { size: 9, bold: true, color: INK, maxWidth: frameW - 12 });
  });
}

function drawTornado(pdf, x, y, width, drivers) {
  const max = Math.max(...drivers.map((item) => Math.max(item.down, item.up, 1)));
  const barW = (width - 160) / 2;
  drivers.slice(0, 5).forEach((driver, index) => {
    const rowY = y + index * 28;
    pdf.text(driver.label, x, rowY, { size: 9, color: INK, maxWidth: 150 });
    const left = (driver.down / max) * barW;
    const right = (driver.up / max) * barW;
    const mid = x + 160 + barW;
    pdf.fillRect(mid - left, rowY + 4, left, 12, [200, 167, 94]);
    pdf.fillRect(mid, rowY + 4, right, 12, [108, 152, 120]);
    pdf.text(formatUsd(driver.low), mid - barW, rowY + 4, { size: 9, color: MUTED });
    pdf.text(formatUsd(driver.high), mid + barW, rowY + 4, { size: 9, color: MUTED, align: 'right' });
  });
  return Math.min(5, drivers.length) * 28;
}

const loadImage = typeof Image === 'undefined'
  ? async () => null
  : (url) => new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

export async function renderSitePlate(brief) {
  if (typeof document === 'undefined') return null;
  const sites = brief.sites ?? [];
  if (!sites.length) return null;
  const width = 1600;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const aerialUrl = brief.aerialImageUrl ?? assetUrl('data/llanaditas_imagery.jpg');
  const aerial = brief.aerialImageUrl === null ? null : await loadImage(aerialUrl);
  if (aerial) ctx.drawImage(aerial, 0, 0, width, height);
  else {
    ctx.fillStyle = '#12181b';
    ctx.fillRect(0, 0, width, height);
  }
  const frame = { x: 0, y: 0, w: width, h: height };
  const bbox = brief.bbox?.length === 4 ? brief.bbox : IMAGERY_BBOX;
  sites.forEach((site) => {
    if (!site.ring?.length) return;
    ctx.beginPath();
    site.ring.forEach((point, index) => {
      const [px, py] = projectSite(point[0], point[1], frame, bbox);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    if (site.type) {
      ctx.fillStyle = `rgba(${(TYPE_COLORS[site.type] ?? GOLD).join(',')}, 0.42)`;
      ctx.fill();
      ctx.strokeStyle = '#f6f1e6';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });
  ctx.fillStyle = 'rgba(17,21,23,0.78)';
  ctx.fillRect(0, 0, width, 48);
  ctx.fillStyle = '#d9bd75';
  ctx.font = '700 16px Inter, system-ui, sans-serif';
  ctx.fillText('Llanaditas / Upper Comuna 8, Medellin', 24, 30);
  const presentTypes = new Set(sites.filter((site) => site.type).map((site) => site.type));
  ctx.fillStyle = 'rgba(17,21,23,0.78)';
  ctx.fillRect(0, height - 44, width, 44);
  ACTION_LEGEND.filter((item) => presentTypes.has(item.type)).forEach((item, index) => {
    ctx.fillStyle = `rgb(${item.color.join(',')})`;
    ctx.beginPath();
    ctx.arc(28 + index * 220, height - 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eee8dc';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillText(item.label, 42 + index * 220, height - 17);
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0));
  const size = jpegSofSize(bytes);
  return { bytes, width: size?.width ?? width, height: size?.height ?? height };
}

function pageExecutive(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('1. Executive decision', 40, y, { size: 16, bold: true, color: INK });
  y += 20;
  pdf.text(`Ourea  |  ${brief.subtitle} proving ground  |  ${brief.city}`, 40, y, {
    size: 10,
    color: MUTED,
    maxWidth: 515,
  });
  y += 16;
  pdf.text('Why this proving ground', 40, y, { size: 9, bold: true, color: GOLD });
  y += 12;
  y += pdf.text(brief.contextWhy, 40, y, { size: 10, color: INK, maxWidth: 515 });
  y += 8;
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Setting', dx: 8, width: 120 },
    { label: 'Configured value', dx: 140, width: 360 },
  ]);
  (brief.context ?? []).forEach((row, index) => {
    const height = Math.max(22, pdf.measure(row.value, { size: 9, maxWidth: 360 }) + 8);
    y = continuePage(pdf, brief, y, height);
    tableBand(pdf, 40, y, 515, height, index % 2 === 1);
    pdf.text(row.label, 48, y + 6, { size: 9, bold: true, color: GOLD, maxWidth: 120 });
    pdf.text(row.value, 180, y + 6, { size: 9, color: INK, maxWidth: 360 });
    y += height;
  });
  y += 12;
  y = continuePage(pdf, brief, y, 36);
  pdf.text('Decision requested', 40, y, { size: 9, bold: true, color: GOLD });
  y += 12;
  y += pdf.text(brief.decisionRequested, 40, y, { size: 11, color: INK, maxWidth: 515 });
  y += 10;
  y = continuePage(pdf, brief, y, 280);
  pdf.fillRect(40, y, 515, 44, CARD);
  pdf.text('Selected portfolio', 52, y + 8, { size: 9, bold: true, color: GOLD });
  pdf.text(brief.recommendation, 52, y + 22, { size: 11, bold: true, color: INK, maxWidth: 490 });
  y += 56;

  pdf.fillRect(40, y, 250, 110, WHITE);
  pdf.strokeRect(40, y, 250, 110, GOLD, 0.8);
  pdf.text('Immediate decision-preparation scope', 52, y + 8, { size: 9, bold: true, color: GOLD });
  const fieldwork = brief.immediateAsk?.fieldwork?.display
    ?? 'To be procured through a scoped preparation TOR or supplier quotations before fieldwork.';
  const afterSurvey = brief.immediateAsk?.afterSurvey?.display
    ?? 'To be priced after the field survey defines the scope.';
  pdf.text(`Before fieldwork: ${fieldwork}`, 52, y + 24, { size: 9, color: INK, maxWidth: 226 });
  pdf.text(`After survey: ${afterSurvey}`, 52, y + 68, { size: 9, color: INK, maxWidth: 226 });

  const total = brief.costing?.display?.total;
  pdf.fillRect(305, y, 250, 110, DARK);
  pdf.text('Future implementation envelope', 317, y + 8, { size: 9, bold: true, color: GOLD });
  pdf.text(total ? `${formatUsd(total.low)} - ${formatUsd(total.high)}` : 'Not estimable', 317, y + 26, {
    size: 13,
    bold: true,
    color: WHITE,
    maxWidth: 226,
  });
  pdf.text(
    total
      ? `Base ${formatUsd(total.base)}  |  ${brief.confidence}`
      : 'At least one selected intervention has no estimable scenario.',
    317,
    y + 70,
    { size: 9, color: [217, 189, 117], maxWidth: 226 },
  );
  y += 124;

  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Low', dx: 12, width: 150 },
    { label: 'Base', dx: 180, width: 150 },
    { label: 'High', dx: 348, width: 150 },
  ]);
  tableBand(pdf, 40, y, 515, 28, false);
  ['low', 'base', 'high'].forEach((key, index) => {
    pdf.text(total ? formatUsd(total[key]) : '—', 52 + index * 168, y + 8, {
      size: 12,
      bold: true,
      color: INK,
    });
  });
  y += 40;
  pdf.text('Main cost driver', 40, y, { size: 9, bold: true, color: GOLD });
  y += 12;
  y += pdf.text(brief.costing?.costDriver ?? 'Quantity assumptions still bound the envelope.', 40, y, {
    size: 11,
    color: INK,
    maxWidth: 515,
  });
  y += 8;
  y += pdf.text(
    `Funding stage: ${brief.fundingStage}. FX ${brief.costing?.fx?.cop_per_usd ?? '—'} COP/USD on ${brief.costing?.fx?.date ?? brief.costing?.priceDate ?? '—'} ${cite(brief, brief.costing?.fx?.id)}. Amounts in US$. This envelope is pre-feasibility, not a contract.`,
    40,
    y,
    { size: 9, color: MUTED, maxWidth: 515 },
  );
}

function pageWhere(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('2. Where and what', 40, y, { size: 16, bold: true, color: INK });
  y += 20;
  const projectCount = (brief.projects ?? []).length;
  const mapHeight = projectCount > 3 ? 132 : 188;
  const image = brief.siteImage;
  if (image?.bytes) {
    const size = jpegSofSize(image.bytes) ?? { width: image.width, height: image.height };
    const displayWidth = 515;
    const displayHeight = Math.min(mapHeight, displayWidth * (size.height / size.width));
    pdf.addJpeg({
      bytes: image.bytes,
      width: size.width,
      height: size.height,
      x: 40,
      y,
      displayWidth,
      displayHeight,
    });
    y += displayHeight + 8;
  } else {
    drawFallbackMap(pdf, brief, 40, y, 515, Math.min(148, mapHeight));
    y += Math.min(148, mapHeight) + 8;
  }
  y += pdf.text('Each square is an 80 m planning cell. Ourea, Maps and Earth open the same cell.', 40, y, {
    size: 9,
    color: MUTED,
    maxWidth: 515,
  });
  y += 16;
  const cols = [48, 88, 198, 328, 428];
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Cell', dx: 8, width: 36 },
    { label: 'Intervention', dx: 48, width: 100 },
    { label: 'Planning quantity', dx: 158, width: 120 },
    { label: 'Confidence', dx: 288, width: 90 },
    { label: 'Links', dx: 388, width: 110 },
  ]);
  (brief.projects ?? []).forEach((project, index) => {
    const qtyHeight = pdf.measure(project.quantityLabel, { size: 9, maxWidth: 118 });
    const rowH = Math.max(28, qtyHeight + 10);
    y = continuePage(pdf, brief, y, rowH + 4);
    tableBand(pdf, 40, y, 515, rowH, index % 2 === 1);
    pdf.fillRect(40, y, 4, rowH, TYPE_COLORS[project.type] ?? GOLD);
    pdf.text(String(project.cell_id), cols[0], y + 8, { size: 9, bold: true, color: INK });
    pdf.text(project.label, cols[1], y + 8, { size: 9, color: INK, maxWidth: 100 });
    pdf.text(project.quantityLabel, cols[2], y + 6, { size: 9, color: INK, maxWidth: 118 });
    pdf.text(String(project.confidence ?? brief.confidence), cols[3], y + 8, { size: 9, color: MUTED, maxWidth: 92 });
    const link = projectLink(brief, project.cell_id);
    const items = [
      link ? ['Ourea', link] : null,
      project.mapsUrl ? ['Maps', project.mapsUrl] : null,
      project.earthUrl ? ['Earth', project.earthUrl] : null,
    ].filter(Boolean);
    items.forEach((item, linkIndex) => {
      const x = cols[4] + linkIndex * 44;
      pdf.text(item[0], x, y + 8, { size: 9, bold: true, color: GOLD });
      pdf.addLink(x - 2, y + 6, 42, 14, item[1]);
    });
    y += rowH;
  });
}

function pageFinancial(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('3. Financial and implementation case', 40, y, { size: 16, bold: true, color: INK });
  y += 18;
  y += pdf.text(
    'Two amounts. The first is the present decision-preparation ask. The second is capital that is only decided after the gates below.',
    40,
    y,
    { size: 10, color: INK, maxWidth: 515 },
  );
  y += 8;
  pdf.fillRect(40, y, 515, 72, CARD);
  pdf.text('Immediate decision-preparation scope', 52, y + 8, { size: 9, bold: true, color: GOLD });
  pdf.text(`Before fieldwork: ${brief.immediateAsk?.fieldwork?.display ?? 'To be procured through a scoped preparation TOR or supplier quotations before fieldwork.'}`, 52, y + 22, {
    size: 9,
    color: INK,
    maxWidth: 490,
  });
  pdf.text(`After survey: ${brief.immediateAsk?.afterSurvey?.display ?? 'To be priced after the field survey defines the scope.'}`, 52, y + 46, {
    size: 9,
    color: INK,
    maxWidth: 490,
  });
  y += 82;
  const total = brief.costing?.display?.total;
  pdf.fillRect(40, y, 515, 52, DARK);
  pdf.text('Future implementation envelope', 52, y + 8, { size: 9, bold: true, color: GOLD });
  pdf.text(total ? `${formatUsd(total.low)} / ${formatUsd(total.base)} / ${formatUsd(total.high)}` : 'Not estimable', 52, y + 24, {
    size: 12,
    bold: true,
    color: WHITE,
  });
  y += 64;
  pdf.text('Prefeasibility matrix  |  deterministic gates, not an AI score', 40, y, { size: 11, bold: true, color: INK });
  y += 14;
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Dimension', dx: 8, width: 86 },
    { label: 'Status', dx: 96, width: 96 },
    { label: 'Evidence', dx: 200, width: 150 },
    { label: 'Next gate', dx: 360, width: 145 },
  ]);
  (brief.feasibility ?? []).forEach((row, index) => {
    const ev = pdf.measure(row.evidence, { size: 9, maxWidth: 150 });
    const nx = pdf.measure(row.nextGate, { size: 9, maxWidth: 145 });
    const rowH = Math.max(22, ev, nx) + 6;
    y = continuePage(pdf, brief, y, rowH);
    tableBand(pdf, 40, y, 515, rowH, index % 2 === 1);
    pdf.text(row.dimension, 48, y + 5, { size: 9, bold: true, color: INK, maxWidth: 86 });
    pdf.text(row.status, 136, y + 5, { size: 9, color: INK, maxWidth: 96 });
    pdf.text(row.evidence, 240, y + 5, { size: 9, color: INK, maxWidth: 150 });
    pdf.text(row.nextGate, 400, y + 5, { size: 9, color: INK, maxWidth: 145 });
    y += rowH;
  });
  y += 10;
  pdf.text('What must be true for this project to advance', 40, y, { size: 10, bold: true, color: GOLD });
  y += 14;
  (brief.mustBeTrue ?? []).forEach((item) => {
    y += pdf.text(`- ${item}`, 40, y, { size: 9, color: INK, maxWidth: 515 });
    y += 2;
  });
  y += 6;
  pdf.text('Risk register', 40, y, { size: 10, bold: true, color: GOLD });
  y += 10;
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Risk', dx: 8, width: 90 },
    { label: 'Status', dx: 100, width: 90 },
    { label: 'Owner', dx: 200, width: 110 },
    { label: 'Next', dx: 320, width: 180 },
  ]);
  (brief.risks ?? []).forEach((item, index) => {
    const rowH = Math.max(22, pdf.measure(item.next, { size: 9, maxWidth: 180 }) + 8);
    y = continuePage(pdf, brief, y, rowH);
    tableBand(pdf, 40, y, 515, rowH, index % 2 === 1);
    pdf.text(item.risk, 48, y + 5, { size: 9, bold: true, color: INK, maxWidth: 90 });
    pdf.text(item.status, 140, y + 5, { size: 9, color: INK, maxWidth: 90 });
    pdf.text(item.owner, 240, y + 5, { size: 9, color: INK, maxWidth: 110 });
    pdf.text(item.next, 360, y + 5, { size: 9, color: INK, maxWidth: 180 });
    y += rowH;
  });
}

function pageBuildUp(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('4. Cost build-up and sensitivity', 40, y, { size: 16, bold: true, color: INK });
  y += 16;
  pdf.text('Each figure is a formula. Drainage is a ROM package, not a transferable USD/m rate.', 40, y, {
    size: 10,
    color: MUTED,
    maxWidth: 515,
  });
  y += 14;
  const display = brief.costing?.display;
  const amountRows = [
    ...(brief.costing?.lines ?? []).map((line) => [
      `${line.label} ${citesFor(brief, line.sourceIds)}`.trim(),
      line.display,
      false,
    ]),
    ['Construction subtotal', display?.construction, false],
    display?.equipment && (display.equipment.base || display.equipment.high)
      ? ['Known equipment', display.equipment, false]
      : null,
    ['Future implementation envelope', display?.total, true],
  ].filter(Boolean);
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Item', dx: 8, width: 180 },
    { label: 'Low', dx: 200, width: 100 },
    { label: 'Base', dx: 310, width: 100 },
    { label: 'High', dx: 420, width: 90 },
  ]);
  amountRows.forEach(([label, value, emphasize], index) => {
    y = continuePage(pdf, brief, y, 22);
    tableBand(pdf, 40, y, 515, 22, index % 2 === 1);
    pdf.text(label, 48, y + 5, { size: 9, bold: emphasize, color: INK, maxWidth: 180 });
    usdTriple(value).forEach((amount, col) => {
      pdf.text(amount, 240 + col * 110, y + 5, { size: 9, bold: emphasize, color: INK });
    });
    y += 22;
  });
  y += 8;
  (brief.costing?.lines ?? []).forEach((line) => {
    const meta = `Quantity ${line.quantityLabel}. Confidence ${line.confidence ?? line.evidenceTier}. Price date ${line.priceDate ?? brief.costing?.priceDate ?? '—'}.`;
    const included = line.includes?.length ? line.includes.join('; ') : '—';
    const excluded = line.excludes?.length ? line.excludes.join('; ') : '—';
    const noteH = Math.max(
      pdf.measure(line.formula, { size: 9, maxWidth: 490 }),
      pdf.measure(meta, { size: 9, maxWidth: 490 }),
    );
    const splitH = Math.max(
      14,
      pdf.measure(included, { size: 9, maxWidth: 238 }),
      pdf.measure(excluded, { size: 9, maxWidth: 238 }),
    );
    const warning = line.type === 'drainage' && brief.drainageConsolidationWarning
      ? pdf.measure(brief.drainageConsolidationWarning, { size: 9, maxWidth: 490 }) + 6
      : 0;
    const block = 16 + noteH + 16 + splitH + 10 + warning;
    y = continuePage(pdf, brief, y, Math.min(block, 90));
    pdf.text(line.label, 40, y, { size: 10, bold: true, color: INK, maxWidth: 515 });
    y += 12;
    y += pdf.text(line.formula, 40, y, { size: 9, color: INK, maxWidth: 515 });
    y += 2;
    y += pdf.text(meta, 40, y, { size: 9, color: MUTED, maxWidth: 515 });
    y += 4;
    if (warning) {
      y += pdf.text(brief.drainageConsolidationWarning, 40, y, { size: 9, color: INK, maxWidth: 515 });
      y += 4;
    }
    tableBand(pdf, 40, y, 515, splitH + 16, false);
    pdf.text('Includes', 48, y + 4, { size: 9, bold: true, color: GOLD });
    pdf.text('Excludes', 308, y + 4, { size: 9, bold: true, color: GOLD });
    pdf.text(included, 48, y + 14, { size: 9, color: INK, maxWidth: 238 });
    pdf.text(excluded, 308, y + 14, { size: 9, color: INK, maxWidth: 238 });
    y += splitH + 22;
  });
  y += 4;
  pdf.text('Immediate preparation items', 40, y, { size: 11, bold: true, color: INK });
  y += 12;
  y = tableHeader(pdf, 40, y, 515, [
    { label: 'Item', dx: 8, width: 140 },
    { label: 'When', dx: 160, width: 90 },
    { label: 'Status', dx: 260, width: 240 },
  ]);
  (brief.immediateAsk?.rows ?? []).forEach((row, index) => {
    const when = row.stage === 'before_fieldwork' ? 'Before fieldwork' : 'After survey';
    const height = Math.max(24, pdf.measure(row.display, { size: 9, maxWidth: 240 }) + 8);
    y = continuePage(pdf, brief, y, height);
    tableBand(pdf, 40, y, 515, height, index % 2 === 1);
    pdf.text(row.label, 48, y + 5, { size: 9, bold: true, color: INK, maxWidth: 140 });
    pdf.text(when, 200, y + 5, { size: 9, color: INK, maxWidth: 90 });
    pdf.text(row.display, 300, y + 5, { size: 9, color: MUTED, maxWidth: 240 });
    y += height;
  });
  y += 6;
  y += pdf.text(`Excluded from the envelope: ${(brief.costing?.excluded ?? []).join('; ')}.`, 40, y, {
    size: 9,
    color: MUTED,
    maxWidth: 515,
  });
  y += 8;
  y = continuePage(pdf, brief, y, 40);
  pdf.text('Sensitivity (model-derived, not a benefit or ROI claim)', 40, y, { size: 11, bold: true, color: INK });
  y += 16;
  if (brief.costing?.sensitivity?.length) {
    y = continuePage(pdf, brief, y, Math.min(5, brief.costing.sensitivity.length) * 28);
    drawTornado(pdf, 40, y, 515, brief.costing.sensitivity);
  }
}

function pageEarlyAction(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('5. Why early action matters', 40, y, { size: 16, bold: true, color: INK });
  y += 18;
  drawMechanism(pdf, 40, y, 515, 128);
  y += 138;
  y += pdf.text(brief.mechanismCaption ?? MECHANISM_COPY.caption, 40, y, { size: 9, color: MUTED, maxWidth: 515 });
  y += 6;
  pdf.text('Open the live animation in the Ourea demo', 40, y, { size: 10, bold: true, color: GOLD });
  pdf.addLink(40, y, 280, 14, brief.animationUrl ?? DEMO);
  y += 18;
  pdf.text(communityStatusLabel(brief.communityStatus), 40, y, { size: 12, bold: true, color: INK });
  y += 16;
  y += pdf.text(brief.community, 40, y, { size: 10, color: INK, maxWidth: 515 });
  y += 8;
  const chips = [
    ['Cells', String(brief.footprint.cells)],
    ['Buildings', String(brief.footprint.buildings)],
    ['High hazard', String(brief.footprint.highHazard)],
    ['People (proxy)', brief.footprint.people.toLocaleString('en-US')],
  ];
  chips.forEach((chip, index) => {
    const x = 40 + index * 129;
    pdf.fillRect(x, y, 121, 44, CARD);
    pdf.text(chip[0], x + 8, y + 8, { size: 9, bold: true, color: GOLD });
    pdf.text(chip[1], x + 8, y + 22, { size: 12, bold: true, color: INK, maxWidth: 105 });
  });
  y += 52;
  pdf.text('These are planning counts, not people protected.', 40, y, { size: 9, color: MUTED });
  y += 16;
  pdf.text('What would change the recommendation', 40, y, { size: 11, bold: true, color: GOLD });
  y += 14;
  (brief.changeTriggers ?? []).forEach((item) => {
    y += pdf.text(`- ${item}`, 40, y, { size: 10, color: INK, maxWidth: 515 });
    y += 4;
  });
}

function pageRobustness(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('6. Robustness and AI-assisted decision review', 40, y, { size: 16, bold: true, color: INK });
  y += 18;
  y += pdf.text(brief.robustness, 40, y, { size: 11, color: INK, maxWidth: 515 });
  y += 10;
  (brief.caveats ?? []).forEach((item) => {
    y += pdf.text(`- ${item}`, 40, y, { size: 9, color: MUTED, maxWidth: 515 });
    y += 2;
  });
  y += 10;
  if (brief.aiReview?.synthesis) {
    const badge = READINESS_LABELS[brief.aiReview.readiness?.status] ?? '';
    pdf.fillRect(40, y, 515, 8 + pdf.measure(`${badge}. ${brief.aiReview.synthesis.headline}`, { size: 11, maxWidth: 490 }), CARD);
    pdf.text(AI_REVIEW_COPY.pdfSection, 52, y + 6, { size: 9, bold: true, color: GOLD });
    y += 20;
    pdf.text(`${badge}. ${brief.aiReview.synthesis.headline}`, 52, y, { size: 11, bold: true, color: INK, maxWidth: 490 });
    y += pdf.measure(`${badge}. ${brief.aiReview.synthesis.headline}`, { size: 11, maxWidth: 490 }) + 6;
    (brief.aiReview.synthesis.portfolio_rationale ?? []).slice(0, 2).forEach((item) => {
      y += pdf.text(`- ${item}`, 52, y, { size: 10, color: INK, maxWidth: 490 });
      y += 2;
    });
    (brief.aiReview.synthesis.gate_explanations ?? []).slice(0, 3).forEach((item) => {
      y += pdf.text(`Gate: ${item.explanation}`, 52, y, { size: 9, color: MUTED, maxWidth: 490 });
      y += 2;
    });
    (brief.aiReview.synthesis.next_actions ?? []).slice(0, 3).forEach((item) => {
      y += pdf.text(`${item.order}. ${item.action}`, 52, y, { size: 9, color: INK, maxWidth: 490 });
      y += 2;
    });
    const cost = brief.aiReview.synthesis.cost_interpretation;
    const robust = brief.aiReview.synthesis.robustness_interpretation;
    if (cost || robust) {
      y += 6;
      pdf.text('Cost and robustness interpretation', 52, y, { size: 10, bold: true, color: GOLD });
      y += 12;
      const rows = [
        cost?.main_driver && ['Main cost driver', cost.main_driver],
        cost?.uncertainty && ['Cost uncertainty', cost.uncertainty],
        cost?.survey_requirement && ['Survey requirement', cost.survey_requirement],
        robust?.strength && ['Robustness strength', robust.strength],
        robust?.caveat && ['Robustness caveat', robust.caveat],
      ].filter(Boolean);
      y = tableHeader(pdf, 52, y, 490, [
        { label: 'Topic', dx: 8, width: 120 },
        { label: 'Interpretation', dx: 140, width: 330 },
      ]);
      rows.forEach((item, index) => {
        const height = Math.max(22, pdf.measure(item[1], { size: 9, maxWidth: 330 }) + 8);
        y = continuePage(pdf, brief, y, height);
        tableBand(pdf, 52, y, 490, height, index % 2 === 1);
        pdf.text(item[0], 60, y + 5, { size: 9, bold: true, color: GOLD, maxWidth: 120 });
        pdf.text(item[1], 192, y + 5, { size: 9, color: INK, maxWidth: 330 });
        y += height;
      });
    }
    const cannot = (brief.aiReview.synthesis.cannot_conclude ?? []).slice(0, 3);
    if (cannot.length) {
      y = continuePage(pdf, brief, y, 18 + cannot.length * 16);
      y += 6;
      pdf.text(AI_REVIEW_COPY.cannot, 52, y, { size: 10, bold: true, color: GOLD });
      y += 14;
      cannot.forEach((item) => {
        y += pdf.text(`- ${item}`, 52, y, { size: 9, color: INK, maxWidth: 490 });
        y += 2;
      });
    }
    y = continuePage(pdf, brief, y, 16);
    pdf.text(
      `${AI_REVIEW_COPY.assisted}  |  ${brief.aiReview.generatedAt ?? ''}`,
      52,
      y,
      { size: 9, color: MUTED, maxWidth: 490 },
    );
  }
}

function pagePathway(pdf, brief) {
  startPage(pdf, brief);
  let y = 76;
  pdf.text('7. Implementation pathway', 40, y, { size: 16, bold: true, color: INK });
  y += 16;
  y += pdf.text('This is decision preparation, not a promise that a hydraulic corridor is built in six months.', 40, y, {
    size: 9,
    color: MUTED,
    maxWidth: 515,
  });
  y += 10;
  const steps = (brief.pathway ?? []).slice(0, 6);
  const lineX = 52;
  steps.forEach((step, index) => {
    const bodyHeight = pdf.measure(step.body, { size: 9, maxWidth: 455 });
    const block = 30 + bodyHeight;
    y = continuePage(pdf, brief, y, block);
    if (index < steps.length - 1) {
      pdf.strokePath([[lineX, y + 16], [lineX, y + block - 4]], { color: GOLD, lineWidth: 1.4 });
    }
    pdf.fillRect(lineX - 8, y, 16, 16, GOLD);
    pdf.text(String(index + 1), lineX - 3, y + 3, { size: 9, bold: true, color: DARK });
    const when = step.when ? `${step.when}  ·  ` : '';
    pdf.text(`${when}${step.title}`, 72, y + 2, { size: 10, bold: true, color: INK, maxWidth: 455 });
    y += 16;
    y += pdf.text(step.body, 72, y, { size: 9, color: INK, maxWidth: 455 });
    y += 10;
  });
  y = continuePage(pdf, brief, y, 48);
  pdf.text('Sources', 40, y, { size: 12, bold: true, color: INK });
  y += 14;
  (brief.citations ?? []).forEach((source) => {
    const date = source.date ? String(source.date) : 'date not stated';
    const accessed = source.accessed ? `accessed ${source.accessed}` : '';
    const line = `[${source.n}] ${source.label}. ${source.title}. ${date}. ${source.type}. ${accessed}`.replace(/\s+/g, ' ').trim();
    const height = pdf.measure(line, { size: 9, maxWidth: 515 });
    y = continuePage(pdf, brief, y, height + 8);
    pdf.text(line, 40, y, { size: 9, color: INK, maxWidth: 515 });
    if (source.url) pdf.addLink(40, y, Math.min(515, 420), Math.min(height, 36), source.url);
    y += height + 4;
  });
  y += 6;
  if (brief.technicalNote) {
    y = continuePage(pdf, brief, y, 28);
    y += pdf.text(brief.technicalNote, 40, y, { size: 9, color: MUTED, maxWidth: 515 });
    y += 4;
  }
  y = continuePage(pdf, brief, y, 36);
  pdf.text(
    'Ourea is decision intelligence for adaptation portfolios under uncertainty. It does not predict landslides, structural failure, people saved or losses avoided.',
    40,
    y,
    { size: 9, color: MUTED, maxWidth: 515 },
  );
}

export function buildDecisionBriefPdf(brief) {
  const pdf = createPdf({
    info: {
      title: `Ourea decision brief - ${brief.subtitle}`,
      author: 'Ourea',
      subject: `Pre-feasibility adaptation decision brief for ${brief.subtitle}`,
      keywords: ['Ourea', 'Innovate4Cities', 'Llanaditas', 'Medellin', 'adaptation', 'decision brief'],
      creationDate: brief.generatedAt,
      lang: 'en-US',
    },
  });
  pageExecutive(pdf, brief);
  pdf.addPage();
  pageWhere(pdf, brief);
  pdf.addPage();
  pageFinancial(pdf, brief);
  pdf.addPage();
  pageBuildUp(pdf, brief);
  pdf.addPage();
  pageEarlyAction(pdf, brief);
  pdf.addPage();
  pageRobustness(pdf, brief);
  pdf.addPage();
  pagePathway(pdf, brief);
  stampPages(pdf, brief);
  return pdf.toBlob();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

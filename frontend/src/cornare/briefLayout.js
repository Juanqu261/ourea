import { createPdf, widthOf } from '../domain/pdfDocument.js';

export const THEME = Object.freeze({
  paper: [247, 246, 242],
  card: [255, 255, 255],
  ink: [24, 32, 36],
  muted: [85, 99, 106],
  bronze: [110, 82, 36],
  gold: [200, 167, 94],
  goldDeep: [168, 132, 62],
  nature: [62, 101, 84],
  natureWash: [226, 236, 228],
  water: [61, 110, 130],
  waterWash: [226, 236, 242],
  rust: [140, 72, 64],
  rustWash: [244, 230, 226],
  hero: [24, 32, 36],
  heroText: [247, 246, 242],
  heroMuted: [196, 188, 174],
  border: [214, 210, 202],
  wash: [236, 233, 224],
  selected: [243, 236, 216],
  track: [226, 223, 216],
  guarne: [138, 126, 78],
  marinilla: [70, 110, 86],
  rionegro: [128, 78, 86],
});

export const BRIEF_MARGIN = 40;
export const BRIEF_BOTTOM = 796;

export const BRIEF_INFO = Object.freeze({
  title: 'Ourea — Robust Territorial Climate Adaptation Decision Brief',
  author: 'Ourea',
  subject: 'Soporte de decisión para adaptación climática territorial',
  lang: 'es-CO',
  keywords: 'Ourea, CORNARE, adaptación, Rionegro, Guarne, Marinilla',
});

export function openBrief() {
  const pdf = createPdf({ info: BRIEF_INFO });
  const paint = () => pdf.fillRect(0, 0, pdf.width, pdf.height, THEME.paper);
  paint();
  return {
    pdf,
    margin: BRIEF_MARGIN,
    bottom: BRIEF_BOTTOM,
    contentWidth: pdf.width - BRIEF_MARGIN * 2,
    newPage() {
      pdf.addPage();
      paint();
    },
    guard(y, label) {
      if (y > BRIEF_BOTTOM) throw new Error(`Brief overflow at ${label}: ${Math.round(y)}`);
    },
    finish() {
      pdf.stamp((page, total) => {
        const y = pdf.height - 22;
        pdf.text('OUREA · Rionegro · Guarne · Marinilla', BRIEF_MARGIN, y, {
          size: 8.5,
          color: THEME.muted,
          lineHeight: 11,
        });
        pdf.text(`${page} / ${total}`, pdf.width - BRIEF_MARGIN, y, {
          size: 8.5,
          color: THEME.muted,
          align: 'right',
          lineHeight: 11,
        });
      });
      return pdf;
    },
  };
}

export function sectionTitle(pdf, value, x, y, width) {
  const height = pdf.text(value, x, y, {
    size: 22,
    bold: true,
    color: THEME.ink,
    maxWidth: width,
    lineHeight: 28,
  });
  pdf.fillRect(x, y + height + 2, 36, 2.5, THEME.gold);
  return y + height + 14;
}

export function kicker(pdf, value, x, y) {
  return y + pdf.text(value, x, y, {
    size: 8.5,
    bold: true,
    color: THEME.bronze,
    lineHeight: 11,
  });
}

export function card(pdf, x, y, w, h, { fill = THEME.card, accent = null, accentWidth = 3 } = {}) {
  pdf.fillRect(x, y, w, h, fill);
  pdf.strokeRect(x, y, w, h, THEME.border, 0.8);
  if (accent) pdf.fillRect(x, y, accentWidth, h, accent);
}

export function badge(pdf, x, y, label, fill, color, size = 8.5) {
  const w = widthOf(label, size, true) + 10;
  const h = size + 5;
  pdf.fillRect(x, y, w, h, fill);
  pdf.text(label, x + 5, y + 1.6, { size, bold: true, color, lineHeight: size + 2 });
  return w;
}

export function progressBar(pdf, x, y, w, h, fraction, color = THEME.goldDeep) {
  const used = Math.max(0, Math.min(1, fraction));
  pdf.fillRect(x, y, w, h, THEME.track);
  if (used > 0) pdf.fillRect(x, y, Math.max(used * w, h / 2), h, color);
}

export function divider(pdf, x, y, w) {
  pdf.fillRect(x, y, w, 0.8, THEME.border);
}

export function iconCircle(pdf, cx, cy, label, { fill = THEME.hero, color = THEME.gold, radius = 9 } = {}) {
  pdf.fillCircle(cx, cy, radius, fill);
  pdf.text(String(label), cx, cy - radius * 0.42, {
    size: radius * 0.95,
    bold: true,
    color,
    align: 'center',
    lineHeight: radius,
  });
}

export function drawMark(pdf, kind, cx, cy) {
  pdf.fillCircle(cx, cy, 11, THEME.hero);
  if (kind === 'target') {
    pdf.strokeCircle(cx, cy, 5.5, { color: THEME.gold, lineWidth: 1.2 });
    pdf.fillCircle(cx, cy, 1.6, THEME.gold);
    return;
  }
  if (kind === 'layers') {
    [-4, 0, 4].forEach((offset) => {
      pdf.strokePath([[cx - 5.5, cy + offset], [cx + 5.5, cy + offset]], { color: THEME.gold, lineWidth: 1.3 });
    });
    return;
  }
  pdf.strokeCommands([
    ['M', cx, cy - 6],
    ['L', cx + 5.2, cy - 3],
    ['L', cx + 4.2, cy + 2],
    ['L', cx, cy + 6.2],
    ['L', cx - 4.2, cy + 2],
    ['L', cx - 5.2, cy - 3],
    ['L', cx, cy - 6],
  ], { color: THEME.gold, lineWidth: 1.2 });
}

export { widthOf };

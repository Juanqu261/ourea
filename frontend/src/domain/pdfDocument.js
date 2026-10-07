const PAGE = Object.freeze({ width: 595.28, height: 841.89 });

const WINANSI_EXTRA = Object.freeze({
  '\u20ac': 0x80, '\u2026': 0x85, '\u2018': 0x91, '\u2019': 0x92,
  '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96,
  '\u2014': 0x97,
});

function normalizePdfText(value) {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/Â·/g, '·')
    .replace(/Â°/g, '°')
    .replace(/â€¢/g, '•')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€\u009d/g, '”')
    .replace(/â†’/g, '->')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[\u2013\u2014\u2212]/g, '-');
}

function pdfString(value) {
  let out = '(';
  for (const char of normalizePdfText(value)) {
    if (char === '\\' || char === '(' || char === ')') {
      out += `\\${char}`;
      continue;
    }
    const code = char.codePointAt(0);
    if (code < 128) {
      out += char;
      continue;
    }
    if (code >= 0xa0 && code <= 0xff) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
      continue;
    }
    const mapped = WINANSI_EXTRA[char];
    out += mapped != null ? `\\${mapped.toString(8).padStart(3, '0')}` : '-';
  }
  return `${out})`;
}

function rgb(color) {
  const [r, g, b] = color;
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

const HELVETICA = Object.freeze({
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
  á: 556, é: 556, í: 222, ó: 556, ú: 556, ñ: 556, ü: 556,
  Á: 667, É: 667, Í: 278, Ó: 778, Ú: 722, Ñ: 722, '°': 400, '·': 278,
  '–': 556, '—': 1000, '’': 191, '‘': 191, '“': 333, '”': 333, '•': 350, '×': 584,
});

const HELVETICA_BOLD = Object.freeze({
  ...HELVETICA,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 778, I: 278, J: 556,
  K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278,
  k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333,
  u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
});

function glyphWidth(char, bold) {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  return table[char] ?? 600;
}

function widthOf(text, size, bold = false) {
  let width = 0;
  for (const char of String(text ?? '')) width += (glyphWidth(char, bold) * size) / 1000;
  return width;
}

export function wrapLine(text, maxWidth, size, bold = false) {
  const tokens = [];
  for (const token of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const pieces = token.split(/(?<=[/_\-?&=])/);
    let chunk = '';
    for (const piece of pieces) {
      const next = chunk + piece;
      if (chunk && widthOf(next, size, bold) > maxWidth) {
        tokens.push(chunk);
        chunk = piece;
      } else chunk = next;
    }
    if (chunk) tokens.push(chunk);
  }
  const lines = [];
  let current = '';
  for (const word of tokens) {
    if (widthOf(word, size, bold) > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let rest = word;
      while (widthOf(rest, size, bold) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && widthOf(rest.slice(0, cut), size, bold) > maxWidth) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
      continue;
    }
    const glued = !current
      ? word
      : (/[/_\-?&=]$/.test(current) || /^[/_\-?&=]/.test(word) ? current + word : `${current} ${word}`);
    if (current && widthOf(glued, size, bold) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = glued;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function pdfDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function ascii(value) {
  return new TextEncoder().encode(value);
}

export function createPdf(options = {}) {
  const pageSize = options.pageSize ?? PAGE;
  const info = options.info ?? {};
  const pages = [];
  const images = [];
  let ops = [];
  let annots = [];

  function yFromTop(y) {
    return pageSize.height - y;
  }

  function addPage() {
    if (ops.length || annots.length) pages.push({ ops, annots });
    ops = [];
    annots = [];
  }

  addPage();

  function fillRect(x, y, width, height, color) {
    ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${yFromTop(y + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  function strokeRect(x, y, width, height, color, lineWidth = 0.8) {
    ops.push(`${lineWidth.toFixed(2)} w ${rgb(color)} RG ${x.toFixed(2)} ${yFromTop(y + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }

  function measure(value, { size = 11, maxWidth = null, lineHeight = null, bold = false } = {}) {
    const leading = lineHeight ?? size * 1.35;
    const lines = maxWidth ? wrapLine(value, maxWidth, size, bold) : [String(value ?? '')];
    return lines.length * leading;
  }

  function text(value, x, y, {
    size = 11,
    bold = false,
    color = [28, 36, 40],
    maxWidth = null,
    lineHeight = null,
    align = 'left',
    width = null,
  } = {}) {
    const font = bold ? 'F2' : 'F1';
    const leading = lineHeight ?? size * 1.35;
    const wrapWidth = maxWidth ?? width;
    const lines = wrapWidth ? wrapLine(value, wrapWidth, size, bold) : [String(value ?? '')];
    lines.forEach((line, index) => {
      const lineWidth = widthOf(line, size, bold);
      let drawX = x;
      if (align === 'right') drawX = x - lineWidth;
      if (align === 'right' && width != null) drawX = x + width - lineWidth;
      const baseline = yFromTop(y + size * 0.8 + index * leading);
      ops.push('BT');
      ops.push(`/${font} ${size} Tf`);
      ops.push(`${rgb(color)} rg`);
      ops.push(`${drawX.toFixed(2)} ${baseline.toFixed(2)} Td`);
      ops.push(`${pdfString(line)} Tj`);
      ops.push('ET');
    });
    return lines.length * leading;
  }

  function addLink(x, y, width, height, dest) {
    const boxed = {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width,
      height,
    };
    boxed.width = Math.min(boxed.width, pageSize.width - boxed.x);
    boxed.height = Math.min(boxed.height, pageSize.height - boxed.y);
    if (boxed.width <= 0.5 || boxed.height <= 0.5) return;
    if (typeof dest === 'string' && dest.length) {
      annots.push({ ...boxed, uri: dest });
      return;
    }
    const page = Number(dest);
    if (!Number.isFinite(page) || page < 1) return;
    annots.push({ ...boxed, destPage: page });
  }

  function addJpeg({ bytes, width, height, x, y, displayWidth, displayHeight }) {
    const id = images.length + 1;
    images.push({ id, bytes, width, height });
    const w = displayWidth ?? width;
    const h = displayHeight ?? height;
    const pdfY = yFromTop(y + h);
    ops.push('q');
    ops.push(`${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${pdfY.toFixed(2)} cm`);
    ops.push(`/Im${id} Do`);
    ops.push('Q');
  }

  function strokePath(points, { color = [238, 232, 220], lineWidth = 1.2 } = {}) {
    if (!points.length) return;
    const parts = points.map((point, index) => {
      const x = Number(point[0]);
      const y = yFromTop(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return `${x.toFixed(2)} ${y.toFixed(2)} ${index === 0 ? 'm' : 'l'}`;
    }).filter(Boolean);
    if (!parts.length) return;
    ops.push(`${lineWidth.toFixed(2)} w 1 J 1 j ${rgb(color)} RG ${parts.join(' ')} S`);
  }

  function strokeCommands(commands, { color = [238, 232, 220], lineWidth = 1.2 } = {}) {
    if (!commands.length) return;
    const parts = commands.map((command) => {
      const [op, ...nums] = command;
      const converted = [];
      for (let i = 0; i < nums.length; i += 2) {
        converted.push(nums[i].toFixed(2), yFromTop(nums[i + 1]).toFixed(2));
      }
      const pdfOp = op === 'M' ? 'm' : op === 'L' ? 'l' : op === 'C' ? 'c' : op;
      return `${converted.join(' ')} ${pdfOp}`;
    });
    ops.push(`${lineWidth.toFixed(2)} w 1 J 1 j ${rgb(color)} RG ${parts.join(' ')} S`);
  }

  function strokeCircle(cx, cy, radius, { color = [200, 167, 94], lineWidth = 1.1 } = {}) {
    const y = yFromTop(cy);
    const k = 0.552284749831 * radius;
    ops.push(
      `${lineWidth.toFixed(2)} w ${rgb(color)} RG `
      + `${(cx + radius).toFixed(2)} ${y.toFixed(2)} m `
      + `${(cx + radius).toFixed(2)} ${(y + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(y + radius).toFixed(2)} ${cx.toFixed(2)} ${(y + radius).toFixed(2)} c `
      + `${(cx - k).toFixed(2)} ${(y + radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(y + k).toFixed(2)} ${(cx - radius).toFixed(2)} ${y.toFixed(2)} c `
      + `${(cx - radius).toFixed(2)} ${(y - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(y - radius).toFixed(2)} ${cx.toFixed(2)} ${(y - radius).toFixed(2)} c `
      + `${(cx + k).toFixed(2)} ${(y - radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(y - k).toFixed(2)} ${(cx + radius).toFixed(2)} ${y.toFixed(2)} c S`,
    );
  }

  function fillCircle(cx, cy, radius, color) {
    const y = yFromTop(cy);
    const k = 0.552284749831 * radius;
    ops.push(
      `${rgb(color)} rg `
      + `${(cx + radius).toFixed(2)} ${y.toFixed(2)} m `
      + `${(cx + radius).toFixed(2)} ${(y + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(y + radius).toFixed(2)} ${cx.toFixed(2)} ${(y + radius).toFixed(2)} c `
      + `${(cx - k).toFixed(2)} ${(y + radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(y + k).toFixed(2)} ${(cx - radius).toFixed(2)} ${y.toFixed(2)} c `
      + `${(cx - radius).toFixed(2)} ${(y - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(y - radius).toFixed(2)} ${cx.toFixed(2)} ${(y - radius).toFixed(2)} c `
      + `${(cx + k).toFixed(2)} ${(y - radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(y - k).toFixed(2)} ${(cx + radius).toFixed(2)} ${y.toFixed(2)} c f`,
    );
  }

  return {
    width: pageSize.width,
    height: pageSize.height,
    addPage: () => addPage(),
    fillRect,
    strokeRect,
    strokePath,
    strokeCommands,
    strokeCircle,
    fillCircle,
    measure,
    text,
    addLink,
    addJpeg,
    pageCount() {
      return pages.length + (ops.length || annots.length ? 1 : 0);
    },
    stamp(fn) {
      if (ops.length || annots.length) pages.push({ ops, annots });
      ops = [];
      annots = [];
      const total = pages.length;
      pages.forEach((page, index) => {
        ops = page.ops;
        annots = page.annots;
        fn(index + 1, total);
        page.ops = ops;
        page.annots = annots;
      });
      ops = [];
      annots = [];
    },
    toBlob() {
      const pageRecords = (ops.length || annots.length)
        ? [...pages, { ops, annots }]
        : pages;
      return assemblePdf(pageSize, pageRecords, images, info);
    },
  };
}

function assemblePdf(pageSize, pageRecords, images, info = {}) {
  const parts = [ascii('%PDF-1.4\n')];
  const offsets = [0];

  function pushObject(chunks) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    for (const chunk of chunks) parts.push(typeof chunk === 'string' ? ascii(chunk) : chunk);
  }

  const objectBodies = [];
  function queue(chunks) {
    objectBodies.push(chunks);
    return objectBodies.length;
  }

  const fontRegular = queue(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n']);
  const fontBold = queue(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n']);

  const imageObjectIds = images.map((image) => queue([
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
    image.bytes,
    '\nendstream\nendobj\n',
  ]));

  const contentIds = pageRecords.map((page) => {
    const stream = `${(page.ops ?? page).join('\n')}\n`;
    const bytes = ascii(stream);
    return queue([
      `<< /Length ${bytes.length} >>\nstream\n`,
      bytes,
      '\nendstream\nendobj\n',
    ]);
  });

  const annotIds = pageRecords.map((page) => (page.annots ?? []).map((annot) => {
    const llx = annot.x;
    const ury = pageSize.height - annot.y;
    const urx = annot.x + annot.width;
    const lly = pageSize.height - (annot.y + annot.height);
    const rect = `/Rect [${llx.toFixed(2)} ${lly.toFixed(2)} ${urx.toFixed(2)} ${ury.toFixed(2)}] /Border [0 0 0] /C [0.784 0.655 0.369]`;
    if (annot.uri) {
      return queue([
        `<< /Type /Annot /Subtype /Link ${rect} /A << /S /URI /URI ${pdfString(annot.uri)} >> >>\nendobj\n`,
      ]);
    }
    const dest = Math.max(1, Number(annot.destPage) || 1);
    return queue([
      `<< /Type /Annot /Subtype /Link ${rect} /A << /S /GoTo /D [DEST_${dest} /XYZ 0 ${pageSize.height.toFixed(2)} 0] >> >>\nendobj\n`,
    ]);
  }));

  const pageObjectIds = contentIds.map((contentId, index) => {
    const xobjects = imageObjectIds.map((id, imageIndex) => `/Im${imageIndex + 1} ${id} 0 R`).join(' ');
    const annotsRef = annotIds[index].length
      ? ` /Annots [${annotIds[index].map((id) => `${id} 0 R`).join(' ')}]`
      : '';
    return queue([
      `<< /Type /Page /Parent PAGES /MediaBox [0 0 ${pageSize.width.toFixed(2)} ${pageSize.height.toFixed(2)}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${imageObjectIds.length ? ` /XObject << ${xobjects} >>` : ''} >> /Contents ${contentId} 0 R${annotsRef} >>\nendobj\n`,
    ]);
  });

  const pagesId = queue([
    `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>\nendobj\n`,
  ]);
  const created = pdfDate(info.creationDate);
  const infoParts = ['<<'];
  if (info.title) infoParts.push(` /Title ${pdfString(info.title)}`);
  infoParts.push(` /Author ${pdfString(info.author || 'Ourea')}`);
  if (info.subject) infoParts.push(` /Subject ${pdfString(info.subject)}`);
  if (info.keywords) {
    infoParts.push(` /Keywords ${pdfString(Array.isArray(info.keywords) ? info.keywords.join(', ') : info.keywords)}`);
  }
  infoParts.push(' /Creator (Ourea)');
  infoParts.push(' /Producer (Ourea)');
  if (created) infoParts.push(` /CreationDate (${created})`);
  infoParts.push(' >>\nendobj\n');
  const infoId = queue([infoParts.join('')]);
  const lang = info.lang || 'en-US';
  const catalogId = queue([
    `<< /Type /Catalog /Pages ${pagesId} 0 R /Lang ${pdfString(lang)} /ViewerPreferences << /DisplayDocTitle true >> >>\nendobj\n`,
  ]);

  const rewritten = objectBodies.map((chunks) => chunks.map((chunk) => {
    if (typeof chunk !== 'string') return chunk;
    return chunk
      .replaceAll(' /Parent PAGES', ` /Parent ${pagesId} 0 R`)
      .replace(/DEST_(\d+)/g, (_, n) => {
        const id = pageObjectIds[Number(n) - 1] ?? pageObjectIds[0];
        return `${id} 0 R`;
      });
  }));

  // Catalog should be object 1. Emit in queued order is fine as long as references match ids.
  rewritten.forEach((chunks, index) => {
    pushObject([`${index + 1} 0 obj\n`, ...chunks]);
  });

  const xrefStart = parts.reduce((sum, part) => sum + part.length, 0);
  let xref = `xref\n0 ${rewritten.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= rewritten.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  parts.push(ascii(xref));
  parts.push(ascii(`trailer\n<< /Size ${rewritten.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));

  return new Blob([concatBytes(parts)], { type: 'application/pdf' });
}

export function jpegFromDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) return null;
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function jpegSofSize(bytes) {
  if (!bytes || bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    offset += 2 + length;
  }
  return null;
}

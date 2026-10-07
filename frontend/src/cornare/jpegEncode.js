const ZIGZAG = [
  0, 1, 5, 6, 14, 15, 27, 28,
  2, 4, 7, 13, 16, 26, 29, 42,
  3, 8, 12, 17, 25, 30, 41, 43,
  9, 11, 18, 24, 31, 40, 44, 53,
  10, 19, 23, 32, 39, 45, 52, 54,
  20, 22, 33, 38, 46, 51, 55, 60,
  21, 34, 37, 47, 50, 56, 59, 61,
  35, 36, 48, 49, 57, 58, 62, 63,
];

const LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77,
  24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

const CHROMA_Q = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
];

const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHROMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
const AC_LUMA_VALS = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
const AC_CHROMA_VALS = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
  0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];

const COS = Array.from({ length: 8 }, (_, u) => (
  Array.from({ length: 8 }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / 16))
));

function buildCodes(bits, values) {
  const codes = new Map();
  let code = 0;
  let index = 0;
  for (let length = 1; length <= 16; length += 1) {
    for (let count = 0; count < bits[length - 1]; count += 1) {
      codes.set(values[index], { code, length });
      code += 1;
      index += 1;
    }
    code <<= 1;
  }
  return codes;
}

const DC_LUMA = buildCodes(DC_LUMA_BITS, DC_LUMA_VALS);
const DC_CHROMA = buildCodes(DC_CHROMA_BITS, DC_CHROMA_VALS);
const AC_LUMA = buildCodes(AC_LUMA_BITS, AC_LUMA_VALS);
const AC_CHROMA = buildCodes(AC_CHROMA_BITS, AC_CHROMA_VALS);

function scaleQuant(table, quality) {
  const clamped = Math.max(1, Math.min(100, quality));
  const scale = clamped < 50 ? Math.floor(5000 / clamped) : 200 - clamped * 2;
  return table.map((value) => Math.max(1, Math.min(255, Math.floor((value * scale + 50) / 100))));
}

class BitWriter {
  constructor() {
    this.bytes = [];
    this.acc = 0;
    this.bits = 0;
  }

  write(code, length) {
    this.acc = (this.acc << length) | (code & ((1 << length) - 1));
    this.bits += length;
    while (this.bits >= 8) {
      this.bits -= 8;
      const byte = (this.acc >> this.bits) & 255;
      this.bytes.push(byte);
      if (byte === 0xff) this.bytes.push(0);
    }
  }

  finish() {
    if (this.bits > 0) {
      const byte = ((this.acc << (8 - this.bits)) | ((1 << (8 - this.bits)) - 1)) & 255;
      this.bytes.push(byte);
    }
    return new Uint8Array(this.bytes);
  }
}

function category(value) {
  let magnitude = Math.abs(value);
  let bits = 0;
  while (magnitude > 0) {
    magnitude >>= 1;
    bits += 1;
  }
  return bits;
}

function writeCoefficient(writer, value) {
  const bits = category(value);
  if (bits === 0) return 0;
  let extra = value;
  if (extra < 0) extra = (1 << bits) + extra - 1;
  writer.write(extra, bits);
  return bits;
}

function encodeBlock(samples, quant, previous, dcCodes, acCodes, writer) {
  const shifted = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) shifted[i] = samples[i] - 128;
  const freq = new Float64Array(64);
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      let sum = 0;
      const cu = u === 0 ? 0.7071067811865476 : 1;
      const cv = v === 0 ? 0.7071067811865476 : 1;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          sum += shifted[y * 8 + x] * COS[u][x] * COS[v][y];
        }
      }
      freq[v * 8 + u] = 0.25 * cu * cv * sum;
    }
  }
  const zz = new Int16Array(64);
  for (let i = 0; i < 64; i += 1) {
    zz[i] = Math.round(freq[ZIGZAG[i]] / quant[ZIGZAG[i]]);
  }
  const diff = zz[0] - previous;
  const dcBits = category(diff);
  const dc = dcCodes.get(dcBits);
  writer.write(dc.code, dc.length);
  writeCoefficient(writer, diff);
  let run = 0;
  for (let i = 1; i < 64; i += 1) {
    if (zz[i] === 0) {
      run += 1;
      continue;
    }
    while (run > 15) {
      const zrl = acCodes.get(0xf0);
      writer.write(zrl.code, zrl.length);
      run -= 16;
    }
    const acBits = category(zz[i]);
    const symbol = (run << 4) | acBits;
    const ac = acCodes.get(symbol);
    writer.write(ac.code, ac.length);
    writeCoefficient(writer, zz[i]);
    run = 0;
  }
  if (run > 0) {
    const eob = acCodes.get(0x00);
    writer.write(eob.code, eob.length);
  }
  return zz[0];
}

function push16(out, value) {
  out.push((value >> 8) & 255, value & 255);
}

function dht(out, classId, tableId, bits, values) {
  out.push(0xff, 0xc4);
  push16(out, 19 + values.length);
  out.push((classId << 4) | tableId, ...bits, ...values);
}

function dqt(out, id, table) {
  out.push(0xff, 0xdb);
  push16(out, 67);
  out.push(id, ...table);
}

export function encodeJpeg(rgb, width, height, quality = 82) {
  const lumaQ = scaleQuant(LUMA_Q, quality);
  const chromaQ = scaleQuant(CHROMA_Q, quality);
  const blocksX = Math.ceil(width / 8);
  const blocksY = Math.ceil(height / 8);
  const writer = new BitWriter();
  let dcY = 0;
  let dcCb = 0;
  let dcCr = 0;
  const yBlock = new Float64Array(64);
  const cbBlock = new Float64Array(64);
  const crBlock = new Float64Array(64);
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      for (let y = 0; y < 8; y += 1) {
        const py = Math.min(height - 1, by * 8 + y);
        for (let x = 0; x < 8; x += 1) {
          const px = Math.min(width - 1, bx * 8 + x);
          const index = (py * width + px) * 3;
          const r = rgb[index];
          const g = rgb[index + 1];
          const b = rgb[index + 2];
          const slot = y * 8 + x;
          yBlock[slot] = 0.299 * r + 0.587 * g + 0.114 * b;
          cbBlock[slot] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          crBlock[slot] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
      dcY = encodeBlock(yBlock, lumaQ, dcY, DC_LUMA, AC_LUMA, writer);
      dcCb = encodeBlock(cbBlock, chromaQ, dcCb, DC_CHROMA, AC_CHROMA, writer);
      dcCr = encodeBlock(crBlock, chromaQ, dcCr, DC_CHROMA, AC_CHROMA, writer);
    }
  }
  const scan = writer.finish();
  const out = [
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];
  dqt(out, 0, lumaQ);
  dqt(out, 1, chromaQ);
  out.push(0xff, 0xc0);
  push16(out, 17);
  out.push(8);
  push16(out, height);
  push16(out, width);
  out.push(3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1);
  dht(out, 0, 0, DC_LUMA_BITS, DC_LUMA_VALS);
  dht(out, 1, 0, AC_LUMA_BITS, AC_LUMA_VALS);
  dht(out, 0, 1, DC_CHROMA_BITS, DC_CHROMA_VALS);
  dht(out, 1, 1, AC_CHROMA_BITS, AC_CHROMA_VALS);
  out.push(0xff, 0xda);
  push16(out, 12);
  out.push(3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0);
  const bytes = new Uint8Array(out.length + scan.length + 2);
  bytes.set(out, 0);
  bytes.set(scan, out.length);
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return bytes;
}

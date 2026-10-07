const HOUSES = Object.freeze([
  { col: 0, row: 0, floors: 2, high: true, delay: 0.00 },
  { col: 1, row: 0, floors: 1, high: false, delay: 0.08 },
  { col: 2, row: 0, floors: 3, high: true, delay: 0.04 },
  { col: 3, row: 0, floors: 2, high: true, delay: 0.12 },
  { col: 0, row: 1, floors: 1, high: true, delay: 0.06 },
  { col: 1, row: 1, floors: 2, high: false, delay: 0.16 },
  { col: 2, row: 1, floors: 2, high: true, delay: 0.02 },
  { col: 3, row: 1, floors: 1, high: true, delay: 0.10 },
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function noActionPose(t, house) {
  const local = clamp((t - house.delay) / 0.78, 0, 1);
  const lean = local < 0.32
    ? (local / 0.32) * 0.3
    : 0.3 + ((local - 0.32) / 0.68) * 1.2;
  const slide = local < 0.4 ? 0 : (local - 0.4) ** 1.2;
  return {
    lean: Math.min(lean, 1.52),
    dx: slide * 52,
    dy: slide * 78,
    cracked: local > 0.22,
  };
}

function drawHouse(ctx, x, y, house, pose, treat) {
  const w = 22 + house.floors * 4;
  const wall = 16 + house.floors * 7;
  ctx.save();
  ctx.translate(x + pose.dx, y + pose.dy);
  ctx.rotate(treat ? 0 : pose.lean);
  ctx.fillStyle = 'rgba(8, 10, 12, 0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 5, w * 0.55, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = treat
    ? (house.high ? '#6c9878' : '#5d91a7')
    : (house.high ? '#b0483a' : '#c88c5a');
  ctx.fillRect(-w / 2, -wall, w, wall);
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 4, -wall);
  ctx.lineTo(0, -wall - 13);
  ctx.lineTo(w / 2 + 4, -wall);
  ctx.closePath();
  ctx.fillStyle = treat
    ? (house.high ? '#c5d5c4' : '#b7cdd4')
    : (house.high ? '#7a2e28' : '#8a5a38');
  ctx.fill();
  ctx.fillStyle = '#1a2226';
  ctx.fillRect(-4, -11, 8, 11);
  ctx.fillStyle = 'rgba(246, 241, 230, 0.55)';
  ctx.fillRect(w / 2 - 11, -wall + 5, 6, 6);
  if (!treat && pose.cracked) {
    ctx.strokeStyle = '#3a1612';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, -wall + 2);
    ctx.lineTo(4, -wall * 0.55);
    ctx.lineTo(-3, -3);
    ctx.stroke();
  }
  if (treat) {
    if (house.col % 2 === 0) {
      ctx.fillStyle = '#5d91a7';
      ctx.fillRect(w / 2 + 3, -14, 7, 12);
      ctx.fillStyle = '#8eb8c8';
      ctx.fillRect(w / 2 + 3, -16, 7, 3);
    } else {
      ctx.strokeStyle = '#8fbf9a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 5, 0);
      ctx.quadraticCurveTo(-w / 2 - 10, -16, -w / 2 - 1, -22);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRain(ctx, x, y, w, h, t) {
  const count = Math.round(10 + t * 46);
  ctx.strokeStyle = `rgba(170, 200, 220, ${0.18 + t * 0.35})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < count; i += 1) {
    const px = x + ((i * 53 + t * 90) % (w - 24)) + 12;
    const py = y + 56 + ((i * 97 + t * 220) % (h - 90));
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 5, py + 14 + (i % 4));
    ctx.stroke();
  }
}

export const MECHANISM_STORYBOARD = Object.freeze([
  { t: 0.16, treat: false, title: '1. Accumulated rainfall' },
  { t: 0.42, treat: false, title: '2. Runoff concentrates' },
  { t: 0.92, treat: false, title: '3. Illustrative no-action stress' },
  { t: 0, treat: true, title: '4. Drainage, capture and restoration' },
]);

export const MECHANISM_COPY = Object.freeze({
  title: 'Why early action matters',
  caption: 'Illustrative no-action mechanism. This animation is not a site-specific collapse forecast, structural assessment or predicted timeline.',
  play: 'Play',
  pause: 'Pause',
  replay: 'Replay',
  alt: 'Four-step illustration of rainfall, runoff, counterfactual slope stress, and recommended water-management works.',
});

export function mechanismPhase(play) {
  if (play < 0.22) return MECHANISM_STORYBOARD[0];
  if (play < 0.48) return MECHANISM_STORYBOARD[1];
  if (play < 1) return MECHANISM_STORYBOARD[2];
  return MECHANISM_STORYBOARD[3];
}

export function drawHillsideMechanism(ctx, {
  x = 0,
  y = 0,
  width,
  height,
  t = 0,
  treat = false,
  title = '',
}) {
  const play = clamp(t, 0, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  const sky = ctx.createLinearGradient(x, y, x, y + height);
  if (treat) {
    sky.addColorStop(0, '#1a2822');
    sky.addColorStop(1, '#16201c');
  } else {
    sky.addColorStop(0, `rgb(${28 + play * 8}, ${34 - play * 4}, ${40})`);
    sky.addColorStop(1, '#1a2226');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, width, height);

  if (!treat) drawRain(ctx, x, y, width, height, play);

  ctx.beginPath();
  ctx.moveTo(x, y + height * 0.38);
  ctx.lineTo(x + width, y + height * 0.22);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fillStyle = treat ? '#3f5f4c' : '#5a4a3e';
  ctx.fill();

  if (!treat && play > 0.2) {
    ctx.fillStyle = `rgba(110, 70, 48, ${0.22 + play * 0.28})`;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.12, y + height * 0.48);
    ctx.quadraticCurveTo(x + width * 0.45, y + height * 0.62, x + width * 0.78, y + height * 0.92);
    ctx.lineTo(x + width * 0.62, y + height * 0.92);
    ctx.quadraticCurveTo(x + width * 0.35, y + height * 0.64, x + width * 0.05, y + height * 0.52);
    ctx.fill();
  }

  HOUSES.forEach((house) => {
    const hx = x + width * 0.14 + house.col * width * 0.2 + house.row * 10;
    const hy = y + height * 0.46 + house.row * height * 0.22;
    const pose = treat ? { lean: 0, dx: 0, dy: 0, cracked: false } : noActionPose(play, house);
    drawHouse(ctx, hx, hy, house, pose, treat);
  });

  if (title) {
    ctx.fillStyle = treat ? '#c5d5c4' : '#eee8dc';
    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillText(title, x + 14, y + 24);
  }
  ctx.restore();
}

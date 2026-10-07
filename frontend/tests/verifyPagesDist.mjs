import { createServer } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(frontend, 'dist');
const base = (process.env.OUREA_BASE || '/ourea/').replace(/\/?$/, '/');
const prefix = base.replace(/\/$/, '');

function fail(message) {
  throw new Error(message);
}

function read(relative) {
  return readFileSync(join(dist, relative), 'utf8');
}

function assertNoRootAbsolute(label, text) {
  const bare = ['"/assets/', "'/assets/", '"/data/', "'/data/", '"/vendor/', "'/vendor/"];
  const hit = bare.find((token) => text.includes(token));
  if (hit) fail(`${label} contains root-absolute ${hit}`);
}

const index = read('index.html');
if (!index.includes(base)) fail(`index.html does not reference ${base}`);
assertNoRootAbsolute('index.html', index);

const worker = 'vendor/maplibre/maplibre-gl-worker.mjs';
const shared = 'vendor/maplibre/maplibre-gl-shared.mjs';
for (const relative of [worker, shared, 'data/cornare/interventions.json', 'data/cornare/municipalities.geojson', 'data/cornare/map/catalog.json']) {
  const file = join(dist, relative);
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`missing ${base}${relative}`);
}
if (!read(worker).includes('./maplibre-gl-shared.mjs')) {
  fail('MapLibre worker does not import its shared module with a relative URL');
}

const assets = join(dist, 'assets');
const bundled = [];
for (const name of readdirSync(assets)) {
  if (!name.endsWith('.js') || name.startsWith('maplibre-')) continue;
  const text = readFileSync(join(assets, name), 'utf8');
  bundled.push(text);
  assertNoRootAbsolute(name, text);
}
if (!bundled.some((text) => text.includes(`${base}vendor/maplibre/maplibre-gl-worker.mjs`))) {
  fail(`built JavaScript does not reference ${base}vendor/maplibre/maplibre-gl-worker.mjs`);
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.json') || file.endsWith('.geojson')) return 'application/json';
  if (file.endsWith('.mjs') || file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

const server = createServer((request, response) => {
  const url = decodeURIComponent((request.url || '/').split('?')[0]);
  if (!url.startsWith(`${prefix}/`) && url !== prefix) {
    response.writeHead(404);
    response.end('outside pages base');
    return;
  }
  let relative = url.slice(prefix.length);
  if (relative === '' || relative === '/') relative = '/index.html';
  const file = normalize(join(dist, relative));
  if (!file.startsWith(dist)) {
    response.writeHead(403);
    response.end('forbidden');
    return;
  }
  try {
    const body = readFileSync(file);
    response.writeHead(200, { 'Content-Type': contentType(file) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('missing');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const urls = [
  `${origin}${base}`,
  `${origin}${base}data/cornare/interventions.json`,
  `${origin}${base}data/cornare/municipalities.geojson`,
  `${origin}${base}data/cornare/map/catalog.json`,
  `${origin}${base}vendor/maplibre/maplibre-gl-worker.mjs`,
  `${origin}${base}vendor/maplibre/maplibre-gl-shared.mjs`,
];

try {
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) fail(`${url} -> ${response.status}`);
  }
  const outside = await fetch(`${origin}/data/cornare/interventions.json`);
  if (outside.status !== 404) fail(`root /data/cornare unexpectedly returned ${outside.status}`);

  if (process.env.OUREA_PAGES_BROWSER === '1') {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage();
      const problems = [];
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (/openfreemap|amazonaws|terrarium|favicon|sprite|glyph/i.test(text)) return;
        problems.push(text);
      });
      await page.goto(`${origin}${base}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.maplibregl-canvas').waitFor({ timeout: 25000 });
      if (problems.length) fail(`pages preview console/page errors:\n${problems.join('\n')}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

console.log(`Pages base ${base} serves the app, CORNARE data, and MapLibre worker.`);

import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const srcRoot = join(frontendRoot, 'src');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (['.js', '.jsx'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const sourceFiles = await walk(srcRoot);
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');

  assert.ok(
    !source.includes("type: 'sky'"),
    `${file} contains the obsolete/invalid MapLibre sky-layer pattern`,
  );
  assert.ok(
    !source.includes('rwh_suitability') &&
      !source.includes('drainage_suitability') &&
      !source.includes('restoration_suitability'),
    `${file} references an obsolete V1 risk-weighted suitability field`,
  );
  assert.ok(
    !/houses fall|houses lean|fallPose|HillsideFall|collapse warning/i.test(source),
    `${file} contains collapse-prediction imagery or copy`,
  );

  assert.ok(
    !source.includes('medellin_barrio_screening.geojson'),
    `${file} still references the obsolete V3 hazard-only city-screen asset`,
  );

  const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
  for (const match of source.matchAll(importRegex)) {
    const target = resolve(dirname(file), match[1]);
    await access(target).catch(() => {
      throw new Error(`${file} imports missing local module ${match[1]}`);
    });
  }
}

const domainFiles = sourceFiles.filter((file) => file.includes(`${join('src', 'domain')}`));
for (const file of domainFiles) {
  const source = await readFile(file, 'utf8');
  assert.ok(
    !source.includes('Math.random('),
    `${file} uses nondeterministic Math.random; uncertainty checkpoints must be reproducible`,
  );
}

const packageJson = JSON.parse(
  await readFile(join(frontendRoot, 'package.json'), 'utf8'),
);
for (const [name, version] of Object.entries({
  ...packageJson.dependencies,
  ...(packageJson.devDependencies ?? {}),
})) {
  assert.notEqual(
    version,
    'latest',
    `${name} must be pinned; "latest" is not reproducible`,
  );
  assert.ok(
    /^\d+\.\d+\.\d+/.test(version),
    `${name} should use an explicit semantic version`,
  );
}
assert.ok(
  packageJson.engines?.node,
  'package.json must declare the supported Node engine',
);

const configSource = await readFile(
  join(srcRoot, 'config', 'modelConfig.js'),
  'utf8',
);
assert.ok(
  configSource.includes("from './modelParameters.json'"),
  'modelConfig.js must derive numerical configuration from modelParameters.json',
);


const parameterFile = join(srcRoot, 'config', 'modelParameters.json');
const model = JSON.parse(await readFile(parameterFile, 'utf8'));
assert.deepEqual(
  Object.keys(model.optimizer.objectiveProfiles).sort(),
  ['access', 'balanced', 'equity', 'low_regret'].sort(),
  'Named objective-profile set changed unexpectedly',
);

for (const file of domainFiles) {
  const source = await readFile(file, 'utf8');
  assert.ok(
    !source.includes('equityWeight: 0.25') &&
      !source.includes('accessWeight: 0.1') &&
      !source.includes('downsidePenalty: 0.55'),
    `${file} duplicates numerical policy weights instead of reading modelParameters.json`,
  );
}

for (const file of sourceFiles) {
  if (file.endsWith(`${join('config', 'assetUrl.js')}`)) continue;
  const source = await readFile(file, 'utf8');
  assert.ok(
    !source.includes("'/data/") &&
      !source.includes('"/data/') &&
      !source.includes("'/terrain/") &&
      !source.includes('"/terrain/'),
    `${file} hardcodes an absolute public path; use assetUrl() so GitHub Pages /ourea/ works`,
  );
}

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  const retiredIdentity = new RegExp(
    String.raw`\bV` + `4\\b|_v` + `4|load` + `LaderaData|create` + `LaderaMap|Ladera` + `Lab`,
    'i',
  );
  assert.ok(
    !retiredIdentity.test(source),
    `${file} still contains a retired product identity`,
  );
}

async function walkAll(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkAll(path));
    else files.push(path);
  }
  return files;
}

const secretName = 'OPEN' + 'AI_API_KEY';
const viteSecretName = 'VITE_OPEN' + 'AI_API_KEY';
const keyPattern = /sk-[a-zA-Z0-9]{16,}/;
const scanRoots = [srcRoot, join(frontendRoot, 'public')];
const distRoot = join(frontendRoot, 'dist');
try {
  await access(distRoot);
  scanRoots.push(distRoot);
} catch {
  // Production bundle is scanned after npm run build.
}

for (const root of scanRoots) {
  for (const file of await walkAll(root)) {
    if (!['.js', '.jsx', '.mjs', '.css', '.html', '.json', '.map', '.txt', '.md'].includes(extname(file))) {
      continue;
    }
    const source = await readFile(file, 'utf8');
    assert.ok(!source.includes(viteSecretName), `${file} contains a frontend OpenAI env key name`);
    assert.ok(!source.includes(secretName), `${file} contains an OpenAI key name`);
    assert.ok(!keyPattern.test(source), `${file} looks like it contains an API key`);
  }
}

console.log(
  `Source validation passed: ${sourceFiles.length} JS/JSX source files; ` +
  'local imports resolve, seeded domain randomness is enforced, obsolete V1 fields are absent, and dependencies are pinned.',
);

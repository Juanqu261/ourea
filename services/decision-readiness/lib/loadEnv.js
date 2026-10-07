import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function rootEnvPath() {
  return fileURLToPath(new URL('../../../.env', import.meta.url));
}

export function parseEnvText(text, target = {}) {
  const body = String(text || '').replace(/^\uFEFF/, '');
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!target[key]) target[key] = value;
  }
  return target;
}

export function loadRootEnv(target = process.env) {
  const path = rootEnvPath();
  if (!existsSync(path)) return false;
  parseEnvText(readFileSync(path, 'utf8'), target);
  return true;
}

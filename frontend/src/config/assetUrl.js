export function baseUrl() {
  const value = import.meta.env?.BASE_URL;
  if (typeof value === 'string' && value.length > 0) {
    return value.endsWith('/') ? value : `${value}/`;
  }
  return '/';
}

export function assetUrl(relativePath) {
  const trimmed = String(relativePath ?? '').replace(/^\/+/, '');
  return `${baseUrl()}${trimmed}`;
}

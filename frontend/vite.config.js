import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

function missingTerrainTile404() {
  return {
    name: 'missing-terrain-tile-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const base = (server.config.base || '/').replace(/\/$/, '');
        const prefixes = [`${base}/terrain/`, '/terrain/'];
        if (!prefixes.some((prefix) => url.startsWith(prefix)) || !url.endsWith('.png')) {
          next();
          return;
        }

        const relative = url.replace(/^\/+/, '').replace(/^ourea\//, '');
        if (relative.includes('..')) {
          res.statusCode = 400;
          res.end('Invalid path');
          return;
        }

        const filePath = path.join(server.config.root, 'public', ...relative.split('/'));
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Not found');
          return;
        }
        next();
      });
    },
  };
}

function e2eClearsAiUrl() {
  return {
    name: 'e2e-clears-ai-url',
    config() {
      if (process.env.OUREA_E2E !== '1') return {};
      process.env.VITE_OUREA_AI_API_URL = '';
      return {
        define: {
          'import.meta.env.VITE_OUREA_AI_API_URL': JSON.stringify(''),
        },
      };
    },
  };
}

export default defineConfig({
  envDir: path.resolve(frontendRoot, '..'),
  base: process.env.OUREA_BASE || '/',
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
        },
      },
    },
  },
  plugins: [e2eClearsAiUrl(), missingTerrainTile404()],
});

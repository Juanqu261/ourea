import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const maplibreDist = path.resolve(frontendRoot, 'node_modules/maplibre-gl/dist');
const maplibreWorkerFiles = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

function maplibreWorkerAssets() {
  const prefix = '/vendor/maplibre/';
  return {
    name: 'maplibre-worker-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const name = maplibreWorkerFiles.find((file) => url.endsWith(`${prefix}${file}`));
        if (!name) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        fs.createReadStream(path.join(maplibreDist, name)).pipe(res);
      });
    },
    generateBundle() {
      maplibreWorkerFiles.forEach((name) => {
        this.emitFile({
          type: 'asset',
          fileName: `vendor/maplibre/${name}`,
          source: fs.readFileSync(path.join(maplibreDist, name)),
        });
      });
    },
  };
}

export default defineConfig({
  envDir: path.resolve(frontendRoot, '..'),
  base: process.env.OUREA_BASE || '/',
  plugins: [maplibreWorkerAssets()],
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
});

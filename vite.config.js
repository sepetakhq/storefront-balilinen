import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { seoDevPlugin } from '../../vite-plugin-seo.js';

// Bali Linen's storefront: a second Vite app with its own look, sharing the
// root storefront's non-visual layer (src/api, src/config, src/cart, ...) by
// relative import, the way admin/ does. The Go binary embeds its build beside
// the root one and serves it to any tenant whose brand.template says
// "balilinen" (backend/internal/webui).
//
// Same proxy posture as the root config, and for the same reason: the API
// resolves the tenant from the Host header, so changeOrigin stays false.
const apiTarget = process.env.API_TARGET || 'http://127.0.0.1:8090';
const devPort = Number(process.env.BALILINEN_DEV_PORT) || 5175;

// The host cmd/seed installs this tenant on. Open the dev server on this name,
// not on localhost: Vite forwards Host as-is, the backend strips the port, and
// `localhost` is Lily Alora's. Chrome and Firefox resolve *.localhost to
// loopback on their own; Safari and curl need an /etc/hosts line.
const host = 'balilinen.localhost';

export default defineConfig({
  root: __dirname,
  plugins: [react(), seoDevPlugin({ apiTarget, devPort, host })],
  server: {
    port: devPort,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/robots.txt': { target: apiTarget, changeOrigin: false },
      '/sitemap.xml': { target: apiTarget, changeOrigin: false },
    },
  },
  build: {
    outDir: '../../dist-balilinen',
    emptyOutDir: true,
  },
});

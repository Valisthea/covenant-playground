import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tier 4: generate a service worker that precaches the Monaco bundle,
    // the app chunks, and all 15 curated `.cov` examples. This lets the
    // user reopen the playground without network and still compile +
    // browse the examples.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'examples/*.cov'],
      manifest: {
        name: 'Covenant Playground',
        short_name: 'Covenant',
        description:
          'Browser-based playground for the Covenant smart contract language.',
        theme_color: '#7C3AED',
        background_color: '#FCFBF8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Monaco's own chunk is large — let Workbox precache everything
        // that isn't a source map. Sourcemaps are dev-only and should
        // not be cached on the user's device.
        globPatterns: ['**/*.{js,css,html,svg,woff2,ttf,cov}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB — Monaco is ~3 MB uncompressed
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/examples/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'examples-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    // COOP/COEP headers required for SharedArrayBuffer — currently unused
    // by the playground, but the stanza is ready for when we enable
    // multi-threaded wasmtime (Tier 2+). Safe to leave in place: it costs
    // a couple of headers and lets us drop in threaded WASM without
    // re-touching the dev server.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // The covenant-wasm-bindings package is published separately and
    // dropped into `public/covenant-wasm/` at build time. Vite must not
    // try to pre-bundle it — wasm-bindgen glue expects to load the
    // sibling `.wasm` file at runtime.
    exclude: ['covenant-wasm-bindings'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor', '@monaco-editor/react'],
          react: ['react', 'react-dom', 'react-router-dom'],
          ethers: ['ethers'],
        },
      },
    },
  },
});

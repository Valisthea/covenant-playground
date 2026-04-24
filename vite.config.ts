import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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

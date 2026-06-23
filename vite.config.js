import { defineConfig } from 'vite';

// Config base: root = cartella corrente, server con auto-apertura disabilitata.
// `base: './'` -> path relativi negli asset buildati: robusto su qualsiasi
// dominio o sottocartella (Cloudflare Pages, preview URL, ecc.).
export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    // esbuild minify (default) + nomi file con hash -> cache busting automatico.
    cssCodeSplit: true,
  },
});

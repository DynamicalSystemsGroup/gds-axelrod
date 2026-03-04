import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        formal: resolve(__dirname, 'formal.html'),
        viz: resolve(__dirname, 'viz.html'),
        sim: resolve(__dirname, 'sim.html'),
        nash: resolve(__dirname, 'nash.html'),
        psuu: resolve(__dirname, 'psuu.html'),
      },
    },
  },
});

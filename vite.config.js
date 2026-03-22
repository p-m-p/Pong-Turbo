import { defineConfig } from 'vite';

export default defineConfig({
  // index.html at project root is the entry point
  root: '.',
  base: '/Pong-Turbo/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    open: true,
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    // Production previews do not need source maps. Enable explicitly for diagnostics.
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
  },
  server: {
    port: 3000,
    open: true,
  },
});

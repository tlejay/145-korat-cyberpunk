import { defineConfig } from 'vite';

// The game is served at madebytle.com/koratrocketcar (proxied to this Vercel
// project) and at <project>.vercel.app/koratrocketcar/ — see vercel.json rewrites.
export const BASE_PATH = '/koratrocketcar/';

export default defineConfig({
  base: BASE_PATH,
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 800, // three.js alone is ~500 kB
  },
});

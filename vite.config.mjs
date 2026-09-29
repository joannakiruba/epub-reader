import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        widget: new URL('./widget.html', import.meta.url).pathname,
      },
    },
  },
  server: {
    port: 5173,
  },
});

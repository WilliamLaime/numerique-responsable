import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src'),
  base: './',
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: path.resolve(__dirname, 'src/sidepanel.html'),
      },
      output: {
        entryFileNames: 'panel.js',
        chunkFileNames: '[name].js',
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? info.name ?? 'asset';
          return `${name.replace(/\.[^.]+$/, '')}${path.extname(name)}`;
        },
      },
    },
  },
});

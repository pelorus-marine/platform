import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'frontend',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend'),
    },
  },
  build: {
    target: 'esnext',
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        chunkFileNames: 'chunk-[hash:8].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});

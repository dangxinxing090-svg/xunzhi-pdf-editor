import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    exclude: ['node_modules', 'tests/e2e/**'],
    alias: {
      // pdfjs-dist 依赖 DOM,在 Node 测试环境中 stub 掉
      'pdfjs-dist': __dirname + '/tests/stubs/pdfjs-dist.ts',
    },
  },
});

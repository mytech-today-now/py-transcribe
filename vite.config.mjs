import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  test: {
    root: '.',
    include: ['tests/unit/**/*.test.js'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/'
      }
    },
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true
  },
  worker: {
    format: 'es'
  }
});

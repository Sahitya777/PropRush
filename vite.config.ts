import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'cross-fetch': path.resolve(__dirname, 'src/shims/cross-fetch.js'),
        'cross-fetch/dist/browser-ponyfill.js': path.resolve(__dirname, 'src/shims/cross-fetch.js'),
        'cross-fetch/dist/browser-polyfill.js': path.resolve(__dirname, 'src/shims/cross-fetch.js'),
        'cross-fetch/dist/node-ponyfill.js': path.resolve(__dirname, 'src/shims/cross-fetch.js'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@dynamic-labs')) {
              return 'dynamic-vendor';
            }
            if (id.includes('node_modules/@clerk')) {
              return 'clerk-vendor';
            }
            if (id.includes('node_modules/recharts')) {
              return 'charts-vendor';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icons-vendor';
            }
          },
        },
      },
    },
  };
});

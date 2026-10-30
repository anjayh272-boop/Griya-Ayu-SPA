import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/send-message': {
          target: 'https://guitars-insured-execute-gardening.trycloudflare.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/cancel-booking': {
          target: 'https://guitars-insured-execute-gardening.trycloudflare.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/reschedule-booking': {
          target: 'https://guitars-insured-execute-gardening.trycloudflare.com',
          changeOrigin: true,
          secure: true,
        },
        '/wa-api': {
          target: 'https://guitars-insured-execute-gardening.trycloudflare.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/wa-api/, ''),
        },
      },
    },
  };
});

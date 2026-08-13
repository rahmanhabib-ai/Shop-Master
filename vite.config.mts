import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
    ],
    define: {
      // 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('src/components/')) {
              const parts = id.split('src/components/');
              if (parts[1]) {
                const componentName = parts[1].replace(/\.(tsx|ts)$/, '').split('/')[0];
                return `comp-${componentName.toLowerCase()}`;
              }
            }
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('jspdf-autotable')) {
                return 'vendor-pdf';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('html5-qrcode') || id.includes('react-barcode') || id.includes('react-qr-code')) {
                return 'vendor-codes';
              }
              return 'vendor-core';
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true' ? false : {
        overlay: false,
      },
    },
  };
});

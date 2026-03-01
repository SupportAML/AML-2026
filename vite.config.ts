import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/storage-proxy': {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/storage-proxy/, ''),
        },
      },
    },
    plugins: [
      viteCommonjs(),
      react(),
      mode === 'stats' && visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: [
        '@cornerstonejs/core',
        '@cornerstonejs/tools',
        '@cornerstonejs/dicom-image-loader',
        'dicom-parser',
      ],
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'pdfjs': ['pdfjs-dist'],
            'dwv': ['dwv'],
            'lucide': ['lucide-react'],
            'cornerstone': ['@cornerstonejs/core', '@cornerstonejs/tools', '@cornerstonejs/dicom-image-loader']
          }
        }
      },
      chunkSizeWarningLimit: 1000 // Increasing limit as we are now intentionally splitting chunks
    },
    worker: {
      format: 'es' as const,
    },
    optimizeDeps: {
      exclude: ['@cornerstonejs/dicom-image-loader'],
      include: ['dicom-parser'],
      esbuildOptions: {
        target: 'esnext'
      }
    }
  };
});

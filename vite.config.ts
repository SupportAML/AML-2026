import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
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
      react(),
      mode === 'stats' && visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.CLAUDE_API_KEY || env.VITE_CLAUDE_API_KEY || ''),
      'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY || env.VITE_CLAUDE_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'pdfjs': ['pdfjs-dist'],
            'lucide': ['lucide-react']
          }
        }
      },
      chunkSizeWarningLimit: 1000 // Increasing limit as we are now intentionally splitting chunks
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      }
    }
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom']
  },
  server: {
    fs: {
      strict: false
    }
  },
  build: {
    outDir: 'dist/messageBox',
    rollupOptions: {
      input: 'src/messageBox.html',
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  root: 'src',
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
    rollupOptions: {
      input: 'src/avatar.html'
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});
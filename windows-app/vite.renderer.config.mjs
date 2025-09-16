import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});

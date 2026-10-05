import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Compatibilidad con tablets antiguas del salón.
  build: {
    target: 'es2015',
  },
});

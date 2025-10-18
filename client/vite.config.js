import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,      // Port your dashboard will run on
    open: true       // Automatically open in browser when you run dev
  },
  build: {
    outDir: 'dist',  // Compiled frontend output
  }
});

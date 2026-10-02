import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages sirve el sitio en https://sebatobara.github.io/rooc-tactics/
export default defineConfig({
  base: '/rooc-tactics/',
  plugins: [react(), tailwindcss()],
});

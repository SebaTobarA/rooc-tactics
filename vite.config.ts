import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildId = Date.now().toString(36);

/** Publica `version.json` con el id de la compilación, para que las pestañas abiertas detecten versiones nuevas. */
const versionFile = (): Plugin => ({
  name: 'rooc-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) });
  },
});

// GitHub Pages sirve el sitio en https://sebatobara.github.io/rooc-tactics/
export default defineConfig({
  base: '/rooc-tactics/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss(), versionFile()],
});

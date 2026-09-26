import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const licenseText = readFileSync(new URL('./web/assets/licenses/phosphor-MIT.txt', import.meta.url), 'utf8');
const qrLicenseText = readFileSync(new URL('./web/assets/licenses/qrcode-generator-MIT.txt', import.meta.url), 'utf8');

export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: './',
  server: {
    proxy: { '/api/live': 'http://127.0.0.1:8787' },
  },
  plugins: [
    viteSingleFile(),
    {
      name: 'retain-bundled-licenses',
      enforce: 'post',
      generateBundle(_, bundle) {
        // The standalone HTML also distributes the embedded Phosphor SVG paths.
        bundle['index.html'].source += `\n<!-- Phosphor Icons, MIT License\n${licenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- qrcode-generator 2.0.4, MIT License\n${qrLicenseText}\n-->\n`;
      },
    },
  ],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
  },
});

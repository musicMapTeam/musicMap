import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const licenseText = readFileSync(new URL('./web/assets/licenses/phosphor-MIT.txt', import.meta.url), 'utf8');
const qrLicenseText = readFileSync(new URL('./web/assets/licenses/qrcode-generator-MIT.txt', import.meta.url), 'utf8');
const threeLicenseText = readFileSync(new URL('./web/assets/licenses/three-MIT.txt', import.meta.url), 'utf8');
const scrollbarLicenseText = readFileSync(new URL('./web/assets/licenses/overlayscrollbars-MIT.txt', import.meta.url), 'utf8');
const sakuraLicenseText = readFileSync(new URL('./web/assets/licenses/sakura-crossing-MIT.txt', import.meta.url), 'utf8');
const gsapNotice = readFileSync(new URL('./web/assets/licenses/gsap-notice.txt', import.meta.url), 'utf8');
const hfMetadata = JSON.parse(readFileSync(new URL('./web/assets/data/hf-collaborations.json', import.meta.url), 'utf8'));
const hfTrackCount = hfMetadata.counts?.selectedTracks ?? hfMetadata.tracks.length;

export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: './',
  plugins: [
    viteSingleFile(),
    {
      name: 'retain-bundled-licenses',
      enforce: 'post',
      generateBundle(_, bundle) {
        // The standalone HTML also distributes the embedded Phosphor SVG paths.
        bundle['index.html'].source += `\n<!-- Phosphor Icons, MIT License\n${licenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- qrcode-generator 2.0.4, MIT License\n${qrLicenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- Three.js 0.186.1, MIT License\n${threeLicenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- OverlayScrollbars 2.16.0, MIT License\n${scrollbarLicenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- Sakura Crossing renderer adaptation, MIT License\n${sakuraLicenseText}\n-->\n`;
        bundle['index.html'].source += `\n<!-- GSAP 3.15.0, Standard No Charge license\n${gsapNotice}\n-->\n`;
        bundle['index.html'].source += `\n<!-- Music metadata: ${hfMetadata.source.repository}, revision ${hfMetadata.source.revision}\n${hfMetadata.source.url}\nUpstream card labels its license bsd; no standalone LICENSE or BSD variant is supplied. This extract contains ${hfTrackCount} factual track credits, no audio or lyrics.\n-->\n`;
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

# Third-party notices and visual-asset provenance

## Build tools

- [Vite](https://github.com/vitejs/vite), version **8.3.1**, MIT. Used as the development server and static build tool; full license and bundled dependency notices ship with the installed package at `node_modules/vite/LICENSE.md`.
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile), version **2.3.3**, MIT. Used to inline the app into one distributable HTML; its full license ships at `node_modules/vite-plugin-singlefile/LICENSE`.
- Exact direct and transitive package versions and integrity values are retained in `package-lock.json`. These build dependencies are not a deployed application backend.
- The standalone HTML retains the full Phosphor MIT notice in an HTML comment, so the icon license accompanies the distributed SVG code.

## Phosphor Icons

`web/js/icons.js` embeds 17 SVGs from the **regular** weight of Phosphor Icons.

- Official upstream: <https://github.com/phosphor-icons/core>
- Package version: `@phosphor-icons/core` **2.1.1**
- Exact commit: `2b75f3ad12b420c9504ef05df8d2564a28f8500e`
- Retrieved: **2026-09-26**
- License: **MIT**, Copyright (c) 2023 Phosphor Icons
- Original license: <https://github.com/phosphor-icons/core/blob/2b75f3ad12b420c9504ef05df8d2564a28f8500e/LICENSE>
- Local complete license: [`web/assets/licenses/phosphor-MIT.txt`](web/assets/licenses/phosphor-MIT.txt)
- Exact per-icon source URLs and source-content SHA256 values: [`web/assets/licenses/phosphor-sources.json`](web/assets/licenses/phosphor-sources.json)

The SVG paths, view boxes, and `currentColor` fill are retained. This project adds `class="icon"`, `width="1em"`, `height="1em"`, `aria-hidden="true"`, and `focusable="false"`, and embeds the SVG strings in a local ES module. The enclosing UI control supplies the accessible label. No Phosphor font, full icon package, or runtime dependency is loaded.

| Local name | Official SVG name |
| --- | --- |
| arrow-right | arrow-right |
| arrow-left | arrow-left |
| arrow-up-right | arrow-up-right |
| plus | plus |
| x | x |
| check | check |
| swap | arrows-left-right |
| camera | camera |
| image | image |
| heart | heart |
| bookmark | bookmark |
| compass | compass |
| users | users |
| trash | trash |
| rotate | arrow-counter-clockwise |
| info | info |
| chevron-right | caret-right |

## AI-generated fictional concert imagery

The following images were generated for this project on **2026-09-26**, using the built-in OpenAI image generation tool:

- `web/assets/stage-scene.png`: audience-back view towards a fictional indoor stage.
- `web/assets/crowd-scene.png`: a side view across the crowd at the same imagined concert, using the first generated image only as a venue and lighting reference.

These are newly generated fictional scenes, not documentary photographs of a real event, user-uploaded memories, promotional artist photographs, or licensed music recordings. The prompts requested no brand, logo, text, watermark, identifiable celebrity, or specific real venue. Their common visual direction is dark ink-blue/teal audience lighting with warm coral stage light.

The images are not Phosphor assets and are not covered by Phosphor's MIT license. No third-party reference photographs were supplied. The original generated PNG outputs are copied into the project without cropping, repainting, or other image editing. Prompt and file provenance is recorded in [`web/assets/image-provenance.json`](web/assets/image-provenance.json).
## Runtime image encoding (2026-09-27)

Original generated PNG files remain unchanged. The app loads same-dimension WebP derivatives (`stage-scene.webp`, `crowd-scene.webp`) encoded with FFmpeg/libwebp at quality 88. No composition or content was changed. Hashes and sizes are in `web/assets/image-provenance.json`. FFmpeg is an authoring tool, not bundled in the app.

The backend uses built-in `node:http`, `node:crypto`, and `node:sqlite`, with no npm runtime dependencies. API references: [Node.js 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Vite development proxy](https://vite.dev/config/server-options).

## Video and cover authoring tools (2026-09-27)

- [HyperFrames](https://github.com/heygen-com/hyperframes), version **0.8.78**, [Apache License 2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE). Used through the version-pinned CLI to render `delivery/video-source/index.html` and `cover.html`. The project does not vendor or distribute the HyperFrames CLI package.
- **GSAP 3.14.2**, [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/), Copyright (c) 2025 Webflow. The composition sources reference the unmodified [versioned CDN script](https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js); HyperFrames inlines it into the temporary rendering page. The official license page was checked on **2026-09-27**; its stated last modification date is **2025-05-30**. Proprietary notices in the library must be retained; this project does not modify the library or redistribute a local copy.

These are video-production tools only, not Music Map / Music Space application runtime dependencies. The delivered MP4 and PNG contain rendered imagery, not either tool's runtime code. The composition, typography, scene arrangement, and animation timing were authored for this project; the incorporated screenshots and ticket image come from the running application and its export function. Tool licenses do not replace the separate visual-asset provenance recorded above.

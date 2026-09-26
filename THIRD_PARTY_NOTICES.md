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

## Historical 0.2 / 0.3 video and cover authoring tools (2026-09-27)

- [HyperFrames](https://github.com/heygen-com/hyperframes), version **0.8.78**, [Apache License 2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE). Used through the version-pinned CLI to render `delivery/video-source/index.html` and `cover.html`. The project does not vendor or distribute the HyperFrames CLI package.
- **GSAP 3.14.2**, [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/), Copyright (c) 2025 Webflow. The composition sources reference the unmodified [versioned CDN script](https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js); HyperFrames inlines it into the temporary rendering page. The official license page was checked on **2026-09-27**; its stated last modification date is **2025-05-30**. Proprietary notices in the library must be retained; this project does not modify the library or redistribute a local copy.

These are video-production tools only, not Music Map / Music Space application runtime dependencies. The delivered MP4 and PNG contain rendered imagery, not either tool's runtime code. The composition, typography, scene arrangement, and animation timing were authored for this project; the incorporated screenshots and ticket image come from the running application and its export function. Tool licenses do not replace the separate visual-asset provenance recorded above.

## Current 0.4 screen recording and cover (2026-09-27)

The current video captures actual application operations using Playwright's native Screencast API through Tabbit, then cuts the WebM clips and adds original Chinese subtitles with FFmpeg 9.0.1. The cover is a browser rendering of the project's original HTML and its actual exported ticket PNG. These authoring tools are not application dependencies; no tool binaries or runtime code are bundled in the MP4 or PNG. Source clips, timestamps, holds, file hashes, and the AI-generated demonstration-photo disclosure are documented in `delivery/recording-source/README.md` and `source-summary.json`. The previous HyperFrames/GSAP composition remains historical source, not the renderer for the current video.

## QR invitation generation (2026-09-27)

[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), **2.0.4**, Copyright (c) 2009 Kazuhiko Arase, MIT. The unmodified npm ES module is bundled into the browser app to encode its invitation URL locally. No external QR service receives the URL. The lockfile retains the package integrity; a complete license is retained at `web/assets/licenses/qrcode-generator-MIT.txt` and below for runtime-package redistribution.
MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Real collaboration catalogue (2026-09-27, MVP 0.4.0)

`web/js/map-catalogue.js` contains a manually curated set of **11 artists, 10 works, and 10 credited vocal collaborations**. It stores factual names, work titles, credited performers, version descriptions, source URLs, check dates, and outbound links. The per-work sources and the exact official video publishers are recorded in [real-catalogue-sources.md](references/research/2026-09-27/real-catalogue-sources.md).

- Primary sources include [JVR Music](https://www.jvrmusic.com.tw/), [Warner Music Taiwan](https://www.warnermusic.com.tw/), and official artist / label channels, including JVR, Cindy Yen, Jam Hsiao, JJ Lin, and Taihe Music. Exact pages, rather than these homepages, support each recorded collaboration in the source register.
- The 10 YouTube links were read through official oEmbed metadata to check titles and publishers on 2026-09-27. This is not evidence that the videos play in every region or account. The app opens external pages and does not embed, download, host, or supply music audio.
- The app does not copy lyrics, music recordings, artist photographs, album covers, or source-page artwork. Descriptions in the catalogue are independently written summaries of credited collaborations. Names and links do not imply artist endorsement, participation in a user-created event, or permission to reuse third-party media.
- The original fictional artist and song IDs remain a separately labelled demonstration catalogue. Real metadata is not presented as MusicBrainz data or as CC0: no MusicBrainz dataset was imported for this release, and the rights in the cited publication pages and media remain with their respective owners.
- The competition's restricted demo-song list was not downloaded or incorporated. Official external links do not expand that list's limited competition-use conditions.

## Open-source implementation research — no source code copied (2026-09-27)

The following repositories informed the 0.4 product and data design. They are research references, not bundled dependencies or copied implementation modules. The project independently implements its graph traversal, catalogue, room permissions, and exchange flow; this section does not claim their software licenses cover music, photographs, or other third-party content.

| Reference | License read | Limited design takeaway |
| --- | --- | --- |
| [MusicBrainz Server](https://github.com/metabrainz/musicbrainz-server) | Main code [GPL-2.0-or-later](https://github.com/metabrainz/musicbrainz-server/blob/master/COPYING.md); repository-specific exceptions are documented upstream | Stable artist identity and explicit recording credits; no server code or data dump imported |
| [ListenBrainz Troi](https://github.com/metabrainz/troi-recommendation-playground) | [GPL-2.0](https://github.com/metabrainz/troi-recommendation-playground/blob/main/LICENSE) | Separate candidate selection, filtering, and explanation; no recommender or API client incorporated |
| [Kreolis/musicmap](https://github.com/Kreolis/musicmap) | [MIT](https://github.com/Kreolis/musicmap/blob/main/LICENSE) | Relate a route to a sequence of works; no audio analyser, model weights, or graph implementation copied |
| [Snapdini](https://github.com/paytah232/snapdini) | [AGPL-3.0](https://github.com/paytah232/snapdini/blob/main/LICENSE); fonts have separate upstream notices | Clear event entry and a small set of photograph perspectives; no code, fonts, or assets copied |
| [PicPeak](https://github.com/PicPeak/picpeak) | [MIT](https://github.com/PicPeak/picpeak/blob/main/LICENSE) | Distinguish event access, upload permission, and attribution; no gallery code or assets copied |

Actual README / license / source-file reading scope and adoption decisions are recorded in [music-discovery-review.md](references/research/2026-09-27/music-discovery-review.md) and [social-product-review.md](references/research/2026-09-27/social-product-review.md). If a future change copies substantive code or assets, its actual version, license obligations, and modifications must be recorded separately. The QR library above is an actual bundled dependency and retains its own complete MIT notice.

## Sakura visual reference and Three runtime (2026-09-27)

[Sakura Crossing](https://github.com/Kenton-GMI/sakura-crossing), fixed commit [`de01898e89c7f6ab3fad93fa802f0f5ac66fbd81`](https://github.com/Kenton-GMI/sakura-crossing/tree/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81) (2026-07-29), is a **visual research reference only**. Its [MIT license](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/LICENSE) names Copyright (c) 2026 Kenton Wang. Music Map / Music Space independently authors its small music-street scene and theme; it does not copy Sakura Crossing source code, original images, audio, or scenes. The reference repository remains in the ignored research workspace and is not shipped. Its stock audio is explicitly excluded from its MIT license and is not used here. Read scope, pinned source links, and the five adaptation decisions are recorded in [sakura-visual-reference.md](references/research/2026-09-27/sakura-visual-reference.md).

[Three](https://github.com/mrdoob/three.js), package **0.186.1**, is an actual browser runtime dependency for the independently authored scene. License: **MIT**, Copyright © 2010-2026 three.js authors. The installed package contains the complete license at `node_modules/three/LICENSE`; `package-lock.json` records its exact package integrity. Redistribution of the bundled library must retain the complete copyright and permission notice. License copying and retention in the Vite output are handled by the integration task; the visual-reference review does not claim to have checked a finished bundle.

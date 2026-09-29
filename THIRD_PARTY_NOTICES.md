# Third-party notices and visual-asset provenance

Current application: **Music Map MVP 0.16.0**, a static single-file web app with no backend.

Sections marked **Historical** describe material that is no longer part of the app. It includes Music Space, which was removed from the entry on 2026-09-28. That material survives in git history at commit `3dd102c` (MVP 0.15.0). Historical sections are kept as the original provenance record.

## Build tools

- **[Vite](https://github.com/vitejs/vite) 8.3.1** (MIT). The development server and static build tool.
  - Its full license and bundled-dependency notices ship with the installed package at `node_modules/vite/LICENSE.md`.
- **[vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) 2.3.3** (MIT). Inlines the app into one distributable HTML file, `dist/index.html`.
  - Its full license ships at `node_modules/vite-plugin-singlefile/LICENSE`.
- **Versions**: exact direct and transitive package versions and integrity values are recorded in `package-lock.json`.
- **No backend**: these build dependencies are not a deployed application backend, and the app has none.
- **Bundled runtime packages**: Three, GSAP, OverlayScrollbars and qrcode-generator, each described below.
- **Notices in the HTML**: the standalone HTML carries the full Phosphor MIT notice in an HTML comment, so the icon license travels with the distributed SVG code. It also carries the notices for:
  - qrcode-generator
  - Three
  - OverlayScrollbars
  - the Sakura Crossing adaptation
  - GSAP
  - the Hugging Face metadata source

## OverlayScrollbars

- **Upstream**: [KingSora/OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars), npm **2.16.0**.
- **Release commit**: `dfa819688a529db0085c6416a94e816bfbaeaf29`.
- **License**: MIT, Copyright (c) 2022 Rene Haas.
  - Full notice: [`web/assets/licenses/overlayscrollbars-MIT.txt`](web/assets/licenses/overlayscrollbars-MIT.txt).
  - The notice is also embedded in the standalone HTML.
- **Use**:
  - Vite bundles the unmodified ESM and CSS package to draw overlay scrollbars on the page body.
  - The project turns on auto-hide and supplies its own 6px theme.
  - Not included: scroll interpolation, a framework wrapper, or the optional click-scroll plugin.
- **Alternatives considered**: evaluated alternatives and the Codrops visual reference are in [`interface-restraint.md`](references/research/2026-09-27/interface-restraint.md). No SimpleBar or Codrops code or assets are bundled.

## Phosphor Icons

`web/js/icons.js` embeds 18 SVGs from the **regular** weight of Phosphor Icons.

- **Upstream**: <https://github.com/phosphor-icons/core>
- **Package**: `@phosphor-icons/core` **2.1.1**
- **Commit**: `2b75f3ad12b420c9504ef05df8d2564a28f8500e`
- **Retrieved**: **2026-09-26**. The `magnifying-glass` icon was added in MVP 0.16.0 for the home-page search, from the same commit.
- **License**: **MIT**, Copyright (c) 2023 Phosphor Icons.
  - Original license: <https://github.com/phosphor-icons/core/blob/2b75f3ad12b420c9504ef05df8d2564a28f8500e/LICENSE>
  - Local complete copy: [`web/assets/licenses/phosphor-MIT.txt`](web/assets/licenses/phosphor-MIT.txt)
- **Per-icon sources**: exact source URLs and source-content SHA256 values are in [`web/assets/licenses/phosphor-sources.json`](web/assets/licenses/phosphor-sources.json).

### Local changes

- **Kept**: the SVG paths, view boxes, and `currentColor` fill.
- **Added**: the attributes `class="icon"`, `width="1em"`, `height="1em"`, `aria-hidden="true"`, and `focusable="false"`.
- **Packaging**: the SVG strings are embedded in a local ES module.
- **Accessibility**: the enclosing UI control supplies the accessible label.
- **Not loaded**: no Phosphor font, full icon package, or runtime dependency.

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
| magnifying-glass | magnifying-glass |

## Historical: AI-generated fictional concert imagery (removed from the app in MVP 0.16.0)

**Status**:

- These two images served Music Space's local demonstration.
- In MVP 0.16.0 they were deleted from `web/assets/`, together with their WebP derivatives and `image-provenance.json`.
- The app no longer loads or bundles them.
- The files remain at commit `3dd102c`. The original record follows.

The following images were generated for this project on **2026-09-26**, using the built-in OpenAI image generation tool:

- `web/assets/stage-scene.png`: audience-back view towards a fictional indoor stage.
- `web/assets/crowd-scene.png`: a side view across the crowd at the same imagined concert, using the first generated image only as a venue and lighting reference.

These are newly generated fictional scenes, not documentary photographs of a real event, user-uploaded memories, promotional artist photographs, or licensed music recordings. The prompts requested no brand, logo, text, watermark, identifiable celebrity, or specific real venue. Their common visual direction is dark ink-blue/teal audience lighting with warm coral stage light.

The images are not Phosphor assets and are not covered by Phosphor's MIT license. No third-party reference photographs were supplied. The original generated PNG outputs are copied into the project without cropping, repainting, or other image editing. Prompt and file provenance is recorded in `web/assets/image-provenance.json` (at commit `3dd102c`).

## Historical: runtime image encoding (2026-09-27)

Original generated PNG files remain unchanged. The app loads same-dimension WebP derivatives (`stage-scene.webp`, `crowd-scene.webp`) encoded with FFmpeg/libwebp at quality 88. No composition or content was changed. Hashes and sizes are in `web/assets/image-provenance.json`. FFmpeg is an authoring tool, not bundled in the app.

## Historical: backend (MVP 0.2.0–0.15.0)

The backend uses built-in `node:http`, `node:crypto`, and `node:sqlite`, with no npm runtime dependencies. API references: [Node.js 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Vite development proxy](https://vite.dev/config/server-options).

**Status**:

- The backend served Music Space's rooms, photos and exchanges.
- It was removed in MVP 0.16.0, along with the Dockerfile and the Vite `/api/live` proxy.
- `server/` survives at commit `3dd102c`.

## Historical 0.2 / 0.3 video and cover authoring tools (2026-09-27)

- [HyperFrames](https://github.com/heygen-com/hyperframes), version **0.8.78**, [Apache License 2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE). Used through the version-pinned CLI to render `delivery/video-source/index.html` and `cover.html`. The project does not vendor or distribute the HyperFrames CLI package.
- **GSAP 3.14.2**, [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/), Copyright (c) 2025 Webflow. The composition sources reference the unmodified [versioned CDN script](https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js); HyperFrames inlines it into the temporary rendering page. The official license page was checked on **2026-09-27**; its stated last modification date is **2025-05-30**. Proprietary notices in the library must be retained; this project does not modify the library or redistribute a local copy.

These are video-production tools only, not Music Map / Music Space application runtime dependencies. The delivered MP4 and PNG contain rendered imagery, not either tool's runtime code. The composition, typography, scene arrangement, and animation timing were authored for this project; the incorporated screenshots and ticket image come from the running application and its export function. Tool licenses do not replace the separate visual-asset provenance recorded above.

## Historical: 0.4 screen recording and 0.15 cover (2026-09-27)

**Status (MVP 0.16.0)**:

- `delivery/music-map-space-demo.mp4` (0.4) shows Music Space and does not represent the current app. No replacement video has been made yet; when it is, record its tools and sources in a new section.
- The 0.15 cover has been replaced in the working tree by a 0.16 cover; see the next section. The 0.15 cover's source remains at `delivery/recording-source/cover-v015.html`, and the 0.15 PNG remains in git history (for example `3dd102c`).
- The original 0.4 record follows.

The current video captures actual application operations using Playwright's native Screencast API through Tabbit, then cuts the WebM clips and adds original Chinese subtitles with FFmpeg 9.0.1. The cover is a browser rendering of the project's original HTML and its actual exported ticket PNG. These authoring tools are not application dependencies; no tool binaries or runtime code are bundled in the MP4 or PNG. Source clips, timestamps, holds, file hashes, and the AI-generated demonstration-photo disclosure are documented in `delivery/recording-source/README.md` and `source-summary.json`. The previous HyperFrames/GSAP composition remains historical source, not the renderer for the current video.

## 0.16 cover (2026-09-29; not yet committed)

- **File**: `delivery/cover.png`, 1920×1080, 1,395,457 B. It awaits the team's visual check.
- **Source**: `delivery/recording-source/cover-v016.html`, an original HTML composition authored for this project. Its header comment says the PNG is a 1920×1080 browser screenshot of that page served from the repository root; the tool actually used was not recorded.
- **Images inside**: three actual Music Map images, only scaled, cropped and rotated: `docs/assets/themes/roam-desktop-v016.png`, a crop of `home-desktop-v016.png`, and the exported challenge card `card-challenge-v016.png`. They belong to the 0.16 screenshot batch, which is treated as captured from the uncommitted working tree after `0b1eadc` (see `docs/PROJECT_STATUS.md`). The page is labelled 「页面为实际截图 · MVP 0.16」.
- **Third-party material**: none. No stock or AI-generated images; text is set in the system font stacks named in the page (-apple-system / PingFang SC / Microsoft YaHei; SF Mono / Menlo), and no font files are distributed.

## qrcode-generator: puzzle-link QR codes (introduced 2026-09-27; current use since MVP 0.16.0)

- **Package**: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) **2.0.4**, Copyright (c) 2009 Kazuhiko Arase, MIT.
- **Bundling**: Vite bundles the unmodified npm ES module into the browser app.
- **Former use**: until MVP 0.15.0 it encoded Music Space invitation URLs. That use was removed with Space.
- **Current use**: it encodes one 寻声 puzzle link into the QR code drawn on the challenge card (战绩卡) PNG.
  - The link has the form `?from=<start>&to=<target>#/explore`: the page address plus two artist IDs.
  - It carries no route, hints, saved songs or history.
- **Privacy**:
  - Encoding happens locally in the browser, and no external QR service receives the URL.
  - The card is generated only when the user asks for it, and it is not uploaded.
- **License copies**: the lockfile records the package integrity. A complete license is kept at `web/assets/licenses/qrcode-generator-MIT.txt`, embedded in the standalone HTML, and reproduced below.

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

## Share images (MVP 0.16.0)

- **What is drawn**: `web/js/share-card.js` draws two 1080×1350 PNGs on a canvas in the browser:
  - the challenge card (战绩卡);
  - the discovery card (发现卡片).
- **Contents**:
  - an original layout, with procedural artwork in the courtyard's night style;
  - factual artist names and song titles from the catalogue;
  - on the challenge card, a QR code made with qrcode-generator.
- **Not included**:
  - no third-party images, album covers or artist photographs;
  - no bundled fonts, since text uses the device's system fonts.
- **Privacy**: images are generated only when the user clicks, and they are not uploaded. Sharing or downloading an image is the user's own action.

## Real co-vocal catalogue (current: `real-vocal-2026-09-v4`, MVP 0.16.0)

`web/js/map-catalogue.js` contains a manually curated network of **29 artists and 37 recordings**.

- **Edges**: each recording is one edge between two artists who are both credited as vocalists on that recording.
- **Stored fields**:
  - factual names, work titles and credited performers;
  - version and recording descriptions;
  - per-role credits, where verified;
  - source URLs and check dates.
- **History**:
  - 12 artists and 13 recordings date from MVP 0.13.0.
  - 17 artists and 24 recordings were added after verification on 2026-09-28. The additions include a band node, 五月天, kept separate from the singer 阿信.

### Evidence

- **Accepted sources**:
  - label and artist websites and press releases;
  - official YouTube channels, with titles and publishers read through oEmbed;
  - store release metadata (Apple Music, Spotify, Deezer, LINE MUSIC, QQ Music, NetEase Cloud Music);
  - sourced news reports.
- **Leads only**: Wikipedia, Baidu Baike, Discogs and MusicBrainz were used only to find leads.
- **Not evidence**: shared composing, production, backing vocals, narration or appearing in a music video does not count as a co-vocal credit.
- **Registers**:
  - [real-catalogue-sources.md](references/research/2026-09-27/real-catalogue-sources.md)
  - [collaboration-roles.md](references/research/2026-09-27/collaboration-roles.md)
  - [vocal-network-expansion.md](references/research/2026-09-27/vocal-network-expansion.md)
  - [network-expansion.md](references/research/2026-09-28/network-expansion.md) and its [JSON](references/research/2026-09-28/network-expansion.json). These list three rejected candidates and the unverified parts.

### What the app does and does not use

- **Sources as evidence**: the app links to source pages as evidence.
  - It does not embed or play video or audio.
  - It does not copy lyrics, recordings, artist photographs, album covers or source-page artwork.
- **Artwork**: record sleeves on the table are procedural interface artwork, not official covers.
- **Descriptions**: catalogue descriptions are independently written summaries of credited collaborations.
- **Rights**:
  - Names and links do not imply endorsement by artists, labels or platforms.
  - Rights in the cited pages and media remain with their owners.
- **Data sources**:
  - No MusicBrainz dataset was imported, and the real metadata is not presented as CC0.
  - The competition's restricted demo-song list was not downloaded or incorporated.
- **Pending decisions**: excluding some artists for content risk (Namewee, Kris Wu, 明日花綺羅) is a product decision awaiting the product owner. So are the band-versus-singer node rule and whether to keep 李荣浩.

## QQ Music same-version links (2026-09-29, MVP 0.16.0)

Research record: [qq-music-links.md](references/research/2026-09-29/qq-music-links.md) and [qq-music-links.json](references/research/2026-09-29/qq-music-links.json).

- **Result**:
  - Of the 37 recordings, 31 were matched to a QQ Music song page for the same recording and version: `https://y.qq.com/n/ryqq/songDetail/{songmid}`. One of them, 爱我还是他, is a no-album same-show live entry accepted as an exception pending the product owner.
  - The other 6 get no link: 5 have no same-version page; 黑暗骑士 has the same album track, but QQ Music credits the band 五月天 rather than 阿信, pending the band/singer node rule.
- **Method**:
  - Research used QQ Music's web-player gateway (`u.y.qq.com/cgi-bin/musicu.fcg`) for song search, song detail and album track lists.
  - Only metadata was read: titles, artist and album IDs, release dates, track numbers, durations, version codes, language and label.
  - No audio was played, downloaded or compared, and no playback URL was requested.
- **What the app uses** (wired in the working tree after `0b1eadc`; not yet committed or deployed, and the live build has no QQ link):
  - The song page URL (songmid), a label, and QQ Music's listed vocal credit, which is shown as 「QQ 音乐署名：…」 where it differs from the edge's two singers (说好不哭, 等你下课, 私奔到月球).
  - One QQ Music lyric-header URL is also cited as the source of 黑暗骑士's production credits.
  - No audio, artwork, lyrics or other QQ Music content is stored in or bundled with the app.
  - The link opens QQ Music outside the app. QQ Music may require login, VIP or its own app, and availability varies by region and account. This has not been tested on a real phone or a mainland-China network.
- **Rights**: Music Map is not affiliated with QQ Music or Tencent Music, and a link is neither an endorsement nor a license.
- **Pending confirmation**: linking out changes PRD v0.2's no-outbound-link rule. The user decided this on 2026-09-29, and it awaits the product owner's confirmation.

## Historical: real collaboration catalogue (2026-09-27, MVP 0.4.0)

This section records the first real catalogue. Its counts and outbound links are superseded by the current catalogue above. The 0.4 official-video listen links were withdrawn in MVP 0.7.0.

`web/js/map-catalogue.js` contains a manually curated set of **11 artists, 10 works, and 10 credited vocal collaborations**. It stores factual names, work titles, credited performers, version descriptions, source URLs, check dates, and outbound links. The per-work sources and the exact official video publishers are recorded in [real-catalogue-sources.md](references/research/2026-09-27/real-catalogue-sources.md).

- Primary sources include [JVR Music](https://www.jvrmusic.com.tw/), [Warner Music Taiwan](https://www.warnermusic.com.tw/), and official artist / label channels, including JVR, Cindy Yen, Jam Hsiao, JJ Lin, and Taihe Music. Exact pages, rather than these homepages, support each recorded collaboration in the source register.
- The 10 YouTube links were read through official oEmbed metadata to check titles and publishers on 2026-09-27. This is not evidence that the videos play in every region or account. The app opens external pages and does not embed, download, host, or supply music audio.
- The app does not copy lyrics, music recordings, artist photographs, album covers, or source-page artwork. Descriptions in the catalogue are independently written summaries of credited collaborations. Names and links do not imply artist endorsement, participation in a user-created event, or permission to reuse third-party media.
- The original fictional artist and song IDs remain a separately labelled demonstration catalogue. Real metadata is not presented as MusicBrainz data or as CC0: no MusicBrainz dataset was imported for this release, and the rights in the cited publication pages and media remain with their respective owners.
- The competition's restricted demo-song list was not downloaded or incorporated. Official external links do not expand that list's limited competition-use conditions.

## Open-source implementation research — no source code copied (2026-09-27; partly historical)

The following repositories informed the 0.4 product and data design. They are research references, not bundled dependencies or copied implementation modules. The project independently implements its graph traversal and catalogue; until MVP 0.15.0 it also implemented Music Space's room permissions and exchange flow (removed in 0.16.0, kept at `3dd102c`); this section does not claim their software licenses cover music, photographs, or other third-party content.

| Reference | License read | Limited design takeaway |
| --- | --- | --- |
| [MusicBrainz Server](https://github.com/metabrainz/musicbrainz-server) | Main code [GPL-2.0-or-later](https://github.com/metabrainz/musicbrainz-server/blob/master/COPYING.md); repository-specific exceptions are documented upstream | Stable artist identity and explicit recording credits; no server code or data dump imported |
| [ListenBrainz Troi](https://github.com/metabrainz/troi-recommendation-playground) | [GPL-2.0](https://github.com/metabrainz/troi-recommendation-playground/blob/main/LICENSE) | Separate candidate selection, filtering, and explanation; no recommender or API client incorporated |
| [Kreolis/musicmap](https://github.com/Kreolis/musicmap) | [MIT](https://github.com/Kreolis/musicmap/blob/main/LICENSE) | Relate a route to a sequence of works; no audio analyser, model weights, or graph implementation copied |
| [Snapdini](https://github.com/paytah232/snapdini) | [AGPL-3.0](https://github.com/paytah232/snapdini/blob/main/LICENSE); fonts have separate upstream notices | Clear event entry and a small set of photograph perspectives; no code, fonts, or assets copied |
| [PicPeak](https://github.com/PicPeak/picpeak) | [MIT](https://github.com/PicPeak/picpeak/blob/main/LICENSE) | Distinguish event access, upload permission, and attribution; no gallery code or assets copied |

Actual README / license / source-file reading scope and adoption decisions are recorded in [music-discovery-review.md](references/research/2026-09-27/music-discovery-review.md) and [social-product-review.md](references/research/2026-09-27/social-product-review.md). If a future change copies substantive code or assets, its actual version, license obligations, and modifications must be recorded separately. The QR library above is an actual bundled dependency and retains its own complete MIT notice.

Note (MVP 0.16.0): Snapdini and PicPeak informed Music Space's room, photo and exchange features, which were removed from the app. They remain research references only.

## Sakura Crossing renderer and Three runtime (2026-09-27, introduced in MVP 0.6.0)

[Sakura Crossing](https://github.com/Kenton-GMI/sakura-crossing), fixed commit [`de01898e89c7f6ab3fad93fa802f0f5ac66fbd81`](https://github.com/Kenton-GMI/sakura-crossing/tree/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81), supplies the **MIT rendering code adapted in 0.6.0**. Copyright (c) 2026 Kenton Wang. A complete [local MIT notice](web/assets/licenses/sakura-crossing-MIT.txt) accompanies the modules and is embedded in the distributable HTML.

- `web/js/vendor/sakura/toon.js`: cel material bands and tinted shadow shader patch, with scene-owned material and ramp caches.
- `web/js/vendor/sakura/post.js`: depth ink, color grading and FXAA. Adapted for an orthographic camera, local scene distances, DPR ≤ 1.5 and a 2-million-pixel target budget. Linear-to-sRGB conversion remains in the grade pass.
- `web/js/vendor/sakura/palette.js`: unmodified upstream palette.
- Exact upstream paths, SHA-256 values and changes: [SOURCE.json](web/js/vendor/sakura/SOURCE.json). Upstream Three 0.180.0 is adapted to the project's 0.186.1; the relevant shader anchor was read in the installed source.

`web/js/sakura-world.js`, `sakura-scene.js` and `sakura-camera.js` contain Music Map's original geometry, scene integration and camera direction. No upstream world, player movement, artwork textures or audio is distributed. Upstream stock audio is explicitly excluded from MIT and is not used. The earlier [0.5 visual-only research](references/research/2026-09-27/sakura-visual-reference.md) remains a historical record; the [0.6 adoption note](references/research/2026-09-27/indie-app-direction.md) describes the current scope.

[Three](https://github.com/mrdoob/three.js), package **0.186.1**, is an actual browser runtime dependency for the independently authored scene. License: **MIT**, Copyright © 2010-2026 three.js authors. The complete license is copied to [web/assets/licenses/three-MIT.txt](web/assets/licenses/three-MIT.txt); `package-lock.json` records the exact package integrity. Vite retains the full copyright and permission notice in the standalone HTML, including the runtime package. Its presence in the 0.5 production output was read during integration.

## GSAP (MVP 0.7.0; Flip no longer used since MVP 0.16.0)

- **Package**: [GSAP](https://gsap.com/), pinned npm package **3.15.0**. Copyright 2008–2026, GreenSock. All rights reserved.
- **License**: [Standard No Charge GSAP License](https://gsap.com/community/standard-license/), **not MIT**.
  - The source copyright, author and license reference are kept in [gsap-notice.txt](web/assets/licenses/gsap-notice.txt) and embedded in the single HTML.
  - The GSAP source is not modified, and the app does not expose an animation authoring tool.
- **Use**: camera interpolation and UI entrance timelines.
- **Flip**: the plugin drove card transitions from MVP 0.7.0 to 0.15.0. It is no longer imported as of MVP 0.16.0.

### The scene

- **Historical (MVP 0.8.0–0.15.0)**: the 0.8 scene remains original procedural geometry. Its full-viewport courtyard, open shop, stage, six photo slots, worktable, interior cabinet, instanced petals, cat, physical photo lift and interruptible desktop/portrait GSAP camera director are written for Music Map. Photo textures use only project examples or cards already authorized by the existing application. The vendor renderer modules and their pinned upstream commit remain as documented above.
- **Current (MVP 0.16.0)**:
  - Removed: the photo slots, two-view photo wall, card-making desk and draft photo card. The scene loads no photo textures.
  - Clickable props: the record counter, turntable and vinyl (to the record shop) and the cabinet (to 我的发现).
  - Camera shots: home, explore and records.

## Hugging Face factual music metadata (MVP 0.7.0; 华语 extract since MVP 0.16.0)

Source: [maharshipandya/spotify-tracks-dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/tree/635b034f69257814eff850a5c2b3346fe458134f), revision **635b034f69257814eff850a5c2b3346fe458134f**. The upstream card labels the dataset `bsd`; it supplies no standalone LICENSE or specific BSD variant. This is recorded as stated, without inferring a broader music or recording license.

The full CSV (114,000 rows, 20,118,244 bytes) is downloaded locally under ignored `data/external/spotify-tracks-dataset/`.

### The current extract (126 tracks)

- **What it contains**: [hf-collaborations.json](web/assets/data/hf-collaborations.json) has factual track names, credited artist names, album names and source record identifiers. It contains no audio, lyrics, artwork, listening URL, or detailed production-role claims.
- **Selection**:
  - rows whose genre is `mandopop` or `cantopop`;
  - 2–5 distinct credited artist strings;
  - three artists excluded for content risk (Namewee, Kris Wu, 明日花綺羅), a product decision pending the product owner;
  - placeholder and studio credits excluded.
- **Meaning**: a shared credit only; it does not mean a duet. These tracks are not joined to the co-vocal graph.
- **Records**: selection rules and counts are in [open-catalogue-zh.md](references/research/2026-09-29/open-catalogue-zh.md). The download is described in the [download record](references/research/2026-09-27/huggingface-download.md), and the extract is rebuilt by the [reproduction script](scripts/datasets/download_hf_catalogue.py).

**History**: from MVP 0.7.0 to 0.15.0 the app shipped a 120-record extract chosen by popularity across all genres. The two extracts share no track IDs.

**Relation to the curated catalogue**: the 37 curated co-vocal recordings use separate, manually checked sources (see above). HF rows were used only as leads for candidate collaborations, never as evidence or to infer roles.

## Original courtyard printwork (MVP 0.11.0)

The procedural record sleeves, shop signage and wood-grain textures in web/js/sakura-printwork.js are original project artwork. The striped awning, detailed background houses, foliage and distant hills in sakura-world.js are original geometry. No third-party artwork or additional assets were downloaded for this iteration. Only the Sakura visual direction is exposed in the application and PNG exports; the renderer licenses above remain bundled.

Note (MVP 0.16.0): one sign's text changed from "AFTER THE SHOW" to "FOLLOW A VOICE". It is still original artwork.

## Original interactive record table (MVP 0.12.0)

`web/js/sakura-music.js` adds original procedural furniture, vinyl geometry, connecting threads and printed sleeve textures to the same courtyard scene. Artist names, collaboration titles and links come from the existing catalogues; the abstract sleeves are interface artwork, not official album covers. The projected labels, envelope controls, photo trays and album interface are original project code. No additional third-party assets, fonts or runtime libraries were introduced.

Note (MVP 0.16.0): the photo trays and album interface belonged to Music Space and were removed with it.

# 实施与部署规格

版本：3.0 · 2026-09-29，对应应用 MVP 0.16.0（`package.json` 名称 `music-map`，分支 `feat/map-mainline`）。产品规则见[产品方案](01-product-plan.md)，交付与材料见[交付方案](02-delivery-plan.md)，本轮构建、浏览器检查与部署结果见[项目状态](../../docs/PROJECT_STATUS.md)。文档 2.6 的实施规格（Space、Node + SQLite、接口与 Docker）保留在 `git show 3dd102c:product/docs/03-build-guide.md`。第 10 节原样保留 2.6 的证据记录。

## 1. 技术决定

| 部分 | 当前实现 | 边界 |
| --- | --- | --- |
| 页面 | 原生 HTML / CSS / JavaScript ES 模块，hash 路由；Vite 8.3.1 + vite-plugin-singlefile 2.3.3，`base: './'` | 不引入框架；输出一个自包含的 HTML |
| 运行环境 | 构建需 Node `^20.19.0 \|\| >=22.12.0`（Vite 8 的范围）；`.nvmrc` 与 CI 用 24 | 运行时只需浏览器 |
| 场景 | Three 0.186.1 常驻夜场小院与唱片桌；复用 Sakura Crossing 的 MIT 渲染模块（`toon.js` / `post.js` 为 0.6 起的本地改编，`palette.js` 原样；0.16 未再修改，见 `SOURCE.json`）；GSAP 3.15.0 负责界面动效，不再使用 Flip | WebGL 不可用时 `body.spatial-fallback`，唱片桌用同一数据、布局与可见性的 DOM / SVG 二维图 |
| 滚动 | OverlayScrollbars 2.16.0 增强 body；弹窗用原生细滚动条 | 保留浏览器滚动与键盘导航 |
| 二维码 | qrcode-generator 2.0.4，只在战绩卡上编码题目链接 | 本机生成，不调用外部服务 |
| 数据 | 人工核实的共唱网 29 位歌手 / 37 份录音（`real-vocal-2026-09-v4`）；开放曲库 126 首（HF 固定快照）；0.15 的虚构示例 | 不含音频、歌词、封面或头像 |
| 存储 | 两个 localStorage 键：`music-map-space:v1`（应用与 Map 状态）和 `music-map-saved-music:v1`（留下的歌） | 只在当前浏览器；无账号、无同步、无服务端 |
| 分享 | 题目链接 `?from=&to=#/explore`；战绩卡与发现卡片在本机用 canvas 画成 1080×1350 PNG | 只在用户点击后生成、下载或调用系统分享；不上传 |
| 外链 | 作品与署名来源、开放曲库数据卡、「去 QQ 音乐听」（§6，`b5939d9`） | 新标签页打开，`rel="noopener noreferrer"` |
| 没有 | 后端、上传、账号、测试框架、模型推理、内置音频 | — |

## 2. 模块与职责

| 文件 | 职责 |
| --- | --- |
| `web/index.html` | 标题「Music Map · 从喜欢，走向未知」、描述、theme-color `#23214a`、`data-theme="sakura"` |
| `web/js/app.js` | 外壳与路由（`home` / `explore` / `records`；旧 `space`、`live` 落到 `home`，去掉 `?room=`）；读写 `music-map-space:v1`；一次性读取题目链接；品牌、导航、「关于」对话框；「我的发现」页（探索记录 / 留下的歌）；OverlayScrollbars；连接场景与页面 |
| `web/js/home.js` | 小院首页：主张与三步、歌手搜索（NFKC、大小写与标点归一；整名 → 前缀 → 包含；最多 4 个）、示例歌手、寻声签（继续或开局）、「我的发现」与「留下的歌」计数、开放曲库入口 |
| `web/js/map.js` | 唱片店全部行为：寻声（迷雾、翻开、前往、提示、揭晓、仪式、连线歌单）、完整图鉴与自由漫游（本次探索条、结束、继续、替换确认）、回顾、探索记录、各面板、分享与出图动作、入口参数处理（`applyEntry`）、存档迁移（`prepareStoredMap`）、泄题守卫 |
| `web/js/map-network.js` | 确定性缓存布局（按歌曲距离做应力布局，再做间距处理，8 个种子取交叉最少者）；`shortestChain(s)`、`distancesFrom`、`chainLength`、`roundKnowledge`（由会话推出已认识的人与已翻开的边，不另存）、`roundHint` |
| `web/js/map-data.js` | 图谱目录（`real` / `fictional`）、固定寻声题组、虚构示例数据、`getNeighbors` / `isReachable` 等工具 |
| `web/js/map-catalogue.js` | 真实共唱网：歌手、录音、逐人署名与来源、QQ 同版本链接表（§6）；导出 `realArtists` / `realSongs` / `realEdges` |
| `web/js/share-card.js` | 题目链接与系统分享 / 剪贴板；战绩卡与发现卡片的 canvas 绘制；PNG 预览对话框 |
| `web/js/music-library.js` | 「留下的歌」存储、订阅与一次性导入 |
| `web/js/open-catalogue.js` | 开放曲库对话框与「留下的歌」列表（真实录音附「去 QQ 音乐听」或缺链说明） |
| `web/js/themes.js` | 挂载常驻场景；把旧 `space` 视图名映射到 `home` |
| `web/js/sakura-scene.js` | Three 场景、`NIGHT` 夜场值、灯光预设 `night` / `explore` / `records`（运行期只补间强度）、机位集合、拾取、无 WebGL 降级、销毁 |
| `web/js/sakura-world.js` | 小院几何与道具：唱片柜台与唱机通往唱片店，唱片柜通往「我的发现」，舞台是没有动作的聆听角落 |
| `web/js/sakura-music.js` | 唱片关系桌：纸背封套、翻面、墨线、提示残段、抵达与揭晓仪式、平移缩放；投影标签先摆必要的名字（当前、终点、相邻或手牌中的歌手，带引线），再按余下空间摆其他名字 |
| `web/js/sakura-camera.js` / `sakura-framing.js` | 三个机位（桌面 / 手机；手机竖屏高 > 2.3× 宽时唱片店用竖向机位），按实际纸件和弹窗占位取景；手机唱片店把纸桌放进页头工具与底栏之间的空位 |
| `web/js/sakura-printwork.js` / `sakura-batch.js` | 道具上的原创印刷纹样；静态网格合批 |
| `web/js/motion.js` / `icons.js` | GSAP 页面与弹窗动效（尊重减少动态）；内嵌 Phosphor 图标 |
| `web/js/vendor/sakura/` | MIT 渲染模块，`SOURCE.json` 固定上游提交；0.16 未修改 |
| `web/css/*.css` | `base` / `themes` / `theme-sakura` / `courtyard-ui` 为纸面 token 与基础；`night-shell` 在外壳样式中最后加载（其后只有组件样式 `share-card`、`listen`），负责夜场外壳；`home-map` 为首页搜索与寻声签；`map` / `map-studio` / `map-spatial` / `map-round` / `map-credits` 为唱片店；`share-card` 为 PNG 预览；`listen` 为「去 QQ 音乐听」与缺链说明（0.16，`b5939d9` 新增）；`product-finish` 为「我的发现」；其余为场景与布局 |

## 3. 路由与场景机位

- **路由。** hash 路由只有 `#/home`、`#/explore`、`#/records`。没有 hash 或未知 hash 都落到小院。旧的 `#/space`、`#/live` 和 `?room=` 链接由 `tidyUrl` 改写为小院。
- **场景与机位。** `#sakura-world` 的同一 scene / renderer 跨路由保留，三个机位与路由一一对应：
  - `home`：小院全景；
  - `explore`：唱片桌，由 `tableSpot` 照亮；
  - `records`：店内唱片柜。

  手机用独立机位，新选择可以打断旧转场，减少动态时直接到位。
- **页面与场景的接口。** 页面通过 `api.spatial.publish({mode, cards, music, onMusic})` 驱动场景：
  - 首页发布 `{mode:'home', cards:[]}`；
  - 唱片店发布 `mode:'explore'` 与 `music`（节点、边、稳定坐标、可见性、仪式令牌）；
  - `musicControl` 负责缩放、适配全图和定位。

  场景回传两类动作：`{type:'navigate', view}`（道具导航）和 `{type:'music', …}`（选择、翻面、仪式结束等，转交唱片店处理）。镜头不改变业务状态。
- **已删除的机位与道具。** `live`、`editor`、`photo` 三个机位，以及工作桌、拍立得、凳子和照片墙。

## 4. 状态、存储键与迁移

### `music-map-space:v1`

键名来自 0.15，为了让回访用户保留全部探索记录而沿用，与 Space 已无关系。结构：

```text
{ version: 1, view: 'home'|'explore'|'records', map, routePayload: null }
map = { version: 'catalogues-2026-09-v1', sessions: [], activeId, undo,
        roundsIntroduced: 1, keptBySession: 1, lastSessionByDataset: {real, fictional},
        view: { panel, reviewId, query, selectedArtistId, selectedEdgeId, inspectorOpen,
                challengeStart, challengeEnd, challengeError, challengeIntent,
                ceremony, roundCursor: {real, fictional}, creditSongId,
                shareStart, shareTarget, shareBack, pendingStart } }
session = { id, dataset, version, type: 'roam'|'challenge', start, target, returnRoamId,
            status, mode: 'co'|'style', yaw, pitch,
            path: [{id, edgeId?, mode, yaw, pitch}],
            events: [{type: 'move'|'back'|'reset', from, to, edgeId?, remaining?, tone?}],
            saved: [{id, source, savedAt}], created, updated,
            // 寻声（type 'challenge' 且 fog）另有：
            fog: true, flipped: [edgeId], hints: [{level, at, t, edgeId?}],
            friend?: {at, dismissed} }
```

- **状态。** 漫游为 `active` / `ended`；寻声为 `active` / `complete`（抵达）/ `revealed`（揭晓）。
- **步数。** 始终由 `path.length - 1` 推出，不另设计数器。
- **路线与记录。** `path` 是当前路线，`events` 是完整探索记录，回顾中的分支由 `events` 生成。
- **本次发现。** 取 `saved` 去重后的列表。
- **朋友标记。** `friend` 只标记“这局来自朋友的链接”，不含朋友的任何数据。

### `music-map-saved-music:v1`

```text
{ version: 1, tracks: [{id, title, artists: [], source, dataset: 'real'|'hf', savedAt}], imports: ['map-sessions-v1'] }
```

条目是保存时的快照。「留下的歌」直接渲染快照，不回查曲库，所以开放曲库换数据后，旧收藏仍能显示。

### 迁移（都只做一次，不新增存储键）

1. `app.js` 的 `load()` 读取 0.15 存档时，丢弃 Space 示例数据 `space` 与 `actor`，并清掉上次访问留下的撤销条。只要丢弃过，启动时立即写回一次，释放空间。
2. `prepareStoredMap()`（进入唱片店或「我的发现」时执行）：
   - 为缺少 `dataset` 的旧会话补上数据集；删除 `view.networkQuery`；补齐 `roundCursor` 与 `ceremony`。
   - `roundsIntroduced`（0.15）：从未走过、也没留歌的默认漫游，换成默认寻声局。
   - `keptBySession`（0.16）：真实漫游的清单只保留仍在「留下的歌」里的曲目，因为 0.16 之前在别处移除时不会同步到漫游清单。
3. 旧 Map 收藏只向「留下的歌」导入一次（标记 `map-sessions-v1`），之后移除的不会再被补回。
4. 以下旧键不再读写，也不主动删除：
   - `music-space-duet-seen:v1`（双联首映）；
   - `music-map-live:v1`（Space 匿名凭据）；
   - `music-map-visual-theme:v1`（旧外观偏好）。
5. 0.15 的虚构示例会话仍能打开，但切换入口已从菜单隐藏。

### 写入失败

`persist()` 捕获异常，显示“这次修改尚未保存到浏览器”和「重试保存」，页面内容保留；留下歌曲时写入失败也会提示。

## 5. 数据文件与扩网

| 文件 | 内容 |
| --- | --- |
| `web/js/map-catalogue.js` · `artistEntries` | `[id, 名称, 别名[], 颜色, 简介, {entity:'group'}?]` |
| `web/js/map-catalogue.js` · `recordings` | `{id, title, artists:[a,b], versionLabel, videoId?, sourceUrl, sourceLabel, evidence, checkedAt?}` |
| `web/js/map-catalogue.js` · `contributions[id]` | `{recordingLabel, creditSummary, sources:[{id,label,url,checkedAt}], credits:[{name, role, sourceId, artistId?}]}` |
| `web/js/map-data.js` | `catalogues.real.rounds`：寻声预设题 `[start, target]`，12 道 |
| `web/assets/data/hf-collaborations.json` | 开放曲库 126 首，43,825 B，LF；SHA-256 `06a8e0b7…3d7`；由 `scripts/datasets/download_hf_catalogue.py` 生成 |
| `data/external/spotify-tracks-dataset/` | 完整 HF CSV 与清单，只存本地，不进 Git、不进网页 |

`realSongs` 由 `recordings` 与 `contributions` 组合而成：两位歌手自动得到「演唱」署名（`sourceId: 'vocal'`，指向 `sourceUrl`），同时写入 `audioAvailable:false`、`creditsScope:'selected-verified'`。`realEdges` 由录音派生，边 ID 为 `real-co-<录音 slug>`。

扩网步骤（沿用 2026-09-28 的做法）：

1. **取证。**
   - 只采用官方来源：唱片公司或艺人官网与新闻稿、官方频道 MV（用 oEmbed 核对标题与作者）、主要商店的发行元数据。
   - HF、维基百科、百度百科、Discogs、MusicBrainz 只作线索。
   - 每条边先由一人研究、再由另一人独立复核，两轮都通过才收录。
   - 结果写入 `references/research/<日期>/`，包括 md 说明与 json 数据，未采用的候选也列出。
2. **判断能否建边。**
   - 两人都必须署名为演唱者。
   - 作词、作曲、制作、编曲、和声、旁白与 MV 出演只进署名表。
   - 现场版只对应特定一场。
   - 乐团与个人分开。
   - 核对内容风险排除名单。
3. **写数据。**
   - 新歌手与新录音用新的 `real-*` ID，已有 ID 不改。
   - `videoId` 只填官方频道的视频。
   - 每份录音都必须有 `contributions` 条目，否则模块加载时出错。
   - 数据有实质变化时提升 `REAL_CATALOGUE_VERSION`；只新增 ID 时，`MAP_DATA_VERSION` 不变，旧会话继续有效。
4. **题目。** 新的预设题只能追加在 `rounds` 末尾，已存的 `roundCursor` 依赖顺序。运行时只采用两端至少隔 2 首的题。
5. **检查。**
   - 用 Node 直接导入模块，核对人数、边数、连通性、独立回路数（边数 − 点数 + 1）与直径。
   - 运行 `npm run build`。
   - 在寻声中抽查，确认未认识的人名不出现在页面文字和标签里。
   - 注意：扩网会改变整张桌的布局，旧局重开后唱片位置不同。
6. **QQ 核对。** 新录音要按同样的两步法核对 QQ 同版本，并写入 `qqLinks` 或 `qqUnavailable`。两表都没有的录音状态为 `qq-unverified`，当前界面会显示「QQ 音乐暂无同一版本」，这对没核对过的录音并不准确。
7. **同步。** 更新产品方案 §3.5 的数字、[资源台账](../data/resource-register.json)、第三方声明与项目状态。

## 6. QQ 音乐链接的数据形状

**来源文件。** [`references/research/2026-09-29/qq-music-links.json`](../../references/research/2026-09-29/qq-music-links.json)：

```text
{ checkedAt: '2026-09-29', method, urlFormat: 'https://y.qq.com/n/ryqq/songDetail/{songmid}',
  links: { '<录音 ID>': { songmid, url, qqTitle, qqSingers: [], qqAlbum, qqReleaseDate } },   // 31 条
  unavailable: { '<录音 ID>': { status: 'unconfirmed'|'no-same-version', reason } } }        // 6 条
```

**状态。** 下面的数据形状与渲染方式在提交 `b5939d9`，随 `7fa4147` 的构建上线（`gh-pages` `e710bf8`）。更早的 `0b1eadc` 及其部署 `4901e31` 里，真实录音都是 `listenLinks: []`、`listenStatus: 'qq-unverified'`，没有入口。线上逐条打开的结果以项目状态为准。

**数据写在哪里。** `map-catalogue.js` 把核对结果抄成两张表：

- `qqLinks`：31 条，`录音 ID → [songmid, QQ 演唱署名[]]`；
- `qqUnavailable`：6 条，`录音 ID → [状态, 原因]`。

`listening(recording)` 在组装 `realSongs` 时写入以下字段：

```text
有同版本：listenLinks: [{ provider: 'qq', label: 'QQ 音乐', url, songmid,
                          credit, singers, creditMatches, checkedAt: '2026-09-29' }],
          listenStatus: 'qq-same-version'
没有：    listenLinks: [], listenStatus: 'qq-pending' | 'qq-no-same-version' | 'qq-unverified',
          listenReason, listenCheckedAt
```

- `creditMatches` 表示 QQ 的演唱署名是否恰好是本边两位歌手，按名字或别名比较。
- `qqLinkedCount`（31）供「关于」对话框引用。
- 应用内仍然 `audioAvailable: false`。

**怎样显示。**

- `map.js` 导出 `listenHTML(song, icon, {fogged, reason})`，渲染「去 QQ 音乐听」外链，或「QQ 音乐暂无同一版本」/「QQ 音乐 · 同版本待确认」。它用于作品条目、署名面板，以及 `open-catalogue.js` 的「留下的歌」。
- 翻开后的手牌用 `handListenHTML`，连线歌单有单独的按钮。
- `qqCredit` 在署名不一致时写「QQ 音乐署名：…」。寻声局中（`fogged`），署名里出现本边以外的人时不显示；缺链原因在局中也不显示。

**同一改动里的数据修正**（核对登记末节列出的问题）：

- `real-bu-gai` 的来源标签改为作品页，版本说明注明同一录音也收于《幻城》原声带。
- `real-dark-knight` 按 QQ 歌词头补上编曲与制作署名。
- `real-leave-the-earth-live` 补“未核对与影片是否同一场”。
- `real-who-do-you-love-live` 改为“QQ 音乐有同场现场音轨（无专辑）”。

**规则**（产品方案 §3.6，外跳待产品负责人确认）：

- 只用核对登记 `links` 中的条目。
- `unavailable` 中的录音不放任何入口，也不用其他版本顶替。
- 不链接搜索页，不从 `qqTitle` 反推别的版本。
- 更新核对结果时，研究文件和 `qqLinks` / `qqUnavailable` 要一起改。

**链接检查。** `y.qq.com` 桌面页是浏览器渲染的空壳，无头浏览器未登录时只见登录弹窗。检查时用手机 UA，跳转到 `i2.y.qq.com/n3/other/pages/playsong/index.html?songmid=…` 后看 `<title>`，或调用歌曲详情接口。不请求播放地址。2026-09-29 在线上版本用 Tabbit 点开 3 条，新窗口从 `ryqq` 转到 `ryqq_v2/songDetail/{songmid}`，未登录时三页都没有歌名，其中两页截图里有登录框（见项目状态）。

**应用内试听。** 若以后加入，按 PRD v0.2 §4.4 执行：

- 只在用户点击后播放，同一时刻只放一首；
- 切换歌手、打开面板或离开页面时暂停，刷新后不自动播放；
- 缺资源或加载失败要明示，不用计时器伪装声音。

FAQ Q11 的赛事歌单限评审演示、不得对外上线，与公开部署的 Demo 不兼容。

## 7. 分享与出图流程

1. **生成链接。** `challengeUrl(start, target)` 以当前页面地址为基础，清空查询参数，只写 `from`、`to` 和 `#/explore`。`shareChallengeLink` 依次尝试 `navigator.share`、`navigator.clipboard.writeText`，都不可用时打开「出题给朋友」面板，显示只读输入框，内有可选中的链接；复制失败时退回 `execCommand('copy')` 或手动复制。
2. **接收链接。** `app.js` 的 `takeSharedRound()` 在启动时读取 `from` 与 `to`（各截至 64 字符），立即用 `history.replaceState` 从地址中移除，并以 `{round:{start,target}, fromFriend:true}` 进入唱片店。`applyEntry` 校验两端都在真实目录内、不同且连通：通过就开局，并在会话上标 `friend`；已有同一道进行中的局就继续它；失败时提示原因，不开局。
3. **出图。** 战绩卡 `buildChallengeCard` 只用于已抵达或已揭晓的真实局；发现卡片 `buildDiscoveryCard` 只用于有移动或留歌的真实漫游。两者都：
   - 先等待 `document.fonts.ready`，在 1080×1350 canvas 上画夜空、串灯与票面；
   - 字体依次取 PingFang SC、Microsoft YaHei、Noto Sans SC，随系统不同。

   两张卡的内容：
   - **战绩卡**：中间站只画背面唱片，不写中间的名字和歌名；二维码编码题目链接；页脚是短地址。
   - **发现卡片**：最多 6 位歌手、5 首歌，超出时标「节选」；页脚是首页地址。
4. **预览。** `presentPng` 把 canvas 转成 blob，在 `data-motion="self"` 的对话框里显示实际 PNG。
   - 「下载图片」按 `music-map-xunsheng-<起点>-<终点>.png` 或 `music-map-discovery-<日期>.png` 命名。
   - 只有 `navigator.canShare({files})` 为真时才显示「分享图片」。
   - 关闭、再次出图、`popstate` 或 `pagehide` 时释放对象 URL。
   - 出图过程中有锁，生成期间重复点击不会生成第二张。

## 8. 构建、运行与部署

```sh
npm ci                 # 安装固定依赖
npm run build          # 生成 dist/index.html（单文件）
npm run dev            # 开发服务器，127.0.0.1
npm run preview        # 本地预览构建结果；npm start 相同
```

`dist/index.html` 可以直接双击打开，也可以放到任何静态托管。构建时，`vite.config.js` 在文件末尾附上以下许可说明与数据来源：

- Phosphor、qrcode-generator、Three、OverlayScrollbars、Sakura Crossing 的 MIT 许可；
- GSAP 的 Standard No Charge 许可；
- HF 数据来源说明（126 条事实性署名，不含音频或歌词）。

`dist/` 不提交。

CI（`.github/workflows/build.yml`）在推送到 main、PR 与手动触发时运行 `npm ci` 和 `npm run build`，上传名为 `music-map-demo` 的产物，包含 `dist/index.html`、`README.md`、`RUN-ME.md` 与 `THIRD_PARTY_NOTICES.md`，保留 14 天。CI 不负责部署。

### GitHub Pages 发布

线上地址是 <https://musicmapteam.github.io/musicMap/>。源码分支不推送，只把构建文件写进独立的 `gh-pages` 分支。分支里每次只有 `index.html` 与 `.nojekyll`；首个部署提交 `1e8323f`（来自 `d6b3de3`）没有父提交，之后每次以上一个部署为父：`4901e31`（来自 `0b1eadc`），当前 `e710bf8`（来自 `7fa4147`）。提交说明写明来源提交。

发布做法：用 `git archive` 取出某个提交的干净源码 → `npm ci` → `vite build` → 经 GitHub API 写入 blob、tree 与 commit（父提交为当前 `gh-pages` 提交）→ PATCH 分支引用 → 核对线上字节。本机工作区的改动不会进入构建。结果登记到项目状态：

```sh
SRC=7fa4147; REPO=musicMapTeam/musicMap; OUT=/tmp/mm-deploy   # SRC 换成要发布的提交
rm -rf "$OUT" && mkdir -p "$OUT" && git archive "$SRC" | tar -x -C "$OUT"
(cd "$OUT" && npm ci --no-audit --no-fund && npx vite build)
wc -c "$OUT/dist/index.html"; shasum -a 256 "$OUT/dist/index.html"

HTML=$(jq -n --rawfile c <(base64 < "$OUT/dist/index.html") '{encoding:"base64",content:$c}' \
  | gh api "repos/$REPO/git/blobs" --input - --jq .sha)
EMPTY=$(jq -n '{encoding:"utf-8",content:""}' | gh api "repos/$REPO/git/blobs" --input - --jq .sha)
TREE=$(jq -n --arg h "$HTML" --arg e "$EMPTY" \
  '{tree:[{path:"index.html",mode:"100644",type:"blob",sha:$h},{path:".nojekyll",mode:"100644",type:"blob",sha:$e}]}' \
  | gh api "repos/$REPO/git/trees" --input - --jq .sha)
PARENT=$(gh api "repos/$REPO/git/ref/heads/gh-pages" --jq .object.sha)
COMMIT=$(jq -n --arg t "$TREE" --arg p "$PARENT" --arg m "Deploy Music Map static build from feat/map-mainline@$SRC" \
  '{message:$m,tree:$t,parents:[$p]}' | gh api "repos/$REPO/git/commits" --input - --jq .sha)
gh api -X PATCH "repos/$REPO/git/refs/heads/gh-pages" -f sha="$COMMIT"
gh api "repos/$REPO/pages/builds/latest" --jq '{status,commit}'   # 等到 status 为 built、commit 为 $COMMIT

curl -sS -o /tmp/mm-live.html -w '%{http_code} %{size_download}\n' https://musicmapteam.github.io/musicMap/
shasum -a 256 /tmp/mm-live.html "$OUT/dist/index.html"   # 字节数与 SHA-256 都一致才算上线
```

首次发布时的差异：

- 提交的 `parents` 为空。
- 用 `POST repos/$REPO/git/refs`（`ref=refs/heads/gh-pages`）建立分支。
- 用 `POST repos/$REPO/pages` 把来源设为 `{"branch":"gh-pages","path":"/"}`。

每次发布都是公开发布，受 FAQ Q10 约束，见交付方案 §2。发布后要检查：

- 线上文件的字节数与 SHA-256 与本次干净构建一致；
- 手机能从链接直接进入；
- 刷新后记录仍在；
- 题目链接能在另一浏览器打开。

## 9. 0.16 删除了什么

| 删除 | 说明 |
| --- | --- |
| 服务端 | `server/index.js`、`server/db.js`（Node + SQLite 的 `/api/live`）、`Dockerfile`、`.dockerignore`、Vite 的 `/api/live` 代理、CI 的服务端语法检查 |
| Space 前端 | `space.js`、`space-data.js`、`live.js`、`live-library.js`、`live-photo.js`、`duet-ceremony.js`、`duet-facts.js`、`ticket-export.js`，以及对应 CSS（`space`、`space-studio`、`live`、`live-compose`、`library`、`duet-ceremony`、`memory-export`、`scene-panels`） |
| 素材 | AI 生成的现场示例图 `stage-scene` / `crowd-scene` 及 `image-provenance.json` |
| 场景 | 工作桌、拍立得、凳子、照片墙，以及 `live` / `editor` / `photo` 机位；舞台的麦克风架与音箱 |
| 功能 | 首页「同一刻，另一面」与交换三步、「带到现场」、去同场、GSAP Flip、运行包 ZIP |

这些内容都保留在 main 的 `3dd102c`（MVP 0.15.0）。`share-card.js` 的绘制基础取自 0.15 的 `ticket-export.js`。qrcode-generator 在转向时一度移除，0.16 为战绩卡重新加入。

## 10. 历史记录（保留原文）

以下是文档 2.6（MVP 0.15.0，2026-09-27）第 8 节“证据与待检查边界”的原文，未改写（历史 0.15 及更早）。其中的“当前”指 0.15；文中的 Space、Node 服务、SQLite 与运行包已于 0.16 移出，原实现见 `3dd102c`。

### 0.15 当前整合

当前规格包括：夜场小院与外壳、首屏价值主张、寻声一局与完整图鉴、双联全屏仪式页与夜场票根 PNG。纸件占位取景、选中与行走分离、授权照片与交换规则沿用。本轮构建、实际浏览器画面、运行包、PR 与合并结果只以[项目状态](../../docs/PROJECT_STATUS.md)为准；0.14 及更早证据保留原范围。以下几项不预先记作通过：实体手机、真机双指、读屏软件实机、正常硬件下的仪式与开场亮灯时长，以及外部用户试用。

### 0.14 历史结果

按纸件实际占位为场景主体取景，次要内容按需展开，窄纸面弹窗在短屏保留完整滚动路径。当次构建与画面见[项目状态](../../docs/PROJECT_STATUS.md)，不代替 0.15 夜场、寻声或仪式页的检查。

### 0.10 历史结果

首次默认樱花、两步制卡、真实 PNG 预览与音乐收藏保位的当次构建和浏览器结果见[项目状态](../../docs/PROJECT_STATUS.md)。文件分享按钮存在不代表已在实体手机发送。

### 0.9 历史结果

本机构建已完成。已操作本人主页恢复现有场次编辑器（未保存改动）、跨场次查看双联与离场自卡，以及 HF 搜索 Sam Smith → 收藏 Unholy → 带歌创建内部示例场次 → 明确选择 AI 示例图 → 私藏保存 → 收藏回看 → 返回房间邀请。离场后刷新仍可查看本人卡，重入只预填邀请码、没有自动加入。新增本人收藏读删接口沿用数据库结构及照片授权。

390px 双联页已目视未见横向溢出。0.9 的 PNG 得到生成成功提示；下载事件工具不支持，未检查实际文件，不记为已下载或已目视 PNG。该版本画面、打包、CI 与同步范围见[项目状态](../../docs/PROJECT_STATUS.md)，不代替 0.10 成品预览、实体手机、外部用户试用或评审部署。

### 0.8 历史结果

全屏小院、六类视角、独立手机镜头、授权照片与现有编辑 / 交换入口已接通。生产构建和本地运行包已更新，桌面与 390×844 模拟手机的关键画面已查看；具体范围、资源处理与 GitHub / CI 见[项目状态](../../docs/PROJECT_STATUS.md)。静态模型按相同几何、材质、阴影和动作分组实例化；这不代表实体手机性能已达标。没有新增测试套件、后端协议或数据库迁移。

### 0.7 历史结果

常驻透视场景、四路由镜头、GSAP 界面动画、逐人署名和开放曲库的当次构建、桌面 / 模拟手机画面及同步结果保留在[项目状态](../../docs/PROJECT_STATUS.md)，不代替 0.8 全屏构图与实物操作的检查。

### 0.6 历史结果

照片卡工作台、唱片 Map、悬浮导航和 MIT 三渲二管线的当次检查保留在[项目状态](../../docs/PROJECT_STATUS.md)，不代替 0.7 空间镜头、动画或新数据的检查。

### 0.5.1 历史结果

当时的首页／示例分离、紧凑 Map、说明精简和滚动条检查保留在[项目状态](../../docs/PROJECT_STATUS.md)，不代替 0.6 新构图或新渲染的检查。

### 0.5.0 历史结果

当时已查看三套 Space 首屏、主题选择器、浅色 Map／记录／编辑与双联弹窗，以及 390px 关键画面；切换保留邀请码输入与已有房间记忆，刷新保留外观。两套新主题双联已实际导出并目视；樱花场景实际显示，切走后 canvas 移除。具体范围见项目状态，不代替 0.6 检查。

### 0.4.0 历史实际结果

以下来自 2026-09-27 整合者的实际构建与页面操作记录，本次文档同步没有额外执行构建或检查。

| 范围 | 已取得结果 | 仍有的边界 |
| --- | --- | --- |
| 生产构建 | `npm run build` 通过，`dist/index.html` 为 **588,715 B** | 本机构建成功不等于 CI 或线上部署完成 |
| 旧库迁移 | 重启服务执行 SQLite 增列迁移，旧森森 / 小舟身份和原房间列表仍读回 | 不扩大为所有迁移、恢复或备份场景验证 |
| 自定义场次与照片 | `127.0.0.1` 的森森与 `localhost` 的小舟持不同来源身份，进入新房“校园声场演示”；各用真实文件选择器上传项目 AI 图，压缩至 960px | 验证上传流程；图片是 AI 演示素材，不是实拍现场或外部用户提供 |
| 独立同意与同步 | A 私卡、B 展示卡；界面解释共同返场及舞台 / 人海视角，A 确认两卡申请、B 独立接受、A 自动同步，双方各有 record | 这是本机独立会话，不是两台实体手机或公网环境 |
| 实际导出 | 下载 **1600×1800** 单卡 **1,041,477 B**、双联 **1,097,920 B** PNG；桌面二维码、新双联与单卡已目视 | 结果对应本次卡片内容，不是固定产物体积 |
| 窄屏 | 390px 模拟视口下编辑与票根容器可见宽 / 滚动宽均为 320px，未见横向溢出 | 仅模拟视口，不声称实体手机或全页面验收 |
| Map | 已操作真实周杰伦 → 张惠妹与来源面板，旧 fictional 路线保持 | 没有内置音频或官方 MV 实际播放保证 |
| 视频素材 | 0.4.0 已完成 **106 秒、1080p、30fps** 的实际操作中文字幕成片与 16:9 封面；全片解码与关键帧目视已完成 | 不包含 0.5 三主题；详细规格与剪辑来源见交付清单，不扩大为全部新主题录制 |

以上为 0.4 的历史结果；当时尚未下载 HF 曲库。当前完整 CSV 已下载，仍无模型权重、内置音频或实时 AI 推理。线上受保护评审链接、外部目标用户试用、实体手机与正式提交尚待完成，原始操作与本轮状态见[项目状态](../../docs/PROJECT_STATUS.md)。

### 历史版本记录

2026-09-26 的应用 0.1.0 已构建，并在生产预览操作本地制卡 → 待回应 → 接收方接受 → 手动保存 → 刷新重开，以及 Map 挑战前进与返回。查看过桌面和 390px 宽关键画面。手动保存是该历史版本行为，不是当前新交换规则。

**下表仅为 0.2.0 的历史检查与边界。** 后续版本不沿用这张表宣布新增能力已通过；0.3.0 结果另见[项目状态](../../docs/PROJECT_STATUS.md)。

| 检查 | 判断标准 | 0.2.0 当时状态 |
|---|---|---|
| 服务语法 | 两份后端 JS 可被 Node 解析 | `node --check server/index.js` 与 `node --check server/db.js` 已通过；不等于运行验证 |
| 生产构建 | Vite 产物可生成 | 0.2.0 生产构建已通过 |
| 独立身份与同意 | 独立会话，发送者不能代接受；版本变化拒绝发送 | 小满 / 阿遥两份独立浏览器存储会话完成入场、A 私卡 / B 展示卡、指定两卡申请、B 接受、A 同步；API 实操未入房 C 读取为 403、A 接受为 403、B 接受为 200；版本变化分支未专项实测 |
| 联网记录 | 自动生成双方记录，快照不变，删除互不影响 | 两方 record 快照一致；刷新同房记录仍在；A 编辑短句不改旧记录，A 删除不影响 B。服务进程重启后，原身份同房卡片与记录仍可读回 |
| 票根 PNG | 从已接受快照导出，文件可打开、中文与图像完整 | 已实际下载约 1.62 MB 并目视查看 |
| 新视觉与手机 | 中文层级清楚，关键状态和窄屏布局可用 | 390×844 票根横向溢出修复后已查看；不扩大为实体手机或全页面验收 |
| 线上部署 | 评审实际可访问，API 同源，磁盘持续保留 | 尚未部署；Dockerfile 存在不等于容器已运行 |
| 音频与真实元数据 | 来源及实际能力准确 | 尚未接入 |

以上 0.2.0 运行证据由整合者及接口检查协作者提供，当时没有新增或运行测试框架 / 套件。本次文档同步没有新增检查；0.4.0 至 0.14 按历史范围保留，0.15 由任务记录记实，不将局部检查扩展成未执行的环境或路径。

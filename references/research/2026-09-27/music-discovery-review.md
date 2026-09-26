# Music Map 0.3.0：真实音乐发现研究

日期：2026-09-27。研究对象为当日 `web/`、`server/` 与当前产品规则；后续实现另记。本次读取公开仓库的 README、许可证与关键源文件；没有运行参考项目、下载音频、模型权重或大数据。保留动态排版主导的音乐节视觉。

## 核心建议

**下一轮做一张小而真实的合作图谱，把每一步接到可核对、可去听的作品。** 先收录 11 位华语艺人、10 首有正式联合演唱署名的作品；实际来源清单见同目录 `real-catalogue-sources.md`。默认新用户进入真实专题，原 9 位虚构艺人继续作为独立“情景示例”，兼容旧探索和虚构现场。

这会提高比赛论证中的用户价值与可行性：评委可以从熟悉的名字出发，解释为何来到下一位艺人，并打开真正的作品。它仍是精选内容与探索交互的产品创新；不能据此宣传独创推荐模型、准确理解音乐或提高获奖概率。

## 0.3.0 研究基线中损害核心价值的三处

以下代码位置对应本轮修改前的 0.3.0；真实专题的实现范围记录在后文，不能将这些基线问题当作修改后的状态。

1. **发现没有真实对象。** `web/js/map-data.js:1` 起明确全为虚构，`co-*` 是手填关系，曲目 `audioAvailable:false`。视觉、分支回顾和保存流程能成立，但“发现了一位原来不知道的歌手/一首值得再听的歌”尚不能在日常使用中成立。仅扩大虚构节点数量不能解决这个问题。
2. **依据与收获尚未出站。** `web/js/map.js` 的 `tracksHTML` 只提供留下作品；`discoveryHTML` 展示虚构关系文字。`isReachable` 是普通广度优先搜索（BFS），不是音乐理解或模型推荐。加入每条作品的发布方来源与外部聆听链接，才让“为什么相连”和“留下以后做什么”有具体答案。外链仍不能等同内置试听，也未证明目标地区能播放。
3. **真实数据不能直接替换旧 ID。** `app.js:10–29` 原样加载 v1 本地状态；Map 的作品列表按 `艺人ID-序号` 拼 ID，历史用全局字典解释；`space-data.js:9`、`server/index.js:234` 和 `server/db.js:39` 绑定虚构 `co-0`。如果把 a/co-0 改成真实艺人/作品，旧历史与交换卡就会被改写。真实专题须独立命名和会话数据集，虚构活动不得伪装成真实艺人场次。

## 实际读过的三个开源实现

| 项目与许可 | 读到的具体实现 | 本轮借鉴与不引入项 |
| --- | --- | --- |
| [MusicBrainz Server](https://github.com/metabrainz/musicbrainz-server)，主体 [GPL-2.0-or-later](https://github.com/metabrainz/musicbrainz-server/blob/master/COPYING.md) | [`ArtistCredit.pm`](https://github.com/metabrainz/musicbrainz-server/blob/master/lib/MusicBrainz/Server/WebService/Serializer/JSON/2/ArtistCredit.pm) 输出姓名、连接词和独立 artist 实体。歌手署名是结构化身份，不能只拆标题字符串 | 借鉴稳定身份和署名结构；不搬运服务端代码、不自建全量 MusicBrainz |
| [ListenBrainz Troi](https://github.com/metabrainz/troi-recommendation-playground)，[GPL-2.0](https://github.com/metabrainz/troi-recommendation-playground/blob/main/LICENSE) | [`periodic_jams.py`](https://github.com/metabrainz/troi-recommendation-playground/blob/main/troi/patches/periodic_jams.py) 接收推荐候选，再区分已听/未听、排除负反馈，限制同一艺人出现次数；[`filters.py`](https://github.com/metabrainz/troi-recommendation-playground/blob/main/troi/filters.py) 提供独立过滤模块 | 借鉴“候选 → 明确规则 → 可解释结果”；不把 Troi 本身当浏览器零依赖 AI，它使用 ListenBrainz 数据/API，部分推荐来自上游协同过滤 |
| [Kreolis/musicmap](https://github.com/Kreolis/musicmap)，[MIT](https://github.com/Kreolis/musicmap/blob/main/LICENSE) | [`music_analyser.py`](https://github.com/Kreolis/musicmap/blob/main/analysis/music_analyser.py) 调用 `MSD_musicnn` 提取本地 MP3 特征；[`graph.py`](https://github.com/Kreolis/musicmap/blob/main/graph/graph.py) 用余弦相似度建图、搜索指定长度路径 | 借鉴“选起点终点 → 路线成为作品序列”；不引入音频模型。源码 `calc_path` 还将输入标签覆盖成固定标签，不能仅凭 README 宣传其任意情绪路线已经可靠 |

上述代码只作为设计研究，当前计划采用独立实现，没有复制 GPL 或 MIT 项目的代码。开源程序许可证也不等于歌曲录音和封面的使用许可。

## MusicBrainz 能提供什么，不能混成什么

- 公开元数据查询可用 API 的 GET 查询，采用稳定 MBID（MusicBrainz 标识符）。读取使用明确 User-Agent，遵守平均每秒一次请求；不应把每次拖动/点节点变成在线请求。精选快照适合本产品的即时舞台交互。[API](https://musicbrainz.org/doc/MusicBrainz_API)、[限流规则](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- 核心艺人、录音、署名、关系及 URL 属于 CC0；用户标签、注释、评分等补充数据另有许可。不能把整个网站内容、音乐与封面都写成 CC0。本轮不复制用户标签，真实艺人的“策展标签”明确为团队人工整理。[数据范围](https://musicbrainz.org/doc/MusicBrainz_Database)、[数据许可](https://musicbrainz.org/doc/About/Data_License)
- `artist-rels` 包含多种实体关系，乐队成员/师生/合作署名不是同一件事。共同演唱须核到具体录音或发布版本的演唱署名；作曲人、制作人、MV 演员不直接成为演唱边。不同录音/现场版本分别注明。[关系定义](https://musicbrainz.org/doc/Relationships)、[署名规则](https://musicbrainz.org/doc/Style/Artist_Credits)
- 小规模华语专题本轮采用唱片公司、官方频道、官方发行平台逐条人工核对。MBID 可在确切匹配后补入，不能猜 ID，也不宣称已验证 MusicBrainz 的华语覆盖率。

## 本轮窄范围

### 数据和会话

- `map-catalogue.js`：仅真实专题的艺人、作品、边与来源；`real-*` 稳定 ID，作品保留 `versionLabel`、`credits[{artistId,role}]`、`listenLinks[{label,url}]`。
- `map-data.js`：原 a…i、co-*、style-* 原样保留；导出统一字典和按 `dataset` 限定的查询，显式 `songIds` 代替拼接 ID。真实合作边增加 `sourceUrl`、`sourceLabel`、`checkedAt`。风格标签独立注明为人工策展，不进入合作挑战。
- `map.js`：会话增加 `dataset`，缺字段旧局按原 ID 推断为 fictional；版本按数据集固定，旧路径不迁移到真实艺人。新用户默认 real；切专题只恢复对应已有探索或新建，不合并两个图。作品、这一跳、回顾与依据均提供外链。
- `map.css`：专题分段切换、来源与聆听链接，沿用现有视觉。无播放器伪状态、不自动打开外部平台。
- 本轮不改音乐后端。现有 `server/` 继续只服务同场共享；真实 Map 入 Space 的 CTA 为“创建你的同场”，不得称真实艺人参与“回声现场”。

### 与 Space 的集成契约

进入 Space 前保存 `state.space.mapReturnId = session.id`。真实专题导航 payload 为 `{ from:'real-map', intent:'create-room', resumeSessionId:session.id }`，不携带虚构 eventId；返回用 `{ resumeSessionId }` 恢复原局。原情景示例维持原入口。外部官方页面在新标签打开，不改变本局与计步。

## 无需权重/API 密钥也能成立的强交互

1. **边就是一首可去听的歌。** 同屏出现联合演唱者、作品版本、来源和外部入口；保留“主动留下”与“只路过”的区别。
2. **把跨艺人的路径解释成听歌顺序。** 当前有效路径边对应作品序列，回退同步撤销路径；分支记录单独保留。现有挑战即能承载，后续可增加复制作品清单，不必做自动平台歌单。
3. **明确选择探索方向。** 可按“本次没走过的邻居”优先提示，或由用户选终点找一条本专题可达路径。这只是集合过滤/BFS，不把“本次没走过”说成“从未听过”，也不制造口味匹配率。

第二、三项是可继续的小交互方向；本轮首先完成真实数据、来源、外链和历史隔离，不以增加按钮数量取代真实内容。

## AI 和音频边界

当前版本没有模型权重、推理运行时或在线模型调用。球面投影、图连通搜索、标签筛选、共同歌曲比较都是普通算法。音乐模型推理需要实际模型和合法可分析音频，不能由手填风格边代替；自然语言模型同样不是当前已实现能力。

外部官方歌曲/MV 入口可以让用户自行去听，不授权本站复制音频、歌词或封面；链接页面可能需要登录、有地区限制或后来失效。本次只核对发布页/元数据及署名，没有执行视频播放。腾讯音乐官方接口、比赛受限素材与公开曲库许可继续分开管理。

## 收敛判断

优先级：**小真实图谱 + 有据可听 → 两位真实用户走通发现/交换 → 更大曲库或模型。** 11 位艺人不代表完整音乐世界，熟悉作品为主也限制新奇度；它首先证明关系发现机制有真实对象。下一批数据应根据实际用户新发现了谁来扩展，不能靠节点数或 AI 字样证明竞争力。

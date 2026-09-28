# QQ 音乐同版本直达：核对登记

日期：2026-09-29。机器可读结果：[`qq-music-links.json`](qq-music-links.json)。精选网 37 份合作录音中，31 份找到 QQ 音乐同一录音、同一版本的歌曲页；6 份没有，不放入口。

## 核对方法与边界

- **只用本次取回的元数据。** 请求都发往 QQ 网页播放器统一网关 `POST https://u.y.qq.com/cgi-bin/musicu.fcg`：
  - `music.search.SearchCgiService` / `DoSearchForQQMusicDesktop`：歌曲搜索（`search_type 0`，`grp 1` 显示 QQ 折叠在同一录音下的其他发行），少数条目加做专辑搜索（`search_type 2`）。每首用简体、繁体、英文名、专辑名等多组查询。
  - `music.pf_song_detail_svr` / `get_song_detail_yqq`：标题、歌手 mid、专辑 mid、发行日、曲序、时长、版本代码、语言、厂牌。
  - `music.musichallAlbum.AlbumInfoServer` / `GetAlbumDetail` 与 `music.musichallAlbum.AlbumSongList` / `GetAlbumSongList`：专辑类型和完整曲目表。个别条目另查歌词头署名和歌手详情。
  - 2026-09-27 记录的“找不到可靠 QQ 搜索方法”由上述网关接口解决；仍不猜 ID，不用搜索页链接。
- **同一版本的判定。** 两位歌手有署名（例外见下文“署名注意”）；发行与我方 recordingLabel 一致（原专辑曲目、原单曲或同一现场专辑）；版本代码和标记排除 Live、伴奏、纯音乐、DJ / 混音、变速、电台版、独唱版、片段和其他语言版。同一录音有多次发行（合辑、原声带、特别版）时，链接标签写的原发行。
- **两步核对。** 检索者先匹配，复核者独立重取详情和专辑曲目表并尝试反驳；两步都通过才收录。多数条目另用 iTunes lookup、Qobuz、Deezer、Spotify、网易云的曲序和时长互证；现场条目另用 YouTube oEmbed 与新闻报道。
- **页面。** `https://y.qq.com/n/ryqq/songDetail/{songmid}` 均返回 HTTP 200。桌面端跳到 `/n/ryqq_v2/songDetail/{songmid}`，是浏览器渲染的空壳，静态 HTML 没有曲名；未登录的无头浏览器只看到登录弹窗和“加载中”，对照歌曲也一样，不是 ID 错误。曲名用手机 UA 跳转后的服务端页面 `i2.y.qq.com/n3/other/pages/playsong/index.html?songmid=…` 核对（`<title>` 为“曲名 - QQ音乐”）。以后自动检查链接应用手机 UA 或详情接口。
- **没有验证的部分。** 只核元数据：没有播放、试听或下载音频，没有比较音频，没有请求页面里的 `playUrl`。没有在真机、中国大陆网络或登录账号下打开。实际打开时可能要求登录、VIP（如《过》未开通只能试听片段）或受地区限制；iPhone Safari 模拟时被导向 App 下载页。
- **外跳。** 「去 QQ 音乐听」会离开本应用打开 QQ 音乐。这是用户 2026-09-29 的决定，改变了 PRD 的“不外跳”规则（现行产品文档仍写“试听链接已撤下，QQ 音乐同版本直达尚未核实”），**待产品负责人确认**。
- **挂在哪里。** 多数边的播放源是官方 MV，未核对 MV 音频与录音室曲目是否同一剪辑。入口应挂在作品录音（recordingLabel）旁，不挂在 MV 标签旁，并显示 QQ 自己的署名。

## 有同版本直达的录音（31）

链接格式：`https://y.qq.com/n/ryqq/songDetail/{songmid}`。“版本 0”指 QQ 标准版，“版本 3”指现场。

| 作品 | 歌手 | QQ 音乐页面 | 专辑或版本 | 为什么是同一录音 |
| --- | --- | --- | --- | --- |
| 不该 | 周杰伦、张惠妹 | [000sxzol11raSd](https://y.qq.com/n/ryqq/songDetail/000sxzol11raSd) | 《周杰伦的床边故事》第 6 首，2016-06-24，杰威尔 | 两人署名，版本 0，291 秒，无其他版本标记。同录音另见《幻城》原声带（002AFY9402ZoW4，290 秒），按标签选原专辑 |
| 千里之外 | 周杰伦、费玉清 | [003FRy0r0wyGHl](https://y.qq.com/n/ryqq/songDetail/003FRy0r0wyGHl) | 《依然范特西》第 3 首，2006-09-05，杰威尔 | 两人署名，版本 0，256 秒，专辑中唯一一版；歌词分周 / 费 / 合。《K情歌10》等合辑重发未选 |
| 说好不哭 | 周杰伦、阿信 | [001qvvgF38HVc4](https://y.qq.com/n/ryqq/songDetail/001qvvgF38HVc4) | 单曲《说好不哭（with 五月天阿信）》，2019-09-16，杰威尔 | 单曲只此一首，版本 0，222 秒。**署名注意**：歌手栏只有周杰伦，阿信在曲名“with 五月天阿信”中 |
| 等你下课 | 周杰伦、杨瑞代 | [00176bPZ2wu39R](https://y.qq.com/n/ryqq/songDetail/00176bPZ2wu39R) | 《最伟大的作品》第 9 首，2022-07-15，杰威尔 | 版本 0，270 秒；与 2018 单曲 001J5QJL1pRQYB 共用 K 歌 ID 与时长，是同一录音。**署名注意**：歌手栏只有周杰伦，杨瑞代在曲名和 QQ 简介“一起合唱”中 |
| 画沙 | 袁咏琳、周杰伦 | [001tCE0T2vR5p5](https://y.qq.com/n/ryqq/songDetail/001tCE0T2vR5p5) | 《袁咏琳 Cindy》（首张同名专辑），2009-10-30，杰威尔 | 两人署名，版本 0，273 秒，录音室专辑中唯一一版；iTunes 同专辑 274 秒。QQ 记第 1 首、iTunes 记第 2 首，不影响版本 |
| 一眼瞬间 | 张惠妹、萧敬腾 | [004QYBHS1kwnCM](https://y.qq.com/n/ryqq/songDetail/004QYBHS1kwnCM) | 《Star》第 6 首，2007-08-03，爆爆音乐 | 两人署名，版本 0，356 秒；与 Qobuz《STAR》第 6 首 5:56 一致，前后曲目同序。庆功演唱会 Live 版未选 |
| Hello | 萧敬腾、林俊杰 | [003BtUeT4PTqns](https://y.qq.com/n/ryqq/songDetail/003BtUeT4PTqns) | 单曲《Hello (录音室版)》，2020-05-26，华纳 | 单曲只此一首，两人署名，版本 0，277 秒。《歌手·当打之年》Live 版未选 |
| 小酒窝 | 林俊杰、蔡卓妍 | [003h3CYS3UxDB4](https://y.qq.com/n/ryqq/songDetail/003h3CYS3UxDB4) | 《JJ陆》第 3 首，2008-10-18，海蝶 | 两人署名，国语，版本 0，218 秒，歌词头标“国语”。同专辑第 15 首粤语版未选 |
| 被风吹过的夏天 | 林俊杰、金莎 | [0018qunY0L4Bkx](https://y.qq.com/n/ryqq/songDetail/0018qunY0L4Bkx) | 金莎《空气》第 7 首，2005-04-01，海蝶 | 两人署名，版本 0，255 秒，专辑中唯一双人曲目。副标题《最佳前男友》插曲是后加注记，不是另一版本 |
| 手心的蔷薇 | 林俊杰、邓紫棋 | [0038BQfx4MB0MR](https://y.qq.com/n/ryqq/songDetail/0038BQfx4MB0MR) | 《新地球》第 6 首，2014-12-27，JFJ Productions | 两人署名，版本 0，280 秒；iTunes 同为第 6 首、280.05 秒、同日期。特别版与合辑未选 |
| Stay With You（英文版） | 林俊杰、孙燕姿 | [002xmBmi1c2eMG](https://y.qq.com/n/ryqq/songDetail/002xmBmi1c2eMG) | 单曲《Stay With You (英文版)》，2020-08-09，JFJ Productions | 单曲只此一首，两人署名，语言“英语”，207 秒，专辑说明写明两人合作英文版。版本代码 9 含义未确证，但曲名、语言、说明一致 |
| 珊瑚海 | 周杰伦、梁心颐 | [001K0AjL2huSxx](https://y.qq.com/n/ryqq/songDetail/001K0AjL2huSxx) | 《十一月的萧邦》第 10 首，2005-11-01，杰威尔 | 两人署名，版本 0，255 秒；Apple 同为第 10 首、256.3 秒。《下雨天》等重发未选 |
| Try | 周杰伦、派伟俊 | [001faq2u0gVP6j](https://y.qq.com/n/ryqq/songDetail/001faq2u0gVP6j) | 单曲《Try》，2016-01-06，杰威尔 | 单曲只此一首，两人署名，版本 0，240 秒，中英混唱。索尼《功夫熊猫3》原声带（0021WFrW3YdnNW）晚发，未选 |
| 对等关系 | 李荣浩、张惠妹 | [001wG84E4bOj3V](https://y.qq.com/n/ryqq/songDetail/001wG84E4bOj3V) | 《纵横四海》第 5 首（QQ 专辑日期 2022-12-21），一样音乐 | QQ 没有单独的 2021 单曲条目。专辑说明称其为 2021 年末合作单曲，songid 顺序对应 2021 年底，Apple 单曲（2021-12-08）与专辑曲目同为 327.23 秒。界面不要把 2022-12-21 当作本录音发行日 |
| 我有多么喜欢你 | 萧敬腾、林宥嘉 | [003LqdzX0edhb9](https://y.qq.com/n/ryqq/songDetail/003LqdzX0edhb9) | 《欲望反光》第 10 首，2018-06-22，华纳 | 两人署名，版本 0，272 秒。同专辑第 11 首“独唱版”（000RP4Ed3Fup17）同时长、只署萧敬腾，不可互换 |
| 致姗姗来迟的你 | 阿肆、林宥嘉 | [003Iq94Q0SnePV](https://y.qq.com/n/ryqq/songDetail/003Iq94Q0SnePV) | 《我愚蠢的理想主义》第 3 首，2016-10-01，摩登天空 | 两人署名，版本 0，246 秒；Apple、网易云同为第 3 首、约 246 秒 |
| 别勉强 | 邓紫棋、周兴哲 | [00207tA52BLqom](https://y.qq.com/n/ryqq/songDetail/00207tA52BLqom) | 《摩天动物园》第 10 首，2019-12-27，G Nation | 两人署名，版本 0，262 秒，专辑中唯一双人曲目 |
| 爱我的时候 | 周兴哲、单依纯 | [0036P9kz3IG3qu](https://y.qq.com/n/ryqq/songDetail/0036P9kz3IG3qu) | 单曲《爱我的时候》第 1 首，2021-02-09，制作家 | 两人署名，国语，版本 0，224 秒。同单曲第 3 首（001PkQEj2FJvjR）同名同署名但语言为“纯音乐”，第 2 首是伴奏，都不可用 |
| 温柔 #MaydayBlue20th | 五月天、孙燕姿 | [000qzndv3RJUjM](https://y.qq.com/n/ryqq/songDetail/000qzndv3RJUjM) | 单曲《温柔 #MaydayBlue20th》，2020-01-01，相信音乐 | 单曲只此一首，两人署名，版本 0，271 秒；Apple 单曲 271.02 秒、同日期、同厂牌 |
| 私奔到月球 | 阿信、陈绮贞 | [000EZEV00EZCHo](https://y.qq.com/n/ryqq/songDetail/000EZEV00EZCHo) | 《离开地球表面 Jump!》第 1 首，2007-07-20，相信音乐 | 版本 0，226 秒；Apple 同为第 1 首、3:46、同日期。**署名注意**：QQ 写五月天（乐团）/ 陈绮贞；本边按 2026-09-28 已核的 Apple / Spotify 逐轨演唱署名“五月天 阿信”接到阿信 |
| （......醉鬼阿Q） | 吴青峰、孙燕姿 | [001LID6n1Szd9Z](https://y.qq.com/n/ryqq/songDetail/001LID6n1Szd9Z) | 《马拉美的星期二》第 8 首，2022-09-30，哈里坤的狂欢 | 两人署名，版本 0，216 秒；与 2022 单曲 003hfx1A3MavCH 的 FLAC 字节数完全相同，是同一母带。按标签“第 8 首”选专辑曲目，单曲页同样可用 |
| 今天你要嫁给我 | 陶喆、蔡依林 | [0008aOkA3v4X0Q](https://y.qq.com/n/ryqq/songDetail/0008aOkA3v4X0Q) | 陶喆《太美丽》第 10 首，2006-08-04，金牌大风 | 两人署名，版本 0，272 秒，专辑中唯一对唱。291 秒的《情歌对唱大集合》版未选 |
| 我是谁 | 蔡依林、Jony J | [003PzotY0CRLex](https://y.qq.com/n/ryqq/songDetail/003PzotY0CRLex) | 《狼殿下 影视原声碟》第 1 首，2020-11-22 | 两人署名，版本 0，239 秒；Apple 原声带第 1 首 239.3 秒，9 首同序（Apple 日期 2020-12-24） |
| 再也没有你 | 梁心颐、陈势安 | [002XUx9q3uv72w](https://y.qq.com/n/ryqq/songDetail/002XUx9q3uv72w) | 《来者何人{}》第 1 首，2021-09-14，新湃传媒（NSMG） | 两人署名，版本 0，275 秒；Apple 同为第 1 首、275.87 秒、NSMG。同专辑伴奏（004NNGsr0flynN）不可用 |
| 凡人歌 | 五月天、萧敬腾 | [000X6Og627LKMd](https://y.qq.com/n/ryqq/songDetail/000X6Og627LKMd) | 单曲《凡人歌》，2017-03-21，相信音乐 | 单曲，两人署名，版本 0，291 秒；Apple 单曲 291.71 秒。两边都未标录音室或现场，与我方标签一致 |
| 别说没爱过 (Live) | 林宥嘉、周兴哲 | [002idxL60z9ORp](https://y.qq.com/n/ryqq/songDetail/002idxL60z9ORp) | 现场专辑《声生不息·华流季 第7期》第 5 首，2026-01-02，环球音乐X芒果TV | 版本 3，两人署名，234 秒；Apple《第7期 Live》同为第 5 首、234.9 秒，8 首同序 |
| 你不是真正的快乐 + 天空 | 五月天、蔡依林 | [001tKUw30RmbDH](https://y.qq.com/n/ryqq/songDetail/001tKUw30RmbDH) | 《Life Live 好友加班篇》第 3 首，2019-05-15，相信音乐 | 版本 3，两人署名，262 秒；Apple 同专辑同曲 262 秒。对应的是专辑现场录音，未核对是否即北京 no.106 官方影片那一场 |
| 离开地球表面 (Life Live) | 五月天、李荣浩 | [003kIzSf0LkDco](https://y.qq.com/n/ryqq/songDetail/003kIzSf0LkDco) | 《Life Live 好友加班篇》第 5 首，2019-05-15，相信音乐 | 版本 3，两人署名，291 秒；Apple 同曲 291.5 秒。完整收录篇的乐团现场（217 秒）未选。同样未核对是否即上海 no.100 影片那一场 |
| 爱我还是他 | 林俊杰、陶喆 | [003Pfh2Z4UdNF4](https://y.qq.com/n/ryqq/songDetail/003Pfh2Z4UdNF4) | “2024JJ20世界巡回演唱会重庆站现场”，**无专辑** | 版本 3，两人署名，301 秒。凤凰网报道陶喆只在 11-03 收官场登台并合唱此曲，与官方影片 WGVE2bi4viE 是同一场演出；混音是否一致未核。**例外**：无专辑、日期、厂牌，需产品负责人确认可接受 |
| 双影 | 张惠妹、林忆莲 | [000P5BUK4HpaLo](https://y.qq.com/n/ryqq/songDetail/000P5BUK4HpaLo) | 单曲《双影》，2018-08-20（QQ 厂牌爆爆音乐） | 单曲只此一首，两人署名，版本 0，276 秒，歌词按 aMEI / Sandy 分段；Apple 单曲 276.47 秒、℗ EMI、同日期，厂牌差异视为大陆发行方 |
| 过 | 王嘉尔、林俊杰 | [003vjg9A0VCFfh](https://y.qq.com/n/ryqq/songDetail/003vjg9A0VCFfh) | 单曲《过》第 1 首，2020-12-18，TEAM WANG records | 两人署名，版本 0，203 秒；Apple / Deezer 同为 203 秒。同单曲第 2 首是伴奏 |

## 没有同版本直达的录音（6）

| 作品 | 歌手 | 状态 | 原因 |
| --- | --- | --- | --- |
| 黑暗骑士 | 林俊杰、阿信 | 待确认 | 录音一致：《因你 而在》第 3 首 001tzPHJ436zJl（版本 0，304 秒）。但 QQ 演唱署名是林俊杰 / 五月天（乐团），阿信只作为作词人出现。2026-09-28 的扩网记录已写明《黑暗骑士》的阿信映射未重核，五月天与阿信的节点规则待产品负责人统一确认；确认前不放入口 |
| 稻香 / Stay With You | 周杰伦、林俊杰 | 无同版本 | QQ 没有 2020 致敬白衣天使公益云演唱会的二人完整联唱。001V1IIS2SDlpJ 只有《稻香》段（175 秒），且无专辑、日期和厂牌 |
| 给我一首歌的时间（超时代现场） | 周杰伦、蔡依林 | 无同版本 | QQ 官方现场专辑《The Era 2010 超时代演唱会》24 首中没有此曲；唯一同署名的 0019C6vR2iM3N3 无专辑、日期和厂牌，无法对应 DVD / Blu-ray 录音 |
| 屋顶 | 温岚、周杰伦 | 无同版本 | QQ 的《有点野》只有第 1–10 首，缺第 11 首。《爱回温》精选里的 003oF0Pc0ahSx4（319 秒）很可能是同一母带，但发行不是《有点野》；是否接受精选重发待产品决定 |
| 后来的我们（现场） | 五月天、张惠妹 | 无同版本 | 我们的是 2018 鸟巢 Life Tour 北京 no.105 官方影片，未见音频发行。QQ 唯一同署名的 002CEGy10mjQuV 标题写 2017 北京站，且无专辑；《好友加班篇》没有这首 |
| 年少有为（现场） | 林俊杰、李荣浩 | 无同版本 | 我们的是 2023 JJ20 南宁站官方视频。QQ 唯一同署名的 000ehIIj3LuMIw 无专辑、日期、厂牌，标题不写场次，无法确认是南宁站 |

## 接入前要处理的数据问题

- `real-who-do-you-love-live` 的 recordingLabel 写“未见音频发行”，放入口后应改为“QQ 音乐有同场现场音轨（无专辑）”。
- `real-bu-gai` 的 sourceLabel 写《幻城》原声带，recordingLabel 写《周杰伦的床边故事》；QQ 链接跟 recordingLabel，sourceLabel 应统一。
- `real-marry-me-today` 在 `web/js/map-catalogue.js` 中没有 recordingLabel，“《太美丽》第 10 首”只在 `references/research/2026-09-28/network-expansion.json`。
- `real-leave-the-earth-live` 与 `real-not-truly-happy-sky-live` 一样，影片和专辑曲目未核对是否同一场，应补同样的说明。
- `real-dark-knight` 的歌词头写编曲林俊杰 / 五月天、制作人林俊杰，目录只写“编曲 五月天”。

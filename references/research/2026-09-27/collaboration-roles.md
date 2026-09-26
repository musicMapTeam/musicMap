# 合作作品：逐人制作署名

日期：2026-09-27。实现：`web/js/map-catalogue.js`、`web/js/map.js`、`web/css/map-credits.css`。真实精选数据版本更新为 `real-vocal-2026-09-v2`。

## 采用规则

- 保留原 11 位图节点、10 首作品、10 条 `real-co-*` 边及各自稳定 ID。图中边仍表示两位艺人的**共同演唱**，作曲、制作、录音等署名放在作品中，不冒充共唱边。
- 本次逐首读取原有 10 个官方 MV 的公开发布说明；浏览工具无法展开说明时，读取同一公开页面的 `shortDescription`。只提取事实性人员 / 工种，不保存歌词、视频或音频。
- 官方说明优先。缺少制作名单时补充 Qobuz、Shazam、JOOX、LINE MUSIC 的对应作品发行元数据，并在每个工种上保留来源。发行平台署名是本轮采用的记录，不能声称已经比对原版实体内页。
- `creditsScope: 'selected-verified'` 表示已核实的一部分署名，不承诺完整制作名单。来源没有列出某工种时不填，未列出某人不表示此人未参与。
- 事实性姓名统一为简体；仅有英文署名的部分人员保留来源写法。英文 `Sound Engineer` 保留为“音响工程”，不擅自细分成录音或混音。音频制作与 MV 导演 / 摄影分开，本轮只补音频制作。

## 各作品核对结果

下列记录是内容选择摘要；逐工种的实际来源在数据文件 `credits[].sourceId` 与 `creditSources[]` 中逐条关联。

| 作品 | 已补充的主要分工 | 采用来源 |
| --- | --- | --- |
| 不该 | 周杰伦作曲、制作；方文山作词；黄雨勋编曲、吉他；陈柏州鼓；杨大纬混音；杨瑞代、钟潍宇录音；来源列出的 12 位弦乐演奏者分别署名 | 原杰威尔共唱依据 + [Shazam 发行制作署名](https://www.shazam.com/zh-tw/song/1721456390/不該-feat-張惠妹)，对应《周杰伦的床边故事》 |
| 千里之外 | 周杰伦作曲、制作；方文山作词；林迈可编曲、混音；杨瑞代录音 | [官方 MV 发布说明](https://www.youtube.com/watch?v=ocDo3ySyHSI)核对词曲及合唱；[Qobuz《依然范特西》第 3 曲](https://www.qobuz.com/nl-nl/album/-/ilpon2h36u7vc)补录音制作。不是费玉清独唱版 |
| 说好不哭 | 周杰伦作曲、制作；方文山作词；黄雨勋编曲、混音；杨瑞代、李汪哲录音；阿信的演唱署名只指本人 | [官方 MV 发布说明](https://www.youtube.com/watch?v=HK7SPnGSxLM) + [Qobuz 2019 单曲](https://www.qobuz.com/nl-nl/album/-/n1w0llg9xtasa) |
| 等你下课 | 周杰伦作词、作曲、制作；黄雨勋编曲；杨瑞代共同演唱 | [杰威尔单曲发布说明](https://www.jvrmusic.com.tw/artist/news/detail/1152141405221687296?lang=zh_CN)明确词曲均为周杰伦；[Shazam《最伟大的作品》署名](https://www.shazam.com/zh-tw/song/1721450095/等你下課)补编曲、制作。没有因为杨瑞代平时是录音师就给他添加本曲录音工种 |
| 画沙 | 袁咏琳作曲、制作；方文山作词；周杰伦人声编排；黄雨勋编曲；杨瑞代、柯宗佑、苏正成录音；杨大纬混音 | [袁咏琳官方 MV](https://www.youtube.com/watch?v=rSojry19bOA)说明本人谱曲、方文山作词；[Shazam 同名专辑署名](https://www.shazam.com/zh-tw/song/1721885585/畫沙)补制作分工 |
| 一眼瞬间 | 曹格作曲；邬裕康作词；吴庆隆编曲；马毓芬制作；钟国泰混音、音响工程；叶育轩音响工程 | 原华纳官方共唱依据 + [Qobuz《STAR》第 6 曲](https://www.qobuz.com/it-it/album/star/fuy5qlvvzxxua) |
| Hello | 萧敬腾、林俊杰共同作曲、制作、配唱制作、和声编写 / 演唱、母带制作；萧敬腾钢琴、林俊杰录音；奶六作词；黄冠龙、阿火编曲 / 键盘 / 弦乐编写；另逐人收录演奏、录音、混音、母带和助理 | [萧敬腾官方 MV 发布说明中的录音室制作名单](https://www.youtube.com/watch?v=dmhhfSkC-Kg)。采用录音室版，不把《歌手》现场演奏名单混入 |
| 小酒窝 | 林俊杰作曲；王雅君作词；林俊杰、蔡卓妍演唱 | [太合官方 MV 发布说明](https://www.youtube.com/watch?v=h-woMj_Vt0A)，明确国语《JJ 陆》版。其他录音制作分工暂不补，见下方差异记录 |
| 被风吹过的夏天 | 林俊杰作曲、编曲；冯欣慧作词；毕晓世制作；林俊杰、金莎演唱 | [太合官方 MV 发布说明](https://www.youtube.com/watch?v=JbFrE_UbVyI)核对词曲与《空气》版本；[JOOX 同版署名](https://www.joox.com/hk/single/TqpRxYVbhHXJMZnSvtT43g%3D%3D)补编曲与制作 |
| 手心的蔷薇 | 林俊杰作曲、制作；林怡凤作词；Terence Teo 编曲；Brendan Buckley 鼓 / 录音；来源列出的指挥、第一小提琴、录音人员和制作助理各自署名 | 原华纳专辑共唱依据 + [LINE MUSIC《新地球》词曲署名](https://music-tw.line.me/track/1217180006) + [Shazam 同曲发行署名](https://www.shazam.com/song/1788007693/beautiful-feat-gem) |

## 版本差异与未采用项

- 《小酒窝》的一个 [Shazam 页面](https://www.shazam.com/song/543167471/e5b08fe98592e7aaa9-feat-e894a1e58d93e5a68d) 把 `Written by` 列作陈少琪，与本项目所选国语官方 MV 的王雅君署名不符。本轮按官方国语版记录王雅君，不合并该页面词曲信息。
- 找到 [JOOX《小酒窝》页面](https://www.joox.com/hk/single/WZtYc3AyMWCPmPrnIwH8oA%3D%3D)，列出林俊杰 / 吴剑泓编曲、许环良监制，但页面发行时间为 2020-06-01；此次没有继续核到该发行与 2008 专辑录音的同一性，故不将这些工种直接挂到现有作品中。
- 同名作品、演唱会版本、重制版、翻唱版、艺人履历中的一般职业都不能用来补当前录音的署名。
- 没有使用 Hugging Face 数据来推断详细工种。HF 的共同 artist 字段和这里的人工核验制作署名分开，用户可从地图顶部进入“开放曲库”。

## 音乐链接决定

用户要求 QQ 音乐优先，也允许不贴音乐链接。本轮将 10 首 `listenLinks` 全部置空，去掉 YouTube“去听”按钮，`audioAvailable` 保持 `false`。

作品署名旁的来源数字与“署名来源”仍能打开取证页面，其中部分为艺人官方 YouTube 发布说明。它们用于查看证据，不作为播放功能。QQ 音乐同版本直达链接尚未确认；没有猜 `songmid`、把搜索页标作歌曲页，也没有转用另一个海外播放器。

## 数据结构与界面

```js
// 保持原 credits[].artistId / role 可读；幕后人员允许没有图节点。
{
  credits: [
    { artistId: 'real-jay', name: '周杰伦', role: '演唱', sourceId: 'vocal' },
    { name: '方文山', role: '作词', sourceId: 'release' }
  ],
  creditSources: [{ id: 'release', label: '发行制作署名', url: '...', checkedAt: '2026-09-27' }],
  creditsScope: 'selected-verified',
  recordingLabel: '对应专辑与录音版本',
  creditSummary: '供主界面显示的短署名',
  listenLinks: [],
  listenStatus: 'qq-unverified',
  audioAvailable: false
}
```

主界面仅显示一行词曲 / 制作摘要。点击作品名或当前合作的“谁做了什么”打开按人的署名表；同一个人的多个工种归到同一行，各工种保留自己的来源数字。艺人作品、连接来源弹窗按作品折叠名单，完整来源与核对边界按需展开。原收藏、探索路线、共唱挑战逻辑保持原含义。

此子任务没有运行测试、构建或浏览器操作；最终整合由主任务记录。

# 合唱关系网扩展：来源登记

核对日期：2026-09-28。数据文件：`network-expansion.json`（`graphVersion: real-vocal-2026-09-v2`，按任务指定填写）。在现有 12 位艺人、13 条作品边的基础上新增 **17 位艺人、24 份共同演唱录音**，合计 **29 位艺人、37 条作品边**，全部落在包含周杰伦的同一连通分量内，没有因不连通而剔除的边。本文件只登记资料，没有修改 `web/js/map-catalogue.js`。

## 核对方法与边界

- **HF 数据只作线索。** 24 份录音中有 15 份在本地 HF CSV（固定提交 `635b034f…`）中能找到同曲共同署名行，但 HF 行不作为证据。反例有两个：HF 把《布拉格广场》记为 `Jolin Tsai;Jay Chou`，经核对不成立；HF 把《私奔到月球》记为 `Mayday;Cheer Chen`，逐轨演唱署名其实是阿信本人。`hfNames` 只填写 CSV 中真实出现的姓名字符串。
- **证据只采用 2026-09-28 实际取回的官方来源**：唱片公司或艺人官网与新闻稿、官方 YouTube 频道（用 oEmbed 核对标题与作者）、主要商店的发行元数据（Apple Music、Spotify、Deezer、LINE MUSIC、QQ 音乐、网易云音乐）、以及有来源说明的新闻报道。每条边都经过研究与独立复核两轮，两轮都通过才采用。维基百科、百度百科、Discogs、MusicBrainz 只用来找线索。
- **合作边只依据演唱署名。** 作词、作曲、制作、编曲、演奏、和声、旁白、MV 出演都只记入工种表，不建立边。
- **现场版按特定录音登记**，不把录音室原版改写成合唱。《给我一首歌的时间》《后来的我们》《年少有为》《爱我还是他》的原版都是独唱，这里各自只对应一份现场录音。
- **乐团与个人分开。** 新增乐团节点 `real-mayday`（五月天），只用于署名为整团的演唱；`real-ashin` 仍是阿信本人。《私奔到月球》的官方 MV 标题写的是「Mayday五月天＋陳綺貞」，但 Apple Music 和 Spotify 的逐轨演唱署名都是「五月天 阿信」，所以这条边接到阿信本人。《黑暗骑士》现有的阿信映射本轮没有重新核对；五月天和阿信的节点规则需要产品负责人统一确认。
- **未核对的内容：**
  - 没有播放或下载任何音视频、歌词、封面；元数据可读不等于可以播放。
  - 没有逐秒比对官方现场影片与现场专辑音轨是否来自同一场。
  - 没有核验地区或账号条件下能否播放。
  - KKBOX 页面返回空内容，没有使用。
  - YouTube 观看页被登录墙拦截（LOGIN_REQUIRED），说明文字改从页面 `ytInitialData` 的 `attributedDescription` 读取。
- **整合时复查（2026-09-29）：**
  - 重新请求了 JSON 中全部 74 个网址。24 个 YouTube 链接的 oEmbed 标题与作者和登记一致；其余网址都返回 HTTP 200。
  - 逐项检索了关键署名文字，均与登记一致，例如「給我一首歌的時間 (特別來賓蔡依林)」「共同演唱」「男女對唱」「吳青峰與孫燕姿合唱新歌」、Deezer 的两个 `Main`。
  - 网易云专辑接口已要求绑定手机（code -462），改用同一首歌的歌曲资料接口，结果仍为「周杰伦、蔡依林」。

## 采用的共同演唱录音（24 份）

| 作品 | 两位共同演唱者 | 关系依据 | 版本 |
| --- | --- | --- | --- |
| 给我一首歌的时间 | 周杰伦、蔡依林 | [索尼《超时代演唱会》Blu-ray 页](https://www.sonymusic.com.tw/album/%e8%b6%85%e6%99%82%e4%bb%a3%e6%bc%94%e5%94%b1%e6%9c%83-blu-ray-%e5%91%a8%e6%9d%b0%e5%80%ab-jay-chou-88697893959/)曲目为「(特別來賓蔡依林)」；[DVD 页](https://www.sonymusic.com.tw/album/%e8%b6%85%e6%99%82%e4%bb%a3%e6%bc%94%e5%94%b1%e6%9c%83-dvd-%e5%91%a8%e6%9d%b0%e5%80%ab-jay-chou-88697840779/)写「重現雙J合唱共舞」；[网易云](https://music.163.com/api/song/detail/?ids=%5B34923732%5D)同列两人 | 2010 超时代台北现场，2011 年影像发行；不是《魔杰座》独唱原版 |
| 屋顶 | 温岚、周杰伦 | [Apple Music](https://music.apple.com/tw/song/%E5%B1%8B%E9%A0%82/1441626752)「演出艺人」栏两人均为「演唱」；[发行元数据](https://www.youtube.com/watch?v=lG-TIlf-Yxo)标题为「屋頂 (男聲: 周杰倫)」 | 《有点野》2001 录音室版；与吴宗宪×温岚版是不同录音 |
| 珊瑚海 | 周杰伦、梁心颐 | [周杰伦官方 MV](https://www.youtube.com/watch?v=kYhh1PpsOg4)署名 feat. 梁心頤，说明称是男女对唱；[Apple Music](https://music.apple.com/tw/song/%E7%8F%8A%E7%91%9A%E6%B5%B7-feat-%E6%A2%81%E5%BF%83%E9%A0%A4/536009751)两人均为「演唱」 | 《十一月的萧邦》录音室版 |
| Try | 周杰伦、派伟俊 | [杰威尔新闻](https://www.jvrmusic.com/news/detail/1167014680858857472?lang=en_US)写明两人「共同演唱」；[官方 MV](https://www.youtube.com/watch?v=iJPfSSpnR8g) | 2016《功夫熊猫3》主题曲单曲；周杰伦另署监制 |
| 对等关系 | 李荣浩、张惠妹 | [华纳台湾新闻稿](https://www.warnermusic.com.tw/blog/posts/%E6%9D%8E%E6%A6%AE%E6%B5%A9-%E5%BC%B5%E6%83%A0%E5%A6%B9-%E9%9C%87%E6%92%BC%E5%90%88%E4%BD%9C-%E5%85%A8%E6%96%B0%E5%96%AE%E6%9B%B2-%E5%B0%8D%E7%AD%89%E9%97%9C%E4%BF%82-128-%E5%85%A8%E9%9D%A2%E4%B8%8A%E7%B7%9A-%E6%AD%8C%E8%A9%9E-%E7%B7%9A%E4%B8%8A%E8%81%BD-1)称「男女對唱」并按歌手分段；[官方 MV](https://www.youtube.com/watch?v=mQUek1GYfvs) | 2021 单曲录音室版 |
| 我有多么喜欢你 | 萧敬腾、林宥嘉 | [华纳提供的发行元数据](https://www.youtube.com/watch?v=7qD33oIu8ek)写「Featured Vocals: Yoga Lin」；[华纳曲目表](https://www.warnermusic.com.tw/products/test)与独唱版分列（网址 slug 为 `test`，可能变动） | 2018 合唱录音室版，不是《独唱版》 |
| 致姗姗来迟的你 | 阿肆、林宥嘉 | [Apple Music](https://music.apple.com/tw/album/%E8%87%B4%E5%A7%8D%E5%A7%8D%E4%BE%86%E9%81%B2%E7%9A%84%E4%BD%A0/1808448710?i=1808449151)署名「阿肆 & 林宥嘉」；QQ 音乐、网易云同列两人 | 《我愚蠢的理想主义》录音室版；没有找到官方 MV |
| 别勉强 | 邓紫棋、周兴哲 | [邓紫棋官方 MV](https://www.youtube.com/watch?v=6XSoVmT0qXo)说明写男声由周兴哲合唱；[索尼专辑页](https://www.sonymusic.com.tw/album/g-e-m-city-zoo/)为「with 周興哲」 | 《摩天动物园》录音室版 |
| 爱我的时候 | 周兴哲、单依纯 | [周兴哲官方 MV](https://www.youtube.com/watch?v=bG563p_moiE)署名「周興哲 × 單依純」，说明写两人「共同演繹」 | 2021 单曲原版 |
| 温柔 #MaydayBlue20th | 五月天（乐团）、孙燕姿 | [相信音乐官方 MV](https://www.youtube.com/watch?v=7h9uEUvQjcs)的「音樂演出」栏为「五月天 Mayday + 孫燕姿」；[相信音乐新闻](https://www.bin-music.com.tw/news/1123) | 2020 新编曲单曲；不是 2000 年原版 |
| 私奔到月球 | 阿信、陈绮贞 | [Apple Music](https://music.apple.com/tw/song/1081738609)把「五月天 阿信」和陈绮贞都列为「演唱」；[Spotify](https://open.spotify.com/embed/track/2kj7VCRJKrAkrOs6tcjrM7)同列两人 | 《离开地球表面》2007 录音室版 |
| （......醉鬼阿Q） | 吴青峰、孙燕姿 | [环球台湾新闻](https://umusic.com.tw/news_page.php?q=1666766191)写「吳青峰與孫燕姿合唱新歌」；[UMG 发行元数据](https://www.youtube.com/watch?v=9RwvtMdTNNw)把两人都署为 Vocalist | 2022 录音室版（单曲；另收于《马拉美的星期二》） |
| 今天你要嫁给我 | 陶喆、蔡依林 | [华纳经典频道官方 MV](https://www.youtube.com/watch?v=WRwarsqzZ_M)署名 feat. 蔡依林；[Apple Music](https://music.apple.com/tw/album/%E4%BB%8A%E5%A4%A9%E5%A6%B3%E8%A6%81%E5%AB%81%E7%B5%A6%E6%88%91-feat-%E8%94%A1%E4%BE%9D%E6%9E%97/905198155?i=905198184)（℗ Gold Typhoon Taiwan） | 《太美丽》2006 录音室版 |
| 我是谁 | 蔡依林、Jony J | [华纳台湾官方 MV](https://www.youtube.com/watch?v=QJCpDCHqDuU)说明写「由蔡依林與 Jony J 合唱」「領銜主唱」 | 《狼殿下》原声带录音室版；Jony J 唱 Rap 段落 |
| 再也没有你 | 梁心颐、陈势安 | [NSMG 官方 MV](https://www.youtube.com/watch?v=NH2JvK2t9nU)署名 feat. 陈势安，说明写「首度合唱情歌」 | 2021 录音室版 |
| 凡人歌 | 五月天（乐团）、萧敬腾 | [相信音乐官方 MV](https://www.youtube.com/watch?v=OsUr8N7t4zc)署名 feat.蕭敬騰；[Spotify](https://open.spotify.com/embed/track/3M6DkD5SjZ140lf7V6OxPz)分列 Mayday、Jam Hsiao | 2017 单曲，翻唱李宗盛；来源对录音室或现场的说法不一致，不作标注 |
| 别说没爱过 (Live) | 林宥嘉、周兴哲 | [Apple Music](https://music.apple.com/tw/album/%E5%88%A5%E8%AA%AA%E6%B2%92%E6%84%9B%E9%81%8E-live/1866486278?i=1866486481)署名「林宥嘉 & 周興哲」；QQ 音乐同列两人（环球音乐X芒果TV）；[芒果TV 官方片段](https://www.youtube.com/watch?v=d2owNH6AQ9A) | 《声生不息·华流季》第 7 期现场版；韦礼安原曲不建边 |
| 后来的我们 | 五月天（乐团）、张惠妹 | [相信音乐官方现场影片](https://www.youtube.com/watch?v=t1nB8xMdiww)写「演唱 / aMEI+五月天」；[镜周刊](https://www.mirrormedia.mg/story/20180826ent005)称男女合唱版 | 2018 北京 no.105 现场，只有影像，未见音频发行 |
| 你不是真正的快乐 + 天空 | 五月天（乐团）、蔡依林 | [相信音乐官方现场影片](https://www.youtube.com/watch?v=gFxuJqdJW5E)写「演唱 / 蔡依林+五月天」；[Apple《Life Live 好友加班篇》](https://music.apple.com/hk/album/1463565278)也以 feat. 蔡依林 收录 | 两曲联唱现场，按一份录音登记；未核对影片与专辑音轨是否同一场 |
| 离开地球表面 | 五月天（乐团）、李荣浩 | [相信音乐官方现场影片](https://www.youtube.com/watch?v=d3JVkes8o4k)写「演唱 / 李榮浩+五月天」；[Apple Music](https://music.apple.com/hk/song/1463565284) 以 feat. 李榮浩 收录 | 《Life Live 好友加班篇》现场合唱版；不是乐团独唱现场版或 2007 原版 |
| 年少有为 | 林俊杰、李荣浩 | [林俊杰官方现场视频](https://www.youtube.com/watch?v=LLyAiDCYQgM)说明写邀请李荣浩合唱；[中华网报道](https://m.tech.china.com/hea/article/20231212/122023_1454771.html) | JJ20 南宁站现场，只有影像；演出日期 2023-12-09 来自报道 |
| 爱我还是他 | 林俊杰、陶喆 | [林俊杰官方现场视频](https://www.youtube.com/watch?v=WGVE2bi4viE)写收官场同台；[凤凰网](https://ah.ifeng.com/c/8eGaT2PLST0)写「两人合唱」 | JJ20 重庆站 2024-11-03 现场，只有影像 |
| 双影 | 张惠妹、林忆莲 | [张惠妹官方 MV](https://www.youtube.com/watch?v=IRwFrOKpRbc)署名「aMEI x Sandy」，说明称两人首度合唱；[环球台湾发行链接](https://lnk.to/aMEI_Shadow) | 2018《如懿传》主题曲录音室版 |
| 过 | 王嘉尔、林俊杰 | [Apple Music](https://music.apple.com/tw/album/%E9%81%8E/1544425146)署名「Jackson Wang & 林俊傑」；[Deezer](https://api.deezer.com/track/1176813952) 两人均为 Main | 2020 单曲录音室版；原 avex 官方 MV 已 404，所以没有视频 |

工种只列来源中能核实的部分（`creditsScope` 应沿用 `selected-verified`）。有几处特别记录：
- 杨瑞代在《珊瑚海》中只署名为工程师，不建边。
- 李雅微、詹宏业、林依霖等人的和声不建边。
- 《我是谁》的作词：华纳 MV 说明写梁锦兴、Jony J，Apple 写 Jony J、黄晟峰。本文件按唱片公司的说明登记。

## 未采用或无法核实

| 候选 | 结论 | 原因 |
| --- | --- | --- |
| 布拉格广场（周杰伦 × 蔡依林） | 不成立 | 索尼专辑页、官方 MV、Apple、Spotify 以及索尼 2014 年合唱合辑都只署名蔡依林演唱，周杰伦是作曲与制作。改用上表的超时代现场版 |
| （……恋人絮语）（吴青峰 × 林嘉欣） | 不成立 | 林嘉欣只署名 Special Guest 和「法文旁白 OS」，旁白不算共同演唱 |
| （……小小牧羊人）（吴青峰 × 微光古乐集） | 不成立 | 乐团署名为 Special Guest / 管弦乐团，成员对应古乐器；合音由吴青峰本人署名 |
| 热爱就一起（林俊杰 × 王嘉尔 × 邓紫棋） | 未核实 | 没有取得官方来源，本轮没有研究 |
| 可惜没如果、修炼爱情（JJ20 南宁 / 重庆嘉宾段落） | 未登记 | 只有报道或粉丝视频，没有官方发布 |
| 疼爱 feat. 萧敬腾、离开地球表面 + 三天三夜 feat. aMEI（五月天现场） | 未登记 | 这两对艺人已经有更直接的录音，这两条仅作备用线索 |
| 就是爱你 feat. 林俊杰（陶喆官方频道 327 现场） | 备用 | 复核时 oEmbed 已确认，本轮以《爱我还是他》登记同一对艺人 |

## 结果网络

- **规模**：29 位艺人、37 条作品边，只有一个连通分量。圈秩为 37 − 29 + 1 = 9，即 9 个独立回路；位于回路上的艺人（2-core）有 13 位；叶节点 15 个。
- **直径 6**：陈势安—阿肆、陈势安—单依纯、Jony J—单依纯。半径 3，中心为林俊杰。
- **406 对艺人的最短距离分布**：1 步 37 对，2 步 117 对，3 步 153 对，4 步 73 对，5 步 23 对，6 步 3 对。
- **度数**：
  - 林俊杰 10、周杰伦 10
  - 张惠妹 5、五月天 5
  - 蔡依林 4、萧敬腾 4
  - 阿信 3、林宥嘉 3、李荣浩 3、孙燕姿 3、周兴哲 3
  - 陶喆 2、邓紫棋 2、梁心颐 2
  - 其余 15 位各 1：费玉清、杨瑞代、袁咏琳、蔡卓妍、金莎、温岚、派伟俊、陈绮贞、吴青峰、单依纯、阿肆、Jony J、陈势安、林忆莲、王嘉尔
- **代表回路**（原有的周杰伦—阿信—林俊杰三角保留）：
  1. 张惠妹 →（后来的我们）五月天 →（凡人歌）萧敬腾 →（一眼瞬间）张惠妹
  2. 张惠妹 →（后来的我们）五月天 →（离开地球表面）李荣浩 →（对等关系）张惠妹
  3. 林俊杰 →（爱我还是他）陶喆 →（今天你要嫁给我）蔡依林 →（给我一首歌的时间）周杰伦 →（联唱）林俊杰
  4. 林俊杰 →（Stay With You 英文版）孙燕姿 →（温柔）五月天 →（离开地球表面）李荣浩 →（年少有为）林俊杰
  5. 萧敬腾 →（我有多么喜欢你）林宥嘉 →（别说没爱过）周兴哲 →（别勉强）邓紫棋 →（手心的蔷薇）林俊杰 →（Hello）萧敬腾
- **录音类型**：
  - 录音室版 16 份。
  - 《凡人歌》1 份，是单曲，没有标注录音室或现场。
  - 现场版 7 份。其中 4 份有音频发行或音轨：给我一首歌的时间、你不是真正的快乐 + 天空、离开地球表面、别说没爱过。另外 3 份只有官方影像：后来的我们、年少有为、爱我还是他。
- **对现有回合的影响**：张惠妹→孙燕姿缩短为 2 步（经五月天）；费玉清→邓紫棋、袁咏琳→萧敬腾、杨瑞代→金莎、蔡卓妍→费玉清都是 3 步，仍满足「至少 2 步」。

## 内容风险

- **排除名单**：黄明志（Namewee）、吴亦凡（Kris Wu）、明日花綺羅。这是产品决定，暂不收录，待产品负责人确认；本轮候选中没有他们，也没有为他们建立节点。复核的 24 首作品中没有发现政治敏感内容，内容都是情歌、影视主题曲或翻唱。
- **待负责人决定：李荣浩。** 他不在排除名单上，本文件照常收录。但[中國報 2026-08-05 报道](https://www.chinapress.com.my/20260805/%E3%80%8A%E5%B0%8F%E7%9C%BC%E7%9D%9B%E3%80%8B%E6%97%8B%E5%BE%8B%E7%96%91%E6%8A%84%E8%A2%AD%E5%B9%B3%E4%BA%95%E5%9D%9A%E3%80%80%E6%9D%8E%E8%8D%A3%E6%B5%A9%E9%81%AD%E7%89%88%E6%9D%83%E6%9C%BA%E6%9E%84/)称：
  - 他作曲、蔡淳佳演唱的《小眼睛》因与平井坚《Signal》相似，被 MCSC、MUST、CASH 等机构移除作曲人署名。
  - 这与本图的三首作品无关。
  - 若决定排除他，要删掉 3 条边。删后网络仍连通：28 人、34 条边、7 个独立回路，直径仍为 6，下列 7 个回合的步数不变。
- **表述注意**：
  - 周杰伦 × 蔡依林的报道常带绯闻叙事，界面只陈述演出和署名。
  - 《我是谁》中 Jony J 唱的是 Rap 段落，唱片公司称之为「合唱」。

## 推荐寻声回合

| 起点 → 终点 | 最短步数 | 最短路径数 | 示例路径 |
| --- | ---: | ---: | --- |
| 费玉清 → 单依纯 | 5 | 1 | 千里之外 → 联唱 → 手心的蔷薇 → 别勉强 → 爱我的时候 |
| 陈绮贞 → 林忆莲 | 4 | 1 | 私奔到月球 → 说好不哭 → 不该 → 双影 |
| 吴青峰 → 林宥嘉 | 4 | 2 | 醉鬼阿Q → Stay With You 英文版 / 温柔 → Hello / 凡人歌 → 我有多么喜欢你 |
| 蔡依林 → 单依纯 | 5 | 3 | 今天你要嫁给我 → 爱我还是他 → 手心的蔷薇 → 别勉强 → 爱我的时候 |
| 梁心颐 → 吴青峰 | 4 | 1 | 珊瑚海 → 联唱 → Stay With You 英文版 → 醉鬼阿Q |
| 陈势安 → 阿肆 | 6 | 2 | 再也没有你 → 珊瑚海 → 不该 / 联唱 → 一眼瞬间 / Hello → 我有多么喜欢你 → 致姗姗来迟的你 |
| 王嘉尔 → 林忆莲 | 4 | 3 | 过 → Hello / 联唱 / 年少有为 → 一眼瞬间 / 不该 / 对等关系 → 双影 |

JSON 写法：`"rounds": [[start, target, distance], …]`。步数用上述 37 条边计算，只对应本精选图，不代表现实中的最短合作距离。

## 接口与交付边界

- JSON 的 `artists` 只含新增艺人，12 位既有艺人沿用原 ID。
- 每份录音的 `credits` 都含两位歌手的「演唱」，`sourceId` 均指向同一录音的 `creditSources`，构建脚本已逐条校验。
- 相对任务给定的 shape，额外增加了几个字段：
  - `creditSummary`：现有 contributions 需要这个字段。
  - `videoId`：只在官方唱片公司、艺人或节目频道的视频上填写，共 19 份；Topic 自动音轨和已失效的视频都不填。
  - `qqSongDetail`：2 份录音有 QQ 同版本详情页，只核对了元数据，未验证播放。
  - 五月天节点的 `entity: "group"` 和 `note`。
- **版本号冲突**：`graphVersion` 按任务指定写为 `real-vocal-2026-09-v2`，但现有目录已是 `real-vocal-2026-09-v3`。整合时应改用更高的版本号。
- `listenLinks` 继续为空，`audioAvailable` 继续为 `false`。本子任务没有运行构建、测试或界面验收。

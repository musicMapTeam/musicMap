// A small, manually checked catalogue of credited vocal collaborations.
// Metadata and outbound official links only: no audio, lyrics or cover images.
// Evidence: references/research/2026-09-27/real-catalogue-sources.md and vocal-network-expansion.md;
// the 2026-09-28 expansion (17 artists, 24 recordings) is logged in references/research/2026-09-28/network-expansion.md.
export const REAL_CATALOGUE_VERSION = 'real-vocal-2026-09-v4';
const checkedAt = '2026-09-27';
// Recordings added by the 2026-09-28 expansion carry their own check date.
const expandedAt = '2026-09-28';
const warnerJam = 'https://www.warnermusic.com.tw/blog/posts/與蕭敬騰與合唱的必聽歌曲-蕭敬騰合唱-禁愛條款-張惠妹一眼瞬間-林俊傑hello';
const warnerGenesis = 'https://www.warnermusic.com.tw/products/《新地球-genesis-發行版-─-天sky》';

const artistEntries = [
  ['real-jay', '周杰伦', ['周杰倫', 'Jay Chou'], '#FF7E59', '从《不该》出发，沿一次合唱走到下一位艺人'],
  ['real-amei', '张惠妹', ['張惠妹', 'aMEI', 'A-Mei'], '#DF8F99', '《不该》与《一眼瞬间》，两次不同的声音相遇'],
  ['real-jam', '萧敬腾', ['蕭敬騰', 'Jam Hsiao'], '#D8B474', '从张惠妹的《一眼瞬间》，走向与林俊杰合唱的《Hello》'],
  ['real-jj', '林俊杰', ['林俊傑', 'JJ Lin'], '#70DDCF', '从《黑暗骑士》走向阿信，或沿联唱现场遇见周杰伦'],
  ['real-fei', '费玉清', ['費玉清', 'Fei Yu-ching'], '#C9C0A2', '沿《千里之外》，回到与周杰伦的这次合唱'],
  ['real-ashin', '阿信', ['五月天阿信', '五月天 阿信', 'Mayday Ashin'], '#B2BDDF', '《说好不哭》与《黑暗骑士》连接两次合唱；这里的演唱者是阿信本人'],
  ['real-gary', '杨瑞代', ['楊瑞代', 'Gary Yang', 'Gary'], '#A6C5AC', '在《等你下课》中，听见两位合唱者的名字'],
  ['real-cindy', '袁咏琳', ['袁詠琳', 'Cindy Yen'], '#D9AAC9', '从《画沙》的双人署名，开始这一小段探索'],
  ['real-charlene', '蔡卓妍', ['A-Sa', '阿Sa', 'Charlene Choi'], '#E0BC85', '沿《小酒窝》，认识这首歌里的另一位合唱者'],
  ['real-jinsha', '金莎', ['Jin Sha', 'Kym'], '#BACE98', '从《被风吹过的夏天》出发，接着探索林俊杰的合作'],
  ['real-gem', '邓紫棋', ['鄧紫棋', 'G.E.M.', 'GEM'], '#D49D9B', '在《手心的蔷薇》中，与林俊杰的声音相连'],
  ['real-stefanie', '孙燕姿', ['孫燕姿', 'Stefanie Sun', 'Sun Yanzi'], '#D1B676', '《Stay With You》英文版，和林俊杰一起留下陪伴的声音'],
  // 2026-09-28 expansion. real-mayday is the band itself, credited only where the whole band sings;
  // real-ashin stays 阿信 in person.
  ['real-jolin', '蔡依林', ['Jolin Tsai', 'JOLIN', 'JOLIN蔡依林'], '#C096BF', '《给我一首歌的时间》现场与《今天你要嫁给我》，连起周杰伦、陶喆、Jony J 与五月天'],
  ['real-landy', '温岚', ['溫嵐', '温嵐', 'Landy Wen'], '#DA9D6F', '《屋顶》的男女对唱，连到周杰伦'],
  ['real-lara', '梁心颐', ['梁心頤', 'Lara', 'Lara梁心頤', 'Lara Liang'], '#6CC4C1', '从《珊瑚海》到《再也没有你》，连起周杰伦与陈势安'],
  ['real-patrick', '派伟俊', ['派偉俊', 'Patrick Brasca'], '#98BF80', '《Try》，与周杰伦共同演唱的电影主题曲'],
  ['real-ronghao', '李荣浩', ['李榮浩', 'Ronghao Li', 'Li Ronghao'], '#BA967E', '《对等关系》《离开地球表面》现场与《年少有为》现场，三次合唱'],
  ['real-yoga', '林宥嘉', ['Yoga Lin'], '#82CFEA', '《我有多么喜欢你》《致姗姗来迟的你》与《别说没爱过》现场'],
  ['real-asi', '阿肆', ['A Si', 'ASi'], '#AF9F56', '《致姗姗来迟的你》，与林宥嘉的合唱'],
  ['real-eric', '周兴哲', ['周興哲', 'Eric Chou', 'Eric周興哲'], '#53ABC9', '《别勉强》《爱我的时候》与《别说没爱过》现场，三次合唱'],
  ['real-yichun', '单依纯', ['單依純'], '#9499D0', '《爱我的时候》，与周兴哲共同演绎'],
  ['real-mayday', '五月天', ['Mayday', 'MAYDAY五月天'], '#89B6EF', '乐团节点：只连接署名为五月天整团的演唱；阿信本人另列', { entity: 'group' }],
  ['real-cheer', '陈绮贞', ['陳綺貞', 'Cheer Chen'], '#B6A7EA', '《私奔到月球》，逐轨演唱署名是阿信本人'],
  ['real-qingfeng', '吴青峰', ['吳青峰', 'Qing Feng Wu'], '#77B295', '《（......醉鬼阿Q）》，与孙燕姿合唱'],
  ['real-david', '陶喆', ['David Tao'], '#D6B8F9', '《今天你要嫁给我》与 JJ20 现场《爱我还是他》'],
  ['real-jonyj', 'Jony J', [], '#ADAE8D', '《我是谁》，与蔡依林合唱，唱 Rap 段落'],
  ['real-andrew', '陈势安', ['陳勢安', 'Andrew Tan'], '#90AEC3', '《再也没有你》，与梁心颐首度合唱'],
  ['real-sandy', '林忆莲', ['林憶蓮', 'Sandy Lam'], '#FCAEC1', '《双影》，与张惠妹首度合唱'],
  ['real-jackson', '王嘉尔', ['王嘉爾', 'Jackson Wang'], '#F4A894', '《过》，与林俊杰共同署名的单曲'],
];

const recordings = [
  {
    id: 'real-bu-gai', title: '不该', artists: ['real-jay', 'real-amei'],
    versionLabel: '周杰伦 × aMEI 官方 MV', videoId: '_VxLOj3TB5k',
    sourceUrl: 'https://jvrmusic.com.tw/artist/gallery/detail/1212682331903627264?lang=zh_CN&type=',
    // The page is the《幻城》theme-song entry; the recording is the one on《周杰伦的床边故事》(see recordingLabel).
    sourceLabel: '杰威尔音乐 · 作品页（《幻城》主题曲）',
    evidence: '杰威尔官方作品页将《不该》列为周杰伦、张惠妹演唱，说明两人对唱主题曲。',
  },
  {
    id: 'real-far-away', title: '千里之外', artists: ['real-jay', 'real-fei'],
    versionLabel: '周杰伦 feat. 费玉清 官方 MV', videoId: 'ocDo3ySyHSI',
    sourceUrl: 'https://www.youtube.com/watch?v=ocDo3ySyHSI',
    sourceLabel: '周杰伦官方频道 · MV 署名',
    evidence: '周杰伦官方频道的 MV 标题署名 feat. 费玉清；官方说明明确费玉清参与合唱。',
  },
  {
    id: 'real-wont-cry', title: '说好不哭', artists: ['real-jay', 'real-ashin'],
    versionLabel: '周杰伦 with 五月天阿信 官方 MV', videoId: 'HK7SPnGSxLM',
    sourceUrl: 'https://www.jvrmusic.com.tw/news/detail/1173815022741229568',
    sourceLabel: '杰威尔音乐 · 合作发布说明',
    evidence: '杰威尔的发布说明明确周杰伦邀请阿信对唱《说好不哭》。此处只连接阿信本人。',
  },
  {
    id: 'real-waiting-for-you', title: '等你下课', artists: ['real-jay', 'real-gary'],
    versionLabel: '周杰伦 with 杨瑞代 导演版 MV', videoId: 'QQucPUfXUQQ',
    sourceUrl: 'https://www.jvrmusic.com.tw/artist/news/detail/1152141405221687296?lang=zh_CN',
    sourceLabel: '杰威尔音乐 · 单曲发布说明',
    evidence: '杰威尔发布说明确认周杰伦邀请杨瑞代合唱；链接为同曲的官方导演版 MV。',
  },
  {
    id: 'real-sand-painting', title: '画沙', artists: ['real-cindy', 'real-jay'],
    versionLabel: '袁咏琳 ft. 周杰伦 官方 MV', videoId: 'rSojry19bOA',
    sourceUrl: 'https://www.youtube.com/watch?v=rSojry19bOA',
    sourceLabel: '袁咏琳官方频道 · MV 署名',
    evidence: '袁咏琳官方频道的《画沙》MV 署名 ft. 周杰伦，说明中明确这是两人的对唱作品。',
  },
  {
    id: 'real-a-moment', title: '一眼瞬间', artists: ['real-amei', 'real-jam'],
    versionLabel: '《STAR》合唱作品 · 官方 MV', videoId: 'Egrpx5g0UgI',
    sourceUrl: warnerJam, sourceLabel: '华纳音乐 · 萧敬腾合唱作品',
    evidence: '华纳官方文章明确《一眼瞬间》由张惠妹与萧敬腾合唱，并嵌入此版本的完整 MV。',
  },
  {
    id: 'real-hello', title: 'Hello', artists: ['real-jam', 'real-jj'],
    versionLabel: '萧敬腾 × 林俊杰 官方 MV', videoId: 'dmhhfSkC-Kg',
    sourceUrl: warnerJam, sourceLabel: '华纳音乐 · 萧敬腾合唱作品',
    evidence: '华纳官方文章将《Hello》列为萧敬腾与林俊杰的合唱，并链接两人署名的官方 MV。',
  },
  {
    id: 'real-dimples', title: '小酒窝', artists: ['real-jj', 'real-charlene'],
    versionLabel: '林俊杰 / 蔡卓妍 官方完整版 MV', videoId: 'h-woMj_Vt0A',
    sourceUrl: 'https://www.youtube.com/watch?v=h-woMj_Vt0A',
    sourceLabel: '太合音乐官方频道 · 合唱署名',
    evidence: '太合音乐发布的《小酒窝》官方 MV 在标题中明确标注合唱者蔡卓妍。',
  },
  {
    id: 'real-summer-breeze', title: '被风吹过的夏天', artists: ['real-jj', 'real-jinsha'],
    versionLabel: '林俊杰 / 金莎 官方完整版 MV', videoId: 'JbFrE_UbVyI',
    sourceUrl: 'https://www.youtube.com/watch?v=JbFrE_UbVyI',
    sourceLabel: '太合音乐官方频道 · 合唱署名',
    evidence: '太合音乐发布的官方 MV 以林俊杰署名，并在标题中明确标注合唱者金莎。',
  },
  {
    id: 'real-beautiful', title: '手心的蔷薇', artists: ['real-jj', 'real-gem'],
    versionLabel: '林俊杰 feat. 邓紫棋 官方 MV', videoId: 'onYP5u0b3yw',
    sourceUrl: warnerGenesis, sourceLabel: '华纳音乐 ·《新地球》专辑页',
    evidence: '华纳《新地球》专辑页列出 feat. G.E.M. 邓紫棋，并明确说明为男女对唱作品。',
  },
  {
    id: 'real-dark-knight', title: '黑暗骑士', artists: ['real-jj', 'real-ashin'],
    versionLabel: '林俊杰 × 阿信 ·《因你而在》官方 MV', videoId: 'gvce2ywrSsI',
    sourceUrl: 'https://www.youtube.com/watch?v=gvce2ywrSsI',
    sourceLabel: '林俊杰官方频道 · 华纳官方 MV 说明',
    evidence: '官方发布说明明确阿信与林俊杰合唱；五月天的编曲、演奏另列制作署名，不把整团替代阿信本人。',
  },
  {
    id: 'real-jay-jj-medley', title: '稻香 / Stay With You', artists: ['real-jay', 'real-jj'],
    versionLabel: '周杰伦 × 林俊杰 · 2020 官方联唱现场', videoId: 'rCT0zSWaEZI',
    sourceUrl: 'https://www.bilibili.com/video/BV13C4y1p7jQ/',
    sourceLabel: '人民网官方账号 · 公益云演唱会合唱',
    evidence: '人民网官方发布直接将该节目署名为周杰伦、林俊杰合唱《稻香 / Stay With You》；这里连接 2020 联唱现场，不把两首原版录音室歌曲改作合唱。',
  },
  {
    id: 'real-stay-with-you-english', title: 'Stay With You（英文版）', artists: ['real-jj', 'real-stefanie'],
    versionLabel: '林俊杰 × 孙燕姿 · 英文版官方歌词 MV', videoId: 'AGl7EJ8ZOFk',
    sourceUrl: 'https://www.youtube.com/watch?v=AGl7EJ8ZOFk',
    sourceLabel: '林俊杰官方频道 · 英文版录音室署名',
    evidence: '官方歌词 MV 标题共同署名林俊杰与孙燕姿，发布说明介绍两人演唱英文版，并列出该版录音制作名单。',
  },
  {
    id: 'real-give-me-a-song-live', title: '给我一首歌的时间', artists: ['real-jay', 'real-jolin'],
    versionLabel: '《超时代演唱会》现场版 · 特别来宾蔡依林（2010 台北小巨蛋）',
    sourceUrl: 'https://www.sonymusic.com.tw/album/%e8%b6%85%e6%99%82%e4%bb%a3%e6%bc%94%e5%94%b1%e6%9c%83-blu-ray-%e5%91%a8%e6%9d%b0%e5%80%ab-jay-chou-88697893959/',
    sourceLabel: '台湾索尼音乐 ·《超时代演唱会》Blu-ray 曲目表', checkedAt: expandedAt,
    evidence: '台湾索尼音乐官方产品页的 Blu-ray 曲目表列出“給我一首歌的時間（特別來賓蔡依林）”，同系列 DVD 页文案写明“重现双J合唱共舞”。',
  },
  {
    id: 'real-rooftop', title: '屋顶', artists: ['real-landy', 'real-jay'],
    versionLabel: '温岚《有点野》· 2001 录音室对唱版（发行元数据标注：男声 周杰伦）',
    sourceUrl: 'https://music.apple.com/tw/song/%E5%B1%8B%E9%A0%82/1441626752',
    sourceLabel: 'Apple Music · 演出艺人署名', checkedAt: expandedAt,
    evidence: 'Apple Music 该曲的“演出艺人”栏把温岚与周杰伦都列为“演唱”，发行方提供的 YouTube 元数据标题为“屋頂 (男聲: 周杰倫)”。',
  },
  {
    id: 'real-coral-sea', title: '珊瑚海', artists: ['real-jay', 'real-lara'],
    versionLabel: '周杰伦 feat. 梁心颐 官方 MV', videoId: 'kYhh1PpsOg4',
    sourceUrl: 'https://www.youtube.com/watch?v=kYhh1PpsOg4',
    sourceLabel: '周杰伦官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '周杰伦官方频道的 MV 标题署名 feat. 梁心頤 Lara，发布说明称这是杰伦与梁心颐的男女对唱。',
  },
  {
    id: 'real-try', title: 'Try', artists: ['real-jay', 'real-patrick'],
    versionLabel: '派伟俊 × 周杰伦 官方 MV · 电影《功夫熊猫3》全球主题曲', videoId: 'iJPfSSpnR8g',
    sourceUrl: 'https://www.jvrmusic.com/news/detail/1167014680858857472?lang=en_US',
    sourceLabel: '杰威尔音乐 · 单曲发布说明', checkedAt: expandedAt,
    evidence: '杰威尔官方新闻写明《Try》由周杰伦及派伟俊共同演唱，并注明由周杰伦监制、派伟俊创作。',
  },
  {
    id: 'real-equal-terms', title: '对等关系', artists: ['real-ronghao', 'real-amei'],
    versionLabel: '李荣浩 ft. 张惠妹 官方 MV', videoId: 'mQUek1GYfvs',
    sourceUrl: 'https://www.warnermusic.com.tw/blog/posts/%E6%9D%8E%E6%A6%AE%E6%B5%A9-%E5%BC%B5%E6%83%A0%E5%A6%B9-%E9%9C%87%E6%92%BC%E5%90%88%E4%BD%9C-%E5%85%A8%E6%96%B0%E5%96%AE%E6%9B%B2-%E5%B0%8D%E7%AD%89%E9%97%9C%E4%BF%82-128-%E5%85%A8%E9%9D%A2%E4%B8%8A%E7%B7%9A-%E6%AD%8C%E8%A9%9E-%E7%B7%9A%E4%B8%8A%E8%81%BD-1',
    sourceLabel: '华纳音乐台湾 · 单曲发布说明', checkedAt: expandedAt,
    evidence: '华纳音乐台湾新闻稿称该曲为李荣浩与张惠妹的男女对唱，所附歌词按“李榮浩 / 張惠妹 / 合”标注演唱段落。',
  },
  {
    id: 'real-how-much-i-love-you', title: '我有多么喜欢你', artists: ['real-jam', 'real-yoga'],
    versionLabel: '萧敬腾 feat. 林宥嘉 · 合唱录音室版（区别于《独唱版》）',
    sourceUrl: 'https://www.youtube.com/watch?v=7qD33oIu8ek',
    sourceLabel: '华纳音乐台湾提供的发行元数据 · Featured Vocals 署名', checkedAt: expandedAt,
    evidence: '华纳音乐台湾提供给 YouTube 的发行元数据同列萧敬腾与林宥嘉，并写明“Featured Vocals: Yoga Lin”；华纳官网曲目表将其与独唱版分列。',
  },
  {
    id: 'real-sincerely-yours', title: '致姗姗来迟的你', artists: ['real-asi', 'real-yoga'],
    versionLabel: '阿肆 & 林宥嘉 · 合唱录音室版',
    sourceUrl: 'https://music.apple.com/tw/album/%E8%87%B4%E5%A7%8D%E5%A7%8D%E4%BE%86%E9%81%B2%E7%9A%84%E4%BD%A0/1808448710?i=1808449151',
    sourceLabel: 'Apple Music · 曲目艺人署名', checkedAt: expandedAt,
    evidence: 'Apple Music 将该曲署名为“阿肆 & 林宥嘉”，网易云音乐与 QQ 音乐的歌曲资料也同列两人为演唱者。',
  },
  {
    id: 'real-dont-force-it', title: '别勉强', artists: ['real-gem', 'real-eric'],
    versionLabel: '邓紫棋 feat. 周兴哲 官方 MV', videoId: '6XSoVmT0qXo',
    sourceUrl: 'https://www.youtube.com/watch?v=6XSoVmT0qXo',
    sourceLabel: '邓紫棋官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '邓紫棋官方频道的 MV 标题署名 feat. Eric周興哲，发布说明写明男声部分由周兴哲一起合唱。',
  },
  {
    id: 'real-when-you-loved-me', title: '爱我的时候', artists: ['real-eric', 'real-yichun'],
    versionLabel: '周兴哲 × 单依纯 官方 MV', videoId: 'bG563p_moiE',
    sourceUrl: 'https://www.youtube.com/watch?v=bG563p_moiE',
    sourceLabel: '周兴哲官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '周兴哲官方频道的 MV 标题以“周興哲 × 單依純”署名，发布说明称两人共同演绎并分别描述两人的演唱。',
  },
  {
    id: 'real-tenderness-20th', title: '温柔 #MaydayBlue20th', artists: ['real-mayday', 'real-stefanie'],
    versionLabel: '五月天 feat. 孙燕姿 官方 MV · 2020 新编曲版（非 2000 年《爱情万岁》原版）', videoId: '7h9uEUvQjcs',
    sourceUrl: 'https://www.youtube.com/watch?v=7h9uEUvQjcs',
    sourceLabel: '相信音乐官方频道 · MV 署名与音乐演出名单', checkedAt: expandedAt,
    evidence: '相信音乐官方 MV 标题署名 feat.孫燕姿，发布说明的“音乐演出”一栏为“五月天 Mayday + 孫燕姿”。',
  },
  {
    id: 'real-elope-to-the-moon', title: '私奔到月球', artists: ['real-ashin', 'real-cheer'],
    versionLabel: '《离开地球表面》· 男女对唱录音室版（逐轨演唱署名为阿信本人）', videoId: 'YPvokbVcpH4',
    sourceUrl: 'https://music.apple.com/tw/song/1081738609',
    sourceLabel: 'Apple Music · 演出艺人署名', checkedAt: expandedAt,
    evidence: 'Apple Music 该曲的演出艺人栏把“五月天 阿信”与陈绮贞都列为“演唱”，Spotify 的曲目艺人同为“五月天 阿信, Cheer Chen”。',
  },
  {
    id: 'real-drunk-ah-q', title: '（......醉鬼阿Q）', artists: ['real-qingfeng', 'real-stefanie'],
    versionLabel: '吴青峰 feat. 孙燕姿 官方 MV · 2022 录音室合唱版', videoId: '0HwxT8--sA8',
    sourceUrl: 'https://umusic.com.tw/news_page.php?q=1666766191',
    sourceLabel: '环球音乐台湾 · 新歌发布说明', checkedAt: expandedAt,
    evidence: '环球音乐台湾新闻稿标题写明“吴青峰与孙燕姿合唱新歌”，UMG 提供的发行元数据也把两人分别署名为 Vocalist。',
  },
  {
    id: 'real-marry-me-today', title: '今天你要嫁给我', artists: ['real-david', 'real-jolin'],
    versionLabel: '陶喆 feat. 蔡依林 官方完整版 MV', videoId: 'WRwarsqzZ_M',
    sourceUrl: 'https://www.youtube.com/watch?v=WRwarsqzZ_M',
    sourceLabel: '华纳音乐经典曲目频道 Timeless Music · MV 署名', checkedAt: expandedAt,
    evidence: '华纳音乐经典曲目频道的官方完整版 MV 标题署名 feat. 蔡依林 Jolin Tsai，Apple Music《太美丽》曲目与蔡依林方发行元数据均同列两人。',
  },
  {
    id: 'real-who-am-i', title: '我是谁', artists: ['real-jolin', 'real-jonyj'],
    versionLabel: '蔡依林 × Jony J 官方 MV · 电视剧《狼殿下》片头曲（Jony J 担任 Rap 段落）', videoId: 'QJCpDCHqDuU',
    sourceUrl: 'https://www.youtube.com/watch?v=QJCpDCHqDuU',
    sourceLabel: '华纳音乐台湾官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '华纳音乐台湾官方 MV 以“蔡依林 Jolin Tsai x Jony J”署名，发布说明写明《我是谁》由蔡依林与 Jony J 合唱、两人领衔主唱。',
  },
  {
    id: 'real-no-more-u', title: '再也没有你', artists: ['real-lara', 'real-andrew'],
    versionLabel: '梁心颐 feat. 陈势安 官方 MV', videoId: 'NH2JvK2t9nU',
    sourceUrl: 'https://www.youtube.com/watch?v=NH2JvK2t9nU',
    sourceLabel: 'NSMG 新湃传媒官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '唱片公司 NSMG 的官方 MV 标题署名 feat. 陈势安，发布说明写明“Lara梁心頤 X 陳勢安 首度合唱情歌”。',
  },
  {
    id: 'real-ordinary-people', title: '凡人歌', artists: ['real-mayday', 'real-jam'],
    versionLabel: '五月天 feat. 萧敬腾 官方 MV · 翻唱李宗盛原曲', videoId: 'OsUr8N7t4zc',
    sourceUrl: 'https://www.youtube.com/watch?v=OsUr8N7t4zc',
    sourceLabel: '相信音乐官方频道 · MV 署名', checkedAt: expandedAt,
    evidence: '相信音乐官方 MV 标题署名“Mayday五月天 feat.蕭敬騰”，Spotify 的曲目艺人将 Mayday 与 Jam Hsiao 分列为两位艺人。',
  },
  {
    id: 'real-dont-say-never-loved-live', title: '别说没爱过 (Live)', artists: ['real-yoga', 'real-eric'],
    versionLabel: '《声生不息·华流季》第 7 期现场合唱版 · 翻唱韦礼安原曲', videoId: 'd2owNH6AQ9A',
    sourceUrl: 'https://music.apple.com/tw/album/%E5%88%A5%E8%AA%AA%E6%B2%92%E6%84%9B%E9%81%8E-live/1866486278?i=1866486481',
    sourceLabel: 'Apple Music · 现场录音艺人署名', checkedAt: expandedAt,
    evidence: 'Apple Music 将这份节目现场录音署名为“林宥嘉 & 周興哲”，QQ 音乐歌曲资料同列两人并标注唱片公司“环球音乐X芒果TV”。',
  },
  {
    id: 'real-us-afterwards-live', title: '后来的我们', artists: ['real-mayday', 'real-amei'],
    versionLabel: '五月天 feat. aMEI · Life Tour 北京 no.105 官方现场影片（男女合唱版）', videoId: 't1nB8xMdiww',
    sourceUrl: 'https://www.youtube.com/watch?v=t1nB8xMdiww',
    sourceLabel: '相信音乐官方频道 · 现场影片演唱署名', checkedAt: expandedAt,
    evidence: '相信音乐官方现场影片标题署名 feat.aMEI，发布说明写明“演唱 / aMEI+五月天”。',
  },
  {
    id: 'real-not-truly-happy-sky-live', title: '你不是真正的快乐 + 天空', artists: ['real-mayday', 'real-jolin'],
    versionLabel: '《人生无限公司》巡演现场联唱 · 相信音乐官方现场影片（北京 no.106）', videoId: 'gFxuJqdJW5E',
    sourceUrl: 'https://www.youtube.com/watch?v=gFxuJqdJW5E',
    sourceLabel: '相信音乐官方频道 · 现场影片演唱署名', checkedAt: expandedAt,
    evidence: '相信音乐官方现场影片说明写明“演唱 / 蔡依林+五月天”，《Life Live 好友加班篇》亦以 feat. 蔡依林 收录这段联唱。',
  },
  {
    id: 'real-leave-the-earth-live', title: '离开地球表面', artists: ['real-mayday', 'real-ronghao'],
    versionLabel: '五月天 feat. 李荣浩 · Life Tour 上海 no.100 官方现场影片', videoId: 'd3JVkes8o4k',
    sourceUrl: 'https://www.youtube.com/watch?v=d3JVkes8o4k',
    sourceLabel: '相信音乐官方频道 · 现场影片演唱署名', checkedAt: expandedAt,
    evidence: '相信音乐官方现场影片说明写明“演唱 / 李榮浩+五月天”，Apple Music《Life Live 好友加班篇》以 feat. 李榮浩 收录该曲。',
  },
  {
    id: 'real-if-i-were-young-live', title: '年少有为', artists: ['real-jj', 'real-ronghao'],
    versionLabel: 'JJ20 南宁站现场合唱 · 林俊杰官方现场视频', videoId: 'LLyAiDCYQgM',
    sourceUrl: 'https://www.youtube.com/watch?v=LLyAiDCYQgM',
    sourceLabel: '林俊杰官方频道 · 现场视频署名与说明', checkedAt: expandedAt,
    evidence: '林俊杰官方频道的现场视频标题同列林俊杰与李荣浩，发布说明写明邀请李荣浩合唱他的作品《年少有为》。',
  },
  {
    id: 'real-who-do-you-love-live', title: '爱我还是他', artists: ['real-jj', 'real-david'],
    versionLabel: 'JJ20 重庆站终场（2024-11-03）· 林俊杰官方现场视频', videoId: 'WGVE2bi4viE',
    sourceUrl: 'https://www.youtube.com/watch?v=WGVE2bi4viE',
    sourceLabel: '林俊杰官方频道 · 现场视频署名与说明', checkedAt: expandedAt,
    evidence: '林俊杰官方频道的现场视频标题同列林俊杰与陶喆，说明写明两人在收官场同台演绎，凤凰网报道称两人合唱此曲。',
  },
  {
    id: 'real-double-shadow', title: '双影', artists: ['real-amei', 'real-sandy'],
    versionLabel: 'aMEI × Sandy 官方 MV · 电视剧《如懿传》主题曲', videoId: 'IRwFrOKpRbc',
    sourceUrl: 'https://www.youtube.com/watch?v=IRwFrOKpRbc',
    sourceLabel: '张惠妹官方频道 · MV 署名与发布说明', checkedAt: expandedAt,
    evidence: '张惠妹官方频道的 MV 标题署名“aMEI x Sandy”，发布说明称这是林忆莲与张惠妹首度合唱的对唱主题曲。',
  },
  {
    id: 'real-shouldve-let-go', title: '过', artists: ['real-jackson', 'real-jj'],
    versionLabel: '王嘉尔 & 林俊杰 · 2020 单曲录音室版',
    sourceUrl: 'https://music.apple.com/tw/album/%E9%81%8E/1544425146',
    sourceLabel: 'Apple Music · 单曲艺人署名', checkedAt: expandedAt,
    evidence: 'Apple Music 将单曲《过》署名为“Jackson Wang & 林俊傑”，Deezer 亦把两人都标为 Main 艺人。',
  },
];

// A credit belongs to a specific recording, not to an artist in general.
// Keep one role/source pair per row so co-vocal graph edges stay unambiguous.
const source = (id, label, url, at = checkedAt) => ({ id, label, url, checkedAt: at });
const credited = (name, roles, sourceId) => roles.map(role => ({
  name, role, sourceId,
  ...(artistEntries.find(entry => entry[1] === name) ? { artistId: artistEntries.find(entry => entry[1] === name)[0] } : {}),
}));
const contributions = {
  'real-dark-knight': {
    recordingLabel: '《因你而在》· 录音室版', creditSummary: '词 阿信 · 曲 / 制作 林俊杰 · 编曲 林俊杰 / 五月天',
    // QQ Music's lyric header for the album track 001tzPHJ436zJl (re-read 2026-09-29): 词 阿信, 曲 林俊杰,
    // 编曲 林俊杰/五月天, 制作人 林俊杰. Only the production lines are taken from it; the vocal link stays on the MV.
    sources: [source('qq-lyrics', 'QQ 音乐 · 歌词接口中的制作署名（《因你 而在》第 3 首）', 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=001tzPHJ436zJl&format=json&nobase64=1&g_tk=5381', '2026-09-29')],
    credits: [
      ...credited('阿信', ['作词'], 'vocal'),
      ...credited('林俊杰', ['作曲'], 'vocal'),
      ...credited('林俊杰', ['编曲', '制作人'], 'qq-lyrics'),
      ...credited('五月天', ['编曲', '演奏'], 'vocal'),
    ],
  },
  'real-jay-jj-medley': {
    recordingLabel: '2020 官方发布 · 双人联唱现场版', creditSummary: '两曲联唱 · 词曲按作品分别署名',
    sources: [source('official', '林俊杰官方频道 · 联唱中的分曲词曲署名', 'https://www.youtube.com/watch?v=rCT0zSWaEZI')],
    credits: [
      ...credited('周杰伦', ['《稻香》作词', '《稻香》作曲'], 'official'),
      ...credited('黄雨勋', ['《稻香》编曲'], 'official'),
      ...credited('孙燕姿', ['《Stay With You》作词'], 'official'),
      ...credited('林俊杰', ['《Stay With You》作曲', '《Stay With You》编曲'], 'official'),
    ],
  },
  'real-stay-with-you-english': {
    recordingLabel: '2020 单曲 · 英文录音室版', creditSummary: '词 孙燕姿 · 曲 / 制作 林俊杰',
    sources: [],
    credits: [
      ...credited('孙燕姿', ['作词'], 'vocal'),
      ...credited('林俊杰', ['作曲', '制作人', '配唱制作', '编曲', '键盘', '弦乐编写', '录音', '混音', '母带制作人'], 'vocal'),
      ...credited('陈蔚甄 MISO TAN', ['配唱制作', '录音'], 'vocal'),
      ...credited('黄冠龙 ALEX.D', ['制作协力', '吉他'], 'vocal'),
      ...credited('周信廷 SHiN CHOU', ['制作协力'], 'vocal'),
      ...credited('Mike Bozzi', ['母带工程'], 'vocal'),
    ],
  },
  'real-bu-gai': {
    recordingLabel: '《周杰伦的床边故事》· 录音室版（同一录音亦收于《幻城》原声带）', creditSummary: '词 方文山 · 曲 周杰伦',
    sources: [source('release', 'Shazam · 发行制作署名', 'https://www.shazam.com/zh-tw/song/1721456390/不該-feat-張惠妹')],
    credits: [
      ...credited('周杰伦', ['作曲', '制作人'], 'release'),
      ...credited('方文山', ['作词'], 'release'),
      ...credited('黄雨勋', ['编曲', '吉他'], 'release'),
      ...credited('陈柏州', ['鼓'], 'release'),
      ...credited('杨大纬', ['混音'], 'release'),
      ...credited('杨瑞代', ['录音'], 'release'),
      ...credited('钟潍宇', ['录音'], 'release'),
      ...credited('陈羽柔', ['第一小提琴'], 'release'),
      ...credited('王茂榛', ['第一小提琴'], 'release'),
      ...credited('骆思云', ['第一小提琴'], 'release'),
      ...credited('张玮珊', ['第一小提琴'], 'release'),
      ...credited('陈泱瑾', ['第二小提琴'], 'release'),
      ...credited('龙俊宇', ['第二小提琴'], 'release'),
      ...credited('周有玓', ['第二小提琴'], 'release'),
      ...credited('易欣颖', ['第二小提琴'], 'release'),
      ...credited('陈怡玲', ['中提琴'], 'release'),
      ...credited('林筱婷', ['中提琴'], 'release'),
      ...credited('罗月廷', ['大提琴'], 'release'),
      ...credited('颜君玲', ['大提琴'], 'release'),
    ],
  },
  'real-far-away': {
    recordingLabel: '《依然范特西》· 合唱录音室版', creditSummary: '词 方文山 · 曲 周杰伦',
    sources: [source('release', 'Qobuz ·《依然范特西》曲目 3', 'https://www.qobuz.com/nl-nl/album/-/ilpon2h36u7vc')],
    credits: [
      ...credited('周杰伦', ['作曲', '制作人'], 'release'),
      ...credited('方文山', ['作词'], 'release'),
      ...credited('林迈可', ['编曲', '混音'], 'release'),
      ...credited('杨瑞代', ['录音'], 'release'),
    ],
  },
  'real-wont-cry': {
    recordingLabel: '2019 单曲 · 录音室版', creditSummary: '词 方文山 · 曲 周杰伦',
    sources: [source('release', 'Qobuz · 单曲制作署名', 'https://www.qobuz.com/nl-nl/album/-/n1w0llg9xtasa')],
    credits: [
      ...credited('周杰伦', ['作曲', '制作人'], 'release'),
      ...credited('方文山', ['作词'], 'release'),
      ...credited('黄雨勋', ['编曲', '混音'], 'release'),
      ...credited('杨瑞代', ['录音'], 'release'),
      ...credited('李汪哲', ['录音'], 'release'),
    ],
  },
  'real-waiting-for-you': {
    recordingLabel: '《最伟大的作品》· 录音室版', creditSummary: '词曲 周杰伦 · 编曲 黄雨勋',
    sources: [source('release', 'Shazam · 发行制作署名', 'https://www.shazam.com/zh-tw/song/1721450095/等你下課')],
    credits: [
      ...credited('周杰伦', ['作词', '作曲'], 'vocal'),
      ...credited('周杰伦', ['制作人'], 'release'),
      ...credited('黄雨勋', ['编曲'], 'release'),
    ],
  },
  'real-sand-painting': {
    recordingLabel: '《袁咏琳同名专辑》· 录音室版', creditSummary: '词 方文山 · 曲 袁咏琳',
    sources: [source('release', 'Shazam · 发行制作署名', 'https://www.shazam.com/zh-tw/song/1721885585/畫沙')],
    credits: [
      ...credited('袁咏琳', ['作曲'], 'vocal'),
      ...credited('袁咏琳', ['制作人'], 'release'),
      ...credited('周杰伦', ['人声编排'], 'release'),
      ...credited('方文山', ['作词'], 'vocal'),
      ...credited('黄雨勋', ['编曲'], 'release'),
      ...credited('杨瑞代', ['录音'], 'release'),
      ...credited('柯宗佑', ['录音'], 'release'),
      ...credited('苏正成', ['录音'], 'release'),
      ...credited('杨大纬', ['混音'], 'release'),
    ],
  },
  'real-a-moment': {
    recordingLabel: '《STAR》· 录音室版', creditSummary: '词 邬裕康 · 曲 曹格',
    sources: [source('release', 'Qobuz ·《STAR》曲目 6', 'https://www.qobuz.com/it-it/album/star/fuy5qlvvzxxua')],
    credits: [
      ...credited('曹格', ['作曲'], 'release'),
      ...credited('邬裕康', ['作词'], 'release'),
      ...credited('吴庆隆', ['编曲'], 'release'),
      ...credited('马毓芬', ['制作人'], 'release'),
      ...credited('钟国泰', ['混音', '音响工程'], 'release'),
      ...credited('叶育轩', ['音响工程'], 'release'),
    ],
  },
  'real-hello': {
    recordingLabel: '2020 单曲 · 录音室版', creditSummary: '萧敬腾 × 林俊杰 · 作曲 / 制作',
    sources: [source('official', '萧敬腾官方 · 录音室制作名单', 'https://www.youtube.com/watch?v=dmhhfSkC-Kg')],
    credits: [
      ...credited('萧敬腾', ['作曲', '制作人', '配唱制作', '钢琴', '和声编写', '和声', '母带制作人'], 'official'),
      ...credited('林俊杰', ['作曲', '制作人', '配唱制作', '和声编写', '和声', '录音', '母带制作人'], 'official'),
      ...credited('奶六', ['作词'], 'official'),
      ...credited('黄冠龙 ALEX.D', ['编曲', '键盘', '弦乐编写', '吉他', '制作协力'], 'official'),
      ...credited('阿火 Afire Lee', ['编曲', '键盘', '弦乐编写', '制作协力'], 'official'),
      ...credited('周信廷', ['制作协力', '录音'], 'official'),
      ...credited('蔡曜宇', ['弦乐监制', '第一小提琴'], 'official'),
      ...credited('寗子达', ['贝斯'], 'official'),
      ...credited('Brendan Buckley', ['鼓', '录音'], 'official'),
      ...credited('Richard Furch', ['混音'], 'official'),
      ...credited('Mike Bozzi', ['母带工程'], 'official'),
      ...credited('沈羿彣', ['第一小提琴'], 'official'),
      ...credited('黄瑾诤', ['第一小提琴'], 'official'),
      ...credited('朱奕宁', ['第二小提琴'], 'official'),
      ...credited('黄雨柔', ['第二小提琴'], 'official'),
      ...credited('甘威鹏', ['中提琴'], 'official'),
      ...credited('牟启东', ['中提琴'], 'official'),
      ...credited('刘涵', ['大提琴'], 'official'),
      ...credited('叶欲新', ['大提琴'], 'official'),
      ...credited('刘品贤', ['录音'], 'official'),
      ...credited('杨敏奇', ['录音'], 'official'),
      ...credited('徐振程', ['录音助理'], 'official'),
    ],
  },
  'real-dimples': {
    recordingLabel: '《JJ 陆》· 国语录音室版', creditSummary: '词 王雅君 · 曲 林俊杰',
    sources: [],
    credits: [
      ...credited('林俊杰', ['作曲'], 'vocal'),
      ...credited('王雅君', ['作词'], 'vocal'),
    ],
  },
  'real-summer-breeze': {
    recordingLabel: '《空气》· 合唱录音室版', creditSummary: '词 冯欣慧 · 曲 / 编曲 林俊杰',
    sources: [source('release', 'JOOX ·《空气》作品署名', 'https://www.joox.com/hk/single/TqpRxYVbhHXJMZnSvtT43g%3D%3D')],
    credits: [
      ...credited('林俊杰', ['作曲'], 'vocal'),
      ...credited('林俊杰', ['编曲'], 'release'),
      ...credited('冯欣慧', ['作词'], 'vocal'),
      ...credited('毕晓世', ['制作人'], 'release'),
    ],
  },
  'real-beautiful': {
    recordingLabel: '《新地球》· 录音室版', creditSummary: '词 林怡凤 · 曲 / 制作 林俊杰',
    sources: [
      source('release', 'Shazam · 发行制作署名', 'https://www.shazam.com/song/1788007693/beautiful-feat-gem'),
      source('lyrics', 'LINE MUSIC · 词曲署名', 'https://music-tw.line.me/track/1217180006'),
    ],
    credits: [
      ...credited('林俊杰', ['作曲'], 'lyrics'),
      ...credited('林俊杰', ['制作人'], 'release'),
      ...credited('林怡凤', ['作词'], 'lyrics'),
      ...credited('Terence Teo', ['编曲'], 'release'),
      ...credited('Brendan Buckley', ['鼓', '录音'], 'release'),
      ...credited('Adam Klemens', ['指挥'], 'release'),
      ...credited('Lucie Svehlová', ['第一小提琴'], 'release'),
      ...credited('Dr. Moon', ['录音'], 'release'),
      ...credited('Kai', ['录音'], 'release'),
      ...credited('Ludwig', ['录音'], 'release'),
      ...credited('Vitek Kral', ['录音'], 'release'),
      ...credited('Zhou Xin Ting', ['制作助理'], 'release'),
    ],
  },
  'real-give-me-a-song-live': {
    recordingLabel: '2011《超时代演唱会》DVD / Blu-ray 现场曲目 · 非《魔杰座》录音室独唱原版', creditSummary: '词曲 周杰伦 · 现场特别来宾 蔡依林',
    sources: [
      source('dvd', '台湾索尼音乐 ·《超时代演唱会》DVD 发行文案', 'https://www.sonymusic.com.tw/album/%e8%b6%85%e6%99%82%e4%bb%a3%e6%bc%94%e5%94%b1%e6%9c%83-dvd-%e5%91%a8%e6%9d%b0%e5%80%ab-jay-chou-88697840779/', expandedAt),
      source('store', '网易云音乐 · 歌曲资料（杰威尔《超时代演唱会》）', 'https://music.163.com/api/song/detail/?ids=%5B34923732%5D', expandedAt),
      source('writing', 'LINE MUSIC ·《魔杰座》原曲词曲署名', 'https://music-tw.line.me/track/1018308002', expandedAt),
    ],
    credits: [
      ...credited('周杰伦', ['作词', '作曲'], 'writing'),
    ],
  },
  'real-rooftop': {
    recordingLabel: '《有点野》第 11 首 · 录音室版（℗ 2001 阿尔发音乐）', creditSummary: '词曲 / 制作 周杰伦',
    sources: [
      source('distributor', 'YouTube 发行元数据（AdShare 提供，温岚 - Topic）', 'https://www.youtube.com/watch?v=lG-TIlf-Yxo', expandedAt),
    ],
    credits: [
      ...credited('周杰伦', ['作词', '作曲', '制作人'], 'vocal'),
    ],
  },
  'real-coral-sea': {
    recordingLabel: '《十一月的萧邦》第 10 首 · 录音室对唱版', creditSummary: '词 方文山 · 曲 周杰伦',
    sources: [
      source('release', 'Apple Music · 演出艺人与制作署名', 'https://music.apple.com/tw/song/%E7%8F%8A%E7%91%9A%E6%B5%B7-feat-%E6%A2%81%E5%BF%83%E9%A0%A4/536009751', expandedAt),
    ],
    credits: [
      ...credited('方文山', ['作词'], 'vocal'),
      ...credited('周杰伦', ['作曲'], 'vocal'),
      ...credited('周杰伦', ['制作人'], 'release'),
      ...credited('钟兴民', ['编曲', '弦乐编曲'], 'release'),
      ...credited('杨瑞代', ['工程师'], 'release'),
      ...credited('杨大纬', ['混音'], 'release'),
    ],
  },
  'real-try': {
    recordingLabel: '2016 单曲 · 录音室版（杰威尔音乐）', creditSummary: '曲 派伟俊 · 词 方文山 / 冼佩瑾 · 监制 周杰伦',
    sources: [
      source('mv', '派伟俊官方频道 · MV 署名与发布说明', 'https://www.youtube.com/watch?v=iJPfSSpnR8g', expandedAt),
      source('release', 'Apple Music · 单曲艺人署名', 'https://music.apple.com/tw/album/try-%E5%8A%9F%E5%A4%AB%E7%86%8A%E8%B2%933-%E5%85%A8%E7%90%83%E4%B8%BB%E9%A1%8C%E6%9B%B2/1070863333?i=1070863343', expandedAt),
    ],
    credits: [
      ...credited('派伟俊', ['作曲'], 'vocal'),
      ...credited('方文山', ['中文作词'], 'vocal'),
      ...credited('冼佩瑾', ['英文作词'], 'vocal'),
      ...credited('周杰伦', ['监制'], 'vocal'),
    ],
  },
  'real-equal-terms': {
    recordingLabel: '2021 单曲 · 录音室对唱版', creditSummary: '词曲 / 制作 李荣浩',
    sources: [
      source('mv', '李荣浩官方频道 · MV 署名', 'https://www.youtube.com/watch?v=mQUek1GYfvs', expandedAt),
      source('release', 'Apple Music · 演出艺人与制作署名', 'https://music.apple.com/mo/song/%E5%B0%8D%E7%AD%89%E9%97%9C%E4%BF%82-feat-%E5%BC%B5%E6%83%A0%E5%A6%B9/1598923707', expandedAt),
    ],
    credits: [
      ...credited('李荣浩', ['作词', '作曲', '制作'], 'vocal'),
      ...credited('李荣浩', ['编曲', '混音', '吉他', '贝斯'], 'release'),
      ...credited('陈君豪', ['配唱监制'], 'release'),
      ...credited('陈文骏', ['录音'], 'release'),
      ...credited('钟潍宇', ['录音'], 'release'),
      ...credited('周天澈', ['母带'], 'release'),
    ],
  },
  'real-how-much-i-love-you': {
    recordingLabel: '2018 单曲 /《欲望反光》第 10 首 · 录音室版', creditSummary: '词 林宥嘉 · 曲 萧敬腾 / 林宥嘉',
    sources: [
      source('label', '华纳音乐台湾 ·《欲望反光 LUXE 华丽版》曲目表', 'https://www.warnermusic.com.tw/products/test', expandedAt),
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/embed/track/6MwdxH1iD9lNKNZcg9Gy28', expandedAt),
    ],
    credits: [
      ...credited('林宥嘉', ['作词', '作曲'], 'vocal'),
      ...credited('萧敬腾', ['作曲'], 'vocal'),
    ],
  },
  'real-sincerely-yours': {
    recordingLabel: '《我愚蠢的理想主义》第 3 首 · 录音室版（摩登天空）', creditSummary: '词曲 阿肆 · 编曲 吴涛',
    sources: [
      source('qq', 'QQ 音乐 · 歌曲资料接口', 'https://u.y.qq.com/cgi-bin/musicu.fcg?data=%7B%22songinfo%22%3A%7B%22method%22%3A%22get_song_detail_yqq%22%2C%22module%22%3A%22music.pf_song_detail_svr%22%2C%22param%22%3A%7B%22song_mid%22%3A%22003Iq94Q0SnePV%22%7D%7D%7D', expandedAt),
      source('credits', '网易云音乐 · 歌曲制作署名', 'https://music.163.com/api/song/lyric?id=432506809&lv=1', expandedAt),
    ],
    credits: [
      ...credited('阿肆', ['作词', '作曲'], 'credits'),
      ...credited('吴涛', ['编曲'], 'credits'),
    ],
  },
  'real-dont-force-it': {
    recordingLabel: '《摩天动物园》第 10 首 · 录音室对唱版', creditSummary: '词曲 邓紫棋 · 制作 邓紫棋 / 马敬恒',
    sources: [
      source('label', '台湾索尼音乐 ·《摩天动物园》专辑曲目', 'https://www.sonymusic.com.tw/album/g-e-m-city-zoo/', expandedAt),
      source('release', 'Apple Music · 演出艺人署名', 'https://music.apple.com/tw/song/%E5%88%A5%E5%8B%89%E5%BC%B7-feat-%E5%91%A8%E5%85%B4%E5%93%B2/1491477668', expandedAt),
    ],
    credits: [
      ...credited('邓紫棋', ['作词', '作曲', '制作人', '编曲'], 'vocal'),
      ...credited('马敬恒', ['制作人', '编曲'], 'vocal'),
      ...credited('Richard Furch', ['混音'], 'vocal'),
      ...credited('Randy Merrill', ['母带'], 'vocal'),
    ],
  },
  'real-when-you-loved-me': {
    recordingLabel: '2021 单曲 · 原版合唱录音', creditSummary: '词曲 周兴哲 · 制作 马敬恒 / 周兴哲',
    sources: [
      source('release', 'Apple Music · 单曲艺人署名', 'https://music.apple.com/us/album/when-you-loved-me-single/1555702417?l=zh-Hant-TW', expandedAt),
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/track/6us212S3fCRIQwOwNExqLH', expandedAt),
    ],
    credits: [
      ...credited('周兴哲', ['作词', '作曲', '制作人'], 'vocal'),
      ...credited('马敬恒', ['制作人', '编曲'], 'vocal'),
      ...credited('Brian Paturalski', ['混音'], 'vocal'),
    ],
  },
  'real-tenderness-20th': {
    recordingLabel: '2020 单曲 · 录音室版（相信音乐）', creditSummary: '词曲 阿信 · 制作 五月天',
    sources: [
      source('news', '相信音乐 · 新闻稿（2020.01.04）', 'https://www.bin-music.com.tw/news/1123', expandedAt),
      source('release', 'Apple Music · 单曲发行信息', 'https://music.apple.com/gb/album/%E6%BA%AB%E6%9F%94-maydayblue20th-feat-%E5%AD%AB%E7%87%95%E5%A7%BF-single/1493264263', expandedAt),
    ],
    credits: [
      ...credited('阿信', ['作词', '作曲'], 'vocal'),
      ...credited('五月天', ['制作', '编曲'], 'vocal'),
      ...credited('赖暐哲', ['编曲'], 'vocal'),
      ...credited('JerryC', ['编曲协力'], 'vocal'),
      ...credited('李雅微', ['和音'], 'vocal'),
      ...credited('詹宏业', ['和音'], 'vocal'),
      ...credited('黄士杰', ['混音'], 'vocal'),
      ...credited('陈陆泰', ['母带后期'], 'vocal'),
    ],
  },
  'real-elope-to-the-moon': {
    recordingLabel: '《离开地球表面 Jump! The World》第 1 首 · 录音室版（相信音乐）', creditSummary: '词曲 阿信 · 编曲 五月天 / 周恒毅',
    sources: [
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/embed/track/2kj7VCRJKrAkrOs6tcjrM7', expandedAt),
      source('mv', '相信音乐官方频道 · MV（标题署名五月天＋陈绮贞）', 'https://www.youtube.com/watch?v=YPvokbVcpH4', expandedAt),
    ],
    credits: [
      ...credited('阿信', ['作词', '作曲'], 'vocal'),
      ...credited('五月天', ['编曲', '制作人'], 'vocal'),
      ...credited('周恒毅', ['编曲'], 'vocal'),
      ...credited('怪兽', ['吉他'], 'vocal'),
      ...credited('石头', ['吉他'], 'vocal'),
      ...credited('玛莎', ['贝斯'], 'vocal'),
      ...credited('冠佑', ['鼓'], 'vocal'),
    ],
  },
  'real-drunk-ah-q': {
    recordingLabel: '2022 单曲 /《马拉美的星期二》第 8 首 · 录音室版', creditSummary: '词曲 吴青峰 · 制作 吴青峰 / 陈君豪',
    sources: [
      source('release', 'UMG 提供的 YouTube 发行元数据（Qing Feng Wu - Topic）', 'https://www.youtube.com/watch?v=9RwvtMdTNNw', expandedAt),
      source('mv', 'QingfengwuVEVO · 官方 MV 署名', 'https://www.youtube.com/watch?v=0HwxT8--sA8', expandedAt),
    ],
    credits: [
      ...credited('吴青峰', ['作词', '作曲', '编曲', '制作人'], 'release'),
      ...credited('陈君豪', ['编曲', '制作人'], 'release'),
      ...credited('黄文萱', ['混音'], 'release'),
    ],
  },
  'real-marry-me-today': {
    recordingLabel: '陶喆《太美丽》第 10 首 · 录音室对唱版', creditSummary: '词 陶喆 / 娃娃 · 曲 陶喆',
    sources: [
      source('release', 'Apple Music ·《太美丽》曲目（℗ Gold Typhoon Taiwan）', 'https://music.apple.com/tw/album/%E4%BB%8A%E5%A4%A9%E5%A6%B3%E8%A6%81%E5%AB%81%E7%B5%A6%E6%88%91-feat-%E8%94%A1%E4%BE%9D%E6%9E%97/905198155?i=905198184', expandedAt),
      source('distributor', '蔡依林方发行元数据（StreetVoice 提供，Jolin Tsai - Topic）', 'https://www.youtube.com/watch?v=2T4wxPcJTuw', expandedAt),
      source('credits', 'Timeless Music · 4K MV 词曲署名', 'https://www.youtube.com/watch?v=ooZvPnFIjpw', expandedAt),
    ],
    credits: [
      ...credited('陶喆', ['作词', '作曲'], 'credits'),
      ...credited('娃娃', ['作词'], 'credits'),
      ...credited('陶喆', ['制作人'], 'distributor'),
    ],
  },
  'real-who-am-i': {
    recordingLabel: '《狼殿下》影视原声带第 1 首 · 录音室版', creditSummary: '词 梁锦兴 / Jony J（Rap）· 曲 MOURICE / KINGMING',
    sources: [
      source('release', 'Apple Music · 演出艺人署名', 'https://music.apple.com/jp/song/%E6%88%91%E6%98%AF%E8%AA%B0-%E9%9B%BB%E8%A6%96%E5%8A%87-%E7%8B%BC%E6%AE%BF%E4%B8%8B-%E4%B8%BB%E9%A1%8C%E6%9B%B2/1546121549', expandedAt),
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/track/3oTmOv9KjIcOfRTfGH5c62', expandedAt),
    ],
    credits: [
      ...credited('梁锦兴', ['作词'], 'vocal'),
      ...credited('Jony J', ['Rap 作词'], 'vocal'),
      ...credited('MOURICE', ['作曲'], 'vocal'),
      ...credited('KINGMING', ['作曲'], 'vocal'),
    ],
  },
  'real-no-more-u': {
    recordingLabel: '2021《来者何人{}》第 1 首 · 录音室对唱版（NSMG）', creditSummary: '词 张杰AJ · 曲 张杰AJ / 周菲比',
    sources: [
      source('release', 'Apple Music · 曲目署名', 'https://music.apple.com/tw/album/%E5%86%8D%E4%B9%9F%E6%B2%92%E6%9C%89%E4%BD%A0-feat-%E9%99%B3%E5%8B%A2%E5%AE%89/1719573311?i=1719573313', expandedAt),
    ],
    credits: [
      ...credited('张杰AJ', ['作词', '作曲', '制作人'], 'vocal'),
      ...credited('周菲比', ['作曲', '编曲'], 'vocal'),
      ...credited('陈陆泰', ['混音'], 'vocal'),
    ],
  },
  'real-ordinary-people': {
    recordingLabel: '2017 单曲（相信音乐）· 发行信息未标明录音室或现场', creditSummary: '词曲 李宗盛（原曲）',
    sources: [
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/embed/track/3M6DkD5SjZ140lf7V6OxPz', expandedAt),
      source('release', 'Apple Music · 单曲发行信息', 'https://music.apple.com/tw/album/%E5%87%A1%E4%BA%BA%E6%AD%8C-feat-%E8%95%AD%E6%95%AC%E9%A8%B0/1217343555', expandedAt),
      source('writing', 'Apple Music · 李宗盛原版词曲署名', 'https://music.apple.com/tw/song/1719081239', expandedAt),
    ],
    credits: [
      ...credited('李宗盛', ['作词', '作曲'], 'writing'),
    ],
  },
  'real-dont-say-never-loved-live': {
    recordingLabel: '2026 电视节目现场音频（℗ 芒果TV）', creditSummary: '词曲 韦礼安（原唱）· 改编 Terence Teo',
    sources: [
      source('qq', 'QQ 音乐 · 歌曲资料接口', 'https://u.y.qq.com/cgi-bin/musicu.fcg?data=%7B%22songinfo%22%3A%7B%22module%22%3A%22music.pf_song_detail_svr%22%2C%22method%22%3A%22get_song_detail_yqq%22%2C%22param%22%3A%7B%22song_mid%22%3A%22002idxL60z9ORp%22%7D%7D%7D', expandedAt),
      source('credits', 'QQ 音乐 · 歌词接口中的制作署名', 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=002idxL60z9ORp&format=json&nobase64=1&g_tk=5381', expandedAt),
      source('mv', '芒果TV音乐官方频道 · 节目纯享片段', 'https://www.youtube.com/watch?v=d2owNH6AQ9A', expandedAt),
    ],
    credits: [
      ...credited('韦礼安', ['作词', '作曲'], 'credits'),
      ...credited('汤佩弦', ['制作人'], 'credits'),
      ...credited('谷粟', ['制作人', '音乐总监'], 'credits'),
      ...credited('Terence Teo', ['改编编曲'], 'credits'),
    ],
  },
  'real-us-afterwards-live': {
    recordingLabel: '2018 官方现场影片 · 未见音频发行（非《自传》录音室原版）', creditSummary: '词 阿信 · 曲 怪兽',
    sources: [
      source('press', '镜周刊 · 演唱会报道（相信音乐提供照片）', 'https://www.mirrormedia.mg/story/20180826ent005', expandedAt),
    ],
    credits: [
      ...credited('阿信', ['作词'], 'vocal'),
      ...credited('怪兽', ['作曲'], 'vocal'),
      ...credited('周恒毅', ['编曲'], 'vocal'),
      ...credited('五月天', ['编曲', '演奏'], 'vocal'),
      ...credited('林依霖', ['和声'], 'vocal'),
    ],
  },
  'real-not-truly-happy-sky-live': {
    recordingLabel: '《Life Live 好友加班篇》收录的 feat. 蔡依林 现场联唱（未核对与影片是否同一场）', creditSummary: '两曲联唱 · 词曲按作品分别署名',
    sources: [
      source('release', 'Apple Music ·《Life Live 好友加班篇》曲目', 'https://music.apple.com/hk/album/1463565278', expandedAt),
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/embed/track/5qnQs7YAgDTQTIfLPQ4CMJ', expandedAt),
    ],
    credits: [
      ...credited('阿信', ['《你不是真正的快乐》作词', '《你不是真正的快乐》作曲'], 'vocal'),
      ...credited('卫斯理', ['《天空》作词', '《天空》作曲'], 'vocal'),
      ...credited('小米', ['《天空》作词'], 'vocal'),
      ...credited('于京延', ['编曲'], 'vocal'),
      ...credited('林依霖', ['编曲', '和声'], 'vocal'),
      ...credited('五月天', ['演奏'], 'vocal'),
    ],
  },
  'real-leave-the-earth-live': {
    recordingLabel: '《Life Live 好友加班篇》第 5 首 · 现场合唱版（未核对与影片是否同一场；非乐团独唱现场版与 2007 录音室版）', creditSummary: '词曲 阿信',
    sources: [
      source('release', 'Apple Music · 现场专辑曲目', 'https://music.apple.com/hk/song/1463565284', expandedAt),
      source('news', '相信音乐 · 现场专辑发布说明（2019.05.21）', 'https://www.bin-music.com.tw/news/1030', expandedAt),
    ],
    credits: [
      ...credited('阿信', ['作词', '作曲'], 'vocal'),
    ],
  },
  'real-if-i-were-young-live': {
    recordingLabel: '2023 官方现场视频 · 未见音频发行（原版为李荣浩独唱）', creditSummary: '词曲 李荣浩',
    sources: [
      source('press', '中华网（看点时报）· 南宁站报道', 'https://m.tech.china.com/hea/article/20231212/122023_1454771.html', expandedAt),
    ],
    credits: [
      ...credited('李荣浩', ['作词', '作曲', '编曲'], 'vocal'),
    ],
  },
  'real-who-do-you-love-live': {
    recordingLabel: '2024 JJ20 重庆站终场现场 · QQ 音乐有同场现场音轨（无专辑；原版为陶喆独唱）', creditSummary: '词 陶喆 / 娃娃 · 曲 陶喆',
    sources: [
      source('press', '凤凰网安徽 · 重庆站报道', 'https://ah.ifeng.com/c/8eGaT2PLST0', expandedAt),
    ],
    credits: [
      ...credited('陶喆', ['作词', '作曲', '编曲'], 'vocal'),
      ...credited('娃娃', ['作词'], 'vocal'),
    ],
  },
  'real-double-shadow': {
    recordingLabel: '2018 单曲 · 录音室对唱版（EMI / 环球音乐台湾）', creditSummary: '词 易家扬 · 曲 丁薇',
    sources: [
      source('label', '环球音乐台湾 · 发行链接页', 'https://lnk.to/aMEI_Shadow', expandedAt),
      source('store', 'Spotify · 曲目艺人', 'https://open.spotify.com/track/63ikyYl9l9M4HNOzJJhaiS', expandedAt),
      source('release', 'Apple Music · 单曲艺人署名', 'https://music.apple.com/tw/album/%E9%9B%99%E5%BD%B1-%E6%88%B2%E5%8A%87-%E5%A6%82%E6%87%BF%E5%82%B3-%E4%B8%BB%E9%A1%8C%E6%9B%B2/1834197977', expandedAt),
    ],
    credits: [
      ...credited('易家扬', ['作词'], 'vocal'),
      ...credited('丁薇', ['作曲', '编曲'], 'vocal'),
      ...credited('Jim Lee', ['编曲', '制作人'], 'vocal'),
    ],
  },
  'real-shouldve-let-go': {
    recordingLabel: '2020 单曲 · 录音室版（℗ TEAM WANG records）', creditSummary: '词 林怡凤 · 曲 林俊杰 / 王嘉尔 / BOYTOY',
    sources: [
      source('store', 'Deezer · 曲目艺人角色', 'https://api.deezer.com/track/1176813952', expandedAt),
      source('credits', 'LINE MUSIC · 词曲署名', 'https://music-tw.line.me/track/3515038001', expandedAt),
      source('promo', '远传铃声馆 · 发行文案', 'https://istyle2.e7play.com/m/ringtone/web/album.jsp?aid=73028', expandedAt),
    ],
    credits: [
      ...credited('林怡凤', ['作词'], 'credits'),
      ...credited('林俊杰', ['作曲'], 'credits'),
      ...credited('王嘉尔', ['作曲'], 'credits'),
      ...credited('BOYTOY', ['作曲'], 'credits'),
    ],
  },
};

// QQ 音乐同版本直达 (user decision 2026-09-29; the PRD's 不外跳 rule is changed pending the product owner).
// A link is listed only where QQ Music has a page for this same recording and version, checked from its
// metadata alone: nothing was played or compared by ear. Evidence and method:
// references/research/2026-09-29/qq-music-links.{md,json}. `singers` is QQ Music's own vocal credit, which
// the pages show even where it differs from the two singers on our edge (说好不哭, 等你下课, 私奔到月球).
const qqCheckedAt = '2026-09-29';
const qqLinks = {
  'real-bu-gai': ['000sxzol11raSd', ['周杰伦', '张惠妹']],
  'real-far-away': ['003FRy0r0wyGHl', ['周杰伦', '费玉清']],
  'real-wont-cry': ['001qvvgF38HVc4', ['周杰伦']],
  'real-waiting-for-you': ['00176bPZ2wu39R', ['周杰伦']],
  'real-sand-painting': ['001tCE0T2vR5p5', ['袁咏琳', '周杰伦']],
  'real-a-moment': ['004QYBHS1kwnCM', ['张惠妹', '萧敬腾']],
  'real-hello': ['003BtUeT4PTqns', ['萧敬腾', '林俊杰']],
  'real-dimples': ['003h3CYS3UxDB4', ['林俊杰', '蔡卓妍']],
  'real-summer-breeze': ['0018qunY0L4Bkx', ['金莎', '林俊杰']],
  'real-beautiful': ['0038BQfx4MB0MR', ['林俊杰', 'G.E.M.邓紫棋']],
  'real-stay-with-you-english': ['002xmBmi1c2eMG', ['林俊杰', '孙燕姿']],
  'real-coral-sea': ['001K0AjL2huSxx', ['周杰伦', 'Lara梁心颐']],
  'real-try': ['001faq2u0gVP6j', ['派伟俊', '周杰伦']],
  'real-equal-terms': ['001wG84E4bOj3V', ['李荣浩', '张惠妹']],
  'real-how-much-i-love-you': ['003LqdzX0edhb9', ['萧敬腾', '林宥嘉']],
  'real-sincerely-yours': ['003Iq94Q0SnePV', ['阿肆', '林宥嘉']],
  'real-dont-force-it': ['00207tA52BLqom', ['G.E.M.邓紫棋', 'Eric周兴哲']],
  'real-when-you-loved-me': ['0036P9kz3IG3qu', ['单依纯', 'Eric周兴哲']],
  'real-tenderness-20th': ['000qzndv3RJUjM', ['五月天', '孙燕姿']],
  'real-elope-to-the-moon': ['000EZEV00EZCHo', ['五月天', '陈绮贞']],
  'real-drunk-ah-q': ['001LID6n1Szd9Z', ['吴青峰', '孙燕姿']],
  'real-marry-me-today': ['0008aOkA3v4X0Q', ['陶喆', '蔡依林']],
  'real-who-am-i': ['003PzotY0CRLex', ['蔡依林', 'Jony J']],
  'real-no-more-u': ['002XUx9q3uv72w', ['Lara梁心颐', '陈势安']],
  'real-ordinary-people': ['000X6Og627LKMd', ['五月天', '萧敬腾']],
  'real-dont-say-never-loved-live': ['002idxL60z9ORp', ['林宥嘉', 'Eric周兴哲']],
  'real-not-truly-happy-sky-live': ['001tKUw30RmbDH', ['五月天', '蔡依林']],
  'real-leave-the-earth-live': ['003kIzSf0LkDco', ['五月天', '李荣浩']],
  'real-who-do-you-love-live': ['003Pfh2Z4UdNF4', ['林俊杰', '陶喆']],
  'real-double-shadow': ['000P5BUK4HpaLo', ['张惠妹', '林忆莲']],
  'real-shouldve-let-go': ['003vjg9A0VCFfh', ['王嘉尔', '林俊杰']],
};
// The six recordings without a same-version page say why; nothing is linked in their place.
// 黑暗骑士 (qq-pending) has the same album track on QQ (001tzPHJ436zJl), credited to the band: it waits
// for the product owner's 五月天 / 阿信 node rule. 屋顶's likely master on a later compilation is not taken.
const qqUnavailable = {
  'real-dark-knight': ['qq-pending', 'QQ 音乐的演唱署名是五月天整团，没有单列阿信，暂不放入口'],
  'real-jay-jj-medley': ['qq-no-same-version', 'QQ 音乐只有《稻香》段落，没有两人的完整联唱'],
  'real-give-me-a-song-live': ['qq-no-same-version', 'QQ 音乐的《超时代演唱会》现场专辑没有收录这首'],
  'real-rooftop': ['qq-no-same-version', 'QQ 音乐的《有点野》缺第 11 首，精选里的同曲不是这张专辑的发行'],
  'real-us-afterwards-live': ['qq-no-same-version', '这段现场只见官方影片，未见音频发行'],
  'real-if-i-were-young-live': ['qq-no-same-version', 'QQ 音乐的现场音轨无法确认是南宁站这一场'],
};
/** Does QQ Music credit exactly our two singers (by name or alias, e.g. G.E.M.邓紫棋)? If not, the page
 *  shows QQ's own credit beside the link. */
function qqCreditMatches(artistIds, singers) {
  if (singers.length !== artistIds.length) return false;
  return artistIds.every(id => {
    const [, name, aliases] = artistEntries.find(entry => entry[0] === id);
    return singers.some(singer => [name, ...aliases].some(alias => singer.toLowerCase().includes(alias.toLowerCase())));
  });
}
function listening(recording) {
  const linked = qqLinks[recording.id];
  if (linked) {
    const [songmid, singers] = linked;
    return {
      listenLinks: [{ provider: 'qq', label: 'QQ 音乐', url: `https://y.qq.com/n/ryqq/songDetail/${songmid}`, songmid,
        credit: singers.join(' / '), singers, creditMatches: qqCreditMatches(recording.artists, singers), checkedAt: qqCheckedAt }],
      listenStatus: 'qq-same-version',
    };
  }
  const [status, reason] = qqUnavailable[recording.id] || ['qq-unverified', '尚未核对 QQ 音乐'];
  return { listenLinks: [], listenStatus: status, listenReason: reason, listenCheckedAt: qqCheckedAt };
}

export const realSongs = Object.fromEntries(recordings.map(recording => {
  const details = contributions[recording.id];
  const at = recording.checkedAt || checkedAt;
  return [recording.id, {
    ...recording, dataset: 'real', audioAvailable: false, checkedAt: at,
    recordingLabel: details.recordingLabel, creditSummary: details.creditSummary,
    creditsScope: 'selected-verified',
    credits: [
      ...recording.artists.map(artistId => ({ artistId, name: artistEntries.find(entry => entry[0] === artistId)[1], role: '演唱', sourceId: 'vocal' })),
      ...details.credits,
    ],
    creditSources: [source('vocal', recording.sourceLabel, recording.sourceUrl, at), ...details.sources],
    // Still no audio in the app: a same-version QQ Music page opens outside it (see qqLinks).
    ...listening(recording),
  }];
}));
/** How many recordings open the same recording on QQ Music; the about dialog quotes it. */
export const qqLinkedCount = Object.values(realSongs).filter(song => song.listenLinks.length).length;

// `entity: 'group'` marks a band node (五月天); every other entry is one singer.
export const realArtists = artistEntries.map(([id, name, aliases, color, bio, extra]) => {
  const songIds = recordings.filter(recording => recording.artists.includes(id)).map(recording => recording.id);
  return { id, name, aliases, color, bio, ...extra, dataset: 'real', songIds, tag: `本专题收录 ${songIds.length} 首合作` };
});

export const realEdges = recordings.map(recording => ({
  id: `real-co-${recording.id.slice(5)}`, dataset: 'real',
  a: recording.artists[0], b: recording.artists[1], mode: 'co', song: recording.id,
  reason: '共同演唱', evidence: recording.evidence,
  sourceUrl: recording.sourceUrl, sourceLabel: recording.sourceLabel, checkedAt: recording.checkedAt || checkedAt,
}));

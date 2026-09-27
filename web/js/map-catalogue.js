// A small, manually checked catalogue of credited vocal collaborations.
// Metadata and outbound official links only: no audio, lyrics or cover images.
// Evidence: references/research/2026-09-27/real-catalogue-sources.md and vocal-network-expansion.md
export const REAL_CATALOGUE_VERSION = 'real-vocal-2026-09-v3';
const checkedAt = '2026-09-27';
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
];

const recordings = [
  {
    id: 'real-bu-gai', title: '不该', artists: ['real-jay', 'real-amei'],
    versionLabel: '周杰伦 × aMEI 官方 MV', videoId: '_VxLOj3TB5k',
    sourceUrl: 'https://jvrmusic.com.tw/artist/gallery/detail/1212682331903627264?lang=zh_CN&type=',
    sourceLabel: '杰威尔音乐 ·《幻城》原声带',
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
];

// A credit belongs to a specific recording, not to an artist in general.
// Keep one role/source pair per row so co-vocal graph edges stay unambiguous.
const source = (id, label, url) => ({ id, label, url, checkedAt });
const credited = (name, roles, sourceId) => roles.map(role => ({
  name, role, sourceId,
  ...(artistEntries.find(entry => entry[1] === name) ? { artistId: artistEntries.find(entry => entry[1] === name)[0] } : {}),
}));
const contributions = {
  'real-dark-knight': {
    recordingLabel: '《因你而在》· 录音室版', creditSummary: '词 阿信 · 曲 林俊杰 · 编曲 五月天',
    sources: [],
    credits: [
      ...credited('阿信', ['作词'], 'vocal'),
      ...credited('林俊杰', ['作曲'], 'vocal'),
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
    recordingLabel: '《周杰伦的床边故事》· 录音室版', creditSummary: '词 方文山 · 曲 周杰伦',
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
};

export const realSongs = Object.fromEntries(recordings.map(recording => {
  const details = contributions[recording.id];
  return [recording.id, {
    ...recording, dataset: 'real', audioAvailable: false, checkedAt,
    recordingLabel: details.recordingLabel, creditSummary: details.creditSummary,
    creditsScope: 'selected-verified',
    credits: [
      ...recording.artists.map(artistId => ({ artistId, name: artistEntries.find(entry => entry[0] === artistId)[1], role: '演唱', sourceId: 'vocal' })),
      ...details.credits,
    ],
    creditSources: [source('vocal', recording.sourceLabel, recording.sourceUrl), ...details.sources],
    // QQ Music is preferred. No same-version direct link has been verified yet.
    listenLinks: [], listenStatus: 'qq-unverified',
  }];
}));

export const realArtists = artistEntries.map(([id, name, aliases, color, bio]) => {
  const songIds = recordings.filter(recording => recording.artists.includes(id)).map(recording => recording.id);
  return { id, name, aliases, color, bio, dataset: 'real', songIds, tag: `本专题收录 ${songIds.length} 首合作` };
});

export const realEdges = recordings.map(recording => ({
  id: `real-co-${recording.id.slice(5)}`, dataset: 'real',
  a: recording.artists[0], b: recording.artists[1], mode: 'co', song: recording.id,
  reason: '共同演唱', evidence: recording.evidence,
  sourceUrl: recording.sourceUrl, sourceLabel: recording.sourceLabel, checkedAt,
}));

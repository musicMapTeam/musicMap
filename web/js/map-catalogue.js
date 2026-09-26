// A small, manually checked catalogue of credited vocal collaborations.
// Metadata and outbound official links only: no audio, lyrics or cover images.
// Evidence and metadata-check details: references/research/2026-09-27/real-catalogue-sources.md
export const REAL_CATALOGUE_VERSION = 'real-vocal-2026-09-v1';
const checkedAt = '2026-09-27';
const warnerJam = 'https://www.warnermusic.com.tw/blog/posts/與蕭敬騰與合唱的必聽歌曲-蕭敬騰合唱-禁愛條款-張惠妹一眼瞬間-林俊傑hello';
const warnerGenesis = 'https://www.warnermusic.com.tw/products/《新地球-genesis-發行版-─-天sky》';

const artistEntries = [
  ['real-jay', '周杰伦', ['周杰倫', 'Jay Chou'], '#FF7E59', '从《不该》出发，沿一次合唱走到下一位艺人'],
  ['real-amei', '张惠妹', ['張惠妹', 'aMEI', 'A-Mei'], '#DF8F99', '《不该》与《一眼瞬间》，两次不同的声音相遇'],
  ['real-jam', '萧敬腾', ['蕭敬騰', 'Jam Hsiao'], '#D8B474', '从张惠妹的《一眼瞬间》，走向与林俊杰合唱的《Hello》'],
  ['real-jj', '林俊杰', ['林俊傑', 'JJ Lin'], '#70DDCF', '在《Hello》之后，继续寻找另一首双人对唱'],
  ['real-fei', '费玉清', ['費玉清', 'Fei Yu-ching'], '#C9C0A2', '沿《千里之外》，回到与周杰伦的这次合唱'],
  ['real-ashin', '阿信', ['五月天阿信', '五月天 阿信', 'Mayday Ashin'], '#B2BDDF', '《说好不哭》的合唱署名是阿信，并非五月天全团'],
  ['real-gary', '杨瑞代', ['楊瑞代', 'Gary Yang', 'Gary'], '#A6C5AC', '在《等你下课》中，听见两位合唱者的名字'],
  ['real-cindy', '袁咏琳', ['袁詠琳', 'Cindy Yen'], '#D9AAC9', '从《画沙》的双人署名，开始这一小段探索'],
  ['real-charlene', '蔡卓妍', ['A-Sa', '阿Sa', 'Charlene Choi'], '#E0BC85', '沿《小酒窝》，认识这首歌里的另一位合唱者'],
  ['real-jinsha', '金莎', ['Jin Sha', 'Kym'], '#BACE98', '从《被风吹过的夏天》出发，接着探索林俊杰的合作'],
  ['real-gem', '邓紫棋', ['鄧紫棋', 'G.E.M.', 'GEM'], '#D49D9B', '在《手心的蔷薇》中，与林俊杰的声音相连'],
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
];

export const realSongs = Object.fromEntries(recordings.map(recording => [recording.id, {
  ...recording, dataset: 'real', audioAvailable: false, checkedAt,
  credits: recording.artists.map(artistId => ({ artistId, role: '演唱' })),
  listenLinks: [{ label: '官方 MV', platform: 'YouTube', url: `https://www.youtube.com/watch?v=${recording.videoId}` }],
}]));

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

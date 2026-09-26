export const SPACE_EVENT = {
  id: 'echo-live-2026',
  title: '回声现场',
  subtitle: '夏末特别场',
  date: '2026.09.26',
  city: '广州',
  artists: ['林间', '乔屿'],
  song: '把晚风借给你',
  trackId: 'co-0',
  artistId: 'a',
};

export const SPACE_ACTORS = {
  a: { id: 'a', name: 'Lin', initial: 'L', perspective: '舞台这一面', color: 'mint' },
  b: { id: 'b', name: '阿遥', initial: '遥', perspective: '人海这一面', color: 'coral' },
};

export const SPACE_MOMENTS = [
  { id: 'encore', name: '返场', phrase: '最后一首，还想再听一次。' },
  { id: 'chorus', name: '全场合唱', phrase: '这一句，我们一起唱了。' },
  { id: 'lights', name: '灯光亮起', phrase: '灯光亮起的瞬间，我记住了。' },
];

export const SPACE_PHOTOS = {
  stage: {
    id: 'stage',
    name: '我的舞台',
    description: '舞台视角 · 示例图片',
    url: new URL('../assets/stage-scene.png', import.meta.url).href,
  },
  crowd: {
    id: 'crowd',
    name: '你的人海',
    description: '人海视角 · 示例图片',
    url: new URL('../assets/crowd-scene.png', import.meta.url).href,
  },
};

export function seedSpaceCard(owner = 'b') {
  return {
    id: `live-card-${owner}`,
    revision: 1,
    owner,
    eventId: SPACE_EVENT.id,
    photoKey: owner === 'a' ? 'stage' : 'crowd',
    photoDataUrl: '',
    momentId: 'encore',
    trackId: SPACE_EVENT.trackId,
    caption: owner === 'a' ? '灯光暗下去，还舍不得说再见。' : '你在看舞台，我拍下了和你一起唱歌的人海。',
    isPublic: owner === 'b',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  };
}

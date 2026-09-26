// Fictional fixtures carried forward from product/prototype/demo-data.js.
// These names, tracks and links demonstrate the product, not a real catalogue.
export const MAP_DATA_VERSION = 'fictional-2026-09-v1';
export const MAP_EVENT_ID = 'echo-live-2026';

export const artists = [
  { id: 'a', name: '林间', tag: '流行 / R&B', color: '#df8a72', bio: '从熟悉的旋律出发', songs: ['晚风来信', '慢半拍', '回声里的你'] },
  { id: 'b', name: '乔屿', tag: '流行 / 灵魂乐', color: '#a7c7ca', bio: '温柔声线，城市夜色', songs: ['零点以后', '雨停之前', '留一盏灯'] },
  { id: 'c', name: '夏禾', tag: '流行 / 民谣', color: '#b6c590', bio: '把日常唱成小小风景', songs: ['晴天邮局', '山的另一边', '长椅'] },
  { id: 'd', name: '陆遥', tag: 'R&B / 电子', color: '#e4bc80', bio: '在节拍里寻找新的方向', songs: ['失重电台', '夜航', '不眠频道'] },
  { id: 'e', name: '白川', tag: '独立 / 民谣', color: '#8cc8c2', bio: '一把吉他，一段远行', songs: ['海边慢车', '北纬三十度', '路过人间的风'] },
  { id: 'f', name: '南枝', tag: '独立 / 电子', color: '#c9aec5', bio: '轻盈的声音，意外的转弯', songs: ['透明岛屿', '低空飞行', '闪光片刻'] },
  { id: 'g', name: '阿澄', tag: '流行 / R&B', color: '#e8998a', bio: '把心事交给律动', songs: ['日落之前', '不说晚安', '月亮车站'] },
  { id: 'h', name: '许岸', tag: '民谣 / 爵士', color: '#ccc698', bio: '给世界按下慢放', songs: ['星期天散步', '一封旧信', '远山的影子'] },
  { id: 'i', name: '孤岛来客', tag: '实验 / 氛围', color: '#aab3c0', bio: '暂无合作连接的示例艺人', songs: ['无人的海', '缓慢生长', '漂浮'] },
];

export const artistById = Object.fromEntries(artists.map(artist => [artist.id, artist]));
export const songs = Object.fromEntries(artists.flatMap(artist => artist.songs.map((title, index) => {
  const id = `${artist.id}-${index}`;
  return [id, { id, title, artists: [artist.id], audioAvailable: false }];
})));

const cooperation = [
  ['a', 'b', '把晚风借给你'], ['a', 'c', '晴天来信'], ['a', 'd', '城市夜航'], ['a', 'g', '夏日回声'],
  ['b', 'd', '零点航线'], ['b', 'e', '雨后慢车'], ['c', 'e', '山海之间'], ['c', 'h', '远山邮局'],
  ['d', 'f', '失重岛屿'], ['e', 'f', '透明海岸'], ['f', 'g', '低空日落'], ['g', 'h', '月亮散步'],
];
const style = [
  ['a', 'f', '舒缓节拍'], ['a', 'e', '轻柔人声'], ['a', 'g', 'R&B'], ['b', 'h', '灵魂与爵士'],
  ['c', 'e', '民谣'], ['d', 'f', '电子'], ['f', 'i', '氛围织体'], ['g', 'b', '流行'],
];

export const edges = [
  ...cooperation.map(([a, b, title], index) => {
    const id = `co-${index}`;
    songs[id] = { id, title, artists: [a, b], audioAvailable: false };
    return { id, a, b, mode: 'co', song: id, reason: '共同演唱', evidence: `示例合作作品《${title}》；虚构关系，仅用于交互演示。` };
  }),
  ...style.map(([a, b, reason], index) => ({
    id: `style-${index}`, a, b, mode: 'style', reason,
    evidence: `以「${reason}」连接的示例风格标签，未使用音频分析或推荐模型；不代表合作关系。`,
  })),
];

export const artistName = id => artistById[id]?.name || '未收录艺人';
export const otherArtist = (edge, id) => edge.a === id ? edge.b : edge.a;
export const getNeighbors = (id, mode = 'co') => edges.filter(edge => edge.mode === mode && (edge.a === id || edge.b === id));

export function isReachable(start, target) {
  const visited = new Set([start]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (id === target) return true;
    for (const edge of getNeighbors(id, 'co')) {
      const next = otherArtist(edge, id);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

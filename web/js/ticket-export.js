import { SPACE_PHOTOS, SPACE_MOMENTS } from './space-data.js';

const ink = '#0c1016';
const paper = '#f2efe7';
const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
const perspectives = { stage: '舞台', crowd: '人海', friends: '身边', detail: '细节' };
const loadImage = source => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('照片暂时无法读取，请稍后再保存票根。'));
  image.src = source;
});
function canvasBase() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 1600, 1800);
  return { canvas, ctx };
}
function heading(ctx, info, secondLine) {
  ctx.fillStyle = ink;
  ctx.font = `900 122px Arial, ${font}`;
  ctx.fillText('SAME SHOW.', 90, 188);
  ctx.fillText(secondLine, 90, 312);
  ctx.fillStyle = '#ff7e59'; ctx.fillRect(90, 360, 1420, 6);
  ctx.fillStyle = ink;
  ctx.font = `600 34px ${font}`;
  wrapText(ctx, [info.title, info.subtitle].filter(Boolean).join(' / '), 90, 418, 1420, 44, 2);
  const metadata = [info.eventDate, info.city].filter(Boolean).join(' · ');
  if (metadata) { ctx.font = `400 24px ${font}`; fitLine(ctx, metadata, 90, 504, 1420, 24); }
}
function drawPhoto(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale; const h = image.height * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  ctx.drawImage(image, x - (w - width) / 2, y - (h - height) / 2, w, h);
  ctx.restore();
}
function photoDisclosure(ctx, card, x, y) {
  if (card.photoId || card.photoDataUrl) return;
  ctx.fillStyle = ink; ctx.fillRect(x + 16, y + 16, 220, 44);
  ctx.fillStyle = paper; ctx.font = `500 24px ${font}`;
  ctx.fillText('AI 生成示例照片', x + 29, y + 46);
}
function footer(ctx, info, paired) {
  ctx.fillStyle = ink; ctx.font = `400 22px ${font}`;
  const stamp = new Date(info.createdAt || Date.now()).toLocaleDateString('zh-CN');
  ctx.fillText(`${stamp} · ${paired ? '双方已同意共同署名' : '我的现场纪念'}`, 90, 1654);
  // The original local demo omits isDemo; keep its disclosure.
  ctx.fillText(`MUSIC MAP × MUSIC SPACE${info.isDemo === false ? '' : ' / 现场与歌曲为示例内容'}`, 90, 1701);
  ctx.textAlign = 'right'; ctx.font = '700 22px Arial';
  ctx.fillText(paired ? 'YOUR VIEW. THEIR VIEW. ONE MEMORY.' : 'MY VIEW. MY MOMENT.', 1510, 1750);
  ctx.textAlign = 'left';
}
async function saveCanvas(canvas, id, prefix) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片暂时未能生成，请重试。');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${prefix}-${String(id || Date.now()).slice(0, 12)}.png`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/** Render accepted snapshots. Real rooms supply authorized photo blob URLs. */
export async function downloadTicket(cards, info) {
  const images = await Promise.all(cards.map(card => loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url)));
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  heading(ctx, info, 'TWO STORIES.');
  ctx.font = `800 48px ${font}`;
  fitLine(ctx, `${cards[0].ownerName || cards[0].name || '你'}  ×  ${cards[1].ownerName || cards[1].name || '同场的朋友'}`, 90, 565, 1420, 48);
  images.forEach((image, index) => {
    const x = 90 + index * 730;
    drawPhoto(ctx, image, x, 610, 690, 500);
    const card = cards[index];
    photoDisclosure(ctx, card, x, 610);
    ctx.fillStyle = ink; ctx.font = `700 28px ${font}`;
    const moment = SPACE_MOMENTS.find(item => item.id === card.momentId)?.name || '现场瞬间';
    ctx.fillText(`${index + 1} / ${moment}${card.perspective ? ` · ${perspectives[card.perspective] || '视角'}` : ''}`, x, 1170);
    ctx.font = `400 29px ${font}`;
    wrapText(ctx, (card.caption || '这一刻，想和你一起记住。').replace(/\s+/g, ' '), x, 1230, 674, 45, 5);
  });
  ctx.fillStyle = '#70ddcf'; ctx.fillRect(90, 1484, 1420, 106);
  ctx.fillStyle = ink; ctx.font = `700 30px ${font}`;
  const sharedSong = cards[0].trackId && cards[0].trackId === cards[1].trackId && info.song;
  fitLine(ctx, sharedSong ? `共同记忆 / ${info.song}` : '把现场，交换着记住。', 122, 1551, 1110, 30);
  ctx.textAlign = 'right'; ctx.font = '900 27px Arial'; ctx.fillText('EXCHANGED', 1474, 1549); ctx.textAlign = 'left';
  footer(ctx, info, true);
  await saveCanvas(canvas, info.id, 'music-space');
}
/** A private card has value before anyone else joins the room. */
export async function downloadCard(card, info) {
  const image = await loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url);
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  heading(ctx, info, 'MY STORY.');
  ctx.font = `800 44px ${font}`;
  fitLine(ctx, card.ownerName || card.name || '我的现场', 90, 565, 1420, 44);
  drawPhoto(ctx, image, 90, 610, 1420, 690);
  photoDisclosure(ctx, card, 90, 610);
  const moment = SPACE_MOMENTS.find(item => item.id === card.momentId)?.name || '现场瞬间';
  ctx.fillStyle = ink; ctx.font = `700 28px ${font}`;
  ctx.fillText(`${moment} · ${perspectives[card.perspective] || '我的视角'}`, 90, 1360);
  ctx.font = `400 31px ${font}`;
  wrapText(ctx, (card.caption || '这一刻，先为自己留住。').replace(/\s+/g, ' '), 90, 1420, 1420, 46, 2);
  ctx.fillStyle = '#70ddcf'; ctx.fillRect(90, 1526, 1420, 68);
  ctx.fillStyle = ink; ctx.font = `700 26px ${font}`;
  fitLine(ctx, card.trackId && info.song ? `♪ ${info.song}` : '一张卡，留住我记得的这一刻。', 116, 1570, 1368, 26);
  footer(ctx, info, false);
  await saveCanvas(canvas, info.id || card.id, 'music-space-my-card');
}
function fitLine(ctx, text, x, y, width, size) {
  const weight = ctx.font.match(/^\d+/)?.[0] || '500';
  while (ctx.measureText(text).width > width && size > 18) { size -= 1; ctx.font = `${weight} ${size}px ${font}`; }
  ctx.fillText(text, x, y, width);
}
function wrapText(ctx, text, x, y, width, lineHeight, maxRows = Infinity) {
  let line = ''; let row = 0;
  for (const char of text) {
    if (char === '\n' || ctx.measureText(line + char).width > width) {
      if (row === maxRows - 1) { ctx.fillText(`${line.slice(0, -1)}…`, x, y + row * lineHeight); return; }
      ctx.fillText(line, x, y + row * lineHeight); row += 1; line = char === '\n' ? '' : char;
    } else line += char;
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
}

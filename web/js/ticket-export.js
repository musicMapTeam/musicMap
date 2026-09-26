import { SPACE_PHOTOS, SPACE_MOMENTS } from './space-data.js';

const loadImage = source => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('照片暂时无法读取，请稍后再保存票根。'));
  image.src = source;
});

/** Render the user's accepted card snapshots into a portable, full-size souvenir. */
export async function downloadTicket(cards, info) {
  const images = await Promise.all(cards.map(card => loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url)));
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  const ink = '#0c1016';
  const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillStyle = '#f2efe7'; ctx.fillRect(0, 0, 1600, 1800);
  ctx.fillStyle = ink;
  ctx.font = `900 122px Arial, ${font}`;
  ctx.fillText('SAME SHOW.', 90, 188);
  ctx.fillText('TWO STORIES.', 90, 312);
  ctx.fillStyle = '#ff7e59'; ctx.fillRect(90, 360, 1420, 6);
  ctx.fillStyle = ink;
  ctx.font = `500 32px ${font}`;
  ctx.fillText(`${info.title} / ${info.subtitle}`, 90, 434);
  ctx.font = `800 52px ${font}`;
  fitLine(ctx, `${cards[0].ownerName || cards[0].name || '你'}  ×  ${cards[1].ownerName || cards[1].name || '同场的朋友'}`, 90, 522, 1420, 52, font);
  images.forEach((image, index) => {
    const x = 90 + index * 730;
    const ratio = Math.max(690 / image.width, 570 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    ctx.save(); ctx.beginPath(); ctx.rect(x, 586, 690, 570); ctx.clip();
    ctx.drawImage(image, x - (width - 690) / 2, 586 - (height - 570) / 2, width, height); ctx.restore();
    const card = cards[index];
    ctx.fillStyle = ink; ctx.font = `700 30px ${font}`;
    const moment = SPACE_MOMENTS.find(item => item.id === card.momentId)?.name || '现场瞬间';
    ctx.fillText(`${index === 0 ? '01' : '02'} / ${moment}`, x, 1216);
    ctx.font = `400 30px ${font}`;
    wrapText(ctx, (card.caption || '这一刻，想和你一起记住。').replace(/\s+/g, ' '), x, 1278, 674, 48);
  });
  ctx.fillStyle = '#70ddcf'; ctx.fillRect(90, 1484, 1420, 106);
  ctx.fillStyle = ink; ctx.font = `700 32px ${font}`;
  ctx.fillText(cards[0].trackId && cards[0].trackId === cards[1].trackId ? `共同记忆 / ${info.song}` : '把现场，交换着记住。', 122, 1551);
  ctx.textAlign = 'right'; ctx.font = '900 27px Arial'; ctx.fillText('EXCHANGED', 1474, 1549); ctx.textAlign = 'left';
  ctx.font = `400 22px ${font}`;
  ctx.fillText(`${new Date(info.createdAt).toLocaleDateString('zh-CN')} · 双方已同意交换`, 90, 1654);
  ctx.fillText('MUSIC MAP × MUSIC SPACE / 现场与歌曲为示例内容', 90, 1701);
  ctx.textAlign = 'right'; ctx.font = '700 22px Arial'; ctx.fillText('YOUR VIEW. THEIR VIEW. ONE MEMORY.', 1510, 1701);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('票根暂时未能生成，请重试。');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `music-space-${String(info.id).slice(0, 12)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function fitLine(ctx, text, x, y, width, size, font) {
  while (ctx.measureText(text).width > width && size > 24) { size -= 2; ctx.font = `800 ${size}px ${font}`; }
  ctx.fillText(text, x, y);
}

function wrapText(ctx, text, x, y, width, lineHeight) {
  let line = '';
  let row = 0;
  for (const char of text) {
    if (char === '\n' || ctx.measureText(line + char).width > width) {
      ctx.fillText(line, x, y + row * lineHeight); row += 1; line = char === '\n' ? '' : char;
    } else line += char;
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
}

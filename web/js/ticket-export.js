import { SPACE_PHOTOS, SPACE_MOMENTS } from './space-data.js';

const ink = '#0c1016';
const paper = '#f2efe7';
const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
const perspectives = { stage: '舞台', crowd: '人海', friends: '身边', detail: '细节' };
const themes = ['festival', 'sakura', 'zine'];
// Capture this before loading photos/fonts. A later UI switch must not recolor
// an export that is already in progress. Old callers need no new argument.
function exportTheme(info) {
  if (themes.includes(info?.theme)) return info.theme;
  const selected = document.documentElement.dataset.theme;
  return themes.includes(selected) ? selected : 'festival';
}
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
  const theme = exportTheme(info);
  const images = await Promise.all(cards.map(card => loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url)));
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  if (theme !== 'festival') {
    themedMemory(ctx, cards, images, info, theme, true);
    await saveCanvas(canvas, info.id, 'music-space');
    return;
  }
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
  const theme = exportTheme(info);
  const image = await loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url);
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  if (theme !== 'festival') {
    themedMemory(ctx, [card], [image], info, theme, false);
    await saveCanvas(canvas, info.id || card.id, 'music-space-my-card');
    return;
  }
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

function roundedPath(ctx, x, y, w, h, radius) {
  ctx.beginPath(); ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}

function registrationMark(ctx, x, y, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y);
  ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke(); ctx.restore();
}

function blossomStamp(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.15);
  ctx.strokeStyle = '#345c48'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 91, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 79, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#eab1c1';
  for (let i = 0; i < 5; i += 1) {
    ctx.save(); ctx.rotate(i * Math.PI * 2 / 5);
    ctx.beginPath(); ctx.ellipse(0, -24, 16, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#345c48'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = '700 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('MOMENT / MEMORY', 0, 63);
  ctx.restore();
}

function zineEdges(ctx) {
  ctx.fillStyle = '#171914';
  for (let y = 20; y < 1800; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(16, y + 20); ctx.lineTo(0, y + 40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1600, y); ctx.lineTo(1584, y + 20); ctx.lineTo(1600, y + 40); ctx.fill();
  }
  registrationMark(ctx, 50, 48, '#171914'); registrationMark(ctx, 1550, 48, '#171914');
  registrationMark(ctx, 50, 1752, '#171914'); registrationMark(ctx, 1550, 1752, '#171914');
}

function themedHeading(ctx, info, theme, paired) {
  const sakura = theme === 'sakura';
  const tone = sakura ? '#433849' : '#171914';
  ctx.fillStyle = sakura ? '#efdae0' : '#f4f0df'; ctx.fillRect(0, 0, 1600, 1800);
  if (sakura) {
    ctx.fillStyle = '#fffaf0'; roundedPath(ctx, 54, 48, 1492, 1704, 42); ctx.fill();
    ctx.strokeStyle = '#a6b6a1'; ctx.lineWidth = 2; roundedPath(ctx, 76, 70, 1448, 1660, 28); ctx.stroke();
    ctx.fillStyle = '#345c48'; ctx.font = `600 24px ${font}`; ctx.fillText('把同一刻，寄给以后的我们。', 112, 139);
    ctx.fillStyle = tone; ctx.font = '900 85px Arial'; ctx.fillText('SAME MOMENT.', 108, 247);
    ctx.font = '700 54px Arial'; ctx.fillText(paired ? 'TWO VIEWS, ONE MEMORY.' : 'A POSTCARD TO MYSELF.', 112, 307);
    blossomStamp(ctx, 1365, 210);
    ctx.strokeStyle = '#d7bbc4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(112, 339); ctx.lineTo(1488, 339); ctx.stroke();
  } else {
    zineEdges(ctx);
    ctx.fillStyle = tone; ctx.fillRect(88, 84, 1424, 68);
    ctx.fillStyle = '#d7ff3f'; ctx.font = '700 25px Arial'; ctx.fillText('MUSIC SPACE / INDEPENDENT MEMORY PRESS', 113, 130);
    ctx.font = '900 113px Arial'; ctx.fillStyle = '#afbd77'; ctx.fillText(paired ? 'TWO SIDES.' : 'MY SIDE.', 97, 280);
    ctx.fillStyle = tone; ctx.fillText(paired ? 'TWO SIDES.' : 'MY SIDE.', 88, 271);
    ctx.fillStyle = '#d7ff3f'; ctx.fillRect(991, 181, 521, 104);
    ctx.fillStyle = tone; ctx.font = '900 43px Arial'; ctx.fillText(paired ? 'ONE MEMORY.' : 'MY MOMENT.', 1014, 250);
    ctx.strokeStyle = tone; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(88, 316); ctx.lineTo(1512, 316); ctx.stroke();
  }
  const left = sakura ? 112 : 90;
  ctx.fillStyle = tone; ctx.font = `700 33px ${font}`;
  wrapText(ctx, [info.title, info.subtitle].filter(Boolean).join(' / '), left, 390, 1376, 44, 2);
  ctx.font = `400 25px ${font}`;
  fitLine(ctx, [info.eventDate, info.city].filter(Boolean).join(' · '), left, 483, 1376, 25);
}

function themedPhoto(ctx, image, card, theme, x, y, w, h, index) {
  if (theme === 'sakura') {
    ctx.fillStyle = index ? '#e8cad3' : '#cad8c7'; roundedPath(ctx, x - 8, y - 8, w + 16, h + 16, 18); ctx.fill();
    ctx.save(); roundedPath(ctx, x, y, w, h, 11); ctx.clip(); drawPhoto(ctx, image, x, y, w, h); ctx.restore();
  } else {
    ctx.fillStyle = '#171914'; ctx.fillRect(x + 9, y + 9, w + 8, h + 8);
    ctx.fillStyle = '#d7ff3f'; ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
    drawPhoto(ctx, image, x, y, w, h);
    // Paste-up tape sits in the margin; the photo itself is never filtered.
    ctx.save(); ctx.translate(x + w * .5, y - 5); ctx.rotate(index ? .065 : -.065);
    ctx.fillStyle = '#f3edcbdc'; ctx.fillRect(-70, -14, 140, 26); ctx.restore();
  }
  photoDisclosure(ctx, card, x, y);
}

function themedFooter(ctx, info, theme, paired) {
  const sakura = theme === 'sakura';
  const left = sakura ? 112 : 90;
  ctx.fillStyle = sakura ? '#433849' : '#171914'; ctx.font = `500 23px ${font}`;
  const stamp = new Date(info.createdAt || Date.now()).toLocaleDateString('zh-CN');
  ctx.fillText(`${stamp} · ${paired ? '双方已同意共同署名' : '我的现场纪念'}`, left, 1647);
  ctx.font = `400 21px ${font}`;
  ctx.fillText(`MUSIC MAP × MUSIC SPACE${info.isDemo === false ? '' : ' / 现场与歌曲为示例内容'}`, left, 1691);
  ctx.font = '700 17px Arial'; ctx.textAlign = 'right';
  ctx.fillText(sakura ? 'KEPT WITH CARE / MUSIC SPACE' : 'AN EDITION OF OUR OWN / MUSIC SPACE', 1487, 1647);
  ctx.textAlign = 'left';
  if (sakura) {
    ctx.strokeStyle = '#e3c7cf'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(1130, 1674 + i * 11); ctx.bezierCurveTo(1230, 1660 + i * 11, 1315, 1690 + i * 11, 1480, 1674 + i * 11); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#171914';
    for (let i = 0; i < 36; i += 1) ctx.fillRect(1210 + i * 7, 1670, i % 3 ? 2 : 4, 33);
  }
}

function themedMemory(ctx, cards, images, info, theme, paired) {
  const sakura = theme === 'sakura';
  const tone = sakura ? '#433849' : '#171914';
  const left = sakura ? 112 : 90;
  const width = sakura ? 1376 : 1420;
  themedHeading(ctx, info, theme, paired);
  ctx.fillStyle = tone; ctx.font = `800 ${paired ? 42 : 44}px ${font}`;
  const author = card => card.ownerName || card.name || '我的现场';
  fitLine(ctx, paired ? `${author(cards[0])}  ×  ${author(cards[1])}` : author(cards[0]), left, 552, width, paired ? 42 : 44);
  images.forEach((image, index) => {
    const w = paired ? (width - 46) / 2 : width;
    const x = left + index * (w + 46);
    const y = 596;
    const h = paired ? 497 : 656;
    const card = cards[index];
    themedPhoto(ctx, image, card, theme, x, y, w, h, index);
    const moment = SPACE_MOMENTS.find(item => item.id === card.momentId)?.name || '现场瞬间';
    ctx.fillStyle = tone; ctx.font = `700 26px ${font}`;
    fitLine(ctx, `${paired ? `${index + 1} / ` : ''}${moment} · ${perspectives[card.perspective] || '我的视角'}`, x, y + h + 57, w, 26);
    ctx.font = `400 ${paired ? 29 : 31}px ${font}`;
    // 80-character captions fit without ellipsis in the reserved print area.
    wrapText(ctx, (card.caption || (paired ? '这一刻，想和你一起记住。' : '这一刻，先为自己留住。')).replace(/\s+/g, ' '), x, y + h + 112, w, paired ? 44 : 45, paired ? 6 : 3);
  });
  const song = paired ? cards[0].trackId && cards[0].trackId === cards[1].trackId && info.song : cards[0].trackId && info.song;
  const stripY = 1502;
  ctx.fillStyle = sakura ? '#e1ebdf' : '#d7ff3f';
  if (sakura) { roundedPath(ctx, left, stripY, width, 86, 15); ctx.fill(); }
  else { ctx.fillRect(left + 7, stripY + 7, width, 86); ctx.fillStyle = '#171914'; ctx.fillRect(left, stripY, width, 86); }
  ctx.fillStyle = sakura ? '#345c48' : '#d7ff3f'; ctx.font = `700 27px ${font}`;
  fitLine(ctx, song ? `♪ ${info.song}` : paired ? '把现场，交换着记住。' : '一张卡，留住我记得的这一刻。', left + 24, stripY + 54, width - 48, 27);
  themedFooter(ctx, info, theme, paired);
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

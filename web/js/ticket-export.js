import { SPACE_PHOTOS, SPACE_MOMENTS } from './space-data.js';

const ink = '#433849';
const paper = '#fffaf0';
const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
const perspectives = { stage: '舞台', crowd: '人海', friends: '身边', detail: '细节' };
let closeExportPreview = null;
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
async function saveCanvas(canvas, id, prefix) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片暂时未能生成，请重试。');
  closeExportPreview?.();
  const url = URL.createObjectURL(blob);
  const filename = `${prefix}-${String(id || Date.now()).slice(0, 12)}.png`;
  const paired = prefix === 'music-space';
  const dialog = document.createElement('dialog');
  dialog.className = 'memory-export';
  dialog.setAttribute('aria-labelledby', 'memory-export-title');
  dialog.innerHTML = `<header class="memory-export__header"><h2 id="memory-export-title">${paired ? '双联已生成' : '现场卡已生成'}</h2><span>PNG · 1600 × 1800</span></header>
    <img class="memory-export__poster" alt="${paired ? '两位作者共同留下的双联成品' : '我的现场卡成品'}" width="1600" height="1800">
    <p class="memory-export__hint">也可以长按图片保存</p>
    <div class="memory-export__actions"><button class="button button--primary" type="button" data-export-download>下载图片</button><button class="button" type="button" data-export-close autofocus>关闭预览</button></div>
    <button class="memory-export__share" type="button" data-export-share hidden>分享图片</button>
    <p class="memory-export__error" role="status" data-export-error hidden></p>`;
  const image = dialog.querySelector('img');
  image.src = url;
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (closeExportPreview === dispose) closeExportPreview = null;
    if (dialog.open) dialog.close();
    image.removeAttribute('src');
    dialog.remove();
    URL.revokeObjectURL(url);
    window.removeEventListener('popstate', dispose);
    window.removeEventListener('pagehide', dispose);
  }
  function download() {
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link);
    link.click(); link.remove();
  }
  dialog.querySelector('[data-export-download]').addEventListener('click', download);
  dialog.querySelector('[data-export-close]').addEventListener('click', dispose);
  dialog.addEventListener('close', dispose, { once: true });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dispose();
  });
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      const share = dialog.querySelector('[data-export-share]');
      const error = dialog.querySelector('[data-export-error]');
      share.hidden = false;
      share.addEventListener('click', async () => {
        share.disabled = true; error.hidden = true;
        try { await navigator.share({ files: [file] }); }
        catch (reason) {
          if (reason.name !== 'AbortError' && !disposed) {
            error.textContent = '暂时无法分享，可以先下载图片。';
            error.hidden = false;
          }
        } finally { if (!disposed) share.disabled = false; }
      });
    }
  }
  closeExportPreview = dispose;
  window.addEventListener('popstate', dispose);
  window.addEventListener('pagehide', dispose);
  document.body.append(dialog);
  dialog.showModal();
  download();
}
/** Render accepted snapshots. Real rooms supply authorized photo blob URLs. */
export async function downloadTicket(cards, info) {
  closeExportPreview?.();
  const images = await Promise.all(cards.map(card => loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url)));
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  drawMemory(ctx, cards, images, info, true);
  await saveCanvas(canvas, info.id, 'music-space');
}
/** A private card has value before anyone else joins the room. */
export async function downloadCard(card, info) {
  closeExportPreview?.();
  const image = await loadImage(card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url);
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  drawMemory(ctx, [card], [image], info, false);
  await saveCanvas(canvas, info.id || card.id, 'music-space-my-card');
}

function roundedPath(ctx, x, y, w, h, radius) {
  ctx.beginPath(); ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
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

function memoryHeading(ctx, info, paired) {
  ctx.fillStyle = '#efdae0'; ctx.fillRect(0, 0, 1600, 1800);
  ctx.fillStyle = paper; roundedPath(ctx, 54, 48, 1492, 1704, 42); ctx.fill();
  ctx.strokeStyle = '#a6b6a1'; ctx.lineWidth = 2; roundedPath(ctx, 76, 70, 1448, 1660, 28); ctx.stroke();
  ctx.fillStyle = '#345c48'; ctx.font = `600 24px ${font}`; ctx.fillText('把同一刻，寄给以后的我们。', 112, 139);
  ctx.fillStyle = ink; ctx.font = '900 85px Arial'; ctx.fillText('SAME MOMENT.', 108, 247);
  ctx.font = '700 54px Arial'; ctx.fillText(paired ? 'TWO VIEWS, ONE MEMORY.' : 'A POSTCARD TO MYSELF.', 112, 307);
  blossomStamp(ctx, 1365, 210);
  ctx.strokeStyle = '#d7bbc4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(112, 339); ctx.lineTo(1488, 339); ctx.stroke();
  const left = 112;
  ctx.fillStyle = ink; ctx.font = `700 33px ${font}`;
  wrapText(ctx, [info.title, info.subtitle].filter(Boolean).join(' / '), left, 390, 1376, 44, 2);
  ctx.font = `400 25px ${font}`;
  fitLine(ctx, [info.eventDate, info.city].filter(Boolean).join(' · '), left, 483, 1376, 25);
}

function memoryPhoto(ctx, image, card, x, y, w, h, index) {
  ctx.fillStyle = index ? '#e8cad3' : '#cad8c7'; roundedPath(ctx, x - 8, y - 8, w + 16, h + 16, 18); ctx.fill();
  ctx.save(); roundedPath(ctx, x, y, w, h, 11); ctx.clip(); drawPhoto(ctx, image, x, y, w, h); ctx.restore();
  photoDisclosure(ctx, card, x, y);
}

function memoryFooter(ctx, info, paired) {
  const left = 112;
  ctx.fillStyle = ink; ctx.font = `500 23px ${font}`;
  const stamp = new Date(info.createdAt || Date.now()).toLocaleDateString('zh-CN');
  ctx.fillText(`${stamp} · ${paired ? '双方已同意共同署名' : '我的现场纪念'}`, left, 1647);
  ctx.font = `400 21px ${font}`;
  ctx.fillText(`MUSIC MAP × MUSIC SPACE${info.isDemo === false ? '' : ' / 现场与歌曲为示例内容'}`, left, 1691);
  ctx.font = '700 17px Arial'; ctx.textAlign = 'right';
  ctx.fillText('KEPT WITH CARE / MUSIC SPACE', 1487, 1647);
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#e3c7cf'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(1130, 1674 + i * 11); ctx.bezierCurveTo(1230, 1660 + i * 11, 1315, 1690 + i * 11, 1480, 1674 + i * 11); ctx.stroke(); }
}

function drawMemory(ctx, cards, images, info, paired) {
  const left = 112;
  const width = 1376;
  memoryHeading(ctx, info, paired);
  ctx.fillStyle = ink; ctx.font = `800 ${paired ? 42 : 44}px ${font}`;
  const author = card => card.ownerName || card.name || '我的现场';
  fitLine(ctx, paired ? `${author(cards[0])}  ×  ${author(cards[1])}` : author(cards[0]), left, 552, width, paired ? 42 : 44);
  images.forEach((image, index) => {
    const w = paired ? (width - 46) / 2 : width;
    const x = left + index * (w + 46);
    const y = 596;
    const h = paired ? 497 : 656;
    const card = cards[index];
    memoryPhoto(ctx, image, card, x, y, w, h, index);
    const moment = SPACE_MOMENTS.find(item => item.id === card.momentId)?.name || '现场瞬间';
    ctx.fillStyle = ink; ctx.font = `700 26px ${font}`;
    fitLine(ctx, `${paired ? `${index + 1} / ` : ''}${moment} · ${perspectives[card.perspective] || '我的视角'}`, x, y + h + 57, w, 26);
    ctx.font = `400 ${paired ? 29 : 31}px ${font}`;
    // 80-character captions fit without ellipsis in the reserved print area.
    wrapText(ctx, (card.caption || (paired ? '这一刻，想和你一起记住。' : '这一刻，先为自己留住。')).replace(/\s+/g, ' '), x, y + h + 112, w, paired ? 44 : 45, paired ? 6 : 3);
  });
  const song = paired ? cards[0].trackId && cards[0].trackId === cards[1].trackId && info.song : cards[0].trackId && info.song;
  const stripY = 1502;
  ctx.fillStyle = '#e1ebdf'; roundedPath(ctx, left, stripY, width, 86, 15); ctx.fill();
  ctx.fillStyle = '#345c48'; ctx.font = `700 27px ${font}`;
  fitLine(ctx, song ? `♪ ${info.song}` : paired ? '把现场，交换着记住。' : '一张卡，留住我记得的这一刻。', left + 24, stripY + 54, width - 48, 27);
  memoryFooter(ctx, info, paired);
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

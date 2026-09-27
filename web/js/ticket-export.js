import { SPACE_PHOTOS } from './space-data.js';
import { completedFull, eventMeta, eventTitle, momentLabel, perspectiveLabel, sharedLine, singleLine, stampDate } from './duet-facts.js';

/*
 * The PNG speaks the same language as the duet page: a night screening, festoon lights and a warm paper ticket.
 * 1600 × 1800 stays: near-square survives WeChat, Moments and 小红书 crops, and prints on one A5 sheet.
 * Photographs are only cover-cropped; nothing is drawn over them except the AI example label.
 */
const W = 1600;
const H = 1800;
const C = {
  night0: '#0e1228', night1: '#1b2045', night2: '#2b2143',
  lamp: '#ffc27a', paper: '#fbf1dd', paperTop: '#fff9ec', stub: '#f5e6c9', stubLow: '#f1dfbf', edge: '#d6c09a',
  ink: '#2a2a34', inkSoft: '#3b3945', sakura: '#f5b0c1', rose: '#9b5664', green: '#3d6653',
  on: '#fff4e2', onSoft: '#d8cfe2', onFaint: '#aaa2be',
};
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const FALLBACK_SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif';
let closeExportPreview = null;

const serifFamily = () => getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || FALLBACK_SERIF;
const loadImage = source => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('照片暂时无法读取，请稍后再保存图片。'));
  image.src = source;
});
const photoSource = card => card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url;
const authorOf = card => card.ownerName || card.name || '我的现场';

function setFont(ctx, weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }
function spacing(ctx, value) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${value}px`; }

/** Shrinks in the caller's own family; never swaps a serif line to sans. */
function fitLine(ctx, text, x, y, width, size, { family = SANS, weight = 500, min = 24 } = {}) {
  let current = size;
  setFont(ctx, weight, current, family);
  while (ctx.measureText(text).width > width && current > min) { current -= 2; setFont(ctx, weight, current, family); }
  ctx.fillText(text, x, y, width);
  return current;
}
// Chinese line breaking: closing punctuation hangs at the line end instead of starting the next line.
const NO_LINE_START = new Set([...'，。、；：！？）」』》〉】”’…,.;:!?)']);
function lines(ctx, text, width) {
  const rows = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { rows.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + char).width > width && !NO_LINE_START.has(char)) { rows.push(line); line = char; }
    else line += char;
  }
  if (line) rows.push(line);
  return rows;
}
function wrapText(ctx, text, x, y, width, lineHeight, maxRows = Infinity) {
  const rows = lines(ctx, text, width);
  rows.slice(0, maxRows).forEach((row, index) => {
    const clipped = index === maxRows - 1 && rows.length > maxRows ? `${row.slice(0, -1)}…` : row;
    ctx.fillText(clipped, x, y + index * lineHeight, width + 30);
  });
}
const countRows = (ctx, text, width) => lines(ctx, text, width).length;
function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawPhoto(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale; const h = image.height * scale;
  ctx.drawImage(image, x - (w - width) / 2, y - (h - height) / 2, w, h);
}

/* ---------- night backdrop ---------- */
function nightBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.night0); sky.addColorStop(.36, '#161b3b'); sky.addColorStop(.62, C.night1); sky.addColorStop(1, C.night2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,194,122,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  glow(800, 1960, 1000, 'rgba(255,194,122,.22)');
  glow(60, -60, 560, 'rgba(255,194,122,.12)');
  glow(1540, -60, 560, 'rgba(255,194,122,.12)');
  const lift = ctx.createRadialGradient(800, 880, 0, 800, 880, 900);
  lift.addColorStop(0, 'rgba(42,49,112,.9)'); lift.addColorStop(1, 'rgba(42,49,112,0)');
  ctx.fillStyle = lift; ctx.fillRect(0, 0, W, H);
  // Op Art interference: two ring fields, one per point of view.
  ctx.save();
  ctx.lineWidth = 1.6;
  [[560, 520, 'rgba(255,244,226,.05)'], [1040, 520, 'rgba(245,176,193,.05)']].forEach(([x, y, color]) => {
    ctx.strokeStyle = color;
    for (let r = 26; r < 980; r += 26) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
  });
  ctx.restore();
  bokeh(ctx);
  festoon(ctx);
}
function bokeh(ctx) {
  [[70, 1180, 90, 'rgba(245,176,193,.10)'], [150, 980, 50, 'rgba(255,194,122,.08)'], [1520, 1120, 110, 'rgba(255,194,122,.09)'], [1450, 1320, 46, 'rgba(245,176,193,.12)'], [40, 700, 36, 'rgba(255,194,122,.08)']].forEach(([x, y, r, color]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
}
function festoon(ctx) {
  const swags = [[-20, 40, 800, 44], [800, 44, 1620, 40]];
  ctx.save();
  ctx.strokeStyle = 'rgba(255,244,226,.26)'; ctx.lineWidth = 2;
  swags.forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, 196, x1, y1); ctx.stroke();
  });
  swags.forEach(([x0, y0, x1, y1]) => {
    const cx = (x0 + x1) / 2;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 9;
      const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * 196 + t ** 2 * y1 + 14;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 46);
      halo.addColorStop(0, 'rgba(255,194,122,.55)'); halo.addColorStop(.35, 'rgba(255,194,122,.16)'); halo.addColorStop(1, 'rgba(255,194,122,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d5870'; ctx.fillRect(x - 3.5, y - 16, 7, 7);
      const bulb = ctx.createRadialGradient(x, y - 3, 1, x, y, 10);
      bulb.addColorStop(0, '#fffaf0'); bulb.addColorStop(.55, C.lamp); bulb.addColorStop(1, '#f0a255');
      ctx.fillStyle = bulb; ctx.beginPath(); ctx.ellipse(x, y, 7.5, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.restore();
}
function petal(ctx, x, y, size, angle, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * .9, -size * .6, size * .7, size * .7, 0, size);
  ctx.bezierCurveTo(-size * .7, size * .7, -size * .9, -size * .6, 0, -size);
  ctx.fill(); ctx.restore();
}
function petals(ctx) {
  [[54, 520, 13, .6, 'rgba(245,176,193,.7)'], [1548, 610, 11, -.8, 'rgba(245,176,193,.55)'], [36, 1360, 10, 1.9, 'rgba(245,176,193,.5)'],
    [1566, 1470, 14, .3, 'rgba(245,176,193,.65)'], [300, 250, 9, -.4, 'rgba(245,176,193,.45)'], [1310, 270, 10, 1.2, 'rgba(245,176,193,.5)']]
    .forEach(([x, y, size, angle, color]) => petal(ctx, x, y, size, angle, color));
}

/* ---------- heading ---------- */
function heading(ctx, cards, info, paired) {
  const serif = serifFamily();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.sakura; setFont(ctx, 500, 24); spacing(ctx, 6);
  ctx.fillText(`同一刻，另一面 · ${paired ? '双联票根' : '我的现场卡'}`, W / 2, 234);
  spacing(ctx, 1);
  ctx.shadowColor = 'rgba(255,194,122,.28)'; ctx.shadowBlur = 36;
  ctx.fillStyle = C.on;
  if (paired) {
    ctx.textAlign = 'right'; fitLine(ctx, authorOf(cards[0]), 744, 344, 640, 92, { family: serif, weight: 700, min: 44 });
    ctx.textAlign = 'left'; fitLine(ctx, authorOf(cards[1]), 856, 344, 640, 92, { family: serif, weight: 700, min: 44 });
    ctx.textAlign = 'center'; ctx.fillStyle = C.lamp; setFont(ctx, 300, 60); ctx.fillText('×', W / 2, 330);
  } else {
    fitLine(ctx, authorOf(cards[0]), W / 2, 344, 1300, 92, { family: serif, weight: 700, min: 44 });
  }
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  // Event title in serif, date and place softer, centred as one line.
  const title = eventTitle({ title: info.title, subtitle: info.subtitle });
  const meta = eventMeta({ date: info.eventDate, city: info.city });
  ctx.textAlign = 'left'; spacing(ctx, 2);
  let titleSize = 34;
  setFont(ctx, 600, titleSize, serif);
  const gap = meta ? 30 : 0;
  const metaWidth = () => { setFont(ctx, 400, 27); const width = meta ? ctx.measureText(meta).width : 0; setFont(ctx, 600, titleSize, serif); return width; };
  let total = ctx.measureText(title).width + gap + metaWidth();
  while (total > 1320 && titleSize > 24) { titleSize -= 2; setFont(ctx, 600, titleSize, serif); total = ctx.measureText(title).width + gap + metaWidth(); }
  const left = Math.max(140, (W - total) / 2);
  ctx.fillStyle = C.on; setFont(ctx, 600, titleSize, serif);
  const titleWidth = Math.min(ctx.measureText(title).width, 1320 - gap - metaWidth());
  ctx.fillText(title, left, 414, titleWidth);
  if (meta) { ctx.fillStyle = C.onSoft; setFont(ctx, 400, 27); ctx.fillText(meta, left + titleWidth + gap, 414); }
  ctx.restore();
}

/* ---------- paper ticket ---------- */
const T = { x: 100, y: 468, w: 1400, h: 1170, tear: 1450, r: 28 };
function ticketPaper(ctx, paired) {
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const lx = layer.getContext('2d');
  const paper = lx.createLinearGradient(0, T.y, 0, T.tear);
  paper.addColorStop(0, C.paperTop); paper.addColorStop(1, C.paper);
  lx.fillStyle = paper; roundedPath(lx, T.x, T.y, T.w, T.h, T.r); lx.fill();
  const stub = lx.createLinearGradient(0, T.tear, 0, T.y + T.h);
  stub.addColorStop(0, C.stub); stub.addColorStop(1, C.stubLow);
  lx.save(); roundedPath(lx, T.x, T.y, T.w, T.h, T.r); lx.clip();
  lx.fillStyle = stub; lx.fillRect(T.x, T.tear, T.w, T.y + T.h - T.tear);
  // Fine paper grain.
  lx.fillStyle = 'rgba(138,122,90,.035)';
  for (let y = T.y; y < T.y + T.h; y += 4) lx.fillRect(T.x, y, T.w, 1);
  lx.restore();
  // Real notches: the night shows through them.
  lx.globalCompositeOperation = 'destination-out';
  [[T.x, T.tear, 26], [T.x + T.w, T.tear, 26], ...(paired ? [[W / 2, T.y, 17]] : [])].forEach(([x, y, r]) => { lx.beginPath(); lx.arc(x, y, r, 0, Math.PI * 2); lx.fill(); });
  lx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.shadowColor = 'rgba(3,5,18,.62)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 34;
  ctx.drawImage(layer, 0, 0);
  ctx.shadowColor = 'rgba(255,194,122,.2)'; ctx.shadowBlur = 150; ctx.shadowOffsetY = 0;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  // Tear line between ticket and stub.
  ctx.save();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
  ctx.beginPath(); ctx.moveTo(T.x + 44, T.tear); ctx.lineTo(T.x + T.w - 44, T.tear); ctx.stroke();
  ctx.restore();
  // The fold between the two photographs: the same dashed seam as the page, never painted holes.
  if (paired) {
    ctx.save();
    ctx.strokeStyle = C.edge; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([12, 14]);
    ctx.beginPath(); ctx.moveTo(W / 2, T.y + 40); ctx.lineTo(W / 2, T.tear - 24); ctx.stroke();
    ctx.restore();
  }
}
function photoDisclosure(ctx, card, x, y) {
  if (card.photoId || card.photoDataUrl) return;
  ctx.save();
  setFont(ctx, 500, 28); spacing(ctx, 1);
  const label = 'AI 生成示例照片';
  const width = ctx.measureText(label).width + 36;
  ctx.fillStyle = 'rgba(18,19,39,.86)'; roundedPath(ctx, x + 18, y + 18, width, 54, 12); ctx.fill();
  ctx.fillStyle = C.on; ctx.textAlign = 'left'; ctx.fillText(label, x + 36, y + 55);
  ctx.restore();
}
const captionOf = (card, paired) => (card.caption || (paired ? '这一刻，想和你一起记住。' : '这一刻，先为自己留住。')).replace(/\s+/g, ' ');
/** Short captions give their room back to the photographs; long ones keep all 80 characters. */
function photoHeight(ctx, cards, paired) {
  setFont(ctx, 400, paired ? 28 : 30);
  const width = paired ? 630 : 1308;
  const rows = Math.min(paired ? 4 : 3, Math.max(...cards.map(card => countRows(ctx, captionOf(card, paired), width))));
  // Paired photos stay near-square; a single card may widen into the whole ticket.
  return paired ? 640 + (4 - rows) * 34 : 790 - (rows - 1) * 44;
}
function side(ctx, image, card, x, w, paired, h) {
  const y = T.y + 36;
  ctx.save(); roundedPath(ctx, x, y, w, h, 16); ctx.clip(); drawPhoto(ctx, image, x, y, w, h); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; roundedPath(ctx, x, y, w, h, 16); ctx.stroke(); ctx.restore();
  photoDisclosure(ctx, card, x, y);
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
  fitLine(ctx, authorOf(card), x + 2, y + h + 62, w * (paired ? .54 : .6), 36, { weight: 700, min: 26 });
  ctx.textAlign = 'right'; ctx.fillStyle = C.rose; spacing(ctx, 2);
  fitLine(ctx, `${perspectiveLabel(card)} · ${momentLabel(card.momentId)}`, x + w - 2, y + h + 62, w * .42, 25, { weight: 500, min: 20 });
  spacing(ctx, 0);
  ctx.textAlign = 'left'; ctx.fillStyle = C.inkSoft; setFont(ctx, 400, paired ? 28 : 30);
  // 80-character captions fit without an ellipsis in both layouts.
  wrapText(ctx, captionOf(card, paired), x + 2, y + h + 116, w - 4, paired ? 42 : 44, paired ? 4 : 3);
  ctx.restore();
}
function seal(ctx, x, y, title, date) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.14); ctx.globalAlpha = .92;
  ctx.strokeStyle = C.green; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 61, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#eaa9ba';
  for (let i = 0; i < 5; i += 1) {
    ctx.save(); ctx.translate(0, -31); ctx.rotate(i * Math.PI * 2 / 5);
    ctx.beginPath(); ctx.ellipse(0, -7, 4.5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, -31, 3, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  setFont(ctx, 700, 25); spacing(ctx, 3); ctx.fillText(title, 2, 10);
  setFont(ctx, 500, 21); spacing(ctx, 1); ctx.fillText(date, 0, 40);
  ctx.restore();
}
function stubText(ctx, line, paired, info) {
  const serif = serifFamily();
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = C.rose; setFont(ctx, 500, 26); spacing(ctx, 5);
  ctx.fillText(line.label, 164, T.tear + 66);
  spacing(ctx, 2); ctx.fillStyle = C.ink;
  fitLine(ctx, line.value, 162, T.tear + 146, 1040, 62, { family: serif, weight: 700, min: 34 });
  ctx.restore();
  seal(ctx, 1368, T.tear + 96, paired ? '双方同意' : '我的现场', stampDate(info.createdAt));
}
function footer(ctx, info, paired) {
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.onSoft; setFont(ctx, 400, 27); spacing(ctx, 1);
  ctx.fillText(`${completedFull(info.createdAt)} · ${paired ? '双方已同意共同署名' : '我的现场纪念'}`, T.x + 4, 1712);
  ctx.fillStyle = C.onFaint; setFont(ctx, 400, 24); spacing(ctx, 1);
  const notice = info.scenario === 'local' ? ' · 本地情景演示，角色、现场与歌曲为虚构' : info.isDemo === false ? '' : ' · 现场与歌曲为示例内容';
  ctx.fillText(`MUSIC MAP × MUSIC SPACE${notice}`, T.x + 4, 1758, 1080);
  ctx.textAlign = 'right'; ctx.fillStyle = C.sakura; setFont(ctx, 600, 32, serifFamily()); spacing(ctx, 4);
  ctx.fillText('同一刻，另一面', T.x + T.w - 4, 1724);
  ctx.restore();
}
function drawMemory(ctx, cards, images, info, paired) {
  nightBackdrop(ctx);
  petals(ctx);
  heading(ctx, cards, info, paired);
  ticketPaper(ctx, paired);
  const h = photoHeight(ctx, cards, paired);
  if (paired) {
    side(ctx, images[0], cards[0], 144, 634, true, h);
    side(ctx, images[1], cards[1], 822, 634, true, h);
  } else side(ctx, images[0], cards[0], 144, 1312, false, h);
  const line = paired ? sharedLine(cards, { song: info.song, title: info.title }) : singleLine(cards[0], { song: info.song });
  stubText(ctx, line, paired, info);
  footer(ctx, info, paired);
}
function canvasBase() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  return { canvas, ctx: canvas.getContext('2d') };
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
  dialog.dataset.motion = 'self';
  dialog.setAttribute('aria-labelledby', 'memory-export-title');
  dialog.innerHTML = `<header class="memory-export__header"><h2 id="memory-export-title">${paired ? '双联图片已生成' : '现场卡图片已生成'}</h2><span>PNG · 1600 × 1800</span></header>
    <img class="memory-export__poster" alt="${paired ? '两位作者共同署名的双联票根图片' : '我的现场卡图片'}" width="1600" height="1800">
    <p class="memory-export__hint">也可以长按图片保存</p>
    <div class="memory-export__actions"><button class="button button--primary" type="button" data-export-download>下载图片</button><button class="button" type="button" data-export-close autofocus>关闭预览</button></div>
    <button class="memory-export__share" type="button" data-export-share hidden>分享图片</button>
    <p class="memory-export__error" role="alert" data-export-error hidden></p>`;
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
  const images = await Promise.all(cards.map(card => loadImage(photoSource(card))));
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  drawMemory(ctx, cards, images, info, true);
  await saveCanvas(canvas, info.id, 'music-space');
}
/** A private card has value before anyone else joins the room. */
export async function downloadCard(card, info) {
  closeExportPreview?.();
  const image = await loadImage(photoSource(card));
  await document.fonts.ready;
  const { canvas, ctx } = canvasBase();
  drawMemory(ctx, [card], [image], info, false);
  await saveCanvas(canvas, info.id || card.id, 'music-space-my-card');
}

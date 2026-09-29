import qrcode from 'qrcode-generator';
import { artistById, artistName, songs } from './map-data.js';

/*
 * Music Map's two keepsakes, drawn on this device and never uploaded:
 * - 寻声战绩卡: the puzzle (start and target) and how the player did. The stops in between are
 *   face-down sleeves, so a friend who scans the code still has the whole puzzle to solve.
 * - 发现卡片 (PRD 5.8): one roam's start, the singers met on the way and the songs kept.
 * Both use the courtyard's language: a night sky with festoon lights and a warm paper ticket.
 * 1080 × 1350 (4:5) keeps the portrait crop of WeChat Moments and 小红书.
 */
const W = 1080;
const H = 1350;
const C = {
  night0: '#0e1228', night1: '#1b2045', night2: '#2b2143',
  lamp: '#ffc27a', paper: '#fbf1dd', paperTop: '#fff9ec', stub: '#f5e6c9', stubLow: '#f1dfbf', edge: '#d6c09a',
  ink: '#1f3a2d', inkSoft: '#3d4a40', muted: '#6b6a5c', rose: '#9b5664', target: '#9d3f50', green: '#3d6653', gold: '#b98642',
  kraft: '#eadcbf', kraftLine: '#cdb98f', kraftInk: '#7a6438', sakura: '#f5b0c1',
  on: '#fff4e2', onSoft: '#d8cfe2', onFaint: '#aaa2be',
};
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const FALLBACK_SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif';
const FOOTER = '每条连线都是一首真实的合唱录音';
// Only one preview is open at a time; the next one (or leaving the page) releases the last.
let closePreview = null;

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const serifFamily = () => getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || FALLBACK_SERIF;
const pad2 = value => String(value).padStart(2, '0');
const stampDate = timestamp => { const date = new Date(timestamp); return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`; };
const fileDate = timestamp => { const date = new Date(timestamp); return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; };
const longDate = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const slug = id => String(id || '').replace(/^real-/, '').replace(/[^a-z0-9-]/gi, '') || 'map';
const toneOf = id => artistById[id]?.color || '#b9ad90';

/* ---------- Links: only the puzzle travels, never the route, the keeps or the history ---------- */

/** `<page>?from=<start>&to=<target>#/explore`: the same puzzle for whoever opens it. */
export function challengeUrl(start, target, base = globalThis.location?.href) {
  const url = new URL(base);
  url.search = '';
  url.searchParams.set('from', start);
  url.searchParams.set('to', target);
  url.hash = '/explore';
  return url.href;
}
/** The front door, without any puzzle or view. */
export function homeUrl(base = globalThis.location?.href) {
  const url = new URL(base);
  url.search = ''; url.hash = '';
  return url.href;
}
/** A readable address for print: host and path, no scheme, no query. */
export function shortUrl(href) {
  const url = new URL(href);
  return `${url.host}${url.pathname}`.replace(/\/$/, '') || url.href;
}
export const challengeText = (start, target) => `${artistName(start)} 和 ${artistName(target)} 之间隔着几首歌？来 Music Map 翻翻看`;

/** Hand the puzzle to a friend, only on the player's click: the system share sheet when there is
 *  one, else the clipboard, else `showLink(url, text)` puts the link in a field to copy by hand.
 *  Resolves to 'shared' | 'cancelled' | 'copied' | 'shown'. */
export async function shareChallengeLink({ start, target }, { toast, showLink }) {
  const url = challengeUrl(start, target);
  const text = challengeText(start, target);
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'Music Map · 寻声', text, url }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); toast?.('题目链接已复制'); return 'copied'; }
    catch { /* No permission: the link is shown instead. */ }
  }
  showLink?.(url, text);
  return 'shown';
}

/* ---------- Canvas primitives (from the 0.15 ticket export) ---------- */

function setFont(ctx, weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }
function spacing(ctx, value) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${value}px`; }

/** Shrinks in the caller's own family; never swaps a serif line to sans. */
function fitLine(ctx, text, x, y, width, size, { family = SANS, weight = 500, min = 20 } = {}) {
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
  return Math.min(rows.length, maxRows);
}
function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- Night backdrop: the courtyard sky, festoon lights and the grooves of the table's records ---------- */

function nightBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.night0); sky.addColorStop(.36, '#161b3b'); sky.addColorStop(.62, C.night1); sky.addColorStop(1, C.night2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,194,122,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  glow(W / 2, H + 140, 760, 'rgba(255,194,122,.22)');
  glow(40, -40, 420, 'rgba(255,194,122,.12)');
  glow(W - 40, -40, 420, 'rgba(255,194,122,.12)');
  const lift = ctx.createRadialGradient(W / 2, 640, 0, W / 2, 640, 680);
  lift.addColorStop(0, 'rgba(42,49,112,.9)'); lift.addColorStop(1, 'rgba(42,49,112,0)');
  ctx.fillStyle = lift; ctx.fillRect(0, 0, W, H);
  // One ring field under the ticket: the grooves of a record on the shop's table.
  ctx.save();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,244,226,.045)';
  for (let r = 24; r < 820; r += 24) { ctx.beginPath(); ctx.arc(W / 2, 700, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  bokeh(ctx);
  festoon(ctx);
}
function bokeh(ctx) {
  [[48, 880, 70, 'rgba(245,176,193,.10)'], [110, 730, 38, 'rgba(255,194,122,.08)'], [1030, 830, 84, 'rgba(255,194,122,.09)'], [980, 990, 36, 'rgba(245,176,193,.12)'], [28, 520, 28, 'rgba(255,194,122,.08)']].forEach(([x, y, r, color]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
}
function festoon(ctx) {
  const sag = 138;
  const swags = [[-20, 28, W / 2, 32], [W / 2, 32, W + 20, 28]];
  ctx.save();
  ctx.strokeStyle = 'rgba(255,244,226,.26)'; ctx.lineWidth = 2;
  swags.forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, sag, x1, y1); ctx.stroke();
  });
  swags.forEach(([x0, y0, x1, y1]) => {
    const cx = (x0 + x1) / 2;
    for (let i = 1; i <= 6; i += 1) {
      const t = i / 7;
      const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * sag + t ** 2 * y1 + 12;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 38);
      halo.addColorStop(0, 'rgba(255,194,122,.55)'); halo.addColorStop(.35, 'rgba(255,194,122,.16)'); halo.addColorStop(1, 'rgba(255,194,122,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d5870'; ctx.fillRect(x - 3, y - 14, 6, 6);
      const bulb = ctx.createRadialGradient(x, y - 3, 1, x, y, 9);
      bulb.addColorStop(0, '#fffaf0'); bulb.addColorStop(.55, C.lamp); bulb.addColorStop(1, '#f0a255');
      ctx.fillStyle = bulb; ctx.beginPath(); ctx.ellipse(x, y, 6.5, 9, 0, 0, Math.PI * 2); ctx.fill();
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
  [[40, 400, 11, .6, 'rgba(245,176,193,.7)'], [1044, 470, 9, -.8, 'rgba(245,176,193,.55)'], [26, 1040, 8, 1.9, 'rgba(245,176,193,.5)'],
    [1052, 1120, 12, .3, 'rgba(245,176,193,.65)'], [220, 190, 8, -.4, 'rgba(245,176,193,.45)'], [880, 205, 9, 1.2, 'rgba(245,176,193,.5)']]
    .forEach(([x, y, size, angle, color]) => petal(ctx, x, y, size, angle, color));
}

/* ---------- Heading: the wordmark as it stands on the masthead ---------- */

/** The three-petal brand mark, as on the masthead at night. */
function brandMark(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.26);
  ['#f0a6b6', '#ffd6c8', '#86b596'].forEach((color, index) => {
    ctx.save(); ctx.rotate(index * Math.PI * 2 / 3); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, -r * .55, r * .36, r * .6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
  ctx.restore();
}
function heading(ctx, kicker) {
  ctx.save();
  setFont(ctx, 700, 46); spacing(ctx, 2);
  const word = 'Music Map';
  const mark = 46; const gap = 16;
  const left = (W - (mark + gap + ctx.measureText(word).width)) / 2;
  brandMark(ctx, left + mark / 2, 214, 24);
  ctx.textAlign = 'left'; ctx.fillStyle = C.on;
  ctx.shadowColor = 'rgba(255,194,122,.3)'; ctx.shadowBlur = 24;
  ctx.fillText(word, left + mark + gap, 230);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.textAlign = 'center'; ctx.fillStyle = C.sakura; setFont(ctx, 500, 25); spacing(ctx, 5);
  ctx.fillText(kicker, W / 2, 284);
  ctx.restore();
}

/* ---------- Paper ticket, seal and sleeves ---------- */

function ticketPaper(ctx, T) {
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
  [[T.x, T.tear, 22], [T.x + T.w, T.tear, 22]].forEach(([x, y, r]) => { lx.beginPath(); lx.arc(x, y, r, 0, Math.PI * 2); lx.fill(); });
  lx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.shadowColor = 'rgba(3,5,18,.62)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
  ctx.drawImage(layer, 0, 0);
  ctx.shadowColor = 'rgba(255,194,122,.2)'; ctx.shadowBlur = 130; ctx.shadowOffsetY = 0;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  // Tear line between ticket and stub.
  ctx.save();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 3; ctx.setLineDash([14, 11]);
  ctx.beginPath(); ctx.moveTo(T.x + 40, T.tear); ctx.lineTo(T.x + T.w - 40, T.tear); ctx.stroke();
  ctx.restore();
}
function seal(ctx, x, y, title, date) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.14); ctx.globalAlpha = .92;
  ctx.strokeStyle = C.green; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#eaa9ba';
  for (let i = 0; i < 5; i += 1) {
    ctx.save(); ctx.translate(0, -29); ctx.rotate(i * Math.PI * 2 / 5);
    ctx.beginPath(); ctx.ellipse(0, -6.5, 4, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, -29, 3, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  setFont(ctx, 700, 25); spacing(ctx, 3); ctx.fillText(title, 2, 6);
  // The date sits where the inner ring is still wide enough for it.
  setFont(ctx, 500, 16); spacing(ctx, .5); ctx.fillText(date, 0, 32, 84);
  ctx.restore();
}
/** A face-up sleeve: the singer's colour with a record inside, as on the table. */
function artistSleeve(ctx, cx, cy, size, color, tilt = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  ctx.shadowColor = 'rgba(58,58,42,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fffdf3'; roundedPath(ctx, -size / 2, -size / 2, size, size, 3); ctx.fill();
  ctx.shadowColor = 'transparent';
  const inset = Math.round(size * .07);
  ctx.fillStyle = color; roundedPath(ctx, -size / 2 + inset, -size / 2 + inset, size - inset * 2, size - inset * 2, 2); ctx.fill();
  const disc = size * .31;
  ctx.fillStyle = '#2c3634'; ctx.beginPath(); ctx.arc(0, 0, disc, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(132,146,130,.55)'; ctx.lineWidth = 1;
  for (let r = disc * .42; r < disc - 1; r += 3) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, disc * .34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** A face-down sleeve: kraft back, a die-cut ring and a ？. It never says who is inside. */
function sealedSleeve(ctx, cx, cy, size, tilt = 0, glyph = '？') {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  ctx.shadowColor = 'rgba(58,48,24,.26)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.kraft; roundedPath(ctx, -size / 2, -size / 2, size, size, 3); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); roundedPath(ctx, -size / 2, -size / 2, size, size, 3); ctx.clip();
  ctx.strokeStyle = 'rgba(216,198,159,.5)'; ctx.lineWidth = 1;
  for (let d = -size; d < size; d += 8) { ctx.beginPath(); ctx.moveTo(d, -size / 2); ctx.lineTo(d + size, size / 2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = C.kraftLine; ctx.lineWidth = 2; roundedPath(ctx, -size / 2, -size / 2, size, size, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(156,134,87,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(0, 0, size * .34, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.kraftInk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(ctx, 700, Math.round(size * (glyph.length > 2 ? .26 : .44)), serifFamily());
  ctx.fillText(glyph, glyph === '？' ? size * .04 : 0, size * .03);
  ctx.restore();
}
/** A small paper tag, e.g. 节选 · 共 9 位. Returns its width. */
function tag(ctx, text, x, y, { align = 'left', color = C.rose } = {}) {
  ctx.save();
  setFont(ctx, 600, 21); spacing(ctx, 2);
  const width = ctx.measureText(text).width + 26;
  const left = align === 'right' ? x - width : x;
  ctx.strokeStyle = color; ctx.lineWidth = 2; roundedPath(ctx, left, y - 25, width, 36, 3); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, left + 13, y);
  ctx.restore();
  return width;
}
function drawQr(ctx, text, x, y, size) {
  const qr = qrcode(0, 'M');
  qr.addData(text); qr.make();
  const count = qr.getModuleCount();
  const quiet = 3;
  const cell = Math.floor(size / (count + quiet * 2));
  const drawn = cell * (count + quiet * 2);
  const ox = Math.round(x + (size - drawn) / 2) + quiet * cell; const oy = Math.round(y + (size - drawn) / 2) + quiet * cell;
  ctx.save();
  ctx.fillStyle = '#fffdf6'; roundedPath(ctx, x, y, size, size, 10); ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2; roundedPath(ctx, x, y, size, size, 10); ctx.stroke();
  ctx.fillStyle = C.ink;
  for (let row = 0; row < count; row += 1) for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
  ctx.restore();
}
function footer(ctx, address) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.onSoft; setFont(ctx, 400, 24); spacing(ctx, 1);
  ctx.fillText(address, W / 2, 1270, W - 160);
  ctx.fillStyle = C.sakura; setFont(ctx, 600, 28, serifFamily()); spacing(ctx, 4);
  ctx.fillText(FOOTER, W / 2, 1316);
  ctx.restore();
}
function canvasBase() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  return { canvas, ctx: canvas.getContext('2d') };
}

/* ---------- 寻声战绩卡 ---------- */

const usedHints = session => (session.hints || []).filter(hint => hint.level < 3).length;

/** The route row: start, the stops in between face down, target. `broken` leaves a dashed gap
 *  before the target (the round was revealed before the player got there). */
function challengeRow(ctx, { start, target, middle, broken }, x0, x1, cy) {
  const END = 118; const MID = 86;
  const room = broken ? 5 : 6;
  const items = [{ kind: 'artist', id: start }];
  const shown = middle > room ? room - 1 : middle;
  for (let i = 0; i < shown; i += 1) items.push({ kind: 'sealed' });
  if (middle > room) items.push({ kind: 'more', count: middle - shown });
  if (broken) items.push({ kind: 'gap' });
  items.push({ kind: 'artist', id: target });
  const widths = items.map(item => item.kind === 'artist' ? END : MID);
  const gap = Math.max(10, ((x1 - x0) - widths.reduce((sum, w) => sum + w, 0)) / Math.max(1, items.length - 1));
  let x = x0;
  const centres = items.map((item, index) => { const centre = x + widths[index] / 2; x += widths[index] + gap; return centre; });
  // The thread the route hangs on; dashed where the player never walked.
  ctx.save();
  ctx.lineWidth = 4; ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
  const gapIndex = items.findIndex(item => item.kind === 'gap');
  const solidEnd = gapIndex >= 0 ? centres[gapIndex - 1] : centres[centres.length - 1];
  ctx.beginPath(); ctx.moveTo(centres[0], cy); ctx.lineTo(solidEnd, cy); ctx.stroke();
  if (gapIndex >= 0) {
    ctx.setLineDash([10, 10]); ctx.strokeStyle = '#8d8676';
    ctx.beginPath(); ctx.moveTo(solidEnd, cy); ctx.lineTo(centres[centres.length - 1], cy); ctx.stroke();
  }
  ctx.restore();
  const tilts = [-.05, .04, -.03, .05, -.04, .03, -.05, .04];
  items.forEach((item, index) => {
    const cx = centres[index]; const tilt = tilts[index % tilts.length];
    if (item.kind === 'artist') artistSleeve(ctx, cx, cy, END, toneOf(item.id), tilt);
    else if (item.kind === 'sealed') sealedSleeve(ctx, cx, cy, MID, tilt);
    else if (item.kind === 'more') sealedSleeve(ctx, cx, cy, MID, tilt, `+${item.count}`);
    else {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.muted; setFont(ctx, 500, 22); spacing(ctx, 2);
      ctx.fillStyle = C.paperTop; ctx.fillRect(cx - 50, cy - 18, 100, 36);
      ctx.fillStyle = C.muted; ctx.fillText('未走到', cx, cy + 8); ctx.restore();
    }
  });
}

/** 寻声战绩卡 for a finished round (arrived or revealed). Draws only the start, the target and
 *  face-down sleeves for the stops the player passed: no singer in between, no song title. */
export async function buildChallengeCard(session) {
  await document.fonts?.ready;
  const { canvas, ctx } = canvasBase();
  const serif = serifFamily();
  const arrived = session.status === 'complete';
  const steps = Math.max(0, session.path.length - 1);
  const hints = usedHints(session);
  const url = challengeUrl(session.start, session.target);
  nightBackdrop(ctx);
  petals(ctx);
  heading(ctx, '寻声 · 两位歌手之间，隔着几首歌？');
  const T = { x: 64, y: 318, w: 952, h: 900, tear: 930, r: 26 };
  ticketPaper(ctx, T);
  const left = T.x + 64; const right = T.x + T.w - 64;
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.rose; setFont(ctx, 500, 24); spacing(ctx, 5);
  ctx.fillText(session.friend ? '朋友出的题 · 寻声' : '寻声 · 真实合作精选', left, T.y + 78);
  spacing(ctx, 2); ctx.fillStyle = C.ink;
  fitLine(ctx, artistName(session.start), left, T.y + 196, right - left - 190, 92, { family: serif, weight: 700, min: 48 });
  ctx.fillStyle = C.muted; setFont(ctx, 500, 22); spacing(ctx, 3);
  ctx.fillText('起点', left + 2, T.y + 238);
  ctx.restore();
  seal(ctx, right - 66, T.y + 108, arrived ? '抵达' : '揭晓', stampDate(session.updated || Date.now()));
  // An arrival passes steps − 1 singers between start and target; a revealed round passes every stop it walked.
  challengeRow(ctx, { start: session.start, target: session.target, middle: arrived ? Math.max(0, steps - 1) : steps, broken: !arrived }, left, right, T.y + 338);
  ctx.save();
  ctx.textAlign = 'right'; ctx.fillStyle = C.muted; setFont(ctx, 500, 22); spacing(ctx, 3);
  ctx.fillText('终点', right - 2, T.y + 446);
  ctx.fillStyle = C.target; spacing(ctx, 2);
  fitLine(ctx, artistName(session.target), right, T.y + 540, right - left, 92, { family: serif, weight: 700, min: 48 });
  ctx.fillStyle = C.inkSoft; setFont(ctx, 400, 28); spacing(ctx, 2);
  ctx.fillText('中间的歌手，翻开才知道', right, T.y + 592);
  ctx.restore();
  // Stub: the score, and the code that opens the same puzzle.
  const sy = T.tear;
  const qrSize = 220;
  const textWidth = right - qrSize - 40 - left;
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.rose; setFont(ctx, 500, 24); spacing(ctx, 5);
  ctx.fillText('我的战绩', left, sy + 66);
  spacing(ctx, 2); ctx.fillStyle = C.ink;
  fitLine(ctx, `我走了 ${steps} 步`, left, sy + 146, textWidth, 66, { family: serif, weight: 700, min: 40 });
  const detail = arrived
    ? `抵达终点 · ${hints ? `用了 ${hints} 次提示` : '没用提示'}`
    : `已揭晓 · 没有走到终点${hints ? ` · 用了 ${hints} 次提示` : ''}`;
  ctx.fillStyle = C.inkSoft; setFont(ctx, 400, 28); spacing(ctx, 1);
  wrapText(ctx, detail, left, sy + 198, textWidth, 38, 1);
  ctx.fillStyle = C.muted; setFont(ctx, 400, 23); spacing(ctx, 1);
  wrapText(ctx, '扫码走同一道题 · 只带起点和终点', left, sy + 254, textWidth, 32, 1);
  ctx.restore();
  drawQr(ctx, url, right - qrSize, sy + 36, qrSize);
  footer(ctx, shortUrl(url));
  return canvas;
}
export const challengeCardName = session => `music-map-xunsheng-${slug(session.start)}-${slug(session.target)}.png`;

/* ---------- 发现卡片 (PRD 5.8) ---------- */

/** Singers in the order they were first met; each knows whether it was walked to from the one before. */
function metInOrder(session) {
  const order = [session.start];
  for (const event of session.events || []) if (event.type === 'move' && !order.includes(event.to)) order.push(event.to);
  const walked = new Set((session.events || []).filter(event => event.type === 'move').map(event => `${event.from}>${event.to}`));
  return order.map((id, index) => ({ id, walked: index > 0 && walked.has(`${order[index - 1]}>${id}`) }));
}
/** Distinct songs kept on this roam, in the order they were first kept. */
const keptSongs = session => (session.saved || []).filter((item, index, list) => list.findIndex(other => other.id === item.id) === index && songs[item.id]);
/** A discovery card prints every singer met up to this many, and every kept song up to MAX_KEPT; past either it prints an excerpt, tagged 节选. */
const MAX_MET = 6; const MAX_KEPT = 5;
/** Whether a roam's discovery card is an excerpt, so the preview only mentions 节选 when the image carries one. */
export const discoveryExcerpted = session => metInOrder(session).length > MAX_MET || keptSongs(session).length > MAX_KEPT;

/** 发现卡片 for a roam: the start, the singers met (an excerpt when long) and up to five kept songs. */
export async function buildDiscoveryCard(session) {
  await document.fonts?.ready;
  const { canvas, ctx } = canvasBase();
  const serif = serifFamily();
  const met = metInOrder(session);
  const kept = keptSongs(session);
  const when = session.updated || session.created || Date.now();
  nightBackdrop(ctx);
  petals(ctx);
  heading(ctx, '发现卡片 · 从喜欢，走向未知');
  // The ticket is as tall as what it carries: the singers' row above the tear, and a stub as tall as its
  // list (five songs and 等 N 首 fill 400px). A short list makes a shorter ticket, centred in the night
  // between the heading and the footer, so no blank band is left on the paper.
  const listed = kept.slice(0, MAX_KEPT);
  const rows = listed.length ? listed.length + (kept.length > MAX_KEPT ? 1 : 0) : 2;
  const stubHeight = 170 + (rows - 1) * 46;
  const UPPER = 500; const TALLEST = 900;
  const T = { x: 64, w: 952, r: 26, h: UPPER + stubHeight };
  T.y = 318 + Math.round((TALLEST - T.h) / 2);
  T.tear = T.y + UPPER;
  ticketPaper(ctx, T);
  const left = T.x + 64; const right = T.x + T.w - 64;
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.rose; setFont(ctx, 500, 24); spacing(ctx, 5);
  ctx.fillText(`探索 · ${session.status === 'ended' ? '回顾' : '进行中'}`, left, T.y + 78);
  // 从 <start> 出发, the name in the serif of the shop's slips.
  spacing(ctx, 2);
  setFont(ctx, 500, 40, serif); ctx.fillStyle = C.muted;
  ctx.fillText('从', left, T.y + 186);
  const nameX = left + ctx.measureText('从').width + 14;
  ctx.fillStyle = C.ink;
  const size = fitLine(ctx, artistName(session.start), nameX, T.y + 186, right - nameX - 250, 84, { family: serif, weight: 700, min: 44 });
  setFont(ctx, 700, size, serif);
  const nameWidth = Math.min(ctx.measureText(artistName(session.start)).width, right - nameX - 250);
  setFont(ctx, 500, 40, serif); ctx.fillStyle = C.muted;
  ctx.fillText('出发', nameX + nameWidth + 14, T.y + 186);
  ctx.fillStyle = C.inkSoft; setFont(ctx, 400, 27); spacing(ctx, 1);
  ctx.fillText(`途经 ${met.length} 位 · 留下 ${kept.length} 首 · ${longDate(when)}`, left, T.y + 244, right - left - 170);
  ctx.restore();
  seal(ctx, right - 66, T.y + 108, '发现', stampDate(when));
  // The singers met, first to last. Long walks keep the first three and the last two (节选).
  const excerpt = met.length > MAX_MET;
  const slots = excerpt ? [...met.slice(0, 3), { gap: true }, ...met.slice(-2)] : met;
  const slotWidth = (right - left) / Math.max(slots.length, 4);
  const rowLeft = left + ((right - left) - slotWidth * slots.length) / 2;
  const cy = T.y + 318; const sleeve = 92;
  const tilts = [-.05, .04, -.03, .05, -.04, .03];
  // → between two singers walked one to the next; ↩ where the walk went back before reaching the next one.
  const glyphOf = (slot, index) => index === 0 || slot.gap || slots[index - 1].gap ? '' : slot.walked ? '→' : '↩';
  const turned = slots.some((slot, index) => glyphOf(slot, index) === '↩');
  slots.forEach((slot, index) => {
    const cx = rowLeft + slotWidth * (index + .5);
    const glyph = glyphOf(slot, index);
    if (glyph) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold; setFont(ctx, 600, 30);
      ctx.fillText(glyph, cx - slotWidth / 2, cy + 10);
      ctx.restore();
    }
    if (slot.gap) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.muted; setFont(ctx, 700, 34); spacing(ctx, 4);
      ctx.fillText('···', cx, cy + 10);
      setFont(ctx, 500, 21); spacing(ctx, 1); ctx.fillText(`另 ${met.length - 5} 位`, cx, cy + sleeve);
      ctx.restore();
      return;
    }
    artistSleeve(ctx, cx, cy, sleeve, toneOf(slot.id), tilts[index % tilts.length]);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = slot.id === session.start ? C.ink : C.inkSoft;
    fitLine(ctx, artistName(slot.id), cx, cy + sleeve, slotWidth - 12, 26, { family: serif, weight: 600, min: 18 });
    ctx.restore();
  });
  // The key under the row names each mark it uses. Beside a 节选 tag a long key drops its opening words.
  ctx.save();
  setFont(ctx, 600, 21); spacing(ctx, 2);
  const tagRoom = excerpt ? ctx.measureText(`节选 · 共 ${met.length} 位`).width + 26 + 24 : 0;
  ctx.textAlign = 'left'; ctx.fillStyle = C.muted; setFont(ctx, 400, 21); spacing(ctx, 1);
  const walkKey = `→：沿合唱走过去${turned ? ' · ↩：退回后换个方向' : ''}`;
  const legend = ctx.measureText(`按遇见的先后 · ${walkKey}`).width <= right - left - tagRoom ? `按遇见的先后 · ${walkKey}` : walkKey;
  ctx.fillText(legend, left, T.y + 458, right - left - tagRoom);
  ctx.restore();
  if (excerpt) tag(ctx, `节选 · 共 ${met.length} 位`, right, T.y + 458, { align: 'right' });
  // Stub: the songs kept on the way.
  const sy = T.tear;
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = C.rose; setFont(ctx, 500, 24); spacing(ctx, 5);
  ctx.fillText('留下的歌', left, sy + 62);
  ctx.restore();
  if (kept.length > MAX_KEPT) tag(ctx, `节选 · 共 ${kept.length} 首`, right, sy + 62, { align: 'right' });
  if (!listed.length) {
    ctx.save(); ctx.fillStyle = C.muted; setFont(ctx, 400, 27); spacing(ctx, 1);
    wrapText(ctx, '这次还没有留下歌曲。走过的路，都在网页的探索回顾里。', left, sy + 128, right - left, 40, 2);
    ctx.restore();
  }
  listed.forEach((item, index) => {
    const song = songs[item.id];
    const y = sy + 120 + index * 46;
    ctx.save();
    ctx.textAlign = 'left'; ctx.fillStyle = C.rose; setFont(ctx, 600, 20, '"SFMono-Regular", Consolas, monospace');
    ctx.fillText(pad2(index + 1), left, y);
    ctx.fillStyle = C.ink; spacing(ctx, 1);
    fitLine(ctx, `《${song.title}》`, left + 46, y, 470, 29, { family: serif, weight: 600, min: 20 });
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; spacing(ctx, 0);
    fitLine(ctx, song.artists.map(artistName).join(' / '), right, y, 290, 22, { weight: 400, min: 16 });
    ctx.restore();
  });
  if (kept.length > 5) {
    ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = C.muted; setFont(ctx, 500, 23); spacing(ctx, 2);
    ctx.fillText(`等 ${kept.length} 首`, left + 46, sy + 120 + 5 * 46);
    ctx.restore();
  }
  footer(ctx, shortUrl(homeUrl()));
  return canvas;
}
export const discoveryCardName = session => `music-map-discovery-${fileDate(session.updated || session.created || Date.now())}.png`;

/* ---------- Preview: the finished PNG, saved or shared only on the player's click ---------- */

/** Show the PNG in a preview. 下载图片 saves it and 分享图片 (only where the browser can share files)
 *  hands it to the system sheet; nothing is saved or sent until one of them is clicked. Closing, a
 *  newer preview or leaving the page releases the image. */
export async function presentPng(canvas, { filename, title, alt, note = '' }) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片暂时未能生成，请重试。');
  closePreview?.();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const url = URL.createObjectURL(blob);
  const dialog = document.createElement('dialog');
  dialog.className = 'share-card-export';
  dialog.dataset.motion = 'self';
  dialog.setAttribute('aria-labelledby', 'share-card-export-title');
  dialog.innerHTML = `<header class="share-card-export__header"><h2 id="share-card-export-title">${escapeHTML(title)}</h2><span>PNG · ${canvas.width} × ${canvas.height}</span></header>
    <img class="share-card-export__poster" alt="${escapeHTML(alt)}" width="${canvas.width}" height="${canvas.height}">
    <p class="share-card-export__hint">也可以长按图片保存</p>
    ${note ? `<p class="share-card-export__note">${escapeHTML(note)}</p>` : ''}
    <div class="share-card-export__actions"><button class="button button--primary" type="button" data-export-download>下载图片</button><button class="button" type="button" data-export-share hidden>分享图片</button><button class="button" type="button" data-export-close>关闭</button></div>
    <p class="share-card-export__error" role="alert" data-export-error hidden></p>`;
  const image = dialog.querySelector('img');
  image.src = url;
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (closePreview === dispose) closePreview = null;
    if (dialog.open) dialog.close();
    image.removeAttribute('src');
    dialog.remove();
    URL.revokeObjectURL(url);
    window.removeEventListener('popstate', dispose);
    window.removeEventListener('pagehide', dispose);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  dialog.querySelector('[data-export-download]').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link);
    link.click(); link.remove();
  });
  dialog.querySelector('[data-export-close]').addEventListener('click', dispose);
  dialog.addEventListener('close', dispose, { once: true });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dispose();
  });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: 'image/png' });
    let shareable = false;
    try { shareable = navigator.canShare({ files: [file] }); } catch { shareable = false; }
    if (shareable) {
      const share = dialog.querySelector('[data-export-share]');
      const error = dialog.querySelector('[data-export-error]');
      share.hidden = false;
      dialog.querySelector('.share-card-export__actions').classList.add('has-share');
      share.addEventListener('click', async () => {
        share.disabled = true; error.hidden = true;
        try { await navigator.share({ files: [file], title }); }
        catch (reason) {
          if (reason?.name !== 'AbortError' && !disposed) {
            error.textContent = '暂时无法分享，可以先下载图片。';
            error.hidden = false;
          }
        } finally { if (!disposed) share.disabled = false; }
      });
    }
  }
  closePreview = dispose;
  window.addEventListener('popstate', dispose);
  window.addEventListener('pagehide', dispose);
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('[data-export-close]').focus({ preventScroll: true });
  return dialog;
}

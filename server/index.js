import { createServer } from 'node:http';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, get, all, run, transaction } from './db.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const DIST = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const PREFIX = '/api/live';
const EVENT_ID = 'echo-live-2026';
const CAPACITY = 24;
const BODY_LIMIT = 8192;
const PHOTO_LIMIT = 300 * 1024;
const PHOTO_BODY_LIMIT = 420 * 1024;
const now = () => new Date().toISOString();
const hash = (value) => createHash('sha256').update(value).digest('hex');

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) { throw new ApiError(status, code, message); }

function text(value, field, maximum, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || [...value.trim()].length > maximum) {
    fail(400, 'INVALID_INPUT', `${field}请填写不超过 ${maximum} 个字的文字。`);
  }
  return value.trim();
}

function choice(value, allowed, field) {
  if (!allowed.includes(value)) fail(400, 'INVALID_INPUT', `${field}的选择无效。`);
  return value;
}

function boolean(value) {
  if (typeof value !== 'boolean') fail(400, 'INVALID_INPUT', '请选择是否展示这张卡。');
  return value;
}

const limits = new Map();
function rateLimit(key, maximum, duration) {
  const time = Date.now();
  let entry = limits.get(key);
  if (!entry || entry.until <= time) {
    entry = { count: 0, until: time + duration };
    limits.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > maximum) {
    const error = new ApiError(429, 'RATE_LIMITED', '操作有些频繁，请稍后再试。');
    error.retryAfter = Math.max(1, Math.ceil((entry.until - time) / 1000));
    throw error;
  }
}
const limitCleanup = setInterval(() => {
  for (const [key, entry] of limits) if (entry.until <= Date.now()) limits.delete(key);
}, 60_000);
limitCleanup.unref();

async function readJSON(request, maximum = BODY_LIMIT) {
  if (Number(request.headers['content-length'] || 0) > maximum) {
    fail(413, 'BODY_TOO_LARGE', '提交内容过大，请压缩照片或缩短文字后重试。');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximum) fail(413, 'BODY_TOO_LARGE', '提交内容过大。');
    chunks.push(chunk);
  }
  if (!length) return {};
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    fail(415, 'JSON_REQUIRED', '请使用 JSON 提交。');
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'INVALID_JSON', '提交内容不是有效的 JSON。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'INVALID_JSON', '提交内容应为 JSON 对象。');
  return data;
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function authenticate(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '');
  if (!match) fail(401, 'SESSION_REQUIRED', '请先建立你的访问身份。');
  const user = get('SELECT id, name FROM users WHERE token_hash = ?', hash(match[1]));
  if (!user) fail(401, 'SESSION_INVALID', '访问身份已失效，请重新进入。');
  return user;
}

function requireRoom(roomId, userId) {
  const room = get(`SELECT r.* FROM rooms r JOIN room_members m ON m.room_id = r.id
    WHERE r.id = ? AND m.user_id = ?`, roomId, userId);
  if (!room) fail(403, 'ROOM_ACCESS_DENIED', '请先凭邀请码加入这个房间。');
  return room;
}

function roomSummary(room) {
  return {
    id: room.id, code: room.code, title: room.title, eventId: room.event_id,
    event: roomEvent(room),
    capacity: CAPACITY,
    memberCount: get('SELECT COUNT(*) AS total FROM room_members WHERE room_id = ?', room.id).total,
  };
}

function roomEvent(room) {
  if (room.event_id === EVENT_ID) {
    return { id: EVENT_ID, title: '回声现场', date: '2026-09-26', city: '广州', song: '把晚风借给你', isDemo: true };
  }
  return { id: room.event_id, title: room.title, date: room.event_date || '', city: room.city || '', song: room.song || '', isDemo: false };
}

function cardJSON(card, room) {
  if (!card) return null;
  return {
    id: card.id, ownerId: card.owner_id, ownerName: card.owner_name,
    eventId: room.event_id, event: roomEvent(room),
    photoKey: card.photo_key, photoId: card.photo_id || null,
    perspective: card.perspective || card.photo_key, caption: card.caption,
    momentId: card.moment_id, trackId: card.track_id, isPublic: Boolean(card.is_public),
    revision: card.revision, createdAt: card.created_at, updatedAt: card.updated_at,
  };
}

function findCard(roomId, ownerId) {
  return get(`SELECT c.*, u.name AS owner_name FROM cards c JOIN users u ON u.id = c.owner_id
    WHERE c.room_id = ? AND c.owner_id = ?`, roomId, ownerId);
}

function roomState(room, user) {
  const cards = all(`SELECT c.*, u.name AS owner_name FROM cards c
    JOIN users u ON u.id = c.owner_id
    JOIN room_members m ON m.room_id = c.room_id AND m.user_id = c.owner_id
    WHERE c.room_id = ? AND (c.is_public = 1 OR c.owner_id = ?)
    ORDER BY c.created_at, c.id`, room.id, user.id).map((card) => cardJSON(card, room));
  const exchanges = all(`SELECT * FROM exchanges
    WHERE room_id = ? AND (from_user_id = ? OR to_user_id = ?) ORDER BY created_at, id`, room.id, user.id, user.id)
    .map((exchange) => ({
      id: exchange.id, from: exchange.from_user_id, to: exchange.to_user_id,
      fromCardId: exchange.from_card_id, toCardId: exchange.to_card_id,
      fromCard: JSON.parse(exchange.from_card), toCard: JSON.parse(exchange.to_card),
      status: exchange.status, cancelReason: exchange.cancel_reason,
      createdAt: exchange.created_at, decidedAt: exchange.decided_at,
    }));
  const records = all('SELECT * FROM records WHERE room_id = ? AND owner_id = ? ORDER BY created_at DESC, id', room.id, user.id)
    .map((record) => ({
      id: record.id, kind: 'exchange', exchangeId: record.exchange_id, title: record.title,
      fromCard: JSON.parse(record.from_card), toCard: JSON.parse(record.to_card), createdAt: record.created_at,
    }));
  return { room: roomSummary(room), me: user, ownCard: cards.find((card) => card.ownerId === user.id) || null, cards, exchanges, records };
}

function cancelPending(roomId, cardId, reason = 'hidden') {
  run(`UPDATE exchanges SET status = 'cancelled', cancel_reason = ?, decided_at = ?
    WHERE room_id = ? AND status = 'pending' AND (from_card_id = ? OR to_card_id = ?)`, reason, now(), roomId, cardId, cardId);
}

function newRoomCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(100000, 1000000));
    if (!get('SELECT id FROM rooms WHERE code = ?', code)) return code;
  }
  fail(503, 'ROOM_UNAVAILABLE', '暂时无法创建房间，请稍后再试。');
}

function jpegPhoto(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,')) {
    fail(400, 'INVALID_PHOTO', '请先将照片转换为 JPEG 后上传。');
  }
  const encoded = dataUrl.slice('data:image/jpeg;base64,'.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    fail(400, 'INVALID_PHOTO', '照片内容无效，请重新选择照片。');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > PHOTO_LIMIT) fail(413, 'PHOTO_TOO_LARGE', '照片请压缩至 300 KB 以内。');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    fail(400, 'INVALID_PHOTO', '照片不是有效的 JPEG 文件。');
  }
  return bytes;
}

function mayReadPhoto(photo, userId) {
  if (photo.owner_id === userId) return true;
  const displayed = get(`SELECT 1 FROM cards c
    JOIN room_members viewer ON viewer.room_id = c.room_id AND viewer.user_id = ?
    JOIN room_members owner ON owner.room_id = c.room_id AND owner.user_id = c.owner_id
    WHERE c.room_id = ? AND c.photo_id = ? AND c.is_public = 1`, userId, photo.room_id, photo.id);
  if (displayed) return true;
  const exchanged = get(`SELECT 1 FROM exchanges
    WHERE room_id = ? AND (from_user_id = ? OR to_user_id = ?) AND status IN ('pending', 'accepted')
      AND (json_extract(from_card, '$.photoId') = ? OR json_extract(to_card, '$.photoId') = ?)`,
  photo.room_id, userId, userId, photo.id, photo.id);
  if (exchanged) return true;
  return Boolean(get(`SELECT 1 FROM records WHERE room_id = ? AND owner_id = ?
    AND (json_extract(from_card, '$.photoId') = ? OR json_extract(to_card, '$.photoId') = ?)`,
  photo.room_id, userId, photo.id, photo.id));
}

async function api(request, response, path) {
  const method = request.method;
  const ip = request.socket.remoteAddress || 'unknown';
  if (method === 'GET' && path === '/health') return json(response, 200, { ok: true, storage: 'sqlite' });

  if (method === 'POST' && path === '/session') {
    rateLimit(`session:${ip}`, 30, 15 * 60_000);
    const data = await readJSON(request);
    const name = text(data.name, '称呼', 20, `观众${randomInt(1000, 10000)}`);
    if (!name) fail(400, 'INVALID_INPUT', '请填写一个称呼。');
    const token = randomBytes(32).toString('base64url');
    const user = { id: randomUUID(), name };
    run('INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)', user.id, user.name, hash(token), now());
    return json(response, 201, { token, user });
  }

  const user = authenticate(request);
  rateLimit(`user:${user.id}:${method === 'GET' ? 'read' : 'write'}`, method === 'GET' ? 120 : 30, 60_000);
  if (method === 'GET' && path === '/session') {
    const rooms = all(`SELECT r.* FROM rooms r JOIN room_members m ON m.room_id = r.id
      WHERE m.user_id = ? ORDER BY m.joined_at DESC`, user.id).map(roomSummary);
    return json(response, 200, { user, rooms });
  }

  const photoRoute = /^\/photos\/([a-f0-9-]{36})$/.exec(path);
  if (method === 'GET' && photoRoute) {
    const photo = get('SELECT id, room_id, owner_id, mime FROM photos WHERE id = ?', photoRoute[1]);
    if (!photo || !mayReadPhoto(photo, user.id)) fail(404, 'PHOTO_UNAVAILABLE', '这张照片不可查看。');
    const { data } = get('SELECT data FROM photos WHERE id = ?', photo.id);
    response.writeHead(200, { 'Content-Type': photo.mime, 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    return response.end(Buffer.from(data));
  }

  if (method === 'POST' && path === '/rooms') {
    rateLimit(`create-room:${user.id}`, 5, 60 * 60_000);
    const data = await readJSON(request);
    const title = text(data.title, '活动名称', 60);
    if (!title) fail(400, 'INVALID_INPUT', '请填写房间名称。');
    const eventDate = text(data.eventDate, '日期', 10, '');
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
      || !Number.isFinite(Date.parse(`${eventDate}T00:00:00Z`))
      || new Date(`${eventDate}T00:00:00Z`).toISOString().slice(0, 10) !== eventDate)) {
      fail(400, 'INVALID_INPUT', '日期请使用有效的 YYYY-MM-DD 格式，或留空。');
    }
    const city = text(data.city, '城市', 40, '');
    const song = text(data.song, '共同歌曲', 80, '');
    const room = transaction(() => {
      const id = randomUUID();
      run(`INSERT INTO rooms (id, code, title, event_id, creator_id, created_at, event_date, city, song)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, newRoomCode(), title, `room:${id}`, user.id, now(), eventDate, city, song);
      run('INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)', id, user.id, now());
      return get('SELECT * FROM rooms WHERE id = ?', id);
    });
    return json(response, 201, roomState(room, user));
  }

  if (method === 'POST' && path === '/rooms/join') {
    rateLimit(`join-user:${user.id}`, 10, 15 * 60_000);
    rateLimit(`join-ip:${ip}`, 40, 15 * 60_000);
    const data = await readJSON(request);
    if (typeof data.code !== 'string' || !/^\d{6}$/.test(data.code.trim())) fail(400, 'INVALID_INPUT', '请输入六位数字邀请码。');
    const room = transaction(() => {
      const found = get('SELECT * FROM rooms WHERE code = ?', data.code.trim());
      if (!found) fail(404, 'INVITE_UNAVAILABLE', '邀请码无效，请向朋友确认。');
      if (!get('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?', found.id, user.id)) {
        if (roomSummary(found).memberCount >= CAPACITY) fail(409, 'ROOM_FULL', '这个房间已满员。');
        run('INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)', found.id, user.id, now());
      }
      return found;
    });
    return json(response, 200, roomState(room, user));
  }

  const route = /^\/rooms\/([a-f0-9-]{36})(.*)$/.exec(path);
  if (!route) fail(404, 'NOT_FOUND', '接口不存在。');
  const room = requireRoom(route[1], user.id);
  const action = route[2];
  if (method === 'GET' && action === '') return json(response, 200, roomState(room, user));

  if (method === 'POST' && action === '/photos') {
    rateLimit(`photo-minute:${user.id}`, 12, 60_000);
    rateLimit(`photo-hour:${user.id}`, 60, 60 * 60_000);
    const data = await readJSON(request, PHOTO_BODY_LIMIT);
    const bytes = jpegPhoto(data.dataUrl);
    const photoId = transaction(() => {
      requireRoom(room.id, user.id);
      const id = randomUUID();
      run('INSERT INTO photos (id, room_id, owner_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id, room.id, user.id, 'image/jpeg', bytes, now());
      return id;
    });
    return json(response, 201, { photoId });
  }

  if (method === 'PUT' && action === '/card') {
    const data = await readJSON(request);
    const photoKey = choice(data.photoKey, ['stage', 'crowd'], '图片');
    const caption = text(data.caption, '感受', 80);
    const momentId = choice(data.momentId, ['encore', 'chorus', 'lights'], '时刻');
    const trackId = choice(data.trackId, ['co-0', ''], '音乐');
    const isPublic = boolean(data.isPublic);
    const perspective = choice(data.perspective ?? photoKey, ['stage', 'crowd', 'friends', 'detail'], '视角');
    const photoId = data.photoId == null ? null : text(data.photoId, '照片', 36);
    transaction(() => {
      requireRoom(room.id, user.id);
      if (photoId !== null && !get('SELECT 1 FROM photos WHERE id = ? AND room_id = ? AND owner_id = ?', photoId, room.id, user.id)) {
        fail(400, 'PHOTO_UNAVAILABLE', '只能使用你在这个房间上传的照片，请重新选择。');
      }
      const old = findCard(room.id, user.id);
      const time = now();
      run(`INSERT INTO cards (id, room_id, owner_id, photo_key, caption, moment_id, track_id, is_public, revision, created_at, updated_at, photo_id, perspective)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_id, owner_id) DO UPDATE SET photo_key = excluded.photo_key, caption = excluded.caption,
          moment_id = excluded.moment_id, track_id = excluded.track_id, is_public = excluded.is_public,
          revision = excluded.revision, updated_at = excluded.updated_at, photo_id = excluded.photo_id, perspective = excluded.perspective`,
      old?.id || randomUUID(), room.id, user.id, photoKey, caption, momentId, trackId, Number(isPublic), (old?.revision || 0) + 1, old?.created_at || time, time, photoId, perspective);
      if (old?.is_public && !isPublic) cancelPending(room.id, old.id);
    });
    return json(response, 200, roomState(room, user));
  }

  if (method === 'PATCH' && action === '/card/visibility') {
    const data = await readJSON(request);
    const isPublic = boolean(data.isPublic);
    transaction(() => {
      requireRoom(room.id, user.id);
      const own = findCard(room.id, user.id);
      if (!own) fail(404, 'CARD_REQUIRED', '先制作自己的现场卡。');
      if (Boolean(own.is_public) !== isPublic) run('UPDATE cards SET is_public = ?, revision = revision + 1, updated_at = ? WHERE id = ?', Number(isPublic), now(), own.id);
      if (!isPublic) cancelPending(room.id, own.id);
    });
    return json(response, 200, roomState(room, user));
  }

  if (method === 'POST' && action === '/exchanges') {
    const data = await readJSON(request);
    const targetId = text(data.toCardId, '目标卡片', 64);
    if (![data.fromRevision, data.toRevision].every((revision) => Number.isSafeInteger(revision) && revision >= 1)) {
      fail(400, 'INVALID_INPUT', '请先查看最新的两张卡，再发起交换。');
    }
    transaction(() => {
      requireRoom(room.id, user.id);
      const own = findCard(room.id, user.id);
      if (!own) fail(409, 'CARD_REQUIRED', '先制作自己的现场卡。');
      const target = get(`SELECT c.*, u.name AS owner_name FROM cards c JOIN users u ON u.id = c.owner_id
        JOIN room_members m ON m.room_id = c.room_id AND m.user_id = c.owner_id
        WHERE c.room_id = ? AND c.id = ? AND c.is_public = 1`, room.id, targetId);
      if (!target) fail(404, 'CARD_UNAVAILABLE', '对方的卡已撤下或不可交换。');
      if (target.owner_id === user.id) fail(400, 'SELF_EXCHANGE', '不能和自己的卡交换。');
      if (own.revision !== data.fromRevision || target.revision !== data.toRevision) fail(409, 'CARD_CHANGED', '卡片已更新，请查看最新的两张卡后再确认。');
      const pairKey = [user.id, target.owner_id].sort().join(':');
      if (get("SELECT id FROM exchanges WHERE room_id = ? AND pair_key = ? AND status = 'pending'", room.id, pairKey)) {
        fail(409, 'EXCHANGE_PENDING', '你们已有一条待回应的交换申请。');
      }
      run(`INSERT INTO exchanges (id, room_id, from_user_id, to_user_id, from_card_id, to_card_id, pair_key, from_card, to_card, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`, randomUUID(), room.id, user.id, target.owner_id, own.id, target.id,
      pairKey, JSON.stringify(cardJSON(own, room)), JSON.stringify(cardJSON(target, room)), now());
    });
    return json(response, 201, roomState(room, user));
  }

  const decisionRoute = /^\/exchanges\/([a-f0-9-]{36})\/decision$/.exec(action);
  if (method === 'POST' && decisionRoute) {
    const data = await readJSON(request);
    const decision = choice(data.decision, ['accepted', 'declined', 'cancelled'], '回应');
    transaction(() => {
      requireRoom(room.id, user.id);
      const exchange = get('SELECT * FROM exchanges WHERE id = ? AND room_id = ? AND (from_user_id = ? OR to_user_id = ?)', decisionRoute[1], room.id, user.id, user.id);
      if (!exchange) fail(404, 'EXCHANGE_UNAVAILABLE', '这条申请不可查看。');
      const allowed = decision === 'cancelled' ? exchange.from_user_id === user.id : exchange.to_user_id === user.id;
      if (!allowed) fail(403, 'DECISION_FORBIDDEN', decision === 'cancelled' ? '只有发起方可以取消申请。' : '只有接收方可以接受或拒绝。');
      if (exchange.status === decision) return;
      if (exchange.status !== 'pending') fail(409, 'EXCHANGE_CLOSED', '这条申请已经处理，请查看最新状态。');
      const time = now();
      run('UPDATE exchanges SET status = ?, decided_at = ?, cancel_reason = ? WHERE id = ?', decision, time, decision === 'cancelled' ? 'sender' : null, exchange.id);
      if (decision === 'accepted') {
        const from = JSON.parse(exchange.from_card);
        const to = JSON.parse(exchange.to_card);
        for (const ownerId of [exchange.from_user_id, exchange.to_user_id]) {
          const otherName = ownerId === exchange.from_user_id ? to.ownerName : from.ownerName;
          run(`INSERT INTO records (id, room_id, owner_id, exchange_id, title, from_card, to_card, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, randomUUID(), room.id, ownerId, exchange.id,
          `${roomEvent(room).title} · 与${otherName}的双联记忆`, exchange.from_card, exchange.to_card, time);
        }
      }
    });
    return json(response, 200, roomState(room, user));
  }

  const recordRoute = /^\/records\/([a-f0-9-]{36})$/.exec(action);
  if (method === 'DELETE' && recordRoute) {
    run('DELETE FROM records WHERE id = ? AND room_id = ? AND owner_id = ?', recordRoute[1], room.id, user.id);
    return json(response, 200, roomState(room, user));
  }

  if (method === 'DELETE' && action === '/membership') {
    transaction(() => {
      run('UPDATE cards SET is_public = 0, revision = revision + 1, updated_at = ? WHERE room_id = ? AND owner_id = ?', now(), room.id, user.id);
      run(`UPDATE exchanges SET status = 'cancelled', cancel_reason = 'left', decided_at = ?
        WHERE room_id = ? AND status = 'pending' AND (from_user_id = ? OR to_user_id = ?)`, now(), room.id, user.id, user.id);
      run('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', room.id, user.id);
    });
    return json(response, 200, { left: true, roomId: room.id });
  }
  fail(404, 'NOT_FOUND', '接口不存在。');
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

async function serveStatic(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) fail(405, 'METHOD_NOT_ALLOWED', '不支持这个操作。');
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { fail(400, 'INVALID_PATH', '路径无效。'); }
  if (decoded.includes('\0')) fail(400, 'INVALID_PATH', '路径无效。');
  let file = resolve(DIST, `.${decoded}`);
  if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) fail(404, 'NOT_FOUND', '文件不存在。');
  let info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    if (extname(decoded)) fail(404, 'NOT_FOUND', '文件不存在。');
    file = resolve(DIST, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) fail(503, 'BUILD_REQUIRED', '网页尚未构建，请先执行 npm run build。');
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(file);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === PREFIX || pathname.startsWith(`${PREFIX}/`)) await api(request, response, pathname.slice(PREFIX.length));
    else if (pathname.startsWith('/api/')) fail(404, 'NOT_FOUND', '接口不存在。');
    else await serveStatic(request, response, pathname);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    if (!(error instanceof ApiError)) console.error('Live API error:', error.code || error.name);
    if (error.retryAfter) response.setHeader('Retry-After', error.retryAfter);
    json(response, error.status || 500, { error: { code: error.code && error instanceof ApiError ? error.code : 'SERVER_ERROR', message: error instanceof ApiError ? error.message : '服务暂时不可用，请保留当前内容后重试。' } });
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `端口 ${PORT} 已被占用。若已启动过服务，可打开 http://${HOST}:${PORT}；否则设置 PORT 后再启动。`
    : `服务未能启动：${error.code || error.message}`);
  db.close();
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => console.log(`Music Map live service: http://${HOST}:${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { db.close(); process.exit(0); });
});

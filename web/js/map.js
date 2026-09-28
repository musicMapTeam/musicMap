import { MAP_DATA_VERSION, catalogues, artistById, songs, edges, artistName, datasetForArtist, artistsInDataset, otherArtist, getNeighbors, isReachable } from './map-data.js';
import { getSavedMusic, saveMusic, removeSavedMusic, importSavedMusic, subscribeSavedMusic } from './music-library.js';
import '../css/map.css';
import { networkEdges, networkLayout, shortestChain, shortestChains, roundKnowledge, distancesFrom, roundHint, chainLength, roundEdge } from './map-network.js';
import { buildChallengeCard, buildDiscoveryCard, challengeCardName, discoveryCardName, discoveryExcerpted, presentPng, shareChallengeLink, challengeUrl, challengeText } from './share-card.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currentNode = session => session.path[session.path.length - 1];
const activeSession = map => map.sessions.find(session => session.id === map.activeId);
const sessionById = (map, id) => map.sessions.find(session => session.id === id);
const modeName = mode => mode === 'co' ? '合作关系' : '策展标签';
const sessionDataset = session => session?.dataset || datasetForArtist(session?.start) || 'real';
const catalogueFor = session => catalogues[sessionDataset(session)];
const dateLabel = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
/** A finished round is read-only: arrived (complete) or given up (revealed). */
const isClosed = session => session?.status === 'complete' || session?.status === 'revealed';
/** 寻声 rounds are fogged challenges. Older challenges without fog keep the full network. */
const isRound = session => session?.type === 'challenge' && Boolean(session?.fog);
/** A free roam: tapping a neighbour of the current singer walks there. Rounds and older challenges never do. */
const isFreeRoam = session => session?.type === 'roam';
/** A roam worth keeping in 我的发现: it walked at least once or kept a song. */
const roamHasProgress = session => session.events.some(event => event.type === 'move') || session.saved.length > 0;
/** Replacing this roam would drop real progress, so the player is asked first. */
const roamNeedsConfirm = session => isFreeRoam(session) && session.status === 'active' && roamHasProgress(session);
/** An ended roam stays ended until the player picks 继续本次探索: taps only select, nothing walks. */
const roamEnded = session => isFreeRoam(session) && session.status === 'ended';
/** A record 我的发现 lists and the courtyard counts: walked, kept, flipped or hinted, or finished.
 *  A round dealt on the first visit and never opened, or a roam that never left its start, is not one. */
export const recordProgressed = session => session.path.length > 1 || Boolean(session.saved?.length) || Boolean(session.flipped?.length)
  || Boolean(session.hints?.length) || session.events?.some(event => event.type === 'move') || ['complete', 'revealed', 'ended'].includes(session.status);
const listedRecords = map => map.sessions.filter(recordProgressed).sort((a, b) => b.updated - a.updated);
const toneOf = id => artistById[id]?.color || '#b9ad90';
const roamStartToast = id => `从${artistName(id)}出发 · 点相连的歌手就走过去`;
const prefersReducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const songTitle = edge => edge?.song ? songs[edge.song]?.title : edge?.reason;
const hintLabels = { 1: '提示 · 还隔几首', 2: '提示 · 往哪翻', 3: '揭晓答案' };
const SEALED_TOAST = '这张还盖着：在你所在的唱片翻开合作，才会认出 TA';
/** 五月天 is a band, not one singer: the dock, the papers and the table say so. */
const isGroup = id => artistById[id]?.entity === 'group';
const groupNote = id => isGroup(id) ? '（乐团）' : '';
/** The rule of a round in one line, as the friend's note and the custom form give it. */
const ROUND_RULE = '翻开所在歌手手边的合唱，沿翻开的合唱前往；翻开和提示不计步。';
let lastPresentedArtist = null;
const fallbackViews = new Map();
// Set when the shop opens on a different singer; the 2D table's next drawing centres a closer view on them.
let fallbackRecentre = false;
// A one-render cue for hand/scene motion (flip, target flash). Never persisted.
let handMotion = null;
// The hinted card is scrolled into view once per hint, not on every redraw.
let lastHintReveal = null;
// The atlas connection list starts folded each time the record shop is entered.
let leftExplore = true;
// The mounted record shop's table redraw. A handler that outlives its render (a move redraws the
// shop, then centres the new singer) must reach the table on the page, not the one it was bound to.
let redrawTable = null;
// The control that opened the paper on the table, so closing it hands focus back there (not to the
// first button on the page). Kept by action and data, since every open or close redraws the shop.
let panelOpener = null;
// A round was just dealt (preset, custom, friend's link): its first drawing shows the whole table,
// whatever zoom the atlas was left at.
let fitTableOnMount = false;
// One PNG is drawn at a time; a second click while it is being drawn does nothing.
let drawingCard = false;

function songDraft(song) {
  return { id: song.id, title: song.title, artists: song.artists.map(artistName), source: song.sourceUrl || '', dataset: 'real' };
}

/** A roam answers from its own list (本次发现). A round shows whether the song is in 留下的歌. */
function songIsSaved(session, id) {
  if (isFreeRoam(session) || songs[id]?.dataset !== 'real') return session.saved.some(item => item.id === id);
  return getSavedMusic().some(item => item.id === id);
}

/** Distinct songs kept in this session, in the order they were first kept. */
function currentSavedSongs(session) {
  const kept = session.saved.filter((item, index, list) => list.findIndex(other => other.id === item.id) === index);
  if (isFreeRoam(session) || sessionDataset(session) !== 'real') return kept;
  const savedIds = new Set(getSavedMusic().map(track => track.id));
  return kept.filter(item => savedIds.has(item.id));
}

export function importLegacyMapMusic(api) {
  const tracks = api.getState().map.sessions.flatMap(session => session.saved
    .filter(item => songs[item.id]?.dataset === 'real')
    .map(item => ({ ...songDraft(songs[item.id]), savedAt: item.savedAt || session.updated || session.created })));
  return importSavedMusic(tracks.sort((a, b) => b.savedAt - a.savedAt));
}

function createSession(start, type = 'roam', target = null, returnRoamId = null, fog = false) {
  const now = Date.now();
  const dataset = datasetForArtist(start);
  return {
    id: globalThis.crypto?.randomUUID?.() || `map-${now}-${Math.random().toString(36).slice(2, 8)}`,
    dataset, version: catalogues[dataset].version, type, start, target, returnRoamId,
    status: 'active', mode: 'co', yaw: 0, pitch: 0,
    path: [{ id: start, mode: 'co', yaw: 0, pitch: 0 }],
    events: [], saved: [], created: now, updated: now,
    ...(type === 'challenge' && fog ? { fog: true, flipped: [], hints: [] } : {}),
  };
}

export function createMapState() {
  const [start, target] = catalogues.real.rounds[0];
  const initial = createSession(start, 'challenge', target, null, true);
  return {
    version: MAP_DATA_VERSION,
    sessions: [initial], activeId: initial.id, undo: null, roundsIntroduced: 1, keptBySession: 1,
    lastSessionByDataset: { real: initial.id },
    view: { panel: null, reviewId: null, query: '', selectedArtistId: start, challengeStart: start, challengeEnd: target, challengeError: '', ceremony: null, roundCursor: { real: 0, fictional: 0 } },
  };
}

function activateSession(map, session) {
  if (map.activeId !== session.id) {
    map.view.selectedArtistId = currentNode(session).id;
    map.view.selectedEdgeId = null;
    // Another record on the table: an undo left from the one before goes with it.
    if (map.undo && map.undo.sessionId !== session.id) map.undo = null;
  }
  if (map.view.ceremony && map.view.ceremony.sessionId !== session.id) map.view.ceremony = null;
  map.activeId = session.id;
  map.lastSessionByDataset ||= {};
  map.lastSessionByDataset[sessionDataset(session)] = session.id;
}

/** Only presets at least two songs apart become a round; checked again at runtime. */
function roundPairs(dataset) {
  return (catalogues[dataset]?.rounds || []).filter(([start, target]) => (chainLength(start, target, dataset) ?? 0) >= 2);
}

/** The roam 完整图鉴 leads back to from a round opened now: the roam on the table, or the one it came from. */
function roamToReturnTo(map, dataset) {
  const current = activeSession(map);
  if (!current || sessionDataset(current) !== dataset) return null;
  return current.type === 'roam' ? current.id : current.returnRoamId || null;
}

function startRound(map, start, target, friend = false) {
  const round = createSession(start, 'challenge', target, roamToReturnTo(map, datasetForArtist(start)), true);
  // A puzzle opened from a friend's link: only the pair came with it, never the friend's route or records.
  if (friend) round.friend = { at: Date.now(), dismissed: false };
  map.sessions.push(round);
  fitTableOnMount = true;
  activateSession(map, round);
  Object.assign(map.view, { panel: null, reviewId: null, selectedArtistId: start, selectedEdgeId: null, ceremony: null, challengeStart: start, challengeEnd: target, challengeError: '' });
  return round;
}

function openNextRound(map, dataset) {
  const pairs = roundPairs(dataset);
  if (!pairs.length) return null;
  map.view.roundCursor ||= { real: 0, fictional: 0 };
  const current = activeSession(map);
  const dealt = ([start, target]) => map.sessions.some(session => isRound(session) && sessionDataset(session) === dataset && session.start === start && session.target === target);
  let cursor = Math.min(Math.max(0, map.view.roundCursor[dataset] ?? 0), pairs.length - 1);
  // The cursor marks the pair dealt last. A pair that was never opened here (a kept 0.14 roam,
  // a first visit to this catalogue's atlas) is dealt as it is, so the default round comes first.
  if (dealt(pairs[cursor])) for (let tries = 0; tries < pairs.length; tries++) {
    cursor = (cursor + 1) % pairs.length;
    const [start, target] = pairs[cursor];
    if (!(current?.start === start && current?.target === target) || pairs.length === 1) break;
  }
  map.view.roundCursor[dataset] = cursor;
  return startRound(map, ...pairs[cursor]);
}

/** Why a start and end cannot make a round, checked before anything is dealt ('' when they can). */
function roundError(start, target, dataset = 'real') {
  if (datasetForArtist(start) !== dataset || datasetForArtist(target) !== dataset) return '请选择当前图谱内的艺人。';
  if (start === target) return '出发点和终点相同，换一位想遇见的艺人吧。';
  if (!isReachable(start, target, dataset)) return '本专题已收录的合作关系尚未连通，请换个起点或终点。';
  return '';
}

/** A dealt round nobody has touched yet: no flip, no hint, no step. */
const untouchedRound = session => isRound(session) && session.status === 'active' && session.path.length === 1 && !session.events.length && !session.flipped?.length && !session.hints?.length;
/** The latest such round still on the shelf: 开一局 opens it rather than dealing past it. */
const waitingRound = map => [...map.sessions].filter(session => untouchedRound(session) && sessionDataset(session) === 'real' && artistById[session.target])
  .sort((a, b) => (b.updated || 0) - (a.updated || 0))[0] || null;

/** Remove a record and everything that still points at it. */
function dropSession(map, id) {
  map.sessions = map.sessions.filter(item => item.id !== id);
  Object.keys(map.lastSessionByDataset || {}).forEach(key => { if (map.lastSessionByDataset[key] === id) delete map.lastSessionByDataset[key]; });
  if (map.view.ceremony?.sessionId === id) map.view.ceremony = null;
  if (map.undo?.sessionId === id) map.undo = null;
  if (map.view.reviewId === id) map.view.reviewId = null;
}

// v1 stored sessions contain only the original fictional IDs. Keep their paths,
// songs and version unchanged; the dataset field identifies their own catalogue.
// 0.15: an untouched default roam (never walked, nothing kept) becomes the default round once.
// 0.16: a roam's 本次发现 is its own list. Before, a removal only left 留下的歌, so an old roam
// may still list songs the player had removed; those are dropped once, keeping what was shown.
function prepareStoredMap(api) {
  const map = api.getState().map;
  if (map.lastSessionByDataset && map.sessions.every(session => session.dataset) && map.roundsIntroduced && map.keptBySession && !('networkQuery' in map.view) && map.view.roundCursor) return;
  api.update(state => {
    const stored = state.map;
    if (!stored.keptBySession) {
      const library = new Set(getSavedMusic().map(track => track.id));
      stored.sessions.forEach(session => {
        if (isFreeRoam(session) && sessionDataset(session) === 'real') session.saved = session.saved.filter(item => library.has(item.id));
      });
      stored.keptBySession = 1;
    }
    stored.lastSessionByDataset ||= {};
    stored.sessions.forEach(session => { session.dataset ||= datasetForArtist(session.start) || 'fictional'; });
    delete stored.view.networkQuery;
    stored.view.roundCursor ||= { real: 0, fictional: 0 };
    stored.view.ceremony ??= null;
    if (!stored.roundsIntroduced) {
      const active = activeSession(stored);
      const pristine = active?.type === 'roam' && active.path.length === 1 && !active.events.length && !active.saved.length;
      if (!active || pristine) {
        const dataset = active ? sessionDataset(active) : 'real';
        if (pristine) {
          stored.sessions = stored.sessions.filter(item => item.id !== active.id);
          Object.keys(stored.lastSessionByDataset).forEach(key => { if (stored.lastSessionByDataset[key] === active.id) delete stored.lastSessionByDataset[key]; });
          stored.activeId = null;
        }
        const [start, target] = roundPairs(dataset)[0];
        startRound(stored, start, target);
      }
      stored.roundsIntroduced = 1;
    }
    const active = activeSession(stored);
    if (active) activateSession(stored, active);
  });
}

function button(action, label, className = 'button button--quiet', attrs = '') {
  return `<button type="button" class="${className}" data-map-action="${action}" ${attrs}>${label}</button>`;
}

function listenHTML(song, api, className = 'map-track__listen') {
  return (song?.listenLinks || []).map(link => `<a class="${className}" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="在${escapeHTML(link.platform)}打开《${escapeHTML(song.title)}》${escapeHTML(link.label)}，新标签页">${className === 'map-track__listen' ? '去听' : escapeHTML(link.label)} ${api.icon('arrow-up-right')}</a>`).join('');
}

function evidenceHTML(edge, api) {
  return edge.sourceUrl ? `<a class="map-evidence-link" href="${escapeHTML(edge.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="查看${escapeHTML(edge.sourceLabel)}，新标签页">${escapeHTML(edge.sourceLabel)} ${api.icon('arrow-up-right')}</a>` : '';
}

function creditRows(song) {
  const people = new Map();
  for (const credit of song.credits || []) {
    const name = credit.name || artistName(credit.artistId);
    if (!people.has(name)) people.set(name, { name, roles: [] });
    people.get(name).roles.push(credit);
  }
  return [...people.values()];
}

function creditsHTML(song, api, expanded = false) {
  if (!song?.credits?.length) return '';
  const people = creditRows(song);
  const table = `<table class="map-credit-table"><thead><tr><th scope="col">姓名</th><th scope="col">负责内容</th></tr></thead><tbody>${people.map(person => `<tr><th scope="row">${escapeHTML(person.name)}</th><td>${person.roles.map(credit => {
    const index = song.creditSources.findIndex(source => source.id === credit.sourceId);
    const source = song.creditSources[index];
    return `<span class="map-credit-role">${escapeHTML(credit.role)}<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(person.name)}的${escapeHTML(credit.role)}署名来源：${escapeHTML(source.label)}，新标签页" title="${escapeHTML(source.label)}">${index + 1}</a></span>`;
  }).join('')}</td></tr>`).join('')}</tbody></table>`;
  const sources = `<details class="map-credit-sources"><summary>署名来源 <span>${song.creditSources.length}</span></summary><ol>${song.creditSources.map(source => `<li><a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)} ${api.icon('arrow-up-right')}</a></li>`).join('')}</ol><p>核对于 ${song.checkedAt}。仅列已核实署名，未列出不表示未参与。</p></details>`;
  if (expanded) return `<div class="map-credits map-credits--expanded">${table}${sources}</div>`;
  return `<details class="map-credits"><summary><span>作品署名</span><small>${people.length} 位</small>${api.icon('chevron-right')}</summary>${table}${sources}</details>`;
}

/** `fogged`: during a 寻声 round the production credits stay closed. They can name artists the
 *  player has not met yet (a recording engineer, a lyricist), so they open with the setlist.
 *  `source` is where a keep is recorded (text, or per song); `noteFor` prints a line under a song,
 *  such as where it was kept. */
function tracksHTML(session, trackIds, api, source = '', showVersion = false, showCredits = false, fogged = false, noteFor = null) {
  return trackIds.map((id, index) => {
    const song = songs[id];
    if (!song) return '';
    const saved = songIsSaved(session, id);
    const creditLink = song.credits?.length && !fogged;
    const from = typeof source === 'function' ? source(id) : source;
    const note = noteFor?.(id);
    const detail = note ? `<small class="map-track__source">${escapeHTML(note)}</small>`
      : showVersion && (song.recordingLabel || song.versionLabel) ? `<small>${escapeHTML(song.recordingLabel || song.versionLabel)}</small>`
        : !showVersion && song.creditSummary ? `<small class="map-track__credit-preview">${escapeHTML(song.creditSummary)}</small>` : '';
    return `<div class="map-track">
      <span class="map-track__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="map-track__copy">${creditLink ? button('credits', `${escapeHTML(song.title)}<span aria-hidden="true">↗</span>`, 'map-track__title', `data-id="${id}" data-session="${session.id}" aria-label="查看《${escapeHTML(song.title)}》的作品署名"`) : `<strong>${escapeHTML(song.title)}</strong>`}<span>${song.artists.map(artistName).map(escapeHTML).join(' / ')}</span>${detail}</div>
      <div class="map-track__actions">${listenHTML(song, api)}${button('save', api.icon(saved ? 'check' : 'plus'), `icon-button map-track__save ${saved ? 'is-saved' : ''}`, `data-id="${id}" data-session="${session.id}" data-source="${escapeHTML(from)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》" aria-pressed="${saved}" title="${saved ? '已留下，点击移除' : '留下这首作品'}"`)}</div>
    </div>${showCredits && !fogged ? creditsHTML(song, api) : ''}`;
  }).join('');
}

/** Where a kept song came from, written the way the player walked. */
const duetSource = (a, b, edge) => `沿${artistName(a)}与${artistName(b)}的合作${edge?.song ? `《${songTitle(edge)}》` : '作品'}留下`;

/** An undo belongs to the removal it came from: the page it was made on (the record shop or 我的发现),
 *  its record, and that record as it was then. Once the roam ends or goes on, another record takes the
 *  table or the page changes, it is gone, so 撤销 never reaches into a record the player has left.
 *  `sessionId` narrows it to the record a paper or the table is showing. */
function liveUndo(map, page, sessionId = null) {
  const undo = map.undo;
  if (!undo || undo.page !== page || (sessionId && undo.sessionId !== sessionId)) return null;
  const owner = sessionById(map, undo.sessionId);
  return owner && owner.status === undo.status ? undo : null;
}

function undoHTML(map, api, page, sessionId = null) {
  const undo = liveUndo(map, page, sessionId);
  return undo ? `<div class="map-undo" role="status"><span>已移除《${escapeHTML(songs[undo.item.id]?.title)}》</span>${button('undo', '撤销', 'button button--quiet')}</div>` : '';
}

/* ---------- 寻声 state readers (pure; everything is derived from the session) ---------- */

function hintLevel(session) {
  const hints = session.hints || [];
  if (!hints.some(hint => hint.level === 1)) return 1;
  return hints.some(hint => hint.level === 2 && hint.at === session.events.length) ? 3 : 2;
}

function activeStub(session) {
  const hint = [...(session.hints || [])].reverse().find(item => item.level === 2);
  return hint && hint.at === session.events.length && hint.edgeId && session.status === 'active' ? hint : null;
}

/** Hint ② may lead back to the previous record: then 退一步 (which undoes a step) is the advice, not 「前往」. */
function hintBackTo(session, edgeId) {
  const edge = roundEdge(edgeId); const here = currentNode(session).id;
  const previous = session.path.length > 1 ? session.path[session.path.length - 2].id : null;
  return edge && previous && (edge.a === here || edge.b === here) && otherArtist(edge, here) === previous ? previous : null;
}

const usedHints = session => (session.hints || []).filter(hint => hint.level < 3).length;
const flippedInCatalogue = (session, knowledge) => [...knowledge.flipped].filter(id => roundEdge(id)?.dataset === sessionDataset(session)).length;

function isDeadEnd(session, knowledge) {
  if (session.path.length < 2 || session.status !== 'active') return false;
  const here = currentNode(session).id;
  if (here === session.target) return false;
  const hand = getNeighbors(here, 'co', sessionDataset(session));
  if (hand.some(edge => !knowledge.flipped.has(edge.id))) return false;
  const partners = new Set(hand.map(edge => otherArtist(edge, here)));
  return partners.size === 1 && partners.has(session.path[session.path.length - 2].id);
}

/** The route the recap lists: the player's own path, or the revealed answer. */
function recapRoute(session) {
  if (session.status === 'revealed') {
    const chain = shortestChain(session.start, session.target, sessionDataset(session), 'co');
    return chain ? { nodes: chain.nodes, edges: chain.edges, answer: true } : { nodes: [session.start], edges: [], answer: true };
  }
  return { nodes: session.path.map(step => step.id), edges: session.path.slice(1).map(step => roundEdge(step.edgeId)).filter(Boolean), answer: false };
}

function hintNoteHTML(session) {
  if (session.status !== 'active') return '';
  const here = session.events.length;
  const latest = [...(session.hints || [])].reverse().find(hint => hint.at === here && hint.level < 3);
  if (!latest) return '';
  const info = roundHint(session);
  const name = artistName(currentNode(session).id);
  const title = escapeHTML(songTitle(roundEdge(latest.edgeId)));
  const backTo = latest.level === 2 ? hintBackTo(session, latest.edgeId) : null;
  // The pencil stub is drawn only for a song still face down; a turned song is followed with 「前往」.
  const pencilled = latest.level === 2 && !backTo && !roundKnowledge(session).flipped.has(latest.edgeId);
  const text = latest.level === 1
    ? `从${escapeHTML(name)}出发，在本专题收录的合作里最少还隔 <b>${info.distance}</b> 首；你面前 ${info.total} 首里有 <b>${info.closer}</b> 首会让你更近。`
    : backTo ? `退一步回到${escapeHTML(artistName(backTo))}：从那里走更近，这一步也会撤销。`
      : pencilled ? `试试《${title}》：它在一条最短的路上。桌上铅笔线标出了方向。` : `试试《${title}》：它在一条最短的路上，沿它「前往」。`;
  // Short phones keep one line; the full sentence is also spoken by the toast.
  const short = latest.level === 1 ? `还隔 <b>${info.distance}</b> 首 · 面前 ${info.total} 首里 <b>${info.closer}</b> 首更近`
    : backTo ? `退一步回到${escapeHTML(artistName(backTo))}更近` : pencilled ? `试试《${title}》· 铅笔线指了方向` : `试试《${title}》· 沿它前往`;
  return `<p class="map-round-note"><span aria-hidden="true">${latest.level === 1 ? '①' : '②'}</span><span class="map-round-note__full">${text}</span><span class="map-round-note__short" aria-hidden="true">${short}</span></p>`;
}

function stampHTML(session) {
  const last = session.events[session.events.length - 1];
  if (last?.type !== 'move' || !last.tone || session.status !== 'active') return '';
  const [glyph, words] = { near: ['近', '更近了'], far: ['远', '绕远了'], even: ['平', '一样远'] }[last.tone] || [];
  return glyph ? `<span class="map-round-stamp is-${last.tone}"><b aria-hidden="true">${glyph}</b><span>${words}</span></span>` : '';
}

/* ---------- 二维桌面（WebGL 降级）：与 3D 共用布局与可见性 ---------- */

function stageHTML(session, selectedId, knowledge) {
  const dataset = sessionDataset(session);
  const round = isRound(session);
  const layout = networkLayout(dataset, round ? 'co' : session.mode);
  const fog = Boolean(knowledge?.fog);
  const known = fog ? layout.filter(item => knowledge.known.has(item.id)).length : layout.length;
  const here = currentNode(session).id;
  const target = round ? session.target : null;
  const roam = isFreeRoam(session);
  const anchored = round || roam;
  // In a roam the records next to you can be walked to with one tap (the first shared song wins).
  const reach = new Map();
  if (roam && !roamEnded(session)) getNeighbors(here, session.mode, dataset).forEach(edge => { const next = otherArtist(edge, here); if (!reach.has(next)) reach.set(next, edge); });
  const summary = fog ? `唱片桌：已认识 ${known} 张，${layout.length - known} 张还盖着` : round ? `唱片桌：${layout.length} 张已全部翻开` : `完整音乐关系网，${layout.length} 位艺人${roam ? roamEnded(session) ? `。本次探索已结束，停在${artistName(here)}` : `。你在${artistName(here)}，点相连的歌手就走过去` : ''}`;
  return `<div class="map-stage map-network-fallback" data-map-stage tabindex="0" role="group" aria-label="${escapeHTML(summary)}。可用方向键平移，加减号缩放">
    <svg class="map-graph-lines" data-map-lines aria-hidden="true"></svg>
    ${layout.map((item, index) => {
      if (fog && !knowledge.known.has(item.id)) return `<span class="map-network-node is-unknown" data-slot="${index}" aria-hidden="true"><i></i><strong>?</strong></span>`;
      // 你在这里 / 终点 rides in front of the name, in the same tag: labelNodes places the pair as one piece
      // (stepping out on a pencilled leader when the records around it leave no room), so neither covers a record.
      const tag = item.id === target ? '<small class="map-network-node__flag" aria-hidden="true">终点</small>' : anchored && item.id === here ? `<small class="map-network-node__flag" aria-hidden="true">${roamEnded(session) ? '停在这里' : '你在这里'}</small>` : '';
      const way = reach.get(item.id);
      const classes = ['map-network-node', item.id === selectedId && 'is-selected', anchored && item.id === here && 'is-current', item.id === target && 'is-target', way && 'is-reachable'].filter(Boolean).join(' ');
      const label = `${item.id === target ? '终点：' : ''}${item.name}${groupNote(item.id)}${anchored && item.id === here ? (roamEnded(session) ? '，停在这里' : '，你在这里') : ''}${way ? `，沿${way.song ? `《${songTitle(way)}》` : `「${way.reason}」`}走过去` : ''}`;
      // The record is the 44px button; its name tag is placed beside it on each redraw (see labelNodes).
      return button('select', `<i style="--node-tone:${item.color}"></i><span class="map-network-node__label">${tag}<strong>${escapeHTML(item.name)}</strong></span>`, classes, `data-id="${item.id}" data-slot="${index}" aria-label="${escapeHTML(label)}" aria-pressed="${item.id === selectedId}"`);
    }).join('')}
  </div>`;
}

function zoomToolsHTML(api) {
  return `<div class="map-network-tools" role="group" aria-label="唱片桌视野">${button('zoom-out', '−', 'icon-button', 'aria-label="缩小唱片桌"')}${button('fit', '全图', 'button button--quiet', 'aria-label="显示整张唱片桌"')}${button('zoom-in', '+', 'icon-button', 'aria-label="放大唱片桌"')}</div>`;
}

function menuHTML(api, groups) {
  return `<details class="map-shop-menu"><summary>目录 ${api.icon('chevron-right')}</summary><div class="map-shop-menu__paper" role="group" aria-label="唱片店目录">${groups.filter(Boolean).map(([title, body, extra = '']) => `<section class="map-menu-group ${extra}"><h3>${title}</h3>${body}</section>`).join('')}</div></details>`;
}

/* ---------- 寻声一局 ---------- */

function roundCardHTML(session, edge, knowledge, api, index, stub, motion) {
  const here = currentNode(session).id;
  const partner = otherArtist(edge, here);
  const title = songTitle(edge);
  const number = String(index + 1).padStart(2, '0');
  const hinted = stub?.edgeId === edge.id;
  const hintTag = hinted ? '<span class="map-round-card__hint">试试这张</span>' : '';
  const closed = session.status !== 'active';
  if (!knowledge.flipped.has(edge.id) && !closed) {
    // A sealed card carries only its place in the hand; even the edge id could spell its partner.
    return `<li class="map-round-card is-sealed${hinted ? ' is-hinted' : ''}" data-slot="${index}">
      <span class="map-round-card__no" aria-hidden="true">${number}</span>${hintTag}
      <strong class="map-round-card__title">《${escapeHTML(title)}》</strong>
      <span class="map-round-card__who" aria-hidden="true">和 <i>?</i> 合唱</span>
      ${button('flip', `翻开${hinted ? '<small class="map-round-card__flip-hint" aria-hidden="true"> · 试试这张</small>' : ''}`, 'button map-round-card__flip', `data-slot="${index}" aria-label="翻开《${escapeHTML(title)}》，看看${escapeHTML(artistName(here))}和谁合唱${hinted ? '（提示：试试这张）' : ''}"`)}
    </li>`;
  }
  const isTarget = partner === session.target;
  const visited = knowledge.visited.has(partner);
  const badge = isTarget ? '<mark class="is-target">终点</mark>' : visited ? '<mark>来过</mark>' : '';
  const turning = motion?.kind === 'flip' && motion.edgeId === edge.id ? ' is-turning' : '';
  const move = closed ? '' : button('move', `前往 ${escapeHTML(artistName(partner))} ${api.icon('arrow-right')}`, `button map-round-card__go${isTarget ? ' is-target' : ''}`, `data-id="${partner}" data-edge-id="${edge.id}" aria-label="沿《${escapeHTML(title)}》前往${escapeHTML(artistName(partner))}${isTarget ? '，抵达终点' : ''}"`);
  return `<li class="map-round-card is-open${isTarget ? ' is-target' : ''}${hinted ? ' is-hinted' : ''}${turning}" data-slot="${index}" data-edge-id="${edge.id}" style="--node-tone:${artistById[partner].color}">
    <span class="map-round-card__no" aria-hidden="true">${number}</span>${hintTag}
    <strong class="map-round-card__title">《${escapeHTML(title)}》</strong>
    <span class="map-round-card__who"><i class="map-round-card__dot" aria-hidden="true"></i>× ${escapeHTML(artistName(partner))}${badge}</span>
    <div class="map-round-card__actions">${move}${button('edge', api.icon('info'), 'icon-button map-round-card__more', `data-id="${edge.id}" aria-label="看《${escapeHTML(title)}》的版本与来源"`)}</div>
  </li>`;
}

function roundHandHTML(session, knowledge, api, motion) {
  const here = currentNode(session).id;
  const artist = artistById[here];
  const dataset = sessionDataset(session);
  const hand = getNeighbors(here, 'co', dataset);
  const opened = hand.filter(edge => knowledge.flipped.has(edge.id)).length;
  const hint = activeStub(session);
  // When hint ② leads back, the way back carries the tag instead of the card the player came in on.
  const backHint = hint && hintBackTo(session, hint.edgeId);
  const stub = backHint ? null : hint;
  const dead = isDeadEnd(session, knowledge);
  const trail = session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<i aria-hidden="true">→</i>');
  const canBack = session.path.length > 1;
  return `<section class="map-round-hand${dead ? ' is-dead-end' : ''}" aria-label="${escapeHTML(artist.name)}${groupNote(here)}的合作手牌">
    <div class="map-round-hand__who">
      <span class="map-round-hand__stamp" style="--node-tone:${artist.color}" aria-hidden="true"><i></i></span>
      <div><h2>${escapeHTML(artist.name)}</h2><span>${isGroup(here) ? '<span class="map-nowrap">乐团</span> · ' : ''}<span class="map-nowrap">本专题 ${hand.length} 首合作</span> · <span class="map-nowrap">已翻开 ${opened}</span></span></div>
    </div>
    <ol class="map-round-hand__cards" data-node="${here}" aria-label="${escapeHTML(artist.name)}的 ${hand.length} 首合作">${hand.map((edge, index) => roundCardHTML(session, edge, knowledge, api, index, stub, motion)).join('')}${dead ? `<li class="map-round-hand__dead" role="note"><strong>死胡同</strong>这是${escapeHTML(artist.name)}在本专题唯一的合唱。退一步，换条路。</li>` : ''}${!knowledge.flipped.size && session.path.length === 1 ? '<li class="map-round-hand__tip" role="note"><strong>怎么玩</strong>翻开一首，才知道 TA 和谁合唱；沿翻开的歌「前往」，才算走一步。</li>' : ''}</ol>
    <div class="map-round-route">
      ${button('back', `${api.icon('arrow-left')}<span>退一步</span>`, `button ${dead || backHint ? 'button--primary' : 'button--quiet'} map-round-route__back${backHint ? ' is-hinted' : ''}`, `aria-label="退一步：返回上一位并撤销一步${backHint ? '（提示：回去更近）' : ''}" ${canBack ? '' : 'disabled'}`)}
      ${button('reset', api.icon('rotate'), 'icon-button map-round-route__reset', `aria-label="回到起点" ${canBack ? '' : 'disabled'}`)}
      ${canBack ? `<div class="map-round-route__trail map-route-trail" aria-label="当前路线，第 ${session.path.length - 1} 步">${trail}</div>` : ''}
    </div>
  </section>`;
}

/** 出题给朋友 and 保存战绩卡 for a finished round of the real catalogue. Only the pair travels. */
function roundShareButtons(session, api, className = 'button button--quiet') {
  if (sessionDataset(session) !== 'real') return '';
  const pair = `${escapeHTML(artistName(session.start))}到${escapeHTML(artistName(session.target))}`;
  return `${button('share-round', `${api.icon('arrow-up-right')}<span>出题给朋友</span>`, `${className} map-share-round`, `data-session="${session.id}" aria-label="出题给朋友：把${pair}这道题发出去，不带答案"`)}${button('save-card', `${api.icon('image')}<span>保存战绩卡</span>`, `${className} map-save-card`, `data-session="${session.id}" aria-haspopup="dialog" aria-label="保存战绩卡：生成一张不含中间歌手的图片"`)}`;
}

function roundClosedBarHTML(session, api) {
  const steps = session.path.length - 1;
  const arrived = session.status === 'complete';
  const trail = session.path.map(step => escapeHTML(artistName(step.id))).join('<i aria-hidden="true">→</i>');
  const share = roundShareButtons(session, api);
  return `<section class="map-round-hand map-round-hand--closed${share ? ' has-share' : ''}" aria-label="本局结果">
    <div class="map-round-hand__who"><span class="map-round-seal${arrived ? '' : ' is-revealed'}" aria-hidden="true">${arrived ? '抵达' : '揭晓'}</span><div><h2>${arrived ? `已抵达 · ${steps} 步` : '已揭晓'}</h2><span class="map-round-hand__trail">${trail}</span></div></div>
    <div class="map-round-hand__done">${button('round-next', `再来一局 ${api.icon('arrow-right')}`, 'button button--primary')}${button('recap', '连线歌单', 'button button--quiet', `data-session="${session.id}"`)}${button('return-roam', '完整图鉴', 'button button--quiet', `data-session="${session.id}"`)}</div>
    ${share ? `<div class="map-round-hand__share" role="group" aria-label="把这道题带给朋友">${share}</div>` : ''}
  </section>`;
}

/** 朋友出的题: a slip over a round opened from a friend's link. It gives the pair and the rule, never
 *  an answer, and never anything of the friend's own walk. The player can fold it away. */
function friendNoteHTML(session, api) {
  if (!session.friend || session.friend.dismissed || session.status !== 'active') return '';
  return `<aside class="map-friend-note" aria-labelledby="map-friend-note-title">
    <p class="map-friend-note__title" id="map-friend-note-title"><b>朋友出的题</b><span class="map-friend-note__pair">：${escapeHTML(artistName(session.start))} → ${escapeHTML(artistName(session.target))}，隔着几首歌？</span></p>
    <p class="map-friend-note__rule">${ROUND_RULE}</p>
    ${button('friend-dismiss', api.icon('x'), 'icon-button map-friend-note__close', 'aria-label="收起朋友的题签"')}
  </aside>`;
}

function roundHTML(map, api, session, presentation) {
  const knowledge = roundKnowledge(session);
  const dataset = sessionDataset(session);
  const catalogue = catalogues[dataset];
  const isReal = dataset === 'real';
  const here = currentNode(session).id;
  const layout = networkLayout(dataset, 'co');
  const links = networkEdges(dataset, 'co');
  const steps = session.path.length - 1;
  const closed = isClosed(session);
  const ceremony = map.view.ceremony?.sessionId === session.id ? map.view.ceremony : null;
  const selectedId = knowledge.known.has(map.view.selectedArtistId) ? map.view.selectedArtistId : here;
  const distance = (session.hints || []).some(hint => hint.level === 1) || closed ? distancesFrom(session.target, dataset) : null;
  const best = chainLength(session.start, session.target, dataset);
  const motion = handMotion;
  const known = [...knowledge.known].filter(id => datasetForArtist(id) === dataset).length;
  const eyebrow = `寻声 · ${session.friend ? '朋友出的题' : isReal ? catalogue.label : '情景示例 · 虚构'}${session.status === 'complete' ? ' · 已抵达' : session.status === 'revealed' ? ' · 已揭晓' : ''}`;
  const status = closed
    ? session.status === 'complete'
      ? `<span>${steps} 步抵达</span><span>本专题最短 ${best} 首</span>`
      : `<span>你停在${escapeHTML(artistName(here))}（${steps} 步）</span><span>本专题最短 ${best} 首</span>`
    : `<span>第 ${steps} 步</span><span>认识 ${known}/${layout.length}</span><span>翻开 ${flippedInCatalogue(session, knowledge)}/${links.length}</span>${distance ? `<b class="map-round-remaining">还隔 ${distance.get(here)} 首</b>` : ''}`;
  const level = hintLevel(session);
  const hintButton = !closed ? button('hint', `${level === 3 ? '' : '<i aria-hidden="true">?</i>'}${hintLabels[level]}`, `button map-round-hint${level === 3 ? ' is-final' : ''}`, `aria-label="${level === 1 ? '提示第一级：还隔几首' : level === 2 ? '提示第二级：往哪翻' : '提示第三级：揭晓答案'}"`) : '';
  const menu = menuHTML(api, [
    ['寻声', `${button('challenge', '自选起点和终点', 'button button--quiet')}${isReal ? button('share-round', '把这道题发给朋友<small>不带答案</small>', 'button button--quiet', `data-session="${session.id}" aria-label="把这道题发给朋友（只带起点和终点，不带答案）"`) : ''}${!closed ? button('reveal', '放弃并揭晓', 'button button--quiet') : ''}${closed ? button('recap', '连线歌单', 'button button--quiet', `data-session="${session.id}"`) : ''}`],
    ['图谱', button('return-roam', '完整图鉴<small>会显示全部合作</small>', 'button button--quiet map-menu-atlas', `data-session="${session.id}"`)],
    ['资料', `<button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('history', '我的发现', 'button button--quiet')}`],
    ['视野', zoomToolsHTML(api), 'map-menu-zoom'],
  ]);
  const question = `<span class="is-from">${escapeHTML(artistName(session.start))}</span><i aria-hidden="true">→</i><span class="is-to">${escapeHTML(artistName(session.target))}</span><span class="map-round-slip__ask">，隔着几首歌？</span>`;
  return `<section class="map-experience map-studio map-round map-experience--${presentation}${closed ? ' is-closed' : ''}${ceremony ? ' is-ceremony' : ''}" aria-label="寻声：${escapeHTML(artistName(session.start))}到${escapeHTML(artistName(session.target))}">
    <header class="map-studio-head map-round-head${session.friend && !session.friend.dismissed && session.status === 'active' ? ' has-friend-note' : ''}">
      ${friendNoteHTML(session, api)}
      <div class="map-round-slip">
        <span class="map-round-slip__eyebrow">${eyebrow}</span>
        <h1 class="map-round-slip__question" aria-label="${escapeHTML(artistName(session.start))}到${escapeHTML(artistName(session.target))}，隔着几首歌？">${question}</h1>
        <p class="map-round-slip__status">${status}${stampHTML(session)}</p>
        ${ceremony ? button('ceremony-done', `跳过 ${api.icon('arrow-right')}`, 'button button--quiet map-round-skip', `aria-label="跳过${ceremony.kind === 'reveal' ? '揭晓' : '抵达'}动画，直接看连线歌单"`) : ''}
      </div>
      <div class="map-studio-tools map-round-tools" role="group" aria-label="寻声工具">${hintButton}${!closed ? button('round-next', `${api.icon('swap')}<span>换一组</span>`, 'button button--quiet map-round-next') : ''}${menu}</div>
      ${hintNoteHTML(session)}
    </header>
    <div class="map-workspace">
      <div class="map-stage-column">
        <div class="map-stage-top">${zoomToolsHTML(api)}</div>
        ${stageHTML(session, selectedId, knowledge)}
      </div>
    </div>
    ${closed ? roundClosedBarHTML(session, api) : roundHandHTML(session, knowledge, api, motion)}
    ${undoHTML(map, api, 'explore', session.id)}
    ${panelHTML(map, api)}
  </section>`;
}

/* ---------- 完整图鉴（漫游与旧挑战） ---------- */

/** 本次探索: the roam's own bar on the dock — what was kept, the two ways back, and the end. */
function roamBarHTML(session, api) {
  const count = currentSavedSongs(session).length;
  const canBack = session.path.length > 1;
  const previous = canBack ? artistName(session.path[session.path.length - 2].id) : '';
  const trail = session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">→</span>');
  // Ended: nothing walks until 继续本次探索, which takes the place of 结束探索 (data-map-slot keeps focus there).
  if (roamEnded(session)) return `<div class="map-roam-bar is-ended" role="group" aria-label="本次探索 · 已结束">
    <span class="map-roam-bar__state">已结束</span>
    <div class="map-route-trail map-roam-bar__trail" aria-label="停下时的路线">${trail}</div>
    ${button('recap', `${api.icon('bookmark')}<span>回顾 · <b data-map-saved-count="${session.id}">${count}</b> 首</span>`, 'button map-roam-bar__found', `data-session="${session.id}" aria-haspopup="dialog" aria-label="探索回顾，留下 ${count} 首"`)}
    ${button('resume', `<span>继续<i class="map-roam-bar__this">本次</i>探索</span>${api.icon('arrow-right')}`, 'button map-roam-bar__resume', `data-session="${session.id}" data-map-slot="end"`)}
  </div>`;
  return `<div class="map-roam-bar" role="group" aria-label="本次探索">
    ${button('back', `${api.icon('arrow-left')}<span><i class="map-roam-bar__long">返回</i>上一位</span>`, 'button map-roam-bar__step', `aria-label="返回上一位${canBack ? `：${escapeHTML(previous)}` : ''}" ${canBack ? '' : 'disabled'}`)}
    ${button('reset', `${api.icon('rotate')}<span><i class="map-roam-bar__long">回到</i>起点</span>`, 'button map-roam-bar__step', `aria-label="回到起点：${escapeHTML(artistName(session.start))}" ${canBack ? '' : 'disabled'}`)}
    <div class="map-route-trail map-roam-bar__trail" aria-label="当前路线">${trail}</div>
    ${button('recap', `${api.icon('bookmark')}<span><i class="map-roam-bar__this">本次</i>发现 · <b data-map-saved-count="${session.id}">${count}</b> 首</span>`, 'button map-roam-bar__found', `data-session="${session.id}" aria-haspopup="dialog"`)}
    ${button('finish', '结束探索', 'button map-roam-bar__end', 'data-map-slot="end" aria-haspopup="dialog"')}
  </div>`;
}

function atlasHTML(map, api, session, presentation) {
  const node = currentNode(session);
  const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const isReal = dataset === 'real';
  const relationUnit = session.mode === 'co' ? '次合作' : '条标签连接';
  const isChallenge = session.type === 'challenge';
  const roam = isFreeRoam(session);
  const isComplete = isClosed(session);
  const selectedId = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : node.id;
  const selectedArtist = artistById[selectedId];
  const selectedLinks = getNeighbors(selectedId, session.mode, dataset);
  const neighborOfCurrent = getNeighbors(node.id, 'co', dataset).some(edge => otherArtist(edge, node.id) === selectedId);
  // Only a round the player actually opened is one to go back to; one dealt on arrival is simply opened.
  const pendingRound = [...map.sessions].reverse().find(item => isRound(item) && sessionDataset(item) === 'real' && item.status === 'active' && !untouchedRound(item));
  const title = isChallenge ? '合作挑战' : '完整图鉴';
  const trail = session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">→</span>');
  // A roam's slip speaks only of this roam. Where the dock has no room for the route (tablet, phone),
  // the slip's second line carries it once the player has walked.
  const sub = isChallenge
    ? `${escapeHTML(artistName(session.start))} → ${escapeHTML(artistName(session.target))} · ${isComplete ? '已抵达' : '进行中'} · ${session.path.length - 1} 步`
    : session.mode === 'style' ? '策展标签 · 人工整理，不代表合作'
      : `<span class="map-studio-sub__base">从${escapeHTML(artistName(session.start))}出发 · 途经 ${visitedArtists(session).length} 位${session.status === 'ended' ? ' · 已结束' : ''}</span>${roam && session.path.length > 1 ? `<span class="map-route-trail map-studio-sub__route" aria-label="${session.status === 'ended' ? '停下时的路线' : '当前路线'}">${trail}${session.status === 'ended' ? '<small>已结束</small>' : ''}</span>` : ''}`;
  const primary = isChallenge
    ? button('return-roam', '返回图鉴', 'button button--quiet', `data-session="${session.id}"`)
    : pendingRound ? button('resume', `回到寻声 ${api.icon('arrow-right')}`, 'button button--primary map-atlas-play', `data-session="${pendingRound.id}"`) : button('round-next', `开一局寻声 ${api.icon('arrow-right')}`, 'button button--primary map-atlas-play', 'data-reuse="true"');
  // Fictional sessions from 0.15 still open with their curated tags; the real catalogue has only duets.
  const modeSwitch = catalogue.hasStyle ? `<div class="map-mode-switch" role="group" aria-label="关系类型">${button('mode', '合作', session.mode === 'co' ? 'is-active' : '', `data-mode="co" aria-pressed="${session.mode === 'co'}"`)}${button('mode', '策展标签', session.mode === 'style' ? 'is-active' : '', `data-mode="style" aria-pressed="${session.mode === 'style'}" ${isChallenge ? 'disabled' : ''}`)}</div>` : '';
  const menu = menuHTML(api, [
    modeSwitch && ['图谱', modeSwitch],
    ['寻声', `${button('round-next', '开一局寻声', 'button button--quiet', 'data-reuse="true"')}${button('challenge', '自选起点和终点', 'button button--quiet')}`],
    ['资料', `<button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('relations', '连接与来源', 'button button--quiet')}${button('history', '我的发现', 'button button--quiet')}${isChallenge ? button('recap', isComplete ? '挑战结果' : '回顾路线', 'button button--quiet', `data-session="${session.id}"`) : ''}`],
    ['视野', zoomToolsHTML(api), 'map-menu-zoom'],
  ]);
  const roundTo = isReal && !isChallenge && session.mode === 'co' && selectedId !== node.id && !neighborOfCurrent && isReachable(node.id, selectedId, dataset);
  const open = map.view.inspectorOpen ?? false;
  // Older challenges without fog keep their route bar inside the connection list.
  const challengeRoute = isChallenge ? `<div class="map-route-bar"><div class="map-route-controls">${button('back', api.icon('arrow-left'), 'icon-button', `aria-label="返回上一位并撤销一步" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}${button('reset', api.icon('rotate'), 'icon-button', `aria-label="回到起点" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}</div><div class="map-route-trail" aria-label="当前路线">${trail}</div>${button('recap', `<b data-map-saved-count="${session.id}">${currentSavedSongs(session).length}</b> 首收藏`, 'button button--quiet', `data-session="${session.id}"`)}</div>` : '';
  return `<section class="map-experience map-studio map-atlas${roam ? ' map-atlas--roam' : ''} map-experience--${presentation}" aria-label="${title}">
    <header class="map-studio-head">
      <div class="map-studio-title"><h1>${title}${!isReal ? '<span class="map-title-tag">情景示例 · 虚构</span>' : ''}</h1><p class="map-studio-sub">${sub}</p></div>
      <div class="map-studio-tools">${primary}${button('search', `${api.icon('compass')}<span>找音乐人</span>`, 'button button--quiet')}${menu}</div>
    </header>
    <div class="map-workspace">
      <div class="map-stage-column">
        <div class="map-stage-top">${zoomToolsHTML(api)}</div>
        ${stageHTML(session, selectedId, null)}
      </div>
    </div>
    <div class="map-studio-dock">
      ${roam ? roamBarHTML(session, api) : ''}
      <div class="map-network-selection"><span class="map-network-stamp" style="--node-tone:${selectedArtist.color}" aria-hidden="true"><i></i></span><div><h2>${escapeHTML(selectedArtist.name)}</h2><span>${isGroup(selectedId) ? '乐团 <i>·</i> ' : ''}${selectedLinks.length} ${relationUnit} <i>·</i> ${selectedArtist.songIds.length} 首作品${selectedId === node.id ? ` <i>·</i> ${roamEnded(session) ? '停在这里' : '你在这里'}` : ''}</span></div><div class="map-network-selection__actions">${button('artist', `作品 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-id="${selectedId}" aria-label="${escapeHTML(selectedArtist.name)}${groupNote(selectedId)}的作品"`)}${roundTo ? button('round-to', '和 TA 隔几首？', 'button button--quiet map-round-to', `data-id="${selectedId}" aria-label="开一局寻声：从${escapeHTML(artistName(node.id))}到${escapeHTML(selectedArtist.name)}${groupNote(selectedId)}，隔着几首歌？"`) : ''}</div></div>
      <details class="map-network-index" data-map-index ${open ? 'open' : ''}><summary><span>${selectedLinks.length} 条连接</span>${isChallenge ? `<small>已走 ${session.path.length - 1} 步</small>` : ''}${api.icon('chevron-right')}</summary><div class="map-network-index__body">
      <div class="map-network-neighbors" aria-label="${escapeHTML(selectedArtist.name)}的连接">${selectedLinks.map(edge => button('edge', `<span>${escapeHTML(artistName(otherArtist(edge, selectedId)))}</span><small>${escapeHTML(songTitle(edge))}</small>`, 'map-network-connection', `data-id="${edge.id}"`)).join('') || '<span class="map-inline-empty">暂未收录连接</span>'}</div>
      ${challengeRoute}
      </div></details>
    </div>
    ${undoHTML(map, api, 'explore', session.id)}
    ${panelHTML(map, api)}
  </section>`;
}

function mapHTML(map, api, presentation = 'quiet') {
  const session = activeSession(map);
  if (!session) return `<section class="map-empty empty-state"><h2>桌上还没有唱片</h2><p>开一局寻声：只给起点和终点，一张张翻开它们之间的合唱。</p>${button('round-next', `开一局 ${api.icon('arrow-right')}`, 'button button--primary')}</section>`;
  return isRound(session) ? roundHTML(map, api, session, presentation) : atlasHTML(map, api, session, presentation);
}

function searchResultsHTML(query, dataset) {
  const matches = artistsInDataset(dataset).filter(artist => `${artist.name} ${artist.tag} ${(artist.aliases || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return matches.length ? matches.map(artist => `<button type="button" class="map-search-result" data-map-action="select" data-id="${artist.id}"><span class="map-search-result__tone" style="--node-tone:${artist.color}" aria-hidden="true"></span><span><strong>${escapeHTML(artist.name)}</strong><small>${escapeHTML(artist.tag)}</small></span><span aria-hidden="true">↗</span></button>`).join('') : `<p class="empty-state">本${dataset === 'real' ? '专题暂未收录。可以试试「周杰伦」或「林俊杰」' : '示例暂未收录。可以试试「林间」或「乔屿」'}。</p>`;
}

function visitedArtists(session) {
  if (session.type === 'challenge') return [...new Set(session.path.map(step => step.id))];
  return [...new Set([session.start, ...session.events.filter(event => event.type === 'move').map(event => event.to)])];
}

function timelineHTML(session, api, isChallenge) {
  const events = session.events.filter(event => ['move', 'back', 'reset'].includes(event.type));
  return `<details class="map-route-details"><summary>分支记录 <span>${events.filter(event => event.type === 'move').length} 次前往</span></summary><div class="map-timeline">${events.map(event => {
    if (event.type !== 'move') return `<div class="map-timeline__return">${event.type === 'reset' ? '回到起点' : '退回'} ${escapeHTML(artistName(event.to))}${isChallenge ? ' · 撤销对应步数' : ''}</div>`;
    const edge = edges.find(item => item.id === event.edgeId);
    return `<div class="map-timeline__stop"><h4>${escapeHTML(artistName(event.from))} <span>→</span> ${escapeHTML(artistName(event.to))}${event.tone ? ` <em class="map-timeline__tone is-${event.tone}">${({ near: '近', far: '远', even: '平' })[event.tone]}</em>` : ''}</h4><p>${edge ? `${modeName(edge.mode)} · ${escapeHTML(songTitle(edge))}` : '已记录的连接'}</p>${edge && !isRound(session) ? evidenceHTML(edge, api) : ''}${edge?.song && !isRound(session) ? tracksHTML(session, [edge.song], api, `通过${artistName(event.from)}与${artistName(event.to)}的合作作品留下`, true) : ''}</div>`;
  }).join('') || '<p class="map-inline-empty">还没有连接记录。</p>'}</div></details>`;
}

/** 我走过的路: the real moves in order. A return opens a new leg under a note, so two records
 *  that were never walked between are never joined, not even by the rail. */
function roamRouteHTML(session, api) {
  const items = [];
  for (const event of session.events) {
    if (event.type === 'move') items.push({ kind: 'hop', event });
    else if (event.type === 'back' || event.type === 'reset') {
      const turn = { kind: 'turn', to: event.to, reset: event.type === 'reset' };
      // Several returns in a row read as one: where the player finally turned.
      if (items[items.length - 1]?.kind === 'turn') items[items.length - 1] = turn; else if (items.length) items.push(turn);
    }
  }
  if (!items.some(item => item.kind === 'hop')) return '<p class="map-inline-empty">还没有走到下一位。</p>';
  const legs = [];
  for (const item of items) {
    if (item.kind === 'turn') legs.push(item);
    else if (legs[legs.length - 1]?.kind === 'leg') legs[legs.length - 1].hops.push(item.event);
    else legs.push({ kind: 'leg', hops: [item.event] });
  }
  return `<div class="map-walk">${legs.map(leg => {
    if (leg.kind === 'turn') return `<p class="map-walk__turn"><span aria-hidden="true">↩</span>${leg.reset ? '返回起点，重新探索' : `返回${escapeHTML(artistName(leg.to))}，换个方向`}</p>`;
    return `<ol class="map-walk__leg">${leg.hops.map(event => {
      const edge = edges.find(item => item.id === event.edgeId);
      const basis = edge ? `${modeName(edge.mode)} · ${edge.song ? `《${escapeHTML(songTitle(edge))}》` : escapeHTML(edge.reason)}` : '已记录的连接';
      return `<li class="map-walk__hop" style="--node-tone:${toneOf(event.to)}"><h4>${escapeHTML(artistName(event.from))} <span aria-hidden="true">→</span><span class="sr-only">走到</span> ${escapeHTML(artistName(event.to))}</h4><p>${basis}</p>${edge ? evidenceHTML(edge, api) : ''}${edge?.song ? tracksHTML(session, [edge.song], api, duetSource(event.from, event.to, edge), true) : ''}</li>`;
    }).join('')}</ol>`;
  }).join('')}</div>`;
}

/** 本次发现 while walking, 探索回顾 once ended. PRD order: overview, kept songs, route, singers, next. */
function roamRecapHTML(map, session, api, page) {
  const visited = visitedArtists(session);
  const kept = currentSavedSongs(session);
  const ended = session.status === 'ended';
  const isReal = sessionDataset(session) === 'real';
  const here = currentNode(session).id;
  const legs = session.events.filter(event => event.type === 'move').length;
  const sourceOf = new Map(kept.map(item => [item.id, item.source || '在本次探索中留下']));
  const undo = undoHTML(map, api, page, session.id);
  const people = visited.map(id => {
    const role = id === session.start ? '起点' : id === here ? (ended ? '停在这里' : '你在这里') : '';
    const again = artistById[id]?.dataset === 'real' ? button('new', `从 TA 再出发 ${api.icon('arrow-right')}`, 'button button--quiet map-recap-people__go', `data-id="${id}" aria-label="从${escapeHTML(artistName(id))}再出发，开始新的探索"`) : '';
    return `<li style="--node-tone:${toneOf(id)}"><span class="map-recap-people__sleeve" aria-hidden="true"><i></i></span><span class="map-recap-people__name">${escapeHTML(artistName(id))}${role ? `<small>${role}</small>` : ''}</span>${again}</li>`;
  }).join('');
  return `<div class="map-recap-intro"><span class="eyebrow">${isReal ? '' : '情景示例 · 虚构 · '}${ended ? '探索回顾 · 已结束' : '本次发现 · 进行中'}</span><h2>${ended ? '这一路，留下的喜欢' : '本次发现'}</h2></div>
    <dl class="map-recap-overview">
      <div><dt>日期</dt><dd>${dateLabel(session.created)}</dd></div>
      <div><dt>起点</dt><dd>${escapeHTML(artistName(session.start))}</dd></div>
      <div><dt>途经艺人</dt><dd><b>${visited.length}</b> 位</dd></div>
      <div><dt>留下</dt><dd><b>${kept.length}</b> 首</dd></div>
    </dl>
    <section class="map-recap-section map-recap-kept"><h3>留下的歌</h3>${kept.length ? tracksHTML(session, kept.map(item => item.id), api, id => sourceOf.get(id) || '', false, false, false, id => sourceOf.get(id)) : '<p class="map-inline-empty">这次还没有留下歌曲。</p>'}</section>
    <details class="map-route-details map-recap-fold"><summary>我走过的路 <span>${legs ? `${legs} 段` : '还在起点'}</span></summary>${roamRouteHTML(session, api)}</details>
    <details class="map-route-details map-recap-fold"><summary>途经艺人 <span>${visited.length} 位</span></summary><ol class="map-recap-people">${people}</ol></details>
    ${isReal && (legs || kept.length) ? `<div class="map-recap-card"><p>把起点、遇见的歌手和留下的歌存成一张图片。图片只在这台设备上生成，发不发由你决定。</p>${button('save-discovery', `${api.icon('image')}<span>保存发现卡片</span>`, 'button button--quiet map-recap-card__save', `data-session="${session.id}" aria-haspopup="dialog"`)}</div>` : ''}
    <div class="map-panel-actions map-recap-next">${undo}${button('resume', `继续本次探索 ${api.icon('arrow-right')}`, 'button button--primary', `data-session="${session.id}"`)}${button('go-home', '开始新探索', 'button button--quiet', 'data-intent="new"')}${button('go-home', '回到小院', 'button button--quiet')}</div>
    <p class="map-storage-note">仅保存在当前浏览器，清除浏览器数据会丢失。${ended ? '继续后再次结束，会更新这一条记录。' : ''}</p>`;
}

function recapHTML(session, api) {
  const visited = visitedArtists(session);
  const saved = currentSavedSongs(session);
  const currentRoute = session.path.map(step => artistName(step.id)).join(' → ');
  const isChallenge = session.type === 'challenge';
  const done = isClosed(session);
  return `<div class="map-recap-intro"><span class="eyebrow">${catalogueFor(session).label} · ${dateLabel(session.created)}</span><h2>${isChallenge && done ? `${session.path.length - 1} 步抵达${escapeHTML(artistName(session.target))}` : isChallenge ? '挑战回顾' : '探索回顾'}</h2></div>
    <div class="map-recap-stats"><span><b>${visited.length}</b> 位艺人</span><span><b>${saved.length}</b> 首留下</span><span><b>${session.path.length - 1}</b> 步</span></div>
    <section class="map-recap-section"><h3>留下的作品</h3>${saved.length ? tracksHTML(session, saved.map(item => item.id), api) : '<p class="map-inline-empty">还没有留下作品。</p>'}</section>
    <section class="map-recap-section"><h3>${isChallenge && done ? '抵达路线' : '当前路线'}</h3><p class="map-current-route">${escapeHTML(currentRoute)}</p></section>
    ${timelineHTML(session, api, isChallenge)}
    <div class="map-panel-actions">${!done ? button('resume', isChallenge ? '继续挑战' : '继续探索', 'button button--primary', `data-session="${session.id}"`) : button('round-next', '开一局寻声', 'button button--primary')}${isChallenge ? button('return-roam', '返回图鉴', 'button button--quiet', `data-session="${session.id}"`) : button('search', '找音乐人', 'button button--quiet')}</div>
    <p class="map-storage-note">仅保存在当前浏览器，清除浏览器数据会丢失。</p>`;
}

/** 进行中的寻声：只回顾已翻开的内容，不泄露终点方向。 */
function roundProgressHTML(session, api) {
  const knowledge = roundKnowledge(session);
  const flipped = [...knowledge.flipped].map(roundEdge).filter(Boolean);
  return `<div class="map-recap-intro"><span class="eyebrow">寻声 · 进行中 · ${dateLabel(session.created)}</span><h2>${escapeHTML(artistName(session.start))} → ${escapeHTML(artistName(session.target))}，隔着几首歌？</h2></div>
    <div class="map-recap-stats"><span><b>${session.path.length - 1}</b> 步</span><span><b>${flipped.length}</b> 首已翻开</span><span><b>${usedHints(session)}</b> 次提示</span></div>
    <section class="map-recap-section"><h3>当前路线</h3><p class="map-current-route">${session.path.map(step => escapeHTML(artistName(step.id))).join(' → ')}</p></section>
    <section class="map-recap-section"><h3>已翻开的合作</h3>${flipped.length ? `<ul class="map-round-flipped">${flipped.map(edge => `<li><strong>《${escapeHTML(songTitle(edge))}》</strong><span>${escapeHTML(artistName(edge.a))} × ${escapeHTML(artistName(edge.b))}</span></li>`).join('')}</ul>` : '<p class="map-inline-empty">还没有翻开的合作。</p>'}</section>
    <div class="map-panel-actions">${button('resume', `继续这一局 ${api.icon('arrow-right')}`, 'button button--primary', `data-session="${session.id}"`)}</div>
    <p class="map-storage-note">翻开的唱片、提示与路线仅保存在当前浏览器。</p>`;
}

/** 连线歌单：抵达或揭晓后的回顾，用唱片店的票条纸张列出路线上的每首合唱。 */
function setlistHTML(map, session, api, page) {
  const dataset = sessionDataset(session);
  const isReal = dataset === 'real';
  const knowledge = roundKnowledge(session);
  const route = recapRoute(session);
  const best = chainLength(session.start, session.target, dataset) ?? route.edges.length;
  const steps = session.path.length - 1;
  const from = escapeHTML(artistName(session.start)); const to = escapeHTML(artistName(session.target));
  const arrived = session.status === 'complete';
  const verdict = arrived
    ? steps === best ? `你的路线 ${steps} 首 · 一步不绕` : `你的路线 ${steps} 首 · 多绕了 ${steps - best} 首`
    : `你停在${escapeHTML(artistName(currentNode(session).id))}（${steps} 步）`;
  const layoutSize = networkLayout(dataset, 'co').length;
  const known = roundKnowledge({ ...session, status: 'active' }).known.size;
  const songIds = route.edges.map(edge => edge.song).filter(Boolean);
  const unsaved = songIds.filter(id => !songIsSaved(session, id)).length;
  const stops = route.nodes.map((id, index) => {
    const artist = artistById[id];
    const role = index === 0 ? '起点' : index === route.nodes.length - 1 ? '终点' : `第 ${index} 站`;
    const stop = `<li class="map-setlist__stop${index === route.nodes.length - 1 ? ' is-target' : ''}" style="--node-tone:${artist.color};--i:${index * 2}"><span class="map-setlist__sleeve" aria-hidden="true"><i></i></span><strong>${escapeHTML(artist.name)}</strong><small>${role}</small></li>`;
    const edge = route.edges[index];
    if (!edge) return stop;
    const song = songs[edge.song];
    const saved = songIsSaved(session, song.id);
    const title = song.credits?.length ? button('credits', `《${escapeHTML(song.title)}》`, 'map-setlist__title', `data-id="${song.id}" data-session="${session.id}" aria-label="查看《${escapeHTML(song.title)}》的作品署名"`) : `<strong class="map-setlist__title">《${escapeHTML(song.title)}》</strong>`;
    const meta = song.dataset === 'real' ? `<span class="map-setlist__version">${escapeHTML(song.recordingLabel || song.versionLabel || '')}</span>${evidenceHTML(edge, api)}` : '<span class="map-setlist__version">示例合作 · 虚构，无音源</span>';
    const actions = `${button('save', `${api.icon(saved ? 'check' : 'plus')}<span>${saved ? '已留下' : '留下'}</span>`, `button button--quiet map-setlist__save${saved ? ' is-saved' : ''}`, `data-id="${song.id}" data-session="${session.id}" data-source="从连线歌单留下" aria-pressed="${saved}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》"`)}`;
    return `${stop}<li class="map-setlist__song" style="--i:${index * 2 + 1}"><div class="map-setlist__ticket"><span class="map-setlist__no" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div class="map-setlist__copy">${title}${meta}</div><div class="map-setlist__actions">${actions}</div></div></li>`;
  }).join('');
  const alternatives = arrived ? shortestChains(session.start, session.target, dataset, 3).filter(chain => chain.edges.map(edge => edge.id).join() !== route.edges.map(edge => edge.id).join()) : shortestChains(session.start, session.target, dataset, 3).slice(1);
  const altHTML = alternatives.length ? `<details class="map-setlist__alt"><summary>${arrived && steps === best ? '另一条同样短的路线' : arrived ? '本专题最短的路线' : '另一条同样短的路线'} <span>${alternatives.length}</span></summary><ol>${alternatives.map(chain => `<li>${chain.nodes.map((id, index) => `${index ? `<em>《${escapeHTML(songTitle(chain.edges[index - 1]))}》</em>` : ''}<span>${escapeHTML(artistName(id))}</span>`).join('')}</li>`).join('')}</ol></details>` : '';
  const ownRoute = !arrived && steps > 1 ? `<p class="map-setlist__own">你的路线：${session.path.map(step => escapeHTML(artistName(step.id))).join(' → ')}</p>` : '';
  return `<header class="map-setlist-head">
      <span class="eyebrow">${arrived ? '连线歌单' : '揭晓'} · ${isReal ? catalogues[dataset].label : '情景示例 · 虚构'}</span>
      <h2>${arrived ? '' : '<small>揭晓：</small>'}${from}<span class="map-setlist-head__and">与</span>${to}，<br>${arrived ? '隔着' : '最少隔着'} <b>${best}</b> 首歌</h2>
      <p class="map-setlist-head__verdict">${verdict}</p>
    </header>
    ${isReal ? `<section class="map-setlist__share" aria-labelledby="map-setlist-share-title">
      <h3 id="map-setlist-share-title">这道题，也给朋友走一走</h3>
      <p>只带起点、终点和规则；答案、你的路线、收藏和历史都不会带上。</p>
      <div class="map-setlist__share-actions">${roundShareButtons(session, api)}${button('challenge', '换个起点再出一题', 'button button--quiet map-setlist__another', `data-intent="share" data-session="${session.id}"`)}</div>
    </section>` : ''}
    ${ownRoute}
    <ol class="map-setlist${route.answer ? ' is-answer' : ''}" aria-label="${arrived ? '你的路线' : '本专题的一条最短路线'}">${stops}</ol>
    <dl class="map-setlist__stats">
      <div><dt>有效步数</dt><dd>${steps}</dd></div><div><dt>本专题最短</dt><dd>${best}</dd></div><div><dt>翻开</dt><dd>${flippedInCatalogue(session, knowledge)} 首</dd></div>
      <div><dt>认识</dt><dd>${known}/${layoutSize}</dd></div><div><dt>提示</dt><dd>${usedHints(session)} 次</dd></div><div><dt>实际前往</dt><dd>${session.events.filter(event => event.type === 'move').length} 次</dd></div>
    </dl>
    ${altHTML}
    ${timelineHTML(session, api, true)}
    <div class="map-panel-actions map-setlist__actions-bar">${undoHTML(map, api, page, session.id)}${button('round-next', `再来一局 ${api.icon('arrow-right')}`, 'button button--primary')}${songIds.length ? button('save-route', unsaved ? `留下这 ${songIds.length} 首` : `已留下这 ${songIds.length} 首`, 'button button--quiet map-setlist__save-route', `data-session="${session.id}" ${unsaved ? '' : 'aria-disabled="true"'}`) : ''}${button('return-roam', '看完整图鉴', 'button button--quiet', `data-session="${session.id}"`)}</div>
    <p class="map-setlist__note">${isReal ? '路线只来自本专题已核实的共同演唱录音；“最短”仅指本专题收录范围。无内置音频。' : '路线只来自虚构的示例合作，不代表真实演唱；“最短”仅指本示例图谱。情景示例为虚构，仅作交互演示。'}</p>`;
}

function recordRowHTML(session, api, compact = false, index = 0) {
  const round = isRound(session);
  const roam = isFreeRoam(session);
  const knowledge = round ? roundKnowledge(session) : null;
  const type = round ? (session.friend ? '寻声 · 朋友出的题' : '寻声') : session.type === 'challenge' ? '挑战' : '漫游';
  const status = session.status === 'complete' ? '已抵达' : session.status === 'revealed' ? '已揭晓' : session.status === 'ended' ? '已结束' : '进行中';
  const kept = currentSavedSongs(session).length;
  const detail = round ? `翻开&nbsp;${flippedInCatalogue(session, knowledge)}&nbsp;首 · 提示&nbsp;${usedHints(session)}&nbsp;次 · ${session.path.length - 1}&nbsp;步`
    : roam ? `途经&nbsp;${visitedArtists(session).length}&nbsp;位 · 留下&nbsp;${kept}&nbsp;首`
      : `${visitedArtists(session).length}&nbsp;位艺人 · ${kept}&nbsp;首留下 · ${session.path.length - 1}&nbsp;步`;
  // The record's centre label is its place in the list (01, 02 …), like a track number: steps and keeps
  // are spelled out in the row, so a bare number there could only be misread.
  const disc = index + 1;
  return `<article class="map-record${compact ? ' map-record--compact' : ''}">
    <div class="map-record__disc" style="--node-tone:${toneOf(session.start)}" aria-hidden="true"><span>${String(disc).padStart(2, '0')}</span></div>
    <div class="map-record__copy"><span class="map-record__meta">${catalogueFor(session).label} · ${type} · ${status} · ${dateLabel(session.created)}</span><h3>${roam ? `起点 ${escapeHTML(artistName(session.start))}` : `${escapeHTML(artistName(session.start))}${session.target ? ` → ${escapeHTML(artistName(session.target))}` : '出发'}`}</h3><p>${detail}</p></div>
    <div class="map-record__actions">${button('recap', `回顾 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-session="${session.id}"`)}${!isClosed(session) ? button('resume', '继续', 'button button--quiet', `data-session="${session.id}"`) : ''}${button('delete', api.icon('trash'), 'icon-button', `data-session="${session.id}" aria-label="删除从${escapeHTML(artistName(session.start))}出发的记录"`)}</div>
  </article>`;
}

function panelHTML(map, api, recordsOnly = false) {
  const panel = map.view.panel;
  if (!panel || (recordsOnly && !['recap', 'delete', 'credits', 'share'].includes(panel))) return '';
  const roamRecap = panel === 'recap';
  const page = recordsOnly ? 'records' : 'explore';
  const session = sessionById(map, map.view.reviewId) || activeSession(map);
  if (!session) return '';
  const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const availableArtists = artistsInDataset(dataset);
  const isReal = dataset === 'real';
  const round = isRound(session);
  const knowledge = round ? roundKnowledge(session) : null;
  const fog = Boolean(knowledge?.fog);
  let content = '';
  let dialogClass = '';
  if (panel === 'search' && !fog) content = `<span class="eyebrow">${catalogue.label}</span><h2>找音乐人</h2><label class="map-search-label" for="map-artist-search">${availableArtists.length} 位已收录</label><input id="map-artist-search" class="map-input" type="search" placeholder="${isReal ? '名字，如 周杰伦、JJ Lin' : '名字或标签，如 林间、民谣'}" value="${escapeHTML(map.view.query)}" autocomplete="off"><div class="map-search-results" data-map-search-results>${searchResultsHTML(map.view.query, dataset)}</div>`;
  // New rounds always use the real catalogue; 0.15 fictional sessions only reopen.
  const realArtists = artistsInDataset('real');
  if (panel === 'challenge') {
    // 换个起点再出一题 opens the same form for a friend: 出题给朋友 comes first and deals nothing here.
    const sharing = map.view.challengeIntent === 'share';
    const play = `<button class="button ${sharing ? 'button--quiet' : 'button--primary'}" type="submit" name="intent" value="play">${sharing ? '自己先走一局' : `开局 ${api.icon('arrow-right')}`}</button>`;
    const send = `<button class="button ${sharing ? 'button--primary' : 'button--quiet'}" type="submit" name="intent" value="share">出题给朋友${sharing ? ` ${api.icon('arrow-up-right')}` : ''}</button>`;
    const pick = (name, chosen) => `<select name="${name}">${realArtists.map(artist => `<option value="${artist.id}" ${chosen === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}${groupNote(artist.id)}</option>`).join('')}</select>`;
    content = `<span class="eyebrow">${catalogues.real.label}${sharing ? ' · 出题' : ''}</span><h2>${sharing ? '换个起点，再出一题' : '开一局寻声'}</h2><p class="map-panel-description">${sharing ? '选好起点和终点。发给朋友的只有这两位歌手和规则；答案、你的路线和收藏都不会带上。' : '选好起点和终点，桌上只翻开这两张唱片。开局前不会告诉你答案。'}</p><form data-map-challenge-form><label class="map-field">起点${pick('start', map.view.challengeStart)}</label><label class="map-field">终点${pick('target', map.view.challengeEnd)}</label><p class="map-form-error" data-map-challenge-error role="alert">${escapeHTML(map.view.challengeError)}</p><div class="map-form-actions">${sharing ? send + play : play + send}</div></form><p class="map-storage-note">${ROUND_RULE}仅使用本图谱已收录的共同演唱。</p>`;
  }
  if (panel === 'share' && artistById[map.view.shareStart]?.dataset === 'real' && artistById[map.view.shareTarget]?.dataset === 'real') {
    // Shown when the browser can neither share nor copy: the link sits in a field to copy by hand.
    const { shareStart: from, shareTarget: to } = map.view;
    content = `<span class="eyebrow">出题给朋友 · 不带答案</span><h2>${escapeHTML(artistName(from))} → ${escapeHTML(artistName(to))}，隔着几首歌？</h2><p class="map-panel-description">把这条链接发给朋友，TA 会拿到同一道题：只有起点、终点和规则，没有答案，也没有你的路线、收藏和历史。</p><label class="map-field map-share-field">题目链接<input class="map-input" type="text" readonly value="${escapeHTML(challengeUrl(from, to))}" data-map-share-link spellcheck="false" autocomplete="off"></label><p class="map-share-message">${escapeHTML(challengeText(from, to))}</p><div class="map-panel-actions">${button('copy-link', '复制链接', 'button button--primary')}${map.view.shareBack ? button('share-back', map.view.shareBack.panel === 'recap' ? '回到连线歌单' : '再出一题') : button('close', '完成')}</div>`;
  }
  if (panel === 'reveal' && round && session.status === 'active') content = `<span class="eyebrow">寻声 · 揭晓</span><h2>放弃并揭晓答案？</h2><p class="map-panel-description">本局记为「已揭晓」，不算抵达；已翻开的唱片和你的路线都保留。</p><div class="map-panel-actions">${button('reveal-confirm', `揭晓答案 ${api.icon('arrow-right')}`, 'button button--primary')}${button('close', '再想想')}</div>`;
  if (panel === 'artist') {
    const fallbackId = currentNode(session).id;
    const id = datasetForArtist(map.view.selectedArtistId) === dataset && (!fog || knowledge.known.has(map.view.selectedArtistId)) ? map.view.selectedArtistId : fallbackId;
    const artist = artistById[id];
    if (round) {
      const here = id === currentNode(session).id;
      const links = getNeighbors(id, 'co', dataset);
      const shown = fog ? links.filter(edge => knowledge.flipped.has(edge.id)) : links;
      const sealed = links.length - shown.length;
      const role = id === session.target ? '终点' : here ? '你在这里' : knowledge.visited.has(id) ? '来过' : '已认出';
      content = `<span class="eyebrow">寻声 · ${isGroup(id) ? '乐团 · ' : ''}${role}</span><h2>${escapeHTML(artist.name)}</h2>${shown.length ? tracksHTML(session, shown.map(edge => edge.song).filter(Boolean), api, `在寻声中留下`, true, true, fog) : ''}${fog && sealed ? `<p class="map-round-sealed-note">${id === session.target ? `终点的 ${sealed} 首合作还封着，不能从终点倒推。` : here ? `还有 ${sealed} 首封着，在下方手牌里翻开。` : `还有 ${sealed} 首封着，走到 TA 面前才能翻开。`}</p>` : ''}${!shown.length && !sealed ? '<p class="map-inline-empty">本专题暂未收录合作。</p>' : ''}`;
    } else content = `<span class="eyebrow">${catalogue.label} · ${isGroup(id) ? '乐团 · ' : ''}${isReal ? '入选合作' : '示例作品'}</span><h2>${escapeHTML(artist.name)}</h2>${isReal && id !== currentNode(session).id && session.type !== 'challenge' ? `<div class="map-panel-actions">${button('new', '从这里开始探索', 'button button--quiet', `data-id="${id}"`)}</div>` : ''}${tracksHTML(session, artist.songIds, api, `在${artist.name}的作品里留下`, true, true)}`;
  }
  if (panel === 'edge') {
    const edge = edges.find(item => item.id === map.view.selectedEdgeId && item.dataset === dataset && item.mode === (round ? 'co' : session.mode));
    if (edge && (!fog || knowledge.flipped.has(edge.id))) {
      const from = currentNode(session).id;
      const touchesCurrent = edge.a === from || edge.b === from;
      const next = touchesCurrent ? otherArtist(edge, from) : null;
      // An ended roam walks on only after 继续本次探索, offered here in place of 「前往」.
      const canMove = next && !isClosed(session) && session.status !== 'ended';
      // Names in the title only select, even in a roam: the move is the explicit 「前往」 below.
      content = `<span class="eyebrow">${isReal ? '共同演唱' : modeName(edge.mode)}</span><h2 class="map-edge-title">${button('select', escapeHTML(artistName(edge.a)), 'map-edge-person', `data-id="${edge.a}" data-no-move="true"`)}<span>×</span>${button('select', escapeHTML(artistName(edge.b)), 'map-edge-person', `data-id="${edge.b}" data-no-move="true"`)}</h2>${edge.song ? tracksHTML(session, [edge.song], api, round ? '从关系网中留下' : duetSource(edge.a, edge.b, edge), true, true, fog) : `<p class="map-panel-description">${escapeHTML(edge.evidence)}</p>`}${evidenceHTML(edge, api)}${fog && songs[edge.song]?.credits?.length ? '<p class="map-round-sealed-note">完整制作署名在本局结束后的连线歌单里展开，以免提前认出还盖着的音乐人。</p>' : ''}${next && roamEnded(session) ? `<p class="map-panel-description">这次探索已结束；继续后才能沿这首歌走到${escapeHTML(artistName(next))}。</p>` : ''}<div class="map-panel-actions">${canMove ? button('move', `前往${escapeHTML(artistName(next))} ${api.icon('arrow-right')}`, 'button button--primary', `data-id="${next}" data-edge-id="${edge.id}"`) : next && roamEnded(session) ? button('resume', `继续本次探索 ${api.icon('arrow-right')}`, 'button button--primary', `data-session="${session.id}"`) : isReal && session.type !== 'challenge' ? button('new', `从${escapeHTML(artistName(edge.a))}出发`, 'button button--quiet', `data-id="${edge.a}"`) : ''}</div>`;
    }
  }
  if (panel === 'credits') {
    const song = songs[map.view.creditSongId];
    const allowed = !fog;
    if (song?.credits?.length && allowed) content = `<div class="map-credit-heading"><span class="map-credit-disc" style="--credit-tone:${toneOf(song.artists[0])}" aria-hidden="true"></span><div><span class="eyebrow">作品署名</span><h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.recordingLabel)}</p></div></div>${creditsHTML(song, api, true)}${fog ? '<p class="map-round-sealed-note">署名表按来源原样列出；非演唱署名不表示合唱。</p>' : ''}<div class="map-credit-bottom"><span>无内置音频</span>${button('save', `${api.icon(songIsSaved(session, song.id) ? 'check' : 'plus')} ${songIsSaved(session, song.id) ? '已留下' : '留下作品'}`, 'button button--quiet', `data-id="${song.id}" data-session="${session.id}" data-source="查看作品制作署名后留下" aria-pressed="${songIsSaved(session, song.id)}"`)}</div>`;
  }
  if (panel === 'relations' && !fog) {
    const id = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : currentNode(session).id;
    content = `<span class="eyebrow">${catalogue.label} · ${modeName(session.mode)}</span><h2>连接来源</h2><p class="map-panel-description">${isReal ? '图中连线表示共同演唱；每首作品可展开制作署名。' : '虚构示例，无音源。标签由人工整理。'}</p>${getNeighbors(id, session.mode, dataset).map(edge => `<section class="map-relation-proof"><div class="map-relation-title"><h3>${escapeHTML(artistName(id))} <span>↔</span> ${escapeHTML(artistName(otherArtist(edge, id)))}</h3>${button('edge', api.icon('arrow-up-right'), 'icon-button', `data-id="${edge.id}" aria-label="查看与${escapeHTML(artistName(otherArtist(edge, id)))}的连接"`)}</div>${edge.song ? tracksHTML(session, [edge.song], api, duetSource(edge.a, edge.b, edge), true, true) : `<p>${escapeHTML(edge.evidence)}</p>`}${edge.dataset !== 'real' ? evidenceHTML(edge, api) : ''}</section>`).join('') || '<p class="map-inline-empty">本图谱暂无收录。</p>'}`;
  }
  if (panel === 'recap') {
    if (round && isClosed(session)) { content = setlistHTML(map, session, api, page); dialogClass = ' map-dialog--setlist'; }
    else content = round ? roundProgressHTML(session, api) : isFreeRoam(session) ? roamRecapHTML(map, session, api, page) : recapHTML(session, api);
  }
  if (panel === 'history') {
    const records = listedRecords(map);
    content = `<span class="eyebrow">探索记录 · 仅存当前浏览器</span><h2>我的发现</h2><div class="map-record-list map-record-list--panel">${records.map((item, index) => recordRowHTML(item, api, true, index)).join('') || '<p class="map-inline-empty">还没有探索记录。</p>'}</div>`;
  }
  if (panel === 'delete') content = `<h2>删除这次探索？</h2><p class="map-panel-description">将删除从${escapeHTML(artistName(session.start))}出发的路线、分支和作品清单，无法恢复。</p><div class="map-panel-actions">${button('delete-confirm', '删除记录', 'button button--primary', `data-session="${session.id}"`)}${button('close', '保留')}</div>`;
  if (panel === 'reset') content = `<h2>回到${escapeHTML(artistName(session.start))}？</h2><p class="map-panel-description">当前路线与步数归零${round ? '，已翻开的唱片保留' : '，作品清单和分支记录保留'}。</p><div class="map-panel-actions">${button('reset-confirm', '回到起点', 'button button--primary')}${button('close', '继续当前路线')}</div>`;
  if (panel === 'replace' && artistById[map.view.pendingStart]?.dataset === 'real' && isFreeRoam(session)) {
    // A singer's name never breaks across lines in the headline.
    const next = `<span class="map-nowrap">${escapeHTML(artistName(map.view.pendingStart))}</span>`;
    content = `<span class="eyebrow">本次探索 · 进行中</span><h2>结束当前探索，并从${next}开始新的探索？</h2><p class="map-panel-description">从${escapeHTML(artistName(session.start))}出发的这次探索（途经 ${visitedArtists(session).length} 位 · 留下 ${currentSavedSongs(session).length} 首）会标记为已结束，留在「我的发现」里，随时可以回看或继续。</p><div class="map-panel-actions">${button('replace-confirm', `结束并开始 ${api.icon('arrow-right')}`, 'button button--primary')}${button('close', '取消')}</div>`;
  }
  if (!content) return '';
  const roamPanel = roamRecap && !round && isFreeRoam(session);
  const label = panel === 'recap' ? (round && isClosed(session) ? '连线歌单' : roamPanel && session.status !== 'ended' ? '本次发现' : '探索回顾') : panel === 'challenge' ? (map.view.challengeIntent === 'share' ? '换个起点，再出一题' : '开一局寻声') : panel === 'share' ? '出题给朋友' : panel === 'reveal' ? '揭晓确认' : panel === 'history' ? '我的发现' : panel === 'replace' ? '结束当前探索' : '音乐探索面板';
  // The roam recap and the setlist keep the undo at the top of their pinned bar (in flow, so it never
  // lies over a song). Elsewhere the slip is pinned to the bottom of the paper (map-round.css), so a
  // removal far down a long paper can be undone without scrolling.
  const setlist = dialogClass.includes('setlist');
  const pinnedUndo = roamPanel || setlist ? '' : undoHTML(map, api, page, session.id);
  return `<dialog class="map-dialog map-dialog--${panel}${dialogClass}" aria-label="${label}"><div class="map-dialog__top">${button('close', api.icon('x'), 'icon-button', 'aria-label="关闭面板"')}</div><div class="map-dialog__content">${content}${pinnedUndo}</div></dialog>`;
}

function recordsHTML(map, api) {
  // The same records the courtyard counts: a round dealt on arrival and never opened is not listed.
  const records = listedRecords(map);
  const rows = records.map((session, index) => recordRowHTML(session, api, false, index)).join('');
  return `<section class="map-records" aria-label="音乐探索记录"><div class="map-records-heading"><h2>探索记录</h2><span class="muted">${records.length} 次探索</span></div><div class="map-record-list">${rows || `<div class="empty-state"><h3>还没有探索记录</h3><p>从一位喜欢的歌手出发，路上留下的歌和走过的路都会记在这里。</p>${button('go-home', '开始探索', 'button button--primary', 'data-intent="new"')}${button('round-next', '开一局寻声', 'button button--quiet', 'data-reuse="true"')}</div>`}</div><p class="map-storage-note">仅存当前浏览器，清除浏览器数据会丢失。</p>${undoHTML(map, api, 'records')}${panelHTML(map, api, true)}</section>`;
}

/** A new roam replaces the active one: walked progress is kept as an ended record (callers ask
 *  first, see roamNeedsConfirm); a roam that never moved or kept a song is simply let go. */
function startRoam(map, id) {
  const previous = activeSession(map);
  if (isFreeRoam(previous) && previous.status === 'active') {
    if (roamHasProgress(previous)) { previous.status = 'ended'; previous.updated = Date.now(); }
    else dropSession(map, previous.id);
  }
  const session = createSession(id);
  map.sessions.push(session);
  activateSession(map, session);
  map.view.panel = null;
  map.view.reviewId = null;
  map.view.selectedArtistId = id;
  map.view.selectedEdgeId = null;
}

function attachInteractions(container, api, recordsOnly) {
  const abort = new AbortController();
  const { signal } = abort;
  let drag = null;
  let suppressClickUntil = 0;
  // 2D table: each name tag's size, read once per drawing of the table (see labelNodes).
  const labelSizes = new WeakMap();
  let ceremonyTimer = 0;
  const mutate = (fn, redraw = true, keepPosition = null) => {
    const previousDialog = container.querySelector('.map-dialog');
    const dialogScroll = previousDialog?.scrollTop || 0;
    const routeDetailsOpen = previousDialog?.querySelector('.map-route-details')?.open;
    const dialogDetails = previousDialog ? [...previousDialog.querySelectorAll('details')].map(detail => detail.open) : [];
    const previousPanel = api.getState().map.view.panel;
    const hand = container.querySelector('.map-round-hand__cards');
    const handScroll = hand ? { node: hand.dataset.node, left: hand.scrollLeft } : null;
    const position = keepPosition?.control && {
      inDialog: Boolean(keepPosition.control.closest('.map-dialog')),
      control: { ...keepPosition.control.dataset },
      songId: keepPosition.songId,
      details: [...container.querySelectorAll('details')].map(detail => detail.open),
      scroll: ['#main-content', '.map-artist-panel', '.map-route-trail'].map(selector => {
        const element = selector[0] === '#' ? document.querySelector(selector) : container.querySelector(selector);
        return { selector, top: element?.scrollTop || 0, left: element?.scrollLeft || 0 };
      }),
      windowX: window.scrollX, windowY: window.scrollY,
    };
    api.update(state => fn(state.map));
    if (redraw) {
      api.render();
      const currentContainer = container.isConnected ? container : document.getElementById(container.id);
      const nextHand = currentContainer?.querySelector('.map-round-hand__cards');
      if (handScroll && nextHand?.dataset.node === handScroll.node) nextHand.scrollLeft = handScroll.left;
      if (position) currentContainer.querySelectorAll('details').forEach((detail, index) => { detail.open = Boolean(position.details[index]); });
      if (previousPanel && api.getState().map.view.panel === previousPanel) {
        const newDialog = currentContainer?.querySelector('.map-dialog');
        if (newDialog) {
          // The same paper redrawn keeps every fold as the player left it.
          const folds = [...newDialog.querySelectorAll('details')];
          if (folds.length === dialogDetails.length) folds.forEach((detail, index) => { detail.open = dialogDetails[index]; });
          else {
            const routeDetails = newDialog.querySelector('.map-route-details');
            if (routeDetails) routeDetails.open = Boolean(routeDetailsOpen);
          }
          newDialog.scrollTop = dialogScroll;
        }
      }
      if (position) {
        const focusScope = position.inDialog ? currentContainer.querySelector('.map-dialog') || currentContainer : currentContainer;
        const controls = [...focusScope.querySelectorAll('[data-map-action]')].filter(control => !control.disabled && control.getClientRects().length);
        const target = controls.find(control => Object.entries(position.control).every(([key, value]) => control.dataset[key] === value))
          || (position.songId && controls.find(control => control.dataset.mapAction === 'save' && control.dataset.id === position.songId))
          || controls.find(control => control.dataset.mapAction === 'undo')
          || controls[0];
        target?.focus({ preventScroll: true });
        position.scroll.forEach(({ selector, top, left }) => {
          const element = selector[0] === '#' ? document.querySelector(selector) : currentContainer.querySelector(selector);
          if (element) { element.scrollTop = top; element.scrollLeft = left; }
        });
        window.scrollTo({ left: position.windowX, top: position.windowY, behavior: 'instant' });
      }
    }
  };
  /** Move keyboard focus to the next useful control after a full redraw, keeping the hand card in view. */
  const focusControl = selector => {
    const target = container.querySelector(selector);
    if (!target || target.disabled) return false;
    target.focus({ preventScroll: true });
    const card = target.closest('.map-round-card');
    const row = card?.parentElement;
    if (card && row) {
      const left = card.offsetLeft - row.offsetLeft; const right = left + card.offsetWidth;
      if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left - 8);
      else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth + 8;
    }
    // Without WebGL the record shop is a scrolling page: bring the control above the fixed nav.
    if (document.body.classList.contains('spatial-fallback')) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
    return true;
  };
  /** Scroll a hand card into view without moving focus (the hinted card may sit off to the right). */
  const revealCard = slot => {
    const card = container.querySelector(`.map-round-card[data-slot="${slot}"]`);
    const row = card?.parentElement;
    if (!card || !row) return;
    const left = card.offsetLeft - row.offsetLeft; const right = left + card.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: Math.max(0, right - row.clientWidth + 12), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const showPanel = (panel, id = null, { intent = 'play' } = {}) => mutate(map => {
    map.view.panel = panel;
    map.view.reviewId = id;
    if (panel === 'challenge') {
      const current = sessionById(map, id) || activeSession(map);
      const [first, last] = catalogues.real.rounds[0] || [catalogues.real.start, catalogues.real.target];
      map.view.challengeError = '';
      map.view.challengeIntent = intent === 'share' ? 'share' : 'play';
      if (datasetForArtist(map.view.challengeStart) !== 'real') map.view.challengeStart = current && sessionDataset(current) === 'real' ? currentNode(current).id : first;
      if (datasetForArtist(map.view.challengeEnd) !== 'real') map.view.challengeEnd = last;
      // 换个起点再出一题 after a round: the form offers another pair (the next preset that starts elsewhere),
      // not the one just played.
      if (intent === 'share' && isRound(current) && map.view.challengeStart === current.start && map.view.challengeEnd === current.target) {
        const pairs = roundPairs('real');
        const at = pairs.findIndex(([start, target]) => start === current.start && target === current.target);
        const next = [...pairs.slice(at + 1), ...pairs.slice(0, at + 1)].find(([start]) => start !== current.start);
        if (next) [map.view.challengeStart, map.view.challengeEnd] = next;
      }
    }
  });
  const goExplore = () => api.navigate('explore');
  /** Focus the control that opened the paper: the same action and data, else the control now in its
   *  place (结束探索 becomes 继续本次探索), else the 目录 it was chosen from. */
  const restoreOpener = opener => {
    if (!opener) return false;
    const scope = container.isConnected ? container : document.getElementById(container.id);
    if (!scope) return false;
    const usable = control => control && !control.disabled && control.getClientRects().length;
    const same = [...scope.querySelectorAll(`[data-map-action="${opener.action}"]`)].find(control => usable(control) && !control.closest('.map-dialog')
      && (control.dataset.id || '') === opener.id && (control.dataset.session || '') === opener.session);
    // A control from the folded 目录 has no box, so its summary takes the focus.
    const target = same || (opener.slot && [...scope.querySelectorAll(`[data-map-slot="${opener.slot}"]`)].find(usable))
      || (opener.inMenu ? scope.querySelector('.map-shop-menu>summary') : null);
    if (!usable(target)) return false;
    target.focus({ preventScroll: true });
    if (document.body.classList.contains('spatial-fallback')) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    return true;
  };
  /** Fold the paper and hand focus back to where it was opened, or to the table's own controls rather than the page. */
  const closePanel = () => {
    const opener = panelOpener;
    panelOpener = null;
    mutate(state => { state.view.panel = null; state.view.pendingStart = null; });
    if (restoreOpener(opener)) return;
    if (!recordsOnly) focusControl('.map-round-hand--closed [data-map-action="recap"]') || focusControl('.map-round-tools [data-map-action="hint"]') || focusControl('.map-roam-bar [data-map-slot="end"]') || focusControl('.map-studio-tools .button');
  };

  /** After the anchor changes, centre the table on it (the anchor is the selected record) and keep
   *  keyboard focus on the table: the 2D records are redrawn, the scene keeps its own name tags. */
  function centreAnchor(id) {
    performAction({ mapAction: 'focus' });
    if (document.body.classList.contains('spatial-fallback')) focusControl(`.map-network-node[data-id="${id}"]`);
    else if (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) focusControl('.map-roam-bar__found');
  }
  /** Start a fresh roam from a real singer. Walked progress is never dropped silently: the player
   *  confirms ending it first, and the ended roam stays in 我的发现. */
  function requestRoam(id) {
    if (artistById[id]?.dataset !== 'real') return;
    if (recordsOnly) { api.navigate('explore', { artistId: id, newSession: true }); return; }
    const current = activeSession(api.getState().map);
    if (roamNeedsConfirm(current)) {
      mutate(state => { state.view.pendingStart = id; state.view.panel = 'replace'; state.view.reviewId = current.id; });
      return;
    }
    mutate(state => startRoam(state, id), false);
    goExplore();
    api.toast(roamStartToast(id));
  }

  function back(reset = false) {
    const map = api.getState().map;
    const session = activeSession(map);
    if (!session || session.path.length < 2 || isClosed(session) || roamEnded(session)) return;
    const round = isRound(session);
    const distance = round && (session.hints || []).some(hint => hint.level === 1) ? distancesFrom(session.target, sessionDataset(session)) : null;
    const landing = reset ? session.path[0].id : session.path[session.path.length - 2].id;
    mutate(state => {
      const selected = activeSession(state);
      const from = currentNode(selected).id;
      selected.path = reset ? [selected.path[0]] : selected.path.slice(0, -1);
      const node = currentNode(selected);
      selected.mode = selected.type === 'challenge' ? 'co' : node.mode;
      selected.yaw = node.yaw;
      selected.pitch = node.pitch;
      selected.events.push({ type: reset ? 'reset' : 'back', from, to: node.id, ...(distance ? { remaining: distance.get(node.id) } : {}) });
      selected.updated = Date.now();
      state.view.panel = null;
      state.view.selectedArtistId = node.id;
      state.view.selectedEdgeId = null;
    });
    if (round) {
      api.toast(`${reset ? '回到' : '退回'}${artistName(landing)}${distance ? ` · 还隔 ${distance.get(landing)} 首` : ''}${reset ? ' · 已翻开的唱片保留' : ''}`);
      focusControl('.map-round-card.is-sealed [data-map-action="flip"]') || focusControl('.map-round-card [data-map-action="move"]');
    } else if (isFreeRoam(session)) {
      api.toast(reset ? `回到起点：${artistName(landing)} · 留下的歌都还在` : `返回${artistName(landing)}`);
      centreAnchor(landing);
    }
  }

  /** Hand a round's pair to a friend. Where the browser can neither share nor copy, a paper with the
   *  link opens instead, and closing it returns focus to the control that asked. */
  function shareRound(start, target, opener = null) {
    shareChallengeLink({ start, target }, {
      toast: api.toast,
      showLink: () => {
        const before = api.getState().map.view.panel;
        // Opened over the setlist or the form, the link paper leads back there.
        const back = ['recap', 'challenge'].includes(before) ? { panel: before, reviewId: api.getState().map.view.reviewId } : null;
        mutate(state => { Object.assign(state.view, { panel: 'share', shareStart: start, shareTarget: target, shareBack: back, reviewId: null }); });
        if (!before && opener) panelOpener = opener;
      },
    });
  }
  /** Draw a card and show its preview; saving and sharing are left to the preview's own buttons. */
  async function showCard(build, options) {
    if (drawingCard) return;
    drawingCard = true;
    try { await presentPng(await build(), options); }
    catch { api.toast('图片暂时未能生成，请稍后再试'); }
    finally { drawingCard = false; }
  }
  let lastOpener = null;
  function runAction(control) {
    if (!control || !container.contains(control) || control.disabled || Date.now() < suppressClickUntil) return;
    const menu = control.closest('.map-shop-menu');
    if (menu) menu.open = false;
    const before = api.getState().map.view.panel;
    const opener = { action: control.dataset.mapAction, id: control.dataset.id || '', session: control.dataset.session || '', slot: control.dataset.mapSlot || '', inMenu: Boolean(menu) };
    lastOpener = control.closest('.map-dialog') ? null : opener;
    performAction(control.dataset, control);
    // A paper opened from the table (not one opened from inside another paper) remembers its opener.
    if (!before && api.getState().map.view.panel) panelOpener = opener;
  }
  function performAction(data, control = null) {
    const { mapAction: action, id, session: sessionId } = data;
    const map = api.getState().map;
    const session = activeSession(map);
    const round = isRound(session);
    const knowledge = round ? roundKnowledge(session) : null;
    const fog = Boolean(knowledge?.fog);
    const dataset = sessionDataset(session);
    if (['zoom-in', 'zoom-out', 'fit', 'focus'].includes(action)) {
      if (!session) return;
      if (document.body.classList.contains('spatial-fallback')) {
        if (action === 'fit') Object.assign(fallbackView(), { zoom: 1, x: 0, z: 0 });
        else if (action === 'focus') {
          const view = fallbackView();
          const selected = networkLayout(dataset, round ? 'co' : session.mode).find(artist => artist.id === map.view.selectedArtistId);
          if (view.zoom === 1) Object.assign(view, { x: 0, z: 0 });
          else if (selected) Object.assign(view, { x: -selected.x * view.zoom, z: -selected.z * view.zoom });
        }
        else fallbackView().zoom = Math.max(1, Math.min(2.8, fallbackView().zoom * (action === 'zoom-in' ? 1.25 : .8)));
        (redrawTable || positionNodes)();
      } else api.spatial?.musicControl(action);
      return;
    }
    if (action === 'sealed') { api.toast(SEALED_TOAST); return; }
    if (action === 'select') {
      if (!session || datasetForArtist(id) !== dataset) return;
      if (fog && !knowledge.known.has(id)) { api.toast(SEALED_TOAST); return; }
      if (round) { mutate(state => { state.view.selectedArtistId = id; state.view.selectedEdgeId = null; state.view.panel = 'artist'; state.view.reviewId = session.id; }); return; }
      const fromSearch = map.view.panel === 'search';
      // Free roam: a singer next to you is one tap away. The first shared song in edge order is the way.
      // An ended roam only selects, and says how to walk on.
      // A singer with no duet with where you stand is only selected, and the toast says why nothing walked.
      let heldBack = false; let apartFrom = null;
      if (isFreeRoam(session) && !data.noMove) {
        const here = currentNode(session).id;
        const edge = id !== here ? getNeighbors(here, session.mode, dataset).find(item => otherArtist(item, here) === id) : null;
        if (edge && roamEnded(session)) heldBack = true;
        else if (edge) { performAction({ mapAction: 'move', id, edgeId: edge.id }); return; }
        else if (id !== here && !roamEnded(session)) apartFrom = here;
      }
      mutate(state => { state.view.selectedArtistId = id; state.view.selectedEdgeId = null; state.view.panel = null; state.view.reviewId = null; });
      if (fromSearch) performAction({ mapAction: 'focus' });
      if (heldBack) api.toast('这次探索已结束 · 点「继续本次探索」再接着走');
      else if (apartFrom) api.toast(`${artistName(id)}和${artistName(apartFrom)}没有直接${session.mode === 'co' ? '合唱' : '连接'} · 只选中看看`);
      return;
    }
    if (action === 'edge') {
      if (!edges.some(edge => edge.id === id && edge.dataset === dataset && edge.mode === (round ? 'co' : session.mode))) return;
      if (fog && !knowledge.flipped.has(id)) return;
      mutate(state => { state.view.selectedEdgeId = id; state.view.panel = 'edge'; state.view.reviewId = session.id; });
      return;
    }
    if (action === 'artist' && id && datasetForArtist(id) === dataset) {
      if (fog && !knowledge.known.has(id)) return;
      mutate(state => { state.view.selectedArtistId = id; state.view.panel = 'artist'; state.view.reviewId = session.id; });
      return;
    }
    if (action === 'credits' && songs[id]?.credits?.length) {
      const owner = sessionById(map, sessionId) || session;
      const ownerKnowledge = isRound(owner) ? roundKnowledge(owner) : null;
      if (ownerKnowledge?.fog) return;
      mutate(state => { state.view.creditSongId = id; state.view.reviewId = sessionId || null; state.view.panel = 'credits'; });
      return;
    }
    const panelAction = action === 'find-path' ? 'challenge' : action;
    if (['search', 'artist', 'relations', 'challenge', 'delete', 'recap', 'reveal', 'history'].includes(panelAction)) {
      if (fog && ['search', 'relations'].includes(panelAction)) return;
      if (panelAction === 'reveal' && !(round && session.status === 'active')) return;
      showPanel(panelAction, sessionId || null, { intent: data.intent });
      if (recordsOnly && ['search', 'challenge'].includes(panelAction)) goExplore();
      return;
    }
    switch (action) {
      case 'close': closePanel(); break;
      case 'new': requestRoam(id); break;
      case 'share-round': {
        // Only the pair is shared: never the route, the flipped cards, the hints or the keeps.
        const owner = sessionById(map, sessionId) || session;
        if (!isRound(owner) || sessionDataset(owner) !== 'real') break;
        shareRound(owner.start, owner.target, lastOpener);
        break;
      }
      case 'share-back': {
        const back = map.view.shareBack;
        mutate(state => { Object.assign(state.view, back ? { panel: back.panel, reviewId: back.reviewId || null } : { panel: null }, { shareBack: null }); });
        break;
      }
      case 'copy-link': {
        const field = container.querySelector('[data-map-share-link]');
        if (!field) break;
        const copied = navigator.clipboard?.writeText ? navigator.clipboard.writeText(field.value) : Promise.reject(new Error('no clipboard'));
        copied.then(() => api.toast('题目链接已复制')).catch(() => {
          field.focus(); field.select();
          let manual = false;
          try { manual = document.execCommand('copy'); } catch { manual = false; }
          api.toast(manual ? '题目链接已复制' : '链接已选中，可以长按或用快捷键复制');
        });
        break;
      }
      case 'save-card': {
        const owner = sessionById(map, sessionId) || session;
        if (!isRound(owner) || !isClosed(owner) || sessionDataset(owner) !== 'real') break;
        const steps = owner.path.length - 1;
        showCard(() => buildChallengeCard(owner), {
          filename: challengeCardName(owner), title: '寻声战绩卡',
          alt: `寻声战绩卡：${artistName(owner.start)} → ${artistName(owner.target)}，我走了 ${steps} 步${owner.status === 'revealed' ? '，已揭晓' : ''}。中间的歌手盖着，扫码可以走同一道题。`,
          note: '图片只画起点、终点和盖着的唱片，不写中间的歌手和歌名。',
        });
        break;
      }
      case 'save-discovery': {
        const owner = sessionById(map, sessionId) || session;
        if (!isFreeRoam(owner) || sessionDataset(owner) !== 'real') break;
        const met = visitedArtists(owner).length; const kept = currentSavedSongs(owner).length;
        showCard(() => buildDiscoveryCard(owner), {
          filename: discoveryCardName(owner), title: '发现卡片',
          alt: `发现卡片：从${artistName(owner.start)}出发，途经 ${met} 位，留下 ${kept} 首。`,
          note: `完整的路线和来源仍在网页的探索回顾里${discoveryExcerpted(owner) ? '；长内容在图片上只画了一部分，标了「节选」' : ''}。`,
        });
        break;
      }
      case 'friend-dismiss':
        mutate(state => { const selected = activeSession(state); if (selected?.friend) selected.friend.dismissed = true; });
        focusControl('.map-round-tools [data-map-action="hint"]') || focusControl('.map-round-card [data-map-action="flip"]');
        break;
      case 'replace-confirm': {
        const target = map.view.pendingStart;
        if (artistById[target]?.dataset !== 'real') { closePanel(); break; }
        mutate(state => {
          const current = activeSession(state);
          if (isFreeRoam(current) && current.status === 'active') { current.status = 'ended'; current.updated = Date.now(); }
          startRoam(state, target);
          state.view.pendingStart = null;
        });
        api.toast(`上一段探索已留在「我的发现」 · ${roamStartToast(target)}`);
        centreAnchor(target);
        break;
      }
      case 'go-home':
        // The paper is folded first, so the record shop opens clean next time.
        mutate(state => { state.view.panel = null; state.view.reviewId = null; state.view.pendingStart = null; }, false);
        api.navigate('home');
        // 开始新探索 hands a keyboard or mouse user straight to the singer search.
        if (data.intent === 'new' && globalThis.matchMedia?.('(pointer: fine)').matches) document.getElementById('home-artist-search')?.focus();
        break;
      case 'flip': {
        if (!round || !fog) break;
        const here = currentNode(session).id;
        const edge = data.slot !== undefined ? getNeighbors(here, 'co', dataset)[Number(data.slot)] : roundEdge(data.edgeId);
        if (!edge || edge.dataset !== dataset || edge.mode !== 'co' || (edge.a !== here && edge.b !== here) || knowledge.flipped.has(edge.id)) break;
        const partner = otherArtist(edge, here);
        const cameBefore = knowledge.visited.has(partner);
        const isTarget = partner === session.target;
        handMotion = { kind: 'flip', edgeId: edge.id, token: Date.now(), flash: isTarget ? partner : null };
        mutate(state => {
          const selected = activeSession(state);
          selected.flipped = [...(selected.flipped || []), edge.id];
          selected.updated = Date.now();
          state.view.selectedArtistId = here;
          state.view.selectedEdgeId = edge.id;
        });
        handMotion = null;
        const count = roundKnowledge(activeSession(api.getState().map)).known.size;
        api.toast(isTarget ? `是${artistName(partner)}！前往即抵达` : cameBefore ? `绕回来了：你来过${artistName(partner)}` : `《${songTitle(edge)}》：${artistName(here)} × ${artistName(partner)} · 认识 ${count}/${artistsInDataset(dataset).length}`);
        focusControl(`[data-map-action="move"][data-edge-id="${edge.id}"]`);
        break;
      }
      case 'hint': {
        if (!round || session.status !== 'active') break;
        const level = hintLevel(session);
        if (level === 3) { showPanel('reveal'); break; }
        const info = roundHint(session);
        if (info.distance === null) { api.toast('本专题已收录的合作还连不到终点'); break; }
        mutate(state => {
          const selected = activeSession(state);
          selected.hints = [...(selected.hints || []), { level, at: selected.events.length, t: Date.now(), ...(level === 2 && info.nextEdge ? { edgeId: info.nextEdge.id } : {}) }];
          selected.updated = Date.now();
        }, true, control ? { control } : null);
        // The full sentence stays on the tape under the question; the toast is the short spoken version.
        const backTo = level === 2 && info.nextEdge ? hintBackTo(session, info.nextEdge.id) : null;
        api.toast(level === 1 ? `提示 ①：还隔 ${info.distance} 首，面前 ${info.closer} 首会更近` : backTo ? `提示 ②：退一步回到${artistName(backTo)}` : `提示 ②：试试《${songTitle(info.nextEdge)}》`);
        if (level === 2 && info.nextEdge && !backTo) revealCard(getNeighbors(currentNode(session).id, 'co', dataset).findIndex(edge => edge.id === info.nextEdge.id));
        break;
      }
      case 'reveal-confirm': {
        if (!round || session.status !== 'active') break;
        const ceremonial = !prefersReducedMotion();
        mutate(state => {
          const selected = activeSession(state);
          selected.status = 'revealed';
          selected.hints = [...(selected.hints || []), { level: 3, at: selected.events.length, t: Date.now() }];
          selected.updated = Date.now();
          state.view.ceremony = ceremonial ? { sessionId: selected.id, kind: 'reveal', token: Date.now() } : null;
          state.view.panel = ceremonial ? null : 'recap';
          state.view.reviewId = ceremonial ? null : selected.id;
          state.view.selectedArtistId = currentNode(selected).id;
          state.view.selectedEdgeId = null;
        });
        if (ceremonial) focusControl('[data-map-action="ceremony-done"]');
        break;
      }
      case 'ceremony-done': {
        const ceremony = map.view.ceremony;
        if (!ceremony) break;
        clearTimeout(ceremonyTimer);
        const owner = sessionById(map, ceremony.sessionId);
        mutate(state => {
          state.view.ceremony = null;
          if (owner && isClosed(owner) && state.activeId === owner.id) { state.view.panel = 'recap'; state.view.reviewId = owner.id; }
        });
        break;
      }
      case 'round-next': {
        const wasRound = round && session.status === 'active' && !untouchedRound(session);
        // 开一局 from the atlas or the records opens a round dealt earlier and never touched; 换一组 deals past it.
        const waiting = data.reuse ? waitingRound(map) : null;
        mutate(state => {
          const shelved = waiting && sessionById(state, waiting.id);
          // Opened from a roam, the shelved round leads back to that roam, as a newly dealt one would.
          if (shelved) { shelved.returnRoamId = roamToReturnTo(state, sessionDataset(shelved)) || shelved.returnRoamId || null; activateSession(state, shelved); Object.assign(state.view, { panel: null, reviewId: null, selectedArtistId: shelved.start, selectedEdgeId: null, ceremony: null }); fitTableOnMount = true; }
          else openNextRound(state, 'real');
        });
        if (recordsOnly) goExplore();
        const next = activeSession(api.getState().map);
        api.toast(`${wasRound ? '上一局已存入记录。' : ''}${waiting ? '' : '新的一局：'}${artistName(next.start)} → ${artistName(next.target)}，隔着几首歌？`);
        focusControl('.map-round-card [data-map-action="flip"]');
        break;
      }
      case 'round-to': {
        if (!session || round || session.type !== 'roam' || session.mode !== 'co' || dataset !== 'real') break;
        const from = currentNode(session).id;
        if (!artistById[id] || id === from || datasetForArtist(id) !== dataset) break;
        if (!isReachable(from, id, dataset)) { api.toast('本专题已收录的合作尚未连通'); break; }
        mutate(state => { startRound(state, from, id); });
        api.toast(`新的一局：${artistName(from)} → ${artistName(id)}，隔着几首歌？`);
        focusControl('.map-round-card [data-map-action="flip"]');
        break;
      }
      case 'save-route': {
        const owner = sessionById(map, sessionId) || session;
        if (!isRound(owner) || !isClosed(owner)) break;
        const ids = recapRoute(owner).edges.map(edge => edge.song).filter(Boolean);
        const pending = ids.filter(songId => !songIsSaved(owner, songId));
        try { pending.forEach(songId => { if (songs[songId].dataset === 'real') saveMusic(songDraft(songs[songId])); }); }
        catch { api.toast('收藏还未保存，请检查浏览器存储空间后重试'); break; }
        mutate(state => {
          const selected = sessionById(state, owner.id);
          ids.forEach(songId => { if (!selected.saved.some(item => item.id === songId)) selected.saved.push({ id: songId, source: '从连线歌单留下', savedAt: Date.now() }); });
          selected.updated = Date.now();
        }, true, control ? { control } : null);
        api.toast(pending.length ? `已留下 ${pending.length} 首${sessionDataset(owner) === 'real' ? '，可在「我的发现 · 留下的歌」找到' : '（示例，仅存这次记录）'}` : '这几首都已留下');
        break;
      }
      case 'move': {
        if (!session || isClosed(session) || (round && session.status !== 'active') || roamEnded(session)) break;
        const here = currentNode(session).id;
        const edge = getNeighbors(here, round ? 'co' : session.mode, dataset).find(item => otherArtist(item, here) === id && (!data.edgeId || item.id === data.edgeId));
        if (!edge) break;
        if (fog && !knowledge.flipped.has(edge.id)) break;
        const distance = round && (session.hints || []).some(hint => hint.level === 1) ? distancesFrom(session.target, dataset) : null;
        const before = distance?.get(here); const after = distance?.get(id);
        const tone = distance ? after < before ? 'near' : after > before ? 'far' : 'even' : null;
        const arriving = session.type === 'challenge' && id === session.target;
        const ceremonial = arriving && round && !prefersReducedMotion();
        mutate(state => {
          const selected = activeSession(state);
          const from = currentNode(selected).id;
          Object.assign(currentNode(selected), { mode: selected.mode, yaw: selected.yaw, pitch: selected.pitch });
          selected.path.push({ id, edgeId: edge.id, mode: selected.mode, yaw: 0, pitch: 0 });
          selected.events.push({ type: 'move', from, to: id, edgeId: edge.id, ...(distance ? { remaining: after, tone } : {}) });
          selected.yaw = 0;
          selected.pitch = 0;
          selected.updated = Date.now();
          selected.status = arriving ? 'complete' : 'active';
          state.view.ceremony = ceremonial ? { sessionId: selected.id, kind: 'arrive', token: Date.now() } : null;
          state.view.panel = arriving && !ceremonial ? 'recap' : null;
          state.view.reviewId = arriving && !ceremonial ? selected.id : null;
          state.view.selectedArtistId = id;
          state.view.selectedEdgeId = edge.id;
          // The connection list is a tool for choosing the next step: once taken, it folds so the table shows.
          state.view.inspectorOpen = false;
        });
        if (!round) {
          if (isFreeRoam(session)) {
            api.toast(edge.song ? `沿《${songTitle(edge)}》走到${artistName(id)}` : `沿「${edge.reason}」走到${artistName(id)}`);
            centreAnchor(id);
          }
          break;
        }
        const stepCount = (activeSession(api.getState().map)?.path.length || 1) - 1;
        if (arriving) { api.toast(`抵达${artistName(id)}！${stepCount} 步`); if (ceremonial) focusControl('[data-map-action="ceremony-done"]'); break; }
        const toneWords = { near: '近 · 更近了', far: '远 · 绕远了', even: '平 · 一样远' }[tone];
        api.toast(`前往${artistName(id)} · 第 ${stepCount} 步${toneWords ? ` · ${toneWords}，还隔 ${after} 首` : ''}`);
        if (!focusControl('.map-round-card.is-sealed [data-map-action="flip"]')) focusControl('.map-round-hand.is-dead-end .map-round-route__back') || focusControl('.map-round-card [data-map-action="move"]');
        break;
      }
      case 'mode':
        if (!session || session.type === 'challenge') break;
        if (data.mode === 'style' && !catalogueFor(session).hasStyle) break;
        mutate(state => { const selected = activeSession(state); selected.mode = data.mode; selected.updated = Date.now(); state.view.selectedEdgeId = null; });
        break;
      case 'back': back(); break;
      case 'reset': if (session?.type === 'challenge') showPanel('reset'); else back(true); break;
      case 'reset-confirm': back(true); break;
      case 'save': {
        const owner = sessionById(map, sessionId);
        if (!owner || !songs[id]) break;
        const real = songs[id].dataset === 'real';
        const kept = songIsSaved(owner, id);
        const libraryTrack = real ? getSavedMusic().find(item => item.id === id) || null : null;
        // 留下的歌 follows every keep and removal made here, as before.
        try { if (real && kept) removeSavedMusic(id); else if (real) saveMusic(songDraft(songs[id])); }
        catch { api.toast('收藏还未保存，请检查浏览器存储空间后重试'); break; }
        mutate(state => {
          const selected = sessionById(state, sessionId);
          if (!selected) return;
          const index = selected.saved.findIndex(item => item.id === id);
          if (kept) {
            // Removal leaves this session's list too, so keeping it somewhere else never revives it here.
            const item = index >= 0 ? selected.saved[index] : { id, source: '在曲目收藏中留下', savedAt: libraryTrack?.savedAt || Date.now() };
            if (index >= 0) selected.saved.splice(index, 1);
            // The slip is bound to where the removal was made: this page, this record, as it is now (see liveUndo).
            state.undo = { sessionId: selected.id, item, index: index >= 0 ? index : selected.saved.length, libraryTrack, inSession: index >= 0, page: recordsOnly ? 'records' : 'explore', status: selected.status };
          } else {
            // Kept again later: it joins the end of the list.
            if (index < 0) selected.saved.push({ id, source: data.source || '在探索回顾中留下', savedAt: Date.now() });
            state.undo = null;
          }
          selected.updated = Date.now();
        }, true, { control });
        const count = currentSavedSongs(sessionById(api.getState().map, sessionId) || owner).length;
        api.toast(kept ? '已移除，可撤销' : isFreeRoam(owner) ? `已留下 · 本次发现 ${count} 首` : '已留下这首作品');
        break;
      }
      case 'undo': {
        // Only the removal this page still shows can be undone (a stale slip is never acted on).
        const entry = liveUndo(map, recordsOnly ? 'records' : 'explore');
        if (!entry) { if (map.undo) mutate(state => { state.undo = null; }); break; }
        const restoresLibrary = songs[entry.item.id]?.dataset === 'real' && (entry.libraryTrack || entry.inSession !== false);
        if (restoresLibrary) {
          try { saveMusic(entry.libraryTrack || { ...songDraft(songs[entry.item.id]), savedAt: entry.item.savedAt }); }
          catch { api.toast('收藏还未恢复，请检查浏览器存储空间后重试'); break; }
        }
        mutate(state => {
          const undo = state.undo;
          const selected = undo && sessionById(state, undo.sessionId);
          // Undo puts the song back where it was in the list.
          if (selected && undo.inSession !== false && !selected.saved.some(item => item.id === undo.item.id)) {
            selected.saved.splice(Math.min(undo.index, selected.saved.length), 0, undo.item);
            selected.updated = Date.now();
          }
          state.undo = null;
        }, true, { control, songId: entry.item.id });
        api.toast('已恢复');
        break;
      }
      case 'finish':
        // Ending again only updates the same record.
        mutate(state => { const selected = activeSession(state); if (!selected || isRound(selected)) return; selected.status = 'ended'; selected.updated = Date.now(); state.view.panel = 'recap'; state.view.reviewId = selected.id; state.view.pendingStart = null; if (state.undo?.sessionId === selected.id) state.undo = null; });
        break;
      case 'resume': {
        const target = sessionById(map, sessionId);
        if (!target) break;
        // 本次发现 is only a paper over the walk: continuing just folds it away.
        if (!recordsOnly && target.id === map.activeId && target.status === 'active') { closePanel(); break; }
        const reopened = roamEnded(target);
        mutate(state => { const selected = sessionById(state, sessionId); if (!selected) return; activateSession(state, selected); if (reopened && state.undo?.sessionId === selected.id) state.undo = null; if (!isClosed(selected)) selected.status = 'active'; selected.updated = Date.now(); state.view.panel = null; state.view.reviewId = null; state.view.pendingStart = null; }, false);
        if (recordsOnly) goExplore();
        else {
          // Already in the shop: redraw in place and hand focus to the bar (继续 sits where 结束探索 returns).
          panelOpener = null;
          api.render();
          focusControl('.map-roam-bar [data-map-slot="end"]') || focusControl('.map-round-card.is-sealed [data-map-action="flip"]') || focusControl('.map-round-card [data-map-action="move"]') || focusControl('.map-studio-tools .button');
        }
        if (reopened) api.toast('继续本次探索 · 再次结束会更新这条记录');
        break;
      }
      case 'return-roam':
        mutate(state => {
          const selected = sessionById(state, sessionId) || activeSession(state);
          if (!selected || selected.type !== 'challenge') return;
          selected.updated = Date.now();
          const catalogue = sessionDataset(selected);
          const original = sessionById(state, selected.returnRoamId);
          const fallback = original && sessionDataset(original) === catalogue ? original : [...state.sessions].reverse().find(item => item.type === 'roam' && sessionDataset(item) === catalogue && item.status !== 'ended');
          // An ended roam comes back ended: only 继续本次探索 reopens it.
          if (fallback) activateSession(state, fallback);
          else startRoam(state, currentNode(selected).id);
          state.view.panel = null;
          state.view.reviewId = null;
          state.view.ceremony = null;
        }, false);
        goExplore();
        break;
      case 'delete-confirm':
        mutate(state => {
          dropSession(state, sessionId);
          if (state.activeId === sessionId) {
            const fallback = [...state.sessions].reverse().find(item => item.type === 'roam') || [...state.sessions].reverse().find(item => isRound(item));
            if (fallback) activateSession(state, fallback);
            else state.activeId = null;
          }
          state.view.panel = null;
          state.view.reviewId = null;
        });
        api.toast('已删除这条记录');
        break;
    }
  }
  container.addEventListener('click', event => runAction(event.target.closest('[data-map-action]')), { signal });

  container.addEventListener('input', event => {
    if (event.target.id !== 'map-artist-search') return;
    const query = event.target.value;
    mutate(map => { map.view.query = query; }, false);
    container.querySelector('[data-map-search-results]').innerHTML = searchResultsHTML(query, sessionDataset(activeSession(api.getState().map)));
  }, { signal });

  container.addEventListener('submit', event => {
    if (!event.target.matches('[data-map-challenge-form]')) return;
    event.preventDefault();
    const data = new FormData(event.target);
    const start = data.get('start');
    const target = data.get('target');
    const error = roundError(start, target, 'real');
    mutate(map => { map.view.challengeStart = start; map.view.challengeEnd = target; map.view.challengeError = error; }, false);
    if (error) { container.querySelector('[data-map-challenge-error]').textContent = error; return; }
    // 出题给朋友 sends the pair and deals nothing here; the form stays open for another pair.
    if (event.submitter?.value === 'share') { shareRound(start, target, panelOpener); return; }
    mutate(map => { startRound(map, start, target); }, false);
    goExplore();
    api.toast(`新的一局：${artistName(start)} → ${artistName(target)}，隔着几首歌？`);
  }, { signal });

  const dialog = container.querySelector('.map-dialog');
  if (dialog) {
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePanel(); }, { signal });
    // A paper reopened by a reload was shown without a user gesture, and Chrome then ignores Escape
    // (no cancel event). Escape is handled here first, so it always folds the paper.
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      closePanel();
    }, { signal });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanel();
    }, { signal });
    const focusTarget = dialog.querySelector('input, select') || dialog.querySelector('.map-dialog__content [data-map-action]') || dialog.querySelector('button');
    focusTarget?.focus({ preventScroll: true });
    // The link field selects its whole address, ready to copy by hand.
    const link = dialog.querySelector('[data-map-share-link]');
    if (link) { link.addEventListener('focus', () => link.select(), { signal }); link.select(); }
  }

  // The catalogue menu is temporary paper: a click elsewhere or Escape folds it.
  const menu = container.querySelector('.map-shop-menu');
  if (menu) {
    document.addEventListener('pointerdown', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; }, { signal });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { event.stopPropagation(); menu.open = false; menu.querySelector('summary').focus(); } }, { signal });
  }

  const index = container.querySelector('[data-map-index]');
  index?.addEventListener('toggle', () => {
    if (api.getState().map.view.inspectorOpen !== index.open) api.update(state => { state.map.view.inspectorOpen = index.open; });
  }, { signal });
  const stage = container.querySelector('[data-map-stage]');
  // A long route scrolls inside its crumb, opened on its latest step. Whichever end is cut off fades out
  // (map-spatial.css) instead of slicing a name through a glyph.
  const markTrailEdges = trail => {
    const max = trail.scrollWidth - trail.clientWidth;
    trail.classList.toggle('is-cut-start', max > 1 && trail.scrollLeft > 1);
    trail.classList.toggle('is-cut-end', max > 1 && trail.scrollLeft < max - 1);
  };
  container.querySelectorAll('.map-route-trail').forEach(trail => {
    trail.scrollLeft = trail.scrollWidth; markTrailEdges(trail);
    trail.addEventListener('scroll', () => markTrailEdges(trail), { passive: true, signal });
  });
  window.addEventListener('resize', () => container.querySelectorAll('.map-route-trail').forEach(markTrailEdges), { signal });
  const resize = stage ? new ResizeObserver(() => positionNodes()) : null;
  // Without WebGL the shop is page paper under a floating nav. A round's table gives up height so the hand
  // under it ends above the nav while the page sits at its top: flipping and moving never need a scroll,
  // as with the 3D table (a phone's bottom nav included; on a very short phone the hand is also pinned
  // above the nav, see map-round.css). A roam's table keeps its clamp in map-spatial.css.
  const roundHand = stage && !recordsOnly ? container.querySelector('.map-round .map-round-hand') : null;
  function fitRoundTable() {
    if (!roundHand?.isConnected || !document.body.classList.contains('spatial-fallback')) return;
    const phone = window.innerWidth <= 760;
    const nav = [...document.querySelectorAll(phone ? '.mobile-nav' : '.primary-nav')].find(item => item.getClientRects().length && getComputedStyle(item).position === 'fixed');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    // Measured where the hand sits in the page, not where a pinned hand is drawn.
    roundHand.style.position = 'static';
    const table = stage.getBoundingClientRect(); const hand = roundHand.getBoundingClientRect();
    roundHand.style.removeProperty('position');
    const room = navTop - (phone ? 8 : 12) - (table.top + window.scrollY) - (hand.top - table.bottom) - hand.height;
    stage.style.height = `${Math.round(Math.min(phone ? 360 : 440, Math.max(phone ? 180 : 240, room)))}px`;
  }
  function fallbackView() {
    const session = activeSession(api.getState().map);
    const key = `${sessionDataset(session)}:${isRound(session) ? 'co' : session.mode}`;
    if (!fallbackViews.has(key)) {
      // A phone-width roam table opens closer, on where you stand, so records and their names have room;
      // 全图 shows the whole table and each move re-centres on the new singer.
      const narrow = isFreeRoam(session) && stage?.clientWidth > 0 && stage.clientWidth < 560;
      const here = narrow ? networkLayout(sessionDataset(session), session.mode).find(item => item.id === currentNode(session).id) : null;
      const zoom = here ? 1.6 : 1;
      fallbackViews.set(key, { x: here ? -here.x * zoom : 0, z: here ? -here.z * zoom : 0, zoom });
    } else if (fallbackRecentre && isFreeRoam(session)) {
      // A roam opened on another singer (a new start, a record resumed): a closer table centres on them.
      const view = fallbackViews.get(key);
      const here = view.zoom > 1 ? networkLayout(sessionDataset(session), session.mode).find(item => item.id === currentNode(session).id) : null;
      if (here) Object.assign(view, { x: -here.x * view.zoom, z: -here.z * view.zoom });
    }
    fallbackRecentre = false;
    return fallbackViews.get(key);
  }
  if (stage) {
    resize.observe(stage);
    stage.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...fallbackView() }, moved: false };
    }, { signal });
    stage.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) < 8 && !drag.moved) return;
      drag.moved = true; stage.setPointerCapture(event.pointerId);
      Object.assign(fallbackView(), { x: drag.view.x + dx / stage.clientWidth * 3.8, z: drag.view.z + dy / stage.clientHeight * 2.7 });
      stage.classList.add('is-dragging'); positionNodes();
    }, { signal });
    const finishDrag = () => { if (drag?.moved) suppressClickUntil = Date.now() + 220; stage.classList.remove('is-dragging'); drag = null; };
    stage.addEventListener('pointerup', finishDrag, { signal });
    stage.addEventListener('pointercancel', finishDrag, { signal });
    stage.addEventListener('click', event => { if (event.target.closest('.map-network-node.is-unknown')) api.toast(SEALED_TOAST); }, { signal });
    stage.addEventListener('keydown', event => {
      if (event.target !== stage) return;
      if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); performAction({ mapAction: event.key === '-' ? 'zoom-out' : 'zoom-in' }); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const view = fallbackView();
      view.x += event.key === 'ArrowLeft' ? .2 : event.key === 'ArrowRight' ? -.2 : 0;
      view.z += event.key === 'ArrowUp' ? .2 : event.key === 'ArrowDown' ? -.2 : 0;
      positionNodes();
    }, { signal });
    // A round just dealt opens on the whole table: the atlas and the rounds share one table (and one
    // 2D view), so a zoom left over from the atlas would otherwise carry into the new round.
    const fitNow = fitTableOnMount && !recordsOnly && isRound(activeSession(api.getState().map));
    if (fitNow) {
      fitTableOnMount = false;
      const dealt = activeSession(api.getState().map);
      fallbackViews.set(`${sessionDataset(dealt)}:co`, { x: 0, z: 0, zoom: 1 });
    }
    fitRoundTable();
    window.addEventListener('resize', fitRoundTable, { signal });
    positionNodes();
    // The scene takes the command once it holds this round's payload (published just above).
    if (fitNow) api.spatial?.musicControl('fit');
  }

  // After a reload the hinted card may sit beyond the visible cards; bring it in once laid out.
  const hinted = container.querySelector('.map-round-card.is-hinted');
  const hintKey = hinted && `${api.getState().map.activeId}:${hinted.parentElement?.dataset.node}:${hinted.dataset.slot}`;
  if (hinted && hintKey !== lastHintReveal) { lastHintReveal = hintKey; requestAnimationFrame(() => { if (hinted.isConnected) revealCard(hinted.dataset.slot); }); }

  // A ceremony always ends: the scene reports ceremony-done, and this timer is the
  // guarantee (and the only driver without WebGL). Stale ceremonies are cleared in mountMap.
  const ceremony = !recordsOnly && api.getState().map.view.ceremony;
  if (ceremony && ceremony.sessionId === api.getState().map.activeId) {
    const owner = activeSession(api.getState().map);
    const order = owner ? recapRoute(owner).edges.length : 0;
    const scene = !document.body.classList.contains('spatial-fallback');
    const duration = (scene ? 2400 : 900) + order * 300;
    ceremonyTimer = setTimeout(() => performAction({ mapAction: 'ceremony-done' }), Math.max(200, duration - (Date.now() - ceremony.token)));
  }

  function musicPayload(session) {
    const map = api.getState().map; const dataset = sessionDataset(session);
    const round = isRound(session);
    const knowledge = round ? roundKnowledge(session) : null;
    const fog = Boolean(knowledge?.fog);
    const mode = round ? 'co' : session.mode;
    const here = currentNode(session).id;
    const candidate = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : here;
    const id = fog && !knowledge.known.has(candidate) ? here : candidate;
    const layout = networkLayout(dataset, mode); const links = networkEdges(dataset, mode);
    // In a roam the lit records and ink are the ones one tap from where you stand, whoever is selected:
    // lit means "tap to walk". An ended roam and the other tables light the selection's connections.
    const hub = isFreeRoam(session) && !roamEnded(session) ? here : id;
    const neighbors = new Set(getNeighbors(hub, mode, dataset).filter(edge => !fog || knowledge.flipped.has(edge.id)).map(edge => otherArtist(edge, hub)));
    const visited = new Set(session.path.map(step => step.id)); const visitedEdges = new Set(session.path.map(step => step.edgeId).filter(Boolean));
    const answer = round && session.status === 'revealed' ? shortestChain(session.start, session.target, dataset, 'co') : null;
    const answerEdges = new Set(answer?.edges.map(edge => edge.id) || []); const answerNodes = new Set(answer?.nodes || []);
    const closed = round && isClosed(session);
    // During the closing ceremony the remaining sleeves turn over from the target outward.
    const distance = closed ? distancesFrom(session.target, dataset) : null;
    const turnOrder = closed ? [...layout].sort((a, b) => (distance.get(a.id) ?? 9) - (distance.get(b.id) ?? 9) || a.id.localeCompare(b.id)).map(item => item.id) : [];
    const ceremony = map.view.ceremony?.sessionId === session.id ? map.view.ceremony : null;
    const stub = fog ? activeStub(session) : null;
    const stubEdge = stub && roundEdge(stub.edgeId);
    const payload = {
      key: `${dataset}:${mode}`, selectedId: id, pathIds: [...visited], round: round ? { status: session.status, fog } : null,
      nodes: layout.map(artist => fog && !knowledge.known.has(artist.id)
        ? { id: artist.id, name: '', color: '#d9d4c7', count: 0, x: artist.x, z: artist.z, unknown: true }
        : { id: artist.id, name: artist.name, color: artist.color, count: round ? getNeighbors(artist.id, 'co', dataset).length : artist.songIds.length, x: artist.x, z: artist.z,
          selected: artist.id === id, adjacent: neighbors.has(artist.id), visited: visited.has(artist.id), current: artist.id === here, target: round && artist.id === session.target,
          route: round && visited.has(artist.id), highlighted: answerNodes.has(artist.id), disabled: false,
          revealDelay: closed && ceremony ? Math.max(0, turnOrder.indexOf(artist.id)) * .045 : 0 }),
      edges: links.filter(edge => !fog || knowledge.flipped.has(edge.id)).map(edge => ({ id: edge.id, a: edge.a, b: edge.b, title: songTitle(edge), kind: edge.mode,
        active: edge.a === hub || edge.b === hub || edge.id === map.view.selectedEdgeId, visited: visitedEdges.has(edge.id), route: round && visitedEdges.has(edge.id), answer: answerEdges.has(edge.id), highlighted: false })),
      ceremony: ceremony ? { token: ceremony.token, kind: ceremony.kind, order: recapRoute(session).edges.map(edge => edge.id) } : null,
      flash: handMotion?.flash ? { id: handMotion.flash, token: handMotion.token } : null,
    };
    if (stubEdge && !knowledge.flipped.has(stubEdge.id) && (stubEdge.a === here || stubEdge.b === here) && !hintBackTo(session, stubEdge.id)) payload.edges.push({ id: 'hint-stub', stub: true, a: stubEdge.a, b: stubEdge.b, from: here, kind: 'co', title: '' });
    return payload;
  }
  function positionNodes() {
    if (!stage) return;
    const session = activeSession(api.getState().map); if (!session) return;
    const payload = musicPayload(session);
    if (!recordsOnly) api.spatial?.publish({ mode: 'explore', cards: [], music: payload,
      onMusic(action) {
        if (!['select', 'edge', 'sealed', 'ceremony-done'].includes(action.action)) return;
        const before = api.getState().map.view.panel;
        performAction({ mapAction: action.action, id: action.id });
        // Opened from a name tag on the scene: closing falls back to the table's own controls.
        if (!before && api.getState().map.view.panel) panelOpener = null;
      },
    });
    const width = stage.clientWidth; const height = stage.clientHeight;
    if (!width || !height) return;
    const view = fallbackView(); const positions = new Map(); const shown = [];
    payload.nodes.forEach((point, slot) => {
      const x = width * (.5 + (point.x * view.zoom + view.x) / 3.8);
      const y = height * (.5 + (point.z * view.zoom + view.z) / 2.7);
      positions.set(point.id, [x, y]);
      const node = stage.querySelector(`[data-slot="${slot}"]`);
      if (!node) return;
      node.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      node.classList.toggle('is-highlighted', Boolean(point.highlighted));
      node.classList.toggle('is-route', Boolean(point.route));
      node.style.setProperty('--turn-delay', `${point.revealDelay || 0}s`);
      node.hidden = x < 25 || x > width - 25 || y < 25 || y > height - 25;
      if (!node.hidden) shown.push({ point, node, slot, x, y });
    });
    labelNodes(shown, width, height);
    const order = payload.ceremony?.order || [];
    const svg = stage.querySelector('[data-map-lines]'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = payload.edges.map(edge => {
      const [x, y] = positions.get(edge.a); const [tx, ty] = positions.get(edge.b);
      if (edge.stub) {
        const [fx, fy] = edge.from === edge.a ? [x, y] : [tx, ty]; const [ox, oy] = edge.from === edge.a ? [tx, ty] : [x, y];
        // A pencilled direction that leaves the sleeve and stops short of the other record, with an arrowhead.
        const reach = Math.hypot(ox - fx, oy - fy) || 1; const t0 = Math.min(.45, 30 / reach); const t1 = Math.max(t0 + .12, Math.min(t0 + 90 / reach, 1 - 34 / reach));
        const [sx, sy, ex, ey] = [fx + (ox - fx) * t0, fy + (oy - fy) * t0, fx + (ox - fx) * t1, fy + (oy - fy) * t1];
        const ux = (ox - fx) / reach; const uy = (oy - fy) / reach; const wing = angle => [ex - 11 * (ux * Math.cos(angle) - uy * Math.sin(angle)), ey - 11 * (ux * Math.sin(angle) + uy * Math.cos(angle))];
        const [[ax, ay], [bx, by]] = [wing(.55), wing(-.55)];
        return `<path class="map-network-line is-stub" pathLength="1" d="M${sx},${sy} L${ex},${ey}"/><path class="map-network-line is-stub-tip" d="M${ax},${ay} L${ex},${ey} L${bx},${by}"/>`;
      }
      const step = order.indexOf(edge.id);
      const classes = ['map-network-line', edge.active && 'is-active', edge.route && 'is-route', edge.answer && 'is-answer', step >= 0 && 'is-drawn'].filter(Boolean).join(' ');
      return `<path class="${classes}" d="M${x},${y} L${tx},${ty}" data-map-action="edge" data-id="${edge.id}" ${step >= 0 ? `pathLength="1" style="--i:${step}"` : ''}/>`;
    }).join('');
    stage.classList.toggle('is-ceremony', Boolean(payload.ceremony));
  }
  /** Name tags on the 2D table sit beside their own record, never over another record, another tag or
   *  the − 全图 + tools, so every tap lands on one singer. Where you stand, the goal and the selection are
   *  named first, then the records one tap away. A needed name (you, the goal, the selection) that finds
   *  no room beside its record steps out on a pencilled leader to the nearest free spot; the records one
   *  tap away may step out a little. Any other tag with no free spot waits hidden until its record is
   *  hovered or focused (the record keeps its full name for screen readers); zooming in makes room.
   *  Records never move: only where their tags lie changes. */
  function labelNodes(shown, width, height) {
    const HALF = 22; const DISC = 18; const GAP = 2;
    // A tag's paper stays this far clear of a face-down card's 44px square. Its invisible touch band may
    // reach a little further: a face-down card takes no taps, and the band never reaches the card itself.
    const CLEAR = 2;
    const stageBox = stage.getBoundingClientRect();
    const blocks = [];
    const tools = container.querySelector('.map-stage-top .map-network-tools');
    if (tools?.getClientRects().length) {
      const box = tools.getBoundingClientRect();
      if (box.bottom > stageBox.top && box.top < stageBox.bottom) blocks.push({ left: box.left - stageBox.left - 4, top: box.top - stageBox.top - 4, right: box.right - stageBox.left + 4, bottom: box.bottom - stageBox.top + 4 });
    }
    // Each record's square as drawn: a record is a 44px button; a face-down card may be drawn smaller.
    const discs = shown.map(item => { const half = item.node.offsetWidth / 2 || HALF; return { item, live: !item.node.classList.contains('is-unknown'), box: { left: item.x - half, top: item.y - half, right: item.x + half, bottom: item.y + half } }; });
    const hits = (a, b) => a.left < b.right + GAP && a.right > b.left - GAP && a.top < b.bottom + GAP && a.bottom > b.top - GAP;
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    // Does the segment from (ax,ay) to (bx,by) pass through the box? (Liang–Barsky clipping.)
    const crosses = (ax, ay, bx, by, box) => {
      let t0 = 0; let t1 = 1; const dx = bx - ax; const dy = by - ay;
      for (const [p, q] of [[-dx, ax - box.left], [dx, box.right - ax], [-dy, ay - box.top], [dy, box.bottom - ay]]) {
        if (!p) { if (q < 0) return false; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return false; t0 = Math.max(t0, r); } else { if (r < t0) return false; t1 = Math.min(t1, r); }
      }
      return true;
    };
    const rank = point => point.current || point.target ? 5 : point.selected ? 4 : point.highlighted || point.route ? 3 : point.adjacent ? 2 : point.visited ? 1 : 0;
    const labelled = shown.map(item => ({ ...item, label: item.node.querySelector('.map-network-node__label') })).filter(item => item.label)
      .sort((a, b) => rank(b.point) - rank(a.point) || (b.point.count || 0) - (a.point.count || 0) || a.slot - b.slot);
    // A tag's size is fixed for this drawing of the table: read once, before any tag moves.
    labelled.forEach(item => {
      let size = labelSizes.get(item.label);
      if (!size) {
        const h = item.label.offsetHeight;
        const paper = Math.max(0, ...[...item.label.children].map(child => child.offsetHeight));
        size = { w: item.label.offsetWidth, h, band: Math.max(0, (h - (paper || h)) / 2) };
        // Until the type has loaded a tag can still change width.
        if (document.fonts?.status !== 'loading') labelSizes.set(item.label, size);
      }
      Object.assign(item, size);
    });
    // Where one tag may sit, given the tags already placed: the first free spot beside its record, then
    // (on a leader) the nearest free spot within reach. Pure: nothing moves until the arrangement is chosen.
    function place(item, taken) {
      const { x, y, w, h, band } = item;
      const lean = DISC * .62;
      const standing = rank(item.point);
      // [left, top, how far the spot stands off its record]
      const spots = [
        [x - w / 2, y + DISC + 2 - band, 0], [x - w / 2, y - DISC - 2 - h + band, 0],
        [x + DISC + 4, y - h / 2, 0], [x - DISC - 4 - w, y - h / 2, 0],
        [x + lean, y + lean - band, 0], [x - lean - w, y + lean - band, 0],
        [x + lean, y - lean - h + band, 0], [x - lean - w, y - lean - h + band, 0],
      ];
      // Further out on a pencilled leader: any spot on a 4px grid within reach of the record, nearest
      // first, so the leader is as short as the table allows. A needed name may go anywhere on the table
      // rather than cover a record; the records one tap away step out a little; the rest stay beside theirs.
      // A round's way so far (and a revealed answer) stays named like the needed names: the singers already
      // visited are what the player steers by, and they are few.
      const kept = standing >= 3;
      const reach = kept ? Math.max(width, height) : standing >= 2 ? 36 : 0;
      if (reach) {
        const far = [];
        // Only the window the reach can touch: the rest of the table is never nearer than `reach`.
        const top0 = Math.max(2 - band, y - DISC - reach - h + band); const top1 = Math.min(height - 2 - h + band, y + DISC + reach - band);
        const left0 = Math.max(2, x - DISC - reach - w); const left1 = Math.min(width - 2 - w, x + DISC + reach);
        for (let top = top0; top <= top1; top += 4) for (let left = left0; left <= left1; left += 4) {
          const sx = Math.min(Math.max(x, left), left + w); const sy = Math.min(Math.max(y, top + band), top + h - band);
          const off = Math.hypot(x - sx, y - sy) - DISC;
          if (off >= 2 && off <= reach) far.push([left, top, off]);
        }
        spots.push(...far.sort((a, b) => a[2] - b[2]));
      }
      const candidates = spots.map(([left, top, far]) => ({ left, top, right: left + w, bottom: top + h, far }));
      const paperOf = box => ({ left: box.left, right: box.right, top: box.top + band - CLEAR, bottom: box.bottom - band + CLEAR });
      const inside = box => box.left >= 2 && box.top + band >= 2 && box.right <= width - 2 && box.bottom - band <= height - 2;
      const others = discs.filter(disc => disc.item.slot !== item.slot);
      const clashes = box => {
        const paper = paperOf(box);
        let count = others.filter(disc => hits(disc.live ? box : paper, disc.box)).length + taken.filter(other => hits(box, other)).length + blocks.filter(block => hits(box, block)).length;
        if (box.far && !count) {
          const line = leaderOf(item, box);
          count += others.filter(disc => disc.live && crosses(line.sx, line.sy, line.ex, line.ey, disc.box)).length + taken.filter(other => crosses(line.sx, line.sy, line.ex, line.ey, other.paper)).length;
        }
        return count;
      };
      const free = candidates.find(box => inside(box) && !clashes(box));
      if (free) return { spot: { ...free, paper: paperOf(free) }, free: true, first: candidates[0] };
      if (!kept) return { spot: null, free: false, first: candidates[0] };
      // Where you stand, the goal, the selection and a round's way so far keep a tag even on a table with no free spot at all:
      // the spot whose paper covers the least of the other records and tags.
      const covered = box => {
        const paper = paperOf(box); const line = box.far ? leaderOf(item, box) : null;
        const crossed = line ? others.filter(disc => disc.live && crosses(line.sx, line.sy, line.ex, line.ey, disc.box)).length : 0;
        return others.reduce((sum, disc) => sum + overlap(paper, disc.box) * (disc.live ? 3 : 1), 0) + taken.reduce((sum, other) => sum + overlap(box, other) * 4, 0) + crossed * 600 + box.far * 2;
      };
      let least = Infinity; let spot = null;
      for (const box of candidates) { if (!inside(box)) continue; const cost = covered(box); if (cost < least) { least = cost; spot = box; } }
      return { spot: spot && { ...spot, paper: paperOf(spot) }, free: false, first: candidates[0] };
    }
    // The leader runs from the paper's nearest edge to the record's rim.
    function leaderOf({ x, y, band }, box) {
      const sx = Math.min(Math.max(x, box.left), box.right); const sy = Math.min(Math.max(y, box.top + band), box.bottom - band);
      const length = Math.hypot(x - sx, y - sy);
      return { sx, sy, ex: x + (sx - x) * DISC / (length || 1), ey: y + (sy - y) * DISC / (length || 1), length };
    }
    const arrange = order => {
      const taken = []; const placed = new Map(); let misses = 0; let reach = 0;
      for (const item of order) {
        const result = place(item, taken);
        if (result.spot) taken.push(result.spot);
        placed.set(item, result);
        if (!result.free) misses += 1;
        reach += result.spot?.far || 0;
      }
      return { taken, placed, misses, reach };
    };
    // The needed names go first. The first one placed can take the only room another needed: when one of
    // them finds no free spot, every other order is tried (at most three names) and the one that leaves
    // fewest names over a record, then the shortest leaders, is kept. Not while the table is dragged.
    const needed = labelled.filter(item => rank(item.point) >= 4);
    let best = arrange(needed);
    if (best.misses && needed.length > 1 && !drag?.moved) {
      const orders = needed.length === 2 ? [[needed[1], needed[0]]] : [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(order => order.map(index => needed[index]));
      for (const order of orders) {
        const tried = arrange(order);
        if (tried.misses < best.misses || (tried.misses === best.misses && tried.reach < best.reach)) best = tried;
        if (!best.misses) break;
      }
    }
    const { taken, placed } = best;
    for (const item of labelled) if (!placed.has(item)) {
      const result = place(item, taken);
      if (result.spot) taken.push(result.spot);
      placed.set(item, result);
    }
    for (const item of labelled) {
      const { x, y } = item; const { spot, first } = placed.get(item);
      item.node.classList.toggle('is-unlabelled', !spot);
      const at = spot || first;
      item.label.style.transform = `translate(${Math.round(at.left - (x - HALF))}px,${Math.round(at.top - (y - HALF))}px)`;
      // A tag that stands clear of its record is tied to it; one right beside it needs no leader.
      const leader = (spot?.far || 0) > 6;
      item.label.classList.toggle('has-leader', leader);
      if (leader) {
        const line = leaderOf(item, at);
        item.label.style.setProperty('--leader-x', `${(line.sx - at.left).toFixed(1)}px`);
        item.label.style.setProperty('--leader-y', `${(line.sy - at.top).toFixed(1)}px`);
        item.label.style.setProperty('--leader-length', `${Math.max(0, line.length - DISC - 1).toFixed(1)}px`);
        item.label.style.setProperty('--leader-angle', `${Math.atan2(y - line.sy, x - line.sx).toFixed(3)}rad`);
      }
    }
  }

  // 留下的歌 can change in another tab. A round follows it; a roam answers from its own list.
  const unsubscribeSavedMusic = subscribeSavedMusic(() => {
    const map = api.getState().map;
    container.querySelectorAll('[data-map-saved-count]').forEach(count => {
      const session = sessionById(map, count.dataset.mapSavedCount);
      if (session) count.textContent = String(currentSavedSongs(session).length);
    });
    container.querySelectorAll('[data-map-action="save"]').forEach(control => {
      const song = songs[control.dataset.id];
      const owner = sessionById(map, control.dataset.session);
      if (song?.dataset !== 'real' || !owner) return;
      const saved = songIsSaved(owner, song.id);
      control.classList.toggle('is-saved', saved);
      control.setAttribute('aria-pressed', String(saved));
      control.setAttribute('aria-label', `${saved ? '移除' : '留下'}《${song.title}》`);
      control.title = saved ? '已留下，点击移除' : '留下这首作品';
      control.innerHTML = control.classList.contains('map-setlist__save') ? `${api.icon(saved ? 'check' : 'plus')}<span>${saved ? '已留下' : '留下'}</span>` : `${api.icon(saved ? 'check' : 'plus')}${control.classList.contains('map-track__save') ? '' : saved ? ' 已留下' : ' 留下作品'}`;
    });
  });

  // A roam's toast and undo slip ride just above its dock (see --map-roam-clear in map-spatial.css).
  const roamDock = recordsOnly ? null : container.querySelector('.map-atlas--roam .map-studio-dock');
  const undoSlip = roamDock ? container.querySelector('.map-atlas--roam>.map-undo') : null;
  const clearDock = () => {
    const top = roamDock?.isConnected ? roamDock.getBoundingClientRect().top : 0;
    if (top > 0) document.documentElement.style.setProperty('--map-roam-clear', `${Math.round(window.innerHeight - top + 10)}px`);
    // Where a centred toast could reach the slip, it steps up by the slip's height (map-spatial.css).
    if (undoSlip?.isConnected) document.documentElement.style.setProperty('--map-undo-lift', `${Math.round(undoSlip.offsetHeight + 8)}px`);
  };
  const dockWatch = roamDock ? new ResizeObserver(clearDock) : null;
  if (roamDock) { dockWatch.observe(roamDock); window.addEventListener('resize', clearDock, { signal }); clearDock(); }

  // A drag at full-table zoom can slide the record you stand on off the paper, and its 你在这里 tag
  // with it. In a roam the table then eases back to the whole view, so where you stand stays in sight.
  // (A zoomed-in table is left where the player took it.)
  const world = recordsOnly ? null : document.getElementById('sakura-world');
  if (world) {
    let tableGesture = null;
    world.addEventListener('pointerdown', event => { tableGesture = { x: event.clientX, y: event.clientY, moved: false }; }, { signal, capture: true });
    window.addEventListener('pointermove', event => {
      if (tableGesture && Math.hypot(event.clientX - tableGesture.x, event.clientY - tableGesture.y) > 5) tableGesture.moved = true;
    }, { signal, passive: true });
    const settleTable = () => {
      const moved = tableGesture?.moved; tableGesture = null;
      if (!moved || document.body.classList.contains('spatial-fallback')) return;
      // Read once the scene has drawn the table where the drag left it.
      setTimeout(() => {
        if (signal.aborted || !isFreeRoam(activeSession(api.getState().map))) return;
        const zoom = world.querySelector('[data-music-zoom]')?.dataset.musicZoom;
        const anchor = world.querySelector('.world-music-label--node.is-current');
        if (zoom === '1.00' && anchor?.hidden) api.spatial?.musicControl('fit');
      }, 120);
    };
    window.addEventListener('pointerup', settleTable, { signal });
    window.addEventListener('pointercancel', settleTable, { signal });
  }

  if (stage && !recordsOnly) redrawTable = positionNodes;
  return () => {
    if (redrawTable === positionNodes) redrawTable = null;
    dockWatch?.disconnect();
    unsubscribeSavedMusic();
    abort.abort();
    clearTimeout(ceremonyTimer);
    resize?.disconnect();
    if (dialog?.open) dialog.close();
  };
}

/** Entry hooks for the courtyard home and shared links, applied once when the shop opens.
 *  {resumeSessionId} continues a record; {artistId,newSession} starts a roam from a real singer;
 *  {round:'next'} deals the next preset 寻声; {round:{start,target}} deals that pair when it can be played. */
function applyEntry(api, payload) {
  const state = api.getState();
  const map = state.map;
  if (payload.resumeSessionId) {
    const original = sessionById(map, payload.resumeSessionId);
    api.update(next => {
      if (original) {
        activateSession(next.map, original);
        if (!isClosed(original)) original.status = 'active';
        original.updated = Date.now();
      }
      next.map.view.panel = null;
      next.map.view.reviewId = null;
      next.routePayload = null;
    });
    if (!original) api.toast('原探索记录已删除，保留当前探索。');
    return;
  }
  if (payload.round === 'next') {
    // A dealt round nobody touched is the one the home slip advertised: open it rather than deal past it.
    const waiting = waitingRound(map);
    api.update(next => {
      if (waiting) {
        const shelved = sessionById(next.map, waiting.id);
        shelved.returnRoamId = roamToReturnTo(next.map, sessionDataset(shelved)) || shelved.returnRoamId || null;
        activateSession(next.map, shelved);
        Object.assign(next.map.view, { panel: null, reviewId: null, selectedArtistId: waiting.start, selectedEdgeId: null });
        fitTableOnMount = true;
      } else openNextRound(next.map, 'real');
      next.routePayload = null;
    });
    const dealt = activeSession(api.getState().map);
    if (isRound(dealt)) api.toast(`${waiting ? '' : '新的一局：'}${artistName(dealt.start)} → ${artistName(dealt.target)}，隔着几首歌？`);
    return;
  }
  if (payload.round && typeof payload.round === 'object') {
    const { start, target } = payload.round;
    // A friend's link (?from=&to=) carries only the pair; anything else in it is never read.
    const friend = Boolean(payload.fromFriend);
    const known = artistById[start]?.dataset === 'real' && artistById[target]?.dataset === 'real';
    const error = known ? roundError(start, target, 'real') : '这道寻声题里的歌手不在本专题收录范围内。';
    if (error) {
      const why = !known ? '里面的歌手不在本专题收录范围内' : start === target ? '起点和终点是同一位歌手' : '本专题收录的合唱还连不通这两位';
      api.update(next => { next.routePayload = null; });
      api.toast(friend ? `朋友的题目链接打不开：${why}。先在唱片店逛逛吧。` : `开不了这一局：${error}`);
      return;
    }
    // Opening the same link twice continues the round already on the table.
    const same = [...map.sessions].reverse().find(session => isRound(session) && session.status === 'active' && session.start === start && session.target === target);
    api.update(next => {
      if (same) {
        const shelved = sessionById(next.map, same.id);
        activateSession(next.map, shelved);
        // The same pair from a friend's link: the round on the table becomes the friend's puzzle.
        if (friend) shelved.friend = { at: shelved.friend?.at || Date.now(), dismissed: false };
        Object.assign(next.map.view, { panel: null, reviewId: null, ceremony: null });
        fitTableOnMount = true;
      } else startRound(next.map, start, target, friend);
      next.routePayload = null;
    });
    api.toast(friend ? `朋友的题摆上桌了：从${artistName(start)}出发，先翻开一首合唱` : `${same ? '继续这一局：' : '新的一局：'}${artistName(start)} → ${artistName(target)}，隔着几首歌？`);
    return;
  }
  if (payload.artistId) {
    const id = payload.artistId;
    if (artistById[id]?.dataset !== 'real') {
      api.update(next => { next.routePayload = null; });
      if (id) api.toast('这位歌手不在本专题收录范围内，先从唱片店看看吧。');
      return;
    }
    const current = activeSession(map);
    const already = !payload.newSession && isFreeRoam(current) && currentNode(current).id === id;
    const confirm = !already && roamNeedsConfirm(current);
    api.update(next => {
      if (confirm) Object.assign(next.map.view, { pendingStart: id, panel: 'replace', reviewId: current.id });
      else if (!already) startRoam(next.map, id);
      else next.map.view.panel = null;
      next.routePayload = null;
    });
    if (!already && !confirm) api.toast(roamStartToast(id));
    return;
  }
  api.update(next => { next.routePayload = null; });
}

/** An undo made on the other page (or one no longer live) is let go when this page is drawn. */
function dropStaleUndo(api, page) {
  const map = api.getState().map;
  if (map.undo && !liveUndo(map, page)) api.update(state => { state.map.undo = null; });
}

export function mountMap(container, api) {
  prepareStoredMap(api);
  dropStaleUndo(api, 'explore');
  if (leftExplore) { leftExplore = false; if (api.getState().map.view.inspectorOpen) api.update(state => { state.map.view.inspectorOpen = false; }); }
  const payload = api.getState().routePayload;
  if (payload && typeof payload === 'object') applyEntry(api, payload);
  // A ceremony interrupted by a reload or a route change must not strand the page without its recap.
  const ceremony = api.getState().map.view.ceremony;
  if (ceremony && (Date.now() - ceremony.token > 6000 || ceremony.sessionId !== api.getState().map.activeId)) {
    api.update(state => {
      const owner = sessionById(state.map, ceremony.sessionId);
      state.map.view.ceremony = null;
      if (owner && isClosed(owner) && state.map.activeId === owner.id && !state.map.view.panel) { state.map.view.panel = 'recap'; state.map.view.reviewId = owner.id; }
    });
  }
  const session = activeSession(api.getState().map);
  const presentedArtist = session ? currentNode(session).id : null;
  const presentation = lastPresentedArtist === null ? 'entry' : lastPresentedArtist !== presentedArtist ? 'focus' : 'quiet';
  lastPresentedArtist = presentedArtist;
  if (presentation === 'focus') fallbackRecentre = true;
  container.innerHTML = mapHTML(api.getState().map, api, presentation);
  const cleanup = attachInteractions(container, api, false);
  // A redraw remounts synchronously; only a real route change leaves the shop.
  return () => { cleanup(); queueMicrotask(() => { if (!document.querySelector('.map-studio')) leftExplore = true; }); };
}

export function mountMapRecords(container, api) {
  prepareStoredMap(api);
  dropStaleUndo(api, 'records');
  container.innerHTML = recordsHTML(api.getState().map, api);
  return attachInteractions(container, api, true);
}

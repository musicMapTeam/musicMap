import { MAP_DATA_VERSION, catalogues, artistById, songs, edges, artistName, datasetForArtist, artistsInDataset, otherArtist, getNeighbors, isReachable } from './map-data.js';
import { getSavedMusic, toggleSavedMusic, saveMusic, importSavedMusic, subscribeSavedMusic } from './music-library.js';
import '../css/map.css';
import { networkEdges, networkLayout, shortestChain, shortestChains, roundKnowledge, distancesFrom, roundHint, chainLength, roundEdge } from './map-network.js';

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
const prefersReducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const songTitle = edge => edge?.song ? songs[edge.song]?.title : edge?.reason;
const hintLabels = { 1: '提示 · 还隔几首', 2: '提示 · 往哪翻', 3: '揭晓答案' };
const SEALED_TOAST = '这张还盖着：在你所在的唱片翻开合作，才会认出 TA';
let lastPresentedArtist = null;
const fallbackViews = new Map();
// A one-render cue for hand/scene motion (flip, target flash). Never persisted.
let handMotion = null;
// The hinted card is scrolled into view once per hint, not on every redraw.
let lastHintReveal = null;
// The atlas connection list starts folded each time the record shop is entered.
let leftExplore = true;

function songDraft(song) {
  return { id: song.id, title: song.title, artists: song.artists.map(artistName), source: song.sourceUrl || '', dataset: 'real' };
}

function songIsSaved(session, id) {
  return songs[id]?.dataset === 'real' ? getSavedMusic().some(item => item.id === id) : session.saved.some(item => item.id === id);
}

function currentSavedSongs(session) {
  if (sessionDataset(session) !== 'real') return session.saved;
  const savedIds = new Set(getSavedMusic().map(track => track.id));
  return session.saved.filter(item => savedIds.has(item.id));
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
    sessions: [initial], activeId: initial.id, undo: null, roundsIntroduced: 1,
    lastSessionByDataset: { real: initial.id },
    view: { panel: null, reviewId: null, query: '', selectedArtistId: start, challengeStart: start, challengeEnd: target, challengeError: '', ceremony: null, roundCursor: { real: 0, fictional: 0 } },
  };
}

function activateSession(map, session) {
  if (map.activeId !== session.id) {
    map.view.selectedArtistId = currentNode(session).id;
    map.view.selectedEdgeId = null;
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

function startRound(map, start, target) {
  const current = activeSession(map);
  const dataset = datasetForArtist(start);
  const sameCatalogue = current && sessionDataset(current) === dataset;
  const returnRoamId = !sameCatalogue ? null : current.type === 'roam' ? current.id : current.returnRoamId || null;
  const round = createSession(start, 'challenge', target, returnRoamId, true);
  map.sessions.push(round);
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

// v1 stored sessions contain only the original fictional IDs. Keep their paths,
// songs and version unchanged; the dataset field identifies their own catalogue.
// 0.15: an untouched default roam (never walked, nothing kept) becomes the default round once.
function prepareStoredMap(api) {
  const map = api.getState().map;
  if (map.lastSessionByDataset && map.sessions.every(session => session.dataset) && map.roundsIntroduced && !('networkQuery' in map.view) && map.view.roundCursor) return;
  api.update(state => {
    const stored = state.map;
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

function catalogueSwitchHTML(dataset) {
  return `<div class="map-catalogue"><div class="map-catalogue__switch" role="group" aria-label="选择音乐图谱">${Object.values(catalogues).map(item => button('dataset', item.id === 'real' ? '真实合作' : '情景示例', item.id === dataset ? 'is-active' : '', `data-dataset="${item.id}" aria-pressed="${item.id === dataset}"`)).join('')}</div></div>`;
}

/** `fogged`: during a 寻声 round the production credits stay closed. They can name artists the
 *  player has not met yet (a recording engineer, a lyricist), so they open with the setlist. */
function tracksHTML(session, trackIds, api, source = '', showVersion = false, showCredits = false, fogged = false) {
  return trackIds.map((id, index) => {
    const song = songs[id];
    if (!song) return '';
    const saved = songIsSaved(session, id);
    const creditLink = song.credits?.length && !fogged;
    return `<div class="map-track">
      <span class="map-track__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="map-track__copy">${creditLink ? button('credits', `${escapeHTML(song.title)}<span aria-hidden="true">↗</span>`, 'map-track__title', `data-id="${id}" data-session="${session.id}" aria-label="查看《${escapeHTML(song.title)}》的作品署名"`) : `<strong>${escapeHTML(song.title)}</strong>`}<span>${song.artists.map(artistName).map(escapeHTML).join(' / ')}</span>${showVersion && (song.recordingLabel || song.versionLabel) ? `<small>${escapeHTML(song.recordingLabel || song.versionLabel)}</small>` : !showVersion && song.creditSummary ? `<small class="map-track__credit-preview">${escapeHTML(song.creditSummary)}</small>` : ''}</div>
      <div class="map-track__actions">${listenHTML(song, api)}${song.dataset === 'real' ? button('take-song', '带到现场', 'button button--quiet map-track__take', `data-id="${id}" data-session="${session.id}" aria-label="把《${escapeHTML(song.title)}》带到现场"`) : ''}${button('save', api.icon(saved ? 'check' : 'plus'), `icon-button map-track__save ${saved ? 'is-saved' : ''}`, `data-id="${id}" data-session="${session.id}" data-source="${escapeHTML(source)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》" aria-pressed="${saved}" title="${saved ? '已留下，点击移除' : '留下这首作品'}"`)}</div>
    </div>${showCredits && !fogged ? creditsHTML(song, api) : ''}`;
  }).join('');
}

function undoHTML(map, api) {
  return map.undo ? `<div class="map-undo" role="status"><span>已移除《${escapeHTML(songs[map.undo.item.id]?.title)}》</span>${button('undo', '撤销', 'button button--quiet')}</div>` : '';
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
  const summary = fog ? `唱片桌：已认识 ${known} 张，${layout.length - known} 张还盖着` : round ? `唱片桌：${layout.length} 张已全部翻开` : `完整音乐关系网，${layout.length} 位艺人`;
  return `<div class="map-stage map-network-fallback" data-map-stage tabindex="0" role="group" aria-label="${summary}。可用方向键平移，加减号缩放">
    <svg class="map-graph-lines" data-map-lines aria-hidden="true"></svg>
    ${layout.map((item, index) => {
      if (fog && !knowledge.known.has(item.id)) return `<span class="map-network-node is-unknown" data-slot="${index}" aria-hidden="true"><i></i><strong>?</strong></span>`;
      const tag = item.id === target ? '<small>终点</small>' : round && item.id === here ? '<small>你在这里</small>' : '';
      const classes = ['map-network-node', item.id === selectedId && 'is-selected', round && item.id === here && 'is-current', item.id === target && 'is-target'].filter(Boolean).join(' ');
      return button('select', `<i style="--node-tone:${item.color}"></i><strong>${escapeHTML(item.name)}</strong>${tag}`, classes, `data-id="${item.id}" data-slot="${index}" aria-label="${item.id === target ? '终点：' : ''}${escapeHTML(item.name)}${round && item.id === here ? '，你在这里' : ''}" aria-pressed="${item.id === selectedId}"`);
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
  return `<section class="map-round-hand${dead ? ' is-dead-end' : ''}" aria-label="${escapeHTML(artist.name)}的合作手牌">
    <div class="map-round-hand__who">
      <span class="map-round-hand__stamp" style="--node-tone:${artist.color}" aria-hidden="true"><i></i></span>
      <div><h2>${escapeHTML(artist.name)}</h2><span>本专题 ${hand.length} 首合作 · 已翻开 ${opened}</span></div>
    </div>
    <ol class="map-round-hand__cards" data-node="${here}" aria-label="${escapeHTML(artist.name)}的 ${hand.length} 首合作">${hand.map((edge, index) => roundCardHTML(session, edge, knowledge, api, index, stub, motion)).join('')}${dead ? `<li class="map-round-hand__dead" role="note"><strong>死胡同</strong>这是${escapeHTML(artist.name)}在本专题唯一的合唱。退一步，换条路。</li>` : ''}${!knowledge.flipped.size && session.path.length === 1 ? '<li class="map-round-hand__tip" role="note"><strong>怎么玩</strong>翻开一首，才知道 TA 和谁合唱；沿翻开的歌「前往」，才算走一步。</li>' : ''}</ol>
    <div class="map-round-route">
      ${button('back', `${api.icon('arrow-left')}<span>退一步</span>`, `button ${dead || backHint ? 'button--primary' : 'button--quiet'} map-round-route__back${backHint ? ' is-hinted' : ''}`, `aria-label="退一步：返回上一位并撤销一步${backHint ? '（提示：回去更近）' : ''}" ${canBack ? '' : 'disabled'}`)}
      ${button('reset', api.icon('rotate'), 'icon-button map-round-route__reset', `aria-label="回到起点" ${canBack ? '' : 'disabled'}`)}
      ${canBack ? `<div class="map-round-route__trail map-route-trail" aria-label="当前路线，第 ${session.path.length - 1} 步">${trail}</div>` : ''}
    </div>
  </section>`;
}

function roundClosedBarHTML(session, api) {
  const steps = session.path.length - 1;
  const arrived = session.status === 'complete';
  const trail = session.path.map(step => escapeHTML(artistName(step.id))).join('<i aria-hidden="true">→</i>');
  return `<section class="map-round-hand map-round-hand--closed" aria-label="本局结果">
    <div class="map-round-hand__who"><span class="map-round-seal${arrived ? '' : ' is-revealed'}" aria-hidden="true">${arrived ? '抵达' : '揭晓'}</span><div><h2>${arrived ? `已抵达 · ${steps} 步` : '已揭晓'}</h2><span class="map-round-hand__trail">${trail}</span></div></div>
    <div class="map-round-hand__done">${button('round-next', `再来一局 ${api.icon('arrow-right')}`, 'button button--primary')}${button('recap', '连线歌单', 'button button--quiet', `data-session="${session.id}"`)}${button('return-roam', '完整图鉴', 'button button--quiet', `data-session="${session.id}"`)}</div>
  </section>`;
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
  const eyebrow = `寻声 · ${isReal ? catalogue.label : '情景示例 · 虚构'}${session.status === 'complete' ? ' · 已抵达' : session.status === 'revealed' ? ' · 已揭晓' : ''}`;
  const status = closed
    ? session.status === 'complete'
      ? `<span>${steps} 步抵达</span><span>本专题最短 ${best} 首</span>`
      : `<span>你停在${escapeHTML(artistName(here))}（${steps} 步）</span><span>本专题最短 ${best} 首</span>`
    : `<span>第 ${steps} 步</span><span>认识 ${known}/${layout.length}</span><span>翻开 ${flippedInCatalogue(session, knowledge)}/${links.length}</span>${distance ? `<b class="map-round-remaining">还隔 ${distance.get(here)} 首</b>` : ''}`;
  const level = hintLevel(session);
  const hintButton = !closed ? button('hint', `${level === 3 ? '' : '<i aria-hidden="true">?</i>'}${hintLabels[level]}`, `button map-round-hint${level === 3 ? ' is-final' : ''}`, `aria-label="${level === 1 ? '提示第一级：还隔几首' : level === 2 ? '提示第二级：往哪翻' : '提示第三级：揭晓答案'}"`) : '';
  const menu = menuHTML(api, [
    ['寻声', `${button('challenge', '自选起点和终点', 'button button--quiet')}${!closed ? button('reveal', '放弃并揭晓', 'button button--quiet') : ''}${closed ? button('recap', '连线歌单', 'button button--quiet', `data-session="${session.id}"`) : ''}`],
    ['图谱', `${button('return-roam', '完整图鉴<small>会显示全部合作</small>', 'button button--quiet map-menu-atlas', `data-session="${session.id}"`)}${catalogueSwitchHTML(dataset)}`],
    ['资料', `<button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('history', '探索记录', 'button button--quiet')}${button('space', `${isReal ? '去同场' : '示例现场'} ${api.icon('arrow-up-right')}`, 'button button--quiet', `title="${isReal ? '为自己的活动创建房间，可返回这次探索' : '回声现场 · 虚构情景'}"`)}`],
    ['视野', zoomToolsHTML(api), 'map-menu-zoom'],
  ]);
  const question = `<span class="is-from">${escapeHTML(artistName(session.start))}</span><i aria-hidden="true">→</i><span class="is-to">${escapeHTML(artistName(session.target))}</span><span class="map-round-slip__ask">，隔着几首歌？</span>`;
  return `<section class="map-experience map-studio map-round map-experience--${presentation}${closed ? ' is-closed' : ''}${ceremony ? ' is-ceremony' : ''}" aria-label="寻声：${escapeHTML(artistName(session.start))}到${escapeHTML(artistName(session.target))}">
    <header class="map-studio-head map-round-head">
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
    ${undoHTML(map, api)}
    ${panelHTML(map, api)}
  </section>`;
}

/* ---------- 完整图鉴（漫游与旧挑战） ---------- */

function atlasProgress(map, dataset) {
  const opened = new Set();
  map.sessions.filter(session => isRound(session) && sessionDataset(session) === dataset).forEach(session => roundKnowledge(session).flipped.forEach(id => opened.add(id)));
  return { opened: opened.size, total: networkEdges(dataset, 'co').length };
}

function atlasHTML(map, api, session, presentation) {
  const node = currentNode(session);
  const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const isReal = dataset === 'real';
  const relationUnit = session.mode === 'co' ? '次合作' : '条标签连接';
  const isChallenge = session.type === 'challenge';
  const isComplete = isClosed(session);
  const isEventArtist = ['a', 'b'].includes(node.id);
  const selectedId = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : node.id;
  const selectedArtist = artistById[selectedId];
  const selectedLinks = getNeighbors(selectedId, session.mode, dataset);
  const neighborOfCurrent = getNeighbors(node.id, 'co', dataset).some(edge => otherArtist(edge, node.id) === selectedId);
  const progress = atlasProgress(map, dataset);
  const liveRound = [...map.sessions].reverse().find(item => isRound(item) && sessionDataset(item) === dataset && item.status === 'active');
  const title = isChallenge ? '合作挑战' : '完整图鉴';
  const sub = isChallenge
    ? `${escapeHTML(artistName(session.start))} → ${escapeHTML(artistName(session.target))} · ${isComplete ? '已抵达' : '进行中'} · ${session.path.length - 1} 步`
    : session.mode === 'style' ? '策展标签 · 人工整理，不代表合作' : `你已亲手翻开 ${progress.opened}/${progress.total} 首合作`;
  const primary = isChallenge
    ? button('return-roam', '返回图鉴', 'button button--quiet', `data-session="${session.id}"`)
    : liveRound ? button('resume', `回到寻声 ${api.icon('arrow-right')}`, 'button button--primary map-atlas-play', `data-session="${liveRound.id}"`) : button('round-next', `开一局 ${api.icon('arrow-right')}`, 'button button--primary map-atlas-play');
  const menu = menuHTML(api, [
    ['图谱', `${catalogueSwitchHTML(dataset)}${catalogue.hasStyle ? `<div class="map-mode-switch" role="group" aria-label="关系类型">${button('mode', '合作', session.mode === 'co' ? 'is-active' : '', `data-mode="co" aria-pressed="${session.mode === 'co'}"`)}${button('mode', '策展标签', session.mode === 'style' ? 'is-active' : '', `data-mode="style" aria-pressed="${session.mode === 'style'}" ${isChallenge ? 'disabled' : ''}`)}</div>` : ''}`],
    ['寻声', `${button('round-next', '开一局寻声', 'button button--quiet')}${button('challenge', '自选起点和终点', 'button button--quiet')}`],
    ['资料', `<button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('relations', '连接与来源', 'button button--quiet')}${button('history', '探索记录', 'button button--quiet')}${isChallenge ? button('recap', isComplete ? '挑战结果' : '回顾路线', 'button button--quiet', `data-session="${session.id}"`) : button('finish', '结束并回顾', 'button button--quiet')}`],
    ['视野', zoomToolsHTML(api), 'map-menu-zoom'],
  ]);
  const roundTo = !isChallenge && session.mode === 'co' && selectedId !== node.id && !neighborOfCurrent && isReachable(node.id, selectedId, dataset);
  const open = map.view.inspectorOpen ?? false;
  return `<section class="map-experience map-studio map-atlas map-experience--${presentation}" aria-label="${title}">
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
      <div class="map-network-selection"><span class="map-network-stamp" style="--node-tone:${selectedArtist.color}" aria-hidden="true"><i></i></span><div><h2>${escapeHTML(selectedArtist.name)}</h2><span>${selectedLinks.length} ${relationUnit} <i>·</i> ${selectedArtist.songIds.length} 首作品${selectedId === node.id ? ' <i>·</i> 你在这里' : ''}</span></div><div class="map-network-selection__actions">${button('artist', `作品 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-id="${selectedId}"`)}${roundTo ? button('round-to', '和 TA 隔几首？', 'button button--quiet map-round-to', `data-id="${selectedId}" aria-label="开一局寻声：从${escapeHTML(artistName(node.id))}到${escapeHTML(selectedArtist.name)}，隔着几首歌？"`) : ''}${button('space', `${api.icon('users')} ${isReal ? '去同场' : isEventArtist ? '关联示例现场' : '示例现场'}`, 'button button--quiet map-space-link', `title="${isReal ? '为自己的活动创建房间，可返回这次探索' : '回声现场 · 虚构情景'}"`)}</div></div>
      <details class="map-network-index" data-map-index ${open ? 'open' : ''}><summary><span>${selectedLinks.length} 条连接</span><small>已走 ${session.path.length - 1} 步</small>${api.icon('chevron-right')}</summary><div class="map-network-index__body">
      <div class="map-network-neighbors" aria-label="${escapeHTML(selectedArtist.name)}的连接">${selectedLinks.map(edge => button('edge', `<span>${escapeHTML(artistName(otherArtist(edge, selectedId)))}</span><small>${escapeHTML(songTitle(edge))}</small>`, 'map-network-connection', `data-id="${edge.id}"`)).join('') || '<span class="map-inline-empty">暂未收录连接</span>'}</div>
      <div class="map-route-bar"><div class="map-route-controls">${button('back', api.icon('arrow-left'), 'icon-button', `aria-label="返回上一位${isChallenge ? '并撤销一步' : ''}" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}${button('reset', api.icon('rotate'), 'icon-button', `aria-label="回到起点" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}</div><div class="map-route-trail" aria-label="当前路线">${session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">→</span>')}</div>${button('recap', `${currentSavedSongs(session).length} 首收藏`, 'button button--quiet', `data-session="${session.id}" data-map-saved-count="${session.id}"`)}</div>
      </div></details>
    </div>
    ${undoHTML(map, api)}
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

/** 连线歌单：抵达或揭晓后的回顾。与双联票根共用纸张与票条语言。 */
function setlistHTML(session, api) {
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
    const actions = `${button('save', `${api.icon(saved ? 'check' : 'plus')}<span>${saved ? '已留下' : '留下'}</span>`, `button button--quiet map-setlist__save${saved ? ' is-saved' : ''}`, `data-id="${song.id}" data-session="${session.id}" data-source="从连线歌单留下" aria-pressed="${saved}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》"`)}${song.dataset === 'real' ? button('take-song', `带到现场 ${api.icon('arrow-up-right')}`, 'button button--quiet map-setlist__take', `data-id="${song.id}" data-session="${session.id}" aria-label="把《${escapeHTML(song.title)}》带到现场"`) : ''}`;
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
    ${ownRoute}
    <ol class="map-setlist${route.answer ? ' is-answer' : ''}" aria-label="${arrived ? '你的路线' : '本专题的一条最短路线'}">${stops}</ol>
    <dl class="map-setlist__stats">
      <div><dt>有效步数</dt><dd>${steps}</dd></div><div><dt>本专题最短</dt><dd>${best}</dd></div><div><dt>翻开</dt><dd>${flippedInCatalogue(session, knowledge)} 首</dd></div>
      <div><dt>认识</dt><dd>${known}/${layoutSize}</dd></div><div><dt>提示</dt><dd>${usedHints(session)} 次</dd></div><div><dt>实际前往</dt><dd>${session.events.filter(event => event.type === 'move').length} 次</dd></div>
    </dl>
    ${altHTML}
    ${timelineHTML(session, api, true)}
    <div class="map-panel-actions map-setlist__actions-bar">${button('round-next', `再来一局 ${api.icon('arrow-right')}`, 'button button--primary')}${songIds.length ? button('save-route', unsaved ? `留下这 ${songIds.length} 首` : `已留下这 ${songIds.length} 首`, 'button button--quiet map-setlist__save-route', `data-session="${session.id}" ${unsaved ? '' : 'aria-disabled="true"'}`) : ''}${button('return-roam', '看完整图鉴', 'button button--quiet', `data-session="${session.id}"`)}</div>
    <p class="map-setlist__note">${isReal ? '路线只来自本专题已核实的共同演唱录音；“最短”仅指本专题收录范围。无内置音频。' : '路线只来自虚构的示例合作，不代表真实演唱；“最短”仅指本示例图谱。情景示例为虚构，仅作交互演示。'}</p>`;
}

function recordRowHTML(session, api, compact = false) {
  const round = isRound(session);
  const knowledge = round ? roundKnowledge(session) : null;
  const type = round ? '寻声' : session.type === 'challenge' ? '挑战' : '漫游';
  const status = session.status === 'complete' ? '已抵达' : session.status === 'revealed' ? '已揭晓' : session.status === 'ended' ? '已结束' : '进行中';
  const detail = round ? `翻开&nbsp;${flippedInCatalogue(session, knowledge)}&nbsp;首 · 提示&nbsp;${usedHints(session)}&nbsp;次 · ${session.path.length - 1}&nbsp;步` : `${visitedArtists(session).length}&nbsp;位艺人 · ${currentSavedSongs(session).length}&nbsp;首留下 · ${session.path.length - 1}&nbsp;步`;
  return `<article class="map-record${compact ? ' map-record--compact' : ''}">
    <div class="map-record__disc" style="--node-tone:${artistById[session.start].color}" aria-hidden="true"><span>${String(session.path.length - 1).padStart(2, '0')}</span></div>
    <div class="map-record__copy"><span class="map-record__meta">${catalogueFor(session).label} · ${type} · ${status} · ${dateLabel(session.created)}</span><h3>${escapeHTML(artistName(session.start))}${session.target ? ` → ${escapeHTML(artistName(session.target))}` : '出发'}</h3><p>${detail}</p></div>
    <div class="map-record__actions">${button('recap', `回顾 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-session="${session.id}"`)}${!isClosed(session) ? button('resume', '继续', 'button button--quiet', `data-session="${session.id}"`) : ''}${button('delete', api.icon('trash'), 'icon-button', `data-session="${session.id}" aria-label="删除从${escapeHTML(artistName(session.start))}出发的记录"`)}</div>
  </article>`;
}

function panelHTML(map, api, recordsOnly = false) {
  const panel = map.view.panel;
  if (!panel || (recordsOnly && !['recap', 'delete', 'credits'].includes(panel))) return '';
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
  if (panel === 'challenge') content = `<span class="eyebrow">${isReal ? catalogue.label : '情景示例 · 虚构'}</span><h2>开一局寻声</h2><p class="map-panel-description">选好起点和终点，桌上只翻开这两张唱片。开局前不会告诉你答案。</p><form data-map-challenge-form><label class="map-field">起点<select name="start">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeStart === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><label class="map-field">终点<select name="target">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeEnd === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><p class="map-form-error" data-map-challenge-error role="alert">${escapeHTML(map.view.challengeError)}</p><button class="button button--primary" type="submit">开局 ${api.icon('arrow-right')}</button></form><p class="map-storage-note">翻开、提示不计步；沿翻开的合唱前往才算一步。仅使用本图谱已收录的共同演唱。</p>`;
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
      content = `<span class="eyebrow">寻声 · ${role}</span><h2>${escapeHTML(artist.name)}</h2>${shown.length ? tracksHTML(session, shown.map(edge => edge.song).filter(Boolean), api, `在寻声中留下`, true, true, fog) : ''}${fog && sealed ? `<p class="map-round-sealed-note">${id === session.target ? `终点的 ${sealed} 首合作还封着，不能从终点倒推。` : here ? `还有 ${sealed} 首封着，在下方手牌里翻开。` : `还有 ${sealed} 首封着，走到 TA 面前才能翻开。`}</p>` : ''}${!shown.length && !sealed ? '<p class="map-inline-empty">本专题暂未收录合作。</p>' : ''}`;
    } else content = `<span class="eyebrow">${catalogue.label} · ${isReal ? '入选合作' : '示例作品'}</span><h2>${escapeHTML(artist.name)}</h2>${id !== currentNode(session).id && session.type !== 'challenge' ? `<div class="map-panel-actions">${button('new', '从这里开始探索', 'button button--quiet', `data-id="${id}"`)}</div>` : ''}${tracksHTML(session, artist.songIds, api, `在${artist.name}的${isReal ? '入选合作作品' : '示例作品'}中留下`, true, true)}`;
  }
  if (panel === 'edge') {
    const edge = edges.find(item => item.id === map.view.selectedEdgeId && item.dataset === dataset && item.mode === (round ? 'co' : session.mode));
    if (edge && (!fog || knowledge.flipped.has(edge.id))) {
      const from = currentNode(session).id;
      const touchesCurrent = edge.a === from || edge.b === from;
      const next = touchesCurrent ? otherArtist(edge, from) : null;
      const canMove = next && !isClosed(session) && session.status !== 'ended';
      content = `<span class="eyebrow">${isReal ? '共同演唱' : modeName(edge.mode)}</span><h2 class="map-edge-title">${button('select', escapeHTML(artistName(edge.a)), 'map-edge-person', `data-id="${edge.a}"`)}<span>×</span>${button('select', escapeHTML(artistName(edge.b)), 'map-edge-person', `data-id="${edge.b}"`)}</h2>${edge.song ? tracksHTML(session, [edge.song], api, '从关系网中留下', true, true, fog) : `<p class="map-panel-description">${escapeHTML(edge.evidence)}</p>`}${evidenceHTML(edge, api)}${fog && songs[edge.song]?.credits?.length ? '<p class="map-round-sealed-note">完整制作署名在本局结束后的连线歌单里展开，以免提前认出还盖着的音乐人。</p>' : ''}<div class="map-panel-actions">${canMove ? button('move', `前往${escapeHTML(artistName(next))} ${api.icon('arrow-right')}`, 'button button--primary', `data-id="${next}" data-edge-id="${edge.id}"`) : session.type !== 'challenge' ? button('new', `从${escapeHTML(artistName(edge.a))}出发`, 'button button--quiet', `data-id="${edge.a}"`) : ''}</div>`;
    }
  }
  if (panel === 'credits') {
    const song = songs[map.view.creditSongId];
    const allowed = !fog;
    if (song?.credits?.length && allowed) content = `<div class="map-credit-heading"><span class="map-credit-disc" style="--credit-tone:${artistById[song.artists[0]].color}" aria-hidden="true"></span><div><span class="eyebrow">作品署名</span><h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.recordingLabel)}</p></div></div>${creditsHTML(song, api, true)}${fog ? '<p class="map-round-sealed-note">署名表按来源原样列出；非演唱署名不表示合唱。</p>' : ''}<div class="map-credit-bottom"><span>无内置音频</span>${button('take-song', '带到现场', 'button button--quiet', `data-id="${song.id}" data-session="${session.id}"`)}${button('save', `${api.icon(songIsSaved(session, song.id) ? 'check' : 'plus')} ${songIsSaved(session, song.id) ? '已留下' : '留下作品'}`, 'button button--quiet', `data-id="${song.id}" data-session="${session.id}" data-source="查看作品制作署名后留下" aria-pressed="${songIsSaved(session, song.id)}"`)}</div>`;
  }
  if (panel === 'relations' && !fog) {
    const id = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : currentNode(session).id;
    content = `<span class="eyebrow">${catalogue.label} · ${modeName(session.mode)}</span><h2>连接来源</h2><p class="map-panel-description">${isReal ? '图中连线表示共同演唱；每首作品可展开制作署名。' : '虚构示例，无音源。标签由人工整理。'}</p>${getNeighbors(id, session.mode, dataset).map(edge => `<section class="map-relation-proof"><div class="map-relation-title"><h3>${escapeHTML(artistName(id))} <span>↔</span> ${escapeHTML(artistName(otherArtist(edge, id)))}</h3>${button('edge', api.icon('arrow-up-right'), 'icon-button', `data-id="${edge.id}" aria-label="查看与${escapeHTML(artistName(otherArtist(edge, id)))}的连接"`)}</div>${edge.song ? tracksHTML(session, [edge.song], api, `通过${artistName(edge.a)}与${artistName(edge.b)}的合作作品留下`, true, true) : `<p>${escapeHTML(edge.evidence)}</p>`}${edge.dataset !== 'real' ? evidenceHTML(edge, api) : ''}</section>`).join('') || '<p class="map-inline-empty">本图谱暂无收录。</p>'}`;
  }
  if (panel === 'recap') {
    if (round && isClosed(session)) { content = setlistHTML(session, api); dialogClass = ' map-dialog--setlist'; }
    else content = round ? roundProgressHTML(session, api) : recapHTML(session, api);
  }
  if (panel === 'history') {
    const records = [...map.sessions].sort((a, b) => b.updated - a.updated);
    content = `<span class="eyebrow">仅存当前浏览器</span><h2>探索记录</h2><div class="map-record-list map-record-list--panel">${records.map(item => recordRowHTML(item, api, true)).join('') || '<p class="map-inline-empty">还没有探索记录。</p>'}</div>`;
  }
  if (panel === 'delete') content = `<h2>删除这次探索？</h2><p class="map-panel-description">将删除从${escapeHTML(artistName(session.start))}出发的路线、分支和作品清单，无法恢复。</p><div class="map-panel-actions">${button('delete-confirm', '删除记录', 'button button--primary', `data-session="${session.id}"`)}${button('close', '保留')}</div>`;
  if (panel === 'reset') content = `<h2>回到${escapeHTML(artistName(session.start))}？</h2><p class="map-panel-description">当前路线与步数归零${round ? '，已翻开的唱片保留' : '，作品清单和分支记录保留'}。</p><div class="map-panel-actions">${button('reset-confirm', '回到起点', 'button button--primary')}${button('close', '继续当前路线')}</div>`;
  if (!content) return '';
  const label = panel === 'recap' ? (round && isClosed(session) ? '连线歌单' : '探索回顾') : panel === 'challenge' ? '开一局寻声' : panel === 'reveal' ? '揭晓确认' : panel === 'history' ? '探索记录' : '音乐探索面板';
  return `<dialog class="map-dialog map-dialog--${panel}${dialogClass}" aria-label="${label}"><div class="map-dialog__top">${button('close', api.icon('x'), 'icon-button', 'aria-label="关闭面板"')}</div><div class="map-dialog__content">${content}${undoHTML(map, api)}</div></dialog>`;
}

function recordsHTML(map, api) {
  const records = [...map.sessions].sort((a, b) => b.updated - a.updated);
  const rows = records.map(session => recordRowHTML(session, api)).join('');
  return `<section class="map-records" aria-label="音乐探索记录"><div class="map-records-heading"><h2>探索记录</h2><span class="muted">${records.length} 次探索</span></div><div class="map-record-list">${rows || `<div class="empty-state"><h3>还没有探索记录</h3>${button('round-next', '开一局寻声', 'button button--primary')}</div>`}</div><p class="map-storage-note">仅存当前浏览器，清除浏览器数据会丢失。</p>${undoHTML(map, api)}${panelHTML(map, api, true)}</section>`;
}

function startRoam(map, id) {
  const previous = activeSession(map);
  if (previous?.type === 'roam' && previous.status === 'active') previous.status = 'ended';
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
  let ceremonyTimer = 0;
  const mutate = (fn, redraw = true, keepPosition = null) => {
    const previousDialog = container.querySelector('.map-dialog');
    const dialogScroll = previousDialog?.scrollTop || 0;
    const routeDetailsOpen = previousDialog?.querySelector('.map-route-details')?.open;
    const previousPanel = api.getState().map.view.panel;
    const hand = container.querySelector('.map-round-hand__cards');
    const handScroll = hand ? { node: hand.dataset.node, left: hand.scrollLeft } : null;
    const position = keepPosition && {
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
          const routeDetails = newDialog.querySelector('.map-route-details');
          if (routeDetails) routeDetails.open = Boolean(routeDetailsOpen);
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
  const showPanel = (panel, id = null) => mutate(map => {
    map.view.panel = panel;
    map.view.reviewId = id;
    if (panel === 'challenge') {
      const current = sessionById(map, id) || activeSession(map);
      const catalogue = catalogueFor(current);
      map.view.challengeError = '';
      if (datasetForArtist(map.view.challengeStart) !== catalogue.id) map.view.challengeStart = current ? currentNode(current).id : catalogue.rounds[0][0];
      if (datasetForArtist(map.view.challengeEnd) !== catalogue.id) map.view.challengeEnd = catalogue.rounds[0][1];
    }
  });
  const goExplore = () => api.navigate('explore');
  /** Fold the paper and hand focus back to the table's own controls rather than the page. */
  const closePanel = () => {
    mutate(state => { state.view.panel = null; });
    if (!recordsOnly) focusControl('.map-round-hand--closed [data-map-action="recap"]') || focusControl('.map-round-tools [data-map-action="hint"]') || focusControl('.map-studio-tools .button');
  };

  function back(reset = false) {
    const map = api.getState().map;
    const session = activeSession(map);
    if (!session || session.path.length < 2 || isClosed(session)) return;
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
    }
  }

  function runAction(control) {
    if (!control || !container.contains(control) || control.disabled || Date.now() < suppressClickUntil) return;
    const menu = control.closest('.map-shop-menu');
    if (menu) menu.open = false;
    performAction(control.dataset, control);
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
        positionNodes();
      } else api.spatial?.musicControl(action);
      return;
    }
    if (action === 'sealed') { api.toast(SEALED_TOAST); return; }
    if (action === 'select') {
      if (!session || datasetForArtist(id) !== dataset) return;
      if (fog && !knowledge.known.has(id)) { api.toast(SEALED_TOAST); return; }
      if (round) { mutate(state => { state.view.selectedArtistId = id; state.view.selectedEdgeId = null; state.view.panel = 'artist'; state.view.reviewId = session.id; }); return; }
      const fromSearch = map.view.panel === 'search';
      mutate(state => { state.view.selectedArtistId = id; state.view.selectedEdgeId = null; state.view.panel = null; state.view.reviewId = null; });
      if (fromSearch) performAction({ mapAction: 'focus' });
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
      showPanel(panelAction, sessionId || null);
      if (recordsOnly && ['search', 'challenge'].includes(panelAction)) goExplore();
      return;
    }
    switch (action) {
      case 'close': closePanel(); break;
      case 'dataset': {
        const next = data.dataset;
        if (!catalogues[next] || next === dataset) break;
        mutate(state => {
          if (session) activateSession(state, session);
          const remembered = sessionById(state, state.lastSessionByDataset?.[next]);
          const existing = remembered || [...state.sessions].reverse().find(item => sessionDataset(item) === next);
          if (existing) {
            activateSession(state, existing);
            if (existing.status === 'ended') existing.status = 'active';
            existing.updated = Date.now();
          } else {
            const [start, target] = roundPairs(next)[0];
            state.view.roundCursor ||= { real: 0, fictional: 0 };
            state.view.roundCursor[next] = 0;
            startRound(state, start, target);
          }
          state.view.panel = null;
          state.view.reviewId = null;
          state.view.query = '';
          state.view.challengeError = '';
          state.view.selectedArtistId = currentNode(activeSession(state)).id;
          state.view.selectedEdgeId = null;
        });
        api.toast(next === 'real' ? '真实合作精选：来自已核实的共同演唱录音' : '情景示例：虚构的艺人与关系，仅作交互演示');
        break;
      }
      case 'new':
        if (!artistById[id]) break;
        mutate(state => startRoam(state, id), false);
        goExplore();
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
        const targetDataset = catalogues[dataset] ? dataset : 'real';
        const wasRound = round && session.status === 'active';
        mutate(state => { openNextRound(state, targetDataset); });
        if (recordsOnly) goExplore();
        const next = activeSession(api.getState().map);
        api.toast(`${wasRound ? '上一局已存入记录。' : ''}新的一局：${artistName(next.start)} → ${artistName(next.target)}，隔着几首歌？`);
        focusControl('.map-round-card [data-map-action="flip"]');
        break;
      }
      case 'round-to': {
        if (!session || round || session.type !== 'roam' || session.mode !== 'co') break;
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
        api.toast(pending.length ? `已留下 ${pending.length} 首${sessionDataset(owner) === 'real' ? '，可在「我的收藏 · 音乐收藏」找到' : '（示例，仅存这次记录）'}` : '这几首都已留下');
        break;
      }
      case 'move': {
        if (!session || isClosed(session) || (round && session.status !== 'active')) break;
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
        });
        if (!round) break;
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
        const selectedSession = sessionById(map, sessionId);
        if (!selectedSession || !songs[id]) break;
        const real = songs[id].dataset === 'real';
        const previousLibraryEntry = real ? getSavedMusic().find(item => item.id === id) : null;
        let removed;
        try { removed = real ? !toggleSavedMusic(songDraft(songs[id])) : selectedSession.saved.some(item => item.id === id); }
        catch { api.toast('收藏还未保存，请检查浏览器存储空间后重试'); break; }
        mutate(state => {
          const selected = sessionById(state, sessionId);
          if (!selected || !songs[id]) return;
          const index = selected.saved.findIndex(item => item.id === id);
          if (removed) {
            const item = index >= 0 ? selected.saved[index] : { id, source: '在曲目收藏中留下', savedAt: previousLibraryEntry?.savedAt || Date.now() };
            if (!real && index >= 0) selected.saved.splice(index, 1);
            state.undo = { sessionId: selected.id, item, index: index >= 0 ? index : selected.saved.length, libraryTrack: previousLibraryEntry };
          } else {
            if (index < 0) selected.saved.push({ id, source: data.source || '在探索回顾中留下', savedAt: Date.now() });
            state.undo = null;
          }
          selected.updated = Date.now();
        }, true, { control });
        api.toast(removed ? '已移除，可撤销' : '已留下这首作品');
        break;
      }
      case 'undo': {
        const entry = map.undo;
        if (entry && songs[entry.item.id]?.dataset === 'real') {
          try { saveMusic(entry.libraryTrack || { ...songDraft(songs[entry.item.id]), savedAt: entry.item.savedAt }); }
          catch { api.toast('收藏还未恢复，请检查浏览器存储空间后重试'); break; }
        }
        mutate(state => {
          const undo = state.undo;
          const selected = undo && sessionById(state, undo.sessionId);
          if (selected && !selected.saved.some(item => item.id === undo.item.id)) {
            selected.saved.splice(undo.index, 0, undo.item);
            selected.updated = Date.now();
          }
          state.undo = null;
        }, true, { control, songId: entry?.item.id });
        api.toast('已恢复');
        break;
      }
      case 'finish':
        mutate(state => { const selected = activeSession(state); if (!selected || isRound(selected)) return; selected.status = 'ended'; selected.updated = Date.now(); state.view.panel = 'recap'; state.view.reviewId = selected.id; });
        break;
      case 'resume':
        mutate(state => { const selected = sessionById(state, sessionId); if (!selected) return; activateSession(state, selected); if (!isClosed(selected)) selected.status = 'active'; selected.updated = Date.now(); state.view.panel = null; state.view.reviewId = null; }, false);
        goExplore();
        break;
      case 'return-roam':
        mutate(state => {
          const selected = sessionById(state, sessionId) || activeSession(state);
          if (!selected || selected.type !== 'challenge') return;
          selected.updated = Date.now();
          const catalogue = sessionDataset(selected);
          const original = sessionById(state, selected.returnRoamId);
          const fallback = original && sessionDataset(original) === catalogue ? original : [...state.sessions].reverse().find(item => item.type === 'roam' && sessionDataset(item) === catalogue && item.status !== 'ended');
          if (fallback) { activateSession(state, fallback); fallback.status = 'active'; }
          else startRoam(state, currentNode(selected).id);
          state.view.panel = null;
          state.view.reviewId = null;
          state.view.ceremony = null;
        }, false);
        goExplore();
        break;
      case 'delete-confirm':
        mutate(state => {
          state.sessions = state.sessions.filter(item => item.id !== sessionId);
          Object.keys(state.lastSessionByDataset || {}).forEach(key => {
            if (state.lastSessionByDataset[key] === sessionId) delete state.lastSessionByDataset[key];
          });
          if (state.activeId === sessionId) {
            const fallback = [...state.sessions].reverse().find(item => item.type === 'roam') || [...state.sessions].reverse().find(item => isRound(item));
            if (fallback) activateSession(state, fallback);
            else state.activeId = null;
          }
          if (state.view.ceremony?.sessionId === sessionId) state.view.ceremony = null;
          if (state.undo?.sessionId === sessionId) state.undo = null;
          state.view.panel = null;
          state.view.reviewId = null;
        });
        api.toast('已删除这条记录');
        break;
      case 'take-song': {
        if (songs[id]?.dataset !== 'real') break;
        const original = sessionById(map, sessionId) || session;
        api.update(state => { state.space.mapReturnId = original?.id || null; });
        api.navigate('live', { intent: 'create-room', songDraft: songDraft(songs[id]), resumeSessionId: original?.id });
        break;
      }
      case 'space': {
        api.update(state => { state.space.mapReturnId = session?.id || null; });
        if (dataset === 'real') {
          const suggestion = getSavedMusic().find(track => track.dataset === 'real' && session.saved.some(item => item.id === track.id));
          const payload = { from: 'real-map', intent: 'create-room', resumeSessionId: session.id };
          if (suggestion) { const { savedAt, ...draft } = suggestion; payload.songDraft = draft; }
          api.navigate('live', payload);
        } else api.navigate('space', { showDemo: true });
        break;
      }
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
    const dataset = sessionDataset(activeSession(api.getState().map));
    const error = datasetForArtist(start) !== dataset || datasetForArtist(target) !== dataset ? '请选择当前图谱内的艺人。' : start === target ? '出发点和终点相同，换一位想遇见的艺人吧。' : !isReachable(start, target, dataset) ? '本专题已收录的合作关系尚未连通，请换个起点或终点。' : '';
    mutate(map => { map.view.challengeStart = start; map.view.challengeEnd = target; map.view.challengeError = error; }, false);
    if (error) { container.querySelector('[data-map-challenge-error]').textContent = error; return; }
    mutate(map => { startRound(map, start, target); }, false);
    goExplore();
    api.toast(`新的一局：${artistName(start)} → ${artistName(target)}，隔着几首歌？`);
  }, { signal });

  const dialog = container.querySelector('.map-dialog');
  if (dialog) {
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePanel(); }, { signal });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanel();
    }, { signal });
    const focusTarget = dialog.querySelector('input, select') || dialog.querySelector('.map-dialog__content [data-map-action]') || dialog.querySelector('button');
    focusTarget?.focus({ preventScroll: true });
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
  container.querySelectorAll('.map-route-trail').forEach(trail => { trail.scrollLeft = trail.scrollWidth; });
  const resize = stage ? new ResizeObserver(() => positionNodes()) : null;
  function fallbackView() {
    const session = activeSession(api.getState().map);
    const key = `${sessionDataset(session)}:${isRound(session) ? 'co' : session.mode}`;
    if (!fallbackViews.has(key)) fallbackViews.set(key, { x: 0, z: 0, zoom: 1 });
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
    positionNodes();
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
    const neighbors = new Set(getNeighbors(id, mode, dataset).filter(edge => !fog || knowledge.flipped.has(edge.id)).map(edge => otherArtist(edge, id)));
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
        active: edge.a === id || edge.b === id || edge.id === map.view.selectedEdgeId, visited: visitedEdges.has(edge.id), route: round && visitedEdges.has(edge.id), answer: answerEdges.has(edge.id), highlighted: false })),
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
      onMusic(action) { if (['select', 'edge', 'sealed', 'ceremony-done'].includes(action.action)) performAction({ mapAction: action.action, id: action.id }); },
    });
    const width = stage.clientWidth; const height = stage.clientHeight;
    if (!width || !height) return;
    const view = fallbackView(); const positions = new Map();
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
    });
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

  const unsubscribeSavedMusic = subscribeSavedMusic(tracks => {
    const savedIds = new Set(tracks.map(track => track.id));
    container.querySelectorAll('[data-map-saved-count]').forEach(control => {
      const session = sessionById(api.getState().map, control.dataset.mapSavedCount);
      if (session) control.textContent = `${currentSavedSongs(session).length} 首收藏`;
    });
    container.querySelectorAll('[data-map-action="save"]').forEach(control => {
      const song = songs[control.dataset.id];
      if (song?.dataset !== 'real') return;
      const saved = savedIds.has(song.id);
      control.classList.toggle('is-saved', saved);
      control.setAttribute('aria-pressed', String(saved));
      control.setAttribute('aria-label', `${saved ? '移除' : '留下'}《${song.title}》`);
      control.title = saved ? '已留下，点击移除' : '留下这首作品';
      control.innerHTML = control.classList.contains('map-setlist__save') ? `${api.icon(saved ? 'check' : 'plus')}<span>${saved ? '已留下' : '留下'}</span>` : `${api.icon(saved ? 'check' : 'plus')}${control.classList.contains('map-track__save') ? '' : saved ? ' 已留下' : ' 留下作品'}`;
    });
  });

  return () => {
    unsubscribeSavedMusic();
    abort.abort();
    clearTimeout(ceremonyTimer);
    resize?.disconnect();
    if (dialog?.open) dialog.close();
  };
}

export function mountMap(container, api) {
  prepareStoredMap(api);
  if (leftExplore) { leftExplore = false; if (api.getState().map.view.inspectorOpen) api.update(state => { state.map.view.inspectorOpen = false; }); }
  const payload = api.getState().routePayload;
  if (payload?.resumeSessionId) {
    const original = sessionById(api.getState().map, payload.resumeSessionId);
    api.update(state => {
      if (original) {
        activateSession(state.map, original);
        if (!isClosed(original)) original.status = 'active';
        original.updated = Date.now();
      }
      state.map.view.panel = null;
      state.map.view.reviewId = null;
      state.routePayload = null;
    });
    if (!original) api.toast('原探索记录已删除，保留当前探索。');
  } else if (payload?.artistId && artistById[payload.artistId]) {
    api.update(state => {
      const current = activeSession(state.map);
      if (payload.newSession || !current || current.type !== 'roam' || currentNode(current).id !== payload.artistId) startRoam(state.map, payload.artistId);
      state.map.view.panel = null;
      state.routePayload = null;
    });
  }
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
  container.innerHTML = mapHTML(api.getState().map, api, presentation);
  const cleanup = attachInteractions(container, api, false);
  // A redraw remounts synchronously; only a real route change leaves the shop.
  return () => { cleanup(); queueMicrotask(() => { if (!document.querySelector('.map-studio')) leftExplore = true; }); };
}

export function mountMapRecords(container, api) {
  prepareStoredMap(api);
  container.innerHTML = recordsHTML(api.getState().map, api);
  return attachInteractions(container, api, true);
}

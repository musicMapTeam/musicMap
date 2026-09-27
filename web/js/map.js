import { MAP_DATA_VERSION, catalogues, artistById, songs, edges, artistName, datasetForArtist, artistsInDataset, otherArtist, getNeighbors, isReachable } from './map-data.js';
import { getSavedMusic, toggleSavedMusic, saveMusic, importSavedMusic, subscribeSavedMusic } from './music-library.js';
import '../css/map.css';
import { networkEdges, networkLayout, shortestChain } from './map-network.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currentNode = session => session.path[session.path.length - 1];
const activeSession = map => map.sessions.find(session => session.id === map.activeId);
const sessionById = (map, id) => map.sessions.find(session => session.id === id);
const modeName = mode => mode === 'co' ? '合作关系' : '策展标签';
const sessionDataset = session => session?.dataset || datasetForArtist(session?.start) || 'real';
const catalogueFor = session => catalogues[sessionDataset(session)];
const dateLabel = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
let lastPresentedArtist = null;
const fallbackViews = new Map();

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

function createSession(start, type = 'roam', target = null, returnRoamId = null) {
  const now = Date.now();
  const dataset = datasetForArtist(start);
  return {
    id: globalThis.crypto?.randomUUID?.() || `map-${now}-${Math.random().toString(36).slice(2, 8)}`,
    dataset, version: catalogues[dataset].version, type, start, target, returnRoamId,
    status: 'active', mode: 'co', yaw: 0, pitch: 0,
    path: [{ id: start, mode: 'co', yaw: 0, pitch: 0 }],
    events: [], saved: [], created: now, updated: now,
  };
}

export function createMapState() {
  const initial = createSession(catalogues.real.start);
  return {
    version: MAP_DATA_VERSION,
    sessions: [initial], activeId: initial.id, undo: null,
    lastSessionByDataset: { real: initial.id },
    view: { panel: null, reviewId: null, query: '', challengeStart: catalogues.real.start, challengeEnd: catalogues.real.target, challengeError: '' },
  };
}

function activateSession(map, session) {
  if (map.activeId !== session.id) {
    map.view.selectedArtistId = currentNode(session).id;
    map.view.selectedEdgeId = null;
    map.view.networkQuery = null;
  }
  map.activeId = session.id;
  map.lastSessionByDataset ||= {};
  map.lastSessionByDataset[sessionDataset(session)] = session.id;
}

// v1 stored sessions contain only the original fictional IDs. Keep their paths,
// songs and version unchanged; the dataset field identifies their own catalogue.
function prepareStoredMap(api) {
  const map = api.getState().map;
  if (map.lastSessionByDataset && map.sessions.every(session => session.dataset)) return;
  api.update(state => {
    state.map.lastSessionByDataset ||= {};
    state.map.sessions.forEach(session => { session.dataset ||= datasetForArtist(session.start) || 'fictional'; });
    const active = activeSession(state.map);
    if (active) activateSession(state.map, active);
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

function tracksHTML(session, trackIds, api, source = '', showVersion = false, showCredits = false) {
  return trackIds.map((id, index) => {
    const song = songs[id];
    if (!song) return '';
    const saved = songIsSaved(session, id);
    return `<div class="map-track">
      <span class="map-track__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="map-track__copy">${song.credits?.length ? button('credits', `${escapeHTML(song.title)}<span aria-hidden="true">↗</span>`, 'map-track__title', `data-id="${id}" data-session="${session.id}" aria-label="查看《${escapeHTML(song.title)}》的作品署名"`) : `<strong>${escapeHTML(song.title)}</strong>`}<span>${song.artists.map(artistName).map(escapeHTML).join(' / ')}</span>${showVersion && (song.recordingLabel || song.versionLabel) ? `<small>${escapeHTML(song.recordingLabel || song.versionLabel)}</small>` : !showVersion && song.creditSummary ? `<small class="map-track__credit-preview">${escapeHTML(song.creditSummary)}</small>` : ''}</div>
      <div class="map-track__actions">${listenHTML(song, api)}${song.dataset === 'real' ? button('take-song', '带到现场', 'button button--quiet map-track__take', `data-id="${id}" data-session="${session.id}" aria-label="把《${escapeHTML(song.title)}》带到现场"`) : ''}${button('save', api.icon(saved ? 'check' : 'plus'), `icon-button map-track__save ${saved ? 'is-saved' : ''}`, `data-id="${id}" data-session="${session.id}" data-source="${escapeHTML(source)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》" aria-pressed="${saved}" title="${saved ? '已留下，点击移除' : '留下这首作品'}"`)}</div>
    </div>${showCredits ? creditsHTML(song, api) : ''}`;
  }).join('');
}

function undoHTML(map, api) {
  return map.undo ? `<div class="map-undo" role="status"><span>已移除《${escapeHTML(songs[map.undo.item.id]?.title)}》</span>${button('undo', '撤销', 'button button--quiet')}</div>` : '';
}

function mapHTML(map, api, presentation = 'quiet') {
  const session = activeSession(map);
  if (!session) return `<section class="map-empty empty-state"><h2>开始一次探索</h2>${button('new', '去音乐地图', 'button button--primary', `data-id="${catalogues.real.start}"`)}</section>`;
  const node = currentNode(session);
    const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const isReal = dataset === 'real';
  const relationUnit = session.mode === 'co' ? '次合作' : '条标签连接';
  const isChallenge = session.type === 'challenge';
  const isComplete = session.status === 'complete';
  const isEventArtist = ['a', 'b'].includes(node.id);
  const selectedId = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : node.id;
  const selectedArtist = artistById[selectedId];
  const selectedLinks = getNeighbors(selectedId, session.mode, dataset);
  const layout = networkLayout(dataset, session.mode);
  const links = networkEdges(dataset, session.mode);
  const query = map.view.networkQuery?.dataset === dataset && map.view.networkQuery.mode === session.mode ? map.view.networkQuery : null;
  const chain = query ? shortestChain(query.start, query.target, dataset, session.mode) : null;
  return `<section class="map-experience map-studio map-experience--${presentation}" aria-label="音乐关系探索">
    <header class="map-studio-head">
      <div class="map-studio-title"><h1>${isChallenge ? '合作挑战' : session.mode === 'co' ? '合作图谱' : '标签图谱'}</h1>${catalogueSwitchHTML(dataset)}</div>
      <div class="map-studio-tools">${button('search', `${api.icon('compass')} 找音乐人`, 'button button--quiet')}${button('find-path', '找关联', 'button button--quiet', isChallenge ? 'disabled title="挑战中请逐步探索"' : '')}<details class="map-shop-menu"><summary>目录 ${api.icon('chevron-right')}</summary><div><button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('challenge', '合作挑战', 'button button--quiet')}${button('relations', '连接与来源', 'button button--quiet')}</div></details></div>
    </header>
    ${isChallenge ? `<div class="map-challenge-banner"><div><span class="map-challenge-banner__label">${isComplete ? '已抵达' : '挑战中'}</span><strong>${escapeHTML(artistName(session.start))} ${api.icon('arrow-right')} ${escapeHTML(artistName(session.target))}</strong></div><span><b>${session.path.length - 1}</b> 步</span>${button('return-roam', '返回漫游', 'button button--quiet', `data-session="${session.id}"`)}</div>` : ''}
    <div class="map-workspace">
      <div class="map-stage-column">
        <div class="map-stage-top"><div class="map-mode-switch" aria-label="关系类型">${catalogue.hasStyle ? `${button('mode', '合作', session.mode === 'co' ? 'is-active' : '', `data-mode="co" aria-pressed="${session.mode === 'co'}"`)}${button('mode', '策展标签', session.mode === 'style' ? 'is-active' : '', `data-mode="style" aria-pressed="${session.mode === 'style'}" ${isChallenge ? 'disabled' : ''}`)}` : ''}</div><div class="map-network-tools" aria-label="关系网视野">${button('zoom-out', '−', 'icon-button', 'aria-label="缩小关系网"')}${button('fit', '全图', 'button button--quiet', 'aria-label="显示整张关系网"')}${button('zoom-in', '+', 'icon-button', 'aria-label="放大关系网"')}</div><span class="map-network-count">${layout.length} 人 <i>·</i> ${links.length} ${relationUnit}</span></div>
        <div class="map-stage map-network-fallback" data-map-stage tabindex="0" role="group" aria-label="完整音乐关系网，可用方向键平移和加减号缩放">
          <svg class="map-graph-lines" data-map-lines aria-hidden="true"></svg>
          ${layout.map(item => button('select', `<i style="--node-tone:${item.color}"></i><strong>${escapeHTML(item.name)}</strong>`, `map-network-node ${item.id === selectedId ? 'is-selected' : ''}`, `data-id="${item.id}" aria-label="选择${escapeHTML(item.name)}" aria-pressed="${item.id === selectedId}"`)).join('')}
        </div>
      </div>
      <aside class="map-artist-panel" aria-label="${escapeHTML(selectedArtist.name)}的作品">
        <details class="map-record-shelf"><summary><i class="map-record-sleeve" style="--node-tone:${selectedArtist.color}" aria-hidden="true"></i><span><strong>${escapeHTML(selectedArtist.name)}</strong><small>${selectedArtist.songIds.length} 张${isReal ? '合作唱片' : '示例作品'}</small></span>${api.icon('chevron-right')}</summary>${tracksHTML(session, selectedArtist.songIds, api, `在${selectedArtist.name}的${isReal ? '入选合作作品' : '示例作品'}中留下`)}</details>
      </aside>
    </div>
    <div class="map-studio-dock">
      <div class="map-network-selection"><span class="map-network-stamp" style="--node-tone:${selectedArtist.color}" aria-hidden="true"><i></i></span><div><h2>${escapeHTML(selectedArtist.name)}</h2><span>${selectedLinks.length} ${relationUnit} <i>·</i> ${selectedArtist.songIds.length} 首作品</span></div><div class="map-network-selection__actions">${button('artist', `作品 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-id="${selectedId}"`)}${selectedId !== node.id && !isChallenge ? button('connect', '找关联', 'button button--quiet', `data-id="${selectedId}"`) : ''}</div></div>
      ${query ? `<section class="map-network-chain" aria-label="查询到的关联链"><div><span>${chain ? `${chain.edges.length} ${relationUnit}相连` : '已收录关系中尚未连通'}</span>${button('clear-path', api.icon('x'), 'icon-button', 'aria-label="清除关联查询"')}</div>${chain ? `<div class="map-chain-stops">${chain.nodes.map((id, index) => `${index ? button('edge', escapeHTML(chain.edges[index - 1].song ? songs[chain.edges[index - 1].song].title : chain.edges[index - 1].reason), 'map-chain-song', `data-id="${chain.edges[index - 1].id}"`) : ''}${button('select', escapeHTML(artistName(id)), 'map-chain-person', `data-id="${id}"`)}`).join('')}</div><small>已收录${modeName(session.mode)}中的最短链</small>` : `<p>${escapeHTML(artistName(query.start))} ↔ ${escapeHTML(artistName(query.target))}</p>`}</section>` : `<div class="map-network-neighbors" aria-label="${escapeHTML(selectedArtist.name)}的连接">${selectedLinks.map(edge => button('edge', `<span>${escapeHTML(artistName(otherArtist(edge, selectedId)))}</span><small>${escapeHTML(edge.song ? songs[edge.song].title : edge.reason)}</small>`, 'map-network-connection', `data-id="${edge.id}"`)).join('') || '<span class="map-inline-empty">暂未收录连接</span>'}</div>`}
      <div class="map-route-bar"><div class="map-route-controls">${button('back', api.icon('arrow-left'), 'icon-button', `aria-label="返回上一位${isChallenge ? '并撤销一步' : ''}" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}${button('reset', api.icon('rotate'), 'icon-button', `aria-label="回到起点" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}</div><div class="map-route-trail" aria-label="当前路线">${session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">·</span>')}</div>${button('recap', `${currentSavedSongs(session).length} 首收藏`, 'button button--quiet', `data-session="${session.id}" data-map-saved-count="${session.id}"`)}</div>
    </div>
    ${undoHTML(map, api)}
    <div class="map-foot"><div>${isChallenge ? button('recap', isComplete ? '挑战结果' : '回顾路线', 'button button--quiet', `data-session="${session.id}"`) : button('finish', '结束探索', 'button button--quiet')}</div>${button('space', `${api.icon('users')} ${isReal ? '去同场' : isEventArtist ? '关联示例现场' : '示例现场'} ${api.icon('arrow-up-right')}`, 'button button--quiet map-space-link', `title="${isReal ? '为自己的活动创建房间，可返回这次探索' : '回声现场 · 虚构情景'}"`)}</div>
    ${panelHTML(map, api)}
  </section>`;
}

function searchResultsHTML(query, dataset) {
  const matches = artistsInDataset(dataset).filter(artist => `${artist.name} ${artist.tag} ${(artist.aliases || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return matches.length ? matches.map(artist => `<button type="button" class="map-search-result" data-map-action="select" data-id="${artist.id}"><span class="map-search-result__tone" style="--node-tone:${artist.color}" aria-hidden="true"></span><span><strong>${escapeHTML(artist.name)}</strong><small>${escapeHTML(artist.tag)}</small></span><span aria-hidden="true">↗</span></button>`).join('') : `<p class="empty-state">本${dataset === 'real' ? '专题暂未收录。可以试试「周杰伦」或「林俊杰」' : '示例暂未收录。可以试试「林间」或「乔屿」'}。</p>`;
}

function visitedArtists(session) {
  if (session.type === 'challenge') return [...new Set(session.path.map(step => step.id))];
  return [...new Set([session.start, ...session.events.filter(event => event.type === 'move').map(event => event.to)])];
}

function recapHTML(session, api) {
  const visited = visitedArtists(session);
  const saved = currentSavedSongs(session);
  const currentRoute = session.path.map(step => artistName(step.id)).join(' → ');
  const isChallenge = session.type === 'challenge';
  return `<div class="map-recap-intro"><span class="eyebrow">${catalogueFor(session).label} · ${dateLabel(session.created)}</span><h2>${isChallenge && session.status === 'complete' ? `${session.path.length - 1} 步抵达${escapeHTML(artistName(session.target))}` : isChallenge ? '挑战回顾' : '探索回顾'}</h2></div>
    <div class="map-recap-stats"><span><b>${visited.length}</b> 位艺人</span><span><b>${saved.length}</b> 首留下</span><span><b>${session.path.length - 1}</b> 步</span></div>
    <section class="map-recap-section"><h3>留下的作品</h3>${saved.length ? tracksHTML(session, saved.map(item => item.id), api) : '<p class="map-inline-empty">还没有留下作品。</p>'}</section>
    <section class="map-recap-section"><h3>${isChallenge && session.status === 'complete' ? '抵达路线' : '当前路线'}</h3><p class="map-current-route">${escapeHTML(currentRoute)}</p></section>
    <details class="map-route-details"><summary>分支记录 <span>${session.events.filter(event => event.type === 'move').length} 次连接</span></summary><div class="map-timeline">${session.events.map(event => {
      if (event.type !== 'move') return `<div class="map-timeline__return">${event.type === 'reset' ? '回到起点' : '返回'} ${escapeHTML(artistName(event.to))}${isChallenge ? ' · 撤销对应步数' : ''}</div>`;
      const edge = edges.find(item => item.id === event.edgeId);
      return `<div class="map-timeline__stop"><h4>${escapeHTML(artistName(event.from))} <span>→</span> ${escapeHTML(artistName(event.to))}</h4><p>${edge ? `${modeName(edge.mode)} · ${escapeHTML(edge.reason)}` : '已记录的连接'}</p>${edge ? evidenceHTML(edge, api) : ''}${edge?.song ? tracksHTML(session, [edge.song], api, `通过${artistName(event.from)}与${artistName(event.to)}的合作作品留下`, true) : ''}</div>`;
    }).join('') || '<p class="map-inline-empty">还没有连接记录。</p>'}</div></details>
    <div class="map-panel-actions">${session.status !== 'complete' ? button('resume', isChallenge ? '继续挑战' : '继续探索', 'button button--primary', `data-session="${session.id}"`) : button('challenge', '再开一局', 'button button--primary')}${isChallenge ? button('return-roam', '返回漫游', 'button button--quiet', `data-session="${session.id}"`) : button('search', '找音乐人', 'button button--quiet')}</div>
    <p class="map-storage-note">仅保存在当前浏览器，清除浏览器数据会丢失。</p>`;
}

function panelHTML(map, api, recordsOnly = false) {
  const panel = map.view.panel;
  if (!panel || (recordsOnly && !['recap', 'delete', 'credits'].includes(panel))) return '';
  const session = sessionById(map, map.view.reviewId) || activeSession(map);
  const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const availableArtists = artistsInDataset(dataset);
  const isReal = dataset === 'real';
  let content = '';
  if (panel === 'search') content = `<span class="eyebrow">${catalogue.label}</span><h2>找音乐人</h2><label class="map-search-label" for="map-artist-search">${availableArtists.length} 位已收录</label><input id="map-artist-search" class="map-input" type="search" placeholder="${isReal ? '名字，如 周杰伦、JJ Lin' : '名字或标签，如 林间、民谣'}" value="${escapeHTML(map.view.query)}" autocomplete="off"><div class="map-search-results" data-map-search-results>${searchResultsHTML(map.view.query, dataset)}</div>`;
  if (panel === 'find-path') {
    const options = selected => availableArtists.map(artist => `<option value="${artist.id}" ${selected === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('');
    content = `<span class="eyebrow">${catalogue.label} · ${modeName(session.mode)}</span><h2>${session.mode === 'co' ? '他们之间，隔着哪首歌？' : '他们之间，怎样相连？'}</h2><form data-map-path-form><div class="map-path-fields"><label class="map-field">从<select name="start">${options(currentNode(session).id)}</select></label><span aria-hidden="true">↔</span><label class="map-field">到<select name="target">${options(map.view.selectedArtistId || catalogue.target)}</select></label></div><button class="button button--primary" type="submit">在图上找关联 ${api.icon('arrow-right')}</button></form>`;
  }
  if (panel === 'challenge') content = `<span class="eyebrow">${catalogue.label}</span><h2>合作挑战</h2><p class="map-panel-description">沿合作找到终点，进度自动保留。</p><form data-map-challenge-form><label class="map-field">起点<select name="start">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeStart === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><label class="map-field">终点<select name="target">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeEnd === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><p class="map-form-error" data-map-challenge-error role="alert">${escapeHTML(map.view.challengeError)}</p><button class="button button--primary" type="submit">开始挑战 ${api.icon('arrow-right')}</button></form><p class="map-storage-note">每次连接计 1 步，返回撤销 1 步。仅使用本图谱已收录的关系。</p>`;
  if (panel === 'artist' && session) { const id = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : currentNode(session).id; const artist = artistById[id]; content = `<span class="eyebrow">${catalogue.label} · ${isReal ? '入选合作' : '示例作品'}</span><h2>${escapeHTML(artist.name)}</h2>${id !== currentNode(session).id && session.type !== 'challenge' ? `<div class="map-panel-actions">${button('new', '从这里开始探索', 'button button--quiet', `data-id="${id}"`)}</div>` : ''}${tracksHTML(session, artist.songIds, api, `在${artist.name}的${isReal ? '入选合作作品' : '示例作品'}中留下`, true, true)}`; }
  if (panel === 'edge' && session) {
    const edge = edges.find(item => item.id === map.view.selectedEdgeId && item.dataset === dataset && item.mode === session.mode);
    if (edge) {
      const from = currentNode(session).id;
      const touchesCurrent = edge.a === from || edge.b === from;
      const next = touchesCurrent ? otherArtist(edge, from) : null;
      content = `<span class="eyebrow">${isReal ? '共同演唱' : modeName(edge.mode)}</span><h2 class="map-edge-title">${button('select', escapeHTML(artistName(edge.a)), 'map-edge-person', `data-id="${edge.a}"`)}<span>×</span>${button('select', escapeHTML(artistName(edge.b)), 'map-edge-person', `data-id="${edge.b}"`)}</h2>${edge.song ? tracksHTML(session, [edge.song], api, '从关系网中留下', false, true) : `<p class="map-panel-description">${escapeHTML(edge.evidence)}</p>`}${evidenceHTML(edge, api)}<div class="map-panel-actions">${next && session.status !== 'complete' ? button('move', `前往${escapeHTML(artistName(next))} ${api.icon('arrow-right')}`, 'button button--primary', `data-id="${next}" data-edge-id="${edge.id}"`) : session.type !== 'challenge' ? button('new', `从${escapeHTML(artistName(edge.a))}出发`, 'button button--quiet', `data-id="${edge.a}"`) : ''}</div>`;
    }
  }
  if (panel === 'credits' && session) {
    const song = songs[map.view.creditSongId];
    if (song?.credits?.length) content = `<div class="map-credit-heading"><span class="map-credit-disc" style="--credit-tone:${artistById[song.artists[0]].color}" aria-hidden="true"></span><div><span class="eyebrow">作品署名</span><h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.recordingLabel)}</p></div></div>${creditsHTML(song, api, true)}<div class="map-credit-bottom"><span>无内置音频</span>${button('take-song', '带到现场', 'button button--quiet', `data-id="${song.id}" data-session="${session.id}"`)}${button('save', `${api.icon(songIsSaved(session, song.id) ? 'check' : 'plus')} ${songIsSaved(session, song.id) ? '已留下' : '留下作品'}`, 'button button--quiet', `data-id="${song.id}" data-session="${session.id}" data-source="查看作品制作署名后留下" aria-pressed="${songIsSaved(session, song.id)}"`)}</div>`;
  }
  if (panel === 'relations' && session) {
    const id = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : currentNode(session).id;
    content = `<span class="eyebrow">${catalogue.label} · ${modeName(session.mode)}</span><h2>连接来源</h2><p class="map-panel-description">${isReal ? '图中连线表示共同演唱；每首作品可展开制作署名。' : '虚构示例，无音源。标签由人工整理。'}</p>${getNeighbors(id, session.mode, dataset).map(edge => `<section class="map-relation-proof"><div class="map-relation-title"><h3>${escapeHTML(artistName(id))} <span>↔</span> ${escapeHTML(artistName(otherArtist(edge, id)))}</h3>${button('edge', api.icon('arrow-up-right'), 'icon-button', `data-id="${edge.id}" aria-label="查看与${escapeHTML(artistName(otherArtist(edge, id)))}的连接"`)}</div>${edge.song ? tracksHTML(session, [edge.song], api, `通过${artistName(edge.a)}与${artistName(edge.b)}的合作作品留下`, true, true) : `<p>${escapeHTML(edge.evidence)}</p>`}${edge.dataset !== 'real' ? evidenceHTML(edge, api) : ''}</section>`).join('') || '<p class="map-inline-empty">本图谱暂无收录。</p>'}`;
  }
  if (panel === 'recap' && session) content = recapHTML(session, api);
  if (panel === 'delete' && session) content = `<h2>删除这次探索？</h2><p class="map-panel-description">将删除从${escapeHTML(artistName(session.start))}出发的路线、分支和作品清单，无法恢复。</p><div class="map-panel-actions">${button('delete-confirm', '删除记录', 'button button--primary', `data-session="${session.id}"`)}${button('close', '保留')}</div>`;
  if (panel === 'reset' && session) content = `<h2>回到${escapeHTML(artistName(session.start))}？</h2><p class="map-panel-description">当前路线与步数归零，作品清单和分支记录保留。</p><div class="map-panel-actions">${button('reset-confirm', '回到起点', 'button button--primary')}${button('close', '继续当前路线')}</div>`;
  return `<dialog class="map-dialog" aria-label="${panel === 'recap' ? '探索回顾' : panel === 'challenge' ? '创建合作挑战' : '音乐探索面板'}"><div class="map-dialog__top">${button('close', api.icon('x'), 'icon-button', 'aria-label="关闭面板"')}</div><div class="map-dialog__content">${content}${undoHTML(map, api)}</div></dialog>`;
}

function recordsHTML(map, api) {
  const records = [...map.sessions].sort((a, b) => b.updated - a.updated);
  const rows = records.map(session => `<article class="map-record">
    <div class="map-record__disc" style="--node-tone:${artistById[session.start].color}" aria-hidden="true"><span>${String(session.path.length - 1).padStart(2, '0')}</span></div>
    <div class="map-record__copy"><span class="map-record__meta">${catalogueFor(session).label} · ${session.type === 'challenge' ? '挑战' : '漫游'} · ${session.status === 'complete' ? '已抵达' : session.status === 'ended' ? '已结束' : '进行中'} · ${dateLabel(session.created)}</span><h3>${escapeHTML(artistName(session.start))}${session.target ? ` → ${escapeHTML(artistName(session.target))}` : '出发'}</h3><p>${visitedArtists(session).length} 位艺人 · ${currentSavedSongs(session).length} 首留下 · ${session.path.length - 1} 步</p></div>
    <div class="map-record__actions">${button('recap', `回顾 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-session="${session.id}"`)}${session.status !== 'complete' ? button('resume', '继续', 'button button--quiet', `data-session="${session.id}"`) : ''}${button('delete', api.icon('trash'), 'icon-button', `data-session="${session.id}" aria-label="删除从${escapeHTML(artistName(session.start))}出发的记录"`)}</div>
  </article>`).join('');
  return `<section class="map-records" aria-label="音乐探索记录"><div class="map-records-heading"><h2>探索记录</h2><span class="muted">${records.length} 次探索</span></div><div class="map-record-list">${rows || `<div class="empty-state"><h3>还没有探索记录</h3>${button('new', '去探索', 'button button--primary', `data-id="${catalogues.real.start}"`)}</div>`}</div><p class="map-storage-note">仅存当前浏览器，清除浏览器数据会丢失。</p>${undoHTML(map, api)}${panelHTML(map, api, true)}</section>`;
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
  map.view.networkQuery = null;
}

function attachInteractions(container, api, recordsOnly) {
  const abort = new AbortController();
  const { signal } = abort;
  let drag = null;
  let suppressClickUntil = 0;
  const mutate = (fn, redraw = true, keepPosition = null) => {
    const previousDialog = container.querySelector('.map-dialog');
    const dialogScroll = previousDialog?.scrollTop || 0;
    const routeDetailsOpen = previousDialog?.querySelector('.map-route-details')?.open;
    const previousPanel = api.getState().map.view.panel;
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
        const focusScope = position.inDialog ? currentContainer.querySelector('.map-dialog') : currentContainer;
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
  const showPanel = (panel, id = null) => mutate(map => {
    map.view.panel = panel;
    map.view.reviewId = id;
    if (panel === 'challenge') {
      const current = sessionById(map, id) || activeSession(map);
      const catalogue = catalogueFor(current);
      map.view.challengeError = '';
      map.view.challengeStart = current ? currentNode(current).id : catalogue.start;
      if (datasetForArtist(map.view.challengeEnd) !== catalogue.id) map.view.challengeEnd = catalogue.target;
    }
  });
  const goExplore = () => api.navigate('explore');

  function back(reset = false) {
    mutate(map => {
      const session = activeSession(map);
      if (!session || session.path.length < 2 || session.status === 'complete') return;
      const from = currentNode(session).id;
      session.path = reset ? [session.path[0]] : session.path.slice(0, -1);
      const node = currentNode(session);
      session.mode = session.type === 'challenge' ? 'co' : node.mode;
      session.yaw = node.yaw;
      session.pitch = node.pitch;
      session.events.push({ type: reset ? 'reset' : 'back', from, to: node.id });
      session.updated = Date.now();
      map.view.panel = null;
      map.view.selectedArtistId = node.id;
      map.view.selectedEdgeId = null;
      map.view.networkQuery = null;
    });
  }

  function runAction(control) {
    if (!control || !container.contains(control) || control.disabled || Date.now() < suppressClickUntil) return;
    performAction(control.dataset, control);
  }
  function performAction(data, control = null) {
    const { mapAction: action, id, session: sessionId } = data;
    const map = api.getState().map;
    const session = activeSession(map);
    if (['zoom-in', 'zoom-out', 'fit', 'focus'].includes(action)) {
      if (document.body.classList.contains('spatial-fallback')) {
        if (action === 'fit') Object.assign(fallbackView(), { zoom: 1, x: 0, z: 0 });
        else if (action === 'focus') {
          const view = fallbackView();
          const selected = networkLayout(sessionDataset(session), session.mode).find(artist => artist.id === map.view.selectedArtistId);
          if (view.zoom === 1) Object.assign(view, { x: 0, z: 0 });
          else if (selected) Object.assign(view, { x: -selected.x * view.zoom, z: -selected.z * view.zoom });
        }
        else fallbackView().zoom = Math.max(1, Math.min(2.8, fallbackView().zoom * (action === 'zoom-in' ? 1.25 : .8)));
        positionNodes();
      } else api.spatial?.musicControl(action);
      return;
    }
    if (action === 'select') {
      if (datasetForArtist(id) !== sessionDataset(session)) return;
      const fromSearch = map.view.panel === 'search';
      mutate(state => { state.view.selectedArtistId = id; state.view.selectedEdgeId = null; state.view.panel = null; state.view.reviewId = null; });
      if (fromSearch) performAction({ mapAction: 'focus' });
      return;
    }
    if (action === 'edge') {
      if (!edges.some(edge => edge.id === id && edge.dataset === sessionDataset(session) && edge.mode === session.mode)) return;
      mutate(state => { state.view.selectedEdgeId = id; state.view.panel = 'edge'; state.view.reviewId = session.id; });
      return;
    }
    if (action === 'connect') {
      if (session.type === 'challenge' || datasetForArtist(id) !== sessionDataset(session)) return;
      mutate(state => { state.view.networkQuery = { start: currentNode(session).id, target: id, dataset: sessionDataset(session), mode: session.mode }; state.view.panel = null; });
      performAction({ mapAction: 'fit' });
      return;
    }
    if (action === 'clear-path') { mutate(state => { state.view.networkQuery = null; }); return; }
    if (action === 'artist' && id && datasetForArtist(id) === sessionDataset(session)) {
      mutate(state => { state.view.selectedArtistId = id; state.view.panel = 'artist'; state.view.reviewId = session.id; });
      return;
    }
    if (action === 'credits' && songs[id]?.credits?.length) {
      mutate(state => { state.view.creditSongId = id; state.view.reviewId = sessionId || null; state.view.panel = 'credits'; });
      return;
    }
    if (['search', 'artist', 'relations', 'challenge', 'delete', 'recap', 'find-path'].includes(action)) {
      if (action === 'find-path' && session.type === 'challenge') return;
      showPanel(action, sessionId || null);
      if (recordsOnly && ['search', 'challenge'].includes(action)) goExplore();
      return;
    }
    switch (action) {
      case 'close': mutate(state => { state.view.panel = null; }); break;
      case 'dataset': {
        const dataset = data.dataset;
        if (!catalogues[dataset] || dataset === sessionDataset(session)) break;
        mutate(state => {
          if (session) activateSession(state, session);
          const remembered = sessionById(state, state.lastSessionByDataset?.[dataset]);
          const existing = remembered || [...state.sessions].reverse().find(item => sessionDataset(item) === dataset);
          if (existing) {
            activateSession(state, existing);
            if (existing.status === 'ended') existing.status = 'active';
            existing.updated = Date.now();
          } else startRoam(state, catalogues[dataset].start);
          state.view.panel = null;
          state.view.reviewId = null;
          state.view.query = '';
          state.view.challengeError = '';
          state.view.selectedArtistId = currentNode(activeSession(state)).id;
          state.view.selectedEdgeId = null;
          state.view.networkQuery = null;
        });
        break;
      }
      case 'new':
        if (!artistById[id]) break;
        mutate(state => startRoam(state, id), false);
        goExplore();
        break;
      case 'move': {
        if (!session || session.status === 'complete') break;
        const edge = getNeighbors(currentNode(session).id, session.mode, sessionDataset(session)).find(item => otherArtist(item, currentNode(session).id) === id && (!data.edgeId || item.id === data.edgeId));
        if (!edge) break;
        mutate(state => {
          const selected = activeSession(state);
          const from = currentNode(selected).id;
          Object.assign(currentNode(selected), { mode: selected.mode, yaw: selected.yaw, pitch: selected.pitch });
          selected.path.push({ id, edgeId: edge.id, mode: selected.mode, yaw: 0, pitch: 0 });
          selected.events.push({ type: 'move', from, to: id, edgeId: edge.id });
          selected.yaw = 0;
          selected.pitch = 0;
          selected.updated = Date.now();
          selected.status = selected.type === 'challenge' && id === selected.target ? 'complete' : 'active';
          state.view.panel = selected.status === 'complete' ? 'recap' : null;
          state.view.reviewId = selected.status === 'complete' ? selected.id : null;
          state.view.selectedArtistId = id;
          state.view.selectedEdgeId = edge.id;
          state.view.networkQuery = null;
        });
        break;
      }
      case 'mode':
        if (!session || session.type === 'challenge') break;
        if (data.mode === 'style' && !catalogueFor(session).hasStyle) break;
        mutate(state => { const selected = activeSession(state); selected.mode = data.mode; selected.updated = Date.now(); state.view.networkQuery = null; state.view.selectedEdgeId = null; });
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
        mutate(state => { const selected = activeSession(state); if (!selected) return; selected.status = 'ended'; selected.updated = Date.now(); state.view.panel = 'recap'; state.view.reviewId = selected.id; });
        break;
      case 'resume':
        mutate(state => { const selected = sessionById(state, sessionId); if (!selected) return; activateSession(state, selected); if (selected.status !== 'complete') selected.status = 'active'; selected.updated = Date.now(); state.view.panel = null; state.view.reviewId = null; }, false);
        goExplore();
        break;
      case 'return-roam':
        mutate(state => {
          const selected = sessionById(state, sessionId) || activeSession(state);
          if (!selected || selected.type !== 'challenge') return;
          selected.updated = Date.now();
          const original = sessionById(state, selected.returnRoamId);
          if (original) { activateSession(state, original); original.status = 'active'; }
          else startRoam(state, currentNode(selected).id);
          state.view.panel = null;
          state.view.reviewId = null;
        }, false);
        goExplore();
        break;
      case 'delete-confirm':
        mutate(state => {
          state.sessions = state.sessions.filter(item => item.id !== sessionId);
          Object.keys(state.lastSessionByDataset || {}).forEach(dataset => {
            if (state.lastSessionByDataset[dataset] === sessionId) delete state.lastSessionByDataset[dataset];
          });
          if (state.activeId === sessionId) {
            const fallback = [...state.sessions].reverse().find(item => item.type === 'roam');
            if (fallback) activateSession(state, fallback);
            else state.activeId = null;
          }
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
        if (sessionDataset(session) === 'real') {
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
    if (event.target.matches('[data-map-path-form]')) {
      event.preventDefault();
      const data = new FormData(event.target);
      const start = data.get('start'); const target = data.get('target');
      const session = activeSession(api.getState().map); const dataset = sessionDataset(session);
      if (session.type === 'challenge' || datasetForArtist(start) !== dataset || datasetForArtist(target) !== dataset) return;
      mutate(map => { map.view.networkQuery = { start, target, dataset, mode: session.mode }; map.view.selectedArtistId = target; map.view.selectedEdgeId = null; map.view.panel = null; });
      performAction({ mapAction: 'fit' });
      return;
    }
    if (!event.target.matches('[data-map-challenge-form]')) return;
    event.preventDefault();
    const data = new FormData(event.target);
    const start = data.get('start');
    const target = data.get('target');
    const dataset = sessionDataset(activeSession(api.getState().map));
    const error = datasetForArtist(start) !== dataset || datasetForArtist(target) !== dataset ? '请选择当前图谱内的艺人。' : start === target ? '出发点和终点相同，换一位想遇见的艺人吧。' : !isReachable(start, target, dataset) ? '本专题已收录的合作关系尚未连通，请换个起点或终点。' : '';
    mutate(map => { map.view.challengeStart = start; map.view.challengeEnd = target; map.view.challengeError = error; }, false);
    if (error) { container.querySelector('[data-map-challenge-error]').textContent = error; return; }
    mutate(map => {
      const current = activeSession(map);
      const returnRoamId = current?.type === 'roam' ? current.id : current?.returnRoamId || null;
      const challenge = createSession(start, 'challenge', target, returnRoamId);
      map.sessions.push(challenge);
      activateSession(map, challenge);
      map.view.panel = null;
      map.view.reviewId = null;
      map.view.selectedArtistId = start;
      map.view.selectedEdgeId = null;
      map.view.networkQuery = null;
    }, false);
    goExplore();
  }, { signal });

  const dialog = container.querySelector('.map-dialog');
  if (dialog) {
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); mutate(map => { map.view.panel = null; }); }, { signal });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) mutate(map => { map.view.panel = null; });
    }, { signal });
    const focusTarget = dialog.querySelector('input, select') || dialog.querySelector('button');
    focusTarget?.focus({ preventScroll: true });
  }

  const stage = container.querySelector('[data-map-stage]');
  const trail = container.querySelector('.map-route-trail');
  if (trail) trail.scrollLeft = trail.scrollWidth;
  const resize = stage ? new ResizeObserver(() => positionNodes()) : null;
  function fallbackView() {
    const session = activeSession(api.getState().map);
    const key = `${sessionDataset(session)}:${session.mode}`;
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

  function musicPayload(session) {
    const map = api.getState().map; const dataset = sessionDataset(session);
    const id = datasetForArtist(map.view.selectedArtistId) === dataset ? map.view.selectedArtistId : currentNode(session).id;
    const layout = networkLayout(dataset, session.mode); const links = networkEdges(dataset, session.mode);
    const neighbors = new Set(getNeighbors(id, session.mode, dataset).map(edge => otherArtist(edge, id)));
    const query = map.view.networkQuery;
    const chain = query?.dataset === dataset && query.mode === session.mode ? shortestChain(query.start, query.target, dataset, session.mode) : null;
    const highlightedNodes = new Set(chain?.nodes || []); const highlightedEdges = new Set(chain?.edges.map(edge => edge.id) || []);
    const visited = new Set(session.path.map(step => step.id)); const visitedEdges = new Set(session.path.map(step => step.edgeId).filter(Boolean));
    return {
      key: `${dataset}:${session.mode}`, selectedId: id, pathIds: [...visited],
      nodes: layout.map(artist => ({ id: artist.id, name: artist.name, color: artist.color, count: artist.songIds.length, x: artist.x, z: artist.z,
        selected: artist.id === id, adjacent: neighbors.has(artist.id), visited: visited.has(artist.id), current: artist.id === currentNode(session).id, highlighted: highlightedNodes.has(artist.id), disabled: false })),
      edges: links.map(edge => ({ id: edge.id, a: edge.a, b: edge.b, title: edge.song ? songs[edge.song].title : edge.reason, kind: edge.mode,
        active: edge.a === id || edge.b === id || edge.id === map.view.selectedEdgeId, visited: visitedEdges.has(edge.id), highlighted: highlightedEdges.has(edge.id) })),
    };
  }
  function positionNodes() {
    if (!stage) return;
    const session = activeSession(api.getState().map); if (!session) return;
    const payload = musicPayload(session);
    if (!recordsOnly) api.spatial?.publish({ mode: 'explore', cards: [], music: payload,
      onMusic(action) { if (['select', 'edge'].includes(action.action)) performAction({ mapAction: action.action, id: action.id }); },
    });
    const width = stage.clientWidth; const height = stage.clientHeight;
    if (!width || !height) return;
    const view = fallbackView(); const positions = new Map();
    for (const point of payload.nodes) {
      const x = width * (.5 + (point.x * view.zoom + view.x) / 3.8);
      const y = height * (.5 + (point.z * view.zoom + view.z) / 2.7);
      positions.set(point.id, [x, y]);
      const node = stage.querySelector(`[data-id="${point.id}"]`);
      node.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      node.classList.toggle('is-highlighted', point.highlighted);
      node.hidden = x < 25 || x > width - 25 || y < 25 || y > height - 25;
    }
    const svg = stage.querySelector('[data-map-lines]'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = payload.edges.map(edge => {
      const [x, y] = positions.get(edge.a); const [tx, ty] = positions.get(edge.b);
      return `<path class="map-network-line ${edge.active ? 'is-active' : ''} ${edge.highlighted ? 'is-highlighted' : ''}" d="M${x},${y} L${tx},${ty}" data-map-action="edge" data-id="${edge.id}"/>`;
    }).join('');
  }

  const unsubscribeSavedMusic = subscribeSavedMusic(tracks => {
    const savedIds = new Set(tracks.map(track => track.id));
    container.querySelectorAll('[data-map-saved-count]').forEach(control => {
      const session = sessionById(api.getState().map, control.dataset.mapSavedCount);
      control.textContent = `${currentSavedSongs(session).length} 首收藏`;
    });
    container.querySelectorAll('[data-map-action="save"]').forEach(control => {
      const song = songs[control.dataset.id];
      if (song?.dataset !== 'real') return;
      const saved = savedIds.has(song.id);
      control.classList.toggle('is-saved', saved);
      control.setAttribute('aria-pressed', String(saved));
      control.setAttribute('aria-label', `${saved ? '移除' : '留下'}《${song.title}》`);
      control.title = saved ? '已留下，点击移除' : '留下这首作品';
      control.innerHTML = `${api.icon(saved ? 'check' : 'plus')}${control.classList.contains('map-track__save') ? '' : saved ? ' 已留下' : ' 留下作品'}`;
    });
  });

  return () => {
    unsubscribeSavedMusic();
    abort.abort();
    resize?.disconnect();
    if (dialog?.open) dialog.close();
  };
}

export function mountMap(container, api) {
  prepareStoredMap(api);
  const payload = api.getState().routePayload;
  if (payload?.resumeSessionId) {
    const original = sessionById(api.getState().map, payload.resumeSessionId);
    api.update(state => {
      if (original) {
        activateSession(state.map, original);
        if (original.status !== 'complete') original.status = 'active';
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
  const session = activeSession(api.getState().map);
  const presentedArtist = session ? currentNode(session).id : null;
  const presentation = lastPresentedArtist === null ? 'entry' : lastPresentedArtist !== presentedArtist ? 'focus' : 'quiet';
  lastPresentedArtist = presentedArtist;
  container.innerHTML = mapHTML(api.getState().map, api, presentation);
  return attachInteractions(container, api, false);
}

export function mountMapRecords(container, api) {
  prepareStoredMap(api);
  container.innerHTML = recordsHTML(api.getState().map, api);
  return attachInteractions(container, api, true);
}

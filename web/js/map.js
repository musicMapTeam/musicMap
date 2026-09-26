import { MAP_DATA_VERSION, catalogues, artistById, songs, edges, artistName, datasetForArtist, artistsInDataset, otherArtist, getNeighbors, isReachable } from './map-data.js';
import { getSavedMusic, toggleSavedMusic, saveMusic, importSavedMusic, subscribeSavedMusic } from './music-library.js';
import '../css/map.css';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currentNode = session => session.path[session.path.length - 1];
const activeSession = map => map.sessions.find(session => session.id === map.activeId);
const sessionById = (map, id) => map.sessions.find(session => session.id === id);
const modeName = mode => mode === 'co' ? '合作关系' : '策展标签';
const sessionDataset = session => session?.dataset || datasetForArtist(session?.start) || 'real';
const catalogueFor = session => catalogues[sessionDataset(session)];
const dateLabel = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
let lastPresentedArtist = null;

function songDraft(song) {
  return { id: song.id, title: song.title, artists: song.artists.map(artistName), source: song.sourceUrl || '', dataset: 'real' };
}

function songIsSaved(session, id) {
  return songs[id]?.dataset === 'real' ? getSavedMusic().some(item => item.id === id) : session.saved.some(item => item.id === id);
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

function discoveryHTML(session, api, undo) {
  const node = currentNode(session);
  const previous = session.path[session.path.length - 2];
  const edge = previous && edges.find(item => item.id === node.edgeId);
  if (edge) {
    const origin = escapeHTML(artistName(previous.id));
    const destination = escapeHTML(artistName(node.id));
    const saved = edge.song && songIsSaved(session, edge.song);
    const source = `通过${artistName(previous.id)}与${artistName(node.id)}的合作作品留下`;
    const canUndo = undo?.sessionId === session.id && undo.item.id === edge.song;
    return `<section class="map-discovery" aria-label="当前连接的作品">
      <div class="map-discovery__copy"><p><strong>${edge.song ? `《${escapeHTML(songs[edge.song].title)}》` : `策展标签 · ${escapeHTML(edge.reason)}`}</strong><span class="map-discovery__artists">${origin} × ${destination}</span></p></div>
      ${edge.song ? `<div class="map-discovery__actions">${songs[edge.song].credits?.length ? button('credits', '谁做了什么', 'button button--quiet', `data-id="${edge.song}" data-session="${session.id}"`) : ''}${listenHTML(songs[edge.song], api)}${button('save', `${api.icon(saved ? 'check' : 'plus')} ${saved ? '已留下' : '留下'}`, `button button--quiet ${saved ? 'is-saved' : ''}`, `data-id="${edge.song}" data-session="${session.id}" data-source="${escapeHTML(source)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(songs[edge.song].title)}》" aria-pressed="${saved}"`)}${canUndo ? button('undo', '撤销', 'button button--quiet') : ''}</div>` : ''}
    </section>`;
  }

  const nextEdge = getNeighbors(node.id, session.mode)[0];
  if (!nextEdge) {
    const hasStyleLinks = session.mode === 'co' && getNeighbors(node.id, 'style').length > 0;
    return `<section class="map-discovery map-discovery--first" aria-label="探索提示"><div class="map-discovery__copy"><p>本${sessionDataset(session) === 'real' ? '专题' : '示例'}暂未收录${modeName(session.mode)}。</p></div><div class="map-discovery__actions">${hasStyleLinks ? button('mode', '看策展标签', 'button button--quiet', 'data-mode="style"') : button('search', '换个起点', 'button button--quiet')}</div></section>`;
  }
  const nextId = otherArtist(nextEdge, node.id);
  return `<section class="map-discovery map-discovery--first" aria-label="探索建议">
    <div class="map-discovery__copy"><p>${nextEdge.song ? `从《${escapeHTML(songs[nextEdge.song].title)}》开始` : `沿「${escapeHTML(nextEdge.reason)}」探索`}</p></div><div class="map-discovery__actions">${button('move', `${escapeHTML(artistName(nextId))} ${api.icon('arrow-right')}`, 'button button--quiet', `data-id="${nextId}"`)}</div>
  </section>`;
}

function mapHTML(map, api, presentation = 'quiet') {
  const session = activeSession(map);
  if (!session) return `<section class="map-empty empty-state"><h2>开始一次探索</h2>${button('new', '去音乐地图', 'button button--primary', `data-id="${catalogues.real.start}"`)}</section>`;
  const node = currentNode(session);
  const artist = artistById[node.id];
  const dataset = sessionDataset(session);
  const catalogue = catalogueFor(session);
  const isReal = dataset === 'real';
  const neighbors = getNeighbors(node.id, session.mode, dataset);
  const isChallenge = session.type === 'challenge';
  const isComplete = session.status === 'complete';
  const isEventArtist = ['a', 'b'].includes(node.id);
  return `<section class="map-experience map-studio map-experience--${presentation}" aria-label="音乐关系探索">
    <header class="map-studio-head">
      <div class="map-studio-title"><h1>${isChallenge ? '合作挑战' : '音乐地图'}</h1>${catalogueSwitchHTML(dataset)}</div>
      <div class="map-studio-tools"><button type="button" class="button button--quiet" data-open-catalogue>开放曲库</button>${button('search', api.icon('compass'), 'icon-button', 'aria-label="换个起点" title="换个起点"')}${button('challenge', '合作挑战', 'button button--quiet')}</div>
    </header>
    ${isChallenge ? `<div class="map-challenge-banner"><div><span class="map-challenge-banner__label">${isComplete ? '已抵达' : '挑战中'}</span><strong>${escapeHTML(artistName(session.start))} ${api.icon('arrow-right')} ${escapeHTML(artistName(session.target))}</strong></div><span><b>${session.path.length - 1}</b> 步</span>${button('return-roam', '返回漫游', 'button button--quiet', `data-session="${session.id}"`)}</div>` : ''}
    <div class="map-workspace">
      <div class="map-stage-column">
        <div class="map-stage-top"><div class="map-mode-switch" aria-label="关系类型">${catalogue.hasStyle ? `${button('mode', '合作', session.mode === 'co' ? 'is-active' : '', `data-mode="co" aria-pressed="${session.mode === 'co'}"`)}${button('mode', '策展标签', session.mode === 'style' ? 'is-active' : '', `data-mode="style" aria-pressed="${session.mode === 'style'}" ${isChallenge ? 'disabled title="挑战只沿合作关系前进"' : ''}`)}` : `<span class="map-mode-caption">${neighbors.length} 条连接</span>`}</div><div class="map-stage-tools">${button('relations', '连接与来源', 'button button--quiet')}${button('rotate', api.icon('rotate'), 'icon-button', 'aria-label="旋转关系图" title="旋转关系图"')}</div></div>
        <div class="map-stage" data-map-stage tabindex="0" role="group" aria-label="${escapeHTML(artist.name)}的关系图。可拖动或使用方向键旋转，也可打开「连接与来源」选择艺人。">
          <svg class="map-graph-lines" data-map-lines aria-hidden="true"></svg>
          <button type="button" class="map-node map-node--center ${artist.name.length > 3 ? 'map-node--long' : ''}" data-map-action="artist" style="--node-tone:${artist.color}" aria-label="查看${escapeHTML(artist.name)}的${isReal ? '入选合作作品' : '示例作品'}">
            <span class="map-node__disc" aria-hidden="true"><i>${escapeHTML(artist.name.slice(0, 1))}</i></span><span class="map-node__name">${escapeHTML(artist.name)}</span><span class="map-node__hint">${artist.songIds.length} 首作品 ${api.icon('arrow-up-right')}</span>
          </button>
          ${neighbors.map(edge => { const next = artistById[otherArtist(edge, node.id)]; return `<button type="button" class="map-node map-node--orbit" data-map-action="move" data-id="${next.id}" style="--node-tone:${next.color}" aria-label="沿${escapeHTML(edge.reason)}探索${escapeHTML(next.name)}" ${isComplete ? 'disabled' : ''}><span class="map-node__disc" aria-hidden="true"><i>${escapeHTML(next.name.slice(0, 1))}</i></span><span class="map-node__name">${escapeHTML(next.name)}</span><span class="map-node__tag">${escapeHTML(edge.song ? songs[edge.song].title : edge.reason)}</span></button>`; }).join('')}
          ${!neighbors.length ? '<span class="map-stage__no-links">暂无收录连接</span>' : ''}
        </div>
      </div>
      <aside class="map-artist-panel" aria-label="${escapeHTML(artist.name)}的作品与连接">
        <div class="map-artist-panel__heading"><div><span class="map-card-label">${isReal ? '合作唱片' : '示例作品 · 无音频'}</span><h2>${escapeHTML(artist.name)}</h2></div><span class="map-artist-mark" style="--node-tone:${artist.color}" aria-hidden="true"></span></div>
        ${tracksHTML(session, artist.songIds, api, `在${artist.name}的${isReal ? '入选合作作品' : '示例作品'}中留下`)}
        <details class="map-connections"><summary>全部连接 <span>${neighbors.length}</span></summary><div class="map-neighbor-list">${neighbors.map(edge => { const next = artistById[otherArtist(edge, node.id)]; return `<button type="button" class="map-neighbor" data-map-action="move" data-id="${next.id}" ${isComplete ? 'disabled' : ''}><span class="map-neighbor__tone" style="--node-tone:${next.color}" aria-hidden="true"></span><span><strong>${escapeHTML(next.name)}</strong><small>${edge.song ? `《${escapeHTML(songs[edge.song].title)}》` : escapeHTML(edge.reason)}</small></span>${api.icon('arrow-up-right')}</button>`; }).join('') || '<p class="map-inline-empty">本专题暂无收录。</p>'}</div></details>
      </aside>
    </div>
    <div class="map-studio-dock">
      ${discoveryHTML(session, api, map.undo)}
      <div class="map-route-bar"><div class="map-route-controls">${button('back', api.icon('arrow-left'), 'icon-button', `aria-label="返回上一位${isChallenge ? '并撤销一步' : ''}" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}${button('reset', api.icon('rotate'), 'icon-button', `aria-label="回到起点" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}</div><div class="map-route-trail" aria-label="当前路线">${session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">·</span>')}</div>${button('recap', `${session.saved.length} 首收藏`, 'button button--quiet', `data-session="${session.id}"`)}</div>
    </div>
    ${undoHTML(map, api)}
    <div class="map-foot"><div>${isChallenge ? button('recap', isComplete ? '挑战结果' : '回顾路线', 'button button--quiet', `data-session="${session.id}"`) : button('finish', '结束探索', 'button button--quiet')}</div>${button('space', `${api.icon('users')} ${isReal ? '去同场' : isEventArtist ? '关联示例现场' : '示例现场'} ${api.icon('arrow-up-right')}`, 'button button--quiet map-space-link', `title="${isReal ? '为自己的活动创建房间，可返回这次探索' : '回声现场 · 虚构情景'}"`)}</div>
    ${panelHTML(map, api)}
  </section>`;
}

function searchResultsHTML(query, dataset) {
  const matches = artistsInDataset(dataset).filter(artist => `${artist.name} ${artist.tag} ${(artist.aliases || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return matches.length ? matches.map(artist => `<button type="button" class="map-search-result" data-map-action="new" data-id="${artist.id}"><span class="map-search-result__tone" style="--node-tone:${artist.color}" aria-hidden="true"></span><span><strong>${escapeHTML(artist.name)}</strong><small>${escapeHTML(artist.tag)}</small></span><span aria-hidden="true">↗</span></button>`).join('') : `<p class="empty-state">本${dataset === 'real' ? '专题暂未收录。可以试试「周杰伦」或「林俊杰」' : '示例暂未收录。可以试试「林间」或「乔屿」'}。</p>`;
}

function visitedArtists(session) {
  if (session.type === 'challenge') return [...new Set(session.path.map(step => step.id))];
  return [...new Set([session.start, ...session.events.filter(event => event.type === 'move').map(event => event.to)])];
}

function recapHTML(session, api) {
  const visited = visitedArtists(session);
  const currentRoute = session.path.map(step => artistName(step.id)).join(' → ');
  const isChallenge = session.type === 'challenge';
  return `<div class="map-recap-intro"><span class="eyebrow">${catalogueFor(session).label} · ${dateLabel(session.created)}</span><h2>${isChallenge && session.status === 'complete' ? `${session.path.length - 1} 步抵达${escapeHTML(artistName(session.target))}` : isChallenge ? '挑战回顾' : '探索回顾'}</h2></div>
    <div class="map-recap-stats"><span><b>${visited.length}</b> 位艺人</span><span><b>${session.saved.length}</b> 首留下</span><span><b>${session.path.length - 1}</b> 步</span></div>
    <section class="map-recap-section"><h3>留下的作品</h3>${session.saved.length ? tracksHTML(session, session.saved.map(item => item.id), api) : '<p class="map-inline-empty">还没有留下作品。</p>'}</section>
    <section class="map-recap-section"><h3>${isChallenge && session.status === 'complete' ? '抵达路线' : '当前路线'}</h3><p class="map-current-route">${escapeHTML(currentRoute)}</p></section>
    <details class="map-route-details"><summary>分支记录 <span>${session.events.filter(event => event.type === 'move').length} 次连接</span></summary><div class="map-timeline">${session.events.map(event => {
      if (event.type !== 'move') return `<div class="map-timeline__return">${event.type === 'reset' ? '回到起点' : '返回'} ${escapeHTML(artistName(event.to))}${isChallenge ? ' · 撤销对应步数' : ''}</div>`;
      const edge = edges.find(item => item.id === event.edgeId);
      return `<div class="map-timeline__stop"><h4>${escapeHTML(artistName(event.from))} <span>→</span> ${escapeHTML(artistName(event.to))}</h4><p>${edge ? `${modeName(edge.mode)} · ${escapeHTML(edge.reason)}` : '已记录的连接'}</p>${edge ? evidenceHTML(edge, api) : ''}${edge?.song ? tracksHTML(session, [edge.song], api, `通过${artistName(event.from)}与${artistName(event.to)}的合作作品留下`, true) : ''}</div>`;
    }).join('') || '<p class="map-inline-empty">还没有连接记录。</p>'}</div></details>
    <div class="map-panel-actions">${session.status !== 'complete' ? button('resume', isChallenge ? '继续挑战' : '继续探索', 'button button--primary', `data-session="${session.id}"`) : button('challenge', '再开一局', 'button button--primary')}${isChallenge ? button('return-roam', '返回漫游', 'button button--quiet', `data-session="${session.id}"`) : button('search', '换个起点', 'button button--quiet')}</div>
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
  if (panel === 'search') content = `<span class="eyebrow">${catalogue.label}</span><h2>换个起点</h2><p class="map-panel-description">开启新探索，当前记录保留。</p><label class="map-search-label" for="map-artist-search">${availableArtists.length} 位艺人</label><input id="map-artist-search" class="map-input" type="search" placeholder="${isReal ? '搜索名字，如 周杰伦、JJ Lin' : '搜索名字或标签，如 林间、民谣'}" value="${escapeHTML(map.view.query)}" autocomplete="off"><div class="map-search-results" data-map-search-results>${searchResultsHTML(map.view.query, dataset)}</div>`;
  if (panel === 'challenge') content = `<span class="eyebrow">${catalogue.label}</span><h2>合作挑战</h2><p class="map-panel-description">沿合作找到终点，进度自动保留。</p><form data-map-challenge-form><label class="map-field">起点<select name="start">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeStart === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><label class="map-field">终点<select name="target">${availableArtists.map(artist => `<option value="${artist.id}" ${map.view.challengeEnd === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><p class="map-form-error" data-map-challenge-error role="alert">${escapeHTML(map.view.challengeError)}</p><button class="button button--primary" type="submit">开始挑战 ${api.icon('arrow-right')}</button></form><p class="map-storage-note">每次连接计 1 步，返回撤销 1 步。仅使用本图谱已收录的关系。</p>`;
  if (panel === 'artist' && session) { const artist = artistById[currentNode(session).id]; content = `<span class="eyebrow">${catalogue.label} · ${isReal ? '入选合作' : '示例作品'}</span><h2>${escapeHTML(artist.name)}</h2><p class="map-panel-description">${isReal ? '作品与制作署名 · 无内置音频' : '虚构作品，无音源。'}</p>${tracksHTML(session, artist.songIds, api, `在${artist.name}的${isReal ? '入选合作作品' : '示例作品'}中留下`, true, true)}`; }
  if (panel === 'credits' && session) {
    const song = songs[map.view.creditSongId];
    if (song?.credits?.length) content = `<div class="map-credit-heading"><span class="map-credit-disc" style="--credit-tone:${artistById[song.artists[0]].color}" aria-hidden="true"></span><div><span class="eyebrow">作品署名</span><h2>${escapeHTML(song.title)}</h2><p>${escapeHTML(song.recordingLabel)}</p></div></div>${creditsHTML(song, api, true)}<div class="map-credit-bottom"><span>无内置音频</span>${button('take-song', '带到现场', 'button button--quiet', `data-id="${song.id}" data-session="${session.id}"`)}${button('save', `${api.icon(songIsSaved(session, song.id) ? 'check' : 'plus')} ${songIsSaved(session, song.id) ? '已留下' : '留下作品'}`, 'button button--quiet', `data-id="${song.id}" data-session="${session.id}" data-source="查看作品制作署名后留下" aria-pressed="${songIsSaved(session, song.id)}"`)}</div>`;
  }
  if (panel === 'relations' && session) {
    const id = currentNode(session).id;
    content = `<span class="eyebrow">${catalogue.label} · ${modeName(session.mode)}</span><h2>连接来源</h2><p class="map-panel-description">${isReal ? '图中连线表示共同演唱；每首作品可展开制作署名。' : '虚构示例，无音源。标签由人工整理。'}</p>${getNeighbors(id, session.mode, dataset).map(edge => `<section class="map-relation-proof"><div class="map-relation-title"><h3>${escapeHTML(artistName(id))} <span>↔</span> ${escapeHTML(artistName(otherArtist(edge, id)))}</h3>${button('move', api.icon('arrow-up-right'), 'icon-button', `data-id="${otherArtist(edge, id)}" aria-label="前往${escapeHTML(artistName(otherArtist(edge, id)))}" ${session.status === 'complete' ? 'disabled' : ''}`)}</div>${edge.song ? tracksHTML(session, [edge.song], api, `通过${artistName(edge.a)}与${artistName(edge.b)}的合作作品留下`, true, true) : `<p>${escapeHTML(edge.evidence)}</p>`}${edge.dataset !== 'real' ? evidenceHTML(edge, api) : ''}</section>`).join('') || '<p class="map-inline-empty">本图谱暂无收录。</p>'}`;
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
    <div class="map-record__copy"><span class="map-record__meta">${catalogueFor(session).label} · ${session.type === 'challenge' ? '挑战' : '漫游'} · ${session.status === 'complete' ? '已抵达' : session.status === 'ended' ? '已结束' : '进行中'} · ${dateLabel(session.created)}</span><h3>${escapeHTML(artistName(session.start))}${session.target ? ` → ${escapeHTML(artistName(session.target))}` : '出发'}</h3><p>${visitedArtists(session).length} 位艺人 · ${session.saved.length} 首留下 · ${session.path.length - 1} 步</p></div>
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
}

function attachInteractions(container, api, recordsOnly) {
  const abort = new AbortController();
  const { signal } = abort;
  let drag = null;
  let suppressClickUntil = 0;
  let rotation = null;
  const mutate = (fn, redraw = true) => {
    const previousDialog = container.querySelector('.map-dialog');
    const dialogScroll = previousDialog?.scrollTop || 0;
    const routeDetailsOpen = previousDialog?.querySelector('.map-route-details')?.open;
    const previousPanel = api.getState().map.view.panel;
    api.update(state => fn(state.map));
    if (redraw) {
      api.render();
      if (previousPanel && api.getState().map.view.panel === previousPanel) {
        const currentContainer = container.isConnected ? container : document.getElementById(container.id);
        const newDialog = currentContainer?.querySelector('.map-dialog');
        if (newDialog) {
          const routeDetails = newDialog.querySelector('.map-route-details');
          if (routeDetails) routeDetails.open = Boolean(routeDetailsOpen);
          newDialog.scrollTop = dialogScroll;
        }
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
    });
  }

  container.addEventListener('click', event => {
    const control = event.target.closest('[data-map-action]');
    if (!control || !container.contains(control) || control.disabled || Date.now() < suppressClickUntil) return;
    const { mapAction: action, id, session: sessionId } = control.dataset;
    const map = api.getState().map;
    const session = activeSession(map);
    if (action === 'credits' && songs[id]?.credits?.length) {
      mutate(state => { state.view.creditSongId = id; state.view.reviewId = sessionId || null; state.view.panel = 'credits'; });
      return;
    }
    if (['search', 'artist', 'relations', 'challenge', 'delete', 'recap'].includes(action)) {
      showPanel(action, sessionId || null);
      if (recordsOnly && ['search', 'challenge'].includes(action)) goExplore();
      return;
    }
    switch (action) {
      case 'close': mutate(state => { state.view.panel = null; }); break;
      case 'dataset': {
        const dataset = control.dataset.dataset;
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
        const edge = getNeighbors(currentNode(session).id, session.mode, sessionDataset(session)).find(item => otherArtist(item, currentNode(session).id) === id);
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
        });
        break;
      }
      case 'mode':
        if (!session || session.type === 'challenge') break;
        if (control.dataset.mode === 'style' && !catalogueFor(session).hasStyle) break;
        mutate(state => { const selected = activeSession(state); selected.mode = control.dataset.mode; selected.updated = Date.now(); });
        break;
      case 'back': back(); break;
      case 'reset': if (session?.type === 'challenge') showPanel('reset'); else back(true); break;
      case 'reset-confirm': back(true); break;
      case 'rotate':
        mutate(state => { const selected = activeSession(state); if (selected) selected.yaw += 0.45; }, false);
        positionNodes();
        break;
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
            const item = index >= 0 ? selected.saved.splice(index, 1)[0] : { id, source: '在曲目收藏中留下', savedAt: previousLibraryEntry?.savedAt || Date.now() };
            state.undo = { sessionId: selected.id, item, index: index >= 0 ? index : selected.saved.length, libraryTrack: previousLibraryEntry };
          } else {
            if (index < 0) selected.saved.push({ id, source: control.dataset.source || '在探索回顾中留下', savedAt: Date.now() });
            state.undo = null;
          }
          selected.updated = Date.now();
        });
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
        });
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
  }, { signal });

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
    mutate(map => {
      const current = activeSession(map);
      const returnRoamId = current?.type === 'roam' ? current.id : current?.returnRoamId || null;
      const challenge = createSession(start, 'challenge', target, returnRoamId);
      map.sessions.push(challenge);
      activateSession(map, challenge);
      map.view.panel = null;
      map.view.reviewId = null;
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
  const resize = stage ? new ResizeObserver(() => positionNodes()) : null;
  if (stage) {
    resize.observe(stage);
    stage.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const session = activeSession(api.getState().map);
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw: session.yaw, pitch: session.pitch, moved: false };
    }, { signal });
    stage.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) < 8 && !drag.moved) return;
      drag.moved = true;
      stage.setPointerCapture(event.pointerId);
      rotation = { yaw: drag.yaw + dx * 0.009, pitch: Math.max(-0.85, Math.min(0.85, drag.pitch + dy * 0.005)) };
      stage.classList.add('is-dragging');
      positionNodes();
    }, { signal });
    const finishDrag = () => {
      if (drag?.moved && rotation) {
        const finalRotation = { ...rotation };
        mutate(map => { Object.assign(activeSession(map), finalRotation); }, false);
        suppressClickUntil = Date.now() + 280;
      }
      stage.classList.remove('is-dragging');
      drag = null;
      rotation = null;
    };
    stage.addEventListener('pointerup', finishDrag, { signal });
    stage.addEventListener('pointercancel', finishDrag, { signal });
    stage.addEventListener('pointerleave', event => { if (!stage.hasPointerCapture(event.pointerId)) finishDrag(); }, { signal });
    stage.addEventListener('keydown', event => {
      if (event.target !== stage || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      mutate(map => {
        const session = activeSession(map);
        if (event.key === 'ArrowLeft') session.yaw -= 0.2;
        if (event.key === 'ArrowRight') session.yaw += 0.2;
        if (event.key === 'ArrowUp') session.pitch = Math.max(-0.85, session.pitch - 0.15);
        if (event.key === 'ArrowDown') session.pitch = Math.min(0.85, session.pitch + 0.15);
      }, false);
      positionNodes();
    }, { signal });
    positionNodes();
  }

  function positionNodes() {
    if (!stage) return;
    const session = activeSession(api.getState().map);
    if (!session) return;
    const { yaw, pitch } = rotation || session;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const nodes = [...stage.querySelectorAll('.map-node--orbit')];
    const coordinates = nodes.map((node, index) => {
      const angle = index * Math.PI * 2 / Math.max(nodes.length, 1) - 1.13;
      const x = Math.cos(angle);
      const y = Math.sin(angle) * 0.9;
      const z = Math.sin(angle * 2) * 0.4;
      const rotatedX = x * Math.cos(yaw) + z * Math.sin(yaw);
      const rotatedZ = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const rotatedY = y * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
      const depth = y * Math.sin(pitch) + rotatedZ * Math.cos(pitch);
      let px = rotatedX * Math.min(width * 0.34, 270);
      let py = rotatedY * height * 0.34;
      const distance = Math.hypot(px, py);
      const minimum = width < 480 ? 123 : 174;
      if (distance < minimum) { const factor = minimum / Math.max(distance, 0.01); px *= factor; py *= factor; }
      px = Math.max(-width / 2 + 55, Math.min(width / 2 - 55, px));
      py = Math.max(-height / 2 + 65, Math.min(height / 2 - 65, py));
      const scale = 0.87 + (depth + 1) * 0.065;
      node.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${scale})`;
      node.style.opacity = String(0.78 + (depth + 1) * 0.1);
      node.style.zIndex = depth > 0 ? '4' : '2';
      return [width / 2 + px, height / 2 + py];
    });
    const svg = stage.querySelector('[data-map-lines]');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `<g class="map-orbit-ring" fill="none" stroke-width="1"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${Math.min(width * 0.34, 270)}" ry="${height * 0.31}"/></g><g class="map-relation-lines" fill="none" stroke-width="1" ${session.mode === 'style' ? 'stroke-dasharray="3 7"' : ''}>${coordinates.map(([x, y], index) => `<path d="M${width / 2},${height / 2} Q${(width / 2 + x) / 2 + (index % 2 ? 14 : -14)},${(height / 2 + y) / 2 + 12} ${x},${y}"/>`).join('')}</g>`;
  }

  const unsubscribeSavedMusic = subscribeSavedMusic(tracks => {
    const savedIds = new Set(tracks.map(track => track.id));
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

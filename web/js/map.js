import { MAP_DATA_VERSION, artists, artistById, songs, edges, artistName, otherArtist, getNeighbors, isReachable } from './map-data.js';
import '../css/map.css';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currentNode = session => session.path[session.path.length - 1];
const activeSession = map => map.sessions.find(session => session.id === map.activeId);
const sessionById = (map, id) => map.sessions.find(session => session.id === id);
const modeName = mode => mode === 'co' ? '合作关系' : '风格联系';
const dateLabel = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
let lastPresentedArtist = null;

function createSession(start, type = 'roam', target = null, returnRoamId = null) {
  const now = Date.now();
  return {
    id: globalThis.crypto?.randomUUID?.() || `map-${now}-${Math.random().toString(36).slice(2, 8)}`,
    version: MAP_DATA_VERSION, type, start, target, returnRoamId,
    status: 'active', mode: 'co', yaw: 0, pitch: 0,
    path: [{ id: start, mode: 'co', yaw: 0, pitch: 0 }],
    events: [], saved: [], created: now, updated: now,
  };
}

export function createMapState() {
  const initial = createSession('a');
  return {
    version: MAP_DATA_VERSION,
    sessions: [initial], activeId: initial.id, undo: null,
    view: { panel: null, reviewId: null, query: '', challengeStart: 'a', challengeEnd: 'f', challengeError: '' },
  };
}

function button(action, label, className = 'button button--quiet', attrs = '') {
  return `<button type="button" class="${className}" data-map-action="${action}" ${attrs}>${label}</button>`;
}

function tracksHTML(session, trackIds, api, source = '') {
  return trackIds.map((id, index) => {
    const song = songs[id];
    if (!song) return '';
    const saved = session.saved.some(item => item.id === id);
    return `<div class="map-track">
      <span class="map-track__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="map-track__copy"><strong>${escapeHTML(song.title)}</strong><span>${song.artists.map(artistName).map(escapeHTML).join(' / ')}</span></div>
      ${button('save', api.icon(saved ? 'check' : 'plus'), `icon-button map-track__save ${saved ? 'is-saved' : ''}`, `data-id="${id}" data-session="${session.id}" data-source="${escapeHTML(source)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(song.title)}》" aria-pressed="${saved}" title="${saved ? '已留下，点击移除' : '留下这首作品'}"`)}
    </div>`;
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
    const saved = edge.song && session.saved.some(item => item.id === edge.song);
    const source = `通过${artistName(previous.id)}与${artistName(node.id)}的合作作品留下`;
    const canUndo = undo?.sessionId === session.id && undo.item.id === edge.song;
    return `<section class="map-discovery" aria-label="当前路线的这一跳">
      <div class="map-discovery__copy"><span class="map-discovery__label">这一跳 · ${modeName(edge.mode)}</span>
        <p>${origin} <span class="map-discovery__arrow" aria-hidden="true">→</span> <strong>${destination}</strong>${edge.song ? `，由《${escapeHTML(songs[edge.song].title)}》相连。` : `，沿着「${escapeHTML(edge.reason)}」这个标签。`}</p>
        <small>${edge.song ? '虚构示例合作 · 暂无音频' : '示例风格标签，不代表合作，也未经音频分析。'}</small>
      </div>
      ${edge.song ? `<div class="map-discovery__actions">${button('save', `${api.icon(saved ? 'check' : 'plus')} ${saved ? '已留下' : '留下这首'}`, `button ${saved ? 'button--quiet is-saved' : 'button--primary'}`, `data-id="${edge.song}" data-session="${session.id}" data-source="${escapeHTML(source)}" aria-label="${saved ? '移除' : '留下'}《${escapeHTML(songs[edge.song].title)}》" aria-pressed="${saved}"`)}${canUndo ? button('undo', '撤销移除', 'button button--quiet') : ''}</div>` : ''}
    </section>`;
  }

  const nextEdge = getNeighbors(node.id, session.mode)[0];
  if (!nextEdge) {
    const hasStyleLinks = session.mode === 'co' && getNeighbors(node.id, 'style').length > 0;
    return `<section class="map-discovery map-discovery--first" aria-label="探索提示"><div class="map-discovery__copy"><span class="map-discovery__label">从${escapeHTML(artistName(node.id))}出发</span><p>这里暂未收录${modeName(session.mode)}。</p><small>${hasStyleLinks ? '可以换到风格标签，看看另一种联系。' : '当前只是小范围示例图谱，可以换个起点继续。'}</small></div><div class="map-discovery__actions">${hasStyleLinks ? button('mode', `看看风格联系 ${api.icon('arrow-right')}`, 'button button--quiet', 'data-mode="style"') : button('search', '换个起点', 'button button--quiet')}</div></section>`;
  }
  const nextId = otherArtist(nextEdge, node.id);
  const hasExplored = session.events.some(event => event.type === 'move');
  return `<section class="map-discovery map-discovery--first" aria-label="第一步探索建议">
    <div class="map-discovery__copy"><span class="map-discovery__label">${hasExplored ? '回到起点，再选一个方向' : '先走一小步'}</span>
      <p>点${escapeHTML(artistName(nextId))}，${nextEdge.song ? `沿《${escapeHTML(songs[nextEdge.song].title)}》认识下一位艺人。` : `沿「${escapeHTML(nextEdge.reason)}」看看另一种联系。`}</p>
      <small>${session.type === 'challenge' ? '这里只提供一个可走方向；每段合作计一步，返回会撤销一步。' : '也可以直接点图中的其他名字，自由选择方向。'}</small>
    </div><div class="map-discovery__actions">${button('move', `去看看${escapeHTML(artistName(nextId))} ${api.icon('arrow-right')}`, 'button button--primary', `data-id="${nextId}"`)}</div>
  </section>`;
}

function mapHTML(map, api, presentation = 'quiet') {
  const session = activeSession(map);
  if (!session) return `<section class="map-empty empty-state"><h2>从一位艺人重新出发</h2><p>旧记录仍在你的发现里。</p>${button('new', '开始探索', 'button button--primary', 'data-id="a"')}</section>`;
  const node = currentNode(session);
  const artist = artistById[node.id];
  const neighbors = getNeighbors(node.id, session.mode);
  const isChallenge = session.type === 'challenge';
  const isComplete = session.status === 'complete';
  const isEventArtist = ['a', 'b'].includes(node.id);
  return `<section class="map-experience map-experience--${presentation}" aria-label="音乐关系探索">
    <div class="map-heading">
      <div class="map-heading__title"><span class="eyebrow">MUSIC MAP — FOLLOW A CONNECTION</span><h1><span class="map-title-line"><span>${isChallenge ? '沿着合作，' : '顺着喜欢，'}</span></span><span class="map-title-line map-title-line--accent"><span>${isChallenge ? `去遇见${escapeHTML(artistName(session.target))}。` : '再走远一点。'}</span></span></h1></div>
      <div class="map-heading__aside"><p>沿一首合作，发现新的声音。<br>让音乐带你遇见下一种可能。</p><div class="map-heading__actions">${button('search', `${api.icon('compass')} 换个起点`, 'button button--quiet')}${button('challenge', `合作挑战 ${api.icon('arrow-up-right')}`)}</div></div>
    </div>
    ${isChallenge ? `<div class="map-challenge-banner"><div><span class="map-challenge-banner__label">${isComplete ? '已抵达' : '独立挑战局'}</span><strong>${escapeHTML(artistName(session.start))} ${api.icon('arrow-right')} ${escapeHTML(artistName(session.target))}</strong></div><span><b>${session.path.length - 1}</b> 步 · 不限时、不限步数</span>${button('return-roam', '回到原漫游', 'button button--quiet', `data-session="${session.id}"`)}</div>` : ''}
    <div class="map-workspace">
      <div class="map-stage-column">
        <div class="map-stage-top"><div class="map-mode-switch" aria-label="关系类型">${button('mode', '合作关系', session.mode === 'co' ? 'is-active' : '', `data-mode="co" aria-pressed="${session.mode === 'co'}"`)}${button('mode', '风格联系', session.mode === 'style' ? 'is-active' : '', `data-mode="style" aria-pressed="${session.mode === 'style'}" ${isChallenge ? 'disabled title="挑战只沿合作关系前进"' : ''}`)}</div><span class="map-demo-label">9 位示例艺人 <span aria-hidden="true">/</span> ${neighbors.length} 条连接</span></div>
        ${discoveryHTML(session, api, map.undo)}
        <div class="map-stage" data-map-stage tabindex="0" role="group" aria-label="${escapeHTML(artist.name)}的关系图。可拖动或使用方向键旋转，也可使用下方完整邻居列表。">
          <div class="map-optical-field" aria-hidden="true"><span></span><span></span></div>
          <svg class="map-graph-lines" data-map-lines aria-hidden="true"></svg>
          <span class="map-stage__axis map-stage__axis--x" aria-hidden="true"></span><span class="map-stage__axis map-stage__axis--y" aria-hidden="true"></span>
          <button type="button" class="map-node map-node--center ${artist.name.length > 3 ? 'map-node--long' : ''}" data-map-action="artist" style="--node-tone:${artist.color}" aria-label="查看${escapeHTML(artist.name)}的代表作">
            <span class="map-node__disc" aria-hidden="true"><i></i></span><span class="map-node__overline">当前声音</span><span class="map-node__name">${escapeHTML(artist.name)}</span><span class="map-node__tag">${escapeHTML(artist.tag)}</span><span class="map-node__hint">代表作 ${api.icon('arrow-up-right')}</span>
          </button>
          ${neighbors.map(edge => { const next = artistById[otherArtist(edge, node.id)]; return `<button type="button" class="map-node map-node--orbit" data-map-action="move" data-id="${next.id}" style="--node-tone:${next.color}" aria-label="沿${escapeHTML(edge.reason)}探索${escapeHTML(next.name)}" ${isComplete ? 'disabled' : ''}><span class="map-node__disc" aria-hidden="true"><i></i></span><span class="map-node__name">${escapeHTML(next.name)}</span><span class="map-node__tag">${escapeHTML(edge.song ? songs[edge.song].title : edge.reason)}</span></button>`; }).join('')}
          ${!neighbors.length ? '<span class="map-stage__no-links">这里还没有收录连接<br>试试风格模式，或换一个起点</span>' : ''}
        </div>
        <div class="map-stage-caption"><span>拖动看看另一面。<b>点击艺人，继续探索。</b></span>${button('rotate', api.icon('rotate'), 'icon-button', 'aria-label="旋转关系图" title="旋转关系图"')}</div>
        <div class="map-route-bar"><div class="map-route-controls">${button('back', api.icon('arrow-left'), 'icon-button', `aria-label="返回上一位${isChallenge ? '并撤销一步' : ''}" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}${button('reset', api.icon('rotate'), 'icon-button', `aria-label="回到起点" ${session.path.length < 2 || isComplete ? 'disabled' : ''}`)}</div><div class="map-route-trail" aria-label="当前路线">${session.path.map((step, index) => `<span ${index === session.path.length - 1 ? 'aria-current="step"' : ''}>${escapeHTML(artistName(step.id))}</span>`).join('<span class="map-route-trail__arrow" aria-hidden="true">/</span>')}</div>${button('recap', `${session.saved.length} 首留下 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-session="${session.id}"`)}</div>
      </div>
      <aside class="map-artist-panel" aria-label="${escapeHTML(artist.name)}的作品与连接">
        <div class="map-artist-panel__heading"><div><span class="eyebrow">IN FOCUS / 当前艺人</span><h2>${escapeHTML(artist.name)}</h2></div><span class="map-artist-mark" style="--node-tone:${artist.color}" aria-hidden="true"></span></div>
        <p class="map-artist-bio">${escapeHTML(artist.bio)}。<br><span>${escapeHTML(artist.tag)}</span></p>
        <div class="map-section-label"><h3>代表作</h3><span>查看 / 留下</span></div>
        ${tracksHTML(session, artist.songs.map((_, index) => `${artist.id}-${index}`), api, `在${artist.name}的代表作中留下`)}
        <p class="map-audio-note">虚构示例作品 · 尚无音源，不可试听。</p>
        <div class="map-section-label map-section-label--neighbors"><h3>全部连接 <span>${neighbors.length}</span></h3>${button('relations', '看依据', 'button button--quiet')}</div>
        <div class="map-neighbor-list">${neighbors.map(edge => { const next = artistById[otherArtist(edge, node.id)]; return `<button type="button" class="map-neighbor" data-map-action="move" data-id="${next.id}" ${isComplete ? 'disabled' : ''}><span class="map-neighbor__tone" style="--node-tone:${next.color}" aria-hidden="true"></span><span><strong>${escapeHTML(next.name)}</strong><small>${edge.song ? `合作《${escapeHTML(songs[edge.song].title)}》` : `风格 · ${escapeHTML(edge.reason)}`}</small></span>${api.icon('arrow-up-right')}</button>`; }).join('') || '<p class="map-inline-empty">当前模式暂无收录关系。</p>'}</div>
      </aside>
    </div>
    ${undoHTML(map, api)}
    <div class="map-foot"><p>关系与作品均为虚构示例；收藏和路线只保存在此浏览器。</p><div>${button('recap', '回顾分支', 'button button--quiet', `data-session="${session.id}"`)}${isChallenge ? button(isComplete ? 'recap' : 'return-roam', isComplete ? '查看挑战结果' : '保存并返回漫游', 'button button--quiet', `data-session="${session.id}"`) : button('finish', '结束这次探索', 'button button--quiet')}</div></div>
    <button type="button" class="map-space-bridge" data-map-action="space"><span class="map-space-bridge__stamp" aria-hidden="true"><i></i><i></i><i></i></span><span class="map-space-bridge__copy"><small>${isEventArtist ? `${escapeHTML(artist.name)}参与的示例现场` : '另一个音乐场景 · 与当前艺人暂无场次关联'} / 回声现场 · 夏末特别场</small><strong>同一场现场，<em>另一种回声。</em></strong><span>林间、乔屿的示例场次 · 用你的现场卡，交换另一种视角。回来可继续这次探索。</span></span><span class="map-space-bridge__action">${isEventArtist ? '进入关联 Space' : '看看示例 Space'} ${api.icon('arrow-up-right')}</span></button>
    ${panelHTML(map, api)}
  </section>`;
}

function searchResultsHTML(query) {
  const matches = artists.filter(artist => `${artist.name}${artist.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
  return matches.length ? matches.map(artist => `<button type="button" class="map-search-result" data-map-action="new" data-id="${artist.id}"><span class="map-search-result__tone" style="--node-tone:${artist.color}" aria-hidden="true"></span><span><strong>${escapeHTML(artist.name)}</strong><small>${escapeHTML(artist.tag)}</small></span><span aria-hidden="true">↗</span></button>`).join('') : '<p class="empty-state">没有找到这位示例艺人。试试「林间」或「乔屿」。</p>';
}

function visitedArtists(session) {
  if (session.type === 'challenge') return [...new Set(session.path.map(step => step.id))];
  return [...new Set([session.start, ...session.events.filter(event => event.type === 'move').map(event => event.to)])];
}

function recapHTML(session, api) {
  const visited = visitedArtists(session);
  const currentRoute = session.path.map(step => artistName(step.id)).join(' → ');
  const isChallenge = session.type === 'challenge';
  return `<div class="map-recap-intro"><span class="eyebrow">${isChallenge ? '合作挑战' : '自由漫游'} / ${dateLabel(session.created)}</span><h2>${isChallenge && session.status === 'complete' ? `${session.path.length - 1} 步，遇见${escapeHTML(artistName(session.target))}。` : `从${escapeHTML(artistName(session.start))}出发的这一程`}</h2><p>${isChallenge ? '每段合作连接计一步，返回会撤销一步。' : '走过的分支也有自己的风景。'} 未收录真实音频。</p></div>
    <div class="map-recap-stats"><span><b>${visited.length}</b> 位途经艺人</span><span><b>${session.saved.length}</b> 首主动留下</span><span><b>${session.path.length - 1}</b> 段当前路线</span></div>
    <section class="map-recap-section"><h3>留下的作品</h3>${session.saved.length ? tracksHTML(session, session.saved.map(item => item.id), api) : '<p class="map-inline-empty">还没有主动留下作品。路线会保留，喜欢可以慢慢发现。</p>'}</section>
    <section class="map-recap-section"><h3>${isChallenge && session.status === 'complete' ? '抵达路线' : '当前路线'}</h3><p class="map-current-route">${escapeHTML(currentRoute)}</p></section>
    <details class="map-route-details" open><summary>全部分支与连接依据 <span>${session.events.filter(event => event.type === 'move').length} 次探索</span></summary><div class="map-timeline">${session.events.map(event => {
      if (event.type !== 'move') return `<div class="map-timeline__return">${event.type === 'reset' ? '回到起点' : '返回'} ${escapeHTML(artistName(event.to))}${isChallenge ? ' · 撤销对应步数' : ' · 换个方向'}</div>`;
      const edge = edges.find(item => item.id === event.edgeId);
      return `<div class="map-timeline__stop"><h4>${escapeHTML(artistName(event.from))} <span>→</span> ${escapeHTML(artistName(event.to))}</h4><p>${edge ? `${modeName(edge.mode)} · ${escapeHTML(edge.evidence)}` : '示例连接'}</p>${edge?.song ? tracksHTML(session, [edge.song], api, `通过${artistName(event.from)}与${artistName(event.to)}的合作作品留下`) : ''}</div>`;
    }).join('') || '<p class="map-inline-empty">这一程还没有走到下一位。</p>'}</div></details>
    <div class="map-panel-actions">${session.status !== 'complete' ? button('resume', isChallenge ? '继续这局挑战' : '继续这次探索', 'button button--primary', `data-session="${session.id}"`) : button('challenge', '再开一局', 'button button--primary')}${isChallenge ? button('return-roam', '回到原漫游', 'button button--quiet', `data-session="${session.id}"`) : button('search', '从新的起点出发', 'button button--quiet')}</div>
    <p class="map-storage-note">仅保存在当前浏览器，清除浏览器数据会丢失。</p>`;
}

function panelHTML(map, api, recordsOnly = false) {
  const panel = map.view.panel;
  if (!panel || (recordsOnly && !['recap', 'delete'].includes(panel))) return '';
  const session = sessionById(map, map.view.reviewId) || activeSession(map);
  let content = '';
  if (panel === 'search') content = `<span class="eyebrow">换个起点</span><h2>今天，从谁开始？</h2><p class="map-panel-description">当前探索会留在记录里，新探索从空清单开始。</p><label class="map-search-label" for="map-artist-search">搜索九位示例艺人</label><input id="map-artist-search" class="map-input" type="search" placeholder="搜索名字或风格，如 林间、民谣" value="${escapeHTML(map.view.query)}" autocomplete="off"><div class="map-search-results" data-map-search-results>${searchResultsHTML(map.view.query)}</div>`;
  if (panel === 'challenge') content = `<span class="eyebrow">沿着合作去相遇</span><h2>两位艺人之间，<br>藏着几首歌？</h2><p class="map-panel-description">只沿合作关系前进，没有倒计时，也不必走最短的路。本局与自由漫游分别保存。</p><form data-map-challenge-form><label class="map-field">从谁出发<select name="start">${artists.map(artist => `<option value="${artist.id}" ${map.view.challengeStart === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><label class="map-field">想遇见谁<select name="target">${artists.map(artist => `<option value="${artist.id}" ${map.view.challengeEnd === artist.id ? 'selected' : ''}>${escapeHTML(artist.name)}</option>`).join('')}</select></label><p class="map-form-error" data-map-challenge-error role="alert">${escapeHTML(map.view.challengeError)}</p><button class="button button--primary" type="submit">开始这局挑战 ${api.icon('arrow-right')}</button></form><p class="map-storage-note">每段连接 +1 步，返回撤销一步。选择「孤岛来客」可查看关系尚未连通的反馈。</p>`;
  if (panel === 'artist' && session) { const artist = artistById[currentNode(session).id]; content = `<span class="eyebrow">代表作 / 示例目录</span><h2>${escapeHTML(artist.name)}</h2><p class="map-panel-description">${escapeHTML(artist.bio)}。全部为虚构作品，尚无音源，不可试听。</p>${tracksHTML(session, artist.songs.map((_, index) => `${artist.id}-${index}`), api, `在${artist.name}的代表作中留下`)}`; }
  if (panel === 'relations' && session) {
    const id = currentNode(session).id;
    content = `<span class="eyebrow">${modeName(session.mode)} / 依据</span><h2>为什么相连？</h2><p class="map-panel-description">这些是虚构关系示例，演示每条连接怎样提供依据。</p>${getNeighbors(id, session.mode).map(edge => `<section class="map-relation-proof"><h3>${escapeHTML(artistName(id))} <span>↔</span> ${escapeHTML(artistName(otherArtist(edge, id)))}</h3><p>${escapeHTML(edge.evidence)}</p>${edge.song ? tracksHTML(session, [edge.song], api, `通过${artistName(edge.a)}与${artistName(edge.b)}的合作作品留下`) : ''}</section>`).join('') || '<p class="map-inline-empty">当前没有已收录的连接。</p>'}`;
  }
  if (panel === 'recap' && session) content = recapHTML(session, api);
  if (panel === 'delete' && session) content = `<span class="eyebrow">删除记录</span><h2>删除这一程？</h2><p class="map-panel-description">从${escapeHTML(artistName(session.start))}出发的路线、分支与留下的作品都会删除，其他记录不受影响。</p><div class="map-panel-actions">${button('delete-confirm', '删除这条记录', 'button button--primary', `data-session="${session.id}"`)}${button('close', '保留记录')}</div>`;
  if (panel === 'reset' && session) content = `<span class="eyebrow">回到起点</span><h2>从${escapeHTML(artistName(session.start))}重新找路？</h2><p class="map-panel-description">当前路线与步数归零，已留下的作品和走过的分支仍会保留。</p><div class="map-panel-actions">${button('reset-confirm', '回到起点', 'button button--primary')}${button('close', '继续当前路线')}</div>`;
  return `<dialog class="map-dialog" aria-label="${panel === 'recap' ? '探索回顾' : panel === 'challenge' ? '创建合作挑战' : '音乐探索面板'}"><div class="map-dialog__top">${button('close', api.icon('x'), 'icon-button', 'aria-label="关闭面板"')}</div><div class="map-dialog__content">${content}${undoHTML(map, api)}</div></dialog>`;
}

function recordsHTML(map, api) {
  const records = [...map.sessions].sort((a, b) => b.updated - a.updated);
  return `<section class="map-records" aria-label="音乐探索记录"><div class="map-records-heading"><div><span class="eyebrow">MUSIC MAP</span><h2>走过的路，留下的喜欢。</h2></div><span class="muted">${records.length} 次探索</span></div><div class="map-record-list">${records.map(session => `<article class="map-record"><div class="map-record__disc" style="--node-tone:${artistById[session.start].color}" aria-hidden="true"><span>${String(session.path.length - 1).padStart(2, '0')}</span></div><div class="map-record__copy"><span class="map-record__meta">${session.type === 'challenge' ? '合作挑战' : '自由漫游'} · ${session.status === 'complete' ? '已抵达' : session.status === 'ended' ? '已收好' : '进行中'} · ${dateLabel(session.created)}</span><h3>${escapeHTML(artistName(session.start))}${session.target ? ` → ${escapeHTML(artistName(session.target))}` : '出发的旅程'}</h3><p>${visitedArtists(session).length} 位艺人 · ${session.saved.length} 首留下 · ${session.path.length - 1} 段当前路线</p></div><div class="map-record__actions">${button('recap', `回顾 ${api.icon('arrow-up-right')}`, 'button button--quiet', `data-session="${session.id}"`)}${session.status !== 'complete' ? button('resume', '继续', 'button button--quiet', `data-session="${session.id}"`) : ''}${button('delete', api.icon('trash'), 'icon-button', `data-session="${session.id}" aria-label="删除从${escapeHTML(artistName(session.start))}出发的记录"`)}</div></article>`).join('') || `<div class="empty-state"><h3>还没有探索记录</h3><p>从一个熟悉的名字出发。</p>${button('new', '去探索', 'button button--primary', 'data-id="a"')}</div>`}</div><p class="map-storage-note">路线和主动留下的作品仅存在当前浏览器，不跨设备同步。</p>${undoHTML(map, api)}${panelHTML(map, api, true)}</section>`;
}

function startRoam(map, id) {
  const previous = activeSession(map);
  if (previous?.type === 'roam' && previous.status === 'active') previous.status = 'ended';
  const session = createSession(id);
  map.sessions.push(session);
  map.activeId = session.id;
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
    const previousPanel = api.getState().map.view.panel;
    api.update(state => fn(state.map));
    if (redraw) {
      api.render();
      if (previousPanel && api.getState().map.view.panel === previousPanel) {
        const currentContainer = container.isConnected ? container : document.getElementById(container.id);
        const newDialog = currentContainer?.querySelector('.map-dialog');
        if (newDialog) newDialog.scrollTop = dialogScroll;
      }
    }
  };
  const showPanel = (panel, id = null) => mutate(map => {
    map.view.panel = panel;
    map.view.reviewId = id;
    if (panel === 'challenge') {
      map.view.challengeError = '';
      map.view.challengeStart = currentNode(activeSession(map) || { path: [{ id: 'a' }] }).id;
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
    if (['search', 'artist', 'relations', 'challenge', 'delete', 'recap'].includes(action)) {
      showPanel(action, sessionId || null);
      if (recordsOnly && ['search', 'challenge'].includes(action)) goExplore();
      return;
    }
    switch (action) {
      case 'close': mutate(state => { state.view.panel = null; }); break;
      case 'new':
        if (!artistById[id]) break;
        mutate(state => startRoam(state, id), false);
        goExplore();
        break;
      case 'move': {
        if (!session || session.status === 'complete') break;
        const edge = getNeighbors(currentNode(session).id, session.mode).find(item => otherArtist(item, currentNode(session).id) === id);
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
        let removed = false;
        mutate(state => {
          const selected = sessionById(state, sessionId);
          if (!selected || !songs[id]) return;
          const index = selected.saved.findIndex(item => item.id === id);
          if (index >= 0) {
            const [item] = selected.saved.splice(index, 1);
            state.undo = { sessionId: selected.id, item, index };
            removed = true;
          } else {
            selected.saved.push({ id, source: control.dataset.source || '在探索回顾中留下', savedAt: Date.now() });
            state.undo = null;
          }
          selected.updated = Date.now();
        });
        api.toast(removed ? '已移除，可撤销' : '已留下这首作品');
        break;
      }
      case 'undo':
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
      case 'finish':
        mutate(state => { const selected = activeSession(state); if (!selected) return; selected.status = 'ended'; selected.updated = Date.now(); state.view.panel = 'recap'; state.view.reviewId = selected.id; });
        break;
      case 'resume':
        mutate(state => { const selected = sessionById(state, sessionId); if (!selected) return; state.activeId = selected.id; if (selected.status !== 'complete') selected.status = 'active'; selected.updated = Date.now(); state.view.panel = null; state.view.reviewId = null; }, false);
        goExplore();
        break;
      case 'return-roam':
        mutate(state => {
          const selected = sessionById(state, sessionId) || activeSession(state);
          if (!selected || selected.type !== 'challenge') return;
          selected.updated = Date.now();
          const original = sessionById(state, selected.returnRoamId);
          if (original) { state.activeId = original.id; original.status = 'active'; }
          else startRoam(state, currentNode(selected).id);
          state.view.panel = null;
          state.view.reviewId = null;
        }, false);
        goExplore();
        break;
      case 'delete-confirm':
        mutate(state => {
          state.sessions = state.sessions.filter(item => item.id !== sessionId);
          if (state.activeId === sessionId) state.activeId = state.sessions.find(item => item.type === 'roam')?.id || null;
          if (state.undo?.sessionId === sessionId) state.undo = null;
          state.view.panel = null;
          state.view.reviewId = null;
        });
        api.toast('已删除这条记录');
        break;
      case 'space':
        api.update(state => { state.space.mapReturnId = session?.id || null; });
        api.navigate('space');
        break;
    }
  }, { signal });

  container.addEventListener('input', event => {
    if (event.target.id !== 'map-artist-search') return;
    const query = event.target.value;
    mutate(map => { map.view.query = query; }, false);
    container.querySelector('[data-map-search-results]').innerHTML = searchResultsHTML(query);
  }, { signal });

  container.addEventListener('submit', event => {
    if (!event.target.matches('[data-map-challenge-form]')) return;
    event.preventDefault();
    const data = new FormData(event.target);
    const start = data.get('start');
    const target = data.get('target');
    const error = start === target ? '出发点和终点相同，换一位想遇见的艺人吧。' : !isReachable(start, target) ? '当前收录的合作关系尚未连通，请换个起点或终点。' : '';
    mutate(map => { map.view.challengeStart = start; map.view.challengeEnd = target; map.view.challengeError = error; }, false);
    if (error) { container.querySelector('[data-map-challenge-error]').textContent = error; return; }
    mutate(map => {
      const current = activeSession(map);
      const returnRoamId = current?.type === 'roam' ? current.id : current?.returnRoamId || null;
      const challenge = createSession(start, 'challenge', target, returnRoamId);
      map.sessions.push(challenge);
      map.activeId = challenge.id;
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
      let px = rotatedX * Math.min(width * 0.33, 240);
      let py = rotatedY * height * 0.34;
      const distance = Math.hypot(px, py);
      const minimum = width < 480 ? 104 : 127;
      if (distance < minimum) { const factor = minimum / Math.max(distance, 0.01); px *= factor; py *= factor; }
      const scale = 0.87 + (depth + 1) * 0.065;
      node.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${scale})`;
      node.style.opacity = String(0.78 + (depth + 1) * 0.1);
      node.style.zIndex = depth > 0 ? '4' : '2';
      return [width / 2 + px, height / 2 + py];
    });
    const svg = stage.querySelector('[data-map-lines]');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `<g fill="none" stroke="rgba(112,221,207,.10)" stroke-width="1"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.39}" ry="${height * 0.37}"/><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.39}" ry="${height * 0.13}" transform="rotate(${yaw * 18 - 18} ${width / 2} ${height / 2})"/><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.16}" ry="${height * 0.38}" transform="rotate(${pitch * 20 + 27} ${width / 2} ${height / 2})"/></g><g fill="none" stroke="${session.mode === 'co' ? 'rgba(112,221,207,.55)' : 'rgba(255,126,89,.58)'}" stroke-width="1.2" ${session.mode === 'style' ? 'stroke-dasharray="4 6"' : ''}>${coordinates.map(([x, y], index) => `<path d="M${width / 2},${height / 2} Q${(width / 2 + x) / 2 + (index % 2 ? 20 : -20)},${(height / 2 + y) / 2 + 18} ${x},${y}"/>`).join('')}</g>`;
  }

  return () => {
    abort.abort();
    resize?.disconnect();
    if (dialog?.open) dialog.close();
  };
}

export function mountMap(container, api) {
  const payload = api.getState().routePayload;
  if (payload?.resumeSessionId) {
    const original = sessionById(api.getState().map, payload.resumeSessionId);
    api.update(state => {
      if (original) {
        state.map.activeId = original.id;
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
  container.innerHTML = recordsHTML(api.getState().map, api);
  return attachInteractions(container, api, true);
}

import { SPACE_EVENT, SPACE_MOMENTS, SPACE_PHOTOS } from './space-data.js';
import { downloadTicket, downloadCard } from './ticket-export.js';
import { createPhotoStore, preparePhoto } from './live-photo.js';
import { openDuetCeremony } from './duet-ceremony.js';
import { momentLabel, perspectiveLabel, sharedLine } from './duet-facts.js';
import qrcode from 'qrcode-generator';

const SESSION_KEY = 'music-map-live:v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const momentName = id => SPACE_MOMENTS.find(item => item.id === id)?.name || '现场瞬间';
const demoEvent = { id: SPACE_EVENT.id, title: `${SPACE_EVENT.title} / ${SPACE_EVENT.subtitle}`, date: '2026-09-26', city: SPACE_EVENT.city, song: SPACE_EVENT.song, isDemo: true };
const PERSPECTIVES = [{ id: 'stage', name: '舞台', detail: '灯光下的那一面' }, { id: 'crowd', name: '人海', detail: '一起举手的那一面' }, { id: 'friends', name: '身边', detail: '陪你听歌的那一面' }, { id: 'detail', name: '细节', detail: '只有你留意的那一面' }];
const perspectiveName = card => PERSPECTIVES.find(item => item.id === (card.perspective || card.photoKey))?.name || '现场';
const photoPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="#153637" d="M0 0h1v1H0z"/></svg>')}`;
const dateLabel = value => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const completedAt = item => item.decidedAt || item.createdAt;

export function mountLive(container, api) {
  const life = new AbortController();
  const { signal } = life;
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* A new session can still run in memory. */ }
  if (!session?.token) session = null;
  let room = null;
  let roomAuthorized = false;
  let rooms = [];
  let healthy = false;
  let checking = true;
  let busy = false;
  let polling = false;
  let errorMessage = '';
  let storageFailed = false;
  let interval;
  let currentModal = null;
  let requestTarget = null;
  let ceremony = null;
  const entryPayload = api.getState().routePayload || {};
  let songDraft = typeof entryPayload.songDraft?.title === 'string' ? entryPayload.songDraft : null;
  const requestedRoomId = typeof entryPayload.roomId === 'string' ? entryPayload.roomId : null;
  let makeRequested = entryPayload.intent === 'make-card';
  let inviteRequested = entryPayload.intent === 'invite';
  let joinCode = entryPayload.intent === 'join-room' ? String(entryPayload.joinCode || '') : new URLSearchParams(location.search).get('room') || session?.rejoinCode || '';
  let entryName = '';
  let draft = null;
  let draftRoomId = null;
  let draftChanged = false;
  let editorStep = 'photo';
  let version = 0;
  let photoPreparing = false;
  let photoSelection = 0;
  let createRequested = entryPayload.intent === 'create-room' || Boolean(songDraft) || ((makeRequested || inviteRequested) && !session?.roomId && !requestedRoomId);
  let entryMode = createRequested || makeRequested ? 'create' : 'join';
  let eventDraft = { title: '', eventDate: '', city: '', song: songDraft?.title.slice(0, 80) || '' };
  const photos = createPhotoStore(() => session?.token, signal);
  if (createRequested || makeRequested || inviteRequested || requestedRoomId || entryPayload.intent === 'join-room') api.update(state => { state.routePayload = null; });

  container.innerHTML = `<div class="live-page"><div id="live-surface" aria-live="off"></div><dialog class="live-dialog" aria-labelledby="live-dialog-title"><div id="live-dialog-content"></div></dialog></div>`;
  const surface = container.querySelector('#live-surface');
  const dialog = container.querySelector('dialog');
  const modal = container.querySelector('#live-dialog-content');
  const icon = api.icon;

  const eventOf = card => card?.event || room?.room.event || demoEvent;
  const photo = card => card?.photoId ? photos.peek(card.photoId) || photoPlaceholder : SPACE_PHOTOS[card?.photoKey]?.url || SPACE_PHOTOS.stage.url;
  function photoMarkup(card, alt = '') {
    return `<img src="${photo(card)}" ${card.photoId ? `data-live-photo="${escape(card.photoId)}"` : ''} alt="${escape(alt || (card.photoId ? `${card.ownerName || '我的'}现场照片` : 'AI 生成的示例照片'))}" loading="lazy">${card.photoId && !photos.peek(card.photoId) ? '<small class="live-photo-status">照片读取中</small>' : ''}`;
  }
  function hydratePhotos(root = container) {
    root.querySelectorAll('img[data-live-photo]').forEach(async image => {
      try {
        const url = await photos.load(image.dataset.livePhoto);
        if (!signal.aborted && image.isConnected) {
          image.src = url;
          image.parentElement.querySelector('.live-photo-status')?.remove();
          publishScene();
        }
      } catch (error) {
        if (error.name !== 'AbortError' && image.isConnected) {
          image.alt = '照片暂时无法读取';
          const label = image.parentElement.querySelector('.live-photo-status');
          if (label) label.textContent = '照片暂未读到 · 可刷新重试';
        }
      }
    });
  }

  function publishScene() {
    if (signal.aborted) return;
    const visible = room && roomAuthorized ? [
      ...(room.ownCard ? [room.ownCard] : []),
      ...room.cards.filter(card => card.ownerId !== room.me.id && card.isPublic),
    ] : [];
    const cards = visible.map(card => {
      const event = eventOf(card);
      return {
        id: card.id,
        isOwn: card.ownerId === room.me.id,
        src: card.photoId ? photos.peek(card.photoId) : SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url,
        title: card.caption || momentName(card.momentId),
        subtitle: `${card.ownerName} · ${event.isDemo ? '示例场次' : '房间内'}${card.photoId ? '' : ' · AI 示例图'}`,
        alt: card.photoId ? `${card.ownerName}的现场照片` : `${card.ownerName}选用的 AI 示例照片`,
        isDemo: Boolean(event.isDemo || !card.photoId),
      };
    }).filter(card => card.src).slice(0, 6);
    api.spatial?.publish({ mode: 'live', cards, onPhoto: openPhoto, onEdit: room && roomAuthorized ? () => { if (!signal.aborted && !busy) openEditor(); } : null });
  }

  function clearPhotos() {
    api.spatial?.publish({ mode: 'live', cards: [] });
    photos.clear();
  }

  function openPhoto(id) {
    if (signal.aborted || busy || !room || !roomAuthorized) return;
    if (room.ownCard?.id === id) {
      const own = room.ownCard;
      openModal('card', '我的现场卡', `${miniCard(own)}<p class="live-modal-intro">${own.isPublic ? '房间内展示' : '私藏 · 未展示'}</p><div class="live-ticket-actions"><button class="button button--primary" data-live-action="edit">编辑现场卡 ${icon('arrow-right')}</button><button class="button button--secondary" data-live-action="download-card">保存我的卡片 ${icon('arrow-up-right')}</button></div>`, '', own.id);
      return;
    }
    if (room.cards.some(card => card.id === id && card.isPublic)) openRequest(id);
  }
  async function exportCard(card) {
    return { ...card, photoDataUrl: card.photoId ? await photos.load(card.photoId) : undefined };
  }
  function exportInfo(card, item = card) {
    const event = eventOf(card);
    return { title: event.title, song: event.song, eventDate: event.date, city: event.city, isDemo: event.isDemo, createdAt: completedAt(item), id: item.exchangeId || item.id };
  }
  function matchReason(a, b) {
    if (!a) return { score: 0, title: `${perspectiveName(b)}的视角`, detail: '先留下自己的卡，再看看两种视角如何呼应。' };
    const sameMoment = a.momentId === b.momentId;
    const differentView = (a.perspective || a.photoKey) !== (b.perspective || b.photoKey);
    if (sameMoment && differentView) return { score: 3, title: '同一瞬间，不同视角', detail: `都选了「${momentName(a.momentId)}」；你拍${perspectiveName(a)}，对方拍${perspectiveName(b)}。` };
    if (sameMoment) return { score: 2, title: '你们记住了同一瞬间', detail: `都选了「${momentName(a.momentId)}」，看看对方留住了什么。` };
    if (a.trackId && b.trackId && eventOf(a).song) return { score: 1, title: '带着同一首歌的记忆', detail: `都带上了《${eventOf(a).song}》，各自记住了不同片刻。` };
    return { score: 0, title: '现场的另一面', detail: `${momentName(b.momentId)} · ${perspectiveName(b)}，或许能补上你没看到的一面。` };
  }
  function acceptedPair(card) {
    const own = room?.ownCard;
    if (!own) return null;
    return room.exchanges.find(item => item.status === 'accepted' && [item.fromCard, item.toCard].some(snapshot => snapshot.id === own.id && snapshot.revision === own.revision) && [item.fromCard, item.toCard].some(snapshot => snapshot.id === card.id && snapshot.revision === card.revision));
  }

  function persist() {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
      storageFailed = false;
    } catch { storageFailed = true; }
  }

  async function request(path, options = {}) {
    const response = await fetch(`/api/live${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      signal,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('这个地址尚未连接同场服务。可以先体验情景演示。');
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.message || '暂时未能完成，请稍后重试。');
      error.status = response.status;
      error.code = result.error?.code;
      throw error;
    }
    return result;
  }

  function showError(error) {
    if (signal.aborted) return;
    errorMessage = error instanceof TypeError ? '暂时连接不上同场服务。你的输入仍保留，请恢复连接后重试。' : error.message;
    const target = dialog.open ? modal.querySelector('[data-modal-error]') : null;
    if (target) { target.textContent = errorMessage; target.hidden = false; }
    else render();
  }

  function setState(next) {
    if (signal.aborted) return;
    const old = room;
    if (draftRoomId && draftRoomId !== next.room.id) clearDraft();
    const photoPermissionChanged = old && (old.cards.some(card => card.photoId && !next.cards.some(current => current.id === card.id && current.photoId === card.photoId)) || old.exchanges.some(ex => ex.status === 'pending' && next.exchanges.some(current => current.id === ex.id && ['declined', 'cancelled'].includes(current.status))));
    if (photoPermissionChanged || (old?.room.id && old.room.id !== next.room.id)) clearPhotos();
    room = next;
    roomAuthorized = true;
    entryMode = 'join';
    session.roomId = next.room.id;
    session.rejoinCode = null;
    joinCode = '';
    persist();
    errorMessage = '';
    if (!rooms.some(item => item.id === next.room.id)) rooms.push(next.room);
    render();
    if (dialog.open) hydratePhotos(modal);
    const watching = dialog.open && currentModal?.name === 'exchange' ? currentModal.id : null;
    if (watching) {
      const previous = old?.exchanges.find(ex => ex.id === watching);
      const latest = next.exchanges.find(ex => ex.id === watching);
      if (latest && previous?.status !== latest.status && latest.status !== 'accepted') openExchange(latest.id);
    }
    // Only a real pending → accepted change premieres the duet, once; the exchange being watched goes first.
    const accepted = next.exchanges.filter(ex => ex.status === 'accepted' && old?.exchanges.some(previous => previous.id === ex.id && previous.status === 'pending'));
    const newlyAccepted = accepted.find(ex => ex.id === watching) || accepted[0];
    if (newlyAccepted && !ceremony && (!dialog.open || watching === newlyAccepted.id)) openTicket(newlyAccepted, { reveal: true });
    else if (newlyAccepted && !ceremony) api.toast(newlyAccepted.from === next.me.id ? '对方接受了交换，双联已保存到你的记录' : '交换完成，双联已保存到你的记录');
  }

  async function refresh(force = false) {
    if (!room || polling || busy || (!force && document.hidden)) return;
    polling = true;
    const id = room.room.id;
    const currentVersion = version;
    try {
      const next = await request(`/rooms/${id}`);
      if (currentVersion === version && room?.room.id === id) {
        if (JSON.stringify(next) !== JSON.stringify(room) || errorMessage) setState(next);
        else updateSync();
      }
    } catch (error) {
      if (!signal.aborted && currentVersion === version) {
        if (error.status === 403) { roomAuthorized = false; clearPhotos(); }
        errorMessage = error.status === 403 ? '你已离开这个房间。可返回入场页，凭邀请码重新加入。' : '同步暂时中断。上次收到的内容还在，恢复连接后会继续更新。';
        updateSync();
      }
    } finally { polling = false; }
  }

  function updateSync() {
    const element = surface.querySelector('[data-sync]');
    if (element) {
      element.textContent = errorMessage;
      element.hidden = !errorMessage;
      element.classList.toggle('is-offline', Boolean(errorMessage));
    }
  }

  async function act(work) {
    if (busy) return;
    busy = true;
    const controls = [...container.querySelectorAll('button[type="submit"], [data-live-action="decide"], [data-live-action="send"], dialog form input, dialog form textarea')].map(element => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => { element.disabled = true; });
    try { await work(); }
    catch (error) { showError(error); }
    finally {
      busy = false;
      if (!signal.aborted) {
        controls.forEach(({ element, disabled }) => { element.disabled = disabled; });
        if (currentModal?.name === 'editor') {
          const hint = modal.querySelector('[data-save-visibility]');
          if (hint) hint.textContent = modal.querySelector('[name="isPublic"]')?.checked ? '保存后，同场成员可见' : '保存后，仅自己可见';
          updateComposeAvailability();
        }
      }
    }
  }

  function miniCard(card, label = '') {
    const event = eventOf(card);
    return `<article class="live-card"><div class="live-card-photo">${photoMarkup(card)}<span>${escape(label || perspectiveName(card))}</span>${!card.photoId ? '<b class="live-example-photo">示例图</b>' : ''}</div><div class="live-card-content"><span class="live-card-author">${escape(card.ownerName)} <small>${escape(momentName(card.momentId))}</small></span><p>${escape(card.caption || '这一刻，想和你一起记住。')}</p>${card.trackId && event.song ? `<span class="live-card-track">♪ ${escape(event.song)}</span>` : ''}</div></article>`;
  }

  function banner() {
    return `${storageFailed ? '<p class="live-notice" role="alert">浏览器未能保存身份。请保持当前页面打开；关闭后可能无法找回这个身份和记录。</p>' : ''}${errorMessage && !room ? `<p class="live-notice" role="alert">${escape(errorMessage)}</p>` : ''}`;
  }

  function render() {
    if (signal.aborted) return;
    const openFolds = [...surface.querySelectorAll('details[data-room-fold][open]')].map(element => element.dataset.roomFold);
    surface.dataset.liveState = room ? 'room' : 'entry';
    surface.innerHTML = room ? roomView() : entryView();
    surface.querySelectorAll('details[data-room-fold]').forEach(element => { element.open = openFolds.includes(element.dataset.roomFold); });
    updateSync();
    hydratePhotos(surface);
    publishScene();
  }

  function entryView() {
    const sampleA = { ownerName: '你的舞台', photoKey: 'stage', perspective: 'stage', momentId: 'encore', caption: '灯亮起时，我记得这一面。', event: demoEvent };
    const sampleB = { ownerName: '朋友的人海', photoKey: 'crowd', perspective: 'crowd', momentId: 'encore', caption: '原来那一刻，你看见的是这样。', event: demoEvent };
    const creating = entryMode === 'create';
    return `<header class="live-entry-head"><button class="text-button" data-live-action="demo">${icon('arrow-left')} 返回同场</button></header>${banner()}<div class="live-entry-grid"><section class="live-entry-copy"><h1>${creating ? inviteRequested ? '和朋友约一场' : '记录这次现场' : '和朋友一起'}</h1><div class="live-gate"><div class="live-gate-heading"><b>${session ? `你好，${escape(session.user.name)}` : creating ? '先留一个现场昵称' : '进入同场'}</b><span>${checking ? '正在连接…' : healthy ? '已连接' : '未连接'}</span></div><form data-live-form="entry">${songDraft ? `<p class="live-form-note">带着《${escape(songDraft.title)}》创建自己的同场。</p>` : ''}${session ? '' : `<label class="live-field">现场昵称<input name="name" value="${escape(entryName)}" placeholder="例如：小满" autocomplete="nickname" maxlength="20" required></label>`}${creating ? '' : `<label class="live-field">邀请码 <span>加入房间时填写</span><input name="code" value="${escape(joinCode)}" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位数字" autocomplete="off"></label>`}<div class="live-gate-actions">${creating ? `<button class="button button--primary" type="submit" name="intent" value="create" ${!healthy ? 'disabled' : ''}>继续 ${icon('arrow-right')}</button>` : `<button class="button button--primary" type="submit" name="intent" value="join" ${!healthy ? 'disabled' : ''}>加入同场 ${icon('arrow-right')}</button><button class="button button--secondary" type="submit" name="intent" value="create" formnovalidate ${!healthy ? 'disabled' : ''}>创建同场 ${icon('plus')}</button>`}</div>${creating ? '<button class="text-button live-entry-switch" type="button" data-live-action="join-entry">使用邀请码加入</button>' : ''}</form>${!healthy && !checking ? `<div class="live-unavailable"><p>连接失败，可返回体验示例。</p><button class="text-button" data-live-action="reconnect">重试连接</button></div>` : ''}<p class="live-gate-note">身份保存在当前浏览器，清除网站数据后无法找回。</p></div>${session && rooms.length ? `<div class="live-recent"><span class="eyebrow">最近的房间</span>${rooms.map(item => `<button data-live-action="resume" data-room-id="${escape(item.id)}"><span>${escape(item.title)}</span><small>${escape(item.code)}</small>${icon('arrow-right')}</button>`).join('')}</div>` : ''}</section><aside class="live-entry-art" aria-label="两张现场卡构成双联记忆的示意"><div class="live-entry-pair">${miniCard(sampleA)}${miniCard(sampleB)}</div><small>AI 示例照片</small></aside></div>`;
  }

  function emptyWall(own) {
    const hasCompany = room.room.memberCount > 1;
    const title = hasCompany ? '朋友还没展示卡片' : '邀请朋友，交换视角';
    const detail = hasCompany ? '展示后，卡片会出现在这里。' : '把邀请码发给同场的朋友。';
    const action = !hasCompany ? 'invite' : !own ? 'edit' : own.isPublic ? 'refresh' : 'visibility';
    const label = { invite: '分享邀请码', edit: '制作我的现场卡', refresh: '看看有没有新视角', visibility: '展示我的现场卡' }[action];
    return `<div class="live-empty-wall"><h3>${title}</h3><p>${detail}</p><button class="button button--secondary" data-live-action="${action}">${label} ${icon('arrow-up-right')}</button></div>`;
  }

  function openCardSaved() {
    const own = room.ownCard;
    const hasCards = room.cards.some(card => card.ownerId !== room.me.id && card.isPublic);
    const action = hasCards ? 'wall' : room.room.memberCount < 2 ? 'invite' : own.isPublic ? 'wall' : 'visibility';
    const label = { wall: '看看同场卡片', invite: '邀请朋友一起', visibility: '展示到本场' }[action];
    openModal('card-saved', '现场卡已保存', `<div class="live-saved-note">${icon('check')}<div><strong>${own.isPublic ? '已展示到本场' : '这张卡先为你私藏'}</strong><p>${own.isPublic ? '交换仍需双方同意。' : '只有你可见，也能主动申请交换。'}</p></div></div><div class="live-saved-actions"><button class="button button--primary" data-live-action="${action}">${label} ${icon('arrow-right')}</button><button class="button button--secondary" data-live-action="download-card">下载我的卡片 ${icon('arrow-up-right')}</button></div><div class="live-saved-links">${!own.isPublic && action !== 'visibility' ? '<button class="text-button" data-live-action="visibility">展示到本场</button>' : ''}<button class="text-button" data-live-action="collection">去我的记录 ${icon('arrow-right')}</button><button class="text-button live-saved-later" data-live-action="close">先收好</button></div>`, 'live-dialog--saved', own.id);
  }

  function roomView() {
    const own = room.ownCard;
    const event = room.room.event || demoEvent;
    const cards = room.cards.filter(card => card.ownerId !== room.me.id).sort((a, b) => matchReason(own, b).score - matchReason(own, a).score);
    const incoming = room.exchanges.filter(ex => ex.to === room.me.id && ex.status === 'pending');
    const outgoing = room.exchanges.filter(ex => ex.from === room.me.id && ex.status === 'pending');
    const resolved = room.exchanges.filter(ex => ex.status !== 'pending').slice(-6).reverse();
    const requestRow = ex => `<div class="live-request-row"><p><b>${escape(ex.fromCard.ownerName)}</b><span>${escape(perspectiveName(ex.fromCard))} × ${escape(perspectiveName(ex.toCard))}</span></p><button class="button button--primary" data-live-action="review" data-id="${escape(ex.id)}">查看申请 ${icon('arrow-right')}</button></div>`;
    return `<div class="live-room-scene"><div class="live-room-ticket live-room-ticket--compact">${banner()}<header class="live-room-head"><div class="live-room-heading"><span class="live-paper-label">${event.isDemo ? '示例场次' : 'LIVE'} / ${escape(room.room.code || '')}</span><h1 title="${escape(event.title)}">${escape(event.title)}</h1></div><div class="live-room-tools"><details class="live-room-menu" data-room-fold="venue"><summary>本场 ${icon('chevron-right')}</summary><div class="live-room-menu__items"><div class="live-room-menu__meta"><strong>${escape(event.title)}</strong><span>${escape([event.date, event.city].filter(Boolean).join(' · '))}</span><span>${escape(room.me.name)} · ${room.room.memberCount} 人入场</span>${event.song ? `<span>♪ ${escape(event.song)}</span>` : ''}</div><button class="text-button" data-live-action="collection">我的记录 ${icon('arrow-up-right')}</button><button class="text-button" data-live-action="map">${api.getState().space?.mapReturnId ? '继续刚才的探索' : '去音乐地图'} ${icon('compass')}</button><button class="text-button" data-live-action="refresh">刷新本场 ${icon('rotate')}</button><button class="text-button" data-live-action="lobby">其他房间</button><button class="text-button" data-live-action="leave">离开本场</button></div></details><button class="button button--primary" data-live-action="invite" aria-label="邀请朋友">邀请 ${icon('arrow-up-right')}</button></div></header><span class="live-room-status" data-sync role="status" hidden></span>
    </div><div class="live-room-tray live-room-tray--compact">${incoming.length ? `<section class="live-incoming" aria-label="收到的交换申请"><div class="live-request-note">${incoming.length} 条申请待回应</div>${requestRow(incoming[0])}${incoming.length > 1 ? `<details class="live-request-more" data-room-fold="incoming"><summary>其他 ${incoming.length - 1} 条申请 ${icon('chevron-right')}</summary>${incoming.slice(1).map(requestRow).join('')}</details>` : ''}</section>` : ''}
    <section class="live-own-section">${own ? `<details class="live-own-fold" data-room-fold="own"><summary><span>我的现场卡 <small class="live-own-state ${own.isPublic ? 'is-public' : ''}">· ${own.isPublic ? '展示' : '私藏'}</small></span>${icon('chevron-right')}</summary><div class="live-own-preview">${miniCard(own)}<div class="live-own-actions"><button class="text-button" data-live-action="download-card">保存我的卡片 ${icon('arrow-up-right')}</button><button class="text-button" data-live-action="visibility">${own.isPublic ? '从本场撤下' : '展示到本场'} ${icon('arrow-up-right')}</button></div></div></details><button class="text-button live-own-edit" data-live-action="edit" aria-label="编辑我的现场卡">编辑 ${icon('arrow-up-right')}</button>` : `<div class="live-empty-card"><button class="button button--primary" data-live-action="edit">制作我的现场卡 ${icon('plus')}</button></div>`}</section>
    ${outgoing.length ? `<details class="live-pending" data-room-fold="outgoing"><summary><span>${outgoing.length} 条申请等待回应</span>${icon('chevron-right')}</summary>${outgoing.map(ex => `<div class="live-pending-row"><span>等待 <b>${escape(ex.toCard.ownerName)}</b> 回应</span><button class="text-button" data-live-action="review" data-id="${escape(ex.id)}">查看 / 取消</button></div>`).join('')}</details>` : ''}
    <div class="live-room-directories"><details class="live-wall-directory live-wall-section" data-room-fold="wall"><summary><span>同场卡片</span><small>${cards.length}</small>${icon('chevron-right')}</summary>${cards.length ? `<div class="live-wall">${cards.map(card => { const match = matchReason(own, card); const complete = acceptedPair(card); return `<div class="live-wall-item">${miniCard(card)}<div class="live-match"><b>${escape(match.title)}</b></div><button class="button button--secondary" data-live-action="request" data-id="${escape(card.id)}">${complete ? '打开双联' : '申请交换'} ${icon(complete ? 'arrow-up-right' : 'swap')}</button></div>`; }).join('')}</div>` : emptyWall(own)}</details>
    <details class="live-memory-directory live-memories" data-room-fold="memories"><summary><span>共同记忆</span><small>${room.records.length}</small>${icon('chevron-right')}</summary>${room.records.length ? `<div class="live-memory-list">${room.records.map(record => `<button class="live-memory" data-live-action="memory" data-id="${escape(record.id)}"><div class="live-memory-pictures"><div>${photoMarkup(record.fromCard, '')}</div><div>${photoMarkup(record.toCard, '')}</div></div><div><h3>${escape(record.fromCard.ownerName)} <i>×</i> ${escape(record.toCard.ownerName)}</h3><p>${escape(dateLabel(completedAt(record)))} · 双方已同意</p></div>${icon('arrow-up-right')}</button>`).join('')}</div>` : '<p class="live-empty-memory">下一张，和朋友一起。</p>'}
    ${resolved.length ? `<details class="live-history" data-room-fold="history"><summary>最近交换动态 <span>${resolved.length}</span></summary>${resolved.map(ex => `<div><span>${escape(ex.from === room.me.id ? ex.toCard.ownerName : ex.fromCard.ownerName)}</span><b>${({ accepted: '交换已完成', declined: '这次没有交换', cancelled: '申请已取消' })[ex.status]}</b><small>${escape(dateLabel(ex.decidedAt || ex.createdAt))}</small></div>`).join('')}</details>` : ''}</details></div></div></div>`;
  }

  function openModal(name, title, content, className = '', cardId = null) {
    currentModal = { name };
    if (name === 'editor') api.spatial?.focus('editor');
    else if (cardId) api.spatial?.focus('photo', cardId);
    else api.spatial?.restore();
    dialog.className = `live-dialog ${className}`;
    modal.innerHTML = `<div class="live-modal-top"><span class="eyebrow">MUSIC SPACE / ${room ? escape(room.room.code) : 'TOGETHER'}</span><button class="icon-button" data-live-action="close" aria-label="关闭">${icon('x')}</button></div><h2 id="live-dialog-title">${title}</h2>${content}<p class="live-notice" data-modal-error role="alert" hidden></p>`;
    if (!dialog.open) dialog.showModal();
    hydratePhotos(modal);
  }

  function restoreScene() {
    queueMicrotask(() => { if (!signal.aborted && !dialog.open && !ceremony) api.spatial?.restore(); });
  }

  function closeModal() {
    dialog.close();
    currentModal = null;
    photoSelection += 1;
    restoreScene();
  }

  function clearDraft() {
    draft = null;
    draftRoomId = null;
    draftChanged = false;
    photoSelection += 1;
    photoPreparing = false;
  }

  function markDraftChanged() {
    draftChanged = true;
    const note = modal.querySelector('[data-compose-draft]');
    if (note) note.hidden = false;
  }

  function openCreate() {
    createRequested = false;
    openModal('create', '创建同场', `<form class="live-event-compose" data-live-form="create">
      <label class="live-field live-event-compose__name">场次名称 <span>必填</span><input name="title" maxlength="60" required placeholder="例如：周五草坪音乐会" value="${escape(eventDraft.title)}"></label>
      <div class="live-event-compose__body"><details class="live-event-compose__details" ${songDraft ? 'open' : ''}><summary>补充场次信息 <span>选填 ${icon('chevron-right')}</span></summary>
        <div class="live-event-fields"><label class="live-field">日期<input type="date" name="eventDate" value="${escape(eventDraft.eventDate)}"></label><label class="live-field">地点<input name="city" maxlength="40" placeholder="例如：南区草坪" value="${escape(eventDraft.city)}"></label></div>
        <label class="live-field live-event-compose__song">想一起记住的歌<input name="song" maxlength="80" placeholder="填写歌名，也可以先留空" value="${escape(eventDraft.song)}"></label>
      </details></div>
      <footer class="live-event-compose__footer"><p>场次信息创建后不能修改。</p><button class="button button--primary" type="submit">创建同场 ${icon('arrow-right')}</button></footer>
    </form>`, 'live-dialog--event');
  }

  function editorPhoto() {
    if (draft.uploadDataUrl) return `<img src="${draft.uploadDataUrl}" alt="待保存的个人照片"><span>保存时上传</span>`;
    if (draft.photoId) return `${photoMarkup({ ...draft, ownerName: room.me.name })}<span>你的照片</span>`;
    if (draft.useExample) return `<img src="${SPACE_PHOTOS[draft.photoKey].url}" alt="AI 生成的示例照片"><span>AI 示例图</span>`;
    return `<div class="live-upload-empty">${icon('camera')}<strong>选择现场照片</strong><span>保存时上传</span></div>`;
  }

  function updateComposeAvailability() {
    const ready = Boolean(draft?.photoId || draft?.uploadDataUrl || draft?.useExample);
    const next = modal.querySelector('[data-live-action="compose-next"]');
    const save = modal.querySelector('.live-compose button[type="submit"]');
    if (next) next.disabled = busy || photoPreparing || !ready;
    if (save) save.disabled = busy || photoPreparing;
    modal.querySelectorAll('[data-live-action="compose-back"]').forEach(button => { button.disabled = busy || photoPreparing; });
  }

  function updateEditorPhoto() {
    modal.querySelectorAll('[data-photo-preview],[data-compose-preview]').forEach(element => { element.innerHTML = editorPhoto(); });
    const kind = modal.querySelector('[data-compose-photo-kind]');
    if (kind) kind.textContent = draft.useExample ? 'AI 示例图' : '我的现场照片';
    hydratePhotos(modal);
    updateComposeAvailability();
  }

  function showEditorStep(step, focus = true) {
    if (currentModal?.name !== 'editor' || photoPreparing) return;
    if (step === 'details' && !draft.photoId && !draft.uploadDataUrl && !draft.useExample) return;
    editorStep = step;
    modal.querySelectorAll('[data-compose-panel]').forEach(panel => { panel.hidden = panel.dataset.composePanel !== step; });
    modal.querySelectorAll('[data-compose-for]').forEach(element => { element.hidden = element.dataset.composeFor !== step; });
    const heading = modal.querySelector('#live-dialog-title');
    heading.textContent = step === 'photo' ? '选照片' : '留一句';
    modal.querySelector('[data-compose-progress]').textContent = step === 'photo' ? '1 / 2' : '2 / 2';
    modal.querySelector('.live-compose').dataset.step = step;
    modal.querySelector('.live-compose__body').scrollTop = 0;
    if (focus) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    updateComposeAvailability();
  }

  function openEditor(target = null) {
    requestTarget = target;
    const own = room.ownCard;
    const event = eventOf(own);
    if (!draft || !draftChanged || draftRoomId !== room.room.id) {
      draft = { photoKey: 'stage', photoId: null, perspective: 'stage', momentId: 'encore', trackId: event.song ? 'co-0' : '', caption: '', isPublic: false, ...own, uploadDataUrl: null, useExample: Boolean(own && !own.photoId) };
      draftRoomId = room.room.id;
      draftChanged = false;
      editorStep = own ? 'details' : 'photo';
    }
    photoSelection += 1;
    photoPreparing = false;
    openModal('editor', editorStep === 'photo' ? '选照片' : '留一句', `<form class="live-compose" data-live-form="card" data-step="${editorStep}">
      <p class="live-compose__context"><span data-compose-progress>${editorStep === 'photo' ? '1 / 2' : '2 / 2'}</span><span>${escape(event.title)}</span><small data-compose-draft ${draftChanged ? '' : 'hidden'}>草稿未保存</small></p>
      <div class="live-compose__body">
        <fieldset class="live-compose__step" data-compose-panel="photo" ${editorStep !== 'photo' ? 'hidden' : ''}><legend class="sr-only">选照片</legend>
          <div class="live-upload-preview" data-photo-preview>${editorPhoto()}</div>
          <label class="button button--secondary live-upload-button">${icon('image')} ${own?.photoId ? '换一张自己的照片' : '选择自己的照片'}<input type="file" name="photoFile" accept="image/jpeg,image/png,image/webp" data-photo-file></label>
          <p class="live-form-note" data-photo-hint>JPG / PNG / WebP · 自动缩小并移除定位信息</p>
          <details class="live-example-picker"><summary>使用示例图</summary><p>AI 生成，卡片会保留示例标记。</p><fieldset class="live-photo-choices"><legend class="sr-only">选择示例照片</legend>${Object.values(SPACE_PHOTOS).map(item => `<label><input type="radio" name="photoKey" value="${item.id}" ${draft.useExample && item.id === draft.photoKey ? 'checked' : ''}><span><img src="${item.url}" alt="${item.description}"><b>${item.name}</b>${icon('check')}</span></label>`).join('')}</fieldset></details>
        </fieldset>
        <fieldset class="live-compose__step" data-compose-panel="details" ${editorStep !== 'details' ? 'hidden' : ''}><legend class="sr-only">留一句</legend>
          <button class="live-compose__photo-edit" type="button" data-live-action="compose-back"><span class="live-compose__thumbnail" data-compose-preview>${editorPhoto()}</span><span>换照片<small data-compose-photo-kind>${draft.useExample ? 'AI 示例图' : '我的现场照片'}</small></span>${icon('chevron-right')}</button>
          <fieldset class="live-perspectives"><legend>我拍的这一面</legend>${PERSPECTIVES.map(item => `<label><input type="radio" name="perspective" value="${item.id}" ${item.id === draft.perspective ? 'checked' : ''}><span><b>${item.name}</b></span></label>`).join('')}</fieldset>
          <label class="live-field live-compose__caption">留一句话 <span data-caption-count>${draft.caption.length} / 80</span><textarea name="caption" maxlength="80" rows="2" placeholder="这一刻，我记得……">${escape(draft.caption)}</textarea></label>
          <details class="live-compose__details"><summary>更多细节 ${icon('chevron-right')}</summary><fieldset class="live-moment-choices"><legend>现场瞬间</legend>${SPACE_MOMENTS.map(item => `<label><input type="radio" name="momentId" value="${item.id}" ${item.id === draft.momentId ? 'checked' : ''}><span>${item.name}</span></label>`).join('')}</fieldset>${event.song ? `<label class="live-check"><input type="checkbox" name="track" ${draft.trackId ? 'checked' : ''}><span>带上这首歌 <b>♪ ${escape(event.song)}</b></span></label>` : ''}</details>
          <label class="live-check live-compose__privacy"><input type="checkbox" name="isPublic" ${draft.isPublic ? 'checked' : ''}><span>展示到本场<small>未开启时，仅自己可见。</small></span></label>
        </fieldset>
      </div>
      <footer class="live-editor-save live-compose__footer">
        <button class="button button--primary" type="button" data-live-action="compose-next" data-compose-for="photo" ${editorStep !== 'photo' ? 'hidden' : ''}>下一步 ${icon('arrow-right')}</button>
        <div class="live-compose__save" data-compose-for="details" ${editorStep !== 'details' ? 'hidden' : ''}><span data-save-visibility>${draft.isPublic ? '保存后，同场成员可见' : '保存后，仅自己可见'}</span><div><button class="button button--secondary" type="button" data-live-action="compose-back">上一步</button><button class="button button--primary" type="submit">${target ? '保存，继续交换' : '保存现场卡'} ${icon('arrow-right')}</button></div></div>
      </footer>
    </form>`, 'live-dialog--editor live-dialog--compose');
    updateComposeAvailability();
  }

  function openRequest(cardId) {
    const target = room.cards.find(card => card.id === cardId && card.isPublic && card.ownerId !== room.me.id);
    if (!target) { api.toast('这张卡已被撤下，看看其他视角吧'); return; }
    if (!room.ownCard) { openEditor(cardId); return; }
    const completed = acceptedPair(target);
    if (completed) { openTicket(completed); return; }
    const pending = room.exchanges.find(item => item.status === 'pending' && [item.fromCard, item.toCard].some(card => card.id === target.id && card.revision === target.revision));
    if (pending) { openExchange(pending.id); return; }
    requestTarget = { id: cardId, fromRevision: room.ownCard.revision, toRevision: target.revision };
    const reason = matchReason(room.ownCard, target);
    openModal('request', `和 ${escape(target.ownerName)}，交换这一刻`, `<div class="live-pair-reason"><b>${escape(reason.title)}</b><p>${escape(reason.detail)}</p></div><div class="live-compare">${miniCard(room.ownCard, '我送出的')}${miniCard(target, '想换回的')}</div><div class="live-consent-note">${icon('swap')}<span>发送后，这张卡将分享给 ${escape(target.ownerName)}。接受后生成双联。</span></div><button class="button button--primary live-wide" data-live-action="send">发送交换申请 ${icon('arrow-right')}</button>`, 'live-dialog--wide', target.id);
  }

  function openExchange(id) {
    const exchange = room.exchanges.find(item => item.id === id);
    if (!exchange) return;
    if (exchange.status === 'accepted') { openTicket(exchange); return; }
    const incoming = exchange.to === room.me.id;
    const pending = exchange.status === 'pending';
    openModal('exchange', pending ? incoming ? '接受这次交换？' : '等待对方回应' : '交换已结束', `<p class="live-modal-intro">${pending ? '交换以眼前这两张卡为准。' : '只有双方接受，才会产生双联记忆。'}</p><div class="live-compare">${miniCard(exchange.fromCard, `${exchange.fromCard.ownerName} 的视角`)}${miniCard(exchange.toCard, `${exchange.toCard.ownerName} 的视角`)}</div>${pending ? `<div class="live-decision-actions">${incoming ? `<button class="button button--primary" data-live-action="decide" data-id="${escape(id)}" data-decision="accepted">愿意，交换这一刻 ${icon('swap')}</button><button class="text-button" data-live-action="decide" data-id="${escape(id)}" data-decision="declined">这次先不了</button>` : `<button class="button button--secondary" data-live-action="decide" data-id="${escape(id)}" data-decision="cancelled">取消这次申请</button>`}</div>` : ''}`, 'live-dialog--wide', incoming ? exchange.fromCard.id : exchange.toCard.id);
    currentModal.id = id;
  }

  /** Accepted exchanges and saved records open the full-screen duet; nothing else can. */
  function openTicket(item, { reveal = false } = {}) {
    if (!item || (item.status && item.status !== 'accepted') || signal.aborted) return;
    const [a, b] = [item.fromCard, item.toCard];
    const event = eventOf(a);
    const exchangeId = item.exchangeId || item.id;
    const saved = room.records.find(record => record.exchangeId === exchangeId);
    if (dialog.open) { dialog.close(); currentModal = null; }
    ceremony?.close();
    const handle = openDuetCeremony({
      id: exchangeId,
      reveal,
      scenario: 'live',
      event: { title: event.title, date: event.date, city: event.city, isDemo: event.isDemo },
      completedAt: completedAt(item),
      sides: [a, b].map(card => ({
        author: card.ownerName || '同场朋友',
        src: photo(card),
        load: card.photoId ? () => photos.load(card.photoId) : null,
        isExample: !card.photoId,
        perspective: perspectiveLabel(card),
        moment: momentLabel(card.momentId),
        caption: card.caption || '这一刻，想和你一起记住。',
      })),
      shared: sharedLine([a, b], event),
      status: saved ? '双方已同意 · 已保存到我的记录' : '双方已同意',
      note: '再次公开对方照片前，请先征得对方同意。',
      closeLabel: '关闭双联，回到本场',
      actions: [
        { id: 'save', kind: 'primary', icon: 'image', label: '保存双联图片', busyLabel: '正在生成图片…',
          run: async () => { await downloadTicket(await Promise.all([exportCard(a), exportCard(b)]), exportInfo(a, item)); } },
        { id: 'back', kind: 'secondary', icon: 'arrow-left', label: '返回现场', run: ({ close }) => close() },
        { id: 'collection', kind: 'link', icon: 'bookmark', label: '去我的收藏', run: ({ close }) => { close(); api.navigate('records'); } },
        { id: 'map', kind: 'link', icon: 'compass', label: api.getState().space?.mapReturnId ? '继续刚才的探索' : '去音乐地图',
          run: ({ close }) => { close(); const resumeSessionId = api.getState().space?.mapReturnId; api.navigate('explore', resumeSessionId ? { resumeSessionId } : { from: 'live' }); } },
        saved ? { id: 'remove', kind: 'remove', icon: 'trash', label: '从我的记忆中删除', run: () => openDeleteRecord(saved.id) } : null,
      ],
      onClose: () => { if (ceremony !== handle) return; ceremony = null; restoreScene(); },
    });
    ceremony = handle;
  }

  function openDeleteRecord(id) {
    openModal('delete', '从我的记忆中删除这张票？', `<p class="live-modal-intro">只删除你保存的记录，不会改动对方的记录。已经完成的交换动态仍会保留。</p><button class="button button--primary live-wide" data-live-action="confirm-delete" data-id="${escape(id)}">确认删除我的记录</button>`);
  }

  function openInvite() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', room.room.code);
    url.hash = '/live';
    const qr = qrcode(0, 'M');
    qr.addData(url.href); qr.make();
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    openModal('invite', '邀请朋友', `<div class="live-invite-layout"><div class="live-invite-qr" role="img" aria-label="当前房间邀请链接二维码">${qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true })}</div><div class="live-invite-code"><span>房间邀请码</span><strong>${escape(room.room.code)}</strong><small>${escape(room.room.title)}<br>最多 ${room.room.capacity} 人</small></div></div>${isLocal ? '<p class="live-local-link">当前链接仅本机可用，其他手机无法加入。</p>' : ''}<label class="live-field">邀请链接<input readonly value="${escape(url.href)}" data-invite-url></label><button class="button button--primary live-wide" data-live-action="copy">复制邀请链接 ${icon('arrow-up-right')}</button><p class="live-form-note">持有邀请码的人可以加入，请仅分享给朋友。</p>`);
  }

  async function connect() {
    checking = true;
    errorMessage = '';
    render();
    try {
      await request('/health');
      healthy = true;
      if (session) {
        try {
          const profile = await request('/session');
          session.user = profile.user;
          rooms = profile.rooms || [];
          persist();
          if (!createRequested && entryPayload.intent !== 'join-room') {
            const roomId = requestedRoomId || (!joinCode ? session.roomId : null);
            if (roomId && rooms.some(item => item.id === roomId)) setState(await request(`/rooms/${roomId}`));
            else if (requestedRoomId) errorMessage = '你已不在这个房间。可从收藏中使用邀请码重新加入。';
          }
        } catch (error) {
          if (error.status === 401) { roomAuthorized = false; clearPhotos(); session = null; persist(); errorMessage = '原身份已失效，请重新留下昵称入场。'; }
          else throw error;
        }
      }
    } catch (error) { healthy = false; showError(error); }
    finally {
      if (!signal.aborted) {
        checking = false;
        if (entryMode === 'create' && makeRequested && !room && !requestedRoomId && !joinCode) createRequested = true;
        if (inviteRequested && !room && !requestedRoomId) { createRequested = true; entryMode = 'create'; }
        render();
        if (healthy && session) {
          if (createRequested) openCreate();
          else if (room) openEntryAction();
        }
      }
    }
  }

  function openEntryAction() {
    if (makeRequested) { makeRequested = false; openEditor(); }
    else if (inviteRequested) { inviteRequested = false; openInvite(); }
  }

  container.addEventListener('submit', event => {
    const form = event.target.closest('[data-live-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.liveForm === 'entry') {
      const intent = entryMode === 'create' ? 'create' : event.submitter?.value || 'join';
      const name = String(data.get('name') || '').trim();
      entryName = name;
      joinCode = String(data.get('code') || '').trim();
      if (!session && !name) { form.elements.name.setCustomValidity('留一个现场昵称吧'); form.elements.name.reportValidity(); return; }
      if (intent === 'join' && !/^\d{6}$/.test(joinCode)) { form.elements.code.setCustomValidity('请输入朋友发来的 6 位邀请码'); form.elements.code.reportValidity(); return; }
      act(async () => {
        if (!session) {
          session = await request('/session', { method: 'POST', body: { name } });
          persist();
        }
        if (intent === 'create') { render(); openCreate(); return; }
        const next = await request('/rooms/join', { method: 'POST', body: { code: joinCode } });
        joinCode = '';
        createRequested = false;
        history.replaceState(null, '', `${location.pathname}#/live`);
        version += 1;
        setState(next);
        api.toast('入场成功，先留住你的这一面');
        openEntryAction();
      });
    }
    if (form.dataset.liveForm === 'create') {
      eventDraft = { title: String(data.get('title') || '').trim(), eventDate: String(data.get('eventDate') || ''), city: String(data.get('city') || '').trim(), song: String(data.get('song') || '').trim() };
      if (!eventDraft.title) { form.elements.title.setCustomValidity('给这一次现场起个名字吧'); form.elements.title.reportValidity(); return; }
      act(async () => {
        const next = await request('/rooms', { method: 'POST', body: eventDraft });
        closeModal(); version += 1;
        history.replaceState(null, '', `${location.pathname}#/live`);
        setState(next);
        eventDraft = { title: '', eventDate: '', city: '', song: '' };
        songDraft = null;
        makeRequested = false;
        if (inviteRequested) {
          inviteRequested = false;
          api.toast('同场已建好，把邀请码留给朋友');
          openInvite();
        } else {
          api.toast('同场已建好，先留下自己的现场卡');
          openEditor();
        }
      });
    }
    if (form.dataset.liveForm === 'card') {
      if (photoPreparing) return;
      if (!draft.photoId && !draft.uploadDataUrl && !draft.useExample) { showError(new Error('先选择一张自己的照片，或明确选用下方示例图。')); return; }
      if (editorStep === 'photo') { showEditorStep('details'); return; }
      const target = typeof requestTarget === 'string' ? requestTarget : null;
      const currentDraft = draft;
      const firstCard = !room.ownCard;
      const body = { photoKey: draft.photoKey, photoId: draft.photoId || null, perspective: data.get('perspective'), momentId: data.get('momentId'), caption: String(data.get('caption')).trim(), trackId: data.has('track') ? 'co-0' : '', isPublic: data.has('isPublic') };
      act(async () => {
        const saveHint = modal.querySelector('[data-save-visibility]');
        if (currentDraft.uploadDataUrl) {
          if (saveHint) saveHint.textContent = '正在上传这张照片…';
          const uploaded = await request(`/rooms/${room.room.id}/photos`, { method: 'POST', body: { dataUrl: currentDraft.uploadDataUrl } });
          body.photoId = uploaded.photoId;
          currentDraft.photoId = uploaded.photoId;
          currentDraft.uploadDataUrl = null;
        }
        if (saveHint) saveHint.textContent = '正在保存现场卡…';
        version += 1;
        setState(await request(`/rooms/${room.room.id}/card`, { method: 'PUT', body }));
        clearDraft();
        closeModal();
        api.toast(body.isPublic ? '现场卡已保存，也展示到本房间了' : '现场卡已私下保存');
        if (target) openRequest(target);
        else if (firstCard || !body.isPublic) openCardSaved();
      });
    }
  }, { signal });

  container.addEventListener('input', event => {
    event.target.setCustomValidity?.('');
    if (event.target.name === 'name') entryName = event.target.value;
    if (event.target.name === 'code') joinCode = event.target.value;
    if (currentModal?.name === 'editor') {
      const { name, value, checked } = event.target;
      if (['caption', 'perspective', 'momentId'].includes(name)) draft[name] = value;
      if (name === 'track') draft.trackId = checked ? 'co-0' : '';
      if (name === 'isPublic') draft.isPublic = checked;
      if (['caption', 'perspective', 'momentId', 'track', 'isPublic'].includes(name)) markDraftChanged();
    }
    if (event.target.name === 'caption') {
      const count = modal.querySelector('[data-caption-count]');
      if (count) count.textContent = `${event.target.value.length} / 80`;
    }
    if (event.target.name === 'isPublic') {
      const hint = modal.querySelector('[data-save-visibility]');
      if (hint) hint.textContent = event.target.checked ? '保存后，同场成员可见' : '保存后，仅自己可见';
    }
  }, { signal });

  container.addEventListener('change', async event => {
    if (currentModal?.name !== 'editor' || busy) return;
    const input = event.target;
    if (input.name === 'photoKey') {
      photoSelection += 1;
      photoPreparing = false;
      draft.photoKey = input.value;
      draft.photoId = null;
      draft.uploadDataUrl = null;
      draft.useExample = true;
      markDraftChanged();
      updateEditorPhoto();
      modal.querySelector('[data-photo-hint]').textContent = '已选 AI 示例图，卡片会保留示例标记。';
    }
    if (input.name !== 'photoFile' || !input.files?.[0]) return;
    const selected = ++photoSelection;
    const currentDraft = draft;
    photoPreparing = true;
    const hint = modal.querySelector('[data-photo-hint]');
    updateComposeAvailability();
    hint.textContent = '正在处理照片…';
    try {
      const dataUrl = await preparePhoto(input.files[0]);
      if (selected !== photoSelection || currentDraft !== draft || currentModal?.name !== 'editor') return;
      draft.uploadDataUrl = dataUrl;
      draft.photoId = null;
      draft.useExample = false;
      markDraftChanged();
      modal.querySelectorAll('[name="photoKey"]').forEach(radio => { radio.checked = false; });
      updateEditorPhoto();
      hint.textContent = '照片已准备好，保存时上传。';
      const error = modal.querySelector('[data-modal-error]');
      if (error) error.hidden = true;
    } catch (error) {
      if (selected === photoSelection) { hint.textContent = '原来的照片和文字都还在，可以重新选择。'; showError(error); }
    } finally {
      input.value = '';
      if (selected === photoSelection) { photoPreparing = false; updateComposeAvailability(); }
    }
  }, { signal });

  container.addEventListener('click', event => {
    const button = event.target.closest('[data-live-action]');
    if (!button) return;
    const action = button.dataset.liveAction;
    const id = button.dataset.id;
    if (busy) return;
    if (action === 'compose-next') showEditorStep('details');
    if (action === 'compose-back') showEditorStep('photo');
    if (action === 'join-entry') {
      entryMode = 'join'; createRequested = false; songDraft = null;
      render();
      surface.querySelector('[name="code"]')?.focus();
    }
    if (action === 'close') closeModal();
    if (action === 'demo') api.navigate('space');
    if (action === 'reconnect') connect();
    if (action === 'refresh') { hydratePhotos(); refresh(true); }
    if (action === 'invite') openInvite();
    if (action === 'collection') { closeModal(); api.navigate('records'); }
    if (action === 'wall') {
      closeModal();
      queueMicrotask(() => {
        const wall = surface.querySelector('.live-wall-section');
        if (!signal.aborted && wall) {
          wall.open = true;
          wall.setAttribute('tabindex', '-1');
          wall.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
          wall.focus({ preventScroll: true });
        }
      });
    }
    if (action === 'edit') openEditor();
    if (action === 'request') openRequest(id);
    if (action === 'review') openExchange(id);
    if (action === 'memory') {
      const record = room.records.find(item => item.id === id);
      if (record) openTicket(record);
    }
    if (action === 'map') { closeModal(); const resumeSessionId = api.getState().space?.mapReturnId; api.navigate('explore', resumeSessionId ? { resumeSessionId } : { from: 'live' }); }
    if (action === 'lobby') {
      version += 1;
      session.roomId = null;
      persist();
      roomAuthorized = false;
      clearPhotos();
      room = null;
      errorMessage = '';
      render();
    }
    if (action === 'resume') act(async () => { version += 1; setState(await request(`/rooms/${button.dataset.roomId}`)); openEntryAction(); });
    if (action === 'visibility') {
      if (room.ownCard.isPublic) openModal('withdraw', '把现场卡收回自己这里？', '<p class="live-modal-intro">其他房间成员将不再看到这张卡。涉及你的待回应申请会取消；已经交换的共同记忆仍保留。</p><button class="button button--primary live-wide" data-live-action="confirm-withdraw">确认撤下</button>');
      else act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/card/visibility`, { method: 'PATCH', body: { isPublic: true } })); if (draft) draft.isPublic = true; if (currentModal?.name === 'card-saved') closeModal(); api.toast('你的视角已展示到本房间'); });
    }
    if (action === 'confirm-withdraw') act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/card/visibility`, { method: 'PATCH', body: { isPublic: false } })); if (draft) draft.isPublic = false; closeModal(); api.toast('卡片已撤下'); });
    if (action === 'send') act(async () => {
      const selection = requestTarget;
      version += 1;
      try {
        setState(await request(`/rooms/${room.room.id}/exchanges`, { method: 'POST', body: { toCardId: selection.id, fromRevision: selection.fromRevision, toRevision: selection.toRevision } }));
        closeModal(); api.toast('心意已送出，等待对方回应');
      } catch (error) {
        if (error.code === 'CARD_CHANGED') {
          setState(await request(`/rooms/${room.room.id}`));
          openRequest(selection.id);
          throw new Error('卡片刚刚更新了。请看过最新的两张卡，再决定是否发送。');
        }
        throw error;
      }
    });
    if (action === 'decide') act(async () => {
      version += 1;
      const decision = button.dataset.decision;
      setState(await request(`/rooms/${room.room.id}/exchanges/${id}/decision`, { method: 'POST', body: { decision } }));
      // setState already premieres an accepted exchange; this only covers a missed transition.
      if (decision === 'accepted') { if (!ceremony) openTicket(room.exchanges.find(item => item.id === id), { reveal: true }); }
      else { closeModal(); api.toast(decision === 'declined' ? '已回应，这次先不交换' : '交换申请已取消'); }
    });
    if (action === 'copy' || action === 'copy-code') act(async () => {
      const isCode = action === 'copy-code';
      const input = modal.querySelector(isCode ? '[data-room-code]' : '[data-invite-url]');
      try { await navigator.clipboard.writeText(input.value); api.toast(isCode ? '邀请码已复制，回来时可以使用' : '邀请链接已复制'); }
      catch { input.focus(); input.select(); api.toast(isCode ? '已选中邀请码，可以手动复制' : '已选中邀请链接，可以手动复制'); }
    });
    if (action === 'download-card') act(async () => {
      if (!room.ownCard) throw new Error('请先保存自己的现场卡。');
      await downloadCard(await exportCard(room.ownCard), exportInfo(room.ownCard));
      api.toast('现场卡已生成');
    });
    if (action === 'delete-record') openDeleteRecord(id);
    if (action === 'confirm-delete') act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/records/${id}`, { method: 'DELETE' })); closeModal(); ceremony?.close(); api.toast('已从我的记忆中删除'); });
    if (action === 'leave') openModal('leave', '离开房间？', `<p class="live-modal-intro">你的现场卡会撤下，待回应申请会取消。自己的卡片和已收藏双联仍在「我的记录」中。</p><div class="live-return-slip"><label class="live-field">重新入场的邀请码<input readonly value="${escape(room.room.code)}" data-room-code aria-label="重新入场的邀请码"></label><button class="button button--secondary" data-live-action="copy-code">复制邀请码 ${icon('arrow-up-right')}</button></div><button class="button button--primary live-wide" data-live-action="confirm-leave">确认离开</button>`);
    if (action === 'confirm-leave') act(async () => {
      version += 1;
      const roomId = room.room.id;
      const roomCode = room.room.code;
      await request(`/rooms/${roomId}/membership`, { method: 'DELETE' });
      closeModal();
      roomAuthorized = false;
      clearPhotos();
      room = null;
      rooms = rooms.filter(item => item.id !== roomId);
      joinCode = roomCode;
      session.roomId = null;
      session.rejoinCode = roomCode;
      errorMessage = '';
      persist();
      render();
      api.toast('已离开房间。邀请码已留好，想回来时再加入');
    });
  }, { signal });

  dialog.addEventListener('click', event => { if (event.target === dialog && !busy) closeModal(); }, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) closeModal(); }, { signal });
  dialog.addEventListener('close', restoreScene, { signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }, { signal });
  connect();
  interval = setInterval(refresh, 4000);
  // Close the duet before revoking the photo URLs it may still show.
  return () => { ceremony?.close(); clearPhotos(); life.abort(); clearInterval(interval); dialog.close(); };
}

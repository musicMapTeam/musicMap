import { SPACE_EVENT, SPACE_MOMENTS, SPACE_PHOTOS } from './space-data.js';
import { downloadTicket, downloadCard } from './ticket-export.js';
import { createPhotoStore, preparePhoto } from './live-photo.js';
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
  let rooms = [];
  let healthy = false;
  let checking = true;
  let busy = false;
  let polling = false;
  let errorMessage = '';
  let storageFailed = false;
  let lastSync = null;
  let interval;
  let currentModal = null;
  let requestTarget = null;
  let joinCode = new URLSearchParams(location.search).get('room') || session?.rejoinCode || '';
  let entryName = '';
  let draft = null;
  let version = 0;
  let photoPreparing = false;
  let photoSelection = 0;
  let createRequested = api.getState().routePayload?.intent === 'create-room';
  let eventDraft = { title: '', eventDate: '', city: '', song: '' };
  const photos = createPhotoStore(() => session?.token, signal);
  if (createRequested) api.update(state => { state.routePayload = null; });

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
        if (!signal.aborted && image.isConnected) { image.src = url; image.parentElement.querySelector('.live-photo-status')?.remove(); }
      } catch (error) {
        if (error.name !== 'AbortError' && image.isConnected) {
          image.alt = '照片暂时无法读取';
          const label = image.parentElement.querySelector('.live-photo-status');
          if (label) label.textContent = '照片暂未读到 · 可刷新重试';
        }
      }
    });
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
    const photoPermissionChanged = old && (old.cards.some(card => card.photoId && !next.cards.some(current => current.id === card.id && current.photoId === card.photoId)) || old.exchanges.some(ex => ex.status === 'pending' && next.exchanges.some(current => current.id === ex.id && ['declined', 'cancelled'].includes(current.status))));
    if (photoPermissionChanged || (old?.room.id && old.room.id !== next.room.id)) photos.clear();
    room = next;
    session.roomId = next.room.id;
    session.rejoinCode = null;
    joinCode = '';
    persist();
    errorMessage = '';
    lastSync = new Date();
    if (!rooms.some(item => item.id === next.room.id)) rooms.push(next.room);
    render();
    if (dialog.open) hydratePhotos(modal);
    if (dialog.open && currentModal?.name === 'exchange') {
      const previous = old?.exchanges.find(ex => ex.id === currentModal.id);
      const latest = next.exchanges.find(ex => ex.id === currentModal.id);
      if (latest && previous?.status !== latest.status) openExchange(latest.id);
    }
    const newlyAccepted = next.exchanges.find(ex => ex.status === 'accepted' && old?.exchanges.some(previous => previous.id === ex.id && previous.status === 'pending'));
    if (newlyAccepted && !dialog.open) {
      api.toast(newlyAccepted.from === next.me.id ? '对方接受了交换，你们的共同记忆已保存' : '交换完成，你们的共同记忆已保存');
      openTicket(newlyAccepted);
    }
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
        else { lastSync = new Date(); updateSync(); }
      }
    } catch (error) {
      if (!signal.aborted && currentVersion === version) {
        errorMessage = error.status === 403 ? '你已离开这个房间。可返回入场页，凭邀请码重新加入。' : '同步暂时中断。上次收到的内容还在，恢复连接后会继续更新。';
        updateSync();
      }
    } finally { polling = false; }
  }

  function updateSync() {
    const element = surface.querySelector('[data-sync]');
    if (element) {
      element.textContent = errorMessage || `已同步${lastSync ? ` · ${lastSync.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
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
          if (hint) hint.textContent = modal.querySelector('[name="isPublic"]')?.checked ? '保存后，房间成员可见' : '保存后，仍先为自己私藏';
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
    surface.innerHTML = room ? roomView() : entryView();
    updateSync();
    hydratePhotos(surface);
  }

  function entryView() {
    const sampleA = { ownerName: '你的舞台', photoKey: 'stage', perspective: 'stage', momentId: 'encore', caption: '灯亮起时，我记得这一面。', event: demoEvent };
    const sampleB = { ownerName: '朋友的人海', photoKey: 'crowd', perspective: 'crowd', momentId: 'encore', caption: '原来那一刻，你看见的是这样。', event: demoEvent };
    return `<header class="live-entry-head"><button class="text-button" data-live-action="demo">${icon('arrow-left')} 返回 Music Space</button><span class="eyebrow">MUSIC SPACE / INVITE ONLY</span></header>${banner()}<div class="live-entry-grid"><section class="live-entry-copy"><span class="live-kicker">散场以后 · 另一种视角</span><h1>那一刻，<br><em>你也在。</em></h1><p class="live-lede">用另一位观众的视角，<br>补完整你记住的那一刻。</p><div class="live-gate"><div class="live-gate-heading"><b>${session ? `你好，${escape(session.user.name)}` : '先留下你想被叫的名字'}</b><span>${checking ? '正在连接…' : healthy ? '同场服务已连接' : '共享服务未连接'}</span></div><form data-live-form="entry">${session ? '' : `<label class="live-field">现场昵称<input name="name" value="${escape(entryName)}" placeholder="例如：小满" autocomplete="nickname" maxlength="20" required></label>`}<label class="live-field">朋友的邀请码 <span>已有房间时填写</span><input name="code" value="${escape(joinCode)}" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位数字" autocomplete="off"></label><div class="live-gate-actions"><button class="button ${createRequested ? 'button--secondary' : 'button--primary'}" type="submit" name="intent" value="join" ${!healthy ? 'disabled' : ''}>加入同场 ${icon('arrow-right')}</button><button class="button ${createRequested ? 'button--primary' : 'button--secondary'}" type="submit" name="intent" value="create" formnovalidate ${!healthy ? 'disabled' : ''}>创建我的同场 ${icon('plus')}</button></div></form>${!healthy && !checking ? `<div class="live-unavailable"><p>当前仍可体验本地情景。真人换卡需要打开已启用共享服务的链接。</p><button class="text-button" data-live-action="reconnect">重试连接</button></div>` : ''}<p class="live-gate-note">不用手机号。身份保存在这个浏览器，清除网站数据后无法找回。只邀请你愿意一起留念的人。</p></div><div class="live-entry-promise"><span>01 / 先为自己留一张</span><span>02 / 邀请同场的朋友</span><span>03 / 双方同意，合成双联</span></div>${session && rooms.length ? `<div class="live-recent"><span class="eyebrow">最近的房间</span>${rooms.map(item => `<button data-live-action="resume" data-room-id="${escape(item.id)}"><span>${escape(item.title)}</span><small>${escape(item.code)}</small>${icon('arrow-right')}</button>`).join('')}</div>` : ''}</section><aside class="live-entry-art" aria-label="两张现场卡构成双联记忆的示意"><span class="live-art-type" aria-hidden="true">SAME<br>SHOW.<br><i>TWO<br>STORIES.</i></span><div class="live-entry-pair">${miniCard(sampleA)}${miniCard(sampleB)}</div><p>YOUR VIEW. THEIR VIEW. ONE MEMORY.</p><small>排版示意 · 两张照片由 AI 生成</small></aside></div>`;
  }

  function emptyWall(own) {
    const hasCompany = room.room.memberCount > 1;
    const title = hasCompany ? '朋友已经入场，视角还没亮相。' : '等一个朋友，也留下这一刻。';
    const detail = hasCompany ? '房间里已有朋友，目前还没有其他人展示现场卡。' : '把邀请码发给朋友，对方入场并展示卡片后，你就能看到另一种视角。';
    const ownHint = !own ? '你可以先做自己的卡，再决定是否展示。' : own.isPublic ? '你的卡已经展示，朋友可以看见并向你申请交换。' : '你的卡也还私藏着。展示后，房间里的朋友才能看见并向你申请交换。';
    const action = !hasCompany ? 'invite' : !own ? 'edit' : own.isPublic ? 'refresh' : 'visibility';
    const label = { invite: '分享邀请码', edit: '制作我的现场卡', refresh: '看看有没有新视角', visibility: '展示我的现场卡' }[action];
    return `<div class="live-empty-wall"><span class="live-wall-word" aria-hidden="true">${hasCompany ? 'HERE,<br>TOGETHER.' : 'HELLO,<br>NEIGHBOUR.'}</span><h3>${title}</h3><p>${detail}</p><p class="live-empty-own-hint">${ownHint}</p><button class="button button--secondary" data-live-action="${action}">${label} ${icon('arrow-up-right')}</button></div>`;
  }

  function openPrivateCardSaved() {
    openModal('card-saved', '这一张，已经为你留好。', `<div class="live-saved-note">${icon('check')}<div><strong>现场卡已私下保存</strong><p>先下载自己的纪念卡，也可以展示到本场，让朋友看见你的视角。需要双方同意，才会合成共同署名的双联。</p></div></div><div class="live-saved-actions"><button class="button button--primary" data-live-action="download-card">保存我的卡片 ${icon('arrow-up-right')}</button><button class="button button--secondary" data-live-action="visibility">展示到本场</button></div><button class="text-button" data-live-action="close">先保持私藏</button>`);
  }

  function roomView() {
    const own = room.ownCard;
    const event = room.room.event || demoEvent;
    const cards = room.cards.filter(card => card.ownerId !== room.me.id).sort((a, b) => matchReason(own, b).score - matchReason(own, a).score);
    const incoming = room.exchanges.filter(ex => ex.to === room.me.id && ex.status === 'pending');
    const outgoing = room.exchanges.filter(ex => ex.from === room.me.id && ex.status === 'pending');
    const resolved = room.exchanges.filter(ex => ex.status !== 'pending').slice(-6).reverse();
    return `${banner()}<header class="live-room-head"><div><span class="eyebrow">MUSIC SPACE / ${escape(room.room.code)}</span><h1>你的这一面，<em>拼上另一面。</em></h1><p class="live-event-name">${escape(event.title)}</p><p class="live-event-meta">${escape([event.date, event.city].filter(Boolean).join(' · '))}<span> ${escape(room.me.name)} · ${room.room.memberCount} 人入场</span></p></div><div class="live-room-tools"><button class="button button--primary" data-live-action="invite">邀请同场的朋友 ${icon('arrow-up-right')}</button><button class="text-button" data-live-action="lobby">其他房间</button></div></header>
    <div class="live-room-ribbon"><span>${event.song ? `♪ ${escape(event.song)}` : '散场后，把记得的片刻留在这里。'} <b>${event.isDemo ? '历史示例场次' : '你们命名的同场'}</b></span><span data-sync role="status"></span><button class="text-button" data-live-action="refresh">${icon('rotate')} 刷新</button></div>
    ${incoming.length ? `<section class="live-incoming" aria-label="收到的交换申请"><div class="live-section-title"><span>↗</span><h2>有人想和你拼成双联。</h2><small>${incoming.length} 条待回应</small></div>${incoming.map(ex => `<div class="live-request-row"><div class="live-initial">${escape(ex.fromCard.ownerName.slice(0, 1))}</div><p><b>${escape(ex.fromCard.ownerName)}</b><span>想把「${escape(perspectiveName(ex.fromCard))}」与你的「${escape(perspectiveName(ex.toCard))}」放在一起。</span></p><button class="button button--primary" data-live-action="review" data-id="${escape(ex.id)}">看看这两张卡 ${icon('arrow-right')}</button></div>`).join('')}</section>` : ''}
    <div class="live-room-columns"><section class="live-own-section"><div class="live-section-title"><span>01</span><h2>我的现场</h2></div>${own ? `${miniCard(own)}<div class="live-own-meta"><span class="live-visibility ${own.isPublic ? 'is-public' : ''}">${own.isPublic ? '本房间成员可见' : '仅自己可见'}</span><span>第 ${own.revision} 版</span></div><div class="live-own-actions"><button class="button button--secondary" data-live-action="edit">编辑现场卡</button><button class="text-button" data-live-action="download-card">保存我的卡片 ${icon('arrow-up-right')}</button><button class="text-button" data-live-action="visibility">${own.isPublic ? '从本场撤下' : '展示到本场'} ${icon('arrow-up-right')}</button></div>` : `<div class="live-empty-card"><div class="live-optical" aria-hidden="true"></div><span class="eyebrow">MY SIDE OF THE STORY</span><h3>先为自己，<br>留住这一面。</h3><p>一张自己的照片，一句话。<br>一个人也能先做张纪念卡。</p><button class="button button--primary" data-live-action="edit">制作我的现场卡 ${icon('plus')}</button></div>`}<p class="live-section-note">照片上传到当前同场服务，默认私藏。展示后房间成员可见；交换需双方同意。${event.isDemo ? '此房间沿用旧版示例场次。' : '场次与瞬间由你们填写，不作到场认证。'}</p></section>
    <section class="live-wall-section"><div class="live-section-title"><span>02</span><h2>同场的另一面</h2><small>${cards.length} 张视角</small></div>${cards.length ? `<p class="live-wall-rule">按你们选择的标签，优先放上「同一瞬间 · 不同视角」。最后想和谁拼成双联，由你决定。</p><div class="live-wall">${cards.map(card => { const match = matchReason(own, card); const complete = acceptedPair(card); return `<div class="live-wall-item">${miniCard(card)}<div class="live-match"><b>${escape(match.title)}</b><p>${escape(match.detail)}</p></div><button class="button button--secondary" data-live-action="request" data-id="${escape(card.id)}">${complete ? '打开这张共同记忆' : '邀请共同署名'} ${icon(complete ? 'arrow-up-right' : 'swap')}</button></div>`; }).join('')}</div>` : emptyWall(own)}</section></div>
    ${outgoing.length ? `<section class="live-pending"><div class="live-section-title"><span>→</span><h2>已送出的心意</h2></div>${outgoing.map(ex => `<div class="live-pending-row"><span>等待 <b>${escape(ex.toCard.ownerName)}</b> 回应</span><small>两张卡已固定为发出时的版本</small><button class="text-button" data-live-action="review" data-id="${escape(ex.id)}">查看 / 取消</button></div>`).join('')}</section>` : ''}
    <section class="live-memories"><div class="live-section-title"><span>03</span><h2>我们的共同记忆</h2><small>${room.records.length} 张双联票</small></div>${room.records.length ? `<div class="live-memory-list">${room.records.map(record => `<button class="live-memory" data-live-action="memory" data-id="${escape(record.id)}"><div class="live-memory-pictures"><div>${photoMarkup(record.fromCard, '')}</div><div>${photoMarkup(record.toCard, '')}</div></div><div><span class="eyebrow">A MOMENT, EXCHANGED.</span><h3>${escape(record.fromCard.ownerName)} <i>×</i> ${escape(record.toCard.ownerName)}</h3><p>${escape(dateLabel(completedAt(record)))} · 双方已同意</p></div>${icon('arrow-up-right')}</button>`).join('')}</div>` : '<p class="live-empty-memory">当双方都说「愿意」，两张卡就会在这里成为一张共同署名的双联。</p>'}</section>
    ${resolved.length ? `<details class="live-history"><summary>最近交换动态 <span>${resolved.length}</span></summary>${resolved.map(ex => `<div><span>${escape(ex.from === room.me.id ? ex.toCard.ownerName : ex.fromCard.ownerName)}</span><b>${({ accepted: '交换已完成', declined: '这次没有交换', cancelled: '申请已取消' })[ex.status]}</b><small>${escape(dateLabel(ex.decidedAt || ex.createdAt))}</small></div>`).join('')}</details>` : ''}<footer class="live-room-bottom"><p>照片在展示时已经可见。交换留下的是双方认可的这一对视角；之后编辑不会改写共同记忆。</p><div class="live-footer-actions"><button class="text-button" data-live-action="map">${api.getState().space?.mapReturnId ? '继续刚才的探索' : '去音乐地图'} ${icon('compass')}</button><button class="text-button" data-live-action="leave">离开这个房间</button></div></footer>`;
  }

  function openModal(name, title, content, className = '') {
    currentModal = { name };
    dialog.className = `live-dialog ${className}`;
    modal.innerHTML = `<div class="live-modal-top"><span class="eyebrow">MUSIC SPACE / ${room ? escape(room.room.code) : 'TOGETHER'}</span><button class="icon-button" data-live-action="close" aria-label="关闭">${icon('x')}</button></div><h2 id="live-dialog-title">${title}</h2>${content}<p class="live-notice" data-modal-error role="alert" hidden></p>`;
    if (!dialog.open) dialog.showModal();
    hydratePhotos(modal);
  }

  function closeModal() { dialog.close(); currentModal = null; photoSelection += 1; }

  function openCreate() {
    createRequested = false;
    openModal('create', '这晚，叫什么名字？', `<p class="live-modal-intro">为你们真实记得的一场音乐现场留个房间。先制作自己的卡，再邀请同场的人。</p><form data-live-form="create"><label class="live-field">场次名称 <span>必填</span><input name="title" maxlength="60" required placeholder="例如：周五草坪音乐会" value="${escape(eventDraft.title)}"></label><div class="live-event-fields"><label class="live-field">日期 <span>选填</span><input type="date" name="eventDate" value="${escape(eventDraft.eventDate)}"></label><label class="live-field">地点 <span>选填</span><input name="city" maxlength="40" placeholder="例如：南区草坪" value="${escape(eventDraft.city)}"></label></div><label class="live-field">想一起记住的歌 <span>选填</span><input name="song" maxlength="80" placeholder="填写歌名，也可以先留空" value="${escape(eventDraft.song)}"></label><p class="live-form-note">场次建立后保持不变。名称和歌名由你填写，不自动代表到场事实，也不会接入播放。</p><button class="button button--primary live-wide" type="submit">创建这一次同场 ${icon('arrow-right')}</button></form>`);
  }

  function editorPhoto() {
    if (draft.uploadDataUrl) return `<img src="${draft.uploadDataUrl}" alt="待保存的个人照片"><span>你的照片 · 保存时上传</span>`;
    if (draft.photoId) return `${photoMarkup({ ...draft, ownerName: room.me.name })}<span>你的照片 · 已保存在本服务</span>`;
    if (draft.useExample) return `<img src="${SPACE_PHOTOS[draft.photoKey].url}" alt="AI 生成的示例照片"><span>AI 生成示例 · 不代表你的到场照片</span>`;
    return `<div class="live-upload-empty">${icon('camera')}<strong>从你的相册，带回这一刻。</strong><span>选择后先预览，保存时才上传。</span></div>`;
  }

  function openEditor(target = null) {
    requestTarget = target;
    const own = room.ownCard;
    const event = eventOf(own);
    draft = { photoKey: 'stage', photoId: null, perspective: 'stage', momentId: 'encore', trackId: event.song ? 'co-0' : '', caption: '', isPublic: false, ...own, uploadDataUrl: null, useExample: Boolean(own && !own.photoId) };
    photoSelection += 1;
    photoPreparing = false;
    openModal('editor', '留住你看到的那一面。', `<form data-live-form="card"><p class="live-editor-event">${escape(event.title)}</p><div class="live-upload-preview" data-photo-preview>${editorPhoto()}</div><label class="button button--secondary live-upload-button">${icon('image')} ${own?.photoId ? '换一张自己的照片' : '选择自己的照片'}<input type="file" name="photoFile" accept="image/jpeg,image/png,image/webp" data-photo-file></label><p class="live-form-note" data-photo-hint>JPG / PNG / WebP · 保存时上传至当前服务，默认私藏。照片会缩小，并去掉照片文件中的定位信息。</p><details class="live-example-picker"><summary>暂时没有照片？可试用示例图</summary><p>以下为 AI 生成的虚构现场图片，卡片会持续标明「示例图」。</p><fieldset class="live-photo-choices"><legend class="sr-only">选择示例照片</legend>${Object.values(SPACE_PHOTOS).map(item => `<label><input type="radio" name="photoKey" value="${item.id}" ${draft.useExample && item.id === draft.photoKey ? 'checked' : ''}><span><img src="${item.url}" alt="${item.description}"><b>${item.name}</b>${icon('check')}</span></label>`).join('')}</fieldset></details><fieldset class="live-perspectives"><legend>这张照片，是现场的哪一面？</legend>${PERSPECTIVES.map(item => `<label><input type="radio" name="perspective" value="${item.id}" ${item.id === draft.perspective ? 'checked' : ''}><span><b>${item.name}</b><small>${item.detail}</small></span></label>`).join('')}</fieldset><fieldset class="live-moment-choices"><legend>你想留住的瞬间</legend>${SPACE_MOMENTS.map(item => `<label><input type="radio" name="momentId" value="${item.id}" ${item.id === draft.momentId ? 'checked' : ''}><span>${item.name}</span></label>`).join('')}</fieldset><label class="live-field">给这一刻的一句话 <span data-caption-count>${draft.caption.length} / 80</span><textarea name="caption" maxlength="80" rows="3" placeholder="例如：我面朝舞台，你拍下了背后一起合唱的人。">${escape(draft.caption)}</textarea></label>${event.song ? `<label class="live-check"><input type="checkbox" name="track" ${draft.trackId ? 'checked' : ''}><span>带上这首歌 <b>♪ ${escape(event.song)}</b></span></label>` : ''}<label class="live-check"><input type="checkbox" name="isPublic" ${draft.isPublic ? 'checked' : ''}><span>展示到这个房间<small>成员可看见照片与文字，可以邀请你共同署名。</small></span></label><p class="live-form-note">未展示时仍可主动申请；发出申请会把当时这张卡分享给指定对方。瞬间和视角由你选择。</p><div class="live-editor-save"><span data-save-visibility>${draft.isPublic ? '保存后，房间成员可见' : '保存后，仍先为自己私藏'}</span><button class="button button--primary live-wide" type="submit">${target ? '保存，继续交换' : '保存我的现场卡'} ${icon('arrow-right')}</button></div></form>`, 'live-dialog--editor');
  }

  function openRequest(cardId) {
    const target = room.cards.find(card => card.id === cardId);
    if (!target) { api.toast('这张卡已被撤下，看看其他视角吧'); return; }
    if (!room.ownCard) { openEditor(cardId); return; }
    const completed = acceptedPair(target);
    if (completed) { openTicket(completed); return; }
    requestTarget = { id: cardId, fromRevision: room.ownCard.revision, toRevision: target.revision };
    const reason = matchReason(room.ownCard, target);
    openModal('request', `和 ${escape(target.ownerName)}，共同署名。`, `<p class="live-modal-intro">发出的，就是眼前这两张卡。对方接受后，双方各自收好一张共同署名的双联。</p><div class="live-pair-reason"><b>${escape(reason.title)}</b><p>${escape(reason.detail)}</p></div><div class="live-compare">${miniCard(room.ownCard, '我送出的')}${miniCard(target, '想换回的')}</div><div class="live-consent-note">${icon('swap')}<span>发送即同意把自己的这张卡分享给 ${escape(target.ownerName)}。对方可以接受，也可以拒绝。</span></div><button class="button button--primary live-wide" data-live-action="send">发送交换申请 ${icon('arrow-right')}</button>`, 'live-dialog--wide');
  }

  function openExchange(id) {
    const exchange = room.exchanges.find(item => item.id === id);
    if (!exchange) return;
    if (exchange.status === 'accepted') { openTicket(exchange); return; }
    const incoming = exchange.to === room.me.id;
    const pending = exchange.status === 'pending';
    openModal('exchange', pending ? incoming ? '这一份心意，你愿意交换吗？' : '心意已送出，等一个回应。' : '这次交换已经结束。', `<p class="live-modal-intro">${pending ? '下面是发起申请时的两张卡。之后修改现场卡，不会改变这次申请的内容。' : '只有双方接受，才会产生双联记忆。'}</p><div class="live-compare">${miniCard(exchange.fromCard, `${exchange.fromCard.ownerName} 的视角`)}${miniCard(exchange.toCard, `${exchange.toCard.ownerName} 的视角`)}</div>${pending ? `<div class="live-decision-actions">${incoming ? `<button class="button button--primary" data-live-action="decide" data-id="${escape(id)}" data-decision="accepted">愿意，交换这一刻 ${icon('swap')}</button><button class="text-button" data-live-action="decide" data-id="${escape(id)}" data-decision="declined">这次先不了</button>` : `<button class="button button--secondary" data-live-action="decide" data-id="${escape(id)}" data-decision="cancelled">取消这次申请</button>`}</div>` : ''}`, 'live-dialog--wide');
    currentModal.id = id;
  }

  function openTicket(item) {
    const [a, b] = [item.fromCard, item.toCard];
    const event = eventOf(a);
    const saved = room.records.find(record => record.exchangeId === (item.exchangeId || item.id));
    const sharedTrack = a.trackId && a.trackId === b.trackId && event.song;
    const reason = matchReason(a, b);
    openModal('ticket', '同一场，两种视角。', `<div class="live-ticket"><div class="live-ticket-mast"><span>MUSIC<br>BRINGS US<br>TOGETHER.</span><b>MM<br>× MS</b></div><div class="live-ticket-title"><span>${escape(event.title)}${event.isDemo ? ' · 示例场次' : ''}<small>${escape([event.date, event.city].filter(Boolean).join(' · '))}</small></span><strong>${escape(a.ownerName)} <i>×</i> ${escape(b.ownerName)}</strong></div><div class="live-ticket-pair">${miniCard(a)}${miniCard(b)}</div><div class="live-ticket-strip"><span>${sharedTrack ? `♪ ${escape(event.song)}` : escape(reason.title)}</span><b>EXCHANGED</b></div><div class="live-ticket-foot"><span>${escape(dateLabel(completedAt(item)))}<br>双方已同意 · ${saved ? '已保存到本房间' : '交换记录'}</span><span class="live-ticket-bars" aria-hidden="true"></span><span>YOUR VIEW.<br>THEIR VIEW.<br>ONE MEMORY.</span></div></div><div class="live-ticket-actions"><button class="button button--primary" data-live-action="download" data-id="${escape(item.exchangeId || item.id)}">保存票根图片 ${icon('arrow-up-right')}</button><button class="button button--secondary" data-live-action="map">${api.getState().space?.mapReturnId ? '继续刚才的探索' : '去音乐地图'} ${icon('compass')}</button></div><p class="live-form-note">${event.isDemo ? '本房间沿用示例场次与歌曲。' : ''}票根只包含这次双方同意的卡片。${!a.photoId || !b.photoId ? '其中包含 AI 生成的示例照片，卡片已作标记。' : ''}</p>${saved ? `<button class="text-button live-delete-record" data-live-action="delete-record" data-id="${escape(saved.id)}">从我的记忆中删除</button>` : ''}`, 'live-dialog--ticket');
  }

  function openInvite() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', room.room.code);
    url.hash = '/live';
    const qr = qrcode(0, 'M');
    qr.addData(url.href); qr.make();
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    openModal('invite', '邀请记得这一刻的人。', `<p class="live-modal-intro">同场的朋友，或刚认识的邻座。邀请加入后，各自留下照片；每一次共同署名，都由双方决定。</p><div class="live-invite-layout"><div class="live-invite-qr" role="img" aria-label="当前房间邀请链接二维码">${qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true })}</div><div class="live-invite-code"><span>房间邀请码</span><strong>${escape(room.room.code)}</strong><small>${escape(room.room.title)}<br>最多 ${room.room.capacity} 人</small></div></div>${isLocal ? '<p class="live-local-link">当前为仅本机可用的链接。其他手机扫描不能进入；使用已部署或可访问的局域网地址打开后，再分享二维码。</p>' : '<p class="live-form-note">朋友用自己的设备扫码，或打开下面的邀请链接。</p>'}<label class="live-field">邀请链接<input readonly value="${escape(url.href)}" data-invite-url></label><button class="button button--primary live-wide" data-live-action="copy">复制邀请链接 ${icon('arrow-up-right')}</button><p class="live-form-note">二维码由当前页面生成。邀请码只发给你愿意邀请的人；持码的人可以加入本房间。</p>`);
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
          if (session.roomId && !joinCode && !createRequested && rooms.some(item => item.id === session.roomId)) setState(await request(`/rooms/${session.roomId}`));
        } catch (error) {
          if (error.status === 401) { photos.clear(); session = null; persist(); errorMessage = '原身份已失效，请重新留下昵称入场。'; }
          else throw error;
        }
      }
    } catch (error) { healthy = false; showError(error); }
    finally { checking = false; render(); if (healthy && session && createRequested) openCreate(); }
  }

  container.addEventListener('submit', event => {
    const form = event.target.closest('[data-live-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.liveForm === 'entry') {
      const intent = event.submitter?.value || 'join';
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
        history.replaceState(null, '', `${location.pathname}#/live`);
        version += 1;
        setState(next);
        api.toast('入场成功，先留住你的这一面');
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
        api.toast('同场已建好。先做自己的卡，再邀请朋友');
        openEditor();
      });
    }
    if (form.dataset.liveForm === 'card') {
      if (photoPreparing) return;
      if (!draft.photoId && !draft.uploadDataUrl && !draft.useExample) { showError(new Error('先选择一张自己的照片，或明确选用下方示例图。')); return; }
      const target = typeof requestTarget === 'string' ? requestTarget : null;
      const currentDraft = draft;
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
        closeModal();
        api.toast(body.isPublic ? '现场卡已保存，也展示到本房间了' : '现场卡已私下保存');
        if (target) openRequest(target);
        else if (!body.isPublic) openPrivateCardSaved();
      });
    }
  }, { signal });

  container.addEventListener('input', event => {
    event.target.setCustomValidity?.('');
    if (event.target.name === 'name') entryName = event.target.value;
    if (event.target.name === 'code') joinCode = event.target.value;
    if (event.target.name === 'caption') {
      const count = modal.querySelector('[data-caption-count]');
      if (count) count.textContent = `${event.target.value.length} / 80`;
    }
    if (event.target.name === 'isPublic') {
      const hint = modal.querySelector('[data-save-visibility]');
      if (hint) hint.textContent = event.target.checked ? '保存后，房间成员可见' : '保存后，仍先为自己私藏';
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
      modal.querySelector('[data-photo-preview]').innerHTML = editorPhoto();
      modal.querySelector('button[type="submit"]').disabled = false;
      modal.querySelector('[data-photo-hint]').textContent = '已选示例图。卡片会明确标记，不代表你拍摄的真实照片。';
    }
    if (input.name !== 'photoFile' || !input.files?.[0]) return;
    const selected = ++photoSelection;
    const currentDraft = draft;
    photoPreparing = true;
    const save = modal.querySelector('button[type="submit"]');
    const hint = modal.querySelector('[data-photo-hint]');
    save.disabled = true;
    hint.textContent = '正在处理照片，先为你保留其他输入…';
    try {
      const dataUrl = await preparePhoto(input.files[0]);
      if (selected !== photoSelection || currentDraft !== draft || currentModal?.name !== 'editor') return;
      draft.uploadDataUrl = dataUrl;
      draft.photoId = null;
      draft.useExample = false;
      modal.querySelectorAll('[name="photoKey"]').forEach(radio => { radio.checked = false; });
      modal.querySelector('[data-photo-preview]').innerHTML = editorPhoto();
      hint.textContent = '照片已准备好。点击保存时上传到当前同场服务，未展示前仅自己可见。';
      const error = modal.querySelector('[data-modal-error]');
      if (error) error.hidden = true;
    } catch (error) {
      if (selected === photoSelection) { hint.textContent = '原来的照片和文字都还在，可以重新选择。'; showError(error); }
    } finally {
      input.value = '';
      if (selected === photoSelection) { photoPreparing = false; if (save.isConnected) save.disabled = false; }
    }
  }, { signal });

  container.addEventListener('click', event => {
    const button = event.target.closest('[data-live-action]');
    if (!button) return;
    const action = button.dataset.liveAction;
    const id = button.dataset.id;
    if (busy) return;
    if (action === 'close') closeModal();
    if (action === 'demo') api.navigate('space');
    if (action === 'reconnect') connect();
    if (action === 'refresh') { hydratePhotos(); refresh(true); }
    if (action === 'invite') openInvite();
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
      photos.clear();
      room = null;
      errorMessage = '';
      render();
    }
    if (action === 'resume') act(async () => { version += 1; setState(await request(`/rooms/${button.dataset.roomId}`)); });
    if (action === 'visibility') {
      if (room.ownCard.isPublic) openModal('withdraw', '把现场卡收回自己这里？', '<p class="live-modal-intro">其他房间成员将不再看到这张卡。涉及你的待回应申请会取消；已经交换的共同记忆仍保留。</p><button class="button button--primary live-wide" data-live-action="confirm-withdraw">确认撤下</button>');
      else act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/card/visibility`, { method: 'PATCH', body: { isPublic: true } })); if (currentModal?.name === 'card-saved') closeModal(); api.toast('你的视角已展示到本房间'); });
    }
    if (action === 'confirm-withdraw') act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/card/visibility`, { method: 'PATCH', body: { isPublic: false } })); closeModal(); api.toast('卡片已撤下'); });
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
      setState(await request(`/rooms/${room.room.id}/exchanges/${id}/decision`, { method: 'POST', body: { decision: button.dataset.decision } }));
      closeModal();
      if (button.dataset.decision === 'accepted') openTicket(room.exchanges.find(item => item.id === id));
      else api.toast(button.dataset.decision === 'declined' ? '已回应，这次先不交换' : '交换申请已取消');
    });
    if (action === 'copy' || action === 'copy-code') act(async () => {
      const isCode = action === 'copy-code';
      const input = modal.querySelector(isCode ? '[data-room-code]' : '[data-invite-url]');
      try { await navigator.clipboard.writeText(input.value); api.toast(isCode ? '邀请码已复制，回来时可以使用' : '邀请链接已复制'); }
      catch { input.focus(); input.select(); api.toast(isCode ? '已选中邀请码，可以手动复制' : '已选中邀请链接，可以手动复制'); }
    });
    if (action === 'download') act(async () => {
      const item = room.exchanges.find(ex => ex.id === id) || room.records.find(record => record.exchangeId === id);
      if (!item) throw new Error('这份共同记忆暂时未找到，请刷新后重试。');
      await downloadTicket(await Promise.all([exportCard(item.fromCard), exportCard(item.toCard)]), exportInfo(item.fromCard, item));
      api.toast('票根图片已生成，请查看浏览器下载');
    });
    if (action === 'download-card') act(async () => {
      if (!room.ownCard) throw new Error('请先保存自己的现场卡。');
      await downloadCard(await exportCard(room.ownCard), exportInfo(room.ownCard));
      api.toast('你的现场卡已生成，请查看浏览器下载');
    });
    if (action === 'delete-record') openModal('delete', '从我的记忆中删除这张票？', `<p class="live-modal-intro">只删除你保存的记录，不会改动对方的记录。已经完成的交换动态仍会保留。</p><button class="button button--primary live-wide" data-live-action="confirm-delete" data-id="${escape(id)}">确认删除我的记录</button>`);
    if (action === 'confirm-delete') act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/records/${id}`, { method: 'DELETE' })); closeModal(); api.toast('已从我的记忆中删除'); });
    if (action === 'leave') openModal('leave', '先收好，再暂时告别。', `<p class="live-modal-intro">你的现场卡会撤下，待回应申请会取消。共同记忆仍保留，使用同一浏览器和邀请码再次入场后可以查看。</p><div class="live-return-slip"><span class="eyebrow">KEEP YOUR WAY BACK</span><label class="live-field">重新入场的邀请码<input readonly value="${escape(room.room.code)}" data-room-code aria-label="重新入场的邀请码"></label><button class="button button--secondary" data-live-action="copy-code">复制邀请码 ${icon('arrow-up-right')}</button></div><p class="live-form-note">离开后，邀请码会留在入场栏。等你想回来时，再点击加入。</p><button class="button button--primary live-wide" data-live-action="confirm-leave">确认离开</button>`);
    if (action === 'confirm-leave') act(async () => {
      version += 1;
      const roomId = room.room.id;
      const roomCode = room.room.code;
      await request(`/rooms/${roomId}/membership`, { method: 'DELETE' });
      closeModal();
      photos.clear();
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
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); else { currentModal = null; photoSelection += 1; } }, { signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }, { signal });
  connect();
  interval = setInterval(refresh, 4000);
  return () => { life.abort(); photos.clear(); clearInterval(interval); dialog.close(); };
}

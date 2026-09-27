import { SPACE_PHOTOS, SPACE_MOMENTS } from './space-data.js';
import { createPhotoStore } from './live-photo.js';
import { downloadCard, downloadTicket } from './ticket-export.js';

const SESSION_KEY = 'music-map-live:v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const placeholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="#a5b1a2" d="M0 0h1v1H0z"/></svg>')}`;
const perspectives = { stage: '舞台', crowd: '人海', friends: '身边', detail: '细节' };
const day = value => value ? new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
const readSession = () => {
  try { const saved = JSON.parse(localStorage.getItem(SESSION_KEY)); return saved?.token ? saved : null; }
  catch { return null; }
};

/** Private, cross-room collection. Nothing here is published to the scene wall. */
export function mountLiveLibrary(container, api) {
  const life = new AbortController();
  const { signal } = life;
  const icon = api.icon;
  let session = readSession();
  const photos = createPhotoStore(() => session?.token, signal);
  let library = null;
  let filter = 'all';
  let loading = false;
  let busy = false;
  let notice = '';
  let needsEntry = false;
  let retry = null;
  let selectedKey = null;
  let deleteKey = null;
  let requestedKey = api.getState().routePayload?.libraryItemId || null;
  if (requestedKey) api.update(state => { delete state.routePayload.libraryItemId; });

  container.innerHTML = `<section class="live-library" aria-label="我的现场收藏"><div data-library-surface></div>
    <dialog class="library-dialog" aria-labelledby="library-detail-title"><div data-library-detail></div></dialog>
    <dialog class="library-dialog library-dialog--confirm" aria-labelledby="library-confirm-title"><div class="library-dialog__top"><h2 id="library-confirm-title">删除这张双联？</h2><button class="icon-button" data-library-action="cancel-delete" aria-label="取消删除">${icon('x')}</button></div><p class="library-confirm-copy">只删除你收藏的这张记忆，对方的记录仍保留。</p><div class="library-confirm-actions"><button class="button button--secondary" data-library-action="cancel-delete">保留</button><button class="button button--primary" data-library-action="confirm-delete" data-library-mutation>删除我的记录</button></div><p class="library-operation-error" data-library-delete-error role="alert" hidden></p></dialog>
  </section>`;
  const surface = container.querySelector('[data-library-surface]');
  const dialog = container.querySelector('.library-dialog');
  const detail = container.querySelector('[data-library-detail]');
  const confirmation = container.querySelector('.library-dialog--confirm');

  function items() {
    if (!library) return [];
    return [
      ...library.cards.map(card => ({ ...card, key: `card:${card.id}`, type: 'card', cards: [card] })),
      ...library.records.map(record => ({ ...record, key: `record:${record.id}`, type: 'record', cards: [record.fromCard, record.toCard] })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const find = key => items().find(item => item.key === key);
  const eventOf = item => item.cards[0].event || {};
  const titleOf = item => item.roomTitle || eventOf(item).title || '我的现场';
  const authorsOf = item => item.cards.map(card => card.ownerName || '我').join(' × ');
  const dateOf = item => day(eventOf(item).date || item.createdAt);

  function photoMarkup(card, eager = false) {
    const src = card.photoId ? photos.peek(card.photoId) || placeholder : SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url;
    return `<span class="library-photo"><img src="${escape(src)}" ${card.photoId ? `data-library-photo="${escape(card.photoId)}"` : ''} alt="${escape(card.photoId ? `${card.ownerName || '我'}的现场照片` : 'AI 生成的示例照片')}" loading="${eager ? 'eager' : 'lazy'}">${!card.photoId ? '<small class="library-photo__label">AI 示例图</small>' : !photos.peek(card.photoId) ? '<small class="library-photo__status">读取照片</small>' : ''}</span>`;
  }

  function hydrate(root = container) {
    root.querySelectorAll('img[data-library-photo]').forEach(async image => {
      try {
        const url = await photos.load(image.dataset.libraryPhoto);
        if (!signal.aborted && image.isConnected) {
          image.src = url;
          image.parentElement.querySelector('.library-photo__status')?.remove();
        }
      } catch (error) {
        if (error.name !== 'AbortError' && image.isConnected) {
          image.alt = '照片暂时没有读到';
          const status = image.parentElement.querySelector('.library-photo__status');
          if (status) status.textContent = '照片未读到 · 可刷新';
        }
      }
    });
  }

  function noticeMarkup() {
    return notice ? `<div class="library-notice" role="status"><p>${escape(notice)}</p><button class="text-button" data-library-action="${needsEntry ? 'enter' : retry ? 'retry' : 'refresh'}" ${busy || loading ? 'disabled' : ''}>${needsEntry ? '重新入场' : retry ? '重试' : '刷新'}</button></div>` : '';
  }

  function cardMarkup(item) {
    return `<article class="library-card library-card--${item.type}"><button class="library-card__cover" data-library-action="open" data-key="${escape(item.key)}" aria-label="查看${escape(titleOf(item))}${item.type === 'record' ? '双联记忆' : '现场卡'}"><span class="library-card__photos">${item.cards.map(card => photoMarkup(card)).join('')}</span><span class="library-card__kind">${icon(item.type === 'record' ? 'swap' : 'camera')}${item.type === 'record' ? '双联' : '现场卡'}</span></button><div class="library-card__body"><h3>${escape(titleOf(item))}</h3><p class="library-card__authors">${escape(authorsOf(item))}</p><div class="library-card__meta"><time>${escape(dateOf(item))}</time>${item.joined === false ? '<span>已离场</span>' : item.type === 'card' ? `<span>${item.isPublic ? '本场展示中' : '私藏'}</span>` : ''}</div></div><footer class="library-card__actions"><button class="text-button" data-library-action="open" data-key="${escape(item.key)}">翻开 ${icon('arrow-up-right')}</button><button class="text-button" data-library-action="download" data-key="${escape(item.key)}" data-library-mutation>保存图片</button></footer></article>`;
  }

  function render() {
    if (signal.aborted) return;
    if (!session) {
      surface.innerHTML = `<div class="library-empty"><span class="library-empty__mark" aria-hidden="true">${icon('bookmark')}</span><h2>把现场留在这里</h2><p>自己的照片，和交换来的双联。</p><button class="button button--primary" data-library-action="make-card">记录我的现场 ${icon('arrow-right')}</button></div>`;
      return;
    }
    if (!library) {
      surface.innerHTML = `<div class="library-loading" ${loading ? 'role="status"' : ''}>${loading ? `${icon('bookmark')}<p>正在翻开你的收藏</p>` : `${icon('bookmark')}<p>收藏暂时没有读到</p>`}</div>${noticeMarkup()}`;
      return;
    }
    const all = items();
    const visible = all.filter(item => filter === 'all' || item.type === filter);
    const rooms = library.rooms.filter(room => room.joined !== false);
    const exchangeRoom = filter === 'record' && (rooms.find(room => room.id === session.roomId) || rooms[0]);
    const tabs = [['all', '全部', all.length], ['card', '现场卡', library.cards.length], ['record', '双联', library.records.length]];
    surface.innerHTML = `<div class="library-toolbar"><div class="library-filters" role="group" aria-label="筛选现场收藏">${tabs.map(([value, label, count]) => `<button data-library-action="filter" data-filter="${value}" aria-pressed="${filter === value}">${label}<span>${count}</span></button>`).join('')}</div><button class="library-refresh icon-button" data-library-action="refresh" aria-label="刷新收藏" ${loading || busy ? 'disabled' : ''}>${icon('rotate')}</button></div>${noticeMarkup()}
      ${visible.length ? `<div class="library-grid">${visible.map(cardMarkup).join('')}</div>` : `<div class="library-empty"><span class="library-empty__mark" aria-hidden="true">${icon(filter === 'record' ? 'swap' : 'camera')}</span><h2>${filter === 'record' ? '下一张，和朋友一起' : '你的第一张现场卡'}</h2><p>${filter === 'record' ? '双方同意后，双联会留在这里。' : '先留一张自己的照片。'}</p><button class="button button--primary" data-library-action="${exchangeRoom ? 'room' : 'make-card'}" ${exchangeRoom ? `data-room-id="${escape(exchangeRoom.id)}"` : ''}>${exchangeRoom ? '回到现场换卡' : '记录我的现场'} ${icon('arrow-right')}</button></div>`}
      ${rooms.length ? `<details class="library-rooms"><summary>还在这些现场 <span>${rooms.length}</span>${icon('chevron-right')}</summary><div>${rooms.map(room => `<button data-library-action="room" data-room-id="${escape(room.id)}"><span><b>${escape(room.title)}</b><small>${escape([room.event?.date, room.event?.city].filter(Boolean).join(' · '))}</small></span>${icon('arrow-up-right')}</button>`).join('')}</div></details>` : ''}`;
    hydrate(surface);
    updateBusy();
  }

  async function request(path, method = 'GET') {
    const response = await fetch(`/api/live${path}`, { method, headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal });
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('这个地址尚未连接现场服务。');
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.message || '暂时没有完成，请重试。');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function refresh() {
    if (loading || busy || signal.aborted) return;
    const next = readSession();
    if (next?.token !== session?.token) {
      dialog.close(); confirmation.close(); photos.clear(); library = null;
    }
    session = next;
    if (!session) { render(); return; }
    loading = true; notice = ''; needsEntry = false; retry = null; render();
    try {
      library = await request('/library');
      if (signal.aborted) return;
      loading = false;
      render();
      if (dialog.open && selectedKey) {
        if (find(selectedKey)) openItem(selectedKey);
        else { dialog.close(); selectedKey = null; }
      }
      if (requestedKey) {
        const key = requestedKey;
        requestedKey = null;
        if (find(key)) openItem(key);
        else { notice = '这张记录已不在你的收藏里。'; render(); }
      }
    } catch (error) {
      if (signal.aborted) return;
      loading = false;
      if (error.status === 401 || error.status === 403) {
        library = null; dialog.close(); confirmation.close(); photos.clear();
        needsEntry = true;
        notice = error.status === 401 ? '当前身份已失效。重新入场会使用新身份，旧记录无法带回。' : '当前身份无法读取收藏，请重新入场。';
      } else notice = `${error instanceof TypeError ? '暂时连接不上现场服务。' : error.message}${library ? '上次收到的收藏仍在。' : '恢复连接后可刷新。'}`;
      render();
    }
  }

  function openDetail(title, content, className = '') {
    dialog.className = `library-dialog ${className}`;
    detail.innerHTML = `<header class="library-dialog__top"><h2 id="library-detail-title">${escape(title)}</h2><button class="icon-button" data-library-action="close" aria-label="关闭预览">${icon('x')}</button></header>${content}<div class="library-operation-error" data-library-error role="alert" hidden></div>`;
    api.spatial?.focus('records');
    if (!dialog.open) dialog.showModal();
    hydrate(detail);
    updateBusy();
  }

  function openItem(key) {
    const item = find(key);
    if (!item) return;
    selectedKey = key;
    const event = eventOf(item);
    openDetail(item.type === 'record' ? '一起留下的双联' : '我的现场卡', `<div class="library-detail-heading"><span>${item.type === 'record' ? '双方已同意' : item.isPublic && item.joined !== false ? '本场展示中' : '私藏'}</span><h3>${escape(titleOf(item))}</h3><p>${escape([dateOf(item), event.city].filter(Boolean).join(' · '))}${event.isDemo ? ' · 示例场次' : ''}</p></div><div class="library-detail-photos ${item.type === 'record' ? 'library-detail-photos--pair' : ''}">${item.cards.map(card => `<figure>${photoMarkup(card, true)}<figcaption><b>${escape(card.ownerName || '我')}</b><small>${escape([SPACE_MOMENTS.find(moment => moment.id === card.momentId)?.name, perspectives[card.perspective]].filter(Boolean).join(' · '))}</small>${card.caption ? `<p>${escape(card.caption)}</p>` : ''}</figcaption></figure>`).join('')}</div>${event.song ? `<p class="library-detail-song">♪ ${escape(event.song)}</p>` : ''}<div class="library-detail-actions"><button class="button button--primary" data-library-action="download" data-key="${escape(key)}" data-library-mutation>保存${item.type === 'record' ? '双联' : '卡片'}图片 ${icon('arrow-up-right')}</button><button class="button button--secondary" data-library-action="return" data-key="${escape(key)}">${item.joined === false ? '查看邀请码' : '返回现场'} ${icon('arrow-right')}</button></div>${item.type === 'record' ? `<button class="library-delete text-button" data-library-action="delete" data-key="${escape(key)}" data-library-mutation>${icon('trash')} 从我的记忆中删除</button>` : ''}`);
  }

  function openRejoin(item) {
    openDetail('再次入场', `<div class="library-return"><p>${escape(titleOf(item))}</p><label for="library-room-code">邀请码</label><input id="library-room-code" readonly value="${escape(item.roomCode)}"><small>你已离场，重新加入前会再次确认。</small><div class="library-detail-actions"><button class="button button--primary" data-library-action="join" data-key="${escape(item.key)}">去入场页 ${icon('arrow-right')}</button><button class="button button--secondary" data-library-action="open" data-key="${escape(item.key)}">回到收藏</button></div></div>`, 'library-dialog--return');
  }

  function updateBusy() {
    container.querySelectorAll('[data-library-mutation]').forEach(button => { button.disabled = busy; });
    container.querySelectorAll('[data-library-action="refresh"]').forEach(button => { button.disabled = busy || loading; });
    detail.setAttribute('aria-busy', String(busy));
  }

  async function exportItem(key) {
    const item = find(key);
    if (!item || busy) return;
    busy = true; notice = ''; retry = null; updateBusy();
    const errorBox = detail.querySelector('[data-library-error]');
    if (errorBox) errorBox.hidden = true;
    const theme = document.documentElement.dataset.theme;
    const event = eventOf(item);
    const info = { id: item.exchangeId || item.id, title: event.title || titleOf(item), song: event.song, eventDate: event.date, city: event.city, isDemo: Boolean(event.isDemo), createdAt: item.createdAt, theme };
    try {
      const cards = await Promise.all(item.cards.map(async card => ({ ...card, photoDataUrl: card.photoId ? await photos.load(card.photoId) : undefined })));
      if (signal.aborted) return;
      if (item.type === 'record') await downloadTicket(cards, info);
      else await downloadCard(cards[0], info);
      if (!signal.aborted) api.toast('图片已生成');
    } catch (error) {
      if (signal.aborted) return;
      notice = error instanceof TypeError ? '照片暂时没有读到，恢复连接后可重试保存。' : error.message;
      retry = { kind: 'download', key };
      if (dialog.open && selectedKey === key && errorBox) {
        errorBox.hidden = false;
        errorBox.innerHTML = `<span>${escape(notice)}</span><button class="text-button" data-library-action="retry">重试保存</button>`;
      }
    } finally {
      busy = false;
      if (!signal.aborted) { render(); updateBusy(); }
    }
  }

  async function deleteRecord() {
    const item = find(deleteKey);
    if (!item || item.type !== 'record' || busy) return;
    busy = true; updateBusy();
    const errorBox = confirmation.querySelector('[data-library-delete-error]');
    errorBox.hidden = true;
    try {
      await request(`/library/records/${encodeURIComponent(item.id)}`, 'DELETE');
      if (signal.aborted) return;
      library.records = library.records.filter(record => record.id !== item.id);
      confirmation.close();
      if (selectedKey === item.key) { dialog.close(); selectedKey = null; }
      photos.clear();
      deleteKey = null; notice = ''; retry = null;
      api.toast('已从你的记忆中删除');
    } catch (error) {
      if (!signal.aborted) {
        errorBox.hidden = false;
        errorBox.textContent = error instanceof TypeError ? '暂时没有连上，请再试一次。' : error.message;
      }
    } finally {
      busy = false;
      if (!signal.aborted) { render(); updateBusy(); }
    }
  }

  function restoreScene() {
    queueMicrotask(() => { if (!signal.aborted && !dialog.open && !confirmation.open) api.spatial?.restore(); });
  }
  dialog.addEventListener('close', restoreScene, { signal });
  confirmation.addEventListener('close', restoreScene, { signal });
  container.addEventListener('click', event => {
    if (event.target === dialog) { dialog.close(); return; }
    if (event.target === confirmation && !busy) { confirmation.close(); return; }
    const button = event.target.closest('[data-library-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.libraryAction;
    const key = button.dataset.key;
    if (action === 'close') dialog.close();
    if (action === 'filter') {
      filter = button.dataset.filter; render();
      surface.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
    }
    if (action === 'refresh') refresh();
    if (action === 'enter') api.navigate('live');
    if (action === 'make-card') api.navigate('live', { intent: 'make-card' });
    if (action === 'open') openItem(key);
    if (action === 'download') exportItem(key);
    if (action === 'retry' && retry?.kind === 'download') exportItem(retry.key);
    if (action === 'room') api.navigate('live', { roomId: button.dataset.roomId });
    if (action === 'return') {
      const item = find(key);
      if (item?.joined === false) openRejoin(item);
      else if (item) api.navigate('live', { roomId: item.roomId });
    }
    if (action === 'join') {
      const item = find(key);
      if (item) api.navigate('live', { joinCode: item.roomCode, intent: 'join-room' });
    }
    if (action === 'delete' && !busy) {
      deleteKey = key;
      confirmation.querySelector('[data-library-delete-error]').hidden = true;
      confirmation.showModal();
    }
    if (action === 'cancel-delete' && !busy) confirmation.close();
    if (action === 'confirm-delete') deleteRecord();
  }, { signal });
  confirmation.addEventListener('cancel', event => { if (busy) event.preventDefault(); }, { signal });

  render();
  refresh();
  return () => {
    life.abort();
    confirmation.close(); dialog.close();
    photos.clear();
  };
}

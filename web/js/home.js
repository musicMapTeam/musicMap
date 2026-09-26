import { SPACE_PHOTOS, SPACE_ACTORS, seedSpaceCard } from './space-data.js';
import { createPhotoStore } from './live-photo.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/** The front door belongs to the visitor; the two-character demo is optional. */
export function mountHome(container, api) {
  const life = new AbortController();
  const { signal } = life;
  let session = null;
  try { session = JSON.parse(localStorage.getItem('music-map-live:v1')); } catch { /* No saved identity. */ }
  const photos = createPhotoStore(() => session?.token, signal);
  let catalogue = null;
  let selected = 0;
  let error = '';
  let loading = Boolean(session?.token);
  const actor = api.getState().actor;
  const demoCards = [actor, actor === 'a' ? 'b' : 'a'].map(owner => {
    const card = api.getState().space.cards[owner] || seedSpaceCard(owner);
    if (owner !== actor && !card.isPublic) return null;
    return { id: card.id, src: card.photoDataUrl || SPACE_PHOTOS[card.photoKey]?.url,
      title: `${SPACE_ACTORS[owner].name}的卡`, subtitle: `${SPACE_ACTORS[owner].name} · 本地示例`,
      caption: card.caption, eventTitle: '回声现场', date: '2026.09.26', alt: `${SPACE_ACTORS[owner].name}的本地示例照片`,
      isDemo: true, isOwn: owner === actor, local: true, exampleImage: card.photoKey !== 'custom' };
  }).filter(Boolean);

  function entries() {
    if (!catalogue?.cards.length) return demoCards;
    return catalogue.cards.slice(0, 2).map(card => ({ ...card,
      src: card.photoId ? photos.peek(card.photoId) : SPACE_PHOTOS[card.photoKey]?.url,
      title: card.event?.title || card.roomTitle, subtitle: `${card.ownerName} · 我的现场`,
      eventTitle: card.event?.title || card.roomTitle, date: card.event?.date || '',
      alt: card.photoId ? `${card.ownerName}的现场照片` : 'AI 示例照片',
      isDemo: Boolean(card.event?.isDemo || !card.photoId), isOwn: true, local: false, exampleImage: !card.photoId,
    }));
  }
  function openCard(id) {
    const item = entries().find(card => card.id === id);
    if (!item) return;
    if (item.local) api.navigate('space', { showDemo: true, previewCardId: item.id });
    else api.navigate('records', { section: 'live', libraryItemId: `card:${item.id}` });
  }
  function publish() {
    api.spatial?.publish({ mode: 'home', cards: entries().filter(card => card.src), onPhoto: openCard,
      onEdit: () => api.navigate('live', { intent: 'make-card' }) });
  }
  function render() {
    if (signal.aborted) return;
    const cards = entries();
    selected = Math.min(selected, cards.length - 1);
    const recentRoom = catalogue?.rooms.find(room => room.id === session?.roomId) || catalogue?.rooms[0];
    container.innerHTML = `<div class="space-page space-page--home space-studio space-studio--home home-studio" aria-labelledby="home-title">
      <header class="space-studio__header"><h1 id="home-title">同场<span>留住另一面</span></h1><button type="button" class="space-studio__sample" data-home="demo">体验示例${api.icon('arrow-up-right')}</button></header>
      <div class="space-scene-slot" aria-hidden="true"></div>
      <section class="space-studio__desk" aria-label="现场卡片">
        <div class="space-card-stack" data-home-stack data-perspective="${selected ? 'crowd' : 'stage'}">${cards.map((card, index) => `<button class="space-photo space-photo--${index ? 'crowd' : 'stage'}" data-home="photo" data-id="${escape(card.id)}" data-perspective="${index ? 'crowd' : 'stage'}" aria-pressed="${index === selected}" aria-label="查看${escape(card.title)}">
          <span class="space-photo__image">${card.src ? `<img src="${escape(card.src)}" alt="${escape(card.alt)}">` : `<span class="home-photo-loading">${api.icon('image')}照片读取中</span>`}<span class="space-photo__source">${card.local ? '本地示例' : card.exampleImage ? 'AI 示例图' : '我的照片'}</span></span>
          <span class="space-photo__caption"><strong>${escape(card.title)}</strong><span>${card.local ? '体验换卡' : '打开记忆'}${api.icon('arrow-up-right')}</span></span>
          <span class="space-photo__stamp"><span>${escape(card.eventTitle)}</span><span>${escape(card.date)}</span></span>
        </button>`).join('')}</div>
        <div class="space-studio__controls"><div class="space-perspectives" role="group" aria-label="卡片选择">${cards.map((card, index) => `<button data-home="select" data-index="${index}" data-perspective="${index ? 'crowd' : 'stage'}" aria-pressed="${index === selected}"><span></span>${escape(card.title)}</button>`).join('')}</div>
          <div class="space-studio__actions"><button class="button button--primary" data-home="make">${api.icon('plus')}记录我的现场</button><button class="button" data-home="invite">${api.icon('users')}邀请朋友</button></div>
        </div>
      </section>
      <div class="home-return">${recentRoom ? `<button data-home="resume" data-room="${escape(recentRoom.id)}">${api.icon('arrow-right')}继续 ${escape(recentRoom.title)}</button>` : loading ? '<span role="status">正在找回你的现场…</span>' : ''}${error ? `<span role="status">${escape(error)}</span><button data-home="retry">重试</button>` : ''}</div>
    </div>`;
    publish();
  }
  async function load() {
    if (!session?.token || loading && catalogue) return;
    loading = true; error = '';
    try {
      const response = await fetch('/api/live/library', { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('暂时读不到你的现场记录');
      catalogue = await response.json();
      catalogue.cards.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      if (signal.aborted) return;
      loading = false; render();
      await Promise.all(catalogue.cards.slice(0, 2).filter(card => card.photoId).map(async card => {
        try { await photos.load(card.photoId); if (!signal.aborted) render(); }
        catch (reason) { if (reason.name !== 'AbortError') { error = '有张照片没能读到'; render(); } }
      }));
    } catch (reason) {
      if (reason.name !== 'AbortError') { error = reason.message; loading = false; render(); }
    }
  }
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-home]');
    if (!button) return;
    if (button.dataset.home === 'make') api.navigate('live', { intent: 'make-card' });
    if (button.dataset.home === 'invite') api.navigate('live', { intent: 'invite' });
    if (button.dataset.home === 'demo') api.navigate('space', { showDemo: true });
    if (button.dataset.home === 'resume') api.navigate('live', { roomId: button.dataset.room });
    if (button.dataset.home === 'retry') load();
    if (button.dataset.home === 'select') { selected = Number(button.dataset.index); render(); }
    if (button.dataset.home === 'photo') {
      const index = entries().findIndex(card => card.id === button.dataset.id);
      if (selected !== index) { selected = index; render(); } else openCard(button.dataset.id);
    }
  }, { signal });
  render();
  load();
  return () => { life.abort(); api.spatial?.publish({ cards: [] }); photos.clear(); };
}

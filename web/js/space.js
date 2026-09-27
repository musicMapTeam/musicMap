import { SPACE_EVENT, SPACE_ACTORS, SPACE_MOMENTS, SPACE_PHOTOS, seedSpaceCard } from './space-data.js';
import { downloadTicket } from './ticket-export.js';
import { openDuetCeremony } from './duet-ceremony.js';
import { perspectiveLabel, sharedLine } from './duet-facts.js';

// Keep presentation mode across app renders without adding it to saved cards.
let showDemo = false;
let homePerspective = 'stage';

export function createSpaceState() {
  return {
    version: 1,
    cards: { a: null, b: seedSpaceCard('b') },
    exchanges: [],
    reactions: { a: {}, b: {} },
    records: { a: [], b: [] },
  };
}

const escape = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const snapshot = (value) => JSON.parse(JSON.stringify(value));
const otherActor = (actor) => actor === 'a' ? 'b' : 'a';
const momentName = (card) => SPACE_MOMENTS.find((moment) => moment.id === card.momentId)?.name || '这一刻';
const cardPhoto = (card) => card.photoKey === 'custom' ? card.photoDataUrl : SPACE_PHOTOS[card.photoKey]?.url || SPACE_PHOTOS.stage.url;
const now = () => new Date().toISOString();
const identifier = () => `exchange-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const actorName = (actor) => SPACE_ACTORS[actor]?.name || '示例角色';

function visibleSpaceCards(state) {
  const own = state.space.cards[state.actor];
  const peer = state.space.cards[otherActor(state.actor)];
  return [
    { card: own || seedSpaceCard(state.actor), saved: Boolean(own) },
    ...(peer?.isPublic ? [{ card: peer, saved: true }] : []),
  ];
}

function sharedMoment(first, second) {
  if (!first || !second) return '';
  const moments = first.momentId === second.momentId;
  const song = first.trackId && first.trackId === second.trackId;
  if (moments && song) return `你们都把《${SPACE_EVENT.song}》的${momentName(first)}留在了卡上`;
  if (song) return `你们都选了《${SPACE_EVENT.song}》`;
  if (moments) return `你们都记得「${momentName(first)}」`;
  return '同一场现场，另一种值得留下的视角';
}

function ticketMarkup(card, options = {}) {
  const { small = false, preview = false } = options;
  const author = SPACE_ACTORS[card.owner];
  return `<article class="sp-ticket sp-ticket--${author.color}${small ? ' sp-ticket--small' : ''}${preview ? ' sp-ticket--preview' : ''}">
    <div class="sp-ticket__photo">
      <img src="${escape(cardPhoto(card))}" alt="${card.photoKey === 'custom' ? `${escape(author.name)}选择的现场照片` : `${escape(SPACE_PHOTOS[card.photoKey]?.description || '现场示例图片')}`}" ${preview ? '' : 'loading="lazy"'}>
      <div class="sp-ticket__image-top"><span>${escape(momentName(card))}</span><span>${card.photoKey === 'custom' ? '我的照片' : 'AI 示例图'}</span></div>
    </div>
    <div class="sp-ticket__paper">
      <div class="sp-ticket__event"><span>${escape(SPACE_EVENT.title)}</span><span>${escape(SPACE_EVENT.date)}</span></div>
      <p class="sp-ticket__caption">${escape(card.caption || '把这一刻，留给以后。')}</p>
      <div class="sp-ticket__song">${card.trackId ? `《${escape(SPACE_EVENT.song)}》` : escape(momentName(card))}</div>
      <div class="sp-ticket__stub"><span class="sp-ticket__author"><span class="sp-avatar sp-avatar--${author.color}">${escape(author.initial)}</span>${escape(author.name)}<span>的现场卡</span></span><span class="sp-ticket__code" aria-hidden="true">${card.owner === 'a' ? 'A—0926' : 'B—0926'}</span></div>
    </div>
  </article>`;
}

function actorSwitchMarkup(actor, api, compact = false) {
  return `<div class="sp-demo-bar${compact ? ' sp-demo-bar--compact' : ''}">
    <div class="sp-demo-bar__description"><span class="sp-demo-dot"></span><div><strong>切换角色</strong></div></div>
    <div class="sp-actor-switch" role="group" aria-label="切换示例角色">
      ${Object.values(SPACE_ACTORS).map((person) => `<button type="button" data-space-action="actor" data-actor="${person.id}" class="sp-actor-button${person.id === actor ? ' is-active' : ''}" aria-pressed="${person.id === actor}" aria-label="切换到${escape(person.name)}示例角色"><span class="sp-avatar sp-avatar--${person.color}">${escape(person.initial)}</span><span>${escape(person.name)}</span>${person.id === actor ? api.icon('check') : ''}</button>`).join('')}
    </div>
    ${compact ? '' : `<button type="button" class="icon-button sp-demo-help" data-space-action="about" aria-label="关于这个情景演示">${api.icon('info')}</button>`}
  </div>`;
}

function getActiveExchange(space, actor, target) {
  return [...space.exchanges].reverse().find((exchange) =>
    (exchange.from === actor && exchange.to === target) || (exchange.from === target && exchange.to === actor));
}

function getCompletedExchange(space, first, second) {
  if (!first || !second) return null;
  const matches = (saved, card) => saved.id === card.id && saved.owner === card.owner && (saved.revision || 1) === (card.revision || 1);
  return [...space.exchanges].reverse().find((exchange) => exchange.status === 'accepted' && (
    (matches(exchange.fromCard, first) && matches(exchange.toCard, second)) ||
    (matches(exchange.fromCard, second) && matches(exchange.toCard, first))
  ));
}

function exchangeNoticeMarkup(space, actor, api) {
  const relevant = space.exchanges.filter((exchange) => exchange.from === actor || exchange.to === actor);
  if (!relevant.length) return '';
  const latest = relevant[relevant.length - 1];
  const recipient = latest.to === actor;
  const other = recipient ? latest.from : latest.to;
  if (latest.status === 'pending') {
    return `<section class="sp-exchange-notice${recipient ? ' sp-exchange-notice--incoming' : ''}" aria-label="交换申请"><span class="sp-exchange-notice__icon">${api.icon('swap')}</span><div class="sp-exchange-notice__text"><h2>${recipient ? `${escape(actorName(other))}想和你换卡` : `等待${escape(actorName(other))}回应`}</h2></div><div class="sp-exchange-notice__actions"><button type="button" class="button ${recipient ? 'button--primary' : 'button--quiet'}" data-space-action="view-exchange" data-id="${escape(latest.id)}">查看申请</button>${recipient ? '' : `<button type="button" class="button button--primary" data-space-action="actor" data-actor="${other}">切到${escape(actorName(other))}${api.icon('arrow-right')}</button>`}</div></section>`;
  }
  if (latest.status === 'accepted') {
    return `<section class="sp-exchange-notice sp-exchange-notice--accepted" aria-label="交换已完成"><span class="sp-exchange-notice__icon">${api.icon('check')}</span><div class="sp-exchange-notice__text"><h2>双联记忆已生成</h2></div><button type="button" class="button button--primary" data-space-action="view-exchange" data-id="${escape(latest.id)}">打开记忆${api.icon('arrow-up-right')}</button></section>`;
  }
  return `<div class="sp-quiet-notice">${api.icon('info')}<span>${latest.status === 'declined' ? '对方婉拒了这次交换' : latest.cancelReason === 'hidden' ? '卡片已撤下，申请已取消' : '申请已取消'}</span><button type="button" data-space-action="view-exchange" data-id="${escape(latest.id)}">查看</button></div>`;
}

function makeLifecycle(container, api) {
  const controller = new AbortController();
  const dialogs = new Set();
  let disposed = false;
  let ceremony = null;
  function dialog(content, className = '') {
    const element = document.createElement('dialog');
    const titleId = `sp-dialog-${Math.random().toString(36).slice(2, 9)}`;
    element.className = `sp-dialog ${className}`;
    element.setAttribute('aria-labelledby', titleId);
    element.innerHTML = content.replace('data-dialog-title', `id="${titleId}"`);
    document.body.append(element);
    dialogs.add(element);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (element.open) element.close();
      dialogs.delete(element);
      element.remove();
      queueMicrotask(() => {
        if (!disposed && !dialogs.size && !ceremony) api.spatial?.restore();
      });
    };
    element.addEventListener('click', (event) => {
      if (event.target.closest('[data-dialog-close]')) close();
      if (event.target === element) {
        const bounds = element.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }
    });
    element.addEventListener('close', close, { once: true });
    element.showModal();
    return { element, close };
  }
  const closeButton = () => `<button type="button" class="icon-button sp-dialog__close" data-dialog-close aria-label="关闭">${api.icon('x')}</button>`;

  function publishScene() {
    const state = api.getState();
    api.spatial?.publish({
      mode: showDemo ? 'exchange' : 'home',
      cards: visibleSpaceCards(state).map(({ card, saved }) => ({
        id: card.id,
        isOwn: card.owner === state.actor,
        local: true,
        src: cardPhoto(card),
        title: card.caption || momentName(card),
        subtitle: `${actorName(card.owner)} · ${saved ? '本地示例' : '未保存的示例'}`,
        alt: `${actorName(card.owner)}的${card.photoKey === 'custom' ? '现场照片' : 'AI 示例照片'}`,
        isDemo: true,
      })),
      onPhoto: openPhoto,
      onEdit: openEditor,
    });
  }

  function openPhoto(id) {
    if (disposed) return;
    const state = api.getState();
    const entry = visibleSpaceCards(state).find(({ card }) => card.id === id);
    if (!entry) { api.toast('这张卡暂未展示'); return; }
    const { card, saved } = entry;
    const own = card.owner === state.actor;
    const completed = own ? null : getCompletedExchange(state.space, state.space.cards[state.actor], card);
    const active = own ? null : getActiveExchange(state.space, state.actor, card.owner);
    const pending = active?.status === 'pending';
    const label = own ? saved ? '编辑现场卡' : '做一张自己的卡' : pending ? '查看申请' : completed ? '打开双联记忆' : state.space.cards[state.actor] ? '申请换卡' : '先做一张卡';
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">${saved ? '本地示例' : '示例卡 · 尚未保存'}</span>${closeButton()}<h2 data-dialog-title>${escape(actorName(card.owner))}的现场卡</h2></div><div class="sp-dialog__body sp-record-single">${ticketMarkup(card)}</div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>收好</button><button type="button" class="button button--primary" data-photo-continue>${label}${api.icon('arrow-right')}</button></div>`, 'sp-dialog--narrow');
    api.spatial?.focus('photo', card.id);
    element.querySelector('[data-photo-continue]').addEventListener('click', () => {
      close();
      if (own) openEditor();
      else if (pending) openExchange(active.id);
      else if (completed) openExchange(completed.id);
      else openRequest(card.owner);
    });
  }
  function about() {
    dialog(`<div class="sp-dialog__head">${closeButton()}<h2 data-dialog-title>本地换卡示例</h2></div><div class="sp-dialog__body sp-about"><p>切换 Lin 和阿遥，体验制卡、申请与接受。卡片仅存本机，不会带入朋友的房间。</p><p>场次、角色和歌曲为示例，预置图片由 AI 生成。</p></div><div class="sp-dialog__footer"><button type="button" class="button button--primary" data-dialog-close>知道了</button></div>`, 'sp-dialog--narrow');
  }

  function switchActor(actor) {
    if (!(actor in SPACE_ACTORS) || actor === api.getState().actor) return;
    api.update((state) => { state.actor = actor; });
    api.render();
    api.toast(`已切到 ${actorName(actor)} 的示例视角`);
  }

  function upsertRecord(space, actor, record) {
    const existing = space.records[actor].find((item) => item.id === record.id);
    if (existing) Object.assign(existing, record, { createdAt: existing.createdAt, updatedAt: now() });
    else space.records[actor].unshift({ ...record, createdAt: now(), updatedAt: now() });
  }

  function saveExchangeRecord(space, actor, exchange) {
    const counterpart = exchange.from === actor ? exchange.to : exchange.from;
    upsertRecord(space, actor, {
      id: `exchange:${exchange.id}`, kind: 'exchange', exchangeId: exchange.id,
      title: `${SPACE_EVENT.title} · 与${actorName(counterpart)}的双联记忆`,
      fromCard: snapshot(exchange.fromCard), toCard: snapshot(exchange.toCard),
      decidedAt: exchange.decidedAt,
    });
  }

  function mapActionsMarkup() {
    return `${api.getState().space.mapReturnId ? `<button type="button" class="button button--quiet" data-resume-map>${api.icon('arrow-left')}继续刚才的探索</button>` : ''}<button type="button" class="button button--quiet" data-return-map>${api.icon('compass')}从${escape(SPACE_EVENT.artists[0])}新开探索</button>`;
  }

  function bindMapActions(element, close) {
    element.querySelector('[data-return-map]')?.addEventListener('click', () => { close(); api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space', newSession: true }); });
    element.querySelector('[data-resume-map]')?.addEventListener('click', () => { close(); api.navigate('explore', { resumeSessionId: api.getState().space.mapReturnId }); });
  }

  function openCardSaved() {
    const state = api.getState();
    const card = state.space.cards[state.actor];
    if (!card) return;
    const peer = otherActor(state.actor);
    api.spatial?.focus('photo', card.id);
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">现场卡</span>${closeButton()}<h2 data-dialog-title>卡片已保存</h2></div><div class="sp-dialog__body sp-saved-next"><div class="sp-saved-next__card"><img src="${escape(cardPhoto(card))}" alt="刚保存的现场卡照片"><div><span>${card.isPublic ? '本场展示中' : '仅自己可见'} · 本地情景</span><strong>${escape(card.caption || momentName(card))}</strong><p>${escape(actorName(state.actor))}的记忆</p></div></div><p>${card.isPublic ? '对方已能看到这张卡，可以申请交换。' : '卡片仍是私藏。你可以展示，或直接向对方申请交换。'}</p></div><div class="sp-dialog__footer sp-dialog__footer--wrap"><button type="button" class="button button--quiet" data-view-saved>查看我的记忆</button>${card.isPublic ? '' : '<button type="button" class="button button--quiet" data-display-saved>展示在本场</button>'}<button type="button" class="button button--primary" data-see-peer>看看${escape(actorName(peer))}的卡${api.icon('arrow-right')}</button></div>`, 'sp-dialog--narrow');
    element.querySelector('[data-view-saved]').addEventListener('click', () => { close(); api.navigate('records', { section: 'space', spaceRecordId: `card:${card.id}` }); });
    element.querySelector('[data-display-saved]')?.addEventListener('click', () => { close(); toggleVisibility(); });
    element.querySelector('[data-see-peer]').addEventListener('click', () => { close(); const peerCard = api.getState().space.cards[peer]; if (peerCard?.isPublic) openPhoto(peerCard.id); else api.toast('对方还未展示卡片'); });
  }

  function openEditor(options = {}) {
    if (disposed) return;
    api.spatial?.focus('editor');
    const actor = api.getState().actor;
    const currentCard = api.getState().space.cards[actor];
    const draft = currentCard ? snapshot(currentCard) : { ...seedSpaceCard(actor), isPublic: false, createdAt: now(), caption: actor === 'a' ? '灯光暗下去，还舍不得说再见。' : '你在看舞台，我想留下这一片人海。' };
    let processing = false;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">本地示例</span>${closeButton()}<h2 data-dialog-title>${currentCard ? '编辑现场卡' : '制作现场卡'}</h2><p>${escape(actorName(actor))} · ${escape(SPACE_EVENT.title)}</p></div>
      <form class="sp-editor" novalidate>
        <div class="sp-editor__fields">
          <fieldset class="sp-field"><legend>照片</legend><div class="sp-photo-options">${Object.values(SPACE_PHOTOS).map((photo) => `<button type="button" data-photo="${photo.id}" class="sp-photo-choice${draft.photoKey === photo.id ? ' is-selected' : ''}" aria-pressed="${draft.photoKey === photo.id}"><img src="${escape(photo.url)}" alt="${escape(photo.description)}"><span>${escape(photo.name)}</span><i>${api.icon('check')}</i></button>`).join('')}<button type="button" data-photo="custom" class="sp-photo-choice sp-photo-choice--upload${draft.photoKey === 'custom' ? ' is-selected' : ''}" aria-pressed="${draft.photoKey === 'custom'}">${draft.photoDataUrl ? `<img src="${escape(draft.photoDataUrl)}" alt="我的照片"><span>我的照片</span>` : `${api.icon('camera')}<span>用自己的照片</span>`}<i>${api.icon('check')}</i></button></div><input type="file" name="photo" accept="image/*" class="sp-visually-hidden" aria-label="选择自己的照片"><p class="sp-field__hint" data-photo-hint>AI 示例图 · 上传照片仅存本机</p></fieldset>
          <fieldset class="sp-field"><legend>时刻</legend><div class="sp-moment-options">${SPACE_MOMENTS.map((moment) => `<button type="button" data-moment="${moment.id}" class="sp-moment-choice${draft.momentId === moment.id ? ' is-selected' : ''}" aria-pressed="${draft.momentId === moment.id}">${escape(moment.name)}</button>`).join('')}</div><label class="sp-input-label" for="sp-song-select">这一刻的音乐</label><select id="sp-song-select" name="track"><option value="${SPACE_EVENT.trackId}"${draft.trackId ? ' selected' : ''}>《${escape(SPACE_EVENT.song)}》 · 示例曲目</option><option value=""${!draft.trackId ? ' selected' : ''}>只记录这个环节</option></select></fieldset>
          <div class="sp-field"><label class="sp-field__title" for="sp-caption-input">留一句话</label><textarea id="sp-caption-input" name="caption" rows="3" maxlength="80" placeholder="那一刻，你在想什么？">${escape(draft.caption)}</textarea><div class="sp-field__counter"><span>选填</span><span data-caption-count>${draft.caption.length} / 80</span></div></div>
          <label class="sp-display-consent"><input type="checkbox" name="isPublic"${draft.isPublic ? ' checked' : ''}><span class="sp-display-consent__check">${api.icon('check')}</span><span><strong>展示这张卡</strong><small>让另一位角色看见；不勾选则私藏。</small></span></label>
          <p class="sp-form-error" role="alert" data-editor-error hidden></p>
        </div>
        <details class="sp-editor__preview"${matchMedia('(min-width: 701px)').matches ? ' open' : ''}><summary>预览卡片<span>${api.icon('chevron-right')}</span></summary><div data-card-preview>${ticketMarkup(draft, { preview: true })}</div></details>
        <div class="sp-editor__submit"><span class="sp-editor__save-state" data-save-state>${draft.isPublic ? '保存并展示在本场' : '仅自己保存 · 不展示'}</span><button type="button" class="button button--quiet" data-dialog-close>取消</button><button type="submit" class="button button--primary"><span data-save-label>${draft.isPublic ? '保存并展示' : '保存现场卡'}</span>${api.icon('arrow-right')}</button></div>
      </form>`, 'sp-dialog--editor');
    const form = element.querySelector('form');
    const error = element.querySelector('[data-editor-error]');
    const preview = () => {
      element.querySelector('[data-card-preview]').innerHTML = ticketMarkup(draft, { preview: true });
      element.querySelectorAll('[data-photo]').forEach((button) => {
        const selected = button.dataset.photo === draft.photoKey;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      element.querySelectorAll('[data-moment]').forEach((button) => {
        const selected = button.dataset.moment === draft.momentId;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    };
    form.addEventListener('click', (event) => {
      const photo = event.target.closest('[data-photo]');
      const moment = event.target.closest('[data-moment]');
      if (photo) {
        if (photo.dataset.photo === 'custom') form.elements.photo.click();
        else { draft.photoKey = photo.dataset.photo; preview(); }
      }
      if (moment) { draft.momentId = moment.dataset.moment; preview(); }
    });
    form.elements.caption.addEventListener('input', () => {
      draft.caption = form.elements.caption.value;
      element.querySelector('[data-caption-count]').textContent = `${draft.caption.length} / 80`;
      preview();
    });
    form.elements.track.addEventListener('change', () => { draft.trackId = form.elements.track.value; preview(); });
    form.elements.isPublic.addEventListener('change', () => {
      element.querySelector('[data-save-state]').textContent = form.elements.isPublic.checked ? '保存并展示在本场' : '仅自己保存 · 不展示';
      element.querySelector('[data-save-label]').textContent = form.elements.isPublic.checked ? '保存并展示' : '保存现场卡';
    });
    form.elements.photo.addEventListener('change', async () => {
      const file = form.elements.photo.files[0];
      if (!file) return;
      processing = true;
      form.querySelector('[type="submit"]').disabled = true;
      error.hidden = true;
      element.querySelector('[data-photo-hint]').textContent = '正在处理照片…';
      try {
        const dataUrl = await compressPhoto(file);
        if (!element.isConnected || disposed) return;
        draft.photoKey = 'custom';
        draft.photoDataUrl = dataUrl;
        const custom = element.querySelector('[data-photo="custom"]');
        custom.innerHTML = `<img src="${escape(dataUrl)}" alt="我的照片"><span>更换我的照片</span><i>${api.icon('check')}</i>`;
        element.querySelector('[data-photo-hint]').textContent = '照片仅存本机 · 点图片更换';
        preview();
      } catch (cause) {
        if (!element.isConnected) return;
        error.textContent = cause.message || '这张照片暂时无法打开，请换一张 JPG 或 PNG。';
        error.hidden = false;
        element.querySelector('[data-photo-hint]').textContent = '可重选，或使用示例图。';
      } finally {
        processing = false;
        if (element.isConnected) form.querySelector('[type="submit"]').disabled = false;
        form.elements.photo.value = '';
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (processing) return;
      draft.caption = form.elements.caption.value.trim();
      draft.isPublic = form.elements.isPublic.checked;
      draft.updatedAt = now();
      draft.revision = (currentCard?.revision || 0) + 1;
      if (draft.photoKey !== 'custom') draft.photoDataUrl = '';
      try {
        api.update((state) => {
          if (state.actor !== actor) return;
          state.space.cards[actor] = snapshot(draft);
          upsertRecord(state.space, actor, { id: `card:${draft.id}`, kind: 'single', card: snapshot(draft), title: `${SPACE_EVENT.title} · 我的现场` });
          if (!draft.isPublic) cancelPendingForCard(state.space, draft.id);
        });
        close();
        if (options.requestTarget) {
          api.navigate('space', { eventId: SPACE_EVENT.id, requestTarget: options.requestTarget });
        } else {
          api.navigate('space', { eventId: SPACE_EVENT.id, cardSaved: true });
        }
        api.toast(draft.isPublic ? '现场卡已保存，也展示在本场了' : '现场卡已私下保存，只有当前角色可见');
      } catch {
        error.textContent = '这次还没有保存成功，请重试或换用示例照片。';
        error.hidden = false;
      }
    });
  }

  function openRequest(target) {
    const state = api.getState();
    const actor = state.actor;
    if (actor === target) return;
    const own = state.space.cards[actor];
    const theirs = state.space.cards[target];
    if (!own) { openEditor({ requestTarget: target }); return; }
    const completed = getCompletedExchange(state.space, own, theirs);
    if (completed) { openExchange(completed.id); return; }
    if (!theirs?.isPublic) { api.toast('这张卡暂未展示，先看看自己的现场吧'); return; }
    const previous = [...state.space.exchanges].reverse().find((exchange) => {
      const samePair = (exchange.from === actor && exchange.to === target) || (exchange.from === target && exchange.to === actor);
      return samePair && exchange.status === 'pending';
    });
    if (previous) { openExchange(previous.id); return; }
    api.spatial?.focus('photo', theirs.id);
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">交换申请</span>${closeButton()}<h2 data-dialog-title>和${escape(actorName(target))}交换这两张卡？</h2></div><div class="sp-dialog__body"><div class="sp-common-reason">${api.icon('heart')}<span>${escape(sharedMoment(own, theirs))}</span></div><div class="sp-pair sp-pair--request"><div><div class="sp-pair__label">${escape(actorName(actor))}的卡</div>${ticketMarkup(own, { small: true })}</div><span class="sp-pair__join" aria-hidden="true">${api.icon('swap')}</span><div><div class="sp-pair__label">${escape(actorName(target))}的卡</div>${ticketMarkup(theirs, { small: true })}</div></div><p class="sp-exchange-boundary">对方同意后，双方各自收好一份双联记忆。</p>${own.isPublic ? '' : '<p class="sp-private-note">这张私藏卡将向对方可见。</p>'}</div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>再看看</button><button type="button" class="button button--primary" data-send-request>发送申请${api.icon('arrow-right')}</button></div>`, 'sp-dialog--exchange');
    element.querySelector('[data-send-request]').addEventListener('click', (event) => {
      event.currentTarget.disabled = true;
      let created = false;
      api.update((updated) => {
        const space = updated.space;
        if (updated.actor !== actor || !space.cards[target]?.isPublic || !space.cards[actor]) return;
        const active = space.exchanges.some((exchange) => exchange.status === 'pending' && ((exchange.from === actor && exchange.to === target) || (exchange.from === target && exchange.to === actor)));
        if (active) return;
        space.exchanges.push({
          id: identifier(), eventId: SPACE_EVENT.id, from: actor, to: target,
          fromCardId: own.id, toCardId: theirs.id,
          fromCard: snapshot(own), toCard: snapshot(theirs),
          status: 'pending', createdAt: now(), decidedAt: null,
        });
        created = true;
      });
      close();
      api.render();
      api.toast(created ? `申请已递给${actorName(target)}，还在等待对方回应` : '已有一条待回应申请');
    });
  }

  function openExchange(id, { reveal = false } = {}) {
    const state = api.getState();
    const actor = state.actor;
    const exchange = state.space.exchanges.find((item) => item.id === id);
    if (!exchange || (exchange.from !== actor && exchange.to !== actor)) return;
    // Only an accepted exchange reaches the duet; every other state keeps its paper dialog.
    if (exchange.status === 'accepted') { openDuet(exchange, { reveal }); return; }
    const pending = exchange.status === 'pending';
    const receiving = exchange.to === actor;
    const counterpart = receiving ? exchange.from : exchange.to;
    api.spatial?.focus('photo', receiving ? exchange.fromCard.id : exchange.toCard.id);
    const titles = { pending: receiving ? '要交换这两张卡吗？' : '等待对方回应', declined: '对方婉拒了交换', cancelled: '申请已取消' };
    const statusText = { pending: receiving ? '待你回应' : `等待${actorName(counterpart)}回应`, declined: '对方未接受', cancelled: '已取消' };
    const exchangeVisual = `<div class="sp-common-reason">${api.icon('heart')}<span>${escape(sharedMoment(exchange.fromCard, exchange.toCard))}</span></div><div class="sp-pair sp-pair--request"><div><div class="sp-pair__label">${escape(actorName(exchange.from))}的卡</div>${ticketMarkup(exchange.fromCard, { small: true })}</div><span class="sp-pair__join" aria-hidden="true">${api.icon('swap')}</span><div><div class="sp-pair__label">${escape(actorName(exchange.to))}的卡</div>${ticketMarkup(exchange.toCard, { small: true })}</div></div>`;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">现场卡交换</span>${closeButton()}<h2 data-dialog-title>${titles[exchange.status]}</h2><p class="sp-exchange-status">${api.icon(pending ? 'swap' : 'info')}<span>${escape(statusText[exchange.status])}</span></p></div><div class="sp-dialog__body">${exchangeVisual}<p class="sp-exchange-boundary">${pending ? '同意后，双方各自保存这两张卡的双联快照。' : '双方保留自己的卡片。'}</p>${pending && !receiving ? '<p class="sp-private-note">切到对方角色，接受或拒绝这次申请。</p>' : ''}</div><div class="sp-dialog__footer sp-dialog__footer--wrap">${pending && receiving ? `<button type="button" class="button button--quiet" data-decide="declined">这次先不了</button><button type="button" class="button button--primary" data-decide="accepted">同意交换${api.icon('swap')}</button>` : pending ? `<button type="button" class="button button--quiet" data-decide="cancelled">取消申请</button><button type="button" class="button button--primary" data-switch-recipient>切到${escape(actorName(counterpart))}${api.icon('arrow-right')}</button>` : '<button type="button" class="button button--primary" data-dialog-close>回到本场</button>'}</div>`, 'sp-dialog--exchange');
    element.querySelectorAll('[data-decide]').forEach((button) => button.addEventListener('click', () => {
      const decision = button.dataset.decide;
      let changed = false;
      api.update((updated) => {
        const current = updated.space.exchanges.find((item) => item.id === id);
        if (!current || current.status !== 'pending' || updated.actor !== actor) return;
        const allowed = decision === 'cancelled' ? current.from === actor : current.to === actor;
        if (!allowed) return;
        current.status = decision;
        current.decidedAt = now();
        if (decision === 'accepted') {
          saveExchangeRecord(updated.space, current.from, current);
          saveExchangeRecord(updated.space, current.to, current);
        }
        changed = true;
      });
      close();
      if (changed && decision === 'accepted') {
        // The new page owns its listeners; carry the result and its premiere through the route.
        api.navigate('space', { eventId: SPACE_EVENT.id, exchangeId: id, reveal: true });
        return;
      }
      api.render();
      if (changed) api.toast(decision === 'declined' ? '已婉拒，卡片没有交换' : '已取消申请');
    }));
    element.querySelector('[data-switch-recipient]')?.addEventListener('click', () => { close(); switchActor(counterpart); });
  }

  function openRecord(id) {
    const actor = api.getState().actor;
    const record = api.getState().space.records[actor].find((item) => item.id === id);
    if (!record) return;
    if (record.kind === 'exchange') { openDuet(record, { recordId: id }); return; }
    api.spatial?.focus('photo', record.card.id);
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">我的现场记忆</span>${closeButton()}<h2 data-dialog-title>属于你的这一晚。</h2><p>${escape(actorName(actor))}的本地记录 · ${escape(SPACE_EVENT.title)}</p></div><div class="sp-dialog__body"><div class="sp-record-single">${ticketMarkup(record.card)}</div></div><div class="sp-dialog__footer sp-dialog__footer--wrap"><button type="button" class="button button--quiet" data-delete-record>${api.icon('trash')}删除这条记录</button>${mapActionsMarkup()}</div>`, 'sp-dialog--narrow');
    bindMapActions(element, close);
    element.querySelector('[data-delete-record]').addEventListener('click', () => { close(); deleteRecord(id); });
  }

  /** The local scenario uses the same duet page; roles, venue and song are labelled as fictional. */
  function openDuet(source, { reveal = false, recordId = null } = {}) {
    if (disposed) return;
    const actor = api.getState().actor;
    const exchangeId = source.exchangeId || source.id;
    const cards = [source.fromCard, source.toCard];
    const existing = api.getState().space.records[actor].some((record) => record.id === `exchange:${exchangeId}`);
    const completedAt = source.decidedAt || source.createdAt;
    const resumeId = api.getState().space.mapReturnId;
    ceremony?.close();
    const handle = openDuetCeremony({
      id: `local:${exchangeId}`,
      reveal,
      scenario: 'local',
      event: { title: SPACE_EVENT.title, subtitle: SPACE_EVENT.subtitle, date: SPACE_EVENT.date, city: SPACE_EVENT.city, isDemo: true },
      completedAt,
      sides: cards.map((card) => ({
        author: actorName(card.owner),
        src: cardPhoto(card) || SPACE_PHOTOS.stage.url,
        isExample: card.photoKey !== 'custom',
        perspective: perspectiveLabel(card),
        moment: momentName(card),
        caption: card.caption || '把这一刻，留给以后。',
      })),
      shared: sharedLine(cards, { title: SPACE_EVENT.title, song: SPACE_EVENT.song }),
      status: existing ? '双方已同意 · 已收进本地记忆' : '双方已同意',
      note: '再次公开对方照片前，请先征得对方同意。',
      closeLabel: recordId ? '关闭双联，回到记忆' : '关闭双联，回到示例',
      actions: [
        { id: 'save', kind: 'primary', icon: 'image', label: '保存双联图片', busyLabel: '正在生成图片…', run: () => downloadTicket(cards.map((card) => ({ ...card, ownerName: actorName(card.owner), photoDataUrl: card.photoKey === 'custom' ? card.photoDataUrl : '' })), {
          title: SPACE_EVENT.title,
          subtitle: SPACE_EVENT.subtitle,
          song: SPACE_EVENT.song,
          eventDate: SPACE_EVENT.date,
          city: SPACE_EVENT.city,
          isDemo: true,
          scenario: 'local',
          createdAt: completedAt,
          id: exchangeId,
        }) },
        // One quiet way back, the same on every entry; memory and exploration stay as links.
        recordId
          ? { id: 'scene', kind: 'secondary', icon: 'arrow-left', label: '返回示例现场', run: ({ close }) => { close(); api.navigate('space', { eventId: SPACE_EVENT.id }); } }
          : { id: 'back', kind: 'secondary', icon: 'arrow-left', label: '返回现场', run: ({ close }) => close() },
        recordId ? null : existing
          ? { id: 'memory', kind: 'link', icon: 'bookmark', label: '查看我的记忆', run: ({ close }) => { close(); api.navigate('records', { section: 'space', spaceRecordId: `exchange:${exchangeId}` }); } }
          : { id: 'keep', kind: 'link', icon: 'plus', label: '收进我的记忆', run: ({ close }) => {
            api.update((updated) => {
              if (updated.actor !== actor) return;
              const actual = updated.space.exchanges.find((item) => item.id === exchangeId);
              if (!actual || actual.status !== 'accepted' || (actual.from !== actor && actual.to !== actor)) return;
              saveExchangeRecord(updated.space, actor, actual);
            });
            close();
            api.navigate('records', { section: 'space', spaceRecordId: `exchange:${exchangeId}` });
            api.toast('已收进当前角色的现场记忆');
          } },
        resumeId ? { id: 'resume-map', kind: 'link', icon: 'arrow-left', label: '继续刚才的探索', run: ({ close }) => { close(); api.navigate('explore', { resumeSessionId: resumeId }); } } : null,
        { id: 'map', kind: 'link', icon: 'compass', label: `从${SPACE_EVENT.artists[0]}新开探索`, run: ({ close }) => { close(); api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space', newSession: true }); } },
        recordId ? { id: 'remove', kind: 'remove', icon: 'trash', label: '删除这条记录', run: () => deleteRecord(recordId) } : null,
      ],
      onClose: () => {
        if (ceremony !== handle) return;
        ceremony = null;
        queueMicrotask(() => { if (!disposed && !dialogs.size && !ceremony) api.spatial?.restore(); });
      },
    });
    ceremony = handle;
  }

  function deleteRecord(id) {
    const actor = api.getState().actor;
    const record = api.getState().space.records[actor].find((item) => item.id === id);
    if (!record) return;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">删除记录</span>${closeButton()}<h2 data-dialog-title>从我的记录中删除？</h2></div><div class="sp-dialog__body"><p class="sp-delete-title">${escape(record.title)}</p><p class="sp-exchange-boundary">只移除${escape(actorName(actor))}的这条本地记录。${record.kind === 'exchange' ? '对方的记录与已完成的交换不会被删除。' : '本场卡片仍按原来的展示设置保留；你可以回本场单独撤下。'}</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>保留</button><button type="button" class="button button--primary" data-confirm-delete>删除记录</button></div>`, 'sp-dialog--narrow');
    element.querySelector('[data-confirm-delete]').addEventListener('click', () => {
      api.update((state) => {
        if (state.actor !== actor) return;
        state.space.records[actor] = state.space.records[actor].filter((item) => item.id !== id);
      });
      close(); ceremony?.close(); api.render(); api.toast('这条本地记录已删除');
    });
  }

  function toggleVisibility() {
    const actor = api.getState().actor;
    const card = api.getState().space.cards[actor];
    if (!card) return;
    api.spatial?.focus('photo', card.id);
    const willDisplay = !card.isPublic;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">展示设置</span>${closeButton()}<h2 data-dialog-title>${willDisplay ? '展示这张卡？' : '撤下这张卡？'}</h2></div><div class="sp-dialog__body"><p class="sp-exchange-boundary">${willDisplay ? '另一位角色将看到这张卡，并可以申请交换。' : '对方将看不到这张卡，待回应申请会取消。已完成的交换保留。'}</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>取消</button><button type="button" class="button button--primary" data-confirm-visibility>${willDisplay ? '展示这张卡' : '从本场撤下'}</button></div>`, 'sp-dialog--narrow');
    element.querySelector('[data-confirm-visibility]').addEventListener('click', () => {
      api.update((state) => {
        if (state.actor !== actor || !state.space.cards[actor]) return;
        state.space.cards[actor].isPublic = willDisplay;
        if (!willDisplay) cancelPendingForCard(state.space, card.id);
      });
      close(); api.render(); api.toast(willDisplay ? '只有这张卡展示在本场了' : '已从本场撤下，自己的卡仍然保留');
    });
  }

  function reset() {
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">重置示例</span>${closeButton()}<h2 data-dialog-title>重新体验这一场？</h2></div><div class="sp-dialog__body"><p class="sp-exchange-boundary">清空两个角色的卡片、回应、交换与记录，恢复初始示例。Map 记录保留。</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>保留当前进度</button><button type="button" class="button button--primary" data-confirm-reset>重置本场</button></div>`, 'sp-dialog--narrow');
    element.querySelector('[data-confirm-reset]').addEventListener('click', () => {
      api.update((state) => { state.space = createSpaceState(); state.actor = 'a'; });
      close(); api.render(); api.toast('本场已重置，可以重新体验双方的视角');
    });
  }

  container.addEventListener('click', (event) => {
    const action = event.target.closest('[data-space-action]');
    if (!action || !container.contains(action)) return;
    switch (action.dataset.spaceAction) {
      case 'actor': switchActor(action.dataset.actor); break;
      case 'about': about(); break;
      case 'edit': openEditor(); break;
      case 'request': openRequest(action.dataset.actor); break;
      case 'visibility': toggleVisibility(); break;
      case 'view-exchange': openExchange(action.dataset.id); break;
      case 'open-record': openRecord(action.dataset.id); break;
      case 'delete-record': deleteRecord(action.dataset.id); break;
      case 'records': api.navigate('records', { section: 'space' }); break;
      case 'map': api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space', newSession: true }); break;
      case 'resume-map': api.navigate('explore', { resumeSessionId: api.getState().space.mapReturnId }); break;
      case 'demo': showDemo = true; api.render(); window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'make': showDemo = true; api.navigate('space', { showDemo: true, editCard: true }); break;
      case 'perspective': {
        const next = action.dataset.perspective;
        if (!['stage', 'crowd'].includes(next)) break;
        if (action.hasAttribute('data-home-card') && next === homePerspective) {
          openPhoto(action.dataset.id);
          break;
        }
        homePerspective = next;
        container.querySelector('[data-home-stack]')?.setAttribute('data-perspective', next);
        container.querySelectorAll('[data-space-action="perspective"]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.perspective === next));
        });
        break;
      }
      case 'home': showDemo = false; api.navigate('space', { home: true }); break;
      case 'space': showDemo = true; api.navigate('space', { eventId: SPACE_EVENT.id }); break;
      case 'live': api.navigate('live'); break;
      case 'reset': reset(); break;
      case 'react': {
        const actor = api.getState().actor;
        const target = action.dataset.actor;
        const kind = action.dataset.reaction;
        if (target === actor || !api.getState().space.cards[target]?.isPublic || !['here', 'like'].includes(kind)) break;
        api.update((state) => {
          const existing = state.space.reactions[actor][target] || { here: false, like: false };
          existing[kind] = !existing[kind];
          state.space.reactions[actor][target] = existing;
        });
        api.render();
        break;
      }
    }
  }, { signal: controller.signal });

  return {
    openExchange, openRecord, openRequest, openCardSaved, openEditor, openPhoto, publishScene,
    cleanup() {
      disposed = true;
      ceremony?.close();
      controller.abort();
      dialogs.forEach((element) => { if (element.open) element.close(); element.remove(); });
      dialogs.clear();
    },
  };
}

function cancelPendingForCard(space, id) {
  space.exchanges.forEach((exchange) => {
    if (exchange.status === 'pending' && (exchange.fromCardId === id || exchange.toCardId === id)) {
      exchange.status = 'cancelled';
      exchange.cancelReason = 'hidden';
      exchange.decidedAt = now();
    }
  });
}

function compressPhoto(file) {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请选择一张图片文件。'));
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('这张照片太大了，请选择 20MB 以内的图片。'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const photo = new Image();
    photo.onload = () => {
      try {
        const scale = Math.min(1, 1000 / Math.max(photo.naturalWidth, photo.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#f2eee7';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch { reject(new Error('这张照片暂时无法处理，请换一张 JPG 或 PNG。')); }
      finally { URL.revokeObjectURL(url); }
    };
    photo.onerror = () => { URL.revokeObjectURL(url); reject(new Error('浏览器打不开这张照片，请改选 JPG、PNG 或 WebP。')); };
    photo.src = url;
  });
}

export function mountSpace(container, api) {
  const state = api.getState();
  const payload = state.routePayload;
  if (payload?.home) showDemo = false;
  if (payload?.eventId === SPACE_EVENT.id || payload?.requestTarget || payload?.exchangeId || payload?.cardSaved || payload?.showDemo || payload?.editCard) showDemo = true;
  const actor = state.actor;
  const person = SPACE_ACTORS[actor];
  const peer = otherActor(actor);
  const own = state.space.cards[actor];
  const other = state.space.cards[peer];
  const reaction = state.space.reactions[actor][peer] || {};
  const peerReaction = state.space.reactions[peer][actor] || {};
  const common = own && other ? sharedMoment(own, other) : '';
  const lastExchange = getActiveExchange(state.space, actor, peer);
  const hasPending = lastExchange?.status === 'pending';
  const completed = getCompletedExchange(state.space, own, other);
  const relevantExchange = hasPending ? lastExchange : completed;
  const homeCards = visibleSpaceCards(state).map(({ card, saved }, index) => ({
    perspective: index === 0 ? 'stage' : 'crowd',
    name: index === 0 ? saved ? '我的卡' : '示例卡' : `${actorName(card.owner)}的卡`,
    card,
    saved,
  }));
  if (!homeCards.some(({ perspective }) => perspective === homePerspective)) homePerspective = 'stage';
  container.innerHTML = showDemo ? `<div class="space-page space-page--demo space-studio space-studio--demo">
    <section class="sp-local-scene" id="sp-local-scene" tabindex="-1" aria-labelledby="sp-demo-heading">
      <header class="sp-demo-header"><div class="sp-demo-header__title"><button type="button" class="icon-button" data-space-action="home" aria-label="返回同场首页">${api.icon('arrow-left')}</button><h1 id="sp-demo-heading">${escape(SPACE_EVENT.title)} <span>本地示例</span></h1></div><button type="button" class="button button--quiet" data-space-action="records">${api.icon('bookmark')}票根</button></header>
      ${actorSwitchMarkup(actor, api)}
      ${exchangeNoticeMarkup(state.space, actor, api)}
      <div class="sp-perspectives__grid">
        <section class="sp-perspective sp-perspective--mine" aria-label="我的现场卡"><div class="sp-person-heading"><span class="sp-avatar sp-avatar--${person.color}">${escape(person.initial)}</span><div><strong>${escape(person.name)} <span>· 我</span></strong></div>${own ? `<span class="sp-visibility-label${own.isPublic ? ' is-public' : ''}">${own.isPublic ? '已展示' : '私藏'}</span>` : ''}</div>
        ${own ? `${ticketMarkup(own)}<div class="sp-card-tools"><button type="button" class="sp-text-link" data-space-action="edit">编辑${api.icon('arrow-up-right')}</button><button type="button" class="sp-text-link" data-space-action="visibility">${own.isPublic ? '撤下展示' : '展示这张卡'}</button></div>${peerReaction.here || peerReaction.like ? `<div class="sp-reaction-receipt">${api.icon('heart')}<span>${escape(actorName(peer))}${peerReaction.here ? '回应了“我也在”' : '喜欢这张卡'}${peerReaction.here && peerReaction.like ? '，也点了喜欢' : ''}</span></div>` : ''}` : `<div class="sp-create-card"><div class="sp-create-card__frame">${api.icon('camera')}</div><div class="sp-create-card__copy"><h2>你的这一面</h2><button type="button" class="button button--primary" data-space-action="edit">${api.icon('plus')}做一张卡</button></div><span class="sp-create-card__note">仅自己可见</span></div>`}</section>
        <section class="sp-perspective sp-perspective--other" tabindex="-1" aria-label="另一位示例角色的现场卡"><div class="sp-person-heading"><span class="sp-avatar sp-avatar--${SPACE_ACTORS[peer].color}">${escape(SPACE_ACTORS[peer].initial)}</span><div><strong>${escape(actorName(peer))}</strong></div></div>
        ${other?.isPublic ? `${ticketMarkup(other)}${common ? `<div class="sp-shared-moment">${api.icon('heart')}<span>${escape(common)}</span></div>` : ''}<div class="sp-demo-card-actions"><div class="sp-reaction-row"><button type="button" class="sp-reaction-button${reaction.here ? ' is-active' : ''}" data-space-action="react" data-actor="${peer}" data-reaction="here" aria-pressed="${Boolean(reaction.here)}">${api.icon('users')}我也在</button><button type="button" class="sp-reaction-button${reaction.like ? ' is-active' : ''}" data-space-action="react" data-actor="${peer}" data-reaction="like" aria-pressed="${Boolean(reaction.like)}">${api.icon('heart')}${reaction.like ? '已喜欢' : '喜欢'}</button></div><button type="button" class="button button--primary sp-request-button" data-space-action="${relevantExchange ? 'view-exchange' : 'request'}" data-actor="${peer}"${relevantExchange ? ` data-id="${escape(relevantExchange.id)}"` : ''}>${api.icon(completed && !hasPending ? 'bookmark' : 'swap')}${hasPending ? '查看申请' : completed ? '打开双联记忆' : own ? '申请换卡' : '制卡并交换'}</button></div>` : `<div class="sp-hidden-card"><span class="sp-hidden-card__icon">${api.icon('image')}</span><h2>${other ? '这张卡还未展示' : `${escape(actorName(peer))}还没有卡片`}</h2><button type="button" class="button button--quiet" data-space-action="actor" data-actor="${peer}">切到${escape(actorName(peer))}${api.icon('arrow-right')}</button></div>`}</section>
      </div>
      <footer class="sp-demo-footer"><span>示例卡仅存本机</span><div>${state.space.mapReturnId ? `<button type="button" class="sp-text-link" data-space-action="resume-map">继续刚才的探索${api.icon('arrow-up-right')}</button>` : ''}<button type="button" class="sp-text-link" data-space-action="reset">${api.icon('rotate')}重置示例</button></div></footer>
    </section>
  </div>` : `<div class="space-page space-page--home space-studio space-studio--home" aria-labelledby="space-heading">
    <header class="space-studio__header"><h1 id="space-heading">同场<span>照片交换</span></h1><button type="button" class="space-studio__sample" data-space-action="about">本地示例${api.icon('info')}</button></header>
    <div class="space-scene-slot" aria-hidden="true"></div>
    <section class="space-studio__desk" aria-label="现场卡片">
      <div class="space-card-stack" data-home-stack data-perspective="${homePerspective}">
        ${homeCards.map(({ perspective, name, card, saved }) => `<button type="button" class="space-photo space-photo--${perspective}" data-space-action="perspective" data-perspective="${perspective}" data-id="${escape(card.id)}" data-home-card aria-pressed="${homePerspective === perspective}" aria-label="${escape(name)}，选中后再点一次查看卡片">
          <span class="space-photo__image"><img src="${escape(cardPhoto(card))}" alt="${card.photoKey === 'custom' ? `${escape(actorName(card.owner))}的现场照片` : escape(SPACE_PHOTOS[card.photoKey]?.description || 'AI 现场示例图')}"><span class="space-photo__source">${card.photoKey === 'custom' ? card.owner === actor ? '我的照片' : '现场照片' : 'AI 示例图'}</span></span>
          <span class="space-photo__caption"><strong>${escape(name)}</strong><span>${escape(momentName(card))}${api.icon('arrow-up-right')}</span></span>
          <span class="space-photo__stamp"><span>${escape(SPACE_EVENT.title)} · ${saved ? '本地示例' : '未保存的示例'}</span><span>${escape(SPACE_EVENT.date.slice(5).replace('.', ' / '))}</span></span>
        </button>`).join('')}
      </div>
      <div class="space-studio__controls"><div class="space-perspectives" role="group" aria-label="卡片视角">${homeCards.map(({ perspective, name }) => `<button type="button" data-space-action="perspective" data-perspective="${perspective}" aria-pressed="${homePerspective === perspective}"><span></span>${escape(name)}</button>`).join('')}</div>
        <div class="space-studio__actions"><button type="button" class="button button--primary" data-space-action="make">${api.icon('plus')}做一张卡</button><button type="button" class="button" data-space-action="live">${api.icon('users')}邀请朋友</button></div>
      </div>
    </section>
  </div>`;
  const lifecycle = makeLifecycle(container, api);
  lifecycle.publishScene();
  const requestedTarget = state.routePayload?.requestTarget;
  const requestedExchange = state.routePayload?.exchangeId;
  const previewCard = state.routePayload?.previewCardId;
  if (previewCard) {
    api.update(updated => { delete updated.routePayload.previewCardId; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openPhoto(previewCard); });
  } else if (state.routePayload?.editCard) {
    api.update((updated) => { delete updated.routePayload.editCard; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openEditor(); });
  } else if (requestedTarget) {
    api.update((updated) => { if (updated.routePayload?.requestTarget === requestedTarget) delete updated.routePayload.requestTarget; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openRequest(requestedTarget); });
  } else if (requestedExchange) {
    const reveal = state.routePayload?.reveal === true;
    api.update((updated) => { if (updated.routePayload?.exchangeId === requestedExchange) { delete updated.routePayload.exchangeId; delete updated.routePayload.reveal; } });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openExchange(requestedExchange, { reveal }); });
  } else if (state.routePayload?.cardSaved) {
    api.update((updated) => { delete updated.routePayload.cardSaved; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openCardSaved(); });
  }
  return () => {
    api.spatial?.publish({ cards: [] });
    if (api.getState().view !== 'space') showDemo = false;
    lifecycle.cleanup();
  };
}

export function mountSpaceRecords(container, api) {
  const state = api.getState();
  const actor = state.actor;
  const records = state.space.records[actor];
  container.innerHTML = `<section class="sp-records-page"><div class="sp-collection-tools"><h2>现场记忆</h2>${actorSwitchMarkup(actor, api, true)}<button type="button" class="button button--quiet" data-space-action="space">继续体验${api.icon('arrow-up-right')}</button></div>${records.length ? `<div class="sp-memory-grid">${records.map((record) => {
    const paired = record.kind === 'exchange';
    const cards = paired ? [record.fromCard, record.toCard] : [record.card];
    return `<article class="sp-memory${paired ? ' sp-memory--paired' : ''}"><button type="button" class="sp-memory__open" data-space-action="open-record" data-id="${escape(record.id)}" aria-label="打开${escape(record.title)}"><div class="sp-memory__visual${paired ? ' sp-memory__visual--pair' : ''}">${cards.map((card) => `<div><img src="${escape(cardPhoto(card))}" alt="${escape(actorName(card.owner))}的${card.photoKey === 'custom' ? '照片' : '示例视角'}" loading="lazy"><span>${escape(actorName(card.owner))}</span></div>`).join('')}${paired ? `<span class="sp-memory__join">${api.icon('swap')}</span>` : ''}</div><div class="sp-memory__body"><span class="sp-memory__type">${paired ? '交换后的双联记忆' : '我自己的现场卡'}</span><h3>${escape(record.title)}</h3><div><span>${escape(SPACE_EVENT.date)} · 示例现场</span>${api.icon('arrow-up-right')}</div></div></button><button type="button" class="icon-button sp-memory__delete" data-space-action="delete-record" data-id="${escape(record.id)}" aria-label="删除${escape(record.title)}">${api.icon('trash')}</button></article>`;
  }).join('')}</div>` : `<div class="sp-records-empty"><div class="sp-records-empty__art">${api.icon('image')}</div><h3>还没有记忆</h3><p>制作一张卡，或完成一次交换。</p><button type="button" class="button button--primary" data-space-action="space">体验换卡${api.icon('arrow-right')}</button></div>`}<p class="sp-local-note">记录仅存本机，清除浏览器数据后会丢失。</p></section>`;
  const lifecycle = makeLifecycle(container, api);
  const requested = state.routePayload?.spaceRecordId;
  if (requested) {
    api.update((updated) => { if (updated.routePayload?.spaceRecordId === requested) delete updated.routePayload.spaceRecordId; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openRecord(requested); });
  }
  return lifecycle.cleanup;
}

import { SPACE_EVENT, SPACE_ACTORS, SPACE_MOMENTS, SPACE_PHOTOS, seedSpaceCard } from './space-data.js';

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
  return `<article class="sp-ticket${small ? ' sp-ticket--small' : ''}${preview ? ' sp-ticket--preview' : ''}">
    <div class="sp-ticket__photo">
      <img src="${escape(cardPhoto(card))}" alt="${card.photoKey === 'custom' ? `${escape(author.name)}选择的现场照片` : `${escape(SPACE_PHOTOS[card.photoKey]?.description || '现场示例图片')}`}" ${preview ? '' : 'loading="lazy"'}>
      <div class="sp-ticket__image-top"><span>LIVE / ${escape(momentName(card))}</span><span>${card.photoKey === 'custom' ? '我的照片' : '场景示意'}</span></div>
      <div class="sp-ticket__image-bottom"><span>${card.photoKey === 'crowd' ? 'THE CROWD' : card.photoKey === 'custom' ? 'MY MOMENT' : 'THE STAGE'}</span><span>01 / 01</span></div>
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
    <div class="sp-demo-bar__description"><span class="sp-demo-dot"></span><div><strong>本地双角色情景</strong><span>切换视角，体验一次双方同意</span></div></div>
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

function exchangeNoticeMarkup(space, actor, api) {
  const relevant = space.exchanges.filter((exchange) => exchange.from === actor || exchange.to === actor);
  if (!relevant.length) return '';
  const latest = relevant[relevant.length - 1];
  const recipient = latest.to === actor;
  const other = recipient ? latest.from : latest.to;
  if (latest.status === 'pending') {
    return `<section class="sp-exchange-notice${recipient ? ' sp-exchange-notice--incoming' : ''}" aria-label="交换申请">
      <span class="sp-exchange-notice__icon">${api.icon('swap')}</span>
      <div class="sp-exchange-notice__text"><span class="eyebrow">${recipient ? '有一张卡，正等你接住' : '申请已递出'}</span><h2>${recipient ? `${escape(actorName(other))}想与你交换这一晚` : `等待${escape(actorName(other))}回应`}</h2><p>${recipient ? '先看看两张卡，再决定是否交换。' : '当前是本地情景。切到对方角色，体验接受或拒绝。'}</p></div>
      <div class="sp-exchange-notice__actions"><button type="button" class="button ${recipient ? 'button--primary' : 'button--quiet'}" data-space-action="view-exchange" data-id="${escape(latest.id)}">${recipient ? '查看申请' : '查看申请'}</button>${recipient ? '' : `<button type="button" class="button button--primary" data-space-action="actor" data-actor="${other}">切到${escape(actorName(other))}${api.icon('arrow-right')}</button>`}</div>
    </section>`;
  }
  if (latest.status === 'accepted') {
    return `<section class="sp-exchange-notice sp-exchange-notice--accepted" aria-label="交换已完成"><span class="sp-exchange-notice__icon">${api.icon('check')}</span><div class="sp-exchange-notice__text"><span class="eyebrow">BOTH SIDES OF THE NIGHT</span><h2>这一晚，多了一个视角。</h2><p>你与${escape(actorName(other))}已在各自角色下确认这次交换。</p></div><button type="button" class="button button--primary" data-space-action="view-exchange" data-id="${escape(latest.id)}">打开双联记忆${api.icon('arrow-up-right')}</button></section>`;
  }
  return `<div class="sp-quiet-notice">${api.icon('info')}<span>${latest.status === 'declined' ? '这次交换未被接受。你仍可以保存自己的这一晚。' : latest.cancelReason === 'hidden' ? '卡片已撤下，这条待回应申请已取消。' : '交换申请已取消，还没有交换任何卡片。'}</span><button type="button" data-space-action="view-exchange" data-id="${escape(latest.id)}">查看</button></div>`;
}

function makeLifecycle(container, api) {
  const controller = new AbortController();
  const dialogs = new Set();
  let disposed = false;
  function dialog(content, className = '') {
    const element = document.createElement('dialog');
    const titleId = `sp-dialog-${Math.random().toString(36).slice(2, 9)}`;
    element.className = `sp-dialog ${className}`;
    element.setAttribute('aria-labelledby', titleId);
    element.innerHTML = content.replace('data-dialog-title', `id="${titleId}"`);
    document.body.append(element);
    dialogs.add(element);
    const close = () => {
      if (element.open) element.close();
      dialogs.delete(element);
      element.remove();
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
  function about() {
    dialog(`<div class="sp-dialog__head"><span class="eyebrow">ABOUT THIS DEMO</span>${closeButton()}<h2 data-dialog-title>两种视角，一次完整体验。</h2></div><div class="sp-dialog__body sp-about"><p>Lin 与阿遥是同一浏览器里的两个示例角色。你可以分别制作卡片、发出申请，再切到对方决定是否接受。</p><div class="sp-about__point">${api.icon('users')}<div><strong>交互是真的，角色是示例</strong><p>状态会保存到当前浏览器；真实多人服务和跨设备交换尚未接入。</p></div></div><div class="sp-about__point">${api.icon('camera')}<div><strong>由你选择哪张照片出现</strong><p>上传的图片只在当前浏览器处理与保存。默认仅自己可见，勾选展示后才进入本场示例区域。</p></div></div><div class="sp-about__point">${api.icon('compass')}<div><strong>音乐是相遇的理由</strong><p>场次、艺人、歌曲与现场图片均用于情景演示，音频尚未接入。我们不将图片或“我也在”当作到场认证。</p></div></div></div><div class="sp-dialog__footer"><button type="button" class="button button--primary" data-dialog-close>开始体验${api.icon('arrow-right')}</button></div>`, 'sp-dialog--narrow');
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

  function openEditor(options = {}) {
    const actor = api.getState().actor;
    const currentCard = api.getState().space.cards[actor];
    const draft = currentCard ? snapshot(currentCard) : { ...seedSpaceCard(actor), isPublic: false, createdAt: now(), caption: actor === 'a' ? '灯光暗下去，还舍不得说再见。' : '你在看舞台，我想留下这一片人海。' };
    let processing = false;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">YOUR SIDE OF THE NIGHT</span>${closeButton()}<h2 data-dialog-title>${currentCard ? '这一刻，可以再改一改。' : '把你记得的，留在卡上。'}</h2><p>当前作者：${escape(actorName(actor))} · ${escape(SPACE_EVENT.title)} / 示例场次</p></div>
      <form class="sp-editor" novalidate>
        <div class="sp-editor__preview"><div data-card-preview>${ticketMarkup(draft, { preview: true })}</div><p class="sp-editor__preview-note">画面里的音乐与时刻，由你选择。</p></div>
        <div class="sp-editor__fields">
          <fieldset class="sp-field"><legend><span>01</span>选择你的视角</legend><div class="sp-photo-options">${Object.values(SPACE_PHOTOS).map((photo) => `<button type="button" data-photo="${photo.id}" class="sp-photo-choice${draft.photoKey === photo.id ? ' is-selected' : ''}" aria-pressed="${draft.photoKey === photo.id}"><img src="${escape(photo.url)}" alt="${escape(photo.description)}"><span>${escape(photo.name)}</span><i>${api.icon('check')}</i></button>`).join('')}<button type="button" data-photo="custom" class="sp-photo-choice sp-photo-choice--upload${draft.photoKey === 'custom' ? ' is-selected' : ''}" aria-pressed="${draft.photoKey === 'custom'}">${draft.photoDataUrl ? `<img src="${escape(draft.photoDataUrl)}" alt="我的照片"><span>我的照片</span>` : `${api.icon('camera')}<span>用自己的照片</span>`}<i>${api.icon('check')}</i></button></div><input type="file" name="photo" accept="image/*" class="sp-visually-hidden" aria-label="选择自己的照片"><p class="sp-field__hint" data-photo-hint>前两张为示例图片。自己的照片只保存在本机。</p></fieldset>
          <fieldset class="sp-field"><legend><span>02</span>记住哪一个时刻</legend><div class="sp-moment-options">${SPACE_MOMENTS.map((moment) => `<button type="button" data-moment="${moment.id}" class="sp-moment-choice${draft.momentId === moment.id ? ' is-selected' : ''}" aria-pressed="${draft.momentId === moment.id}">${escape(moment.name)}</button>`).join('')}</div><label class="sp-input-label" for="sp-song-select">这一刻的音乐</label><select id="sp-song-select" name="track"><option value="${SPACE_EVENT.trackId}"${draft.trackId ? ' selected' : ''}>《${escape(SPACE_EVENT.song)}》 · 示例曲目</option><option value=""${!draft.trackId ? ' selected' : ''}>只记录这个环节</option></select></fieldset>
          <div class="sp-field"><label class="sp-field__title" for="sp-caption-input"><span>03</span>留一句自己的话</label><textarea id="sp-caption-input" name="caption" rows="3" maxlength="80" placeholder="那一刻，你在想什么？">${escape(draft.caption)}</textarea><div class="sp-field__counter"><span>可以留空，让照片自己说话。</span><span data-caption-count>${draft.caption.length} / 80</span></div></div>
          <label class="sp-display-consent"><input type="checkbox" name="isPublic"${draft.isPublic ? ' checked' : ''}><span class="sp-display-consent__check">${api.icon('check')}</span><span><strong>把这张卡展示在本场</strong><small>让另一位示例角色看见。未勾选时仅自己保存。</small></span></label>
          <p class="sp-form-error" role="alert" data-editor-error hidden></p>
          <div class="sp-editor__submit"><button type="button" class="button button--quiet" data-dialog-close>取消</button><button type="submit" class="button button--primary">保存现场卡${api.icon('arrow-right')}</button></div>
        </div>
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
    form.elements.photo.addEventListener('change', async () => {
      const file = form.elements.photo.files[0];
      if (!file) return;
      processing = true;
      form.querySelector('[type="submit"]').disabled = true;
      error.hidden = true;
      element.querySelector('[data-photo-hint]').textContent = '正在将照片调整为适合卡片的大小…';
      try {
        const dataUrl = await compressPhoto(file);
        if (!element.isConnected || disposed) return;
        draft.photoKey = 'custom';
        draft.photoDataUrl = dataUrl;
        const custom = element.querySelector('[data-photo="custom"]');
        custom.innerHTML = `<img src="${escape(dataUrl)}" alt="我的照片"><span>更换我的照片</span><i>${api.icon('check')}</i>`;
        element.querySelector('[data-photo-hint]').textContent = '照片已在本机缩小处理，没有上传。点缩略图可以更换。';
        preview();
      } catch (cause) {
        if (!element.isConnected) return;
        error.textContent = cause.message || '这张照片暂时无法打开，请换一张 JPG 或 PNG。';
        error.hidden = false;
        element.querySelector('[data-photo-hint]').textContent = '也可以先选用一张示例照片。';
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
          api.render();
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
    if (!theirs?.isPublic) { api.toast('这张卡暂未展示，先看看自己的现场吧'); return; }
    const previous = [...state.space.exchanges].reverse().find((exchange) => {
      const samePair = (exchange.from === actor && exchange.to === target) || (exchange.from === target && exchange.to === actor);
      return samePair && exchange.status === 'pending';
    });
    if (previous) { openExchange(previous.id); return; }
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">TRADE A PERSPECTIVE</span>${closeButton()}<h2 data-dialog-title>用你的舞台，换我的人海。</h2><p>你将用自己这张卡，向${escape(actorName(target))}发起交换。</p></div><div class="sp-dialog__body"><div class="sp-common-reason">${api.icon('heart')}<span>${escape(sharedMoment(own, theirs))}</span></div><div class="sp-pair sp-pair--request"><div><div class="sp-pair__label">${escape(actorName(actor))}送出的这一张</div>${ticketMarkup(own, { small: true })}</div><span class="sp-pair__join" aria-hidden="true">${api.icon('swap')}</span><div><div class="sp-pair__label">${escape(actorName(target))}的这一张</div>${ticketMarkup(theirs, { small: true })}</div></div><p class="sp-exchange-boundary">对方接受后才交换这两张卡。不会自动加好友，也不会公开你的其他记录。</p>${own.isPublic ? '' : '<p class="sp-private-note">你的卡仍不在本场展示。本次申请只把这张卡交给对方查看。</p>'}</div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>再看看</button><button type="button" class="button button--primary" data-send-request>发送交换申请${api.icon('arrow-right')}</button></div>`, 'sp-dialog--exchange');
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

  function openExchange(id) {
    const state = api.getState();
    const actor = state.actor;
    const exchange = state.space.exchanges.find((item) => item.id === id);
    if (!exchange || (exchange.from !== actor && exchange.to !== actor)) return;
    const accepted = exchange.status === 'accepted';
    const pending = exchange.status === 'pending';
    const receiving = exchange.to === actor;
    const counterpart = receiving ? exchange.from : exchange.to;
    const existing = state.space.records[actor].some((record) => record.id === `exchange:${exchange.id}`);
    const titles = { accepted: '你拍到的，补上了我的这一晚。', pending: receiving ? '这张卡，想与你交换。' : '一张卡，等待另一个人接住。', declined: '这次交换，停在这里。', cancelled: '申请已取消，卡片没有交换。' };
    const statusText = { accepted: '双方已确认 · 本地情景', pending: receiving ? '待你回应' : `等待${actorName(counterpart)}回应`, declined: '对方未接受', cancelled: '已取消' };
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">${accepted ? 'ONE NIGHT. TWO PERSPECTIVES.' : 'THE EXCHANGE'}</span>${closeButton()}<h2 data-dialog-title>${titles[exchange.status]}</h2><p class="sp-exchange-status${accepted ? ' is-accepted' : ''}">${api.icon(accepted ? 'check' : pending ? 'swap' : 'info')}<span>${escape(statusText[exchange.status])}</span></p></div><div class="sp-dialog__body"><div class="sp-common-reason">${api.icon('heart')}<span>${escape(sharedMoment(exchange.fromCard, exchange.toCard))}</span></div><div class="sp-pair${accepted ? ' sp-pair--accepted' : ' sp-pair--request'}"><div><div class="sp-pair__label">${escape(actorName(exchange.from))}的视角</div>${ticketMarkup(exchange.fromCard, { small: true })}</div><span class="sp-pair__join" aria-hidden="true">${api.icon(accepted ? 'check' : 'swap')}</span><div><div class="sp-pair__label">${escape(actorName(exchange.to))}的视角</div>${ticketMarkup(exchange.toCard, { small: true })}</div></div><p class="sp-exchange-boundary">${accepted ? '你们交换了指定的两张卡。保存到各自记录，不代表获得再次公开对方照片的许可。' : pending ? '这里只交换眼前这两张卡。接受与拒绝都由接收方的角色决定。' : '没有生成双联记忆。双方都保留自己的卡片。'}</p>${pending && !receiving ? '<p class="sp-private-note">这是本地情景演示：切换到接收方角色，再体验对方的决定。</p>' : ''}</div><div class="sp-dialog__footer sp-dialog__footer--wrap">${accepted ? `<button type="button" class="button button--quiet" data-return-map>${api.icon('compass')}沿音乐再出发</button><button type="button" class="button button--primary" data-save-exchange${existing ? ' disabled' : ''}>${api.icon(existing ? 'check' : 'bookmark')}${existing ? '已在我的记录' : '保存这场记忆'}</button>` : pending && receiving ? `<button type="button" class="button button--quiet" data-decide="declined">这次先不了</button><button type="button" class="button button--primary" data-decide="accepted">同意交换${api.icon('swap')}</button>` : pending ? `<button type="button" class="button button--quiet" data-decide="cancelled">取消申请</button><button type="button" class="button button--primary" data-switch-recipient>切到${escape(actorName(counterpart))}${api.icon('arrow-right')}</button>` : '<button type="button" class="button button--primary" data-dialog-close>回到本场</button>'}</div>`, `sp-dialog--exchange${accepted ? ' sp-dialog--result' : ''}`);
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
        changed = true;
      });
      close();
      api.render();
      if (changed) api.toast(decision === 'accepted' ? '你已同意交换，这一晚多了一个视角' : decision === 'declined' ? '已婉拒，卡片没有交换' : '已取消申请');
      if (changed && decision === 'accepted') {
        // The new page owns its listeners; carry the result through the route.
        api.navigate('space', { eventId: SPACE_EVENT.id, exchangeId: id });
      }
    }));
    element.querySelector('[data-switch-recipient]')?.addEventListener('click', () => { close(); switchActor(counterpart); });
    element.querySelector('[data-save-exchange]')?.addEventListener('click', (event) => {
      api.update((updated) => {
        if (updated.actor !== actor) return;
        const actual = updated.space.exchanges.find((item) => item.id === id);
        if (!actual || actual.status !== 'accepted' || (actual.from !== actor && actual.to !== actor)) return;
        upsertRecord(updated.space, actor, { id: `exchange:${id}`, kind: 'exchange', exchangeId: id, title: `${SPACE_EVENT.title} · 与${actorName(counterpart)}的双联记忆`, fromCard: snapshot(actual.fromCard), toCard: snapshot(actual.toCard) });
      });
      event.currentTarget.disabled = true;
      event.currentTarget.innerHTML = `${api.icon('check')}已在我的记录`;
      api.toast('已保存到当前角色的现场记忆');
    });
    element.querySelector('[data-return-map]')?.addEventListener('click', () => { close(); api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space' }); });
  }

  function openRecord(id) {
    const actor = api.getState().actor;
    const record = api.getState().space.records[actor].find((item) => item.id === id);
    if (!record) return;
    const paired = record.kind === 'exchange';
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">MY LIVE MEMORY</span>${closeButton()}<h2 data-dialog-title>${paired ? '一张你的，一张我的。' : '属于你的这一晚。'}</h2><p>${escape(actorName(actor))}的本地记录 · ${escape(SPACE_EVENT.title)}</p></div><div class="sp-dialog__body">${paired ? `<div class="sp-pair sp-pair--accepted"><div><div class="sp-pair__label">${escape(actorName(record.fromCard.owner))}的视角</div>${ticketMarkup(record.fromCard, { small: true })}</div><span class="sp-pair__join" aria-hidden="true">${api.icon('check')}</span><div><div class="sp-pair__label">${escape(actorName(record.toCard.owner))}的视角</div>${ticketMarkup(record.toCard, { small: true })}</div></div><p class="sp-exchange-boundary">来自一次已接受的交换；保存不代表可以再次公开对方照片。</p>` : `<div class="sp-record-single">${ticketMarkup(record.card)}</div>`}</div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-delete-record>${api.icon('trash')}删除这条记录</button><button type="button" class="button button--primary" data-return-map>沿音乐再出发${api.icon('arrow-up-right')}</button></div>`, paired ? 'sp-dialog--exchange' : 'sp-dialog--narrow');
    element.querySelector('[data-return-map]').addEventListener('click', () => { close(); api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space' }); });
    element.querySelector('[data-delete-record]').addEventListener('click', () => { close(); deleteRecord(id); });
  }

  function deleteRecord(id) {
    const actor = api.getState().actor;
    const record = api.getState().space.records[actor].find((item) => item.id === id);
    if (!record) return;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">YOUR RECORD</span>${closeButton()}<h2 data-dialog-title>从我的记录中删除？</h2></div><div class="sp-dialog__body"><p class="sp-delete-title">${escape(record.title)}</p><p class="sp-exchange-boundary">只移除${escape(actorName(actor))}的这条本地记录。${record.kind === 'exchange' ? '对方的记录与已完成的交换不会被删除。' : '本场卡片仍按原来的展示设置保留；你可以回本场单独撤下。'}</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>保留</button><button type="button" class="button button--primary" data-confirm-delete>删除记录</button></div>`, 'sp-dialog--narrow');
    element.querySelector('[data-confirm-delete]').addEventListener('click', () => {
      api.update((state) => {
        if (state.actor !== actor) return;
        state.space.records[actor] = state.space.records[actor].filter((item) => item.id !== id);
      });
      close(); api.render(); api.toast('这条本地记录已删除');
    });
  }

  function toggleVisibility() {
    const actor = api.getState().actor;
    const card = api.getState().space.cards[actor];
    if (!card) return;
    const willDisplay = !card.isPublic;
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">YOUR CHOICE</span>${closeButton()}<h2 data-dialog-title>${willDisplay ? '让本场看见这一张？' : '把这一张从本场撤下？'}</h2></div><div class="sp-dialog__body"><p class="sp-exchange-boundary">${willDisplay ? '另一位示例角色将能看到这张卡，并向你申请交换。其他照片与私人记录不会一起展示。' : '另一位示例角色将不再在本场看到这张卡。涉及它的待回应申请也会取消，已完成的交换不受影响。'}</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>取消</button><button type="button" class="button button--primary" data-confirm-visibility>${willDisplay ? '展示这张卡' : '从本场撤下'}</button></div>`, 'sp-dialog--narrow');
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
    const { element, close } = dialog(`<div class="sp-dialog__head"><span class="eyebrow">START THIS SCENE AGAIN</span>${closeButton()}<h2 data-dialog-title>重新体验这一场？</h2></div><div class="sp-dialog__body"><p class="sp-exchange-boundary">会清除两个示例角色在 Space 中的卡片、回应、交换与现场记录，恢复初始人海示例卡。Map 的探索记录保留。</p></div><div class="sp-dialog__footer"><button type="button" class="button button--quiet" data-dialog-close>保留当前进度</button><button type="button" class="button button--primary" data-confirm-reset>重置本场</button></div>`, 'sp-dialog--narrow');
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
      case 'map': api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space' }); break;
      case 'space': api.navigate('space', { eventId: SPACE_EVENT.id }); break;
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
    openExchange, openRecord, openRequest,
    cleanup() {
      disposed = true;
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
  container.innerHTML = `<div class="space-page">
    ${actorSwitchMarkup(actor, api)}
    <section class="sp-hero" aria-labelledby="space-heading">
      <img class="sp-hero__image" src="${escape(SPACE_PHOTOS.stage.url)}" alt="回声现场的舞台场景示意">
      <div class="sp-hero__scrim"></div>
      <div class="sp-hero__content"><div class="sp-hero__eyebrow"><span>MUSIC SPACE</span><span class="sp-scene-tag">示例场次</span></div><h1 id="space-heading">同一首歌，<br>另一种视角。</h1><p>把你拍到的一刻，递给也记得的人。</p><button type="button" class="button button--primary sp-hero__cta" data-space-action="edit">${api.icon(own ? 'image' : 'plus')}${own ? '编辑我的现场卡' : '制作我的现场卡'}</button></div>
      <div class="sp-hero__event"><span class="sp-hero__event-number">01</span><div><span>${escape(SPACE_EVENT.date)} · ${escape(SPACE_EVENT.city)}</span><strong>${escape(SPACE_EVENT.title)} <em>/ ${escape(SPACE_EVENT.subtitle)}</em></strong></div><span class="sp-hero__image-note">场景示意</span></div>
    </section>
    <div class="sp-music-strip"><span class="sp-music-strip__art" aria-hidden="true"><i></i></span><div><span class="eyebrow">这一晚的共同旋律</span><strong>《${escape(SPACE_EVENT.song)}》</strong><small>${SPACE_EVENT.artists.join(' × ')} · 示例曲目，音频暂未接入</small></div><button type="button" class="sp-text-link" data-space-action="map">回到音乐地图${api.icon('arrow-up-right')}</button></div>
    ${exchangeNoticeMarkup(state.space, actor, api)}
    <section class="sp-perspectives" aria-labelledby="sp-perspectives-heading"><div class="sp-section-heading"><div><span class="eyebrow">SAME NIGHT, DIFFERENT EYES</span><h2 id="sp-perspectives-heading">这一晚，你看见了什么？</h2></div><span class="sp-section-heading__hint">先看见一张卡，再认识一个人</span></div>
      <div class="sp-perspectives__grid">
        <section class="sp-perspective sp-perspective--mine" aria-label="我的现场卡"><div class="sp-person-heading"><span class="sp-avatar sp-avatar--${person.color}">${escape(person.initial)}</span><div><strong>${escape(person.name)} <span>· 当前视角</span></strong><small>属于你的这一张</small></div>${own ? `<span class="sp-visibility-label${own.isPublic ? ' is-public' : ''}">${own.isPublic ? '本场展示中' : '仅自己可见'}</span>` : ''}</div>
        ${own ? `${ticketMarkup(own)}<div class="sp-card-tools"><button type="button" class="sp-text-link" data-space-action="edit">编辑现场卡${api.icon('arrow-up-right')}</button><button type="button" class="sp-text-link" data-space-action="visibility">${own.isPublic ? '从本场撤下' : '展示在本场'}</button></div>${peerReaction.here || peerReaction.like ? `<div class="sp-reaction-receipt">${api.icon('heart')}<span>${escape(actorName(peer))}${peerReaction.here ? '回应了“我也在”' : '喜欢你的这一张'}${peerReaction.here && peerReaction.like ? '，也留下了喜欢' : ''}</span></div>` : '<p class="sp-mine-caption">保存是给自己，展示和交换由你决定。</p>'}` : `<div class="sp-create-card"><span class="sp-create-card__index">YOUR / 01</span><div class="sp-create-card__frame">${api.icon('camera')}<span>这里，留给你的那一刻。</span></div><div class="sp-create-card__copy"><h3>你的舞台，<br>也许正是别人缺少的视角。</h3><p>选一张图，一首歌，留一句话。<br>先收下自己的这一晚。</p><button type="button" class="button button--primary" data-space-action="edit">制作我的现场卡${api.icon('plus')}</button></div><span class="sp-create-card__note">默认私藏 · 展示由你选择</span></div>`}</section>
        <section class="sp-perspective sp-perspective--other" aria-label="另一位示例角色的现场卡"><div class="sp-person-heading"><span class="sp-avatar sp-avatar--${SPACE_ACTORS[peer].color}">${escape(SPACE_ACTORS[peer].initial)}</span><div><strong>${escape(actorName(peer))}<span> · 示例角色</span></strong><small>同一场，另一双眼睛</small></div><span class="sp-perspective-number">02</span></div>
        ${other?.isPublic ? `${ticketMarkup(other)}${common ? `<div class="sp-shared-moment">${api.icon('heart')}<span>${escape(common)}</span></div>` : `<p class="sp-other-caption">${escape(actorName(peer))}把「${escape(momentName(other))}」留在了卡上。</p>`}<div class="sp-reaction-row"><button type="button" class="sp-reaction-button${reaction.here ? ' is-active' : ''}" data-space-action="react" data-actor="${peer}" data-reaction="here" aria-pressed="${Boolean(reaction.here)}">${api.icon('users')}${reaction.here ? '已回应 · 我也在' : '我也在'}</button><button type="button" class="sp-reaction-button${reaction.like ? ' is-active' : ''}" data-space-action="react" data-actor="${peer}" data-reaction="like" aria-pressed="${Boolean(reaction.like)}">${api.icon('heart')}${reaction.like ? '已喜欢' : '我也喜欢'}</button></div><button type="button" class="button button--primary sp-request-button" data-space-action="${hasPending ? 'view-exchange' : 'request'}" data-actor="${peer}"${hasPending ? ` data-id="${escape(lastExchange.id)}"` : ''}>${api.icon('swap')}${hasPending ? '查看这次交换申请' : own ? '用我的卡，交换这一晚' : '制作卡片，交换这一晚'}</button><p class="sp-interaction-note">回应不代表交换。对方同意后，两张卡才会相遇。</p>` : `<div class="sp-hidden-card"><span class="sp-hidden-card__icon">${api.icon('image')}</span><h3>${other ? '这一张，暂时只属于对方。' : `${escape(actorName(peer))}还没有做卡。`}</h3><p>你可以先保存自己的现场。<br>也可以切换角色，体验另一面的选择。</p><button type="button" class="button button--quiet" data-space-action="actor" data-actor="${peer}">切到${escape(actorName(peer))}${api.icon('arrow-right')}</button></div>`}</section>
      </div>
    </section>
    <section class="sp-records-link"><div><span class="eyebrow">AFTER THE ENCORE</span><h2>声音会停，这一晚可以留下。</h2><p>自己的卡与交换后的记忆，收在各自的记录里。</p></div><button type="button" class="button button--quiet" data-space-action="records">我的现场记忆${api.icon('arrow-right')}</button></section>
    <footer class="sp-footer"><p>本地情景演示 · 场次与角色为示例 · 不代表真实到场</p><button type="button" class="sp-text-link" data-space-action="reset">${api.icon('rotate')}重置本场</button></footer>
  </div>`;
  const lifecycle = makeLifecycle(container, api);
  const requestedTarget = state.routePayload?.requestTarget;
  const requestedExchange = state.routePayload?.exchangeId;
  if (requestedTarget) {
    api.update((updated) => { if (updated.routePayload?.requestTarget === requestedTarget) delete updated.routePayload.requestTarget; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openRequest(requestedTarget); });
  } else if (requestedExchange) {
    api.update((updated) => { if (updated.routePayload?.exchangeId === requestedExchange) delete updated.routePayload.exchangeId; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openExchange(requestedExchange); });
  }
  return lifecycle.cleanup;
}

export function mountSpaceRecords(container, api) {
  const state = api.getState();
  const actor = state.actor;
  const records = state.space.records[actor];
  container.innerHTML = `<section class="sp-records-page"><div class="sp-section-heading"><div><span class="eyebrow">LIVE MEMORIES</span><h2>我的现场记忆</h2><p>${escape(actorName(actor))}的卡片与共同视角，保存在当前浏览器。</p></div><button type="button" class="button button--quiet" data-space-action="space">回到本场${api.icon('arrow-up-right')}</button></div>${actorSwitchMarkup(actor, api, true)}${records.length ? `<div class="sp-memory-grid">${records.map((record) => {
    const paired = record.kind === 'exchange';
    const cards = paired ? [record.fromCard, record.toCard] : [record.card];
    return `<article class="sp-memory"><button type="button" class="sp-memory__open" data-space-action="open-record" data-id="${escape(record.id)}" aria-label="打开${escape(record.title)}"><div class="sp-memory__visual${paired ? ' sp-memory__visual--pair' : ''}">${cards.map((card) => `<div><img src="${escape(cardPhoto(card))}" alt="${escape(actorName(card.owner))}的${card.photoKey === 'custom' ? '照片' : '示例视角'}" loading="lazy"><span>${escape(actorName(card.owner))}</span></div>`).join('')}${paired ? `<span class="sp-memory__join">${api.icon('swap')}</span>` : ''}</div><div class="sp-memory__body"><span class="sp-memory__type">${paired ? '交换后的双联记忆' : '我自己的现场卡'}</span><h3>${escape(record.title)}</h3><div><span>${escape(SPACE_EVENT.date)} · 示例现场</span>${api.icon('arrow-up-right')}</div></div></button><button type="button" class="icon-button sp-memory__delete" data-space-action="delete-record" data-id="${escape(record.id)}" aria-label="删除${escape(record.title)}">${api.icon('trash')}</button></article>`;
  }).join('')}</div>` : `<div class="sp-records-empty"><div class="sp-records-empty__art">${api.icon('image')}<span>YOUR NEXT MEMORY</span></div><h3>下一张，留给你自己的这一晚。</h3><p>做一张现场卡，或在交换后保存双联记忆。<br>探索过的艺人不会自动成为到场记录。</p><button type="button" class="button button--primary" data-space-action="space">去本场看看${api.icon('arrow-right')}</button></div>`}<p class="sp-local-note">仅保存在当前浏览器；清除浏览器数据会移除这些记录。两个示例角色的记录分别保存。</p></section>`;
  const lifecycle = makeLifecycle(container, api);
  const requested = state.routePayload?.spaceRecordId;
  if (requested) {
    api.update((updated) => { if (updated.routePayload?.spaceRecordId === requested) delete updated.routePayload.spaceRecordId; });
    queueMicrotask(() => { if (container.isConnected) lifecycle.openRecord(requested); });
  }
  return lifecycle.cleanup;
}

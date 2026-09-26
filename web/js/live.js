import { SPACE_EVENT, SPACE_MOMENTS, SPACE_PHOTOS } from './space-data.js';
import { downloadTicket } from './ticket-export.js';

const SESSION_KEY = 'music-map-live:v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const momentName = id => SPACE_MOMENTS.find(item => item.id === id)?.name || '现场瞬间';
const photo = card => SPACE_PHOTOS[card?.photoKey]?.url || SPACE_PHOTOS.stage.url;
const dateLabel = value => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

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
  let joinCode = new URLSearchParams(location.search).get('room') || '';
  let entryName = '';
  let draft = null;
  let version = 0;

  container.innerHTML = `<div class="live-page"><div id="live-surface" aria-live="off"></div><dialog class="live-dialog" aria-labelledby="live-dialog-title"><div id="live-dialog-content"></div></dialog></div>`;
  const surface = container.querySelector('#live-surface');
  const dialog = container.querySelector('dialog');
  const modal = container.querySelector('#live-dialog-content');
  const icon = api.icon;

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
    room = next;
    session.roomId = next.room.id;
    persist();
    errorMessage = '';
    lastSync = new Date();
    if (!rooms.some(item => item.id === next.room.id)) rooms.push(next.room);
    render();
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
    const buttons = [...container.querySelectorAll('button[type="submit"], [data-live-action="decide"], [data-live-action="send"]')];
    buttons.forEach(button => { button.disabled = true; });
    try { await work(); }
    catch (error) { showError(error); }
    finally {
      busy = false;
      if (!signal.aborted) buttons.forEach(button => { button.disabled = false; });
    }
  }

  function miniCard(card, label = '') {
    return `<article class="live-card"><div class="live-card-photo"><img src="${photo(card)}" alt="${escape(SPACE_PHOTOS[card.photoKey]?.description || '现场示例图片')}" loading="lazy"><span>${escape(label || momentName(card.momentId))}</span></div><div class="live-card-content"><span class="live-card-author">${escape(card.ownerName)} <small>${escape(momentName(card.momentId))}</small></span><p>${escape(card.caption || '这一刻，想和你一起记住。')}</p>${card.trackId ? `<span class="live-card-track">♪ ${SPACE_EVENT.song}</span>` : ''}</div></article>`;
  }

  function banner() {
    return `${storageFailed ? '<p class="live-notice" role="alert">浏览器未能保存身份。请保持当前页面打开；关闭后可能无法找回这个身份和记录。</p>' : ''}${errorMessage && !room ? `<p class="live-notice" role="alert">${escape(errorMessage)}</p>` : ''}`;
  }

  function render() {
    if (signal.aborted) return;
    surface.innerHTML = room ? roomView() : entryView();
    updateSync();
  }

  function entryView() {
    const sampleA = { ownerName: '你的舞台', photoKey: 'stage', momentId: 'encore', caption: '喜欢的那首歌，刚好和你一起听。', trackId: 'co-0' };
    const sampleB = { ownerName: '朋友的人海', photoKey: 'crowd', momentId: 'chorus', caption: '从你的视角，重新看一次现场。', trackId: 'co-0' };
    return `<header class="live-entry-head"><button class="text-button" data-live-action="demo">${icon('arrow-left')} 返回情景演示</button><span class="eyebrow">MUSIC SPACE / INVITE ONLY</span></header>${banner()}<div class="live-entry-grid"><section class="live-entry-copy"><span class="live-kicker">真实双人 · 邀请入场</span><h1>我们在<br><em>同一场。</em></h1><p class="live-lede">把自己的现场，交给另一个视角。<br>发一张卡，等一个「我也愿意」。</p><div class="live-gate"><div class="live-gate-heading"><b>${session ? `你好，${escape(session.user.name)}` : '先留下你想被叫的名字'}</b><span>${checking ? '正在连接…' : healthy ? '同场服务已连接' : '共享服务未连接'}</span></div><form data-live-form="entry">${session ? '' : '<label class="live-field">现场昵称<input name="name" value="' + escape(entryName) + '" placeholder="例如：小满" autocomplete="nickname" maxlength="20" required></label>'}<label class="live-field">朋友的邀请码 <span>已有房间时填写</span><input name="code" value="${escape(joinCode)}" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位数字" autocomplete="off"></label><div class="live-gate-actions"><button class="button button--primary" type="submit" name="intent" value="join" ${!healthy ? 'disabled' : ''}>加入同场 ${icon('arrow-right')}</button><button class="button button--secondary" type="submit" name="intent" value="create" formnovalidate ${!healthy ? 'disabled' : ''}>创建房间 ${icon('plus')}</button></div></form>${!healthy && !checking ? `<div class="live-unavailable"><p>当前仍可完整体验本地换卡。真实双人需要打开已启用共享服务的链接。</p><button class="text-button" data-live-action="reconnect">重试连接</button></div>` : ''}<p class="live-gate-note">不用手机号。身份保存在这个浏览器，清除网站数据后无法找回。卡片默认不展示。</p></div>${session && rooms.length ? `<div class="live-recent"><span class="eyebrow">最近的房间</span>${rooms.map(item => `<button data-live-action="resume" data-room-id="${escape(item.id)}"><span>${escape(item.title)}</span><small>${escape(item.code)}</small>${icon('arrow-right')}</button>`).join('')}</div>` : ''}</section><aside class="live-entry-art" aria-label="两张现场卡构成双联记忆的示意"><span class="live-art-type" aria-hidden="true">SAME<br>SHOW.<br><i>TWO<br>STORIES.</i></span><div class="live-entry-pair">${miniCard(sampleA)}${miniCard(sampleB)}</div><p>YOUR VIEW. THEIR VIEW. ONE MEMORY.</p><small>示例卡片 · 图片由 AI 生成</small></aside></div>`;
  }

  function roomView() {
    const own = room.ownCard;
    const cards = room.cards.filter(card => card.ownerId !== room.me.id);
    const incoming = room.exchanges.filter(ex => ex.to === room.me.id && ex.status === 'pending');
    const outgoing = room.exchanges.filter(ex => ex.from === room.me.id && ex.status === 'pending');
    const resolved = room.exchanges.filter(ex => ex.status !== 'pending').slice(-6).reverse();
    return `${banner()}<header class="live-room-head"><div><span class="eyebrow">MUSIC SPACE / ${escape(room.room.code)}</span><h1>此刻，<em>有同频的人。</em></h1><p>${escape(room.room.title)} <span>· ${escape(room.me.name)} · ${room.room.memberCount} 人入场</span></p></div><div class="live-room-tools"><button class="button button--primary" data-live-action="invite">邀请朋友 ${icon('arrow-up-right')}</button><button class="text-button" data-live-action="lobby">其他房间</button></div></header><div class="live-room-ribbon"><span>回声现场 / 夏末特别场 <b>示例场次</b></span><span data-sync role="status"></span><button class="text-button" data-live-action="refresh">${icon('rotate')} 刷新</button></div>${incoming.length ? `<section class="live-incoming" aria-label="收到的交换申请"><div class="live-section-title"><span>↗</span><h2>有人想交换你的视角。</h2><small>${incoming.length} 条待回应</small></div>${incoming.map(ex => `<div class="live-request-row"><div class="live-initial">${escape(ex.fromCard.ownerName.slice(0, 1))}</div><p><b>${escape(ex.fromCard.ownerName)}</b><span>想用「${escape(momentName(ex.fromCard.momentId))}」，交换你的「${escape(momentName(ex.toCard.momentId))}」。</span></p><button class="button button--primary" data-live-action="review" data-id="${escape(ex.id)}">看看这两张卡 ${icon('arrow-right')}</button></div>`).join('')}</section>` : ''}<div class="live-room-columns"><section class="live-own-section"><div class="live-section-title"><span>01</span><h2>我的现场</h2></div>${own ? `${miniCard(own)}<div class="live-own-meta"><span class="live-visibility ${own.isPublic ? 'is-public' : ''}">${own.isPublic ? '本房间成员可见' : '仅自己可见'}</span><span>第 ${own.revision} 版</span></div><div class="live-own-actions"><button class="button button--secondary" data-live-action="edit">编辑现场卡</button><button class="text-button" data-live-action="visibility">${own.isPublic ? '从本场撤下' : '展示到本场'} ${icon('arrow-up-right')}</button></div>` : `<div class="live-empty-card"><div class="live-optical" aria-hidden="true"></div><span class="eyebrow">MY SIDE OF THE STORY</span><h3>你的这一面，<br>还没有被看见。</h3><p>选一个瞬间，写下一句话。<br>做好后，再决定分享给谁。</p><button class="button button--primary" data-live-action="edit">制作现场卡 ${icon('plus')}</button></div>`}<p class="live-section-note">现场示例照片可自由选用。制作和交换发生在真实独立会话中；场次、歌曲与照片为演示内容。</p></section><section class="live-wall-section"><div class="live-section-title"><span>02</span><h2>同场的另一面</h2><small>${cards.length} 张视角</small></div>${cards.length ? `<div class="live-wall">${cards.map(card => `<div class="live-wall-item">${miniCard(card)}<button class="button button--secondary" data-live-action="request" data-id="${escape(card.id)}">用我的卡交换 ${icon('swap')}</button></div>`).join('')}</div>` : `<div class="live-empty-wall"><span class="live-wall-word" aria-hidden="true">HELLO,<br>NEIGHBOUR.</span><h3>等一个朋友，也留下这一刻。</h3><p>把邀请码发给朋友，对方制卡并选择展示后，<br>你就能看到现场的另一面。</p><button class="text-button" data-live-action="invite">分享邀请码 ${icon('arrow-up-right')}</button></div>`}</section></div>${outgoing.length ? `<section class="live-pending"><div class="live-section-title"><span>→</span><h2>已送出的心意</h2></div>${outgoing.map(ex => `<div class="live-pending-row"><span>等待 <b>${escape(ex.toCard.ownerName)}</b> 回应</span><small>两张卡已固定为发出时的版本</small><button class="text-button" data-live-action="review" data-id="${escape(ex.id)}">查看 / 取消</button></div>`).join('')}</section>` : ''}<section class="live-memories"><div class="live-section-title"><span>03</span><h2>我们的共同记忆</h2><small>${room.records.length} 张双联票</small></div>${room.records.length ? `<div class="live-memory-list">${room.records.map(record => `<button class="live-memory" data-live-action="memory" data-id="${escape(record.id)}"><div class="live-memory-pictures"><img src="${photo(record.fromCard)}" alt=""><img src="${photo(record.toCard)}" alt=""></div><div><span class="eyebrow">A MOMENT, EXCHANGED.</span><h3>${escape(record.fromCard.ownerName)} <i>×</i> ${escape(record.toCard.ownerName)}</h3><p>${escape(dateLabel(record.createdAt))} · 双方已同意</p></div>${icon('arrow-up-right')}</button>`).join('')}</div>` : '<p class="live-empty-memory">当双方都说「愿意」，两张卡就会在这里成为一张双联记忆。</p>'}</section>${resolved.length ? `<details class="live-history"><summary>最近交换动态 <span>${resolved.length}</span></summary>${resolved.map(ex => `<div><span>${escape(ex.from === room.me.id ? ex.toCard.ownerName : ex.fromCard.ownerName)}</span><b>${({ accepted: '交换已完成', declined: '这次没有交换', cancelled: '申请已取消' })[ex.status]}</b><small>${escape(dateLabel(ex.decidedAt || ex.createdAt))}</small></div>`).join('')}</details>` : ''}<footer class="live-room-bottom"><p>只交换现场卡。接受后留下的是当时的两张卡，之后编辑不会改写共同记忆。</p><button class="text-button" data-live-action="leave">离开这个房间</button></footer>`;
  }

  function openModal(name, title, content, className = '') {
    currentModal = { name };
    dialog.className = `live-dialog ${className}`;
    modal.innerHTML = `<div class="live-modal-top"><span class="eyebrow">MUSIC SPACE / ${room ? escape(room.room.code) : 'TOGETHER'}</span><button class="icon-button" data-live-action="close" aria-label="关闭">${icon('x')}</button></div><h2 id="live-dialog-title">${title}</h2>${content}<p class="live-notice" data-modal-error role="alert" hidden></p>`;
    if (!dialog.open) dialog.showModal();
  }

  function closeModal() { dialog.close(); currentModal = null; }

  function openEditor(target = null) {
    requestTarget = target;
    draft = room.ownCard || { photoKey: 'stage', momentId: 'encore', trackId: 'co-0', caption: '', isPublic: false };
    openModal('editor', '把这一刻，做成一张卡。', `<form data-live-form="card"><fieldset class="live-photo-choices"><legend>选你的视角 <small>AI 生成的现场示例图片</small></legend>${Object.values(SPACE_PHOTOS).map(item => `<label><input type="radio" name="photoKey" value="${item.id}" ${item.id === draft.photoKey ? 'checked' : ''}><span><img src="${item.url}" alt="${item.description}"><b>${item.name}</b>${icon('check')}</span></label>`).join('')}</fieldset><fieldset class="live-moment-choices"><legend>你想留住的瞬间</legend>${SPACE_MOMENTS.map(item => `<label><input type="radio" name="momentId" value="${item.id}" ${item.id === draft.momentId ? 'checked' : ''}><span>${item.name}</span></label>`).join('')}</fieldset><label class="live-field">给这一刻的一句话 <span data-caption-count>${draft.caption.length} / 80</span><textarea name="caption" maxlength="80" rows="3" placeholder="例如：散场后，耳边还是刚才那句合唱。">${escape(draft.caption)}</textarea></label><label class="live-check"><input type="checkbox" name="track" ${draft.trackId ? 'checked' : ''}><span>带上这首歌 <b>♪ ${SPACE_EVENT.song}</b></span></label><label class="live-check"><input type="checkbox" name="isPublic" ${draft.isPublic ? 'checked' : ''}><span>展示到这个房间<small>房间成员会看到卡片，可以向你申请交换。</small></span></label><button class="button button--primary live-wide" type="submit">${target ? '保存，继续交换' : '保存现场卡'} ${icon('arrow-right')}</button><p class="live-form-note">未勾选展示时，只在你主动申请交换后，对方才能看到这张卡。</p></form>`);
  }

  function openRequest(cardId) {
    const target = room.cards.find(card => card.id === cardId);
    if (!target) { api.toast('这张卡已被撤下，看看其他视角吧'); return; }
    if (!room.ownCard) { openEditor(cardId); return; }
    requestTarget = { id: cardId, fromRevision: room.ownCard.revision, toRevision: target.revision };
    openModal('request', `和 ${escape(target.ownerName)}，交换视角。`, `<p class="live-modal-intro">发出的，就是眼前这两张卡。对方接受后，双方都会留下同一张双联记忆。</p><div class="live-compare">${miniCard(room.ownCard, '我送出的')}${miniCard(target, '想换回的')}</div><div class="live-consent-note">${icon('swap')}<span>发送即同意把自己的这张卡分享给 ${escape(target.ownerName)}。对方可以接受，也可以拒绝。</span></div><button class="button button--primary live-wide" data-live-action="send">发送交换申请 ${icon('arrow-right')}</button>`, 'live-dialog--wide');
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
    const saved = room.records.find(record => record.exchangeId === (item.exchangeId || item.id));
    const sharedTrack = a.trackId && a.trackId === b.trackId;
    const sharedMoment = a.momentId === b.momentId;
    openModal('ticket', '同一场，两种视角。', `<div class="live-ticket"><div class="live-ticket-mast"><span>MUSIC<br>BRINGS US<br>TOGETHER.</span><b>MM<br>× MS</b></div><div class="live-ticket-title"><span>回声现场 / 夏末特别场</span><strong>${escape(a.ownerName)} <i>×</i> ${escape(b.ownerName)}</strong></div><div class="live-ticket-pair">${miniCard(a)}${miniCard(b)}</div><div class="live-ticket-strip"><span>${sharedTrack ? `♪ ${SPACE_EVENT.song}` : sharedMoment ? momentName(a.momentId) : '把现场，交换着记住。'}</span><b>EXCHANGED</b></div><div class="live-ticket-foot"><span>${escape(dateLabel(item.createdAt))}<br>双方已同意 · ${saved ? '已保存到本房间' : '交换记录'}</span><span class="live-ticket-bars" aria-hidden="true"></span><span>YOUR VIEW.<br>THEIR VIEW.<br>ONE MEMORY.</span></div></div><div class="live-ticket-actions"><button class="button button--primary" data-live-action="download" data-id="${escape(item.exchangeId || item.id)}">保存票根图片 ${icon('arrow-up-right')}</button><button class="button button--secondary" data-live-action="map">沿这首歌，继续探索 ${icon('compass')}</button></div><p class="live-form-note">现场与歌曲为示例内容。票根只包含这次双方同意交换的卡片。</p>${saved ? `<button class="text-button live-delete-record" data-live-action="delete-record" data-id="${escape(saved.id)}">从我的记忆中删除</button>` : ''}`, 'live-dialog--ticket');
  }

  function openInvite() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', room.room.code);
    url.hash = '/live';
    openModal('invite', '叫上一起听歌的人。', `<p class="live-modal-intro">朋友打开这个链接，用自己的昵称入场。每个人各自决定要交换哪一张卡。</p><div class="live-invite-code"><span>房间邀请码</span><strong>${escape(room.room.code)}</strong><small>${escape(room.room.title)} · 最多 ${room.room.capacity} 人</small></div><label class="live-field">邀请链接<input readonly value="${escape(url.href)}" data-invite-url></label><button class="button button--primary live-wide" data-live-action="copy">复制邀请链接 ${icon('arrow-up-right')}</button><p class="live-form-note">邀请码只发给你想邀请的人。${['localhost', '127.0.0.1'].includes(location.hostname) ? '当前是本机地址；朋友的设备需要使用部署链接，或同一网络下的服务地址。' : ''}</p>`);
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
          if (session.roomId && !joinCode && rooms.some(item => item.id === session.roomId)) setState(await request(`/rooms/${session.roomId}`));
        } catch (error) {
          if (error.status === 401) { session = null; persist(); errorMessage = '原身份已失效，请重新留下昵称入场。'; }
          else throw error;
        }
      }
    } catch (error) { healthy = false; showError(error); }
    finally { checking = false; render(); }
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
        const next = await request(intent === 'create' ? '/rooms' : '/rooms/join', { method: 'POST', body: intent === 'create' ? { title: `${session.user.name}的回声现场` } : { code: joinCode } });
        joinCode = '';
        history.replaceState(null, '', `${location.pathname}#/live`);
        version += 1;
        setState(next);
        api.toast(intent === 'create' ? '房间已准备好，邀请朋友来交换视角' : '入场成功，留下你的现场吧');
        if (intent === 'create') openInvite();
      });
    }
    if (form.dataset.liveForm === 'card') {
      const target = typeof requestTarget === 'string' ? requestTarget : null;
      const body = { photoKey: data.get('photoKey'), momentId: data.get('momentId'), caption: String(data.get('caption')).trim(), trackId: data.has('track') ? 'co-0' : '', isPublic: data.has('isPublic') };
      act(async () => {
        version += 1;
        setState(await request(`/rooms/${room.room.id}/card`, { method: 'PUT', body }));
        closeModal();
        api.toast('现场卡已保存');
        if (target) openRequest(target);
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
  }, { signal });

  container.addEventListener('click', event => {
    const button = event.target.closest('[data-live-action]');
    if (!button) return;
    const action = button.dataset.liveAction;
    const id = button.dataset.id;
    if (action === 'close') closeModal();
    if (action === 'demo') api.navigate('space');
    if (action === 'reconnect') connect();
    if (action === 'refresh') refresh(true);
    if (action === 'invite') openInvite();
    if (action === 'edit') openEditor();
    if (action === 'request') openRequest(id);
    if (action === 'review') openExchange(id);
    if (action === 'memory') {
      const record = room.records.find(item => item.id === id);
      if (record) openTicket(record);
    }
    if (action === 'map') { closeModal(); api.navigate('explore', { artistId: SPACE_EVENT.artistId, from: 'space' }); }
    if (action === 'lobby') {
      version += 1;
      session.roomId = null;
      persist();
      room = null;
      errorMessage = '';
      render();
    }
    if (action === 'resume') act(async () => { version += 1; setState(await request(`/rooms/${button.dataset.roomId}`)); });
    if (action === 'visibility') {
      if (room.ownCard.isPublic) openModal('withdraw', '把现场卡收回自己这里？', '<p class="live-modal-intro">其他房间成员将不再看到这张卡。涉及你的待回应申请会取消；已经交换的共同记忆仍保留。</p><button class="button button--primary live-wide" data-live-action="confirm-withdraw">确认撤下</button>');
      else act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/card/visibility`, { method: 'PATCH', body: { isPublic: true } })); api.toast('你的视角已展示到本房间'); });
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
    if (action === 'copy') act(async () => {
      const input = modal.querySelector('[data-invite-url]');
      try { await navigator.clipboard.writeText(input.value); api.toast('邀请链接已复制'); }
      catch { input.focus(); input.select(); api.toast('已选中邀请链接，可以手动复制'); }
    });
    if (action === 'download') act(async () => {
      const item = room.exchanges.find(ex => ex.id === id) || room.records.find(record => record.exchangeId === id);
      if (item) await downloadTicket([item.fromCard, item.toCard], { title: SPACE_EVENT.title, subtitle: SPACE_EVENT.subtitle, song: SPACE_EVENT.song, createdAt: item.createdAt, id: item.exchangeId || item.id });
      api.toast('票根图片已生成，请查看浏览器下载');
    });
    if (action === 'delete-record') openModal('delete', '从我的记忆中删除这张票？', `<p class="live-modal-intro">只删除你保存的记录，不会改动对方的记录。已经完成的交换动态仍会保留。</p><button class="button button--primary live-wide" data-live-action="confirm-delete" data-id="${escape(id)}">确认删除我的记录</button>`);
    if (action === 'confirm-delete') act(async () => { version += 1; setState(await request(`/rooms/${room.room.id}/records/${id}`, { method: 'DELETE' })); closeModal(); api.toast('已从我的记忆中删除'); });
    if (action === 'leave') openModal('leave', '暂时离开这个房间？', '<p class="live-modal-intro">你的现场卡会撤下，待回应申请会取消。共同记忆仍保留，使用同一浏览器和邀请码再次入场后可以查看。</p><button class="button button--primary live-wide" data-live-action="confirm-leave">确认离开</button>');
    if (action === 'confirm-leave') act(async () => {
      version += 1;
      const roomId = room.room.id;
      await request(`/rooms/${roomId}/membership`, { method: 'DELETE' });
      closeModal(); room = null; rooms = rooms.filter(item => item.id !== roomId); session.roomId = null; persist(); render(); api.toast('已离开房间');
    });
  }, { signal });

  dialog.addEventListener('click', event => { if (event.target === dialog && !busy) closeModal(); }, { signal });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }, { signal });
  connect();
  interval = setInterval(refresh, 4000);
  return () => { life.abort(); clearInterval(interval); dialog.close(); };
}

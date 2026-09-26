import '../css/base.css';
import '../css/map.css';
import '../css/space.css';
import '../css/live.css';
import '../css/themes.css';
import '../css/theme-sakura.css';
import '../css/theme-zine.css';
import { mountThemes } from './themes.js';
import { icon } from './icons.js';
import { createMapState, mountMap, mountMapRecords } from './map.js';
import { createSpaceState, mountSpace, mountSpaceRecords } from './space.js';
import { mountLive } from './live.js';

const STORAGE_KEY = 'music-map-space:v1';
const views = ['explore', 'space', 'records', 'live'];
const actors = { a: 'Lin', b: '阿遥' };
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let saveFailed = false;
let recordsFilter = 'all';

function initialState() {
  return { version: 1, view: 'space', actor: 'a', map: createMapState(), space: createSpaceState(), routePayload: null };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && saved.map && saved.space) return { ...saved, routePayload: null };
  } catch {
    // A new browser or cleared local data starts a fresh demo.
  }
  return initialState();
}

const state = load();
const initialView = location.hash.slice(2);
if (views.includes(initialView)) state.view = initialView;
const invitedRoom = new URLSearchParams(location.search).get('room');
if (invitedRoom && /^\d{6}$/.test(invitedRoom) && (!initialView || initialView === 'live')) state.view = 'live';

function toast(message) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 3200);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  updateChrome();
}

function update(mutator) {
  mutator(state);
  persist();
}

function navigate(view, payload = null) {
  if (!views.includes(view)) return;
  if (view === 'space' && payload?.intent === 'create-room') view = 'live';
  state.view = view;
  state.routePayload = payload;
  const nextUrl = new URL(location.href);
  nextUrl.hash = `/${view}`;
  if (view !== 'live') nextUrl.searchParams.delete('room');
  if (location.href !== nextUrl.href) history.pushState(null, '', nextUrl);
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('#main-content').focus({ preventScroll: true });
}

const api = { getState: () => state, update, render, navigate, toast, icon };

function updateChrome() {
  document.querySelectorAll('[data-current-actor]').forEach(el => { el.textContent = actors[state.actor]; });
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === (state.view === 'live' ? 'space' : state.view);
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const storageNote = document.querySelector('#storage-warning');
  if (storageNote) storageNote.hidden = !saveFailed;
  const sectionNames = { explore: '发现新的声音', space: '遇见同场的人', records: '留住这次相遇', live: '邀请同场，交换视角' };
  document.title = `${sectionNames[state.view]} · Music Map × Space`;
  document.querySelectorAll('[data-view-label]').forEach(el => { el.textContent = sectionNames[state.view]; });
  const identity = document.querySelector('.identity');
  if (identity) identity.hidden = state.view !== 'records';
  const currentMap = state.map.sessions.find(item => item.id === state.map.activeId);
  const modeNames = { explore: currentMap?.dataset === 'real' ? '真实合作精选' : '情景示例图谱', space: '同场记忆', records: '当前浏览器', live: '邀请入场 · 自主分享' };
  document.querySelectorAll('[data-mode-label]').forEach(el => { el.textContent = modeNames[state.view]; });
  document.querySelectorAll('[data-footer-status]').forEach(el => { el.textContent = state.view === 'live' ? '房间成员可见，双方同意才交换' : '本地记录保存在当前浏览器'; });
}

function navItems() {
  return [
    ['explore', 'compass', '探索', 'MAP'],
    ['space', 'users', '同场', 'SPACE'],
    ['records', 'bookmark', '我的记录', 'COLLECTION'],
  ].map(([view, name, title, subtitle]) => `
    <button class="nav-item" data-nav="${view}">
      ${icon(name)}<span>${title}<small>${subtitle}</small></span>
    </button>`).join('');
}

function shell() {
  root.innerHTML = `
    <header class="app-masthead">
      <button class="brand" data-nav="explore" aria-label="Music Map 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-wordmark">music<span class="brand-light">map</span><small>声音相连，同场相遇。</small></span>
      </button>
      <nav class="primary-nav" aria-label="主要导航">${navItems()}</nav>
      <button class="theme-launcher" id="theme-launcher" aria-haspopup="dialog" aria-controls="theme-dialog"><span class="theme-launcher__swatch" aria-hidden="true"></span><span><b>外观</b><small data-theme-name>声浪现场</small></span>${icon('swap')}</button>
    </header>
    <div class="app-body">
      <header class="topbar">
        <div class="topbar-breadcrumb"><span data-view-label>发现新的声音</span><span class="topbar-divider"></span><span class="demo-tag" data-mode-label>示例音乐图谱</span></div>
        <div class="topbar-actions">
          <button class="demo-help" id="demo-help" aria-label="演示说明" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}<span>演示说明</span></button>
          <span class="identity"><span class="identity-demo">示例</span><span data-current-actor>${actors[state.actor]}</span></span>
        </div>
      </header>
      <div id="storage-warning" class="storage-warning" role="alert" hidden>这次修改尚未保存到浏览器，当前页面内容仍保留。可减少上传图片后重试。<button id="retry-save">重试保存</button></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
      <footer class="app-footer"><span>从一个声音，到另一种相遇。</span><span>MUSIC MAP × SPACE <i aria-hidden="true">/</i> <span data-footer-status>本地记录保存在当前浏览器</span></span></footer>
    </div>
    <nav class="mobile-nav" aria-label="手机导航">${navItems()}</nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><span class="eyebrow">MUSIC, WITH PEOPLE.</span><button class="icon-button" id="close-about" aria-label="关闭演示说明">${icon('x')}</button></div>
      <h2 id="about-title">顺着声音，<br><em>找到彼此。</em></h2>
      <p>顺着真实合作发现音乐。散场以后，用另一个人的视角，补完整你记住的那一刻。</p>
      <div class="about-path" aria-label="选择体验入口">
        <button data-nav="explore"><span>01</span><div><b>发现一首合作</b><small>顺着有来源的合作作品探索，到官方页面听歌。</small></div>${icon('arrow-right')}</button>
        <button data-nav="space"><span>02</span><div><b>先体验一次换卡</b><small>用示例角色走过制卡、同意与留下记忆。</small></div>${icon('arrow-right')}</button>
        <button data-nav="live"><span>03</span><div><b>邀请朋友同场</b><small>命名你们的场次，用自己的照片留下不同视角。</small></div>${icon('arrow-right')}</button>
      </div>
      <div class="about-facts"><p><b>先体验，再邀请</b><span>本地情景演示可切换 Lin 与阿遥，体验申请、接受与拒绝。也可以通过邀请码进入真实双人房间，由各自设备操作；联网体验需要可用的共享服务。</span></p><p><b>两种体验，清楚区分</b><span>本地记录保存在当前浏览器；联网卡默认私藏，主动展示后才供房间成员查看。真实合作精选提供官方外链；本地情景的虚构艺人、场次与生成配图用于说明体验，不代表真实到场。</span></p></div>
      <button class="button button--primary" id="start-experience">继续体验 ${icon('arrow-right')}</button>
    </dialog>`;
  root.addEventListener('click', event => {
    const item = event.target.closest('[data-nav]');
    if (item) {
      document.querySelector('#about-dialog').close();
      navigate(item.dataset.nav);
    }
    const filter = event.target.closest('[data-records-filter]');
    if (filter) {
      recordsFilter = filter.dataset.recordsFilter;
      render();
      document.querySelector(`[data-records-filter="${recordsFilter}"]`)?.focus({ preventScroll: true });
    }
  });
  const dialog = document.querySelector('#about-dialog');
  document.querySelector('#demo-help').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-about').addEventListener('click', () => dialog.close());
  document.querySelector('#start-experience').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.querySelector('#retry-save').addEventListener('click', () => {
    persist();
    toast(saveFailed ? '仍未保存，可减少上传图片后重试' : '已保存到当前浏览器');
  });
}

function render() {
  cleanup?.();
  cleanup = null;
  const container = document.querySelector('#main-content');
  container.replaceChildren();
  document.body.dataset.view = state.view;
  if (state.view === 'explore') cleanup = mountMap(container, api);
  if (state.view === 'space') cleanup = mountSpace(container, api);
  if (state.view === 'live') cleanup = mountLive(container, api);
  if (state.view === 'records') {
    if (state.routePayload?.spaceRecordId) recordsFilter = 'space';
    const cardCount = state.space.records[state.actor].length;
    const routeCount = state.map.sessions.length;
    const filters = [['all', '全部', cardCount + routeCount], ['space', '现场记忆', cardCount], ['map', '音乐探索', routeCount]];
    container.innerHTML = `<div class="records-page"><header class="records-heading"><div><span class="eyebrow">KEPT, NOT FORGOTTEN.</span><h1>把喜欢的，<br><em>好好留下。</em></h1><p class="muted">音乐把你带向远处，记忆把这一晚留下。</p></div><div class="records-tally" aria-label="本机记录数量"><span><b>${String(cardCount).padStart(2, '0')}</b> 张现场记忆</span><i aria-hidden="true">/</i><span><b>${String(routeCount).padStart(2, '0')}</b> 段音乐探索</span></div></header><section class="records-live-link" aria-label="联网房间记忆"><span class="records-live-symbol" aria-hidden="true">${icon('users')}</span><div><h2>和朋友交换的，留在同场房间。</h2><p>用创建房间时的浏览器回去，继续查看和下载共同记忆。</p></div><button class="button button--quiet" data-nav="live">回到房间 ${icon('arrow-up-right')}</button></section><div class="records-filters" role="group" aria-label="筛选本机记录">${filters.map(([value, label, count]) => `<button data-records-filter="${value}" aria-pressed="${recordsFilter === value}">${label}<span>${count}</span></button>`).join('')}</div><p class="records-scope">${icon('bookmark')} 以下为 ${actors[state.actor]} 的本地情景记忆与本机探索记录</p><div id="space-records" ${recordsFilter === 'map' ? 'hidden' : ''}></div><div id="map-records" ${recordsFilter === 'space' ? 'hidden' : ''}></div></div>`;
    const spaceCleanup = mountSpaceRecords(container.querySelector('#space-records'), api);
    const mapCleanup = mountMapRecords(container.querySelector('#map-records'), api);
    cleanup = () => { spaceCleanup?.(); mapCleanup?.(); };
  }
  updateChrome();
}

window.addEventListener('popstate', () => {
  if (location.hash === '#main-content') return;
  const view = location.hash.slice(2);
  state.view = views.includes(view) ? view : 'explore';
  state.routePayload = null;
  persist();
  render();
});

shell();
mountThemes();
render();

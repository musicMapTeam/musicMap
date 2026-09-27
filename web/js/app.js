import '../css/base.css';
import '../css/map.css';
import '../css/space.css';
import '../css/live.css';
import '../css/themes.css';
import '../css/theme-sakura.css';
import 'overlayscrollbars/overlayscrollbars.css';
import '../css/compact.css';
import '../css/app-studio.css';
import '../css/space-studio.css';
import '../css/map-studio.css';
import '../css/map-credits.css';
import '../css/spatial-world.css';
import '../css/open-catalogue.css';
import '../css/library.css';
import '../css/product-finish.css';
import '../css/live-compose.css';
import '../css/memory-export.css';
import '../css/courtyard-ui.css';
import { OverlayScrollbars } from 'overlayscrollbars';
import { mountThemes } from './themes.js';
import { icon } from './icons.js';
import { createMapState, mountMap, mountMapRecords } from './map.js';
import { createSpaceState, mountSpace, mountSpaceRecords } from './space.js';
import { mountHome } from './home.js';
import { mountLiveLibrary } from './live-library.js';
import { mountLive } from './live.js';
import { mountMotion } from './motion.js';
import { mountOpenCatalogue, mountSavedMusic } from './open-catalogue.js';

const STORAGE_KEY = 'music-map-space:v1';
const views = ['explore', 'space', 'records', 'live'];
const actors = { a: 'Lin', b: '阿遥' };
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let saveFailed = false;
let recordsFilter = 'live';
let themeController;
let motion;
let spatialContext = {};
let spatialActionVersion = 0;

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
state.view = views.includes(initialView) ? initialView : 'space';
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
  if (view === 'records' && !payload) recordsFilter = 'live';
  spatialActionVersion++;
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

const api = { getState: () => state, update, render, navigate, toast, icon,
  spatial: {
    publish(content) {
      spatialContext = content;
      document.body.dataset.spatialSection = content.mode || state.view;
      themeController?.setContent(content.cards || [], content.mode);
    },
    focus(kind, id) { return themeController?.focus(kind, id) || Promise.resolve(true); },
    restore() { themeController?.restore(); },
  },
};

async function onSpatialAction(action) {
  const version = ++spatialActionVersion;
  if (action.type === 'navigate') { navigate(action.view, action.view === 'space' ? { home: true } : null); return; }
  if (action.type === 'editor') {
    if (!spatialContext.onEdit) { navigate('live', { intent: 'make-card' }); return; }
    const arrived = await themeController.focus('editor');
    if (arrived && version === spatialActionVersion) spatialContext.onEdit?.();
  }
  if (action.type === 'photo' && spatialContext.onPhoto) {
    const arrived = await themeController.focus('photo', action.id);
    if (arrived && version === spatialActionVersion) spatialContext.onPhoto?.(action.id);
  }
}

function updateChrome() {
  document.querySelectorAll('[data-current-actor]').forEach(el => { el.textContent = actors[state.actor]; });
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === state.view;
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
    ['space', 'heart', '小院'],
    ['explore', 'compass', '唱片店'],
    ['live', 'users', '照片墙'],
    ['records', 'bookmark', '我的收藏'],
  ].map(([view, name, title]) => `
    <button class="nav-item" data-nav="${view}">
      ${icon(name)}<span>${title}</span>
    </button>`).join('');
}

function shell() {
  root.innerHTML = `
    <header class="app-masthead app-studio-shell">
      <button class="brand" data-nav="space" aria-label="Music Map 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-wordmark">樱下放映<small>MUSIC MAP × SPACE</small></span>
      </button>
      <nav class="primary-nav" aria-label="主要导航">${navItems()}</nav>
      <div class="masthead-tools"><button class="courtyard-join" data-join-room>${icon('users')}输入邀请码</button><button class="demo-help icon-button" id="demo-help" aria-label="关于 Music Map" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}</button></div>
    </header>
    <div id="sakura-world" class="spatial-world" hidden></div>
    <div class="app-body">
      <div id="storage-warning" class="storage-warning" role="alert" hidden>这次修改尚未保存到浏览器，当前页面内容仍保留。可减少上传图片后重试。<button id="retry-save">重试保存</button></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <nav class="mobile-nav" aria-label="手机导航">${navItems()}</nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><h2 id="about-title">樱下放映</h2><button class="icon-button" id="close-about" aria-label="关闭关于">${icon('x')}</button></div>
      <p class="about-intro">同一刻，另一面。</p><div class="about-facts"><p><b>现场卡</b><span>默认私藏，双方同意后交换。</span></p><p><b>唱片店</b><span>合作作品与制作署名，暂不提供音频。</span></p><p><b>示例</b><span>Lin、阿遥及预置照片均为虚构。</span></p><p><b>身份</b><span>仅在当前浏览器保留，清除网站数据后无法找回。</span></p></div>
      <button class="button button--primary" id="start-experience">知道了</button>
    </dialog>`;
  root.addEventListener('click', event => {
    if (event.target.closest('[data-join-room]')) navigate('live', { intent: 'join-room' });
    const item = event.target.closest('[data-nav]');
    if (item) {
      document.querySelector('#about-dialog').close();
      navigate(item.dataset.nav, item.dataset.nav === 'space' ? { home: true } : null);
    }
    const filter = event.target.closest('[data-records-filter]');
    if (filter) {
      recordsFilter = filter.dataset.recordsFilter;
      state.routePayload = null;
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
  spatialActionVersion++;
  cleanup?.();
  cleanup = null;
  spatialContext = {};
  themeController?.setContent([]);
  const container = document.querySelector('#main-content');
  container.replaceChildren();
  document.body.dataset.view = state.view;
  document.body.dataset.spatialSection = state.view === 'space' ? 'home' : state.view;
  themeController?.setView(state.view);
  if (state.view === 'explore') cleanup = mountMap(container, api);
  if (state.view === 'space') {
    const payload = state.routePayload;
    const isDemo = payload && !payload.home && (payload.showDemo || payload.editCard || payload.requestTarget || payload.exchangeId || payload.cardSaved || payload.previewCardId || payload.eventId);
    cleanup = isDemo ? mountSpace(container, api) : mountHome(container, api);
  }
  if (state.view === 'live') cleanup = mountLive(container, api);
  if (state.view === 'records') {
    if (state.routePayload?.spaceRecordId) recordsFilter = 'demo';
    else if (state.routePayload?.libraryItemId || state.routePayload?.section === 'live') recordsFilter = 'live';
    else if (state.routePayload?.section === 'music') recordsFilter = 'music';
    const filters = [['live', '我的现场'], ['music', '音乐收藏'], ['map', '探索路线'], ['demo', '示例']];
    container.innerHTML = `<div class="records-page collection-page"><header class="records-heading"><h1>我的收藏</h1><button class="button button--secondary" data-collection-make>${icon('plus')}记录现场</button></header><div class="records-filters" role="group" aria-label="记录分类">${filters.map(([value, label]) => `<button data-records-filter="${value}" aria-pressed="${recordsFilter === value}">${label}</button>`).join('')}</div><div id="collection-content"></div></div>`;
    const content = container.querySelector('#collection-content');
    if (recordsFilter === 'live') cleanup = mountLiveLibrary(content, api);
    if (recordsFilter === 'music') cleanup = mountSavedMusic(content, api);
    if (recordsFilter === 'map') cleanup = mountMapRecords(content, api);
    if (recordsFilter === 'demo') cleanup = mountSpaceRecords(content, api);
    container.querySelector('[data-collection-make]').onclick = () => navigate('live', { intent: 'make-card' });
  }
  updateChrome();
  container.scrollTop = 0;
  motion?.enter(container, state.view);
}

window.addEventListener('popstate', () => {
  if (location.hash === '#main-content') return;
  const view = location.hash.slice(2);
  const invited = /^\d{6}$/.test(new URLSearchParams(location.search).get('room') || '');
  state.view = views.includes(view) ? view : invited ? 'live' : 'space';
  state.routePayload = null;
  persist();
  render();
});

shell();
themeController = mountThemes({ onAction: onSpatialAction, view: state.view,
  onShot(key, id, travelling) { document.body.dataset.spatialShot = key; document.body.toggleAttribute('data-spatial-travelling', travelling); },
});
motion = mountMotion();
mountOpenCatalogue(api);
render();
// Keep window scrolling and focus navigation native; only replace its chrome.
OverlayScrollbars(document.body, {
  overflow: { x: 'hidden', y: 'scroll' },
  scrollbars: { theme: 'os-theme-music', autoHide: 'scroll', autoHideDelay: 650, dragScroll: true, clickScroll: false },
});

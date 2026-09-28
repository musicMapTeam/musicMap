import '../css/base.css';
import '../css/map.css';
import '../css/themes.css';
import '../css/theme-sakura.css';
import 'overlayscrollbars/overlayscrollbars.css';
import '../css/compact.css';
import '../css/app-studio.css';
import '../css/map-studio.css';
import '../css/map-credits.css';
import '../css/spatial-world.css';
import '../css/open-catalogue.css';
import '../css/product-finish.css';
import '../css/courtyard-ui.css';
import '../css/spatial-objects.css';
import '../css/map-spatial.css';
import '../css/scene-layout.css';
import '../css/map-round.css';
import '../css/home-map.css';
import '../css/night-shell.css';
import { OverlayScrollbars } from 'overlayscrollbars';
import { mountThemes } from './themes.js';
import { icon } from './icons.js';
import { createMapState, mountMap, mountMapRecords } from './map.js';
import { mountHome } from './home.js';
import { mountMotion } from './motion.js';
import { mountOpenCatalogue, mountSavedMusic } from './open-catalogue.js';

// The key and version stay from 0.15 so a returning visitor keeps every exploration.
const STORAGE_KEY = 'music-map-space:v1';
const views = ['home', 'explore', 'records'];
// Routes retired in 0.16: old links, saved views and an older scene build all land on the courtyard.
const LEGACY = new Map([['space', 'home'], ['live', 'home']]);
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let saveFailed = false;
let recordsFilter = 'map';
let themeController;
let motion;
let spatialContext = {};
let droppedLegacy = false;

function initialState() {
  return { version: 1, view: 'home', map: createMapState(), routePayload: null };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && saved.map) {
      // 0.15 saves also carry the Space demo (cards with photos) and its actor; neither is read any more.
      const { space, actor, ...kept } = saved;
      droppedLegacy = space !== undefined || actor !== undefined;
      return { ...kept, routePayload: null };
    }
  } catch {
    // A new browser or cleared local data starts fresh.
  }
  return initialState();
}

function routeView(name) {
  const view = LEGACY.get(name) || name;
  return views.includes(view) ? view : 'home';
}

/** Old invitation links carried ?room=; retired route names become their new home. */
function tidyUrl() {
  const url = new URL(location.href);
  if (url.searchParams.has('room')) url.searchParams.delete('room');
  const legacy = LEGACY.get(url.hash.slice(2));
  if (legacy) url.hash = `/${legacy}`;
  if (url.href !== location.href) history.replaceState(null, '', url);
}

const state = load();
state.view = routeView(location.hash.slice(2));
tidyUrl();

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

function navigate(name, payload = null) {
  const view = LEGACY.get(name) || name;
  if (!views.includes(view)) return;
  if (view === 'records' && !payload) recordsFilter = 'map';
  state.view = view;
  state.routePayload = payload;
  const nextUrl = new URL(location.href);
  nextUrl.hash = `/${view}`;
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
      themeController?.setMusic(content.music || null);
    },
    musicControl(command) { return themeController?.musicControl(command); },
  },
};

/** The courtyard only navigates and forwards record-table actions to the shop. */
function onSpatialAction(action) {
  if (action.type === 'music') spatialContext.onMusic?.(action);
  if (action.type === 'navigate') navigate(action.view);
  // 'editor' and 'photo' came from Space's desk and photo wall; an older scene build may still send them.
}

function updateChrome() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === state.view;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const storageNote = document.querySelector('#storage-warning');
  if (storageNote) storageNote.hidden = !saveFailed;
  const sectionNames = { home: '从喜欢，走向未知', explore: '唱片店', records: '我的发现' };
  document.title = `${sectionNames[state.view]} · Music Map`;
}

function navItems() {
  return [
    ['home', 'heart', '小院'],
    ['explore', 'compass', '唱片店'],
    ['records', 'bookmark', '我的发现'],
  ].map(([view, name, title]) => `
    <button class="nav-item" data-nav="${view}">
      ${icon(name)}<span>${title}</span>
    </button>`).join('');
}

function shell() {
  root.innerHTML = `
    <header class="app-masthead app-studio-shell">
      <button class="brand" data-nav="home" aria-label="回到小院 · 樱下放映 Music Map">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-wordmark">樱下放映<small>Music Map</small></span>
      </button>
      <nav class="primary-nav" aria-label="主要导航">${navItems()}</nav>
      <div class="masthead-tools"><button class="demo-help icon-button" id="demo-help" aria-label="关于 Music Map" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}</button></div>
    </header>
    <div id="sakura-world" class="spatial-world" hidden></div>
    <div class="app-body">
      <div id="storage-warning" class="storage-warning" role="alert" hidden>这次修改尚未保存到浏览器，当前页面内容仍保留。请检查浏览器存储空间后重试。<button id="retry-save">重试保存</button></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <nav class="mobile-nav" aria-label="手机导航">${navItems()}</nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><h2 id="about-title">Music Map</h2><button class="icon-button" id="close-about" aria-label="关闭关于">${icon('x')}</button></div>
      <p class="about-intro">从喜欢，走向未知。</p><div class="about-facts"><p><b>寻声</b><span>唱片店里选好起点和终点，只能翻开所在歌手手边的合唱；沿翻开的合唱前往才算一步，翻开和提示不计步。</span></p><p><b>图鉴</b><span>完整图鉴摊开本专题收录的全部合唱，可从任意一位歌手出发自由漫游。</span></p><p><b>来源</b><span>每条连线都是一首真实的共同演唱录音，附有来源；制作署名只列已核实的部分。</span></p><p><b>曲库</b><span>开放曲库是公开数据集里的共同署名曲目，可搜索、留下，不连入关系图。</span></p><p><b>音频</b><span>这一版没有试听音频。</span></p><p><b>数据</b><span>探索记录和留下的歌只存在当前浏览器，清除网站数据后无法找回。</span></p></div>
      <button class="button button--primary" id="start-experience">知道了</button>
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
    toast(saveFailed ? '仍未保存，请检查浏览器存储空间后重试' : '已保存到当前浏览器');
  });
}

/** 我的发现: the explorations walked here and the songs kept on the way. */
function mountRecords(container) {
  const section = state.routePayload?.section;
  if (section === 'map' || section === 'music') recordsFilter = section;
  const filters = [['map', '探索记录'], ['music', '留下的歌']];
  container.innerHTML = `<div class="records-page collection-page"><header class="records-heading"><h1>我的发现</h1><button class="button" data-records-explore>${icon('compass')}去唱片店</button></header><div class="records-filters" role="group" aria-label="我的发现分类">${filters.map(([value, label]) => `<button data-records-filter="${value}" aria-pressed="${recordsFilter === value}">${label}</button>`).join('')}</div><div id="collection-content"></div></div>`;
  container.querySelector('[data-records-explore]').onclick = () => navigate('explore');
  const content = container.querySelector('#collection-content');
  return recordsFilter === 'music' ? mountSavedMusic(content, api) : mountMapRecords(content, api);
}

function render() {
  cleanup?.();
  cleanup = null;
  spatialContext = {};
  themeController?.setContent([]);
  if (state.view !== 'explore') themeController?.setMusic(null);
  const container = document.querySelector('#main-content');
  container.replaceChildren();
  document.body.dataset.view = state.view;
  document.body.dataset.spatialSection = state.view;
  themeController?.setView(state.view);
  if (state.view === 'home') cleanup = mountHome(container, api);
  if (state.view === 'explore') cleanup = mountMap(container, api);
  if (state.view === 'records') cleanup = mountRecords(container);
  updateChrome();
  container.scrollTop = 0;
  motion?.enter(container, state.view);
}

window.addEventListener('popstate', () => {
  if (location.hash === '#main-content') return;
  state.view = routeView(location.hash.slice(2));
  state.routePayload = null;
  tidyUrl();
  persist();
  render();
});

shell();
// Write the trimmed save once, so the dropped Space data frees its storage now.
if (droppedLegacy) persist();
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

import '../css/base.css';
import '../css/map.css';
import '../css/space.css';
import { icon } from './icons.js';
import { createMapState, mountMap, mountMapRecords } from './map.js';
import { createSpaceState, mountSpace, mountSpaceRecords } from './space.js';

const STORAGE_KEY = 'music-map-space:v1';
const views = ['explore', 'space', 'records'];
const actors = { a: 'Lin', b: '阿遥' };
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let saveFailed = false;

function initialState() {
  return { version: 1, view: 'explore', actor: 'a', map: createMapState(), space: createSpaceState(), routePayload: null };
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
  state.view = view;
  state.routePayload = payload;
  if (location.hash !== `#/${view}`) history.pushState(null, '', `#/${view}`);
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

const api = { getState: () => state, update, render, navigate, toast, icon };

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
    <aside class="app-rail" aria-label="主导航">
      <button class="brand" data-nav="explore" aria-label="Music Map 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>music<span class="brand-light">map</span><small>声音相连 · 同场相遇</small></span>
      </button>
      <nav class="primary-nav">${navItems()}</nav>
      <div class="rail-bottom"><span class="edition">IN GOOD COMPANY.</span><span class="edition-number">MM / 001</span></div>
    </aside>
    <div class="app-body">
      <header class="topbar">
        <div class="topbar-breadcrumb"><span>MUSIC, WITH PEOPLE.</span><span class="topbar-divider"></span><span class="demo-tag">交互演示</span></div>
        <div class="topbar-actions">
          <button class="demo-help" id="demo-help" aria-label="关于演示">${icon('info')}<span>关于演示</span></button>
          <span class="identity"><span class="identity-dot"></span><span data-current-actor>${actors[state.actor]}</span></span>
        </div>
      </header>
      <div id="storage-warning" class="storage-warning" role="alert" hidden>这次修改尚未保存到浏览器，当前页面内容仍保留。可减少上传图片后重试。<button id="retry-save">重试保存</button></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
      <footer class="app-footer"><span>MUSIC MAP × MUSIC SPACE</span><span>示例人物与场次 · 记录保存在当前浏览器</span></footer>
    </div>
    <nav class="mobile-nav" aria-label="手机导航">${navItems()}</nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><span class="eyebrow">A SMALL WORLD, SHARED.</span><button class="icon-button" id="close-about" aria-label="关闭演示说明">${icon('x')}</button></div>
      <h2 id="about-title">声音让我们靠近，<br>现场让我们相遇。</h2>
      <p>从艺人关系出发，进入同一场 Space。用自己的现场卡，交换另一个人的视角。</p>
      <div class="about-facts"><p><b>两个角色，一次相遇</b><span>在同场页切换 Lin 与阿遥，体验申请、接受与拒绝。当前是本地情景演示。</span></p><p><b>自己的选择，留在这里</b><span>记录仅保存在当前浏览器。示例艺人、场次与生成图片用于说明体验，未接入真实音频或多人联网。</span></p></div>
      <button class="button button--primary" id="start-experience">继续体验 ${icon('arrow-right')}</button>
    </dialog>`;
  root.addEventListener('click', event => {
    const item = event.target.closest('[data-nav]');
    if (item) navigate(item.dataset.nav);
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
  if (state.view === 'records') {
    container.innerHTML = `<div class="records-page"><header class="records-heading"><span class="eyebrow">YOUR LITTLE ARCHIVE</span><h1>这一刻，<br>留给以后的自己。</h1><p class="muted">走过的音乐，交换的视角。<br>属于你的记忆，在这里慢慢积累。</p><span class="records-local">${icon('bookmark')} 仅此浏览器保存</span></header><div id="space-records"></div><div id="map-records"></div></div>`;
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
render();

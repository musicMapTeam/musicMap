import '../css/base.css';
import '../css/map.css';
import '../css/space.css';
import '../css/live.css';
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
const invitedRoom = new URLSearchParams(location.search).get('room');
if (invitedRoom && /^\d{6}$/.test(invitedRoom)) state.view = 'live';

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
    const active = el.dataset.nav === (state.view === 'live' ? 'space' : state.view);
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const storageNote = document.querySelector('#storage-warning');
  if (storageNote) storageNote.hidden = !saveFailed;
  const sectionNames = { explore: '发现新的声音', space: '遇见同场的人', records: '留住这次相遇', live: '邀请同场，交换视角' };
  document.querySelectorAll('[data-view-label]').forEach(el => { el.textContent = sectionNames[state.view]; });
  const identity = document.querySelector('.identity');
  if (identity) identity.hidden = state.view === 'live';
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
      <span class="masthead-note">FOLLOW THE SOUND.<br><span>FIND YOUR PEOPLE.</span></span>
    </header>
    <div class="app-body">
      <header class="topbar">
        <div class="topbar-breadcrumb"><span data-view-label>发现新的声音</span><span class="topbar-divider"></span><span class="demo-tag">示例内容 · 两种体验</span></div>
        <div class="topbar-actions">
          <button class="demo-help" id="demo-help" aria-label="演示说明" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}<span>演示说明</span></button>
          <span class="identity"><span class="identity-dot"></span><span data-current-actor>${actors[state.actor]}</span></span>
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
      <p>从艺人关系出发，进入同一场 Space。用自己的现场卡，交换另一个人的视角。</p>
      <div class="about-facts"><p><b>先体验，再邀请</b><span>本地情景演示可切换 Lin 与阿遥，体验申请、接受与拒绝。也可以通过邀请码进入真实双人房间，由各自设备操作；联网体验需要可用的共享服务。</span></p><p><b>两种体验，清楚区分</b><span>本地记录保存在当前浏览器；在线房间的内容向房间成员展示，双方同意后才交换。示例艺人、场次与生成图片用于说明体验，不代表真实到场，尚未接入真实音频。</span></p></div>
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
  if (state.view === 'live') cleanup = mountLive(container, api);
  if (state.view === 'records') {
    container.innerHTML = `<div class="records-page"><header class="records-heading"><span class="eyebrow">YOUR LITTLE ARCHIVE</span><h1>这一刻，<br>留给以后的自己。</h1><p class="muted">走过的音乐，交换的视角。<br>属于你的记忆，在这里慢慢积累。</p><span class="records-local">${icon('bookmark')} 情景与探索记录保存在本机</span></header><section class="records-live-link" aria-label="联网房间记忆"><div><span class="eyebrow">SHARED MEMORIES</span><h2>房间里的共同记忆</h2><p>真实同场的双联票保存在各自房间，回到房间即可查看与下载。</p></div><button class="button button--primary" data-nav="live">查看同场房间 ${icon('arrow-right')}</button></section><div id="space-records"></div><div id="map-records"></div></div>`;
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

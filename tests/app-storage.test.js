import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createExplorationStorage, EXPLORATION_KEY } from '../web/js/exploration-storage.js';
const source = fs.readFileSync(new URL('../web/js/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
class Element {
  constructor() { this.listeners = {}; this.dataset = {}; this.style = { removeProperty() {}, setProperty() {} }; this.hidden = false; this.classes = new Set(); this.innerHTML = ''; this.textContent = '';
    this.classList = { add: x => this.classes.add(x), remove: x => this.classes.delete(x), contains: x => this.classes.has(x), toggle: (x, yes) => yes ? this.classes.add(x) : this.classes.delete(x) }; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatch(type, event = {}) { return Promise.all((this.listeners[type] || []).map(fn => fn(event))); }
  replaceChildren() { this.innerHTML = ''; }
  setAttribute() {} removeAttribute() {} toggleAttribute() {} close() {} focus() {}
}
function shared() {
  let raw = JSON.stringify({ version: 1, map: { sessions: [{ id: 'old' }], view: {} } }), writes = 0;
  const storage = { getItem: () => raw, setItem: (key, value) => { assert.equal(key, EXPLORATION_KEY); raw = value; writes++; } };
  let lock = Promise.resolve();
  const locks = { request: (name, opts, fn) => { const next = lock.then(fn); lock = next.catch(() => {}); return next; } };
  return { storage, locks, raw: () => raw, writes: () => writes, external: value => { raw = value; } };
}
function tab(fixture) {
  const els = new Map(), win = new Element(), body = new Element(), downloads = []; body.append = () => {}; let reloads = 0, confirms = 0, answer = false;
  const element = selector => { if (!els.has(selector)) { const el = new Element(); el.querySelector = element; els.set(selector, el); } return els.get(selector); };
  const doc = { querySelector: element, querySelectorAll: () => [], body, title: '', createElement() { return { click() { downloads.push({ href: this.href, filename: this.download }); }, remove() {} }; } };
  const location = { href: 'https://example.test/#/home', hash: '#/home', reload: () => { reloads++; } };
  const change = (state, title, url) => { location.href = String(url); location.hash = new URL(url).hash; };
  win.scrollTo = () => {}; win.confirm = () => { confirms++; return answer; };
  const context = vm.createContext({ document: doc, window: win, navigator: { locks: fixture.locks }, localStorage: fixture.storage, location, history: { replaceState: change, pushState: change }, URL, Blob, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, queueMicrotask, console,
    createExplorationStorage, EXPLORATION_KEY, createMapState: () => ({ sessions: [], view: {} }), icon: () => '', qqLinkedCount: 31,
    mountThemes: () => ({ setContent() {}, setMusic() {}, setView() {} }), mountMotion: () => ({ enter() {} }), mountHome() {}, mountMap() {}, mountMapRecords() {}, mountSavedMusic() {}, mountOpenCatalogue() {}, OverlayScrollbars() {},
  });
  vm.runInContext(source, context);
  return { downloads, api: vm.runInContext('api', context), store: vm.runInContext('explorationStorage', context), element, win, location, reloads: () => reloads, confirms: () => confirms, answer: value => { answer = value; } };
}
const flush = () => new Promise(setImmediate);

test('the actual app never saves solely for repeated navigation or Back/Forward', async () => {
  const f = shared(), b = tab(f), before = f.raw();
  for (const view of ['records', 'home', 'explore', 'home', 'records']) b.api.navigate(view);
  b.location.href = 'https://example.test/#/home'; b.location.hash = '#/home'; await b.win.dispatch('popstate');
  b.location.href = 'https://example.test/#/records'; b.location.hash = '#/records'; await b.win.dispatch('popstate');
  await flush(); assert.equal(f.raw(), before); assert.equal(f.writes(), 0);
});
test('fresh-tab addition survives stale-tab navigation and queued Back/Forward events', async () => {
  const f = shared(), a = tab(f), b = tab(f); a.api.update(s => s.map.sessions.push({ id: 'new' })); await a.store.settled();
  for (const view of ['records', 'explore', 'home']) b.api.navigate(view);
  await b.win.dispatch('popstate'); await flush();
  assert.equal(f.writes(), 1); assert.equal(JSON.parse(f.raw()).map.sessions.length, 2); assert.equal(b.store.conflict, true);
  assert.match(b.element('#main-content').innerHTML, /另一页更新/); assert.equal(b.element('#storage-warning').hidden, false);
});
test('storage events stop stale mutation before its callback can run', async () => {
  const f = shared(), a = tab(f), b = tab(f); a.api.update(s => { s.map.sessions = []; }); await a.store.settled();
  await b.win.dispatch('storage', { key: EXPLORATION_KEY, storageArea: f.storage }); await flush();
  let mutated = false; assert.equal(b.api.update(() => { mutated = true; }), false); assert.equal(mutated, false);
  assert.equal(JSON.parse(f.raw()).map.sessions.length, 0); assert.equal(f.writes(), 1);
});
test('unrelated storage events are ignored; focus and bfcache return detect a missed change', async () => {
  const f = shared(), b = tab(f); f.external(JSON.stringify({ version: 1, map: { sessions: [{ id: 'latest' }] } }));
  await b.win.dispatch('storage', { key: 'music-map-saved-music:v1', storageArea: f.storage }); assert.equal(b.store.conflict, false);
  await b.win.dispatch('pageshow'); assert.equal(b.store.conflict, true); assert.equal(f.writes(), 0);
});
test('reload cancellation preserves a losing concurrent edit and newer storage; repeated retry is blocked', async () => {
  const f = shared(), a = tab(f), b = tab(f); a.api.update(s => s.map.sessions.push({ id: 'A' })); b.api.update(s => s.map.sessions.push({ id: 'B' }));
  await Promise.all([a.store.settled(), b.store.settled()]); await flush(); assert.equal(b.store.conflict, true); assert.equal(b.store.dirty, true);
  await b.element('#reload-records').dispatch('click'); assert.equal(b.reloads(), 0); assert.equal(b.confirms(), 1);
  assert.equal(b.api.getState().map.sessions.at(-1).id, 'B');
  await b.element('#retry-save').dispatch('click'); await b.element('#retry-save').dispatch('click');
  assert.equal(JSON.parse(f.raw()).map.sessions.at(-1).id, 'A'); assert.equal(f.writes(), 1);
  b.answer(true); await b.element('#reload-records').dispatch('click'); assert.equal(b.reloads(), 1);
});
test('unsaved asynchronous edits protect unload until the queued save succeeds', async () => {
  const f = shared(), b = tab(f); b.api.update(s => s.map.sessions.push({ id: 'B' }));
  let prevented = 0; const event = { preventDefault() { prevented++; } };
  await b.win.dispatch('beforeunload', event); assert.equal(prevented, 1);
  await b.store.settled(); await b.win.dispatch('beforeunload', event); assert.equal(prevented, 1);
});


test('backup downloads the losing tab’s retained exploration without changing newer storage', async () => {
  const f = shared(), a = tab(f), b = tab(f); a.api.update(s => s.map.sessions.push({ id: 'A' })); b.api.update(s => s.map.sessions.push({ id: 'B' }));
  await Promise.all([a.store.settled(), b.store.settled()]);
  await b.element('#backup-records').dispatch('click');
  assert.equal(b.downloads.length, 1); assert.equal(b.downloads[0].filename, 'music-map-exploration-backup.json');
  const backup = await (await fetch(b.downloads[0].href)).json();
  assert.equal(backup.map.sessions.at(-1).id, 'B'); assert.equal(backup.view, undefined); assert.equal(backup.routePayload, undefined);
  assert.equal(JSON.parse(f.raw()).map.sessions.at(-1).id, 'A'); assert.equal(f.writes(), 1);
});

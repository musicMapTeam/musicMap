import catalogue from '../assets/data/hf-collaborations.json';
import { icon } from './icons.js';
import { importLegacyMapMusic } from './map.js';
import { getSavedMusic, toggleSavedMusic, removeSavedMusic, subscribeSavedMusic } from './music-library.js';

const hfSnapshot = track => ({ id: track.id, title: track.title, artists: [...track.artists], source: catalogue.source.url, dataset: 'hf' });

function importPreviousSaves(api) {
  try { importLegacyMapMusic(api); }
  catch { api.toast('旧探索记录仍保留，歌曲收藏暂未同步到浏览器'); }
}

function bringToLive(track, api) {
  const state = api.getState();
  const resumeSessionId = state.view === 'explore' ? state.map.activeId : null;
  api.update(updated => { updated.space.mapReturnId = resumeSessionId; });
  const { savedAt, ...songDraft } = track;
  api.navigate('live', { intent: 'create-room', songDraft, ...(resumeSessionId ? { resumeSessionId } : {}) });
}

function updateSaveButton(button, track, saved) {
  button.innerHTML = icon(saved ? 'check' : 'plus');
  button.classList.toggle('is-saved', saved);
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}《${track.title}》`);
  button.title = saved ? '已留下，点击取消收藏' : '留下这首歌';
}

function musicRow(track, index, { saved, detail, onSave, onTake }) {
  const row = document.createElement('article'); row.className = 'open-catalogue__record'; row.dataset.musicId = track.id;
  const info = document.createElement('details');
  const summary = document.createElement('summary');
  const number = document.createElement('span'); number.className = 'open-catalogue__number'; number.textContent = String(index + 1).padStart(2, '0');
  const copy = document.createElement('span'); copy.className = 'open-catalogue__copy';
  const title = document.createElement('strong'); title.textContent = track.title;
  const artists = document.createElement('small'); artists.textContent = track.artists.join(' · ');
  copy.append(title, artists); summary.append(number, copy); info.append(summary, detail);
  const actions = document.createElement('div'); actions.className = 'music-row__actions';
  const save = document.createElement('button'); save.type = 'button'; save.className = 'icon-button music-row__save'; save.dataset.musicSave = track.id;
  updateSaveButton(save, track, saved); save.addEventListener('click', onSave);
  const take = document.createElement('button'); take.type = 'button'; take.className = 'button button--quiet music-row__take'; take.textContent = '带到现场';
  take.setAttribute('aria-label', `把《${track.title}》带到现场`); take.addEventListener('click', onTake);
  actions.append(save, take); row.append(info, actions); return row;
}

export function mountOpenCatalogue(api) {
  importPreviousSaves(api);
  const abort = new AbortController();
  const dialog = document.createElement('dialog');
  dialog.className = 'open-catalogue';
  dialog.setAttribute('aria-labelledby', 'open-catalogue-title');
  dialog.innerHTML = `<header><div><span class="open-catalogue__eyebrow">THE OPEN CRATE</span><h2 id="open-catalogue-title">开放曲库<span>${catalogue.tracks.length}</span></h2></div><button class="icon-button" data-crate-close aria-label="关闭开放曲库">${icon('x')}</button></header>
    <label class="open-catalogue__search">${icon('magnifying-glass')}<input type="search" placeholder="搜歌曲、艺人" aria-label="搜索开放曲库"></label>
    <p class="open-catalogue__note">共同署名艺人 · 制作分工未收录</p><div class="open-catalogue__list"></div>
    <footer><span data-crate-count role="status"></span><a target="_blank" rel="noopener noreferrer">Hugging Face 数据来源 ${icon('arrow-up-right')}</a></footer>`;
  dialog.querySelector('footer a').href = catalogue.source.url;
  document.body.append(dialog);
  const list = dialog.querySelector('.open-catalogue__list');
  function render(query = '') {
    const search = query.trim().toLocaleLowerCase();
    const tracks = catalogue.tracks.filter(track => [track.title, ...track.artists].join(' ').toLocaleLowerCase().includes(search));
    const savedIds = new Set(getSavedMusic().map(track => track.id));
    list.replaceChildren();
    tracks.forEach((track, index) => {
      const detail = document.createElement('p'); detail.textContent = `专辑：${track.album} · 原始记录 ${track.source.recordNumber}`;
      const snapshot = hfSnapshot(track);
      list.append(musicRow(snapshot, index, {
        saved: savedIds.has(track.id), detail,
        onSave() {
          try { api.toast(toggleSavedMusic(snapshot) ? '已留下，在收藏里继续' : '已取消收藏'); }
          catch { api.toast('收藏还未保存，请检查浏览器存储空间后重试'); }
        },
        onTake() { dialog.close(); bringToLive(snapshot, api); },
      }));
    });
    if (!tracks.length) { const empty = document.createElement('p'); empty.className = 'open-catalogue__empty'; empty.textContent = '这箱唱片里还没有。换个关键词吧。'; list.append(empty); }
    dialog.querySelector('[data-crate-count]').textContent = `${tracks.length} 首 / 本地全库 ${catalogue.counts.rows.toLocaleString('en-US')} 行`;
  }
  const unsubscribe = subscribeSavedMusic(tracks => {
    const savedIds = new Set(tracks.map(track => track.id));
    list.querySelectorAll('[data-music-save]').forEach(button => {
      const track = catalogue.tracks.find(item => item.id === button.dataset.musicSave);
      updateSaveButton(button, track, savedIds.has(track.id));
    });
  });
  dialog.querySelector('input').addEventListener('input', event => render(event.target.value));
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-crate-close]')) dialog.close();
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-catalogue]') && !dialog.open) dialog.showModal();
  }, { signal: abort.signal });
  render();
  return () => { unsubscribe(); abort.abort(); dialog.remove(); };
}

/** Compact collection used by the app's unified records surface. */
export function mountSavedMusic(container, api) {
  importPreviousSaves(api);
  function render() {
    const tracks = getSavedMusic();
    container.innerHTML = `<section class="saved-music" aria-label="收藏的歌曲"><header class="saved-music__heading"><h2>留下的歌</h2><span>${tracks.length} 首</span></header><div class="saved-music__list"></div></section>`;
    const list = container.querySelector('.saved-music__list');
    if (!tracks.length) {
      list.innerHTML = `<div class="saved-music__empty">${icon('bookmark')}<p>遇到喜欢的歌，就留在这里。</p><button type="button" class="button button--primary" data-music-explore>去探索 ${icon('arrow-up-right')}</button></div>`;
      list.querySelector('button').addEventListener('click', () => api.navigate('explore')); return;
    }
    tracks.forEach((track, index) => {
      const detail = document.createElement('p');
      const date = new Date(track.savedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      detail.textContent = `${track.dataset === 'hf' ? '开放曲库 · 共同署名' : '真实合作精选'} · ${date}留下`;
      if (/^https?:\/\//.test(track.source)) {
        const source = document.createElement('a'); source.href = track.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = '资料来源'; detail.append(' · ', source);
      }
      list.append(musicRow(track, index, {
        saved: true, detail,
        onSave() {
          try {
            removeSavedMusic(track.id); api.toast('已取消收藏');
            const buttons = [...container.querySelectorAll('[data-music-save]')];
            (buttons[Math.min(index, buttons.length - 1)] || container.querySelector('[data-music-explore]'))?.focus({ preventScroll: true });
          } catch { api.toast('这首歌尚未移除，请检查浏览器存储空间后重试'); }
        },
        onTake() { bringToLive(track, api); },
      }));
    });
  }
  const unsubscribe = subscribeSavedMusic(render);
  render(); return unsubscribe;
}

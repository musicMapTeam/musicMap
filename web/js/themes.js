import { icon } from './icons.js';
import { mountSakuraScene } from './sakura-scene.js';

const STORAGE_KEY = 'music-map-visual-theme:v1';
const themes = [
  { id: 'festival', name: '声浪现场', en: 'AFTER THE ENCORE', color: '#0c1016' },
  { id: 'sakura', name: '樱下放映', en: 'A LITTLE MUSIC CORNER', color: '#f5f2e8' },
  { id: 'zine', name: '独立刊物', en: 'SAME NIGHT. TWO SIDES.', color: '#e9e8dd' },
];

/** Visual state deliberately lives outside the room, card and route stores. */
export function mountThemes({ onAction, onShot, view }) {
  const launcher = document.querySelector('#theme-launcher');
  const dialog = document.createElement('dialog');
  dialog.className = 'theme-dialog';
  dialog.id = 'theme-dialog';
  dialog.setAttribute('aria-labelledby', 'theme-title');
  dialog.innerHTML = `<div class="theme-dialog__top"><h2 id="theme-title">外观</h2><button class="icon-button" data-theme-close aria-label="关闭外观选择">${icon('x')}</button></div>
    <div class="theme-options" role="group" aria-label="选择视觉风格">${themes.map((theme, i) => `<button class="theme-option theme-option--${theme.id}" data-theme-option="${theme.id}" aria-pressed="false">
      <span class="theme-preview" aria-hidden="true"><span class="theme-preview__edition">${String(i + 1).padStart(2, '0')} / MUSIC SPACE</span><span class="theme-preview__art"></span><strong>${['同一刻。<br>另一面。', '春日。<br>来信。', 'SAME<br>NIGHT.'][i]}</strong><span class="theme-preview__foot">${theme.en}</span></span>
      <span class="theme-option__title"><b>${theme.name}</b><span class="theme-option__check">${icon('check')}</span></span>
    </button>`).join('')}</div>
    <footer class="theme-dialog__footer"><p data-theme-status role="status" aria-live="polite"></p><button class="button button--primary" data-theme-close>完成</button></footer>`;
  document.body.append(dialog);

  const sceneHost = document.querySelector('#sakura-world');
  let scene = null;
  let currentView = view;
  let currentMode = view === 'space' ? 'home' : view;
  let cards = [];
  let focused = null;
  function syncScene() {
    const wantsScene = document.documentElement.dataset.theme === 'sakura';
    sceneHost.hidden = !wantsScene;
    if (!wantsScene) { scene?.dispose(); scene = null; }
    if (wantsScene && !scene) {
      scene = mountSakuraScene(sceneHost, { onAction, onShot, view: currentView });
      scene.setContent(cards, currentMode);
      scene.setView(currentView, { mode: currentMode, immediate: true });
      if (focused) scene.focus(focused.kind, focused.id);
    }
  }

  function applyTheme(id, save = true) {
    const theme = themes.find(item => item.id === id) || themes[0];
    document.documentElement.dataset.theme = theme.id;
    document.querySelector('meta[name="theme-color"]').content = theme.color;
    document.querySelector('meta[name="color-scheme"]').content = theme.id === 'festival' ? 'dark' : 'light';
    launcher.querySelector('[data-theme-name]').textContent = theme.name;
    launcher.setAttribute('aria-label', `选择外观，当前${theme.name}`);
    dialog.querySelectorAll('[data-theme-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeOption === theme.id)));
    let saved = true;
    if (save) {
      try { localStorage.setItem(STORAGE_KEY, theme.id); } catch { saved = false; }
    }
    dialog.querySelector('[data-theme-status]').textContent = saved ? `已选 ${theme.name}` : `已选 ${theme.name}，未能记住外观`;
    syncScene();
  }

  launcher.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    const option = event.target.closest('[data-theme-option]');
    if (option) applyTheme(option.dataset.themeOption);
    if (event.target === dialog || event.target.closest('[data-theme-close]')) dialog.close();
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) applyTheme(event.newValue, false);
  });
  applyTheme(document.documentElement.dataset.theme, false);
  return {
    setView(next, options = {}) { currentView = next; currentMode = options.mode || (next === 'space' ? 'home' : next); focused = null; return scene?.setView(next, { ...options, mode: currentMode }); },
    setContent(next, mode) { cards = next; if (mode) currentMode = mode; scene?.setContent(cards, mode); },
    focus(kind, id) { focused = { kind, id }; return scene?.focus(kind, id) || Promise.resolve(true); },
    restore() { focused = null; return scene?.restore(); },
  };
}

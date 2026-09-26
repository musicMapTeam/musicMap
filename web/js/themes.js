import { icon } from './icons.js';
import { mountSakuraScene } from './sakura-scene.js';

const STORAGE_KEY = 'music-map-visual-theme:v1';
const themes = [
  { id: 'festival', name: '声浪现场', en: 'AFTER THE ENCORE', line: '把余音留在夜色里。', detail: '海沫绿 / 巨幅字形 / 声波票根', color: '#0c1016' },
  { id: 'sakura', name: '樱下放映', en: 'A LITTLE MUSIC CORNER', line: '在春日街角，重逢这一晚。', detail: '赛璐璐街景 / 奶油纸 / 邮戳记忆', color: '#f5f2e8' },
  { id: 'zine', name: '独立刊物', en: 'SAME NIGHT. TWO SIDES.', line: '把共同记忆，印成创刊号。', detail: '荧光油墨 / 拼贴排版 / 独立票刊', color: '#e9e8dd' },
];

/** Visual state deliberately lives outside the room, card and route stores. */
export function mountThemes() {
  const launcher = document.querySelector('#theme-launcher');
  const dialog = document.createElement('dialog');
  dialog.className = 'theme-dialog';
  dialog.id = 'theme-dialog';
  dialog.setAttribute('aria-labelledby', 'theme-title');
  dialog.innerHTML = `<div class="theme-dialog__top"><span class="eyebrow">THE SAME MOMENT, IN YOUR STYLE.</span><button class="icon-button" data-theme-close aria-label="关闭外观选择">${icon('x')}</button></div>
    <header class="theme-dialog__heading"><h2 id="theme-title">给这一晚，<br>换个封面。</h2><p>三种视觉，一份共同记忆。<br>页面与下载的票根，都会穿上你选的外观。</p></header>
    <div class="theme-options" role="group" aria-label="选择视觉风格">${themes.map((theme, i) => `<button class="theme-option theme-option--${theme.id}" data-theme-option="${theme.id}" aria-pressed="false">
      <span class="theme-preview" aria-hidden="true"><span class="theme-preview__edition">${String(i + 1).padStart(2, '0')} / MUSIC SPACE</span><span class="theme-preview__art"></span><strong>${['同一刻。<br>另一面。', '春日。<br>来信。', 'SAME<br>NIGHT.'][i]}</strong><span class="theme-preview__foot">${theme.en}</span></span>
      <span class="theme-option__title"><b>${theme.name}</b><span class="theme-option__check">${icon('check')}</span></span>
      <span class="theme-option__line">${theme.line}</span><span class="theme-option__detail">${theme.detail}</span>
    </button>`).join('')}</div>
    <footer class="theme-dialog__footer"><p data-theme-status role="status" aria-live="polite"></p><button class="button button--primary" data-theme-close>就用这套 ${icon('arrow-right')}</button></footer>`;
  document.body.append(dialog);

  let sceneHost = null;
  let disposeScene = null;
  function syncScene() {
    const hero = document.querySelector('.sp-hero');
    const wantsScene = document.documentElement.dataset.theme === 'sakura';
    if (sceneHost && (!sceneHost.isConnected || !wantsScene)) {
      disposeScene?.();
      sceneHost.remove();
      sceneHost = null;
      disposeScene = null;
    }
    if (hero && wantsScene && !sceneHost) {
      sceneHost = document.createElement('div');
      sceneHost.className = 'theme-world';
      sceneHost.dataset.themeWorld = '';
      hero.prepend(sceneHost);
      disposeScene = mountSakuraScene(sceneHost);
    }
    const note = hero?.querySelector('.sp-hero__image-note');
    const label = wantsScene ? '原创场景示意' : 'AI 场景示意';
    if (note && note.textContent !== label) note.textContent = label;
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
    dialog.querySelector('[data-theme-status]').textContent = saved ? `已选「${theme.name}」 · 自动记住你的选择` : `已选「${theme.name}」 · 此浏览器暂时无法记住外观`;
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
  // Space can rerender its own content after changing demo roles. Attach the
  // decoration to the current hero; never rerender any business UI for a theme.
  const observer = new MutationObserver(syncScene);
  observer.observe(document.querySelector('#main-content'), { childList: true, subtree: true });
  applyTheme(document.documentElement.dataset.theme, false);
}

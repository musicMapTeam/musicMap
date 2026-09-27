import { mountSakuraScene } from './sakura-scene.js';

/** One persistent courtyard connects every view. */
export function mountThemes({ onAction, onShot, view }) {
  document.documentElement.dataset.theme = 'sakura';
  const host = document.querySelector('#sakura-world');
  host.hidden = false;
  const scene = mountSakuraScene(host, { onAction, onShot, view });
  const mode = view === 'space' ? 'home' : view;
  scene.setContent([], mode);
  scene.setView(view, { mode, immediate: true });
  return {
    setView(next, options = {}) { return scene.setView(next, { ...options, mode: options.mode || (next === 'space' ? 'home' : next) }); },
    setContent(cards, mode) { scene.setContent(cards, mode); },
    setMusic(content) { scene.setMusic?.(content); },
    musicControl(command) { return scene.musicControl?.(command); },
    focus(kind, id) { return scene.focus(kind, id); },
    restore() { return scene.restore(); },
  };
}

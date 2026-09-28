import { mountSakuraScene } from './sakura-scene.js';

// Before 0.16 the courtyard home was the 'space' route; an old caller may still say so.
const sceneView = view => (view === 'space' ? 'home' : view);

/** One persistent courtyard connects every view. */
export function mountThemes({ onAction, onShot, view }) {
  document.documentElement.dataset.theme = 'sakura';
  const host = document.querySelector('#sakura-world');
  host.hidden = false;
  const start = sceneView(view);
  const scene = mountSakuraScene(host, { onAction, onShot, view: start });
  scene.setContent([], start);
  scene.setView(start, { mode: start, immediate: true });
  return {
    setView(next, options = {}) {
      const target = sceneView(next);
      return scene.setView(target, { ...options, mode: options.mode || target });
    },
    setContent(cards, mode) { scene.setContent(cards, mode); },
    setMusic(content) { scene.setMusic?.(content); },
    musicControl(command) { return scene.musicControl?.(command); },
    focus(kind, id) { return scene.focus(kind, id); },
    restore() { return scene.restore(); },
  };
}

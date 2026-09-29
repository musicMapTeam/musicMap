import { gsap } from 'gsap';

/** Timelines own transforms only while moving; CSS owns the resting pose. */
export function mountMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let entrance;
  let lastView;
  const dialogs = new Map();
  const observer = new MutationObserver(records => {
    for (const { target } of records) {
      // Full-screen and print dialogs choreograph themselves.
      if (!(target instanceof HTMLDialogElement) || target.dataset.motion === 'self') continue;
      dialogs.get(target)?.kill();
      dialogs.delete(target);
      gsap.set(target, { clearProps: 'opacity,transform' });
      if (target.open && !reduced.matches) {
        dialogs.set(target, gsap.fromTo(target, { opacity: 0, y: 16, scale: .975 }, {
          opacity: 1, y: 0, scale: 1, duration: .36, ease: 'power3.out', clearProps: 'opacity,transform',
          onComplete: () => dialogs.delete(target),
        }));
      }
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { entrance?.progress(1); dialogs.forEach(tween => tween.progress(1)); }
  });
  return {
    enter(container, view) {
      if (lastView === view) return;
      lastView = view;
      entrance?.revert();
      if (reduced.matches) return;
      const panel = container.firstElementChild;
      if (!panel) return;
      entrance = gsap.fromTo(panel, { opacity: 0 }, {
        opacity: 1, duration: .4, delay: .08, ease: 'power2.out', clearProps: 'opacity',
      });
    },
  };
}

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

/** Timelines own transforms only while moving; CSS owns the resting pose. */
export function mountMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let entrance;
  let cardFlip;
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
  // Capture the actual card pose before Space changes its selected viewpoint.
  document.addEventListener('click', event => {
    if (reduced.matches || !event.target.closest('[data-perspective]')) return;
    const cards = document.querySelectorAll('.space-photo');
    if (!cards.length) return;
    cardFlip?.kill();
    const state = Flip.getState(cards);
    requestAnimationFrame(() => {
      const targets = [...cards].filter(card => card.isConnected);
      if (!targets.length) return;
      targets.forEach(card => { card.style.transition = 'none'; });
      cardFlip = Flip.from(state, { targets, duration: .72, ease: 'power3.inOut',
        onComplete: () => targets.forEach(card => card.style.removeProperty('transition')),
        onInterrupt: () => targets.forEach(card => card.style.removeProperty('transition')),
      });
    });
  }, true);
  reduced.addEventListener('change', () => {
    if (reduced.matches) { entrance?.progress(1); cardFlip?.progress(1); dialogs.forEach(tween => tween.progress(1)); }
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

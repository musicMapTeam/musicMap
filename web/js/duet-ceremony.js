import { gsap } from 'gsap';
import { icon } from './icons.js';
import { completedLabel, eventMeta, eventTitle, stampDate } from './duet-facts.js';

/**
 * The accepted duet, shown as one full-screen night ticket.
 * Real rooms, the collection and the local scenario pass data in and keep their own rules;
 * this component never decides consent. Callers only open it for accepted snapshots.
 */
const SEEN_KEY = 'music-space-duet-seen:v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let active = null;

/** True only the first time this browser shows an accepted exchange. Private windows fall back to a short revisit. */
export function firstDuetView(id) {
  if (!id) return false;
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    const seen = Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : [];
    if (seen.includes(id)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-60)));
    return true;
  } catch { return false; }
}

export function closeDuetCeremony() { active?.close(); }

/** Festoon bulbs hang on one or two quadratic swags; positions are deterministic. */
function festoon(swags) {
  const top = 8;
  const sag = swags === 1 ? 46 : 40;
  const segments = [];
  const bulbs = [];
  for (let s = 0; s < swags; s += 1) {
    const x0 = -2 + (104 / swags) * s;
    const x1 = -2 + (104 / swags) * (s + 1);
    const cx = (x0 + x1) / 2;
    segments.push(`${s ? '' : `M${x0} ${top}`} Q${cx} ${top + sag * 2} ${x1} ${top}`);
    const count = swags === 1 ? 9 : 8;
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t ** 2 * x1;
      const y = top + 2 * t * (1 - t) * sag * 2;
      bulbs.push({ x, y });
    }
  }
  return { path: segments.join(' '), bulbs };
}

const PETALS = [
  [-230, -120, 160], [-170, -210, -140], [-110, -150, 90], [-60, -240, -60], [-20, -130, 200],
  [30, -220, -180], [80, -140, 120], [140, -230, -90], [190, -120, 150], [240, -190, -200],
  [-150, 40, 110], [150, 60, -130],
];

/**
 * @param {object} options
 * @param {string} options.id exchange id, used for the first-view premiere
 * @param {boolean} [options.reveal] force the full premiere (e.g. right after accepting)
 * @param {'live'|'local'} options.scenario
 * @param {{title,subtitle,date,city,isDemo}} options.event
 * @param {string} options.completedAt
 * @param {Array<{author,src,load,isExample,perspective,moment,caption}>} options.sides
 * @param {{label,value}} options.shared
 * @param {string} options.status
 * @param {string} [options.note]
 * @param {string} options.closeLabel
 * @param {Array<{id,kind,icon,label,busyLabel,run}>} options.actions
 * @param {Function} [options.onClose]
 */
export function openDuetCeremony(options) {
  active?.close();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const first = firstDuetView(options.id);
  const mode = options.reveal || first ? 'reveal' : 'revisit';
  const [a, b] = options.sides;
  const nameLength = [...String(a.author || '')].length + [...String(b.author || '')].length;
  const nameScale = nameLength > 26 ? .56 : nameLength > 18 ? .7 : nameLength > 12 ? .84 : 1;
  const swags = innerWidth < 700 ? 1 : 2;
  const lights = festoon(swags);
  const tag = options.scenario === 'local' ? '情景演示 · 仅本机' : options.event?.isDemo ? '示例场次' : '';
  const meta = eventMeta(options.event);
  const actions = options.actions.filter(Boolean);
  const buttonMarkup = action => {
    const kind = action.kind || 'secondary';
    return `<button type="button" class="duet-ceremony__button duet-ceremony__button--${kind}" data-duet-action="${escape(action.id)}">${action.icon ? icon(action.icon) : ''}<span>${escape(action.label)}</span></button>`;
  };
  const half = (side, index) => `<figure class="duet-ticket__half duet-ticket__half--${index ? 'b' : 'a'}" data-duet-half="${index}">
      <div class="duet-ticket__photo"><img src="${escape(side.src)}" alt="${escape(side.isExample ? `${side.author}选用的 AI 示例照片` : `${side.author}的现场照片`)}" decoding="async" draggable="false">${side.isExample ? '<small class="duet-ticket__ai">AI 示例图</small>' : ''}${side.load ? '<small class="duet-ticket__loading" data-duet-loading>照片读取中</small>' : ''}</div>
      <figcaption><span class="duet-ticket__byline"><b>${escape(side.author)}</b><span>${escape([side.perspective, side.moment].filter(Boolean).join(' · '))}</span></span><p>${escape(side.caption)}</p></figcaption>
    </figure>`;

  const dialog = document.createElement('dialog');
  dialog.className = 'duet-ceremony';
  dialog.dataset.motion = 'self';
  dialog.dataset.mode = mode;
  dialog.dataset.scenario = options.scenario;
  dialog.dataset.phase = 'settled';
  dialog.setAttribute('aria-labelledby', 'duet-ceremony-title');
  dialog.setAttribute('aria-describedby', 'duet-ceremony-status duet-ceremony-event');
  dialog.style.setProperty('--dc-name-scale', nameScale);
  // Long captions (up to 80 characters) take height from the photographs so the actions stay in view.
  const longestCaption = Math.max(...options.sides.map(side => [...String(side.caption || '')].length));
  dialog.dataset.captions = longestCaption > 44 ? 'long' : longestCaption > 22 ? 'medium' : 'short';
  dialog.innerHTML = `<div class="duet-ceremony__sky" aria-hidden="true">
      <span class="duet-ceremony__waves"></span>
      <svg class="duet-ceremony__wire" viewBox="0 0 100 140" preserveAspectRatio="none"><path d="${lights.path}"/></svg>
      <span class="duet-ceremony__bulbs">${lights.bulbs.map(bulb => `<i style="--x:${bulb.x.toFixed(2)}%;--y:${bulb.y.toFixed(1)}px"></i>`).join('')}</span>
    </div>
    <header class="duet-ceremony__bar">
      <span class="duet-ceremony__brand"><b>同一刻，另一面</b><span>双联票根</span></span>
      ${tag ? `<span class="duet-ceremony__tag">${escape(tag)}</span>` : ''}
      <button type="button" class="duet-ceremony__close" data-duet-close aria-label="${escape(options.closeLabel || '关闭')}">${icon('x')}</button>
    </header>
    <div class="duet-ceremony__stage">
      <p class="duet-ceremony__status" id="duet-ceremony-status">${icon('check')}<span>${escape(options.status)}</span>${options.completedAt ? `<time datetime="${escape(options.completedAt)}">${escape(completedLabel(options.completedAt))}</time>` : ''}</p>
      <h2 class="duet-ceremony__names" id="duet-ceremony-title" tabindex="-1"><span class="duet-ceremony__name" data-duet-name="0">${escape(a.author)}</span><span class="duet-ceremony__times" aria-hidden="true">×</span><span class="sr-only">和</span><span class="duet-ceremony__name" data-duet-name="1">${escape(b.author)}</span></h2>
      <p class="duet-ceremony__event" id="duet-ceremony-event"><strong>${escape(eventTitle(options.event))}</strong>${meta ? `<span>${escape(meta)}</span>` : ''}</p>
      <article class="duet-ticket" aria-label="${escape(`${a.author}和${b.author}的双联票根`)}">
        <span class="duet-ticket__shadow" aria-hidden="true"></span>
        <div class="duet-ticket__halves">
          ${half(a, 0)}
          ${half(b, 1)}
          <span class="duet-ticket__seam" aria-hidden="true"></span>
          <span class="duet-ticket__flash" aria-hidden="true"></span>
          <span class="duet-ticket__burst" aria-hidden="true">${PETALS.map(() => '<i></i>').join('')}</span>
        </div>
        <footer class="duet-ticket__stub">
          <div class="duet-ticket__shared"><span class="duet-ticket__label">${escape(options.shared.label)}</span><strong class="duet-ticket__value">${escape(options.shared.value)}</strong></div>
          <span class="duet-ticket__seal" aria-hidden="true"><b>双方同意</b><small>${escape(stampDate(options.completedAt))}</small></span>
        </footer>
      </article>
      ${options.note ? `<p class="duet-ceremony__note">${escape(options.note)}</p>` : ''}
    </div>
    <footer class="duet-ceremony__actions">
      <div class="duet-ceremony__main">${actions.filter(action => ['primary', 'secondary'].includes(action.kind || 'secondary')).map(buttonMarkup).join('')}</div>
      <div class="duet-ceremony__quiet">${actions.filter(action => ['link', 'remove'].includes(action.kind)).map(buttonMarkup).join('')}</div>
      <p class="duet-ceremony__error" role="alert" data-duet-error hidden></p>
    </footer>`;

  const $ = selector => dialog.querySelector(selector);
  const $$ = selector => [...dialog.querySelectorAll(selector)];
  const halves = $$('[data-duet-half]');
  const images = halves.map(element => element.querySelector('img'));
  const errorBox = $('[data-duet-error]');
  let closed = false;
  let timeline = null;
  let failsafe = 0;
  let skippedAt = -Infinity;
  let settled = false;
  const handle = {
    element: dialog,
    get open() { return !closed; },
    close,
  };

  // Private photos arrive as authorized blob URLs; a failure stays visible, never a blank frame.
  const photoReady = options.sides.map((side, index) => {
    const image = images[index];
    const loading = halves[index].querySelector('[data-duet-loading]');
    const decoded = () => new Promise(resolve => {
      if (image.complete && image.naturalWidth > 1) resolve();
      else { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }
    });
    if (!side.load) return decoded();
    return Promise.resolve().then(side.load).then(url => {
      if (closed) return;
      image.src = url;
      loading?.remove();
      return decoded();
    }).catch(() => {
      if (closed || !loading) return;
      loading.textContent = '照片暂未读到 · 可稍后重试';
      image.alt = `${side.author}的照片暂时无法读取`;
    });
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
    // Short phones keep the message in the page flow under the sticky buttons; bring it above them.
    if (message) errorBox.scrollIntoView({ block: 'nearest' });
  }

  async function runAction(button) {
    const action = actions.find(item => item.id === button.dataset.duetAction);
    if (!action || button.getAttribute('aria-disabled') === 'true') return;
    const label = button.querySelector('span');
    const original = label.textContent;
    showError('');
    // aria-disabled keeps focus on the button, so a preview opened from it hands focus back here.
    if (action.busyLabel) { button.setAttribute('aria-disabled', 'true'); button.setAttribute('aria-busy', 'true'); label.textContent = action.busyLabel; }
    try { await action.run({ close, showError }); }
    catch (error) {
      if (!closed && error?.name !== 'AbortError') showError(error instanceof TypeError ? '暂时没有连上，请稍后再试。' : error?.message || '这次没有完成，请再试一次。');
    } finally {
      if (!closed && action.busyLabel) { button.removeAttribute('aria-disabled'); button.removeAttribute('aria-busy'); label.textContent = original; }
    }
  }

  function settle() {
    clearTimeout(failsafe);
    if (closed || settled) return;
    settled = true;
    // A failsafe may fire while a hidden tab has paused the ticker: jump to the end silently.
    if (timeline && timeline.progress() < 1) timeline.progress(1, true);
    timeline?.kill();
    timeline = null;
    dialog.dataset.phase = 'settled';
    gsap.set(dialog.querySelectorAll('[data-duet-motion]'), { clearProps: 'transform,opacity,clipPath,visibility' });
    dialog.querySelectorAll('[data-duet-motion]').forEach(element => element.removeAttribute('data-duet-motion'));
  }

  function skip() {
    if (!timeline || dialog.dataset.phase !== 'playing') return;
    skippedAt = performance.now();
    timeline.progress(1);
  }

  function onReducedChange() { if (reduced.matches) timeline?.progress(1); }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(failsafe);
    timeline?.kill();
    timeline = null;
    reduced.removeEventListener('change', onReducedChange);
    window.removeEventListener('popstate', close);
    window.removeEventListener('pagehide', close);
    if (dialog.open) dialog.close();
    dialog.remove();
    if (active === handle) active = null;
    options.onClose?.();
  }

  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-duet-close]')) { close(); return; }
    const button = event.target.closest('[data-duet-action]');
    // A tap that skipped the premiere must not also press the control that appeared under it.
    if (button && performance.now() - skippedAt > 350) runAction(button);
  });
  dialog.addEventListener('pointerdown', skip);
  dialog.addEventListener('keydown', event => { if (event.key !== 'Escape') skip(); });
  dialog.addEventListener('close', close);
  reduced.addEventListener('change', onReducedChange);
  window.addEventListener('popstate', close);
  window.addEventListener('pagehide', close);

  const motionTargets = {
    sky: $('.duet-ceremony__sky'),
    waves: $('.duet-ceremony__waves'),
    wire: $('.duet-ceremony__wire'),
    bulbs: $$('.duet-ceremony__bulbs i'),
    status: $('.duet-ceremony__status'),
    names: $$('[data-duet-name]'),
    times: $('.duet-ceremony__times'),
    event: $('.duet-ceremony__event'),
    ticket: $('.duet-ticket'),
    shadow: $('.duet-ticket__shadow'),
    seam: $('.duet-ticket__seam'),
    flash: $('.duet-ticket__flash'),
    petals: $$('.duet-ticket__burst i'),
    stub: $('.duet-ticket__stub'),
    seal: $('.duet-ticket__seal'),
    note: $('.duet-ceremony__note'),
    actions: [...$$('.duet-ceremony__main > *'), ...$$('.duet-ceremony__quiet > *')],
  };
  const animated = Object.values(motionTargets).flat().filter(Boolean);
  // The ticket frame only bumps; its halves carry the entrance. Flash and petals rest invisible in CSS.
  const keepOpacity = [motionTargets.ticket, motionTargets.flash, ...motionTargets.petals];

  document.body.append(dialog);
  active = handle;
  // Development-only handle for frame-by-frame review of the premiere.
  if (import.meta.env?.DEV) window.__duetCeremony = { get timeline() { return timeline; }, dialog };
  const playing = mode === 'reveal' && !reduced.matches;
  if (playing) {
    dialog.dataset.phase = 'playing';
    animated.forEach(element => element.setAttribute('data-duet-motion', ''));
    gsap.set(animated.filter(element => !keepOpacity.includes(element)), { opacity: 0 });
  }
  dialog.showModal();
  // Start on the names, not on the close control: readers hear who shared the night; Tab reaches the actions next.
  $('#duet-ceremony-title').focus({ preventScroll: true });
  if (reduced.matches) return handle;

  if (!playing) {
    // Revisit: the halves settle in briefly; nothing is hidden while waiting.
    animated.forEach(element => element.setAttribute('data-duet-motion', ''));
    const [halfA, halfB] = halves;
    timeline = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: settle })
      .fromTo(halfA, { x: -32, opacity: 0 }, { x: 0, opacity: 1, duration: .5 }, 0)
      .fromTo(halfB, { x: 32, opacity: 0 }, { x: 0, opacity: 1, duration: .5 }, .04)
      .fromTo(motionTargets.names[0], { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: .45 }, .02)
      .fromTo(motionTargets.names[1], { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: .45 }, .06)
      .fromTo(motionTargets.stub, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .35 }, .2);
    failsafe = setTimeout(settle, 2000);
    return handle;
  }

  // Premiere: string lights come up, the two photographs travel in from either side and close into one ticket.
  const ready = Promise.race([Promise.all(photoReady), new Promise(resolve => setTimeout(resolve, 650))]);
  ready.then(() => {
    if (closed || dialog.dataset.phase !== 'playing') return;
    const t = motionTargets;
    const [halfA, halfB] = halves;
    const boxA = halfA.getBoundingClientRect();
    const boxB = halfB.getBoundingClientRect();
    const offA = -(boxA.right + 40);
    const offB = innerWidth - boxB.left + 40;
    const spread = Math.min(1, innerWidth / 1100);
    timeline = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: settle })
      .fromTo(t.sky, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power1.out' }, 0)
      .fromTo(t.wire, { opacity: 0 }, { opacity: 1, duration: .6 }, .05)
      .fromTo(t.bulbs, { opacity: 0, scale: .3 }, { opacity: 1, scale: 1, duration: .3, stagger: { each: .03, from: 'center' }, ease: 'back.out(3)' }, .12)
      .fromTo(t.status, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .4 }, .22)
      .fromTo(halfA, { x: offA, y: 18, rotate: -9, opacity: 1 }, { x: -16, y: 0, rotate: -1.6, duration: .8 }, .3)
      .fromTo(halfB, { x: offB, y: 18, rotate: 9, opacity: 1 }, { x: 16, y: 0, rotate: 1.6, duration: .8 }, .4)
      .fromTo(t.names[0], { x: -90 * spread, opacity: 0 }, { x: 0, opacity: 1, duration: .75 }, .34)
      .fromTo(t.names[1], { x: 90 * spread, opacity: 0 }, { x: 0, opacity: 1, duration: .75 }, .44)
      .to([halfA, halfB], { x: 0, rotate: 0, duration: .2, ease: 'power2.in' }, 1.18)
      .fromTo(t.ticket, { scale: 1 }, { scale: 1.014, duration: .09, ease: 'power1.out', yoyo: true, repeat: 1 }, 1.38)
      .fromTo(t.flash, { opacity: .95, scaleY: .2 }, { opacity: 0, scaleY: 1, duration: .7, ease: 'power2.out', immediateRender: false }, 1.38)
      .fromTo(t.seam, { scaleY: 0, opacity: 1 }, { scaleY: 1, duration: .4, ease: 'power2.out' }, 1.38)
      .fromTo(t.times, { scale: .2, rotate: -60, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: .45, ease: 'back.out(3)' }, 1.38)
      .fromTo(t.petals, { x: 0, y: 0, rotate: 0, scale: .5, opacity: 1 }, {
        x: index => PETALS[index][0] * spread, y: index => PETALS[index][1] - 30, rotate: index => PETALS[index][2], scale: 1, opacity: 0,
        duration: 1.5, ease: 'power2.out', stagger: .012, immediateRender: false,
      }, 1.4)
      .fromTo(t.shadow, { opacity: 0 }, { opacity: 1, duration: .6 }, 1.85)
      .fromTo(t.waves, { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.4, ease: 'power2.out' }, 1.38)
      .fromTo(t.event, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .45 }, 1.5)
      .fromTo(t.stub, { y: -12, opacity: 1, clipPath: 'inset(0 0 100% 0)' }, { y: 0, clipPath: 'inset(0 0 0% 0)', duration: .5, ease: 'power2.out' }, 1.56)
      .fromTo(t.seal, { scale: 1.9, rotate: -32, opacity: 0 }, { scale: 1, rotate: -8, opacity: 1, duration: .42, ease: 'back.out(2)' }, 1.9)
      .fromTo([...t.actions, t.note].filter(Boolean), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .38, stagger: .05 }, 2.0);
    clearTimeout(failsafe);
    if (import.meta.env?.DEV && window.__duetHold) timeline.pause(0);
    else failsafe = setTimeout(settle, 5200);
  });
  if (!(import.meta.env?.DEV && window.__duetHold)) failsafe = setTimeout(settle, 6000);
  return handle;
}

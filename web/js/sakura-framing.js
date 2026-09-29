// Paper that the camera frames around. The record shop's catalogue menu is temporary
// and deliberately absent, so opening it never moves the table.
const WATCH = [
  '.app-masthead', '.brand', '.masthead-tools', '.mobile-nav', '.world-compass', '.world-caption',
  '.map-studio-head', '.map-studio-title', '.map-studio-tools', '.map-stage-top',
  '.map-round-slip', '.map-round-tools', '.map-round-note', '.map-round-hand',
  '.map-studio-dock', '.map-undo',
  // The Map home reuses the courtyard cover: its headline and the compact paper.
  '.home-paper', '.home-hero',
  '.main-content', 'dialog[open]',
].join(',');
/** Height ÷ width beyond which the record table turns lengthwise (sakura-camera uses the same rule). */
export const TALL_EXPLORE = 2.3;
const INK = '.brand,.masthead-tools,.world-caption,.world-compass,.mobile-nav,.home-hero';
const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
const overlapsAround = (a, b, across, along) => a.left < b.right + across && a.right > b.left - across && a.top < b.bottom + along && a.bottom > b.top - along;
/** The smallest touch target a scene tag may have. */
const TOUCH = 44;
const rectangle = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const intersects = (a, b) => rectangle(Math.max(a.left, b.left), Math.max(a.top, b.top), Math.min(a.right, b.right), Math.min(a.bottom, b.bottom));

/** Find usable room between actual paper controls. DOM reads happen on layout changes only. */
export function createSakuraFraming(host, { getShot, onChange, onLabelsChange }) {
  const observed = new Set(); const labelSizes = new Map(); const occupied = [];
  let frame = 0; let finalDialogMeasure = 0; let disposed = false; let labelDirty = false;
  let layout = { key: '', width: 1, height: 1, rect: rectangle(0, 0, 1, 1), room: rectangle(0, 0, 1, 1), obstacles: [], blocked: false };
  let signature = '';
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      if (!labelSizes.has(entry.target)) continue;
      const box = entry.borderBoxSize?.[0];
      if (box?.inlineSize && box.blockSize) { labelSizes.set(entry.target, { width: box.inlineSize, height: box.blockSize }); labelDirty = true; }
    }
    schedule();
  });
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(() => { frame = 0; measure(getShot(), true); }); }
  function painted(element, style) {
    if (element.matches(INK) || element.matches('dialog[open]')) return true;
    if (element.matches('.main-content') && style.pointerEvents === 'none') return false;
    if (style.backgroundImage !== 'none') return true;
    const color = style.backgroundColor;
    return color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)' && !/rgba\([^)]*,\s*0\)$/.test(color);
  }
  function safeRectangle(base, obstacles, key, mobile, layoutWidth = base.width, layoutHeight = base.height) {
    const clampX = value => Math.max(base.left, Math.min(base.right, value));
    const horizontal = [...new Set([base.left, base.right, ...obstacles.flatMap(item => [clampX(item.left - 9), clampX(item.right + 9)])])].sort((a, b) => a - b);
    // A very tall screen turns the record table lengthwise (see sakura-camera), so it wants a tall frame.
    const tall = key === 'explore' && layoutHeight > layoutWidth * TALL_EXPLORE;
    const desired = tall ? .7 : ({ explore: 1.5, home: 1.7, records: .8 })[key] || 1.3;
    const minWidth = mobile ? base.width * .7 : Math.min(340, base.width * .42);
    let best = null; let bestScore = -1;
    for (let leftIndex = 0; leftIndex < horizontal.length - 1; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < horizontal.length; rightIndex++) {
      const left = horizontal[leftIndex]; const right = horizontal[rightIndex]; const width = right - left;
      if (width < minWidth) continue;
      const bands = obstacles.filter(item => item.left - 9 < right && item.right + 9 > left)
        .map(item => [Math.max(base.top, item.top - 9), Math.min(base.bottom, item.bottom + 9)]).filter(item => item[1] > item[0]).sort((a, b) => a[0] - b[0]);
      let top = base.top;
      for (const [start, end] of [...bands, [base.bottom, base.bottom]]) {
        if (start > top) {
          const candidate = rectangle(left, top, right, start); const height = candidate.height;
          if (height >= (mobile ? 92 : 130)) {
            const useful = Math.min(width, height * desired) * Math.min(height, width / desired);
            const centerPenalty = 1 - .12 * Math.abs((left + right) / 2 - (base.left + base.right) / 2) / base.width;
            const score = useful * centerPenalty + width * height * .12;
            if (score > bestScore) { best = candidate; bestScore = score; }
          }
        }
        top = Math.max(top, end);
      }
    }
    return best;
  }
  function measure(key = getShot(), notify = false) {
    if (disposed) return layout;
    const bounds = host.getBoundingClientRect(); const width = Math.max(1, bounds.width); const height = Math.max(1, bounds.height);
    const elements = new Set(document.querySelectorAll(WATCH));
    for (const element of observed) if (!elements.has(element)) { observer.unobserve(element); observed.delete(element); }
    for (const element of elements) if (!observed.has(element)) { observed.add(element); observer.observe(element); }
    const obstacles = [];
    for (const element of elements) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.hidden || !painted(element, style)) continue;
      const box = element.getBoundingClientRect(); if (box.width < 2 || box.height < 2) continue;
      const clipped = intersects(rectangle(box.left - bounds.left, box.top - bounds.top, box.right - bounds.left, box.bottom - bounds.top), rectangle(0, 0, width, height));
      if (clipped.width > 0 && clipped.height > 0) obstacles.push(clipped);
    }
    const margin = width <= 760 ? 12 : 20;
    const base = rectangle(margin, margin, width - margin, height - margin);
    const nextRect = safeRectangle(base, obstacles, key, width <= 760, width, height);
    const previousFits = layout.key === key && layout.width === width && layout.height === height;
    const rect = nextRect || (previousFits ? layout.rect : base);
    const next = { key, width, height, rect, room: base, obstacles, blocked: !nextRect };
    const nextSignature = JSON.stringify([key, Math.round(width), Math.round(height), ...[rect.left, rect.top, rect.right, rect.bottom].map(Math.round), ...obstacles.flatMap(item => [item.left, item.top, item.right, item.bottom].map(Math.round)), next.blocked]);
    const changed = nextSignature !== signature; signature = nextSignature; layout = next;
    if (notify && changed) onChange?.(layout);
    else if (notify && labelDirty) onLabelsChange?.();
    labelDirty = false; return layout;
  }
  const mutations = new MutationObserver(records => {
    const relevant = records.some(record => !host.contains(record.target) && (record.type !== 'attributes' || record.attributeName !== 'class' || !record.target.matches('.icon')));
    if (!relevant) return;
    schedule();
    // Dialog intro changes only transform; measure its settled position once.
    if (records.some(record => record.attributeName === 'open' || record.type === 'childList') && document.querySelector('dialog[open]')) {
      clearTimeout(finalDialogMeasure); finalDialogMeasure = setTimeout(schedule, 420);
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class', 'data-view', 'data-spatial-section'] });
  window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true); document.addEventListener('toggle', schedule, true);
  window.visualViewport?.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  function watchLabel(button) {
    labelSizes.set(button, null); observer.observe(button);
    return () => { observer.unobserve(button); labelSizes.delete(button); };
  }
  function labelSize(button) {
    const cached = labelSizes.get(button); if (cached) return cached;
    const selected = button.classList.contains('is-selected');
    const text = button.querySelector('strong')?.textContent || button.textContent || '';
    const mobile = layout.width <= 760;
    if (button.classList.contains('world-music-label--node')) {
      // Estimates of the painted tag until ResizeObserver reports the real one (the touch band around it
      // is invisible and not measured): 14/16px desktop plus a 12px 终点/你在这里 tab; a phone prints the name only.
      const font = mobile ? (selected ? 14 : 13) : (selected ? 16 : 14);
      const tag = mobile ? '' : button.querySelector('small')?.textContent || '';
      const tagWidth = tag ? tag.length * 12.5 + 12 : 0;
      return { width: Math.min(mobile ? 148 : 190, Math.max(mobile ? 44 : 56, text.length * (font + .5) + tagWidth + (mobile ? 16 : 24))), height: selected ? (mobile ? 31 : 38) : (mobile ? 29 : 32) };
    }
    if (button.classList.contains('world-music-link')) {
      return { width: Math.min(mobile ? 132 : 180, Math.max(48, text.length * (mobile ? 12 : 13) + 20)), height: mobile ? 24 : 26 };
    }
    return { width: Math.min(180, Math.max(56, text.length * (mobile ? 12.5 : 13.5) + (mobile ? 40 : 46))), height: selected ? 44 : (mobile ? 32 : 34) };
  }
  /** A tag stays inside the framed room; with `loose` it may use any free pocket of the screen (still
   *  clear of every control), such as the corner beside a short tool strip. */
  function placeLabel(button, x, y, anchor = 'top', avoid = null, loose = false) {
    const size = labelSize(button);
    const top = anchor === 'bottom' ? y - size.height : anchor === 'center' ? y - size.height / 2 : y;
    const box = rectangle(x - size.width / 2, top, x + size.width / 2, top + size.height);
    const room = loose ? layout.room : layout.rect;
    if (layout.blocked || box.left < room.left || box.right > room.right || box.top < room.top || box.bottom > room.bottom) return false;
    // Above and below, a tag keeps the room its 44px touch band needs (sakura-music fitTouchBands splits
    // each gap half and half), so a short paper tag is still a full target; beside, 3px is enough.
    const clearance = item => Math.max(3, TOUCH - Math.min(size.height, item.height) + 1);
    if (layout.obstacles.some(item => overlaps(box, item, 4)) || occupied.some(item => overlapsAround(box, item, 3, clearance(item)))) return false;
    if (avoid?.some(item => overlaps(box, item, 2))) return false;
    occupied.push(box); return true;
  }
  schedule();
  return {
    measure, schedule, watchLabel, labelSize, placeLabel, beginLabels() { occupied.length = 0; },
    // A caller may try several arrangements: mark the tags placed so far, then drop the ones after it.
    labelMark() { return occupied.length; }, rewindLabels(mark) { occupied.length = Math.min(occupied.length, mark); },
    get(key) { return layout.key === key ? layout : measure(key); }, get layout() { return layout; },
    dispose() { disposed = true; cancelAnimationFrame(frame); clearTimeout(finalDialogMeasure); mutations.disconnect(); observer.disconnect();
      window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true); document.removeEventListener('toggle', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule); observed.clear(); labelSizes.clear();
    },
  };
}

import * as THREE from 'three';
import { gsap } from 'gsap';
import { TALL_EXPLORE } from './sakura-framing.js';

const desktop = {
  home: { eye: [10.7, 8.6, 16.5], at: [-.35, 1.0, -.1], fov: 40 },
  explore: { eye: [.25, 8.35, .16], at: [0, 1.22, -1.3], fov: 42 },
  records: { eye: [-.6, 2.4, 1.3], at: [1.3, 1.25, -2.3], fov: 46 },
};
const portrait = {
  home: { eye: [12, 18, 29], at: [-.8, .8, .3], fov: 43 },
  explore: { eye: [.08, 12, 1.4], at: [0, 1.22, -1.3], fov: 45 },
  records: { eye: [-.55, 2.4, 2.8], at: [1.2, 1.25, -2.3], fov: 46 },
};

const tallExplore = { eye: [-2.62, 12, -1.22], at: [0, 1.22, -1.3], fov: 45 };

/** One interruptible camera move; a cancelled trip cannot open a stale modal. */
export function createCameraDirector(camera, { size, reduced, onFrame, onShot, getLayout, getBounds }) {
  const target = new THREE.Vector3();
  const framing = { x: 0, y: 0 };
  let tween;
  let settle;
  let pending = Promise.resolve(true);
  let active = { key: 'home' };
  let navigationMove = false;
  function projection() {
    const { width, height } = size();
    camera.aspect = width / height;
    camera.setViewOffset(width, height, width * framing.x, height * framing.y, width, height);
    camera.updateProjectionMatrix();
  }
  function stop() { tween?.kill(); tween = null; navigationMove = false; settle?.(false); settle = null; }
  function destination() {
    const { key } = active;
    const { width, height } = size();
    const mobile = width <= 760;
    // Only a very tall screen looks at the record table from the west, so its long side runs down the screen.
    // The free room between a phone's header tools and its dock or hand is wider than tall on common phones
    // (measured 2026-09-29: 390×844 roam 366×319, 360×740 roam 336×215), where the lengthwise table printed
    // up to a third smaller. Decided by the viewport only (same rule as sakura-framing), so opening paper, or
    // switching between 寻声 and 完整图鉴, never turns the table.
    const tall = key === 'explore' && height > width * TALL_EXPLORE;
    const shots = mobile ? portrait : desktop;
    // An unknown key frames the courtyard rather than a stop that no longer exists.
    const shot = tall ? tallExplore : shots[key] || shots.home;
    const endTarget = new THREE.Vector3(...shot.at);
    const endEye = new THREE.Vector3(...shot.eye);
    const endFov = shot.fov;
    const layout = getLayout(key); const rect = layout.rect;
    // A phone's record table is framed by its paper (sakura-scene), edge to edge of the free room: the
    // room already keeps 9px from every control, and name tags may lie on the rim beyond the paper.
    const paperOnly = key === 'explore' && mobile;
    const sidePadding = paperOnly ? 4 : 12; const topPadding = paperOnly ? 4 : 12;
    const bottomPadding = key === 'explore' ? (mobile ? 6 : 24) : 14;
    const fitWidth = Math.max(1, rect.width - sidePadding * 2); const fitHeight = Math.max(1, rect.height - topPadding - bottomPadding);
    const centerX = (rect.left + rect.right) / 2; const centerY = (rect.top + topPadding + rect.bottom - bottomPadding) / 2;
    const endFrame = { x: .5 - centerX / width, y: .5 - centerY / height };
    const bounds = getBounds(key);
    if (bounds && !bounds.isEmpty()) {
      const backward = endEye.clone().sub(endTarget).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, backward).normalize();
      const up = new THREE.Vector3().crossVectors(backward, right).normalize();
      const baseDistance = endEye.distanceTo(endTarget);
      bounds.getCenter(endTarget);
      const tanY = Math.tan(THREE.MathUtils.degToRad(endFov / 2)) * fitHeight / height;
      const tanX = Math.tan(THREE.MathUtils.degToRad(endFov / 2)) * width / height * fitWidth / width;
      let distance = baseDistance * .6;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(endTarget);
        const depth = corner.dot(backward);
        distance = Math.max(distance, Math.abs(corner.dot(right)) / tanX + depth, Math.abs(corner.dot(up)) / tanY + depth);
      }
      endEye.copy(endTarget).addScaledVector(backward, distance * 1.025);
    }
    return { eye: endEye, target: endTarget, fov: endFov, frame: endFrame };
  }
  function arrive(end) {
    camera.position.copy(end.eye); target.copy(end.target); camera.fov = end.fov;
    Object.assign(framing, end.frame); camera.lookAt(target); projection(); onFrame();
  }
  function animate(end, duration) {
    const startEye = camera.position.clone();
    const startTarget = target.clone();
    const startFov = camera.fov;
    const startFrame = { ...framing };
    const midpoint = startEye.clone().lerp(end.eye, .5);
    if (navigationMove) midpoint.y += Math.min(.85, startEye.distanceTo(end.eye) * .09);
    const path = new THREE.QuadraticBezierCurve3(startEye, midpoint, end.eye);
    const progress = { value: 0 };
    tween = gsap.to(progress, { value: 1, duration, ease: navigationMove ? 'power2.inOut' : 'power2.out',
      onUpdate() {
        const t = progress.value;
        camera.position.copy(path.getPoint(t)); target.lerpVectors(startTarget, end.target, t); camera.lookAt(target);
        camera.fov = THREE.MathUtils.lerp(startFov, end.fov, t);
        framing.x = THREE.MathUtils.lerp(startFrame.x, end.frame.x, t); framing.y = THREE.MathUtils.lerp(startFrame.y, end.frame.y, t);
        projection(); onFrame();
      },
      onComplete() { tween = null; const wasNavigation = navigationMove; navigationMove = false;
        if (wasNavigation) onShot(active.key, false); settle?.(true); settle = null;
      },
    });
  }
  function go(key, { immediate = false, force = false } = {}) {
    if (!force && active.key === key) return pending;
    stop(); active = { key };
    navigationMove = !immediate && !reduced.matches;
    onShot(key, navigationMove);
    const end = destination();
    if (!navigationMove) { arrive(end); onShot(key, false); pending = Promise.resolve(true); return pending; }
    pending = new Promise(resolve => { settle = resolve; });
    animate(end, 1.05); return pending;
  }
  function reframe(immediate = false) {
    if (getLayout(active.key).blocked) { projection(); onFrame(); return pending; }
    const end = destination(); tween?.kill(); tween = null;
    if (immediate || reduced.matches) {
      arrive(end); if (navigationMove) onShot(active.key, false);
      navigationMove = false; settle?.(true); settle = null;
    } else animate(end, navigationMove ? .4 : .28);
    return pending;
  }
  return {
    go,
    reframe,
    resize() { return reframe(true); },
    finish() { tween?.progress(1); },
    get moving() { return Boolean(tween); },
    get travelling() { return navigationMove; },
    get active() { return active; },
    dispose: stop,
  };
}

import * as THREE from 'three';
import { gsap } from 'gsap';

const desktop = {
  home: { eye: [10.7, 8.6, 16.5], at: [-.35, 1.0, -.1], fov: 40 },
  explore: { eye: [.25, 8.35, .16], at: [0, 1.22, -1.3], fov: 42 },
  live: { eye: [-.6, 3.6, 7.1], at: [-3.8, 1.6, 1.4], fov: 40 },
  editor: { eye: [7.2, 5.6, 5.5], at: [4, 1, 1.6], fov: 37 },
  records: { eye: [-.6, 2.4, 1.3], at: [1.3, 1.25, -2.3], fov: 46 },
};
const portrait = {
  home: { eye: [12, 18, 29], at: [-.8, .8, .3], fov: 43 },
  explore: { eye: [.08, 12, 1.4], at: [0, 1.22, -1.3], fov: 45 },
  live: { eye: [-3, 4.4, 10.8], at: [-3.8, 1.5, 1.4], fov: 48 },
  editor: { eye: [6.6, 5.5, 6.6], at: [4, 1, 1.6], fov: 43 },
  records: { eye: [-.55, 2.4, 2.8], at: [1.2, 1.25, -2.3], fov: 46 },
};

/** One interruptible camera move; a cancelled trip cannot open a stale modal. */
export function createCameraDirector(camera, { size, reduced, onFrame, onShot }) {
  const target = new THREE.Vector3();
  const framing = { x: 0, y: 0 };
  let tween;
  let settle;
  let pending = Promise.resolve(true);
  let active = { key: 'home', id: null, point: null };
  function projection() {
    const { width, height } = size();
    camera.aspect = width / height;
    camera.setViewOffset(width, height, width * framing.x, height * framing.y, width, height);
    camera.updateProjectionMatrix();
  }
  function stop() { tween?.kill(); tween = null; settle?.(false); settle = null; }
  function go(key, { point = null, id = null, immediate = false, force = false } = {}) {
    if (!force && active.key === key && active.id === id) return pending;
    stop();
    active = { key, id, point: point?.clone() || null };
    const { width } = size();
    const mobile = width <= 760;
    const shot = (mobile ? portrait : desktop)[key] || desktop.live;
    const endTarget = point?.clone() || new THREE.Vector3(...shot.at);
    const endEye = point ? point.clone().add(new THREE.Vector3(mobile ? .65 : 1.35, mobile ? .65 : .8, mobile ? 4.6 : 3.7)) : new THREE.Vector3(...shot.eye);
    const endFov = point ? 39 : shot.fov;
    const endFrame = key === 'explore'
      ? { x: 0, y: .055 }
      : mobile ? { x: 0, y: key === 'home' ? .045 : key === 'live' ? .08 : .24 } : { x: key === 'home' ? 0 : .18, y: 0 };
    onShot(key, id, !immediate && !reduced.matches);
    if (immediate || reduced.matches) {
      camera.position.copy(endEye); target.copy(endTarget); camera.fov = endFov;
      Object.assign(framing, endFrame); camera.lookAt(target); projection(); onFrame();
      onShot(key, id, false); pending = Promise.resolve(true); return pending;
    }
    const startEye = camera.position.clone();
    const startTarget = target.clone();
    const startFov = camera.fov;
    const startFrame = { ...framing };
    const midpoint = startEye.clone().lerp(endEye, .5);
    midpoint.y += Math.min(.85, startEye.distanceTo(endEye) * .09);
    const path = new THREE.QuadraticBezierCurve3(startEye, midpoint, endEye);
    const progress = { value: 0 };
    pending = new Promise(resolve => { settle = resolve; });
    tween = gsap.to(progress, { value: 1, duration: key === 'photo' ? .82 : 1.05, ease: 'power2.inOut',
      onUpdate() {
        const t = progress.value;
        camera.position.copy(path.getPoint(t)); target.lerpVectors(startTarget, endTarget, t); camera.lookAt(target);
        camera.fov = THREE.MathUtils.lerp(startFov, endFov, t);
        framing.x = THREE.MathUtils.lerp(startFrame.x, endFrame.x, t); framing.y = THREE.MathUtils.lerp(startFrame.y, endFrame.y, t);
        projection(); onFrame();
      },
      onComplete() { tween = null; onShot(key, id, false); settle?.(true); settle = null; },
    });
    return pending;
  }
  return {
    go,
    resize() { return go(active.key, { ...active, immediate: true, force: true }); },
    finish() { tween?.progress(1); },
    get moving() { return Boolean(tween); },
    get active() { return active; },
    dispose: stop,
  };
}

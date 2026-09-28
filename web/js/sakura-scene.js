import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildSakuraWorld } from './sakura-world.js';
import { batchStaticMeshes } from './sakura-batch.js';
import { createCameraDirector } from './sakura-camera.js';
import { createSakuraMusic } from './sakura-music.js';
import { createSakuraFraming } from './sakura-framing.js';
import { createCelMaterials } from './vendor/sakura/toon.js';
import { Pipeline } from './vendor/sakura/post.js';

// Night venue values live here so the vendored palette stays untouched.
const NIGHT = {
  fog: '#4b3f72', hemiSky: '#6f7fc0', hemiGround: '#4a2f4f', moon: '#b9c6ff', fill: '#ffb08a',
  lamp: '#ffc98a', bulb: '#ffcf8a', stage: '#ffc4a8', table: '#fff4e6', ink: '#1d1a33', gradeShadow: '#e3e4f7', clear: '#2a2750',
  // v=.5 is the horizon; the warm band sits just behind the far hills.
  sky: [[0, '#0e1233'], [.3, '#141a40'], [.45, '#1d2150'], [.5, '#2e2a5e'], [.51, '#4a3c78'], [.525, '#9a5a86'], [.54, '#e0907e'], [.56, '#8a587e'], [.58, '#4b3f72'], [1, '#2a2750']],
};
// Only intensities change at runtime: adding or hiding a light would recompile every material.
const PRESETS = {
  night: { hemi: 1.35, sun: .85, fill: .32, shopGlow: 7, festoonL: 6, festoonR: 6, stageSpot: 48, tableSpot: 0 },
  explore: { hemi: 1.2, sun: .3, fill: .2, shopGlow: 0, festoonL: 6, festoonR: 6, stageSpot: 48, tableSpot: 190 },
  records: { hemi: 1.35, sun: .7, fill: .3, shopGlow: 6.5, festoonL: 6, festoonR: 6, stageSpot: 48, tableSpot: 0 },
};
// The shop light hangs by the door at night and under the right pendant, over the cabinet, in the records view.
const SHOP_GLOW_AT = { night: [0, 2.35, -.55], explore: [0, 2.35, -.55], records: [1.15, 2.3, -1.05] };
// The courtyard has three camera stops, one per route. Retired routes land in the courtyard.
const SHOTS = new Set(['home', 'explore', 'records']);
const LEGACY_SHOTS = { space: 'home', live: 'home' };
const shotFor = (view, fallback = 'home') => LEGACY_SHOTS[view] || (SHOTS.has(view) ? view : fallback);
let introPlayed = false;

/** Original music street, rendered with Sakura Crossing's MIT cel/ink pipeline. */
export function mountSakuraScene(host, { onAction, view = 'home', onShot } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'low-power' });
  } catch {
    host.classList.add('sakura-scene--fallback');
    const fallback = document.createElement('div');
    fallback.className = 'sakura-scene__fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.innerHTML = '<span></span>';
    host.append(fallback);
    document.body.classList.add('spatial-fallback');
    return { setView: () => Promise.resolve(true), setContent() {}, setMusic() {}, musicControl() {}, focus: () => Promise.resolve(true), restore: () => Promise.resolve(true), dispose() { fallback.remove(); host.classList.remove('sakura-scene--fallback'); document.body.classList.remove('spatial-fallback'); } };
  }

  host.classList.add('sakura-scene');
  const canvas = renderer.domElement;
  canvas.className = 'sakura-scene__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '夜晚的樱下音乐小院，串灯亮着，唱片店开着门。可通过物件标记或下方导航前往小院、唱片店与我的发现。');
  host.append(canvas);
  const compass = document.createElement('nav');
  compass.className = 'world-compass';
  compass.setAttribute('aria-label', '音乐小院');
  compass.innerHTML = '<div><button data-world-view="home">小院</button><button data-world-view="explore">唱片店</button><button data-world-view="records">我的发现</button></div>';
  host.append(compass);
  compass.addEventListener('click', event => {
    const button = event.target.closest('button[data-world-view]');
    if (button) onAction?.({ type: 'navigate', view: button.dataset.worldView });
  });
  const hotspots = document.createElement('div'); hotspots.className = 'world-hotspots'; host.append(hotspots);
  const caption = document.createElement('div'); caption.className = 'world-caption';
  caption.innerHTML = '<strong>小院</strong>';
  host.append(caption);
  renderer.setClearColor(NIGHT.clear, 1);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(NIGHT.fog, 24, 46);
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 80);
  camera.position.set(8.5, 6.6, 13);
  camera.lookAt(0, 1.55, 0);
  const world = new THREE.Group();
  scene.add(world);
  const textures = new Set();
  const geometries = new Set();
  const materials = new Set();
  // A world-fixed equirectangular sky: the horizon glow follows the camera's pitch.
  const skySurface = document.createElement('canvas');
  skySurface.width = 4; skySurface.height = 256;
  const skyContext = skySurface.getContext('2d');
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 256);
  NIGHT.sky.forEach(([stop, color]) => skyGradient.addColorStop(stop, color));
  skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 4, 256);
  const skyTexture = new THREE.CanvasTexture(skySurface);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  textures.add(skyTexture); scene.background = skyTexture;
  const celMaterials = createCelMaterials();
  const palette = {
    cream: '#f2e7d3', plaster: '#faf6ef', sand: '#e3ddd8', green: '#42696a',
    leaf: '#6b9694', mint: '#b0c5ab', rose: '#fbc6d8', blush: '#fedde2',
    petal: '#fff0f4', coral: '#d28091', wood: '#ac8480', ink: '#39324f',
    glass: '#94baca', black: '#3c394c', gold: '#e8c576', road: '#a4a2b8',
  };
  const toon = Object.fromEntries(Object.entries(palette).map(([name, color]) => {
    const material = celMaterials.cel({ color, bands: ['rose', 'blush', 'petal'].includes(name) ? 'soft' : 3, flat: false });
    return [name, material];
  }));
  const geometry = item => { geometries.add(item); return item; };
  const boxGeo = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinderGeo = geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
  const sphereGeo = geometry(new THREE.SphereGeometry(1, 20, 14));

  function mesh(shape, material, position, scale = [1, 1, 1], parent = world) {
    const item = new THREE.Mesh(shape, material);
    item.position.set(...position);
    item.scale.set(...scale);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    // The ink pass draws silhouettes and creases from depth; no wireframe edges.
    return item;
  }
  const box = (position, scale, material = toon.cream, parent = world) => mesh(boxGeo, material, position, scale, parent);
  const cylinder = (position, scale, material = toon.green, parent = world) => mesh(cylinderGeo, material, position, scale, parent);
  const ball = (position, scale, material = toon.rose, parent = world) => mesh(sphereGeo, material, position, scale, parent);
  function rod(a, b, radius, material = toon.wood, parent = world) {
    const from = new THREE.Vector3(...a); const to = new THREE.Vector3(...b);
    const item = cylinder(from.clone().add(to).multiplyScalar(.5).toArray(), [radius, from.distanceTo(to), radius], material, parent);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    return item;
  }
  function label(text, width, height, color, background) {
    const surface = document.createElement('canvas'); surface.width = 768; surface.height = 192;
    const context = surface.getContext('2d');
    context.fillStyle = background; context.fillRect(0, 0, 768, 192);
    context.fillStyle = color; context.font = '800 75px Arial, "Microsoft YaHei", sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 384, 101, 705);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture }); materials.add(material);
    return mesh(geometry(new THREE.PlaneGeometry(width, height)), material, [0, 0, 0]);
  }

  // Eight permanent lights. The moon is the only shadow caster and never moves.
  const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, PRESETS.night.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(NIGHT.moon, PRESETS.night.sun);
  sun.position.set(7.5, 12, 2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 32 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .007;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(NIGHT.fill, PRESETS.night.fill);
  fill.position.set(2, 3, 9); scene.add(fill);
  const shopGlow = new THREE.PointLight(NIGHT.lamp, PRESETS.night.shopGlow, 6.5, 2); shopGlow.position.set(0, 2.35, -.55); scene.add(shopGlow);
  const festoonL = new THREE.PointLight(NIGHT.bulb, PRESETS.night.festoonL, 4.5, 2); festoonL.position.set(-3.3, 2.7, 2.45); scene.add(festoonL);
  const festoonR = new THREE.PointLight(NIGHT.bulb, PRESETS.night.festoonR, 4.5, 2); festoonR.position.set(3.4, 2.65, 2.35); scene.add(festoonR);
  // A par can on the left festoon pole lights the platform of the listening corner.
  const stageSpot = new THREE.SpotLight(NIGHT.stage, PRESETS.night.stageSpot, 9, .38, .5, 2); stageSpot.position.set(-5.82, 3.3, 1.1);
  stageSpot.target.position.set(-4, .32, .35); scene.add(stageSpot, stageSpot.target);
  // Kept dark except in the record-shop view, where it lights the pull-out table from above.
  const tableSpot = new THREE.SpotLight(NIGHT.table, PRESETS.night.tableSpot, 0, .42, .3, 2); tableSpot.position.set(0, 9.5, -1.1);
  tableSpot.target.position.set(0, 1.2, -1.3); scene.add(tableSpot, tableSpot.target);
  const rig = { hemi, sun, fill, shopGlow, festoonL, festoonR, stageSpot, tableSpot };

  const model = buildSakuraWorld({ THREE, world, mesh, box, cylinder, ball, rod, label, geometry, toon, cel: celMaterials.cel, materials, textures });
  // Capture original object bounds before static meshes are moved into batches.
  world.updateMatrixWorld(true);
  // A missing object gives an empty box (the camera then keeps its authored shot) instead of throwing.
  const boundsOf = object => object ? new THREE.Box3().setFromObject(object) : new THREE.Box3();
  const subjectBounds = {
    explore: new THREE.Box3(new THREE.Vector3(-1.97, 1.0, -2.65), new THREE.Vector3(1.97, 1.6, .05)),
    // A phone frames the printed paper itself (±1.86 × ±1.25 on the table top, see sakura-music), so the
    // records fill the room between the header tools and the dock; the wooden rim may run under the paper UI.
    explorePhone: new THREE.Box3(new THREE.Vector3(-1.86, 1.2, -2.55), new THREE.Vector3(1.86, 1.23, -.05)),
    records: boundsOf(model.shelf),
    home: new THREE.Box3(),
  };
  // The courtyard overview keeps the open record shop in the middle. The fence and the two near
  // crowns hold its width, so the left and right corners stay part of the yard.
  const courtyardParts = new Set(['open-record-shop', 'removable-shop-roof', 'record-counter', 'tree-side-stage', 'listening-bench', 'record-crate', 'sleeping-shop-cat', 'courtyard-fence']);
  world.children.filter(object => courtyardParts.has(object.name)).forEach(object => subjectBounds.home.union(boundsOf(object)));
  const instanceMatrix = new THREE.Matrix4(); const canopyBox = new THREE.Box3(); const canopyCenter = new THREE.Vector3();
  world.children.filter(object => object.isInstancedMesh && object.name.startsWith('cherry-canopy-')).forEach(object => {
    object.geometry.computeBoundingBox();
    for (let index = 0; index < object.count; index++) {
      object.getMatrixAt(index, instanceMatrix); instanceMatrix.premultiply(object.matrixWorld);
      canopyBox.copy(object.geometry.boundingBox).applyMatrix4(instanceMatrix); canopyBox.getCenter(canopyCenter);
      if (Math.abs(canopyCenter.x) < 7 && canopyCenter.z > -5.8) subjectBounds.home.union(canopyBox);
    }
  });
  batchStaticMeshes(THREE, world, { exclude: [model.roof, model.record, model.shelf, ...model.exploreShadowBlockers] });
  batchStaticMeshes(THREE, model.shelf);
  const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: 2e6, maxPixelRatio: 1.5 });
  const ink = pipeline.ink.mat.uniforms;
  ink.uFadeStart.value = 23; ink.uFadeEnd.value = 43; ink.uSkyDepth.value = 65;
  ink.uStrength.value = .76; ink.uSens.value = .0038;
  ink.uInk.value.set(NIGHT.ink); ink.uStrength.value = .72;
  const grade = pipeline.grade.mat.uniforms;
  grade.uVignette.value = .2; grade.uSaturation.value = 1.12; grade.uLift.value = .02; grade.uWarmth.value = .035;
  grade.uShadowTint.value.set(NIGHT.gradeShadow);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let lighting = '';
  let intro = null;
  const presetName = key => PRESETS[key] ? key : 'night';
  function applyLighting(key, immediate) {
    const name = presetName(key);
    // onShot runs at departure and arrival; a repeated preset must not restart the fade.
    if (name === lighting) return;
    lighting = name;
    intro?.progress(1); intro = null;
    for (const [light, value] of Object.entries(PRESETS[name])) {
      gsap.killTweensOf(rig[light]);
      if (immediate) rig[light].intensity = value;
      else gsap.to(rig[light], { intensity: value, duration: .9, ease: 'power2.inOut' });
    }
    const [x, y, z] = SHOP_GLOW_AT[name];
    gsap.killTweensOf(shopGlow.position);
    if (immediate) shopGlow.position.set(x, y, z);
    else gsap.to(shopGlow.position, { x, y, z, duration: .9, ease: 'power2.inOut' });
  }
  /** First mount only: the courtyard switches its lamps on once, in under 1.4 seconds. */
  function playIntro() {
    const glow = model.night;
    if (introPlayed || reduced.matches || !glow) return;
    introPlayed = true;
    const preset = PRESETS[lighting] || PRESETS.night;
    const lamp = glow.lampColor.clone();
    const state = { haloOpacity: glow.haloMaterial.opacity, beamOpacity: glow.beamMaterial.opacity, windows: glow.windowGlow.emissiveIntensity, lamp: 1 };
    // Held dark until the first frames are on screen, so start-up work does not swallow the fade.
    intro = gsap.timeline({ paused: true, onComplete: () => { intro = null; } });
    requestAnimationFrame(() => requestAnimationFrame(() => { if (intro && !disposed) intro.play(); }));
    const dark = { haloOpacity: 0, beamOpacity: 0, windows: .08, lamp: .25 };
    const apply = () => {
      glow.haloMaterial.opacity = dark.haloOpacity; glow.beamMaterial.opacity = dark.beamOpacity;
      glow.windowGlow.emissiveIntensity = dark.windows; glow.warmLamp.color.copy(lamp).multiplyScalar(dark.lamp);
    };
    for (const light of ['shopGlow', 'festoonL', 'festoonR', 'stageSpot', 'tableSpot']) rig[light].intensity = 0;
    rig.hemi.intensity = preset.hemi * .72; rig.fill.intensity = 0;
    apply();
    intro.to(rig.hemi, { intensity: preset.hemi, duration: 1.1, ease: 'sine.out' }, 0)
      .to(rig.fill, { intensity: preset.fill, duration: .9, ease: 'sine.out' }, .15)
      .to(dark, { windows: state.windows, duration: .7, ease: 'power2.out', onUpdate: apply }, .1)
      .to(rig.shopGlow, { intensity: preset.shopGlow, duration: .7, ease: 'power2.out' }, .1)
      .to(dark, { lamp: 1, haloOpacity: state.haloOpacity, duration: .6, ease: 'power2.out', onUpdate: apply }, .35)
      .to(rig.festoonL, { intensity: preset.festoonL, duration: .6, ease: 'power2.out' }, .35)
      .to(rig.festoonR, { intensity: preset.festoonR, duration: .6, ease: 'power2.out' }, .47)
      .to(rig.tableSpot, { intensity: preset.tableSpot, duration: .6, ease: 'power2.out' }, .47)
      .to(rig.stageSpot, { intensity: preset.stageSpot, duration: .55, ease: 'power3.out' }, .8)
      .to(dark, { beamOpacity: state.beamOpacity, duration: .55, ease: 'power3.out', onUpdate: apply }, .8);
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let width = 1; let height = 1;
  let currentView = shotFor(view);
  let disposed = false;
  let visible = true;
  let frame = 0; let lastTime = 0; let sceneTime = 0; let queuedDraw = 0;
  const pins = [];
  const staticPins = [
    ['唱片店', new THREE.Vector3(0, 2.6, 1), { type: 'navigate', view: 'explore' }],
  ];
  for (const [title, position, action] of staticPins) {
    const button = document.createElement('button'); button.className = 'world-pin'; button.textContent = title;
    button.addEventListener('click', () => onAction?.(action)); hotspots.append(button);
    pins.push({ button, position, homeOnly: true });
  }
  let director;
  const framing = createSakuraFraming(host, {
    getShot: () => director?.active.key || currentView,
    onChange() { if (!disposed) { director?.reframe(); projectPins(); requestDraw(); } },
    onLabelsChange() { if (!disposed) { projectPins(); if (reduced.matches) requestDraw(); } },
  });
  pins.forEach(pin => framing.watchLabel(pin.button));
  const music = createSakuraMusic({ world, cel: celMaterials.cel, host: hotspots, canvas, camera, reduced, onAction, framing,
    isActive: () => director.active.key === 'explore' && !director.travelling && !framing.layout.blocked,
    onChange() { renderer.shadowMap.needsUpdate = true; if (reduced.matches) requestDraw(); },
  });
  function boundsForShot(key) {
    if (key === 'explore' && width <= 760) return subjectBounds.explorePhone;
    return subjectBounds[key] || subjectBounds.home;
  }
  const courtyardCenter = subjectBounds.home.getCenter(new THREE.Vector3());
  // Without the animation loop (reduced motion), every tween update and content change asks for a frame.
  // One table update fires dozens of those synchronously, so they share the next frame instead of each
  // re-rendering shadows and post-processing on the spot.
  function requestDraw() {
    if (disposed || queuedDraw) return;
    queuedDraw = requestAnimationFrame(() => { queuedDraw = 0; if (!disposed) { projectPins(); draw(); } });
  }
  function draw() {
    // A direct draw also answers a pending request.
    if (queuedDraw) { cancelAnimationFrame(queuedDraw); queuedDraw = 0; }
    if (disposed || !visible || !width || !height) return;
    // Reframing can move the camera back on small screens; keep haze beyond the venue.
    const distance = camera.position.distanceTo(courtyardCenter);
    scene.fog.near = Math.max(24, distance + 7);
    scene.fog.far = scene.fog.near + 22;
    // A short phone leaves a thin band between headline and paper; the far plane follows the camera
    // back so the courtyard is small there, never clipped away.
    const far = Math.max(80, Math.ceil(distance + 32));
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    pipeline.render();
  }
  const projected = new THREE.Vector3();
  function positionPin(button, point, offsetY = 0) {
    projected.copy(point).project(camera);
    const x = (projected.x + 1) * width / 2; const y = (1 - projected.y) * height / 2 + offsetY;
    const placed = projected.z <= 1 && projected.z >= -1 && framing.placeLabel(button, x, y, 'bottom');
    // A label with keyboard focus stays put; hiding it would drop focus to the page.
    button.hidden = !placed && button !== document.activeElement;
    if (!button.hidden) button.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
  }
  function projectPins() {
    camera.updateMatrixWorld(); world.updateMatrixWorld(true);
    framing.beginLabels();
    music.project(camera, width, height, director.active.key === 'explore');
    // Visibility is assigned once per frame, never toggled, so a focused label keeps its focus.
    pins.forEach(pin => { if (director.active.key === 'home') positionPin(pin.button, pin.position); else pin.button.hidden = true; });
  }
  director = createCameraDirector(camera, {
    size: () => ({ width, height }), reduced,
    getLayout: key => framing.get(key), getBounds: boundsForShot,
    onFrame() { projectPins(); if (reduced.matches) requestDraw(); },
    onShot(key, travelling) {
      applyLighting(key, !travelling || reduced.matches);
      model.roof.visible = key !== 'explore';
      model.exploreShadowBlockers.forEach(object => { object.castShadow = key !== 'explore'; });
      // The close view makes room at the back for the pull-out record table.
      model.shelf.position.z = key === 'explore' ? -2.99 : -2.3;
      renderer.shadowMap.needsUpdate = true;
      const distantPortrait = width <= 760 && key === 'home';
      scene.fog.near = distantPortrait ? 43 : 24; scene.fog.far = distantPortrait ? 78 : 46;
      ink.uFadeStart.value = distantPortrait ? 42 : 23; ink.uFadeEnd.value = distantPortrait ? 70 : 43;
      host.dataset.shot = key;
      if (travelling) host.dataset.travelling = 'true'; else delete host.dataset.travelling;
      compass.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.worldView === key)));
      caption.querySelector('strong').textContent = ({ home: '小院', explore: '唱片店', records: '我的发现' })[key] || '小院';
      // The shell keeps its (shot, id, travelling) signature; the courtyard has no per-item shots.
      onShot?.(key, null, travelling);
    },
  });
  /** Routes pick the shot; a retired route ('space', 'live') returns to the courtyard. */
  function setView(next, { immediate = false } = {}) {
    const shot = shotFor(next);
    const changed = currentView !== shot;
    currentView = shot;
    if (!changed && director.active.key === shot) return Promise.resolve(true);
    return director.go(shot, { immediate });
  }
  /** Looks at one of the three stops without changing the route; an unknown kind stays on the current view. */
  function focus(kind) { return director.go(shotFor(kind, currentView)); }
  function restore() { return director.go(currentView); }
  /** Kept for the shell's publish() contract. The courtyard shows no user cards, so this is a no-op. */
  function setContent() {}
  function picked(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.children, true).find(item => { for (let node = item.object; node; node = node.parent) if (!node.visible) return false; return music.acceptHit(item); });
    let object = hit?.object;
    while (object && !object.userData.action) object = object.parent;
    return object?.userData.action;
  }
  function onPointerMove(event) { if (!music.dragging && event.pointerType !== 'touch') canvas.style.cursor = picked(event) ? 'pointer' : ''; }
  function onPointerLeave() { canvas.style.cursor = ''; }
  function onCanvasClick(event) {
    if (music.consumeClick(event)) return;
    const action = picked(event);
    if (action?.type === 'music') music.activate(action);
    else if (action) onAction?.(action);
  }
  canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerleave', onPointerLeave); canvas.addEventListener('click', onCanvasClick);
  function tick(now) {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches) return;
    if (!lastTime) lastTime = now;
    if (now - lastTime >= 1000 / (director.moving || intro?.isActive() ? 60 : 30)) {
      sceneTime += Math.min((now - lastTime) / 1000, .1); lastTime = now;
      model.update?.(sceneTime); projectPins(); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function updateMotion() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (disposed || !visible || document.hidden) return;
    if (reduced.matches) { intro?.progress(1); gsap.getTweensOf([...Object.values(rig), shopGlow.position]).forEach(tween => tween.progress(1)); director.finish(); music.finish(); model.update?.(0); projectPins(); draw(); }
    else { draw(); frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width)); height = Math.max(1, Math.round(bounds.height));
    grade.uVignette.value = width <= 760 ? .12 : .2;
    framing.measure(director.active.key); director.resize(); pipeline.setSize(width, height); renderer.shadowMap.needsUpdate = true; projectPins(); draw();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; updateMotion(); }, { threshold: .01 });
  intersectionObserver.observe(host);
  document.addEventListener('visibilitychange', updateMotion); reduced.addEventListener('change', updateMotion);
  resize(); director.go(currentView, { immediate: true, force: true }); model.update?.(0); playIntro(); updateMotion();
  return { setView, setContent, setMusic: music.setMusic, musicControl: music.control, focus, restore, dispose() {
    disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(queuedDraw); director.dispose();
    intro?.kill(); gsap.killTweensOf([...Object.values(rig), shopGlow.position]);
    music.dispose();
    framing.dispose();
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', updateMotion); reduced.removeEventListener('change', updateMotion);
    canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('click', onCanvasClick);
    world.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
    celMaterials.dispose(); pipeline.dispose(); sun.shadow.dispose(); scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    canvas.remove(); compass.remove(); hotspots.remove(); caption.remove(); host.classList.remove('sakura-scene');
  } };
}

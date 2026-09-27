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
  // The worktable is under the right half of the string lights; they burn a little brighter while a card is made.
  editor: { hemi: 1.4, sun: .8, fill: .36, shopGlow: 7, festoonL: 6, festoonR: 9.5, stageSpot: 48, tableSpot: 0 },
};
// The shop light hangs by the door at night and under the right pendant, over the cabinet, in the records view.
const SHOP_GLOW_AT = { night: [0, 2.35, -.55], explore: [0, 2.35, -.55], editor: [0, 2.35, -.55], records: [1.15, 2.3, -1.05] };
let introPlayed = false;

/** Original music street, rendered with Sakura Crossing's MIT cel/ink pipeline. */
export function mountSakuraScene(host, { onAction, view = 'space', onShot } = {}) {
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
    return { setView() {}, setContent() {}, setMusic() {}, musicControl() {}, focus: () => Promise.resolve(true), restore() {}, dispose() { fallback.remove(); host.classList.remove('sakura-scene--fallback'); document.body.classList.remove('spatial-fallback'); } };
  }

  host.classList.add('sakura-scene');
  const canvas = renderer.domElement;
  canvas.className = 'sakura-scene__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '夜晚的樱下音乐小院，串灯亮着。可通过物件标记或下方导航进入唱片店、照片墙、工作桌与收藏。');
  host.append(canvas);
  const compass = document.createElement('nav');
  compass.className = 'world-compass';
  compass.setAttribute('aria-label', '音乐小院');
  compass.innerHTML = '<div><button data-world-view="space">小院</button><button data-world-view="explore">唱片店</button><button data-world-view="live">照片墙</button><button data-world-editor>工作桌</button><button data-world-view="records">收藏</button></div>';
  host.append(compass);
  compass.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    onAction?.(button.hasAttribute('data-world-editor') ? { type: 'editor' } : { type: 'navigate', view: button.dataset.worldView });
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
  // A par can on the left festoon pole lights the stage.
  const stageSpot = new THREE.SpotLight(NIGHT.stage, PRESETS.night.stageSpot, 9, .38, .5, 2); stageSpot.position.set(-5.82, 3.3, 1.1);
  stageSpot.target.position.set(-4, .32, .35); scene.add(stageSpot, stageSpot.target);
  // Kept dark except in the record-shop view, where it lights the pull-out table from above.
  const tableSpot = new THREE.SpotLight(NIGHT.table, PRESETS.night.tableSpot, 0, .42, .3, 2); tableSpot.position.set(0, 9.5, -1.1);
  tableSpot.target.position.set(0, 1.2, -1.3); scene.add(tableSpot, tableSpot.target);
  const rig = { hemi, sun, fill, shopGlow, festoonL, festoonR, stageSpot, tableSpot };

  const model = buildSakuraWorld({ THREE, world, mesh, box, cylinder, ball, rod, label, geometry, toon, cel: celMaterials.cel, materials, textures });
  // Capture original object bounds before static meshes are moved into batches.
  world.updateMatrixWorld(true);
  const subjectBounds = {
    explore: new THREE.Box3(new THREE.Vector3(-1.97, 1.0, -2.65), new THREE.Vector3(1.97, 1.6, .05)),
    live: new THREE.Box3().setFromObject(world.getObjectByName('two-view-photo-wall')).expandByScalar(.05),
    editor: new THREE.Box3().setFromObject(model.desk),
    records: new THREE.Box3().setFromObject(model.shelf),
    home: new THREE.Box3(),
  };
  const photoBounds = model.photoCards.map(card => new THREE.Box3().setFromObject(card.object));
  const courtyardParts = new Set(['open-record-shop', 'removable-shop-roof', 'tree-side-stage', 'two-view-photo-wall', 'card-making-desk', 'desk-stool', 'listening-bench', 'courtyard-fence']);
  world.children.filter(object => courtyardParts.has(object.name)).forEach(object => subjectBounds.home.union(new THREE.Box3().setFromObject(object)));
  const instanceMatrix = new THREE.Matrix4(); const canopyBox = new THREE.Box3(); const canopyCenter = new THREE.Vector3();
  world.children.filter(object => object.isInstancedMesh && object.name.startsWith('cherry-canopy-')).forEach(object => {
    object.geometry.computeBoundingBox();
    for (let index = 0; index < object.count; index++) {
      object.getMatrixAt(index, instanceMatrix); instanceMatrix.premultiply(object.matrixWorld);
      canopyBox.copy(object.geometry.boundingBox).applyMatrix4(instanceMatrix); canopyBox.getCenter(canopyCenter);
      if (Math.abs(canopyCenter.x) < 7 && canopyCenter.z > -5.8) subjectBounds.home.union(canopyBox);
    }
  });
  batchStaticMeshes(THREE, world, { exclude: [model.roof, model.record, model.shelf, model.draftImageMesh, ...model.exploreShadowBlockers, ...model.photoCards.map(card => card.object)] });
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
  const loader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let width = 1; let height = 1;
  let currentView = view;
  let currentMode = view === 'space' ? 'home' : view;
  let activePhoto = null;
  let draftCard = null;
  let disposed = false;
  let visible = true;
  let frame = 0; let lastTime = 0; let sceneTime = 0; let queuedDraw = 0;
  const pins = [];
  const staticPins = [
    ['唱片店', new THREE.Vector3(0, 2.6, 1), { type: 'navigate', view: 'explore' }],
    ['照片墙', new THREE.Vector3(-3.8, 2.85, 1.4), { type: 'navigate', view: 'live' }],
    ['工作桌', new THREE.Vector3(4, 1.75, 1.6), { type: 'editor' }],
  ];
  for (const [title, position, action] of staticPins) {
    const button = document.createElement('button'); button.className = 'world-pin'; button.textContent = title;
    button.addEventListener('click', () => onAction?.(action)); hotspots.append(button);
    pins.push({ button, position, homeOnly: true });
  }
  const photoSlots = model.photoCards.map((card, index) => {
    const button = document.createElement('button'); button.className = 'world-pin world-pin--photo'; button.hidden = true;
    const slot = { ...card, index, button, data: null, texture: null,
      rest: { position: card.object.position.clone(), rotation: card.object.rotation.clone(), scale: card.object.scale.clone() } };
    button.addEventListener('click', () => { if (slot.data) onAction?.({ type: 'photo', id: slot.data.id }); });
    hotspots.append(button); card.object.visible = false;
    return slot;
  });
  let director;
  const framing = createSakuraFraming(host, {
    getShot: () => director?.active.key || (view === 'space' ? 'home' : view),
    onChange() { if (!disposed) { director?.reframe(); projectPins(); requestDraw(); } },
    onLabelsChange() { if (!disposed) { projectPins(); if (reduced.matches) requestDraw(); } },
  });
  pins.forEach(pin => framing.watchLabel(pin.button)); photoSlots.forEach(slot => framing.watchLabel(slot.button));
  const music = createSakuraMusic({ world, cel: celMaterials.cel, host: hotspots, canvas, camera, reduced, onAction, framing,
    isActive: () => director.active.key === 'explore' && !director.travelling && !framing.layout.blocked,
    onChange() { renderer.shadowMap.needsUpdate = true; if (reduced.matches) requestDraw(); },
  });
  function boundsForShot(key, id) {
    if (key !== 'photo') return subjectBounds[key] || subjectBounds.live;
    const slot = photoSlots.find(item => item.data?.id === id);
    if (!slot) return subjectBounds.live;
    const bounds = photoBounds[slot.index]; const center = bounds.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, .26, .82));
    const extent = bounds.getSize(new THREE.Vector3()).multiplyScalar(1.28).addScalar(.06);
    return new THREE.Box3().setFromCenterAndSize(center, extent);
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
    scene.fog.near = Math.max(24, camera.position.distanceTo(courtyardCenter) + 7);
    scene.fog.far = scene.fog.near + 22;
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
    photoSlots.forEach(slot => {
      // The front door reaches personal cards through its paper; labels belong to the wall itself.
      if (!slot.data || !['live', 'photo'].includes(director.active.key)) { slot.button.hidden = true; return; }
      const position = slot.object.getWorldPosition(new THREE.Vector3()); position.y -= .5;
      positionPin(slot.button, position);
    });
  }
  director = createCameraDirector(camera, {
    size: () => ({ width, height }), reduced,
    getLayout: key => framing.get(key), getBounds: boundsForShot,
    onFrame() { projectPins(); if (reduced.matches) requestDraw(); },
    onShot(key, id, travelling) {
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
      compass.querySelectorAll('button').forEach(button => {
        const selected = button.hasAttribute('data-world-editor') ? key === 'editor' : button.dataset.worldView === (key === 'home' ? 'space' : key === 'photo' ? 'live' : key);
        button.setAttribute('aria-pressed', String(selected));
      });
      caption.querySelector('strong').textContent = ({ home: '小院', explore: '唱片店', live: '照片墙', editor: '工作桌', records: '收藏架', photo: '现场卡' })[key];
      onShot?.(key, id, travelling);
    },
  });
  function resetPhoto(slot, immediate = false) {
    if (!slot) return;
    for (const property of ['position', 'rotation', 'scale']) {
      gsap.killTweensOf(slot.object[property]);
      const end = slot.rest[property];
      gsap.to(slot.object[property], { x: end.x, y: end.y, z: end.z, duration: immediate || reduced.matches ? 0 : .4, ease: 'power3.out', onUpdate: () => { renderer.shadowMap.needsUpdate = true; if (reduced.matches) requestDraw(); } });
    }
  }
  function releasePhoto(immediate = false) { resetPhoto(activePhoto, immediate); activePhoto = null; }
  function baseShot() { return currentView === 'space' ? currentMode === 'home' ? 'home' : 'live' : currentView; }
  function setView(next, { mode, immediate = false } = {}) {
    const changed = currentView !== next || (mode && mode !== currentMode);
    currentView = next; currentMode = mode || (next === 'space' ? 'home' : next);
    if (!changed && director.active.key === baseShot()) return Promise.resolve(true);
    releasePhoto(); return director.go(baseShot(), { immediate });
  }
  function focus(kind, id) {
    if (kind !== 'photo') { releasePhoto(); return director.go(kind); }
    const slot = photoSlots.find(item => item.data?.id === id);
    if (!slot) return director.go(baseShot());
    if (activePhoto !== slot) {
      releasePhoto(); activePhoto = slot;
      gsap.to(slot.object.position, { y: slot.rest.position.y + .26, z: slot.rest.position.z + .82, duration: reduced.matches ? 0 : .7, ease: 'power3.inOut', onUpdate: () => { renderer.shadowMap.needsUpdate = true; } });
      gsap.to(slot.object.rotation, { x: 0, y: 0, z: -.04, duration: reduced.matches ? 0 : .7, ease: 'power3.inOut' });
      gsap.to(slot.object.scale, { x: 1.28, y: 1.28, z: 1.28, duration: reduced.matches ? 0 : .7, ease: 'power3.inOut' });
    }
    const point = slot.anchor.clone(); point.y += .23; point.z += .65;
    return director.go('photo', { point, id });
  }
  function restore() { releasePhoto(); return director.go(baseShot()); }
  function setContent(cards = [], mode) {
    if (mode && mode !== currentMode) { currentMode = mode; if (!['photo', 'editor'].includes(director.active.key)) director.go(baseShot()); }
    // A newly loaded image must not move a card that is already being viewed.
    const remaining = new Map(cards.slice(0, 6).map(card => [card.id, card]));
    const assigned = photoSlots.map(slot => {
      const card = remaining.get(slot.data?.id) || null;
      if (card) remaining.delete(card.id);
      return card;
    });
    const incoming = remaining.values();
    assigned.forEach((card, index) => { if (!card) assigned[index] = incoming.next().value || null; });
    const nextDraft = cards.find(card => card.isOwn) || null;
    if (draftCard?.id !== nextDraft?.id || draftCard?.src !== nextDraft?.src) {
      model.draftImageMesh.material.map = null; model.draftImageMesh.material.color.set('#e5cdd1'); model.draftImageMesh.material.needsUpdate = true;
    }
    draftCard = nextDraft;
    photoSlots.forEach((slot, index) => {
      const next = assigned[index];
      if (activePhoto === slot && slot.data?.id !== next?.id) { releasePhoto(true); director.go(baseShot()); }
      const changed = slot.data?.src !== next?.src || slot.data?.id !== next?.id;
      slot.data = next; slot.object.visible = Boolean(next); slot.button.hidden = !next;
      if (next) {
        slot.object.userData.action = { type: 'photo', id: next.id };
        const owner = next.subtitle?.split(' · ')[0] || '现场';
        const label = currentView === 'space' && !next.local && next.eventTitle ? next.eventTitle : `${owner}的卡`;
        slot.button.textContent = label.length > 12 ? `${label.slice(0, 11)}…` : label;
        slot.button.setAttribute('aria-label', `查看${label}${next.isDemo ? '，示例' : ''}`);
      }
      if (!changed) return;
      if (slot.texture) { slot.texture.dispose(); textures.delete(slot.texture); slot.texture = null; }
      slot.imageMesh.material.map = null; slot.imageMesh.material.needsUpdate = true;
      if (!next?.src) return;
      const expected = next.src;
      const texture = loader.load(expected, loaded => {
        if (disposed || slot.data?.src !== expected) { loaded.dispose(); textures.delete(loaded); return; }
        const imageAspect = loaded.image.width / loaded.image.height;
        const params = slot.imageMesh.geometry.parameters;
        const shapeAspect = params.width / params.height;
        if (imageAspect > shapeAspect) { loaded.repeat.x = shapeAspect / imageAspect; loaded.offset.x = (1 - loaded.repeat.x) / 2; }
        else { loaded.repeat.y = imageAspect / shapeAspect; loaded.offset.y = (1 - loaded.repeat.y) / 2; }
        slot.imageMesh.material.map = loaded; slot.imageMesh.material.color.set('#ffffff'); slot.imageMesh.material.needsUpdate = true;
        if (slot.data.isOwn) { model.draftImageMesh.material.map = loaded; model.draftImageMesh.material.color.set('#ffffff'); model.draftImageMesh.material.needsUpdate = true; }
        requestDraw();
      });
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      slot.texture = texture; textures.add(texture);
    });
    renderer.shadowMap.needsUpdate = true; projectPins(); requestDraw();
  }
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
    if (now - lastTime >= 1000 / (director.moving || activePhoto || intro?.isActive() ? 60 : 30)) {
      sceneTime += Math.min((now - lastTime) / 1000, .1); lastTime = now;
      model.update?.(sceneTime); projectPins(); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function updateMotion() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (disposed || !visible || document.hidden) return;
    if (reduced.matches) { intro?.progress(1); gsap.getTweensOf([...Object.values(rig), shopGlow.position]).forEach(tween => tween.progress(1)); director.finish(); music.finish(); photoSlots.forEach(slot => { gsap.getTweensOf([slot.object.position, slot.object.rotation, slot.object.scale]).forEach(tween => tween.progress(1)); }); model.update?.(0); projectPins(); draw(); }
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
  resize(); director.go(baseShot(), { immediate: true, force: true }); model.update?.(0); playIntro(); updateMotion();
  return { setView, setContent, setMusic: music.setMusic, musicControl: music.control, focus, restore, dispose() {
    disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(queuedDraw); director.dispose();
    intro?.kill(); gsap.killTweensOf([...Object.values(rig), shopGlow.position]);
    music.dispose();
    framing.dispose();
    photoSlots.forEach(slot => { gsap.killTweensOf([slot.object.position, slot.object.rotation, slot.object.scale]); });
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', updateMotion); reduced.removeEventListener('change', updateMotion);
    canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('click', onCanvasClick);
    world.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
    celMaterials.dispose(); pipeline.dispose(); sun.shadow.dispose(); scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    canvas.remove(); compass.remove(); hotspots.remove(); caption.remove(); host.classList.remove('sakura-scene');
  } };
}

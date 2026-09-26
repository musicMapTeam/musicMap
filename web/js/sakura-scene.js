import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildSakuraWorld } from './sakura-world.js';
import { batchStaticMeshes } from './sakura-batch.js';
import { createCameraDirector } from './sakura-camera.js';
import { createCelMaterials } from './vendor/sakura/toon.js';
import { Pipeline } from './vendor/sakura/post.js';
import { PAL } from './vendor/sakura/palette.js';

/** Original music street, rendered with Sakura Crossing's MIT cel/ink pipeline. */
export function mountSakuraScene(host, { onAction, view = 'space', onShot } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'low-power' });
  } catch {
    host.classList.add('sakura-scene--fallback');
    const fallback = document.createElement('div');
    fallback.className = 'sakura-scene__fallback';
    fallback.innerHTML = '<span aria-hidden="true"></span><strong>SAME SHOW.<br>ANOTHER VIEW.</strong>';
    host.append(fallback);
    document.body.classList.add('spatial-fallback');
    return { setView() {}, setContent() {}, focus: () => Promise.resolve(true), restore() {}, dispose() { fallback.remove(); host.classList.remove('sakura-scene--fallback'); document.body.classList.remove('spatial-fallback'); } };
  }

  host.classList.add('sakura-scene');
  const canvas = renderer.domElement;
  canvas.className = 'sakura-scene__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '樱下音乐小院。可通过物件标记或下方导航进入唱片店、照片墙、工作桌与收藏。');
  host.append(canvas);
  const compass = document.createElement('nav');
  compass.className = 'world-compass';
  compass.setAttribute('aria-label', '音乐小院');
  compass.innerHTML = '<span class="world-compass__label">SIDE B / 樱下唱片店</span><div><button data-world-view="space">小院</button><button data-world-view="explore">唱片店</button><button data-world-view="live">照片墙</button><button data-world-editor>工作桌</button><button data-world-view="records">收藏</button></div>';
  host.append(compass);
  compass.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    onAction?.(button.hasAttribute('data-world-editor') ? { type: 'editor' } : { type: 'navigate', view: button.dataset.worldView });
  });
  const hotspots = document.createElement('div'); hotspots.className = 'world-hotspots'; host.append(hotspots);
  const caption = document.createElement('div'); caption.className = 'world-caption';
  caption.innerHTML = '<span>SIDE B RECORDS</span><strong>樱下唱片店</strong><small data-world-caption>音乐 · 照片 · 此刻</small>';
  host.append(caption);
  renderer.setClearColor(PAL.skyHaze, 1);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.skyMid);
  scene.fog = new THREE.Fog(PAL.fog, 24, 46);
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 80);
  camera.position.set(8.5, 6.6, 13);
  camera.lookAt(0, 1.55, 0);
  const world = new THREE.Group();
  scene.add(world);
  const textures = new Set();
  const geometries = new Set();
  const materials = new Set();
  const skySurface = document.createElement('canvas');
  skySurface.width = 2; skySurface.height = 128;
  const skyContext = skySurface.getContext('2d');
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 128);
  skyGradient.addColorStop(0, '#abcce6');
  skyGradient.addColorStop(.64, '#dce7ed');
  skyGradient.addColorStop(1, '#f5e9de');
  skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 2, 128);
  const skyTexture = new THREE.CanvasTexture(skySurface);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
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

  scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12));
  const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
  sun.position.set(-6.2, 10.2, 8.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 32 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .007;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(PAL.fill, 1.08);
  fill.position.set(6, 3.8, -5.5); scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xd8cbe8, .34);
  bounce.position.set(1, -3, 4); scene.add(bounce);

  const model = buildSakuraWorld({ THREE, world, mesh, box, cylinder, ball, rod, label, geometry, toon, materials, textures });
  batchStaticMeshes(THREE, world, { exclude: [model.roof, model.record, model.draftImageMesh, ...model.photoCards.map(card => card.object)] });
  const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: 2e6, maxPixelRatio: 1.5 });
  const ink = pipeline.ink.mat.uniforms;
  ink.uFadeStart.value = 23; ink.uFadeEnd.value = 43; ink.uSkyDepth.value = 65;
  ink.uStrength.value = .76; ink.uSens.value = .0038;
  pipeline.grade.mat.uniforms.uVignette.value = .06;
  pipeline.grade.mat.uniforms.uSaturation.value = 1.06;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
  let frame = 0; let lastTime = 0; let sceneTime = 0;
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
  function draw() { if (!disposed && visible && width && height) pipeline.render(); }
  const projected = new THREE.Vector3();
  function positionPin(button, point, offsetY = 0) {
    projected.copy(point).project(camera);
    const x = (projected.x + 1) * width / 2; const y = (1 - projected.y) * height / 2 + offsetY;
    const clearArea = width <= 760 ? (director.active.key === 'home' ? height - 240 : height * .43) : width - (director.active.key === 'home' ? 20 : 520);
    const inArea = width <= 760 ? y < clearArea : x < clearArea;
    button.hidden = projected.z > 1 || projected.z < -1 || x < 35 || x > width - 35 || y < 95 || y > height - 100 || !inArea;
    if (!button.hidden) button.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
  }
  function projectPins() {
    camera.updateMatrixWorld(); world.updateMatrixWorld(true);
    pins.forEach(pin => { pin.button.hidden = true; if (director.active.key === 'home') positionPin(pin.button, pin.position); });
    photoSlots.forEach(slot => {
      slot.button.hidden = true;
      if (!slot.data || !['home', 'live', 'photo'].includes(director.active.key)) return;
      const position = slot.object.getWorldPosition(new THREE.Vector3()); position.y -= .5;
      positionPin(slot.button, position, director.active.key === 'home' ? (slot.index % 3) * 27 : 0);
    });
  }
  const director = createCameraDirector(camera, {
    size: () => ({ width, height }), reduced,
    onFrame() { projectPins(); if (reduced.matches) draw(); },
    onShot(key, id, travelling) {
      const distantPortrait = width <= 760 && key === 'home';
      scene.fog.near = distantPortrait ? 43 : 24; scene.fog.far = distantPortrait ? 78 : 46;
      ink.uFadeStart.value = distantPortrait ? 42 : 23; ink.uFadeEnd.value = distantPortrait ? 70 : 43;
      host.dataset.shot = key;
      if (travelling) host.dataset.travelling = 'true'; else delete host.dataset.travelling;
      compass.querySelectorAll('button').forEach(button => {
        const selected = button.hasAttribute('data-world-editor') ? key === 'editor' : button.dataset.worldView === (key === 'home' ? 'space' : key === 'photo' ? 'live' : key);
        button.setAttribute('aria-pressed', String(selected));
      });
      caption.querySelector('strong').textContent = ({ home: '樱下唱片店', explore: '唱片里的相遇', live: '同一晚，另一面', editor: '留下一张现场卡', records: '留住的声音', photo: '这张照片的另一面' })[key];
      onShot?.(key, id, travelling);
    },
  });
  function resetPhoto(slot, immediate = false) {
    if (!slot) return;
    for (const property of ['position', 'rotation', 'scale']) {
      gsap.killTweensOf(slot.object[property]);
      const end = slot.rest[property];
      gsap.to(slot.object[property], { x: end.x, y: end.y, z: end.z, duration: immediate || reduced.matches ? 0 : .4, ease: 'power3.out', onUpdate: () => { renderer.shadowMap.needsUpdate = true; if (reduced.matches) draw(); } });
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
        draw();
      });
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      slot.texture = texture; textures.add(texture);
    });
    const scope = cards.every(card => card.local) ? '示例卡' : currentView === 'live' ? '可见现场卡' : '我的现场卡';
    const firstVisit = currentView === 'space' && currentMode === 'home' && cards.every(card => card.local);
    caption.querySelector('[data-world-caption]').textContent = firstVisit ? '留一张卡，换一个视角' : cards.length ? `${cards.length} 张${scope}` : '音乐 · 照片 · 此刻';
    renderer.shadowMap.needsUpdate = true; projectPins(); draw();
  }
  function picked(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.children, true).find(item => { for (let node = item.object; node; node = node.parent) if (!node.visible) return false; return true; });
    let object = hit?.object;
    while (object && !object.userData.action) object = object.parent;
    return object?.userData.action;
  }
  function onPointerMove(event) { if (event.pointerType !== 'touch') canvas.style.cursor = picked(event) ? 'pointer' : ''; }
  function onPointerLeave() { canvas.style.cursor = ''; }
  function onCanvasClick(event) { const action = picked(event); if (action) onAction?.(action); }
  canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerleave', onPointerLeave); canvas.addEventListener('click', onCanvasClick);
  function tick(now) {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches) return;
    if (!lastTime) lastTime = now;
    if (now - lastTime >= 1000 / (director.moving || activePhoto ? 60 : 30)) {
      sceneTime += Math.min((now - lastTime) / 1000, .1); lastTime = now;
      model.update?.(sceneTime); projectPins(); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function updateMotion() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (disposed || !visible || document.hidden) return;
    if (reduced.matches) { director.finish(); photoSlots.forEach(slot => { gsap.getTweensOf([slot.object.position, slot.object.rotation, slot.object.scale]).forEach(tween => tween.progress(1)); }); model.update?.(0); projectPins(); draw(); }
    else { draw(); frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width)); height = Math.max(1, Math.round(bounds.height));
    director.resize(); pipeline.setSize(width, height); renderer.shadowMap.needsUpdate = true; projectPins(); draw();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; updateMotion(); }, { threshold: .01 });
  intersectionObserver.observe(host);
  document.addEventListener('visibilitychange', updateMotion); reduced.addEventListener('change', updateMotion);
  resize(); director.go(baseShot(), { immediate: true, force: true }); model.update?.(0); updateMotion();
  return { setView, setContent, focus, restore, dispose() {
    disposed = true; cancelAnimationFrame(frame); director.dispose();
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

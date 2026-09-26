import * as THREE from 'three';
import { createCelMaterials } from './vendor/sakura/toon.js';
import { Pipeline } from './vendor/sakura/post.js';
import { PAL } from './vendor/sakura/palette.js';

/** Original music street, rendered with Sakura Crossing's MIT cel/ink pipeline. */
export function mountSakuraScene(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'low-power' });
  } catch {
    host.classList.add('sakura-scene--fallback');
    const fallback = document.createElement('div');
    fallback.className = 'sakura-scene__fallback';
    fallback.innerHTML = '<span aria-hidden="true"></span><strong>SAME SHOW.<br>ANOTHER VIEW.</strong>';
    host.append(fallback);
    return () => { fallback.remove(); host.classList.remove('sakura-scene--fallback'); };
  }

  host.classList.add('sakura-scene');
  const canvas = renderer.domElement;
  canvas.className = 'sakura-scene__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '樱花音乐街角：唱片小店、街边舞台、灯串和飘落的花瓣。');
  host.append(canvas);
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
  const camera = new THREE.OrthographicCamera(-6, 6, 5, -5, .1, 80);
  camera.position.set(8.5, 6.6, 13);
  camera.lookAt(0, 1.55, 0);
  const world = new THREE.Group();
  world.rotation.y = -.12;
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
  function curve(points, color = '#485347') {
    const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const material = new THREE.LineBasicMaterial({ color }); materials.add(material);
    world.add(new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(path.getPoints(40))), material));
    return path;
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
  sun.position.set(-5.2, 8.2, 6.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 32 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .007;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(PAL.fill, 1.08);
  fill.position.set(6, 3.8, -5.5); scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xd8cbe8, .34);
  bounce.position.set(1, -3, 4); scene.add(bounce);

  // A quiet street extends beyond the shop. The scene has a foreground and
  // fading neighbourhood instead of sitting on an isolated presentation plinth.
  const pavement = box([0, -.12, -8.3], [65, .18, 24], toon.sand, world);
  pavement.castShadow = false;
  const road = box([0, -.14, 8.5], [65, .14, 10], toon.road, world);
  road.castShadow = false;
  box([0, -.015, 3.47], [65, .14, .16], toon.plaster, world);
  for (let i = -5; i < 6; i += 1) box([i * 3.3, -.055, 8.5], [1.25, .008, .1], toon.plaster, world);
  const distantWall = celMaterials.cel({ color: '#d5dce5', bands: 'soft', flat: false });
  const distantRoof = celMaterials.cel({ color: '#939bab', bands: 'soft', flat: false });
  const distantWindow = celMaterials.flat({ color: '#aebdc9' });
  for (let i = -3; i < 5; i += 1) {
    const x = i * 4.5 + .6;
    const h = 2.6 + ((i + 3) % 3) * .65;
    const house = box([x, h / 2 - .1, -9.8], [3.6, h, 2.1], distantWall, world);
    house.castShadow = false;
    const roof = box([x, h, -9.8], [3.85, .18, 2.45], distantRoof, world); roof.castShadow = false;
    for (const dx of [-.95, .8]) {
      const window = box([x + dx, h - .85, -8.72], [.65, .86, .03], distantWindow, world);
      window.castShadow = false;
    }
  }

  // A small, tangible island with a paper-coloured pavement edge.
  box([0, -.18, 0], [8.7, .35, 5.7], toon.sand);
  box([0, .025, 0], [8.65, .08, 5.65], toon.cream);
  box([0, .072, 2.27], [8.5, .018, .68], toon.plaster, world);
  for (let i = 0; i < 8; i += 1) box([-3.8 + i * 1.08, .09, 2.27], [.012, .012, .68], toon.sand, world);
  box([.35, .18, -.75], [4.25, .28, 2.6], toon.sand);
  box([.35, 1.45, -.83], [3.85, 2.35, 2.18], toon.plaster);
  box([.35, .44, .28], [3.96, .26, .1], toon.green);

  // Gabled roof, exposed ridge and quiet seam lines.
  const roofFront = box([.35, 2.94, -.18], [4.48, .15, 1.46], toon.green);
  roofFront.rotation.x = .42;
  const roofBack = box([.35, 2.94, -1.48], [4.48, .15, 1.46], toon.green);
  roofBack.rotation.x = -.42;
  box([.35, 3.26, -.83], [4.58, .11, .12], toon.leaf);
  for (let i = 0; i < 10; i += 1) {
    const seam = box([-1.61 + i * .435, 3.031, -.18], [.022, .013, 1.41], toon.leaf, world);
    seam.rotation.x = .42;
  }
  box([-1.03, 1.22, .28], [.69, 1.86, .08], toon.green);
  box([-1.03, 1.55, .33], [.48, .91, .025], toon.glass);
  ball([-.81, 1.04, .38], [.037, .037, .037], toon.gold);
  box([.64, 1.59, .295], [2.17, 1.15, .1], toon.green);
  box([.64, 1.59, .36], [1.99, .97, .035], toon.glass);
  box([.64, 1.59, .39], [.045, 1, .025], toon.green);
  box([.64, 1.59, .39], [2, .045, .025], toon.green);
  box([.64, 1.02, .5], [2.34, .1, .48], toon.wood);
  const shopSign = label('SIDE B  RECORDS', 2.5, .55, '#fff4db', '#315a4b');
  shopSign.position.set(.35, 2.49, .3);
  for (let i = 0; i < 12; i += 1) {
    const awning = box([-1.74 + i * .38, 2.05, .7], [.385, .07, .94], i % 2 ? toon.plaster : toon.rose, world);
    awning.rotation.x = .18;
    box([-1.74 + i * .38, 1.93, 1.16], [.383, .19, .065], i % 2 ? toon.plaster : toon.rose, world);
  }
  box([.35, .23, 1.28], [4.4, .32, 1.62], toon.wood);
  box([.35, .409, 1.28], [4.41, .035, 1.62], toon.cream);
  for (let i = 0; i < 7; i += 1) box([-1.58 + i * .63, .433, 1.28], [.015, .012, 1.6], toon.sand, world);
  box([.35, .115, 2.23], [2.6, .16, .42], toon.wood);

  // Speakers face the audience. A physical record carries the slow motion.
  function speaker(x) {
    const group = new THREE.Group(); group.position.set(x, .43, 1.4); world.add(group);
    box([0, .49, 0], [.47, .98, .45], toon.green, group);
    for (const [y, size] of [[.3, .157], [.74, .082]]) {
      const cone = cylinder([0, y, .239], [size, .025, size], toon.black, group); cone.rotation.x = Math.PI / 2;
      const centre = cylinder([0, y, .256], [size * .34, .027, size * .34], toon.leaf, group); centre.rotation.x = Math.PI / 2;
    }
  }
  speaker(-1.55); speaker(2.23);
  box([.47, .76, 1.39], [1.43, .61, .67], toon.green);
  box([.47, 1.09, 1.39], [1.56, .08, .79], toon.wood);
  const record = new THREE.Group(); record.position.set(.27, 1.145, 1.39); world.add(record);
  cylinder([0, 0, 0], [.36, .035, .36], toon.black, record);
  for (const radius of [.22, .265, .31]) {
    const material = new THREE.MeshBasicMaterial({ color: '#637166', side: THREE.DoubleSide }); materials.add(material);
    const groove = mesh(geometry(new THREE.RingGeometry(radius, radius + .005, 48)), material, [0, .021, 0], [1, 1, 1], record);
    groove.rotation.x = -Math.PI / 2; groove.castShadow = false;
  }
  cylinder([0, .024, 0], [.112, .006, .112], toon.rose, record);
  box([.035, .03, 0], [.016, .01, .12], toon.plaster, record);
  rod([.87, 1.2, 1.14], [.76, 1.24, 1.55], .016, toon.sand);
  rod([.76, 1.24, 1.55], [.53, 1.22, 1.61], .016, toon.sand);
  const frontSign = label('ONE NIGHT, TWO VIEWS', 1.29, .3, '#fff4db', '#315a4b');
  frontSign.position.set(.47, .77, 1.735);

  // A bench, record crate and a tiny noticeboard make it a place to stay.
  const bench = new THREE.Group(); bench.position.set(-2.85, .08, 1.55); bench.rotation.y = -.19; world.add(bench);
  for (const x of [-.63, .63]) {
    box([x, .25, 0], [.09, .5, .46], toon.green, bench);
    box([x, .59, -.22], [.075, 1.05, .085], toon.green, bench);
  }
  for (const z of [-.17, .01, .19]) box([0, .5, z], [1.68, .08, .14], toon.wood, bench);
  for (const y of [.77, .97]) box([0, y, -.24], [1.68, .13, .08], toon.wood, bench);
  box([2.98, .34, .59], [.77, .5, .72], toon.wood);
  for (let i = 0; i < 5; i += 1) box([2.98, .54 + (i % 2) * .035, .36 + i * .11], [.59, .55, .035], [toon.rose, toon.green, toon.plaster, toon.mint, toon.coral][i]);
  const recordSleeve = cylinder([2.98, .58, .851], [.18, .015, .18], toon.black); recordSleeve.rotation.x = Math.PI / 2;
  box([3.08, .36, 1.73], [.1, .65, .1], toon.green);
  const notice = box([3.08, .92, 1.73], [.68, .76, .07], toon.rose); notice.rotation.z = -.06;
  const noteLabel = label('LIVE / 17:00', .61, .18, '#354a40', '#edabb3'); noteLabel.position.set(3.08, .99, 1.775); noteLabel.rotation.z = -.06;

  let seed = 54;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function sakuraTree(x, z, height, size) {
    const tree = new THREE.Group(); tree.position.set(x, .08, z); world.add(tree);
    cylinder([0, .07, 0], [.53, .14, .53], toon.sand, tree);
    rod([0, .1, 0], [.12, height * .67, 0], .105, toon.wood, tree);
    const branches = [[-.57, height * .76, .09], [.7, height * .82, -.04], [.08, height, -.24], [.18, height * .72, .57]];
    branches.forEach(point => rod([.08, height * .48, 0], point, .055, toon.wood, tree));
    for (let i = 0; i < 12; i += 1) {
      const angle = i * 2.39996;
      const ring = i < 8 ? .71 : .32;
      const position = [Math.cos(angle) * ring * size, height - .2 + (random() - .5) * .59, Math.sin(angle) * ring * size];
      const scale = [.58 * size, (.46 + random() * .16) * size, .57 * size];
      const crown = ball(position, scale, [toon.rose, toon.blush, toon.petal][i % 3], tree);
      crown.receiveShadow = false;
    }
  }
  sakuraTree(-3.02, -.83, 3.42, 1.06);
  sakuraTree(3.13, -1.69, 3.72, 1.02);
  sakuraTree(-8, -4.1, 4.1, 1.3);
  sakuraTree(8.4, -4.8, 4.3, 1.2);
  // Hand-placed petals on the pavement stay visible in the still composition.
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -.5); petalShape.bezierCurveTo(-.5, -.15, -.5, .35, -.14, .5);
  petalShape.lineTo(0, .34); petalShape.lineTo(.14, .5); petalShape.bezierCurveTo(.5, .35, .5, -.15, 0, -.5);
  const petalGeometry = geometry(new THREE.ShapeGeometry(petalShape, 4));
  const petalMaterial = new THREE.MeshBasicMaterial({ color: '#e8a8b4', side: THREE.DoubleSide }); materials.add(petalMaterial);
  for (let i = 0; i < 21; i += 1) {
    const petal = mesh(petalGeometry, petalMaterial, [(random() - .5) * 7.5, .081, (random() - .5) * 4.8], [.12, .12, .12]);
    petal.rotation.set(-Math.PI / 2, 0, random() * Math.PI * 2); petal.castShadow = false;
  }
  const falling = new THREE.InstancedMesh(petalGeometry, petalMaterial, 19); world.add(falling);
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const drifts = Array.from({ length: 19 }, () => ({ x: (random() - .5) * 7.1, z: (random() - .5) * 4.1, phase: random() * 7, speed: .18 + random() * .13 }));
  const dummy = new THREE.Object3D();

  // One hanging wire, small warm lamps, no postprocessing glow.
  rod([-3.65, .1, 1.13], [-3.65, 3.28, 1.13], .035, toon.green);
  rod([3.72, .1, .96], [3.72, 3.55, .96], .035, toon.green);
  const wire = curve([[-3.65, 3.28, 1.13], [-1.8, 2.95, 1.085], [0, 2.86, 1.045], [1.9, 3.08, 1], [3.72, 3.55, .96]]);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffedb2' }); materials.add(lampMaterial);
  for (let i = 1; i < 12; i += 1) {
    const point = wire.getPoint(i / 12);
    rod(point.toArray(), [point.x, point.y - .13, point.z], .012, toon.green);
    const lamp = ball([point.x, point.y - .165, point.z], [.059, .075, .059], lampMaterial); lamp.castShadow = false;
  }

  const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: 2e6, maxPixelRatio: 1.5 });
  // The source street works in much larger units. Here the camera-to-shop
  // distance is ~16 units; keep its linework while letting rear houses fade.
  const ink = pipeline.ink.mat.uniforms;
  ink.uFadeStart.value = 20;
  ink.uFadeEnd.value = 36;
  ink.uSkyDepth.value = 65;
  ink.uStrength.value = .8;
  ink.uSens.value = .0038;
  pipeline.grade.mat.uniforms.uVignette.value = .06;
  pipeline.grade.mat.uniforms.uSaturation.value = 1.08;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let sceneTime = 0;
  let width = 0; let height = 0;
  function pose(time) {
    record.rotation.y = time * .24;
    drifts.forEach((drift, index) => {
      dummy.position.set(drift.x + Math.sin(time * .38 + drift.phase) * .27, .25 + ((drift.phase + 5.2 - time * drift.speed) % 4.1 + 4.1) % 4.1, drift.z + Math.cos(time * .21 + drift.phase) * .18);
      dummy.rotation.set(.5 + Math.sin(time * .5 + drift.phase) * .6, drift.phase + time * .13, time * .3 + drift.phase);
      dummy.scale.setScalar(.105); dummy.updateMatrix(); falling.setMatrixAt(index, dummy.matrix);
    });
    falling.instanceMatrix.needsUpdate = true;
  }
  function draw() { if (!disposed && width && height) pipeline.render(); }
  function tick(now) {
    frame = 0;
    if (disposed || !visible || document.hidden || reducedMotion.matches) return;
    if (!lastTime) lastTime = now;
    if (now - lastTime >= 1000 / 30) {
      sceneTime += Math.min((now - lastTime) / 1000, .1); lastTime = now;
      pose(sceneTime); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function updateMotion() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (disposed || !visible || document.hidden) return;
    if (reducedMotion.matches) { pose(0); draw(); }
    else { draw(); frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    width = Math.round(bounds.width); height = Math.round(bounds.height);
    if (!width || !height || disposed) return;
    const aspect = width / height;
    const viewHeight = Math.max(6.6, 9.8 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    pipeline.setSize(width, height);
    renderer.shadowMap.needsUpdate = true;
    draw();
  }
  pose(0);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    updateMotion();
  }, { threshold: .01 });
  intersectionObserver.observe(host);
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener('change', updateMotion);
  resize(); updateMotion();

  return () => {
    disposed = true; cancelAnimationFrame(frame);
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', updateMotion);
    reducedMotion.removeEventListener('change', updateMotion);
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
    celMaterials.dispose(); pipeline.dispose();
    sun.shadow.dispose();
    scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    canvas.remove(); host.classList.remove('sakura-scene');
  };
}

import { createSakuraPrintwork } from './sakura-printwork.js';

/**
 * Original procedural set for the music courtyard.
 * World units are metres; the shop faces +Z. The owner controls the camera,
 * lights, animation clock and disposal of the supplied resources.
 */
export function buildSakuraWorld({ THREE, world, mesh, box, cylinder, ball, rod, label, geometry, toon, cel, materials, textures }) {
  const group = (name, position = [0, 0, 0], parent = world) => {
    const object = new THREE.Group(); object.name = name;
    object.position.set(...position); parent.add(object); return object;
  };
  const action = (object, value) => { object.userData.action = value; return object; };
  const registerMaterial = material => { materials.add(material); return material; };
  const basic = color => registerMaterial(new THREE.MeshBasicMaterial({ color }));
  const creamInk = basic('#eee2bf');
  const darkInk = basic('#3e514c');
  // Night values: bulbs are warm, label paper is softened so it does not glare
  // against the dark yard, and the shop windows glow from inside.
  const warmLamp = basic('#ffe3a6');
  const paper = basic('#f9f0df');
  const windowGlow = cel({ color: '#f7d59a', emissive: '#ffb45c', emissiveIntensity: .85, bands: 'soft', flat: false });
  const prints = createSakuraPrintwork({ THREE, textures, materials });
  const warmWood = registerMaterial(cel({ color: '#b49179', map: prints.woodGrain, bands: 3, flat: false }));

  let seed = 267;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const square = new THREE.Shape();
  square.moveTo(-.32, -.4); square.lineTo(.32, -.4); square.quadraticCurveTo(.4, -.4, .4, -.32);
  square.lineTo(.4, .32); square.quadraticCurveTo(.4, .4, .32, .4);
  square.lineTo(-.32, .4); square.quadraticCurveTo(-.4, .4, -.4, .32);
  square.lineTo(-.4, -.32); square.quadraticCurveTo(-.4, -.4, -.32, -.4);
  const roundedGeometry = geometry(new THREE.ExtrudeGeometry(square, {
    depth: .8, steps: 1, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 3, curveSegments: 4,
  }));
  roundedGeometry.translate(0, 0, -.4);
  const roundBox = (position, scale, material = toon.cream, parent = world) => mesh(roundedGeometry, material, position, scale, parent);
  const ringGeometry = geometry(new THREE.TorusGeometry(1, .028, 6, 40));
  const leafGeometry = geometry(new THREE.SphereGeometry(1, 10, 6));
  function tube(points, radius, material = toon.green, parent = world) {
    const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return mesh(geometry(new THREE.TubeGeometry(path, 18, radius, 7, false)), material, [0, 0, 0], [1, 1, 1], parent);
  }
  function sign(text, position, width, height, color = '#f7eddb', background = '#42696a', parent = world) {
    const plane = label(text, width, height, color, background);
    parent.add(plane); plane.position.set(...position); plane.castShadow = false; return plane;
  }
  function noShadow(object) { object.castShadow = false; return object; }
  const printGeometry = geometry(new THREE.PlaneGeometry(1, 1));
  function printPanel(material, position, width, height, parent = world) {
    return noShadow(mesh(printGeometry, material, position, [width, height, 1], parent));
  }

  // Ground continues beyond the composition. A winding, slightly imperfect
  // sequence of stone pavers leads from the foreground into the open shop.
  // At night the outer ground is a dim violet grey; the paved yard reads as a lit island.
  noShadow(box([0, -.16, -1], [58, .22, 48], cel({ color: '#938da6', bands: 3, flat: false })));
  noShadow(roundBox([-.2, -.015, .1], [13.8, .16, 10.7], toon.cream));
  const stoneColors = [toon.plaster, toon.sand, toon.cream];
  for (let i = 0; i < 7; i++) {
    const stone = roundBox([Math.sin(i * .54) * .4, .095, 5.45 - i * .69], [.94 + (i % 2) * .18, .09, .56], stoneColors[i % 3]);
    stone.rotation.y = Math.sin(i * 1.8) * .11; stone.castShadow = false;
  }
  for (let i = 0; i < 5; i++) {
    const stone = roundBox([-1.05 - i * .62, .081, 2.21 + Math.sin(i * .6) * .18], [.58, .075, .42], stoneColors[(i + 1) % 3]);
    stone.rotation.y = -.15 + i * .06; stone.castShadow = false;
  }
  for (let i = 0; i < 5; i++) {
    const stone = roundBox([1.18 + i * .59, .081, 2.64 - i * .11], [.53, .075, .46], stoneColors[i % 3]);
    stone.rotation.y = .15 - i * .04; stone.castShadow = false;
  }

  // A real three-sided interior: the facade is an opening, not a painted cube.
  const shop = group('open-record-shop', [0, 0, -1.5]);
  box([0, .075, 0], [4.92, .22, 3.92], toon.sand, shop);
  const floorColors = [toon.wood, toon.cream, toon.sand];
  for (let x = 0; x < 12; x++) {
    box([-2.205 + x * .401, .209, 0], [.392, .045, 3.72], floorColors[x % 5 === 0 ? 1 : 0], shop);
    // Quiet nail heads and one seam per plank are enough in a close camera.
    for (const z of [-1.66, 1.66]) {
      const nail = cylinder([-2.205 + x * .401, .235, z], [.013, .004, .013], toon.ink, shop);
      nail.castShadow = false;
    }
  }
  const shopLeftWall = box([-2.34, 1.6, 0], [.15, 2.8, 3.8], toon.plaster, shop);
  box([2.34, 1.6, 0], [.15, 2.8, 3.8], toon.plaster, shop);
  box([0, 1.6, -1.84], [4.8, 2.8, .15], toon.plaster, shop);
  for (const x of [-2.24, 2.24]) box([x, .41, 0], [.08, .38, 3.7], toon.green, shop);
  box([0, .41, -1.75], [4.5, .38, .08], toon.green, shop);
  for (const x of [-2.32, 2.32]) {
    box([x, 1.62, 1.85], [.18, 2.86, .18], toon.green, shop);
    box([x, 2.87, 0], [.16, .16, 3.88], warmWood, shop);
  }
  const shopFrontBeam = box([0, 2.88, 1.85], [4.72, .22, .2], toon.green, shop);
  box([0, .14, 2.18], [4.96, .2, .63], warmWood, shop);
  box([0, .25, 2.18], [4.95, .035, .61], toon.cream, shop);
  for (const x of [-1.84, 1.84]) {
    // Folded shutters visibly frame a wide, usable entrance.
    const shutter = group('folded-entrance-shutter', [x, 1.49, 1.71], shop);
    shutter.rotation.y = x < 0 ? -.45 : .45;
    roundBox([0, 0, 0], [.58, 2.35, .08], toon.green, shutter);
    for (let j = 0; j < 7; j++) box([0, -.9 + j * .29, .052], [.45, .038, .025], toon.leaf, shutter);
    ball([x < 0 ? .16 : -.16, -.06, .081], [.033, .033, .028], toon.gold, shutter);
  }

  // Window, shelf and a small framed print keep the room legible from inside.
  roundBox([-.92, 1.95, -1.73], [1.68, 1.12, .07], toon.green, shop);
  box([-.92, 1.95, -1.68], [1.46, .91, .025], windowGlow, shop);
  box([-.92, 1.95, -1.65], [.045, .96, .035], toon.cream, shop);
  box([-.92, 1.95, -1.65], [1.48, .045, .035], toon.cream, shop);
  box([-.92, 1.37, -1.57], [1.86, .08, .35], warmWood, shop);
  for (const x of [-1.58, -.25]) {
    rod([x, 2.59, -1.56], [x, 1.42, -1.56], .036, toon.coral, shop);
    for (let j = 0; j < 3; j++) box([x + (j - 1) * .075, 2.1, -1.55], [.08, 1.02, .052], toon.rose, shop);
  }
  const print = roundBox([.89, 2.33, -1.71], [.69, .64, .055], warmWood, shop);
  box([.89, 2.33, -1.672], [.56, .52, .014], toon.cream, shop);
  noShadow(ball([.96, 2.39, -1.645], [.15, .15, .011], toon.coral, shop));
  noShadow(box([.89, 2.16, -1.64], [.51, .09, .011], toon.leaf, shop));
  print.userData.decorative = true;
  // Recessed mouldings and small plaster joints give the side walls depth.
  for (const x of [-2.437, 2.437]) {
    for (const z of [-1.31, -.72, -.13, .46, 1.05]) {
      box([x, .45, z], [.025, .018, .42], toon.sand, shop);
    }
    box([x, 1.91, -.44], [.075, 1.25, 1.52], toon.green, shop);
    box([x * 1.021, 1.91, -.44], [.028, 1.08, 1.34], windowGlow, shop);
    box([x * 1.031, 1.91, -.44], [.021, 1.12, .046], toon.cream, shop);
    box([x * 1.031, 1.91, -.44], [.021, .046, 1.37], toon.cream, shop);
    box([x * 1.031, 1.244, -.44], [.22, .07, 1.67], warmWood, shop);
  }
  const wallPoster = group('acoustic-session-poster', [2.469, 1.55, 1.03], shop);
  wallPoster.rotation.y = Math.PI / 2; wallPoster.rotation.z = -.034;
  printPanel(prints.poster, [0, 0, .019], .48, .64, wallPoster);
  for (const x of [-.16, .16]) {
    const tape = noShadow(box([x, .316, .027], [.095, .027, .008], toon.sand, wallPoster));
    tape.rotation.z = x < 0 ? -.19 : .13;
  }
  // Pendant fittings belong to the roof group so a close overhead camera can
  // remove the whole ceiling without leaving a cable across the composition.
  const roof = group('removable-shop-roof', [0, 0, -1.5]);
  const roofSlope = Math.atan2(.78, 2.65);
  const roofLength = Math.hypot(2.65, .78);
  for (const side of [-1, 1]) {
    const pitch = box([side * 1.325, 3.43, 0], [roofLength, .13, 4.32], toon.green, roof);
    pitch.rotation.z = -side * roofSlope;
    for (let i = 0; i < 9; i++) {
      const seam = box([side * 1.325, 3.505, -1.97 + i * .493], [roofLength, .024, .032], toon.leaf, roof);
      seam.rotation.z = -side * roofSlope;
    }
    box([side * 2.66, 3.028, 0], [.1, .14, 4.37], toon.leaf, roof);
  }
  box([0, 3.851, 0], [.12, .12, 4.44], toon.leaf, roof);
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.45, 0); gableShape.lineTo(2.45, 0); gableShape.lineTo(0, .72); gableShape.closePath();
  const gableGeometry = geometry(new THREE.ExtrudeGeometry(gableShape, { depth: .08, bevelEnabled: false }));
  for (const z of [-2, 1.91]) mesh(gableGeometry, toon.cream, [0, 3.02, z], [1, 1, 1], roof);
  roundBox([0, 3.293, 2.043], [2.14, .53, .086], warmWood, roof);
  printPanel(prints.marquee, [0, 3.293, 2.1], 2.025, .506, roof);
  for (const x of [-.952, .952]) {
    const nail = cylinder([x, 3.293, 2.116], [.015, .009, .015], toon.gold, roof); nail.rotation.x = Math.PI / 2;
  }
  // A curved canvas awning has an actual underside and scalloped hem. Each
  // colour is one geometry, so the stripes do not cost one draw per panel.
  const awningBins = [[], []];
  const pushTriangle = (vertices, a, b, c) => vertices.push(...a, ...b, ...c);
  const stripeWidth = 3.84 / 12;
  const awningPoint = (x, t) => [x, 2.93 - Math.sin(t * Math.PI / 2) * .39, 1.93 + t * .79];
  for (let i = 0; i < 12; i++) {
    const vertices = awningBins[i % 2];
    const left = -1.92 + i * stripeWidth;
    const right = left + stripeWidth;
    for (let step = 0; step < 8; step++) {
      const a = awningPoint(left, step / 8); const b = awningPoint(right, step / 8);
      const c = awningPoint(right, (step + 1) / 8); const d = awningPoint(left, (step + 1) / 8);
      pushTriangle(vertices, a, c, b); pushTriangle(vertices, a, d, c);
      // Back-facing triangles shade the visible underside in close views.
      pushTriangle(vertices, b, c, a); pushTriangle(vertices, c, d, a);
    }
    for (let step = 0; step < 6; step++) {
      const u = step / 6; const v = (step + 1) / 6;
      const a = [left + stripeWidth * u, 2.54, 2.72]; const b = [left + stripeWidth * v, 2.54, 2.72];
      const c = [b[0], 2.48 - Math.sin(v * Math.PI) * .078, 2.72];
      const d = [a[0], 2.48 - Math.sin(u * Math.PI) * .078, 2.72];
      pushTriangle(vertices, a, d, c); pushTriangle(vertices, a, c, b);
    }
  }
  awningBins.forEach((vertices, index) => {
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); shape.computeVertexNormals();
    mesh(shape, index ? toon.coral : toon.cream, [0, 0, 0], [1, 1, 1], roof);
  });
  for (const x of [-1.92, 1.92]) {
    rod([x, 2.4, 1.9], [x, 2.54, 2.72], .017, toon.green, roof);
  }
  // A hanging record reads from the oblique courtyard shot as well as the door.
  rod([2.57, 3.06, 1.69], [3.1, 3.06, 1.69], .031, toon.green, roof);
  rod([3.02, 3.05, 1.69], [3.02, 2.73, 1.69], .012, toon.gold, roof);
  const badge = cylinder([3.02, 2.421, 1.69], [.32, .064, .32], toon.gold, roof); badge.rotation.x = Math.PI / 2;
  noShadow(mesh(geometry(new THREE.CircleGeometry(.299, 40)), prints.badge, [3.02, 2.421, 1.728], [1, 1, 1], roof));
  for (const x of [-1.15, 1.15]) {
    rod([x, 3.13, .48], [x, 2.63, .48], .019, toon.ink, roof);
    const shadeGeometry = geometry(new THREE.CylinderGeometry(.12, .27, .2, 24, 1, true));
    mesh(shadeGeometry, toon.green, [x, 2.57, .48], [1, 1, 1], roof);
    noShadow(ball([x, 2.53, .48], [.11, .065, .11], warmLamp, roof));
  }

  // Counter outside the opening: platter, grooves, spindle, articulated arm,
  // receiver controls and an upright sleeve read at a close tabletop angle.
  const counter = action(group('record-counter', [0, 0, .8]), { type: 'navigate', view: 'explore' });
  roundBox([0, .61, 0], [2.08, 1.05, .78], toon.green, counter);
  roundBox([0, 1.17, 0], [2.26, .14, .94], warmWood, counter);
  for (let i = 0; i < 14; i++) box([-.96 + i * .147, .67, .399], [.058, .69, .021], toon.leaf, counter);
  sign('SIDE B', [0, .899, .424], .57, .13, '#efe4c7', '#42696a', counter);
  const turntable = roundBox([-.28, 1.296, -.015], [1.12, .12, .69], toon.cream, counter);
  turntable.userData.action = { type: 'navigate', view: 'explore' };
  const record = action(group('spinning-vinyl', [-.45, 1.37, .8]), { type: 'navigate', view: 'explore' });
  cylinder([0, 0, 0], [.275, .024, .275], toon.black, record);
  for (const radius of [.158, .187, .218, .25]) {
    const groove = noShadow(mesh(ringGeometry, toon.leaf, [0, .014, 0], [radius, radius, radius], record));
    groove.rotation.x = -Math.PI / 2;
  }
  cylinder([0, .02, 0], [.085, .012, .085], toon.coral, record);
  box([.016, .029, 0], [.012, .007, .079], paper, record);
  cylinder([0, .044, 0], [.014, .055, .014], toon.gold, record);
  cylinder([.097, 1.385, -.206], [.035, .075, .035], toon.gold, counter);
  rod([.097, 1.435, -.206], [.147, 1.459, .144], .011, toon.ink, counter);
  rod([.147, 1.459, .144], [.015, 1.439, .181], .011, toon.ink, counter);
  roundBox([.008, 1.419, .18], [.059, .038, .039], toon.black, counter);
  roundBox([.707, 1.372, -.025], [.41, .24, .41], toon.green, counter);
  for (const x of [.593, .718, .823]) {
    const knob = cylinder([x, 1.37, .199], [.035, .03, .035], toon.gold, counter); knob.rotation.x = Math.PI / 2;
  }
  box([.7, 1.441, .188], [.245, .035, .018], warmLamp, counter);
  const sleeveStand = group('now-playing-sleeve', [.57, 1.58, -.286], counter);
  sleeveStand.rotation.x = -.14;
  roundBox([0, 0, 0], [.49, .49, .032], toon.coral, sleeveStand);
  printPanel(prints.sleeves[0], [0, 0, .025], .454, .454, sleeveStand);
  // The listening corner has a resting pair of headphones and a ceramic cup.
  const headphones = group('counter-headphones', [.29, 1.255, .25], counter);
  headphones.rotation.y = -.31;
  tube([[-.105, .043, 0], [-.14, .065, -.145], [0, .081, -.23], [.14, .065, -.145], [.105, .043, 0]], .019, toon.ink, headphones);
  for (const x of [-.1, .1]) {
    roundBox([x, .036, .006], [.078, .047, .111], toon.coral, headphones);
    roundBox([x, .059, .006], [.055, .009, .079], toon.cream, headphones);
  }
  cylinder([-.92, 1.339, -.21], [.068, .154, .068], toon.coral, counter);
  cylinder([-.92, 1.419, -.21], [.059, .01, .059], toon.cream, counter);
  cylinder([-.92, 1.425, -.21], [.047, .007, .047], toon.wood, counter);
  const cupHandle = noShadow(mesh(geometry(new THREE.TorusGeometry(.04, .014, 7, 16)), toon.coral, [-.845, 1.354, -.21], [1, 1, 1], counter));
  cupHandle.rotation.y = Math.PI / 2;

  // Interior record cabinet, open at the front. Gaps and slanted sleeves keep
  // it from reading as a solid bookshelf cube in the records camera.
  const shelf = action(group('memory-record-cabinet', [1.45, 0, -2.3]), { type: 'navigate', view: 'records' });
  box([0, 1.15, -.275], [1.4, 2.18, .07], warmWood, shelf);
  for (const x of [-.72, .72]) roundBox([x, 1.15, 0], [.09, 2.28, .67], toon.green, shelf);
  for (const y of [.15, .83, 1.52, 2.25]) box([0, y, 0], [1.53, .075, .71], toon.green, shelf);
  box([0, .51, .02], [.055, .58, .61], toon.green, shelf);
  const sleeveColors = [toon.rose, toon.cream, toon.mint, toon.gold, toon.coral];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 10; i++) {
      const item = roundBox([-.594 + i * .13, .487 + row * .689, .038], [.092, .56 - (i % 3) * .028, .45], sleeveColors[(i + row * 2) % sleeveColors.length], shelf);
      item.rotation.z = (i < 4 ? -.055 : .018);
      noShadow(box([item.position.x, item.position.y + .105, .268], [.041, .1, .009], paper, shelf));
    }
  }
  for (let i = 0; i < 3; i++) {
    const album = group(`face-out-album-${i}`, [-.455 + i * .457, 1.871, .053], shelf);
    roundBox([0, 0, 0], [.39, .5, .03], sleeveColors[i * 2], album);
    printPanel(prints.sleeves[i], [0, .018, .025], .362, .362, album);
  }
  sign('33 / 45', [0, 2.255, .373], .41, .12, '#f2e7d3', '#42696a', shelf);

  // A low timber platform under the tree: a stool and a resting guitar make a
  // quiet listening corner. It is ambiance only and carries no action.
  const stage = group('tree-side-stage', [-4, 0, .5]);
  cylinder([0, .15, 0], [1.2, .23, 1.2], warmWood, stage);
  cylinder([0, .279, 0], [1.21, .04, 1.21], toon.cream, stage);
  for (let i = -3; i <= 3; i++) {
    const z = i * .285;
    const halfWidth = Math.sqrt(1.19 ** 2 - z ** 2);
    noShadow(box([0, .302, z], [halfWidth * 2, .006, .015], warmWood, stage));
  }
  const performanceStool = group('performance-stool', [-.43, .3, -.17], stage);
  cylinder([0, .52, 0], [.23, .08, .23], toon.green, performanceStool);
  for (const x of [-.155, .155]) for (const z of [-.155, .155]) rod([x, 0, z], [x * .85, .5, z * .85], .025, warmWood, performanceStool);
  const guitar = group('acoustic-guitar', [-.78, .62, .05], stage);
  guitar.rotation.z = -.19; guitar.rotation.y = .1;
  ball([0, 0, 0], [.2, .215, .07], toon.gold, guitar);
  ball([0, .225, 0], [.16, .171, .061], toon.gold, guitar);
  const soundHole = cylinder([0, .159, .063], [.062, .012, .062], toon.ink, guitar); soundHole.rotation.x = Math.PI / 2;
  roundBox([0, .518, -.012], [.061, .48, .037], warmWood, guitar);
  roundBox([0, .793, -.017], [.083, .119, .043], toon.cream, guitar);
  box([0, -.022, .073], [.103, .033, .011], toon.ink, guitar);
  for (let i = 0; i < 4; i++) rod([-.017 + i * .011, -.011, .084], [-.017 + i * .011, .825, .023], .0017, creamInk, guitar);
  for (const x of [-.06, .06]) for (const y of [.766, .813]) ball([x, y, -.012], [.019, .011, .013], toon.gold, guitar);

  function pot(position, size = 1, flowers = false, parent = world) {
    const planter = group('courtyard-planter', position, parent);
    const potGeometry = geometry(new THREE.CylinderGeometry(.19, .133, .31, 14));
    mesh(potGeometry, toon.coral, [0, .155 * size, 0], [size, size, size], planter);
    cylinder([0, .298 * size, 0], [.198 * size, .046 * size, .198 * size], toon.cream, planter);
    cylinder([0, .32 * size, 0], [.165 * size, .009 * size, .165 * size], toon.wood, planter);
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      const end = [Math.cos(angle) * .13 * size, (.54 + (i % 2) * .11) * size, Math.sin(angle) * .13 * size];
      rod([0, .3 * size, 0], end, .008 * size, toon.green, planter);
      const leaf = mesh(leafGeometry, i % 2 ? toon.leaf : toon.mint, [end[0] * .7, end[1] * .87, end[2] * .7], [.079 * size, .16 * size, .028 * size], planter);
      leaf.rotation.set(.35, angle, .45);
      if (flowers) {
        for (let j = 0; j < 5; j++) {
          const theta = j * Math.PI * 2 / 5;
          ball([end[0] + Math.cos(theta) * .045 * size, end[1], end[2] + Math.sin(theta) * .045 * size], [.032 * size, .02 * size, .032 * size], i % 2 ? toon.blush : toon.rose, planter);
        }
        ball(end, [.018 * size, .023 * size, .018 * size], toon.gold, planter);
      }
    }
    return planter;
  }
  pot([-2.63, .085, .29], 1.18, true);
  pot([2.69, .085, .09], 1.1, false);
  pot([-.76, .238, -2.84], .75, false);
  pot([-5.21, .085, 2.56], .85, true);

  // A quiet waiting corner fills the side of the yard, leaving the central
  // route to the shop clear. Slats, a tote and records tell one story.
  const bench = group('listening-bench', [4.31, .065, -1.12]);
  bench.rotation.y = -.18;
  for (const x of [-.77, .77]) {
    rod([x, .015, -.25], [x, .6, -.25], .042, toon.green, bench);
    rod([x, .015, .26], [x, .48, .26], .042, toon.green, bench);
    rod([x, .06, -.27], [x, 1.05, -.38], .041, toon.green, bench);
    rod([x, .41, -.29], [x, .41, .3], .034, toon.green, bench);
  }
  for (let i = 0; i < 4; i++) {
    roundBox([0, .493, -.23 + i * .158], [1.91, .077, .136], i % 2 ? toon.cream : warmWood, bench);
  }
  for (const y of [.748, .949]) {
    const slat = roundBox([0, y, -.351 - (y - .7) * .13], [1.91, .146, .071], warmWood, bench);
    slat.rotation.x = -.1;
  }
  const tote = group('record-shop-tote', [.39, .57, -.005], bench);
  tote.rotation.z = -.065;
  roundBox([0, .19, 0], [.36, .38, .115], toon.cream, tote);
  tube([[-.11, .335, .066], [-.105, .57, .045], [.108, .57, .045], [.11, .335, .066]], .013, warmWood, tote);
  const totePrint = printPanel(prints.sleeves[1], [0, .185, .07], .19, .19, tote);
  totePrint.rotation.z = .04;
  const crate = group('record-crate', [3.15, .081, -.89]);
  crate.rotation.y = -.16;
  box([0, .041, 0], [.48, .075, .53], warmWood, crate);
  for (const x of [-.218, .218]) for (const z of [-.24, .24]) box([x, .183, z], [.041, .35, .04], toon.green, crate);
  for (const y of [.14, .28]) {
    for (const x of [-.23, .23]) box([x, y, 0], [.036, .1, .54], warmWood, crate);
    for (const z of [-.251, .251]) box([0, y, z], [.49, .1, .035], warmWood, crate);
  }
  for (let i = 0; i < 6; i++) {
    const album = group(`crate-record-${i}`, [0, .33, -.16 + i * .056], crate);
    album.rotation.x = -.08 - i * .023;
    roundBox([0, 0, 0], [.4, .4, .018], sleeveColors[i % sleeveColors.length], album);
    if (i === 5) printPanel(prints.sleeves[2], [0, 0, .015], .38, .38, album);
  }
  pot([5.43, .085, -.76], 1.48, false);

  // Broad, low leaves read as a planted border from the elevated camera.
  // Solid curved leaves avoid the ink-like edge of upright single-sided grass.
  const meadowMaterials = [
    registerMaterial(cel({ color: '#aabd9d', bands: 'soft', flat: false })),
    registerMaterial(cel({ color: '#c1cdb0', bands: 'soft', flat: false })),
  ];
  const bladeTransform = new THREE.Object3D();
  const meadow = [[], []];
  const flowerCenters = [];
  [[-5.52, 3.22, .58, .79], [5.6, 2.63, .65, 1.12], [-5.9, -2.94, .37, .73]].forEach(([x, z, spreadX, spreadZ]) => {
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.39996; const radius = Math.sqrt((i + 1) / 14);
      const px = x + Math.cos(angle) * radius * spreadX;
      const pz = z + Math.sin(angle) * radius * spreadZ;
      const scale = .72 + random() * .46;
      for (let blade = 0; blade < 5; blade++) meadow[(i + blade) % 2].push({ x: px, z: pz, scale, angle: blade * 1.257 + i });
      if (i % 3 === 0) flowerCenters.push([px, .09 + .17 * scale, pz]);
    }
  });
  meadow.forEach((blades, index) => {
    const instances = new THREE.InstancedMesh(leafGeometry, meadowMaterials[index], blades.length);
    instances.name = `garden-leaf-clusters-${index}`;
    blades.forEach((blade, i) => {
      bladeTransform.position.set(blade.x + Math.sin(blade.angle) * .09, .12, blade.z + Math.cos(blade.angle) * .09);
      bladeTransform.scale.set(.088 * blade.scale, .031 * blade.scale, .182 * blade.scale);
      bladeTransform.rotation.set(.16, blade.angle, 0); bladeTransform.updateMatrix(); instances.setMatrixAt(i, bladeTransform.matrix);
    });
    world.add(instances);
  });
  flowerCenters.forEach(([x, y, z], index) => {
    rod([x, .09, z], [x, y, z], .008, toon.mint);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      const blossom = noShadow(ball([x + Math.cos(angle) * .055, y, z + Math.sin(angle) * .055], [.048, .015, .041], index % 3 ? toon.petal : toon.blush));
      blossom.receiveShadow = false;
    }
    const center = noShadow(ball([x, y + .014, z], [.021, .014, .021], toon.gold)); center.receiveShadow = false;
  });

  // Branch geometry supports the crown. Clusters are instanced by colour so
  // the canopy is rich without one draw call per blossom-shaped volume.
  const crownGeometry = geometry(new THREE.IcosahedronGeometry(1, 2));
  const crownVertices = crownGeometry.attributes.position;
  for (let i = 0; i < crownVertices.count; i++) {
    const x = crownVertices.getX(i); const y = crownVertices.getY(i); const z = crownVertices.getZ(i);
    const scallop = 1 + .065 * Math.sin(x * 6.1 + z * 2.4) * Math.cos(y * 5.3 - z * 3.8);
    crownVertices.setXYZ(i, x * scallop, y * scallop, z * scallop);
  }
  // Keep the source's smooth radial normals; recomputing this non-indexed
  // geometry would turn each blossom volume into a visibly faceted gemstone.
  const crownBins = [[], [], []];
  function cherryTree(position, scale, canopyCount = 48) {
    const tree = group('cherry-tree', position);
    tree.scale.setScalar(scale);
    tube([[0, .035, 0], [.08, 1.14, -.03], [-.035, 2.24, .11], [.24, 3.13, .02]], .135, warmWood, tree);
    const endpoints = [[-1.02, 3.5, -.32], [.93, 3.59, -.49], [-.58, 3.27, .89], [.98, 3.36, .81], [.17, 4.06, .12]];
    endpoints.forEach((end, index) => {
      const start = [.02, 1.76 + index * .135, .04];
      tube([start, [end[0] * .4, end[1] - .67, end[2] * .4], end], .049 + (index % 2) * .008, warmWood, tree);
      rod(end, [end[0] * 1.22, end[1] + .22, end[2] * 1.22], .023, warmWood, tree);
      if (index < 4) tube([end, [end[0] * 1.25, end[1] + .13, end[2] * 1.2], [end[0] * 1.42, end[1] - .22, end[2] * 1.33]], .015, warmWood, tree);
    });
    for (let i = 0; i < 5; i++) {
      const angle = i * 1.256;
      rod([0, .11, 0], [Math.cos(angle) * .45, .02, Math.sin(angle) * .45], .035, warmWood, tree);
    }
    for (let i = 0; i < canopyCount; i++) {
      // Five branch-led lobes leave sky between the crowns. Smaller volumes
      // along their rims avoid the former flat cap of equally sized spheres.
      const branch = endpoints[i % endpoints.length];
      const ring = Math.floor(i / endpoints.length);
      const angle = ring * 2.399963 + (i % endpoints.length) * .61;
      const radius = Math.sqrt((ring + .6) / Math.ceil(canopyCount / endpoints.length)) * .68;
      const local = new THREE.Vector3(
        branch[0] * .87 + Math.cos(angle) * radius,
        branch[1] + .24 + Math.cos(radius * 2.3) * .19 + (random() - .5) * .22,
        branch[2] * .93 + Math.sin(angle) * radius * .87,
      );
      local.multiplyScalar(scale).add(new THREE.Vector3(...position));
      const size = (.27 + random() * .13) * scale;
      const color = radius > .5 ? 0 : i % 3 === 0 ? 2 : 1;
      crownBins[color].push({ position: local, scale: [size * (1.05 + random() * .24), size * (.73 + random() * .19), size], rotation: random() * Math.PI });
      if (i % 7 === 0 && canopyCount > 60) {
        for (let petal = 0; petal < 5; petal++) {
          const theta = petal * Math.PI * 2 / 5;
          const flower = local.clone().add(new THREE.Vector3(Math.cos(theta) * .105 * scale, size * .68, Math.sin(theta) * .105 * scale));
          crownBins[2].push({ position: flower, scale: [.095 * scale, .042 * scale, .07 * scale], rotation: -theta });
        }
      }
    }
    return tree;
  }
  cherryTree([-4.5, .045, -1.5], 1.06, 90);
  cherryTree([5.3, .02, -3.5], .88, 70);
  cherryTree([-9.2, -.02, -6.7], .95, 39);
  cherryTree([9.4, -.02, -7.4], 1.08, 39);
  const transform = new THREE.Object3D();
  // Night blossom has its own faint self-light; curtains, pots and flowers keep the plain rose materials.
  const blossomMaterials = [
    cel({ color: '#fbc6d8', bands: 'soft', flat: false, emissive: '#7a3d5e', emissiveIntensity: .75 }),
    cel({ color: '#fedde2', bands: 'soft', flat: false, emissive: '#7a3d5e', emissiveIntensity: .7 }),
    cel({ color: '#fff0f4', bands: 'soft', flat: false, emissive: '#8f5a78', emissiveIntensity: .6 }),
  ];
  blossomMaterials.forEach((material, index) => {
    const data = crownBins[index];
    const canopies = new THREE.InstancedMesh(crownGeometry, material, data.length);
    canopies.name = `cherry-canopy-${index}`; canopies.castShadow = true; canopies.receiveShadow = false;
    data.forEach((item, n) => {
      transform.position.copy(item.position); transform.scale.set(...item.scale); transform.rotation.set(.1, item.rotation, .12);
      transform.updateMatrix(); canopies.setMatrixAt(n, transform.matrix);
    });
    world.add(canopies);
  });

  // A fence ends the courtyard, followed by a quiet lane and low-contrast
  // roofs. Background construction deliberately avoids a wall of bare boxes.
  const fence = group('courtyard-fence');
  for (let i = 0; i < 14; i++) {
    const x = -6.52 + i;
    roundBox([x, .51, -4.51], [.12, 1.03, .13], toon.mint, fence);
  }
  for (const y of [.35, .8]) box([0, y, -4.48], [13.6, .07, .065], toon.leaf, fence);
  for (const x of [-6.52, 6.52]) {
    for (let i = 1; i < 8; i++) roundBox([x, .4, -4.5 + i * .89], [.11, .81, .11], toon.mint, fence);
    for (const y of [.3, .67]) box([x, y, -.94], [.055, .065, 7.1], toon.leaf, fence);
  }
  const quietPlaster = basic('#3d4166');
  const quietRoof = basic('#2c3052');
  const quietGlass = basic('#ffc978');
  const quietGlassDark = basic('#2a2f52');
  const quietTrim = basic('#4b4f75');
  const quietJoinery = basic('#353a5f');
  const quietRose = basic('#6a4a66');
  const distantGable = new THREE.Shape();
  distantGable.moveTo(-1.7, 0); distantGable.lineTo(1.7, 0); distantGable.lineTo(0, .52); distantGable.closePath();
  const distantGableGeometry = geometry(new THREE.ExtrudeGeometry(distantGable, { depth: .035, bevelEnabled: false }));
  for (let i = 0; i < 5; i++) {
    const neighbour = group(`quiet-neighbour-${i}`, [-11 + i * 5.2, -.08, -10.8 - (i % 2) * 1.4]);
    const h = 2.1 + (i % 3) * .43;
    noShadow(roundBox([0, h / 2, 0], [3.4, h, 2.6], quietPlaster, neighbour));
    for (const z of [-1.3, 1.3]) noShadow(mesh(distantGableGeometry, quietPlaster, [0, h, z], [1, 1, 1], neighbour));
    for (const side of [-1, 1]) {
      const pitch = noShadow(box([side * .89, h + .26, 0], [1.95, .1, 3], quietRoof, neighbour)); pitch.rotation.z = side * -.27;
      noShadow(box([side * 1.83, h + .028, 0], [.067, .11, 3.08], quietJoinery, neighbour));
      for (const z of [-1.17, -.58, .01, .6, 1.19]) {
        const seam = noShadow(box([side * .89, h + .323, z], [1.95, .016, .024], quietTrim, neighbour)); seam.rotation.z = side * -.27;
      }
    }
    noShadow(box([0, h + .553, 0], [.1, .082, 3.1], quietTrim, neighbour));
    noShadow(box([0, .136, 1.364], [3.5, .21, .12], quietTrim, neighbour));
    noShadow(box([0, h - .08, 1.357], [3.46, .082, .08], quietTrim, neighbour));
    for (const x of [-.83, .8]) {
      noShadow(box([x, h - .72, 1.319], [.83, 1.015, .036], quietTrim, neighbour));
      noShadow(box([x, h - .72, 1.348], [.71, .9, .019], (i + (x > 0 ? 1 : 0)) % 3 === 1 ? quietGlassDark : quietGlass, neighbour));
      noShadow(box([x, h - .72, 1.37], [.036, .94, .022], quietTrim, neighbour));
      noShadow(box([x, h - .69, 1.37], [.74, .036, .022], quietTrim, neighbour));
      noShadow(box([x, h - 1.2, 1.388], [.9, .056, .22], quietJoinery, neighbour));
      if ((i + (x > 0 ? 1 : 0)) % 3 === 0) {
        for (const side of [-1, 1]) noShadow(box([x + side * .445, h - .72, 1.354], [.12, .98, .049], quietRose, neighbour));
      }
    }
    noShadow(box([0, .682, 1.365], [.67, 1.31, .081], quietTrim, neighbour));
    noShadow(box([0, .665, 1.415], [.51, 1.19, .027], quietJoinery, neighbour));
    noShadow(box([0, .975, 1.434], [.33, .37, .015], quietGlass, neighbour));
    noShadow(ball([.165, .604, 1.455], [.023, .023, .012], quietRoof, neighbour));
    noShadow(box([0, .072, 1.499], [.77, .094, .39], quietTrim, neighbour));
    // One shallow balcony and a few flower boxes keep the row varied.
    if (i === 1 || i === 3) {
      const balconyY = h - 1.23;
      noShadow(box([.8, balconyY, 1.54], [1.04, .066, .48], quietTrim, neighbour));
      noShadow(box([.8, balconyY + .31, 1.756], [1.02, .031, .031], quietJoinery, neighbour));
      for (let bar = 0; bar < 5; bar++) noShadow(box([.365 + bar * .218, balconyY + .17, 1.755], [.028, .29, .028], quietJoinery, neighbour));
    } else {
      noShadow(box([-.83, h - 1.13, 1.479], [.62, .14, .17], quietRose, neighbour));
      for (const x of [-1.03, -.83, -.63]) noShadow(ball([x, h - 1.035, 1.47], [.113, .071, .081], quietJoinery, neighbour));
    }
    // The right side is visible in the main shot, with a complete inset window.
    noShadow(box([1.726, h - .72, .12], [.048, .86, .76], quietTrim, neighbour));
    noShadow(box([1.758, h - .72, .12], [.022, .71, .62], i % 2 ? quietGlassDark : quietGlass, neighbour));
    noShadow(box([1.774, h - .72, .12], [.018, .75, .031], quietTrim, neighbour));
    noShadow(box([1.781, h - 1.167, .12], [.16, .053, .83], quietJoinery, neighbour));
  }
  // Atmospheric shapes sit beyond the neighbours, below the main shop's
  // silhouette. A low rolling horizon replaces the empty end of the ground.
  const farHill = basic('#2f2b55');
  const nearHill = basic('#27264b');
  [[-15, -.8, -23, 12, 3.8, 4], [3, -1, -24, 14, 4.7, 4.2], [21, -.8, -24, 12, 3.7, 4]].forEach(([x, y, z, sx, sy, sz]) => {
    const hill = noShadow(ball([x, y, z], [sx, sy, sz], farHill)); hill.receiveShadow = false;
  });
  [[-15, -.8, -18.9, 9, 2.7, 2.9], [9, -.8, -19.5, 12, 2.9, 2.9]].forEach(([x, y, z, sx, sy, sz]) => {
    const hill = noShadow(ball([x, y, z], [sx, sy, sz], nearHill)); hill.receiveShadow = false;
  });
  const shrubGeometry = geometry(new THREE.IcosahedronGeometry(1, 1));
  const shrubMaterials = [toon.mint, toon.leaf];
  for (let i = 0; i < 20; i++) {
    const x = -6.25 + i * .665;
    const shrub = mesh(shrubGeometry, shrubMaterials[i % 2], [x, .32, -4.12 + Math.sin(i * .7) * .15], [.45, .34 + (i % 3) * .06, .37]);
    shrub.rotation.y = i * .3;
  }

  // Small stones and fallen petals belong to the floor rather than the air.
  const pebbleGeometry = geometry(new THREE.IcosahedronGeometry(1, 1));
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, toon.sand, 70);
  pebbles.name = 'garden-gravel'; pebbles.receiveShadow = true;
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? -1 : 1;
    transform.position.set(side * (5.25 + random() * .76), .047, -3.5 + random() * 7.2);
    transform.scale.set(.045 + random() * .055, .025 + random() * .025, .033 + random() * .07);
    transform.rotation.set(0, random() * Math.PI, .2); transform.updateMatrix(); pebbles.setMatrixAt(i, transform.matrix);
  }
  world.add(pebbles);
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -.5); petalShape.bezierCurveTo(-.49, -.17, -.42, .33, -.12, .48);
  petalShape.lineTo(0, .33); petalShape.lineTo(.12, .48); petalShape.bezierCurveTo(.42, .33, .49, -.17, 0, -.5);
  const petalGeometry = geometry(new THREE.ShapeGeometry(petalShape, 4));
  const petalMaterial = registerMaterial(new THREE.MeshBasicMaterial({ color: '#8e6f93', side: THREE.DoubleSide }));
  const driftMaterial = registerMaterial(new THREE.MeshBasicMaterial({ color: '#e7b4c8', side: THREE.DoubleSide }));
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, 65);
  petals.name = 'fallen-petals';
  for (let i = 0; i < 65; i++) {
    const angle = random() * Math.PI * 2;
    const radius = .5 + random() * 2.5;
    transform.position.set(-4.45 + Math.cos(angle) * radius, .088, -1.12 + Math.sin(angle) * radius);
    transform.scale.setScalar(.065 + random() * .045); transform.rotation.set(-Math.PI / 2, 0, random() * 6.28);
    transform.updateMatrix(); petals.setMatrixAt(i, transform.matrix);
  }
  world.add(petals);

  // Twenty individually phased petals belong to the two nearby trees. They
  // have a slight curled surface and tumble through depth, never a screen-space
  // overlay. Their paths stay under the two crowns and outside the shop walls.
  const driftingGeometry = geometry(new THREE.ShapeGeometry(petalShape, 7));
  const driftingVertices = driftingGeometry.attributes.position;
  for (let i = 0; i < driftingVertices.count; i++) {
    const x = driftingVertices.getX(i); const y = driftingVertices.getY(i);
    driftingVertices.setZ(i, .3 * x * x + .105 * y * y - .045 * Math.sin(y * Math.PI));
  }
  driftingGeometry.computeVertexNormals();
  const driftingPetals = new THREE.InstancedMesh(driftingGeometry, driftMaterial, 20);
  driftingPetals.name = 'slow-drifting-cherry-petals';
  driftingPetals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  driftingPetals.frustumCulled = false;
  // A decorative petal crossing a ray must never steal a click from the shop.
  driftingPetals.raycast = () => {};
  const drifts = Array.from({ length: 20 }, (_, index) => {
    const left = index < 12;
    return {
      x: (left ? -4.5 : 5.3) + (random() - .5) * (left ? 1.3 : 1.05),
      z: (left ? -1.5 : -3.5) + (random() - .5) * .94,
      top: (left ? 4.18 : 3.58) + random() * .26,
      length: 16 + random() * 9,
      phase: (index + random() * .7) / 20,
      angle: random() * Math.PI * 2,
      sideways: left ? .2 + random() * .2 : -.24 - random() * .2,
      forward: left ? .28 + random() * .24 : 1.5 + random() * .65,
      size: .078 + random() * .041,
    };
  });
  function posePetals(time) {
    drifts.forEach((drift, index) => {
      const progress = (time / drift.length + drift.phase) % 1;
      const wind = progress * Math.PI * 2;
      transform.position.set(
        drift.x + drift.sideways * progress + Math.sin(wind * 1.2 + drift.angle) * .17,
        drift.top - (drift.top + .24) * progress,
        drift.z + drift.forward * progress + Math.sin(wind * .8 + drift.angle) * .13,
      );
      transform.rotation.set(
        .35 + Math.sin(wind * 1.35 + drift.angle) * .72,
        drift.angle + wind * .43,
        drift.angle * .6 + wind * .8,
      );
      // Birth is concealed by the crown; the floor hides the end of a fall.
      transform.scale.setScalar(drift.size * THREE.MathUtils.smoothstep(progress, 0, .065));
      transform.updateMatrix(); driftingPetals.setMatrixAt(index, transform.matrix);
    });
    driftingPetals.instanceMatrix.needsUpdate = true;
  }
  posePetals(0);
  world.add(driftingPetals);

  // One strand runs from the listening corner across the storefront to the right
  // of the yard. The owner adds two warm point lights near it; the bulbs
  // themselves are flat and self-lit.
  const wires = [
    [[-5.9, 3.39, 1.06], [-3.1, 2.97, 1.35], [0, 3.06, 1.48]],
    [[0, 3.06, 1.48], [3, 2.93, 1.45], [5.86, 3.43, 1.1]],
  ];
  for (const x of [-5.9, 5.86]) {
    rod([x, .09, 1.1], [x, 3.48, 1.1], .036, toon.green);
    ball([x, 3.49, 1.1], [.059, .059, .059], toon.gold);
  }
  wires.forEach(points => {
    tube(points, .012, toon.ink);
    const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    for (let i = 1; i < 8; i++) {
      const point = path.getPoint(i / 8);
      rod(point.toArray(), [point.x, point.y - .12, point.z], .008, toon.ink);
      cylinder([point.x, point.y - .13, point.z], [.031, .038, .031], toon.green);
      noShadow(ball([point.x, point.y - .187, point.z], [.06, .075, .06], warmLamp));
    }
  });

  // Additive halos and the stage beam carry the night glow. They never take a
  // click, never cast shadows and skip fog so the ink pass leaves them unlined.
  const haloSurface = document.createElement('canvas'); haloSurface.width = haloSurface.height = 64;
  const haloContext = haloSurface.getContext('2d');
  const haloGradient = haloContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  haloGradient.addColorStop(0, 'rgba(255,226,170,1)'); haloGradient.addColorStop(.22, 'rgba(255,190,110,.5)'); haloGradient.addColorStop(1, 'rgba(255,150,80,0)');
  haloContext.fillStyle = haloGradient; haloContext.fillRect(0, 0, 64, 64);
  const haloTexture = new THREE.CanvasTexture(haloSurface); haloTexture.colorSpace = THREE.SRGBColorSpace; textures.add(haloTexture);
  const haloMaterial = registerMaterial(new THREE.SpriteMaterial({ map: haloTexture, color: '#ffc27a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: .8 }));
  function halo(position, size, parent = world) {
    const sprite = new THREE.Sprite(haloMaterial); sprite.position.set(...position); sprite.scale.setScalar(size);
    sprite.raycast = () => {}; parent.add(sprite); return sprite;
  }
  wires.forEach(points => {
    const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    for (let i = 1; i < 8; i++) { const point = path.getPoint(i / 8); halo([point.x, point.y - .187, point.z], .62); }
  });
  for (const x of [-1.15, 1.15]) halo([x, 2.5, .48], 1.1, roof);
  // A small par can on the left festoon pole lights the listening corner; its beam is a soft additive cone.
  const head = new THREE.Vector3(-5.82, 3.3, 1.1); const aim = new THREE.Vector3(-4, .32, .35);
  const can = group('stage-par-can', head.toArray());
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim.clone().sub(head).normalize());
  cylinder([0, .02, 0], [.095, .2, .095], toon.black, can);
  noShadow(cylinder([0, -.085, 0], [.08, .012, .08], warmLamp, can));
  halo(head.toArray(), .7);
  const beamLength = head.distanceTo(aim);
  const beamGeometry = geometry(new THREE.ConeGeometry(Math.tan(.36) * beamLength, beamLength, 32, 1, true));
  beamGeometry.translate(0, -beamLength / 2, 0);
  const beamAlpha = document.createElement('canvas'); beamAlpha.width = 2; beamAlpha.height = 64;
  const beamContext = beamAlpha.getContext('2d'); const beamGradient = beamContext.createLinearGradient(0, 0, 0, 64);
  beamGradient.addColorStop(0, '#fff'); beamGradient.addColorStop(1, '#000'); beamContext.fillStyle = beamGradient; beamContext.fillRect(0, 0, 2, 64);
  const beamTexture = new THREE.CanvasTexture(beamAlpha); textures.add(beamTexture);
  const beamMaterial = registerMaterial(new THREE.MeshBasicMaterial({ color: '#ffc9ae', alphaMap: beamTexture, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = 'stage-beam'; beam.position.copy(head); beam.quaternion.copy(can.quaternion); beam.raycast = () => {}; beam.castShadow = false; beam.receiveShadow = false; beam.userData.dynamic = true;
  world.add(beam);

  // A sleeping cat by the entrance has a breathing body and a separate tail.
  const cat = group('sleeping-shop-cat', [2.42, .24, .58]);
  const catBody = ball([0, .14, 0], [.29, .16, .18], toon.cream, cat);
  catBody.userData.dynamic = true;
  ball([.195, .24, .07], [.135, .115, .118], toon.cream, cat);
  const earGeometry = geometry(new THREE.ConeGeometry(.054, .095, 3));
  mesh(earGeometry, toon.coral, [.13, .355, .079], [1, 1, .6], cat);
  mesh(earGeometry, toon.coral, [.249, .355, .079], [1, 1, .6], cat);
  for (const x of [.158, .235]) box([x, .264, .182], [.036, .006, .008], darkInk, cat);
  ball([.2, .239, .193], [.012, .009, .008], toon.coral, cat);
  tube([[-.24, .11, -.06], [-.34, .091, .076], [-.18, .061, .213], [.019, .065, .2]], .041, toon.cream, cat);
  ball([.168, .048, .141], [.118, .041, .05], toon.cream, cat);

  return {
    roof, record, shelf,
    exploreShadowBlockers: [shopLeftWall, shopFrontBeam],
    // Handles for the one-time opening light-up; values at rest are the night look.
    night: { haloMaterial, beamMaterial, windowGlow, warmLamp, lampColor: warmLamp.color.clone() },
    update(time) {
      record.rotation.y = time * .27;
      catBody.scale.y = .16 * (1 + Math.sin(time * 1.35) * .035);
      posePetals(time);
    },
  };
}

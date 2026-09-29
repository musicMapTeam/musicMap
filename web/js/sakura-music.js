import * as THREE from 'three';
import { gsap } from 'gsap';

const PAPER = { x: 1.86, z: 1.25 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;
const SLEEVE = .38;
const INK_WIDTH = { quiet: .010, route: .018, answer: .013, stub: .014 };
/** A phone frames the records whose names it must show no closer than this (see focusView). */
const FOCUS_ZOOM = 2.2;
/** Paper kept clear around the framed records: room for ink and a tag between a record and the paper's edge. */
const FOCUS_MARGIN = .12;
/** The touch band around a tag grows toward this height, but only into free room (see fitTouchBands). */
const TOUCH = 44;
/** Records shrink as the catalogue grows (12 sleeves print at full size) so a full table never overlaps. */
const sleeveScale = count => THREE.MathUtils.clamp(Math.sqrt(12 / Math.max(1, count)), .7, 1);
/** The names a table must always show: where you stand, the goal, the selection and every record one
 *  tap away (in a round that is the face-up hand). Other names appear where the table has room. */
const needsName = data => Boolean(data && !data.unknown && (data.current || data.target || data.selected || data.adjacent));
// Candidate spots a needed tag may take on a printed leader: below, above, beside, then the diagonals.
const LEADER_ANGLES = [90, 270, 0, 180, 30, 150, 210, 330, 60, 120, 240, 300].map(degrees => degrees * Math.PI / 180);
const LEADER_REACH = [8, 20, 34, 50, 70, 95, 125];
const covers = (box, rect) => box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;

/** One persistent graph printed on the record shop's real table. In a 寻声 round,
 *  unknown artists lie face down (a shared paper back, no name, no colour) and only
 *  flipped songs are inked; the page never receives more than the player uncovered. */
export function createSakuraMusic({ world, cel, host, canvas, camera, reduced, onAction, onChange, isActive, framing }) {
  const furniture = new THREE.Group();
  furniture.name = 'record-connection-table'; furniture.position.set(0, 1.19, -1.3); furniture.visible = false;
  world.add(furniture);
  const printwork = new THREE.Group(); printwork.name = 'music-relationship-network';
  printwork.userData.musicGraph = true; furniture.add(printwork);
  const geometries = new Set(); const materials = new Set(); const textures = new Set();
  const clipping = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), PAPER.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), PAPER.x),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), PAPER.z - furniture.position.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), PAPER.z + furniture.position.z),
  ];
  const geometry = shape => { geometries.add(shape); return shape; };
  function material(options, clipped = false) {
    const item = cel({ ...options, cache: false, flat: false });
    if (clipped) { item.clippingPlanes = clipping; item.clipShadows = true; }
    materials.add(item); return item;
  }
  const wood = material({ color: '#b4967b' });
  const green = material({ color: '#688278' });
  const paper = material({ color: '#ecebe4', bands: 'soft' });
  const brass = material({ color: '#c8a774' });
  const cardStock = material({ color: '#eeeee5', bands: 'soft' }, true);
  const backStock = material({ color: '#e2d7c0', bands: 'soft' }, true);
  const vinyl = material({ color: '#39484b' }, true);
  const grooveInk = material({ color: '#70877c' }, true);
  const recordCenter = material({ color: '#c8a774' }, true);
  const selectedInk = material({ color: '#3f6d5f', bands: 'soft' }, true);
  const targetInk = material({ color: '#c0606f', bands: 'soft' }, true);
  const pathInk = material({ color: '#b98642', bands: 'soft' }, true);
  const edgeInks = {
    quiet: material({ color: '#8d8f7d', bands: 'soft' }, true),
    active: material({ color: '#2f5e4e', bands: 'soft' }, true),
    visited: material({ color: '#a57f5a', bands: 'soft' }, true),
    highlighted: material({ color: '#b0525f', bands: 'soft' }, true),
    style: material({ color: '#95768f', bands: 'soft' }, true),
    route: pathInk,
    answer: material({ color: '#3a4a63', bands: 'soft' }, true),
    stub: material({ color: '#3f3b33', bands: 'soft' }, true),
  };
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const disc = geometry(new THREE.CylinderGeometry(1, 1, 1, 32));
  const face = geometry(new THREE.PlaneGeometry(1, 1));
  const ring = geometry(new THREE.TorusGeometry(1, .021, 4, 40));
  const haloRing = geometry(new THREE.TorusGeometry(1, .032, 4, 48));
  function object(shape, paint, xyz, scale, parent = furniture) {
    const item = new THREE.Mesh(shape, paint);
    item.position.set(...xyz); item.scale.set(...scale); item.castShadow = true; item.receiveShadow = true;
    parent.add(item); return item;
  }
  object(cube, wood, [0, -.075, 0], [3.94, .15, 2.7]);
  object(cube, green, [0, -.19, 0], [3.63, .16, 2.48]);
  for (const x of [-1.66, 1.66]) for (const z of [-1.08, 1.08]) {
    object(cube, wood, [x, -.57, z], [.15, .95, .15]); object(cube, green, [x, -.94, z], [.16, .18, .16]);
  }
  object(cube, paper, [0, .008, 0], [PAPER.x * 2, .025, PAPER.z * 2]);
  for (const x of [-1.39, 1.39]) {
    object(cube, brass, [x, .035, -1.25], [.26, .045, .11]); object(cube, green, [x, .061, -1.285], [.14, .016, .035]);
  }
  for (const x of [-1.91, 1.91]) for (const z of [-1.23, 1.23]) object(disc, brass, [x, .008, z], [.018, .012, .018]);

  const nodes = new Map(); const edges = new Map();
  const view = { zoom: 1, x: 0, z: 0 };
  const pointers = new Map();
  const projector = new THREE.Vector3(); const location = new THREE.Vector3(); const rim = new THREE.Vector3();
  const picker = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(furniture.position.y + .024));
  const originalTouchAction = canvas.style.touchAction;
  let enabled = false; let key = null; let drag = null; let moved = false; let suppressClickUntil = 0;
  let lastCeremony = null; let ceremonyTimeline = null; let lastFlash = null;
  let nodeScale = 1; let round = null; let anchor = '';

  function coverTexture(artist) {
    const surface = document.createElement('canvas'); surface.width = 256; surface.height = 256;
    const ctx = surface.getContext('2d'); const tone = artist.color || '#ab8c99';
    ctx.fillStyle = '#f7f3eb'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = tone; ctx.fillRect(12, 12, 232, 232);
    ctx.save(); ctx.beginPath(); ctx.rect(12, 12, 232, 232); ctx.clip();
    ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 8;
    const pattern = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
    if (pattern === 0) {
      for (let r = 18; r < 300; r += 19) { ctx.beginPath(); ctx.arc(150, 96, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (pattern === 1) {
      for (let x = -120; x < 340; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 95, 70, x - 25, 170, x + 80, 256); ctx.stroke(); }
    } else {
      for (let y = -12; y < 262; y += 28) for (let x = -10; x < 280; x += 29) { ctx.beginPath(); ctx.arc(x + (y / 28 % 2) * 14, y, 8, 0, Math.PI * 2); ctx.stroke(); }
    }
    // Names live only on the HTML labels; the sleeve carries colour and pattern.
    ctx.restore(); ctx.fillStyle = '#fff6e5cc'; ctx.fillRect(12, 222, 64, 6);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
    textures.add(texture); return texture;
  }
  // One shared paper back for every face-down record: no name, no colour, no count.
  let backTexture = null;
  function sleeveBack() {
    if (backTexture) return backTexture;
    const surface = document.createElement('canvas'); surface.width = 256; surface.height = 256;
    const ctx = surface.getContext('2d');
    ctx.fillStyle = '#efe5cf'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d6c7a6'; ctx.lineWidth = 1.5;
    for (let y = -256; y < 256; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 256); ctx.stroke(); }
    ctx.fillStyle = '#efe5cf'; ctx.beginPath(); ctx.arc(128, 128, 88, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b7a684'; ctx.lineWidth = 3;
    for (const r of [88, 74]) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([4, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(128, 128, 60, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#c9b993'; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = '#8d7a58'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 92px "Songti SC", "SimSun", serif'; ctx.fillText('？', 132, 134);
    backTexture = new THREE.CanvasTexture(surface); backTexture.colorSpace = THREE.SRGBColorSpace; backTexture.anisotropy = 2;
    return backTexture;
  }
  function createNode(data) {
    const group = new THREE.Group(); group.name = 'music-record'; printwork.add(group);
    const record = [object(disc, vinyl, [.07, .026, -.01], [.167, .023, .167], group)];
    for (const radius of [.123, .151]) {
      const groove = object(ring, grooveInk, [.07, .04, -.01], [radius, radius, radius], group);
      groove.rotation.x = -Math.PI / 2; groove.castShadow = false; record.push(groove);
    }
    record.push(object(disc, recordCenter, [.07, .041, -.01], [.047, .007, .047], group));
    const stock = object(cube, cardStock, [-.035, .047, 0], [SLEEVE, .025, SLEEVE], group);
    const cover = material({ color: '#ffffff', bands: 'soft' }, true);
    const panel = object(face, cover, [-.035, .062, 0], [SLEEVE * .96, SLEEVE * .96, 1], group);
    panel.rotation.x = -Math.PI / 2; panel.castShadow = false;
    const halo = object(haloRing, selectedInk, [0, .029, 0], [.249, .249, .249], group);
    halo.rotation.x = -Math.PI / 2; halo.castShadow = false;
    const button = document.createElement('button'); button.type = 'button';
    // The <i> is the tag's invisible touch band (map-spatial.css); project() trims it to the free room.
    button.className = 'world-music-label world-music-label--node'; button.innerHTML = '<small></small><strong></strong><i class="world-music-hit" aria-hidden="true"></i>';
    button.hidden = true; button.style.touchAction = 'none'; host.append(button);
    const node = { group, record, stock, panel, halo, button, data: null, texture: null, identity: '', screen: null, flip: null, turning: false, releaseLabel: framing.watchLabel(button) };
    button.addEventListener('click', event => { if (!consumeClick(event) && node.data && !node.data.unknown) activate({ type: 'music', action: 'select', id: node.data.id }); });
    nodes.set(data.id, node); return node;
  }
  function releaseNode(node) {
    node.releaseLabel(); node.flip?.kill();
    gsap.killTweensOf([node.group.position, node.group.scale, node.group.rotation, node.halo.scale]); node.button.remove(); node.group.removeFromParent();
    if (node.texture && node.texture !== backTexture) { textures.delete(node.texture); node.texture.dispose(); }
    materials.delete(node.panel.material); node.panel.material.dispose();
  }
  function showFace(node, unknown) {
    node.panel.material.map = unknown ? sleeveBack() : node.texture; node.panel.material.needsUpdate = true;
    node.record.forEach(part => { part.visible = !unknown; });
    node.stock.material = unknown ? backStock : cardStock;
  }
  /** Resting height and size: a selected, face-up record stands lifted off the paper. */
  const restY = node => node.data?.selected && !node.data?.unknown ? .065 : .012;
  const restScale = node => nodeScale * (node.data?.selected && !node.data?.unknown ? 1.23 : 1);
  function assignNode(node, data, first) {
    const previous = node.data; node.data = data;
    const unknown = Boolean(data.unknown);
    const identity = unknown ? 'unknown' : JSON.stringify([data.name, data.color]);
    if (node.identity !== identity) {
      if (!unknown) {
        if (node.texture && node.texture !== backTexture) { textures.delete(node.texture); node.texture.dispose(); }
        node.texture = coverTexture(data);
      }
      const turning = !unknown && previous?.unknown && !first && !reduced.matches;
      node.identity = identity;
      if (turning) turnOver(node, data.revealDelay || 0);
      else { node.flip?.kill(); node.flip = null; node.turning = false; node.group.scale.x = restScale(node); showFace(node, unknown); }
    }
    node.group.userData.action = unknown ? { type: 'music', action: 'sealed', id: data.id } : data.disabled ? null : { type: 'music', action: 'select', id: data.id };
    const muted = unknown || (!data.selected && !data.adjacent && !data.highlighted && !data.current && !data.target && !data.route);
    node.panel.material.color.set(unknown ? '#f2ecde' : muted ? '#d8d4c9' : '#ffffff');
    node.halo.visible = !unknown && Boolean(data.selected || data.highlighted || data.current || data.target);
    node.halo.material = data.target ? targetInk : data.highlighted ? pathInk : selectedInk;
    const small = node.button.querySelector('small');
    small.textContent = unknown ? '' : data.target ? '终点' : data.current ? '你在这里' : '';
    node.button.querySelector('strong').textContent = unknown ? '' : data.name;
    node.button.disabled = unknown || Boolean(data.disabled);
    node.button.tabIndex = unknown ? -1 : 0;
    if (unknown) { node.button.removeAttribute('aria-label'); node.button.removeAttribute('aria-pressed'); node.button.setAttribute('aria-hidden', 'true'); }
    else {
      node.button.removeAttribute('aria-hidden');
      node.button.setAttribute('aria-pressed', String(Boolean(data.selected)));
      node.button.setAttribute('aria-label', data.target ? `终点：${data.name}` : `查看 ${data.name}，${data.count || 0} 首收录${data.current ? '，你在这里' : ''}`);
    }
    node.button.style.setProperty('--record-tone', unknown ? '#d9d4c7' : data.color || '#a78896');
    for (const state of ['selected', 'adjacent', 'visited', 'highlighted', 'current', 'target', 'route']) node.button.classList.toggle(`is-${state}`, !unknown && Boolean(data[state]));
    node.button.classList.toggle('is-muted', muted);
    node.group.position.x = data.x; node.group.position.z = data.z;
    const scale = restScale(node);
    // A record that is turning over owns its lift and settle; the flip lands on the resting height.
    if ((first || previous?.selected !== data.selected || previous?.unknown !== data.unknown) && !node.turning) {
      const duration = first || reduced.matches ? 0 : .24;
      gsap.killTweensOf(node.group.position);
      gsap.to(node.group.position, { y: restY(node), duration, ease: 'power2.out', onUpdate: onChange });
      gsap.killTweensOf(node.group.scale);
      gsap.to(node.group.scale, { x: scale, y: 1, z: scale, duration, ease: 'power2.out', onUpdate: onChange });
    }
  }
  /** Turn a face-down sleeve over: squash on its spine, change face at the midpoint, lift and settle. */
  function turnOver(node, delay = 0) {
    node.flip?.kill(); gsap.killTweensOf([node.group.position, node.group.scale]);
    node.turning = true; showFace(node, true);
    // The settle reads the selection when it starts, so a record selected mid-turn lands lifted.
    node.flip = gsap.timeline({ delay, onUpdate: onChange, onComplete() { node.turning = false; node.flip = null; onChange?.(); } })
      .to(node.group.position, { y: .09, duration: .12, ease: 'power2.out' }, 0)
      .to(node.group.scale, { x: .02 * nodeScale, duration: .14, ease: 'power2.in' }, 0)
      .call(() => showFace(node, false), null, .14)
      .to(node.group.scale, { x: () => restScale(node), z: () => restScale(node), duration: .18, ease: 'back.out(2)' }, .14)
      .to(node.group.position, { y: () => restY(node), duration: .2, ease: 'power2.inOut' }, .2);
  }
  function curveFor(data) {
    const a = nodes.get(data.a).data; const b = nodes.get(data.b).data;
    const dx = b.x - a.x; const dz = b.z - a.z; const length = Math.hypot(dx, dz) || 1;
    const bend = Math.min(.08, length * .045) * ([...data.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? -1 : 1);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, .023, a.z), new THREE.Vector3((a.x + b.x) / 2 - dz / length * bend, .023, (a.z + b.z) / 2 + dx / length * bend), new THREE.Vector3(b.x, .023, b.z));
  }
  function createEdge(data) {
    const group = new THREE.Group(); group.name = 'music-connection'; printwork.add(group);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'world-music-link';
    button.innerHTML = '<span aria-hidden="true"></span><i class="world-music-hit" aria-hidden="true"></i>'; button.hidden = true; button.style.touchAction = 'none'; host.append(button);
    button.addEventListener('click', event => { if (!consumeClick(event) && edge.data && !edge.data.stub) activate({ type: 'music', action: 'edge', id: edge.data.id }); });
    const edge = { group, button, data: null, midpoint: new THREE.Vector3(), curve: null, identity: '', parts: [], grow: null, growing: false, releaseLabel: framing.watchLabel(button) };
    edges.set(data.id, edge); return edge;
  }
  function clearEdgeGeometry(edge) {
    for (const part of edge.parts) { geometries.delete(part.geometry); part.geometry.dispose(); part.removeFromParent(); }
    edge.parts = [];
  }
  const tierOf = data => data.stub ? 'stub' : data.route ? 'route' : data.answer ? 'answer' : 'quiet';
  function paintFor(data) {
    if (data.stub) return edgeInks.stub;
    if (data.answer) return edgeInks.answer;
    if (data.route) return edgeInks.route;
    if (data.highlighted) return edgeInks.highlighted;
    if (data.active) return edgeInks.active;
    if (data.visited) return edgeInks.visited;
    return data.kind === 'style' ? edgeInks.style : edgeInks.quiet;
  }
  /** Reveal ink along its path by index ranges; the tube indices run segment by segment. */
  function setInk(edge, progress) {
    const totals = edge.parts.map(part => part.geometry.index.count);
    let remaining = Math.round(totals.reduce((sum, count) => sum + count, 0) * THREE.MathUtils.clamp(progress, 0, 1));
    edge.parts.forEach((part, index) => {
      const count = Math.min(totals[index], remaining); remaining -= count;
      part.geometry.setDrawRange(0, count - count % 6);
    });
  }
  function growEdge(edge, duration = .4, delay = 0) {
    edge.grow?.kill(); const state = { value: 0 }; edge.growing = true; setInk(edge, 0);
    edge.grow = gsap.to(state, { value: 1, duration, delay, ease: 'power1.inOut', onUpdate() { setInk(edge, state.value); onChange?.(); }, onComplete() { edge.growing = false; edge.grow = null; setInk(edge, 1); onChange?.(); } });
    return edge.grow;
  }
  function assignEdge(edge, data, animate) {
    const wasVisible = Boolean(edge.data);
    edge.data = data; edge.group.userData.action = data.stub ? null : { type: 'music', action: 'edge', id: data.id };
    const a = nodes.get(data.a).data; const b = nodes.get(data.b).data;
    const tier = tierOf(data);
    const identity = JSON.stringify([a.x, a.z, b.x, b.z, data.kind, tier, data.stub ? data.from : '']);
    const paint = paintFor(data);
    if (edge.identity !== identity) {
      clearEdgeGeometry(edge); edge.identity = identity;
      let curve = curveFor(data);
      // Ink grows away from the player's record, so a stub or a new line starts at their feet.
      const from = data.stub ? data.from : [...nodes.values()].find(node => node.data?.current)?.data.id;
      if (from === data.b) curve = new THREE.QuadraticBezierCurve3(curve.v2.clone(), curve.v1.clone(), curve.v0.clone());
      // The hint stub leaves the sleeve's edge and stops well short of the other record:
      // a pencilled direction with an arrowhead, never a name. Distances follow the sleeve size.
      if (data.stub) {
        // It starts past the player's lifted sleeve (×1.23) and ends clear of the other one.
        const length = Math.max(.3, curve.getLength()); const half = SLEEVE / 2 * nodeScale;
        const start = Math.min(length * .45, half * 1.23 + .035);
        const stop = Math.min(start + .42 * nodeScale, length - half - .02, Math.max(start + .1, length - half - .05));
        const t0 = start / length; const t1 = Math.max(t0 + .08, Math.min(.92, stop / length));
        curve = new THREE.QuadraticBezierCurve3(curve.getPoint(t0), curve.getPoint((t0 + t1) / 2), curve.getPoint(t1));
      }
      edge.curve = curve; curve.getPoint(.5, edge.midpoint);
      const dashes = data.kind === 'style' ? 7 : data.answer ? 9 : data.stub ? (curve.getLength() > .2 ? 3 : 2) : 1;
      const fill = data.stub ? .72 : .58;
      const radius = INK_WIDTH[tier] || INK_WIDTH.quiet;
      const stroke = path => {
        const mesh = object(geometry(new THREE.TubeGeometry(path, path === curve ? 24 : 3, radius, 4, false)), paint, [0, 0, 0], [1, .2, 1], edge.group);
        mesh.castShadow = false; edge.parts.push(mesh);
      };
      for (let index = 0; index < dashes; index++) {
        stroke(dashes === 1 ? curve : new THREE.QuadraticBezierCurve3(curve.getPoint(index / dashes), curve.getPoint((index + fill / 2) / dashes), curve.getPoint((index + fill) / dashes)));
      }
      if (data.stub) {
        const tip = curve.getPoint(1); const back = curve.getTangent(1).setY(0).normalize().multiplyScalar(-Math.max(.07, .09 * nodeScale));
        for (const angle of [-.62, .62]) stroke(new THREE.LineCurve3(tip, tip.clone().add(back.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle))));
      }
      if (animate && (!wasVisible || data.stub)) growEdge(edge, data.stub ? .5 : .4);
      else { edge.grow?.kill(); edge.grow = null; edge.growing = false; }
    }
    edge.parts.forEach(part => { part.material = paint; });
    // Flat ink lies just above the paper; depth outlines should not turn it into cable.
    edge.group.position.y = data.route || data.answer ? .0198 : .0194;
    if (data.stub) {
      edge.button.hidden = true; edge.button.setAttribute('aria-hidden', 'true'); edge.button.tabIndex = -1;
      edge.button.removeAttribute('aria-label'); edge.button.removeAttribute('title'); edge.button.querySelector('span').textContent = '';
      return;
    }
    edge.button.removeAttribute('aria-hidden'); edge.button.tabIndex = 0;
    edge.button.setAttribute('aria-label', `查看${a.name}与${b.name}的${data.kind === 'style' ? '策展标签' : '合作'}：${data.title || '连接'}`);
    edge.button.title = data.title || `${a.name} × ${b.name}`;
    edge.button.querySelector('span').textContent = data.kind === 'style' ? data.title || '连接' : `《${data.title || '连接'}》`;
    for (const state of ['active', 'visited', 'highlighted', 'route', 'answer']) edge.button.classList.toggle(`is-${state}`, Boolean(data[state]));
  }
  function releaseEdge(edge) { edge.grow?.kill(); edge.releaseLabel(); clearEdgeGeometry(edge); edge.button.remove(); edge.group.removeFromParent(); }
  function activate(action) {
    if (!enabled || !isActive()) return;
    const item = ['select', 'sealed'].includes(action.action) ? nodes.get(action.id) : action.action === 'edge' ? edges.get(action.id) : null;
    if (!item || item.data.disabled) return;
    if (action.action === 'sealed') {
      if (!item.data.unknown) return;
      gsap.killTweensOf(item.group.rotation);
      if (!reduced.matches) gsap.fromTo(item.group.rotation, { y: 0 }, { keyframes: [{ y: .07 }, { y: -.07 }, { y: .04 }, { y: 0 }], duration: .36, ease: 'power1.inOut', onUpdate: onChange });
    }
    onAction?.(action);
  }
  function finishCeremony() {
    if (!ceremonyTimeline) return;
    ceremonyTimeline.kill(); ceremonyTimeline = null;
    edges.forEach(edge => { edge.grow?.kill(); edge.grow = null; edge.growing = false; if (edge.parts.length) setInk(edge, 1); });
    nodes.forEach(node => { node.flip?.progress(1); gsap.getTweensOf([node.group.position, node.group.scale]).forEach(tween => tween.progress(1)); });
    onChange?.();
  }
  /** Arrival or reveal: fit the table, let the remaining sleeves turn, then ink the route song by song. */
  function playCeremony(ceremony) {
    lastCeremony = ceremony.token; ceremonyTimeline?.kill(); ceremonyTimeline = null;
    const done = () => setTimeout(() => onAction?.({ type: 'music', action: 'ceremony-done' }), 0);
    if (reduced.matches) { done(); return; }
    control('fit');
    const turns = [...nodes.values()].map(node => node.flip ? (node.data.revealDelay || 0) + .32 : 0);
    const start = Math.min(.55, Math.max(.2, ...turns) * .6);
    const timeline = gsap.timeline({ onUpdate: onChange, onComplete() { ceremonyTimeline = null; done(); } });
    ceremony.order.forEach((id, index) => {
      const edge = edges.get(id); if (!edge?.parts.length) return;
      edge.grow?.kill(); edge.growing = true; setInk(edge, 0);
      const ends = [nodes.get(edge.data.a), nodes.get(edge.data.b)];
      timeline.call(() => ends.forEach(node => node && !node.turning && bump(node, .038, .14)), null, start + index * .3);
      const state = { value: 0 };
      timeline.to(state, { value: 1, duration: .28, ease: 'power1.inOut', onUpdate() { setInk(edge, state.value); }, onComplete() { edge.growing = false; } }, start + index * .3);
    });
    timeline.to({}, { duration: .35 });
    ceremonyTimeline = timeline;
  }
  function flashNode(flash) {
    lastFlash = flash.token;
    const node = nodes.get(flash.id); if (!node || reduced.matches) return;
    gsap.killTweensOf(node.halo.scale);
    gsap.fromTo(node.halo.scale, { x: .249, y: .249, z: .249 }, { x: .33, y: .33, z: .33, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut', onUpdate: onChange });
    if (!node.turning) bump(node, .073, .18);
  }
  /** Hop from where the record is and land back on its own resting height (lifted when selected). */
  function bump(node, height, duration) {
    const base = restY(node);
    gsap.killTweensOf(node.group.position);
    gsap.to(node.group.position, { keyframes: [{ y: base + height, duration, ease: 'power2.out' }, { y: base, duration, ease: 'power2.in' }], onUpdate: onChange });
  }
  function setMusic(payload) {
    const wasEnabled = enabled;
    enabled = Boolean(payload); furniture.visible = enabled; canvas.style.touchAction = enabled ? 'none' : originalTouchAction;
    if (!payload) {
      stopGesture(); gsap.killTweensOf(view); finishCeremony(); lastCeremony = null;
      nodes.forEach(node => { node.button.hidden = true; node.flip?.progress(1); gsap.killTweensOf([node.group.position, node.group.scale]); });
      edges.forEach(edge => { edge.button.hidden = true; edge.grow?.progress(1); }); onChange?.(); return;
    }
    const newGraph = key !== payload.key; key = payload.key;
    if (newGraph) { stopGesture(); gsap.killTweensOf(view); Object.assign(view, { zoom: 1, x: 0, z: 0 }); }
    nodeScale = sleeveScale(payload.nodes.length);
    const nodeIds = new Set(payload.nodes.map(node => node.id)); const edgeIds = new Set(payload.edges.map(edge => edge.id));
    for (const [id, edge] of edges) if (!edgeIds.has(id)) { releaseEdge(edge); edges.delete(id); }
    for (const [id, node] of nodes) if (!nodeIds.has(id)) { releaseNode(node); nodes.delete(id); }
    for (const data of payload.nodes) { const exists = nodes.has(data.id); assignNode(nodes.get(data.id) || createNode(data), data, newGraph || !exists || !wasEnabled); }
    const animateInk = wasEnabled && !newGraph && !reduced.matches;
    for (const data of payload.edges) if (nodes.has(data.a) && nodes.has(data.b)) assignEdge(edges.get(data.id) || createEdge(data), data, animateInk);
    round = payload.round || null;
    // On a phone a free roam follows the player: each move (or a new table) centres the neighbourhood.
    // A round keeps the table the player chose (it opens whole, see map.js) and only steps back in when a
    // needed record, its start or its goal has left the view. 全图 (fit) stays whole until the next move.
    const nextAnchor = JSON.stringify([payload.key, Boolean(round), ...['current', 'target'].map(state => payload.nodes.find(node => node[state])?.id || '')]);
    const moved = nextAnchor !== anchor; anchor = nextAnchor;
    const reframe = phone() && !payload.ceremony && !ceremonyTimeline && ((moved && !round) || (!pointers.size && !focusInView()));
    if (payload.ceremony && payload.ceremony.token !== lastCeremony) playCeremony(payload.ceremony);
    else if (!payload.ceremony && ceremonyTimeline) finishCeremony();
    if (payload.flash && payload.flash.token !== lastFlash) flashNode(payload.flash);
    if (reframe) frameFocus(wasEnabled && !newGraph);
    else applyView();
  }
  const phone = () => (host.clientWidth || framing.layout.width) <= 760;
  /** The records a phone keeps in view: every needed name, plus a round's route and revealed answer,
   *  so its start and goal both stay on the table. */
  function focusPoints() {
    return [...nodes.values()].map(node => node.data).filter(data => needsName(data) || (round && data && !data.unknown && (data.route || data.highlighted)));
  }
  /** Zoom and pan that print the focus records as large as the paper allows. The sleeves grow with the
   *  zoom, so the margin does too: zoom = 2(P − m) / (span + 2·half), per axis. */
  function focusView() {
    const points = focusPoints(); if (!points.length) return { zoom: 1, x: 0, z: 0 };
    const half = SLEEVE / 2 * nodeScale * 1.23;
    const span = axis => { const values = points.map(point => point[axis]); return [Math.min(...values), Math.max(...values)]; };
    const [minX, maxX] = span('x'); const [minZ, maxZ] = span('z');
    const zoom = THREE.MathUtils.clamp(Math.min(
      2 * (PAPER.x - FOCUS_MARGIN) / (maxX - minX + 2 * half),
      2 * (PAPER.z - FOCUS_MARGIN) / (maxZ - minZ + 2 * half)), MIN_ZOOM, FOCUS_ZOOM);
    // A table that would barely change stays whole.
    if (zoom < 1.08) return { zoom: 1, x: 0, z: 0 };
    return clampView({ zoom, x: -(minX + maxX) / 2 * zoom, z: -(minZ + maxZ) / 2 * zoom });
  }
  function focusInView() {
    const half = SLEEVE / 2 * nodeScale * 1.23 * view.zoom;
    return focusPoints().every(point => Math.abs(point.x * view.zoom + view.x) <= PAPER.x - .055 - half && Math.abs(point.z * view.zoom + view.z) <= PAPER.z - .055 - half);
  }
  function frameFocus(animate) {
    const next = focusView();
    gsap.killTweensOf(view);
    if (animate && !reduced.matches) gsap.to(view, { ...next, duration: .32, ease: 'power2.out', onUpdate: applyView });
    else { Object.assign(view, next); applyView(); }
    return { zoom: next.zoom };
  }
  function withinPaper(point, margin = 0) { return Math.abs(point.x) <= PAPER.x - margin && Math.abs(point.z) <= PAPER.z - margin; }
  function localPosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    picker.setFromCamera(pointer, camera); const point = picker.ray.intersectPlane(tablePlane, new THREE.Vector3());
    return point ? furniture.worldToLocal(point) : null;
  }
  function applyView() {
    printwork.position.set(view.x, 0, view.z); printwork.scale.set(view.zoom, 1, view.zoom);
    host.dataset.musicZoom = view.zoom.toFixed(2); onChange?.();
  }
  function clampView(next) {
    next.zoom = THREE.MathUtils.clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
    next.x = THREE.MathUtils.clamp(next.x, -1.65 * next.zoom, 1.65 * next.zoom);
    next.z = THREE.MathUtils.clamp(next.z, -1.05 * next.zoom, 1.05 * next.zoom);
    return next;
  }
  function zoomAt(zoom, anchor = { x: 0, z: 0 }, animate = false) {
    const nextZoom = THREE.MathUtils.clamp(zoom, MIN_ZOOM, MAX_ZOOM); const ratio = nextZoom / view.zoom;
    const next = clampView({ zoom: nextZoom, x: anchor.x - (anchor.x - view.x) * ratio, z: anchor.z - (anchor.z - view.z) * ratio });
    gsap.killTweensOf(view);
    if (animate && !reduced.matches) gsap.to(view, { ...next, duration: .22, ease: 'power2.out', onUpdate: applyView });
    else { Object.assign(view, next); applyView(); }
    return nextZoom;
  }
  function control(command) {
    if (!enabled) return;
    if (command === 'fit') {
      gsap.killTweensOf(view); stopGesture();
      if (reduced.matches) { Object.assign(view, { zoom: 1, x: 0, z: 0 }); applyView(); }
      else gsap.to(view, { zoom: 1, x: 0, z: 0, duration: .24, ease: 'power2.out', onUpdate: applyView });
      return { zoom: 1 };
    }
    if (command === 'zoom-in' || command === 'zoom-out') return { zoom: zoomAt(view.zoom * (command === 'zoom-in' ? 1.28 : 1 / 1.28), undefined, true) };
    if (command === 'focus') {
      // A phone centres where you stand at a zoom where the names one tap away can be read.
      if (phone()) return frameFocus(true);
      if (view.zoom === 1) return control('fit');
      const selected = [...nodes.values()].find(node => node.data.selected);
      if (selected) {
        const next = clampView({ zoom: view.zoom, x: -selected.data.x * view.zoom, z: -selected.data.z * view.zoom });
        gsap.killTweensOf(view);
        if (reduced.matches) { Object.assign(view, next); applyView(); }
        else gsap.to(view, { ...next, duration: .24, ease: 'power2.out', onUpdate: applyView });
      }
      return { zoom: view.zoom };
    }
  }
  function rebaseGesture() {
    const points = [...pointers.values()]; if (!points.length) { drag = null; return; }
    const midpoint = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    drag = { anchor: localPosition(midpoint.x, midpoint.y), screen: midpoint, view: { ...view }, distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 };
  }
  function onPointerDown(event) {
    if (!enabled || !isActive() || (event.pointerType !== 'touch' && event.button !== 0)) return;
    if (event.currentTarget === host && !event.target.closest('.world-music-label, .world-music-link')) return;
    const point = localPosition(event.clientX, event.clientY); if (!point || !withinPaper(point)) return;
    if (!pointers.size) moved = false;
    gsap.killTweensOf(view); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebaseGesture();
    if (pointers.size > 1) { moved = true; for (const id of pointers.keys()) canvas.setPointerCapture(id); event.preventDefault(); }
  }
  function onPointerMove(event) {
    if (!pointers.has(event.pointerId) || !drag?.anchor) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); const points = [...pointers.values()];
    const midpoint = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    if (!moved && points.length === 1 && Math.hypot(midpoint.x - drag.screen.x, midpoint.y - drag.screen.y) < 5) return;
    moved = true; event.preventDefault(); canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
    const point = localPosition(midpoint.x, midpoint.y); if (!point) return;
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    const zoom = distance && drag.distance ? THREE.MathUtils.clamp(drag.view.zoom * distance / drag.distance, MIN_ZOOM, MAX_ZOOM) : drag.view.zoom;
    const ratio = zoom / drag.view.zoom;
    Object.assign(view, clampView({ zoom, x: point.x - (drag.anchor.x - drag.view.x) * ratio, z: point.z - (drag.anchor.z - drag.view.z) * ratio })); applyView();
  }
  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    if (moved) suppressClickUntil = performance.now() + 350;
    pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    rebaseGesture(); if (!pointers.size) canvas.style.cursor = '';
  }
  function stopGesture() {
    if (pointers.size) suppressClickUntil = performance.now() + 350;
    for (const pointerId of pointers.keys()) if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointers.clear(); drag = null; moved = false; canvas.style.cursor = '';
  }
  function onWheel(event) {
    if (!enabled || !isActive()) return;
    const point = localPosition(event.clientX, event.clientY); if (!point || !withinPaper(point)) return;
    event.preventDefault(); zoomAt(view.zoom * Math.exp(-event.deltaY * (event.deltaMode === 1 ? .026 : .0018)), point);
  }
  function consumeClick(event) {
    if (performance.now() >= suppressClickUntil) return false;
    event?.preventDefault(); event?.stopPropagation(); return true;
  }
  function acceptHit(hit) {
    let isGraph = false;
    for (let parent = hit.object; parent; parent = parent.parent) if (parent === printwork) { isGraph = true; break; }
    return !isGraph || withinPaper(furniture.worldToLocal(hit.point.clone()));
  }
  function screenPoint(point, camera, width, height) {
    projector.copy(point).project(camera);
    return { x: (projector.x + 1) * width / 2, y: (1 - projector.y) * height / 2, depth: projector.z };
  }
  const rectAround = (x, y, half) => ({ left: x - half, top: y - half, right: x + half, bottom: y + half });
  /** Name tags sit beside their sleeve and never cover the UI or another tag. A quiet name shows only
   *  where the table has room: clear of every record, or on a crowded table over quieter records, never
   *  over one whose name is needed. A needed name (needsName) is placed first and always finds a spot:
   *  the nearest free one, stepping out on a printed leader or over a quiet record, whichever hides least. */
  function positionLabel(node, sleeves, mobile, needed, packed = []) {
    const { x, y, r } = node.screen; const size = framing.labelSize(node.button);
    const w = size.width; const h = size.height; const gap = mobile ? 3 : 5;
    // [centre x, top, kind, how far the spot is from its sleeve]
    const candidates = [
      [x, y + r * .72 + gap, 'below', 0], [x, y - r * .72 - gap - h, 'above', .1],
      [x + r * .8 + w / 2 + gap, y - h / 2, 'side', .2], [x - r * .8 - w / 2 - gap, y - h / 2, 'side', .2],
      [x + r * .55 + w / 2, y + r * .55, 'corner', .3], [x - r * .55 - w / 2, y + r * .55, 'corner', .3],
      [x + r * .55 + w / 2, y - r * .55 - h, 'corner', .3], [x - r * .55 - w / 2, y - r * .55 - h, 'corner', .3],
    ];
    // Where you stand is the one name that must read as its record's: it steps out on a leader only a
    // little way, and rather than stand far off on a long leader it lies over its own record (centred on
    // it, so it hides the least around). Other needed names still prefer any leader to hiding a record.
    const anchor = Boolean(needed && node.data?.current);
    // Further out, the tag's near edge sits `reach` px past the sleeve in each direction.
    if (needed) LEADER_REACH.forEach((reach, step) => { for (const angle of LEADER_ANGLES) {
      const dx = Math.cos(angle); const dy = Math.sin(angle);
      candidates.push([x + dx * (r * .8 + reach + Math.abs(dx) * w / 2), y + dy * (r * .8 + reach + Math.abs(dy) * h / 2) - h / 2, 'leader', 1 + step * (anchor ? 3 : 1)]);
    } });
    // Over its own sleeve: after the leaders up to 50px, since it hides the record the name belongs to.
    candidates.push(anchor ? [x, y - h / 2, 'over', 2] : [x, y + r * .15, 'over', 4.5]);
    const others = sleeves.filter(item => item.node !== node);
    // A needed name may also use a free pocket beside the paper UI, clear of every control.
    const fits = avoid => ([left, top]) => framing.placeLabel(node.button, left, top, 'top', avoid, needed);
    const own = rectAround(x, y, r * .9);
    // For 你在这里, hiding a record whose name is needed (one tap away, the goal) costs 40: more than its
    // longest leader (19) even with two quiet records hidden on the way (16). It steps out on a leader rather
    // than lie over the singer it points to next (it used to cover 王嘉尔 beside 林俊杰 at 1440).
    const neededCost = anchor ? 40 : 16;
    const hides = ([left, top, kind]) => {
      const box = { left: left - w / 2, right: left + w / 2, top, bottom: top + h };
      // The anchor's tag counts only the records' bodies it would hide (a tilted corner is not a record hidden).
      return others.reduce((sum, item) => sum + (covers(box, needed && !anchor ? item.span : item.rect) ? item.needed ? neededCost : 8 : 0), 0) + (kind !== 'over' && covers(box, own) ? .6 : 0);
    };
    let placed = null;
    if (needed) {
      // Distance and hidden records share one cost: every leader on the list (up to 125px) beats covering
      // another record, even a face-down one, and covering a record whose name is needed comes last.
      // A free spot right beside the sleeve costs under 1 and beats everything else, so try those first.
      const rank = list => list.map((candidate, index) => ({ candidate, index, cost: candidate[3] + hides(candidate) }))
        .sort((a, b) => a.cost - b.cost || a.index - b.index).map(item => item.candidate);
      placed = rank(candidates.slice(0, 8)).find(fits(others.map(item => item.span))) || rank(candidates).find(fits(null));
      // Last resort on a very small table: line the tag up with the tags already placed, row by row,
      // so the gaps between them are used instead of left as slivers.
      if (!placed && packed.length) {
        const spots = []; const tops = new Set();
        // Rows keep the gap placeLabel asks for above and below (room for the 44px touch bands).
        const along = box => Math.max(3.5, TOUCH - Math.min(h, box.bottom - box.top) + 1.5);
        for (const box of packed) { tops.add(box.top); tops.add(box.bottom + along(box)); tops.add(box.top - h - along(box)); }
        for (const top of tops) {
          const xs = new Set([x]);
          for (const box of packed) if (box.top < top + h && box.bottom > top) { xs.add(box.left - 3.5 - w / 2); xs.add(box.right + 3.5 + w / 2); }
          for (const cx of xs) spots.push([cx, top, 'leader', 1 + Math.hypot(cx - x, top + h / 2 - y) / 20]);
        }
        placed = rank(spots).find(fits(null));
      }
    } else {
      placed = candidates.find(candidate => candidate[2] !== 'over' && fits(others.map(item => item.rect))(candidate));
      // Crowded: the spot that hides the fewest other records (its own sleeve counts for less).
      if (!placed) placed = candidates.map((candidate, index) => ({ candidate, index, cost: hides(candidate) }))
        .sort((a, b) => a.cost - b.cost || a.index - b.index).map(item => item.candidate)
        .find(fits(others.filter(item => item.needed).map(item => item.rect)));
    }
    if (!placed) return null;
    const [labelX, labelY, kind] = placed;
    node.button.style.transform = `translate3d(${labelX}px,${labelY}px,0) translate(-50%,0)`;
    const box = { left: labelX - w / 2, right: labelX + w / 2, top: labelY, bottom: labelY + h };
    // A printed leader from a tag that stands off its sleeve; decorative only.
    const leader = kind === 'side' || kind === 'corner' || kind === 'leader';
    node.button.classList.toggle('has-leader', leader);
    if (!leader) return box;
    const left = labelX - w / 2;
    const startX = THREE.MathUtils.clamp(x - left, 0, w); const startY = THREE.MathUtils.clamp(y - labelY, 0, h);
    const toX = x - left - startX; const toY = y - labelY - startY; const length = Math.hypot(toX, toY);
    const reach = Math.max(0, length - r * .62);
    node.button.style.setProperty('--leader-x', `${startX}px`);
    node.button.style.setProperty('--leader-y', `${startY}px`);
    node.button.style.setProperty('--leader-length', `${reach}px`);
    node.button.style.setProperty('--leader-angle', `${Math.atan2(toY, toX)}rad`);
    return box;
  }
  /** Each shown tag's invisible touch band grows to 44px. It takes free room first: half-way to a
   *  neighbouring tag, never over a control, and clear of the other records, taking more on one side where
   *  the other is short. Where the records leave too little, it reaches over a record's edge rather than
   *  stay short (the label engine keeps tags far enough apart for this, see placeLabel in sakura-framing),
   *  so every name is a full target and two bands never meet. */
  function fitTouchBands(tags, sleeves) {
    const split = (need, before, after) => {
      let first = Math.min(before, Math.ceil(need / 2)); const second = Math.min(after, need - first);
      first = Math.min(before, need - second);
      return [first, second];
    };
    for (const tag of tags) {
      const { box } = tag;
      const needY = Math.max(0, Math.ceil(TOUCH - (box.bottom - box.top))); const needX = Math.max(0, Math.ceil(TOUCH - (box.right - box.left)));
      const room = withRecords => {
        const free = { top: needY, right: needX, bottom: needY, left: needX };
        const limit = (rect, share) => {
          if (rect.left < box.right + free.right && rect.right > box.left - free.left) {
            if (rect.bottom <= box.top) free.top = Math.min(free.top, (box.top - rect.bottom) * share);
            if (rect.top >= box.bottom) free.bottom = Math.min(free.bottom, (rect.top - box.bottom) * share);
          }
          if (rect.top < box.bottom + free.bottom && rect.bottom > box.top - free.top) {
            if (rect.right <= box.left) free.left = Math.min(free.left, (box.left - rect.right) * share);
            if (rect.left >= box.right) free.right = Math.min(free.right, (rect.left - box.right) * share);
          }
        };
        for (const other of tags) if (other !== tag) limit(other.box, .5);
        if (withRecords) for (const sleeve of sleeves) if (sleeve.node !== tag.node) limit(sleeve.rect, 1);
        for (const control of framing.layout.obstacles) limit(control, 1);
        Object.keys(free).forEach(side => { free[side] = Math.max(0, Math.floor(free[side])); });
        const [top, bottom] = split(needY, free.top, free.bottom); const [left, right] = split(needX, free.left, free.right);
        return { top, right, bottom, left, full: top + bottom >= needY && left + right >= needX };
      };
      let band = room(true);
      if (!band.full) band = room(false);
      const value = ['top', 'right', 'bottom', 'left'].map(side => band[side]).join(' ');
      if (tag.button.dataset.touch === value) continue;
      tag.button.dataset.touch = value;
      ['top', 'right', 'bottom', 'left'].forEach(side => tag.button.style.setProperty(`--touch-${side}`, `${band[side]}px`));
    }
  }
  function project(camera, width, height, active) {
    const mobile = width <= 760;
    // Needed names first (where you stand, the goal, the selection, one tap away), then route and answer.
    const priority = node => node.data?.current ? 7 : node.data?.target ? 6 : node.data?.selected ? 5 : node.data?.adjacent ? 4 : node.data?.highlighted || node.data?.route ? 3 : node.data?.visited ? 1 : 0;
    // Equal standing: the better-connected record is named first on a crowded table.
    const orderedNodes = [...nodes.values()].sort((a, b) => priority(b) - priority(a) || (b.data?.count || 0) - (a.data?.count || 0));
    const sleeves = [];
    const focused = document.activeElement;
    for (const node of orderedNodes) {
      node.group.getWorldPosition(location); const local = furniture.worldToLocal(location.clone());
      const center = screenPoint(location, camera, width, height);
      rim.set(SLEEVE / 2 * (node.data?.selected ? 1.23 : 1), 0, 0); node.group.localToWorld(rim);
      const edgePoint = screenPoint(rim, camera, width, height);
      const r = Math.max(8, Math.hypot(edgePoint.x - center.x, edgePoint.y - center.y));
      node.screen = { ...center, r };
      if (!enabled || !active || !withinPaper(local, .055) || center.depth < -1 || center.depth > 1) { node.screen.off = true; continue; }
      // `rect` is the sleeve's body; `span` reaches its tilted corners and printed edge (the projected centre
      // sits a few px off the painted card), which a needed name keeps clear of.
      sleeves.push({ node, rect: rectAround(center.x, center.y, r * .9), span: rectAround(center.x, center.y, r * 1.12 + 6), needed: needsName(node.data) });
    }
    // Visibility is assigned once per label per frame (never hidden-then-shown), and a tag
    // that holds keyboard focus stays where it was rather than dropping focus to the page.
    const nameable = node => enabled && active && !node.data?.unknown;
    const placeable = node => nameable(node) && !node.screen.off && !node.turning;
    // Needed names go first. A greedy pass can box in a name placed late, so a pass that leaves one out
    // is tried again with the names that found no spot moved up (where you stand always leads).
    const start = framing.labelMark();
    const arrange = order => { framing.rewindLabels(start); const boxes = new Map(); for (const node of order) { const box = positionLabel(node, sleeves, mobile, true, [...boxes.values()]); if (box) boxes.set(node, box); } return boxes; };
    let order = orderedNodes.filter(node => placeable(node) && needsName(node.data));
    let boxes = arrange(order); let best = { order, size: boxes.size };
    for (let attempt = 1; attempt < 4 && boxes.size < order.length; attempt++) {
      const lead = order.filter(node => node.data.current);
      order = [...lead, ...order.filter(node => !boxes.has(node) && !lead.includes(node)), ...order.filter(node => boxes.has(node) && !lead.includes(node))];
      boxes = arrange(order);
      if (boxes.size > best.size) best = { order, size: boxes.size };
    }
    if (best.order !== order) boxes = arrange(best.order);
    for (const node of orderedNodes) if (placeable(node) && !needsName(node.data)) {
      const box = positionLabel(node, sleeves, mobile, false);
      if (box) boxes.set(node, box);
    }
    const tags = [];
    for (const node of orderedNodes) {
      const box = boxes.get(node);
      if (box) tags.push({ node, button: node.button, box });
      const hidden = !box && !(nameable(node) && node.button === focused);
      if (node.button.hidden !== hidden) node.button.hidden = hidden;
    }
    // Song titles never cover a named record; a face-down one may sit under a title on a crowded table.
    const sleeveRects = sleeves.filter(item => !item.node.data?.unknown).map(item => item.rect);
    // The song you just turned over (touching where you stand) is named before older route ink.
    const edgeRank = data => data.stub ? 0 : data.active ? 3 : data.highlighted || data.answer ? 2 : data.route ? 1 : 0;
    for (const edge of [...edges.values()].sort((a, b) => edgeRank(b.data) - edgeRank(a.data))) {
      const eligible = enabled && active && !edge.data.stub && (edge.data.active || edge.data.highlighted || edge.data.route || edge.data.answer);
      let placed = false;
      // On the ink first; on a crowded table, just beside it (never over a record).
      if (eligible && !edge.growing) for (const t of [.5, .4, .6, .32, .68]) {
        edge.curve.getPoint(t, location); printwork.localToWorld(location);
        const local = furniture.worldToLocal(location.clone()); const screen = screenPoint(location, camera, width, height);
        if (!withinPaper(local, .04) || screen.depth < -1 || screen.depth > 1) continue;
        edge.curve.getPoint(Math.min(1, t + .05), rim); printwork.localToWorld(rim);
        const ahead = screenPoint(rim, camera, width, height);
        const along = Math.hypot(ahead.x - screen.x, ahead.y - screen.y) || 1;
        const nx = -(ahead.y - screen.y) / along; const ny = (ahead.x - screen.x) / along;
        const size = framing.labelSize(edge.button);
        const beside = Math.abs(nx) * size.width / 2 + Math.abs(ny) * size.height / 2 + 5;
        for (const shift of [0, beside, -beside]) {
          const cx = screen.x + nx * shift; const cy = screen.y + ny * shift;
          const box = { left: cx - size.width / 2, right: cx + size.width / 2, top: cy - size.height / 2, bottom: cy + size.height / 2 };
          if (sleeveRects.some(rect => box.left < rect.right + 4 && box.right > rect.left - 4 && box.top < rect.bottom + 4 && box.bottom > rect.top - 4)) continue;
          if (!framing.placeLabel(edge.button, cx, cy, 'center')) continue;
          edge.button.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
          tags.push({ button: edge.button, box });
          placed = true;
          break;
        }
        if (placed) break;
      }
      const hidden = !placed && !(eligible && edge.button === focused);
      if (edge.button.hidden !== hidden) edge.button.hidden = hidden;
    }
    fitTouchBands(tags, sleeves);
  }
  canvas.addEventListener('pointerdown', onPointerDown); host.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);
  host.addEventListener('pointermove', onPointerMove); host.addEventListener('pointerup', onPointerUp); host.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('wheel', onWheel, { passive: false });
  return { setMusic, project, activate, control, acceptHit, consumeClick, get dragging() { return pointers.size > 0 && moved; },
    finish() {
      gsap.getTweensOf(view).forEach(tween => tween.totalProgress(1));
      finishCeremony();
      nodes.forEach(node => { node.flip?.progress(1); gsap.getTweensOf([node.group.position, node.group.scale, node.group.rotation, node.halo.scale]).forEach(tween => tween.totalProgress(1)); });
      edges.forEach(edge => edge.grow?.progress(1));
    },
    dispose() {
      stopGesture(); gsap.killTweensOf(view); ceremonyTimeline?.kill(); canvas.style.touchAction = originalTouchAction; delete host.dataset.musicZoom;
      canvas.removeEventListener('pointerdown', onPointerDown); host.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('pointermove', onPointerMove); host.removeEventListener('pointerup', onPointerUp); host.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel); host.removeEventListener('wheel', onWheel);
      edges.forEach(releaseEdge); nodes.forEach(releaseNode);
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); backTexture?.dispose();
      furniture.removeFromParent();
    },
  };
}

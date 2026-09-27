import * as THREE from 'three';
import { gsap } from 'gsap';

const PAPER = { x: 1.86, z: 1.25 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;

/** One complete, persistent graph printed on the record shop's real table. */
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
  const vinyl = material({ color: '#39484b' }, true);
  const grooveInk = material({ color: '#70877c' }, true);
  const recordCenter = material({ color: '#c8a774' }, true);
  const selectedInk = material({ color: '#416f62', bands: 'soft' }, true);
  const pathInk = material({ color: '#bb8d56', bands: 'soft' }, true);
  const edgeInks = {
    quiet: material({ color: '#a3a398', bands: 'soft' }, true),
    active: material({ color: '#517467', bands: 'soft' }, true),
    visited: material({ color: '#b09b83', bands: 'soft' }, true),
    highlighted: material({ color: '#b98262', bands: 'soft' }, true),
    style: material({ color: '#a894a1', bands: 'soft' }, true),
  };
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const disc = geometry(new THREE.CylinderGeometry(1, 1, 1, 32));
  const face = geometry(new THREE.PlaneGeometry(1, 1));
  const ring = geometry(new THREE.TorusGeometry(1, .021, 4, 40));
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
  const projector = new THREE.Vector3(); const location = new THREE.Vector3();
  const picker = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(furniture.position.y + .024));
  const originalTouchAction = canvas.style.touchAction;
  let enabled = false; let key = null; let drag = null; let moved = false; let suppressClickUntil = 0;

  function coverTexture(artist) {
    const surface = document.createElement('canvas'); surface.width = 256; surface.height = 256;
    const ctx = surface.getContext('2d'); const tone = artist.color || '#ab8c99';
    ctx.fillStyle = '#f7f3eb'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = tone; ctx.fillRect(12, 12, 232, 177);
    ctx.save(); ctx.beginPath(); ctx.rect(12, 12, 232, 177); ctx.clip();
    ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 8;
    const pattern = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
    if (pattern === 0) {
      for (let r = 18; r < 215; r += 18) { ctx.beginPath(); ctx.arc(147, 68, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (pattern === 1) {
      for (let x = -100; x < 320; x += 23) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 95, 50, x - 25, 125, x + 80, 200); ctx.stroke(); }
    } else {
      for (let y = -20; y < 200; y += 28) for (let x = -10; x < 280; x += 29) { ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore(); ctx.fillStyle = '#35534d'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 23px "Microsoft YaHei", Arial, sans-serif'; ctx.fillText(artist.name, 14, 216, 228);
    ctx.font = '600 8px Arial, sans-serif'; ctx.fillText('SIDE B / CONNECTIONS', 15, 244, 215);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
    textures.add(texture); return texture;
  }
  function createNode(data) {
    const group = new THREE.Group(); group.name = `music-artist-${data.id}`; printwork.add(group);
    const size = .38;
    object(disc, vinyl, [.07, .026, -.01], [.167, .023, .167], group);
    for (const radius of [.123, .151]) {
      const groove = object(ring, grooveInk, [.07, .04, -.01], [radius, radius, radius], group);
      groove.rotation.x = -Math.PI / 2; groove.castShadow = false;
    }
    object(disc, recordCenter, [.07, .041, -.01], [.047, .007, .047], group);
    object(cube, cardStock, [-.035, .047, 0], [size, .025, size], group);
    const cover = material({ color: '#ffffff', bands: 'soft' }, true);
    const panel = object(face, cover, [-.035, .062, 0], [size * .96, size * .96, 1], group);
    panel.rotation.x = -Math.PI / 2; panel.castShadow = false;
    const halo = object(ring, selectedInk, [0, .029, 0], [.249, .249, .249], group);
    halo.rotation.x = -Math.PI / 2; halo.castShadow = false;
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'world-music-label world-music-label--node'; button.innerHTML = '<strong></strong>';
    button.hidden = true; button.style.touchAction = 'none'; host.append(button);
    const node = { group, panel, halo, button, data: null, texture: null, identity: '', screen: null, releaseLabel: framing.watchLabel(button) };
    button.addEventListener('click', event => { if (!consumeClick(event)) activate({ type: 'music', action: 'select', id: data.id }); });
    nodes.set(data.id, node); return node;
  }
  function releaseNode(node) {
    node.releaseLabel();
    gsap.killTweensOf([node.group.position, node.group.scale]); node.button.remove(); node.group.removeFromParent();
    if (node.texture) { textures.delete(node.texture); node.texture.dispose(); }
    materials.delete(node.panel.material); node.panel.material.dispose();
  }
  function assignNode(node, data, first) {
    const previous = node.data; node.data = data;
    const identity = JSON.stringify([data.name, data.color]);
    if (node.identity !== identity) {
      if (node.texture) { textures.delete(node.texture); node.texture.dispose(); }
      node.texture = coverTexture(data); node.identity = identity;
      node.panel.material.map = node.texture; node.panel.material.needsUpdate = true;
    }
    node.group.userData.action = data.disabled ? null : { type: 'music', action: 'select', id: data.id };
    const muted = !data.selected && !data.adjacent && !data.highlighted && !data.current;
    node.panel.material.color.set(muted ? '#c3cac3' : '#ffffff');
    node.halo.visible = Boolean(data.selected || data.highlighted || data.current);
    node.halo.material = data.highlighted ? pathInk : selectedInk;
    node.button.querySelector('strong').textContent = data.name;
    node.button.disabled = Boolean(data.disabled); node.button.setAttribute('aria-pressed', String(Boolean(data.selected)));
    node.button.setAttribute('aria-label', `查看 ${data.name}，${data.count || 0} 首收录${data.current ? '，当前路线位置' : ''}`);
    node.button.style.setProperty('--record-tone', data.color || '#a78896');
    for (const state of ['selected', 'adjacent', 'visited', 'highlighted', 'current']) node.button.classList.toggle(`is-${state}`, Boolean(data[state]));
    node.button.classList.toggle('is-muted', muted);
    node.group.position.x = data.x; node.group.position.z = data.z;
    const scale = data.selected ? 1.23 : 1;
    if (first || previous?.selected !== data.selected) {
      gsap.killTweensOf([node.group.position, node.group.scale]);
      const duration = first || reduced.matches ? 0 : .24;
      gsap.to(node.group.position, { y: data.selected ? .065 : .012, duration, ease: 'power2.out', onUpdate: onChange });
      gsap.to(node.group.scale, { x: scale, y: 1, z: scale, duration, ease: 'power2.out', onUpdate: onChange });
    }
  }
  function curveFor(data) {
    const a = nodes.get(data.a).data; const b = nodes.get(data.b).data;
    const dx = b.x - a.x; const dz = b.z - a.z; const length = Math.hypot(dx, dz) || 1;
    const bend = Math.min(.08, length * .045) * ([...data.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? -1 : 1);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, .023, a.z), new THREE.Vector3((a.x + b.x) / 2 - dz / length * bend, .023, (a.z + b.z) / 2 + dx / length * bend), new THREE.Vector3(b.x, .023, b.z));
  }
  function createEdge(data) {
    const group = new THREE.Group(); group.name = `music-connection-${data.id}`; printwork.add(group);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'world-music-link';
    button.innerHTML = '<span aria-hidden="true"></span>'; button.hidden = true; button.style.touchAction = 'none'; host.append(button);
    button.addEventListener('click', event => { if (!consumeClick(event)) activate({ type: 'music', action: 'edge', id: data.id }); });
    const edge = { group, button, data: null, midpoint: new THREE.Vector3(), identity: '', parts: [], releaseLabel: framing.watchLabel(button) };
    edges.set(data.id, edge); return edge;
  }
  function clearEdgeGeometry(edge) {
    for (const part of edge.parts) { geometries.delete(part.geometry); part.geometry.dispose(); part.removeFromParent(); }
    edge.parts = [];
  }
  function assignEdge(edge, data) {
    edge.data = data; edge.group.userData.action = { type: 'music', action: 'edge', id: data.id };
    const a = nodes.get(data.a).data; const b = nodes.get(data.b).data;
    const identity = JSON.stringify([a.x, a.z, b.x, b.z, data.kind]);
    const paint = data.highlighted ? edgeInks.highlighted : data.active ? edgeInks.active : data.visited ? edgeInks.visited : data.kind === 'style' ? edgeInks.style : edgeInks.quiet;
    if (edge.identity !== identity) {
      clearEdgeGeometry(edge); edge.identity = identity;
      const curve = curveFor(data); curve.getPoint(.5, edge.midpoint);
      const count = data.kind === 'style' ? 7 : 1;
      for (let index = 0; index < count; index++) {
        const path = count === 1 ? curve : new THREE.QuadraticBezierCurve3(curve.getPoint(index / count), curve.getPoint((index + .29) / count), curve.getPoint((index + .58) / count));
        const mesh = object(geometry(new THREE.TubeGeometry(path, count === 1 ? 18 : 3, .0065, 4, false)), paint, [0, 0, 0], [1, .2, 1], edge.group);
        mesh.castShadow = false; edge.parts.push(mesh);
      }
    }
    edge.parts.forEach(part => { part.material = paint; });
    // Flat ink lies just above the paper; depth outlines should not turn it into cable.
    edge.group.position.y = .0194;
    edge.button.setAttribute('aria-label', `查看${a.name}与${b.name}的${data.kind === 'style' ? '策展标签' : '合作'}：${data.title || '连接'}`);
    edge.button.title = data.title || `${a.name} × ${b.name}`;
    edge.button.querySelector('span').textContent = data.title || '连接';
    for (const state of ['active', 'visited', 'highlighted']) edge.button.classList.toggle(`is-${state}`, Boolean(data[state]));
  }
  function releaseEdge(edge) { edge.releaseLabel(); clearEdgeGeometry(edge); edge.button.remove(); edge.group.removeFromParent(); }
  function activate(action) {
    if (!enabled || !isActive()) return;
    const item = action.action === 'select' ? nodes.get(action.id) : action.action === 'edge' ? edges.get(action.id) : null;
    if (!item || item.data.disabled) return;
    onAction?.(action);
  }
  function setMusic(payload) {
    const wasEnabled = enabled;
    enabled = Boolean(payload); furniture.visible = enabled; canvas.style.touchAction = enabled ? 'none' : originalTouchAction;
    if (!payload) {
      stopGesture(); gsap.killTweensOf(view);
      nodes.forEach(node => { node.button.hidden = true; gsap.killTweensOf([node.group.position, node.group.scale]); });
      edges.forEach(edge => { edge.button.hidden = true; }); onChange?.(); return;
    }
    const newGraph = key !== payload.key; key = payload.key;
    if (newGraph) { stopGesture(); gsap.killTweensOf(view); Object.assign(view, { zoom: 1, x: 0, z: 0 }); }
    const nodeIds = new Set(payload.nodes.map(node => node.id)); const edgeIds = new Set(payload.edges.map(edge => edge.id));
    for (const [id, edge] of edges) if (!edgeIds.has(id)) { releaseEdge(edge); edges.delete(id); }
    for (const [id, node] of nodes) if (!nodeIds.has(id)) { releaseNode(node); nodes.delete(id); }
    for (const data of payload.nodes) { const exists = nodes.has(data.id); assignNode(nodes.get(data.id) || createNode(data), data, newGraph || !exists || !wasEnabled); }
    for (const data of payload.edges) if (nodes.has(data.a) && nodes.has(data.b)) assignEdge(edges.get(data.id) || createEdge(data), data);
    applyView();
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
  function screenPoint(point, camera, width, height, yOffset = 0) {
    projector.copy(point).project(camera);
    return { x: (projector.x + 1) * width / 2, y: (1 - projector.y) * height / 2 + yOffset, depth: projector.z };
  }
  function positionLabel(node, width) {
    const { x, y } = node.screen; const size = framing.labelSize(node.button);
    const offset = width <= 760 ? 8 : 10; const sourceY = y - offset;
    const shift = Math.min(22, size.width * .42); const side = size.width / 2 + 10;
    const above = sourceY - size.height - offset;
    // Prefer the sleeve's own top/bottom edge, then a small adjacent paper tab.
    // Every candidate still respects the measured UI and already placed names.
    const candidates = [
      [x, y], [x, above],
      [x + shift, y], [x - shift, y], [x + shift, above], [x - shift, above],
      [x + side, sourceY - size.height / 2], [x - side, sourceY - size.height / 2],
      [x, y + 16], [x + shift, y + 16], [x - shift, y + 16],
    ];
    const placed = candidates.find(([left, top]) => framing.placeLabel(node.button, left, top));
    if (!placed) return;
    const [labelX, labelY] = placed;
    node.button.hidden = false;
    node.button.style.transform = `translate3d(${labelX}px,${labelY}px,0) translate(-50%,0)`;
    // The short printed leader ends at the record, so sideways labels never
    // look like another artist's caption. It is decorative, not a hit target.
    const sourceX = x - (labelX - size.width / 2); const sourceTop = sourceY - labelY;
    const startX = THREE.MathUtils.clamp(sourceX, 0, size.width);
    const startY = THREE.MathUtils.clamp(sourceTop, 0, size.height);
    const dx = sourceX - startX; const dy = sourceTop - startY;
    node.button.classList.toggle('has-leader', labelX !== x || labelY !== y);
    node.button.style.setProperty('--leader-x', `${startX}px`);
    node.button.style.setProperty('--leader-y', `${startY}px`);
    node.button.style.setProperty('--leader-length', `${Math.hypot(dx, dy)}px`);
    node.button.style.setProperty('--leader-angle', `${Math.atan2(dy, dx)}rad`);
  }
  function project(camera, width, height, active) {
    const priority = node => node.data?.selected ? 5 : node.data?.highlighted ? 4 : node.data?.current ? 3 : node.data?.adjacent ? 2 : node.data?.visited ? 1 : 0;
    const orderedNodes = [...nodes.values()].sort((a, b) => priority(b) - priority(a));
    for (const node of orderedNodes) {
      node.group.getWorldPosition(location); const local = furniture.worldToLocal(location.clone());
      node.screen = screenPoint(location, camera, width, height, width <= 760 ? 8 : 10);
      node.button.hidden = true;
      if (!enabled || !active || !withinPaper(local, .055) || node.screen.depth < -1 || node.screen.depth > 1) continue;
      positionLabel(node, width);
    }
    for (const edge of edges.values()) {
      location.copy(edge.midpoint); printwork.localToWorld(location);
      const local = furniture.worldToLocal(location.clone()); const screen = screenPoint(location, camera, width, height);
      const closeToNode = orderedNodes.some(node => node.screen && Math.hypot(node.screen.x - screen.x, node.screen.y - screen.y) < (width <= 760 ? 28 : 34));
      edge.button.hidden = !enabled || !active || !(edge.data.active || edge.data.highlighted) || !withinPaper(local, .04) || screen.depth < -1 || screen.depth > 1 || closeToNode || !framing.placeLabel(edge.button, screen.x, screen.y, 'center');
      if (!edge.button.hidden) edge.button.style.transform = `translate3d(${screen.x}px,${screen.y}px,0) translate(-50%,-50%)`;
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown); host.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);
  host.addEventListener('pointermove', onPointerMove); host.addEventListener('pointerup', onPointerUp); host.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('wheel', onWheel, { passive: false });
  return { setMusic, project, activate, control, acceptHit, consumeClick, get dragging() { return pointers.size > 0 && moved; },
    finish() { gsap.getTweensOf(view).forEach(tween => tween.totalProgress(1)); nodes.forEach(node => gsap.getTweensOf([node.group.position, node.group.scale]).forEach(tween => tween.totalProgress(1))); },
    dispose() {
      stopGesture(); gsap.killTweensOf(view); canvas.style.touchAction = originalTouchAction; delete host.dataset.musicZoom;
      canvas.removeEventListener('pointerdown', onPointerDown); host.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('pointermove', onPointerMove); host.removeEventListener('pointerup', onPointerUp); host.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel); host.removeEventListener('wheel', onWheel);
      edges.forEach(releaseEdge); nodes.forEach(releaseNode);
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
      furniture.removeFromParent();
    },
  };
}

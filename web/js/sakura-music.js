import * as THREE from 'three';
import { gsap } from 'gsap';

/** A working record table in the existing shop, using the courtyard's light. */
export function createSakuraMusic({ world, cel, host, reduced, onAction, onChange }) {
  const furniture = new THREE.Group();
  furniture.name = 'record-connection-table';
  furniture.position.set(0, 1.19, -1.3);
  furniture.visible = false;
  world.add(furniture);
  const printwork = new THREE.Group();
  furniture.add(printwork);
  printwork.visible = false;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const geometry = shape => { geometries.add(shape); return shape; };
  const material = options => { const item = cel({ ...options, cache: false, flat: false }); materials.add(item); return item; };
  const wood = material({ color: '#b4967b' });
  const green = material({ color: '#688278' });
  const paper = material({ color: '#ecebe4', bands: 'soft' });
  const vinyl = material({ color: '#39484b' });
  const brass = material({ color: '#c8a774' });
  const thread = material({ color: '#b07882', bands: 'soft' });
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const disc = geometry(new THREE.CylinderGeometry(1, 1, 1, 40));
  const face = geometry(new THREE.PlaneGeometry(1, 1));
  const ring = geometry(new THREE.TorusGeometry(1, .009, 4, 40));
  function object(shape, paint, xyz, scale, parent = furniture) {
    const item = new THREE.Mesh(shape, paint);
    item.position.set(...xyz); item.scale.set(...scale);
    item.castShadow = true; item.receiveShadow = true;
    parent.add(item); return item;
  }
  object(cube, wood, [0, -.075, 0], [3.94, .15, 2.7]);
  object(cube, green, [0, -.19, 0], [3.63, .16, 2.48]);
  for (const x of [-1.66, 1.66]) for (const z of [-1.08, 1.08]) {
    object(cube, wood, [x, -.57, z], [.15, .95, .15]);
    object(cube, green, [x, -.94, z], [.16, .18, .16]);
  }
  // A paper plan and two brass clips sit on the wood; connections live on it.
  object(cube, paper, [0, .008, 0], [3.72, .025, 2.5]);
  for (const x of [-1.39, 1.39]) {
    object(cube, brass, [x, .035, -1.25], [.26, .045, .11]);
    object(cube, green, [x, .061, -1.285], [.14, .016, .035]);
  }
  // Quiet joins give the edge a handmade scale without another image asset.
  for (const x of [-1.91, 1.91]) for (const z of [-1.23, 1.23]) object(disc, brass, [x, .008, z], [.018, .012, .018]);

  const slots = [];
  const ropes = [];
  let current = null;
  let payloadSignature = '';
  let enabled = false;
  const projected = new THREE.Vector3();
  const location = new THREE.Vector3();
  const vertical = new THREE.Vector3(0, 1, 0);
  const ropeFrom = new THREE.Vector3();
  const ropeTo = new THREE.Vector3();

  function coverTexture(artist, index, center) {
    const surface = document.createElement('canvas');
    surface.width = 512; surface.height = 512;
    const ctx = surface.getContext('2d');
    const ink = '#35534d'; const tone = artist.color || '#ab8c99';
    ctx.fillStyle = '#f7f3eb'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = tone; ctx.fillRect(23, 23, 466, 326);
    ctx.save(); ctx.beginPath(); ctx.rect(23, 23, 466, 326); ctx.clip();
    ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 16;
    const pattern = index % 3;
    if (pattern === 0) {
      for (let r = 42; r < 410; r += 35) { ctx.beginPath(); ctx.arc(292, 139, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (pattern === 1) {
      for (let x = -180; x < 620; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 190, 100, x - 50, 250, x + 160, 390); ctx.stroke(); }
    } else {
      for (let y = -50; y < 380; y += 53) for (let x = -30; x < 540; x += 58) { ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore(); ctx.fillStyle = ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 40px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(artist.name, 26, 399, 455);
    ctx.font = '600 16px Arial, "Microsoft YaHei", sans-serif';
    ctx.fillText(center ? `${artist.count || 0} 首收录 · SIDE B` : 'SIDE B / CONNECTION', 28, 462, 400);
    ctx.fillRect(27, 430, 455, 2);
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    textures.add(texture); return texture;
  }
  function createSlot(index) {
    const center = index === 0;
    const group = new THREE.Group(); group.name = `connection-record-${index}`;
    printwork.add(group);
    const size = center ? .84 : .62;
    object(disc, vinyl, [size * .22, .025, -.012], [size * .43, .025, size * .43], group);
    for (const radius of [.27, .34, .39]) {
      const groove = object(ring, green, [size * .22, .04, -.012], [size * radius, size * radius, size * radius], group);
      groove.rotation.x = -Math.PI / 2; groove.castShadow = false;
    }
    object(disc, brass, [size * .22, .042, -.012], [size * .13, .006, size * .13], group);
    object(cube, paper, [-size * .12, .047, 0], [size, .027, size], group);
    const cover = material({ color: '#ffffff', bands: 'soft' });
    const panel = object(face, cover, [-size * .12, .062, 0], [size * .96, size * .96, 1], group);
    panel.rotation.x = -Math.PI / 2; panel.castShadow = false;
    const button = document.createElement('button');
    button.type = 'button'; button.className = `world-music-label world-music-label--${center ? 'center' : 'neighbor'}`;
    button.innerHTML = '<strong></strong><small></small>';
    button.hidden = true; host.append(button);
    const slot = { group, panel, button, texture: null, identity: '', artist: null, center };
    button.addEventListener('click', () => activate({ type: 'music', action: center ? 'artist' : 'move', id: slot.artist?.id }));
    slots.push(slot); return slot;
  }
  function assign(slot, artist, index) {
    slot.artist = artist; slot.group.visible = Boolean(artist);
    if (!artist) { slot.button.hidden = true; return; }
    const identity = JSON.stringify([artist.id, artist.name, artist.color, artist.count]);
    if (slot.identity !== identity) {
      if (slot.texture) { slot.texture.dispose(); textures.delete(slot.texture); }
      slot.texture = coverTexture(artist, index, slot.center); slot.identity = identity;
      slot.panel.material.map = slot.texture; slot.panel.material.needsUpdate = true;
    }
    slot.group.userData.action = artist.disabled ? null : { type: 'music', action: slot.center ? 'artist' : 'move', id: artist.id };
    slot.button.querySelector('strong').textContent = artist.name;
    slot.button.querySelector('small').textContent = slot.center ? `${artist.count || 0} 首收录` : artist.songTitle || artist.reason || '共同署名';
    slot.button.disabled = Boolean(artist.disabled);
    slot.button.setAttribute('aria-label', slot.center ? `查看 ${artist.name} 的作品` : `沿${artist.songTitle || artist.reason || '共同署名'}探索 ${artist.name}`);
    slot.button.style.setProperty('--record-tone', artist.color || '#a78896');
  }
  function updateRopes() {
    for (let index = 0; index < ropes.length; index++) {
      const rope = ropes[index]; const slot = slots[index + 1];
      rope.visible = Boolean(slot?.group.visible);
      if (!rope.visible) continue;
      ropeFrom.copy(slots[0].group.position); ropeFrom.y = .034;
      ropeTo.copy(slot.group.position); ropeTo.y = .034;
      rope.position.copy(ropeFrom).add(ropeTo).multiplyScalar(.5);
      rope.scale.set(.009, ropeFrom.distanceTo(ropeTo), .009);
      rope.quaternion.setFromUnitVectors(vertical, ropeTo.sub(ropeFrom).normalize());
    }
  }
  function activate(action) {
    const slot = slots.find(item => item.artist?.id === action.id && item.group.visible);
    if (!enabled || !slot || slot.artist.disabled) return;
    if (!reduced.matches) {
      gsap.killTweensOf(slot.group.position);
      gsap.to(slot.group.position, { y: slot.group.position.y + .16, duration: .13, repeat: 1, yoyo: true, ease: 'power2.out', onUpdate: onChange });
    }
    // Business actions stay synchronous; leaving the shop cannot open an old modal.
    onAction?.(action);
  }
  function setMusic(payload) {
    enabled = Boolean(payload); furniture.visible = enabled; printwork.visible = enabled;
    if (!payload) { current = null; slots.forEach(slot => { slot.button.hidden = true; }); onChange?.(); return; }
    const artists = [payload.artist, ...payload.neighbors.slice(0, 8)];
    const signature = JSON.stringify([payload.key, artists]);
    const changed = signature !== payloadSignature;
    const first = !current;
    current = payload; payloadSignature = signature;
    for (let index = slots.length; index < artists.length; index++) createSlot(index);
    for (let index = ropes.length; index < artists.length - 1; index++) {
      const cord = object(disc, thread, [0, .034, 0], [.009, 1, .009], printwork);
      cord.castShadow = false; ropes.push(cord);
    }
    slots.forEach((slot, index) => {
      if (changed || first) assign(slot, artists[index], index);
      if (!artists[index]) return;
      const count = artists.length - 1;
      const startAngle = count === 4 ? -Math.PI * .75 : -Math.PI / 2;
      const angle = startAngle + (index - 1) / Math.max(1, count) * Math.PI * 2 + (payload.yaw || 0);
      let x = index ? Math.cos(angle) * 1.35 : 0;
      let z = index ? Math.sin(angle) * .84 : 0;
      if (count === 1) {
        const diagonal = -Math.PI / 4 + (payload.yaw || 0) + (index ? 0 : Math.PI);
        x = Math.cos(diagonal) * (index ? 1.4 : .69); z = Math.sin(diagonal) * (index ? .9 : .46);
      }
      if (count === 2) {
        const triangle = (index ? index === 1 ? -.78 : -.22 : .5) * Math.PI + (payload.yaw || 0);
        x = Math.cos(triangle) * (index ? 1.4 : .54); z = Math.sin(triangle) * (index ? .9 : .36);
      }
      const y = index ? .014 + Math.max(0, Math.sin(payload.pitch || 0) * z * .12) : .04;
      gsap.killTweensOf([slot.group.position, slot.group.rotation]);
      if (changed && !first && !reduced.matches) slot.group.position.y += .22;
      const duration = first || reduced.matches ? 0 : changed ? .32 : .3;
      gsap.to(slot.group.position, { x, y, z, duration, ease: 'power3.out', onUpdate() { updateRopes(); onChange?.(); } });
      gsap.to(slot.group.rotation, { y: index ? (index % 2 ? -.055 : .07) : -.065, duration, ease: 'power3.out' });
    });
    updateRopes(); onChange?.();
  }
  function project(camera, width, height, active) {
    slots.forEach(slot => {
      if (!enabled || !active || !slot.group.visible) { slot.button.hidden = true; return; }
      slot.group.getWorldPosition(location); location.y += .07;
      projected.copy(location).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2 + (slot.center ? 20 : 15);
      slot.button.hidden = projected.z < -1 || projected.z > 1 || x < 20 || x > width - 20 || y < 105 || y > height - 145;
      if (!slot.button.hidden) slot.button.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,0)`;
    });
  }
  return { setMusic, project, activate, finish() { slots.forEach(slot => gsap.getTweensOf([slot.group.position, slot.group.rotation]).forEach(tween => tween.totalProgress(1))); },
    dispose() {
      slots.forEach(slot => { gsap.killTweensOf([slot.group.position, slot.group.rotation]); slot.button.remove(); });
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
      furniture.removeFromParent();
    },
  };
}

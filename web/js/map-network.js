import { artistsInDataset, edges, otherArtist } from './map-data.js';

const layouts = new Map();
export const networkEdges = (dataset, mode = 'co') => edges.filter(edge => edge.dataset === dataset && edge.mode === mode);

/** The shortest chain in this catalogue, never an assertion about all music.
 *  最短链只用于提示、揭晓与回顾对比，不直接展示。 */
export function shortestChain(start, target, dataset, mode = 'co') {
  const ids = new Set(artistsInDataset(dataset).map(artist => artist.id));
  if (!ids.has(start) || !ids.has(target)) return null;
  const links = networkEdges(dataset, mode);
  const previous = new Map([[start, null]]);
  const queue = [start];
  for (let index = 0; index < queue.length && !previous.has(target); index++) {
    const id = queue[index];
    for (const edge of links) {
      if (edge.a !== id && edge.b !== id) continue;
      const next = otherArtist(edge, id);
      if (previous.has(next)) continue;
      previous.set(next, { id, edge }); queue.push(next);
    }
  }
  if (!previous.has(target)) return null;
  const nodes = [target]; const path = [];
  for (let id = target; previous.get(id);) {
    const step = previous.get(id); path.unshift(step.edge); nodes.unshift(step.id); id = step.id;
  }
  return { nodes, edges: path };
}

// 寻声 helpers. The shortest chain is only used for hints, the reveal and the
// recap comparison ("本专题最短"); it is never shown before the player asks.
const edgeById = new Map(edges.map(edge => [edge.id, edge]));
export const roundEdge = id => edgeById.get(id) || null;

/** What the player has uncovered in a round. Derived from the session only; nothing extra is stored. */
export function roundKnowledge(session) {
  const fog = Boolean(session?.fog && session.type === 'challenge' && session.status === 'active');
  const visited = new Set([session.start, ...session.path.map(step => step.id), ...session.events.filter(event => event.type === 'move').map(event => event.to)]);
  const flipped = new Set([...(session.flipped || []), ...session.path.map(step => step.edgeId).filter(Boolean)]);
  const known = new Set([...visited, session.target].filter(Boolean));
  for (const id of flipped) { const edge = edgeById.get(id); if (edge) { known.add(edge.a); known.add(edge.b); } }
  return { fog, visited, flipped, known };
}

/** BFS distance (in co songs) from one artist to every reachable artist of the same catalogue. */
export function distancesFrom(target, dataset, mode = 'co') {
  const links = networkEdges(dataset, mode);
  const distance = new Map([[target, 0]]);
  const queue = [target];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const edge of links) {
      if (edge.a !== id && edge.b !== id) continue;
      const next = otherArtist(edge, id);
      if (!distance.has(next)) { distance.set(next, distance.get(id) + 1); queue.push(next); }
    }
  }
  return distance;
}

export const chainLength = (start, target, dataset, mode = 'co') => shortestChain(start, target, dataset, mode)?.edges.length ?? null;

/** Hint data for the current position: remaining songs, how many of the songs in hand lead closer, and one next song on a shortest chain. */
export function roundHint(session) {
  const dataset = session.dataset;
  const current = session.path[session.path.length - 1].id;
  const distance = distancesFrom(session.target, dataset);
  const here = distance.get(current) ?? null;
  const hand = networkEdges(dataset, 'co').filter(edge => edge.a === current || edge.b === current);
  const closer = here === null ? 0 : hand.filter(edge => distance.get(otherArtist(edge, current)) === here - 1).length;
  const nextEdge = shortestChain(current, session.target, dataset, 'co')?.edges[0] || null;
  return { distance: here, closer, total: hand.length, nextEdge };
}

/** Every equally short route (up to `limit`), walking the distance layers from the start. Recap only. */
export function shortestChains(start, target, dataset, limit = 3, mode = 'co') {
  const distance = distancesFrom(target, dataset, mode);
  if (!distance.has(start)) return [];
  const links = networkEdges(dataset, mode);
  const routes = [];
  (function walk(id, nodes, path) {
    if (routes.length >= limit) return;
    if (id === target) { routes.push({ nodes, edges: path }); return; }
    for (const edge of links) {
      if (edge.a !== id && edge.b !== id) continue;
      const next = otherArtist(edge, id);
      if (distance.get(next) === distance.get(id) - 1) walk(next, [...nodes, next], [...path, edge]);
    }
  })(start, [start], []);
  return routes;
}

/** Where sleeves may lie, in table metres. The 2D fallback maps this box with x / 3.8 and z / 2.7. */
const BOUNDS = { x: 1.58, z: .98 };
/** Seeds tried for each catalogue; the tidiest result (fewest crossings, no ink under a sleeve) is kept. */
const SEEDS = 8;
// Math.hypot and trigonometry may differ in the last bit between engines; √ never does.
const span = (dx, dz) => Math.sqrt(dx * dx + dz * dz);

/** A deterministic, cached layout. Selecting a sleeve never shuffles the map.
 *  Stress majorization on song distances gives the shape (near singers stay near, few
 *  crossings); a spacing pass then keeps every sleeve clear of its neighbours and of other
 *  singers' ink. The spacing follows the node count, so 9 or 29 sleeves both fill the table. */
export function networkLayout(dataset, mode = 'co') {
  const key = `${dataset}:${mode}`;
  if (layouts.has(key)) return layouts.get(key);
  const artists = artistsInDataset(dataset);
  const n = artists.length;
  const slot = new Map(artists.map((artist, index) => [artist.id, index]));
  const pairs = networkEdges(dataset, mode).map(edge => [slot.get(edge.a), slot.get(edge.b)]);
  const degree = artists.map((_, index) => pairs.filter(([a, b]) => a === index || b === index).length);
  // Song distances. A singer with no path counts as the farthest pair, and only loosely.
  const hops = artists.map(artist => distancesFrom(artist.id, dataset, mode));
  const far = Math.max(1, ...hops.flatMap(found => [...found.values()]));
  const want = artists.map((_, i) => artists.map((other, j) => i === j ? 0 : hops[i].get(other.id) ?? far));
  const weight = want.map((row, i) => row.map((d, j) => i === j ? 0 : (hops[i].has(artists[j].id) ? 1 : .08) / (d * d)));
  // Spacing: the gap a hexagonal packing of n sleeves would leave, capped at the 12-sleeve gap.
  const gap = Math.min(.62, .93 * Math.sqrt(1.1547 * 4 * BOUNDS.x * BOUNDS.z / n));
  const clear = gap * .42;
  const order = artists.map((_, index) => index).sort((a, b) => degree[b] - degree[a] || artists[a].id.localeCompare(artists[b].id));
  let best = null;
  for (let seed = 0; seed < SEEDS; seed++) {
    const tried = arrange(seed);
    if (!best || tried.score < best.score) best = tried;
  }
  const result = artists.map((artist, index) => ({ ...artist, x: best.x[index], z: best.z[index], degree: degree[index] }));
  layouts.set(key, result);
  return result;

  function arrange(seed) {
    const x = new Float64Array(n); const z = new Float64Array(n);
    // Scatter from a fixed integer generator. Only + − × ÷ and √ follow, so every browser
    // computes the same bits and the same table.
    let state = (seed + 1) * 0x9e3779b9 | 0;
    const random = () => { state = state + 0x6d2b79f5 | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (const index of order) { x[index] = (random() - .5) * far * 1.6; z[index] = (random() - .5) * far; }
    // Stress majorization (localized SMACOF), weights 1 / d². A singer without songs here waits aside.
    const placed = degree.map(count => count > 0 || n === 1);
    for (let step = 0; step < 150; step++) for (let i = 0; i < n; i++) {
      if (!placed[i]) continue;
      let sx = 0; let sz = 0; let sw = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || !placed[j]) continue;
        const d = want[i][j]; const w = weight[i][j];
        const dx = x[i] - x[j]; const dz = z[i] - z[j]; const length = span(dx, dz) || 1e-6;
        sx += w * (x[j] + d * dx / length); sz += w * (z[j] + d * dz / length); sw += w;
      }
      if (sw) { x[i] = sx / sw; z[i] = sz / sw; }
    }
    // Lay the long axis along the table, then fill the printed area.
    const inside = order.filter(index => placed[index]);
    const cx = inside.reduce((sum, i) => sum + x[i], 0) / inside.length; const cz = inside.reduce((sum, i) => sum + z[i], 0) / inside.length;
    let xx = 0; let zz = 0; let xz = 0;
    for (const i of inside) { const dx = x[i] - cx; const dz = z[i] - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
    // Rotate by minus half the covariance angle, from half-angle identities (no trigonometry).
    const spread = Math.sqrt((xx - zz) * (xx - zz) + 4 * xz * xz); const double = spread ? (xx - zz) / spread : 1;
    const cos = Math.sqrt(Math.max(0, (1 + double) / 2)); const sin = -(xz < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (1 - double) / 2));
    for (const i of inside) { const dx = x[i] - cx; const dz = z[i] - cz; x[i] = dx * cos - dz * sin; z[i] = dx * sin + dz * cos; }
    const spanX = Math.max(1e-6, ...inside.map(i => Math.abs(x[i]))); const spanZ = Math.max(1e-6, ...inside.map(i => Math.abs(z[i])));
    for (const i of inside) { x[i] *= BOUNDS.x * .94 / spanX; z[i] *= BOUNDS.z * .94 / spanZ; }
    // Waiting singers take the free corner or side farthest from everyone else.
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue;
      let spot = null;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const px = sx * BOUNDS.x; const pz = sz * BOUNDS.z;
        const room = Math.min(...inside.map(j => span(px - x[j], pz - z[j])));
        if (!spot || room > spot.room + 1e-9) spot = { px, pz, room };
      }
      x[i] = spot.px; z[i] = spot.pz; placed[i] = true; inside.push(i);
    }
    // Songs keep the length the fitted shape gave them, never shorter than the spacing.
    const unit = pairs.length ? pairs.reduce((sum, [a, b]) => sum + span(x[a] - x[b], z[a] - z[b]), 0) / pairs.length : gap;
    const rest = Math.max(gap * 1.05, unit);
    const fx = new Float64Array(n); const fz = new Float64Array(n);
    for (let step = 0; step < 280; step++) {
      fx.fill(0); fz.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = x[i] - x[j]; const dz = z[i] - z[j]; const d = Math.max(.01, span(dx, dz));
        if (d >= gap) continue;
        const push = (gap - d) * .5; fx[i] += dx / d * push; fz[i] += dz / d * push; fx[j] -= dx / d * push; fz[j] -= dz / d * push;
      }
      for (const [a, b] of pairs) {
        const dx = x[b] - x[a]; const dz = z[b] - z[a]; const d = Math.max(.01, span(dx, dz));
        const pull = (d - rest) * .02; fx[a] += dx / d * pull; fz[a] += dz / d * pull; fx[b] -= dx / d * pull; fz[b] -= dz / d * pull;
        // Keep other sleeves off this ink.
        for (let i = 0; i < n; i++) {
          if (i === a || i === b) continue;
          const t = ((x[i] - x[a]) * dx + (z[i] - z[a]) * dz) / (d * d);
          if (t <= 0 || t >= 1) continue;
          const px = x[i] - x[a] - dx * t; const pz = z[i] - z[a] - dz * t; const off = span(px, pz);
          if (off >= clear) continue;
          const nx = off > 1e-4 ? px / off : -dz / d; const nz = off > 1e-4 ? pz / off : dx / d;
          const push = (clear - off) * .3;
          fx[i] += nx * push; fz[i] += nz * push; fx[a] -= nx * push / 2; fz[a] -= nz * push / 2; fx[b] -= nx * push / 2; fz[b] -= nz * push / 2;
        }
      }
      const cooling = 1 - step / 350;
      for (let i = 0; i < n; i++) {
        x[i] = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, x[i] + Math.max(-.05, Math.min(.05, fx[i])) * cooling));
        z[i] = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, z[i] + Math.max(-.05, Math.min(.05, fz[i])) * cooling));
      }
    }
    return { x, z, score: untidiness(x, z) };
  }
  /** Crossing songs, ink passing under another sleeve (weighted ×3) and crowding below the gap. */
  function untidiness(x, z) {
    let score = 0;
    const side = (a, b, c) => Math.sign((x[b] - x[a]) * (z[c] - z[a]) - (z[b] - z[a]) * (x[c] - x[a]));
    for (let e = 0; e < pairs.length; e++) for (let f = e + 1; f < pairs.length; f++) {
      const [a, b] = pairs[e]; const [c, d] = pairs[f];
      if (a === c || a === d || b === c || b === d) continue;
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) score += 1;
    }
    for (const [a, b] of pairs) {
      const dx = x[b] - x[a]; const dz = z[b] - z[a]; const d2 = dx * dx + dz * dz || 1e-6;
      for (let i = 0; i < n; i++) {
        if (i === a || i === b) continue;
        const t = Math.max(0, Math.min(1, ((x[i] - x[a]) * dx + (z[i] - z[a]) * dz) / d2));
        if (span(x[i] - x[a] - dx * t, z[i] - z[a] - dz * t) < clear * .7) score += 3;
      }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (span(x[i] - x[j], z[i] - z[j]) < gap * .85) score += 3;
    return score;
  }
}

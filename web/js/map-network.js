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

/** A deterministic, cached layout. Selecting a sleeve never shuffles the map. */
export function networkLayout(dataset, mode = 'co') {
  const key = `${dataset}:${mode}`;
  if (layouts.has(key)) return layouts.get(key);
  const artists = artistsInDataset(dataset);
  const links = networkEdges(dataset, mode);
  const degree = new Map(artists.map(artist => [artist.id, links.filter(edge => edge.a === artist.id || edge.b === artist.id).length]));
  const ordered = [...artists].sort((a, b) => degree.get(b.id) - degree.get(a.id) || a.id.localeCompare(b.id));
  const points = ordered.map((artist, index) => {
    const angle = index * 2.399963;
    const radius = Math.sqrt((index + .6) / ordered.length);
    return { id: artist.id, x: Math.cos(angle) * radius * 1.48, z: Math.sin(angle) * radius * .91 };
  });
  const byId = new Map(points.map(point => [point.id, point]));
  for (let step = 0; step < 360; step++) {
    const force = new Map(points.map(point => [point.id, { x: -point.x * .004, z: -point.z * .004 }]));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i]; const b = points[j];
      const dx = a.x - b.x; const dz = a.z - b.z;
      const distance = Math.max(.03, Math.hypot(dx, dz));
      const strength = .014 / (distance * distance) + Math.max(0, .61 - distance) * .13;
      const x = dx / distance * strength; const z = dz / distance * strength;
      force.get(a.id).x += x; force.get(a.id).z += z;
      force.get(b.id).x -= x; force.get(b.id).z -= z;
    }
    for (const edge of links) {
      const a = byId.get(edge.a); const b = byId.get(edge.b);
      const dx = b.x - a.x; const dz = b.z - a.z;
      const distance = Math.max(.03, Math.hypot(dx, dz));
      const strength = (distance - .73) * .033;
      force.get(a.id).x += dx / distance * strength; force.get(a.id).z += dz / distance * strength;
      force.get(b.id).x -= dx / distance * strength; force.get(b.id).z -= dz / distance * strength;
    }
    const cooling = .85 - step / 480;
    for (const point of points) {
      const f = force.get(point.id);
      point.x = Math.max(-1.58, Math.min(1.58, point.x + Math.max(-.07, Math.min(.07, f.x)) * cooling));
      point.z = Math.max(-.98, Math.min(.98, point.z + Math.max(-.07, Math.min(.07, f.z)) * cooling));
    }
  }
  const result = artists.map(artist => ({ ...artist, ...byId.get(artist.id), degree: degree.get(artist.id) }));
  layouts.set(key, result);
  return result;
}

import { artistsInDataset, edges, otherArtist } from './map-data.js';

const layouts = new Map();
export const networkEdges = (dataset, mode = 'co') => edges.filter(edge => edge.dataset === dataset && edge.mode === mode);

/** The shortest chain in this catalogue, never an assertion about all music. */
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

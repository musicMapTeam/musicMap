import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationStorage, EXPLORATION_KEY } from '../web/js/exploration-storage.js';

function fixture(initial = { version: 1, map: { sessions: [{ id: 'first', steps: 1 }] } }) {
  let raw = initial == null ? null : JSON.stringify(initial);
  let writes = 0, fail = false, readFail = false;
  const storage = { getItem() { if (readFail) throw Error('denied'); return raw; }, setItem(key, value) { assert.equal(key, EXPLORATION_KEY); if (fail) throw Error('quota'); raw = value; writes++; } };
  // Shared exclusive lock across independent tab stores, matching navigator.locks.request.
  let tail = Promise.resolve();
  const locks = { request(name, options, callback) { assert.match(name, /:write$/); assert.equal(options.mode, 'exclusive'); const next = tail.then(callback); tail = next.catch(() => {}); return next; } };
  const tab = () => createExplorationStorage({ storage, locks });
  return { tab, storage, locks, current: () => JSON.parse(raw), raw: () => raw, writes: () => writes, replace: value => { raw = value; }, fail: value => { fail = value; }, readFail: value => { readFail = value; } };
}
const state = (...ids) => ({ version: 1, view: 'records', routePayload: { secret: 'ephemeral' }, map: { sessions: ids.map(id => ({ id })) } });

test('a fresh tab saves sessions using the old key/schema without persisting navigation', async () => {
  const f = fixture(), a = f.tab(); assert.equal(await a.save(state('first', 'new')), true);
  assert.deepEqual(f.current(), { version: 1, map: { sessions: [{ id: 'first' }, { id: 'new' }] } }); assert.equal(a.dirty, false);
});
test('stale tab cannot replace a newer addition, even without receiving a storage event', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); await a.save(state('first', 'new'));
  assert.equal(b.check(), false); assert.equal(await b.save(state('first')), false); assert.equal(b.conflict, true);
  assert.deepEqual(f.current().map.sessions.map(x => x.id), ['first', 'new']); assert.equal(f.writes(), 1);
});
test('stale tab cannot revive a deleted session', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); await a.save(state()); await b.save(state('first'));
  assert.deepEqual(f.current().map.sessions, []); assert.equal(b.conflict, true);
});
test('same-session edits conflict rather than dropping steps or silently merging paths', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); const sa = state('first'), sb = state('first');
  sa.map.sessions[0].steps = 2; sb.map.sessions[0].steps = 3;
  assert.equal(await a.save(sa), true); assert.equal(await b.save(sb), false); assert.equal(f.current().map.sessions[0].steps, 2);
  assert.equal(sb.map.sessions[0].steps, 3); assert.equal(b.dirty, true);
});
test('different-session edits do not silently overwrite or resurrect records either', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); await a.save(state('first', 'A')); assert.equal(await b.save(state('first', 'B')), false);
  assert.deepEqual(f.current().map.sessions.map(x => x.id), ['first', 'A']);
});
test('two simultaneous writers serialize the comparison and only one can commit', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); const outcomes = await Promise.all([a.save(state('first', 'A')), b.save(state('first', 'B'))]);
  assert.deepEqual(outcomes, [true, false]); assert.equal(f.writes(), 1); assert.equal(b.conflict, true);
});
test('one tab queues rapid edits in order and snapshots each call', async () => {
  const f = fixture(), a = f.tab(), s = state('first'); const p1 = a.save(s); s.map.sessions.push({ id: 'second' }); const p2 = a.save(s);
  assert.equal(a.pending, 2); assert.equal(a.dirty, true); assert.deepEqual(await Promise.all([p1, p2]), [true, true]);
  assert.deepEqual(f.current().map.sessions.map(x => x.id), ['first', 'second']); assert.equal(a.pending, 0); assert.equal(a.dirty, false);
});
test('version is checked again inside the lock, after waiting for another writer', async () => {
  const f = fixture(); let grant; const locks = { request: (name, options, fn) => new Promise(resolve => { grant = () => resolve(fn()); }) };
  const a = createExplorationStorage({ storage: f.storage, locks }); const p = a.save(state('mine')); await new Promise(setImmediate);
  f.replace(JSON.stringify(state('other'))); grant(); assert.equal(await p, false); assert.equal(a.conflict, true); assert.equal(f.writes(), 0);
});
test('clear/remove of the exploration key blocks an old tab from recreating it', async () => {
  const f = fixture(), b = f.tab(); f.replace(null); assert.equal(b.check(), false); assert.equal(await b.save(state('first')), false); assert.equal(f.raw(), null);
});
test('quota failure keeps local edits, retry is safe when storage has not changed', async () => {
  const f = fixture(), a = f.tab(), s = state('first', 'mine'); f.fail(true); assert.equal(await a.save(s), false); assert.equal(a.failed, true); assert.equal(a.dirty, true);
  f.fail(false); assert.equal(await a.save(s), true); assert.equal(a.failed, false); assert.equal(a.dirty, false);
});
test('retry after another tab saved cannot overwrite its newer version', async () => {
  const f = fixture(), a = f.tab(), b = f.tab(); f.fail(true); await b.save(state('mine')); f.fail(false); await a.save(state('newer'));
  assert.equal(await b.save(state('mine')), false); assert.equal(b.conflict, true); assert.equal(f.current().map.sessions[0].id, 'newer');
});
test('unsupported or denied locks retain edits without unsafe fallback writes', async () => {
  for (const locks of [undefined, { request: async () => { throw Error('SecurityError'); } }]) {
    const f = fixture(), a = createExplorationStorage({ storage: f.storage, locks });
    assert.equal(await a.save(state('mine')), false); assert.equal(a.failed, true); assert.equal(a.dirty, true); assert.equal(f.writes(), 0);
  }
});
test('failed initial read cannot later authorize overwriting unknown saved records', async () => {
  const f = fixture(); f.readFail(true); const a = f.tab(); f.readFail(false);
  assert.equal(await a.save(state('mine')), false); assert.equal(f.writes(), 0); assert.equal(a.conflict, true);
});
test('reloading creates a fresh baseline that can continue after conflict', async () => {
  const f = fixture(), a = f.tab(), stale = f.tab(); await a.save(state('new')); assert.equal(stale.check(), false);
  const fresh = f.tab(); assert.deepEqual(JSON.parse(fresh.initialRaw), f.current()); assert.equal(await fresh.save(state('new', 'next')), true);
});
test('legacy saves retain exploration content while dropping Space and transient route fields', async () => {
  const old = { version: 1, view: 'space', actor: 'old', space: { photos: [] }, map: { sessions: [{ id: 'legacy', path: ['a', 'b'], saved: [{ id: 'song' }] }] } };
  const f = fixture(old), a = f.tab(); assert.equal(await a.save(JSON.parse(a.initialRaw)), true);
  assert.deepEqual(f.current().map, old.map); assert.equal(f.current().space, undefined); assert.equal(f.current().actor, undefined);
});

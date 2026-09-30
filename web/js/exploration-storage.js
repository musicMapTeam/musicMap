// Keep the existing key/schema readable by returning visitors. Routes are tab-local.
export const EXPLORATION_KEY = 'music-map-space:v1';
const LOCK_NAME = `${EXPLORATION_KEY}:write`;

/** A snapshot may be written only if this tab still owns the version it read.
 * Web Locks serializes the comparison + write across cooperating tabs:
 * https://www.w3.org/TR/web-locks/
 * No blind merge: that would resurrect deletions or mix two edits of one route.
 * onChange never replaces the caller's in-memory work, including failed saves.
 */
export function createExplorationStorage({ storage, locks, onChange = () => {} }) {
  let baseline = null;
  let latest = null;
  let failed = false;
  let conflict = false;
  let unreadable = false;
  let pending = 0;
  let tail = Promise.resolve();
  try { baseline = storage.getItem(EXPLORATION_KEY); }
  catch { failed = true; unreadable = true; }
  latest = baseline;

  function check() {
    if (conflict) return false;
    try {
      const current = storage.getItem(EXPLORATION_KEY);
      // A failed initial read must never become permission to replace unknown data.
      if (unreadable || current !== baseline) {
        conflict = true;
        onChange();
        return false;
      }
      return true;
    } catch {
      failed = true;
      onChange();
      return false;
    }
  }

  function save(state) {
    // Capture now; a later queued save must not serialize a newer mutable object.
    const serialized = JSON.stringify({ version: 1, map: state.map });
    latest = serialized;
    pending++;
    const task = tail.then(async () => {
      if (!check()) return false;
      // Never fall back to a racy read-then-write. Unsupported browsers retain
      // the in-memory edit and show the same persistent recovery warning.
      if (!locks?.request) throw new Error('Safe cross-tab storage is unavailable');
      return locks.request(LOCK_NAME, { mode: 'exclusive' }, () => {
        if (!check()) return false;
        storage.setItem(EXPLORATION_KEY, serialized);
        baseline = serialized;
        failed = false;
        return true;
      });
    }).catch(() => { failed = true; return false; }).finally(() => {
      pending--;
      onChange();
    });
    tail = task;
    return task;
  }

  return {
    initialRaw: baseline,
    check,
    save,
    get conflict() { return conflict; },
    get failed() { return failed; },
    get pending() { return pending; },
    get dirty() { return latest !== baseline; },
    settled: () => tail,
  };
}

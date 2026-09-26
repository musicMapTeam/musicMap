const STORAGE_KEY = 'music-map-saved-music:v1';
const listeners = new Set();

function readStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version === 1 && Array.isArray(stored.tracks)) return { ...stored, imports: stored.imports || [] };
  } catch { /* An empty browser starts with an empty collection. */ }
  return { version: 1, tracks: [], imports: [] };
}

function snapshot(track) {
  if (!track?.id || !track.title || !Array.isArray(track.artists) || !['real', 'hf'].includes(track.dataset)) {
    throw new Error('这首作品还缺少可保存的信息');
  }
  return {
    id: track.id, title: track.title, artists: [...track.artists],
    source: track.source || track.sourceUrl || '', dataset: track.dataset,
    savedAt: track.savedAt || Date.now(),
  };
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  [...listeners].forEach(listener => listener(getSavedMusic()));
}

export function getSavedMusic() {
  return readStore().tracks.sort((a, b) => b.savedAt - a.savedAt);
}

export function saveMusic(track) {
  const store = readStore();
  const previous = store.tracks.find(item => item.id === track.id);
  if (previous) return previous;
  const entry = snapshot(track);
  store.tracks.push(entry); writeStore(store); return entry;
}

export function toggleSavedMusic(track) {
  const store = readStore();
  const index = store.tracks.findIndex(item => item.id === track.id);
  if (index >= 0) store.tracks.splice(index, 1);
  else store.tracks.push(snapshot(track));
  writeStore(store); return index < 0;
}

export function removeSavedMusic(id) {
  const store = readStore();
  const index = store.tracks.findIndex(item => item.id === id);
  if (index < 0) return false;
  store.tracks.splice(index, 1); writeStore(store); return true;
}

/** Import historical Map saves once, without reviving later removals. */
export function importSavedMusic(tracks, marker = 'map-sessions-v1') {
  const store = readStore();
  if (store.imports.includes(marker)) return 0;
  const existing = new Set(store.tracks.map(item => item.id));
  let added = 0;
  tracks.forEach(track => {
    if (existing.has(track.id)) return;
    store.tracks.push(snapshot(track)); existing.add(track.id); added++;
  });
  store.imports.push(marker); writeStore(store); return added;
}

function onStorage(event) {
  if (event.key === STORAGE_KEY || event.key === null) [...listeners].forEach(listener => listener(getSavedMusic()));
}

export function subscribeSavedMusic(listener) {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

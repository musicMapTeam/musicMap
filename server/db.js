import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const dataDirectory = resolve(process.env.DATA_DIR || resolve(projectRoot, 'data'));
mkdirSync(dataDirectory, { recursive: true });

export const db = new DatabaseSync(resolve(dataDirectory, 'music-map.sqlite'), { timeout: 3000 });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    event_id TEXT NOT NULL,
    creator_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS room_members (
    room_id TEXT NOT NULL REFERENCES rooms(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    joined_at TEXT NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    mime TEXT NOT NULL CHECK (mime = 'image/jpeg'),
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_photos_room_owner ON photos(room_id, owner_id);
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    photo_key TEXT NOT NULL CHECK (photo_key IN ('stage', 'crowd')),
    caption TEXT NOT NULL,
    moment_id TEXT NOT NULL CHECK (moment_id IN ('encore', 'chorus', 'lights')),
    track_id TEXT NOT NULL CHECK (track_id IN ('', 'co-0')),
    is_public INTEGER NOT NULL CHECK (is_public IN (0, 1)),
    revision INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (room_id, owner_id)
  );
  CREATE TABLE IF NOT EXISTS exchanges (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id),
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    from_card_id TEXT NOT NULL REFERENCES cards(id),
    to_card_id TEXT NOT NULL REFERENCES cards(id),
    pair_key TEXT NOT NULL,
    from_card TEXT NOT NULL,
    to_card TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    cancel_reason TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    CHECK (from_user_id != to_user_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_pending_pair
    ON exchanges(room_id, pair_key) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_exchanges_room ON exchanges(room_id, created_at);
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    exchange_id TEXT NOT NULL REFERENCES exchanges(id),
    title TEXT NOT NULL,
    from_card TEXT NOT NULL,
    to_card TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (owner_id, exchange_id)
  );
  CREATE INDEX IF NOT EXISTS idx_records_room_owner ON records(room_id, owner_id);
`);

// Additive migration keeps existing rooms, cards and accepted snapshots intact.
for (const [table, additions] of [
  ['rooms', { event_date: 'TEXT', city: 'TEXT', song: 'TEXT' }],
  ['cards', { photo_id: 'TEXT REFERENCES photos(id)', perspective: 'TEXT' }],
]) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  for (const [column, definition] of Object.entries(additions)) {
    if (!columns.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export const get = (sql, ...values) => db.prepare(sql).get(...values);
export const all = (sql, ...values) => db.prepare(sql).all(...values);
export const run = (sql, ...values) => db.prepare(sql).run(...values);

// Every callback is synchronous; never await while a database transaction is open.
export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

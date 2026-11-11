// Archivio locale: SQLite integrato in Node (nessuna dipendenza esterna).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DATA_DIR = process.env.CANVAS_DATA_DIR || join(process.cwd(), 'data');
export const ICON_DIR = join(DATA_DIR, 'icons');
mkdirSync(ICON_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'canvas.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT '{"items":[],"edges":[]}',
    viewport TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Nuova chat',
    title_locked INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    keywords TEXT,
    image_prompt TEXT,
    icon_path TEXT,
    icon_status TEXT NOT NULL DEFAULT 'none',
    icon_error TEXT,
    sdk_session_id TEXT,
    fork_from_session TEXT,
    parent_chat_id TEXT,
    seed_context TEXT,
    use_neighbor_context INTEGER NOT NULL DEFAULT 1,
    msg_count INTEGER NOT NULL DEFAULT 0,
    summarized_at_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    inherited INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migrazioni leggere: colonne aggiunte nelle versioni successive
const chatCols = new Set(db.prepare('PRAGMA table_info(chats)').all().map(c => c.name));
if (!chatCols.has('icon_mode')) db.exec('ALTER TABLE chats ADD COLUMN icon_mode TEXT');   // null | 'svg' | 'image' | 'badge'
if (!chatCols.has('badge')) db.exec('ALTER TABLE chats ADD COLUMN badge TEXT');           // JSON: { kind, text, shape, color, style }

const now = () => Date.now();
export const newId = () => randomUUID();

// ---------- Impostazioni ----------
export const DEFAULT_SETTINGS = {
  iconSource: 'claude',                 // 'claude' (SVG disegnato da Claude) | 'badge' | 'image'
  imageProvider: 'pollinations',        // per iconSource 'image': 'pollinations' | 'cloudflare' | 'none'
  pollinationsKey: '',
  cloudflareAccountId: '',
  cloudflareToken: '',
  iconStyle: 'flat vector app icon, simple bold shapes, soft gradient background, centered symbol, no text',
  chatModel: '',                        // vuoto = modello predefinito di Claude Code
  utilityModel: '',                     // per riassunti e strumenti della mappa
  autoIcon: 'true',                     // genera l'icona dopo il primo scambio
  resummarizeEvery: '6',                // aggiorna il riassunto ogni N messaggi
  webTools: 'true',                     // WebSearch/WebFetch nelle chat
  language: 'italiano',
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}
export function saveSettings(patch) {
  const stmt = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    stmt.run(k, String(v ?? ''));
  }
  return getSettings();
}

// ---------- Mappe ----------
const chatIdsOf = (state) => (JSON.parse(state).items || []).filter(i => i.type === 'chat').map(i => i.chatId);

export function listBoards() {
  return db.prepare('SELECT id, name, state, created_at, updated_at FROM boards ORDER BY created_at').all()
    .map(({ state, ...b }) => ({ ...b, chat_count: new Set(chatIdsOf(state)).size }));
}
export function getBoard(id) {
  const b = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
  if (!b) return null;
  return { ...b, state: JSON.parse(b.state), viewport: b.viewport ? JSON.parse(b.viewport) : null };
}
export function createBoard(name = 'Nuova mappa') {
  const id = newId();
  db.prepare('INSERT INTO boards(id, name, created_at, updated_at) VALUES(?, ?, ?, ?)').run(id, name, now(), now());
  return getBoard(id);
}
export function updateBoard(id, { name, state, viewport }) {
  if (name !== undefined) db.prepare('UPDATE boards SET name = ?, updated_at = ? WHERE id = ?').run(name, now(), id);
  if (state !== undefined) db.prepare('UPDATE boards SET state = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), now(), id);
  if (viewport !== undefined) db.prepare('UPDATE boards SET viewport = ? WHERE id = ?').run(JSON.stringify(viewport), id);
  return getBoard(id);
}
/** Elimina la mappa e le chat che compaiono solo lì. Restituisce gli id delle chat eliminate. */
export function deleteBoard(id) {
  const board = db.prepare('SELECT state FROM boards WHERE id = ?').get(id);
  if (!board) return [];
  const mine = new Set(chatIdsOf(board.state));
  const elsewhere = new Set(db.prepare('SELECT state FROM boards WHERE id != ?').all(id).flatMap(b => chatIdsOf(b.state)));
  const removed = [...mine].filter(c => !elsewhere.has(c));
  for (const c of removed) deleteChat(c, { cleanBoards: false });
  db.prepare('DELETE FROM boards WHERE id = ?').run(id);
  return removed;
}
export function ensureDefaultBoard() {
  if (!listBoards().length) createBoard('La mia prima mappa');
}

// ---------- Chat ----------
const CHAT_FIELDS = `id, title, title_locked, summary, keywords, image_prompt, icon_path, icon_status, icon_error, icon_mode, badge,
  parent_chat_id, use_neighbor_context, msg_count, created_at, updated_at`;

export function listChats() {
  return db.prepare(`SELECT ${CHAT_FIELDS} FROM chats ORDER BY updated_at DESC`).all();
}
export function getChat(id) {
  return db.prepare('SELECT * FROM chats WHERE id = ?').get(id) || null;
}
export function getChatPublic(id) {
  return db.prepare(`SELECT ${CHAT_FIELDS} FROM chats WHERE id = ?`).get(id) || null;
}
export function createChat({ title, parentChatId, forkFromSession, seedContext } = {}) {
  const id = newId();
  db.prepare(`INSERT INTO chats(id, title, title_locked, parent_chat_id, fork_from_session, seed_context, created_at, updated_at)
              VALUES(?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, title || 'Nuova chat', title ? 1 : 0, parentChatId || null, forkFromSession || null, seedContext || null, now(), now());
  return getChatPublic(id);
}
const UPDATABLE = new Set(['title', 'title_locked', 'summary', 'keywords', 'image_prompt', 'icon_path', 'icon_status', 'icon_error', 'icon_mode', 'badge',
  'sdk_session_id', 'fork_from_session', 'use_neighbor_context', 'msg_count', 'summarized_at_count', 'seed_context']);
export function updateChat(id, patch) {
  const keys = Object.keys(patch).filter(k => UPDATABLE.has(k));
  if (!keys.length) return getChatPublic(id);
  const sql = `UPDATE chats SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;
  db.prepare(sql).run(...keys.map(k => patch[k] ?? null), now(), id);
  return getChatPublic(id);
}
/** Elimina chat e messaggi; toglie le sue icone (e le frecce collegate) da tutte le mappe. */
export function deleteChat(id, { cleanBoards = true } = {}) {
  const chat = getChat(id);
  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id);
  db.prepare('DELETE FROM chats WHERE id = ?').run(id);
  if (chat?.icon_path) {
    try { unlinkSync(join(ICON_DIR, chat.icon_path.split('/').pop())); } catch {}
  }
  if (!cleanBoards) return;
  for (const b of db.prepare('SELECT id, state FROM boards').all()) {
    const st = JSON.parse(b.state);
    const gone = new Set((st.items || []).filter(i => i.chatId === id).map(i => i.id));
    if (!gone.size) continue;
    st.items = st.items.filter(i => !gone.has(i.id));
    st.edges = (st.edges || []).filter(e => !gone.has(e.from) && !gone.has(e.to));
    db.prepare('UPDATE boards SET state = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(st), now(), b.id);
  }
}

/** All'avvio: le chat rimaste fuori da ogni mappa finiscono in una mappa "Chat recuperate", così restano visibili. */
export function adoptOrphans() {
  const ids = orphanChatIds();
  if (!ids.length) return;
  const b = createBoard('Chat recuperate');
  const cols = Math.ceil(Math.sqrt(ids.length));
  const items = ids.map((chatId, i) => ({ id: newId(), type: 'chat', chatId, w: 96, h: 96, x: (i % cols) * 180, y: Math.floor(i / cols) * 190 }));
  updateBoard(b.id, { state: { items, edges: [] } });
}

/** Chat che non compaiono in nessuna mappa (es. create con la versione precedente). */
export function orphanChatIds() {
  const used = new Set(db.prepare('SELECT state FROM boards').all().flatMap(b => chatIdsOf(b.state)));
  return db.prepare('SELECT id FROM chats').all().map(r => r.id).filter(id => !used.has(id));
}

// ---------- Messaggi ----------
export function getMessages(chatId) {
  return db.prepare('SELECT id, role, content, inherited, created_at FROM messages WHERE chat_id = ? ORDER BY id').all(chatId);
}
export function addMessage(chatId, role, content, inherited = 0) {
  db.prepare('INSERT INTO messages(chat_id, role, content, inherited, created_at) VALUES(?, ?, ?, ?, ?)')
    .run(chatId, role, content, inherited, now());
  if (!inherited) db.prepare('UPDATE chats SET msg_count = msg_count + 1, updated_at = ? WHERE id = ?').run(now(), chatId);
}
export function copyMessages(fromChatId, toChatId) {
  for (const m of getMessages(fromChatId)) addMessage(toChatId, m.role, m.content, 1);
}

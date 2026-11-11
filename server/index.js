// Server locale: API REST + streaming, file statici. Avvio: npm start  →  http://localhost:4317
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { streamChat, MOCK, listClaudeModels } from './claude.js';
import { codexStatus, CODEX_MODELS } from './codex.js';
import * as ai from './ai.js';
import { generateImage } from './images.js';

const PORT = Number(process.env.PORT || 4317);
const STARTED = Date.now();
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

db.ensureDefaultBoard();
db.adoptOrphans();

// ---------- Eventi push (SSE) verso il browser ----------
const clients = new Set();
function broadcast(type, data) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const res of clients) res.write(payload);
}
const chatUpdated = (chat) => chat && broadcast('chat', chat);

// Avviato dall'app per Mac: si spegne da solo se nessuna finestra è aperta per N minuti.
const AUTO_EXIT_MIN = Number(process.env.CANVAS_AUTO_EXIT || 0);
let lastSeen = Date.now();
if (AUTO_EXIT_MIN > 0) {
  setInterval(() => {
    if (clients.size || busy.size) { lastSeen = Date.now(); return; }
    if (Date.now() - lastSeen > AUTO_EXIT_MIN * 60_000) {
      console.log(`Nessuna finestra aperta da ${AUTO_EXIT_MIN} minuti: chiudo il server.`);
      process.exit(0);
    }
  }, 30_000).unref();
}

// ---------- Lavori in background dopo una risposta ----------
const busy = new Set();
async function afterReply(chatId) {
  if (busy.has(chatId)) return;
  busy.add(chatId);
  try {
    const s = db.getSettings();
    const chat = db.getChat(chatId);
    const every = Math.max(2, Number(s.resummarizeEvery) || 6);
    const source = s.iconSource || 'claude';
    const wantsAuto = s.autoIcon === 'true' && chat.icon_status === 'none' && !chat.icon_mode;
    if (wantsAuto && source === 'badge') {
      chatUpdated(await ai.summarizeChat(chatId, s));
      chatUpdated(db.updateChat(chatId, { icon_mode: 'badge', icon_status: 'ready' }));
    } else if (wantsAuto && (source === 'claude' || s.imageProvider !== 'none')) {
      chatUpdated(await ai.generateIcon(chatId, s, { onUpdate: chatUpdated }));
    } else if (!chat.summary || chat.msg_count - chat.summarized_at_count >= every) {
      chatUpdated(await ai.summarizeChat(chatId, s));
    }
  } catch (e) {
    console.error('[afterReply]', e.message);
  } finally { busy.delete(chatId); }
}

// ---------- Utilità HTTP ----------
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
async function serveStatic(res, base, rel) {
  const file = normalize(join(base, rel));
  if (!file.startsWith(normalize(base))) return send(res, 403, { error: 'Vietato' });
  try {
    const st = await stat(file);
    if (st.isDirectory()) return serveStatic(res, base, join(rel, 'index.html'));
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch { send(res, 404, { error: 'Non trovato' }); }
}

// ---------- Router ----------
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

route('GET', '/api/status', () => ({ mock: MOCK, started: STARTED, settings: maskSettings(db.getSettings()) }));
// Usato dall'app per Mac per riavviare il server dopo un aggiornamento (solo da questo computer)
route('POST', '/api/shutdown', () => { setTimeout(() => process.exit(0), 150); return { ok: true }; });

// Impostazioni
const SECRET = ['pollinationsKey', 'cloudflareToken'];
function maskSettings(s) {
  const out = { ...s };
  for (const k of SECRET) out[k] = s[k] ? '••••' + s[k].slice(-4) : '';
  return out;
}
route('GET', '/api/settings', () => maskSettings(db.getSettings()));
route('GET', '/api/providers', () => ({ claude: true, codex: codexStatus() }));
route('GET', '/api/models', async () => ({ claude: await listClaudeModels(), codex: CODEX_MODELS }));
route('PUT', '/api/settings', async ({ body }) => {
  for (const k of SECRET) if (typeof body[k] === 'string' && body[k].startsWith('••••')) delete body[k];
  return maskSettings(db.saveSettings(body));
});
route('POST', '/api/images/test', async () => {
  const s = db.getSettings();
  const img = await generateImage('a small paper airplane, ' + s.iconStyle, s);
  return { ok: true, bytes: img.buffer.length, dataUrl: `data:image/${img.ext === 'svg' ? 'svg+xml' : img.ext};base64,${img.buffer.toString('base64')}` };
});

// Mappe
route('GET', '/api/boards', () => db.listBoards());
route('POST', '/api/boards', ({ body }) => db.createBoard(body.name || undefined));
route('GET', '/api/boards/:id', ({ id }) => db.getBoard(id) || Promise.reject(Object.assign(new Error('Mappa non trovata'), { status: 404 })));
route('PATCH', '/api/boards/:id', ({ id, body }) => db.updateBoard(id, body));
route('DELETE', '/api/boards/:id', ({ id }) => {
  const removedChats = db.deleteBoard(id);
  for (const c of removedChats) broadcast('chat-deleted', { id: c });
  db.ensureDefaultBoard();
  return { ok: true, removedChats };
});

// Chat
route('GET', '/api/chats', () => db.listChats());
route('GET', '/api/chats/:id', ({ id }) => {
  const chat = db.getChatPublic(id);
  if (!chat) throw Object.assign(new Error('Chat non trovata'), { status: 404 });
  return { ...chat, messages: db.getMessages(id), busy: running.has(id), partial: running.get(id)?.acc || '' };
});
route('POST', '/api/chats', async ({ body }) => {
  // Nuova chat semplice, "dirama" (forkOf) o "unisci" (mergeItems + boardId)
  if (body.forkOf) {
    const parent = db.getChat(body.forkOf);
    if (!parent) throw new Error('Chat di partenza non trovata');
    let chat;
    if (parent.provider === 'codex') {
      // Codex non ha il "fork" della sessione: la nuova chat riceve la conversazione come contesto
      const tr = db.getMessages(parent.id).map(m => `${m.role === 'user' ? 'UTENTE' : 'ASSISTENTE'}: ${m.content}`).join('\n\n');
      chat = db.createChat({ parentChatId: parent.id, provider: 'codex',
        seedContext: `Questa conversazione continua da un'altra chat. Ecco quanto detto finora:\n${tr.length > 12000 ? '[...]\n' + tr.slice(-12000) : tr}` });
    } else chat = db.createChat({ parentChatId: parent.id, forkFromSession: parent.sdk_session_id });
    db.copyMessages(parent.id, chat.id);
    db.updateChat(chat.id, { title: `↳ ${parent.title}`.slice(0, 80) });
    return db.getChatPublic(chat.id);
  }
  if (body.mergeItems?.length && body.boardId) {
    const s = db.getSettings();
    const board = db.getBoard(body.boardId);
    const parts = [];
    for (const it of board.state.items.filter(i => body.mergeItems.includes(i.id))) {
      if (it.type === 'chat') {
        let c = db.getChat(it.chatId);
        if (c && !c.summary && c.msg_count) { try { c = { ...c, ...(await ai.summarizeChat(c.id, s)) }; } catch {} }
        if (c) parts.push(`- Chat "${c.title}": ${c.summary || '(vuota)'}`);
      } else if (it.text) parts.push(`- ${it.type === 'note' ? 'Nota' : 'Testo'}: ${it.text.slice(0, 500)}`);
    }
    const seed = `Questa conversazione nasce per far convergere queste idee dalla mappa:\n${parts.join('\n')}\nAiuta l'utente a integrarle, confrontarle e sintetizzarle.`;
    return db.createChat({ title: body.title || db.tr('Sintesi di idee'), seedContext: seed, provider: body.provider || db.getSettings().defaultProvider });
  }
  return db.createChat({ title: body.title, provider: body.provider || db.getSettings().defaultProvider });
});
route('PATCH', '/api/chats/:id', ({ id, body }) => {
  const patch = {};
  if (typeof body.title === 'string') { patch.title = body.title.slice(0, 80); patch.title_locked = 1; }
  if (body.use_neighbor_context !== undefined) patch.use_neighbor_context = body.use_neighbor_context ? 1 : 0;
  if (['svg', 'image', 'badge', null].includes(body.icon_mode)) patch.icon_mode = body.icon_mode;
  if (body.badge !== undefined) patch.badge = body.badge ? JSON.stringify(body.badge).slice(0, 400) : null;
  if (['claude', 'codex'].includes(body.provider)) {
    const cur = db.getChat(id);
    if (cur && cur.msg_count === 0 && !running.has(id)) patch.provider = body.provider;   // si sceglie prima del primo messaggio
  }
  const chat = db.updateChat(id, patch);
  chatUpdated(chat);
  return chat;
});
route('POST', '/api/chats/:id/stop', ({ id }) => { running.get(id)?.ctrl.abort(); return { ok: true }; });
route('GET', '/api/busy', () => [...running.keys()]);
route('DELETE', '/api/chats/:id', ({ id }) => { running.get(id)?.ctrl.abort(); db.deleteChat(id); broadcast('chat-deleted', { id }); return { ok: true }; });
route('POST', '/api/chats/:id/summarize', async ({ id }) => {
  const chat = await ai.summarizeChat(id, db.getSettings());
  chatUpdated(chat);
  return chat;
});
route('POST', '/api/chats/:id/icon', async ({ id, body }) => {
  const mode = ['svg', 'image'].includes(body.mode) ? body.mode : undefined;
  const chat = await ai.generateIcon(id, db.getSettings(), { refreshPrompt: !!body.refreshPrompt, mode, onUpdate: chatUpdated });
  chatUpdated(chat);
  if (chat.icon_status === 'error') throw new Error(chat.icon_error);
  return chat;
});

// Strumenti della mappa
route('POST', '/api/ai/suggest-links', async ({ body }) => ({ links: await ai.suggestLinks(body.boardId, db.getSettings()) }));
route('POST', '/api/ai/clusters', async ({ body }) => ({ groups: await ai.clusterThemes(body.boardId, db.getSettings(), body.itemIds) }));
route('POST', '/api/ai/synthesis', async ({ body }) => ({ markdown: await ai.synthesize(body.boardId, db.getSettings(), body.itemIds) }));

// ---------- Messaggio in streaming ----------
// Le risposte continuano anche se il pannello si chiude o si cambia chat: si fermano solo con /stop.
const running = new Map();   // chatId -> { ctrl, acc }
const setBusy = (chatId, busy) => broadcast('chat-busy', { chatId, busy });

async function handleMessage(req, res, chatId) {
  const body = await readBody(req);
  const chat = db.getChat(chatId);
  if (!chat) return send(res, 404, { error: 'Chat non trovata' });
  const text = String(body.text || '').trim();
  if (!text) return send(res, 400, { error: 'Messaggio vuoto' });
  if (running.has(chatId)) return send(res, 409, { error: 'Claude sta già rispondendo in questa chat' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  let clientGone = false;
  res.on('close', () => { clientGone = true; });
  const emit = (type, data) => { if (!clientGone) res.write(`data: ${JSON.stringify({ type, data })}\n\n`); };
  const job = { ctrl: new AbortController(), acc: '' };
  running.set(chatId, job);
  setBusy(chatId, true);

  db.addMessage(chatId, 'user', text);
  const s = db.getSettings();
  const extra = [chat.seed_context, chat.use_neighbor_context ? ai.neighborContext(chatId, body.boardId) : ''].filter(Boolean).join('\n\n');
  try {
    const out = await streamChat({
      provider: chat.provider, prompt: text, sessionId: chat.sdk_session_id, forkFromSession: chat.sdk_session_id ? null : chat.fork_from_session,
      extraSystem: extra, settings: s, signal: job.ctrl.signal,
      onDelta: (d) => { job.acc += d; emit('delta', d); broadcast('chat-delta', { chatId, d, len: job.acc.length }); },
    });
    if (job.ctrl.signal.aborted) throw new Error('Interrotto');
    const reply = out.text || job.acc;
    db.addMessage(chatId, 'assistant', reply || '(nessuna risposta)');
    if (out.sessionId) db.updateChat(chatId, { sdk_session_id: out.sessionId, fork_from_session: null });
    emit('done', db.getChatPublic(chatId));
    chatUpdated(db.getChatPublic(chatId));
    afterReply(chatId);
  } catch (e) {
    const stopped = job.ctrl.signal.aborted;
    if (job.acc) db.addMessage(chatId, 'assistant', job.acc + (db.getSettings().uiLang === 'en' ? '\n\n_(stopped)_' : '\n\n_(interrotto)_'));
    else if (!stopped) db.addMessage(chatId, 'assistant', `_(Errore: ${String(e.message || e).slice(0, 300)})_`);
    emit('error', stopped ? 'Interrotto' : String(e.message || e));
    chatUpdated(db.getChatPublic(chatId));
  } finally {
    running.delete(chatId);
    setBusy(chatId, false);
  }
  if (!clientGone) res.end();
}

// ---------- Server ----------
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);
  // Protezione: solo pagine servite da questo server possono usare l'API (niente siti esterni né DNS rebinding)
  const local = new RegExp(`^(localhost|127\\.0\\.0\\.1):${PORT}$`);
  if (!local.test(req.headers.host || '')) return send(res, 403, { error: 'Host non consentito' });
  if (path.startsWith('/api/') && req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && !local.test(origin.replace(/^http:\/\//, ''))) return send(res, 403, { error: 'Origine non consentita' });
  }
  try {
    if (path === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res); lastSeen = Date.now();
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clients.delete(res); clearInterval(ping); lastSeen = Date.now(); });
      return;
    }
    const m = path.match(/^\/api\/chats\/([^/]+)\/message$/);
    if (m && req.method === 'POST') return await handleMessage(req, res, m[1]);
    if (path.startsWith('/icons/')) return await serveStatic(res, db.ICON_DIR, path.slice('/icons/'.length));
    if (!path.startsWith('/api/')) return await serveStatic(res, PUBLIC, path === '/' ? 'index.html' : path.slice(1));

    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = path.match(r.re);
      if (!match) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, match[i + 1]]));
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      return send(res, 200, await r.handler({ ...params, body }));
    }
    send(res, 404, { error: 'Endpoint non trovato' });
  } catch (e) {
    console.error('[api]', req.method, path, e.message);
    if (!res.headersSent) send(res, e.status || 500, { error: String(e.message || e) });
    else res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Claude Canvas  →  http://localhost:${PORT}${MOCK ? '   (modalità simulata)' : ''}\n`);
});

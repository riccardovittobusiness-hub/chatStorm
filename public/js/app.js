// Avvio dell'app: lavagna, mappe ruotabili, barra laterale, pannello chat, impostazioni e strumenti AI.
import { api } from './api.js';
import { Board, iconHTML } from './board.js';
import { ChatPanel } from './chatpanel.js';
import { Overview } from './overview.js';
import { badgeOf, initials } from './badge.js';
import { t, tn, setLang, translateDOM } from './i18n.js';
import * as G from './geom.js';

const $ = (id) => document.getElementById(id);
const chats = new Map();
const busyChats = new Set();          // chat in cui il modello sta rispondendo
let boardId = null;
let boardsCache = [];
let turning = false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Avvisi ----------
let toastTimer;
function appUpdating() {
  toast(t("Aggiorno l'app desktop: tra un minuto si chiude e si riapre da sola, con il nuovo nome e la nuova icona."), { spin: true, ms: 120000 });
}
function toast(msg, { spin = false, error = false, ms = 3500 } = {}) {
  const t = $('toast');
  clearTimeout(toastTimer);
  t.hidden = false;
  t.className = error ? 'error' : '';
  t.innerHTML = (spin ? '<div class="spin"></div>' : '') + '<span></span>';
  t.querySelector('span').textContent = msg;
  if (!spin) toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  return () => { t.hidden = true; };
}
async function withSpinner(msg, fn) {
  const done = toast(msg, { spin: true });
  try { const r = await fn(); done(); return r; }
  catch (e) { done(); toast(e.message, { error: true, ms: 6000 }); return null; }
}

/** Finestra di conferma. Restituisce true se l'utente conferma. */
function confirmModal({ title, body, ok = 'Conferma' }) {
  const d = $('confirm-dialog');
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-ok').textContent = ok;
  d.returnValue = '';
  d.showModal();
  $('confirm-cancel').focus();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

// ---------- Salvataggio ----------
let saveTimer = null, savePromise = Promise.resolve(), viewTimer = null;
function scheduleSave(state) {
  clearTimeout(saveTimer);
  const id = boardId;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePromise = api.updateBoard(id, { state }).catch(e => toast(t('Salvataggio non riuscito: {msg}', { msg: e.message }), { error: true }));
  }, 350);
  renderChatList(); updateEmptyHint(); renderBoardList();
}
async function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; savePromise = api.updateBoard(boardId, { state: board.state }); }
  await savePromise;
}

// ---------- Lavagna ----------
const board = new Board({
  getChat: (id) => chats.get(id),
  isBusy: (id) => busyChats.has(id),
  onSave: scheduleSave,
  onViewChange: (v) => {
    clearTimeout(viewTimer);
    const id = boardId;
    viewTimer = setTimeout(() => id && !turning && api.updateBoard(id, { viewport: v }).catch(() => {}), 600);
  },
  onSuggestions: (n) => {
    $('suggest-bar').hidden = !n;
    $('suggest-text').textContent = tn(n, '1 collegamento suggerito dall\'AI. Passa sopra l\'etichetta per leggere il motivo.',
      '{n} collegamenti suggeriti dall\'AI. Passa sopra un\'etichetta per leggere il motivo.');
  },
  onDeleteChats: (ids) => deleteChats(ids),
  actions: {
    openChat: (id) => panel.open(id),
    createChatAt: (p) => newChat(p),
    forkChat: (item) => forkChat(item.chatId),
    editIcon: async (id) => { if (panel.chatId !== id) await panel.open(id); panel.showIconEditor(); },
    bulkIcons: (kind, ids) => bulkIcons(kind, ids),
    merge: () => mergeSelection(),
    synthesis: () => synthesis(),
  },
});

const panel = new ChatPanel({
  chats,
  toast,
  getBoardId: () => boardId,
  beforeSend: flushSave,
  onOpenChange: (id) => {
    board.openChatId = id;
    board.els.forEach(el => { el.dataset.key = ''; });
    board.render(); renderChatList();
    setTimeout(() => board.applyView(), 0);
  },
  onChatUpdated: (c) => chatUpdated(c),
  onFork: (id) => forkChat(id),
  onDelete: (id) => deleteChats([id]),
  onLayout: () => board.applyView(),
});

const overview = new Overview({
  boards: () => boardsCache.map(b => (b.id === boardId ? { ...b, chat_count: liveChatCount() } : b)),
  states: async () => {
    await flushSave();
    const entries = await Promise.all(boardsCache.map(async b =>
      [b.id, b.id === boardId ? board.state : (await api.board(b.id).catch(() => null))?.state]));
    return new Map(entries);
  },
  currentId: () => boardId,
  getChat: (id) => chats.get(id),
  onOpen: async (id) => { if (id !== boardId) await switchBoard(id, 0); overview.close(); },
  onNew: async () => { await overview.close({ flyIn: false }); newBoard(); },
});
const openOverview = () => { if (!turning) overview.open().catch(e => toast(t('Vista non disponibile: {msg}', { msg: e.message }), { error: true })); };

function chatUpdated(c) {
  chats.set(c.id, { ...chats.get(c.id), ...c });
  board.render();
  if (panel.chatId === c.id) panel.renderHeader();
  renderChatList();
}

// ---------- Chat ----------
async function newChat(at) {
  const chat = await api.createChat({});
  chats.set(chat.id, chat);
  const it = board.addChatItem(chat.id, at || board.visibleCenter());
  await panel.open(chat.id);
  setTimeout(() => board.reveal(it.id), 60);
}

async function forkChat(chatId) {
  const src = board.state.items.find(i => i.type === 'chat' && i.chatId === chatId);
  const chat = await api.createChat({ forkOf: chatId });
  chats.set(chat.id, chat);
  const at = src ? { x: src.x + src.w * 1.5 + 170, y: src.y + src.w / 2 + 40 } : board.visibleCenter();
  const it = board.addChatItem(chat.id, at, src ? { w: src.w } : {});
  if (src) board.addEdge(src.id, it.id, { label: t('dirama'), color: 'purple' });
  await panel.open(chat.id);
  setTimeout(() => board.reveal(it.id), 60);
}

async function deleteChats(ids) {
  const list = ids.map(id => chats.get(id)).filter(Boolean);
  if (!list.length) return false;
  const ok = await confirmModal({
    title: list.length === 1 ? t('Eliminare la chat "{title}"?', { title: list[0].title }) : t('Eliminare {n} chat?', { n: list.length }),
    body: t('Le icone spariscono dalla mappa e dall\'elenco, e tutti i messaggi vengono cancellati. L\'operazione non si può annullare.'),
    ok: list.length === 1 ? t('Elimina chat') : t('Elimina {n} chat', { n: list.length }),
  });
  if (!ok) return false;
  for (const c of list) {
    try { await api.deleteChat(c.id); }
    catch (e) { toast(t('"{title}" non eliminata: {msg}', { title: c.title, msg: e.message }), { error: true }); continue; }
    chats.delete(c.id);
    board.removeChatEverywhere(c.id);
    if (panel.chatId === c.id) panel.close();
  }
  renderChatList();
  toast(list.length === 1 ? t('Chat eliminata') : t('Chat eliminate'));
  return true;
}

/** Azioni sulle icone di più chat: numeri in ordine di selezione, iniziali, o nuove icone disegnate dall'AI. */
async function bulkIcons(kind, ids) {
  if (kind === 'redraw') {
    const todo = ids.filter(id => chats.get(id)?.msg_count);
    if (!todo.length) return toast(t('Le chat selezionate sono vuote: scrivi almeno un messaggio'));
    for (let i = 0; i < todo.length; i++) {
      const done = toast(t('Disegno le icone ({i} di {n})…', { i: i + 1, n: todo.length }), { spin: true });
      try { chatUpdated(await api.icon(todo[i], false, 'svg')); }
      catch (e) { toast(e.message, { error: true }); } finally { done(); }
    }
    return toast(t('Icone ridisegnate'));
  }
  await Promise.all(ids.map((id, i) => {
    const c = chats.get(id); if (!c) return null;
    const base = badgeOf(c);
    const badge = kind === 'number' ? { ...base, kind: 'number', text: String(i + 1) } : { ...base, kind: 'letters', text: initials(c.title) };
    chatUpdated({ ...c, icon_mode: 'badge', badge: JSON.stringify(badge) });
    return api.updateChat(id, { icon_mode: 'badge', badge });
  }));
}

async function mergeSelection() {
  const items = board.selectedItems().filter(i => i.type !== 'frame');
  if (items.length < 2) return toast(t('Seleziona almeno due elementi da unire'));
  await flushSave();
  const chat = await withSpinner(t('Preparo il contesto con i riassunti…'), () => api.createChat({ mergeItems: items.map(i => i.id), boardId }));
  if (!chat) return;
  chats.set(chat.id, chat);
  const u = G.unionBounds(items);
  const it = board.addChatItem(chat.id, { x: u.x + u.w + 220, y: u.y + u.h / 2 });
  board.mutate(() => items.forEach(src => board.addEdge(src.id, it.id, { label: t('confluisce in'), color: 'green' }, { record: false })));
  await panel.open(chat.id);
  setTimeout(() => board.reveal(it.id), 60);
}

async function synthesis() {
  const sel = board.selectedItems().filter(i => i.type !== 'frame');
  const items = sel.length ? sel : board.state.items.filter(i => i.type !== 'frame');
  if (!items.length) return toast(t('La mappa è vuota'));
  await flushSave();
  const r = await withSpinner(sel.length ? t('Sintetizzo la selezione…') : t('Sintetizzo la mappa…'), () => api.synthesis(boardId, sel.map(i => i.id)));
  if (r?.markdown) board.addNoteText(r.markdown, G.unionBounds(items), 'blue');
}

async function aiAction(kind) {
  if (kind === 'merge') return mergeSelection();
  if (kind === 'synthesis') return synthesis();
  await flushSave();
  if (kind === 'links') {
    const r = await withSpinner(t('Cerco collegamenti tra le idee…'), () => api.suggestLinks(boardId));
    if (!r) return;
    if (!r.links.length) return toast(t('Nessun nuovo collegamento suggerito'));
    board.addSuggestions(r.links);
    board.fit();
  }
  if (kind === 'clusters') {
    const sel = board.selectedItems().filter(i => i.type !== 'frame').map(i => i.id);
    const r = await withSpinner(t('Raggruppo le idee per temi…'), () => api.clusters(boardId, sel.length > 1 ? sel : []));
    if (r?.groups?.length) board.applyClusters(r.groups);
  }
}

// ---------- Mappe e rotazione ----------
const boardIndex = (id) => boardsCache.findIndex(b => b.id === id);
const currentBoard = () => boardsCache.find(b => b.id === boardId);

async function loadBoards() { boardsCache = await api.boards(); }

function applyBoard(b) {
  boardId = b.id;
  localStorage.setItem('cc:board', b.id);
  const items = b.state.items.filter(i => i.type !== 'chat' || chats.has(i.chatId));
  const ids = new Set(items.map(i => i.id));
  board.load({ items, edges: b.state.edges.filter(e => ids.has(e.from) && ids.has(e.to)) }, b.viewport);
  if (panel.chatId && !items.some(i => i.chatId === panel.chatId)) panel.close();
  renderBoardList(); renderChatList(); renderFaceNav(); updateEmptyHint();
}

/** Passa a un'altra mappa ruotando il piano di 90° (dir: 1 avanti, -1 indietro, 0 senza animazione). */
async function switchBoard(id, dir = 0) {
  if (turning || !id || id === boardId) return;
  turning = true;
  try {
    if (boardId) {
      await flushSave();
      const cur = currentBoard(); if (cur) cur.chat_count = liveChatCount();
    }
    const dataP = api.board(id);
    const plane = $('plane');
    if (!dir || !boardId) { applyBoard(await dataP); return; }
    plane.classList.add('turning');
    board.setSelection([]);
    const reduce = reduceMotion.matches;
    plane.style.transformOrigin = `50% 50% ${-plane.offsetWidth / 2}px`;
    const out = plane.animate(reduce
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${-90 * dir}deg)`, filter: 'brightness(.5)' }],
      { duration: reduce ? 120 : 340, easing: 'cubic-bezier(.55,0,.85,.35)', fill: 'forwards' });
    await out.finished;
    applyBoard(await dataP);
    out.cancel();
    const inn = plane.animate(reduce
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: `rotateY(${90 * dir}deg)`, filter: 'brightness(.5)' }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }],
      { duration: reduce ? 120 : 460, easing: 'cubic-bezier(.15,.75,.3,1)' });
    await inn.finished;
    plane.classList.remove('turning');
  } catch (e) {
    $('plane').classList.remove('turning');
    toast(t('Mappa non caricata: {msg}', { msg: e.message }), { error: true });
  } finally { turning = false; }
}
function rotate(step) {
  if (boardsCache.length < 2) return toast(t('C\'è una sola mappa: creane un\'altra con ＋ nel pannello a sinistra'));
  const i = boardIndex(boardId);
  const next = boardsCache[(i + step + boardsCache.length) % boardsCache.length];
  switchBoard(next.id, step);
}
function goToBoard(id) {
  const d = Math.sign(boardIndex(id) - boardIndex(boardId)) || 1;
  switchBoard(id, d);
}

function liveChatCount() { return new Set(board.state.items.filter(i => i.type === 'chat').map(i => i.chatId)).size; }

function renderBoardList() {
  const ul = $('board-list');
  if (ul.querySelector('li.renaming')) return;
  ul.innerHTML = '';
  for (const b of boardsCache) {
    const li = document.createElement('li');
    li.className = b.id === boardId ? 'active' : '';
    li.dataset.id = b.id;
    const n = b.id === boardId ? liveChatCount() : b.chat_count;
    li.innerHTML = `<span class="face"></span><span class="name"></span><span class="count">${n || ''}</span>
      <span class="acts"><button data-a="rename" title="${t('Rinomina')}">✎</button><button data-a="delete" title="${t('Elimina mappa')}">🗑</button></span>`;
    li.querySelector('.name').textContent = b.name;
    li.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'rename') return startRename(b.id);
      if (a === 'delete') return deleteBoard(b);
      if (!li.classList.contains('renaming')) goToBoard(b.id);
    };
    li.querySelector('.name').ondblclick = (e) => { e.stopPropagation(); startRename(b.id); };
    ul.appendChild(li);
  }
}

function startRename(id) {
  renderBoardList();
  const li = $('board-list').querySelector(`li[data-id="${id}"]`);
  const b = boardsCache.find(x => x.id === id);
  if (!li || !b) return;
  li.classList.add('renaming');
  const input = document.createElement('input');
  input.value = b.name;
  input.setAttribute('aria-label', t('Nome della mappa'));
  li.querySelector('.name').replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    const name = input.value.trim();
    li.classList.remove('renaming');
    if (save && name && name !== b.name) {
      b.name = name;
      try { await api.updateBoard(id, { name }); } catch (e) { toast(t('Nome non salvato: {msg}', { msg: e.message }), { error: true }); }
    }
    renderBoardList(); renderFaceNav();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
}

async function deleteBoard(b) {
  const n = b.id === boardId ? liveChatCount() : b.chat_count;
  const ok = await confirmModal({
    title: t('Eliminare la mappa "{name}"?', { name: b.name }),
    body: n ? tn(n, 'Verrà eliminata anche la chat che contiene, con tutti i messaggi. L\'operazione non si può annullare.',
      'Verranno eliminate anche le {n} chat che contiene, con tutti i messaggi. L\'operazione non si può annullare.')
      : t('La mappa e tutto ciò che contiene verranno eliminati. L\'operazione non si può annullare.'),
    ok: t('Elimina mappa'),
  });
  if (!ok) return;
  const wasCurrent = b.id === boardId;
  const idx = boardIndex(b.id);
  if (wasCurrent) { clearTimeout(saveTimer); saveTimer = null; await savePromise; }
  try {
    const r = await api.deleteBoard(b.id);
    for (const c of r.removedChats || []) { chats.delete(c); if (panel.chatId === c) panel.close(); }
  } catch (e) { return toast(t('Mappa non eliminata: {msg}', { msg: e.message }), { error: true }); }
  await loadBoards();
  if (wasCurrent) {
    const next = boardsCache[Math.min(idx, boardsCache.length - 1)];
    boardId = '__deleted__';
    await switchBoard(next.id, 1);
  } else { renderBoardList(); renderFaceNav(); }
  toast(t('Mappa eliminata'));
}

async function newBoard() {
  const b = await api.createBoard(t('Nuova mappa'));
  await loadBoards();
  await switchBoard(b.id, 1);
  startRename(b.id);
}

function renderFaceNav() {
  const b = currentBoard();
  $('face-name').textContent = b?.name || '';
  const dots = $('face-dots');
  dots.innerHTML = '';
  boardsCache.forEach((x) => {
    const d = document.createElement('button');
    d.className = x.id === boardId ? 'on' : '';
    d.title = x.name;
    d.onclick = () => goToBoard(x.id);
    dots.appendChild(d);
  });
  $('face-prev').disabled = $('face-next').disabled = boardsCache.length < 2;
}
function updateEmptyHint() { $('empty-hint').hidden = board.state.items.length > 0; }

// ---------- Chat della mappa (barra laterale) ----------
function renderChatList() {
  const q = $('chat-search').value.trim().toLowerCase();
  const itemOf = new Map();
  for (const i of board.state.items) if (i.type === 'chat' && chats.has(i.chatId)) itemOf.set(i.chatId, i.id);
  const all = [...itemOf.keys()].map(id => chats.get(id)).sort((a, b) => b.updated_at - a.updated_at);
  const list = all.filter(c => !q || `${c.title} ${c.summary || ''} ${c.keywords || ''}`.toLowerCase().includes(q));
  $('chat-count').textContent = all.length ? `(${all.length})` : '';
  const ul = $('chat-list');
  ul.innerHTML = '';
  if (!list.length) {
    ul.innerHTML = `<li class="empty">${q ? t('Nessuna chat corrisponde alla ricerca.') : t('Nessuna chat in questa mappa. Fai doppio clic sulla lavagna per crearne una.')}</li>`;
    return;
  }
  for (const c of list) {
    const li = document.createElement('li');
    li.className = panel.chatId === c.id ? 'open' : '';
    li.title = c.summary || '';
    li.innerHTML = `<div class="thumb">${iconHTML(c)}</div><div class="t"><div></div><small>${busyChats.has(c.id) ? `<span class="busy-text">${t('ChatGPT sta rispondendo…')}</span>` : tn(c.msg_count, '1 messaggio', '{n} messaggi')}</small></div>
      <button class="del" title="${t('Elimina la chat')}">🗑</button>`;
    li.querySelector('.t div').textContent = c.title;
    li.onclick = (e) => {
      if (e.target.closest('.del')) return deleteChats([c.id]);
      board.focusItem(itemOf.get(c.id));
      panel.open(c.id);
    };
    ul.appendChild(li);
  }
}

// ---------- Impostazioni ----------
const STYLE_PRESETS = {
  'Flat': 'flat vector app icon, simple bold shapes, soft blue gradient background, centered symbol, no text',
  'Isometrico 3D': 'isometric 3D icon, soft clay render, pastel blue palette, studio lighting, plain background, no text',
  'Acquerello': 'watercolor illustration, loose brush strokes in blues, paper texture, centered subject, no text',
  'Pixel art': '16-bit pixel art icon, limited blue palette, crisp pixels, plain background, no text',
  'Line art': 'minimal line art icon, cobalt blue thick strokes on light background, no text',
};
let modelsCache = null;
/** Riempie i selettori dei modelli; un valore non in elenco va in "Altro…". */
async function fillModelSelects(s) {
  modelsCache ||= await api.models().catch(() => ({ codex: [] }));
  for (const sel of document.querySelectorAll('select[data-model]')) {
    const list = modelsCache[sel.dataset.model] || [];
    const custom = sel.parentNode.querySelector('.custom-model');
    const opt = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label; return o; };
    sel.replaceChildren(opt('', t('Predefinito')),
      ...list.filter(m => m.value && m.value !== 'default').map(m => opt(m.value, m.displayName + (m.description ? ` — ${t(m.description)}` : ''))),
      opt('__custom', t('Altro…')));
    const cur = s[sel.name] || '';
    const known = cur === '' || list.some(m => m.value === cur);
    sel.value = known ? cur : '__custom';
    custom.value = known ? '' : cur;
    custom.hidden = known;
    sel.onchange = () => { custom.hidden = sel.value !== '__custom'; if (!custom.hidden) custom.focus(); };
  }
}

async function openSettings() {
  const s = await api.settings();
  const f = $('settings-form');
  await fillModelSelects(s);
  for (const el of f.elements) {
    if (!el.name || !(el.name in s) || el.dataset.model) continue;
    if (el.type === 'radio') el.checked = el.value === s[el.name];
    else if (el.type === 'checkbox') el.checked = s[el.name] === 'true';
    else el.value = s[el.name];
  }
  $('test-result').textContent = '';
  updateProviderFields();
  api.providers().then(p => {
    const el = $('codex-status'), c = p.codex;
    el.className = 'status ' + (c.installed && c.loggedIn ? 'ok' : 'warn');
    el.textContent = t(c.installing ? 'ChatGPT (Codex): installazione del supporto in corso…'
      : !c.loggedIn ? 'ChatGPT (Codex): non risulti collegato. Apri avvia.command (o esegui npx codex login nella cartella del progetto) e accedi con il tuo account ChatGPT.'
      : c.installed ? 'ChatGPT (Codex): pronto, collegato al tuo account ChatGPT.'
      : 'ChatGPT (Codex): collegato. Il supporto verrà installato al primo utilizzo (serve qualche secondo).');
  }).catch(() => {});
  $('settings-dialog').showModal();
}
function readSettingsForm() {
  const out = {};
  for (const el of $('settings-form').elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.type === 'checkbox') out[el.name] = el.checked ? 'true' : 'false';
    else if (el.dataset.model && el.value === '__custom') out[el.name] = el.parentNode.querySelector('.custom-model').value.trim();
    else out[el.name] = el.value.trim();
  }
  return out;
}
function updateProviderFields() {
  const f = $('settings-form');
  const v = f.querySelector('[name=imageProvider]:checked')?.value;
  document.querySelectorAll('[data-provider]').forEach(d => { d.hidden = d.dataset.provider !== v; });
  const src = f.querySelector('[name=iconSource]:checked')?.value;
  document.querySelectorAll('[data-source]').forEach(d => { d.hidden = d.dataset.source !== src; });
}

// ---------- Collegamenti UI ----------
function wire() {
  $('btn-new-board').onclick = newBoard;
  $('face-prev').onclick = () => rotate(-1);
  $('face-next').onclick = () => rotate(1);
  $('face-all').onclick = openOverview;
  $('btn-overview').onclick = openOverview;
  $('face-name').onclick = openOverview;
  $('face-name').title = 'Vedi tutte le mappe (M)';
  $('chat-search').addEventListener('input', renderChatList);
  $('chat-search').addEventListener('keydown', (e) => e.stopPropagation());
  $('btn-collapse').onclick = () => { $('sidebar').classList.add('collapsed'); document.body.classList.add('sidebar-hidden'); $('btn-expand').hidden = false; board.applyView(); };
  $('btn-expand').onclick = () => { $('sidebar').classList.remove('collapsed'); document.body.classList.remove('sidebar-hidden'); $('btn-expand').hidden = true; board.applyView(); };

  document.querySelectorAll('[data-tool]').forEach(b => { b.onclick = () => board.setTool(b.dataset.tool); });
  $('add-chat').onclick = () => newChat();
  $('add-note').onclick = () => board.addItem('note', board.visibleCenter());
  $('add-text').onclick = () => board.addItem('text', board.visibleCenter());
  $('add-frame').onclick = () => {
    const sel = board.selectedItems().filter(i => i.type !== 'frame');
    if (sel.length) {
      const u = G.unionBounds(sel), pad = 40;
      board.addItem('frame', { x: u.x + u.w / 2, y: u.y + u.h / 2 }, { w: u.w + pad * 2, h: u.h + pad * 2 });
    } else board.addItem('frame', board.visibleCenter());
  };
  document.querySelectorAll('[data-layout]').forEach(b => { b.onclick = () => { closeMenus(); board.layout(b.dataset.layout); }; });
  document.querySelectorAll('[data-ai]').forEach(b => { b.onclick = () => { closeMenus(); aiAction(b.dataset.ai); }; });
  $('snap-toggle').onchange = (e) => { board.snapOn = e.target.checked; localStorage.setItem('cc:snap', e.target.checked ? '1' : ''); };
  $('undo').onclick = () => board.undo();
  $('redo').onclick = () => board.redo();
  $('zoom-in').onclick = () => board.zoomAt(1.2);
  $('zoom-out').onclick = () => board.zoomAt(1 / 1.2);
  $('zoom-label').onclick = () => board.fit();
  $('wheel-mode').onclick = () => setWheelMode(board.wheelMode === 'zoom' ? 'scroll' : 'zoom');
  $('suggest-accept').onclick = () => board.acceptAll();
  $('suggest-reject').onclick = () => board.rejectAll();

  const fileName = (ext) => `${(currentBoard()?.name || 'mappa').replace(/[\\/:*?"<>|]/g, '-')}.${ext}`;
  $('export-png').onclick = async () => {
    closeMenus();
    try { download(await board.exportPNG(), fileName('png')); }
    catch (e) { toast(e.message, { error: true }); }
  };
  $('export-json').onclick = () => {
    closeMenus();
    const used = new Set(board.state.items.filter(i => i.chatId).map(i => i.chatId));
    const data = { name: currentBoard()?.name, exported_at: new Date().toISOString(), state: board.state,
      chats: [...chats.values()].filter(c => used.has(c.id)).map(({ id, title, summary, keywords }) => ({ id, title, summary, keywords })) };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName('json'));
  };

  document.querySelectorAll('.dropdown > button:not(#add-chat)').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); const d = b.parentNode; const open = d.classList.contains('open'); closeMenus(); d.classList.toggle('open', !open); };
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dropdown')) closeMenus(); });

  $('btn-settings').onclick = openSettings;
  $('btn-help').onclick = () => $('help-dialog').showModal();
  $('settings-form').addEventListener('change', (e) => { if (['imageProvider', 'iconSource'].includes(e.target.name)) updateProviderFields(); });
  $('style-presets').innerHTML = Object.keys(STYLE_PRESETS).map(k => `<button type="button" data-style="${k}">${t(k)}</button>`).join('');
  $('style-presets').onclick = (e) => { const k = e.target.dataset.style; if (k) $('settings-form').elements.iconStyle.value = STYLE_PRESETS[k]; };
  $('settings-save').onclick = async (e) => {
    e.preventDefault();
    const before = (await api.settings()).uiLang;
    const saved = await api.saveSettings(readSettingsForm());
    $('settings-dialog').close();
    if (saved.uiLang !== before) { await flushSave(); location.reload(); return; }   // nuova lingua: ricarico l'interfaccia
    toast(t('Impostazioni salvate'));
  };
  $('test-image').onclick = async () => {
    await api.saveSettings(readSettingsForm());
    $('test-result').innerHTML = '<span class="spin" style="display:inline-block;vertical-align:middle"></span> ' + t('genero…');
    try { const r = await api.testImage(); $('test-result').innerHTML = `<img src="${r.dataUrl}" alt=""> ${t('Funziona')}`; }
    catch (err) { $('test-result').textContent = t('Non riuscita: {msg}', { msg: err.message }); }
  };

  window.addEventListener('keydown', (e) => {
    if (overview.isOpen && !document.querySelector('dialog[open]')) { if (overview.onKey(e)) e.preventDefault(); return; }
    const t = e.target;
    const typing = t.closest?.('input, textarea, [contenteditable="true"]') || document.querySelector('dialog[open]');
    if (e.key === 'Escape' && document.body.classList.contains('chat-full') && !document.querySelector('dialog[open]')) { panel.toggleFull(false); return; }
    if (e.key === 'Escape' && !typing) {
      if (board.sel.size || board.selEdge) board.setSelection([]);
      else if (!panel.el.hidden) panel.close();
      return;
    }
    if (typing || turning) return;
    if (e.key === ' ' && !board.space) { board.space = true; board.canvas.classList.add('space'); e.preventDefault(); return; }
    if (board.onKey(e)) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'q') rotate(-1);
    else if (k === 'e') rotate(1);
    else if (k === 'm') openOverview();
    else if (k === 'v') board.setTool('select');
    else if (k === 'h') board.setTool('hand');
    else if (k === 'c') newChat();
    else if (k === 'n') board.addItem('note', board.visibleCenter());
    else if (k === 't') board.addItem('text', board.visibleCenter());
    else if (k === 'f') $('add-frame').click();
    else if (k === '?') $('help-dialog').showModal();
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { board.space = false; board.canvas.classList.remove('space'); } });
}
function closeMenus() { document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open')); }
function setWheelMode(m) {
  board.wheelMode = m; localStorage.setItem('cc:wheel', m);
  $('wheel-mode').textContent = t(m === 'zoom' ? 'Rotella: zoom' : 'Rotella: scorri');
  $('wheel-mode').title = t(m === 'zoom' ? 'La rotella fa zoom. Clic per farle scorrere la vista (zoom con Ctrl+rotella)' : 'La rotella scorre la vista, Ctrl+rotella o pizzico per lo zoom. Clic per cambiare');
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Avvio ----------
async function init() {
  if (/Electron/.test(navigator.userAgent)) document.body.classList.add('in-app');
  const status = await api.status();
  setLang(status.settings?.uiLang);
  translateDOM(document.body);
  wire();
  setWheelMode(localStorage.getItem('cc:wheel') || 'zoom');
  board.snapOn = !!localStorage.getItem('cc:snap'); $('snap-toggle').checked = board.snapOn;
  if (status.mock) { $('mock-banner').hidden = false; document.body.classList.add('has-banner'); }
  for (const c of await api.chats()) chats.set(c.id, c);
  await loadBoards();
  const last = localStorage.getItem('cc:board');
  await switchBoard(boardsCache.some(b => b.id === last) ? last : boardsCache[0].id, 0);
  for (const id of await api.busy().catch(() => [])) busyChats.add(id);
  board.render(); renderChatList();
  if (status.appUpdate === 'building') appUpdating();
  api.events((ev) => {
    if (ev.type === 'chat-delta') panel.onDelta(ev.data);
    if (ev.type === 'chat-busy') {
      ev.data.busy ? busyChats.add(ev.data.chatId) : busyChats.delete(ev.data.chatId);
      board.render(); renderChatList();
      panel.onBusy(ev.data);
    }
    if (ev.type === 'chat') chatUpdated(ev.data);
    if (ev.type === 'app-update') appUpdating();
    if (ev.type === 'chat-deleted') {
      chats.delete(ev.data.id);
      board.removeChatEverywhere(ev.data.id);
      if (panel.chatId === ev.data.id) panel.close();
      renderChatList();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (!saveTimer) return;
    fetch(`/api/boards/${boardId}`, { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: board.state }) });
  });
}
init().catch(e => toast(t('Avvio non riuscito: {msg}', { msg: e.message }), { error: true, ms: 10000 }));

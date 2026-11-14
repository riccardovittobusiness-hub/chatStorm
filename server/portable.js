// Mappe portatili: una mappa (o una selezione) diventa un documento JSON con dentro tutto,
// elementi, frecce e conversazioni complete. Si copia, si scarica e si incolla in qualunque mappa;
// il campo "about" lo spiega anche a un assistente AI, così il file funziona da brief di progetto.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as db from './db.js';
import { sanitizeSvg } from './svg.js';
import { saveIcon } from './images.js';

export const FORMAT = 1;
const LIMITS = { items: 2000, edges: 5000, chats: 500, messages: 2000, text: 20_000, message: 200_000 };
const TYPES = new Set(['chat', 'note', 'text', 'frame']);
const SHAPES = new Set(['curved', 'straight', 'elbow']);
const ARROWS = new Set(['end', 'start', 'both', 'none']);

const ABOUT = {
  it: `Mappa di brainstorming esportata da chatStorm (https://github.com/riccardovittobusiness-hub/chatStorm).
Per riusarla: copia tutto questo JSON e incollalo su una lavagna di chatStorm con Cmd+V, oppure importalo dal menu Esporta.
Se sei un assistente AI, leggi questo file come il brief di un progetto:
- "chats" sono le idee discusse: ognuna ha titolo, riassunto ("summary") e la conversazione completa ("messages").
- "items" sono gli elementi sulla lavagna: "chat" rimanda a una voce di "chats" con "chatId", "note" e "text" sono appunti dell'utente, "frame" è un riquadro che raggruppa un tema ("group" indica in quale riquadro sta un elemento).
- "edges" sono le frecce tra gli elementi ("from" e "to" sono id di "items"): "label" dice come le due idee si collegano.
Parti dai riassunti e dai collegamenti per capire il progetto, poi usa le conversazioni per i dettagli. Le coordinate (x, y, w, h) servono solo a ridisegnare la lavagna.`,
  en: `Brainstorming map exported from chatStorm (https://github.com/riccardovittobusiness-hub/chatStorm).
To reuse it: copy this whole JSON and paste it onto a chatStorm board with Cmd+V, or import it from the Export menu.
If you are an AI assistant, read this file as a project brief:
- "chats" are the ideas discussed: each has a title, a summary and the full conversation ("messages").
- "items" are the elements on the board: "chat" points to an entry of "chats" through "chatId", "note" and "text" are the user's own notes, "frame" is a box that groups a theme ("group" says which frame an element sits in).
- "edges" are the arrows between elements ("from" and "to" are ids of "items"): "label" says how the two ideas relate.
Start from the summaries and the links to understand the project, then use the conversations for detail. The coordinates (x, y, w, h) only serve to redraw the board.`,
};

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
const word = (v, d) => (typeof v === 'string' && /^[a-z]{1,20}$/.test(v) ? v : d);

/** Tiene solo i campi conosciuti di un elemento, con tipi e misure sensati. */
function cleanItem(it) {
  if (!it || !TYPES.has(it.type)) return null;
  const out = { id: str(it.id, 80), type: it.type, x: num(it.x), y: num(it.y), w: Math.min(4000, Math.max(24, num(it.w, 96))), h: Math.min(4000, Math.max(24, num(it.h, 96))) };
  if (!out.id) return null;
  if (it.type === 'chat') { out.chatId = str(it.chatId, 80); if (!out.chatId) return null; }
  else { out.text = str(it.text, LIMITS.text); if (it.type !== 'text') out.color = word(it.color, 'blue'); }
  return out;
}
function cleanEdge(e, ids) {
  if (!e || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to) return null;
  const out = { id: str(e.id, 80) || randomUUID(), from: e.from, to: e.to, shape: SHAPES.has(e.shape) ? e.shape : 'curved', arrow: ARROWS.has(e.arrow) ? e.arrow : 'end',
    color: word(e.color, 'gray'), dash: !!e.dash, label: str(e.label, 200) };
  if (e.reason) out.reason = str(e.reason, 500);
  if (e.status === 'suggested') out.status = 'suggested';
  return out;
}

/** Costruisce il documento portatile a partire dagli elementi che il client ha sulla lavagna. */
export function exportMap({ name, items = [], edges = [] }, lang = 'it') {
  const clean = items.slice(0, LIMITS.items).map(cleanItem).filter(Boolean);
  const ids = new Set(clean.map(i => i.id));
  const frames = clean.filter(i => i.type === 'frame');
  for (const it of clean) {                       // in quale riquadro sta: utile a chi legge, ignorato all'importazione
    if (it.type === 'frame') continue;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const f = frames.find(f => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h);
    if (f?.text) it.group = f.text;
  }
  const chats = [];
  for (const chatId of new Set(clean.filter(i => i.type === 'chat').map(i => i.chatId))) {
    const c = db.getChat(chatId);
    if (!c) continue;
    const entry = { id: c.id, title: c.title, summary: c.summary || '', keywords: c.keywords || '' };
    if (c.badge) { try { entry.badge = JSON.parse(c.badge); } catch {} }
    if (c.icon_mode === 'badge') entry.icon = 'badge';
    else if (c.icon_path?.endsWith('.svg')) {
      try { entry.icon_svg = readFileSync(join(db.ICON_DIR, c.icon_path.split('/').pop()), 'utf8'); } catch {}
    }
    entry.messages = db.getMessages(c.id).map(m => ({ role: m.role, content: m.content }));
    chats.push(entry);
  }
  const have = new Set(chats.map(c => c.id));
  const kept = clean.filter(i => i.type !== 'chat' || have.has(i.chatId));
  const keptIds = new Set(kept.map(i => i.id));
  return {
    chatstorm: FORMAT,
    about: ABOUT[lang === 'en' ? 'en' : 'it'],
    name: str(name, 120) || 'Mappa',
    exported_at: new Date().toISOString(),
    chats,
    items: kept,
    edges: edges.slice(0, LIMITS.edges).map(e => cleanEdge(e, keptIds)).filter(Boolean),
  };
}

/**
 * Importa un documento portatile: crea chat nuove (con messaggi, riassunto e icona) e restituisce
 * elementi e frecce con id nuovi, pronti da mettere su una lavagna. Il documento è trattato come dato non fidato.
 */
export function importMap(data) {
  if (!data || typeof data !== 'object' || !data.chatstorm) throw Object.assign(new Error(db.tr('Questo non è un file di chatStorm')), { status: 400 });
  if (Number(data.chatstorm) > FORMAT) throw Object.assign(new Error(db.tr('File creato con una versione più recente di chatStorm: aggiorna l\'app')), { status: 400 });
  const srcItems = (Array.isArray(data.items) ? data.items : []).slice(0, LIMITS.items).map(cleanItem).filter(Boolean);
  const srcChats = new Map((Array.isArray(data.chats) ? data.chats : []).slice(0, LIMITS.chats).filter(c => c && typeof c.id === 'string').map(c => [c.id, c]));
  if (!srcItems.length) throw Object.assign(new Error(db.tr('Il file non contiene elementi')), { status: 400 });

  const chatMap = new Map();          // id della chat nel file → chat nuova
  const created = [];
  for (const chatId of new Set(srcItems.filter(i => i.type === 'chat').map(i => i.chatId))) {
    const src = srcChats.get(chatId);
    if (!src) continue;
    const chat = db.createChat({ title: str(src.title, 120) || undefined });
    const msgs = (Array.isArray(src.messages) ? src.messages : []).slice(0, LIMITS.messages)
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content);
    for (const m of msgs) db.addMessage(chat.id, m.role, m.content.slice(0, LIMITS.message));
    const patch = { summary: str(src.summary, 4000) || null, keywords: str(typeof src.keywords === 'string' ? src.keywords : JSON.stringify(src.keywords || ''), 1000) || null,
      summarized_at_count: msgs.length };
    if (msgs.length) {
      // la conversazione col modello non si può riprendere da un altro computer: la chat riceve quanto detto come contesto
      const tr = msgs.map(m => `${m.role === 'user' ? 'UTENTE' : 'ASSISTENTE'}: ${m.content}`).join('\n\n');
      patch.seed_context = `Questa conversazione è stata importata da un'altra mappa. Ecco quanto detto finora:\n${tr.length > 12000 ? '[...]\n' + tr.slice(-12000) : tr}`;
    }
    if (src.badge && typeof src.badge === 'object') {
      const b = src.badge;
      patch.badge = JSON.stringify({ kind: word(b.kind, 'letters'), text: str(b.text, 4), shape: word(b.shape, 'squircle'),
        color: /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#3965FA', style: word(b.style, 'gradient') });
    }
    if (src.icon === 'badge') { patch.icon_mode = 'badge'; patch.icon_status = 'ready'; }
    else if (typeof src.icon_svg === 'string') {
      try {
        patch.icon_path = saveIcon(chat.id, { buffer: Buffer.from(sanitizeSvg(src.icon_svg)), ext: 'svg' }, null);
        patch.icon_mode = 'svg'; patch.icon_status = 'ready';
      } catch {}
    }
    created.push(db.updateChat(chat.id, patch));
    chatMap.set(chatId, chat.id);
  }

  const idMap = new Map();
  const items = [];
  for (const it of srcItems) {
    if (it.type === 'chat' && !chatMap.has(it.chatId)) continue;        // chat senza contenuto nel file
    const id = randomUUID().slice(0, 8) + Date.now().toString(36);
    idMap.set(it.id, id);
    items.push({ ...it, id, ...(it.type === 'chat' ? { chatId: chatMap.get(it.chatId) } : {}) });
  }
  const srcIds = new Set(idMap.keys());
  const edges = (Array.isArray(data.edges) ? data.edges : []).slice(0, LIMITS.edges).map(e => cleanEdge(e, srcIds)).filter(Boolean)
    .map(e => ({ ...e, id: randomUUID().slice(0, 8) + Date.now().toString(36), from: idMap.get(e.from), to: idMap.get(e.to) }));
  return { name: str(data.name, 120), chats: created, items, edges };
}

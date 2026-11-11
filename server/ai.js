// Funzioni "visione d'insieme": riassunto→prompt icona, collegamenti, temi, sintesi.
import * as db from './db.js';
import { oneShot, oneShotJSON } from './claude.js';
import { sanitizeSvg } from './svg.js';
import { generateImage, saveIcon } from './images.js';

const MAX_TRANSCRIPT = 14_000;

function transcript(chatId) {
  const msgs = db.getMessages(chatId);
  let out = msgs.map(m => `${m.role === 'user' ? 'UTENTE' : 'CLAUDE'}: ${m.content}`).join('\n\n');
  if (out.length > MAX_TRANSCRIPT) {
    // tieni l'inizio (il tema) e la parte più recente
    out = out.slice(0, 4000) + '\n\n[...]\n\n' + out.slice(-(MAX_TRANSCRIPT - 4000));
  }
  return out;
}

/**
 * Riassume la conversazione e ne ricava un prompt per l'immagine dell'icona.
 * Restituisce { title, summary, keywords, image_prompt }.
 */
export async function summarizeChat(chatId, settings) {
  const chat = db.getChat(chatId);
  if (!chat) throw new Error('Chat non trovata');
  const t = transcript(chatId);
  if (!t) throw new Error('La chat è vuota');
  const prompt = `TASK:SUMMARY
Analizza questa conversazione di brainstorming e restituisci un JSON con:
- "title": titolo di 2-5 parole in ${settings.language}, specifico e concreto
- "summary": riassunto di 2-3 frasi in ${settings.language}: idea centrale, conclusioni, questioni aperte
- "keywords": 3-5 parole chiave in ${settings.language}
- "image_prompt": prompt IN INGLESE per generare un'icona quadrata che rappresenti il contenuto. Descrivi UN soggetto
  visivo concreto o una metafora riconoscibile (oggetti, scena), max 25 parole. Niente testo/lettere nell'immagine,
  niente nomi di persone reali, marchi o personaggi protetti. Non includere lo stile grafico: verrà aggiunto dopo.

<transcript>
${t}
</transcript>`;
  const r = await oneShotJSON(prompt, settings);
  const patch = {
    summary: String(r.summary || '').slice(0, 1200),
    keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : String(r.keywords || ''),
    image_prompt: String(r.image_prompt || '').slice(0, 400),
    summarized_at_count: chat.msg_count,
  };
  if (!chat.title_locked && r.title) patch.title = String(r.title).slice(0, 80);
  return db.updateChat(chatId, patch);
}

export function fullImagePrompt(chat, settings) {
  return `${chat.image_prompt || chat.title}. Style: ${settings.iconStyle}`;
}

// Palette e stile del marchio Ci siamo: tratto unico spesso, come il logo disegnato a mano.
const SVG_PALETTE = 'navy #1B1B39, blu #3965FA, blu scuro #2347D6, azzurro #99B7FC, ghiaccio #E9EBFF, bianco #FFFFFF, giallo #FFD23F (solo come accento)';
const SVG_BACKGROUNDS = ['#3965FA', '#1B1B39', '#E9EBFF', '#2347D6'];

/** Claude disegna un'icona SVG che rappresenta la chat. Restituisce il codice SVG già ripulito. */
export async function drawSvgIcon(chat, settings) {
  const prompt = `TASK:SVG
Disegna l'icona di una conversazione di brainstorming, come l'icona di un'app moderna.
Titolo: ${chat.title}
Riassunto: ${chat.summary || '(non disponibile)'}
Idea visiva suggerita: ${chat.image_prompt || '(scegli tu una metafora visiva chiara)'}

Regole:
- Rispondi SOLO con un elemento <svg> completo, viewBox="0 0 100 100", nient'altro.
- Riempi tutto il quadrato con uno sfondo piatto (rettangolo 100x100) di colore ${SVG_BACKGROUNDS[[...(chat.id || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % SVG_BACKGROUNDS.length]}; NON arrotondare gli angoli (lo fa l'app).
- Al centro UN soggetto semplice e riconoscibile che rappresenti il tema (oggetto o metafora), disegnato in stile
  "monoline": tratti spessi (stroke-width 6-8), fill="none", estremità squadrate, curve morbide disegnate a mano, pochi
  tratti separati che non si toccano (come un logo disegnato con un pennarello). Puoi aggiungere uno o due piccoli
  tratti arrotondati "a onda" vicino al soggetto e al massimo un piccolo pieno (un punto o un cerchio).
- Colore dei tratti: bianco o azzurro sui fondi scuri, blu #3965FA sul fondo ghiaccio. Il giallo solo per un dettaglio.
- Leggibile anche a 32 pixel. Al massimo 10 forme.
- Niente gradienti. Niente testo, lettere o numeri,
  niente <image>, <style>, script, filtri complessi o risorse esterne.
- Palette consigliata: ${SVG_PALETTE}; puoi aggiungere un solo colore d'accento caldo se aiuta.
- Meno di 3000 caratteri.`;
  const raw = await oneShot(prompt, settings, 'Sei un illustratore di icone. Rispondi solo con codice SVG valido.');
  return sanitizeSvg(raw);
}

/**
 * Genera (o rigenera) l'icona. mode: 'svg' (Claude disegna) o 'image' (servizio di immagini).
 * Se manca il riassunto, o refreshPrompt è vero, prima riassume la chat.
 */
export async function generateIcon(chatId, settings, { refreshPrompt = false, mode, onUpdate } = {}) {
  mode = mode || (settings.iconSource === 'image' ? 'image' : 'svg');
  let chat = db.getChat(chatId);
  if (!chat.summary || !chat.image_prompt || refreshPrompt) chat = { ...chat, ...(await summarizeChat(chatId, settings)) };
  onUpdate?.(db.updateChat(chatId, { icon_status: 'generating', icon_error: null }));
  try {
    const img = mode === 'svg'
      ? { buffer: Buffer.from(await drawSvgIcon(chat, settings)), ext: 'svg' }
      : await generateImage(fullImagePrompt(chat, settings), settings);
    const path = saveIcon(chatId, img, chat.icon_path);
    return db.updateChat(chatId, { icon_path: path, icon_mode: mode, icon_status: 'ready', icon_error: null });
  } catch (e) {
    return db.updateChat(chatId, { icon_status: 'error', icon_error: String(e.message || e).slice(0, 300) });
  }
}

// ---------- Strumenti sulla mappa ----------

/** Descrive i nodi di una mappa per Claude. Riassume prima le chat che ne sono prive. */
async function describeNodes(board, settings, itemIds) {
  const items = board.state.items.filter(i => (!itemIds || itemIds.includes(i.id)) && i.type !== 'frame');
  const lines = [];
  for (const it of items) {
    if (it.type === 'chat') {
      let chat = db.getChat(it.chatId);
      if (!chat) continue;
      if (!chat.summary && chat.msg_count > 0) {
        try { chat = { ...chat, ...(await summarizeChat(chat.id, settings)) }; } catch {}
      }
      lines.push(`<node id="${it.id}" kind="chat" title="${esc(chat.title)}">${esc(chat.summary || '(chat ancora vuota)')}</node>`);
    } else if (it.text?.trim()) {
      lines.push(`<node id="${it.id}" kind="${it.type}">${esc(it.text.slice(0, 600))}</node>`);
    }
  }
  const ids = new Set(items.map(i => i.id));
  const edges = board.state.edges
    .filter(e => e.status !== 'suggested' && ids.has(e.from) && ids.has(e.to))
    .map(e => `<edge from="${e.from}" to="${e.to}" label="${esc(e.label || '')}"/>`);
  const frames = board.state.items.filter(i => i.type === 'frame').map(f => `<frame title="${esc(f.text || '')}"/>`);
  return { nodes: lines, edges, frames, count: lines.length };
}
const esc = (s) => String(s).replace(/"/g, "'").replace(/</g, '‹');

export async function suggestLinks(boardId, settings) {
  const board = db.getBoard(boardId);
  const d = await describeNodes(board, settings);
  if (d.count < 2) throw new Error('Servono almeno due elementi con contenuto');
  const prompt = `TASK:LINKS
Sei un facilitatore di brainstorming. Ecco i nodi di una mappa di idee e i collegamenti già presenti.
Proponi fino a 8 NUOVI collegamenti utili alla comprensione (non ripetere quelli esistenti).
Per ognuno indica una relazione breve in ${settings.language} (es. "approfondisce", "contraddice", "è un esempio di",
"dipende da", "risolve", "alternativa a") e una motivazione di una frase.
Rispondi con JSON: {"links":[{"from":"id","to":"id","label":"...","reason":"..."}]}

${d.nodes.join('\n')}
${d.edges.join('\n')}`;
  const r = await oneShotJSON(prompt, settings);
  const valid = new Set(board.state.items.map(i => i.id));
  return (r.links || []).filter(l => valid.has(l.from) && valid.has(l.to) && l.from !== l.to).slice(0, 8);
}

export async function clusterThemes(boardId, settings, itemIds) {
  const board = db.getBoard(boardId);
  const d = await describeNodes(board, settings, itemIds?.length ? itemIds : null);
  if (d.count < 2) throw new Error('Servono almeno due elementi con contenuto');
  const prompt = `TASK:CLUSTERS
Raggruppa questi nodi di una mappa di brainstorming in 2-6 temi coerenti. Ogni nodo va in un solo tema;
lascia fuori solo i nodi davvero isolati. Titoli dei temi in ${settings.language}, 1-4 parole.
Rispondi con JSON: {"groups":[{"title":"...","items":["id", "..."]}]}

${d.nodes.join('\n')}
${d.edges.join('\n')}`;
  const r = await oneShotJSON(prompt, settings);
  const valid = new Set(board.state.items.map(i => i.id));
  return (r.groups || []).map(g => ({ title: String(g.title || 'Tema'), items: (g.items || []).filter(id => valid.has(id)) }))
    .filter(g => g.items.length);
}

export async function synthesize(boardId, settings, itemIds) {
  const board = db.getBoard(boardId);
  const d = await describeNodes(board, settings, itemIds?.length ? itemIds : null);
  if (!d.count) throw new Error('Non ci sono contenuti da sintetizzare');
  const prompt = `TASK:SYNTHESIS
Sei un facilitatore. Leggi questa mappa di brainstorming (nodi, collegamenti, riquadri tematici) e scrivi una sintesi
in ${settings.language}, in markdown compatto (max 220 parole), con queste sezioni in grassetto:
**Idee principali**, **Collegamenti e tensioni**, **Domande aperte**, **Lacune e prossimi passi**.
Cita i nodi per titolo quando utile.
Rispondi con JSON: {"markdown":"..."}

${d.frames.join('\n')}
${d.nodes.join('\n')}
${d.edges.join('\n')}`;
  const r = await oneShotJSON(prompt, settings);
  return String(r.markdown || '').trim();
}

/** Contesto per una chat: riassunti delle chat/note collegate con frecce nella mappa corrente. */
export function neighborContext(chatId, boardId) {
  const board = boardId && db.getBoard(boardId);
  if (!board) return '';
  const mine = board.state.items.filter(i => i.type === 'chat' && i.chatId === chatId).map(i => i.id);
  if (!mine.length) return '';
  const byId = Object.fromEntries(board.state.items.map(i => [i.id, i]));
  const lines = [];
  for (const e of board.state.edges) {
    if (e.status === 'suggested') continue;
    const out = mine.includes(e.from), inc = mine.includes(e.to);
    if (!out && !inc) continue;
    const other = byId[out ? e.to : e.from];
    if (!other) continue;
    let desc;
    if (other.type === 'chat') {
      const c = db.getChat(other.chatId);
      if (!c || c.id === chatId) continue;
      desc = `chat "${c.title}": ${c.summary || '(nessun riassunto)'}`;
    } else if (other.text) desc = `${other.type === 'note' ? 'nota' : 'testo'}: ${other.text.slice(0, 400)}`;
    else continue;
    const rel = e.label ? ` [relazione: ${out ? 'questa chat' : 'l\'altro nodo'} → ${e.label}]` : '';
    lines.push(`- ${desc}${rel}`);
  }
  return lines.length ? `Nella mappa questa conversazione è collegata a:\n${lines.join('\n')}\nUsa questo contesto se pertinente.` : '';
}

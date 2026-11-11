// La lavagna: stato, disegno, interazioni (pan/zoom, selezione, trascinamento, ridimensionamento, frecce).
import { md, plain } from './md.js';
import * as G from './geom.js';
import { iconSpec, badgeHTML, drawBadge } from './badge.js';

const uid = () => crypto.randomUUID();
const $ = (id) => document.getElementById(id);

// Le chiavi restano le stesse della prima versione (compatibilità con le mappe salvate); cambiano i toni.
export const COLORS = {
  blue: '#CFE6FF', green: '#CDF2E3', purple: '#E2DBFF', yellow: '#FFEDB3', pink: '#FFDCE6', orange: '#FFE0CC', gray: '#E3EBF5',
};
export const FRAME_COLORS = {
  blue: '#1F57E0', orange: '#2E9BEA', green: '#119C9C', purple: '#6A55D0', pink: '#D2527A', gray: '#5F7393',
};
export const EDGE_COLORS = {
  gray: '#6B7FA0', blue: '#1F57E0', orange: '#2E9BEA', green: '#119C9C', purple: '#6A55D0', red: '#E0584A',
};
const DEFAULTS = {
  chat: { w: 96, h: 96 },
  note: { w: 200, h: 160, color: 'blue', text: '' },
  text: { w: 260, h: 34, text: '' },
  frame: { w: 640, h: 420, color: 'blue', text: 'Tema' },
};

export function hueOf(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
export function initials(title = '') {
  const w = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
}
export function iconHTML(chat, id) {
  const spec = iconSpec(chat || { id, title: '?' });
  return spec.type === 'img' ? `<img src="${spec.src}" alt="" draggable="false">` : badgeHTML(spec.badge);
}
const escHTML = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SVG = {
  left: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 1v14" stroke="currentColor"/><rect x="4" y="3" width="9" height="3" fill="currentColor"/><rect x="4" y="9" width="6" height="3" fill="currentColor"/></svg>',
  centerH: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1v14" stroke="currentColor"/><rect x="3" y="3" width="10" height="3" fill="currentColor" opacity=".8"/><rect x="5" y="9" width="6" height="3" fill="currentColor" opacity=".8"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M14 1v14" stroke="currentColor"/><rect x="3" y="3" width="9" height="3" fill="currentColor"/><rect x="6" y="9" width="6" height="3" fill="currentColor"/></svg>',
  top: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 2h14" stroke="currentColor"/><rect x="3" y="4" width="3" height="9" fill="currentColor"/><rect x="9" y="4" width="3" height="6" fill="currentColor"/></svg>',
  centerV: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8h14" stroke="currentColor"/><rect x="3" y="3" width="3" height="10" fill="currentColor" opacity=".8"/><rect x="9" y="5" width="3" height="6" fill="currentColor" opacity=".8"/></svg>',
  bottom: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 14h14" stroke="currentColor"/><rect x="3" y="3" width="3" height="9" fill="currentColor"/><rect x="9" y="6" width="3" height="6" fill="currentColor"/></svg>',
  distH: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="4" width="3" height="8" fill="currentColor"/><rect x="6.5" y="4" width="3" height="8" fill="currentColor"/><rect x="12" y="4" width="3" height="8" fill="currentColor"/></svg>',
  distV: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="4" y="1" width="8" height="3" fill="currentColor"/><rect x="4" y="6.5" width="8" height="3" fill="currentColor"/><rect x="4" y="12" width="8" height="3" fill="currentColor"/></svg>',
};

export class Board {
  constructor(opts) {
    this.o = opts;                // { getChat, actions:{openChat, forkChat, regenIcon, merge, synthesis, createChatAt}, onSave, onViewChange, onSelectionChange, onSuggestions }
    this.canvas = $('canvas'); this.world = $('world');
    this.layers = { frames: $('layer-frames'), items: $('layer-items'), labels: $('layer-labels') };
    this.edgeRoot = $('edge-root'); this.tempEdge = $('temp-edge');
    this.ctx = $('ctx-toolbar'); this.marquee = $('marquee');
    this.state = { items: [], edges: [] };
    this.view = { x: 0, y: 0, z: 1 };
    this.sel = new Set(); this.selEdge = null;
    this.els = new Map();
    this.history = []; this.future = [];
    this.tool = 'select'; this.snapOn = false; this.wheelMode = 'zoom';
    this.drag = null; this.editing = null; this.space = false; this.openChatId = null;
    this.bind();
  }

  // ---------- Stato ----------
  load(state, viewport) {
    this.state = { items: state?.items || [], edges: state?.edges || [] };
    this.history = []; this.future = [];
    this.sel.clear(); this.selEdge = null;
    for (const el of this.els.values()) el.remove();
    this.els.clear();
    if (viewport) this.view = viewport; else this.fit(false);
    this.applyView();
    this.render();
    this.emitSuggestions();
  }
  snapshot() { return JSON.stringify(this.state); }
  pushHistory(snap) {
    this.history.push(snap); if (this.history.length > 120) this.history.shift();
    this.future = [];
  }
  mutate(fn) {
    const snap = this.snapshot();
    const r = fn();
    this.pushHistory(snap);
    this.changed();
    return r;
  }
  changed() { this.render(); this.o.onSave(this.state); this.emitSuggestions(); }
  undo() {
    if (!this.history.length) return;
    this.future.push(this.snapshot());
    this.state = JSON.parse(this.history.pop());
    this.pruneMissingChats(); this.pruneSelection(); this.changed();
  }
  redo() {
    if (!this.future.length) return;
    this.history.push(this.snapshot());
    this.state = JSON.parse(this.future.pop());
    this.pruneMissingChats(); this.pruneSelection(); this.changed();
  }
  /** Dopo annulla/ripeti: toglie le icone di chat eliminate definitivamente. */
  pruneMissingChats() {
    const gone = new Set(this.state.items.filter(i => i.type === 'chat' && !this.o.getChat(i.chatId)).map(i => i.id));
    if (!gone.size) return;
    this.state.items = this.state.items.filter(i => !gone.has(i.id));
    this.state.edges = this.state.edges.filter(e => !gone.has(e.from) && !gone.has(e.to));
  }
  pruneSelection() {
    const ids = new Set(this.state.items.map(i => i.id));
    for (const id of [...this.sel]) if (!ids.has(id)) this.sel.delete(id);
    if (this.selEdge && !this.state.edges.some(e => e.id === this.selEdge)) this.selEdge = null;
  }
  item(id) { return this.state.items.find(i => i.id === id); }
  selectedItems() { return this.state.items.filter(i => this.sel.has(i.id)); }
  setSelection(ids, edge = null) {
    this.sel = new Set(ids); this.selEdge = edge;
    this.render(); this.o.onSelectionChange?.();
  }
  emitSuggestions() { this.o.onSuggestions?.(this.state.edges.filter(e => e.status === 'suggested').length); }

  // ---------- Vista ----------
  // dimensioni dal layout (non dal rettangolo trasformato): durante la rotazione 3D restano corrette
  rect() { const r = this.canvas.getBoundingClientRect(); return { left: r.left, top: r.top, width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }
  toWorld(cx, cy) { const r = this.rect(); return { x: (cx - r.left - this.view.x) / this.view.z, y: (cy - r.top - this.view.y) / this.view.z }; }
  toScreen(x, y) { return { x: x * this.view.z + this.view.x, y: y * this.view.z + this.view.y }; }
  visibleCenter() { const r = this.rect(); return this.toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  applyView() {
    const { x, y, z } = this.view;
    this.world.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    const g = $('grid-bg');
    const size = G.GRID * z;
    g.style.backgroundSize = `${size}px ${size}px`;
    g.style.backgroundPosition = `${x}px ${y}px`;
    g.style.opacity = z < 0.45 ? 0 : 1;
    $('zoom-label').textContent = Math.round(z * 100) + '%';
    this.positionCtx(); this.drawMinimap();
    this.o.onViewChange?.(this.view);
  }
  zoomAt(factor, cx, cy) {
    const r = this.rect();
    if (cx === undefined) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const z = Math.min(3, Math.max(0.15, this.view.z * factor));
    const wx = (cx - r.left - this.view.x) / this.view.z, wy = (cy - r.top - this.view.y) / this.view.z;
    this.view = { z, x: cx - r.left - wx * z, y: cy - r.top - wy * z };
    this.applyView();
  }
  fit(apply = true, items = this.state.items) {
    const r = this.rect();
    const u = G.unionBounds(items);
    if (!u) { this.view = { x: r.width / 2, y: r.height / 2, z: 1 }; if (apply) this.applyView(); return; }
    const pad = 90;
    const z = Math.min(1.4, Math.max(0.15, Math.min((r.width - pad * 2) / u.w, (r.height - pad * 2 - 40) / u.h)));
    this.view = { z, x: r.width / 2 - (u.x + u.w / 2) * z, y: r.height / 2 + 20 - (u.y + u.h / 2) * z };
    if (apply) this.applyView();
  }
  centerOn(x, y) {
    const r = this.rect();
    this.view = { ...this.view, x: r.width / 2 - x * this.view.z, y: r.height / 2 - y * this.view.z };
    this.applyView();
  }
  focusItem(id) {
    const it = this.item(id); if (!it) return;
    const c = G.center(G.bounds(it));
    this.centerOn(c.x, c.y); this.setSelection([id]);
  }

  // ---------- Disegno ----------
  render() {
    const seen = new Set();
    this.state.items.forEach((it, idx) => {
      seen.add(it.id);
      let el = this.els.get(it.id);
      const layer = it.type === 'frame' ? this.layers.frames : this.layers.items;
      if (!el) { el = document.createElement('div'); el.dataset.id = it.id; this.els.set(it.id, el); }
      if (el.parentNode !== layer) layer.appendChild(el);
      const b = G.bounds(it);
      el.className = `item ${it.type}` + (this.sel.has(it.id) ? ' selected' : '') + (this.sel.size === 1 && this.sel.has(it.id) ? ' single' : '')
        + (it.type === 'chat' && it.chatId === this.openChatId ? ' open' : '')
        + (it.type === 'chat' && this.o.isBusy?.(it.chatId) ? ' busy' : '');
      Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: b.w + 'px', height: it.type === 'text' ? 'auto' : b.h + 'px', zIndex: idx });
      if (this.editing?.id === it.id) return;
      const chat = it.type === 'chat' ? this.o.getChat(it.chatId) : null;
      const key = JSON.stringify([it.type, it.text, it.color, chat?.title, chat?.icon_path, chat?.icon_status, chat?.msg_count, chat?.icon_mode, chat?.badge]);
      if (el.dataset.key === key) return;
      el.dataset.key = key;
      el.innerHTML = this.itemHTML(it, chat);
      if (it.type === 'note') el.style.background = COLORS[it.color] || COLORS.yellow;
      if (it.type === 'frame') {
        const c = FRAME_COLORS[it.color] || FRAME_COLORS.blue;
        el.style.borderColor = c; el.style.background = c + '12';
      }
    });
    for (const [id, el] of this.els) if (!seen.has(id)) { el.remove(); this.els.delete(id); }
    // misura l'altezza dei testi
    for (const it of this.state.items) if (it.type === 'text') { const el = this.els.get(it.id); if (el) it.h = Math.max(30, el.offsetHeight); }
    this.renderEdges();
    this.positionCtx();
    this.drawMinimap();
  }

  itemHTML(it, chat) {
    const handles = ['top', 'right', 'bottom', 'left'].map(s => {
      const pos = { top: 'left:50%;top:0', right: 'left:100%;top:50%', bottom: 'left:50%;top:100%', left: 'left:0;top:50%' }[s];
      return `<div class="handle" data-side="${s}" style="${pos}"></div>`;
    }).join('');
    const resize = '<div class="resize"></div>';
    if (it.type === 'chat') {
      const spinner = chat?.icon_status === 'generating' ? '<div class="spinner"><div class="spin"></div></div>' : '';
      const badge = chat?.msg_count ? `<div class="badge">${chat.msg_count}</div>` : '';
      return `<div class="icon">${chat ? iconHTML(chat, it.chatId) : '<div class="initials" style="background:#999">?</div>'}${spinner}</div>${badge}
        <div class="label">${escHTML(chat?.title || 'Chat eliminata')}</div>${handles}${resize}`;
    }
    if (it.type === 'note' || it.type === 'text') {
      const empty = !it.text?.trim() ? `<span style="opacity:.45">${it.type === 'note' ? 'Doppio clic per scrivere' : 'Testo'}</span>` : md(it.text);
      return `<div class="body md">${empty}</div>${handles}${resize}`;
    }
    if (it.type === 'frame') {
      return `<div class="frame-title" style="background:${FRAME_COLORS[it.color] || FRAME_COLORS.blue}">${escHTML(it.text || 'Riquadro')}</div>${resize}`;
    }
    return '';
  }

  renderEdges() {
    const byId = Object.fromEntries(this.state.items.map(i => [i.id, i]));
    let svg = '';
    const labels = [];
    for (const e of this.state.edges) {
      const a = byId[e.from], b = byId[e.to];
      if (!a || !b) continue;
      const g = G.edgeGeometry(G.bounds(a), G.bounds(b), e.shape);
      const color = e.status === 'suggested' ? '#E0A100' : (EDGE_COLORS[e.color] || EDGE_COLORS.gray);
      const dash = e.dash ? 'stroke-dasharray="7 6"' : '';
      const arrow = e.arrow || 'end';
      const heads = (arrow === 'end' || arrow === 'both' ? `<path class="edge-head" d="${G.arrowHead(g.end)}" fill="${color}"/>` : '')
        + (arrow === 'both' ? `<path class="edge-head" d="${G.arrowHead(g.start)}" fill="${color}"/>` : '');
      const cls = `edge${this.selEdge === e.id ? ' selected' : ''}${e.status === 'suggested' ? ' suggested' : ''}`;
      svg += `<g class="${cls}" data-edge="${e.id}"><path class="edge-hit" d="${g.d}"/><path class="edge-line" d="${g.d}" stroke="${color}" ${dash}/>${heads}</g>`;
      if (e.label || e.status === 'suggested') labels.push({ e, mid: g.mid });
    }
    this.edgeRoot.innerHTML = svg;
    if (this.editing?.edge) return;
    this.layers.labels.innerHTML = labels.map(({ e, mid }) => {
      const sug = e.status === 'suggested';
      const btns = sug ? `<button data-accept="${e.id}" title="Accetta">✓</button><button data-reject="${e.id}" title="Scarta">✕</button>` : '';
      return `<div class="edge-label${this.selEdge === e.id ? ' selected' : ''}${sug ? ' suggested' : ''}" data-edge="${e.id}"
        style="left:${mid.x}px;top:${mid.y}px" title="${escHTML(e.reason || '')}">${escHTML(e.label || '')}${btns}</div>`;
    }).join('');
  }

  // ---------- Barra contestuale ----------
  positionCtx() {
    const ctx = this.ctx;
    if (this.drag || this.editing || (!this.sel.size && !this.selEdge)) { ctx.hidden = true; return; }
    let pt;
    if (this.selEdge) {
      const e = this.state.edges.find(x => x.id === this.selEdge);
      const a = e && this.item(e.from), b = e && this.item(e.to);
      if (!a || !b) { ctx.hidden = true; return; }
      const g = G.edgeGeometry(G.bounds(a), G.bounds(b), e.shape);
      pt = this.toScreen(g.mid.x, g.mid.y - 14);
    } else {
      const u = G.unionBounds(this.selectedItems());
      if (!u) { ctx.hidden = true; return; }
      const extra = this.selectedItems().some(i => i.type === 'frame') ? 34 : 0;
      pt = this.toScreen(u.x + u.w / 2, u.y - extra);
      pt.y -= 12;
    }
    const r = this.rect();
    ctx.hidden = false;
    if (ctx.dataset.sig !== this.ctxSignature()) this.buildCtx();
    const w = ctx.offsetWidth;
    ctx.style.left = Math.min(Math.max(pt.x, w / 2 + 8), r.width - w / 2 - 8) + 'px';
    ctx.style.top = Math.max(pt.y, ctx.offsetHeight + 60) + 'px';
  }
  ctxSignature() {
    const e = this.selEdge && this.state.edges.find(x => x.id === this.selEdge);
    if (e) return 'edge:' + JSON.stringify(e);
    return 'items:' + this.selectedItems().map(i => `${i.id}:${i.type}:${i.color}:${i.w}`).join(',');
  }
  buildCtx() {
    const ctx = this.ctx;
    ctx.dataset.sig = this.ctxSignature();
    const B = (act, label, title, extra = '') => `<button data-act="${act}" title="${title}" ${extra}>${label}</button>`;
    const sep = '<div class="sep"></div>';
    let h = '';
    if (this.selEdge) {
      const e = this.state.edges.find(x => x.id === this.selEdge);
      if (e.status === 'suggested') h += B('accept', '✓ Accetta', 'Accetta il collegamento') + B('reject', '✕ Scarta', 'Scarta') + sep;
      h += `<input data-act="label" value="${escHTML(e.label || '')}" placeholder="Etichetta (es. approfondisce)">`;
      h += sep + B('shape:curved', '⌒', 'Curva', e.shape === 'curved' || !e.shape ? 'class="on"' : '')
        + B('shape:straight', '╱', 'Dritta') + B('shape:elbow', '┐', 'A gomito');
      h += sep + B('dash', e.dash ? '┄' : '─', 'Tratteggiata / continua');
      h += B('arrow:end', '→', 'Punta finale') + B('arrow:both', '↔', 'Due punte') + B('arrow:none', '—', 'Nessuna punta') + B('reverse', '⇄', 'Inverti direzione');
      h += sep + Object.entries(EDGE_COLORS).map(([k, c]) => `<button class="swatch" data-act="ecolor:${k}" style="background:${c}" title="${k}"></button>`).join('');
      h += sep + B('delete', '🗑', 'Elimina (Canc)');
    } else {
      const items = this.selectedItems();
      const chats = items.filter(i => i.type === 'chat');
      const types = new Set(items.map(i => i.type));
      if (items.length === 1 && chats.length === 1) {
        h += B('open', '💬 Apri', 'Apri la chat (doppio clic)') + B('fork', '⑂ Dirama', 'Nuova chat che parte da questa') + B('icon', '🎨 Icona', 'Modifica l\'icona') + sep;
      }
      if (chats.length) {
        h += B('size:-', '−', 'Riduci icona ([)') + `<span class="size">${chats[0].w}px</span>` + B('size:+', '＋', 'Ingrandisci icona (])');
        if (chats.length > 1) {
          h += B('size:eq', '=', 'Uguaglia le dimensioni (=)') + sep;
          h += B('icons:number', '#', 'Icone numerate in ordine di selezione') + B('icons:letters', 'Aa', 'Icone con le iniziali del titolo')
            + B('icons:redraw', '✦', 'Fai ridisegnare le icone a Claude');
        }
        h += sep;
      }
      if (types.size === 1 && (types.has('note') || types.has('frame'))) {
        const pal = types.has('note') ? COLORS : FRAME_COLORS;
        h += Object.entries(pal).map(([k, c]) => `<button class="swatch" data-act="color:${k}" style="background:${c}" title="${k}"></button>`).join('') + sep;
      }
      if (items.length > 1) {
        h += ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'].map(a => B('align:' + a, SVG[a], {
          left: 'Allinea a sinistra (Alt+A)', centerH: 'Centra in orizzontale (Alt+H)', right: 'Allinea a destra (Alt+D)',
          top: 'Allinea in alto (Alt+W)', centerV: 'Centra in verticale (Alt+V)', bottom: 'Allinea in basso (Alt+S)' }[a])).join('');
        if (items.length > 2) h += B('dist:h', SVG.distH, 'Distribuisci in orizzontale (Alt+Shift+H)') + B('dist:v', SVG.distV, 'Distribuisci in verticale (Alt+Shift+V)');
        h += sep + B('link', '↗ Collega', 'Collega in ordine di selezione (L)');
        h += B('merge', '✦ Unisci', 'Unisci in una nuova chat') + B('synth', '✦ Sintesi', 'Sintesi della selezione') + sep;
      }
      if (items.length === 1 && types.has('frame')) h += B('frame-select', 'Seleziona contenuto', 'Seleziona gli elementi nel riquadro') + sep;
      h += chats.length ? B('delete', '🗑', chats.length > 1 ? 'Elimina le chat selezionate (Canc)' : 'Elimina la chat (Canc)') : B('delete', '🗑', 'Elimina (Canc)');
    }
    ctx.innerHTML = h;
  }
  onCtx(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const [act, arg] = btn.dataset.act.split(':');
    const items = this.selectedItems();
    const edge = this.state.edges.find(x => x.id === this.selEdge);
    const A = this.o.actions;
    switch (act) {
      case 'open': return A.openChat(items[0].chatId);
      case 'fork': return A.forkChat(items[0]);
      case 'icon': return A.editIcon(items[0].chatId);
      case 'icons': return A.bulkIcons(arg, [...this.sel].map(id => this.item(id)).filter(i => i?.type === 'chat').map(i => i.chatId));
      case 'size': return this.resizeChats(arg);
      case 'color': return this.mutate(() => items.forEach(i => { i.color = arg; }));
      case 'align': return this.alignSel(arg);
      case 'dist': return this.distributeSel(arg);
      case 'link': return this.linkSelection();
      case 'merge': return A.merge();
      case 'synth': return A.synthesis();
      case 'frame-select': return this.selectFrameContents(items[0]);
      case 'delete': return this.deleteSelection();
      case 'accept': return this.acceptEdge(edge.id);
      case 'reject': return this.rejectEdge(edge.id);
      case 'shape': return this.mutate(() => { edge.shape = arg; });
      case 'dash': return this.mutate(() => { edge.dash = !edge.dash; });
      case 'arrow': return this.mutate(() => { edge.arrow = arg; });
      case 'reverse': return this.mutate(() => { [edge.from, edge.to] = [edge.to, edge.from]; });
      case 'ecolor': return this.mutate(() => { edge.color = arg; });
    }
  }

  // ---------- Operazioni ----------
  addItem(type, at, extra = {}) {
    const d = { ...DEFAULTS[type], ...extra };
    const it = { id: uid(), type, ...d, x: 0, y: 0 };
    const b = G.bounds(it);
    it.x = Math.round(at.x - b.w / 2); it.y = Math.round(at.y - b.h / 2);
    if (type !== 'frame') this.freeSpot(it);
    if (this.snapOn) { it.x = G.snap(it.x); it.y = G.snap(it.y); }
    this.mutate(() => { type === 'frame' ? this.state.items.unshift(it) : this.state.items.push(it); });
    this.setSelection([it.id]);
    return it;
  }
  /** Sposta `it` nel punto libero più vicino, per non sovrapporlo ad altri elementi. */
  freeSpot(it) {
    const others = this.state.items.filter(o => o.type !== 'frame' && o.id !== it.id).map(G.bounds);
    const m = 24, b = G.bounds(it);
    const hits = (x, y) => others.some(o => x < o.x + o.w + m && x + b.w + m > o.x && y < o.y + o.h + m && y + b.h + m > o.y);
    const step = 40, dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let r = 0; r < 40; r++) {
      for (const [dx, dy] of r ? dirs : [[0, 0]]) {
        const x = it.x + dx * r * step, y = it.y + dy * r * step;
        if (!hits(x, y)) { it.x = x; it.y = y; return; }
      }
    }
  }
  addChatItem(chatId, at, extra) {
    const existing = this.state.items.find(i => i.type === 'chat' && i.chatId === chatId);
    if (existing) { this.focusItem(existing.id); return existing; }
    return this.addItem('chat', at, { chatId, ...extra });
  }
  addEdge(from, to, props = {}, { record = true } = {}) {
    if (from === to) return null;
    const dup = this.state.edges.find(e => e.from === from && e.to === to);
    if (dup) return dup;
    const e = { id: uid(), from, to, shape: 'curved', arrow: 'end', color: 'gray', dash: false, label: '', ...props };
    if (record) this.mutate(() => this.state.edges.push(e)); else this.state.edges.push(e);
    return e;
  }
  deleteSelection() {
    if (this.selEdge) {
      const id = this.selEdge;
      this.mutate(() => { this.state.edges = this.state.edges.filter(e => e.id !== id); });
      this.setSelection([]); return;
    }
    if (!this.sel.size) return;
    const chatIds = this.selectedItems().filter(i => i.type === 'chat').map(i => i.chatId);
    if (chatIds.length) {
      // le chat appartengono alla mappa: toglierle significa eliminarle (con conferma)
      const others = this.selectedItems().filter(i => i.type !== 'chat').map(i => i.id);
      this.o.onDeleteChats(chatIds).then(ok => { if (ok && others.length) { this.sel = new Set(others); this.deleteSelection(); } });
      return;
    }
    const ids = new Set(this.sel);
    this.mutate(() => {
      this.state.items = this.state.items.filter(i => !ids.has(i.id));
      this.state.edges = this.state.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    });
    this.setSelection([]);
  }
  /** Toglie dalla mappa le icone di una chat eliminata (non annullabile: i messaggi non esistono più). */
  removeChatEverywhere(chatId) {
    const ids = new Set(this.state.items.filter(i => i.chatId === chatId).map(i => i.id));
    if (!ids.size) return;
    this.state.items = this.state.items.filter(i => !ids.has(i.id));
    this.state.edges = this.state.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    this.pruneSelection();
    this.changed();
  }
  duplicateSelection() {
    const items = this.selectedItems().filter(i => i.type === 'note' || i.type === 'text');
    if (!items.length) return;
    const copies = items.map(i => ({ ...i, id: uid(), x: i.x + 30, y: i.y + 30 }));
    this.mutate(() => this.state.items.push(...copies));
    this.setSelection(copies.map(c => c.id));
  }
  resizeChats(mode) {
    const chats = this.selectedItems().filter(i => i.type === 'chat');
    if (!chats.length) return;
    this.mutate(() => {
      const target = Math.max(...chats.map(c => c.w));
      for (const c of chats) {
        const cx = c.x + c.w / 2, cy = c.y + c.w / 2;
        if (mode === '+') c.w = Math.min(360, c.w + 16);
        else if (mode === '-') c.w = Math.max(48, c.w - 16);
        else c.w = target;
        c.x = Math.round(cx - c.w / 2); c.y = Math.round(cy - c.w / 2);
      }
    });
  }
  alignSel(how) { const items = this.selectedItems(); if (items.length > 1) this.mutate(() => G.align(items, how)); }
  distributeSel(axis) { const items = this.selectedItems(); if (items.length > 2) this.mutate(() => G.distribute(items, axis)); }
  layoutTargets() {
    const sel = this.selectedItems().filter(i => i.type !== 'frame');
    return sel.length > 1 ? sel : this.state.items.filter(i => i.type !== 'frame');
  }
  layout(kind) {
    const items = this.layoutTargets();
    if (items.length < 2) return;
    this.mutate(() => {
      if (kind === 'grid') G.gridLayout(items);
      if (kind === 'tree') G.treeLayout(items, this.state.edges);
      if (kind === 'force') G.forceLayout(items, this.state.edges);
      if (this.snapOn) items.forEach(i => { i.x = G.snap(i.x); i.y = G.snap(i.y); });
    });
    if (items.length === this.state.items.filter(i => i.type !== 'frame').length) this.fit();
  }
  linkSelection() {
    const items = [...this.sel].map(id => this.item(id)).filter(i => i && i.type !== 'frame');
    if (items.length < 2) return;
    this.mutate(() => { for (let i = 0; i + 1 < items.length; i++) this.addEdge(items[i].id, items[i + 1].id, {}, { record: false }); });
  }
  selectFrameContents(frame) {
    const fb = G.bounds(frame);
    this.setSelection(this.state.items.filter(i => i.id !== frame.id && G.contains(fb, G.bounds(i))).map(i => i.id));
  }
  acceptEdge(id) { this.mutate(() => { const e = this.state.edges.find(x => x.id === id); if (e) { delete e.status; e.color = 'blue'; } }); }
  rejectEdge(id) { this.mutate(() => { this.state.edges = this.state.edges.filter(e => e.id !== id); }); if (this.selEdge === id) this.setSelection([]); }
  acceptAll() { this.mutate(() => this.state.edges.forEach(e => { if (e.status === 'suggested') { delete e.status; e.color = 'blue'; } })); }
  rejectAll() { this.mutate(() => { this.state.edges = this.state.edges.filter(e => e.status !== 'suggested'); }); this.pruneSelection(); this.render(); }

  addSuggestions(links) {
    this.mutate(() => {
      for (const l of links) {
        if (this.state.edges.some(e => (e.from === l.from && e.to === l.to) || (e.from === l.to && e.to === l.from))) continue;
        this.addEdge(l.from, l.to, { label: l.label, reason: l.reason, status: 'suggested' }, { record: false });
      }
    });
  }

  applyClusters(groups) {
    const palette = Object.keys(FRAME_COLORS);
    const all = groups.flatMap(g => g.items).map(id => this.item(id)).filter(Boolean);
    if (!all.length) return;
    const start = G.unionBounds(all);
    this.mutate(() => {
      let x = start.x, y = start.y, rowH = 0;
      const frames = [];
      groups.forEach((g, gi) => {
        const items = g.items.map(id => this.item(id)).filter(i => i && i.type !== 'frame');
        if (!items.length) return;
        const pad = 40;
        const info = G.gridLayout(items, { gap: 40, origin: { x: x + pad, y: y + pad } });
        const u = G.unionBounds(items);
        const fw = Math.max(u.w + pad * 2, 260), fh = u.h + pad * 2;
        frames.push({ id: uid(), type: 'frame', x, y, w: fw, h: fh, text: g.title, color: palette[gi % palette.length] });
        rowH = Math.max(rowH, fh);
        x += fw + 80;
        if (x - start.x > 2600) { x = start.x; y += rowH + 100; rowH = 0; }
        void info;
      });
      this.state.items.unshift(...frames);
    });
    this.fit();
  }

  addNoteText(text, near, color = 'blue') {
    const lines = text.split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 46)), 0);
    const h = Math.min(900, Math.max(180, 40 + lines * 21));
    const at = near ? { x: near.x + near.w + 240, y: near.y + h / 2 } : this.visibleCenter();
    const it = this.addItem('note', at, { w: 400, h, text, color });
    this.reveal(it.id);
    return it;
  }
  /** Porta in vista un elemento se è fuori dallo schermo. */
  reveal(id) {
    const it = this.item(id); if (!it) return;
    const b = G.bounds(it), r = this.rect();
    const p1 = this.toScreen(b.x, b.y), p2 = this.toScreen(b.x + b.w, b.y + b.h);
    if (p1.x < 20 || p1.y < 70 || p2.x > r.width - 20 || p2.y > r.height - 20) {
      const c = G.center(b); this.centerOn(c.x, c.y);
    }
  }

  // ---------- Modifica testi ----------
  startEdit(it, el) {
    this.finishEdit();
    const target = it.type === 'frame' ? el.querySelector('.frame-title') : el.querySelector('.body');
    if (!target) return;
    this.editing = { id: it.id, el: target, before: this.snapshot() };
    target.classList.remove('md');
    target.textContent = it.text || '';
    target.contentEditable = 'true';
    target.focus();
    const range = document.createRange(); range.selectNodeContents(target);
    const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    this.ctx.hidden = true;
    target.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (it.type === 'frame' || e.metaKey || e.ctrlKey))) { e.preventDefault(); this.finishEdit(); }
      e.stopPropagation();
    });
    target.addEventListener('blur', () => this.finishEdit(), { once: true });
  }
  finishEdit() {
    const ed = this.editing;
    if (!ed || ed.edge) return;
    this.editing = null;
    const it = this.item(ed.id);
    const text = ed.el.innerText.replace(/\n$/, '');
    ed.el.contentEditable = 'false';
    const el = this.els.get(ed.id); if (el) el.dataset.key = '';
    if (it && text !== (it.text || '')) { it.text = text; this.pushHistory(ed.before); this.changed(); }
    else this.render();
  }
  editEdgeLabel(edgeId) {
    const e = this.state.edges.find(x => x.id === edgeId); if (!e) return;
    this.setSelection([], edgeId);
    const input = this.ctx.querySelector('input[data-act="label"]');
    input?.focus(); input?.select();
  }

  // ---------- Eventi ----------
  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('dblclick', (e) => this.onDbl(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ctx.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.ctx.addEventListener('click', (e) => this.onCtx(e));
    this.ctx.addEventListener('change', (e) => {
      if (e.target.dataset.act !== 'label') return;
      const edge = this.state.edges.find(x => x.id === this.selEdge);
      if (edge && edge.label !== e.target.value) this.mutate(() => { edge.label = e.target.value.trim(); });
    });
    this.ctx.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
    this.layers.labels.addEventListener('pointerdown', (e) => {
      const acc = e.target.closest('[data-accept]'), rej = e.target.closest('[data-reject]');
      if (acc) { e.stopPropagation(); this.acceptEdge(acc.dataset.accept); }
      else if (rej) { e.stopPropagation(); this.rejectEdge(rej.dataset.reject); }
    });
    // drop di chat dal cassetto
    c.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/chat-id')) e.preventDefault(); });
    c.addEventListener('drop', (e) => {
      const id = e.dataTransfer.getData('text/chat-id');
      if (!id) return;
      e.preventDefault();
      this.addChatItem(id, this.toWorld(e.clientX, e.clientY));
    });
    window.addEventListener('resize', () => this.applyView());
    // minimappa
    const mm = $('minimap');
    const mmGo = (e) => {
      if (!this.mm) return;
      const r = mm.getBoundingClientRect();
      const x = (e.clientX - r.left - this.mm.ox) / this.mm.s, y = (e.clientY - r.top - this.mm.oy) / this.mm.s;
      this.centerOn(x, y);
    };
    mm.addEventListener('pointerdown', (e) => { mmGo(e); mm.setPointerCapture(e.pointerId); this.mmDrag = true; });
    mm.addEventListener('pointermove', (e) => { if (this.mmDrag) mmGo(e); });
    mm.addEventListener('pointerup', () => { this.mmDrag = false; });
  }

  onDown(e) {
    if (e.target.closest('#ctx-toolbar')) return;
    if (this.editing && !this.editing.el.contains(e.target)) this.finishEdit();
    if (this.editing) return;
    this.canvas.focus({ preventScroll: true });
    const p = this.toWorld(e.clientX, e.clientY);
    const start = { cx: e.clientX, cy: e.clientY, p };

    if (e.button === 1 || e.button === 2 || this.tool === 'hand' || this.space) {
      this.drag = { kind: 'pan', ...start, vx: this.view.x, vy: this.view.y };
      this.canvas.classList.add('panning');
      return;
    }
    const handle = e.target.closest('.handle');
    const itemEl = e.target.closest('.item');
    if (handle && itemEl) {
      this.drag = { kind: 'connect', from: itemEl.dataset.id, ...start };
      this.canvas.classList.add('connecting');
      return;
    }
    if (e.target.closest('.resize') && itemEl) {
      const it = this.item(itemEl.dataset.id);
      this.drag = { kind: 'resize', it, w: it.w, h: it.h, x: it.x, y: it.y, snap: this.snapshot(), ...start };
      return;
    }
    const lbl = e.target.closest('.edge-label');
    const hit = e.target.closest('.edge-hit');
    if (lbl || hit) {
      const id = (lbl || hit.parentNode).dataset.edge;
      this.setSelection([], id);
      return;
    }
    if (itemEl && (!itemEl.classList.contains('frame') || e.target.closest('.frame-title'))) {
      const id = itemEl.dataset.id;
      const wasSelected = this.sel.has(id);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        const s = new Set(this.sel); wasSelected ? s.delete(id) : s.add(id);
        this.setSelection([...s]);
        if (wasSelected) return;
      } else if (!wasSelected) this.setSelection([id]);
      // elementi trascinati: selezione + contenuto dei riquadri selezionati
      const moving = new Map();
      for (const it of this.selectedItems()) {
        moving.set(it.id, it);
        if (it.type === 'frame') {
          const fb = G.bounds(it);
          for (const o of this.state.items) if (o.id !== it.id && G.contains(fb, G.bounds(o))) moving.set(o.id, o);
        }
      }
      this.drag = { kind: 'move', items: [...moving.values()].map(it => ({ it, x: it.x, y: it.y })), lead: this.item(id),
        snap: this.snapshot(), moved: false, clickedSelected: wasSelected && !e.shiftKey, id, ...start };
      return;
    }
    // sfondo: selezione a rettangolo
    if (!e.shiftKey) this.setSelection([]);
    this.drag = { kind: 'marquee', base: e.shiftKey ? new Set(this.sel) : new Set(), ...start };
  }

  onMove(e) {
    const d = this.drag; if (!d) return;
    const dxs = e.clientX - d.cx, dys = e.clientY - d.cy;
    const dx = dxs / this.view.z, dy = dys / this.view.z;
    if (d.kind === 'pan') { this.view.x = d.vx + dxs; this.view.y = d.vy + dys; this.applyView(); return; }
    if (d.kind === 'move') {
      if (!d.moved && Math.hypot(dxs, dys) < 3) return;
      if (!d.moved) { d.moved = true; this.canvas.classList.add('dragging'); this.ctx.hidden = true; }
      let ox = dx, oy = dy;
      if (this.snapOn) {
        const lead = d.items.find(m => m.it === d.lead) || d.items[0];
        ox = G.snap(lead.x + dx) - lead.x; oy = G.snap(lead.y + dy) - lead.y;
      }
      for (const m of d.items) { m.it.x = Math.round(m.x + ox); m.it.y = Math.round(m.y + oy); }
      this.render();
      return;
    }
    if (d.kind === 'resize') {
      const it = d.it;
      if (it.type === 'chat') it.w = Math.round(Math.min(360, Math.max(48, d.w + Math.max(dx, dy))));
      else if (it.type === 'text') it.w = Math.max(80, Math.round(d.w + dx));
      else { it.w = Math.max(it.type === 'frame' ? 160 : 100, Math.round(d.w + dx)); it.h = Math.max(it.type === 'frame' ? 100 : 60, Math.round(d.h + dy)); }
      if (this.snapOn && it.type !== 'chat') { it.w = G.snap(it.w); if (it.type !== 'text') it.h = G.snap(it.h); }
      d.changed = true;
      this.render();
      return;
    }
    if (d.kind === 'connect') {
      const from = this.item(d.from);
      const p = this.toWorld(e.clientX, e.clientY);
      const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.item');
      document.querySelectorAll('.item.drop-target').forEach(x => x.classList.remove('drop-target'));
      const over = overEl && overEl.dataset.id !== d.from && this.item(overEl.dataset.id);
      if (over && over.type !== 'frame') overEl.classList.add('drop-target');
      const g = G.edgeGeometry(G.bounds(from), over && over.type !== 'frame' ? G.bounds(over) : p, 'curved');
      this.tempEdge.setAttribute('d', g.d);
      return;
    }
    if (d.kind === 'marquee') {
      const r = this.rect();
      const x1 = Math.min(d.cx, e.clientX) - r.left, y1 = Math.min(d.cy, e.clientY) - r.top;
      Object.assign(this.marquee.style, { left: x1 + 'px', top: y1 + 'px', width: Math.abs(dxs) + 'px', height: Math.abs(dys) + 'px' });
      this.marquee.hidden = Math.hypot(dxs, dys) < 4;
      const a = d.p, b = this.toWorld(e.clientX, e.clientY);
      const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      const ids = new Set(d.base);
      for (const it of this.state.items) {
        const ib = G.bounds(it);
        if (ib.x >= box.x && ib.y >= box.y && ib.x + ib.w <= box.x + box.w && ib.y + ib.h <= box.y + box.h) ids.add(it.id);
      }
      this.sel = ids; this.render();
    }
  }

  onUp(e) {
    const d = this.drag; if (!d) return;
    this.drag = null;
    this.canvas.classList.remove('panning', 'dragging', 'connecting');
    if (d.kind === 'pan') { this.applyView(); return; }
    if (d.kind === 'move') {
      if (d.moved) { this.pushHistory(d.snap); this.changed(); }
      else if (d.clickedSelected && this.sel.size > 1) this.setSelection([d.id]);
      else this.render();
      return;
    }
    if (d.kind === 'resize') { if (d.changed) { this.pushHistory(d.snap); this.changed(); } return; }
    if (d.kind === 'connect') {
      this.tempEdge.setAttribute('d', '');
      document.querySelectorAll('.item.drop-target').forEach(x => x.classList.remove('drop-target'));
      const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.item');
      const to = overEl && this.item(overEl.dataset.id);
      if (to && to.id !== d.from && to.type !== 'frame') {
        const edge = this.addEdge(d.from, to.id);
        if (edge) this.setSelection([], edge.id);
      }
      return;
    }
    if (d.kind === 'marquee') { this.marquee.hidden = true; this.o.onSelectionChange?.(); this.render(); }
  }

  onDbl(e) {
    if (this.editing) return;
    const lbl = e.target.closest('.edge-label');
    const hit = e.target.closest('.edge-hit');
    if (lbl || hit) return this.editEdgeLabel((lbl || hit.parentNode).dataset.edge);
    const itemEl = e.target.closest('.item');
    const it = itemEl && this.item(itemEl.dataset.id);
    if (it && (it.type !== 'frame' || e.target.closest('.frame-title'))) {
      if (it.type === 'chat') return this.o.actions.openChat(it.chatId);
      return this.startEdit(it, itemEl);
    }
    if (this.tool === 'select') this.o.actions.createChatAt(this.toWorld(e.clientX, e.clientY));
  }

  onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || this.wheelMode === 'zoom') {
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      this.zoomAt(factor, e.clientX, e.clientY);
    } else {
      this.view.x -= e.deltaX + (e.shiftKey ? e.deltaY : 0);
      if (!e.shiftKey) this.view.y -= e.deltaY;
      this.applyView();
    }
  }

  /** Tastiera: restituisce true se ha gestito il tasto. */
  onKey(e) {
    const k = e.key, code = e.code, mod = e.ctrlKey || e.metaKey;
    if (e.altKey && !mod) {
      const map = { KeyA: 'left', KeyD: 'right', KeyW: 'top', KeyS: 'bottom' };
      if (map[code]) { this.alignSel(map[code]); return true; }
      if (code === 'KeyH') { e.shiftKey ? this.distributeSel('h') : this.alignSel('centerH'); return true; }
      if (code === 'KeyV') { e.shiftKey ? this.distributeSel('v') : this.alignSel('centerV'); return true; }
      if (code === 'KeyG') { this.layout('grid'); return true; }
      if (code === 'KeyL') { this.layout('tree'); return true; }
      if (code === 'KeyK') { this.layout('force'); return true; }
      return false;
    }
    if (mod && (k === 'z' || k === 'Z')) { e.shiftKey ? this.redo() : this.undo(); return true; }
    if (mod && k === 'y') { this.redo(); return true; }
    if (mod && k === 'a') { this.setSelection(this.state.items.map(i => i.id)); return true; }
    if (mod && k === 'd') { this.duplicateSelection(); return true; }
    if (mod && (k === '=' || k === '+')) { this.zoomAt(1.2); return true; }
    if (mod && k === '-') { this.zoomAt(1 / 1.2); return true; }
    if (mod) return false;
    if (k === 'Delete' || k === 'Backspace') { this.deleteSelection(); return true; }
    if (e.shiftKey && code === 'Digit1') { this.fit(); return true; }
    if (k === '[' ) { this.resizeChats('-'); return true; }
    if (k === ']') { this.resizeChats('+'); return true; }
    if (k === '=') { this.resizeChats('eq'); return true; }
    if (k === 'l' || k === 'L') { this.linkSelection(); return true; }
    if (k.startsWith('Arrow') && this.sel.size) {
      const step = e.shiftKey ? 20 : 2;
      const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      this.mutate(() => this.selectedItems().forEach(i => { i.x += dx; i.y += dy; }));
      return true;
    }
    if (k === 'Enter' && this.sel.size === 1) {
      const it = this.selectedItems()[0];
      if (it.type === 'chat') this.o.actions.openChat(it.chatId); else this.startEdit(it, this.els.get(it.id));
      return true;
    }
    return false;
  }

  setTool(t) {
    this.tool = t;
    this.canvas.classList.toggle('tool-hand', t === 'hand');
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  }

  // ---------- Minimappa ----------
  drawMinimap() {
    const mm = $('minimap'); if (!mm) return;
    const g = mm.getContext('2d');
    const W = mm.width, H = mm.height;
    g.clearRect(0, 0, W, H);
    const r = this.rect();
    const vp = { x: -this.view.x / this.view.z, y: -this.view.y / this.view.z, w: r.width / this.view.z, h: r.height / this.view.z };
    const u = G.unionBounds(this.state.items) || vp;
    const x1 = Math.min(u.x, vp.x), y1 = Math.min(u.y, vp.y), x2 = Math.max(u.x + u.w, vp.x + vp.w), y2 = Math.max(u.y + u.h, vp.y + vp.h);
    const pad = 8, s = Math.min((W - pad * 2) / (x2 - x1), (H - pad * 2) / (y2 - y1));
    const ox = pad - x1 * s + ((W - pad * 2) - (x2 - x1) * s) / 2, oy = pad - y1 * s + ((H - pad * 2) - (y2 - y1) * s) / 2;
    this.mm = { s, ox, oy };
    for (const it of this.state.items) {
      const b = G.bounds(it);
      if (it.type === 'frame') { g.strokeStyle = FRAME_COLORS[it.color] || '#888'; g.lineWidth = 1; g.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s); continue; }
      g.fillStyle = it.type === 'chat' ? '#2E9BEA' : it.type === 'note' ? (COLORS[it.color] || COLORS.blue) : '#8FA3C0';
      g.fillRect(ox + b.x * s, oy + b.y * s, Math.max(2, b.w * s), Math.max(2, (it.type === 'chat' ? it.w : b.h) * s));
    }
    g.strokeStyle = '#1F57E0'; g.lineWidth = 1.5;
    g.strokeRect(ox + vp.x * s, oy + vp.y * s, vp.w * s, vp.h * s);
  }

  // ---------- Esporta PNG ----------
  async exportPNG() {
    const items = this.state.items;
    const u = G.unionBounds(items);
    if (!u) throw new Error('La mappa è vuota');
    const pad = 60, scale = 2;
    const cv = document.createElement('canvas');
    cv.width = (u.w + pad * 2) * scale; cv.height = (u.h + pad * 2 + 30) * scale;
    const g = cv.getContext('2d');
    g.scale(scale, scale);
    g.translate(pad - u.x, pad + 30 - u.y);
    g.fillStyle = '#EEF6FF'; g.fillRect(u.x - pad, u.y - pad - 30, u.w + pad * 2, u.h + pad * 2 + 30);
    const font = (px, w = 400) => `${w} ${px}px 'Instrument Sans', system-ui, -apple-system, sans-serif`;
    const wrap = (text, maxW) => {
      const out = [];
      for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const t = line ? line + ' ' + word : word;
          if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
        }
        out.push(line);
      }
      return out;
    };
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    // riquadri
    for (const it of items.filter(i => i.type === 'frame')) {
      const c = FRAME_COLORS[it.color] || FRAME_COLORS.blue;
      g.fillStyle = c + '12'; g.strokeStyle = c; g.lineWidth = 2;
      rr(it.x, it.y, it.w, it.h, 12); g.fill(); g.stroke();
      g.font = font(14, 600);
      const tw = g.measureText(it.text || '').width + 20;
      g.fillStyle = c; rr(it.x - 1, it.y - 30, tw, 30, [7, 7, 0, 0]); g.fill();
      g.fillStyle = '#fff'; g.fillText(it.text || '', it.x + 9, it.y - 10);
    }
    // frecce
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    for (const e of this.state.edges) {
      const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
      const geo = G.edgeGeometry(G.bounds(a), G.bounds(b), e.shape);
      const color = e.status === 'suggested' ? '#E0A100' : (EDGE_COLORS[e.color] || EDGE_COLORS.gray);
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2;
      g.setLineDash(e.dash || e.status === 'suggested' ? [7, 6] : []);
      g.stroke(new Path2D(geo.d)); g.setLineDash([]);
      if (e.arrow !== 'none') g.fill(new Path2D(G.arrowHead(geo.end)));
      if (e.arrow === 'both') g.fill(new Path2D(G.arrowHead(geo.start)));
      if (e.label) {
        g.font = font(12);
        const w = g.measureText(e.label).width + 14;
        g.fillStyle = '#EEF6FF'; g.strokeStyle = '#C9DAF0'; g.lineWidth = 1;
        rr(geo.mid.x - w / 2, geo.mid.y - 10, w, 20, 10); g.fill(); g.stroke();
        g.fillStyle = '#0E1F3D'; g.textAlign = 'center'; g.fillText(e.label, geo.mid.x, geo.mid.y + 4); g.textAlign = 'left';
      }
    }
    // elementi
    const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    for (const it of items.filter(i => i.type !== 'frame')) {
      if (it.type === 'chat') {
        const chat = this.o.getChat(it.chatId);
        const spec = iconSpec(chat || { id: it.chatId, title: '?' });
        const img = spec.type === 'img' ? await loadImg(spec.src) : null;
        if (img) { g.save(); rr(it.x, it.y, it.w, it.w, it.w * 0.24); g.clip(); g.drawImage(img, it.x, it.y, it.w, it.w); g.restore(); }
        else drawBadge(g, spec.type === 'badge' ? spec.badge : iconSpec({ id: it.chatId, title: chat?.title }).badge, it.x, it.y, it.w);
        g.fillStyle = '#0E1F3D'; g.font = font(12.5); g.textAlign = 'center';
        wrap(chat?.title || '', Math.max(it.w, 120)).slice(0, 2).forEach((l, i) => g.fillText(l, it.x + it.w / 2, it.y + it.w + 17 + i * 15));
        g.textAlign = 'left';
      } else if (it.type === 'note') {
        g.fillStyle = COLORS[it.color] || COLORS.yellow;
        g.shadowColor = 'rgba(0,0,0,.12)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
        g.fillRect(it.x, it.y, it.w, it.h); g.shadowColor = 'transparent';
        g.fillStyle = '#0E1F3D'; g.font = font(14);
        g.save(); g.beginPath(); g.rect(it.x, it.y, it.w, it.h); g.clip();
        wrap(plain(it.text || ''), it.w - 24).forEach((l, i) => g.fillText(l, it.x + 12, it.y + 26 + i * 19.6));
        g.restore();
      } else if (it.type === 'text') {
        g.fillStyle = '#0E1F3D'; g.font = font(18);
        wrap(plain(it.text || ''), it.w - 8).forEach((l, i) => g.fillText(l, it.x + 4, it.y + 22 + i * 25));
      }
    }
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
}

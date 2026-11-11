// Pannello laterale della chat: messaggi in streaming, riassunto, icona, diramazione.
import { api } from './api.js';
import { md } from './md.js';
import { iconHTML } from './board.js';
import { badgeOf, BADGE_COLORS, SHAPES, KINDS, initials } from './badge.js';

const $ = (id) => document.getElementById(id);

export class ChatPanel {
  constructor(o) {
    this.o = o; // { getBoardId, onOpenChange(chatId|null), onFork(chatId), onDelete(chatId), toast, chats }
    this.chatId = null; this.streaming = false; this.live = null;
    this.el = $('chat-panel'); this.list = $('cp-messages'); this.input = $('cp-input');
    $('cp-close').onclick = () => this.close();
    $('cp-form').onsubmit = (e) => { e.preventDefault(); this.streaming ? this.stop() : this.send(); };
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!this.streaming) this.send(); }
      if (e.key === 'Escape') this.input.blur();
    });
    $('cp-title').addEventListener('change', async (e) => {
      const chat = await api.updateChat(this.chatId, { title: e.target.value.trim() || 'Senza titolo' });
      this.o.chats.set(chat.id, chat); this.o.onChatUpdated(chat);
    });
    $('cp-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    $('cp-neighbors').onchange = (e) => api.updateChat(this.chatId, { use_neighbor_context: e.target.checked });
    $('cp-info-toggle').onclick = () => { const hide = !$('cp-info').hidden; $('cp-info').hidden = hide; if (!hide) this.renderIconEditor(); };
    $('cp-fork').onclick = () => this.o.onFork(this.chatId);
    $('cp-delete').onclick = () => this.o.onDelete(this.chatId);
    $('cp-icon').onclick = () => this.showIconEditor();
    $('cp-reicon').onclick = () => this.regenIcon(false, 'image');
    $('cp-reicon-full').onclick = () => this.regenIcon(true, 'image');
    $('ie-draw').onclick = () => this.regenIcon(false, 'svg');
    $('ie-draw-full').onclick = () => this.regenIcon(true, 'svg');
    this.buildBadgeEditor();
    $('cp-resummarize').onclick = async () => {
      const done = this.o.toast('Claude sta riassumendo la chat…', { spin: true });
      try { const c = await api.summarize(this.chatId); this.o.chats.set(c.id, c); this.o.onChatUpdated(c); done(); }
      catch (e) { done(); this.o.toast(e.message, { error: true }); }
    };
  }

  async regenIcon(refreshPrompt, mode = 'svg') {
    const id = this.chatId;
    const chat = this.o.chats.get(id);
    if (!chat?.msg_count) return this.o.toast('Scrivi almeno un messaggio prima di creare l\'icona');
    const what = mode === 'svg' ? 'Claude disegna l\'icona…' : 'Genero l\'immagine…';
    const done = this.o.toast(refreshPrompt ? 'Riassumo la chat. ' + what : what, { spin: true });
    try { const c = await api.icon(id, refreshPrompt, mode); this.o.chats.set(c.id, c); this.o.onChatUpdated(c); done(); }
    catch (e) { done(); this.o.toast('Icona non creata: ' + e.message, { error: true, ms: 7000 }); }
  }

  // ---------- Editor dell'icona ----------
  showIconEditor() {
    $('cp-info').hidden = false;
    this.pane = null;
    this.renderIconEditor();
    $('cp-info').scrollTop = 0;
  }
  currentMode(c) {
    if (c.icon_mode === 'badge' || !c.icon_path) return 'badge';
    return c.icon_path.endsWith('.svg') ? 'svg' : 'image';
  }
  buildBadgeEditor() {
    $('ie-kind').innerHTML = Object.entries(KINDS).map(([k, v]) => `<button data-v="${k}">${v}</button>`).join('');
    $('ie-shape').innerHTML = Object.entries(SHAPES).map(([k, v]) => `<button data-v="${k}" title="${v}"><i class="bdg-${k}"></i></button>`).join('');
    $('ie-colors').innerHTML = BADGE_COLORS.map(c => `<button data-v="${c}" style="background:${c}" title="${c}"></button>`).join('');
    $('ie-modes').onclick = (e) => {
      const m = e.target.closest('[data-mode]')?.dataset.mode; if (!m) return;
      const c = this.o.chats.get(this.chatId);
      this.pane = m;
      if (m === 'badge') this.saveBadge({});
      else if (this.currentMode({ ...c, icon_mode: null }) === m && c.icon_mode === 'badge') this.patch({ icon_mode: m });   // torna all'icona già creata
      this.renderIconEditor();
    };
    const pick = (id, key, transform = (v) => v) => {
      $(id).onclick = (e) => { const v = e.target.closest('[data-v]')?.dataset.v; if (v) this.saveBadge({ [key]: transform(v) }); };
    };
    pick('ie-shape', 'shape'); pick('ie-colors', 'color'); pick('ie-style', 'style');
    $('ie-kind').onclick = (e) => {
      const k = e.target.closest('[data-v]')?.dataset.v; if (!k) return;
      const c = this.o.chats.get(this.chatId);
      const text = k === 'number' ? '1' : k === 'symbol' ? '★' : initials(c.title);
      this.saveBadge({ kind: k, text });
    };
    $('ie-color').oninput = (e) => this.saveBadge({ color: e.target.value });
    $('ie-text').oninput = (e) => {
      const b = badgeOf(this.o.chats.get(this.chatId));
      let v = e.target.value;
      if (b.kind === 'number') v = v.replace(/\D/g, '').slice(0, 3);
      else if (b.kind === 'letters') v = v.toUpperCase().slice(0, 3);
      e.target.value = v;
      this.saveBadge({ text: v });
    };
  }
  /** Aggiorna subito l'anteprima e salva (con un breve ritardo) il badge. */
  saveBadge(change) {
    const c = this.o.chats.get(this.chatId); if (!c) return;
    const badge = { ...badgeOf(c), ...change };
    const local = { ...c, icon_mode: 'badge', badge: JSON.stringify(badge) };
    this.o.chats.set(c.id, local); this.o.onChatUpdated(local);
    this.pane = 'badge';
    clearTimeout(this.badgeTimer);
    const id = c.id;
    this.badgeTimer = setTimeout(() => api.updateChat(id, { icon_mode: 'badge', badge }).catch(e => this.o.toast(e.message, { error: true })), 300);
  }
  async patch(p) {
    const c = await api.updateChat(this.chatId, p);
    this.o.chats.set(c.id, c); this.o.onChatUpdated(c);
  }
  renderIconEditor() {
    const c = this.o.chats.get(this.chatId); if (!c) return;
    const shown = this.currentMode(c);
    const pane = this.pane || shown;
    $('ie-preview').innerHTML = iconHTML(c);
    document.querySelectorAll('#ie-modes [data-mode]').forEach(b => { b.classList.toggle('on', b.dataset.mode === pane); b.classList.toggle('shown', b.dataset.mode === shown); });
    document.querySelectorAll('.ie-pane').forEach(p => { p.hidden = p.dataset.pane !== pane; });
    const b = badgeOf(c);
    const on = (id, v) => $(id).querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x.dataset.v === v));
    on('ie-kind', b.kind); on('ie-shape', b.shape); on('ie-colors', b.color); on('ie-style', b.style);
    if (document.activeElement !== $('ie-text')) $('ie-text').value = b.text || '';
    $('ie-text').maxLength = b.kind === 'symbol' ? 4 : 3;
    $('ie-color').value = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#1F57E0';
  }

  async open(chatId) {
    if (chatId !== this.chatId) this.pane = null;
    this.chatId = chatId;
    this.live = null;
    this.el.hidden = false;
    document.body.classList.add('chat-open');
    this.o.onOpenChange(chatId);
    await this.reload(chatId);
    setTimeout(() => this.input.focus(), 30);
  }
  /** Ricarica i messaggi dal server; se Claude sta ancora rispondendo mostra la parte già scritta. */
  async reload(chatId = this.chatId) {
    const data = await api.chat(chatId);
    if (this.chatId !== chatId) return;
    const { messages, busy, partial, ...chat } = data;
    this.o.chats.set(chatId, { ...this.o.chats.get(chatId), ...chat });
    this.renderHeader();
    this.renderMessages(messages);
    this.live = null;
    if (busy) this.startLive(chatId, partial || '');
    this.setStreaming(!!busy);
  }
  /** La risposta continua in background: chiudere il pannello non la interrompe. */
  close() {
    this.chatId = null;
    this.live = null;
    this.el.hidden = true;
    document.body.classList.remove('chat-open');
    this.o.onOpenChange(null);
  }

  renderHeader() {
    const c = this.o.chats.get(this.chatId); if (!c) return;
    const gen = c.icon_status === 'generating';
    $('cp-icon').innerHTML = iconHTML(c) + (gen ? '<div class="spinner" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.5)"><div class="spin"></div></div>' : '');
    if (document.activeElement !== $('cp-title')) $('cp-title').value = c.title;
    $('cp-neighbors').checked = !!c.use_neighbor_context;
    $('cp-summary').textContent = c.summary || 'Non ancora disponibile: arriva dopo il primo scambio.';
    $('cp-keywords').textContent = c.keywords || '—';
    $('cp-prompt').textContent = c.image_prompt || '—';
    $('cp-icon-error').textContent = c.icon_status === 'error' ? 'Ultimo errore icona: ' + (c.icon_error || '') : '';
    if (!$('cp-info').hidden) this.renderIconEditor();
  }

  renderMessages(msgs) {
    this.list.innerHTML = '';
    if (!msgs.length) {
      this.list.innerHTML = '<div class="empty-chat"><b>Da dove partiamo?</b>Scrivi la prima idea. Dopo la risposta Claude dà un titolo alla chat e ne disegna l\'icona.</div>';
      return;
    }
    let inheritedShown = false;
    msgs.forEach((m, i) => {
      if (m.inherited && !inheritedShown) { this.list.insertAdjacentHTML('beforeend', '<div class="msg-divider">— dalla chat di partenza —</div>'); inheritedShown = true; }
      if (inheritedShown && !m.inherited && msgs[i - 1]?.inherited) this.list.insertAdjacentHTML('beforeend', '<div class="msg-divider">— nuova diramazione —</div>');
      this.addBubble(m.role, m.content, m.inherited);
    });
    this.list.scrollTop = this.list.scrollHeight;
  }
  addBubble(role, content, inherited) {
    const empty = this.list.querySelector('.empty-chat'); if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = `msg ${role}${inherited ? ' inherited' : ''}`;
    if (role === 'user') div.textContent = content; else div.innerHTML = md(content);
    this.list.appendChild(div);
    return div;
  }

  async send() {
    const text = this.input.value.trim();
    if (!text || !this.chatId || this.streaming) return;
    const chatId = this.chatId;
    this.input.value = '';
    this.addBubble('user', text);
    this.startLive(chatId, '');
    this.setStreaming(true);
    try {
      await this.o.beforeSend?.();
      const chat = await api.sendMessage(chatId, text, this.o.getBoardId(), { onDelta: () => {} });
      if (chat) { this.o.chats.set(chat.id, { ...this.o.chats.get(chat.id), ...chat }); this.o.onChatUpdated(chat); }
    } catch (e) {
      if (e.message !== 'Interrotto') this.o.toast('Risposta non riuscita: ' + e.message, { error: true, ms: 6000 });
    } finally {
      if (this.chatId === chatId) await this.reload(chatId).catch(() => {});
    }
  }

  // ---------- Risposta in corso (arriva dagli eventi del server, anche per chat riaperte) ----------
  startLive(chatId, text) {
    const empty = this.list.querySelector('.empty-chat'); if (empty) empty.remove();
    const el = document.createElement('div');
    el.className = 'msg assistant live';
    this.list.appendChild(el);
    this.live = { chatId, text, el };
    this.paintLive(true);
  }
  paintLive(force) {
    const l = this.live; if (!l) return;
    if (this.livePaint && !force) return;
    this.livePaint = requestAnimationFrame(() => {
      this.livePaint = 0;
      if (!this.live?.el.isConnected) return;
      const near = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 140;
      this.live.el.innerHTML = this.live.text ? md(this.live.text) : '<div class="typing"><span></span><span></span><span></span></div>';
      if (near) this.list.scrollTop = this.list.scrollHeight;
    });
  }
  onDelta({ chatId, d, len }) {
    if (chatId !== this.chatId) return;
    if (!this.live) this.startLive(chatId, '');
    const l = this.live;
    if (len - d.length === l.text.length) { l.text += d; this.paintLive(); }
    else if (len > l.text.length && !this.resyncing) {      // persi dei pezzi: riprendo il testo dal server
      this.resyncing = true;
      api.chat(chatId).then(c => { if (this.live && this.chatId === chatId && c.partial.length > this.live.text.length) { this.live.text = c.partial; this.paintLive(); } })
        .catch(() => {}).finally(() => { this.resyncing = false; });
    }
  }
  onBusy({ chatId, busy }) {
    if (chatId !== this.chatId) return;
    if (busy) { if (!this.live) this.startLive(chatId, ''); this.setStreaming(true); }
    else setTimeout(() => { if (this.chatId === chatId) this.reload(chatId).catch(() => {}); }, 150);
  }
  stop() { if (this.chatId) api.stopChat(this.chatId).catch(() => {}); }
  setStreaming(on) {
    this.streaming = on;
    const b = $('cp-send');
    b.textContent = on ? 'Stop' : 'Invia';
    b.classList.toggle('stop', on);
  }
}

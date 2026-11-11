// Chiamate al server locale.
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

export const api = {
  status: () => req('GET', '/api/status'),
  settings: () => req('GET', '/api/settings'),
  saveSettings: (s) => req('PUT', '/api/settings', s),
  testImage: () => req('POST', '/api/images/test'),

  boards: () => req('GET', '/api/boards'),
  board: (id) => req('GET', `/api/boards/${id}`),
  createBoard: (name) => req('POST', '/api/boards', { name }),
  updateBoard: (id, patch) => req('PATCH', `/api/boards/${id}`, patch),
  deleteBoard: (id) => req('DELETE', `/api/boards/${id}`),

  chats: () => req('GET', '/api/chats'),
  chat: (id) => req('GET', `/api/chats/${id}`),
  createChat: (body = {}) => req('POST', '/api/chats', body),
  updateChat: (id, patch) => req('PATCH', `/api/chats/${id}`, patch),
  deleteChat: (id) => req('DELETE', `/api/chats/${id}`),
  summarize: (id) => req('POST', `/api/chats/${id}/summarize`),
  icon: (id, refreshPrompt, mode) => req('POST', `/api/chats/${id}/icon`, { refreshPrompt, mode }),

  suggestLinks: (boardId) => req('POST', '/api/ai/suggest-links', { boardId }),
  clusters: (boardId, itemIds) => req('POST', '/api/ai/clusters', { boardId, itemIds }),
  synthesis: (boardId, itemIds) => req('POST', '/api/ai/synthesis', { boardId, itemIds }),

  /** Invia un messaggio e legge la risposta in streaming. */
  async sendMessage(chatId, text, boardId, { onDelta, signal }) {
    const res = await fetch(`/api/chats/${chatId}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, boardId }), signal,
    });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', done = null;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'delta') onDelta(ev.data);
        else if (ev.type === 'done') done = ev.data;
        else if (ev.type === 'error') throw new Error(ev.data);
      }
    }
    return done;
  },

  events(onEvent) {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => onEvent(JSON.parse(e.data));
    return es;
  },
};

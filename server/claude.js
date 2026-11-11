// Ponte verso Claude tramite l'Agent SDK (usa il login di Claude Code sul tuo computer).
// Con --mock o se l'SDK non è installato, risponde con testo simulato: utile per provare l'interfaccia.
import { DATA_DIR } from './db.js';
import { codexStream, codexOneShot } from './codex.js';

let sdk = null;
export let MOCK = process.argv.includes('--mock') || process.env.CANVAS_MOCK === '1';

if (!MOCK) {
  try {
    sdk = await import('@anthropic-ai/claude-agent-sdk');
  } catch {
    console.warn('\n[!] @anthropic-ai/claude-agent-sdk non trovato: avvio in modalità simulata. Esegui "npm install".\n');
    MOCK = true;
  }
}

const BASE_SYSTEM = (lang) => `Sei un partner di brainstorming dentro una lavagna visuale.
Ogni conversazione è un nodo di una mappa di idee: sii concreto, fai emergere opzioni, ipotesi, rischi e domande aperte.
Preferisci risposte strutturate e brevi; usa elenchi quando aiutano. Rispondi in ${lang} salvo diversa richiesta.`;

/**
 * Chat in streaming.
 * @returns {Promise<{text: string, sessionId: string|null}>}
 */
export async function streamChat({ provider = 'claude', prompt, sessionId, forkFromSession, extraSystem, settings, onDelta, signal }) {
  if (provider === 'codex') {
    if (MOCK) return mockStream('[Codex] ' + prompt, extraSystem, onDelta, signal);
    return codexStream({ prompt, threadId: sessionId, system: BASE_SYSTEM(settings.language), extraSystem, onDelta, signal, settings });
  }
  const system = [BASE_SYSTEM(settings.language), extraSystem].filter(Boolean).join('\n\n');
  if (MOCK) return mockStream(prompt, extraSystem, onDelta, signal);

  const abortController = new AbortController();
  signal?.addEventListener('abort', () => abortController.abort());
  const web = settings.webTools === 'true';
  const tools = web ? ['WebSearch', 'WebFetch'] : [];

  const options = {
    systemPrompt: system,
    tools,
    allowedTools: tools,
    includePartialMessages: true,
    settingSources: [],
    cwd: DATA_DIR,
    abortController,
    maxTurns: web ? 8 : 1,
  };
  if (settings.chatModel) options.model = settings.chatModel;
  if (sessionId) options.resume = sessionId;
  else if (forkFromSession) { options.resume = forkFromSession; options.forkSession = true; }

  let text = '';
  let streamedThisBlock = false;
  let newSessionId = null;
  for await (const msg of sdk.query({ prompt, options })) {
    if (msg.session_id) newSessionId = msg.session_id;
    if (msg.type === 'stream_event') {
      const ev = msg.event;
      if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        text += ev.delta.text; streamedThisBlock = true; onDelta?.(ev.delta.text);
      } else if (ev?.type === 'message_start' && text) {
        text += '\n\n'; onDelta?.('\n\n');           // nuovo turno dopo l'uso di uno strumento
      }
    } else if (msg.type === 'assistant' && !streamedThisBlock) {
      // fallback se lo streaming parziale non è disponibile
      const t = (msg.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (t) { text += t; onDelta?.(t); }
    } else if (msg.type === 'assistant') {
      streamedThisBlock = false;
    } else if (msg.type === 'result') {
      if (msg.is_error && !text) throw new Error(msg.result || `Errore Claude (${msg.subtype})`);
      if (!text && msg.result) { text = msg.result; onDelta?.(msg.result); }
    }
  }
  return { text: text.trim(), sessionId: newSessionId };
}

// Elenco dei modelli Claude disponibili con il tuo account (chiesto a Claude Code, con una riserva fissa)
const CLAUDE_FALLBACK = [
  { value: 'opus', displayName: 'Opus', description: 'il più capace' },
  { value: 'sonnet', displayName: 'Sonnet', description: 'equilibrato' },
  { value: 'haiku', displayName: 'Haiku', description: 'veloce, consuma meno' },
  { value: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', description: '' },
  { value: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', description: '' },
  { value: 'claude-haiku-5-5', displayName: 'Claude Haiku 5.5', description: '' },
];
let claudeModelsCache = null;
export async function listClaudeModels() {
  if (MOCK) return CLAUDE_FALLBACK;
  if (claudeModelsCache) return claudeModelsCache;
  const abortController = new AbortController();
  try {
    async function* idle() { await new Promise((r) => abortController.signal.addEventListener('abort', r)); }
    const q = sdk.query({ prompt: idle(), options: { settingSources: [], cwd: DATA_DIR, persistSession: false, abortController } });
    const list = await Promise.race([q.supportedModels(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
    if (Array.isArray(list) && list.length) claudeModelsCache = list.map(m => ({ value: m.value, displayName: m.displayName || m.value, description: m.description || '' }));
  } catch (e) {
    console.warn('[modelli] elenco non disponibile, uso quello fisso:', e.message);
  } finally { abortController.abort(); }
  return claudeModelsCache || CLAUDE_FALLBACK;
}

/** Chiamata singola senza strumenti né sessione, per riassunti e strumenti della mappa. */
export async function oneShot(prompt, settings, system = 'Rispondi solo con JSON valido, senza testo prima o dopo.') {
  if (MOCK) return mockOneShot(prompt);
  if (settings.utilityProvider === 'codex') return codexOneShot(prompt, settings, system);
  const options = { systemPrompt: system, tools: [], maxTurns: 1, settingSources: [], persistSession: false, cwd: DATA_DIR };
  if (settings.utilityModel) options.model = settings.utilityModel;
  let out = '';
  for await (const msg of sdk.query({ prompt, options })) {
    if (msg.type === 'result') {
      if (msg.is_error) throw new Error(msg.result || `Errore Claude (${msg.subtype})`);
      out = msg.result || out;
    } else if (msg.type === 'assistant') {
      const t = (msg.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (t) out = t;
    }
  }
  return out;
}

export async function oneShotJSON(prompt, settings) {
  const raw = await oneShot(prompt, settings);
  return parseJSON(raw);
}

export function parseJSON(raw) {
  const s = raw.replace(/```(?:json)?/g, '');
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Risposta non in formato JSON');
  return JSON.parse(s.slice(start, end + 1));
}

// ---------------- Modalità simulata ----------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function mockStream(prompt, extraSystem, onDelta, signal) {
  const ctx = extraSystem ? `\n\n_(Contesto ricevuto dalla mappa: ${extraSystem.split('\n').length} righe)_` : '';
  const reply = `**[Risposta simulata]** Hai scritto: "${prompt.slice(0, 120)}".\n\nAlcune direzioni da esplorare:\n- Definire il problema in una frase\n- Elencare tre alternative\n- Individuare il rischio principale${ctx}`;
  let text = '';
  for (const word of reply.split(/(\s+)/)) {
    if (signal?.aborted) break;
    text += word; onDelta?.(word);
    await sleep(Number(process.env.CANVAS_MOCK_DELAY || 12));
  }
  return { text, sessionId: 'mock-' + Math.random().toString(36).slice(2) };
}

async function mockOneShot(prompt) {
  await sleep(300);
  const ids = [...new Set([...prompt.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))];
  if (prompt.includes('TASK:SUMMARY')) {
    const firstUser = ((prompt.split('<transcript>')[1] || '').match(/UTENTE: ([^\n]*)/) || [])[1] || '';
    const words = firstUser.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3);
    const t = words.slice(0, 3).join(' ') || 'Idea';
    return JSON.stringify({ title: t.charAt(0).toUpperCase() + t.slice(1), summary: 'Riassunto simulato della conversazione.', keywords: words.slice(0, 4), image_prompt: `a lightbulb with gears representing ${t}` });
  }
  if (prompt.includes('TASK:SVG')) {
    let h = 0; for (const c of prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const shapes = [
      '<circle cx="50" cy="46" r="18" fill="none" stroke="#fff" stroke-width="6"/><path d="M42 70h16M44 78h12" stroke="#A9DBFF" stroke-width="5" stroke-linecap="round"/>',
      '<path d="M26 66 50 28l24 38Z" fill="#fff"/><circle cx="50" cy="56" r="6" fill="#1F57E0"/>',
      '<rect x="28" y="30" width="44" height="34" rx="8" fill="#fff"/><path d="M38 64 34 76l14-12" fill="#fff"/><path d="M38 44h24M38 52h16" stroke="#1F57E0" stroke-width="5" stroke-linecap="round"/>',
      '<path d="M50 24c12 10 18 22 14 36l-14 14-14-14c-4-14 2-26 14-36Z" fill="#fff"/><circle cx="50" cy="46" r="6" fill="#2E9BEA"/>',
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38A8F5"/><stop offset="1" stop-color="#0C2A5B"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${shapes[h % shapes.length]}</svg>`;
  }
  if (prompt.includes('TASK:LINKS')) {
    const links = [];
    for (let i = 0; i + 1 < ids.length && links.length < 4; i += 1) links.push({ from: ids[i], to: ids[i + 1], label: 'approfondisce', reason: 'Collegamento simulato' });
    return JSON.stringify({ links });
  }
  if (prompt.includes('TASK:CLUSTERS')) {
    const half = Math.ceil(ids.length / 2);
    return JSON.stringify({ groups: [{ title: 'Tema A', items: ids.slice(0, half) }, { title: 'Tema B', items: ids.slice(half) }].filter(g => g.items.length) });
  }
  if (prompt.includes('TASK:SYNTHESIS')) {
    return JSON.stringify({ markdown: '## Sintesi (simulata)\n**Idee principali**\n- Prima idea\n- Seconda idea\n\n**Tensioni**\n- A contro B\n\n**Domande aperte**\n- Cosa manca?' });
  }
  return '{}';
}

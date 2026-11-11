// Ponte verso il modello: ChatGPT tramite il Codex SDK di OpenAI (usa il login ChatGPT di Codex sul tuo computer).
// Con --mock risponde con testo simulato: utile per provare l'interfaccia.
import { codexStream, codexOneShot } from './codex.js';

export const MOCK = process.argv.includes('--mock') || process.env.CANVAS_MOCK === '1';

const BASE_SYSTEM = (lang) => `Sei un partner di brainstorming dentro una lavagna visuale.
Ogni conversazione è un nodo di una mappa di idee: sii concreto, fai emergere opzioni, ipotesi, rischi e domande aperte.
Preferisci risposte strutturate e brevi; usa elenchi quando aiutano. Rispondi in ${lang} salvo diversa richiesta.`;

/**
 * Chat in streaming.
 * @returns {Promise<{text: string, sessionId: string|null}>}
 */
export async function streamChat({ prompt, sessionId, extraSystem, settings, onDelta, signal }) {
  if (MOCK) return mockStream(prompt, extraSystem, onDelta, signal);
  return codexStream({ prompt, threadId: sessionId, system: BASE_SYSTEM(settings.language), extraSystem, onDelta, signal, settings });
}

/** Chiamata singola senza strumenti né sessione, per riassunti e strumenti della mappa. */
export async function oneShot(prompt, settings, system = 'Rispondi solo con JSON valido, senza testo prima o dopo.') {
  if (MOCK) return mockOneShot(prompt);
  return codexOneShot(prompt, settings, system);
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
    // Icone finte nello stile del marchio: tratti spessi su fondo piatto.
    const bg = ['#3965FA', '#1B1B39', '#E9EBFF', '#2347D6'][h % 4];
    const ink = bg === '#E9EBFF' ? '#3965FA' : '#FFFFFF', acc = bg === '#E9EBFF' ? '#1B1B39' : '#99B7FC';
    const st = `fill="none" stroke="${ink}" stroke-width="7"`;
    const shapes = [
      `<path d="M50 24a20 20 0 0 0-11 36.5V68h22v-7.5A20 20 0 0 0 50 24" ${st}/><path d="M41 78h18" ${st}/><path d="M74 22c4 1 7 3 9 6M76 14c5 1 9 3 12 7" fill="none" stroke="${acc}" stroke-width="4" stroke-linecap="round"/>`,
      `<path d="M20 70 42 34l14 22 8-12 16 26" ${st}/><circle cx="70" cy="28" r="6" fill="#FFD23F"/>`,
      `<path d="M24 32h52v30H46l-14 12v-12h-8z" ${st}/><path d="M36 44h28" ${st}/>`,
      `<path d="M50 20c14 12 18 28 12 44H38c-6-16-2-32 12-44" ${st}/><circle cx="50" cy="44" r="5" fill="${acc}"/><path d="M42 74l-4 8M58 74l4 8" ${st}/>`,
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${shapes[h % shapes.length]}</svg>`;
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

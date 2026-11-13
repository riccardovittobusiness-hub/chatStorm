// Ponte verso ChatGPT tramite il Codex SDK di OpenAI (usa il login ChatGPT di Codex sul tuo computer).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './db.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Modelli disponibili in Codex con l'accesso ChatGPT (dal 14 ottobre 2026 gpt-5.5 è sostituito dalla famiglia 5.6)
export const CODEX_MODELS = [
  { value: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol', description: 'il più capace' },
  { value: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra', description: 'equilibrato' },
  { value: 'gpt-5.6-luna', displayName: 'GPT-5.6 Luna', description: 'veloce, consuma meno' },
];
const SDK_DIR = join(ROOT, 'node_modules', '@openai', 'codex-sdk');
// Cartella vuota in sola lettura per Codex: non vede l'archivio delle chat né le chiavi
const WORKDIR = join(DATA_DIR, 'codex-workspace');
mkdirSync(WORKDIR, { recursive: true });
let sdkPromise = null;
let installing = null;

export function codexStatus() {
  const home = process.env.CODEX_HOME || join(homedir(), '.codex');
  return { installed: existsSync(SDK_DIR), loggedIn: existsSync(join(home, 'auth.json')), installing: !!installing };
}

/** Se il supporto Codex non è installato, lo installa (una volta) con npm nella cartella del progetto. */
function installSdk() {
  installing ||= new Promise((resolve, reject) => {
    console.log('[codex] installo @openai/codex-sdk…');
    const p = spawn('npm', ['install', '--no-audit', '--no-fund', '@openai/codex-sdk'], { cwd: ROOT, stdio: 'inherit', env: process.env });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Installazione del supporto Codex non riuscita (npm, codice ${code})`)));
  }).finally(() => { installing = null; });
  return installing;
}

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      if (!existsSync(SDK_DIR)) await installSdk();
      return import('@openai/codex-sdk');
    })().catch((e) => { sdkPromise = null; throw e; });
  }
  return sdkPromise;
}

function client(Codex) {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;            // usa il login ChatGPT (abbonamento), non una API key a consumo
  delete env.CODEX_API_KEY;
  return new Codex({ env });
}
function threadOptions(settings) {
  const o = { workingDirectory: WORKDIR, skipGitRepoCheck: true, sandboxMode: 'read-only', networkAccessEnabled: settings.webTools === 'true' };
  if (settings.codexModel) o.model = settings.codexModel;
  return o;
}
function friendly(e) {
  const m = String(e?.message || e);
  if (/log ?in|auth|unauthori[sz]ed|401/i.test(m)) return new Error('Codex non è collegato al tuo account ChatGPT. Riapri installa.command (o esegui npx codex login nella cartella del progetto), accedi con ChatGPT e riprova.');
  return e instanceof Error ? e : new Error(m);
}

/**
 * Chat in streaming con Codex. Le istruzioni di brainstorming vanno nel primo messaggio del thread,
 * il contesto dalla mappa davanti a ogni messaggio.
 */
export async function codexStream({ prompt, threadId, system, extraSystem, onDelta, signal, settings }) {
  const { Codex } = await loadSdk();
  const codex = client(Codex);
  const opts = threadOptions(settings);
  const thread = threadId ? codex.resumeThread(threadId, opts) : codex.startThread(opts);
  const parts = [];
  if (!threadId) parts.push(`<istruzioni>\n${system}\n</istruzioni>`);
  if (extraSystem) parts.push(`<contesto_dalla_mappa>\n${extraSystem}\n</contesto_dalla_mappa>`);
  parts.push(prompt);

  let text = '', tid = threadId || null;
  const seen = new Map();
  try {
    const { events } = await thread.runStreamed(parts.join('\n\n'), { signal });
    for await (const ev of events) {
      if (ev.type === 'thread.started') tid = ev.thread_id;
      else if (/^item\./.test(ev.type) && ev.item?.type === 'agent_message') {
        const id = ev.item.id || 'msg';
        const prev = seen.get(id) ?? null;
        const cur = ev.item.text || '';
        if (prev === null && text && cur) { text += '\n\n'; onDelta?.('\n\n'); }
        const base = prev ?? '';
        if (cur.length > base.length && cur.startsWith(base)) { const d = cur.slice(base.length); text += d; onDelta?.(d); }
        seen.set(id, cur);
      } else if (ev.type === 'turn.failed') throw new Error(ev.error?.message || 'Codex non è riuscito a rispondere');
      else if (ev.type === 'error') throw new Error(ev.message || 'Errore di Codex');
    }
  } catch (e) { throw friendly(e); }
  return { text: text.trim(), sessionId: tid || thread.id || null };
}

/** Chiamata singola (riassunti, icone, strumenti della mappa). */
export async function codexOneShot(prompt, settings, system) {
  const { Codex } = await loadSdk();
  const thread = client(Codex).startThread(threadOptions({ ...settings, webTools: 'false' }));
  try {
    const turn = await thread.run(`${system}\n\n${prompt}`);
    return turn.finalResponse || '';
  } catch (e) { throw friendly(e); }
}

// Ponte verso ChatGPT tramite il Codex SDK di OpenAI. Codex viaggia dentro l'app: l'accesso si fa una volta
// con il proprio account ChatGPT (pulsante "Accedi con ChatGPT") e resta nel computer, in ~/.codex.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { DATA_DIR } from './db.js';

// Modelli disponibili in Codex con l'accesso ChatGPT (dal 14 ottobre 2026 gpt-5.5 è sostituito dalla famiglia 5.6)
export const CODEX_MODELS = [
  { value: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol', description: 'il più capace' },
  { value: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra', description: 'equilibrato' },
  { value: 'gpt-5.6-luna', displayName: 'GPT-5.6 Luna', description: 'veloce, consuma meno' },
];
// Cartella vuota in sola lettura per Codex: non vede l'archivio delle chat né le chiavi
const WORKDIR = join(DATA_DIR, 'codex-workspace');
mkdirSync(WORKDIR, { recursive: true });
let sdkPromise = null;

const TRIPLES = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl' };
/** Il programma Codex incluso con l'SDK, per questo sistema (stessa ricerca che fa l'SDK). */
export function codexBinary() {
  try {
    const key = `${process.platform}-${process.arch}`;
    const codexPkg = createRequire(import.meta.url).resolve('@openai/codex/package.json');
    const platformPkg = createRequire(codexPkg).resolve(`@openai/codex-${key}/package.json`);
    const bin = join(dirname(platformPkg), 'vendor', TRIPLES[key], 'bin', 'codex');
    return existsSync(bin) ? bin : null;
  } catch { return null; }
}
const authFile = () => join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
function cleanEnv() {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;            // usa il login ChatGPT (abbonamento), non una API key a consumo
  delete env.CODEX_API_KEY;
  delete env.ELECTRON_RUN_AS_NODE;      // riguarda solo il motore, non i programmi che avvia
  return env;
}

export function codexStatus() {
  return { installed: !!codexBinary(), loggedIn: existsSync(authFile()) };
}

// ---------- Accesso con ChatGPT: avvia "codex login", che apre il browser e aspetta la conferma ----------
let login = null;      // { proc, out, url, done, ok }
const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
export function codexLoginState() {
  const st = codexStatus();
  return { ...st, running: !!login && !login.done, url: login?.url || null,
    error: login?.done && !login.ok && !st.loggedIn ? (login.out.trim().split('\n').pop() || 'Accesso non completato').slice(0, 300) : null };
}
export function codexLoginStart() {
  if (login && !login.done) return codexLoginState();
  const bin = codexBinary();
  if (!bin) throw Object.assign(new Error('Il componente Codex non è presente in questa installazione: scarica di nuovo chatStorm.'), { status: 500 });
  const proc = spawn(bin, ['login'], { env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  const cur = login = { proc, out: '', url: null, done: false, ok: false };
  const onData = (d) => {
    cur.out = (cur.out + String(d).replace(ANSI, '')).slice(-4000);
    const m = cur.out.match(/https:\/\/[^\s"'<>]+/);                // la pagina di accesso, se il browser non si apre da solo
    if (m) cur.url = m[0];
  };
  proc.stdout.on('data', onData); proc.stderr.on('data', onData);
  proc.on('error', (e) => { cur.done = true; cur.out += `\n${e.message}`; });
  proc.on('exit', (code) => { cur.done = true; cur.ok = code === 0; });
  return codexLoginState();
}
export function codexLoginCancel() {
  if (login && !login.done) { try { login.proc.kill('SIGTERM'); } catch {} }
  login = null;
  return codexLoginState();
}

async function loadSdk() {
  sdkPromise ||= import('@openai/codex-sdk').catch((e) => { sdkPromise = null; throw e; });
  return sdkPromise;
}

function client(Codex) {
  return new Codex({ env: cleanEnv() });
}
function threadOptions(settings) {
  const o = { workingDirectory: WORKDIR, skipGitRepoCheck: true, sandboxMode: 'read-only', networkAccessEnabled: settings.webTools === 'true' };
  if (settings.codexModel) o.model = settings.codexModel;
  return o;
}
function friendly(e) {
  const m = String(e?.message || e);
  if (/log ?in|auth|unauthori[sz]ed|401/i.test(m)) return new Error('chatStorm non è collegato al tuo account ChatGPT. Apri Impostazioni, premi "Accedi con ChatGPT" e riprova.');
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

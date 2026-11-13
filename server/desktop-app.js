// Aggiornamento automatico dell'app per Mac.
// Quando il server viene avviato dall'app desktop e i file dell'app (nome, icona, main.js) sono cambiati,
// ricostruisce chatStorm.app in background con mac/aggiorna-app.sh e la riapre: niente Terminale.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = fileURLToPath(new URL('../', import.meta.url));
const DATA = path.join(PROJ, 'data');
const APP = path.join(os.homedir(), 'Applications', 'chatStorm.app');
const INPUTS = ['mac/electron/main.js', 'mac/electron/package.json', 'mac/electron/icon.png', 'mac/AppIcon.icns'];

export let appUpdate = null;            // null | 'building'

/** Avviato dall'app desktop? */
function fromDesktopApp() {
  const ids = `${process.env.__CFBundleIdentifier || ''} ${process.env.XPC_SERVICE_NAME || ''}`;
  return /riccardovitto\.chatstorm/i.test(ids);
}

export function buildId() {
  const h = createHash('sha1');
  for (const f of INPUTS) { try { h.update(fs.readFileSync(path.join(PROJ, f))); } catch { h.update(`missing:${f}`); } }
  return h.digest('hex').slice(0, 16);
}
const read = (f) => { try { return fs.readFileSync(path.join(DATA, f), 'utf8').trim(); } catch { return ''; } };

/** Se serve, avvia la ricostruzione (una volta per versione: se fallisce non riprova in loop). */
export function maybeUpdateDesktopApp(onState = () => {}) {
  if (process.platform !== 'darwin' || !fromDesktopApp()) return;
  const id = buildId();
  if (fs.existsSync(APP) && read('app-build.txt') === id) return;    // già aggiornata
  if (read('app-build-failed.txt') === id) return;                   // già tentata e fallita: c'è il log
  const script = path.join(PROJ, 'mac', 'aggiorna-app.sh');
  if (!fs.existsSync(script)) return;
  fs.mkdirSync(DATA, { recursive: true });
  const log = fs.openSync(path.join(DATA, 'app-build.log'), 'w');
  // processo staccato: deve sopravvivere alla chiusura della vecchia app (che spegne anche questo server)
  const child = spawn('/bin/zsh', [script, id], { cwd: PROJ, env: { ...process.env }, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  appUpdate = 'building';
  onState(appUpdate);
  console.log(`[app] ricostruisco chatStorm.app (versione ${id}), log in data/app-build.log`);
}

// chatStorm come app desktop: avvia il server locale, apre una finestra nativa, lo spegne all'uscita.
const { app, BrowserWindow, shell, dialog, nativeImage } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setName('chatStorm');
const HOME = app.getPath('home');
const URL = 'http://localhost:4317';

// Cartella del progetto: scritta da crea-app.command in config.json
let PROJ = path.join(HOME, 'claude-canvas');
try { PROJ = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')).project || PROJ; } catch {}

let server = null;
let win = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function status() {
  return new Promise((resolve) => {
    const req = http.get(URL + '/api/status', { timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function post(p) {
  return new Promise((resolve) => {
    const req = http.request(URL + p, { method: 'POST', timeout: 1500 }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve); req.on('timeout', () => { req.destroy(); resolve(); });
    req.end();
  });
}

/** Trova Node come lo trova il Terminale (le app avviate dal Finder hanno un PATH minimo). */
function findNode() {
  try {
    const out = execFileSync('/bin/zsh', ['-lic', 'command -v node'], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] });
    const line = out.split('\n').map(s => s.trim()).filter(s => s.startsWith('/')).pop();
    if (line && fs.existsSync(line)) return line;
  } catch {}
  for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node', path.join(HOME, '.volta/bin/node')]) if (fs.existsSync(p)) return p;
  return null;
}

function newestServerFile() {
  try {
    const dir = path.join(PROJ, 'server');
    return Math.max(...fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => fs.statSync(path.join(dir, f)).mtimeMs));
  } catch { return 0; }
}

async function ensureServer() {
  const st = await status();
  if (st) {
    // già acceso: se il codice è più recente del server (aggiornamento), lo riavvio
    if (!st.started || newestServerFile() > st.started) {
      await post('/api/shutdown');
      for (let i = 0; i < 20 && await status(); i++) await sleep(250);
    } else return;
  }
  if (!fs.existsSync(path.join(PROJ, 'server', 'index.js'))) {
    throw new Error(`Non trovo il progetto in ${PROJ}. Riesegui crea-app.command dalla cartella del progetto.`);
  }
  const node = findNode();
  if (!node) throw new Error('Node.js non trovato. Installalo da nodejs.org (versione 22 o più recente).');
  const env = { ...process.env };
  delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY;   // usa l'abbonamento ChatGPT, non una API key a consumo
  delete env.ELECTRON_RUN_AS_NODE;
  env.PATH = [path.dirname(node), path.join(HOME, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin', env.PATH].join(':');
  fs.mkdirSync(path.join(PROJ, 'data'), { recursive: true });
  const log = fs.openSync(path.join(PROJ, 'data', 'server.log'), 'a');
  server = spawn(node, ['--disable-warning=ExperimentalWarning', 'server/index.js'], { cwd: PROJ, env, stdio: ['ignore', log, log] });
  server.on('exit', () => { server = null; });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await status()) return;
    if (!server) break;
  }
  throw new Error('Il server non è partito. I dettagli sono in data/server.log nella cartella del progetto.');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640,
    title: 'chatStorm',
    backgroundColor: '#F6F7FF',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  // i link esterni si aprono nel browser, la finestra resta sull'app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(URL)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadURL(URL);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  if (process.platform === 'darwin' && !icon.isEmpty()) app.dock.setIcon(icon);
  try {
    await ensureServer();
    createWindow();
  } catch (e) {
    dialog.showErrorBox('chatStorm non è partito', String(e.message || e));
    app.quit();
  }
});

app.on('activate', () => { if (!win && app.isReady()) createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (server) { try { server.kill('SIGTERM'); } catch {} } });

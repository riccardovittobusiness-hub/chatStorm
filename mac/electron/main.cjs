// chatStorm come app desktop, autonoma: dentro l'app ci sono l'interfaccia, il motore e Codex.
// All'avvio fa partire il motore con il Node di Electron (non serve installare Node), apre una finestra nativa
// e lo spegne all'uscita. Niente porte né localhost: il motore ascolta su un socket locale (un file leggibile
// solo dal tuo utente) e la finestra carica chatstorm://app, che questa app gira al motore.
// Mappe e chat stanno in ~/Library/Application Support/chatStorm/data.
const { app, BrowserWindow, shell, dialog, nativeImage, protocol } = require('electron');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setName('chatStorm');
const HOME = app.getPath('home');
const APP_ROOT = app.getAppPath();                        // nell'app: Contents/Resources/app; in sviluppo: la cartella del progetto
const USER_DIR = app.getPath('userData');                 // ~/Library/Application Support/chatStorm
const DATA = path.join(USER_DIR, 'data');
const SCHEME = 'chatstorm';
const URL = `${SCHEME}://app`;
// socket del motore: nella cartella dati dell'app (percorso corto, come richiede macOS)
const SOCK = path.join(USER_DIR, 'motore.sock');

// chatstorm:// si comporta come un sito sicuro: fetch, stream, archiviazione locale
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

let server = null;
let win = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function status() {
  return new Promise((resolve) => {
    const req = http.get({ socketPath: SOCK, path: '/api/status', timeout: 800 }, (res) => {
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
    const req = http.request({ socketPath: SOCK, path: p, method: 'POST', timeout: 1500 }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve); req.on('timeout', () => { req.destroy(); resolve(); });
    req.end();
  });
}

/** Chi aveva installato chatStorm dalla cartella del progetto (~/chatStorm) ritrova mappe e chat: le copio una volta. */
function adoptOldData() {
  if (fs.existsSync(path.join(DATA, 'canvas.db'))) return;
  const old = path.join(HOME, 'chatStorm', 'data');
  if (!fs.existsSync(path.join(old, 'canvas.db'))) return;
  try {
    fs.cpSync(old, DATA, { recursive: true, filter: (src) => !/(\.log|\.sock|app-build[^/]*)$/.test(src) });
  } catch (e) { console.error('[dati] copia dei vecchi dati non riuscita:', e.message); }
}

async function ensureServer() {
  if (await status()) {                                  // motore rimasto acceso da una chiusura brusca: lo spengo
    await post('/api/shutdown');
    for (let i = 0; i < 20 && await status(); i++) await sleep(250);
  }
  const entry = path.join(APP_ROOT, 'server', 'index.js');
  if (!fs.existsSync(entry)) throw new Error("L'app è incompleta: scarica di nuovo chatStorm.");
  fs.mkdirSync(DATA, { recursive: true });
  adoptOldData();
  try { fs.unlinkSync(SOCK); } catch {}                 // socket di una chiusura brusca: nessuno lo usa
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_NO_WARNINGS: '1',
    CHATSTORM_SOCKET: SOCK, CANVAS_DATA_DIR: DATA, CHATSTORM_VERSION: app.getVersion() };
  delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY;   // usa l'abbonamento ChatGPT, non una API key a consumo
  env.PATH = [env.PATH, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].filter(Boolean).join(':');
  const logFile = path.join(DATA, 'server.log');
  try { if (fs.statSync(logFile).size > 2e6) fs.unlinkSync(logFile); } catch {}
  const log = fs.openSync(logFile, 'a');
  // il motore gira nel Node incluso in Electron: è lo stesso programma dell'app, avviato in modalità Node
  server = spawn(process.execPath, [entry], { cwd: DATA, env, stdio: ['ignore', log, log] });
  server.on('exit', () => { server = null; });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await status()) return;
    if (!server) break;
  }
  throw new Error(`Il motore non è partito. I dettagli sono in ${logFile}`);
}

const NO_BODY = new Set([101, 204, 205, 304]);
/** Gira una richiesta della finestra (chatstorm://app/...) al motore sul socket, in streaming. */
async function proxy(request) {
  const u = new globalThis.URL(request.url);
  const body = ['GET', 'HEAD'].includes(request.method) ? null : Buffer.from(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);
  headers.host = 'chatstorm';
  if (body) headers['content-length'] = String(body.length);
  return new Promise((resolve) => {
    const req = http.request({ socketPath: SOCK, path: u.pathname + u.search, method: request.method, headers }, (res) => {
      const h = new Headers();
      for (const [k, v] of Object.entries(res.headers)) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
      if (NO_BODY.has(res.statusCode) || request.method === 'HEAD') { res.resume(); return resolve(new Response(null, { status: res.statusCode, headers: h })); }
      resolve(new Response(Readable.toWeb(res), { status: res.statusCode, headers: h }));
    });
    req.on('error', () => resolve(new Response('Il motore di chatStorm non risponde. Chiudi e riapri l\'app.', { status: 502 })));
    req.end(body || undefined);
  });
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

// una sola copia aperta: una seconda riporta in primo piano la finestra
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  if (!single) return;
  if (!app.isPackaged && process.platform === 'darwin') {       // in sviluppo l'icona va messa a mano
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }
  try {
    protocol.handle(SCHEME, proxy);
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

// Avviso di nuove versioni: all'avvio l'app chiede a GitHub qual è l'ultima versione pubblicata di chatStorm.
// Non invia nessun dato dell'utente: è una semplice lettura di un indirizzo pubblico.
const LATEST = 'https://api.github.com/repos/riccardovittobusiness-hub/chatStorm/releases/latest';
const DOWNLOADS = 'https://github.com/riccardovittobusiness-hub/chatStorm/releases/';
let cache = null;       // { at, data }

const parts = (v) => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
export function newer(a, b) {               // a è più recente di b?
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

export async function checkUpdate(current) {
  if (!current) return { current, latest: null };
  if (cache && Date.now() - cache.at < 6 * 3600e3) return cache.data;
  let data = { current, latest: null };
  try {
    const res = await fetch(LATEST, { headers: { 'User-Agent': 'chatStorm', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const rel = await res.json();
      const latest = String(rel.tag_name || '').replace(/^v/, '');
      if (/^\d+\.\d+(\.\d+)?$/.test(latest) && newer(latest, current)) {
        const asset = (rel.assets || []).find(a => a.name === `chatStorm-${process.arch}.dmg`);
        const url = [asset?.browser_download_url, rel.html_url].find(u => typeof u === 'string' && u.startsWith(DOWNLOADS));
        if (url) data = { current, latest, url };
      }
    }
  } catch {}                       // senza rete, o GitHub non risponde: nessun avviso
  cache = { at: Date.now(), data };
  return data;
}

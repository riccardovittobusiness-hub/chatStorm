// Generazione delle icone. Provider: Pollinations (chiave facoltativa) o Cloudflare Workers AI.
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_DIR } from './db.js';
import { MOCK } from './model.js';

const SIZE = 512;

export async function generateImage(prompt, settings) {
  const provider = settings.imageProvider;
  if (provider === 'none') throw new Error('Generazione immagini disattivata nelle impostazioni');
  if (MOCK && !settings.pollinationsKey && !settings.cloudflareToken) return mockImage(prompt);
  if (provider === 'cloudflare') return cloudflare(prompt, settings);
  return pollinations(prompt, settings);
}

async function pollinations(prompt, settings) {
  const seed = Math.floor(Math.random() * 1e9);
  const p = encodeURIComponent(prompt);
  let url, headers = {};
  if (settings.pollinationsKey) {
    // API nuova con chiave (enter.pollinations.ai)
    url = `https://gen.pollinations.ai/image/${p}?model=flux&width=${SIZE}&height=${SIZE}&seed=${seed}&nologo=true`;
    headers.Authorization = `Bearer ${settings.pollinationsKey}`;
  } else {
    // endpoint anonimo: 1 richiesta ogni ~15 s, possibile watermark
    url = `https://image.pollinations.ai/prompt/${p}?width=${SIZE}&height=${SIZE}&seed=${seed}&nologo=true`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Pollinations ha risposto ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`Pollinations non ha restituito un'immagine (${type})`);
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return { buffer: Buffer.from(await res.arrayBuffer()), ext };
}

async function cloudflare(prompt, settings) {
  const { cloudflareAccountId: acc, cloudflareToken: token } = settings;
  if (!acc || !token) throw new Error('Inserisci Account ID e API token di Cloudflare nelle impostazioni');
  const url = `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 6, seed: Math.floor(Math.random() * 1e9) }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.result?.image) {
    const msg = data?.errors?.map(e => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return { buffer: Buffer.from(data.result.image, 'base64'), ext: 'jpg' };
}

// Icona SVG di prova (modalità simulata senza chiavi)
function mockImage(prompt) {
  let h = 0; for (const c of prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = 190 + (h % 60), hue2 = hue + 25;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${hue2},70%,45%)"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/>
<circle cx="50" cy="44" r="${18 + (h % 8)}" fill="rgba(255,255,255,.85)"/>
<rect x="38" y="64" width="24" height="10" rx="3" fill="rgba(255,255,255,.7)"/></svg>`;
  return { buffer: Buffer.from(svg), ext: 'svg' };
}

export function saveIcon(chatId, { buffer, ext }, oldPath) {
  const name = `${chatId}-${Date.now()}.${ext}`;
  writeFileSync(join(ICON_DIR, name), buffer);
  if (oldPath) {
    const old = join(ICON_DIR, oldPath.split('/').pop());
    if (existsSync(old)) try { unlinkSync(old); } catch {}
  }
  return `/icons/${name}`;
}

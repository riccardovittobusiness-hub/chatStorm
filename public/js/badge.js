// Badge standard per le chat: numero, lettere o simbolo, con forma, colore e stile modificabili.
export const BADGE_COLORS = ['#1F57E0', '#2E9BEA', '#119C9C', '#2F9E5B', '#6A55D0', '#D2527A', '#E0584A', '#E08A1F', '#5F7393', '#0E1F3D'];
export const SHAPES = { squircle: 'Arrotondato', circle: 'Cerchio', square: 'Quadrato', hexagon: 'Esagono', diamond: 'Rombo' };
export const KINDS = { letters: 'Lettere', number: 'Numero', symbol: 'Simbolo' };

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function hashOf(s = '') { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
export function initials(title = '') {
  const w = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
}

/** Mescola un colore esadecimale con bianco (amt > 0) o nero (amt < 0). */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt > 0 ? 255 : 0, a = Math.abs(amt);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function defaultBadge(chat) {
  return { kind: 'letters', text: initials(chat?.title), shape: 'squircle', color: BADGE_COLORS[hashOf(chat?.id || '') % 6], style: 'gradient' };
}
/** Badge effettivo della chat (quello salvato, completato con i valori predefiniti). */
export function badgeOf(chat) {
  let saved = {};
  try { saved = chat?.badge ? (typeof chat.badge === 'string' ? JSON.parse(chat.badge) : chat.badge) : {}; } catch {}
  const b = { ...defaultBadge(chat), ...saved };
  if (b.kind === 'letters' && !saved.text) b.text = initials(chat?.title);
  return b;
}
export const badgeText = (b) => String(b.text ?? '').slice(0, b.kind === 'symbol' ? 4 : 3) || '?';
export const badgeFill = (b) => b.style === 'solid' ? b.color : `linear-gradient(140deg, ${shade(b.color, 0.28)} 0%, ${b.color} 55%, ${shade(b.color, -0.35)} 100%)`;

export function badgeHTML(b) {
  const t = badgeText(b);
  const len = [...t].length;
  const size = b.kind === 'symbol' ? 46 : len >= 3 ? 30 : len === 2 ? 38 : 48;
  return `<div class="bdg bdg-${esc(b.shape)}" style="background:${badgeFill(b)}"><span style="font-size:${size}cqw">${esc(t)}</span></div>`;
}

/** Tracciato della forma in un quadrato (x, y, s), per <canvas>. */
export function shapePath(g, shape, x, y, s) {
  g.beginPath();
  if (shape === 'circle') g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  else if (shape === 'hexagon') { const p = [[.25, .03], [.75, .03], [1, .5], [.75, .97], [.25, .97], [0, .5]]; p.forEach(([a, b], i) => g[i ? 'lineTo' : 'moveTo'](x + a * s, y + b * s)); g.closePath(); }
  else if (shape === 'diamond') { g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s / 2); g.lineTo(x + s / 2, y + s); g.lineTo(x, y + s / 2); g.closePath(); }
  else g.roundRect(x, y, s, s, s * (shape === 'square' ? 0.08 : 0.24));
}

export function drawBadge(g, b, x, y, s, font = "'Bricolage Grotesque', system-ui, sans-serif") {
  shapePath(g, b.shape, x, y, s);
  if (b.style === 'solid') g.fillStyle = b.color;
  else {
    const gr = g.createLinearGradient(x, y, x + s, y + s);
    gr.addColorStop(0, shade(b.color, 0.28)); gr.addColorStop(0.55, b.color); gr.addColorStop(1, shade(b.color, -0.35));
    g.fillStyle = gr;
  }
  g.fill();
  const t = badgeText(b), len = [...t].length;
  const k = b.kind === 'symbol' ? 0.46 : len >= 3 ? 0.30 : len === 2 ? 0.38 : 0.48;
  g.fillStyle = '#fff'; g.font = `700 ${s * k}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(t, x + s / 2, y + s / 2 + s * 0.02);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

/** Cosa mostrare come icona: { type: 'img', src } oppure { type: 'badge', badge }. */
export function iconSpec(chat) {
  if (chat && chat.icon_mode !== 'badge' && chat.icon_path) return { type: 'img', src: chat.icon_path };
  return { type: 'badge', badge: badgeOf(chat) };
}

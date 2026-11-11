// Anteprima di una mappa disegnata su <canvas> (usata nella vista d'insieme).
import * as G from './geom.js';
import { COLORS, FRAME_COLORS, EDGE_COLORS } from './board.js';
import { iconSpec, drawBadge } from './badge.js';
import { plain } from './md.js';

const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  }
  return imgCache.get(src);
}

/** Disegna `state` dentro `canvas` (dimensioni in pixel del canvas). */
export async function drawThumb(canvas, state, getChat) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // superficie
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#F5F9FF'); bg.addColorStop(1, '#E8F2FF');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(150,185,225,.45)';
  const step = W / 40;
  for (let x = step / 2; x < W; x += step) for (let y = step / 2; y < H; y += step) g.fillRect(x, y, 1.6, 1.6);

  const items = state?.items || [];
  const u = G.unionBounds(items);
  if (!u) {
    g.fillStyle = '#8FA3C0'; g.font = `500 ${W / 26}px 'Instrument Sans', system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText('Mappa vuota', W / 2, H / 2); g.textAlign = 'left';
    return;
  }
  const pad = W * 0.07;
  const s = Math.min((W - pad * 2) / u.w, (H - pad * 2) / u.h, 1.6);
  g.save();
  g.translate(W / 2 - (u.x + u.w / 2) * s, H / 2 - (u.y + u.h / 2) * s);
  g.scale(s, s);
  const lw = 1 / s;                                   // spessori costanti in pixel
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  for (const it of items.filter(i => i.type === 'frame')) {
    const c = FRAME_COLORS[it.color] || FRAME_COLORS.blue;
    g.fillStyle = c + '14'; g.strokeStyle = c; g.lineWidth = 2.5 * lw;
    rr(it.x, it.y, it.w, it.h, 16); g.fill(); g.stroke();
    g.fillStyle = c; rr(it.x + 10, it.y - 15, Math.min(it.w - 20, 40 + (it.text || '').length * 8), 30, 15); g.fill();
  }
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  for (const e of state.edges || []) {
    const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
    const geo = G.edgeGeometry(G.bounds(a), G.bounds(b), e.shape);
    const col = e.status === 'suggested' ? '#E0A100' : (EDGE_COLORS[e.color] || EDGE_COLORS.gray);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.2 * lw;
    g.stroke(new Path2D(geo.d));
    if (e.arrow !== 'none') g.fill(new Path2D(G.arrowHead(geo.end, 11 * Math.max(1, lw))));
  }
  const pending = [];
  for (const it of items.filter(i => i.type !== 'frame')) {
    if (it.type === 'chat') {
      const chat = getChat(it.chatId);
      const spec = iconSpec(chat || { id: it.chatId, title: '?' });
      g.save();
      g.shadowColor = 'rgba(12,42,91,.35)'; g.shadowBlur = 14 * s; g.shadowOffsetY = 5 * s;
      if (spec.type === 'badge') drawBadge(g, spec.badge, it.x, it.y, it.w);
      else { g.fillStyle = '#5C8FD8'; rr(it.x, it.y, it.w, it.w, it.w * 0.24); g.fill(); }
      g.restore();
      if (spec.type === 'img') pending.push(loadImg(spec.src).then(im => ({ im, it })));
      if (s > 0.35) {
        g.fillStyle = '#0E1F3D'; g.font = `500 ${13}px 'Instrument Sans', system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText((chat?.title || '').slice(0, 22), it.x + it.w / 2, it.y + it.w + 18); g.textAlign = 'left';
      }
    } else if (it.type === 'note') {
      g.save();
      g.shadowColor = 'rgba(12,42,91,.25)'; g.shadowBlur = 10 * s; g.shadowOffsetY = 4 * s;
      g.fillStyle = COLORS[it.color] || COLORS.blue; g.fillRect(it.x, it.y, it.w, it.h);
      g.restore();
      g.fillStyle = 'rgba(14,31,61,.35)';
      const lines = Math.min(Math.floor((it.h - 26) / 20), Math.ceil(plain(it.text || '').length / 30));
      for (let i = 0; i < lines; i++) g.fillRect(it.x + 13, it.y + 18 + i * 20, (it.w - 26) * (i % 3 === 2 ? 0.6 : 0.9), 7);
    } else if (it.type === 'text') {
      g.fillStyle = 'rgba(12,42,91,.55)'; g.fillRect(it.x + 4, it.y + 8, Math.min(it.w, 14 * (it.text || '').length), 12);
    }
  }
  g.restore();
  // icone: disegnate quando sono caricate
  for (const { im, it } of await Promise.all(pending)) {
    if (!im) continue;
    g.save();
    g.translate(W / 2 - (u.x + u.w / 2) * s, H / 2 - (u.y + u.h / 2) * s); g.scale(s, s);
    rr(it.x, it.y, it.w, it.w, it.w * 0.24); g.clip();
    g.drawImage(im, it.x, it.y, it.w, it.w);
    g.restore();
  }
}

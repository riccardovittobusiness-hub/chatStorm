// Geometria: ingombri, frecce, allineamenti e layout automatici.
export const LABEL_H = 38;
export const GRID = 20;

export function bounds(it) {
  if (it.type === 'chat') return { x: it.x, y: it.y, w: it.w, h: it.w + LABEL_H };
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}
export const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export function unionBounds(items) {
  if (!items.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const it of items) {
    const b = bounds(it);
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export const contains = (outer, b) => {
  const c = center(b);
  return c.x > outer.x && c.x < outer.x + outer.w && c.y > outer.y && c.y < outer.y + outer.h;
};
export const snap = (v) => Math.round(v / GRID) * GRID;

// ---------- Frecce ----------
function anchor(b, side) {
  switch (side) {
    case 'left': return { x: b.x, y: b.y + b.h / 2, nx: -1, ny: 0 };
    case 'right': return { x: b.x + b.w, y: b.y + b.h / 2, nx: 1, ny: 0 };
    case 'top': return { x: b.x + b.w / 2, y: b.y, nx: 0, ny: -1 };
    default: return { x: b.x + b.w / 2, y: b.y + b.h, nx: 0, ny: 1 };
  }
}
function sides(a, b) {
  const ca = center(a), cb = center(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const horiz = Math.abs(dx) / (a.w + b.w) > Math.abs(dy) / (a.h + b.h);
  if (horiz) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
  return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** Calcola tracciato, punto medio e direzioni delle punte. `b` può essere un punto {x,y}. */
export function edgeGeometry(a, b, shape = 'curved') {
  const pointB = b.w === undefined;
  const bb = pointB ? { x: b.x, y: b.y, w: 0, h: 0 } : b;
  const [sa, sb] = sides(a, bb);
  const s = anchor(a, sa);
  const e = pointB ? { x: b.x, y: b.y, nx: -s.nx, ny: -s.ny } : anchor(bb, sb);
  const dist = Math.hypot(e.x - s.x, e.y - s.y);
  let d, mid, endAngle, startAngle;
  if (shape === 'straight') {
    d = `M${s.x},${s.y} L${e.x},${e.y}`;
    mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    endAngle = Math.atan2(e.y - s.y, e.x - s.x);
    startAngle = endAngle + Math.PI;
  } else if (shape === 'elbow') {
    const horiz = sa === 'left' || sa === 'right';
    let pts;
    if (horiz) { const mx = (s.x + e.x) / 2; pts = [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e]; }
    else { const my = (s.y + e.y) / 2; pts = [s, { x: s.x, y: my }, { x: e.x, y: my }, e]; }
    d = 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
    mid = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
    endAngle = Math.atan2(e.y - pts[2].y, e.x - pts[2].x);
    startAngle = Math.atan2(s.y - pts[1].y, s.x - pts[1].x);
    if (pts[2].x === e.x && pts[2].y === e.y) endAngle = Math.atan2(e.y - pts[1].y, e.x - pts[1].x);
  } else {
    const k = Math.max(40, dist * 0.4);
    const c1 = { x: s.x + s.nx * k, y: s.y + s.ny * k };
    const c2 = { x: e.x + e.nx * k, y: e.y + e.ny * k };
    d = `M${s.x},${s.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${e.x},${e.y}`;
    mid = { x: 0.125 * s.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * e.x, y: 0.125 * s.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * e.y };
    endAngle = Math.atan2(e.y - c2.y, e.x - c2.x);
    startAngle = Math.atan2(s.y - c1.y, s.x - c1.x);
  }
  return { d, mid, start: { x: s.x, y: s.y, angle: startAngle }, end: { x: e.x, y: e.y, angle: endAngle } };
}

export function arrowHead(p, size = 11) {
  const a = p.angle, w = 0.45;
  const x1 = p.x - size * Math.cos(a - w), y1 = p.y - size * Math.sin(a - w);
  const x2 = p.x - size * Math.cos(a + w), y2 = p.y - size * Math.sin(a + w);
  return `M${p.x},${p.y} L${x1},${y1} L${x2},${y2} Z`;
}

// ---------- Allineamenti (modificano x/y degli elementi) ----------
export function align(items, how) {
  if (items.length < 2) return;
  const u = unionBounds(items);
  for (const it of items) {
    const b = bounds(it);
    if (how === 'left') it.x = u.x;
    if (how === 'right') it.x = u.x + u.w - b.w;
    if (how === 'centerH') it.x = u.x + u.w / 2 - b.w / 2;
    if (how === 'top') it.y = u.y;
    if (how === 'bottom') it.y = u.y + u.h - b.h;
    if (how === 'centerV') it.y = u.y + u.h / 2 - b.h / 2;
  }
}

export function distribute(items, axis) {
  if (items.length < 3) return;
  const key = axis === 'h' ? 'x' : 'y', dim = axis === 'h' ? 'w' : 'h';
  const sorted = [...items].sort((a, b) => bounds(a)[key] - bounds(b)[key]);
  const u = unionBounds(items);
  const total = sorted.reduce((s, it) => s + bounds(it)[dim], 0);
  const gap = (u[dim] - total) / (sorted.length - 1);
  let pos = u[key];
  for (const it of sorted) { it[key] = pos; pos += bounds(it)[dim] + gap; }
}

export function gridLayout(items, { gap = 50, origin } = {}) {
  if (!items.length) return;
  const u = origin || unionBounds(items);
  const cols = Math.ceil(Math.sqrt(items.length * 1.4));
  const cellW = Math.max(...items.map(i => bounds(i).w)) + gap;
  const cellH = Math.max(...items.map(i => bounds(i).h)) + gap;
  const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  sorted.forEach((it, i) => {
    const b = bounds(it);
    it.x = u.x + (i % cols) * cellW + (cellW - gap - b.w) / 2;
    it.y = u.y + Math.floor(i / cols) * cellH;
  });
  return { cols, rows: Math.ceil(items.length / cols), cellW, cellH };
}

/** Albero a livelli da sinistra a destra, seguendo il verso delle frecce. */
export function treeLayout(items, edges, { gapX = 110, gapY = 40 } = {}) {
  if (!items.length) return;
  const u = unionBounds(items);
  const ids = new Set(items.map(i => i.id));
  const E = edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && e.status !== 'suggested');
  const out = new Map(items.map(i => [i.id, []])), inc = new Map(items.map(i => [i.id, []]));
  for (const e of E) { out.get(e.from).push(e.to); inc.get(e.to).push(e.from); }
  const level = new Map();
  const connected = items.filter(i => out.get(i.id).length || inc.get(i.id).length);
  const isolated = items.filter(i => !out.get(i.id).length && !inc.get(i.id).length);
  let roots = connected.filter(i => !inc.get(i.id).length);
  if (!roots.length && connected.length) roots = [connected[0]];
  const queue = roots.map(r => (level.set(r.id, 0), r.id));
  while (queue.length) {                       // BFS: livello minimo, nessun ciclo infinito
    const id = queue.shift();
    for (const n of out.get(id)) if (!level.has(n)) { level.set(n, level.get(id) + 1); queue.push(n); }
  }
  for (const i of connected) if (!level.has(i.id)) level.set(i.id, 0);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const levels = [];
  for (const [id, l] of level) (levels[l] ||= []).push(byId[id]);
  // ordina per baricentro dei genitori
  const order = new Map();
  levels.forEach((lv, li) => {
    if (li > 0) lv.sort((a, b) => bary(a) - bary(b));
    lv.forEach((it, k) => order.set(it.id, k));
    function bary(it) { const p = inc.get(it.id).filter(x => order.has(x)); return p.length ? p.reduce((s, x) => s + order.get(x), 0) / p.length : 1e9; }
  });
  let x = u.x, maxBottom = u.y;
  const heights = levels.map(lv => lv.reduce((s, it) => s + bounds(it).h + gapY, -gapY));
  const tallest = Math.max(0, ...heights);
  levels.forEach((lv, li) => {
    const colW = Math.max(...lv.map(i => bounds(i).w));
    let y = u.y + (tallest - heights[li]) / 2;
    for (const it of lv) {
      const b = bounds(it);
      it.x = x + (colW - b.w) / 2; it.y = y; y += b.h + gapY;
      maxBottom = Math.max(maxBottom, it.y + b.h);
    }
    x += colW + gapX;
  });
  if (isolated.length) gridLayout(isolated, { origin: { x: u.x, y: (levels.length ? maxBottom : u.y) + 80 } });
}

/** Grafo a forze: i nodi collegati si avvicinano, gli altri si respingono. */
export function forceLayout(items, edges) {
  if (items.length < 2) return;
  const u = unionBounds(items);
  const cx0 = u.x + u.w / 2, cy0 = u.y + u.h / 2;
  const ids = new Set(items.map(i => i.id));
  const E = edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.status !== 'suggested');
  const P = new Map(items.map(it => { const c = center(bounds(it)); return [it.id, { x: c.x + Math.random(), y: c.y + Math.random(), r: Math.max(bounds(it).w, bounds(it).h) / 2 }]; }));
  const K = 220;
  for (let iter = 0, temp = 120; iter < 400; iter++, temp *= 0.985) {
    const disp = new Map(items.map(i => [i.id, { x: 0, y: 0 }]));
    for (const a of items) for (const b of items) {
      if (a.id >= b.id) continue;
      const pa = P.get(a.id), pb = P.get(b.id);
      let dx = pa.x - pb.x, dy = pa.y - pb.y, d = Math.hypot(dx, dy) || 0.1;
      const minD = pa.r + pb.r + 40;
      const f = (K * K) / d + (d < minD ? (minD - d) * 4 : 0);
      dx /= d; dy /= d;
      disp.get(a.id).x += dx * f; disp.get(a.id).y += dy * f;
      disp.get(b.id).x -= dx * f; disp.get(b.id).y -= dy * f;
    }
    for (const e of E) {
      const pa = P.get(e.from), pb = P.get(e.to);
      let dx = pa.x - pb.x, dy = pa.y - pb.y, d = Math.hypot(dx, dy) || 0.1;
      const f = (d * d) / K;
      dx /= d; dy /= d;
      disp.get(e.from).x -= dx * f; disp.get(e.from).y -= dy * f;
      disp.get(e.to).x += dx * f; disp.get(e.to).y += dy * f;
    }
    for (const it of items) {                  // leggera gravità verso il centro
      const p = P.get(it.id), dv = disp.get(it.id);
      dv.x += (cx0 - p.x) * 0.02 * K / 10; dv.y += (cy0 - p.y) * 0.02 * K / 10;
      const len = Math.hypot(dv.x, dv.y) || 1;
      p.x += (dv.x / len) * Math.min(len, temp); p.y += (dv.y / len) * Math.min(len, temp);
    }
  }
  for (const it of items) {
    const p = P.get(it.id), b = bounds(it);
    it.x = Math.round(p.x - b.w / 2); it.y = Math.round(p.y - b.h / 2);
  }
}

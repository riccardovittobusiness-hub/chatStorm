// Vista d'insieme: le mappe si staccano dal piano e si dispongono su un anello 3D.
import { drawThumb } from './thumb.js';
import { t, tn } from './i18n.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class Overview {
  constructor(o) {
    this.o = o; // { boards(): [{id,name,chat_count}], states(): Promise<Map>, currentId(), getChat, onOpen(id), onNew() }
    this.el = $('overview'); this.scene = $('ov-scene'); this.ring = $('ov-ring');
    this.angle = 0; this.step = 360; this.items = [];
    $('ov-close').onclick = () => this.close();
    $('ov-prev').onclick = () => this.spin(-1);
    $('ov-next').onclick = () => this.spin(1);
    this.scene.addEventListener('pointerdown', (e) => this.onDown(e));
    this.scene.addEventListener('pointermove', (e) => this.onMove(e));
    this.scene.addEventListener('pointerup', (e) => this.onUp(e));
    this.scene.addEventListener('wheel', (e) => { e.preventDefault(); this.wheelAcc = (this.wheelAcc || 0) + e.deltaX + e.deltaY; if (Math.abs(this.wheelAcc) > 60) { this.spin(Math.sign(this.wheelAcc)); this.wheelAcc = 0; } }, { passive: false });
    window.addEventListener('resize', () => { if (this.isOpen) this.layout(); });
  }
  get isOpen() { return !this.el.hidden; }

  async open() {
    if (this.isOpen) return;
    const states = await this.o.states();
    this.items = [...this.o.boards().map(b => ({ kind: 'board', ...b, state: states.get(b.id) })), { kind: 'new' }];
    this.el.hidden = false;
    this.build();
    const cur = this.items.findIndex(i => i.id === this.o.currentId());
    this.index = Math.max(0, cur);
    this.angle = -this.index * this.step;
    this.apply(false);
    if (!reduceMotion.matches) {
      this.scene.animate([{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
      $('plane').animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.82)', opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished
        .then(a => a.cancel?.()).catch(() => {});
    }
    this.el.focus();
  }

  async close({ flyIn = true } = {}) {
    if (!this.isOpen) return;
    if (!reduceMotion.matches) {
      await this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' }).finished;
      if (flyIn) $('plane').animate([{ transform: 'scale(.86)', opacity: .2 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    this.el.hidden = true;
    this.ring.innerHTML = '';
  }

  build() {
    const n = this.items.length;
    this.step = 360 / n;
    this.ring.innerHTML = '';
    this.cards = this.items.map((it, i) => {
      const card = document.createElement('div');
      card.dataset.current = t('Aperta ora');
      card.className = 'ov-card' + (it.kind === 'new' ? ' new' : '') + (it.id === this.o.currentId() ? ' current' : '');
      card.dataset.i = i;
      if (it.kind === 'new') {
        card.innerHTML = `<div class="ov-new"><span>＋</span>${t('Nuova mappa')}</div>`;
      } else {
        card.innerHTML = `<canvas></canvas><div class="cap"><b></b><small>${tn(it.chat_count || 0, '1 chat', '{n} chat')}</small></div>`;
        card.querySelector('b').textContent = it.name;
      }
      this.ring.appendChild(card);
      return card;
    });
    this.layout();
  }

  layout() {
    const n = this.items.length;
    const W = this.scene.clientWidth, H = this.scene.clientHeight;
    const cw = Math.round(Math.max(240, Math.min(540, W * 0.38, (H - 150) * 1.2)));
    const ch = Math.round(cw * 0.62);
    this.R = n > 2 ? (cw / 2 + 110) / Math.tan(Math.PI / n) : n === 2 ? cw * 0.9 : 0;
    // allontana l'anello se le schede laterali uscirebbero dallo schermo
    const P = 2000, maxX = W / 2 - cw / 2 - 20;
    this.push = Math.max(0, this.R * P / Math.max(maxX, 1) - P - this.R);
    this.cards.forEach((card, i) => {
      Object.assign(card.style, { width: cw + 'px', height: ch + 'px', left: -cw / 2 + 'px', top: -ch / 2 + 'px',
        transform: `rotateY(${i * this.step}deg) translateZ(${this.R}px)` });
      const cv = card.querySelector('canvas');
      if (cv) {
        const dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = cw * dpr; cv.height = ch * dpr;
        drawThumb(cv, this.items[i].state, this.o.getChat);
      }
    });
    this.apply(false);
  }

  apply(animate = true) {
    this.ring.classList.toggle('anim', animate && !reduceMotion.matches);
    this.ring.style.transform = `translateZ(${-this.R - this.push}px) rotateX(-14deg) rotateY(${this.angle}deg)`;
    const n = this.items.length;
    this.index = ((Math.round(-this.angle / this.step) % n) + n) % n;
    this.cards.forEach((card, i) => {
      const rel = ((i * this.step + this.angle) % 360 + 540) % 360 - 180;   // -180..180, 0 = di fronte
      const facing = Math.cos(rel * Math.PI / 180);
      card.style.opacity = n === 1 ? 1 : Math.max(0.12, 0.25 + 0.75 * Math.max(0, facing));
      card.classList.toggle('front', i === this.index);
      card.classList.toggle('away', n > 1 && facing < 0.25);
    });
    const it = this.items[this.index];
    $('ov-title').textContent = it?.kind === 'new' ? t('Crea una nuova mappa') : it?.name || '';
  }

  spin(dir) { this.angle -= dir * this.step; this.apply(); }
  spinTo(i) {
    const target = -i * this.step;
    let d = ((target - this.angle) % 360 + 540) % 360 - 180;   // percorso più breve
    this.angle += d; this.apply();
  }
  openFront() { this.activate(this.index); }

  activate(i) {
    const it = this.items[i];
    const go = () => it.kind === 'new' ? this.o.onNew() : this.o.onOpen(it.id);
    if (i === this.index) return go();
    this.spinTo(i);
    setTimeout(go, reduceMotion.matches ? 0 : 480);
  }

  onDown(e) {
    if (e.button !== 0) return;
    this.drag = { x: e.clientX, angle: this.angle, moved: false, card: e.target.closest('.ov-card') };
    this.scene.setPointerCapture(e.pointerId);
  }
  onMove(e) {
    const d = this.drag; if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    d.moved = true; this.scene.classList.add('dragging');
    this.angle = d.angle + dx * 0.22;
    this.apply(false);
  }
  onUp() {
    const d = this.drag; this.drag = null;
    this.scene.classList.remove('dragging');
    if (!d) return;
    if (d.moved) { this.angle = Math.round(this.angle / this.step) * this.step; this.apply(); return; }
    if (d.card) this.activate(Number(d.card.dataset.i));
  }

  /** Tastiera quando la vista è aperta. Restituisce true se ha gestito il tasto. */
  onKey(e) {
    const k = e.key;
    if (k === 'Escape' || k === 'm' || k === 'M') { this.close(); return true; }
    if (k === 'ArrowLeft' || k === 'q' || k === 'Q') { this.spin(-1); return true; }
    if (k === 'ArrowRight' || k === 'e' || k === 'E') { this.spin(1); return true; }
    if (k === 'Enter' || k === ' ') { this.openFront(); return true; }
    return true;   // blocca le altre scorciatoie della lavagna
  }
}

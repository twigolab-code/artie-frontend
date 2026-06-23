import {
  STAR_RATE,
  STAR_EMIT_EVERY,
  STAR_LIFE,
  STAR_SPEED,
  STAR_SPREAD,
  STAR_SIZE,
  TRAIL_STAR_COLOR,
} from '../config.js';

// =============================================================================
// StarTrail — emettitore di stelle gialle dalla coda del razzo ("fumo di
// stelle", effetto mossa speciale). Le stelle escono all'indietro, ruotano,
// rimpiccioliscono e svaniscono. WORLD-space.
//
// Jitter deterministico (no Math.random): un seed interno incrementale alimenta
// un hash, così l'effetto è ricco ma riproducibile col loop a timestep fisso.
// =============================================================================
function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x); // [0,1)
}

export class StarTrail {
  constructor() {
    this.list = [];
    this._seed = 0;
    this._frame = 0;
  }

  clear() {
    this.list.length = 0;
    this._seed = 0;
    this._frame = 0;
  }

  // Emette stelle rade dalla coda del razzo in (x, y) world-space: solo una
  // ogni STAR_EMIT_EVERY chiamate, così la scia è meno fitta.
  emit(x, y) {
    if (this._frame++ % STAR_EMIT_EVERY !== 0) return;
    for (let k = 0; k < STAR_RATE; k++) {
      const s = this._seed++;
      const r1 = hash(s * 1.7);
      const r2 = hash(s * 2.3 + 5.1);
      const r3 = hash(s * 0.9 + 9.7);
      this.list.push({
        x: x + (r1 - 0.5) * 10,
        y: y + (r2 - 0.5) * 18,
        // Prevalentemente all'indietro (sinistra) + spread verticale.
        vx: -STAR_SPEED * (0.7 + r1 * 0.6),
        vy: (r2 - 0.5) * STAR_SPREAD,
        life: STAR_LIFE * (0.7 + r3 * 0.5),
        max: STAR_LIFE,
        size: STAR_SIZE * (0.6 + r3 * 0.8),
        angle: r1 * Math.PI * 2,
        spin: (r2 - 0.5) * 8, // rad/s
      });
    }
  }

  update(dt) {
    const arr = this.list;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; // decelerazione
      p.vy *= 0.94;
      p.angle += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) arr.splice(i, 1);
    }
  }

  render(renderer, cameraX) {
    const ctx = renderer.ctx;
    for (const p of this.list) {
      const t = Math.max(0, p.life / p.max); // 1 -> 0
      const r = p.size * (0.5 + t * 0.5); // rimpicciolisce verso la fine
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(p.x - cameraX, p.y);
      ctx.rotate(p.angle);

      // Stella piena gialla con glow (niente bordo scuro).
      ctx.shadowColor = TRAIL_STAR_COLOR;
      ctx.shadowBlur = 12 * t;
      this._starPath(ctx, r, r * 0.45);
      ctx.fillStyle = TRAIL_STAR_COLOR;
      ctx.fill();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _starPath(ctx, rOut, rIn) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? rOut : rIn;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

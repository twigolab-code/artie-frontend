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
// StarTrail — emettitore di particelle dalla coda del razzo ("fumo di stelle",
// effetto mossa speciale). Le particelle escono all'indietro, ruotano,
// rimpiccioliscono e svaniscono. WORLD-space.
//
// La FORMA e il COLORE sono per-player (setStyle): Artie = stelle gialle,
// Miles = note musicali gialle (vedi PLAYERS.fx). Default = stella gialla.
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
    this._color = TRAIL_STAR_COLOR; // colore particella (giallo di default)
    this._shape = 'star'; // 'star' | 'note'
  }

  // Imposta il look del particellare (chiamato in main.js dal player attivo).
  setStyle(color, shape) {
    if (color) this._color = color;
    if (shape) this._shape = shape;
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

      // Particella piena con glow (niente bordo scuro): stella o nota musicale.
      ctx.shadowColor = this._color;
      ctx.shadowBlur = 12 * t;
      if (this._shape === 'note') this._notePath(ctx, r);
      else this._starPath(ctx, r, r * 0.45);
      ctx.fillStyle = this._color;
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

  // Nota musicale (croma ♪) centrata in (0,0), scalata su r: testa ovale in
  // basso a sinistra + gambo verticale + bandierina curva. Un'unica path piena.
  _notePath(ctx, r) {
    const headRx = r * 0.55; // semiasse testa
    const headRy = r * 0.42;
    const hx = -r * 0.28; // centro testa (basso-sx)
    const hy = r * 0.6;
    const stemX = hx + headRx * 0.85; // gambo sul lato dx della testa
    const stemTopY = -r * 1.05;
    const stemW = r * 0.16;

    ctx.beginPath();
    // Testa ovale (leggermente inclinata).
    ctx.ellipse(hx, hy, headRx, headRy, -0.35, 0, Math.PI * 2);
    // Gambo (rettangolo verticale) come sotto-path.
    ctx.moveTo(stemX, hy);
    ctx.lineTo(stemX, stemTopY);
    ctx.lineTo(stemX + stemW, stemTopY);
    ctx.lineTo(stemX + stemW, hy - headRy * 0.4);
    ctx.closePath();
    // Bandierina: curva che parte dalla cima del gambo e ricade.
    ctx.moveTo(stemX + stemW, stemTopY);
    ctx.quadraticCurveTo(
      stemX + stemW + r * 0.85, stemTopY + r * 0.35,
      stemX + stemW * 0.4, stemTopY + r * 0.95,
    );
    ctx.quadraticCurveTo(
      stemX + stemW + r * 0.5, stemTopY + r * 0.45,
      stemX + stemW, stemTopY + r * 0.18,
    );
    ctx.closePath();
  }
}

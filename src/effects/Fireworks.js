import { TRAIL_STAR_COLOR } from '../config.js';

// =============================================================================
// Fireworks — "fuochi d'artificio" dell'esultanza di fine livello. Esplosioni
// radiali della FORMA del player (stella per Artie, nota per Miles, gialle) +
// scintille colorate per dare festa. SCREEN-space (overlay di celebrazione, NON
// ancorato alla camera/mondo): render(renderer) NON prende cameraX.
//
// La FORMA e il COLORE sono per-player (setStyle), come in StarTrail.
//
// Jitter deterministico (no Math.random, vedi CLAUDE.md §10): un seed interno
// incrementale alimenta un hash, così l'effetto è ricco ma riproducibile.
// =============================================================================

// Gravità dolce: i fuochi salgono e ricadono lentamente (molto < gravità di gioco).
const FW_GRAVITY = 900; // u/s²
const FW_SPEED = 420; // velocità iniziale base u/s
const FW_LIFE = 1.1; // durata particella (s)
const FW_SIZE = 18; // raggio base delle forme (stella/nota)
const FW_DRAG = 0.96; // decelerazione per frame
const FW_BURST_SHAPES = 12; // forme (stella/nota) per esplosione
const FW_BURST_SPARKS = 8; // scintille quadrate colorate per esplosione

// Colori delle scintille (flair): giallo, rosso, blu, verde, bianco.
const SPARK_COLORS = ['#ffd23f', '#ff3b3b', '#2b54e0', '#5fd000', '#ffffff'];

function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x); // [0,1)
}

export class Fireworks {
  constructor() {
    this.list = [];
    this._seed = 0;
    this._color = TRAIL_STAR_COLOR; // colore delle forme (giallo di default)
    this._shape = 'star'; // 'star' | 'note'
  }

  // Imposta il look (chiamato in main.js dal player attivo, come StarTrail).
  setStyle(color, shape) {
    if (color) this._color = color;
    if (shape) this._shape = shape;
  }

  clear() {
    this.list.length = 0;
    this._seed = 0;
  }

  // Una esplosione radiale in (cx, cy) screen-space: forme del player + scintille.
  burst(cx, cy, seed = 0) {
    // Forme (stella/nota) nel colore del player.
    for (let i = 0; i < FW_BURST_SHAPES; i++) {
      const s = this._seed++;
      const r1 = hash(s * 1.7 + seed);
      const r2 = hash(s * 2.3 + seed * 0.5 + 5.1);
      const r3 = hash(s * 0.9 + seed * 1.3 + 9.7);
      const angle = (i / FW_BURST_SHAPES) * Math.PI * 2 + (r1 - 0.5) * 0.6;
      const speed = FW_SPEED * (0.6 + r2 * 0.7);
      this.list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120, // leggera spinta verso l'alto
        life: FW_LIFE * (0.7 + r3 * 0.5),
        max: FW_LIFE,
        size: FW_SIZE * (0.7 + r3 * 0.6),
        angle: r1 * Math.PI * 2,
        spin: (r2 - 0.5) * 8, // rad/s
        color: this._color,
        shaped: true,
      });
    }
    // Scintille quadrate colorate (flair).
    for (let i = 0; i < FW_BURST_SPARKS; i++) {
      const s = this._seed++;
      const r1 = hash(s * 1.1 + seed + 3.3);
      const r2 = hash(s * 2.7 + seed * 0.7 + 1.9);
      const angle = (i / FW_BURST_SPARKS) * Math.PI * 2 + (r1 - 0.5) * 1.2;
      const speed = FW_SPEED * (0.5 + r2 * 0.9);
      this.list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: FW_LIFE * (0.5 + r1 * 0.5),
        max: FW_LIFE,
        size: 5 + (i % 3) * 2,
        angle: 0,
        spin: 0,
        color: SPARK_COLORS[i % SPARK_COLORS.length],
        shaped: false,
      });
    }
  }

  update(dt) {
    const arr = this.list;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.vy += FW_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= FW_DRAG;
      p.vy *= FW_DRAG;
      p.angle += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) arr.splice(i, 1);
    }
  }

  // SCREEN-space: niente cameraX, le coordinate sono già logiche (1280×720).
  render(renderer) {
    const ctx = renderer.ctx;
    for (const p of this.list) {
      const t = Math.max(0, p.life / p.max); // 1 -> 0
      ctx.save();
      ctx.globalAlpha = t;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12 * t;
      ctx.fillStyle = p.color;
      if (p.shaped) {
        const r = p.size * (0.5 + t * 0.5); // rimpicciolisce verso la fine
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (this._shape === 'note') this._notePath(ctx, r);
        else this._starPath(ctx, r, r * 0.45);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // --- Forme: copia conforme da StarTrail._starPath / _notePath ---------------
  // (Tenute identiche così future modifiche si rispecchiano facilmente.)
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

import {
  TILE,
  COIN_RADIUS,
  COIN_SPIN_SPEED,
  COIN_COLOR,
  COIN_COLOR_LIGHT,
  COIN_COLOR_DARK,
  COIN_EDGE,
  COIN_STAR,
  COIN_STAR_EDGE,
  GLOW_BLUR,
} from '../config.js';
import { COIN_IMG } from '../engine/Assets.js';

// =============================================================================
// Coin — moneta collezionabile (max 5 per livello). In WORLD-space, centrata
// sulla cella (col, row). Si raccoglie al CONTATTO (gestito in main.js) e dà un
// obiettivo extra oltre a finire il percorso.
//
// Ruota su sé stessa a 360° in loop fluido (effetto "coin spin" del GD): la
// larghezza viene scalata da cos(time) così la moneta si assottiglia fino a
// essere "di taglio" e si riallarga, con la faccia che si ribalta a ogni mezzo
// giro. La rotazione è SOLO visiva: la hitbox resta a dimensione piena.
//
// Grafica: usa /coin.png se caricato, altrimenti fallback vettoriale (cerchio
// dorato a gradiente + bordo scuro + stella interna), così funziona da subito.
// =============================================================================
export class Coin {
  constructor(col, row) {
    this.r = COIN_RADIUS;
    this.size = this.r * 2;
    this.cx = col * TILE + TILE / 2;
    this.cy = row * TILE + TILE / 2;
    this.x = this.cx - this.r; // bordo sinistro, per il culling in Level
    this.seed = col * 7 + row * 13; // sfasa la rotazione tra monete diverse
    this._collected = false; // settato a runtime alla raccolta
  }

  // Hitbox piena (NON cambia con la rotazione): raccolta equa anche "di taglio".
  getHitbox() {
    const s = this.size * 0.8;
    return { x: this.cx - s / 2, y: this.cy - s / 2, w: s, h: s };
  }

  render(renderer, cameraX, time = 0) {
    if (this._collected) return;
    const ctx = renderer.ctx;
    const sx = this.cx - cameraX;
    const sy = this.cy;

    // Fattore di scala orizzontale per lo spin (|cos| -> 0 = di taglio, 1 = piena).
    const spin = Math.cos(time * COIN_SPIN_SPEED + this.seed);
    const scaleX = Math.abs(spin);
    const back = spin < 0; // mezza rotazione sul "retro": tinta più scura

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(Math.max(0.06, scaleX), 1); // clamp minimo per non sparire del tutto

    if (COIN_IMG && COIN_IMG.ready) {
      // PNG centrato; lo scaleX del context dà già il giro.
      ctx.drawImage(COIN_IMG.img, -this.r, -this.r, this.size, this.size);
    } else {
      this._drawVector(ctx, back);
    }

    ctx.restore();
  }

  // Fallback vettoriale: disco dorato 3D (gradiente radiale + fascia rialzata)
  // + stella a 5 punte ben visibile (contornata e incisa).
  _drawVector(ctx, back) {
    const r = this.r;

    ctx.shadowColor = COIN_COLOR;
    ctx.shadowBlur = GLOW_BLUR;

    // 1) Bordo/fascia esterna scura (dà spessore: la moneta "sporge").
    ctx.fillStyle = COIN_COLOR_DARK;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2) Faccia interna con gradiente RADIALE (luce in alto a sx -> volume).
    const face = r * 0.82;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, face);
    g.addColorStop(0, back ? COIN_COLOR : COIN_COLOR_LIGHT);
    g.addColorStop(0.55, COIN_COLOR);
    g.addColorStop(1, COIN_COLOR_DARK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, face, 0, Math.PI * 2);
    ctx.fill();

    // 3) Bordo scuro netto attorno alla moneta.
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = COIN_EDGE;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // 4) Stella a 5 punte più GRANDE, con ombra incisa + contorno + riempimento.
    const outer = r * 0.74;
    // Ombra "incassata": stessa stella spostata in basso a dx, scura.
    this._starPath(ctx, outer, r * 0.06, r * 0.06);
    ctx.fillStyle = COIN_STAR_EDGE;
    ctx.fill();
    // Stella piena chiara.
    this._starPath(ctx, outer, 0, 0);
    ctx.fillStyle = COIN_STAR;
    ctx.fill();
    // Contorno scuro per staccarla dal fondo dorato.
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = COIN_STAR_EDGE;
    ctx.stroke();
  }

  // Costruisce il path di una stella a 5 punte (punta in alto), centrata in
  // (ox, oy). `outer` = raggio punte; le rientranze sono a 0.46*outer.
  _starPath(ctx, outer, ox, oy) {
    const inner = outer * 0.46;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = ox + Math.cos(a) * rad;
      const py = oy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

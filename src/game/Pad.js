import { TILE, PAD_COLOR, GLOW_BLUR } from '../config.js';

// =============================================================================
// Pad — jump pad giallo. Al solo contatto (senza premere) lancia il player in
// alto con spinta forte (trigger gestito in main.js). In WORLD-space.
//
// È una piastra bassa appoggiata sul fondo della cella.
// =============================================================================
export class Pad {
  constructor(col, row) {
    this.w = TILE;
    this.h = TILE * 0.28;
    this.x = col * TILE;
    this.y = row * TILE + (TILE - this.h); // appoggiata in fondo alla cella
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  render(renderer, cameraX) {
    const ctx = renderer.ctx;
    const sx = this.x - cameraX;
    const sy = this.y;

    ctx.save();
    ctx.shadowColor = PAD_COLOR;
    ctx.shadowBlur = GLOW_BLUR * 1.5;
    ctx.fillStyle = PAD_COLOR;

    // Piastra con due piccole "alette" trapezoidali (come l'originale).
    ctx.beginPath();
    ctx.moveTo(sx + this.w * 0.1, sy + this.h);
    ctx.lineTo(sx + this.w * 0.25, sy);
    ctx.lineTo(sx + this.w * 0.75, sy);
    ctx.lineTo(sx + this.w * 0.9, sy + this.h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

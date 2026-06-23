import { TILE, ORB_COLOR, ORB_RADIUS, GLOW_BLUR } from '../config.js';

// =============================================================================
// Orb — anello giallo sospeso. Toccandolo e premendo, il player ottiene un
// salto a mezz'aria (trigger gestito in main.js). In WORLD-space.
//
// Centrato sulla cella (col, row). `size` = diametro, usato per il culling.
// =============================================================================
export class Orb {
  constructor(col, row) {
    this.r = ORB_RADIUS;
    this.size = this.r * 2;
    this.cx = col * TILE + TILE / 2;
    this.cy = row * TILE + TILE / 2;
    // x/size per comodità di culling in Level.
    this.x = this.cx - this.r;
  }

  render(renderer, cameraX) {
    const ctx = renderer.ctx;
    const sx = this.cx - cameraX;
    const sy = this.cy;

    ctx.save();
    ctx.shadowColor = ORB_COLOR;
    ctx.shadowBlur = GLOW_BLUR * 1.4;

    // Anello esterno.
    ctx.strokeStyle = ORB_COLOR;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sx, sy, this.r, 0, Math.PI * 2);
    ctx.stroke();

    // Pallino interno.
    ctx.shadowBlur = 0;
    ctx.fillStyle = ORB_COLOR;
    ctx.beginPath();
    ctx.arc(sx, sy, this.r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

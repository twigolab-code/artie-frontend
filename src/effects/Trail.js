import { TRAIL_LENGTH, TRAIL_INTERVAL, TRAIL_CUBE_COLOR, TRAIL_RED_GLOW } from '../config.js';

// =============================================================================
// Trail — scia dietro al player.
//
// CUBO: quadratini rossi che sfumano. RAZZO: una striscia rossa luminosa
// continua (tipo fiamma) che collega i campioni recenti; le stelle gialle del
// razzo sono gestite a parte da StarTrail. Campioni in WORLD-space; ogni
// campione ricorda la modalità per restare coerente dopo un cambio.
// =============================================================================
export class Trail {
  constructor() {
    this.samples = [];
    this._timer = 0;
  }

  reset() {
    this.samples.length = 0;
    this._timer = 0;
  }

  update(dt, player) {
    this._timer += dt;
    if (this._timer < TRAIL_INTERVAL) return;
    this._timer = 0;

    this.samples.unshift({
      x: player.x,
      y: player.y,
      angle: player.angle,
      size: player.size,
      mode: player.mode,
    });
    if (this.samples.length > TRAIL_LENGTH) this.samples.pop();
  }

  // color/glow: look della scia per-player (default = rosso, vedi PLAYERS.fx in
  // main.js). Il cubo decorativo della home usa i default (resta rosso).
  render(renderer, cameraX, color = TRAIL_CUBE_COLOR, glow = TRAIL_RED_GLOW) {
    const ctx = renderer.ctx;
    const n = this.samples.length;
    if (n === 0) return;

    // RAZZO: striscia luminosa continua attraverso i campioni 'ship'.
    if (this.samples[0].mode === 'ship') {
      this._redStreak(ctx, cameraX, color, glow);
    }

    // CUBO: quadratini colorati (solo per i campioni in modalità cubo).
    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      if (s.mode === 'ship') continue;
      const t = 1 - i / n;
      const half = (s.size / 2) * (0.5 + t * 0.4);
      ctx.save();
      ctx.globalAlpha = 0.3 * t;
      ctx.translate(s.x - cameraX + s.size / 2, s.y + s.size / 2);
      ctx.rotate(s.angle);
      ctx.fillStyle = color;
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Striscia luminosa che si assottiglia e sfuma verso la coda.
  _redStreak(ctx, cameraX, color, glow) {
    const pts = [];
    for (const s of this.samples) {
      if (s.mode !== 'ship') break; // solo il segmento ship recente
      pts.push({ x: s.x - cameraX + s.size / 2, y: s.y + s.size / 2 });
    }
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    // Disegna segmenti con larghezza/alpha decrescenti verso la coda.
    for (let i = 0; i < pts.length - 1; i++) {
      const t = 1 - i / pts.length;
      ctx.globalAlpha = 0.55 * t;
      ctx.strokeStyle = color;
      ctx.lineWidth = 26 * t + 4;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

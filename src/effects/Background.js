import { PARALLAX_LAYERS, FLOOR_Y } from '../config.js';

// =============================================================================
// Background — sfondo a parallasse in stile Geometry Dash.
//
// Un gradiente verticale del colore tema fa da base; sopra scorrono più layer
// di grandi "mattoni" rettangolari semi-trasparenti (schiariture), sfalsati per
// riga come un muro, ciascuno a una frazione diversa della velocità camera.
// =============================================================================
export class Background {
  // theme = { top, bottom } colori (già interpolati) del gradiente di sfondo.
  // beatPulse (0..1) fa "respirare" leggermente i mattoni a ritmo.
  render(renderer, cameraX, beatPulse = 0, theme) {
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const bottom = renderer.extBottom;

    // 1) Gradiente di base del tema corrente, esteso a tutto lo schermo reale.
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, theme.top);
    grad.addColorStop(1, theme.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, right - left, bottom - top);

    // 2) Layer di mattoni a parallasse.
    for (const layer of PARALLAX_LAYERS) {
      this._brickLayer(ctx, layer, cameraX, beatPulse, left, right, top, bottom);
    }

    // 3) Vela scura verso il pavimento per staccare il gameplay dallo sfondo.
    const veil = ctx.createLinearGradient(0, FLOOR_Y - 220, 0, FLOOR_Y);
    veil.addColorStop(0, 'rgba(10,6,24,0)');
    veil.addColorStop(1, 'rgba(10,6,24,0.55)');
    ctx.fillStyle = veil;
    ctx.fillRect(left, FLOOR_Y - 220, right - left, 220);
  }

  // Disegna una griglia infinita di mattoni sfalsati, traslata dalla camera.
  _brickLayer(ctx, layer, cameraX, beatPulse, left, right, top, bottom) {
    const { cell, gap, color, speed } = layer;
    const step = cell + gap;
    const offset = (cameraX * speed) % step;

    ctx.fillStyle = color;
    let rowIndex = 0;
    // Mattoni leggermente più piccoli sul battito = effetto "respiro".
    const shrink = beatPulse * 2;

    for (let y = top - step; y < bottom + step; y += step) {
      // Ogni riga è sfalsata di mezzo passo (effetto muro a mattoni).
      const stagger = (rowIndex % 2) * (step / 2);
      for (let x = left - offset - step - stagger; x < right + step; x += step) {
        this._rect(
          ctx,
          x + stagger + gap / 2 + shrink,
          y + gap / 2 + shrink,
          cell - shrink * 2,
          cell - shrink * 2
        );
      }
      rowIndex++;
    }
  }

  _rect(ctx, x, y, w, h) {
    const r = 10;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }
}

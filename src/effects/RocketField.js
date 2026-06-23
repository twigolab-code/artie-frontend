import {
  FLOOR_Y,
  ROCKET_STAR_COLOR,
  ROCKET_SPEED_LINE_COLOR,
} from '../config.js';

// =============================================================================
// RocketField — atmosfera di sfondo attiva quando il cubo è in modalità razzo.
// Due strati, entrambi DETERMINISTICI (no Math.random): le posizioni derivano
// da cameraX e da un hash, così il campo è ricco ma riproducibile col loop a
// timestep fisso (nessuno stato da aggiornare, niente update()).
//
//  - stelle: campo di puntini che scorre in parallasse lenta (profondità);
//  - speed lines: streak orizzontali veloci ("warp") per dare senso di volo.
//
// L'intensità (alpha) è scalata da `amount` (= themeT, 0→1) così l'effetto
// appare/svanisce in modo fluido col cambio modalità; sotto soglia non disegna
// nulla (costo zero in modalità cubo).
// =============================================================================
function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x); // [0,1)
}

const STAR_COUNT = 70; // stelle per "schermata virtuale"
const STAR_PARALLAX = 0.25; // più lento del mondo (profondità)
const SPEED_LINE_COUNT = 14;
const SPEED_LINE_PARALLAX = 1.8; // più veloce del mondo (warp)

export class RocketField {
  // amount = themeT (0 cubo, 1 razzo). Disegna solo se > soglia.
  render(renderer, cameraX, amount, beatPulse = 0) {
    if (amount <= 0.02) return;
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const skyH = FLOOR_Y - top; // disegno solo nel cielo (sopra il pavimento)
    const w = right - left;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, skyH);
    ctx.clip();

    this._stars(ctx, left, top, w, skyH, cameraX, amount, beatPulse);
    this._speedLines(ctx, left, top, w, skyH, cameraX, amount);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Campo di stelle: una griglia virtuale larga `span`, ripetuta in loop, con
  // posizione/dimensione da hash. Scorre in parallasse lenta.
  _stars(ctx, left, top, w, skyH, cameraX, amount, beatPulse) {
    const span = w + 200; // ampiezza del pattern prima di ripetersi
    const scroll = (cameraX * STAR_PARALLAX) % span;
    ctx.fillStyle = ROCKET_STAR_COLOR;
    for (let i = 0; i < STAR_COUNT; i++) {
      const r1 = hash(i * 1.7);
      const r2 = hash(i * 2.3 + 5.1);
      const r3 = hash(i * 0.9 + 9.7);
      // x scorre verso sinistra e fa wrap nello span.
      let x = left + ((r1 * span - scroll) % span + span) % span;
      const y = top + r2 * skyH;
      const size = 0.8 + r3 * 2.0;
      // Twinkle: alpha modulata da hash + un filo di pulsazione sul beat.
      const tw = 0.4 + 0.6 * hash(i * 3.1 + Math.floor(r1 * 7));
      ctx.globalAlpha = amount * tw * (0.85 + 0.15 * beatPulse);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Speed lines: streak orizzontali sottili che sfrecciano (warp).
  _speedLines(ctx, left, top, w, skyH, cameraX, amount) {
    const span = w + 400;
    const scroll = (cameraX * SPEED_LINE_PARALLAX) % span;
    ctx.strokeStyle = ROCKET_SPEED_LINE_COLOR;
    ctx.lineCap = 'round';
    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      const r1 = hash(i * 4.1 + 1.3);
      const r2 = hash(i * 1.9 + 8.8);
      const r3 = hash(i * 2.7 + 3.4);
      let x = left + ((r1 * span - scroll) % span + span) % span;
      const y = top + r2 * skyH;
      const len = 60 + r3 * 140;
      ctx.globalAlpha = amount * (0.10 + 0.18 * r3);
      ctx.lineWidth = 1.5 + r3 * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len, y);
      ctx.stroke();
    }
  }
}

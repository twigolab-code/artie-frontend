import {
  TILE,
  TILE_PORTAL_SHIP,
  PORTAL_SHIP_COLOR,
  PORTAL_CUBE_COLOR,
  PORTAL_HEIGHT,
  PORTAL_PARTICLE_COUNT,
  PORTAL_PARTICLE_LIFE,
  PORTAL_PARTICLE_SIZE,
  GLOW_BLUR,
  FLOOR_Y,
} from '../config.js';

// =============================================================================
// Portal — anello ellittico luminoso (stile neon). Attraversandolo il player
// cambia modalità: ship (magenta) o cube (verde). In WORLD-space.
//
// Disegno procedurale a strati: glow esterno, bordo scuro "3D", anello colorato
// brillante, interno scuro "spaziale" con puntini, freccia bianca al centro.
// Pulsa/ruota nel tempo (`phase`, avanzato da main ogni frame).
// getHitbox() invariata (il trigger non cambia).
// =============================================================================

// Hash deterministico [0,1) per i puntini interni (no Math.random).
function rnd(n) {
  const x = Math.sin(n * 53.13 + 17.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Portal {
  constructor(type, col, row) {
    this.type = type;
    this.mode = type === TILE_PORTAL_SHIP ? 'ship' : 'cube';
    this.color = type === TILE_PORTAL_SHIP ? PORTAL_SHIP_COLOR : PORTAL_CUBE_COLOR;

    this.w = TILE * 0.7;
    this.h = PORTAL_HEIGHT;
    const cellCx = col * TILE + TILE / 2;
    const cellCy = row * TILE + TILE / 2;
    this.x = cellCx - this.w / 2;
    this.y = cellCy - this.h / 2;

    // Clamp: il bordo inferiore non deve mai scendere sotto il pavimento.
    if (this.y + this.h > FLOOR_Y) this.y = FLOOR_Y - this.h;

    this.seed = col * 31 + row * 7;
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // time: secondi accumulati (per pulsazione/rotazione). Default 0.
  render(renderer, cameraX, time = 0) {
    const ctx = renderer.ctx;
    const cx = this.x - cameraX + this.w / 2;
    const cy = this.y + this.h / 2;

    // Pulsazione leggera dei raggi dell'ellisse.
    const pulse = 1 + Math.sin(time * 3 + this.seed) * 0.04;
    const ry = (this.h / 2) * 0.92 * pulse;
    const rx = (this.w / 2) * 1.7 * pulse; // ellisse più larga = anello più "spesso"
    const off = 7; // offset 3D più marcato

    ctx.save();
    ctx.translate(cx, cy);

    // 1) Interno scuro "spaziale" (ellisse piena).
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.78, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0814';
    ctx.fill();

    // 2) Puntini colorati interni che ruotano lentamente (effetto spazio).
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.78, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 10; i++) {
      const a = time * 0.6 + i * 0.63 + this.seed;
      const rr = rnd(this.seed + i) * 0.8;
      const px = Math.cos(a) * rx * rr;
      const py = Math.sin(a * 1.3) * ry * rr;
      const s = 2 + rnd(this.seed + i * 3) * 3;
      ctx.fillStyle = i % 2 ? this.color : '#9fd8ff';
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();

    // 3) Bordo scuro "3D" (lato dell'anello), offset a destra per dare volume.
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.ellipse(off, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4) Anello colorato brillante con glow (spesso).
    ctx.shadowColor = this.color;
    ctx.shadowBlur = GLOW_BLUR * 1.8;
    ctx.lineWidth = 11;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Sottile anello interno bianco per il "neon".
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx - 4, ry - 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4b) Frammenti luminosi che si irradiano dall'anello verso l'esterno
    // (stile GD). Distribuiti su tutto il cerchio e sopra l'anello, così sono
    // ben visibili. Deterministici da `time`+seed+i (no Math.random).
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = GLOW_BLUR * 2.2;
    ctx.fillStyle = this.color;
    const base = Math.max(rx, ry); // raggio comune => dispersione circolare, non schiacciata
    for (let i = 0; i < PORTAL_PARTICLE_COUNT; i++) {
      const phase0 = rnd(this.seed + i * 5.1); // fase di vita sfalsata per particella
      const t = (time / PORTAL_PARTICLE_LIFE + phase0) % 1; // 0 = nasce sull'anello -> 1 = lontano/svanito
      // Angolo base distribuito su 360°, con jitter fisso per particella.
      const ang = (i / PORTAL_PARTICLE_COUNT) * Math.PI * 2 + rnd(this.seed + i) * 1.2;
      const reach = 0.9 + 1.1 * t; // parte sul bordo (0.9) e si allontana (fino a ~2.0)
      const px = Math.cos(ang) * base * reach;
      const py = Math.sin(ang) * base * reach;
      const s = PORTAL_PARTICLE_SIZE * (1 - 0.45 * t); // frammento che rimpicciolisce allontanandosi
      ctx.globalAlpha = Math.min(1, (1 - t) * 1.6); // pieno e brillante a lungo, svanisce solo alla fine
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang + time); // leggera rotazione del frammento
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.restore();

    // 5) Freccia bianca al centro (direzione di marcia).
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    const ah = ry * 0.32; // mezza altezza freccia
    const aw = rx * 0.7;
    ctx.beginPath();
    ctx.moveTo(aw * 0.5, 0);
    ctx.lineTo(-aw * 0.4, -ah);
    ctx.lineTo(-aw * 0.4, ah);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

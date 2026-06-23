// =============================================================================
// PortalFx — effetto speciale al passaggio nel portale: lampo bianco breve +
// onda d'urto circolare colorata che si espande + scintille.
//
// L'onda e le scintille vivono in WORLD-space (seguono lo scroll); il flash è
// in screen-space (tutto lo schermo). Deterministico (no Math.random).
// =============================================================================
function hash(n) {
  const x = Math.sin(n * 19.19 + 7.3) * 43758.5453;
  return x - Math.floor(x);
}

const WAVE_LIFE = 0.45; // durata onda (s)
const FLASH_LIFE = 0.18; // durata lampo (s)
const WAVE_MAX_R = 260; // raggio massimo onda (u)
const SPARK_COUNT = 14;
const SPARK_LIFE = 0.5;
const SPARK_SPEED = 460;

export class PortalFx {
  constructor() {
    this.waves = [];
    this.sparks = [];
    this.flash = 0; // tempo residuo del lampo
    this._seed = 0;
  }

  clear() {
    this.waves.length = 0;
    this.sparks.length = 0;
    this.flash = 0;
  }

  // Avvia l'effetto al centro (x,y) world-space, col colore del portale.
  trigger(x, y, color) {
    this.waves.push({ x, y, life: WAVE_LIFE, max: WAVE_LIFE, color });
    this.flash = FLASH_LIFE;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = this._seed++;
      const a = (i / SPARK_COUNT) * Math.PI * 2 + hash(s) * 0.5;
      const sp = SPARK_SPEED * (0.5 + hash(s * 2) * 0.7);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: SPARK_LIFE * (0.7 + hash(s * 3) * 0.5),
        max: SPARK_LIFE,
        size: 4 + hash(s * 4) * 5,
        color: i % 2 ? color : '#ffffff',
      });
    }
  }

  update(dt) {
    if (this.flash > 0) this.flash -= dt;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      this.waves[i].life -= dt;
      if (this.waves[i].life <= 0) this.waves.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life -= dt;
      if (p.life <= 0) this.sparks.splice(i, 1);
    }
  }

  // Onde + scintille (world-space). Da chiamare nel render del gioco.
  render(renderer, cameraX) {
    const ctx = renderer.ctx;

    for (const w of this.waves) {
      const t = 1 - w.life / w.max; // 0 -> 1
      const r = WAVE_MAX_R * t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = w.color;
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 8 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(w.x - cameraX, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.sparks) {
      const t = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      const s = p.size * (0.5 + t * 0.5);
      ctx.fillRect(p.x - cameraX - s / 2, p.y - s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Lampo bianco a tutto schermo (screen-space). Da chiamare per ultimo.
  renderFlash(renderer) {
    if (this.flash <= 0) return;
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = (this.flash / FLASH_LIFE) * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      renderer.extLeft,
      renderer.extTop,
      renderer.extRight - renderer.extLeft,
      renderer.extBottom - renderer.extTop
    );
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

import {
  PARTICLE_COUNT,
  PARTICLE_SPEED,
  PARTICLE_LIFE,
  PARTICLE_GRAVITY,
  COLORS,
} from '../config.js';

// =============================================================================
// Particles — sistema di schegge per l'esplosione alla morte.
//
// Le particelle vivono in WORLD-space (così restano coerenti con la camera) e
// hanno una vita limitata: a fine vita svaniscono (alpha -> 0).
// =============================================================================
export class Particles {
  constructor() {
    this.list = [];
  }

  // Genera un'esplosione centrata su (cx, cy) world-space.
  // `seed` varia leggermente le direzioni senza usare Math.random globale.
  burst(cx, cy, seed = 0) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Direzioni distribuite a raggiera + jitter deterministico dal seed.
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + seed * 0.137;
      const speed = PARTICLE_SPEED * (0.4 + ((i * 7 + (seed | 0)) % 10) / 10);
      this.list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120, // leggera spinta verso l'alto
        life: PARTICLE_LIFE,
        max: PARTICLE_LIFE,
        size: 6 + (i % 4) * 2,
      });
    }
  }

  update(dt) {
    const arr = this.list;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) arr.splice(i, 1); // morta -> rimuovi
    }
  }

  clear() {
    this.list.length = 0;
  }

  render(renderer, cameraX) {
    const ctx = renderer.ctx;
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(p.x - cameraX - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

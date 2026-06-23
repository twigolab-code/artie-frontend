import {
  LOGICAL_HEIGHT,
  FLOOR_Y,
  CITY_BUILDINGS,
  CITY_WINDOW_COLOR,
  CITY_STRIPE_COLOR,
  CITY_CLOUD_COLOR,
} from '../config.js';

// =============================================================================
// CityBackground — skyline urbano arancione a parallasse, fedele a bg1.png.
//
// Stessa firma di Background.render(renderer, cameraX, beatPulse, theme).
// Disegna fino ai BORDI REALI del canvas (renderer.extLeft..extRight) per
// coprire le bande letterbox. Tutto procedurale e deterministico (hash colonna,
// niente Math.random): palazzi di forme/larghezze diverse a 3 strati di
// profondità, lontani chiari senza finestre, vicini più scuri con finestre.
// =============================================================================

function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class CityBackground {
  render(renderer, cameraX, beatPulse, theme) {
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const bottom = renderer.extBottom;
    const width = right - left;

    // 1) Cielo a gradiente, esteso a tutto lo schermo reale.
    const sky = ctx.createLinearGradient(0, top, 0, FLOOR_Y);
    sky.addColorStop(0, theme.top);
    sky.addColorStop(1, theme.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(left, top, width, bottom - top);

    // 2) Nuvole crema in alto, parallasse lenta.
    this._clouds(ctx, cameraX, left, right);

    // 3) Skyline a strati (lontano -> vicino).
    let layerIndex = 0;
    for (const layer of CITY_BUILDINGS) {
      this._buildings(ctx, layer, cameraX, layerIndex, left, right);
      layerIndex++;
    }
  }

  _clouds(ctx, cameraX, left, right) {
    ctx.fillStyle = CITY_CLOUD_COLOR;
    const speed = 0.06;
    const period = 560;
    const offset = (cameraX * speed) % period;
    const startCol = Math.floor((cameraX * speed) / period) - 1;
    for (let x = left - period; x < right + period; x += period) {
      const i = Math.round((x + offset) / period) + startCol;
      const y = 70 + ((((i % 3) + 3) % 3)) * 28;
      this._cloud(ctx, x - offset + 140, y, 64 + (((i % 2) + 2) % 2) * 22, i);
    }
  }

  // Nuvola SQUADRATA a gradoni: rettangoli sovrapposti di larghezza decrescente
  // verso l'alto, sfalsati in modo deterministico (silhouette angolare).
  _cloud(ctx, x, y, r, seed) {
    const tiers = 3;
    const tierH = r * 0.42;
    let w = r * 2.4; // base larga
    let cx = x;
    ctx.beginPath();
    for (let t = 0; t < tiers; t++) {
      const ty = y - t * tierH;
      // Ogni gradone si restringe e si sfalsa un po' (jitter deterministico).
      const jitter = (rand(seed * 5.1 + t * 2.3) - 0.5) * r * 0.4;
      cx += jitter;
      ctx.rect(cx - w / 2, ty - tierH, w, tierH + 1);
      w *= 0.6; // gradone superiore più stretto
    }
    ctx.fill();
  }

  // Uno strato di palazzi disposti a CLUSTER (gruppi) separati da cielo vuoto.
  // Ogni "macro-slot" largo `period` contiene un cluster di pochi palazzi
  // addossati a partire da un offset, poi cielo fino a fine slot. Così la
  // densità è bassa (~metà cielo) e i palazzi appaiono a blocchi distinti.
  _buildings(ctx, layer, cameraX, layerIndex, left, right) {
    const baseY = FLOOR_Y;
    const scrollX = cameraX * layer.speed; // posizione mondo dello strato
    const unitW = 78 - layerIndex * 12; // larghezza base di un palazzo
    const period = unitW * (layer.periodMul || 5); // macro-slot (per-strato)

    const worldLeft = scrollX + left;
    const firstSlot = Math.floor(worldLeft / period) - 1;
    const slots = Math.ceil((right - left) / period) + 2;

    for (let s = 0; s < slots; s++) {
      const slot = firstSlot + s;
      // Parametri del cluster (deterministici per slot+strato).
      const rc = rand(slot * 19.7 + layerIndex * 63.1);
      const ro = rand(slot * 8.3 + layerIndex * 27.9);
      const maxCount = layer.maxCount || 4;
      const count = 1 + Math.floor(rc * maxCount); // 1..maxCount palazzi nel cluster
      // Offset del cluster dentro il macro-slot (lascia cielo prima e dopo).
      const slotStartWorld = slot * period;
      const clusterStartWorld = slotStartWorld + period * (0.1 + ro * 0.25);

      let penWorld = clusterStartWorld; // "penna" in coordinate mondo
      for (let b = 0; b < count; b++) {
        const seed = slot * 100 + b * 7 + layerIndex * 13;
        const r1 = rand(seed * 1.7 + 3.1);
        const r2 = rand(seed * 2.3 + 9.7);
        const r3 = rand(seed * 0.9 + 5.5);

        const w = unitW * (0.7 + r1 * 0.6);
        const topFrac = layer.topMin + (layer.topMax - layer.topMin) * r3;
        const topY = topFrac * LOGICAL_HEIGHT;
        const h = baseY - topY;

        const x = penWorld - scrollX; // mondo -> schermo
        this._building(ctx, layer, x, topY, w, h, seed, layerIndex, r1, r2);

        penWorld += w; // palazzi del cluster addossati
      }
    }
  }

  _building(ctx, layer, x, topY, w, h, slot, layerIndex, r1, r2) {
    ctx.fillStyle = layer.color;

    // Forma della cima: 0 piatta, 1 attico arretrato, 2 antenna, 3 a gradini.
    const shape = Math.floor(r2 * 4);
    const baseY = topY + h;

    if (shape === 1) {
      // Attico arretrato: blocco più stretto sopra il corpo.
      const aw = w * 0.5;
      const ah = Math.min(h * 0.22, 60);
      ctx.fillRect(x + (w - aw) / 2, topY, aw, ah);
      ctx.fillRect(x, topY + ah, w, h - ah);
      topY += ah;
    } else if (shape === 2) {
      // Antenna sottile sopra una cima piatta.
      ctx.fillRect(x + w / 2 - 2, topY - 22, 4, 22);
      ctx.fillRect(x, topY, w, h);
    } else if (shape === 3) {
      // A gradini: due gradini decrescenti ai lati.
      const step = Math.min(h * 0.14, 34);
      ctx.fillRect(x + w * 0.18, topY, w * 0.64, step);
      ctx.fillRect(x, topY + step, w, h - step);
      topY += step;
    } else {
      ctx.fillRect(x, topY, w, h);
    }

    // Strisce verticali chiare (riflessi) su alcuni palazzi degli strati vicini.
    if (layer.stripes && r1 > 0.6) {
      ctx.fillStyle = CITY_STRIPE_COLOR;
      const n = 3;
      const sw = Math.max(2, w * 0.05);
      for (let i = 0; i < n; i++) {
        const sx = x + w * (0.28 + i * 0.22);
        ctx.fillRect(sx, topY, sw, baseY - topY);
      }
    }

    // Finestre a griglia (solo strati vicini).
    if (layer.windows) this._windows(ctx, x, topY, w, baseY - topY, slot, layerIndex);
  }

  _windows(ctx, x, y, w, h, slot, layerIndex) {
    const cell = 16;
    const margin = 9;
    const cols = Math.floor((w - margin * 2) / cell);
    const rows = Math.floor((h - margin * 2) / cell);
    if (cols <= 0 || rows <= 0) return;

    ctx.fillStyle = CITY_WINDOW_COLOR;
    const ww = cell * 0.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand(slot * 31.1 + r * 7.7 + c * 3.3 + layerIndex * 5.0) < 0.28) continue;
        ctx.fillRect(x + margin + c * cell, y + margin + r * cell, ww, ww);
      }
    }
  }
}

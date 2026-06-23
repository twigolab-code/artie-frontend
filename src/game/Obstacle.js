import {
  TILE,
  TILE_BLOCK,
  TILE_SPIKE,
  TILE_SPIKE_SMALL,
  TILE_SPIKE_DOWN,
  TILE_SPIKE_FLOOR,
  OBSTACLE_FILL_TOP,
  OBSTACLE_FILL_BOTTOM,
  EDGE_COLOR,
  GLOW_COLOR,
  GLOW_BLUR,
} from '../config.js';

// =============================================================================
// Obstacle — blocco solido o spuntone (intero / piccolo / capovolto), in stile
// Geometry Dash: riempimento scuro + bordo bianco luminoso (glow).
//
// Varianti spuntone:
//  - TILE_SPIKE       : triangolo intero, base sul fondo cella, punta in alto.
//  - TILE_SPIKE_SMALL : triangolo basso (mezza altezza), base sul fondo cella.
//  - TILE_SPIKE_DOWN  : triangolo capovolto, base in cima cella, punta in basso.
//
// Coordinate in WORLD-space; conversione a schermo in render().
// =============================================================================
export class Obstacle {
  constructor(type, col, row) {
    this.type = type;
    this.col = col;
    this.row = row;

    this.x = col * TILE;
    this.y = row * TILE;
    this.w = TILE;
    this.h = TILE;
  }

  get solid() {
    return this.type === TILE_BLOCK;
  }
  get deadly() {
    return (
      this.type === TILE_SPIKE ||
      this.type === TILE_SPIKE_SMALL ||
      this.type === TILE_SPIKE_DOWN ||
      this.type === TILE_SPIKE_FLOOR
    );
  }

  getHitbox() {
    const w = this.w * 0.4;
    if (this.type === TILE_SPIKE) {
      const h = this.h * 0.55;
      return { x: this.x + (this.w - w) / 2, y: this.y + (this.h - h), w, h };
    }
    if (this.type === TILE_SPIKE_SMALL) {
      const h = this.h * 0.3;
      return { x: this.x + (this.w - w) / 2, y: this.y + (this.h - h), w, h };
    }
    if (this.type === TILE_SPIKE_DOWN) {
      const h = this.h * 0.55;
      // Appeso: hitbox in alto nella cella (la punta scende dall'alto).
      return { x: this.x + (this.w - w) / 2, y: this.y, w, h };
    }
    if (this.type === TILE_SPIKE_FLOOR) {
      // Pavimento di zanne: hitbox bassa e larga (copre il tappeto di punte
      // corte). Bassa così è leale: il cubo muore solo se scende sulle spine.
      const fw = this.w * 0.8;
      const h = this.h * 0.3;
      return { x: this.x + (this.w - fw) / 2, y: this.y + (this.h - h), w: fw, h };
    }
    // Blocco: intera cella.
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  render(renderer, cameraX) {
    const sx = this.x - cameraX;
    const sy = this.y;
    if (this.type === TILE_BLOCK) this._renderBlock(renderer, sx, sy);
    else if (this.type === TILE_SPIKE_FLOOR) this._renderSpikeFloor(renderer, sx, sy);
    else this._renderSpike(renderer, sx, sy);
  }

  _renderBlock(renderer, sx, sy) {
    const ctx = renderer.ctx;
    const w = this.w;
    const h = this.h;

    const grad = ctx.createLinearGradient(0, sy, 0, sy + h);
    grad.addColorStop(0, OBSTACLE_FILL_TOP);
    grad.addColorStop(1, OBSTACLE_FILL_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, w, h);

    ctx.save();
    ctx.shadowColor = GLOW_COLOR;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 1.5, sy + 1.5, w - 3, h - 3);
    ctx.restore();
  }

  // Triangolo dello spuntone, orientato/dimensionato in base al tipo.
  _renderSpike(renderer, sx, sy) {
    const ctx = renderer.ctx;
    const w = this.w;
    const h = this.h;

    ctx.beginPath();
    if (this.type === TILE_SPIKE_DOWN) {
      // Capovolto: base in alto, apice in basso.
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + w, sy);
      ctx.lineTo(sx + w / 2, sy + h);
    } else if (this.type === TILE_SPIKE_SMALL) {
      // Piccolo: base sul fondo, apice a metà cella.
      ctx.moveTo(sx + w / 2, sy + h * 0.5);
      ctx.lineTo(sx + w, sy + h);
      ctx.lineTo(sx, sy + h);
    } else {
      // Intero: base sul fondo, apice in cima.
      ctx.moveTo(sx + w / 2, sy);
      ctx.lineTo(sx + w, sy + h);
      ctx.lineTo(sx, sy + h);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, sy, 0, sy + h);
    grad.addColorStop(0, OBSTACLE_FILL_TOP);
    grad.addColorStop(1, OBSTACLE_FILL_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = GLOW_COLOR;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // "Pavimento spinato": tappeto di zanne corte tutte nere + 1-2 punte ALTE
  // stile "ghiaccio appuntito" (nere con punta chiara). Mortale (vedi deadly).
  // Disegno deterministico (seed da col,row): niente sfarfallio frame-to-frame.
  _renderSpikeFloor(renderer, sx, sy) {
    const ctx = renderer.ctx;
    const w = this.w;
    const h = this.h;

    // Una singola zanna a punta affilata (lati concavi), riempimento nero con
    // punta opzionalmente più chiara (per le punte "di ghiaccio").
    const fang = (fx, fw, fh, light) => {
      const cx = fx + fw / 2;
      const baseY = sy + h; // base sul fondo cella
      const tipY = sy + h - fh; // punta verso l'alto
      const inset = fw * 0.18; // rientro -> fianchi concavi
      const midY = (baseY + tipY) / 2;

      ctx.beginPath();
      ctx.moveTo(fx, baseY);
      ctx.quadraticCurveTo(fx + inset, midY, cx, tipY);
      ctx.quadraticCurveTo(fx + fw - inset, midY, fx + fw, baseY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY, 0, tipY);
      grad.addColorStop(0, OBSTACLE_FILL_TOP); // base quasi nera
      if (light) {
        // Punta "ghiaccio": diventa chiara verso l'apice.
        grad.addColorStop(0.55, '#1a1a26');
        grad.addColorStop(1, '#cfd6ff'); // apice chiaro (azzurro/bianco)
      } else {
        grad.addColorStop(1, '#101018'); // zanna corta: tutta nera
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Bordo glow bianco (più tenue sulle zanne corte).
      ctx.save();
      ctx.shadowColor = GLOW_COLOR;
      ctx.shadowBlur = light ? GLOW_BLUR : GLOW_BLUR * 0.5;
      ctx.strokeStyle = EDGE_COLOR;
      ctx.lineWidth = light ? 2.5 : 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    };

    // Tappeto di zanne corte nere (riempiono la larghezza della cella).
    const nShort = 6; // zanne corte per cella
    const sw = w / nShort; // larghezza di una zanna corta
    for (let i = 0; i < nShort; i++) {
      const seed = ((this.col * 73856093) ^ (this.row * 19349663) ^ (i * 83492791)) >>> 0;
      const fh = h * (0.26 + ((seed % 1000) / 1000) * 0.12); // 0.26..0.38 della cella
      fang(sx + i * sw, sw, fh, false);
    }

    // 1-2 punte ALTE "di ghiaccio" in mezzo (nere con apice chiaro).
    const tallSeed = ((this.col * 2654435761) ^ (this.row * 40503)) >>> 0;
    const two = tallSeed % 2 === 0; // alterna 1 o 2 punte alte
    const tw = w * 0.26; // larghezza punta alta
    if (two) {
      fang(sx + w * 0.20 - tw / 2, tw, h * 0.82, true);
      fang(sx + w * 0.66 - tw / 2, tw, h * 0.7, true);
    } else {
      fang(sx + w * 0.5 - tw / 2, tw, h * 0.9, true);
    }
  }
}

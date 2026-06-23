import {
  TILE,
  TILE_EMPTY,
  TILE_BLOCK,
  TILE_SPIKE,
  TILE_SPIKE_SMALL,
  TILE_SPIKE_DOWN,
  TILE_SPIKE_FLOOR,
  TILE_PORTAL_SHIP,
  TILE_PORTAL_CUBE,
  TILE_ORB,
  TILE_PAD,
  TILE_COIN,
} from '../config.js';
import { Obstacle } from './Obstacle.js';
import { Portal } from './Portal.js';
import { Orb } from './Orb.js';
import { Pad } from './Pad.js';
import { Coin } from './Coin.js';

// =============================================================================
// Level — carica un livello da una griglia di tile.
//
// Separa le entità per ruolo:
//  - obstacles: blocchi/spuntoni (collisioni di morte/appoggio)
//  - portals: cambio modalità cube<->ship
//  - orbs: salto a mezz'aria
//
// La griglia è un array di righe (stringhe o array di numeri); la riga 0 è in
// alto. widthPx = larghezza totale del livello in unità logiche.
// =============================================================================
export class Level {
  constructor(grid) {
    this.obstacles = [];
    this.portals = [];
    this.orbs = [];
    this.pads = [];
    this.coins = [];
    this.cols = 0;
    this.rows = grid.length;

    for (let row = 0; row < grid.length; row++) {
      const line = grid[row];
      const length = line.length;
      if (length > this.cols) this.cols = length;

      for (let col = 0; col < length; col++) {
        const ch = typeof line === 'string' ? line[col] : line[col];
        // Codici non numerici (carattere): gestiti prima della conversione.
        if (ch === TILE_SPIKE_FLOOR) {
          this.obstacles.push(new Obstacle(TILE_SPIKE_FLOOR, col, row));
          continue;
        }
        const code = typeof line === 'string' ? Number(ch) : ch;
        if (!code || code === TILE_EMPTY) continue;

        if (
          code === TILE_BLOCK ||
          code === TILE_SPIKE ||
          code === TILE_SPIKE_SMALL ||
          code === TILE_SPIKE_DOWN
        ) {
          this.obstacles.push(new Obstacle(code, col, row));
        } else if (code === TILE_PORTAL_SHIP || code === TILE_PORTAL_CUBE) {
          this.portals.push(new Portal(code, col, row));
        } else if (code === TILE_ORB) {
          this.orbs.push(new Orb(col, row));
        } else if (code === TILE_PAD) {
          this.pads.push(new Pad(col, row));
        } else if (code === TILE_COIN) {
          this.coins.push(new Coin(col, row));
        }
      }
    }

    this.widthPx = this.cols * TILE;
  }

  // Disegna tutto ciò che è visibile (con culling), nell'ordine corretto.
  // Il culling usa i bordi REALI del canvas (extLeft..extRight) con un margine,
  // così gli elementi entrano/escono solo fuori schermo (niente pop-in a metà).
  // fillBottom: colore "in basso" del gradiente degli ostacoli (per-livello), inoltrato
  // a ob.render. Se assente, gli ostacoli usano il default globale.
  render(renderer, cameraX, time = 0, fillBottom) {
    const margin = TILE;
    const left = cameraX + renderer.extLeft - margin;
    const right = cameraX + renderer.extRight + margin;
    const visible = (x, w) => !(x + w < left || x > right);

    // Portali, orb, pad e monete sotto agli ostacoli, così i blocchi li coprono.
    for (const p of this.portals) if (visible(p.x, p.w)) p.render(renderer, cameraX, time);
    for (const o of this.orbs) if (visible(o.x, o.size)) o.render(renderer, cameraX);
    for (const pad of this.pads) if (visible(pad.x, pad.w)) pad.render(renderer, cameraX);
    for (const c of this.coins) if (visible(c.x, c.size)) c.render(renderer, cameraX, time);
    for (const ob of this.obstacles) if (visible(ob.x, ob.w)) ob.render(renderer, cameraX, fillBottom);
  }
}

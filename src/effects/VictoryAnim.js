import { Fireworks } from './Fireworks.js';
import { PLAYER_X, PLAYER_SIZE, FLOOR_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

// =============================================================================
// VictoryAnim — animazione di vittoria CONDIVISA tra il gioco (main.js) e
// l'anteprima del Game Builder (builder/victoryPreview.js). Coreografia:
//
//   CHARGE : sfondo congelato (lo disegna il chiamante), il player si INGRANDISCE
//            sul posto come "carica/partenza"; all'apice scoppia un'esplosione di
//            scintille (stelle Artie / note Miles).
//   HOPS   : un paio di saltelli ad arco, ognuno ruotando di 360° (puff di
//            scintille a ogni saltello).
//   LEAP   : grande salto ad arco verso l'alto-destra ruotando mentre rimpicciolisce,
//            sparisce "in cielo" oltre il bordo; scia di scintille lungo l'arco.
//   PAUSE  : breve attesa (solo scintille che svaniscono).
//   TEXT   : compare "LIVELLO COMPLETATO!" con pop-in + pulsazione.
//
// Il modulo NON conosce la scena di gioco: il chiamante disegna la scena
// CONGELATA (SENZA il player) e poi chiama render(renderer); il player animato
// lo disegna QUI sopra, avvolgendo player.render() in una trasformata esterna
// (translate/scale/rotate) — render() fa il suo save/restore, quindi NON tocca
// lo stato del player. La rotazione esterna gira l'intera sprite sia in modalità
// cubo (angle interno = 0 a fisica ferma) sia razzo (pitch resta e "viaggia").
// Per ancorare lo screenX a PLAYER_X passa cameraX = player.x - PLAYER_X: così
// funziona identico nel gioco e nel builder (dove worldX = PLAYER_X => cameraX = 0).
//
// Il MOTO è una funzione pura del tempo (_motion(t)) usata SIA da render (disegno)
// SIA da update (posizione della scia): nessun Math.random, tutto deterministico
// (le scintille usano l'hash interno di Fireworks). Vedi CLAUDE.md §10.
// =============================================================================

// Durate delle fasi (s). Totale ~3.9s, poi `done`.
const CHARGE_DUR = 0.6; // ingrandimento + esplosione
const HOPS_DUR = 0.85; // saltelli ruotando
const LEAP_DUR = 0.9; // salto ad arco fuori schermo
const PAUSE_DUR = 0.25; // attesa breve
const TEXT_DUR = 1.3; // testo "LIVELLO COMPLETATO" che resta
const TOTAL = CHARGE_DUR + HOPS_DUR + LEAP_DUR + PAUSE_DUR + TEXT_DUR;

// Confini cumulativi delle fasi di MOTO (CHARGE/HOPS/LEAP).
const HOPS_START = CHARGE_DUR;
const LEAP_START = CHARGE_DUR + HOPS_DUR;
const MOTION_END = LEAP_START + LEAP_DUR; // oltre: il player non si disegna più

const CHARGE_SCALE = 2.0; // scala raggiunta a fine CHARGE (resta nei saltelli)
const HOP_COUNT = 2; // numero di saltelli
const HOP_HEIGHT = 130; // altezza arco di ogni saltello (~2 tiles)
const HOP_DRIFT = 30; // leggera deriva a destra a fine saltelli (px)
const LEAP_TURNS = 1.5; // giri completi durante il salto finale
const LEAP_RISE = 760; // quota verso l'alto del salto finale (esce dal top)
const LEAP_END_SCALE = 0.35; // scala finale: rimpicciolisce "sparendo in cielo"
const FLY_TRAIL_EVERY = 0.05; // cadenza dei burst di scia durante il LEAP (s)

const TEXT_COLOR = '#ffd23f'; // giallo UI
const TEXT_OUTLINE = '#0a0a12'; // bordo scuro

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t) {
  return t * t * t;
}

export class VictoryAnim {
  constructor() {
    this.fireworks = new Fireworks();
    this.active = false;
    this.done = false;
    this.t = 0;
    this.player = null;
    this.fillBottom = null;
    this._exploded = false; // esplosione (apice CHARGE) già sparata?
    this._hopsPuffed = 0; // quanti puff di saltello già sparati
    this._nextTrailAt = 0; // prossimo burst di scia durante il LEAP
    this._seed = 0;
  }

  // Avvia l'animazione sul player dato, con look (colore+forma) per-player.
  start({ player, fillBottom = null, color, shape }) {
    this.player = player;
    this.fillBottom = fillBottom;
    this.fireworks.setStyle(color, shape);
    this.fireworks.clear();
    this.active = true;
    this.done = false;
    this.t = 0;
    this._exploded = false;
    this._hopsPuffed = 0;
    this._nextTrailAt = 0;
    this._seed = 0;
  }

  // Azzeramento (restart() nel gioco / teardown nel builder).
  reset() {
    this.active = false;
    this.done = false;
    this.t = 0;
    this._exploded = false;
    this._hopsPuffed = 0;
    this._nextTrailAt = 0;
    this._seed = 0;
    this.fireworks.clear();
  }

  // Centro del player a schermo a riposo (screenX pinnato a PLAYER_X, a terra).
  _playerCenter() {
    const half = PLAYER_SIZE / 2;
    return { cx: PLAYER_X + half, cy: FLOOR_Y - PLAYER_SIZE + half };
  }

  // MOTO del player al tempo t (funzione pura): scala, offset (dx,dy), rotazione,
  // e se è ancora visibile. Usato sia da render (disegno) sia da update (scia).
  _motion(t) {
    let scale = 1;
    let dx = 0;
    let dy = 0;
    let angle = 0;
    let visible = true;

    if (t < CHARGE_DUR) {
      // CHARGE: 1 -> CHARGE_SCALE con ease-out.
      scale = 1 + (CHARGE_SCALE - 1) * easeOutCubic(t / CHARGE_DUR);
    } else if (t < LEAP_START) {
      // HOPS: HOP_COUNT saltelli ad arco, +360° ciascuno.
      const hp = (t - HOPS_START) / HOPS_DUR; // 0..1 sull'intera fase saltelli
      const u = (hp * HOP_COUNT) % 1; // 0..1 dentro il singolo saltello
      scale = CHARGE_SCALE;
      dy = -HOP_HEIGHT * Math.sin(Math.PI * u); // arco verticale del saltello
      dx = HOP_DRIFT * hp; // leggera deriva a destra
      angle = hp * HOP_COUNT * Math.PI * 2; // +1 giro per saltello
    } else if (t < MOTION_END) {
      // LEAP: arco verso l'alto-destra, gira e rimpicciolisce, esce dallo schermo.
      const { cx } = this._playerCenter();
      const v = (t - LEAP_START) / LEAP_DUR; // 0..1
      const ev = easeInCubic(v);
      dx = HOP_DRIFT + ev * (LOGICAL_WIDTH + PLAYER_SIZE * 2 - cx + PLAYER_SIZE);
      // Arco: sale forte all'inizio (sin) e continua a salire (termine lineare),
      // così il player esce dal bordo SUPERIORE oltre che da quello destro.
      dy = -(LEAP_RISE * (0.55 * Math.sin(Math.PI * Math.min(1, v * 0.85)) + 0.6 * ev));
      angle = HOP_COUNT * Math.PI * 2 + LEAP_TURNS * Math.PI * 2 * ev;
      scale = CHARGE_SCALE + (LEAP_END_SCALE - CHARGE_SCALE) * ev;
    } else {
      visible = false;
    }

    return { scale, dx, dy, angle, visible };
  }

  update(dt) {
    if (!this.active || this.done) return;
    this.t += dt;

    const { cx, cy } = this._playerCenter();

    // Apice del CHARGE: esplosione di scintille centrata sul player.
    if (!this._exploded && this.t >= CHARGE_DUR) {
      this.fireworks.burst(cx, cy, this._seed++);
      this._exploded = true;
    }

    // HOPS: un puff di scintille all'atterraggio di ogni saltello.
    if (this.t >= HOPS_START && this.t < LEAP_START) {
      const hp = (this.t - HOPS_START) / HOPS_DUR;
      const landed = Math.floor(hp * HOP_COUNT); // saltelli completati
      while (this._hopsPuffed < landed) {
        this._hopsPuffed++;
        this.fireworks.burst(cx + HOP_DRIFT * hp, cy, this._seed++);
      }
    }

    // LEAP: scia di scintille lungo l'arco REALE (stesso _motion del disegno).
    if (this.t >= LEAP_START && this.t < MOTION_END && this.t >= this._nextTrailAt) {
      const m = this._motion(this.t);
      this.fireworks.burst(cx + m.dx, cy + m.dy, this._seed++);
      this._nextTrailAt = this.t + FLY_TRAIL_EVERY;
    }

    this.fireworks.update(dt);

    if (this.t >= TOTAL) this.done = true;
  }

  render(renderer) {
    const ctx = renderer.ctx;
    const { cx, cy } = this._playerCenter();

    // --- Player animato (CHARGE/HOPS/LEAP, finché visibile) ------------------
    if (this.player && this.t < MOTION_END) {
      const m = this._motion(this.t);
      if (m.visible) {
        ctx.save();
        ctx.translate(cx + m.dx, cy + m.dy);
        ctx.scale(m.scale, m.scale);
        ctx.rotate(m.angle); // giravolta attorno al centro del player
        ctx.translate(-cx, -cy);
        // cameraX = player.x - PLAYER_X => screenX pinnato a PLAYER_X (gioco e builder).
        this.player.render(renderer, this.player.x - PLAYER_X, this.fillBottom);
        ctx.restore();
      }
    }

    // --- Scintille (esplosione + scia), screen-space -------------------------
    this.fireworks.render(renderer);

    // --- TEXT: "LIVELLO COMPLETATO!" pop-in + pulsazione ---------------------
    const textStart = MOTION_END + PAUSE_DUR;
    if (this.t >= textStart) {
      const tp = Math.min(1, (this.t - textStart) / 0.35); // 0->1 in 0.35s
      const ease = easeOutCubic(tp);
      const pulse = 1 + 0.04 * Math.sin((this.t - textStart) * 6);
      const scale = (0.6 + 0.4 * ease) * pulse; // 0.6 -> 1.0, poi pulsa
      const x = LOGICAL_WIDTH / 2;
      const y = LOGICAL_HEIGHT / 2 + 20;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      this._drawText(ctx, 'LIVELLO COMPLETATO!', x, y, 64);
      ctx.restore();
    }
  }

  // Testo in stile GD autonomo (niente dipendenze da main.js): MAIUSCOLO,
  // fill giallo + bordo scuro spesso, centrato.
  _drawText(ctx, str, x, y, size) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${size}px 'SoccerLeague', system-ui, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.strokeStyle = TEXT_OUTLINE;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
}

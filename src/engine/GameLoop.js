import { FIXED_DT, MAX_FRAME_TIME } from '../config.js';

// =============================================================================
// GameLoop — loop a timestep fisso con accumulator.
//
// Il loop separa l'aggiornamento logico (deterministico, a passo fisso) dal
// rendering (a framerate variabile). Per ogni frame accumula il tempo trascorso
// e consuma il budget in step da FIXED_DT, così la simulazione è identica a
// qualsiasi framerate. Il render riceve `alpha` (frazione del passo residuo)
// per eventuale interpolazione.
// =============================================================================
export class GameLoop {
  /**
   * @param {(dt: number) => void} update - aggiornamento logico, passo fisso
   * @param {(alpha: number) => void} render - disegno, una volta per frame
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;

    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;

    // bind una sola volta per non riallocare ad ogni rAF
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
  }

  _frame(now) {
    if (!this.running) return;

    // Tempo trascorso dall'ultimo frame, in secondi, con clamp di sicurezza.
    let frameTime = (now - this.lastTime) / 1000;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;
    this.lastTime = now;

    // Consuma il tempo accumulato in passi fissi.
    this.accumulator += frameTime;
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    // alpha = quanto manca al prossimo step (0..1), utile per interpolare.
    this.render(this.accumulator / FIXED_DT);

    requestAnimationFrame(this._frame);
  }
}

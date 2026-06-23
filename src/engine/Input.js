// =============================================================================
// Input — gestione tastiera/mouse/touch.
//
// Espone due informazioni utili al gameplay:
//  - `held`: il tasto/azione di salto è attualmente premuto (per il salto
//    continuo "tieni premuto" tipico di Geometry Dash).
//  - `consumePress()`: ritorna true UNA volta per ogni nuova pressione (edge),
//    utile se in futuro servisse un salto a singolo tap.
//
// Le sorgenti di "salto" sono: barra spaziatrice / freccia su, click sinistro,
// touch. Tutte mappano sulla stessa azione.
// =============================================================================
export class Input {
  constructor(target = window) {
    this.held = false; // azione di salto attualmente premuta
    this._pressed = false; // edge: nuova pressione non ancora consumata

    // --- Tastiera ---
    target.addEventListener('keydown', (e) => {
      if (this._isJumpKey(e.code) && !e.repeat) {
        e.preventDefault();
        this._press();
      }
    });
    target.addEventListener('keyup', (e) => {
      if (this._isJumpKey(e.code)) this._release();
    });

    // --- Mouse ---
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._press();
    });
    target.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._release();
    });

    // --- Touch ---
    target.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._press();
      },
      { passive: false }
    );
    target.addEventListener('touchend', () => this._release());

    // Se la finestra perde il focus, "rilascio" per non restare bloccato.
    window.addEventListener('blur', () => this._release());
  }

  _isJumpKey(code) {
    return code === 'Space' || code === 'ArrowUp';
  }

  _press() {
    if (!this.held) this._pressed = true; // edge solo sulla transizione
    this.held = true;
  }

  _release() {
    this.held = false;
  }

  // Ritorna true una sola volta per ogni nuova pressione.
  consumePress() {
    const p = this._pressed;
    this._pressed = false;
    return p;
  }
}

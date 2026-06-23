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
// True se l'elemento è un campo editabile (input/textarea/select o contentEditable):
// sui tap su questi elementi non vanno né preventDefault né salto, così la tastiera
// mobile si apre e la digitazione funziona.
function isEditableTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

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
        // Tap su un campo editabile (es. <input> nickname): NON fare preventDefault,
        // altrimenti su mobile si annulla il focus e non si apre la tastiera. Né va
        // contato come salto.
        if (isEditableTarget(e.target)) return;
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

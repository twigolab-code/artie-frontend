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
// True se il tocco va lasciato al browser/DOM (niente preventDefault, niente salto):
//  - campi editabili (input/textarea/select/contentEditable): così su mobile si apre
//    la tastiera e la digitazione funziona;
//  - elementi interattivi del DOM sopra il canvas (link <a>, <button>): così il
//    click/navigazione nativo funziona su mobile (link crediti del footer, link "Info").
//    Senza questa esenzione il preventDefault globale annullerebbe il tap e i link
//    risulterebbero "morti" su mobile.
function isInteractiveTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  return typeof el.closest === 'function' && el.closest('a, button') !== null;
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
        // Tap su un campo editabile (es. <input> nickname) o su un elemento
        // interattivo del DOM (link <a>/<button> sopra il canvas: crediti, "Info"):
        // NON fare preventDefault, altrimenti si annulla focus/click/navigazione
        // nativi su mobile. Né va contato come salto.
        if (isInteractiveTarget(e.target)) return;
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

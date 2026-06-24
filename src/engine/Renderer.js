import { LOGICAL_WIDTH, LOGICAL_HEIGHT, COLORS } from '../config.js';

// =============================================================================
// Renderer — wrapper sul context 2D del canvas.
//
// Gestisce il resize responsive e il devicePixelRatio (nitidezza su schermi
// retina), e applica una trasformazione che mappa lo spazio logico costante
// (LOGICAL_WIDTH x LOGICAL_HEIGHT) sull'area visibile, mantenendo le proporzioni
// con bande (letterbox) quando l'aspect ratio non combacia.
// =============================================================================
export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Dimensioni logiche esposte al gioco (costanti).
    this.width = LOGICAL_WIDTH;
    this.height = LOGICAL_HEIGHT;

    // Fattori di scala/offset calcolati al resize.
    this._scale = 1;
    this._offsetX = 0;
    this._offsetY = 0;

    // Safe-area insets (notch/angoli/home-indicator) in coordinate LOGICHE.
    // Leggibili solo via env() in CSS: usiamo un <div> sonda fixed e invisibile il
    // cui padding rispecchia env(safe-area-inset-*); ne leggiamo il padding (px) al
    // resize e lo convertiamo in logico. Su desktop/no-notch restano 0.
    this._safe = { left: 0, right: 0, top: 0, bottom: 0 };
    this._safeProbe = this._createSafeProbe();

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    window.addEventListener('orientationchange', this._resize);
    // NB: NON agganciare visualViewport a _resize. Su iOS l'apertura della tastiera
    // riduce SOLO la visual viewport (non il layout viewport): rifare il letterbox
    // farebbe "restringere" la scena. Lo show/hide della barra indirizzi cambia il
    // layout viewport ed emette un normale 'resize' su window, già gestito sopra.
    // La visualViewport serve solo a riposizionare l'<input> nickname (vedi main.js).
    this._resize();
  }

  // Crea (una volta) il <div> sonda per leggere le safe-area insets via env().
  _createSafeProbe() {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    });
    document.body.appendChild(el);
    return el;
  }

  // Adatta il canvas alla finestra tenendo conto del DPR.
  _resize() {
    // Guardia tastiera iOS: se è a fuoco un campo di testo e l'altezza si è SOLO
    // ridotta (larghezza invariata), è l'apertura della tastiera — non un vero
    // resize di layout. NON rifare il letterbox, altrimenti la scena si restringe.
    // (La barra indirizzi cambia l'altezza ma SENZA input a fuoco → typing=false →
    //  rifà normalmente; la rotazione cambia anche la larghezza → rifà.)
    const dpr0 = window.devicePixelRatio || 1;
    const newW0 = Math.floor(window.innerWidth * dpr0);
    const newH0 = Math.floor(window.innerHeight * dpr0);
    const ae = document.activeElement;
    const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    if (typing && newW0 === this.canvas.width && newH0 < this.canvas.height) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    // Buffer fisico ad alta risoluzione.
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);

    // Scala "fit" che fa stare l'intera area logica nello schermo (letterbox).
    const scale = Math.min(cssW / LOGICAL_WIDTH, cssH / LOGICAL_HEIGHT);
    this._scale = scale * dpr;
    this._offsetX = (cssW * dpr - LOGICAL_WIDTH * this._scale) / 2;
    this._offsetY = (cssH * dpr - LOGICAL_HEIGHT * this._scale) / 2;

    // Safe-area insets: padding della sonda (px CSS) → logico (px CSS / scala fit).
    if (this._safeProbe) {
      const cs = getComputedStyle(this._safeProbe);
      const toLogical = (v) => (parseFloat(v) || 0) / scale;
      this._safe.left = toLogical(cs.paddingLeft);
      this._safe.right = toLogical(cs.paddingRight);
      this._safe.top = toLogical(cs.paddingTop);
      this._safe.bottom = toLogical(cs.paddingBottom);
    }
  }

  // Bordi del canvas REALE espressi in coordinate LOGICHE (per disegnare sfondi
  // che coprono anche le bande letterbox). Es: da extLeft (≤0) a extRight (≥W).
  get extLeft() {
    return -this._offsetX / this._scale;
  }
  get extTop() {
    return -this._offsetY / this._scale;
  }
  get extRight() {
    return (this.canvas.width - this._offsetX) / this._scale;
  }
  get extBottom() {
    return (this.canvas.height - this._offsetY) / this._scale;
  }

  // Bordi REALI del canvas rientrati della safe-area (notch/angoli/home-indicator),
  // in coordinate logiche. Su desktop/no-notch coincidono con ext* (insets 0).
  get safeLeft() {
    return this.extLeft + this._safe.left;
  }
  get safeRight() {
    return this.extRight - this._safe.right;
  }
  get safeTop() {
    return this.extTop + this._safe.top;
  }
  get safeBottom() {
    return this.extBottom - this._safe.bottom;
  }

  // Pulisce lo schermo e prepara la trasformazione logica per il frame.
  begin() {
    const ctx = this.ctx;
    // Reset completo della trasformazione e clear del buffer fisico.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Da qui in poi si disegna in coordinate logiche.
    ctx.setTransform(this._scale, 0, 0, this._scale, this._offsetX, this._offsetY);
  }

  // Helper: rettangolo pieno in coordinate logiche.
  rect(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  destroy() {
    window.removeEventListener('resize', this._resize);
  }
}

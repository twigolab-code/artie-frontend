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

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    window.addEventListener('orientationchange', this._resize);
    // iOS Safari: lo show/hide della barra cambia innerHeight ma non sempre emette
    // 'resize' pulito; visualViewport notifica il cambio reale dell'area visibile,
    // così il letterbox si ricalcola senza bande/jitter. (In standalone è inattivo.)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._resize);
      window.visualViewport.addEventListener('scroll', this._resize);
    }
    this._resize();
  }

  // Adatta il canvas alla finestra tenendo conto del DPR.
  _resize() {
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

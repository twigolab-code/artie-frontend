import { FLOOR_Y } from '../config.js';

// =============================================================================
// ImageBackground — sfondo da immagine ripetuta in loop orizzontale (tiling).
//
// Stessa firma di Background.render(renderer, cameraX, beatPulse, theme), così è
// intercambiabile nel registry BACKGROUNDS. Disegna solo il CIELO (da extTop fino
// a FLOOR_Y); sotto resta il pavimento del livello. Scorre in parallasse lenta
// rispetto al mondo e si ripete all'infinito lungo X. L'immagine è passata al
// costruttore come handle { img, ready } (vedi getSkin in Assets.js); finché non
// è pronta si disegna un gradiente di ripiego dal theme.
// =============================================================================
export class ImageBackground {
  constructor(imgHandle, { parallax = 0.15 } = {}) {
    this.handle = imgHandle;
    this.parallax = parallax;
  }

  render(renderer, cameraX, beatPulse, theme) {
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const skyH = FLOOR_Y - top; // altezza del cielo (sopra il pavimento)

    const h = this.handle;
    if (!h || !h.ready || !h.img.naturalWidth) {
      // Fallback: cielo a gradiente finché l'immagine non è caricata.
      const sky = ctx.createLinearGradient(0, top, 0, FLOOR_Y);
      sky.addColorStop(0, theme.top);
      sky.addColorStop(1, theme.bottom);
      ctx.fillStyle = sky;
      ctx.fillRect(left, top, right - left, skyH);
      return;
    }

    // Larghezza di un tile mantenendo il rapporto, scalato all'altezza del cielo.
    const tileW = skyH * (h.img.naturalWidth / h.img.naturalHeight);
    // Parallasse lenta: lo sfondo scorre meno del mondo.
    const scroll = cameraX * this.parallax;
    // Primo tile a sinistra del bordo, così la ripetizione copre tutto lo schermo.
    let x = left - ((scroll % tileW) + tileW) % tileW - tileW;

    ctx.save();
    // Clip al solo cielo: il pavimento (sotto FLOOR_Y) non viene mai coperto.
    ctx.beginPath();
    ctx.rect(left, top, right - left, skyH);
    ctx.clip();
    // Disegno ogni tile largo 1px in più, partendo da una X arrotondata a intero:
    // i bordi adiacenti si sovrappongono e la sottile "linea verticale" della
    // giunzione (sub-pixel) sparisce.
    while (x < right) {
      ctx.drawImage(h.img, Math.round(x), top, Math.ceil(tileW) + 1, skyH);
      x += tileW;
    }
    ctx.restore();
  }
}

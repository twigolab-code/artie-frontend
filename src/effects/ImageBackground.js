import { FLOOR_Y } from '../config.js';

// =============================================================================
// ImageBackground — sfondo da immagine ripetuta in loop orizzontale (tiling).
//
// Stessa firma di Background.render(renderer, cameraX, beatPulse, theme), così è
// intercambiabile nel registry BACKGROUNDS. Di DEFAULT disegna da extTop fino a
// FLOOR_Y (solo cielo; in gioco il pavimento procedurale copre sotto), ma può
// riempire fino a un `bottomY` arbitrario (es. extBottom) per un backdrop a piena
// altezza nei menu (evita la fascia scura sotto FLOOR_Y). Scorre in parallasse
// lenta rispetto al mondo e si ripete all'infinito lungo X. L'immagine è passata al
// costruttore come handle { img, ready } (vedi getSkin in Assets.js); finché non
// è pronta si disegna un gradiente di ripiego dal theme.
// =============================================================================
export class ImageBackground {
  constructor(imgHandle, { parallax = 0.15 } = {}) {
    this.handle = imgHandle;
    this.parallax = parallax;
  }

  // `cropBottomFrac` (0..1): ritaglia quella frazione dal BASSO dell'immagine
  // sorgente, così il "pavimento" disegnato nell'immagine non viene campionato e
  // resta solo il cielo (usato nell'anteprima della selezione livelli). Default 0
  // = immagine intera.
  // `bottomY`: bordo inferiore fino a cui disegnare. Default FLOOR_Y (solo cielo,
  // come in gioco); i menu passano renderer.extBottom per riempire tutto lo schermo
  // (niente fascia scura sotto FLOOR_Y).
  render(renderer, cameraX, beatPulse, theme, cropBottomFrac = 0, bottomY = FLOOR_Y) {
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const drawH = bottomY - top; // altezza del riquadro disegnato (cielo o piena)

    const h = this.handle;
    if (!h || !h.ready || !h.img.naturalWidth) {
      // Fallback: gradiente finché l'immagine non è caricata (riempie fino a bottomY).
      const sky = ctx.createLinearGradient(0, top, 0, bottomY);
      sky.addColorStop(0, theme.top);
      sky.addColorStop(1, theme.bottom);
      ctx.fillStyle = sky;
      ctx.fillRect(left, top, right - left, drawH);
      return;
    }

    // Porzione di immagine sorgente da usare: tolgo `cropBottomFrac` dal basso
    // (il pavimento dipinto nell'asset). srcH è l'altezza campionata; il tile
    // mantiene il rapporto larghezza/altezza della SOLA porzione disegnata.
    const frac = Math.max(0, Math.min(0.9, cropBottomFrac));
    const srcH = h.img.naturalHeight * (1 - frac);
    // Larghezza di un tile mantenendo il rapporto della porzione, scalato a drawH.
    const tileW = drawH * (h.img.naturalWidth / srcH);
    // Parallasse lenta: lo sfondo scorre meno del mondo.
    const scroll = cameraX * this.parallax;
    // Primo tile a sinistra del bordo, così la ripetizione copre tutto lo schermo.
    let x = left - ((scroll % tileW) + tileW) % tileW - tileW;

    ctx.save();
    // Clip al riquadro [top, bottomY]: default = solo cielo; menu = tutto schermo.
    ctx.beginPath();
    ctx.rect(left, top, right - left, drawH);
    ctx.clip();
    // Disegno ogni tile largo 1px in più, partendo da una X arrotondata a intero:
    // i bordi adiacenti si sovrappongono e la sottile "linea verticale" della
    // giunzione (sub-pixel) sparisce. drawImage con source-rect: campiono solo la
    // parte alta (0..srcH) dell'immagine, scartando il pavimento in basso.
    while (x < right) {
      ctx.drawImage(
        h.img,
        0, 0, h.img.naturalWidth, srcH,
        Math.round(x), top, Math.ceil(tileW) + 1, drawH
      );
      x += tileW;
    }
    ctx.restore();
  }
}

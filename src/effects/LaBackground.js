import {
  FLOOR_Y,
  LA_SILHOUETTE,
  LA_SILHOUETTE_FAR,
  LA_CLOUD_COLOR,
  LA_SUN_COLOR,
} from '../config.js';
import { PALM_IMG } from '../engine/Assets.js';

// =============================================================================
// LaBackground — tramonto sulla spiaggia di Los Angeles, a parallasse.
//
// Stessa firma di Background.render(renderer, cameraX, beatPulse, theme).
// Disegna fino ai BORDI REALI del canvas (extLeft..extRight) per coprire le
// bande letterbox. Tutto procedurale e deterministico (hash, niente
// Math.random). Ordine dietro->davanti: cielo, sole, nuvole, strato lontano
// (palme piccole + case + ruota panoramica + molo), strato vicino (palme alte
// + case + lampione), vela verso il pavimento.
// =============================================================================

function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// =============================================================================
// Sagoma FISSA della palma (Path2D), ricalcata dalla reference: tronco curvo a
// "S" + 7 grandi fronde che si irradiano dalla corona e ricadono, con bordo
// dentellato (foglioline). Costruita UNA volta in coordinate normalizzate in un
// box PALM_W x PALM_H, con base del tronco in (PALM_BASE_X, PALM_H). _palm la
// riscala/posiziona/specchia. Niente Math.random: forma deterministica.
// =============================================================================
const PALM_W = 220;
const PALM_H = 300;
const PALM_BASE_X = 118; // ascissa della base del tronco (leggermente a dx)
const PALM_CROWN_X = 100; // centro corona
const PALM_CROWN_Y = 86; // quota corona (0 = top)

// Aggiunge al path una fronda PIENA ricadente con bordo dentellato.
// `elevDeg` = elevazione in gradi sopra l'orizzonte (+90 = dritta in alto,
// 0 = orizzontale a destra, 180 = orizzontale a sinistra). La foglia parte dalla
// corona (cx,cy), è lunga `len`, larga `wid`, e ricade di `droop` alla punta.
function palmFrond(path, cx, cy, elevDeg, len, wid, droop) {
  const ang = (-elevDeg * Math.PI) / 180; // in canvas y è in giù: "su" = ang negativo
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  // rachide: base -> apice (in direzione ang) -> punta che ricade in basso.
  const apX = cx + dx * len * 0.6;
  const apY = cy + dy * len * 0.6;
  const tipX = cx + dx * len;
  const tipY = cy + dy * len + droop;
  // normale (perpendicolare alla direzione) per dare spessore.
  const nx = -dy;
  const ny = dx;

  const N = 7; // numero di tacche/foglioline lungo il bordo
  // campiona il rachide come bezier quadratica (base, apice come control, tip).
  const spine = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const it = 1 - t;
    spine.push([
      it * it * cx + 2 * it * t * apX + t * t * tipX,
      it * it * cy + 2 * it * t * apY + t * t * tipY,
    ]);
  }
  const widthAt = (t) => wid * Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.85;

  path.moveTo(spine[0][0], spine[0][1]);
  // bordo esterno con dentini (verso il basso/fuori).
  for (let k = 1; k <= N; k++) {
    const t = k / N;
    const w = widthAt(t);
    const [sx, sy] = spine[k];
    const tooth = (k % 2 === 0 ? 1.0 : 0.55) * w; // tacche regolari
    path.lineTo(sx + nx * tooth, sy + ny * tooth);
  }
  // ritorno lungo il bordo interno (liscio).
  for (let k = N; k >= 0; k--) {
    const t = k / N;
    const w = widthAt(t) * 0.45;
    const [sx, sy] = spine[k];
    path.lineTo(sx - nx * w, sy - ny * w);
  }
  path.closePath();
}

function buildPalmPath() {
  const p = new Path2D();
  const bx = PALM_BASE_X;
  const cx = PALM_CROWN_X;
  const cy = PALM_CROWN_Y;

  // 1) Tronco curvo a "S": dalla base (in basso) sale curvando fino alla corona.
  //    Disegnato come banda chiusa (bordo sx in salita, bordo dx in discesa).
  const baseHalf = 13; // mezza larghezza alla base
  const topHalf = 5; // mezza larghezza in cima
  // punti di controllo per la curva a S del centro del tronco.
  // base (bx, PALM_H) -> ventre a dx -> cima (cx, cy)
  p.moveTo(bx - baseHalf, PALM_H);
  p.bezierCurveTo(bx - baseHalf - 6, PALM_H - 120, cx - 30, cy + 120, cx - topHalf, cy + 8);
  p.lineTo(cx + topHalf, cy + 8);
  p.bezierCurveTo(cx - 14, cy + 120, bx + baseHalf + 10, PALM_H - 120, bx + baseHalf, PALM_H);
  p.closePath();

  // 2) Sette fronde a ventaglio dalla corona: da sinistra (elev 165°) all'alto
  //    (90°) a destra (elev 15°). Le laterali ricadono di più (effetto fontana).
  const L = 120; // lunghezza fronda di base
  const W = 27; // larghezza foglia
  const D = 78; // ricaduta alla punta
  const elevs = [165, 132, 106, 90, 74, 48, 15];
  for (const e of elevs) {
    const lateral = Math.abs(Math.cos((e * Math.PI) / 180)); // 0 in alto, 1 ai lati
    palmFrond(p, cx, cy, e, L * (0.9 + lateral * 0.25), W, D * (0.5 + lateral * 0.9));
  }
  return p;
}

// Costruzione lazy: Path2D non esiste in ambienti senza canvas (es. test Node);
// il path viene creato alla prima palma disegnata e poi riusato.
let PALM_PATH = null;
function palmPath() {
  if (!PALM_PATH) PALM_PATH = buildPalmPath();
  return PALM_PATH;
}

export class LaBackground {
  render(renderer, cameraX, beatPulse, theme) {
    const ctx = renderer.ctx;
    const left = renderer.extLeft;
    const right = renderer.extRight;
    const top = renderer.extTop;
    const bottom = renderer.extBottom;
    const width = right - left;

    // 1) Cielo tramonto (viola in alto -> arancio/giallo orizzonte).
    const sky = ctx.createLinearGradient(0, top, 0, FLOOR_Y);
    sky.addColorStop(0, theme.top);
    sky.addColorStop(1, theme.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(left, top, width, bottom - top);

    // 2) Sole basso sull'orizzonte (alone radiale morbido), parallasse molto lenta.
    this._sun(ctx, cameraX, left, right);

    // 3) Nuvole rosa-crema in alto, parallasse lenta.
    this._clouds(ctx, cameraX, left, right);

    // 4) Strato LONTANO (atmosferico, più chiaro): palme piccole + case basse +
    //    ruota panoramica + molo all'orizzonte.
    this._farLayer(ctx, cameraX, left, right);

    // 5) Strato VICINO (scuro): palme alte + case + lampione.
    this._nearLayer(ctx, cameraX, left, right);

    // 6) Vela scura verso il pavimento per staccare il gameplay.
    const veil = ctx.createLinearGradient(0, FLOOR_Y - 160, 0, FLOOR_Y);
    veil.addColorStop(0, 'rgba(20,10,40,0)');
    veil.addColorStop(1, 'rgba(20,10,40,0.4)');
    ctx.fillStyle = veil;
    ctx.fillRect(left, FLOOR_Y - 160, width, 160);
  }

  // Sole come disco morbido appena sopra l'orizzonte (linea pavimento).
  // Parallasse molto lenta: resta quasi fermo sul fondo come un astro lontano.
  _sun(ctx, cameraX, left, right) {
    const sunX = (left + right) * 0.5 - (cameraX * 0.02);
    const sunY = FLOOR_Y - 70;
    const r = 90;
    const g = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, r);
    g.addColorStop(0, LA_SUN_COLOR);
    g.addColorStop(0.5, 'rgba(255,200,120,0.5)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  _clouds(ctx, cameraX, left, right) {
    ctx.fillStyle = LA_CLOUD_COLOR;
    const speed = 0.05;
    const period = 600;
    const offset = (cameraX * speed) % period;
    const startCol = Math.floor((cameraX * speed) / period) - 1;
    for (let x = left - period; x < right + period; x += period) {
      const i = Math.round((x + offset) / period) + startCol;
      const y = 80 + (((i % 3) + 3) % 3) * 34;
      this._cloud(ctx, x - offset + 160, y, 70 + (((i % 2) + 2) % 2) * 26, i);
    }
  }

  // Nuvola morbida a "bolle": cerchi sovrapposti di raggio variabile.
  _cloud(ctx, x, y, r, seed) {
    const lobes = 5;
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const t = i / (lobes - 1) - 0.5; // -0.5..0.5
      const lx = x + t * r * 2.2;
      const ly = y - Math.cos(t * Math.PI) * r * 0.25 + (rand(seed * 3.1 + i) - 0.5) * r * 0.12;
      const lr = r * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (0.7 + rand(seed + i * 2.7) * 0.3);
      ctx.moveTo(lx + lr, ly);
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // --- Strato lontano (chiaro/atmosferico) -----------------------------------
  _farLayer(ctx, cameraX, left, right) {
    const speed = 0.18;
    const period = 520;
    const scrollX = cameraX * speed;
    const worldLeft = scrollX + left;
    const firstSlot = Math.floor(worldLeft / period) - 1;
    const slots = Math.ceil((right - left) / period) + 2;

    for (let s = 0; s < slots; s++) {
      const slot = firstSlot + s;
      const baseX = slot * period - scrollX;
      const r1 = rand(slot * 12.3 + 4.1);
      const r2 = rand(slot * 7.7 + 9.3);

      // Una fila di case basse lontane lungo lo slot.
      this._house(ctx, baseX + 40, 70 + r1 * 30, LA_SILHOUETTE_FAR);
      this._house(ctx, baseX + 200, 60 + r2 * 26, LA_SILHOUETTE_FAR);
      // Palme piccole.
      this._palm(ctx, baseX + 130, 150 + r1 * 40, slot * 2 + 1, LA_SILHOUETTE_FAR);
      this._palm(ctx, baseX + 330, 140 + r2 * 50, slot * 2 + 7, LA_SILHOUETTE_FAR);
      // Ruota panoramica una volta ogni tot slot.
      if ((((slot % 3) + 3) % 3) === 0) this._ferrisWheel(ctx, baseX + 270, LA_SILHOUETTE_FAR);
      // Molo verso l'orizzonte ogni tot slot (sfalsato dalla ruota).
      if ((((slot % 4) + 4) % 4) === 2) this._pier(ctx, baseX + 60, LA_SILHOUETTE_FAR);
    }
  }

  // --- Strato vicino (scuro) -------------------------------------------------
  _nearLayer(ctx, cameraX, left, right) {
    const speed = 0.5;
    const period = 460;
    const scrollX = cameraX * speed;
    const worldLeft = scrollX + left;
    const firstSlot = Math.floor(worldLeft / period) - 1;
    const slots = Math.ceil((right - left) / period) + 2;

    for (let s = 0; s < slots; s++) {
      const slot = firstSlot + s;
      const baseX = slot * period - scrollX;
      const r1 = rand(slot * 5.9 + 1.7);
      const r2 = rand(slot * 9.1 + 3.3);
      const r3 = rand(slot * 2.7 + 8.9);

      // Casa bassa col balcone (vicina, più grande).
      this._house(ctx, baseX + 30, 110 + r1 * 40, LA_SILHOUETTE);
      // 2-3 palme alte sparse nello slot.
      this._palm(ctx, baseX + 180, 240 + r2 * 70, slot * 3 + 2, LA_SILHOUETTE);
      this._palm(ctx, baseX + 300, 210 + r3 * 80, slot * 3 + 5, LA_SILHOUETTE);
      if (r1 > 0.5) this._palm(ctx, baseX + 400, 200 + r1 * 60, slot * 3 + 9, LA_SILHOUETTE);
      // Lampione ogni tot slot.
      if ((((slot % 2) + 2) % 2) === 1) this._lamp(ctx, baseX + 120, LA_SILHOUETTE);
    }
  }

  // Palma: silhouette dal PNG (palm.png), riscalata all'altezza richiesta, base
  // del tronco su (x, FLOOR_Y). Variazione leggera: alcune specchiate (mirror).
  // Lo strato lontano (LA_SILHOUETTE_FAR) e' reso piu' sbiadito per la profondita.
  // Se il PNG non e' ancora caricato, fallback alla sagoma vettoriale PALM_PATH.
  _palm(ctx, x, height, seed, color) {
    const mirror = rand(seed * 9.7) < 0.5 ? -1 : 1;

    if (PALM_IMG && PALM_IMG.ready) {
      const iw = PALM_IMG.img.naturalWidth || 295;
      const ih = PALM_IMG.img.naturalHeight || 404;
      const w = height * (iw / ih); // mantiene le proporzioni native
      ctx.save();
      ctx.translate(x, FLOOR_Y);
      ctx.scale(mirror, 1);
      if (color === LA_SILHOUETTE_FAR) ctx.globalAlpha = 0.55; // palme lontane sbiadite
      ctx.drawImage(PALM_IMG.img, -w / 2, -height, w, height);
      ctx.restore();
      return;
    }

    // Fallback vettoriale (sagoma fissa) finche' il PNG non e' caricato.
    const scale = height / PALM_H;
    ctx.save();
    ctx.translate(x, FLOOR_Y);
    ctx.scale(scale * mirror, scale);
    ctx.translate(-PALM_BASE_X, -PALM_H);
    ctx.fillStyle = color;
    ctx.fill(palmPath());
    ctx.restore();
  }

  // Casa bassa: corpo rettangolare + tetto piatto + qualche finestra "vuota".
  _house(ctx, x, h, color) {
    const baseY = FLOOR_Y;
    const w = 120 + (h % 30) * 2;
    const topY = baseY - h;
    ctx.fillStyle = color;
    ctx.fillRect(x, topY, w, h);
    // Cornicione/tetto leggermente sporgente.
    ctx.fillRect(x - 6, topY - 8, w + 12, 8);
  }

  // Ruota panoramica: cerchio + raggi + cabine + sostegno a cavalletto.
  _ferrisWheel(ctx, cx, color) {
    const r = 70;
    const cy = FLOOR_Y - r - 20;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    // Cerchio esterno.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Raggi.
    const spokes = 12;
    ctx.lineWidth = 2;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    // Cabine.
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sostegno a cavalletto fino a terra.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 22, FLOOR_Y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 22, FLOOR_Y);
    ctx.stroke();
  }

  // Molo: piattaforma orizzontale su pilastri, che si allunga verso l'orizzonte.
  _pier(ctx, x, color) {
    const deckY = FLOOR_Y - 30;
    const w = 220;
    ctx.fillStyle = color;
    // Impalcato.
    ctx.fillRect(x, deckY, w, 8);
    // Pilastri.
    for (let px = x + 10; px < x + w; px += 34) {
      ctx.fillRect(px, deckY + 8, 5, FLOOR_Y - (deckY + 8));
    }
  }

  // Lampione: palo + braccio + lanterna.
  _lamp(ctx, x, color) {
    const baseY = FLOOR_Y;
    const h = 150;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    // Palo.
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - h);
    ctx.stroke();
    // Testa/lanterna.
    ctx.beginPath();
    ctx.arc(x, baseY - h - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 12, baseY - h - 16, 24, 8);
  }
}

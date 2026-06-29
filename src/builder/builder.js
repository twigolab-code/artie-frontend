// =============================================================================
// builder.js — Game Builder interno (editor di livelli) per OG DASH.
//
// Pagina standalone (builder.html, servita da Vite a /builder.html). Replica la
// griglia di gioco (12 righe × N colonne, TILE=60) e permette di posizionare gli
// elementi via "palette + paint": scegli un tile, clicca/trascini sulle celle.
// Validazione LIVE con la stessa logica del checker (src/data/validate.js), così
// "verde" qui ⇒ passa `node scripts/check-levels.mjs`. Esporta il file dati pronto
// da incollare in src/data/ (array di 12 stringhe).
//
// È un tool INTERNO: niente menù del gioco, niente persistenza, niente fisica del
// runtime — disegna la griglia in modo deterministico, "echeggiando" i colori del
// gioco senza importare Obstacle/Level (che vogliono camera/stato di gioco).
// =============================================================================
import { invariants, playable } from '../data/validate.js';
import {
  THEME_PRESETS,
  DIFFS,
  getCustomLevels,
  saveCustomLevel,
  deleteCustomLevel,
  buildCustomEntry,
  uniqueCustomId,
} from '../data/customLevels.js';
import { PlaytestPreview } from './playtest.js';

// Mappe attuali per "Carica livello…" (modifica i percorsi esistenti).
import { skyline } from '../data/skyline.js';
import { skyline2 } from '../data/skyline2.js';
import { metro2 } from '../data/metro2.js';
import { carwash } from '../data/carwash.js';
import { boulevard } from '../data/boulevard.js';

const EXISTING = { skyline, skyline2, metro2, carwash, boulevard };

// --- Costanti griglia (da config.js) ---------------------------------------
const ROWS = 12;
const TILE = 60;
const GROUND_ROW = 9; // riga del terreno
const LOCKED_ROWS = [10, 11]; // solo render pavimento → sempre '0'
const MIN_COLS = 40; // larghezza iniziale comoda

// --- Definizione degli elementi (palette) ----------------------------------
// `code` = carattere nella griglia. `paint:false` = strumento speciale (gomma).
const PALETTE = [
  { code: '0', name: 'Gomma (vuoto)', color: 'transparent', glyph: '·', light: true },
  { code: '1', name: 'Blocco', color: '#7a0a0a', glyph: '■' },
  { code: '2', name: 'Spuntone', color: '#e02314', glyph: '▲' },
  { code: '6', name: 'Spuntone piccolo', color: '#e0631c', glyph: '◣' },
  { code: '7', name: 'Spuntone soffitto', color: '#c01030', glyph: '▼' },
  { code: 's', name: 'Pavimento spinato', color: '#9a1840', glyph: 'ʌʌ' },
  { code: '3', name: 'Portale → ship', color: '#ff3fae', glyph: 'S', light: true },
  { code: '4', name: 'Portale → cube', color: '#3fff9e', glyph: 'C' },
  { code: '5', name: 'Orb (salto)', color: '#ffd23f', glyph: '◯' },
  { code: '8', name: 'Pad (balzo)', color: '#ffd23f', glyph: '▭' },
  { code: '9', name: 'Moneta', color: '#ffcc33', glyph: '●' },
];
const COLOR_BY_CODE = Object.fromEntries(PALETTE.map(p => [p.code, p]));

// --- Stato ------------------------------------------------------------------
let cols = MIN_COLS;
// grid[r] = array di caratteri (mutabile cella per cella). Tutto '0' all'avvio.
let grid = makeBlank(MIN_COLS);
let activeCode = '2'; // tile selezionato (default: spuntone)
let scrollX = 0; // offset orizzontale in px logici
let scrollY = 0; // offset verticale in px logici (usato solo quando zoom>1)
let painting = false; // sta dipingendo (mouse giù)
let panning = false; // sta trascinando per scorrere (tasto centrale / spazio)
let panStart = null; // {mx, my, scrollX, scrollY}
let hoverCell = null; // {col, row} sotto al cursore

// --- Zoom -------------------------------------------------------------------
let zoom = 1; // moltiplica la scala base (fit-to-height)
const ZOOM_MIN = 0.5, ZOOM_MAX = 3, ZOOM_STEP = 1.2; // step moltiplicativo

// --- Strumento + selezione/sposta -------------------------------------------
let tool = 'paint'; // 'paint' | 'select'
let selectPhase = 'idle'; // 'idle' | 'selecting' | 'selected' | 'moving'
let selRect = null; // {c0,r0,c1,r1} inclusivo, in coordinate cella (normalizzato)
let dragAnchor = null; // {col,row} cella di partenza del drag (rubber-band o move)
let moveOffset = null; // {dc,dr} offset corrente in celle durante 'moving'
let liftedCells = null; // [{dc,dr,code}] codici sollevati relativi a selRect.c0/r0

function makeBlank(w) {
  return Array.from({ length: ROWS }, () => Array.from({ length: w }, () => '0'));
}

// Converte una griglia "array di stringhe" (formato dati) → modello interno.
function fromStrings(strs) {
  const w = Math.max(...strs.map(s => s.length));
  cols = w;
  grid = strs.map(s => {
    const arr = s.split('');
    while (arr.length < w) arr.push('0');
    return arr;
  });
  // garantisci 12 righe
  while (grid.length < ROWS) grid.push(Array.from({ length: w }, () => '0'));
}

// Modello interno → array di 12 stringhe (formato dati, righe di pari larghezza).
function toStrings() {
  return grid.map(row => row.join(''));
}

// --- DOM refs ---------------------------------------------------------------
const canvas = document.getElementById('builder');
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');
const paletteEl = document.getElementById('palette');
const verdictEl = document.getElementById('verdict');
const statsEl = document.getElementById('stats');
const checksEl = document.getElementById('checks');
const legendEl = document.getElementById('legend');
const modal = document.getElementById('modal');
const zoomPctEl = document.getElementById('zoomPct');
const btnSelect = document.getElementById('btnSelect');

// --- Palette UI -------------------------------------------------------------
function buildPalette() {
  paletteEl.querySelectorAll('.swatch').forEach(n => n.remove());
  for (const item of PALETTE) {
    const b = document.createElement('button');
    b.className = 'swatch' + (item.code === activeCode ? ' active' : '');
    b.dataset.code = item.code;
    const chipBg = item.color === 'transparent' ? 'repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 10px 10px' : item.color;
    b.innerHTML =
      `<span class="chip" style="background:${chipBg}; color:${item.light ? '#000' : '#fff'}">${item.glyph}</span>` +
      `<span class="lbl">${item.name}</span>` +
      `<span class="code">${item.code === '0' ? '⌫' : item.code}</span>`;
    b.addEventListener('click', () => {
      activeCode = item.code;
      buildPalette();
    });
    paletteEl.appendChild(b);
  }
}

function buildLegend() {
  legendEl.innerHTML =
    '<b>Griglia:</b> riga 9 = terra (i tile poggiano sulla linea bianca = superficie del ' +
    'pavimento), righe 10-11 = pavimento pieno (bloccate, solo render), ' +
    'righe 0-1 = zona morte soffitto.<br><br>' +
    '<b>Regole rapide:</b> salto ~3 tile, atterraggio ≤ +2 (≤ +3 con orb), ' +
    'gap ≤ 5 tile, max 4 hazard a terra contigui, esattamente 5 monete. ' +
    'Sezione ship: apri con 3, chiudi con 4; 7 e 2 mai nella stessa colonna.';
}

// --- Layout / coordinate ----------------------------------------------------
function resize() {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(wrap.clientWidth * dpr);
  canvas.height = Math.floor(wrap.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clampScroll(); // un resize mentre si è zoomati può lasciare scrollY fuori range
  draw();
}

function viewW() { return canvas.parentElement.clientWidth; }
function viewH() { return canvas.parentElement.clientHeight; }

// Scala base: fa entrare le 12 righe (720px logici) nell'altezza vista (zoom=1).
function baseScale() { return viewH() / (ROWS * TILE); }
// Scala effettiva = base × zoom. UNICA fonte: tutto il resto (pointToCell, draw,
// maxScroll, ruler, pan) deriva da qui, quindi lo zoom si propaga da solo.
function scaleY() { return baseScale() * zoom; }

// Punto pixel (vista) → coordinate mondo (px logici, frazionarie).
function pointToWorld(px, py) {
  const s = scaleY();
  return { wx: px / s + scrollX, wy: py / s + scrollY };
}
// Punto pixel (vista) → cella griglia.
function pointToCell(px, py) {
  const { wx, wy } = pointToWorld(px, py);
  return { col: Math.floor(wx / TILE), row: Math.floor(wy / TILE) };
}

function maxScroll() {
  const s = scaleY();
  const totalW = cols * TILE;
  const visW = viewW() / s;
  return Math.max(0, totalW - visW + TILE * 4); // un po' di margine a destra
}
// Scroll verticale massimo: 0 quando zoom≤1 (le 12 righe ci stanno tutte), così
// scrollY si auto-blocca a 0 senza casi speciali.
function maxScrollY() {
  const s = scaleY();
  const visH = viewH() / s;
  return Math.max(0, ROWS * TILE - visH);
}
function clampScroll() {
  scrollX = Math.max(0, Math.min(scrollX, maxScroll()));
  scrollY = Math.max(0, Math.min(scrollY, maxScrollY()));
}

// Imposta lo zoom mantenendo fisso il punto mondo sotto al cursore (anchorX/Y in
// px vista; se assenti, ancora al centro). Aggiorna scroll, ridisegna, aggiorna UI.
function setZoom(nextZoom, anchorX, anchorY) {
  nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
  if (nextZoom === zoom) return;
  const ax = anchorX == null ? viewW() / 2 : anchorX;
  const ay = anchorY == null ? viewH() / 2 : anchorY;
  const before = pointToWorld(ax, ay); // mondo sotto al cursore PRIMA
  zoom = nextZoom;
  const s = scaleY();
  scrollX = before.wx - ax / s; // stesso mondo resta sotto (ax,ay)
  scrollY = before.wy - ay / s;
  clampScroll();
  updateZoomUI();
  draw();
}
function updateZoomUI() {
  if (zoomPctEl) zoomPctEl.textContent = `${Math.round(zoom * 100)}%`;
}

// --- Mutazione griglia ------------------------------------------------------
function ensureCols(minCols) {
  if (minCols <= cols) return;
  const add = minCols - cols;
  for (const row of grid) for (let i = 0; i < add; i++) row.push('0');
  cols = minCols;
}

function paintCell(col, row) {
  if (col < 0 || row < 0 || row >= ROWS) return;
  // righe 10-11 bloccate: solo '0' (render pavimento)
  if (LOCKED_ROWS.includes(row) && activeCode !== '0') return;
  ensureCols(col + 1);
  if (grid[row][col] === activeCode) return; // niente da fare
  grid[row][col] = activeCode;
  scheduleValidate();
  draw();
}

function clearAll() {
  cols = MIN_COLS;
  grid = makeBlank(MIN_COLS);
  scrollX = 0;
  scrollY = 0;
  clearSelection();
  scheduleValidate();
  draw();
}

// --- Selezione / spostamento blocco -----------------------------------------
function normRect(a, b) {
  return {
    c0: Math.min(a.col, b.col), c1: Math.max(a.col, b.col),
    r0: Math.min(a.row, b.row), r1: Math.max(a.row, b.row),
  };
}
function clampRectToGrid(r) {
  return {
    c0: Math.max(0, r.c0), c1: Math.min(cols - 1, r.c1),
    r0: Math.max(0, r.r0), r1: Math.min(ROWS - 1, r.r1),
  };
}
function rectContainsCell(r, col, row) {
  return col >= r.c0 && col <= r.c1 && row >= r.r0 && row <= r.r1;
}
function clearSelection() {
  selRect = null;
  selectPhase = 'idle';
  liftedCells = null;
  dragAnchor = null;
  moveOffset = null;
}

// Solleva i codici dei tile selezionati (relativi al top-left), saltando le righe
// bloccate (10-11) e le celle vuote. Chiamata entrando in 'moving'.
function captureSelection() {
  liftedCells = [];
  for (let r = selRect.r0; r <= selRect.r1; r++) {
    if (LOCKED_ROWS.includes(r)) continue;
    for (let c = selRect.c0; c <= selRect.c1; c++) {
      const code = grid[r][c];
      if (code === '0') continue;
      liftedCells.push({ dc: c - selRect.c0, dr: r - selRect.r0, code });
    }
  }
}

// Sposta il blocco selezionato di (dc,dr) celle: cancella la sorgente e ristampa
// a destinazione (cut+paste). Scarta le celle che finirebbero fuori griglia o nelle
// righe bloccate. La selezione segue la nuova posizione.
function commitMove(dc, dr) {
  if (!liftedCells || (dc === 0 && dr === 0)) return;
  const maxCol = selRect.c1 + dc;
  if (maxCol + 1 > cols) ensureCols(maxCol + 1);
  // 1) cancella la sorgente (solo celle sollevate = non bloccate)
  for (const { dc: cdc, dr: cdr } of liftedCells) {
    grid[selRect.r0 + cdr][selRect.c0 + cdc] = '0';
  }
  // 2) stampa a destinazione (scarta fuori-bound / righe bloccate)
  for (const { dc: cdc, dr: cdr, code } of liftedCells) {
    const tc = selRect.c0 + cdc + dc;
    const tr = selRect.r0 + cdr + dr;
    if (tc < 0 || tr < 0 || tr >= ROWS) continue;
    if (LOCKED_ROWS.includes(tr)) continue;
    if (tc + 1 > cols) ensureCols(tc + 1);
    grid[tr][tc] = code;
  }
  // 3) la selezione segue lo spostamento (clamp alle righe valide)
  selRect = clampRectToGrid({
    c0: selRect.c0 + dc, c1: selRect.c1 + dc,
    r0: selRect.r0 + dr, r1: selRect.r1 + dr,
  });
  liftedCells = null;
  clampScroll();
  scheduleValidate();
  draw();
}

// Cancella i tile dentro la selezione (Canc/Backspace in modalità select).
function deleteSelection() {
  if (!selRect) return;
  for (let r = selRect.r0; r <= selRect.r1; r++) {
    if (LOCKED_ROWS.includes(r)) continue;
    for (let c = selRect.c0; c <= selRect.c1; c++) grid[r][c] = '0';
  }
  clearSelection();
  scheduleValidate();
  draw();
}

// Taglia le colonne vuote in coda (mantiene almeno MIN_COLS).
function trimTrailing() {
  let last = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < ROWS; r++) if (grid[r][c] !== '0') { last = c; break; }
  }
  const keep = Math.max(MIN_COLS, last + 2); // +1 buffer colonna vuota di fine
  if (keep < cols) {
    for (const row of grid) row.length = keep;
    cols = keep;
  }
  clampScroll();
  scheduleValidate();
  draw();
}

// --- Rendering --------------------------------------------------------------
function draw() {
  const s = scaleY();
  const w = viewW(), h = viewH();
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-scrollX, -scrollY);

  const left = scrollX;
  const right = scrollX + w / s;
  const c0 = Math.max(0, Math.floor(left / TILE) - 1);
  const c1 = Math.min(cols, Math.ceil(right / TILE) + 1);
  // Finestra di righe visibili (quando zoomati non disegnamo le 12 righe inutili).
  const top = scrollY, bottom = scrollY + h / s;
  const r0 = Math.max(0, Math.floor(top / TILE) - 1);
  const r1 = Math.min(ROWS, Math.ceil(bottom / TILE) + 1);

  // Bande di sfondo: zona morte soffitto (0-1), corpo, terra (9), pavimento (10-11)
  drawBand(c0, c1, 0, 2, 'rgba(224,35,20,0.07)'); // zona morte soffitto
  drawBand(c0, c1, GROUND_ROW, 1, 'rgba(255,255,255,0.06)'); // riga terra (su cui poggiano i tile)
  // Pavimento (righe 10-11): banda PIENA e opaca come in gioco — qui c'è il "terreno",
  // così i tile a terra (riga 9) si vedono POGGIARE sul pavimento, non sospesi nel vuoto.
  drawFloorBand(c0, c1);

  // Gridlines
  ctx.lineWidth = 1 / s;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  for (let c = c0; c <= c1; c++) {
    const x = c * TILE;
    ctx.moveTo(x, 0); ctx.lineTo(x, ROWS * TILE);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = r * TILE;
    ctx.moveTo(left, y); ctx.lineTo(right, y);
  }
  ctx.stroke();

  // Linea pavimento evidenziata: il BORDO INFERIORE della riga 9 = FLOOR_Y (600),
  // cioè la superficie del pavimento del gioco. I tile a terra (riga 9, 540→600) la
  // toccano dal basso: POGGIANO sul pavimento, non pendono sotto una linea a 540.
  const floorY = (GROUND_ROW + 1) * TILE; // 600 = FLOOR_Y
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3 / s;
  ctx.beginPath();
  ctx.moveTo(left, floorY);
  ctx.lineTo(right, floorY);
  ctx.stroke();

  // Tile posizionati (solo finestra visibile righe×colonne)
  for (let c = c0; c < c1; c++) {
    for (let r = r0; r < r1; r++) {
      const code = grid[r][c];
      if (code === '0') continue;
      drawTile(code, c, r);
    }
  }

  // Selezione + "ghost" durante lo spostamento (solo in modalità select).
  if (tool === 'select' && selRect) drawSelection(s);

  // Cella sotto al cursore (anteprima) — solo in modalità disegno.
  if (tool === 'paint' && hoverCell && hoverCell.col >= 0 && hoverCell.row >= 0 && hoverCell.row < ROWS) {
    const x = hoverCell.col * TILE, y = hoverCell.row * TILE;
    ctx.fillStyle = 'rgba(255,210,63,0.18)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,210,63,0.7)';
    ctx.lineWidth = 2 / s;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }

  ctx.restore();

  // Etichette colonne ogni 5 (in screen space, in basso)
  drawColumnRuler(s);
  updateHud();
}

// Disegna il rettangolo di selezione (tinta + bordo tratteggiato) e, durante lo
// spostamento, il "ghost" dei tile sollevati all'offset corrente. In coord mondo
// (chiamata dentro draw(), col context già scalato/traslato).
function drawSelection(s) {
  const { c0, r0, c1, r1 } = selRect;
  const x = c0 * TILE, y = r0 * TILE;
  const w = (c1 - c0 + 1) * TILE, hh = (r1 - r0 + 1) * TILE;
  ctx.fillStyle = 'rgba(43,84,224,0.18)'; // tinta blu UI
  ctx.fillRect(x, y, w, hh);
  ctx.strokeStyle = 'rgba(120,160,255,0.95)';
  ctx.lineWidth = 2 / s;
  ctx.setLineDash([8 / s, 6 / s]);
  ctx.strokeRect(x + 1 / s, y + 1 / s, w - 2 / s, hh - 2 / s);
  ctx.setLineDash([]);

  if (selectPhase === 'moving' && liftedCells && moveOffset) {
    ctx.globalAlpha = 0.55;
    for (const { dc, dr, code } of liftedCells) {
      drawTile(code, c0 + dc + moveOffset.dc, r0 + dr + moveOffset.dr);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,210,63,0.9)';
    ctx.lineWidth = 2 / s;
    ctx.strokeRect(x + moveOffset.dc * TILE, y + moveOffset.dr * TILE, w, hh);
  }
}

function drawBand(c0, c1, startRow, nRows, color) {
  ctx.fillStyle = color;
  ctx.fillRect(c0 * TILE, startRow * TILE, (c1 - c0) * TILE, nRows * TILE);
}

// Pavimento opaco (righe 10-11): un blocco di "terreno" pieno come nel gioco, con
// una texture leggera a mattoni e la scritta "PAVIMENTO". Bloccato/non disegnabile,
// serve solo a far leggere la riga 9 come terra su cui i tile poggiano.
function drawFloorBand(c0, c1) {
  const x = c0 * TILE, w = (c1 - c0) * TILE;
  const top = 10 * TILE; // 600 = FLOOR_Y (bordo superiore del pavimento)
  const h = 2 * TILE;    // righe 10-11
  // Slab pieno e opaco
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#2a2f3e');
  g.addColorStop(1, '#181b26');
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, h);
  // Texture a mattoni (linee tenui), allineata alla griglia TILE
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cStart = Math.floor(x / TILE), cEnd = Math.ceil((x + w) / TILE);
  for (let c = cStart; c <= cEnd; c++) {
    const gx = c * TILE;
    ctx.moveTo(gx, top); ctx.lineTo(gx, top + h);
  }
  ctx.moveTo(x, top + TILE); ctx.lineTo(x + w, top + TILE); // divisorio riga 10/11
  ctx.stroke();
  // Etichetta "PAVIMENTO" ripetuta lungo la banda
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = 'bold 26px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labelY = top + h / 2;
  const step = TILE * 8;
  const startX = Math.ceil(x / step) * step;
  for (let lx = startX; lx < x + w; lx += step) ctx.fillText('PAVIMENTO', lx, labelY);
}

function drawTile(code, col, row) {
  const x = col * TILE, y = row * TILE;
  const def = COLOR_BY_CODE[code] || { color: '#888', glyph: '?' };
  const m = 6; // margine interno

  ctx.save();
  switch (code) {
    case '1': { // blocco: cella piena con bordo chiaro
      const g = ctx.createLinearGradient(0, y, 0, y + TILE);
      g.addColorStop(0, '#0a0a12'); g.addColorStop(1, def.color);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      break;
    }
    case '2': // spuntone su
      spike(x, y, def.color, 'up', TILE * 0.85);
      break;
    case '6': // spuntone piccolo
      spike(x, y, def.color, 'up', TILE * 0.45);
      break;
    case '7': // spuntone soffitto
      spike(x, y, def.color, 'down', TILE * 0.85);
      break;
    case 's': { // pavimento spinato: tante punte corte
      ctx.fillStyle = def.color;
      const n = 5, sw = TILE / n;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = x + i * sw;
        ctx.moveTo(sx, y + TILE);
        ctx.lineTo(sx + sw / 2, y + TILE * 0.55);
        ctx.lineTo(sx + sw, y + TILE);
      }
      ctx.fill();
      break;
    }
    case '3': case '4': { // portale: pillola
      ctx.fillStyle = def.color;
      roundRect(x + m, y + 2, TILE - 2 * m, TILE - 4, 10);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 22px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.glyph, x + TILE / 2, y + TILE / 2);
      break;
    }
    case '5': { // orb: anello
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case '8': { // pad: barretta in basso
      ctx.fillStyle = def.color;
      roundRect(x + m, y + TILE * 0.6, TILE - 2 * m, TILE * 0.22, 6);
      ctx.fill();
      break;
    }
    case '9': { // moneta: disco
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = def.color;
      ctx.fillRect(x + m, y + m, TILE - 2 * m, TILE - 2 * m);
  }
  ctx.restore();
}

function spike(x, y, color, dir, height) {
  const w = TILE * 0.7;
  const cx = x + TILE / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 'up') {
    const base = y + TILE;
    ctx.moveTo(cx - w / 2, base);
    ctx.lineTo(cx, base - height);
    ctx.lineTo(cx + w / 2, base);
  } else {
    const base = y;
    ctx.moveTo(cx - w / 2, base);
    ctx.lineTo(cx, base + height);
    ctx.lineTo(cx + w / 2, base);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawColumnRuler(s) {
  ctx.save();
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const left = scrollX, right = scrollX + viewW() / s;
  const c0 = Math.max(0, Math.floor(left / TILE));
  const c1 = Math.min(cols, Math.ceil(right / TILE));
  for (let c = c0; c <= c1; c++) {
    if (c % 5 !== 0) continue;
    const sx = (c * TILE - scrollX) * s;
    ctx.fillText(String(c), sx, viewH() - 2);
  }
  ctx.restore();
}

function updateHud() {
  const cell = hoverCell ? `col ${hoverCell.col}, row ${hoverCell.row}` : '—';
  const mode = tool === 'select' ? 'SELEZIONE' : 'disegna';
  hudEl.textContent =
    `${cols} col · cella ${cell} · zoom ${Math.round(zoom * 100)}% · scroll ${Math.round(scrollX)},${Math.round(scrollY)} · ` +
    `[${mode}] · Spazio/tasto-centrale = scorri · Ctrl+rotella = zoom`;
}

// --- Validazione live -------------------------------------------------------
let validateTimer = null;
function scheduleValidate() {
  if (validateTimer) return;
  validateTimer = setTimeout(() => { validateTimer = null; runValidation(); }, 60);
}

// I controlli "presentabili" derivati da invariants(), per una vista a spunte.
function presentChecks(strs) {
  const inv = invariants(strs);
  const errSet = inv.errs;
  const has = sub => errSet.some(e => e.includes(sub));
  const items = [
    ['Righe di pari larghezza', !has('disallineate')],
    ['Esattamente 5 monete', !has('monete =')],
    ['Corridoio ship (no 7+2 in colonna)', !has('corridoio ship')],
    ['Righe 0-1 libere (zona morte)', !has('zona morte')],
    ['Righe 10-11 vuote (pavimento)', !has('render pavimento')],
    ['Portali 3 → 4 in ordine', !has('portali')],
    ['≤ 4 hazard a terra contigui', !has('hazard a terra')],
    ['Solo codici tile legali', !has('codici tile illegali')],
    ['Nessuno spike sopra un blocco', !has('atterraggio mortale')],
  ];
  return { inv, items };
}

// Ultimo esito di validazione: Anteprima/Salva sono attivi solo se il livello è
// valido (un percorso non giocabile non va né testato né messo nel carosello).
let lastValid = false;

function runValidation() {
  const strs = toStrings();
  const { inv, items } = presentChecks(strs);
  const play = playable(strs);
  const ok = inv.errs.length === 0 && play.ok;
  lastValid = ok;
  syncActionButtons();

  verdictEl.className = ok ? 'ok' : 'bad';
  verdictEl.textContent = ok ? '✅ LIVELLO VALIDO' : '❌ DA SISTEMARE';

  statsEl.innerHTML =
    `<b>${inv.cols}</b> colonne · <b>${inv.coins}</b>/5 monete · ` +
    `max hazard contigui <b>${inv.maxRun}</b> · ship @ tile <b>${inv.p3 < 0 ? '—' : inv.p3}</b>`;

  const rows = items.map(([label, good]) =>
    `<div class="check ${good ? 'ok' : 'bad'}"><span class="mk">${good ? '✔' : '✗'}</span><span>${label}</span></div>`
  );
  // Giocabilità (simulatore): riga dedicata
  rows.push(
    `<div class="check ${play.ok ? 'ok' : 'bad'}"><span class="mk">${play.ok ? '✔' : '✗'}</span>` +
    `<span>Percorso giocabile (simulatore)${play.ok ? '' : ` — bloccato a tile ${play.maxTile}/${play.cols}`}</span></div>`
  );
  checksEl.innerHTML = rows.join('');
}

// --- Export / Import (modal condivisa) --------------------------------------
const modalTitle = document.getElementById('modalTitle');
const modalNameRow = document.getElementById('modalNameRow');
const modalName = document.getElementById('modalName');
const modalHint = document.getElementById('modalHint');
const modalText = document.getElementById('modalText');
const modalAction = document.getElementById('modalAction');
const modalCancel = document.getElementById('modalCancel');
const modalSaveRow = document.getElementById('modalSaveRow');
const modalTheme = document.getElementById('modalTheme');
const modalDiff = document.getElementById('modalDiff');
const modalSavedList = document.getElementById('modalSavedList');
const btnPreview = document.getElementById('btnPreview');
const btnPlay = document.getElementById('btnPlay');
const btnManage = document.getElementById('btnManage');
const editBanner = document.getElementById('editBanner');
const editBannerName = document.getElementById('editBannerName');

// Abilita/disabilita Anteprima e Salva nel gioco in base alla validità.
function syncActionButtons() {
  for (const b of [btnPreview, btnPlay]) {
    if (!b) continue;
    b.disabled = !lastValid;
    b.style.opacity = lastValid ? '1' : '0.45';
    b.style.cursor = lastValid ? 'pointer' : 'not-allowed';
    b.title = lastValid ? '' : 'Il livello deve essere valido (vedi pannello Validazione)';
  }
}

function showModal() { modal.classList.add('show'); }
function hideModal() { modal.classList.remove('show'); }

// Riporta la modale allo stato base prima di configurarla per un modo specifico
// (export / import / salva): nasconde le righe opzionali e mostra la textarea.
function resetModalExtras() {
  modalSaveRow.style.display = 'none';
  modalSavedList.style.display = 'none';
  modalSavedList.innerHTML = '';
  modalText.style.display = '';
  modalAction.style.display = ''; // ri-mostra il pulsante azione (manage lo nasconde)
}

function fileText(name) {
  const lines = toStrings().map(s => `  ${JSON.stringify(s)},`).join('\n');
  return `// Generato dal Game Builder (builder.html). Incollalo in src/data/${name}.js\n` +
    `export const ${name} = [\n${lines}\n];\n`;
}

function openExport() {
  resetModalExtras();
  const name = (modalName.value || 'mialevel').replace(/[^a-zA-Z0-9_]/g, '') || 'mialevel';
  modalName.value = name;
  modalTitle.textContent = 'Genera file livello';
  modalNameRow.style.display = '';
  modalHint.innerHTML =
    '1) Salva come <code>src/data/' + name + '.js</code>. ' +
    '2) In <code>src/main.js</code> aggiungi l\'import e registralo in <code>MAPS</code>. ' +
    '3) In <code>src/config.js</code> aggiungi una voce a <code>LEVELS</code> ' +
    '(<code>mapKey: \'' + name + '\'</code>).';
  modalText.value = fileText(name);
  modalAction.textContent = 'Copia negli appunti';
  modalAction.onclick = async () => {
    try { await navigator.clipboard.writeText(modalText.value); modalAction.textContent = 'Copiato ✓'; }
    catch { modalText.select(); document.execCommand('copy'); modalAction.textContent = 'Copiato ✓'; }
    // download di cortesia
    const blob = new Blob([modalText.value], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.js';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // aggiorna il testo quando cambia il nome
  modalName.oninput = () => { modalText.value = fileText((modalName.value || 'mialevel').replace(/[^a-zA-Z0-9_]/g, '') || 'mialevel'); };
  showModal();
}

function openImport() {
  resetModalExtras();
  modalTitle.textContent = 'Carica livello';
  modalNameRow.style.display = 'none';
  modalHint.innerHTML =
    'Scegli un livello esistente da modificare, oppure incolla un array di 12 stringhe ' +
    '(il contenuto di <code>export const X = [ … ]</code>) e premi <b>Carica</b>.<br><br>' +
    Object.keys(EXISTING).map(k => `<button class="btn ghost small" data-load="${k}">${k}</button>`).join(' ');
  modalText.value = '';
  modalText.placeholder = '[\n  "000…",\n  …12 righe…\n]';
  modalAction.textContent = 'Carica da testo';
  modalAction.onclick = () => {
    const strs = parsePastedGrid(modalText.value);
    if (!strs) { alert('Non riesco a leggere un array di 12 stringhe da quel testo.'); return; }
    fromStrings(strs);
    // "Carica livello" parte da un livello ORIGINALE/incollato: NON è la modifica
    // di un custom esistente, quindi esci dalla modalità modifica.
    editing = null; updateEditBanner();
    scrollX = 0; clampScroll(); scheduleValidate(); draw(); hideModal();
  };
  modalName.oninput = null;
  showModal();
  // bottoni "carica livello esistente"
  modalHint.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      fromStrings(EXISTING[btn.dataset.load].slice());
      editing = null; updateEditBanner();
      scrollX = 0; clampScroll(); scheduleValidate(); draw(); hideModal();
    });
  });
}

// Estrae un array di stringhe da testo incollato (JS o JSON).
function parsePastedGrid(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    // prova JSON diretto
    const arr = JSON.parse(m[0].replace(/,(\s*\])/g, '$1'));
    if (Array.isArray(arr) && arr.every(s => typeof s === 'string') && arr.length >= ROWS) return arr.slice(0, ROWS);
  } catch { /* fallback sotto */ }
  // fallback: prendi tutte le stringhe tra apici
  const strs = [...m[0].matchAll(/["'`]([^"'`]*)["'`]/g)].map(x => x[1]);
  if (strs.length >= ROWS) return strs.slice(0, ROWS);
  return null;
}

// --- Gestione livelli di gioco (custom in localStorage) ---------------------
// `editing` segna se stiamo MODIFICANDO un livello esistente: se valorizzato
// ({id,name,themeId,diffLabel}), il salvataggio SOVRASCRIVE quell'id; se null,
// crea un id nuovo (univoco). Evita sovrascritture accidentali tra livelli.
let editing = null;

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'livello';
}

function populateSelect(sel, items, getLabel, getValue) {
  sel.innerHTML = items.map(it => `<option value="${getValue(it)}">${getLabel(it)}</option>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// bg salvato → id del preset tema (per riselezionare la tendina in modifica).
function themeIdFromBg(bg) {
  const t = THEME_PRESETS.find(t => t.bg === bg);
  return t ? t.id : THEME_PRESETS[0].id;
}
function themeLabel(id) {
  const t = THEME_PRESETS.find(t => t.id === id);
  return t ? t.label : id;
}

// Lista condivisa dei livelli custom con azioni Modifica + Elimina. Usata sia
// nel pannello "Livelli di gioco" sia nel modale di salvataggio: stesso markup,
// stesso comportamento. `onChange` viene richiamato dopo un'eliminazione.
function renderCustomList(container, onChange) {
  const list = getCustomLevels();
  if (!list.length) {
    container.style.display = '';
    container.innerHTML =
      '<div style="font-size:13px;opacity:0.75;margin:6px 0;">Nessun livello custom. ' +
      'Crea un livello e premi <b>Salva nel gioco</b>.<br>' +
      '<span style="opacity:0.7">(I 5 livelli originali del gioco non sono modificabili da qui.)</span></div>';
    return;
  }
  container.style.display = '';
  container.innerHTML =
    '<div style="font-size:12px;opacity:0.7;margin:4px 0;">Livelli di gioco (custom, su questo dispositivo):</div>' +
    list.map(l =>
      `<div class="saved-row"><span class="nm">${escapeHtml(l.name)}</span>` +
      `<span class="meta">${escapeHtml(l.diff || '')} · ${escapeHtml(themeLabel(themeIdFromBg(l.bg)))}</span>` +
      `<button class="edit" data-edit="${l.id}">Modifica</button>` +
      `<button class="del" data-del="${l.id}">Elimina</button></div>`
    ).join('');
  container.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', () => loadCustomForEdit(b.dataset.edit));
  });
  container.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      const l = getCustomLevels().find(x => x.id === b.dataset.del);
      if (!l) return;
      if (!confirm(`Eliminare "${l.name}" dal gioco? L'operazione non è reversibile.`)) return;
      deleteCustomLevel(b.dataset.del);
      // Se stavamo modificando proprio questo, esci dalla modalità modifica.
      if (editing && editing.id === b.dataset.del) startNewLevel();
      if (onChange) onChange();
    });
  });
}

// Carica un livello custom nel builder per modificarlo (entra in modalità edit).
function loadCustomForEdit(id) {
  const entry = getCustomLevels().find(l => l.id === id);
  if (!entry || !Array.isArray(entry.grid)) { alert('Livello non trovato.'); return; }
  fromStrings(entry.grid.slice());
  editing = {
    id: entry.id,
    name: entry.name,
    themeId: themeIdFromBg(entry.bg),
    diffLabel: entry.diff || 'Medio',
  };
  scrollX = 0;
  clampScroll();
  scheduleValidate();
  draw();
  updateEditBanner();
  hideModal();
}

// Esce dalla modalità modifica e parte da una griglia vuota (livello nuovo).
function startNewLevel() {
  editing = null;
  updateEditBanner();
  clearAll();
}

// Banner "Stai modificando: <nome>" con bottone "Nuovo livello".
function updateEditBanner() {
  if (!editBanner) return;
  if (editing) {
    editBanner.style.display = 'flex';
    editBannerName.textContent = editing.name;
  } else {
    editBanner.style.display = 'none';
  }
}

// Pannello "Livelli di gioco": elenca i custom con Modifica/Elimina.
function openManageModal() {
  resetModalExtras();
  modalTitle.textContent = 'Livelli di gioco';
  modalNameRow.style.display = 'none';
  modalText.style.display = 'none';
  modalHint.innerHTML =
    'Gestisci i livelli custom del gioco: <b>Modifica</b> li carica qui per cambiarli, ' +
    '<b>Elimina</b> li rimuove dal gioco. Le modifiche compaiono riaprendo il gioco.';
  modalSavedList.style.display = '';
  renderCustomList(modalSavedList, () => renderCustomList(modalSavedList));
  // Niente pulsante azione qui: "Chiudi" (modalCancel) basta.
  modalAction.style.display = 'none';
  showModal();
}

// Modale "Salva nel gioco" — crea un nuovo livello O aggiorna quello in modifica.
function openPlayModal() {
  if (!lastValid) { alert('Il livello non è valido: sistema gli errori nel pannello Validazione prima di salvarlo.'); return; }
  resetModalExtras();
  const isEdit = !!editing;
  modalTitle.textContent = isEdit ? 'Aggiorna livello' : 'Salva nel gioco';
  modalNameRow.style.display = '';
  modalName.value = isEdit ? editing.name : (modalName.value && modalName.value !== 'mialevel' ? modalName.value : 'Mio Livello');
  modalName.oninput = null;
  modalSaveRow.style.display = '';
  populateSelect(modalTheme, THEME_PRESETS, t => t.label, t => t.id);
  populateSelect(modalDiff, DIFFS, d => d.label, d => d.label);
  modalTheme.value = isEdit ? editing.themeId : THEME_PRESETS[0].id;
  modalDiff.value = isEdit ? editing.diffLabel : 'Medio';
  modalText.style.display = 'none'; // niente textarea qui
  modalHint.innerHTML = isEdit
    ? 'Aggiorna il livello esistente: sovrascrive la stessa voce nel gioco (stesso id).'
    : 'Salva il livello DENTRO il gioco: comparirà in fondo al carosello dei livelli, ' +
      'pronto da giocare. (Solo su questo dispositivo. Per metterlo nel repo usa “Genera file”.)';
  modalAction.textContent = isEdit ? 'Aggiorna nel gioco' : 'Salva e aggiungi al gioco';
  modalAction.onclick = () => {
    if (!lastValid) { alert('Il livello non è più valido.'); return; }
    const name = modalName.value.trim() || 'Mio Livello';
    // In modifica: stesso id. In creazione: id univoco dal nome.
    const id = editing ? editing.id : uniqueCustomId(slugify(name));
    const entry = buildCustomEntry({
      id,
      name,
      themeId: modalTheme.value,
      diffLabel: modalDiff.value,
      grid: toStrings(),
    });
    const wasEdit = isEdit;
    const ok = saveCustomLevel(entry);
    if (!ok) { alert('Salvataggio non riuscito (localStorage pieno o bloccato).'); return; }
    // Dopo il salvataggio si è "in modifica" su questa voce: un ri-salvataggio
    // aggiorna invece di duplicare.
    editing = { id, name, themeId: modalTheme.value, diffLabel: modalDiff.value };
    updateEditBanner();
    modalHint.innerHTML =
      `✅ <b>${wasEdit ? 'Aggiornato' : 'Salvato'}!</b> ` +
      'Riapri il <a href="/" style="color:var(--yellow)">gioco</a> → schermata <b>Livelli</b> ' +
      'per vederlo (scorri in fondo al carosello).';
    renderCustomList(modalSavedList, () => renderCustomList(modalSavedList));
  };
  renderCustomList(modalSavedList, () => renderCustomList(modalSavedList));
  showModal();
}

// --- Anteprima giocabile ----------------------------------------------------
const previewOverlay = document.getElementById('previewOverlay');
const previewCanvas = document.getElementById('previewCanvas');
const previewExit = document.getElementById('previewExit');
let preview = null;

function openPreview() {
  if (!lastValid) { alert('Il livello non è valido: non è giocabile finché non sistemi gli errori (pannello Validazione).'); return; }
  previewOverlay.classList.add('show');
  // Istanza nuova ogni volta sulla griglia corrente (throwaway, niente salvataggi).
  preview = new PlaytestPreview(previewCanvas, toStrings(), { onExit: closePreview });
  preview.start();
}

function closePreview() {
  if (preview) { preview.destroy(); preview = null; }
  previewOverlay.classList.remove('show');
}

// --- Eventi -----------------------------------------------------------------
function bindEvents() {
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    // Pan: tasto centrale o Spazio sempre; Shift solo in modalità disegno (in
    // select lo Shift è libero — la selezione si fa col trascinamento normale).
    const pan = e.button === 1 || spaceDown || (tool === 'paint' && e.shiftKey);
    if (pan) {
      panning = true;
      panStart = { mx: e.offsetX, my: e.offsetY, scrollX, scrollY };
      return;
    }
    const c = pointToCell(e.offsetX, e.offsetY);
    if (tool === 'select') {
      if (selRect && rectContainsCell(selRect, c.col, c.row)) {
        selectPhase = 'moving';
        dragAnchor = c;
        moveOffset = { dc: 0, dr: 0 };
        captureSelection();
      } else {
        selectPhase = 'selecting';
        dragAnchor = c;
        selRect = clampRectToGrid(normRect(c, c));
      }
      draw();
      return;
    }
    painting = true;
    paintCell(c.col, c.row);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (panning) {
      const s = scaleY();
      scrollX = panStart.scrollX - (e.offsetX - panStart.mx) / s;
      scrollY = panStart.scrollY - (e.offsetY - panStart.my) / s;
      clampScroll();
      draw();
      return;
    }
    const c = pointToCell(e.offsetX, e.offsetY);
    hoverCell = c;
    if (tool === 'select') {
      if (selectPhase === 'selecting') {
        selRect = clampRectToGrid(normRect(dragAnchor, c));
        draw();
      } else if (selectPhase === 'moving') {
        moveOffset = { dc: c.col - dragAnchor.col, dr: c.row - dragAnchor.row };
        draw();
      }
      return;
    }
    if (painting) paintCell(c.col, c.row);
    else draw();
  });

  const endPointer = () => {
    if (tool === 'select') {
      if (selectPhase === 'selecting') {
        selectPhase = selRect ? 'selected' : 'idle';
      } else if (selectPhase === 'moving') {
        commitMove(moveOffset.dc, moveOffset.dr); // chiama scheduleValidate + draw
        selectPhase = 'selected';
        moveOffset = null;
        dragAnchor = null;
      }
    }
    painting = false;
    panning = false;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { hoverCell = null; draw(); });

  // Rotella: Ctrl/Cmd = zoom (centrato sul cursore); Shift = scroll verticale
  // (utile quando zoomati); altrimenti scroll orizzontale (comportamento storico).
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = scaleY();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setZoom(zoom * factor, e.offsetX, e.offsetY);
      return;
    }
    if (e.shiftKey) {
      scrollY += (e.deltaY + e.deltaX) / s;
      clampScroll();
      draw();
      return;
    }
    scrollX += (e.deltaY + e.deltaX) / s;
    clampScroll();
    draw();
  }, { passive: false });

  // Tasti: frecce per scorrere, Spazio = pan mode. Inattivi mentre l'anteprima è
  // aperta (lì comandi la gestisce PlaytestPreview).
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (previewOverlay.classList.contains('show')) return;
    if (e.code === 'ArrowRight') { scrollX += TILE * 3; clampScroll(); draw(); }
    else if (e.code === 'ArrowLeft') { scrollX -= TILE * 3; clampScroll(); draw(); }
    else if (e.code === 'ArrowUp') { scrollY -= TILE * 3; clampScroll(); draw(); }
    else if (e.code === 'ArrowDown') { scrollY += TILE * 3; clampScroll(); draw(); }
    else if (e.code === 'Space') { spaceDown = true; e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { setZoom(zoom * ZOOM_STEP); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { setZoom(zoom / ZOOM_STEP); e.preventDefault(); }
    else if (e.key === '0') { zoom = 1; scrollY = 0; clampScroll(); updateZoomUI(); draw(); e.preventDefault(); }
    else if (tool === 'select' && (e.code === 'Delete' || e.code === 'Backspace')) { deleteSelection(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

  document.getElementById('btnExport').addEventListener('click', openExport);
  document.getElementById('btnLoad').addEventListener('click', openImport);
  document.getElementById('btnTrim').addEventListener('click', trimTrailing);
  document.getElementById('btnClear').addEventListener('click', () => {
    if (confirm('Svuotare tutta la griglia?')) startNewLevel();
  });
  btnPreview.addEventListener('click', openPreview);
  btnPlay.addEventListener('click', openPlayModal);
  btnManage.addEventListener('click', openManageModal);
  document.getElementById('editBannerNew').addEventListener('click', () => {
    if (confirm('Uscire dalla modifica e iniziare un livello nuovo (griglia vuota)?')) startNewLevel();
  });
  previewExit.addEventListener('click', closePreview);
  modalCancel.addEventListener('click', hideModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

  // Toggle "Seleziona": alterna disegno/selezione; uscendo azzera la selezione.
  btnSelect.addEventListener('click', () => {
    tool = tool === 'select' ? 'paint' : 'select';
    if (tool === 'paint') clearSelection();
    btnSelect.classList.toggle('active', tool === 'select');
    hoverCell = null;
    draw();
  });
  // Zoom +/- dalla barra (centrati sul viewport).
  document.getElementById('btnZoomIn').addEventListener('click', () => setZoom(zoom * ZOOM_STEP));
  document.getElementById('btnZoomOut').addEventListener('click', () => setZoom(zoom / ZOOM_STEP));

  // ESC chiude l'anteprima (priorità), poi deseleziona, poi chiude la modale.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (previewOverlay.classList.contains('show')) closePreview();
    else if (tool === 'select' && selRect) { clearSelection(); draw(); }
    else if (modal.classList.contains('show')) hideModal();
  });

  window.addEventListener('resize', resize);
}
let spaceDown = false;

// --- Avvio ------------------------------------------------------------------
buildPalette();
buildLegend();
bindEvents();
resize();
runValidation();
updateEditBanner(); // nasconde il banner (nessuna modifica in corso all'avvio)

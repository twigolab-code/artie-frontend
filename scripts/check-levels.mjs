// =============================================================================
// check-levels.mjs — validatore dei livelli (nessun test harness nel repo).
// Per OGNI mappa in src/data/ controlla:
//   (A) INVARIANTI statici: righe di pari larghezza per segmento; esattamente 5
//       monete (9); nessuna colonna con sia 7 (soffitto) sia 2 (terra) — corridoio
//       ship aperto; righe 0-1 libere da spike/oggetti (solo 0/1 = blocco-soffitto);
//       righe 10-11 vuote (render pavimento); primo portale 4 dopo il primo 3;
//       <=4 hazard a terra contigui; nessun codice tile illegale.
//   (B) GIOCABILITA': un simulatore di fisica del cubo (BFS sulle decisioni di
//       salto) che DIMOSTRA l'esistenza di un percorso che arriva alla fine senza
//       morte forzata. Le sezioni ship (portale 3..4) sono auto-superate (gli
//       invarianti coprono l'allineamento spike); pad e orb sono auto-usati.
//   Le costanti rispecchiano src/config.js @ scrollSpeed 630.
//
// Uso: node scripts/check-levels.mjs   (exit 1 se qualcosa fallisce)
// =============================================================================
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dir, '../src/data');

const MAPS = [
  ['skyline.js', 'skyline', 'City'],
  ['carwash.js', 'carwash', 'Car Wash'],
  ['skyline2.js', 'skyline2', 'Los Angeles'],
  ['boulevard.js', 'boulevard', 'Boulevard'],
  ['metro2.js', 'metro2', 'Metro'],
];

// --- Costanti fisica (da config.js) ----------------------------------------
const TILE = 60, FLOOR_Y = 600, PLAYER_X = 220, SIZE = 60;
const GRAVITY = 4732, JUMP_V = -1300, MAXFALL = 2080, PAD_V = -1950, ORB_R = 26;
const SCROLL = 630, DT = 1 / 60;

function invariants(grid) {
  const rows = grid.length, cols = Math.max(...grid.map(r => r.length));
  const errs = [];
  const ragged = grid.map((r, i) => [i, r.length]).filter(([, l]) => l !== cols);
  if (ragged.length) errs.push(`righe disallineate: ${JSON.stringify(ragged)}`);
  let coins = 0;
  for (const r of grid) for (const c of r) if (c === '9') coins++;
  if (coins !== 5) errs.push(`monete = ${coins} (devono essere 5)`);
  const conflict = [];
  for (let c = 0; c < cols; c++) {
    let ceil = false, floor = false;
    for (let r = 0; r < rows; r++) { if (grid[r][c] === '7') ceil = true; if (grid[r][c] === '2') floor = true; }
    if (ceil && floor) conflict.push(c);
  }
  if (conflict.length) errs.push(`colonne con 7 e 2 allineati (corridoio ship): [${conflict}]`);
  let topBad = 0;
  for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) { const ch = grid[r][c]; if (ch !== '0' && ch !== '1') topBad++; }
  if (topBad) errs.push(`righe 0-1 con spike/oggetti: ${topBad} (zona morte y<=0)`);
  for (const r of [10, 11]) if (/[^0]/.test(grid[r] || '')) errs.push(`riga ${r} non vuota (render pavimento)`);
  let p3 = -1, p4 = -1;
  for (let c = 0; c < cols && (p3 < 0 || p4 < 0); c++) for (let r = 0; r < rows; r++) {
    if (grid[r][c] === '3' && p3 < 0) p3 = c;
    if (grid[r][c] === '4' && p4 < 0) p4 = c;
  }
  if (p3 < 0 || p4 < 0 || p4 <= p3) errs.push(`portali ship/cube mancanti o in ordine errato (3@${p3}, 4@${p4})`);
  let maxRun = 0, run = 0;
  for (const ch of grid[9]) { if ('26s'.includes(ch)) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
  if (maxRun > 4) errs.push(`hazard a terra contigui = ${maxRun} (>4)`);
  const legal = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 's']);
  const unk = new Set();
  for (const r of grid) for (const c of r) if (!legal.has(c)) unk.add(c);
  if (unk.size) errs.push(`codici tile illegali: ${[...unk]}`);
  // landing-into-spike: un '1' con sopra uno spike
  let badLand = 0;
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === '1' && '26s'.includes(grid[r - 1][c])) badLand++;
  if (badLand) errs.push(`spike sopra il top di un blocco (atterraggio mortale): ${badLand}`);
  return { errs, cols, coins, maxRun, p3 };
}

function playable(grid) {
  const rows = grid.length, cols = Math.max(...grid.map(r => r.length));
  const at = (r, c) => (grid[r] && grid[r][c]) || '0';
  const blocks = [], spikes = [], orbs = [], pads = [], ship = [];
  let p3 = null;
  const spikeHB = (ch, x, y) => {
    const w = TILE * 0.4;
    if (ch === '2') { const h = TILE * 0.55; return { x: x + (TILE - w) / 2, y: y + TILE - h, w, h }; }
    if (ch === '6') { const h = TILE * 0.3; return { x: x + (TILE - w) / 2, y: y + TILE - h, w, h }; }
    if (ch === '7') { const h = TILE * 0.55; return { x: x + (TILE - w) / 2, y, w, h }; }
    const fw = TILE * 0.8, h = TILE * 0.3; return { x: x + (TILE - fw) / 2, y: y + TILE - h, w: fw, h };
  };
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const ch = at(r, c), x = c * TILE, y = r * TILE;
    if (ch === '1') blocks.push({ x, y, w: TILE, h: TILE });
    else if ('267s'.includes(ch)) spikes.push(spikeHB(ch, x, y));
    else if (ch === '5') orbs.push({ cx: x + TILE / 2, cy: y + TILE / 2, r: ORB_R });
    else if (ch === '8') pads.push({ x, y, w: TILE, h: TILE });
    else if (ch === '3') p3 = x;
    else if (ch === '4' && p3 != null) { ship.push({ a: p3, b: x }); p3 = null; }
  }
  const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const depth = (a, b) => ({ dx: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), dy: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) });
  const inShip = x => ship.some(z => x + SIZE > z.a && x < z.b + TILE);
  const endX = cols * TILE;
  const frame = (s, jump) => {
    let { x, y, vy, onGround, used } = s;
    if (inShip(x)) return { s: { x: x + SCROLL * DT, y: 200, vy: 0, onGround: false, used } };
    const pre = { x, y, w: SIZE, h: SIZE };
    for (const p of pads) if (aabb(pre, p)) vy = PAD_V;
    if (jump) for (let i = 0; i < orbs.length; i++) {
      if (used & (1 << i)) continue;
      const o = orbs[i], dx = x + SIZE / 2 - o.cx, dy = y + SIZE / 2 - o.cy;
      if (dx * dx + dy * dy <= (o.r + SIZE / 2) ** 2) { vy = JUMP_V; used |= (1 << i); }
    }
    if (jump && onGround) vy = JUMP_V;
    vy += GRAVITY * DT; if (vy > MAXFALL) vy = MAXFALL;
    y += vy * DT; x += SCROLL * DT; onGround = false;
    const box = { x, y, w: SIZE, h: SIZE };
    for (const sp of spikes) if (aabb(box, sp)) return { dead: true };
    for (const b of blocks) {
      if (!aabb(box, b)) continue;
      const prevBottom = y - vy * DT + SIZE, tol = 14;
      if (vy >= 0 && prevBottom <= b.y + tol) { y = b.y - SIZE; vy = 0; onGround = true; box.y = y; continue; }
      const prevTop = y - vy * DT;
      if (vy < 0 && prevTop >= b.y + b.h - tol) return { dead: true };
      const { dx, dy } = depth(box, b);
      if (dx <= dy) return { dead: true };
      if (vy >= 0) { y = b.y - SIZE; vy = 0; onGround = true; } else { y = b.y + b.h; vy = 0; }
      box.y = y;
    }
    const floorTop = FLOOR_Y - SIZE;
    if (y >= floorTop) { y = floorTop; if (vy > 0) vy = 0; onGround = true; }
    return { s: { x, y, vy, onGround, used } };
  };
  const start = { x: PLAYER_X, y: FLOOR_Y - SIZE, vy: 0, onGround: true, used: 0 };
  const seen = new Set();
  const key = s => `${Math.round(s.x)}|${Math.round(s.y / 4)}|${Math.round(s.vy / 40)}|${s.onGround ? 1 : 0}|${s.used}`;
  const stack = [start];
  let iter = 0, maxx = 0;
  while (stack.length) {
    if (++iter > 8_000_000) return { ok: false, maxTile: Math.round(maxx / TILE), cols };
    const s = stack.pop();
    if (s.x > maxx) maxx = s.x;
    if (s.x >= endX - TILE) return { ok: true };
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const j of [false, true]) { const r = frame(s, j); if (!r.dead) stack.push(r.s); }
  }
  return { ok: false, maxTile: Math.round(maxx / TILE), cols };
}

let failed = false;
for (const [file, name, label] of MAPS) {
  const grid = (await import(pathToFileURL(resolve(DATA, file)).href))[name];
  const inv = invariants(grid);
  const play = playable(grid);
  const ok = inv.errs.length === 0 && play.ok;
  if (!ok) failed = true;
  console.log(`${ok ? '✅' : '❌'} ${label} (${name})  cols=${inv.cols} coins=${inv.coins} maxHaz=${inv.maxRun} ship@tile≈${inv.p3}`);
  for (const e of inv.errs) console.log(`     - INVARIANTE: ${e}`);
  if (!play.ok) console.log(`     - GIOCABILITA': nessun percorso; max tile ${play.maxTile}/${play.cols} (possibile morte forzata)`);
}
console.log(failed ? '\nRESULT: *** ALCUNI CONTROLLI FALLITI ***' : '\nRESULT: tutti i livelli OK');
process.exitCode = failed ? 1 : 0;

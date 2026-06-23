// =============================================================================
// main.js — entry point.
//
// FASE 5 (polish): barra di avanzamento, particelle alla morte, scia del cubo,
// sfondo a parallasse, beat di sottofondo sintetizzato (Web Audio) con pulse
// sincronizzato. Il gameplay (FASE 1-4) resta invariato.
// =============================================================================
import { Renderer } from './engine/Renderer.js';
import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { Audio } from './engine/Audio.js';
import { Player } from './game/Player.js';
import { Level } from './game/Level.js';
import { Camera } from './game/Camera.js';
import { Particles } from './effects/Particles.js';
import { Trail } from './effects/Trail.js';
import { StarTrail } from './effects/StarTrail.js';
import { PortalFx } from './effects/PortalFx.js';
import { Background } from './effects/Background.js';
import { CityBackground } from './effects/CityBackground.js';
import { ImageBackground } from './effects/ImageBackground.js';
import { LaBackground } from './effects/LaBackground.js';
import { level2 } from './data/level2.js';
import { la } from './data/la.js';
import { metro } from './data/metro.js';
import { skyline } from './data/skyline.js';
import { skyline2 } from './data/skyline2.js';
import { getSkin, LOGO_IMG, BG2_IMG, COIN_IMG, OPTIONS_IMG, STATS_IMG, getLaBgImg, fontState } from './engine/Assets.js';
import { aabbOverlap } from './game/Collision.js';
import {
  FIXED_DT,
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  FLOOR_Y,
  FLOOR_HEIGHT,
  FLOOR_COLOR,
  FLOOR_TOP_LINE,
  FLOOR_GRID_COLOR,
  GRID_SIZE,
  PLAYER_X,
  PROGRESS_BAR_COLOR,
  PROGRESS_BG_COLOR,
  GLOW_COLOR,
  GLOW_BLUR,
  EDGE_COLOR,
  CITY_FLOOR_COLOR,
  CITY_FLOOR_BRICK,
  CITY_FLOOR_LINE,
  LA_FLOOR_COLOR,
  LA_FLOOR_LINE,
  LA_FLOOR_PLANK,
  PAD_VELOCITY,
  LEVELS,
  PLAYERS,
  UI_FONT,
  UI,
  TRAIL_CUBE_COLOR,
  COINS_PER_LEVEL,
  COIN_COLOR,
  COIN_COLOR_LIGHT,
  COIN_COLOR_DARK,
  COIN_EDGE,
  COIN_STAR,
  COIN_STAR_EDGE,
} from './config.js';

// Font UI con fallback finché Lilita One non è caricato (vedi fontState).
function uiFont(spec) {
  return fontState.ready ? `${spec} ${UI_FONT}` : `${spec} system-ui, sans-serif`;
}

// Mappe disponibili, indicizzate per mapKey del livello.
// level2 = Città (facile) · la = Los Angeles (medio) · metro = Metro (difficile).
const MAPS = { level2, la, metro, skyline, skyline2 };

// --- Tema colore dello sfondo (transizione morbida tra le sezioni) ----------
// Lerp RGB di due colori hex -> stringa 'rgb(...)'.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}
function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return `rgb(${mix(a[0], b[0], t)},${mix(a[1], b[1], t)},${mix(a[2], b[2], t)})`;
}
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input();
const audio = new Audio();

const player = new Player();
const camera = new Camera();

const particles = new Particles();
const trail = new Trail();
const starTrail = new StarTrail();
const portalFx = new PortalFx();

// Tempo accumulato (per la pulsazione/rotazione dei portali).
let elapsed = 0;
// Tempo per le animazioni delle schermate (avanza anche nei menu).
let menuTime = 0;

// Sfondi condivisi (riusati dai livelli secondo il loro `bg`).
// `losangeles` usa l'immagine piu' pesante: costruito pigramente alla prima
// richiesta (getBg) cosi' la home non scarica `bg-los-angeles.webp`.
const BACKGROUNDS = { neon: new Background(), city: new CityBackground(), la: new LaBackground() };
function getBg(key) {
  if (key === 'losangeles' && !BACKGROUNDS.losangeles) {
    BACKGROUNDS.losangeles = new ImageBackground(getLaBgImg());
  }
  return BACKGROUNDS[key];
}

// --- Selezione livello/player ----------------------------------------------
let levelIndex = 0;
let playerIndex = 0;
function lvl() {
  return LEVELS[levelIndex];
}
function ply() {
  return PLAYERS[playerIndex];
}
function currentBg() {
  return getBg(lvl().bg);
}

// Tema corrente { top, bottom } interpolato cube->ship secondo il livello scelto.
function themeFor(t) {
  const L = lvl();
  return {
    top: lerpColor(L.cube.top, L.ship.top, t),
    bottom: lerpColor(L.cube.bottom, L.ship.bottom, t),
  };
}

// Stato schermate: 'home' | 'players' | 'levels' | 'playing'.
let gameState = 'home';

// Livello corrente (ricreato in startLevel) e relativi dati.
let level = new Level(MAPS[lvl().mapKey]);
let finishX = level.widthPx;

let attempts = 1;
let deathTimer = 0;
const RESPAWN_DELAY = 0.7;

// Tema sfondo: 0 = cube, 1 = ship. themeT insegue themeTarget.
let themeT = 0;
let themeTarget = 0;
const THEME_LERP = 0.06; // morbidezza della transizione colore

// Flag per non ri-triggerare lo stesso portale/pad ad ogni frame in overlap.
let lastPortal = null;
let lastPad = null;

// Monete raccolte nel tentativo corrente (azzerate a ogni restart).
let coinsCollected = 0;

// Statistiche del tentativo corrente (per accumulo persistente alla fine run).
let bestRunPct = 0; // frazione [0,1] massima di percorso raggiunta nel tentativo
let runJumps = 0; // salti effettuati nel tentativo (salti+orb via jumpCount, +pad)
let prevJumpCount = 0; // ultimo player.jumpCount visto (per il delta)
let prevAlive = true; // stato vivo precedente (per rilevare la morte una volta)

// Sblocca l'audio al primo gesto utente (policy browser).
function unlockAudioOnce() {
  audio.unlock();
  window.removeEventListener('keydown', unlockAudioOnce);
  window.removeEventListener('mousedown', unlockAudioOnce);
  window.removeEventListener('touchstart', unlockAudioOnce);
}
window.addEventListener('keydown', unlockAudioOnce);
window.addEventListener('mousedown', unlockAudioOnce);
window.addEventListener('touchstart', unlockAudioOnce);

// --- Avvio livello selezionato ---------------------------------------------
function startLevel() {
  if (lvl().comingSoon) return; // livello bloccato: non avviabile
  level = new Level(MAPS[lvl().mapKey]);
  finishX = level.widthPx;
  camera.setSpeed(lvl().scrollSpeed);
  player.setSkin(getSkin(ply().skin));
  gameState = 'playing';
  attempts = 1;
  restart();
}

function restart() {
  camera.reset();
  player.reset(camera.x + PLAYER_X);
  player.setMode('cube');
  trail.reset();
  particles.clear();
  starTrail.clear();
  deathTimer = 0;
  themeTarget = 0; // torna al tema cube
  lastPortal = null;
  lastPad = null;
  portalFx.clear();
  for (const orb of level.orbs) orb._used = false;
  // Monete: ricompaiono tutte e il contatore riparte da zero a ogni tentativo.
  coinsCollected = 0;
  for (const coin of level.coins) coin._collected = false;
  // Statistiche del tentativo: azzerate (il delta salti riparte da jumpCount).
  bestRunPct = 0;
  runJumps = 0;
  prevJumpCount = player.jumpCount;
  prevAlive = true;
  // Musica di gioco: riparte da capo a ogni avvio livello / morte / tentativo.
  audio.setTrack('game', { restart: true });
}

// --- Input delle schermate (home / players / levels) ------------------------
window.addEventListener('keydown', (e) => {
  if (gameState === 'home') {
    if (e.code === 'Space' || e.code === 'Enter') gameState = 'levels';
    else if (e.code === 'KeyP') gameState = 'players';
    else if (e.code === 'KeyO') gameState = 'options';
    else if (e.code === 'KeyS') gameState = 'stats';
  } else if (gameState === 'stats') {
    if (e.code === 'Escape' || e.code === 'Enter') gameState = 'home';
  } else if (gameState === 'options') {
    if (e.code === 'ArrowUp') changeMusicVol(+1);
    else if (e.code === 'ArrowDown') changeMusicVol(-1);
    else if (e.code === 'ArrowRight') changeSfxVol(+1);
    else if (e.code === 'ArrowLeft') changeSfxVol(-1);
    else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'Escape' || e.code === 'Enter') gameState = 'home';
  } else if (gameState === 'players') {
    if (e.code === 'ArrowLeft') playerIndex = (playerIndex + PLAYERS.length - 1) % PLAYERS.length;
    else if (e.code === 'ArrowRight') playerIndex = (playerIndex + 1) % PLAYERS.length;
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') gameState = 'home';
  } else if (gameState === 'levels') {
    if (e.code === 'ArrowLeft') levelIndex = (levelIndex + LEVELS.length - 1) % LEVELS.length;
    else if (e.code === 'ArrowRight') levelIndex = (levelIndex + 1) % LEVELS.length;
    else if (e.code === 'Space' || e.code === 'Enter') startLevel();
    else if (e.code === 'Escape') gameState = 'home';
  } else if (gameState === 'complete') {
    if (e.code === 'Space' || e.code === 'Enter') {
      input.consumePress(); // scarta l'edge così non parte un salto al via
      startLevel(); // rigioca lo stesso livello
    } else if (e.code === 'Escape') {
      gameState = 'levels';
      audio.setTrack('home'); // tornando ai menu riparte la musica della Home
    }
  }
});

// Click: bottoni Home, frecce di navigazione, conferma.
canvas.addEventListener('mousedown', (e) => {
  const p = toLogical(e);
  if (gameState === 'home') {
    if (pointInRect(p, homeBtns().start)) gameState = 'levels';
    else if (pointInRect(p, homeBtns().player)) gameState = 'players';
    else if (pointInRect(p, homeBtns().options)) gameState = 'options';
    else if (pointInRect(p, homeBtns().stats)) gameState = 'stats';
  } else if (gameState === 'stats') {
    gameState = 'home'; // click ovunque (inclusa la freccia) torna alla Home
  } else if (gameState === 'options') {
    const r = optionRects();
    if (pointInRect(p, r.musicMinus)) changeMusicVol(-1);
    else if (pointInRect(p, r.musicPlus)) changeMusicVol(+1);
    else if (pointInRect(p, r.sfxMinus)) changeSfxVol(-1);
    else if (pointInRect(p, r.sfxPlus)) changeSfxVol(+1);
    else if (pointInRect(p, r.mute)) toggleMute();
    else if (pointInRect(p, r.back)) gameState = 'home';
  } else if (gameState === 'players') {
    // Click su un cubo: se è già selezionato, conferma (torna a Home);
    // altrimenti lo seleziona. Click altrove = conferma.
    const hit = playerSlots().find((s) => pointInRect(p, s));
    if (hit) {
      if (hit.i === playerIndex) gameState = 'home';
      else playerIndex = hit.i;
    } else {
      gameState = 'home';
    }
  } else if (gameState === 'levels') {
    const ar = arrowRects();
    if (pointInRect(p, ar.left)) levelIndex = (levelIndex + LEVELS.length - 1) % LEVELS.length;
    else if (pointInRect(p, ar.right)) levelIndex = (levelIndex + 1) % LEVELS.length;
    else startLevel(); // click altrove = gioca
  } else if (gameState === 'complete') {
    input.consumePress(); // scarta l'edge del click così non parte un salto
    startLevel(); // click = rigioca lo stesso livello
  }
});

function init() {
  player.setSkin(getSkin(ply().skin));
  // Applica le impostazioni audio salvate (i valori restano memorizzati
  // nell'engine e vengono applicati ai nodi alla prima interazione / unlock).
  const s = getSettings();
  audio.setMusicVolume(s.music);
  audio.setSfxVolume(s.sfx);
  audio.setMuted(s.muted);
}

function update(dt) {
  audio.update(); // schedula i beat (anche durante la morte)

  menuTime += dt; // tempo per le animazioni delle schermate (cubo della Home)

  if (gameState !== 'playing') return; // nelle schermate il gioco è fermo

  elapsed += dt; // tempo per la pulsazione dei portali
  portalFx.update(dt); // effetto passaggio (sempre attivo)

  if (!player.alive) {
    // Death SFX una sola volta, nel frame della transizione vivo->morto.
    if (prevAlive) {
      audio.playDeath();
      // Tentativo concluso con la morte: accumula nelle stats persistenti.
      commitRunStats(lvl().id, runJumps, bestRunPct);
      prevAlive = false;
    }
    particles.update(dt); // le schegge continuano a volare
    starTrail.update(dt); // anche le stelle residue
    deathTimer += dt;
    if (deathTimer >= RESPAWN_DELAY) {
      attempts++;
      restart();
    }
    return;
  }

  camera.update(dt);
  player.x = camera.x + PLAYER_X;

  // Orb: trigger PRIMA dell'update (consuma l'edge del press). Se il player
  // tocca un orb e c'è una nuova pressione -> salto a mezz'aria.
  handleOrbs();

  // Portali: cambio modalità + tema PRIMA dell'update fisico, così la
  // trasformazione avviene prima della risoluzione collisioni del frame
  // (evita di morire sui blocchi del corridoio nell'istante del passaggio).
  handlePortals();

  player.update(dt, input, level);
  trail.update(dt, player);

  // Statistiche run: progresso massimo + salti (delta di jumpCount: copre salti
  // da terra e orb, che passano da player.jump()). Un blip per frame.
  bestRunPct = Math.max(bestRunPct, Math.min(1, player.x / finishX));
  const dj = player.jumpCount - prevJumpCount;
  if (dj > 0) {
    runJumps += dj;
  }
  prevJumpCount = player.jumpCount;

  // Stelle del razzo: emette dalla coda (lato sx, centro verticale) in ship.
  if (player.mode === 'ship') {
    starTrail.emit(player.x, player.y + player.size / 2);
  }
  starTrail.update(dt);

  // Pad: balzo automatico al contatto (solo modalità cube).
  handlePads();

  // Monete: raccolta al contatto (non serve premere).
  handleCoins();

  // Interpolazione morbida del tema verso il target.
  themeT += (themeTarget - themeT) * THEME_LERP;

  // Morte avvenuta in questo frame -> esplosione di particelle.
  if (!player.alive) {
    particles.burst(player.x + player.size / 2, player.y + player.size / 2, attempts);
  }

  // Fine livello -> schermo di completamento. Salva record monete e stats
  // (tentativo completato: +1, salti della run, 100% di percorso).
  if (player.x >= finishX) {
    saveBestCoins(lvl().id, coinsCollected);
    commitRunStats(lvl().id, runJumps, 1);
    gameState = 'complete';
  }
}

// Orb: se il centro del player è dentro un orb e c'è una nuova pressione,
// applica un salto (anche in aria). Un orb si "consuma" finché resta in overlap.
function handleOrbs() {
  const pcx = player.x + player.size / 2;
  const pcy = player.y + player.size / 2;
  const reach = player.size / 2;

  let pressed = null; // l'orb che vogliamo attivare in questo frame
  for (const orb of level.orbs) {
    const dx = pcx - orb.cx;
    const dy = pcy - orb.cy;
    const inRange = dx * dx + dy * dy <= (orb.r + reach) * (orb.r + reach);
    if (inRange) {
      if (!orb._used) pressed = orb;
    } else {
      orb._used = false; // uscito dall'orb: riarmato per il prossimo passaggio
    }
  }

  if (pressed && input.consumePress()) {
    player.jump();
    pressed._used = true;
  }
}

// Portali: attraversandone uno di modalità diversa dall'attuale, cambia modalità
// e tema. lastPortal evita ri-trigger continui mentre si è ancora in overlap.
function handlePortals() {
  const box = player.getHitbox();
  let touching = null;
  for (const p of level.portals) {
    if (aabbOverlap(box, p.getHitbox())) {
      touching = p;
      break;
    }
  }

  if (touching && touching !== lastPortal) {
    player.setMode(touching.mode);
    themeTarget = touching.mode === 'ship' ? 1 : 0;
    // Effetto speciale al passaggio: lampo + onda d'urto dal centro del portale.
    portalFx.trigger(touching.x + touching.w / 2, touching.y + touching.h / 2, touching.color);
    lastPortal = touching;
  } else if (!touching) {
    lastPortal = null;
  }
}

// Pad: al contatto (senza premere) lancia il player in alto con spinta forte.
// Solo in modalità cube, come nell'originale. lastPad evita ri-trigger continui.
function handlePads() {
  if (player.mode !== 'cube') return;

  const box = player.getHitbox();
  let touching = null;
  for (const pad of level.pads) {
    if (aabbOverlap(box, pad.getHitbox())) {
      touching = pad;
      break;
    }
  }

  if (touching && touching !== lastPad) {
    player.vy = PAD_VELOCITY; // spinta diretta (più forte del salto)
    player.onGround = false;
    player._targetAngle += Math.PI * 2; // giro completo (faccia in su)
    runJumps++; // il pad conta come salto
    lastPad = touching;
  } else if (!touching) {
    lastPad = null;
  }
}

// Monete: raccolta al semplice contatto (nessun tasto). Una moneta raccolta
// resta presa fino al prossimo restart (riappare ricominciando il tentativo).
function handleCoins() {
  const box = player.getHitbox();
  for (const coin of level.coins) {
    if (!coin._collected && aabbOverlap(box, coin.getHitbox())) {
      coin._collected = true;
      coinsCollected++;
      audio.playCoin();
    }
  }
}

// --- Record monete per livello (localStorage) ------------------------------
function getBestCoins(id) {
  try {
    return (JSON.parse(localStorage.getItem('gd_bestCoins')) || {})[id] || 0;
  } catch {
    return 0;
  }
}
function saveBestCoins(id, n) {
  try {
    const d = JSON.parse(localStorage.getItem('gd_bestCoins')) || {};
    if (n > (d[id] || 0)) {
      d[id] = n;
      localStorage.setItem('gd_bestCoins', JSON.stringify(d));
    }
  } catch {
    // ambiente senza localStorage: nessuna persistenza, ma il gioco continua.
  }
}

// --- Statistiche per livello (localStorage): % migliore, tentativi e salti
// TOTALI cumulativi tra tutte le sessioni. -----------------------------------
function getStats(id) {
  try {
    const s = (JSON.parse(localStorage.getItem('gd_levelStats')) || {})[id];
    return { bestPct: s?.bestPct || 0, attempts: s?.attempts || 0, jumps: s?.jumps || 0 };
  } catch {
    return { bestPct: 0, attempts: 0, jumps: 0 };
  }
}
function saveStats(id, s) {
  try {
    const d = JSON.parse(localStorage.getItem('gd_levelStats')) || {};
    d[id] = s;
    localStorage.setItem('gd_levelStats', JSON.stringify(d));
  } catch {
    // ambiente senza localStorage: nessuna persistenza, ma il gioco continua.
  }
}
// Totali globali aggregati su tutti i livelli (per la panoramica in Home).
// Un livello è "completato" se la % migliore ha raggiunto il 100%.
function getGlobalStats() {
  let attempts = 0;
  let jumps = 0;
  let coins = 0;
  let completed = 0;
  for (const L of LEVELS) {
    const s = getStats(L.id);
    attempts += s.attempts;
    jumps += s.jumps;
    coins += getBestCoins(L.id);
    if (s.bestPct >= 100) completed++;
  }
  return { attempts, jumps, coins, completed, total: LEVELS.length };
}
// Accumula un tentativo concluso (a morte o a completamento) nelle stats del
// livello: +1 tentativo, +salti della run, e aggiorna la % migliore.
function commitRunStats(id, runJumpsN, runPct) {
  const s = getStats(id);
  s.attempts += 1;
  s.jumps += runJumpsN;
  s.bestPct = Math.max(s.bestPct, Math.round(runPct * 100));
  saveStats(id, s);
}

// --- Impostazioni audio (localStorage) -------------------------------------
function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('gd_audio')) || {};
    return {
      music: s.music ?? audio.musicVolume,
      sfx: s.sfx ?? audio.sfxVolume,
      muted: s.muted ?? false,
    };
  } catch {
    return { music: audio.musicVolume, sfx: audio.sfxVolume, muted: false };
  }
}
function saveSettings() {
  try {
    localStorage.setItem(
      'gd_audio',
      JSON.stringify({ music: audio.musicVolume, sfx: audio.sfxVolume, muted: audio.muted })
    );
  } catch {
    // nessuna persistenza disponibile: continua comunque.
  }
}
// Controlli volume/mute dallo schermo Opzioni (step 10%). Applicano all'audio,
// salvano e danno un piccolo feedback sonoro (anteprima volume effetti).
const VOL_STEP = 0.1;
function changeMusicVol(dir) {
  audio.setMusicVolume(audio.musicVolume + dir * VOL_STEP);
  saveSettings();
}
function changeSfxVol(dir) {
  audio.setSfxVolume(audio.sfxVolume + dir * VOL_STEP);
  saveSettings();
  audio.playCoin(); // anteprima del nuovo volume effetti
}
function toggleMute() {
  audio.setMuted(!audio.muted);
  saveSettings();
}

function render(alpha) {
  renderer.begin();

  if (gameState === 'home') return drawHome();
  if (gameState === 'players') return drawPlayers();
  if (gameState === 'levels') return drawLevels();
  if (gameState === 'options') return drawOptions();
  if (gameState === 'stats') return drawStats();
  if (gameState === 'complete') return drawComplete();

  // gameState === 'playing'
  // Camera INTERPOLATA: avanza dello scroll che mancava al prossimo step fisso.
  // Rende lo scorrimento fluido a qualunque refresh (la fisica resta a 60Hz).
  const camX = player.alive ? camera.x + camera.speed * FIXED_DT * alpha : camera.x;

  const beatPulse = beatPulseValue();
  currentBg().render(renderer, camX, beatPulse, themeFor(themeT));

  drawFloor(camX);
  level.render(renderer, camX, elapsed); // time -> pulsazione portali

  portalFx.render(renderer, camX); // onda d'urto + scintille del passaggio
  // Il player resta pinnato a PLAYER_X: lo disegno con la camera NON interpolata
  // (player.x = camera.x + PLAYER_X), così non vibra mentre il mondo scorre liscio.
  trail.render(renderer, camera.x); // scia ancorata al player
  starTrail.render(renderer, camera.x); // stelle ancorate al player
  if (player.alive) player.render(renderer, camera.x);
  particles.render(renderer, camX);

  drawHud();
  drawProgressBar();

  portalFx.renderFlash(renderer); // lampo a tutto schermo (sopra al gameplay)
}

// ===========================================================================
// SCHERMATE (UI su canvas)
// ===========================================================================

// Converte un evento mouse in coordinate LOGICHE (tiene conto del letterbox).
function toLogical(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
  const offX = (rect.width - LOGICAL_WIDTH * scale) / 2;
  const offY = (rect.height - LOGICAL_HEIGHT * scale) / 2;
  return { x: (e.clientX - rect.left - offX) / scale, y: (e.clientY - rect.top - offY) / scale };
}
function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}


// Bottoni della Home (rettangoli cliccabili).
function homeBtns() {
  const w = 380;
  const h = 76;
  const x = (LOGICAL_WIDTH - w) / 2;
  // y0 spostato sotto il logo (alto ~212px da y=60 → fino a ~y272) per non coprirlo.
  const y0 = 300;
  const step = h + 18;
  // Icone quadrate Opzioni/Stats: affiancate e centrate sotto i due bottoni.
  const iconSize = 92;
  const iconGap = 24;
  const cx = LOGICAL_WIDTH / 2;
  const iconY = y0 + 2 * step + 8;
  return {
    start: { x, y: y0, w, h },
    player: { x, y: y0 + step, w, h },
    options: { x: cx - iconGap / 2 - iconSize, y: iconY, w: iconSize, h: iconSize },
    stats: { x: cx + iconGap / 2, y: iconY, w: iconSize, h: iconSize },
  };
}

// Il font UI (SoccerLeague) non ha i glifi accentati: sostituisce ogni vocale
// accentata con vocale + apostrofo (es. à -> a', CITTÀ -> CITTA'). Applicata in
// fase di disegno, così le stringhe sorgente restano accentate (contenuto corretto).
const _ACCENTS = {
  à: "a'", è: "e'", é: "e'", ì: "i'", í: "i'", ò: "o'", ó: "o'", ù: "u'", ú: "u'",
  À: "A'", È: "E'", É: "E'", Ì: "I'", Í: "I'", Ò: "O'", Ó: "O'", Ù: "U'", Ú: "U'",
};
function deAccent(str) {
  return String(str).replace(/[àèéìíòóùúÀÈÉÌÍÒÓÙÚ]/g, (c) => _ACCENTS[c]);
}

// Testo in stile GD: MAIUSCOLO, fill + bordo scuro spesso. `size` in px.
function text(str, x, y, size, color = UI.text, outline = UI.outline, owidth = null) {
  const ctx = renderer.ctx;
  str = deAccent(str);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = uiFont(`${size}px`);
  ctx.lineJoin = 'round';
  ctx.lineWidth = owidth != null ? owidth : Math.max(4, size * 0.14);
  ctx.strokeStyle = outline;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Variante di text() con allineamento orizzontale esplicito ('left'/'right'),
// per le righe etichetta-a-sinistra / valore-a-destra dello schermo STATS.
function textAligned(str, x, y, size, align, color = UI.text, outline = UI.outline) {
  const ctx = renderer.ctx;
  str = deAccent(str);
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = uiFont(`${size}px`);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.14);
  ctx.strokeStyle = outline;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Pulsante stile GD: rettangolo arrotondato, fill saturo + outline scuro spesso.
function button(rect, label, color = UI.green) {
  const ctx = renderer.ctx;
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = UI.outline;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.stroke();
  // Riflesso chiaro in alto.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, rect.x + 8, rect.y + 6, rect.w - 16, rect.h * 0.36, 12);
  ctx.fill();
  ctx.restore();
  text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + rect.h * 0.16, rect.h * 0.42);
}

// Freccia triangolare di navigazione (dir: -1 sinistra, +1 destra), con outline.
function arrow(rect, dir) {
  const ctx = renderer.ctx;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = rect.w * 0.32;
  const hh = rect.h * 0.34;
  ctx.save();
  ctx.beginPath();
  if (dir < 0) {
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx + hw, cy - hh);
    ctx.lineTo(cx + hw, cy + hh);
  } else {
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx - hw, cy - hh);
    ctx.lineTo(cx - hw, cy + hh);
  }
  ctx.closePath();
  ctx.fillStyle = UI.green;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = UI.outline;
  ctx.stroke();
  ctx.restore();
}

// Rettangoli cliccabili delle frecce laterali (condivisi render/click).
function arrowRects() {
  const w = 110;
  const h = 130;
  const y = LOGICAL_HEIGHT / 2 - h / 2;
  return {
    left: { x: 40, y, w, h },
    right: { x: LOGICAL_WIDTH - 40 - w, y, w, h },
  };
}

// Pallini indicatore (uno per voce; quello attivo evidenziato).
function dots(n, active, cx, y) {
  const ctx = renderer.ctx;
  const gap = 30;
  const x0 = cx - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x0 + i * gap, y, i === active ? 9 : 6, 0, Math.PI * 2);
    ctx.fillStyle = i === active ? UI.yellow : 'rgba(255,255,255,0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI.outline;
    ctx.stroke();
  }
}

// Sfondo di anteprima comune alle schermate (sfondo del livello evidenziato).
function screenBackdrop() {
  const ctx = renderer.ctx;
  currentBg().render(renderer, 0, 0, themeFor(0));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(renderer.extLeft, renderer.extTop, renderer.extRight - renderer.extLeft, renderer.extBottom - renderer.extTop);
}

// Disegna un'immagine "cover" su tutto lo schermo reale (riempie senza deformare,
// ritagliando l'eccesso) + vela scura per la leggibilità.
function drawCover(handle) {
  const ctx = renderer.ctx;
  const L = renderer.extLeft;
  const T = renderer.extTop;
  const W = renderer.extRight - L;
  const H = renderer.extBottom - T;
  const iw = handle.img.naturalWidth;
  const ih = handle.img.naturalHeight;
  const scale = Math.max(W / iw, H / ih); // cover
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(handle.img, L + (W - dw) / 2, T + (H - dh) / 2, dw, dh);
}

// Cubo decorativo della Home: corre da sinistra fino a ~60%, poi salta e vola
// fuori schermo; il ciclo si ripete. Traiettoria in forma chiusa dal parametro
// di ciclo (niente fisica). Usa la skin del player selezionato (+ scia rossa).
function drawHomeCube() {
  const ctx = renderer.ctx;
  const size = 210; // cubo grande (scala di riferimento, stile GD)
  const groundLine = LOGICAL_HEIGHT * 0.85; // linea di terra (combacia con la linea bianca)
  const groundY = groundLine - size; // bordo superiore del cubo appoggiato a terra
  const T = 2.0; // durata del ciclo (s) — cubo più veloce
  const jumpAt = 0.4; // frazione del ciclo in cui parte il salto (un filo prima)
  const startX = -120;
  const jumpX = LOGICAL_WIDTH * 0.42; // salta un filo prima

  const p = (menuTime % T) / T;

  // Posizione lungo il ciclo: corsa (x lineare a terra) poi salto (parabola fuori).
  let x, y, angle;
  if (p < jumpAt) {
    const k = p / jumpAt; // 0..1
    x = startX + (jumpX - startX) * k;
    y = groundY;
    angle = 0;
  } else {
    const k = (p - jumpAt) / (1 - jumpAt); // 0..1 nella fase salto
    x = jumpX + (LOGICAL_WIDTH + 200 - jumpX) * k; // esce a destra
    // Parabola: parte da terra, sale e poi su/fuori in alto (apice ~metà).
    const arc = Math.sin(k * Math.PI) * (LOGICAL_HEIGHT * 0.42);
    y = groundY - arc - k * LOGICAL_HEIGHT * 0.55; // tende verso l'alto/fuori
    angle = k * Math.PI * 2; // un giro durante il salto
  }

  // Scia rossa: qualche eco della posizione poco prima (calcolata al volo).
  for (let i = 6; i >= 1; i--) {
    const pp = ((menuTime - i * 0.035) % T + T) % T;
    let ex, ey;
    if (pp < jumpAt) {
      ex = startX + (jumpX - startX) * (pp / jumpAt);
      ey = groundY;
    } else {
      const kk = (pp - jumpAt) / (1 - jumpAt);
      ex = jumpX + (LOGICAL_WIDTH + 200 - jumpX) * kk;
      ey = groundY - Math.sin(kk * Math.PI) * (LOGICAL_HEIGHT * 0.42) - kk * LOGICAL_HEIGHT * 0.55;
    }
    ctx.save();
    ctx.globalAlpha = 0.1 * (1 - i / 7); // scia più tenue (sullo sfondo)
    ctx.fillStyle = TRAIL_CUBE_COLOR;
    const s = size * (0.5 + (1 - i / 7) * 0.4);
    ctx.fillRect(ex + size / 2 - s / 2, ey + size / 2 - s / 2, s, s);
    ctx.restore();
  }

  // Cubo (skin del player selezionato, ruotato). Reso "opaco"/semitrasparente
  // per integrarlo nello sfondo in movimento (coerente coi palazzi dietro).
  const skin = getSkin(ply().skin);
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(angle);
  if (skin.ready) {
    ctx.drawImage(skin.img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = '#7cff4f';
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

function drawHome() {
  const ctx = renderer.ctx;
  if (BG2_IMG.ready) drawCover(BG2_IMG);
  else screenBackdrop();

  // Cubo decorativo che corre e salta in loop (sopra lo sfondo, sotto la UI).
  drawHomeCube();

  // Logo centrato in alto (proporzioni native), dimensione contenuta.
  if (LOGO_IMG.ready) {
    const w = LOGICAL_WIDTH * 0.4;
    const ratio = LOGO_IMG.img.naturalWidth / LOGO_IMG.img.naturalHeight;
    const h = w / ratio;
    ctx.drawImage(LOGO_IMG.img, (LOGICAL_WIDTH - w) / 2, 60, w, h);
  } else {
    text('OG DASH', LOGICAL_WIDTH / 2, 150, 64);
  }

  const b = homeBtns();
  button(b.start, 'START', UI.green);
  button(b.player, `PLAYER: ${ply().name}`, UI.blue);
  // Opzioni e Stats come icone affiancate (cliccabili tramite gli stessi rect).
  if (OPTIONS_IMG.ready) ctx.drawImage(OPTIONS_IMG.img, b.options.x, b.options.y, b.options.w, b.options.h);
  if (STATS_IMG.ready) ctx.drawImage(STATS_IMG.img, b.stats.x, b.stats.y, b.stats.w, b.stats.h);

  text('P = CUBO   •   O = OPZIONI   •   S = STATS', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40, 20, 'rgba(255,255,255,0.9)');
}

// Pannello stile GD (rettangolo arrotondato con bordo scuro).
function panel(x, y, w, h, fill) {
  const ctx = renderer.ctx;
  ctx.save();
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = UI.outline;
  roundRect(ctx, x, y, w, h, 22);
  ctx.stroke();
  ctx.restore();
}

function drawLevels() {
  const ctx = renderer.ctx;
  screenBackdrop();

  // Pannello centrale con anteprima sfondo del livello + info.
  const pw = 720;
  const ph = 360;
  const px = (LOGICAL_WIDTH - pw) / 2;
  const py = (LOGICAL_HEIGHT - ph) / 2 - 10;
  const L = LEVELS[levelIndex];
  const theme = { top: lerpColor(L.cube.top, L.ship.top, 0), bottom: lerpColor(L.cube.bottom, L.ship.bottom, 0) };

  // Anteprima sfondo del livello, clippata nel pannello.
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.clip();
  getBg(L.bg).render(renderer, levelIndex * 900 + 200, 0, theme);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  // Bordo del pannello.
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = UI.outline;
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.stroke();
  ctx.restore();

  // Livello "coming soon": velo scuro sul pannello + scritta gialla.
  if (L.comingSoon) {
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
  }

  // Nome livello + difficoltà dentro il pannello.
  text(L.name.toUpperCase(), LOGICAL_WIDTH / 2, py + 90, 50);
  // Barra "difficoltà" stile GD.
  const barW = pw - 120;
  const barX = (LOGICAL_WIDTH - barW) / 2;
  const barY = py + 150;
  drawGdBar(barX, barY, barW, 46, L.diffFrac ?? 0.5, `DIFFICOLTÀ: ${L.diff.toUpperCase()}`);

  text(`LIVELLO ${levelIndex + 1} / ${LEVELS.length}`, LOGICAL_WIDTH / 2, py + 232, 28, UI.yellow);

  // Record monete del livello: riga di icone (piene = raccolte nel record).
  const best = getBestCoins(L.id);
  const cr = 15;
  const cgap = cr * 2 + 12;
  const rowW = (COINS_PER_LEVEL - 1) * cgap;
  const x0 = LOGICAL_WIDTH / 2 - rowW / 2;
  for (let i = 0; i < COINS_PER_LEVEL; i++) {
    drawCoinIcon(x0 + i * cgap, py + 278, cr, i < best);
  }

  // Statistiche persistenti del livello (% migliore, tentativi e salti totali).
  const st = getStats(L.id);
  text(
    `MIGLIORE ${st.bestPct}%   •   TENTATIVI ${st.attempts}   •   SALTI ${st.jumps}`,
    LOGICAL_WIDTH / 2,
    py + 328,
    22
  );

  // Scritta "COMING SOON" sopra al contenuto, ben centrata nel pannello.
  if (L.comingSoon) {
    text('COMING SOON', LOGICAL_WIDTH / 2, py + ph / 2, 56, UI.yellow);
  }

  // Frecce laterali + pallini.
  const ar = arrowRects();
  arrow(ar.left, -1);
  arrow(ar.right, +1);
  dots(LEVELS.length, levelIndex, LOGICAL_WIDTH / 2, py + ph + 46);

  const hint = L.comingSoon
    ? 'PROSSIMAMENTE   •   ESC INDIETRO'
    : 'SPAZIO / CLICK PER GIOCARE   •   ESC INDIETRO';
  text(hint, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40, 20, 'rgba(255,255,255,0.9)');
}

// Schermo di fine livello: monete raccolte + record salvato.
function drawComplete() {
  screenBackdrop();

  const pw = 720;
  const ph = 360;
  const px = (LOGICAL_WIDTH - pw) / 2;
  const py = (LOGICAL_HEIGHT - ph) / 2 - 10;
  panel(px, py, pw, ph, 'rgba(10,8,24,0.78)');

  text('LIVELLO COMPLETATO!', LOGICAL_WIDTH / 2, py + 86, 46, UI.yellow);
  text(lvl().name.toUpperCase(), LOGICAL_WIDTH / 2, py + 134, 28);

  // Riga delle 5 monete: piene = raccolte in questo run.
  const cr = 26;
  const cgap = cr * 2 + 18;
  const rowW = (COINS_PER_LEVEL - 1) * cgap;
  const x0 = LOGICAL_WIDTH / 2 - rowW / 2;
  for (let i = 0; i < COINS_PER_LEVEL; i++) {
    drawCoinIcon(x0 + i * cgap, py + 210, cr, i < coinsCollected);
  }

  text(`MONETE: ${coinsCollected}/${COINS_PER_LEVEL}`, LOGICAL_WIDTH / 2, py + 264, 26);
  const best = getBestCoins(lvl().id);
  text(`RECORD MONETE: ${best}/${COINS_PER_LEVEL}`, LOGICAL_WIDTH / 2, py + 296, 20, UI.yellow);

  // Statistiche persistenti del livello (totali cumulativi + % migliore).
  const st = getStats(lvl().id);
  text(
    `MIGLIORE: ${st.bestPct}%    TENTATIVI: ${st.attempts}    SALTI: ${st.jumps}`,
    LOGICAL_WIDTH / 2,
    py + 330,
    22,
    UI.yellow
  );

  text('SPAZIO / CLICK = RIGIOCA   •   ESC = MENU', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40, 20, 'rgba(255,255,255,0.9)');
}

// Rettangoli cliccabili dello schermo Opzioni (− / + per ogni volume, mute, back).
function optionRects() {
  const cx = LOGICAL_WIDTH / 2;
  const bw = 60; // lato dei bottoni +/-
  const off = 150; // distanza dei +/- dal centro
  const musicY = 250;
  const sfxY = 340;
  return {
    musicMinus: { x: cx - off - bw, y: musicY, w: bw, h: bw },
    musicPlus: { x: cx + off, y: musicY, w: bw, h: bw },
    sfxMinus: { x: cx - off - bw, y: sfxY, w: bw, h: bw },
    sfxPlus: { x: cx + off, y: sfxY, w: bw, h: bw },
    mute: { x: cx - 150, y: 420, w: 300, h: 64 },
    back: { x: cx - 150, y: 500, w: 300, h: 64 },
  };
}

// Schermo Opzioni: volumi Musica/Effetti (con −/+), mute, indietro.
function drawOptions() {
  screenBackdrop();

  const pw = 720;
  const ph = 420;
  const px = (LOGICAL_WIDTH - pw) / 2;
  const py = (LOGICAL_HEIGHT - ph) / 2 - 30;
  panel(px, py, pw, ph, 'rgba(10,8,24,0.82)');

  text('OPZIONI', LOGICAL_WIDTH / 2, py + 70, 50, UI.yellow);

  const r = optionRects();
  const cx = LOGICAL_WIDTH / 2;

  // Riga MUSICA.
  text('MUSICA', cx, r.musicMinus.y - 16, 26);
  button(r.musicMinus, '−', UI.blue);
  button(r.musicPlus, '+', UI.blue);
  text(`${Math.round(audio.musicVolume * 100)}%`, cx, r.musicMinus.y + 44, 34);

  // Riga EFFETTI.
  text('EFFETTI', cx, r.sfxMinus.y - 16, 26);
  button(r.sfxMinus, '−', UI.blue);
  button(r.sfxPlus, '+', UI.blue);
  text(`${Math.round(audio.sfxVolume * 100)}%`, cx, r.sfxMinus.y + 44, 34);

  // Mute + Indietro.
  button(r.mute, audio.muted ? 'AUDIO: OFF' : 'AUDIO: ON', audio.muted ? '#a02020' : UI.green);
  button(r.back, 'INDIETRO', '#8a3ff0');

  text('ESC = INDIETRO', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 36, 20, 'rgba(255,255,255,0.9)');
}

// Rettangolo cliccabile della freccia "indietro" (in alto a sinistra) di STATS.
function statsBackRect() {
  return { x: 40, y: 40, w: 110, h: 96 };
}

// Schermata STATS dedicata, stile GD: titolo + pannello con righe alternate
// (etichetta a sinistra, valore a destra) + freccia di ritorno.
function drawStats() {
  screenBackdrop();

  // Freccia di ritorno in alto a sinistra.
  arrow(statsBackRect(), -1);

  // Titolo.
  text('STATS', LOGICAL_WIDTH / 2, 110, 60, UI.yellow);

  // Pannello centrale.
  const pw = 860;
  const px = (LOGICAL_WIDTH - pw) / 2;
  const py = 160;
  const rowH = 74;
  const g = getGlobalStats();
  const rows = [
    ['SALTI TOTALI', `${g.jumps}`],
    ['TENTATIVI TOTALI', `${g.attempts}`],
    ['MONETE RACCOLTE', `${g.coins}`],
    ['LIVELLI COMPLETATI', `${g.completed}/${g.total}`],
  ];
  const ph = rows.length * rowH;
  const ctx = renderer.ctx;

  // Sfondo pannello + clip per le fasce arrotondate.
  panel(px, py, pw, ph, 'rgba(60,30,12,0.92)');
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.clip();
  rows.forEach((row, i) => {
    const ry = py + i * rowH;
    // Fasce alternate chiaro/scuro (tonalità ambra come il reference).
    ctx.fillStyle = i % 2 === 0 ? 'rgba(214,138,74,0.55)' : 'rgba(150,84,38,0.55)';
    ctx.fillRect(px, ry, pw, rowH);
    const ty = ry + rowH / 2 + 11;
    textAligned(row[0], px + 36, ty, 30, 'left', UI.yellow);
    textAligned(row[1], px + pw - 36, ty, 30, 'right', '#fff');
  });
  ctx.restore();

  text('FRECCIA / ESC = INDIETRO', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40, 20, 'rgba(255,255,255,0.9)');
}

// Barra stile GD: pillola scura con riempimento verde e percentuale/etichetta.
function drawGdBar(x, y, w, h, frac, label) {
  const ctx = renderer.ctx;
  ctx.save();
  // Sfondo.
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  // Riempimento verde (clippato).
  if (frac > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = UI.green;
    ctx.fillRect(x, y, w * frac, h);
    ctx.restore();
  }
  // Bordo.
  ctx.lineWidth = 5;
  ctx.strokeStyle = UI.outline;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.stroke();
  ctx.restore();
  text(label, x + w / 2, y + h / 2 + h * 0.18, h * 0.5);
}

// Posizioni dei cubi-player (rettangoli cliccabili), condivise render/click.
// Lo slot selezionato è più grande. Centrati e affiancati.
function playerSlots() {
  const n = PLAYERS.length;
  const gap = 120;
  const big = 200;
  const small = 140;
  const cy = LOGICAL_HEIGHT / 2;
  // Larghezza totale stimata per centrare (slot tutti a `big` per semplicità di layout).
  const totalW = n * big + (n - 1) * gap;
  let x = (LOGICAL_WIDTH - totalW) / 2;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const sel = i === playerIndex;
    const s = sel ? big : small;
    const cx = x + big / 2; // centro nello spazio riservato `big`
    slots.push({ i, cx, cy, size: s, x: cx - s / 2, y: cy - s / 2, w: s, h: s });
    x += big + gap;
  }
  return slots;
}

function drawPlayers() {
  const ctx = renderer.ctx;
  screenBackdrop();
  text('SCEGLI IL PLAYER', LOGICAL_WIDTH / 2, 140, 56, UI.yellow);

  // Due cubi affiancati direttamente sullo sfondo (niente box). Il selezionato
  // è più grande, luminoso (glow) e col nome; l'altro più piccolo e opaco.
  for (const slot of playerSlots()) {
    const P = PLAYERS[slot.i];
    const skin = getSkin(P.skin);
    const sel = slot.i === playerIndex;

    ctx.save();
    ctx.globalAlpha = sel ? 1 : 0.55;
    if (sel) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 28;
    }
    if (skin.ready) ctx.drawImage(skin.img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();

    if (sel) text(P.name.toUpperCase(), slot.cx, slot.y + slot.h + 50, 40);
  }

  text('←  →  / CLICK PER SCEGLIERE   •   SPAZIO PER CONFERMARE', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 50, 22, 'rgba(255,255,255,0.9)');
}

// Pulse 0..1 che batte sul beat (1 sul colpo, decade fino al successivo).
function beatPulseValue() {
  const phase = audio.beatPhase(); // 0..1
  return Math.max(0, 1 - phase * 2); // breve flash sul battito
}

// Pavimento: stile in base alla location corrente. Copre tutta la larghezza
// reale (extLeft..extRight) per non lasciare bande.
function drawFloor(camX) {
  if (lvl().floor === 'la') drawFloorLa(camX);
  else if (lvl().floor === 'city') drawFloorCity(camX);
  else drawFloorNeon(camX);
}

// Los Angeles: passeggiata/lungomare. Fascia base + assi verticali scorrevoli
// + bordo superiore chiaro. Copre tutta la larghezza reale (extLeft..extRight).
function drawFloorLa(camX) {
  const ctx = renderer.ctx;
  const L = renderer.extLeft;
  const R = renderer.extRight;
  const W = R - L;
  const B = renderer.extBottom;

  // Fascia base.
  ctx.fillStyle = LA_FLOOR_COLOR;
  ctx.fillRect(L, FLOOR_Y, W, B - FLOOR_Y);

  // Assi della passeggiata: linee verticali a periodo fisso che scorrono.
  const period = 46;
  ctx.strokeStyle = LA_FLOOR_PLANK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const off = ((camX % period) + period) % period;
  for (let x = L - off; x <= R; x += period) {
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x, B);
  }
  ctx.stroke();

  // Bordo superiore chiaro.
  ctx.strokeStyle = LA_FLOOR_LINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(L, FLOOR_Y);
  ctx.lineTo(R, FLOOR_Y);
  ctx.stroke();
}

// Neon (GD): fascia scura + griglia quadrettata scorrevole + linea bianca glow.
function drawFloorNeon(camX) {
  const ctx = renderer.ctx;
  const L = renderer.extLeft;
  const R = renderer.extRight;
  const W = R - L;
  const B = renderer.extBottom;

  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(L, FLOOR_Y, W, B - FLOOR_Y);

  ctx.strokeStyle = FLOOR_GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const offset = camX % GRID_SIZE;
  for (let x = L - (((L % GRID_SIZE) + GRID_SIZE) % GRID_SIZE) - offset; x <= R; x += GRID_SIZE) {
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x, B);
  }
  for (let y = FLOOR_Y + GRID_SIZE; y < FLOOR_Y + FLOOR_HEIGHT; y += GRID_SIZE) {
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
  }
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = GLOW_COLOR;
  ctx.shadowBlur = GLOW_BLUR;
  ctx.strokeStyle = FLOOR_TOP_LINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L, FLOOR_Y);
  ctx.lineTo(R, FLOOR_Y);
  ctx.stroke();
  ctx.restore();
}

// Hash deterministico -> [0,1) da un numero (per il jitter dei mattoni).
function frand(n) {
  const x = Math.sin(n * 91.7 + 41.3) * 43758.5453;
  return x - Math.floor(x);
}
// Larghezze dei mattoni di una fila (variabili: corti e lunghi), che sommano
// ESATTAMENTE `period` (l'ultimo assorbe il resto). Deterministico per riga.
function brickRowWidths(rowIndex, period) {
  const widths = [];
  let used = 0;
  let k = 0;
  while (used < period - 20) {
    const r = frand(rowIndex * 17.9 + k * 5.1);
    // Larghezza tra ~36 e ~96 px: mix di mattoni corti e lunghi.
    let w = 36 + r * 60;
    if (used + w > period) w = period - used; // ultimo mattone: riempie il resto
    widths.push(w);
    used += w;
    k++;
  }
  // Garantisce somma == period.
  const diff = period - used;
  if (widths.length) widths[widths.length - 1] += diff;
  return widths;
}

// Tono del mattone variato attorno a CITY_FLOOR_BRICK (h in [0,1)).
function brickShade(h) {
  const [r, g, b] = hexToRgb(CITY_FLOOR_BRICK);
  const d = Math.round((h - 0.5) * 36); // +/- ~18 di luminosità
  const c = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

// Città: fascia arancione + texture a mattoni sfalsati irregolari + bordo.
function drawFloorCity(camX) {
  const ctx = renderer.ctx;
  const L = renderer.extLeft;
  const R = renderer.extRight;
  const W = R - L;
  const B = renderer.extBottom;

  // Fascia base (fa anche da "fuga" tra i mattoni).
  ctx.fillStyle = CITY_FLOOR_COLOR;
  ctx.fillRect(L, FLOOR_Y, W, B - FLOOR_Y);

  // Texture a mattoni "realistica" da muretto: mattoni di LUNGHEZZE diverse
  // (alcuni lunghi, altri corti), file sfalsate in modo irregolare e tono
  // leggermente variato. Ogni fila si ripete su un PERIODO fisso (`period`):
  // i mattoni dentro al periodo hanno larghezze variabili che sommano esatte al
  // periodo, così il wrap è perfetto e lo scroll resta liscio.
  const bh = 26; // altezza mattone
  const grout = 4; // fuga tra i mattoni
  const period = 380; // lunghezza che si ripete in una fila

  let rowIndex = 0;
  for (let y = FLOOR_Y + grout; y < B; y += bh + grout) {
    // Larghezze dei mattoni del periodo (variabili), normalizzate a `period`.
    const widths = brickRowWidths(rowIndex, period);

    // Sfalsamento irregolare della fila + scroll della camera, modulo periodo.
    const rowShift = period * frand(rowIndex * 3.7);
    let startWorld = -(((camX + rowShift) % period) + period); // due periodi a sinistra
    // Disegna periodi affiancati finché si copre lo schermo.
    for (let base = startWorld; base < R - L + period; base += period) {
      let penX = L + base;
      for (let k = 0; k < widths.length; k++) {
        const w = widths[k];
        if (penX + w > L && penX < R) {
          const h = frand(rowIndex * 13.1 + k * 7.3);
          ctx.fillStyle = brickShade(h);
          ctx.fillRect(penX + grout / 2, y, w - grout, bh);
        }
        penX += w;
      }
    }
    rowIndex++;
  }

  // Bordo superiore chiaro.
  ctx.strokeStyle = CITY_FLOOR_LINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(L, FLOOR_Y);
  ctx.lineTo(R, FLOOR_Y);
  ctx.stroke();
}

// Path di una stella a 5 punte (punta in alto) centrata in (ox, oy).
function coinStarPath(ctx, outer, ox = 0, oy = 0) {
  const inner = outer * 0.46;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = ox + Math.cos(a) * rad;
    const py = oy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Icona moneta riusabile (HUD, menu, schermo completamento), look 3D coerente
// con l'entità in gioco. `filled=false` = moneta "non ancora presa" (vuota).
// Usa il PNG se caricato, altrimenti il disegno vettoriale.
function drawCoinIcon(cx, cy, r, filled = true) {
  const ctx = renderer.ctx;
  ctx.save();
  if (COIN_IMG && COIN_IMG.ready) {
    // Non raccolta = moneta sbiadita e grigia (il filtro agisce solo
    // sull'immagine e ne rispetta la trasparenza: resta ROTONDA).
    if (!filled) ctx.filter = 'grayscale(70%) brightness(0.7) opacity(30%)';
    ctx.drawImage(COIN_IMG.img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  ctx.translate(cx, cy);

  // Fallback vettoriale: la non raccolta è la stessa moneta ma molto tenue
  // (niente sagoma scura), così resta rotonda e coerente con lo stato PNG.
  if (!filled) ctx.globalAlpha = 0.3;

  // Fascia esterna scura (spessore 3D).
  ctx.fillStyle = COIN_COLOR_DARK;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Faccia interna con gradiente radiale (volume).
  const face = r * 0.82;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, face);
  g.addColorStop(0, COIN_COLOR_LIGHT);
  g.addColorStop(0.55, COIN_COLOR);
  g.addColorStop(1, COIN_COLOR_DARK);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, face, 0, Math.PI * 2);
  ctx.fill();

  // Bordo scuro netto.
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = COIN_EDGE;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Stella grande, incisa (ombra) + piena + contorno.
  const outer = r * 0.74;
  coinStarPath(ctx, outer, r * 0.06, r * 0.06);
  ctx.fillStyle = COIN_STAR_EDGE;
  ctx.fill();
  coinStarPath(ctx, outer);
  ctx.fillStyle = COIN_STAR;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = COIN_STAR_EDGE;
  ctx.stroke();

  ctx.restore();
}

function drawHud() {
  const ctx = renderer.ctx;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = uiFont('26px');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = UI.outline;
  ctx.strokeText(`TENTATIVI: ${attempts}`, 24, 56);
  ctx.fillStyle = '#fff';
  ctx.fillText(`TENTATIVI: ${attempts}`, 24, 56);
  ctx.restore();

  // Contatore monete in alto a destra, con icona moneta.
  const cr = 15;
  const cyc = 56 + 13;
  const label = `${coinsCollected}/${COINS_PER_LEVEL}`;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = uiFont('26px');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  const tx = LOGICAL_WIDTH - 24;
  ctx.strokeStyle = UI.outline;
  ctx.strokeText(label, tx, cyc);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, tx, cyc);
  ctx.restore();
  // Misura il testo per piazzare l'icona alla sua sinistra.
  ctx.save();
  ctx.font = uiFont('26px');
  const tw = ctx.measureText(label).width;
  ctx.restore();
  drawCoinIcon(tx - tw - cr - 8, cyc, cr, true);
}

// Barra di avanzamento centrata in alto: pillola gialla con bordo bianco glow.
function drawProgressBar() {
  const ctx = renderer.ctx;
  const w = LOGICAL_WIDTH * 0.42; // più stretta e centrata (come l'originale)
  const h = 22;
  const x = (LOGICAL_WIDTH - w) / 2;
  const y = 22;
  const r = h / 2;

  const progress = Math.max(0, Math.min(1, player.x / finishX));

  ctx.save();

  // Sfondo della pillola.
  ctx.fillStyle = PROGRESS_BG_COLOR;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Riempimento giallo (clip alla pillola per arrotondare gli angoli).
  if (progress > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = PROGRESS_BAR_COLOR;
    ctx.fillRect(x, y, w * progress, h);
    ctx.restore();
  }

  // Bordo bianco luminoso.
  ctx.shadowColor = GLOW_COLOR;
  ctx.shadowBlur = GLOW_BLUR;
  ctx.strokeStyle = EDGE_COLOR;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
  ctx.stroke();

  ctx.restore();
}

// Helper: rettangolo con angoli arrotondati.
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

init();
const loop = new GameLoop(update, render);
loop.start();

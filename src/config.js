// =============================================================================
// config.js — Costanti di gameplay e rendering.
// Tutto ciò che si "tweakka" vive qui: timestep, dimensioni logiche, colori,
// velocità di scroll, e (nelle fasi successive) gravità/salto.
// =============================================================================

// --- Game loop --------------------------------------------------------------
// Timestep fisso: 60 update logici al secondo. La fisica usa SEMPRE questo dt,
// indipendentemente dal framerate reale dello schermo.
export const FIXED_DT = 1 / 60; // secondi per update logico
// Tetto al tempo di frame per evitare la "spiral of death" dopo un freeze/tab
// in background (es. il PC dorme e poi riprende).
export const MAX_FRAME_TIME = 0.25; // secondi

// --- Risoluzione logica -----------------------------------------------------
// Il mondo di gioco ragiona in unità logiche costanti. Il Renderer scala questa
// area sul canvas fisico, così la fisica resta indipendente dalla risoluzione.
export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

// --- Colori -----------------------------------------------------------------
export const COLORS = {
  background: '#1a0b3a', // fondo scuro saturo (base del gradiente tema)
  player: '#7cff4f', // verde neon del cubo
};

// Temi colore dello sfondo. Cambiano attraversando i portali (lerp morbido in
// main.js). Ogni tema = gradiente verticale { top, bottom }.
// --- Location NEON (mattoni viola) ---
export const THEME_CUBE = { top: '#5a1a9e', bottom: '#3a0e6b' }; // viola (cubo)
export const THEME_SHIP = { top: '#c01050', bottom: '#7a0a30' }; // rosso/magenta (razzo)

// --- Location CITTÀ (skyline rosso) ---
export const CITY_CUBE = { top: '#ffb3a0', bottom: '#e02314' }; // cielo rosso (Città)
export const CITY_SHIP = { top: '#ff5a3c', bottom: '#7a0a0a' }; // vira al rosso scuro
// --- Location LOS ANGELES (tramonto sulla spiaggia) ---
// Cielo: viola in alto -> arancio/giallo all'orizzonte. Vira di poco in ship.
export const LA_CUBE = { top: '#6a4a9e', bottom: '#ff9a52' }; // viola -> arancio caldo
export const LA_SHIP = { top: '#4a2a7a', bottom: '#e0662e' }; // viola scuro -> arancio intenso
export const LA_SILHOUETTE = '#3a2a6a'; // palme/case/molo/lampione (viola-indaco scuro)
export const LA_SILHOUETTE_FAR = '#7a5a9a'; // strato lontano (più chiaro/atmosferico)
export const LA_CLOUD_COLOR = 'rgba(255, 210, 200, 0.55)'; // nuvole rosa-crema
export const LA_SUN_COLOR = '#ffd27a'; // alone del sole basso
export const LA_FLOOR_COLOR = '#5a4a7a'; // passeggiata/lungomare (base)
export const LA_FLOOR_LINE = '#caa6e0'; // bordo superiore chiaro
export const LA_FLOOR_PLANK = 'rgba(0,0,0,0.18)'; // assi/linee della passeggiata

// Cielo placeholder per Metro (notte). Riusa lo sfondo 'city' finché non avremo
// lo sfondo dedicato (reference in arrivo).
export const METRO_CUBE = { top: '#9ab8ff', bottom: '#14245e' }; // blu notte (Metro)
export const METRO_SHIP = { top: '#5a7aff', bottom: '#0a1030' };
// Strati di grattacieli, dal lontano (chiaro) al vicino (scuro). `top` è la
// quota massima dei tetti come frazione dell'altezza dello schermo (0 = alto):
// strati lontani restano BASSI (top alto) così il cielo resta visibile.
// periodMul = ampiezza del macro-slot (più alto = più cielo, meno palazzi).
// maxCount = palazzi max per cluster. topMin/topMax = quota tetto (più alto = palazzo più basso).
export const CITY_BUILDINGS = [
  { speed: 0.18, color: '#f08a7a', topMin: 0.42, topMax: 0.58, windows: false, stripes: false, periodMul: 5, maxCount: 4 },
  { speed: 0.38, color: '#d8402e', topMin: 0.34, topMax: 0.5, windows: true, stripes: true, periodMul: 6, maxCount: 3 },
  { speed: 0.62, color: '#a81f12', topMin: 0.6, topMax: 0.74, windows: true, stripes: true, periodMul: 11, maxCount: 2 },
];
export const CITY_WINDOW_COLOR = 'rgba(255, 200, 190, 0.7)';
export const CITY_STRIPE_COLOR = 'rgba(255, 195, 185, 0.35)';
export const CITY_CLOUD_COLOR = 'rgba(255, 215, 205, 0.55)';

// Pavimento città (fascia rossa con riga di mattoncini in cima).
export const CITY_FLOOR_COLOR = '#cc2418';
export const CITY_FLOOR_BRICK = '#a81d12';
export const CITY_FLOOR_LINE = '#ffb3a0';

// --- Livelli (dati-driven): sfondo, pavimento, temi, difficoltà, mappa --------
// `bg`/`floor` = stile sfondo/pavimento; `cube`/`ship` = temi colore (vira ai
// portali); `scrollSpeed` = difficoltà; `mapKey` = quale mappa in data/;
// `diffFrac` = riempimento [0,1] della barra difficoltà nel menu.
// Livelli in ordine di difficoltà: Città (facile) · Los Angeles (medio) · Metro
// (difficile). LA e Metro usano `bg:'city'` come placeholder finché non avremo
// gli sfondi dedicati (reference in arrivo) — cambia solo il colore del cielo.
export const LEVELS = [
  {
    id: 'city',
    name: 'Città',
    diff: 'Facile',
    bg: 'city',
    floor: 'city',
    cube: CITY_CUBE,
    ship: CITY_SHIP,
    scrollSpeed: 585, // invariato
    mapKey: 'level2', // mappa Città invariata
    diffFrac: 0.25, // barra "facile" nel menu
  },
  {
    id: 'la',
    name: 'Los Angeles',
    diff: 'Medio',
    bg: 'la', // tramonto sulla spiaggia (LaBackground)
    floor: 'la', // passeggiata/lungomare
    cube: LA_CUBE,
    ship: LA_SHIP,
    scrollSpeed: 480, // medio
    mapKey: 'la',
    diffFrac: 0.55,
    comingSoon: true, // livello bloccato: visibile ma non avviabile
  },
  {
    id: 'metro',
    name: 'Metro',
    diff: 'Difficile',
    bg: 'city', // TODO: sfondo dedicato (reference in arrivo)
    floor: 'city',
    cube: METRO_CUBE,
    ship: METRO_SHIP,
    scrollSpeed: 560, // difficile
    mapKey: 'metro',
    diffFrac: 0.9,
    comingSoon: true, // livello bloccato: visibile ma non avviabile
  },
  {
    id: 'skyline',
    name: 'Skyline',
    diff: 'Medio',
    bg: 'city', // styling città (bg valido: city/la)
    floor: 'city',
    cube: LA_CUBE, // riusa i temi colore esistenti
    ship: LA_SHIP,
    scrollSpeed: 585, // target di design del livello
    mapKey: 'skyline',
    diffFrac: 0.55, // barra "medio" nel menu
  },
  {
    id: 'skyline2',
    name: 'Skyline 2',
    diff: 'Medio',
    bg: 'losangeles', // sfondo a immagine (bg-los-angeles.png) in loop
    floor: 'city',
    cube: LA_CUBE, // riusa i temi colore esistenti
    ship: LA_SHIP,
    scrollSpeed: 585, // identico a Skyline (livello 4)
    mapKey: 'skyline2',
    diffFrac: 0.55, // barra "medio" nel menu
  },
];

// --- Player selezionabili: cambia solo la skin del cubo (fisica identica) -----
export const PLAYERS = [
  { id: 'artie', name: 'Artie', skin: '/artie-cube.webp' },
  { id: 'miles', name: 'Miles', skin: '/miles-cubo.webp' },
];

// --- Stile UI delle pagine (look Geometry Dash) ------------------------------
export const UI_FONT = "'SoccerLeague', system-ui, sans-serif"; // font UI locale
export const UI = {
  outline: '#0a0a12', // bordo scuro spesso (testo e pulsanti)
  green: '#5fd000', // verde START / barre
  greenDark: '#3f9000',
  blue: '#2b54e0', // pannello blu (selezione livello)
  bluePanel: '#1733a8',
  yellow: '#ffd23f', // accenti
  text: '#ffffff',
};

// Glow neon condiviso (alone bianco luminoso attorno a bordi/elementi).
export const GLOW_COLOR = '#ffffff';
export const GLOW_BLUR = 14; // raggio del blur in unità logiche
export const EDGE_COLOR = '#ffffff'; // bordo bianco luminoso generico

// Cubo: bordo bianco + quadratino interno scuro.
export const PLAYER_EDGE = '#ffffff';
export const PLAYER_INNER = '#102015';

// --- Gameplay ---------------------------------------------------------------
// Velocità di scorrimento orizzontale del mondo (unità logiche / secondo).
export const SCROLL_SPEED = 468; // default Camera (sovrascritto per livello)

// --- Fisica del player ------------------------------------------------------
// Valori in unità logiche e secondi. Pensati per dare il classico "arco" di
// salto di Geometry Dash: salita rapida, gravità decisa, atterraggio netto.
// Velocità globale +30% proporzionale: scroll/velocità ×1.30, gravità ×1.30²
// (=1.69). Così la durata d'aria si accorcia ma l'ARCO di salto resta identico
// rispetto agli ostacoli — il level design non cambia, va solo più veloce.
export const PLAYER_SIZE = 60; // lato del cubo (quadrato)
export const GRAVITY = 4732; // 2800 × 1.69 (gravità scala col quadrato di k)
export const JUMP_VELOCITY = -1300; // -1000 × 1.30
export const MAX_FALL_SPEED = 2080; // 1600 × 1.30

// --- Fisica del razzo (modalità ship) ---------------------------------------
// Volo tipo jetpack: gravità ridotta, spinta su tenendo premuto, velocità
// verticale clampata in entrambi i versi.
export const SHIP_GRAVITY = GRAVITY * 0.42; // scala automaticamente con GRAVITY
export const SHIP_THRUST = GRAVITY * 0.95; // scala automaticamente con GRAVITY
export const SHIP_MAX_RISE = -832; // -640 × 1.30 (velocità)
export const SHIP_MAX_FALL = 988; // 760 × 1.30 (velocità)
export const SHIP_MAX_TILT = 0.5; // inclinazione max del muso (rad)
export const SHIP_TILT_LERP = 0.18; // morbidezza dell'inclinazione (0..1)
export const SHIP_COLOR = '#7cff4f'; // verde neon, coerente col cubo

// --- Skin personalizzate (PNG in public/) -----------------------------------
// Sostituiscono il disegno vettoriale di cubo/razzo quando caricate.
// Se i file mancano, il gioco usa automaticamente il disegno vettoriale.
export const CUBE_SKIN = '/artie-cube.webp';
export const SHIP_SKIN = '/dodge-artie.webp';
export const USE_SKIN_GLOW = false; // bordo glow attorno alla skin (off: skin pulita)

// --- Griglia di tile --------------------------------------------------------
// Dimensione di una cella. Coincide col lato del cubo: tutto si allinea alla
// griglia (blocchi, spuntoni, pavimento).
export const TILE = 60;

// Posizione del pavimento: altezza della striscia di terreno dal fondo.
// Multiplo intero di TILE così la griglia poggia esattamente sul pavimento.
export const FLOOR_HEIGHT = TILE * 2; // spessore visivo del pavimento (u)
// La quota Y del "pavimento" su cui poggia il fondo del cubo.
export const FLOOR_Y = LOGICAL_HEIGHT - FLOOR_HEIGHT;

// X fissa del player sullo schermo (in GD il cubo resta fermo e il mondo scorre).
export const PLAYER_X = 220;

// Rotazione: il cubo compie un giro completo (360°) per salto e atterra dritto.
// Velocità angolare calibrata sulla durata d'aria (~0.714s) così il giro si
// chiude proprio all'atterraggio: 2π / 0.714 ≈ 8.8 rad/s.
export const ROTATION_SPEED = Math.PI * 2.8 * 1.3; // ×k: chiude il giro nella durata d'aria ridotta

// Pavimento: fascia scura, linea superiore bianca brillante, griglia quadrettata.
export const FLOOR_COLOR = '#0a0618'; // fascia di terreno quasi nera
export const FLOOR_TOP_LINE = '#ffffff'; // linea luminosa in cima al pavimento
export const FLOOR_GRID_COLOR = 'rgba(255,255,255,0.10)'; // linee griglia tenui
export const GRID_SIZE = TILE; // passo della quadrettatura

// --- Tile / ostacoli --------------------------------------------------------
// Legenda della griglia delle mappe in data/ (level2, la, metro):
//   0 = vuoto, 1 = blocco, 2 = spuntone, 3 = portale-ship, 4 = portale-cube,
//   5 = orb, 6 = spuntone piccolo, 7 = spuntone capovolto, 8 = pad, 9 = moneta
//   s = "pavimento spinato" (zanne corte fitte + 1-2 punte alte), mortale
export const TILE_EMPTY = 0;
export const TILE_BLOCK = 1;
export const TILE_SPIKE = 2;
export const TILE_PORTAL_SHIP = 3;
export const TILE_PORTAL_CUBE = 4;
export const TILE_ORB = 5;
export const TILE_SPIKE_SMALL = 6; // spuntone basso (mezza altezza)
export const TILE_SPIKE_DOWN = 7; // spuntone capovolto (appeso, punta in basso)
export const TILE_PAD = 8; // jump pad giallo (balzo automatico al contatto)
export const TILE_COIN = 9; // moneta collezionabile (max 5 per livello)
// Codice NON numerico (carattere): pavimento di zanne fitte. Mortale come uno
// spuntone, disegno dedicato. Va messo tra blocchi/piattaforme da scavalcare.
export const TILE_SPIKE_FLOOR = 's';

// Blocchi e spuntoni: riempimento a gradiente (nero in alto -> rosso scuro in
// basso) + bordo bianco luminoso (glow).
export const OBSTACLE_FILL_TOP = '#0a0a12'; // gradiente: quasi nero in cima
export const OBSTACLE_FILL_BOTTOM = '#7a0a0a'; // gradiente: rosso scuro sul fondo
export const BLOCK_GRID_COLOR = 'rgba(255,255,255,0.12)'; // texture griglia interna

// Portali (pillola verticale alta ~2 tile) e orb (anello giallo).
export const PORTAL_SHIP_COLOR = '#ff3fae'; // magenta -> entra in modalità razzo
export const PORTAL_CUBE_COLOR = '#3fff9e'; // verde -> ritorna cubo
export const PORTAL_HEIGHT = TILE * 3; // altezza visiva del portale
// Particelle orbitanti attorno all'anello (risucchiate verso il centro, stile GD).
export const PORTAL_PARTICLE_COUNT = 28; // particelle per portale
export const PORTAL_PARTICLE_LIFE = 1.6; // durata (s) di un ciclo orbita -> risucchio
export const PORTAL_PARTICLE_SIZE = 6; // raggio base
export const ORB_COLOR = '#ffd23f'; // giallo
export const ORB_RADIUS = 26; // raggio dell'anello

// Jump pad: balzo automatico e potente al contatto (più forte del salto).
export const PAD_COLOR = '#ffd23f'; // giallo
export const PAD_VELOCITY = -1950; // -1500 × 1.30 (velocità), > |JUMP_VELOCITY|

// Monete collezionabili: ruotano su sé stesse (spin 360°). PNG con fallback
// vettoriale (cerchio dorato + stella). Raccolta su contatto, max 5 per livello.
export const COINS_PER_LEVEL = 5;
export const COIN_RADIUS = 18; // raggio della moneta
export const COIN_SPIN_SPEED = 3; // velocità della rotazione (rad/s)
export const COIN_COLOR = '#ffcf33'; // dorato (corpo)
export const COIN_COLOR_LIGHT = '#fff3b0'; // dorato chiaro (highlight 3D)
export const COIN_COLOR_DARK = '#e0a31e'; // dorato scuro (gradiente/retro)
export const COIN_EDGE = '#101010'; // bordo scuro
export const COIN_STAR = '#ffe06a'; // stella interna (chiara, ben visibile)
export const COIN_STAR_EDGE = '#8a6a12'; // contorno scuro della stella

// --- Polish (FASE 5) --------------------------------------------------------
// Particelle alla morte.
export const PARTICLE_COUNT = 26; // quante schegge esplodono
export const PARTICLE_SPEED = 520; // velocità iniziale max (u/s)
export const PARTICLE_LIFE = 0.7; // durata di vita (s)
export const PARTICLE_GRAVITY = 1400; // gravità sulle schegge (u/s^2)

// Scia del cubo: campioni recenti della posizione.
export const TRAIL_LENGTH = 14; // numero di "fantasmi" della scia
export const TRAIL_INTERVAL = 0.016; // intervallo di campionamento (s)
export const TRAIL_CUBE_COLOR = '#ff3b3b'; // scia rossa in modalità cubo
export const TRAIL_RED_GLOW = '#ff2a2a'; // glow della striscia rossa del razzo
export const TRAIL_STAR_COLOR = '#ffd23f'; // stelle gialle in modalità razzo
export const TRAIL_STAR_EDGE = '#7a4a00'; // bordo scuro delle stelle (definizione)

// Emettitore di stelle del razzo (effetto "fumo di stelle").
export const STAR_RATE = 1; // stelle emesse per frame (rade)
export const STAR_EMIT_EVERY = 3; // ...una ogni N frame (ulteriore diradamento)
export const STAR_LIFE = 0.85; // durata di vita (s)
export const STAR_SPEED = 280; // velocità all'indietro (u/s)
export const STAR_SPREAD = 130; // dispersione verticale (u/s)
export const STAR_SIZE = 16; // raggio esterno base della stella

// Sfondo a parallasse: layer di grandi "mattoni" rettangolari semi-trasparenti
// (schiariture del tema) che scorrono a frazioni diverse della camera.
export const PARALLAX_LAYERS = [
  { speed: 0.12, color: 'rgba(255,255,255,0.04)', cell: 320, gap: 28 },
  { speed: 0.28, color: 'rgba(255,255,255,0.05)', cell: 200, gap: 22 },
  { speed: 0.5, color: 'rgba(255,255,255,0.06)', cell: 130, gap: 16 },
];

// Audio / beat.
export const BPM = 128; // battiti al minuto del beat segnaposto
export const MUSIC_VOLUME = 0.18; // volume musica di default (0..1)
export const SFX_VOLUME = 0.5; // volume effetti sonori di default (0..1)
// Brani di sottofondo (loop), uno per contesto. Se un file manca → fallback al
// beat sintetizzato. 'home' suona nei menu, 'game' durante un livello.
export const MUSIC_TRACKS = { home: '/home.m4a', game: '/game.mp3' };

// Barra di avanzamento (stile GD: pillola gialla con bordo bianco).
export const PROGRESS_BAR_COLOR = '#ffd23f';
export const PROGRESS_BG_COLOR = 'rgba(0,0,0,0.35)';

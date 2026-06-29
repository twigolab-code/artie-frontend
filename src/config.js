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

// Pavimento Metro (banchina): viola chiaro uniforme + piastrelle larghe.
export const METRO_FLOOR_COLOR = '#6a5a9a'; // fascia base (banchina)
export const METRO_FLOOR_TILE = '#8a7ab8'; // linee delle piastrelle (fuga chiara)
export const METRO_FLOOR_LINE = '#cdbff0'; // bordo superiore chiaro

// Pavimento Car Wash (asfalto notturno): mattoni grigio scuro + bordo rosso neon.
export const WASH_FLOOR_COLOR = '#23202a'; // asfalto scuro (base/fuga)
export const WASH_FLOOR_BRICK = '#2e2a36'; // mattone grigio asfalto (poco piu' chiaro)
export const WASH_FLOOR_EDGE = '#e0322a'; // bordo superiore rosso neon

// Pavimento Boulevard (strada azzurra): assi blu (stessa logica passeggiata LA).
export const BLVD_FLOOR_COLOR = '#3f6fa8'; // fascia base blu
export const BLVD_FLOOR_PLANK = 'rgba(0,0,0,0.16)'; // assi/linee
export const BLVD_FLOOR_LINE = '#bfe0ff'; // bordo superiore chiaro

// --- Ambiente "razzo" (quando il cubo si trasforma in razzo) ----------------
// Il pavimento e l'atmosfera virano verso una tinta energetica/spaziale,
// pilotati da themeT (0 = cubo, 1 = razzo).
export const ROCKET_FLOOR_COLOR = '#2a1a6a'; // pavimento → viola/indaco profondo
export const ROCKET_FLOOR_LINE = '#9a7bff'; // linea superiore → viola luminoso
export const ROCKET_TINT = '#6a3cff'; // velo/vignette + stelle
export const ROCKET_STAR_COLOR = '#cdbfff'; // stelle di sfondo
export const ROCKET_SPEED_LINE_COLOR = '#b8a6ff'; // linee di velocità (warp)

// --- Livelli (dati-driven): sfondo, pavimento, temi, difficoltà, mappa --------
// `bg`/`floor` = stile sfondo/pavimento; `cube`/`ship` = temi colore (vira ai
// portali); `scrollSpeed` = pace (uguale 630 per tutti); `mapKey` = quale mappa in
// data/; `diff`/`diffFrac` = etichetta + riempimento [0,1] della barra difficoltà.
// PROVVISORIO: tutti i livelli condividono la griglia `testedo` (mapKey: 'testedo')
// come segnaposto, finché non si creano i percorsi veri di ognuno col Builder. Ogni
// livello mantiene comunque i SUOI colori (bg/floor/obstacleBottom/cube/ship), così
// gli elementi (blocchi/spuntoni) restano coerenti con lo sfondo anche se il percorso
// è lo stesso. `obstacleBottom` è applicato in render (NON è dentro la griglia).
export const LEVELS = [
  {
    // Livello creato col Game Builder e importato come built-in (visibile a tutti).
    // Aspetto Car Wash; messo PRIMO nel carosello (l'ordine non è più strettamente
    // per difficoltà crescente: questo è un livello difficile in testa).
    id: 'testedo',
    name: 'TESTEDO',
    diff: 'Difficile', // lungo, sezione ship + orb/pad, fino a 4 hazard contigui
    bg: 'carwash', // sfondo immagine wash.webp (loop)
    floor: 'carwash', // asfalto scuro + bordo rosso neon
    cube: LA_CUBE,
    ship: LA_SHIP,
    obstacleBottom: '#9a1414', // rosso neon scuro, coerente col bordo neon dell'asfalto
    scrollSpeed: 630,
    mapKey: 'testedo',
    diffFrac: 0.85,
  },
  {
    id: 'city',
    name: 'City',
    diff: 'Facile', // L1: il piu facile (verticalita dolce, razzo subito)
    bg: 'city', // skyline procedurale
    floor: 'city',
    cube: LA_CUBE, // riusa i temi colore esistenti
    ship: LA_SHIP,
    obstacleBottom: '#8a1410', // bottom gradiente ostacoli coerente col floor rosso
    scrollSpeed: 630,
    mapKey: 'testedo', // PROVVISORIO: griglia segnaposto (colori City restano)
    diffFrac: 0.30,
  },
  {
    id: 'carwash',
    name: 'Car Wash',
    diff: 'Medio', // L2: tower hopping, razzo presto
    bg: 'carwash', // sfondo immagine wash.webp (loop)
    floor: 'carwash', // asfalto scuro + bordo rosso neon
    cube: LA_CUBE,
    ship: LA_SHIP,
    obstacleBottom: '#9a1414', // rosso neon scuro, coerente col bordo neon dell'asfalto
    scrollSpeed: 630,
    mapKey: 'testedo', // PROVVISORIO: griglia segnaposto (colori Car Wash restano)
    diffFrac: 0.45,
  },
  {
    id: 'losangeles',
    name: 'Los Angeles',
    diff: 'Medio', // L3: catene aeree + 1o tunnel + pad, ship a meta
    bg: 'losangeles', // sfondo immagine LA.webp (loop)
    floor: 'la', // passeggiata viola
    cube: LA_CUBE,
    ship: LA_SHIP,
    obstacleBottom: '#8a3a12', // ambra/arancio scuro, coerente col tramonto LA
    scrollSpeed: 630,
    mapKey: 'testedo', // PROVVISORIO: griglia segnaposto (colori Los Angeles restano)
    diffFrac: 0.60,
  },
  {
    id: 'boulevard',
    name: 'Boulevard',
    diff: 'Difficile', // L4: catena orb + torri alte, ship tardi
    bg: 'boulevard', // sfondo immagine boulevard.webp (loop)
    floor: 'boulevard', // strada azzurra ad assi
    cube: LA_CUBE,
    ship: LA_SHIP,
    obstacleBottom: '#143a6a', // blu scuro, coerente col floor azzurro
    scrollSpeed: 630,
    mapKey: 'testedo', // PROVVISORIO: griglia segnaposto (colori Boulevard restano)
    diffFrac: 0.78,
  },
  {
    id: 'metro',
    name: 'Metro',
    diff: 'Difficile', // L5: il piu difficile (tutto insieme, ship finale)
    bg: 'metro', // sfondo immagine metro.webp (loop)
    floor: 'metro', // banchina viola chiaro
    cube: LA_CUBE,
    ship: LA_SHIP,
    obstacleBottom: '#241a52', // indaco/viola scuro, coerente con la banchina viola
    scrollSpeed: 630,
    mapKey: 'testedo', // PROVVISORIO: griglia segnaposto (colori Metro restano)
    diffFrac: 0.95,
  },
];

// --- Player selezionabili: skin (cubo + razzo) + look della scia (fisica identica) ---
// `fx` definisce l'aspetto della scia per-player (vedi TRAIL_*/STAR_* sotto):
//  trail = colore quadratini cubo + striscia razzo, glow = alone della striscia,
//  star  = colore del particellare di coda del razzo, shape = 'star' | 'note'.
// Hex inlinati qui (le costanti TRAIL_* sono dichiarate piu' in basso nel file).
export const PLAYERS = [
  {
    id: 'artie', name: 'Artie', skin: '/artie-cube.webp', ship: '/dodge-artie.webp',
    fx: { trail: '#ff3b3b', glow: '#ff2a2a', star: '#ffd23f', shape: 'star' }, // rosso + stelle
  },
  {
    id: 'miles', name: 'Miles', skin: '/miles-cubo.webp', ship: '/miles-razzo.png',
    fx: { trail: '#ff8a1e', glow: '#ff6a00', star: '#ffd23f', shape: 'note' }, // arancione + note
  },
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

// Cubo: bordo bianco + riempimento a gradiente (stile triangoli, niente griglia interna).
export const PLAYER_EDGE = '#ffffff';
export const PLAYER_INNER = '#102015'; // ancora usato per l'oblò del razzo
export const PLAYER_FILL_TOP = '#aaff8c'; // gradiente cubo: verde chiaro in alto
export const PLAYER_FILL_BOTTOM = '#3fb81f'; // gradiente cubo: verde scuro in basso

// --- Gameplay ---------------------------------------------------------------
// Velocità di scorrimento orizzontale del mondo (unità logiche / secondo).
export const SCROLL_SPEED = 468; // default Camera (sovrascritto per livello)

// --- Fisica del player ------------------------------------------------------
// Salto in stile Geometry Dash: BASSO e CORTO/SCATTANTE. Misure reali
// (integratore discreto @60Hz, scroll 630): apice ~2.0 tile, durata d'aria
// ~0.40s, gittata ~4.2 tile. Più corto del vecchio arco (apice ~2.8, gittata
// ~5.6) così la rotazione del cubo (180° per salto) sembra più rapida. NB: i
// livelli inclusi erano tarati sull'arco vecchio — alcuni NON passano più il
// validatore di giocabilità (scelta voluta; vedi §7 CLAUDE.md).
export const PLAYER_SIZE = 60; // lato del cubo (quadrato)
export const GRAVITY = 6000; // gravità decisa: arco basso e secco (vecchio 4732)
export const JUMP_VELOCITY = -1250; // salto più basso (apice ~2.0 tile) (vecchio -1300)
export const MAX_FALL_SPEED = 2400; // discesa più nitida con G alta (non cambia l'apice)

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
// Razzo di default (fallback): ogni player ha la propria skin del razzo in PLAYERS
// (campo `ship`); questa è usata solo finché setShipSkin non l'ha impostata.
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

// Rotazione stile GD (gestita in Player): il cubo ruota di 180° per SALTO e di
// 90° quando "cade da un gradino"; all'atterraggio fa snap al 90° più vicino
// (riposa a 0/90/180/270°). Velocità tarata perché il mezzo giro (180°) si chiuda
// nella durata d'aria del salto CORTO (~0.40s): π / 0.40 ≈ 7.85 rad/s. _updateRotation
// si ferma al target (non gira a vuoto), quindi una caduta da gradino chiude 90°.
export const ROTATION_SPEED = Math.PI * 2.5; // ≈7.85 rad/s: 180° entro la durata d'aria (più rapida)

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
export const PAD_VELOCITY = -2200; // apice pad ~6.4 tile (compensa la G più alta), > |JUMP_VELOCITY|

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
export const TRAIL_CUBE_COLOR = '#ff3b3b'; // scia rossa in modalità cubo (Artie/default)
export const TRAIL_RED_GLOW = '#ff2a2a'; // glow della striscia rossa del razzo (Artie/default)
export const TRAIL_CUBE_COLOR_MILES = '#ff8a1e'; // scia arancione (Miles) — vedi PLAYERS.fx
export const TRAIL_ORANGE_GLOW = '#ff6a00'; // glow arancione del razzo (Miles) — vedi PLAYERS.fx
export const TRAIL_STAR_COLOR = '#ffd23f'; // particellare giallo del razzo (stelle o note)
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
export const MUSIC_VOLUME = 0.5; // volume musica di default (0..1)
export const SFX_VOLUME = 0.5; // volume effetti sonori di default (0..1)
// Brani di sottofondo (loop), uno per contesto. Se un file manca → fallback al
// beat sintetizzato. 'home' suona nei menu, 'game' durante un livello.
export const MUSIC_TRACKS = { home: '/home.m4a', game: '/game.mp3' };
// SFX da file (one-shot), instradati sul gain `sfx` come gli effetti sintetizzati
// (quindi rispettano volume SFX + mute). Chiave logica → percorso in public/.
// I "tag" dei player suonano alla selezione nella schermata Player.
// NB: i file usano l'estensione MAIUSCOLA .MP3 (il CDN di produzione è case-sensitive).
export const SFX_FILES = {
  'tag-artie': '/tag-artie.MP3',
  'tag-miles': '/tag-miles.MP3',
  'death-artie': '/death-artie.MP3', // suono di morte (sostituisce il tono sintetizzato)
  loader: '/tag-tutto-fatto.MP3', // jingle del fake loader (prehome → home)
};

// Barra di avanzamento (stile GD: pillola gialla con bordo bianco).
export const PROGRESS_BAR_COLOR = '#ffd23f';
export const PROGRESS_BG_COLOR = 'rgba(0,0,0,0.35)';

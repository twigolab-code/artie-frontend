# CLAUDE.md — GeoRush

Context for working on **GeoRush**, a Geometry Dash–style clone. This file is the onboarding
doc: read it first so you don't have to re-explore the codebase. Code comments and domain terms
(level names, `Facile`/`Medio`/`Difficile`) are in Italian; this guide is in English.

> **Keep this file updated.** Whenever a change touches levels, tile codes, physics constants,
> the `config.js`/`LEVELS` structure, or the module layout, update the matching section here in
> the same change. See the maintenance checklist at the bottom.

## 1. Overview
- **Stack:** Vite 6 + HTML5 Canvas 2D + vanilla ES modules. No framework, no TypeScript.
- `package.json`: `name: georush`, `"type": "module"`, only dev dep is `vite ^6.0.0`.
- Single full-screen canvas `#game`. All gameplay/UI is drawn in a fixed **logical resolution
  1280×720**, letterboxed to fit the screen (DPR-aware) by `Renderer`.

## 2. Run / build
- `npm run dev` — Vite dev server (default port 5173).
- `npm run build` — production build to `dist/`.
- `npm run preview` — serve the built `dist/`.
- Entry chain: `index.html` → `src/main.js`. Static assets (player skins, logo, backgrounds,
  coin, palm) live in `public/` and are referenced by absolute path. Images are **WebP**
  (e.g. `/artie-cube.webp`), the menu track is **AAC** (`/home.m4a`), the in-level track stays
  `/game.mp3`, the UI font is `/SoccerLeague.ttf`. `scripts/optimize-assets.sh` regenerates the
  optimized assets (uses `cwebp` + macOS `afconvert`); run it if you add/replace an asset.
  `vite.config.js` uses `base: './'` (relative paths). The vector fallback in `Assets.js` covers a
  missing/unsupported image.
- No test harness. Verify level changes by a static grid walk + playing via `npm run dev`.
- **Deploy:** hosted on **Cloudflare Pages** via the **Git integration** (dashboard-driven, not
  GitHub Actions): Pages clones the repo on push to `main` and runs the build itself. Settings →
  Builds: build command `npm run build`, output dir `dist`, root `/`; Node pinned to **20** via
  `.nvmrc`. 100% static → CDN absorbs any traffic spike; no backend, all state is `localStorage`.
  `public/_headers` sets edge cache (`/assets/*` immutable, HTML `no-cache`) + security headers
  (a strict same-origin CSP — everything is local, so `default-src 'self'` with `'unsafe-inline'`
  only for the inline `<style>` in index.html — plus Permissions-Policy / COOP / CORP). If you add
  an external origin (CDN/font/analytics), widen the CSP accordingly or the game will break.
  (No `.github/workflows/` — the Actions workflow was removed to avoid clashing with Pages' own
  build; if "unable to submit build job" appears, it's a Cloudflare-side build incident, check
  cloudflarestatus.com and retry.)

## 3. Architecture / directory map
```
src/
  main.js              Entry point: wiring, game-state machine, all UI screens, localStorage persistence, MAPS registry
  config.js            ALL constants: physics, dimensions, colors/themes, LEVELS array, PLAYERS array, tile codes
  engine/
    Renderer.js        Canvas2D wrapper; DPR resize + letterbox; logical-coord drawing (begin(), rect(), ctx, extLeft/Top/Right/Bottom)
    GameLoop.js        Fixed-timestep 60Hz loop (accumulator + interpolation alpha)
    Input.js           Keyboard/mouse/touch → jump; held (continuous) + consumePress() (edge, used by orbs)
    Audio.js           Music: two looped tracks from `MUSIC_TRACKS` (public/ `home.m4a`/`game.mp3`, routed via `music` gain); `setTrack('home'|'game', {restart})` switches them (menus=home, playing=game; game restarts each attempt); `stopMusic()` pauses all tracks immediately (used on death). Falls back to a synth beat (BPM 128) if files are missing. Beat clock always runs for `beatPhase()` (visual pulse). SFX: coin is synth (`_tone`); **file-based one-shots** via `playSfxFile(key)` → bool (fetch→`decodeAudioData`→`AudioBufferSource`, buffers from `SFX_FILES` preloaded in `unlock()`) — the player-select "tag" sounds (`tag-artie`/`tag-miles`), the **death** sound (`death-artie`, `playDeath` falls back to the synth `_tone` if the buffer isn't decoded yet), and the **loader** jingle (`loader` = `tag-tutto-fatto.MP3`). `playSfxOnce(key, onEnded)` is the same pipeline but returns the buffer's `duration` and fires `onEnded` at the end (used by the fake loader to size/finish itself). Both routed via `sfx` gain (respect SFX volume + mute). Music can be silenced per-screen via `setMusicSilenced(bool)` — a `_musicScreenMul` (0/1) multiplied into the `music` gain (single writer `_applyMusicGain()`) WITHOUT touching the persisted `_musicVol`; `main.js` drives it from `gameState` (muted on `players` so the tags stand out). Persistent volume/mute
    Assets.js          Async image cache w/ vector fallback; getSkin(), LOGO_IMG/BG2_IMG/COIN_IMG/PALM_IMG/OPTIONS_IMG/STATS_IMG (all WebP), `getLevelBg(name)` (cached lazy loader for the heavy level bg WebPs `LA`/`metro`/`wash`/`boulevard`, not loaded on home), fontState (local `SoccerLeague` font via @font-face in index.html)
  game/
    Player.js          Cube & Ship entity: gravity, jump, mode switch, collision resolution, rotation, render
    Level.js           Parses the tile grid → entity arrays (obstacles/portals/orbs/pads/coins); culled render()
    Camera.js          Constant horizontal scroll; player pinned at PLAYER_X
    Collision.js       aabbOverlap(a,b), overlapDepth(a,b) → {dx,dy} (used for side/landing classification)
    Obstacle.js        Block + spike variants (full/small/down/floor); solid/deadly flags; getHitbox()
    Portal.js          Cube↔Ship gate (animated); triggers PortalFx
    Orb.js             Yellow ring; mid-air jump trigger (handled in main.js handleOrbs)
    Pad.js             Yellow pad; auto-launch (cube only); handled in main.js handlePads
    Coin.js            Spinning collectible (max 5/level); handled in main.js handleCoins
  effects/
    Particles.js       Death burst (26 shards w/ gravity)
    Trail.js           Player trail (cube red squares / ship luminous streak)
    StarTrail.js       Ship thruster stars (deterministic jitter, no Math.random)
    RocketField.js     Rocket-mode background ambiance: drifting stars + warp speed lines (deterministic, no Math.random; intensity scaled by themeT, draws nothing in cube mode). Rendered behind gameplay in main.js
    PortalFx.js        Portal transit VFX: white flash + expanding wave + sparks
    Background.js      Generic neon parallax grid (3 layers, beat pulse, theme lerp)
    CityBackground.js  Red skyline (procedural buildings, 3 tiers, clouds)
    LaBackground.js    Sunset beach (sun, palms, houses, ferris wheel, pier, lamp)
    ImageBackground.js Image-tiled background (sky-only, horizontal loop, slow parallax; scales any image to sky height so differently-sized sources sync visually). One instance per image bg, built lazily in `getBg()` via `getLevelBg()`
  data/
    _grid.js           Helpers: ROWS=12, gap(w), assemble(...segments)
    skyline.js         City (mapKey 'skyline')
    skyline2.js        Los Angeles (mapKey 'skyline2') — copy of skyline
    metro2.js          Metro (mapKey 'metro2') — copy of skyline (to be modified)
    carwash.js         Car Wash (mapKey 'carwash') — copy of skyline (to be modified)
    boulevard.js       Boulevard (mapKey 'boulevard') — copy of skyline (to be modified)
```

## 4. Core loop & state machine
- Fixed timestep: `FIXED_DT = 1/60`, `MAX_FRAME_TIME = 0.25` (caps recovery after a freeze).
- Game states (in `main.js`): `prehome` · `loader` · `home` · `players` · `levels` · `playing` · `complete` · `options` · `stats`.
- **Pre-home (onboarding):** initial state. Shows the logo + a card with a **required** nickname
  field and a `GIOCA` button. **No music plays here** (`Audio._currentTrack` starts `null`, so the
  unlock-on-first-gesture loads files but plays nothing). The nickname uses a real `<input>` overlaid
  on the canvas (`positionNickInput()` mirrors `toLogical`'s letterbox math; shown only on `prehome`,
  hidden elsewhere in `render`). `GIOCA` is greyed/disabled until the nickname is non-empty; clicking
  it (or Enter) runs `goHome()` → hides the input, plays the `loader` jingle and switches to `loader`
  (NOT straight to `home`; music starts later in `enterHome()`). Persisted in `localStorage`
  `gd_nickname` (`getNickname`/`saveNickname`).
- **Loader (fake loader):** transient state between `prehome` and `home`. `goHome()` calls
  `audio.playSfxOnce('loader', …)` (the `tag-tutto-fatto.MP3` jingle) and enters `loader`;
  `drawLoader()` shows a circular neon progress ring (`UI.yellow`) with the player cube spinning at
  its center, a `%` and **"Mi chiamano \<nickname\>..."**. The ring fills over `loaderDur` (the
  jingle's real `buffer.duration`); `update(dt)` exits to `home` via `enterHome()` when the sound's
  `onended` fires (`loaderDone`) **or** the timer passes `loaderDur` (fallback `LOADER_FALLBACK` ≈
  1.6s when the buffer isn't ready / audio is muted/absent — so it never blocks).
- The world scrolls left; the player is pinned on screen at `PLAYER_X = 220`, so
  `playerWorldX = camera.x + PLAYER_X`. Level ends when the player reaches the finish X.
- Per-frame handlers in `update(dt)`: `handleOrbs` (touch + `consumePress` → jump),
  `handlePortals` (mode switch + theme lerp + PortalFx), `handlePads` (auto-jump), `handleCoins`
  (collect). On death: `audio.stopMusic()` (background music cuts immediately so only the death SFX
  is heard) + play SFX once, spawn particles, ~0.7s timer, then restart (which re-plays `game` from
  the top via `setTrack('game', {restart:true})`).
- **Pause:** `let isPaused` flag (reset in `restart()`). During `playing`, `Esc`/`P` or the round
  pause button (top-right, drawn by `drawPauseButton`) toggle it; `update(dt)` early-returns while
  paused so the world freezes but `render()` keeps drawing. Paused overlay (`drawPauseOverlay`) has
  RIPRENDI / RICOMINCIA / ESCI (`pauseOverlayRects`). On any pause click/resume, `input.consumePress()`
  discards the edge so it isn't read as a jump.
- **Touch / mobile input:** the single canvas UI hit-test handler listens on **`pointerdown`** (NOT
  `mousedown`) so menus/buttons are tappable on mobile and the desktop mouse still works — one tap =
  one handler run (no synthetic post-touch `mousedown` double-fire). In-game **jump** is separate:
  `Input.js` maps keyboard/mouse/`touchstart` → jump on `window`. During `playing` the UI handler
  only acts on the pause button, so a tap elsewhere falls through to `Input.js` (one jump, no
  conflict). The pause button's tap tolerance is `+16` logical px (≈44px CSS) in `pointInPauseBtn`;
  the drawn ring is unchanged.
- **Force landscape (portrait block):** on touch devices held in portrait the game freezes and a
  DOM overlay `#rotate` (in `index.html`, styled in the inline `<style>` with the UI palette +
  `SoccerLeague` font + a CSS-animated phone glyph — no asset, CSP-safe) covers everything incl. the
  nickname `<input>`. Detected via `matchMedia('(orientation: portrait)')` gated by
  `'(pointer: coarse)'` (so a narrow desktop window is NOT blocked). `let orientationBlocked` (set by
  `onOrientationChange`, wired to both media queries' `change` + called once at startup) makes
  `update(dt)` **early-return before `audio.update()`** (world + beat frozen; player can't die behind
  the overlay) while `render()` keeps drawing. Entering portrait mid-`playing` sets `isPaused=true`
  so rotating back lands on the pause overlay, not a death. `drawPreHome()` early-returns (and hides
  the input) while blocked. The viewport meta uses `viewport-fit=cover`.
- **Back navigation:** a shared "indietro" arrow (`backArrowRect()` + `arrow(rect,-1)`, top-left) is
  drawn and hit-tested on `players`/`levels`/`options`/`stats` → returns to `home`. On `levels`/`players`
  the arrow is checked first (priority over "click = play"/select).
- **Persistence (localStorage):** `gd_audio` (music/sfx/muted), `gd_bestCoins` (per-level coin
  record), `gd_levelStats` (per-level bestPct/attempts/jumps), `gd_nickname` (player nickname).
- **Backgrounds registry:** procedural `BACKGROUNDS = { neon, city, la }` + image backgrounds built
  lazily in `getBg(key)` from `IMG_BG = { losangeles:'LA', metro:'metro', carwash:'wash',
  boulevard:'boulevard' }` (each an `ImageBackground` tiling its WebP in a slow horizontal loop,
  sky-only). So `bg` accepts `'neon' | 'city' | 'la' | 'losangeles' | 'metro' | 'carwash' |
  'boulevard'`. **floor** dispatch in `drawFloor` → `la`/`city`/`metro`/`carwash`/`boulevard`/else
  neon. `floor` accepts `'neon' | 'city' | 'la' | 'metro' | 'carwash' | 'boulevard'`. Styles:
  city & carwash=brick texture (shared `drawBrickFloor`; city=red bricks + light edge, carwash=dark
  asphalt bricks + red-neon glow edge via `neonTop`) · la & boulevard=plank walkway (shared
  `drawPlankFloor`, purple vs blue) · metro=light-purple platform with wide tiles.
- **Rocket-mode ambiance (driven by `themeT`, 0=cube→1=ship):** when the ship is active the floor
  colors lerp toward `ROCKET_FLOOR_COLOR`/`ROCKET_FLOOR_LINE` (via `rocketFloor()` in `drawFloorCity`),
  a `RocketField` (stars + warp speed lines) draws behind the gameplay, and `drawRocketAmbiance()`
  lays a faint `ROCKET_TINT` tint + radial vignette over it. All fade in/out smoothly with `themeT`
  and cost nothing in cube mode.
- **Music follows state:** `prehome` and `loader` are **silent** for music (`Audio._currentTrack`
  starts `null`; the loader only plays its one-shot jingle). The first music starts when
  `enterHome()` (end of the loader) calls `audio.setTrack('home')`. Thereafter menus
  (`home`/`players`/`levels`/`options`/`stats`) play the `home` track; entering a level (`restart()`)
  plays `game` (restarted each attempt); leaving `complete` back to `levels` returns to `home` (see
  `audio.setTrack` calls in `main.js`).

## 5. Physics constants (from `config.js` — quote, don't guess)
Velocities are scaled ×1.30 and gravity ×1.69 vs. an earlier "slow" baseline (the +30% speed feel).
- **Cube:** `GRAVITY = 4732`, `JUMP_VELOCITY = -1300`, `MAX_FALL_SPEED = 2080`,
  `ROTATION_SPEED = Math.PI * 2.8 * 1.3` (one full spin per jump arc), `PLAYER_SIZE = 60`.
- **Ship (jetpack):** `SHIP_GRAVITY = GRAVITY * 0.42`, `SHIP_THRUST = GRAVITY * 0.95`,
  `SHIP_MAX_RISE = -832`, `SHIP_MAX_FALL = 988`, `SHIP_MAX_TILT = 0.5`, `SHIP_TILT_LERP = 0.18`.
  **Top of screen (y ≤ 0) is instant death**; the floor is a safe landing.
- **Items:** `PAD_VELOCITY = -1950` (stronger than a jump, cube only), `ORB_RADIUS = 26`,
  `COINS_PER_LEVEL = 5`.
- **Layout:** `TILE = 60`, `GRID_SIZE = 60`, `FLOOR_HEIGHT = TILE*2 = 120`, `FLOOR_Y = 600`,
  `PLAYER_X = 220`, `LOGICAL_WIDTH = 1280`, `LOGICAL_HEIGHT = 720`.
- **Per-level scroll speed** lives on each `LEVELS` entry (`scrollSpeed`), overriding the default
  `SCROLL_SPEED = 468`. All current levels use **630** (was 585; +8%). It's the only pace control:
  `camera.setSpeed(lvl().scrollSpeed)` → `Camera.update` adds `speed*dt` to the world X.
- **Per-level obstacle color** (`obstacleBottom` on each `LEVELS` entry): the bottom color of the
  spike/block vertical gradient (top stays near-black `OBSTACLE_FILL_TOP`). Threaded
  `main.js render` → `level.render(…, fillBottom)` → `obstacle.render` (`_renderBlock`/`_renderSpike`,
  default `OBSTACLE_FILL_BOTTOM` if absent); the same color also feeds the cube's **vector fallback**
  in `Player._renderCube` (the PNG skin is unaffected). `_renderSpikeFloor` keeps its black/ice look.
- **Audio:** `BPM = 128`, `MUSIC_VOLUME`/`SFX_VOLUME` defaults, and
  `MUSIC_TRACKS = { home: '/home.m4a', game: '/game.mp3' }` — the looped background tracks (drop the
  files in `public/`; menus play `home`, levels play `game` via `audio.setTrack`; if absent, the
  synth beat plays instead). `SFX_FILES = { 'tag-artie', 'tag-miles', 'death-artie', loader }`
  (→ `*.MP3`; `loader` = `tag-tutto-fatto.MP3`) — file-based one-shot SFX (player-select tags, the
  death sound, the fake-loader jingle), preloaded in `Audio.unlock()` and played via
  `audio.playSfxFile(key)` / `playSfxOnce(key, onEnded)` (no-op until decoded). **Note the uppercase
  `.MP3`** —
  the prod CDN is case-sensitive, so `SFX_FILES` paths must match the real filenames in `public/`.
  Music is **silenced on the `players` screen** so the tags are clearly audible: `main.js`'s
  `update()` calls `audio.setMusicSilenced(gameState === 'players')` each frame (state-driven, so
  every enter/exit path is covered and the volume restores automatically). It uses a separate
  `_musicScreenMul` (0/1) factor — the saved `_musicVol` is never modified.

⚠️ Don't touch the engine/physics/rendering when only building level data.

## 6. Level data system (`src/data/`)
`_grid.js` exports `ROWS = 12`, `gap(w)` (an empty `w`-wide segment), and
`assemble(...segments)` (concatenate segments horizontally, column-by-column).

- A **segment** = an array of exactly **12 strings** (one per row), all the **same width**.
- **Row 0 = top (ceiling)**, **row 9 = GROUND**, rows 10–11 = floor render only.
  Heights above ground: row 8 = +1, row 7 = +2, row 6 = +3.
- A level file: `import { gap, assemble } from './_grid.js';` → define named camelCase segments →
  `const map = assemble(start, segA, gap(5), segB, ...);` → `export const <name> = map;`

### Tile codes (defined in `config.js`, `TILE_*`)
| Code | Meaning |
|------|---------|
| `0` | empty (sky) |
| `1` | block — land on **TOP only**; sides & underside are lethal |
| `2` | spike (full tile) |
| `6` | small spike (half height) |
| `7` | inverted/ceiling spike (hangs from top, points down) |
| `s` | spiked floor (`TILE_SPIKE_FLOOR`) — deadly carpet; place between blocks to hop over |
| `3` | portal cube→ship (magenta) |
| `4` | portal ship→cube (green) |
| `5` | orb — touch + press for a mid-air jump (yellow ring) |
| `8` | pad — ground-only, cube-only, big auto-bounce |
| `9` | coin — collectible, **max 5 per level**, always optional |

## 7. Level design rules (geometry verified at speed 585; levels now run at 630)
The jump/range numbers below were simulator-verified at **585**; all levels now use
`scrollSpeed: 630` (+8% feel). The arcs are unchanged (physics isn't tied to scroll speed),
so the 585-verified rules remain the design baseline — just slightly tighter timing at 630.
From the simulator-verified headers in `level2.js` / `skyline.js`:
- Cube jump apex **~2.8 tiles**, horizontal range **~5.2 tiles**.
- Orb = a fresh mid-air jump; **place orbs at row 7** (touchable on the rising arc).
- Pad apex **~6.4 tiles**, range **~8** (for tall platforms).
- **Max 4 contiguous ground hazards** (`2`/`6`/`s` combined) per single jump; for 5+, break with a
  block to stand on, a mid-air orb, or a pad.
- Every horizontal gap the cube must clear **≤ 5 tiles**; the landing is always a `1`-top or
  ground — **never a hazard**.
- Climb **≤ 2 tiles** above current footing (≤ 3 only with an orb in the ascent; taller needs a pad).
- Towers must be scalable (approached so the player lands on top — never into a lethal side).
- Ship sections open with `3`, close with `4`; keep a continuous open corridor between floor (`2`)
  and ceiling (`7`) spikes (ceiling is lethal — never force the player into it). No pad inside a ship section.
- Safe buffer (~1 tile) right after every portal, pad launch, and orb-clear landing.
- Coins are always optional and reachable within jump/orb/pad limits.
- **Verticality** (used in `skyline`): air blocks/platforms at row 8 (+1) and row 7 (+2) are
  jump-reachable from the ground or from another block top, provided the vertical step ≤2 tiles
  and the horizontal center-to-center gap ≤5. Build air "stairs" (+1 then +2) and flat air runs to hop across.
- **Short spiked floor** (used in `skyline`): prefer **1-cell `s`** placed frequently between blocks
  / under platform gaps (block→over-`s`→block) rather than one long `ssss` strip. Each `s` cell still
  counts toward the ≤3 (skyline) / ≤4 (default) contiguous-hazard limit.

## 8. How to add a new level
1. **Data file** `src/data/<name>.js`:
   ```js
   import { gap, assemble } from './_grid.js';
   const start = gap(8);
   const segA = [ /* 12 equal-width strings */ ];
   const map = assemble(start, segA, gap(5), /* ... */);
   export const <name> = map;
   ```
2. **`src/main.js`** — add the import near the other level imports and register it in `MAPS`:
   ```js
   import { <name> } from './data/<name>.js';
   const MAPS = { level2, la, metro, skyline, <name> };
   ```
3. **`src/config.js`** — add an entry to the `LEVELS` array:
   ```js
   {
     id: '<name>', name: '<Display>', diff: 'Medio',   // Facile | Medio | Difficile
     bg: 'losangeles', floor: 'city',                  // 'neon' | 'city' | 'la' | 'losangeles'
     cube: LA_CUBE, ship: LA_SHIP,                     // a {top,bottom} theme pair from config
     obstacleBottom: '#8a3a12',                        // bottom of the spike/block gradient (top stays near-black); coherent w/ bg
     scrollSpeed: 630, mapKey: '<name>', diffFrac: 0.55,
     // comingSoon: true,   // OMIT to make the level selectable/playable
   }
   ```
   `mapKey` must match both the `data/` export and the `MAPS` key.

## 9. Current content
All 5 levels are playable, `diff: 'Medio'`, `scrollSpeed: 630`, themes `LA_CUBE/LA_SHIP`. Each level
sets a per-level `obstacleBottom` (bottom color of the spike/block gradient, coherent with its bg;
the top stays near-black `OBSTACLE_FILL_TOP`). Carousel order: City · Car Wash · Los Angeles ·
Boulevard · Metro. Levels other than City/LA are **placeholder copies of the `skyline` map**
(to be differentiated later).

| # | id | name | mapKey | bg | floor | notes |
|---|----|------|--------|----|----|-------|
| 1 | city | City | `skyline` | `city` | `city` | longer, vertical, **max 3 contiguous hazards** (stricter than the global ≤4) |
| 2 | losangeles | Los Angeles | `skyline2` | `losangeles` (LA.webp) | `la` | copy of `skyline`; image bg looped, sky-only |
| 3 | metro | Metro | `metro2` | `metro` (metro.webp) | `metro` | copy of `skyline` (to be modified) |
| 4 | carwash | Car Wash | `carwash` | `carwash` (wash.webp) | `carwash` | copy of `skyline` (to be modified) |
| 5 | boulevard | Boulevard | `boulevard` | `boulevard` (boulevard.webp) | `boulevard` | copy of `skyline` (to be modified) |

- **Players (skins only, identical physics):** `Artie` (`/artie-cube.png`), `Miles` (`/miles-cubo.png`).
- **Themes:** neon (`THEME_CUBE/SHIP`), city (`CITY_CUBE/SHIP`), LA (`LA_CUBE/SHIP`), metro (`METRO_CUBE/SHIP`).
  `CITY_*`/`METRO_*` are currently unused by `LEVELS` (kept for reference).

## 10. Conventions & gotchas
- Comments and on-screen text are Italian; keep that style when editing existing files.
- Draw only in logical coords through `Renderer` / its `ctx`; never assume raw pixel sizes.
- StarTrail/effects avoid `Math.random()` (deterministic hashing) — keep new effects deterministic if they need to be reproducible.
- **UI hit-testing uses `pointerdown`, not `mousedown`** (mobile-tappable). Don't add a second
  `mousedown`/`click` UI listener on the canvas or taps will double-fire; don't add `preventDefault`
  in that handler (it'd fight the nickname `<input>` focus — `Input.js` already prevents default on
  `touchstart` for the jump). In-game jump lives in `Input.js`, separate from the UI handler.
- No automated tests: validate gameplay by a static grid walk against §7, then `npm run dev` (test
  mobile via DevTools device emulation: portrait shows the `#rotate` overlay + freezes; landscape
  menus are tappable).

## 11. Maintenance checklist (update THIS file when…)
- **New/changed level** → update the table in §9 (and §8 if the wiring steps change).
- **New/changed tile code** → update the legend in §6.
- **Physics/layout constant changes** in `config.js` → update §5 (and §7 if jump/range/pad math shifts).
- **New engine/game/effect module** → add a line to the directory map in §3.
- **New game state, persistence key, or background/floor option** → update §4.

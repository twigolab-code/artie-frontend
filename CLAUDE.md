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
- **Deploy/CI:** hosted on **Cloudflare Pages** (100% static → CDN absorbs any traffic spike; no
  backend, all state is `localStorage`). `public/_headers` sets edge cache (`/assets/*` immutable,
  HTML `no-cache`) + security headers. `.github/workflows/deploy.yml` builds and deploys on push to
  `main` (preview on PR); needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets and a
  Pages project named `georush`.

## 3. Architecture / directory map
```
src/
  main.js              Entry point: wiring, game-state machine, all UI screens, localStorage persistence, MAPS registry
  config.js            ALL constants: physics, dimensions, colors/themes, LEVELS array, PLAYERS array, tile codes
  engine/
    Renderer.js        Canvas2D wrapper; DPR resize + letterbox; logical-coord drawing (begin(), rect(), ctx, extLeft/Top/Right/Bottom)
    GameLoop.js        Fixed-timestep 60Hz loop (accumulator + interpolation alpha)
    Input.js           Keyboard/mouse/touch → jump; held (continuous) + consumePress() (edge, used by orbs)
    Audio.js           Music: two looped tracks from `MUSIC_TRACKS` (public/ `home.m4a`/`game.mp3`, routed via `music` gain); `setTrack('home'|'game', {restart})` switches them (menus=home, playing=game; game restarts each attempt). Falls back to a synth beat (BPM 128) if files are missing. Beat clock always runs for `beatPhase()` (visual pulse). SFX (coin/death only) are synth. Persistent volume/mute
    Assets.js          Async image cache w/ vector fallback; getSkin(), LOGO_IMG/BG2_IMG/COIN_IMG/PALM_IMG/OPTIONS_IMG/STATS_IMG (all WebP), `getLaBgImg()` (lazy loader for the heavy `bg-los-angeles.webp`, not loaded on home), fontState (local `SoccerLeague` font via @font-face in index.html)
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
    PortalFx.js        Portal transit VFX: white flash + expanding wave + sparks
    Background.js      Generic neon parallax grid (3 layers, beat pulse, theme lerp)
    CityBackground.js  Red skyline (procedural buildings, 3 tiers, clouds)
    LaBackground.js    Sunset beach (sun, palms, houses, ferris wheel, pier, lamp)
    ImageBackground.js Image-tiled background (sky-only, horizontal loop, slow parallax); used by skyline2 with `BG_LA_IMG`
  data/
    _grid.js           Helpers: ROWS=12, gap(w), assemble(...segments)
    level1.js          Tutorial — NOT registered in LEVELS (orphan reference)
    level2.js          Città (mapKey 'level2')
    la.js              Los Angeles (mapKey 'la')
    metro.js           Metro (mapKey 'metro')
    skyline.js         Skyline (mapKey 'skyline')
```

## 4. Core loop & state machine
- Fixed timestep: `FIXED_DT = 1/60`, `MAX_FRAME_TIME = 0.25` (caps recovery after a freeze).
- Game states (in `main.js`): `home` · `players` · `levels` · `playing` · `complete` · `options` · `stats`.
- The world scrolls left; the player is pinned on screen at `PLAYER_X = 220`, so
  `playerWorldX = camera.x + PLAYER_X`. Level ends when the player reaches the finish X.
- Per-frame handlers in `update(dt)`: `handleOrbs` (touch + `consumePress` → jump),
  `handlePortals` (mode switch + theme lerp + PortalFx), `handlePads` (auto-jump), `handleCoins`
  (collect). On death: play SFX once, spawn particles, ~0.7s timer, then restart.
- **Persistence (localStorage):** `gd_audio` (music/sfx/muted), `gd_bestCoins` (per-level coin
  record), `gd_levelStats` (per-level bestPct/attempts/jumps).
- **Backgrounds registry:** `BACKGROUNDS = { neon, city, la, losangeles }` (`losangeles` = an
  `ImageBackground` tiling `BG_LA_IMG` in a slow horizontal loop, sky-only); **floor** dispatch in
  `drawFloor` → `la` / `city` / else neon. So `bg` accepts `'neon' | 'city' | 'la' | 'losangeles'`
  and `floor` accepts `'neon' | 'city' | 'la'`.
- **Music follows state:** menus (`home`/`players`/`levels`/`options`/`stats`) play the `home`
  track; entering a level (`restart()`) plays `game` (restarted each attempt); leaving `complete`
  back to `levels` returns to `home` (see `audio.setTrack` calls in `main.js`).

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
  `SCROLL_SPEED = 468`.
- **Audio:** `BPM = 128`, `MUSIC_VOLUME`/`SFX_VOLUME` defaults, and
  `MUSIC_TRACKS = { home: '/home.m4a', game: '/game.mp3' }` — the looped background tracks (drop the
  files in `public/`; menus play `home`, levels play `game` via `audio.setTrack`; if absent, the
  synth beat plays instead).

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

## 7. Level design rules (target speed 585 — verified geometry)
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
     bg: 'city', floor: 'city',                        // 'neon' | 'city' | 'la'
     cube: CITY_CUBE, ship: CITY_SHIP,                 // a {top,bottom} theme pair from config
     scrollSpeed: 585, mapKey: '<name>', diffFrac: 0.55,
     // comingSoon: true,   // OMIT to make the level selectable/playable
   }
   ```
   `mapKey` must match both the `data/` export and the `MAPS` key.

## 9. Current content
| id | name | mapKey | speed | diff | notes |
|----|------|--------|-------|------|-------|
| city | Città | `level2` | 585 | Facile | playable |
| la | Los Angeles | `la` | 480 | Medio | `comingSoon: true` (locked) |
| metro | Metro | `metro` | 560 | Difficile | `comingSoon: true` (locked); `bg/floor: 'city'` placeholder |
| skyline | Skyline | `skyline` | 585 | Medio | playable; longer, vertical, **max 3 contiguous hazards** (stricter than the global ≤4) |
| skyline2 | Skyline 2 | `skyline2` | 585 | Medio | playable; same map as `skyline` but `bg: 'losangeles'` (image bg `bg-los-angeles.png` looped, sky-only); `floor: 'city'` |

- `level1.js` is an older tutorial map and is **not** wired into `LEVELS`/`MAPS`.
- **Players (skins only, identical physics):** `Artie` (`/artie-cube.png`), `Miles` (`/miles-cubo.png`).
- **Themes:** neon (`THEME_CUBE/SHIP`), city (`CITY_CUBE/SHIP`), LA (`LA_CUBE/SHIP`), metro (`METRO_CUBE/SHIP`).

## 10. Conventions & gotchas
- Comments and on-screen text are Italian; keep that style when editing existing files.
- Draw only in logical coords through `Renderer` / its `ctx`; never assume raw pixel sizes.
- StarTrail/effects avoid `Math.random()` (deterministic hashing) — keep new effects deterministic if they need to be reproducible.
- No automated tests: validate gameplay by a static grid walk against §7, then `npm run dev`.

## 11. Maintenance checklist (update THIS file when…)
- **New/changed level** → update the table in §9 (and §8 if the wiring steps change).
- **New/changed tile code** → update the legend in §6.
- **Physics/layout constant changes** in `config.js` → update §5 (and §7 if jump/range/pad math shifts).
- **New engine/game/effect module** → add a line to the directory map in §3.
- **New game state, persistence key, or background/floor option** → update §4.

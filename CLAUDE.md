# CLAUDE.md — OG DASH

Context for working on **OG DASH — Swag Music Edition** (repo/codename "georush"), a Geometry
Dash–style clone. This file is the onboarding doc: read it first so you don't have to re-explore
the codebase. Code comments and domain terms (level names, `Facile`/`Medio`/`Difficile`) are in
Italian; this guide is in English.

> **Keep this file updated.** Whenever a change touches levels, tile codes, physics constants,
> the `config.js`/`LEVELS` structure, or the module layout, update the matching section here in
> the same change. See the maintenance checklist at the bottom.

## 1. Overview
- **Stack:** Vite 6 + HTML5 Canvas 2D + vanilla ES modules. No framework, no TypeScript.
- `package.json`: `name: og-dash`, `"type": "module"`, only dev dep is `vite ^6.0.0`.
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
  optimized assets (uses `cwebp` + macOS `afconvert`; also produces the **PWA icons** —
  `apple-touch-icon.png` 180, `icon-192/512.png`, `icon-maskable-512.png` — from `artie-cube.webp`
  via `dwebp`+`sips`); run it if you add/replace an asset.
  `vite.config.js` uses `base: './'` (relative paths). The vector fallback in `Assets.js` covers a
  missing/unsupported image.
- **PWA / "Add to Home" (mobile fullscreen):** iOS Safari has **no in-tab Fullscreen API**, so the
  only true no-address-bar fullscreen on iPhone is installing the site from the Home screen. The app
  is installable: `public/manifest.webmanifest` (`display: fullscreen`, `orientation: landscape`,
  icons, `theme_color #1a1a2e`) + Apple meta tags in `index.html` head
  (`apple-mobile-web-app-capable=yes`, `…-status-bar-style=black-translucent`, `apple-touch-icon`).
  All same-origin → the existing CSP already allows it (no `manifest-src`/`img-src` change). See the
  install-hint banner in §4. (Icons regenerate via `scripts/optimize-assets.sh`.)
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
    Renderer.js        Canvas2D wrapper; DPR resize + letterbox; logical-coord drawing (begin(), rect(), ctx, extLeft/Top/Right/Bottom). Also exposes safe-area insets in LOGICAL coords (safeLeft/Right/Top/Bottom = ext* inset by `env(safe-area-inset-*)`, read via a hidden probe div) for notch-safe HUD placement
    GameLoop.js        Fixed-timestep 60Hz loop (accumulator + interpolation alpha)
    Input.js           Keyboard/mouse/touch → jump; held (continuous) + consumePress() (edge, used by orbs)
    Audio.js           Music: two looped tracks from `MUSIC_TRACKS` (public/ `home.m4a`/`game.mp3`, routed via `music` gain); `setTrack('home'|'game', {restart})` switches them (menus=home, playing=game; game restarts each attempt); `stopMusic()` pauses all tracks immediately (used on death). Falls back to a synth beat (BPM 128) if files are missing. Beat clock always runs for `beatPhase()` (visual pulse). SFX: coin is synth (`_tone`); **file-based one-shots** via `playSfxFile(key)` → bool (fetch→`decodeAudioData`→`AudioBufferSource`, buffers from `SFX_FILES` preloaded in `unlock()`) — the player-select "tag" sounds (`tag-artie`/`tag-miles`), the **death** sound (`death-artie`, `playDeath` falls back to the synth `_tone` if the buffer isn't decoded yet), and the **loader** jingle (`loader` = `tag-tutto-fatto.MP3`). `playSfxOnce(key, onEnded)` is the same pipeline but returns the buffer's `duration` and fires `onEnded` at the end (used by the fake loader to size/finish itself). Both routed via `sfx` gain (respect SFX volume + mute). Music can be silenced per-screen via `setMusicSilenced(bool)` — a `_musicScreenMul` (0/1) multiplied into the `music` gain (single writer `_applyMusicGain()`) WITHOUT touching the persisted `_musicVol`; `main.js` drives it from `gameState` (muted on `players` so the tags stand out). Persistent volume/mute
    Assets.js          Async image cache w/ vector fallback; getSkin(), LOGO_IMG/BG2_IMG/COIN_IMG/PALM_IMG/OPTIONS_IMG/STATS_IMG (all WebP), `getLevelBg(name)` (cached lazy loader for the heavy level bg WebPs `LA`/`metro`/`wash`/`boulevard`, not loaded on home), fontState (local `SoccerLeague` font via @font-face in index.html)
    Analytics.js       Fail-silent **anonymous** telemetry (see §12): no personal data — NO nickname, NO persistent device id. Only an **ephemeral** per-load `sessionId` (never stored in localStorage) + per-flush `batchId`; `/session` handshake → Bearer token; in-memory event buffer flushed every 30 s (≤200/batch, splits, backoff+jitter on 429/5xx, 413→smaller batches); unload via `navigator.sendBeacon` (token in body `_t`). No-op unless `VITE_ARTIE_SESSION_URL`/`VITE_ARTIE_INGEST_URL` are set; never awaited on the loop
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
    Trail.js           Player trail (cube squares / ship luminous streak); `render(renderer, cameraX, color, glow)` takes a per-player color+glow (default red; main.js passes `ply().fx.trail`/`.glow` → orange for Miles)
    StarTrail.js       Ship thruster particles (deterministic jitter, no Math.random); per-player color+shape via `setStyle(color, shape)` — `shape: 'star'|'note'` dispatches `_starPath`/`_notePath` (Artie=yellow stars, Miles=yellow musical notes)
    RocketField.js     Rocket-mode background ambiance: drifting stars + warp speed lines (deterministic, no Math.random; intensity scaled by themeT, draws nothing in cube mode). Rendered behind gameplay in main.js
    PortalFx.js        Portal transit VFX: white flash + expanding wave + sparks
    Fireworks.js       Spark bursts used by `VictoryAnim` (the victory explosion + fly-off trail): deterministic (no Math.random), SCREEN-space — `render(renderer)` takes NO cameraX. Per-player shape+color via `setStyle(color, shape)` (Artie=yellow stars, Miles=yellow notes) + colorful spark flecks, gentle gravity. Duplicates StarTrail's `_starPath`/`_notePath` (kept byte-identical)
    VictoryAnim.js     **Shared** victory animation (state `victory` in main.js + the builder's "Anteprima vittoria"). Phase machine CHARGE→HOPS→LEAP→PAUSE→TEXT (`done`, ~3.9s): the player grows/charges (explosion at the peak), does `HOP_COUNT` hops each spinning 360°, then leaps in an arc to the upper-right spinning + shrinking and vanishes off-screen (spark trail along the arc), then "LIVELLO COMPLETATO!" pops in. The MOTION is a pure `_motion(t)`→`{scale,dx,dy,angle,visible}` used by BOTH render (draw) and update (trail position), so the trail follows the real arc. Owns its own `Fireworks`; draws the player by wrapping `player.render()` in an OUTER ctx translate/scale/**rotate** (no state mutation; the outer rotate spins both cube & ship), pinning screenX to PLAYER_X via `cameraX = player.x - PLAYER_X` (works in-game and in the builder where worldX=PLAYER_X). Tunable consts (`CHARGE_DUR`/`HOP_COUNT`/`HOP_HEIGHT`/`LEAP_TURNS`/`LEAP_RISE`/`LEAP_END_SCALE`/…). API: `start({player,fillBottom,color,shape})` · `update(dt)` · `render(renderer)` · `reset()` · `done`. Self-contained text (no main.js dep), deterministic (no Math.random)
    Background.js      Generic neon parallax grid (3 layers, beat pulse, theme lerp)
    CityBackground.js  Red skyline (procedural buildings, 3 tiers, clouds)
    LaBackground.js    Sunset beach (sun, palms, houses, ferris wheel, pier, lamp)
    ImageBackground.js Image-tiled background (sky-only, horizontal loop, slow parallax; scales any image to sky height so differently-sized sources sync visually). One instance per image bg, built lazily in `getBg()` via `getLevelBg()`
  data/
    _grid.js           Helpers: ROWS=12, gap(w), assemble(...segments)
    testedo.js         The ONLY shipped map (flat array of 12 strings, builder-made). PROVVISORIO: all 6 LEVELS share it via mapKey 'testedo' (each keeps its own colors). The 5 old hand-coded maps (skyline/skyline2/metro2/carwash/boulevard) were REMOVED — future paths are authored in the Builder
    validate.js        SHARED level validator (pure fns over a grid): invariants() + playable() (cube-physics BFS). Imported by BOTH scripts/check-levels.mjs (Node) and src/builder/builder.js (browser) → single source of truth. Mirrors config.js @630
    customLevels.js    SHARED custom-level store (localStorage 'gd_customLevels'): THEME_PRESETS, DIFFS, get/save(upsert by id)/delete + buildCustomEntry() + uniqueCustomId(). Imported by the builder (create/edit/delete) and main.js loadCustomLevels() (reads) — see §13
  builder/
    builder.js         Internal Game Builder (level editor) wired from builder.html — see §13
    playtest.js        PlaytestPreview: embeds the real engine (GameLoop/Renderer/Player/Level/Camera) to PLAY the current grid in the builder ("Anteprima") — see §13
    victoryPreview.js  VictoryPreview: plays the shared `VictoryAnim` over a static neutral scene in the builder ("Anteprima vittoria"), with an Artie/Miles toggle (stars/notes) + Ripeti/Esc — see §13
builder.html           Standalone editor page (NOT part of the game); Vite multi-page entry, served at /builder.html
```

## 4. Core loop & state machine
- Fixed timestep: `FIXED_DT = 1/60`, `MAX_FRAME_TIME = 0.25` (caps recovery after a freeze).
- Game states (in `main.js`): `prehome` · `loader` · `home` · `players` · `levels` · `playing` · `victory` · `complete` · `options` · `stats`.
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
- **Victory (esultanza):** on `player.x >= finishX` the win block (still firing `saveBestCoins` /
  `commitRunStats` / `analytics.trackLevelClear` **exactly once**) calls
  `victoryAnim.start({ player, fillBottom: lvl().obstacleBottom, color: ply().fx.star, shape: ply().fx.shape })`
  and switches to `victory` (NOT straight to `complete`). The whole sequence lives in the **shared
  `VictoryAnim` module** (`effects/VictoryAnim.js`, reused by the builder's "Anteprima vittoria"):
  the world **freezes**, the player **grows/charges** in place (explosion of per-player sparks — Artie
  stars / Miles notes, yellow — at the peak), does a couple of **hops each spinning 360°**, then
  **leaps in an arc to the upper-right, spinning + shrinking, and vanishes off-screen** (spark trail
  follows the arc), a brief pause, then "LIVELLO COMPLETATO!" pops in; `victoryAnim.done` (~3.9s) → `complete`.
  State `victory` has its own early-returning block in `update(dt)` (after the `loader` block,
  **before** the `playing` guard, so gameplay physics is frozen): `victoryAnim.update(dt)` + residual
  `portalFx`/`starTrail`/`particles` updates, then `if (victoryAnim.done) gameState = 'complete'`.
  `drawVictory()` draws the **frozen game scene** via `drawGameScene(camX, beatPulse, /*drawPlayer=*/false)`
  (the player is suppressed there and drawn by `VictoryAnim`, which animates it via an outer ctx
  transform) + a light veil + `victoryAnim.render(renderer)`, mobile-scaled with `pushUiScale()`.
  **Music keeps playing** (no `stopMusic` in the win block, unlike death). No pause during `victory`
  (pause/click handlers are gated on `playing`). `restart()` calls `victoryAnim.reset()`. (Future
  hook: a `'victory'` entry in `SFX_FILES` + `audio.playSfxFile('victory')` in the win block — no-op
  until the asset exists.)
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
- **Desktop hover zoom (fine pointer only):** menu buttons/arrows/icons grow slightly (`HOVER_SCALE`
  = 1.06) when the mouse is over them. A `mousemove`/`mouseleave` pair on the canvas keeps `hoverPt`
  (the pointer in UI space via `unscalePoint(toLogical(e))`); it stays `null` on coarse pointers, so
  there is **no** effect on touch. `hoverScale(rect)` returns the scale (and raises `hoverHit`);
  `button()`/`arrow()` wrap their whole draw in `withHover(rect, …)` (a scale-about-rect-center
  transform), and the hand-drawn clickables (Home options/stats icons, player-select cubes) call
  `withHover` directly. The cursor switches to `pointer` when `hoverHit` is set — applied at the top of
  `render()` and reset each frame (1-frame lag, imperceptible). Composes cleanly with `pushUiScale`
  because `uiScale()` is 1 on desktop (the only place hover runs).
- **Credits footer (`#credits`):** DOM overlay in `index.html` (styled inline, UI palette + `SoccerLeague`
  font, CSP-safe — external `<a>` navigation isn't subject to the CSP) with two clickable links
  ("Designed by **Strangecollabo**" → instagram.com/strangecollabo, "Developed by **Twigo Lab**" →
  instagram.com/twigolab, `target="_blank" rel="noopener"`). Drawn discreetly (semi-transparent white
  text + dim-yellow links, full-yellow on hover) bottom-center, safe-area-aware. `pointer-events:none`
  on the container with `pointer-events:auto` only on the links, so taps around the text fall through to
  the canvas. `updateCredits()` (called from `render()` and `onOrientationChange()`, mirrors
  `updateInstallHint`) toggles `block`/`none`: visible in **all menus**, hidden during `playing` (so it
  never disturbs the game) and while `orientationBlocked` (portrait — `#rotate` wins). z-index 8 (under
  `#installHint`=9, `#rotate`=10). NOT scaled by `uiScale()` — a fixed DOM element with a `clamp()`
  font-size, like `#installHint`. (There are **no** desktop-only on-canvas key hints anymore — the old
  `P = CUBO …`/`SPAZIO / CLICK …` legend was removed from every menu draw.)
- **Info / disclaimer overlay (`#infoLink` + `#infoOverlay`):** a discreet **"Info"** link bottom-**right**
  (`#infoLink`, same dim-yellow look as `#credits`, z-index 8, safe-area-aware) opens a modal DOM overlay
  (`#infoOverlay`, z-index 11 — above everything) with the legal disclaimer (OG DASH is independent, not
  affiliated with RobTop Games / Geometry Dash, original assets, etc.). The overlay is a fullscreen flex
  backdrop + a centered scrollable card (`.info-card`, `rgba(20,16,46,0.96)` + yellow border, like
  `#installHint`; long text wraps/scrolls natively — that's why it's DOM, not a canvas screen). State is a
  plain boolean `infoOpen` (NOT a `gameState` value, to avoid the 10th state + canvas dispatch): the link
  calls `openInfo()`, and ✕ (`#infoClose`) / **Esc** (handled at the top of the keydown handler, priority
  over per-state transitions) / **click on the backdrop** call `closeInfo()`. `updateInfoLink()` (called
  from `render()` and `onOrientationChange()`, mirrors `updateCredits`) shows the link only in menus
  (hidden in `playing`/portrait) and **auto-closes the overlay** if we end up in `playing`/portrait while
  it's open. CSP-safe (no `_headers` change).
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
- **Install-hint banner (`#installHint`):** DOM banner in `index.html` (styled inline, UI palette +
  a CSS-drawn iOS Share glyph — no asset, CSP-safe) inviting "Aggiungi alla Home" for true fullscreen.
  **Non-dismissible by design** (no close button) to push installing. Shown **only** on iOS Safari
  **not** already standalone (`isIos()` + `!isStandalone()` via `navigator.standalone` /
  `display-mode: standalone|fullscreen`). `updateInstallHint()` (called from `render()` and
  `onOrientationChange()`) toggles it `flex`/`none`: visible only in `prehome`/`home` and landscape
  (hidden in portrait — `#rotate` wins, lower z-index). In standalone (goal reached) it never appears.
- **Mobile UI scale (`uiScale()`):** the scene is a fixed 1280×720 fit-to-contain, so on a phone the
  UI looks tiny. `uiScale()` returns **1 on fine pointer (desktop → unchanged)**; on coarse pointer
  it grows as the fit-scale shrinks (`UI_SCALE_PIVOT/fit`, capped at `UI_SCALE_MAX`), then is
  **clamped DOWN so the center-scaled content box fits the visible safe-box** — so on odd/narrow
  aspect ratios (e.g. Samsung S8+ 18.5:9, notch devices) it can return **< 1** to avoid clipping the
  logo top / Options bottom buttons. The clamp uses `UI_CONTENT_HALF_W/H` (the authored content's
  half-extents from logical center 640,360) against `renderer.safe*`. `pushUiScale()`/`popUiScale()`
  wrap the **UI block of each menu draw** (after the background, which stays full-bleed/**uncropped**)
  in a scale-about-logical-center transform — enlarges/shrinks panels/buttons/icons/text uniformly
  with no per-element edits. Wrapped: `drawPreHome`/`drawHome`/`drawLoader`/`drawLevels`/`drawComplete`/
  `drawOptions`/`drawStats`/`drawPlayers`/`drawPauseOverlay`.
  Hit-testing: the `pointerdown` handler maps the pointer with `unscalePoint(p)` (inverse center-scale)
  for **center-scaled** rects (home/options +-/mute/back/player-slots/pause-overlay), and uses the
  **RAW `p`** for the **edge-anchored** arrows (see Back navigation). The nickname `<input>` (DOM)
  mirrors the same scale in `positionNickInput()`.
- **Mobile fullscreen sizing:** `Renderer._resize()` also listens on `orientationchange` and
  `visualViewport` (`resize`/`scroll`) so the letterbox recomputes cleanly when Safari's address bar
  shows/hides (avoids bands/jitter). In standalone there's no bar, so it's a no-op there.
- **Top HUD row (`topHudLayout()`):** in `playing`, attempts (left) · progress bar (center) · coins +
  pause button (right) share **one center line inside the safe-area rect** (`renderer.safe*`), equal
  side margins, coherent gaps, all sized ×`uiScale()`. `drawHud`/`drawProgressBar`/`pauseBtnCircle`/
  `drawPauseButton` + `pointInPauseBtn` all read it, so the pause button stays on-screen (anchored to
  `safeRight`, not `extRight` → never under the notch) and the row is aligned on desktop + mobile. The
  HUD is NOT center-scaled (anchored to edges), so its hit-test uses the RAW pointer.
- **Mobile nickname `<input>`:** font-size clamped to ≥16px (below 16px iOS auto-zooms on focus);
  repositioned on `visualViewport` `resize`/`scroll` + on `focus` (so it tracks the keyboard) and given
  `z-index:5` (above canvas, below banner/rotate). `positionNickInput()` also applies `uiScale()`.
- **Back navigation + carousel arrows (edge-anchored):** the shared "indietro" arrow (`backArrowRect()`
  + `arrow(rect,-1)`, top-left) and the Levels carousel side arrows (`arrowRects()`) are anchored to the
  **true visible edges** (`renderer.safeLeft/safeRight/safeTop`) and sized ×`uiScale()`, like the HUD —
  NOT center-scaled. So they're **drawn OUTSIDE `pushUiScale`** (after `popUiScale()`) in every screen
  (`drawLevels`/`drawOptions`/`drawStats`/`drawPlayers`) and **hit-tested with the RAW pointer `p`**
  (not `unscalePoint`). This keeps them at the real screen edges on wide screens and on-screen on narrow
  ones. On `levels`/`players` the back arrow is checked first (priority over "click = play"/select).
- **Persistence (localStorage):** `gd_bestCoins` (per-level coin record), `gd_levelStats`
  (per-level bestPct/attempts/jumps), `gd_nickname` (player nickname — local only, **never sent** to
  telemetry; see §12), `gd_customLevels` (levels created in the
  Game Builder and saved into the game — array of self-contained level entries; loaded at startup by
  `loadCustomLevels()` and appended to `LEVELS`/`MAPS`; see §13). **No `artie_uid`** — the anonymous
  telemetry uses no persistent device id. **Audio is NOT persisted:**
  it ALWAYS starts ON at 50%/50% unmuted on every launch (desktop + mobile). `getSettings()` returns
  the config defaults (`MUSIC_VOLUME`/`SFX_VOLUME`/false) ignoring localStorage; `saveSettings()` is a
  no-op; `init()` clears any legacy `gd_audio` key. Options volume/mute changes apply to the current
  session only and are not remembered.
- **Backgrounds registry:** procedural `BACKGROUNDS = { neon, city, la }` + image backgrounds built
  lazily in `getBg(key)` from `IMG_BG = { losangeles:'LA', metro:'metro', carwash:'wash',
  boulevard:'boulevard' }` (each an `ImageBackground` tiling its WebP in a slow horizontal loop,
  sky-only). So `bg` accepts `'neon' | 'city' | 'la' | 'losangeles' | 'metro' | 'carwash' |
  'boulevard'`. **floor** dispatch in `drawFloor` → `la`/`city`/`metro`/`carwash`/`boulevard`/else
  neon. `floor` accepts `'neon' | 'city' | 'la' | 'metro' | 'carwash' | 'boulevard'`. Styles:
  city & carwash=brick texture (shared `drawBrickFloor`; city=red bricks + light edge, carwash=dark
  asphalt bricks + red-neon glow edge via `neonTop`) · la & boulevard=plank walkway (shared
  `drawPlankFloor`, purple vs blue) · metro=light-purple platform with wide tiles.
- **Home screen composition (`drawHome`):** the home uses the **same sky-above-`FLOOR_Y` +
  procedural-floor-below-`FLOOR_Y`** scheme as the levels (NOT `drawCover(bg-home.webp)`): the
  procedural City skyline `BACKGROUNDS.city.render(…, menuTime*HOME_SCROLL, 0, HOME_SKY)` draws the
  sky (red, `HOME_SKY`) only above `FLOOR_Y`, then `drawBrickFloor(menuTime*HOME_SCROLL, CITY_FLOOR_*)`
  draws the red brick floor below it (called directly, bypassing `drawFloorCity`'s rocket tint so the
  home stays red), both scrolling slowly (`HOME_SCROLL`), then a light `rgba(0,0,0,0.28)` veil. The
  decorative running/jumping cube (`drawHomeCube`) is grounded on **`FLOOR_Y` (`groundY = FLOOR_Y -
  size`)**, so cube and floor stay aligned at **every resolution/aspect ratio** (the old image baked a
  floor in that drifted vs the cube's fixed `LOGICAL_HEIGHT*0.85`). `bg-home.webp` (`BG2_IMG`) is still
  used by **pre-home** and **loader** via `drawCover` (no floor-grounded cube there, so no misalignment).
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
- **Telemetry wiring (fail-silent, off the critical path — full contract in §12):** the `analytics`
  singleton (`engine/Analytics.js`) is fed from six game seams in `main.js`, each a single call:
  `goHome()`→`session_start` (`analytics.start()` — no args, anonymous; also starts the 30 s flush
  timer + token handshake), `startLevel()`→`level_select`, `restart()`→`level_start` (also captures the per-attempt
  start time for `elapsedMs`), the one-time death frame in `update()`→`death` (with `progressPct =
  Math.round(bestRunPct*100)`), the `player.x >= finishX` clear in `update()`→`level_clear`, and the
  page-unload listeners (`visibilitychange`→hidden + `pagehide` after `loop.start()`)→`session_end`
  + a `sendBeacon` flush. `level` is `levelIndex + 1` (backend wants ≥1). None of this is awaited.

## 5. Physics constants (from `config.js` — quote, don't guess)
The jump is a **low/short GD-style arc** (real discrete-sim @ scroll 630: apex ~2.0 tiles, air-time
~0.40s, range ~4.2 tiles). It was shortened from the old floaty arc (apex ~2.8, range ~5.6) so the
rotation reads snappier. **The bundled levels were authored for the OLD longer jump — some no longer pass
`scripts/check-levels.mjs` (kept intentionally; not re-tuned).** See §7.
- **Cube:** `GRAVITY = 6000`, `JUMP_VELOCITY = -1250`, `MAX_FALL_SPEED = 2400`,
  `ROTATION_SPEED = Math.PI * 2.5` (real-GD rotation: **+180° per jump, +90° when the cube falls off a
  ledge** — `Player._updateCube` detects leaving the ground without jumping; `_updateRotation` rotates
  `angle` toward `_targetAngle` and **stops at the target** (no free-spin); `_land()` snaps to the
  nearest 90° so the cube rests at 0/90/180/270°; orbs call `jump()` → 180°, pads add `+= Math.PI` too),
  `PLAYER_SIZE = 60`.
- **Ship (jetpack):** `SHIP_GRAVITY = GRAVITY * 0.42`, `SHIP_THRUST = GRAVITY * 0.95`,
  `SHIP_MAX_RISE = -832`, `SHIP_MAX_FALL = 988`, `SHIP_MAX_TILT = 0.5`, `SHIP_TILT_LERP = 0.18`.
  **Top of screen (y ≤ 0) is instant death**; the floor is a safe landing.
- **Items:** `PAD_VELOCITY = -2200` (stronger than a jump, cube only; bumped from -1950 so pad apex
  stays ~6.4 tiles under the higher gravity), `ORB_RADIUS = 26`, `COINS_PER_LEVEL = 5`.
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
- **Audio:** `BPM = 128`, `MUSIC_VOLUME = 0.5` / `SFX_VOLUME = 0.5` (the audio ALWAYS starts at these
  values, ON at 50%, unmuted, on EVERY launch — not persisted; see §4 Persistence), and
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

## 7. Level design rules (geometry engine-verified @ scrollSpeed 630)
The numbers below are derived from `config.js` physics at **`scrollSpeed: 630`** for the **low/short**
jump arc (see §5). Verify any map edit with `node scripts/check-levels.mjs` (invariant checks + a
cube-physics **playability simulator** that proves a survivable path exists — see end of §9).
**Note:** the 6 bundled levels were authored for the OLD longer jump (apex ~2.98 / range ~5.77); after
shortening the jump some now FAIL the playability checker and have NOT been re-tuned (intentional). New
maps should follow the limits below.
- Cube jump apex **~2.0 tiles**, horizontal range **~4.2 tiles** (low/short, GD-like).
- **Landing on a higher platform: max `+1` tile** in a plain jump. **`+2`/`+3` are NOT reachable by a
  plain jump** — build a **staircase of `+1` steps**, or use an **orb in the ascent** or a **pad**.
- Orb (`5`) = a fresh jump from the touch point (another ~2.0 apex); **orbs chain** (re-arm on exit) so
  you can climb with 2–3 orbs. Place each on the rising arc.
- Pad (`8`) apex **~6.4 tiles** (cube-only) — for tall towers/platforms (≤ `+6`, i.e. row 3).
- **Max 3 contiguous ground hazards** (`2`/`6`/`s`) per single jump (range ~4.2 clears 3, NOT 4);
  separate groups with **flat ground** — NOT with a ground-level block (its side is lethal).
- Every horizontal gap the cube must clear **≤ 4 tiles**; the landing is always a `1`-top or ground —
  **never a hazard, never a block's side**.
- **Blocks (`1`) are full solid cells at ANY row** — top = land, **sides & underside = death**. So:
  - **Towers/staircases**: build as solid pillars climbed step-by-step (`+1`→`+2`, then `+1` onto a
    `+3`). The player must reach the **top via the staircase**; never leave a ground-running cube
    aimed at a lethal side. Keep ≥ ~4 flat tiles between a hazard run and a tower face so the cube can
    land and re-jump (a tight spike-then-wall combo is a forced death — the simulator catches it).
  - **Floating hop cubes**: a single `1` at row 7 (`+2`) with **empty cells below** lets a ground cube
    run *under* it safely and jump *onto* it for verticality (no ground-level side to crash into).
  - **Tunnels/corridors**: a block ceiling at rows ~1–4 with open **headroom** below (rows ~5–9) — the
    cube runs underneath; jumping into the ceiling underside = death, so any required jump in a tunnel
    must stay clear of the ceiling (a plain jump rises ~2 tiles).
- Climb **≤ 1 tile** per single jump (`+2`/`+3` only via a staircase, an orb in the ascent, or a pad).
- Ship sections open with `3`, close with `4`; keep a continuous open corridor — floor (`2`) and
  ceiling (`7`) spikes **must never share a column**, rows **0–1 stay clear** (top of screen y≤0 =
  instant death), and any in-corridor blocks must leave **≥ ~4 rows** of open vertical passage. No pad
  in a ship section. Buffer (empty `gap`) right before/after both portals.
- Safe buffer (~1 tile) right after every portal, pad launch, and orb-clear landing.
- Coins (`9`): **exactly 5 per level** (engine cap), always optional and reachable within jump/orb/pad
  limits. **Rows 10–11 are floor-render only — keep them all `0`** (a tile there is a phantom block).
- **Short spiked floor**: prefer **1-cell `s`** placed frequently under platform gaps
  (block→over-`s`→block) rather than one long `ssss` strip. Each `s` counts toward the contiguous-hazard limit.

## 8. How to add a new level
1. **Data file** `src/data/<name>.js`:
   ```js
   import { gap, assemble } from './_grid.js';
   const start = gap(8);
   const segA = [ /* 12 equal-width strings */ ];
   const map = assemble(start, segA, gap(5), /* ... */);
   export const <name> = map;
   ```
2. **`src/main.js`** — add the import near `testedo` and register it in `MAPS`:
   ```js
   import { <name> } from './data/<name>.js';
   const MAPS = { testedo, <name> };
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
**PROVVISORIO — all 6 levels share ONE grid (`testedo`).** Every `LEVELS` entry has `mapKey: 'testedo'`,
so City/Car Wash/Los Angeles/Boulevard/Metro all play the same builder-made path as TESTEDO for now. The
5 old hand-coded maps were removed; real per-level paths will be authored in the Builder later. **Each
level still keeps its OWN look:** distinct `bg`/`floor`/`cube`/`ship`/`obstacleBottom`, so the shared path
renders in each level's colors (City red, Boulevard blue, Metro indigo, …). `obstacleBottom` is applied
**at render** (`fillBottom = lvl().obstacleBottom` → `level.render` → `obstacle.render`), NOT baked into
the grid — that's why one grid shows different element colors per level. Per-level **stats/coins are
independent** (keyed by level `id`, not `mapKey`). `scrollSpeed: 630` for all; exactly 5 coins.

**Validate any map** with `node scripts/check-levels.mjs` (no test harness in the repo). It runs, for
each shipped map (currently just `testedo`): (1) **invariant checks** — every row same width; exactly 5
`9`; no column with both `7` and `2`; rows 0–1 free of spikes/items; rows 10–11 empty; first `4` after
first `3`; ≤4 contiguous ground hazards; no spike on a block top — AND (2) a **cube-physics playability
simulator** (BFS proving a survivable path exists end-to-end; mirrors the @630 constants from
`config.js`). The two validator functions (`invariants` + `playable`) live in `src/data/validate.js`
(shared by the Node checker **and** the in-browser Game Builder — see §13); `check-levels.mjs` imports
them. (`_grid.js`'s `gap`/`assemble` are kept for the array format / future segment authoring; testedo
is a flat array.)

| # | id | name | mapKey | bg | floor | diff | note |
|---|----|------|--------|----|----|----|-------|
| 0 | testedo | TESTEDO | `testedo` | `carwash` | `carwash` | Difficile | the one real builder-made path; leads the carousel |
| 1 | city | City | `testedo` | `city` | `city` | Facile | testedo grid, City colors (red) |
| 2 | carwash | Car Wash | `testedo` | `carwash` | `carwash` | Medio | testedo grid, Car Wash colors |
| 3 | losangeles | Los Angeles | `testedo` | `losangeles` | `la` | Medio | testedo grid, LA colors |
| 4 | boulevard | Boulevard | `testedo` | `boulevard` | `boulevard` | Difficile | testedo grid, Boulevard colors (blue) |
| 5 | metro | Metro | `testedo` | `metro` | `metro` | Difficile | testedo grid, Metro colors (indigo) |

(Carousel order = `LEVELS` order: TESTEDO → City → Car Wash → Los Angeles → Boulevard → Metro. All share
the testedo grid until real paths are built; only the visuals differ.)

- **Players (skins only, identical physics):** each `PLAYERS` entry carries BOTH a cube skin
  (`skin`) AND a ship/razzo skin (`ship`): `Artie` (`/artie-cube.webp` + `/dodge-artie.webp`),
  `Miles` (`/miles-cubo.webp` + `/miles-razzo.png`). `main.js` sets both per-player on
  `startLevel()`/`init()` via `player.setSkin(getSkin(ply().skin))` +
  `player.setShipSkin(getSkin(ply().ship))`; `Player._renderShip` draws `this.shipSkin`
  (default = global `SHIP_IMG` fallback). Both are preloaded in `Assets.js`. Each entry also
  has an `fx` block — the **per-player trail look**: `{trail, glow, star, shape}`. `Artie` =
  red smoke (`#ff3b3b`/`#ff2a2a`) + yellow `star`s; `Miles` = orange smoke (`#ff8a1e`/`#ff6a00`)
  + yellow musical `note`s. `main.js` applies it on `startLevel()`/`init()` via
  `starTrail.setStyle(ply().fx.star, ply().fx.shape)` and `trail.render(…, ply().fx.trail,
  ply().fx.glow)`. (The home/menu decorative cube trail stays red — Trail's defaults.)
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
  The only other canvas mouse listeners are the **hover** `mousemove`/`mouseleave` pair (desktop zoom,
  see §4) — they only read the position, never trigger actions, so they don't interfere.
- No automated tests, BUT level data has a checker: `node scripts/check-levels.mjs` (invariants +
  cube-physics playability sim — see §9). Run it after any `src/data/*.js` edit; then `npm run dev`
  (test mobile via DevTools device emulation: portrait shows the `#rotate` overlay + freezes; landscape
  menus are tappable).
- **Telemetry is fail-silent (§12):** never `await` an `analytics.*` call on the game loop; every
  method is a try/catch no-op without env. If you add/move a telemetry event, keep the `_headers`
  `connect-src` in sync with the backend origins (a mismatch silently CSP-blocks all requests).

## 11. Maintenance checklist (update THIS file when…)
- **New/changed level** → update the table in §9 (and §8 if the wiring steps change).
- **New/changed tile code** → update the legend in §6.
- **Physics/layout constant changes** in `config.js` → update §5 (and §7 if jump/range/pad math shifts).
- **New engine/game/effect module** → add a line to the directory map in §3.
- **New game state, persistence key, or background/floor option** → update §4.
- **New telemetry event or changed backend contract** → update §12 (and the §4 telemetry-wiring
  bullet) and verify the `_headers` `connect-src` origins match `VITE_ARTIE_*_URL`.
- **Change to a validator rule (`invariants`/`playable`) or the Game Builder** → update §13 (and the
  validator now lives in `src/data/validate.js`, shared with `check-levels.mjs` — edit it there once).

## 12. Telemetry / Analytics (`engine/Analytics.js`)
Directional gameplay analytics, **anonymous by design** — no personal data leaves the device: NO
nickname, NO persistent device id, only an ephemeral per-session pseudonym (`sessionId`). The backend
is meant to keep aggregate stats. The backend is two AWS Lambda Function URLs (eu-central-1):
a `/session` handshake and an `/ingest` endpoint, **reached via Cloudflare-proxied subdomains**
(`session.<domain>` / `ingest.<domain>`) — NOT the direct `*.lambda-url.…on.aws` URLs, which are
**origin-locked and return 403**. (`<domain>` is a placeholder `artie.example` until the backend
provides the real proxied domain; swap it in `.env*` + `_headers` together.)

- **Identity (anonymous):** the ONLY identifier is `sessionId` = fresh UUID per page load (= per play
  session), **ephemeral, never written to localStorage**, so it can't track a device over time or be
  tied to a person. `batchId` = fresh UUID per flush (server dedups on it). **No `userId`/`artie_uid`,
  no `nickname`** — the nickname stays local (`gd_nickname`) for the UI only and is never transmitted.
- **Handshake:** at `session_start`, POST `{sessionId}` to `VITE_ARTIE_SESSION_URL` → `{token,
  exp}`. The token rides as `Authorization: Bearer <token>` on every ingest POST; refreshed near `exp`
  (60 s skew) and once on a `401`.
- **Batching:** events accumulate in memory and flush **once every 30 s** (one POST per ≤200 events;
  a bigger window splits into multiple POSTs). Each event is `ts`-stamped at emission, so the buffer
  is chronological; failed batches are re-queued **at the front** (`unshift`) to preserve order. Retry
  with backoff+jitter on `429`/`5xx`; `413`→retry with smaller batches; `400`/`403`→drop. Payload shape
  is **exact** (no extra fields): `{schemaVersion:1, batchId, sessionId, clientSentAt,
  events:[…]}`. Events: `session_start | level_select | level_start | death | level_clear | session_end`
  (see §4 for which game seam emits which; `death` carries `progressPct` 0–100 + `elapsedMs`).
- **Unload:** `visibilitychange`→hidden + `pagehide` push `session_end` and flush via
  `navigator.sendBeacon` (can't set headers → token goes in the body as `_t`). Best-effort, no retry.
- **Config:** `VITE_ARTIE_SESSION_URL` / `VITE_ARTIE_INGEST_URL` (the proxied subdomains, **no
  trailing slash**) + `VITE_ARTIE_TURNSTILE_SITE_KEY` (**predisposed but inactive** — present in
  `.env.example` commented out; no widget/script is wired until the backend activates Turnstile and
  provides the site key). All are Vite env, inlined at build time. Without **both** URLs telemetry is
  a complete no-op (no network, no logs). Local dev uses `.env.local` (gitignored via `*.local`);
  `.env.example` documents the vars; Cloudflare Pages sets them in the build env (build-time → saving
  in the dashboard requires a rebuild to take effect). **CSP:** `public/_headers` `connect-src` must
  list both telemetry origins or the browser blocks the requests (CSP is a static edge header and
  can't read the Vite env — the origins are hard-coded there and must be kept in sync **exactly** with
  the env URLs: same scheme/host, no path/trailing slash).
- **Fail-silent guarantee:** every public method is a try/catch no-op; `flush()` runs as a detached
  promise and is never awaited; network only happens on the 30 s timer or unload, never in
  `update()`/`render()`.

## 13. Game Builder (internal level editor)
An **internal authoring tool** (NOT part of the player-facing game, not in any menu) to design level
maps visually instead of hand-editing the `src/data/*.js` arrays. Standalone page, decoupled from the
game runtime.

- **Where:** `builder.html` (repo root) → `src/builder/builder.js`. It's a **Vite multi-page entry**
  (`vite.config.js` `build.rollupOptions.input = { main, builder }`), so it's served at
  **`/builder.html`** in `npm run dev` and emitted by `npm run build` (`dist/builder.html`). All
  same-origin (font `/SoccerLeague.ttf`, the `data/*.js` imports) → no `_headers`/CSP change needed.
- **Grid model:** an in-memory `12 × cols` array of chars (default `0`); replicates the game grid —
  `TILE=60`, **row 9 = ground**, rows 10–11 = floor-render-only (**locked**: only `0` can be painted
  there), rows 0–1 shaded as the ceiling death zone. `cols` grows as you paint rightward (free width).
- **Editing UX = palette + paint:** pick a tile from the left palette (every code `0 1 2 3 4 5 6 7 8 9
  s`, `0` = eraser), then click/drag across cells to paint (`pointerdown`+`pointermove`). Pan with the
  **middle button / Shift-drag / hold-Space-drag**, the wheel, or ←/→. Canvas draws each tile echoing
  the game's look (spikes, blocks, magenta/green portals, yellow orb/pad, gold coin) — it does NOT
  import `Obstacle`/`Level` (those need camera/world state), just a deterministic visual echo.
- **Zoom + pan:** the whole view transform routes through `scaleY() = baseScale()*zoom` (single source —
  `pointToCell`/`draw`/`maxScroll`/ruler all inherit it). Zoom via the toolbar **− / % / +** buttons,
  **Ctrl/Cmd+wheel** (centered on the cursor via `setZoom`), or keys `+`/`-`/`0`-reset (`0.5×–3×`). Plain
  wheel still = horizontal scroll. When zoomed in (`zoom>1`) a vertical `scrollY` unlocks (`maxScrollY>0`):
  pan it with Space/middle-drag (now both axes), **Shift+wheel**, or ↑/↓. `clampScroll` bounds both axes
  (`scrollY` auto-locks to 0 at `zoom≤1`); `resize()` re-clamps.
- **Multi-select + move (the "Seleziona" toggle):** click **Seleziona** (toolbar toggle, `.btn.active`) to
  enter select mode (paint disabled; pan still works). Drag a **rubber-band** rectangle (`selRect`, tinted
  + dashed); drag **inside** it to **move the block** — a 55%-alpha ghost follows, release commits a
  **cut+paste** (`commitMove`: clear source → stamp at offset, `ensureCols` past the right edge, cells
  landing in rows 10–11/off-grid are **dropped**). **Canc/Backspace** clears the selected cells
  (`deleteSelection`), **Esc** deselects, clicking Seleziona again returns to paint. Rows 10–11 are never
  lifted/written (keeps the `validate.js` "render pavimento" invariant green). State machine:
  `idle→selecting→selected→moving`; helpers `normRect`/`clampRectToGrid`/`rectContainsCell`/
  `captureSelection`/`clearSelection`. All mutations call `scheduleValidate()`+`draw()`.
- **Live validation (same gate as CI):** every edit re-runs `invariants()` + `playable()` from
  **`src/data/validate.js`** — the SAME functions `scripts/check-levels.mjs` uses — and renders a
  ✅/❌ verdict, a per-rule checklist, and the playability result (max reachable tile if blocked). So
  **green in the builder ⇒ passes `node scripts/check-levels.mjs`** (single source of truth, no drift).
- **Export = JS data file:** "Genera file" builds `export const <name> = [ …12 strings… ];`, copies it
  to the clipboard, and downloads `<name>.js`. Then wire it per §8 (drop in `src/data/`, add to `MAPS`
  in `main.js`, add a `LEVELS` entry in `config.js`). The builder emits the **assembled array**
  directly (no `assemble()`/named segments) — equivalent to what `Level` consumes.
- **Import / edit existing ("Carica livello…"):** two labeled sections. **"Livelli del gioco"** = every
  `LEVELS` entry (imported from `config.js`) by real name (TESTEDO, City, Car Wash, …); clicking loads its
  grid via the builder's `MAPS` mirror (all `testedo` for now) to **remix as new** (`editing=null`).
  **"Livelli custom salvati"** = `getCustomLevels()` (localStorage), hidden if none; clicking enters
  **edit mode** (`loadCustomForEdit`, overwrite on save). Plus the paste-array textarea ("Carica da
  testo"). When real per-level paths exist, only the builder's `MAPS` mirror + config mapKeys change —
  `openImport` is data-driven and needs no edit.
- **Anteprima (playable playtest):** "Anteprima" opens a full-screen overlay (`#previewOverlay`) that
  **actually plays the current grid** using the real engine via `src/builder/playtest.js`
  (`PlaytestPreview`). It **imports and reuses** `GameLoop`/`Renderer`/`Player`/`Level`/`Camera`/
  `Collision` and re-implements only the slim per-frame glue `main.js` keeps private
  (update + `handleOrbs/Portals/Pads/Coins`, death→respawn, win→"COMPLETATO!"). Input is a small
  scoped `PreviewInput` (own listeners, removed on `destroy()` — NOT `engine/Input.js`, which has no
  teardown). Esc / "Esci" → `destroy()` (stops the rAF + unbinds). Cosmetic effects (particles/trail/
  bg) are omitted — a solid backdrop + floor line is enough to test feel. Throwaway: previewing saves
  nothing. Enabled only when the level is **valid** (shares `runValidation()`'s `ok` via `lastValid`).
- **Anteprima vittoria (preview the victory animation):** "Anteprima vittoria" opens a SEPARATE
  full-screen overlay (`#victoryOverlay`, distinct from `#previewOverlay` which is bound to
  `PlaytestPreview`) that plays the **shared `VictoryAnim`** (the exact in-game victory sequence —
  grow→fly-off→text) over a static neutral scene, via `src/builder/victoryPreview.js`
  (`VictoryPreview`). So tweaking `VictoryAnim` can be tested without replaying a level. It owns its
  own `Renderer`/`GameLoop` + a `Player` (skin loaded via `getSkin`), and imports `PLAYERS` (the
  builder has no player selection): an **Artie/Miles toggle** (`#btnVicArtie`/`#btnVicMiles`, the
  active one gets `.btn.active`) switches the cube skin + spark shape (stars vs notes) and replays.
  **Ripeti** (or a tap/click on the canvas) replays; **Esc** / "Esci" → `destroy()` (stops the rAF).
  It never goes to `complete` — it holds the final text frame until Ripeti/Esc. Always available
  (no validity gate — it's a cosmetic preview).
- **Salva nel gioco (play in the real game) — create OR update:** "Salva nel gioco" (green) saves the
  level **into the game** so it's instantly playable — no code edit. It writes a self-contained entry to
  localStorage `gd_customLevels` via **`src/data/customLevels.js`** (shared module, like `validate.js`):
  the modal sets **name + theme** (one of the 5 `THEME_PRESETS` = bg/floor/obstacleBottom; cube/ship
  always the LA pair, inlined) **+ difficulty** (`DIFFS` → label + `diffFrac`), and `buildCustomEntry()`
  produces `{id, name, diff, diffFrac, bg, floor, obstacleBottom, cube, ship, scrollSpeed,
  mapKey:'custom-'+id, grid, custom:true}`. The game's **`loadCustomLevels()`** (right after `init()` in
  `main.js`) reads them and does `MAPS[mapKey]=grid` + `LEVELS.push(entry)` — they appear at the **end of
  the Livelli carousel** (tagged `CUSTOM`) and play via the existing `LEVELS.length`/`MAPS[mapKey]` paths;
  stats/coins persist under the entry's `id`. **Create vs update** is driven by an `editing` context
  (`{id,name,themeId,diffLabel}` or `null`): when **editing** an existing custom (see manager below) the
  modal title/button become "Aggiorna" and Save **overwrites the same `id`** (`saveCustomLevel` upserts
  by id); when **creating**, the id is `uniqueCustomId(slugify(name))` so two different new levels never
  collide. After any save you stay "in edit" on that entry (a re-save updates, not duplicates). Device-
  local, gated on validity. **`customLevels.js` is the single source of truth** for the key/presets/id,
  imported by both the builder and the game (no drift).
- **Livelli di gioco (manager: edit + delete, synced):** "Livelli di gioco" opens a panel listing every
  **custom** level (`getCustomLevels()`), each with **Modifica** (`loadCustomForEdit` → `fromStrings` +
  set `editing` + an "Modifica: \<name\>" banner with a **Nuovo livello** button to leave edit mode) and
  **Elimina** (`deleteCustomLevel`, confirm). The same Modifica/Elimina list also appears inside the save
  modal (shared `renderCustomList`). Edits sync to the game by overwriting the same id; deletes remove the
  entry — the game reflects both on next launch. **Scope = custom only:** the 5 built-ins (in `config.js`,
  not localStorage) are never editable/deletable here. "Carica livello…"/paste **exits edit mode**
  (`editing=null`) since a built-in/pasted grid isn't a saved custom.
- **Toolbar extras:** "Taglia vuoto" trims trailing empty columns; "Svuota" = **Nuovo livello** (clears
  the grid AND exits edit mode, so a fresh level never overwrites a saved one).

// =============================================================================
// playtest.js — anteprima GIOCABILE del livello dentro il Game Builder.
//
// Riusa il VERO motore (GameLoop/Renderer/Player/Level/Camera + Collision): qui
// si re-implementa solo la "colla" per-frame che main.js tiene privata
// (update/render + handleOrbs/Portals/Pads/Coins, morte/vittoria), così il
// percorso si prova con la stessa identica fisica del gioco PRIMA di salvarlo.
//
// Throwaway: aprire/chiudere l'anteprima non salva nulla. `destroy()` ferma il
// loop e rimuove i listener di input (niente rAF/handler appesi).
//
// Input: NON riusiamo engine/Input.js perché non ha teardown (aggiunge listener
// senza rimuoverli). Implementiamo un input minimale con la stessa interfaccia
// (`held` + `consumePress()`) e lo smontiamo in destroy().
// =============================================================================
import { GameLoop } from '../engine/GameLoop.js';
import { Renderer } from '../engine/Renderer.js';
import { Player } from '../game/Player.js';
import { Level } from '../game/Level.js';
import { Camera } from '../game/Camera.js';
import { aabbOverlap } from '../game/Collision.js';
import {
  PLAYER_X,
  PAD_VELOCITY,
  FIXED_DT,
  FLOOR_Y,
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
} from '../config.js';

const RESPAWN_DELAY = 0.6; // pausa breve dopo la morte prima del retry

// Input minimale scoped al canvas dell'anteprima, con teardown pulito.
class PreviewInput {
  constructor(target) {
    this.target = target;
    this.held = false;
    this._pressed = false;
    this._onKeyDown = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) { e.preventDefault(); this._press(); }
    };
    this._onKeyUp = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') this._release(); };
    this._onDown = (e) => { if (e.button === 0) this._press(); };
    this._onUp = (e) => { if (e.button === 0) this._release(); };
    this._onTouchStart = (e) => { e.preventDefault(); this._press(); };
    this._onTouchEnd = () => this._release();
    this._onBlur = () => this._release();
    // tastiera su window (il canvas non riceve focus da solo); mouse/touch sul canvas.
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
    target.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);
    window.addEventListener('blur', this._onBlur);
  }
  _press() { if (!this.held) this._pressed = true; this.held = true; }
  _release() { this.held = false; }
  consumePress() { const p = this._pressed; this._pressed = false; return p; }
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mouseup', this._onUp);
    this.target.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('blur', this._onBlur);
  }
}

export class PlaytestPreview {
  // canvas: <canvas> dell'overlay anteprima. grid: array di 12 stringhe.
  // opts.scrollSpeed (default 630). opts.onExit: callback quando si esce/finisce.
  constructor(canvas, grid, opts = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new PreviewInput(canvas);
    this.player = new Player();
    this.level = new Level(grid);
    this.camera = new Camera();
    this.camera.setSpeed(opts.scrollSpeed || 630);
    this.finishX = this.level.widthPx;
    this.onExit = opts.onExit || null;

    this.dead = false;
    this.deathTimer = 0;
    this.won = false;
    this.elapsed = 0; // per le animazioni di portali/monete
    this.attempts = 1;
    this.coinsCollected = 0;
    this.lastPortal = null;
    this.lastPad = null;

    this.loop = new GameLoop((dt) => this.update(dt), (a) => this.render(a));
  }

  start() {
    this.reset();
    this.loop.start();
  }

  // Riparte da capo il tentativo (mirror di restart() in main.js, senza audio/fx).
  reset() {
    this.camera.reset();
    this.player.reset(this.camera.x + PLAYER_X);
    this.player.setMode('cube');
    this.dead = false;
    this.deathTimer = 0;
    this.lastPortal = null;
    this.lastPad = null;
    this.coinsCollected = 0;
    for (const orb of this.level.orbs) orb._used = false;
    for (const coin of this.level.coins) coin._collected = false;
  }

  update(dt) {
    this.elapsed += dt;

    if (this.won) return; // congelato sul banner di fine

    if (this.dead) {
      this.deathTimer += dt;
      if (this.deathTimer >= RESPAWN_DELAY) { this.attempts++; this.reset(); }
      return;
    }

    this.camera.update(dt);
    this.player.x = this.camera.x + PLAYER_X;

    this._handleOrbs();
    this._handlePortals();
    this.player.update(dt, this.input, this.level);
    this._handlePads();
    this._handleCoins();

    if (!this.player.alive) { this.dead = true; this.deathTimer = 0; return; }

    if (this.player.x >= this.finishX) { this.won = true; this.loop.stop(); }
  }

  // --- Handler (1:1 con main.js) ---------------------------------------------
  _handleOrbs() {
    const pcx = this.player.x + this.player.size / 2;
    const pcy = this.player.y + this.player.size / 2;
    const reach = this.player.size / 2;
    let target = null;
    for (const orb of this.level.orbs) {
      const dx = pcx - orb.cx, dy = pcy - orb.cy;
      const inRange = dx * dx + dy * dy <= (orb.r + reach) * (orb.r + reach);
      if (inRange) { if (!orb._used) target = orb; }
      else orb._used = false; // si ri-arma all'uscita (orb concatenabili)
    }
    if (target && this.input.consumePress()) { this.player.jump(); target._used = true; }
  }

  _handlePortals() {
    const box = this.player.getHitbox();
    let touching = null;
    for (const p of this.level.portals) { if (aabbOverlap(box, p.getHitbox())) { touching = p; break; } }
    if (touching && touching !== this.lastPortal) {
      this.player.setMode(touching.mode);
      this.lastPortal = touching;
    } else if (!touching) {
      this.lastPortal = null;
    }
  }

  _handlePads() {
    if (this.player.mode !== 'cube') return; // pad solo in modalità cubo
    const box = this.player.getHitbox();
    let touching = null;
    for (const pad of this.level.pads) { if (aabbOverlap(box, pad.getHitbox())) { touching = pad; break; } }
    if (touching && touching !== this.lastPad) {
      this.player.vy = PAD_VELOCITY;
      this.player.onGround = false;
      this.player._targetAngle += Math.PI; // come un salto: 180° (coerente col gioco)
      this.lastPad = touching;
    } else if (!touching) {
      this.lastPad = null;
    }
  }

  _handleCoins() {
    const box = this.player.getHitbox();
    for (const coin of this.level.coins) {
      if (!coin._collected && aabbOverlap(box, coin.getHitbox())) {
        coin._collected = true;
        this.coinsCollected++;
      }
    }
  }

  // --- Render -----------------------------------------------------------------
  render(alpha) {
    const r = this.renderer;
    r.begin();
    const ctx = r.ctx;

    // Camera interpolata come nel gioco (fluidità a framerate alto).
    const camX = this.player.alive ? this.camera.x + this.camera.speed * FIXED_DT * alpha : this.camera.x;

    // Sfondo: gradiente neutro (niente effetti — è solo un playtest).
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    g.addColorStop(0, '#241a4d');
    g.addColorStop(1, '#14102e');
    ctx.fillStyle = g;
    ctx.fillRect(r.extLeft, r.extTop, r.extRight - r.extLeft, r.extBottom - r.extTop);

    // Pavimento pieno sotto FLOOR_Y.
    ctx.fillStyle = '#1a1626';
    ctx.fillRect(r.extLeft, FLOOR_Y, r.extRight - r.extLeft, r.extBottom - FLOOR_Y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.extLeft, FLOOR_Y);
    ctx.lineTo(r.extRight, FLOOR_Y);
    ctx.stroke();

    // Livello + player (vere render del gioco).
    this.level.render(r, camX, this.elapsed);
    if (this.player.alive) this.player.render(r, this.camera.x);

    this._drawHud(ctx);
  }

  _drawHud(ctx) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "bold 26px 'SoccerLeague', system-ui, sans-serif";

    // Progresso + monete in alto a sinistra.
    const pct = Math.max(0, Math.min(100, Math.round((this.player.x / this.finishX) * 100)));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ANTEPRIMA · ${pct}%`, 24, 18);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`MONETE ${this.coinsCollected}/${this.level.coins.length}`, 24, 50);

    // Hint comandi in basso.
    ctx.textAlign = 'center';
    ctx.font = "20px 'SoccerLeague', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('CLICK / SPAZIO = SALTO   ·   ESC = ESCI', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40);

    // Banner di fine percorso.
    if (this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.renderer.extLeft, 0, this.renderer.extRight - this.renderer.extLeft, LOGICAL_HEIGHT);
      ctx.textAlign = 'center';
      ctx.font = "bold 64px 'SoccerLeague', system-ui, sans-serif";
      ctx.fillStyle = '#5fd000';
      ctx.fillText('COMPLETATO!', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 60);
      ctx.font = "26px 'SoccerLeague', system-ui, sans-serif";
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Premi ESC per tornare al builder', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 10);
    }
    ctx.restore();
  }

  // Ferma loop + smonta input. Da chiamare alla chiusura dell'overlay.
  destroy() {
    this.loop.stop();
    this.input.destroy();
  }
}

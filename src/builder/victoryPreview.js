// =============================================================================
// victoryPreview.js — anteprima dell'ANIMAZIONE DI VITTORIA dentro il Game
// Builder (bottone "Anteprima vittoria"). Riusa il modulo CONDIVISO VictoryAnim
// (lo stesso del gioco) così, modificando l'effetto, lo si prova senza rigiocare
// un livello. Throwaway: aprire/chiudere non salva nulla; destroy() ferma il loop.
//
// Il builder non ha selezione del personaggio: qui un toggle Artie/Miles sceglie
// skin del cubo + forma delle scintille (stelle vs note), per provare entrambi.
//
// La scena è statica e neutra (gradiente + linea pavimento, come playtest.js):
// serve solo a far risaltare l'animazione, non a giocare.
// =============================================================================
import { GameLoop } from '../engine/GameLoop.js';
import { Renderer } from '../engine/Renderer.js';
import { Player } from '../game/Player.js';
import { VictoryAnim } from '../effects/VictoryAnim.js';
import { getSkin } from '../engine/Assets.js';
import { PLAYERS, PLAYER_X, FLOOR_Y, LOGICAL_HEIGHT } from '../config.js';

export class VictoryPreview {
  // canvas: <canvas> dell'overlay. opts.playerId: 'artie' | 'miles' (default 'artie').
  constructor(canvas, opts = {}) {
    this.renderer = new Renderer(canvas);
    this.player = new Player();
    // Il player sta fermo a worldX = PLAYER_X: così VictoryAnim (cameraX =
    // player.x - PLAYER_X = 0) lo ancora a screenX = PLAYER_X, come nel gioco.
    this.player.reset(PLAYER_X);
    this.victory = new VictoryAnim();
    this.playerId = opts.playerId || 'artie';
    this.loop = new GameLoop((dt) => this.update(dt), (a) => this.render(a));
  }

  start() {
    this.setPlayer(this.playerId); // imposta skin/forma e avvia l'animazione
    this.loop.start();
  }

  // Cambia personaggio (skin cubo + forma scintille) e rilancia l'animazione.
  setPlayer(id) {
    const p = PLAYERS.find((x) => x.id === id) || PLAYERS[0];
    this.playerId = p.id;
    this.player.setSkin(getSkin(p.skin));
    this.player.setMode('cube');
    this.victory.start({
      player: this.player,
      fillBottom: null,
      color: p.fx.star,
      shape: p.fx.shape,
    });
  }

  // Rilancia l'animazione da capo (col personaggio corrente).
  replay() {
    this.setPlayer(this.playerId);
  }

  update(dt) {
    // L'anteprima NON va a 'complete': quando l'animazione finisce resta sull'ultimo
    // frame del testo (update() di VictoryAnim è no-op dopo `done`) finché Ripeti/Esc.
    this.victory.update(dt);
  }

  render() {
    const r = this.renderer;
    r.begin();
    const ctx = r.ctx;

    // Sfondo: gradiente neutro (come playtest — è solo un'anteprima).
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    g.addColorStop(0, '#241a4d');
    g.addColorStop(1, '#14102e');
    ctx.fillStyle = g;
    ctx.fillRect(r.extLeft, r.extTop, r.extRight - r.extLeft, r.extBottom - r.extTop);

    // Pavimento pieno sotto FLOOR_Y + linea.
    ctx.fillStyle = '#1a1626';
    ctx.fillRect(r.extLeft, FLOOR_Y, r.extRight - r.extLeft, r.extBottom - FLOOR_Y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.extLeft, FLOOR_Y);
    ctx.lineTo(r.extRight, FLOOR_Y);
    ctx.stroke();

    // Animazione di vittoria (player grow/fly + scintille + testo) sopra la scena.
    this.victory.render(r);
  }

  // Ferma il loop. Da chiamare alla chiusura dell'overlay.
  destroy() {
    this.loop.stop();
  }
}

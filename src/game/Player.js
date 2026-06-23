import {
  PLAYER_SIZE,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  FLOOR_Y,
  ROTATION_SPEED,
  COLORS,
  PLAYER_INNER,
  PLAYER_EDGE,
  GLOW_COLOR,
  GLOW_BLUR,
  SHIP_GRAVITY,
  SHIP_THRUST,
  SHIP_MAX_RISE,
  SHIP_MAX_FALL,
  SHIP_MAX_TILT,
  SHIP_TILT_LERP,
  SHIP_COLOR,
  USE_SKIN_GLOW,
} from '../config.js';
import { aabbOverlap, overlapDepth } from './Collision.js';
import { DEFAULT_CUBE_IMG, SHIP_IMG } from '../engine/Assets.js';

// =============================================================================
// Player — cubo o razzo (modalità). Vive in WORLD-space.
//
// `this.x` è la posizione nel mondo (avanza con la camera); a schermo resta
// fisso a PLAYER_X (traslazione in render). `this.y` è il bordo superiore.
//
// Due modalità:
//  - 'cube': gravità decisa, salto al tocco (held), atterraggio, rotazione 90°.
//  - 'ship': volo jetpack — gravità ridotta, spinta su tenendo premuto, vy
//    clampata, inclinazione (pitch) verso vy, soffitto letale.
//
// NB: in modalità cube il salto da terra usa input.held; NON consumiamo l'edge
// qui, così resta disponibile per i jump-orb (gestiti in main.js).
// =============================================================================
export class Player {
  constructor() {
    this.size = PLAYER_SIZE;
    this.cubeSkin = DEFAULT_CUBE_IMG; // skin del cubo (cambiabile con setSkin)
    // Contatore monotòno dei salti (mai azzerato): main.js ne legge il delta
    // per conteggio salti + SFX. Non sta in reset() così sopravvive ai restart.
    this.jumpCount = 0;
    this.reset(0);
  }

  // Imposta la skin del cubo (handle da Assets.getSkin). Il razzo resta comune.
  setSkin(handle) {
    if (handle) this.cubeSkin = handle;
  }

  reset(worldX) {
    this.x = worldX;
    this.y = FLOOR_Y - this.size;
    this.vy = 0;
    this.onGround = true;
    this.alive = true;

    this.mode = 'cube';
    this.angle = 0; // rotazione cubo
    this._targetAngle = 0;
    this.pitch = 0; // inclinazione razzo
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    // Reset rotazione al cambio modalità: il cubo torna dritto (faccia in su).
    this.angle = 0;
    this._targetAngle = 0;
    this.pitch = 0;
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }

  update(dt, input, level) {
    if (!this.alive) return;
    if (this.mode === 'ship') this._updateShip(dt, input, level);
    else this._updateCube(dt, input, level);
  }

  // --- Modalità CUBO ---------------------------------------------------------
  _updateCube(dt, input, level) {
    // Salto da terra: basta tenere premuto (rimbalza appena tocca).
    if (input.held && this.onGround) this.jump();

    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    this.y += this.vy * dt;

    this.onGround = false;
    this._resolveLevel(level);

    const floorTop = FLOOR_Y - this.size;
    if (this.y >= floorTop) {
      this.y = floorTop;
      if (this.vy > 0) this.vy = 0;
      this._setGrounded();
    }

    this._updateRotation(dt);
  }

  // --- Modalità RAZZO --------------------------------------------------------
  _updateShip(dt, input, level) {
    // La gravità (ridotta) agisce sempre; tenendo premuto si aggiunge la spinta
    // verso l'alto. Net: held -> sale, rilasciato -> scende. vy clampata.
    this.vy += SHIP_GRAVITY * dt;
    if (input.held) this.vy -= SHIP_THRUST * dt;
    if (this.vy < SHIP_MAX_RISE) this.vy = SHIP_MAX_RISE;
    if (this.vy > SHIP_MAX_FALL) this.vy = SHIP_MAX_FALL;

    this.y += this.vy * dt;
    this.onGround = false;

    // Soffitto letale (bordo alto dello schermo).
    if (this.y <= 0) {
      this.kill();
      return;
    }

    this._resolveLevel(level);

    // Pavimento: limite invalicabile, NON morte (striscia sul terreno).
    const floorTop = FLOOR_Y - this.size;
    if (this.y >= floorTop) {
      this.y = floorTop;
      if (this.vy > 0) this.vy = 0;
      this.onGround = true;
    }

    // Inclinazione (pitch) verso la velocità verticale, interpolata.
    const target = (this.vy / SHIP_MAX_FALL) * SHIP_MAX_TILT;
    this.pitch += (target - this.pitch) * SHIP_TILT_LERP;
  }

  _resolveLevel(level) {
    const box = this.getHitbox();
    for (const ob of level.obstacles) {
      if (ob.x + ob.w < this.x - this.size || ob.x > this.x + this.size * 2) continue;

      const hb = ob.getHitbox();
      if (!aabbOverlap(box, hb)) continue;

      if (ob.deadly) {
        this.kill();
        return;
      }
      if (ob.solid) {
        this._resolveBlock(hb);
        box.y = this.y;
        box.x = this.x;
      }
    }
  }

  // Risolve un blocco solido. Priorità all'ATTERRAGGIO: se nel frame precedente
  // il fondo del cubo era sopra (o appena sopra) la cima del blocco e sta
  // scendendo, è un appoggio — anche se l'overlap verticale del frame supera
  // quello orizzontale (succede a velocità alta entrando da uno spigolo, e
  // causava morti spurie su terreni/piattaforme contigui).
  _resolveBlock(hb) {
    const box = this.getHitbox();
    const prevBottom = this.y - this.vy * (1 / 60) + this.size; // fondo nel frame prec.
    const landTol = 14; // tolleranza atterraggio (px)

    // 1) Atterraggio sopra il blocco.
    if (this.vy >= 0 && prevBottom <= hb.y + landTol) {
      this.y = hb.y - this.size;
      this.vy = 0;
      if (this.mode === 'cube') this._setGrounded();
      else this.onGround = true;
      return;
    }

    const { dx, dy } = overlapDepth(box, hb);

    // 2) Spinta da sotto (testa contro il soffitto del blocco) senza morte se
    //    l'overlap è minimo (rasentare); morte solo se ci sbatte davvero.
    const prevTop = this.y - this.vy * (1 / 60);
    if (this.vy < 0 && prevTop >= hb.y + hb.h - landTol) {
      this.kill(); // colpito chiaramente dal basso
      return;
    }

    // 3) Impatto laterale reale: il cubo era già all'altezza del blocco e lo
    //    colpisce di fianco -> morte. (dy>=dx conferma collisione laterale.)
    if (dx <= dy) {
      this.kill();
    } else {
      // Overlap prevalentemente verticale ma non classificato come atterraggio:
      // risolvi spingendo fuori verticalmente senza uccidere (caso limite).
      if (this.vy >= 0) {
        this.y = hb.y - this.size;
        this.vy = 0;
        if (this.mode === 'cube') this._setGrounded();
        else this.onGround = true;
      } else {
        this.y = hb.y + hb.h;
        this.vy = 0;
      }
    }
  }

  _setGrounded() {
    this.onGround = true;
    this._land();
  }

  // Impulso di salto (cubo da terra, o jump-orb anche in aria).
  jump() {
    this.vy = JUMP_VELOCITY;
    this.onGround = false;
    this.jumpCount++; // contatore monotòno (letto da main.js per stats + SFX)
    // Un giro completo (360°) per salto: il cubo atterra sempre faccia in su.
    if (this.mode === 'cube') this._targetAngle += Math.PI * 2;
  }

  kill() {
    this.alive = false;
  }

  _updateRotation(dt) {
    if (this.onGround) return;
    const step = ROTATION_SPEED * dt;
    if (this.angle < this._targetAngle) {
      this.angle = Math.min(this.angle + step, this._targetAngle);
    }
  }

  _land() {
    // Aggancia a un giro intero: la faccia torna sempre dritta (verso l'alto).
    const turn = Math.PI * 2;
    this.angle = Math.round(this.angle / turn) * turn;
    this._targetAngle = this.angle;
  }

  screenX(cameraX) {
    return this.x - cameraX;
  }

  render(renderer, cameraX) {
    if (this.mode === 'ship') this._renderShip(renderer, cameraX);
    else this._renderCube(renderer, cameraX);
  }

  _renderCube(renderer, cameraX) {
    const ctx = renderer.ctx;
    const half = this.size / 2;
    const cx = this.screenX(cameraX) + half;
    const cy = this.y + half;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    if (this.cubeSkin.ready) {
      // Skin PNG: riempie il quadrato, ruota col cubo.
      ctx.drawImage(this.cubeSkin.img, -half, -half, this.size, this.size);
      if (USE_SKIN_GLOW) this._skinEdge(ctx, -half, -half, this.size, this.size);
    } else {
      // Fallback vettoriale: cubo verde + interno scuro + bordo glow.
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(-half, -half, this.size, this.size);

      const inner = this.size * 0.4;
      ctx.fillStyle = PLAYER_INNER;
      ctx.fillRect(-inner / 2, -inner / 2, inner, inner);

      ctx.shadowColor = GLOW_COLOR;
      ctx.shadowBlur = GLOW_BLUR;
      ctx.strokeStyle = PLAYER_EDGE;
      ctx.lineWidth = 3;
      ctx.strokeRect(-half + 1.5, -half + 1.5, this.size - 3, this.size - 3);
    }

    ctx.restore();
  }

  // Bordo glow attorno alla skin (riquadro luminoso, coerente col tema neon).
  _skinEdge(ctx, x, y, w, h) {
    ctx.shadowColor = GLOW_COLOR;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.strokeStyle = PLAYER_EDGE;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.shadowBlur = 0;
  }

  // Razzo: corpo allungato a freccia, muso a destra, inclinato di pitch.
  _renderShip(renderer, cameraX) {
    const ctx = renderer.ctx;
    const half = this.size / 2;
    const cx = this.screenX(cameraX) + half;
    const cy = this.y + half;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.pitch);

    if (SHIP_IMG.ready) {
      // Skin PNG del razzo: rispetta l'aspect ratio nativo dell'immagine
      // (altezza = size del player, larghezza proporzionale), muso a destra.
      const h = this.size;
      const w = (SHIP_IMG.img.naturalWidth / SHIP_IMG.img.naturalHeight) * h;
      ctx.drawImage(SHIP_IMG.img, -w / 2, -h / 2, w, h);
      if (USE_SKIN_GLOW) this._skinEdge(ctx, -w / 2, -h / 2, w, h);
    } else {
      // Fallback vettoriale: freccia verde con oblò + bordo glow.
      ctx.beginPath();
      ctx.moveTo(half, 0); // muso
      ctx.lineTo(-half, -half * 0.7); // coda alta
      ctx.lineTo(-half * 0.5, 0); // rientro coda
      ctx.lineTo(-half, half * 0.7); // coda bassa
      ctx.closePath();

      ctx.fillStyle = SHIP_COLOR;
      ctx.fill();

      ctx.shadowColor = GLOW_COLOR;
      ctx.shadowBlur = GLOW_BLUR;
      ctx.strokeStyle = PLAYER_EDGE;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = PLAYER_INNER;
      ctx.beginPath();
      ctx.arc(-half * 0.05, 0, half * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

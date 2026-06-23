import { SCROLL_SPEED } from '../config.js';

// =============================================================================
// Camera — scroll orizzontale.
//
// In Geometry Dash il mondo scorre a velocità costante verso sinistra (cioè la
// camera avanza verso destra). La camera espone `x`: l'offset del mondo. In
// fase di render si traslano gli oggetti di -camera.x, così un oggetto a
// world-x = camera.x appare al bordo sinistro dello schermo.
//
// Il player ha X fissa a schermo (PLAYER_X): la sua posizione nel mondo è
// quindi semplicemente camera.x + PLAYER_X.
// =============================================================================
export class Camera {
  constructor() {
    this.speed = SCROLL_SPEED; // velocità di scorrimento (impostabile per livello)
    this.reset();
  }

  // Imposta la velocità di scroll (difficoltà del livello).
  setSpeed(v) {
    this.speed = v;
  }

  reset() {
    this.x = 0;
  }

  update(dt) {
    this.x += this.speed * dt;
  }
}

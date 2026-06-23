// =============================================================================
// Collision — AABB collision detection (Axis-Aligned Bounding Box).
//
// Tutte le box sono nel formato {x, y, w, h} con x,y = angolo in alto a sinistra.
// =============================================================================

// True se le due box si sovrappongono (overlap stretto: i bordi che si toccano
// soltanto NON contano come collisione).
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Profondità di compenetrazione sui due assi (positiva se c'è overlap).
// Serve a capire "da che lato" è avvenuto l'impatto col blocco.
export function overlapDepth(a, b) {
  const ax = a.x + a.w / 2;
  const bx = b.x + b.w / 2;
  const ay = a.y + a.h / 2;
  const by = b.y + b.h / 2;
  const dx = (a.w + b.w) / 2 - Math.abs(ax - bx);
  const dy = (a.h + b.h) / 2 - Math.abs(ay - by);
  return { dx, dy };
}

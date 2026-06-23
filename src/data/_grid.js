// =============================================================================
// _grid — helper condivisi per costruire le mappe dei livelli a SEGMENTI.
// Ogni segmento è un array di 12 stringhe (una per riga), stessa larghezza.
// =============================================================================
export const ROWS = 12;

// Tratto vuoto (solo cielo + pavimento) largo `w`.
export function gap(w) {
  return Array.from({ length: ROWS }, () => '0'.repeat(w));
}

// Concatena orizzontalmente i segmenti (ognuno = array di 12 righe).
export function assemble(...segments) {
  const rows = Array.from({ length: ROWS }, () => '');
  for (const seg of segments) {
    for (let r = 0; r < ROWS; r++) rows[r] += seg[r];
  }
  return rows;
}

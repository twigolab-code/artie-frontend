// =============================================================================
// la — Los Angeles, difficoltà MEDIA. Cubo denso + una sezione ship BREVE.
//
// Legenda (vedi config.js): 0 vuoto, 1 blocco, 2 spuntone, 3 portale-ship,
// 4 portale-cube, 5 orb, 6 spuntone piccolo, 7 spuntone capovolto, 8 pad.
//
// scrollSpeed di riferimento: 480 (medio). Gittata del salto ~4 tile. Densità
// media, gap 2-3 tile. Vincoli: salita ≤1 tile/colonna (gradini, mai muri),
// atterraggi piani dopo i pad, camera libera attorno ai portali.
// Griglia 12 righe: riga 9 = terra, 8 = +1, 7 = +2, 6 = +3. Pavimento 10-11.
// =============================================================================

import { gap, assemble } from './_grid.js';

const start = gap(8);

// Spuntoni a COPPIE (intero + piccolo), gruppi distanziati.
const pairs = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00260000260000260000',
  '00000000000000000000',
  '00000000000000000000',
];

// Scala a gradini con spuntone in cima al pianerottolo.
const stepsSpike = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000020000000000000', // spuntone in cima
  '0000000111100000000000', // +2
  '0000111111110000000000', // +1
  '0011111111111100000000', // base a terra
  '0000000000000000000000',
  '0000000000000000000000',
];

// Pad -> piattaforma alta, poi orb a mezz'aria per allungare il salto.
const padOrb = [
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000011111000000000000', // piattaforma alta (col pad)
  '00000000000000000000000000',
  '00000000000000000005000000', // orb a mezz'aria dopo la piattaforma
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00080000000000000000001110', // pad a terra + piattaforma d'atterraggio
  '00000000000000000000000000',
  '00000000000000000000000000',
];

// Catena di piattaforme sospese con orb di recupero a metà.
const floatChain = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000011100000000000000', // +3
  '0000000111000000005000000000', // +2 + orb
  '0001110000000000000000111000', // +1 inizio e fine
  '0000000000000000000000000000', // vuoto sotto -> salti concatenati
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

// Denti di sega moderati (interi + piccoli alternati con respiro).
const sawteeth = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0026200262002620',
  '0000000000000000',
  '0000000000000000',
];

// --- Sezione SHIP breve e INTRODUTTIVA (varchi ampi) -----------------------
// Imbuto verso SHIP: soffitto a gradini, varco ampio (righe 7-9) col portale.
const funnelShip = [
  '00000000000000', // 0
  '00000000001111', // 1  soffitto che scende dolcemente
  '00000000111111', // 2
  '00000011111111', // 3
  '00000111111111', // 4
  '00001111111111', // 5
  '00001111111111', // 6  chiude appena sopra il varco (lascia righe 7-9)
  '00000000000000', // 7  varco
  '00000000000000', // 8  varco
  '00000000300000', // 9  PORTALE SHIP (basso, all'altezza del cubo)
  '00000000000000', // 10
  '00000000000000', // 11
];

// Volo breve con ostacoli RADI (varchi ampi: versione introduttiva).
const flightEasy = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000700000000070000', // capovolti radi
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000002000000020000000200', // a terra radi
  '000000000000000000000000',
  '000000000000000000000000',
];

// Imbuto verso CUBE: varco ampio con camera libera attorno al portale.
const funnelCube = [
  '0000000000000000000000', // 0
  '0000000011100000011111', // 1  imbocco svasato, poi aperto, poi richiude
  '0000000111000000011111', // 2
  '0000001110000000001111', // 3
  '0000011100000000001111', // 4
  '0000011000000000000111', // 5  varco da qui...
  '0000000000000000000000', // 6  varco (camera libera)
  '0000000000400000000000', // 7  PORTALE CUBE (centro camera libera)
  '0000000000000000000000', // 8  varco
  '0000011000000000000111', // 9  pavimento-blocchi: aperto al centro
  '0000000000000000000000', // 10
  '0000000000000000000000', // 11
];

// --- Assemblaggio (~50s @480) ----------------------------------------------
// --- Monete (tile 9): segmenti dedicati, 1 per moneta, in punti sfidanti. ---
const coinHigh = [ // all'apice del salto (riga 6 = +3)
  '000000', '000000', '000000', '000000', '000000', '000000',
  '000900', '000000', '000000', '000000', '000000', '000000',
];
const coinMid = [ // media quota (riga 7 = +2)
  '000000', '000000', '000000', '000000', '000000', '000000',
  '000000', '000900', '000000', '000000', '000000', '000000',
];
// Moneta in volo (sezione ship): in alto nel corridoio, va presa salendo.
const coinFlight = [
  '00000000', '00000000', '00090000', '00000000', '00000000', '00000000',
  '00000000', '00000000', '00000000', '00000000', '00000000', '00000000',
];

const map = assemble(
  start,
  pairs,
  gap(3),
  coinMid, // moneta 1
  gap(4),
  stepsSpike,
  gap(4),
  padOrb,
  gap(3),
  coinHigh, // moneta 2: in alto dopo il pad
  gap(3),
  floatChain,
  gap(4),
  sawteeth,
  gap(4),
  stepsSpike,
  gap(4),
  // Sezione ship breve introduttiva.
  funnelShip,
  gap(2),
  flightEasy,
  gap(1),
  coinFlight, // moneta 3: in volo, in alto nel corridoio
  gap(1),
  funnelCube,
  gap(4),
  coinHigh, // moneta 4: subito dopo il rientro a cube
  gap(3),
  pairs,
  gap(4),
  padOrb,
  gap(4),
  floatChain,
  gap(4),
  sawteeth,
  gap(3),
  coinMid, // moneta 5: prima del finale
  gap(3),
  stepsSpike,
  gap(4),
  pairs,
  gap(10)
);

export const la = map;

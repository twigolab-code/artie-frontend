// =============================================================================
// metro — Metro, difficoltà DIFFICILE. Tutto l'arsenale: spuntoni fitti,
// orb-chain, sezioni ship lunghe/strette, DOPPIO cambio di modalità.
//
// Legenda (vedi config.js): 0 vuoto, 1 blocco, 2 spuntone, 3 portale-ship,
// 4 portale-cube, 5 orb, 6 spuntone piccolo, 7 spuntone capovolto, 8 pad.
//
// scrollSpeed di riferimento: 560 (alto). Gittata del salto ~5 tile ma ritmo
// serrato: gap 1-2 tile dove serve tensione, sempre clear-abili. Vincoli:
// salita ≤1 tile/colonna (gradini, mai muri), atterraggi piani dopo i pad,
// camera libera attorno a OGNI portale (no morte alla trasformazione).
// Griglia 12 righe: riga 9 = terra, 8 = +1, 7 = +2, 6 = +3. Pavimento 10-11.
// =============================================================================

import { gap, assemble } from './_grid.js';

const start = gap(8);

// Denti di sega FITTI (interi + piccoli alternati, poco respiro).
const sawDense = [
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '026200262002620026', // pattern denso
  '000000000000000000',
  '000000000000000000',
];

// Gradini rapidi su/giù con spuntone in cima (timing stretto).
const stairsSpike = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000200000000000', // spuntone in cima
  '00000001110000000000', // +3
  '00000111111000000000', // +2
  '00011111111100000000', // +1
  '00111111111110000000', // base
  '01111111111111000000', // base estesa (niente vuoti laterali)
  '00000000000000000000',
  '00000000000000000000',
];

// Orb-chain: piattaforme sospese piccole + orb concatenati (salti a mezz'aria).
const orbChain = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000005000005000005000000000', // orb in fila (salti a mezz'aria concatenati)
  '0000000000000000000000000000',
  '0001110000000000000000111000', // piattaforme di partenza/arrivo
  '0000000000000000000000000000',
  '0000000000000000000000000000', // vuoto sotto -> obbligo di usare gli orb
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

// Doppio pad ravvicinato + piattaforme alte (salita aggressiva).
const padClimb = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000001111000000', // piattaforma molto alta (secondo pad)
  '00000000000000000000',
  '00000111100000000000', // piattaforma alta (primo pad)
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00800000080000000000', // due pad
  '00000000000000000000',
  '00000000000000000000',
];

// --- Sezione SHIP #1 (lunga e STRETTA) -------------------------------------
const funnelShip = [
  '00000000000000', // 0
  '00000000011111', // 1  soffitto che scende
  '00000000111111', // 2
  '00000001111111', // 3
  '00000011111111', // 4
  '00000111111111', // 5
  '00000111111111', // 6  chiude sopra il varco (lascia righe 7-9)
  '00000000000000', // 7  varco
  '00000000000000', // 8  varco
  '00000000300000', // 9  PORTALE SHIP
  '00000000000000', // 10
  '00000000000000', // 11
];

// Volo STRETTO: spuntoni a terra + capovolti ravvicinati (corridoio sottile).
const flightTight = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00007000700070007000700070007000', // capovolti fitti
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00020002000200020002000200020002', // a terra fitti
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
];

// Imbuto verso CUBE (camera libera attorno al portale).
const funnelCube = [
  '0000000000000000000000', // 0
  '0000000011100000011111', // 1
  '0000000111000000011111', // 2
  '0000001110000000001111', // 3
  '0000011100000000001111', // 4
  '0000011000000000000111', // 5  varco da qui...
  '0000000000000000000000', // 6  varco (camera libera)
  '0000000000400000000000', // 7  PORTALE CUBE
  '0000000000000000000000', // 8  varco
  '0000011000000000000111', // 9  pavimento-blocchi: aperto al centro
  '0000000000000000000000', // 10
  '0000000000000000000000', // 11
];

// --- Sezione SHIP #2 (secondo cambio di modalità) --------------------------
// Imbuto verso SHIP dal pavimento (soffitto a gradini speculare).
const funnelShip2 = [
  '00000000000000000', // 0
  '00000000000011111', // 1
  '00000000001111111', // 2
  '00000000111111111', // 3
  '00000011111111111', // 4
  '00000111111111111', // 5
  '00000111111111111', // 6  lascia righe 7-9
  '00000000000000000', // 7  varco
  '00000000000000000', // 8  varco
  '00000000030000000', // 9  PORTALE SHIP
  '00000000000000000', // 10
  '00000000000000000', // 11
];

// Volo con varco a SERPENTINA: capovolti e spuntoni sfalsati (richiede su/giù).
const flightZig = [
  '00000000000000000000000000000000',
  '00007000000007000000007000000000', // capovolti dall'alto
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000020000000200000002000000020', // spuntoni a terra sfalsati
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
];

// Ritorno a CUBE.
const funnelCube2 = [
  '0000000000000000000000', // 0
  '0000000011100000011111', // 1
  '0000000111000000011111', // 2
  '0000001110000000001111', // 3
  '0000011100000000001111', // 4
  '0000011000000000000111', // 5
  '0000000000000000000000', // 6
  '0000000000400000000000', // 7  PORTALE CUBE
  '0000000000000000000000', // 8
  '0000011000000000000111', // 9
  '0000000000000000000000', // 10
  '0000000000000000000000', // 11
];

// --- Monete (tile 9): segmenti dedicati, 1 per moneta, in punti SFIDANTI
// (questo è il livello difficile: monete più rischiose ma sempre eque). ---
const coinHigh = [ // all'apice del salto (riga 6 = +3)
  '000000', '000000', '000000', '000000', '000000', '000000',
  '000900', '000000', '000000', '000000', '000000', '000000',
];
// Moneta a fine orb-chain: in alto, raggiungibile usando un orb.
const coinOrb = [
  '00000000', '00000000', '00000000', '00000000', '00009000', '00000000',
  '00000000', '00000000', '00000000', '00000000', '00000000', '00000000',
];
// Moneta in volo ALTA (vicino al soffitto): rischiosa nelle sezioni ship.
const coinFlightHigh = [
  '00000000', '00090000', '00000000', '00000000', '00000000', '00000000',
  '00000000', '00000000', '00000000', '00000000', '00000000', '00000000',
];

// --- Assemblaggio (~65s @560) ----------------------------------------------
const map = assemble(
  start,
  sawDense,
  gap(2),
  coinHigh, // moneta 1
  gap(2),
  stairsSpike,
  gap(3),
  orbChain,
  gap(2),
  coinOrb, // moneta 2: a fine orb-chain, in alto
  gap(2),
  sawDense,
  gap(3),
  padClimb,
  gap(3),
  // Primo cambio di modalità: ship #1 lunga e stretta.
  funnelShip,
  gap(2),
  flightTight,
  gap(1),
  coinFlightHigh, // moneta 3: in volo, vicino al soffitto (rischiosa)
  gap(1),
  funnelCube,
  gap(4),
  // Tratto cubo intermedio impegnativo.
  sawDense,
  gap(3),
  orbChain,
  gap(2),
  coinOrb, // moneta 4: seconda orb-chain
  gap(2),
  stairsSpike,
  gap(3),
  // Secondo cambio di modalità: ship #2 a serpentina.
  funnelShip2,
  gap(2),
  flightZig,
  gap(2),
  funnelCube2,
  gap(4),
  // Terza fase cubo: gran finale denso prima della chiusura.
  sawDense,
  gap(3),
  stairsSpike,
  gap(3),
  orbChain,
  gap(3),
  padClimb,
  gap(2),
  coinHigh, // moneta 5: in alto nel finale
  gap(2),
  sawDense,
  gap(3),
  stairsSpike,
  gap(3),
  orbChain,
  gap(3),
  sawDense,
  gap(3),
  padClimb,
  gap(10)
);

export const metro = map;

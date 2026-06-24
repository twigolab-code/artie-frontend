// =============================================================================
// skyline (City) — Livello 1: il piu FACILE. Verticalita dolce in stile GD:
// scale aeree (gradini +1/+2), un orb, hop su cubi singoli. Razzo SUBITO, breve.
// Densita minima (max 2 hazard a terra contigui), niente pad/tunnel/catene.
//
// Legenda (config.js): 0 vuoto, 1 blocco (ci salti SOPRA; lato/sotto = morte),
// 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 spuntone capovolto (soffitto), 8 pad, 9 moneta, s pavimento spinato.
// Griglia 12 righe; riga 9 = terra; 8 = +1, 7 = +2, 6 = +3 (orb/pad), 5 = +4.
//
// Geometria @630 (engine-verified): salto cubo apice ~2.98 tile, gittata ~5.77;
// atterraggio max +2 tile (piattaforma vicina); +3 solo con orb in salita; pad
// apice ~6.7. Blocco = cella piena a qualsiasi riga (lati/sotto letali) -> torri
// scalabili via gradini. Ship: soffitto schermo (riga 0) = morte; 7 e 2 mai
// sulla stessa colonna; corridoio aperto, righe 0-1 libere.
// =============================================================================
import { gap, assemble } from './_grid.js';

// --- Lead-in + warm-up -----------------------------------------------------
const start = gap(7);

// Warm-up: spuntone piccolo + un blocco 1-tall da scavalcare (1 hazard).
const warmup = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00060000010000',
  '00000000000000',
  '00000000000000',
];

// --- Razzo SUBITO ----------------------------------------------------------
// Portale ship a terra in corsia aperta (nessun soffitto che forzi il cubo).
const funnelShip = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000003000000',
  '00000000000000',
  '00000000000000',
];

const shipEntryBuffer = gap(6);

// Corridoio ship corto e arioso: 7 e 2 sfalsati (mai stessa colonna), righe 0-1
// libere, corridoio righe 3-8 aperto. MONETA 1.
const flightEasy = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000070000000700000007000000', // soffitto 7 a col5, col13, col21
  '0000000000000000000000000000',
  '0000000000009000000000000000', // MONETA 1 (col12) corridoio aperto
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000002000000020000000200', // terra 2 a col9, col17, col25 (sfalsati)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const shipExitBuffer = gap(4);

// Portale cube in camera aperta: sotto vuoto -> caduta a terra sicura.
const funnelCube = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000004000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
];

const postPortalGap = gap(5);

// --- Verticalita a cubo (dolce) --------------------------------------------
// Scala aerea: pilastri solidi a gradini terra->+1->+2, poi discesa +2->+1->terra.
// Si atterra sempre sul TOP di ogni pilastro (lati letali ma si sale a gradini).
// MONETA 2 sopra la cima (+2).
const airStairs = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000009000000000000', // MONETA 2 (col9) sopra la cima +2
  '0000000000000000000000',
  '0000000111100000000000', // +2: cima della scala (col 7-10)
  '0000011111100110000000', // +1: gradino salita (col 5-6) ... e gradino discesa (col 13-14)
  '0011111111100110000000', // terra: base scala (col 2-10) + base gradino discesa
  '0000000000000000000000',
  '0000000000000000000000',
];

const gapA = gap(5);

// Orb + torre 2-tall: orb a riga 7 una colonna prima; si atterra sulla cima (+2)
// o si fa orb per scavalcare. MONETA 3 sull'arco dell'orb.
const orbTower = [
  '00000000000000000',
  '00000000000000000',
  '00000000000000000',
  '00000000000000000',
  '00000000090000000', // MONETA 3 (col8) sull'arco
  '00000000000000000',
  '00000000000000000',
  '00005000000000000', // ORB col4 (riga 7) una colonna prima della torre
  '00000110000000000', // torre cima (col5-6) +2
  '00000110000000000', // torre base a terra
  '00000000000000000',
  '00000000000000000',
];

const gapB = gap(5);

// Hop su 2 cubi singoli (+1) sopra un `s` corto (1 cella). MONETA 4 tra i due.
const singleHops = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000090000000000', // MONETA 4 (col10) sull'arco tra i cubi
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000011000001100000000', // cubo +1 (col5-6), cubo +1 (col12-13)
  '0000011000s01100000000', // base + `s` (col10) sotto il varco
  '0000000000000000000000',
  '0000000000000000000000',
];

const gapC = gap(5);

// Picco gentile: due spuntoni singoli ben distanziati, poi (dopo terra libera)
// una scaletta +1 -> +2 su cui salire. MONETA 5 sopra la cima. Nessuna run > 1.
const gentlePeak = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000009000000', // MONETA 5 (col17) sopra la cima +2
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000111100000', // +2: cima (col15-18)
  '000000000000011111100000', // +1: gradino (col13-14) + corpo
  '000200000200011111100000', // spuntoni (col3,col9) + scaletta a terra (col13-18)
  '000000000000000000000000',
  '000000000000000000000000',
];

const finish = gap(12);

// --- Assemblaggio ----------------------------------------------------------
const map = assemble(
  start,
  warmup,
  gap(4),
  funnelShip, // razzo presto
  shipEntryBuffer,
  flightEasy, // corridoio + MONETA 1
  shipExitBuffer,
  funnelCube,
  postPortalGap,
  airStairs, // scala aerea + MONETA 2
  gapA,
  orbTower, // orb + torre + MONETA 3
  gapB,
  singleHops, // hop su cubi singoli + MONETA 4
  gapC,
  gentlePeak, // picco gentile + MONETA 5
  finish
);

export const skyline = map;

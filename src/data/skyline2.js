// =============================================================================
// skyline2 (Los Angeles) — Livello 3: MEDIO. Firma: catene di piattaforme aeree
// + PRIMO TUNNEL (soffitto di blocchi sotto cui si corre) + PAD. La verticalita a
// cubo apre il livello; la sezione ship sta a META. Fino a 3 hazard contigui.
// Export `skyline2`.
//
// Legenda (config.js): 0 vuoto, 1 blocco (top=appoggio; lato/sotto=morte),
// 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 soffitto, 8 pad, 9 moneta, s pavimento spinato.
// Righe: 9=terra, 8=+1, 7=+2 (max salto piano), 6=+3 (orb/pad), 5=+4 (pad).
// Geometria @630: salto apice ~2.98, gittata ~5.77; pad apice ~6.7. Tunnel:
// soffitto a righe 2-3 lascia headroom (un salto arriva a ~riga6, sotto il soffitto).
// =============================================================================
import { gap, assemble } from './_grid.js';

const start = gap(7);

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
  '00060000020000',
  '00000000000000',
  '00000000000000',
];

const gap0 = gap(4);

// --- Verticalita a cubo: catena aerea ascendente ---------------------------
// terra->+1->+2->+1->terra, `s` corto sotto ogni varco. MONETA 1 sull'arco al +2.
const chainLA = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000009000000000000000', // MONETA 1 (col12)
  '0000000000000000000000000000',
  '0000000000111000000000000000', // +2 (col10-12)
  '0000000111000000111000000000', // +1 (col7-9) e +1 (col15-17)
  '0011100000s00000s00000111000', // terra (col2-4) + `s` corti (col10,16) + terra (col22-24)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const gapA = gap(5);

// --- Primo TUNNEL ----------------------------------------------------------
// Soffitto di blocchi a righe 2-3; headroom righe 4-9. Spuntoni a terra distanziati
// (saltini corti, mai contro il soffitto). MONETA 2 sotto il soffitto.
const tunnel1 = [
  '000000000000000000000000',
  '000000000000000000000000',
  '011111111111111111110000', // soffitto (righe 2-3) col1-19
  '011111111111111111110000',
  '000000000000000000000000', // headroom righe 4-9
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000009000000000000', // MONETA 2 (col10) sotto il soffitto
  '000000000000000000000000',
  '000000200000020000200000', // spuntoni a terra distanziati (col6,13,18)
  '000000000000000000000000',
  '000000000000000000000000',
];

const gapB = gap(5);

// --- Ship a META -----------------------------------------------------------
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

// Corridoio ship: 7 e 2 sfalsati, righe 0-1 libere. MONETA 3.
const flightMid = [
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000007000070000700007000070000', // soffitto col5,10,15,20,25
  '000000000000000000000000000000',
  '000000000000009000000000000000', // MONETA 3 (col13)
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000020000200002000020000200000', // terra col3,8,13,18,23 (sfalsati vs soffitto)
  '000000000000000000000000000000',
  '000000000000000000000000000000',
];

const shipExitBuffer = gap(4);

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

// --- PAD verso piattaforma alta --------------------------------------------
// Pad lancia (apice ~6.7) su piattaforma +4 larga (riga5). MONETA 4 sopra. Poi
// discesa a gradini +2 -> +1 -> terra.
const padJump = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000009000000000000000000', // MONETA 4 sopra la piattaforma alta
  '0000000011111000000000000000', // piattaforma +4 (col8-12) via pad
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000011110000000', // piattaforma +2 (col16-19) atterraggio in discesa
  '0000000000000000000000000000',
  '0008000000000000000000011000', // PAD col3; gradino +1 (col24-25)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const gapC = gap(5);

// Picco: orb + torre + terzine 626/226 (gap >=2 -> max 3 contigui). MONETA 5 sull'arco.
const peakLA = [
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000900000000000000000000', // MONETA 5 (col5) sull'arco dell'orb
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000500000000000000000000', // ORB col5 (riga 7)
  '00000011000000000000000000', // torre cima (col6-7)
  '00000011000626000226000000', // base torre + terzine (gap >=2 tra i gruppi)
  '00000000000000000000000000',
  '00000000000000000000000000',
];

const finish = gap(12);

const map = assemble(
  start,
  warmup,
  gap0,
  chainLA, // MONETA 1
  gapA,
  tunnel1, // MONETA 2
  gapB,
  funnelShip, // ship a meta
  shipEntryBuffer,
  flightMid, // MONETA 3
  shipExitBuffer,
  funnelCube,
  postPortalGap,
  padJump, // MONETA 4
  gapC,
  peakLA, // MONETA 5
  finish
);

export const skyline2 = map;

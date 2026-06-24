// =============================================================================
// carwash (Car Wash) — Livello 2: FACILE-MEDIO. Firma: "tower hopping" — torri
// a gradini di altezza crescente, hop tra le cime delle torri e su cubi singoli.
// Razzo ancora presto (corridoio un po' piu lungo + un pinch). Fino a 3 hazard
// a terra contigui. Export `carwash`.
//
// Legenda (config.js): 0 vuoto, 1 blocco (top=appoggio; lato/sotto=morte),
// 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 soffitto, 8 pad, 9 moneta, s pavimento spinato.
// Righe: 9=terra, 8=+1, 7=+2 (max salto piano), 6=+3 (orb/pad).
// Geometria @630: salto apice ~2.98, gittata ~5.77; torri scalabili via gradini.
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
  '00060000020000', // spuntone piccolo + spuntone (2 ostacoli distanziati)
  '00000000000000',
  '00000000000000',
];

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

// Corridoio ship piu lungo: 7 e 2 piu fitti ma sempre sfalsati, righe 0-1 libere.
// MONETA 1.
const flightMed = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000700007000070000700007000000', // soffitto 7 col5,10,15,20,25
  '00000000000000000000000000000000',
  '00000000000009000000000000000000', // MONETA 1 (col13)
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00002000020000200002000020000000', // terra 2 col4,9,14,19,24 (sfalsati)
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
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

// Torri a gradini: scala terra->+1->+2 (cima torre 1), gap, torre 2 (+2) raggiunta
// con un gradino +1, gap, cubo singolo +1. Hop tra le cime. MONETA 2 sulla torre 1.
const towerSteps = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000009000000000000000', // MONETA 2 (col8) sopra la cima torre 1
  '000000000000000000000000',
  '000000111000001100000000', // +2: cima torre1 (col6-8), cima torre2 (col14-15)
  '000001111000011100000000', // +1: gradino torre1 (col5) , gradino torre2 (col13)
  '000001111000011100110000', // corpo torri + cubo singolo +1 (col18-19)
  '001111111000011100110000', // base torri a terra + base cubo
  '000000000000000000000000',
  '000000000000000000000000',
];

const gapA = gap(5);

// Orb verso torre +3 (orb in salita). Si lancia dal blocco a terra, orb a riga 6,
// si atterra sulla cima +3. MONETA 3 alta sull'arco.
const orbTower3 = [
  '000000000000000000',
  '000000000000000000',
  '000000000000000000',
  '000000009000000000', // MONETA 3 (col8) alta sull'arco dell'orb
  '000000000000000000',
  '000000001110000000', // +3: cima torre (col7-9)
  '000050001110000000', // ORB col4 (riga 6) in salita + corpo torre
  '000000001110000000',
  '000000001110000000', // corpo torre (lati letali -> si sale con l'orb)
  '001110001110000000', // blocco di lancio a terra (col2-4) + base torre
  '000000000000000000',
  '000000000000000000',
];

const gapB = gap(5);

// Catena di 3 cubi singoli a quote alternate +1/+2/+1, `s` corto sotto ogni varco.
// MONETA 4 e MONETA 5 sugli archi.
const hops3 = [
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000090000000009000000', // MONETA 4 (col8), MONETA 5 (col18)
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000011100000000000000', // cubo centrale +2 (col9-11)
  '00000110000000110000110000', // cubo +1 (col5-6), +1 (col14-15), +1 (col20-21)
  '00000110s00110110s00110000', // basi + `s` corti sotto i varchi
  '00000000000000000000000000',
  '00000000000000000000000000',
];

const gapC = gap(5);

// Picco: due spuntoni piccoli ben distanziati, poi (dopo ampia terra libera) una
// scaletta +1 -> +2 e ridiscesa. Niente monete (cap 5).
const peak = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000011000000', // +2: cima (col20-21)
  '0000000000000000001111000000', // +1: gradino (col18-19) + cima
  '0006000060000000001111000000', // spuntoni (col3,col8) + scaletta a terra (col18-21)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const finish = gap(12);

const map = assemble(
  start,
  warmup,
  gap(4),
  funnelShip,
  shipEntryBuffer,
  flightMed, // MONETA 1
  shipExitBuffer,
  funnelCube,
  postPortalGap,
  towerSteps, // MONETA 2
  gapA,
  orbTower3, // MONETA 3
  gapB,
  hops3, // MONETA 4 + 5
  gapC,
  peak,
  finish
);

export const carwash = map;

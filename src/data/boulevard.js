// =============================================================================
// boulevard (Boulevard) — Livello 4: DIFFICILE. Firma: CATENA DI 2 ORB in salita
// + TORRI ALTE (3-tall) scalate via scala + tunnel piu lungo. La verticalita a
// cubo domina; la sezione ship arriva TARDI ed e piu densa. Fino a 4 hazard
// contigui (una volta). Export `boulevard`.
//
// Legenda (config.js): 0 vuoto, 1 blocco (top=appoggio; lato/sotto=morte),
// 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 soffitto, 8 pad, 9 moneta, s pavimento spinato.
// Righe: 9=terra, 8=+1, 7=+2, 6=+3, 5=+4, 4=+5. Geometria @630: salto apice
// ~2.98; orb = salto fresco (si concatenano); pad apice ~6.7. Torri scalate via
// scala (mai contro il lato). Tunnel: soffitto alto, headroom sotto.
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
  '00060002000600', // tre ostacoli distanziati (warm-up un filo piu carico)
  '00000000000000',
  '00000000000000',
];

const gap0 = gap(4);

// --- CATENA DI 2 ORB in salita ---------------------------------------------
// Lancio dal blocco a terra; ORB1 (riga 7) sull'arco -> salto fresco; ORB2 (riga 5)
// piu in alto -> si atterra sulla piattaforma +4 (riga5). MONETA 1 sulla salita.
// Sotto e tutto vuoto: si sale solo con gli orb (nessun lato letale da rasentare).
const orbChain = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000009000000000000', // MONETA 1 (col9) alta sulla catena
  '0000000000000000000000',
  '0000000050011110000000', // ORB2 (col8, riga5) + piattaforma +4 (col11-14)
  '0000000000000000000000',
  '0000050000000000000000', // ORB1 (col5, riga7) sull'arco del primo salto
  '0000000000000000000000',
  '0011100000000000111000', // blocco di lancio (col2-4) + atterraggio a terra (col16-18)
  '0000000000000000000000',
  '0000000000000000000000',
];

const gapA = gap(5);

// --- TORRI ALTE (3-tall) scalate via scala ---------------------------------
// Scala +1 -> +2 -> +3 (cima torre alta), poi hop su 2 cubi singoli +2 e discesa.
// La torre si scala SOLO dalla scala a sinistra (lato destro letale finche' non sei
// in cima). MONETA 2 sopra la cima.
const tallTowers = [
  '00000000000000000000000000', // riga 0
  '00000000000000000000000000', // riga 1
  '00000000000000000000000000', // riga 2
  '00000000000000000000000000', // riga 3
  '00000009000000000000000000', // riga 4: MONETA 2 (col8) sopra la cima +3
  '00000000000000000000000000', // riga 5
  '00000001110000000000000000', // riga 6 (+3): cima torre (col6-8) da percorrere
  '00000011110000110000110000', // riga 7 (+2): ledge col5 + corpo + cubi aerei (col13-14,18-19)
  '00000011110000000000000000', // riga 8 (+1): ledge col5 + corpo torre
  '00000011110000000000000000', // riga 9 (terra): base torre (col5-8), scala da sinistra
  '00000000000000000000000000', // riga 10
  '00000000000000000000000000', // riga 11
];

const gapB = gap(5);

// --- TUNNEL piu lungo ------------------------------------------------------
// Soffitto righe 1-3; headroom righe 4-9. Spuntoni a terra distanziati (saltini
// corti sicuri). MONETA 3 sotto il soffitto.
const tunnel2 = [
  '000000000000000000000000000000',
  '011111111111111111111111110000', // soffitto righe 1-3 col1-25
  '011111111111111111111111110000',
  '011111111111111111111111110000',
  '000000000000000000000000000000', // headroom righe 4-9
  '000000000000000000000000000000',
  '000000000000090000000000000000', // MONETA 3 (col13) sotto il soffitto
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000002000020000200002000020000', // spuntoni a terra distanziati
  '000000000000000000000000000000',
  '000000000000000000000000000000',
];

const gapC = gap(5);

// --- Ship TARDI e piu densa ------------------------------------------------
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

const shipEntryBuffer = gap(5);

// Corridoio ship piu denso: coppie di 7 e 2, sfalsate (mai stessa colonna),
// righe 0-1 libere. MONETA 4.
const flightHard = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000770000770000770000770000000', // soffitto coppie col5-6,11-12,17-18,23-24
  '00000000000000000000000000000000',
  '00000000000000900000000000000000', // MONETA 4 (col14)
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00220000220000220000220000220000', // terra coppie col2-3,8-9,14-15,20-21,26-27 (sfalsate)
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

// --- PAD verso +5 + discesa + terzina densa (max 4 contigui, una volta) ------
// Pad lancia su piattaforma +5 (riga4). MONETA 5 all'apice. Poi discesa su
// piattaforma +2, e infine una terzina 2262 (4 contigui) saltata da terra piana
// (gittata ~5.77 > 4) con atterraggio su terra libera.
const padPeak = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000900000000000000000000', // MONETA 5 (col7) all'apice del pad
  '0000001111000000000000000000', // piattaforma +5 (col6-9) via pad
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000011110000000', // piattaforma +2 (col17-20) atterraggio in discesa
  '0000000000000000000000000000',
  '0008000000000000000002262000', // PAD col3 ; terzina 2262 (col21-24, 4 contigui)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const finish = gap(12);

const map = assemble(
  start,
  warmup,
  gap0,
  orbChain, // MONETA 1
  gapA,
  tallTowers, // MONETA 2
  gapB,
  tunnel2, // MONETA 3
  gapC,
  funnelShip, // ship tardi
  shipEntryBuffer,
  flightHard, // MONETA 4
  shipExitBuffer,
  funnelCube,
  postPortalGap,
  padPeak, // MONETA 5
  finish
);

export const boulevard = map;

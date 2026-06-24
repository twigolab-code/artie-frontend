// =============================================================================
// metro2 (Metro) — Livello 5: il piu DIFFICILE. Firma: "tutto insieme" — catena
// di 3 orb, pad verso torre +5, hop su cubi aerei, spike fitti a 4 contigui
// (delimitati da blocchi d'appoggio), tunnel lungo, e la sezione SHIP come
// finale lungo e teso. Densita e verticalita massime. Export `metro2`.
//
// Legenda (config.js): 0 vuoto, 1 blocco (top=appoggio; lato/sotto=morte),
// 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 soffitto, 8 pad, 9 moneta, s pavimento spinato.
// Righe: 9=terra, 8=+1, 7=+2, 6=+3, 5=+4, 4=+5. Geometria @630: salto apice
// ~2.98; orb = salto fresco (si concatenano per salire alto); pad apice ~6.7.
// Cubi aerei a riga 7 (+2) hanno il vuoto sotto -> ci si corre sotto a terra,
// si salta SOPRA per l'hop (lato/sotto letali solo se ci sbatti dall'aria).
// =============================================================================
import { gap, assemble } from './_grid.js';

const start = gap(6);

// Warm-up un filo piu carico (3 ostacoli).
const warmupHard = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00060020006000',
  '00000000000000',
  '00000000000000',
];

const gap0 = gap(3);

// --- CATENA DI 3 ORB (+2 -> +3 -> +4) --------------------------------------
// Lancio dal blocco a terra; ORB1 (riga7) -> ORB2 (riga6) -> ORB3 (riga5) ->
// piattaforma +4 (riga5). MONETA 1 in cima. Sotto vuoto (si sale solo con gli orb).
const orbStair = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000900000000000', // MONETA 1 (col12) in cima alla catena
  '000000000005111100000000', // ORB3 (col10, riga3... vicino) + piattaforma +4 (col11-14)
  '000000000000000000000000',
  '000000005000000000000000', // ORB2 (col8, riga5)
  '000000000000000000000000',
  '000005000000000000000000', // ORB1 (col5, riga7) sull'arco del primo salto
  '000000000000000000000000',
  '001110000000000000111000', // blocco lancio (col2-4) + atterraggio a terra (col16-18)
  '000000000000000000000000',
  '000000000000000000000000',
];

const gapA = gap(5);

// --- PAD verso piattaforma +6 + hop su cubi aerei +3 ------------------------
// Pad lancia (apice ~6.7) su piattaforma +6 (riga3). MONETA 2 all'apice. Discesa
// su cubi aerei +3 (riga6) ravvicinati (gap <=5, salto piano). MONETA 3 sul 2°.
// I cubi aerei hanno il vuoto sotto -> a terra ci si corre sotto in sicurezza.
const padTower = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000900000000000000000000', // MONETA 2 (col7) all'apice del pad
  '0000001111000000000000000000', // piattaforma +6 (col6-9) via pad (apice ~6.7)
  '0000000000000000000000000000',
  '0000000000000000009000000000', // MONETA 3 (col17) sopra il 2° cubo aereo
  '0000000000001110001110000000', // cubi aerei +3 (col12-14) e (col17-19) gap 3
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0008000000000000000000000000', // PAD col3
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const gapB = gap(5);

// --- Spike fitti a 4 contigui su terra piana --------------------------------
// Terzine 2262 (4 contigui = il cap) separate da terra LIBERA (>=4 tile) per
// atterrare e ri-saltare. Ogni salto clear di 4 spike (gittata ~5.77 > 4),
// atterraggio su terra piana (mai blocchi nel percorso a terra). MONETA 4 in volo.
const spikeDense = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000009000000000000', // MONETA 4 (col15) sull'arco di un salto
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0002262000002262000002262000', // 2262 | terra | 2262 | terra | 2262
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

const gapC = gap(5);

// --- Tunnel lungo ----------------------------------------------------------
// Soffitto righe 2-4; headroom righe 5-9. Spuntoni a terra distanziati (saltini
// corti sicuri, mai contro il soffitto).
const tunnelLong = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0111111111111111111000', // soffitto righe 2-4 col1-18
  '0111111111111111111000',
  '0111111111111111111000',
  '0000000000000000000000', // headroom righe 5-9
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000200002000020000200', // spuntoni a terra distanziati
  '0000000000000000000000',
  '0000000000000000000000',
];

const gapD = gap(5);

// --- SHIP FINALE -----------------------------------------------------------
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

const shipEntryBuffer = gap(4);

// Corridoio ship finale lungo e teso: 7 e 2 fitti e sfalsati (mai stessa colonna),
// due blocchi nel corridoio aperto da schivare, righe 0-1 SEMPRE libere. MONETA 5.
const flightFinale = [
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
  '000007000070000700007000070000700000', // soffitto 7 sfalsati
  '000000000000000000000000000000000000',
  '000000000111000000000000000000000000', // blocco da schivare (col9-11, riga4) — aperto sopra/sotto
  '000000000000000900000000000000000000', // MONETA 5 (col15)
  '000000000000000000000000000000000000',
  '000000000000000000111000000000000000', // blocco da schivare (col18-20, riga7)
  '000000000000000000000000000000000000',
  '000020000200002000020000200002000000', // terra 2 sfalsati vs soffitto
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
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

const finish = gap(12);

const map = assemble(
  start,
  warmupHard,
  gap0,
  orbStair, // MONETA 1
  gapA,
  padTower, // MONETA 2 + 3
  gapB,
  spikeDense, // MONETA 4
  gapC,
  tunnelLong,
  gapD,
  funnelShip, // ship finale
  shipEntryBuffer,
  flightFinale, // MONETA 5
  shipExitBuffer,
  funnelCube,
  finish
);

export const metro2 = map;

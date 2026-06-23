// =============================================================================
// skyline2 — Livello 5: copia IDENTICA di skyline (livello 4) da modificare.
// Stessa geometria verificata @585; export `skyline2`. Le modifiche al gameplay
// vanno fatte qui, lasciando skyline (livello 4) intatto.
// -----------------------------------------------------------------------------
// skyline — livello MEDIO costruito a SEGMENTI sulla geometria verificata @585
// (vedi level2.js): salto cubo apice ~2.8 tile / gittata ~5.2; orb = salto
// fresco a mezz'aria (orb a riga 7); pad apice ~6.4 / gittata ~8; pavimento
// spinato `s` a riga 9 tra blocchi d'appoggio.
//
// Legenda (vedi config.js): 0 vuoto, 1 blocco (ci salti SOPRA; lato/sotto =
// morte), 2 spuntone, 3 portale-ship, 4 portale-cube, 5 orb, 6 spuntone piccolo,
// 7 spuntone capovolto (soffitto), 8 pad, 9 moneta, s pavimento spinato.
//
// Griglia 12 righe (riga 0 in alto). Pavimento render = righe 10-11. Ostacoli e
// piattaforme "a terra" sulla RIGA 9. Quote: 9 = terra, 8 = +1, 7 = +2, 6 = +3.
//
// REGOLE skyline (piu rigide del default): MAX 3 ostacoli a terra contigui
// (2/6/s) per ogni salto; pavimento spinato CORTO (1-2 celle) e frequente tra
// blocchi/piattaforme; sviluppo VERTICALE con blocchi e piattaforme in aria su
// cui saltare (righe 8 = +1, 7 = +2, raggiungibili; +3 solo con orb/pad).
//
// CURVA: lead-in -> riscaldamento -> scala aerea -> orb -> hop su blocchi sopra
// spinato -> pad+piattaforma -> catena di piattaforme aeree -> spinato frequente
// -> sezione ship -> rientro orb+blocco -> picco (<=3 contigui) -> cool-down.
// 5 monete opzionali (cap motore COINS_PER_LEVEL = 5).
// =============================================================================
import { gap, assemble } from './_grid.js';

// --- Segmenti --------------------------------------------------------------

// (1) Lead-in sicuro: qualche tile pulita prima del primo ostacolo.
const start = gap(8);

// (2) Riscaldamento: spuntoni singoli distanziati + un blocco 1-tall da
// scavalcare. Insegna il timing del salto.
const warmup = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000200000600000100000200', // spuntone, piccolo, blocco (hop), spuntone
  '000000000000000000000000',
  '000000000000000000000000',
];

// (3) NUOVO — Scala AEREA: blocco a terra -> +1 -> +2, poi corsa piatta in aria
// (si salta di blocco in blocco) e ridiscesa a gradino. Sviluppo verticale.
// MONETA 1 sulla cima della corsa aerea (+2). Ogni gradino <=2 e <=5 di distanza.
const airStairs = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000090000000000', // MONETA 1 sopra la corsa aerea (riga 6, +3 sull'arco)
  '0000000011111000000000', // +2: corsa aerea piatta (col 8-12)
  '0000011100000011000000', // +1: gradino di salita (col 5-7) e di discesa (col 14-15)
  '0011100000000000111000', // terra: blocco di partenza (col 2-4) e d'arrivo (col 16-18)
  '0000000000000000000000',
  '0000000000000000000000',
];

// (4) ORB: torre di 2 blocchi con orb a riga 7 una colonna prima. Si salta + orb
// per scavalcare (oppure si atterra sulla cima a +2). MONETA 2 sull'arco dell'orb.
const orbIntro = [
  '00000000000000000',
  '00000000000000000',
  '00000000000000000',
  '00000000000000000',
  '00000000090000000', // MONETA 2 (col 8) sull'apice dell'orb
  '00000000000000000',
  '00000000000000000',
  '00005000000000000', // ORB col 4, riga 7 (una colonna prima della faccia)
  '00000110000000000', // torre 2-tall, cima (col 5-6)
  '00000110000000000', // base a terra
  '00000000000000000',
  '00000000000000000',
];

// (5) NUOVO — Hop su BLOCCHI sopra pavimento spinato CORTO: coppie di blocchi
// 2-wide (cima d'appoggio +1) separate da una sola cella di `s` a terra. Il cubo
// salta di blocco in blocco; cadere corto = spinato. Distanze cima-cima ~3 tile.
const blockHopSpikes = [
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0011000110001100011', // cime d'appoggio +1 (coppie di blocchi)
  '0011s0011s0011s0011', // base + 1 cella `s` tra le coppie (corto e frequente)
  '0000000000000000000',
  '0000000000000000000',
];

// (6) PAD verso piattaforma alta e larga (+4, solo col pad). MONETA 3 sopra. Poi
// una piattaforma aerea piu bassa (+2) su cui atterrare in discesa, e un gradino.
const padIntro = [
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000009000000000000000000', // MONETA 3 sopra la piattaforma alta
  '0000000011111000000000000000', // piattaforma alta e larga (+4: col pad)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
  '0000000000000000011110000000', // piattaforma aerea +2 (atterraggio in discesa)
  '0000000000000000000000000000',
  '0008000000000000000000011000', // PAD col 3; gradino d'arrivo (col 24-25)
  '0000000000000000000000000000',
  '0000000000000000000000000000',
];

// (7) NUOVO — Catena di PIATTAFORME AEREE: piattaforme a +1/+2 con UNA cella di
// `s` a terra sotto i varchi (un salto corto = spinato). Si salta di piattaforma
// in piattaforma. MONETA 4 a meta catena, sull'arco tra due piattaforme.
const floatChain = [
  '0000000000000000000000000',
  '0000000000000000000000000',
  '0000000000000000000000000',
  '0000000000000000000000000',
  '0000000000009000000000000', // MONETA 4 a meta catena (riga 4)
  '0000000000000000000000000',
  '0000000000000000000000000',
  '0000000011100000011100000', // piattaforme +2 (col 8-10, col 17-19)
  '0011100000000000000000111', // piattaforme +1 (ingresso col 2-4, uscita col 22-24)
  '0000000s00000s00000s00000', // `s` corti a terra sotto i varchi (1 cella)
  '0000000000000000000000000',
  '0000000000000000000000000',
];

// (8) Spinato FREQUENTE: blocchi singoli a terra separati da `s` corti (1 cella).
// Il cubo continua a saltare blocco -> oltre `s` -> blocco. Max 1 `s` contiguo.
const spikeHops = [
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0000000000000000000',
  '0010s0010s0010s0010', // blocco, s, blocco, ... (s corto e frequente)
  '0000000000000000000',
  '0000000000000000000',
];

// (9a) Imbuto verso SHIP: soffitto a gradini che incanala il cubo nel portale (3)
// all'altezza del terreno (riusato dal design verificato di level2).
const funnelShip = [
  '00000000000000',
  '00000000011111',
  '00000000111111',
  '00000001111111',
  '00000011111111',
  '00000111111111',
  '00000111111111',
  '00000000000000',
  '00000000000000',
  '00000000300000', // PORTALE SHIP
  '00000000000000',
  '00000000000000',
];

// (9b) Tunnel ship: spuntoni a soffitto (7) e a terra (2) RADI e SFALSATI, mai
// affacciati -> corridoio centrale sempre aperto. MONETA 5 a mezza altezza in
// spazio libero. Buffer iniziale e finale senza ostacoli. Allungato per durata.
const flight = [
  '000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000',
  '000007000000000007000000000000007000000000', // spuntoni a soffitto (radi)
  '000000000000000000000000000000000000000000',
  '000000000000009000000000000000000000000000', // MONETA 5 (riga 4) corridoio aperto
  '000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000',
  '000000020000000000020000000000200000000000', // spuntoni a terra (radi, sfalsati)
  '000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000',
];

// (9c) Imbuto verso CUBE: camera libera attorno al portale (4) cosi la
// trasformazione avviene nello spazio aperto (riusato dal design verificato).
const funnelCube = [
  '0000000000000000000000',
  '0000000011100000011111',
  '0000000111000000011111',
  '0000001110000000001111',
  '0000011100000000001111',
  '0000011000000000000111',
  '0000000000000000000000',
  '0000000000400000000000', // PORTALE CUBE
  '0000000000000000000000',
  '0000011000000000000111',
  '0000000000000000000000',
  '0000000000000000000000',
];

// (10) NUOVO — Rientro: orb a riga 7 che porta su un blocco aereo (+2) su cui
// atterrare, poi gradino di discesa. Riprende il flusso a cube con verticalita.
const returnCombo = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00005000011100000000', // ORB col 4 (riga 7) -> blocco aereo +2 (col 9-11)
  '00000000000000110000', // gradino +1 di discesa (col 14-15)
  '00000000000000000000', // sotto e vuoto: si salta dall'orb al blocco aereo
  '00000000000000000000',
  '00000000000000000000',
];

// (11) PICCO (<=3 contigui): torre+orb, poi campo jagged ricostruito in TERZINE
// (626 / 226) separate da varchi >=2 tile. Nessuna run supera 3. Combo serrata
// ma leale; nessuna moneta qui (cap 5 gia raggiunto).
const peakCombo = [
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000500000000000000000000', // ORB col 5 (riga 7) prima della torre
  '00000011000000000000000000', // torre 2-tall, faccia sx col 6
  '00000011000626000226000000', // base torre + terzine (varchi >=2 tra i gruppi)
  '00000000000000000000000000',
  '00000000000000000000000000',
];

// (12) Cool-down: due spuntoni singoli distanziati (un salto comodo ciascuno),
// poi finale pulito senza ostacoli.
const cooldown = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00002000000020000000', // due spuntoni singoli distanziati
  '00000000000000000000',
  '00000000000000000000',
];

// --- Assemblaggio ----------------------------------------------------------
const map = assemble(
  start,
  warmup,
  gap(5),
  airStairs,
  gap(5),
  orbIntro,
  gap(5),
  blockHopSpikes,
  gap(5),
  padIntro,
  gap(5),
  floatChain,
  gap(5),
  spikeHops,
  gap(5),
  funnelShip,
  gap(2),
  flight,
  gap(2),
  funnelCube,
  gap(5),
  returnCombo,
  gap(5),
  peakCombo,
  gap(5),
  cooldown,
  gap(10)
);

export const skyline2 = map;

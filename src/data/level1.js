// =============================================================================
// level1 — primo livello come griglia di tile.
//
// Legenda:
//   0 = vuoto
//   1 = blocco solido      (ci salti SOPRA; lato/sotto = morte) -> piattaforme
//   2 = spuntone intero    (morte)
//   3 = portale-ship       (entri -> razzo, sfondo magenta)
//   4 = portale-cube       (entri -> cubo, sfondo viola)
//   5 = orb                (tocchi + premi -> salto a mezz'aria)
//   6 = spuntone piccolo   (mezza altezza, morte)
//   7 = spuntone capovolto (appeso al soffitto, punta giù, morte)
//   8 = jump pad           (balzo automatico potente al contatto)
//
// Griglia 12 righe (riga 0 in alto). Pavimento = righe 10-11. Ostacoli e
// piattaforme "a terra" sulla RIGA 9. Quote: riga 9 = terra, 8 = +1 tile,
// 7 = +2, 6 = +3 (salto da terra ~3 tile, gittata ~4 tile).
//
// REGOLA DI GIOCABILITÀ: i dislivelli a terra salgono di UN tile per volta
// (gradini), mai muri verticali alti (che ucciderebbero per impatto laterale).
//
// Costruzione per SEGMENTI concatenati: ogni segmento = 12 stringhe (una per
// riga) della stessa larghezza. assemble() li unisce colonna-per-colonna.
// =============================================================================

import { gap, assemble } from './_grid.js';

// --- Segmenti --------------------------------------------------------------

const start = gap(10);

// Spuntoni singoli a terra, ben distanziati (un salto ciascuno).
const spikesEasy = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0002000020000600', // spuntoni distanziati
  '0000000000000000',
  '0000000000000000',
];

// Scala a gradini SINGOLI: sale 1 tile alla volta su colonne consecutive,
// poi ridiscende. Nessun muro: ogni gradino è scavalcabile con un salto.
const stepsUp = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000011110000000000', // +3 (cima, pianerottolo largo)
  '0000001111111000000000', // +2
  '0000111111111100000000', // +1
  '0011111111111111000000', // base a terra (gradoni pieni sotto -> niente vuoti)
  '0000000000000000000000',
  '0000000000000000000000',
];

// Pad che lancia su una piattaforma sospesa, poi atterraggio piano.
const padJump = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000011111000000', // piattaforma alta (+4: raggiungibile col pad)
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00080000000000000000', // pad a terra
  '00000000000000000000',
  '00000000000000000000',
];

// Piattaforme sospese a sequenza (salti concatenati). Bordi sinistri
// raggiungibili: ogni piattaforma è +1/+2 tile e a 3-4 tile dalla precedente.
const floatChain = [
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000000000000000000',
  '00000000000001110000000000', // piattaforma +3
  '00000001110000000000000000', // piattaforma +2
  '00011100000000000001110000', // piattaforme +1 (inizio e fine)
  '00000000000000000000000000', // sotto è il VUOTO -> si salta da piattaforma a piattaforma
  '00000000000000000000000000',
  '00000000000000000000000000',
];

// Denti di sega: spuntoni interi + piccoli ravvicinati a terra, con respiro.
const sawteeth = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00260026002600', // gruppi piccoli (atterraggio piano tra i gruppi)
  '00000000000000',
  '00000000000000',
];

// Imbuto verso SHIP (cube->ship): soffitto a gradini che impedisce di saltare
// oltre; varco ampio (righe 7-9) dove transita il cubo, col portale (3).
// Nessun blocco a terra davanti (no morte laterale). 14 colonne.
const funnelShip = [
  '00000000000000', // 0
  '00000000001111', // 1  soffitto che scende dolcemente...
  '00000000111111', // 2
  '00000011111111', // 3
  '00000111111111', // 4
  '00001111111111', // 5
  '00001111111111', // 6  chiude appena sopra il varco (lascia righe 7-9)
  '00000000000000', // 7  varco
  '00000000000000', // 8  varco
  '00000000300000', // 9  PORTALE SHIP (basso, all'altezza del cubo a terra)
  '00000000000000', // 10
  '00000000000000', // 11
];

// Imbuto verso CUBE (ship->cube): corridoio in volo con imbocco SVASATO che si
// stringe verso un varco AMPIO (righe 5-8, 4 tile) con una "camera" libera
// attorno al portale: nelle colonne centrali (portale + adiacenti) NON ci sono
// blocchi né sopra né sotto, così razzo e neo-cubo non toccano pareti
// nell'istante della trasformazione (no morte). I blocchi incanalano solo
// prima e dopo, lasciando il portale come passaggio obbligato. 22 colonne.
const funnelCube = [
  '0000000000000000000000', // 0
  '0000000011100000011111', // 1  soffitto: imbocco svasato, poi APERTO al centro, poi richiude
  '0000000111000000011111', // 2
  '0000001110000000001111', // 3
  '0000011100000000001111', // 4
  '0000011000000000000111', // 5  varco da qui...
  '0000000000000000000000', // 6  varco (camera libera)
  '0000000000400000000000', // 7  PORTALE CUBE (centro camera libera)
  '0000000000000000000000', // 8  varco
  '0000011000000000000111', // 9  pavimento-blocchi: svasato, aperto al centro, richiude
  '0000000000000000000000', // 10
  '0000000000000000000000', // 11
];

// Sezione volo: spuntoni a terra + capovolti dal soffitto, corridoio centrale.
const flight = [
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000007000000700000007000000000', // capovolti dal soffitto
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000000000000000000000000000000',
  '000020000002000000020000000200', // spuntoni a terra
  '000000000000000000000000000000',
  '000000000000000000000000000000',
];

// --- Assemblaggio ----------------------------------------------------------
const map = assemble(
  start,
  spikesEasy,
  gap(5),
  stepsUp,
  gap(5),
  padJump,
  gap(5),
  floatChain,
  gap(5),
  sawteeth,
  gap(4),
  funnelShip,
  gap(2),
  flight,
  gap(2),
  funnelCube,
  gap(6),
  spikesEasy,
  gap(4),
  stepsUp,
  gap(8)
);

export const level1 = map;

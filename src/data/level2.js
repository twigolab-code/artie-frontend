// =============================================================================
// level2 — Livello 1 (Città). Costruito attorno al MOTIVO della reference:
// TORRI di blocchi impilati con un ORB montato sopra. Il cubo salta, tocca
// l'orb in cima alla torre e fa un secondo salto per scavalcarla. Difficoltà
// MEDIO-FACILE: margini di timing ampi, nessuna combo "al frame". Conserva una
// sezione ship e dei pad per varietà.
//
// Legenda (vedi config.js): 0 vuoto, 1 blocco, 2 spuntone, 3 portale-ship,
// 4 portale-cube, 5 orb, 6 spuntone piccolo, 7 spuntone capovolto, 8 pad,
// 9 moneta.
//
// Tecnica a segmenti (12 righe ciascuno). Riga 0 = alto, riga 9 = terra.
// Geometria verificata col simulatore @ 585: salto cubo apice ~2.8 tile /
// gittata ~5.2; orb = salto fresco a mezz'aria (trigger entro 56px dal centro);
// pad apice ~6.4 tile / gittata ~8. Regole: max 2 spuntoni contigui, atterraggi
// su tile piatte con respiro, orb dentro l'arco di salita (~2.5 tile).
// =============================================================================
import { gap, assemble } from './_grid.js';

const start = gap(8);

// === DEMO GRAFICA del nuovo "pavimento spinato" (tile 's') ==================
// Solo per vedere il render: una striscia di pavimento spinato tra due blocchi
// d'appoggio. La toglieremo quando costruiamo il percorso vero.
const spikeFloorDemo = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '01000ssss00010', // blocco, pavimento spinato (4 celle), blocco
  '00000000000000',
  '00000000000000',
];

// === SEZIONE INIZIALE "alla reference" (intro classica GD) =================
// Ordine: 2 spuntoni -> blocco+orb -> campo spuntoni -> torre 2+orb -> campo
// spuntoni -> torre 3+orb. Orb sempre a row 7 (toccabili sull'arco di salita).

// (2) Coppia di spuntoni a terra (i due triangoli iniziali). Un salto comodo.
const s2_pair = [
  '000000',
  '000000',
  '000000',
  '000000',
  '000000',
  '000000',
  '000000',
  '000000',
  '000000',
  '002200', // due spuntoni pieni appaiati (col 2-3)
  '000000',
  '000000',
];

// (3) Blocco singolo con un orb appena prima. L'orb (row 7) è toccabile in
// salita; mancarlo è innocuo (il blocco 1-tall si scavalca anche senza).
const s3_blockOrb = [
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00050000', // ORB col 3, row 7 (una colonna prima del blocco)
  '00000000',
  '00001000', // blocco singolo a terra (col 4)
  '00000000',
  '00000000',
];

// (4) Campo di spuntoni FITTO (come la reference): muro di spuntoni di altezze
// diverse. Due strisce da 4 (piccolo-pieno-pieno-piccolo) con un solo varco di 2
// tile in mezzo: si saltano in due balzi (4 contigui = max scavalcabile @585).
const s4_field = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '06226006226000', // striscia1 (col 1-4), varco 2, striscia2 (col 7-10)
  '00000000000000',
  '00000000000000',
];

// (5) Torre di 2 blocchi (2 larga) con orb sopra/prima. Si può ATTERRARE sulla
// cima (2 tile) oppure scavalcarla con l'orb: doppia soluzione, ben perdonante.
const s5_tower2 = [
  '00000000000',
  '00000000000',
  '00000000000',
  '00000000000',
  '00000000000',
  '00000000000',
  '00000000000',
  '00005000000', // ORB col 4, row 7 (una colonna prima della faccia)
  '00000110000', // torre 2-tall, cima (col 5-6)
  '00000110000', // base a terra
  '00000000000',
  '00000000000',
];

// (6) Secondo campo di spuntoni fitto (come s4): altro muro jagged a due strisce.
const s6_field = [
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '00000000000000',
  '06226006226000', // striscia1 (col 1-4), varco 2, striscia2 (col 7-10)
  '00000000000000',
  '00000000000000',
];

// (7) Torre ALTA di 3 blocchi (2 larga) con orb. La cima (3 tile) è sopra
// l'apice normale: si scavalca SOLO con l'orb. Orb a face-2 (2 colonne prima
// della faccia sx) per una finestra di pressione ampia.
const s7_tower3 = [
  '0000000000000',
  '0000000000000',
  '0000000000000',
  '0000000000000',
  '0000000000000',
  '0000000000000',
  '0000000000000',
  '0000501100000', // ORB col 4 (face-2) + cima torre (col 6-7)
  '0000001100000', // torre 3-tall, centro
  '0000001100000', // base, faccia sx col 6
  '0000000000000',
  '0000000000000',
];

// DUE torri 2-tall, ognuna col suo orb e ben distanziate (salto+orb, atterraggio,
// poi di nuovo salto+orb). MONETA 1 sopra la prima torre, sull'arco dell'orb.
const towerOrbChain = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000900000000000000000000000', // MONETA 1 (col 8) sopra la prima torre
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000050000000000000005000000000', // ORB1 col 6, ORB2 col 22 (~2.5 tile)
  '00000001100000000000000110000000', // torre1 sx col 7, torre2 sx col 23
  '00000001100000000000000110000000', // (ben distanziate: atterraggio in mezzo)
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
];

// Pilastri di altezza varia con cime PIATTE: si salta di pilastro in pilastro.
const pillarHops = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000011000000000', // +3 (cima piatta)
  '00000011000110000000', // +2
  '00001100000011000000', // +1
  '00001100000011000000', // basi a terra
  '00000000000000000000',
  '00000000000000000000',
];

// PAD verso una piattaforma alta e LARGA (atterraggio comodo). MONETA 2 sopra la
// piattaforma, raccolta cavalcando il pad. Gradino d'arrivo per ridiscendere.
const padTowerCoin = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000900000000000000', // MONETA 2 sopra la piattaforma
  '000000001111100000000000', // piattaforma alta e larga
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000800000000000011000000', // PAD col 3; gradino d'arrivo a destra
  '000000000000000000000000',
  '000000000000000000000000',
];

// Spuntoni a soffitto alti e radi: si corre tranquilli a terra. Un solo spuntone
// a terra tra i denti del soffitto = un hop comodo.
const ceilingDuck = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000700000000700000', // spuntoni a soffitto (alti e radi)
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000020000000000', // un solo spuntone a terra, centrato nel varco
  '00000000000000000000',
  '00000000000000000000',
];

// Imbuto verso SHIP: soffitto a gradini che incanala il cubo nel portale (3)
// all'altezza del terreno. Riusato dal design originale (provato e corretto).
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

// Tunnel ship ampio: pochissimi spuntoni, ben distanziati e sfalsati (slalom
// dolce). MONETA 3 a mezza altezza in uno spazio aperto (salita comoda).
const flightCoin = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000700000000000000000007000000', // spuntoni a soffitto (radi)
  '00000000000000000000000000000000',
  '00000000000000009000000000000000', // MONETA 3 a mezza altezza, spazio aperto
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000200000000000000200000000', // spuntoni a terra (radi)
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
];

// Imbuto verso CUBE: camera libera attorno al portale (4) così la trasformazione
// avviene nello spazio aperto. Riusato dal design originale (provato e corretto).
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

// Rientro a cube col motivo torre+orb. MONETA 4 sopra la torre, raggiungibile
// solo con il salto potenziato dall'orb.
const towerOrbReturn = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000009000000000000', // MONETA 4 (col 9, row 6) sopra la torre, all'apice
  '0000000500000000000000', // ORB col 7, row 7 (~2.5 tile) prima della torre
  '0000000011000000000000', // torre 2-tall, faccia sx col 8
  '0000000011000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
];

// Blocchi-gradone piatti da scavalcare/usare come appoggio, con uno spuntone a
// terra nel varco. Niente spuntoni sulle cime: atterraggi semplici.
const blockHops = [
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000000000000000000',
  '00000110000011000000', // +2 (cime piatte)
  '00000110000011000000', // +1
  '00000110002011000000', // basi a terra + uno spuntone nel varco
  '00000000000000000000',
  '00000000000000000000',
];

// PAD più alto del livello verso una piattaforma larga in cima. MONETA 5
// all'apice del balzo (presa solo in salita), poi atterraggio comodo.
const padHighCoin = [
  '000000000000000000000000',
  '000000000000000000000000',
  '000000900000000000000000', // MONETA 5 all'apice del balzo (col 6, row 2)
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000000000000000000000',
  '000000001111100000000000', // piattaforma d'atterraggio (cols 8-12, row 7)
  '000000000000000000000000',
  '000800000000000011000000', // PAD col 3; gradino d'arrivo a destra
  '000000000000000000000000',
  '000000000000000000000000',
];

// Gauntlet finale dolce: scaletta + un paio di spuntoni radi a terra.
const finalRun = [
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000000000000000000000',
  '0000011110000000000000', // +2
  '0000111111000000000000', // +1
  '0011111111002000200000', // base scaletta + due spuntoni radi
  '0000000000000000000000',
  '0000000000000000000000',
];

const map = assemble(
  start,
  spikeFloorDemo, // DEMO grafica del nuovo pavimento spinato (da rimuovere)
  gap(6),
  // --- Sezione iniziale identica alla reference (intro classica GD) ---
  s2_pair, // 2 spuntoni appaiati
  gap(3),
  s3_blockOrb, // blocco singolo + orb
  gap(3),
  s4_field, // campo di spuntoni (2 cluster)
  gap(4),
  s5_tower2, // torre 2 blocchi + orb (atterrabile o orb-over)
  gap(4),
  s6_field, // campo di spuntoni (2 cluster)
  gap(4),
  s7_tower3, // torre 3 blocchi + orb (scavalco solo con orb)
  gap(8),
  // --- Resto del livello (invariato) ---
  towerOrbChain, // MONETA 1: due torri, catena salto+orb+orb
  gap(3),
  pillarHops,
  gap(3),
  padTowerCoin, // MONETA 2: cima di una torre alta, solo col pad
  gap(3),
  ceilingDuck,
  gap(4),
  funnelShip,
  gap(2),
  flightCoin, // MONETA 3: a mezza altezza nel tunnel ship
  gap(2),
  funnelCube,
  gap(4),
  towerOrbReturn, // MONETA 4: sopra una torre, solo con l'orb
  gap(3),
  blockHops,
  gap(3),
  padHighCoin, // MONETA 5: all'apice del pad più alto del livello
  gap(3),
  finalRun,
  gap(8)
);

export const level2 = map;

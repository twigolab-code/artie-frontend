// =============================================================================
// check-levels.mjs — validatore dei livelli (nessun test harness nel repo).
// Per OGNI mappa in src/data/ esegue invarianti statici + simulatore di
// giocabilità (BFS sulla fisica del cubo). La logica vive in src/data/validate.js
// (fonte di verità CONDIVISA col builder in-browser); qui restano solo l'elenco
// delle mappe e la stampa dei risultati.
//
// Uso: node scripts/check-levels.mjs   (exit 1 se qualcosa fallisce)
// =============================================================================
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { invariants, playable } from '../src/data/validate.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dir, '../src/data');

const MAPS = [
  ['testedo.js', 'testedo', 'TESTEDO'],
];

let failed = false;
for (const [file, name, label] of MAPS) {
  const grid = (await import(pathToFileURL(resolve(DATA, file)).href))[name];
  const inv = invariants(grid);
  const play = playable(grid);
  const ok = inv.errs.length === 0 && play.ok;
  if (!ok) failed = true;
  console.log(`${ok ? '✅' : '❌'} ${label} (${name})  cols=${inv.cols} coins=${inv.coins} maxHaz=${inv.maxRun} ship@tile≈${inv.p3}`);
  for (const e of inv.errs) console.log(`     - INVARIANTE: ${e}`);
  if (!play.ok) console.log(`     - GIOCABILITA': nessun percorso; max tile ${play.maxTile}/${play.cols} (possibile morte forzata)`);
}
console.log(failed ? '\nRESULT: *** ALCUNI CONTROLLI FALLITI ***' : '\nRESULT: tutti i livelli OK');
process.exitCode = failed ? 1 : 0;

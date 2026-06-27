// =============================================================================
// customLevels.js — livelli CUSTOM creati col Game Builder, condivisi tra le due
// pagine (builder.html e il gioco) via localStorage (stessa origine).
//
// Singola fonte di verità (come src/data/validate.js): qui vivono la chiave di
// storage, i preset tema/difficoltà e i get/save/delete. Il builder li SCRIVE
// (bottone "Salva nel gioco"); il gioco li LEGGE all'avvio e li accoda a
// LEVELS/MAPS (vedi loadCustomLevels in main.js). Ogni voce è autosufficiente
// (tema "inlinato") così il gioco non ha bisogno di import extra.
// =============================================================================

export const STORAGE_KEY = 'gd_customLevels';

// Coppia colori cube/ship: tutti i livelli del gioco usano il tema LA, quindi i
// custom lo riusano. Inlinati qui (non importati da config) così il builder resta
// disaccoppiato dal runtime di gioco. Valori = LA_CUBE/LA_SHIP in config.js.
export const LA_CUBE = { top: '#6a4a9e', bottom: '#ff9a52' };
export const LA_SHIP = { top: '#4a2a7a', bottom: '#e0662e' };

// Preset "look" del livello: bg + floor + colore-fondo ostacoli, copiati dalle
// 5 voci di LEVELS (config.js). cube/ship sono sempre la coppia LA.
export const THEME_PRESETS = [
  { id: 'city',       label: 'City',        bg: 'city',       floor: 'city',       obstacleBottom: '#8a1410' },
  { id: 'carwash',    label: 'Car Wash',    bg: 'carwash',    floor: 'carwash',    obstacleBottom: '#9a1414' },
  { id: 'losangeles', label: 'Los Angeles', bg: 'losangeles', floor: 'la',         obstacleBottom: '#8a3a12' },
  { id: 'boulevard',  label: 'Boulevard',   bg: 'boulevard',  floor: 'boulevard',  obstacleBottom: '#143a6a' },
  { id: 'metro',      label: 'Metro',       bg: 'metro',      floor: 'metro',      obstacleBottom: '#241a52' },
];

// Etichette difficoltà + riempimento della barra (diffFrac) nel carosello.
export const DIFFS = [
  { label: 'Facile',    frac: 0.30 },
  { label: 'Medio',     frac: 0.55 },
  { label: 'Difficile', frac: 0.90 },
];

// Velocità di scorrimento standard (tutti i livelli usano 630).
export const DEFAULT_SCROLL_SPEED = 630;

// --- Storage (fail-silent, come getStats/saveStats in main.js) --------------
export function getCustomLevels() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Upsert per `id`: sostituisce una voce con lo stesso id, altrimenti accoda.
export function saveCustomLevel(entry) {
  try {
    const list = getCustomLevels();
    const i = list.findIndex(l => l.id === entry.id);
    if (i >= 0) list[i] = entry;
    else list.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function deleteCustomLevel(id) {
  try {
    const list = getCustomLevels().filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Ritorna un id univoco a partire da `slug`: se è già usato da un livello custom,
// aggiunge un suffisso -2, -3, … così due livelli NUOVI diversi non collidono mai
// (evita sovrascritture accidentali). Usato in creazione; in modifica si riusa l'id.
export function uniqueCustomId(slug) {
  const taken = new Set(getCustomLevels().map(l => l.id));
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

// Costruisce una voce livello completa e autosufficiente dal builder.
// `grid` = array di 12 stringhe (toStrings()). `themeId` ∈ THEME_PRESETS,
// `diffLabel` ∈ DIFFS. `id` univoco (passato dal chiamante per deterministicità).
export function buildCustomEntry({ id, name, themeId, diffLabel, grid }) {
  const theme = THEME_PRESETS.find(t => t.id === themeId) || THEME_PRESETS[0];
  const diff = DIFFS.find(d => d.label === diffLabel) || DIFFS[1];
  return {
    id,
    name: name || 'Livello Custom',
    diff: diff.label,
    diffFrac: diff.frac,
    bg: theme.bg,
    floor: theme.floor,
    obstacleBottom: theme.obstacleBottom,
    cube: { ...LA_CUBE },
    ship: { ...LA_SHIP },
    scrollSpeed: DEFAULT_SCROLL_SPEED,
    mapKey: 'custom-' + id,
    grid,
    custom: true,
  };
}

// =============================================================================
// Assets — caricamento asincrono di immagini (skin personalizzate).
//
// loadImage() ritorna subito un handle { img, ready }: `ready` diventa true
// quando l'immagine è caricata. Se il file manca o dà errore, `ready` resta
// false → chi disegna fa fallback al rendering vettoriale. Nessun crash.
//
// getSkin(path) restituisce (con cache) l'handle per un percorso, così il
// player può cambiare skin a runtime senza ricaricare la stessa immagine.
// =============================================================================
import { SHIP_SKIN, PLAYERS } from '../config.js';

export function loadImage(src) {
  const handle = { img: new Image(), ready: false };
  handle.img.onload = () => {
    handle.ready = true;
  };
  handle.img.onerror = () => {
    handle.ready = false; // fallback al disegno vettoriale
  };
  handle.img.src = src;
  return handle;
}

// Cache path -> handle.
const _cache = new Map();
export function getSkin(path) {
  if (!_cache.has(path)) _cache.set(path, loadImage(path));
  return _cache.get(path);
}

// Pre-carica le skin dei player e il razzo.
for (const p of PLAYERS) getSkin(p.skin);
export const SHIP_IMG = getSkin(SHIP_SKIN);

// Skin di default del cubo (primo player). Il player può cambiarla con setSkin.
export const DEFAULT_CUBE_IMG = getSkin(PLAYERS[0].skin);

// Asset ottimizzati in WebP (vedi scripts/optimize-assets.sh). Se un file manca
// o il browser non supporta WebP, onerror fa fallback al disegno vettoriale.
// Logo della Home.
export const LOGO_IMG = getSkin('/logo.webp');
// Sfondo della schermata iniziale.
export const BG2_IMG = getSkin('/bg-home.webp');
// Moneta collezionabile (fallback vettoriale se il file manca).
export const COIN_IMG = getSkin('/coin.webp');
// Palma (silhouette) per lo sfondo di Los Angeles.
export const PALM_IMG = getSkin('/palm.webp');
// Icone Home: bottoni Opzioni e Stats.
export const OPTIONS_IMG = getSkin('/options.webp');
export const STATS_IMG = getSkin('/stats.webp');
// Sfondi a immagine dei livelli 2-5 (LA/metro/wash/boulevard): caricati pigramente
// alla prima richiesta via getLevelBg(name) — NON in home, perche' sono gli asset
// piu' pesanti. Cache per nome cosi' ogni sfondo si scarica una sola volta.
const _bgCache = {};
export function getLevelBg(name) {
  if (!_bgCache[name]) _bgCache[name] = getSkin(`/${name}.webp`);
  return _bgCache[name];
}

// Stato del font UI: il canvas usa Lilita One solo quando è caricato (altrimenti
// fallback a system-ui). document.fonts.load forza il caricamento e segnala ready.
export const fontState = { ready: false };
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.load("40px 'SoccerLeague'").then(() => {
    fontState.ready = true;
  });
}

#!/usr/bin/env bash
# =============================================================================
# optimize-assets.sh — ottimizza gli asset di public/ per il deploy.
#
# Genera versioni .webp (immagini) ridimensionate alla risoluzione realmente
# usata a schermo e ricomprime la traccia musicale lunga in AAC (.m4a).
# Gli asset originali .png/.mp3 restano in public/ come fallback.
#
# Dipendenze (gia' presenti su macOS / via Homebrew):
#   - cwebp      (brew install webp)
#   - sips       (nativo macOS, resize)
#   - afconvert  (nativo macOS, encode AAC)
#
# Idempotente: rieseguire rigenera i file ottimizzati.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUB="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# resize_webp <src.png> <out.webp> <max_dimension> <quality>
# Ridimensiona mantenendo le proporzioni (lato lungo = max_dimension) e
# converte in webp. Se max_dimension e' 0, non ridimensiona.
resize_webp() {
  local src="$1" out="$2" maxdim="$3" q="$4"
  local work="$TMP/$(basename "$out" .webp).png"
  if [ "$maxdim" != "0" ]; then
    sips --resampleHeightWidthMax "$maxdim" "$src" --out "$work" >/dev/null
  else
    cp "$src" "$work"
  fi
  cwebp -quiet -q "$q" "$work" -o "$out"
}

echo "==> Immagini -> WebP"
# Skin cubo: 2048^2 ridotte a 256 (4x i 60px logici, retina-safe)
resize_webp "$PUB/artie-cube.png" "$PUB/artie-cube.webp" 256 86
resize_webp "$PUB/miles-cubo.png" "$PUB/miles-cubo.webp" 256 86
# Skin nave: disegnata piu' grande del cubo -> 512
resize_webp "$PUB/dodge-artie.png" "$PUB/dodge-artie.webp" 512 86
# Moneta
resize_webp "$PUB/coin.png" "$PUB/coin.webp" 128 86
# Palma (gia' piccola)
resize_webp "$PUB/palm.png" "$PUB/palm.webp" 0 86
# Logo home (grande ma a tutta larghezza)
resize_webp "$PUB/logo.png" "$PUB/logo.webp" 1200 86
# Icone UI
resize_webp "$PUB/options.png" "$PUB/options.webp" 160 86
resize_webp "$PUB/stats.png" "$PUB/stats.webp" 160 86
# Sfondo home (full HD, qualita' un filo piu' bassa)
resize_webp "$PUB/bg-home.png" "$PUB/bg-home.webp" 1920 80
# Sfondo LA (loop orizzontale): 3168 -> 1920 di larghezza
resize_webp "$PUB/bg-los-angeles.png" "$PUB/bg-los-angeles.webp" 1920 80

echo "==> Audio -> AAC (.m4a)"
# Traccia menu (173s, 320kbps, 6.7MB) -> 96kbps AAC (~2MB)
afconvert -f m4af -d aac -b 96000 "$PUB/home.mp3" "$PUB/home.m4a" >/dev/null
# game.mp3 (27s, 128kbps, 430KB) e' gia' compatto: lasciato com'e'.

echo "==> Fatto. Confronto dimensioni:"
for base in artie-cube miles-cubo dodge-artie coin palm logo options stats bg-home bg-los-angeles; do
  if [ -f "$PUB/$base.png" ] && [ -f "$PUB/$base.webp" ]; then
    o=$(stat -f%z "$PUB/$base.png"); n=$(stat -f%z "$PUB/$base.webp")
    printf "  %-18s %8s -> %8s\n" "$base" "$o" "$n"
  fi
done
o=$(stat -f%z "$PUB/home.mp3"); n=$(stat -f%z "$PUB/home.m4a")
printf "  %-18s %8s -> %8s\n" "home(mp3->m4a)" "$o" "$n"

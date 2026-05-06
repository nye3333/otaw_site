#!/usr/bin/env bash
# Convert To_be_converted/* into web-friendly files under other_media/.
# MOV→MP4: ffmpeg (system PATH, or from `pip install --user imageio-ffmpeg`).
# HEIC→JPEG: macOS sips, else ffmpeg.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/To_be_converted"
OUT="$ROOT/other_media"

if command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG=(ffmpeg)
else
  PYFF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null || true)
  if [[ -n "$PYFF" && -x "$PYFF" ]]; then
    FFMPEG=("$PYFF")
  else
    echo "ffmpeg not found. Install ffmpeg or: pip3 install --user imageio-ffmpeg" >&2
    exit 127
  fi
fi

sanitize_base() {
  local s="$1"
  s="$(echo "$s" | sed 's/[[:space:]]/_/g')"
  s="$(echo "$s" | tr -cd '[:alnum:]_.\-')"
  echo "$s"
}

ext_lower() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

mov_to_mp4() {
  local src="$1" dst="$2"
  if "${FFMPEG[@]}" -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p \
    -movflags +faststart -c:a aac -b:a 192k "$dst" 2>/dev/null; then
    return 0
  fi
  "${FFMPEG[@]}" -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p \
    -movflags +faststart -an "$dst"
}

if [[ ! -d "$SRC" ]]; then
  echo "Missing source dir: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT"
echo "Output: $OUT"
done=0
skipped=0

shopt -s nullglob
for path in "$SRC"/*; do
  [[ -f "$path" ]] || continue
  base=$(basename "$path")
  [[ "$base" == .DS_Store ]] && continue

  ext=$(ext_lower "${base##*.}")
  stem=$(sanitize_base "${base%.*}")
  [[ -z "$stem" ]] && stem="file_${done}"

  case "$ext" in
    heic|heif)
      dst="$OUT/${stem}.jpg"
      echo "HEIC → $dst"
      if sips -s format jpeg "$path" --out "$dst" >/dev/null 2>&1; then
        :
      elif "${FFMPEG[@]}" -y -hide_banner -loglevel error -i "$path" "$dst" 2>/dev/null; then
        :
      else
        echo "  FAILED: $path" >&2
        exit 1
      fi
      done=$((done + 1))
      ;;
    mov)
      dst="$OUT/${stem}.mp4"
      echo "MOV → $dst"
      mov_to_mp4 "$path" "$dst"
      done=$((done + 1))
      ;;
    mp4)
      dst="$OUT/${stem}.mp4"
      echo "copy → $dst"
      cp "$path" "$dst"
      done=$((done + 1))
      ;;
    jpg|jpeg)
      dst="$OUT/${stem}.jpg"
      echo "copy → $dst"
      cp "$path" "$dst"
      done=$((done + 1))
      ;;
    *)
      echo "skip (unknown .$ext): $base"
      skipped=$((skipped + 1))
      ;;
  esac
done

echo "Done: $done converted/copied, $skipped skipped."

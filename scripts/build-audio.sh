#!/usr/bin/env bash
# Build in-game audio from research/audio/candidates (gitignored originals)
# into public/assets/audio/ as Opus (.ogg) + AAC (.m4a, Safari fallback),
# plus manifest.json that src/audio/ loads.
#
# Choices follow research/audio/REPORT.md §1, §4.1, §8:
#   sfx   mono   Opus 48k / AAC 64k
#   amb   stereo Opus 64k / AAC 96k
#   music stereo Opus 96k / AAC 128k
#   voice mono   Opus 40k / AAC 64k, trimmed + loudnorm -16 LUFS (Charlie set by Mint)
# Loops that do not wrap cleanly get an equal-power crossfade baked in
# (tail blended into head), so the runtime can loop the whole buffer.
#
# Usage: bash scripts/build-audio.sh      (needs ffmpeg + ffprobe)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/research/audio/candidates"
OUT="$ROOT/public/assets/audio"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
[ -d "$SRC" ] || { echo "missing $SRC (download candidates first, see research/audio/REPORT.md)" >&2; exit 1; }

# Prefer Apple's AAC encoder when present (better quality at low bitrates).
AAC=aac
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' aac_at ' && AAC=aac_at

rm -rf "$OUT"
mkdir -p "$OUT"
MANIFEST="$TMP/entries.json"
: > "$MANIFEST"

ff() { ffmpeg -nostdin -hide_banner -loglevel error -y "$@"; }
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

# build <id> <src> <kind> <start> <length|-> <fadeOut> <loopXfade> <preload> [loopEndSec]
#   kind     sfx | amb | music | voice
#   length   "-" = to end of file
#   loopXfade 0 = one-shot; >0 = bake seamless loop with that crossfade (sec);
#            "whole" = loop the whole file as-is (musically cut, e.g. 60 bars)
#   preload  1 = part of first load budget, 0 = streamed later
build() {
  local id=$1 src=$2 kind=$3 ss=$4 len=$5 fade=$6 xf=$7 pre=$8 loopEnd=${9:-}
  local ch rate_o rate_a dir
  case $kind in
    sfx)   ch=1; rate_o=48k; rate_a=64k;  dir=sfx ;;
    amb)   ch=2; rate_o=64k; rate_a=96k;  dir=amb ;;
    music) ch=2; rate_o=96k; rate_a=128k; dir=music ;;
    voice) ch=1; rate_o=40k; rate_a=64k;  dir=voice ;;
  esac
  mkdir -p "$OUT/$dir"
  local raw="$TMP/$id.raw.wav" wav="$TMP/$id.wav"

  local trim=()
  [ "$ss" != "0" ] && trim+=(-ss "$ss")
  [ "$len" != "-" ] && trim+=(-t "$len")

  local af="aresample=48000"
  if [ "$kind" = voice ]; then
    # Strip silence at both ends so the word lands on the beat, then even out loudness.
    af="$af,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000,afade=t=in:d=0.005"
  fi
  ff ${trim[@]+"${trim[@]}"} -i "$SRC/$src" -ac "$ch" -af "$af" -c:a pcm_f32le "$raw"

  if [ "$fade" != "0" ]; then
    local L; L=$(dur "$raw")
    local st; st=$(awk -v l="$L" -v f="$fade" 'BEGIN{printf "%.3f", (l>f? l-f : 0)}')
    ff -i "$raw" -af "afade=t=out:st=$st:d=$fade" -c:a pcm_f32le "$wav"
  else
    mv "$raw" "$wav"
  fi

  local loop=false lstart=0 lend
  if [ "$xf" = whole ]; then
    loop=true
  elif [ "$xf" != "0" ]; then
    # out = body(x..L) with its last x seconds crossfaded into head(0..x):
    # the loop wraps from blended head straight into body(x) — sample-continuous.
    local L; L=$(dur "$wav")
    ff -i "$wav" -i "$wav" -filter_complex \
      "[0]atrim=start=$xf,asetpts=PTS-STARTPTS[body];[1]atrim=end=$xf,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=$xf:c1=qsin:c2=qsin" \
      -c:a pcm_f32le "$TMP/$id.loop.wav"
    mv "$TMP/$id.loop.wav" "$wav"
    loop=true
  fi
  local D; D=$(dur "$wav")
  lend=${loopEnd:-$D}

  ff -i "$wav" -c:a libopus -b:a "$rate_o" -vbr on -application audio "$OUT/$dir/$id.ogg"
  ff -i "$wav" -c:a "$AAC" -b:a "$rate_a" -movflags +faststart "$OUT/$dir/$id.m4a"

  local so sa
  so=$(stat -f%z "$OUT/$dir/$id.ogg" 2>/dev/null || stat -c%s "$OUT/$dir/$id.ogg")
  sa=$(stat -f%z "$OUT/$dir/$id.m4a" 2>/dev/null || stat -c%s "$OUT/$dir/$id.m4a")
  printf '    "%s": { "path": "%s/%s", "kind": "%s", "duration": %.4f, "loop": %s, "loopStart": %s, "loopEnd": %.4f, "preload": %s, "bytes": { "ogg": %s, "m4a": %s }, "source": "%s" },\n' \
    "$id" "$dir" "$id" "$kind" "$D" "$loop" "$lstart" "$lend" "$([ "$pre" = 1 ] && echo true || echo false)" "$so" "$sa" "$src" >> "$MANIFEST"
  printf '  %-16s %-6s %6.2fs  ogg %6d B  m4a %6d B\n' "$id" "$kind" "$D" "$so" "$sa"
}

echo "Building audio → public/assets/audio (AAC encoder: $AAC)"

# --- UI / race events (Kenney, CC0) ---
build ui-click      ui/kenney-click-002.ogg               sfx 0 - 0 0 1
build ui-confirm    ui/kenney-confirm-002.ogg             sfx 0 - 0 0 1
build ui-back       ui/kenney-back-002.ogg                sfx 0 - 0 0 1
build beep          ui/kenney-countdown-tone1.ogg         sfx 0 - 0 0 1
build beep-go       ui/kenney-countdown-go-high-up.ogg    sfx 0 - 0 0 1
build checkpoint    ui/kenney-checkpoint-three-tone-2.ogg sfx 0 - 0 0 1
build jingle-finish ui/kenney-finish-jingle-sax-07.ogg    sfx 0 - 0 0 1
build jingle-lose   ui/kenney-lose-jingle-hit-10.ogg      sfx 0 - 0 0 1

# --- Car (Kenney + Freesound, CC0) ---
build motor-layer   car/kenney-motor-space-engine-000.ogg sfx 0.5 4.0 0 0.4  1   # thin texture under the synth motor
build tire-loop     car/fs104026-tire-squeak.ogg          sfx 0.2 1.6 0 0.25 1
build crash-heavy   car/fs237375-crash-car.ogg            sfx 0.3 2.2 0.8 0 1
build crash-light   car/fs151624-crash-clank.ogg          sfx 0 - 0.1 0 1
build boost-blast   car/fs540091-boost-rocket-blast.ogg   sfx 0 1.2 0.5 0 1
build boost-zap     car/kenney-boost-phaser-up-6.ogg      sfx 0 - 0 0 1
build jump-air      car/fs457294-jump-air-pressure-release.ogg sfx 0 1.4 0.7 0 1   # cold-gas burst (real car has no flame)
build land          car/fs329516-land-hood-impact.ogg     sfx 0.1 1.1 0.5 0 1

# --- Ambience (Freesound, CC0) ---
build rain          ambience/fs624645-rain-heavy-loop.ogg amb 0 - 0 0.2 1
build city          ambience/fs237329-city-night.ogg      amb 0 24 0 1.0 1

# --- Music (OpenGameArt, CC0) ---
build menu          bgm/oga-menu-cyberpunk-menu.ogg       music 0.02 - 0 whole 1
# Race tracks are cut at exactly 60 bars (REPORT §3.1): 60*4*60/145 = 99.3103 s, 60*4*60/160 = 90.0 s
build race          bgm/oga-race-neon-sign-circuit-145.ogg        music 0 - 0 whole 0 99.3103
build race-final    bgm/oga-race-neon-sign-circuit-climax-160.ogg music 0 - 0 whole 0 90.0000

# --- Announcer: Charlie by Mint / ElevenLabs free plan (non-commercial, credit "เสียงพากย์: ElevenLabs") ---
for w in three two one go final-lap new-record finish boost nice-drift great-jump; do
  build "vo-$w" "voice/mint/charlie/$w.mp3" voice 0 - 0 0 1
done

# --- manifest.json ---
{
  echo '{'
  echo '  "version": 1,'
  echo '  "formats": ["ogg", "m4a"],'
  echo '  "music": { "race": { "bpm": 145 }, "race-final": { "bpm": 160 } },'
  echo '  "sounds": {'
  sed '$ s/,$//' "$MANIFEST"
  echo '  }'
  echo '}'
} > "$OUT/manifest.json"

# --- budget report (first load = preload:true, one format per device) ---
node -e '
const m = require(process.argv[1]);
const s = Object.values(m.sounds);
const sum = (f, pre) => s.filter(x => x.preload === pre).reduce((a, x) => a + x.bytes[f], 0);
const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log(`first load: ogg ${kb(sum("ogg", true))} · m4a ${kb(sum("m4a", true))}  (budget 1.5 MB)`);
console.log(`streamed:   ogg ${kb(sum("ogg", false))} · m4a ${kb(sum("m4a", false))}`);
const over = Math.max(sum("ogg", true), sum("m4a", true)) > 1.5 * 1024 * 1024;
if (over) { console.error("first-load audio over 1.5 MB budget"); process.exit(1); }
' "$OUT/manifest.json"

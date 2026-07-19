#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_BIN="${FFMPEG_BIN:-/opt/homebrew/bin/ffmpeg}"
FFPROBE_BIN="${FFPROBE_BIN:-/opt/homebrew/bin/ffprobe}"
TITLE_CARD="$PROJECT_ROOT/output/video/cards/title.png"
CAPTURE_CARD="$PROJECT_ROOT/output/video/cards/capture.png"
ASSURANCE_CARD="$PROJECT_ROOT/output/video/cards/assurance.png"
INVALID_CARD="$PROJECT_ROOT/output/video/cards/invalid.png"
RESTORED_CARD="$PROJECT_ROOT/output/video/cards/restored.png"
NARRATION_AUDIO="$PROJECT_ROOT/output/speech/flight-recorder-demo-voiceover.aiff"
OUTPUT_DIR="$PROJECT_ROOT/output/video"
OUTPUT_VIDEO="$OUTPUT_DIR/flight-recorder-openai-build-week-demo.mp4"

for required_file in "$TITLE_CARD" "$CAPTURE_CARD" "$ASSURANCE_CARD" "$INVALID_CARD" "$RESTORED_CARD" "$NARRATION_AUDIO"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing required input: $required_file" >&2
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

# The five scenes total 160 seconds, leaving a visible closing card after narration ends.
"$FFMPEG_BIN" -hide_banner -loglevel warning -y \
  -loop 1 -framerate 30 -t 7 -i "$TITLE_CARD" \
  -loop 1 -framerate 30 -t 47 -i "$CAPTURE_CARD" \
  -loop 1 -framerate 30 -t 65 -i "$ASSURANCE_CARD" \
  -loop 1 -framerate 30 -t 19 -i "$INVALID_CARD" \
  -loop 1 -framerate 30 -t 22 -i "$RESTORED_CARD" \
  -i "$NARRATION_AUDIO" \
  -filter_complex "
    [0:v]scale=1920:1080,fade=t=in:st=0:d=0.7,fade=t=out:st=6.3:d=0.7,setsar=1[v0];
    [1:v]scale=1920:1080,zoompan=z='min(zoom+0.000018,1.035)':x='0':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=46.3:d=0.7,setsar=1[v1];
    [2:v]scale=1920:1080,zoompan=z='min(zoom+0.000015,1.03)':x='iw-(iw/zoom)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=64.3:d=0.7,setsar=1[v2];
    [3:v]scale=1920:1080,zoompan=z='min(zoom+0.00002,1.04)':x='iw-(iw/zoom)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=18.3:d=0.7,setsar=1[v3];
    [4:v]scale=1920:1080,zoompan=z='min(zoom+0.000015,1.025)':x='iw-(iw/zoom)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=21.3:d=0.7,setsar=1[v4];
    [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v];
    [5:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=6,aresample=48000[a]
  " \
  -map "[v]" -map "[a]" -t 160 \
  -c:v libx264 -preset medium -crf 20 -profile:v high -level 4.1 \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  -metadata title="Flight Recorder - OpenAI Build Week 2026" \
  -metadata comment="Synthetic narration. Public no-login demonstration of the verified v0.1.0 release." \
  "$OUTPUT_VIDEO"

VIDEO_DURATION="$($FFPROBE_BIN -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_VIDEO")"
echo "Rendered $OUTPUT_VIDEO"
echo "Duration: $VIDEO_DURATION seconds"

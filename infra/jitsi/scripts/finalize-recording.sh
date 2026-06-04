#!/bin/bash
# Called by Jibri when a recording finishes.
# Jibri passes the recording DIRECTORY as $1 (e.g. /config/recordings/<session-id>),
# not the mp4 file directly.
set -euo pipefail

RECORDING_ARG="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/cloudinary.env"

if [[ -z "$RECORDING_ARG" ]]; then
  echo "[finalize] No recording path provided" >&2
  exit 1
fi

# Resolve the actual mp4 file. Jibri usually gives a directory.
RECORDING_FILE=""
if [[ -f "$RECORDING_ARG" ]]; then
  RECORDING_FILE="$RECORDING_ARG"
elif [[ -d "$RECORDING_ARG" ]]; then
  RECORDING_FILE="$(find "$RECORDING_ARG" -maxdepth 1 -type f -name '*.mp4' | sort | tail -n 1)"
fi

if [[ -z "$RECORDING_FILE" || ! -f "$RECORDING_FILE" ]]; then
  echo "[finalize] No .mp4 file found in: $RECORDING_ARG" >&2
  exit 1
fi

echo "[finalize] Processing: $RECORDING_FILE"

if [[ -f "$ENV_FILE" ]]; then
  # Auto-export sourced vars so the node child process inherits them.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if command -v node >/dev/null 2>&1 && [[ -f "${SCRIPT_DIR}/upload-to-cloudinary.js" ]]; then
  node "${SCRIPT_DIR}/upload-to-cloudinary.js" "$RECORDING_FILE"
else
  echo "[finalize] Node or upload script missing — file saved locally at $RECORDING_FILE"
fi

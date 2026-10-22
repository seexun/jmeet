#!/bin/bash

# Usage: watch-typings.sh [mode] [pnpm-filter]
# mode: ce (default) | pro
# pnpm-filter: optional pnpm filter for running the typings package (defaults to @openvidu-meet/typings)

set -u

MODE=${1:-ce}
PNPM_FILTER=${2:-@openvidu-meet/typings}

case "$MODE" in
  ce|CE)
    FLAG_PATH="./meet-ce/typings/dist/typings-ready.flag"
    ;;
  *)
    echo "Usage: $0 ce [pnpm-filter]"
    exit 2
    ;;
esac

# Remove the flag file if it exists
rm -f "$FLAG_PATH"

# Create the directory for the flag file if it doesn't exist
mkdir -p "$(dirname "$FLAG_PATH")"

echo "Starting typings watch mode for mode='$MODE' with pnpm filter='$PNPM_FILTER'..."
echo "Waiting for initial compilation..."

# Run tsc in watch mode via the typings package. We stream the output and look for known patterns.
pnpm --filter "$PNPM_FILTER" run dev | while IFS= read -r line || [ -n "$line" ]; do
  echo "$line"

  # Check for compilation start (remove flag to signal "not ready")
  if echo "$line" | grep -q "File change detected. Starting incremental compilation"; then
    rm -f "$FLAG_PATH"
    echo "Typings recompiling..."
  fi

  # Check for successful compilation (create flag to signal "ready")
  if echo "$line" | grep -q "Found 0 errors"; then
    # Add small delay to ensure all files are written to disk
    sleep 0.2
    touch "$FLAG_PATH"
    echo "✅ Typings ready!"
  fi

  # Check for compilation errors
  if echo "$line" | grep -q "error TS"; then
    rm -f "$FLAG_PATH"
    echo "❌ Typings compilation failed!"
  fi
done

exit 0

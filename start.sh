#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

export PATH="$HOME/.local/go/bin:$HOME/go/bin:$HOME/.local/share/fnm:$PATH"
eval "$(fnm env 2>/dev/null)" || true

cleanup() {
    echo "Stopping..."
    kill $API_PID $FRONTEND_PID 2>/dev/null
    wait $API_PID $FRONTEND_PID 2>/dev/null
}
trap cleanup EXIT

# API server (embeds Zoekt)
cd "$DIR/api"
ZOEKT_INDEX_DIR="$DIR/data/zoekt-index" \
METADATA_DIR="$DIR/data/extracted" \
./greparxiv-api &
API_PID=$!

# Frontend
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "  grepArXiv running at http://localhost:5173"
echo "  API at http://localhost:8080"
echo "  Press Ctrl+C to stop"
echo ""

wait

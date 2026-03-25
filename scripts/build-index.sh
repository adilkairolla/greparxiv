#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTRACTED_DIR="$PROJECT_ROOT/data/extracted"
INDEX_INPUT="$PROJECT_ROOT/data/index-input"
INDEX_DIR="$PROJECT_ROOT/data/zoekt-index"

echo "Preparing flat file structure for Zoekt..."
mkdir -p "$INDEX_INPUT"

count=0
for paper_dir in "$EXTRACTED_DIR"/*/; do
    paper_id=$(basename "$paper_dir")
    txt_file="$paper_dir/paper.txt"
    if [ -f "$txt_file" ] && [ -s "$txt_file" ]; then
        cp "$txt_file" "$INDEX_INPUT/${paper_id}.txt"
        count=$((count + 1))
    fi
done

echo "Prepared $count files for indexing"

echo "Building Zoekt index..."
mkdir -p "$INDEX_DIR"
zoekt-index -index "$INDEX_DIR" "$INDEX_INPUT"

echo "Index built. Shard files:"
ls -lh "$INDEX_DIR"/*.zoekt 2>/dev/null || echo "  No shard files found!"

echo "Done."

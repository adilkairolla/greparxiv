#!/bin/bash
# Run the full text extraction + metadata + index pipeline.
#
# Usage:
#   scripts/ingest.sh --month 2602              # process one month
#   scripts/ingest.sh                           # process all months with .gz files
#   scripts/ingest.sh --month 2602 --workers 8  # parallel workers
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$DIR/data/src"
LOG="$DIR/data/ingest.log"

MONTH=""
WORKERS=$(nproc)

while [[ $# -gt 0 ]]; do
    case $1 in
        --month) MONTH="$2"; shift 2 ;;
        --workers) WORKERS="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--month YYMM] [--workers N]"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

log_event() {
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"$1\",$2}" >> "$LOG"
}

# Find months to process
if [[ -n "$MONTH" ]]; then
    MONTHS="$MONTH"
else
    # Find all month directories that have .gz files
    MONTHS=$(find "$SRC_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | sort)
fi

if [[ -z "$MONTHS" ]]; then
    echo "No month directories found in $SRC_DIR"
    exit 0
fi

echo "=== Text Extraction ==="
for month in $MONTHS; do
    month_dir="$SRC_DIR/$month"
    if [[ ! -d "$month_dir" ]]; then
        continue
    fi

    gz_count=$(find "$month_dir" -maxdepth 1 -name '*.gz' | wc -l)
    if [[ "$gz_count" -eq 0 ]]; then
        continue
    fi

    echo "Processing month $month ($gz_count .gz files, $WORKERS workers)..."

    # Run extraction
    output=$(python3 "$DIR/pipeline/extract.py" \
        --src-dir "$month_dir" \
        --workers "$WORKERS" \
        --resume 2>&1) || true
    echo "$output"

    # Parse stats from output
    ok=$(echo "$output" | grep -oP 'OK: \K[0-9]+' || echo "0")
    errors=$(echo "$output" | grep -oP 'Errors: \K[0-9]+' || echo "0")
    log_event "extract" "\"month\":\"$month\",\"papers_ok\":$ok,\"papers_fail\":$errors"
done

echo ""
echo "=== Metadata Fetch ==="
python3 "$DIR/pipeline/extract.py" --fetch-metadata 2>&1
fetched_line=$(python3 "$DIR/pipeline/extract.py" --fetch-metadata 2>&1 | tail -1)
log_event "metadata" "\"info\":\"$fetched_line\""

echo ""
echo "=== Rebuilding Search Index ==="
export PATH="$HOME/.local/go/bin:$HOME/go/bin:$PATH"
bash "$DIR/scripts/build-index.sh"

# Log index stats
if [[ -d "$DIR/data/zoekt-index" ]]; then
    index_mb=$(du -sm "$DIR/data/zoekt-index" | awk '{print $1}')
    paper_count=$(find "$DIR/data/index-input" -name '*.txt' | wc -l)
    log_event "index" "\"total_papers\":$paper_count,\"index_mb\":$index_mb"
fi

echo ""
echo "=== Ingest Complete ==="

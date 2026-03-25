#!/bin/bash
# Extract .gz paper archives from downloaded tar files.
#
# Usage:
#   scripts/untar.sh --month 2602       # extract tars for a specific month
#   scripts/untar.sh                    # extract all unprocessed tars
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$DIR/data/src"
LOG="$DIR/data/ingest.log"

MONTH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --month) MONTH="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--month YYMM]"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

log_event() {
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"untar\",$1}" >> "$LOG"
}

# Find tar files to process
if [[ -n "$MONTH" ]]; then
    PATTERN="arXiv_src_${MONTH}_*.tar"
else
    PATTERN="arXiv_src_*.tar"
fi

TARS=$(find "$SRC_DIR" -maxdepth 1 -name "$PATTERN" | sort)

if [[ -z "$TARS" ]]; then
    echo "No tar files found matching $PATTERN in $SRC_DIR"
    exit 0
fi

TAR_COUNT=$(echo "$TARS" | wc -l)
echo "Found $TAR_COUNT tar files to extract"

TOTAL_PAPERS=0
PROCESSED=0

while IFS= read -r tar_file; do
    basename_tar=$(basename "$tar_file")

    # Detect month from filename: arXiv_src_YYMM_NNN.tar
    tar_month=$(echo "$basename_tar" | sed -E 's/arXiv_src_([0-9]{4})_[0-9]+\.tar/\1/')
    out_dir="$SRC_DIR/$tar_month"
    mkdir -p "$out_dir"

    # Count papers before extraction
    before_count=$(find "$out_dir" -maxdepth 1 -name '*.gz' 2>/dev/null | wc -l)

    echo "  Extracting $basename_tar → $tar_month/ ..."
    tar xf "$tar_file" -C "$SRC_DIR/" 2>/dev/null || true

    # Count new papers
    after_count=$(find "$out_dir" -maxdepth 1 -name '*.gz' 2>/dev/null | wc -l)
    new_papers=$((after_count - before_count))
    TOTAL_PAPERS=$((TOTAL_PAPERS + new_papers))
    PROCESSED=$((PROCESSED + 1))

    log_event "\"file\":\"$basename_tar\",\"month\":\"$tar_month\",\"papers\":$new_papers"

    echo "    Extracted $new_papers new papers (total in $tar_month/: $after_count)"
done <<< "$TARS"

echo ""
echo "=== Untar Summary ==="
echo "  Tars processed: $PROCESSED"
echo "  New papers extracted: $TOTAL_PAPERS"

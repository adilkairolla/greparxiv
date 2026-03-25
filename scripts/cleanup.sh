#!/bin/bash
# Remove raw tar and .gz files after successful extraction.
# Only cleans months where >95% of papers were extracted.
#
# Usage:
#   scripts/cleanup.sh --dry-run              # show what would be removed
#   scripts/cleanup.sh                        # clean all eligible months
#   scripts/cleanup.sh --month 2602           # clean specific month
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$DIR/data/src"
EXTRACTED_DIR="$DIR/data/extracted"
INDEX_INPUT="$DIR/data/index-input"
LOG="$DIR/data/cleanup.log"

MONTH=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --month) MONTH="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--month YYMM] [--dry-run]"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

log_event() {
    if [[ "$DRY_RUN" == false ]]; then
        echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"cleanup\",$1}" >> "$LOG"
    fi
}

if [[ "$DRY_RUN" == true ]]; then
    echo "=== DRY RUN — no files will be deleted ==="
    echo ""
fi

# Find months to clean
if [[ -n "$MONTH" ]]; then
    MONTHS="$MONTH"
else
    MONTHS=$(find "$SRC_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | sort)
fi

TOTAL_FREED=0

for month in $MONTHS; do
    month_dir="$SRC_DIR/$month"
    if [[ ! -d "$month_dir" ]]; then
        continue
    fi

    # Count .gz files (source papers)
    gz_count=$(find "$month_dir" -maxdepth 1 -name '*.gz' 2>/dev/null | wc -l)
    if [[ "$gz_count" -eq 0 ]]; then
        continue
    fi

    # Count extracted papers for this month (paper IDs starting with YYMM.)
    extracted_count=$(find "$EXTRACTED_DIR" -maxdepth 1 -name "${month}.*" -type d 2>/dev/null | wc -l)

    # Calculate coverage (handle PDF-only submissions by being lenient)
    if [[ "$gz_count" -gt 0 ]]; then
        coverage=$((extracted_count * 100 / gz_count))
    else
        coverage=0
    fi

    # Size of data to remove
    gz_size=$(du -sb "$month_dir" 2>/dev/null | awk '{print $1}')
    tar_files=$(find "$SRC_DIR" -maxdepth 1 -name "arXiv_src_${month}_*.tar" 2>/dev/null)
    tar_size=0
    tar_count=0
    if [[ -n "$tar_files" ]]; then
        tar_size=$(echo "$tar_files" | xargs du -sbc 2>/dev/null | tail -1 | awk '{print $1}')
        tar_count=$(echo "$tar_files" | wc -l)
    fi
    total_size=$((gz_size + tar_size))
    total_gb=$(python3 -c "print(f'{$total_size/1e9:.1f}')")

    echo "Month $month: $gz_count .gz files, $extracted_count extracted ($coverage% coverage), $total_gb GB"

    if [[ "$coverage" -lt 90 ]]; then
        echo "  SKIP: coverage too low ($coverage% < 90%). Run ingest first."
        continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo "  WOULD REMOVE: $tar_count tars + $gz_count .gz files ($total_gb GB)"
    else
        echo "  Removing $tar_count tars..."
        if [[ -n "$tar_files" ]]; then
            echo "$tar_files" | xargs rm -f
        fi

        echo "  Removing $gz_count .gz files..."
        rm -rf "$month_dir"

        log_event "\"month\":\"$month\",\"tars_removed\":$tar_count,\"gz_removed\":$gz_count,\"space_gb\":$total_gb"
        echo "  Freed $total_gb GB"
    fi

    TOTAL_FREED=$((TOTAL_FREED + total_size))
done

# Clean index-input (intermediate, rebuilt by build-index.sh)
if [[ -d "$INDEX_INPUT" ]]; then
    idx_size=$(du -sb "$INDEX_INPUT" | awk '{print $1}')
    idx_gb=$(python3 -c "print(f'{$idx_size/1e9:.1f}')")
    if [[ "$DRY_RUN" == true ]]; then
        echo ""
        echo "WOULD REMOVE: index-input/ ($idx_gb GB) — rebuilt on next ingest"
    else
        echo ""
        echo "Removing index-input/ ($idx_gb GB)..."
        rm -rf "$INDEX_INPUT"
        TOTAL_FREED=$((TOTAL_FREED + idx_size))
    fi
fi

echo ""
echo "=== Cleanup Summary ==="
echo "  Total freed: $(python3 -c "print(f'{$TOTAL_FREED/1e9:.1f}')") GB"
if [[ "$DRY_RUN" == true ]]; then
    echo "  (dry run — nothing was actually deleted)"
fi

#!/bin/bash
# One-command pipeline: download → untar → extract → index → cleanup.
#
# Usage:
#   scripts/sync.sh --month 2602                          # download 20GB, process, keep raw
#   scripts/sync.sh --month 2602 --limit-gb 5 --cleanup   # download 5GB, process, clean raw
#   scripts/sync.sh --month 2601 --limit-gb 10             # different month
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"

MONTH=""
LIMIT_GB=20
CLEANUP=false
WORKERS=$(nproc)

while [[ $# -gt 0 ]]; do
    case $1 in
        --month) MONTH="$2"; shift 2 ;;
        --limit-gb) LIMIT_GB="$2"; shift 2 ;;
        --workers) WORKERS="$2"; shift 2 ;;
        --cleanup) CLEANUP=true; shift ;;
        -h|--help)
            echo "Usage: $0 --month YYMM [--limit-gb N] [--workers N] [--cleanup]"
            echo ""
            echo "  --month YYMM    arXiv month code (required)"
            echo "  --limit-gb N    max GB to download (default: 20)"
            echo "  --workers N     extraction parallelism (default: $(nproc))"
            echo "  --cleanup       remove raw tars and .gz after extraction"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if [[ -z "$MONTH" ]]; then
    echo "Error: --month is required"
    echo "Usage: $0 --month YYMM [--limit-gb N] [--cleanup]"
    exit 1
fi

echo "============================================"
echo "  grepArXiv sync: month=$MONTH limit=${LIMIT_GB}GB"
echo "============================================"
echo ""

# Step 1: Download
echo ">>> Step 1/4: Download from S3"
echo ""
bash "$DIR/scripts/download.sh" --month "$MONTH" --limit-gb "$LIMIT_GB"

echo ""
echo ">>> Step 2/4: Extract tars"
echo ""
bash "$DIR/scripts/untar.sh" --month "$MONTH"

echo ""
echo ">>> Step 3/4: Ingest (extract text + metadata + index)"
echo ""
bash "$DIR/scripts/ingest.sh" --month "$MONTH" --workers "$WORKERS"

if [[ "$CLEANUP" == true ]]; then
    echo ""
    echo ">>> Step 4/4: Cleanup raw data"
    echo ""
    bash "$DIR/scripts/cleanup.sh" --month "$MONTH"
else
    echo ""
    echo ">>> Step 4/4: Cleanup skipped (use --cleanup to enable)"
fi

echo ""
echo "============================================"
echo "  Sync complete for month $MONTH"
echo "============================================"

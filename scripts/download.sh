#!/bin/bash
# Download arXiv source tars from S3 with manifest validation and logging.
#
# Usage:
#   scripts/download.sh --month 2602                    # download up to 20 GB
#   scripts/download.sh --month 2602 --limit-gb 5       # download up to 5 GB
#   scripts/download.sh --month 2601 --limit-gb 10      # different month
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$DIR/data/arXiv_src_manifest.xml"
SRC_DIR="$DIR/data/src"
LOG="$DIR/data/download.log"
S3_BUCKET="s3://arxiv"

# Defaults
MONTH=""
LIMIT_GB=20

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --month)  MONTH="$2"; shift 2 ;;
        --limit-gb) LIMIT_GB="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 --month YYMM [--limit-gb N]"
            echo "  --month YYMM    arXiv month code (e.g., 2602 for Feb 2026)"
            echo "  --limit-gb N    max GB to download (default: 20)"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if [[ -z "$MONTH" ]]; then
    echo "Error: --month is required"
    echo "Usage: $0 --month YYMM [--limit-gb N]"
    exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
    echo "Manifest not found at $MANIFEST"
    echo "Download it: aws s3 cp s3://arxiv/src/arXiv_src_manifest.xml $DIR/data/ --request-payer requester"
    exit 1
fi

mkdir -p "$SRC_DIR"
LIMIT_BYTES=$(( LIMIT_GB * 1000000000 ))

log_event() {
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"download\",$1}" >> "$LOG"
}

# Parse manifest for this month's tars
echo "Parsing manifest for month $MONTH..."
TARS=$(python3 -c "
import xml.etree.ElementTree as ET, json
tree = ET.parse('$MANIFEST')
for f in tree.getroot().findall('file'):
    if f.find('yymm').text == '$MONTH':
        print(json.dumps({
            'filename': f.find('filename').text,
            'size': int(f.find('size').text),
            'md5': f.find('md5sum').text,
        }))
")

if [[ -z "$TARS" ]]; then
    echo "No tars found for month $MONTH in manifest"
    exit 1
fi

TOTAL_TARS=$(echo "$TARS" | wc -l)
TOTAL_SIZE=$(echo "$TARS" | python3 -c "import sys,json; print(sum(json.loads(l)['size'] for l in sys.stdin))")
echo "Month $MONTH: $TOTAL_TARS tars, $(python3 -c "print(f'{$TOTAL_SIZE/1e9:.1f}')") GB total"

# Check what's already downloaded
DOWNLOADED=0
DOWNLOADED_BYTES=0
SKIPPED=0
FAILED=0
NEW_BYTES=0

while IFS= read -r line; do
    TAR=$(echo "$line" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['filename'])")
    SIZE=$(echo "$line" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['size'])")
    MD5=$(echo "$line" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['md5'])")
    BASENAME=$(basename "$TAR")
    DEST="$SRC_DIR/$BASENAME"

    # Skip if already exists and correct size
    if [[ -f "$DEST" ]]; then
        ACTUAL_SIZE=$(stat -c%s "$DEST" 2>/dev/null || stat -f%z "$DEST" 2>/dev/null)
        if [[ "$ACTUAL_SIZE" == "$SIZE" ]]; then
            SKIPPED=$((SKIPPED + 1))
            continue
        fi
        echo "  $BASENAME: size mismatch (expected $SIZE, got $ACTUAL_SIZE), re-downloading"
    fi

    # Check download limit
    if (( NEW_BYTES + SIZE > LIMIT_BYTES )); then
        REMAINING=$((TOTAL_TARS - DOWNLOADED - SKIPPED))
        echo ""
        echo "Reached ${LIMIT_GB} GB limit. $REMAINING tars remaining for month $MONTH."
        echo "Run again with a higher --limit-gb to continue."
        break
    fi

    # Download
    echo "  Downloading $BASENAME ($(python3 -c "print(f'{$SIZE/1e6:.0f}')") MB)..."
    if aws s3 cp "$S3_BUCKET/$TAR" "$DEST" --request-payer requester --quiet 2>/dev/null; then
        # Verify md5
        ACTUAL_MD5=$(md5sum "$DEST" | awk '{print $1}')
        if [[ "$ACTUAL_MD5" == "$MD5" ]]; then
            MD5_STATUS="ok"
        else
            MD5_STATUS="mismatch"
            echo "    WARNING: md5 mismatch for $BASENAME (expected $MD5, got $ACTUAL_MD5)"
        fi

        log_event "\"file\":\"$BASENAME\",\"size\":$SIZE,\"md5\":\"$MD5_STATUS\""
        DOWNLOADED=$((DOWNLOADED + 1))
        NEW_BYTES=$((NEW_BYTES + SIZE))
    else
        echo "    FAILED to download $BASENAME"
        log_event "\"file\":\"$BASENAME\",\"size\":$SIZE,\"md5\":\"failed\""
        FAILED=$((FAILED + 1))
    fi
done <<< "$TARS"

echo ""
echo "=== Download Summary ==="
echo "  Month: $MONTH"
echo "  Downloaded: $DOWNLOADED tars ($(python3 -c "print(f'{$NEW_BYTES/1e9:.1f}')") GB)"
echo "  Skipped (already present): $SKIPPED"
echo "  Failed: $FAILED"
echo "  Remaining: $((TOTAL_TARS - DOWNLOADED - SKIPPED)) tars"

#!/bin/bash
# Search validation tests
set -euo pipefail

API="${1:-http://localhost:8080}"
PASS=0
FAIL=0

check() {
    local desc="$1"
    local url="$2"
    local expect="$3"

    result=$(curl -s "$url")
    if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); $expect" 2>/dev/null; then
        echo "  PASS: $desc"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $desc"
        echo "    Response: $(echo "$result" | head -c 200)"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== Search Validation ==="

check "Common term returns results" \
    "$API/api/search?q=neural+network&per_page=5" \
    "assert d['total_files'] > 0"

check "Another common term" \
    "$API/api/search?q=algorithm&per_page=5" \
    "assert d['total_files'] > 0"

check "Math term returns results" \
    "$API/api/search?q=theorem&per_page=5" \
    "assert d['total_files'] > 0"

check "Results have metadata" \
    "$API/api/search?q=transformer&per_page=1" \
    "assert d['results'][0]['title'] != ''"

check "Results have matches" \
    "$API/api/search?q=transformer&per_page=1" \
    "assert len(d['results'][0]['matches']) > 0"

check "Context lines work" \
    "$API/api/search?q=transformer&per_page=1&ctx=2" \
    "assert len(d['results'][0]['matches'][0].get('before', [])) > 0 or len(d['results'][0]['matches'][0].get('after', [])) > 0"

check "Empty query returns error" \
    "$API/api/search?q=" \
    "assert 'error' in d"

check "Health endpoint works" \
    "$API/healthz" \
    "assert d['status'] == 'ok' and d['papers_indexed'] > 0"

check "Paper endpoint works" \
    "$API/api/paper/2602.00010" \
    "assert d['paper_id'] == '2602.00010' and d['title'] != ''"

# Latency test
echo ""
echo "=== Latency Test (10 searches) ==="
total_ms=0
for i in $(seq 1 10); do
    ms=$(curl -s "$API/api/search?q=machine+learning&per_page=10" | python3 -c "import sys,json; print(json.load(sys.stdin)['duration_ms'])")
    total_ms=$((total_ms + ms))
done
avg=$((total_ms / 10))
echo "  Average latency: ${avg}ms"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ $FAIL -eq 0 ] && exit 0 || exit 1

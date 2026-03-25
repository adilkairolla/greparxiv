#!/usr/bin/env python3
"""Validate extraction quality."""

import json
import os
import random
import sys
from pathlib import Path

EXTRACTED_DIR = Path(__file__).resolve().parent.parent / "data" / "extracted"


def validate():
    # Collect extracted papers
    papers = sorted([
        d for d in os.listdir(EXTRACTED_DIR)
        if os.path.isdir(EXTRACTED_DIR / d) and d.startswith('2602.')
    ])

    print(f"Total extracted papers: {len(papers)}")

    # Check for empty/missing paper.txt
    empty = []
    small = []
    sizes = []

    for pid in papers:
        txt_path = EXTRACTED_DIR / pid / "paper.txt"
        if not txt_path.exists():
            empty.append(pid)
            continue
        size = txt_path.stat().st_size
        sizes.append(size)
        if size == 0:
            empty.append(pid)
        elif size < 500:
            small.append(pid)

    print(f"Empty/missing paper.txt: {len(empty)}")
    print(f"Suspiciously small (<500 bytes): {len(small)}")
    if sizes:
        print(f"Size stats: min={min(sizes)}, max={max(sizes)}, "
              f"avg={sum(sizes)//len(sizes)}, "
              f"median={sorted(sizes)[len(sizes)//2]}")

    # Check metadata.json
    has_metadata = 0
    bad_metadata = []
    for pid in papers:
        meta_path = EXTRACTED_DIR / pid / "metadata.json"
        if meta_path.exists():
            try:
                with open(meta_path) as f:
                    data = json.load(f)
                if data.get("title"):
                    has_metadata += 1
                else:
                    bad_metadata.append(pid)
            except json.JSONDecodeError:
                bad_metadata.append(pid)

    print(f"Papers with valid metadata: {has_metadata}")
    print(f"Papers with bad/missing metadata: {len(bad_metadata)}")

    # Spot-check: sample 10 random papers
    sample = random.sample(papers, min(10, len(papers)))
    print(f"\n--- Spot-check ({len(sample)} random papers) ---")

    latex_remnants = ['\\usepackage', '\\documentclass', '\\begin{document}',
                      '\\end{document}', '\\newcommand']
    warnings = 0

    for pid in sample:
        txt_path = EXTRACTED_DIR / pid / "paper.txt"
        if not txt_path.exists():
            print(f"  {pid}: MISSING paper.txt")
            continue

        with open(txt_path, 'r', encoding='utf-8') as f:
            text = f.read()

        issues = []
        for remnant in latex_remnants:
            if remnant in text:
                issues.append(remnant)

        status = "OK" if not issues else f"WARN: contains {', '.join(issues)}"
        if issues:
            warnings += 1

        lines = text.split('\n')
        preview = ' | '.join(lines[:3])[:120]
        print(f"  {pid} ({len(text)} bytes, {len(lines)} lines): {status}")
        print(f"    Preview: {preview}")

    if warnings:
        print(f"\n{warnings}/{len(sample)} samples have LaTeX remnants (may be OK in math)")

    return 0 if not empty else 1


if __name__ == '__main__':
    sys.exit(validate())

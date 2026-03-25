#!/usr/bin/env python3
"""
Extract clean greppable text from arXiv LaTeX source archives.

Usage:
    python pipeline/extract.py                     # extract all papers
    python pipeline/extract.py --resume            # skip already-extracted
    python pipeline/extract.py --workers 8         # parallel extraction
    python pipeline/extract.py --fetch-metadata    # fetch metadata from arXiv API
"""

import argparse
import gzip
import json
import os
import sys
import tarfile
import tempfile
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from tex_stripper import strip_latex

# Directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "data" / "src" / "2602"
EXTRACTED_DIR = PROJECT_ROOT / "data" / "extracted"


def process_paper(gz_path: str, output_dir: str, resume: bool = False) -> dict:
    """Process a single .gz paper archive.

    Returns a dict with status info for logging.
    """
    paper_id = Path(gz_path).stem  # e.g., "2602.00001"
    paper_out = Path(output_dir) / paper_id
    result = {"paper_id": paper_id, "status": "ok", "text_bytes": 0, "error": None}

    # Resume: skip if already extracted
    paper_txt = paper_out / "paper.txt"
    if resume and paper_txt.exists() and paper_txt.stat().st_size > 0:
        result["status"] = "skipped"
        return result

    try:
        # Decompress .gz → tar
        with gzip.open(gz_path, 'rb') as gz:
            raw = gz.read()

        # Check if it's a tar archive
        tmpdir = tempfile.mkdtemp(prefix="arxiv_")
        try:
            tar_path = os.path.join(tmpdir, "paper.tar")
            with open(tar_path, 'wb') as f:
                f.write(raw)

            if not tarfile.is_tarfile(tar_path):
                # Single file submission (just a .tex compressed with gzip)
                try:
                    latex_source = raw.decode('utf-8', errors='replace')
                    plain_text = strip_latex(latex_source, base_dir=tmpdir)
                    paper_out.mkdir(parents=True, exist_ok=True)
                    with open(paper_txt, 'w', encoding='utf-8') as f:
                        f.write(plain_text)
                    result["text_bytes"] = len(plain_text.encode('utf-8'))
                    if result["text_bytes"] < 100:
                        result["status"] = "warning_small"
                except Exception as e:
                    result["status"] = "error"
                    result["error"] = f"Single file processing failed: {e}"
                finally:
                    import shutil
                    shutil.rmtree(tmpdir, ignore_errors=True)
                return result

            with tarfile.open(tar_path) as tar:
                # Safety: avoid path traversal
                safe_members = []
                for m in tar.getmembers():
                    if m.name.startswith('/') or '..' in m.name:
                        continue
                    safe_members.append(m)
                tar.extractall(tmpdir, members=safe_members, filter='data')

            # Read 00README.json to find toplevel tex file
            readme_path = os.path.join(tmpdir, "00README.json")
            main_tex = None

            if os.path.exists(readme_path):
                with open(readme_path, 'r', encoding='utf-8', errors='replace') as f:
                    readme = json.load(f)
                for source in readme.get("sources", []):
                    if source.get("usage") == "toplevel":
                        main_tex = source.get("filename")
                        break

            if not main_tex:
                # Fallback: find .tex file containing \begin{document}
                main_tex = _find_main_tex(tmpdir)

            if not main_tex:
                result["status"] = "no_tex"
                result["error"] = "No main .tex file found"
                return result

            main_tex_path = os.path.join(tmpdir, main_tex)
            if not os.path.isfile(main_tex_path):
                result["status"] = "missing_tex"
                result["error"] = f"Main tex file not found: {main_tex}"
                return result

            # Read and strip LaTeX
            with open(main_tex_path, 'r', encoding='utf-8', errors='replace') as f:
                latex_source = f.read()

            base_dir = os.path.dirname(main_tex_path) or tmpdir
            plain_text = strip_latex(latex_source, base_dir=base_dir)

            # Write output
            paper_out.mkdir(parents=True, exist_ok=True)
            with open(paper_txt, 'w', encoding='utf-8') as f:
                f.write(plain_text)

            result["text_bytes"] = len(plain_text.encode('utf-8'))
            if result["text_bytes"] < 100:
                result["status"] = "warning_small"

        finally:
            # Cleanup tmpdir
            import shutil
            shutil.rmtree(tmpdir, ignore_errors=True)

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


def _find_main_tex(directory: str) -> str | None:
    """Find the .tex file containing \\begin{document}."""
    for root, _, files in os.walk(directory):
        for fname in files:
            if fname.endswith('.tex'):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read(50000)  # Read first 50KB
                    if r'\begin{document}' in content:
                        return os.path.relpath(fpath, directory)
                except Exception:
                    continue
    return None


def extract_all(workers: int = 4, resume: bool = False):
    """Extract all papers from source archives."""
    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)

    # Collect all .gz files
    gz_files = sorted([
        str(SRC_DIR / f) for f in os.listdir(SRC_DIR)
        if f.endswith('.gz')
    ])

    total = len(gz_files)
    print(f"Found {total} .gz archives to process")
    print(f"Workers: {workers}, Resume: {resume}")
    print(f"Output: {EXTRACTED_DIR}")
    print()

    stats = {"ok": 0, "skipped": 0, "error": 0, "warning_small": 0,
             "no_tex": 0, "not_tar": 0, "missing_tex": 0}
    errors = []
    start_time = time.time()

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(process_paper, gz, str(EXTRACTED_DIR), resume): gz
            for gz in gz_files
        }

        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            status = result["status"]
            stats[status] = stats.get(status, 0) + 1

            if result["error"]:
                errors.append(result)
                print(f"  [{i}/{total}] FAIL {result['paper_id']}: {result['error']}",
                      file=sys.stderr)
            elif status == "skipped":
                pass  # quiet
            else:
                if i % 100 == 0 or i == total:
                    elapsed = time.time() - start_time
                    rate = i / elapsed if elapsed > 0 else 0
                    print(f"  [{i}/{total}] {rate:.1f} papers/sec")

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  OK: {stats['ok']}")
    print(f"  Skipped (resume): {stats['skipped']}")
    print(f"  Small (<100 bytes): {stats['warning_small']}")
    print(f"  No tex: {stats['no_tex']}")
    print(f"  Not tar: {stats['not_tar']}")
    print(f"  Missing tex: {stats['missing_tex']}")
    print(f"  Errors: {stats['error']}")

    if errors:
        print(f"\nFailed papers:")
        for e in errors[:20]:
            print(f"  {e['paper_id']}: {e['error']}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")


def fetch_metadata():
    """Fetch metadata from arXiv API for all extracted papers."""
    # Collect paper IDs
    paper_ids = sorted([
        d for d in os.listdir(EXTRACTED_DIR)
        if os.path.isdir(EXTRACTED_DIR / d) and d.startswith('2602.')
    ])

    # Filter to papers that don't already have metadata
    to_fetch = [
        pid for pid in paper_ids
        if not (EXTRACTED_DIR / pid / "metadata.json").exists()
    ]

    print(f"Total papers: {len(paper_ids)}")
    print(f"Need metadata: {len(to_fetch)}")

    if not to_fetch:
        print("All papers already have metadata.")
        return

    # Batch fetch from arXiv API (max 100 per request)
    batch_size = 100
    fetched = 0
    failed = 0

    for batch_start in range(0, len(to_fetch), batch_size):
        batch = to_fetch[batch_start:batch_start + batch_size]
        id_list = ','.join(batch)
        url = f"https://export.arxiv.org/api/query?id_list={id_list}&max_results={len(batch)}"

        print(f"  Fetching batch {batch_start // batch_size + 1} "
              f"({len(batch)} papers)...")

        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'greparxiv/1.0 (https://github.com/greparxiv)'
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                xml_data = resp.read().decode('utf-8')

            # Parse Atom XML
            ns = {
                'atom': 'http://www.w3.org/2005/Atom',
                'arxiv': 'http://arxiv.org/schemas/atom',
            }
            root = ET.fromstring(xml_data)

            for entry in root.findall('atom:entry', ns):
                paper_id = _extract_arxiv_id(entry, ns)
                if not paper_id:
                    continue

                metadata = {
                    "paper_id": paper_id,
                    "title": _get_text(entry, 'atom:title', ns).replace('\n', ' ').strip(),
                    "authors": [
                        a.find('atom:name', ns).text
                        for a in entry.findall('atom:author', ns)
                        if a.find('atom:name', ns) is not None
                    ],
                    "abstract": _get_text(entry, 'atom:summary', ns).strip(),
                    "categories": [
                        c.get('term') for c in entry.findall('atom:category', ns)
                    ],
                    "primary_category": entry.find('arxiv:primary_category', ns).get('term')
                    if entry.find('arxiv:primary_category', ns) is not None else "",
                    "published": _get_text(entry, 'atom:published', ns),
                    "updated": _get_text(entry, 'atom:updated', ns),
                    "arxiv_url": f"https://arxiv.org/abs/{paper_id}",
                    "pdf_url": f"https://arxiv.org/pdf/{paper_id}",
                }

                out_path = EXTRACTED_DIR / paper_id / "metadata.json"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with open(out_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)

                fetched += 1

        except Exception as e:
            print(f"  ERROR fetching batch: {e}", file=sys.stderr)
            failed += len(batch)

        # Rate limit: 3 seconds between requests (arXiv policy)
        if batch_start + batch_size < len(to_fetch):
            time.sleep(3)

    print(f"\nMetadata fetch complete: {fetched} fetched, {failed} failed")


def _extract_arxiv_id(entry, ns: dict) -> str | None:
    """Extract paper ID from an Atom entry."""
    id_text = _get_text(entry, 'atom:id', ns)
    # Format: http://arxiv.org/abs/2602.00001v1
    if '/abs/' in id_text:
        raw_id = id_text.split('/abs/')[-1]
        # Strip version suffix
        return raw_id.split('v')[0] if 'v' in raw_id else raw_id
    return None


def _get_text(element, tag: str, ns: dict) -> str:
    """Safely get text content from an XML element."""
    el = element.find(tag, ns)
    return el.text if el is not None and el.text else ""


def main():
    parser = argparse.ArgumentParser(description="Extract text from arXiv LaTeX sources")
    parser.add_argument('--workers', type=int, default=os.cpu_count() or 4,
                        help='Number of parallel workers')
    parser.add_argument('--resume', action='store_true',
                        help='Skip already-extracted papers')
    parser.add_argument('--fetch-metadata', action='store_true',
                        help='Fetch metadata from arXiv API')
    args = parser.parse_args()

    if args.fetch_metadata:
        fetch_metadata()
    else:
        extract_all(workers=args.workers, resume=args.resume)


if __name__ == '__main__':
    main()

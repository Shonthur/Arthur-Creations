#!/usr/bin/env python3
"""
Turn every PDF in graphics-src/ into HD page images for the Graphics gallery.

How to use (simple):
  1. Put your PDF in the graphics-src/ folder.
     (Optional) Put a small file with the same name next to it, e.g.
     graphics-src/2027-calendar.json  to set the title, category, year, etc.
  2. Run:  python scripts/build_graphics.py
  3. Commit the new files in assets/graphics/ and push.

On GitHub the same script runs by itself when you upload a PDF
(see .github/workflows/build-graphics.yml).

Needs: poppler-utils (the "pdftoppm" and "pdfinfo" programs) and Pillow.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "graphics-src"
OUT_DIR = ROOT / "assets" / "graphics"
INDEX_FILE = OUT_DIR / "projects.json"

FULL_LONG_EDGE = 2600   # pixels on the longest side of each HD page image
THUMB_LONG_EDGE = 720   # pixels for the small preview images
FULL_QUALITY = 90
THUMB_QUALITY = 82
BUILD_VERSION = 2       # change this number to force a full rebuild of all projects


def slugify(text):
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return text or "project"


def pretty_title(stem):
    words = re.sub(r"[_\-]+", " ", stem).strip()
    return words[:1].upper() + words[1:] if words else "Untitled"


def file_hash(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def load_meta(pdf_path):
    meta_path = pdf_path.with_suffix(".json")
    if not meta_path.exists():
        return {}
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError) as err:
        print(f"  ! Could not read {meta_path.name}: {err}. Using defaults.")
        return {}


def fit_long_edge(img, long_edge):
    w, h = img.size
    scale = long_edge / max(w, h)
    if scale >= 1:
        return img
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def average_color(img):
    tiny = img.convert("RGB").resize((1, 1), Image.BOX)
    r, g, b = tiny.getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


def render_pdf(pdf_path, out_folder):
    """Render all pages. Returns a list of page dictionaries."""
    pages = []
    with tempfile.TemporaryDirectory() as tmp:
        prefix = Path(tmp) / "page"
        cmd = [
            "pdftoppm", "-png",
            "-scale-to", str(FULL_LONG_EDGE),
            str(pdf_path), str(prefix),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"pdftoppm failed: {result.stderr.strip()}")

        pngs = sorted(Path(tmp).glob("page-*.png"))
        if not pngs:
            raise RuntimeError("No pages were produced. Is the PDF empty or damaged?")

        for number, png in enumerate(pngs, start=1):
            with Image.open(png) as raw:
                img = raw.convert("RGB")
                full = fit_long_edge(img, FULL_LONG_EDGE)
                thumb = fit_long_edge(img, THUMB_LONG_EDGE)

                full_name = f"p{number:02d}.webp"
                thumb_name = f"t{number:02d}.webp"
                full.save(out_folder / full_name, "WEBP", quality=FULL_QUALITY, method=6)
                thumb.save(out_folder / thumb_name, "WEBP", quality=THUMB_QUALITY, method=6)

                pages.append({
                    "full": full_name,
                    "thumb": thumb_name,
                    "w": full.size[0],
                    "h": full.size[1],
                    "color": average_color(thumb),
                })
            print(f"    page {number}/{len(pngs)}  {full.size[0]}x{full.size[1]}")
    return pages


def build_project(pdf_path, existing):
    stem = pdf_path.stem
    slug = slugify(stem)
    meta = load_meta(pdf_path)
    digest = file_hash(pdf_path)
    out_folder = OUT_DIR / slug

    unchanged = (
        existing
        and existing.get("hash") == digest
        and existing.get("build") == BUILD_VERSION
        and out_folder.exists()
    )

    if unchanged:
        print(f"- {pdf_path.name}: no change, keeping existing images")
        pages = existing["pages"]
    else:
        print(f"- {pdf_path.name}: rendering pages...")
        if out_folder.exists():
            shutil.rmtree(out_folder)
        out_folder.mkdir(parents=True, exist_ok=True)
        pages = render_pdf(pdf_path, out_folder)

    # Offer the original PDF as a download unless turned off or too big.
    pdf_name = None
    allow_download = meta.get("download", True)
    size_mb = pdf_path.stat().st_size / (1024 * 1024)
    if allow_download and size_mb <= 40:
        target = out_folder / f"{slug}.pdf"
        if not target.exists() or not unchanged:
            shutil.copyfile(pdf_path, target)
        pdf_name = f"{slug}.pdf"
    elif allow_download:
        print(f"  ! {pdf_path.name} is {size_mb:.0f} MB, too big for a download link. Skipped.")

    return {
        "slug": slug,
        "title": meta.get("title") or pretty_title(stem),
        "category": meta.get("category") or "Design",
        "year": str(meta.get("year") or ""),
        "tools": meta.get("tools") or [],
        "description": meta.get("description") or "",
        "order": meta.get("order", 0),
        "pdf": pdf_name,
        "pages": pages,
        "hash": digest,
        "build": BUILD_VERSION,
        "added": (existing or {}).get("added") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def main():
    parser = argparse.ArgumentParser(description="Build the Graphics gallery from PDFs.")
    parser.add_argument("--force", action="store_true", help="re-render every PDF")
    args = parser.parse_args()

    for tool in ("pdftoppm",):
        if shutil.which(tool) is None:
            sys.exit(f"'{tool}' was not found. Install poppler-utils first "
                     "(Ubuntu: sudo apt install poppler-utils, Mac: brew install poppler).")

    SRC_DIR.mkdir(exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Projects made by the browser upload page (source == "browser") are never touched here.
    previous = {}
    if INDEX_FILE.exists():
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                for p in json.load(f).get("projects", []):
                    previous[p["slug"]] = p
        except (json.JSONDecodeError, OSError, KeyError):
            previous = {}
    browser_projects = {k: v for k, v in previous.items() if v.get("source") == "browser"}
    if args.force:
        previous = {}

    pdfs = sorted(SRC_DIR.glob("*.pdf")) + sorted(SRC_DIR.glob("*.PDF"))
    projects, seen = [], set()

    for pdf in pdfs:
        slug = slugify(pdf.stem)
        if slug in seen:
            print(f"- {pdf.name}: skipped, another file already uses the name '{slug}'")
            continue
        seen.add(slug)
        try:
            projects.append(build_project(pdf, previous.get(slug)))
        except Exception as err:  # keep going if one PDF is bad
            print(f"  ! Could not build {pdf.name}: {err}")

    # Keep browser-made projects (unless a PDF with the same name now replaces them).
    for slug, project in browser_projects.items():
        if slug not in seen:
            projects.append(project)

    # Remove folders of PDFs that were deleted.
    for folder in OUT_DIR.iterdir():
        if folder.is_dir() and folder.name not in seen and folder.name not in browser_projects:
            print(f"- removing old project folder: {folder.name}")
            shutil.rmtree(folder)

    # Newest first, unless you set "order" in the JSON (lower number shows first).
    def added_number(p):
        digits = str(p.get("added", "")).replace("-", "")
        return int(digits) if digits.isdigit() else 0

    projects.sort(key=lambda p: (p.get("order", 0) == 0, p.get("order", 0), -added_number(p)))

    index = {"projects": projects}
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    total_pages = sum(len(p["pages"]) for p in projects)
    print(f"\nDone. {len(projects)} project(s), {total_pages} page image(s).")


if __name__ == "__main__":
    main()

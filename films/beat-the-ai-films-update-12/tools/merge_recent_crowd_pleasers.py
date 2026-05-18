#!/usr/bin/env python3
"""
Merge the recent/crowd-pleaser supplement into data/films.json.

Run from the /films folder:

  python3 tools/merge_recent_crowd_pleasers.py

Options:

  --replace-existing    refresh matching films from the supplement
  --dry-run             show what would change without writing
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILMS = DATA / "films.json"
SUPPLEMENT = DATA / "recent-crowd-pleasers.json"

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def backup(path: Path):
    if not path.exists():
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_dir / f"{path.stem}-{stamp}{path.suffix}")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replace-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    films = load(FILMS)
    supplement = load(SUPPLEMENT)

    by_slug = {film["slug"]: film for film in films}
    added = []
    replaced = []

    for film in supplement:
        slug = film["slug"]
        if slug in by_slug:
            if args.replace_existing:
                by_slug[slug] = {**by_slug[slug], **film}
                replaced.append(slug)
            continue
        by_slug[slug] = film
        added.append(slug)

    # Keep existing order, append genuinely new supplement films.
    merged = []
    seen = set()
    for film in films:
        slug = film["slug"]
        merged.append(by_slug[slug])
        seen.add(slug)
    for film in supplement:
        if film["slug"] not in seen:
            merged.append(by_slug[film["slug"]])
            seen.add(film["slug"])

    print(f"Existing films: {len(films)}")
    print(f"Supplement films: {len(supplement)}")
    print(f"Added: {len(added)}")
    print(f"Replaced: {len(replaced)}")
    if added:
        print("Added slugs:")
        for slug in added:
            print(f"  + {slug}")

    if args.dry_run:
        print("Dry run only. No file written.")
        return 0

    backup(FILMS)
    FILMS.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(merged)} films to {FILMS}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

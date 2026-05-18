#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILMS = DATA / "films.json"
IMPORTS = DATA / "imports"

def slugify(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")

def clean(value) -> str:
    return "" if value is None else str(value).strip()

def film_slug(title: str, year: str) -> str:
    return slugify(f"{title}-{year}")

def split_tags(value: str) -> list[str]:
    return sorted({x.strip().lower() for x in re.split(r"[;,]", value or "") if x.strip()})

def backup(path: Path) -> None:
    if not path.exists():
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_dir / f"{path.stem}-{stamp}{path.suffix}")

def load_films():
    return json.loads(FILMS.read_text(encoding="utf-8"))

def save_films(films):
    backup(FILMS)
    FILMS.write_text(json.dumps(films, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def default_ai_line(title: str, list_name: str) -> str:
    lower = list_name.lower()
    if "best picture" in lower:
        return f"{title} entered the Best Picture conversation; now it has to survive one sentence."
    if "20c" in lower or "20th" in lower:
        return f"{title} carries the twentieth century into a single challenge line, which is obviously unfair."
    return f"{title} has been added to the challenge list. This AI line is waiting to be beaten."

def merge_row(existing, row):
    title = clean(row.get("title"))
    year = clean(row.get("year"))
    if not title or not year:
        raise ValueError("Every row needs title and year")

    slug = clean(row.get("slug")) or film_slug(title, year)
    list_name = clean(row.get("list_name")) or "uploaded-list"
    source = clean(row.get("source")) or "Manual upload"
    award_year = clean(row.get("award_year"))
    result = clean(row.get("result")).lower()

    tags = split_tags(row.get("tags", ""))
    tags.append(slugify(list_name))
    if award_year:
        tags += ["21c-best-picture", "oscar-best-picture-nominee", f"best-picture-{award_year}"]
    if result == "winner":
        tags.append("oscar-winner")
    tags = sorted(set(tags))

    runtime = clean(row.get("runtime_minutes"))
    rating = clean(row.get("rating"))
    ai_review = clean(row.get("ai_review"))
    review = clean(row.get("review"))

    if existing:
        film = dict(existing)
        film["tags"] = sorted(set((film.get("tags") or []) + tags))
    else:
        film = {
            "slug": slug,
            "rank": None,
            "previous_rank": None,
            "title": title,
            "year": int(year),
            "director": clean(row.get("director")) or "Unknown",
            "country": clean(row.get("country")) or "Unknown",
            "runtime_minutes": int(runtime) if runtime.isdigit() else None,
            "colour": clean(row.get("colour")) or "Col",
            "rating": int(rating) if rating.isdigit() else 0,
            "tags": tags,
            "review": review or "Human champion pending.",
            "ai_review": ai_review or default_ai_line(title, list_name),
            "ai_style": "uploaded",
            "ai_rematch": "",
            "winner": "",
            "challenge_round": 1,
            "status": "pending",
            "source": source,
            "list_memberships": [],
        }

    for key in ["director", "country", "colour"]:
        value = clean(row.get(key))
        if value and (not film.get(key) or film.get(key) == "Unknown"):
            film[key] = value

    if runtime.isdigit() and not film.get("runtime_minutes"):
        film["runtime_minutes"] = int(runtime)
    if rating.isdigit() and not film.get("rating"):
        film["rating"] = int(rating)
    if ai_review and (not film.get("ai_review") or film.get("ai_style") == "uploaded"):
        film["ai_review"] = ai_review
    if review and (not film.get("review") or film.get("review") == "Human champion pending."):
        film["review"] = review

    membership = {"list_name": list_name, "source": source}
    if award_year:
        membership["award_year"] = award_year
    if result:
        membership["result"] = result

    memberships = film.setdefault("list_memberships", [])
    if membership not in memberships:
        memberships.append(membership)

    return film

def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def import_file(path: Path, films):
    by_slug = {film.get("slug"): film for film in films}
    added = updated = errors = 0

    for line_no, row in enumerate(read_csv(path), start=2):
        try:
            title = clean(row.get("title"))
            year = clean(row.get("year"))
            slug = clean(row.get("slug")) or film_slug(title, year)
            existing = by_slug.get(slug)
            merged = merge_row(existing, row)
            by_slug[slug] = merged
            if existing:
                updated += 1
            else:
                films.append(merged)
                added += 1
        except Exception as exc:
            errors += 1
            print(f"ERROR {path.name}:{line_no}: {exc}")

    return [by_slug.get(film.get("slug"), film) for film in films], added, updated, errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path, action="append")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = []
    if args.all:
        files.extend(p for p in sorted(IMPORTS.glob("*.csv")) if not p.name.endswith("-template.csv"))
    if args.file:
        files.extend(args.file)

    if not files:
        raise SystemExit("No files selected. Use --file path.csv or --all.")

    films = load_films()
    total_added = total_updated = total_errors = 0

    for path in files:
        films, added, updated, errors = import_file(path, films)
        print(f"{path}: added {added}, updated {updated}, errors {errors}")
        total_added += added
        total_updated += updated
        total_errors += errors

    print(f"Total: added {total_added}, updated {total_updated}, errors {total_errors}")
    print(f"Final film count: {len(films)}")

    if args.dry_run:
        print("Dry run only. No file written.")
        return

    save_films(films)
    print(f"Wrote {FILMS}")

if __name__ == "__main__":
    main()

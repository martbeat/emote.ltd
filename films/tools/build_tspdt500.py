#!/usr/bin/env python3
"""
Build films.json from the TSPDT 1,000 Greatest Films ranked page.

Default:
  - downloads the current TSPDT ranked list
  - parses the top 500
  - creates data/films.json
  - creates backups before overwriting
  - gives each film a deliberately mixed AI challenge line

Run from the /films folder:

  python3 tools/build_tspdt500.py

Options:

  python3 tools/build_tspdt500.py --limit 500
  python3 tools/build_tspdt500.py --dry-run
  python3 tools/build_tspdt500.py --preserve-existing

The generated "ai_review" field is not trying to be the final review.
It is deliberately uneven: some lines are poetic, some flat, some provocative,
some dumb and some bait-like. The aim is to invite people to beat it.
"""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import shutil
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILMS_JSON = DATA / "films.json"
SOURCE_URL = "https://theyshootpictures.com/gf1000_all1000films.htm"

USER_AGENT = "Mozilla/5.0 (compatible; BeatTheAI-FilmSeed/1.0; +https://emote.ltd/films/)"

GENRE_TAGS = {
    "western": ["western", "frontier"],
    "samurai": ["samurai", "honour"],
    "godfather": ["crime", "family"],
    "noir": ["noir", "crime"],
    "detective": ["noir", "mystery"],
    "space": ["science fiction", "cosmos"],
    "alien": ["science fiction", "horror"],
    "matrix": ["science fiction", "reality"],
    "star wars": ["science fiction", "myth"],
    "city": ["city", "modernity"],
    "rain": ["weather", "melodrama"],
    "journey": ["journey", "memory"],
    "children": ["childhood", "society"],
    "woman": ["gender", "society"],
    "man": ["identity"],
    "love": ["love"],
    "death": ["mortality"],
    "war": ["war"],
    "battle": ["war"],
    "night": ["night", "shadow"],
    "spring": ["season", "family"],
    "summer": ["season", "youth"],
    "red": ["colour", "memory"],
    "blue": ["colour", "melancholy"],
}

STYLE_NAMES = [
    "flat",
    "poetic",
    "provocative",
    "dumb",
    "grandiose",
    "nearly_wrong",
    "challenge_bait",
    "bureaucratic",
    "overcompressed",
    "sensory",
]

COUNTRY_TAG_MAP = {
    "USA": ["usa"],
    "UK": ["britain"],
    "France": ["france"],
    "Italy": ["italy"],
    "Japan": ["japan"],
    "Mexico": ["mexico"],
    "Germany": ["germany"],
    "USSR": ["soviet cinema"],
    "Sweden": ["sweden"],
    "India": ["india"],
    "Iran": ["iran"],
    "Spain": ["spain"],
    "Brazil": ["brazil"],
    "China": ["china"],
    "Taiwan": ["taiwan"],
    "Hong Kong": ["hong kong"],
    "South Korea": ["south korea"],
    "Argentina": ["argentina"],
}

def fetch_source() -> str:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")

def strip_tags(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p>|</div>|</li>|</tr>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n\s+", "\n", value)
    return value

def title_case_film(title: str) -> str:
    keep_upper = {"M", "E.T.", "F", "8½", "2", "3"}
    words = []
    for raw in title.split(" "):
        if raw in keep_upper or any(ch.isdigit() for ch in raw):
            words.append(raw)
        elif raw in {"L'ATALANTE", "L'AVVENTURA", "L'ARGENT", "L'ÂGE", "L'ECLISSE"}:
            words.append(raw[0] + raw[1:].lower())
        elif raw in {"DR.", "MR.", "MRS."}:
            words.append(raw.title())
        else:
            words.append(raw.capitalize())
    return " ".join(words).replace("Ii", "II").replace("Iii", "III").replace("Iv", "IV")

def slugify(value: str) -> str:
    # Keep this ASCII only so it mirrors the frontend's expected ids closely enough.
    import unicodedata
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")

def split_country(raw: str) -> str:
    raw = raw.strip()
    parts = [part.strip() for part in raw.split("-") if part.strip()]
    if not parts:
        return raw
    return "-".join(parts)

def parse_entries(source_text: str) -> list[dict[str, Any]]:
    text = strip_tags(source_text)
    entries: list[dict[str, Any]] = []

    # Example:
    # 1. (1) CITIZEN KANE (Orson Welles, 1941, USA, 119m, BW)
    # 140. (138) HISTOIRE(S) DU CINÉMA (Jean-Luc Godard, 1988-98, France, 267m, Col-BW)
    pattern = re.compile(
        r"(?m)^\s*(?P<rank>\d{1,4})\.\s+\((?P<previous>[^)]*)\)\s+"
        r"(?P<title>.+?)\s+\("
        r"(?P<director>.+?),\s+"
        r"(?P<year>\d{4}(?:-\d{2})?),\s+"
        r"(?P<country>.+?),\s+"
        r"(?P<runtime>\d+)m,\s+"
        r"(?P<colour>[^)]+)\)"
    )

    for match in pattern.finditer(text):
        rank = int(match.group("rank"))
        title_raw = match.group("title").strip()
        title = title_case_film(title_raw)

        year_raw = match.group("year")
        year = int(year_raw[:4])

        entry = {
            "rank": rank,
            "previous_rank": match.group("previous").strip(),
            "slug": slugify(f"{title}-{year}"),
            "title": title,
            "year": year,
            "director": match.group("director").strip(),
            "country": split_country(match.group("country")),
            "runtime_minutes": int(match.group("runtime")),
            "colour": match.group("colour").strip(),
        }
        entries.append(entry)

    entries.sort(key=lambda item: item["rank"])
    return entries

def decade_tag(year: int) -> str:
    return f"{year // 10 * 10}s"

def infer_tags(film: dict[str, Any]) -> list[str]:
    title_l = film["title"].lower()
    director_l = film["director"].lower()
    country = film["country"]

    tags = {"canon", decade_tag(film["year"])}

    for key, values in COUNTRY_TAG_MAP.items():
        if key.lower() in country.lower():
            tags.update(values)

    for key, values in GENRE_TAGS.items():
        if key in title_l:
            tags.update(values)

    if "hitchcock" in director_l:
        tags.update(["suspense"])
    if "buñuel" in director_l or "bunuel" in director_l:
        tags.update(["surrealism"])
    if "ozu" in director_l:
        tags.update(["family", "stillness"])
    if "kubrick" in director_l:
        tags.update(["control"])
    if "godard" in director_l:
        tags.update(["modernism"])
    if "fellini" in director_l:
        tags.update(["memory", "performance"])
    if "bergman" in director_l:
        tags.update(["faith", "identity"])
    if "tarkovsky" in director_l:
        tags.update(["time", "spirituality"])
    if "scorsese" in director_l:
        tags.update(["guilt", "violence"])
    if "kurosawa" in director_l:
        tags.update(["honour", "movement"])

    return sorted(tags)

def rating_for_rank(rank: int) -> int:
    if rank <= 50:
        return 10
    if rank <= 200:
        return 9
    if rank <= 400:
        return 8
    return 7

def style_for_rank(rank: int) -> str:
    # Deterministic but mixed. Dumb/bait lines appear throughout rather than only at the bottom.
    style = STYLE_NAMES[(rank * 7 + rank // 11) % len(STYLE_NAMES)]
    if rank <= 20 and style in {"dumb", "nearly_wrong"}:
        style = "poetic"
    return style

def ai_line_for(film: dict[str, Any], style: str) -> str:
    title = film["title"]
    director = film["director"].split(" & ")[0]
    country = film["country"]
    year = film["year"]
    rank = film["rank"]

    flat = [
        f"A highly regarded {year} film by {director} that remains important to cinema history.",
        f"A major work from {country} that critics keep returning to for reasons probably worth arguing about.",
        f"A canon film about people, images and consequences, which is very nearly all films if you say it fast enough.",
    ]

    poetic = [
        f"A film that feels less projected than remembered, as if {director} found a way to make time visible.",
        f"{title} turns cinema into a room where memory, light and regret refuse to sit separately.",
        f"A film that behaves like a dream pretending to be evidence.",
    ]

    provocative = [
        f"Possibly a masterpiece, possibly a very successful hostage situation carried out by film critics.",
        f"{title} survives because it gives the canon exactly what the canon thinks it deserves.",
        f"A film so admired that disagreeing with it feels like interrupting a funeral.",
    ]

    dumb = [
        f"Old film does important film things. People look serious. Cinema wins.",
        f"Basically: vibes, people, camera, consequences.",
        f"A movie where the director directed and the ranking committee nodded very hard.",
    ]

    grandiose = [
        f"Not so much a film as an argument that cinema was invented so this could eventually happen.",
        f"{title} enters the room wearing the full ceremonial robes of the canon.",
        f"A monument disguised as a movie, with just enough human damage to stop it becoming furniture.",
    ]

    nearly_wrong = [
        f"A cheerful little romp, except for all the dread, silence and historical weight.",
        f"This is probably a comedy if your definition of comedy has been through a serious institutional failure.",
        f"A simple entertainment about nothing in particular, provided you ignore the entire film.",
    ]

    challenge_bait = [
        f"Sure, it is ranked #{rank}, but can anyone explain why without using the word ‘form’?",
        f"AI summary: important film is important. Human task: make that less useless.",
        f"This line is intentionally inadequate. Please rescue {title} from it.",
    ]

    bureaucratic = [
        f"A formally significant moving-image artefact with measurable heritage value and probable emotional outputs.",
        f"{title} appears to satisfy multiple criteria for continued inclusion in the cinematic canon.",
        f"Stakeholders may wish to note that this film has achieved sustained reputational impact.",
    ]

    overcompressed = [
        f"Desire, structure, memory, damage: cinema doing the cinema thing.",
        f"One sentence cannot hold this film, which is convenient because this one barely tries.",
        f"Image plus time plus pain, compressed until it looks like art.",
    ]

    sensory = [
        f"A film you can almost hear breathing between the cuts.",
        f"{title} feels built from light, dust and whatever people fail to say in time.",
        f"The kind of film where the air around the characters starts doing half the acting.",
    ]

    bank = {
        "flat": flat,
        "poetic": poetic,
        "provocative": provocative,
        "dumb": dumb,
        "grandiose": grandiose,
        "nearly_wrong": nearly_wrong,
        "challenge_bait": challenge_bait,
        "bureaucratic": bureaucratic,
        "overcompressed": overcompressed,
        "sensory": sensory,
    }

    # Stable variety without external randomness.
    options = bank[style]
    return options[(rank + len(title)) % len(options)]

def build_films(entries: list[dict[str, Any]], limit: int, preserve_existing: bool) -> list[dict[str, Any]]:
    existing_by_slug: dict[str, dict[str, Any]] = {}
    if preserve_existing and FILMS_JSON.exists():
        try:
            existing = json.loads(FILMS_JSON.read_text(encoding="utf-8"))
            existing_by_slug = {item.get("slug"): item for item in existing if item.get("slug")}
        except Exception:
            existing_by_slug = {}

    output = []
    for film in entries[:limit]:
        style = style_for_rank(film["rank"])
        previous = existing_by_slug.get(film["slug"], {})

        record = {
            "slug": film["slug"],
            "rank": film["rank"],
            "previous_rank": film["previous_rank"],
            "title": film["title"],
            "year": film["year"],
            "director": film["director"],
            "country": film["country"],
            "runtime_minutes": film["runtime_minutes"],
            "colour": film["colour"],
            "rating": previous.get("rating", rating_for_rank(film["rank"])),
            "tags": previous.get("tags", infer_tags(film)),
            "review": previous.get("review", "Human champion pending."),
            "ai_review": previous.get("ai_review", ai_line_for(film, style)),
            "ai_style": previous.get("ai_style", style),
            "ai_rematch": previous.get("ai_rematch", ""),
            "winner": previous.get("winner", ""),
            "challenge_round": previous.get("challenge_round", 1),
            "status": previous.get("status", "pending"),
            "source": "TSPDT 1,000 Greatest Films, 2026 edition",
        }
        output.append(record)

    return output

def backup_file(path: Path) -> None:
    if not path.exists():
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_dir / f"{path.stem}-{stamp}{path.suffix}")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--preserve-existing", action="store_true", help="keep existing reviews, tags, ratings and AI lines where slug matches")
    parser.add_argument("--source-file", type=Path, help="use a previously downloaded TSPDT HTML file")
    args = parser.parse_args()

    if args.limit < 1 or args.limit > 1000:
        raise SystemExit("--limit must be between 1 and 1000")

    source = args.source_file.read_text(encoding="utf-8") if args.source_file else fetch_source()
    entries = parse_entries(source)

    if len(entries) < args.limit:
        raise SystemExit(f"Only parsed {len(entries)} films, cannot build {args.limit}")

    films = build_films(entries, args.limit, args.preserve_existing)

    if args.dry_run:
        print(json.dumps(films[:5], ensure_ascii=False, indent=2))
        print(f"\nDry run: parsed {len(entries)} entries and would write {len(films)} films.")
        return 0

    DATA.mkdir(parents=True, exist_ok=True)
    backup_file(FILMS_JSON)
    FILMS_JSON.write_text(json.dumps(films, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(films)} films to {FILMS_JSON}")
    print("Style mix:")
    counts = {}
    for film in films:
        counts[film["ai_style"]] = counts.get(film["ai_style"], 0) + 1
    for key in sorted(counts):
        print(f"  {key}: {counts[key]}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

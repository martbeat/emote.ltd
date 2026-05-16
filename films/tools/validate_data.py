#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def load(name):
    with (DATA / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)

def fail(msg):
    raise SystemExit(f"ERROR: {msg}")

films = load("films.json")
pairings = load("pairings.json")
votes = load("votes.json")
submissions = load("submissions.json")

if not isinstance(films, list):
    fail("films.json must be a list")

slugs = set()
for film in films:
    for field in ["slug", "title", "year", "director", "country", "rating"]:
        if field not in film:
            fail(f"film missing {field}: {film}")
    if film["slug"] in slugs:
        fail(f"duplicate slug {film['slug']}")
    slugs.add(film["slug"])
    if not 0 <= int(film.get("rating", 0)) <= 10:
        fail(f"rating out of range for {film['slug']}")

for pairing in pairings:
    if pairing.get("film_id") not in slugs:
        fail(f"unknown film_id in pairing {pairing.get('id')}")
    if pairing.get("comparison_film_id") not in slugs:
        fail(f"unknown comparison_film_id in pairing {pairing.get('id')}")

if not isinstance(votes, dict):
    fail("votes.json must be an object")

if not isinstance(submissions, dict):
    fail("submissions.json must be an object")

print(f"OK: {len(films)} films, {len(pairings)} pairings, {len(votes)} vote groups, {len(submissions)} submission groups.")

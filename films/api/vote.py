#!/usr/bin/env python3
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def respond(payload, status="200 OK"):
    sys.stdout.write(f"Status: {status}\r\n")
    sys.stdout.write("Content-Type: application/json\r\n")
    sys.stdout.write("Cache-Control: no-store\r\n\r\n")
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))

def read_json_body():
    length = int(os.environ.get("CONTENT_LENGTH") or "0")
    if length <= 0 or length > 5000:
        raise ValueError("Invalid request length")
    raw = sys.stdin.read(length)
    return json.loads(raw)

def load_json(name, fallback):
    path = DATA / name
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return fallback

def save_json(name, data):
    path = DATA / name
    DATA.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{name}.", dir=str(DATA), text=True)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(tmp_name, path)

def valid_slug(value):
    return isinstance(value, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{1,120}", value)

def clean_text(value, max_len):
    if not isinstance(value, str):
        raise ValueError("Text must be a string")
    text = " ".join(value.strip().split())
    if not text or len(text) > max_len:
        raise ValueError(f"Text must be 1 to {max_len} characters")
    return text

try:
    body = read_json_body()
    kind = body.get("kind")

    if kind == "challenge":
        slug = body.get("slug")
        target = body.get("target")
        dry_run = bool(body.get("dry_run"))
        if not valid_slug(slug) or target not in ("ai", "human"):
            raise ValueError("Invalid challenge vote")
        votes = load_json("votes.json", {})
        votes.setdefault(slug, {"ai": 0, "human": 0})
        if not dry_run:
            votes[slug][target] = int(votes[slug].get(target, 0)) + 1
            save_json("votes.json", votes)
        respond({"ok": True, "votes": votes, "dry_run": dry_run})

    elif kind == "pairing":
        pairing_id = body.get("pairing_id")
        if not valid_slug(pairing_id):
            raise ValueError("Invalid pairing vote")
        pairings = load_json("pairings.json", [])
        updated = False
        for pairing in pairings:
            if pairing.get("id") == pairing_id:
                pairing["votes"] = int(pairing.get("votes", 0)) + 1
                updated = True
                break
        if not updated:
            raise ValueError("Unknown pairing")
        save_json("pairings.json", pairings)
        respond({"ok": True, "pairings": pairings})

    else:
        raise ValueError("Unknown vote kind")
except Exception as exc:
    respond({"ok": False, "error": str(exc)}, "400 Bad Request")

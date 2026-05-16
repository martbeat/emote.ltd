#!/usr/bin/env python3
import cgi
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
    slug = body.get("slug")
    text = clean_text(body.get("text"), 220)
    if not valid_slug(slug):
        raise ValueError("Invalid film slug")

    submissions = load_json("submissions.json", {})
    submissions.setdefault(slug, [])
    submissions[slug].insert(0, {
        "text": text,
        "status": "submitted",
        "created_at": datetime.now(timezone.utc).date().isoformat()
    })
    submissions[slug] = submissions[slug][:50]
    save_json("submissions.json", submissions)
    respond({"ok": True, "submissions": submissions})
except Exception as exc:
    respond({"ok": False, "error": str(exc)}, "400 Bad Request")

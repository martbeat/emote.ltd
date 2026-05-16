#!/usr/bin/env python3
import json
import sys

body = json.dumps({"ok": True, "service": "films-api"}).encode("utf-8")

sys.stdout.buffer.write(b"Status: 200 OK\r\n")
sys.stdout.buffer.write(b"Content-Type: application/json\r\n")
sys.stdout.buffer.write(b"Cache-Control: no-store\r\n")
sys.stdout.buffer.write(f"Content-Length: {len(body)}\r\n".encode("ascii"))
sys.stdout.buffer.write(b"\r\n")
sys.stdout.buffer.write(body)

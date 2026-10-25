#!/usr/bin/env python3
"""Build a private, identifier-free visit report from nginx COMBINED logs."""
import argparse
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import glob
import gzip
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
from urllib.parse import unquote, urlsplit

LOG = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "((?:\\.|[^"\\])*)" (\d{3}) \S+ "((?:\\.|[^"\\])*)" "((?:\\.|[^"\\])*)"')
AUTOMATION = re.compile(r'bot|crawl|spider|headless|python|curl|wget|go-http-client|healthcheck', re.I)
EXCLUDE = {'.git', 'node_modules', 'stats', 'tests', 'deploy', '.openai', 'ui'}


def public_routes(root):
    """Allow only existing public HTML/PDF files; never export arbitrary URLs."""
    routes = {}
    for path in Path(root).rglob('*'):
        relative = path.relative_to(root)
        if any(part in EXCLUDE or part.startswith('.') for part in relative.parts):
            continue
        if not path.is_file() or path.suffix.lower() not in {'.html', '.htm', '.pdf'}:
            continue
        route = '/' + relative.as_posix()
        canonical = route[:-len('index.html')] if route.endswith('/index.html') else route
        kind = 'PDF' if path.suffix.lower() == '.pdf' else 'Page'
        routes[route] = (canonical, kind)
        if route.endswith('/index.html'):
            routes[canonical] = (canonical, kind)
    return routes


def route_for(target, routes):
    try:
        url = urlsplit(target)
        if url.scheme or url.netloc:
            return None
        return routes.get(unquote(url.path))
    except (ValueError, UnicodeError):
        return None


def parse_line(line):
    match = LOG.match(line)
    if not match:
        return None
    address, stamp, request, status, referrer, agent = match.groups()
    try:
        when = datetime.strptime(stamp, '%d/%b/%Y:%H:%M:%S %z')
        method, target, _protocol = request.split(' ', 2)
    except ValueError:
        return None
    return address, agent, when, method, target, int(status), referrer


def build_report(paths, routes, now=None, hours=24, timeout=30, limit=50, max_steps=100):
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    groups = defaultdict(list)
    observed = []
    rejected = automated = included = 0
    # Avoid scanning the same physical file twice when glob patterns overlap.
    seen_files = set()
    for path in paths:
        resolved = Path(path).resolve()
        if resolved in seen_files:
            continue
        seen_files.add(resolved)
        opener = gzip.open if str(path).endswith('.gz') else open
        with opener(path, 'rt', encoding='utf-8', errors='replace') as source:
            for line in source:
                parsed = parse_line(line)
                if not parsed:
                    rejected += 1
                    continue
                address, agent, when, method, target, status, _referrer = parsed
                if not start <= when <= now:
                    continue
                observed.append(when)
                if method != 'GET' or not (200 <= status < 300 or status == 304):
                    continue
                route = route_for(target, routes)
                if route is None:
                    continue
                if AUTOMATION.search(agent) or agent in {'', '-'}:
                    automated += 1
                    continue
                # These raw values remain in memory and are never exported.
                groups[(address, agent)].append((when, route[0], route[1]))
                included += 1
    visits = []
    for events in groups.values():
        events.sort(key=lambda event: event[0])
        current = []
        for event in events:
            if current and event[0] - current[-1][0] >= timedelta(minutes=timeout):
                visits.append(current)
                current = []
            current.append(event)
        if current:
            visits.append(current)
    visits.sort(key=lambda events: events[-1][0], reverse=True)
    exported = []
    for events in visits[:limit]:
        steps = []
        for index, (when, path, kind) in enumerate(events[:max_steps]):
            next_time = events[index + 1][0] if index + 1 < len(events) else None
            steps.append({'at': when.isoformat(), 'path': path, 'kind': kind,
                          'gap_seconds': int((next_time - when).total_seconds()) if next_time else None})
        exported.append({'id': secrets.token_hex(6), 'start': events[0][0].isoformat(),
                         'end': events[-1][0].isoformat(), 'request_count': len(events),
                         'steps_truncated': len(events) > max_steps, 'steps': steps})
    return {'schema_version': 1, 'generated_at': now.isoformat(),
            'window_start': start.isoformat(), 'window_end': now.isoformat(),
            'observed_start': min(observed).isoformat() if observed else None,
            'observed_end': max(observed).isoformat() if observed else None,
            'inactivity_minutes': timeout, 'inferred_visits': len(visits),
            'included_requests': included, 'displayed_visits': len(exported),
            'recognised_automation_requests_excluded': automated,
            'unparseable_lines': rejected, 'visits': exported}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', action='append', required=True, help='Log file or glob; repeat for other files')
    parser.add_argument('--site-root', required=True, help='Deployed public HTML root, used to allow-list paths')
    parser.add_argument('--output', required=True, help='PRIVATE output path, outside the public web root')
    parser.add_argument('--hours', type=int, default=24)
    args = parser.parse_args()
    root, output = Path(args.site_root).resolve(), Path(args.output).resolve()
    if not root.is_dir():
        parser.error('--site-root must be an existing directory')
    if output == root or root in output.parents:
        parser.error('Journey reports must be saved outside the public web root')
    if not 1 <= args.hours <= 168:
        parser.error('--hours must be between 1 and 168')
    paths = sorted({p for pattern in args.log for p in glob.glob(pattern) if Path(p).is_file()})
    if not paths:
        parser.error('No log files matched; existing output was left unchanged')
    routes = public_routes(root)
    if not routes:
        parser.error('No public HTML/PDF files found; existing output was left unchanged')
    report = build_report(paths, routes, hours=args.hours)
    if report['observed_start'] is None:
        parser.error('No parseable entries in this window; existing output was left unchanged')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Atomic write avoids partial dashboard reads. Owner can read; nginx uses its group.
    fd, temporary = tempfile.mkstemp(prefix='.journeys-', dir=output.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(report, stream, ensure_ascii=False)
            stream.write('\n')
        os.chmod(temporary, 0o640)
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Wrote {report['displayed_visits']} inferred visits to private report")


if __name__ == '__main__':
    main()

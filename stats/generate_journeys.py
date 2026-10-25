#!/usr/bin/env python3
"""Build a private, identifier-free visit report from nginx COMBINED logs."""
import argparse
from collections import Counter, defaultdict
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


def navigation_steps(events):
    """Collapse consecutive requests to one location; keep request evidence."""
    steps = []
    for when, path, kind in events:
        if steps and steps[-1]['path'] == path:
            steps[-1]['last_at'] = when.isoformat()
            steps[-1]['requests'] += 1
        else:
            steps.append({'at': when.isoformat(), 'last_at': when.isoformat(),
                          'path': path, 'kind': kind, 'requests': 1})
    for index, step in enumerate(steps):
        step['gap_seconds'] = int((datetime.fromisoformat(steps[index + 1]['at']) -
                                   datetime.fromisoformat(step['last_at'])).total_seconds()) if index + 1 < len(steps) else None
    return steps


def automation_assessment(events):
    """Transparent heuristics, not a determination that a visitor is a bot."""
    def burst(seconds, locations):
        counts = Counter()
        left = 0
        for right, event in enumerate(events):
            counts[event[1]] += 1
            while event[0] - events[left][0] > timedelta(seconds=seconds):
                path = events[left][1]
                counts[path] -= 1
                if counts[path] == 0:
                    del counts[path]
                left += 1
            if len(counts) >= locations:
                return True
        return False
    reasons = []
    if burst(3, 4):
        reasons.append('At least 4 distinct locations requested within 3 seconds')
    if burst(10, 6):
        reasons.append('At least 6 distinct locations requested within 10 seconds')
    if reasons:
        return 'likely_automated', reasons
    if burst(1, 3):
        reasons.append('Rapid burst: at least 3 distinct locations within 1 second; uncertain')
    return 'unclassified', reasons


def build_report(paths, routes, now=None, hours=168, timeout=30, limit=50, max_steps=100, min_steps=2):
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    groups = defaultdict(list)
    observed = []
    rejected = automated = 0
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
    all_visit_count = len(visits)
    records = []
    for events in visits:
        steps = navigation_steps(events)
        if len(steps) < min_steps:
            continue
        assessment, reasons = automation_assessment(events)
        records.append({'events': events, 'steps': steps, 'assessment': assessment, 'reasons': reasons})
    records.sort(key=lambda record: record['events'][-1][0], reverse=True)
    included = sum(len(record['events']) for record in records)
    review = [record for record in records if record['assessment'] != 'likely_automated']
    likely = [record for record in records if record['assessment'] == 'likely_automated']
    # Separate quotas prevent crawler bursts from crowding out reviewable visits.
    selected = review[:limit] + likely[:limit]
    exported = []
    for record in selected:
        events, steps = record['events'], record['steps']
        exported.append({'id': secrets.token_hex(6), 'start': events[0][0].isoformat(),
                         'end': events[-1][0].isoformat(), 'request_count': len(events),
                         'navigation_step_count': len(steps),
                         'automation_class': record['assessment'], 'automation_reasons': record['reasons'],
                         'steps_truncated': len(steps) > max_steps, 'steps': steps[:max_steps]})
    return {'schema_version': 1, 'generated_at': now.isoformat(),
            'window_start': start.isoformat(), 'window_end': now.isoformat(),
            'observed_start': min(observed).isoformat() if observed else None,
            'observed_end': max(observed).isoformat() if observed else None,
            'inactivity_minutes': timeout, 'minimum_steps': min_steps,
            'all_inferred_visits': all_visit_count, 'inferred_visits': len(records),
            'navigation_step_semantics': 'consecutive_locations',
            'likely_automated_visits': len(likely), 'unclassified_visits': len(review),
            'included_requests': included, 'displayed_visits': len(exported),
            'recognised_automation_requests_excluded': automated,
            'unparseable_lines': rejected, 'visits': exported}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', action='append', required=True, help='Log file or glob; repeat for other files')
    parser.add_argument('--site-root', required=True, help='Deployed public HTML root, used to allow-list paths')
    parser.add_argument('--output', required=True, help='PRIVATE output path, outside the public web root')
    parser.add_argument('--hours', type=int, default=168, help='Rolling lookback in hours (default: 168 / seven days)')
    parser.add_argument('--min-steps', type=int, default=2, help='Minimum navigation steps per visit, grouping consecutive reloads (default: 2)')
    args = parser.parse_args()
    root, output = Path(args.site_root).resolve(), Path(args.output).resolve()
    if not root.is_dir():
        parser.error('--site-root must be an existing directory')
    if output == root or root in output.parents:
        parser.error('Journey reports must be saved outside the public web root')
    if not 1 <= args.hours <= 168:
        parser.error('--hours must be between 1 and 168')
    if not 1 <= args.min_steps <= 100:
        parser.error('--min-steps must be between 1 and 100')
    paths = sorted({p for pattern in args.log for p in glob.glob(pattern) if Path(p).is_file()})
    if not paths:
        parser.error('No log files matched; existing output was left unchanged')
    routes = public_routes(root)
    if not routes:
        parser.error('No public HTML/PDF files found; existing output was left unchanged')
    report = build_report(paths, routes, hours=args.hours, min_steps=args.min_steps)
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

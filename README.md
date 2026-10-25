This is my emote.ltd website.

## Deploy notes

### If deploy fails with local git changes

If your deploy script fails with:

```text
error: Your local changes to the following files would be overwritten by merge:
  stats/analytics.html
```

it means the repo on the server is dirty. Use the provided deploy helper to auto-stash local edits and reset to `origin/main`:

```bash
bash deploy/deploy-emote.sh /home/martin/emote.ltd origin/main
```

This script will:
- fetch latest `origin/main`
- stash local changes if present
- hard reset to `origin/main`
- clean untracked files

### If rsync fails with mkstemp permission denied

If `rsync` fails with:

`mkstemp .../stats/.analytics.html.* failed: Permission denied (13)`

it means rsync cannot create its temporary file in that target directory.

Fix on server:

```bash
sudo chown -R martin:www-data /var/www/emote.ltd/html/stats
sudo find /var/www/emote.ltd/html/stats -type d -exec chmod 775 {} \;
sudo find /var/www/emote.ltd/html/stats -type f -exec chmod 664 {} \;
```

Fallback (if ownership cannot be changed):

```bash
rsync -avz --inplace stats/analytics.html martin@raspberrypi:/var/www/emote.ltd/html/stats/analytics.html
```

## eMote Text

`text.html`, linked from the Tools Hub, is a compact Unicode text styling utility.
Its 13 styles are generated locally; input is neither stored nor sent to a server.
The tool includes category filters, copy feedback, a manual copy fallback and an
accessibility note. Deploy `text.html`, `assets/css/text.css`, `js/text.js`,
`js/text-styles.js` and the updated `tools.html` together. No backend or build step
is required.

Verified in headless Chrome at desktop and mobile widths: live conversion, emoji
and accent preservation, literal HTML handling, category filters, empty input,
copy feedback and exact clipboard API payload, manual copy fallback and visible
keyboard focus. Headless Chrome does not expose a usable system clipboard in this
environment; pasting into an external application remains a manual check.

## Analytics dashboard

`stats/index.html` reads the existing server exports without changing collection.
It shows each source's actual dates, distinguishes requests from daily visitor
identities and keeps undated event summaries separate from dated log reports.
PDF rows are read from both request panels. Missing sources stay unavailable and
do not prevent other reports from rendering. Deploy the updated HTML through the
existing server workflow; no new dependencies or server configuration are needed.

Run regression checks from the repository root:

```bash
node --test tests/analytics/dashboard.test.cjs
```

The dashboard flags incompatible reporting ranges and a filtered human report
larger than the main report. These require investigation of the server export
jobs; frontend changes do not repair log filtering. Article and game summaries
currently lack reporting dates, so the dashboard does not attribute them to the
main reporting period or infer unique readers or matched game sessions.

## Private visitor journeys

The analytics dashboard includes an inferred-visit viewer. It reads a protected
server export or a local JSON report and adds no browser tracking. See
[visitor-journeys.md](docs/visitor-journeys.md) for the export generator, protected
nginx endpoint, scheduling and coverage limits. Server setup is required before
live journeys are available.

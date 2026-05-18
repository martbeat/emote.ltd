# Beat the AI: update 02

This update adds:

- Absolute `/films/` links, fixing LAN-address navigation problems
- Optional Python CGI endpoints for central submissions and votes
- Browser fallback if the API is unavailable
- Nginx snippet for admin protection and API execution

## Deploy

From the parent folder:

```bash
sudo rsync -av beat-the-ai-films-update-02/ /var/www/emote.ltd/html/films/
```

## Check static pages

```bash
curl -I https://emote.ltd/films/
curl -I https://emote.ltd/films/admin.html
curl -I https://emote.ltd/films/data/films.json
```

## Protect admin.html

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-films martin
```

Add the `nginx/films-nginx-snippet.conf` content inside your emote.ltd server block.

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Expected:

```bash
curl -I https://emote.ltd/films/admin.html
# HTTP/2 401
```

## Enable API writes

The API scripts need write permission to the JSON files in `/films/data`.

A conservative approach is:

```bash
sudo chown -R www-data:www-data /var/www/emote.ltd/html/films/data
sudo chmod 750 /var/www/emote.ltd/html/films/data
sudo chmod 640 /var/www/emote.ltd/html/films/data/*.json
sudo chmod 755 /var/www/emote.ltd/html/films/api/*.py
```

If your fcgiwrap process runs as a different user, adjust `www-data`.

## Test API

```bash
curl -s -X POST https://emote.ltd/films/api/submit-line.py \
  -H 'Content-Type: application/json' \
  --data '{"slug":"blade-runner-1982","text":"A test line that should appear in moderation."}' | jq

curl -s -X POST https://emote.ltd/films/api/vote.py \
  -H 'Content-Type: application/json' \
  --data '{"kind":"challenge","slug":"blade-runner-1982","target":"human"}' | jq
```

Then open:

```text
https://emote.ltd/films/admin.html
```

The submitted line should appear in moderation.

## Important

This is still a lightweight prototype. Before wider public use, add rate limiting at Cloudflare or Nginx for `/films/api/`.

## Update 03

This is the critical usability update.

Changes:

- `admin.html` is now admin-first rather than public-page-first
- Moderation is the first admin work area
- Public challenge list is limited to 12 cards, with Load more
- Top tag display is limited to reduce clutter
- Pairing editor now avoids selecting the same film twice by default
- Public and admin pages show data/API status
- `vote.py` supports `dry_run` for safe API checks
- Absolute `/films/` links are retained

After deployment, hard-refresh the browser or clear site data if you still see old text such as:

```text
Saved locally for moderation/export
```

The new text says whether submissions are sent to the moderation queue or saved locally.


## Update 04

This fixes the admin-first JavaScript crash from update 03.

The shared JavaScript now treats page elements as optional, so `admin.html` no longer breaks when public-only controls such as `randomButton`, `statFilms` or mode tabs are absent.

Also changes:

- Asset references bumped to `?v=4`
- Admin dashboard should render before pairings
- Moderation, edit buttons, import/export and pairing editor should bind correctly
- Public page still works with API fallback


## Update 05: Top 500 population tool

This adds:

```text
tools/build_tspdt500.py
```

It downloads the TSPDT 1,000 Greatest Films ranked page, parses the top 500 by default and writes:

```text
data/films.json
```

Run from the `/films` folder:

```bash
python3 tools/build_tspdt500.py --dry-run
python3 tools/build_tspdt500.py --limit 500
```

To preserve your existing lines where the film slug already exists:

```bash
python3 tools/build_tspdt500.py --limit 500 --preserve-existing
```

The generator deliberately varies the AI first drafts. They are not all polished summaries. The `ai_style` field may be:

```text
flat
poetic
provocative
dumb
grandiose
nearly_wrong
challenge_bait
bureaucratic
overcompressed
sensory
```

That is intentional. The point is to give visitors something to beat.


## Update 06

This fixes public hash navigation and makes more film metadata visible.

Changes:

- `/films/#reviews` now activates the Reviews tab
- `/films/#pairings` now activates the Pairings tab
- `/films/#beat-ai` activates Beat the AI
- Navigation links call the mode switcher rather than only scrolling
- Review cards show rank, runtime, director and country
- Challenge cards show rank, runtime, director, country and genre-style tags
- Pairing cards show director, country and year for both films
- Asset references bumped to `?v=6`


## Update 07

Fixes a JavaScript syntax error introduced in update 06.

Problem:

```js
film.year // 10
```

JavaScript treats `//` as a comment, not integer division.

Fix:

```js
Math.floor(Number(film.year) / 10) * 10
```

Assets are bumped to `?v=7`.


## Update 08: Recent films and crowd-pleasers

Adds:

```text
data/recent-crowd-pleasers.json
tools/merge_recent_crowd_pleasers.py
```

This supplement includes recent critical favourites, awards films, blockbusters, animation, horror and crowd-pleasers from 2020 onwards.

Merge into the active `films.json`:

```bash
cd /var/www/emote.ltd/html/films
python3 tools/merge_recent_crowd_pleasers.py --dry-run
python3 tools/merge_recent_crowd_pleasers.py
```

To refresh matching entries as well as adding missing ones:

```bash
python3 tools/merge_recent_crowd_pleasers.py --replace-existing
```

If GitHub is your source of truth, copy the updated `data/films.json` back into the repo and commit it.


## Update 09: Challenge lifecycle and AI rematch

Adds a clearer game model:

- The original AI line stays visible
- A promoted human line becomes the human champion
- Admin can add or draft an optional AI rematch
- Votes can now track `ai`, `human` and `rematch`
- Challenge cards show who is currently leading
- `checkApiAvailability()` now calls `/films/api/health.py`, not `vote.py`
- API scripts return `Content-Length` and avoid Python `cgi` deprecation warnings
- Asset references bumped to `?v=9`

New film fields:

```json
{
  "ai_rematch": "",
  "winner": "",
  "challenge_round": 1
}
```


## Update 10: Today's challenge opens the card

Fixes the top-right Today's Challenge panel.

Changes:

- The selected challenge is now stored as `currentChallengeSlug`
- Clicking `Take today's challenge` opens the selected challenge card
- Clicking the top-right AI line or its meta text also opens the selected card
- If the selected card is beyond the first 12 public cards, the challenge list expands automatically
- The selected card scrolls into view and pulses briefly
- `Another challenge` changes the selected challenge and refreshes the visible status
- Asset references bumped to `?v=10`


## Update 11: global filtering and robust Today’s Challenge

Fixes the mismatch where search and tag filters mainly affected the Reviews view.

Changes:

- Search now filters both Reviews and Beat the AI cards
- Tags now filter both Reviews and Beat the AI cards
- Status, score and sort controls now rerender all public views
- Today’s Challenge clears blocking filters, switches to Beat the AI, expands the list if needed, scrolls to the card and highlights it
- Adds delegated click handling so dynamically re-rendered tags and buttons still work
- Asset references bumped to `?v=11`


## Update 12: replaced client-side app logic

This replaces the patchwork client script with a cleaner single render pipeline.

Fixes:

- Search input
- Tag filters
- Status filter
- Score filter
- Sort filter
- Today's Challenge scroll/open behaviour
- Mode switching
- Dynamic buttons after rerender

Design change:

- One state object controls query, tag, status, minimum score, sort and active mode.
- One delegated click/input/change system handles dynamic content.
- Today’s Challenge clears blocking filters, switches to Beat the AI, expands the list and scrolls to the selected card.

Assets are bumped to `?v=12`.


## Update 13: Import curated film lists

Adds:

```text
tools/import_film_lists.py
data/imports/20c-film-template.csv
data/imports/21c-best-picture-nominations-template.csv
```

Use this for uploaded lists such as:

- 20c film
- 21c Best Picture nominations
- festival lists
- personal watchlists

Rows are merged into `data/films.json` by title + year slug. Existing films gain extra tags and list memberships. New films are appended.

Example:

```bash
cd /var/www/emote.ltd/html/films
cp /path/to/my-20c-list.csv data/imports/20c-film.csv
cp /path/to/my-oscar-list.csv data/imports/21c-best-picture-nominations.csv

python3 tools/import_film_lists.py --all --dry-run
python3 tools/import_film_lists.py --all
```

Then copy the rebuilt `films.json` back into the repo and commit it.

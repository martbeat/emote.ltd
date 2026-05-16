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

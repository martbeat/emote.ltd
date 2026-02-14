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

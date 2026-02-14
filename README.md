This is my emote.ltd website.

## Deploy notes

If `rsync` fails with:

`mkstemp .../stats/.analytics.html.* failed: Permission denied (13)`

it means rsync cannot create its temporary file in that target directory.

### Fix on server

```bash
sudo chown -R martin:www-data /var/www/emote.ltd/html/stats
sudo find /var/www/emote.ltd/html/stats -type d -exec chmod 775 {} \;
sudo find /var/www/emote.ltd/html/stats -type f -exec chmod 664 {} \;
```

### Deploy fallback (if ownership cannot be changed)

Use `--inplace` to avoid temporary file creation:

```bash
rsync -avz --inplace stats/analytics.html martin@raspberrypi:/var/www/emote.ltd/html/stats/analytics.html
```

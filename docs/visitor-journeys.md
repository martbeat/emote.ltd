# Private visitor journeys

The Analytics dashboard can now show inferred visits: ordered successful page and
PDF requests, with timestamps and the interval to the next request. It uses
existing nginx COMBINED logs. No browser tracker, cookie, device fingerprint or
new client-side identifier is added.

This feature needs the server export below. Until that is installed, the dashboard
shows an explicit setup message rather than invented journeys. An existing private
JSON export can also be opened in the dashboard with the file picker. Files are
read in browser memory and are not uploaded or saved by the dashboard.

## First-time server setup

These paths follow the existing repository and generator conventions. Confirm the
actual deployed web root before running: the repository contains references to
both `/var/www/emote.ltd` and `/var/www/emote.ltd/html`. Use the directory that
contains the live `index.html` and `downloads` directory. Do not point the script
at the source checkout if it differs from the files actually served.

1. Deploy `stats/index.html` and retain `stats/generate_journeys.py` in the source
   checkout at `/home/martin/Sites/emote.ltd`.
2. Create a private output directory. The setgid directory makes generated files
   readable by nginx's `www-data` group without publishing them in the web root:

   ```sh
   sudo install -d -o root -g www-data -m 2750 /var/lib/emote-analytics
   ```

3. Generate the first report. This command assumes the live root is
   `/var/www/emote.ltd/html`; substitute the verified root if necessary:

   ```sh
   sudo python3 /home/martin/Sites/emote.ltd/stats/generate_journeys.py \
     --log '/var/log/nginx/emote.access.log*' \
     --site-root /var/www/emote.ltd/html \
     --hours 168 --min-steps 2 --output /var/lib/emote-analytics/journeys.json
   ```

   The glob includes rotated and gzip-compressed logs. It must contain nginx
   COMBINED logs for this site. No raw logs are changed. Only the last seven days (168 hours) are
   used by default, and only visits with at least two page/PDF requests qualify. The report includes observed log-activity bounds so partial coverage
   remains visible. `--hours` supports 1–168 hours. If no files, no public routes or
   no parseable entries match, generation fails without replacing the old report.

4. Create a login with `htpasswd` (from `apache2-utils` on Debian/Ubuntu). For a
   **new** password file only:

   ```sh
   sudo htpasswd -c /etc/nginx/emote-analytics.htpasswd martin
   sudo chown root:www-data /etc/nginx/emote-analytics.htpasswd
   sudo chmod 640 /etc/nginx/emote-analytics.htpasswd
   ```

   This prompts for the password. If the password file already exists, omit `-c`
   to preserve existing accounts. No password belongs in source control.

5. Include the contents of `deploy/nginx/journeys-private.conf` inside the existing
   HTTPS `server` block. This serves only the private JSON file at
   `/stats/private/journeys.json`, with HTTP Basic authentication and no browser
   caching. Keep the report outside the public web root. Test before reloading:

   ```sh
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. For a report refreshed every 15 minutes, add this line to a root-owned
   `/etc/cron.d/emote-journeys` file, using the verified web root and checkout path:

   ```cron
   */15 * * * * root /usr/bin/python3 /home/martin/Sites/emote.ltd/stats/generate_journeys.py --log '/var/log/nginx/emote.access.log*' --site-root /var/www/emote.ltd/html --hours 168 --min-steps 2 --output /var/lib/emote-analytics/journeys.json
   ```

   The file must end with a newline and be mode 0644. Root reads the existing logs;
   report files are mode 0640 and inherit the private directory's `www-data` group.
   Monitor cron errors. The dashboard displays the report's generation time, so a
   failed export cannot silently look current.

7. On the dashboard, use **Sign in to the protected report**, authenticate, then
   **Load private server report**. Loading is explicit so the public dashboard
   does not prompt all visitors for an analytics password. Alternatively, copy
   only the generated JSON to your computer and open it with the local file picker.

## What a visit means

- Requests are grouped using the source IP and user-agent already in the log,
  kept only in the script's memory. Those values are not in the report. Confirm
  nginx is logging the actual client address if a reverse proxy is involved;
  grouping a shared proxy address can merge unrelated visits.
- Thirty minutes without a matching page/PDF request starts another inferred
  visit. Visits are scoped to the supplied time window and can be cut off at its
  edges. Different people with the same network address and browser can merge;
  a person changing networks or browsers can split.
- Only existing public HTML and PDF routes under the deployed root are allowed.
  Query strings and fragments are dropped. Stats, tests, deployment files,
  dotfiles, assets, unknown paths, unsuccessful requests and recognised automated
  user agents are excluded. Other bots may remain. Root `index.html` and `/`
  are normalised to the same path.
- The two-step filter is applied before selecting the latest 50 qualifying inferred visits, with up to 100 requests per
  visit. Steps count requests, so a reload can be a step. `--min-steps` defaults
  to 2; `--min-steps 1` restores single-step visits. It reports total counts and flags truncated steps. Random report-local
  IDs rotate on each generation and are not persistent person identifiers.
- Gaps between requests are **not** active reading time. The final gap is unknown.
  Browser-cached navigation, hash navigation, embedded HTML and requests to other
  sites can make a journey incomplete or differ from the navigation a person saw.
  Equal-second requests can be ambiguous. Log rotation gaps also affect coverage.
- The script excludes raw IPs, user agents, referrers, form contents, query strings
  and URL fragments from the export. The detailed sequences remain private behind
  the configured login. No detailed report is committed to the repository.

## Checks

From the repository root:

```sh
node --test tests/analytics/dashboard.test.cjs
python3 -m unittest discover -s tests/analytics -p 'test_journeys.py'
```

Server verification: unauthenticated access to the protected JSON should return
401; after login it should return JSON, with `Cache-Control: private, no-store`.
Confirm nginx can read the report, check its generation time and compare a known
short test visit against the raw log. Browser-level authentication and live log
permissions require verification on the actual server.

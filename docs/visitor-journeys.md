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
   used by default, and only visits with at least two navigation steps qualify. The report includes observed log-activity bounds so partial coverage
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
  kept in the script's memory. Raw IPs and full browser strings are omitted unless
  `--include-client-details` is explicitly enabled for the protected report. Confirm
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
- Consecutive requests for the same canonical path form one navigation step.
  Repeated homepage loads or two requests for the same PDF do not alone qualify
  as a journey. Request counts and first/last request times remain in each group.
  Returning to a page after visiting another page is a new navigation step.
  `--min-steps` defaults to 2; `--min-steps 1` includes single-location visits.
- Pattern checks flag **likely automation** when at least 4 distinct locations are
  requested within 3 seconds or at least 6 within 10 seconds. Three locations in
  one second get an uncertain rapid-burst note. Same-page reloads alone do not
  trigger these breadth checks. Flags are heuristics: testing, preloading and
  merged visitors can also produce bursts. An unclassified visit is not verified
  human activity. Existing user-agent exclusions still apply before these checks.
- The export keeps up to 50 latest unclassified visits and 50 latest flagged
  visits, with up to 100 grouped navigation steps each. Separate quotas prevent
  crawler bursts from displacing the other journeys. Report totals cover all
  qualifying visits before these display limits. The dashboard hides flagged
  visits by default; its view selector also offers all or flagged-only views.
  Random report-local IDs rotate on each generation and do not identify people.
- Gaps between requests are **not** active reading time. The gap follows the last request in a grouped step. The final gap is unknown.
  Browser-cached navigation, hash navigation, embedded HTML and requests to other
  sites can make a journey incomplete or differ from the navigation a person saw.
  Equal-second requests can be ambiguous. Log rotation gaps also affect coverage.
- By default, raw IPs and full user agents are omitted. The private diagnostics
  flag includes them deliberately. Referrer query strings, form contents, URL
  query strings and fragments are never exported. Only known internal referrer
  paths are retained. Detailed reports remain behind the configured login and
  are never committed to the repository.

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


## Browser, network and prefetch diagnostics

Each visit already groups one exact logged IP and user-agent string. New reports
include report-local network, client (IP + user-agent) and browser-string codes,
plus a parsed browser/OS summary. Codes rotate on every export; they are useful
for comparison inside one report and do not establish that requests came from
the same person or device. The browser string is a claim that bots can imitate.

To include the actual logged IP and full browser string, append
`--include-client-details` when generating the private report, and append it to
the scheduled command if those details should persist across refreshes. The
output must still be outside the web root and protected by the existing login.
The dashboard can filter by codes, IP or browser name.

If the logged IP is loopback/private, check the proxy configuration before using
it to infer visits. Forwarded client-IP headers are shown as **unverified** and
are not used to regroup visitors. Where a diagnostic log supplies several distinct
forwarded client-IP values for one grouped visit, the dashboard warns that the
proxy address may have merged visitors. Configure real-IP replacement only after
identifying the trusted proxy path; do not trust arbitrary client headers.

### Evidence from the live landing page

On 25 October 2026 the live landing response included:

```http
Speculation-Rules: "/cdn-cgi/speculation"
```

The source landing page itself did not include document prefetch/prerender rules
or page iframes. It fetched a blog-feed JSON response and displayed images/links.
The response header matches [Cloudflare Speed Brain](https://developers.cloudflare.com/speed/optimization/content/speed-brain/).
Cloudflare documents that its prefetches are served from edge cache and never
forwarded to the origin, so that feature alone does not explain rapid requests
in the Raspberry Pi's origin logs. Cached normal navigation can also be missing
from an origin-only journey. Request timing alone cannot settle the cause.

### Optional enhanced origin log (new requests only)

The old COMBINED logs have no request-purpose or fetch-destination headers. They
cannot establish whether a historical request was a prefetch. The exporter now
also accepts the JSON format defined in
`deploy/nginx/journeys-log-format.conf`. It records browser-supplied purpose,
fetch destination/mode/user-activation headers and the forwarded client-IP header.
These are evidence, not proof of a human click.

1. Copy the format definition to nginx's `http` context, normally through
   `/etc/nginx/conf.d/emote-journeys-log.conf` on this server. This defines the
   format only; it does not change existing logging.
2. In the emote.ltd server block, add this alongside the existing main log:

   ```nginx
   access_log /var/log/nginx/emote.journeys.log emote_journey_json;
   ```

   Create the new log if absent, without truncating an existing log, and restrict
   its permissions to the nginx logging user/group. Verify it is covered by the
   server's existing nginx log rotation rules, which commonly match `*.log`.
3. Test `sudo nginx -t` before reloading. Existing GoAccess exports should keep
   using the original `main` log.
4. To inspect enhanced metadata, use **only** the new log as this export's input:

   ```sh
   sudo python3 /home/martin/Sites/emote.ltd/stats/generate_journeys.py \
     --log '/var/log/nginx/emote.journeys.log*' \
     --site-root /var/www/emote.ltd/html \
     --hours 168 --min-steps 2 --include-client-details \
     --output /var/lib/emote-analytics/journeys.json
   ```

   Do not combine the main and diagnostic logs for overlapping periods: they
   record the same requests and would double-count them. The enhanced log only
   covers requests since activation. Keep the old seven-day report separately
   in the private directory if needed for comparison. Change the cron input only
   once the new log is working; its coverage grows over the following seven days.

Declared `prefetch`/`prerender` requests are excluded from inferred navigation.
HTML requests with `iframe`, `frame`, `embed` or `object` destinations are excluded
from page journeys. PDF requests remain eligible unless explicitly speculative.
Metadata coverage and exclusion counts appear in the dashboard. Missing headers
in an old log mean unknown, not evidence that no prefetching occurred. No browser
tracking script or cookie is added by these changes.

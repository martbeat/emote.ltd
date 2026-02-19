#!/bin/bash

OUTPUT="/var/www/emote.ltd/html/stats/pdf.json"

zcat -f /var/log/nginx/emote.access.log* | \
grep -E ' 200 | 304 ' | \
grep '/downloads/Governance%20With%20a%20Heartbeat.pdf' | \
goaccess - \
  --log-format=COMBINED \
  --ignore-crawlers \
  --geoip-database=/var/lib/GeoIP/GeoLite2-City.mmdb \
  -o $OUTPUT \
  --json-pretty-print

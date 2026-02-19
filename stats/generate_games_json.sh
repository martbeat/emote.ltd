#!/bin/bash

OUTPUT="/var/www/emote.ltd/html/stats/games.json"

zcat -f /var/log/nginx/games.access.log* | \
goaccess - \
  --log-format=COMBINED \
  --ignore-crawlers \
  --geoip-database=/var/lib/GeoIP/GeoLite2-City.mmdb \
  --geoip-database=/var/lib/GeoIP/GeoLite2-ASN.mmdb \
  -o $OUTPUT \
  --json-pretty-print

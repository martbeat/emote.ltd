# RBC downloadable name dictionary

The RBC PDF pilot loads `assets/name-lexicon-rbc-20261014.json` from this website. Its download link returns the same JSON. Refresh dictionary bypasses its HTTP cache; it reloads the published site asset, not an upstream service. Updating the upstream snapshot requires rebuilding and deploying the asset. Documents and detected names are never sent to the publishers.

Build date: 14 October 2026. Entries after normalisation and deduplication: **113,448 given names**, **156,632 surnames**, **270,080 total**. Size: 2,635,731 bytes. The original `assets/name-lexicon.json` and `redactor.html` remain unchanged.

## Sources and attribution

- US Social Security Administration, national baby-name files, 1880–2025: https://www.ssa.gov/oact/babynames/names.zip . Metadata and CC0 licence: https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data . Annual files suppress names with fewer than five occurrences.
- US Census Bureau, Frequently Occurring First Names and Last Names in the 2020 Census, released 14 April 2026: https://www.census.gov/topics/population/genealogy/data/2020_names.html . These are aggregate lists, not individual records or matched first/last-name pairs. Census Bureau works are generally not subject to US copyright: https://www2.census.gov/foia/ds_policies/ds027.pdf . No Census endorsement is implied.
- Department for Education, Autumn School Census 2014, top 1,000 forenames and surnames, FOI response 2015-0017407: https://www.whatdotheyknow.com/request/popular_forenames . CSV mirror pinned at commit `34d163a5c99aa0581ad5d4965d51bf53dd9d78b4`: https://github.com/matt40k/Names . Contains public sector information licensed under the Open Government Licence v3.0: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ . Crown copyright and database right, Department for Education.

Each source's URL, input SHA-256 and individual normalised entry count are embedded in the JSON metadata. The derived JSON retains names only. Frequencies, sex, race and ethnicity fields are not shipped. Synthetic spelling expansions from the older dictionary are not merged.

## Rebuild

Requires Python and openpyxl. Download the five inputs into a scratch directory:

```sh
mkdir -p /tmp/rbc-name-sources
curl -fL https://www.ssa.gov/oact/babynames/names.zip -o /tmp/rbc-name-sources/ssa-names.zip
curl -fL https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_Sex.xlsx -o /tmp/rbc-name-sources/census2020-first.xlsx
curl -fL https://www2.census.gov/topics/genealogy/2020surnames/Names2020_LastNames_RaceHispanic.xlsx -o /tmp/rbc-name-sources/census2020-last.xlsx
curl -fL https://raw.githubusercontent.com/matt40k/Names/34d163a5c99aa0581ad5d4965d51bf53dd9d78b4/Forename_Autumn2014.csv -o /tmp/rbc-name-sources/uk-forenames.csv
curl -fL https://raw.githubusercontent.com/matt40k/Names/34d163a5c99aa0581ad5d4965d51bf53dd9d78b4/Surname_Autumn2014.csv -o /tmp/rbc-name-sources/uk-surnames.csv
python tools/build-rbc-name-lexicon.py --source-dir /tmp/rbc-name-sources --output assets/name-lexicon-rbc-20261014.json --updated 2026-10-14
```

Compare the downloaded inputs' SHA-256 values with the existing metadata to reproduce this exact snapshot. Upstream files may change. For a newer release, use a new asset filename/version and update the fixed application/download references and tests. Preserve source dates, attribution and hashes.

## Matching and limits

Matching folds letter case, combining accents and curly apostrophes. The source document and matched ranges are unchanged. Multiword entries remain dictionary entries rather than invented token combinations. Author/role evidence, personal-name filters, geometric fragment boundaries and known terms continue to support the dictionary.

The loader permits 200,000 entries per list and a 6 MB payload. Download/parse failure visibly falls back to contextual and supplied-term suggestions. Refreshing with a PDF loaded invalidates output and requires rescanning; it preserves existing decided/manual areas.

The corpus is predominantly US-derived, with a limited 2014 UK supplement. Rare names, naming traditions and unusual spellings can remain absent. A name-list hit is evidence for a suggestion, not proof of identity, and a clean scan is not proof of complete redaction. Review all retained content. Whole-fragment PDF box limits are unchanged.

## Verification

82 reported Node tests pass. Corpus tests verify counts, sorted unique entries, size, provenance, common names without labels, accent-folded names and negative heading examples. The UI refresh test checks visible status, preservation of decisions and forced rescanning. Existing release-gate tests pass. No new real-browser/PDF-rendering run was available.

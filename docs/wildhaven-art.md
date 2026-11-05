# Wildhaven illustrated catalogue

The catalogue contains 33 animals: 27 mammals and six native land reptiles. The mammal expansion added 12 species; the reptile update adds six more. Existing species IDs, saved residents, resources and scores remain unchanged. New species can appear in future arrivals without restarting a saved game.

Original vector artwork lives in `assets/js/wildhaven-art.js`. Every species has a distinct composition or combination of proportions, markings and pose. SVG definition IDs are unique for every rendered illustration. Drawing never consumes the game's random sequence. No downloaded wildlife photographs or generated raster assets are required.

Illustrations are stylised and not to scale. They are not identification keys. Common and soprano pipistrelles, in particular, need acoustic evidence to distinguish reliably. The existing soprano recording remains attached only to the soprano species.

| Game habitat | Added species |
| --- | --- |
| Woodland | Roe deer, Scottish wildcat, yellow-necked mouse |
| Hedgerow | European rabbit, stoat, weasel, polecat, field vole |
| Riverbank | Eurasian beaver, brown rat, Daubenton's bat, common pipistrelle |

Habitats are simplified gameplay homes. Many species use several habitats. Encounter weights support game variety rather than expressing population estimates. Rare species appear less often in the game.

The mammal guide offers all species, mammal/reptile, new-arrival and habitat filters. The original sound controls and credits remain. Rabbit and roe deer track patterns extend the notebook from six entries to eight.

## References checked on 5 November 2026

- [Woodland Trust mammal catalogue](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/animals/mammals/): species and appearance context.
- [Woodland Trust stoat](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/animals/mammals/stoat/): slender shape and black tail tip.
- [Woodland Trust yellow-necked mouse](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/animals/mammals/yellow-necked-mouse/): distinctive yellow neck band.
- [Mammal Society field vole](https://mammal.org.uk/british-mammals/field-vole): grassland habitat and stocky appearance.
- [Vincent Wildlife Trust polecat](https://www.vwt.org.uk/species/pole-cat): lowland hedgerows and woodland edges.
- [Bat Conservation Trust Daubenton's bat](https://www.bats.org.uk/about-bats/what-are-bats/uk-bats/daubentons-bat): large feet and water-surface feeding.
- [Bat Conservation Trust foraging habitats](https://www.bats.org.uk/about-bats/where-do-bats-live/bat-habitats/foraging-habitats): pipistrelles feeding over rivers and ponds.
- [Mammal Society common pipistrelle](https://mammal.org.uk/british-mammals/common-pipistrelle-bat): reliable acoustic distinction from similar pipistrelles.
- [Woodland Trust animal tracks](https://www.woodlandtrust.org.uk/blog/animal-tracks-snow-print-identification/): deer hoof patterns and rabbit/hare bounding trails.

## Validation

Run `node tests/wildhaven/game.test.cjs`. Checks cover 200 complete games, legal resources and spaces, seasonal totals, save compatibility, coaching and undo, audio lifecycle, 33 unique illustrations, SVG ID collisions, guide filters and the full-haven exploration guard.


## Reptile update

The common lizard, sand lizard, slow-worm, grass snake, adder and smooth snake are included. Existing animal IDs and save data are preserved. The middle habitat is now “Hedge & heath”, providing an explicit sandy heathland setting for sand lizards and smooth snakes. The adder uses woodland clearings and the grass snake the riverbank. Habitat allocation is a gameplay simplification.

All six use the existing Sleeper talent: three final winter refuge points per resident. This represents sheltered overwintering and does not simulate body temperature or basking. Slow-worms are explicitly classed as legless lizards. The sand lizard illustration shows a male with breeding-season green flanks. Original mammal recordings remain attached to their actual species.

Sources checked on 5 November 2026:

- [ARC common lizard](https://www.arc-trust.org/common-lizard)
- [ARC sand lizard](https://www.arc-trust.org/sand-lizard)
- [ARC slow-worm](https://www.arc-trust.org/slow-worm)
- [ARC smooth snake](https://www.arc-trust.org/smooth-snake)
- [ARC snake identification FAQs](https://www.arc-trust.org/snake-faqs)
- [Woodland Trust grass snake](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/animals/reptiles-and-amphibians/grass-snake/)
- [RSPB six native reptiles](https://www.rspb.org.uk/birds-and-wildlife/identifying-birds/six-reptiles-found-in-the-uk)

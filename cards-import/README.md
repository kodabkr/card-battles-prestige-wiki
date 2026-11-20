# Card import data

Transcriptions of card screenshots, one `batch-N.json` per set. Run:

```
node src/tools/crop-cards.mjs <CardIcons>/Battles <CardIcons>/_cropped/Battles
node src/tools/crop-cards.mjs <CardIcons>/Supports <CardIcons>/_cropped/Supports
node src/tools/import-cards.mjs cards-import/batches <CardIcons>/_cropped
```

The importer merges into `content/data/cards.json` and `traits.json`: cards and
traits not in these batches are kept, and hand-added fields (rarity, origin,
source, roles, notes) are kept. Batches 1-9 (the first 269 screenshots) were
imported on 2026-11-09 and their results live in cards.json.

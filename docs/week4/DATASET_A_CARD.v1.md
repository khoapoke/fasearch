# Dataset A card v1 - Week 4 pilot

## Identity and permitted use

- Source: `paramaggarwal/fashion-product-images-small` on Kaggle.
- Snapshot date: 08/09/2026.
- Local version: `dataset-a-small-raw-20260908-v1`, pinned by raw manifest content hash `68915e8e0441577ce7a0d476312dce1dcce6d85b5597297c8d513efb60ff4252`.
- License reported by Kaggle at download time: MIT. License must be rechecked before redistribution.
- Role: public catalog seed, ingest/index validation and frozen baseline pilot. It is not Vietnamese Gold data and does not replace composed retrieval or final qrels.
- Raw location: `ai/data/raw/dataset_a/` (Git-ignored and treated as immutable).

Kaggle does not expose a numeric dataset revision through the anonymous download used here. The immutable local content manifest and download date are therefore the exact snapshot identity. If authenticated Kaggle metadata later provides a numeric version, add it as a new manifest version without rewriting v1.

## Audit results

| Stage | Count |
|---|---:|
| Metadata rows before join | 44,446 |
| Unique image IDs before join | 44,441 |
| Valid joined rows | 44,441 |
| Rows after `masterCategory=Apparel` | 21,395 |
| Rows mapped to MVP taxonomy | 18,073 |
| Pilot catalog | 600 |

The downloaded archive contains a root tree and a byte-identical nested `myntradataset/` tree: 88,882 image paths but 44,441 unique IDs. The raw snapshot is preserved. Cleaning selects one deterministic path per ID and reports 44,441 duplicate source paths.

Quality findings:

- missing image IDs: 5;
- corrupt images: 0;
- rows missing required metadata (`id`, `masterCategory`, `articleType`, `productDisplayName`): 0;
- image IDs without metadata: 0;
- exact SHA-256 computed for every selected catalog image;
- 64-bit pHash computed for every selected catalog image;
- product-group clustering is explicitly `PENDING_NEAR_DUPLICATE_CLUSTER_REVIEW`, so pHash is prepared but not promoted to a final split/dedupe claim.

## Pilot catalog

- Snapshot: `catalog-20260908-pilot-v1`.
- SHA-256: `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44`.
- Balance: 200 TOP, 200 BOTTOM, 200 ONE_PIECE.
- Sampling seed: 42.
- Raw title remains catalog metadata only. Pilot query authors did not copy `productDisplayName`; titles are not final query text.

Generated local artifacts:

- `ai/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl`;
- `raw-manifest.v1.json`;
- `cleaning-report.v1.json`;
- `category-counts.v1.csv`;
- `mapping-report.v1.csv`;
- `missing-corrupt-report.v1.json`;
- `sample-gallery.v1.html`.

These generated files contain absolute local paths or large manifests and are not committed. Their stable hashes are recorded in `ai/data/manifests/week4-baseline-20260908-v1.json`.

## Known limitations and bias

- Product text is mainly English and commercial catalog wording, not native Vietnamese.
- Metadata lacks Gold material, pattern, silhouette and vibe labels.
- Article-type mapping is a Week 4 policy mapping; manual audit is still required before Phase 2 freeze.
- The 600-item sample is balanced by root category, not by every color/article type/gender/usage slice.
- pHash candidates have not yet been manually threshold-audited; product groups remain placeholders.
- Pretrained-model overlap cannot be ruled out and must be reported for final research claims.

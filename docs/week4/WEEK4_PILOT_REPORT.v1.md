# Week 4 frozen baseline pilot report v1

## Status and interpretation

This is a `PILOT_ONLY` engineering run over 24 manually written queries and weak metadata-derived relevance labels. It proves the path from Dataset A to Top-K/metrics. It is not the final benchmark, has no formal assessor agreement and must not be used to claim that the model is good or bad in general.

## Dataset, model and index

- Catalog: 600 products, balanced 200/200/200 across TOP/BOTTOM/ONE_PIECE.
- Catalog SHA-256: `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44`.
- Frozen encoder: `openai/clip-vit-base-patch32` at revision `092a3b7e31726acc3a0207eea00f6040ac8b03a7`.
- Runtime model version: `openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b`.
- Embedding: 512-dimensional float32; all finite; L2 norm range `0.99999988..1.00000012`; identical repeated image/text inputs had max absolute delta `0.0`.
- Index: `faiss-flatip-week4-v1`, exact `IndexFlatIP`, 600 rows.
- Fusion: `L2Norm(0.5 * image_embedding + 0.5 * text_embedding)`.
- K: 1, 5 and 10; strict relevance is weak grade >=2, relaxed is weak grade >=1.

## Overall pilot metrics at K=10

| Metric | Value |
|---|---:|
| Precision strict@10 | 0.0750 |
| Recall strict@10 | 0.0309 |
| TargetRecall@10 | 0.0833 |
| MRR strict@10 | 0.1651 |
| MRR relaxed@10 | 0.7778 |
| End-to-end latency p50 | 145.75 ms |
| End-to-end latency p95 | 562.44 ms |

## Metrics by mode at K=10

| Mode | Precision strict | Recall strict | TargetRecall | MRR strict |
|---|---:|---:|---:|---:|
| TEXT | 0.0250 | 0.0060 | 0.0000 | 0.0486 |
| IMAGE | 0.1833 | 0.0889 | 0.3333 | 0.4613 |
| COMPOSED | 0.0667 | 0.0228 | 0.0000 | 0.1019 |

Recall is low by construction because the weak relaxed qrels mark up to 200 same-category items relevant while only ten results are retrieved. Designated targets are a single manually selected item among many plausible products, so TargetRecall is diagnostic, not a complete relevance judgment.

## Five strongest observed cases

1. `dataset-a-image-016`: distinct pink-bottom target `25909` ranked first after excluding the query product.
2. `dataset-a-image-014`: distinct blue-top target `11703` appeared at rank 8.
3. `dataset-a-image-015`: six of the top ten met the weak strict category/color label even though the arbitrary designated target was absent.
4. `dataset-a-composed-021`: two of the top ten met the weak strict label; first strict hit was at rank 3.
5. `dataset-a-text-002`: the no-diacritic Vietnamese query produced a strict hit within top ten, though not the designated target.

## Five failure cases

1. `dataset-a-text-008` (`dam xanh de di bien`): no category/color strict hit and no target in top ten; the English CLIP tokenizer/representation is not a Vietnamese baseline.
2. `dataset-a-text-012` (explicitly excludes black): target absent and dense retrieval provides no logical negation guarantee.
3. `dataset-a-text-004` (black work bottom): target absent; results skewed toward visually/textually unrelated one-piece products.
4. `dataset-a-composed-019`: red-top target absent; equal-weight fusion stayed close to the blue anchor neighborhood.
5. `dataset-a-image-018`: target absent although visually similar yellow one-piece products appeared; one designated target is too narrow for catalog-level image relevance.

## Limitations and next evidence needed

- No final-test query or final qrel was used.
- Weak category/color labels are not assessor judgments; Precision/Recall/MRR are pipeline outputs only.
- Exact self-retrieval was used only in low-level mapping sanity tests, never as a quality number. Pilot image/composed queries explicitly exclude the source product.
- `productDisplayName` is returned as catalog metadata but was not copied verbatim into query text.
- This checkpoint is CLIP-compatible and frozen but not multilingual. A pinned multilingual/Vietnamese challenger remains open for RQ1.
- The p95 includes cold-start and short-lived FAISS worker overhead on macOS; component latency and persistent-worker latency still need a controlled protocol.
- Product groups are pHash-ready placeholders, not audited near-duplicate clusters.

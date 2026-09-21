# Phase 2 Data Foundation

## Outcome

Catalog, taxonomy labels, group split và query authoring pipeline đủ sạch cho RQ1/RQ2. Final test được freeze chỉ sau pilot annotation pass.

## Time box

2 đến 4 tuần, có thể tiếp tục active review sau gate.

## Workstreams

### P2.1 Dataset audit

Với mỗi public/custom source:

- access và license/status;
- size và missing rate;
- category mapping;
- image quality;
- language/caption quality;
- duplicate rate;
- train purpose;
- test overlap risk.

Kết quả là data-card và accept/reject decision.

Đối với Dataset A `paramaggarwal/fashion-product-images-dataset`, audit thêm:

- exact Kaggle version và lựa chọn full hay small;
- số record join được giữa image và `styles.csv`;
- tỷ lệ ảnh thiếu/corrupt;
- phân bố `masterCategory`, `subCategory` và `articleType`;
- mapping coverage vào TOP, BOTTOM và ONE_PIECE;
- missingness của color, season, usage và các field bắt buộc;
- số nhóm exact/near-duplicate;
- khả năng dùng `productDisplayName` mà không gây title leakage;
- những facet taxonomy không có Gold source như material, pattern, silhouette và vibe.

### P2.2 Catalog scale

1. Ingest raw products.
2. Exact dedupe.
3. pHash/title candidate clustering.
4. Manual audit near threshold.
5. Assign product_group.
6. Map taxonomy.
7. Generate normalized image/text views.

Theo dõi counts trước/sau từng bước, không chỉ final count.

### P2.3 Split

- Split groups, không split rows.
- Stratify category khi khả thi.
- Check zero group overlap.
- Generate all pairs only within split.
- Freeze split manifest version.

### P2.4 Tagger bootstrap

- Version prompt/model.
- Run product facets with confidence.
- Review first 0-200 labels.
- Update aliases/rules.
- Run calibration on held-out reviewed set.
- Establish auto-accept/review/unknown thresholds per attribute/class.

### P2.5 Vietnamese pairs

- Build Bronze translations/synthetic captions.
- Human-correct sample and measure common translationese.
- Build Silver native/corrected set.
- Keep Gold query path entirely separate.

### P2.6 Annotation pilot

- 20-30 new pilot queries not final.
- Two assessors each query.
- Time/ambiguity tracking.
- Revise guideline and form.
- Only then freeze final authoring protocol.

### P2.7 Final query authoring

RQ1:

- Target 200-300 final Gold queries.
- Controlled/natural balance and multi-axis metadata.
- Intent card for every query.

RQ2:

- 400 total: 240 controlled plus 160 natural.
- Six primary edit families x40 in controlled.
- Every query has anchor/target group and intent card.
- Select planned 100-query judged subset stratified before seeing final model results where possible.

### P2.8 Freeze

- Hash raw query and intent card.
- Store author metadata/access restrictions.
- Close edit permissions.
- Record freeze date/version.

## Required checks

### Split leakage

- No same product_group across split.
- No pHash near-dupe across split beyond audited exceptions.
- No anchor-target cross split.
- No final target in training pair.

### Text leakage

- Target title overlap report.
- Template-family distribution.
- Author blindness evidence/checklist.
- LLM-generated text marker.

### Balance

- Category counts.
- Attribute/class counts.
- RQ1 writing-style supports.
- RQ2 primary edit family counts.
- Single versus multi-attribute counts.

## Deliverables

- Data cards.
- Catalog cleaned snapshot.
- Product group map and split manifest.
- Taxonomy/alias/threshold versions.
- Bronze/Silver training datasets.
- RQ1/RQ2 frozen query+intent artifacts.
- Annotation guideline v1.
- Leakage and balance reports.

## Gate 2 checklist

- [ ] Data sources accepted/rejected with reasons.
- [ ] Product group overlap zero.
- [ ] Required category/attribute support adequate.
- [ ] Tagger threshold table exists.
- [ ] Annotation pilot passed.
- [ ] Query/intent freeze complete.
- [ ] Test access controlled/logged.
- [ ] RQ2 budget arithmetic verified: 240 controlled, not 60, supplies 40 per family.

## Failure handling

- Dataset access fails: activate documented fallback, update Stage 1 decision.
- Too many duplicates: reduce raw count target or add source, never split duplicate groups.
- Kappa pilot low: revise guideline and rerun pilot, do not adjudicate away disagreement.
- Rare attribute underfilled: generate additional controlled tasks before freeze.

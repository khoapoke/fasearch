# Phase 1 Baseline Vertical Slice

## Outcome

Một search path chạy xuyên suốt từ product data đến ranked results và metrics trên catalog pilot. Đây là bằng chứng kiến trúc, không phải final result.

## Time box

1 đến 2 tuần.

## Scope

- 300 đến 1000 products cân bằng TOP/BOTTOM/ONE_PIECE cho Week 4; số khác phải có lý do audit rõ.
- Ít nhất một frozen CLIP-compatible model chạy thật; challenger multilingual thêm sau khi baseline gate xanh.
- 20 đến 30 pilot queries.
- Text-to-image, image-to-image và equal-weight image-text composed search đều bắt buộc trong Week 4.

## Steps

### P1.1 Pilot catalog

1. Chọn data nguồn dễ truy cập.
2. Tạo product IDs và image checksums.
3. Gắn minimum category/color/material/pattern.
4. Tạo product_group pilot.
5. Lưu catalog manifest.

### P1.2 Encoder adapters

Mỗi adapter thực hiện:

- official preprocessing;
- image batch encoding;
- text batch encoding;
- L2 normalization;
- model/checkpoint metadata;
- deterministic ID mapping.

Không hard-code checkpoint trong evaluation script.

### P1.3 FAISS index

- Chọn exact flat inner-product index trước để làm reference.
- Lưu mapping row-product_version.
- Verify self-retrieval/image-near-image sanity.
- ANN index chỉ thêm sau exact correctness.

### P1.4 Query and qrels pilot

- Author viết 20-30 queries.
- Mỗi query có designated target và intent card sơ bộ.
- Không đưa query này vào final Gold test.
- Chấm đủ để kiểm metric pipeline, không cần formal kappa claim.

### P1.5 Evaluation run

- Run frozen engineering baseline; B0/B1 multilingual comparison vẫn phải hoàn tất trước RQ1 final.
- Save TREC-like run file/per-query JSON.
- Compute TargetRecall, nDCG/MRR nếu pilot qrels có grade.
- Inspect top failure examples.

### P1.6 Minimal API

- Endpoint text search.
- Product result DTO.
- Return model/index/catalog version.
- Simple client hoặc API docs demo đủ.

## Technical invariants

- Vector dimension matches index.
- Index metric inner product chỉ dùng normalized embeddings.
- Product version trong index phải Active trong snapshot.
- Same input/model version produces stable embedding within tolerance.
- No final-test data exists in this phase.

## Deliverables

- Pilot catalog manifest.
- B0/B1 checkpoint manifests.
- Một index snapshot riêng cho mỗi baseline đã chạy.
- Pilot query/qrels/run artifacts.
- Metric report.
- Minimal Search API.
- Known-issues document.

## Gate 1 checklist

- [ ] 300-1000 products searchable cho Week 4, hoặc có lý do audit rõ.
- [ ] Query trả đúng product IDs/images.
- [ ] Mỗi baseline đã chạy dùng index riêng đúng checkpoint; Week 4 tối thiểu một baseline thật.
- [ ] Metric fixture and pilot metrics pass.
- [ ] Clean rerun instructions verified by another member.
- [ ] Latency/memory rough baseline recorded.
- [ ] Failures are explainable as data/model/code categories.

## Common traps

- Dùng index của model A cho model B.
- Normalize query nhưng không normalize catalog.
- Product mapping off by one.
- Crop ảnh khác giữa training/evaluation.
- Coi pilot performance là final claim.
- Bắt đầu làm 3D khi baseline chưa chạy.

## Exit decision

Nếu ViCLIP-OT không chạy hoặc license/dependency/data-overlap audit có vấn đề, ghi lý do và chọn Vietnamese baseline khác trước RQ1 final. Không loại silently.

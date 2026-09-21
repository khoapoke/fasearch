# Phase 8 Report and Defense

## Outcome

Báo cáo và buổi bảo vệ trả lời trực tiếp ba RQ, mọi claim truy ngược được tới artifact, demo có đường dự phòng.

## Continuous writing

Phase 8 không bắt đầu từ số 0 ở cuối dự án. Sau mỗi gate:

- lưu table/figure source;
- viết setup/result/limitation notes;
- cập nhật glossary/reference;
- chụp architecture/UI khi stable;
- ghi decision and failed experiments.

## Report assembly

### Front matter

- Template trường mới nhất.
- Thành viên/MSSV/GVHD chính xác.
- Vietnamese summary and English abstract.
- Lists/TOC generated from styles/captions.

### Chapters

Theo [Thesis Proposal Mapping](../09_THESIS_PROPOSAL_MAPPING.md).

### Reproducibility appendix

- Data cards.
- Taxonomy/schema versions.
- Experiment configs/run IDs.
- Full metrics/CI.
- Negative contamination.
- Annotation guideline/qrels format.
- Compute/latency environment.

## Result freeze

1. Chọn final qrels/version.
2. Chọn final run IDs.
3. Generate tables/figures bằng script.
4. Hash output CSV/JSON/figures.
5. Không copy sửa số trong Word.
6. Nếu rerun, tạo result version mới và update toàn report consistently.

## Claim audit

Mỗi claim quan trọng có:

- RQ/hypothesis;
- metric/table/figure;
- run IDs;
- sample size;
- uncertainty;
- scope/limitation.

Loại các claim:

- vượt hệ thống không được benchmark;
- production-ready tuyệt đối;
- privacy/legal compliance tuyệt đối;
- accurate fit/body measurement chưa đo;
- thấp loss đồng nghĩa cao retrieval accuracy;
- p-value/CI bị diễn giải quá mức.

## Defense deck

### Slide budget gợi ý

1. Title/team.
2. Problem and gap.
3. Scope and contribution.
4. System/data pipeline.
5. Taxonomy/benchmark rigor.
6. RQ1.
7. RQ2.
8. RQ3.
9. Product architecture/demo.
10. Error/limitation.
11. Bonus/future.
12. Conclusion.

Giảm chi tiết implementation không trả lời RQ; đưa appendix slides cho model/data/metric questions.

## Demo script

### Happy path

1. Seller creates/publishes one product.
2. User runs colloquial Vietnamese query.
3. User selects anchor and applies composed modification.
4. Show Exact/Substitute/Unverified.
5. Open evidence/provenance summary.
6. Optional outfit/VTON.

### Failure path chủ động

Chọn một query không answerable để chứng minh hệ thống không nói dối: no exact, transparent substitute. Đây là evidence thiết kế, không phải demo fail.

### Recovery

- Local services and index.
- Frozen parser cache.
- Pre-recorded video.
- Screenshots.
- Static result artifact.

## Team rehearsal

- Mỗi người nói phần chính của mình.
- Mọi người đều trả lời được core pipeline/RQs.
- Reviewer giả lập hỏi về leakage, baselines, significance, parser/tagger confound, 3D limitation.
- Rehearse time and handoff.
- Có one-sentence answer và deep appendix answer cho mỗi câu.

## Final QA

- Spell/terminology consistent.
- RQ wording identical across report/slides.
- Table metric definitions consistent.
- Figure axes/units/sample sizes present.
- References resolve and style consistent.
- No personal data/raw user images leaked.
- Build/deploy instructions tested.
- Final archive includes source and artifacts.

## Gate 8 checklist

- [ ] Three RQs answered directly.
- [ ] Every key number traceable.
- [ ] Frozen test integrity stated.
- [ ] Failures and null results included.
- [ ] Report formatting follows current school template.
- [ ] Demo and backup tested.
- [ ] Team rehearsal completed.
- [ ] Submission archive verified on another machine/account if possible.

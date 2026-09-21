# Roadmap thực thi đồ án

## Nguyên tắc điều hành

- Làm vertical slice trước scale.
- Mỗi phase có artifact và gate; không chuyển vì `cảm giác gần xong`.
- Research code và product code dùng chung core libraries nhưng tách entry points.
- Final test chỉ mở theo protocol.
- Bonus không chiếm capacity khi core gate đỏ.
- Mọi quyết định mới vào Decision Register.
- Stack hiện hành từ 10/09/2026 theo D054/D055: Next.js website, Spring Boot API nghiệp vụ và Python AI nội bộ; mobile tùy thời gian sau core, kiểm thử, triển khai và báo cáo.

## Dependency graph

```text
Phase 0 Protocol
      |
      v
Phase 1 Baseline Vertical Slice
      |
      v
Phase 2 Data Foundation
      |
      +-----------> Product shell/API can proceed in parallel
      |
      v
Phase 3 RQ1 -> Phase 4 RQ2 -> Phase 5 RQ3
      |                              |
      +------------------------------+
                     |
                     v
             Phase 6 Website
                     |
              +------+------+
              v             v
       Outfit bonus     VTON 3D stretch
              \             /
               v           v
             Phase 8 Report Defense
```

## Ước lượng tương đối

Ước lượng dưới đây dùng sprint một tuần và nhóm ba người; phải điều chỉnh theo lịch trường.

| Phase | Thời lượng gợi ý | Critical output |
|---:|---:|---|
| 0 Protocol freeze | 3-5 ngày | Docs/schema/test fixtures |
| 1 Baseline slice | 1-2 tuần | End-to-end frozen search |
| 2 Data foundation | 2-4 tuần | Catalog/split/query v1 |
| 3 RQ1 | 2-3 tuần | Vietnamese adaptation table |
| 4 RQ2 | 3-4 tuần | Fusion/hard-negative panels |
| 5 RQ3 | 2-3 tuần | Matrix/lanes/evidence/latency |
| 6 Product integration | 3-5 tuần, chạy song song một phần | Next.js website/Spring Boot API/seller demo tích hợp Python AI |
| 7 Bonus | 1-4 tuần time-box | Compatibility hoặc VTON prototype |
| 8 Report/defense | 2-4 tuần, viết dần từ sớm | Final thesis/demo |

Không cộng các dòng như lịch tuần tự tuyệt đối; backend/UI có thể chạy song song từ Phase 1. Research dependency vẫn tuần tự RQ1 đến RQ3.

## Team streams

### Stream A AI and evaluation

- Baseline encoders và FAISS experiment index.
- Curriculum training.
- Metrics/bootstrap.
- RQ tables/error analysis.
- Parser/tagger/compatibility model.

### Stream B Data and backend

- Spring Boot API: auth/roles, product schema, catalog/history, ingest, storage và job orchestration.
- Dedupe/group/snapshot tooling.
- Review queue và provenance.
- Search/evidence API công khai và contract với FastAPI nội bộ dùng core Python `ai/ml/`.
- Python worker cho xử lý ảnh/embedding/index; pin artifact và không lặp lại dữ liệu nghiệp vụ.
- Deployment/observability.

### Stream C Next.js and product

- Next.js/TypeScript, design system và navigation cho website.
- Search modes/result lanes.
- Seller/reviewer interfaces.
- Browser upload/preview và responsive layout.
- Demo/usability và website release.

Mobile chưa có stream bắt buộc hoặc framework đã chọn. Chỉ phân công time-box khi website/search core, kiểm thử, triển khai và báo cáo đã sẵn sàng; client mở rộng dùng API Spring Boot.

### Shared duties

- Query authoring và annotation rotate.
- Review code/data schema.
- Weekly risk/decision review.
- Report writing theo artifact vừa hoàn thành.

## Weekly operating cadence

### Đầu tuần

- Chọn phase gate và 3 đến 5 outcomes, không chỉ task list.
- Xác nhận artifact versions sử dụng.
- Phân owner/reviewer.

### Giữa tuần

- Demo vertical progress.
- Kiểm data/model provenance.
- Ghi blocker và decision proposal.

### Cuối tuần

- Chạy acceptance/gate checklist.
- Lưu metrics và screenshots cần thiết.
- Viết report notes ngay, không chờ cuối kỳ.
- Chỉ promote artifact sau reviewer sign-off.

## Phase gates tổng hợp

### Gate 0 Protocol Ready

- Research questions/hypotheses versioned.
- Schema validate.
- Taxonomy seed có owner/version.
- Final-test access policy rõ.
- Repo/environment bootstrap chạy.

### Gate 1 Vertical Slice Alive

- Theo D053 cho Week 4: 300–1.000 products searchable (snapshot pilot hiện tại 600, cân bằng ba category).
- Ít nhất một frozen CLIP-compatible encoder/index chạy đủ text, image và composed; B0/B1 multilingual vẫn phải hoàn tất trước RQ1, không chặn vertical slice Week 4.
- 20-30 pilot query metric output.
- Product ID/index mapping verified.
- Run reproduce từ clean environment.

### Gate 2 Data Ready

- Catalog v1, product-group split và data cards.
- Taxonomy/tagger baseline.
- Query authoring pilot pass.
- Final queries/intent freeze theo lịch.
- Không unresolved leakage blocker.

### Gate 3 RQ1 Complete

- Baseline/adapted checkpoints.
- Paired CI và slice support.
- Stage 2 miner frozen.
- Error analysis.

### Gate 4 RQ2 Complete

- 400 query TargetRecall.
- 100 query judged pool metrics.
- Panel A/B tables.
- Negative contamination audit.
- Stage 4 hoặc 5 promotion decision.

### Gate 5 RQ3 Complete

- D và matrix 2x2.
- Ideal/CandidateRecall.
- Exact/Substitute/Unverified tests.
- Evidence assertion/faithfulness.
- Latency Pareto and frozen N.

### Gate 6 Product Demo Ready

- Next.js website core flow trên browser test matrix; không yêu cầu Android/iOS build.
- Seller to Active flow.
- Deployed Spring Boot API/database/storage và Python AI service/worker.
- Contract Java–Python, timeout, model/index/catalog version và latency website toàn tuyến được kiểm tra.
- Error states and privacy controls.
- Offline backup/demo video.

### Gate 7 Bonus Validated

- Separate dataset/metric.
- Failure cases documented.
- Feature can be disabled without breaking core.

### Gate 8 Defense Ready

- Report claims trace to artifacts.
- Slides answer RQs directly.
- Live demo script and contingency.
- Team members explain their areas and shared core.

## Definition of Done cho một experiment

- Config committed.
- Data/model/index hashes present.
- Environment and GPU-hours logged.
- Run completed or failure reason saved.
- Per-query outputs retained.
- Metric and CI generated.
- Error slices produced.
- Decision promote/reject written.
- Table/figure source generated from artifact, không copy số thủ công.

## Definition of Done cho một feature

- User story và acceptance criteria.
- API/schema version.
- Unit/integration tests.
- Loading/error/empty/permission states.
- Telemetry không lộ dữ liệu nhạy cảm.
- Website behavior được kiểm tra trên browser/layout đã chọn; nếu có mobile mở rộng, ghi rõ deviation và giữ cùng API semantics.
- Demo data và screenshot.
- Rollback/feature flag nếu feature nặng.

## Risk register

| ID | Risk | Probability | Impact | Trigger | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R1 | Dataset access chậm | Medium | High | Không tải được sau time-box | Chọn fallback dataset/custom catalog | Data |
| R2 | Label workload lớn | High | High | Pool item tăng quá dự kiến | Judged subset, dedupe, byproduct facet gold | Eval |
| R3 | RQ1 không hơn baseline | Medium | Medium | CI chứa 0 | Báo null result, slice/error insight, không overfit test | AI |
| R4 | Hard-negative contamination | Medium | High | Audit >5 percent | negatives v2 và retrain | AI/Eval |
| R5 | Parser external drift | Medium | Medium | Response thay đổi | Freeze response/version/date | AI |
| R6 | Ranh giới Spring Boot–Python AI làm tăng lỗi tích hợp/latency | Medium | Medium | DTO/version lệch hoặc AI timeout | Contract test, timeout rõ, propagation provenance và đo latency toàn tuyến | Backend/AI |
| R7 | GPU deployment cost | High | Medium | VTON/tagger timeout/cost | Async worker, precompute, feature flag | Backend |
| R8 | 3D scope explosion | High | High | Core gate đỏ | Time-box/prototype/manual avatar | PM |
| R9 | Demo internet failure | Medium | High | External service unavailable | Cached demo, local API, video backup | All |
| R10 | Thesis figures stale | Medium | High | Numbers copied manually | Generate from run artifacts | Eval |

## Scope cut order khi thiếu thời gian

1. Giữ RQ1-RQ3 và benchmark.
2. Giữ website search/seller minimum, API, kiểm thử, triển khai và báo cáo.
3. Cắt mobile mở rộng trước khi ảnh hưởng các deliverable bắt buộc; không giữ một mobile build như điều kiện gate.
4. Cắt personalization.
5. Cắt multi-layer outfit.
6. Cắt VTON multi-garment trước single-item prototype.
7. Cắt automatic 3D reconstruction, giữ manual/sample avatar demo nếu cần.

Không cắt reproducibility, data split hoặc final-test integrity để đổi lấy thêm feature.

## Milestone evidence folder

Mỗi milestone nên có:

```text
milestones/Mx/
  README.md
  manifests/
  metrics/
  figures/
  screenshots/
  known_issues.md
  approval.md
```

Approval ghi owner, reviewer, ngày và gate checklist.

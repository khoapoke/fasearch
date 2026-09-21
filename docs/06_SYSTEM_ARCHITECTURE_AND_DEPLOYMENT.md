# Kiến trúc hệ thống và triển khai

Phiên bản tài liệu 1.1, cập nhật 10/09/2026 theo D054/D055 và CP-20260910-STACK trong [Decision Register](10_DECISION_REGISTER.md). Đây là kiến trúc triển khai được chọn; tại mốc Week 4 mới có core Python/CLI, chưa có website hoặc các HTTP service bên dưới.

## Mục tiêu kiến trúc

Kiến trúc phải phục vụ đồng thời ba nhu cầu:

1. Thực nghiệm có thể tái lập.
2. Catalog có lifecycle và cập nhật an toàn.
3. Website dùng API nghiệp vụ ổn định, tái sử dụng được cho mobile tùy chọn về sau.

## Technology decisions

| Layer | Lựa chọn MVP | Lý do |
|---|---|---|
| Website | Next.js, TypeScript | Tập trung UI Web theo đề cương; responsive desktop/mobile browser |
| API nghiệp vụ công khai | Java Spring Boot | Auth, quyền, catalog, history, saved products và điều phối tìm kiếm |
| AI service nội bộ | Python + FastAPI adapter | Gọi core `ai/ml/` dùng chung CLI; PyTorch inference, FAISS, fusion và provenance |
| Mobile | Tùy chọn sau core; framework chưa chọn | Dùng cùng API Spring Boot khi nhóm có đủ thời gian |
| Training | PyTorch | Ecosystem CLIP, LoRA và Colab T4 |
| Vector research | FAISS | Kiểm soát index, nhanh và phù hợp benchmark |
| Metadata | PostgreSQL | Transaction, relation, audit/version query |
| Background processing | Python worker; Redis plus Celery/RQ nếu cần broker | Spring Boot điều phối lifecycle job, worker xử lý tag/embed và trả kết quả versioned |
| Object storage | S3-compatible | Ảnh raw/processed và model artifacts |
| Packaging | Docker | Đồng nhất local/demo deployment |

Tên queue/vendor có thể đổi mà không ảnh hưởng protocol nếu job semantics được giữ.

Phiên bản Next.js/Node/package manager, JDK/Spring Boot và Maven wrapper được pin lúc scaffold theo Phase 0; không có lock Web/Java được kiểm thử ở mốc tài liệu này. Python tiếp tục dùng lock và manifest Week 4.

## Ranh giới triển khai và ownership

```text
Browser -> Next.js -> Spring Boot /v1 -> internal FastAPI -> ml/ -> PyTorch + FAISS
                            |
                 PostgreSQL / object storage / job orchestration
                            |
                     Python processing worker
```

- Spring Boot là một ứng dụng modular monolith: Identity, Catalog, Review, History và Search orchestration là module trong cùng backend. Backend sở hữu auth, phân quyền, metadata nghiệp vụ, trạng thái job và publication.
- Next.js dùng API Spring Boot cho nghiệp vụ; server rendering/proxy chỉ phục vụ Web. Không tạo thêm một bộ user/role/catalog logic trong Next.js.
- AI service xử lý encode, fusion, retrieval và các bước parser/reranker/evidence khi phase tương ứng được mở. Service giữ model/index trong bộ nhớ theo publication manifest và không ghi trực tiếp user/catalog business tables.
- Worker Python nhận job với product version, ảnh/metadata cần thiết và model config; ghi artifact vào storage, trả kết quả/provenance về Spring Boot bằng callback nội bộ có xác thực hoặc completion event. Spring Boot cập nhật trạng thái và quyết định publish trong transaction của nó.
- Mobile không cần triển khai để đạt website gate; khi mở sẽ dùng cùng API công khai, không truy cập AI service trực tiếp.

### Contract Java–Python tối thiểu

Spring Boot gọi AI service qua HTTP/JSON nội bộ, không spawn tiến trình CLI cho từng request và không chuyển PyTorch/FAISS sang Java. Giữ một implementation encoder/fusion/ranking trong `ai/ml/` để CLI, evaluation và HTTP adapter cùng dùng.

Request chứa request/trace ID, mode, K, raw text cùng model view nếu có, image bytes hoặc storage reference đã kiểm soát quyền truy cập, catalog snapshot, model và index version. AI service không được tự tải URL tùy ý từ người dùng. AI response trả product ID/version, rank, score, model/index/catalog provenance và latency thành phần; Spring Boot bổ sung title, image reference và metadata theo đúng snapshot, giữ nguyên rank/score.

Các lỗi validation, model/index mismatch, unavailable và timeout có mã rõ; Spring Boot chuyển thành lỗi API phù hợp. Mỗi lời gọi có connect/read timeout và trace ID; retry chỉ có giới hạn với thao tác idempotent trong tổng thời hạn request. Không âm thầm chuyển model hoặc index. Contract DTO/OpenAPI và tests ba chế độ được tạo khi tích hợp, không coi các schema research hiện tại là hợp đồng HTTP đã hoàn thiện.

## Bounded contexts

### Identity

User, role, session và consent. Không chứa model logic.

### Catalog

Product aggregate, image assets, facet versions, lifecycle và seller ownership.

### ML Processing

Quality validation, tagger, caption/text views, embedding và VTON jobs.

### Search

Query normalization/view, encoders, candidate generation, parser, reranking, lanes và evidence.

### Evaluation

Dataset snapshots, query sets, runs, judgments, qrels, metrics và experiment manifests. Tách khỏi online feedback.

### Outfit

Compatibility score, named factors, context rerank và counterfactual. Không phụ thuộc VTON.

## Data stores

### PostgreSQL

Tables/concepts tối thiểu:

- users, roles, consents;
- sellers;
- products, product_versions;
- product_images;
- product_groups;
- facet_predictions, facet_reviews, approved_facets;
- processing_jobs;
- index_publications;
- search_requests, search_results;
- saved_products, saved_outfits;
- model_registry, taxonomy_versions;
- audit_events.

Research raw judgments/qrels có thể lưu file immutable trước, database chỉ index metadata.

### Object storage

- raw images immutable;
- normalized thumbnails/encoder inputs;
- optional VTON inputs/outputs với retention riêng;
- checkpoints và large artifacts nếu không dùng external registry;
- catalog/index snapshots.

### FAISS

Index artifact gồm:

- index binary;
- row-to-product-version mapping;
- checkpoint/preprocessing hash;
- catalog snapshot hash;
- build config và metric;
- checksum.

Search service chỉ load một atomic publication manifest. Không trộn rows từ hai embedding versions.

## Catalog ingestion sequence

```text
Seller -> Spring Boot Catalog API: create draft
Catalog API -> Storage: upload images
Catalog API -> Job dispatcher: process product_version
Worker -> Validator: quality and duplicate checks
Worker -> Tagger: facets and confidence
Tagger -> Review queue: uncertain/conflicting facets
Reviewer -> Spring Boot Catalog: approve/correct
Worker -> Encoder: product embedding
Worker -> Storage: immutable candidate index + manifest
Worker -> Spring Boot: completion + provenance
Spring Boot publisher -> AI service: validate/load/swap publication
Catalog -> Product state: ACTIVE when publication succeeds
```

Nếu job fail, product không Active. Retry dùng `(job_type, product_version_id, model_version)` làm idempotency identity.

## Search sequence

### Text mode

1. Spring Boot validate request/quyền, tạo query ID và resolve catalog/model/index publication.
2. Lưu raw query theo retention; gọi AI service nội bộ, tạo normalized model view nhưng không mất raw.
3. Python text encoder tạo vector.
4. FAISS lấy top-N.
5. Optional parser tạo structured intent.
6. Reranker tạo constraint states và lanes.
7. Evidence builder tạo machine evidence.
8. Template hoặc LLM verbalizer diễn đạt evidence.
9. AI trả rank/score/evidence/provenance; Spring Boot bổ sung product metadata và trả về website.

Bước parser/reranker/evidence chỉ bật khi phase tương ứng hoàn tất; Week 4 vẫn là dense Top-K với equal-weight fusion đã khóa.

### Image mode

Quality validation chạy trước encoder. Ảnh tạm được xóa theo retention. Parser không chạy nếu không có text.

### Composed mode

Anchor có thể là upload hoặc active product ID. Nếu product ID, dùng đúng product embedding version trong catalog snapshot. Modification text vào combiner và parser. Relative constraints tham chiếu `anchor`.

## Reranking semantics

Candidate record giữ:

- dense rank/score;
- hard constraint state từng field;
- soft taxonomy score;
- lane;
- relaxed constraints;
- unknown source;
- final score/rank;
- evidence reference.

Exact lane luôn trước Substitute/Unverified trong UX, trừ khi experiment mode yêu cầu list phẳng. Research run ghi mode.

## Version propagation

Mỗi request nội bộ mang:

```yaml
catalog_snapshot_id:
embedding_model_version:
index_version:
taxonomy_version:
parser_version:
tagger_version:
reranker_version:
evidence_schema_version:
```

Không lấy `latest` giữa request vì có thể race. Resolve versions ở request start.

## Concurrency và consistency

### Product update

- Optimistic version check trên PATCH.
- Re-embedding tạo version mới, không sửa vector đang publish.
- Index publication atomically swap manifest/pointer.
- Archive dùng tombstone hoặc rebuild; search lọc inactive product bằng snapshot state.

### Background jobs

- At-least-once delivery được chấp nhận nếu handler idempotent.
- Job status: queued, running, succeeded, failed_retryable, failed_terminal, cancelled.
- Exponential backoff có maximum retry.
- Dead-letter/review queue cho terminal failures.

### Search

- API stateless ngoài cache.
- Timeout budget theo component.
- Parser/tagger external failure có fallback được version hóa, không âm thầm đổi mode.

## Failure handling

| Failure | User behavior | Internal action |
|---|---|---|
| Parser timeout | Dense results hoặc thông báo mode giảm cấp | Log fallback reason/version |
| No exact results | Hiển thị message và separate substitute section | Keep ZeroResultRate_exact event |
| Product facet unknown | Unverified lane | Enqueue review candidate nếu policy cho phép |
| Index unavailable | Friendly retry/error | Health alert, rollback prior index |
| Image invalid | Hướng dẫn chụp/upload lại | Không chạy encoder |
| VTON multi-item fail | Cho thử từng item nếu có | Preserve full-job failure record |
| Evidence inconsistency | Không publish result trong research; safe generic explanation online | Raise bug/alert |

## Evidence architecture

Structured JSON được tạo trước natural language. Deterministic consistency test dùng cùng scoring library trong offline và online code. Verbalizer chỉ nhận evidence fields được allowlist.

Evidence version/hash tối thiểu:

- score/mode;
- query and product versions;
- dense score;
- hard/soft constraint evaluations;
- contributions/relaxations;
- taxonomy, parser, tagger, reranker versions;
- catalog snapshot;
- explanation template/model version.

## Observability

### Logs

Structured events có trace ID, query/job ID và version fields. Không log raw user image hoặc sensitive text ngoài policy.

### Metrics

- request count/error/latency by mode;
- candidate depth và zero/shortfall rates;
- parser abstention;
- facet unknown source;
- review queue age;
- processing job retry/fail;
- index publication duration;
- explanation consistency failures;
- VTON failure categories.

### Traces

Span: browser request, Spring Boot API, internal HTTP, parser, encoder, FAISS, reranker, evidence, database. External API có retry/timeout spans. Báo latency toàn tuyến website → Spring Boot → Python bên cạnh AI-only latency; pilot CLI Week 4 không chứa chi phí Web/Java/network này.

## Security và privacy

- Validate MIME, file signature, size và pixel limits.
- Randomized object keys, không dùng user filename trực tiếp.
- Signed URLs hoặc authenticated proxy.
- Password hash bằng Argon2id/bcrypt phù hợp library.
- Access control theo seller/product ownership.
- Rate limit expensive image/VTON endpoints.
- Secrets từ environment/secret store, không commit.
- User can delete search history và VTON assets theo retention policy.
- Training dataset không tự động lấy user uploads.

## Deployment environments

### Local development

Docker Compose hoặc scripts khởi chạy Next.js, Spring Boot, AI service Python, PostgreSQL, worker và storage emulator; chỉ thêm Redis/broker khi job path cần. FAISS index nhỏ được mount read-only. Phase 0 quy định đường dẫn `apps/web`, `services/api`, `services/ai`, `services/worker`; đây là scaffold dự kiến, không tạo service giả chỉ để đủ cây thư mục.

### Research

Training trên Colab T4 hoặc GPU environment; artifacts download vào model registry với checksum. Evaluation chạy container hoặc locked environment.

### Demo

- Next.js Web trên Node hosting/container; chỉ dùng static export nếu tính năng được chọn tương thích.
- Spring Boot container là backend/API công khai trên managed CPU service/VPS.
- FastAPI AI service nội bộ trên CPU, load checkpoint/index theo manifest khi khởi động hoặc publication swap.
- PostgreSQL managed hoặc container có backup.
- Object storage managed.
- FAISS loaded trong Search service.
- GPU worker optional cho tagger/VTON; core retrieval có thể dùng CPU với precomputed catalog.

Mobile tùy chọn về sau trỏ vào cùng HTTPS API Spring Boot. Không dùng Colab notebook làm production server. Giới hạn số AI worker/process theo RAM vì mỗi process có thể giữ một bản model/index; không mặc định nhân số worker như API nghiệp vụ.

## API evolution

- Prefix `/v1`.
- OpenAPI checked into repository hoặc generated in CI.
- Public Spring Boot contract và internal AI contract được version/test riêng; schema product/intent/evidence vẫn tuân Decision Register.
- Additive field changes preferred.
- Breaking intent/evidence schema change tăng major version.
- Client hiển thị graceful unknown fields/version.

## Testing pyramid

### Unit

- taxonomy operators;
- relaxation ordering;
- state/lane mapping;
- evidence recomputation;
- schema validation;
- product state transitions.
- Spring Boot business validation và Next.js UI state/DTO handling.

### Integration

- upload to active product;
- index version swap;
- text/image/composed search;
- parser timeout fallback;
- reviewer correction triggers re-embed.
- Spring Boot–AI DTO/error/timeout/provenance contract và rank parity với Python CLI.

### Research regression

- fixed tiny catalog/query fixture;
- expected top-K/metrics;
- embedding/index compatibility;
- qrels parser;
- bootstrap deterministic seed.

### End-to-end

- Next.js text/image/composed search qua Spring Boot và AI service;
- responsive Web trên desktop/mobile browser; native mobile E2E chỉ khi mở phần tùy chọn;
- seller publish;
- exact/substitute/unverified UX;
- consent/delete for VTON if enabled.

## Release gate

- [ ] Database migrations reviewed.
- [ ] Model/index/catalog versions match.
- [ ] Core journeys pass.
- [ ] Next.js → Spring Boot → Python AI hoạt động cho ba chế độ; timeout/mismatch có lỗi rõ và provenance khớp.
- [ ] Security upload checks pass.
- [ ] p50/p95 baseline recorded.
- [ ] Latency website toàn tuyến được ghi riêng với latency AI/CLI; mobile không là điều kiện release core.
- [ ] Rollback previous API/index available.
- [ ] Demo data seeded without final-test leakage.
- [ ] Backup demo video and offline mode prepared for defense.

## Nguồn kỹ thuật

- [Next.js App Router](https://nextjs.org/docs/app): mô hình frontend Web và ranh giới server/client.
- [Spring Boot REST service](https://spring.io/guides/gs/rest-service/) và [REST client](https://spring.io/guides/gs/consuming-rest/): cơ sở cho API nghiệp vụ và kết nối HTTP nội bộ.
- [FastAPI deployment concepts](https://fastapi.tiangolo.com/deployment/concepts/): lifecycle process và bộ nhớ model khi triển khai Python AI.

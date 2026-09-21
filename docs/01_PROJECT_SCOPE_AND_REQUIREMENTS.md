# Phạm vi và yêu cầu hệ thống

## Mục đích tài liệu

Tài liệu này thay thế phần yêu cầu nghiệp vụ bán lẻ tổng quát trong bản Word cũ. Hệ thống được đặc tả như một nền tảng tìm kiếm thời trang AI có seller-managed catalog, không phải một hệ thống POS hoặc e-commerce đầy đủ.

Stack và phạm vi nền tảng cập nhật ngày 10/09/2026 theo [D054/D055 và CP-20260910-STACK](10_DECISION_REGISTER.md): website Next.js/TypeScript là deliverable bắt buộc, Java Spring Boot là backend nghiệp vụ/API công khai, Python FastAPI là adapter AI nội bộ tái sử dụng `ai/ml/`. Mobile là mở rộng tùy thời gian; framework chưa chọn.

## Mục tiêu sản phẩm

1. Cho phép người dùng tìm sản phẩm bằng văn bản tiếng Việt, ảnh hoặc ảnh cộng mô tả sửa đổi.
2. Cho phép seller tạo và duy trì catalog có embedding được version hóa.
3. Dùng taxonomy để hiểu constraint, rerank và giải thích kết quả.
4. Hoàn thiện website cho các luồng cốt lõi; giữ API có thể phục vụ mobile nếu mở rộng sau.
5. Thu thập artifact phục vụ thực nghiệm và báo cáo đồ án.

## Actor

| Actor | Mục tiêu | Quyền chính |
|---|---|---|
| Guest Shopper | Thử tìm kiếm và xem kết quả | Search, xem product/evidence, dùng avatar mẫu |
| Registered Shopper | Lưu lịch sử và outfit | Quyền Guest cộng save/history/preferences |
| Seller | Đăng và quản lý sản phẩm của mình | Product CRUD, xem tag, sửa metadata, request publish |
| Reviewer | Xử lý item confidence thấp | Duyệt facet, sửa label, reject ảnh hoặc product |
| Admin | Quản trị taxonomy, user và catalog | Version taxonomy, khóa product, audit log |
| Researcher | Chạy snapshot và benchmark | Export manifest, run evaluation, xem error analysis |

Một tài khoản có thể giữ nhiều vai trò trong môi trường demo, nhưng API authorization vẫn kiểm tra scope.

## User journey bắt buộc

### Text search

1. User nhập câu tiếng Việt.
2. Hệ thống giữ raw query, đồng thời parse thành intent có confidence.
3. Dense retriever lấy top-N candidate.
4. Taxonomy layer tạo Exact, Substitute hoặc Unverified.
5. User xem top-K cùng evidence và product detail.

### Image search

1. User tải ảnh hoặc chụp ảnh.
2. Quality validator kiểm tra định dạng, kích thước và nội dung có thể xử lý.
3. Image encoder tạo query embedding.
4. FAISS trả candidate và UI hiển thị similarity-based results.

### Composed search

1. User chọn anchor image hoặc product.
2. User mô tả thay đổi, ví dụ `giống mẫu này nhưng màu đỏ và dài hơn`.
3. Combiner tạo composed embedding.
4. Parser tạo typed constraints có operator/reference.
5. Retriever và reranker trả result lanes.

### Seller catalog ingestion

1. Seller tạo Draft.
2. Upload ảnh và metadata bắt buộc.
3. Hệ thống tạo product version và idempotency key.
4. Background worker chạy quality check, pHash, tagger và embedding.
5. Confidence thấp hoặc conflict vào NeedsReview.
6. Reviewer xác nhận/sửa facet.
7. Index writer publish atomically và product chuyển Active.

### Human review

1. Reviewer nhận item theo priority từ active sampling.
2. UI hiển thị ảnh, source metadata, AI label và confidence.
3. Reviewer accept, edit hoặc mark cannot judge.
4. Hệ thống lưu raw prediction, reviewed value và timestamp.
5. Data flywheel dùng disagreement cho prompt/rule/threshold hoặc fine-tune vòng sau.

## Yêu cầu chức năng

### Tài khoản và phân quyền

| ID | Yêu cầu | Acceptance criterion |
|---|---|---|
| FR-A01 | Đăng nhập và refresh session | Token hết hạn đúng cấu hình, role được kiểm tra ở API |
| FR-A02 | Phân quyền shopper, seller, reviewer, admin, researcher | Request sai quyền nhận 403 và có audit event |
| FR-A03 | Quản lý profile tối thiểu | User xem/sửa dữ liệu cho phép và yêu cầu xóa account |

### Catalog

| ID | Yêu cầu | Acceptance criterion |
|---|---|---|
| FR-C01 | Seller tạo, xem, sửa, archive product | Product version tăng khi dữ liệu ảnh hưởng search thay đổi |
| FR-C02 | Quản lý nhiều ảnh cho một product | Có primary image, checksum và processing state |
| FR-C03 | Chỉ nhận category TOP, BOTTOM, ONE_PIECE ở MVP | Category ngoài scope bị reject hoặc lưu draft future |
| FR-C04 | Gắn taxonomy facets và confidence | Mỗi facet có value, source, confidence, model/version |
| FR-C05 | Human review facet | Lưu raw value và reviewed value riêng, không ghi đè lịch sử |
| FR-C06 | Re-embed khi dữ liệu representation thay đổi | Job idempotent, index version trỏ đúng product version |
| FR-C07 | Publish và rollback catalog snapshot | Search không thấy partial update |
| FR-C08 | Dedupe product group | pHash/title cluster được ghi trước split hoặc publish |

### Search

| ID | Yêu cầu | Acceptance criterion |
|---|---|---|
| FR-S01 | Text-to-product search tiếng Việt | Trả top-K với model/catalog version |
| FR-S02 | Image-to-product search | Trả candidate dựa trên image embedding |
| FR-S03 | Composed image-text search | Nhận anchor cộng modification và trả target-like products |
| FR-S04 | Fine-grained filtering | Hỗ trợ category, color, material, pattern và category-specific facets |
| FR-S05 | Vibe/occasion search | Dùng soft semantic rerank và công khai confidence |
| FR-S06 | Negation | Explicit must_not không bị âm thầm relax |
| FR-S07 | Result lanes | Exact, Substitute và Unverified có label và reason rõ |
| FR-S08 | Explanation | Chỉ verbalize structured evidence đã version hóa |
| FR-S09 | Search history | Registered user có thể xem/xóa lịch sử của mình |
| FR-S10 | Feedback | User đánh dấu useful/not useful và optional reason, tách khỏi qrels chính |

### Research và observability

| ID | Yêu cầu | Acceptance criterion |
|---|---|---|
| FR-R01 | Tạo catalog/data snapshot | Manifest có hash, timestamp và schema version |
| FR-R02 | Đăng ký model/checkpoint | Có exact URI/path, checksum và preprocessing version |
| FR-R03 | Chạy benchmark | Sinh run file, metric, per-query output và environment record |
| FR-R04 | Xem slice/error analysis | Lọc theo attribute, writing style, reason code và lane |
| FR-R05 | Export qrels/raw judgments | Raw bất biến; final qrels liên kết adjudication record |
| FR-R06 | Recompute evidence consistency | Run fail khi deterministic score lệch quá epsilon |

### Outfit và VTON tùy chọn

| ID | Yêu cầu | Priority |
|---|---|---|
| FR-O01 | Chấm general top-bottom compatibility | Should after core |
| FR-O02 | Giải thích named factor contributions | Should after core |
| FR-O03 | Đề xuất counterfactual product thật | Could |
| FR-V01 | Guided full-body capture | Could |
| FR-V02 | Try-on top hoặc bottom và fallback rõ | Could |
| FR-V03 | Multi-garment top-bottom | Stretch |
| FR-V04 | Parametric/manual 3D avatar | Stretch |

## Yêu cầu phi chức năng

Các ngưỡng dưới đây là mục tiêu MVP và phải được xác nhận lại bằng validation/load test; không đưa con số chưa đo vào báo cáo như kết quả thực tế.

| ID | Nhóm | Yêu cầu |
|---|---|---|
| NFR-01 | Reproducibility | Mọi research run có seed, code commit, data/model/config hash và environment |
| NFR-02 | Search latency | Báo p50/p95; chọn rerank depth bằng validation Pareto curve thay vì hứa số tùy ý |
| NFR-03 | Availability | Demo có health endpoint, graceful error và recovery procedure |
| NFR-04 | Concurrency | Search API stateless; background jobs idempotent và không double-publish |
| NFR-05 | Security | HTTPS khi deploy, password hash mạnh, validation upload, role-based authorization |
| NFR-06 | Privacy | User image purpose-limited, delete được, retention rõ và không train mặc định |
| NFR-07 | Auditability | Product, taxonomy, tagger, parser, embedding và evidence đều có version/provenance |
| NFR-08 | Compatibility | Website Next.js hoạt động trên các browser hiện đại được ghi trong test matrix, với bố cục đáp ứng trên desktop và màn hình nhỏ; Android/iOS không phải tiêu chí MVP |
| NFR-09 | Accessibility | Các flow chính có label, contrast, keyboard navigation trên Web và scalable text |
| NFR-10 | Maintainability | Search, catalog, parser, tagger, compatibility và VTON tách interface/module |
| NFR-11 | Failure safety | Không gọi UNKNOWN là exact; không tạo counterfactual product không tồn tại |
| NFR-12 | Data integrity | Raw judgments và frozen test không bị mutate; artifact mới dùng version mới |

## API contract mức cao

Các endpoint công khai dưới đây thuộc Spring Boot. Backend này sở hữu authentication, authorization, catalog, lịch sử tìm kiếm và orchestration; gọi dịch vụ Python AI nội bộ để encode/search bằng PyTorch/FAISS. AI adapter và Python worker dùng lại core `ai/ml/`, không sở hữu bản sao user/role/CRUD. Next.js gọi API Spring Boot, không tạo backend nghiệp vụ thứ hai. Khi tích hợp phải kiểm tra contract, timeout và truyền model/index/catalog version qua ranh giới Java–Python; latency website phải được đo toàn tuyến, tách khỏi số đo CLI Week 4.

| Method | Endpoint | Chức năng |
|---|---|---|
| POST | `/v1/search/text` | Text search |
| POST | `/v1/search/image` | Image search |
| POST | `/v1/search/composed` | Anchor plus modification search |
| GET | `/v1/products/{id}` | Product detail/version |
| POST | `/v1/seller/products` | Create draft |
| PATCH | `/v1/seller/products/{id}` | Update và tạo version |
| POST | `/v1/seller/products/{id}/process` | Enqueue tag/embed |
| POST | `/v1/reviews/{id}/decision` | Human review decision |
| GET | `/v1/research/runs/{id}` | Run provenance và summary |
| POST | `/v1/outfits/score` | Optional compatibility |
| POST | `/v1/vton/jobs` | Optional async VTON |

Search response tối thiểu gồm query ID, mode, product IDs/versions, rank, dense score, constraint states, lane, evidence version và model/catalog versions.

## Product state machine

```text
DRAFT
  -> PROCESSING
      -> NEEDS_REVIEW -> PROCESSING
      -> INDEXED -> ACTIVE
      -> FAILED -> PROCESSING
ACTIVE -> ARCHIVED
```

State transition phải dùng optimistic locking hoặc version check. Product chỉ Active khi ảnh, required metadata, embedding và index publication cùng version.

## Definition of MVP

MVP đạt khi:

- ba search mode chạy trên catalog TOP/BOTTOM/ONE_PIECE;
- seller có thể đưa một sản phẩm từ Draft đến Active;
- tagger confidence thấp vào review queue;
- result trả đúng lanes và evidence schema;
- website Next.js gọi API nghiệp vụ Spring Boot và hoàn thành các luồng cốt lõi trên browser đã chọn;
- RQ experiment chạy từ snapshot độc lập với UI;
- không có module POS/payment/shipping nằm trên critical path.

Mobile chỉ được time-box sau khi website/search core, kiểm thử, triển khai và báo cáo đã sẵn sàng theo D055. Client mobile tương lai dùng cùng API Spring Boot; không cần Android/iOS build để đạt MVP hoặc Gate 6.

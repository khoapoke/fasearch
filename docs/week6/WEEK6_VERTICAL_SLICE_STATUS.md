# Week 6 Vertical Slice Status

## Trạng thái

- Ngày cập nhật: 23/09/2026
- Branch: `codex/vertical-slice`
- Slice: Image search read path
- Kết luận hiện tại: **Image search đã chạy xuyên Next.js, Spring Boot, FastAPI và core retrieval với cả fixture 30 sản phẩm lẫn CLIP pilot 600 sản phẩm. Week 6 chưa hoàn tất vì catalog write flow và phân tích data/class model còn thiếu.**

## Đã triển khai

### AI module

- FastAPI internal endpoint `POST /internal/v1/search/image`.
- Multipart JPEG/PNG/WebP, giới hạn 10 MiB và kiểm tra nội dung ảnh.
- Exact catalog/model/index publication check; không fallback âm thầm.
- Response chỉ trả product identity, rank, score và provenance.
- Standard error cho invalid image, publication mismatch và model/index unavailable.
- OpenAPI contract được sinh deterministic tại `contracts/internal-ai.openapi.json`.

### Spring Boot module

- Spring Boot 4.1.1, Java 17, Maven wrapper.
- Public endpoint `POST /api/v1/search/image`.
- `RestClient` multipart adapter có connect/read timeout.
- Backend sở hữu active publication và truyền exact version sang AI.
- Join catalog metadata mà không thay đổi AI rank.
- Fail closed khi AI result không thuộc active catalog publication.
- Stable public error response và trace ID propagation.
- Public contract tại `contracts/public-api.openapi.json`.
- Fixture catalog adapter chỉ dùng cho profile `local`/`test`.
- Local catalog image endpoint đọc ảnh của đúng product ID/version có trong active catalog; URL khác trả 404.

### Next.js website

- App Router upload page với drag/drop, preview và client-side file guidance.
- Same-origin route handler proxy multipart/trace ID tới Spring Boot; không lặp business rule.
- Loading, empty, invalid/unavailable error và result states.
- Responsive desktop/mobile layout, keyboard focus và reduced-motion handling.
- Result grid hiển thị rank, metadata, similarity, publication, latency và trace ID.
- Same-origin image route đọc bytes từ backend; ảnh thật của pilot catalog được hiển thị mà không lộ absolute filesystem path.

## Bằng chứng đã chạy

| Gate | Kết quả |
|---|---|
| AI tests | 23 passed; 1 warning từ Starlette TestClient/AnyIO dependency |
| AI CPU smoke | PASS; offline fixture plumbing only, không cho phép scientific claim |
| AI dependency check | `pip check` không phát hiện dependency hỏng |
| Backend tests | 13 passed |
| Backend compile/context | PASS trên Java 17 và Spring Boot 4.1.1 |
| Contract drift | AI OpenAPI được đối chiếu với app; backend adapter parse đúng contract fixture |
| Frontend lint | PASS |
| Frontend production build | PASS; static home + dynamic proxy route |
| Visual QA | PASS trên desktop và viewport mobile 390 x 844; upload/preview/error/result states đã xem |
| Cross-process fixture E2E | PASS với ảnh `1001.jpg`: 8 ranked products, exact fixture publication và trace ID |
| Frozen CLIP/index provenance | PASS: 600 rows, dimension 512, catalog SHA-256 `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44` |
| Cross-process real pilot E2E | PASS trên 23/09/2026 qua `./scripts/verify_real_pilot_e2e.sh`: Top-5 rank 1..5, model/index/catalog version đúng, ảnh hạng 1 có SHA-256 trùng nguồn |
| Local image access | PASS: product version sai trả 404; ảnh thật hiển thị qua Next.js proxy |

## Chưa hoàn tất

- PostgreSQL/Flyway catalog adapter và product write lifecycle; thuộc Slice 2.
- Browser matrix, responsive/accessibility states và website latency p50/p95.
- Authentication/RBAC thực; theo lịch Week 8-9.

## Gate tiếp theo

1. Review image-search use case/sequence cập nhật theo trace real pilot.
2. Hoàn thiện auth/RBAC tối thiểu trước API ghi catalog.
3. Bắt đầu Slice 2 với PostgreSQL/Flyway product Draft → Processing → Active.
4. Bổ sung class model/ERD từ migration và luồng đã kiểm thử.

Một lượt real pilot đầu tiên đo backend total latency khoảng 4.4 giây, lượt sau khoảng 1.7 giây. Đây là hai mẫu local có warm-up và child FAISS process overhead; không phải website p50/p95 hoặc kết quả benchmark cuối.

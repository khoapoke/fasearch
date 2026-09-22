# Week 6 Vertical Slice Status

## Trạng thái

- Ngày cập nhật: 22/09/2026
- Branch: `codex/vertical-slice`
- Slice: Image search read path
- Kết luận hiện tại: **Image-search fixture vertical slice đã chạy xuyên Next.js, Spring Boot, FastAPI và core retrieval; real 600-product publication chưa được chạy toàn tuyến**

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

### Next.js website

- App Router upload page với drag/drop, preview và client-side file guidance.
- Same-origin route handler proxy multipart/trace ID tới Spring Boot; không lặp business rule.
- Loading, empty, invalid/unavailable error và result states.
- Responsive desktop/mobile layout, keyboard focus và reduced-motion handling.
- Result grid hiển thị rank, metadata, similarity, publication, latency và trace ID.

## Bằng chứng đã chạy

| Gate | Kết quả |
|---|---|
| AI tests | 23 passed; 1 warning từ Starlette TestClient/AnyIO dependency |
| AI CPU smoke | PASS; offline fixture plumbing only, không cho phép scientific claim |
| AI dependency check | `pip check` không phát hiện dependency hỏng |
| Backend tests | 12 passed |
| Backend compile/context | PASS trên Java 17 và Spring Boot 4.1.1 |
| Contract drift | AI OpenAPI được đối chiếu với app; backend adapter parse đúng contract fixture |
| Frontend lint | PASS |
| Frontend production build | PASS; static home + dynamic proxy route |
| Visual QA | PASS trên desktop và viewport mobile 390 x 844; upload/preview/error/result states đã xem |
| Cross-process fixture E2E | PASS với ảnh `1001.jpg`: 8 ranked products, exact fixture publication và trace ID |

## Chưa hoàn tất

- E2E trên real 600-product CLIP publication; hiện mới chứng minh deterministic 30-product fixture.
- PostgreSQL/Flyway catalog adapter và product write lifecycle; thuộc Slice 2.
- Browser matrix, responsive/accessibility states và website latency p50/p95.
- Authentication/RBAC thực; theo lịch Week 8-9.

## Gate tiếp theo

1. Review và khóa image-search use case/sequence từ trace fixture đã pass.
2. Tạo startup script/compose cho ba process local.
3. Chạy real 600-product CLIP publication toàn tuyến và lưu evidence riêng.
4. Bắt đầu Slice 2 với PostgreSQL/Flyway product draft-to-searchable lifecycle.

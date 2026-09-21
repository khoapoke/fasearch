# Phase 6 Website Integration — Mobile Optional

## Outcome

Một website Next.js có seller catalog, human review và ba search modes qua Spring Boot, dùng Python AI service với model/index đã khóa.

## Strategy

Theo D054/D055 và CP-20260910-STACK ngày 10/09/2026, Next.js/TypeScript là frontend website; Java Spring Boot sở hữu backend nghiệp vụ/API công khai; FastAPI là adapter AI nội bộ tái sử dụng core Python `ai/ml/`. Website là deliverable bắt buộc. Mobile chỉ mở rộng theo time-box sau website/search core, kiểm thử, triển khai và báo cáo; framework chưa chọn, Android/iOS không phải gate. Giữ tên file hiện tại để các liên kết tài liệu không bị hỏng.

API contract không chứa UI-specific assumptions để client mobile tương lai dùng cùng API. Next.js không triển khai backend nghiệp vụ thứ hai; Spring Boot không viết lại encoder/index bằng Java.

## Work packages

### P6.1 Backend foundation

- Spring Boot project/module boundaries cho API công khai và nghiệp vụ.
- PostgreSQL migrations.
- Authentication/roles, catalog/history và quyền sở hữu dữ liệu trong Spring Boot.
- Object upload validation.
- Job orchestration và Python worker xử lý ảnh/embedding/index.
- FastAPI nội bộ bọc core Python `ai/ml/`, dùng PyTorch/FAISS; không lặp user/role/CRUD.
- Model/index registry và contract truyền provenance giữa Spring Boot và AI service.
- Health/readiness endpoints.
- Pin Node/package lock, JDK/Spring Boot/Maven Wrapper khi scaffold; giữ Python lock của baseline.

### P6.2 Catalog and review

- Seller product list/create/edit/archive.
- Image upload/progress.
- Processing state timeline.
- AI facets/confidence.
- Review accept/edit/cannot-judge.
- Publish/rollback.

### P6.3 Search API

- Text mode.
- Image mode.
- Composed mode.
- Search response version fields.
- Result lanes/evidence.
- Timeout/fallback behavior.
- Contract request/response giữa Spring Boot và Python AI, gồm lỗi và model/index/catalog version.
- Đo latency website → Spring Boot → AI service; số CLI Week 4 chỉ là baseline tham chiếu.

### P6.4 Next.js Website

Required screens:

- Home/search composer.
- Image upload/preview.
- Anchor plus modification input.
- Results with lane tabs/sections.
- Product detail/evidence.
- Seller catalog/editor.
- Reviewer queue.
- Login/profile/history minimal.

### P6.5 Mobile optional — sau core

- Chỉ lên kế hoạch khi website/search core, kiểm thử, triển khai và báo cáo đã sẵn sàng; ghi owner, time-box và quyết định mở rộng.
- Framework mobile chưa chọn; client dùng API Spring Boot hiện có.
- Responsive/adaptive layout; website responsive vẫn thuộc P6.4 dù không làm mobile.
- Camera/gallery permissions.
- Upload compression without changing research input silently.
- Same result/evidence semantics.
- Release/debug environment config.
- Không yêu cầu Android/iOS build hoặc parity mobile để qua Gate 6.

### P6.6 Deployment

- Next.js website hosting.
- Spring Boot API container/service công khai.
- FastAPI AI container/service nội bộ và Python worker.
- Database/storage/queue.
- FAISS/model artifacts.
- HTTPS/secrets.
- Logs/metrics.
- Optional GPU worker.

### P6.7 Testing

Unit:

- Next.js UI state/components;
- Spring Boot API DTO validation và Python AI contract;
- relaxation/evidence logic server-side.

Integration:

- product Draft to Active;
- review correction to re-embed;
- index swap;
- all search modes.
- Spring Boot–Python contract, timeout/error handling và version propagation.

E2E:

- Guest text search.
- User composed search.
- Seller publish.
- Reviewer correction.
- Unverified and no-exact states.
- Website latency toàn tuyến và browser/responsive test matrix.

## UX requirements

- Exact results clearly primary.
- Substitute section says which constraint changed.
- Unverified section says information missing, not product bad.
- Warning always suggests retry/fix or explains continue impact.
- Search loading supports async timeout/cancel.
- Evidence summary concise; technical detail expandable.

## Non-goals

- Checkout/payment.
- Shipping/tracking.
- POS.
- Complex inventory.
- Loyalty/discount engine.
- Seller marketplace settlement.

## Deliverables

- Deployed Web URL/environment.
- Mobile build evidence chỉ khi đã mở time-box riêng, không thuộc deliverable bắt buộc.
- OpenAPI spec cho Spring Boot API và versioned internal AI contract.
- Database migrations.
- Seed/demo dataset separate from final-test access.
- System test report.
- Deployment/rollback guide.
- Demo recording.

## Gate 6 checklist

- [ ] Next.js website hoàn thành core flow trên browser test matrix và gọi Spring Boot API.
- [ ] Seller to Active path works.
- [ ] Three search modes work.
- [ ] Version/provenance included internally.
- [ ] Spring Boot–Python contract/timeout pass và latency website toàn tuyến được báo.
- [ ] Empty/error/unknown states usable.
- [ ] HTTPS/upload/auth basics pass.
- [ ] Core demo does not depend on Colab session.
- [ ] Backup local demo/video ready.

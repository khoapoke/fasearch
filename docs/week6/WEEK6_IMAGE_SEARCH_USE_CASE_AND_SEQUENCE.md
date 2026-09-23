# Week 6 Image Search Use Case and Verified Sequence

## Trạng thái

- Use case ID: `SUC-SEARCH-IMG-01`
- Nguồn: `FR-SEARCH-IMG-001..003`, `FR-SEARCH-COMMON-001..003`, `NFR-INT-001`
- Core/extension: `CORE`
- Trạng thái: verified against deterministic fixture (22/09/2026) and frozen CLIP pilot 600-product flow (23/09/2026)
- Diagram: [editable DOT](../../tools/diagrams/week6/image-search-sequence.v1.dot) và [rendered SVG](../../tools/diagrams/week6/image-search-sequence.v1.svg)

## Mục tiêu

Guest hoặc Registered User tải một ảnh trang phục và nhận danh sách Top-K Catalog Product đang hoạt động, xếp hạng theo độ tương đồng trên một catalog/model/index publication nhất quán.

## Actor

- Primary: `Guest`, `Registered User`.
- Supporting subsystem ở ranh giới hẹp: Spring Boot search orchestration và internal AI module.
- FastAPI, core `ml/`, FAISS và fixture catalog adapter là implementation bên trong system boundary tổng thể, không phải actor của use case tổng quan.

## Preconditions

1. Website, Spring Boot và AI module sẵn sàng.
2. Spring Boot có một active publication gồm catalog snapshot, model version và index version.
3. AI module đã load đúng model/index publication đó.
4. Catalog metadata có cùng product ID/product version với index mapping.

## Trigger

User chọn hoặc thả một ảnh JPEG, PNG hoặc WebP rồi chọn “Tìm sản phẩm tương đồng”.

## Main flow đã kiểm chứng

1. Website kiểm tra hướng dẫn file phía client và gửi multipart request tới same-origin Next.js route handler.
2. Route handler gắn/giữ trace ID và proxy multipart request tới Spring Boot.
3. Spring Boot kiểm tra image, K và resolve exact active publication.
4. Spring Boot gửi ảnh, K, trace ID và publication versions tới internal FastAPI adapter.
5. FastAPI kiểm tra MIME, size, nội dung ảnh và publication compatibility.
6. Core retrieval encode ảnh, tìm Top-K trên FAISS và trả ranked product identities/scores.
7. FastAPI trả product ID/version, rank, score, AI latency và provenance; không trả business metadata.
8. Spring Boot xác nhận response publication khớp active publication.
9. Spring Boot đọc active catalog metadata cho từng product ID/version và fail closed nếu thiếu item.
10. Spring Boot giữ nguyên AI rank, bổ sung title/category/image URL và total backend latency.
11. Next.js trả response cho Client Component.
12. Website hiển thị result grid, rank, similarity, publication, latency và trace ID.
13. Browser yêu cầu image URL của từng result qua same-origin Next.js route.
14. Next.js proxy yêu cầu tới Spring Boot; backend chỉ đọc ảnh thuộc product ID/version active trong local catalog.
15. Backend trả image bytes; Next.js giữ MIME và trả ảnh để website hiển thị.

## Alternate và failure flows

| ID | Điều kiện | Hành vi đã thiết kế/kiểm thử |
|---|---|---|
| `A1` | File rỗng hoặc không giải mã được | Trả `INVALID_IMAGE`; UI chỉ cách chọn ảnh khác. |
| `A2` | File lớn hơn 10 MiB | Trả `IMAGE_TOO_LARGE`; không gọi retrieval. |
| `A3` | MIME không phải JPEG/PNG/WebP | Trả `INVALID_IMAGE`/415; không gọi retrieval. |
| `A4` | K ngoài 1..100 | Trả `INVALID_REQUEST`; không gọi AI. |
| `A5` | AI unavailable/timeout | Spring Boot trả stable `AI_UNAVAILABLE`; UI hiển thị retry guidance và trace ID. |
| `A6` | Publication request/response mismatch | Fail closed với `AI_PUBLICATION_MISMATCH`; không trả kết quả trộn version. |
| `A7` | AI hit không tồn tại trong active catalog | Fail closed với `CATALOG_VERSION_MISMATCH`. |
| `A8` | Top-K rỗng | Trả success với list rỗng; UI hướng dẫn dùng ảnh rõ hơn. |
| `A9` | Image URL không thuộc product version active hoặc ảnh không đọc được | Trả 404; UI có fallback image. |

## Postconditions

- User nhận result chỉ từ một consistent publication.
- AI rank không bị website hoặc backend tự ý thay đổi.
- Trace ID và latency tồn tại để truy vết.
- Guest search không tạo personal search history.
- Ảnh tạm bị xóa sau request trong AI adapter; retention dài hạn chưa được mở trong slice này.

## Dữ liệu đọc/ghi

- Đọc: uploaded image bytes, active publication config, FAISS index/mapping, active catalog metadata và ảnh của product version active.
- Ghi tạm: query image trong temporary directory của AI process, được dọn sau request.
- Không ghi: user history, saved product, training data hoặc business catalog tables.

## Evidence boundary

Fixture E2E dùng 30 synthetic products, fixture encoder và FAISS IndexFlatIP. Real pilot E2E dùng frozen CLIP và 600 sản phẩm Dataset A, xác minh exact publication và ảnh kết quả bằng checksum. Hai luồng chứng minh interface, error handling, version propagation và UI flow; chúng không chứng minh chất lượng truy hồi tiếng Việt hoặc website latency cuối. Query pilot là ảnh lấy từ catalog để kiểm tra mapping kỹ thuật; không dùng self-retrieval này làm quality claim.

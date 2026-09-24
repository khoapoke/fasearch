# Database hiện có — 24/09/2026

Đây là **schema đã triển khai**, không phải ERD đầy đủ của toàn đồ án. PostgreSQL hiện có **11 bảng nghiệp vụ/kỹ thuật** từ Flyway V1–V3; V3 chỉ thêm cột vào `product_images`, không tạo bảng thứ 12. Ảnh nằm trong S3-compatible object storage; FAISS index nằm ngoài PostgreSQL.

| Nhóm | Bảng | Vai trò |
|---|---|---|
| Identity/RBAC (5) | `user_accounts`, `roles`, `permissions`, `user_roles`, `role_permissions` | Tài khoản, role và quyền hiệu lực; hai bảng nối thể hiện quan hệ nhiều–nhiều. Password chỉ lưu dạng hash. |
| Session (2) | `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES` | Phiên đăng nhập và thuộc tính phiên do Spring Session JDBC quản lý; trình duyệt chỉ giữ session ID trong cookie. |
| Catalog/Audit (4) | `catalog_products`, `product_versions`, `product_images`, `audit_events` | Danh tính sản phẩm, lịch sử version, metadata ảnh và nhật ký thay đổi. |

## Quan hệ quan trọng

- `catalog_products.id` là ID sản phẩm ổn định. Một sản phẩm có nhiều `product_versions` (unique theo `product_id + version_no`). `active_version_id` chỉ tới version đã công bố của **chính sản phẩm đó**; Draft hiện để `NULL`.
- Mỗi `product_images` thuộc đúng một `product_versions`. Một version hiện tối đa một ảnh chính theo unique index; thay ảnh tạo version mới. Một lần sửa text tiếp theo tạo version mới và mang theo tham chiếu ảnh, không ghi đè bytes.
- `product_images.storage_uri` trỏ tới object storage; `sha256`, `media_type`, `byte_size`, `quality_state` là metadata trong PostgreSQL. `PENDING` nghĩa là chưa qua quality/processing, **không** đồng nghĩa đủ điều kiện publish.
- `audit_events.actor_id` tham chiếu `user_accounts`. Các thao tác tạo/sửa Draft và thay ảnh ghi event trong cùng transaction với metadata version. `resource_id` là ID tài nguyên logic, không phải FK đa hình.
- `user_roles` nối account–role; `role_permissions` nối role–permission. `SPRING_SESSION.PRINCIPAL_NAME` liên hệ account theo username ở mức logic, không phải FK.

## Chưa có trong database

`categories` riêng, `product_facets`, `processing_jobs`, `embeddings`, `index_publications`, `search_requests`, `search_results`, `saved_products` và bảng quản trị user/profile mở rộng vẫn ở mức requirement/ERD dự kiến. Ba category MVP đang được kiểm bằng constraint trên `product_versions`, chưa có bảng taxonomy. Search công khai hiện đọc catalog pilot từ fixture/JSONL local, **chưa đọc bản Draft trong PostgreSQL** và chưa có publication atomically nối với FAISS.

DDL hiện hành: [V1 identity/session](../../be/src/main/resources/db/migration/V1__identity_and_sessions.sql), [V2 Draft catalog](../../be/src/main/resources/db/migration/V2__catalog_drafts.sql), [V3 image metadata](../../be/src/main/resources/db/migration/V3__product_image_upload_metadata.sql). Xem thêm [ERD của phần đã triển khai](../../tools/diagrams/week6/identity-catalog-erd.v1.svg) và [use case Draft/image](WEEK6_CATALOG_DRAFT_USE_CASE_AND_DATA.md).

# FaSearch Backend

Spring Boot modular backend sở hữu catalog metadata, public search contract và orchestration tới AI module.

## Slice 1

Public interface:

```text
POST /api/v1/search/image
POST /api/v1/search/composed
```

Luồng:

1. validate multipart image và K;
2. resolve active catalog/model/index publication;
3. gọi `POST /internal/v1/search/image` qua `RestClient` có timeout;
4. kiểm publication trong response;
5. join active catalog metadata mà không đổi AI rank;
6. trả public response có trace ID, provenance và latency.

Slice composed (upload + exact product anchor) chạy cùng máy: resolve ảnh
anchor thuộc đúng publication đang pin, loại anchor product khỏi kết quả
PRODUCT theo Q2, kiểm token budget của model đang load trước encode theo
Q3 (fixture báo RAW_CAP_ONLY). CSRF giữ nguyên cho route mới; text HTTP
và product-anchor picker là ticket sau.

Catalog read adapter hiện dùng fixture ở profile `local`/`test`. PostgreSQL/Flyway quản lý tài khoản, phiên, Product Version, metadata ảnh và audit của Draft. Bytes ảnh Draft nằm ở S3-compatible object storage; processing và publication là checkpoint tiếp theo.
Khi `FASEARCH_CATALOG_FILE` trỏ tới catalog JSONL đã version hóa, local adapter trả thêm ảnh của đúng product ID/version qua `GET /api/v1/catalog/images/{productId}/{productVersionId}`.

## Chạy test

```bash
cd be
./mvnw test
```

## Chạy local

Đặt `FASEARCH_DB_PASSWORD`, `FASEARCH_OBJECT_ACCESS_KEY`, `FASEARCH_OBJECT_SECRET_KEY` và bộ `FASEARCH_BOOTSTRAP_ADMIN_USERNAME`, `FASEARCH_BOOTSTRAP_ADMIN_EMAIL`, `FASEARCH_BOOTSTRAP_ADMIN_PASSWORD` cho lần đầu khởi động database. Không đưa credential vào Git. Từ repo root, khởi động PostgreSQL và SeaweedFS local; AI adapter trên port `8001` chỉ cần cho search:

```bash
docker compose -f be/compose.yaml -f be/compose.storage.yaml up -d
cd be
./mvnw spring-boot:run
```

API auth hiện có `/api/v1/auth/csrf`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout`. Catalog Draft có `POST /api/v1/catalog/admin/drafts`, `GET/PATCH /api/v1/catalog/admin/drafts/{productId}` và `POST/GET /api/v1/catalog/admin/drafts/{productId}/image`. Mọi lệnh ghi Draft yêu cầu session hợp lệ, permission `CATALOG_DRAFT_WRITE` và CSRF header; ảnh Draft chỉ được đọc bởi actor có quyền.

Các biến cấu hình chính:

- `FASEARCH_AI_BASE_URL`
- `FASEARCH_AI_CONNECT_TIMEOUT`
- `FASEARCH_AI_READ_TIMEOUT`
- `FASEARCH_CATALOG_SNAPSHOT_ID`
- `FASEARCH_MODEL_VERSION`
- `FASEARCH_INDEX_VERSION`
- `FASEARCH_CATALOG_FILE` (local/test JSONL catalog fixture only)
- `FASEARCH_DB_URL`, `FASEARCH_DB_USER`, `FASEARCH_DB_PASSWORD`
- `FASEARCH_OBJECT_ENDPOINT`, `FASEARCH_OBJECT_REGION`, `FASEARCH_OBJECT_BUCKET`
- `FASEARCH_OBJECT_ACCESS_KEY`, `FASEARCH_OBJECT_SECRET_KEY` (nếu bỏ trống cả hai, AWS SDK dùng credential chain của môi trường)
- `FASEARCH_COOKIE_SECURE` (bật trong `prod` profile; local HTTP để false)

Contract liên module nằm tại `../contracts/internal-ai.openapi.json`; public contract nằm tại `../contracts/public-api.openapi.json`.

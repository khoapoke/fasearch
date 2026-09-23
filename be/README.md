# FaSearch Backend

Spring Boot modular backend sở hữu catalog metadata, public search contract và orchestration tới AI module.

## Slice 1

Public interface:

```text
POST /api/v1/search/image
```

Luồng:

1. validate multipart image và K;
2. resolve active catalog/model/index publication;
3. gọi `POST /internal/v1/search/image` qua `RestClient` có timeout;
4. kiểm publication trong response;
5. join active catalog metadata mà không đổi AI rank;
6. trả public response có trace ID, provenance và latency.

Catalog adapter hiện dùng fixture ở profile `local`/`test`. PostgreSQL/Flyway và product write lifecycle thuộc Slice 2.
Khi `FASEARCH_CATALOG_FILE` trỏ tới catalog JSONL đã version hóa, local adapter trả thêm ảnh của đúng product ID/version qua `GET /api/v1/catalog/images/{productId}/{productVersionId}`.

## Chạy test

```bash
cd be
./mvnw test
```

## Chạy local

Khởi động AI adapter trên port `8001`, sau đó:

```bash
cd be
./mvnw spring-boot:run
```

Các biến cấu hình chính:

- `FASEARCH_AI_BASE_URL`
- `FASEARCH_AI_CONNECT_TIMEOUT`
- `FASEARCH_AI_READ_TIMEOUT`
- `FASEARCH_CATALOG_SNAPSHOT_ID`
- `FASEARCH_MODEL_VERSION`
- `FASEARCH_INDEX_VERSION`
- `FASEARCH_CATALOG_FILE` (local/test JSONL catalog fixture only)

Contract liên module nằm tại `../contracts/internal-ai.openapi.json`; public contract nằm tại `../contracts/public-api.openapi.json`.

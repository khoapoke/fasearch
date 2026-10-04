# API_SPEC — public catalog browse (additive, frozen per TASK rev 1)

Base publication triple (pinned per request từ `fasearch.publication.*`):
`catalog_snapshot_id`, `model_version`, `index_version`. `artifact_scope="PILOT_ONLY"`.

## GET /api/v1/catalog/products

Query (unknown/duplicate/blank-invalid/overflow → 400 `INVALID_REQUEST`):

| Param | Kiểu | Mặc định | Ràng buộc |
| --- | --- | --- | --- |
| `page` | int32 dương | 1 | ≥1, parse bounded 32-bit |
| `size` | int 1..60 | 24 | ngoài range → 400 |
| `category` | enum | (không lọc) | `TOP`/`BOTTOM`/`ONE_PIECE`, sai → 400 |
| `catalog_snapshot_id` | string | (không kiểm) | nếu có mà ≠ pinned → 409 `CATALOG_SNAPSHOT_MISMATCH` |

Semantics: lọc category giữ nguyên relative order của frozen file; `total` = filtered count; `has_more = offset+size < total` (offset `long` an toàn); past-end → `items: []`, `has_more: false`, total đúng.

Response 200 (`Cache-Control: no-store`, `X-Trace-Id`):

```json
{
  "schema_version": "1.0.0",
  "trace_id": "<uuid>",
  "publication": {"catalog_snapshot_id": "...", "model_version": "...", "index_version": "..."},
  "artifact_scope": "PILOT_ONLY",
  "page": 1, "size": 24, "total": 600, "has_more": true,
  "items": [{"product_id": "...", "product_version_id": "...", "title": "...",
             "category": "TOP", "image_url": "/api/catalog/images/<pid>/<vid>"}]
}
```

## GET /api/v1/catalog/products/{productId}

Query: `product_version_id` + `catalog_snapshot_id` — cả hai hoặc không có (lẻ → 400 `INVALID_REQUEST`).
Không context → resolve đúng một public version của product trong publication đã pin.

Response 200: như item + `"description": null` (pilot 600 hiện không có description).
Không trả `version_no/created_at/material/colors/variants/stock/price/rating`.

Errors: sai snapshot kỳ vọng → 409 `CATALOG_SNAPSHOT_MISMATCH`; unknown/inactive/unpublished/wrong-version → uniform 404 `CATALOG_PRODUCT_NOT_FOUND`; publication thiếu/không tương thích → 503 `CATALOG_UNAVAILABLE` (không fixture/default fallback, không latest-version fallback).
Mọi error: `{"schema_version":"1.0.0","trace_id":...,"code":...,"message":...}` + `no-store` + `X-Trace-Id`; không echo unsafe trace/private path.

## Next proxies (same-origin, thin)

- `GET /api/catalog/products?...` → Boot `/api/v1/catalog/products?...` (forward query đã validate, `cache: no-store`, gắn/giữ `X-Trace-Id`, trả lại status/body/headers `X-Trace-Id`+`no-store`).
- `GET /api/catalog/products/[productId]?...` tương tự.
- Images dùng proxy hiện có `/api/catalog/images/[productId]/[productVersionId]`.

## OpenAPI

Thêm 2 paths trên vào canonical `be/src/main/resources/docs/openapi.json` (additive, không sửa paths cũ); served `/docs/openapi.json` byte-equal file canonical. Internal AI contract không đổi.

# TÀI LIỆU API: THƯƠNG HIỆU (BRAND)

## 1. Danh sách thương hiệu công khai

- **Endpoint:** `GET /api/v1/brands`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Danh sách thương hiệu chưa xóa, sắp xếp theo tên. Không trả dữ liệu admin/import.

```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách thương hiệu thành công",
  "result": [
    {
      "id": 1,
      "name": "Nike",
      "slug": "nike",
      "country": "US",
      "logoUrl": "/api/v1/brands/nike/logo",
      "officialUrl": "https://www.nike.com/"
    }
  ]
}
```

## 2. Logo thương hiệu

- **Endpoint:** `GET /api/v1/brands/{slug}/logo`
- **Quyền hạn:** `PUBLIC`
- Chỉ phục vụ file logo đã import vào namespace candidate; kiểm tra tên file an toàn, không nhận path/URL tùy ý. Trả `image/svg+xml` cho logo `.svg` đã xác thực (từ chối script/active content, kiểm tra root `<svg>` và magic bytes cho PNG/JPEG/WEBP), kèm `X-Content-Type-Options: nosniff`, CSP sandbox và `Cache-Control: private, max-age=3600`.

## 3. Trường brand trên sản phẩm

`ProductRes` / `ProductDetailRes` bổ sung:

```json
{
  "brandId": 1,
  "brandName": "Nike",
  "brandSlug": "nike",
  "brandLogoUrl": "/api/v1/brands/nike/logo",
  "modelCode": "official-model-id"
}
```

`GET /api/v1/products` hỗ trợ thêm `brand=<slug>` và `brandId=<id>`. Đây là lọc metadata/lexical chính xác, không phải nhận diện logo bằng CLIP.

## 4. Import hợp đồng

Script: `scripts/import_brand_catalog.py`.

- `--plan`: validate manifest, hash media, in mapping; không ghi DB.
- `--apply`: chỉ ghi DB candidate `fasearch_brand_catalog_payments_20261102` và media namespace mới; chạy một transaction SQL, rollback khi lỗi.
- Idempotent theo brand slug, product `(brand, model)`, variant barcode, stock SKU.
- Mặc định stock là **seed-only**: không reset `so_luong_vat_ly/tam_giu/kha_dung` khi chạy lại. `--update-stock` là explicit; từ chối nếu SKU còn `so_luong_tam_giu > 0`.
- Manifest yêu cầu source URL + SHA-256 cho logo/media; từ chối path traversal, hash sai, model trùng, brand không tồn tại.
- Giá là `demoPriceVnd` rõ ràng, không phải giá chính thức/live.

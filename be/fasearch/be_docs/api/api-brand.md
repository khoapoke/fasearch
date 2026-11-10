# TÀI LIỆU API: MODULE BRAND (THƯƠNG HIỆU)

Module `brand` cung cấp danh sách thương hiệu công khai và logo thương hiệu để hiển thị trên cửa hàng. Thông tin thương hiệu của sản phẩm (`brandId`, `brandName`, `brandSlug`, `brandLogoUrl`, `modelCode`) và bộ lọc `brand` / `brandId` nằm trong [api-product.md](./api-product.md).

---

## 1. Xem danh sách thương hiệu công khai

- **Endpoint:** `GET /api/v1/brands`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Danh sách thương hiệu chưa xóa, sắp xếp theo tên; không trả dữ liệu quản trị.

### Response Thành công (HTTP 200 OK)
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
  ],
  "timestamp": "2026-11-05T09:00:00"
}
```

`id` là Long; `name`, `slug`, `country`, `logoUrl`, `officialUrl` là String; ba trường cuối có thể null.

---

## 2. Xem logo thương hiệu

- **Endpoint:** `GET /api/v1/brands/{slug}/logo`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Trả file logo của thương hiệu (`image/svg+xml`, PNG, JPEG hoặc WEBP; `Cache-Control: private, max-age=3600`), không bọc `ApiResponse`. Chỉ phục vụ logo đã được import, không nhận đường dẫn hoặc URL tùy ý.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân logo. Header gồm `X-Content-Type-Options: nosniff` và `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** `RESOURCE_NOT_FOUND` (404): "Không tìm thấy thương hiệu." hoặc "Không tìm thấy logo thương hiệu."
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (400): "Không đọc được logo thương hiệu."; hoặc `INVALID_IMAGE_FILE` (400): "Logo SVG không an toàn." / "Nội dung logo thương hiệu không được hỗ trợ hoặc không khớp."

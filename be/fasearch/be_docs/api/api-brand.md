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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

---

## 2. Xem logo thương hiệu

- **Endpoint:** `GET /api/v1/brands/{slug}/logo`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Trả file logo của thương hiệu (`image/svg+xml`, PNG, JPEG hoặc WEBP; `Cache-Control: private, max-age=3600`), không bọc `ApiResponse`. Chỉ phục vụ logo đã được import, không nhận đường dẫn hoặc URL tùy ý.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân logo.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy thương hiệu hoặc logo.

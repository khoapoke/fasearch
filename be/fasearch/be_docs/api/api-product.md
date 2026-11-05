# TÀI LIỆU API: MODULE PRODUCT & CATEGORY (SẢN PHẨM & DANH MỤC)

Module `product` và `category` quản lý danh mục thời trang, thông tin sản phẩm, các biến thể SKU (màu sắc, kích cỡ), mã vạch tem dán, ảnh sản phẩm và tra cứu bán hàng tại quầy POS. Sản phẩm đã `PUBLISHED` chỉ được sửa / xóa qua luồng bản nháp (`/api/v1/admin/products/drafts`, xem [api-publish.md](./api-publish.md)); sửa trực tiếp trả HTTP 409.

---

## 1. Xem danh sách danh mục (FR-21)

- **Endpoint:** `GET /api/v1/categories`
- **Quyền hạn:** `PUBLIC` (Tất cả người dùng)
- **Mô tả:** Lấy toàn bộ danh mục sản phẩm chưa xóa.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh mục thành công",
  "result": [
    {
      "id": 1,
      "categoryName": "Áo sơ mi nam"
    },
    {
      "id": 2,
      "categoryName": "Quần tây công sở"
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Xem danh mục kèm số lượng sản phẩm (FR-21)

- **Endpoint:** `GET /api/v1/categories/with-counts`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy danh mục kèm số sản phẩm đang có trong từng danh mục.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh mục kèm số lượng thành công",
  "result": [
    {
      "id": 1,
      "categoryName": "Áo sơ mi nam",
      "productCount": 12
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Xem chi tiết danh mục (FR-21)

- **Endpoint:** `GET /api/v1/categories/{id}`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy thông tin một danh mục theo ID.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết danh mục thành công",
  "result": {
    "id": 1,
    "categoryName": "Áo sơ mi nam"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy danh mục (`CATEGORY_NOT_FOUND`).

---

## 4. Thêm mới danh mục (FR-21)

- **Endpoint:** `POST /api/v1/categories`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Tạo danh mục sản phẩm mới.

### Request Body
```json
{
  "categoryName": "Áo Polo Unisex"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `categoryName` | String | Có | Tên danh mục, tối đa 150 ký tự, duy nhất |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm mới danh mục thành công",
  "result": {
    "id": 3,
    "categoryName": "Áo Polo Unisex"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tên trống hoặc đã tồn tại (`CATEGORY_NAME_ALREADY_EXISTS`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` hoặc chưa đăng nhập đúng quyền.

---

## 5. Cập nhật danh mục (FR-21)

- **Endpoint:** `PUT /api/v1/categories/{id}` (hoặc `PATCH`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Đổi tên danh mục.

### Request Body
```json
{
  "categoryName": "Áo Polo Nam"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `categoryName` | String | Có | Tên danh mục, tối đa 150 ký tự, duy nhất |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật danh mục thành công",
  "result": {
    "id": 3,
    "categoryName": "Áo Polo Nam"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tên trống hoặc đã tồn tại (`CATEGORY_NAME_ALREADY_EXISTS`).
- **HTTP 404 Not Found:** Không tìm thấy danh mục (`CATEGORY_NOT_FOUND`).

---

## 6. Xóa danh mục (FR-21)

- **Endpoint:** `DELETE /api/v1/categories/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Xóa mềm danh mục; chỉ xóa được khi không còn sản phẩm tham chiếu.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa danh mục thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Danh mục còn sản phẩm tham chiếu.
- **HTTP 404 Not Found:** Không tìm thấy danh mục (`CATEGORY_NOT_FOUND`).

---

## 7. Xem danh sách & Lọc sản phẩm (FR-22)

- **Endpoint:** `GET /api/v1/products`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Danh sách sản phẩm có phân trang, tìm kiếm và lọc theo danh mục, giá, trạng thái, thương hiệu.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo tên sản phẩm |
| `categoryId` | Long | Không | Lọc theo ID danh mục |
| `minPrice` | Number | Không | Giá thấp nhất |
| `maxPrice` | Number | Không | Giá cao nhất |
| `status` | String | Không | `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `DISCONTINUED` |
| `brand` | String | Không | Lọc theo slug thương hiệu |
| `brandId` | Long | Không | Lọc theo ID thương hiệu |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách sản phẩm thành công",
  "result": {
    "content": [
      {
        "id": 1,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "categoryId": 1,
        "categoryName": "Áo sơ mi nam",
        "material": "100% Cotton",
        "style": "Regular Fit",
        "price": 350000.00,
        "imageUrl": "/api/v1/products/images/a1b2c3.jpg",
        "status": "ACTIVE",
        "brandId": 1,
        "brandName": "Nike",
        "brandSlug": "nike",
        "brandLogoUrl": "/api/v1/brands/nike/logo",
        "modelCode": "official-model-id"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

- Các trường brand / nguồn (`brand*`, `modelCode`, `source*`, `curationClass`) chỉ xuất hiện khi có dữ liệu.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tham số lọc sai kiểu (ví dụ `status` không thuộc danh sách).

---

## 8. Xem chi tiết sản phẩm (FR-24)

- **Endpoint:** `GET /api/v1/products/{id}`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy thông tin chi tiết sản phẩm kèm danh sách biến thể.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết sản phẩm thành công",
  "result": {
    "id": 1,
    "productName": "Áo sơ mi Oxford kẻ sọc",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "material": "100% Cotton",
    "style": "Regular Fit",
    "description": "Áo sơ mi dáng thanh lịch, thoáng mát thích hợp đi làm và đi tiệc.",
    "price": 350000.00,
    "imageUrl": "/api/v1/products/images/a1b2c3.jpg",
    "status": "ACTIVE",
    "brandId": 1,
    "brandName": "Nike",
    "brandSlug": "nike",
    "brandLogoUrl": "/api/v1/brands/nike/logo",
    "modelCode": "official-model-id",
    "variants": [
      {
        "skuId": 101,
        "productId": 1,
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "additionalPrice": 0.00,
        "colorIsSentinel": false,
        "sizeIsSentinel": false
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 9. Thêm mới sản phẩm (FR-23)

- **Endpoint:** `POST /api/v1/products`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Tạo sản phẩm mới kèm danh sách biến thể (tự sinh SKU và mã vạch nếu không truyền).

### Request Body
```json
{
  "productName": "Áo Polo Pique Cổ Bẻ",
  "categoryId": 1,
  "material": "Cotton gai CVC",
  "style": "Slim Fit",
  "description": "Chất vải dày dặn, đứng form và thấm hút mồ hôi tốt.",
  "price": 280000.00,
  "imageUrl": "/api/v1/products/images/polo01.jpg",
  "brandId": 1,
  "modelCode": "POLO-PIQUE-01",
  "status": "ACTIVE",
  "variants": [
    { "color": "Đen", "size": "L" },
    { "color": "Đen", "size": "XL" }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productName` | String | Có | Tên sản phẩm, tối đa 255 ký tự |
| `categoryId` | Long | Có | ID danh mục |
| `material` | String | Không | Chất liệu, tối đa 100 ký tự |
| `style` | String | Không | Kiểu dáng, tối đa 100 ký tự |
| `description` | String | Không | Mô tả |
| `price` | Number | Có | Giá bán (`>= 0`) |
| `imageUrl` | String | Không | URL ảnh |
| `brandId` | Long | Không | ID thương hiệu |
| `modelCode` | String | Không | Mã model, tối đa 100 ký tự |
| `status` | String | Không | `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `DISCONTINUED` (mặc định `ACTIVE`) |
| `variants` | Array | Không | Danh sách `{ color, size, barcode }` |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm mới sản phẩm thành công",
  "result": {
    "id": 5,
    "productName": "Áo Polo Pique Cổ Bẻ",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "material": "Cotton gai CVC",
    "style": "Slim Fit",
    "description": "Chất vải dày dặn, đứng form và thấm hút mồ hôi tốt.",
    "price": 280000.00,
    "imageUrl": "/api/v1/products/images/polo01.jpg",
    "status": "ACTIVE",
    "variants": [
      { "skuId": 110, "productId": 5, "color": "Đen", "size": "L", "barcode": "SP0005-DEN-L" }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc mã vạch đã tồn tại (`BARCODE_ALREADY_EXISTS`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy danh mục hoặc thương hiệu.

---

## 10. Cập nhật sản phẩm (FR-24)

- **Endpoint:** `PUT /api/v1/products/{id}` (hoặc `PATCH`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Cập nhật từng phần thông tin sản phẩm (các trường gửi lên); cùng tập trường như mục 9, tất cả đều không bắt buộc. Không áp dụng cho sản phẩm đã `PUBLISHED`.

### Request Body
```json
{
  "productName": "Áo Polo Pique Cổ Bẻ (2026)",
  "price": 295000.00,
  "status": "ACTIVE"
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật sản phẩm thành công",
  "result": {
    "id": 5,
    "productName": "Áo Polo Pique Cổ Bẻ (2026)",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "price": 295000.00,
    "status": "ACTIVE",
    "variants": []
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ.
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm, danh mục hoặc thương hiệu.
- **HTTP 409 Conflict:** Sản phẩm đã `PUBLISHED`, phải sửa qua bản nháp (`DATA_CONFLICT`).

---

## 11. Xóa / Tạm ẩn sản phẩm (FR-25)

- **Endpoint:** `DELETE /api/v1/products/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Xóa mềm sản phẩm và các biến thể (`da_xoa = true`), chuyển trạng thái sang `DISCONTINUED`. Không áp dụng cho sản phẩm đã `PUBLISHED` (dùng `unpublish` trước).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa sản phẩm thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).
- **HTTP 409 Conflict:** Sản phẩm đã `PUBLISHED` (`DATA_CONFLICT`).

---

## 12. Lấy danh sách biến thể theo sản phẩm (FR-26)

- **Endpoint:** `GET /api/v1/products/{productId}/variants`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy các biến thể (SKU) của một sản phẩm.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách biến thể thành công",
  "result": [
    {
      "skuId": 101,
      "productId": 1,
      "color": "Trắng",
      "size": "S",
      "barcode": "SP0001-TRANG-S",
      "additionalPrice": 0.00,
      "colorIsSentinel": false,
      "sizeIsSentinel": false
    }
  ],
  "errors": null,
  "timestamp": "2026-10-26T16:50:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 13. Lấy chi tiết biến thể theo ID (FR-26)

- **Endpoint:** `GET /api/v1/products/variants/{variantId}`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy thông tin một biến thể theo SKU ID.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin biến thể thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "color": "Trắng",
    "size": "S",
    "barcode": "SP0001-TRANG-S",
    "additionalPrice": 0.00,
    "colorIsSentinel": false,
    "sizeIsSentinel": false
  },
  "errors": null,
  "timestamp": "2026-10-26T16:50:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 14. Thêm biến thể cho sản phẩm (FR-26)

- **Endpoint:** `POST /api/v1/products/{productId}/variants`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Thêm biến thể màu / size mới; không truyền `barcode` thì hệ thống tự sinh theo mẫu `SP%04d-%s-%s`.

### Request Body
```json
{
  "color": "Trắng",
  "size": "S",
  "barcode": "SP0001-TRANG-S"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `color` | String | Có | Màu sắc, tối đa 50 ký tự |
| `size` | String | Có | Kích cỡ, tối đa 50 ký tự |
| `barcode` | String | Không | Mã vạch, tối đa 100 ký tự, duy nhất |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm mới biến thể thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "color": "Trắng",
    "size": "S",
    "barcode": "SP0001-TRANG-S"
  },
  "errors": null,
  "timestamp": "2026-10-26T16:50:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, biến thể màu + size đã tồn tại (`VARIANT_ALREADY_EXISTS`) hoặc mã vạch trùng (`BARCODE_ALREADY_EXISTS`).
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 15. Cập nhật biến thể (FR-26)

- **Endpoint:** `PATCH /api/v1/products/variants/{variantId}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Cập nhật màu, size hoặc mã vạch của biến thể.

### Request Body
```json
{
  "color": "Xanh navy",
  "size": "M",
  "barcode": "SP0001-XANH-M"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `color` | String | Không | Màu sắc, tối đa 50 ký tự |
| `size` | String | Không | Kích cỡ, tối đa 50 ký tự |
| `barcode` | String | Không | Mã vạch, tối đa 100 ký tự, duy nhất |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật biến thể thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "color": "Xanh navy",
    "size": "M",
    "barcode": "SP0001-XANH-M"
  },
  "errors": null,
  "timestamp": "2026-10-26T16:50:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Biến thể màu + size đã tồn tại hoặc mã vạch trùng.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 16. Xóa biến thể (FR-26)

- **Endpoint:** `DELETE /api/v1/products/variants/{variantId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Xóa mềm biến thể (`da_xoa = true`).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa biến thể thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-26T16:50:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 17. Xuất dữ liệu mã vạch Barcode (FR-27)

- **Endpoint:** `GET /api/v1/products/variants/{skuId}/barcode`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Trả dữ liệu mã vạch của SKU kèm ảnh mã vạch dạng Base64 để in tem dán sản phẩm.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xuất mã vạch thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "productName": "Áo sơ mi Oxford kẻ sọc",
    "color": "Xanh dương",
    "size": "L",
    "price": 350000.00,
    "barcode": "893850123401",
    "barcodeBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 18. Xuất ảnh mã vạch PNG (FR-27)

- **Endpoint:** `GET /api/v1/products/variants/{skuId}/barcode/image`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Trả trực tiếp ảnh PNG mã vạch của SKU (`Content-Type: image/png`), không bọc `ApiResponse`.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh PNG.

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 19. Tra cứu nhanh bằng mã vạch tại quầy POS (FR-28)

- **Endpoint:** `GET /api/v1/products/pos-lookup`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Thu ngân quét mã vạch để lấy thông tin SKU, giá và tồn kho khả dụng.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `barcode` | String | Có | Mã vạch cần tra cứu |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tra cứu thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "productName": "Áo sơ mi Oxford kẻ sọc",
    "color": "Xanh dương",
    "size": "L",
    "price": 350000.00,
    "barcode": "893850123401",
    "availableStock": 25,
    "imageUrl": null
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Mã vạch trống.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm theo mã vạch.

---

## 20. Tìm sản phẩm tại quầy POS (FR-28)

- **Endpoint:** `GET /api/v1/products/pos-search`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Tìm nhanh SKU theo tên hoặc mã SKU / mã vạch, trả danh sách cùng dạng `result` như mục 19.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `keyword` | String | Có | Từ khóa tên sản phẩm / SKU / mã vạch |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm POS thành công",
  "result": [
    {
      "skuId": 101,
      "productId": 1,
      "productName": "Áo sơ mi Oxford kẻ sọc",
      "color": "Xanh dương",
      "size": "L",
      "price": 350000.00,
      "barcode": "893850123401",
      "availableStock": 25,
      "imageUrl": null
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `keyword`.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 21. Tải ảnh sản phẩm lên

- **Endpoint:** `POST /api/v1/products/{id}/image`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Tải ảnh lên (`multipart/form-data`, field `file`): PNG / JPG / JPEG / WEBP, tối đa 5MB; kiểm tra nội dung ảnh thật và lưu với tên UUID. Không áp dụng cho sản phẩm đã `PUBLISHED`.

### Request Body
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `file` | File | Có | Ảnh sản phẩm |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tải ảnh sản phẩm thành công",
  "result": "/api/v1/products/images/3f8a9c2e-1b7d-4e55-a6f0-2c9d1e7b8a40.jpg",
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Chưa chọn file, file quá 5MB hoặc không phải ảnh hợp lệ (`INVALID_IMAGE_FILE`).
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm hoặc sản phẩm không khả dụng (`PRODUCT_NOT_FOUND`).
- **HTTP 409 Conflict:** Sản phẩm đã `PUBLISHED` (`DATA_CONFLICT`).

---

## 22. Xóa ảnh sản phẩm

- **Endpoint:** `DELETE /api/v1/products/{id}/image`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Xóa file ảnh trên đĩa và đặt `imageUrl` về rỗng.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa ảnh sản phẩm thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).
- **HTTP 409 Conflict:** Sản phẩm đã `PUBLISHED` (`DATA_CONFLICT`).

---

## 23. Phục vụ ảnh sản phẩm

- **Endpoint:** `GET /api/v1/products/images/{fileName}`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Trả file ảnh đã tải lên (`Cache-Control: private, max-age=3600`), không bọc `ApiResponse`. Tên file chỉ chứa ký tự an toàn và phần mở rộng ảnh; không nhận đường dẫn (`..`, `/`, `\`).

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh (`image/png`, `image/jpeg` hoặc `image/webp`).

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tên file hoặc phần mở rộng không hợp lệ.
- **HTTP 404 Not Found:** Ảnh không tồn tại.

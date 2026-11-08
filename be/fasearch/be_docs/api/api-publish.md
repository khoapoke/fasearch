# TÀI LIỆU API: MODULE PUBLISH (BẢN NHÁP & XUẤT BẢN SẢN PHẨM)

Module `publish` quản lý quy trình đưa sản phẩm lên cửa hàng theo hai bước: soạn bản nháp (kèm ảnh, biến thể, nhập từ URL) rồi xuất bản; sản phẩm xuất bản được đồng bộ sang dịch vụ tìm kiếm AI. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và chỉ dành cho `ADMIN`, `STAFF (Quản lý)`; vai trò `CUSTOMER` nhận HTTP 403.

---

## 1. Tạo bản nháp sản phẩm

- **Endpoint:** `POST /api/v1/admin/products/drafts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
- **Mô tả:** Tạo bản nháp sản phẩm mới, hoặc bản nháp chỉnh sửa của sản phẩm đã có khi gửi `productId` (mỗi sản phẩm chỉ có một bản nháp mở).

### Request Body
```json
{
  "productId": null,
  "productName": "Áo Polo Pique Cổ Bẻ",
  "categoryId": 1,
  "brandId": 1,
  "modelCode": "POLO-PIQUE-01",
  "material": "Cotton gai CVC",
  "style": "Slim Fit",
  "description": "Chất vải dày dặn, đứng form.",
  "price": 280000.00,
  "imageUrl": null,
  "variants": [
    { "color": "Đen", "size": "L", "barcode": "POLO01-DEN-L", "additionalPrice": 0, "stock": 10 }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Không | ID sản phẩm có sẵn cần chỉnh sửa; bỏ trống để tạo sản phẩm mới |
| `productName` | String | Không | Tên sản phẩm, tối đa 255 ký tự (bắt buộc khi xuất bản) |
| `categoryId` | Long | Không | ID danh mục (bắt buộc khi xuất bản) |
| `brandId` | Long | Không | ID thương hiệu |
| `modelCode` | String | Không | Mã model, tối đa 100 ký tự |
| `material` | String | Không | Chất liệu, tối đa 100 ký tự |
| `style` | String | Không | Kiểu dáng, tối đa 100 ký tự |
| `description` | String | Không | Mô tả |
| `price` | Number | Không | Giá bán (`>= 0`, bắt buộc khi xuất bản) |
| `imageUrl` | String | Không | Ảnh chính (bắt buộc khi xuất bản; tải qua mục 6) |
| `sourceKind` | String | Không | Nguồn dữ liệu, tối đa 50 ký tự |
| `sourceUrl` | String | Không | URL nguồn |
| `sourceHash` | String | Không | SHA-256 nguồn, 64 ký tự hex |
| `variants` | Array | Không | Biến thể: `color`, `size`, `barcode`, `additionalPrice` (`>= 0`), `stock` (`>= 0`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 0,
    "draftState": "DRAFT",
    "productName": "Áo Polo Pique Cổ Bẻ",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "brandId": 1,
    "brandName": "Nike",
    "brandSlug": "nike",
    "modelCode": "POLO-PIQUE-01",
    "material": "Cotton gai CVC",
    "style": "Slim Fit",
    "description": "Chất vải dày dặn, đứng form.",
    "price": 280000.00,
    "imageUrl": null,
    "status": "ACTIVE",
    "variants": [
      { "color": "Đen", "size": "L", "barcode": "POLO01-DEN-L", "additionalPrice": 0, "stock": 10 }
    ],
    "sourceUrl": null,
    "sourceHash": null,
    "sourceKind": null,
    "updatedAt": "2026-11-05T09:00:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ (tên, giá âm, `sourceHash`, biến thể thiếu màu / size / mã vạch).
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm, danh mục hoặc thương hiệu.
- **HTTP 409 Conflict:** Sản phẩm đã có bản nháp mở, biến thể / mã vạch trùng (`DATA_CONFLICT`).

---

## 2. Cập nhật bản nháp

- **Endpoint:** `PUT /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
- **Mô tả:** Cập nhật các trường được gửi lên của bản nháp (khóa lạc quan theo `expectedVersion`); `variants` gửi lên sẽ thay toàn bộ danh sách biến thể.

### Request Body
```json
{
  "expectedVersion": 0,
  "price": 295000.00,
  "imageUrl": "draft-12/3f8a9c2e.jpg"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `expectedVersion` | Long | Có | Phiên bản bản nháp đang xem |
| `productName`, `categoryId`, `brandId`, `modelCode`, `material`, `style`, `description`, `price`, `imageUrl`, `variants` | | Không | Cùng ý nghĩa và ràng buộc như mục 1 |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 1,
    "draftState": "DRAFT",
    "productName": "Áo Polo Pique Cổ Bẻ",
    "price": 295000.00,
    "imageUrl": "draft-12/3f8a9c2e.jpg",
    "variants": [],
    "updatedAt": "2026-11-05T09:05:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc bản nháp đã đóng (`Draft đã đóng`).
- **HTTP 404 Not Found:** Không tìm thấy bản nháp.
- **HTTP 409 Conflict:** Bản nháp đã bị phiên khác thay đổi, tải lại rồi thử lại (`DATA_CONFLICT`).

---

## 3. Xem chi tiết bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
- **Mô tả:** Lấy bản nháp theo ID.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 1,
    "draftState": "DRAFT",
    "productName": "Áo Polo Pique Cổ Bẻ",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "price": 295000.00,
    "imageUrl": "draft-12/3f8a9c2e.jpg",
    "status": "ACTIVE",
    "variants": [],
    "updatedAt": "2026-11-05T09:05:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy bản nháp.

---

## 4. Xem danh sách bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
- **Mô tả:** Danh sách bản nháp có phân trang, lọc theo sản phẩm.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `20`) |
| `productId` | Long | Không | Chỉ lấy bản nháp của sản phẩm này |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách bản nháp thành công",
  "result": {
    "content": [
      { "draftId": 12, "productId": null, "version": 1, "draftState": "DRAFT", "productName": "Áo Polo Pique Cổ Bẻ", "price": 295000.00, "variants": [] }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "errors": null,
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 5. Xóa bản nháp

- **Endpoint:** `DELETE /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
- **Mô tả:** Xóa bản nháp đang mở (bản nháp đã xuất bản hoặc đã đóng không xóa được).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa bản nháp thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Bản nháp đã đóng.
- **HTTP 404 Not Found:** Không tìm thấy bản nháp.

---

## 6. Tải ảnh cho bản nháp

- **Endpoint:** `POST /api/v1/admin/products/drafts/{draftId}/images`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
- **Mô tả:** Tải ảnh lên (`multipart/form-data`, field `file`) và trả tham chiếu ảnh để gán vào `imageUrl` của bản nháp (mục 2).

### Request Body
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `file` | File | Có | Ảnh PNG / JPG / JPEG / WEBP |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tải ảnh nháp thành công",
  "result": "draft-12/3f8a9c2e.jpg",
  "errors": null,
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** File không phải ảnh hợp lệ (`INVALID_IMAGE_FILE`) hoặc bản nháp đã đóng.
- **HTTP 404 Not Found:** Không tìm thấy bản nháp.

---

## 7. Xem ảnh của bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts/{draftId}/images/{fileName}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
- **Mô tả:** Trả file ảnh của bản nháp (`image/png` hoặc `image/jpeg`, `Cache-Control: private, no-store`), không bọc `ApiResponse`.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy bản nháp hoặc ảnh.

---

## 8. Xuất bản bản nháp

- **Endpoint:** `POST /api/v1/admin/products/drafts/{draftId}/publish`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_PUBLISH`
- **Mô tả:** Tạo / cập nhật sản phẩm từ bản nháp và đưa vào hàng đợi đồng bộ AI. Bản nháp phải đủ tên, danh mục, giá, ảnh chính và ít nhất một SKU.

### Request Body
```json
{
  "expectedVersion": 1
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `expectedVersion` | Long | Có | Phiên bản bản nháp đang xem |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xuất bản thành công",
  "result": {
    "productId": 5,
    "version": 1,
    "publicationStatus": "PUBLISHED",
    "aiSyncStatus": "PENDING",
    "aiSync": "PENDING",
    "status": "PUBLISHED"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:10:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `expectedVersion`, bản nháp chưa đủ thông tin, thiếu ảnh chính hoặc đã đóng.
- **HTTP 404 Not Found:** Không tìm thấy bản nháp.
- **HTTP 409 Conflict:** Bản nháp đã bị phiên khác thay đổi hoặc mã vạch trùng (`DATA_CONFLICT`).

---

## 9. Gỡ xuất bản sản phẩm

- **Endpoint:** `POST /api/v1/admin/products/{productId}/unpublish`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_PUBLISH`
- **Mô tả:** Gỡ sản phẩm đã xuất bản khỏi cửa hàng và khỏi chỉ mục tìm kiếm AI.

### Request Body
```json
{
  "reason": "Ngừng kinh doanh mẫu này"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do gỡ |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Gỡ xuất bản thành công",
  "result": {
    "productId": 5,
    "version": 2,
    "publicationStatus": "UNPUBLISHED",
    "aiSyncStatus": "PENDING",
    "aiSync": "PENDING",
    "status": "UNPUBLISHED"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:15:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Sản phẩm chưa ở trạng thái đã xuất bản.
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 10. Xem trạng thái đồng bộ AI

- **Endpoint:** `GET /api/v1/admin/products/{productId}/ai-sync`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
- **Mô tả:** Trạng thái đồng bộ sản phẩm sang dịch vụ tìm kiếm AI.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy trạng thái đồng bộ AI thành công",
  "result": {
    "productId": 5,
    "version": 1,
    "status": "READY",
    "attempts": 1,
    "updatedAt": "2026-11-05T09:11:00",
    "lastError": null
  },
  "errors": null,
  "timestamp": "2026-11-05T09:12:00"
}
```

- `status`: `NEVER_QUEUED` (chưa từng xuất bản, `attempts = 0`), `PENDING`, `RUNNING`, `READY`, `FAILED`.

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 11. Thử đồng bộ AI lại

- **Endpoint:** `POST /api/v1/admin/products/{productId}/ai-sync/retry`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_PUBLISH`
- **Mô tả:** Đưa bản ghi đồng bộ AI đang lỗi về `PENDING` để chạy lại; bản ghi đã `READY` được giữ nguyên.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thử đồng bộ AI thành công",
  "result": {
    "productId": 5,
    "version": 1,
    "status": "PENDING",
    "attempts": 1,
    "updatedAt": "2026-11-05T09:13:00",
    "lastError": null
  },
  "errors": null,
  "timestamp": "2026-11-05T09:13:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Chưa có bản ghi đồng bộ cho sản phẩm.

---

## 12. Nhập bản nháp từ URL

- **Endpoint:** `POST /api/v1/admin/products/import-url`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_IMPORT`
- **Mô tả:** Server tải trang sản phẩm từ URL `https` thuộc danh sách tên miền cho phép, đọc dữ liệu và tạo bản nháp (cùng dạng `result` như mục 1). Danh mục của nguồn phải ánh xạ được sang danh mục sẵn có.

### Request Body
```json
{
  "url": "https://example-brand.com/products/polo-pique"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `url` | String | Có | URL `https` của sản phẩm nguồn |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Nhập từ URL thành công",
  "result": {
    "draftId": 13,
    "productId": null,
    "version": 0,
    "draftState": "DRAFT",
    "productName": "Polo Pique",
    "categoryId": 1,
    "price": 280000.00,
    "variants": [],
    "sourceUrl": "https://example-brand.com/products/polo-pique",
    "sourceHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "sourceKind": "feed",
    "updatedAt": "2026-11-05T09:20:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:20:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `url`, không phải `https`, tên miền không nằm trong danh sách cho phép hoặc không ánh xạ được danh mục.

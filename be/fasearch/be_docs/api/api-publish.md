# TÀI LIỆU API: MODULE PUBLISH (BẢN NHÁP & XUẤT BẢN SẢN PHẨM)

Module `publish` quản lý quy trình đưa sản phẩm lên cửa hàng theo hai bước: soạn bản nháp (kèm ảnh, biến thể, nhập từ URL) rồi xuất bản; sản phẩm xuất bản được đồng bộ sang dịch vụ tìm kiếm AI. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và authority theo từng mục. Các mã lỗi dưới đây kèm thông điệp mặc định trong `ErrorCode.java`; thông điệp thực tế có thể được service ghi đè bằng mô tả cụ thể. `ApiResponse` bỏ các trường null ở cấp envelope; các DTO trong `result` có thể chứa null.

---

## 1. Tạo bản nháp sản phẩm

- **Endpoint:** `POST /api/v1/admin/products/drafts`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_EDIT')`
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
| `productName` | String | Có khi tạo sản phẩm mới | Tên không rỗng, tối đa 255 ký tự; có thể lấy từ sản phẩm hiện có |
| `categoryId` | Long | Có khi tạo sản phẩm mới | ID danh mục; có thể lấy từ sản phẩm hiện có |
| `brandId` | Long | Không | ID thương hiệu |
| `modelCode` | String | Không | Mã model, tối đa 100 ký tự |
| `material` | String | Không | Chất liệu, tối đa 100 ký tự |
| `style` | String | Không | Kiểu dáng, tối đa 100 ký tự |
| `description` | String | Không | Mô tả |
| `price` | BigDecimal | Có khi tạo sản phẩm mới | Giá bán (`>= 0`); có thể lấy từ sản phẩm hiện có |
| `imageUrl` | String | Không | Ảnh chính (bắt buộc khi xuất bản; tải qua mục 6) |
| `sourceKind` | String | Không | Nguồn dữ liệu, tối đa 50 ký tự |
| `sourceUrl` | String | Không | URL nguồn |
| `sourceHash` | String | Không | Nếu cung cấp phải gồm 64 ký tự hex |
| `variants` | Array<AdminDraftVariantReq> | Không | Danh sách biến thể |
| `variants[].color` | String | Không | Tối đa 50 ký tự; mỗi biến thể cần ít nhất một trong màu, cỡ hoặc mã vạch |
| `variants[].size` | String | Không | Tối đa 50 ký tự |
| `variants[].barcode` | String | Không | Tối đa 100 ký tự |
| `variants[].additionalPrice` | BigDecimal | Không | Giá cộng thêm (`>= 0`) |
| `variants[].stock` | Integer | Không | Tồn kho (`>= 0`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 1,
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
    "price": 280000.0,
    "imageUrl": null,
    "status": "ACTIVE",
    "variants": [
      {
        "color": "Đen",
        "size": "L",
        "barcode": "POLO01-DEN-L",
        "additionalPrice": 0,
        "stock": 10
      }
    ],
    "sourceUrl": null,
    "sourceHash": null,
    "sourceKind": null,
    "updatedAt": "2026-11-05T09:00:00"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `CATEGORY_NOT_FOUND` — Không tìm thấy danh mục.
- **HTTP 404:** `PRODUCT_NOT_FOUND` — Không tìm thấy sản phẩm.
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.
- **HTTP 409:** `DATA_CONFLICT` — Dữ liệu bị xung đột.

---

## 2. Cập nhật bản nháp

- **Endpoint:** `PUT /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_EDIT')`
- **Mô tả:** Cập nhật các trường được gửi lên của bản nháp (khóa lạc quan theo `expectedVersion`); `variants` gửi lên sẽ thay toàn bộ danh sách biến thể.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |

### Request Body
```json
{
  "expectedVersion": 1,
  "price": 295000.00,
  "imageUrl": "/api/v1/admin/products/drafts/12/images/3f8a9c2e.jpg"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `expectedVersion` | Long | Có | Phiên bản bản nháp đang xem |
| `productName` | String | Không | Tên không rỗng, tối đa 255 ký tự |
| `categoryId` | Long | Không | ID danh mục |
| `brandId` | Long | Không | ID thương hiệu |
| `modelCode` | String | Không | Tối đa 100 ký tự |
| `material` | String | Không | Tối đa 100 ký tự |
| `style` | String | Không | Tối đa 100 ký tự |
| `description` | String | Không | Mô tả |
| `price` | BigDecimal | Không | Giá bán (`>= 0`) |
| `imageUrl` | String | Không | Ảnh chính |
| `variants` | Array<AdminDraftVariantReq> | Không | Danh sách thay thế toàn bộ biến thể |
| `variants[].color` | String | Không | Tối đa 50 ký tự; cần ít nhất một trong màu, cỡ hoặc mã vạch |
| `variants[].size` | String | Không | Tối đa 50 ký tự |
| `variants[].barcode` | String | Không | Tối đa 100 ký tự |
| `variants[].additionalPrice` | BigDecimal | Không | Giá cộng thêm (`>= 0`) |
| `variants[].stock` | Integer | Không | Tồn kho (`>= 0`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 2,
    "draftState": "DRAFT",
    "productName": "Áo Polo Pique Cổ Bẻ",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "brandId": null,
    "brandName": null,
    "brandSlug": null,
    "modelCode": null,
    "material": null,
    "style": null,
    "description": null,
    "price": 295000.0,
    "imageUrl": "/api/v1/admin/products/drafts/12/images/3f8a9c2e.jpg",
    "status": "ACTIVE",
    "variants": [],
    "sourceUrl": null,
    "sourceHash": null,
    "sourceKind": null,
    "updatedAt": "2026-11-05T09:05:00"
  },
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `CATEGORY_NOT_FOUND` — Không tìm thấy danh mục.
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.
- **HTTP 409:** `DATA_CONFLICT` — Dữ liệu bị xung đột.

---

## 3. Xem chi tiết bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_VIEW')`
- **Mô tả:** Lấy bản nháp theo ID.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy bản nháp thành công",
  "result": {
    "draftId": 12,
    "productId": null,
    "version": 2,
    "draftState": "DRAFT",
    "productName": "Áo Polo Pique Cổ Bẻ",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "brandId": null,
    "brandName": null,
    "brandSlug": null,
    "modelCode": null,
    "material": null,
    "style": null,
    "description": null,
    "price": 295000.0,
    "imageUrl": "/api/v1/admin/products/drafts/12/images/3f8a9c2e.jpg",
    "status": "ACTIVE",
    "variants": [],
    "sourceUrl": null,
    "sourceHash": null,
    "sourceKind": null,
    "updatedAt": "2026-11-05T09:05:00"
  },
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.

---

## 4. Xem danh sách bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_VIEW')`
- **Mô tả:** Danh sách bản nháp có phân trang, lọc theo sản phẩm.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `20`) |
| `productId` | Long | Không | Chỉ lấy bản nháp của sản phẩm này |
| `sort` | String (có thể lặp) | Không | Sắp xếp theo thuộc tính và hướng, ví dụ `sort=updatedAt,desc` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách bản nháp thành công",
  "result": {
    "content": [
      {
        "draftId": 12,
        "productId": null,
        "version": 2,
        "draftState": "DRAFT",
        "productName": "Áo Polo Pique Cổ Bẻ",
        "categoryId": 1,
        "categoryName": "Áo sơ mi nam",
        "brandId": null,
        "brandName": null,
        "brandSlug": null,
        "modelCode": null,
        "material": null,
        "style": null,
        "description": null,
        "price": 295000.0,
        "imageUrl": null,
        "status": "ACTIVE",
        "variants": [],
        "sourceUrl": null,
        "sourceHash": null,
        "sourceKind": null,
        "updatedAt": "2026-11-05T09:05:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- Service không ném `AppException` cụ thể cho thao tác này.

---

## 5. Xóa bản nháp

- **Endpoint:** `DELETE /api/v1/admin/products/drafts/{draftId}`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_EDIT')`
- **Mô tả:** Xóa bản nháp đang mở (bản nháp đã xuất bản hoặc đã đóng không xóa được).

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa bản nháp thành công",
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.

---

## 6. Tải ảnh cho bản nháp

- **Endpoint:** `POST /api/v1/admin/products/drafts/{draftId}/images`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_EDIT')`
- **Mô tả:** Tải ảnh lên (`multipart/form-data`, field `file`) đồng thời cập nhật `imageUrl` và tăng `version` của bản nháp; trả URL ảnh.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |

### Request Body
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `file` | File | Có | Ảnh PNG / JPG / JPEG, tối đa 5 MiB; MIME và phần mở rộng phải khớp |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tải ảnh nháp thành công",
  "result": "/api/v1/admin/products/drafts/12/images/3f8a9c2e.jpg",
  "timestamp": "2026-11-05T09:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 400:** `INVALID_IMAGE_FILE` — Định dạng file ảnh không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.

---

## 7. Xem ảnh của bản nháp

- **Endpoint:** `GET /api/v1/admin/products/drafts/{draftId}/images/{fileName}`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_VIEW')`
- **Mô tả:** Trả file ảnh của bản nháp (`image/png` hoặc `image/jpeg`, `Cache-Control: private, no-store`), không bọc `ApiResponse`.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |
| `fileName` | String | Có | Tên tệp ảnh |

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh.

### Response Lỗi thường gặp
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.

---

## 8. Xuất bản bản nháp

- **Endpoint:** `POST /api/v1/admin/products/drafts/{draftId}/publish`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_PUBLISH')`
- **Mô tả:** Tạo / cập nhật sản phẩm từ bản nháp và đưa vào hàng đợi đồng bộ AI. Bản nháp phải đủ tên, danh mục, giá, ảnh chính và ít nhất một SKU.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `draftId` | Long | Có | ID bản nháp |

### Request Body
```json
{
  "expectedVersion": 3
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
  "timestamp": "2026-11-05T09:10:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.
- **HTTP 404:** `PRODUCT_NOT_FOUND` — Không tìm thấy sản phẩm.
- **HTTP 409:** `DATA_CONFLICT` — Dữ liệu bị xung đột.
- **HTTP 500:** `INTERNAL_SERVER_ERROR` — Đã xảy ra lỗi. Vui lòng thử lại sau.

---

## 9. Gỡ xuất bản sản phẩm

- **Endpoint:** `POST /api/v1/admin/products/{productId}/unpublish`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_PUBLISH')`
- **Mô tả:** Gỡ sản phẩm đã xuất bản khỏi cửa hàng và khỏi chỉ mục tìm kiếm AI.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Có | ID sản phẩm |

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
  "timestamp": "2026-11-05T09:15:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `PRODUCT_NOT_FOUND` — Không tìm thấy sản phẩm.

---

## 10. Xem trạng thái đồng bộ AI

- **Endpoint:** `GET /api/v1/admin/products/{productId}/ai-sync`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_VIEW')`
- **Mô tả:** Trạng thái đồng bộ sản phẩm sang dịch vụ tìm kiếm AI.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Có | ID sản phẩm |

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
  "timestamp": "2026-11-05T09:12:00"
}
```

- `status`: `NEVER_QUEUED` (chưa từng xuất bản, `attempts = 0`), `PENDING`, `RUNNING`, `READY`, `FAILED`.

### Response Lỗi thường gặp
- Service không ném `AppException` cụ thể cho thao tác này.

---

## 11. Thử đồng bộ AI lại

- **Endpoint:** `POST /api/v1/admin/products/{productId}/ai-sync/retry`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_PUBLISH')`
- **Mô tả:** Đưa bản ghi đồng bộ AI đang lỗi về `PENDING` để chạy lại; bản ghi `READY` đúng phiên bản hiện tại được giữ nguyên; các bản ghi khác được xử lý đồng bộ ngay và có thể trả trạng thái mới.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Có | ID sản phẩm |

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
  "timestamp": "2026-11-05T09:13:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.

---

## 12. Nhập bản nháp từ URL

- **Endpoint:** `POST /api/v1/admin/products/import-url`
- **Quyền hạn:** `hasAuthority('PERM_PRODUCT_IMPORT')`
- **Mô tả:** Server tải trang sản phẩm từ URL `https` thuộc danh sách tên miền cho phép, đọc JSON sản phẩm và tạo bản nháp (cùng dạng `result` như mục 1). Danh mục của nguồn phải ánh xạ được sang danh mục sẵn có.

### Request Body
```json
{
  "url": "https://teelab.vn/products/polo-pique.json"
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
    "version": 1,
    "draftState": "DRAFT",
    "productName": "Polo Pique",
    "categoryId": 1,
    "categoryName": "Áo sơ mi nam",
    "brandId": null,
    "brandName": null,
    "brandSlug": null,
    "modelCode": null,
    "material": null,
    "style": null,
    "description": null,
    "price": 280000.0,
    "imageUrl": "https://teelab.vn/polo.jpg",
    "status": "ACTIVE",
    "variants": [
      { "color": "Đen", "size": "L", "barcode": "POLO01-DEN-L", "additionalPrice": 0, "stock": 10 }
    ],
    "sourceUrl": "https://teelab.vn/products/polo-pique.json",
    "sourceHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "sourceKind": "VN_FEED",
    "updatedAt": "2026-11-05T09:20:00"
  },
  "timestamp": "2026-11-05T09:20:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404:** `CATEGORY_NOT_FOUND` — Không tìm thấy danh mục.
- **HTTP 404:** `RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.
- **HTTP 409:** `DATA_CONFLICT` — Dữ liệu bị xung đột.
- **HTTP 500:** `INTERNAL_SERVER_ERROR` — Đã xảy ra lỗi. Vui lòng thử lại sau.

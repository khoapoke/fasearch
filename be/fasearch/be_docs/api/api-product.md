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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CATEGORY_MANAGE`
- **Mô tả:** Tạo danh mục sản phẩm mới.

### Request Body
```json
{
  "categoryName": "Áo Polo Unisex"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `categoryName` | String | Có | Tên danh mục, tối đa 150 ký tự, duy nhất (không phân biệt hoa/thường và khoảng trắng hai đầu; dấu tiếng Việt vẫn phân biệt; danh mục đã xóa mềm không tính) |

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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CATEGORY_MANAGE`
- **Mô tả:** Đổi tên danh mục.

### Request Body
```json
{
  "categoryName": "Áo Polo Nam"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `categoryName` | String | Có | Tên danh mục, tối đa 150 ký tự, duy nhất (không phân biệt hoa/thường và khoảng trắng hai đầu; dấu tiếng Việt vẫn phân biệt; danh mục đã xóa mềm không tính) |

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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CATEGORY_MANAGE`
- **Mô tả:** Xóa mềm danh mục: đánh dấu `da_xoa = true`, ghi `ngay_xoa`, `nguoi_xoa` (lấy từ security context, không bao giờ từ client) và `ly_do_xoa`, rồi chuyển danh mục vào Thùng rác để khôi phục. Chỉ xóa được khi **không còn sản phẩm nào tham chiếu, kể cả sản phẩm đã xóa mềm** (giữ nguyên khóa ngoại của lịch sử).

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

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
- **HTTP 400 Bad Request:** Lý do xóa dài quá 255 ký tự (`INVALID_REQUEST`).
- **HTTP 404 Not Found:** Không tìm thấy danh mục (`CATEGORY_NOT_FOUND`).
- **HTTP 409 Conflict:** Danh mục còn sản phẩm tham chiếu (`DELETE_BLOCKED_BY_REFERENCES`); thông báo nêu số sản phẩm đang chặn.

---

## 7. Xem danh sách & Lọc sản phẩm (FR-22)

- **Endpoint:** `GET /api/v1/products`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Danh sách sản phẩm có phân trang, tìm kiếm và lọc theo danh mục, giá, trạng thái, thương hiệu. Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt (kể cả `đ`), tối đa 100 ký tự. `keyword` của khách/ẩn danh chỉ so khớp tên sản phẩm; ADMIN/STAFF so khớp thêm model, ID sản phẩm, tên/slug thương hiệu và SKU/mã vạch. Ký tự `%` và `_` do người dùng nhập được hiểu là ký tự thường. `GET` công khai chỉ thấy hàng `PUBLISHED`; ADMIN/STAFF (theo security context) thấy thêm hàng chưa xuất bản. Lọc `Tất cả` (không `status`): ADMIN/STAFF thấy mọi `publicationStatus`; `ACTIVE`/`OUT_OF_STOCK`: chỉ `PUBLISHED`; `DISCONTINUED`/`DRAFT`: lọc theo `status` nghiệp vụ (gồm hàng `UNPUBLISHED`/`DRAFT`). Khách/ẩn danh luôn thêm điều kiện `PUBLISHED` với mọi `status`.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo tên sản phẩm (khách/ẩn danh); ADMIN/STAFF tìm thêm model, ID, thương hiệu, SKU/mã vạch. Tối đa 100 ký tự, không phân biệt hoa/thường và dấu tiếng Việt |
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
        "publicationStatus": "PUBLISHED",
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
- `publicationStatus`: `PUBLISHED` | `UNPUBLISHED` | `DRAFT`. Admin dùng để hiển thị trạng thái thật: `UNPUBLISHED` đọc là “Đã gỡ xuất bản”, không đọc là “Đang bán” dù `status` vẫn là `ACTIVE`/`OUT_OF_STOCK`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tham số lọc sai kiểu (ví dụ `status` không thuộc danh sách).

---

## 8. Xem chi tiết sản phẩm (FR-24)

- **Endpoint:** `GET /api/v1/products/{id}`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Lấy thông tin chi tiết sản phẩm kèm danh sách biến thể. Mỗi biến thể kèm đúng một số khả dụng (`availableStock`) để storefront hiện trạng theo size; không lộ `physicalStock`, `reservedStock` hay `minThreshold`.

| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `publicationStatus` | String | `PUBLISHED` \| `UNPUBLISHED` \| `DRAFT`. Admin dùng để ẩn "Ngừng kinh doanh"/"Xóa" khi sản phẩm đang xuất bản. Khách/ẩn danh chỉ thấy hàng `PUBLISHED`. |
| `availableStock` | Integer \| Null | Tồn khả dụng theo SKU (`so_luong_kha_dung` = physical − reserved). `0` = hết hàng; `1–3` = sắp hết (FE chỉ hiện số khi `≤ 3`); `≥ 4` = còn hàng (FE không hiện số); `null` = chưa có dòng tồn kho, FE coi như chưa rõ và hiển thị bình thường. |

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
    "publicationStatus": "PUBLISHED",
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
        "sizeIsSentinel": false,
        "availableStock": 2
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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
- **HTTP 409 Conflict:** Sản phẩm đã `PUBLISHED`, phải sửa qua bản nháp hoặc gỡ xuất bản trước (`DATA_CONFLICT`). Thông điệp tiếng Việt: "Sản phẩm đang xuất bản nên không sửa trực tiếp được. Hãy sửa qua bản nháp hoặc gỡ xuất bản trước."

---

## 11. Xóa / Tạm ẩn sản phẩm (FR-25)

- **Endpoint:** `DELETE /api/v1/products/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_DELETE`
- **Mô tả:** Xóa mềm sản phẩm và toàn bộ biến thể (`da_xoa = true`) rồi chuyển vào Thùng rác; trạng thái nghiệp vụ sang `DISCONTINUED`, giữ nguyên lịch sử. Ghi `ngay_xoa`, `nguoi_xoa` (từ security context) và `ly_do_xoa`. Sản phẩm đã `PUBLISHED` phải `unpublish` trước. **Chặn khi đã phát sinh giao dịch**: có dòng trong `ct_don_hang`, tồn kho (`so_luong_vat_ly` hoặc `so_luong_tam_giu` > 0), dòng trên phiếu nhập/xuất/kiểm kê, hoặc đang nằm trong phạm vi chiến dịch khuyến mãi. Thay vào đó hãy dùng "Ngừng kinh doanh".

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

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
- **HTTP 400 Bad Request:** Lý do xóa dài quá 255 ký tự (`INVALID_REQUEST`).
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).
- **HTTP 409 Conflict:** Sản phẩm đang `PUBLISHED` (`DELETE_BLOCKED_PUBLISHED`); đã có dòng đơn hàng (`DELETE_BLOCKED_BY_HISTORY`); còn tồn kho (`DELETE_BLOCKED_BY_STOCK`); có dòng phiếu nhập/xuất/kiểm kê hoặc đang trong chiến dịch khuyến mãi (`DELETE_BLOCKED_BY_REFERENCES`). Thông báo nêu số dòng đang chặn và việc cần làm.

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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_DELETE`
- **Mô tả:** Xóa mềm biến thể (`da_xoa = true`), ghi `ngay_xoa`/`nguoi_xoa`/`ly_do_xoa` và chuyển SKU vào Thùng rác. Chặn theo cùng điều kiện như sản phẩm, ở mức SKU: còn dòng đơn hàng, còn tồn kho vật lý/giữ chỗ, có dòng phiếu nhập/xuất/kiểm kê, hoặc sản phẩm của SKU đang nằm trong chiến dịch khuyến mãi.

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

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
- **HTTP 400 Bad Request:** Lý do xóa dài quá 255 ký tự (`INVALID_REQUEST`).
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).
- **HTTP 409 Conflict:** SKU đã có dòng đơn hàng (`DELETE_BLOCKED_BY_HISTORY`); còn tồn kho (`DELETE_BLOCKED_BY_STOCK`); có dòng phiếu kho/kiểm kê hoặc sản phẩm đang trong chiến dịch khuyến mãi (`DELETE_BLOCKED_BY_REFERENCES`).

---

## 17. Xuất dữ liệu mã vạch Barcode (FR-27)

- **Endpoint:** `GET /api/v1/products/variants/{skuId}/barcode`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_VIEW`
- **Mô tả:** Trả trực tiếp ảnh PNG mã vạch của SKU (`Content-Type: image/png`), không bọc `ApiResponse`.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh PNG.

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 19. Tra cứu nhanh bằng mã vạch tại quầy POS (FR-28)

- **Endpoint:** `GET /api/v1/products/pos-lookup`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `POS_USE`
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

## 19.1. Tra cứu mã quét khi lập phiếu kho (FR-27, FR-28)

- **Endpoint:** `GET /api/v1/products/variants/scan-lookup`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `INVENTORY_VIEW`
- **Mô tả:** Máy quét mã vạch nhập mã rồi nhấn Enter trong form phiếu nhập, phiếu xuất, kiểm kê. Khớp chính xác mã vạch (không phân biệt hoa thường), nếu không có thì khớp mã SKU. SKU đã xóa mềm không được trả về. SKU chưa có dòng tồn kho vẫn được trả về với số lượng 0, để nhận được hàng mới nhập lần đầu.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `code` | String | Có | Nội dung đã quét: mã vạch hoặc mã SKU |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tra cứu mã quét thành công",
  "result": {
    "skuId": 101,
    "productId": 1,
    "productName": "Áo sơ mi Oxford kẻ sọc",
    "color": "Xanh dương",
    "size": "L",
    "barcode": "893850123401",
    "physicalStock": 30,
    "reservedStock": 5,
    "availableStock": 25,
    "minThreshold": 10,
    "productStatus": "ACTIVE"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Mã quét trống (`INVALID_REQUEST`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không có SKU nào khớp mã quét (`VARIANT_NOT_FOUND`).

---

## 20. Tìm sản phẩm tại quầy POS (FR-28)

- **Endpoint:** `GET /api/v1/products/pos-search`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `POS_USE`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_EDIT`
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

---

## 24. Sản phẩm liên quan (gợi ý "Có thể bạn cũng thích")

- **Endpoint:** `GET /api/v1/products/{id}/related`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Trả tối đa `limit` sản phẩm đang bán liên quan tới sản phẩm `{id}`: cùng danh mục xếp trước, rồi cùng thương hiệu. Chỉ gồm sản phẩm `PUBLISHED`, trạng thái `ACTIVE`, chưa xóa và có ít nhất một SKU còn tồn khả dụng; loại trừ chính sản phẩm đang xem. Dùng một truy vấn duy nhất (không N+1).

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `limit` | Integer | Không | Số sản phẩm tối đa (mặc định `8`, giới hạn 1 - 12) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy sản phẩm liên quan thành công",
  "result": [
    {
      "id": 12,
      "productName": "Áo sơ mi Oxford trơn",
      "categoryId": 1,
      "categoryName": "Áo sơ mi nam",
      "material": "100% Cotton",
      "style": "Regular Fit",
      "price": 320000.00,
      "imageUrl": "/api/v1/products/images/d4e5f6.jpg",
      "status": "ACTIVE",
      "brandId": 1,
      "brandName": "Nike",
      "brandSlug": "nike",
      "brandLogoUrl": "/api/v1/brands/nike/logo",
      "modelCode": "official-model-id"
    }
  ],
  "errors": null,
  "timestamp": "2026-11-05T10:00:00"
}
```

- Trả mảng rỗng khi không có sản phẩm phù hợp. Các trường brand / nguồn chỉ xuất hiện khi có dữ liệu.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm hoặc sản phẩm chưa xuất bản (`PRODUCT_NOT_FOUND`).

---

## 25. Thùng rác sản phẩm, biến thể, danh mục (FR-25, FR-26, FR-21)

- **Endpoint:** `GET /api/v1/admin/trash/products` · `GET /api/v1/admin/trash/variants` · `GET /api/v1/admin/trash/categories`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `TRASH_VIEW`
- **Mô tả:** Danh sách dữ liệu đã xóa mềm, mới xóa trước. Đọc bằng SQL gốc vì `@SQLRestriction("da_xoa = false")` ẩn các dòng này khỏi JPA. Dòng xóa trước khi có cột `ngay_xoa`/`nguoi_xoa` trả `deletedAt`/`deletedBy` là `null` và giao diện hiển thị "Không rõ". Không có endpoint xóa vĩnh viễn. Khách hàng và hồ sơ nhân sự dùng mục 22, tài khoản đăng nhập dùng mục 13 của `api-auth.md` (chỉ `ADMIN`).

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `20`, tối đa `100`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách sản phẩm đã xóa thành công",
  "result": {
    "content": [
      {
        "id": 10,
        "name": "Áo khoác gió",
        "status": "DISCONTINUED",
        "publicationStatus": "UNPUBLISHED",
        "productId": null,
        "productName": null,
        "color": null,
        "size": null,
        "barcode": null,
        "parentDeleted": false,
        "deletedAt": "2026-11-07T09:30:00",
        "deletedBy": "Nguyễn Quản Lý",
        "deleteReason": "Hết mùa"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "errors": null,
  "timestamp": "2026-11-07T09:35:00"
}
```

- Tab biến thể trả thêm `productId`, `productName`, `color`, `size`, `barcode` và `parentDeleted` (sản phẩm của SKU cũng đang bị xóa).

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `ADMIN`/`STAFF`.

---

## 26. Khôi phục từ thùng rác (FR-25, FR-26, FR-21)

- **Endpoint:** `POST /api/v1/admin/trash/products/{id}/restore` · `POST /api/v1/admin/trash/variants/{id}/restore` · `POST /api/v1/admin/trash/categories/{id}/restore`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `TRASH_RESTORE`
- **Mô tả:** Cập nhật có điều kiện `da_xoa = true` → `false` (kiểm tra đúng một dòng thay đổi) và xóa dấu vết xóa.
  - **Sản phẩm:** khôi phục về `DISCONTINUED` + `UNPUBLISHED`, đồng thời chỉ khôi phục các SKU bị xóa cùng đợt với sản phẩm (cùng thời điểm xóa được ghi lúc xóa); SKU đã xóa riêng từ trước vẫn nằm trong thùng rác. Sản phẩm **không** tự trở lại cửa hàng hay chỉ mục AI: phải xuất bản lại qua bản nháp.
  - **Biến thể:** từ chối khi sản phẩm của SKU vẫn đang ở thùng rác; từ chối khi mã vạch hoặc cặp màu/cỡ đã trùng với SKU đang hoạt động.
  - **Danh mục:** từ chối khi tên danh mục đã được danh mục khác sử dụng.
  - Khôi phục không bao giờ gọi dịch vụ xuất bản hay đồng bộ AI.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Khôi phục sản phẩm thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-11-07T09:40:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Mục không còn trong thùng rác (`TRASH_ITEM_NOT_FOUND`).
- **HTTP 409 Conflict:** SKU thuộc sản phẩm đang bị xóa (`RESTORE_BLOCKED`); trùng mã vạch, màu/cỡ, tên danh mục hoặc thương hiệu + mã model (`RESTORE_CONFLICT`).

---

## 27. Xuất CSV sản phẩm (FR-22)

- **Endpoint:** `GET /api/v1/admin/csv/products`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `DATA_EXPORT` và `PRODUCT_VIEW`
- **Mô tả:** Xuất CSV toàn bộ sản phẩm khớp bộ lọc, **mỗi dòng một SKU** (không chỉ trang hiện tại). Dùng đúng bộ lọc của `GET /api/v1/products` (mục 7). Sản phẩm, SKU và tồn kho đã xóa mềm không được xuất. Tệp UTF-8 **có BOM**, phân tách bằng **dấu phẩy**, xuống dòng CRLF, quote theo RFC 4180; header tiếng Việt. Tối đa **50.000 dòng**; vượt giới hạn trả lỗi và không tạo tệp.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `keyword` | String | Không | Tối đa 100 ký tự; cùng quy tắc với mục 7 (ADMIN/STAFF so khớp tên, model, ID, thương hiệu, SKU/mã vạch) |
| `categoryId` | Long | Không | Lọc theo ID danh mục |
| `minPrice` | Number | Không | Giá thấp nhất |
| `maxPrice` | Number | Không | Giá cao nhất |
| `status` | String | Không | `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `DISCONTINUED` |
| `brand` | String | Không | Lọc theo slug thương hiệu |
| `brandId` | Long | Không | Lọc theo ID thương hiệu |

### Response Thành công (HTTP 200 OK)
- `Content-Type: text/csv; charset=UTF-8`
- `Content-Disposition: attachment; filename="san-pham-YYYY-MM-DD.csv"` (ngày theo giờ Việt Nam; tên tệp không chứa dữ liệu cá nhân)
- `Cache-Control: no-store`

| Cột | Nguồn |
| :--- | :--- |
| `Mã sản phẩm`, `Tên sản phẩm`, `Danh mục`, `Thương hiệu`, `Model`, `Chất liệu`, `Kiểu dáng`, `Giá bán`, `Trạng thái sản phẩm`, `Trạng thái xuất bản` | Sản phẩm |
| `Mã SKU`, `Màu`, `Cỡ`, `Mã vạch`, `Giá cộng thêm` | SKU |
| `Tồn vật lý`, `Tồn tạm giữ`, `Tồn khả dụng` | Tồn kho của SKU (để trống nếu chưa có dòng tồn) |

- Thời gian `dd/MM/yyyy HH:mm` theo múi giờ Việt Nam; tiền là số nguyên, **không** dấu phân cách nghìn; trạng thái bằng nhãn tiếng Việt.
- Ô văn bản bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR được thêm tiền tố `'` để chặn công thức; ô số (kể cả số âm) giữ nguyên dạng số.
- Dòng được ghi theo lô 500, sắp xếp theo mã SKU tăng dần; mỗi lô đọc SKU và tồn kho bằng một truy vấn, không truy vấn theo từng dòng.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Bộ lọc sai kiểu/độ dài hoặc tập dữ liệu vượt 50.000 dòng (thu hẹp bộ lọc rồi thử lại).
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

> Excel vi-VN có thể mặc định dùng `;`: tệp này luôn dùng **dấu phẩy**, mở bằng chức năng nhập CSV chỉ định dấu phẩy.

---

## 28. Nhập CSV sản phẩm (FR-22)

- **Endpoint:** `POST /api/v1/admin/csv/products/import`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_IMPORT`
- **Mô tả:** Nhập sản phẩm từ CSV **thành bản nháp** (D9, D10). Không bao giờ tự xuất bản, không ghi tồn kho (tồn kho đi qua phiếu nhập), không gọi dịch vụ AI. `?dryRun=true` chỉ kiểm tra và **không ghi gì**; không có `dryRun` là áp dụng **tất cả hoặc không dòng nào** trong một transaction. Mỗi sản phẩm được tạo qua đúng luồng bản nháp hiện có (`PublishService.createDraft`), nên bản nháp hiện trong màn hình bản nháp và chỉ xuất bản được bằng luồng xuất bản thường.

### Request (multipart/form-data)
| Trường / tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `file` | File | Có | Tệp `.csv`, UTF-8 (BOM được chấp nhận), dấu phẩy, CRLF hoặc LF. Tối đa **5 MB** và **10.000 dòng dữ liệu** |
| `dryRun` | Boolean (query) | Không | `true`: chỉ kiểm tra, không ghi DB. Mặc định `false` |
| `checksum` | String (query) | Khi áp dụng | SHA-256 (64 hex) của đúng tệp đã trả về ở lần `dryRun=true`. Bắt buộc khi không có `dryRun` |

- **Cột (đúng bộ, không thừa không thiếu, thứ tự tùy ý):** `Tên sản phẩm`, `Danh mục`, `Thương hiệu`, `Model`, `Chất liệu`, `Kiểu dáng`, `Giá bán`, `Màu`, `Cỡ`, `Mã vạch`, `Giá cộng thêm`. Tên cột trùng với tệp xuất ở mục 27 để có thể chép đúng các cột cần nhập.
- Bắt buộc mỗi dòng: `Tên sản phẩm`, `Danh mục`, `Giá bán`, và ít nhất một trong `Màu`, `Cỡ`, `Mã vạch`. `Thương hiệu` và `Danh mục` phải tồn tại sẵn — không tự tạo. `Giá bán` là số không âm, không dấu phân cách nghìn, tối đa 2 chữ số thập phân; `Giá cộng thêm` mặc định `0`.
- Tiền tố `'` do tệp xuất thêm trước ô văn bản bắt đầu bằng `= + - @ tab CR LF` được bỏ khi nhập; văn bản còn lại lưu nguyên dạng dữ liệu, không thực thi công thức và không diễn giải HTML.
- **Mỗi dòng là một SKU.** Các dòng cùng một sản phẩm (cùng khóa nhận diện) gộp vào **một bản nháp**; các cột cấp sản phẩm phải giống nhau giữa các dòng đó và tổ hợp màu/cỡ không được trùng.
- **Khóa nhận diện:** sản phẩm = `(thương hiệu, model)` khi có cả hai (trùng unique index `uq_san_pham_brand_model`), ngược lại `(danh mục, tên đã chuẩn hóa)`; SKU = `mã vạch` (chuẩn hóa hoa/thường, cắt khoảng trắng). Trùng trong tệp, trùng với sản phẩm/SKU đã có **kể cả đã xóa mềm**, hoặc trùng bản nháp đang mở đều là lỗi — nhập lại cùng một tệp sẽ bị từ chối thay vì tạo trùng.
- Bản nháp tạo ra ghi nguồn bằng các cột có sẵn: `nguon_loai = ADMIN_CSV`, `nguon_url = csv-import://<tên đăng nhập>`, `nguon_hash = sha256(tệp)`. Không lưu tệp trên máy chủ.

### Bảo vệ lần áp dụng
- `dryRun=true` trả `checksum` (SHA-256 của đúng byte tệp). Áp dụng phải gửi lại `checksum`; tệp đổi giữa hai lần → **HTTP 409**, không ghi gì.
- Áp dụng khóa transaction bằng `pg_advisory_xact_lock`, rồi **kiểm tra lại toàn bộ** trong transaction. Hai lần gửi đồng thời hoặc gửi lại cùng tệp: lần sau thấy bản nháp/mã vạch do lần trước tạo nên trả **HTTP 409** và không tạo bản ghi nào.
- Mọi lỗi ở bước áp dụng đều rollback toàn bộ; không có bản nháp dở dang.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Kiểm tra tệp CSV hoàn tất",
  "result": {
    "checksum": "9f2c…64 ký tự hex…",
    "totalRows": 3,
    "validRows": 2,
    "productCount": 2,
    "errorCount": 1,
    "truncated": false,
    "errors": [
      { "row": 4, "column": "Giá bán", "code": "INVALID_NUMBER", "message": "Giá bán phải là số không âm. …" }
    ],
    "drafts": []
  },
  "errors": null,
  "timestamp": "2026-11-07T15:00:00"
}
```

- `row` là **số dòng trong tệp, tính cả dòng tiêu đề là dòng 1**. `column` là tên cột; rỗng khi lỗi thuộc cả dòng (ví dụ sai số cột). Tối đa **200 lỗi** trong `errors`; `truncated=true` khi tệp còn lỗi chưa hiển thị và `errorCount` là tổng thật.
- Khi áp dụng thành công, `drafts` chứa `{ "draftId", "productName", "skuCount" }` và `errorCount = 0`.
- Mã lỗi theo dòng thường gặp: `REQUIRED`, `TOO_LONG`, `INVALID_NUMBER`, `NEGATIVE_NUMBER`, `CATEGORY_NOT_FOUND`, `BRAND_NOT_FOUND`, `VARIANT_REQUIRED`, `DUPLICATE_BARCODE_FILE`, `BARCODE_EXISTS`, `BARCODE_IN_DRAFT`, `PRODUCT_EXISTS`, `PRODUCT_IN_DRAFT`, `PRODUCT_ROW_BLOCKED` (các dòng sau của sản phẩm đã bị chặn), `DUPLICATE_COMBINATION`, `TEXT_MISMATCH`, `ROW_WIDTH`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** thiếu tệp, sai phần mở rộng/Content-Type, tệp không phải UTF-8 (thông báo gợi ý lưu “CSV UTF-8”), sai/thiếu/thừa cột tiêu đề, tệp trống, quá 10.000 dòng, hoặc thiếu `checksum` khi áp dụng.
- **HTTP 409 Conflict:** `checksum` không khớp tệp hiện tại; áp dụng lại cùng tệp; dữ liệu đã đổi từ lần kiểm tra. Không dòng nào được ghi.
- **HTTP 413 Payload Too Large:** tệp vượt 5 MB.
- **HTTP 401 Unauthorized / 403 Forbidden:** chưa đăng nhập hoặc vai trò `CUSTOMER`.

---

## 29. Tải tệp mẫu nhập CSV sản phẩm (FR-22)

- **Endpoint:** `GET /api/v1/admin/csv/products/template`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `PRODUCT_IMPORT`
- **Mô tả:** Tải tệp mẫu chỉ có dòng tiêu đề, đúng 11 cột của mục 28, để điền và nhập lại. Không chứa dữ liệu thật hay dữ liệu cá nhân.

### Response Thành công (HTTP 200 OK)
- `Content-Type: text/csv; charset=UTF-8`
- `Content-Disposition: attachment; filename="mau-nhap-san-pham.csv"`
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`
- Nội dung: UTF-8 **có BOM**, CRLF, dấu phẩy; dòng tiêu đề `Tên sản phẩm,Danh mục,Thương hiệu,Model,Chất liệu,Kiểu dáng,Giá bán,Màu,Cỡ,Mã vạch,Giá cộng thêm`.

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** chưa đăng nhập.
- **HTTP 403 Forbidden:** vai trò `CUSTOMER` không có quyền.

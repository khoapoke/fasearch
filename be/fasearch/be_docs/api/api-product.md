# TÀI LIỆU API: MODULE PRODUCT & CATEGORY (SẢN PHẨM & DANH MỤC)

Module `product` và `category` quản lý danh mục thời trang, thông tin sản phẩm, các biến thể SKU (màu sắc, kích cỡ), mã vạch tem dán và tra cứu bán hàng tại quầy POS.

---

## 1. Quản lý Danh mục (FR-21)

### 1.1. Xem danh sách danh mục
- **Endpoint:** `GET /api/v1/categories`
- **Quyền hạn:** `PUBLIC` (Tất cả người dùng)
- **Response Thành công (HTTP 200 OK):**
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

### 1.2. Thêm mới danh mục
- **Endpoint:** `POST /api/v1/categories`
- **Quyền hạn:** `ADMIN`
- **Request Body:**
```json
{
  "categoryName": "Áo Polo Unisex"
}
```

### 1.3. Cập nhật danh mục
- **Endpoint:** `PUT /api/v1/categories/{id}`
- **Quyền hạn:** `ADMIN`

### 1.4. Xóa danh mục
- **Endpoint:** `DELETE /api/v1/categories/{id}`
- **Quyền hạn:** `ADMIN`

---

## 2. Quản lý Sản phẩm (FR-22, FR-23, FR-24, FR-25)

### 2.1. Xem danh sách & Lọc sản phẩm (FR-22)
- **Endpoint:** `GET /api/v1/products`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`, `ADMIN`
- **Query Parameters:**
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).
  - `sort`: Tiêu chí sắp xếp (`giaBan,asc`, `id,desc`...).
  - `keyword`: Tìm theo tên hoặc mã SP.
  - `categoryId`: Lọc theo ID danh mục.
  - `minPrice`: Giá thấp nhất.
  - `maxPrice`: Giá cao nhất.
  - `status`: Trạng thái (`ACTIVE`, `DRAFT`, `OUT_OF_STOCK`, `DISCONTINUED`).

#### Response Thành công (HTTP 200 OK)
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
        "imageUrl": "https://cdn.fasearch.com/products/sp01.jpg",
        "status": "ACTIVE"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "isLast": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### 2.2. Xem chi tiết sản phẩm (FR-24)
- **Endpoint:** `GET /api/v1/products/{id}`
- **Quyền hạn:** `PUBLIC`
- **Response Thành công (HTTP 200 OK):**
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
    "imageUrl": "https://cdn.fasearch.com/products/sp01.jpg",
    "status": "ACTIVE",
    "variants": [
      {
        "skuId": 101,
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "availableStock": 25
      },
      {
        "skuId": 102,
        "color": "Trắng",
        "size": "M",
        "barcode": "893850123402",
        "availableStock": 18
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### 2.3. Thêm mới sản phẩm (FR-23)
- **Endpoint:** `POST /api/v1/products`
- **Quyền hạn:** `ADMIN`
- **Request Body:**
```json
{
  "productName": "Áo Polo Pique Cổ Bẻ",
  "categoryId": 1,
  "material": "Cotton gai CVC",
  "style": "Slim Fit",
  "description": "Chất vải dày dặn, đứng form và thấm hút mồ hôi tốt.",
  "price": 280000.00,
  "imageUrl": "https://cdn.fasearch.com/products/polo01.jpg",
  "status": "ACTIVE",
  "variants": [
    {
      "color": "Đen",
      "size": "L"
    },
    {
      "color": "Đen",
      "size": "XL"
    }
  ]
}
```

### 2.4. Cập nhật sản phẩm (FR-24)
- **Endpoint:** `PUT /api/v1/products/{id}`
- **Quyền hạn:** `ADMIN`

### 2.5. Xóa / Tạm ẩn sản phẩm (FR-25)
- **Endpoint:** `DELETE /api/v1/products/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Chuyển trạng thái sang `DISCONTINUED` và cập nhật `da_xoa = true`.

---

## 3. Quản lý Biến thể SKU & Barcode (FR-26, FR-27)

### 3.1. Thêm biến thể cho sản phẩm (FR-26)
- **Endpoint:** `POST /api/v1/products/{id}/variants`
- **Quyền hạn:** `ADMIN`
- **Request Body:**
```json
{
  "color": "Trắng",
  "size": "S"
}
```
- **Hệ thống tự động:** Sinh mã SKU duy nhất và gán mã vạch Barcode chuẩn `EAN-13`.

### 3.2. Xuất mã vạch Barcode (FR-27)
- **Endpoint:** `GET /api/v1/products/variants/{skuId}/barcode`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Trả về dữ liệu mã vạch (chuỗi barcode và ảnh PNG/Base64 để in tem giá dán lên sản phẩm).

---

## 4. Tra cứu nhanh tại quầy POS (FR-28)

- **Endpoint:** `GET /api/v1/products/pos-lookup?barcode={code}`
- **Quyền hạn:** `STAFF`
- **Mô tả:** Thu ngân quét mã vạch bằng đầu đọc barcode tại quầy để lấy thông tin sản phẩm và thêm vào giỏ hàng POS.

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
    "availableStock": 25
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

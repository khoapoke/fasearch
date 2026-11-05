# TÀI LIỆU API: MODULE INVENTORY (QUẢN LÝ KHO HÀNG & TỒN KHO)

Module `inventory` quản lý số lượng tồn kho theo từng mã biến thể SKU, quy trình nhập kho từ nhà cung cấp, xuất kho điều chuyển/hủy hàng và kiểm kê quét mã vạch. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và chỉ dành cho `ADMIN`, `STAFF (Quản lý)`.

---

## 1. Tra cứu tồn kho khả dụng (FR-29)

- **Endpoint:** `GET /api/v1/inventory/stock`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Xem số lượng tồn kho thực tế, số lượng đang bị tạm giữ bởi các đơn hàng trực tuyến và tồn kho khả dụng để bán.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `sku` | String | Không | Mã SKU / mã vạch cần tra cứu |
| `productName` | String | Không | Tìm theo tên sản phẩm |
| `keyword` | String | Không | Từ khóa chung (tên, SKU, mã vạch) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tra cứu tồn kho thành công",
  "result": {
    "content": [
      {
        "skuId": 101,
        "productId": 1,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "physicalStock": 30,
        "reservedStock": 5,
        "availableStock": 25,
        "minThreshold": 10
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

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 2. Tổng quan tồn kho (FR-29)

- **Endpoint:** `GET /api/v1/inventory/stock-summary`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Số liệu tổng hợp toàn hệ thống cho màn hình tổng quan (đếm bằng truy vấn tổng hợp) kèm danh sách SKU ngoại lệ có giới hạn. `outOfStock`: khả dụng ≤ 0; `lowStock`: 0 < khả dụng ≤ `minThreshold`; `healthyStock`: khả dụng > `minThreshold`.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `limit` | Integer | Không | Số SKU ngoại lệ tối đa trả về, `1` - `50` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tổng quan tồn kho thành công",
  "result": {
    "totalSkus": 120,
    "outOfStock": 3,
    "lowStock": 9,
    "healthyStock": 108,
    "physicalTotal": 2400,
    "reservedTotal": 35,
    "availableTotal": 2365,
    "exceptionsTotal": 12,
    "limit": 20,
    "generatedAt": "2026-11-05T09:00:00",
    "exceptions": [
      {
        "skuId": 105,
        "productId": 3,
        "productName": "Quần Jean Slim Fit Xanh",
        "color": "Xanh nhạt",
        "size": "32",
        "barcode": "893850123405",
        "physicalStock": 3,
        "reservedStock": 0,
        "availableStock": 3,
        "minThreshold": 10
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- `exceptions` sắp xếp `availableStock` tăng dần rồi `skuId`; `exceptionsTotal` là tổng thật (hết hàng + thấp).

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `limit` ngoài khoảng `1` - `50`.

---

## 3. Tra cứu tồn kho theo SKU (FR-29)

- **Endpoint:** `GET /api/v1/inventory/stock/{skuId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Lấy tồn kho của một SKU.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin tồn kho SKU thành công",
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
    "minThreshold": 10
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không có bản ghi tồn kho cho SKU (`INVENTORY_NOT_FOUND`).

---

## 4. Lập phiếu nhập kho từ Nhà cung cấp (FR-30)

- **Endpoint:** `POST /api/v1/inventory/import-receipts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Khởi tạo phiếu nhập hàng, tự động cộng dồn số lượng tồn kho theo từng mã SKU.

### Request Body
```json
{
  "supplierName": "Xưởng may Gia Định",
  "note": "Nhập lô hàng thu đông đợt 1",
  "items": [
    {
      "skuId": 101,
      "quantity": 50,
      "importPrice": 180000.00
    },
    {
      "skuId": 102,
      "quantity": 30,
      "importPrice": 180000.00
    }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `supplierName` | String | Có | Tên nhà cung cấp, tối đa 255 ký tự |
| `note` | String | Không | Ghi chú |
| `items` | Array | Có | Danh sách mặt hàng nhập, không rỗng |
| `items[].skuId` | Long | Có | ID biến thể (SKU) |
| `items[].quantity` | Integer | Có | Số lượng nhập (`>= 1`) |
| `items[].importPrice` | Number | Có | Đơn giá nhập (`> 0`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo phiếu nhập kho thành công",
  "result": {
    "receiptId": 501,
    "receiptCode": "NK-20261025-001",
    "supplierName": "Xưởng may Gia Định",
    "note": "Nhập lô hàng thu đông đợt 1",
    "totalItems": 2,
    "totalQuantity": 80,
    "totalAmount": 14400000.00,
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00",
    "items": [
      {
        "id": 1,
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "quantity": 50,
        "importPrice": 180000.00,
        "subTotal": 9000000.00
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc phiếu không có mặt hàng hợp lệ (`INVALID_RECEIPT_ITEM`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 5. Xem danh sách phiếu nhập kho (FR-30)

- **Endpoint:** `GET /api/v1/inventory/import-receipts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Danh sách phiếu nhập kho có phân trang và bộ lọc.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `receiptCode` | String | Không | Tìm theo mã phiếu |
| `supplierName` | String | Không | Tìm theo nhà cung cấp |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phiếu nhập kho thành công",
  "result": {
    "content": [
      {
        "receiptId": 501,
        "receiptCode": "NK-20261025-001",
        "supplierName": "Xưởng may Gia Định",
        "totalItems": 2,
        "totalQuantity": 80,
        "totalAmount": 14400000.00,
        "status": "COMPLETED",
        "createdAt": "2026-10-25T15:30:00"
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

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 6. Xem chi tiết phiếu nhập kho (FR-30)

- **Endpoint:** `GET /api/v1/inventory/import-receipts/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Chi tiết một phiếu nhập kho kèm các dòng hàng; cùng dạng `result` như mục 4.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết phiếu nhập kho thành công",
  "result": {
    "receiptId": 501,
    "receiptCode": "NK-20261025-001",
    "supplierName": "Xưởng may Gia Định",
    "note": "Nhập lô hàng thu đông đợt 1",
    "totalItems": 2,
    "totalQuantity": 80,
    "totalAmount": 14400000.00,
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00",
    "items": []
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy phiếu nhập (`RECEIPT_NOT_FOUND`).

---

## 7. Lập phiếu xuất / Chuyển kho / Hủy hàng (FR-31)

- **Endpoint:** `POST /api/v1/inventory/export-receipts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Trừ số lượng tồn kho khi xuất hủy (hàng lỗi, rách, hỏng), chuyển kho hoặc xuất khác.

### Request Body
```json
{
  "exportType": "DAMAGED",
  "note": "Xuất hủy 2 áo bị rách chỉ trong quá trình vận chuyển",
  "items": [
    {
      "skuId": 101,
      "quantity": 2,
      "reason": "Rách đường may vai"
    }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `exportType` | String | Có | `DAMAGED`, `TRANSFER`, `OTHER` |
| `note` | String | Không | Ghi chú |
| `items` | Array | Có | Danh sách mặt hàng xuất, không rỗng |
| `items[].skuId` | Long | Có | ID biến thể (SKU) |
| `items[].quantity` | Integer | Có | Số lượng xuất (`>= 1`) |
| `items[].reason` | String | Không | Lý do, tối đa 255 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo phiếu xuất kho thành công",
  "result": {
    "receiptId": 601,
    "receiptCode": "XK-20261025-001",
    "exportType": "DAMAGED",
    "note": "Xuất hủy 2 áo bị rách chỉ trong quá trình vận chuyển",
    "totalItems": 1,
    "totalQuantity": 2,
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00",
    "items": [
      {
        "id": 1,
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "quantity": 2,
        "reason": "Rách đường may vai"
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, phiếu không có mặt hàng hợp lệ hoặc không đủ tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 8. Xem danh sách phiếu xuất kho (FR-31)

- **Endpoint:** `GET /api/v1/inventory/export-receipts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Danh sách phiếu xuất kho có phân trang và bộ lọc.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `receiptCode` | String | Không | Tìm theo mã phiếu |
| `exportType` | String | Không | `DAMAGED`, `TRANSFER`, `OTHER` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phiếu xuất kho thành công",
  "result": {
    "content": [
      {
        "receiptId": 601,
        "receiptCode": "XK-20261025-001",
        "exportType": "DAMAGED",
        "totalItems": 1,
        "totalQuantity": 2,
        "status": "COMPLETED",
        "createdAt": "2026-10-25T15:30:00"
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

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 9. Xem chi tiết phiếu xuất kho (FR-31)

- **Endpoint:** `GET /api/v1/inventory/export-receipts/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Chi tiết một phiếu xuất kho kèm các dòng hàng; cùng dạng `result` như mục 7.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết phiếu xuất kho thành công",
  "result": {
    "receiptId": 601,
    "receiptCode": "XK-20261025-001",
    "exportType": "DAMAGED",
    "note": "Xuất hủy 2 áo bị rách chỉ trong quá trình vận chuyển",
    "totalItems": 1,
    "totalQuantity": 2,
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00",
    "items": []
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy phiếu xuất (`EXPORT_RECEIPT_NOT_FOUND`).

---

## 10. Kiểm kê kho bằng quét mã vạch (FR-32)

- **Endpoint:** `POST /api/v1/inventory/stocktakes`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Tạo phiếu kiểm kê, ghi nhận số lượng đếm thực tế và tính chênh lệch so với tồn hệ thống. Phiếu ở trạng thái `PENDING_APPROVAL`, chưa điều chỉnh tồn kho.

### Request Body
```json
{
  "note": "Kiểm kê định kỳ cuối tuần",
  "records": [
    {
      "skuId": 101,
      "actualCount": 28
    }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `note` | String | Không | Ghi chú |
| `records` | Array | Có | Danh sách bản ghi kiểm kê, không rỗng |
| `records[].skuId` | Long | Có | ID biến thể (SKU) |
| `records[].actualCount` | Integer | Có | Số lượng đếm thực tế (`>= 0`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Ghi nhận phiếu kiểm kê thành công",
  "result": {
    "stocktakeId": 701,
    "stocktakeCode": "KK-20261025-001",
    "note": "Kiểm kê định kỳ cuối tuần",
    "totalDiscrepancy": 1,
    "status": "PENDING_APPROVAL",
    "createdAt": "2026-10-25T15:30:00",
    "discrepancies": [
      {
        "id": 1,
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "systemCount": 30,
        "actualCount": 28,
        "difference": -2
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc phiếu không có bản ghi hợp lệ (`INVALID_STOCKTAKE_RECORD`).
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 11. Xem danh sách phiếu kiểm kê (FR-32)

- **Endpoint:** `GET /api/v1/inventory/stocktakes`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Danh sách phiếu kiểm kê có phân trang và bộ lọc.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `stocktakeCode` | String | Không | Tìm theo mã phiếu |
| `status` | String | Không | `PENDING_APPROVAL`, `RECONCILED`, `CANCELLED` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phiếu kiểm kê thành công",
  "result": {
    "content": [
      {
        "stocktakeId": 701,
        "stocktakeCode": "KK-20261025-001",
        "note": "Kiểm kê định kỳ cuối tuần",
        "totalItems": 1,
        "totalDiscrepancy": 1,
        "status": "PENDING_APPROVAL",
        "createdAt": "2026-10-25T15:30:00"
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

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 12. Xem chi tiết phiếu kiểm kê (FR-32)

- **Endpoint:** `GET /api/v1/inventory/stocktakes/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Chi tiết một phiếu kiểm kê kèm các dòng chênh lệch; cùng dạng `result` như mục 10.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết phiếu kiểm kê thành công",
  "result": {
    "stocktakeId": 701,
    "stocktakeCode": "KK-20261025-001",
    "note": "Kiểm kê định kỳ cuối tuần",
    "totalDiscrepancy": 1,
    "status": "PENDING_APPROVAL",
    "createdAt": "2026-10-25T15:30:00",
    "discrepancies": []
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy phiếu kiểm kê (`STOCKTAKE_NOT_FOUND`).

# TÀI LIỆU API: MODULE INVENTORY (QUẢN LÝ KHO HÀNG & TỒN KHO)

Module `inventory` quản lý số lượng tồn kho theo từng mã biến thể SKU, quy trình nhập kho từ nhà cung cấp, xuất kho điều chuyển/hủy hàng, kiểm kê quét mã vạch và cảnh báo tồn kho tối thiểu.

---

## 1. Tra cứu tồn kho khả dụng (FR-29)

- **Endpoint:** `GET /api/v1/inventory/stock`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Xem số lượng tồn kho thực tế, số lượng đang bị tạm giữ bởi các đơn hàng trực tuyến và tồn kho khả dụng để bán.
- **Query Parameters:**
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).
  - `sku`: Mã SKU cần tra cứu.
  - `productName`: Tìm theo tên sản phẩm.
  - `branchId`: Lọc theo chi nhánh / kho hàng.

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
    "isLast": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Lập phiếu nhập kho từ Nhà cung cấp (FR-30)

- **Endpoint:** `POST /api/v1/inventory/import-receipts`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Khởi tạo phiếu nhập hàng, tự động cộng dồn số lượng tồn kho theo từng mã SKU sau khi duyệt phiếu.

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

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo phiếu nhập kho thành công",
  "result": {
    "receiptId": 501,
    "receiptCode": "NK-20261025-001",
    "totalItems": 2,
    "totalAmount": 14400000.00,
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Lập phiếu xuất / Chuyển kho / Hủy hàng (FR-31)

- **Endpoint:** `POST /api/v1/inventory/export-receipts`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Trừ số lượng tồn kho khi xuất hủy (hàng lỗi, rách, hỏng) hoặc chuyển kho sang chi nhánh khác.

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
    "status": "COMPLETED",
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Kiểm kê kho bằng quét mã vạch (FR-32)

- **Endpoint:** `POST /api/v1/inventory/stocktakes`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Tạo đợt kiểm kê, nhân viên quét mã vạch để ghi nhận số lượng hàng thực tế trên kệ.

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

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Ghi nhận phiếu kiểm kê thành công",
  "result": {
    "stocktakeId": 701,
    "discrepancies": [
      {
        "skuId": 101,
        "systemCount": 30,
        "actualCount": 28,
        "difference": -2
      }
    ],
    "status": "PENDING_APPROVAL"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 5. Cân bằng kho tự động (FR-33)

- **Endpoint:** `POST /api/v1/inventory/stocktakes/{id}/reconcile`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Phê duyệt phiếu kiểm kê và tự động sinh bút toán cân bằng tồn kho, điều chỉnh số liệu hệ thống khớp với số đếm thực tế.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cân bằng kho thành công",
  "result": {
    "stocktakeId": 701,
    "adjustedItemsCount": 1,
    "status": "RECONCILED",
    "reconciledAt": "2026-10-25T15:35:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 6. Cảnh báo tồn kho thấp (FR-34)

- **Endpoint:** `GET /api/v1/inventory/low-stock-alerts`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Lấy danh sách các mặt hàng có tồn kho khả dụng bằng hoặc dưới ngưỡng tối thiểu để chuẩn bị kế hoạch nhập thêm hàng.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách cảnh báo tồn kho thành công",
  "result": [
    {
      "skuId": 105,
      "productName": "Quần Jean Slim Fit Xanh",
      "color": "Xanh nhạt",
      "size": "32",
      "availableStock": 3,
      "minThreshold": 10,
      "suggestedImportQty": 20
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

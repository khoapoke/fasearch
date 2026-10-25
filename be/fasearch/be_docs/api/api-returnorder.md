# TÀI LIỆU API: MODULE RETURN ORDER (QUẢN LÝ ĐỔI / TRẢ HÀNG)

Module `returnorder` xử lý nghiệp vụ sau bán hàng: tra cứu hóa đơn gốc, thẩm định điều kiện đổi/trả (trong thời hạn quy định, còn nguyên tem mác), lập phiếu đổi hàng hoặc hoàn tiền, tính chênh lệch giá và nhập kho thu hồi hàng tái kinh doanh.

---

## 1. Tra cứu hóa đơn phục vụ đổi trả (FR-48)

- **Endpoint:** `GET /api/v1/return-orders/lookup-invoice`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Tìm kiếm hóa đơn đã hoàn tất thanh toán bằng Mã đơn hàng hoặc Số điện thoại khách hàng để kiểm tra các sản phẩm đã mua.
- **Query Parameters:**
  - `query`: Mã đơn hàng hoặc Số điện thoại người mua.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tra cứu hóa đơn thành công",
  "result": {
    "orderId": 1001,
    "invoiceCode": "HD-20261025-001",
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "purchasedDate": "2026-10-22T10:15:00",
    "daysSincePurchase": 3,
    "purchasedItems": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "purchasedPrice": 350000.00,
        "quantity": 1
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Kiểm tra điều kiện đổi trả (FR-49)

- **Endpoint:** `POST /api/v1/return-orders/check-eligibility`
- **Quyền hạn:** `STAFF`, `SYSTEM`
- **Mô tả:** Tự động kiểm tra thời hạn mua hàng có vượt quá chính sách đổi trả (mặc định 7 ngày kể từ ngày mua) và trạng thái đơn hàng.

### Request Body
```json
{
  "orderId": 1001,
  "skuId": 101
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Sản phẩm đủ điều kiện đổi trả",
  "result": {
    "isEligible": true,
    "remainingEligibleDays": 4,
    "allowedActions": ["EXCHANGE", "RETURN"]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Lập phiếu Đổi / Trả hàng (FR-50)

- **Endpoint:** `POST /api/v1/return-orders`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Tạo phiếu đổi hàng sang biến thể khác hoặc trả hàng hoàn tiền. Tính chênh lệch giá:
  - Nếu đổi SP giá cao hơn: Thu thêm tiền chênh lệch.
  - Nếu đổi SP giá thấp hơn hoặc Trả hàng: Hoàn lại tiền thừa cho khách.

### Request Body (Ví dụ Đổi sang áo Size XL)
```json
{
  "orderId": 1001,
  "customerId": 1,
  "returnType": "EXCHANGE",
  "reason": "Khách mặc chật, muốn đổi lên Size XL cùng mẫu",
  "items": [
    {
      "oldSkuId": 101,
      "newSkuId": 103,
      "returnQuantity": 1,
      "exchangeQuantity": 1,
      "priceDifference": 0.00
    }
  ]
}
```

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Lập phiếu đổi trả thành công",
  "result": {
    "returnOrderId": 901,
    "orderId": 1001,
    "returnType": "EXCHANGE",
    "totalPriceDifference": 0.00,
    "status": "APPROVED",
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Nhập kho hàng trả lại (FR-51)

- **Endpoint:** `POST /api/v1/return-orders/{id}/restock`
- **Quyền hạn:** `ADMIN`, `SYSTEM`
- **Mô tả:** Sau khi nhân viên kiểm tra tình trạng hàng trả lại (nguyên tem mác, không rách bẩn), hệ thống tự động tạo phiếu nhập kho để cộng lại số lượng tồn kho khả dụng cho SKU cũ.

### Request Body
```json
{
  "restockItems": [
    {
      "skuId": 101,
      "quantity": 1,
      "condition": "GOOD_CONDITION",
      "note": "Còn nguyên tem mác, nguyên bao bì"
    }
  ]
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Nhập kho hàng hoàn trả thành công",
  "result": {
    "returnOrderId": 901,
    "restockedSkuCount": 1,
    "inventoryUpdated": true,
    "status": "COMPLETED"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

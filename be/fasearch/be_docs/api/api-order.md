# TÀI LIỆU API: MODULE ORDER & CART (ĐƠN HÀNG & GIỎ HÀNG)

Module `order` và `cart` xử lý toàn bộ quy trình mua hàng đa kênh (Omnichannel): thêm hàng vào giỏ, đặt hàng trực tuyến, đơn tạm lưu tại quầy POS, theo dõi luồng trạng thái đơn hàng và tính phí vận chuyển.

---

## 1. Quản lý Giỏ hàng trực tuyến (FR-35A)

### 1.1. Xem giỏ hàng hiện tại
- **Endpoint:** `GET /api/v1/cart`
- **Quyền hạn:** `CUSTOMER`
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin giỏ hàng thành công",
  "result": {
    "cartId": 1,
    "totalItems": 2,
    "subTotal": 630000.00,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "unitPrice": 350000.00,
        "quantity": 1,
        "totalPrice": 350000.00
      },
      {
        "skuId": 105,
        "productName": "Áo Polo Pique Cổ Bẻ",
        "color": "Đen",
        "size": "L",
        "unitPrice": 280000.00,
        "quantity": 1,
        "totalPrice": 280000.00
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### 1.2. Thêm sản phẩm vào giỏ
- **Endpoint:** `POST /api/v1/cart/items`
- **Quyền hạn:** `CUSTOMER`
- **Request Body:**
```json
{
  "skuId": 101,
  "quantity": 1
}
```

### 1.3. Cập nhật số lượng sản phẩm trong giỏ
- **Endpoint:** `PUT /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `CUSTOMER`
- **Request Body:**
```json
{
  "quantity": 2
}
```

### 1.4. Xóa sản phẩm khỏi giỏ hàng
- **Endpoint:** `DELETE /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `CUSTOMER`

### 1.5. Xóa sạch giỏ hàng
- **Endpoint:** `DELETE /api/v1/cart`
- **Quyền hạn:** `CUSTOMER`

---

## 2. Đặt hàng trực tuyến (FR-35B)

- **Endpoint:** `POST /api/v1/orders/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Chốt giỏ hàng tạo đơn hàng mới, tạm giữ tồn kho, áp dụng voucher (nếu có).

### Request Body
```json
{
  "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0987654321",
  "voucherCode": "FASEARCH10",
  "paymentMethod": "VNPAY_QR",
  "shippingFee": 30000.00,
  "note": "Giao vào giờ hành chính"
}
```

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261025-001",
    "status": "PENDING",
    "subTotal": 630000.00,
    "discountAmount": 63000.00,
    "shippingFee": 30000.00,
    "totalAmount": 597000.00,
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Xem danh sách & Chi tiết đơn hàng (FR-36)

### 3.1. Danh sách đơn hàng
- **Endpoint:** `GET /api/v1/orders`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`
- **Query Parameters:**
  - `page`: Số trang.
  - `size`: Số bản ghi/trang.
  - `status`: Lọc theo trạng thái (`PENDING`, `CONFIRMED`, `PACKING`, `SHIPPING`, `COMPLETED`, `CANCELLED`).
  - `orderCode`: Tìm theo mã đơn hàng.
  - `customerPhone`: Tìm theo số điện thoại khách hàng.
  - `startDate`, `endDate`: Khoảng thời gian đặt hàng.

### 3.2. Xem chi tiết đơn hàng
- **Endpoint:** `GET /api/v1/orders/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261025-001",
    "status": "CONFIRMED",
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00
      }
    ],
    "subTotal": 350000.00,
    "shippingFee": 30000.00,
    "totalAmount": 380000.00,
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Cập nhật trạng thái & Hủy đơn hàng (FR-37, FR-38)

### 4.1. Cập nhật trạng thái đơn hàng (FR-37)
- **Endpoint:** `PATCH /api/v1/orders/{id}/status`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Request Body:**
```json
{
  "status": "PACKING",
  "note": "Đã chuẩn bị xong hàng, sẵn sàng giao cho đơn vị vận chuyển"
}
```

### 4.2. Hủy đơn hàng (FR-38)
- **Endpoint:** `POST /api/v1/orders/{id}/cancel`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`
- **Mô tả:** Hủy đơn hàng trước khi hoàn tất thanh toán. Hệ thống tự động giải phóng số lượng tồn kho đã tạm giữ (FR-40).
- **Request Body:**
```json
{
  "reason": "Khách hàng đổi ý muốn chọn size khác"
}
```

---

## 5. Tạm lưu đơn hàng tại quầy POS (FR-39)

- **Mô tả:** Thu ngân đang tính hóa đơn cho khách A nhưng khách cần chọn thêm đồ, thu ngân tạm lưu đơn để phục vụ ngay cho khách B tiếp theo.

### 5.1. Lưu tạm đơn hàng POS
- **Endpoint:** `POST /api/v1/orders/pos/draft`
- **Quyền hạn:** `STAFF`
- **Request Body:**
```json
{
  "customerPhone": "0987654321",
  "note": "Khách đang chọn thêm màu khác",
  "items": [
    {
      "skuId": 101,
      "quantity": 1
    }
  ]
}
```

### 5.2. Lấy danh sách đơn tạm tại quầy
- **Endpoint:** `GET /api/v1/orders/pos/drafts`
- **Quyền hạn:** `STAFF`

---

## 6. Tính phí vận chuyển tự động (FR-41)

- **Endpoint:** `POST /api/v1/orders/calculate-shipping-fee`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`
- **Mô tả:** Tính toán phí vận chuyển dựa trên địa chỉ nhận hàng và tổng trọng lượng đơn hàng.
- **Request Body:**
```json
{
  "province": "Thành phố Hồ Chí Minh",
  "district": "Quận 5",
  "totalWeightGram": 500
}
```
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Tính phí vận chuyển thành công",
  "result": {
    "shippingFee": 25000.00,
    "estimatedDays": "1 - 2 ngày"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

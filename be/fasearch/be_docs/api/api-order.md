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
- **Mô tả:** Chốt giỏ hàng tạo đơn hàng mới, tạm giữ tồn kho, áp dụng voucher/điểm theo quote hiện hành. `shippingFee` giữ nguyên legacy caller input; S2 không tính lại hoặc đưa phí ship vào fingerprint.

### Request Body
```json
{
  "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0987654321",
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 2,
  "quoteFingerprint": "opaque-server-token",
  "expectedMerchandiseAmountDue": 565000.00,
  "checkoutKey": "client-generated-idempotency-key",
  "paymentMethod": "VNPAY_QR",
  "shippingFee": 30000.00,
  "note": "Giao vào giờ hành chính"
}
```

Khi quote có benefit, gửi đúng `quoteFingerprint`, `expectedMerchandiseAmountDue` và `checkoutKey`; checkout kiểm tra lại trong transaction. `checkoutKey` bắt buộc nếu có voucher/điểm. Giá/cart/voucher/policy/allowance đổi sau quote trả HTTP 409 / business code `4107 QUOTE_CHANGED`. Cùng key nhưng request input khác (kể cả shippingFee) trả HTTP 409 / `4108 IDEMPOTENCY_CONFLICT`; shippingFee không thuộc quote fingerprint.

### Response Thành công (HTTP 201 Created; exact replay HTTP 200)
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
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.00,
    "earnedPoints": null,
    "shippingFee": 30000.00,
    "totalAmount": 595000.00,
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

Order list/detail giữ nguyên fields cũ và thêm `redeemedPoints`, `pointsDiscount`, `loyaltyPolicyId`, `loyaltyPolicyVersion`, `redeemCurrencyPerPointSnapshot`, `earnedPoints`. `earnedPoints` null trước settlement; no-snapshot/pre-S2 orders giữ null. Line `discountAmount` vẫn là voucher discount; `pointsDiscountAmount` là phần phân bổ điểm và tổng line allocation bằng `pointsDiscount`.

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
        "totalPrice": 350000.00,
        "discountAmount": 0.00,
        "pointsDiscountAmount": 0.00
      }
    ],
    "subTotal": 350000.00,
    "discountAmount": 0.00,
    "redeemedPoints": 0,
    "pointsDiscount": 0.00,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
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
- **Mô tả:** Khách hàng chỉ có thể tự hủy đơn `PENDING`/`CONFIRMED`; STAFF/ADMIN chỉ hủy đơn chưa PAID theo trạng thái cho phép. Trước bàn giao, hủy giải phóng stock, voucher và điểm giữ chỗ một lần trong cùng transaction. Sau bàn giao, financial holds của đơn voucher/đổi điểm S2 được giữ; hóa đơn đã PAID không thể bị hủy/giải phóng như đơn chưa thanh toán. Refund/reversal nằm ngoài scope.
- **Request Body:**
```json
{
  "reason": "Khách hàng đổi ý muốn chọn size khác"
}
```
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Hủy đơn hàng thành công",
  "result": {
    "id": 1,
    "orderCode": "DH-20261028-001",
    "status": "CANCELLED",
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "Giao vào giờ hành chính | [CUSTOMER] Hủy đơn: Khách hàng đổi ý muốn chọn size khác (2026-10-28 15:30:00)",
    "shippingFee": 30000.00,
    "discountAmount": 0.00,
    "subTotal": 630000.00,
    "totalAmount": 660000.00,
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "employee": null,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "imageUrl": "https://example.com/img1.jpg",
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00
      }
    ],
    "createdAt": "2026-10-28T15:20:00"
  },
  "errors": null,
  "timestamp": "2026-10-28T15:30:00"
}
```

---

## 5. Tạm lưu đơn hàng tại quầy POS (FR-39)

- **Mô tả:** Thu ngân đang tính hóa đơn cho khách A nhưng khách cần chọn thêm đồ, thu ngân tạm lưu đơn để phục vụ ngay cho khách B tiếp theo. Đơn tạm lưu được gán trạng thái `DRAFT` và không tạm giữ tồn kho (chỉ kiểm tra số lượng khả dụng tại thời điểm lưu).

### 5.1. Lưu tạm đơn hàng POS
- **Endpoint:** `POST /api/v1/orders/pos/draft`
- **Quyền hạn:** `ADMIN`, `STAFF`
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
- **Response Thành công (HTTP 201 Created):**
```json
{
  "success": true,
  "code": 201,
  "message": "Tạm lưu đơn hàng tại quầy POS thành công",
  "result": {
    "orderId": 1002,
    "orderCode": "POS-20261028-001",
    "status": "DRAFT",
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "deliveryAddress": "Bán tại quầy (POS)",
    "note": "Khách đang chọn thêm màu khác",
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "imageUrl": "https://example.com/img1.jpg",
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00
      }
    ],
    "subTotal": 350000.00,
    "discountAmount": 0.00,
    "shippingFee": 0.00,
    "totalAmount": 350000.00,
    "createdAt": "2026-10-28T15:25:00"
  },
  "errors": null,
  "timestamp": "2026-10-28T15:25:00"
}
```

### 5.2. Lấy danh sách đơn tạm tại quầy
- **Endpoint:** `GET /api/v1/orders/pos/drafts`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách đơn tạm tại quầy POS thành công",
  "result": [
    {
      "orderId": 1002,
      "orderCode": "POS-20261028-001",
      "status": "DRAFT",
      "customer": {
        "customerId": 1,
        "fullName": "Nguyễn Văn A",
        "phoneNumber": "0987654321"
      },
      "deliveryAddress": "Bán tại quầy (POS)",
      "note": "Khách đang chọn thêm màu khác",
      "items": [
        {
          "skuId": 101,
          "productName": "Áo sơ mi Oxford kẻ sọc",
          "color": "Xanh dương",
          "size": "L",
          "imageUrl": "https://example.com/img1.jpg",
          "quantity": 1,
          "unitPrice": 350000.00,
          "totalPrice": 350000.00
        }
      ],
      "subTotal": 350000.00,
      "discountAmount": 0.00,
      "shippingFee": 0.00,
      "totalAmount": 350000.00,
      "createdAt": "2026-10-28T15:25:00"
    }
  ],
  "errors": null,
  "timestamp": "2026-10-28T15:26:00"
}
```

---

### 5.3. Báo giá đơn tạm POS
- **Endpoint:** `POST /api/v1/orders/pos/{orderId}/quote`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Request Body:** `{ "voucherCode":"SAVE10", "redeemedPoints":2 }`
- **Mô tả:** Dùng persisted draft lines và customer đã link lúc tạo draft. Trả cùng totals/lines/fingerprint như `POST /api/v1/cart/quote`, bổ sung `orderId`. Preview-only; không giữ quota/điểm/tồn kho. Draft không có customer không được redeem hoặc earn.

### 5.4. Settlement POS
`POST /api/v1/payments/process` nhận thêm `voucherCode`, `redeemedPoints`, `quoteFingerprint` chỉ cho POS. Phải gửi fingerprint chính xác từ quote khi có benefits; service khóa và tính lại draft, rồi atomically giữ/tiêu thụ benefit, trừ tồn kho và lập invoice CASH. Chi tiết request/receipt ở [api-payment.md](./api-payment.md). Replay request y hệt trả lại invoice hiện có với HTTP 200; input tài chính khác trả HTTP 409 / `4108 IDEMPOTENCY_CONFLICT`.

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

# TÀI LIỆU API: MODULE PAYMENT (THANH TOÁN & HÓA ĐƠN)

Module `payment` xử lý tính tiền tổng thể hóa đơn (kết hợp khuyến mãi, điểm thưởng), tiếp nhận thanh toán tiền mặt tại quầy / khi nhận hàng, thanh toán trực tuyến qua cổng Stripe (test) và VNPAY (sandbox) và xuất hóa đơn bán lẻ.

---

## 1. Tính toán giá trị thanh toán (FR-42)

- **Endpoint:** `POST /api/v1/payments/calculate`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ tính đơn của mình)
- **Mô tả:** Xem trước số tiền thực trả của đơn hàng sau voucher, điểm và phí vận chuyển kèm VAT. Chỉ để hiển thị: không sửa đơn, không giữ điểm/voucher.

### Request Body
```json
{
  "orderId": 1001,
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `voucherCode` | String | Không | Mã giảm giá |
| `redeemedPoints` | Number | Không | Số điểm muốn dùng (`>= 0`, số nguyên) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tính toán hóa đơn thành công",
  "result": {
    "subTotal": 630000.00,
    "redeemedPoints": 2,
    "voucherDiscount": 63000.00,
    "pointDiscount": 2000.00,
    "shippingFee": 30000.00,
    "taxVat": 47600.00,
    "finalAmount": 595000.00
  },
  "errors": null,
  "timestamp": "2026-10-31T12:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Đơn đã hủy / đã hoàn trả, điểm sai định dạng hoặc vượt số dư.
- **HTTP 403 Forbidden:** `CUSTOMER` tính đơn của người khác.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).
- **HTTP 409 Conflict:** Điểm gửi lên không khớp snapshot của đơn (`4107 QUOTE_CHANGED`).

---

## 2. Danh sách phương thức thanh toán hỗ trợ (FR-43)

- **Endpoint:** `GET /api/v1/payments/methods`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Trả các phương thức thanh toán đang `ACTIVE` trong CSDL.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phương thức thanh toán thành công",
  "result": [
    {
      "id": 1,
      "methodCode": "CASH",
      "methodName": "Tiền mặt tại quầy",
      "status": "ACTIVE",
      "note": null
    },
    {
      "id": 2,
      "methodCode": "BANK_TRANSFER",
      "methodName": "Chuyển khoản qua số tài khoản ngân hàng",
      "status": "ACTIVE",
      "note": null
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

- `methodCode`: `CASH`, `BANK_TRANSFER`, `E_WALLET`, `VNPAY_QR`, `MOMO`, `STRIPE`. Phương thức xuất hiện trong danh sách chưa chắc đã có cổng thanh toán tương ứng.

---

## 3. Thực hiện thanh toán & Xuất hóa đơn (FR-43)

- **Endpoint:** `POST /api/v1/payments/process`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ thanh toán đơn của mình)
- **Mô tả:** Thu tiền mặt, lập hóa đơn `hoa_don`, trừ tồn kho và chuyển đơn sang đã thanh toán. Chỉ nhận `CASH`; phương thức khác phải đi qua cổng thanh toán (mục 4 - 10). Gửi lại request POS y hệt trả lại hóa đơn cũ với HTTP 200.

### Request Body
```json
{
  "orderId": 1001,
  "paymentMethodCode": "CASH",
  "amountPaid": 600000.00,
  "note": "Khách đưa 600.000đ",
  "voucherCode": "SAVE10",
  "redeemedPoints": 2,
  "quoteFingerprint": "opaque-server-token"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `paymentMethodCode` | String | Có | Mã phương thức (`CASH`) |
| `amountPaid` | Number | Có | Số tiền khách đưa (`>= 0`) |
| `note` | String | Không | Ghi chú |
| `voucherCode` | String | Không | Chỉ đơn POS (`POS-...`), tối đa 50 ký tự |
| `redeemedPoints` | Number | Không | Chỉ đơn POS, số nguyên `>= 0` |
| `quoteFingerprint` | String | Không | Chỉ đơn POS, lấy từ `POST /api/v1/orders/pos/{orderId}/quote` |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thanh toán và xuất hóa đơn thành công",
  "result": {
    "invoiceId": 801,
    "invoiceCode": "HD-20261031-001",
    "orderId": 1001,
    "orderCode": "DH-20261031-001",
    "totalActualPaid": 595000.00,
    "vatAmount": 47600.00,
    "cashReceived": 600000.00,
    "cashChange": 5000.00,
    "paymentStatus": "PAID",
    "paymentMethod": "CASH",
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.00,
    "earnedPoints": 5,
    "note": "Khách đưa 600.000đ",
    "issuedAt": "2026-10-31T12:05:00"
  },
  "errors": null,
  "timestamp": "2026-10-31T12:05:00"
}
```

- Các trường điểm (`redeemedPoints` ... `earnedPoints`) là `null` với đơn không có snapshot loyalty. `totalActualPaid` là cơ sở tích điểm / xét hạng, không phải `cashReceived`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Đơn đã thanh toán (`ORDER_ALREADY_PAID`), thiếu tiền (`PAYMENT_AMOUNT_INSUFFICIENT`), phương thức không phải tiền mặt, đơn không ở trạng thái thanh toán được, thiếu tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 403 Forbidden:** `CUSTOMER` thanh toán đơn của người khác, đơn POS hoặc đơn có voucher COD.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng hoặc phương thức thanh toán.
- **HTTP 409 Conflict:** Fingerprint / điểm đã đổi (`4107 QUOTE_CHANGED`) hoặc gửi lại với dữ liệu tài chính khác (`4108 IDEMPOTENCY_CONFLICT`).

---

## 4. Tạo Payment Attempt

- **Endpoint:** `POST /api/v1/payments/attempts`
- **Quyền hạn:** `CUSTOMER` (chỉ đơn của mình)
- **Mô tả:** Tạo lượt thanh toán trực tuyến cho đơn; số tiền lấy từ đơn hàng, không nhận từ client. Cùng `idempotencyKey` trả lại lượt cũ (xem mục 11).

### Request Body
```json
{
  "orderId": 1001,
  "provider": "STRIPE",
  "idempotencyKey": "pay-order-1001-STRIPE"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `provider` | String | Có | `STRIPE`, `VNPAY` |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn/cổng, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo payment attempt thành công",
  "result": {
    "id": 21,
    "orderId": 1001,
    "provider": "STRIPE",
    "status": "CREATED",
    "amount": 595000.00,
    "currency": "VND",
    "providerReference": "SKELETON-3f0c...",
    "checkoutUrl": null,
    "createdAt": "2026-11-05T09:00:00",
    "expiresAt": null
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- `status`: `CREATED`, `PENDING`, `SETTLEMENT_PENDING`, `SETTLED`, `FAILED`, `CANCELLED`, `EXPIRED`, `REVIEW_REQUIRED`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, đơn không thanh toán được / có tiền phải trả bằng 0, đơn đã có hóa đơn (`ORDER_ALREADY_PAID`).
- **HTTP 403 Forbidden:** Đơn của người khác hoặc không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).
- **HTTP 409 Conflict:** `idempotencyKey` đã thuộc đơn hàng khác (`DATA_CONFLICT`).

---

## 5. Xem Payment Attempt

- **Endpoint:** `GET /api/v1/payments/attempts/{id}`
- **Quyền hạn:** `CUSTOMER` (chỉ lượt thanh toán của mình)
- **Mô tả:** Xem trạng thái một lượt thanh toán, cùng dạng `result` như mục 4.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy payment attempt thành công",
  "result": {
    "id": 21,
    "orderId": 1001,
    "provider": "STRIPE",
    "status": "PENDING",
    "amount": 595000.00,
    "currency": "VND",
    "providerReference": "cs_test_a1B2c3...",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3...",
    "createdAt": "2026-11-05T09:00:00",
    "expiresAt": null
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Lượt thanh toán của người khác.
- **HTTP 404 Not Found:** Không tìm thấy payment attempt.

---

## 6. Tạo phiên Stripe Checkout (test mode)

- **Endpoint:** `POST /api/v1/payments/stripe/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Tạo (hoặc lấy lại) lượt thanh toán Stripe và phiên Hosted Checkout. Chỉ nhận khóa `sk_test_`; số tiền lấy từ đơn hàng.

### Request Body
```json
{
  "orderId": 1001,
  "idempotencyKey": "pay-order-1001-STRIPE"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo Stripe Checkout thành công",
  "result": {
    "attemptId": 21,
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3..."
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- Lượt đang mở trả lại `checkoutUrl` đã lưu với message `Stripe Checkout đã tồn tại`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Đơn đã thanh toán, không thanh toán được hoặc Stripe từ chối (`PAYMENT_PROVIDER_REJECTED`).
- **HTTP 403 Forbidden:** Đơn của người khác hoặc không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng.
- **HTTP 409 Conflict:** `idempotencyKey` đã thuộc đơn hàng khác.
- **HTTP 503 Service Unavailable:** Stripe chưa cấu hình hoặc không khả dụng (`PAYMENT_PROVIDER_NOT_CONFIGURED`, `PAYMENT_PROVIDER_UNAVAILABLE`).

---

## 7. Stripe Webhook

- **Endpoint:** `POST /api/v1/payments/stripe/webhook`
- **Quyền hạn:** `PUBLIC` (Server-to-Server từ Stripe, xác thực bằng header `Stripe-Signature`)
- **Mô tả:** Nhận sự kiện Stripe đã ký (HMAC-SHA256, lệch giờ tối đa 300 giây). Chỉ xử lý `checkout.session.completed` (khi `payment_status = paid`), `async_payment_succeeded`, `async_payment_failed`, `expired`; kiểm tra khớp số tiền / tiền tệ. `PAID` chỉ được ghi nhận từ sự kiện đã xác thực này, không từ trang redirect.

### Request Body
Payload sự kiện Stripe nguyên bản (raw JSON).

### Response Thành công (HTTP 200 OK)
```json
{
  "received": true
}
```

- Loại sự kiện không xử lý trả `{ "received": true, "ignored": true }`. Response không bọc `ApiResponse`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Sai chữ ký, thiếu cấu hình secret, payload thiếu trường hoặc số tiền / tiền tệ không khớp.
- **HTTP 404 Not Found:** Không tìm thấy payment attempt theo phiên Stripe.
- **HTTP 409 Conflict:** Cùng event id nhưng payload đã thay đổi.

---

## 8. Tạo URL thanh toán VNPAY (sandbox)

- **Endpoint:** `POST /api/v1/payments/vnpay/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Tạo (hoặc lấy lại) lượt thanh toán VNPAY và URL thanh toán đã ký HMAC-SHA512. Số tiền × 100 (VND nguyên); `vnp_TxnRef` = `VNPAY{attemptId}{yyyyMMddHHmmss}`, mỗi lượt mới có TxnRef mới.

### Request Body
```json
{
  "orderId": 1001,
  "idempotencyKey": "pay-order-1001-VNPAY"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo VNPAY checkout thành công",
  "result": {
    "attemptId": 22,
    "checkoutUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=59500000&vnp_TxnRef=VNPAY2220261105090000&..."
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- Lượt đang mở trả lại `checkoutUrl` đã lưu với message `VNPAY checkout đã tồn tại`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Đơn đã thanh toán hoặc không thanh toán được.
- **HTTP 403 Forbidden:** Đơn của người khác hoặc không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng.
- **HTTP 409 Conflict:** `idempotencyKey` đã thuộc đơn hàng khác.
- **HTTP 503 Service Unavailable:** VNPAY chưa cấu hình (`PAYMENT_PROVIDER_NOT_CONFIGURED`).

---

## 9. Kết quả trả về từ VNPAY (Return URL)

- **Endpoint:** `GET /api/v1/payments/vnpay/return`
- **Quyền hạn:** `PUBLIC` (trình duyệt khách quay về từ VNPAY, kèm các tham số `vnp_*`)
- **Mô tả:** Chỉ kiểm tra chữ ký để hiển thị kết quả cho khách, **không** ghi nhận thanh toán.

### Response Thành công (HTTP 200 OK)
```json
{
  "valid": true,
  "displayOnly": true,
  "responseCode": "00",
  "transactionStatus": "00",
  "txnRef": "VNPAY2220261105090000"
}
```

- Response không bọc `ApiResponse`; `valid = false` khi sai chữ ký.

---

## 10. Xử lý IPN từ VNPAY

- **Endpoint:** `GET /api/v1/payments/vnpay/ipn`
- **Quyền hạn:** `PUBLIC` (Server-to-Server từ VNPAY, xác thực `vnp_SecureHash` HMAC-SHA512 và `vnp_TmnCode`)
- **Mô tả:** Nhận kết quả giao dịch, kiểm tra chữ ký / merchant / số tiền, rồi ghi nhận thanh toán. Thành công khi `vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`; sự kiện chống trùng theo `{txnRef}:{vnp_TransactionNo}`.

### Response Thành công (HTTP 200 OK)
```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```

### Response Lỗi thường gặp
Luôn trả HTTP 200, `RspCode` cho biết kết quả:
- **`97`:** Sai chữ ký.
- **`99`:** Sai merchant (`vnp_TmnCode`).
- **`01`:** Không tìm thấy giao dịch theo `vnp_TxnRef`.
- **`04`:** Sai số tiền hoặc tiền tệ.

---

## 11. Quy tắc thanh toán lại (Re-pay)

FE gửi một `idempotencyKey` cố định cho mỗi đơn / cổng; server xét lượt mới nhất của khóa đó (áp dụng cho mục 4, 6 và 8).

| Lượt mới nhất | Kết quả khi gửi lại cùng khóa |
| :--- | :--- |
| Chưa có | Tạo lượt `CREATED` mới |
| `CREATED`, `PENDING`, `SETTLEMENT_PENDING` | Trả lại đúng lượt đó (cùng `checkoutUrl`) |
| `SETTLED`, `REVIEW_REQUIRED` | Trả lại lượt đó (HTTP 201, không tạo phiên mới) |
| `FAILED`, `CANCELLED`, `EXPIRED` | Tạo lượt mới với khóa nội bộ `<khóa>~r<n>` và phiên Stripe / `TxnRef` VNPAY mới |

- Đơn đã có hóa đơn → `400 ORDER_ALREADY_PAID`; khóa thuộc đơn khác → `409 DATA_CONFLICT`. Response không đổi, khóa nội bộ không lộ ra ngoài.
- Thanh toán muộn sau khi lượt `CANCELLED` / `EXPIRED` chuyển sang `REVIEW_REQUIRED`, không tự hoàn tiền hay xử lý đơn.
